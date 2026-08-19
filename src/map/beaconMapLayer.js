/**
 * Mapová vrstva — radarový beacon (vlastní i cizí).
 */
var _map = null;
var _layer = null;
var _markers = {};
var _rings = {};
var _pendingRefresh = false;
var _pendingPanLocal = false;

var RING_METERS = [100, 280, 600];

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
        html: '<div class="map-beacon-pin' + (isLocal ? ' is-local' : ' is-remote') + '">' +
            '<span class="map-beacon-wave"></span>' +
            '<span class="map-beacon-wave map-beacon-wave-2"></span>' +
            '<span class="map-beacon-wave map-beacon-wave-3"></span>' +
            '<span class="map-beacon-core"></span>' +
            '<span class="map-beacon-emoji">📡</span>' +
            '</div>',
        iconSize: [96, 96],
        iconAnchor: [48, 78]
    });
}

function panToBeaconList(list, preferLocal) {
    if (!_map || !list || !list.length) return;
    var target = null;
    var i;
    if (preferLocal) {
        for (i = 0; i < list.length; i++) {
            if (list[i] && (list[i].isLocal || String(list[i].id || '').indexOf('local_') === 0)) {
                target = list[i];
                break;
            }
        }
    }
    if (!target) target = list[0];
    if (!target || !isFinite(Number(target.lat)) || !isFinite(Number(target.lng))) return;
    try {
        _map.setView([Number(target.lat), Number(target.lng)], Math.max(_map.getZoom() || 14, 15), { animate: true });
    } catch (e) {}
}

function upsertRings(id, lat, lng, isLocal) {
    var color = isLocal ? '#ffcc33' : '#ff5533';
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
            opacity: 0.95 - r * 0.2,
            fillColor: color,
            fillOpacity: 0.1,
            interactive: false
        });
        circle.addTo(_layer);
        group.push(circle);
    }
    _rings[id] = group;
}

function collectBeaconList() {
    var list = [];
    var seen = {};
    if (window._patracLocalBeacon &&
        isFinite(Number(window._patracLocalBeacon.lat)) &&
        isFinite(Number(window._patracLocalBeacon.lng))) {
        list.push(window._patracLocalBeacon);
        seen[window._patracLocalBeacon.id] = true;
    }
    var fromRadio = [];
    if (typeof window.patracGetMapBeacons === 'function') {
        try { fromRadio = window.patracGetMapBeacons() || []; } catch (e) {}
    }
    var i;
    for (i = 0; i < fromRadio.length; i++) {
        var b = fromRadio[i];
        if (!b || !b.id || seen[b.id]) continue;
        if (!isFinite(Number(b.lat)) || !isFinite(Number(b.lng))) continue;
        seen[b.id] = true;
        list.push(b);
    }
    return list;
}

export function initBeaconMapLayer(map) {
    _map = map || null;
    if (!_map || !window.L) return;
    if (!_layer) {
        _layer = window.L.layerGroup();
        _layer.addTo(_map);
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
    if (!_layer) {
        _layer = window.L.layerGroup();
        _layer.addTo(_map);
    }
    var list = collectBeaconList();
    var seen = {};
    var i;
    for (i = 0; i < list.length; i++) {
        var b = list[i];
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
            zIndexOffset: 3000
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
    clearMarkers();
    if (_layer && _map) {
        try { _map.removeLayer(_layer); } catch (e) {}
    }
    _layer = null;
    _map = null;
    _pendingRefresh = false;
    _pendingPanLocal = false;
}
