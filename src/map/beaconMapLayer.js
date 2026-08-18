/**
 * Mapová vrstva — blikající beacon(y) komunity.
 */
var _map = null;
var _layer = null;
var _markers = {};
var _blinkOn = true;
var _blinkTimer = null;
var _pendingRefresh = false;
var _pendingPanLocal = false;

function clearMarkers() {
    if (!_layer) {
        _markers = {};
        return;
    }
    for (var id in _markers) {
        if (!Object.prototype.hasOwnProperty.call(_markers, id)) continue;
        try { _layer.removeLayer(_markers[id]); } catch (e) {}
    }
    _markers = {};
}

function beaconIcon(active) {
    var opacity = active ? 1 : 0.35;
    return window.L.divIcon({
        className: 'map-beacon-marker-wrap',
        html: '<div class="map-beacon-marker' + (active ? ' is-blink' : '') + '" style="opacity:' + opacity + '">📡</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

function panToBeaconList(list, preferLocal) {
    if (!_map || !list || !list.length) return;
    var target = null;
    var i;
    if (preferLocal) {
        for (i = 0; i < list.length; i++) {
            if (list[i] && String(list[i].id || '').indexOf('local_') === 0) {
                target = list[i];
                break;
            }
        }
    }
    if (!target) target = list[0];
    if (!target || !isFinite(target.lat) || !isFinite(target.lng)) return;
    try {
        _map.setView([target.lat, target.lng], Math.max(_map.getZoom() || 14, 14), { animate: true });
    } catch (e) {}
}

export function initBeaconMapLayer(map) {
    _map = map || null;
    if (!_map || !window.L) return;
    if (!_layer) {
        _layer = window.L.layerGroup();
        _layer.addTo(_map);
    }
    if (!_blinkTimer) {
        _blinkTimer = setInterval(function() {
            _blinkOn = !_blinkOn;
            for (var id in _markers) {
                if (!Object.prototype.hasOwnProperty.call(_markers, id)) continue;
                var el = _markers[id].getElement && _markers[id].getElement();
                if (!el) continue;
                var dot = el.querySelector('.map-beacon-marker');
                if (dot) dot.style.opacity = _blinkOn ? '1' : '0.35';
            }
        }, 700);
    }
    if (_pendingRefresh) {
        _pendingRefresh = false;
        refreshBeaconMapLayer(_pendingPanLocal);
        _pendingPanLocal = false;
    } else {
        refreshBeaconMapLayer(false);
    }
}

export function refreshBeaconMapLayer(panToLocal) {
    if (!_map || !_layer || !window.L) {
        _pendingRefresh = true;
        if (panToLocal) _pendingPanLocal = true;
        return;
    }
    var list = [];
    if (typeof window.patracGetMapBeacons === 'function') {
        try { list = window.patracGetMapBeacons() || []; } catch (e) {}
    }
    var seen = {};
    var i;
    for (i = 0; i < list.length; i++) {
        var b = list[i];
        if (!b || !b.id || !isFinite(b.lat) || !isFinite(b.lng)) continue;
        seen[b.id] = true;
        if (_markers[b.id]) {
            _markers[b.id].setLatLng([b.lat, b.lng]);
            continue;
        }
        var marker = window.L.marker([b.lat, b.lng], {
            icon: beaconIcon(true),
            interactive: true,
            keyboard: false,
            zIndexOffset: 1200
        });
        var label = b.label || 'BEACON';
        var freq = b.frequency ? (' · ' + b.frequency + ' MHz') : '';
        marker.bindPopup('<b>📡 ' + label + '</b>' + freq);
        marker.addTo(_layer);
        _markers[b.id] = marker;
    }
    for (var mid in _markers) {
        if (!Object.prototype.hasOwnProperty.call(_markers, mid)) continue;
        if (!seen[mid]) {
            try { _layer.removeLayer(_markers[mid]); } catch (e2) {}
            delete _markers[mid];
        }
    }
    if (panToLocal && list.length) panToBeaconList(list, true);
}

export function destroyBeaconMapLayer() {
    if (_blinkTimer) {
        clearInterval(_blinkTimer);
        _blinkTimer = null;
    }
    clearMarkers();
    if (_layer && _map) {
        try { _map.removeLayer(_layer); } catch (e) {}
    }
    _layer = null;
    _map = null;
    _pendingRefresh = false;
    _pendingPanLocal = false;
}
