/**
 * Rychlé volby P1 / P2 / 1–9 — mapování na akce menu.
 */
export var QUICK_KEY_IDS = ['p1', 'p2', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function createDefaultQuickKeys() {
    var keys = {};
    var i;
    for (i = 0; i < QUICK_KEY_IDS.length; i++) keys[QUICK_KEY_IDS[i]] = null;
    return keys;
}

export function normalizeQuickKeys(raw) {
    var out = createDefaultQuickKeys();
    if (!raw || typeof raw !== 'object') return out;
    var i;
    for (i = 0; i < QUICK_KEY_IDS.length; i++) {
        var id = QUICK_KEY_IDS[i];
        if (raw[id] && raw[id].action) out[id] = raw[id];
    }
    return out;
}

export function bindQuickKey(state, keyId, binding) {
    if (!state) return;
    if (!state.quickKeys) state.quickKeys = createDefaultQuickKeys();
    state.quickKeys[keyId] = binding || null;
}

export function getQuickKeyBinding(state, keyId) {
    if (!state || !state.quickKeys) return null;
    return state.quickKeys[keyId] || null;
}

export function quickKeyBadge(keyId) {
    if (!keyId) return '';
    return String(keyId).toUpperCase();
}

export function decorateMenuLabel(label, keyId) {
    if (!keyId) return label;
    return label + ' \u02E2' + quickKeyBadge(keyId);
}

/** Najde klíč navázaný na danou akci (pro zobrazení indexu v menu). */
export function findQuickKeyForAction(state, actionId) {
    if (!state || !state.quickKeys || !actionId) return null;
    var keys = QUICK_KEY_IDS;
    var i;
    for (i = 0; i < keys.length; i++) {
        var b = state.quickKeys[keys[i]];
        if (b && b.action === actionId) return keys[i];
    }
    return null;
}

export function bindingFromCommsItem(item, session) {
    if (!item) return null;
    if (item.type === 'action') {
        if (item.id === 'new_sms') return { action: 'comms:new_sms', label: 'NOVÁ SMS' };
        if (item.id === 'inbox') return { action: 'comms:inbox', label: 'PŘIJATÉ' };
        if (item.id === 'outbox') return { action: 'comms:outbox', label: 'ODESLANÉ' };
        if (item.id === 'drafts') return { action: 'comms:drafts', label: 'ROZPRACOVANÉ' };
        if (item.id === 'send_yes') return { action: 'comms:send', label: 'ODESLAT' };
    }
    if (item.type === 'msg' && item.entry) {
        return { action: 'comms:msg:' + (item.entry.id || ''), label: 'ZPRÁVA' };
    }
    return null;
}

export function bindingFromPresetField(slot, fieldIndex) {
    if (!slot) return null;
    var labels = ['NÁZEV', 'FREQ', 'ŠIFRA'];
    return {
        action: 'preset_field:' + slot + ':' + fieldIndex,
        label: 'P' + slot + ' ' + (labels[fieldIndex] || '')
    };
}

export function bindingFromAutoscan(session) {
    if (!session) return null;
    if (session.status === 'idle' || session.status === 'running') {
        return { action: 'autoscan:start', label: 'AUTOSKEN' };
    }
    return { action: 'autoscan:open', label: 'AUTOSKEN' };
}

export function bindingFromMenuItem(item) {
    if (!item) return null;
    if (item.shortcutAction) {
        return { action: item.shortcutAction, label: item.label || item.shortcutAction };
    }
    if (item.action === 'screen:autoscan') {
        return { action: 'autoscan:start', label: 'AUTOSKEN' };
    }
    if (item.action === 'screen:comms') {
        return { action: 'menu:comms', label: 'SMS / PTT' };
    }
    if (item.action === 'submenu:presets') {
        return { action: 'menu:presets', label: 'PRESETY' };
    }
    if (item.action === 'preset_detail' && item.slot) {
        return { action: 'preset:' + item.slot, label: 'P' + item.slot };
    }
    if (item.action === 'stub') {
        return { action: 'stub:' + (item.id || ''), label: item.label || 'VOLBA' };
    }
    return null;
}
