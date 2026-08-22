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

export function isBatteryEmpty(state) {
    normalizeBatteryFields(state);
    return state.batteryLevel <= 0;
}

export function canPowerRadioOn(state) {
    normalizeBatteryFields(state);
    return state.batteryLevel > 0;
}

/**
 * @param {object} state
 * @param {{ operatingMode?: string, autoscanActive?: boolean }} opts
 * @returns {{ level: number, powerOff: boolean, chargeComplete: boolean }}
 */
export function syncBattery(state, opts) {
    opts = opts || {};
    normalizeBatteryFields(state);
    var now = Date.now();
    var elapsed = Math.max(0, now - state.batteryUpdatedAt);
    var mode = opts.operatingMode || 'on';
    var level = state.batteryLevel;
    var powerOff = false;
    var chargeComplete = false;

    if (elapsed > 0) {
        if (mode === 'on' && level > 0) {
            var drainPerMs = 100 / BATTERY_DISCHARGE_MS;
            if (opts.autoscanActive) drainPerMs *= BATTERY_AUTOSCAN_DRAIN_MULT;
            level -= elapsed * drainPerMs;
        } else if (mode === 'off' && state.batteryCharging && level < 100) {
            level += elapsed * (100 / BATTERY_CHARGE_MS);
        }
    }

    if (mode === 'on' && level <= 0) {
        level = 0;
        powerOff = true;
    }

    if (state.batteryCharging && level >= 100) {
        level = 100;
        chargeComplete = true;
        state.batteryCharging = false;
    }

    state.batteryLevel = Math.max(0, Math.min(100, level));
    state.batteryUpdatedAt = now;

    return {
        level: state.batteryLevel,
        powerOff: powerOff,
        chargeComplete: chargeComplete
    };
}

export function formatBatteryPercent(state) {
    normalizeBatteryFields(state);
    return Math.round(state.batteryLevel) + '%';
}

export function formatDisplayClockLine(state, now) {
    now = now || new Date();
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var mi = String(now.getMinutes()).padStart(2, '0');
    return dd + '.' + mm + '. ' + hh + ':' + mi;
}

export function formatStandbyClockBattery(state, now) {
    now = now || new Date();
    normalizeBatteryFields(state);
    return formatDisplayClockLine(state, now);
}

/** @deprecated alias */
export function formatStandbyClockLine(state, now) {
    return formatStandbyClockBattery(state, now);
}

export function canStartBatteryCharging(state) {
    return !!(state && state.operatingMode === 'off' && state.batteryLevel < 100);
}

export function toggleBatteryCharging(state) {
    if (!canStartBatteryCharging(state) && !(state && state.operatingMode === 'off' && state.batteryCharging)) {
        return false;
    }
    syncBattery(state, { operatingMode: 'off', autoscanActive: false });
    if (state.batteryCharging) {
        state.batteryCharging = false;
        return true;
    }
    if (state.batteryLevel >= 100) return false;
    state.batteryCharging = true;
    return true;
}

export function stopBatteryCharging(state) {
    if (!state) return;
    if (state.batteryCharging) {
        syncBattery(state, { operatingMode: 'off', autoscanActive: false });
    }
    state.batteryCharging = false;
}
