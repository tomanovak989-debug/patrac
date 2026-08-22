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
    normalizeOperatingMode,
    collectTunedFrequencies,
    createOutgoingEntry,
    createIncomingEntry,
    communityFrequencyFromCode,
    getCommunityRadioKey,
    formatStandbyPresetLine,
    formatStandbyFrequencyLine,
    formatStandbyEncryptionLine,
    GLOBAL_FREQUENCY,
    GLOBAL_ENCRYPTION,
    NOTEBOOK_TABS,
    NOTEBOOK_TAB_LABELS,
    NOTEBOOK_LINES_PER_PAGE,
    NOTEBOOK_CHARS_PER_LINE,
    NOTEBOOK_MAX_PAGES,
    getNotebookPageCount,
    expandPlainNotebookLines,
    getStationVisualPageCount,
    getStationVisualPageLines,
    getStationVisualPageIndexForEntry,
    removeLastStationPage,
    trimStationToMaxPages,
    normalizeNoteEntry,
    normalizeNotesList,
    maskEncryptionKey,
    getNotesVisualPageCount,
    getNotesVisualPageLines,
    getNotesVisualPageIndexForEntry,
    removeLastNotesPage,
    trimNotesToMaxPages,
    deleteNoteById,
    countUnreadInbox
} from './radioComms.js';
import { sendRadioTransmission, subscribeRadioListen, stopRadioSubscriptions, upsertRadioBeaconLive, clearRadioBeaconLive, subscribeRadioBeaconsLive } from './radioService.js';
import { getFirebaseAuth } from '../lib/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
    evaluateBestRadioReception,
    applyReceptionToMessage,
    noisePlaceholder,
    SIGNAL_NOISE,
    SIGNAL_CLEAR,
    SIGNAL_NONE
} from './radioPropagation.js';
import {
    fetchElevationsM,
    fetchPathElevationsM,
    getCachedElevationM,
    midpointLatLng
} from './radioElevation.js';
import { listReceiverNodes, listReceivers } from './radioReceivers.js';
import {
    getGridPageCount,
    getGridPage,
    renderGridPageHtml,
    copyGridLineText
} from './radioGrids.js';
import { initSectorTechShell, refreshSectorTechLayout } from './radioSectorShell.js';
import { applyDisplayTypography } from './radioHitmap.js';
import {
    syncBattery,
    formatStandbyClockBattery,
    formatDisplayClockLine,
    formatBatteryPercent,
    toggleBatteryCharging,
    stopBatteryCharging,
    canPowerRadioOn
} from './radioBattery.js';
import { radioIconUrl } from './radioMenuIcons.js';
import { wrapMenuFocus, clampMenuFocus } from './radioMenuScroll.js';
import { radioKeyFeedback, radioTxStart, radioTxEnd, radioIncomingFeedback, initRadioFeedback, setRadioSoundPrefs, previewSoundPref, radioDialFeedback, radioKeypadPttDown, radioKeypadPttUp } from './radioFeedback.js';
import {
    createRadioOsState,
    resetRadioOs,
    radioOsHandleInput,
    buildOsDisplayLines,
    isRadioOsActive,
    createPresetDraft,
    savePresetDraft,
    getFocusedMenuItem,
    getMenuItems
} from './radioOs.js';
import {
    createAutoscanState,
    startAutoscan,
    advanceAutoscanVisual,
    stopAutoscan,
    lockAutoscan,
    isAutoscanListenFrequency,
    bandIndexForFrequency,
    AUTOSCAN_VISUAL_MS,
    SCAN_IDLE,
    SCAN_RUNNING,
    SCAN_LOCKED
} from './radioAutoscan.js';
import {
    createBeaconSession,
    loadLocalBeacon,
    saveLocalBeacon,
    clearLocalBeacon,
    registerRemoteBeacon,
    applyLiveBeaconSnapshot,
    getMapBeacons,
    getFocusedBeaconAction,
    clampBeaconFocus,
    BEACON_HUB,
    BEACON_CONFIRM,
    BEACON_PTT_ARM,
    BEACON_REPEAT_MS,
    BEACON_SOS_FREQUENCY,
    buildBeaconPayload,
    beaconBroadcastFrequencies
} from './radioBeacon.js';
import {
    createCommsState,
    clampCommsFocus,
    getFocusedCommsAction,
    commsBackScreen,
    formatChannelTarget,
    COMMS_HUB,
    COMMS_INBOX,
    COMMS_OUTBOX,
    COMMS_DRAFTS,
    COMMS_AUTOSCAN,
    COMMS_COMPOSE,
    COMMS_CONFIRM,
    COMMS_DETAIL,
    COMMS_TEMPLATES,
    markCommsEntryRead,
    appendAutoscanCapture,
    markAutoscanCaptureRead
} from './radioMessages.js';
import {
    createStandbyUiState,
    getStandbyField,
    clampStandbyFocus,
    buildStandbyDisplay
} from './radioStandby.js';
import {
    createSnakeState,
    resetSnakeState,
    snakeSetDirection,
    snakeTick,
    buildSnakeCellGrid,
    SNAKE_TICK_MS,
    SNAKE_CELL_COUNT,
    SNAKE_W,
    SNAKE_H
} from './radioSnake.js';
import {
    createArkanoidState,
    resetArkanoidState,
    arkanoidMovePaddle,
    arkanoidTick,
    arkanoidOk,
    buildArkanoidCellGrid,
    ARK_TICK_MS,
    ARK_CELL_COUNT,
    ARK_W,
    ARK_H
} from './radioArkanoid.js';
import {
    createDecoderState,
    resetDecoderState
} from './radioDecoder.js';
import {
    bindQuickKey,
    bindingFromMenuItem,
    bindingFromCommsItem,
    bindingFromPresetField,
    bindingFromAutoscan,
    getQuickKeyBinding,
    formatMenuDisplayLabel,
    QUICK_KEY_IDS
} from './radioShortcuts.js';
import {
    createMenuDialState,
    clearMenuDial,
    planMenuDialCommit
} from './radioMenuDial.js';
import {
    createPttSession,
    startPttRecording,
    stopPttRecording,
    cancelPttRecording,
    playPttAudio,
    formatPttNotebookText,
    PTT_MAX_MS,
    isPttSupported
} from './radioPtt.js';
import {
    createFieldEdit,
    isFieldEditActive,
    buildFieldEditView,
    handleFieldEditInput,
    handleFieldEditOk,
    handleFieldEditBack,
    applyFieldEditToState,
    applyFieldEditToDraft,
    cancelFieldEdit,
    readFieldEditValues,
    finalizeT9Session,
    insertFieldEditSpace,
    textEditHint
} from './radioFieldEdit.js';
import {
    resolveActiveRadioNode
} from './radioNodes.js';

var ctx = {};
var state = null;
var receptionElev = {
    shelterM: null,
    playerM: null
};
var radioOs = createRadioOsState();
var fieldEditSession = null;
var fieldEditKeyLongFired = false;
var fieldEditPunctFired = false;
var clrLongFired = false;
var clrLongTimer = null;
var presetEditDraft = null;
var autoscanSession = null;
var autoscanTimer = null;
var batteryTimer = null;
var snakeSession = null;
var snakeTimer = null;
var arkanoidSession = null;
var arkanoidTimer = null;
var decoderSession = null;
var beaconSession = null;
var beaconActive = null;
var beaconRepeatTimer = null;
var beaconPttPending = false;
var beaconInboxNoted = {};
var commsSession = null;
var standbyUi = createStandbyUiState();
var pttSession = createPttSession();
var pttMaxTimer = null;
var shortcutHoldKey = null;
var shortcutHoldTimer = null;
var shortcutBindNotice = null;
var shortcutBindNoticeTimer = null;
var standbyPttActive = false;
var menuDial = createMenuDialState();
var notebook = null;
var activeNotebookTab = 'station';
var seenMessageIds = {};
var flipTimer = null;
var radioAuthUnsub = null;

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

function getComCode() {
    return ctx.getComCode ? ctx.getComCode() : (localStorage.getItem('com_code') || '');
}

function getRelayNodes(channel) {
    return listReceiverNodes(getComCode(), channel || null);
}

function evaluateIncomingReception(origin, channel) {
    var receiver = getRadioLatLng();
    var resolved = resolveActiveRadioNode(radioNodeDeps());
    var receiverElev = activeNodeElevationM(resolved);
    var originElev = getCachedElevationM(origin && origin.lat, origin && origin.lng);
    if (originElev == null) originElev = 0;
    var pathElevs = null;
    if (origin && receiver) {
        var mid = midpointLatLng(origin, receiver);
        var midElev = mid ? getCachedElevationM(mid.lat, mid.lng) : null;
        pathElevs = { fromM: originElev, toM: receiverElev, midM: midElev };
    }
    return evaluateBestRadioReception(origin, receiver, {
        pathElevs: pathElevs,
        relays: getRelayNodes(channel),
        channel: channel || null
    });
}

async function prefetchReceptionElevations() {
    var shelter = getShelterLatLng();
    var player = getPlayerLatLng();
    var relays = getRelayNodes();
    var points = [];
    if (shelter) points.push(shelter);
    if (player) points.push(player);
    var i;
    for (i = 0; i < relays.length; i++) {
        if (relays[i]) points.push({ lat: relays[i].lat, lng: relays[i].lng });
    }
    if (!points.length) return;
    await fetchElevationsM(points);
    if (shelter) receptionElev.shelterM = getCachedElevationM(shelter.lat, shelter.lng);
    if (player) receptionElev.playerM = getCachedElevationM(player.lat, player.lng);
    for (i = 0; i < relays.length; i++) {
        var rx = relays[i];
        if (!rx) continue;
        rx.elevationM = getCachedElevationM(rx.lat, rx.lng);
    }
    notifyRadioRangeLayer();
}

function schedulePathElevationPrefetch(origin) {
    var receiver = getRadioLatLng();
    if (!origin || !receiver) return;
    fetchPathElevationsM(origin, receiver).catch(function(err) {
        console.warn('[radioUi] path elevation', err);
    });
}

function radioNodeDeps(userId) {
    return {
        userId: userId || (ctx.getUserId ? ctx.getUserId() : ''),
        getShelterLatLng: getShelterLatLng,
        getPlayerLatLng: getPlayerLatLng,
        getReceivers: getRelayNodes
    };
}

/**
 * TX/RX pozice = GPS nosič (NOSIČ).
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

var LINE_MARQUEE_HOLD_MS = 2000;
var lineMarqueeState = null;
var MENU_SCROLL_MS = 220;

function menuTransformY(px) {
    return 'translate3d(0,' + px + 'px,0)';
}
var menuScrollTracker = { key: '', index: -1 };
var menuScrollAnimating = false;

function escapeDisplayText(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function clearLineMarquee() {
    if (lineMarqueeState && lineMarqueeState.holdTimer) {
        clearTimeout(lineMarqueeState.holdTimer);
    }
    if (lineMarqueeState && lineMarqueeState.lineEl) {
        lineMarqueeState.lineEl.classList.remove('radio-display-row-marquee-active');
    }
    lineMarqueeState = null;
}

function isCommsMarqueeScreen() {
    return isCommsMenuOpen() && commsSession && (
        commsSession.screen === COMMS_INBOX ||
        commsSession.screen === COMMS_OUTBOX ||
        commsSession.screen === COMMS_DRAFTS
    );
}

function startLineMarquee(row, fullText) {
    if (!row || !fullText) return;
    var textEl = row.querySelector('.radio-display-row-text');
    if (!textEl) {
        row.textContent = fullText;
        textEl = row;
    } else {
        textEl.textContent = fullText;
    }
    if (textEl.scrollWidth <= textEl.clientWidth + 2) return;
    var duration = Math.max(2.8, (fullText.length * 0.11));
    row.classList.add('radio-display-row-marquee-active');
    textEl.innerHTML = '<span class="radio-display-line-inner" style="--marquee-duration:' + duration.toFixed(2) + 's;--marquee-shift:' + (textEl.scrollWidth - textEl.clientWidth) + 'px">' +
        escapeDisplayText(fullText) + '</span>';
}

function scheduleLineMarquee(focusLine, fullText) {
    clearLineMarquee();
    if (focusLine == null || focusLine < 0 || !fullText || !isCommsMarqueeScreen()) return;
    var row = el(DISPLAY_LINE_IDS[focusLine]);
    if (!row) return;
    lineMarqueeState = {
        lineEl: row,
        fullText: fullText,
        focusLine: focusLine,
        holdTimer: setTimeout(function() {
            if (!lineMarqueeState || lineMarqueeState.focusLine !== focusLine) return;
            startLineMarquee(lineMarqueeState.lineEl, lineMarqueeState.fullText);
        }, LINE_MARQUEE_HOLD_MS)
    };
}

function setDisplayTextLines(lines) {
    setDisplayMenuLines(lines, -1);
}

function formatDisplayStatus(text) {
    return formatMenuDisplayLabel(text || '');
}

function isStandbyTransmitting() {
    return !!(standbyPttActive || (pttSession && pttSession.active && isStandbyScreen()));
}

function getStandbyStatusTitle(state) {
    return formatStandbyPresetLine(state);
}

function setStandbyClockDisplay(clockEl, state) {
    if (!clockEl) return;
    clockEl.textContent = formatStandbyClockBattery(state);
}

function updateRadioStatusWidgets(state, osView) {
    var clockEl = el('radio-display-clock');
    var batteryWrap = el('radio-display-battery');
    var batteryPct = el('radio-display-battery-pct');
    var batteryBg = el('radio-display-battery-bg');
    var autoscanActive = !!(autoscanSession && autoscanSession.status === SCAN_RUNNING);

    if (clockEl) clockEl.textContent = formatDisplayClockLine(state);

    if (batteryPct) batteryPct.textContent = String(Math.round(state.batteryLevel));
    if (batteryBg) batteryBg.src = radioIconUrl('battery-empty.png');

    if (batteryWrap) {
        batteryWrap.hidden = state.operatingMode === 'off' && !state.batteryCharging;
    }
}

function applyStandbyMainLayout(f, k, buf, p, state, opts) {
    opts = opts || {};
    var presetLine = formatStandbyPresetLine(state);
    var freqLine = formatStandbyFrequencyLine(state);
    var encLine = formatStandbyEncryptionLine(state);
    var gpsOk = !!opts.gpsOk;

    if (f) {
        f.className = 'radio-display-standby-preset';
        f.textContent = presetLine;
        f.removeAttribute('title');
        f.classList.remove('radio-display-freq-node', 'is-handset', 'is-fallback', 'radio-display-battery-only', 'radio-display-row-focus');
    }
    if (k) {
        k.className = 'radio-display-standby-freq';
        k.classList.toggle('radio-display-row-focus', opts.focusFreq === true);
        k.textContent = (opts.focusFreq ? '▸ ' : '') + freqLine;
        k.title = gpsOk
            ? 'Frekvence · GPS nosič'
            : 'Frekvence · GPS nedostupné — zapni polohu v prohlížeči';
    }
    if (buf) {
        buf.className = 'radio-display-standby-key';
        buf.classList.toggle('radio-display-row-focus', opts.focusEncrypt === true);
        buf.textContent = (opts.focusEncrypt ? '▸ ' : '') + encLine;
    }
    if (p) {
        p.className = '';
        p.classList.remove('radio-display-row-focus');
        if (opts.dialBuffer) p.textContent = opts.dialBuffer;
        else if (opts.beaconSos) p.textContent = opts.beaconSos;
        else if (opts.pttLine) p.textContent = opts.pttLine;
        else p.textContent = '';
    }
}

function setStandbySignalIndicator(sig) {
    if (!sig) return;
    if (isStandbyTransmitting()) {
        sig.textContent = '● TX';
        sig.classList.remove('is-tuned', 'is-standby');
        return;
    }
    sig.textContent = '';
    sig.classList.remove('is-tuned', 'is-standby');
}

function clearStandbyDisplayLayout(f, k, buf, p) {
    var rows = [f, k, buf, p];
    var i;
    for (i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row) continue;
        row.className = '';
        row.classList.remove(
            'radio-display-standby-preset',
            'radio-display-standby-freq',
            'radio-display-standby-key',
            'radio-display-row-focus',
            'radio-display-freq-node',
            'is-handset',
            'is-fallback',
            'radio-display-battery-only'
        );
        row.removeAttribute('title');
        row.style.removeProperty('font-weight');
        row.style.removeProperty('font-size');
    }
}

function buildMenuRowHtml(text, iconFile) {
    var parts = '<div class="radio-display-row-slide">';
    if (iconFile) {
        parts += '<img class="radio-display-row-icon" src="' + escapeDisplayText(radioIconUrl(iconFile)) + '" alt="" draggable="false">';
    }
    parts += '<span class="radio-display-row-text">' + escapeDisplayText(text || '') + '</span></div>';
    return parts;
}

function getRowSlide(row) {
    if (!row) return null;
    return row.querySelector('.radio-display-row-slide');
}

function applyMenuLineContent(lines, focusLine, lineStyles, lineIcons) {
    lines = lines || [];
    focusLine = focusLine == null ? -1 : focusLine;
    lineStyles = lineStyles || [];
    lineIcons = lineIcons || [];
    var i;
    for (i = 0; i < DISPLAY_LINE_IDS.length; i++) {
        var row = el(DISPLAY_LINE_IDS[i]);
        if (!row) continue;
        var text = i < lines.length ? (lines[i] || '') : '';
        var iconFile = i < lineIcons.length ? lineIcons[i] : null;
        row.innerHTML = buildMenuRowHtml(text, iconFile);
        row.classList.remove('radio-display-row-marquee-active');
        row.classList.toggle('radio-display-row-unread', !!lineStyles[i]);
        row.classList.toggle('radio-display-row-focus', i === focusLine);
    }
    if (focusLine >= 0 && focusLine < lines.length && lines[focusLine]) {
        scheduleLineMarquee(focusLine, lines[focusLine]);
    }
}

function resolveMenuScrollMeta(osView) {
    if (!osView || osView.focusLine == null || osView.focusLine < 0) {
        return { key: '', index: -1, animate: false };
    }
    if (osView.mode !== 'menu' && osView.mode !== 'comms' && osView.mode !== 'beacon' &&
        osView.mode !== 'preset_detail' && osView.mode !== 'sound_settings') {
        return { key: '', index: -1, animate: false };
    }
    var key = osView.mode + '|' + (osView.status || '');
    var index = -1;
    if (osView.mode === 'comms' && commsSession) index = commsSession.focusIndex;
    else if (osView.mode === 'beacon' && beaconSession) index = beaconSession.focusIndex;
    else if (osView.mode === 'preset_detail' && radioOs) index = radioOs.presetFieldFocus;
    else if (osView.mode === 'sound_settings' && radioOs) index = radioOs.soundFieldFocus;
    else if (radioOs) index = radioOs.focusIndex;
    return { key: key, index: index, animate: true };
}

function computeMenuScrollDirection(meta) {
    if (!meta.animate || meta.index < 0) return 0;
    var dir = 0;
    if (menuScrollTracker.key === meta.key && menuScrollTracker.index >= 0) {
        if (meta.index > menuScrollTracker.index) dir = 1;
        else if (meta.index < menuScrollTracker.index) dir = -1;
    }
    menuScrollTracker.key = meta.key;
    menuScrollTracker.index = meta.index;
    return dir;
}

function setDisplayMenuLines(lines, focusLine, lineStyles, lineIcons, scrollDir) {
    clearLineMarquee();
    scrollDir = scrollDir || 0;
    lineIcons = lineIcons || [];

    if (scrollDir !== 0 && focusLine >= 0 && !menuScrollAnimating) {
        var rows = [];
        var slides = [];
        var i;
        for (i = 0; i < DISPLAY_LINE_IDS.length; i++) {
            var rowEl = el(DISPLAY_LINE_IDS[i]);
            if (rowEl) rows.push(rowEl);
        }
        var lineH = rows[0] ? rows[0].offsetHeight : 0;
        if (lineH < 6) lineH = 14;

        applyMenuLineContent(lines, focusLine, lineStyles, lineIcons);

        for (i = 0; i < rows.length; i++) {
            slides.push(getRowSlide(rows[i]) || rows[i]);
        }
        if (!slides.length || !getRowSlide(rows[0])) {
            return;
        }

        menuScrollAnimating = true;
        var ease = 'transform ' + MENU_SCROLL_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';

        for (i = 0; i < slides.length; i++) {
            slides[i].style.transition = 'none';
            slides[i].style.transform = menuTransformY(scrollDir * lineH);
        }
        if (rows[0]) void rows[0].offsetHeight;

        requestAnimationFrame(function() {
            for (i = 0; i < slides.length; i++) {
                slides[i].style.transition = ease;
                slides[i].style.transform = menuTransformY(0);
            }
            setTimeout(function() {
                for (i = 0; i < slides.length; i++) {
                    slides[i].style.transition = '';
                    slides[i].style.transform = '';
                }
                menuScrollAnimating = false;
            }, MENU_SCROLL_MS + 20);
        });
        return;
    }

    applyMenuLineContent(lines, focusLine, lineStyles, lineIcons);
}

function clearDisplayRowFocus() {
    for (var i = 0; i < DISPLAY_LINE_IDS.length; i++) {
        var row = el(DISPLAY_LINE_IDS[i]);
        if (row) row.classList.remove('radio-display-row-focus');
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
        } else if (fieldEditSession.returnTo === 'comms_target' && commsSession) {
            var vals = readFieldEditValues(fieldEditSession);
            if (fieldEditSession.type === 'freq' && vals.frequency) {
                commsSession.pendingTarget = formatChannelTarget(state, {
                    frequency: vals.frequency,
                    presetSlot: null
                });
            } else if (fieldEditSession.type === 'encrypt') {
                commsSession.pendingTarget = formatChannelTarget(state, {
                    encryptionKey: vals.text || '',
                    presetSlot: commsSession.pendingTarget ? commsSession.pendingTarget.presetSlot : null
                });
            }
        } else if (fieldEditSession.returnTo === 'standby_manual' || fieldEditSession.returnTo === 'standby') {
            applyFieldEditToState(fieldEditSession, state, {
                scope: classifyChannel(state.frequency, state.encryptionKey, c)
            });
            state.activePresetSlot = null;
        } else if (fieldEditSession.returnTo !== 'comms') {
            applyFieldEditToState(fieldEditSession, state, {
                scope: classifyChannel(state.frequency, state.encryptionKey, c)
            });
        }
        persist();
        refreshSubscriptions();
    }
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    if (fieldEditSession === null && standbyUi.active && save) {
        /* zůstat ve výběru F/Š */
    }
    var input = el('chat-input-field');
    if (input) {
        input.value = '';
        input.blur();
    }
    renderDisplay();
}

function isStandbyScreen() {
    return state && state.operatingMode !== 'off' && !isRadioOsActive(radioOs) && !isFieldEditActive(fieldEditSession);
}

function openStandbyFieldEdit(field) {
    if (field === 'freq') {
        startFieldEdit('freq', { frequency: state.frequency, returnTo: 'standby_manual' });
    } else {
        startFieldEdit('encrypt', { encryptionKey: state.encryptionKey, returnTo: 'standby_manual' });
    }
    if (fieldEditSession) {
        fieldEditSession.digitMode = true;
        fieldEditSession.okExitPending = false;
        fieldEditSession.cursor = 0;
    }
}

function handleStandbyInput(action) {
    if (!isStandbyScreen()) return false;
    if (action === 'preset_prev' || action === 'preset_next') {
        if (!standbyUi.active) return false;
        if (cycleDialPreset(state, action === 'preset_next' ? 1 : -1)) {
            persist();
            refreshSubscriptions();
            renderDisplay();
        }
        return true;
    }
    if (action === 'up') {
        if (!standbyUi.active) {
            standbyUi.active = true;
            standbyUi.focusIndex = 0;
        } else {
            standbyUi.focusIndex = clampStandbyFocus(standbyUi.focusIndex - 1);
        }
        renderDisplay();
        return true;
    }
    if (action === 'down') {
        if (!standbyUi.active) {
            standbyUi.active = true;
            standbyUi.focusIndex = 0;
        } else {
            standbyUi.focusIndex = clampStandbyFocus(standbyUi.focusIndex + 1);
        }
        renderDisplay();
        return true;
    }
    if (action === 'back') {
        if (standbyUi.active) {
            standbyUi.active = false;
            renderDisplay();
            return true;
        }
        return false;
    }
    if (action === 'ok') {
        if (standbyUi.active) {
            openStandbyFieldEdit(getStandbyField(standbyUi.focusIndex));
            return true;
        }
        return handleRadioOsInput('open_menu');
    }
    return false;
}

function clearShortcutHold() {
    shortcutHoldKey = null;
    if (shortcutHoldTimer) {
        clearTimeout(shortcutHoldTimer);
        shortcutHoldTimer = null;
    }
}

function refreshRadioUnreadBadge() {
    var badge = el('hud-radio-unread');
    if (!badge) return;
    var n = countUnreadInbox(notebook);
    badge.textContent = String(n);
    badge.classList.toggle('is-hidden', n <= 0);
    var radioBtn = el('hud-icon-radio');
    if (radioBtn) radioBtn.classList.toggle('has-unread', n > 0);
}

function getBindableShortcutContext() {
    if (!isRadioOsActive(radioOs)) return null;
    var leaf = radioOs.menuPath && radioOs.menuPath.length
        ? radioOs.menuPath[radioOs.menuPath.length - 1]
        : '';

    if (leaf === 'comms') {
        ensureCommsSession();
        return bindingFromCommsItem(getFocusedCommsAction(commsSession, notebook), commsSession);
    }
    if (leaf === 'detail' && presetEditDraft) {
        return {
            action: 'preset:' + presetEditDraft.slot,
            label: 'P' + presetEditDraft.slot
        };
    }
    if (leaf === 'presets') {
        var presetItem = getFocusedMenuItem(radioOs, state);
        if (presetItem && presetItem.action === 'preset_detail' && presetItem.slot) {
            return {
                action: 'preset:' + presetItem.slot,
                label: 'P' + presetItem.slot
            };
        }
    }
    if (leaf === 'autoscan') {
        return bindingFromAutoscan(autoscanSession);
    }
    if (leaf === 'beacon') {
        ensureBeaconSession();
        refreshBeaconActiveFromStorage();
        var beaconAction = getFocusedBeaconAction(beaconSession, beaconActive);
        if (beaconAction && beaconAction.id === 'beacon_sms') {
            return { action: 'beacon:open', label: 'BEACON · SMS' };
        }
        if (beaconAction && beaconAction.id === 'beacon_ptt') {
            return { action: 'beacon:open', label: 'BEACON · PTT' };
        }
        if (beaconAction && beaconAction.id === 'beacon_stop') {
            return { action: 'beacon:open', label: 'BEACON · STOP' };
        }
        return { action: 'beacon:open', label: 'BEACON' };
    }
    return bindingFromMenuItem(getFocusedMenuItem(radioOs, state));
}

function showShortcutBindNotice(keyId, label) {
    shortcutBindNotice = {
        keyId: String(keyId || '').toUpperCase(),
        label: label || ''
    };
    if (shortcutBindNoticeTimer) clearTimeout(shortcutBindNoticeTimer);
    shortcutBindNoticeTimer = setTimeout(function() {
        shortcutBindNotice = null;
        shortcutBindNoticeTimer = null;
        renderDisplay();
    }, 1600);
}

function bindShortcutFromMenu(keyId) {
    if (state.operatingMode === 'off' || !isRadioOsActive(radioOs)) return;
    if (isFieldEditActive(fieldEditSession)) return;
    var binding = getBindableShortcutContext();
    if (!binding) return;
    bindQuickKey(state, keyId, binding);
    persist();
    showShortcutBindNotice(keyId, binding.label);
    renderDisplay();
}

function isCommsMenuContext() {
    return isCommsMenuOpen() && commsSession && !isFieldEditActive(fieldEditSession);
}

function isQuickKeyId(keyId) {
    return keyId === 'p1' || keyId === 'p2' || /^[1-9]$/.test(keyId);
}

function tryExecuteQuickKey(keyId) {
    if (!isQuickKeyId(keyId)) return false;
    if (isFieldEditActive(fieldEditSession)) return false;
    if (!isStandbyScreen()) return false;
    return executeQuickKey(keyId);
}

function applyRadioOsEffect(result) {
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
    if (result.effect === 'sound_preview') {
        if (state.soundPrefs && result.field) {
            previewSoundPref(result.field, state.soundPrefs[result.field]);
            setRadioSoundPrefs(state.soundPrefs);
        }
        persist();
        renderDisplay();
        return true;
    }
    if (result.effect === 'sound_prefs_back') {
        setRadioSoundPrefs(state.soundPrefs);
        persist();
        renderDisplay();
        return true;
    }
    if (result.effect === 'autoscan_open') {
        openRadioAutoscanScreen(false);
        return true;
    }
    if (result.effect === 'autoscan_close') {
        handleAutoscanClose();
        return true;
    }
    if (result.effect === 'autoscan_ok') {
        handleAutoscanOk();
        return true;
    }
    if (result.effect === 'beacon_open') {
        handleBeaconOpen();
        return true;
    }
    if (result.effect === 'beacon_close') {
        handleBeaconClose();
        return true;
    }
    if (result.effect === 'beacon_ok') {
        handleBeaconOk();
        return true;
    }
    if (result.effect === 'beacon_up') {
        handleBeaconUp();
        return true;
    }
    if (result.effect === 'beacon_down') {
        handleBeaconDown();
        return true;
    }
    if (result.effect === 'comms_open') {
        ensureCommsSession();
        commsSession.screen = COMMS_HUB;
        commsSession.focusIndex = 0;
        renderDisplay();
        return true;
    }
    if (result.effect === 'comms_back') {
        handleCommsBack();
        return true;
    }
    if (result.effect === 'comms_close') {
        handleCommsClose();
        return true;
    }
    if (result.effect === 'comms_up') {
        handleCommsUp();
        return true;
    }
    if (result.effect === 'comms_down') {
        handleCommsDown();
        return true;
    }
    if (result.effect === 'comms_ok') {
        handleCommsOk();
        return true;
    }
    if (result.effect === 'snake_open') {
        openSnakeScreen();
        return true;
    }
    if (result.effect === 'snake_close') {
        closeSnakeScreen();
        return true;
    }
    if (result.effect === 'snake_dir') {
        if (snakeSession) snakeSetDirection(snakeSession, result.dir);
        renderDisplay();
        return true;
    }
    if (result.effect === 'snake_ok') {
        handleSnakeOk();
        return true;
    }
    if (result.effect === 'arkanoid_open') {
        openArkanoidScreen();
        return true;
    }
    if (result.effect === 'arkanoid_close') {
        closeArkanoidScreen();
        return true;
    }
    if (result.effect === 'arkanoid_paddle') {
        if (arkanoidSession) arkanoidMovePaddle(arkanoidSession, result.dir);
        renderDisplay();
        return true;
    }
    if (result.effect === 'arkanoid_ok') {
        handleArkanoidOk();
        return true;
    }
    if (result.effect === 'decoder_open') {
        openDecoderScreen();
        return true;
    }
    if (result.effect === 'decoder_close') {
        closeDecoderScreen();
        return true;
    }
    if (result.effect === 'decoder_ok') {
        handleDecoderOk();
        return true;
    }
    renderDisplay();
    return true;
}

function executeMenuDialCommit() {
    var plan = planMenuDialCommit(menuDial, radioOs);
    clearMenuDial(menuDial);
    if (!plan || !plan.steps || !plan.steps.length) {
        renderDisplay();
        return;
    }
    var steps = plan.steps;
    var i;
    for (i = 0; i < steps.length; i++) {
        var step = steps[i];
        if (step.type === 'root') {
            var items = getMenuItems();
            var idx = step.value - 1;
            if (idx < 0 || idx >= items.length) break;
            radioOs.focusIndex = idx;
            applyRadioOsEffect(radioOsHandleInput(radioOs, state.operatingMode, 'ok', state));
        } else if (step.type === 'preset_slot') {
            radioOs.selectedSlot = step.value;
            if (radioOs.menuPath[radioOs.menuPath.length - 1] !== 'detail') {
                radioOs.menuPath.push('detail');
            }
            radioOs.presetFieldFocus = 0;
            radioOs.focusIndex = step.value - 1;
            presetEditDraft = createPresetDraft(step.value, state);
        } else if (step.type === 'comms_hub') {
            var hubId = hubActionFromDigit(String(step.value));
            if (hubId) openCommsAction(hubId);
        } else if (step.type === 'settings') {
            var settingsItems = getCurrentSettingsItems();
            var sidx = step.value - 1;
            if (sidx >= 0 && sidx < settingsItems.length) {
                radioOs.focusIndex = sidx;
                applyRadioOsEffect(radioOsHandleInput(radioOs, state.operatingMode, 'ok', state));
            }
        } else if (step.type === 'apps') {
            var appsItems = getCurrentAppsItems();
            var aidx = step.value - 1;
            if (aidx >= 0 && aidx < appsItems.length) {
                radioOs.focusIndex = aidx;
                applyRadioOsEffect(radioOsHandleInput(radioOs, state.operatingMode, 'ok', state));
            }
        }
    }
    renderDisplay();
}

function getCurrentSettingsItems() {
    return [
        { action: 'submenu:sounds' },
        { action: 'submenu:quickkeys' }
    ];
}

function getCurrentAppsItems() {
    return [
        { action: 'screen:snake' },
        { action: 'screen:arkanoid' },
        { action: 'screen:decoder' }
    ];
}

function clearMenuDialIfActive() {
    if (!menuDial || !menuDial.buffer) return false;
    clearMenuDial(menuDial);
    renderDisplay();
    return true;
}

function executeQuickKey(keyId) {
    if (!isStandbyScreen()) return false;
    var binding = getQuickKeyBinding(state, keyId);
    if (!binding || !binding.action) return false;
    clearMenuDial(menuDial);
    var action = binding.action;
    if (action === 'autoscan:start') {
        openRadioAutoscanScreen(true);
        return true;
    }
    if (action === 'menu:comms') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['comms'];
        ensureCommsSession();
        commsSession.screen = COMMS_HUB;
        renderDisplay();
        return true;
    }
    if (action === 'beacon:open') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['beacon'];
        handleBeaconOpen();
        return true;
    }
    if (action === 'menu:presets') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['presets'];
        radioOs.focusIndex = 0;
        renderDisplay();
        return true;
    }
    if (action.indexOf('preset:') === 0) {
        var slot = parseInt(action.split(':')[1], 10);
        if (slot && applyPreset(state, slot)) {
            persist();
            refreshSubscriptions();
            renderDisplay();
            return true;
        }
    }
    if (action === 'comms:new_sms' || action === 'comms:inbox' || action === 'comms:outbox' || action === 'comms:drafts' || action === 'comms:templates') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['comms'];
        ensureCommsSession();
        var map = {
            'comms:new_sms': 'new_sms',
            'comms:inbox': 'inbox',
            'comms:outbox': 'outbox',
            'comms:drafts': 'drafts',
            'comms:templates': 'templates'
        };
        openCommsAction(map[action]);
        return true;
    }
    if (action === 'snake:open') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['apps', 'snake'];
        openSnakeScreen();
        return true;
    }
    if (action === 'arkanoid:open') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['apps', 'arkanoid'];
        openArkanoidScreen();
        return true;
    }
    if (action === 'decoder:open') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['apps', 'decoder'];
        openDecoderScreen();
        return true;
    }
    if (action === 'menu:apps') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['apps'];
        radioOs.focusIndex = 0;
        renderDisplay();
        return true;
    }
    if (action === 'menu:settings') {
        resetRadioOs(radioOs);
        radioOs.screen = 'menu';
        radioOs.menuPath = ['settings'];
        radioOs.focusIndex = 0;
        renderDisplay();
        return true;
    }
    if (action === 'autoscan:open') {
        openRadioAutoscanScreen(false);
        return true;
    }
    if (action.indexOf('stub:') === 0) {
        resetRadioOs(radioOs);
        radioOs.screen = 'stub';
        radioOs.stubTitle = binding.label || 'VOLBA';
        renderDisplay();
        return true;
    }
    return false;
}

function handleMenuKeypadDigit(keyId) {
    if (isStandbyScreen() && isQuickKeyId(keyId)) {
        tryExecuteQuickKey(keyId);
    }
}

function ensureNotebookDrafts() {
    ensureNotebookMeta();
    if (!Array.isArray(notebook.drafts)) notebook.drafts = [];
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
            fieldEditSession.okExitPending = false;
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
            fieldEditSession.okExitPending = false;
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
            fieldEditSession.okExitPending = false;
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

function updateChargeButtonUi() {
    var btn = el('sector-view-charge');
    if (!btn || !state) return;
    var canCharge = state.operatingMode === 'off' && state.batteryLevel < 100;
    btn.classList.toggle('is-active', canCharge && !!state.batteryCharging);
    btn.classList.toggle('is-disabled', state.operatingMode !== 'off' || state.batteryLevel >= 100);
    btn.setAttribute('aria-disabled', (state.operatingMode !== 'off' || state.batteryLevel >= 100) ? 'true' : 'false');
}

function syncBatteryAndApply(opts) {
    if (!state) return null;
    opts = opts || {
        operatingMode: state.operatingMode,
        autoscanActive: isAutoscanListening()
    };
    var result = syncBattery(state, opts);
    if (result && result.powerOff) forceRadioPowerOff(false);
    if (result && result.chargeComplete) persist();
    return result;
}

function forceRadioPowerOff(renderAfter) {
    if (!state || state.operatingMode === 'off') return;
    haltAutoscan(true);
    autoscanSession = null;
    closeAppScreens();
    cancelStandbyPtt();
    standbyUi = createStandbyUiState();
    state.operatingMode = 'off';
    resetRadioOs(radioOs);
    presetEditDraft = null;
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    stopRadioSubscriptions();
    persist();
    if (renderAfter !== false) renderDisplay();
}

function applyOffChargingDisplay(f, k, buf, p, state) {
    var pct = formatBatteryPercent(state);
    if (f) {
        f.className = 'radio-display-charge-wrap';
        f.innerHTML = '<img class="radio-display-charge-icon" src="' +
            escapeDisplayText(radioIconUrl('battery-empty.png')) +
            '" alt="" draggable="false">' +
            '<span class="radio-display-charge-pct">' + escapeDisplayText(pct) + '</span>';
        f.removeAttribute('title');
    }
    if (k) { k.className = ''; k.textContent = ''; k.classList.remove('radio-display-row-focus'); }
    if (buf) { buf.className = ''; buf.textContent = ''; buf.classList.remove('radio-display-row-focus'); }
    if (p) { p.className = ''; p.textContent = ''; p.classList.remove('radio-display-row-focus'); }
    clearExtraDisplayLines();
}

function bindChargeControl() {
    var btn = el('sector-view-charge');
    if (!btn || btn._radioChargeBound) return;
    btn._radioChargeBound = true;
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!state || state.operatingMode !== 'off') return;
        if (toggleBatteryCharging(state)) {
            persist();
            renderDisplay();
        }
    });
}

function startBatteryTimer() {
    if (batteryTimer) return;
    batteryTimer = setInterval(function() {
        if (!state) return;
        syncBatteryAndApply({
            operatingMode: state.operatingMode,
            autoscanActive: isAutoscanListening()
        });
        if (state.operatingMode === 'on' || state.batteryCharging) {
            renderDisplay();
        }
    }, 30000);
}

function renderDisplay() {
    var c = getCtx();
    var screen = el('radio-display-screen');
    syncBatteryAndApply({
        operatingMode: state.operatingMode,
        autoscanActive: isAutoscanListening()
    });
    var standbyLines = buildDisplayLines(state, c);
    var opLabel = state.operatingMode === 'off' ? 'OFF' : 'ON';
    var dialBuffer = '';
    if (!isFieldEditActive(fieldEditSession) && (state.keypadMode === 'freq' || state.keypadMode === 'encrypt')) {
        dialBuffer = state.dialBuffer ? ('▸ ' + state.dialBuffer) : '';
    }

    var osView = buildOsDisplayLines(radioOs, state.operatingMode, {
        status: getStandbyStatusTitle(state) || opLabel,
        line1: standbyLines.line1,
        line2: standbyLines.line2,
        line3: standbyLines.line3,
        line4: dialBuffer,
        footer: standbyLines.footer,
        buffer: dialBuffer
    }, state, presetEditDraft, autoscanSession, commsSession, notebook, beaconSession, beaconActive, {
        pttRecording: !!(beaconPttPending || (pttSession && pttSession.active && isBeaconMenuOpen()))
    }, snakeSession, arkanoidSession, decoderSession);

    if (screen) {
        screen.classList.toggle('is-off', osView.mode === 'off');
        screen.classList.toggle('is-menu', osView.mode === 'menu' || osView.mode === 'stub' || osView.mode === 'preset_detail' || osView.mode === 'sound_settings' || osView.mode === 'autoscan' || osView.mode === 'comms' || osView.mode === 'beacon' || osView.mode === 'snake' || osView.mode === 'arkanoid' || osView.mode === 'decoder');
        screen.classList.toggle('is-snake', osView.mode === 'snake');
        screen.classList.toggle('is-arkanoid', osView.mode === 'arkanoid');
        screen.classList.toggle('is-decoder', osView.mode === 'decoder');
        screen.classList.toggle('is-standby', osView.mode === 'standby' || osView.mode === 'standby_tune');
        screen.classList.toggle('is-standby-tune', osView.mode === 'standby_tune' || !!(standbyUi && standbyUi.active));
        screen.classList.toggle('is-preset-detail', osView.mode === 'preset_detail' || osView.mode === 'sound_settings');
        screen.classList.toggle('is-charging', osView.mode === 'off' && !!(state && state.batteryCharging));
    }

    var showSnake = osView.mode === 'snake' && osView.useBoard && snakeSession && snakeSession.alive;
    var showArkanoid = osView.mode === 'arkanoid' && osView.useBoard && arkanoidSession && arkanoidSession.alive;
    if (!showSnake) hideSnakeBoard();
    if (!showArkanoid) hideArkanoidBoard();

    var f = el('radio-display-freq');
    var k = el('radio-display-key');
    var p = el('radio-display-preset');
    var foot = el('radio-display-com');
    var sig = el('radio-display-signal');
    var ch = el('radio-display-channel');
    var clockEl = el('radio-display-clock');
    var nodeEl = el('radio-display-node');
    var buf = el('radio-display-buffer');
    var footerWrap = el('radio-display-footer');

    if (isFieldEditActive(fieldEditSession) && state.operatingMode !== 'off') {
        var editOpts = {};
        if (fieldEditSession.returnTo === 'preset_detail' && presetEditDraft) {
            editOpts.status = 'P' + presetEditDraft.slot + ' · PRESET';
        } else if (fieldEditSession.returnTo === 'comms') {
            editOpts.status = 'NOVÁ SMS · TX';
        } else if (fieldEditSession.returnTo === 'beacon') {
            editOpts.status = 'BEACON · SMS';
        }
        var editView = buildFieldEditView(fieldEditSession, editOpts);
        if (fieldEditSession.returnTo === 'comms') {
            editView.footer = 'OK = TX · Zpět';
            editView.hint = textEditHint();
        }
        if (fieldEditSession.returnTo === 'beacon') {
            editView.footer = 'OK = další · Zpět';
            editView.hint = textEditHint();
        }
        if (screen) {
            screen.classList.toggle('is-off', false);
            screen.classList.toggle('is-menu', false);
            screen.classList.toggle('is-standby', false);
            screen.classList.toggle('is-field-edit', true);
            screen.classList.toggle('is-freq-edit', editView.editType === 'freq');
            screen.classList.toggle('is-key-edit', editView.editType === 'encrypt');
            screen.classList.toggle('is-text-edit', editView.editType === 'text');
        }
        if (ch) {
            ch.textContent = '';
        }
        updateRadioStatusWidgets(state, null);
        if (sig) { sig.textContent = ''; sig.style.color = ''; sig.classList.remove('is-tuned', 'is-standby'); }
        if (nodeEl) { nodeEl.textContent = ''; nodeEl.style.visibility = 'hidden'; }
        clearStandbyDisplayLayout(f, k, buf, p);
        if (f) {
            f.innerHTML = editView.freqHtml || editView.keyHtml || '';
            f.className = 'radio-display-edit-large';
        }
        if (k) k.textContent = '';
        if (buf) {
            if (editView.axis) buf.textContent = editView.axis;
            else if (editView.editType === 'encrypt' || editView.editType === 'text') buf.textContent = editView.hint || '';
            else buf.textContent = '';
        }
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
        screen.classList.toggle('is-text-edit', false);
    }

    if (osView.mode === 'off') {
        hideAppBoards();
        if (state.batteryCharging) {
            applyOffChargingDisplay(f, k, buf, p, state);
            clearDisplayRowFocus();
            if (ch) ch.textContent = '';
            if (clockEl) clockEl.textContent = '';
            if (sig) sig.textContent = '';
            if (nodeEl) {
                nodeEl.textContent = '';
                nodeEl.style.visibility = 'hidden';
            }
            if (footerWrap) footerWrap.textContent = '';
            updateChargeButtonUi();
            updateInputForMode();
            requestAnimationFrame(applyDisplayTypography);
            return;
        }
        if (f) {
            f.className = '';
            f.classList.remove('radio-display-freq-node', 'is-handset', 'is-fallback', 'radio-display-battery-only');
            f.removeAttribute('data-kind');
            f.removeAttribute('title');
        }
        setDisplayTextLines([]);
        clearDisplayRowFocus();
        if (foot) foot.textContent = '';
        if (ch) ch.textContent = '';
        if (clockEl) clockEl.textContent = '';
        if (sig) sig.textContent = '';
        if (nodeEl) {
            nodeEl.textContent = '';
            nodeEl.style.visibility = 'hidden';
        }
        if (footerWrap) footerWrap.textContent = '';
        updateChargeButtonUi();
        updateInputForMode();
        return;
    }

    if (nodeEl) nodeEl.style.visibility = '';

    if (osView.mode === 'standby' || osView.mode === 'standby_tune') {
        menuScrollTracker.key = '';
        menuScrollTracker.index = -1;
        var gpsOk = !!(c.originLat != null && c.originLng != null);
        updateRadioStatusWidgets(state, osView);
        if (ch) ch.textContent = '';
        setStandbySignalIndicator(sig);
        if (standbyUi.active) {
            applyStandbyMainLayout(f, k, buf, p, state, {
                gpsOk: gpsOk,
                focusFreq: standbyUi.focusIndex === 0,
                focusEncrypt: standbyUi.focusIndex === 1,
                dialBuffer: dialBuffer || '',
                pttLine: standbyPttActive ? '● PTT NAHRÁVÁM' : ''
            });
            clearExtraDisplayLines();
            if (nodeEl) {
                nodeEl.textContent = '';
                nodeEl.style.visibility = 'hidden';
            }
            if (footerWrap) footerWrap.textContent = '◀▶ preset · OK edit · Zpět';
            updateChargeButtonUi();
            return;
        }
        applyStandbyMainLayout(f, k, buf, p, state, {
            gpsOk: gpsOk,
            dialBuffer: dialBuffer || '',
            beaconSos: (beaconActive && beaconActive.active) ? ('● SOS ' + BEACON_SOS_FREQUENCY) : ''
        });
        clearExtraDisplayLines();
        if (nodeEl) {
            nodeEl.textContent = gpsOk ? 'NOSIČ' : 'GPS?';
            nodeEl.style.visibility = 'hidden';
            nodeEl.title = '';
        }
        if (footerWrap) {
            if (!footerWrap.querySelector('#radio-display-com')) {
                footerWrap.innerHTML = '0 KEY · <span id="radio-display-com"></span>';
                foot = el('radio-display-com');
            }
            if (foot) foot.textContent = standbyLines.footer;
        }
        updateChargeButtonUi();
    } else {
        var menuLines = osView.lines || ['', '', '', '', '', ''];
        clearStandbyDisplayLayout(f, k, buf, p);
        if (f) {
            f.removeAttribute('data-kind');
            f.style.color = '';
        }
        if (osView.mode !== 'snake' || !osView.useBoard) hideSnakeBoard();
        if (osView.mode !== 'arkanoid' || !osView.useBoard) hideArkanoidBoard();
        if (osView.mode === 'snake') {
            if (osView.useBoard && snakeSession && snakeSession.alive) {
                setDisplayMenuLines(['', '', '', '', '', ''], -1);
                hideArkanoidBoard();
                renderSnakeBoard(snakeSession);
            } else {
                hideAppBoards();
                setDisplayMenuLines(menuLines, -1);
            }
        } else if (osView.mode === 'arkanoid') {
            if (osView.useBoard && arkanoidSession && arkanoidSession.alive) {
                setDisplayMenuLines(['', '', '', '', '', ''], -1);
                hideSnakeBoard();
                renderArkanoidBoard(arkanoidSession);
            } else {
                hideAppBoards();
                setDisplayMenuLines(menuLines, -1);
            }
        } else {
            hideAppBoards();
            setDisplayMenuLines(
                menuLines,
                osView.focusLine == null ? -1 : osView.focusLine,
                osView.lineStyles,
                osView.lineIcons,
                computeMenuScrollDirection(resolveMenuScrollMeta(osView))
            );
        }
        if (ch) {
            if (shortcutBindNotice) {
                ch.textContent = shortcutBindNotice.keyId + ' \u2190 ' + shortcutBindNotice.label;
            } else {
                ch.textContent = '';
            }
        }
        updateRadioStatusWidgets(state, osView);
        if (sig) {
            sig.textContent = '';
            sig.style.color = '';
            sig.classList.remove('is-tuned', 'is-standby');
        }
        if (nodeEl) nodeEl.textContent = '';
        if (footerWrap) footerWrap.textContent = osView.footer || 'OK · Zpět';
    }

    updateInputForMode();
    updateChargeButtonUi();
    requestAnimationFrame(applyDisplayTypography);
}

function stopAutoscanTimer() {
    if (autoscanTimer) {
        clearInterval(autoscanTimer);
        autoscanTimer = null;
    }
}

function ensureAutoscanSession() {
    if (!autoscanSession) autoscanSession = createAutoscanState();
    return autoscanSession;
}

function haltAutoscan(restore) {
    stopAutoscanTimer();
    if (autoscanSession) {
        stopAutoscan(autoscanSession, state, restore);
    }
}

function tickAutoscanStep() {
    if (!autoscanSession || autoscanSession.status !== SCAN_RUNNING) {
        stopAutoscanTimer();
        return;
    }
    advanceAutoscanVisual(autoscanSession);
    renderDisplay();
}

function startAutoscanTimer() {
    stopAutoscanTimer();
    autoscanTimer = setInterval(tickAutoscanStep, AUTOSCAN_VISUAL_MS);
}

function isAutoscanListening() {
    return !!(autoscanSession && autoscanSession.status === SCAN_RUNNING);
}

function isAutoscanMenuOpen() {
    return !!(radioOs && radioOs.menuPath && radioOs.menuPath[radioOs.menuPath.length - 1] === 'autoscan');
}

function stopAutoscanToSummary() {
    if (!autoscanSession || autoscanSession.status !== SCAN_RUNNING) return false;
    lockAutoscan(
        autoscanSession,
        autoscanSession.hitLabel || '',
        autoscanSession.hitFrequency
    );
    stopAutoscanTimer();
    refreshSubscriptions();
    radioIncomingFeedback(SIGNAL_CLEAR);
    renderDisplay();
    return true;
}

function tryAutoscanLock(payload) {
    if (!isAutoscanListening()) return;
    if (!payload) return;

    var msgFreq = normalizeFrequency(payload.frequency);
    if (!msgFreq || !isAutoscanListenFrequency(msgFreq)) return;

    var msgTs = Number(payload.timestamp || payload.ts) || Date.now();
    if (autoscanSession.sessionStartedAt && msgTs < autoscanSession.sessionStartedAt - 3000) {
        return;
    }

    var origin = (payload.originLat != null && payload.originLng != null)
        ? { lat: payload.originLat, lng: payload.originLng }
        : null;
    var reception = evaluateIncomingReception(origin, {
        frequency: normalizeFrequency(payload.frequency),
        encryptionKey: normalizeEncryptionKey(payload.encryptionKey || '')
    });
    if (!reception.receivable || reception.quality === SIGNAL_NONE) {
        reception = {
            quality: origin ? SIGNAL_NOISE : SIGNAL_WEAK,
            distanceKm: reception.distanceKm,
            receivable: true,
            reason: origin ? 'cloud_fallback' : 'no_origin_fallback'
        };
    }

    var msgKey = normalizeEncryptionKey(payload.encryptionKey || '');
    var myKey = normalizeEncryptionKey(state.encryptionKey || '');
    var foreignEncrypt = !!(msgKey && msgKey !== myKey);
    var hitLabel = foreignEncrypt ? 'ŠIFROVANÝ PROVOZ' : (msgFreq + ' MHz');
    var applied = foreignEncrypt ? null : applyReceptionToMessage(payload.text, reception, {
        seed: payload.id || payload.text,
        frequency: msgFreq
    });
    var captureText = foreignEncrypt
        ? '[ŠIFROVANÝ PROVOZ]'
        : String((applied && applied.text) || payload.text || '').slice(0, 96);
    if (!captureText && payload.messageType === 'ptt') captureText = '[PTT]';
    if (!captureText) captureText = '[ZACHYCENO]';

    /* Jen počítat a ukládat — bez auto-zamčení na první zásah. */
    autoscanSession.hitFrequency = msgFreq;
    autoscanSession.hitEncrypted = foreignEncrypt;
    autoscanSession.hitLabel = hitLabel;
    autoscanSession.index = bandIndexForFrequency(msgFreq);

    var saved = appendAutoscanCapture(notebook, {
        id: 'scan_' + (payload.id || msgFreq + '_' + Date.now()),
        entryId: payload.id || null,
        ts: msgTs,
        frequency: msgFreq,
        encryptionKey: payload.encryptionKey || '',
        text: captureText,
        encrypted: foreignEncrypt,
        presetLabel: payload.presetLabel || '',
        presetSlot: payload.presetSlot || null
    });
    if (saved) {
        autoscanSession.captureCount = (autoscanSession.captureCount || 0) + 1;
        autoscanSession.activitySeen = true;
    }
    persist();
    renderDisplay();
    radioIncomingFeedback((applied && applied.signalQuality) || reception.quality || SIGNAL_CLEAR);
}

function openRadioAutoscanScreen(autoStart) {
    resetRadioOs(radioOs);
    radioOs.screen = 'menu';
    radioOs.menuPath = ['autoscan'];
    ensureAutoscanSession();
    if (autoStart) {
        handleAutoscanOk();
    } else {
        renderDisplay();
    }
}

function handleAutoscanOk() {
    if (state.operatingMode === 'off') {
        alert('Vysílačka je vypnutá (OFF). Přepni režim na ON.');
        renderDisplay();
        return true;
    }
    var session = ensureAutoscanSession();
    if (session.status === SCAN_IDLE) {
        if (!startAutoscan(session, state)) {
            renderDisplay();
            return true;
        }
        persist();
        startAutoscanTimer();
        renderDisplay();
        refreshSubscriptions().then(function() {
            renderDisplay();
        }).catch(function(err) {
            console.warn('[radioUi] autoscan subscribe', err);
            renderDisplay();
        });
        return true;
    }
    if (session.status === SCAN_RUNNING) {
        stopAutoscanToSummary();
        return true;
    }
    if (session.status === SCAN_LOCKED) {
        haltAutoscan(false);
        resetRadioOs(radioOs);
        persist();
        refreshSubscriptions();
        renderDisplay();
        return true;
    }
    return false;
}

function handleAutoscanClose() {
    if (autoscanSession && autoscanSession.status === SCAN_RUNNING) {
        stopAutoscanToSummary();
        return;
    }
    haltAutoscan(false);
    autoscanSession = createAutoscanState();
    persist();
    refreshSubscriptions();
    renderDisplay();
}

function refreshBeaconActiveFromStorage() {
    if (beaconActive && beaconActive.active) return beaconActive;
    var c = getCtx();
    beaconActive = loadLocalBeacon(c.comCode || '');
    return beaconActive;
}

function ensureBeaconSession() {
    if (!beaconSession) beaconSession = createBeaconSession();
    refreshBeaconActiveFromStorage();
    return beaconSession;
}

function getBeaconLatLng() {
    return getPlayerLatLng();
}

function notifyBeaconMap(panToLocal) {
    if (beaconActive && beaconActive.active &&
        isFinite(Number(beaconActive.lat)) && isFinite(Number(beaconActive.lng))) {
        window._patracLocalBeacon = {
            id: 'local_' + (beaconActive.senderId || 'me'),
            lat: Number(beaconActive.lat),
            lng: Number(beaconActive.lng),
            frequency: beaconActive.frequency || '',
            label: beaconActive.label || 'Můj beacon',
            active: true,
            isLocal: true
        };
    } else {
        window._patracLocalBeacon = null;
    }
    syncMapBeaconHud();
    if (typeof window.patracRefreshBeaconMap === 'function') {
        try { window.patracRefreshBeaconMap(!!panToLocal); } catch (e) {}
        if (window._patracBeaconMapPending) {
            window._patracBeaconMapPending.refresh = false;
            window._patracBeaconMapPending.pan = false;
        }
        return;
    }
    window._patracBeaconMapPending = window._patracBeaconMapPending || { refresh: false, pan: false };
    window._patracBeaconMapPending.refresh = true;
    if (panToLocal) window._patracBeaconMapPending.pan = true;
}

function syncMapBeaconHud() {
    var mapEl = el('map');
    if (!mapEl) return;
    var hud = el('map-beacon-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'map-beacon-hud';
        mapEl.appendChild(hud);
    }
    if (beaconActive && beaconActive.active) {
        hud.className = 'map-beacon-hud is-on';
        hud.textContent = '📡 SOS ' + BEACON_SOS_FREQUENCY;
        hud.style.display = 'block';
    } else {
        hud.className = 'map-beacon-hud';
        hud.textContent = '';
        hud.style.display = 'none';
    }
}

export function flushPendingBeaconMapRefresh() {
    var pending = window._patracBeaconMapPending;
    if (!pending || !pending.refresh) return;
    if (typeof window.patracRefreshBeaconMap !== 'function') return;
    try { window.patracRefreshBeaconMap(!!pending.pan); } catch (e) {}
    pending.refresh = false;
    pending.pan = false;
}

function stopBeaconRepeatTimer() {
    if (beaconRepeatTimer) {
        clearInterval(beaconRepeatTimer);
        beaconRepeatTimer = null;
    }
}

async function transmitBeaconPulse(skipTxFx) {
    if (!beaconActive || !beaconActive.active) return { liveOk: true, smsOk: true, errors: [] };
    var c = getCtx();
    var pos = getBeaconLatLng();
    if (pos && isFinite(pos.lat) && isFinite(pos.lng)) {
        beaconActive.lat = pos.lat;
        beaconActive.lng = pos.lng;
    }
    beaconActive.comCode = c.comCode || '';
    beaconActive.frequency = BEACON_SOS_FREQUENCY;
    notifyBeaconMap(false);
    var errors = [];
    var liveOk = true;
    try {
        await upsertRadioBeaconLive(beaconActive);
    } catch (err) {
        liveOk = false;
        console.warn('[beacon] live pulse', err);
        errors.push('LIVE: ' + ((err && err.message) ? err.message : 'permissions'));
    }
    var pulseText = String(beaconActive.text || '').trim() || 'BEACON';
    var basePayload = buildBeaconPayload(Object.assign({}, beaconActive, { text: pulseText }), {
        skipTxFx: !!skipTxFx,
        isBeaconRepeat: !!skipTxFx
    });
    /* Vždy SOS kanál; u SMS přidej i naladěný/komunitu jako zálohu. */
    var freqs = beaconActive.messageType === 'ptt'
        ? [BEACON_SOS_FREQUENCY]
        : beaconBroadcastFrequencies({
            comCode: c.comCode || '',
            tunedFrequency: state.frequency || ''
        });
    var smsOk = true;
    var i;
    for (i = 0; i < freqs.length; i++) {
        try {
            await transmitMessage(pulseText, Object.assign({}, basePayload, {
                frequency: freqs[i],
                encryptionKey: '',
                messageType: 'beacon',
                originLat: beaconActive.lat,
                originLng: beaconActive.lng,
                skipNotebook: i > 0 || !!skipTxFx,
                skipTxFx: true,
                isBeaconRepeat: !!skipTxFx,
                reportSendError: !skipTxFx && i === 0,
                pttAudio: i === 0 ? (beaconActive.pttAudio || '') : '',
                pttMime: i === 0 ? (beaconActive.pttMime || '') : ''
            }));
        } catch (err) {
            smsOk = false;
            console.warn('[beacon] pulse freq', freqs[i], err);
            if (!skipTxFx && i === 0) {
                errors.push('SMS ' + freqs[i] + ': ' + ((err && err.message) ? err.message : 'fail'));
            }
        }
    }
    saveLocalBeacon(c.comCode || '', beaconActive);
    notifyBeaconMap(false);
    return { liveOk: liveOk, smsOk: smsOk, errors: errors };
}

function startBeaconRepeatTimer() {
    stopBeaconRepeatTimer();
    beaconRepeatTimer = setInterval(function() {
        transmitBeaconPulse(true).catch(function(err) {
            console.warn('[beacon] repeat', err);
        });
    }, BEACON_REPEAT_MS);
}

async function startBeacon(opts) {
    opts = opts || {};
    if (ctx.isLocalOnly && ctx.isLocalOnly()) {
        alert('Beacon nejde v offline režimu operátora. Přihlas se jako hráč.');
        return;
    }
    var c = getCtx();
    if (!c.userId) {
        alert('Beacon potřebuje přihlášení. Obnov stránku a přihlas se.');
        return;
    }
    var pos = getBeaconLatLng();
    if (!pos || !isFinite(pos.lat) || !isFinite(pos.lng)) {
        alert('Beacon potřebuje GPS (NOSIČ). Zapni polohu v prohlížeči a počkej na fix.');
        return;
    }
    beaconActive = {
        active: true,
        lat: pos.lat,
        lng: pos.lng,
        frequency: BEACON_SOS_FREQUENCY,
        encryptionKey: '',
        messageType: opts.messageType || 'sms',
        text: String(opts.text || '').trim() || 'BEACON',
        pttAudio: opts.pttAudio || '',
        pttMime: opts.pttMime || '',
        label: c.playerName || 'Beacon',
        senderId: c.userId || '',
        comCode: c.comCode || '',
        bandIndex: 0,
        startedAt: Date.now()
    };
    saveLocalBeacon(c.comCode || '', beaconActive);
    /* Mapa odesílatele hned — nezávisle na cloud permissions. */
    notifyBeaconMap(true);
    setTimeout(function() { notifyBeaconMap(true); }, 200);
    setTimeout(function() { notifyBeaconMap(true); }, 800);
    renderDisplay();

    try {
        await upsertRadioBeaconLive(beaconActive);
    } catch (err) {
        console.warn('[beacon] live start', err);
        window._patracBeaconLiveErr = (err && err.message) ? err.message : 'permissions';
    }
    startBeaconRepeatTimer();
    refreshSubscriptions();
    var pulseResult = null;
    try {
        pulseResult = await transmitBeaconPulse(false);
    } catch (err) {
        console.warn('[beacon] pulse start', err);
        pulseResult = { liveOk: false, smsOk: false, errors: [String(err && err.message || err)] };
    }
    var liveFail = !!(window._patracBeaconLiveErr) || (pulseResult && pulseResult.liveOk === false);
    var smsFail = pulseResult && pulseResult.smsOk === false;
    if (liveFail || smsFail) {
        var parts = [];
        if (window._patracBeaconLiveErr) parts.push('LIVE: ' + window._patracBeaconLiveErr);
        if (pulseResult && pulseResult.errors && pulseResult.errors.length) {
            parts = parts.concat(pulseResult.errors);
        } else if (smsFail) {
            parts.push('SMS puls selhal (permissions / Auth).');
        }
        alert('Beacon běží lokálně, cloud neprošel:\n' + parts.join('\n') +
            '\n\nNutné: Firebase Console → Firestore → Rules → Publish (rules z repa).');
    }
    window._patracBeaconLiveErr = '';
    notifyBeaconMap(true);
    renderDisplay();
}

function stopBeacon() {
    stopBeaconRepeatTimer();
    var c = getCtx();
    var senderId = (beaconActive && beaconActive.senderId) || (c && c.userId) || '';
    if (senderId) {
        clearRadioBeaconLive(senderId).catch(function(err) {
            console.warn('[beacon] live stop', err);
        });
    }
    clearLocalBeacon(c.comCode || '');
    beaconActive = null;
    refreshSubscriptions();
    if (beaconSession) {
        beaconSession.screen = BEACON_HUB;
        beaconSession.focusIndex = 0;
        beaconSession.pendingText = '';
    }
    notifyBeaconMap();
    renderDisplay();
}

function handleBeaconOpen() {
    ensureBeaconSession();
    refreshBeaconActiveFromStorage();
    notifyBeaconMap(false);
    renderDisplay();
}

function handleBeaconClose() {
    if (beaconSession && beaconSession.screen === BEACON_PTT_ARM) {
        cancelBeaconPttRecord();
    }
    beaconSession = createBeaconSession();
    renderDisplay();
}

function openBeaconCompose() {
    ensureBeaconSession();
    beaconSession.pendingType = 'sms';
    startFieldEdit('text', {
        text: '',
        returnTo: 'beacon',
        maxLen: 64
    });
    if (fieldEditSession) {
        fieldEditSession.digitMode = true;
        fieldEditSession.okExitPending = false;
        fieldEditSession.cursor = 0;
    }
}

function finishBeaconCompose() {
    if (!fieldEditSession || fieldEditSession.returnTo !== 'beacon') return;
    finalizeT9Session(fieldEditSession);
    var vals = readFieldEditValues(fieldEditSession);
    var text = vals && vals.text ? String(vals.text).trim() : '';
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    var session = ensureBeaconSession();
    session.pendingText = text;
    if (!text) {
        renderDisplay();
        return;
    }
    session.screen = BEACON_CONFIRM;
    session.focusIndex = 0;
    renderDisplay();
}

function startBeaconPttRecord() {
    if (!isPttSupported()) {
        alert('Mikrofon není dostupný.');
        return;
    }
    if (beaconPttPending || pttSession.active) return;
    radioKeypadPttDown();
    startPttRecording(pttSession).then(function(ok) {
        if (!ok) {
            radioKeypadPttUp();
            return;
        }
        beaconPttPending = true;
        renderDisplay();
        clearPttMaxTimer();
        pttMaxTimer = setTimeout(finishBeaconPttRecord, PTT_MAX_MS);
    });
}

function cancelBeaconPttRecord() {
    if (!beaconPttPending && !pttSession.active) return;
    beaconPttPending = false;
    clearPttMaxTimer();
    cancelPttRecording(pttSession);
    pttSession = createPttSession();
    radioKeypadPttUp();
    var session = ensureBeaconSession();
    if (session.screen === BEACON_PTT_ARM) session.screen = BEACON_HUB;
    renderDisplay();
}

async function finishBeaconPttRecord() {
    if (!pttSession.active && !beaconPttPending) return;
    beaconPttPending = false;
    clearPttMaxTimer();
    radioKeypadPttUp();
    var result = await stopPttRecording(pttSession);
    pttSession = createPttSession();
    if (!result || !result.base64) {
        renderDisplay();
        return;
    }
    var session = ensureBeaconSession();
    session.pendingType = 'ptt';
    session.pendingText = formatPttNotebookText(result.durationMs);
    session.pendingPttAudio = result.base64;
    session.pendingPttMime = result.mime;
    session.screen = BEACON_CONFIRM;
    session.focusIndex = 0;
    renderDisplay();
}

function handleBeaconUp() {
    var session = ensureBeaconSession();
    if (session.screen === BEACON_CONFIRM) return;
    var items = clampBeaconFocus(session, beaconActive);
    if (!items.length) return;
    session.focusIndex = wrapMenuFocus(session.focusIndex, items.length, -1);
    renderDisplay();
}

function handleBeaconDown() {
    var session = ensureBeaconSession();
    if (session.screen === BEACON_CONFIRM) return;
    var items = clampBeaconFocus(session, beaconActive);
    if (!items.length) return;
    session.focusIndex = wrapMenuFocus(session.focusIndex, items.length, 1);
    renderDisplay();
}

function handleBeaconOk() {
    var session = ensureBeaconSession();
    refreshBeaconActiveFromStorage();

    if (session.screen === BEACON_CONFIRM) {
        var pendingOpts = session.pendingType === 'ptt'
            ? {
                messageType: 'ptt',
                text: session.pendingText,
                pttAudio: session.pendingPttAudio,
                pttMime: session.pendingPttMime
            }
            : {
                messageType: 'sms',
                text: session.pendingText
            };
        startBeacon(pendingOpts).then(function() {
            if (beaconActive && beaconActive.active) {
                session.screen = BEACON_HUB;
                session.focusIndex = 0;
                session.pendingText = '';
                session.pendingPttAudio = '';
                renderDisplay();
            }
        });
        return;
    }

    var action = getFocusedBeaconAction(session, beaconActive);
    if (!action || action.type !== 'action') return;
    if (action.id === 'beacon_sms') {
        openBeaconCompose();
    } else if (action.id === 'beacon_ptt') {
        session.pendingType = 'ptt';
        session.screen = BEACON_PTT_ARM;
        renderDisplay();
    } else if (action.id === 'beacon_stop') {
        stopBeacon();
    }
}

function isBeaconMenuOpen() {
    return !!(radioOs && radioOs.menuPath && radioOs.menuPath[radioOs.menuPath.length - 1] === 'beacon');
}

function ensureCommsSession() {
    if (!commsSession) commsSession = createCommsState();
    return commsSession;
}

function isCommsMenuOpen() {
    return !!(radioOs && radioOs.menuPath && radioOs.menuPath[radioOs.menuPath.length - 1] === 'comms');
}

function clearPttMaxTimer() {
    if (pttMaxTimer) {
        clearTimeout(pttMaxTimer);
        pttMaxTimer = null;
    }
}

function openCommsCompose(draftText) {
    var session = ensureCommsSession();
    session.screen = COMMS_COMPOSE;
    session.pendingTarget = session.pendingTarget || formatChannelTarget(state);
    startFieldEdit('text', {
        text: draftText || '',
        returnTo: 'comms',
        maxLen: 64
    });
    if (fieldEditSession) {
        fieldEditSession.digitMode = true;
        fieldEditSession.okExitPending = false;
        fieldEditSession.cursor = 0;
    }
}

function finishCommsCompose() {
    if (!fieldEditSession || fieldEditSession.returnTo !== 'comms') return;
    finalizeT9Session(fieldEditSession);
    var vals = readFieldEditValues(fieldEditSession);
    var text = vals && vals.text ? String(vals.text).trim() : '';
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    var session = ensureCommsSession();
    session.pendingText = text;
    if (!text) {
        renderDisplay();
        return;
    }
    session.screen = COMMS_CONFIRM;
    session.focusIndex = 0;
    renderDisplay();
}

function saveCommsDraft() {
    ensureNotebookDrafts();
    var session = ensureCommsSession();
    if (!session.pendingText) return;
    notebook.drafts.push({
        id: 'draft_' + Date.now(),
        text: session.pendingText,
        target: session.pendingTarget || formatChannelTarget(state),
        ts: Date.now()
    });
    session.pendingText = '';
    session.screen = COMMS_HUB;
    session.focusIndex = 0;
    persist();
    renderDisplay();
}

function openCommsAction(actionId) {
    var session = ensureCommsSession();
    if (actionId === 'new_sms') {
        session.pendingTarget = formatChannelTarget(state);
        openCommsCompose('');
        return;
    }
    if (actionId === 'inbox') {
        session.screen = COMMS_INBOX;
        session.focusIndex = 0;
    } else if (actionId === 'outbox') {
        session.screen = COMMS_OUTBOX;
        session.focusIndex = 0;
    } else if (actionId === 'drafts') {
        session.screen = COMMS_DRAFTS;
        session.focusIndex = 0;
    } else if (actionId === 'templates') {
        session.screen = COMMS_TEMPLATES;
        session.focusIndex = 0;
    }
    renderDisplay();
}

var snakeBoardReady = false;

function snakeEatPulse() {
    if (navigator.vibrate) {
        try { navigator.vibrate([16, 36, 22]); } catch (e) {}
    }
}

function buildSnakeBoardDom(board) {
    board.textContent = '';
    snakeBoardReady = false;
    var score = document.createElement('div');
    score.className = 'radio-app-score radio-snake-score';
    score.id = 'radio-snake-score';
    var frame = document.createElement('div');
    frame.className = 'radio-app-frame radio-snake-frame';
    var inner = document.createElement('div');
    inner.className = 'radio-app-board-inner radio-snake-board-inner';
    frame.appendChild(inner);
    board.appendChild(score);
    board.appendChild(frame);
}

function buildArkanoidBoardDom(board) {
    board.textContent = '';
    arkanoidBoardReady = false;
    var score = document.createElement('div');
    score.className = 'radio-app-score radio-arkanoid-score';
    score.id = 'radio-arkanoid-score';
    var frame = document.createElement('div');
    frame.className = 'radio-app-frame radio-arkanoid-frame';
    var inner = document.createElement('div');
    inner.className = 'radio-app-board-inner radio-arkanoid-board-inner';
    frame.appendChild(inner);
    board.appendChild(score);
    board.appendChild(frame);
}

function ensureSnakeBoard() {
    var main = el('radio-display-main');
    if (!main) return null;
    var board = el('radio-snake-board');
    if (!board) {
        board = document.createElement('div');
        board.id = 'radio-snake-board';
        board.className = 'radio-snake-board radio-app-board';
        board.hidden = true;
        board.setAttribute('aria-hidden', 'true');
        buildSnakeBoardDom(board);
        main.appendChild(board);
        snakeBoardReady = false;
    } else if (!board.querySelector('.radio-app-score')) {
        buildSnakeBoardDom(board);
        snakeBoardReady = false;
    }
    var innerEl = board.querySelector('.radio-app-board-inner');
    syncSnakeBoardGrid(innerEl);
    if (innerEl && (!snakeBoardReady || innerEl.children.length !== SNAKE_CELL_COUNT)) {
        rebuildAppBoardCells(innerEl, SNAKE_CELL_COUNT, 'radio-app-cell radio-snake-cell');
        snakeBoardReady = true;
    }
    return board;
}

function syncSnakeBoardGrid(innerEl) {
    if (!innerEl) return;
    innerEl.style.gridTemplateColumns = 'repeat(' + SNAKE_W + ', 1fr)';
    innerEl.style.gridTemplateRows = 'repeat(' + SNAKE_H + ', 1fr)';
}

function syncArkanoidBoardGrid(innerEl) {
    if (!innerEl) return;
    innerEl.style.gridTemplateColumns = 'repeat(' + ARK_W + ', 1fr)';
    innerEl.style.gridTemplateRows = 'repeat(' + ARK_H + ', 1fr)';
    innerEl.style.aspectRatio = ARK_W + ' / ' + ARK_H;
}

function rebuildAppBoardCells(innerEl, count, cellClass) {
    if (!innerEl) return;
    innerEl.textContent = '';
    var i;
    for (i = 0; i < count; i++) {
        var cell = document.createElement('div');
        cell.className = cellClass;
        innerEl.appendChild(cell);
    }
}

function hideSnakeBoard() {
    var board = el('radio-snake-board');
    if (board) {
        board.hidden = true;
        board.setAttribute('aria-hidden', 'true');
        board.classList.remove('is-visible');
        board.style.display = 'none';
    }
}

function hideArkanoidBoard() {
    var board = el('radio-arkanoid-board');
    if (board) {
        board.hidden = true;
        board.setAttribute('aria-hidden', 'true');
        board.classList.remove('is-visible');
        board.style.display = 'none';
    }
}

function showSnakeBoard(board) {
    if (!board) return;
    board.hidden = false;
    board.removeAttribute('aria-hidden');
    board.classList.add('is-visible');
    board.style.display = '';
}

function showArkanoidBoard(board) {
    if (!board) return;
    board.hidden = false;
    board.removeAttribute('aria-hidden');
    board.classList.add('is-visible');
    board.style.display = '';
}

var arkanoidBoardReady = false;

function ensureArkanoidBoard() {
    var main = el('radio-display-main');
    if (!main) return null;
    var board = el('radio-arkanoid-board');
    if (!board) {
        board = document.createElement('div');
        board.id = 'radio-arkanoid-board';
        board.className = 'radio-arkanoid-board radio-app-board';
        board.hidden = true;
        board.setAttribute('aria-hidden', 'true');
        buildArkanoidBoardDom(board);
        main.appendChild(board);
        arkanoidBoardReady = false;
    } else if (!board.querySelector('.radio-app-score')) {
        buildArkanoidBoardDom(board);
        arkanoidBoardReady = false;
    }
    var innerEl = board.querySelector('.radio-app-board-inner');
    syncArkanoidBoardGrid(innerEl);
    if (innerEl && (!arkanoidBoardReady || innerEl.children.length !== ARK_CELL_COUNT)) {
        rebuildAppBoardCells(innerEl, ARK_CELL_COUNT, 'radio-app-cell radio-arkanoid-cell');
        arkanoidBoardReady = true;
    }
    return board;
}

function hideAppBoards() {
    hideSnakeBoard();
    hideArkanoidBoard();
}

function snakeHeadDirClass(dir) {
    if (!dir) return '';
    if (dir.x === 1) return ' is-dir-right';
    if (dir.x === -1) return ' is-dir-left';
    if (dir.y === -1) return ' is-dir-up';
    if (dir.y === 1) return ' is-dir-down';
    return '';
}

function sizeSnakeBoardInner(board) {
    var inner = board && board.querySelector('.radio-app-board-inner');
    if (!inner) return;
    inner.style.width = '';
    inner.style.height = '';
}

function renderSnakeBoard(session) {
    var board = ensureSnakeBoard();
    if (!board) return;
    var scoreEl = el('radio-snake-score');
    if (scoreEl) {
        scoreEl.textContent = 'SKÓRE ' + String(session.score || 0).padStart(3, '0');
    }
    showSnakeBoard(board);
    sizeSnakeBoardInner(board);
    var innerEl = board.querySelector('.radio-app-board-inner');
    if (!innerEl) return;
    var cells = innerEl.children;
    var grid = buildSnakeCellGrid(session);
    var dirClass = snakeHeadDirClass(session.dir || session.nextDir);
    var i;
    for (i = 0; i < grid.length && i < cells.length; i++) {
        var kind = grid[i] || '';
        var cls = 'radio-app-cell radio-snake-cell';
        if (kind) cls += ' is-' + kind;
        if (kind === 'head') cls += dirClass;
        if (cells[i].className !== cls) cells[i].className = cls;
    }
}

function ensureSnakeSession() {
    if (!snakeSession) snakeSession = createSnakeState();
    return snakeSession;
}

function stopSnakeTimer() {
    if (snakeTimer) {
        clearInterval(snakeTimer);
        snakeTimer = null;
    }
}

function startSnakeTimer() {
    stopSnakeTimer();
    snakeTimer = setInterval(function() {
        if (!snakeSession || !isSnakeMenuOpen()) {
            stopSnakeTimer();
            return;
        }
        if (snakeSession.alive) {
            var tickResult = snakeTick(snakeSession);
            if (tickResult === 'ate') snakeEatPulse();
        }
        renderDisplay();
    }, SNAKE_TICK_MS);
}

function isSnakeMenuOpen() {
    return !!(radioOs && radioOs.menuPath && radioOs.menuPath[radioOs.menuPath.length - 1] === 'snake');
}

function openSnakeScreen() {
    snakeSession = createSnakeState();
    startSnakeTimer();
    renderDisplay();
}

function closeSnakeScreen() {
    stopSnakeTimer();
    snakeSession = null;
    hideSnakeBoard();
    if (state) renderDisplay();
}

function handleSnakeOk() {
    if (!snakeSession) return;
    if (!snakeSession.alive) resetSnakeState(snakeSession);
    renderDisplay();
}

function renderArkanoidBoard(session) {
    var board = ensureArkanoidBoard();
    if (!board) return;
    var scoreEl = el('radio-arkanoid-score');
    if (scoreEl) {
        scoreEl.textContent = 'SKÓRE ' + String(session.score || 0).padStart(4, '0') +
            ' · LV' + String(session.level || 1) +
            ' · ○' + String(session.balls ? session.balls.length : 0);
    }
    showArkanoidBoard(board);
    var innerEl = board.querySelector('.radio-app-board-inner');
    if (!innerEl) return;
    var cells = innerEl.children;
    var grid = buildArkanoidCellGrid(session);
    var i;
    for (i = 0; i < grid.length && i < cells.length; i++) {
        var kind = grid[i] || '';
        var cls = 'radio-app-cell radio-arkanoid-cell';
        if (kind) cls += ' is-' + kind;
        if (cells[i].className !== cls) cells[i].className = cls;
    }
}

function ensureArkanoidSession() {
    if (!arkanoidSession) arkanoidSession = createArkanoidState();
    return arkanoidSession;
}

function stopArkanoidTimer() {
    if (arkanoidTimer) {
        clearInterval(arkanoidTimer);
        arkanoidTimer = null;
    }
}

function startArkanoidTimer() {
    stopArkanoidTimer();
    arkanoidTimer = setInterval(function() {
        if (!arkanoidSession || !isArkanoidMenuOpen()) {
            stopArkanoidTimer();
            return;
        }
        if (arkanoidSession.alive && !arkanoidSession.waiting) {
            arkanoidTick(arkanoidSession);
        }
        renderDisplay();
    }, ARK_TICK_MS);
}

function isArkanoidMenuOpen() {
    return !!(radioOs && radioOs.menuPath && radioOs.menuPath[radioOs.menuPath.length - 1] === 'arkanoid');
}

function openArkanoidScreen() {
    arkanoidSession = createArkanoidState();
    startArkanoidTimer();
    renderDisplay();
}

function closeArkanoidScreen() {
    stopArkanoidTimer();
    arkanoidSession = null;
    hideArkanoidBoard();
    if (state) renderDisplay();
}

function handleArkanoidOk() {
    if (!arkanoidSession) return;
    if (!arkanoidSession.alive) {
        resetArkanoidState(arkanoidSession);
        startArkanoidTimer();
    } else {
        arkanoidOk(arkanoidSession);
    }
    renderDisplay();
}

function ensureDecoderSession() {
    if (!decoderSession) decoderSession = createDecoderState();
    return decoderSession;
}

function openDecoderScreen() {
    decoderSession = createDecoderState();
    renderDisplay();
}

function closeDecoderScreen() {
    decoderSession = null;
    renderDisplay();
}

function handleDecoderOk() {
    if (!decoderSession) return;
    renderDisplay();
}

function closeAppScreens() {
    closeSnakeScreen();
    closeArkanoidScreen();
    closeDecoderScreen();
}

async function finishStandbyPtt() {
    standbyPttActive = false;
    clearPttMaxTimer();
    radioKeypadPttUp();
    var result = await stopPttRecording(pttSession);
    pttSession = createPttSession();
    renderDisplay();
    if (result && result.base64) await transmitPtt(result);
}

function startStandbyPtt() {
    if (state.operatingMode === 'off' || !isStandbyScreen() || pttSession.active) return;
    if (!isPttSupported()) {
        alert('Mikrofon není dostupný.');
        return;
    }
    radioKeypadPttDown();
    startPttRecording(pttSession).then(function(ok) {
        if (!ok) {
            radioKeypadPttUp();
            return;
        }
        standbyPttActive = true;
        renderDisplay();
        clearPttMaxTimer();
        pttMaxTimer = setTimeout(finishStandbyPtt, PTT_MAX_MS);
    });
}

function cancelStandbyPtt() {
    if (!pttSession.active) return;
    standbyPttActive = false;
    clearPttMaxTimer();
    cancelPttRecording(pttSession);
    pttSession = createPttSession();
    radioKeypadPttUp();
    renderDisplay();
}

function handleCommsUp() {
    var session = ensureCommsSession();
    if (session.screen === COMMS_COMPOSE) return;
    var items = clampCommsFocus(session, notebook);
    if (!items.length) return;
    session.focusIndex = clampMenuFocus(session.focusIndex - 1, items.length);
    renderDisplay();
}

function handleCommsDown() {
    var session = ensureCommsSession();
    if (session.screen === COMMS_COMPOSE) return;
    var items = clampCommsFocus(session, notebook);
    if (!items.length) return;
    session.focusIndex = clampMenuFocus(session.focusIndex + 1, items.length);
    renderDisplay();
}

function handleCommsOk() {
    var session = ensureCommsSession();
    var action = getFocusedCommsAction(session, notebook);

    if (session.screen === COMMS_HUB) {
        if (!action || action.type !== 'action') return;
        openCommsAction(action.id);
        return;
    }

    if (session.screen === COMMS_CONFIRM) {
        if (!action || action.type !== 'action') return;
        if (action.id === 'send_yes') {
            transmitMessage(session.pendingText, {
                frequency: session.pendingTarget && session.pendingTarget.frequency,
                encryptionKey: session.pendingTarget && session.pendingTarget.encryptionKey
            });
            session.pendingText = '';
            session.screen = COMMS_HUB;
            session.focusIndex = 0;
            renderDisplay();
            renderNotebook();
        } else if (action.id === 'send_later') {
            saveCommsDraft();
        } else if (action.id === 'send_no') {
            session.pendingText = '';
            session.screen = COMMS_COMPOSE;
            openCommsCompose('');
        }
        return;
    }

    if (session.screen === COMMS_DRAFTS && action && action.type === 'draft') {
        session.pendingTarget = action.draft.target || formatChannelTarget(state);
        session.pendingText = action.draft.text || '';
        openCommsCompose(action.draft.text || '');
        return;
    }

    if (session.screen === COMMS_INBOX || session.screen === COMMS_OUTBOX) {
        if (action && (action.type === 'msg' || action.type === 'draft') && (action.entry || action.draft)) {
            var entry = action.entry || action.draft;
            if (session.screen === COMMS_INBOX && action.entry) {
                if (markCommsEntryRead(action.entry)) {
                    persist();
                    refreshRadioUnreadBadge();
                }
            }
            session.detailEntry = entry;
            session.detailReturn = session.screen;
            session.screen = COMMS_DETAIL;
            session.focusIndex = 0;
            session.detailPlaying = false;
            renderDisplay();
        }
        return;
    }

    if (session.screen === COMMS_DETAIL) {
        if (!action || action.type !== 'action' || !session.detailEntry) return;
        if (action.id === 'ptt_play') {
            var entry = session.detailEntry;
            if (entry.pttAudio) {
                session.detailPlaying = !session.detailPlaying;
                if (session.detailPlaying) playPttAudio(entry.pttAudio, entry.pttMime);
            }
        } else if (action.id === 'save_perm') {
            session.detailEntry.savedPermanent = true;
            persist();
            renderDisplay();
        } else if (action.id === 'delete') {
            if (session.detailReturn === COMMS_AUTOSCAN && session.detailEntry && notebook.autoscan) {
                var scanId = session.detailEntry.id;
                notebook.autoscan = notebook.autoscan.filter(function(c) { return c && c.id !== scanId; });
                persist();
            }
            session.detailEntry = null;
            session.screen = session.detailReturn || COMMS_INBOX;
            renderDisplay();
        }
    }

    if (session.screen === COMMS_COMPOSE && !isFieldEditActive(fieldEditSession)) {
        openCommsCompose('');
    }
}

function handleCommsBack() {
    if (fieldEditSession && fieldEditSession.returnTo === 'comms') {
        handleFieldEditBackAction();
        return;
    }
    var session = ensureCommsSession();
    var next = commsBackScreen(session);
    if (next === 'exit') {
        radioOs.menuPath.pop();
        commsSession = createCommsState();
    } else {
        session.screen = next;
        session.focusIndex = 0;
    }
    renderDisplay();
}

function handleCommsClose() {
    cancelStandbyPtt();
    commsSession = createCommsState();
    renderDisplay();
}

function cancelFieldEditSession() {
    if (!fieldEditSession) return;
    cancelFieldEdit(fieldEditSession);
    fieldEditSession = null;
    renderDisplay();
}

function returnRadioToStandby() {
    cancelFieldEditSession();
    if (autoscanSession && autoscanSession.status === SCAN_RUNNING) {
        stopAutoscanToSummary();
    }
    if (presetEditDraft) {
        var c = getCtx();
        savePresetDraft(presetEditDraft, state, {
            scope: classifyChannel(presetEditDraft.frequency, presetEditDraft.encryptionKey, c)
        });
        persist();
    }
    presetEditDraft = null;
    resetRadioOs(radioOs);
    standbyUi.active = false;
    clearMenuDial(menuDial);
    beaconSession = createBeaconSession();
    commsSession = createCommsState();
    renderDisplay();
}

function handleFieldEditBackAction() {
    if (!isFieldEditActive(fieldEditSession)) return false;
    var backResult = handleFieldEditBack(fieldEditSession);
    if (backResult === 'exit') {
        finishFieldEdit(true);
        return true;
    }
    if (backResult) renderDisplay();
    return !!backResult;
}

function handleRadioOsInput(action) {
    if (state.operatingMode === 'off') return false;

    if (isFieldEditActive(fieldEditSession)) {
        if (action === 'ok') {
            if (fieldEditSession.returnTo === 'comms') {
                finishCommsCompose();
                return true;
            }
            if (fieldEditSession.returnTo === 'beacon') {
                finishBeaconCompose();
                return true;
            }
            var okResult = handleFieldEditOk(fieldEditSession);
            if (okResult === 'done') finishFieldEdit(true);
            else renderDisplay();
            return true;
        }
        if (action === 'back') {
            if (fieldEditSession.returnTo === 'comms') {
                return handleFieldEditBackAction();
            }
            if (fieldEditSession.returnTo === 'beacon') {
                return handleFieldEditBackAction();
            }
            if (fieldEditSession.returnTo === 'standby_manual') {
                return handleFieldEditBackAction();
            }
            return handleFieldEditBackAction();
        }
        return false;
    }

    if (action === 'open_menu') clearMenuDial(menuDial);

    if (isBeaconMenuOpen() && beaconSession && action === 'back') {
        if (beaconSession.screen === BEACON_PTT_ARM) {
            cancelBeaconPttRecord();
        } else if (beaconSession.screen === BEACON_CONFIRM) {
            beaconSession.pendingText = '';
            beaconSession.pendingPttAudio = '';
            beaconSession.pendingPttMime = '';
        }
    }

    if (action === 'ok' && menuDial && menuDial.buffer) {
        executeMenuDialCommit();
        return true;
    }
    if (action === 'back' && clearMenuDialIfActive() &&
        !(radioOs.menuPath && radioOs.menuPath.length)) return true;

    if (action === 'back' && isAutoscanMenuOpen() && autoscanSession &&
        autoscanSession.status === SCAN_RUNNING) {
        stopAutoscanToSummary();
    }

    var result = radioOsHandleInput(radioOs, state.operatingMode, action, state);
    if (!result || !result.changed) return false;

    var handled = applyRadioOsEffect(result);
    if (!isRadioOsActive(radioOs)) clearMenuDial(menuDial);
    return handled;
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

    if (entry.dir === 'in' && entry.read === false) {
        refreshRadioUnreadBadge();
    }

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
    if (isCommsMenuOpen()) renderDisplay();
}

function ingestIncomingPayload(payload) {
    var c = getCtx();
    if (!payload || !payload.id) return;
    if (seenMessageIds[payload.id] || notebookHasId(payload.id)) {
        seenMessageIds[payload.id] = true;
        return;
    }

    if (payload.messageType === 'beacon') {
        ingestIncomingBeacon(payload, c);
        seenMessageIds[payload.id] = true;
        return;
    }

    /* Potlač jen echo z TÉTO vysílačky — stejný účet na jiném telefonu musí přijmout. */
    if (hasRecentOutgoingEcho(payload)) {
        seenMessageIds[payload.id] = true;
        return;
    }
    tryAutoscanLock(payload);
    if (hasContentDuplicate(payload)) {
        seenMessageIds[payload.id] = true;
        return;
    }

    ingestIncomingMessage(payload, c);
    seenMessageIds[payload.id] = true;
}

function applyLiveBeaconsFromCloud(docs) {
    var c = getCtx();
    var incoming = applyLiveBeaconSnapshot(docs, c.userId, {
        localActive: !!(beaconActive && beaconActive.active)
    });
    var seenSenders = {};
    var i;
    for (i = 0; i < incoming.length; i++) {
        var payload = incoming[i];
        var sid = String(payload.senderId || payload.id || '');
        seenSenders[sid] = true;
        var noteKey = sid + '_' + String(payload.startedAt || '');
        if (!beaconInboxNoted[noteKey]) {
            beaconInboxNoted[noteKey] = true;
            var beaconEntry = createIncomingEntry(Object.assign({}, payload, {
                id: 'beaconlive_' + noteKey,
                text: '[BEACON] ' + String(payload.text || 'BEACON').slice(0, 72)
            }), c);
            recordEntry(beaconEntry);
            radioIncomingFeedback(SIGNAL_WEAK);
        }
    }
    notifyBeaconMap(!!(incoming.length || (beaconActive && beaconActive.active)));
    renderDisplay();
}

function ingestIncomingBeacon(payload, c) {
    var registered = registerRemoteBeacon(payload);
    if (registered) notifyBeaconMap(true);
    var beaconOrigin = (payload.originLat != null && payload.originLng != null)
        ? { lat: payload.originLat, lng: payload.originLng }
        : null;
    if (!beaconOrigin) return;
    var beaconReception = evaluateIncomingReception(beaconOrigin, {
        frequency: normalizeFrequency(payload.frequency),
        encryptionKey: ''
    });
    schedulePathElevationPrefetch(beaconOrigin);
    if (!beaconReception.receivable || beaconReception.quality === SIGNAL_NONE) {
        beaconReception = {
            quality: SIGNAL_WEAK,
            distanceKm: beaconReception.distanceKm,
            receivable: true,
            reason: 'beacon_fallback'
        };
    }
    if (!beaconReception.receivable) return;
    if (hasRecentOutgoingEcho(payload)) return;
    if (hasContentDuplicate(payload)) return;
    var beaconKey = normalizeEncryptionKey(payload.encryptionKey || '');
    var myBeaconKey = normalizeEncryptionKey(state.encryptionKey || '');
    var beaconReadable = !beaconKey || beaconKey === myBeaconKey;
    if (beaconReadable && payload.pttAudio) {
        playPttAudio(payload.pttAudio, payload.pttMime);
    } else if (beaconReadable && payload.text) {
        var beaconEntry = createIncomingEntry(Object.assign({}, payload, {
            text: '[BEACON] ' + String(payload.text || '').slice(0, 72),
            signalQuality: beaconReception.quality,
            distanceKm: beaconReception.distanceKm
        }), c);
        recordEntry(beaconEntry);
    }
    radioIncomingFeedback(beaconReception.quality);
    renderDisplay();
}

function ingestIncomingMessage(payload, c) {
    var origin = (payload.originLat != null && payload.originLng != null)
        ? { lat: payload.originLat, lng: payload.originLng }
        : null;
    var reception = evaluateIncomingReception(origin, {
        frequency: normalizeFrequency(payload.frequency),
        encryptionKey: normalizeEncryptionKey(payload.encryptionKey || '')
    });
    schedulePathElevationPrefetch(origin);
    if (!reception.receivable) {
        reception = {
            quality: SIGNAL_NOISE,
            distanceKm: reception.distanceKm,
            receivable: true,
            reason: 'cloud_fallback'
        };
    }

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
    if (canRead && payload.messageType === 'ptt' && payload.pttAudio) {
        playPttAudio(payload.pttAudio, payload.pttMime);
    }
    radioIncomingFeedback(applied.signalQuality);
}

function bindRadioAuthRefresh() {
    if (radioAuthUnsub) return;
    try {
        radioAuthUnsub = onAuthStateChanged(getFirebaseAuth(), function(user) {
            if (!state) return;
            refreshSubscriptions();
        });
    } catch (e) {
        console.warn('[radioUi] auth refresh bind', e);
    }
}

function collectListenFrequencies() {
    var c = getCtx();
    var freqs = collectTunedFrequencies(state).slice();
    /* Pevný SOS maják — vždy v poslechu na všech vysílačkách. */
    freqs.unshift(BEACON_SOS_FREQUENCY);
    var comFreq = communityFrequencyFromCode(c.comCode);
    if (comFreq) freqs.push(comFreq);
    var i;
    var seen = {};
    var uniq = [];
    for (i = 0; i < freqs.length; i++) {
        var f = normalizeFrequency(freqs[i]);
        if (!f || seen[f]) continue;
        seen[f] = true;
        uniq.push(f);
    }
    return uniq;
}

function refreshSubscriptions() {
    if (ctx.isLocalOnly && ctx.isLocalOnly()) return Promise.resolve();
    if (state.operatingMode === 'off') {
        stopRadioSubscriptions();
        return Promise.resolve();
    }
    var onMsg = ingestIncomingPayload;
    return subscribeRadioListen(onMsg, {
        frequencies: collectListenFrequencies(),
        backfillRecentMs: 45000
    }).then(function() {
        return subscribeRadioBeaconsLive(applyLiveBeaconsFromCloud);
    }).then(function() {
        renderDisplay();
    }).catch(function(err) {
        console.warn('[radioUi] radio listen subscribe', err);
        subscribeRadioBeaconsLive(applyLiveBeaconsFromCloud).catch(function(e2) {
            console.warn('[radioUi] beacon live subscribe', e2);
        });
        renderDisplay();
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

async function transmitMessage(text, extras) {
    text = String(text || '').trim();
    extras = extras || {};
    if (!text && !extras.pttAudio) return;

    if (state.operatingMode === 'off') {
        alert('Vysílačka je vypnutá (režim OFF).');
        return;
    }

    var txFreq = extras.frequency != null ? extras.frequency : state.frequency;
    var txKey = extras.encryptionKey != null ? extras.encryptionKey : state.encryptionKey;
    if (!txFreq) {
        alert('Nejdřív nalaď frekvenci (PRE / −+ nebo MODE → přímý zápis).');
        return;
    }

    var c = getCtx();
    var txState = Object.assign({}, state, {
        frequency: txFreq,
        encryptionKey: txKey || ''
    });
    var txPresetSlot = extras.presetSlot != null ? extras.presetSlot : state.activePresetSlot;
    if (txPresetSlot) txState.activePresetSlot = txPresetSlot;
    if (!extras.skipTxFx) radioTxStart();
    var entry = createOutgoingEntry(text, c, txState, extras);
    if (!extras.skipNotebook) {
        recordEntry(entry);
        renderNotebook();
    }
    if (!extras.skipTxFx) radioTxEnd();

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
            messageType: extras.messageType,
            beaconBandcast: extras.beaconBandcast,
            pttAudio: extras.pttAudio,
            pttMime: extras.pttMime,
            presetSlot: entry.presetSlot,
            presetLabel: entry.presetLabel,
            timestamp: entry.ts,
            originLat: extras.originLat != null ? extras.originLat : c.originLat,
            originLng: extras.originLng != null ? extras.originLng : c.originLng
        });
        if (sent && sent.id) {
            seenMessageIds[sent.id] = true;
            entry.cloudId = sent.id;
            persist();
        }
    } catch (err) {
        console.warn('[radioUi] send', err);
        if (extras.reportSendError || (!extras.isBeaconRepeat && !extras.skipTxFx)) {
            var msg = (err && err.message) ? String(err.message) : 'Neznámá chyba';
            if (extras.reportSendError) throw err;
            alert('Vysílání selhalo: ' + msg + '\n(Přihlas se znovu — Firebase Auth.)');
        } else if (extras.messageType === 'beacon' && !extras.isBeaconRepeat) {
            throw err;
        }
    }
}

async function transmitPtt(result) {
    if (!result || !result.base64) return;
    var text = formatPttNotebookText(result.durationMs);
    await transmitMessage(text, {
        messageType: 'ptt',
        pttAudio: result.base64,
        pttMime: result.mime,
        skipTxFx: true
    });
}

function cycleRadioNode() {
    /* Přepínač BÁZE/NOSIČ zrušen — vždy NOSIČ (GPS). */
}

function bindClrLongPress() {
    var clr = el('radio-key-clr');
    if (!clr || clr._clrLongBound) return;
    clr._clrLongBound = true;
    var holdMs = 1400;

    function clearClrHold() {
        if (clrLongTimer) {
            clearTimeout(clrLongTimer);
            clrLongTimer = null;
        }
    }

    clr.addEventListener('pointerdown', function(e) {
        if (state.operatingMode === 'off' || e.button !== 0) return;
        clrLongFired = false;
        clearClrHold();
        clrLongTimer = setTimeout(function() {
            clrLongTimer = null;
            clrLongFired = true;
            returnRadioToStandby();
            if (navigator.vibrate) navigator.vibrate(50);
        }, holdMs);
    }, true);

    clr.addEventListener('pointerup', clearClrHold, true);
    clr.addEventListener('pointercancel', clearClrHold, true);
}

function bindShortcutHold() {
    var grid = el('radio-keypad-grid');
    if (!grid || grid._shortcutHoldBound) return;
    grid._shortcutHoldBound = true;
    grid.addEventListener('pointerdown', function(e) {
        if (state.operatingMode === 'off' || !isRadioOsActive(radioOs)) return;
        if (isFieldEditActive(fieldEditSession)) return;
        var leaf = radioOs.menuPath && radioOs.menuPath.length
            ? radioOs.menuPath[radioOs.menuPath.length - 1]
            : '';
        if (leaf === 'detail') return;
        var btn = e.target.closest('[data-key]');
        if (!btn) return;
        var key = btn.getAttribute('data-key');
        if (key !== 'p1' && key !== 'p2' && !/^[1-9]$/.test(key)) return;
        clearShortcutHold();
        shortcutHoldKey = key;
        shortcutHoldTimer = setTimeout(function() {
            bindShortcutFromMenu(shortcutHoldKey);
            clearShortcutHold();
            if (navigator.vibrate) navigator.vibrate(40);
        }, 3000);
    }, true);
    grid.addEventListener('pointerup', clearShortcutHold, true);
    grid.addEventListener('pointercancel', clearShortcutHold, true);
}

function bindRadioKeyT9() {
    var grid = el('radio-keypad-grid');
    if (!grid || grid._radioT9Bound) return;
    grid._radioT9Bound = true;
    var holdMs = 1400;
    var timer = null;
    var pendingKey = null;

    function clearHold() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pendingKey = null;
    }

    grid.addEventListener('pointerdown', function(e) {
        if (state.operatingMode === 'off' || !isFieldEditActive(fieldEditSession)) return;
        var btn = e.target.closest('.sector-hit[data-key], .radio-key[data-key]');
        if (!btn) return;
        var key = btn.getAttribute('data-key');
        if (!/^[0-9]$/.test(key) && key !== '*' && key !== '#') return;
        clearHold();
        fieldEditKeyLongFired = false;
        pendingKey = key;
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        if (/^[0-9]$/.test(key)) {
            timer = setTimeout(function() {
                timer = null;
                fieldEditKeyLongFired = true;
                handleFieldEditAction('char', key, { longPress: true });
                if (navigator.vibrate) navigator.vibrate(30);
            }, holdMs);
        }
    }, true);

    grid.addEventListener('pointerup', function(e) {
        if (!pendingKey) return;
        var key = pendingKey;
        if (fieldEditKeyLongFired) {
            e.preventDefault();
            e.stopPropagation();
            fieldEditKeyLongFired = false;
            clearHold();
            return;
        }
        if (key === '*' || key === '#') {
            e.preventDefault();
            e.stopPropagation();
            fieldEditPunctFired = true;
            handleFieldEditAction('char', key);
        }
        clearHold();
    }, true);

    grid.addEventListener('pointercancel', function() {
        fieldEditKeyLongFired = false;
        clearHold();
    }, true);
}

function bindKeypadPointerFeedback() {
    var grid = el('radio-keypad-grid');
    if (!grid || grid._keypadPointerFb) return;
    grid._keypadPointerFb = true;
    grid.addEventListener('pointerdown', function(e) {
        if (state.operatingMode === 'off' || e.button !== 0) return;
        if (e.target.closest('#radio-key-ent')) {
            radioKeyFeedback('ok');
            return;
        }
        if (e.target.closest('#radio-key-clr')) {
            radioKeyFeedback('back');
            return;
        }
        if (e.target.closest('#radio-key-mode, #radio-key-preset-dial')) {
            radioDialFeedback();
            return;
        }
        if (e.target.closest('#radio-key-main-dial')) {
            return;
        }
        var dpadBtn = e.target.closest('#radio-dpad-zone [data-key]');
        if (dpadBtn) {
            var dkey = dpadBtn.getAttribute('data-key');
            if (dkey === 'up' || dkey === 'down' || dkey === 'left' || dkey === 'right') {
                radioKeyFeedback('key');
                return;
            }
        }
        if (e.target.closest('.radio-key[data-key]')) {
            radioKeyFeedback('key');
        }
    }, true);
}

function bindKeypad() {
    var nodeBtn = el('radio-display-node');
    if (nodeBtn && !nodeBtn._radioCommsBound) {
        nodeBtn._radioCommsBound = true;
        nodeBtn.style.display = 'none';
    }

    var freqRow = el('radio-display-freq');
    if (freqRow) {
        freqRow._radioNodeBound = true;
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
                    if (fieldEditSession.returnTo === 'comms') {
                        finishCommsCompose();
                    } else if (fieldEditSession.returnTo === 'beacon') {
                        finishBeaconCompose();
                    } else {
                        var enterOk = handleFieldEditOk(fieldEditSession);
                        if (enterOk === 'done') finishFieldEdit(true);
                        else renderDisplay();
                    }
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
            handleRadioOkPress();
        };
    }

    var clr = el('radio-key-clr');
    if (clr && !clr._radioCommsBound) {
        clr._radioCommsBound = true;
        clr.addEventListener('click', function() {
            if (clrLongFired) {
                clrLongFired = false;
                return;
            }
            handleRadioBackPress();
        });
    }

    var mainDial = el('radio-key-main-dial');
    if (mainDial && !mainDial._pttBound) {
        mainDial._pttBound = true;
        mainDial.addEventListener('pointerdown', function(e) {
            if (state.operatingMode === 'off' || e.button !== 0) return;
            if (isBeaconMenuOpen() && beaconSession &&
                (beaconSession.screen === BEACON_PTT_ARM || beaconPttPending)) {
                e.preventDefault();
                startBeaconPttRecord();
                return;
            }
            if (!isStandbyScreen()) return;
            e.preventDefault();
            startStandbyPtt();
        }, true);
        mainDial.addEventListener('pointerup', function(e) {
            if (beaconPttPending || (pttSession.active && isBeaconMenuOpen())) {
                e.preventDefault();
                finishBeaconPttRecord();
                return;
            }
            if (standbyPttActive || pttSession.active) {
                e.preventDefault();
                finishStandbyPtt();
            }
        }, true);
        mainDial.addEventListener('pointercancel', function(e) {
            if (beaconPttPending || (pttSession.active && isBeaconMenuOpen())) {
                e.preventDefault();
                cancelBeaconPttRecord();
                return;
            }
            cancelStandbyPtt();
        }, true);
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
    bindRadioKeyboard();
    bindRadioKeyT9();
    bindShortcutHold();
    bindClrLongPress();
    bindKeypadPointerFeedback();

    var grid = el('radio-keypad-grid');
    if (grid && !grid._radioCommsBound) {
        grid._radioCommsBound = true;
        grid.addEventListener('click', function(e) {
            if (state.operatingMode === 'off') return;
            if (isFieldEditActive(fieldEditSession)) {
                var editBtn = e.target.closest('.sector-hit[data-key], .radio-key[data-key]');
                if (editBtn) {
                    var editKey = editBtn.getAttribute('data-key');
                    if (/^[0-9]$/.test(editKey) || editKey === '*' || editKey === '#') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (fieldEditPunctFired) {
                            fieldEditPunctFired = false;
                            fieldEditKeyLongFired = false;
                            return;
                        }
                        if (!fieldEditKeyLongFired) {
                            handleFieldEditAction('char', editKey);
                        }
                        fieldEditKeyLongFired = false;
                    }
                }
                return;
            }

            var menuBtn = e.target.closest('.radio-key[data-key], .sector-hit[data-key]');
            if (menuBtn) {
                var mkey = menuBtn.getAttribute('data-key');
                if (/^[0-9]$/.test(mkey) || mkey === 'p1' || mkey === 'p2') {
                    handleMenuKeypadDigit(mkey);
                    return;
                }
            }

            if (!isStandbyScreen()) return;
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

function isRadioKeyboardScope() {
    if (!document.body.classList.contains('radio-tab-active')) return false;
    var active = document.activeElement;
    if (!active || active === document.body) return true;
    if (active.closest('.sector-tech-shell') || active.closest('#radio-keypad-grid')) return true;
    if (active.id === 'chat-input-field') return true;
    var tag = active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
    if (active.isContentEditable) return false;
    return true;
}

function handleRadioDpadKey(key) {
    if (key !== 'up' && key !== 'down' && key !== 'left' && key !== 'right') return;
    if (state.operatingMode === 'off') return;
    if (isFieldEditActive(fieldEditSession)) {
        handleFieldEditAction(key);
        return;
    }
    if (isStandbyScreen()) {
        if (standbyUi.active && (key === 'left' || key === 'right')) {
            handleStandbyInput(key === 'right' ? 'preset_next' : 'preset_prev');
            return;
        }
        if (key === 'left' || key === 'right') {
            if (key === 'right') handleStandbyInput('ok');
            else handleStandbyInput('back');
        } else {
            handleStandbyInput(key);
        }
        return;
    }
    if (isRadioOsActive(radioOs)) {
        handleRadioOsInput(key);
    }
}

function handleRadioOkPress() {
    if (state.operatingMode === 'off') return;
    if (isFieldEditActive(fieldEditSession)) {
        if (fieldEditSession.returnTo === 'comms') {
            finishCommsCompose();
            return;
        }
        if (fieldEditSession.returnTo === 'beacon') {
            finishBeaconCompose();
            return;
        }
        var okResult = handleFieldEditOk(fieldEditSession);
        if (okResult === 'done') finishFieldEdit(true);
        else renderDisplay();
        return;
    }
    if (standbyUi.active) {
        openStandbyFieldEdit(getStandbyField(standbyUi.focusIndex));
        return;
    }
    if (isRadioOsActive(radioOs)) {
        handleRadioOsInput('ok');
        return;
    }
    if (isStandbyScreen()) {
        handleStandbyInput('ok');
    }
}

function handleRadioBackPress() {
    var input = el('chat-input-field');
    if (state.operatingMode === 'off') return;
    if (standbyPttActive) {
        cancelStandbyPtt();
        return;
    }
    if (isFieldEditActive(fieldEditSession)) {
        handleFieldEditBackAction();
        return;
    }
    if (standbyUi.active) {
        standbyUi.active = false;
        renderDisplay();
        return;
    }
    if (handleRadioOsInput('back')) return;
    state.dialBuffer = '';
    state.keypadMode = 'tx';
    if (input) input.value = '';
    persist();
    renderDisplay();
}

function bindRadioKeyboard() {
    if (window._patracRadioKeyboardBound) return;
    window._patracRadioKeyboardBound = true;
    window.addEventListener('keydown', function(e) {
        if (!isRadioKeyboardScope()) return;

        var active = document.activeElement;
        var dpadKey = null;
        if (e.key === 'ArrowUp') dpadKey = 'up';
        else if (e.key === 'ArrowDown') dpadKey = 'down';
        else if (e.key === 'ArrowLeft') dpadKey = 'left';
        else if (e.key === 'ArrowRight') dpadKey = 'right';

        if (dpadKey) {
            e.preventDefault();
            radioKeyFeedback('key');
            handleRadioDpadKey(dpadKey);
            return;
        }

        if (e.key === 'Enter') {
            if (active && active.id === 'chat-input-field' && !isFieldEditActive(fieldEditSession)) return;
            e.preventDefault();
            radioKeyFeedback('ok');
            handleRadioOkPress();
            return;
        }

        if (e.key === 'Backspace') {
            if (active && active.id === 'chat-input-field' && active.value) return;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
                active.id !== 'chat-input-field') return;
            e.preventDefault();
            radioKeyFeedback('back');
            handleRadioBackPress();
        }
    });
}

function bindDpadNavigation() {
    var zone = el('radio-dpad-zone');
    if (!zone || zone._radioOsBound) return;
    zone._radioOsBound = true;
    zone.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-key]');
        if (!btn) return;
        var key = btn.getAttribute('data-key');
        if (key !== 'up' && key !== 'down' && key !== 'left' && key !== 'right') return;
        e.preventDefault();
        e.stopPropagation();
        handleRadioDpadKey(key);
    });
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

var RADIO_OPERATING_MODES = ['off', 'on'];

function cycleOperatingMode(direction) {
    haltAutoscan(true);
    autoscanSession = null;
    closeAppScreens();
    cancelStandbyPtt();
    standbyUi = createStandbyUiState();
    var cur = normalizeOperatingMode(state.operatingMode);
    var idx = RADIO_OPERATING_MODES.indexOf(cur);
    if (idx < 0) idx = 1;
    var dir = direction < 0 ? -1 : 1;
    idx = (idx + dir + RADIO_OPERATING_MODES.length) % RADIO_OPERATING_MODES.length;
    var nextMode = RADIO_OPERATING_MODES[idx];
    if (nextMode === 'on' && !canPowerRadioOn(state)) {
        state.operatingMode = 'off';
        persist();
        renderDisplay();
        return;
    }
    state.operatingMode = nextMode;
    if (state.operatingMode === 'on') stopBatteryCharging(state);
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
    bindRadioAuthRefresh();
    bindChargeControl();
    startBatteryTimer();
    syncBatteryAndApply({
        operatingMode: state.operatingMode,
        autoscanActive: isAutoscanListening()
    });
    if (state.operatingMode === 'on' && !canPowerRadioOn(state)) {
        forceRadioPowerOff(false);
    }
    initRadioFeedback(state && state.soundPrefs ? state.soundPrefs : null);
    setRadioSoundPrefs(state && state.soundPrefs ? state.soundPrefs : null);
    resetRadioOs(radioOs);
    initSectorTechShell();
    window.patracRefreshSectorTech = refreshSectorTechLayout;
    window.patracRefreshRadioUnreadBadge = refreshRadioUnreadBadge;
    syncNotebookTabs();
    renderDisplay();
    refreshRadioUnreadBadge();
    var layout = stationPageMetrics();
    trimStationToMaxPages(notebook, NOTEBOOK_MAX_PAGES, layout.linesPerPage, layout.charsPerLine);
    saveNotebook(c.userId, notebook);
    renderNotebook();
    refreshSubscriptions();
    notifyRadioRangeLayer();
    prefetchReceptionElevations().catch(function(err) {
        console.warn('[radioUi] elevation prefetch', err);
    });
    window.patracListReceivers = function() {
        return listReceivers(getComCode());
    };
    window.patracGetReceiverNodes = function(channel) {
        return getRelayNodes(channel || null);
    };
    window.patracGetCachedElevationM = getCachedElevationM;
    window.patracRefreshRadioReception = function() {
        return prefetchReceptionElevations();
    };
    refreshBeaconActiveFromStorage();
    if (beaconActive && beaconActive.active) {
        startBeaconRepeatTimer();
        refreshSubscriptions();
    }
    window.patracGetMapBeacons = function() {
        /* Preferuj běžící paměť — storage jen když beacon ještě není v RAM. */
        if (!(beaconActive && beaconActive.active)) {
            refreshBeaconActiveFromStorage();
        }
        var c = getCtx();
        return getMapBeacons(c.comCode || '', beaconActive);
    };
    window.patracHasLocalBeacon = function() {
        return !!(beaconActive && beaconActive.active);
    };
    notifyBeaconMap(false);
    flushPendingBeaconMapRefresh();
}

export function refreshRadioCommsContext() {
    if (!state) return;
    var c = getCtx();
    state = loadRadioState(c.userId, c);
    renderDisplay();
    refreshSubscriptions();
    notifyRadioRangeLayer();
    refreshRadioUnreadBadge();
    prefetchReceptionElevations().catch(function(err) {
        console.warn('[radioUi] elevation prefetch', err);
    });
}

export function stopRadioComms() {
    haltAutoscan(true);
    autoscanSession = null;
    stopBeacon();
    cancelStandbyPtt();
    clearPttMaxTimer();
    stopRadioSubscriptions();
    if (radioAuthUnsub) {
        try { radioAuthUnsub(); } catch (e) {}
        radioAuthUnsub = null;
    }
}

export function updateRadioDisplayHud() {
    refreshRadioCommsContext();
}
