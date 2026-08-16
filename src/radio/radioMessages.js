/**
 * SMS — hub, seznamy, compose, detail, potvrzení odeslání.
 */
import { findPreset, normalizeFrequency, formatTime } from './radioComms.js';

var DISPLAY_LINES = 6;
var LINE_CHARS = 18;

export var COMMS_HUB = 'hub';
export var COMMS_INBOX = 'inbox';
export var COMMS_OUTBOX = 'outbox';
export var COMMS_DRAFTS = 'drafts';
export var COMMS_COMPOSE = 'compose';
export var COMMS_CONFIRM = 'confirm';
export var COMMS_DETAIL = 'detail';

export function createCommsState() {
    return {
        screen: COMMS_HUB,
        focusIndex: 0,
        pendingText: '',
        pendingTarget: null,
        detailEntry: null,
        detailPlaying: false,
        confirmFocus: 0
    };
}

export function formatChannelTarget(radioState, override) {
    override = override || {};
    radioState = radioState || {};
    var freq = normalizeFrequency(override.frequency != null ? override.frequency : radioState.frequency) || '---.---';
    var slot = override.presetSlot != null ? override.presetSlot : radioState.activePresetSlot;
    var preset = slot ? findPreset(radioState, slot) : null;
    var label = override.label || (preset && preset.label ? preset.label : (slot ? ('P' + slot) : 'RUČNĚ'));
    return {
        freq: freq,
        label: label,
        frequency: freq,
        presetSlot: slot || null,
        encryptionKey: override.encryptionKey != null ? override.encryptionKey : (radioState.encryptionKey || ''),
        line: label + ' · ' + freq + ' MHz'
    };
}

function formatDateShort(ts) {
    var d = new Date(ts || Date.now());
    var day = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
    return day + ' ' + formatTime(ts);
}

function filterEntries(notebook, opts) {
    opts = opts || {};
    var entries = (notebook && notebook.station) ? notebook.station : [];
    var out = [];
    var i;
    for (i = entries.length - 1; i >= 0; i--) {
        var e = entries[i];
        if (!e || e.id === 'sys_welcome') continue;
        if (opts.dir && e.dir !== opts.dir) continue;
        if (opts.savedOnly && !e.savedPermanent) continue;
        out.push(e);
    }
    return out;
}

function filterDrafts(notebook) {
    var drafts = (notebook && notebook.drafts) ? notebook.drafts : [];
    return drafts.slice().reverse();
}

function formatEntryLine(entry) {
    if (!entry) return { text: '', bold: false };
    var arrow = entry.dir === 'out' ? '↑' : '↓';
    var who = String(entry.from || '?').slice(0, 5);
    var text = String(entry.text || '').replace(/\s+/g, ' ').trim();
    if (entry.messageType === 'ptt' || /^\[PTT/.test(text)) text = text || '[PTT]';
    var when = formatDateShort(entry.ts);
    var line = when + ' ' + arrow + who + ' ' + text;
    if (line.length > LINE_CHARS) line = line.slice(0, LINE_CHARS - 1) + '…';
    var bold = entry.dir === 'in' && entry.read === false;
    return { text: line, bold: bold };
}

function formatItem(item) {
    if (!item) return { text: '', bold: false };
    if (item.label) return { text: item.label, bold: false };
    if (item.type === 'draft') {
        return { text: '✎ ' + formatDateShort(item.draft.ts) + ' ' + String(item.draft.text || '').slice(0, 12), bold: false };
    }
    if (item.type === 'msg') return formatEntryLine(item.entry);
    return { text: '', bold: false };
}

function pushFormattedLine(lines, lineStyles, formatted) {
    var f = formatted;
    if (typeof f === 'string') f = { text: f, bold: false };
    lines.push(f.text || '');
    lineStyles.push(!!f.bold);
}

function hubItems() {
    return [
        { type: 'action', id: 'new_sms', label: '1 · NOVÁ SMS', digit: '1' },
        { type: 'action', id: 'inbox', label: '2 · PŘIJATÉ', digit: '2' },
        { type: 'action', id: 'outbox', label: '3 · ODESLANÉ', digit: '3' },
        { type: 'action', id: 'drafts', label: '4 · ROZPRACOVANÉ', digit: '4' }
    ];
}

function confirmItems() {
    return [
        { type: 'action', id: 'send_yes', label: 'ANO · ODESLAT' },
        { type: 'action', id: 'send_later', label: 'ULOŽIT NA POZDĚJI' },
        { type: 'action', id: 'send_no', label: 'NE · ZRUŠIT' }
    ];
}

function detailActions(entry) {
    if (!entry) return [];
    var isPtt = entry.messageType === 'ptt' || /^\[PTT/.test(String(entry.text || ''));
    if (isPtt) {
        return [
            { type: 'action', id: 'ptt_play', label: '▶ PŘEHRAJ / ⏸ STOP' },
            { type: 'action', id: 'save_perm', label: 'TRVALE ULOŽIT' },
            { type: 'action', id: 'delete', label: 'SMAZAT' }
        ];
    }
    return [
        { type: 'action', id: 'save_perm', label: 'TRVALE ULOŽIT' },
        { type: 'action', id: 'delete', label: 'SMAZAT' }
    ];
}

function listItems(items, emptyLabel) {
    if (!items.length) return [{ type: 'empty', label: emptyLabel }];
    var out = [];
    var i;
    for (i = 0; i < items.length; i++) {
        out.push(items[i].draft ? { type: 'draft', draft: items[i] } : { type: 'msg', entry: items[i] });
    }
    return out;
}

export function getCommsItems(session, notebook) {
    session = session || createCommsState();
    if (session.screen === COMMS_HUB) return hubItems();
    if (session.screen === COMMS_CONFIRM) return confirmItems();
    if (session.screen === COMMS_DETAIL) return detailActions(session.detailEntry);
    if (session.screen === COMMS_INBOX) return listItems(filterEntries(notebook, { dir: 'in' }), '(žádné přijaté)');
    if (session.screen === COMMS_OUTBOX) return listItems(filterEntries(notebook, { dir: 'out' }), '(žádné odeslané)');
    if (session.screen === COMMS_DRAFTS) return listItems(filterDrafts(notebook), '(žádné koncepty)');
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

export function buildCommsOsView(session, notebook, radioState) {
    session = session || createCommsState();
    var target = session.pendingTarget || formatChannelTarget(radioState);
    var items;
    var lines = [];
    var lineStyles = [];
    var footer;
    var status;
    var focusLine = -1;
    var i;
    var start;

    if (session.screen === COMMS_COMPOSE) {
        lines = [
            'KOMU: ' + target.line,
            'OK = změnit cíl',
            'T9 editor',
            '',
            '',
            ''
        ];
        return {
            mode: 'comms',
            status: 'NOVÁ SMS',
            lines: lines,
            focusLine: -1,
            footer: 'OK dokončit · Zpět maže',
            buffer: ''
        };
    }

    if (session.screen === COMMS_CONFIRM) {
        var preview = String(session.pendingText || '').slice(0, 16);
        lines = [
            'ODESLAT?',
            target.line,
            '"' + preview + '"',
            '',
            '',
            ''
        ];
        items = clampCommsFocus(session, notebook);
        for (i = 0; i < DISPLAY_LINES; i++) {
            if (i < items.length) pushFormattedLine(lines, lineStyles, formatItem(items[i]));
            else lines[i] = lines[i] || '';
        }
        focusLine = session.focusIndex;
        return {
            mode: 'comms',
            status: 'POTVRzení TX',
            lines: lines,
            lineStyles: lineStyles,
            focusLine: focusLine,
            footer: 'OK · Zpět',
            buffer: ''
        };
    }

    if (session.screen === COMMS_DETAIL && session.detailEntry) {
        var e = session.detailEntry;
        var isPtt = e.messageType === 'ptt' || /^\[PTT/.test(String(e.text || ''));
        if (isPtt) {
            lines = [
                formatDateShort(e.ts) + ' ' + (e.from || '?'),
                String(e.text || '[PTT]'),
                session.detailPlaying ? '▶ PŘehrávám…' : '⏸ Zastaveno',
                '————————————',
                '',
                ''
            ];
        } else {
            var body = String(e.text || '');
            var wrapped = body.match(/.{1,18}/g) || [''];
            lines = [
                formatDateShort(e.ts) + ' ' + (e.from || '?'),
                wrapped[0] || '',
                wrapped[1] || '',
                wrapped[2] || '',
                '',
                ''
            ];
        }
        items = clampCommsFocus(session, notebook);
        focusLine = session.focusIndex;
        return {
            mode: 'comms',
            status: isPtt ? 'PTT · DETAIL' : 'SMS · DETAIL',
            lines: lines,
            focusLine: focusLine,
            footer: 'OK · Zpět',
            buffer: ''
        };
    }

    items = clampCommsFocus(session, notebook);
    start = 0;
    if (session.focusIndex >= DISPLAY_LINES) start = session.focusIndex - DISPLAY_LINES + 1;
    if (start + DISPLAY_LINES > items.length) start = Math.max(0, items.length - DISPLAY_LINES);
    for (i = 0; i < DISPLAY_LINES; i++) {
        var idx = start + i;
        if (idx < items.length) pushFormattedLine(lines, lineStyles, formatItem(items[idx]));
        else lines.push('');
    }
    focusLine = items.length ? session.focusIndex - start : -1;

    if (session.screen === COMMS_HUB) {
        status = 'SMS · ' + target.freq;
        footer = 'Čísla · OK · Zpět';
    } else if (session.screen === COMMS_INBOX) {
        status = 'PŘIJATÉ';
        footer = 'OK detail · Zpět';
    } else if (session.screen === COMMS_OUTBOX) {
        status = 'ODESLANÉ';
        footer = 'OK detail · Zpět';
    } else if (session.screen === COMMS_DRAFTS) {
        status = 'ROZPRACOVANÉ';
        footer = 'OK pokračovat · Zpět';
    } else {
        status = 'SMS';
        footer = 'OK · Zpět';
    }

    return {
        mode: 'comms',
        status: status,
        lines: lines,
        lineStyles: lineStyles,
        focusLine: focusLine,
        footer: footer,
        buffer: ''
    };
}

export function commsBackScreen(session) {
    if (!session) return 'exit';
    if (session.screen === COMMS_HUB) return 'exit';
    if (session.screen === COMMS_CONFIRM) return COMMS_COMPOSE;
    if (session.screen === COMMS_COMPOSE) return COMMS_HUB;
    if (session.screen === COMMS_DETAIL) {
        session.detailEntry = null;
        return session.detailReturn || COMMS_INBOX;
    }
    return COMMS_HUB;
}

export function getFocusedCommsAction(session, notebook) {
    var items = clampCommsFocus(session, notebook);
    return items[session.focusIndex] || null;
}

export function hubActionFromDigit(digit) {
    if (digit === '1') return 'new_sms';
    if (digit === '2') return 'inbox';
    if (digit === '3') return 'outbox';
    if (digit === '4') return 'drafts';
    return null;
}

export function markCommsEntryRead(entry) {
    if (!entry || entry.dir !== 'in') return false;
    if (entry.read !== false) return false;
    entry.read = true;
    return true;
}
