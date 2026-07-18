/**
 * Topografické pravítko — NATO GTA, sever nahoru, MGRS ze středu kříže.
 */

import { formatMgrs, latLngToMgrs } from './mgrsCoords.js';

var _deps = null;
var _layer = null;
var _bound = false;

var PLATE_PX = 260;
var REF_1000M_PX = 52;
var GREEN = '#4af626';
var GREEN_DIM = '#8fd87a';

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
    markers: {}
};

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
    mapObjs.lines = [];
    mapObjs.hitLines = [];
    mapObjs.labels = [];
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

function syncAnchorFromCenter() {
    var ll = getPlateCenterLatLng();
    if (ll) state.anchor = ll;
    return ll;
}

function renderRouteOnMap() {
    if (state.positionLocked) syncAnchorFromCenter();

    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer || !state.anchor) return;

    var pts = chainPoints();
    if (pts.length < 1) return;

    if (state.positionLocked || state.target || state.waypoints.length) {
        mapObjs.markers.anchor = window.L.marker([state.anchor.lat, state.anchor.lng], {
            draggable: !state.positionLocked,
            icon: dotIcon(GREEN_DIM, 12),
            pane: 'mapMeasurePane'
        }).addTo(_layer);
        mapObjs.markers.anchor.bindTooltip('Střed pravítka', { direction: 'top' });
        if (!state.positionLocked) {
            mapObjs.markers.anchor.on('dragend', function() {
                var ll = mapObjs.markers.anchor.getLatLng();
                state.anchor = { lat: ll.lat, lng: ll.lng };
                persistState();
                renderAll();
            });
        }
    }

    for (var w = 0; w < state.waypoints.length; w++) {
        (function(wp, idx) {
            mapObjs.markers[wp.id] = window.L.marker([wp.lat, wp.lng], {
                draggable: true,
                icon: dotIcon(GREEN, 10),
                pane: 'mapMeasurePane'
            }).addTo(_layer);
            mapObjs.markers[wp.id].bindTooltip('Bod ' + (idx + 1) + ' · klik = smazat', { direction: 'top' });
            mapObjs.markers[wp.id].on('dragend', function() {
                var ll = mapObjs.markers[wp.id].getLatLng();
                wp.lat = ll.lat;
                wp.lng = ll.lng;
                sortWaypointsAlongRoute();
                persistState();
                renderAll();
            });
            mapObjs.markers[wp.id].on('click', function(e) {
                window.L.DomEvent.stopPropagation(e);
                removeWaypoint(wp.id);
            });
        })(state.waypoints[w], w);
    }

    if (state.target) {
        mapObjs.markers.target = window.L.marker([state.target.lat, state.target.lng], {
            draggable: true,
            icon: dotIcon('#8dff6a', 12),
            pane: 'mapMeasurePane'
        }).addTo(_layer);
        mapObjs.markers.target.bindTooltip('Cíl · táhni', { direction: 'top' });
        mapObjs.markers.target.on('dragend', function() {
            var ll = mapObjs.markers.target.getLatLng();
            state.target = { lat: ll.lat, lng: ll.lng };
            sortWaypointsAlongRoute();
            persistState();
            renderAll();
        });
    }

    var totalM = 0;
    for (var s = 0; s < pts.length - 1; s++) {
        (function(a, b) {
            var segM = distM(a.lat, a.lng, b.lat, b.lng);
            totalM += segM;
            var coords = [[a.lat, a.lng], [b.lat, b.lng]];
            var line = window.L.polyline(coords, {
                color: GREEN, weight: 2, dashArray: '6,5', pane: 'mapMeasurePane'
            }).addTo(_layer);
            mapObjs.lines.push(line);

            var hitLine = window.L.polyline(coords, {
                color: GREEN, weight: 14, opacity: 0,
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

function getPlateCenterLatLng() {
    var map = getMap();
    var centerEl = document.getElementById('topo-ruler-center');
    var mapEl = document.getElementById('map');
    if (!map || !centerEl || !mapEl) return null;
    var mapRect = mapEl.getBoundingClientRect();
    var rect = centerEl.getBoundingClientRect();
    var x = rect.left + rect.width / 2 - mapRect.left;
    var y = rect.top + rect.height / 2 - mapRect.top;
    return map.containerPointToLatLng([x, y]);
}

function metersPerPixel() {
    var map = getMap();
    if (!map) return 1;
    var c = map.getCenter();
    var p1 = map.latLngToContainerPoint(c);
    var p2 = map.latLngToContainerPoint(window.L.latLng(c.lat, c.lng + 0.001));
    var px = Math.max(0.5, Math.abs(p2.x - p1.x));
    return distM(c.lat, c.lng, c.lat, c.lng + 0.001) / px;
}

function plateScaleFactor() {
    if (!state.positionLocked) return 1;
    var mpp = metersPerPixel();
    return Math.max(0.35, Math.min(2.5, (1000 / mpp) / REF_1000M_PX));
}

function getDefaultScreenPos() {
    var map = getMap();
    if (!map) return { x: 40, y: 80 };
    var size = map.getSize();
    return { x: Math.max(12, size.x * 0.5 - PLATE_PX / 2), y: Math.max(60, size.y * 0.38) };
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
    if (!isNaN(left) && !isNaN(top)) {
        state.screenX = left;
        state.screenY = top;
    }
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

    if (state.screenX == null || state.screenY == null) {
        var def = getDefaultScreenPos();
        state.screenX = def.x;
        state.screenY = def.y;
    }

    root.classList.add('topo-ruler-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = Math.round(state.screenX) + 'px';
    root.style.top = Math.round(state.screenY) + 'px';

    updateRulerPlateVisual();
}

function updateRulerPlateVisual() {
    var plate = document.getElementById('topo-ruler-plate');
    var degEl = document.getElementById('topo-ruler-bearing');
    var scaleEl = document.getElementById('topo-ruler-scale');
    var mgrsEl = document.getElementById('topo-ruler-mgrs');
    if (!plate) return;

    var brng = getBearingDeg();
    var scale = plateScaleFactor();
    plate.style.transform = 'rotate(0deg) scale(' + scale + ')';

    if (degEl) {
        if (!state.positionLocked) {
            degEl.textContent = '🔓 zamkni polohu';
        } else if (brng != null) {
            degEl.textContent = Math.round(brng) + '° směrník';
        } else {
            degEl.textContent = 'Táhni ze středu';
        }
    }

    var centerLl = getPlateCenterLatLng();
    if (mgrsEl && centerLl) {
        try {
            mgrsEl.textContent = formatMgrs(latLngToMgrs(centerLl.lat, centerLl.lng, 3));
        } catch (e) {
            mgrsEl.textContent = '—';
        }
    }

    if (scaleEl) {
        var mpp = metersPerPixel();
        var map = getMap();
        var zoom = map ? map.getZoom() : 0;
        scaleEl.textContent = '1:' + state.mapScale + ' · z' + zoom + ' · 1km≈' + Math.round(1000 / mpp) + 'px';
    }
}

function renderAll() {
    updateRulerWidgetPosition();
    renderRouteOnMap();
    updateLockUi();
    if (_deps.onUiUpdate) _deps.onUiUpdate();
    if (_deps.refreshMgrsGrid) _deps.refreshMgrsGrid();
    if (typeof window !== 'undefined' && typeof window.patracUpdateMgrsReadout === 'function') {
        window.patracUpdateMgrsReadout();
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
    }
    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function bindBearingDrag(handle) {
    if (!handle || handle._bearingBound) return;
    handle._bearingBound = true;
    var dragging = false;
    function onMove(e) {
        if (!state.positionLocked) return;
        syncAnchorFromCenter();
        var ll = pointerEventToLatLng(e);
        if (ll) state.target = { lat: ll.lat, lng: ll.lng };
        renderAll();
        e.preventDefault();
    }
    function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        if (dragging) persistState();
        dragging = false;
    }
    function onStart(e) {
        if (!state.positionLocked) return;
        dragging = false;
        syncAnchorFromCenter();
        e.preventDefault();
        e.stopPropagation();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
        var ll = pointerEventToLatLng(e);
        if (ll) {
            dragging = true;
            state.target = { lat: ll.lat, lng: ll.lng };
            renderAll();
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
    var btnWp = document.getElementById('btn-topo-add-wp');
    var btnSave = document.getElementById('btn-topo-save-route');
    var routeSel = document.getElementById('topo-ruler-route-select');
    var nameInput = document.getElementById('topo-ruler-route-name');
    var scaleSel = document.getElementById('topo-ruler-map-scale');

    if (scaleSel && !scaleSel._bound) {
        scaleSel._bound = true;
        scaleSel.value = String(state.mapScale);
        scaleSel.addEventListener('change', function() {
            state.mapScale = parseInt(scaleSel.value, 10) || 25000;
            persistState();
            updateRulerPlateVisual();
        });
    }

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
            if (state.screenX == null || state.screenY == null) {
                captureScreenPos();
            }
            if (state.screenX == null || state.screenY == null) {
                var def = getDefaultScreenPos();
                state.screenX = def.x;
                state.screenY = def.y;
            }
            return { x: state.screenX, y: state.screenY };
        }
        var map = getMap();
        var size = map ? map.getSize() : { x: 400, y: 400 };
        state.screenX = Math.max(0, Math.min(size.x - root.offsetWidth, origin.x + p.dx));
        state.screenY = Math.max(0, Math.min(size.y - root.offsetHeight, origin.y + p.dy));
        updateRulerWidgetPosition();
    }, function() {
        persistState();
        renderAll();
    });

    bindBearingDrag(pinCenter);

    if (btnWp && !btnWp._bound) {
        btnWp._bound = true;
        btnWp.addEventListener('click', function(e) {
            e.preventDefault();
            addMidpointWaypoint();
        });
    }

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
        if (state.positionLocked) syncAnchorFromCenter();
        updateRulerWidgetPosition();
        renderRouteOnMap();
        updateRulerPlateVisual();
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
    var scaleSel = document.getElementById('topo-ruler-map-scale');
    if (scaleSel) scaleSel.value = String(state.mapScale);
    refreshRouteSelect();
    updateLockUi();
    initInteractions();
    bindMapEvents();
    renderAll();
}

export function updateTopoRulerDisplay(show) {
    var root = document.getElementById('map-topo-ruler');
    if (!root) return;
    state.visible = show !== false;
    root.style.display = state.visible ? 'block' : 'none';
    if (state.visible) renderAll();
}

export function getTopoRulerState() {
    return state;
}

export function getRulerCenterLatLng() {
    if (!state.visible) return null;
    return getPlateCenterLatLng();
}
