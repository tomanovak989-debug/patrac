/**
 * F2 — Autoscan presetových kanálů (cyklus + zachycení aktivity).
 */
import { findPreset, normalizeFrequency } from './radioComms.js';

export var SCAN_IDLE = 'idle';
export var SCAN_RUNNING = 'running';
export var SCAN_LOCKED = 'locked';

export var AUTOSCAN_DWELL_MS = 650;

export function createAutoscanState() {
    return {
        status: SCAN_IDLE,
        plan: [],
        index: 0,
        savedFrequency: null,
        savedEncryptionKey: null,
        savedActivePresetSlot: null,
        hitLabel: '',
        stepStartedAt: 0,
        activitySeen: false
    };
}

export function buildAutoscanPlan(radioState) {
    radioState = radioState || {};
    var plan = [];
    var seen = {};
    var slot;
    for (slot = 1; slot <= 15; slot++) {
        var preset = findPreset(radioState, slot);
        if (!preset || !preset.frequency) continue;
        var freq = normalizeFrequency(preset.frequency);
        if (!freq || seen[freq]) continue;
        seen[freq] = true;
        plan.push({
            slot: slot,
            frequency: freq,
            encryptionKey: preset.encryptionKey || '',
            label: preset.label || ('P' + slot)
        });
    }
    if (!plan.length) {
        var cur = normalizeFrequency(radioState.frequency);
        if (cur) {
            plan.push({
                slot: radioState.activePresetSlot || 0,
                frequency: cur,
                encryptionKey: radioState.encryptionKey || '',
                label: 'AKTUÁLNÍ'
            });
        }
    }
    return plan;
}

export function applyScanStep(session, radioState) {
    if (!session || !radioState || !session.plan.length) return false;
    var step = session.plan[session.index];
    if (!step) return false;
    radioState.frequency = step.frequency;
    radioState.encryptionKey = step.encryptionKey || '';
    radioState.activePresetSlot = step.slot || null;
    radioState.dialBuffer = '';
    radioState.keypadMode = 'tx';
    session.stepStartedAt = Date.now();
    session.activitySeen = false;
    return true;
}

export function startAutoscan(session, radioState) {
    if (!session || !radioState) return false;
    var plan = buildAutoscanPlan(radioState);
    if (!plan.length) return false;
    session.plan = plan;
    session.index = 0;
    session.savedFrequency = radioState.frequency;
    session.savedEncryptionKey = radioState.encryptionKey || '';
    session.savedActivePresetSlot = radioState.activePresetSlot || null;
    session.hitLabel = '';
    session.status = SCAN_RUNNING;
    return applyScanStep(session, radioState);
}

export function advanceAutoscan(session, radioState) {
    if (!session || session.status !== SCAN_RUNNING || !session.plan.length) return false;
    session.index = (session.index + 1) % session.plan.length;
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
    session.plan = [];
    session.index = 0;
    session.hitLabel = '';
    session.activitySeen = false;
}

export function getAutoscanStep(session) {
    if (!session || !session.plan.length) return null;
    return session.plan[session.index] || null;
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

export function buildAutoscanOsView(os, operatingMode, session, radioState) {
    var modeLabel = operatingMode === 'text' ? 'TEXT' : 'VOICE';
    session = session || createAutoscanState();
    var planCount = buildAutoscanPlan(radioState).length;
    var lines;
    var footer;
    var status;

    if (session.status === SCAN_RUNNING) {
        var step = getAutoscanStep(session);
        var n = session.index + 1;
        var total = session.plan.length;
        lines = [
            'SKEN ' + n + '/' + total,
            step ? (step.frequency + ' MHz') : '',
            step ? String(step.label || ('P' + step.slot)).slice(0, 16) : '',
            session.activitySeen ? '● AKTIVITA' : '○ poslouchám…',
            '',
            ''
        ];
        footer = 'OK stop · Zpět';
        status = 'AUTOSKEN · SKEN · ' + modeLabel;
    } else if (session.status === SCAN_LOCKED) {
        var locked = getAutoscanStep(session);
        lines = [
            'ZAMČENO',
            locked ? (locked.frequency + ' MHz') : '',
            String(session.hitLabel || (locked && locked.label) || '').slice(0, 16),
            'Signál na kanálu',
            '',
            ''
        ];
        footer = 'OK · Zpět';
        status = 'AUTOSKEN · STOP · ' + modeLabel;
    } else {
        lines = [
            'AUTOSKEN',
            'Presetové kanály',
            planCount ? ('Připraveno: ' + planCount) : 'Žádné presety',
            planCount ? 'OK = spustit sken' : 'Ulož preset nejdřív',
            '',
            ''
        ];
        footer = planCount ? 'OK · Zpět' : 'Zpět';
        status = 'AUTOSKEN · ' + modeLabel;
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
