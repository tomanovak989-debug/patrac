/**
 * Mapová vrstva — radarový beacon (vlastní i cizí).
 */
var _map = null;
var _layer = null;
var _markers = {};
var _rings = {};
var _blinkOn = true;
var _blinkTimer = null;
var _pendingRefresh = false;
var _pendingPanLocal = false;

var RING_METERS = [180, 480, 1100];

function ensureBeaconPane(mapObj) {
    if (!mapObj || !mapObj.createPane) return;
    if (!mapObj.getPane('beaconPane')) {
        mapObj.createPane('beaconPane');
        var pane = mapObj.getPane('beaconPane');
        pane.style.zIndex = 850;
        pane.style.pointerEvents = 'auto';
    }
}

function clearMarkers() {
    var id;
    for (id in _markers) {
        if (!Object.prototype.hasOwnProperty.call(_markers, id)) continue;
        try { _layer && _layer.removeLayer(_markers[id]); } catch (e) {}
    }
    _markers = {};
    for (id in _rings) {
        if (!Object.prototype.hasOwnProperty.call(_rings, id)) continue;
        removeRings(id);
    }
    _rings = {};
}

function removeRings(id) {
    var group = _rings[id];
    if (!group || !_layer) return;
    var i;
    for (i = 0; i < group.length; i++) {
        try { _layer.removeLayer(group[i]); } catch (e) {}
    }
    delete _rings[id];
}

function beaconIcon(isLocal) {
    return window.L.divIcon({
        className: 'map-beacon-marker-wrap',
        html: '<div class="map-beacon-pin' + (isLocal ? ' is-local' : '') + '">' +
            '<span class="map-beacon-radar"></span>' +
            '<span class="map-beacon-radar map-beacon-radar-delay"></span>' +
            '<span class="map-beacon-emoji">📡</span>' +
            '</div>',
        iconSize: [72, 72],
        iconAnchor: [36, 66]
    });
}

function panToBeaconList(list, preferLocal) {
    if (!_map || !list || !list.length) return;
    var target = null;
    var i;
    if (preferLocal) {
        for (i = 0; i < list.length; i++) {
            if (list[i] && list[i].isLocal) {
                target = list[i];
                break;
            }
            if (list[i] && String(list[i].id || '').indexOf('local_') === 0) {
                target = list[i];
                break;
            }
        }
    }
    if (!target) target = list[0];
    if (!target || !isFinite(target.lat) || !isFinite(target.lng)) return;
    try {
        _map.setView([target.lat, target.lng], Math.max(_map.getZoom() || 14, 15), { animate: true });
    } catch (e) {}
}

function upsertRings(id, lat, lng, isLocal) {
    var color = isLocal ? '#ff9a1a' : '#ff4d2a';
    if (_rings[id] && _rings[id].length) {
        var j;
        for (j = 0; j < _rings[id].length; j++) {
            try { _rings[id][j].setLatLng([lat, lng]); } catch (e) {}
        }
        return;
    }
    var group = [];
    var r;
    for (r = 0; r < RING_METERS.length; r++) {
        var circle = window.L.circle([lat, lng], {
            radius: RING_METERS[r],
            color: color,
            weight: r === 0 ? 3 : 2,
            opacity: 0.85 - r * 0.18,
            fillColor: color,
            fillOpacity: 0.07,
            pane: 'beaconPane',
            interactive: false
        });
        circle.addTo(_layer);
        group.push(circle);
    }
    _rings[id] = group;
}

export function initBeaconMapLayer(map) {
    _map = map || null;
    if (!_map || !window.L) return;
    ensureBeaconPane(_map);
    if (!_layer) {
        _layer = window.L.layerGroup();
        _layer.addTo(_map);
    }
    if (!_blinkTimer) {
        _blinkTimer = setInterval(function() {
            _blinkOn = !_blinkOn;
            var id;
            for (id in _markers) {
                if (!Object.prototype.hasOwnProperty.call(_markers, id)) continue;
                var el = _markers[id].getElement && _markers[id].getElement();
                if (!el) continue;
                var emoji = el.querySelector('.map-beacon-emoji');
                if (emoji) emoji.style.opacity = _blinkOn ? '1' : '0.45';
            }
            for (id in _rings) {
                if (!Object.prototype.hasOwnProperty.call(_rings, id)) continue;
                var group = _rings[id] || [];
                var i;
                for (i = 0; i < group.length; i++) {
                    try {
                        group[i].setStyle({
                            opacity: _blinkOn ? (0.9 - i * 0.2) : (0.35 - i * 0.08)
                        });
                    } catch (e2) {}
                }
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
    if (!_map || !window.L) {
        _pendingRefresh = true;
        if (panToLocal) _pendingPanLocal = true;
        return;
    }
    ensureBeaconPane(_map);
    if (!_layer) {
        _layer = window.L.layerGroup();
        _layer.addTo(_map);
    }
    var list = [];
    if (typeof window.patracGetMapBeacons === 'function') {
        try { list = window.patracGetMapBeacons() || []; } catch (e) {}
    }
    var seen = {};
    var i;
    for (i = 0; i < list.length; i++) {
        var b = list[i];
        if (!b || !b.id || !isFinite(Number(b.lat)) || !isFinite(Number(b.lng))) continue;
        var lat = Number(b.lat);
        var lng = Number(b.lng);
        var isLocal = !!b.isLocal || String(b.id).indexOf('local_') === 0;
        seen[b.id] = true;
        upsertRings(b.id, lat, lng, isLocal);
        if (_markers[b.id]) {
            _markers[b.id].setLatLng([lat, lng]);
            continue;
        }
        var marker = window.L.marker([lat, lng], {
            icon: beaconIcon(isLocal),
            interactive: true,
            keyboard: false,
            pane: 'beaconPane',
            zIndexOffset: 1600
        });
        var label = b.label || (isLocal ? 'Můj beacon' : 'BEACON');
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
            removeRings(mid);
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
