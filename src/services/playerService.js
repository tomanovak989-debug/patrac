/**
 * Profily hráčů ve Firestore — popis, avatar URL, osobní inventář, wear loadout.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, ensureFirebaseAuth } from '../lib/firebase.js';
import { ensurePatracAuth, getCurrentFirebaseUid, normalizePatracUserId } from './authService.js';

const COLLECTION = 'players';

function normalizeUserId(userId) {
    return normalizePatracUserId(userId);
}

export async function savePlayerToCloud(userId, payload) {
    userId = normalizeUserId(userId);
    if (!userId || !payload) return;
    await ensurePatracAuth();
    var data = Object.assign({}, payload, {
        userId: userId,
        firebaseUid: getCurrentFirebaseUid(),
        updatedAt: Date.now()
    });
    if (!data.comCode) {
        try {
            var accounts = JSON.parse(localStorage.getItem('patrac_accounts') || '{}');
            if (accounts[userId] && accounts[userId].comCode) {
                data.comCode = accounts[userId].comCode;
            }
        } catch (e) {}
    }
    await setDoc(doc(getDb(), COLLECTION, userId), data, { merge: true });
}

export async function fetchPlayerFromCloud(userId) {
    userId = normalizeUserId(userId);
    if (!userId) return null;
    await ensurePatracAuth();
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

    await ensurePatracAuth();
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
        localStorage.setItem('patrac_wear_' + userId, data.wear);
    }

    applyPlayerProgressFromCloud(userId, data);

    return { ok: true };
}

function getPatracProfileKey(userId) {
    return 'patrac_profile_' + userId;
}

function getTerminalStateKey(userId) {
    return 'patrac_terminal_' + userId;
}

/**
 * Aplikuje missions, quests a terminal stav z Firestore do localStorage.
 */
export function applyPlayerProgressFromCloud(userId, data) {
    userId = normalizeUserId(userId);
    if (!userId || !data) return;
    var isSession = localStorage.getItem('patrac_session') === userId;

    if (data.missions && typeof data.missions === 'object') {
        var missions = data.missions;
        try {
            var profileRaw = localStorage.getItem('player_profile');
            var profile = profileRaw ? JSON.parse(profileRaw) : {};
            profile.localMissions = missions.localMissions || 0;
            profile.globalMissions = missions.globalMissions != null ? missions.globalMissions : (missions.localMissions || 0);
            profile.localIssuerStats = missions.localIssuerStats || profile.localIssuerStats || {};
            profile.globalIssuerStats = missions.globalIssuerStats || profile.globalIssuerStats || {};
            if (Array.isArray(missions.missionLog)) profile.missionLog = missions.missionLog.slice();
            localStorage.setItem('player_profile', JSON.stringify(profile));
        } catch (e) {
            console.warn('[playerService] player_profile missions', e);
        }

        try {
            var storedRaw = localStorage.getItem(getPatracProfileKey(userId));
            var stored = storedRaw ? JSON.parse(storedRaw) : {};
            stored.localMissions = missions.localMissions || 0;
            stored.globalMissions = missions.globalMissions != null ? missions.globalMissions : (missions.localMissions || 0);
            stored.localIssuerStats = missions.localIssuerStats || stored.localIssuerStats || {};
            stored.globalIssuerStats = missions.globalIssuerStats || stored.globalIssuerStats || {};
            if (Array.isArray(missions.missionLog)) stored.missionLog = missions.missionLog.slice();
            if (Array.isArray(missions.missionLog)) stored.missionLog = missions.missionLog.slice();
            localStorage.setItem(getPatracProfileKey(userId), JSON.stringify(stored));
        } catch (e) {
            console.warn('[playerService] patrac_profile missions', e);
        }
    }

    if (Array.isArray(data.chronicle)) {
        try {
            var chronicle = data.chronicle.slice();
            var profileChronicleRaw = localStorage.getItem('player_profile');
            var profileChronicle = profileChronicleRaw ? JSON.parse(profileChronicleRaw) : {};
            profileChronicle.chronicle = chronicle;
            localStorage.setItem('player_profile', JSON.stringify(profileChronicle));
            var storedChronicleRaw = localStorage.getItem(getPatracProfileKey(userId));
            var storedChronicle = storedChronicleRaw ? JSON.parse(storedChronicleRaw) : {};
            storedChronicle.chronicle = chronicle;
            localStorage.setItem(getPatracProfileKey(userId), JSON.stringify(storedChronicle));
        } catch (e) {
            console.warn('[playerService] chronicle', e);
        }
    }

    if (data.quests && typeof data.quests === 'object') {
        var done = data.quests.done || {};
        for (var questId in done) {
            if (!Object.prototype.hasOwnProperty.call(done, questId)) continue;
            if (done[questId]) localStorage.setItem('quest_done_' + questId, 'true');
        }
        var unlocked = data.quests.unlocked || {};
        for (var unlockId in unlocked) {
            if (!Object.prototype.hasOwnProperty.call(unlocked, unlockId)) continue;
            if (unlocked[unlockId]) localStorage.setItem('unlocked_story_' + unlockId, 'true');
        }
        var missed = data.quests.missed || {};
        var missedKey = 'patrac_quest_missed_' + userId;
        try {
            localStorage.setItem(missedKey, JSON.stringify(missed));
        } catch (e) {
            console.warn('[playerService] quest missed cache', e);
        }
    }

    if (data.terminal && typeof data.terminal === 'object') {
        var terminal = {
            activatedCodes: Array.isArray(data.terminal.activatedCodes) ? data.terminal.activatedCodes.slice() : [],
            poctaInventoryIds: Array.isArray(data.terminal.poctaInventoryIds) ? data.terminal.poctaInventoryIds.slice() : []
        };
        localStorage.setItem(getTerminalStateKey(userId), JSON.stringify(terminal));
    }
}

export async function syncPlayerProgressToCloud(userId, progress) {
    userId = normalizeUserId(userId);
    if (!userId || !progress) return;
    await savePlayerToCloud(userId, progress);
}

export async function syncPlayerTerminal(userId, terminalState) {
    userId = normalizeUserId(userId);
    if (!userId) return;
    await savePlayerToCloud(userId, {
        terminal: {
            activatedCodes: Array.isArray(terminalState.activatedCodes) ? terminalState.activatedCodes.slice() : [],
            poctaInventoryIds: Array.isArray(terminalState.poctaInventoryIds) ? terminalState.poctaInventoryIds.slice() : [],
            updatedAt: Date.now()
        }
    });
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

    try {
        var profileRaw = localStorage.getItem(getPatracProfileKey(userId));
        if (profileRaw) {
            var profile = JSON.parse(profileRaw);
            payload.missions = {
                localMissions: profile.localMissions || 0,
                globalMissions: profile.globalMissions != null ? profile.globalMissions : (profile.localMissions || 0),
                localIssuerStats: profile.localIssuerStats || {},
                globalIssuerStats: profile.globalIssuerStats || {},
                missionLog: profile.missionLog || []
            };
            if (profile.questDone) {
                payload.quests = { done: profile.questDone, unlocked: {} };
            }
            if (Array.isArray(profile.chronicle)) {
                payload.chronicle = profile.chronicle.slice();
            } else {
                try {
                    var globalProfileRaw = localStorage.getItem('player_profile');
                    var globalProfile = globalProfileRaw ? JSON.parse(globalProfileRaw) : null;
                    if (globalProfile && Array.isArray(globalProfile.chronicle) && localStorage.getItem('patrac_session') === userId) {
                        payload.chronicle = globalProfile.chronicle.slice();
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}

    try {
        var termRaw = localStorage.getItem(getTerminalStateKey(userId));
        if (termRaw) payload.terminal = JSON.parse(termRaw);
    } catch (e) {}

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

    await ensurePatracAuth();
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
