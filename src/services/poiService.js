/**
 * Mapové body komunity — volné POI a popisy u story misí ve Firestore.
 * Ukládá se do communities/{comCode}.pois[]; fotky jdou do Storage photos/.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb, ensureFirebaseAuth } from '../lib/firebase.js';
import { ensurePatracAuth } from './authService.js';
import { uploadPhotoFromDataUrl, deleteStorageFileByUrl } from './dataService.js';

const COLLECTION = 'communities';
const STORY_QUEST_IDS = ['roxy', 'sef', 'herbert', 'ino', 'adam'];

function normalizeComCode(comCode) {
    return String(comCode || '').trim().toUpperCase();
}

function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//.test(value);
}

function isDataUrl(value) {
    return typeof value === 'string' && value.indexOf('data:') === 0;
}

function normalizeCloudPoi(raw) {
    if (!raw || !raw.id) return null;
    return {
        id: String(raw.id),
        type: raw.type === 'story' ? 'story' : 'free',
        questId: raw.questId ? String(raw.questId) : '',
        name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '',
        note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 2000) : '',
        imgUrl: isHttpUrl(raw.imgUrl) ? raw.imgUrl : (isHttpUrl(raw.img) ? raw.img : ''),
        lat: typeof raw.lat === 'number' ? raw.lat : parseFloat(raw.lat),
        lng: typeof raw.lng === 'number' ? raw.lng : parseFloat(raw.lng),
        creatorUserId: raw.creatorUserId ? String(raw.creatorUserId) : '',
        creatorName: typeof raw.creatorName === 'string' ? raw.creatorName.trim().slice(0, 80) : '',
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
}

function freePoiToLocal(cloudPoi) {
    return {
        id: cloudPoi.id,
        name: cloudPoi.name || '',
        note: cloudPoi.note || '',
        desc: cloudPoi.note || '',
        img: cloudPoi.imgUrl || '',
        lat: cloudPoi.lat,
        lng: cloudPoi.lng,
        date: new Date(cloudPoi.updatedAt || cloudPoi.createdAt || Date.now()).toLocaleString('cs-CZ'),
        creator: cloudPoi.creatorName || 'Operativec',
        creatorUserId: cloudPoi.creatorUserId || '',
        createdAt: cloudPoi.createdAt || Date.now(),
        updatedAt: cloudPoi.updatedAt || Date.now()
    };
}

/**
 * Zapíše cloud POI do localStorage (map_free_pois + story_pos_*).
 */
export function applyCloudPoisToLocalStorage(pois) {
    var free = [];
    var list = Array.isArray(pois) ? pois : [];

    for (var i = 0; i < list.length; i++) {
        var poi = normalizeCloudPoi(list[i]);
        if (!poi) continue;

        if (poi.type === 'story' && poi.questId) {
            if (poi.note) {
                localStorage.setItem('story_pos_note_' + poi.questId, poi.note);
            } else {
                try { localStorage.removeItem('story_pos_note_' + poi.questId); } catch (e) {}
            }
            if (poi.imgUrl) {
                localStorage.setItem('story_pos_img_' + poi.questId, poi.imgUrl);
            } else {
                try { localStorage.removeItem('story_pos_img_' + poi.questId); } catch (e) {}
            }
            continue;
        }

        if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number' || isNaN(poi.lat) || isNaN(poi.lng)) {
            continue;
        }
        free.push(freePoiToLocal(poi));
    }

    localStorage.setItem('map_free_pois', JSON.stringify(free));
}

async function resolvePoiImageUrl(poi, previousImgUrl) {
    var pending = poi.img || poi.imgUrl || '';
    if (!pending) {
        if (previousImgUrl && isHttpUrl(previousImgUrl)) {
            deleteStorageFileByUrl(previousImgUrl).catch(function() {});
        }
        return '';
    }
    if (isDataUrl(pending)) {
        if (previousImgUrl && isHttpUrl(previousImgUrl) && previousImgUrl !== pending) {
            deleteStorageFileByUrl(previousImgUrl).catch(function() {});
        }
        return uploadPhotoFromDataUrl(pending);
    }
    if (isHttpUrl(pending)) return pending;
    if (isHttpUrl(poi.imgUrl)) return poi.imgUrl;
    return '';
}

function collectPoiImageUrls(pois) {
    var urls = {};
    var list = Array.isArray(pois) ? pois : [];
    for (var i = 0; i < list.length; i++) {
        var poi = normalizeCloudPoi(list[i]);
        if (poi && poi.imgUrl) urls[poi.imgUrl] = true;
    }
    return urls;
}

/**
 * Smaže fotky ve Storage, které už nejsou v novém seznamu POI.
 */
async function deleteOrphanedPoiPhotos(existingPois, nextPois) {
    var nextUrls = collectPoiImageUrls(nextPois);
    var existing = Array.isArray(existingPois) ? existingPois : [];

    for (var i = 0; i < existing.length; i++) {
        var old = normalizeCloudPoi(existing[i]);
        if (!old || !old.imgUrl || nextUrls[old.imgUrl]) continue;
        try {
            await deleteStorageFileByUrl(old.imgUrl);
        } catch (err) {
            console.warn('[poiService] delete orphan photo', old.imgUrl, err);
        }
    }
}

/**
 * Nahraje base64 fotky a vrátí pole připravené pro Firestore.
 * @param {unknown[]} pois
 * @param {Record<string, string>} [previousImgById]
 */
export async function preparePoisForCloud(pois, previousImgById) {
    previousImgById = previousImgById || {};
    var out = [];
    var list = Array.isArray(pois) ? pois : [];

    for (var i = 0; i < list.length; i++) {
        var raw = list[i];
        var poi = normalizeCloudPoi(raw);
        if (!poi) continue;

        var imgUrl = await resolvePoiImageUrl(raw, previousImgById[poi.id] || poi.imgUrl);
        out.push({
            id: poi.id,
            type: poi.type,
            questId: poi.questId || null,
            name: poi.name,
            note: poi.note,
            imgUrl: imgUrl,
            lat: typeof poi.lat === 'number' && !isNaN(poi.lat) ? poi.lat : null,
            lng: typeof poi.lng === 'number' && !isNaN(poi.lng) ? poi.lng : null,
            creatorUserId: poi.creatorUserId,
            creatorName: poi.creatorName,
            createdAt: poi.createdAt,
            updatedAt: Date.now()
        });
    }

    return out;
}

export async function saveCommunityPoisToCloud(comCode, pois, previousImgById) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return;
    await ensurePatracAuth();

    var existing = await fetchCommunityPoisFromCloud(comCode);
    var prepared = await preparePoisForCloud(pois, previousImgById);
    await deleteOrphanedPoiPhotos(existing, prepared);
    await setDoc(doc(getDb(), COLLECTION, comCode), {
        pois: prepared,
        poisUpdatedAt: Date.now(),
        updatedAt: Date.now()
    }, { merge: true });

    applyCloudPoisToLocalStorage(prepared);
    return prepared;
}

export async function fetchCommunityPoisFromCloud(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return [];
    await ensureFirebaseAuth();

    var snap = await getDoc(doc(getDb(), COLLECTION, comCode));
    if (!snap.exists()) return [];

    var data = snap.data();
    if (!Array.isArray(data.pois)) return [];

    return data.pois.map(normalizeCloudPoi).filter(Boolean);
}

/**
 * Stáhne POI komunity do localStorage.
 * @returns {Promise<{ ok: boolean, pois?: unknown[] }>}
 */
export async function hydrateCommunityPoisFromCloud(comCode) {
    comCode = normalizeComCode(comCode);
    if (!comCode) return { ok: false };

    var pois = await fetchCommunityPoisFromCloud(comCode);
    if (!pois.length) return { ok: false };

    applyCloudPoisToLocalStorage(pois);
    return { ok: true, pois: pois };
}

export function buildStoryPoisFromLocalStorage(readNote, readImg, readCoords, readLabel) {
    var pois = [];
    for (var i = 0; i < STORY_QUEST_IDS.length; i++) {
        var questId = STORY_QUEST_IDS[i];
        var note = readNote(questId);
        var img = readImg(questId);
        if (!note && !img) continue;

        var coords = readCoords(questId);
        pois.push({
            id: 'story_' + questId,
            type: 'story',
            questId: questId,
            name: readLabel(questId),
            note: note,
            img: img,
            imgUrl: isHttpUrl(img) ? img : '',
            lat: coords ? coords.lat : null,
            lng: coords ? coords.lng : null,
            updatedAt: Date.now()
        });
    }
    return pois;
}

export { STORY_QUEST_IDS };
