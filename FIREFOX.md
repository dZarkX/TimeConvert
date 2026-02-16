# 🦊 Firefox Add-ons Build Script

## Package for Firefox
This script creates a Firefox-compatible package using the Firefox manifest.

## Installation Instructions for Firefox
1. Download the Firefox package from releases
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the downloaded .zip file
6. Extension will be installed and activated

## Publishing to Firefox Add-ons
1. Go to https://addons.mozilla.org/developers/
2. Submit new extension
3. Upload the Firefox package
4. Fill in required information
5. Submit for review

## Differences from Chrome version
- Uses manifest v2 instead of v3
- Different permissions structure
- Firefox-specific applications.gecko section
- Different background script loading method
