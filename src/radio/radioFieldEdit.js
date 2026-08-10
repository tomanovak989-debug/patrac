/**
 * Editor ruční frekvence / šifry / názvu presetu — bez systémové klávesnice.
 */
import {
    BAND_MIN_MHZ,
    BAND_MAX_MHZ,
    normalizeFrequency,
    parseFrequencyMHz,
    stepFrequency
} from './radioBand.js';
import { findPreset, normalizeEncryptionKey, upsertPreset } from './radioComms.js';

var FREQ_DIGITS = 6;
var TEXT_MAX = 16;
var LABEL_MAX = 14;

var T9_LETTER = {
    '2': 'a', '3': 'd', '4': 'g', '5': 'j', '6': 'm', '7': 'p', '8': 't', '9': 'w'
};

export function createFieldEdit(type, radioState, options) {
    radioState = radioState || {};
    options = options || {};
    if (type === 'freq') {
        return {
            type: 'freq',
            digitMode: false,
            cursor: 0,
            digits: freqToDigits(radioState.frequency || '462.000')
        };
    }
    if (type === 'encrypt') {
        return {
            type: 'encrypt',
            digitMode: false,
            cursor: 0,
            text: normalizeEncryptionKey(radioState.encryptionKey || '')
        };
    }
    if (type === 'preset_label') {
        var slot = options.slot || 1;
        var preset = findPreset(radioState, slot);
        var name = preset ? (preset.label || ('Kanál ' + slot)) : ('Kanál ' + slot);
        if (name.indexOf('Kanál ') === 0) name = name.slice(6);
        return {
            type: 'preset_label',
            slot: slot,
            digitMode: false,
            cursor: 0,
            text: name
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

function buildTextHtml(session, maxLen) {
    var text = session.text || '';
    if (!text.length) text = '_';
    var html = '';
    var i;
    for (i = 0; i < text.length; i++) {
        html += digitSpan(text.charAt(i), session.digitMode && session.cursor === i);
    }
    if (session.digitMode && session.cursor >= text.length && text.length < maxLen) {
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

function isTextSession(session) {
    return session.type === 'encrypt' || session.type === 'preset_label';
}

function textMaxLen(session) {
    return session.type === 'preset_label' ? LABEL_MAX : TEXT_MAX;
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

    if (session.type === 'preset_label') {
        return {
            mode: 'field_edit',
            editType: 'preset_label',
            status: 'P' + session.slot + ' · NÁZEV KANÁLU',
            keyHtml: buildTextHtml(session, LABEL_MAX),
            axis: '',
            hint: session.digitMode ? '←→ kurzor · 2–9 písmo' : '↑↓ úprava názvu',
            footer: 'OK · uložit'
        };
    }

    return {
        mode: 'field_edit',
        editType: 'encrypt',
        status: 'NASTAV ŠIFRU',
        keyHtml: buildTextHtml(session, TEXT_MAX),
        axis: '',
        hint: session.digitMode ? '←→ kurzor · 2–9 písmo' : '↑↓ číslice',
        footer: 'OK · uložit'
    };
}

function handleTextInput(session, action, char) {
    var text = session.text || '';
    var maxLen = textMaxLen(session);
    if (action === 'left' || action === 'right') {
        if (!session.digitMode) return false;
        var maxLenView = Math.max(1, text.length || 1);
        session.cursor = clampCursor(session.cursor + (action === 'left' ? -1 : 1), maxLenView);
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
        if (/^[0-9a-zA-Z*# ]$/.test(encChar) || encChar === ' ') {
            if (text === '_') text = '';
            var lower = encChar === ' ' ? ' ' : encChar.toLowerCase();
            if (session.cursor >= text.length) {
                text += lower;
            } else {
                text = text.slice(0, session.cursor) + lower + text.slice(session.cursor + 1);
            }
            if (text.length > maxLen) text = text.slice(0, maxLen);
            session.text = text;
            if (session.cursor < maxLen - 1 && session.cursor < text.length) {
                session.cursor++;
            }
            return true;
        }
    }
    return false;
}

/**
 * @returns {boolean}
 */
export function handleFieldEditInput(session, action, char) {
    if (!session) return false;
    if (action === 'ok' || action === 'back') return false;

    if (session.type === 'freq') {
        if (action === 'left' || action === 'right') {
            if (session.digitMode) {
                session.cursor = clampCursor(session.cursor + (action === 'left' ? -1 : 1), FREQ_DIGITS);
                return true;
            }
            var cur = normalizeFrequency(digitsToMhzString(session.digits)) || '462.000';
            session.digits = freqToDigits(stepFrequency(cur, action === 'left' ? -1 : 1));
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

    if (isTextSession(session)) {
        return handleTextInput(session, action, char);
    }

    return false;
}

export function commitFieldEdit(session, radioState, ctx) {
    if (!session || !radioState) return false;
    ctx = ctx || {};

    if (session.type === 'freq') {
        var freq = normalizeFrequency(digitsToMhzString(session.digits));
        if (!freq) return false;
        radioState.frequency = freq;
        radioState.activePresetSlot = null;
        radioState.keypadMode = 'tx';
        return true;
    }

    if (session.type === 'encrypt') {
        radioState.encryptionKey = normalizeEncryptionKey((session.text || '').replace(/_/g, ''));
        radioState.keypadMode = 'tx';
        return true;
    }

    if (session.type === 'preset_label') {
        var label = (session.text || '').replace(/_/g, '').trim();
        if (!label) label = 'Kanál ' + session.slot;
        var existing = findPreset(radioState, session.slot);
        if (existing) {
            upsertPreset(radioState, session.slot, { label: label });
        } else {
            upsertPreset(radioState, session.slot, {
                label: label,
                frequency: radioState.frequency,
                encryptionKey: radioState.encryptionKey || '',
                scope: ctx.scope || 'private'
            });
        }
        radioState.keypadMode = 'tx';
        return true;
    }

    return false;
}

export function cancelFieldEdit(radioState) {
    if (radioState) radioState.keypadMode = 'tx';
}
