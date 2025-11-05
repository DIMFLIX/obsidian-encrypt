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
    let text = value.trim();
    if (text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1).trim();
    const sp = text.indexOf(' ');
    if (sp >= 0) {
      try { this.encryptedData = JSON.parse(text.slice(sp + 1).trim()); } catch { this.encryptedData = null; }
    }
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    root.className = 'meld-inline-widget-container';

    const renderButton = () => {
      root.replaceChildren();
      const btn = document.createElement('span');
      btn.className = 'meld-inline-secret-button';
      if (this.encryptedData?.hint && String(this.encryptedData.hint).trim()) {
        btn.setAttribute('title', `Hint: ${this.encryptedData.hint}`);
      }
      btn.onclick = async (e) => {
        e.preventDefault();
        await openDecrypt();
      };
      root.appendChild(btn);
    };

    const renderRevealed = (plain: string) => {
      root.replaceChildren();
      const wrap = document.createElement('div'); wrap.className = 'meld-decrypt-block';
      const cnt = document.createElement('div'); cnt.className = 'meld-decrypt-content'; cnt.textContent = plain; wrap.appendChild(cnt);
      const hide = document.createElement('button'); hide.className = 'meld-decrypt-hide-button'; hide.textContent = 'Hide'; hide.onclick = () => renderButton();
      wrap.appendChild(hide);
      root.appendChild(wrap);
    };

    const openDecrypt = async () => {
      if (!this.encryptedData) { new Notice('Invalid encrypted data'); return; }
      try {
        const pm = new PluginPasswordModal(this.plugin.app,'Decrypt Secret',false,false,{ password:'', hint: this.encryptedData.hint || ''});
        const pwh: PasswordAndHint = await pm.openAsync();
        if (!pm.resultConfirmed) return;
        const decrypted = await FileDataHelper.decrypt(this.encryptedData, pwh.password);
        if (decrypted == null) throw new Error('Invalid password or corrupted data');
        renderRevealed(decrypted);
      } catch (err) { new Notice(`Decryption error: ${err}`, 6000); }
    };

    renderButton();
    return root;
  }
}
