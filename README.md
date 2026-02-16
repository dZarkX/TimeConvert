# 🕐 TimeZone Converter

A small browser extension that detects times on web pages and converts them to your preferred timezone.

![Version](https://img.shields.io/badge/version-2.0.2-green)
![License](https://img.shields.io/badge/license-MIT-blue)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Download%20Now-brightgreen)](https://chromewebstore.google.com/detail/timezone-converter/phpmfhmlfolhocoefklfafhipdopgdka?authuser=0&hl=pl)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add-ons-Pending%20Review-orange)](https://addons.mozilla.org/en-US/firefox/addon/timezone-converter/)

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
- **Experimental: NLP Detection** - Detect natural language time expressions like "in 2 hours" or "tomorrow at noon"
- **Experimental: Context Timezone** - Guess timezone from website domain when not specified
- **Customizable appearance** - Choose your own highlight colors
- **Auto or manual timezone** - Use system timezone or select manually
- **Dark mode support** - Automatically adapts to your system theme

## 📦 Installation

### From Chrome Web Store (Recommended)
🔗 [**Install from Chrome Web Store**](https://chromewebstore.google.com/detail/timezone-converter/phpmfhmlfolhocoefklfafhipdopgdka?authuser=0&hl=pl)

The easiest way to install extension directly from the official store.

### From Firefox Add-ons
🦊 [**Install from Firefox Add-ons**](https://addons.mozilla.org/en-US/firefox/addon/timezone-converter/) *(Pending review)*

For Firefox users - available soon on Mozilla Add-ons marketplace.

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome/Brave and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the project folder

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

## 🔗 Download & Installation

### 🌐 Official Downloads
- **Chrome Web Store**: [https://chromewebstore.google.com/detail/timezone-converter/phpmfhmlfolhocoefklfafhipdopgdka](https://chromewebstore.google.com/detail/timezone-converter/phpmfhmlfolhocoefklfafhipdopgdka?authuser=0&hl=pl)
- **Firefox Add-ons**: [https://addons.mozilla.org/en-US/firefox/addon/timezone-converter/](https://addons.mozilla.org/en-US/firefox/addon/timezone-converter/) *(Pending review)*

### 📦 Direct Installation

#### Chrome/Brave/Edge
1. Visit Chrome Web Store link above
2. Click "Add to Chrome" 
3. Grant necessary permissions
4. Extension will be automatically installed and activated

#### Firefox
1. Visit Firefox Add-ons link above *(when available)*
2. Click "Add to Firefox"
3. Grant necessary permissions
4. Extension will be automatically installed and activated

### 🛠️ Developer Installation
For developers who want to modify or contribute:
1. Clone this repository: `git clone https://github.com/dZarkX/TimeConvert.git`
2. Open Chrome/Brave and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the project folder

## 🦊 Firefox / AMO Packaging

This repository includes a Firefox (AMO) packaging flow:

- `manifest-firefox.json` (Manifest V2)
- `src/scripts/background-firefox.js` (Firefox-specific background implementation)
- `tools/build-firefox.js` (packaging script)

Build the Firefox ZIP package:

1. Install dependencies: `npm install`
2. Build package: `npm run pack-firefox`

This creates: `TimeConvert-Firefox.zip`

## 🐛 Known Issues

- Times without timezone information are not detected (by design)
- Some ambiguous timezone abbreviations (like IST - India/Ireland/Israel) default to one interpretation

## 📝 Changelog

### v2.0 (v2-redesign branch)
- **NEW**: Material 2 / Material Design 3 UI redesign for popup and settings page
- **IMPROVED**: Popup and settings use elevation, outlined controls, and consistent Material tokens (light/dark)
- **IMPROVED**: Restore defaults button moved above Privacy section as a plain inline button (no sticky footer)

### v2.0.2 (Current)
- **FIXED**: Text-only highlight rendering no longer looks broken (removes pill/hover artifacts when background is transparent)
- **FIXED**: Missing Polish translations for highlight toggles in settings

### v1.5.1
- **NEW**: Natural Language Processing (NLP) - Detects time expressions like "in 2 hours", "tomorrow at noon", "end of day"
- **NEW**: Context Timezone Detection - Guesses timezone from website domain when not specified
- **NEW**: Experimental Features section in settings with toggles for NLP and Context Timezone
- **IMPROVED**: Reorganized settings UI with better section ordering
- **FIXED**: Syntax error in content.js that caused extension to fail loading
- **FIXED**: UTF-8 encoding issues in translation files

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
