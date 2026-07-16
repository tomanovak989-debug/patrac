/**
 * dataService — ukládání záznamů do Firestore a fotek do Firebase Storage.
 */
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { getDb, getFirebaseStorage, ensureFirebaseAuth } from '../lib/firebase.js';

const ENTRIES_COLLECTION = 'entries';
const POCTA_VISITS_COLLECTION = 'pocta_visits';
const PHOTOS_STORAGE_PATH = 'photos';

/** Ostrost pro mobil — delší hrana v px, JPEG kvalita, cílový strop souboru (MB). */
const PHOTO_MAX_EDGE_PX = 1920;
const PHOTO_QUALITY = 0.88;
const PHOTO_MAX_SIZE_MB = 0.5;
const PHOTO_MAX_INPUT_MB = 25;
const PHOTO_MIN_EDGE_PX = 640;

function readImageDimensions(blob) {
    return new Promise(function(resolve, reject) {
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function() {
            resolve({
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height
            });
            URL.revokeObjectURL(url);
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            reject(new Error('Nepodařilo se načíst rozměry fotky.'));
        };
        img.src = url;
    });
}

async function ensurePhotoMinDimensions(original, compressed) {
    try {
        var dims = await readImageDimensions(compressed);
        var longEdge = Math.max(dims.width, dims.height);
        if (longEdge >= PHOTO_MIN_EDGE_PX) return compressed;

        var retry = await imageCompression(original, {
            maxWidthOrHeight: PHOTO_MAX_EDGE_PX,
            initialQuality: 0.9,
            maxSizeMB: PHOTO_MAX_SIZE_MB,
            alwaysKeepResolution: true,
            useWebWorker: false,
            fileType: 'image/jpeg',
            preserveExif: false
        });
        var retryDims = await readImageDimensions(retry);
        if (Math.max(retryDims.width, retryDims.height) > longEdge) return retry;
        return compressed;
    } catch (err) {
        console.warn('[dataService] ensurePhotoMinDimensions:', err);
        return compressed;
    }
}

/**
 * Normalizuje timestamp na číslo (ms od epochy) pro konzistentní řazení.
 * @param {number|Date|import('firebase/firestore').Timestamp|null|undefined} value
 * @returns {number}
 */
function normalizeTimestamp(value) {
    if (value == null) return Date.now();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'string') {
        var parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return Date.now();
}

/**
 * Uloží záznam do Firestore.
 * @param {{ text: string, timestamp?: number|Date|import('firebase/firestore').Timestamp, location?: unknown, photoUrl?: string|null }} entryData
 * @returns {Promise<{ id: string, text: string, timestamp: number, location: unknown, photoUrl: string|null }>}
 */
export async function saveEntry(entryData) {
    try {
        await ensureFirebaseAuth();
        if (!entryData || typeof entryData !== 'object') {
            throw new Error('Chybí data záznamu.');
        }

        var text = typeof entryData.text === 'string' ? entryData.text.trim() : '';
        if (!text) {
            throw new Error('Text záznamu je povinný.');
        }

        var payload = {
            text: text,
            timestamp: normalizeTimestamp(entryData.timestamp),
            location: entryData.location ?? null,
            photoUrl: entryData.photoUrl ?? null
        };

        var docRef = await addDoc(collection(getDb(), ENTRIES_COLLECTION), payload);

        return {
            id: docRef.id,
            text: payload.text,
            timestamp: payload.timestamp,
            location: payload.location,
            photoUrl: payload.photoUrl
        };
    } catch (err) {
        console.error('[dataService] saveEntry:', err);
        if (err instanceof Error) throw err;
        throw new Error('Nepodařilo se uložit záznam.');
    }
}

/**
 * Zkomprimuje fotku a nahraje ji do Firebase Storage.
 * @param {File|Blob} file
 * @returns {Promise<string>} Veřejná URL nahraného souboru
 */
export async function uploadPhoto(file) {
    try {
        await ensureFirebaseAuth();

        if (!file || !(file instanceof Blob)) {
            throw new Error('Neplatný soubor pro nahrání.');
        }

        if (file.size > PHOTO_MAX_INPUT_MB * 1024 * 1024) {
            throw new Error('Fotka je příliš velká (max. ' + PHOTO_MAX_INPUT_MB + ' MB).');
        }

        var compressed = await imageCompression(file, {
            maxWidthOrHeight: PHOTO_MAX_EDGE_PX,
            initialQuality: PHOTO_QUALITY,
            maxSizeMB: PHOTO_MAX_SIZE_MB,
            alwaysKeepResolution: true,
            useWebWorker: false,
            fileType: 'image/jpeg',
            preserveExif: false
        });

        compressed = await ensurePhotoMinDimensions(file, compressed);

        var originalName = (file.name || 'photo.jpg').replace(/[^\w.-]/g, '_');
        if (!/\.(jpe?g|png|webp)$/i.test(originalName)) {
            originalName += '.jpg';
        }
        var storagePath = PHOTOS_STORAGE_PATH + '/' + Date.now() + '_' + originalName;
        var storageRef = ref(getFirebaseStorage(), storagePath);

        await uploadBytes(storageRef, compressed, {
            contentType: 'image/jpeg'
        });

        return await getDownloadURL(storageRef);
    } catch (err) {
        console.error('[dataService] uploadPhoto:', err);
        if (err instanceof Error) throw err;
        throw new Error('Nepodařilo se nahrát fotografii.');
    }
}

/**
 * Načte všechny záznamy z Firestore seřazené podle času sestupně.
 * @returns {Promise<Array<{ id: string, text: string, timestamp: number, location: unknown, photoUrl: string|null }>>}
 */
export async function getAllEntries() {
    try {
        await ensureFirebaseAuth();
        var q = query(
            collection(getDb(), ENTRIES_COLLECTION),
            orderBy('timestamp', 'desc')
        );
        var snapshot = await getDocs(q);

        return snapshot.docs.map(function(docSnap) {
            var data = docSnap.data();
            return {
                id: docSnap.id,
                text: data.text || '',
                timestamp: normalizeTimestamp(data.timestamp),
                location: data.location ?? null,
                photoUrl: data.photoUrl ?? null
            };
        });
    } catch (err) {
        console.error('[dataService] getAllEntries:', err);
        if (err instanceof Error) throw err;
        throw new Error('Nepodařilo se načíst záznamy.');
    }
}

/**
 * Uloží záznam kroniky Pocty do Firestore.
 * @param {{ poctaId: string, text: string, timestamp?: number, location?: { lat: number, lng: number }|null, photoUrl?: string|null, userId?: string, userName?: string }} visitData
 * @returns {Promise<{ id: string, poctaId: string, text: string, timestamp: number, location: unknown, photoUrl: string|null, userId: string, userName: string }>}
 */
export async function savePoctaVisit(visitData) {
    try {
        await ensureFirebaseAuth();
        if (!visitData || typeof visitData !== 'object') {
            throw new Error('Chybí data návštěvy.');
        }

        var poctaId = typeof visitData.poctaId === 'string' ? visitData.poctaId.trim() : '';
        if (!poctaId) {
            throw new Error('Chybí ID Pocty.');
        }

        var text = typeof visitData.text === 'string' ? visitData.text.trim() : '';
        if (!text) {
            throw new Error('Text záznamu je povinný.');
        }

        var payload = {
            poctaId: poctaId,
            text: text,
            timestamp: normalizeTimestamp(visitData.timestamp),
            location: visitData.location ?? null,
            photoUrl: visitData.photoUrl ?? null,
            userId: visitData.userId || '',
            userName: visitData.userName || 'Operativec'
        };

        var docRef = await addDoc(collection(getDb(), POCTA_VISITS_COLLECTION), payload);

        return {
            id: docRef.id,
            poctaId: payload.poctaId,
            text: payload.text,
            timestamp: payload.timestamp,
            location: payload.location,
            photoUrl: payload.photoUrl,
            userId: payload.userId,
            userName: payload.userName
        };
    } catch (err) {
        console.error('[dataService] savePoctaVisit:', err);
        if (err instanceof Error) throw err;
        throw new Error('Nepodařilo se uložit záznam kroniky.');
    }
}

/**
 * Načte záznamy kroniky pro konkrétní Poctu (seřazeno sestupně podle času).
 * @param {string} poctaId
 * @returns {Promise<Array<{ id: string, poctaId: string, text: string, timestamp: number, location: unknown, photoUrl: string|null, userId: string, userName: string }>>}
 */
export async function getPoctaVisits(poctaId) {
    try {
        await ensureFirebaseAuth();
        if (!poctaId) {
            throw new Error('Chybí ID Pocty.');
        }

        var q = query(
            collection(getDb(), POCTA_VISITS_COLLECTION),
            where('poctaId', '==', poctaId)
        );
        var snapshot = await getDocs(q);

        var visits = snapshot.docs.map(function(docSnap) {
            var data = docSnap.data();
            return {
                id: docSnap.id,
                poctaId: data.poctaId || poctaId,
                text: data.text || '',
                timestamp: normalizeTimestamp(data.timestamp),
                location: data.location ?? null,
                photoUrl: data.photoUrl ?? null,
                userId: data.userId || '',
                userName: data.userName || 'Operativec'
            };
        });

        visits.sort(function(a, b) {
            return b.timestamp - a.timestamp;
        });

        return visits;
    } catch (err) {
        console.error('[dataService] getPoctaVisits:', err);
        if (err instanceof Error) throw err;
        throw new Error('Nepodařilo se načíst kroniku Pocty.');
    }
}
