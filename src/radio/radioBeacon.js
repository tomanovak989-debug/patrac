/**
 * BEACON — opakované vysílání SMS/PTT na naladěném kanálu (freq + šifra).
 * Příjem: naladěný kanál + autosken (aktivita v pásmu, dosahová matice).
 */
import { normalizeFrequency, normalizeEncryptionKey } from './radioComms.js';

export var BEACON_REPEAT_MS = 18000;
export var BEACON_HUB = 'hub';
export var BEACON_CONFIRM = 'confirm';

var STORAGE_PREFIX = 'patrac_beacon_active_';
var _remote = {};

function storageKey(comCode) {
    return STORAGE_PREFIX + String(comCode || '').trim().toUpperCase();
}

export function createBeaconSession() {
    return {
        screen: BEACON_HUB,
        focusIndex: 0,
        pendingText: '',
        pendingType: 'sms',
        pendingPttAudio: '',
        pendingPttMime: ''
    };
}

export function loadLocalBeacon(comCode) {
    try {
        var raw = localStorage.getItem(storageKey(comCode));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.active) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

export function saveLocalBeacon(comCode, beacon) {
    comCode = String(comCode || '').trim().toUpperCase();
    try {
        if (!beacon || !beacon.active) {
            localStorage.removeItem(storageKey(comCode));
            return null;
        }
        localStorage.setItem(storageKey(comCode), JSON.stringify(beacon));
        return beacon;
    } catch (e) {
        return beacon;
    }
}

export function clearLocalBeacon(comCode) {
    try { localStorage.removeItem(storageKey(comCode)); } catch (e) {}
}

export function registerRemoteBeacon(payload) {
    if (!payload || payload.messageType !== 'beacon') return;
    if (payload.originLat == null || payload.originLng == null) return;
    if (!isFinite(Number(payload.originLat)) || !isFinite(Number(payload.originLng))) return;
    var id = payload.senderId || payload.id || ('beacon_' + payload.timestamp);
    _remote[id] = {
        id: id,
        lat: Number(payload.originLat),
        lng: Number(payload.originLng),
        frequency: normalizeFrequency(payload.frequency),
        encryptionKey: normalizeEncryptionKey(payload.encryptionKey || ''),
        label: payload.senderName || 'Beacon',
        messageType: payload.messageType,
        updatedAt: payload.timestamp || Date.now(),
        active: true
    };
}

export function pruneRemoteBeacons(maxAgeMs) {
    maxAgeMs = maxAgeMs || BEACON_REPEAT_MS * 3;
    var now = Date.now();
    for (var id in _remote) {
        if (!Object.prototype.hasOwnProperty.call(_remote, id)) continue;
        if (now - (_remote[id].updatedAt || 0) > maxAgeMs) delete _remote[id];
    }
}

export function getMapBeacons(comCode, localBeacon) {
    pruneRemoteBeacons();
    var out = [];
    if (localBeacon && localBeacon.active && isFinite(localBeacon.lat) && isFinite(localBeacon.lng)) {
        out.push({
            id: 'local_' + (localBeacon.senderId || 'me'),
            lat: localBeacon.lat,
            lng: localBeacon.lng,
            frequency: localBeacon.frequency,
            label: localBeacon.label || 'Můj beacon',
            active: true
        });
    }
    for (var id in _remote) {
        if (!Object.prototype.hasOwnProperty.call(_remote, id)) continue;
        var b = _remote[id];
        if (!b || !isFinite(b.lat) || !isFinite(b.lng)) continue;
        out.push({
            id: b.id,
            lat: b.lat,
            lng: b.lng,
            frequency: b.frequency,
            label: b.label || 'Beacon',
            active: b.active !== false
        });
    }
    return out;
}

export function beaconHubItems(localBeacon) {
    var items = [
        { type: 'action', id: 'beacon_sms', label: '1 · SMS BEACON' },
        { type: 'action', id: 'beacon_ptt', label: '2 · PTT BEACON' }
    ];
    if (localBeacon && localBeacon.active) {
        items.push({ type: 'action', id: 'beacon_stop', label: '3 · ZASTAVIT BEACON' });
    }
    return items;
}

export function getFocusedBeaconAction(session, localBeacon) {
    var items = beaconHubItems(localBeacon);
    if (!items.length) return null;
    var idx = session && session.focusIndex != null ? session.focusIndex : 0;
    if (idx < 0) idx = 0;
    if (idx >= items.length) idx = items.length - 1;
    return items[idx];
}

export function clampBeaconFocus(session, localBeacon) {
    var items = beaconHubItems(localBeacon);
    if (!session) return items;
    if (!items.length) {
        session.focusIndex = 0;
        return items;
    }
    if (session.focusIndex < 0) session.focusIndex = 0;
    if (session.focusIndex >= items.length) session.focusIndex = items.length - 1;
    return items;
}

export function buildBeaconOsView(session, radioState, localBeacon) {
    session = session || createBeaconSession();
    var lines = [];
    var footer = 'OK · Zpět';
    var status = 'BEACON';
    var focusLine = -1;

    if (session.screen === BEACON_CONFIRM) {
        var kind = session.pendingType === 'ptt' ? 'PTT' : 'SMS';
        lines = [
            'SPUSTIT ' + kind + ' BEACON',
            normalizeFrequency(radioState && radioState.frequency) + ' MHz',
            (radioState && radioState.encryptionKey) ? 'CT · šifrováno' : 'PT · otevřený',
            String(session.pendingText || '').slice(0, 18),
            'Opakuje se do vypnutí',
            ''
        ];
        return {
            mode: 'beacon',
            status: 'BEACON · POTVRzení',
            lines: lines,
            focusLine: session.focusIndex,
            footer: 'OK spustit · Zpět',
            buffer: ''
        };
    }

    var items = clampBeaconFocus(session, localBeacon);
    var start = 0;
    if (session.focusIndex >= 4) start = session.focusIndex - 3;
    if (start + 4 > items.length) start = Math.max(0, items.length - 4);
    var i;
    for (i = 0; i < 4; i++) {
        var idx = start + i;
        lines.push(idx < items.length ? items[idx].label : '');
    }
    lines.push('');
    lines.push('');
    if (localBeacon && localBeacon.active) {
        lines[4] = '● VYSÍLÁ · ' + (localBeacon.messageType === 'ptt' ? 'PTT' : 'SMS');
        lines[5] = String(localBeacon.text || '').slice(0, 18);
    }
    focusLine = items.length ? session.focusIndex - start : -1;

    return {
        mode: 'beacon',
        status: status,
        lines: lines,
        focusLine: focusLine,
        footer: footer,
        buffer: ''
    };
}

export function buildBeaconPayload(beacon, extras) {
    extras = extras || {};
    return {
        messageType: 'beacon',
        text: beacon.text,
        pttAudio: beacon.pttAudio || '',
        pttMime: beacon.pttMime || '',
        frequency: beacon.frequency,
        encryptionKey: beacon.encryptionKey || '',
        originLat: beacon.lat,
        originLng: beacon.lng,
        skipTxFx: !!extras.skipTxFx,
        isBeaconRepeat: !!extras.isBeaconRepeat
    };
}
