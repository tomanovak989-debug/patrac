/**
 * Mapová vrstva rádiového dosahu — kruhy 5 / 7.5 / 10 / 12.5 km (+ bonus výšky).
 */
import { rangeBandsForElevation } from '../radio/radioPropagation.js';
import { nodesForRangeDisplay } from '../radio/radioNodes.js';

var STORAGE_VISIBLE = 'patrac_radio_range_visible';

var _map = null;
var _layer = null;
var _visible = true;
var _deps = null;
var _circles = [];

function loadVisible() {
    try {
        var v = localStorage.getItem(STORAGE_VISIBLE);
        if (v === 'false') return false;
        if (v === 'true') return true;
    } catch (e) {}
    return true;
}

function saveVisible(on) {
    try { localStorage.setItem(STORAGE_VISIBLE, on ? 'true' : 'false'); } catch (e) {}
}

function clearCircles() {
    if (!_layer) {
        _circles = [];
        return;
    }
    for (var i = 0; i < _circles.length; i++) {
        try { _layer.removeLayer(_circles[i]); } catch (e) {}
    }
    _circles = [];
}

function bandStyle(role) {
    var isReceiver = role === 'receiver';
    var isBase = role === 'base';
    /* active = vlastní poloha (GPS / nosič), receiver = oranžová, útočiště = červená tečkovaná */
    var color = isReceiver ? '#ff8800' : (isBase ? '#ff5566' : '#33aaff');
    return {
        color: color,
        weight: isReceiver ? 2 : (isBase ? 1.6 : 2.2),
        opacity: isBase ? 0.55 : 0.85,
        fillOpacity: 0,
        dashArray: isBase ? '8 6' : (isReceiver ? '6 4' : null),
        interactive: false
    };
}

export function initRadioRangeLayer(map, deps) {
    _map = map || null;
    _deps = deps || {};
    _visible = loadVisible();
    if (!_map || !window.L) return;
    if (!_layer) _layer = window.L.layerGroup();
    if (_visible) _layer.addTo(_map);
    syncCheckbox();
    refreshRadioRangeLayer();
}

export function setRadioRangeVisible(on) {
    _visible = !!on;
    saveVisible(_visible);
    if (!_map || !_layer) {
        syncCheckbox();
        return;
    }
    if (_visible) {
        if (!_map.hasLayer(_layer)) _layer.addTo(_map);
        refreshRadioRangeLayer();
    } else {
        clearCircles();
        if (_map.hasLayer(_layer)) _map.removeLayer(_layer);
    }
    syncCheckbox();
}

export function isRadioRangeVisible() {
    return _visible;
}

export function syncCheckbox() {
    var cb = document.getElementById('map-filter-radio-range');
    if (cb) cb.checked = !!_visible;
}

function nodeElevationM(node) {
    if (!node) return 0;
    if (node.elevationM != null && isFinite(node.elevationM)) return node.elevationM;
    if (typeof window.patracGetCachedElevationM === 'function') {
        var cached = window.patracGetCachedElevationM(node.lat, node.lng);
        if (cached != null) return cached;
    }
    return 0;
}

export function refreshRadioRangeLayer() {
    if (!_map || !_layer || !window.L) return;
    clearCircles();
    if (!_visible) return;

    var entries = nodesForRangeDisplay(_deps);
    for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        var node = entry && entry.node;
        if (!node || !isFinite(node.lat) || !isFinite(node.lng)) continue;
        var bands = rangeBandsForElevation(nodeElevationM(node));
        var maxKm = bands.noise;
        if (!isFinite(maxKm) || maxKm <= 0) continue;
        var circle = window.L.circle([node.lat, node.lng], Object.assign({
            radius: maxKm * 1000
        }, bandStyle(entry.role)));
        circle.addTo(_layer);
        _circles.push(circle);
    }
}

export function updateRadioRangeDeps(deps) {
    _deps = Object.assign({}, _deps || {}, deps || {});
    refreshRadioRangeLayer();
}
