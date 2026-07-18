/**
 * Plánovač trasy — body na přímce, uložení tras (odděleno od pravítka).
 */

var _deps = null;
var _layer = null;
var _bound = false;

var NEON = '#78ff66';

var state = {
    visible: false,
    expanded: true,
    anchor: null,
    target: null,
    waypoints: [],
    activeRouteId: null,
    routeName: 'Trasa 1',
    screenX: null,
    screenY: null
};

var mapObjs = { lines: [], hitLines: [], labels: [], markers: {} };

function uid() {
    return 'rp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
        className: 'route-planner-dot',
        html: '<span style="background:' + color + ';width:' + size + 'px;height:' + size + 'px"></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

function projectionT(lat, lng, ay, ax, by, bx) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return 0;
    return ((lng - ax) * dx + (lat - ay) * dy) / len2;
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
    });
}

function renderRouteOnMap() {
    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer || !state.visible) return;
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
                color: NEON, weight: 14, opacity: 0, pane: 'mapMeasurePane'
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
                    className: 'route-planner-seg-label',
                    html: '<span>' + fmtDist(segM) + '<br>' + Math.round(brng) + '°</span>',
                    iconSize: [0, 0]
                }),
                pane: 'mapMeasurePane',
                interactive: false
            }).addTo(_layer);
            mapObjs.labels.push(label);
        })(pts[s], pts[s + 1]);
    }

    mapObjs.markers.anchor = window.L.marker([state.anchor.lat, state.anchor.lng], {
        draggable: true,
        icon: dotIcon('#b8ffb0', 14),
        pane: 'mapMeasurePane',
        zIndexOffset: 900
    }).addTo(_layer);
    mapObjs.markers.anchor.bindTooltip('Start trasy · táhni', { direction: 'top' });
    mapObjs.markers.anchor.on('dragend', function(ev) {
        var ll = ev.target.getLatLng();
        state.anchor = { lat: ll.lat, lng: ll.lng };
        persistState();
        renderRouteOnMap();
    });

    for (var w = 0; w < state.waypoints.length; w++) {
        (function(wp, idx) {
            var wpId = wp.id;
            mapObjs.markers[wpId] = window.L.marker([wp.lat, wp.lng], {
                draggable: true,
                icon: dotIcon(NEON, 16),
                pane: 'mapMeasurePane',
                zIndexOffset: 1000
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

    var totalEl = document.getElementById('route-planner-total');
    if (totalEl) {
        totalEl.textContent = pts.length > 1 ? ('Σ ' + fmtDist(totalM)) : 'Σ —';
    }
}

function insertWaypointAtClick(latlng) {
    if (!state.anchor || !state.target) return;
    state.waypoints.push({ id: uid(), lat: latlng.lat, lng: latlng.lng });
    sortWaypointsAlongRoute();
    persistState();
    renderRouteOnMap();
}

function removeWaypoint(id) {
    state.waypoints = state.waypoints.filter(function(w) { return w.id !== id; });
    persistState();
    renderRouteOnMap();
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
    renderRouteOnMap();
}

function loadRoutes() {
    try {
        return JSON.parse(localStorage.getItem('patrac_topo_routes') || '[]');
    } catch (e) {
        return [];
    }
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
            persistState();
            renderRouteOnMap();
            syncUiFields();
            return;
        }
    }
}

function refreshRouteSelect() {
    var sel = document.getElementById('route-planner-route-select');
    if (!sel) return;
    var routes = loadRoutes();
    var html = '<option value="">— trasa —</option>';
    for (var i = 0; i < routes.length; i++) {
        html += '<option value="' + routes[i].id + '">' + routes[i].name + '</option>';
    }
    sel.innerHTML = html;
    if (state.activeRouteId) sel.value = state.activeRouteId;
}

function persistState() {
    try {
        localStorage.setItem('patrac_route_planner_state', JSON.stringify({
            anchor: state.anchor,
            target: state.target,
            waypoints: state.waypoints,
            activeRouteId: state.activeRouteId,
            routeName: state.routeName,
            expanded: state.expanded
        }));
    } catch (e) {}
}

function loadState() {
    try {
        var raw = localStorage.getItem('patrac_route_planner_state');
        if (!raw) return;
        var data = JSON.parse(raw);
        if (data.anchor) state.anchor = data.anchor;
        if (data.target) state.target = data.target;
        if (data.waypoints) state.waypoints = data.waypoints;
        state.activeRouteId = data.activeRouteId || null;
        state.routeName = data.routeName || state.routeName;
        if (typeof data.expanded === 'boolean') state.expanded = data.expanded;
    } catch (e) {}
}

function syncUiFields() {
    var nameInput = document.getElementById('route-planner-route-name');
    if (nameInput) nameInput.value = state.routeName || '';
}

function setStartFromMapCenter() {
    var map = getMap();
    if (!map) return;
    var c = map.getCenter();
    state.anchor = { lat: c.lat, lng: c.lng };
    persistState();
    renderRouteOnMap();
}

function setTargetFromMapCenter() {
    var map = getMap();
    if (!map) return;
    var c = map.getCenter();
    state.target = { lat: c.lat, lng: c.lng };
    persistState();
    renderRouteOnMap();
}

function initInteractions() {
    var root = document.getElementById('map-route-planner');
    var toggle = document.getElementById('btn-route-planner-toggle');
    var btnSave = document.getElementById('btn-route-save');
    var btnMid = document.getElementById('btn-route-midpoint');
    var btnStart = document.getElementById('btn-route-set-start');
    var btnTarget = document.getElementById('btn-route-set-target');
    var routeSel = document.getElementById('route-planner-route-select');
    var nameInput = document.getElementById('route-planner-route-name');

    if (toggle && !toggle._bound) {
        toggle._bound = true;
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            state.expanded = !state.expanded;
            if (root) root.classList.toggle('route-planner-collapsed', !state.expanded);
            toggle.textContent = state.expanded ? '−' : '🛤';
            persistState();
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

    if (btnMid && !btnMid._bound) {
        btnMid._bound = true;
        btnMid.addEventListener('click', function(e) {
            e.preventDefault();
            addMidpointWaypoint();
        });
    }

    if (btnStart && !btnStart._bound) {
        btnStart._bound = true;
        btnStart.addEventListener('click', function(e) {
            e.preventDefault();
            setStartFromMapCenter();
        });
    }

    if (btnTarget && !btnTarget._bound) {
        btnTarget._bound = true;
        btnTarget.addEventListener('click', function(e) {
            e.preventDefault();
            setTargetFromMapCenter();
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
    map.on('moveend zoomend resize', function() {
        if (state.visible) renderRouteOnMap();
    });
}

export function initRoutePlanner(deps) {
    _deps = deps;
    if (!_layer) _layer = deps.routeLayer || null;
    loadState();
    var root = document.getElementById('map-route-planner');
    if (root) {
        root.classList.toggle('route-planner-collapsed', !state.expanded);
        var toggle = document.getElementById('btn-route-planner-toggle');
        if (toggle) toggle.textContent = state.expanded ? '−' : '🛤';
    }
    refreshRouteSelect();
    syncUiFields();
    initInteractions();
    bindMapEvents();
    renderRouteOnMap();
}

export function updateRoutePlannerDisplay(show) {
    state.visible = show !== false;
    var root = document.getElementById('map-route-planner');
    if (root) {
        root.style.display = state.visible ? 'block' : 'none';
        root.classList.toggle('is-ready', state.visible);
    }
    if (state.visible) renderRouteOnMap();
    else clearMapGraphics();
}

export function getRoutePlannerState() {
    return state;
}
