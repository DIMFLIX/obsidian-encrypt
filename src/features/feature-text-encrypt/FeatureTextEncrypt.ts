import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Notice, MarkdownView, Editor, MarkdownPostProcessorContext } from "obsidian";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { PasswordAndHint } from "../../services/SessionPasswordService.ts";
import { FileDataHelper } from "../../services/FileDataHelper.ts";
import { livePreviewExtension } from "./LivePreviewExtension.ts";

export default class FeatureTextEncrypt implements IMeldEncryptPluginFeature {
	plugin: MeldEncrypt;

	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings) {
		this.plugin = plugin;

		// Register Live Preview extension for edit mode rendering
		this.plugin.registerEditorExtension(livePreviewExtension(this.plugin.app, this.plugin));

		// Context menu
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
				if (!(view instanceof MarkdownView)) return;
				const sel = editor.getSelection();
				if (!sel || sel.trim().length === 0) return;
				if (this.isTextEncryptedInline(sel)) {
					menu.addItem((i)=>i.setTitle('Decrypt selected text').setIcon('unlock').onClick(()=>this.decryptSelectedText(editor, sel)));
				} else {
					menu.addItem((i)=>i.setTitle('Encrypt selected text').setIcon('lock').onClick(()=>this.encryptSelectedText(editor, sel)));
				}
			})
		);

		// Command
		this.plugin.addCommand({
			id: 'meld-encrypt-selected-text',
			name: 'Encrypt selected text',
			icon: 'lock',
			editorCallback: (editor: Editor) => {
				const sel = editor.getSelection();
				if (!sel || sel.trim().length === 0) { new Notice('Please select text to encrypt'); return; }
				if (this.isTextEncryptedInline(sel)) this.decryptSelectedText(editor, sel); else this.encryptSelectedText(editor, sel);
			}
		});

		// Markdown processor for Reading mode
		this.plugin.registerMarkdownPostProcessor((root, ctx: MarkdownPostProcessorContext)=>{
			const codes = root.querySelectorAll('code');
			codes.forEach((code)=>{
				if (code.closest('pre')) return;
				let raw = code.textContent ?? '';
				let text = raw.trim();
				if (text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1).trim();
				if (!text.toLowerCase().startsWith('meld-encrypt')) return;
				const sp = text.indexOf(' ');
				if (sp < 0) return;
				const jsonStr = text.slice(sp+1).trim();
				let data: any; try { data = JSON.parse(jsonStr); } catch { return; }
				if (!data || !data.version || !data.encodedData) return;

				// Default view = button
				const renderButton = () => {
					code.textContent = '';
					code.classList.add('meld-inline-secret-button');
					code.setAttribute('role','button');
					if (data.hint && String(data.hint).trim()) code.setAttribute('title', `Hint: ${data.hint}`);
					code.onclick = async (e)=>{
						e.preventDefault();
						await openDecrypt();
					};
				};

				const renderRevealed = (plain: string) => {
					code.classList.remove('meld-inline-secret-button');
					code.textContent = '';
					const wrap = document.createElement('div');
					wrap.className = 'meld-decrypt-block';
					const cnt = document.createElement('div'); cnt.className = 'meld-decrypt-content'; cnt.textContent = plain; wrap.appendChild(cnt);
					const hide = document.createElement('button'); hide.className = 'meld-decrypt-hide-button'; hide.textContent = 'Hide';
					hide.onclick = ()=>renderButton();
					wrap.appendChild(hide);
					code.appendChild(wrap);
				};

				const openDecrypt = async () => {
					try{
						const pm = new PluginPasswordModal(this.plugin.app,'Decrypt Secret',false,false,{ password:'', hint: data.hint || ''});
						const pwh: PasswordAndHint = await pm.openAsync();
						if (!pm.resultConfirmed) return;
						const decrypted = await FileDataHelper.decrypt(data, pwh.password);
						if (decrypted == null) throw new Error('Invalid password or corrupted data');
						renderRevealed(decrypted);
					}catch(err){ new Notice(`Decryption error: ${err}`, 6000); }
				};

				renderButton();
			});
		});
	}

	onunload(): void {}
	buildSettingsUi(): void {}

	private isTextEncryptedInline(text: string): boolean {
		let t = text.trim();
		if (t.startsWith('`') && t.endsWith('`')) t = t.slice(1, -1).trim();
		if (!t.toLowerCase().startsWith('meld-encrypt')) return false;
		const sp = t.indexOf(' ');
		if (sp < 0) return false;
		try {
			const data = JSON.parse(t.slice(sp+1).trim());
			return !!(data && data.version && data.encodedData);
		} catch { return false; }
	}

	private async encryptSelectedText(editor: Editor, selectedText: string) {
		try{
			const pm = new PluginPasswordModal(this.plugin.app,'Encrypt Text',true,true,{ password:'', hint:''});
			const pwh: PasswordAndHint = await pm.openAsync();
			if (!pm.resultConfirmed) return;
			const data = await FileDataHelper.encrypt(pwh.password, pwh.hint, selectedText);
			const inline = `\`meld-encrypt ${JSON.stringify(data)}\``;
			editor.replaceSelection(inline);
			new Notice('🔐 Text encrypted 🔐');
		}catch(err){ new Notice(`Encryption error: ${err}`, 8000); }
	}

	private async decryptSelectedText(editor: Editor, selectedText: string) {
		let t = selectedText.trim();
		if (t.startsWith('`') && t.endsWith('`')) t = t.slice(1, -1).trim();
		const sp = t.indexOf(' ');
		if (sp < 0) { new Notice('Invalid encrypted format'); return; }
		let data: any; try { data = JSON.parse(t.slice(sp+1).trim()); } catch { new Notice('Invalid encrypted JSON'); return; }
		try{
			const pm = new PluginPasswordModal(this.plugin.app,'Decrypt Text',false,false,{ password:'', hint: data.hint || ''});
			const pwh: PasswordAndHint = await pm.openAsync();
			if (!pm.resultConfirmed) return;
			const decrypted = await FileDataHelper.decrypt(data, pwh.password);
			if (decrypted == null) throw new Error('Invalid password or corrupted data');
			editor.replaceSelection(decrypted);
			new Notice('🔓 Text decrypted 🔓');
		}catch(err){ new Notice(`Decryption error: ${err}`, 8000); }
	}
}
