/**
 * Firebase — Auth, Firestore, Storage, App Check.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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

function hasPatracLocalSession() {
    try {
        var session = localStorage.getItem('patrac_session');
        if (!session) return false;
        var accounts = JSON.parse(localStorage.getItem('patrac_accounts') || '{}');
        var acc = accounts[session];
        return !!(acc && acc.pass);
    } catch (e) {
        return false;
    }
}

function waitForInitialAuth(auth, maxMs) {
    maxMs = maxMs || 2500;
    return new Promise(function(resolve) {
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }
        var done = false;
        var timer = setTimeout(function() {
            if (done) return;
            done = true;
            unsub();
            resolve(auth.currentUser || null);
        }, maxMs);
        var unsub = onAuthStateChanged(auth, function(user) {
            if (done) return;
            if (user) {
                done = true;
                clearTimeout(timer);
                unsub();
                resolve(user);
            }
        });
    });
}

export function ensureFirebaseAuth() {
    if (!authReadyPromise) {
        authReadyPromise = (async function() {
            var auth = getAuth(app);
            await waitForInitialAuth(auth, hasPatracLocalSession() ? 4000 : 2000);

            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                return auth.currentUser;
            }

            if (hasPatracLocalSession()) {
                try {
                    var mod = await import('../services/authService.js');
                    var restored = await mod.restorePatracSessionFromLocal(localStorage.getItem('patrac_session'));
                    if (restored && !restored.isAnonymous) {
                        return restored;
                    }
                } catch (err) {
                    console.warn('[firebase] patrac session restore', err);
                }
            }

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

export function resetAuthReadyPromise() {
    authReadyPromise = null;
}

export function resetAnonymousAuthPromise() {
    resetAuthReadyPromise();
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
