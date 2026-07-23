/**
 * Dosah a kvalita rádiového signálu podle vzdálenosti
 * (útočiště odesílatele ↔ pozice hráče / příjemce).
 *
 * Prahy:
 *   ≤ 5 km     → clear     (plný plaintext)
 *   ≤ 7.5 km   → weak      (ořezaný text / vypadávající znaky)
 *   ≤ 10 km    → fragment  (chyby, sem tam útržky zprávy)
 *   ≤ 12.5 km  → noise     (šum / anomálie bez obsahu)
 *   > 12.5 km  → none      (mimo dosah, žádný příjem)
 */

export var SIGNAL_CLEAR = 'clear';
export var SIGNAL_WEAK = 'weak';
export var SIGNAL_FRAGMENT = 'fragment';
export var SIGNAL_NOISE = 'noise';
export var SIGNAL_NONE = 'none';

/** Horní meze pásem v km (včetně). */
export var RANGE_KM = {
    CLEAR_MAX: 5,
    WEAK_MAX: 7.5,
    FRAGMENT_MAX: 10,
    NOISE_MAX: 12.5
};

var EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(function(v) { return typeof v === 'number' && isFinite(v); })) {
        return NaN;
    }
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseLatLng(point) {
    if (!point) return null;
    var lat = typeof point.lat === 'number' ? point.lat : parseFloat(point.lat);
    var lng = typeof point.lng === 'number' ? point.lng : parseFloat(point.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat: lat, lng: lng };
}

/**
 * @returns {{ quality: string, distanceKm: number|null, receivable: boolean, reason?: string }}
 */
export function evaluateRadioReception(origin, receiver) {
    var from = parseLatLng(origin);
    var to = parseLatLng(receiver);
    if (!from || !to) {
        /* Bez GPS/útočiště neshazovat provoz — lokální / stejné zařízení by jinak
           nikdy nezapsalo příchozí do staničníku. Dosah se uplatní, až budou coords. */
        return {
            quality: SIGNAL_CLEAR,
            distanceKm: 0,
            receivable: true,
            reason: 'missing_coords_assumed_local'
        };
    }

    var km = haversineKm(from.lat, from.lng, to.lat, to.lng);
    if (!isFinite(km)) {
        return {
            quality: SIGNAL_NONE,
            distanceKm: null,
            receivable: false,
            reason: 'bad_distance'
        };
    }

    var quality;
    if (km <= RANGE_KM.CLEAR_MAX) quality = SIGNAL_CLEAR;
    else if (km <= RANGE_KM.WEAK_MAX) quality = SIGNAL_WEAK;
    else if (km <= RANGE_KM.FRAGMENT_MAX) quality = SIGNAL_FRAGMENT;
    else if (km <= RANGE_KM.NOISE_MAX) quality = SIGNAL_NOISE;
    else quality = SIGNAL_NONE;

    return {
        quality: quality,
        distanceKm: Math.round(km * 100) / 100,
        receivable: quality !== SIGNAL_NONE
    };
}

function hashSeed(str) {
    var h = 2166136261;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function nextRnd(rnd) {
    return (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
}

/**
 * Slabý signál (5–7.5 km): vypadávající písmena.
 * Čím blíž k 7.5 km, tím víc výpadků (~20–55 %).
 */
export function garbleRadioText(text, distanceKm, seed) {
    var raw = String(text || '');
    if (!raw) return '';
    var span = RANGE_KM.WEAK_MAX - RANGE_KM.CLEAR_MAX;
    var t = span > 0
        ? Math.min(1, Math.max(0, (Number(distanceKm) - RANGE_KM.CLEAR_MAX) / span))
        : 0.5;
    var dropRate = 0.2 + t * 0.35;
    var rnd = hashSeed(seed || raw);
    var out = '';
    for (var i = 0; i < raw.length; i++) {
        var ch = raw.charAt(i);
        if (/\s/.test(ch)) {
            out += ch;
            continue;
        }
        rnd = nextRnd(rnd);
        if ((rnd % 1000) / 1000 < dropRate) out += '·';
        else out += ch;
    }
    return out;
}

/**
 * Útržky (7.5–10 km): sem tam krátké čitelné fragmenty, zbytek chyby/mezery.
 */
export function fragmentRadioText(text, distanceKm, seed) {
    var raw = String(text || '');
    if (!raw) return '';
    var span = RANGE_KM.FRAGMENT_MAX - RANGE_KM.WEAK_MAX;
    var t = span > 0
        ? Math.min(1, Math.max(0, (Number(distanceKm) - RANGE_KM.WEAK_MAX) / span))
        : 0.5;
    /* Podíl zachovaných útržků klesá s vzdáleností (~35 % → ~12 %). */
    var keepChance = 0.35 - t * 0.23;
    var rnd = hashSeed('frag:' + (seed || raw));
    var out = '';
    var i = 0;
    while (i < raw.length) {
        var ch = raw.charAt(i);
        if (/\s/.test(ch)) {
            out += ' ';
            i++;
            continue;
        }
        rnd = nextRnd(rnd);
        if ((rnd % 1000) / 1000 < keepChance) {
            rnd = nextRnd(rnd);
            var run = 2 + (rnd % 4); /* 2–5 znaků */
            var kept = 0;
            while (i < raw.length && kept < run) {
                var c = raw.charAt(i);
                if (/\s/.test(c)) break;
                out += c;
                i++;
                kept++;
            }
            out += '…';
        } else {
            out += '·';
            i++;
            rnd = nextRnd(rnd);
            var skip = 1 + (rnd % 3);
            while (skip > 0 && i < raw.length && !/\s/.test(raw.charAt(i))) {
                out += '·';
                i++;
                skip--;
            }
        }
    }
    return out.replace(/\s+/g, ' ').replace(/·{4,}/g, '···').trim();
}

export function noisePlaceholder(frequency) {
    var freq = frequency ? String(frequency) : '???';
    return '≈≈ šum / anomálie · ' + freq + ' ≈≈';
}

/**
 * Připraví text (a meta) pro zápis do staničníku podle kvality příjmu.
 * @returns {{ text: string, signalQuality: string, distanceKm: number|null } | null}
 *   null = mimo dosah (nezapisovat)
 */
export function applyReceptionToMessage(plainText, reception, opts) {
    opts = opts || {};
    if (!reception || !reception.receivable) return null;

    var quality = reception.quality;
    var km = reception.distanceKm;
    var seed = opts.seed || plainText;

    if (quality === SIGNAL_CLEAR) {
        return {
            text: String(plainText || ''),
            signalQuality: SIGNAL_CLEAR,
            distanceKm: km
        };
    }
    if (quality === SIGNAL_WEAK) {
        return {
            text: garbleRadioText(plainText, km, seed),
            signalQuality: SIGNAL_WEAK,
            distanceKm: km
        };
    }
    if (quality === SIGNAL_FRAGMENT) {
        return {
            text: fragmentRadioText(plainText, km, seed),
            signalQuality: SIGNAL_FRAGMENT,
            distanceKm: km
        };
    }
    if (quality === SIGNAL_NOISE) {
        return {
            text: noisePlaceholder(opts.frequency),
            signalQuality: SIGNAL_NOISE,
            distanceKm: km
        };
    }
    return null;
}
