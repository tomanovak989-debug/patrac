/**
 * Mlha války — mapa zahalená, odkrývá se kruhy 500 m kolem trvalých bodů / POI / GPS.
 * Vrstva uvnitř Leaflet (pod body a MGRS mřížkou).
 */

/** Před ostrým startem nechat true; pro launch nastavit false (zůstane jen logika bez UI). */
export var FOG_ADMIN_UI_ENABLED = true;

export var FOG_REVEAL_RADIUS_M = 500;

var FOG_PANE_Z = 450;

var _deps = null;
var _canvas = null;
var _ctx = null;
var _bound = false;
var _enabled = true;
var _revealAll = false;

var STORAGE_ENABLED = 'patrac_fog_enabled';
var STORAGE_REVEAL_ALL = 'patrac_fog_reveal_all';

function getComCode() {
    try {
        return String(localStorage.getItem('com_code') || '').trim().toUpperCase();
    } catch (e) {
        return '';
    }
}

function storageKey(base) {
    var comCode = getComCode();
    return comCode ? base + '_' + comCode : base;
}

function getMap() {
    return _deps && _deps.getMap ? _deps.getMap() : null;
}

function isOperator() {
    return _deps && typeof _deps.isOperator === 'function' && _deps.isOperator();
}

function loadEnabledPref() {
    try {
        var v = localStorage.getItem(storageKey(STORAGE_ENABLED));
        if (v === 'false') return false;
        if (v === 'true') return true;
    } catch (e) {}
    return true;
}

function loadRevealAllPref() {
    if (!isOperator()) return false;
    try {
        return localStorage.getItem(storageKey(STORAGE_REVEAL_ALL)) === 'true';
    } catch (e) {}
    return false;
}

function saveEnabledPref(on) {
    try { localStorage.setItem(storageKey(STORAGE_ENABLED), on ? 'true' : 'false'); } catch (e) {}
}

function saveRevealAllPref(on) {
    try { localStorage.setItem(storageKey(STORAGE_REVEAL_ALL), on ? 'true' : 'false'); } catch (e) {}
}

export function getFogPrefsForCache() {
    return {
        fogEnabled: _enabled,
        fogRevealAll: _revealAll
    };
}

export function applyCommunityFogPrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') return;
    if (typeof prefs.fogEnabled === 'boolean') {
        _enabled = prefs.fogEnabled;
        saveEnabledPref(_enabled);
    }
    if (typeof prefs.fogRevealAll === 'boolean' && isOperator()) {
        _revealAll = prefs.fogRevealAll;
        saveRevealAllPref(_revealAll);
    }
    syncFogAdminUi();
    refreshFogOfWar();
}

function ensureFogPane() {
    var map = getMap();
    if (!map) return;
    if (!map.getPane('mapFogPane')) {
        map.createPane('mapFogPane');
    }
    var pane = map.getPane('mapFogPane');
    if (pane) {
        pane.style.zIndex = String(FOG_PANE_Z);
        pane.style.pointerEvents = 'none';
    }
}

function ensureCanvas() {
    var map = getMap();
    if (!map) return;
    ensureFogPane();
    var pane = map.getPane('mapFogPane');
    if (!pane) return;

    if (!_canvas) {
        _canvas = document.createElement('canvas');
        _canvas.id = 'map-fog-canvas';
        _canvas.className = 'map-fog-canvas';
        _canvas.setAttribute('aria-hidden', 'true');
        _canvas.style.position = 'absolute';
        _canvas.style.left = '0';
        _canvas.style.top = '0';
        _canvas.style.pointerEvents = 'none';
        /* Místo černé clony odbarvíme mapu pod sebou: šedá výplň + blend "saturation"
           udělá terén černobílý (s měkkými přechody), vypíchnuté kruhy zůstanou barevné. */
        _canvas.style.mixBlendMode = 'saturation';
        pane.appendChild(_canvas);
        _ctx = _canvas.getContext('2d');
    }
}

function latLngToCanvasPoint(lat, lng) {
    var map = getMap();
    if (!map || !window.L) return null;
    var layerPt = map.latLngToLayerPoint(window.L.latLng(lat, lng));
    var origin = map.containerPointToLayerPoint(window.L.point(0, 0));
    return { x: layerPt.x - origin.x, y: layerPt.y - origin.y };
}

function positionFogCanvas() {
    var map = getMap();
    if (!map || !_canvas || !window.L) return null;
    var size = map.getSize();
    if (!size || size.x < 1 || size.y < 1) return null;
    var dpr = window.devicePixelRatio || 1;
    _canvas.width = Math.round(size.x * dpr);
    _canvas.height = Math.round(size.y * dpr);
    _canvas.style.width = size.x + 'px';
    _canvas.style.height = size.y + 'px';
    var topLeft = map.containerPointToLayerPoint(window.L.point(0, 0));
    window.L.DomUtil.setPosition(_canvas, topLeft);
    return size;
}

function metersToPixelRadius(lat, lng, meters) {
    var p0 = latLngToCanvasPoint(lat, lng);
    if (!p0) return 0;
    var cosLat = Math.cos(lat * Math.PI / 180);
    var dLng = meters / (111320 * Math.max(0.2, cosLat));
    var p1 = latLngToCanvasPoint(lat, lng + dLng);
    if (!p1) return 0;
    return Math.max(6, Math.hypot(p1.x - p0.x, p1.y - p0.y));
}

function drawRevealCircle(ctx, lat, lng, radiusM) {
    var center = latLngToCanvasPoint(lat, lng);
    if (!center) return;
    var radiusPx = metersToPixelRadius(lat, lng, radiusM);
    var grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radiusPx);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.92)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.fill();
}

export function refreshFogOfWar() {
    var map = getMap();
    if (!map) return;
    ensureCanvas();
    if (!_canvas || !_ctx) return;

    if (!_enabled || (_revealAll && isOperator())) {
        _canvas.style.display = 'none';
        return;
    }

    var size = positionFogCanvas();
    if (!size) return;

    var dpr = window.devicePixelRatio || 1;
    _canvas.style.display = 'block';

    var ctx = _ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    /* Neutrální šedá (sytost 0) → přes mix-blend-mode: saturation odbarví mapu.
       Alfa = síla filtru: vyšší = méně průhledné (výraznější odbarvení). */
    ctx.fillStyle = 'rgba(128, 128, 128, 0.8)';
    ctx.fillRect(0, 0, size.x, size.y);

    ctx.globalCompositeOperation = 'destination-out';

    var anchors = [];
    if (_deps && typeof _deps.getRevealAnchors === 'function') {
        anchors = _deps.getRevealAnchors() || [];
    }
    var radiusM = FOG_REVEAL_RADIUS_M;
    if (_deps && _deps.revealRadiusM != null) radiusM = _deps.revealRadiusM;

    var i;
    for (i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        if (!a || !isFinite(a.lat) || !isFinite(a.lng)) continue;
        drawRevealCircle(ctx, a.lat, a.lng, radiusM);
    }

    ctx.globalCompositeOperation = 'source-over';
}

function bindMapEvents() {
    if (_bound) return;
    var map = getMap();
    if (!map) return;
    _bound = true;
    map.on('move zoom zoomend moveend resize viewreset load', refreshFogOfWar);
}

export function setFogEnabled(on) {
    _enabled = on !== false;
    saveEnabledPref(_enabled);
    syncFogAdminUi();
    refreshFogOfWar();
}

export function setFogRevealAll(on) {
    if (!isOperator()) return;
    _revealAll = !!on;
    saveRevealAllPref(_revealAll);
    syncFogAdminUi();
    refreshFogOfWar();
}

export function isFogEnabled() {
    return _enabled;
}

export function isFogRevealAll() {
    return _revealAll && isOperator();
}

function syncFogAdminUi() {
    if (!FOG_ADMIN_UI_ENABLED) return;
    var enabledEl = document.getElementById('map-fog-enabled');
    var revealAllEl = document.getElementById('map-fog-reveal-all');
    var controls = document.getElementById('map-fog-admin-controls');
    if (controls) {
        controls.style.display = (FOG_ADMIN_UI_ENABLED && isOperator()) ? 'block' : 'none';
    }
    if (enabledEl) enabledEl.checked = _enabled;
    if (revealAllEl) revealAllEl.checked = _revealAll;
    if (typeof window.updateAdminFogButtonUi === 'function') window.updateAdminFogButtonUi();
}

export function syncFogAdminControls() {
    syncFogAdminUi();
}

export function initFogOfWar(deps) {
    _deps = deps;
    _enabled = loadEnabledPref();
    _revealAll = loadRevealAllPref();
    ensureCanvas();
    bindMapEvents();
    syncFogAdminUi();
    requestAnimationFrame(function() {
        refreshFogOfWar();
        setTimeout(refreshFogOfWar, 200);
    });
}
