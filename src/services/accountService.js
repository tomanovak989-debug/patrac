/**
 * Účty ve Firestore — přihlášení ze stejného ID na jiném zařízení.
 * (Heslo je uloženo stejně jako lokálně — v produkci použij Firebase Auth.)
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const COLLECTION = 'accounts';

export async function saveAccountToCloud(userId, account) {
    userId = String(userId || '').trim();
    if (!userId || !account) return;
    var payload = Object.assign({}, account, {
        userId: userId,
        updatedAt: Date.now()
    });
    await setDoc(doc(db, COLLECTION, userId), payload, { merge: true });
}

export async function fetchAccountFromCloud(userId) {
    userId = String(userId || '').trim();
    if (!userId) return null;
    var snap = await getDoc(doc(db, COLLECTION, userId));
    if (!snap.exists()) return null;
    var data = snap.data();
    delete data.updatedAt;
    return data;
}
