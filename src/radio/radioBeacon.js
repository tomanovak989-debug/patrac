/**
 * BEACON — SOS volání o pomoc.
 * Pevný kanál BEACON_SOS_FREQUENCY (450.000) — všechny vysílačky ho vždy poslouchají.
 * Live stav: radio_beacons (globálně). Pulzy: SMS/PTT na SOS frekvenci (PT, bez šifry).
 */
import { normalizeEncryptionKey, communityFrequencyFromCode } from './radioComms.js';
import { EMERGENCY_FREQUENCY, normalizeFrequency } from './radioBand.js';
import { decorateMenuLabel, findQuickKeyForAction } from './radioShortcuts.js';
import { buildBoundedCursorMenuLines } from './radioMenuScroll.js';
import { menuIconForItem } from './radioMenuIcons.js';

export var BEACON_REPEAT_MS = 18000;
/** Pevný SOS kanál majáku — default poslech na všech vysílačkách. */
export var BEACON_SOS_FREQUENCY = EMERGENCY_FREQUENCY;
export var BEACON_HUB = 'hub';
export var BEACON_CONFIRM = 'confirm';
export var BEACON_PTT_ARM = 'ptt_arm';

var STORAGE_PREFIX = 'patrac_beacon_active_';
var _remote = {};

function addFreq(set, list, value) {
    var f = normalizeFrequency(value);
    if (!f || set[f]) return;
    set[f] = true;
    list.push(f);
}

/** Frekvence pro beacon TX — vždy SOS kanál (+ volitelně naladěný/komunita jako záloha). */
export function beaconBroadcastFrequencies(opts) {
    opts = opts || {};
    var set = {};
    var list = [];
    addFreq(set, list, BEACON_SOS_FREQUENCY);
    if (opts.comCode) addFreq(set, list, communityFrequencyFromCode(opts.comCode));
    if (opts.tunedFrequency) addFreq(set, list, opts.tunedFrequency);
    if (opts.extras && opts.extras.length) {
        var i;
        for (i = 0; i < opts.extras.length; i++) addFreq(set, list, opts.extras[i]);
    }
    return list;
}

/** PTT beacon — také pevný SOS kanál (volání o pomoc musí dorazit spolehlivě). */
export function nextBeaconBroadcastFrequency(beacon) {
    return normalizeFrequency(BEACON_SOS_FREQUENCY);
}

function storageKey(comCode) {
    return STORAGE_PREFIX + String(comCode || '').trim().toUpperCase();
}

export function hasActiveRemoteBeacons() {
    pruneRemoteBeacons();
    for (var id in _remote) {
        if (Object.prototype.hasOwnProperty.call(_remote, id)) return true;
    }
    return false;
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

export function beaconLiveDocId(userId) {
    var id = String(userId || '').trim().replace(/[\/#\[\]]/g, '_');
    return id ? id.slice(0, 120) : '';
}

export function liveBeaconToPayload(docId, data) {
    if (!data) return null;
    var lat = data.lat != null ? data.lat : data.originLat;
    var lng = data.lng != null ? data.lng : data.originLng;
    return {
        id: 'beaconlive_' + (docId || data.senderId || ''),
        senderId: data.senderId || docId || '',
        senderName: data.senderName || data.label || 'Beacon',
        messageType: 'beacon',
        originLat: lat,
        originLng: lng,
        frequency: data.frequency,
        encryptionKey: '',
        text: data.text || 'BEACON',
        pttAudio: data.pttAudio || '',
        pttMime: data.pttMime || '',
        timestamp: data.updatedAt || data.startedAt || Date.now(),
        startedAt: data.startedAt || 0,
        live: true
    };
}

export function applyLiveBeaconSnapshot(docs, mySenderId, opts) {
    opts = opts || {};
    var incoming = [];
    var i;
    mySenderId = String(mySenderId || '').trim().toLowerCase();
    for (i = 0; i < (docs || []).length; i++) {
        var row = docs[i];
        if (!row) continue;
        var payload = row.payload || liveBeaconToPayload(row.id, row.data);
        if (!payload) continue;
        var sid = String(payload.senderId || '').trim().toLowerCase();
        /* Vlastní TX na TOMTO zařízení nepřidávej do remote (mapa už má local_).
           Stejný účet na druhém telefonu (localActive=false) maják uvidí. */
        if (mySenderId && sid && sid === mySenderId && opts.localActive) continue;
        if (!registerRemoteBeacon(payload)) continue;
        incoming.push(payload);
    }
    return incoming;
}

export function registerRemoteBeacon(payload) {
    if (!payload || payload.messageType !== 'beacon') return false;
    var lat = payload.originLat != null ? payload.originLat : payload.lat;
    var lng = payload.originLng != null ? payload.originLng : payload.lng;
    if (lat == null || lng == null) return false;
    if (!isFinite(Number(lat)) || !isFinite(Number(lng))) return false;
    var id = payload.senderId || payload.id || ('beacon_' + payload.timestamp);
    _remote[id] = {
        id: id,
        lat: Number(lat),
        lng: Number(lng),
        frequency: normalizeFrequency(payload.frequency) || BEACON_SOS_FREQUENCY,
        encryptionKey: normalizeEncryptionKey(payload.encryptionKey || ''),
        label: payload.senderName || payload.label || 'Beacon',
        messageType: payload.messageType,
        updatedAt: Date.now(),
        startedAt: payload.startedAt || payload.timestamp || Date.now(),
        text: payload.text || '',
        active: true
    };
    return true;
}

export function pruneRemoteBeacons(maxAgeMs) {
    maxAgeMs = maxAgeMs || BEACON_REPEAT_MS * 6;
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
            frequency: localBeacon.frequency || BEACON_SOS_FREQUENCY,
            label: localBeacon.label || 'Můj beacon',
            active: true,
            isLocal: true
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
            frequency: b.frequency || BEACON_SOS_FREQUENCY,
            label: b.label || 'Beacon',
            active: b.active !== false
        });
    }
    return out;
}

export function beaconHubItems(localBeacon) {
    var items = [
        { type: 'action', id: 'beacon_sms', label: '1 · SMS BEACON' },
        { type: 'action', id: 'beacon_ptt', label: '2 · PTT BEACON (PTT kolečko)' }
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

export function buildBeaconOsView(session, radioState, localBeacon, uiState) {
    session = session || createBeaconSession();
    uiState = uiState || {};
    var lines = [];
    var footer = 'OK · Zpět';
    var status = 'BEACON';
    var focusLine = -1;

    if (uiState.pttRecording) {
        lines = [
            'PTT BEACON',
            '● NAHRÁVÁM…',
            'Drž PTT kolečko',
            'Pusť = konec nahrávky',
            '',
            ''
        ];
        return {
            mode: 'beacon',
            status: 'BEACON · PTT TX',
            lines: lines,
            focusLine: -1,
            footer: 'Nahrávám…',
            buffer: ''
        };
    }

    if (session.screen === BEACON_PTT_ARM) {
        lines = [
            'PTT BEACON',
            'Drž střední PTT',
            'kolečko na klávesnici',
            'Tón = start hovoru',
            'Pusť = konec',
            ''
        ];
        return {
            mode: 'beacon',
            status: 'BEACON · PTT',
            lines: lines,
            focusLine: -1,
            footer: 'Drž PTT kolečko · Zpět',
            buffer: ''
        };
    }

    if (session.screen === BEACON_CONFIRM) {
        var kind = session.pendingType === 'ptt' ? 'PTT' : 'SMS';
        var bandLine = 'SOS · ' + BEACON_SOS_FREQUENCY + ' MHz';
        lines = [
            'SPUSTIT ' + kind + ' BEACON',
            bandLine,
            'Bez šifry · všichni v dosahu',
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
    var hubView = buildBoundedCursorMenuLines(items, session.focusIndex, function(item) {
        return decorateMenuLabel(item.label, findQuickKeyForAction(radioState, 'beacon:open'));
    }, function(item) {
        return menuIconForItem(item);
    });
    lines = hubView.lines;
    if (localBeacon && localBeacon.active) {
        lines[4] = '● SOS ' + BEACON_SOS_FREQUENCY;
        lines[5] = (isFinite(localBeacon.lat) ? 'GPS OK · ' : 'GPS? · ') + String(localBeacon.text || '').slice(0, 14);
    }
    focusLine = hubView.focusLine;

    return {
        mode: 'beacon',
        status: status,
        lines: lines,
        lineStyles: hubView.lineStyles,
        lineIcons: hubView.lineIcons,
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
        frequency: BEACON_SOS_FREQUENCY,
        encryptionKey: '',
        beaconBandcast: true,
        originLat: beacon.lat,
        originLng: beacon.lng,
        skipTxFx: !!extras.skipTxFx,
        isBeaconRepeat: !!extras.isBeaconRepeat
    };
}
