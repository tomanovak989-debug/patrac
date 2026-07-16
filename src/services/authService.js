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
import { firebaseConfig } from '../lib/firebase.config.js';

const PATRAC_IDS_COLLECTION = 'patrac_ids';
const USERS_COLLECTION = 'users';

function authEmailDomain() {
    var projectId = firebaseConfig.projectId || 'patrac-app';
    return projectId + '.firebaseapp.com';
}

function sanitizeEmailLocalPart(userId) {
    userId = String(userId || '').trim().toLowerCase();
    var safe = userId
        .replace(/[^a-z0-9._-]/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '')
        .replace(/_{2,}/g, '_');
    if (!safe) safe = 'operativec';
    return 'patrac.' + safe;
}

export function patracIdToLoginEmail(userId) {
    return sanitizeEmailLocalPart(userId) + '@' + authEmailDomain();
}

/** Starší formát — pro zpětnou kompatibilitu po migraci. */
export function patracIdToLegacyLoginEmail(userId) {
    userId = String(userId || '').trim().toLowerCase();
    var safe = userId.replace(/[^a-z0-9._-]/g, '_').replace(/^[._-]+|[._-]+$/g, '');
    if (!safe) safe = 'operativec';
    return safe + '@patrac-auth.invalid';
}

function getAuthInstance() {
    return getFirebaseAuth();
}

async function signInWithPatracEmail(userId, password) {
    var auth = getAuthInstance();
    var emails = [patracIdToLoginEmail(userId), patracIdToLegacyLoginEmail(userId)];
    var seen = {};
    var lastErr = null;
    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        if (seen[email]) continue;
        seen[email] = true;
        try {
            return await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            lastErr = err;
            if (err && err.code === 'auth/invalid-email') continue;
            if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')) {
                continue;
            }
            throw err;
        }
    }
    throw lastErr || new Error('Přihlášení selhalo.');
}

export function getCurrentFirebaseUid() {
    var user = getAuthInstance().currentUser;
    return user && !user.isAnonymous ? user.uid : '';
}

/**
 * Anonymní session pro veřejné čtení (ověření kódu komunity před registrací).
 */
export async function ensureAnonymousAuth() {
    var auth = getAuthInstance();
    if (auth.currentUser) return auth.currentUser;
    var cred = await signInAnonymously(auth);
    return cred.user;
}

/**
 * Vyžaduje přihlášeného pátrače (ne anonymního).
 */
export async function ensurePatracAuth() {
    var auth = getAuthInstance();
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
        return auth.currentUser;
    }
    throw new Error('Nejsi přihlášen — obnov stránku a přihlas se znovu.');
}

export async function savePatracIdMapping(userId, firebaseUid, loginEmail) {
    userId = String(userId || '').trim().toLowerCase();
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
    userId = String(userId || '').trim().toLowerCase();
    if (!userId) return null;
    await ensureAnonymousAuth();
    var snap = await getDoc(doc(getDb(), PATRAC_IDS_COLLECTION, userId));
    if (!snap.exists()) return null;
    return snap.data();
}

export async function registerPatracAuth(userId, password) {
    userId = String(userId || '').trim().toLowerCase();
    if (!userId || !password) {
        throw new Error('Chybí ID nebo heslo.');
    }

    var auth = getAuthInstance();
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        resetAnonymousAuthPromise();
    }

    var loginEmail = patracIdToLoginEmail(userId);
    var cred = await createUserWithEmailAndPassword(auth, loginEmail, password);
    await savePatracIdMapping(userId, cred.user.uid, loginEmail);
    return cred.user;
}

export async function signInPatracAuth(userId, password) {
    userId = String(userId || '').trim().toLowerCase();
    if (!userId || !password) {
        throw new Error('Chybí ID nebo heslo.');
    }

    var auth = getAuthInstance();
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        resetAnonymousAuthPromise();
    }

    var loginEmail = patracIdToLoginEmail(userId);
    try {
        var cred = await signInWithPatracEmail(userId, password);
        await savePatracIdMapping(userId, cred.user.uid, loginEmail);
        return cred.user;
    } catch (err) {
        var code = err && err.code ? err.code : '';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
            return upgradeLegacyAccountToFirebaseAuth(userId, password);
        }
        throw err;
    }
}

/**
 * Migrace starého účtu s heslem ve Firestore → Firebase Auth, heslo z cloudu smaže.
 */
async function upgradeLegacyAccountToFirebaseAuth(userId, password) {
    await ensureAnonymousAuth();
    var accSnap = await getDoc(doc(getDb(), 'accounts', userId));
    if (!accSnap.exists()) {
        throw Object.assign(new Error('Neznámé ID operativce.'), { code: 'auth/user-not-found' });
    }
    var acc = accSnap.data();
    if (acc.firebaseUid) {
        throw Object.assign(new Error('Špatné heslo.'), { code: 'auth/wrong-password' });
    }
    if (acc.pass && acc.pass !== password) {
        throw Object.assign(new Error('Špatné heslo.'), { code: 'auth/wrong-password' });
    }
    if (!acc.pass && !password) {
        throw Object.assign(new Error('Účet nemá heslo — zadej nové heslo v obnově.'), { code: 'auth/wrong-password' });
    }

    var auth = getAuthInstance();
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        resetAnonymousAuthPromise();
    }

    var loginEmail = patracIdToLoginEmail(userId);
    var cred;
    try {
        cred = await createUserWithEmailAndPassword(auth, loginEmail, password);
    } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
            cred = await signInWithEmailAndPassword(auth, loginEmail, password);
        } else {
            throw createErr;
        }
    }

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

export async function recoverPatracPassword(userId, email, newPassword) {
    userId = String(userId || '').trim().toLowerCase();
    email = String(email || '').trim().toLowerCase();
    if (!userId || !email || !newPassword) {
        throw new Error('Vyplň ID, e-mail a nové heslo.');
    }
    if (newPassword.length < 4) {
        throw new Error('Heslo musí mít alespoň 4 znaky.');
    }

    await ensureAnonymousAuth();
    var accSnap = await getDoc(doc(getDb(), 'accounts', userId));
    if (!accSnap.exists()) {
        throw new Error('Neznámé ID operativce.');
    }
    var acc = accSnap.data();
    if ((acc.email || '').toLowerCase() !== email) {
        throw new Error('E-mail neodpovídá tomuto ID.');
    }

    var auth = getAuthInstance();
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        resetAnonymousAuthPromise();
    }

    var loginEmail = patracIdToLoginEmail(userId);

    if (!acc.firebaseUid) {
        try {
            await createUserWithEmailAndPassword(auth, loginEmail, newPassword);
        } catch (createErr) {
            if (createErr.code === 'auth/email-already-in-use') {
                var cred = await signInWithEmailAndPassword(auth, loginEmail, acc.pass || newPassword);
                if (!acc.pass || acc.pass !== newPassword) {
                    await updatePassword(cred.user, newPassword);
                }
            } else {
                throw createErr;
            }
        }
        await savePatracIdMapping(userId, auth.currentUser.uid, loginEmail);
    } else {
        throw new Error('Účet už běží přes Firebase Auth. Přihlas se starým heslem a změň ho v profilu.');
    }

    var cleaned = Object.assign({}, acc, {
        email: email,
        firebaseUid: auth.currentUser ? auth.currentUser.uid : acc.firebaseUid,
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
