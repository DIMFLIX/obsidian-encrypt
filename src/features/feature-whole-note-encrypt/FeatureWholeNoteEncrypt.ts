import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { EncryptedMarkdownView } from "./EncryptedMarkdownView.ts";
import { EncryptedImageView } from "./EncryptedImageView.ts";
import { MarkdownView, TFolder, normalizePath, moment, TFile, FileView } from "obsidian";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import { FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { ENCRYPTED_FILE_EXTENSIONS, ENCRYPTED_FILE_EXTENSION_DEFAULT, IMAGE_FILE_EXTENSIONS, POTENTIALLY_ENCRYPTED_FILE_EXTENSIONS } from "../../services/Constants.ts";
import { Utils } from "../../services/Utils.ts";

export default class FeatureWholeNoteEncryptV2 implements IMeldEncryptPluginFeature {

	plugin: MeldEncrypt;

	private statusIndicator: HTMLElement;

	async onload( plugin: MeldEncrypt ) {
		this.plugin = plugin;
		//this.settings = settings.featureWholeNoteEncrypt;
		
		this.plugin.addRibbonIcon( 'file-lock-2', 'New encrypted note', async (ev)=>{
			await this.processCreateNewEncryptedNoteCommand( this.getDefaultFileFolder() );
		});

		this.plugin.addRibbonIcon( 'book-lock', 'Lock and Close all open encrypted notes', async (ev)=>{
			await this.processLockAndCloseAllEncryptedNotesCommand();
		});

		this.plugin.addCommand({
			id: 'meld-encrypt-create-new-note',
			name: 'Create new encrypted note',
			icon: 'file-lock-2',
			callback: async () => await this.processCreateNewEncryptedNoteCommand( this.getDefaultFileFolder() ),
		});

		this.plugin.addCommand({
			id: 'meld-encrypt-close-and-forget',
			name: 'Lock and Close all open encrypted notes',
			icon: 'book-lock',
			callback: async () => await this.processLockAndCloseAllEncryptedNotesCommand(),
		});
		
		this.plugin.registerEvent(
			this.plugin.app.workspace.on( 'file-menu', (menu, file) => {
				if (file instanceof TFolder){
					menu.addItem( (item) => {
						item
							.setTitle('New encrypted note')
							.setIcon('file-lock-2')
							.onClick( () => this.processCreateNewEncryptedNoteCommand( file ) );
						}
					);
				}
			})
		);

		// configure status indicator
		this.statusIndicator = this.plugin.addStatusBarItem();
		this.statusIndicator.hide();
		this.statusIndicator.setText('🔐');

		// editor context menu
		this.plugin.registerEvent( this.plugin.app.workspace.on('editor-menu', async (menu, editor, view) => {
			if( view.file == null ){
				return;
			}
			
			const shouldHandle = await Utils.shouldHandleFileAsEncrypted(this.plugin.app, view.file);
			if( !shouldHandle ){
				return;
			}
			
			if (view instanceof EncryptedMarkdownView){
				menu.addItem( (item) => {
					item
						.setTitle('Change Password')
						.setIcon('key-round')
						.onClick( async () => await view.changePassword() );
					}
				);
				menu.addItem( (item) => {
					item
						.setTitle('Lock & Close')
						.setIcon('lock')
						.onClick( () => view.lockAndClose() );
					}
				);
			}
		}));

		this.plugin.registerEvent( this.plugin.app.workspace.on('file-menu', async (menu, file) => {
			if ( !(file instanceof TFile) ){
				return
			}
			
			const shouldHandle = await Utils.shouldHandleFileAsEncrypted(this.plugin.app, file);
			if( !shouldHandle ){
				return;
			}

			const view = this.plugin.app.workspace.getActiveViewOfType( EncryptedMarkdownView );
			if (view == null || view.file != file){
				return;
			}

			menu.addItem( (item) => {
				item
					.setTitle('Change Password')
					.setIcon('key-round')
					.onClick( async () => await view.changePassword() );
				}
			);
			menu.addItem( (item) => {
				item
					.setTitle('Lock & Close')
					.setIcon('lock')
					.onClick( () => view.lockAndClose() );
				}
			);
		}))


		// register view
		this.plugin.registerView( EncryptedMarkdownView.VIEW_TYPE, (leaf) => new EncryptedMarkdownView(leaf) );
		this.plugin.registerView( EncryptedImageView.VIEW_TYPE, (leaf) => new EncryptedImageView(leaf) );
		this.plugin.registerExtensions( ENCRYPTED_FILE_EXTENSIONS, EncryptedMarkdownView.VIEW_TYPE );

		// show status indicator for encrypted files, hide for others
		this.plugin.registerEvent( this.plugin.app.workspace.on('active-leaf-change', () => {
			const view = this.plugin.app.workspace.getActiveViewOfType(EncryptedMarkdownView);
			if (view == null){
				this.statusIndicator.hide();
				return;
			}
			this.statusIndicator.show();
		}));

		// make sure the view is the right type
		this.plugin.registerEvent(

			this.plugin.app.workspace.on('active-leaf-change', async (leaf) => {
				if ( leaf == null ){
					return;
				}

				let file: TFile | null = null;

				if ( leaf.view instanceof MarkdownView || leaf.view instanceof EncryptedMarkdownView || leaf.view instanceof EncryptedImageView ){
					file = leaf.view.file;
				} else {
					return;
				}

				if ( file == null ){
					return;
				}

				// Check if file should be handled as encrypted
				const shouldHandleAsEncrypted = await Utils.shouldHandleFileAsEncrypted(this.plugin.app, file);

				if ( shouldHandleAsEncrypted ){
					const appropriateViewType = await this.determineViewTypeForEncryptedFile(file);	

					if ( leaf.view instanceof EncryptedMarkdownView && appropriateViewType === EncryptedMarkdownView.VIEW_TYPE ){
						// console.log('Correct view already active: ' + appropriateViewType);
						return;
					}

					if ( leaf.view instanceof EncryptedImageView && appropriateViewType === EncryptedImageView.VIEW_TYPE ){
						// console.log('Correct view already active: ' + appropriateViewType);
						return;
					}

					// console.log('Switching to view type: ' + appropriateViewType);
					const viewState = leaf.getViewState();
					viewState.type = appropriateViewType;
					
					await leaf.setViewState( viewState );
				}

				return;			
			} )
		);

		// Also listen for file modifications to handle encryption/decryption changes
		this.plugin.registerEvent(
			this.plugin.app.vault.on('modify', async (file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') {
					return;
				}

				// Small delay to ensure file content is properly updated
				setTimeout(async () => {
					// Find any open leaves with this file
					this.plugin.app.workspace.iterateAllLeaves((leaf) => {
						if (leaf.view instanceof MarkdownView && leaf.view.file === file) {
							// Check if this file should now be handled as encrypted
							Utils.shouldHandleFileAsEncrypted(this.plugin.app, file).then(async (shouldHandleAsEncrypted) => {
								if (shouldHandleAsEncrypted) {
									console.log('Switching .md file to encrypted view:', file.path);
									const appropriateViewType = await this.determineViewTypeForEncryptedFile(file);
									const viewState = leaf.getViewState();
									viewState.type = appropriateViewType;
									await leaf.setViewState(viewState);
								}
							}).catch(error => {
								console.warn('Error checking if file should be encrypted:', error);
							});
						} else if (leaf.view instanceof EncryptedMarkdownView && leaf.view.file === file) {
							// Check if this file should no longer be handled as encrypted
							Utils.shouldHandleFileAsEncrypted(this.plugin.app, file).then(async (shouldHandleAsEncrypted) => {
								if (!shouldHandleAsEncrypted) {
									console.log('Switching .md file to normal markdown view:', file.path);
									const viewState = leaf.getViewState();
									viewState.type = 'markdown';
									await leaf.setViewState(viewState);
								}
							}).catch(error => {
								console.warn('Error checking if file should be decrypted:', error);
							});
						}
					});
				}, 150);
			})
		);

	}

	private async processLockAndCloseAllEncryptedNotesCommand(): Promise<void> {
		// loop through all open leaves
		const leaves = this.plugin.app.workspace.getLeavesOfType( EncryptedMarkdownView.VIEW_TYPE );
		for ( const leaf of leaves ) {
			const view = leaf.view as EncryptedMarkdownView;
			if ( view != null ){
				view.lockAndClose();
			}
		}
	}

	private getDefaultFileFolder() : TFolder {
		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (activeFile != null){
			return this.plugin.app.fileManager.getNewFileParent(activeFile.path);
		}else{
			return this.plugin.app.fileManager.getNewFileParent('');
		}
	}

	private async processCreateNewEncryptedNoteCommand( parentFolder: TFolder ) : Promise<void> {
		
		// Create .md files with encrypted JSON content instead of .mdenc files
		const newFilename = moment().format( `[Untitled] YYYYMMDD hhmmss[.md]`);
		const newFilepath = normalizePath( parentFolder.path + "/" + newFilename );
		
		let pwh : PasswordAndHint | undefined;
		
		if ( SessionPasswordService.getLevel() == SessionPasswordService.LevelExternalFile ){
			// if using external file for password, try and get the password
			pwh = await SessionPasswordService.getByPathAsync( newFilepath );
		}

		// if the password is unknown, prompt for it
		if ( !pwh ){
			// prompt for password
			const pwm = new PluginPasswordModal(
				this.plugin.app,
				'Please provide a password for encryption',
				true,
				true,
				await SessionPasswordService.getByPathAsync( newFilepath )
			);
			
			try{
				pwh = await pwm.openAsync();
			}catch(e){
				return; // cancelled
			}	
		}

		// create the new file
		const fileData = await FileDataHelper.encrypt( pwh.password, pwh.hint, '', 'md' )
		const fileContents = JsonFileEncoding.encode( fileData );
		const file = await this.plugin.app.vault.create( newFilepath, fileContents );
		
		// cache the password
		SessionPasswordService.putByFile( pwh, file );

		// open the file
		const leaf = this.plugin.app.workspace.getLeaf( true );
		await leaf.openFile( file );

	}

	private async determineViewTypeForEncryptedFile(file: TFile): Promise<string> {
		try {
			const fileContents = await this.plugin.app.vault.read(file);
			const encryptedData = JsonFileEncoding.decode(fileContents);
			
			if (encryptedData.originalFileExtension === 'md') {
				return EncryptedMarkdownView.VIEW_TYPE;
			} else if (encryptedData.originalFileExtension && IMAGE_FILE_EXTENSIONS.includes(encryptedData.originalFileExtension.toLowerCase())) {
				return EncryptedImageView.VIEW_TYPE;
			}

			// TODO: CREATE GENERIC VIEW FOR OTHER FILE TYPES IN CASE IS NOT MD OR IMAGE
			return EncryptedMarkdownView.VIEW_TYPE;

		} catch (error) {
			console.warn('Could not determine view type for encrypted file:', error);
			return EncryptedMarkdownView.VIEW_TYPE;
		}
	}

	onunload() {
		this.plugin.app.workspace.detachLeavesOfType(EncryptedMarkdownView.VIEW_TYPE);
		this.plugin.app.workspace.detachLeavesOfType(EncryptedImageView.VIEW_TYPE);
	}

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void {
		//throw new Error("Method not implemented.");
	}

}
