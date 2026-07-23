/**
 * Rádiové pásmo a ladění — 400–470 MHz, krok 0.025 MHz.
 *
 * Dva režimy (jako vojenská stanice):
 *  1) Presetové kolečko — přepíná ~15–20 předvoleb (ne 2800 kroků)
 *  2) Přímý zápis — numerická klávesnice → přesná frekvence (snap na krok)
 */

export var BAND_MIN_MHZ = 400;
export var BAND_MAX_MHZ = 470;
export var TUNE_STEP_MHZ = 0.025;

/** Nouzová frekvence v pásmu (náhrada staré 121.500 mimo UHF). */
export var EMERGENCY_FREQUENCY = '450.000';
export var EMERGENCY_ENCRYPTION = 'SOS';

/** Alias pro starší importy. */
export var GLOBAL_FREQUENCY = EMERGENCY_FREQUENCY;
export var GLOBAL_ENCRYPTION = EMERGENCY_ENCRYPTION;

export function parseFrequencyMHz(value) {
    var s = String(value == null ? '' : value).trim().replace(',', '.');
    if (!s) return NaN;
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
}

/** Formát XXX.YYY (3 desetinná místa). */
export function formatFrequency(mhz) {
    var n = typeof mhz === 'number' ? mhz : parseFrequencyMHz(mhz);
    if (!isFinite(n)) return '';
    return n.toFixed(3);
}

/**
 * Zaokrouhlí na mřížku 0.025 MHz (banker's-safe přes celá čísla kHz).
 */
export function snapToTuneStep(mhz) {
    var n = typeof mhz === 'number' ? mhz : parseFrequencyMHz(mhz);
    if (!isFinite(n)) return NaN;
    var stepKhz = Math.round(TUNE_STEP_MHZ * 1000);
    var khz = Math.round(n * 1000);
    var snapped = Math.round(khz / stepKhz) * stepKhz;
    return snapped / 1000;
}

export function clampToBand(mhz) {
    var n = typeof mhz === 'number' ? mhz : parseFrequencyMHz(mhz);
    if (!isFinite(n)) return NaN;
    if (n < BAND_MIN_MHZ) return BAND_MIN_MHZ;
    if (n > BAND_MAX_MHZ) return BAND_MAX_MHZ;
    return n;
}

export function isInBand(mhz) {
    var n = typeof mhz === 'number' ? mhz : parseFrequencyMHz(mhz);
    return isFinite(n) && n >= BAND_MIN_MHZ && n <= BAND_MAX_MHZ;
}

/**
 * Normalizace vstupu hráče: parse → clamp do pásma → snap na 0.025 → "XXX.YYY".
 * Prázdný vstup → ''.
 */
export function normalizeFrequency(value) {
    var s = String(value == null ? '' : value).trim();
    if (!s) return '';
    var n = parseFrequencyMHz(s);
    if (!isFinite(n)) return '';
    n = snapToTuneStep(clampToBand(n));
    return formatFrequency(n);
}

/**
 * Firestore ID kanálu jen podle frekvence (freq-first).
 * „400.025“ → „f_400025“
 */
export function frequencyChannelId(frequency) {
    var freq = normalizeFrequency(frequency);
    if (!freq) return '';
    return 'f_' + freq.replace('.', '');
}

/** Posun o N kroků (typicky ±1 = ±0.025). Výsledek vždy v pásmu na mřížce. */
export function stepFrequency(mhz, steps) {
    var n = typeof mhz === 'number' ? mhz : parseFrequencyMHz(mhz);
    if (!isFinite(n)) n = 435;
    var s = typeof steps === 'number' && isFinite(steps) ? steps : 0;
    n = snapToTuneStep(n) + s * TUNE_STEP_MHZ;
    return formatFrequency(snapToTuneStep(clampToBand(n)));
}

/**
 * Mapuje identifikátor (comCode) na platný kanál v pásmu na mřížce 0.025.
 */
export function channelFromCode(code, fallbackMHz) {
    var raw = String(code || '').trim().toUpperCase();
    var n = 0;
    var i;
    if (raw) {
        for (i = 0; i < raw.length; i++) {
            n = ((n * 31) + raw.charCodeAt(i)) >>> 0;
        }
    } else if (fallbackMHz != null && isFinite(fallbackMHz)) {
        return normalizeFrequency(fallbackMHz);
    } else {
        return normalizeFrequency(435);
    }
    var stepKhz = Math.round(TUNE_STEP_MHZ * 1000);
    var minKhz = Math.round(BAND_MIN_MHZ * 1000);
    var maxKhz = Math.round(BAND_MAX_MHZ * 1000);
    var slots = Math.floor((maxKhz - minKhz) / stepKhz) + 1;
    var idx = n % slots;
    var khz = minKhz + idx * stepKhz;
    return formatFrequency(khz / 1000);
}

/**
 * Výchozí presetové kolečko (~18 pozic): komunita, nouzová, pak „průzkumné“ kanály.
 * Hráč PRE / −+ přepíná jen tyhle pozice — ne celé pásmo po 0.025.
 */
export function buildDefaultDialPresets(ctx) {
    ctx = ctx || {};
    var comFreq = ctx.comFreq || channelFromCode(ctx.comCode, 435);
    var comKey = ctx.comKey || '';
    var list = [];
    var slot = 1;

    list.push({
        slot: slot++,
        label: 'Komunita',
        frequency: normalizeFrequency(comFreq),
        encryptionKey: comKey,
        scope: 'community',
        dial: true
    });

    list.push({
        slot: slot++,
        label: 'Nouzová',
        frequency: EMERGENCY_FREQUENCY,
        encryptionKey: EMERGENCY_ENCRYPTION,
        scope: 'global',
        dial: true
    });

    /* Průzkumné kanály po 5 MHz — rychlé procházení pásma (šum / anomálie). */
    var f;
    for (f = BAND_MIN_MHZ; f <= BAND_MAX_MHZ - 5; f += 5) {
        var freq = normalizeFrequency(f);
        if (freq === normalizeFrequency(comFreq) || freq === EMERGENCY_FREQUENCY) continue;
        list.push({
            slot: slot++,
            label: 'CH ' + String(Math.round(f)),
            frequency: freq,
            encryptionKey: '',
            scope: 'private',
            dial: true
        });
        if (list.length >= 18) break;
    }

    return list;
}

/** Index aktivního presetu v dial seznamu (−1 pokud frekvence není na kolečku). */
export function findDialIndex(presets, frequency, activeSlot) {
    if (!presets || !presets.length) return -1;
    if (activeSlot != null) {
        for (var i = 0; i < presets.length; i++) {
            if (presets[i].slot === activeSlot) return i;
        }
    }
    var freq = normalizeFrequency(frequency);
    for (var j = 0; j < presets.length; j++) {
        if (normalizeFrequency(presets[j].frequency) === freq) return j;
    }
    return -1;
}
