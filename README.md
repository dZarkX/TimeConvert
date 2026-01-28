# 🕐 TimeZone Converter

A small browser extension that detects times on web pages and converts them to your preferred timezone.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- **Auto-detection** - Automatically scans web pages for times with timezone information
- **Smart highlighting** - Detected times are highlighted for easy identification
- **Click to convert** - Click on any highlighted time to toggle between original and converted time
- **Multiple formats supported**:
  - 12-hour format: `5PM CET`, `5:00 PM EST`, `10:30 AM PST`
  - 24-hour format: `17:00 CET`, `14:30 UTC`
  - UTC offsets: `15:00 UTC+2`, `10AM UTC-5`
- **50+ timezone abbreviations** - CET, EST, PST, JST, GMT, UTC, and many more
- **Badge notification** - Shows count of detected times on the extension icon
- **Customizable appearance** - Choose your own highlight colors
- **Auto or manual timezone** - Use system timezone or select manually
- **Dark mode support** - Automatically adapts to your system theme

## 📦 Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome/Brave and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the project folder

### From Chrome Web Store
*Coming soon*

## 🚀 Usage

1. **Browse any webpage** - The extension automatically scans for times with timezone information
2. **Look for the badge** - A green badge on the extension icon shows how many times were found
3. **Click the extension icon** - See a list of all detected times with conversions
4. **Click highlighted times** - Toggle between original and converted time directly on the page
5. **Customize in settings** - Change colors, timezone, and other preferences

## ⚙️ Settings

Access settings by clicking the gear icon in the popup or right-clicking the extension icon.

### Timezone Settings
- **Auto-detect** - Uses your system timezone (default)
- **Manual selection** - Choose a specific timezone

### Appearance
- **Highlight colors** - Customize background and text colors
- **Color presets** - Quick selection of predefined color schemes
- **Enable/disable highlighting** - Toggle highlighting on pages

### Time Format
- **12-hour format** - 5:00 PM
- **24-hour format** - 17:00

## 🎨 Customization

The extension uses CSS variables for easy styling. Key variables in `src/styles/`:

```css
:root {
  --color-primary: #4CAF50;
  --color-highlight: #ffeb3b;
  --spacing-md: 12px;
  --radius-md: 8px;
  /* ... and more */
}
```

## 📁 Project Structure

```
manifest.json
src/
  icons/
  pages/
    popup.html
    popup.js
    settings.html
    settings.js
  scripts/
    background.js
    content.js
    timezones.js
    timeParser.js
  styles/
    popup.css
    settings.css
    highlight.css
test/
  test-page.html
```

## 🌍 Supported Timezones

### Europe
CET, CEST, WET, WEST, EET, EEST, BST, GMT, MSK

### North America
EST, EDT, CST, CDT, MST, MDT, PST, PDT, AKST, AKDT, HST

### Asia
JST, KST, HKT, SGT, ICT, PHT, IST (India)

### Australia & Pacific
AEST, AEDT, ACST, ACDT, AWST, NZST, NZDT

### South America
BRT, ART, CLT, CLST, PET, COT

### Africa & Middle East
CAT, EAT, WAT, SAST, AST, GST, TRT

### Universal
UTC, GMT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💖 Support

If you find this extension useful, consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com)

## 📄 License

MIT License - feel free to use and modify as you wish.

## 🐛 Known Issues

- Times without timezone information are not detected (by design)
- Some ambiguous timezone abbreviations (like IST - India/Ireland/Israel) default to one interpretation

## 📝 Changelog

### v1.0.0
- Initial release
- Auto-detection of times with timezone abbreviations
- Popup with conversion list
- Settings page with customization options
- Highlight system with click-to-toggle
- Support for 50+ timezone abbreviations

---

Git setup (local)

1. Initialize repository: `git init`
2. Create main branch: `git checkout -b main`
3. Create development branches: `git branch develop && git branch cleanup`

If you'd like, provide a remote URL and I can add and push branches for you.
