/**
 * Vigenère šifra — abeceda A–Z + 1–9 + 0 (36 znaků), klíč 5× A–Z.
 * Mezery se před šifrou nahradí tokenem 0 (šifruje se) — na drátu nejsou vidět.
 * Po dešifrování se token 0 znovu zobrazí jako mezera.
 */
import {
    SIGNAL_CLEAR,
    SIGNAL_FRAGMENT,
    SIGNAL_NOISE,
    SIGNAL_WEAK,
    noisePlaceholder
} from './radioPropagation.js';

export var CIPHER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
export var CIPHER_KEY_LEN = 5;
export var CIPHER_WHEEL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Na drátu místo mezery — šifruje se jako běžný znak (skryje délku slov). */
export var CIPHER_SPACE_CHAR = '0';

var ALPHABET_LEN = CIPHER_ALPHABET.length;

/** Mezery → token před šifrou. */
export function plainToCipherChars(text) {
    return normalizeCipherPlaintext(text).replace(/\s+/g, CIPHER_SPACE_CHAR);
}

/** Token → mezera po dešifrování (luštění podle délky slov). */
export function cipherCharsToPlain(text) {
    return String(text || '').split(CIPHER_SPACE_CHAR).join(' ');
}

function hashSeed(str) {
    var h = 2166136261;
    var s = String(str || '');
    var i;
    for (i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function nextRnd(rnd) {
    return (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
}

export function normalizeCipherChar(ch) {
    if (!ch) return '';
    var up = String(ch).toUpperCase();
    if (CIPHER_ALPHABET.indexOf(up) >= 0) return up;
    return '';
}

export function isEncryptableChar(ch) {
    return !!normalizeCipherChar(ch);
}

export function normalizeCipherPlaintext(text) {
    return String(text || '').toUpperCase();
}

/** Prázdný = PT (bez šifry). Jinak přesně 5 písmen A–Z. */
export function normalizeEncryptionKey(value) {
    var s = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';
    return s.slice(0, CIPHER_KEY_LEN);
}

export function isValidCipherKey(value) {
    return /^[A-Z]{5}$/.test(normalizeEncryptionKey(value));
}

export function charToIndex(ch) {
    var n = CIPHER_ALPHABET.indexOf(normalizeCipherChar(ch));
    return n >= 0 ? n : -1;
}

function keyCharAt(key, keyIndex) {
    var k = normalizeEncryptionKey(key);
    if (k.length !== CIPHER_KEY_LEN) return '';
    return k.charAt(keyIndex % CIPHER_KEY_LEN);
}

export function encryptPlaintext(plaintext, key) {
    var plain = plainToCipherChars(plaintext);
    var k = normalizeEncryptionKey(key);
    if (!k || k.length !== CIPHER_KEY_LEN) return cipherCharsToPlain(plain);
    var out = '';
    var keyPos = 0;
    var i;
    for (i = 0; i < plain.length; i++) {
        var ch = plain.charAt(i);
        var pIdx = charToIndex(ch);
        if (pIdx < 0) {
            out += ch;
            continue;
        }
        var kCh = keyCharAt(k, keyPos);
        keyPos++;
        var kIdx = charToIndex(kCh);
        if (kIdx < 0) {
            out += ch;
            continue;
        }
        out += CIPHER_ALPHABET.charAt((pIdx + kIdx) % ALPHABET_LEN);
    }
    return out;
}

export function decryptCiphertext(ciphertext, key) {
    var raw = normalizeCipherPlaintext(ciphertext);
    var k = normalizeEncryptionKey(key);
    if (!k || k.length !== CIPHER_KEY_LEN) return cipherCharsToPlain(raw);
    var out = '';
    var keyPos = 0;
    var i;
    for (i = 0; i < raw.length; i++) {
        var ch = raw.charAt(i);
        if (/\s/.test(ch)) {
            out += ' ';
            continue;
        }
        var cIdx = charToIndex(ch);
        if (cIdx < 0) {
            out += ch;
            continue;
        }
        var kCh = keyCharAt(k, keyPos);
        keyPos++;
        var kIdx = charToIndex(kCh);
        if (kIdx < 0) {
            out += ch;
            continue;
        }
        out += CIPHER_ALPHABET.charAt((cIdx - kIdx + ALPHABET_LEN) % ALPHABET_LEN);
    }
    return cipherCharsToPlain(out);
}

/** Slabý signál: každý 5. znak → náhodné písmeno. Fragment: každý 3. */
export function applyCipherSignalDamage(text, quality, seed) {
    var raw = String(text || '');
    if (!raw || quality === SIGNAL_CLEAR) return raw;
    if (quality === SIGNAL_NOISE) return raw;
    var step = quality === SIGNAL_FRAGMENT ? 3 : (quality === SIGNAL_WEAK ? 5 : 0);
    if (!step) return raw;
    var rnd = hashSeed('cipherdmg:' + (seed || raw));
    var out = '';
    var i;
    for (i = 0; i < raw.length; i++) {
        var ch = raw.charAt(i);
        if ((i + 1) % step === 0 && isEncryptableChar(ch)) {
            rnd = nextRnd(rnd);
            out += CIPHER_ALPHABET.charAt(rnd % ALPHABET_LEN);
        } else {
            out += ch;
        }
    }
    return out;
}

/**
 * Příjem šifrované zprávy — dešifruje při shodném klíči, jinak poškozený ciphertext.
 * PT (prázdný klíč) = plaintext na drátu.
 */
export function processIncomingCipherMessage(wireText, msgKey, myKey, reception, opts) {
    opts = opts || {};
    var cipherText = String(wireText || '');
    var normalizedMsgKey = normalizeEncryptionKey(msgKey);
    var normalizedMyKey = normalizeEncryptionKey(myKey);

    /* Neplatný / prázdný klíč u zprávy = plaintext na drátu (PT). */
    if (!normalizedMsgKey || !isValidCipherKey(normalizedMsgKey)) {
        var ptOpen = applyReceptionToPlaintext(cipherText, reception, opts);
        if (!ptOpen) return null;
        return Object.assign({ cipherText: '', encrypted: false }, ptOpen);
    }

    if (normalizedMsgKey !== normalizedMyKey || !isValidCipherKey(normalizedMyKey)) {
        return {
            text: 'POŠK · ' + cipherText,
            cipherText: cipherText,
            encrypted: true,
            signalQuality: reception && reception.quality ? reception.quality : SIGNAL_CLEAR,
            distanceKm: reception ? reception.distanceKm : null
        };
    }

    if (!reception || !reception.receivable) return null;

    if (reception.quality === SIGNAL_NOISE) {
        return {
            text: noisePlaceholder(opts.frequency),
            cipherText: cipherText,
            encrypted: false,
            signalQuality: SIGNAL_NOISE,
            distanceKm: reception.distanceKm
        };
    }

    var plain = decryptCiphertext(cipherText, normalizedMyKey);
    var damaged = applyCipherSignalDamage(plain, reception.quality, opts.seed || cipherText);
    return {
        text: damaged,
        cipherText: cipherText,
        encrypted: false,
        signalQuality: reception.quality,
        distanceKm: reception.distanceKm
    };
}

function applyReceptionToPlaintext(plainText, reception, opts) {
    if (!reception || !reception.receivable) return null;
    var quality = reception.quality;
    var seed = opts.seed || plainText;

    if (quality === SIGNAL_CLEAR) {
        return { text: String(plainText || ''), signalQuality: SIGNAL_CLEAR, distanceKm: reception.distanceKm };
    }
    if (quality === SIGNAL_WEAK) {
        return {
            text: applyCipherSignalDamage(String(plainText || ''), SIGNAL_WEAK, seed),
            signalQuality: SIGNAL_WEAK,
            distanceKm: reception.distanceKm
        };
    }
    if (quality === SIGNAL_FRAGMENT) {
        return {
            text: applyCipherSignalDamage(String(plainText || ''), SIGNAL_FRAGMENT, seed),
            signalQuality: SIGNAL_FRAGMENT,
            distanceKm: reception.distanceKm
        };
    }
    if (quality === SIGNAL_NOISE) {
        return {
            text: noisePlaceholder(opts.frequency),
            signalQuality: SIGNAL_NOISE,
            distanceKm: reception.distanceKm
        };
    }
    return null;
}

export function rotateWheelLetter(letter, delta) {
    var alpha = CIPHER_WHEEL_ALPHABET;
    var idx = alpha.indexOf(String(letter || 'A').toUpperCase());
    if (idx < 0) idx = 0;
    var next = (idx + delta + alpha.length) % alpha.length;
    return alpha.charAt(next);
}

export function defaultWheelKey() {
    return ['A', 'A', 'A', 'A', 'A'];
}

export function wheelsToKey(wheels) {
    if (!wheels || !wheels.length) return 'AAAAA';
    var out = '';
    var i;
    for (i = 0; i < CIPHER_KEY_LEN; i++) {
        out += rotateWheelLetter(wheels[i] || 'A', 0);
    }
    return out;
}

/** Mezery viditelné na displeji dešifrátoru (NBSP). */
export function formatDecoderDisplayText(text) {
    return String(text || '').replace(/ /g, '\u00a0');
}
