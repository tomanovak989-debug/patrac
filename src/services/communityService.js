/**
 * Komunity a společný inventář ve Firestore — první krok k více uživatelům.
 */
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { getDb, ensureFirebaseAuth } from '../lib/firebase.js';
import { ensurePatracAuth } from './authService.js';

const COLLECTION = 'communities';

function normalizeComCode(comCode) {
    return String(comCode || '').trim().toUpperCase();
}

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
    await ensurePatracAuth();
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
    await ensurePatracAuth();
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

/** Všechny komunity z Firestore (pro operátorský výběr na novém zařízení). */
export async function fetchAllCommunitiesFromCloud() {
    await ensureFirebaseAuth();
    var snap = await getDocs(collection(getDb(), COLLECTION));
    var out = {};
    snap.forEach(function(docSnap) {
        var comCode = normalizeComCode(docSnap.id);
        if (!comCode) return;
        var data = docSnap.data() || {};
        out[comCode] = {
            name: data.name || '',
            code: comCode,
            founder: data.founder || '',
            members: Array.isArray(data.members) ? data.members.slice() : [],
            createdAt: data.createdAt || null
        };
    });
    return out;
}

/** Sloučí cloud seznam komunit s lokální cache. */
export async function hydrateAllCommunitiesFromCloud() {
    var cloud = await fetchAllCommunitiesFromCloud();
    var comms = {};
    try {
        comms = JSON.parse(localStorage.getItem('patrac_communities') || '{}');
    } catch (e) {
        comms = {};
    }
    for (var code in cloud) {
        if (!Object.prototype.hasOwnProperty.call(cloud, code)) continue;
        var existing = comms[code] || {};
        var cloudEntry = cloud[code];
        comms[code] = {
            name: cloudEntry.name || existing.name || '',
            code: code,
            founder: cloudEntry.founder || existing.founder || '',
            members: mergeUniqueMemberIds(cloudEntry.members, existing.members),
            createdAt: cloudEntry.createdAt || existing.createdAt || new Date().toISOString()
        };
    }
    localStorage.setItem('patrac_communities', JSON.stringify(comms));
    return comms;
}

/**
 * Stáhne metadata komunity a inventář do localStorage (cache).
 * @returns {Promise<{ ok: boolean, inventory?: unknown[] }>}
 */
export async function hydrateCommunityFromCloud(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return { ok: false };
    await ensurePatracAuth().catch(function() {
        return ensureFirebaseAuth();
    });

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
        try {
            await ensurePatracAuth();
            await setDoc(doc(getDb(), COLLECTION, comCode), {
                members: mergedMembers,
                updatedAt: Date.now()
            }, { merge: true });
        } catch (mergeErr) {
            console.warn('[communityService] member merge sync', comCode, mergeErr);
        }
    }

    if (Array.isArray(data.inventory)) {
        var invKey = 'patrac_items_community_' + comCode;
        localStorage.setItem(invKey, JSON.stringify(data.inventory));
        localStorage.setItem('items_community', JSON.stringify(data.inventory));
    }

    return { ok: true, inventory: data.inventory || null };
}
