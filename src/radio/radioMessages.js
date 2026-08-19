/**
 * SMS — hub, seznamy, compose, detail, potvrzení odeslání.
 */
import { findPreset, normalizeFrequency, formatTime } from './radioComms.js';
import { decorateMenuLabel, findQuickKeyForAction } from './radioShortcuts.js';

var DISPLAY_LINES = 6;
var LINE_CHARS = 18;

export var COMMS_HUB = 'hub';
export var COMMS_INBOX = 'inbox';
export var COMMS_OUTBOX = 'outbox';
export var COMMS_DRAFTS = 'drafts';
export var COMMS_AUTOSCAN = 'autoscan';
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

function filterAutoscanCaptures(notebook) {
    var list = (notebook && notebook.autoscan) ? notebook.autoscan : [];
    return list.slice().reverse();
}

export function appendAutoscanCapture(notebook, capture) {
    if (!notebook || !capture) return false;
    if (!Array.isArray(notebook.autoscan)) notebook.autoscan = [];
    var id = capture.id || capture.entryId;
    if (id) {
        var i;
        for (i = 0; i < notebook.autoscan.length; i++) {
            if (notebook.autoscan[i] && (notebook.autoscan[i].id === id || notebook.autoscan[i].entryId === id)) {
                return false;
            }
        }
    }
    notebook.autoscan.unshift({
        id: capture.id || ('scan_' + Date.now()),
        entryId: capture.entryId || null,
        ts: capture.ts || Date.now(),
        frequency: capture.frequency || '',
        encryptionKey: capture.encryptionKey || '',
        text: capture.text || '',
        encrypted: !!capture.encrypted,
        presetLabel: capture.presetLabel || '',
        presetSlot: capture.presetSlot || null,
        read: false
    });
    if (notebook.autoscan.length > 64) notebook.autoscan.length = 64;
    return true;
}

function formatScanCaptureLine(capture, radioState) {
    if (!capture) return { text: '', bold: false };
    var channel = formatEntryChannelLabel(capture, radioState);
    var text = String(capture.text || '').replace(/\s+/g, ' ').trim();
    if (capture.encrypted && !text) text = '[ŠIFROVANÝ]';
    if (!text) text = '[ZACHYCENO]';
    var when = formatDateShort(capture.ts);
    return {
        text: when + ' ◎ ' + channel + ' ' + text,
        bold: capture.read !== true
    };
}
function formatEntryChannelLabel(entry, radioState) {
    if (!entry) return '?';
    if (entry.presetSlot && radioState) {
        var preset = findPreset(radioState, entry.presetSlot);
        if (preset && preset.label) return String(preset.label).slice(0, 9);
    }
    if (entry.presetLabel) return String(entry.presetLabel).slice(0, 9);
    var freq = normalizeFrequency(entry.frequency);
    return freq || '?';
}

function filterDrafts(notebook) {
    var drafts = (notebook && notebook.drafts) ? notebook.drafts : [];
    return drafts.slice().reverse();
}

function formatEntryLine(entry, radioState) {
    if (!entry) return { text: '', bold: false };
    var arrow = entry.dir === 'out' ? '↑' : '↓';
    var channel = formatEntryChannelLabel(entry, radioState);
    var text = String(entry.text || '').replace(/\s+/g, ' ').trim();
    if (entry.messageType === 'ptt' || /^\[PTT/.test(text)) text = text || '[PTT]';
    var when = formatDateShort(entry.ts);
    var line = when + ' ' + arrow + ' ' + channel + ' ' + text;
    var bold = entry.dir === 'in' && entry.read !== true;
    return { text: line, bold: bold };
}

function commsActionId(item) {
    if (!item || item.type !== 'action') return null;
    if (item.id === 'new_sms') return 'comms:new_sms';
    if (item.id === 'inbox') return 'comms:inbox';
    if (item.id === 'outbox') return 'comms:outbox';
    if (item.id === 'drafts') return 'comms:drafts';
    if (item.id === 'autoscan') return 'comms:autoscan';
    if (item.id === 'send_yes') return 'comms:send';
    return null;
}

function formatItem(item, radioState) {
    if (!item) return { text: '', bold: false };
    if (item.label) {
        var actionId = commsActionId(item);
        var key = actionId && radioState ? findQuickKeyForAction(radioState, actionId) : null;
        return { text: key ? decorateMenuLabel(item.label, key) : item.label, bold: false };
    }
    if (item.type === 'draft') {
        return { text: '✎ ' + formatDateShort(item.draft.ts) + ' ' + String(item.draft.text || '').slice(0, 12), bold: false };
    }
    if (item.type === 'scan') return formatScanCaptureLine(item.capture, radioState);
    if (item.type === 'msg') return formatEntryLine(item.entry, radioState);
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
        { type: 'action', id: 'drafts', label: '4 · KONCEPTY', digit: '4' },
        { type: 'action', id: 'autoscan', label: '5 · AUTOSKEN (spustit)', digit: '5' }
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
    if (session.screen === COMMS_DETAIL) {
        if (session.detailReturn === COMMS_AUTOSCAN) {
            return [{ type: 'action', id: 'delete', label: 'SMAZAT' }];
        }
        return detailActions(session.detailEntry);
    }
    if (session.screen === COMMS_INBOX) return listItems(filterEntries(notebook, { dir: 'in' }), '(žádné přijaté)');
    if (session.screen === COMMS_OUTBOX) return listItems(filterEntries(notebook, { dir: 'out' }), '(žádné odeslané)');
    if (session.screen === COMMS_DRAFTS) return listItems(filterDrafts(notebook), '(žádné koncepty)');
    if (session.screen === COMMS_AUTOSCAN) {
        var captures = filterAutoscanCaptures(notebook);
        if (!captures.length) return [{ type: 'empty', label: '(žádné zachycení)' }];
        var scanItems = [];
        for (i = 0; i < captures.length; i++) {
            scanItems.push({ type: 'scan', capture: captures[i] });
        }
        return scanItems;
    }
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
            if (i < items.length) pushFormattedLine(lines, lineStyles, formatItem(items[i], radioState));
            else {
                lines.push('');
                lineStyles.push(false);
            }
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
        var isScanCapture = session.detailReturn === COMMS_AUTOSCAN || (e.id && String(e.id).indexOf('scan_') === 0);
        var isPtt = !isScanCapture && (e.messageType === 'ptt' || /^\[PTT/.test(String(e.text || '')));
        if (isPtt) {
            lines = [
                formatDateShort(e.ts) + ' ' + formatEntryChannelLabel(e, radioState),
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
                formatDateShort(e.ts) + ' ' + formatEntryChannelLabel(e, radioState),
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
            status: isScanCapture ? 'AUTOSKEN · DETAIL' : (isPtt ? 'PTT · DETAIL' : 'SMS · DETAIL'),
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
        if (idx < items.length) pushFormattedLine(lines, lineStyles, formatItem(items[idx], radioState));
        else {
            lines.push('');
            lineStyles.push(false);
        }
    }
    focusLine = items.length ? session.focusIndex - start : -1;

    if (session.screen === COMMS_HUB) {
        status = 'ZPRÁVY';
        footer = 'Čísla · OK · Zpět';
    } else if (session.screen === COMMS_INBOX) {
        status = 'PŘIJATÉ';
        footer = 'OK detail · Zpět';
    } else if (session.screen === COMMS_OUTBOX) {
        status = 'ODESLANÉ';
        footer = 'OK detail · Zpět';
    } else if (session.screen === COMMS_DRAFTS) {
        status = 'KONCEPTY';
        footer = 'OK pokračovat · Zpět';
    } else if (session.screen === COMMS_AUTOSCAN) {
        status = 'AUTOSKEN';
        footer = 'OK detail · Zpět';
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
    if (session.screen === COMMS_CONFIRM) return COMMS_HUB;
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
    if (digit === '5') return 'autoscan';
    return null;
}

export function markCommsEntryRead(entry) {
    if (!entry || entry.dir !== 'in') return false;
    if (entry.read === true) return false;
    entry.read = true;
    return true;
}

export function markAutoscanCaptureRead(capture) {
    if (!capture) return false;
    if (capture.read === true) return false;
    capture.read = true;
    return true;
}
