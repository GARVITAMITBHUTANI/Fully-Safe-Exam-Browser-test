# FSEB `.seb` Compatibility & Configuration Guide

## 1. Supported Configuration Formats

FSEB supports two primary configuration formats:
1. **Unencrypted Apple XML Property List (`.seb`)** — The standard unencrypted XML format used by Safe Exam Browser.
2. **JSON Exam Configuration (`.json` or `.seb`)** — A clean JSON representation for modern testing platforms.

---

## 2. SEB Plist Key Mappings

| SEB XML Key | FSEB Property | Description | Default in FSEB |
| :--- | :--- | :--- | :--- |
| `startURL` / `startUrl` | `startUrl` | Main exam website URL | Required |
| `urlFilterRules` / `allowedUrls` | `allowedUrls` | Allowed URL patterns or origins | Origin of `startUrl` |
| `fullscreen` | `fullscreen` | Fullscreen examination terminal | `true` |
| `browserWindowAllowReload` | `navigation.allowReload` | Permitted page reloading (F5, Ctrl+R) | `true` |
| `allowDownUploads` | `downloads` | File download capability | `false` |
| `allowSpellCheck` | `browser.allowSpellCheck` | Spellcheck dictionary in inputs | `false` |
| `allowDevTools` | `developerTools` | Chromium developer tools | `false` |
| `allowCopy` | `clipboard.copy` | Copy text (Ctrl+C) | `true` (authorized) |
| `allowPaste` | `clipboard.paste` | Paste text (Ctrl+V) | `true` (authorized) |
| `allowSelectAll` | `clipboard.selectAll` | Select all (Ctrl+A) | `true` (authorized) |
| `windowSwitching` | `windowSwitching` | OS Window switching (Alt+Tab) | `true` (authorized) |

---

## 3. Cryptographic & Security Format Limitations

> [!NOTE]
> FSEB is an independent open implementation and is not affiliated with Safe Exam Browser (ETH Zurich).

Some institutional `.seb` configuration files are encrypted with institutional certificates, Blowfish, or password-based keys (such as SEB 2.x/3.x encrypted containers). 

**In the MVP release:**
- FSEB does **not** implement cryptographic bypasses or attempt to crack password-protected or institutional certificate-encrypted configurations.
- When an encrypted file is detected, FSEB displays an informative diagnostic screen explaining that unencrypted `.seb` configurations should be provided by the exam administrator.

