# 🕐 TimeZone Converter

A small browser extension that detects times on web pages and converts them to your preferred timezone.

![Version](https://img.shields.io/badge/version-1.5.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

GitHub: https://github.com/dZarkX/TimeConvert

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
- **Countdown timers** - Shows time remaining until future events (in 5 languages)
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

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/3mon)

## 🗣️ Feedback / Issues

If you have feedback or found a bug, please open an issue on GitHub:

https://github.com/dZarkX/TimeConvert/issues

## 📄 License

MIT License - feel free to use and modify as you wish.

## 🐛 Known Issues

- Times without timezone information are not detected (by design)
- Some ambiguous timezone abbreviations (like IST - India/Ireland/Israel) default to one interpretation

## 📝 Changelog

### v1.5.0
- **NEW**: Countdown timers for future events - shows time remaining until detected events
- Countdown displays in small, non-intrusive text next to highlighted times
- Smart pluralization support for Polish, German, Spanish, Portuguese, and English
- Color-coded urgency: red for imminent events, orange for near-future events
- Automatic updates every minute for accurate countdowns
- Only shows countdowns for events within next 30 days

### v1.4.0
- Updated product descriptions in all supported languages (EN, PL, DE, ES, PT)
- Improved marketing copy for better user understanding
- Version bump to 1.4.0

### v1.2.7
- Settings autosave (no manual Save button) + Restore Defaults moved to footer

### v1.2.3
- GitHub feedback link in popup + repo links

### v1.2.1
- Reduced permissions (removed activeTab)

### v1.2.0
- Added Privacy Policy page + sharper settings logo

### v1.1.9
- Low impact scan modes (auto / auto-light / manual)

### v1.1.7
- Date detection (ISO/EU/month-name) and safer matching order

### v1.1.6
- Tooltip-only mode: fixed double tooltip (native title vs custom tooltip)

### v1.1.5
- Auto convert + text-only highlight style compatibility fix

### v1.1.4
- Added Display Mode, Result Format options, Date Detection and Scan Mode UI

### v1.1.0
- Ignored sites UI and popup improvements

---

## 🔒 Privacy Policy

See: [privacy-policy.html](privacy-policy.html)

Git setup (local)

1. Initialize repository: `git init`
2. Create main branch: `git checkout -b main`
3. Create development branches: `git branch develop && git branch cleanup`

If you'd like, provide a remote URL and I can add and push branches for you.
