/**
 * OS vysílačky SECTOR-TECH — navigace displejem a menu podle režimu provozu.
 */
import { findPreset } from './radioComms.js';

export var SCREEN_STANDBY = 'standby';
export var SCREEN_MENU = 'menu';
export var SCREEN_STUB = 'stub';

var PRESET_SLOTS = 15;

var VOICE_MENU = [
    { id: 'voice_kety', label: 'ZÁZNAMNÍK KETŮ', action: 'stub' },
    { id: 'voice_channels', label: 'KANÁLY · AUTOSKEN · BEACON', action: 'submenu:presets' },
    { id: 'voice_sagis', label: 'DIAGNOSTIKA TERÉNU', action: 'stub' },
    { id: 'voice_settings', label: 'SYSTÉMOVÉ NASTAVENÍ', action: 'stub' }
];

var TEXT_MENU = [
    { id: 'text_messages', label: 'TEXTOVÉ ZPRÁVY', action: 'stub' },
    { id: 'text_channels', label: 'KANÁLY · AUTOSKEN · BEACON', action: 'submenu:presets' },
    { id: 'text_templates', label: 'RYCHLÉ ŠABLONY / KÓDY', action: 'stub' },
    { id: 'text_settings', label: 'SYSTÉMOVÉ NASTAVENÍ', action: 'stub' }
];

var PRESET_ACTION_ITEMS = [
    { id: 'preset_select', label: 'VYBRAT', action: 'apply_preset' },
    { id: 'preset_edit', label: 'UPRAVIT NÁZEV', action: 'preset_edit' },
    { id: 'preset_reset', label: 'RESETOVAT', action: 'preset_reset' }
];

var MENU_LINES = 4;

export function createRadioOsState() {
    return {
        screen: SCREEN_STANDBY,
        menuPath: [],
        focusIndex: 0,
        selectedSlot: null,
        stubTitle: ''
    };
}

export function resetRadioOs(os) {
    if (!os) return createRadioOsState();
    os.screen = SCREEN_STANDBY;
    os.menuPath = [];
    os.focusIndex = 0;
    os.selectedSlot = null;
    os.stubTitle = '';
    return os;
}

export function getMenuItems(operatingMode) {
    return operatingMode === 'text' ? TEXT_MENU : VOICE_MENU;
}

function menuRootLabel(operatingMode) {
    return operatingMode === 'text' ? 'TEXT' : 'VOICE';
}

function clampFocus(index, count) {
    if (count <= 0) return 0;
    if (index < 0) return 0;
    if (index >= count) return count - 1;
    return index;
}

function presetSlotLabel(slot, radioState) {
    var p = radioState ? findPreset(radioState, slot) : null;
    if (p && p.label) return slot + ' ' + p.label;
    return slot + ' PRÁZDNÝ';
}

function buildPresetSlotItems(radioState) {
    var items = [];
    var slot;
    for (slot = 1; slot <= PRESET_SLOTS; slot++) {
        items.push({
            id: 'preset_' + slot,
            slot: slot,
            label: presetSlotLabel(slot, radioState),
            action: 'preset_pick'
        });
    }
    return items;
}

/** 15 presetů + ruční frekvence / šifra / autosken / beacon. */
function buildPresetMenuItems(radioState) {
    var items = buildPresetSlotItems(radioState);
    items.push({ id: 'manual_freq', label: 'RUČNÍ FREKVENCE', action: 'freq_edit' });
    items.push({ id: 'manual_key', label: 'RUČNÍ ŠIFRA', action: 'key_edit' });
    items.push({ id: 'autoscan', label: 'AUTOSKEN', action: 'stub' });
    items.push({ id: 'beacon', label: 'NOUZOVÝ BEACON', action: 'stub' });
    return items;
}

function getCurrentMenuItems(os, operatingMode, radioState) {
    if (!os.menuPath.length) return getMenuItems(operatingMode);
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return buildPresetMenuItems(radioState);
    if (leaf === 'preset_actions') return PRESET_ACTION_ITEMS;
    return getMenuItems(operatingMode);
}

function menuStatusLabel(os, operatingMode, radioState) {
    if (!os.menuPath.length) return 'MENU · ' + menuRootLabel(operatingMode);
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return 'KANÁLY · ' + menuRootLabel(operatingMode);
    if (leaf === 'preset_actions' && os.selectedSlot) {
        return presetSlotLabel(os.selectedSlot, radioState);
    }
    return 'MENU · ' + menuRootLabel(operatingMode);
}

/**
 * @returns {{ changed: boolean, effect?: string, slot?: number }}
 */
export function radioOsHandleInput(os, operatingMode, action, radioState) {
    if (!os || operatingMode === 'off') return { changed: false };

    if (action === 'open_menu') {
        if (os.screen !== SCREEN_STANDBY) return { changed: false };
        os.screen = SCREEN_MENU;
        os.menuPath = [];
        os.focusIndex = 0;
        os.selectedSlot = null;
        return { changed: true };
    }

    if (os.screen === SCREEN_STANDBY) {
        return { changed: false };
    }

    if (action === 'back') {
        if (os.screen === SCREEN_STUB) {
            os.screen = SCREEN_MENU;
            os.stubTitle = '';
            return { changed: true };
        }
        if (os.screen === SCREEN_MENU && os.menuPath.length) {
            var leaving = os.menuPath[os.menuPath.length - 1];
            var prevSlot = os.selectedSlot;
            os.menuPath.pop();
            if (leaving === 'preset_actions') {
                os.focusIndex = prevSlot ? prevSlot - 1 : 0;
                os.selectedSlot = null;
            } else {
                os.focusIndex = 0;
            }
            return { changed: true };
        }
        if (os.screen === SCREEN_MENU) {
            resetRadioOs(os);
            return { changed: true };
        }
        return { changed: false };
    }

    if (os.screen === SCREEN_MENU) {
        var items = getCurrentMenuItems(os, operatingMode, radioState);
        if (action === 'up') {
            os.focusIndex = clampFocus(os.focusIndex - 1, items.length);
            return { changed: true };
        }
        if (action === 'down') {
            os.focusIndex = clampFocus(os.focusIndex + 1, items.length);
            return { changed: true };
        }
        if (action === 'ok') {
            var item = items[os.focusIndex];
            if (!item) return { changed: false };
            if (item.action === 'submenu:presets') {
                os.menuPath.push('presets');
                os.focusIndex = 0;
                return { changed: true };
            }
            if (item.action === 'preset_pick') {
                os.selectedSlot = item.slot;
                os.menuPath.push('preset_actions');
                os.focusIndex = 0;
                return { changed: true };
            }
            if (item.action === 'freq_edit') {
                resetRadioOs(os);
                return { changed: true, effect: 'freq_edit' };
            }
            if (item.action === 'key_edit') {
                resetRadioOs(os);
                return { changed: true, effect: 'key_edit' };
            }
            if (item.action === 'apply_preset') {
                var selectSlot = os.selectedSlot;
                resetRadioOs(os);
                return { changed: true, effect: 'apply_preset', slot: selectSlot };
            }
            if (item.action === 'preset_edit') {
                var editSlot = os.selectedSlot;
                resetRadioOs(os);
                return { changed: true, effect: 'preset_edit', slot: editSlot };
            }
            if (item.action === 'preset_reset') {
                var resetSlot = os.selectedSlot;
                os.menuPath.pop();
                os.focusIndex = resetSlot ? resetSlot - 1 : 0;
                os.selectedSlot = null;
                return { changed: true, effect: 'preset_reset', slot: resetSlot };
            }
            os.stubTitle = item.label;
            os.screen = SCREEN_STUB;
            return { changed: true };
        }
        return { changed: false };
    }

    return { changed: false };
}

/**
 * @returns {{ mode: string, status?: string, lines?: string[], footer?: string }}
 */
export function buildOsDisplayLines(os, operatingMode, standby, radioState) {
    standby = standby || {};

    if (operatingMode === 'off') {
        return { mode: 'off' };
    }

    if (!os || os.screen === SCREEN_STANDBY) {
        return {
            mode: 'standby',
            status: standby.status,
            lines: [
                standby.line1 || '',
                standby.line2 || '',
                standby.line3 || '',
                standby.line4 || ''
            ],
            footer: standby.footer || '',
            buffer: standby.buffer || ''
        };
    }

    if (os.screen === SCREEN_STUB) {
        return {
            mode: 'stub',
            status: 'MENU · ' + menuRootLabel(operatingMode),
            lines: [
                os.stubTitle || '—',
                '',
                '— brzy —',
                ''
            ],
            footer: 'OK · Zpět'
        };
    }

    var items = getCurrentMenuItems(os, operatingMode, radioState);
    var lines = [];
    var start = 0;
    if (os.focusIndex >= MENU_LINES) {
        start = os.focusIndex - MENU_LINES + 1;
    }
    if (start + MENU_LINES > items.length) {
        start = Math.max(0, items.length - MENU_LINES);
    }

    for (var i = 0; i < MENU_LINES; i++) {
        var idx = start + i;
        if (idx >= items.length) {
            lines.push('');
            continue;
        }
        var prefix = idx === os.focusIndex ? '▶ ' : '  ';
        lines.push(prefix + items[idx].label);
    }

    return {
        mode: 'menu',
        status: menuStatusLabel(os, operatingMode, radioState),
        lines: lines,
        footer: 'OK · Zpět',
        buffer: ''
    };
}

export function isRadioOsActive(os) {
    return !!(os && os.screen && os.screen !== SCREEN_STANDBY);
}
