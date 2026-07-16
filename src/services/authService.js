/**
 * Firebase Auth pro PÁTRAČ — syntetický e-mail z patrac userId, mapování uid ↔ userId.
 */
import {
    signInAnonymously,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updatePassword,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getDb, getFirebaseAuth, resetAnonymousAuthPromise } from '../lib/firebase.js';

const PATRAC_IDS_COLLECTION = 'patrac_ids';
const USERS_COLLECTION = 'users';

export function normalizePatracUserId(raw) {
    return String(raw || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/^\.+|\.+$/g, '');
}

/** Technický e-mail pro Firebase — není tvoje schránka. */
export function patracIdToLoginEmail(userId) {
    var safe = normalizePatracUserId(userId).replace(/[^a-z0-9]/g, '');
    if (!safe) safe = 'operativec';
    return 'patrac_' + safe + '@example.com';
}

function getAuthInstance() {
    return getFirebaseAuth();
}

async function signOutAnonymousIfNeeded() {
    var auth = getAuthInstance();
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        resetAnonymousAuthPromise();
    }
}

async function signInWithKnownEmail(loginEmail, password) {
    var auth = getAuthInstance();
    await signOutAnonymousIfNeeded();
    return signInWithEmailAndPassword(auth, loginEmail, password);
}

async function createPatracAuthUser(userId, password) {
    var auth = getAuthInstance();
    await signOutAnonymousIfNeeded();
    var loginEmail = patracIdToLoginEmail(userId);
    try {
        return await createUserWithEmailAndPassword(auth, loginEmail, password);
    } catch (createErr) {
        if (createErr && createErr.code === 'auth/email-already-in-use') {
            return signInWithEmailAndPassword(auth, loginEmail, password);
        }
        if (createErr && createErr.code === 'auth/weak-password') {
            throw Object.assign(
                new Error('Firebase vyžaduje heslo alespoň 6 znaků. Použij „Obnova hesla“ a nastav delší heslo.'),
                { code: 'auth/weak-password' }
            );
        }
        if (createErr && createErr.code === 'auth/invalid-email') {
            throw Object.assign(
                new Error('Chyba technického e-mailu pro Firebase. Kontaktuj správce.'),
                { code: 'auth/invalid-email' }
            );
        }
        throw createErr;
    }
}

export function getCurrentFirebaseUid() {
    var user = getAuthInstance().currentUser;
    return user && !user.isAnonymous ? user.uid : '';
}

export async function ensureAnonymousAuth() {
    var auth = getAuthInstance();
    if (auth.currentUser) return auth.currentUser;
    var cred = await signInAnonymously(auth);
    return cred.user;
}

export async function ensurePatracAuth() {
    var auth = getAuthInstance();
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
        return auth.currentUser;
    }
    throw new Error('Nejsi přihlášen — obnov stránku a přihlas se znovu.');
}

export async function savePatracIdMapping(userId, firebaseUid, loginEmail) {
    userId = normalizePatracUserId(userId);
    firebaseUid = String(firebaseUid || '').trim();
    if (!userId || !firebaseUid) return;

    var batch = {
        userId: userId,
        firebaseUid: firebaseUid,
        loginEmail: loginEmail || patracIdToLoginEmail(userId),
        updatedAt: Date.now()
    };

    await setDoc(doc(getDb(), PATRAC_IDS_COLLECTION, userId), batch, { merge: true });
    await setDoc(doc(getDb(), USERS_COLLECTION, firebaseUid), {
        patracUserId: userId,
        updatedAt: Date.now()
    }, { merge: true });
}

export async function fetchPatracIdMapping(userId) {
    userId = normalizePatracUserId(userId);
    if (!userId) return null;
    await ensureAnonymousAuth();
    var snap = await getDoc(doc(getDb(), PATRAC_IDS_COLLECTION, userId));
    if (!snap.exists()) return null;
    return snap.data();
}

async function fetchLegacyAccountFromCloud(userId) {
    userId = normalizePatracUserId(userId);
    await ensureAnonymousAuth();
    var snap = await getDoc(doc(getDb(), 'accounts', userId));
    if (!snap.exists()) return null;
    return snap.data();
}

function isLegacyAccount(acc) {
    return !!(acc && !acc.firebaseUid);
}

function verifyLegacyPassword(acc, password) {
    if (acc.pass && acc.pass !== password) {
        throw Object.assign(new Error('Špatné heslo.'), { code: 'auth/wrong-password' });
    }
    if (!acc.pass && !password) {
        throw Object.assign(new Error('Účet nemá heslo — použij obnovu hesla.'), { code: 'auth/wrong-password' });
    }
}

/**
 * Migrace účtu z původní verze (heslo ve Firestore) → Firebase Auth.
 */
async function upgradeLegacyAccountToFirebaseAuth(userId, password, acc) {
    userId = normalizePatracUserId(userId);
    if (!acc) {
        acc = await fetchLegacyAccountFromCloud(userId);
    }
    if (!acc) {
        throw Object.assign(new Error('Neznámé ID operativce.'), { code: 'auth/user-not-found' });
    }
    if (acc.firebaseUid) {
        var mapping = await fetchPatracIdMapping(userId);
        var loginEmail = (mapping && mapping.loginEmail) || patracIdToLoginEmail(userId);
        var cred = await signInWithKnownEmail(loginEmail, password);
        await savePatracIdMapping(userId, cred.user.uid, loginEmail);
        return cred.user;
    }

    verifyLegacyPassword(acc, password);

    var loginEmail = patracIdToLoginEmail(userId);
    var cred = await createPatracAuthUser(userId, password);
    await savePatracIdMapping(userId, cred.user.uid, loginEmail);

    var cleaned = Object.assign({}, acc, {
        firebaseUid: cred.user.uid,
        userId: userId,
        updatedAt: Date.now()
    });
    delete cleaned.pass;
    await setDoc(doc(getDb(), 'accounts', userId), cleaned, { merge: true });

    return cred.user;
}

export async function registerPatracAuth(userId, password) {
    userId = normalizePatracUserId(userId);
    if (!userId || !password) {
        throw new Error('Chybí ID nebo heslo.');
    }

    var cred = await createPatracAuthUser(userId, password);
    await savePatracIdMapping(userId, cred.user.uid, patracIdToLoginEmail(userId));
    return cred.user;
}

/**
 * @param {string} userId
 * @param {string} password
 * @param {object|null} localLegacyAcc — účet z localStorage (původní verze)
 */
export async function signInPatracAuth(userId, password, localLegacyAcc) {
    userId = normalizePatracUserId(userId);
    if (!userId || !password) {
        throw new Error('Chybí ID nebo heslo.');
    }

    var cloudAcc = null;
    try {
        cloudAcc = await fetchLegacyAccountFromCloud(userId);
    } catch (e) {
        console.warn('[auth] legacy account read', e);
    }

    var legacyAcc = cloudAcc || localLegacyAcc || null;

    if (isLegacyAccount(legacyAcc)) {
        return upgradeLegacyAccountToFirebaseAuth(userId, password, legacyAcc);
    }

    var mapping = await fetchPatracIdMapping(userId);
    var loginEmail = (mapping && mapping.loginEmail) || patracIdToLoginEmail(userId);
    try {
        var cred = await signInWithKnownEmail(loginEmail, password);
        await savePatracIdMapping(userId, cred.user.uid, loginEmail);
        return cred.user;
    } catch (err) {
        if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')) {
            return upgradeLegacyAccountToFirebaseAuth(userId, password, legacyAcc);
        }
        throw err;
    }
}

export async function recoverPatracPassword(userId, email, newPassword) {
    userId = normalizePatracUserId(userId);
    email = String(email || '').trim().toLowerCase();
    if (!userId || !email || !newPassword) {
        throw new Error('Vyplň ID, e-mail a nové heslo.');
    }
    if (newPassword.length < 6) {
        throw new Error('Nové heslo musí mít alespoň 6 znaků (požadavek Firebase).');
    }

    var acc = await fetchLegacyAccountFromCloud(userId);
    if (!acc) {
        throw new Error('Neznámé ID operativce.');
    }
    if ((acc.email || '').toLowerCase() !== email) {
        throw new Error('E-mail neodpovídá tomuto ID.');
    }

    await signOutAnonymousIfNeeded();
    await createPatracAuthUser(userId, newPassword);
    await savePatracIdMapping(userId, getAuthInstance().currentUser.uid, patracIdToLoginEmail(userId));

    var cleaned = Object.assign({}, acc, {
        email: email,
        firebaseUid: getCurrentFirebaseUid(),
        userId: userId,
        updatedAt: Date.now()
    });
    delete cleaned.pass;
    await setDoc(doc(getDb(), 'accounts', userId), cleaned, { merge: true });

    return true;
}

export async function signOutPatracAuth() {
    var auth = getAuthInstance();
    resetAnonymousAuthPromise();
    if (auth.currentUser) {
        await signOut(auth);
    }
}

export function waitForAuthState() {
    return new Promise(function(resolve) {
        var auth = getAuthInstance();
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }
        var unsub = onAuthStateChanged(auth, function(user) {
            unsub();
            resolve(user);
        });
    });
}
