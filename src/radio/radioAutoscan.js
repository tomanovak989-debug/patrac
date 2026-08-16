/**
 * F2 — Autoscan celého pásma 400–470 MHz (krok 0.025).
 */
import { normalizeFrequency } from './radioComms.js';
import { BAND_MIN_MHZ, BAND_MAX_MHZ, TUNE_STEP_MHZ } from './radioBand.js';

export var SCAN_IDLE = 'idle';
export var SCAN_RUNNING = 'running';
export var SCAN_LOCKED = 'locked';

export var AUTOSCAN_DWELL_MS = 220;

export function bandScanStepCount() {
    return Math.round((BAND_MAX_MHZ - BAND_MIN_MHZ) / TUNE_STEP_MHZ) + 1;
}

export function frequencyAtBandIndex(index) {
    var n = BAND_MIN_MHZ + index * TUNE_STEP_MHZ;
    if (n > BAND_MAX_MHZ) n = BAND_MAX_MHZ;
    return normalizeFrequency(n);
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
        stepStartedAt: 0,
        activitySeen: false
    };
}

export function applyScanStep(session, radioState) {
    if (!session || !radioState) return false;
    var freq = frequencyAtBandIndex(session.index);
    if (!freq) return false;
    radioState.frequency = freq;
    radioState.encryptionKey = '';
    radioState.activePresetSlot = null;
    radioState.dialBuffer = '';
    radioState.keypadMode = 'tx';
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
    session.status = SCAN_RUNNING;
    return applyScanStep(session, radioState);
}

export function advanceAutoscan(session, radioState) {
    if (!session || session.status !== SCAN_RUNNING) return false;
    session.index++;
    if (session.index >= session.totalSteps) session.index = 0;
    return applyScanStep(session, radioState);
}

export function lockAutoscan(session, hitLabel) {
    if (!session || session.status !== SCAN_RUNNING) return false;
    session.status = SCAN_LOCKED;
    session.hitLabel = hitLabel || '';
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
    session.activitySeen = false;
}

export function getAutoscanStep(session) {
    if (!session) return null;
    var freq = frequencyAtBandIndex(session.index);
    if (!freq) return null;
    return { frequency: freq, label: freq + ' MHz', slot: 0 };
}

export function isAutoscanActivity(session, payload) {
    if (!session || session.status !== SCAN_RUNNING || !payload) return false;
    var step = getAutoscanStep(session);
    if (!step) return false;
    var msgFreq = normalizeFrequency(payload.frequency);
    if (!msgFreq || msgFreq !== normalizeFrequency(step.frequency)) return false;
    var ts = payload.timestamp || payload.ts || 0;
    if (ts && ts < session.stepStartedAt - 250) return false;
    return true;
}

export function buildAutoscanOsView(session, radioState) {
    session = session || createAutoscanState();
    var total = session.totalSteps || bandScanStepCount();
    var lines;
    var footer;
    var status;

    if (session.status === SCAN_RUNNING) {
        var step = getAutoscanStep(session);
        var n = session.index + 1;
        lines = [
            'SKEN ' + n + '/' + total,
            step ? step.frequency + ' MHz' : '',
            BAND_MIN_MHZ + '–' + BAND_MAX_MHZ + ' · 0.025',
            session.activitySeen ? '● AKTIVITA' : '○ poslouchám…',
            '',
            ''
        ];
        footer = 'OK stop · Zpět';
        status = 'AUTOSKEN · SKEN';
    } else if (session.status === SCAN_LOCKED) {
        var locked = getAutoscanStep(session);
        lines = [
            'ZAMČENO',
            locked ? (locked.frequency + ' MHz') : '',
            String(session.hitLabel || '').slice(0, 18),
            'Signál na kanálu',
            '',
            ''
        ];
        footer = 'OK · Zpět';
        status = 'AUTOSKEN · STOP';
    } else {
        lines = [
            'AUTOSKEN',
            'Pásmo ' + BAND_MIN_MHZ + '–' + BAND_MAX_MHZ,
            'Krok 0.025 MHz',
            total + ' kanálů',
            'OK = spustit sken',
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
