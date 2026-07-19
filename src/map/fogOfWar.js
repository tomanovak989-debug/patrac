/**
 * Mlha války — mapa zahalená, odkrývá se kruhy 300 m kolem trvalých bodů / poct / POI.
 * Ovládání jen pro operátora (admin); hráčům běží automaticky.
 */

/** Před ostrým startem nechat true; pro launch nastavit false (zůstane jen logika bez UI). */
export var FOG_ADMIN_UI_ENABLED = true;

export var FOG_REVEAL_RADIUS_M = 300;

var _deps = null;
var _map = null;
var _canvas = null;
var _ctx = null;
var _bound = false;
var _enabled = true;
var _revealAll = false;

var STORAGE_ENABLED = 'patrac_fog_enabled';
var STORAGE_REVEAL_ALL = 'patrac_fog_reveal_all';

function getMap() {
    return _deps && _deps.getMap ? _deps.getMap() : null;
}

function isOperator() {
    return _deps && typeof _deps.isOperator === 'function' && _deps.isOperator();
}

function loadEnabledPref() {
    try {
        var v = localStorage.getItem(STORAGE_ENABLED);
        if (v === 'false') return false;
        if (v === 'true') return true;
    } catch (e) {}
    return true;
}

function loadRevealAllPref() {
    if (!isOperator()) return false;
    try {
        return localStorage.getItem(STORAGE_REVEAL_ALL) === 'true';
    } catch (e) {}
    return false;
}

function saveEnabledPref(on) {
    try { localStorage.setItem(STORAGE_ENABLED, on ? 'true' : 'false'); } catch (e) {}
}

function saveRevealAllPref(on) {
    try { localStorage.setItem(STORAGE_REVEAL_ALL, on ? 'true' : 'false'); } catch (e) {}
}

function ensureFogPane() {
    var map = getMap();
    if (!map) return;
    if (!map.getPane('mapFogPane')) {
        map.createPane('mapFogPane');
        map.getPane('mapFogPane').style.zIndex = '650';
        map.getPane('mapFogPane').style.pointerEvents = 'none';
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
        _canvas.setAttribute('aria-hidden', 'true');
        _canvas.style.position = 'absolute';
        _canvas.style.left = '0';
        _canvas.style.top = '0';
        _canvas.style.width = '100%';
        _canvas.style.height = '100%';
        _canvas.style.pointerEvents = 'none';
        pane.appendChild(_canvas);
        _ctx = _canvas.getContext('2d');
    }
}

function metersToPixelRadius(lat, lng, meters) {
    var map = getMap();
    if (!map) return 0;
    var center = map.latLngToContainerPoint([lat, lng]);
    var cosLat = Math.cos(lat * Math.PI / 180);
    var dLng = meters / (111320 * Math.max(0.2, cosLat));
    var edge = map.latLngToContainerPoint([lat, lng + dLng]);
    return Math.max(4, Math.hypot(edge.x - center.x, edge.y - center.y));
}

function drawRevealCircle(ctx, lat, lng, radiusM) {
    var map = getMap();
    if (!map) return;
    var center = map.latLngToContainerPoint([lat, lng]);
    var radiusPx = metersToPixelRadius(lat, lng, radiusM);
    var grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radiusPx);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.72, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.fill();
}

export function refreshFogOfWar() {
    var map = getMap();
    if (!map || !_canvas || !_ctx) return;

    if (!_enabled || (_revealAll && isOperator())) {
        _canvas.style.display = 'none';
        return;
    }

    var size = map.getSize();
    if (!size || size.x < 1 || size.y < 1) return;

    var dpr = window.devicePixelRatio || 1;
    _canvas.width = Math.round(size.x * dpr);
    _canvas.height = Math.round(size.y * dpr);
    _canvas.style.display = 'block';

    var ctx = _ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    ctx.fillStyle = 'rgba(4, 6, 4, 0.92)';
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
    map.on('move zoom zoomend moveend resize viewreset', refreshFogOfWar);
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
}

export function syncFogAdminControls() {
    syncFogAdminUi();
}

export function initFogOfWar(deps) {
    _deps = deps;
    _map = getMap();
    _enabled = loadEnabledPref();
    _revealAll = loadRevealAllPref();
    ensureCanvas();
    bindMapEvents();
    syncFogAdminUi();
    refreshFogOfWar();
}
