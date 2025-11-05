import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Notice, TFile, TextFileView } from "obsidian";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import { FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { Utils } from "../../services/Utils.ts";
import { DEFAULT_ENCRYPTABLE_FILE_EXTENSIONS, ENCRYPTED_FILE_EXTENSIONS, ENCRYPTED_FILE_EXTENSION_DEFAULT, IMAGE_FILE_EXTENSIONS, POTENTIALLY_ENCRYPTED_FILE_EXTENSIONS } from "../../services/Constants.ts";
import { EncryptedMarkdownView } from "../feature-whole-note-encrypt/EncryptedMarkdownView.ts";
import { EncryptedImageView } from "../feature-whole-note-encrypt/EncryptedImageView.ts";

export default class FeatureConvertNote implements IMeldEncryptPluginFeature {
	
	plugin: MeldEncrypt;
	
	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings) {
		this.plugin = plugin;

		this.plugin.addCommand({
			id: 'meld-encrypt-convert-to-or-from-encrypted-note',
			name: 'Convert to or from an Encrypted note',
			icon: 'file-lock-2',
			checkCallback: (checking) => this.processCommandConvertActiveNote( checking ),
		});

		this.plugin.addRibbonIcon(
			'file-lock-2',
			'Convert to or from an Encrypted note',
			(_) => this.processCommandConvertActiveNote( false )
		);


		this.plugin.registerEvent(
			this.plugin.app.workspace.on( 'file-menu', (menu, file) => {
				if (file instanceof TFile){
					if (DEFAULT_ENCRYPTABLE_FILE_EXTENSIONS.includes( file.extension ) ){
						menu.addItem( (item) => {
							item
								.setTitle('Encrypt note')
								.setIcon('file-lock-2')
								.onClick( () => this.processCommandEncryptNote( file ) );
							}
						);
					}
					if ( POTENTIALLY_ENCRYPTED_FILE_EXTENSIONS.includes( file.extension ) ){
						menu.addItem( (item) => {
							item
								.setTitle('Decrypt note')
								.setIcon('file')
								.onClick( () => this.processCommandDecryptNoteAsync( file ) );
							}
						);
					}
				}
			})
		);

		// editor context menu
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('editor-menu', async (menu, editor, view) => {
				if (view.file == null) {
					return;
				}

				const canEncrypt = this.checkCanEncryptFile(view.file);
				const canDecrypt = await this.checkCanDecryptFileAsync(view.file);

				if (canEncrypt) {
					menu.addItem((item) => {
						item
							.setTitle('Encrypt note')
							.setIcon('file-lock-2')
							.onClick(() => {
								if (view.file) {
									this.processCommandEncryptNote(view.file);
								}
							});
					});
				}

				if (canDecrypt) {
					menu.addItem((item) => {
						item
							.setTitle('Decrypt note')
							.setIcon('file')
							.onClick(() => {
								if (view.file) {
									this.processCommandDecryptNoteAsync(view.file);
								}
							});
					});
				}
			})
		);

	}
	
	onunload(): void { }

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void { }

	private checkCanEncryptFile( file:TFile | null ) : boolean {
		if ( file == null ){
			return false;
		}
		return DEFAULT_ENCRYPTABLE_FILE_EXTENSIONS.includes(file.extension);
	}

	private checkCanDecryptFile( file:TFile | null ) : boolean {
		if ( file == null ){
			return false;
		}
		return ENCRYPTED_FILE_EXTENSIONS.includes( file.extension );
	}

	/**
	 * Async version of checkCanDecryptFile that also checks .md file content
	 */
	private async checkCanDecryptFileAsync( file:TFile | null ) : Promise<boolean> {
		if ( file == null ){
			return false;
		}
		
		if (!POTENTIALLY_ENCRYPTED_FILE_EXTENSIONS.includes( file.extension )) {
			return false;
		}
		
		// Old encrypted extensions
		if (ENCRYPTED_FILE_EXTENSIONS.includes(file.extension)) {
			return true;
		}
		
		// Check if they contain encrypted content
		return await Utils.isMdFileEncrypted(this.plugin.app, file);
	}

	private isImageFile( file:TFile | null ) : boolean {
		if ( file == null ){
			return false;
		}
		return IMAGE_FILE_EXTENSIONS.includes(file.extension.toLowerCase());
	}

	private processCommandEncryptNote( file:TFile ){
		this.getPasswordAndEncryptFile( file ).catch( reason => {
			if (reason){
				new Notice(reason, 10000);
			}
		});
	}

	private processCommandDecryptNote( file:TFile ){
		this.getPasswordAndDecryptFile( file ).catch( reason => {
			if (reason){
				new Notice(reason, 10000);
			}
		});
	}

	private processCommandDecryptNoteAsync( file:TFile ){
		this.processCommandDecryptNoteWithCheck( file ).catch( reason => {
			if (reason){
				new Notice(reason, 10000);
			}
		});
	}

	private async processCommandDecryptNoteWithCheck( file:TFile ){
		if (!(await this.checkCanDecryptFileAsync(file))) {
			throw new Error('This file does not contain encrypted content');
		}
		
		await this.getPasswordAndDecryptFile( file );
	}

	private processCommandConvertActiveNote( checking: boolean ) : boolean | void {
		const file = this.plugin.app.workspace.getActiveFile();
		
		if (checking){
			return this.checkCanEncryptFile(file)
				|| this.checkCanDecryptFile(file)
			;
		}

		if ( file?.extension && DEFAULT_ENCRYPTABLE_FILE_EXTENSIONS.includes(file.extension) ){
			this.getPasswordAndEncryptFile( file ).catch( reason => {
				if (reason){
					new Notice(reason, 10000);
				}
			});
		}

		if ( file && POTENTIALLY_ENCRYPTED_FILE_EXTENSIONS.includes( file.extension ) ){
			// Use the async check for proper .md file handling
			this.processCommandDecryptNoteWithCheck( file ).catch( reason => {
				if (reason){
					new Notice(reason, 10000);
				}
			});
		}
	}

	private async getPasswordAndEncryptFile( file:TFile ) {

		if ( !this.checkCanEncryptFile(file) ) {
			throw new Error( 'Unable to encrypt file' );
		}

		try{

			// try to get password from session password service
			let password = await SessionPasswordService.getByFile( file );

			if ( password.password == '' ){
				// ask for password
				const pm = new PluginPasswordModal( this.plugin.app, 'Encrypt Note', true, true, password );
				password = await pm.openAsync();
			}

			const encryptedFileContent = await this.encryptFile(file, password);

			// Encrypt in md extension or default encrypted extension
			const newExtension = file.extension === 'md' ? 'md' : ENCRYPTED_FILE_EXTENSION_DEFAULT;

			await this.closeUpdateRememberPasswordThenReopen(
				file,
				newExtension,
				encryptedFileContent,
				password
			);
			
			new Notice( '🔐 Note was encrypted 🔐' );

		}catch( error ){
			if (error){
				new Notice(error, 10000);
			}
		}
	}

	private async getPasswordAndDecryptFile( file:TFile ) {
		if ( !(await this.checkCanDecryptFileAsync(file)) ) {
			throw new Error( 'Unable to decrypt file' );
		}

		const encryptedFileContent = await this.plugin.app.vault.read( file );
		const encryptedData = JsonFileEncoding.decode( encryptedFileContent );
		const isOriginallyImage = encryptedData.originalFileExtension && IMAGE_FILE_EXTENSIONS.includes(encryptedData.originalFileExtension.toLowerCase());

		let passwordAndHint = await SessionPasswordService.getByFile( file );
		if ( passwordAndHint.password != '' ){
			// try to decrypt using saved password
			const decryptedContent = await this.decryptFile( file, passwordAndHint.password );
			if (decryptedContent != null){
				// Handle different file types
				if (isOriginallyImage && decryptedContent instanceof ArrayBuffer) {
					await this.closeUpdateRememberPasswordThenReopenBinary( file, encryptedData.originalFileExtension || 'png', decryptedContent, passwordAndHint );
				} else if (typeof decryptedContent === 'string') {
					const targetExtension = file.extension === 'md' ? 'md' : (encryptedData.originalFileExtension || 'md');
					await this.closeUpdateRememberPasswordThenReopen( file, targetExtension, decryptedContent, passwordAndHint );
				}
				return;
			}
		}
		
		const pwm = new PluginPasswordModal(this.plugin.app, 'Decrypt Note', false, false, { password: '', hint: encryptedData.hint } );
		try{
			passwordAndHint = await pwm.openAsync();
			
			if (!pwm.resultConfirmed){
				return;
			}
			
			const content = await this.decryptFile( file, passwordAndHint.password );
			if ( content == null ){
				throw new Error('Decryption failed');
			}

			if (isOriginallyImage && content instanceof ArrayBuffer) {
				await this.closeUpdateRememberPasswordThenReopenBinary( file, encryptedData.originalFileExtension || 'png', content, passwordAndHint );
			} else if (typeof content === 'string') {
				const targetExtension = file.extension === 'md' ? 'md' : (encryptedData.originalFileExtension || 'md');
				await this.closeUpdateRememberPasswordThenReopen( file, targetExtension, content, passwordAndHint );
			}

			new Notice( '🔓 Note was decrypted 🔓' );

		}catch(error){
			if (error){
				new Notice(error, 10000);
			}
		}
	}

	private async closeUpdateRememberPasswordThenReopen( file:TFile, newFileExtension: string, content: string, pw:PasswordAndHint ) {
		
		let didDetach = false;
		let wasEncryptedView = false;

		this.plugin.app.workspace.iterateAllLeaves( l => {
			if ( l.view instanceof TextFileView && l.view.file == file ){
				if ( l.view instanceof EncryptedMarkdownView ){
					wasEncryptedView = true;
					l.view.detachSafely();
				}else{
					l.detach();
				}
				didDetach = true;
			}
		});

		try{
			const newFilepath = Utils.getFilePathWithNewExtension(file, newFileExtension);
			if (file.extension !== newFileExtension) {
				await this.plugin.app.fileManager.renameFile( file, newFilepath );
			}
			await this.plugin.app.vault.modify( file, content );
			SessionPasswordService.putByFile( pw, file );
			
			if (file.extension === 'md' && newFileExtension === 'md') {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}finally{
			if( didDetach ){
				const leaf = this.plugin.app.workspace.getLeaf( true );
				await leaf.openFile(file);

				if (file.extension === 'md') {
					// For .md files, force the correct view if encrypted
					setTimeout(async () => {
						const shouldBeEncrypted = await Utils.isMdFileEncrypted(this.plugin.app, file);
						if (shouldBeEncrypted && !(leaf.view instanceof EncryptedMarkdownView)) {
							const viewState = leaf.getViewState();
							viewState.type = EncryptedMarkdownView.VIEW_TYPE;
							await leaf.setViewState(viewState);
						} else if (!shouldBeEncrypted && leaf.view instanceof EncryptedMarkdownView) {
							const viewState = leaf.getViewState();
							viewState.type = 'markdown';
							await leaf.setViewState(viewState);
						}
					}, 200);
				}
			}
		}
	}

	private async closeUpdateRememberPasswordThenReopenBinary( file:TFile, newFileExtension: string, binaryContent: ArrayBuffer, pw:PasswordAndHint ) {
		
		let didDetach = false;

		this.plugin.app.workspace.iterateAllLeaves( l => {
			if ( l.view instanceof TextFileView && l.view.file == file ){
				if ( l.view instanceof EncryptedImageView ){
					l.view.detachSafely();
				}else{
					l.detach();
				}
				didDetach = true;
			}
		});

		try{
			const newFilepath = Utils.getFilePathWithNewExtension(file, newFileExtension);
			await this.plugin.app.fileManager.renameFile( file, newFilepath );
			// For binary files, use createBinary instead of modify
			await this.plugin.app.vault.delete(file);
			await this.plugin.app.vault.createBinary( newFilepath, binaryContent );
			// Update the file reference
			const newFile = this.plugin.app.vault.getAbstractFileByPath(newFilepath) as TFile;
			SessionPasswordService.putByFile( pw, newFile );
		}finally{
			if( didDetach ){
				const newFile = this.plugin.app.vault.getAbstractFileByPath(Utils.getFilePathWithNewExtension(file, newFileExtension)) as TFile;
				if (newFile) {
					await this.plugin.app.workspace.getLeaf( true ).openFile(newFile);
				}
			}
		}
	}

	private async encryptFile(file: TFile, passwordAndHint:PasswordAndHint ) : Promise<string> {
		let encryptedData: any;
		
		if (this.isImageFile(file)) {
			// Handle binary/image files
			const binaryContent = await this.plugin.app.vault.readBinary( file );
			encryptedData = await FileDataHelper.encryptBinary( passwordAndHint.password, passwordAndHint.hint, binaryContent, file.extension );
		} else {
			// Handle text files
			const content = await this.plugin.app.vault.read( file );
			encryptedData = await FileDataHelper.encrypt( passwordAndHint.password, passwordAndHint.hint, content, file.extension );
		}
		
		return JsonFileEncoding.encode( encryptedData );
	}

	private async decryptFile(file: TFile, password:string) : Promise<string | ArrayBuffer | null> {
		const encryptedFileContent = await this.plugin.app.vault.read( file );
		const encryptedData = JsonFileEncoding.decode( encryptedFileContent );
		
		// Check if this was originally an image file
		if (encryptedData.originalFileExtension && IMAGE_FILE_EXTENSIONS.includes(encryptedData.originalFileExtension.toLowerCase())) {
			// Return binary data for image files
			return await FileDataHelper.decryptBinary(encryptedData, password );
		} else {
			// Return text data for text files
			return await FileDataHelper.decrypt(encryptedData, password );
		}
	}
}