/**
 * UI vysílačky + sešit — frekvence, šifra, presety, příchozí/odchozí záznamy.
 */
import {
    loadRadioState,
    saveRadioState,
    loadNotebook,
    saveNotebook,
    appendNotebookEntry,
    sanitizeStationNotebook,
    buildDisplayLines,
    applyPreset,
    upsertPreset,
    cycleDialPreset,
    adjustFrequency,
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
    NOTEBOOK_MAX_PAGES,
    CHANNEL_SCOPE_LABELS,
    getNotebookPageCount,
    expandPlainNotebookLines,
    getStationVisualPageCount,
    getStationVisualPageLines,
    getStationVisualPageIndexForEntry,
    removeLastStationPage,
    trimStationToMaxPages,
    normalizeNoteEntry,
    normalizeNotesList,
    getNotesVisualPageCount,
    getNotesVisualPageLines,
    getNotesVisualPageIndexForEntry,
    removeLastNotesPage,
    trimNotesToMaxPages,
    deleteNoteById
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
import { initSectorTechShell, refreshSectorTechLayout } from './radioSectorShell.js';
import {
    createRadioOsState,
    resetRadioOs,
    radioOsHandleInput,
    buildOsDisplayLines,
    isRadioOsActive,
    createPresetDraft,
    savePresetDraft
} from './radioOs.js';
import {
    createFieldEdit,
    isFieldEditActive,
    buildFieldEditView,
    handleFieldEditInput,
    handleFieldEditOk,
    applyFieldEditToState,
    applyFieldEditToDraft,
    cancelFieldEdit
} from './radioFieldEdit.js';
import {
    KIND_HANDSET,
    NODE_KIND_LABELS,
    resolveActiveRadioNode,
    cycleRadioKind
} from './radioNodes.js';

var ctx = {};
var state = null;
var radioOs = createRadioOsState();
var fieldEditSession = null;
var presetEditDraft = null;
var notebook = null;
var activeNotebookTab = 'station';
var seenMessageIds = {};
var flipTimer = null;

function ensureNotebookMeta() {
    if (!notebook.pageIndex) notebook.pageIndex = { station: 0, notes: 0, grids: 0 };
    if (!Array.isArray(notebook.grids)) notebook.grids = [];
    notebook.notes = normalizeNotesList(notebook.notes);
    if (typeof notebook.notesText !== 'string') {
        if (notebook.notes.length) {
            notebook.notesText = notebook.notes.map(function(n) { return n.text; }).join('\n');
        } else {
            notebook.notesText = '';
        }
    }
}

/**
 * Počet řádků / znaků podle reálné velikosti listu (vyplní celý papír).
 */
function getNotebookLayout() {
    var sheet = el('radio-notebook-sheet');
    var box = el('radio-notebook-lines');
    var fallback = {
        linesPerPage: NOTEBOOK_LINES_PER_PAGE,
        charsPerLine: NOTEBOOK_CHARS_PER_LINE
    };
    if (!sheet || !box) return fallback;

    var cs = window.getComputedStyle(box);
    var linePx = parseFloat(cs.lineHeight) || 18;
    if (!isFinite(linePx) || linePx < 8) linePx = 18;
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var usableH = Math.max(0, box.clientHeight - padTop - padBottom);
    var lines = Math.floor(usableH / linePx);
    if (lines < 8) lines = NOTEBOOK_LINES_PER_PAGE;
    if (lines > 40) lines = 40;

    var padLeft = parseFloat(cs.paddingLeft) || 0;
    var padRight = parseFloat(cs.paddingRight) || 0;
    var usableW = Math.max(40, box.clientWidth - padLeft - padRight);
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + cs.font;
    probe.textContent = '0000000000';
    document.body.appendChild(probe);
    var tenW = probe.getBoundingClientRect().width || 60;
    document.body.removeChild(probe);
    var charW = tenW / 10;
    var chars = Math.floor(usableW / Math.max(charW, 4));
    if (chars < 24) chars = NOTEBOOK_CHARS_PER_LINE;
    if (chars > 90) chars = 90;

    sheet.style.setProperty('--nb-line', linePx + 'px');
    sheet.style.setProperty('--nb-lines', String(lines));

    return { linesPerPage: lines, charsPerLine: chars };
}

function stationPageMetrics() {
    var layout = getNotebookLayout();
    return layout;
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
    return null;
}

function radioNodeDeps(userId) {
    return {
        userId: userId || (ctx.getUserId ? ctx.getUserId() : ''),
        getShelterLatLng: getShelterLatLng,
        getPlayerLatLng: getPlayerLatLng
    };
}

/**
 * TX/RX pozice = aktivní rádiový uzel (BÁZE = útočiště, NOSIČ = GPS).
 */
function getRadioLatLng() {
    var resolved = resolveActiveRadioNode(radioNodeDeps());
    if (resolved && resolved.node) {
        return { lat: resolved.node.lat, lng: resolved.node.lng };
    }
    return null;
}

function notifyRadioRangeLayer() {
    if (typeof window.patracRefreshRadioRange === 'function') {
        try { window.patracRefreshRadioRange(); } catch (e) {}
    }
}

function getCtx() {
    var radioPos = getRadioLatLng();
    var userId = ctx.getUserId ? ctx.getUserId() : '';
    var resolved = resolveActiveRadioNode(radioNodeDeps(userId));
    return {
        userId: userId,
        playerName: ctx.getPlayerName ? ctx.getPlayerName() : 'Operativec',
        comCode: ctx.getComCode ? ctx.getComCode() : '',
        comName: ctx.getComName ? ctx.getComName() : '',
        communityRadioKey: ctx.getCommunityRadioKey ? ctx.getCommunityRadioKey() : getCommunityRadioKey(ctx.getComCode && ctx.getComCode(), ctx.getComName && ctx.getComName()),
        originLat: radioPos ? radioPos.lat : null,
        originLng: radioPos ? radioPos.lng : null,
        radioKind: resolved ? resolved.kind : 'shelter',
        radioKindFallback: !!(resolved && resolved.fallback)
    };
}

function el(id) {
    return document.getElementById(id);
}

var DISPLAY_LINE_IDS = [
    'radio-display-freq',
    'radio-display-key',
    'radio-display-buffer',
    'radio-display-preset',
    'radio-display-line5',
    'radio-display-line6'
];

function setDisplayTextLines(lines, startIdx) {
    lines = lines || [];
    startIdx = startIdx || 0;
    for (var i = 0; i < DISPLAY_LINE_IDS.length; i++) {
        var row = el(DISPLAY_LINE_IDS[i]);
        if (!row) continue;
        var src = i + startIdx;
        row.textContent = src < lines.length ? (lines[src] || '') : '';
    }
}

function clearExtraDisplayLines() {
    var l5 = el('radio-display-line5');
    var l6 = el('radio-display-line6');
    if (l5) l5.textContent = '';
    if (l6) l6.textContent = '';
}

function updateInputForMode() {
    var input = el('chat-input-field');
    if (!input) return;
    input.placeholder = 'Hlášení…';
    if (isFieldEditActive(fieldEditSession)) {
        input.value = '';
        input.blur();
    }
}

function startFieldEdit(type, options) {
    options = options || {};
    fieldEditSession = createFieldEdit(type, state, options);
    state.keypadMode = 'tx';
    state.dialBuffer = '';
    var input = el('chat-input-field');
    if (input) {
        input.value = '';
        input.blur();
    }
    renderDisplay();
}

function finishFieldEdit(save) {
    if (!fieldEditSession) return;
    var c = getCtx();
    if (save) {
        if (fieldEditSession.returnTo === 'preset_detail' && presetEditDraft) {
            applyFieldEditToDraft(fieldEditSession, presetEditDraft);
        } else {
            applyFieldEditToState(fieldEditSession, state, {
                scope: classifyChannel(state.frequency, state.encryptionKey, c)
            });
        }
        persist();
        refreshSubscriptions();
    }
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    var input = el('chat-input-field');
    if (input) {
        input.value = '';
        input.blur();
    }
    renderDisplay();
}

function openPresetFieldEdit(field) {
    if (!presetEditDraft) return;
    if (field === 0) {
        startFieldEdit('text', {
            text: presetEditDraft.label,
            returnTo: 'preset_detail',
            maxLen: 14
        });
        if (fieldEditSession) {
            fieldEditSession.digitMode = true;
            fieldEditSession.cursor = 0;
        }
        return;
    }
    if (field === 1) {
        startFieldEdit('freq', {
            frequency: presetEditDraft.frequency,
            returnTo: 'preset_detail'
        });
        if (fieldEditSession) {
            fieldEditSession.digitMode = true;
            fieldEditSession.cursor = 0;
        }
        return;
    }
    if (field === 2) {
        startFieldEdit('encrypt', {
            encryptionKey: presetEditDraft.encryptionKey,
            returnTo: 'preset_detail'
        });
        if (fieldEditSession) {
            fieldEditSession.digitMode = true;
            fieldEditSession.cursor = 0;
        }
    }
}

function handleFieldEditAction(action, char, opts) {
    if (!isFieldEditActive(fieldEditSession)) return false;
    if (handleFieldEditInput(fieldEditSession, action, char, opts || {})) {
        renderDisplay();
        return true;
    }
    return false;
}

function renderDisplay() {
    var c = getCtx();
    var screen = el('radio-display-screen');
    var standbyLines = buildDisplayLines(state, c);
    var scope = classifyChannel(state.frequency, state.encryptionKey, c);
    var opLabel = state.operatingMode === 'text' ? 'TEXT' : (state.operatingMode === 'off' ? 'OFF' : 'VOICE');
    var dialBuffer = '';
    if (!isFieldEditActive(fieldEditSession) && (state.keypadMode === 'freq' || state.keypadMode === 'encrypt')) {
        dialBuffer = state.dialBuffer ? ('▸ ' + state.dialBuffer) : '';
    }

    var osView = buildOsDisplayLines(radioOs, state.operatingMode, {
        status: (CHANNEL_SCOPE_LABELS[scope] || 'KANÁL') + ' · ' + opLabel,
        line1: standbyLines.line1,
        line2: standbyLines.line2,
        line3: standbyLines.line3,
        line4: dialBuffer,
        footer: standbyLines.footer,
        buffer: dialBuffer
    }, state, presetEditDraft);

    if (screen) {
        screen.classList.toggle('is-off', osView.mode === 'off');
        screen.classList.toggle('is-menu', osView.mode === 'menu' || osView.mode === 'stub' || osView.mode === 'preset_detail');
        screen.classList.toggle('is-standby', osView.mode === 'standby');
        screen.classList.toggle('is-preset-detail', osView.mode === 'preset_detail');
    }

    var f = el('radio-display-freq');
    var k = el('radio-display-key');
    var p = el('radio-display-preset');
    var foot = el('radio-display-com');
    var sig = el('radio-display-signal');
    var ch = el('radio-display-channel');
    var nodeEl = el('radio-display-node');
    var buf = el('radio-display-buffer');
    var footerWrap = el('radio-display-footer');

    if (isFieldEditActive(fieldEditSession) && state.operatingMode !== 'off') {
        var editOpts = {};
        if (fieldEditSession.returnTo === 'preset_detail' && presetEditDraft) {
            editOpts.status = 'P' + presetEditDraft.slot + ' · PRESET';
        }
        var editView = buildFieldEditView(fieldEditSession, editOpts);
        if (screen) {
            screen.classList.toggle('is-off', false);
            screen.classList.toggle('is-menu', false);
            screen.classList.toggle('is-standby', false);
            screen.classList.toggle('is-field-edit', true);
            screen.classList.toggle('is-freq-edit', editView.editType === 'freq');
            screen.classList.toggle('is-key-edit', editView.editType === 'encrypt' || editView.editType === 'text');
        }
        if (ch) ch.textContent = editView.status || '';
        if (sig) { sig.textContent = ''; sig.style.color = ''; }
        if (nodeEl) { nodeEl.textContent = ''; nodeEl.style.visibility = 'hidden'; }
        if (f) {
            f.innerHTML = editView.freqHtml || editView.keyHtml || '';
            f.className = 'radio-display-edit-large';
        }
        if (k) k.textContent = '';
        if (buf) buf.textContent = editView.axis || (editView.editType === 'encrypt' ? editView.hint : '');
        if (p) p.textContent = editView.axis ? editView.hint : '';
        clearExtraDisplayLines();
        if (footerWrap) footerWrap.textContent = editView.footer || 'OK · uložit';
        updateInputForMode();
        return;
    }

    if (screen) {
        screen.classList.toggle('is-field-edit', false);
        screen.classList.toggle('is-freq-edit', false);
        screen.classList.toggle('is-key-edit', false);
    }

    if (osView.mode === 'off') {
        if (f) {
            f.className = '';
            f.classList.remove('radio-display-freq-node', 'is-handset', 'is-fallback');
            f.removeAttribute('data-kind');
            f.removeAttribute('title');
        }
        setDisplayTextLines([]);
        if (foot) foot.textContent = '';
        if (ch) ch.textContent = '';
        if (sig) sig.textContent = '';
        if (nodeEl) {
            nodeEl.textContent = '';
            nodeEl.style.visibility = 'hidden';
        }
        if (footerWrap) footerWrap.textContent = '';
        updateInputForMode();
        return;
    }

    if (nodeEl) nodeEl.style.visibility = '';

    if (osView.mode === 'standby') {
        var freqVal = normalizeFrequency(state.frequency) || '---.---';
        var pt = !normalizeEncryptionKey(state.encryptionKey || '');
        var kind = c.radioKind || 'shelter';
        var nodeLabel = NODE_KIND_LABELS[kind] || 'BÁZE';
        if (c.radioKindFallback) nodeLabel += '*';
        if (f) {
            f.className = '';
            f.textContent = nodeLabel + ' · ' + freqVal + ' MHz  ' + (pt ? 'PT' : 'CT');
            f.title = kind === KIND_HANDSET
                ? 'Uzel: NOSIČ (GPS). Klepni = BÁZE (útočiště).'
                : 'Uzel: BÁZE (útočiště). Klepni = NOSIČ (GPS).';
            f.setAttribute('data-kind', kind);
            f.classList.toggle('radio-display-freq-node', true);
            f.classList.toggle('is-handset', kind === KIND_HANDSET);
            f.classList.toggle('is-fallback', !!c.radioKindFallback);
        }
        if (k) k.textContent = standbyLines.line2;
        if (p) p.textContent = standbyLines.line3;
        if (buf) buf.textContent = dialBuffer;
        clearExtraDisplayLines();
        if (sig) {
            var tuned = !!normalizeFrequency(state.frequency);
            sig.textContent = tuned ? '● TX/RX' : '○ STBY';
            sig.style.color = tuned ? '#8fdc68' : '#888';
        }
        if (ch) ch.textContent = CHANNEL_SCOPE_LABELS[scope] || 'KANÁL';
        if (nodeEl) {
            nodeEl.textContent = '';
            nodeEl.style.visibility = 'hidden';
        }
        if (footerWrap) {
            if (!footerWrap.querySelector('#radio-display-com')) {
                footerWrap.innerHTML = '0 KEY · <span id="radio-display-com"></span>';
                foot = el('radio-display-com');
            }
            if (foot) foot.textContent = standbyLines.footer;
        }
    } else {
        var menuLines = osView.lines || ['', '', '', '', '', ''];
        if (f) {
            f.className = '';
            f.classList.remove('radio-display-freq-node', 'is-handset', 'is-fallback');
            f.removeAttribute('data-kind');
            f.removeAttribute('title');
            f.style.fontWeight = '';
            f.style.color = '';
        }
        setDisplayTextLines(menuLines);
        if (ch) ch.textContent = osView.status || 'MENU';
        if (sig) {
            sig.textContent = '';
            sig.style.color = '';
        }
        if (nodeEl) nodeEl.textContent = '';
        if (footerWrap) footerWrap.textContent = osView.footer || 'OK · Zpět';
    }

    updateInputForMode();
}

function handleRadioOsInput(action) {
    if (state.operatingMode === 'off') return false;

    if (isFieldEditActive(fieldEditSession)) {
        if (action === 'ok') {
            handleFieldEditOk(fieldEditSession);
            renderDisplay();
            return true;
        }
        if (action === 'back') {
            finishFieldEdit(true);
            return true;
        }
        return false;
    }

    var result = radioOsHandleInput(radioOs, state.operatingMode, action, state);
    if (!result || !result.changed) return false;

    if (result.effect === 'preset_detail_open') {
        if (result.slot) presetEditDraft = createPresetDraft(result.slot, state);
        renderDisplay();
        return true;
    }
    if (result.effect === 'preset_detail_back') {
        if (presetEditDraft) {
            var c = getCtx();
            savePresetDraft(presetEditDraft, state, {
                scope: classifyChannel(presetEditDraft.frequency, presetEditDraft.encryptionKey, c)
            });
            persist();
            refreshSubscriptions();
        }
        presetEditDraft = null;
        renderDisplay();
        return true;
    }
    if (result.effect === 'preset_field_edit') {
        if (!presetEditDraft && result.slot) {
            presetEditDraft = createPresetDraft(result.slot, state);
        }
        openPresetFieldEdit(result.field);
        return true;
    }

    renderDisplay();
    return true;
}

function renderNotebook(options) {
    options = options || {};
    var box = el('radio-notebook-lines');
    var pageNum = el('radio-notebook-page-num');
    var pageLabel = el('radio-notebook-page-label');
    var prevBtn = el('radio-notebook-prev');
    var nextBtn = el('radio-notebook-next');
    var tearBtn = el('radio-notebook-tear');
    if (!box) return;

    ensureNotebookMeta();
    var layout = stationPageMetrics();
    var linesPerPage = layout.linesPerPage;
    var charsPerLine = layout.charsPerLine;
    var pageIdx = getCurrentPageIndex();

    if (activeNotebookTab === 'grids') {
        var gridCount = getGridPageCount(linesPerPage);
        if (pageIdx >= gridCount) {
            pageIdx = gridCount - 1;
            setCurrentPageIndex(pageIdx);
        }
        var gridPage = getGridPage(pageIdx, linesPerPage);
        box.innerHTML = renderGridPageHtml(gridPage);
        bindGridCopyButtons(box);
        if (pageNum) pageNum.textContent = String(pageIdx + 1);
        if (pageLabel) pageLabel.textContent = (gridPage.title || 'Gridy') + ' · ' + (pageIdx + 1) + '/' + gridCount;
        if (prevBtn) prevBtn.disabled = pageIdx <= 0;
        if (nextBtn) nextBtn.disabled = pageIdx >= gridCount - 1;
        if (tearBtn) tearBtn.style.display = 'none';
        return;
    }

    var pageCount = activeNotebookTab === 'station'
        ? getStationVisualPageCount(notebook, linesPerPage, charsPerLine)
        : (activeNotebookTab === 'notes'
            ? getNotesVisualPageCount(notebook, linesPerPage, charsPerLine)
            : getNotebookPageCount(notebook, activeNotebookTab, linesPerPage));

    if (pageIdx >= pageCount) {
        pageIdx = pageCount - 1;
        setCurrentPageIndex(pageIdx);
    }

    if (activeNotebookTab === 'notes') {
        var notesText = typeof notebook.notesText === 'string' ? notebook.notesText : '';
        box.innerHTML =
            '<textarea id="radio-notes-field" class="radio-notes-field" spellcheck="true" ' +
            'placeholder="Osobní poznámky (jen ty, ne komunita)…"></textarea>';
        var field = el('radio-notes-field');
        if (field) {
            field.value = notesText;
            bindNotesField(field);
        }
        if (pageNum) pageNum.textContent = '';
        if (pageLabel) pageLabel.textContent = 'Poznámky · osobní';
        if (prevBtn) { prevBtn.disabled = true; prevBtn.style.visibility = 'hidden'; }
        if (nextBtn) { nextBtn.disabled = true; nextBtn.style.visibility = 'hidden'; }
        if (tearBtn) {
            tearBtn.style.display = '';
            tearBtn.style.visibility = '';
            tearBtn.textContent = '🗑';
            tearBtn.title = 'Smazat všechny poznámky';
            tearBtn.disabled = !String(notesText || '').trim();
        }
        return;
    }

    if (prevBtn) prevBtn.style.visibility = '';
    if (nextBtn) nextBtn.style.visibility = '';

    if (activeNotebookTab !== 'station') return;

    var list = getStationVisualPageLines(notebook, pageIdx, linesPerPage, charsPerLine);
    if (!list.length && pageIdx === 0) {
        box.innerHTML = '<p class="radio-notebook-empty">↓ příchozí · ↑ odchozí<br>Nalaď frekvenci (PT = bez šifry OK), pak vysílej.</p>';
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
    if (tearBtn) {
        tearBtn.style.display = '';
        tearBtn.style.visibility = '';
        tearBtn.textContent = '⌫ list';
        tearBtn.title = 'Vytrhnout poslední list';
        var hasTearable = (notebook.station || []).some(function(e) {
            return e && e.id !== 'sys_welcome';
        });
        tearBtn.disabled = !hasTearable;
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function bindNotesField(field) {
    if (!field || field._notesBound) return;
    field._notesBound = true;
    var saveTimer = null;
    function flushNotes() {
        ensureNotebookMeta();
        notebook.notesText = field.value || '';
        /* Drž i legacy pole notes synchronní (jeden blok textu). */
        var trimmed = String(notebook.notesText).trim();
        notebook.notes = trimmed
            ? [normalizeNoteEntry({ text: trimmed, ts: Date.now(), id: 'notes_block' })].filter(Boolean)
            : [];
        persist();
        var tearBtn = el('radio-notebook-tear');
        if (tearBtn && activeNotebookTab === 'notes') {
            tearBtn.disabled = !trimmed;
        }
    }
    field.addEventListener('input', function() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(flushNotes, 280);
    });
    field.addEventListener('blur', function() {
        if (saveTimer) clearTimeout(saveTimer);
        flushNotes();
    });
}

function clearPersonalNotes() {
    if (!confirm('Smazat všechny osobní poznámky?')) return;
    ensureNotebookMeta();
    notebook.notesText = '';
    notebook.notes = [];
    persist();
    renderNotebook();
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
    var layout = stationPageMetrics();
    var pageCount = activeNotebookTab === 'grids'
        ? getGridPageCount(layout.linesPerPage)
        : (activeNotebookTab === 'station'
            ? getStationVisualPageCount(notebook, layout.linesPerPage, layout.charsPerLine)
            : (activeNotebookTab === 'notes'
                ? getNotesVisualPageCount(notebook, layout.linesPerPage, layout.charsPerLine)
                : getNotebookPageCount(notebook, activeNotebookTab, layout.linesPerPage)));
    var next = getCurrentPageIndex() + delta;
    if (next < 0 || next >= pageCount) return;
    triggerPageFlip(function() {
        setCurrentPageIndex(next);
        persist();
        renderNotebook();
    }, delta);
}

function tearLastStationPage() {
    if (activeNotebookTab === 'notes') {
        clearPersonalNotes();
        return;
    }
    if (activeNotebookTab !== 'station') return;
    var layout = stationPageMetrics();
    var pages = getStationVisualPageCount(notebook, layout.linesPerPage, layout.charsPerLine);
    var msg = pages <= 1
        ? 'Smazat všechny záznamy na staničním listu?'
        : 'Vytrhnout poslední list (list ' + pages + ')? Záznamy na něm se smažou.';
    if (!confirm(msg)) return;
    var result = removeLastStationPage(notebook, layout.linesPerPage, layout.charsPerLine);
    notebook = result.notebook;
    trimStationToMaxPages(notebook, NOTEBOOK_MAX_PAGES, layout.linesPerPage, layout.charsPerLine);
    var newCount = getStationVisualPageCount(notebook, layout.linesPerPage, layout.charsPerLine);
    if (getCurrentPageIndex() >= newCount) setCurrentPageIndex(Math.max(0, newCount - 1));
    persist();
    renderNotebook();
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

function normalizeUserId(id) {
    return String(id || '').trim();
}

function isOwnRadioSender(payload, c) {
    var me = normalizeUserId(c && c.userId);
    var sid = normalizeUserId(payload && payload.senderId);
    if (me && sid && me === sid) return true;
    return false;
}

/** Echo vlastní TX: cloud id ≠ local_ id, takže by se zápis zduplikoval jako ↓. */
function hasRecentOutgoingEcho(payload) {
    if (!notebook || !notebook.station) return false;
    var text = String(payload.text || '').trim();
    if (!text) return false;
    var freq = normalizeFrequency(payload.frequency);
    var ts = Number(payload.timestamp) || Date.now();
    var sid = normalizeUserId(payload.senderId);
    var from = String(payload.senderName || '').trim().toLowerCase();
    var me = normalizeUserId(getCtx().userId);
    var myName = String(getCtx().playerName || '').trim().toLowerCase();
    var list = notebook.station;
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e || e.dir !== 'out') continue;
        if (normalizeFrequency(e.frequency) !== freq) continue;
        if (String(e.text || '').trim() !== text) continue;
        if (Math.abs((e.ts || 0) - ts) > 45000 && !(e.cloudId && payload.id && e.cloudId === payload.id)) {
            continue;
        }
        /* Jen vlastní odchozí — ne cizí ↑ omylem v sešitu. */
        var own = (me && normalizeUserId(e.senderId) === me) ||
            (myName && String(e.from || '').trim().toLowerCase() === myName) ||
            (sid && me && sid === me) ||
            (from && myName && from === myName);
        if (own) return true;
        if (e.cloudId && payload.id && e.cloudId === payload.id) return true;
    }
    return false;
}

function hasContentDuplicate(payload) {
    if (!notebook || !notebook.station) return false;
    var text = String(payload.text || '').trim().toLowerCase();
    if (!text) return false;
    var freq = normalizeFrequency(payload.frequency);
    var ts = Number(payload.timestamp) || Date.now();
    var who = String(payload.senderName || '').trim().toLowerCase();
    var list = notebook.station;
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e) continue;
        if (normalizeFrequency(e.frequency) !== freq) continue;
        if (String(e.text || '').trim().toLowerCase() !== text) continue;
        if (Math.abs((e.ts || 0) - ts) > 8000) continue;
        var eWho = String(e.from || '').trim().toLowerCase();
        if (who && eWho && who !== eWho) continue;
        return true;
    }
    return false;
}

function notebookHasId(id) {
    if (!id || !notebook || !notebook.station) return false;
    for (var i = 0; i < notebook.station.length; i++) {
        var e = notebook.station[i];
        if (!e) continue;
        if (e.id === id || e.cloudId === id) return true;
    }
    return false;
}

function recordEntry(entry) {
    if (!entry) return;
    if (entry.id && (seenMessageIds[entry.id] || notebookHasId(entry.id))) return;
    if (entry.cloudId && (seenMessageIds[entry.cloudId] || notebookHasId(entry.cloudId))) return;
    if (entry.id) seenMessageIds[entry.id] = true;
    if (entry.cloudId) seenMessageIds[entry.cloudId] = true;

    var layout = stationPageMetrics();
    var list = notebook.station || [];
    var entryIndex = list.length;
    appendNotebookEntry(notebook, 'station', entry);
    trimStationToMaxPages(notebook, NOTEBOOK_MAX_PAGES, layout.linesPerPage, layout.charsPerLine);
    /* Po trimu může entryIndex klesnout — najdi znovu. */
    entryIndex = (notebook.station || []).indexOf(entry);
    if (entryIndex < 0) entryIndex = (notebook.station || []).length - 1;
    persist();

    var pageForEntry = getStationVisualPageIndexForEntry(notebook, entryIndex, layout.linesPerPage, layout.charsPerLine);
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

function ingestIncomingPayload(payload) {
    var c = getCtx();
    if (!payload || !payload.id) return;
    if (isOwnRadioSender(payload, c)) {
        seenMessageIds[payload.id] = true;
        return;
    }
    if (hasRecentOutgoingEcho(payload)) {
        seenMessageIds[payload.id] = true;
        return;
    }
    if (hasContentDuplicate(payload)) {
        seenMessageIds[payload.id] = true;
        return;
    }
    if (seenMessageIds[payload.id] || notebookHasId(payload.id)) {
        seenMessageIds[payload.id] = true;
        return;
    }

    var origin = (payload.originLat != null && payload.originLng != null)
        ? { lat: payload.originLat, lng: payload.originLng }
        : null;
    var receiver = getRadioLatLng();
    var reception = evaluateRadioReception(origin, receiver);
    if (!reception.receivable) return;

    var msgKey = normalizeEncryptionKey(payload.encryptionKey || '');
    var myKey = normalizeEncryptionKey(state.encryptionKey || '');
    /* Otevřený kanál (PT): prázdná šifra na zprávě i u přijímače → čitelný text.
       Cizí heslo na stejné frekvenci → šum. */
    var canRead = !msgKey || msgKey === myKey;

    var applied;
    if (!canRead) {
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

    var entry = createIncomingEntry(Object.assign({}, payload, {
        text: applied.text,
        signalQuality: applied.signalQuality,
        distanceKm: applied.distanceKm
    }), c);
    recordEntry(entry);
}

function refreshSubscriptions() {
    if (ctx.isLocalOnly && ctx.isLocalOnly()) return;
    var freqs = collectTunedFrequencies(state);
    subscribeRadioChannels(freqs, ingestIncomingPayload).catch(function(err) {
        console.warn('[radioUi] subscribe', err);
    });
}

function saveToPresetSlot(slot) {
    var c = getCtx();
    upsertPreset(state, slot, {
        label: 'Kanál ' + slot,
        frequency: state.frequency,
        encryptionKey: state.encryptionKey,
        scope: classifyChannel(state.frequency, state.encryptionKey, c)
    });
    state.activePresetSlot = slot;
    persist();
    renderDisplay();
    refreshSubscriptions();
}

async function transmitMessage(text) {
    text = String(text || '').trim();
    if (!text) return;

    if (state.operatingMode === 'off') {
        alert('Vysílačka je vypnutá (režim OFF).');
        return;
    }

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
        var sent = await sendRadioTransmission({
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
        /* Cloud id hned do seen — jinak snapshot zapíše tutéž TX ještě jako ↓. */
        if (sent && sent.id) {
            seenMessageIds[sent.id] = true;
            entry.cloudId = sent.id;
            persist();
        }
    } catch (err) {
        console.warn('[radioUi] send', err);
    }
}

function cycleRadioNode() {
    if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
    var uid = ctx.getUserId ? ctx.getUserId() : '';
    cycleRadioKind(uid);
    renderDisplay();
    refreshSubscriptions();
    notifyRadioRangeLayer();
}

function bindRadioKeyT9() {
    var grid = el('radio-keypad-grid');
    if (!grid || grid._radioT9Bound) return;
    grid._radioT9Bound = true;
    var holdMs = 1400;
    var timer = null;
    var pendingBtn = null;
    var longFired = false;

    function clearHold() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pendingBtn = null;
    }

    function onHoldFire() {
        timer = null;
        if (!pendingBtn || !isFieldEditActive(fieldEditSession)) return;
        var key = pendingBtn.getAttribute('data-key');
        if (!/^[0-9]$/.test(key)) return;
        longFired = true;
        handleFieldEditAction('char', key, { longPress: true });
        if (navigator.vibrate) navigator.vibrate(30);
    }

    grid.addEventListener('pointerdown', function(e) {
        if (state.operatingMode === 'off' || !isFieldEditActive(fieldEditSession)) return;
        var btn = e.target.closest('.radio-key[data-key]');
        if (!btn) return;
        var key = btn.getAttribute('data-key');
        if (!/^[0-9]$/.test(key)) return;
        clearHold();
        longFired = false;
        pendingBtn = btn;
        timer = setTimeout(onHoldFire, holdMs);
    }, true);

    grid.addEventListener('pointerup', function(e) {
        if (!pendingBtn) return;
        var btn = e.target.closest('.radio-key[data-key]') || pendingBtn;
        if (btn !== pendingBtn) {
            clearHold();
            return;
        }
        var key = pendingBtn.getAttribute('data-key');
        clearHold();
        if (longFired) {
            longFired = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (/^[0-9]$/.test(key) || key === '*' || key === '#') {
            e.preventDefault();
            e.stopPropagation();
            handleFieldEditAction('char', key);
        }
    }, true);

    grid.addEventListener('pointercancel', clearHold, true);
    grid.addEventListener('pointerleave', function(e) {
        if (e.target === pendingBtn) clearHold();
    }, true);
}

function bindKeypad() {
    var nodeBtn = el('radio-display-node');
    if (nodeBtn && !nodeBtn._radioCommsBound) {
        nodeBtn._radioCommsBound = true;
        nodeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            cycleRadioNode();
        });
    }

    var freqRow = el('radio-display-freq');
    if (freqRow && !freqRow._radioNodeBound) {
        freqRow._radioNodeBound = true;
        freqRow.addEventListener('click', function(e) {
            if (!freqRow.classList.contains('radio-display-freq-node')) return;
            e.preventDefault();
            e.stopPropagation();
            cycleRadioNode();
        });
    }

    var input = el('chat-input-field');
    if (input && !input._radioCommsBound) {
        input._radioCommsBound = true;
        input.setAttribute('inputmode', 'none');
        input.setAttribute('autocomplete', 'off');
        input.addEventListener('focus', function() {
            if (isFieldEditActive(fieldEditSession)) input.blur();
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (isFieldEditActive(fieldEditSession)) {
                    handleFieldEditOk(fieldEditSession);
                    renderDisplay();
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
            if (state.operatingMode === 'off') return;
            if (isFieldEditActive(fieldEditSession)) {
                handleFieldEditOk(fieldEditSession);
                renderDisplay();
                return;
            }
            if (isRadioOsActive(radioOs)) {
                handleRadioOsInput('ok');
                return;
            }
            if (handleRadioOsInput('open_menu')) return;
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
            if (state.operatingMode === 'off') return;
            if (isFieldEditActive(fieldEditSession)) {
                finishFieldEdit(true);
                return;
            }
            if (handleRadioOsInput('back')) return;
            state.dialBuffer = '';
            state.keypadMode = 'tx';
            if (input) input.value = '';
            persist();
            renderDisplay();
        });
    }

    var modeBtn = el('radio-key-mode');
    if (modeBtn && !modeBtn._radioCommsBound) {
        modeBtn._radioCommsBound = true;
        modeBtn.addEventListener('click', function() {
            cycleOperatingMode(1);
        });
    }

    bindRadioDialGestures();
    bindDpadNavigation();
    bindRadioKeyT9();

    var grid = el('radio-keypad-grid');
    if (grid && !grid._radioCommsBound) {
        grid._radioCommsBound = true;
        grid.addEventListener('click', function(e) {
            if (state.operatingMode === 'off') return;
            if (isFieldEditActive(fieldEditSession)) return;

            if (isRadioOsActive(radioOs)) return;

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
            if (key === '*') {
                startFieldEdit('freq', { returnTo: 'standby' });
                return;
            }
            if (key === '#') {
                startFieldEdit('encrypt', { returnTo: 'standby' });
                return;
            }

            if (/^[0-9]$/.test(key)) {
                var slot = parseInt(key, 10);
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
            updateInputForMode();
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
    var tearPage = el('radio-notebook-tear');
    if (tearPage && !tearPage._radioCommsBound) {
        tearPage._radioCommsBound = true;
        tearPage.addEventListener('click', function() { tearLastStationPage(); });
    }
    if (!window._patracNotebookResizeBound) {
        window._patracNotebookResizeBound = true;
        var resizeTimer = null;
        window.addEventListener('resize', function() {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (notebook) renderNotebook();
            }, 180);
        });
    }
    bindNotebookSwipe();
    bindDisplayDialSwipe();
}

function bindDpadNavigation() {
    var dpadKeys = ['up', 'down', 'left', 'right'];
    for (var i = 0; i < dpadKeys.length; i++) {
        (function(key) {
            var btn = document.querySelector('#radio-dpad-zone [data-key="' + key + '"]');
            if (!btn || btn._radioOsBound) return;
            btn._radioOsBound = true;
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (state.operatingMode === 'off') return;
                if (isFieldEditActive(fieldEditSession)) {
                    handleFieldEditAction(key);
                    return;
                }
                if (isRadioOsActive(radioOs)) {
                    if (key === 'left' || key === 'right') return;
                    handleRadioOsInput(key);
                    return;
                }
                if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
                    handleRadioOsInput('open_menu');
                }
            });
        })(dpadKeys[i]);
    }
}

function bindDisplayDialSwipe() {
    var screen = el('radio-display-screen');
    if (!screen || screen._dialSwipeBound) return;
    screen._dialSwipeBound = true;
    bindHorizontalSwipe(screen, function() {
        if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
        if (cycleDialPreset(state, 1)) {
            persist();
            renderDisplay();
            refreshSubscriptions();
        }
    }, function() {
        if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
        if (cycleDialPreset(state, -1)) {
            persist();
            renderDisplay();
            refreshSubscriptions();
        }
    });
}

var RADIO_OPERATING_MODES = ['off', 'voice', 'text'];

function cycleOperatingMode(direction) {
    var cur = state.operatingMode || 'voice';
    var idx = RADIO_OPERATING_MODES.indexOf(cur);
    if (idx < 0) idx = 1;
    var dir = direction < 0 ? -1 : 1;
    idx = (idx + dir + RADIO_OPERATING_MODES.length) % RADIO_OPERATING_MODES.length;
    state.operatingMode = RADIO_OPERATING_MODES[idx];
    resetRadioOs(radioOs);
    presetEditDraft = null;
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    persist();
    renderDisplay();
}

function bindHorizontalSwipe(node, onSwipeLeft, onSwipeRight, minDx) {
    if (!node || node._horizSwipeBound) return;
    node._horizSwipeBound = true;
    var startX = 0;
    var startY = 0;
    var tracking = false;
    var threshold = minDx || 22;
    var pointerId = null;

    function reset() {
        tracking = false;
        pointerId = null;
    }

    function finish(clientX, clientY) {
        if (!tracking) return;
        var dx = clientX - startX;
        var dy = clientY - startY;
        reset();
        if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) {
            if (onSwipeLeft) onSwipeLeft();
        } else if (onSwipeRight) {
            onSwipeRight();
        }
    }

    node.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        tracking = true;
        pointerId = e.pointerId;
        try { node.setPointerCapture(e.pointerId); } catch (err) {}
    });
    node.addEventListener('pointermove', function(e) {
        if (!tracking || e.pointerId !== pointerId) return;
        e.preventDefault();
        e.stopPropagation();
    });
    node.addEventListener('pointerup', function(e) {
        if (!tracking || e.pointerId !== pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        finish(e.clientX, e.clientY);
        try { node.releasePointerCapture(e.pointerId); } catch (err2) {}
    });
    node.addEventListener('pointercancel', reset);
}

function bindHoldVerticalSwipe(node, onSwipeDown, onSwipeUp, opts) {
    if (!node || node._holdVertBound) return;
    node._holdVertBound = true;
    opts = opts || {};
    var holdMs = opts.holdMs || 90;
    var minDy = opts.minDy || 22;
    var startX = 0;
    var startY = 0;
    var holdTimer = null;
    var armed = false;
    var tracking = false;
    var pointerId = null;

    function reset() {
        tracking = false;
        armed = false;
        pointerId = null;
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
    }

    function onHoldReady() {
        holdTimer = null;
        armed = true;
        node.classList.add('sector-dial-armed');
    }

    function finish(clientX, clientY) {
        node.classList.remove('sector-dial-armed');
        if (!tracking || !armed) {
            reset();
            return;
        }
        var dy = clientY - startY;
        var dx = clientX - startX;
        reset();
        if (Math.abs(dy) < minDy || Math.abs(dy) < Math.abs(dx)) return;
        if (dy > 0) {
            if (onSwipeDown) onSwipeDown();
        } else if (onSwipeUp) {
            onSwipeUp();
        }
    }

    node.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        reset();
        startX = e.clientX;
        startY = e.clientY;
        tracking = true;
        pointerId = e.pointerId;
        holdTimer = setTimeout(onHoldReady, holdMs);
        try { node.setPointerCapture(e.pointerId); } catch (err) {}
    });
    node.addEventListener('pointermove', function(e) {
        if (!tracking || e.pointerId !== pointerId) return;
        e.preventDefault();
        e.stopPropagation();
    });
    node.addEventListener('pointerup', function(e) {
        if (!tracking || e.pointerId !== pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        finish(e.clientX, e.clientY);
        try { node.releasePointerCapture(e.pointerId); } catch (err2) {}
    });
    node.addEventListener('pointercancel', function() {
        node.classList.remove('sector-dial-armed');
        reset();
    });
}

function bindRadioDialGestures() {
    bindHorizontalSwipe(el('radio-key-mode'), function() {
        cycleOperatingMode(1);
    }, function() {
        cycleOperatingMode(-1);
    });

    bindHorizontalSwipe(el('radio-key-preset-dial'), function() {
        if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
        if (cycleDialPreset(state, 1)) {
            persist();
            renderDisplay();
            refreshSubscriptions();
        }
    }, function() {
        if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
        if (cycleDialPreset(state, -1)) {
            persist();
            renderDisplay();
            refreshSubscriptions();
        }
    });

    bindHoldVerticalSwipe(el('radio-key-main-dial'), function() {
        if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
        adjustFrequency(state, -1);
        persist();
        renderDisplay();
        refreshSubscriptions();
    }, function() {
        if (state.operatingMode === 'off' || isRadioOsActive(radioOs) || isFieldEditActive(fieldEditSession)) return;
        adjustFrequency(state, 1);
        persist();
        renderDisplay();
        refreshSubscriptions();
    });
}

export function initRadioCommsSystem(options) {
    ctx = options || {};
    var c = getCtx();
    state = loadRadioState(c.userId, c);
    notebook = loadNotebook(c.userId);
    notebook = sanitizeStationNotebook(notebook, {
        userId: c.userId,
        playerName: c.playerName
    });
    saveNotebook(c.userId, notebook);
    seenMessageIds = {};
    if (notebook && notebook.station) {
        for (var i = 0; i < notebook.station.length; i++) {
            var e = notebook.station[i];
            if (!e) continue;
            if (e.id) seenMessageIds[e.id] = true;
            if (e.cloudId) seenMessageIds[e.cloudId] = true;
        }
    }

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
    resetRadioOs(radioOs);
    initSectorTechShell();
    window.patracRefreshSectorTech = refreshSectorTechLayout;
    syncNotebookTabs();
    renderDisplay();
    var layout = stationPageMetrics();
    trimStationToMaxPages(notebook, NOTEBOOK_MAX_PAGES, layout.linesPerPage, layout.charsPerLine);
    saveNotebook(c.userId, notebook);
    renderNotebook();
    refreshSubscriptions();
    notifyRadioRangeLayer();
}

export function refreshRadioCommsContext() {
    if (!state) return;
    var c = getCtx();
    state = loadRadioState(c.userId, c);
    renderDisplay();
    refreshSubscriptions();
    notifyRadioRangeLayer();
}

export function stopRadioComms() {
    stopRadioSubscriptions();
}

export function updateRadioDisplayHud() {
    refreshRadioCommsContext();
}
