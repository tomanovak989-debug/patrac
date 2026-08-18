/**
 * Mapová vrstva rádiového dosahu — kruhy 5 / 7.5 / 10 / 12.5 km (bez výplně).
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

/** Na mapě vždy základní matice — simulace signálu používá výšku zvlášť. */
function rangeBandsForMapDisplay() {
    return {
        clear: RANGE_KM.CLEAR_MAX,
        weak: RANGE_KM.WEAK_MAX,
        fragment: RANGE_KM.FRAGMENT_MAX,
        noise: RANGE_KM.NOISE_MAX
    };
}

function bandStyle(bandIndex, role) {
    var isReceiver = role === 'receiver';
    var isBase = role === 'base';
    var weights = [2.4, 1.8, 1.4, 1.0];
    var opacities = [0.85, 0.55, 0.38, 0.22];
    var color = isReceiver ? '#ff8800' : (isBase ? '#ff5566' : '#33aaff');
    var roleScale = isBase ? 0.7 : (isReceiver ? 0.85 : 1);
    return {
        color: color,
        weight: weights[bandIndex] || 1,
        opacity: (opacities[bandIndex] || 0.25) * roleScale,
        fillOpacity: 0,
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

export function refreshRadioRangeLayer() {
    if (!_map || !_layer || !window.L) return;
    clearCircles();
    if (!_visible) return;

    var entries = nodesForRangeDisplay(_deps);
    var bands = rangeBandsForMapDisplay();
    var radii = [bands.clear, bands.weak, bands.fragment, bands.noise];

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
