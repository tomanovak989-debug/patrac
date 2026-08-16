/**
 * OS vysílačky SECTOR-TECH — jednotné menu (SMS + PTT).
 */
import { findPreset, upsertPreset, clearPreset } from './radioComms.js';
import { buildAutoscanOsView } from './radioAutoscan.js';
import { buildCommsOsView } from './radioMessages.js';

export var SCREEN_STANDBY = 'standby';
export var SCREEN_MENU = 'menu';
export var SCREEN_STUB = 'stub';

var PRESET_SLOTS = 15;
var MENU_LINES = 6;

var RADIO_MENU = [
    { id: 'radio_comms', label: '1 · SMS / PTT', action: 'screen:comms' },
    { id: 'radio_presets', label: '2 · PRESETY', action: 'submenu:presets' },
    { id: 'radio_autoscan', label: '3 · AUTOSKEN', action: 'screen:autoscan' },
    { id: 'radio_beacon', label: '4 · BEACON', action: 'stub' },
    { id: 'radio_templates', label: '5 · ŠABLONY', action: 'stub' },
    { id: 'radio_settings', label: '6 · NASTAVENÍ', action: 'submenu:settings' }
];

var SETTINGS_MENU = [
    { id: 'settings_sounds', label: 'ZVUKY', action: 'submenu:sounds' }
];

var SOUND_FIELDS = ['key', 'ring', 'message'];
var SOUND_LABELS = { key: 'KLÁVESY', ring: 'ZVONĚNÍ', message: 'ZPRÁVA' };

export function createRadioOsState() {
    return {
        screen: SCREEN_STANDBY,
        menuPath: [],
        focusIndex: 0,
        selectedSlot: null,
        presetFieldFocus: 0,
        soundFieldFocus: 0,
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
    os.soundFieldFocus = 0;
    os.stubTitle = '';
    return os;
}

export function isRadioOsActive(os) {
    return !!(os && os.screen && os.screen !== SCREEN_STANDBY);
}

export function getMenuItems() {
    return RADIO_MENU;
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

function getSoundPrefs(radioState) {
    var p = radioState && radioState.soundPrefs ? radioState.soundPrefs : {};
    return {
        key: clampSoundVariant(p.key),
        ring: clampSoundVariant(p.ring),
        message: clampSoundVariant(p.message)
    };
}

function clampSoundVariant(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < 1) return 1;
    if (n > 3) return 3;
    return n;
}

function cycleSoundPref(radioState, field, delta) {
    if (!radioState) return;
    if (!radioState.soundPrefs) radioState.soundPrefs = getSoundPrefs(radioState);
    var cur = clampSoundVariant(radioState.soundPrefs[field]);
    cur = cur + delta;
    if (cur < 1) cur = 3;
    if (cur > 3) cur = 1;
    radioState.soundPrefs[field] = cur;
}

function buildSoundSettingsLines(os, radioState) {
    var prefs = getSoundPrefs(radioState);
    var lines = [];
    var i;
    for (i = 0; i < SOUND_FIELDS.length; i++) {
        var field = SOUND_FIELDS[i];
        lines.push(SOUND_LABELS[field] + '   ' + prefs[field]);
    }
    while (lines.length < 6) lines.push('');
    return lines;
}

function getCurrentMenuItems(os, radioState) {
    if (!os.menuPath.length) return getMenuItems();
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return buildPresetSlotItems(radioState);
    if (leaf === 'settings') return SETTINGS_MENU;
    return getMenuItems();
}

function menuStatusLabel(os, radioState, draft) {
    if (!os.menuPath.length) return 'MENU';
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return 'PRESETY';
    if (leaf === 'detail' && draft) return 'P' + draft.slot + ' · PRESET';
    if (leaf === 'settings') return 'NASTAVENÍ';
    if (leaf === 'sounds') return 'ZVUKY · NASTAVENÍ';
    if (leaf === 'autoscan') return 'AUTOSKEN';
    if (leaf === 'comms') return 'SMS / PTT';
    return 'MENU';
}

function buildPresetDetailLines(draft) {
    if (!draft) return ['', '', '', '', '', ''];
    var name = draft.label || ('Kanál ' + draft.slot);
    var freq = draft.frequency || '---.---';
    var key = draft.encryptionKey ? draft.encryptionKey : '—';
    return [
        'NÁZEV  ' + name,
        'F       ' + freq,
        'ŠIFRA   ' + key,
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
        if (os.menuPath[os.menuPath.length - 1] === 'sounds') {
            os.menuPath.pop();
            os.soundFieldFocus = 0;
            os.focusIndex = 0;
            return { changed: true, effect: 'sound_prefs_back' };
        }
        if (os.menuPath[os.menuPath.length - 1] === 'autoscan') {
            os.menuPath.pop();
            return { changed: true, effect: 'autoscan_close' };
        }
        if (os.menuPath[os.menuPath.length - 1] === 'comms') {
            return { changed: true, effect: 'comms_back' };
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

    if (os.menuPath[os.menuPath.length - 1] === 'autoscan') {
        if (action === 'ok') return { changed: true, effect: 'autoscan_ok' };
        return { changed: false };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'comms') {
        if (action === 'up' || action === 'left') return { changed: true, effect: 'comms_up' };
        if (action === 'down' || action === 'right') return { changed: true, effect: 'comms_down' };
        if (action === 'ok') return { changed: true, effect: 'comms_ok' };
        return { changed: false };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'sounds') {
        if (action === 'up') {
            os.soundFieldFocus = clampFocus(os.soundFieldFocus - 1, SOUND_FIELDS.length);
            return { changed: true };
        }
        if (action === 'down') {
            os.soundFieldFocus = clampFocus(os.soundFieldFocus + 1, SOUND_FIELDS.length);
            return { changed: true };
        }
        if (action === 'left' || action === 'right') {
            var dir = action === 'left' ? -1 : 1;
            var fld = SOUND_FIELDS[os.soundFieldFocus];
            cycleSoundPref(radioState, fld, dir);
            return { changed: true, effect: 'sound_preview', field: fld };
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
        var items = getCurrentMenuItems(os, radioState);
        if (action === 'up' || action === 'left') {
            os.focusIndex = clampFocus(os.focusIndex - 1, items.length);
            return { changed: true };
        }
        if (action === 'down' || action === 'right') {
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
            if (item.action === 'submenu:settings') {
                os.menuPath.push('settings');
                os.focusIndex = 0;
                return { changed: true };
            }
            if (item.action === 'submenu:sounds') {
                os.menuPath.push('sounds');
                os.soundFieldFocus = 0;
                return { changed: true };
            }
            if (item.action === 'screen:autoscan') {
                os.menuPath.push('autoscan');
                return { changed: true, effect: 'autoscan_open' };
            }
            if (item.action === 'screen:comms') {
                os.menuPath.push('comms');
                return { changed: true, effect: 'comms_open' };
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

export function buildOsDisplayLines(os, operatingMode, standby, radioState, draft, autoscanSession, commsSession, notebook) {
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
            buffer: ''
        };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'detail' && draft) {
        return {
            mode: 'preset_detail',
            status: menuStatusLabel(os, radioState, draft),
            lines: buildPresetDetailLines(draft),
            focusLine: os.presetFieldFocus,
            footer: 'OK · OK · Zpět',
            buffer: ''
        };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'sounds') {
        return {
            mode: 'sound_settings',
            status: menuStatusLabel(os, radioState, draft),
            lines: buildSoundSettingsLines(os, radioState),
            focusLine: os.soundFieldFocus,
            footer: '←→ varianta · Zpět',
            buffer: ''
        };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'autoscan') {
        return buildAutoscanOsView(autoscanSession, radioState);
    }

    if (os.menuPath[os.menuPath.length - 1] === 'comms') {
        return buildCommsOsView(commsSession, notebook, radioState);
    }

    if (os.screen === SCREEN_STUB) {
        return {
            mode: 'stub',
            status: 'MENU',
            lines: [os.stubTitle || '—', '', '— brzy —', '', '', ''],
            footer: 'OK · Zpět'
        };
    }

    var items = getCurrentMenuItems(os, radioState);
    var lines = [];
    var start = 0;
    if (os.focusIndex >= MENU_LINES) start = os.focusIndex - MENU_LINES + 1;
    if (start + MENU_LINES > items.length) start = Math.max(0, items.length - MENU_LINES);

    for (var i = 0; i < MENU_LINES; i++) {
        var idx = start + i;
        lines.push(idx < items.length ? items[idx].label : '');
    }

    return {
        mode: 'menu',
        status: menuStatusLabel(os, radioState, draft),
        lines: lines,
        focusLine: os.focusIndex - start,
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
