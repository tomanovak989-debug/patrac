/**
 * Mapová vrstva — radarový beacon (vlastní i cizí).
 * Lokální maják musí být vidět i bez cloud TX.
 */
var _map = null;
var _layer = null;
var _markers = {};
var _rings = {};
var _pendingRefresh = false;
var _pendingPanLocal = false;

var RING_METERS = [120, 320, 700];

function ensureBeaconPane(mapObj) {
    if (!mapObj || !mapObj.createPane) return 'markerPane';
    if (!mapObj.getPane('beaconPane')) {
        mapObj.createPane('beaconPane');
        var pane = mapObj.getPane('beaconPane');
        pane.style.zIndex = 900;
        pane.style.pointerEvents = 'none';
    }
    return 'beaconPane';
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
        className: 'map-beacon-marker-wrap leaflet-interactive',
        html: '<div class="map-beacon-pin' + (isLocal ? ' is-local' : ' is-remote') + '" aria-hidden="true">' +
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

function upsertRings(id, lat, lng, isLocal, paneName) {
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
            opacity: 0.9 - r * 0.2,
            fillColor: color,
            fillOpacity: 0.08,
            pane: paneName || 'overlayPane',
            interactive: false,
            className: 'map-beacon-ring'
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
    var paneName = ensureBeaconPane(_map);
    if (!_layer) {
        _layer = window.L.layerGroup();
        _layer.addTo(_map);
    }
    var list = [];
    if (typeof window.patracGetMapBeacons === 'function') {
        try { list = window.patracGetMapBeacons() || []; } catch (e) {
            console.warn('[beaconMap] get beacons', e);
        }
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
        upsertRings(b.id, lat, lng, isLocal, paneName);
        if (_markers[b.id]) {
            _markers[b.id].setLatLng([lat, lng]);
            try { _markers[b.id].setZIndexOffset(2500); } catch (e2) {}
            continue;
        }
        var marker = window.L.marker([lat, lng], {
            icon: beaconIcon(isLocal),
            interactive: true,
            keyboard: false,
            pane: paneName,
            zIndexOffset: 2500,
            riseOnHover: true
        });
        var label = b.label || (isLocal ? 'Můj beacon' : 'BEACON');
        var freq = b.frequency ? (' · ' + b.frequency + ' MHz') : '';
        marker.bindPopup('<b>📡 ' + label + '</b>' + freq + (isLocal ? '<br>Lokální maják' : ''));
        marker.addTo(_layer);
        _markers[b.id] = marker;
    }
    for (var mid in _markers) {
        if (!Object.prototype.hasOwnProperty.call(_markers, mid)) continue;
        if (!seen[mid]) {
            try { _layer.removeLayer(_markers[mid]); } catch (e3) {}
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
