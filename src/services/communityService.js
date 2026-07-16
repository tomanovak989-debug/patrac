/**
 * Komunity a společný inventář ve Firestore — první krok k více uživatelům.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';

const COLLECTION = 'communities';

function normalizeComCode(comCode) {
    return String(comCode || '').trim().toUpperCase();
}

export async function saveCommunityToCloud(comCode, community) {
    comCode = normalizeComCode(comCode);
    if (!comCode || !community) return;
    var payload = {
        name: community.name || '',
        code: comCode,
        founder: community.founder || '',
        members: Array.isArray(community.members) ? community.members.slice() : [],
        createdAt: community.createdAt || new Date().toISOString(),
        updatedAt: Date.now()
    };
    await setDoc(doc(getDb(), COLLECTION, comCode), payload, { merge: true });
}

export async function saveCommunityInventory(comCode, items) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return;
    await setDoc(doc(getDb(), COLLECTION, comCode), {
        inventory: Array.isArray(items) ? items : [],
        inventoryUpdatedAt: Date.now(),
        updatedAt: Date.now()
    }, { merge: true });
}

export async function fetchCommunityMeta(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return null;
    var snap = await getDoc(doc(getDb(), COLLECTION, comCode));
    if (!snap.exists()) return null;
    var data = snap.data();
    return {
        name: data.name || '',
        code: comCode,
        founder: data.founder || '',
        members: Array.isArray(data.members) ? data.members.slice() : [],
        createdAt: data.createdAt || null
    };
}

/**
 * Stáhne metadata komunity a inventář do localStorage (cache).
 * @returns {Promise<{ ok: boolean, inventory?: unknown[] }>}
 */
export async function hydrateCommunityFromCloud(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return { ok: false };

    var snap = await getDoc(doc(getDb(), COLLECTION, comCode));
    if (!snap.exists()) return { ok: false };

    var data = snap.data();
    var comms = {};
    try {
        comms = JSON.parse(localStorage.getItem('patrac_communities') || '{}');
    } catch (e) {
        comms = {};
    }

    var existing = comms[comCode] || {};
    comms[comCode] = {
        name: data.name || existing.name || '',
        code: comCode,
        founder: data.founder || existing.founder || '',
        members: Array.isArray(data.members) && data.members.length
            ? data.members.slice()
            : (existing.members || []),
        createdAt: data.createdAt || existing.createdAt || new Date().toISOString()
    };
    localStorage.setItem('patrac_communities', JSON.stringify(comms));

    if (Array.isArray(data.inventory)) {
        var invKey = 'patrac_items_community_' + comCode;
        localStorage.setItem(invKey, JSON.stringify(data.inventory));
        localStorage.setItem('items_community', JSON.stringify(data.inventory));
    }

    return { ok: true, inventory: data.inventory || null };
}
