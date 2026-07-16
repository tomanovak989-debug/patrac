/**
 * Profily hráčů ve Firestore — popis, avatar URL, osobní inventář, wear loadout.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, ensureFirebaseAuth } from '../lib/firebase.js';

const COLLECTION = 'players';

function normalizeUserId(userId) {
    return String(userId || '').trim();
}

export async function savePlayerToCloud(userId, payload) {
    userId = normalizeUserId(userId);
    if (!userId || !payload) return;
    await ensureFirebaseAuth();
    var data = Object.assign({}, payload, {
        userId: userId,
        updatedAt: Date.now()
    });
    await setDoc(doc(getDb(), COLLECTION, userId), data, { merge: true });
}

export async function fetchPlayerFromCloud(userId) {
    userId = normalizeUserId(userId);
    if (!userId) return null;
    await ensureFirebaseAuth();
    var snap = await getDoc(doc(getDb(), COLLECTION, userId));
    if (!snap.exists()) return null;
    return snap.data();
}

/**
 * Stáhne profil hráče do localStorage (cache).
 * @returns {Promise<{ ok: boolean }>}
 */
export async function hydratePlayerFromCloud(userId) {
    userId = normalizeUserId(userId);
    if (!userId) return { ok: false };

    var data = await fetchPlayerFromCloud(userId);
    if (!data) return { ok: false };

    if (typeof data.desc === 'string') {
        var desc = data.desc.trim().slice(0, 500);
        if (desc) {
            localStorage.setItem('patrac_desc_' + userId, desc);
            if (localStorage.getItem('patrac_session') === userId) {
                localStorage.setItem('player_desc', desc);
            }
        }
    }

    if (data.avatarUrl && typeof data.avatarUrl === 'string') {
        localStorage.setItem('patrac_avatar_' + userId, data.avatarUrl);
        if (localStorage.getItem('patrac_session') === userId) {
            localStorage.setItem('player_avatar', data.avatarUrl);
        }
    }

    if (Array.isArray(data.inventory)) {
        localStorage.setItem('patrac_items_personal_' + userId, JSON.stringify(data.inventory));
        if (localStorage.getItem('patrac_session') === userId) {
            try {
                localStorage.setItem('items_personal', JSON.stringify(data.inventory));
            } catch (e) {
                console.warn('[playerService] items_personal cache', e);
            }
        }
    }

    if (Array.isArray(data.wear)) {
        localStorage.setItem('patrac_wear_' + userId, JSON.stringify(data.wear));
    }

    return { ok: true };
}

/**
 * Sestaví payload z localStorage a uloží do cloudu.
 */
export async function syncPlayerFromLocalStorage(userId) {
    userId = normalizeUserId(userId);
    if (!userId) return;

    var payload = {
        desc: localStorage.getItem('patrac_desc_' + userId) || '',
        avatarUrl: null,
        inventory: [],
        wear: [],
        playerName: ''
    };

    try {
        var accounts = JSON.parse(localStorage.getItem('patrac_accounts') || '{}');
        if (accounts[userId] && accounts[userId].playerName) {
            payload.playerName = accounts[userId].playerName;
        }
    } catch (e) {}

    var avatarRaw = localStorage.getItem('patrac_avatar_' + userId) || '';
    if (/^https?:\/\//.test(avatarRaw)) {
        payload.avatarUrl = avatarRaw;
    }

    try {
        var invRaw = localStorage.getItem('patrac_items_personal_' + userId);
        if (invRaw) payload.inventory = JSON.parse(invRaw);
    } catch (e) {
        payload.inventory = [];
    }

    try {
        var wearRaw = localStorage.getItem('patrac_wear_' + userId);
        if (wearRaw) payload.wear = JSON.parse(wearRaw);
    } catch (e) {
        payload.wear = [];
    }

    if (!Array.isArray(payload.inventory)) payload.inventory = [];
    if (!Array.isArray(payload.wear)) payload.wear = [];

    await savePlayerToCloud(userId, payload);
}

export async function syncPlayerAvatarUrl(userId, avatarUrl) {
    userId = normalizeUserId(userId);
    if (!userId || !avatarUrl) return;
    await savePlayerToCloud(userId, { avatarUrl: avatarUrl });
}

export async function syncPlayerDesc(userId, desc) {
    userId = normalizeUserId(userId);
    if (!userId) return;
    await savePlayerToCloud(userId, { desc: (desc || '').trim().slice(0, 500) });
}

export async function syncPlayerInventory(userId, items) {
    userId = normalizeUserId(userId);
    if (!userId) return;
    await savePlayerToCloud(userId, {
        inventory: Array.isArray(items) ? items : []
    });
}

export async function syncPlayerWear(userId, wear) {
    userId = normalizeUserId(userId);
    if (!userId) return;
    await savePlayerToCloud(userId, {
        wear: Array.isArray(wear) ? wear : []
    });
}

export function normalizePublicProfile(data) {
    if (!data) {
        return { desc: '', avatarUrl: '', wear: [], playerName: '' };
    }
    return {
        desc: typeof data.desc === 'string' ? data.desc.trim().slice(0, 500) : '',
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
        wear: Array.isArray(data.wear) ? data.wear.slice() : [],
        playerName: typeof data.playerName === 'string' ? data.playerName.trim().slice(0, 80) : ''
    };
}

/**
 * Načte veřejné profily více hráčů (popis, avatar, wear) pro zobrazení v komunitě.
 * @param {string[]} userIds
 * @returns {Promise<Record<string, { desc: string, avatarUrl: string, wear: unknown[] }>>}
 */
export async function fetchPlayersPublicProfiles(userIds) {
    var ids = [];
    var seen = {};
    for (var i = 0; i < (userIds || []).length; i++) {
        var uid = normalizeUserId(userIds[i]);
        if (!uid || seen[uid]) continue;
        seen[uid] = true;
        ids.push(uid);
    }
    if (!ids.length) return {};

    await ensureFirebaseAuth();
    var out = {};
    await Promise.all(ids.map(function(uid) {
        return fetchPlayerFromCloud(uid).then(function(data) {
            out[uid] = normalizePublicProfile(data);
        }).catch(function(err) {
            console.warn('[playerService] fetch profile', uid, err);
            out[uid] = normalizePublicProfile(null);
        });
    }));
    return out;
}

/**
 * Uloží cizí profil do localStorage cache (avatar, popis, wear) pro zobrazení ostatním.
 */
export function cacheMemberProfileLocally(userId, profile) {
    userId = normalizeUserId(userId);
    if (!userId || !profile) return;

    if (profile.desc) {
        localStorage.setItem('patrac_desc_' + userId, profile.desc);
    } else {
        try { localStorage.removeItem('patrac_desc_' + userId); } catch (e) {}
    }

    if (profile.avatarUrl) {
        localStorage.setItem('patrac_avatar_' + userId, profile.avatarUrl);
    }

    if (Array.isArray(profile.wear)) {
        localStorage.setItem('patrac_wear_' + userId, JSON.stringify(profile.wear));
    }

    if (profile.playerName) {
        localStorage.setItem('patrac_member_name_' + userId, profile.playerName);
    }
}
