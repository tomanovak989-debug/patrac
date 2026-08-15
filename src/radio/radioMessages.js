/**
 * SMS / ZPRÁVY — seznam ze staničníku + nová zpráva.
 */
import { normalizeFrequency } from './radioComms.js';

var DISPLAY_LINES = 6;
var LINE_CHARS = 18;

export function createSmsState() {
    return { focusIndex: 0 };
}

export function buildSmsItems(notebook) {
    var items = [];
    var entries = (notebook && notebook.station) ? notebook.station : [];
    var i;
    for (i = entries.length - 1; i >= 0; i--) {
        var entry = entries[i];
        if (!entry || entry.id === 'sys_welcome') continue;
        items.push({ type: 'msg', entry: entry });
    }
    items.push({ type: 'compose' });
    return items;
}

export function formatSmsItem(item) {
    if (!item) return '';
    if (item.type === 'compose') return '→ NOVÁ ZPRÁVA';
    var e = item.entry;
    if (!e) return '';
    var arrow = e.dir === 'out' ? '↑' : '↓';
    var from = String(e.from || '?').slice(0, 5);
    var text = String(e.text || '').replace(/\s+/g, ' ').trim();
    var line = arrow + ' ' + from + ': ' + text;
    if (line.length > LINE_CHARS) line = line.slice(0, LINE_CHARS - 1) + '…';
    return line;
}

export function isSmsComposeFocus(smsSession, notebook) {
    smsSession = smsSession || { focusIndex: 0 };
    var items = buildSmsItems(notebook);
    if (!items.length) return true;
    return smsSession.focusIndex >= items.length - 1;
}

export function clampSmsFocus(smsSession, notebook) {
    var items = buildSmsItems(notebook);
    if (!items.length) {
        smsSession.focusIndex = 0;
        return items;
    }
    if (smsSession.focusIndex < 0) smsSession.focusIndex = 0;
    if (smsSession.focusIndex >= items.length) smsSession.focusIndex = items.length - 1;
    return items;
}

export function buildSmsOsView(os, operatingMode, smsSession, notebook, radioState) {
    smsSession = smsSession || createSmsState();
    var items = clampSmsFocus(smsSession, notebook);
    var start = 0;
    if (smsSession.focusIndex >= DISPLAY_LINES) {
        start = smsSession.focusIndex - DISPLAY_LINES + 1;
    }
    if (start + DISPLAY_LINES > items.length) {
        start = Math.max(0, items.length - DISPLAY_LINES);
    }

    var lines = [];
    var i;
    for (i = 0; i < DISPLAY_LINES; i++) {
        var idx = start + i;
        lines.push(idx < items.length ? formatSmsItem(items[idx]) : '');
    }

    var freq = normalizeFrequency(radioState && radioState.frequency) || '---.---';
    var isVoice = operatingMode !== 'text';
    var title = isVoice ? 'SMS / PTT' : 'SMS / ZPRÁVY';
    var footer = isVoice ? 'OK = TX · Zpět' : 'OK · Zpět';
    var countLabel = items.length > 1 ? String(smsSession.focusIndex + 1) + '/' + items.length : '';

    return {
        mode: 'sms',
        status: title + ' · ' + freq + ' MHz',
        lines: lines,
        focusLine: items.length ? smsSession.focusIndex - start : -1,
        footer: footer,
        buffer: countLabel
    };
}
