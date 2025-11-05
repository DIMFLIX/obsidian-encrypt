import { TFile, normalizePath } from "obsidian";
import { JsonFileEncoding } from "./FileDataHelper.ts";
import { ENCRYPTED_FILE_EXTENSIONS, POTENTIALLY_ENCRYPTED_FILE_EXTENSIONS } from "./Constants.ts";

export class Utils{

	public static getFilePathWithNewExtension( file: TFile, newExtension : string ) : string {
		return normalizePath( `${file.parent?.path}/${file.basename}.${newExtension}` )
	}

	public static getFilePathExcludingExtension( file: TFile ) : string {
		return normalizePath( `${file.parent?.path}/${file.basename}` );
	}

	public static isEncryptedContent(content: string): boolean {
		try {
			// Check if content is valid JSON
			if (!JsonFileEncoding.isEncoded(content.trim())) {
				return false;
			}

			const data = JsonFileEncoding.decode(content.trim());

			// Check if it has the structure of encrypted data
			return !!(data && 
				data.version && 
				data.encodedData && 
				typeof data.encodedData === 'string' && 
				data.encodedData.length > 0);
		} catch (error) {
			return false;
		}
	}


	public static async isMdFileEncrypted(app: any, file: TFile): Promise<boolean> {
		try {
			if (file.extension !== 'md') {
				return false;
			}
			
			const content = await app.vault.read(file);
			return Utils.isEncryptedContent(content);
		} catch (error) {
			return false;
		}
	}

	public static async shouldHandleFileAsEncrypted(app: any, file: TFile): Promise<boolean> {
		if (!file) {
			return false;
		}

		// Handle legacy encrypted extensions (.mdenc, .encrypted)
		if (ENCRYPTED_FILE_EXTENSIONS.includes(file.extension)) {
			return true;
		}

		// For .md files, check if content is encrypted JSON
		return await Utils.isMdFileEncrypted(app, file);
	}

}