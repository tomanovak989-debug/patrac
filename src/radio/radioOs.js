/**
 * OS vysílačky SECTOR-TECH — menu podle režimu VOICE / TEXT.
 */
import { findPreset, upsertPreset, clearPreset } from './radioComms.js';

export var SCREEN_STANDBY = 'standby';
export var SCREEN_MENU = 'menu';
export var SCREEN_STUB = 'stub';

var PRESET_SLOTS = 15;
var MENU_LINES = 6;

var VOICE_MENU = [
    { id: 'voice_sms', label: '1 · SMS / PTT', action: 'stub' },
    { id: 'voice_presets', label: '2 · PRESETY', action: 'submenu:presets' },
    { id: 'voice_autoscan', label: '3 · AUTOSKEN', action: 'stub' },
    { id: 'voice_beacon', label: '4 · BEACON', action: 'stub' },
    { id: 'voice_templates', label: '5 · ŠABLONY', action: 'stub' },
    { id: 'voice_settings', label: '6 · NASTAVENÍ', action: 'stub' }
];

var TEXT_MENU = [
    { id: 'text_sms', label: '1 · SMS / ZPRÁVY', action: 'stub' },
    { id: 'text_presets', label: '2 · PRESETY', action: 'submenu:presets' },
    { id: 'text_autoscan', label: '3 · AUTOSKEN', action: 'stub' },
    { id: 'text_beacon', label: '4 · BEACON', action: 'stub' },
    { id: 'text_templates', label: '5 · ŠABLONY', action: 'stub' },
    { id: 'text_settings', label: '6 · NASTAVENÍ', action: 'stub' }
];

export function createRadioOsState() {
    return {
        screen: SCREEN_STANDBY,
        menuPath: [],
        focusIndex: 0,
        selectedSlot: null,
        presetFieldFocus: 0,
        stubTitle: ''
    };
}

export function resetRadioOs(os) {
    if (!os) return createRadioOsState();
    os.screen = SCREEN_STANDBY;
    os.menuPath = [];
    os.focusIndex = 0;
    os.selectedSlot = null;
    os.presetFieldFocus = 0;
    os.stubTitle = '';
    return os;
}

export function isRadioOsActive(os) {
    return !!(os && os.screen && os.screen !== SCREEN_STANDBY);
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

export function presetSlotLabel(slot, radioState) {
    var p = radioState ? findPreset(radioState, slot) : null;
    if (p && p.label) return slot + ' ' + p.label;
    return slot + ' PRÁZDNÝ';
}

export function createPresetDraft(slot, radioState) {
    var p = radioState ? findPreset(radioState, slot) : null;
    return {
        slot: slot,
        label: p ? (p.label || ('Kanál ' + slot)) : ('Kanál ' + slot),
        frequency: p ? (p.frequency || radioState.frequency) : (radioState.frequency || '462.000'),
        encryptionKey: p ? (p.encryptionKey || '') : (radioState.encryptionKey || '')
    };
}

function buildPresetSlotItems(radioState) {
    var items = [];
    var slot;
    for (slot = 1; slot <= PRESET_SLOTS; slot++) {
        items.push({
            id: 'preset_' + slot,
            slot: slot,
            label: presetSlotLabel(slot, radioState),
            action: 'preset_detail'
        });
    }
    return items;
}

function getCurrentMenuItems(os, operatingMode, radioState) {
    if (!os.menuPath.length) return getMenuItems(operatingMode);
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return buildPresetSlotItems(radioState);
    return getMenuItems(operatingMode);
}

function menuStatusLabel(os, operatingMode, radioState, draft) {
    if (!os.menuPath.length) return 'MENU · ' + menuRootLabel(operatingMode);
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return 'PRESETY · ' + menuRootLabel(operatingMode);
    if (leaf === 'detail' && draft) return 'P' + draft.slot + ' · PRESET';
    return 'MENU · ' + menuRootLabel(operatingMode);
}

function buildPresetDetailLines(os, draft) {
    if (!draft) return ['', '', '', '', '', ''];
    var name = draft.label || ('Kanál ' + draft.slot);
    var freq = draft.frequency || '---.---';
    var key = draft.encryptionKey ? draft.encryptionKey : '—';
    var f = os.presetFieldFocus;
    return [
        (f === 0 ? '▶ ' : '  ') + 'NÁZEV  ' + name,
        (f === 1 ? '▶ ' : '  ') + 'F       ' + freq,
        (f === 2 ? '▶ ' : '  ') + 'ŠIFRA   ' + key,
        '',
        '',
        ''
    ];
}

/**
 * @returns {{ changed: boolean, effect?: string, slot?: number, field?: number }}
 */
export function radioOsHandleInput(os, operatingMode, action, radioState) {
    if (!os || operatingMode === 'off') return { changed: false };

    if (action === 'open_menu') {
        if (os.screen !== SCREEN_STANDBY) return { changed: false };
        os.screen = SCREEN_MENU;
        os.menuPath = [];
        os.focusIndex = 0;
        os.selectedSlot = null;
        os.presetFieldFocus = 0;
        return { changed: true };
    }

    if (os.screen === SCREEN_STANDBY) return { changed: false };

    if (action === 'back') {
        if (os.screen === SCREEN_STUB) {
            os.screen = SCREEN_MENU;
            os.stubTitle = '';
            return { changed: true };
        }
        if (os.menuPath[os.menuPath.length - 1] === 'detail') {
            var backSlot = os.selectedSlot;
            os.menuPath.pop();
            os.presetFieldFocus = 0;
            os.focusIndex = backSlot ? backSlot - 1 : 0;
            os.selectedSlot = null;
            return { changed: true, effect: 'preset_detail_back' };
        }
        if (os.screen === SCREEN_MENU && os.menuPath.length) {
            var prevSlot = os.selectedSlot;
            os.menuPath.pop();
            os.focusIndex = prevSlot ? prevSlot - 1 : 0;
            os.selectedSlot = null;
            return { changed: true };
        }
        if (os.screen === SCREEN_MENU) {
            resetRadioOs(os);
            return { changed: true };
        }
        return { changed: false };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'detail') {
        if (action === 'up') {
            os.presetFieldFocus = clampFocus(os.presetFieldFocus - 1, 3);
            return { changed: true };
        }
        if (action === 'down') {
            os.presetFieldFocus = clampFocus(os.presetFieldFocus + 1, 3);
            return { changed: true };
        }
        if (action === 'ok') {
            return {
                changed: true,
                effect: 'preset_field_edit',
                slot: os.selectedSlot,
                field: os.presetFieldFocus
            };
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
            if (item.action === 'preset_detail') {
                os.selectedSlot = item.slot;
                os.menuPath.push('detail');
                os.presetFieldFocus = 0;
                return { changed: true, effect: 'preset_detail_open', slot: item.slot };
            }
            os.stubTitle = item.label;
            os.screen = SCREEN_STUB;
            return { changed: true };
        }
        return { changed: false };
    }

    return { changed: false };
}

export function buildOsDisplayLines(os, operatingMode, standby, radioState, draft) {
    standby = standby || {};

    if (operatingMode === 'off') return { mode: 'off' };

    if (!os || os.screen === SCREEN_STANDBY) {
        return {
            mode: 'standby',
            status: standby.status,
            lines: [
                standby.line1 || '',
                standby.line2 || '',
                standby.line3 || '',
                standby.line4 || '',
                '',
                ''
            ],
            footer: standby.footer || '',
            buffer: standby.buffer || ''
        };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'detail' && draft) {
        return {
            mode: 'preset_detail',
            status: menuStatusLabel(os, operatingMode, radioState, draft),
            lines: buildPresetDetailLines(os, draft),
            footer: 'OK · edit · Zpět',
            buffer: ''
        };
    }

    if (os.screen === SCREEN_STUB) {
        return {
            mode: 'stub',
            status: 'MENU · ' + menuRootLabel(operatingMode),
            lines: [os.stubTitle || '—', '', '— brzy —', '', '', ''],
            footer: 'OK · Zpět'
        };
    }

    var items = getCurrentMenuItems(os, operatingMode, radioState);
    var lines = [];
    var start = 0;
    if (os.focusIndex >= MENU_LINES) start = os.focusIndex - MENU_LINES + 1;
    if (start + MENU_LINES > items.length) start = Math.max(0, items.length - MENU_LINES);

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
        status: menuStatusLabel(os, operatingMode, radioState, draft),
        lines: lines,
        footer: 'OK · Zpět',
        buffer: ''
    };
}

export function savePresetDraft(draft, radioState, ctx) {
    if (!draft || !radioState) return false;
    ctx = ctx || {};
    upsertPreset(radioState, draft.slot, {
        label: draft.label || ('Kanál ' + draft.slot),
        frequency: draft.frequency,
        encryptionKey: draft.encryptionKey || '',
        scope: ctx.scope || 'private'
    });
    return true;
}

export function resetPresetSlot(draft, radioState) {
    if (!draft) return;
    clearPreset(radioState, draft.slot);
}
