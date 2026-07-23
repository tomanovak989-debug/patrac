/**
 * UI vysílačky + sešit — frekvence, šifra, presety, příchozí/odchozí záznamy.
 */
import {
    loadRadioState,
    saveRadioState,
    loadNotebook,
    saveNotebook,
    appendNotebookEntry,
    buildDisplayLines,
    applyPreset,
    upsertPreset,
    cycleDialPreset,
    normalizeFrequency,
    normalizeEncryptionKey,
    classifyChannel,
    collectTunedFrequencies,
    createOutgoingEntry,
    createIncomingEntry,
    communityFrequencyFromCode,
    getCommunityRadioKey,
    GLOBAL_FREQUENCY,
    GLOBAL_ENCRYPTION,
    NOTEBOOK_TABS,
    NOTEBOOK_TAB_LABELS,
    NOTEBOOK_LINES_PER_PAGE,
    NOTEBOOK_CHARS_PER_LINE,
    CHANNEL_SCOPE_LABELS,
    getNotebookPageCount,
    expandPlainNotebookLines,
    getStationVisualPageCount,
    getStationVisualPageLines,
    getStationVisualPageIndexForEntry
} from './radioComms.js';
import { sendRadioTransmission, subscribeRadioChannels, stopRadioSubscriptions } from './radioService.js';
import {
    evaluateRadioReception,
    applyReceptionToMessage,
    noisePlaceholder,
    SIGNAL_NOISE
} from './radioPropagation.js';
import {
    getGridPageCount,
    getGridPage,
    renderGridPageHtml,
    copyGridLineText
} from './radioGrids.js';

var ctx = {};
var state = null;
var notebook = null;
var activeNotebookTab = 'station';
var seenMessageIds = {};
var flipTimer = null;

function ensureNotebookMeta() {
    if (!notebook.pageIndex) notebook.pageIndex = { station: 0, notes: 0, grids: 0 };
    if (!Array.isArray(notebook.grids)) notebook.grids = [];
}

function getCurrentPageIndex() {
    ensureNotebookMeta();
    return notebook.pageIndex[activeNotebookTab] || 0;
}

function setCurrentPageIndex(idx) {
    ensureNotebookMeta();
    notebook.pageIndex[activeNotebookTab] = Math.max(0, idx);
}

function triggerPageFlip(thenRender, direction) {
    var sheet = el('radio-notebook-sheet');
    if (!sheet) {
        if (thenRender) thenRender();
        return;
    }
    if (flipTimer) clearTimeout(flipTimer);
    sheet.classList.remove('is-flipping', 'is-flipping-prev', 'is-flip-reset', 'is-flip-armed-prev');
    void sheet.offsetWidth;

    if (direction < 0) {
        /* Zpět = obrácený první krok: nejdřív nový list, pak doklopení z -92° na 0°. */
        if (thenRender) thenRender();
        sheet.classList.add('is-flip-armed-prev');
        void sheet.offsetWidth;
        sheet.classList.remove('is-flip-armed-prev');
        sheet.classList.add('is-flipping-prev');
        flipTimer = setTimeout(function() {
            sheet.classList.remove('is-flipping-prev');
        }, 200);
        return;
    }

    /* Vpřed: odklopit aktuální list, na vrcholu vyměnit obsah, položit nový bez zpětné animace. */
    sheet.classList.add('is-flipping');
    flipTimer = setTimeout(function() {
        if (thenRender) thenRender();
        sheet.classList.add('is-flip-reset');
        sheet.classList.remove('is-flipping');
        void sheet.offsetWidth;
        sheet.classList.remove('is-flip-reset');
    }, 200);
}

function getShelterLatLng() {
    if (ctx.getShelterLatLng) {
        try {
            return ctx.getShelterLatLng();
        } catch (e) {}
    }
    try {
        var lat = parseFloat(localStorage.getItem('point_roxy_lat'));
        var lng = parseFloat(localStorage.getItem('point_roxy_lng'));
        if (isFinite(lat) && isFinite(lng)) return { lat: lat, lng: lng };
    } catch (e2) {}
    return null;
}

function getPlayerLatLng() {
    if (ctx.getPlayerLatLng) {
        try {
            return ctx.getPlayerLatLng();
        } catch (e) {}
    }
    return getShelterLatLng();
}

function getCtx() {
    var shelter = getShelterLatLng();
    return {
        userId: ctx.getUserId ? ctx.getUserId() : '',
        playerName: ctx.getPlayerName ? ctx.getPlayerName() : 'Operativec',
        comCode: ctx.getComCode ? ctx.getComCode() : '',
        comName: ctx.getComName ? ctx.getComName() : '',
        communityRadioKey: ctx.getCommunityRadioKey ? ctx.getCommunityRadioKey() : getCommunityRadioKey(ctx.getComCode && ctx.getComCode(), ctx.getComName && ctx.getComName()),
        originLat: shelter ? shelter.lat : null,
        originLng: shelter ? shelter.lng : null
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
        var scope = classifyChannel(state.frequency, state.encryptionKey, c);
        ch.textContent = CHANNEL_SCOPE_LABELS[scope] || 'KANÁL';
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

function renderNotebook(options) {
    options = options || {};
    var box = el('radio-notebook-lines');
    var pageNum = el('radio-notebook-page-num');
    var pageLabel = el('radio-notebook-page-label');
    var prevBtn = el('radio-notebook-prev');
    var nextBtn = el('radio-notebook-next');
    if (!box) return;

    ensureNotebookMeta();
    var pageIdx = getCurrentPageIndex();

    if (activeNotebookTab === 'grids') {
        var gridCount = getGridPageCount(NOTEBOOK_LINES_PER_PAGE);
        if (pageIdx >= gridCount) {
            pageIdx = gridCount - 1;
            setCurrentPageIndex(pageIdx);
        }
        var gridPage = getGridPage(pageIdx, NOTEBOOK_LINES_PER_PAGE);
        box.innerHTML = renderGridPageHtml(gridPage);
        bindGridCopyButtons(box);
        if (pageNum) pageNum.textContent = String(pageIdx + 1);
        if (pageLabel) pageLabel.textContent = (gridPage.title || 'Gridy') + ' · ' + (pageIdx + 1) + '/' + gridCount;
        if (prevBtn) prevBtn.disabled = pageIdx <= 0;
        if (nextBtn) nextBtn.disabled = pageIdx >= gridCount - 1;
        return;
    }

    var pageCount = activeNotebookTab === 'station'
        ? getStationVisualPageCount(notebook, NOTEBOOK_LINES_PER_PAGE, NOTEBOOK_CHARS_PER_LINE)
        : getNotebookPageCount(notebook, activeNotebookTab, NOTEBOOK_LINES_PER_PAGE);

    if (pageIdx >= pageCount) {
        pageIdx = pageCount - 1;
        setCurrentPageIndex(pageIdx);
    }

    if (activeNotebookTab === 'notes') {
        var items = notebook.notes || [];
        if (!items.length) {
            box.innerHTML = '<p class="radio-notebook-empty">Poznámky — zatím prázdné.<br>Rychlé poznámky přibydou v další verzi.</p>';
        } else {
            var visualLines = expandPlainNotebookLines(items, NOTEBOOK_CHARS_PER_LINE);
            var itemsHtml = '';
            for (var n = 0; n < visualLines.length; n++) {
                itemsHtml += '<div class="radio-notebook-line">' + visualLines[n] + '</div>';
            }
            box.innerHTML = itemsHtml;
        }
        if (pageNum) pageNum.textContent = '';
        if (pageLabel) pageLabel.textContent = NOTEBOOK_TAB_LABELS.notes || 'Poznámky';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
    }

    if (activeNotebookTab !== 'station') return;

    var list = getStationVisualPageLines(notebook, pageIdx, NOTEBOOK_LINES_PER_PAGE, NOTEBOOK_CHARS_PER_LINE);
    if (!list.length && pageIdx === 0) {
        box.innerHTML = '<p class="radio-notebook-empty">↓ příchozí · ↑ odchozí<br>Nalaď frekvenci a šifru, pak vysílej.</p>';
    } else {
        var html = '';
        for (var i = 0; i < list.length; i++) {
            var line = list[i];
            var cls = 'radio-notebook-line radio-notebook-line-' + line.dir;
            if (!line.isFirst) cls += ' radio-notebook-line-cont';
            html += '<div class="' + cls + '">' + line.text + '</div>';
        }
        box.innerHTML = html;
    }

    if (pageNum) pageNum.textContent = String(pageIdx + 1);
    if (pageLabel) pageLabel.textContent = 'List ' + (pageIdx + 1) + ' / ' + pageCount;
    if (prevBtn) prevBtn.disabled = pageIdx <= 0;
    if (nextBtn) nextBtn.disabled = pageIdx >= pageCount - 1;
}

function bindGridCopyButtons(box) {
    if (!box) return;
    var btns = box.querySelectorAll('.radio-grid-copy');
    for (var i = 0; i < btns.length; i++) {
        if (btns[i]._gridCopyBound) continue;
        btns[i]._gridCopyBound = true;
        btns[i].addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var text = this.getAttribute('data-copy') || '';
            var btn = this;
            copyGridLineText(text).then(function(ok) {
                if (!ok) return;
                btn.classList.add('is-copied');
                btn.textContent = '✓';
                setTimeout(function() {
                    btn.classList.remove('is-copied');
                    btn.textContent = '⧉';
                }, 900);
            });
        });
    }
}

function goNotebookPage(delta) {
    if (activeNotebookTab === 'notes') return;
    var pageCount = activeNotebookTab === 'grids'
        ? getGridPageCount(NOTEBOOK_LINES_PER_PAGE)
        : (activeNotebookTab === 'station'
            ? getStationVisualPageCount(notebook, NOTEBOOK_LINES_PER_PAGE, NOTEBOOK_CHARS_PER_LINE)
            : getNotebookPageCount(notebook, activeNotebookTab, NOTEBOOK_LINES_PER_PAGE));
    var next = getCurrentPageIndex() + delta;
    if (next < 0 || next >= pageCount) return;
    /* Nejdřív odklopit aktuální list, teprve pak vyměnit obsah. */
    triggerPageFlip(function() {
        setCurrentPageIndex(next);
        persist();
        renderNotebook();
    }, delta);
}

function bindNotebookSwipe() {
    var sheet = el('radio-notebook-sheet');
    if (!sheet || sheet._swipeBound) return;
    sheet._swipeBound = true;
    var startX = 0;
    var startY = 0;
    var tracking = false;

    function isBusyFlip() {
        return sheet.classList.contains('is-flipping') || sheet.classList.contains('is-flipping-prev');
    }

    function ignoreTarget(target) {
        if (!target || !target.closest) return false;
        return !!(target.closest('.radio-grid-copy') ||
            target.closest('input, textarea, button, a, select'));
    }

    sheet.addEventListener('touchstart', function(e) {
        if (!e.touches || e.touches.length !== 1) return;
        if (ignoreTarget(e.target) || isBusyFlip()) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    sheet.addEventListener('touchend', function(e) {
        if (!tracking) return;
        tracking = false;
        if (isBusyFlip()) return;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        /* Prst doleva = další list, doprava = předchozí. */
        goNotebookPage(dx < 0 ? 1 : -1);
    }, { passive: true });

    sheet.addEventListener('touchcancel', function() {
        tracking = false;
    }, { passive: true });
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
    var list = notebook.station || [];
    var entryIndex = list.length;
    appendNotebookEntry(notebook, 'station', entry);
    persist();

    var pageForEntry = getStationVisualPageIndexForEntry(notebook, entryIndex, NOTEBOOK_LINES_PER_PAGE, NOTEBOOK_CHARS_PER_LINE);
    var onStationTab = activeNotebookTab === 'station';

    if (onStationTab) {
        if (pageForEntry > getCurrentPageIndex()) {
            triggerPageFlip(function() {
                setCurrentPageIndex(pageForEntry);
                renderNotebook();
            }, 1);
        } else if (pageForEntry === getCurrentPageIndex()) {
            renderNotebook();
        }
    }
}

function refreshSubscriptions() {
    if (ctx.isLocalOnly && ctx.isLocalOnly()) return;
    var freqs = collectTunedFrequencies(state);
    subscribeRadioChannels(freqs, function(payload) {
        var c = getCtx();
        if (payload.senderId && payload.senderId === c.userId) return;
        if (seenMessageIds[payload.id]) return;

        var origin = (payload.originLat != null && payload.originLng != null)
            ? { lat: payload.originLat, lng: payload.originLng }
            : null;
        var receiver = getPlayerLatLng();
        var reception = evaluateRadioReception(origin, receiver);
        if (!reception.receivable) return;

        var msgKey = normalizeEncryptionKey(payload.encryptionKey || '');
        var myKey = normalizeEncryptionKey(state.encryptionKey || '');
        var canRead = !msgKey || msgKey === myKey;

        var applied;
        if (!canRead) {
            /* Stejná frekvence, cizí šifra → jen šum/anomálie (plné luštění = F3). */
            applied = {
                text: noisePlaceholder(payload.frequency),
                signalQuality: SIGNAL_NOISE,
                distanceKm: reception.distanceKm
            };
        } else {
            applied = applyReceptionToMessage(payload.text, reception, {
                seed: payload.id || payload.text,
                frequency: payload.frequency
            });
        }
        if (!applied) return;

        seenMessageIds[payload.id] = true;
        var entry = createIncomingEntry(Object.assign({}, payload, {
            text: applied.text,
            signalQuality: applied.signalQuality,
            distanceKm: applied.distanceKm
        }), c);
        recordEntry(entry);
    });
}

function applyDialBuffer() {
    var input = el('chat-input-field');
    if (state.keypadMode === 'freq') {
        var raw = (state.dialBuffer || (input && input.value) || '').trim();
        if (raw) {
            state.frequency = normalizeFrequency(raw);
            state.activePresetSlot = null;
        }
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
    if (!state.frequency) {
        alert('Nejdřív nalaď frekvenci (PRE / −+ nebo MODE → přímý zápis).');
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
            timestamp: entry.ts,
            originLat: c.originLat,
            originLng: c.originLng
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
            if (cycleDialPreset(state, 1)) {
                persist();
                renderDisplay();
                refreshSubscriptions();
            }
        });
    }

    var preUp = el('radio-key-pre-up');
    if (preUp && !preUp._radioCommsBound) {
        preUp._radioCommsBound = true;
        preUp.addEventListener('click', function() {
            if (cycleDialPreset(state, 1)) {
                persist();
                renderDisplay();
                refreshSubscriptions();
            }
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
                if (cycleDialPreset(state, -1)) {
                    persist();
                    renderDisplay();
                    refreshSubscriptions();
                }
                return;
            }
            if (key === 'next') {
                if (cycleDialPreset(state, 1)) {
                    persist();
                    renderDisplay();
                    refreshSubscriptions();
                }
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
            activeNotebookTab = this.getAttribute('data-tab') || 'station';
            if (activeNotebookTab === 'grids') setCurrentPageIndex(0);
            syncNotebookTabs();
            renderNotebook();
        });
    }

    var prevPage = el('radio-notebook-prev');
    if (prevPage && !prevPage._radioCommsBound) {
        prevPage._radioCommsBound = true;
        prevPage.addEventListener('click', function() { goNotebookPage(-1); });
    }
    var nextPage = el('radio-notebook-next');
    if (nextPage && !nextPage._radioCommsBound) {
        nextPage._radioCommsBound = true;
        nextPage.addEventListener('click', function() { goNotebookPage(1); });
    }
    bindNotebookSwipe();
    bindDisplayDialSwipe();
}

function bindDisplayDialSwipe() {
    var screen = el('radio-display-screen');
    if (!screen || screen._dialSwipeBound) return;
    screen._dialSwipeBound = true;
    var startX = 0;
    var tracking = false;
    screen.addEventListener('touchstart', function(e) {
        if (!e.touches || e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        tracking = true;
    }, { passive: true });
    screen.addEventListener('touchend', function(e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - startX;
        if (Math.abs(dx) < 36) return;
        if (cycleDialPreset(state, dx < 0 ? 1 : -1)) {
            persist();
            renderDisplay();
            refreshSubscriptions();
        }
    }, { passive: true });
    screen.addEventListener('touchcancel', function() { tracking = false; }, { passive: true });
}

export function initRadioCommsSystem(options) {
    ctx = options || {};
    var c = getCtx();
    state = loadRadioState(c.userId, c);
    notebook = loadNotebook(c.userId);
    seenMessageIds = {};

    if (!notebook.station.length) {
        appendNotebookEntry(notebook, 'station', {
            id: 'sys_welcome',
            dir: 'in',
            from: 'SYSTÉM',
            text: 'Staniční list — záznam provozu vysílačky.',
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
