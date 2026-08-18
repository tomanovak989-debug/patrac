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

function bandStyle(bandIndex, role) {
    /* 0 = clear, 1 = weak, 2 = fragment, 3 = noise */
    var isBase = role === 'base';
    var isReceiver = role === 'receiver';
    var weights = [2.4, 1.8, 1.4, 1.0];
    var opacities = [0.85, 0.55, 0.38, 0.22];
    var fills = [0.06, 0.035, 0.02, 0.008];
    var color = isReceiver ? '#33aaff' : (isBase ? '#ff3355' : '#ff0033');
    var roleScale = isBase ? 0.7 : (isReceiver ? 0.85 : 1);
    return {
        color: color,
        weight: weights[bandIndex] || 1,
        opacity: (opacities[bandIndex] || 0.25) * roleScale,
        fillColor: color,
        fillOpacity: (fills[bandIndex] || 0) * roleScale,
        dashArray: isBase ? '6 6' : (isReceiver ? '4 8' : null),
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
        var radii = [bands.clear, bands.weak, bands.fragment, bands.noise];
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
