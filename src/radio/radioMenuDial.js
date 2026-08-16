/**
 * Sekvenční navigace menu čísly — buffer se potvrdí OK (ne okamžitě po číslici).
 */
import { getMenuItems } from './radioOs.js';

export function createMenuDialState() {
    return { buffer: '' };
}

export function appendMenuDialDigit(dial, digit) {
    if (!dial) return '';
    digit = String(digit || '').replace(/\D/g, '');
    if (!digit) return dial.buffer || '';
    if ((dial.buffer || '').length >= 6) return dial.buffer;
    dial.buffer = (dial.buffer || '') + digit;
    return dial.buffer;
}

export function clearMenuDial(dial) {
    if (!dial) return;
    dial.buffer = '';
}

export function menuDialPreview(dial) {
    var b = dial && dial.buffer ? dial.buffer : '';
    return b ? ('▸ ' + b) : '';
}

/**
 * @returns {{ steps: Array<{type:string, value?:number, action?:string}>, consumed: number }}
 */
function parsePathForContext(path, menuPath) {
    path = String(path || '');
    var steps = [];
    var leaf = menuPath && menuPath.length ? menuPath[menuPath.length - 1] : '';

    if (!menuPath || !menuPath.length) {
        if (!path.length) return { steps: steps, rest: '' };
        var rootIdx = parseInt(path.charAt(0), 10);
        if (!rootIdx) return { steps: steps, rest: path };
        steps.push({ type: 'root', value: rootIdx });
        return { steps: steps, rest: path.slice(1) };
    }

    if (leaf === 'presets') {
        var slot = parseInt(path, 10);
        if (slot >= 1 && slot <= 15) steps.push({ type: 'preset_slot', value: slot });
        return { steps: steps, rest: '' };
    }

    if (leaf === 'comms') {
        var hub = parseInt(path.charAt(0), 10);
        if (hub >= 1 && hub <= 4) steps.push({ type: 'comms_hub', value: hub });
        return { steps: steps, rest: path.slice(1) };
    }

    if (leaf === 'settings') {
        var s = parseInt(path.charAt(0), 10);
        if (s >= 1) steps.push({ type: 'settings', value: s });
        return { steps: steps, rest: path.slice(1) };
    }

    return { steps: steps, rest: path };
}

export function planMenuDialCommit(dial, os) {
    var path = dial && dial.buffer ? dial.buffer : '';
    if (!path || !os) return null;
    var allSteps = [];
    var remaining = path;
    var simulatedPath = (os.menuPath || []).slice();
    var guard = 0;

    while (remaining.length && guard++ < 8) {
        var parsed = parsePathForContext(remaining, simulatedPath);
        if (!parsed.steps.length) break;
        var i;
        for (i = 0; i < parsed.steps.length; i++) allSteps.push(parsed.steps[i]);
        remaining = parsed.rest;
        var last = parsed.steps[parsed.steps.length - 1];
        if (last.type === 'root') {
            var items = getMenuItems();
            var idx = last.value - 1;
            var item = items[idx];
            if (!item) break;
            if (item.action === 'submenu:presets') simulatedPath.push('presets');
            else if (item.action === 'submenu:settings') simulatedPath.push('settings');
            else if (item.action === 'screen:comms') simulatedPath.push('comms');
            else if (item.action === 'screen:autoscan') simulatedPath.push('autoscan');
            else break;
        } else break;
    }

    return allSteps.length ? { steps: allSteps, path: path } : null;
}
