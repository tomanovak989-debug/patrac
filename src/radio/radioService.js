/**
 * Rádiové zprávy ve Firestore — kanál = frekvence (freq-first).
 * Cesta: radio_freq/{f_400025}/messages/{msgId}
 */
import { collection, collectionGroup, addDoc, setDoc, deleteDoc, doc, getDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { ensurePatracAuth, ensurePatracUserDoc, normalizePatracUserId } from '../services/authService.js';
import { ensureFirebaseAuth } from '../lib/firebase.js';
import { frequencyChannelId, normalizeFrequency } from './radioBand.js';

var channelUnsubs = {};
var radioListenStatus = { state: 'idle', detail: '', at: 0 };

export function getRadioListenStatus() {
    return radioListenStatus;
}

function setRadioListenStatus(state, detail) {
    radioListenStatus = { state: state, detail: detail || '', at: Date.now() };
}

async function ensureRadioAuth(requirePatrac) {
    try {
        var user = await ensurePatracAuth();
        return user;
    } catch (err) {
        if (requirePatrac) throw err;
        console.warn('[radioService] patrac auth, fallback firebase', err);
        var fb = await ensureFirebaseAuth();
        try { await ensurePatracUserDoc(fb); } catch (e2) {}
        return fb;
    }
}

export async function sendRadioTransmission(payload) {
    await ensureRadioAuth(true);
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
    if (payload.beaconBandcast) docPayload.beaconBandcast = true;
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
    try {
        await setDoc(doc(getDb(), 'radio_feed', ref.id), docPayload);
    } catch (feedErr) {
        console.warn('[radioService] radio_feed mirror', feedErr);
    }
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

function attachChannelListener(raw, onMessage) {
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
}

/**
 * @param {string[]} frequenciesOrIds — normalizované frekvence („400.025“) nebo id („f_400025“)
 * @param {(payload: object) => void} onMessage
 * @param {{ additive?: boolean }} opts
 * @returns {Promise<void>}
 */
export async function subscribeRadioChannels(frequenciesOrIds, onMessage, opts) {
    opts = opts || {};
    if (!opts.additive) stopRadioSubscriptions();
    if (!Array.isArray(frequenciesOrIds) || !frequenciesOrIds.length || !onMessage) return;

    await ensureRadioAuth(false);

    for (var i = 0; i < frequenciesOrIds.length; i++) {
        attachChannelListener(frequenciesOrIds[i], onMessage);
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
 * Poslech celého pásma — primárně flat kolekce radio_feed (bez collection-group indexu).
 * @param {{ backfillRecentMs?: number, additive?: boolean }} opts
 */
export async function subscribeRadioBandScan(onMessage, opts) {
    opts = opts || {};
    if (!opts.additive) stopRadioSubscriptions();
    if (!onMessage) return;
    if (channelUnsubs.__band_scan__) return Promise.resolve();

    var backfillRecentMs = opts.backfillRecentMs || 0;

    await ensureRadioAuth(false);

    var q = query(
        collection(getDb(), 'radio_feed'),
        orderBy('timestamp', 'desc'),
        limit(96)
    );
    return attachBandScanListener(q, onMessage, backfillRecentMs, '__band_scan__');
}

function attachBandScanListener(q, onMessage, backfillRecentMs, unsubKey) {
    return new Promise(function(resolve, reject) {
        var settled = false;
        var seen = {};
        var initialSnap = true;
        channelUnsubs[unsubKey] = onSnapshot(q, function(snap) {
            if (!settled) {
                settled = true;
                resolve();
            }
            if (initialSnap) {
                initialSnap = false;
                var i;
                if (backfillRecentMs > 0) {
                    var cutoff = Date.now() - backfillRecentMs;
                    var docs = snap.docs.slice().reverse();
                    for (i = 0; i < docs.length; i++) {
                        var docSnap = docs[i];
                        seen[docSnap.id] = true;
                        var ts = Number((docSnap.data() || {}).timestamp) || 0;
                        if (ts >= cutoff) {
                            onMessage(mapDocToPayload(docSnap));
                        }
                    }
                } else {
                    for (i = 0; i < snap.docs.length; i++) {
                        seen[snap.docs[i].id] = true;
                    }
                }
                return;
            }
            var changes = snap.docChanges();
            var c;
            for (c = 0; c < changes.length; c++) {
                if (changes[c].type !== 'added') continue;
                var docSnap = changes[c].doc;
                var pathKey = docSnap.id;
                if (seen[pathKey]) continue;
                seen[pathKey] = true;
                onMessage(mapDocToPayload(docSnap));
            }
        }, function(err) {
            console.warn('[radioService] band scan subscribe', err);
            if (!settled) {
                settled = true;
                reject(err);
            }
        });
    });
}

/** Záloha — collection group (vyžaduje nasazený Firestore index). */
export async function subscribeRadioBandScanLegacy(onMessage, opts) {
    opts = opts || {};
    if (!opts.additive) stopRadioSubscriptions();
    if (!onMessage) return;
    if (channelUnsubs.__band_scan_legacy__) return Promise.resolve();

    var backfillRecentMs = opts.backfillRecentMs || 0;
    await ensureRadioAuth(false);

    var q = query(
        collectionGroup(getDb(), 'messages'),
        orderBy('timestamp', 'desc'),
        limit(96)
    );
    return attachBandScanListener(q, onMessage, backfillRecentMs, '__band_scan_legacy__');
}

/**
 * Poslech naladěných kanálů + volitelný band scan (oba najednou, deduplikace v ingest).
 * @param {{ frequencies?: string[], backfillRecentMs?: number }} opts
 */
export async function subscribeRadioListen(onMessage, opts) {
    stopRadioSubscriptions();
    if (!onMessage) return;

    opts = opts || {};
    setRadioListenStatus('connecting', '');
    await ensureRadioAuth(false);

    var freqs = Array.isArray(opts.frequencies) ? opts.frequencies : [];
    for (var i = 0; i < freqs.length; i++) {
        attachChannelListener(freqs[i], onMessage);
    }

    var bandOk = false;
    try {
        await subscribeRadioBandScan(onMessage, {
            additive: true,
            backfillRecentMs: opts.backfillRecentMs || 0
        });
        bandOk = true;
    } catch (err) {
        console.warn('[radioService] band scan unavailable, channels only', err);
        setRadioListenStatus('partial', String(err && err.message ? err.message : err));
    }
    if (bandOk) {
        setRadioListenStatus('ok', freqs.length + ' kan + feed');
    } else if (freqs.length) {
        setRadioListenStatus('partial', freqs.length + ' kan');
    } else {
        setRadioListenStatus('error', 'žádný kanál');
    }
}

function beaconLiveId(senderId) {
    var id = normalizePatracUserId(senderId);
    return id ? id.slice(0, 120) : '';
}

async function resolveBeaconSenderId(preferred) {
    var authUser = await ensureRadioAuth(true);
    try { await ensurePatracUserDoc(authUser); } catch (e0) {}
    var fromSession = beaconLiveId(preferred);
    if (!fromSession && typeof localStorage !== 'undefined') {
        fromSession = beaconLiveId(localStorage.getItem('patrac_session'));
    }
    var fromUsers = '';
    try {
        if (authUser && authUser.uid) {
            var snap = await getDoc(doc(getDb(), 'users', authUser.uid));
            if (snap.exists()) {
                fromUsers = beaconLiveId((snap.data() || {}).patracUserId);
            }
        }
    } catch (e) {
        console.warn('[radioService] resolve beacon sender', e);
    }
    var id = fromUsers || fromSession;
    if (!id) {
        throw new Error('Chybí patracUserId ve users/{uid} — odhlás se a přihlas znovu.');
    }
    /* Sjednoť users.patracUserId s ID beacon dokumentu (malá písmena). */
    if (authUser && authUser.uid && fromUsers !== id) {
        try {
            await setDoc(doc(getDb(), 'users', authUser.uid), {
                patracUserId: id,
                updatedAt: Date.now()
            }, { merge: true });
        } catch (e2) {
            console.warn('[radioService] sync patracUserId', e2);
        }
    }
    return id;
}

export async function upsertRadioBeaconLive(beacon) {
    var id = await resolveBeaconSenderId(beacon && beacon.senderId);
    if (!id) throw new Error('Beacon vyžaduje přihlášení (chybí user id).');
    if (beacon.lat == null || beacon.lng == null ||
        !isFinite(Number(beacon.lat)) || !isFinite(Number(beacon.lng))) {
        throw new Error('Beacon potřebuje GPS.');
    }
    var payload = {
        senderId: id,
        senderName: String(beacon.label || beacon.senderName || 'Beacon'),
        lat: Number(beacon.lat),
        lng: Number(beacon.lng),
        originLat: Number(beacon.lat),
        originLng: Number(beacon.lng),
        frequency: normalizeFrequency(beacon.frequency) || '',
        text: String(beacon.text || 'BEACON').slice(0, 80),
        messageType: 'beacon',
        active: true,
        startedAt: Number(beacon.startedAt) || Date.now(),
        updatedAt: Date.now(),
        comCode: String(beacon.comCode || '')
    };
    /* PTT audio neukládat do live doc — zbytečně velké a rules/limits. */
    await setDoc(doc(getDb(), 'radio_beacons', id), payload, { merge: true });
    return { id: id, ...payload };
}

export async function clearRadioBeaconLive(senderId) {
    var id = await resolveBeaconSenderId(senderId);
    if (!id) return;
    try {
        await deleteDoc(doc(getDb(), 'radio_beacons', id));
    } catch (err) {
        console.warn('[radioService] clear beacon live', err);
    }
}

export function subscribeRadioBeaconsLive(onSnapshotAll) {
    if (channelUnsubs.__beacons_live__) {
        try { channelUnsubs.__beacons_live__(); } catch (e) {}
        delete channelUnsubs.__beacons_live__;
    }
    if (!onSnapshotAll) return Promise.resolve();
    return ensureRadioAuth(false).then(function() {
        var col = collection(getDb(), 'radio_beacons');
        channelUnsubs.__beacons_live__ = onSnapshot(col, function(snap) {
            var docs = [];
            snap.forEach(function(docSnap) {
                var data = docSnap.data() || {};
                if (data.active === false) return;
                docs.push({ id: docSnap.id, data: data });
            });
            onSnapshotAll(docs);
        }, function(err) {
            console.warn('[radioService] radio_beacons subscribe', err);
        });
    });
}
