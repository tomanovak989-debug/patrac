/**
 * Cloudový archiv zpráv vysílačky — per účet (players/{userId}/radio_log).
 * Synchronizace mezi telefonem a PC; soft delete; limit záznamů.
 */
import { collection, doc, getDocs, query, orderBy, limit, setDoc, writeBatch } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { ensurePatracAuth } from '../services/authService.js';

export var RADIO_LOG_CLOUD_MAX = 300;
export var RADIO_LOG_FETCH_LIMIT = 300;

function logRef(userId, entryId) {
    return doc(getDb(), 'players', String(userId || ''), 'radio_log', String(entryId || ''));
}

function entryDocId(entry) {
    if (!entry) return '';
    return String(entry.cloudId || entry.id || '');
}

/** Serializace záznamu pro Firestore. */
export function serializeRadioLogEntry(entry) {
    if (!entry || !entryDocId(entry)) return null;
    var out = {
        id: entry.id || entryDocId(entry),
        cloudId: entry.cloudId || null,
        dir: entry.dir || 'in',
        text: String(entry.text || ''),
        from: String(entry.from || ''),
        senderId: String(entry.senderId || ''),
        frequency: entry.frequency || '',
        encryptionKey: entry.encryptionKey || '',
        channelId: entry.channelId || '',
        scope: entry.scope || 'private',
        comCode: entry.comCode || '',
        ts: Number(entry.ts) || Date.now(),
        read: entry.read !== false,
        deleted: !!entry.deleted,
        encrypted: !!entry.encrypted,
        updatedAt: Date.now()
    };
    if (entry.cipherText) out.cipherText = entry.cipherText;
    if (entry.signalQuality) out.signalQuality = entry.signalQuality;
    if (entry.distanceKm != null) out.distanceKm = entry.distanceKm;
    if (entry.messageType) out.messageType = entry.messageType;
    if (entry.presetSlot) out.presetSlot = entry.presetSlot;
    if (entry.presetLabel) out.presetLabel = entry.presetLabel;
    if (entry.savedPermanent) out.savedPermanent = true;
    if (entry.fromAutoscan) out.fromAutoscan = true;
    if (entry.originLat != null) out.originLat = entry.originLat;
    if (entry.originLng != null) out.originLng = entry.originLng;
    return out;
}

/** Deserializace z Firestore do notebook entry. */
export function deserializeRadioLogEntry(data) {
    if (!data || data.deleted) return null;
    var id = data.id || data.cloudId || '';
    if (!id) return null;
    return {
        id: id,
        cloudId: data.cloudId || (String(id).indexOf('local_') !== 0 ? id : null),
        dir: data.dir || 'in',
        text: data.text || '',
        from: data.from || '',
        senderId: data.senderId || '',
        frequency: data.frequency || '',
        encryptionKey: data.encryptionKey || '',
        channelId: data.channelId || '',
        scope: data.scope || 'private',
        comCode: data.comCode || '',
        ts: Number(data.ts) || Date.now(),
        read: data.read !== false,
        encrypted: !!data.encrypted,
        cipherText: data.cipherText || '',
        signalQuality: data.signalQuality,
        distanceKm: data.distanceKm,
        messageType: data.messageType,
        presetSlot: data.presetSlot,
        presetLabel: data.presetLabel,
        savedPermanent: !!data.savedPermanent,
        fromAutoscan: !!data.fromAutoscan,
        originLat: data.originLat,
        originLng: data.originLng
    };
}

/** Uloží / aktualizuje jeden záznam v cloudu. */
export async function upsertRadioLogEntry(userId, entry) {
    if (!userId || !entry) return false;
    if (entry.id === 'sys_welcome') return false;
    var payload = serializeRadioLogEntry(entry);
    if (!payload) return false;
    try {
        await ensurePatracAuth();
        await setDoc(logRef(userId, payload.id), payload, { merge: true });
        return true;
    } catch (err) {
        console.warn('[radioArchive] upsert', err);
        return false;
    }
}

/** Soft delete v cloudu. */
export async function deleteRadioLogEntry(userId, entry) {
    if (!userId || !entry) return false;
    var docId = entryDocId(entry);
    if (!docId || docId === 'sys_welcome') return false;
    try {
        await ensurePatracAuth();
        await setDoc(logRef(userId, docId), {
            id: docId,
            deleted: true,
            updatedAt: Date.now()
        }, { merge: true });
        return true;
    } catch (err) {
        console.warn('[radioArchive] delete', err);
        return false;
    }
}

/** Načte archiv z cloudu (nejnovější první). */
export async function fetchRadioLogFromCloud(userId, opts) {
    opts = opts || {};
    if (!userId) return [];
    var fetchLimit = opts.limit || RADIO_LOG_FETCH_LIMIT;
    try {
        await ensurePatracAuth();
        var q = query(
            collection(getDb(), 'players', String(userId), 'radio_log'),
            orderBy('ts', 'desc'),
            limit(fetchLimit)
        );
        var snap = await getDocs(q);
        var out = [];
        var i;
        for (i = snap.docs.length - 1; i >= 0; i--) {
            var entry = deserializeRadioLogEntry(snap.docs[i].data());
            if (entry) out.push(entry);
        }
        return out;
    } catch (err) {
        console.warn('[radioArchive] fetch', err);
        return [];
    }
}

function entryKey(entry) {
    if (!entry) return '';
    return String(entry.cloudId || entry.id || '');
}

/** Sloučí cloud archiv s lokálním sešitem (cloud doplňuje, novější ts vyhrává). */
export function mergeNotebookWithCloudLog(notebook, cloudEntries) {
    notebook = notebook || { station: [] };
    if (!Array.isArray(notebook.station)) notebook.station = [];
    if (!cloudEntries || !cloudEntries.length) return notebook;

    var byKey = {};
    var merged = [];
    var i;
    for (i = 0; i < notebook.station.length; i++) {
        var local = notebook.station[i];
        if (!local) continue;
        var key = entryKey(local);
        if (!key) continue;
        byKey[key] = local;
        merged.push(local);
    }
    for (i = 0; i < cloudEntries.length; i++) {
        var cloud = cloudEntries[i];
        if (!cloud) continue;
        var ckey = entryKey(cloud);
        if (!ckey) continue;
        if (byKey[ckey]) {
            var prev = byKey[ckey];
            if ((cloud.ts || 0) >= (prev.ts || 0)) {
                if (cloud.read === false) prev.read = false;
                if (cloud.cipherText && !prev.cipherText) prev.cipherText = cloud.cipherText;
                if (cloud.encrypted && !prev.encrypted) prev.encrypted = cloud.encrypted;
                if (cloud.cloudId && !prev.cloudId) prev.cloudId = cloud.cloudId;
            }
            continue;
        }
        byKey[ckey] = cloud;
        merged.push(cloud);
    }
    merged.sort(function(a, b) { return (a.ts || 0) - (b.ts || 0); });
    if (merged.length > RADIO_LOG_CLOUD_MAX) {
        var welcome = merged.filter(function(e) { return e && e.id === 'sys_welcome'; });
        var rest = merged.filter(function(e) { return e && e.id !== 'sys_welcome'; });
        rest = rest.slice(-RADIO_LOG_CLOUD_MAX);
        merged = welcome.concat(rest);
    }
    notebook.station = merged;
    return notebook;
}

/** Ořízne nejstarší záznamy v cloudu nad limit. */
export async function trimCloudRadioLog(userId, maxCount) {
    maxCount = maxCount || RADIO_LOG_CLOUD_MAX;
    if (!userId) return;
    try {
        var entries = await fetchRadioLogFromCloud(userId, { limit: maxCount + 50 });
        if (entries.length <= maxCount) return;
        var toDrop = entries.slice(0, entries.length - maxCount);
        var batch = writeBatch(getDb());
        var i;
        for (i = 0; i < toDrop.length; i++) {
            if (!toDrop[i] || toDrop[i].id === 'sys_welcome') continue;
            batch.set(logRef(userId, entryDocId(toDrop[i])), {
                deleted: true,
                updatedAt: Date.now()
            }, { merge: true });
        }
        await batch.commit();
    } catch (err) {
        console.warn('[radioArchive] trim', err);
    }
}

/** Odstraní záznam ze sešitu (lokálně). */
export function removeStationEntry(notebook, entry) {
    if (!notebook || !entry || !Array.isArray(notebook.station)) return false;
    var key = entryKey(entry);
    if (!key) return false;
    var before = notebook.station.length;
    notebook.station = notebook.station.filter(function(e) {
        if (!e) return false;
        if (e.id === 'sys_welcome') return true;
        return entryKey(e) !== key;
    });
    return notebook.station.length < before;
}
