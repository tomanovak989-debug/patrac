/**
 * Firebase — Firestore + Storage (bez Analytics).
 * Služby se inicializují lazy, aby selhání jedné neblokovalo druhou.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);

let dbInstance = null;
let storageInstance = null;

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
