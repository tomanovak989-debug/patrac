/**
 * Baterie vysílačky — poměrové vybíjení / nabíjení v reálném čase.
 * ON: 100→0 % za 24 h (autosken 2× rychleji). OFF+nabíjení: 0→100 % za 2 h.
 */
export var BATTERY_DISCHARGE_MS = 24 * 60 * 60 * 1000;
export var BATTERY_CHARGE_MS = 2 * 60 * 60 * 1000;
export var BATTERY_AUTOSCAN_DRAIN_MULT = 2;

export function normalizeBatteryFields(state) {
    if (!state) return;
    if (typeof state.batteryLevel !== 'number' || !isFinite(state.batteryLevel)) {
        state.batteryLevel = 100;
    }
    state.batteryLevel = Math.max(0, Math.min(100, state.batteryLevel));
    if (typeof state.batteryUpdatedAt !== 'number' || !isFinite(state.batteryUpdatedAt)) {
        state.batteryUpdatedAt = Date.now();
    }
    state.batteryCharging = !!state.batteryCharging;
}

/**
 * @param {object} state
 * @param {{ operatingMode?: string, autoscanActive?: boolean }} opts
 * @returns {number} aktuální %
 */
export function syncBattery(state, opts) {
    opts = opts || {};
    normalizeBatteryFields(state);
    var now = Date.now();
    var elapsed = Math.max(0, now - state.batteryUpdatedAt);
    if (elapsed <= 0) return state.batteryLevel;

    var level = state.batteryLevel;
    var mode = opts.operatingMode || 'on';

    if (mode === 'on') {
        var drainPerMs = 100 / BATTERY_DISCHARGE_MS;
        if (opts.autoscanActive) drainPerMs *= BATTERY_AUTOSCAN_DRAIN_MULT;
        level -= elapsed * drainPerMs;
    } else if (mode === 'off' && state.batteryCharging) {
        level += elapsed * (100 / BATTERY_CHARGE_MS);
    }

    state.batteryLevel = Math.max(0, Math.min(100, level));
    state.batteryUpdatedAt = now;
    return state.batteryLevel;
}

export function formatBatteryPercent(state) {
    normalizeBatteryFields(state);
    return Math.round(state.batteryLevel) + '%';
}

export function formatStandbyClockLine(state, now) {
    now = now || new Date();
    normalizeBatteryFields(state);
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var mi = String(now.getMinutes()).padStart(2, '0');
    return dd + '.' + mm + '. ' + hh + ':' + mi + '  ·  ' + formatBatteryPercent(state);
}

export function canStartBatteryCharging(state) {
    return !!(state && state.operatingMode === 'off');
}

export function toggleBatteryCharging(state) {
    if (!canStartBatteryCharging(state)) return false;
    syncBattery(state, { operatingMode: 'off', autoscanActive: false });
    state.batteryCharging = !state.batteryCharging;
    return true;
}

export function stopBatteryCharging(state) {
    if (!state) return;
    if (state.batteryCharging) {
        syncBattery(state, { operatingMode: 'off', autoscanActive: false });
    }
    state.batteryCharging = false;
}
