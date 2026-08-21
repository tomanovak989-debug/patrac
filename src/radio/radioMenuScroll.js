/**
 * Menu s pevným kurzorem uprostřed displeje — ↑/↓ posouvá položky, ne kurzor.
 */
export var MENU_VISIBLE_LINES = 6;
export var MENU_CURSOR_ROW = 2;

export function clampMenuFocus(index, count) {
    if (count <= 0) return 0;
    if (index < 0) return 0;
    if (index >= count) return count - 1;
    return index;
}

/**
 * @param {Array} items
 * @param {number} focusIndex
 * @param {function(item, index): string|{text:string,bold?:boolean}} labelFn
 */
export function buildFixedCursorMenuLines(items, focusIndex, labelFn) {
    items = items || [];
    focusIndex = clampMenuFocus(focusIndex, items.length);
    var start = focusIndex - MENU_CURSOR_ROW;
    var lines = [];
    var lineStyles = [];
    var i;

    for (i = 0; i < MENU_VISIBLE_LINES; i++) {
        var idx = start + i;
        if (idx >= 0 && idx < items.length) {
            var entry = labelFn(items[idx], idx);
            if (entry && typeof entry === 'object') {
                lines.push(entry.text || '');
                lineStyles.push(!!entry.bold);
            } else {
                lines.push(String(entry || ''));
                lineStyles.push(false);
            }
        } else {
            lines.push('');
            lineStyles.push(false);
        }
    }

    return {
        lines: lines,
        lineStyles: lineStyles,
        focusLine: items.length ? MENU_CURSOR_ROW : -1
    };
}
