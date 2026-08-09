/**
 * SECTOR-TECH — jeden pracovní pohled (displej + klávesnice), zoom slider, kalibrace.
 */
import { applyRadioHitmap } from './radioHitmap.js';
function el(id) {
    return document.getElementById(id);
}

var LAYOUT = {
    displayTop: 333 / 800,
    displayBottom: 540 / 800,
    keypadBottom: 786 / 800
};

var SCALE_KEY = 'patrac_sector_scale';
var DEFAULT_SCALE = 2.75;
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
    shell.style.setProperty('--sector-img-scale', user.toFixed(3));
    updateScaleUi(user, user);
    return user;
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

    var rail = el('sector-zoom-rail');
    if (rail) rail.style.display = 'flex';
}

var GRID_SRC = 800;
var GRID_STEP = 50;
var GRID_MINOR = 25;

function gridLabel(parts, cls, x, y, text, anchor) {
    parts.push(
        '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" class="' + cls + '">' + text + '</text>'
    );
}

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
    var srcW = metrics.srcW;
    var srcH = metrics.srcH;
    svg.setAttribute('viewBox', '0 0 ' + srcW + ' ' + srcH);
    svg.style.display = 'block';

    var parts = [];
    var n;
    var major;
    var labelOff = 14;

    for (n = 0; n <= srcW; n += GRID_MINOR) {
        major = n % GRID_STEP === 0;
        if (!major) {
            parts.push(
                '<line x1="' + n + '" y1="0" x2="' + n + '" y2="' + srcH + '" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>'
            );
        }
    }
    for (n = 0; n <= srcH; n += GRID_MINOR) {
        major = n % GRID_STEP === 0;
        if (!major) {
            parts.push(
                '<line x1="0" y1="' + n + '" x2="' + srcW + '" y2="' + n + '" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>'
            );
        }
    }

    for (n = 0; n <= srcW; n += GRID_STEP) {
        major = n % 100 === 0;
        parts.push(
            '<line x1="' + n + '" y1="0" x2="' + n + '" y2="' + srcH + '" ' +
            'stroke="' + (major ? 'rgba(0,229,255,0.55)' : 'rgba(0,229,255,0.22)') + '" ' +
            'stroke-width="' + (major ? '1.6' : '1') + '"/>'
        );
        gridLabel(parts, major ? 'sector-grid-label' : 'sector-grid-label-minor', n, labelOff, String(n));
        gridLabel(parts, major ? 'sector-grid-label' : 'sector-grid-label-minor', n, srcH - 4, String(n));
    }
    for (n = 0; n <= srcH; n += GRID_STEP) {
        major = n % 100 === 0;
        parts.push(
            '<line x1="0" y1="' + n + '" x2="' + srcW + '" y2="' + n + '" ' +
            'stroke="' + (major ? 'rgba(255,230,0,0.55)' : 'rgba(255,230,0,0.22)') + '" ' +
            'stroke-width="' + (major ? '1.6' : '1') + '"/>'
        );
        gridLabel(parts, major ? 'sector-grid-label-y' : 'sector-grid-label-y-minor', 22, n + 4, String(n), 'start');
        gridLabel(parts, major ? 'sector-grid-label-y' : 'sector-grid-label-y-minor', srcW - 4, n + 4, String(n), 'end');
    }

    parts.push('<line x1="0" y1="0" x2="' + srcW + '" y2="0" stroke="#00e5ff" stroke-width="2.5"/>');
    parts.push('<line x1="0" y1="0" x2="0" y2="' + srcH + '" stroke="#ffe600" stroke-width="2.5"/>');
    gridLabel(parts, 'sector-grid-axis-x', srcW - 16, 28, 'X', 'end');
    gridLabel(parts, 'sector-grid-axis-y', 18, srcH - 8, 'Y', 'start');
    gridLabel(parts, 'sector-grid-origin', 6, labelOff, '0', 'start');
    gridLabel(parts, 'sector-grid-meta', srcW - 6, srcH - 8, srcW + '×' + srcH, 'end');
    svg.innerHTML = parts.join('');
}

function updateViewportRulers(scroll) {
    var wrap = el('sector-cal-rulers');
    if (!wrap) return;
    if (!isCalibrateMode()) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = 'block';
    var rulerX = el('sector-cal-ruler-x');
    var rulerY = el('sector-cal-ruler-y');
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage || !rulerX || !rulerY) return;

    var metrics = getStageSourceMetrics(stage);
    var stageRect = stage.getBoundingClientRect();
    var scrollRect = scroll.getBoundingClientRect();
    var viewW = scroll.clientWidth;
    var viewH = scroll.clientHeight;
    var scrollTop = scroll.scrollTop;
    var xParts = [];
    var yParts = [];
    var n;
    var px;
    var py;

    for (n = 0; n <= metrics.srcW; n += GRID_STEP) {
        px = stageRect.left + (n / metrics.srcW) * metrics.stageW - scrollRect.left;
        if (px < -36 || px > viewW + 36) continue;
        xParts.push('<span class="sector-ruler-tick' + (n % 100 === 0 ? ' major' : '') + '" style="left:' + px + 'px">' + n + '</span>');
    }
    for (n = 0; n <= metrics.srcH; n += GRID_STEP) {
        py = (n / metrics.srcH) * metrics.stageH - scrollTop;
        if (py < -18 || py > viewH + 18) continue;
        yParts.push('<span class="sector-ruler-tick-y' + (n % 100 === 0 ? ' major' : '') + '" style="top:' + py + 'px">' + n + '</span>');
    }
    rulerX.innerHTML = xParts.join('');
    rulerY.innerHTML = yParts.join('');
}

function clientToSource(stage, clientX, clientY) {
    var stageRect = stage.getBoundingClientRect();
    var metrics = getStageSourceMetrics(stage);
    return {
        x: Math.round((clientX - stageRect.left) / metrics.stageW * metrics.srcW),
        y: Math.round((clientY - stageRect.top) / metrics.stageH * metrics.srcH)
    };
}

function placeCalCross(stage, srcX, srcY) {
    var cross = el('sector-cal-cross');
    var readout = el('sector-cal-cross-readout');
    var coords = el('sector-cross-coords');
    if (!cross) return;
    var metrics = getStageSourceMetrics(stage);
    srcX = Math.max(0, Math.min(metrics.srcW, srcX));
    srcY = Math.max(0, Math.min(metrics.srcH, srcY));
    cross.style.left = (srcX / metrics.srcW * 100) + '%';
    cross.style.top = (srcY / metrics.srcH * 100) + '%';
    cross.classList.add('is-placed');
    var label = 'X:' + srcX + '  Y:' + srcY;
    if (readout) readout.textContent = label;
    if (coords) coords.textContent = label;
}

function setCrossMode(on) {
    document.body.classList.toggle('sector-cross-mode', !!on);
    var btn = el('sector-cross-toggle');
    if (btn) btn.classList.toggle('active', !!on);
}

function bindCrosshair() {
    var toggle = el('sector-cross-toggle');
    var layer = el('sector-cal-tap-layer');
    var stage = document.querySelector('.sector-tech-stage');
    if (!toggle || !layer || !stage || toggle._sectorCrossBound) return;
    toggle._sectorCrossBound = true;

    toggle.addEventListener('click', function() {
        setCrossMode(!document.body.classList.contains('sector-cross-mode'));
    });

    function onPlace(clientX, clientY) {
        if (!isCalibrateMode() || !document.body.classList.contains('sector-cross-mode')) return;
        var pt = clientToSource(stage, clientX, clientY);
        placeCalCross(stage, pt.x, pt.y);
    }

    layer.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        onPlace(e.clientX, e.clientY);
    });
    layer.addEventListener('touchend', function(e) {
        if (!e.changedTouches || !e.changedTouches.length) return;
        e.preventDefault();
        var t = e.changedTouches[0];
        onPlace(t.clientX, t.clientY);
    }, { passive: false });
}

function updateCalibrationLabels() {
    var stage = document.querySelector('.sector-tech-stage');
    if (!stage) return;
    var on = isCalibrateMode();
    document.body.classList.toggle('sector-calibrate-on', on);
    if (!on) setCrossMode(false);

    var bar = el('sector-scale-bar');
    if (bar) bar.style.display = on ? 'flex' : 'none';

    rebuildCalGrid(stage);

    var scroll = el('sector-tech-scroll');
    if (scroll) updateViewportRulers(scroll);

    var stageRect = stage.getBoundingClientRect();
    var metrics = getStageSourceMetrics(stage);
    var nodes = stage.querySelectorAll('.sector-hit, .sector-tech-screen, .sector-dpad-zone');
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

/** Dva snap body: displej nahoře, klávesnice dole. */
function getSnapScrollTops(scroll) {
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return [0, 0];
    var stageH = stage.offsetHeight;
    var viewH = scroll.clientHeight;
    var display = Math.max(0, stageH * LAYOUT.displayTop - 6);
    var keypad = Math.max(0, stageH * LAYOUT.keypadBottom - viewH + 16);
    if (keypad < display) keypad = display;
    return [display, keypad];
}

function snapScrollNearest(scroll, smooth) {
    if (isCalibrateMode()) return;
    var snaps = getSnapScrollTops(scroll);
    var t = scroll.scrollTop;
    var best = snaps[0];
    var bestDist = Math.abs(t - snaps[0]);
    for (var i = 1; i < snaps.length; i++) {
        var d = Math.abs(t - snaps[i]);
        if (d < bestDist) {
            bestDist = d;
            best = snaps[i];
        }
    }
    if (Math.abs(scroll.scrollTop - best) > 2) {
        scroll.scrollTo({ top: best, behavior: smooth ? 'smooth' : 'auto' });
    }
}

function scrollToSectorView(which, smooth) {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    var snaps = getSnapScrollTops(scroll);
    var top = which === 'keypad' ? snaps[1] : snaps[0];
    scroll.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
}

/** @deprecated alias */
function getWorkScrollTop(scroll) {
    return getSnapScrollTops(scroll)[0];
}

function measureStage(scroll) {
    applyScale(scroll);
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return null;
    workScrollTopPx = getSnapScrollTops(scroll)[0];
    updateCalibrationLabels();
    return {
        stageH: stage.offsetHeight,
        viewH: scroll.clientHeight,
        workScroll: workScrollTopPx
    };
}

function applyWorkView(scroll, smooth, force) {
    if (isCalibrateMode()) return;
    if (force) {
        scrollToSectorView('display', smooth);
        return;
    }
    snapScrollNearest(scroll, smooth);
}

function bindScrollNav() {
    var topBtn = el('sector-scroll-top');
    var bottomBtn = el('sector-scroll-bottom');
    if (topBtn && !topBtn._sectorBound) {
        topBtn._sectorBound = true;
        topBtn.addEventListener('click', function() {
            scrollToSectorView('display', true);
        });
    }
    if (bottomBtn && !bottomBtn._sectorBound) {
        bottomBtn._sectorBound = true;
        bottomBtn.addEventListener('click', function() {
            scrollToSectorView('keypad', true);
        });
    }
}

function remeasureAll() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    applyRadioHitmap();
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
    bindCrosshair();
    bindScrollNav();
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

    /* Scroll: kalibrace = pravítka; jinak volný scroll + snap na displej/klávesnici */
    var snapTimer = null;
    scroll.addEventListener('scroll', function() {
        if (isCalibrateMode()) {
            updateViewportRulers(scroll);
            return;
        }
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(function() {
            snapScrollNearest(scroll, true);
        }, 220);
    }, { passive: true });
}

export function scrollSectorTechTo(which) {
    scrollToSectorView(which || 'display', true);
}

export function refreshSectorTechLayout() {
    remeasureAll();
}
