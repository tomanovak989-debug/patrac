/**
 * Topografické pravítko — plovoucí směrník s trasou, body a ukládáním.
 */

var _deps = null;
var _layer = null;
var _bound = false;

var state = {
    expanded: true,
    visible: true,
    anchored: false,
    anchor: null,
    target: null,
    waypoints: [],
    screenX: null,
    screenY: null,
    activeRouteId: null,
    routeName: 'Trasa 1'
};

var mapObjs = {
    lines: [],
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
    for (k = 0; k < mapObjs.labels.length; k++) _layer.removeLayer(mapObjs.labels[k]);
    mapObjs.lines = [];
    mapObjs.labels = [];
    for (k in mapObjs.markers) {
        if (mapObjs.markers.hasOwnProperty(k)) _layer.removeLayer(mapObjs.markers[k]);
    }
    mapObjs.markers = {};
}

function makeDraggableMarker(latlng, opts, onDragEnd) {
    var map = getMap();
    if (!map || !window.L) return null;
    var m = L.circleMarker(latlng, opts).addTo(_layer);
    m.on('dragend', function() {
        var ll = m.getLatLng();
        onDragEnd(ll.lat, ll.lng);
    });
    return m;
}

function renderRouteOnMap() {
    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer || !state.anchor) return;

    var pts = chainPoints();
    if (pts.length < 1) return;

    function dotIcon(color, size) {
        return L.divIcon({
            className: 'topo-ruler-map-dot',
            html: '<span style="background:' + color + ';width:' + size + 'px;height:' + size + 'px"></span>',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    }

    if (state.anchored) {
        mapObjs.markers.anchor = L.marker([state.anchor.lat, state.anchor.lng], {
            draggable: true, icon: dotIcon('#ffc850', 12), pane: 'mapMeasurePane'
        }).addTo(_layer);
        mapObjs.markers.anchor.bindTooltip('A · pravítko', { direction: 'top' });
        mapObjs.markers.anchor.on('dragend', function() {
            var ll = mapObjs.markers.anchor.getLatLng();
            state.anchor = { lat: ll.lat, lng: ll.lng };
            persistState();
            renderAll();
        });
    }

    for (var w = 0; w < state.waypoints.length; w++) {
        (function(wp, idx) {
            mapObjs.markers[wp.id] = L.marker([wp.lat, wp.lng], {
                draggable: true, icon: dotIcon('#4af626', 10), pane: 'mapMeasurePane'
            }).addTo(_layer);
            mapObjs.markers[wp.id].bindTooltip('Bod ' + (idx + 1), { direction: 'top' });
            mapObjs.markers[wp.id].on('dragend', function() {
                var ll = mapObjs.markers[wp.id].getLatLng();
                wp.lat = ll.lat;
                wp.lng = ll.lng;
                sortWaypointsAlongRoute();
                persistState();
                renderAll();
            });
        })(state.waypoints[w], w);
    }

    if (state.target) {
        mapObjs.markers.target = L.marker([state.target.lat, state.target.lng], {
            draggable: true, icon: dotIcon('#00ccff', 12), pane: 'mapMeasurePane'
        }).addTo(_layer);
        mapObjs.markers.target.bindTooltip('Cíl', { direction: 'top' });
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
        var a = pts[s];
        var b = pts[s + 1];
        var segM = distM(a.lat, a.lng, b.lat, b.lng);
        totalM += segM;
        var line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
            color: '#00ccff', weight: 2, dashArray: '6,5', pane: 'mapMeasurePane'
        }).addTo(_layer);
        mapObjs.lines.push(line);

        var midLat = (a.lat + b.lat) / 2;
        var midLng = (a.lng + b.lng) / 2;
        var brng = bearing(a.lat, a.lng, b.lat, b.lng);
        var label = L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'topo-ruler-seg-label',
                html: '<span>' + fmtDist(segM) + '<br>' + Math.round(brng) + '°</span>',
                iconSize: [0, 0]
            }),
            pane: 'mapMeasurePane',
            interactive: false
        }).addTo(_layer);
        mapObjs.labels.push(label);

        line.on('click', function(e) {
            if (!state.target) return;
            L.DomEvent.stopPropagation(e);
            insertWaypointAtClick(e.latlng);
        });
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

function sortWaypointsAlongRoute() {
    if (!state.anchor || !state.target || !state.waypoints.length) return;
    var ax = state.anchor.lng;
    var ay = state.anchor.lat;
    var bx = state.target.lng;
    var by = state.target.lat;
    state.waypoints.sort(function(w1, w2) {
        var t1 = projectionT(w1.lat, w1.lng, ay, ax, by, bx);
        var t2 = projectionT(w2.lat, w2.lng, ay, ax, by, bx);
        return t1 - t2;
    });
}

function projectionT(lat, lng, ay, ax, by, bx) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return 0;
    return ((lng - ax) * dx + (lat - ay) * dy) / len2;
}

function getRulerCenterLatLng() {
    var map = getMap();
    var el = document.getElementById('topo-ruler-body');
    var mapEl = document.getElementById('map');
    if (!map || !el || !mapEl) return null;
    var mapRect = mapEl.getBoundingClientRect();
    var rect = el.getBoundingClientRect();
    var x = rect.left + rect.width / 2 - mapRect.left;
    var y = rect.top + rect.height / 2 - mapRect.top;
    var ll = map.containerPointToLatLng([x, y]);
    return { lat: ll.lat, lng: ll.lng };
}

function getDefaultScreenPos() {
    var map = getMap();
    if (!map) return { x: 40, y: 80 };
    var size = map.getSize();
    return { x: Math.max(12, size.x * 0.35), y: Math.max(60, size.y * 0.35) };
}

function dockBottomPx() {
    var compassDock = window.innerWidth <= 480 ? 48 : 108;
    return compassDock + 56;
}

function updateRulerWidgetPosition() {
    var root = document.getElementById('map-topo-ruler');
    var body = document.getElementById('topo-ruler-body');
    if (!root || !body) return;
    var map = getMap();

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

    if (state.anchored && state.anchor && map) {
        var pt = map.latLngToContainerPoint([state.anchor.lat, state.anchor.lng]);
        root.classList.add('topo-ruler-positioned');
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        root.style.left = Math.round(pt.x - root.offsetWidth / 2) + 'px';
        root.style.top = Math.round(pt.y - root.offsetHeight / 2) + 'px';
    } else {
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
    }

    updateRulerArmVisual();
}

function updateRulerArmVisual() {
    var arm = document.getElementById('topo-ruler-arm');
    var degEl = document.getElementById('topo-ruler-bearing');
    var scaleEl = document.getElementById('topo-ruler-scale');
    if (!arm) return;

    if (!state.anchor || !state.target) {
        arm.style.width = '120px';
        arm.style.transform = 'rotate(0deg)';
        if (degEl) degEl.textContent = '—°';
        if (scaleEl) scaleEl.textContent = '';
        return;
    }

    var map = getMap();
    if (!map) return;
    var p1 = map.latLngToContainerPoint([state.anchor.lat, state.anchor.lng]);
    var p2 = map.latLngToContainerPoint([state.target.lat, state.target.lng]);
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    var pxLen = Math.sqrt(dx * dx + dy * dy);
    var brng = bearing(state.anchor.lat, state.anchor.lng, state.target.lat, state.target.lng);
    var totalM = distM(state.anchor.lat, state.anchor.lng, state.target.lat, state.target.lng);

    arm.style.width = Math.max(80, Math.min(pxLen, 420)) + 'px';
    arm.style.transform = 'rotate(' + (Math.atan2(dx, -dy) * 180 / Math.PI) + 'deg)';
    if (degEl) degEl.textContent = Math.round(brng) + '°';

    if (scaleEl) {
        var zoom = map.getZoom();
        var tickM = zoom >= 16 ? 50 : (zoom >= 14 ? 100 : (zoom >= 12 ? 250 : 500));
        var ticks = Math.max(1, Math.round(totalM / tickM));
        var parts = [];
        for (var t = 1; t <= Math.min(ticks, 8); t++) {
            parts.push(t * tickM + 'm');
        }
        scaleEl.textContent = parts.join(' · ') + ' · ' + fmtDist(totalM);
    }
}

function renderAll() {
    updateRulerWidgetPosition();
    renderRouteOnMap();
    if (_deps.onUiUpdate) _deps.onUiUpdate();
}

function persistState() {
    try {
        localStorage.setItem('patrac_topo_ruler_state', JSON.stringify({
            anchored: state.anchored,
            anchor: state.anchor,
            target: state.target,
            waypoints: state.waypoints,
            screenX: state.screenX,
            screenY: state.screenY,
            routeName: state.routeName,
            activeRouteId: state.activeRouteId,
            expanded: state.expanded
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
        state.anchored = !!data.anchored;
        state.screenX = data.screenX;
        state.screenY = data.screenY;
        state.routeName = data.routeName || state.routeName;
        state.activeRouteId = data.activeRouteId || null;
        if (typeof data.expanded === 'boolean') state.expanded = data.expanded;
    } catch (e) {}
}

function updatePinCenterUi() {
    var el = document.getElementById('topo-ruler-center');
    if (el) el.classList.toggle('anchored', !!state.anchored);
}

function toggleAnchor() {
    if (state.anchored) {
        state.anchored = false;
    } else {
        var ll = getRulerCenterLatLng();
        if (!ll) return;
        state.anchor = ll;
        state.anchored = true;
    }
    updatePinCenterUi();
    persistState();
    renderAll();
}

function setTargetFromArmEnd() {
    if (!state.anchor) return;
    var map = getMap();
    var tip = document.getElementById('topo-ruler-tip');
    var mapEl = document.getElementById('map');
    if (!map || !tip || !mapEl) return;
    var mapRect = mapEl.getBoundingClientRect();
    var rect = tip.getBoundingClientRect();
    var x = rect.left + rect.width / 2 - mapRect.left;
    var y = rect.top + rect.height / 2 - mapRect.top;
    var ll = map.containerPointToLatLng([x, y]);
    state.target = { lat: ll.lat, lng: ll.lng };
    sortWaypointsAlongRoute();
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
            state.anchored = !!r.anchor;
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

function initInteractions() {
    var root = document.getElementById('map-topo-ruler');
    var toggle = document.getElementById('btn-topo-ruler-toggle');
    var moveHandle = document.getElementById('topo-ruler-move');
    var tipHandle = document.getElementById('topo-ruler-tip');
    var pinCenter = document.getElementById('topo-ruler-center');
    var btnWp = document.getElementById('btn-topo-add-wp');
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

    bindDragOnlyOnHandle(moveHandle, function(phase, p, origin) {
        if (phase === 'start') {
            if (state.anchored && state.anchor) {
                state.anchored = false;
                var pt = getMap().latLngToContainerPoint([state.anchor.lat, state.anchor.lng]);
                state.screenX = pt.x - root.offsetWidth / 2;
                state.screenY = pt.y - root.offsetHeight / 2;
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

    if (tipHandle && !tipHandle._topoTipBound) {
        tipHandle._topoTipBound = true;
        function ptr(e) {
            return { x: e.touches ? e.touches[0].clientX : e.clientX, y: e.touches ? e.touches[0].clientY : e.clientY };
        }
        function onTipMove(e) {
            var map = getMap();
            var mapEl = document.getElementById('map');
            if (!map || !mapEl || !state.anchor) return;
            e.preventDefault();
            var p = ptr(e);
            var mapRect = mapEl.getBoundingClientRect();
            var ll = map.containerPointToLatLng([p.x - mapRect.left, p.y - mapRect.top]);
            state.target = { lat: ll.lat, lng: ll.lng };
            renderAll();
        }
        function onTipEnd() {
            document.removeEventListener('mousemove', onTipMove);
            document.removeEventListener('touchmove', onTipMove);
            document.removeEventListener('mouseup', onTipEnd);
            document.removeEventListener('touchend', onTipEnd);
            persistState();
        }
        function onTipStart(e) {
            if (!state.anchor) {
                var ll = getRulerCenterLatLng();
                if (ll) {
                    state.anchor = ll;
                    state.anchored = true;
                    updatePinCenterUi();
                }
            }
            e.preventDefault();
            e.stopPropagation();
            document.addEventListener('mousemove', onTipMove);
            document.addEventListener('touchmove', onTipMove, { passive: false });
            document.addEventListener('mouseup', onTipEnd);
            document.addEventListener('touchend', onTipEnd);
        }
        tipHandle.addEventListener('mousedown', onTipStart);
        tipHandle.addEventListener('touchstart', onTipStart, { passive: false });
    }

    if (pinCenter && !pinCenter._bound) {
        pinCenter._bound = true;
        pinCenter.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleAnchor();
        });
    }

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
        updateRulerWidgetPosition();
        renderRouteOnMap();
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
    updatePinCenterUi();
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
