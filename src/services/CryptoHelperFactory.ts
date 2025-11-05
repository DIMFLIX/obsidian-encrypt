import { FileData } from "./FileDataHelper.ts";
import { Decryptable } from "./Decryptable.ts";
import { ICryptoHelper } from "./ICryptoHelper.ts";
import { CryptoHelper2304 } from "./CryptoHelper2304.ts";

export class CryptoHelperFactory{

	public static cryptoHelper2304_v2 = new CryptoHelper2304( 16, 16, 210000 );

	public static BuildDefault(): ICryptoHelper{
		return this.cryptoHelper2304_v2;
	}

	public static BuildFromFileDataOrThrow( data: FileData ) : ICryptoHelper {
		if ( data.version == '2.0' ){
			return this.cryptoHelper2304_v2;
		}
		throw new Error( `Unsupported file version ${data.version}. Only version 2.0 is supported.`);
	}

	public static BuildFromFileDataOrNull( data: FileData ) : ICryptoHelper | null {
		if ( data.version == '2.0' ){
			return this.cryptoHelper2304_v2;
		}
		return null;
	}

	public static BuildFromDecryptableOrThrow( decryptable: Decryptable ) : ICryptoHelper {
		if ( decryptable.version == 2 ){
			return this.cryptoHelper2304_v2;
		}
		throw new Error( `Unsupported decryptable version ${decryptable.version}. Only version 2 is supported.`);
	}

	public static BuildFromDecryptableOrNull( decryptable: Decryptable ) : ICryptoHelper | null {
		if ( decryptable.version == 2 ){
			return this.cryptoHelper2304_v2;
		}
		return null;
	}

}