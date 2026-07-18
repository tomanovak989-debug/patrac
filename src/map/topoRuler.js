/**
 * Topografické pravítko — roamer na mapě, MGRS odečet, směrník po zamknutí.
 */

import { latLngToMgrs, latLngToUtm, utmToLatLng, toPoint } from './mgrsCoords.js';

var _deps = null;
var _layer = null;
var _bound = false;

var PLATE_PX = 260;
var KM_SQUARE_SVG_PX = 100;
var NEON = '#78ff66';

var state = {
    expanded: true,
    visible: true,
    positionLocked: false,
    anchor: null,
    target: null,
    screenX: null,
    screenY: null,
    gzd: '33U',
    square: 'UR',
    coordW: '',
    coordN: '',
    _coordEditing: false
};

var mapObjs = { lines: [], markers: {} };
var _bearingDragging = false;
var _widgetDragging = false;
var _fabLongPressFired = false;

function getMap() {
    return _deps && _deps.getMap ? _deps.getMap() : null;
}

function bearing(lat1, lng1, lat2, lng2) {
    return _deps.bearingDegrees(lat1, lng1, lat2, lng2);
}

function getBearingDeg() {
    if (state.anchor && state.target) {
        return bearing(state.anchor.lat, state.anchor.lng, state.target.lat, state.target.lng);
    }
    return null;
}

function clearMapGraphics() {
    if (!_layer) return;
    var k;
    for (k = 0; k < mapObjs.lines.length; k++) _layer.removeLayer(mapObjs.lines[k]);
    mapObjs.lines = [];
    for (k in mapObjs.markers) {
        if (mapObjs.markers.hasOwnProperty(k)) _layer.removeLayer(mapObjs.markers[k]);
    }
    mapObjs.markers = {};
}

function utmWithin100k(v) {
    var n = Math.floor(v + 1e-3) % 100000;
    if (n < 0) n += 100000;
    return n;
}

function pad5(v) {
    var s = String(utmWithin100k(v));
    while (s.length < 5) s = '0' + s;
    return s;
}

function roundUtm50(e, n) {
    return { e: Math.round(e / 50) * 50, n: Math.round(n / 50) * 50 };
}

function formatFullMgrs50(lat, lng) {
    var utm = latLngToUtm(lat, lng);
    var r = roundUtm50(utm.easting, utm.northing);
    var pt = utmToLatLng(r.e, r.n, utm.zone, lat);
    var raw = latLngToMgrs(pt.lat, pt.lng, 5).replace(/\s/g, '').toUpperCase();
    var i = 0;
    while (i < raw.length && raw.charAt(i) >= '0' && raw.charAt(i) <= '9') i++;
    var head = raw.substring(0, i) + raw.charAt(i) + raw.substring(i + 1, i + 3);
    i += 3;
    var rest = raw.substring(i);
    var half = rest.length / 2;
    return head + ' ' + rest.substring(0, half) + ' ' + rest.substring(half);
}

function parseMgrsHead(lat, lng) {
    var raw = latLngToMgrs(lat, lng, 5).replace(/\s/g, '').toUpperCase();
    var i = 0;
    while (i < raw.length && raw.charAt(i) >= '0' && raw.charAt(i) <= '9') i++;
    var zn = raw.substring(0, i);
    var zl = raw.charAt(i++);
    var sq = raw.substring(i, i + 2);
    return { gzd: zn + zl, square: sq, zone: parseInt(zn, 10), zoneLetter: zl };
}

function digitsAtLatLng(lat, lng) {
    var utm = latLngToUtm(lat, lng);
    return { w: pad5(utm.easting), n: pad5(utm.northing) };
}

function buildMgrsString(w5, n5) {
    var gzd = (state.gzd || '33U').replace(/\s/g, '').toUpperCase();
    var sq = (state.square || 'UR').replace(/\s/g, '').toUpperCase().slice(0, 2);
    var w = String(w5 || '00000').replace(/\D/g, '').padStart(5, '0').slice(-5);
    var n = String(n5 || '00000').replace(/\D/g, '').padStart(5, '0').slice(-5);
    var i = 0;
    while (i < gzd.length && gzd.charAt(i) >= '0' && gzd.charAt(i) <= '9') i++;
    return gzd + sq + w + n;
}

function latLngFromCoordInputs(w5, n5) {
    try {
        var pt = toPoint(buildMgrsString(w5, n5));
        return { lat: pt[1], lng: pt[0] };
    } catch (e) {
        return null;
    }
}

function normalizeDeg(deg) {
    var d = deg % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

function gridRotDegForRoamer(lat, lng) {
    var map = getMap();
    if (!map || lat == null || lng == null) return 0;
    var utm = latLngToUtm(lat, lng);
    var zone = utm.zone;
    var p0 = map.latLngToContainerPoint([lat, lng]);
    var pN = map.latLngToContainerPoint(utmToLatLng(utm.easting, utm.northing + 1000, zone, lat));
    var nx = pN.x - p0.x;
    var ny = pN.y - p0.y;
    if (Math.hypot(nx, ny) < 0.5) return 0;
    var gridNorthDeg = Math.atan2(ny, nx) * 180 / Math.PI;
    return normalizeDeg(gridNorthDeg - 180);
}

function getPlateCenterScreenPoint() {
    var root = document.getElementById('map-topo-ruler');
    var plateWrap = document.querySelector('.topo-ruler-plate-wrap');
    if (!root || !plateWrap) return null;
    var rootLeft = parseFloat(root.style.left);
    var rootTop = parseFloat(root.style.top);
    if (isNaN(rootLeft) || isNaN(rootTop)) {
        var r = root.getBoundingClientRect();
        rootLeft = r.left;
        rootTop = r.top;
    }
    return {
        x: rootLeft + plateWrap.offsetLeft + plateWrap.offsetWidth * 0.5,
        y: rootTop + plateWrap.offsetTop + plateWrap.offsetHeight * 0.5
    };
}

function syncRoamerLabels(scale) {
    var lbl = document.getElementById('topo-roamer-lbl');
    if (!lbl) return;
    var s = scale || 1;
    var inv = s > 0.01 ? 1 / s : 1;
    var texts = lbl.querySelectorAll('text[data-ox]');
    for (var i = 0; i < texts.length; i++) {
        var t = texts[i];
        var ox = parseFloat(t.getAttribute('data-ox'));
        var oy = parseFloat(t.getAttribute('data-oy'));
        var rot = t.getAttribute('data-rot');
        t.setAttribute('x', String(ox));
        t.setAttribute('y', String(oy));
        var needsTransform = (Math.abs(inv - 1) > 0.001) || rot;
        if (needsTransform) {
            var parts = ['translate(' + ox + ',' + oy + ')'];
            if (rot) parts.push('rotate(' + rot + ')');
            if (Math.abs(inv - 1) > 0.001) parts.push('scale(' + inv.toFixed(4) + ')');
            parts.push('translate(' + (-ox) + ',' + (-oy) + ')');
            t.setAttribute('transform', parts.join(' '));
        } else {
            t.removeAttribute('transform');
        }
    }
}

function buildRoamerScales() {
    var g = document.getElementById('topo-roamer-scales');
    if (!g) return;
    if (g.getAttribute('data-built') === 'neon-v15') return;
    g.setAttribute('data-built', 'neon-v15');
    var O = 130;
    var L = KM_SQUARE_SVG_PX;
    var vns = ' vector-effect="non-scaling-stroke"';
    var geo = '';
    var lbl = '';
    geo += '<polygon points="' + O + ',' + O + ' ' + (O - L) + ',' + O + ' ' + O + ',' + (O + L) + '" fill="none" stroke="' + NEON + '" stroke-width="0.65"' + vns + '/>';
    geo += '<line x1="' + O + '" y1="' + O + '" x2="' + (O - L) + '" y2="' + O + '" stroke="' + NEON + '" stroke-width="0.5"' + vns + '/>';
    geo += '<line x1="' + O + '" y1="' + O + '" x2="' + O + '" y2="' + (O + L) + '" stroke="' + NEON + '" stroke-width="0.5"' + vns + '/>';
    var i;
    for (i = 0; i <= 20; i++) {
        var t = i * (L / 20);
        var big = i % 10 === 0;
        var mid = i % 2 === 0;
        var th = big ? 5 : (mid ? 3 : 2);
        var sw = big ? 0.55 : 0.35;
        geo += '<line x1="' + (O - t) + '" y1="' + O + '" x2="' + (O - t) + '" y2="' + (O - th) + '" stroke="' + NEON + '" stroke-width="' + sw + '"' + vns + '/>';
        geo += '<line x1="' + O + '" y1="' + (O + t) + '" x2="' + (O - th) + '" y2="' + (O + t) + '" stroke="' + NEON + '" stroke-width="' + sw + '"' + vns + '/>';
    }
    function roamer2(v) {
        var s = String(v);
        while (s.length < 2) s = '0' + s;
        return s.slice(-2);
    }
    function lblText(ox, oy, text, anchor, weight, rotDeg) {
        var a = anchor || 'middle';
        var w = weight ? ' font-weight="600"' : '';
        var rotAttr = rotDeg != null ? (' data-rot="' + rotDeg + '"') : '';
        return '<text class="topo-roamer-lbl-text" data-ox="' + ox + '" data-oy="' + oy + '"' + rotAttr + ' x="0" y="0" text-anchor="' + a + '" fill="' + NEON + '" font-size="8"' + w + ' font-family="IBM Plex Mono,monospace">' + text + '</text>';
    }
    lbl += lblText(O, O - 10, roamer2(0), 'middle', true, -90);
    for (i = 1; i <= 9; i++) lbl += lblText(O - i * 10, O - 10, roamer2(i), 'middle', false, -90);
    lbl += lblText(O - L, O - 10, roamer2(10), 'middle', false, -90);
    lbl += lblText(O + 8, O + 2, roamer2(0), 'start', true);
    for (i = 1; i <= 9; i++) lbl += lblText(O + 8, O + i * 10 + 2, roamer2(i), 'start', false);
    lbl += lblText(O + 8, O + L + 2, roamer2(10), 'start', false);
    g.innerHTML = '<g id="topo-roamer-geo">' + geo + '</g><g id="topo-roamer-lbl">' + lbl + '</g>';
    syncRoamerLabels(1);
}

function getRulerOriginLatLng() {
    var map = getMap();
    var mapEl = document.getElementById('map');
    var pt = getPlateCenterScreenPoint();
    if (!map || !mapEl || !pt) return null;
    var mapRect = mapEl.getBoundingClientRect();
    return map.containerPointToLatLng([pt.x - mapRect.left, pt.y - mapRect.top]);
}

function getRulerWidgetSize() {
    var root = document.getElementById('map-topo-ruler');
    return {
        w: (root && root.offsetWidth) ? root.offsetWidth : PLATE_PX,
        h: (root && root.offsetHeight) ? root.offsetHeight : PLATE_PX + 48
    };
}

function clampRulerScreenPos(x, y) {
    var pad = 6;
    var topPad = 38;
    var vpW = window.innerWidth;
    var vpH = window.innerHeight;
    var sz = getRulerWidgetSize();
    return {
        x: Math.max(pad, Math.min(vpW - sz.w - pad, x)),
        y: Math.max(topPad, Math.min(vpH - sz.h - pad, y))
    };
}

function getDefaultScreenPos() {
    var vpW = window.innerWidth;
    var vpH = window.innerHeight;
    var sz = getRulerWidgetSize();
    return {
        x: Math.max(12, vpW * 0.5 - sz.w / 2),
        y: Math.max(38, Math.min(vpH * 0.32, vpH - sz.h - 12))
    };
}

function captureScreenPos() {
    var root = document.getElementById('map-topo-ruler');
    if (!root) return;
    var left = parseFloat(root.style.left);
    var top = parseFloat(root.style.top);
    if (!isNaN(left) && !isNaN(top) && root.classList.contains('topo-ruler-positioned')) {
        state.screenX = left;
        state.screenY = top;
        return;
    }
    var rect = root.getBoundingClientRect();
    state.screenX = rect.left;
    state.screenY = rect.top;
}

function placeRulerCenterAtLatLng(lat, lng) {
    var map = getMap();
    var mapEl = document.getElementById('map');
    var root = document.getElementById('map-topo-ruler');
    if (!map || !mapEl || !root) return;

    state.anchor = { lat: lat, lng: lng };
    root.classList.remove('topo-ruler-docked');
    root.classList.add('topo-ruler-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';

    var pt = map.latLngToContainerPoint([lat, lng]);
    var mapRect = mapEl.getBoundingClientRect();
    var targetX = mapRect.left + pt.x;
    var targetY = mapRect.top + pt.y;

    if (state.screenX == null || isNaN(state.screenX)) {
        var def = getDefaultScreenPos();
        state.screenX = def.x;
        state.screenY = def.y;
    }
    root.style.left = Math.round(state.screenX) + 'px';
    root.style.top = Math.round(state.screenY) + 'px';

    var iter;
    for (iter = 0; iter < 4; iter++) {
        var centerPt = getPlateCenterScreenPoint();
        if (!centerPt) break;
        var left = (parseFloat(root.style.left) || 0) + (targetX - centerPt.x);
        var top = (parseFloat(root.style.top) || 0) + (targetY - centerPt.y);
        var c = clampRulerScreenPos(left, top);
        root.style.left = Math.round(c.x) + 'px';
        root.style.top = Math.round(c.y) + 'px';
        state.screenX = c.x;
        state.screenY = c.y;
    }
}

function syncScreenFromAnchor() {
    if (!state.positionLocked || !state.anchor) return;
    placeRulerCenterAtLatLng(state.anchor.lat, state.anchor.lng);
}

function syncAnchorFromCenter() {
    var ll = getRulerOriginLatLng();
    if (ll) state.anchor = ll;
    return ll;
}

function syncCoordFieldsFromPosition() {
    if (state._coordEditing) return;
    var ll = getRulerOriginLatLng();
    if (!ll) return;
    var head = parseMgrsHead(ll.lat, ll.lng);
    state.gzd = head.gzd;
    state.square = head.square;
    var d = digitsAtLatLng(ll.lat, ll.lng);
    state.coordW = d.w;
    state.coordN = d.n;
    var gzdEl = document.getElementById('topo-ruler-gzd');
    var sqEl = document.getElementById('topo-ruler-square');
    var wEl = document.getElementById('topo-ruler-coord-w');
    var nEl = document.getElementById('topo-ruler-coord-n');
    if (gzdEl && document.activeElement !== gzdEl) gzdEl.value = state.gzd;
    if (sqEl && document.activeElement !== sqEl) sqEl.value = state.square;
    if (wEl && document.activeElement !== wEl) wEl.value = state.coordW;
    if (nEl && document.activeElement !== nEl) nEl.value = state.coordN;
}

function applyCoordAxis(axis) {
    var wEl = document.getElementById('topo-ruler-coord-w');
    var nEl = document.getElementById('topo-ruler-coord-n');
    var gzdEl = document.getElementById('topo-ruler-gzd');
    var sqEl = document.getElementById('topo-ruler-square');
    if (gzdEl) state.gzd = gzdEl.value.trim().toUpperCase() || state.gzd;
    if (sqEl) state.square = sqEl.value.trim().toUpperCase().slice(0, 2) || state.square;
    var w5 = wEl ? wEl.value.replace(/\D/g, '').padStart(5, '0').slice(-5) : state.coordW;
    var n5 = nEl ? nEl.value.replace(/\D/g, '').padStart(5, '0').slice(-5) : state.coordN;
    state.coordW = w5;
    state.coordN = n5;

    var ll = getRulerOriginLatLng();
    if (!ll && axis !== 'both') return;

    if (axis === 'w' && ll) {
        var utm = latLngToUtm(ll.lat, ll.lng);
        var zone = utm.zone;
        var baseE = Math.floor(utm.easting / 100000) * 100000;
        var newE = baseE + parseInt(w5, 10);
        var ptW = utmToLatLng(newE, utm.northing, zone, ll.lat);
        placeRulerCenterAtLatLng(ptW.lat, ptW.lng);
    } else if (axis === 'n' && ll) {
        var utmN = latLngToUtm(ll.lat, ll.lng);
        var zoneN = utmN.zone;
        var baseN = Math.floor(utmN.northing / 100000) * 100000;
        var newN = baseN + parseInt(n5, 10);
        var ptN = utmToLatLng(utmN.easting, newN, zoneN, ll.lat);
        placeRulerCenterAtLatLng(ptN.lat, ptN.lng);
    } else {
        var full = latLngFromCoordInputs(w5, n5);
        if (full) placeRulerCenterAtLatLng(full.lat, full.lng);
    }
    syncCoordFieldsFromPosition();
    persistState();
    updateRulerPlateVisual();
    renderBearingOnMap();
}

function setMapInteractionEnabled(on) {
    var map = getMap();
    if (!map) return;
    if (on) {
        if (typeof window !== 'undefined' && typeof window.ensureMapTouchPan === 'function') {
            window.ensureMapTouchPan();
        } else {
            if (map.dragging) map.dragging.enable();
            if (map.touchZoom) map.touchZoom.enable();
            if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
            if (map.doubleClickZoom) map.doubleClickZoom.enable();
        }
        return;
    }
    /* Pravítko je overlay — mapu neblokujeme (zabraňuje zaseknutí zoomu / kurzoru). */
}

function releaseInteractionLocks() {
    _bearingDragging = false;
    _widgetDragging = false;
    document.body.style.cursor = '';
    setMapInteractionEnabled(true);
}

var _safetyListenersBound = false;

function bindInteractionSafetyListeners() {
    if (_safetyListenersBound || typeof window === 'undefined') return;
    _safetyListenersBound = true;
    window.addEventListener('blur', releaseInteractionLocks);
    window.addEventListener('pointercancel', releaseInteractionLocks);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') releaseInteractionLocks();
    });
}

function syncFabLockUi() {
    var fab = document.getElementById('fab-topo-ruler');
    if (!fab) return;
    fab.classList.toggle('is-locked', state.positionLocked);
    fab.title = state.positionLocked
        ? 'Pravítko zamčeno · podrž 2 s = odemknout'
        : 'Pravítko · podrž 2 s = zamknout';
    fab.setAttribute('aria-label', state.positionLocked ? 'Pravítko zamčeno' : 'Pravítko');
}

function renderBearingOnMap() {
    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer || !state.positionLocked || !state.anchor) return;

    if (state.target) {
        var coords = [[state.anchor.lat, state.anchor.lng], [state.target.lat, state.target.lng]];
        var line = window.L.polyline(coords, {
            color: NEON, weight: 2, dashArray: '6,5', pane: 'mapMeasurePane'
        }).addTo(_layer);
        mapObjs.lines.push(line);
        mapObjs.markers.target = window.L.marker([state.target.lat, state.target.lng], {
            draggable: false,
            icon: window.L.divIcon({
                className: 'topo-ruler-map-dot',
                html: '<span style="background:#ffb366;width:12px;height:12px"></span>',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            }),
            pane: 'mapMeasurePane',
            zIndexOffset: 1000
        }).addTo(_layer);
    }
}

function updateRulerPlateVisual() {
    var degEl = document.getElementById('topo-ruler-bearing');
    var dragSurface = document.getElementById('topo-ruler-drag-surface');
    var centerEl = document.getElementById('topo-ruler-center');
    var plate = document.getElementById('topo-ruler-plate');
    var plateWrap = document.querySelector('.topo-ruler-plate-wrap');
    var wEl = document.getElementById('topo-ruler-coord-w');
    var nEl = document.getElementById('topo-ruler-coord-n');

    var centerLl = (state.positionLocked && state.anchor)
        ? state.anchor
        : getRulerOriginLatLng();
    var gridRot = centerLl ? gridRotDegForRoamer(centerLl.lat, centerLl.lng) : 0;

    if (plateWrap) plateWrap.style.transform = '';
    if (plate) {
        plate.style.transform = Math.abs(gridRot) > 0.01
            ? ('rotate(' + gridRot.toFixed(2) + 'deg)')
            : '';
    }

    var scales = document.getElementById('topo-roamer-scales');
    if (scales) scales.removeAttribute('transform');

    syncRoamerLabels(1);

    if (centerEl) {
        centerEl.style.transform = '';
        centerEl.classList.toggle('is-locked', state.positionLocked);
    }

    var locked = state.positionLocked;
    if (wEl) {
        wEl.readOnly = locked;
        wEl.classList.toggle('is-readonly', locked);
    }
    if (nEl) {
        nEl.readOnly = locked;
        nEl.classList.toggle('is-readonly', locked);
    }
    ['topo-ruler-gzd', 'topo-ruler-square'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.readOnly = locked;
            el.classList.toggle('is-readonly', locked);
        }
    });

    syncCoordFieldsFromPosition();

    var brng = getBearingDeg();
    if (degEl) {
        if (locked && brng != null) degEl.textContent = Math.round(brng) + '° směrník';
        else if (locked) degEl.textContent = 'Táhni směrník ze středu';
        else degEl.textContent = '';
    }
    if (dragSurface) dragSurface.classList.toggle('is-locked', locked);
    syncFabLockUi();
}

function updateRulerWidgetPosition() {
    var root = document.getElementById('map-topo-ruler');
    if (!root) return;

    if (root.classList.contains('topo-ruler-collapsed')) {
        root.classList.remove('topo-ruler-positioned');
        root.classList.add('topo-ruler-docked');
        root.style.left = '';
        root.style.top = '';
        root.style.right = (window.innerWidth <= 480 ? 6 : 12) + 'px';
        root.style.bottom = (window.innerWidth <= 480 ? 48 : 108) + 56 + 'px';
        return;
    }

    root.classList.remove('topo-ruler-docked');
    root.classList.add('topo-ruler-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';

    if (state.positionLocked && state.anchor) {
        syncScreenFromAnchor();
        updateRulerPlateVisual();
        renderBearingOnMap();
        return;
    }

    if (state.screenX == null || state.screenY == null) {
        var def = getDefaultScreenPos();
        state.screenX = def.x;
        state.screenY = def.y;
    }
    var c = clampRulerScreenPos(state.screenX, state.screenY);
    state.screenX = c.x;
    state.screenY = c.y;
    root.style.left = Math.round(state.screenX) + 'px';
    root.style.top = Math.round(state.screenY) + 'px';

    updateRulerPlateVisual();
    if (!state.positionLocked) syncAnchorFromCenter();
    renderBearingOnMap();
}

function persistState() {
    try {
        localStorage.setItem('patrac_topo_ruler_state', JSON.stringify({
            positionLocked: state.positionLocked,
            anchor: state.anchor,
            target: state.target,
            screenX: state.screenX,
            screenY: state.screenY,
            expanded: state.expanded,
            gzd: state.gzd,
            square: state.square,
            coordW: state.coordW,
            coordN: state.coordN
        }));
    } catch (e) {}
}

function loadState() {
    try {
        var raw = localStorage.getItem('patrac_topo_ruler_state');
        if (!raw) return;
        var data = JSON.parse(raw);
        if (data.anchor) state.anchor = data.anchor;
        if (data.target) state.target = data.target;
        if (typeof data.positionLocked === 'boolean') state.positionLocked = data.positionLocked;
        state.screenX = data.screenX;
        state.screenY = data.screenY;
        if (typeof data.expanded === 'boolean') state.expanded = data.expanded;
        if (data.gzd) state.gzd = data.gzd;
        if (data.square) state.square = data.square;
        if (data.coordW) state.coordW = data.coordW;
        if (data.coordN) state.coordN = data.coordN;
    } catch (e) {}
}

function togglePositionLock() {
    if (!state.positionLocked) {
        captureScreenPos();
        state.positionLocked = true;
        syncAnchorFromCenter();
    } else {
        state.positionLocked = false;
        releaseInteractionLocks();
        captureScreenPos();
        syncAnchorFromCenter();
    }
    persistState();
    updateRulerWidgetPosition();
}

function pointerEventToLatLng(e) {
    var map = getMap();
    if (!map || !window.L) return null;
    var clientX = e.clientX;
    var clientY = e.clientY;
    if (e.touches && e.touches.length) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }
    return map.containerPointToLatLng(map.mouseEventToContainerPoint({ clientX: clientX, clientY: clientY }));
}

function bindWidgetDrag(surface) {
    if (!surface || surface._topoDragBound) return;
    surface._topoDragBound = true;
    var root = document.getElementById('map-topo-ruler');
    var moving = false;
    var start = null;
    var origin = null;
    var activePointer = null;

    function isDragHandle(target) {
        return target && target.closest && target.closest('input, select, button, .topo-ruler-center, .topo-ruler-zone-bar');
    }

    function ptrXY(e) {
        if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function detachDoc() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
    }

    function onStart(e) {
        if (state.positionLocked) return;
        if (isDragHandle(e.target)) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        moving = false;
        start = ptrXY(e);
        activePointer = e.pointerId != null ? e.pointerId : null;
        _widgetDragging = true;
        captureScreenPos();
        if (state.screenX == null) {
            var def = getDefaultScreenPos();
            state.screenX = def.x;
            state.screenY = def.y;
        }
        origin = { x: state.screenX, y: state.screenY };
        if (root) {
            root.classList.remove('topo-ruler-docked');
            root.classList.add('topo-ruler-positioned');
            root.style.right = 'auto';
            root.style.bottom = 'auto';
        }
        detachDoc();
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onEnd);
        document.addEventListener('pointercancel', onEnd);
    }

    function onMove(e) {
        if (!start || !origin) return;
        if (activePointer != null && e.pointerId != null && e.pointerId !== activePointer) return;
        var p = ptrXY(e);
        var dx = p.x - start.x;
        var dy = p.y - start.y;
        if (!moving && Math.hypot(dx, dy) < 4) return;
        if (!moving) {
            moving = true;
            surface.classList.add('is-dragging');
            surface.style.touchAction = 'none';
            document.body.style.cursor = 'grabbing';
        }
        var c = clampRulerScreenPos(origin.x + dx, origin.y + dy);
        state.screenX = c.x;
        state.screenY = c.y;
        if (root) {
            root.style.left = Math.round(c.x) + 'px';
            root.style.top = Math.round(c.y) + 'px';
        }
        syncAnchorFromCenter();
        syncCoordFieldsFromPosition();
        updateRulerPlateVisual();
        e.preventDefault();
    }

    function onEnd(e) {
        if (activePointer != null && e && e.pointerId != null && e.pointerId !== activePointer) return;
        detachDoc();
        document.body.style.cursor = '';
        surface.classList.remove('is-dragging');
        surface.style.touchAction = '';
        _widgetDragging = false;
        if (moving) persistState();
        moving = false;
        start = null;
        origin = null;
        activePointer = null;
    }

    surface.addEventListener('pointerdown', onStart);
}

function bindBearingDrag(handle) {
    if (!handle || handle._bearingBound) return;
    handle._bearingBound = true;
    var dragging = false;
    var activePointer = null;

    function detachDoc() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
    }

    function onMove(e) {
        if (!state.positionLocked || !dragging) return;
        if (activePointer != null && e.pointerId != null && e.pointerId !== activePointer) return;
        var ll = pointerEventToLatLng(e);
        if (ll) state.target = { lat: ll.lat, lng: ll.lng };
        renderBearingOnMap();
        updateRulerPlateVisual();
        e.preventDefault();
    }

    function onEnd(e) {
        if (activePointer != null && e && e.pointerId != null && e.pointerId !== activePointer) return;
        detachDoc();
        document.body.style.cursor = '';
        dragging = false;
        _bearingDragging = false;
        activePointer = null;
        persistState();
    }

    function onStart(e) {
        if (!state.positionLocked) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        _bearingDragging = true;
        activePointer = e.pointerId != null ? e.pointerId : null;
        document.body.style.cursor = 'crosshair';
        e.preventDefault();
        e.stopPropagation();
        detachDoc();
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onEnd);
        document.addEventListener('pointercancel', onEnd);
        var ll = pointerEventToLatLng(e);
        if (ll) {
            state.target = { lat: ll.lat, lng: ll.lng };
            renderBearingOnMap();
            updateRulerPlateVisual();
        }
    }

    handle.addEventListener('pointerdown', onStart);
}

function bindCoordInputs() {
    var wEl = document.getElementById('topo-ruler-coord-w');
    var nEl = document.getElementById('topo-ruler-coord-n');
    var gzdEl = document.getElementById('topo-ruler-gzd');
    var sqEl = document.getElementById('topo-ruler-square');

    function bind(el, axis) {
        if (!el || el._bound) return;
        el._bound = true;
        el.addEventListener('focus', function() { state._coordEditing = true; });
        el.addEventListener('blur', function() {
            state._coordEditing = false;
            if (state.positionLocked) return;
            applyCoordAxis(axis);
        });
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    }
    bind(wEl, 'w');
    bind(nEl, 'n');
    if (gzdEl && !gzdEl._bound) {
        gzdEl._bound = true;
        gzdEl.addEventListener('blur', function() {
            if (!state.positionLocked) applyCoordAxis('both');
        });
    }
    if (sqEl && !sqEl._bound) {
        sqEl._bound = true;
        sqEl.addEventListener('blur', function() {
            if (!state.positionLocked) applyCoordAxis('both');
        });
    }
}

function bindFabLongPress() {
    var fab = document.getElementById('fab-topo-ruler');
    if (!fab || fab._longPressBound) return;
    fab._longPressBound = true;
    var timer = null;

    function clearTimer() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function onPressStart(e) {
        clearTimer();
        _fabLongPressFired = false;
        timer = setTimeout(function() {
            timer = null;
            _fabLongPressFired = true;
            togglePositionLock();
            if (navigator.vibrate) navigator.vibrate(30);
        }, 2000);
    }

    fab.addEventListener('mousedown', onPressStart);
    fab.addEventListener('touchstart', onPressStart, { passive: true });
    fab.addEventListener('mouseup', clearTimer);
    fab.addEventListener('mouseleave', clearTimer);
    fab.addEventListener('touchend', clearTimer);
    fab.addEventListener('touchcancel', clearTimer);

    var origToggle = window.patracToggleTopoRuler;
    window.patracToggleTopoRuler = function() {
        if (_fabLongPressFired) {
            _fabLongPressFired = false;
            return;
        }
        if (origToggle) origToggle();
    };
}

function initInteractions() {
    var root = document.getElementById('map-topo-ruler');
    var toggle = document.getElementById('btn-topo-ruler-toggle');
    var dragSurface = document.getElementById('topo-ruler-drag-surface');
    var pinCenter = document.getElementById('topo-ruler-center');

    if (toggle && !toggle._bound) {
        toggle._bound = true;
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            state.expanded = !state.expanded;
            root.classList.toggle('topo-ruler-collapsed', !state.expanded);
            toggle.textContent = state.expanded ? '−' : '📐';
            persistState();
            updateRulerWidgetPosition();
        });
    }

    bindWidgetDrag(dragSurface || root);
    bindBearingDrag(pinCenter);
    bindCoordInputs();
    bindFabLongPress();
    bindInteractionSafetyListeners();
}

function bindMapEvents() {
    if (_bound) return;
    var map = getMap();
    if (!map) return;
    _bound = true;
    map.on('move zoom zoomend moveend resize', function() {
        if (_bearingDragging || _widgetDragging) return;
        releaseInteractionLocks();
        updateRulerWidgetPosition();
    });
}

export function initTopoRuler(deps) {
    _deps = deps;
    if (!_layer) _layer = deps.routeLayer || null;
    loadState();
    var root = document.getElementById('map-topo-ruler');
    if (root) {
        root.classList.toggle('topo-ruler-collapsed', !state.expanded);
        var toggle = document.getElementById('btn-topo-ruler-toggle');
        if (toggle) toggle.textContent = state.expanded ? '−' : '📐';
    }
    buildRoamerScales();
    initInteractions();
    bindMapEvents();
    syncFabLockUi();
    updateRulerWidgetPosition();
}

export function updateTopoRulerDisplay(show) {
    var root = document.getElementById('map-topo-ruler');
    if (!root) return;
    state.visible = show !== false;
    root.style.display = state.visible ? 'block' : 'none';
    root.classList.toggle('is-ready', state.visible);
    if (state.visible) {
        requestAnimationFrame(function() {
            updateRulerWidgetPosition();
        });
    } else {
        clearMapGraphics();
    }
}

export function getTopoRulerState() {
    return state;
}

export function formatRulerMgrs50(lat, lng) {
    return formatFullMgrs50(lat, lng);
}

export function getRulerCenterLatLng() {
    if (!state.visible) return null;
    if (state.positionLocked && state.anchor) return { lat: state.anchor.lat, lng: state.anchor.lng };
    return getRulerOriginLatLng();
}

export function wasFabLongPress() {
    return _fabLongPressFired;
}
