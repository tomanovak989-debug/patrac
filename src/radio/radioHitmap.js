/**
 * SECTOR-TECH — pixelové hitboxy vůči PNG 800×800.
 */
var SRC = 800;

function pct(x, y, w, h) {
    return {
        left: (x / SRC * 100).toFixed(4) + '%',
        top: (y / SRC * 100).toFixed(4) + '%',
        width: (w / SRC * 100).toFixed(4) + '%',
        height: (h / SRC * 100).toFixed(4) + '%'
    };
}

function applyRect(el, x, y, w, h) {
    if (!el) return;
    var r = pct(x, y, w, h);
    el.style.left = r.left;
    el.style.top = r.top;
    el.style.width = r.width;
    el.style.height = r.height;
}

export function applyRadioHitmap() {
    var screen = document.getElementById('radio-display-screen');
    applyRect(screen, 323, 333, 154, 207);

    var dpad = document.getElementById('radio-dpad-zone');
    applyRect(dpad, 361, 568, 77, 64);

    applyRect(document.querySelector('[data-key="p1"]'), 315, 568, 46, 32);
    applyRect(document.getElementById('radio-key-ent'), 315, 600, 46, 37);
    applyRect(document.querySelector('[data-key="p2"]'), 438, 568, 46, 32);
    applyRect(document.getElementById('radio-key-clr'), 438, 600, 46, 37);

    applyRect(document.getElementById('radio-key-mode'), 300, 200, 48, 55);
    applyRect(document.getElementById('radio-key-preset-dial'), 373, 174, 44, 79);
    applyRect(document.getElementById('radio-key-main-dial'), 524, 310, 26, 228);

    var cols = [315, 376, 437];
    var rows = [
        { y: 637, h: 36, keys: ['1', '2', '3'] },
        { y: 673, h: 38, keys: ['4', '5', '6'] },
        { y: 711, h: 39, keys: ['7', '8', '9'] },
        { y: 750, h: 36, keys: ['*', '0', '#'] }
    ];
    var w = 61;
    for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        for (var ci = 0; ci < row.keys.length; ci++) {
            applyRect(
                document.querySelector('.radio-key[data-key="' + row.keys[ci] + '"]'),
                cols[ci],
                row.y,
                w,
                row.h
            );
        }
    }
}
