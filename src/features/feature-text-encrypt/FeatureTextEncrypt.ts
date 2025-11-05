import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Notice, MarkdownView, Editor } from "obsidian";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { PasswordAndHint } from "../../services/SessionPasswordService.ts";
import { FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";

export default class FeatureTextEncrypt implements IMeldEncryptPluginFeature {
	plugin: MeldEncrypt;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings) {
		this.plugin = plugin;

		// Register context menu for editor
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
				if (!(view instanceof MarkdownView)) {
					return;
				}

				const selection = editor.getSelection();
				
				// Only show menu item if text is selected
				if (selection && selection.trim().length > 0) {
					// Check if selected text is already encrypted
					if (this.isTextEncrypted(selection)) {
						menu.addItem((item) => {
							item
								.setTitle('Расшифровать выделенный текст')
								.setIcon('unlock')
								.onClick(() => {
									this.decryptSelectedText(editor, selection);
								});
						});
					} else {
						menu.addItem((item) => {
							item
								.setTitle('Зашифровать выделенный текст')
								.setIcon('lock')
								.onClick(() => {
									this.encryptSelectedText(editor, selection);
								});
						});
					}
				}
			})
		);

		// Add commands for keyboard shortcuts
		this.plugin.addCommand({
			id: 'meld-encrypt-selected-text',
			name: 'Зашифровать выделенный текст',
			icon: 'lock',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				if (selection && selection.trim().length > 0) {
					if (this.isTextEncrypted(selection)) {
						this.decryptSelectedText(editor, selection);
					} else {
						this.encryptSelectedText(editor, selection);
					}
				} else {
					new Notice('Выделите текст для шифрования');
				}
			}
		});
	}

	onunload(): void {}

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void {}

	private isTextEncrypted(text: string): boolean {
		// Check if text looks like encrypted content
		try {
			const decoded = JsonFileEncoding.decode(text.trim());
			return decoded && decoded.encodedData && decoded.encodedData.length > 0;
		} catch {
			return false;
		}
	}

	private async encryptSelectedText(editor: Editor, selectedText: string) {
		try {
			// Ask for password
			const pm = new PluginPasswordModal(
				this.plugin.app,
				'Шифрование текста',
				true,
				true,
				{ password: '', hint: '' }
			);
			const passwordAndHint: PasswordAndHint = await pm.openAsync();

			if (!pm.resultConfirmed) {
				return;
			}

			// Encrypt the text
			const encryptedData = await FileDataHelper.encrypt(
				passwordAndHint.password,
				passwordAndHint.hint,
				selectedText
			);

			const encryptedText = JsonFileEncoding.encode(encryptedData);

			// Replace selected text with encrypted version
			editor.replaceSelection(encryptedText);

			new Notice('🔐 Текст зашифрован 🔐');
		} catch (error) {
			if (error) {
				new Notice(`Ошибка шифрования: ${error}`, 10000);
			}
		}
	}

	private async decryptSelectedText(editor: Editor, selectedText: string) {
		try {
			// Decode the encrypted data
			const encryptedData = JsonFileEncoding.decode(selectedText.trim());

			// Ask for password
			const pm = new PluginPasswordModal(
				this.plugin.app,
				'Расшифровка текста',
				false,
				false,
				{ password: '', hint: encryptedData.hint || '' }
			);
			const passwordAndHint: PasswordAndHint = await pm.openAsync();

			if (!pm.resultConfirmed) {
				return;
			}

			// Decrypt the text
			const decryptedText = await FileDataHelper.decrypt(encryptedData, passwordAndHint.password);

			if (decryptedText === null) {
				throw new Error('Неверный пароль или поврежденные данные');
			}

			// Replace selected text with decrypted version
			editor.replaceSelection(decryptedText);

			new Notice('🔓 Текст расшифрован 🔓');
		} catch (error) {
			if (error) {
				new Notice(`Ошибка расшифровки: ${error}`, 10000);
			}
		}
	}
}