/**
 * Cloud registry Pocta a fázovaných úkolů — sdílení kódů mezi zařízeními.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const COLLECTION = 'pocta_entities';

function normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
}

export async function savePoctaEntity(entity) {
    if (!entity || !entity.code) return;
    var code = normalizeCode(entity.code);
    var payload = Object.assign({}, entity, {
        code: code,
        updatedAt: Date.now()
    });
    await setDoc(doc(db, COLLECTION, code), payload, { merge: true });
}

export async function fetchPoctaEntityByCode(code) {
    code = normalizeCode(code);
    if (!code) return null;
    var snap = await getDoc(doc(db, COLLECTION, code));
    if (!snap.exists()) return null;
    return snap.data();
}
