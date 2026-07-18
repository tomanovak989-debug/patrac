/**
 * Topografické pravítko — NATO GTA, sever nahoru, MGRS ze středu kříže.
 */

import { formatMgrs, latLngToMgrs, latLngToUtm, utmToLatLng } from './mgrsCoords.js';

var _deps = null;
var _layer = null;
var _bound = false;

var PLATE_PX = 260;
/** Strana 1 km čtverce ve SVG/CSS px (při scale=1); po zamknutí = 1 km na mapě. */
var KM_SQUARE_SVG_PX = 100;
var NEON = '#78ff66';
var NEON_DIM = '#b8ffb0';
var NEON_GLOW = 'rgba(107, 255, 90, 0.55)';

var state = {
    expanded: true,
    visible: true,
    positionLocked: false,
    anchor: null,
    target: null,
    waypoints: [],
    screenX: null,
    screenY: null,
    activeRouteId: null,
    routeName: 'Trasa 1',
    mapScale: 25000
};

var mapObjs = {
    lines: [],
    hitLines: [],
    labels: [],
    readouts: [],
    markers: {}
};

var _bearingDragging = false;
var _widgetDragging = false;

function uid() {
    return 'wp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getMap() {
    return _deps && _deps.getMap ? _deps.getMap() : null;
}

function bearing(lat1, lng1, lat2, lng2) {
    return _deps.bearingDegrees(lat1, lng1, lat2, lng2);
}

function distM(lat1, lng1, lat2, lng2) {
    return _deps.distanceMeters(lat1, lng1, lat2, lng2);
}

function fmtDist(m) {
    if (_deps.formatDistance) return _deps.formatDistance(m / 1000);
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(2) + ' km';
}

function getBearingDeg() {
    if (state.anchor && state.target) {
        return bearing(state.anchor.lat, state.anchor.lng, state.target.lat, state.target.lng);
    }
    return null;
}

function chainPoints() {
    var pts = [];
    if (!state.anchor) return pts;
    pts.push(state.anchor);
    for (var i = 0; i < state.waypoints.length; i++) pts.push(state.waypoints[i]);
    if (state.target) pts.push(state.target);
    return pts;
}

function clearMapGraphics() {
    if (!_layer) return;
    var k;
    for (k = 0; k < mapObjs.lines.length; k++) _layer.removeLayer(mapObjs.lines[k]);
    for (k = 0; k < mapObjs.hitLines.length; k++) _layer.removeLayer(mapObjs.hitLines[k]);
    for (k = 0; k < mapObjs.labels.length; k++) _layer.removeLayer(mapObjs.labels[k]);
    for (k = 0; k < mapObjs.readouts.length; k++) _layer.removeLayer(mapObjs.readouts[k]);
    mapObjs.lines = [];
    mapObjs.hitLines = [];
    mapObjs.labels = [];
    mapObjs.readouts = [];
    for (k in mapObjs.markers) {
        if (mapObjs.markers.hasOwnProperty(k)) _layer.removeLayer(mapObjs.markers[k]);
    }
    mapObjs.markers = {};
}

function dotIcon(color, size) {
    return window.L.divIcon({
        className: 'topo-ruler-map-dot',
        html: '<span style="background:' + color + ';width:' + size + 'px;height:' + size + 'px"></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
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
    var pt = map.mouseEventToContainerPoint({ clientX: clientX, clientY: clientY });
    return map.containerPointToLatLng(pt);
}

function parseMgrs5Digits(lat, lng) {
    var formatted = formatFullMgrs50(lat, lng);
    var parts = formatted.split(/\s+/);
    if (parts.length >= 3) {
        return {
            easting: parts[parts.length - 2],
            northing: parts[parts.length - 1]
        };
    }
    return { easting: '00000', northing: '00000' };
}
function pad5utm(v) {
    var n = Math.round(v) % 100000;
    if (n < 0) n += 100000;
    var s = String(n);
    while (s.length < 5) s = '0' + s;
    return s.slice(-5);
}

function roundUtm50(e, n) {
    return {
        e: Math.round(e / 50) * 50,
        n: Math.round(n / 50) * 50
    };
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

function addGridReadoutLabel(lat, lng, text, kind) {
    if (!_layer || !window.L) return;
    var marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
            className: 'topo-roamer-readout topo-roamer-readout-' + kind,
            html: '<span>' + text + '</span>',
            iconSize: [0, 0]
        }),
        pane: 'mapMeasurePane',
        interactive: false
    }).addTo(_layer);
    mapObjs.readouts.push(marker);
}

function renderGridReadouts() {
    if (!state.positionLocked) return;
    var ll = getRulerOriginLatLng();
    if (!ll) return;
    var utm = latLngToUtm(ll.lat, ll.lng);
    var E0 = utm.easting;
    var N0 = utm.northing;
    var zone = utm.zone;
    var digits = parseMgrs5Digits(ll.lat, ll.lng);

    var nLine = Math.ceil(N0 / 1000) * 1000;
    if (Math.abs(nLine - N0) < 0.5) nLine += 1000;
    var pN = utmToLatLng(E0, nLine, zone, ll.lat);
    addGridReadoutLabel(pN.lat, pN.lng, digits.northing, 'northing');

    var eLine = Math.floor(E0 / 1000) * 1000;
    if (Math.abs(eLine - E0) < 0.5) eLine -= 1000;
    else if (eLine >= E0) eLine -= 1000;
    var pE = utmToLatLng(eLine, N0, zone, ll.lat);
    addGridReadoutLabel(pE.lat, pE.lng, digits.easting, 'easting');
}

function roamerTransformPoint(ox, oy, scale, rotDeg) {
    var O = 130;
    var s = scale || 1;
    var rad = (rotDeg || 0) * Math.PI / 180;
    var lx = ox - O;
    var ly = oy - O;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);
    var rx = lx * cos - ly * sin;
    var ry = lx * sin + ly * cos;
    return { x: O + rx * s, y: O + ry * s };
}

function buildRoamerGroupTransform(scale, rotDeg) {
    var parts = ['translate(130,130)'];
    if (rotDeg) parts.push('rotate(' + rotDeg + ')');
    if (scale && scale !== 1) parts.push('scale(' + scale + ')');
    parts.push('translate(-130,-130)');
    return parts.join(' ');
}

/** Úhel grid north vůči severu obrazovky (° po směru hodin) — pro srovnání roameru s km mřížkou. */
function gridConvergenceDegAt(lat, lng) {
    var map = getMap();
    if (!map || lat == null || lng == null) return 0;
    var utm = latLngToUtm(lat, lng);
    var zone = utm.zone;
    var d = 400;
    var ll0 = { lat: lat, lng: lng };
    var llN = utmToLatLng(utm.easting, utm.northing + d, zone, lat);
    var p0 = map.latLngToContainerPoint([ll0.lat, ll0.lng]);
    var pN = map.latLngToContainerPoint([llN.lat, llN.lng]);
    var nx = pN.x - p0.x;
    var ny = pN.y - p0.y;
    if (Math.abs(nx) < 0.01 && Math.abs(ny) < 0.01) return 0;
    return Math.atan2(nx, -ny) * 180 / Math.PI;
}

function syncRoamerLabels(scale, rotDeg) {
    var lbl = document.getElementById('topo-roamer-lbl');
    if (!lbl) return;
    var s = scale || 1;
    var inv = s > 0.01 ? 1 / s : 1;
    var rot = rotDeg || 0;
    var texts = lbl.querySelectorAll('text[data-ox]');
    for (var i = 0; i < texts.length; i++) {
        var t = texts[i];
        var ox = parseFloat(t.getAttribute('data-ox'));
        var oy = parseFloat(t.getAttribute('data-oy'));
        var p = roamerTransformPoint(ox, oy, s, rot);
        t.style.display = '';
        t.setAttribute(
            'transform',
            'translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ') scale(' + inv.toFixed(4) + ')'
        );
    }
}

function buildRoamerScales() {
    var g = document.getElementById('topo-roamer-scales');
    if (!g) return;
    var lblOk = document.getElementById('topo-roamer-lbl');
    if (g.getAttribute('data-built') === 'neon-v8' && lblOk) return;
    g.setAttribute('data-built', 'neon-v8');
    var O = 130;
    var L = KM_SQUARE_SVG_PX;
    var vns = ' vector-effect="non-scaling-stroke"';
    var geo = '';
    var lbl = '';
    geo += '<polygon points="' + O + ',' + O + ' ' + (O - L) + ',' + O + ' ' + O + ',' + (O - L) + '" fill="none" stroke="' + NEON + '" stroke-width="0.65"' + vns + '/>';
    geo += '<line x1="' + O + '" y1="' + O + '" x2="' + (O - L) + '" y2="' + O + '" stroke="' + NEON + '" stroke-width="0.5"' + vns + '/>';
    geo += '<line x1="' + O + '" y1="' + O + '" x2="' + O + '" y2="' + (O - L) + '" stroke="' + NEON + '" stroke-width="0.5"' + vns + '/>';
    var i;
    for (i = 0; i <= 20; i++) {
        var t = i * (L / 20);
        var big = i % 10 === 0;
        var mid = i % 2 === 0;
        var th = big ? 5 : (mid ? 3 : 2);
        var sw = big ? 0.55 : 0.35;
        geo += '<line x1="' + (O - t) + '" y1="' + O + '" x2="' + (O - t) + '" y2="' + (O + th) + '" stroke="' + NEON + '" stroke-width="' + sw + '"' + vns + '/>';
        geo += '<line x1="' + O + '" y1="' + (O - t) + '" x2="' + (O + th) + '" y2="' + (O - t) + '" stroke="' + NEON + '" stroke-width="' + sw + '"' + vns + '/>';
    }
    function lblText(ox, oy, text, anchor, weight) {
        var a = anchor || 'middle';
        var w = weight ? ' font-weight="600"' : '';
        return '<text class="topo-roamer-lbl-text" data-ox="' + ox + '" data-oy="' + oy + '" x="0" y="0" text-anchor="' + a + '" fill="' + NEON + '" font-size="8"' + w + ' font-family="IBM Plex Mono,monospace">' + text + '</text>';
    }
    lbl += lblText(O, O + 10, '0', 'middle', true);
    for (i = 1; i <= 9; i++) {
        lbl += lblText(O - i * 10, O + 10, String(i));
    }
    lbl += lblText(O - L, O + 10, '1000', 'middle', false);
    lbl += lblText(O + 8, O + 2, '0', 'start', true);
    for (i = 1; i <= 9; i++) {
        lbl += lblText(O + 8, O - i * 10 + 2, String(i), 'start', false);
    }
    lbl += lblText(O + 8, O - L + 2, '1000', 'start', false);
    g.innerHTML = '<g id="topo-roamer-geo">' + geo + '</g><g id="topo-roamer-lbl">' + lbl + '</g>';
    syncRoamerLabels(1, 0);
}

function syncScreenFromAnchor() {
    if (!state.positionLocked || !state.anchor) return;
    var map = getMap();
    var mapEl = document.getElementById('map');
    var root = document.getElementById('map-topo-ruler');
    var centerEl = document.getElementById('topo-ruler-center');
    if (!map || !mapEl || !root || !centerEl) return;

    root.classList.add('topo-ruler-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';

    if (state.screenX == null || isNaN(state.screenX)) {
        var def = getDefaultScreenPos();
        state.screenX = def.x;
        state.screenY = def.y;
        root.style.left = Math.round(state.screenX) + 'px';
        root.style.top = Math.round(state.screenY) + 'px';
    }

    var pt = map.latLngToContainerPoint([state.anchor.lat, state.anchor.lng]);
    var mapRect = mapEl.getBoundingClientRect();
    var targetX = mapRect.left + pt.x;
    var targetY = mapRect.top + pt.y;
    var iter;
    for (iter = 0; iter < 3; iter++) {
        var rootRect = root.getBoundingClientRect();
        var centerRect = centerEl.getBoundingClientRect();
        var cx = centerRect.left + centerRect.width / 2;
        var cy = centerRect.top + centerRect.height / 2;
        var left = (parseFloat(root.style.left) || rootRect.left) + (targetX - cx);
        var top = (parseFloat(root.style.top) || rootRect.top) + (targetY - cy);
        root.style.left = Math.round(left) + 'px';
        root.style.top = Math.round(top) + 'px';
    }
    state.screenX = parseFloat(root.style.left);
    state.screenY = parseFloat(root.style.top);
}

function syncAnchorFromCenter() {
    var ll = getRulerOriginLatLng();
    if (ll) state.anchor = ll;
    return ll;
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
        }
        return;
    }
    if (map.dragging) map.dragging.disable();
    if (map.touchZoom) map.touchZoom.disable();
}

function releaseInteractionLocks() {
    _bearingDragging = false;
    _widgetDragging = false;
    setMapInteractionEnabled(true);
}

var _safetyListenersBound = false;

function bindInteractionSafetyListeners() {
    if (_safetyListenersBound || typeof window === 'undefined') return;
    _safetyListenersBound = true;
    window.addEventListener('blur', releaseInteractionLocks);
    window.addEventListener('pointercancel', releaseInteractionLocks);
}

function bindWaypointMarker(marker, wpId, idx) {
    marker.bindTooltip('Bod ' + (idx + 1) + ' · klik = smazat', { direction: 'top' });
    var dragMoved = false;
    marker.on('dragstart', function() { dragMoved = false; });
    marker.on('drag', function() { dragMoved = true; });
    marker.on('dragend', function(ev) {
        var ll = ev.target.getLatLng();
        for (var wi = 0; wi < state.waypoints.length; wi++) {
            if (state.waypoints[wi].id === wpId) {
                state.waypoints[wi].lat = ll.lat;
                state.waypoints[wi].lng = ll.lng;
                break;
            }
        }
        sortWaypointsAlongRoute();
        persistState();
        renderRouteOnMap();
        updateRulerPlateVisual();
    });
    marker.on('click', function(ev) {
        window.L.DomEvent.stopPropagation(ev);
        if (dragMoved) return;
        removeWaypoint(wpId);
    });
}

function bindTargetMarker(marker) {
    marker.bindTooltip('Cíl · táhni', { direction: 'top' });
    marker.on('dragend', function(ev) {
        var ll = ev.target.getLatLng();
        state.target = { lat: ll.lat, lng: ll.lng };
        sortWaypointsAlongRoute();
        persistState();
        renderRouteOnMap();
        updateRulerPlateVisual();
    });
}

function renderRouteOnMap() {
    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer) return;
    if (state.positionLocked) renderGridReadouts();
    if (!state.anchor) return;

    var pts = chainPoints();
    if (pts.length < 1) return;

    var totalM = 0;
    for (var s = 0; s < pts.length - 1; s++) {
        (function(a, b) {
            var segM = distM(a.lat, a.lng, b.lat, b.lng);
            totalM += segM;
            var coords = [[a.lat, a.lng], [b.lat, b.lng]];
            var line = window.L.polyline(coords, {
                color: NEON, weight: 2, dashArray: '6,5', pane: 'mapMeasurePane'
            }).addTo(_layer);
            mapObjs.lines.push(line);

            var hitLine = window.L.polyline(coords, {
                color: NEON, weight: 12, opacity: 0,
                pane: 'mapMeasurePane'
            }).addTo(_layer);
            mapObjs.hitLines.push(hitLine);
            hitLine.on('click', function(e) {
                window.L.DomEvent.stopPropagation(e);
                insertWaypointAtClick(e.latlng);
            });

            var midLat = (a.lat + b.lat) / 2;
            var midLng = (a.lng + b.lng) / 2;
            var brng = bearing(a.lat, a.lng, b.lat, b.lng);
            var label = window.L.marker([midLat, midLng], {
                icon: window.L.divIcon({
                    className: 'topo-ruler-seg-label',
                    html: '<span>' + fmtDist(segM) + '<br>' + Math.round(brng) + '°</span>',
                    iconSize: [0, 0]
                }),
                pane: 'mapMeasurePane',
                interactive: false
            }).addTo(_layer);
            mapObjs.labels.push(label);
        })(pts[s], pts[s + 1]);
    }

    /* Markery až nad linkami — jinak neviditelná hit-linie blokuje tažení a klik. */
    if (state.positionLocked || state.target || state.waypoints.length) {
        mapObjs.markers.anchor = window.L.marker([state.anchor.lat, state.anchor.lng], {
            draggable: false,
            icon: dotIcon(NEON_DIM, 14),
            pane: 'mapMeasurePane',
            zIndexOffset: 900
        }).addTo(_layer);
        mapObjs.markers.anchor.bindTooltip('Střed pravítka', { direction: 'top' });
    }

    for (var w = 0; w < state.waypoints.length; w++) {
        (function(wp, idx) {
            var wpId = wp.id;
            mapObjs.markers[wpId] = window.L.marker([wp.lat, wp.lng], {
                draggable: true,
                icon: dotIcon(NEON, 16),
                pane: 'mapMeasurePane',
                wpId: wpId,
                zIndexOffset: 1000,
                riseOnHover: true,
                riseOffset: 800
            }).addTo(_layer);
            bindWaypointMarker(mapObjs.markers[wpId], wpId, idx);
        })(state.waypoints[w], w);
    }

    if (state.target) {
        mapObjs.markers.target = window.L.marker([state.target.lat, state.target.lng], {
            draggable: true,
            icon: dotIcon('#ffb366', 16),
            pane: 'mapMeasurePane',
            zIndexOffset: 1100
        }).addTo(_layer);
        bindTargetMarker(mapObjs.markers.target);
    }

    var totalEl = document.getElementById('topo-ruler-total');
    if (totalEl) {
        totalEl.textContent = pts.length > 1 ? ('Σ ' + fmtDist(totalM)) : 'Σ —';
    }
}

function insertWaypointAtClick(latlng) {
    if (!state.anchor || !state.target) return;
    var wp = { id: uid(), lat: latlng.lat, lng: latlng.lng };
    state.waypoints.push(wp);
    sortWaypointsAlongRoute();
    persistState();
    renderAll();
}

function removeWaypoint(id) {
    state.waypoints = state.waypoints.filter(function(w) { return w.id !== id; });
    persistState();
    renderAll();
}

function sortWaypointsAlongRoute() {
    if (!state.anchor || !state.target || !state.waypoints.length) return;
    var ax = state.anchor.lng;
    var ay = state.anchor.lat;
    var bx = state.target.lng;
    var by = state.target.lat;
    state.waypoints.sort(function(w1, w2) {
        return projectionT(w1.lat, w1.lng, ay, ax, by, bx) - projectionT(w2.lat, w2.lng, ay, ax, by, bx);
    });
}

function projectionT(lat, lng, ay, ax, by, bx) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return 0;
    return ((lng - ax) * dx + (lat - ay) * dy) / len2;
}

function getBodyEl() {
    return document.getElementById('topo-ruler-body');
}

function getRulerOriginLatLng() {
    var map = getMap();
    var originEl = document.getElementById('topo-ruler-center');
    var mapEl = document.getElementById('map');
    if (!map || !originEl || !mapEl) return null;
    var mapRect = mapEl.getBoundingClientRect();
    var rect = originEl.getBoundingClientRect();
    var x = rect.left + rect.width / 2 - mapRect.left;
    var y = rect.top + rect.height / 2 - mapRect.top;
    return map.containerPointToLatLng([x, y]);
}

function getPlateCenterLatLng() {
    return getRulerOriginLatLng();
}

function metersPerPixelAt(lat, lng) {
    var map = getMap();
    if (!map || !window.L) return 1;
    var p1 = map.latLngToContainerPoint(window.L.latLng(lat, lng));
    var p2 = map.latLngToContainerPoint(window.L.latLng(lat, lng + 0.001));
    var px = Math.max(0.5, Math.abs(p2.x - p1.x));
    return distM(lat, lng, lat, lng + 0.001) / px;
}

function metersPerPixel() {
    var ll = getRulerOriginLatLng();
    if (ll) return metersPerPixelAt(ll.lat, ll.lng);
    var map = getMap();
    if (!map) return 1;
    var c = map.getCenter();
    return metersPerPixelAt(c.lat, c.lng);
}

function plateScaleFactor() {
    if (!state.positionLocked) return 1;
    var mpp = metersPerPixel();
    var kmPxOnMap = 1000 / mpp;
    return kmPxOnMap / KM_SQUARE_SVG_PX;
}

function getRulerWidgetSize() {
    var root = document.getElementById('map-topo-ruler');
    return {
        w: (root && root.offsetWidth) ? root.offsetWidth : PLATE_PX,
        h: (root && root.offsetHeight) ? root.offsetHeight : PLATE_PX + 100
    };
}

/** Omezení pro position:fixed — souřadnice viewportu (window), ne Leaflet map.getSize(). */
function clampRulerScreenPos(x, y) {
    var pad = 6;
    var topPad = 38;
    var bottomPad = 6;
    var vpW = window.innerWidth;
    var vpH = window.innerHeight;
    var sz = getRulerWidgetSize();
    return {
        x: Math.max(pad, Math.min(vpW - sz.w - pad, x)),
        y: Math.max(topPad, Math.min(vpH - sz.h - bottomPad, y))
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

function sanitizeScreenPos() {
    var x = Number(state.screenX);
    var y = Number(state.screenY);
    if (!isFinite(x) || !isFinite(y)) {
        state.screenX = null;
        state.screenY = null;
        return;
    }
    var c = clampRulerScreenPos(x, y);
    state.screenX = c.x;
    state.screenY = c.y;
}

function ensureRulerOnScreen() {
    if (state.positionLocked || _widgetDragging) return;
    var root = document.getElementById('map-topo-ruler');
    if (!root || root.style.display === 'none') return;
    var rect = root.getBoundingClientRect();
    var pad = 12;
    var off = rect.top < pad || rect.left < pad ||
        rect.bottom > window.innerHeight - pad ||
        rect.right > window.innerWidth - pad;
    if (!off) return;
    var x = parseFloat(root.style.left);
    var y = parseFloat(root.style.top);
    if (isNaN(x)) x = rect.left;
    if (isNaN(y)) y = rect.top;
    var c = clampRulerScreenPos(x, y);
    state.screenX = c.x;
    state.screenY = c.y;
    root.classList.remove('topo-ruler-docked');
    root.classList.add('topo-ruler-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = Math.round(c.x) + 'px';
    root.style.top = Math.round(c.y) + 'px';
    persistState();
}

function dockBottomPx() {
    var compassDock = window.innerWidth <= 480 ? 48 : 108;
    return compassDock + 56;
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

function updateRulerWidgetPosition() {
    var root = document.getElementById('map-topo-ruler');
    var body = getBodyEl();
    if (!root || !body) return;

    if (root.classList.contains('topo-ruler-collapsed')) {
        root.classList.remove('topo-ruler-positioned');
        root.classList.add('topo-ruler-docked');
        root.style.left = '';
        root.style.top = '';
        root.style.right = (window.innerWidth <= 480 ? 6 : 12) + 'px';
        root.style.bottom = dockBottomPx() + 'px';
        return;
    }
    root.classList.remove('topo-ruler-docked');
    root.classList.add('topo-ruler-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';

    if (state.positionLocked && state.anchor) {
        updateRulerPlateVisual();
        syncScreenFromAnchor();
        return;
    }

    sanitizeScreenPos();

    if (state.screenX == null || state.screenY == null) {
        var def = getDefaultScreenPos();
        state.screenX = def.x;
        state.screenY = def.y;
    }

    root.style.left = Math.round(state.screenX) + 'px';
    root.style.top = Math.round(state.screenY) + 'px';

    updateRulerPlateVisual();
    ensureRulerOnScreen();
    if (!state.positionLocked) {
        syncAnchorFromCenter();
    }
}

function updateRulerPlateVisual() {
    var plate = document.getElementById('topo-ruler-plate');
    var degEl = document.getElementById('topo-ruler-bearing');
    var scaleEl = document.getElementById('topo-ruler-scale');
    var mgrsEl = document.getElementById('topo-ruler-mgrs');
    var centerEl = document.getElementById('topo-ruler-center');
    if (!plate) return;

    var brng = getBearingDeg();
    var scale = plateScaleFactor();
    plate.style.transform = 'rotate(0deg)';

    var centerLl = (state.positionLocked && state.anchor)
        ? state.anchor
        : getRulerOriginLatLng();
    var gridRot = centerLl ? gridConvergenceDegAt(centerLl.lat, centerLl.lng) : 0;
    var roamerScale = state.positionLocked ? scale : 1;

    var geo = document.getElementById('topo-roamer-geo');
    if (geo) {
        geo.setAttribute('transform', buildRoamerGroupTransform(roamerScale, gridRot));
    }
    syncRoamerLabels(roamerScale, gridRot);

    if (centerEl) {
        var rotStr = Math.abs(gridRot) > 0.02 ? (' rotate(' + gridRot.toFixed(2) + 'deg)') : '';
        centerEl.style.transform = rotStr ? rotStr.trim() : '';
    }

    if (degEl) {
        if (!state.positionLocked) {
            degEl.textContent = '🔓 zamkni polohu';
        } else if (brng != null) {
            degEl.textContent = Math.round(brng) + '° směrník';
        } else {
            degEl.textContent = 'Táhni ze středu';
        }
    }

    if (mgrsEl && centerLl) {
        try {
            mgrsEl.textContent = formatFullMgrs50(centerLl.lat, centerLl.lng);
        } catch (e) {
            mgrsEl.textContent = '—';
        }
    }

    if (scaleEl) {
        var mpp = metersPerPixelAt(
            centerLl ? centerLl.lat : (getMap() ? getMap().getCenter().lat : 0),
            centerLl ? centerLl.lng : (getMap() ? getMap().getCenter().lng : 0)
        );
        var map = getMap();
        var zoom = map ? map.getZoom() : 0;
        var kmPx = Math.round(1000 / mpp);
        if (state.positionLocked) {
            scaleEl.textContent = '1 km □ = ' + kmPx + ' px · z' + zoom + ' · 1 díl = 50 m';
        } else {
            scaleEl.textContent = 'z' + zoom + ' · 1 km ≈ ' + kmPx + ' px';
        }
    }
}

function renderAll() {
    try {
        updateRulerWidgetPosition();
        renderRouteOnMap();
        updateLockUi();
        if (_deps && _deps.onUiUpdate) _deps.onUiUpdate();
        if (_deps && _deps.refreshMgrsGrid) _deps.refreshMgrsGrid();
        if (typeof window !== 'undefined' && typeof window.patracUpdateMgrsReadout === 'function') {
            window.patracUpdateMgrsReadout();
        }
    } catch (err) {
        console.error('[topoRuler] renderAll', err);
    }
}

function persistState() {
    try {
        localStorage.setItem('patrac_topo_ruler_state', JSON.stringify({
            positionLocked: state.positionLocked,
            anchor: state.anchor,
            target: state.target,
            waypoints: state.waypoints,
            screenX: state.screenX,
            screenY: state.screenY,
            routeName: state.routeName,
            activeRouteId: state.activeRouteId,
            expanded: state.expanded,
            mapScale: state.mapScale
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
        if (data.waypoints) state.waypoints = data.waypoints;
        if (typeof data.positionLocked === 'boolean') {
            state.positionLocked = data.positionLocked;
        } else {
            state.positionLocked = !!data.anchored;
        }
        state.screenX = data.screenX;
        state.screenY = data.screenY;
        state.routeName = data.routeName || state.routeName;
        state.activeRouteId = data.activeRouteId || null;
        if (typeof data.expanded === 'boolean') state.expanded = data.expanded;
        if (data.mapScale) state.mapScale = parseInt(data.mapScale, 10) || 25000;
        sanitizeScreenPos();
    } catch (e) {}
}

function updateLockUi() {
    var lockBtn = document.getElementById('topo-ruler-lock');
    var moveBtn = document.getElementById('topo-ruler-move');
    var centerEl = document.getElementById('topo-ruler-center');
    if (lockBtn) {
        lockBtn.textContent = state.positionLocked ? '🔒' : '🔓';
        lockBtn.classList.toggle('is-locked', state.positionLocked);
        lockBtn.title = state.positionLocked ? 'Odemknout polohu' : 'Zamknout polohu';
    }
    if (moveBtn) {
        moveBtn.disabled = state.positionLocked;
        moveBtn.classList.toggle('is-disabled', state.positionLocked);
    }
    if (centerEl) {
        centerEl.classList.toggle('is-locked', state.positionLocked);
        centerEl.title = state.positionLocked
            ? 'Táhni směrník k cíli na mapě'
            : 'Zamkni polohu pravítka (🔓)';
    }
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
    updateLockUi();
    persistState();
    renderAll();
}

function addMidpointWaypoint() {
    var pts = chainPoints();
    if (pts.length < 2) return;
    var longest = 0;
    var insertIdx = 0;
    var mid = null;
    for (var i = 0; i < pts.length - 1; i++) {
        var d = distM(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
        if (d > longest) {
            longest = d;
            insertIdx = i;
            mid = {
                lat: (pts[i].lat + pts[i + 1].lat) / 2,
                lng: (pts[i].lng + pts[i + 1].lng) / 2
            };
        }
    }
    if (!mid) return;
    var wp = { id: uid(), lat: mid.lat, lng: mid.lng };
    if (insertIdx === 0) state.waypoints.unshift(wp);
    else if (insertIdx >= state.waypoints.length) state.waypoints.push(wp);
    else state.waypoints.splice(insertIdx, 0, wp);
    persistState();
    renderAll();
}

function saveRoute() {
    var routes = loadRoutes();
    var id = state.activeRouteId || uid();
    var name = state.routeName || ('Trasa ' + (routes.length + 1));
    var entry = {
        id: id,
        name: name,
        anchor: state.anchor,
        target: state.target,
        waypoints: state.waypoints.slice(),
        positionLocked: state.positionLocked,
        savedAt: Date.now()
    };
    var found = false;
    for (var i = 0; i < routes.length; i++) {
        if (routes[i].id === id) {
            routes[i] = entry;
            found = true;
            break;
        }
    }
    if (!found) routes.push(entry);
    try {
        localStorage.setItem('patrac_topo_routes', JSON.stringify(routes));
    } catch (e) {}
    state.activeRouteId = id;
    persistState();
    refreshRouteSelect();
}

function loadRoutes() {
    try {
        return JSON.parse(localStorage.getItem('patrac_topo_routes') || '[]');
    } catch (e) {
        return [];
    }
}

function loadRouteById(id) {
    var routes = loadRoutes();
    for (var i = 0; i < routes.length; i++) {
        if (routes[i].id === id) {
            var r = routes[i];
            state.activeRouteId = r.id;
            state.routeName = r.name;
            state.anchor = r.anchor;
            state.target = r.target;
            state.waypoints = r.waypoints || [];
            if (typeof r.positionLocked === 'boolean') state.positionLocked = r.positionLocked;
            persistState();
            renderAll();
            return;
        }
    }
}

function refreshRouteSelect() {
    var sel = document.getElementById('topo-ruler-route-select');
    if (!sel) return;
    var routes = loadRoutes();
    var html = '<option value="">— trasa —</option>';
    for (var i = 0; i < routes.length; i++) {
        html += '<option value="' + routes[i].id + '">' + routes[i].name + '</option>';
    }
    sel.innerHTML = html;
    if (state.activeRouteId) sel.value = state.activeRouteId;
}

function bindDragOnlyOnHandle(handle, onDrag, onDragEnd) {
    if (!handle || handle._topoDragBound) return;
    handle._topoDragBound = true;
    var moving = false;
    var start = null;
    var origin = null;
    function ptr(e) {
        return { x: e.touches ? e.touches[0].clientX : e.clientX, y: e.touches ? e.touches[0].clientY : e.clientY };
    }
    function onStart(e) {
        if (state.positionLocked) return;
        moving = false;
        start = ptr(e);
        origin = onDrag('start', start, null);
        e.preventDefault();
        e.stopPropagation();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }
    function onMove(e) {
        if (!start) return;
        var p = ptr(e);
        var dx = p.x - start.x;
        var dy = p.y - start.y;
        if (!moving && Math.hypot(dx, dy) < 6) return;
        moving = true;
        e.preventDefault();
        onDrag('move', { dx: dx, dy: dy }, origin);
    }
    function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        if (moving && onDragEnd) onDragEnd();
        moving = false;
        start = null;
        _widgetDragging = false;
        setMapInteractionEnabled(true);
    }
    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function updateBearingPreview() {
    if (state.positionLocked) syncScreenFromAnchor();
    else syncAnchorFromCenter();
    renderRouteOnMap();
    updateRulerPlateVisual();
    if (_deps && _deps.onUiUpdate) _deps.onUiUpdate();
    if (typeof window !== 'undefined' && typeof window.patracUpdateMgrsReadout === 'function') {
        window.patracUpdateMgrsReadout();
    }
}

function bindBearingDrag(handle) {
    if (!handle || handle._bearingBound) return;
    handle._bearingBound = true;
    var dragging = false;
    var moved = false;

    function detachDoc() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
    }

    function onMove(e) {
        if (!state.positionLocked || !dragging) return;
        moved = true;
        var ll = pointerEventToLatLng(e);
        if (ll) state.target = { lat: ll.lat, lng: ll.lng };
        updateBearingPreview();
        e.preventDefault();
    }

    function onEnd() {
        detachDoc();
        var hadMove = moved;
        dragging = false;
        moved = false;
        _bearingDragging = false;
        setMapInteractionEnabled(true);
        if (hadMove) persistState();
    }

    function onStart(e) {
        if (!state.positionLocked) return;
        if (e.button != null && e.button !== 0) return;
        dragging = true;
        moved = false;
        _bearingDragging = true;
        setMapInteractionEnabled(false);
        e.preventDefault();
        e.stopPropagation();
        detachDoc();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
        document.addEventListener('pointerup', onEnd);
        document.addEventListener('pointercancel', onEnd);
        var ll = pointerEventToLatLng(e);
        if (ll) {
            state.target = { lat: ll.lat, lng: ll.lng };
            updateBearingPreview();
        }
    }

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function initInteractions() {
    var root = document.getElementById('map-topo-ruler');
    var toggle = document.getElementById('btn-topo-ruler-toggle');
    var moveHandle = document.getElementById('topo-ruler-move');
    var lockBtn = document.getElementById('topo-ruler-lock');
    var pinCenter = document.getElementById('topo-ruler-center');
    var btnSave = document.getElementById('btn-topo-save-route');
    var routeSel = document.getElementById('topo-ruler-route-select');
    var nameInput = document.getElementById('topo-ruler-route-name');

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

    if (lockBtn && !lockBtn._bound) {
        lockBtn._bound = true;
        lockBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            togglePositionLock();
        });
    }

    bindDragOnlyOnHandle(moveHandle, function(phase, p, origin) {
        if (phase === 'start') {
            _widgetDragging = true;
            if (root) {
                root.classList.remove('topo-ruler-docked');
                root.classList.add('topo-ruler-positioned');
                root.style.right = 'auto';
                root.style.bottom = 'auto';
            }
            captureScreenPos();
            if (state.screenX == null || state.screenY == null) {
                var def = getDefaultScreenPos();
                state.screenX = def.x;
                state.screenY = def.y;
            }
            if (root) {
                root.style.left = Math.round(state.screenX) + 'px';
                root.style.top = Math.round(state.screenY) + 'px';
            }
            return { x: state.screenX, y: state.screenY };
        }
        var c = clampRulerScreenPos(origin.x + p.dx, origin.y + p.dy);
        state.screenX = c.x;
        state.screenY = c.y;
        if (root) {
            root.style.left = Math.round(state.screenX) + 'px';
            root.style.top = Math.round(state.screenY) + 'px';
        }
        syncAnchorFromCenter();
        updateRulerPlateVisual();
    }, function() {
        _widgetDragging = false;
        setMapInteractionEnabled(true);
        persistState();
        renderAll();
    });

    bindBearingDrag(pinCenter);

    if (btnSave && !btnSave._bound) {
        btnSave._bound = true;
        btnSave.addEventListener('click', function(e) {
            e.preventDefault();
            if (nameInput) state.routeName = nameInput.value || state.routeName;
            saveRoute();
        });
    }

    if (routeSel && !routeSel._bound) {
        routeSel._bound = true;
        routeSel.addEventListener('change', function() {
            if (routeSel.value) loadRouteById(routeSel.value);
        });
    }
}

function bindMapEvents() {
    if (_bound) return;
    var map = getMap();
    if (!map) return;
    _bound = true;
    map.on('move zoom zoomend moveend resize', function() {
        if (_bearingDragging) return;
        updateRulerWidgetPosition();
        renderRouteOnMap();
        if (typeof window !== 'undefined' && typeof window.ensureMapTouchPan === 'function') {
            window.ensureMapTouchPan();
        }
        if (typeof window !== 'undefined' && typeof window.patracUpdateMgrsReadout === 'function') {
            window.patracUpdateMgrsReadout();
        }
    });
}

export function initTopoRuler(deps) {
    _deps = deps;
    var map = getMap();
    if (!map) return;
    if (!_layer) _layer = deps.routeLayer || null;
    loadState();
    var root = document.getElementById('map-topo-ruler');
    if (root) {
        root.classList.toggle('topo-ruler-collapsed', !state.expanded);
        var toggle = document.getElementById('btn-topo-ruler-toggle');
        if (toggle) toggle.textContent = state.expanded ? '−' : '📐';
    }
    refreshRouteSelect();
    updateLockUi();
    buildRoamerScales();
    initInteractions();
    bindInteractionSafetyListeners();
    bindMapEvents();
    renderAll();
}

export function updateTopoRulerDisplay(show) {
    var root = document.getElementById('map-topo-ruler');
    if (!root) return;
    state.visible = show !== false;
    root.style.display = state.visible ? 'block' : 'none';
    root.classList.toggle('is-ready', state.visible);
    if (state.visible) {
        renderAll();
        requestAnimationFrame(function() {
            ensureRulerOnScreen();
            updateRulerPlateVisual();
        });
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
