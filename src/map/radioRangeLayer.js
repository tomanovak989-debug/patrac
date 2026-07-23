/**
 * Mapová vrstva rádiového dosahu — kruhy 5 / 15 / 50 km.
 */
import { RANGE_KM } from '../radio/radioPropagation.js';
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

function bandStyle(bandIndex, role) {
    /* 0 = 5 km, 1 = 15 km, 2 = 50 km */
    var isBase = role === 'base';
    var weights = [2.4, 1.6, 1.1];
    var opacities = [0.85, 0.5, 0.28];
    var fills = [0.06, 0.03, 0.01];
    var color = isBase ? '#ff3355' : '#ff0033';
    return {
        color: color,
        weight: weights[bandIndex] || 1,
        opacity: (opacities[bandIndex] || 0.25) * (isBase ? 0.7 : 1),
        fillColor: color,
        fillOpacity: (fills[bandIndex] || 0) * (isBase ? 0.5 : 1),
        dashArray: isBase ? '6 6' : null,
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

export function refreshRadioRangeLayer() {
    if (!_map || !_layer || !window.L) return;
    clearCircles();
    if (!_visible) return;

    var entries = nodesForRangeDisplay(_deps);
    var radii = [RANGE_KM.CLEAR_MAX, RANGE_KM.WEAK_MAX, RANGE_KM.NOISE_MAX];
    for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        var node = entry && entry.node;
        if (!node || !isFinite(node.lat) || !isFinite(node.lng)) continue;
        for (var b = radii.length - 1; b >= 0; b--) {
            var circle = window.L.circle([node.lat, node.lng], Object.assign({
                radius: radii[b] * 1000
            }, bandStyle(b, entry.role)));
            circle.addTo(_layer);
            _circles.push(circle);
        }
    }
}

export function updateRadioRangeDeps(deps) {
    _deps = Object.assign({}, _deps || {}, deps || {});
    refreshRadioRangeLayer();
}
