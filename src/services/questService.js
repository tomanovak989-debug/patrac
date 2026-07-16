/**
 * Komunitní úkoly ve Firestore — story GPS, vlastní/náhodné rozkazy, archiv.
 * Ukládá se do communities/{comCode}.quests
 */
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getDb, ensureFirebaseAuth } from '../lib/firebase.js';
import { ensurePatracAuth } from './authService.js';

const COLLECTION = 'communities';
const STORY_QUEST_IDS = ['roxy', 'sef', 'herbert', 'ino', 'adam'];

function normalizeComCode(comCode) {
    return String(comCode || '').trim().toUpperCase();
}

function normalizeStoryEntry(raw) {
    if (!raw || typeof raw !== 'object') return { lat: null, lng: null };
    var lat = raw.lat != null ? parseFloat(raw.lat) : null;
    var lng = raw.lng != null ? parseFloat(raw.lng) : null;
    return {
        lat: typeof lat === 'number' && !isNaN(lat) ? lat : null,
        lng: typeof lng === 'number' && !isNaN(lng) ? lng : null
    };
}

function normalizeQuestListItem(raw) {
    if (!raw || !raw.id) return null;
    var lat = raw.lat != null ? parseFloat(raw.lat) : null;
    var lng = raw.lng != null ? parseFloat(raw.lng) : null;
    var item = Object.assign({}, raw);
    item.id = String(raw.id);
    item.lat = typeof lat === 'number' && !isNaN(lat) ? lat : null;
    item.lng = typeof lng === 'number' && !isNaN(lng) ? lng : null;
    return item;
}

export function normalizeCommunityQuests(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            version: 1,
            story: {},
            custom: [],
            random: [],
            dismissed: [],
            reqOverrides: {},
            launched: {},
            updatedAt: 0
        };
    }

    var story = {};
    if (raw.story && typeof raw.story === 'object') {
        for (var key in raw.story) {
            if (!Object.prototype.hasOwnProperty.call(raw.story, key)) continue;
            story[key] = normalizeStoryEntry(raw.story[key]);
        }
    }

    var custom = [];
    if (Array.isArray(raw.custom)) {
        for (var c = 0; c < raw.custom.length; c++) {
            var cq = normalizeQuestListItem(raw.custom[c]);
            if (cq) custom.push(cq);
        }
    }

    var random = [];
    if (Array.isArray(raw.random)) {
        for (var r = 0; r < raw.random.length; r++) {
            var rq = normalizeQuestListItem(raw.random[r]);
            if (rq) random.push(rq);
        }
    }

        return {
            version: raw.version || 1,
            story: story,
            custom: custom,
            random: random,
            dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.slice() : [],
            reqOverrides: raw.reqOverrides && typeof raw.reqOverrides === 'object' ? raw.reqOverrides : {},
            launched: raw.launched && typeof raw.launched === 'object' ? raw.launched : {},
            updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
        };
    }

function normalizeLaunchedCompletion(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var lat = raw.lat != null ? parseFloat(raw.lat) : null;
    var lng = raw.lng != null ? parseFloat(raw.lng) : null;
    if (typeof lat !== 'number' || isNaN(lat) || typeof lng !== 'number' || isNaN(lng)) return null;
    return {
        lat: lat,
        lng: lng,
        at: typeof raw.at === 'number' ? raw.at : 0,
        name: typeof raw.name === 'string' ? raw.name : ''
    };
}

function normalizeLaunchedCompletions(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (var userId in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, userId)) continue;
        var entry = normalizeLaunchedCompletion(raw[userId]);
        if (entry) out[String(userId)] = entry;
    }
    return out;
}

function normalizePendingPosition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var lat = raw.lat != null ? parseFloat(raw.lat) : null;
    var lng = raw.lng != null ? parseFloat(raw.lng) : null;
    if (typeof lat !== 'number' || isNaN(lat) || typeof lng !== 'number' || isNaN(lng)) return null;
    return {
        lat: lat,
        lng: lng,
        confirmedBy: raw.confirmedBy ? String(raw.confirmedBy) : '',
        confirmedByName: typeof raw.confirmedByName === 'string' ? raw.confirmedByName : '',
        confirmedAt: typeof raw.confirmedAt === 'number' ? raw.confirmedAt : 0
    };
}

function normalizeLaunchedEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
        expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : 0,
        startedBy: raw.startedBy ? String(raw.startedBy) : '',
        startedByName: typeof raw.startedByName === 'string' ? raw.startedByName : '',
        closed: !!raw.closed,
        completions: normalizeLaunchedCompletions(raw.completions),
        pendingPosition: normalizePendingPosition(raw.pendingPosition),
        positionApplied: !!raw.positionApplied
    };
}

function normalizeLaunchedMap(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (var id in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, id)) continue;
        var entry = normalizeLaunchedEntry(raw[id]);
        if (entry) out[id] = entry;
    }
    return out;
}

function mergeStoryMaps(a, b) {
    a = a || {};
    b = b || {};
    var out = {};
    var keys = {};
    for (var k1 in a) keys[k1] = true;
    for (var k2 in b) keys[k2] = true;
    for (var key in keys) {
        if (!Object.prototype.hasOwnProperty.call(keys, key)) continue;
        var left = normalizeStoryEntry(a[key]);
        var right = normalizeStoryEntry(b[key]);
        out[key] = {
            lat: right.lat != null ? right.lat : left.lat,
            lng: right.lng != null ? right.lng : left.lng
        };
    }
    return out;
}

function mergeQuestLists(a, b) {
    var map = {};
    var lists = [a || [], b || []];
    for (var l = 0; l < lists.length; l++) {
        var list = lists[l];
        for (var i = 0; i < list.length; i++) {
            var item = normalizeQuestListItem(list[i]);
            if (!item) continue;
            var prev = map[item.id];
            if (!prev) {
                map[item.id] = item;
                continue;
            }
            map[item.id] = Object.assign({}, prev, item, {
                lat: item.lat != null ? item.lat : prev.lat,
                lng: item.lng != null ? item.lng : prev.lng
            });
        }
    }
    var out = [];
    for (var id in map) {
        if (Object.prototype.hasOwnProperty.call(map, id)) out.push(map[id]);
    }
    return out;
}

function mergeUniqueStrings(a, b) {
    var out = [];
    var seen = {};
    var lists = [a || [], b || []];
    for (var l = 0; l < lists.length; l++) {
        for (var i = 0; i < lists[l].length; i++) {
            var val = String(lists[l][i] || '');
            if (!val || seen[val]) continue;
            seen[val] = true;
            out.push(val);
        }
    }
    return out;
}

function mergeReqOverrides(a, b) {
    return Object.assign({}, a || {}, b || {});
}

function mergeLaunchedMaps(a, b) {
    a = normalizeLaunchedMap(a);
    b = normalizeLaunchedMap(b);
    var out = Object.assign({}, a);
    for (var id in b) {
        if (!Object.prototype.hasOwnProperty.call(b, id)) continue;
        var incoming = b[id];
        var existing = out[id];
        if (!existing) {
            out[id] = incoming;
            continue;
        }
        if (existing.closed && !incoming.closed) {
            out[id] = incoming;
            continue;
        }
        if (!existing.closed && !incoming.closed) {
            var newer = (incoming.startedAt || 0) >= (existing.startedAt || 0) ? incoming : existing;
            var older = newer === incoming ? existing : incoming;
            newer.completions = Object.assign({}, older.completions || {}, newer.completions || {});
            if (!newer.pendingPosition && older.pendingPosition) {
                newer.pendingPosition = older.pendingPosition;
            }
            out[id] = newer;
            continue;
        }
        if (existing.closed && incoming.closed) {
            out[id] = (incoming.startedAt || 0) >= (existing.startedAt || 0) ? incoming : existing;
            continue;
        }
        if (!existing.closed && incoming.closed && (incoming.startedAt || 0) === (existing.startedAt || 0)) {
            incoming.completions = Object.assign({}, existing.completions || {}, incoming.completions || {});
            if (!incoming.pendingPosition && existing.pendingPosition) {
                incoming.pendingPosition = existing.pendingPosition;
            }
            out[id] = incoming;
        }
    }
    return out;
}

export function mergeCommunityQuests(cloudQuests, localQuests) {
    cloudQuests = normalizeCommunityQuests(cloudQuests);
    localQuests = normalizeCommunityQuests(localQuests);
    return normalizeCommunityQuests({
        version: 1,
        story: mergeStoryMaps(cloudQuests.story, localQuests.story),
        custom: mergeQuestLists(cloudQuests.custom, localQuests.custom),
        random: mergeQuestLists(cloudQuests.random, localQuests.random),
        dismissed: mergeUniqueStrings(cloudQuests.dismissed, localQuests.dismissed),
        reqOverrides: mergeReqOverrides(cloudQuests.reqOverrides, localQuests.reqOverrides),
        launched: mergeLaunchedMaps(cloudQuests.launched, localQuests.launched),
        updatedAt: Math.max(cloudQuests.updatedAt || 0, localQuests.updatedAt || 0, Date.now())
    });
}

function applyQuestCoords(questId, lat, lng) {
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        localStorage.setItem('point_' + questId + '_lat', String(lat));
        localStorage.setItem('point_' + questId + '_lng', String(lng));
    } else {
        try {
            localStorage.removeItem('point_' + questId + '_lat');
            localStorage.removeItem('point_' + questId + '_lng');
        } catch (e) {}
    }
}

/**
 * Zapíše cloud quest data do localStorage cache.
 */
export function applyCommunityQuestsToLocalStorage(quests) {
    var data = normalizeCommunityQuests(quests);

    for (var s = 0; s < STORY_QUEST_IDS.length; s++) {
        var storyId = STORY_QUEST_IDS[s];
        var entry = data.story[storyId] || { lat: null, lng: null };
        applyQuestCoords(storyId, entry.lat, entry.lng);
    }

    localStorage.setItem('custom_quests_list', JSON.stringify(data.custom));
    localStorage.setItem('random_quests_list', JSON.stringify(data.random));
    localStorage.setItem('dismissed_quests', JSON.stringify(data.dismissed));
    localStorage.setItem('quest_req_overrides', JSON.stringify(data.reqOverrides));

    var comCode = '';
    try { comCode = (localStorage.getItem('com_code') || '').toUpperCase(); } catch (e) {}
    if (comCode) {
        localStorage.setItem('patrac_quest_launched_' + comCode, JSON.stringify(data.launched || {}));
    }

    for (var c = 0; c < data.custom.length; c++) {
        applyQuestCoords(data.custom[c].id, data.custom[c].lat, data.custom[c].lng);
    }
    for (var r = 0; r < data.random.length; r++) {
        applyQuestCoords(data.random[r].id, data.random[r].lat, data.random[r].lng);
    }
}

export async function saveCommunityQuestsToCloud(comCode, quests) {
    comCode = normalizeComCode(comCode);
    if (!comCode || !quests) return;
    await ensurePatracAuth();
    var payload = normalizeCommunityQuests(Object.assign({}, quests, { updatedAt: Date.now() }));
    await setDoc(doc(getDb(), COLLECTION, comCode), {
        quests: payload,
        questsUpdatedAt: Date.now(),
        updatedAt: Date.now()
    }, { merge: true });
    applyCommunityQuestsToLocalStorage(payload);
    return payload;
}

export async function fetchCommunityQuestsFromCloud(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return null;
    await ensureFirebaseAuth();
    var snap = await getDoc(doc(getDb(), COLLECTION, comCode));
    if (!snap.exists()) return null;
    var data = snap.data();
    if (!data.quests) return null;
    return normalizeCommunityQuests(data.quests);
}

export async function hydrateCommunityQuestsFromCloud(comCode, localQuests) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return { ok: false };

    var cloudQuests = await fetchCommunityQuestsFromCloud(comCode);
    if (!cloudQuests && !localQuests) return { ok: false };

    var merged = mergeCommunityQuests(cloudQuests || normalizeCommunityQuests(null), localQuests || normalizeCommunityQuests(null));
    applyCommunityQuestsToLocalStorage(merged);

    if (!cloudQuests || JSON.stringify(cloudQuests) !== JSON.stringify(merged)) {
        await saveCommunityQuestsToCloud(comCode, merged);
    }

    return { ok: true, quests: merged };
}

var activeCommunityListener = null;

/**
 * Realtime sync — inventář + questy komunity (Fáze 2C).
 * @param {string} comCode
 * @param {(data: { inventory?: unknown[], quests?: object|null }) => void} onChange
 */
export async function subscribeCommunityRealtime(comCode, onChange) {
    comCode = normalizeComCode(comCode);
    if (!comCode || typeof onChange !== 'function') return function() {};

    await ensureFirebaseAuth();
    if (activeCommunityListener) {
        activeCommunityListener();
        activeCommunityListener = null;
    }

    var ref = doc(getDb(), COLLECTION, comCode);
    activeCommunityListener = onSnapshot(ref, function(snap) {
        if (!snap.exists()) return;
        var data = snap.data();
        var payload = {};
        if (Array.isArray(data.inventory)) payload.inventory = data.inventory;
        if (data.quests) payload.quests = normalizeCommunityQuests(data.quests);
        onChange(payload);
    }, function(err) {
        console.warn('[questService] community realtime', err);
    });

    return function unsubscribe() {
        if (activeCommunityListener) {
            activeCommunityListener();
            activeCommunityListener = null;
        }
    };
}

export { STORY_QUEST_IDS };
