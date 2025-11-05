import { CryptoHelperFactory } from "./CryptoHelperFactory.ts";

export class FileData {
	
	public version = '2.0';
	public hint: string;
	public encodedData:string;
	public originalFileExtension?: string;

	constructor( version:string, hint:string, encodedData:string, originalFileExtension?:string ){
		this.version = version;
		this.hint = hint;
		this.encodedData = encodedData;
		this.originalFileExtension = originalFileExtension;
	}
}

export class FileDataHelper{

	public static DEFAULT_VERSION = '2.0';

	public static async encrypt( pass: string, hint:string, text:string, originalFileExtension?:string ) : Promise<FileData>{
		const crypto = CryptoHelperFactory.BuildDefault();
		const encryptedData = await crypto.encryptToBase64(text, pass);
		return new FileData( FileDataHelper.DEFAULT_VERSION, hint, encryptedData, originalFileExtension);
	}

	public static async encryptBinary( pass: string, hint:string, binaryData: ArrayBuffer, originalFileExtension?:string ) : Promise<FileData>{
		const base64Data = FileDataHelper.arrayBufferToBase64(binaryData);
		const crypto = CryptoHelperFactory.BuildDefault();
		const encryptedData = await crypto.encryptToBase64(base64Data, pass);
		return new FileData( FileDataHelper.DEFAULT_VERSION, hint, encryptedData, originalFileExtension);
	}

	public static async decrypt( data: FileData, pass:string ) : Promise<string|null>{
		if ( data.encodedData == '' ){
			return '';
		}
		const crypto = CryptoHelperFactory.BuildFromFileDataOrThrow( data );
		return await crypto.decryptFromBase64( data.encodedData, pass );
	}

	public static async decryptBinary( data: FileData, pass:string ) : Promise<ArrayBuffer|null>{
		if ( data.encodedData == '' ){
			return new ArrayBuffer(0);
		}
		const crypto = CryptoHelperFactory.BuildFromFileDataOrThrow( data );
		const decryptedBase64 = await crypto.decryptFromBase64( data.encodedData, pass );
		if (decryptedBase64 == null) {
			return null;
		}
		return FileDataHelper.base64ToArrayBuffer(decryptedBase64);
	}

	private static arrayBufferToBase64(buffer: ArrayBuffer): string {
		const binary = new Uint8Array(buffer);
		let result = '';
		for (let i = 0; i < binary.length; i++) {
			result += String.fromCharCode(binary[i]);
		}
		return btoa(result);
	}

	private static base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}
}

export class JsonFileEncoding {

	public static encode( data: FileData ) : string{
		//console.debug( 'JsonFileEncoding.encode', {data} );
		return JSON.stringify(data, null, 2);
	}

	public static isEncoded( text: string ) : boolean {
		try {
			JSON.parse( text );
			return true;
		} catch ( error ) {
			return false;
		}
	}

	public static decode( encodedText:string ) : FileData {
		//console.debug('JsonFileEncoding.decode',{encodedText});
		if ( encodedText === '' ){
			return new FileData( FileDataHelper.DEFAULT_VERSION, '', '' );
		}
		return JSON.parse( encodedText ) as FileData;
	}
}