/**
 * UI vysílačky + sešit — frekvence, šifra, presety, příchozí/odchozí záznamy.
 */
import {
    loadRadioState,
    saveRadioState,
    loadNotebook,
    saveNotebook,
    appendNotebookEntry,
    formatNotebookLine,
    buildDisplayLines,
    applyPreset,
    upsertPreset,
    adjustFrequency,
    normalizeFrequency,
    normalizeEncryptionKey,
    classifyChannel,
    collectKnownChannelIds,
    createOutgoingEntry,
    createIncomingEntry,
    communityFrequencyFromCode,
    getCommunityRadioKey,
    GLOBAL_FREQUENCY,
    GLOBAL_ENCRYPTION,
    NOTEBOOK_TABS,
    NOTEBOOK_TAB_LABELS
} from './radioComms.js';
import { sendRadioTransmission, subscribeRadioChannels, stopRadioSubscriptions } from './radioService.js';

var ctx = {};
var state = null;
var notebook = null;
var activeNotebookTab = 'community';
var seenMessageIds = {};

function getCtx() {
    return {
        userId: ctx.getUserId ? ctx.getUserId() : '',
        playerName: ctx.getPlayerName ? ctx.getPlayerName() : 'Operativec',
        comCode: ctx.getComCode ? ctx.getComCode() : '',
        comName: ctx.getComName ? ctx.getComName() : '',
        communityRadioKey: ctx.getCommunityRadioKey ? ctx.getCommunityRadioKey() : getCommunityRadioKey(ctx.getComCode && ctx.getComCode(), ctx.getComName && ctx.getComName())
    };
}

function el(id) {
    return document.getElementById(id);
}

function updateInputForMode() {
    var input = el('chat-input-field');
    if (!input) return;
    if (state.keypadMode === 'freq') {
        input.placeholder = 'Nebo zadej frekvenci…';
        input.value = state.dialBuffer || '';
    } else if (state.keypadMode === 'encrypt') {
        input.placeholder = 'Šifrovací heslo (slovo)…';
        input.value = state.dialBuffer || '';
    } else {
        input.placeholder = 'Hlášení…';
    }
}

function renderDisplay() {
    var c = getCtx();
    var lines = buildDisplayLines(state, c);
    var f = el('radio-display-freq');
    var k = el('radio-display-key');
    var p = el('radio-display-preset');
    var foot = el('radio-display-com');
    var sig = el('radio-display-signal');
    var ch = el('radio-display-channel');
    if (f) f.textContent = lines.line1;
    if (k) k.textContent = lines.line2;
    if (p) p.textContent = lines.line3;
    if (foot) foot.textContent = lines.footer;
    if (sig) {
        var tuned = state.frequency && state.encryptionKey;
        sig.textContent = tuned ? '● TX/RX' : '○ STBY';
        sig.style.color = tuned ? '#8fdc68' : '#888';
    }
    if (ch) {
        var tab = classifyChannel(state.frequency, state.encryptionKey, c);
        ch.textContent = NOTEBOOK_TAB_LABELS[tab] || 'KANÁL';
    }
    var buf = el('radio-display-buffer');
    if (buf) {
        if (state.keypadMode === 'freq' || state.keypadMode === 'encrypt') {
            buf.textContent = state.dialBuffer ? ('▸ ' + state.dialBuffer) : '';
        } else {
            buf.textContent = '';
        }
    }
    updateInputForMode();
}

function renderNotebook() {
    var box = el('radio-notebook-lines');
    if (!box) return;
    var list = notebook[activeNotebookTab] || [];
    if (!list.length) {
        box.innerHTML = '<p class="radio-notebook-empty">Zatím žádné záznamy. Nalaď frekvenci a šifru, pak vysílej.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
        var entry = list[i];
        html += '<div class="radio-notebook-line radio-notebook-line-' + entry.dir + '">' + formatNotebookLine(entry) + '</div>';
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

function syncNotebookTabs() {
    var tabs = document.querySelectorAll('.radio-notebook-tab');
    for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i].getAttribute('data-tab');
        tabs[i].classList.toggle('active', tab === activeNotebookTab);
    }
}

function persist() {
    saveRadioState(getCtx().userId, state);
    saveNotebook(getCtx().userId, notebook);
}

function recordEntry(entry) {
    var tab = entry.scope || classifyChannel(entry.frequency, entry.encryptionKey, getCtx());
    if (!NOTEBOOK_TABS.includes(tab)) tab = 'private';
    appendNotebookEntry(notebook, tab, entry);
    persist();
    if (tab === activeNotebookTab) renderNotebook();
}

function refreshSubscriptions() {
    if (ctx.isLocalOnly && ctx.isLocalOnly()) return;
    var ids = collectKnownChannelIds(state, getCtx());
    subscribeRadioChannels(ids, function(payload) {
        var c = getCtx();
        if (payload.senderId && payload.senderId === c.userId) return;
        if (seenMessageIds[payload.id]) return;
        seenMessageIds[payload.id] = true;
        var entry = createIncomingEntry(payload, c);
        recordEntry(entry);
    });
}

function applyDialBuffer() {
    var input = el('chat-input-field');
    if (state.keypadMode === 'freq') {
        var raw = (state.dialBuffer || (input && input.value) || '').trim();
        if (raw) state.frequency = normalizeFrequency(raw);
    } else if (state.keypadMode === 'encrypt') {
        var keyRaw = (state.dialBuffer || (input && input.value) || '').trim();
        if (keyRaw) state.encryptionKey = normalizeEncryptionKey(keyRaw);
    }
    state.dialBuffer = '';
    state.keypadMode = 'tx';
    if (input) input.value = '';
    persist();
    renderDisplay();
    refreshSubscriptions();
}

function saveToPresetSlot(slot) {
    var label = prompt('Název presetu (např. Dvojka s Jardou):', 'Kanál ' + slot);
    if (label == null) return;
    var c = getCtx();
    var scope = classifyChannel(state.frequency, state.encryptionKey, c);
    upsertPreset(state, slot, {
        label: label || ('Preset ' + slot),
        frequency: state.frequency,
        encryptionKey: state.encryptionKey,
        scope: scope
    });
    state.activePresetSlot = slot;
    persist();
    renderDisplay();
    refreshSubscriptions();
}

async function transmitMessage(text) {
    text = String(text || '').trim();
    if (!text) return;
    if (!state.frequency || !state.encryptionKey) {
        alert('Nejdřív nalaď frekvenci (MODE → čísla) a zadej šifru (MODE → písmena).');
        return;
    }

    var c = getCtx();
    var entry = createOutgoingEntry(text, c, state);
    recordEntry(entry);
    renderNotebook();

    if (ctx.isLocalOnly && ctx.isLocalOnly()) return;

    try {
        await sendRadioTransmission({
            channelId: entry.channelId,
            frequency: entry.frequency,
            encryptionKey: entry.encryptionKey,
            scope: entry.scope,
            comCode: c.comCode,
            senderId: c.userId,
            senderName: c.playerName,
            text: text,
            timestamp: entry.ts
        });
    } catch (err) {
        console.warn('[radioUi] send', err);
    }
}

function bindKeypad() {
    var input = el('chat-input-field');
    if (input && !input._radioCommsBound) {
        input._radioCommsBound = true;
        input.addEventListener('input', function() {
            if (state.keypadMode === 'freq' || state.keypadMode === 'encrypt') {
                state.dialBuffer = input.value;
                renderDisplay();
            }
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (state.keypadMode === 'freq' || state.keypadMode === 'encrypt') {
                    applyDialBuffer();
                } else {
                    transmitMessage(input.value);
                    input.value = '';
                }
            }
        });
    }

    var ent = el('radio-key-ent');
    if (ent && !ent._radioCommsBound) {
        ent._radioCommsBound = true;
        ent.onclick = function() {
            if (state.keypadMode === 'freq' || state.keypadMode === 'encrypt') {
                applyDialBuffer();
                return;
            }
            if (input) {
                transmitMessage(input.value);
                input.value = '';
            }
        };
    }

    var clr = el('radio-key-clr');
    if (clr && !clr._radioCommsBound) {
        clr._radioCommsBound = true;
        clr.addEventListener('click', function() {
            state.dialBuffer = '';
            state.keypadMode = 'tx';
            if (input) input.value = '';
            persist();
            renderDisplay();
        });
    }

    var volUp = el('radio-key-vol-up');
    if (volUp && !volUp._radioCommsBound) {
        volUp._radioCommsBound = true;
        volUp.addEventListener('click', function() {
            state.keypadMode = 'freq';
            adjustFrequency(state, 0.025);
            persist();
            renderDisplay();
            refreshSubscriptions();
        });
    }

    var preUp = el('radio-key-pre-up');
    if (preUp && !preUp._radioCommsBound) {
        preUp._radioCommsBound = true;
        preUp.addEventListener('click', function() {
            var slots = (state.presets || []).map(function(p) { return p.slot; }).sort(function(a, b) { return a - b; });
            if (!slots.length) return;
            var cur = state.activePresetSlot || slots[0];
            var idx = slots.indexOf(cur);
            var next = slots[(idx + 1) % slots.length];
            applyPreset(state, next);
            persist();
            renderDisplay();
            refreshSubscriptions();
        });
    }

    var modeBtn = el('radio-key-mode');
    if (modeBtn && !modeBtn._radioCommsBound) {
        modeBtn._radioCommsBound = true;
        modeBtn.addEventListener('click', function() {
            if (state.keypadMode === 'tx') state.keypadMode = 'freq';
            else if (state.keypadMode === 'freq') state.keypadMode = 'encrypt';
            else state.keypadMode = 'tx';
            state.dialBuffer = '';
            renderDisplay();
        });
    }

    var grid = el('radio-keypad-grid');
    if (grid && !grid._radioCommsBound) {
        grid._radioCommsBound = true;
        grid.addEventListener('click', function(e) {
            var btn = e.target.closest('.radio-key[data-key]');
            if (!btn) return;
            var key = btn.getAttribute('data-key');

            if (key === 'prev') {
                adjustFrequency(state, -0.025);
                persist();
                renderDisplay();
                refreshSubscriptions();
                return;
            }
            if (key === 'next') {
                adjustFrequency(state, 0.025);
                persist();
                renderDisplay();
                refreshSubscriptions();
                return;
            }

            if (/^[0-9]$/.test(key)) {
                var slot = parseInt(key, 10);
                if (state.keypadMode === 'freq') {
                    state.dialBuffer = (state.dialBuffer || '') + key;
                    if (state.dialBuffer.length === 3 && state.dialBuffer.indexOf('.') === -1) {
                        state.dialBuffer += '.';
                    }
                    if (input) input.value = state.dialBuffer;
                    renderDisplay();
                    return;
                }
                if (state.keypadMode === 'encrypt') {
                    return;
                }
                if (key === '0') {
                    saveToPresetSlot(state.activePresetSlot || 1);
                    return;
                }
                if (e.shiftKey) {
                    saveToPresetSlot(slot);
                    return;
                }
                if (applyPreset(state, slot)) {
                    persist();
                    renderDisplay();
                    refreshSubscriptions();
                } else {
                    alert('Preset ' + slot + ' je prázdný. Nalaď kanál a ulož Shift+' + slot + '.');
                }
                return;
            }
        });
    }

    var tabs = document.querySelectorAll('.radio-notebook-tab');
    for (var t = 0; t < tabs.length; t++) {
        if (tabs[t]._radioCommsBound) continue;
        tabs[t]._radioCommsBound = true;
        tabs[t].addEventListener('click', function() {
            activeNotebookTab = this.getAttribute('data-tab') || 'community';
            syncNotebookTabs();
            renderNotebook();
        });
    }
}

export function initRadioCommsSystem(options) {
    ctx = options || {};
    var c = getCtx();
    state = loadRadioState(c.userId, c);
    notebook = loadNotebook(c.userId);
    seenMessageIds = {};

    if (!notebook.community.length) {
        appendNotebookEntry(notebook, 'community', {
            id: 'sys_welcome',
            dir: 'in',
            from: 'SYSTÉM',
            text: 'Nalaď frekvenci komunity a šifru. Kdo zná obojí, může odposlouchávat.',
            frequency: communityFrequencyFromCode(c.comCode),
            encryptionKey: getCommunityRadioKey(c.comCode, c.comName),
            scope: 'community',
            ts: Date.now()
        });
        saveNotebook(c.userId, notebook);
    }

    bindKeypad();
    syncNotebookTabs();
    renderDisplay();
    renderNotebook();
    refreshSubscriptions();
}

export function refreshRadioCommsContext() {
    if (!state) return;
    var c = getCtx();
    state = loadRadioState(c.userId, c);
    renderDisplay();
    refreshSubscriptions();
}

export function stopRadioComms() {
    stopRadioSubscriptions();
}

export function updateRadioDisplayHud() {
    refreshRadioCommsContext();
}
