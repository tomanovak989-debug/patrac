/**
 * OS vysílačky SECTOR-TECH — navigace displejem a menu podle režimu provozu.
 * OS-0: STANDBY, kořen menu VOICE/TEXT, stub podmenu.
 */

export var SCREEN_STANDBY = 'standby';
export var SCREEN_MENU = 'menu';
export var SCREEN_STUB = 'stub';

var VOICE_MENU = [
    { id: 'voice_kety', label: 'ZÁZNAMNÍK KETŮ' },
    { id: 'voice_channels', label: 'KANÁLY · AUTOSKEN · BEACON' },
    { id: 'voice_sagis', label: 'DIAGNOSTIKA TERÉNU' },
    { id: 'voice_settings', label: 'SYSTÉMOVÉ NASTAVENÍ' }
];

var TEXT_MENU = [
    { id: 'text_messages', label: 'TEXTOVÉ ZPRÁVY' },
    { id: 'text_channels', label: 'KANÁLY · AUTOSKEN · BEACON' },
    { id: 'text_templates', label: 'RYCHLÉ ŠABLONY / KÓDY' },
    { id: 'text_settings', label: 'SYSTÉMOVÉ NASTAVENÍ' }
];

var MENU_LINES = 4;

export function createRadioOsState() {
    return {
        screen: SCREEN_STANDBY,
        menuRoot: 'voice',
        focusIndex: 0,
        stubTitle: ''
    };
}

export function resetRadioOs(os) {
    if (!os) return createRadioOsState();
    os.screen = SCREEN_STANDBY;
    os.focusIndex = 0;
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

/**
 * @returns {boolean} true pokud došlo ke změně stavu
 */
export function radioOsHandleInput(os, operatingMode, action) {
    if (!os || operatingMode === 'off') return false;

    if (action === 'open_menu') {
        if (os.screen !== SCREEN_STANDBY) return false;
        os.screen = SCREEN_MENU;
        os.menuRoot = operatingMode === 'text' ? 'text' : 'voice';
        os.focusIndex = 0;
        return true;
    }

    if (os.screen === SCREEN_STANDBY) {
        return false;
    }

    if (action === 'back') {
        if (os.screen === SCREEN_STUB) {
            os.screen = SCREEN_MENU;
            os.stubTitle = '';
            return true;
        }
        if (os.screen === SCREEN_MENU) {
            resetRadioOs(os);
            return true;
        }
        return false;
    }

    if (os.screen === SCREEN_MENU) {
        var items = getMenuItems(operatingMode);
        if (action === 'up') {
            os.focusIndex = clampFocus(os.focusIndex - 1, items.length);
            return true;
        }
        if (action === 'down') {
            os.focusIndex = clampFocus(os.focusIndex + 1, items.length);
            return true;
        }
        if (action === 'ok') {
            var item = items[os.focusIndex];
            if (!item) return false;
            os.stubTitle = item.label;
            os.screen = SCREEN_STUB;
            return true;
        }
        /* ← → zatím bez akce v seznamech (OS-0) */
        return false;
    }

    if (os.screen === SCREEN_STUB) {
        if (action === 'ok' || action === 'up' || action === 'down') {
            return false;
        }
    }

    return false;
}

/**
 * Vykreslí obsah displeje podle OS stavu.
 * @returns {{ mode: string, status?: string, lines?: string[], footer?: string }}
 */
export function buildOsDisplayLines(os, operatingMode, standby) {
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

    var items = getMenuItems(operatingMode);
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
        status: 'MENU · ' + menuRootLabel(operatingMode),
        lines: lines,
        footer: 'OK · Zpět',
        buffer: ''
    };
}

export function isRadioOsActive(os) {
    return !!(os && os.screen && os.screen !== SCREEN_STANDBY);
}
