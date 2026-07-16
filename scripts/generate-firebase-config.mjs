/**
 * Načte .env.local a vygeneruje src/lib/firebase.config.js pro ES moduly v prohlížeči.
 * Spuštění: npm run env:firebase
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');
const outPath = join(root, 'src', 'lib', 'firebase.config.js');

const KEYS = [
    ['NEXT_PUBLIC_FIREBASE_API_KEY', 'apiKey'],
    ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'authDomain'],
    ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'projectId'],
    ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'storageBucket'],
    ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId'],
    ['NEXT_PUBLIC_FIREBASE_APP_ID', 'appId'],
    ['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', 'measurementId'],
    ['NEXT_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY', 'appCheckRecaptchaSiteKey']
];

if (!existsSync(envPath)) {
    console.error('Chybí .env.local — zkopíruj .env.example a doplň Firebase klíče.');
    process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    env[key] = val;
}

const config = {};
for (const [envKey, configKey] of KEYS) {
    const val = env[envKey];
    if (!val) {
        if (configKey === 'appCheckRecaptchaSiteKey' || configKey === 'measurementId') {
            continue;
        }
        console.error('V .env.local chybí:', envKey);
        process.exit(1);
    }
    config[configKey] = val;
}

const content = `/** Auto-generováno z .env.local — nespouštěj ruční editaci. */\nexport const firebaseConfig = ${JSON.stringify(config, null, 4)};\n`;

writeFileSync(outPath, content, 'utf8');
console.log('OK:', outPath);
