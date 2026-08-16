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

/** Font displeje vysílačky — Bahnschrift na PC, Roboto Condensed z webu jinde. */
var RADIO_DISPLAY_FONT = "'Bahnschrift', 'Roboto Condensed', 'Segoe UI', sans-serif";

/** Font displeje v px — škáluje se s reálnou velikostí panelu (zoom vysílačky). */
export function applyDisplayTypography() {
    var screen = document.getElementById('radio-display-screen');
    if (!screen) return;
    var w = screen.clientWidth;
    var h = screen.clientHeight;
    if (w < 8 || h < 8) return;
    var innerW = Math.max(8, w - 10);
    var px = Math.min(innerW / 10.5, (h / 8) * 0.9);
    px = Math.max(9, Math.round(px * 10) / 10);
    screen.style.fontSize = px + 'px';
    screen.style.setProperty('font-family', RADIO_DISPLAY_FONT, 'important');
    screen.style.setProperty('font-weight', '600', 'important');
    screen.style.setProperty('font-stretch', 'semi-condensed', 'important');
    var nodes = screen.querySelectorAll('.radio-display-status, .radio-display-main, .radio-display-main > div, .radio-display-sub, .radio-edit-char, .radio-display-edit-large');
    for (var i = 0; i < nodes.length; i++) {
        nodes[i].style.setProperty('font-family', RADIO_DISPLAY_FONT, 'important');
        nodes[i].style.fontSize = 'inherit';
        nodes[i].style.setProperty('font-weight', '600', 'important');
        nodes[i].style.setProperty('font-stretch', 'semi-condensed', 'important');
    }
}

export function applyRadioHitmap() {
    var screen = document.getElementById('radio-display-screen');
    applyRect(screen, 321, 332, 156, 208);

    var dpad = document.getElementById('radio-dpad-zone');
    applyRect(dpad, 361, 568, 77, 64);

    applyRect(document.querySelector('[data-key="p1"]'), 315, 568, 46, 32);
    applyRect(document.getElementById('radio-key-ent'), 315, 600, 46, 37);
    applyRect(document.querySelector('[data-key="p2"]'), 438, 568, 46, 32);
    applyRect(document.getElementById('radio-key-clr'), 438, 600, 46, 37);

    applyRect(document.getElementById('radio-key-mode'), 300, 200, 48, 55);
    applyRect(document.getElementById('radio-key-preset-dial'), 373, 174, 44, 79);
    applyRect(document.getElementById('radio-key-main-dial'), 513, 310, 37, 228);

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
    requestAnimationFrame(applyDisplayTypography);
}
