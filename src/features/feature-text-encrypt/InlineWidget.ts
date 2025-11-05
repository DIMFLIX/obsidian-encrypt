import { App } from "obsidian";
import { EditorView, WidgetType } from "@codemirror/view";
import MeldEncrypt from "../../main.ts";
import { FileDataHelper } from "../../services/FileDataHelper.ts";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { PasswordAndHint } from "../../services/SessionPasswordService.ts";
import { Notice } from "obsidian";

export class MeldInlineWidget extends WidgetType {
	plugin: MeldEncrypt;
	encryptedData: any;

	constructor(public app: App, plugin: MeldEncrypt, public value: string) {
		super();
		this.plugin = plugin;
		
		// Parse encrypted data from value
		let text = value.trim();
		if (text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1).trim();
		const sp = text.indexOf(' ');
		if (sp >= 0) {
			try {
				this.encryptedData = JSON.parse(text.slice(sp + 1).trim());
			} catch {
				this.encryptedData = null;
			}
		}
	}

	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement('div');
		div.className = 'meld-inline-widget-container';
		
		const button = div.createEl('span');
		button.className = 'meld-inline-secret-button';
		
		if (this.encryptedData?.hint && String(this.encryptedData.hint).trim()) {
			button.setAttribute('title', `Hint: ${this.encryptedData.hint}`);
		}
		
		button.addEventListener('click', async (e) => {
			e.preventDefault();
			await this.decryptInlineSecret();
		});
		
		return div;
	}

	private async decryptInlineSecret() {
		if (!this.encryptedData) {
			new Notice('Invalid encrypted data');
			return;
		}
		
		try {
			const pm = new PluginPasswordModal(
				this.plugin.app,
				'Decrypt Secret',
				false,
				false,
				{ password: '', hint: this.encryptedData.hint || '' }
			);
			const pwh: PasswordAndHint = await pm.openAsync();
			if (!pm.resultConfirmed) return;
			
			const decrypted = await FileDataHelper.decrypt(this.encryptedData, pwh.password);
			if (decrypted == null) throw new Error('Invalid password or corrupted data');
			
			new Notice(`🔓 Secret: ${decrypted}`, 5000);
		} catch (err) {
			new Notice(`Decryption error: ${err}`, 8000);
		}
	}
}