const webStore = require('chrome-webstore-upload').default;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function publish() {
    const {
        EXTENSION_ID,
        CLIENT_ID,
        CLIENT_SECRET,
        REFRESH_TOKEN
    } = process.env;

    if (!EXTENSION_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.error('Error: Brak wymaganych zmiennych środowiskowych w pliku .env.');
        console.log('Sprawdź MEMORY.MD po instrukcje konfiguracji.');
        process.exit(1);
    }

    const store = webStore({
        extensionId: EXTENSION_ID,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
    });

    const zipPath = path.join(__dirname, 'TimeConvert.zip');

    if (!fs.existsSync(zipPath)) {
        console.error(`Error: Plik ${zipPath} nie istnieje. Uruchom najpierw pakowanie.`);
        process.exit(1);
    }

    const myZipFile = fs.createReadStream(zipPath);

    try {
        console.log('Przesyłanie nowej wersji do Chrome Web Store...');
        // Metoda w nowej wersji biblioteki to uploadExisting
        const uploadRes = await store.uploadExisting(myZipFile);
        console.log('Upload result:', JSON.stringify(uploadRes, null, 2));

        if (uploadRes.uploadState === 'SUCCESS') {
            console.log('Publikowanie wersji (trusted testers/public)...');
            const publishRes = await store.publish();
            console.log('Publish result:', JSON.stringify(publishRes, null, 2));
            console.log('✅ Sukces! Rozszerzenie zostało wysłane do recenzji.');
        } else {
            console.error('❌ Błąd podczas przesyłania:', JSON.stringify(uploadRes.itemError, null, 2));
        }
    } catch (err) {
        console.error('❌ Wystąpił błąd:', err.message);
        if (err.response) {
            console.error('Szczegóły błędu z Google API:', JSON.stringify(err.response, null, 2));
        }
        process.exit(1);
    }
}

publish();
