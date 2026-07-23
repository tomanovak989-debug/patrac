/**
 * Rádiové zprávy ve Firestore — kanál = frekvence (freq-first).
 * Cesta: radio_freq/{f_400025}/messages/{msgId}
 */
import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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
    if (payload.originLat != null && payload.originLng != null &&
        isFinite(Number(payload.originLat)) && isFinite(Number(payload.originLng))) {
        docPayload.originLat = Number(payload.originLat);
        docPayload.originLng = Number(payload.originLng);
    }
    if (!docPayload.text) throw new Error('Prázdná zpráva.');

    var col = collection(getDb(), 'radio_freq', channelId, 'messages');
    var ref = await addDoc(col, docPayload);
    return { id: ref.id, ...docPayload };
}

/**
 * @param {string[]} frequenciesOrIds — normalizované frekvence („400.025“) nebo id („f_400025“)
 */
export function subscribeRadioChannels(frequenciesOrIds, onMessage) {
    stopRadioSubscriptions();
    if (!Array.isArray(frequenciesOrIds) || !frequenciesOrIds.length) return;

    for (var i = 0; i < frequenciesOrIds.length; i++) {
        (function(raw) {
            var freq = normalizeFrequency(raw);
            var channelId = freq ? frequencyChannelId(freq) : String(raw || '');
            if (!channelId || channelUnsubs[channelId]) return;
            if (!freq && channelId.indexOf('f_') === 0) {
                /* id už je f_XXXXXX */
            } else if (!freq) {
                return;
            }

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
                    for (var s = 0; s < snap.docs.length; s++) {
                        seen[snap.docs[s].id] = true;
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
                    var data = docSnap.data();
                    onMessage({
                        id: msgId,
                        channelId: channelId,
                        frequency: data.frequency || freq,
                        encryptionKey: data.encryptionKey,
                        scope: data.scope,
                        comCode: data.comCode,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        text: data.text,
                        timestamp: data.timestamp,
                        originLat: data.originLat,
                        originLng: data.originLng
                    });
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
