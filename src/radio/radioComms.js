/**
 * Rádiová komunikace — frekvence, šifrování, presety, sešit (příchozí/odchozí).
 * Kanál = frekvence + šifrovací heslo. Kdo zná obojí, může odposlouchávat.
 */

export const GLOBAL_FREQUENCY = '121.500';
export const GLOBAL_ENCRYPTION = 'SOS';

export const NOTEBOOK_TABS = ['private', 'community', 'global'];
export const NOTEBOOK_TAB_LABELS = {
    private: 'Soukromé',
    community: 'Komunitní',
    global: 'Globální'
};

export function normalizeFrequency(value) {
    var s = String(value || '').trim().replace(',', '.');
    if (!s) return '';
    var m = s.match(/^(\d{1,3})\.?(\d{0,3})?/);
    if (!m) return s;
    var whole = m[1];
    var frac = (m[2] || '000').padEnd(3, '0').slice(0, 3);
    return whole + '.' + frac;
}

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
    comCode = String(comCode || '').trim().toUpperCase();
    if (!comCode) return '462.000';
    var n = 0;
    for (var i = 0; i < comCode.length; i++) {
        n = ((n * 31) + comCode.charCodeAt(i)) >>> 0;
    }
    return '462.' + String((n % 999) + 1).padStart(3, '0');
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
    if (!freq || !key) return 'private';

    if (freq === normalizeFrequency(GLOBAL_FREQUENCY) && key === normalizeEncryptionKey(GLOBAL_ENCRYPTION)) {
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
    var comFreq = ctx.comCode ? communityFrequencyFromCode(ctx.comCode) : '462.550';
    var comKey = ctx.comCode ? getCommunityRadioKey(ctx.comCode, ctx.comName) : '';
    return {
        frequency: comFreq,
        encryptionKey: comKey,
        keypadMode: 'tx',
        dialBuffer: '',
        activePresetSlot: null,
        presets: [
            {
                slot: 1,
                label: 'Komunita',
                frequency: comFreq,
                encryptionKey: comKey,
                scope: 'community'
            },
            {
                slot: 2,
                label: 'Globální',
                frequency: GLOBAL_FREQUENCY,
                encryptionKey: GLOBAL_ENCRYPTION,
                scope: 'global'
            }
        ]
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
    try {
        var raw = localStorage.getItem(key);
        if (raw) {
            var parsed = JSON.parse(raw);
            var base = defaultRadioState(userId, ctx);
            if (!parsed.presets || !parsed.presets.length) parsed.presets = base.presets;
            if (!parsed.frequency) parsed.frequency = base.frequency;
            if (parsed.encryptionKey == null) parsed.encryptionKey = base.encryptionKey;
            if (!parsed.keypadMode) parsed.keypadMode = 'tx';
            if (!parsed.dialBuffer) parsed.dialBuffer = '';
            return parsed;
        }
    } catch (e) {}
    return defaultRadioState(userId, ctx);
}

export function saveRadioState(userId, state) {
    try {
        localStorage.setItem(radioStateKey(userId), JSON.stringify(state));
    } catch (e) {}
}

export function loadNotebook(userId) {
    try {
        var raw = localStorage.getItem(notebookKey(userId));
        if (raw) {
            var parsed = JSON.parse(raw);
            return {
                private: Array.isArray(parsed.private) ? parsed.private : [],
                community: Array.isArray(parsed.community) ? parsed.community : [],
                global: Array.isArray(parsed.global) ? parsed.global : []
            };
        }
    } catch (e) {}
    return { private: [], community: [], global: [] };
}

export function saveNotebook(userId, notebook) {
    try {
        localStorage.setItem(notebookKey(userId), JSON.stringify(notebook));
    } catch (e) {}
}

export function appendNotebookEntry(notebook, tab, entry) {
    if (!notebook[tab]) notebook[tab] = [];
    notebook[tab].push(entry);
    if (notebook[tab].length > 200) notebook[tab] = notebook[tab].slice(-200);
    return notebook;
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
    return arrow + ' ' + formatTime(entry.ts) + '  ' + who + ': ' + entry.text + freq;
}

export function buildDisplayLines(state, ctx) {
    ctx = ctx || {};
    var freq = normalizeFrequency(state.frequency) || '---.---';
    var key = state.encryptionKey || '';
    var modeLabel = state.keypadMode === 'freq' ? 'NASTAV FREQ' :
        state.keypadMode === 'encrypt' ? 'NASTAV ŠIFRU' :
            state.keypadMode === 'preset-save' ? 'ULOŽ PRESET' : 'TX';
    var cipher = key ? 'CT' : 'PT';
    var presetLabel = '—';
    if (state.activePresetSlot) {
        var preset = findPreset(state, state.activePresetSlot);
        if (preset) presetLabel = 'PRE ' + preset.slot + ' · ' + (preset.label || 'KANÁL');
    }
    return {
        line1: freq + ' MHz  ' + cipher + '  ·  ' + modeLabel,
        line2: key ? ('ŠIFRA: ' + maskEncryptionKey(key)) : 'BEZ ŠIFRY — kanál není zabezpečen',
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
    var freq = parseFloat(normalizeFrequency(state.frequency));
    if (isNaN(freq)) freq = 462.5;
    freq = Math.max(118, Math.min(512, freq + delta));
    state.frequency = freq.toFixed(3);
    return state;
}

export function collectKnownChannelIds(state, ctx) {
    ctx = ctx || {};
    var ids = {};
    function add(freq, key) {
        if (!freq || !key) return;
        ids[hashChannelId(freq, key)] = true;
    }

    add(GLOBAL_FREQUENCY, GLOBAL_ENCRYPTION);

    if (ctx.comCode) {
        add(
            communityFrequencyFromCode(ctx.comCode),
            getCommunityRadioKey(ctx.comCode, ctx.comName)
        );
    }

    if (state.presets) {
        for (var i = 0; i < state.presets.length; i++) {
            var p = state.presets[i];
            add(p.frequency, p.encryptionKey);
        }
    }

    add(state.frequency, state.encryptionKey);
    return Object.keys(ids);
}

export function createOutgoingEntry(text, ctx, state) {
    var tab = classifyChannel(state.frequency, state.encryptionKey, ctx);
    return {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        dir: 'out',
        text: text,
        from: ctx.playerName || 'Ty',
        frequency: normalizeFrequency(state.frequency),
        encryptionKey: state.encryptionKey,
        channelId: hashChannelId(state.frequency, state.encryptionKey),
        scope: tab,
        comCode: ctx.comCode || '',
        ts: Date.now()
    };
}

export function createIncomingEntry(payload, ctx) {
    var tab = classifyChannel(payload.frequency, payload.encryptionKey, ctx);
    return {
        id: payload.id || ('rx_' + Date.now()),
        dir: 'in',
        text: payload.text || '',
        from: payload.senderName || payload.from || 'Neznámý',
        frequency: normalizeFrequency(payload.frequency),
        encryptionKey: payload.encryptionKey || '',
        channelId: payload.channelId || hashChannelId(payload.frequency, payload.encryptionKey),
        scope: tab,
        comCode: payload.comCode || '',
        ts: payload.timestamp || payload.ts || Date.now()
    };
}
