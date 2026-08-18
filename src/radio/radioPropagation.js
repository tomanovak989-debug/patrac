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

/** Horní meze pásem v km (včetně) — základ pro výšku 0 m. */
export var RANGE_KM = {
    CLEAR_MAX: 5,
    WEAK_MAX: 7.5,
    FRAGMENT_MAX: 10,
    NOISE_MAX: 12.5
};

/** Max. bonus dosahu z nadmořské výšky (+50 % při ~500 m). */
export var ELEV_RANGE_BONUS_CAP = 0.5;

var EARTH_RADIUS_KM = 6371;
var QUALITY_RANK = {
    clear: 4,
    weak: 3,
    fragment: 2,
    noise: 1,
    none: 0
};

export function elevationRangeMultiplier(elevationM) {
    var elev = Number(elevationM);
    if (!isFinite(elev) || elev <= 0) return 1;
    return 1 + Math.min(ELEV_RANGE_BONUS_CAP, elev / 1000);
}

/**
 * Efektivní vzdálenost pro pásmo — výška obou konců zkracuje „virtuální“ km.
 */
export function effectiveDistanceKm(km, originElevM, receiverElevM) {
    if (!isFinite(km)) return km;
    var scale = Math.max(
        elevationRangeMultiplier(originElevM),
        elevationRangeMultiplier(receiverElevM)
    );
    return km / scale;
}

/**
 * Zjednodušená kontrola LoS — přímka vs. terén ve středu + zakřivení Země.
 */
export function hasRadioLineOfSight(distanceKm, originElevM, receiverElevM, midElevM) {
    if (!isFinite(distanceKm) || distanceKm <= 0) return true;
    if (midElevM == null || !isFinite(midElevM)) return true;
    var h1 = (Number(originElevM) || 0) + 2.0;
    var h2 = (Number(receiverElevM) || 0) + 1.5;
    var lineH = (h1 + h2) / 2;
    var bulge = (distanceKm * 1000) * (distanceKm * 1000) / (8 * 6371000);
    return lineH > midElevM + bulge + 8;
}

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
 * @returns {{ quality: string, distanceKm: number|null, receivable: boolean, reason?: string, lineOfSight?: boolean, viaRelay?: string|null }}
 */
export function evaluateRadioReception(origin, receiver, opts) {
    opts = opts || {};
    var from = parseLatLng(origin);
    var to = parseLatLng(receiver);
    if (!from || !to) {
        return {
            quality: SIGNAL_CLEAR,
            distanceKm: 0,
            receivable: true,
            reason: 'missing_coords_assumed_local',
            lineOfSight: true,
            viaRelay: null
        };
    }

    var km = haversineKm(from.lat, from.lng, to.lat, to.lng);
    if (!isFinite(km)) {
        return {
            quality: SIGNAL_NONE,
            distanceKm: null,
            receivable: false,
            reason: 'bad_distance',
            lineOfSight: false,
            viaRelay: null
        };
    }

    var originElev = opts.originElevM != null ? opts.originElevM : (from.elevationM != null ? from.elevationM : 0);
    var receiverElev = opts.receiverElevM != null ? opts.receiverElevM : (to.elevationM != null ? to.elevationM : 0);
    var midElev = opts.midElevM;
    var los = opts.skipLos === true ? true : hasRadioLineOfSight(km, originElev, receiverElev, midElev);

    var effKm = effectiveDistanceKm(km, originElev, receiverElev);
    var quality;
    if (!los) quality = SIGNAL_NOISE;
    else if (effKm <= RANGE_KM.CLEAR_MAX) quality = SIGNAL_CLEAR;
    else if (effKm <= RANGE_KM.WEAK_MAX) quality = SIGNAL_WEAK;
    else if (effKm <= RANGE_KM.FRAGMENT_MAX) quality = SIGNAL_FRAGMENT;
    else if (effKm <= RANGE_KM.NOISE_MAX) quality = SIGNAL_NOISE;
    else quality = SIGNAL_NONE;

    return {
        quality: quality,
        distanceKm: Math.round(km * 100) / 100,
        effectiveKm: Math.round(effKm * 100) / 100,
        receivable: quality !== SIGNAL_NONE,
        lineOfSight: los,
        viaRelay: null,
        reason: !los ? 'blocked_los' : undefined
    };
}

/** Zesílení signálu přes receiver na shodném kanálu (zkrácení efektivní vzdálenosti). */
export var RELAY_AMPLIFY_FACTOR = 0.82;

function relayMatchesChannel(relay, channel) {
    if (!relay || !channel || !channel.frequency) return false;
    var rf = relay.frequency || '';
    var rk = relay.encryptionKey || '';
    var cf = channel.frequency || '';
    var ck = channel.encryptionKey != null ? channel.encryptionKey : '';
    if (!rf || !cf) return false;
    if (String(rf) !== String(cf)) return false;
    return String(rk || '') === String(ck || '');
}

function worseQuality(a, b) {
    var ra = QUALITY_RANK[a] || 0;
    var rb = QUALITY_RANK[b] || 0;
    return ra <= rb ? a : b;
}

function qualityForEffectiveKm(effKm, los) {
    if (!los) return SIGNAL_NOISE;
    if (effKm <= RANGE_KM.CLEAR_MAX) return SIGNAL_CLEAR;
    if (effKm <= RANGE_KM.WEAK_MAX) return SIGNAL_WEAK;
    if (effKm <= RANGE_KM.FRAGMENT_MAX) return SIGNAL_FRAGMENT;
    if (effKm <= RANGE_KM.NOISE_MAX) return SIGNAL_NOISE;
    return SIGNAL_NONE;
}

function combineRelayReception(legA, legB, relayId) {
    if (!legA || !legB || !legA.receivable || !legB.receivable) return null;
    var quality = worseQuality(legA.quality, legB.quality);
    var dist = (legA.distanceKm || 0) + (legB.distanceKm || 0);
    var eff = (legA.effectiveKm || legA.distanceKm || 0) + (legB.effectiveKm || legB.distanceKm || 0);
    return {
        quality: quality,
        distanceKm: Math.round(dist * 100) / 100,
        effectiveKm: Math.round(eff * 100) / 100,
        receivable: quality !== SIGNAL_NONE,
        lineOfSight: !!(legA.lineOfSight && legB.lineOfSight),
        viaRelay: relayId || null,
        reason: 'via_relay'
    };
}

/**
 * Přímý příjem nebo přes nejlepší receiver/repeater v síti.
 * @param {object} origin — {lat,lng,elevationM?}
 * @param {object} receiver — {lat,lng,elevationM?}
 * @param {{ relays?: object[], pathElevs?: {fromM,toM,midM}, skipLos?: boolean }} opts
 */
export function evaluateBestRadioReception(origin, receiver, opts) {
    opts = opts || {};
    var directOpts = {
        originElevM: opts.originElevM,
        receiverElevM: opts.receiverElevM,
        midElevM: opts.pathElevs ? opts.pathElevs.midM : opts.midElevM,
        skipLos: opts.skipLos
    };
    if (opts.pathElevs) {
        directOpts.originElevM = opts.pathElevs.fromM;
        directOpts.receiverElevM = opts.pathElevs.toM;
    }
    var best = evaluateRadioReception(origin, receiver, directOpts);
    var relays = opts.relays || [];
    var channel = opts.channel || null;
    var i;
    for (i = 0; i < relays.length; i++) {
        var relay = relays[i];
        if (!relay || !isFinite(relay.lat) || !isFinite(relay.lng)) continue;
        if (channel && !relayMatchesChannel(relay, channel)) continue;
        var leg1 = evaluateRadioReception(origin, relay, {
            originElevM: directOpts.originElevM,
            receiverElevM: relay.elevationM,
            skipLos: opts.skipLos
        });
        if (!leg1.receivable) continue;
        var leg2 = evaluateRadioReception(relay, receiver, {
            originElevM: relay.elevationM,
            receiverElevM: directOpts.receiverElevM,
            skipLos: opts.skipLos
        });
        if (!leg2.receivable) continue;
        if (channel && leg2.effectiveKm != null) {
            leg2 = Object.assign({}, leg2, {
                effectiveKm: Math.round(leg2.effectiveKm * RELAY_AMPLIFY_FACTOR * 100) / 100,
                quality: qualityForEffectiveKm(leg2.effectiveKm * RELAY_AMPLIFY_FACTOR, leg2.lineOfSight !== false)
            });
        }
        var combined = combineRelayReception(leg1, leg2, relay.id);
        if (!combined) continue;
        if ((QUALITY_RANK[combined.quality] || 0) > (QUALITY_RANK[best.quality] || 0)) {
            best = combined;
        }
    }
    return best;
}

/**
 * Dosahové pásma v km pro uzel s danou výškou (pro mapové kruhy).
 */
export function rangeBandsForElevation(elevationM) {
    var mult = elevationRangeMultiplier(elevationM);
    return {
        clear: RANGE_KM.CLEAR_MAX * mult,
        weak: RANGE_KM.WEAK_MAX * mult,
        fragment: RANGE_KM.FRAGMENT_MAX * mult,
        noise: RANGE_KM.NOISE_MAX * mult,
        multiplier: mult
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
            text: garbleRadioText(plainText, reception.effectiveKm != null ? reception.effectiveKm : km, seed),
            signalQuality: SIGNAL_WEAK,
            distanceKm: km
        };
    }
    if (quality === SIGNAL_FRAGMENT) {
        return {
            text: fragmentRadioText(plainText, reception.effectiveKm != null ? reception.effectiveKm : km, seed),
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
