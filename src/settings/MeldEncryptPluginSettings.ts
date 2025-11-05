import { IFeatureWholeNoteEncryptSettings } from "../features/feature-whole-note-encrypt/IFeatureWholeNoteEncryptSettings.ts";

export interface IMeldEncryptPluginSettings {
	confirmPassword: boolean;
	rememberPassword: boolean;
	rememberPasswordTimeout: number;
	rememberPasswordLevel: string;
	rememberPasswordExternalFilePaths: string[];

	// When enabled, decrypted inline blocks are auto-hidden when leaving a note
	autoReEncryptOnLeave: boolean;

	featureWholeNoteEncrypt : IFeatureWholeNoteEncryptSettings;
}
