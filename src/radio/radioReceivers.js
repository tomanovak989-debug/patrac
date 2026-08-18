/**
 * F4 — komunitní receivery jako uložitelné body mapy (frekvence + šifra).
 */
import { fetchElevationsM } from './radioElevation.js';
import { normalizeFrequency } from './radioComms.js';
import { parseFrequencyMHz, isInBand } from './radioBand.js';

export var RX_KIND_RECEIVER = 'receiver';
export var RX_KIND_REPEATER = 'repeater';

var STORAGE_KEY = 'patrac_radio_receivers_v1';
var MAX_RECEIVERS = 24;

function loadAll() {
    try {
        var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
        return {};
    }
}

function saveAll(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
    } catch (e) {}
}

function normalizeKey(key) {
    return String(key || '').trim();
}

export function normalizeReceiverFrequency(raw) {
    var n = parseFrequencyMHz(raw);
    if (!isFinite(n) || !isInBand(n)) return null;
    return normalizeFrequency(n);
}

export function channelsMatch(freqA, keyA, freqB, keyB) {
    var fa = normalizeReceiverFrequency(freqA);
    var fb = normalizeReceiverFrequency(freqB);
    if (!fa || !fb || fa !== fb) return false;
    return normalizeKey(keyA) === normalizeKey(keyB);
}

export function listReceivers(comCode) {
    comCode = String(comCode || '').trim();
    if (!comCode) return [];
    var all = loadAll();
    var list = Array.isArray(all[comCode]) ? all[comCode] : [];
    return list.filter(function(r) {
        return r && isFinite(r.lat) && isFinite(r.lng) && r.frequency;
    });
}

export function getReceiverById(comCode, id) {
    var list = listReceivers(comCode);
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) return list[i];
    }
    return null;
}

function writeReceivers(comCode, list) {
    comCode = String(comCode || '').trim();
    if (!comCode) return [];
    var all = loadAll();
    all[comCode] = list;
    saveAll(all);
    return list;
}

export function removeReceiver(comCode, id) {
    var list = listReceivers(comCode);
    list = list.filter(function(r) { return r.id !== id; });
    return writeReceivers(comCode, list);
}

/**
 * @param {string} comCode
 * @param {{ lat:number, lng:number, label?:string, frequency:string, encryptionKey?:string, kind?:string }} opts
 */
export async function installReceiver(comCode, opts) {
    opts = opts || {};
    comCode = String(comCode || '').trim();
    if (!comCode) throw new Error('Chybí kód komunity.');
    if (!isFinite(opts.lat) || !isFinite(opts.lng)) throw new Error('Neplatné souřadnice.');

    var frequency = normalizeReceiverFrequency(opts.frequency);
    if (!frequency) throw new Error('Frekvence musí být v pásmu 400–470 MHz.');

    var list = loadAll()[comCode] || [];
    if (list.length >= MAX_RECEIVERS) throw new Error('Limit receiverů (' + MAX_RECEIVERS + ').');

    var elevs = await fetchElevationsM([{ lat: opts.lat, lng: opts.lng }]);
    var elevationM = elevs[0] != null ? elevs[0] : 0;
    var kind = opts.kind === RX_KIND_REPEATER ? RX_KIND_REPEATER : RX_KIND_RECEIVER;
    var entry = {
        id: 'rx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        lat: opts.lat,
        lng: opts.lng,
        elevationM: elevationM,
        label: String(opts.label || 'Receiver').slice(0, 24),
        kind: kind,
        frequency: frequency,
        encryptionKey: normalizeKey(opts.encryptionKey),
        ownerComCode: comCode,
        installedAt: Date.now(),
        updatedAt: Date.now()
    };
    list.unshift(entry);
    writeReceivers(comCode, list);
    return entry;
}

export async function updateReceiver(comCode, id, patch) {
    patch = patch || {};
    comCode = String(comCode || '').trim();
    var all = loadAll();
    var list = Array.isArray(all[comCode]) ? all[comCode].slice() : [];
    var idx = -1;
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) {
            idx = i;
            break;
        }
    }
    if (idx < 0) throw new Error('Receiver nenalezen.');

    var cur = list[idx];
    if (patch.label != null) cur.label = String(patch.label).slice(0, 24);
    if (patch.frequency != null) {
        var freq = normalizeReceiverFrequency(patch.frequency);
        if (!freq) throw new Error('Frekvence musí být v pásmu 400–470 MHz.');
        cur.frequency = freq;
    }
    if (patch.encryptionKey != null) cur.encryptionKey = normalizeKey(patch.encryptionKey);
    if (patch.kind != null) {
        cur.kind = patch.kind === RX_KIND_REPEATER ? RX_KIND_REPEATER : RX_KIND_RECEIVER;
    }
    cur.updatedAt = Date.now();
    list[idx] = cur;
    writeReceivers(comCode, list);
    return cur;
}

export async function refreshReceiverElevations(comCode) {
    var list = listReceivers(comCode);
    if (!list.length) return list;
    var elevs = await fetchElevationsM(list.map(function(r) { return { lat: r.lat, lng: r.lng }; }));
    var all = loadAll();
    var rawList = Array.isArray(all[comCode]) ? all[comCode] : [];
    var changed = false;
    for (var i = 0; i < rawList.length; i++) {
        var rx = rawList[i];
        if (!rx) continue;
        var j = list.indexOf(rx);
        if (j < 0 || elevs[j] == null) continue;
        if (rawList[i].elevationM !== elevs[j]) {
            rawList[i].elevationM = elevs[j];
            changed = true;
        }
    }
    if (changed) writeReceivers(comCode, rawList);
    return listReceivers(comCode);
}

export function receiverAsNode(rx) {
    if (!rx) return null;
    return {
        id: rx.id,
        kind: 'receiver',
        lat: rx.lat,
        lng: rx.lng,
        elevationM: rx.elevationM != null ? rx.elevationM : 0,
        label: rx.label || 'Receiver',
        rxKind: rx.kind || RX_KIND_RECEIVER,
        frequency: rx.frequency || '',
        encryptionKey: rx.encryptionKey || '',
        ownerComCode: rx.ownerComCode || ''
    };
}

export function listReceiverNodes(comCode, channel) {
    var nodes = listReceivers(comCode).map(receiverAsNode).filter(Boolean);
    if (!channel || !channel.frequency) return nodes;
    return nodes.filter(function(n) {
        return channelsMatch(n.frequency, n.encryptionKey, channel.frequency, channel.encryptionKey);
    });
}

export function formatReceiverChannelLabel(rx) {
    if (!rx) return '—';
    var freq = rx.frequency || '---.---';
    var key = normalizeKey(rx.encryptionKey);
    return freq + ' MHz · ' + (key ? 'CT' : 'PT');
}
