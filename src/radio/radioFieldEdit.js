/**
 * Editor frekvence / šifry / textu — T9 multi-tap, bez systémové klávesnice.
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
var TEXT_MAX = 16;
var LABEL_MAX = 14;
var T9_TIMEOUT_MS = 850;

var T9_GROUPS = {
    '1': '1',
    '2': 'abc',
    '3': 'def',
    '4': 'ghi',
    '5': 'jkl',
    '6': 'mno',
    '7': 'pqrs',
    '8': 'tuv',
    '9': 'wxyz'
};

export function createFieldEdit(type, radioState, options) {
    radioState = radioState || {};
    options = options || {};
    var base = {
        digitMode: false,
        cursor: 0,
        returnTo: options.returnTo || 'standby',
        okExitPending: false,
        t9Key: null,
        t9Index: 0,
        t9Timer: null
    };

    if (type === 'freq') {
        var srcFreq = options.frequency != null ? options.frequency : radioState.frequency;
        return Object.assign(base, {
            type: 'freq',
            digits: freqToDigits(srcFreq || '462.000')
        });
    }
    if (type === 'encrypt') {
        var srcKey = options.encryptionKey != null ? options.encryptionKey : radioState.encryptionKey;
        return Object.assign(base, {
            type: 'encrypt',
            text: String(srcKey || '')
        });
    }
    if (type === 'text') {
        return Object.assign(base, {
            type: 'text',
            text: String(options.text || ''),
            maxLen: options.maxLen || LABEL_MAX
        });
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

function clearT9Timer(session) {
    if (session && session.t9Timer) {
        clearTimeout(session.t9Timer);
        session.t9Timer = null;
    }
}

export function finalizeT9Session(session) {
    if (!session) return;
    clearT9Timer(session);
    if (session.t9Key) {
        session.cursor = Math.min(session.cursor + 1, textMaxLen(session));
        session.t9Key = null;
        session.t9Index = 0;
    }
}

function textMaxLen(session) {
    if (session.type === 'text') return session.maxLen || LABEL_MAX;
    if (session.type === 'encrypt') return TEXT_MAX;
    return LABEL_MAX;
}

function isTextType(session) {
    return session.type === 'encrypt' || session.type === 'text';
}

function normalizeTextValue(text) {
    return String(text || '').replace(/_/g, '');
}

function scheduleT9Advance(session) {
    clearT9Timer(session);
    session.t9Timer = setTimeout(function() {
        finalizeT9Session(session);
    }, T9_TIMEOUT_MS);
}

var PUNCT_CYCLE = ['.', ',', '?'];

function applyPunctTap(session) {
    var group = PUNCT_CYCLE;
    if (session.t9Key === '*') {
        session.t9Index = (session.t9Index + 1) % group.length;
        replaceTextChar(session, group.charAt(session.t9Index));
    } else {
        finalizeT9Session(session);
        session.t9Key = '*';
        session.t9Index = 0;
        insertTextChar(session, group.charAt(0));
    }
    scheduleT9Advance(session);
    return true;
}

function textEditHint() {
    return 'T9 · 0 vel/mal poslední · # mez · * .,? · Zpět maže';
}

function applyLetterCase(ch) {
    if (ch === ' ') return ' ';
    var s = String(ch);
    if (/^[a-zA-Z]$/.test(s)) return s.toLowerCase();
    return s;
}

function toggleLastLetterCase(session) {
    var text = normalizeTextValue(session.text);
    if (!text.length) return false;
    var pos = session.cursor > 0 ? session.cursor - 1 : text.length - 1;
    var ch = text.charAt(pos);
    if (!/[a-zA-Z]/.test(ch)) return false;
    var toggled = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
    session.text = text.slice(0, pos) + toggled + text.slice(pos + 1);
    session.cursor = Math.max(session.cursor, pos + 1);
    return true;
}

function insertTextChar(session, ch) {
    var text = normalizeTextValue(session.text);
    var maxLen = textMaxLen(session);
    var out = applyLetterCase(ch);
    var pos = Math.min(session.cursor, text.length);
    text = text.slice(0, pos) + out + text.slice(pos);
    if (text.length > maxLen) text = text.slice(0, maxLen);
    session.text = text;
    session.cursor = Math.min(pos + 1, text.length);
}

function replaceTextChar(session, ch) {
    var text = normalizeTextValue(session.text);
    var maxLen = textMaxLen(session);
    var out = applyLetterCase(ch);
    var pos = Math.max(0, Math.min(session.cursor, text.length - 1));
    if (!text.length) {
        text = out;
        session.cursor = 1;
    } else {
        text = text.slice(0, pos) + out + text.slice(pos + 1);
    }
    if (text.length > maxLen) text = text.slice(0, maxLen);
    session.text = text;
}

function applyT9Tap(session, key) {
    var group = T9_GROUPS[key];
    if (!group) return false;
    if (group.length === 1) {
        finalizeT9Session(session);
        insertTextChar(session, group);
        return true;
    }
    if (session.t9Key === key) {
        session.t9Index = (session.t9Index + 1) % group.length;
        replaceTextChar(session, group.charAt(session.t9Index));
    } else {
        finalizeT9Session(session);
        session.t9Key = key;
        session.t9Index = 0;
        insertTextChar(session, group.charAt(0));
    }
    scheduleT9Advance(session);
    return true;
}

function applyLiteralDigit(session, key) {
    finalizeT9Session(session);
    if (session.type === 'freq' && session.digitMode) {
        session.digits[session.cursor] = key;
        if (session.cursor < FREQ_DIGITS - 1) session.cursor++;
        return true;
    }
    if (isTextType(session) && session.digitMode) {
        insertTextChar(session, key);
        return true;
    }
    return false;
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
    for (var i = 0; i < slots; i++) bar += i === pos ? '●' : '─';
    return String(BAND_MIN_MHZ) + ' ' + bar + ' ' + String(BAND_MAX_MHZ);
}

function buildFreqHtml(session) {
    var d = session.digits;
    var html = '';
    var i;
    for (i = 0; i < 3; i++) html += digitSpan(d[i], session.digitMode && session.cursor === i);
    html += '<span class="radio-edit-dec">.</span>';
    for (i = 3; i < 6; i++) html += digitSpan(d[i], session.digitMode && session.cursor === i);
    html += '<span class="radio-edit-unit"> MHz</span>';
    return html;
}

function buildTextHtml(session) {
    var text = normalizeTextValue(session.text);
    var maxLen = textMaxLen(session);
    var html = '';
    var i;
    if (!text.length && session.digitMode) {
        return digitSpan('_', true, true);
    }
    for (i = 0; i < text.length; i++) {
        html += digitSpan(text.charAt(i), session.digitMode && session.cursor === i, true);
    }
    if (session.digitMode && session.cursor >= text.length && text.length < maxLen) {
        html += digitSpan('_', true, true);
    }
    return html;
}

function digitSpan(ch, active, underline) {
    var cls = 'radio-edit-char';
    if (active && underline) cls += ' radio-edit-cursor';
    else if (active) cls += ' radio-edit-blink';
    return '<span class="' + cls + '">' + escapeHtml(ch) + '</span>';
}

function escapeHtml(ch) {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    return ch;
}

export function buildFieldEditView(session, options) {
    options = options || {};
    if (!session) return { mode: 'off' };

    if (session.type === 'freq') {
        var mhz = normalizeFrequency(digitsToMhzString(session.digits)) || digitsToMhzString(session.digits);
        return {
            mode: 'field_edit',
            editType: 'freq',
            status: options.status || 'NASTAV FREKVENCI',
            freqHtml: buildFreqHtml(session),
            axis: buildFreqAxis(mhz),
            hint: session.digitMode ? '←→ kurzor · Zpět maže' : '←→ jemně · OK číslice',
            footer: 'OK · Zpět maže'
        };
    }

    var isKey = session.type === 'encrypt';
    return {
        mode: 'field_edit',
        editType: isKey ? 'encrypt' : 'text',
        status: options.status || (isKey ? 'NASTAV ŠIFRU' : 'NÁZEV KANÁLU'),
        keyHtml: buildTextHtml(session),
        axis: '',
        hint: session.digitMode ? textEditHint() : 'OK spustí kurzor',
        footer: 'OK · Zpět maže'
    };
}

export function insertFieldEditSpace(session) {
    if (!session || !isTextType(session)) return false;
    if (!session.digitMode) {
        session.digitMode = true;
        session.cursor = normalizeTextValue(session.text).length;
    }
    finalizeT9Session(session);
    insertTextChar(session, ' ');
    return true;
}

export function handleFieldEditInput(session, action, char, opts) {
    opts = opts || {};
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
        if (action === 'char' && char != null) {
            if (!session.digitMode) {
                session.digitMode = true;
                session.cursor = session.cursor || 0;
            }
            if (opts.longPress) return applyLiteralDigit(session, char);
            if (/^[0-9]$/.test(char)) return applyLiteralDigit(session, char);
        }
        return false;
    }

    if (isTextType(session)) {
        var text = normalizeTextValue(session.text);
        if (action === 'left' || action === 'right') {
            if (!session.digitMode) {
                session.digitMode = true;
            }
            finalizeT9Session(session);
            var maxPos = text.length;
            session.cursor = clampCursor(
                session.cursor + (action === 'left' ? -1 : 1),
                Math.max(1, maxPos + 1)
            );
            if (session.cursor > maxPos) session.cursor = maxPos;
            return true;
        }
        if (action === 'up' || action === 'down') {
            session.digitMode = true;
            session.cursor = 0;
            if (!text.length) session.text = '';
            return true;
        }
        if (action === 'char' && char != null) {
            if (!session.digitMode) {
                session.digitMode = true;
                session.cursor = Math.min(session.cursor, text.length);
            }
            if (char === '0') {
                finalizeT9Session(session);
                if (opts.longPress) {
                    insertTextChar(session, '0');
                    return true;
                }
                return toggleLastLetterCase(session);
            }
            if (opts.longPress && /^[0-9]$/.test(char)) return applyLiteralDigit(session, char);
            if (char === '*') return applyPunctTap(session);
            if (char === '#') {
                finalizeT9Session(session);
                insertTextChar(session, ' ');
                return true;
            }
            if (/^[0-9]$/.test(char)) return applyT9Tap(session, char);
        }
        return false;
    }

    return false;
}

function deleteTextChar(session) {
    finalizeT9Session(session);
    var text = normalizeTextValue(session.text);
    if (!text.length) return false;
    var pos = session.cursor;
    if (pos <= 0) return false;
    session.text = text.slice(0, pos - 1) + text.slice(pos);
    session.cursor = pos - 1;
    return true;
}

/** Zpět během editace = backspace; po OK (kurzor vyp) = návrat do menu. */
export function handleFieldEditBack(session) {
    if (!session) return false;
    if (!session.digitMode) return 'exit';
    if (session.type === 'freq') {
        if (session.cursor > 0) {
            session.cursor--;
        }
        session.digits[session.cursor] = '0';
        return true;
    }
    if (isTextType(session)) {
        return deleteTextChar(session);
    }
    return false;
}

/** OK: kurzor vyp/zap, pak ukončení dílčí editace. */
export function handleFieldEditOk(session) {
    if (!session) return null;
    finalizeT9Session(session);
    if (session.digitMode) {
        session.digitMode = false;
        session.okExitPending = true;
        return 'cursor_off';
    }
    if (session.okExitPending) {
        session.okExitPending = false;
        return 'done';
    }
    if (session.type === 'freq') {
        session.digitMode = true;
        session.cursor = session.cursor || 0;
        return 'cursor_on';
    }
    if (isTextType(session)) {
        session.digitMode = true;
        session.cursor = 0;
        return 'cursor_on';
    }
    return 'done';
}

export function readFieldEditValues(session) {
    if (!session) return null;
    if (session.type === 'freq') {
        return { frequency: normalizeFrequency(digitsToMhzString(session.digits)) || digitsToMhzString(session.digits) };
    }
    if (isTextType(session)) {
        return { text: normalizeTextValue(session.text) };
    }
    return null;
}

export function applyFieldEditToState(session, radioState, ctx) {
    if (!session || !radioState) return false;
    ctx = ctx || {};
    if (session.type === 'freq') {
        var freq = normalizeFrequency(digitsToMhzString(session.digits));
        if (!freq) return false;
        radioState.frequency = freq;
        radioState.activePresetSlot = null;
        return true;
    }
    if (session.type === 'encrypt') {
        radioState.encryptionKey = normalizeEncryptionKey(normalizeTextValue(session.text));
        return true;
    }
    return false;
}

export function applyFieldEditToDraft(session, draft) {
    if (!session || !draft) return false;
    var vals = readFieldEditValues(session);
    if (!vals) return false;
    if (vals.frequency) draft.frequency = vals.frequency;
    if (vals.text != null) {
        if (session.type === 'encrypt') draft.encryptionKey = normalizeEncryptionKey(vals.text);
        else draft.label = vals.text.trim() || ('Kanál ' + draft.slot);
    }
    return true;
}

export function cancelFieldEdit(session) {
    if (session) clearT9Timer(session);
}
