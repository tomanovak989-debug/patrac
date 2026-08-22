/**
 * Menu s pevným kurzorem uprostřed displeje — ↑/↓ posouvá položky, ne kurzor.
 * Seznam vizuálně opakuje (nad první je poslední).
 * buildBoundedCursorMenuLines — bez opakování (zprávy, delší seznamy).
 */
export var MENU_VISIBLE_LINES = 6;
export var MENU_CURSOR_ROW = 2;

export function clampMenuFocus(index, count) {
    if (count <= 0) return 0;
    if (index < 0) return 0;
    if (index >= count) return count - 1;
    return index;
}

/** Nekonečné menu — z poslední na první a naopak. */
export function wrapMenuFocus(index, count, delta) {
    if (count <= 0) return 0;
    return ((index + delta) % count + count) % count;
}

function wrapItemIndex(index, count) {
    if (count <= 0) return -1;
    return ((index % count) + count) % count;
}

function pushMenuLine(lines, lineStyles, lineIcons, entry, item, iconFn) {
    if (entry && typeof entry === 'object') {
        lines.push(entry.text || '');
        lineStyles.push(!!entry.bold);
    } else {
        lines.push(String(entry || ''));
        lineStyles.push(false);
    }
    lineIcons.push(iconFn ? iconFn(item) : null);
}

/**
 * @param {Array} items
 * @param {number} focusIndex
 * @param {function(item, index): string|{text:string,bold?:boolean}} labelFn
 * @param {function(item, index): string|null} [iconFn] — název souboru ikony
 */
export function buildFixedCursorMenuLines(items, focusIndex, labelFn, iconFn) {
    items = items || [];
    var count = items.length;
    focusIndex = clampMenuFocus(focusIndex, count);
    var lines = [];
    var lineStyles = [];
    var lineIcons = [];
    var i;

    for (i = 0; i < MENU_VISIBLE_LINES; i++) {
        var offset = i - MENU_CURSOR_ROW;
        var idx = count ? wrapItemIndex(focusIndex + offset, count) : -1;
        if (idx >= 0) {
            pushMenuLine(lines, lineStyles, lineIcons, labelFn(items[idx], idx), items[idx], iconFn);
        } else {
            lines.push('');
            lineStyles.push(false);
            lineIcons.push(null);
        }
    }

    return {
        lines: lines,
        lineStyles: lineStyles,
        lineIcons: lineIcons,
        focusLine: count ? MENU_CURSOR_ROW : -1
    };
}

/**
 * Pevný kurzor uprostřed — bez nekonečného wrapu; na okrajích se posouvá okno seznamu.
 */
export function buildBoundedCursorMenuLines(items, focusIndex, labelFn, iconFn) {
    items = items || [];
    var count = items.length;
    focusIndex = clampMenuFocus(focusIndex, count);
    var lines = [];
    var lineStyles = [];
    var lineIcons = [];
    var windowStart = 0;
    var i;

    if (count > MENU_VISIBLE_LINES) {
        var maxStart = count - MENU_VISIBLE_LINES;
        windowStart = focusIndex - MENU_CURSOR_ROW;
        if (windowStart < 0) windowStart = 0;
        if (windowStart > maxStart) windowStart = maxStart;
    }

    for (i = 0; i < MENU_VISIBLE_LINES; i++) {
        var idx = windowStart + i;
        if (idx >= 0 && idx < count) {
            pushMenuLine(lines, lineStyles, lineIcons, labelFn(items[idx], idx), items[idx], iconFn);
        } else {
            lines.push('');
            lineStyles.push(false);
            lineIcons.push(null);
        }
    }

    return {
        lines: lines,
        lineStyles: lineStyles,
        lineIcons: lineIcons,
        focusLine: count ? (focusIndex - windowStart) : -1
    };
}
