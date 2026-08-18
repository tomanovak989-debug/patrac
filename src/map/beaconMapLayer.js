/**
 * Mapová vrstva — blikající beacon(y) komunity.
 */
var _map = null;
var _layer = null;
var _markers = {};
var _blinkOn = true;
var _blinkTimer = null;

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

export function initBeaconMapLayer(map) {
    _map = map || null;
    if (!_map || !window.L) return;
    if (!_layer) _layer = window.L.layerGroup().addTo(_map);
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
    refreshBeaconMapLayer();
}

export function refreshBeaconMapLayer() {
    if (!_map || !_layer || !window.L) return;
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
            keyboard: false
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
}
