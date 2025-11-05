# [Meld Encrypt](https://github.com/meld-cp/obsidian-encrypt) Plugin for Obsidian

**Create Encrypted Notes Within Your [Obsidian.md](https://obsidian.md/) Vault**

[Meld Encrypt](https://github.com/meld-cp/obsidian-encrypt) is a community plugin that lets you encrypt and decrypt your notes in [Obsidian](https://obsidian.md/). You can choose to encrypt an [entire note](https://meld-cp.github.io/obsidian-encrypt/whole-encrypted-notes.html) or just [selected text within a note](https://meld-cp.github.io/obsidian-encrypt/in-place-encryption.html).

Encrypted notes are never decrypted to disk giving you peace-of-mind that the decrypted contents haven't been sync'd or backed up to external systems.

## Features

### 🆕 Enhanced Visual Text Encryption
- **Right-click any selected text** to encrypt or decrypt it instantly
- **Beautiful encrypted blocks**: Instead of raw JSON, encrypted text appears as stylish lock buttons
- **Smart hint display**: Shows your custom hint or "SECRET" as default
- **Click to decrypt**: Simply click the lock button to decrypt the content
- **Temporary reveal**: Decrypted text shows temporarily with a "Hide" button
- **In-place replacement**: Encrypted/decrypted text replaces the selection directly in your note
- **Password protection**: Each text selection can have its own password and hint
- **Seamless workflow**: Select text → Right-click → Choose "Encrypt selected text" or "Decrypt selected text"

### Visual Experience

Instead of seeing ugly JSON like this:
```json
{
  "version": "2.0",
  "hint": "my secret",
  "encodedData": "DxMN8S64QCQVflNkiWntfpqBbL3sPQodw1D4rWp5pxJAGYjZzbPxlG9iGOCRFBIO/rtupJQKhroGr/gs"
}
```

You'll see a beautiful lock button: **🔒 my secret** (or **🔒 SECRET** if no hint was provided)

### Existing Features
- Encrypt entire notes
- Session password caching
- Multiple encryption methods
- File menu integration
- Keyboard shortcut support

---

> [!WARNING]
> ⚠️ Use at Your Own Risk ⚠️
> - Your passwords are never stored. If you forget your password, your notes cannot be decrypted..
> - The encryption methods used have not been independently audited. Unauthorized access may be possible if someone gains access to your files.
> - Bugs may be introduced at any time. You are solely responsible for maintaining backups of your notes.

---

## How to Use Visual Text Encryption

### Encrypting Text
1. **Select any text** in your note that you want to encrypt
2. **Right-click** on the selected text
3. **Choose "Encrypt selected text"** from the context menu
4. **Enter a password** and optional hint when prompted
5. **Confirm** - your selected text will be replaced with a beautiful lock button showing your hint

### Decrypting Text
1. **Click on the lock button** (🔒 with your hint)
2. **Enter the password** used for encryption
3. **Confirm** - the decrypted text will appear temporarily
4. **Click "Hide"** to return to the encrypted lock button state

### Alternative Method (Context Menu)
You can also:
1. **Select the entire encrypted block**
2. **Right-click** and choose "Decrypt selected text"
3. **Enter password** and the encrypted block will be permanently replaced with plain text

## Styling

The plugin automatically adapts to your Obsidian theme:
- **Light themes**: Clean, minimal design with subtle shadows
- **Dark themes**: Elegant dark styling with proper contrast
- **Hover effects**: Buttons lift slightly when hovered
- **Click animations**: Smooth transitions and feedback

## Ongoing Maintenance and Development

If you find this plugin useful please support the ongoing maintenance and development by:
* [Staring ⭐ this repo](https://github.com/meld-cp/obsidian-encrypt)
* [Buying me a coffee ☕](https://www.buymeacoffee.com/cleon)
* [Sponsoring ❤️ me](https://github.com/sponsors/meld-cp).

Thank you for your support 😊

<a href="https://www.buymeacoffee.com/cleon" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 50px !important;" ></a>


## Latest Changes

### ✨ New in this Enhanced Fork
- **🎨 Beautiful Visual Design**: No more ugly JSON blocks - encrypted text appears as elegant lock buttons
- **📝 Smart Hint Display**: Shows your custom hint or "SECRET" as fallback
- **🕰️ Click to Decrypt**: Simply click the lock button to decrypt temporarily
- **🔄 Hide/Show Toggle**: Decrypted content can be hidden again without re-encryption
- **🌍 English Interface**: Professional English UI throughout
- **🎨 Theme Integration**: Seamless integration with light and dark themes
- **🚀 Enhanced UX**: Smooth animations and hover effects
- **🎯 Context Menu Integration**: Right-click selected text to encrypt/decrypt instantly

Information about the original plugin's latest release can be found on the [release notes](https://meld-cp.github.io/obsidian-encrypt/release-notes.html) page.

Report any bugs or features requests [here](https://github.com/meld-cp/obsidian-encrypt/issues).


## Documentation

Documentation can be found [here](https://meld-cp.github.io/obsidian-encrypt/)
