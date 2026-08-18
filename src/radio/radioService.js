/**
 * Rádiové zprávy ve Firestore — kanál = frekvence (freq-first).
 * Cesta: radio_freq/{f_400025}/messages/{msgId}
 */
import { collection, collectionGroup, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { ensurePatracAuth } from '../services/authService.js';
import { frequencyChannelId, normalizeFrequency } from './radioBand.js';

var channelUnsubs = {};

async function ensureRadioAuth() {
    try {
        return await ensurePatracAuth();
    } catch (err) {
        console.warn('[radioService] auth', err);
    }
}

export async function sendRadioTransmission(payload) {
    await ensureRadioAuth();
    var freq = normalizeFrequency(payload && payload.frequency);
    var channelId = (payload && payload.channelId) || frequencyChannelId(freq);
    if (!freq || !channelId) {
        throw new Error('Chybí frekvence vysílání.');
    }
    var docPayload = {
        channelId: channelId,
        frequency: freq,
        encryptionKey: payload.encryptionKey || '',
        scope: payload.scope || 'private',
        comCode: payload.comCode || '',
        senderId: payload.senderId || '',
        senderName: payload.senderName || 'Operativec',
        text: String(payload.text || '').trim(),
        timestamp: payload.timestamp || Date.now()
    };
    if (payload.messageType) docPayload.messageType = payload.messageType;
    if (payload.presetSlot) docPayload.presetSlot = payload.presetSlot;
    if (payload.presetLabel) docPayload.presetLabel = payload.presetLabel;
    if (payload.pttAudio) docPayload.pttAudio = payload.pttAudio;
    if (payload.pttMime) docPayload.pttMime = payload.pttMime;
    if (payload.originLat != null && payload.originLng != null &&
        isFinite(Number(payload.originLat)) && isFinite(Number(payload.originLng))) {
        docPayload.originLat = Number(payload.originLat);
        docPayload.originLng = Number(payload.originLng);
    }
    if (!docPayload.text && !docPayload.pttAudio) throw new Error('Prázdná zpráva.');

    var col = collection(getDb(), 'radio_freq', channelId, 'messages');
    var ref = await addDoc(col, docPayload);
    return { id: ref.id, ...docPayload };
}

function channelIdFromDocRef(docSnap) {
    var parts = String(docSnap && docSnap.ref && docSnap.ref.path ? docSnap.ref.path : '').split('/');
    var i;
    for (i = 0; i < parts.length - 1; i++) {
        if (parts[i] === 'radio_freq' && parts[i + 1]) return parts[i + 1];
    }
    return '';
}

function mapDocToPayload(docSnap, fallbackFreq, channelId) {
    channelId = channelId || channelIdFromDocRef(docSnap);
    var data = docSnap.data() || {};
    var freqFromId = '';
    if (channelId && channelId.indexOf('f_') === 0) {
        var raw = channelId.slice(2);
        if (raw.length >= 4) freqFromId = raw.slice(0, 3) + '.' + raw.slice(3);
    }
    return {
        id: docSnap.id,
        channelId: channelId,
        frequency: data.frequency || fallbackFreq || normalizeFrequency(freqFromId),
        encryptionKey: data.encryptionKey,
        scope: data.scope,
        comCode: data.comCode,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        messageType: data.messageType,
        presetSlot: data.presetSlot,
        presetLabel: data.presetLabel,
        pttAudio: data.pttAudio,
        pttMime: data.pttMime,
        timestamp: data.timestamp,
        originLat: data.originLat,
        originLng: data.originLng
    };
}

/**
 * @param {string[]} frequenciesOrIds — normalizované frekvence („400.025“) nebo id („f_400025“)
 * @param {(payload: object) => void} onMessage
 * @returns {Promise<void>}
 */
export async function subscribeRadioChannels(frequenciesOrIds, onMessage) {
    stopRadioSubscriptions();
    if (!Array.isArray(frequenciesOrIds) || !frequenciesOrIds.length) return;

    await ensureRadioAuth();

    for (var i = 0; i < frequenciesOrIds.length; i++) {
        (function(raw) {
            var freq = normalizeFrequency(raw);
            var channelId = freq ? frequencyChannelId(freq) : String(raw || '');
            if (!channelId || channelUnsubs[channelId]) return;
            if (!freq && channelId.indexOf('f_') !== 0) return;

            var q = query(
                collection(getDb(), 'radio_freq', channelId, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(40)
            );
            var seen = {};
            var initialSnap = true;
            channelUnsubs[channelId] = onSnapshot(q, function(snap) {
                if (initialSnap) {
                    initialSnap = false;
                    /* Backfill: chronologicky (starší → novější), ať přepnutí profilu
                       dostane nedávný provoz na naladěné frekvenci do staničníku. */
                    var docs = snap.docs.slice().reverse();
                    for (var s = 0; s < docs.length; s++) {
                        seen[docs[s].id] = true;
                        onMessage(mapDocToPayload(docs[s], freq, channelId));
                    }
                    return;
                }
                var changes = snap.docChanges();
                for (var c = 0; c < changes.length; c++) {
                    if (changes[c].type !== 'added') continue;
                    var docSnap = changes[c].doc;
                    var msgId = docSnap.id;
                    if (seen[msgId]) continue;
                    seen[msgId] = true;
                    onMessage(mapDocToPayload(docSnap, freq, channelId));
                }
            }, function(err) {
                console.warn('[radioService] subscribe', channelId, err);
            });
        })(frequenciesOrIds[i]);
    }
}

export function stopRadioSubscriptions() {
    for (var id in channelUnsubs) {
        if (!Object.prototype.hasOwnProperty.call(channelUnsubs, id)) continue;
        try { channelUnsubs[id](); } catch (e) {}
    }
    channelUnsubs = {};
}

/**
 * Autosken — poslech celého pásma: collection group „messages“ napříč všemi frekvencemi.
 * Herní pravidlo: platí jen dosah, ne shoda s aktuálním krokem skenu.
 */
export async function subscribeRadioBandScan(onMessage) {
    stopRadioSubscriptions();
    if (!onMessage) return;

    await ensureRadioAuth();

    var q = query(
        collectionGroup(getDb(), 'messages'),
        orderBy('timestamp', 'desc'),
        limit(96)
    );
    var seen = {};
    var initialSnap = true;
    channelUnsubs.__band_scan__ = onSnapshot(q, function(snap) {
        if (initialSnap) {
            initialSnap = false;
            var i;
            for (i = 0; i < snap.docs.length; i++) {
                seen[snap.docs[i].ref.path] = true;
            }
            return;
        }
        var changes = snap.docChanges();
        var c;
        for (c = 0; c < changes.length; c++) {
            if (changes[c].type !== 'added') continue;
            var docSnap = changes[c].doc;
            var pathKey = docSnap.ref.path;
            if (seen[pathKey]) continue;
            seen[pathKey] = true;
            onMessage(mapDocToPayload(docSnap));
        }
    }, function(err) {
        console.warn('[radioService] band scan subscribe', err);
    });
}
