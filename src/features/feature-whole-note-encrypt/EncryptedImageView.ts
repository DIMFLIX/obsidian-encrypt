import { FileView, Notice, TFile } from "obsidian";
import { FileData, FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { ENCRYPTED_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS } from "../../services/Constants.ts";

export class EncryptedImageView extends FileView {

	static VIEW_TYPE = 'meld-encrypted-image-view';

	passwordAndHint : PasswordAndHint | null = null;
	encryptedData : FileData | null = null;
	cachedImageData : ArrayBuffer | null = null;
	dataWasChangedSinceLastSave = false;
	
	isSavingEnabled = false;
	isLoadingFileInProgress = false;
	isSavingInProgress = false;
	
	override allowNoFile = false;

	private imageEl: HTMLImageElement | null = null;
	origFile: TFile | null = null; // used to resync password cache when renaming the file
	
	override getViewType(): string {
		return EncryptedImageView.VIEW_TYPE;
	}

	override canAcceptExtension(extension: string): boolean {
		return ENCRYPTED_FILE_EXTENSIONS.includes( extension );
	}

	getDisplayText(): string {
		return this.file?.basename || 'Encrypted Image';
	}

	protected override async onOpen(): Promise<void> {
		await super.onOpen();

		// Set up the image container
		this.contentEl.empty();
		this.contentEl.addClass('encrypted-image-view');
		
		// Create image element
		this.imageEl = this.contentEl.createEl('img', {
			cls: 'encrypted-image',
			attr: {
				style: 'max-width: 100%; max-height: 100%; object-fit: contain; display: block; margin: 0 auto;'
			}
		});

		// add view actions
		this.addAction(
			'key-round',
			'Change password',
			() => this.changePassword(),
		)

		this.addAction(
			'lock',
			'Lock & Close',
			() => this.lockAndClose(),
		)

		this.addAction(
			'download',
			'Save decrypted image',
			() => this.saveDecryptedImage(),
		)
	}

	override async onLoadFile(file: TFile): Promise<void> {
		this.setViewBusy( true );
		try{
			if (!this.app.workspace.layoutReady ){
				this.leaf.detach();
				return;
			}

			const fileContents = await this.app.vault.read( file );
			this.encryptedData = JsonFileEncoding.decode( fileContents );

			this.passwordAndHint = await SessionPasswordService.getByFile( file );
			this.passwordAndHint.hint = this.encryptedData.hint;

			// try to decrypt the file content
			let decryptedData: ArrayBuffer | null = null;

			if ( this.passwordAndHint.password.length > 0 ) {
				decryptedData = await FileDataHelper.decryptBinary( this.encryptedData, this.passwordAndHint.password );
			}
			while( decryptedData == null ){
				// prompt for password
				this.passwordAndHint = await new PluginPasswordModal(
					this.app,
					`Decrypting "${file.basename}"`,
					false,
					false,
					{ password: '', hint: this.encryptedData.hint }
				).open2Async();

				if ( this.passwordAndHint == null ) {
					// user cancelled
					this.leaf.detach();
					return;
				}

				decryptedData = await FileDataHelper.decryptBinary( this.encryptedData, this.passwordAndHint.password );
				if ( decryptedData == null ) {
					new Notice('Decryption failed');
				}
			}

			if ( decryptedData == null ) {
				this.leaf.detach();
				return;
			}

			if ( this.passwordAndHint != null ) {
				SessionPasswordService.putByFile( this.passwordAndHint, file );
			}

			this.setDecryptedImageData( decryptedData );

			this.isLoadingFileInProgress = true;
			try{
				this.origFile = file;
				await super.onLoadFile(file);
			}finally{
				this.isLoadingFileInProgress = false;
				this.isSavingEnabled = true; // allow saving after the file is loaded with a password
			}

		}finally{
			this.setViewBusy( false );
		}
	}

	private setViewBusy( busy: boolean ) {
		if ( busy ) {
			this.contentEl.style.cursor = 'wait';
		} else {
			this.contentEl.style.cursor = 'auto';
		}
	}

	private setDecryptedImageData(imageData: ArrayBuffer): void {
		this.cachedImageData = imageData;
		
		if (this.imageEl && this.encryptedData?.originalFileExtension) {
			// Create a blob from the image data
			const mimeType = this.getMimeType(this.encryptedData.originalFileExtension);
			const blob = new Blob([imageData], { type: mimeType });
			const imageUrl = URL.createObjectURL(blob);
			
			this.imageEl.src = imageUrl;
			this.imageEl.onload = () => {
				// Clean up the previous URL if any
				if (this.imageEl?.src.startsWith('blob:')) {
					URL.revokeObjectURL(this.imageEl.src);
				}
			};
		}
	}

	private getMimeType(extension: string): string {
		const mimeTypes: Record<string, string> = {
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'bmp': 'image/bmp',
			'svg': 'image/svg+xml',
			'ico': 'image/x-icon',
			'tiff': 'image/tiff',
			'tif': 'image/tiff'
		};
		return mimeTypes[extension.toLowerCase()] || 'image/png';
	}

	public detachSafely(){
		// Clean up image URL
		if (this.imageEl?.src.startsWith('blob:')) {
			URL.revokeObjectURL(this.imageEl.src);
		}
		this.isSavingEnabled = false;
		this.leaf.detach();
	}

	override async onUnloadFile(file: TFile): Promise<void> {
		// Clean up image URL
		if (this.imageEl?.src.startsWith('blob:')) {
			URL.revokeObjectURL(this.imageEl.src);
		}
		
		if ( this.passwordAndHint == null || this.encryptedData == null ) {
			return;
		}
		
		await super.onUnloadFile(file);
	}

	override async onRename(file: TFile): Promise<void> {
		if (this.origFile){
			SessionPasswordService.clearForFile( this.origFile );
		}

		if (this.passwordAndHint != null){
			SessionPasswordService.putByFile( this.passwordAndHint, file );
		}
		await super.onRename(file);
	}

	// Images are read-only in this view, so we don't need complex saving logic
	// The encrypted data doesn't change unless password is changed
	async save(): Promise<void> {
		// Images are typically not edited in this view, so no save needed
		// Password changes would trigger a re-encryption
		console.debug('Image save requested - no action needed for read-only image view');
	}

	lockAndClose() {
		this.detachSafely();
		if ( this.file != null ){
			SessionPasswordService.clearForFile( this.file );
		}
	}

	async changePassword(): Promise<void> {
		if (this.file == null){
			console.info('Unable to change password because there is no file loaded in the view yet');
			return;
		}

		if (this.cachedImageData == null) {
			new Notice('No image data available for re-encryption');
			return;
		}

		// fetch password
		const pwm = new PluginPasswordModal(
			this.app,
			`Change password for "${this.file.basename}"`,
			true,
			true,
			await SessionPasswordService.getByFile( this.file )
		);
			
		try{
			const newPwh = await pwm.openAsync();

			// Re-encrypt the image data with new password
			this.encryptedData = await FileDataHelper.encryptBinary(
				newPwh.password,
				newPwh.hint,
				this.cachedImageData,
				this.encryptedData?.originalFileExtension || 'png'
			);

			// Save the re-encrypted data
			const encryptedContent = JsonFileEncoding.encode(this.encryptedData);
			await this.app.vault.modify(this.file, encryptedContent);

			this.passwordAndHint = newPwh;
			SessionPasswordService.putByFile( newPwh, this.file );

			new Notice( 'Password changed' );
		}catch(error){
			new Notice( 'Password wasn\'t changed' );
		}
	}

	async saveDecryptedImage(): Promise<void> {
		if (!this.cachedImageData || !this.file || !this.encryptedData?.originalFileExtension) {
			new Notice('No image data available to save');
			return;
		}

		try {
			// Create a new file with the decrypted image data
			const originalExtension = this.encryptedData.originalFileExtension;
			const newFileName = this.file.basename.replace(/\.(mdenc|encrypted)$/, '') + '.' + originalExtension;
			const newFilePath = this.file.parent ? `${this.file.parent.path}/${newFileName}` : newFileName;

			// Convert ArrayBuffer to Uint8Array for Obsidian's vault.createBinary
			const uint8Array = new Uint8Array(this.cachedImageData);
			await this.app.vault.createBinary(newFilePath, uint8Array);

			new Notice(`Decrypted image saved as: ${newFileName}`);
		} catch (error) {
			console.error('Error saving decrypted image:', error);
			new Notice('Failed to save decrypted image');
		}
	}

	// Helper method to check if a file extension is an image
	static isImageExtension(extension: string): boolean {
		return IMAGE_FILE_EXTENSIONS.includes(extension.toLowerCase());
	}

}
