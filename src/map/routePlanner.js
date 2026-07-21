/**
 * Plánovač trasy — start (GPS) → mezibody → cíl (střed pravítka).
 *
 * Model:
 *  - start i cíl mají dva režimy: SLEDUJE zdroj (GPS / střed pravítka) nebo ZAMČENO.
 *  - zamčení = 1 s podržení ikony start/cíl na panelu; zamčený bod přestane sledovat
 *    zdroj, jde jím hýbat tažením a zůstane, i když se pravítko vypne.
 *  - mezibody lze přidávat klikem do mapy jen když je cíl zamčený; klik na mezibod ho smaže.
 *  - odemknutím OBOU bodů se trasa smaže a po zapnutí pravítka běží výchozí funkce.
 */

var _deps = null;
var _layer = null;
var _bound = false;

var NEON = '#78ff66';
var START_COLOR = '#b8ffb0';
var TARGET_COLOR = '#ffb366';
var WP_COLOR = '#7fd6ff';

var state = {
    startLocked: false,
    targetLocked: false,
    start: null,
    target: null,
    waypoints: [],
    activeRouteId: null,
    routeName: 'Trasa 1'
};

var mapObjs = { lines: [], labels: [], markers: {}, waypoints: [] };

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

function rulerActive() {
    return !!(_deps && _deps.isRulerActive && _deps.isRulerActive());
}

function routeWanted() {
    return !!(_deps && _deps.isRouteWanted && _deps.isRouteWanted());
}

/** Panel (4 ikony) je vidět jen když je pravítko zapnuté a plánovač zapnutý. */
function isPanelVisible() {
    return rulerActive() && routeWanted();
}

/** Trasa se kreslí, když je panel aktivní NEBO je aspoň jeden bod zamčený. */
function isEngaged() {
    return isPanelVisible() || state.startLocked || state.targetLocked;
}

function clearMapGraphics() {
    if (!_layer) return;
    var k;
    for (k = 0; k < mapObjs.lines.length; k++) _layer.removeLayer(mapObjs.lines[k]);
    for (k = 0; k < mapObjs.labels.length; k++) _layer.removeLayer(mapObjs.labels[k]);
    for (k = 0; k < mapObjs.waypoints.length; k++) _layer.removeLayer(mapObjs.waypoints[k]);
    mapObjs.lines = [];
    mapObjs.labels = [];
    mapObjs.waypoints = [];
    for (k in mapObjs.markers) {
        if (mapObjs.markers.hasOwnProperty(k)) _layer.removeLayer(mapObjs.markers[k]);
    }
    mapObjs.markers = {};
}

function pointIcon(color, size, locked) {
    var lock = locked ? '<b class="rp-marker-lock">🔒</b>' : '';
    return window.L.divIcon({
        className: 'route-planner-marker' + (locked ? ' is-locked' : ''),
        html: '<span class="rp-marker-dot" style="background:' + color + ';width:' + size + 'px;height:' + size + 'px"></span>' + lock,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

/** Aktualizuj sledující (nezamčené) body z jejich zdrojů. */
function refreshFollowingPoints() {
    if (!state.startLocked) {
        var gps = _deps && _deps.getGpsLatLng ? _deps.getGpsLatLng() : null;
        if (gps) state.start = { lat: gps.lat, lng: gps.lng };
    }
    if (!state.targetLocked) {
        var ruler = _deps && _deps.getRulerCenterLatLng ? _deps.getRulerCenterLatLng() : null;
        if (ruler) state.target = { lat: ruler.lat, lng: ruler.lng };
    }
}

/** Zpětně kompatibilní alias (volá se z updateTacticalHud / GPS). */
export function refreshRouteFromGpsAndRuler() {
    refreshFollowingPoints();
    return !!(state.start && state.target);
}

function routePoints() {
    var pts = [];
    if (state.start) pts.push(state.start);
    for (var i = 0; i < state.waypoints.length; i++) pts.push(state.waypoints[i]);
    if (state.target) pts.push(state.target);
    return pts;
}

function totalMeters() {
    var pts = routePoints();
    var sum = 0;
    for (var i = 1; i < pts.length; i++) {
        sum += distM(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    }
    return sum;
}

function setTotalText(txt) {
    var el = document.getElementById('route-planner-total');
    if (el) el.textContent = txt;
}

function makeDraggableMarker(latlng, icon, draggable, onDragEnd, tooltip) {
    var m = window.L.marker([latlng.lat, latlng.lng], {
        draggable: !!draggable,
        icon: icon,
        pane: 'mapMeasurePane',
        zIndexOffset: 1000
    }).addTo(_layer);
    if (tooltip) m.bindTooltip(tooltip, { direction: 'top' });
    if (draggable && onDragEnd) {
        m.on('dragend', function() {
            var ll = m.getLatLng();
            onDragEnd({ lat: ll.lat, lng: ll.lng });
        });
    }
    return m;
}

function renderRouteOnMap() {
    clearMapGraphics();
    var map = getMap();
    if (!map || !_layer) return;
    if (!isEngaged()) { setTotalText('Σ —'); return; }

    refreshFollowingPoints();
    if (!state.start || !state.target) { setTotalText('Σ —'); return; }

    var pts = routePoints();

    var coords = [];
    for (var i = 0; i < pts.length; i++) coords.push([pts[i].lat, pts[i].lng]);
    var line = window.L.polyline(coords, {
        color: NEON, weight: 2, dashArray: '6,5', pane: 'mapMeasurePane', interactive: false
    }).addTo(_layer);
    mapObjs.lines.push(line);

    for (var s = 1; s < pts.length; s++) {
        var a = pts[s - 1], b = pts[s];
        var segM = distM(a.lat, a.lng, b.lat, b.lng);
        var brng = bearing(a.lat, a.lng, b.lat, b.lng);
        var label = window.L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
            icon: window.L.divIcon({
                className: 'route-planner-seg-label',
                html: '<span>' + fmtDist(segM) + '<br>' + Math.round(brng) + '°</span>',
                iconSize: [0, 0]
            }),
            pane: 'mapMeasurePane',
            interactive: false
        }).addTo(_layer);
        mapObjs.labels.push(label);
    }

    mapObjs.markers.start = makeDraggableMarker(
        state.start,
        pointIcon(START_COLOR, 14, state.startLocked),
        state.startLocked,
        function(ll) { state.start = ll; persistState(); renderRouteOnMap(); },
        state.startLocked ? 'Start (zamčený) — tažením přesuň' : 'Start (GPS)'
    );

    for (var w = 0; w < state.waypoints.length; w++) {
        (function(idx) {
            var wp = state.waypoints[idx];
            var m = makeDraggableMarker(
                wp,
                pointIcon(WP_COLOR, 12, false),
                true,
                function(ll) { state.waypoints[idx] = ll; persistState(); renderRouteOnMap(); },
                'Mezibod ' + (idx + 1) + ' — klik = smazat'
            );
            m.on('click', function(e) {
                if (e && e.originalEvent) window.L.DomEvent.stop(e);
                state.waypoints.splice(idx, 1);
                persistState();
                renderRouteOnMap();
            });
            mapObjs.waypoints.push(m);
        })(w);
    }

    mapObjs.markers.target = makeDraggableMarker(
        state.target,
        pointIcon(TARGET_COLOR, 16, state.targetLocked),
        state.targetLocked,
        function(ll) { state.target = ll; persistState(); renderRouteOnMap(); },
        state.targetLocked ? 'Cíl (zamčený) — tažením přesuň' : 'Cíl (střed pravítka)'
    );

    setTotalText('Σ ' + fmtDist(totalMeters()));
}

function loadRoutes() {
    try {
        return JSON.parse(localStorage.getItem('patrac_topo_routes') || '[]');
    } catch (e) {
        return [];
    }
}

function saveRoute() {
    refreshFollowingPoints();
    if (!state.start || !state.target) return;
    var routes = loadRoutes();
    var id = state.activeRouteId || uid();
    var name = state.routeName || ('Trasa ' + (routes.length + 1));
    var entry = {
        id: id,
        name: name,
        start: state.start,
        target: state.target,
        waypoints: state.waypoints.slice(),
        startLocked: state.startLocked,
        targetLocked: state.targetLocked,
        savedAt: Date.now()
    };
    var found = false;
    for (var i = 0; i < routes.length; i++) {
        if (routes[i].id === id) { routes[i] = entry; found = true; break; }
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
            state.start = r.start || null;
            state.target = r.target || null;
            state.waypoints = (r.waypoints || []).slice();
            /* Načtená trasa je zafixovaná (aby zůstala vidět a nesledovala zdroje). */
            state.startLocked = true;
            state.targetLocked = true;
            persistState();
            renderRouteOnMap();
            syncUiFields();
            updatePanelUi();
            return;
        }
    }
}

function refreshRouteSelect() {
    var sel = document.getElementById('route-planner-route-select');
    if (!sel) return;
    var routes = loadRoutes();
    var html = '<option value="">— Aktuální trasa —</option>';
    for (var i = 0; i < routes.length; i++) {
        html += '<option value="' + routes[i].id + '">' + routes[i].name + '</option>';
    }
    sel.innerHTML = html;
    if (state.activeRouteId) sel.value = state.activeRouteId;
}

function persistState() {
    try {
        localStorage.setItem('patrac_route_planner_state', JSON.stringify({
            startLocked: state.startLocked,
            targetLocked: state.targetLocked,
            start: state.start,
            target: state.target,
            waypoints: state.waypoints,
            activeRouteId: state.activeRouteId,
            routeName: state.routeName
        }));
    } catch (e) {}
}

function loadState() {
    try {
        var raw = localStorage.getItem('patrac_route_planner_state');
        if (!raw) return;
        var data = JSON.parse(raw);
        state.startLocked = !!data.startLocked;
        state.targetLocked = !!data.targetLocked;
        if (data.start) state.start = data.start;
        if (data.target) state.target = data.target;
        state.waypoints = Array.isArray(data.waypoints) ? data.waypoints : [];
        state.activeRouteId = data.activeRouteId || null;
        state.routeName = data.routeName || state.routeName;
    } catch (e) {}
}

function syncUiFields() {
    var nameInput = document.getElementById('route-planner-route-name');
    if (nameInput) nameInput.value = state.routeName || '';
}

function updatePanelUi() {
    var root = document.getElementById('map-route-planner');
    if (root) {
        root.classList.toggle('rp-start-locked', state.startLocked);
        root.classList.toggle('rp-target-locked', state.targetLocked);
    }
    var sBtn = document.getElementById('btn-rp-start');
    var tBtn = document.getElementById('btn-rp-target');
    if (sBtn) sBtn.classList.toggle('is-locked', state.startLocked);
    if (tBtn) tBtn.classList.toggle('is-locked', state.targetLocked);
}

function openDrawer(which) {
    var save = document.getElementById('rp-save-drawer');
    var load = document.getElementById('rp-load-drawer');
    if (save) save.classList.toggle('open', which === 'save');
    if (load) load.classList.toggle('open', which === 'load');
    if (which === 'save') {
        var nameInput = document.getElementById('route-planner-route-name');
        if (nameInput) { nameInput.focus(); nameInput.select(); }
    }
    if (which === 'load') refreshRouteSelect();
}

function closeDrawers() {
    var save = document.getElementById('rp-save-drawer');
    var load = document.getElementById('rp-load-drawer');
    if (save) save.classList.remove('open');
    if (load) load.classList.remove('open');
}

function toggleStartLock() {
    if (!state.startLocked) {
        refreshFollowingPoints();
        if (!state.start) return;
        state.startLocked = true;
    } else {
        state.startLocked = false;
    }
    afterLockChange();
}

function toggleTargetLock() {
    if (!state.targetLocked) {
        refreshFollowingPoints();
        if (!state.target) return;
        state.targetLocked = true;
    } else {
        state.targetLocked = false;
    }
    afterLockChange();
}

function afterLockChange() {
    if (!state.startLocked && !state.targetLocked) {
        /* Oba odemčené → smaž trasu, vrať se k výchozí funkci (GPS → pravítko). */
        state.waypoints = [];
        state.activeRouteId = null;
    }
    persistState();
    updatePanelUi();
    if (typeof _deps.onEngagedChange === 'function') _deps.onEngagedChange(isEngaged());
    renderRouteOnMap();
    if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) {} }
}

function bindLongPress(el, onLong, onShort) {
    if (!el || el._rpBound) return;
    el._rpBound = true;
    var timer = null;
    var fired = false;

    function start(e) {
        if (e.type === 'mousedown' && e.button !== 0) return;
        fired = false;
        clear();
        timer = setTimeout(function() {
            timer = null;
            fired = true;
            onLong();
        }, 1000);
    }
    function clear() {
        if (timer) { clearTimeout(timer); timer = null; }
    }
    function end(e) {
        var wasTimer = !!timer;
        clear();
        if (!fired && wasTimer && typeof onShort === 'function') {
            onShort();
        }
        fired = false;
    }

    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', function(e) { start(e); }, { passive: true });
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', clear);
    el.addEventListener('touchend', function(e) { e.preventDefault(); end(e); });
    el.addEventListener('touchcancel', clear);
    el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}

function initInteractions() {
    var startBtn = document.getElementById('btn-rp-start');
    var targetBtn = document.getElementById('btn-rp-target');
    var saveBtn = document.getElementById('btn-rp-save');
    var loadBtn = document.getElementById('btn-rp-load');
    var saveConfirm = document.getElementById('btn-route-save-confirm');
    var nameInput = document.getElementById('route-planner-route-name');
    var routeSel = document.getElementById('route-planner-route-select');

    bindLongPress(startBtn, toggleStartLock, function() { centerOnPoint(state.start); });
    bindLongPress(targetBtn, toggleTargetLock, function() { centerOnPoint(state.target); });

    if (saveBtn && !saveBtn._bound) {
        saveBtn._bound = true;
        saveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var save = document.getElementById('rp-save-drawer');
            openDrawer(save && save.classList.contains('open') ? null : 'save');
        });
    }
    if (loadBtn && !loadBtn._bound) {
        loadBtn._bound = true;
        loadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var load = document.getElementById('rp-load-drawer');
            openDrawer(load && load.classList.contains('open') ? null : 'load');
        });
    }
    if (saveConfirm && !saveConfirm._bound) {
        saveConfirm._bound = true;
        saveConfirm.addEventListener('click', function(e) {
            e.preventDefault();
            if (nameInput) state.routeName = nameInput.value || state.routeName;
            saveRoute();
            closeDrawers();
        });
    }
    if (nameInput && !nameInput._bound) {
        nameInput._bound = true;
        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                state.routeName = nameInput.value || state.routeName;
                saveRoute();
                closeDrawers();
            }
        });
    }
    if (routeSel && !routeSel._bound) {
        routeSel._bound = true;
        routeSel.addEventListener('change', function() {
            if (routeSel.value) { loadRouteById(routeSel.value); }
            else { refreshFollowingPoints(); renderRouteOnMap(); }
            closeDrawers();
        });
    }
}

function centerOnPoint(pt) {
    var map = getMap();
    if (map && pt) map.panTo([pt.lat, pt.lng], { animate: true });
}

/**
 * Najdi, do kterého úseku trasy nový bod nejlépe patří (nejmenší přidaná délka),
 * aby přímky navazovaly a netvořil se cikcak. Vrací index do state.waypoints.
 */
function bestWaypointInsertIndex(pt) {
    var pts = routePoints();
    if (pts.length < 2) return state.waypoints.length;
    var bestI = 0;
    var bestCost = Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var direct = distM(a.lat, a.lng, b.lat, b.lng);
        var detour = distM(a.lat, a.lng, pt.lat, pt.lng) + distM(pt.lat, pt.lng, b.lat, b.lng);
        var cost = detour - direct;
        if (cost < bestCost) { bestCost = cost; bestI = i; }
    }
    /* Segment i spojuje pts[i]→pts[i+1]; start je pts[0], mezibody pts[1..].
       Vložení do tohoto segmentu = index i ve state.waypoints. */
    return bestI;
}

function onMapClickAddWaypoint(e) {
    /* Mezibody lze přidávat jen se zamčeným cílem. */
    if (!state.targetLocked || !isEngaged()) return;
    if (!e || !e.latlng) return;
    var pt = { lat: e.latlng.lat, lng: e.latlng.lng };
    var idx = bestWaypointInsertIndex(pt);
    state.waypoints.splice(idx, 0, pt);
    persistState();
    renderRouteOnMap();
}

function bindMapEvents() {
    if (_bound) return;
    var map = getMap();
    if (!map) return;
    _bound = true;
    map.on('moveend zoomend resize', function() {
        if (isEngaged()) renderRouteOnMap();
    });
    map.on('click', onMapClickAddWaypoint);
}

export function initRoutePlanner(deps) {
    _deps = deps;
    if (!_layer) _layer = deps.routeLayer || null;
    loadState();
    refreshRouteSelect();
    syncUiFields();
    updatePanelUi();
    initInteractions();
    bindMapEvents();
}

/** Jediný vstup pro překreslení: panel viditelnost + grafika trasy. */
export function update() {
    var root = document.getElementById('map-route-planner');
    var panel = isPanelVisible();
    if (root) {
        root.style.display = panel ? 'block' : 'none';
        root.classList.toggle('is-ready', panel);
    }
    if (!panel) closeDrawers();
    updatePanelUi();
    renderRouteOnMap();
}

/** Zpětně kompatibilní se starým voláním z 03-map. */
export function updateRoutePlannerDisplay() {
    update();
}

export function isTargetLocked() {
    return state.targetLocked;
}

export function isStartLocked() {
    return state.startLocked;
}

export function isRouteEngaged() {
    return isEngaged();
}

export function getRoutePlannerState() {
    return state;
}
