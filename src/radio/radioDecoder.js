/**
 * Dešifrátor — luštění zachycených šifrovaných zpráv (5 valců A–Z).
 */
import { formatTime } from './radioComms.js';
import {
    decryptCiphertext,
    defaultWheelKey,
    rotateWheelLetter,
    wheelsToKey,
    CIPHER_KEY_LEN,
    CIPHER_WHEEL_ALPHABET
} from './radioCipher.js';

export var DECODER_SCREENS = {
    HUB: 'hub',
    WORKBENCH: 'workbench'
};

export function createDecoderState() {
    return {
        screen: DECODER_SCREENS.HUB,
        focusIndex: 0,
        wheelFocus: 0,
        wheels: defaultWheelKey(),
        selectedEntryId: null,
        draftOutput: ''
    };
}

export function resetDecoderState(session) {
    if (!session) return createDecoderState();
    session.screen = DECODER_SCREENS.HUB;
    session.focusIndex = 0;
    session.wheelFocus = 0;
    session.wheels = defaultWheelKey();
    session.selectedEntryId = null;
    session.draftOutput = '';
    return session;
}

function filterDecoderEntries(notebook) {
    var entries = (notebook && notebook.station) ? notebook.station : [];
    var out = [];
    var i;
    for (i = entries.length - 1; i >= 0; i--) {
        var e = entries[i];
        if (!e || e.id === 'sys_welcome') continue;
        if (e.dir !== 'in') continue;
        if (e.encrypted && e.cipherText) {
            out.push(e);
        }
    }
    return out;
}

function findDecoderEntry(notebook, id) {
    if (!id) return null;
    var list = filterDecoderEntries(notebook);
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
    }
    return null;
}

function formatHubLine(entry) {
    if (!entry) return '—';
    var when = formatTime(entry.ts);
    var from = String(entry.from || '?').slice(0, 8);
    var preview = String(entry.cipherText || entry.text || '').replace(/\s+/g, ' ').slice(0, 14);
    return when + ' ' + from + ' ' + preview;
}

function wrapPreview(text, maxLen) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    maxLen = maxLen || 18;
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + '…';
}

function buildWheelLine(wheels, wheelFocus) {
    var parts = [];
    var i;
    for (i = 0; i < CIPHER_KEY_LEN; i++) {
        var ch = wheels[i] || 'A';
        parts.push(i === wheelFocus ? ('[' + ch + ']') : ch);
    }
    return parts.join(' ');
}

export function decoderRotateWheel(session, delta) {
    if (!session || session.screen !== DECODER_SCREENS.WORKBENCH) return false;
    var idx = session.wheelFocus || 0;
    if (!session.wheels || session.wheels.length !== CIPHER_KEY_LEN) {
        session.wheels = defaultWheelKey();
    }
    session.wheels[idx] = rotateWheelLetter(session.wheels[idx], delta);
    return true;
}

export function decoderMoveWheelFocus(session, delta) {
    if (!session || session.screen !== DECODER_SCREENS.WORKBENCH) return false;
    var next = (session.wheelFocus + delta + CIPHER_KEY_LEN) % CIPHER_KEY_LEN;
    session.wheelFocus = next;
    return true;
}

export function decoderHubMove(session, notebook, delta) {
    var list = filterDecoderEntries(notebook);
    if (!list.length) return false;
    session.focusIndex = (session.focusIndex + delta + list.length) % list.length;
    return true;
}

export function decoderOpenSelected(session, notebook) {
    var list = filterDecoderEntries(notebook);
    if (!list.length) return null;
    var entry = list[session.focusIndex] || list[0];
    session.screen = DECODER_SCREENS.WORKBENCH;
    session.selectedEntryId = entry.id;
    session.wheelFocus = 0;
    session.wheels = defaultWheelKey();
    return entry;
}

export function getDecoderSelectedEntry(session, notebook) {
    return findDecoderEntry(notebook, session && session.selectedEntryId);
}

export function computeDecoderPreview(session, notebook) {
    var entry = getDecoderSelectedEntry(session, notebook);
    if (!entry || !entry.cipherText) return '';
    return decryptCiphertext(entry.cipherText, wheelsToKey(session.wheels));
}

/**
 * @param {object|null} session
 * @param {{ station?: Array }} [notebook]
 */
export function buildDecoderOsView(session, notebook) {
    session = session || createDecoderState();
    notebook = notebook || {};

    if (session.screen === DECODER_SCREENS.HUB) {
        var list = filterDecoderEntries(notebook);
        var lines = [];
        if (!list.length) {
            lines = [
                'Luštění šifrovaných',
                'přijatých zpráv.',
                'Fronta prázdná.',
                'OK · Zpět',
                '',
                ''
            ];
        } else {
            var i;
            for (i = 0; i < 4 && i < list.length; i++) {
                var mark = i === session.focusIndex ? '▸ ' : '  ';
                lines.push(mark + formatHubLine(list[i]));
            }
            while (lines.length < 4) lines.push('');
            lines.push(list.length > 4 ? ('+' + (list.length - 4) + ' dalších') : '');
            lines.push('');
        }
        return {
            mode: 'decoder',
            status: 'DEŠIFRÁTOR',
            lines: lines,
            focusLine: session.focusIndex < 4 ? session.focusIndex : -1,
            footer: '↑↓ výběr · OK luštit',
            buffer: list.length ? ('Ve frontě: ' + list.length) : ''
        };
    }

    var entry = getDecoderSelectedEntry(session, notebook);
    var cipher = entry ? String(entry.cipherText || '') : '';
    var preview = computeDecoderPreview(session, notebook);
    session.draftOutput = preview;

    return {
        mode: 'decoder',
        status: 'DEŠIFRÁTOR',
        lines: [
            wrapPreview(cipher, 18),
            wrapPreview(cipher.slice(18), 18),
            wrapPreview(preview, 18),
            wrapPreview(preview.slice(18), 18),
            buildWheelLine(session.wheels, session.wheelFocus),
            CIPHER_WHEEL_ALPHABET.slice(0, 18)
        ],
        focusLine: 4,
        footer: '◀▶ valec · ↑↓ otáčet · OK kopie',
        buffer: wheelsToKey(session.wheels)
    };
}

export { filterDecoderEntries, CIPHER_WHEEL_ALPHABET };
