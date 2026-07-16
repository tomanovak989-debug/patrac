/**
 * Firebase — Auth, Firestore, Storage.
 * Anonymní přihlášení umožní uploady dle Storage/Firestore rules (request.auth != null).
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);

let dbInstance = null;
let storageInstance = null;
let authReadyPromise = null;

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

export { app };
