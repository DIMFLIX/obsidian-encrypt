import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Notice, MarkdownView, Editor, MarkdownRenderer, Component, MarkdownPostProcessorContext } from "obsidian";
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
								.setTitle('Decrypt selected text')
								.setIcon('unlock')
								.onClick(() => {
									this.decryptSelectedText(editor, selection);
								});
						});
					} else {
						menu.addItem((item) => {
							item
								.setTitle('Encrypt selected text')
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
			name: 'Encrypt selected text',
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
					new Notice('Please select text to encrypt');
				}
			}
		});

		// Register markdown post processor for inline encrypted text
		this.plugin.registerMarkdownPostProcessor((el, ctx) => {
			this.processInlineEncryptedCode(el, ctx);
		});
	}

	onunload(): void {}

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void {}

	private isTextEncrypted(text: string): boolean {
		// Check for inline format: `secret {...encrypted JSON...}`
		const inlineMatch = text.match(/^`secret\s+([^`]+)`$/);
		if (inlineMatch) {
			try {
				const jsonStr = inlineMatch[1];
				const data = JSON.parse(jsonStr);
				return !!(data && data.version && data.encodedData);
			} catch {
				return false;
			}
		}
		return false;
	}

	private processInlineEncryptedCode(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const codeblocks = el.querySelectorAll('code');
		for (let i = 0; i < codeblocks.length; i++) {
			const codeblock = codeblocks.item(i);
			const text = codeblock.innerText.trim();
			
			// Check for our inline encrypted format
			const match = text.match(/^secret\s+(.+)$/);
			if (match) {
				try {
					const jsonStr = match[1];
					const encryptedData = JSON.parse(jsonStr);
					
					if (encryptedData && encryptedData.version && encryptedData.encodedData) {
						// Replace with SVG button
						codeblock.empty();
						codeblock.addClass('meld-inline-secret-button');
						
						// Add click handler
						codeblock.addEventListener('click', async (e) => {
							e.preventDefault();
							await this.decryptInlineSecret(encryptedData);
						});
					}
				} catch (error) {
					// Not a valid encrypted block, ignore
				}
			}
		}
	}

	private async decryptInlineSecret(encryptedData: any) {
		try {
			// Ask for password
			const pm = new PluginPasswordModal(
				this.plugin.app,
				'Decrypt Secret',
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
				throw new Error('Invalid password or corrupted data');
			}

			// Show decrypted text in a notice or modal
			new Notice(`🔓 Secret: ${decryptedText}`, 5000);
		} catch (error) {
			if (error) {
				new Notice(`Decryption error: ${error}`, 10000);
			}
		}
	}

	private async encryptSelectedText(editor: Editor, selectedText: string) {
		try {
			// Ask for password
			const pm = new PluginPasswordModal(
				this.plugin.app,
				'Encrypt Text',
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

			// Create inline format: `secret {JSON}`
			const jsonStr = JSON.stringify(encryptedData);
			const inlineEncryptedText = `\`secret ${jsonStr}\``;
			editor.replaceSelection(inlineEncryptedText);

			new Notice('🔐 Text encrypted 🔐');
		} catch (error) {
			if (error) {
				new Notice(`Encryption error: ${error}`, 10000);
			}
		}
	}

	private async decryptSelectedText(editor: Editor, selectedText: string) {
		try {
			// Extract JSON from inline format
			const match = selectedText.match(/^`secret\s+(.+)`$/);
			if (!match) {
				throw new Error('Invalid encrypted format');
			}

			const jsonStr = match[1];
			const encryptedData = JSON.parse(jsonStr);

			// Ask for password
			const pm = new PluginPasswordModal(
				this.plugin.app,
				'Decrypt Text',
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
				throw new Error('Invalid password or corrupted data');
			}

			// Replace selected text with decrypted version
			editor.replaceSelection(decryptedText);

			new Notice('🔓 Text decrypted 🔓');
		} catch (error) {
			if (error) {
				new Notice(`Decryption error: ${error}`, 10000);
			}
		}
	}
}