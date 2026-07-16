/**
 * Účty ve Firestore — veřejná metadata bez hesla (heslo řeší Firebase Auth).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { ensurePatracAuth, getCurrentFirebaseUid } from './authService.js';

const COLLECTION = 'accounts';

function stripSensitiveFields(account) {
    if (!account || typeof account !== 'object') return {};
    var payload = Object.assign({}, account);
    delete payload.pass;
    delete payload.password;
    return payload;
}

export function sanitizeAccountForCloud(userId, account) {
    var payload = stripSensitiveFields(account);
    payload.userId = String(userId || '').trim();
    var uid = getCurrentFirebaseUid();
    if (uid) payload.firebaseUid = uid;
    return payload;
}

export async function saveAccountToCloud(userId, account) {
    userId = String(userId || '').trim();
    if (!userId || !account) return;
    await ensurePatracAuth();
    var payload = sanitizeAccountForCloud(userId, account);
    payload.updatedAt = Date.now();
    await setDoc(doc(getDb(), COLLECTION, userId), payload, { merge: true });
}

export async function fetchAccountFromCloud(userId) {
    userId = String(userId || '').trim();
    if (!userId) return null;
    var mod = await import('./authService.js');
    await mod.ensureAnonymousAuth();
    var snap = await getDoc(doc(getDb(), COLLECTION, userId));
    if (!snap.exists()) return null;
    var data = snap.data();
    delete data.updatedAt;
    delete data.pass;
    delete data.password;
    return data;
}

export async function fetchAccountByEmail(email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) return null;
    return null;
}
