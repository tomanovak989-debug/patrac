/**
 * Firebase Auth pro PÁTRAČ — přihlášení přes registrační e-mail + mapování uid ↔ userId.
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

function isValidAuthEmail(email) {
    email = String(email || '').trim().toLowerCase();
    return email.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Staré syntetické e-maily — Firebase je odmítá (invalid-email). */
function isSyntheticLoginEmail(email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) return true;
    return email.endsWith('@example.com')
        || email.endsWith('@patrac-auth.invalid')
        || email.indexOf('@patrac-auth.') !== -1
        || email.endsWith('.firebaseapp.com');
}

/** Záložní technický e-mail — jen nouzově, preferuj registrační e-mail. */
export function patracIdToLoginEmail(userId) {
    var safe = normalizePatracUserId(userId).replace(/[^a-z0-9]/g, '');
    if (!safe) safe = 'operativec';
    return safe + '@users.noreply.github.com';
}

function resolveLoginEmail(userId, acc, mapping) {
    if (mapping && mapping.registrationEmail && isValidAuthEmail(mapping.registrationEmail)) {
        return String(mapping.registrationEmail).trim().toLowerCase();
    }
    if (acc && acc.email && isValidAuthEmail(acc.email)) {
        return String(acc.email).trim().toLowerCase();
    }
    if (mapping && mapping.loginEmail && isValidAuthEmail(mapping.loginEmail) && !isSyntheticLoginEmail(mapping.loginEmail)) {
        return String(mapping.loginEmail).trim().toLowerCase();
    }
    return patracIdToLoginEmail(userId);
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

async function createPatracAuthUser(userId, password, preferredEmail) {
    var auth = getAuthInstance();
    await signOutAnonymousIfNeeded();
    var loginEmail = String(preferredEmail || '').trim().toLowerCase();
    if (!isValidAuthEmail(loginEmail) || isSyntheticLoginEmail(loginEmail)) {
        throw new Error('Účet vyžaduje platný registrační e-mail — použij obnovu hesla.');
    }
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
        throw createErr;
    }
}

async function createOrResetAuthUser(loginEmail, newPassword, legacyPassword) {
    var auth = getAuthInstance();
    await signOutAnonymousIfNeeded();
    loginEmail = String(loginEmail || '').trim().toLowerCase();
    if (!isValidAuthEmail(loginEmail)) {
        throw Object.assign(new Error('Neplatný registrační e-mail.'), { code: 'auth/invalid-email' });
    }
    try {
        return await createUserWithEmailAndPassword(auth, loginEmail, newPassword);
    } catch (createErr) {
        if (createErr && createErr.code === 'auth/email-already-in-use') {
            if (legacyPassword) {
                var signed = await signInWithEmailAndPassword(auth, loginEmail, legacyPassword);
                await updatePassword(signed.user, newPassword);
                return signed;
            }
            throw Object.assign(
                new Error('Účet ve Firebase už existuje — zkus se přihlásit starým heslem, nebo kontaktuj správce.'),
                { code: 'auth/email-already-in-use' }
            );
        }
        if (createErr && createErr.code === 'auth/weak-password') {
            throw Object.assign(
                new Error('Nové heslo musí mít alespoň 6 znaků (požadavek Firebase).'),
                { code: 'auth/weak-password' }
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

export async function savePatracIdMapping(userId, firebaseUid, loginEmail, registrationEmail) {
    userId = normalizePatracUserId(userId);
    firebaseUid = String(firebaseUid || '').trim();
    if (!userId || !firebaseUid) return;

    loginEmail = String(loginEmail || '').trim().toLowerCase();
    registrationEmail = String(registrationEmail || loginEmail || '').trim().toLowerCase();
    if (isSyntheticLoginEmail(registrationEmail) && isValidAuthEmail(loginEmail) && !isSyntheticLoginEmail(loginEmail)) {
        registrationEmail = loginEmail;
    }

    var batch = {
        userId: userId,
        firebaseUid: firebaseUid,
        loginEmail: loginEmail || registrationEmail || patracIdToLoginEmail(userId),
        registrationEmail: registrationEmail || '',
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

    var mapping = await fetchPatracIdMapping(userId);
    var loginEmail = resolveLoginEmail(userId, acc, mapping);

    if (acc.firebaseUid) {
        var cred = await signInWithKnownEmail(loginEmail, password);
        await savePatracIdMapping(userId, cred.user.uid, loginEmail, acc.email);
        return cred.user;
    }

    verifyLegacyPassword(acc, password);

    var cred = await createPatracAuthUser(userId, password, acc.email);
    loginEmail = resolveLoginEmail(userId, acc, null);
    if (cred.user.email) loginEmail = cred.user.email.toLowerCase();
    await savePatracIdMapping(userId, cred.user.uid, loginEmail, acc.email);

    var cleaned = Object.assign({}, acc, {
        firebaseUid: cred.user.uid,
        userId: userId,
        updatedAt: Date.now()
    });
    delete cleaned.pass;
    await setDoc(doc(getDb(), 'accounts', userId), cleaned, { merge: true });

    return cred.user;
}

export async function registerPatracAuth(userId, password, email) {
    userId = normalizePatracUserId(userId);
    email = String(email || '').trim().toLowerCase();
    if (!userId || !password) {
        throw new Error('Chybí ID nebo heslo.');
    }
    if (!isValidAuthEmail(email)) {
        throw new Error('Zadej platný registrační e-mail.');
    }
    if (password.length < 6) {
        throw new Error('Heslo musí mít alespoň 6 znaků (požadavek Firebase).');
    }

    var cred = await createPatracAuthUser(userId, password, email);
    await savePatracIdMapping(userId, cred.user.uid, email, email);
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
    var loginEmail = resolveLoginEmail(userId, legacyAcc, mapping);
    try {
        var cred = await signInWithKnownEmail(loginEmail, password);
        await savePatracIdMapping(userId, cred.user.uid, loginEmail, legacyAcc && legacyAcc.email ? legacyAcc.email : '');
        return cred.user;
    } catch (err) {
        if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')) {
            return upgradeLegacyAccountToFirebaseAuth(userId, password, legacyAcc);
        }
        throw err;
    }
}

/**
 * @param {object|null} localLegacyAcc — účet z localStorage, pokud cloud read selže
 */
export async function recoverPatracPassword(userId, email, newPassword, localLegacyAcc) {
    userId = normalizePatracUserId(userId);
    email = String(email || '').trim().toLowerCase();
    if (!userId || !email || !newPassword) {
        throw new Error('Vyplň ID, e-mail a nové heslo.');
    }
    if (!isValidAuthEmail(email)) {
        throw new Error('Zadej platný registrační e-mail.');
    }
    if (newPassword.length < 6) {
        throw new Error('Nové heslo musí mít alespoň 6 znaků (požadavek Firebase).');
    }

    var acc = null;
    try {
        acc = await fetchLegacyAccountFromCloud(userId);
    } catch (e) {
        console.warn('[auth] recover account read', e);
    }
    if (!acc && localLegacyAcc) {
        acc = localLegacyAcc;
    }
    if (!acc) {
        var mappingForVerify = null;
        try {
            mappingForVerify = await fetchPatracIdMapping(userId);
        } catch (mapErr) {
            console.warn('[auth] recover mapping read', mapErr);
        }
        if (mappingForVerify && (mappingForVerify.registrationEmail || '').toLowerCase() === email) {
            acc = { email: email, pass: localLegacyAcc && localLegacyAcc.pass ? localLegacyAcc.pass : '' };
        }
    }
    if (!acc) {
        throw new Error('Neznámé ID operativce — zkus se přihlásit na stejném zařízení, kde jsi se registroval.');
    }
    if ((acc.email || '').toLowerCase() !== email) {
        throw new Error('E-mail neodpovídá tomuto ID.');
    }

    var legacyPass = acc.pass || '';
    var cred = await createOrResetAuthUser(email, newPassword, legacyPass);

    await savePatracIdMapping(userId, cred.user.uid, email, email);

    var cleaned = Object.assign({}, acc, {
        email: email,
        firebaseUid: cred.user.uid,
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
