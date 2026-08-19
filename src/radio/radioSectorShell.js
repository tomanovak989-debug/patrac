/**
 * SECTOR-TECH — dva pohledy (celá / displej+klávesnice), kalibrace pásem, +/- ovládání.
 */
import { applyRadioHitmap } from './radioHitmap.js';

function el(id) {
    return document.getElementById(id);
}

var GRID_SRC = 800;
var GRID_STEP = 50;
var GRID_MINOR = 25;
var BAND_MIN_GAP = 80;

var VIEW_BANDS_KEY = 'patrac_sector_view_bands';
var VIEW_MODE_KEY = 'patrac_sector_view_mode';
var CAL_SCALE = 2.0;

var DEFAULT_BANDS = {
    full: { top: 120, bottom: 790 },
    focus: { top: 333, bottom: 786 }
};

var viewMode = 'focus';
var bandsCache = null;
var dragState = null;

function cloneBands(src) {
    return {
        full: { top: src.full.top, bottom: src.full.bottom },
        focus: { top: src.focus.top, bottom: src.focus.bottom }
    };
}

function loadBands() {
    if (bandsCache) return bandsCache;
    try {
        var raw = JSON.parse(localStorage.getItem(VIEW_BANDS_KEY));
        if (raw && raw.full && raw.focus) {
            bandsCache = cloneBands(raw);
            return bandsCache;
        }
    } catch (e) {}
    bandsCache = cloneBands(DEFAULT_BANDS);
    return bandsCache;
}

function saveBands(bands) {
    bandsCache = cloneBands(bands);
    try { localStorage.setItem(VIEW_BANDS_KEY, JSON.stringify(bandsCache)); } catch (e) {}
    updateBandReadout();
}

function getViewMode() {
    try {
        var m = localStorage.getItem(VIEW_MODE_KEY);
        if (m === 'full' || m === 'focus') return m;
    } catch (e) {}
    return 'focus';
}

function setViewMode(mode) {
    viewMode = mode === 'full' ? 'full' : 'focus';
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch (e) {}
    updateViewControls();
}

function isCalibrateMode() {
    try {
        if (/[?&]radioCal=1/i.test(window.location.search || '')) return true;
    } catch (e) {}
    return document.body.classList.contains('admin-mode') ||
        document.body.classList.contains('sector-calibrate');
}

function clampY(y) {
    return Math.max(0, Math.min(GRID_SRC, Math.round(y)));
}

function normalizeBand(band) {
    var top = clampY(band.top);
    var bottom = clampY(band.bottom);
    if (bottom - top < BAND_MIN_GAP) {
        if (bottom + BAND_MIN_GAP <= GRID_SRC) top = bottom - BAND_MIN_GAP;
        else bottom = top + BAND_MIN_GAP;
    }
    return { top: clampY(top), bottom: clampY(bottom) };
}

function currentBand() {
    var bands = loadBands();
    return normalizeBand(bands[viewMode] || bands.focus);
}

function computeScaleForBand(scroll, band) {
    var viewH = scroll.clientHeight;
    if (viewH < 40) viewH = 240;
    var regionH = Math.max(BAND_MIN_GAP, band.bottom - band.top);
    var vw = window.innerWidth || scroll.clientWidth || 360;
    var scale = (viewH * GRID_SRC) / (regionH * vw);
    return Math.max(1.4, Math.min(6.5, scale));
}

function applyViewLayout(scroll) {
    var shell = scroll.closest('.sector-tech-shell');
    if (!shell) return CAL_SCALE;
    var band = currentBand();
    var scale = computeScaleForBand(scroll, band);
    shell.style.setProperty('--sector-img-scale', scale.toFixed(3));

    var stage = scroll.querySelector('.sector-tech-stage');
    if (stage) {
        var stageH = stage.offsetHeight;
        scroll.scrollTop = Math.max(0, (band.top / GRID_SRC) * stageH - 2);
    }
    updateViewControls();
    return scale;
}

function applyCalLayout(scroll) {
    var shell = scroll.closest('.sector-tech-shell');
    if (shell) shell.style.setProperty('--sector-img-scale', String(CAL_SCALE));
}

function applyLayout(scroll) {
    if (isCalibrateMode()) {
        applyCalLayout(scroll);
        return CAL_SCALE;
    }
    return applyViewLayout(scroll);
}

function updateViewControls() {
    var plus = el('sector-view-plus');
    var minus = el('sector-view-minus');
    if (plus) plus.classList.toggle('is-active', viewMode === 'focus');
    if (minus) minus.classList.toggle('is-active', viewMode === 'full');
}

function updateBandReadout() {
    var node = el('sector-band-readout');
    if (!node) return;
    var b = loadBands();
    node.textContent =
        'CELO: Y ' + b.full.top + '–' + b.full.bottom +
        ' · VÝŘEZ: Y ' + b.focus.top + '–' + b.focus.bottom;
}

function positionBandLine(line, ySrc) {
    line.style.top = (clampY(ySrc) / GRID_SRC * 100).toFixed(4) + '%';
}

function updateBandLinePositions(stage) {
    var wrap = stage && stage.querySelector('.sector-view-bands');
    if (!wrap) return;
    var b = loadBands();
    var lines = wrap.querySelectorAll('.sector-band-line');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var bandKey = line.getAttribute('data-band');
        var edge = line.getAttribute('data-edge');
        if (!bandKey || !edge || !b[bandKey]) continue;
        positionBandLine(line, b[bandKey][edge]);
    }
}

function bindViewControls() {
    var minus = el('sector-view-minus');
    var plus = el('sector-view-plus');
    if (!minus || !plus || minus._sectorViewBound) return;
    minus._sectorViewBound = true;
    plus._sectorViewBound = true;

    minus.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('full');
        remeasureAll();
    });
    plus.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('focus');
        remeasureAll();
    });
}

function clientYToSourceY(stage, clientY) {
    var stageRect = stage.getBoundingClientRect();
    var metrics = getStageSourceMetrics(stage);
    var rel = (clientY - stageRect.top) / Math.max(1, metrics.stageH);
    return clampY(rel * metrics.srcH);
}

function bindBandLines() {
    var wrap = el('sector-view-bands');
    var stage = document.querySelector('.sector-tech-stage');
    if (!wrap || !stage || wrap._sectorBandBound) return;
    wrap._sectorBandBound = true;

    function finishDrag() {
        if (!dragState) return;
        dragState = null;
        document.body.classList.remove('sector-band-dragging');
        saveBands(loadBands());
        remeasureAll();
    }

    function onMove(clientY) {
        if (!dragState) return;
        var y = clientYToSourceY(stage, clientY);
        var bands = loadBands();
        var band = bands[dragState.bandKey];
        if (!band) return;

        if (dragState.edge === 'top') {
            band.top = Math.min(y, band.bottom - BAND_MIN_GAP);
        } else {
            band.bottom = Math.max(y, band.top + BAND_MIN_GAP);
        }
        bands[dragState.bandKey] = normalizeBand(band);
        bandsCache = cloneBands(bands);
        positionBandLine(dragState.line, bands[dragState.bandKey][dragState.edge]);
        updateBandReadout();
    }

    wrap.addEventListener('pointerdown', function(e) {
        if (!isCalibrateMode()) return;
        var line = e.target.closest('.sector-band-line');
        if (!line) return;
        e.preventDefault();
        dragState = {
            line: line,
            bandKey: line.getAttribute('data-band'),
            edge: line.getAttribute('data-edge')
        };
        document.body.classList.add('sector-band-dragging');
        if (line.setPointerCapture) line.setPointerCapture(e.pointerId);
    });

    wrap.addEventListener('pointermove', function(e) {
        if (!dragState) return;
        e.preventDefault();
        onMove(e.clientY);
    });

    wrap.addEventListener('pointerup', finishDrag);
    wrap.addEventListener('pointercancel', finishDrag);
}

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

    var bandWrap = el('sector-view-bands');
    if (bandWrap) {
        bandWrap.setAttribute('aria-hidden', on ? 'false' : 'true');
    }

    rebuildCalGrid(stage);
    updateBandLinePositions(stage);
    updateBandReadout();

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

function measureStage(scroll) {
    applyLayout(scroll);
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return null;
    updateCalibrationLabels();
    return {
        stageH: stage.offsetHeight,
        viewH: scroll.clientHeight
    };
}

function remeasureAll() {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    applyRadioHitmap();
    measureStage(scroll);
    if (!isCalibrateMode()) {
        applyViewLayout(scroll);
    }
}

export function initSectorTechShell() {
    var scroll = el('sector-tech-scroll');
    if (!scroll || scroll._sectorBound) return;
    scroll._sectorBound = true;

    viewMode = getViewMode();
    loadBands();
    bindViewControls();
    bindBandLines();
    bindCrosshair();
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
            remeasureAll();
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    scroll.addEventListener('scroll', function() {
        if (isCalibrateMode()) updateViewportRulers(scroll);
    }, { passive: true });
}

export function scrollSectorTechTo() {
    /* volný scroll — nic nenutí */
}

export function refreshSectorTechLayout() {
    remeasureAll();
}
