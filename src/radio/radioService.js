/**
 * Rádiové zprávy ve Firestore — kanál = hash(frekvence|šifra).
 */
import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { ensurePatracAuth } from '../services/authService.js';

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
    if (!payload || !payload.channelId) {
        throw new Error('Chybí kanál vysílání.');
    }
    var docPayload = {
        channelId: payload.channelId,
        frequency: payload.frequency || '',
        encryptionKey: payload.encryptionKey || '',
        scope: payload.scope || 'private',
        comCode: payload.comCode || '',
        senderId: payload.senderId || '',
        senderName: payload.senderName || 'Operativec',
        text: String(payload.text || '').trim(),
        timestamp: payload.timestamp || Date.now()
    };
    if (!docPayload.text) throw new Error('Prázdná zpráva.');

    var col = collection(getDb(), 'radio_channels', payload.channelId, 'messages');
    var ref = await addDoc(col, docPayload);
    return { id: ref.id, ...docPayload };
}

export function subscribeRadioChannels(channelIds, onMessage) {
    stopRadioSubscriptions();
    if (!Array.isArray(channelIds) || !channelIds.length) return;

    for (var i = 0; i < channelIds.length; i++) {
        (function(channelId) {
            if (!channelId || channelUnsubs[channelId]) return;
            var q = query(
                collection(getDb(), 'radio_channels', channelId, 'messages'),
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
                        frequency: data.frequency,
                        encryptionKey: data.encryptionKey,
                        scope: data.scope,
                        comCode: data.comCode,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        text: data.text,
                        timestamp: data.timestamp
                    });
                }
            }, function(err) {
                console.warn('[radioService] subscribe', channelId, err);
            });
        })(channelIds[i]);
    }
}

export function stopRadioSubscriptions() {
    for (var id in channelUnsubs) {
        if (!Object.prototype.hasOwnProperty.call(channelUnsubs, id)) continue;
        try { channelUnsubs[id](); } catch (e) {}
    }
    channelUnsubs = {};
}
