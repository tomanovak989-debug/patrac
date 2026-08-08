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
var DEFAULT_SCALE = 2.8;
var SCALE_MIN = 1.85;
var SCALE_MAX = 4.5;

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
    var user = getUserScale();
    var scale = user;
    /* V běžném režimu jemně omez zoom, aby šla vidět celá klávesnice bez scrollu */
    if (!isCalibrateMode()) {
        var viewW = window.innerWidth || scroll.clientWidth;
        var viewH = scroll.clientHeight;
        var maxFit = viewH / (viewW * workRegionFrac());
        if (scale > maxFit) {
            scale = Math.max(SCALE_MIN, maxFit);
        }
    }
    shell.style.setProperty('--sector-img-scale', scale.toFixed(3));
    updateScaleUi(scale, user);
    return scale;
}

function updateScaleUi(applied, requested) {
    var slider = el('sector-scale-slider');
    var label = el('sector-scale-value');
    if (slider && requested != null) slider.value = String(requested);
    else if (slider) slider.value = String(applied);
    if (label) {
        if (requested != null && Math.abs(requested - applied) > 0.04) {
            label.textContent = applied.toFixed(2) + '× (' + requested.toFixed(2) + ')';
        } else {
            label.textContent = applied.toFixed(2) + '×';
        }
    }
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

var GRID_SRC = 800;
var GRID_STEP = 50;

function getStageSourceMetrics(stage) {
    var img = stage.querySelector('.sector-tech-img');
    var srcW = (img && img.naturalWidth) ? img.naturalWidth : GRID_SRC;
    var srcH = (img && img.naturalHeight) ? img.naturalHeight : GRID_SRC;
    var stageW = stage.offsetWidth || 1;
    var stageH = stage.offsetHeight || 1;
    return { srcW: srcW, srcH: srcH, stageW: stageW, stageH: stageH };
}

function stagePxToSource(stageRect, stageMetrics, rect) {
    var mx = stageMetrics;
    return {
        x: Math.round((rect.left - stageRect.left) / mx.stageW * mx.srcW),
        y: Math.round((rect.top - stageRect.top) / mx.stageH * mx.srcH),
        w: Math.round(rect.width / mx.stageW * mx.srcW),
        h: Math.round(rect.height / mx.stageH * mx.srcH)
    };
}

function rebuildCalGrid(stage) {
    var svg = stage.querySelector('.sector-cal-grid');
    if (!svg) return;
    if (!isCalibrateMode()) {
        svg.innerHTML = '';
        svg.style.display = 'none';
        return;
    }
    var metrics = getStageSourceMetrics(stage);
    var src = Math.max(metrics.srcW, metrics.srcH);
    svg.setAttribute('viewBox', '0 0 ' + metrics.srcW + ' ' + metrics.srcH);
    svg.style.display = 'block';

    var parts = [];
    var x;
    for (x = 0; x <= src; x += GRID_STEP) {
        var major = x % 100 === 0;
        parts.push(
            '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + src + '" ' +
            'stroke="' + (major ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.14)') + '" ' +
            'stroke-width="' + (major ? '1.4' : '0.7') + '"/>'
        );
        if (major) {
            parts.push('<text x="' + x + '" y="16" text-anchor="middle" class="sector-grid-label">' + x + '</text>');
            if (x > 0) {
                parts.push('<text x="12" y="' + (x + 4) + '" class="sector-grid-label-y">' + x + '</text>');
            }
        }
    }
    parts.push('<line x1="0" y1="0" x2="' + src + '" y2="0" stroke="#00e5ff" stroke-width="2.5"/>');
    parts.push('<line x1="0" y1="0" x2="0" y2="' + src + '" stroke="#ffe600" stroke-width="2.5"/>');
    parts.push('<text x="' + (src - 18) + '" y="28" class="sector-grid-axis-x">X</text>');
    parts.push('<text x="18" y="' + (src - 10) + '" class="sector-grid-axis-y">Y</text>');
    parts.push('<text x="6" y="14" class="sector-grid-origin">0</text>');
    parts.push('<text x="' + (src - 52) + '" y="' + (src - 10) + '" class="sector-grid-meta">' + src + 'px</text>');
    svg.innerHTML = parts.join('');
}

function updateCalibrationLabels() {
    var stage = document.querySelector('.sector-tech-stage');
    if (!stage) return;
    var on = isCalibrateMode();
    document.body.classList.toggle('sector-calibrate-on', on);

    var bar = el('sector-scale-bar');
    if (bar) bar.style.display = on ? 'flex' : 'none';

    rebuildCalGrid(stage);

    var stageRect = stage.getBoundingClientRect();
    var metrics = getStageSourceMetrics(stage);
    var nodes = stage.querySelectorAll('.sector-hit, .sector-tech-screen');
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var r = node.getBoundingClientRect();
        var src = stagePxToSource(stageRect, metrics, r);
        var tag = node.querySelector('.sector-hit-tag');
        if (!tag) {
            tag = document.createElement('span');
            tag.className = 'sector-hit-tag';
            node.appendChild(tag);
        }
        var name = node.id || node.getAttribute('data-key') || 'screen';
        tag.textContent = name + '  ' + src.x + ',' + src.y + '  ' + src.w + '×' + src.h + 'px';
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

function applyWorkView(scroll, smooth, force) {
    workScrollTopPx = getWorkScrollTop(scroll);
    if (isCalibrateMode()) return;
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return;
    var stageH = stage.offsetHeight;
    var viewH = scroll.clientHeight;
    var max = Math.max(workScrollTopPx, stageH - viewH);
    var t = scroll.scrollTop;
    if (force || t < workScrollTopPx - 20) {
        t = workScrollTopPx;
    } else if (t < workScrollTopPx) {
        t = workScrollTopPx;
    } else if (t > max) {
        t = max;
    }
    if (Math.abs(scroll.scrollTop - t) > 3) {
        scroll.scrollTo({ top: t, behavior: smooth ? 'smooth' : 'auto' });
    }
}

function remeasureAll() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    measureStage(scroll);
    if (!isCalibrateMode()) {
        applyWorkView(scroll, false, true);
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
            applyWorkView(scroll, true, false);
        }, 160);
    }, { passive: true });
}

export function scrollSectorTechTo() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    applyWorkView(scroll, true, true);
}

export function refreshSectorTechLayout() {
    remeasureAll();
}
