import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Notice, MarkdownView, Editor, MarkdownRenderer, Component } from "obsidian";
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

		// Register markdown post processor for rendering encrypted blocks
		this.plugin.registerMarkdownPostProcessor((element, context) => {
			const codeBlocks = element.querySelectorAll('code');
			
			codeBlocks.forEach((codeBlock) => {
				const text = codeBlock.textContent?.trim();
				if (text && this.isTextEncrypted(text)) {
					this.renderEncryptedBlock(codeBlock, text, context);
				}
			});
		});
	}

	onunload(): void {}

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void {}

	private isTextEncrypted(text: string): boolean {
		// Check if text looks like encrypted content
		try {
			const decoded = JsonFileEncoding.decode(text.trim());
			return Boolean(decoded && decoded.encodedData && decoded.encodedData.length > 0);
		} catch {
			return false;
		}
	}

	private renderEncryptedBlock(codeBlock: Element, encryptedText: string, context: any) {
		try {
			const encryptedData = JsonFileEncoding.decode(encryptedText);
			const hint = encryptedData.hint || 'SECRET';
			
			// Create the encrypted block container
			const encryptedBlock = createDiv({ cls: 'meld-encrypt-block' });
			
			// Create the lock button
			const lockButton = createEl('button', {
				cls: 'meld-encrypt-button',
				text: hint
			});
			
			// Add lock icon
			const lockIcon = createSpan({ cls: 'meld-encrypt-icon' });
			lockIcon.innerHTML = '🔒';
			lockButton.prepend(lockIcon);
			
			// Add click handler
			lockButton.addEventListener('click', async () => {
				await this.decryptEncryptedBlock(encryptedData, codeBlock, encryptedText);
			});
			
			encryptedBlock.appendChild(lockButton);
			
			// Replace the code block with our custom element
			codeBlock.replaceWith(encryptedBlock);
		} catch (error) {
			console.error('Failed to render encrypted block:', error);
		}
	}

	private async decryptEncryptedBlock(encryptedData: any, originalElement: Element, encryptedText: string) {
		try {
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

			// Show decrypted text temporarily
			const decryptedBlock = createDiv({ cls: 'meld-decrypt-block' });
			
			const textContent = createDiv({ cls: 'meld-decrypt-content' });
			textContent.textContent = decryptedText;
			
			const hideButton = createEl('button', {
				cls: 'meld-decrypt-hide-button',
				text: 'Hide'
			});
			
			hideButton.addEventListener('click', () => {
				// Restore encrypted block
				this.renderEncryptedBlock(decryptedBlock, encryptedText, null);
			});
			
			decryptedBlock.appendChild(textContent);
			decryptedBlock.appendChild(hideButton);
			
			originalElement.replaceWith(decryptedBlock);
			
			new Notice('🔓 Text decrypted 🔓');
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

			const encryptedText = JsonFileEncoding.encode(encryptedData);

			// Replace selected text with encrypted version wrapped in code block
			const wrappedEncryptedText = `\`${encryptedText}\``;
			editor.replaceSelection(wrappedEncryptedText);

			new Notice('🔐 Text encrypted 🔐');
		} catch (error) {
			if (error) {
				new Notice(`Encryption error: ${error}`, 10000);
			}
		}
	}

	private async decryptSelectedText(editor: Editor, selectedText: string) {
		try {
			// Clean up the text (remove code block backticks if present)
			let cleanText = selectedText.trim();
			if (cleanText.startsWith('`') && cleanText.endsWith('`')) {
				cleanText = cleanText.slice(1, -1);
			}

			// Decode the encrypted data
			const encryptedData = JsonFileEncoding.decode(cleanText);

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