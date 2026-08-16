/**
 * SMS / PTT — hub, přijaté, odeslané, compose.
 */
import { findPreset, normalizeFrequency } from './radioComms.js';
import { isPttSupported } from './radioPtt.js';

var DISPLAY_LINES = 6;
var LINE_CHARS = 20;

export var COMMS_HUB = 'hub';
export var COMMS_INBOX = 'inbox';
export var COMMS_OUTBOX = 'outbox';
export var COMMS_NEW_TYPE = 'new_type';
export var COMMS_COMPOSE_TEXT = 'compose_text';
export var COMMS_COMPOSE_PTT = 'compose_ptt';

export function createCommsState() {
    return { screen: COMMS_HUB, focusIndex: 0 };
}

export function formatChannelTarget(radioState) {
    radioState = radioState || {};
    var freq = normalizeFrequency(radioState.frequency) || '---.---';
    var slot = radioState.activePresetSlot;
    var preset = slot ? findPreset(radioState, slot) : null;
    var label = preset && preset.label ? preset.label : (slot ? ('P' + slot) : 'RUČNĚ');
    return {
        freq: freq,
        label: label,
        line: label + ' · ' + freq + ' MHz'
    };
}

function filterEntries(notebook, dir) {
    var entries = (notebook && notebook.station) ? notebook.station : [];
    var out = [];
    var i;
    for (i = entries.length - 1; i >= 0; i--) {
        var e = entries[i];
        if (!e || e.id === 'sys_welcome') continue;
        if (dir && e.dir !== dir) continue;
        out.push(e);
    }
    return out;
}

function formatEntryLine(entry) {
    if (!entry) return '';
    var arrow = entry.dir === 'out' ? '↑' : '↓';
    var who = String(entry.from || '?').slice(0, 6);
    var text = String(entry.text || '').replace(/\s+/g, ' ').trim();
    if (entry.messageType === 'ptt' || /^\[PTT/.test(text)) {
        text = text || '[PTT]';
    }
    var line = arrow + ' ' + who + ': ' + text;
    if (line.length > LINE_CHARS) line = line.slice(0, LINE_CHARS - 1) + '…';
    return line;
}

function hubItems() {
    return [
        { type: 'action', id: 'new', label: '→ NOVÁ ZPRÁVA' },
        { type: 'action', id: 'inbox', label: '↓ PŘIJATÉ' },
        { type: 'action', id: 'outbox', label: '↑ ODESLANÉ' }
    ];
}

function newTypeItems() {
    var items = [
        { type: 'action', id: 'sms', label: 'SMS · text' },
        { type: 'action', id: 'ptt', label: 'PTT · hlas' }
    ];
    if (!isPttSupported()) {
        items[1] = { type: 'action', id: 'ptt', label: 'PTT · nedostupné', disabled: true };
    }
    return items;
}

function listItems(notebook, dir) {
    var entries = filterEntries(notebook, dir);
    var items = [];
    var i;
    for (i = 0; i < entries.length; i++) {
        items.push({ type: 'msg', entry: entries[i] });
    }
    if (!items.length) {
        items.push({ type: 'empty', label: dir === 'in' ? '(žádné přijaté)' : '(žádné odeslané)' });
    }
    return items;
}

export function getCommsItems(session, notebook) {
    session = session || createCommsState();
    if (session.screen === COMMS_HUB) return hubItems();
    if (session.screen === COMMS_NEW_TYPE) return newTypeItems();
    if (session.screen === COMMS_INBOX) return listItems(notebook, 'in');
    if (session.screen === COMMS_OUTBOX) return listItems(notebook, 'out');
    return [];
}

export function clampCommsFocus(session, notebook) {
    var items = getCommsItems(session, notebook);
    if (!items.length) {
        session.focusIndex = 0;
        return items;
    }
    if (session.focusIndex < 0) session.focusIndex = 0;
    if (session.focusIndex >= items.length) session.focusIndex = items.length - 1;
    return items;
}

function formatItem(item) {
    if (!item) return '';
    if (item.label) return item.label;
    if (item.type === 'msg') return formatEntryLine(item.entry);
    return '';
}

export function buildCommsOsView(session, notebook, radioState) {
    session = session || createCommsState();
    var target = formatChannelTarget(radioState);
    var items;
    var lines = [];
    var footer;
    var status;
    var focusLine = -1;
    var i;
    var start;

    if (session.screen === COMMS_COMPOSE_TEXT) {
        lines = [
            'NOVÁ SMS',
            target.line,
            'T9 editor',
            '',
            '',
            ''
        ];
        return {
            mode: 'comms',
            status: 'SMS · ' + target.freq + ' MHz',
            lines: lines,
            focusLine: -1,
            footer: 'OK = TX · Zpět',
            buffer: ''
        };
    }

    if (session.screen === COMMS_COMPOSE_PTT) {
        lines = [
            'NOVÁ PTT',
            target.line,
            session.pttActive ? '● NAHRÁVÁM…' : 'Drž OK = TX',
            session.pttActive ? 'Pusť = odešli' : 'max 8 s',
            '',
            ''
        ];
        return {
            mode: 'comms',
            status: 'PTT · ' + target.freq + ' MHz',
            lines: lines,
            focusLine: -1,
            footer: session.pttActive ? 'Nahrávám…' : 'Drž OK · Zpět',
            buffer: ''
        };
    }

    items = clampCommsFocus(session, notebook);
    start = 0;
    if (session.focusIndex >= DISPLAY_LINES) {
        start = session.focusIndex - DISPLAY_LINES + 1;
    }
    if (start + DISPLAY_LINES > items.length) {
        start = Math.max(0, items.length - DISPLAY_LINES);
    }
    for (i = 0; i < DISPLAY_LINES; i++) {
        var idx = start + i;
        lines.push(idx < items.length ? formatItem(items[idx]) : '');
    }
    focusLine = items.length ? session.focusIndex - start : -1;

    if (session.screen === COMMS_HUB) {
        status = 'SMS / PTT · ' + target.freq;
        footer = 'OK · Zpět';
    } else if (session.screen === COMMS_NEW_TYPE) {
        status = 'NOVÁ · ' + target.line;
        footer = 'OK · Zpět';
    } else if (session.screen === COMMS_INBOX) {
        status = 'PŘIJATÉ · ' + target.freq;
        footer = 'Zpět';
    } else {
        status = 'ODESLANÉ · ' + target.freq;
        footer = 'Zpět';
    }

    return {
        mode: 'comms',
        status: status,
        lines: lines,
        focusLine: focusLine,
        footer: footer,
        buffer: ''
    };
}

export function commsBackScreen(session) {
    if (!session) return 'exit';
    if (session.screen === COMMS_HUB) return 'exit';
    if (session.screen === COMMS_NEW_TYPE) return COMMS_HUB;
    if (session.screen === COMMS_INBOX || session.screen === COMMS_OUTBOX) return COMMS_HUB;
    if (session.screen === COMMS_COMPOSE_TEXT || session.screen === COMMS_COMPOSE_PTT) {
        return COMMS_NEW_TYPE;
    }
    return COMMS_HUB;
}

export function getFocusedCommsAction(session, notebook) {
    var items = clampCommsFocus(session, notebook);
    return items[session.focusIndex] || null;
}
