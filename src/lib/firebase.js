/**
 * Firebase — Auth, Firestore, Storage, App Check.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);

let dbInstance = null;
let storageInstance = null;
let authReadyPromise = null;
let appCheckInitialized = false;

function initAppCheckIfConfigured() {
    if (appCheckInitialized) return;
    appCheckInitialized = true;
    var siteKey = firebaseConfig.appCheckRecaptchaSiteKey || '';
    if (!siteKey) return;
    try {
        if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
        });
    } catch (err) {
        console.warn('[firebase] App Check init', err);
    }
}

initAppCheckIfConfigured();

export function ensureFirebaseAuth() {
    if (!authReadyPromise) {
        authReadyPromise = (async function() {
            var auth = getAuth(app);
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
            return auth.currentUser;
        })().catch(function(err) {
            authReadyPromise = null;
            console.error('[firebase] ensureFirebaseAuth:', err);
            throw err;
        });
    }
    return authReadyPromise;
}

export function resetAnonymousAuthPromise() {
    authReadyPromise = null;
}

export function getDb() {
    if (!dbInstance) {
        dbInstance = getFirestore(app);
    }
    return dbInstance;
}

export function getFirebaseStorage() {
    if (!storageInstance) {
        storageInstance = getStorage(app);
    }
    return storageInstance;
}

export function getFirebaseAuth() {
    return getAuth(app);
}

export { app };
