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

function getStageBox() {
    var stage = document.querySelector('.sector-tech-stage');
    if (!stage) return null;
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (w < 8 || h < 8) {
        var img = document.getElementById('sector-tech-img');
        if (img) {
            w = img.clientWidth || w;
            h = img.clientHeight || h;
        }
    }
    if (w < 8 || h < 8) return null;
    return { w: w, h: h };
}

function applyRect(el, x, y, w, h, stageBox) {
    if (!el) return;
    if (stageBox) {
        /* iOS: % výšky overlaye je 0, když rodič bere výšku z <img>. Pixely z fotky sedí. */
        el.style.left = (x / SRC * stageBox.w) + 'px';
        el.style.top = (y / SRC * stageBox.h) + 'px';
        el.style.width = (w / SRC * stageBox.w) + 'px';
        el.style.height = (h / SRC * stageBox.h) + 'px';
        return;
    }
    var r = pct(x, y, w, h);
    el.style.left = r.left;
    el.style.top = r.top;
    el.style.width = r.width;
    el.style.height = r.height;
}

var displayTypoRetries = 0;
var displayTypoTimer = null;

function isRadioTabActive() {
    return !!(document.body && document.body.classList.contains('radio-tab-active'));
}

export function resetDisplayTypography() {
    displayTypoRetries = 0;
    if (displayTypoTimer) {
        clearTimeout(displayTypoTimer);
        displayTypoTimer = null;
    }
    applyDisplayTypography();
}

/** Font displeje v px — škáluje se s reálnou velikostí panelu (zoom vysílačky). */
export function applyDisplayTypography() {
    if (!isRadioTabActive()) return;
    var screen = document.getElementById('radio-display-screen');
    if (!screen) return;
    var w = screen.clientWidth;
    var h = screen.clientHeight;
    if (w < 8 || h < 8) {
        applyRadioHitmap(true);
        w = screen.clientWidth;
        h = screen.clientHeight;
    }
    if (w < 8 || h < 8) {
        if (!isRadioTabActive()) return;
        if (displayTypoRetries < 80) {
            displayTypoRetries++;
            if (displayTypoTimer) clearTimeout(displayTypoTimer);
            var wait = displayTypoRetries < 8 ? 0 : displayTypoRetries < 20 ? 50 : 120;
            if (wait) {
                displayTypoTimer = setTimeout(function() {
                    displayTypoTimer = null;
                    applyDisplayTypography();
                }, wait);
            } else {
                requestAnimationFrame(applyDisplayTypography);
            }
        }
        return;
    }
    displayTypoRetries = 0;
    if (displayTypoTimer) {
        clearTimeout(displayTypoTimer);
        displayTypoTimer = null;
    }
    var innerW = Math.max(8, w - 10);
    var px = Math.min(innerW / 10.5, (h / 8) * 0.9);
    px = Math.max(9, Math.round(px * 10) / 10);
    if (screen.classList.contains('is-menu')) {
        px = Math.round(px * 1.1 * 10) / 10;
    }
    screen.style.fontSize = px + 'px';

    var isStandbyView = (screen.classList.contains('is-standby') || screen.classList.contains('is-standby-tune'))
        && !screen.classList.contains('is-menu')
        && !screen.classList.contains('is-snake')
        && !screen.classList.contains('is-stub');
    var clock = document.getElementById('radio-display-clock');
    if (clock) {
        if (isStandbyView && !screen.classList.contains('is-off') && !screen.classList.contains('is-charging')) {
            clock.style.setProperty('font-size', Math.max(7, Math.round(px * 0.62 * 10) / 10) + 'px', 'important');
            clock.style.setProperty('font-weight', '400', 'important');
        } else {
            clock.style.removeProperty('font-size');
            clock.style.removeProperty('font-weight');
        }
    }
    var presetRow = document.getElementById('radio-display-freq');
    if (presetRow) {
        if (presetRow.classList.contains('radio-display-standby-preset')) {
            presetRow.style.setProperty('font-weight', '700', 'important');
            presetRow.style.setProperty('font-size', px + 'px', 'important');
        } else {
            presetRow.style.removeProperty('font-weight');
            presetRow.style.removeProperty('font-size');
        }
    }
    var freqRow = document.getElementById('radio-display-key');
    if (freqRow) {
        if (freqRow.classList.contains('radio-display-standby-freq')) {
            freqRow.style.setProperty('font-weight', '400', 'important');
            freqRow.style.setProperty('font-size', px + 'px', 'important');
        } else {
            freqRow.style.removeProperty('font-weight');
            freqRow.style.removeProperty('font-size');
        }
    }
    var keyRow = document.getElementById('radio-display-buffer');
    if (keyRow) {
        if (keyRow.classList.contains('radio-display-standby-key')) {
            keyRow.style.setProperty('font-weight', '400', 'important');
            keyRow.style.setProperty('font-size', Math.max(8, Math.round(px * 0.82 * 10) / 10) + 'px', 'important');
        } else {
            keyRow.style.removeProperty('font-weight');
            keyRow.style.removeProperty('font-size');
        }
    }

    applyBatteryChrome(px);
}

/** Baterie + nabíjení — stejná px báze jako displej (ne fixní CSS px). */
function applyBatteryChrome(px) {
    var w = Math.round(px * 3.15 * 10) / 10;
    var h = Math.round(px * 1.64 * 10) / 10;
    var iw = Math.round(px * 2.35 * 10) / 10;
    var ih = Math.round(px * 3.95 * 10) / 10;
    var gap = Math.round(px * 0.55 * 10) / 10;
    var widget = document.getElementById('radio-display-battery');
    if (widget) {
        widget.style.width = w + 'px';
        widget.style.height = h + 'px';
    }
    var icons = document.querySelectorAll('.radio-display-charge-icon');
    var i;
    for (i = 0; i < icons.length; i++) {
        icons[i].style.width = iw + 'px';
        icons[i].style.height = ih + 'px';
    }
    var wraps = document.querySelectorAll('.radio-display-charge-wrap');
    for (i = 0; i < wraps.length; i++) {
        wraps[i].style.gap = gap + 'px';
    }
}

export function applyRadioHitmap(skipTypo) {
    var stageBox = getStageBox();
    var screen = document.getElementById('radio-display-screen');
    applyRect(screen, 321, 332, 156, 208, stageBox);

    var dpad = document.getElementById('radio-dpad-zone');
    applyRect(dpad, 361, 568, 77, 64, stageBox);

    applyRect(document.querySelector('[data-key="p1"]'), 315, 568, 46, 32, stageBox);
    applyRect(document.getElementById('radio-key-ent'), 315, 600, 46, 37, stageBox);
    applyRect(document.querySelector('[data-key="p2"]'), 438, 568, 46, 32, stageBox);
    applyRect(document.getElementById('radio-key-clr'), 438, 600, 46, 37, stageBox);

    applyRect(document.getElementById('radio-key-mode'), 300, 200, 48, 55, stageBox);
    applyRect(document.getElementById('radio-key-preset-dial'), 373, 174, 44, 79, stageBox);
    applyRect(document.getElementById('radio-key-main-dial'), 513, 310, 37, 228, stageBox);

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
                row.h,
                stageBox
            );
        }
    }
    if (!skipTypo) requestAnimationFrame(applyDisplayTypography);
}
