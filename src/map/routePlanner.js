/**
 * Plánovač trasy — GPS → střed pravítka (vyžaduje zapnuté pravítko).
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

var mapObjs = { lines: [], labels: [], markers: {} };

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

function dotIcon(color, size) {
    return window.L.divIcon({
        className: 'route-planner-dot',
        html: '<span style="background:' + color + ';width:' + size + 'px;height:' + size + 'px"></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

export function refreshRouteFromGpsAndRuler() {
    if (!_deps) return false;
    var gps = _deps.getGpsLatLng ? _deps.getGpsLatLng() : null;
    var ruler = _deps.getRulerCenterLatLng ? _deps.getRulerCenterLatLng() : null;
    if (!gps || !ruler) return false;
    state.anchor = { lat: gps.lat, lng: gps.lng };
    state.target = { lat: ruler.lat, lng: ruler.lng };
    state.waypoints = [];
    persistState();
    return true;
}

function renderRouteOnMap() {
    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer || !state.visible) return;
    if (!refreshRouteFromGpsAndRuler()) {
        var totalEl = document.getElementById('route-planner-total');
        if (totalEl) totalEl.textContent = 'Σ —';
        return;
    }
    if (!state.anchor || !state.target) return;

    var a = state.anchor;
    var b = state.target;
    var segM = distM(a.lat, a.lng, b.lat, b.lng);
    var coords = [[a.lat, a.lng], [b.lat, b.lng]];
    var line = window.L.polyline(coords, {
        color: NEON, weight: 2, dashArray: '6,5', pane: 'mapMeasurePane'
    }).addTo(_layer);
    mapObjs.lines.push(line);

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

    mapObjs.markers.anchor = window.L.marker([a.lat, a.lng], {
        draggable: false,
        icon: dotIcon('#b8ffb0', 14),
        pane: 'mapMeasurePane',
        zIndexOffset: 900
    }).addTo(_layer);
    mapObjs.markers.anchor.bindTooltip('Start (GPS)', { direction: 'top', permanent: false });

    mapObjs.markers.target = window.L.marker([b.lat, b.lng], {
        draggable: false,
        icon: dotIcon('#ffb366', 16),
        pane: 'mapMeasurePane',
        zIndexOffset: 1100
    }).addTo(_layer);
    mapObjs.markers.target.bindTooltip('Cíl (střed pravítka)', { direction: 'top', permanent: false });

    var totalEl = document.getElementById('route-planner-total');
    if (totalEl) totalEl.textContent = 'Σ ' + fmtDist(segM);
}

function loadRoutes() {
    try {
        return JSON.parse(localStorage.getItem('patrac_topo_routes') || '[]');
    } catch (e) {
        return [];
    }
}

function saveRoute() {
    refreshRouteFromGpsAndRuler();
    var routes = loadRoutes();
    var id = state.activeRouteId || uid();
    var name = state.routeName || ('Trasa ' + (routes.length + 1));
    var entry = {
        id: id,
        name: name,
        anchor: state.anchor,
        target: state.target,
        waypoints: [],
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
            state.waypoints = [];
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
    var html = '<option value="">— Aktuální trasa (GPS → pravítko) —</option>';
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
        state.waypoints = [];
        state.activeRouteId = data.activeRouteId || null;
        state.routeName = data.routeName || state.routeName;
        if (typeof data.expanded === 'boolean') state.expanded = data.expanded;
    } catch (e) {}
}

function syncUiFields() {
    var nameInput = document.getElementById('route-planner-route-name');
    if (nameInput) nameInput.value = state.routeName || '';
}

function initInteractions() {
    var toggle = document.getElementById('btn-route-planner-toggle');
    var btnSave = document.getElementById('btn-route-save');
    var routeSel = document.getElementById('route-planner-route-select');
    var nameInput = document.getElementById('route-planner-route-name');

    if (toggle && !toggle._bound) {
        toggle._bound = true;
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.patracHideRoutePlanner === 'function') window.patracHideRoutePlanner();
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
            if (routeSel.value) {
                loadRouteById(routeSel.value);
            } else {
                refreshRouteFromGpsAndRuler();
                renderRouteOnMap();
            }
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
    state.expanded = true;
    state.waypoints = [];
    var root = document.getElementById('map-route-planner');
    if (root) {
        root.classList.remove('route-planner-collapsed');
        var toggle = document.getElementById('btn-route-planner-toggle');
        if (toggle) toggle.textContent = '✕';
    }
    refreshRouteSelect();
    syncUiFields();
    initInteractions();
    bindMapEvents();
}

export function updateRoutePlannerDisplay(show) {
    state.visible = show !== false;
    var root = document.getElementById('map-route-planner');
    if (root) {
        root.style.display = state.visible ? 'block' : 'none';
        root.classList.toggle('is-ready', state.visible);
    }
    if (state.visible) {
        refreshRouteFromGpsAndRuler();
        renderRouteOnMap();
    } else {
        clearMapGraphics();
    }
}

export function getRoutePlannerState() {
    return state;
}
