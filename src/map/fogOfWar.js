/**
 * Mlha války — mapa zahalená, odkrývá se kruhy 500 m kolem trvalých bodů / POI / GPS.
 * Vrstva uvnitř Leaflet (pod body a MGRS mřížkou).
 */

/** Před ostrým startem nechat true; pro launch nastavit false (zůstane jen logika bez UI). */
export var FOG_ADMIN_UI_ENABLED = true;

export var FOG_REVEAL_RADIUS_M = 500;

var FOG_PANE_Z = 450;

var _deps = null;
var _overlay = null;
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

function ensureOverlay() {
    var map = getMap();
    if (!map) return;
    ensureFogPane();
    var pane = map.getPane('mapFogPane');
    if (!pane) return;

    if (!_overlay) {
        _overlay = document.createElement('div');
        _overlay.id = 'map-fog-gray';
        _overlay.className = 'map-fog-gray';
        _overlay.setAttribute('aria-hidden', 'true');
        _overlay.style.position = 'absolute';
        _overlay.style.left = '0';
        _overlay.style.top = '0';
        _overlay.style.pointerEvents = 'none';
        /* Mapu pod fogem uděláme skutečně černobílou (detailní jako ČB fotka),
           osvětlené kruhy vyřízneme přes clip-path → zůstanou barevné. */
        _overlay.style.webkitBackdropFilter = 'grayscale(1)';
        _overlay.style.backdropFilter = 'grayscale(1)';
        pane.appendChild(_overlay);
    }
}

function latLngToCanvasPoint(lat, lng) {
    var map = getMap();
    if (!map || !window.L) return null;
    var layerPt = map.latLngToLayerPoint(window.L.latLng(lat, lng));
    var origin = map.containerPointToLayerPoint(window.L.point(0, 0));
    return { x: layerPt.x - origin.x, y: layerPt.y - origin.y };
}

function positionOverlay() {
    var map = getMap();
    if (!map || !_overlay || !window.L) return null;
    var size = map.getSize();
    if (!size || size.x < 1 || size.y < 1) return null;
    _overlay.style.width = size.x + 'px';
    _overlay.style.height = size.y + 'px';
    var topLeft = map.containerPointToLayerPoint(window.L.point(0, 0));
    window.L.DomUtil.setPosition(_overlay, topLeft);
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

function buildRevealClipPath(size, anchors, radiusM) {
    var w = size.x;
    var h = size.y;
    /* Vnější obdélník = zamlžená plocha; kruhy = díry (evenodd) → tam se ČB filtr neuplatní. */
    var d = 'M0 0 H' + w + ' V' + h + ' H0 Z';
    for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        if (!a || !isFinite(a.lat) || !isFinite(a.lng)) continue;
        var c = latLngToCanvasPoint(a.lat, a.lng);
        if (!c) continue;
        var r = metersToPixelRadius(a.lat, a.lng, radiusM);
        var cx = c.x.toFixed(1);
        var cy = c.y.toFixed(1);
        var rr = r.toFixed(1);
        var d2 = (r * 2).toFixed(1);
        d += ' M' + (c.x - r).toFixed(1) + ' ' + cy +
             ' a' + rr + ' ' + rr + ' 0 1 0 ' + d2 + ' 0' +
             ' a' + rr + ' ' + rr + ' 0 1 0 -' + d2 + ' 0 Z';
    }
    return d;
}

export function refreshFogOfWar() {
    var map = getMap();
    if (!map) return;
    ensureOverlay();
    if (!_overlay) return;

    if (!_enabled || (_revealAll && isOperator())) {
        _overlay.style.display = 'none';
        return;
    }

    var size = positionOverlay();
    if (!size) return;
    _overlay.style.display = 'block';

    var anchors = [];
    if (_deps && typeof _deps.getRevealAnchors === 'function') {
        anchors = _deps.getRevealAnchors() || [];
    }
    var radiusM = FOG_REVEAL_RADIUS_M;
    if (_deps && _deps.revealRadiusM != null) radiusM = _deps.revealRadiusM;

    var d = buildRevealClipPath(size, anchors, radiusM);
    var cp = 'path(evenodd, "' + d + '")';
    _overlay.style.webkitClipPath = cp;
    _overlay.style.clipPath = cp;
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
    ensureOverlay();
    bindMapEvents();
    syncFogAdminUi();
    requestAnimationFrame(function() {
        refreshFogOfWar();
        setTimeout(refreshFogOfWar, 200);
    });
}
