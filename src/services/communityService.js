/**
 * Komunity a společný inventář ve Firestore — první krok k více uživatelům.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, ensureFirebaseAuth } from '../lib/firebase.js';

const COLLECTION = 'communities';

function mergeUniqueMemberIds() {
    var lists = Array.prototype.slice.call(arguments);
    var out = [];
    var seen = {};
    for (var l = 0; l < lists.length; l++) {
        var list = lists[l];
        if (!Array.isArray(list)) continue;
        for (var i = 0; i < list.length; i++) {
            var id = String(list[i] || '').trim();
            if (!id || seen[id]) continue;
            seen[id] = true;
            out.push(id);
        }
    }
    return out;
}

function membersChanged(before, after) {
    var a = mergeUniqueMemberIds(before);
    var b = mergeUniqueMemberIds(after);
    if (a.length !== b.length) return true;
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return true;
    }
    return false;
}

export async function saveCommunityToCloud(comCode, community) {
    comCode = normalizeComCode(comCode);
    if (!comCode || !community) return;
    await ensureFirebaseAuth();
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
    await ensureFirebaseAuth();
    await setDoc(doc(getDb(), COLLECTION, comCode), {
        inventory: Array.isArray(items) ? items : [],
        inventoryUpdatedAt: Date.now(),
        updatedAt: Date.now()
    }, { merge: true });
}

export async function fetchCommunityMeta(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return null;
    await ensureFirebaseAuth();
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
    await ensureFirebaseAuth();

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
    var cloudMembers = Array.isArray(data.members) ? data.members.slice() : [];
    var localMembers = Array.isArray(existing.members) ? existing.members.slice() : [];
    var mergedMembers = mergeUniqueMemberIds(cloudMembers, localMembers);

    comms[comCode] = {
        name: data.name || existing.name || '',
        code: comCode,
        founder: data.founder || existing.founder || '',
        members: mergedMembers,
        createdAt: data.createdAt || existing.createdAt || new Date().toISOString()
    };
    localStorage.setItem('patrac_communities', JSON.stringify(comms));

    if (membersChanged(cloudMembers, mergedMembers)) {
        await setDoc(doc(getDb(), COLLECTION, comCode), {
            members: mergedMembers,
            updatedAt: Date.now()
        }, { merge: true });
    }

    if (Array.isArray(data.inventory)) {
        var invKey = 'patrac_items_community_' + comCode;
        localStorage.setItem(invKey, JSON.stringify(data.inventory));
        localStorage.setItem('items_community', JSON.stringify(data.inventory));
    }

    return { ok: true, inventory: data.inventory || null };
}
