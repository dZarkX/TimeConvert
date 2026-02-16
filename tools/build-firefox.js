#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function createFirefoxPackage() {
    console.log('🦊 Creating Firefox package...');
    
    // Create temporary directory
    const tempDir = path.join(__dirname, '..', 'firefox-temp');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Copy source files
    const sourceFiles = [
        'src',
        '_locales',
        'privacy-policy.html',
        'manifest-firefox.json'
    ];
    
    for (const file of sourceFiles) {
        const sourcePath = path.join(__dirname, '..', file);
        const destPath = path.join(tempDir, file);
        
        if (fs.statSync(sourcePath).isDirectory()) {
            copyDir(sourcePath, destPath);
        } else {
            fs.copyFileSync(sourcePath, destPath);
        }
    }
    
    // Rename manifest for Firefox
    fs.renameSync(
        path.join(tempDir, 'manifest-firefox.json'),
        path.join(tempDir, 'manifest.json')
    );
    
    // Copy Firefox-specific background script
    fs.copyFileSync(
        path.join(__dirname, '..', 'src', 'scripts', 'background-firefox.js'),
        path.join(tempDir, 'src', 'scripts', 'background.js')
    );
    
    // Create zip package
    const output = fs.createWriteStream(path.join(__dirname, '..', 'TimeConvert-Firefox.zip'));
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    archive.directory(tempDir, false);
    archive.finalize();
    
    output.on('close', () => {
        console.log('✅ Firefox package created: TimeConvert-Firefox.zip');
        console.log(`📦 Package size: ${archive.pointer()} bytes`);
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true });
        console.log('🧹 Temporary files cleaned up');
    });
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    
    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

createFirefoxPackage().catch(console.error);
