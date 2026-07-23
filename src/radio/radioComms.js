/**
 * Rádiová komunikace — frekvence, šifrování, presety, sešit (příchozí/odchozí).
 * Kanál (zatím): frekvence + šifrovací heslo. Pásmo/ladění: radioBand.js.
 */
import {
    BAND_MIN_MHZ,
    BAND_MAX_MHZ,
    TUNE_STEP_MHZ,
    EMERGENCY_FREQUENCY,
    EMERGENCY_ENCRYPTION,
    GLOBAL_FREQUENCY,
    GLOBAL_ENCRYPTION,
    normalizeFrequency,
    formatFrequency,
    stepFrequency,
    channelFromCode,
    frequencyChannelId,
    buildDefaultDialPresets,
    findDialIndex,
    parseFrequencyMHz
} from './radioBand.js';

export {
    BAND_MIN_MHZ,
    BAND_MAX_MHZ,
    TUNE_STEP_MHZ,
    EMERGENCY_FREQUENCY,
    EMERGENCY_ENCRYPTION,
    GLOBAL_FREQUENCY,
    GLOBAL_ENCRYPTION,
    normalizeFrequency,
    formatFrequency,
    stepFrequency,
    channelFromCode,
    frequencyChannelId,
    buildDefaultDialPresets,
    findDialIndex
};

export const NOTEBOOK_TABS = ['station', 'notes', 'grids'];
export const NOTEBOOK_TAB_LABELS = {
    station: 'Staniční list',
    notes: 'Poznámky',
    grids: 'Gridy'
};

/** Počet řádků na jeden A4 list sešitu. */
export const NOTEBOOK_LINES_PER_PAGE = 16;
/** Odhad znaků na jeden řádek (Patrick Hand, užší sešit). */
export const NOTEBOOK_CHARS_PER_LINE = 58;

export const CHANNEL_SCOPE_LABELS = {
    global: 'GLOB',
    community: 'KOM',
    private: 'SOUK'
};

export function normalizeEncryptionKey(value) {
    return String(value || '').trim().toLowerCase();
}

export function hashChannelId(frequency, encryptionKey) {
    var raw = normalizeFrequency(frequency) + '|' + normalizeEncryptionKey(encryptionKey);
    var h = 5381;
    for (var i = 0; i < raw.length; i++) {
        h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
    }
    return 'ch_' + h.toString(16);
}

export function communityFrequencyFromCode(comCode) {
    return channelFromCode(comCode, 435);
}

export function communityEncryptionDefault(comCode, comName) {
    var base = String(comName || comCode || 'komunita').trim().toLowerCase();
    var word = base.split(/\s+/)[0].replace(/[^a-z0-9áčďéěíňóřšťúůýž]/gi, '');
    return word.slice(0, 16) || 'tabor';
}

export function getCommunityRadioKey(comCode, comName) {
    comCode = String(comCode || '').trim().toUpperCase();
    if (!comCode) return '';
    try {
        var stored = localStorage.getItem('patrac_com_radio_key_' + comCode);
        if (stored) return stored;
    } catch (e) {}
    return communityEncryptionDefault(comCode, comName);
}

export function classifyChannel(frequency, encryptionKey, ctx) {
    ctx = ctx || {};
    var freq = normalizeFrequency(frequency);
    var key = normalizeEncryptionKey(encryptionKey);
    if (!freq) return 'private';

    if (freq === normalizeFrequency(EMERGENCY_FREQUENCY) && key === normalizeEncryptionKey(EMERGENCY_ENCRYPTION)) {
        return 'global';
    }

    if (ctx.comCode) {
        var comFreq = communityFrequencyFromCode(ctx.comCode);
        var comKey = normalizeEncryptionKey(ctx.communityRadioKey || communityEncryptionDefault(ctx.comCode, ctx.comName));
        if (freq === comFreq && key === comKey) return 'community';
    }

    return 'private';
}

export function defaultRadioState(userId, ctx) {
    ctx = ctx || {};
    var comFreq = communityFrequencyFromCode(ctx.comCode);
    var comKey = ctx.comCode ? getCommunityRadioKey(ctx.comCode, ctx.comName) : '';
    var presets = buildDefaultDialPresets({
        comCode: ctx.comCode,
        comFreq: comFreq,
        comKey: comKey
    });
    return {
        frequency: comFreq,
        encryptionKey: comKey,
        keypadMode: 'tx',
        dialBuffer: '',
        activePresetSlot: 1,
        presets: presets
    };
}

function radioStateKey(userId) {
    return 'patrac_radio_state_' + (userId || 'local');
}

function notebookKey(userId) {
    return 'patrac_radio_notebook_' + (userId || 'local');
}

export function loadRadioState(userId, ctx) {
    var key = radioStateKey(userId);
    var base = defaultRadioState(userId, ctx);
    try {
        var raw = localStorage.getItem(key);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (!parsed.presets || parsed.presets.length < 8) parsed.presets = base.presets;
            if (!parsed.frequency) parsed.frequency = base.frequency;
            else parsed.frequency = normalizeFrequency(parsed.frequency) || base.frequency;
            if (parsed.encryptionKey == null) parsed.encryptionKey = base.encryptionKey;
            if (!parsed.keypadMode) parsed.keypadMode = 'tx';
            if (!parsed.dialBuffer) parsed.dialBuffer = '';
            if (parsed.activePresetSlot == null) parsed.activePresetSlot = 1;
            return parsed;
        }
    } catch (e) {}
    return base;
}

export function saveRadioState(userId, state) {
    try {
        localStorage.setItem(radioStateKey(userId), JSON.stringify(state));
    } catch (e) {}
}

function migrateNotebook(raw) {
    if (raw && Array.isArray(raw.station)) {
        if (!raw.pageIndex) raw.pageIndex = { station: 0, notes: 0, grids: 0 };
        if (!Array.isArray(raw.notes)) raw.notes = [];
        if (!Array.isArray(raw.grids)) raw.grids = [];
        if (raw.pageIndex.grids == null) raw.pageIndex.grids = 0;
        return raw;
    }
    var station = [];
    if (raw && typeof raw === 'object') {
        var legacy = ['private', 'community', 'global', 'station'];
        for (var i = 0; i < legacy.length; i++) {
            var key = legacy[i];
            if (key === 'station' && Array.isArray(raw.station)) continue;
            if (Array.isArray(raw[key])) station = station.concat(raw[key]);
        }
    }
    station.sort(function(a, b) { return (a.ts || 0) - (b.ts || 0); });
    return {
        station: station,
        notes: [],
        grids: [],
        pageIndex: { station: 0, notes: 0, grids: 0 }
    };
}

export function loadNotebook(userId) {
    try {
        var raw = localStorage.getItem(notebookKey(userId));
        if (raw) return migrateNotebook(JSON.parse(raw));
    } catch (e) {}
    return { station: [], notes: [], grids: [], pageIndex: { station: 0, notes: 0, grids: 0 } };
}

export function saveNotebook(userId, notebook) {
    try {
        localStorage.setItem(notebookKey(userId), JSON.stringify(notebook));
    } catch (e) {}
}

export function appendNotebookEntry(notebook, tab, entry) {
    if (!notebook[tab]) notebook[tab] = [];
    notebook[tab].push(entry);
    if (notebook[tab].length > 800) notebook[tab] = notebook[tab].slice(-800);
    return notebook;
}

export function getNotebookPageCount(notebook, tab, linesPerPage) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var list = notebook[tab] || [];
    return Math.max(1, Math.ceil(list.length / linesPerPage));
}

export function getNotebookPageEntries(notebook, tab, pageIndex, linesPerPage) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var list = notebook[tab] || [];
    var start = pageIndex * linesPerPage;
    return list.slice(start, start + linesPerPage);
}

export function getNotebookPageIndexForEntry(notebook, tab, entryIndex, linesPerPage) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    return Math.floor(entryIndex / linesPerPage);
}

export function formatTime(ts) {
    var d = new Date(ts || Date.now());
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
}

export function maskEncryptionKey(key) {
    key = String(key || '');
    if (!key) return '—';
    if (key.length <= 2) return '**';
    return key.slice(0, 2) + '*'.repeat(Math.min(key.length - 2, 6));
}

export function formatNotebookLine(entry) {
    var arrow = entry.dir === 'out' ? '↑' : '↓';
    var who = entry.from || '—';
    var freq = entry.frequency ? (' · ' + entry.frequency) : '';
    var sig = '';
    if (entry.dir === 'in' && entry.signalQuality === 'weak') sig = ' [slabý]';
    else if (entry.dir === 'in' && entry.signalQuality === 'noise') sig = ' [šum]';
    return arrow + ' ' + formatTime(entry.ts) + '  ' + who + ': ' + entry.text + freq + sig;
}

export function wrapNotebookText(text, maxChars) {
    text = String(text || '').trim();
    maxChars = maxChars || NOTEBOOK_CHARS_PER_LINE;
    if (!text) return [''];
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    var i;
    for (i = 0; i < words.length; i++) {
        var word = words[i];
        if (!line) {
            if (word.length > maxChars) {
                while (word.length > maxChars) {
                    lines.push(word.slice(0, maxChars));
                    word = word.slice(maxChars);
                }
                line = word;
            } else {
                line = word;
            }
            continue;
        }
        var next = line + ' ' + word;
        if (next.length <= maxChars) {
            line = next;
            continue;
        }
        lines.push(line);
        if (word.length > maxChars) {
            while (word.length > maxChars) {
                lines.push(word.slice(0, maxChars));
                word = word.slice(maxChars);
            }
            line = word;
        } else {
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

export function expandPlainNotebookLines(items, charsPerLine) {
    charsPerLine = charsPerLine || NOTEBOOK_CHARS_PER_LINE;
    items = items || [];
    var out = [];
    var i;
    for (i = 0; i < items.length; i++) {
        var wrapped = wrapNotebookText(items[i], charsPerLine);
        var j;
        for (j = 0; j < wrapped.length; j++) out.push(wrapped[j]);
    }
    return out;
}

export function expandStationEntriesToVisualLines(entries, charsPerLine) {
    charsPerLine = charsPerLine || NOTEBOOK_CHARS_PER_LINE;
    entries = entries || [];
    var out = [];
    var i;
    for (i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var wrapped = wrapNotebookText(formatNotebookLine(entry), charsPerLine);
        var j;
        for (j = 0; j < wrapped.length; j++) {
            out.push({
                text: wrapped[j],
                dir: entry.dir,
                entryIndex: i,
                wrapPart: j,
                isFirst: j === 0
            });
        }
    }
    return out;
}

export function getStationVisualPageCount(notebook, linesPerPage, charsPerLine) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var count = expandStationEntriesToVisualLines(notebook.station || [], charsPerLine).length;
    return Math.max(1, Math.ceil(count / linesPerPage));
}

export function getStationVisualPageLines(notebook, pageIndex, linesPerPage, charsPerLine) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var all = expandStationEntriesToVisualLines(notebook.station || [], charsPerLine);
    var start = pageIndex * linesPerPage;
    return all.slice(start, start + linesPerPage);
}

export function getStationVisualPageIndexForEntry(notebook, entryIndex, linesPerPage, charsPerLine) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var all = expandStationEntriesToVisualLines(notebook.station || [], charsPerLine);
    var i;
    for (i = all.length - 1; i >= 0; i--) {
        if (all[i].entryIndex === entryIndex) {
            return Math.floor(i / linesPerPage);
        }
    }
    return getStationVisualPageCount(notebook, linesPerPage, charsPerLine) - 1;
}

export function buildDisplayLines(state, ctx) {
    ctx = ctx || {};
    var freq = normalizeFrequency(state.frequency) || '---.---';
    var key = state.encryptionKey || '';
    var modeLabel = state.keypadMode === 'freq' ? 'NASTAV FREQ' :
        state.keypadMode === 'encrypt' ? 'NASTAV ŠIFRU' :
            state.keypadMode === 'preset-save' ? 'ULOŽ PRESET' : 'TX';
    var cipher = key ? 'CT' : 'PT';
    var presetLabel = 'DIAL · přímý zápis';
    var preset = state.activePresetSlot != null ? findPreset(state, state.activePresetSlot) : null;
    if (!preset && state.presets) {
        var di = findDialIndex(state.presets, state.frequency, null);
        if (di >= 0) preset = state.presets[di];
    }
    if (preset) {
        presetLabel = 'DIAL ' + preset.slot + '/' + (state.presets || []).length + ' · ' + (preset.label || 'KANÁL');
    }
    return {
        line1: freq + ' MHz  ' + cipher + '  ·  ' + modeLabel,
        line2: key ? ('ŠIFRA: ' + maskEncryptionKey(key)) : 'BEZ ŠIFRY — otevřený kanál',
        line3: presetLabel,
        footer: ctx.comCode ? (ctx.comName || ctx.comCode) : 'VOLNÝ KANÁL'
    };
}

export function findPreset(state, slot) {
    if (!state.presets) return null;
    for (var i = 0; i < state.presets.length; i++) {
        if (state.presets[i].slot === slot) return state.presets[i];
    }
    return null;
}

export function upsertPreset(state, slot, data) {
    state.presets = state.presets || [];
    var found = false;
    for (var i = 0; i < state.presets.length; i++) {
        if (state.presets[i].slot === slot) {
            state.presets[i] = Object.assign({}, state.presets[i], data, { slot: slot });
            found = true;
            break;
        }
    }
    if (!found) {
        state.presets.push(Object.assign({ slot: slot }, data));
    }
    state.presets.sort(function(a, b) { return a.slot - b.slot; });
    return state;
}

export function applyPreset(state, slot) {
    var preset = findPreset(state, slot);
    if (!preset) return false;
    state.frequency = preset.frequency;
    state.encryptionKey = preset.encryptionKey || '';
    state.activePresetSlot = slot;
    state.keypadMode = 'tx';
    state.dialBuffer = '';
    return true;
}

export function adjustFrequency(state, delta) {
    var steps = 1;
    if (typeof delta === 'number' && isFinite(delta) && TUNE_STEP_MHZ > 0) {
        steps = Math.round(delta / TUNE_STEP_MHZ) || (delta < 0 ? -1 : 1);
    }
    state.frequency = stepFrequency(state.frequency, steps);
    state.activePresetSlot = null;
    return state;
}

/** Hlavní kolečko — přepnutí na další/předchozí preset (ne krok 0.025 po pásmu). */
export function cycleDialPreset(state, direction) {
    var presets = state.presets || [];
    if (!presets.length) return false;
    var dir = direction < 0 ? -1 : 1;
    var idx = findDialIndex(presets, state.frequency, state.activePresetSlot);
    if (idx < 0) idx = dir > 0 ? -1 : 0;
    var next = (idx + dir + presets.length * 10) % presets.length;
    var p = presets[next];
    if (!p) return false;
    state.frequency = normalizeFrequency(p.frequency);
    state.encryptionKey = p.encryptionKey || '';
    state.activePresetSlot = p.slot;
    state.dialBuffer = '';
    state.keypadMode = 'tx';
    return true;
}

/**
 * Frekvence, které právě posloucháme (freq-first).
 * Zatím jen naladěný kanál — jako reálná vysílačka.
 */
export function collectTunedFrequencies(state) {
    var freq = normalizeFrequency(state && state.frequency);
    return freq ? [freq] : [];
}

/** @deprecated alias — dřív hash(freq|key), teď jen naladěné frekvence. */
export function collectKnownChannelIds(state, ctx) {
    return collectTunedFrequencies(state).map(frequencyChannelId);
}

export function createOutgoingEntry(text, ctx, state) {
    var tab = classifyChannel(state.frequency, state.encryptionKey, ctx);
    var freq = normalizeFrequency(state.frequency);
    var entry = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        dir: 'out',
        text: text,
        from: ctx.playerName || 'Ty',
        frequency: freq,
        encryptionKey: state.encryptionKey || '',
        channelId: frequencyChannelId(freq),
        scope: tab,
        comCode: ctx.comCode || '',
        ts: Date.now()
    };
    if (ctx.originLat != null && ctx.originLng != null) {
        entry.originLat = ctx.originLat;
        entry.originLng = ctx.originLng;
    }
    return entry;
}

export function createIncomingEntry(payload, ctx) {
    var tab = classifyChannel(payload.frequency, payload.encryptionKey, ctx);
    var freq = normalizeFrequency(payload.frequency);
    var entry = {
        id: payload.id || ('rx_' + Date.now()),
        dir: 'in',
        text: payload.text || '',
        from: payload.senderName || payload.from || 'Neznámý',
        frequency: freq,
        encryptionKey: payload.encryptionKey || '',
        channelId: payload.channelId || frequencyChannelId(freq),
        scope: tab,
        comCode: payload.comCode || '',
        ts: payload.timestamp || payload.ts || Date.now()
    };
    if (payload.signalQuality) entry.signalQuality = payload.signalQuality;
    if (payload.distanceKm != null) entry.distanceKm = payload.distanceKm;
    if (payload.originLat != null) entry.originLat = payload.originLat;
    if (payload.originLng != null) entry.originLng = payload.originLng;
    return entry;
}
