/* PATRAC app chunk: 03-map.js — do not reorder script tags in index.html */
function ensureMapPanes() {
    if (!map) return;
    if (!map.getPane('mapFogPane')) {
        map.createPane('mapFogPane');
        map.getPane('mapFogPane').style.zIndex = 450;
    }
    if (!map.getPane('mapGridPane')) {
        map.createPane('mapGridPane');
        map.getPane('mapGridPane').style.zIndex = 665;
    }
    if (!map.getPane('mapPointsPane')) {
        map.createPane('mapPointsPane');
        map.getPane('mapPointsPane').style.zIndex = 640;
    }
    if (!map.getPane('mapMeasurePane')) {
        map.createPane('mapMeasurePane');
        map.getPane('mapMeasurePane').style.zIndex = 670;
    }
}

function ensureMapTouchPan() {
    if (!map) return;
    if (map.dragging) map.dragging.enable();
    if (map.touchZoom) map.touchZoom.enable();
    if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
    if (map.doubleClickZoom) map.doubleClickZoom.enable();
    if (map.boxZoom) map.boxZoom.enable();
    if (map.keyboard) map.keyboard.enable();
    var el = map.getContainer();
    if (el) {
        el.style.touchAction = 'none';
        el.style.pointerEvents = 'auto';
    }
}
window.ensureMapTouchPan = ensureMapTouchPan;

function initMap() {
    if (map !== null) {
        ensureMapPanes();
        ensureMapTouchPan();
        if (!mapCompassLayer) mapCompassLayer = L.layerGroup().addTo(map);
        if (!mapRouteLayer) mapRouteLayer = L.layerGroup().addTo(map);
        reloadAllMapPoints();
        initMapV3Ui();
        initCompassFloating();
        initTopoRulerModule();
        initRoutePlannerModule();
        initMgrsGridModule();
        initFogOfWarModule();
        return;
    }
    try {
        var savedLat = parseFloat(localStorage.getItem('map_last_lat'));
        var savedLng = parseFloat(localStorage.getItem('map_last_lng'));
        var startLat = isNaN(savedLat) ? 49.715 : savedLat;
        var startLng = isNaN(savedLng) ? 13.220 : savedLng;
        var startZoom = parseInt(localStorage.getItem('map_last_zoom') || '14', 10);

        map = L.map('map', {
            zoomControl: false,
            dragging: true,
            touchZoom: true,
            scrollWheelZoom: true,
            doubleClickZoom: true
        }).setView([startLat, startLng], startZoom);
        ensureMapTouchPan();
        ensureMapPanes();
        mapPointsLayer = L.layerGroup().addTo(map);
        mapMeasureLayer = L.layerGroup().addTo(map);
        mapCompassLayer = L.layerGroup().addTo(map);
        mapRouteLayer = L.layerGroup().addTo(map);

        var tilePref = localStorage.getItem('map_tile_style') || 'satellite';
        switchMapTile(tilePref);
        var tileSel = document.getElementById('map-tile-select');
        if (tileSel) tileSel.value = tilePref;

        map.on('moveend zoomend zoom', function() {
            var c = map.getCenter();
            localStorage.setItem('map_last_lat', c.lat);
            localStorage.setItem('map_last_lng', c.lng);
            localStorage.setItem('map_last_zoom', map.getZoom());
            updateTacticalHud();
        });

        reloadAllMapPoints();
        startGeolocation();
        initMapV3Ui();
        initCompassFloating();
        initTopoRulerModule();
        initRoutePlannerModule();
        initMgrsGridModule();
        initFogOfWarModule();
    } catch(e) {
        console.error('initMap', e);
    }
}

function switchMapTile(style) {
    if (!map) return;
    if (baseTileLayer) map.removeLayer(baseTileLayer);
    localStorage.setItem('map_tile_style', style);
    if (style === 'street') {
        baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '© OpenStreetMap — globální'
        });
    } else if (style === 'topo') {
        baseTileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17, attribution: '© OpenTopoMap — globální'
        });
    } else {
        baseTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19, attribution: '© Esri World Imagery — globální satelit'
        });
    }
    baseTileLayer.addTo(map);
}

function poctaCrossIcon(size) {
    return '<span class="pocta-cross-icon pocta-cross-' + (size || 'md') + '" aria-hidden="true"></span>';
}

function initMapV3Ui() {
    patracImport('map/mapV3.js').then(function(m) {
        mapV3Module = m;
        mapLayerFilterState = m.loadMapLayerFilter();
        syncMapLayerFilterCheckboxes();
    }).catch(function(e) { console.warn('mapV3', e); });
    initCompassBezelDrag();
}

function getMapLayerFilter() {
    if (mapLayerFilterState) return mapLayerFilterState;
    if (mapV3Module) return mapV3Module.loadMapLayerFilter();
    return { permanent: true, custom: true, pocta: false };
}

function setMapLayerFilter(key, on) {
    var f = getMapLayerFilter();
    f[key] = !!on;
    mapLayerFilterState = f;
    if (mapV3Module) mapV3Module.saveMapLayerFilter(f);
    else patracImport('map/mapV3.js').then(function(m) { m.saveMapLayerFilter(f); });
    reloadAllMapPoints();
}

function syncMapLayerFilterCheckboxes() {
    var f = getMapLayerFilter();
    var p = document.getElementById('map-filter-permanent');
    var c = document.getElementById('map-filter-custom');
    if (p) p.checked = f.permanent;
    if (c) c.checked = f.custom;
}

function syncMgrsGridWithRuler(show) {
    if (mgrsGridMod) {
        mgrsGridMod.setMgrsGridVisible(!!show);
    }
}

function toggleMapLayersPanel() {
    var drop = document.getElementById('map-layers-dropdown');
    if (drop) drop.classList.toggle('open');
}

function closeMapLayersPanel() {
    var drop = document.getElementById('map-layers-dropdown');
    if (drop) drop.classList.remove('open');
}

window.patracHideTopoRuler = function() {
    if (mapHud()) mapHud().writeBool(mapHud().LS.ruler, false);
    updateTopoRulerDisplay();
};
window.patracHideRoutePlanner = function() {
    if (mapHud()) mapHud().writeBool(mapHud().LS.route, false);
    updateRoutePlannerDisplay();
};
window.patracHideCompass = function() {
    if (mapHud()) mapHud().writeBool(mapHud().LS.compass, false);
    updateMapCompassDisplay();
};

function getMapPointCategory(meta) {
    var id = meta.id || '';
    if (gameQuests[id]) return 'permanent';
    if (meta.isPoi || id.indexOf('poi_') === 0) return 'custom';
    if (id.indexOf('pocta_ent_') === 0 || id.indexOf('cquest_ent_') === 0) return 'pocta';
    if (id.indexOf('custom_') === 0 || id.indexOf('random_') === 0) return 'permanent';
    return 'custom';
}

function isActiveQuestAtPoint(id) {
    if (gameQuests[id]) {
        var q = getQuestWithReq(gameQuests[id]);
        if (!q || isQuestCompleted(q) || isQuestDismissed(id)) return false;
        if (isPlayerCompletedCurrentRun(id)) return false;
        return localStorage.getItem('unlocked_story_' + id) === 'true' || isQuestLaunchedCommunityWide(id);
    }
    var q2 = getQuestById(id);
    if (q2 && (id.indexOf('custom_') === 0 || isRandomQuestId(id))) {
        return isQuestActive(q2);
    }
    return false;
}

function getHudDockBottom() {
    return window.innerWidth <= 480 ? 48 : 108;
}

function loadCompassPlacementFromStorage() {
    var x = parseFloat(localStorage.getItem('patrac_compass_x'));
    var y = parseFloat(localStorage.getItem('patrac_compass_y'));
    if (!isNaN(x) && !isNaN(y)) {
        compassScreenPos.x = x;
        compassScreenPos.y = y;
    }
}

function saveCompassScreenPos() {
    if (compassScreenPos.x == null || compassScreenPos.y == null) return;
    try {
        localStorage.setItem('patrac_compass_x', String(Math.round(compassScreenPos.x)));
        localStorage.setItem('patrac_compass_y', String(Math.round(compassScreenPos.y)));
    } catch (e) {}
}

function getCompassDefaultScreenPos() {
    if (!map) return { x: 12, y: 12 };
    var root = document.getElementById('map-compass');
    var size = map.getSize();
    var w = (root && root.offsetWidth) ? root.offsetWidth : 132;
    var h = (root && root.offsetHeight) ? root.offsetHeight : 150;
    return {
        x: Math.max(8, size.x - w - 12),
        y: Math.max(8, size.y - h - getHudDockBottom() - 8)
    };
}

function applyCompassDockPosition() {
    var root = document.getElementById('map-compass');
    if (!root) return;
    if (root.classList.contains('compass-collapsed')) {
        root.classList.remove('compass-positioned');
        root.classList.add('compass-docked');
        root.style.left = '';
        root.style.top = '';
        root.style.right = (window.innerWidth <= 480 ? 6 : 12) + 'px';
        root.style.bottom = getHudDockBottom() + 'px';
        return;
    }
    root.classList.remove('compass-docked');
    updateCompassScreenPosition();
}

function updateCompassScreenPosition() {
    var root = document.getElementById('map-compass');
    if (!root || !map || root.classList.contains('compass-collapsed')) return;
    if (compassScreenPos.x == null || compassScreenPos.y == null) {
        var def = getCompassDefaultScreenPos();
        compassScreenPos.x = def.x;
        compassScreenPos.y = def.y;
    }
    root.classList.add('compass-positioned');
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = Math.round(compassScreenPos.x) + 'px';
    root.style.top = Math.round(compassScreenPos.y) + 'px';
}

function bindCompassMoveHandle() {
    var handle = document.getElementById('compass-drag-handle');
    if (!handle || handle._compassMoveBound) return;
    handle._compassMoveBound = true;
    var moving = false;
    var moveStart = null;
    var originPos = null;
    function ptr(e) {
        return { x: e.touches ? e.touches[0].clientX : e.clientX, y: e.touches ? e.touches[0].clientY : e.clientY };
    }
    function onMoveDrag(e) {
        if (!moveStart) return;
        var p = ptr(e);
        var dx = p.x - moveStart.x;
        var dy = p.y - moveStart.y;
        if (!moving) {
            if (Math.hypot(dx, dy) < 6) return;
            moving = true;
        }
        e.preventDefault();
        e.stopPropagation();
        var root = document.getElementById('map-compass');
        var size = map ? map.getSize() : { x: window.innerWidth, y: window.innerHeight };
        var w = root ? root.offsetWidth : 132;
        var h = root ? root.offsetHeight : 150;
        compassScreenPos.x = Math.max(0, Math.min(size.x - w, originPos.x + dx));
        compassScreenPos.y = Math.max(0, Math.min(size.y - h, originPos.y + dy));
        updateCompassScreenPosition();
    }
    function onMoveEnd() {
        document.removeEventListener('mousemove', onMoveDrag);
        document.removeEventListener('touchmove', onMoveDrag);
        document.removeEventListener('mouseup', onMoveEnd);
        document.removeEventListener('touchend', onMoveEnd);
        if (moving) saveCompassScreenPos();
        moving = false;
        moveStart = null;
        originPos = null;
    }
    function onMoveStart(e) {
        var root = document.getElementById('map-compass');
        if (!root || root.classList.contains('compass-collapsed')) return;
        moving = false;
        moveStart = ptr(e);
        originPos = {
            x: compassScreenPos.x != null ? compassScreenPos.x : getCompassDefaultScreenPos().x,
            y: compassScreenPos.y != null ? compassScreenPos.y : getCompassDefaultScreenPos().y
        };
        e.preventDefault();
        e.stopPropagation();
        document.addEventListener('mousemove', onMoveDrag);
        document.addEventListener('touchmove', onMoveDrag, { passive: false });
        document.addEventListener('mouseup', onMoveEnd);
        document.addEventListener('touchend', onMoveEnd);
    }
    handle.addEventListener('mousedown', onMoveStart);
    handle.addEventListener('touchstart', onMoveStart, { passive: false });
}

function initCompassFloating() {
    loadCompassPlacementFromStorage();
    applyCompassDockPosition();
    bindCompassMoveHandle();
    if (!compassFloatListenersBound && map) {
        compassFloatListenersBound = true;
        map.on('move zoom zoomend moveend resize', function() {
            if (!document.getElementById('map-compass').classList.contains('compass-collapsed')) {
                updateCompassScreenPosition();
            }
        });
    }
}

function initMgrsGridModule() {
    if (mgrsGridMod) return;
    patracImport('map/mgrsGrid.js').then(function(mod) {
        mgrsGridMod = mod;
        mod.initMgrsGrid(map);
        var rulerOn = mapHud() && mapHud().isRulerEffective();
        syncMgrsGridWithRuler(rulerOn);
        if (typeof patracUpdateMgrsReadout === 'function') patracUpdateMgrsReadout();
    }).catch(function(err) { console.warn('[mgrsGrid]', err); });
}

window.patracToggleMgrsGrid = function(on) {
    syncMgrsGridWithRuler(on);
};

window.patracUpdateMgrsReadout = function() {
    if (!mgrsGridMod || !mapHud() || !mapHud().isMapToolsTabActive()) return;
    var mgrsEl = document.getElementById('map-tac-mgrs');
    var subEl = document.getElementById('map-tac-mgrs-sub');
    var scaleEl = document.getElementById('map-tac-scale');
    var scaleSubEl = document.getElementById('map-tac-scale-sub');
    if (!mgrsEl) return;
    var lat = null;
    var lng = null;
    var src = 'střed mapy';
    if (lastUserPosition && isFinite(lastUserPosition.lat) && isFinite(lastUserPosition.lng)) {
        lat = lastUserPosition.lat;
        lng = lastUserPosition.lng;
        var acc = lastUserPosition.accuracy ? Math.round(lastUserPosition.accuracy) : null;
        src = acc != null ? ('GPS ±' + acc + ' m') : 'GPS';
    }
    if (lat == null && map) {
        var c = map.getCenter();
        lat = c.lat;
        lng = c.lng;
    }
    if (topoRulerMod && topoRulerMod.getRulerCenterLatLng && topoRulerMod.getRulerCenterLatLng()) {
        var rc = topoRulerMod.getRulerCenterLatLng();
        lat = rc.lat;
        lng = rc.lng;
        src = 'střed pravítka';
    }
    if (lat == null) {
        mgrsEl.textContent = '—';
        if (subEl) subEl.textContent = 'čekám na GPS…';
        if (scaleEl) scaleEl.textContent = '—';
        if (scaleSubEl) scaleSubEl.textContent = '—';
        return;
    }
    var mgrsAcc = 5;
    if (topoRulerMod && topoRulerMod.formatRulerMgrs50 && mgrsAcc >= 5) {
        mgrsEl.textContent = topoRulerMod.formatRulerMgrs50(lat, lng);
    } else {
        mgrsEl.textContent = mgrsGridMod.mgrsAtLatLng(lat, lng, mgrsAcc);
    }
    if (subEl) {
        subEl.textContent = formatLatLngDegrees(lat, lng) + ' · ' + src + ' · ' + mgrsGridMod.mgrsPrecisionText(mgrsAcc);
    }
    if (topoRulerMod && topoRulerMod.getMapScaleReadout && scaleEl) {
        var scaleInfo = topoRulerMod.getMapScaleReadout(lat, lng);
        if (scaleInfo) {
            scaleEl.textContent = scaleInfo.scaleRatio + ' · Z' + scaleInfo.zoom;
            if (scaleSubEl) {
                scaleSubEl.textContent = '1 km = ' + scaleInfo.pxPerKm + ' px · roamer ×' + scaleInfo.roamerScale.toFixed(2) +
                    (scaleInfo.synced ? ' · SYNC' : '');
            }
        }
    }
};

function formatLatLngDegrees(lat, lng) {
    var ns = lat >= 0 ? 'N' : 'S';
    var ew = lng >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(5) + '°' + ns + ' · ' + Math.abs(lng).toFixed(5) + '°' + ew;
}

function initTopoRulerModule() {
    if (topoRulerMod) {
        updateTopoRulerDisplay();
        return;
    }
    patracImport('map/topoRuler.js').then(function(mod) {
        topoRulerMod = mod;
        mod.initTopoRuler({
            getMap: function() { return map; },
            routeLayer: mapRouteLayer,
            bearingDegrees: bearingDegrees,
            distanceMeters: distanceMeters,
            formatDistance: formatDistance,
            onUiUpdate: updateTacticalHud,
            getGpsLatLng: function() {
                if (lastUserPosition && isFinite(lastUserPosition.lat) && isFinite(lastUserPosition.lng)) {
                    return { lat: lastUserPosition.lat, lng: lastUserPosition.lng };
                }
                return null;
            },
            refreshMgrsGrid: function() {
                if (mgrsGridMod) mgrsGridMod.refreshMgrsGrid();
            },
            isRouteTargetLocked: function() {
                return !!(routePlannerMod && routePlannerMod.isTargetLocked && routePlannerMod.isTargetLocked());
            }
        });
        updateTopoRulerDisplay();
    }).catch(function(err) { console.error('[topoRuler]', err); });
}

function updateTopoRulerDisplay() {
    var root = document.getElementById('map-topo-ruler');
    var hud = mapHud();
    var show = hud ? hud.isRulerEffective() : false;
    var fab = document.getElementById('fab-topo-ruler');
    if (fab) fab.classList.toggle('is-active', show);
    syncMgrsGridWithRuler(show);
    /* Panel trasy sleduje pravítko; grafika trasy zůstane, když je start/cíl zamčený. */
    updateRoutePlannerDisplay();
    if (!topoRulerMod) {
        if (root) {
            root.style.display = show ? 'block' : 'none';
            root.classList.toggle('is-ready', show);
        }
        return;
    }
    topoRulerMod.updateTopoRulerDisplay(show);
    if (fab) fab.classList.toggle('is-active', show);
}
window.patracToggleTopoRuler = function() {
    var hud = mapHud();
    if (!hud) return;
    var next = !hud.isRulerWanted();
    hud.writeBool(hud.LS.ruler, next);
    updateTopoRulerDisplay();
};
function isTopoRulerActive() {
    return mapHud() ? mapHud().isRulerEffective() : false;
}

function initRoutePlannerModule() {
    if (routePlannerMod) {
        updateRoutePlannerDisplay();
        return;
    }
    patracImport('map/routePlanner.js').then(function(mod) {
        routePlannerMod = mod;
        mod.initRoutePlanner({
            getMap: function() { return map; },
            routeLayer: mapRouteLayer,
            bearingDegrees: bearingDegrees,
            distanceMeters: distanceMeters,
            formatDistance: formatDistance,
            getGpsLatLng: function() {
                if (lastUserPosition && isFinite(lastUserPosition.lat) && isFinite(lastUserPosition.lng)) {
                    return { lat: lastUserPosition.lat, lng: lastUserPosition.lng };
                }
                return null;
            },
            getRulerCenterLatLng: function() {
                if (topoRulerMod && topoRulerMod.getRulerCenterLatLng) {
                    return topoRulerMod.getRulerCenterLatLng();
                }
                return null;
            },
            isRulerActive: function() { return isTopoRulerActive(); },
            isRouteWanted: function() { return !!(mapHud() && mapHud().isRouteWanted()); }
        });
        updateRoutePlannerDisplay();
    }).catch(function(err) { console.error('[routePlanner]', err); });
}

function updateRoutePlannerDisplay() {
    var root = document.getElementById('map-route-planner');
    var engaged = !!(routePlannerMod && routePlannerMod.isRouteEngaged && routePlannerMod.isRouteEngaged());
    var panelShow = (!!(mapHud() && mapHud().isRouteEffective()) && isTopoRulerActive()) || engaged;
    var fab = document.getElementById('fab-route-planner');
    if (fab) fab.classList.toggle('is-active', panelShow);
    if (!routePlannerMod) {
        if (root) {
            root.style.display = panelShow ? 'block' : 'none';
            root.classList.toggle('is-ready', panelShow);
        }
        return;
    }
    routePlannerMod.update();
}
window.patracToggleRoutePlanner = function() {
    if (!isTopoRulerActive()) {
        alert('Plánovač trasy vyžaduje zapnuté pravítko (📐).');
        return;
    }
    var hud = mapHud();
    if (!hud) return;
    var next = !hud.isRouteWanted();
    hud.writeBool(hud.LS.route, next);
    updateRoutePlannerDisplay();
};
window.patracToggleCompass = function() {
    var hud = mapHud();
    if (!hud) return;
    var next = !hud.isCompassWanted();
    hud.writeBool(hud.LS.compass, next);
    if (next) setCompassWidgetExpanded(true);
    updateMapCompassDisplay();
};

function updateMapToolFabs() {
    var fabs = document.getElementById('map-tool-fabs');
    if (fabs) fabs.classList.toggle('visible', !!(mapHud() && mapHud().isMapToolsTabActive()));
}

function setMapNavTarget(lat, lng, label) {
    mapNavTarget = { lat: lat, lng: lng, label: label || 'Cíl' };
    updateCompassUi();
}
window.setMapNavTarget = setMapNavTarget;
window.getMapLayerFilter = getMapLayerFilter;

function updateTacticalHud() {
    var hud = document.getElementById('map-tactical-hud');
    if (!hud) return;
    hud.classList.toggle('visible', !!(mapHud() && mapHud().isMapToolsTabActive()));
    if (typeof patracUpdateMgrsReadout === 'function') patracUpdateMgrsReadout();
    /* Trasa: start sleduje GPS, cíl střed pravítka — překresli při pohybu/GPS (pokud je zapojená). */
    if (routePlannerMod && routePlannerMod.isRouteEngaged && routePlannerMod.isRouteEngaged()) {
        routePlannerMod.update();
    }
}

function updateCompassCenterDeg() {
    var el = document.getElementById('compass-center-deg');
    if (!el) return;
    if (compassNeedsPermission && !compassOrientGranted) {
        el.textContent = '▶';
        el.classList.add('is-waiting');
        el.title = 'Klepni pro aktivaci buzoly';
        return;
    }
    el.classList.remove('is-waiting');
    el.textContent = Math.round(normalizeDeg(compassBezelDeg)) + '°';
    el.title = 'Natáčení lunety';
}

function setCompassWidgetExpanded(expanded) {
    var root = document.getElementById('map-compass');
    if (!root) return;
    root.classList.remove('compass-collapsed');
    try { localStorage.setItem('patrac_compass_expanded', '1'); } catch (e) {}
    applyCompassDockPosition();
}

function initCompassWidgetToggle() {
    /* Křížek pro zavření buzoly byl odstraněn (duplicitní ovládání – schovává se přes FAB).
       Buzolu jen zajistíme jako rozbalenou. */
    setCompassWidgetExpanded(true);
}

function shortestDegDelta(from, to) {
    return ((to - from + 540) % 360) - 180;
}

function smoothCompassHeading(raw) {
    if (compassDeviceHeading === null) return raw;
    var delta = shortestDegDelta(compassDeviceHeading, raw);
    if (Math.abs(delta) > 45) {
        return normalizeDeg(compassDeviceHeading + delta * 0.08);
    }
    return normalizeDeg(compassDeviceHeading + delta * 0.18);
}

function getDeviceHeadingFromEvent(e) {
    if (!e) return null;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        compassHeadingSource = 'webkit';
        return normalizeDeg(e.webkitCompassHeading);
    }
    if (compassHeadingSource === 'webkit') return null;
    if (typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        compassHeadingSource = 'alpha';
        return normalizeDeg(360 - e.alpha);
    }
    return null;
}

function flushCompassOrientation() {
    compassOrientRaf = null;
    var heading = getDeviceHeadingFromEvent(compassOrientLastEvent);
    if (heading === null) return;
    compassDeviceHeading = smoothCompassHeading(heading);
    compassOrientGranted = true;
    updateCompassPermissionUi();
    applyCompassNorthArrow();
}

function onDeviceOrientation(e) {
    compassOrientLastEvent = e;
    if (compassOrientRaf) return;
    compassOrientRaf = requestAnimationFrame(flushCompassOrientation);
}

function attachCompassOrientationListeners() {
    if (compassOrientListening) return;
    if (compassNeedsPermission) {
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
    } else if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
    } else {
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
    }
    compassOrientListening = true;
}

function updateCompassPermissionUi() {
    var root = document.getElementById('map-compass');
    if (!root) return;
    root.classList.toggle('compass-needs-permission', compassNeedsPermission && !compassOrientGranted);
}

function enableCompassFromUserGesture() {
    if (compassNeedsPermission) {
        return DeviceOrientationEvent.requestPermission().then(function(state) {
            if (state === 'granted') {
                attachCompassOrientationListeners();
                compassOrientGranted = true;
                updateCompassPermissionUi();
                updateCompassUi();
                return true;
            }
            updateCompassPermissionUi();
            return false;
        }).catch(function(err) {
            console.warn('[compass] permission', err);
            updateCompassPermissionUi();
            return false;
        });
    }
    attachCompassOrientationListeners();
    compassOrientGranted = true;
    updateCompassPermissionUi();
    updateCompassUi();
    return Promise.resolve(true);
}

function resetMapBearingRotation() {
    /* Mapa je vždy sever-nahoru; mapPane transform vlastní Leaflet (posun). */
}

function applyCompassBezelRotation() {
    var rose = document.getElementById('compass-rose');
    if (!rose) return;
    rose.style.transform = 'rotate(' + compassBezelDeg + 'deg)';
    updateCompassCenterDeg();
}

function applyCompassNorthArrow() {
    var arrow = document.getElementById('compass-north-arrow');
    if (!arrow) return;
    if (compassDeviceHeading === null) {
        if (!compassOrientGranted) arrow.classList.remove('visible');
        return;
    }
    arrow.classList.add('visible');
    arrow.style.transform = 'rotate(' + normalizeDeg(-compassDeviceHeading) + 'deg)';
}

function initCompassBezelDrag() {
    initCompassWidgetToggle();
    var wrap = document.getElementById('compass-rose-wrap');
    var housing = document.querySelector('#map-compass .compass-housing');
    if (!wrap || wrap._bezelBound) return;
    wrap._bezelBound = true;
    var dragging = false;
    var dragStart = null;
    function angleFromEvent(e) {
        var rect = wrap.getBoundingClientRect();
        var cx = (e.touches ? e.touches[0].clientX : e.clientX) - (rect.left + rect.width / 2);
        var cy = (e.touches ? e.touches[0].clientY : e.clientY) - (rect.top + rect.height / 2);
        return normalizeDeg(Math.atan2(cx, -cy) * 180 / Math.PI);
    }
    function pointerFromEvent(e) {
        return {
            x: e.touches ? e.touches[0].clientX : e.clientX,
            y: e.touches ? e.touches[0].clientY : e.clientY
        };
    }
    function onMove(e) {
        if (!dragStart) return;
        var p = pointerFromEvent(e);
        if (!dragging) {
            var dx = p.x - dragStart.x;
            var dy = p.y - dragStart.y;
            if (Math.hypot(dx, dy) < 10) return;
            dragging = true;
            e.preventDefault();
            e.stopPropagation();
        }
        var dragAngle = angleFromEvent(e);
        compassBezelDeg = dragAngle;
        applyCompassBezelRotation();
        resetMapBearingRotation();
        try { localStorage.setItem('patrac_compass_bezel', String(compassBezelDeg)); } catch (err) {}
        updateCompassUi();
    }
    function onEnd(e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        if (!dragging && dragStart) {
            enableCompassFromUserGesture();
        }
        dragging = false;
        dragStart = null;
    }
    function onStart(e) {
        dragStart = pointerFromEvent(e);
        dragging = false;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }
    function bindActivate(el) {
        if (!el || el._compassActivateBound) return;
        el._compassActivateBound = true;
        el.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            enableCompassFromUserGesture();
        });
    }
    wrap.addEventListener('mousedown', onStart);
    wrap.addEventListener('touchstart', onStart, { passive: true });
    bindActivate(housing);
    if (!compassNeedsPermission) {
        attachCompassOrientationListeners();
        compassOrientGranted = true;
    }
    updateCompassPermissionUi();
    applyCompassBezelRotation();
    applyCompassNorthArrow();
    initCompassFloating();
}

function buildMapLabelHtml(meta) {
    if (typeof meta === 'string') return '<strong>' + meta + '</strong>';
    return '<strong>' + meta.mapLabel + '</strong>';
}

function getStoryPosCommunityNote(questId) {
    return localStorage.getItem('story_pos_note_' + questId) || '';
}

function getStoryPosCommunityImg(questId) {
    return localStorage.getItem('story_pos_img_' + questId) || '';
}

function clearStoryPosCommunityData(questId) {
    localStorage.removeItem('story_pos_note_' + questId);
    localStorage.removeItem('story_pos_img_' + questId);
}

function refreshQuestMapPoint(questId) {
    if (!hasStoredQuestCoords(questId)) return;
    var lat = parseFloat(localStorage.getItem('point_' + questId + '_lat'));
    var lng = parseFloat(localStorage.getItem('point_' + questId + '_lng'));
    var q = getQuestById(questId);
    if (lat && lng && q) {
        renderPointOnMap(questId, lat, lng, q.mapLabel || q.title, q.desc);
    }
}

function isStoryQuestId(id) {
    return !!gameQuests[id];
}

function getQuestMapLabel(questOrId) {
    var q = typeof questOrId === 'string' ? getQuestById(questOrId) : questOrId;
    if (!q) return 'Bod';
    if (q.mapLabel) return q.mapLabel;
    if (gameQuests[q.id]) return gameQuests[q.id].mapLabel || q.title;
    return q.title || 'Bod';
}

function buildMapPopupHtml(meta) {
    var faded = meta.isCompleted && !meta.isStoryQuest;
    var category = getMapPointCategory(meta);
    var title = meta.mapLabel || 'Bod';
    var desc = meta.isPoi ? (meta.poiNote || '') : (meta.popupDesc || '');
    if (mapV3Module) {
        var extra = '';
        if (meta.isPoi) {
            if (meta.poiImg) extra += '<img class="poi-popup-img" src="' + meta.poiImg + '" alt="">';
            extra += '<button type="button" class="map-popup-edit" onclick="openPoiEditor(\'' + meta.id + '\')">📝 UPRAVIT</button>';
            extra += '<button type="button" class="map-popup-reset" onclick="deleteMapPoi(\'' + meta.id + '\')">🗑️ SMAZAT</button>';
        } else {
            if (faded) extra += '<p class="popup-meta popup-inactive-tag">⏸ Neaktivní · mise splněna</p>';
            if (meta.isStoryQuest) {
                if (meta.communityImg) extra += '<img class="poi-popup-img" src="' + meta.communityImg + '" alt="">';
                if (meta.communityNote) extra += '<p class="popup-desc popup-community-note"><strong>📢 Komunita:</strong> ' + meta.communityNote + '</p>';
                extra += '<button type="button" class="map-popup-edit" onclick="openStoryPosEditor(\'' + meta.id + '\')">📝 POPIS KOMUNITY</button>';
                if (meta.canReset) extra += '<button type="button" class="map-popup-reset" onclick="resetStoryQuestPosition(\'' + meta.id + '\')">↺ RESET</button>';
            }
            if (meta.reqLine) extra += '<div class="popup-meta">🎒 Potřeba: ' + meta.reqLine + '</div>';
        }
        return mapV3Module.buildTacticalPopupHtml({
            category: category,
            storyId: gameQuests[meta.id] ? meta.id : null,
            title: title,
            desc: desc,
            extraHtml: extra
        });
    }
    var html = '<div class="map-popup-body' + (faded ? ' map-popup-inactive' : '') + '">';
    if (meta.isPoi) {
        if (meta.poiImg) {
            html += '<img class="poi-popup-img' + (faded ? ' poi-popup-img-inactive' : '') + '" src="' + meta.poiImg + '" alt="">';
        }
        if (meta.poiNote) {
            html += '<p class="popup-desc' + (faded ? ' popup-desc-inactive' : '') + '">' + meta.poiNote + '</p>';
        } else {
            html += '<p class="popup-meta">(Zatím bez poznámky — doplň v editoru)</p>';
        }
        html += '<button type="button" class="map-popup-edit" onclick="openPoiEditor(\'' + meta.id + '\')">📝 UPRAVIT POZNÁMKU / FOTO</button>';
        html += '<button type="button" class="map-popup-reset" onclick="deleteMapPoi(\'' + meta.id + '\')">🗑️ SMAZAT BOD</button>';
    } else {
        if (faded) {
            html += '<p class="popup-meta popup-inactive-tag">⏸ Neaktivní · mise splněna</p>';
        }
        if (meta.popupDesc) {
            html += '<p class="popup-desc' + (faded ? ' popup-desc-inactive' : '') + '">' + meta.popupDesc + '</p>';
        }
        if (meta.isStoryQuest) {
            if (meta.communityImg) {
                html += '<img class="poi-popup-img" src="' + meta.communityImg + '" alt="">';
            }
            if (meta.communityNote) {
                html += '<p class="popup-desc popup-community-note"><strong>📢 Komunita:</strong> ' + meta.communityNote + '</p>';
            }
            html += '<button type="button" class="map-popup-edit" onclick="openStoryPosEditor(\'' + meta.id + '\')">📝 POPIS KOMUNITY / FOTO</button>';
        }
        if (meta.reqLine) {
            html += '<div class="popup-meta' + (faded ? ' popup-desc-inactive' : '') + '">🎒 Potřeba na zádech: ' + meta.reqLine + '</div>';
        }
        if (meta.isStoryQuest && meta.canReset) {
            html += '<button type="button" class="map-popup-reset" onclick="resetStoryQuestPosition(\'' + meta.id + '\')">↺ RESET POLOHY A MISE</button>';
        }
    }
    html += '</div>';
    return html;
}

function getStoryQuestIds() {
    return ['roxy', 'sef', 'herbert', 'ino', 'adam'];
}

function isStoryQuestPlaced(questId) {
    return gameQuests[questId] && hasStoredQuestCoords(questId);
}

function canResetStoryQuest(questId) {
    if (!gameQuests[questId]) return false;
    if (isStoryQuestPlaced(questId)) return true;
    if (isPlayerCompletedCurrentRun(questId)) return true;
    if (isQuestCompleted(gameQuests[questId])) return true;
    return false;
}

function recalculateProfileMissionsFromQuestDone(data) {
    var stats = emptyIssuerStats();
    var count = 0;
    var quests = getAllQuestDefinitionsForOperator();
    for (var i = 0; i < quests.length; i++) {
        if (data.questDone && data.questDone[quests[i].id]) {
            count++;
            var fullQ = getQuestById(quests[i].id);
            if (fullQ) {
                var key = getIssuerKey(fullQ);
                stats[key] = (stats[key] || 0) + 1;
            }
        }
    }
    data.localMissions = count;
    data.localIssuerStats = stats;
}

function clearStoryQuestUserProgress(questId) {
    if (!gameQuests[questId]) return;
    var q = gameQuests[questId];
    var doneKey = q.doneKey || ('quest_done_' + questId);
    try { localStorage.removeItem(doneKey); } catch (e) {}

    var session = localStorage.getItem('patrac_session') || '';
    if (session) {
        var missed = getPlayerQuestMissedMap(session);
        if (missed[questId]) {
            delete missed[questId];
            localStorage.setItem('patrac_quest_missed_' + session, JSON.stringify(missed));
        }
        var data = loadUserProfileDataFromStorage(session);
        var profileChanged = false;
        if (data.questDone && data.questDone[questId]) {
            delete data.questDone[questId];
            profileChanged = true;
        }
        if (data.missionLog && data.missionLog.length) {
            var filtered = [];
            for (var m = 0; m < data.missionLog.length; m++) {
                if (data.missionLog[m].questId !== questId) filtered.push(data.missionLog[m]);
            }
            if (filtered.length !== data.missionLog.length) {
                data.missionLog = filtered;
                profileChanged = true;
            }
        }
        if (profileChanged) {
            recalculateProfileMissionsFromQuestDone(data);
            saveUserProfileData(session, data);
            if (!isOperatorMode || session !== currentlyEditingPlayerId) {
                applyUserProfileDataToSession(session, data);
            }
        }
    }

    if (isOperatorMode && operatorEditDraft) {
        if (!operatorEditDraft.questDone) operatorEditDraft.questDone = {};
        if (operatorEditDraft.questDone[questId]) {
            delete operatorEditDraft.questDone[questId];
            recalculateOperatorDraftFromQuests();
        }
    }
}

function getStoryQuestStatusText(questId) {
    if (!gameQuests[questId]) return '—';
    if (isQuestMissedByPlayer(questId)) {
        return '⏱ Lhůta vypršela — rank nezapsán';
    }
    if (isPlayerCompletedCurrentRun(questId)) {
        if (isStoryQuestPlaced(questId)) {
            return '✅ Výkon potvrzen · rank zapsán · trvalý bod na mapě';
        }
        return '✅ Výkon potvrzen · rank zapsán · ⚠️ bod na mapě chybí (↺ RESET)';
    }
    if (isQuestLaunchedCommunityWide(questId) && !isQuestRunExpired(questId)) {
        return '📡 Komunitní mise běží · potvrď polohu na místě';
    }
    if (isStoryQuestPlaced(questId)) {
        return '📍 Trvalý bod na mapě · čeká na nové komunitní spuštění';
    }
    return '⚠️ Bez trvalého bodu — spusť komunitní misi';
}

function restoreStoryQuestToActive(questId) {
    if (!gameQuests[questId]) return;
    var dismissed = getDismissedQuests();
    var dIdx = dismissed.indexOf(questId);
    if (dIdx !== -1) {
        dismissed.splice(dIdx, 1);
        localStorage.setItem('dismissed_quests', JSON.stringify(dismissed));
    }
    localStorage.setItem('unlocked_story_' + questId, 'true');
}

function startStoryQuestPlacement(questId) {
    if (!gameQuests[questId]) return;
    restoreStoryQuestToActive(questId);
    renderQuestList();
    renderStoryPositionsList();
    if (canUseMapPlacement()) {
        activatePlacementMode(questId);
    } else {
        placeQuestAtGps(questId);
    }
}

function panToStoryQuest(questId) {
    if (!map || !isStoryQuestPlaced(questId)) return;
    var lat = parseFloat(localStorage.getItem('point_' + questId + '_lat'));
    var lng = parseFloat(localStorage.getItem('point_' + questId + '_lng'));
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
}

function renderStoryPositionCardHtml(questId) {
    if (!gameQuests[questId]) return '';
    var q = getQuestWithReq(gameQuests[questId]);
    var label = getQuestMapLabel(q);
    var status = getStoryQuestStatusText(questId);
    var placed = isStoryQuestPlaced(questId);
    var isUnlocked = isQuestUnlockedForPlayer(questId);
    var runDone = isPlayerCompletedCurrentRun(questId);
    var commNote = getStoryPosCommunityNote(questId);
    var html = '<div class="quest-card" style="margin-bottom:8px;">';
    html += '<div class="quest-header" style="color:var(--text-green);">📍 ' + label + '</div>';
    html += '<div class="story-pos-status">' + status + '</div>';
    if (commNote) {
        html += '<div class="story-pos-community-note">📢 ' + commNote + '</div>';
    }
    html += renderCommunityQuestStatusHtml(questId, q);
    html += '<div class="story-pos-actions">';
    if (placed) {
        html += '<button class="btn-accept" style="border-color:var(--xp-blue);color:var(--xp-blue);" onclick="panToStoryQuest(\'' + questId + '\')">🗺️ NA MAPĚ</button>';
        html += '<button class="btn-accept" style="border-color:var(--text-green);color:var(--text-green);" onclick="openStoryPosEditor(\'' + questId + '\')">📝 POPIS KOMUNITY</button>';
    }
    if (isUnlocked && !runDone && !isQuestMissedByPlayer(questId)) {
        html += '<button class="btn-accept" style="border-color:var(--text-green);color:var(--text-green);" onclick="completeQuestAtLocation(\'' + questId + '\')">✅ POTVRDIT POZICI (GPS)</button>';
    }
    if (!isUnlocked && !isQuestMissedByPlayer(questId)) {
        html += '<button class="btn-accept" onclick="attemptStartQuest(\'' + questId + '\')">🔓 SPUSTIT PRO KOMUNITU</button>';
    }
    if (canUseMapPlacement()) {
        html += '<button class="btn-accept" style="border-color:var(--muted-fg);color:var(--muted-fg);" onclick="activatePlacementMode(\'' + questId + '\')">🗺️ ADMIN: MAPA</button>';
    }
    if (canResetStoryQuest(questId)) {
        html += '<button class="btn-accept" style="border-color:var(--danger-orange);color:var(--danger-orange);" onclick="resetStoryQuestPosition(\'' + questId + '\')">↺ RESET</button>';
    }
    html += '</div></div>';
    return html;
}

function renderStoryPositionsList() {
    var el = document.getElementById('map-story-positions-list');
    if (!el) return;
    var ids = getStoryQuestIds();
    var html = '';
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var label = getQuestMapLabel(id);
        var status = getStoryQuestStatusText(id);
        var commNote = getStoryPosCommunityNote(id);
        html += '<div class="story-map-row"><strong style="color:var(--text-green);">' + label + '</strong><br><span style="font-size:var(--text-sm);color:var(--subtle-fg);">' + status + '</span>';
        if (commNote) {
            html += '<br><span style="font-size:var(--text-sm);color:var(--muted-fg);font-style:italic;">📢 ' + commNote + '</span>';
        }
        html += '<div class="story-pos-actions" style="margin-top:6px;">';
        var storyUnlocked = isQuestUnlockedForPlayer(id);
        var storyRunDone = isPlayerCompletedCurrentRun(id);
        if (isStoryQuestPlaced(id)) {
            html += '<button class="btn-accept" style="border-color:var(--xp-blue);color:var(--xp-blue);" onclick="panToStoryQuest(\'' + id + '\')">🗺️ Přejít</button>';
            html += '<button class="btn-accept" style="border-color:var(--text-green);color:var(--text-green);" onclick="openStoryPosEditor(\'' + id + '\')">📝 Popis</button>';
        }
        if (storyUnlocked && !storyRunDone && !isQuestMissedByPlayer(id)) {
            html += '<button class="btn-accept" style="border-color:var(--text-green);color:var(--text-green);" onclick="completeQuestAtLocation(\'' + id + '\')">✅ Potvrdit GPS</button>';
        }
        if (!storyUnlocked && !isQuestMissedByPlayer(id)) {
            html += '<button class="btn-accept" onclick="attemptStartQuest(\'' + id + '\')">🔓 Spustit</button>';
        }
        if (canUseMapPlacement()) {
            html += '<button class="btn-accept" style="border-color:var(--muted-fg);color:var(--muted-fg);" onclick="activatePlacementMode(\'' + id + '\')">🗺️ Admin</button>';
        }
        if (canResetStoryQuest(id)) {
            html += '<button class="btn-accept" style="border-color:var(--danger-orange);color:var(--danger-orange);" onclick="resetStoryQuestPosition(\'' + id + '\')">↺ Reset</button>';
        }
        html += '</div></div>';
    }
    el.innerHTML = html;
}

function openStoryPositionsPanel() {
    cancelTargeting();
    closeAddPoiPanel();
    closePoiEditor();
    closeStoryPosEditor();
    renderStoryPositionsList();
    document.getElementById('map-story-bar').style.display = 'block';
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
    updateMapCrosshair();
}

function closeStoryPositionsPanel() {
    document.getElementById('map-story-bar').style.display = 'none';
    updateMapCrosshair();
}

function closeAllMapPanels() {
    closeAddPoiPanel();
    closeStoryPositionsPanel();
    closePoiEditor();
}

function getPoiById(poiId) {
    var pois = getSafeJSON('map_free_pois');
    for (var i = 0; i < pois.length; i++) {
        if (pois[i].id === poiId) return { poi: pois[i], index: i, list: pois };
    }
    return null;
}

function migratePoiNotes() {
    if (localStorage.getItem('poi_note_migrated') === 'true') return;
    var pois = getSafeJSON('map_free_pois');
    var changed = false;
    for (var i = 0; i < pois.length; i++) {
        if (!pois[i].note && pois[i].desc) {
            pois[i].note = pois[i].desc;
            changed = true;
        }
    }
    if (changed) localStorage.setItem('map_free_pois', JSON.stringify(pois));
    localStorage.setItem('poi_note_migrated', 'true');
}

function repairStoryQuestDismissed() {
    var dismissed = getDismissedQuests();
    var changed = false;
    for (var k in gameQuests) {
        var idx = dismissed.indexOf(k);
        if (idx !== -1) {
            dismissed.splice(idx, 1);
            changed = true;
        }
    }
    if (changed) localStorage.setItem('dismissed_quests', JSON.stringify(dismissed));
}

function previewPoiImage(input) {
    if (!input.files || !input.files[0]) return;
    compressImageFile(input.files[0], PHOTO_PLACE_MAX_PX, PHOTO_PLACE_QUALITY, function(result) {
        base64PoiImg = result;
        document.getElementById('poi-create-preview').innerHTML = '<img src="' + result + '">';
    });
}

function previewPoiEditImage(input) {
    if (!input.files || !input.files[0]) return;
    compressImageFile(input.files[0], PHOTO_PLACE_MAX_PX, PHOTO_PLACE_QUALITY, function(result) {
        base64PoiEditImg = result;
        document.getElementById('poi-edit-preview').innerHTML = '<img src="' + result + '">';
    });
}

function openPoiEditor(poiId) {
    var found = getPoiById(poiId);
    if (!found) return;
    var poi = found.poi;
    closeStoryPositionsPanel();
    closeStoryPosEditor();
    document.getElementById('poi-edit-id').value = poiId;
    document.getElementById('poi-edit-name').value = poi.name || '';
    document.getElementById('poi-edit-note').value = poi.note || poi.desc || '';
    base64PoiEditImg = poi.img || '';
    var prev = document.getElementById('poi-edit-preview');
    prev.innerHTML = poi.img ? '<img src="' + poi.img + '">' : 'BEZ FOTO';
    document.getElementById('poi-edit-bar').style.display = 'block';
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
    updateMapCrosshair();
}

function closePoiEditor() {
    document.getElementById('poi-edit-bar').style.display = 'none';
    base64PoiEditImg = '';
    updateMapCrosshair();
}

function previewStoryPosEditImage(input) {
    if (!input.files || !input.files[0]) return;
    compressImageFile(input.files[0], PHOTO_PLACE_MAX_PX, PHOTO_PLACE_QUALITY, function(result) {
        base64StoryPosEditImg = result;
        storyPosEditHadImg = true;
        document.getElementById('story-pos-edit-preview').innerHTML = '<img src="' + result + '">';
    });
}

function openStoryPosEditor(questId) {
    if (!gameQuests[questId] || !isStoryQuestPlaced(questId)) return;
    closeStoryPositionsPanel();
    closeAddPoiPanel();
    closePoiEditor();
    document.getElementById('story-pos-edit-id').value = questId;
    document.getElementById('story-pos-edit-note').value = getStoryPosCommunityNote(questId);
    base64StoryPosEditImg = getStoryPosCommunityImg(questId);
    storyPosEditHadImg = !!base64StoryPosEditImg;
    var prev = document.getElementById('story-pos-edit-preview');
    prev.innerHTML = base64StoryPosEditImg ? '<img src="' + base64StoryPosEditImg + '">' : 'BEZ FOTO';
    document.getElementById('story-pos-edit-bar').style.display = 'block';
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
    updateMapCrosshair();
}

function closeStoryPosEditor() {
    document.getElementById('story-pos-edit-bar').style.display = 'none';
    base64StoryPosEditImg = '';
    storyPosEditHadImg = false;
    updateMapCrosshair();
}

function saveStoryPosChanges() {
    var questId = document.getElementById('story-pos-edit-id').value;
    if (!gameQuests[questId]) return;
    var note = document.getElementById('story-pos-edit-note').value.trim();
    localStorage.setItem('story_pos_note_' + questId, note);
    if (storyPosEditHadImg) {
        if (base64StoryPosEditImg) {
            localStorage.setItem('story_pos_img_' + questId, base64StoryPosEditImg);
        } else {
            localStorage.removeItem('story_pos_img_' + questId);
        }
    }
    var lat = parseFloat(localStorage.getItem('point_' + questId + '_lat'));
    var lng = parseFloat(localStorage.getItem('point_' + questId + '_lng'));
    if (lat && lng) {
        var q = gameQuests[questId];
        renderPointOnMap(questId, lat, lng, q.title, q.desc);
    }
    closeStoryPosEditor();
    renderStoryPositionsList();
    renderQuestList();
    syncCommunityPoisToCloud();
}

function deleteMapPoi(poiId) {
    var found = getPoiById(poiId);
    if (!found) return;
    var label = found.poi.name || poiId;
    if (!confirm('Smazat bod „' + label + '“?\nSouvisející fotka v cloudu bude také odstraněna.')) return;

    found.list.splice(found.index, 1);
    localStorage.setItem('map_free_pois', JSON.stringify(found.list));

    if (map && mapMarkerRegistry[poiId] && mapPointsLayer) {
        mapPointsLayer.removeLayer(mapMarkerRegistry[poiId]);
        delete mapMarkerRegistry[poiId];
    }

    closePoiEditor();
    closeAddPoiPanel();
    syncCommunityPoisToCloud();
}

function deleteMapPoiFromEditor() {
    var poiId = document.getElementById('poi-edit-id').value;
    if (poiId) deleteMapPoi(poiId);
}

function savePoiChanges() {
    var poiId = document.getElementById('poi-edit-id').value;
    var found = getPoiById(poiId);
    if (!found) return;
    var name = document.getElementById('poi-edit-name').value.trim();
    if (!name) { alert('Název bodu je povinný.'); return; }
    found.poi.name = name;
    found.poi.note = document.getElementById('poi-edit-note').value.trim();
    if (base64PoiEditImg) found.poi.img = base64PoiEditImg;
    found.list[found.index] = found.poi;
    localStorage.setItem('map_free_pois', JSON.stringify(found.list));
    renderPointOnMap(poiId, found.poi.lat, found.poi.lng, found.poi.name, found.poi.note || '');
    closePoiEditor();
    syncCommunityPoisToCloud();
}

function resetStoryQuestPosition(questId) {
    if (!gameQuests[questId]) return;
    var q = gameQuests[questId];
    if (!canResetStoryQuest(questId)) return;
    if (!confirm('Resetovat prvotní misi „' + (q.mapLabel || q.title) + '“?\nSmaže se poloha na mapě, stav splnění i komunitní průběh — misi půjde znovu spustit a zaměřit.')) return;

    localStorage.removeItem(q.latKey || ('point_' + questId + '_lat'));
    localStorage.removeItem(q.lngKey || ('point_' + questId + '_lng'));
    clearStoryQuestUserProgress(questId);
    localStorage.setItem('unlocked_story_' + questId, 'true');
    clearStoryPosCommunityData(questId);
    closeStoryPosEditor();

    var dismissed = getDismissedQuests();
    var dIdx = dismissed.indexOf(questId);
    if (dIdx !== -1) {
        dismissed.splice(dIdx, 1);
        localStorage.setItem('dismissed_quests', JSON.stringify(dismissed));
    }

    if (map && mapMarkerRegistry[questId] && mapPointsLayer) {
        mapPointsLayer.removeLayer(mapMarkerRegistry[questId]);
        delete mapMarkerRegistry[questId];
    }

    var launched = getCommunityLaunchedQuests();
    if (launched[questId]) {
        delete launched[questId];
        setCommunityLaunchedQuests(launched);
    }

    renderQuestList();
    rebuildSelectOptions();
    rebuildCustomLocLinkSelect();
    renderStoryPositionsList();
    reloadAllMapPoints();
    updateStatsHud();
    syncCommunityPoisToCloud();
    syncCommunityQuestsToCloud();
    syncPlayerQuestProgressToCloud();
}

function getAvailablePositionPoints() {
    var list = [];
    var storyIds = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    for (var i = 0; i < storyIds.length; i++) {
        var id = storyIds[i];
        if (!shouldShowQuestPointOnMap(id)) continue;
        var lat = localStorage.getItem('point_' + id + '_lat');
        var lng = localStorage.getItem('point_' + id + '_lng');
        if (lat && lng) {
            list.push({
                key: 'story:' + id,
                label: getQuestMapLabel(id) + ' (prvotní bod)',
                lat: parseFloat(lat), lng: parseFloat(lng)
            });
        }
    }
    var customQuests = getSafeJSON('custom_quests_list');
    for (var j = 0; j < customQuests.length; j++) {
        var cq = customQuests[j];
        if (!shouldShowQuestPointOnMap(cq.id)) continue;
        var latC = localStorage.getItem('point_' + cq.id + '_lat');
        var lngC = localStorage.getItem('point_' + cq.id + '_lng');
        if (latC && lngC) {
            list.push({
                key: 'quest:' + cq.id,
                label: getQuestMapLabel(cq) + ' (vlastní úkol)',
                lat: parseFloat(latC), lng: parseFloat(lngC)
            });
        }
    }
    var pois = getSafeJSON('map_free_pois');
    for (var p = 0; p < pois.length; p++) {
        list.push({
            key: 'poi:' + pois[p].id,
            label: pois[p].name + ' (volný bod)',
            lat: pois[p].lat, lng: pois[p].lng
        });
    }
    var randomQuests = getRandomQuestsList();
    for (var r = 0; r < randomQuests.length; r++) {
        var rq = randomQuests[r];
        if (!shouldShowQuestPointOnMap(rq.id)) continue;
        var latR = localStorage.getItem('point_' + rq.id + '_lat');
        var lngR = localStorage.getItem('point_' + rq.id + '_lng');
        if (latR && lngR) {
            list.push({
                key: 'random:' + rq.id,
                label: getQuestMapLabel(rq) + ' (náhodný rozkaz)',
                lat: parseFloat(latR), lng: parseFloat(lngR)
            });
        }
    }
    return list;
}

function rebuildCustomLocLinkSelect() {
    var sel = document.getElementById('custom-loc-link-point');
    if (!sel) return;
    var points = getAvailablePositionPoints();
    var html = '';
    if (points.length === 0) {
        html = '<option value="">— Zatím žádné body na mapě —</option>';
    } else {
        for (var i = 0; i < points.length; i++) {
            html += '<option value="' + points[i].key + '" data-lat="' + points[i].lat + '" data-lng="' + points[i].lng + '">' + points[i].label + '</option>';
        }
    }
    sel.innerHTML = html;
}

function onCustomLocModeChange() {
    var mode = document.getElementById('custom-loc-position-mode').value;
    var linkBox = document.getElementById('custom-loc-link-box');
    if (linkBox) {
        linkBox.style.display = (mode === 'link') ? 'block' : 'none';
        if (mode === 'link') rebuildCustomLocLinkSelect();
    }
}

function saveQuestCoords(questId, lat, lng) {
    localStorage.setItem('point_' + questId + '_lat', lat);
    localStorage.setItem('point_' + questId + '_lng', lng);
    snapshotCommunityMapCache();
    syncCommunityQuestsToCloud();
    syncCommunityPoisToCloud();
    patracRefreshFogOfWar();
}

function getMapPointMeta(id, lat, lng) {
    if (gameQuests[id]) {
        var sq = getQuestWithReq(gameQuests[id]);
        var reqLine = sq.req && sq.req.length ? sq.req.join(', ') : '';
        return {
            id: id, lat: lat, lng: lng,
            mapLabel: getQuestMapLabel(sq),
            popupDesc: sq.desc,
            assignerLine: getQuestAssignerBadge(sq),
            reqLine: reqLine,
            isStoryQuest: true,
            canReset: true,
            isCompleted: false,
            communityNote: getStoryPosCommunityNote(id),
            communityImg: getStoryPosCommunityImg(id)
        };
    }
    var cq = getQuestById(id);
    if (cq && id.substring(0, 7) === 'custom_') {
        var reqC = cq.req && cq.req.length ? cq.req.join(', ') : '';
        return {
            id: id, lat: lat, lng: lng,
            mapLabel: getQuestMapLabel(cq),
            popupDesc: cq.desc,
            assignerLine: getQuestAssignerBadge(cq),
            reqLine: reqC,
            isStoryQuest: false,
            canReset: false,
            isCompleted: isQuestCompleted(cq)
        };
    }
    if (cq && isRandomQuestId(id)) {
        var reqR = cq.req && cq.req.length ? cq.req.join(', ') : '';
        return {
            id: id, lat: lat, lng: lng,
            mapLabel: cq.title,
            popupDesc: cq.desc,
            assignerLine: getQuestAssignerBadge(cq),
            reqLine: reqR,
            isStoryQuest: false,
            canReset: false,
            isCompleted: isQuestCompleted(cq)
        };
    }
    var pois = getSafeJSON('map_free_pois');
    for (var i = 0; i < pois.length; i++) {
        if (pois[i].id === id) {
            return {
                id: id, lat: lat, lng: lng,
                mapLabel: pois[i].name,
                poiNote: pois[i].note || pois[i].desc || '',
                poiImg: pois[i].img || '',
                popupDesc: '',
                isPoi: true,
                isStoryQuest: false,
                canReset: false
            };
        }
    }
    return {
        id: id, lat: lat, lng: lng,
        mapLabel: 'Bod',
        popupDesc: '',
        assignerLine: '',
        reqLine: '',
        isStoryQuest: false,
        canReset: false
    };
}

function renderPointOnMap(id, lat, lng, title, desc) {
    var meta = getMapPointMeta(id, lat, lng);
    if (title && !gameQuests[id] && id.substring(0, 7) === 'custom_') {
        meta.mapLabel = title;
        if (desc) meta.popupDesc = desc;
    }
    if (id.substring(0, 4) === 'poi_') {
        meta.mapLabel = title || meta.mapLabel;
    }
    renderMapPointFromMeta(meta);
}

function renderMapPointFromMeta(meta) {
    if (!map || !mapPointsLayer) return;
    var id = meta.id;
    if (mapMarkerRegistry[id]) {
        mapPointsLayer.removeLayer(mapMarkerRegistry[id]);
    }
    var faded = meta.isCompleted && !meta.isStoryQuest;
    var category = getMapPointCategory(meta);
    var storyId = gameQuests[id] ? id : null;
    var activeQuest = !faded && isActiveQuestAtPoint(id);
    var filter = getMapLayerFilter();
    var dimmed = !filter[category];
    var color = getMapPointColor(id);
    var popupHtml = buildMapPopupHtml(meta);
    var label = meta.mapLabel || 'Bod';

    function attachMarker(pointMarker) {
        pointMarker.bindPopup(popupHtml, { maxWidth: 280, minWidth: 200, className: 'map-v3-leaflet-popup' });
        pointMarker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            setMapNavTarget(meta.lat, meta.lng, label);
            pointMarker.openPopup();
        });
        mapMarkerRegistry[id] = pointMarker;
    }

    if (mapV3Module && window.L) {
        var html = mapV3Module.buildMapMarkerHtml({
            id: id,
            mapLabel: label,
            category: category,
            storyId: storyId,
            activeQuest: activeQuest,
            color: color,
            dimmed: dimmed
        });
        var icon = L.divIcon({
            className: 'map-v3-divicon',
            html: html,
            iconSize: [88, 52],
            iconAnchor: [44, 26],
            popupAnchor: [0, -22]
        });
        attachMarker(L.marker([meta.lat, meta.lng], { icon: icon, pane: 'mapPointsPane' }).addTo(mapPointsLayer));
        return;
    }

    patracImport('map/mapV3.js').then(function(m) {
        mapV3Module = m;
        renderMapPointFromMeta(meta);
    }).catch(function() {
        var neonColor = faded ? '#5a6858' : color;
        var shortLabel = buildMapLabelHtml(meta);
        var tooltipClass = 'map-point-label' + (faded ? ' map-point-inactive' : '');
        var pointMarker = L.circleMarker([meta.lat, meta.lng], {
            radius: faded ? 7 : 9,
            color: neonColor,
            weight: faded ? 2 : 3,
            fillColor: neonColor,
            fillOpacity: dimmed ? 0.08 : (faded ? 0.12 : 0.35),
            pane: 'mapPointsPane',
            opacity: dimmed ? 0.4 : 1
        }).addTo(mapPointsLayer);
        pointMarker.bindTooltip(shortLabel, {
            permanent: true, direction: 'top', className: tooltipClass, offset: [0, -10], opacity: dimmed ? 0.4 : 0.95
        });
        attachMarker(pointMarker);
    });
}

function getMapPointColor(type) {
    if (type === 'roxy') return '#0088ff';
    if (type === 'sef') return '#00ffff';
    if (type === 'herbert') return '#2b9348';
    if (type === 'ino') return '#ffcc00';
    if (type === 'adam') return '#ff5500';
    if (type && type.substring(0, 7) === 'custom_') return '#0088ff';
    if (type && type.substring(0, 7) === 'random_') return '#ffcc00';
    if (type && type.substring(0, 4) === 'poi_') return '#4af626';
    return '#4af626';
}

function reloadAllMapPoints() {
    if (!mapPointsLayer) return;
    mapPointsLayer.clearLayers();
    mapMarkerRegistry = {};

    var all = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    for (var i = 0; i < all.length; i++) {
        var type = all[i];
        if (!shouldShowQuestPointOnMap(type)) continue;
        var lat = localStorage.getItem('point_' + type + '_lat');
        var lng = localStorage.getItem('point_' + type + '_lng');
        if (lat && lng) {
            var q = gameQuests[type];
            renderPointOnMap(type, parseFloat(lat), parseFloat(lng), q.title, q.desc);
        }
    }
    var customQuests = getSafeJSON('custom_quests_list');
    for (var j = 0; j < customQuests.length; j++) {
        var cq = customQuests[j];
        if (!shouldShowQuestPointOnMap(cq.id)) continue;
        var latC = localStorage.getItem('point_' + cq.id + '_lat');
        var lngC = localStorage.getItem('point_' + cq.id + '_lng');
        if (latC && lngC) renderPointOnMap(cq.id, parseFloat(latC), parseFloat(lngC), cq.title, cq.desc);
    }
    var randomQuests = getRandomQuestsList();
    for (var rq = 0; rq < randomQuests.length; rq++) {
        var rnd = randomQuests[rq];
        if (!shouldShowQuestPointOnMap(rnd.id)) continue;
        var latR = localStorage.getItem('point_' + rnd.id + '_lat');
        var lngR = localStorage.getItem('point_' + rnd.id + '_lng');
        if (latR && lngR) renderPointOnMap(rnd.id, parseFloat(latR), parseFloat(lngR), rnd.title, rnd.desc);
    }
    var pois = getSafeJSON('map_free_pois');
    for (var p = 0; p < pois.length; p++) {
        var poi = pois[p];
        renderPointOnMap(poi.id, poi.lat, poi.lng, poi.name, poi.note || poi.desc || '');
    }
    if (typeof window.patracPoctaReloadMap === 'function') window.patracPoctaReloadMap();
    patracRefreshFogOfWar();
}

/** Obnoví vrstvy mapy po init (pořadí: mlha < body < MGRS). */
function refreshMapLayerStack() {
    ensureMapPanes();
    if (map && map.getPane('mapFogPane')) map.getPane('mapFogPane').style.zIndex = 450;
    if (map && map.getPane('mapPointsPane')) map.getPane('mapPointsPane').style.zIndex = 640;
    if (map && map.getPane('mapGridPane')) map.getPane('mapGridPane').style.zIndex = 665;
    if (map && map.getPane('mapMeasurePane')) map.getPane('mapMeasurePane').style.zIndex = 670;
    patracRefreshFogOfWar();
    if (mgrsGridMod && mgrsGridMod.refreshMgrsGrid) mgrsGridMod.refreshMgrsGrid();
}

function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceMeters(lat1, lng1, lat2, lng2) {
    return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

function getUserPositionOrAlert() {
    if (!lastUserPosition) {
        alert('GPS poloha není k dispozici. Povol polohu v prohlížeči a počkej na lock, nebo stiskni CENTR.');
        return null;
    }
    if (Date.now() - lastUserPosition.ts > 120000) {
        alert('GPS signál je zastaralý. Počkej na obnovení nebo stiskni CENTR.');
        return null;
    }
    return lastUserPosition;
}

function getEffectiveGpsRadiusM() {
    var acc = lastUserPosition ? lastUserPosition.accuracy : 30;
    return QUEST_GPS_RADIUS_M + Math.min(acc, 50);
}

function isUserNearCoords(targetLat, targetLng) {
    var pos = getUserPositionOrAlert();
    if (!pos) return false;
    var dist = distanceMeters(pos.lat, pos.lng, targetLat, targetLng);
    var maxDist = getEffectiveGpsRadiusM();
    if (dist > maxDist) {
        alert('Nejsi na místě úkolu. Vzdálenost: ' + Math.round(dist) + ' m (limit ~' + Math.round(maxDist) + ' m). Dojdi fyzicky k cíli.');
        return false;
    }
    return true;
}

function getQuestStoredCoords(questId) {
    if (!hasStoredQuestCoords(questId)) return null;
    return {
        lat: parseFloat(localStorage.getItem('point_' + questId + '_lat')),
        lng: parseFloat(localStorage.getItem('point_' + questId + '_lng'))
    };
}

function isUserNearQuest(questId) {
    var coords = getQuestStoredCoords(questId);
    if (!coords) {
        alert('Úkol nemá nastavenou pozici. Nejdřív ji zaměř GPS na místě nebo vyber bod z mapy.');
        return false;
    }
    return isUserNearCoords(coords.lat, coords.lng);
}

function placeQuestAtGps(questId) {
    var pos = getUserPositionOrAlert();
    if (!pos) return;
    var q = getQuestById(questId);
    if (!q) return;
    saveQuestCoords(questId, pos.lat, pos.lng);
    renderPointOnMap(questId, pos.lat, pos.lng, q.mapLabel || q.title, q.desc);
    rebuildCustomLocLinkSelect();
    renderQuestList();
    renderStoryPositionsList();
    alert('📍 Pozice „' + getQuestMapLabel(q) + '“ uložena z GPS. Misi splníš po fyzickém výkonu na místě.');
}

function finalizeQuestComplete(q) {
    recordMissionComplete(q);
    refreshQuestMapPoint(q.id);
    var comItems = getCommunityItemsRaw().slice();
    var persItems = getCurrentPersonalItems().slice();
    for (var i = 0; i < comItems.length; i++) { if (comItems[i].bind === q.id) comItems[i].locked = false; }
    for (var i = 0; i < persItems.length; i++) { if (persItems[i].bind === q.id) persItems[i].locked = false; }
    saveCommunityItemsRaw(comItems);
    saveCurrentPersonalItems(persItems);
    var poctaReward = null;
    if (typeof window.patracMaybeGrantPoctaReward === 'function') {
        poctaReward = window.patracMaybeGrantPoctaReward(q);
    }
    updateStatsHud();
    renderQuestList();
    renderStoryPositionsList();
    rebuildSelectOptions();
    rebuildCustomLocLinkSelect();
    ensureRandomQuests();
    loadCustomCraftedItems();
    syncPlayerQuestProgressToCloud();
    return poctaReward;
}

function completeQuestAtLocation(questId) {
    processCommunityQuestExpiries();
    var q = getQuestById(questId);
    if (!q) return;

    if (isQuestMissedByPlayer(questId)) {
        alert('Lhůta vypršela — rank za tuto misi už nezískáš.');
        renderQuestList();
        return;
    }

    if (usesCommunityLaunchQuest(questId)) {
        if (!isQuestLaunchedCommunityWide(questId)) {
            alert('Nejdřív musí někdo z komunity spustit rozkaz.');
            return;
        }
        if (isQuestRunExpired(questId)) {
            markQuestMissedByPlayer(questId);
            syncPlayerQuestProgressToCloud();
            alert('Lhůta pro potvrzení na místě vypršela — rank se nezapíše.');
            renderQuestList();
            return;
        }
        if (isPlayerCompletedCurrentRun(questId)) {
            alert('V tomto kole jsi už výkon potvrdil.');
            return;
        }
    }

    var poctaReward;
    if (isStoryQuestId(questId)) {
        var pos = getUserPositionOrAlert();
        if (!pos) return;
        recordStoryRunCompletion(questId, pos.lat, pos.lng);
        syncCommunityQuestsToCloud();
        poctaReward = finalizeQuestComplete(q);
        var msg = '✅ Mise „' + (q.title || getQuestMapLabel(q)) + '“ splněna. Rank zapsán tobě.';
        msg += '\n\n📍 Trvalý bod na mapě byl právě aktualizován.';
        if (poctaReward) {
            msg += '\n\n✝ Komunita získala Poctu: „' + poctaReward.title + '“\nKód: ' + poctaReward.code + '\n→ Inventář komunity (neaktivovaná).';
        }
        alert(msg);
        return;
    }

    if (!isUserNearQuest(questId)) return;
    poctaReward = finalizeQuestComplete(q);
    var msg2 = '✅ Mise „' + (q.title || getQuestMapLabel(q)) + '“ splněna. Rank a odměna jsou zapsány tobě.';
    if (poctaReward) {
        msg2 += '\n\n✝ Komunita získala Poctu: „' + poctaReward.title + '“\nKód: ' + poctaReward.code + '\n→ Inventář komunity (neaktivovaná).';
    }
    alert(msg2);
}

function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(2) + ' km';
}

/** Azimut od severu (0° = N, po směru hodin) ve stupních. */
function bearingDegrees(lat1, lng1, lat2, lng2) {
    var phi1 = lat1 * Math.PI / 180;
    var phi2 = lat2 * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var y = Math.sin(dLng) * Math.cos(phi2);
    var x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
    var brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

function normalizeDeg(d) {
    return ((d % 360) + 360) % 360;
}

function updateCompassUi() {
    updateCompassCenterDeg();
    applyCompassNorthArrow();
    updateTacticalHud();
}

function getMapCenterCoords() {
    if (!map) return { lat: 49.715, lng: 13.220 };
    var c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
}

function isOverlayPanelVisible(id) {
    var el = document.getElementById(id);
    return el && el.style.display === 'block';
}

function isMapOverlayOpen() {
    return !!activeTargetingQuest
        || isPoiPanelOpen()
        || isOverlayPanelVisible('poi-edit-bar')
        || isOverlayPanelVisible('story-pos-edit-bar')
        || isOverlayPanelVisible('map-story-bar');
}

function updateMapCompassDisplay() {
    var compass = document.getElementById('map-compass');
    if (!compass) return;
    var hud = mapHud();
    var userWants = hud ? hud.isCompassWanted() : true;
    var show = hud ? hud.isCompassEffective() : false;
    if (show) setCompassWidgetExpanded(true);
    compass.style.display = show ? 'block' : 'none';
    var fab = document.getElementById('fab-compass');
    if (fab) fab.classList.toggle('is-active', show && userWants);
}
window.updateMapCompassDisplay = updateMapCompassDisplay;

function setMapToolsVisible(show) {
    if (mapHud()) {
        mapHud().setMapToolsTabActive(show);
        if (show) mapHud().resetRulerOnMapTabEnter();
    }
    var bar = document.getElementById('map-tools-bar');
    if (bar) bar.style.display = show ? 'flex' : 'none';
    var shelterBtn = document.getElementById('btn-center-shelter');
    if (shelterBtn) shelterBtn.style.display = show ? 'flex' : 'none';
    var layersPanel = document.getElementById('map-layers-panel');
    if (layersPanel) layersPanel.classList.toggle('visible', show);
    var layersDrop = document.getElementById('map-layers-dropdown');
    if (layersDrop && !show) layersDrop.classList.remove('open');
    var fabsEl = document.getElementById('map-tool-fabs');
    if (fabsEl && show) fabsEl.style.display = '';
    var tacticalEl = document.getElementById('map-tactical-hud');
    if (tacticalEl && show) tacticalEl.style.display = '';
    updateMapToolFabs();
    updateMapCompassDisplay();
    updateTopoRulerDisplay();
    updateRoutePlannerDisplay();
    updateTacticalHud();
    if (show) {
        ensureMapTouchPan();
        resetMapBearingRotation();
        updateCompassPermissionUi();
        updateCompassUi();
        applyCompassDockPosition();
        if (map) setTimeout(function() {
            map.invalidateSize();
            ensureMapTouchPan();
            patracRefreshFogOfWar();
        }, 150);
    } else {
        resetMapBearingRotation();
    }
}

function isPoiPanelOpen() {
    var bar = document.getElementById('map-add-poi-bar');
    return bar && bar.style.display === 'block';
}

function updateMapCrosshair() {
    var el = document.getElementById('map-crosshair');
    if (!el) return;
    var show = canUseMapPlacement() && (!!activeTargetingQuest || isPoiPanelOpen());
    el.style.display = show ? 'block' : 'none';
}

function openAddPoiPanel() {
    cancelTargeting();
    closeStoryPositionsPanel();
    closePoiEditor();
    closeStoryPosEditor();
    base64PoiImg = '';
    var prev = document.getElementById('poi-create-preview');
    if (prev) prev.innerHTML = 'BEZ FOTO';
    var titleEl = document.getElementById('map-add-poi-title');
    if (titleEl) {
        titleEl.textContent = canUseMapPlacement()
            ? '📍 NOVÝ VOLNÝ BOD (STŘED MAPY — ADMIN)'
            : '📍 NOVÝ VOLNÝ BOD (GPS POLOHA)';
    }
    document.getElementById('map-add-poi-bar').style.display = 'block';
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
    updateMapCrosshair();
}

function closeAddPoiPanel() {
    document.getElementById('map-add-poi-bar').style.display = 'none';
    updateMapCrosshair();
}

function confirmAddMapPoi() {
    var name = document.getElementById('poi-name').value.trim();
    var note = document.getElementById('poi-note').value.trim();
    if (!name) { alert('Zadej název bodu!'); return; }
    var lat, lng;
    if (canUseMapPlacement()) {
        var center = getMapCenterCoords();
        lat = center.lat;
        lng = center.lng;
    } else {
        var pos = getUserPositionOrAlert();
        if (!pos) return;
        lat = pos.lat;
        lng = pos.lng;
    }
    var pois = getSafeJSON('map_free_pois');
    var poiId = 'poi_' + Date.now();
    pois.push({
        id: poiId, name: name, note: note, desc: note,
        img: base64PoiImg || '',
        lat: lat, lng: lng,
        date: new Date().toLocaleString('cs-CZ'),
        creator: localStorage.getItem('player_name') || 'Operativec'
    });
    localStorage.setItem('map_free_pois', JSON.stringify(pois));
    renderPointOnMap(poiId, lat, lng, name, note);
    document.getElementById('poi-name').value = '';
    document.getElementById('poi-note').value = '';
    document.getElementById('poi-file').value = '';
    base64PoiImg = '';
    document.getElementById('poi-create-preview').innerHTML = 'BEZ FOTO';
    closeAddPoiPanel();
    alert('Bod „' + name + '“ uložen. Poznámku a foto doplníš kdykoli v detailu bodu.');
    syncCommunityPoisToCloud();
    patracRefreshFogOfWar();
}

