/**
 * OS vysílačky SECTOR-TECH — jednotné menu (SMS + PTT).
 */
import { findPreset, upsertPreset, clearPreset } from './radioComms.js';
import { buildAutoscanOsView } from './radioAutoscan.js';
import { buildCommsOsView } from './radioMessages.js';
import { buildBeaconOsView } from './radioBeacon.js';
import { buildSnakeOsView } from './radioSnake.js';
import { formatMenuDisplayLabel } from './radioShortcuts.js';
import { buildFixedCursorMenuLines, MENU_CURSOR_ROW, wrapMenuFocus } from './radioMenuScroll.js';
import { menuIconForItem } from './radioMenuIcons.js';
export var SCREEN_STANDBY = 'standby';
export var SCREEN_MENU = 'menu';
export var SCREEN_STUB = 'stub';

var PRESET_SLOTS = 15;

var RADIO_MENU = [
    { id: 'radio_comms', label: 'ZPRÁVY', action: 'screen:comms', shortcutAction: 'menu:comms' },
    { id: 'radio_presets', label: 'PRESETY', action: 'submenu:presets', shortcutAction: 'menu:presets' },
    { id: 'radio_autoscan', label: 'AUTOSKEN', action: 'screen:autoscan', shortcutAction: 'autoscan:start' },
    { id: 'radio_beacon', label: 'BEACON', action: 'screen:beacon', shortcutAction: 'beacon:open' },
    { id: 'radio_games', label: 'HRY', action: 'submenu:games', shortcutAction: 'menu:games' },
    { id: 'radio_settings', label: 'NASTAVENÍ', action: 'submenu:settings', shortcutAction: 'menu:settings' }
];

var GAMES_MENU = [
    { id: 'game_snake', label: 'SNAKE', action: 'screen:snake', shortcutAction: 'snake:open' }
];

var SETTINGS_MENU = [
    { id: 'settings_sounds', label: 'ZVUKY', action: 'submenu:sounds' },
    { id: 'settings_quickkeys', label: 'RYCHLÉ VOLBY', action: 'submenu:quickkeys' }
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
    if (p && p.label) return p.label;
    return 'Prázdný kanál';
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
            label: slot + ' · ' + presetSlotLabel(slot, radioState),
            action: 'preset_detail',
            shortcutAction: 'preset:' + slot
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
    var items = [];
    var i;
    for (i = 0; i < SOUND_FIELDS.length; i++) {
        var field = SOUND_FIELDS[i];
        items.push(SOUND_LABELS[field] + '   ' + prefs[field]);
    }
    return buildFixedCursorMenuLines(items, os.soundFieldFocus, function(item) { return item; });
}

function getCurrentMenuItems(os, radioState) {
    if (!os.menuPath.length) return getMenuItems();
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return buildPresetSlotItems(radioState);
    if (leaf === 'settings') return SETTINGS_MENU;
    if (leaf === 'games') return GAMES_MENU;
    return getMenuItems();
}

function menuStatusLabel(os, radioState, draft) {
    if (!os.menuPath.length) return 'MENU';
    var leaf = os.menuPath[os.menuPath.length - 1];
    if (leaf === 'presets') return 'PRESETY';
    if (leaf === 'detail' && draft) return 'P' + draft.slot + ' · PRESET';
    if (leaf === 'settings') return 'NASTAVENÍ';
    if (leaf === 'games') return 'HRY';
    if (leaf === 'sounds') return 'ZVUKY · NASTAVENÍ';
    if (leaf === 'quickkeys') return 'RYCHLÉ VOLBY';
    if (leaf === 'autoscan') return 'AUTOSKEN';
    if (leaf === 'comms') return 'ZPRÁVY';
    if (leaf === 'snake') return 'SNAKE';
    return 'MENU';
}

function buildQuickKeysHelpLines(radioState) {
    radioState = radioState || {};
    var keys = radioState.quickKeys || {};
    var lines = [
        'Podrž 1–9/P1/P2',
        'z úvodní obrazovky',
        '= rychlá volba',
        '',
        '',
        ''
    ];
    var ids = ['p1', 'p2', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    var row = 2;
    var i;
    for (i = 0; i < ids.length && row < 6; i++) {
        var b = keys[ids[i]];
        if (!b) continue;
        lines[row] = ids[i].toUpperCase() + '→' + String(b.label || b.action).slice(0, 14);
        row++;
    }
    return lines;
}

function decorateItemLabel(item) {
    if (!item) return '';
    return formatMenuDisplayLabel(item.label || '');
}

export function getFocusedMenuItem(os, radioState) {
    var items = getCurrentMenuItems(os, radioState);
    return items[os.focusIndex] || null;
}

/** @returns {{ changed: boolean, effect?: string, slot?: number, field?: number }} */
export function executeMenuDigit(os, radioState, digit) {
    if (!os || !digit) return { changed: false };
    digit = String(digit);
    var items = getCurrentMenuItems(os, radioState);
    var leaf = os.menuPath[os.menuPath.length - 1];

    if (leaf === 'presets') {
        var slot = parseInt(digit, 10);
        if (!slot || slot < 1 || slot > 15) return { changed: false };
        os.selectedSlot = slot;
        os.menuPath.push('detail');
        os.presetFieldFocus = 0;
        os.focusIndex = slot - 1;
        return { changed: true, effect: 'preset_detail_open', slot: slot };
    }

    if (leaf === 'settings') {
        var settingIdx = parseInt(digit, 10) - 1;
        if (settingIdx === 0) {
            os.menuPath.push('sounds');
            os.soundFieldFocus = 0;
            os.focusIndex = 0;
            return { changed: true };
        }
        if (settingIdx === 1) {
            os.menuPath.push('quickkeys');
            os.focusIndex = 0;
            return { changed: true };
        }
        return { changed: false };
    }

    if (leaf === 'games') {
        var gameIdx = parseInt(digit, 10) - 1;
        if (gameIdx === 0) {
            os.menuPath.push('snake');
            return { changed: true, effect: 'snake_open' };
        }
        return { changed: false };
    }

    if (leaf === 'sounds') {
        var soundIdx = parseInt(digit, 10) - 1;
        if (soundIdx >= 0 && soundIdx < SOUND_FIELDS.length) {
            os.soundFieldFocus = soundIdx;
            return { changed: true };
        }
        return { changed: false };
    }

    if (leaf === 'detail') {
        var fieldIdx = parseInt(digit, 10) - 1;
        if (fieldIdx >= 0 && fieldIdx < 3) {
            os.presetFieldFocus = fieldIdx;
            return { changed: true };
        }
        return { changed: false };
    }

    if (!os.menuPath.length) {
        var idx = parseInt(digit, 10) - 1;
        if (idx < 0 || idx >= items.length) return { changed: false };
        os.focusIndex = idx;
        return radioOsHandleInput(os, radioState.operatingMode || 'on', 'ok', radioState);
    }

    return { changed: false };
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
        if (os.menuPath[os.menuPath.length - 1] === 'quickkeys') {
            os.menuPath.pop();
            os.focusIndex = 0;
            return { changed: true };
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
        if (os.menuPath[os.menuPath.length - 1] === 'beacon') {
            os.menuPath.pop();
            return { changed: true, effect: 'beacon_close' };
        }
        if (os.menuPath[os.menuPath.length - 1] === 'comms') {
            return { changed: true, effect: 'comms_back' };
        }
        if (os.menuPath[os.menuPath.length - 1] === 'snake') {
            os.menuPath.pop();
            return { changed: true, effect: 'snake_close' };
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

    if (os.menuPath[os.menuPath.length - 1] === 'snake') {
        if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
            return { changed: true, effect: 'snake_dir', dir: action };
        }
        if (action === 'ok') return { changed: true, effect: 'snake_ok' };
        return { changed: false };
    }

    if (action === 'left') {
        return radioOsHandleInput(os, operatingMode, 'back', radioState);
    }

    if (os.menuPath[os.menuPath.length - 1] === 'autoscan') {
        if (action === 'ok' || action === 'right') return { changed: true, effect: 'autoscan_ok' };
        return { changed: false };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'beacon') {
        if (action === 'up') return { changed: true, effect: 'beacon_up' };
        if (action === 'down') return { changed: true, effect: 'beacon_down' };
        if (action === 'ok' || action === 'right') return { changed: true, effect: 'beacon_ok' };
        return { changed: false };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'comms') {
        if (action === 'up') return { changed: true, effect: 'comms_up' };
        if (action === 'down') return { changed: true, effect: 'comms_down' };
        if (action === 'left') return { changed: true, effect: 'comms_back' };
        if (action === 'ok' || action === 'right') return { changed: true, effect: 'comms_ok' };
        return { changed: false };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'sounds') {
        if (action === 'up') {
            os.soundFieldFocus = wrapMenuFocus(os.soundFieldFocus, SOUND_FIELDS.length, -1);
            return { changed: true };
        }
        if (action === 'down') {
            os.soundFieldFocus = wrapMenuFocus(os.soundFieldFocus, SOUND_FIELDS.length, 1);
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
            os.presetFieldFocus = wrapMenuFocus(os.presetFieldFocus, 3, -1);
            return { changed: true };
        }
        if (action === 'down') {
            os.presetFieldFocus = wrapMenuFocus(os.presetFieldFocus, 3, 1);
            return { changed: true };
        }
        if (action === 'ok' || action === 'right') {
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
        var menuItems = getCurrentMenuItems(os, radioState);
        if (action === 'up') {
            os.focusIndex = wrapMenuFocus(os.focusIndex, menuItems.length, -1);
            return { changed: true };
        }
        if (action === 'down') {
            os.focusIndex = wrapMenuFocus(os.focusIndex, menuItems.length, 1);
            return { changed: true };
        }
        if (action === 'ok' || action === 'right') {
            var pick = menuItems[os.focusIndex];
            if (!pick) return { changed: false };
            if (pick.action === 'submenu:presets') {
                os.menuPath.push('presets');
                os.focusIndex = 0;
                return { changed: true };
            }
            if (pick.action === 'submenu:settings') {
                os.menuPath.push('settings');
                os.focusIndex = 0;
                return { changed: true };
            }
            if (pick.action === 'submenu:games') {
                os.menuPath.push('games');
                os.focusIndex = 0;
                return { changed: true };
            }
            if (pick.action === 'submenu:sounds') {
                os.menuPath.push('sounds');
                os.soundFieldFocus = 0;
                return { changed: true };
            }
            if (pick.action === 'submenu:quickkeys') {
                os.menuPath.push('quickkeys');
                return { changed: true };
            }
            if (pick.action === 'screen:autoscan') {
                os.menuPath.push('autoscan');
                return { changed: true, effect: 'autoscan_open' };
            }
            if (pick.action === 'screen:comms') {
                os.menuPath.push('comms');
                return { changed: true, effect: 'comms_open' };
            }
            if (pick.action === 'screen:beacon') {
                os.menuPath.push('beacon');
                return { changed: true, effect: 'beacon_open' };
            }
            if (pick.action === 'screen:snake') {
                os.menuPath.push('snake');
                return { changed: true, effect: 'snake_open' };
            }
            if (pick.action === 'preset_detail') {
                os.selectedSlot = pick.slot;
                os.menuPath.push('detail');
                os.presetFieldFocus = 0;
                return { changed: true, effect: 'preset_detail_open', slot: pick.slot };
            }
            os.stubTitle = pick.label;
            os.screen = SCREEN_STUB;
            return { changed: true };
        }
        return { changed: false };
    }

    return { changed: false };
}

export function buildOsDisplayLines(os, operatingMode, standby, radioState, draft, autoscanSession, commsSession, notebook, beaconSession, localBeacon, beaconUiState, snakeSession) {
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
        var presetView = buildFixedCursorMenuLines([
            'NÁZEV  ' + (draft.label || ('Kanál ' + draft.slot)),
            'F       ' + (draft.frequency || '---.---'),
            'ŠIFRA   ' + (draft.encryptionKey ? draft.encryptionKey : '—')
        ], os.presetFieldFocus, function(item) { return item; });
        presetView.mode = 'preset_detail';
        presetView.status = menuStatusLabel(os, radioState, draft);
        presetView.footer = 'OK · OK · Zpět';
        presetView.buffer = '';
        return presetView;
    }

    if (os.menuPath[os.menuPath.length - 1] === 'sounds') {
        var soundView = buildSoundSettingsLines(os, radioState);
        soundView.mode = 'sound_settings';
        soundView.status = menuStatusLabel(os, radioState, draft);
        soundView.focusLine = MENU_CURSOR_ROW;
        soundView.footer = '←→ varianta · Zpět';
        soundView.buffer = '';
        return soundView;
    }

    if (os.menuPath[os.menuPath.length - 1] === 'quickkeys') {
        return {
            mode: 'quickkeys',
            status: menuStatusLabel(os, radioState, draft),
            lines: buildQuickKeysHelpLines(radioState),
            focusLine: -1,
            footer: 'Zpět',
            buffer: ''
        };
    }

    if (os.menuPath[os.menuPath.length - 1] === 'autoscan') {
        return buildAutoscanOsView(autoscanSession, radioState, notebook);
    }

    if (os.menuPath[os.menuPath.length - 1] === 'comms') {
        return buildCommsOsView(commsSession, notebook, radioState);
    }

    if (os.menuPath[os.menuPath.length - 1] === 'beacon') {
        return buildBeaconOsView(beaconSession, radioState, localBeacon, beaconUiState);
    }

    if (os.menuPath[os.menuPath.length - 1] === 'snake') {
        return buildSnakeOsView(snakeSession);
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
    var menuView = buildFixedCursorMenuLines(items, os.focusIndex, function(item) {
        return decorateItemLabel(item);
    }, function(item) {
        return menuIconForItem(item);
    });

    return {
        mode: 'menu',
        status: menuStatusLabel(os, radioState, draft),
        lines: menuView.lines,
        focusLine: menuView.focusLine,
        lineStyles: menuView.lineStyles,
        lineIcons: menuView.lineIcons,
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
