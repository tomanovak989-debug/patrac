/**
 * Firebase — Firestore + Storage (bez Analytics).
 * Konfigurace z .env.local → npm run env:firebase → firebase.config.js
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);

/** Firestore databáze */
export const db = getFirestore(app);

/** Firebase Storage */
export const storage = getStorage(app);

export { app };
