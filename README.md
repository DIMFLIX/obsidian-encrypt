# [Meld Encrypt](https://github.com/meld-cp/obsidian-encrypt) Plugin for Obsidian

**Create Encrypted Notes Within Your [Obsidian.md](https://obsidian.md/) Vault**

[Meld Encrypt](https://github.com/meld-cp/obsidian-encrypt) is a community plugin that lets you encrypt and decrypt your notes in [Obsidian](https://obsidian.md/). You can choose to encrypt an [entire note](https://meld-cp.github.io/obsidian-encrypt/whole-encrypted-notes.html) or just [selected text within a note](https://meld-cp.github.io/obsidian-encrypt/in-place-encryption.html).

Encrypted notes are never decrypted to disk giving you peace-of-mind that the decrypted contents haven't been sync'd or backed up to external systems.

## Features

### 🆕 Context Menu Text Encryption
- **Right-click any selected text** to encrypt or decrypt it instantly
- **Seamless workflow**: Select text → Right-click → Choose "Зашифровать выделенный текст" or "Расшифровать выделенный текст"
- **Smart detection**: The plugin automatically detects whether selected text is already encrypted
- **In-place replacement**: Encrypted/decrypted text replaces the selection directly in your note
- **Password protection**: Each text selection can have its own password and hint
- **Keyboard shortcut support**: Use the command palette or assign custom hotkeys

### Existing Features
- Encrypt entire notes
- In-place text encryption and decryption
- Session password caching
- Multiple encryption methods
- File menu integration

---

> [!WARNING]
> ⚠️ Use at Your Own Risk ⚠️
> - Your passwords are never stored. If you forget your password, your notes cannot be decrypted..
> - The encryption methods used have not been independently audited. Unauthorized access may be possible if someone gains access to your files.
> - Bugs may be introduced at any time. You are solely responsible for maintaining backups of your notes.

---

## How to Use Context Menu Encryption

1. **Select any text** in your note that you want to encrypt
2. **Right-click** on the selected text
3. **Choose "Зашифровать выделенный текст"** from the context menu
4. **Enter a password** and optional hint when prompted
5. **Confirm** - your selected text will be replaced with encrypted content

To decrypt:
1. **Select the encrypted text block** (the JSON-formatted encrypted content)
2. **Right-click** and choose "Расшифровать выделенный текст"
3. **Enter the password** used for encryption
4. **Confirm** - the encrypted text will be replaced with the original content

## Ongoing Maintenance and Development

If you find this plugin useful please support the ongoing maintenance and development by:
* [Staring ⭐ this repo](https://github.com/meld-cp/obsidian-encrypt)
* [Buying me a coffee ☕](https://www.buymeacoffee.com/cleon)
* [Sponsoring ❤️ me](https://github.com/sponsors/meld-cp).

Thank you for your support 😊

<a href="https://www.buymeacoffee.com/cleon" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 50px !important;" ></a>


## Latest Changes

### New in this Fork
- ✨ **Context Menu Integration**: Right-click selected text to encrypt/decrypt instantly
- 🎯 **Smart Text Detection**: Automatically detects encrypted vs plain text
- 🚀 **Seamless UX**: No need to use commands or buttons - just select and right-click
- 🇷🇺 **Localized Interface**: Russian language support for menu items and notifications

Information about the original plugin's latest release can be found on the [release notes](https://meld-cp.github.io/obsidian-encrypt/release-notes.html) page.

Report any bugs or features requests [here](https://github.com/meld-cp/obsidian-encrypt/issues).


## Documentation

Documentation can be found [here](https://meld-cp.github.io/obsidian-encrypt/)
