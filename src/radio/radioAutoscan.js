/**
 * F2 — Autoscan celého pásma 400–470 MHz (krok 0.025).
 */
import { normalizeFrequency } from './radioComms.js';
import { BAND_MIN_MHZ, BAND_MAX_MHZ, TUNE_STEP_MHZ, parseFrequencyMHz, isInBand } from './radioBand.js';

export var SCAN_IDLE = 'idle';
export var SCAN_RUNNING = 'running';
export var SCAN_LOCKED = 'locked';

/** Rychlost vizuálního průtahu pásma (jen obrazovka). */
export var AUTOSCAN_VISUAL_MS = 42;
/** @deprecated alias — vizuální krok */
export var AUTOSCAN_DWELL_MS = AUTOSCAN_VISUAL_MS;
function scanProgressBar(index, total, width) {
    width = width || 14;
    if (!total || total <= 1) return '▓'.repeat(width);
    var pct = index / (total - 1);
    var filled = Math.round(pct * width);
    if (filled > width) filled = width;
    var bar = '';
    var i;
    for (i = 0; i < width; i++) bar += i < filled ? '▓' : '░';
    return bar;
}

export function bandScanStepCount() {
    return Math.round((BAND_MAX_MHZ - BAND_MIN_MHZ) / TUNE_STEP_MHZ) + 1;
}

export function frequencyAtBandIndex(index) {
    var n = BAND_MIN_MHZ + index * TUNE_STEP_MHZ;
    if (n > BAND_MAX_MHZ) n = BAND_MAX_MHZ;
    return normalizeFrequency(n);
}

export function bandIndexForFrequency(mhz) {
    var n = parseFrequencyMHz(mhz);
    if (!isFinite(n)) return 0;
    var idx = Math.round((n - BAND_MIN_MHZ) / TUNE_STEP_MHZ);
    if (idx < 0) return 0;
    var max = bandScanStepCount() - 1;
    if (idx > max) return max;
    return idx;
}

export function createAutoscanState() {
    return {
        status: SCAN_IDLE,
        index: 0,
        totalSteps: bandScanStepCount(),
        savedFrequency: null,
        savedEncryptionKey: null,
        savedActivePresetSlot: null,
        hitLabel: '',
        hitFrequency: null,
        hitEncrypted: false,
        stepStartedAt: 0,
        activitySeen: false
    };
}

/** Vizuální krok — nemění naladění vysílačky. */
export function advanceAutoscanVisual(session) {
    if (!session || session.status !== SCAN_RUNNING) return false;
    session.index++;
    if (session.index >= session.totalSteps) session.index = 0;
    return true;
}

export function applyScanStep(session, radioState) {
    if (!session || !radioState) return false;
    session.stepStartedAt = Date.now();
    session.activitySeen = false;
    return true;
}

export function startAutoscan(session, radioState) {
    if (!session || !radioState) return false;
    session.index = 0;
    session.totalSteps = bandScanStepCount();
    session.savedFrequency = radioState.frequency;
    session.savedEncryptionKey = radioState.encryptionKey || '';
    session.savedActivePresetSlot = radioState.activePresetSlot || null;
    session.hitLabel = '';
    session.hitFrequency = null;
    session.hitEncrypted = false;
    session.status = SCAN_RUNNING;
    return applyScanStep(session, radioState);
}

export function lockAutoscan(session, hitLabel, hitFrequency) {
    if (!session || session.status !== SCAN_RUNNING) return false;
    session.status = SCAN_LOCKED;
    session.hitLabel = hitLabel || '';
    if (hitFrequency) session.hitFrequency = normalizeFrequency(hitFrequency);
    return true;
}

export function stopAutoscan(session, radioState, restore) {
    if (!session) return;
    if (restore && radioState && session.savedFrequency) {
        radioState.frequency = session.savedFrequency;
        radioState.encryptionKey = session.savedEncryptionKey || '';
        radioState.activePresetSlot = session.savedActivePresetSlot || null;
    }
    session.status = SCAN_IDLE;
    session.index = 0;
    session.hitLabel = '';
    session.hitFrequency = null;
    session.hitEncrypted = false;
    session.activitySeen = false;
}

export function isAutoscanListenFrequency(mhz) {
    var freq = normalizeFrequency(mhz);
    if (!freq || !isInBand(parseFrequencyMHz(freq))) return false;
    return true;
}

/** Herní odchyt: libovolná frekvence v pásmu — podmínka je jen dosah (ingest). */
export function isAutoscanActivity(session, payload) {
    if (!session || session.status !== SCAN_RUNNING || !payload) return false;
    return isAutoscanListenFrequency(payload.frequency);
}

export function getAutoscanStep(session) {
    if (!session) return null;
    var freq = session.hitFrequency || frequencyAtBandIndex(session.index);
    if (!freq) return null;
    return { frequency: freq, label: freq + ' MHz', slot: 0 };
}

export function buildAutoscanOsView(session, radioState) {
    session = session || createAutoscanState();
    var total = session.totalSteps || bandScanStepCount();
    var lines;
    var footer;
    var status;
    var visual = getAutoscanStep(session);
    var visualFreq = visual && !session.hitFrequency ? frequencyAtBandIndex(session.index) : null;

    if (session.status === SCAN_RUNNING) {
        var pct = total > 1 ? Math.round((session.index / (total - 1)) * 100) : 0;
        lines = [
            'SKEN · ' + pct + '%',
            visualFreq ? ('▸ ' + visualFreq) : '',
            'POSLECH · celé pásmo',
            scanProgressBar(session.index, total, 14),
            session.activitySeen ? '● zachyceno' : '○ čekám…',
            ''
        ];
        footer = 'Obraz = průtah · RX = celé pásmo';
        status = 'AUTOSKEN · SKEN';
    } else if (session.status === SCAN_LOCKED) {
        var locked = session.hitFrequency || (visual && visual.frequency);
        lines = [
            'ZAMČENO',
            locked ? (locked + ' MHz') : '',
            session.hitEncrypted ? 'ŠIFROVANÝ PROVOZ' : String(session.hitLabel || '').slice(0, 18),
            session.hitEncrypted ? 'Lustit heslo později' : 'Signál v dosahu',
            '',
            ''
        ];
        footer = 'OK · Zpět';
        status = 'AUTOSKEN · STOP';
    } else {
        lines = [
            'AUTOSKEN',
            'Pásmo ' + BAND_MIN_MHZ + '–' + BAND_MAX_MHZ,
            'Odchyt dle dosahu',
            'Libovolná frekvence v pásmu',
            'OK = spustit',
            ''
        ];
        footer = 'OK · Zpět';
        status = 'AUTOSKEN';
    }

    return {
        mode: 'autoscan',
        status: status,
        lines: lines,
        focusLine: -1,
        footer: footer,
        buffer: ''
    };
}
