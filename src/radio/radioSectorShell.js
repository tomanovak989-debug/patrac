/**
 * SECTOR-TECH — jeden pracovní pohled (displej + klávesnice), zoom slider, kalibrace.
 */
function el(id) {
    return document.getElementById(id);
}

var LAYOUT = {
    displayTop: 0.275,
    displayBottom: 0.515,
    keypadBottom: 0.945
};

var SCALE_KEY = 'patrac_sector_scale';
var DEFAULT_SCALE = 2.5;
var SCALE_MIN = 1.85;
var SCALE_MAX = 2.85;

var workScrollTopPx = 0;

function workRegionFrac() {
    return LAYOUT.keypadBottom - LAYOUT.displayTop;
}

function getUserScale() {
    var raw = parseFloat(localStorage.getItem(SCALE_KEY));
    if (!isFinite(raw)) return DEFAULT_SCALE;
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, raw));
}

function setUserScale(val) {
    val = Math.max(SCALE_MIN, Math.min(SCALE_MAX, val));
    try { localStorage.setItem(SCALE_KEY, String(val)); } catch (e) {}
    return val;
}

function isCalibrateMode() {
    try {
        if (/[?&]radioCal=1/i.test(window.location.search || '')) return true;
    } catch (e) {}
    return document.body.classList.contains('admin-mode') ||
        document.body.classList.contains('sector-calibrate');
}

function applyScale(scroll) {
    var shell = scroll.closest('.sector-tech-shell');
    if (!shell) return DEFAULT_SCALE;
    var viewW = window.innerWidth || scroll.clientWidth;
    var viewH = scroll.clientHeight;
    var user = getUserScale();
    var maxFit = viewH / (viewW * workRegionFrac());
    var scale = user;
    if (scale > maxFit) {
        scale = Math.max(SCALE_MIN, maxFit);
    }
    shell.style.setProperty('--sector-img-scale', scale.toFixed(3));
    updateScaleUi(scale);
    return scale;
}

function updateScaleUi(scale) {
    var slider = el('sector-scale-slider');
    var label = el('sector-scale-value');
    if (slider) slider.value = String(scale);
    if (label) label.textContent = scale.toFixed(2) + '×';
}

function bindScaleControl() {
    var bar = el('sector-scale-bar');
    var slider = el('sector-scale-slider');
    if (!slider || slider._sectorBound) return;
    slider._sectorBound = true;
    slider.min = String(SCALE_MIN);
    slider.max = String(SCALE_MAX);
    slider.step = '0.05';
    slider.value = String(getUserScale());

    slider.addEventListener('input', function() {
        setUserScale(parseFloat(slider.value));
        remeasureAll();
    });

    if (bar) {
        bar.style.display = isCalibrateMode() ? 'flex' : 'none';
    }
}

function updateCalibrationLabels() {
    var stage = document.querySelector('.sector-tech-stage');
    if (!stage) return;
    var on = isCalibrateMode();
    document.body.classList.toggle('sector-calibrate-on', on);

    var bar = el('sector-scale-bar');
    if (bar) bar.style.display = on ? 'flex' : 'none';

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

/** Scroll tak, aby horní okraj = displej (nic nad ním). */
function getWorkScrollTop(scroll) {
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return 0;
    var stageH = stage.offsetHeight;
    return Math.max(0, stageH * LAYOUT.displayTop - 6);
}

function measureStage(scroll) {
    applyScale(scroll);
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return null;
    workScrollTopPx = getWorkScrollTop(scroll);
    updateCalibrationLabels();
    return {
        stageH: stage.offsetHeight,
        viewH: scroll.clientHeight,
        workScroll: workScrollTopPx
    };
}

function applyWorkView(scroll, smooth) {
    workScrollTopPx = getWorkScrollTop(scroll);
    if (isCalibrateMode()) return;
    scroll.scrollTo({ top: workScrollTopPx, behavior: smooth ? 'smooth' : 'auto' });
}

function remeasureAll() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    measureStage(scroll);
    if (!isCalibrateMode()) {
        applyWorkView(scroll, false);
    }
}

export function initSectorTechShell() {
    var scroll = el('sector-tech-scroll');
    if (!scroll || scroll._sectorBound) return;
    scroll._sectorBound = true;

    bindScaleControl();
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
            bindScaleControl();
            remeasureAll();
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    /* Mimo kalibraci: po scrollu vrať na pracovní pohled (displej + klávesnice) */
    var snapTimer = null;
    scroll.addEventListener('scroll', function() {
        if (isCalibrateMode()) return;
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(function() {
            applyWorkView(scroll, true);
        }, 160);
    }, { passive: true });
}

export function scrollSectorTechTo() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    applyWorkView(scroll, true);
}

export function refreshSectorTechLayout() {
    remeasureAll();
}
