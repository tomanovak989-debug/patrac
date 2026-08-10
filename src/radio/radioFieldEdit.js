/**
 * Editor ruční frekvence / šifry — osa pásma, velký text, kurzor číslic.
 */
import {
    BAND_MIN_MHZ,
    BAND_MAX_MHZ,
    normalizeFrequency,
    parseFrequencyMHz,
    stepFrequency
} from './radioBand.js';
import { normalizeEncryptionKey } from './radioComms.js';

var FREQ_DIGITS = 6;
var ENCRYPT_MAX = 16;

var T9_LETTER = {
    '2': 'a', '3': 'd', '4': 'g', '5': 'j', '6': 'm', '7': 'p', '8': 't', '9': 'w'
};

export function createFieldEdit(type, radioState) {
    radioState = radioState || {};
    if (type === 'freq') {
        return {
            type: 'freq',
            digitMode: false,
            cursor: 0,
            digits: freqToDigits(radioState.frequency || '462.000')
        };
    }
    if (type === 'encrypt') {
        var key = normalizeEncryptionKey(radioState.encryptionKey || '');
        return {
            type: 'encrypt',
            digitMode: false,
            cursor: 0,
            text: key
        };
    }
    return null;
}

export function isFieldEditActive(session) {
    return !!(session && session.type);
}

function freqToDigits(mhz) {
    var s = normalizeFrequency(mhz) || '462.000';
    var parts = s.split('.');
    var intPart = (parts[0] || '000').padStart(3, '0').slice(-3);
    var decPart = (parts[1] || '000').padEnd(3, '0').slice(0, 3);
    var raw = intPart + decPart;
    var out = [];
    for (var i = 0; i < FREQ_DIGITS; i++) out.push(raw.charAt(i) || '0');
    return out;
}

function digitsToMhzString(digits) {
    return digits[0] + digits[1] + digits[2] + '.' + digits[3] + digits[4] + digits[5];
}

function clampCursor(idx, max) {
    if (max <= 0) return 0;
    if (idx < 0) return 0;
    if (idx >= max) return max - 1;
    return idx;
}

export function buildFreqAxis(mhz) {
    var n = parseFrequencyMHz(mhz);
    if (!isFinite(n)) n = BAND_MIN_MHZ;
    if (n < BAND_MIN_MHZ) n = BAND_MIN_MHZ;
    if (n > BAND_MAX_MHZ) n = BAND_MAX_MHZ;
    var pct = (n - BAND_MIN_MHZ) / (BAND_MAX_MHZ - BAND_MIN_MHZ);
    var slots = 11;
    var pos = Math.round(pct * (slots - 1));
    var bar = '';
    for (var i = 0; i < slots; i++) {
        bar += i === pos ? '●' : '─';
    }
    return String(BAND_MIN_MHZ) + ' ' + bar + ' ' + String(BAND_MAX_MHZ);
}

function buildFreqHtml(session) {
    var d = session.digits;
    var html = '';
    var i;
    for (i = 0; i < 3; i++) {
        html += digitSpan(d[i], session.digitMode && session.cursor === i);
    }
    html += '<span class="radio-edit-dec">.</span>';
    for (i = 3; i < 6; i++) {
        html += digitSpan(d[i], session.digitMode && session.cursor === i);
    }
    html += '<span class="radio-edit-unit"> MHz</span>';
    return html;
}

function buildEncryptHtml(session) {
    var text = session.text || '';
    if (!text.length) text = '_';
    var html = '';
    for (var i = 0; i < text.length; i++) {
        html += digitSpan(text.charAt(i), session.digitMode && session.cursor === i);
    }
    if (session.digitMode && session.cursor >= text.length) {
        html += digitSpan('_', true);
    }
    return html;
}

function digitSpan(ch, blink) {
    return '<span class="radio-edit-char' + (blink ? ' radio-edit-blink' : '') + '">' + escapeHtml(ch) + '</span>';
}

function escapeHtml(ch) {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    return ch;
}

export function buildFieldEditView(session) {
    if (!session) return { mode: 'off' };

    if (session.type === 'freq') {
        var mhz = normalizeFrequency(digitsToMhzString(session.digits)) || digitsToMhzString(session.digits);
        return {
            mode: 'field_edit',
            editType: 'freq',
            status: 'NASTAV FREKVENCI',
            freqHtml: buildFreqHtml(session),
            axis: buildFreqAxis(mhz),
            hint: session.digitMode ? '←→ kurzor · 0–9 přepis' : '←→ jemně · ↑↓ číslice',
            footer: 'OK · uložit'
        };
    }

    return {
        mode: 'field_edit',
        editType: 'encrypt',
        status: 'NASTAV ŠIFRU',
        keyHtml: buildEncryptHtml(session),
        axis: '',
        hint: session.digitMode ? '←→ kurzor · 2–9 písmo' : '↑↓ číslice',
        footer: 'OK · uložit'
    };
}

/**
 * @returns {boolean}
 */
export function handleFieldEditInput(session, action, char) {
    if (!session) return false;

    if (action === 'ok' || action === 'back') {
        return false;
    }

    if (session.type === 'freq') {
        if (action === 'left' || action === 'right') {
            if (session.digitMode) {
                var dir = action === 'left' ? -1 : 1;
                session.cursor = clampCursor(session.cursor + dir, FREQ_DIGITS);
                return true;
            }
            var steps = action === 'left' ? -1 : 1;
            var cur = normalizeFrequency(digitsToMhzString(session.digits)) || '462.000';
            session.digits = freqToDigits(stepFrequency(cur, steps));
            return true;
        }
        if (action === 'up' || action === 'down') {
            session.digitMode = true;
            session.cursor = 0;
            return true;
        }
        if (action === 'char' && char != null && session.digitMode && /^[0-9]$/.test(char)) {
            session.digits[session.cursor] = char;
            if (session.cursor < FREQ_DIGITS - 1) session.cursor++;
            return true;
        }
        return false;
    }

    if (session.type === 'encrypt') {
        var text = session.text || '';
        if (action === 'left' || action === 'right') {
            if (!session.digitMode) return false;
            var maxLen = Math.max(1, text.length || 1);
            session.cursor = clampCursor(session.cursor + (action === 'left' ? -1 : 1), maxLen);
            return true;
        }
        if (action === 'up' || action === 'down') {
            session.digitMode = true;
            session.cursor = 0;
            if (!text.length) session.text = '_';
            return true;
        }
        if (action === 'char' && char != null && session.digitMode) {
            var encChar = char;
            if (/^[2-9]$/.test(char) && T9_LETTER[char]) encChar = T9_LETTER[char];
            if (/^[0-9a-zA-Z*#]$/.test(encChar)) {
                if (text === '_') text = '';
                var lower = encChar.toLowerCase();
                if (session.cursor >= text.length) {
                    text += lower;
                } else {
                    text = text.slice(0, session.cursor) + lower + text.slice(session.cursor + 1);
                }
                if (text.length > ENCRYPT_MAX) text = text.slice(0, ENCRYPT_MAX);
                session.text = text;
                if (session.cursor < ENCRYPT_MAX - 1 && session.cursor < text.length) {
                    session.cursor++;
                }
                return true;
            }
        }
        return false;
    }

    return false;
}

export function commitFieldEdit(session, radioState) {
    if (!session || !radioState) return false;
    if (session.type === 'freq') {
        var freq = normalizeFrequency(digitsToMhzString(session.digits));
        if (!freq) return false;
        radioState.frequency = freq;
        radioState.activePresetSlot = null;
        radioState.dialBuffer = '';
        radioState.keypadMode = 'tx';
        return true;
    }
    if (session.type === 'encrypt') {
        radioState.encryptionKey = normalizeEncryptionKey((session.text || '').replace(/_/g, ''));
        radioState.dialBuffer = '';
        radioState.keypadMode = 'tx';
        return true;
    }
    return false;
}

export function cancelFieldEdit(radioState) {
    if (radioState) {
        radioState.dialBuffer = '';
        radioState.keypadMode = 'tx';
    }
}
