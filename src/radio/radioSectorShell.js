/**
 * SECTOR-TECH — scroll, dynamické měřítko, kalibrační overlay (px souřadnice).
 */
function el(id) {
    return document.getElementById(id);
}

/** Podíl výšky stage (0–1) — sector-tech-front.png 800×800 */
var LAYOUT = {
    displayTop: 0.185,
    displayBottom: 0.445,
    keypadTop: 0.48,
    keypadBottom: 0.915,
    radioWidthFrac: 0.56
};

var snapBottomPx = 0;
var snapEnabled = true;

function workRegionFrac() {
    return LAYOUT.keypadBottom - LAYOUT.displayTop;
}

function computeScale(viewW, viewH) {
    var frac = workRegionFrac();
    if (!viewW || !viewH || frac <= 0) return 2.85;
    /* Displej + klávesnice se vejdou do viewportu; šířka rádia ~56 % PNG */
    var scaleForHeight = viewH / (viewW * frac);
    var scaleForWidth = 1 / LAYOUT.radioWidthFrac;
    var scale = Math.min(2.85, scaleForHeight);
    scale = Math.max(1.15, scale);
    /* Nepodškrtnout min. šířku těla rádia, pokud to výška dovolí */
    if (scaleForHeight >= scaleForWidth) {
        scale = Math.min(2.85, scaleForHeight);
    }
    return scale;
}

function applyScale(scroll) {
    var shell = scroll.closest('.sector-tech-shell');
    if (!shell) return 2.85;
    var viewW = window.innerWidth || scroll.clientWidth;
    var viewH = scroll.clientHeight;
    var scale = computeScale(viewW, viewH);
    shell.style.setProperty('--sector-img-scale', scale.toFixed(3));
    return scale;
}

function isCalibrateMode() {
    try {
        if (/[?&]radioCal=1/i.test(window.location.search || '')) return true;
    } catch (e) {}
    return document.body.classList.contains('admin-mode') ||
        document.body.classList.contains('sector-calibrate');
}

function updateCalibrationLabels() {
    var stage = document.querySelector('.sector-tech-stage');
    if (!stage) return;
    var on = isCalibrateMode();
    document.body.classList.toggle('sector-calibrate-on', on);
    var stageRect = stage.getBoundingClientRect();
    var nodes = stage.querySelectorAll('.sector-hit, .sector-tech-screen');
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var r = node.getBoundingClientRect();
        var x = Math.round(r.left - stageRect.left);
        var y = Math.round(r.top - stageRect.top);
        var w = Math.round(r.width);
        var h = Math.round(r.height);
        var tag = node.querySelector('.sector-hit-tag');
        if (!tag) {
            tag = document.createElement('span');
            tag.className = 'sector-hit-tag';
            node.appendChild(tag);
        }
        var name = node.id || node.getAttribute('data-key') || 'screen';
        tag.textContent = name + '  ' + x + ',' + y + '  ' + w + '×' + h + 'px';
        tag.style.display = on ? 'block' : 'none';
    }
}

function measureStage(scroll) {
    applyScale(scroll);
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return null;
    var stageH = stage.offsetHeight;
    var viewH = scroll.clientHeight;
    var max = Math.max(0, stageH - viewH);
    var workPx = stageH * workRegionFrac();
    var pad = Math.max(6, (viewH - workPx) * 0.12);

    if (workPx <= viewH) {
        snapBottomPx = Math.max(0, Math.min(max, stageH * LAYOUT.displayTop - pad));
    } else {
        snapBottomPx = Math.max(0, Math.min(max, stageH * LAYOUT.keypadBottom - viewH));
    }

    updateCalibrationLabels();
    return { stageH: stageH, viewH: viewH, max: max, workPx: workPx };
}

function snapScrollToNearestStep(scroll) {
    if (!snapEnabled || isCalibrateMode()) return;
    var m = measureStage(scroll);
    if (!m || m.max <= 4) return;
    var mid = snapBottomPx * 0.45;
    var target = scroll.scrollTop < mid ? 0 : snapBottomPx;
    if (Math.abs(scroll.scrollTop - target) > 6) {
        scroll.scrollTo({ top: target, behavior: 'smooth' });
    }
}

function remeasureAll() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    measureStage(scroll);
}

export function initSectorTechShell() {
    var scroll = el('sector-tech-scroll');
    if (!scroll || scroll._sectorBound) return;
    scroll._sectorBound = true;

    remeasureAll();

    var img = el('sector-tech-img');
    if (img) {
        if (img.complete) remeasureAll();
        else img.addEventListener('load', remeasureAll);
    }

    if (!window._patracSectorResizeBound) {
        window._patracSectorResizeBound = true;
        var rt;
        window.addEventListener('resize', function() {
            if (rt) clearTimeout(rt);
            rt = setTimeout(remeasureAll, 120);
        });
    }

    if (!window._patracSectorAdminBound) {
        window._patracSectorAdminBound = true;
        var obs = new MutationObserver(function() {
            snapEnabled = !isCalibrateMode();
            remeasureAll();
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    var snapTimer = null;
    scroll.addEventListener('scroll', function() {
        if (isCalibrateMode()) return;
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(function() {
            snapScrollToNearestStep(scroll);
        }, 140);
    }, { passive: true });

    scroll.scrollTop = 0;
}

export function scrollSectorTechTo(step) {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    measureStage(scroll);
    scroll.scrollTo({ top: step === 1 ? snapBottomPx : 0, behavior: 'smooth' });
}

export function refreshSectorTechLayout() {
    remeasureAll();
}
