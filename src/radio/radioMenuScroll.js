/**
 * Menu s pevným kurzorem uprostřed displeje — ↑/↓ posouvá položky, ne kurzor.
 * Seznam vizuálně opakuje (nad první je poslední).
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
            var entry = labelFn(items[idx], idx);
            if (entry && typeof entry === 'object') {
                lines.push(entry.text || '');
                lineStyles.push(!!entry.bold);
            } else {
                lines.push(String(entry || ''));
                lineStyles.push(false);
            }
            lineIcons.push(iconFn ? iconFn(items[idx], idx) : null);
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
