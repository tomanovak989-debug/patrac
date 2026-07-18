/**
 * Účty ve Firestore — veřejná metadata bez hesla (heslo řeší Firebase Auth).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, getFirebaseAuth } from '../lib/firebase.js';
import { ensurePatracAuth, ensureAnonymousAuth, getCurrentFirebaseUid, normalizePatracUserId } from './authService.js';

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
    userId = normalizePatracUserId(userId);
    if (!userId || !account) return;
    await ensurePatracAuth();
    var payload = sanitizeAccountForCloud(userId, account);
    payload.updatedAt = Date.now();
    await setDoc(doc(getDb(), COLLECTION, userId), payload, { merge: true });
}

function stripAccountPayload(data) {
    if (!data) return null;
    var payload = Object.assign({}, data);
    delete payload.updatedAt;
    delete payload.pass;
    delete payload.password;
    return payload;
}

export async function fetchAccountFromCloud(userId) {
    userId = normalizePatracUserId(userId);
    if (!userId) return null;

    var authUser = getFirebaseAuth().currentUser;
    if (authUser && !authUser.isAnonymous) {
        await ensurePatracAuth();
    } else {
        await ensureAnonymousAuth();
    }

    var docIds = [userId];
    if (docIds.indexOf(userId + '.') === -1) docIds.push(userId + '.');

    for (var i = 0; i < docIds.length; i++) {
        var snap = await getDoc(doc(getDb(), COLLECTION, docIds[i]));
        if (snap.exists()) return stripAccountPayload(snap.data());
    }
    return null;
}

export async function fetchAccountByEmail(email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) return null;
    return null;
}
