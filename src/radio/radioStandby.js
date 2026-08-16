/**
 * Úvodní obrazovka — výběr F / Š pro ruční ladění (bez změny presetu).
 */
export var STANDBY_FIELD_FREQ = 'freq';
export var STANDBY_FIELD_ENCRYPT = 'encrypt';

export function createStandbyUiState() {
    return {
        active: false,
        focusIndex: 0
    };
}

export function standbyFieldCount() {
    return 2;
}

export function getStandbyField(index) {
    return index === 1 ? STANDBY_FIELD_ENCRYPT : STANDBY_FIELD_FREQ;
}

export function clampStandbyFocus(index) {
    if (index < 0) return 0;
    if (index >= standbyFieldCount()) return standbyFieldCount() - 1;
    return index;
}

export function buildStandbyDisplay(state, standbyUi, baseLines) {
    baseLines = baseLines || {};
    var lines = [
        baseLines.line1 || '',
        baseLines.line2 || '',
        baseLines.line3 || '',
        baseLines.line4 || '',
        '',
        ''
    ];
    var focusLine = -1;
    if (standbyUi && standbyUi.active) {
        focusLine = standbyUi.focusIndex;
        if (focusLine === 0) lines[0] = '▸ F   ' + (lines[0].split('MHz')[0] || lines[0]).replace(/^[^0-9]*/, '').trim() || baseLines.line1;
        if (focusLine === 1) lines[1] = '▸ Š   ' + (baseLines.line2 || '').replace(/^ŠIFRA:\s*/, '').replace(/^BEZ ŠIFRY.*/, '—');
    }
    return {
        mode: standbyUi && standbyUi.active ? 'standby_tune' : 'standby',
        status: standbyUi && standbyUi.active ? 'RUČNÍ LADĚNÍ' : baseLines.status,
        lines: lines,
        focusLine: focusLine,
        footer: standbyUi && standbyUi.active ? 'OK edit · Zpět' : baseLines.footer,
        buffer: ''
    };
}
