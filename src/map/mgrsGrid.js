/**
 * UTM / MGRS kilometrová mřížka (1 km) pro použití s topografickým pravítkem.
 */

var _map = null;
var _layer = null;
var _visible = true;
var _bound = false;
var _GREEN = 'rgba(74,246,38,0.42)';
var _GREEN_BOLD = 'rgba(74,246,38,0.72)';

var STORAGE_KEY = 'patrac_mgrs_grid_visible';

function loadVisiblePref() {
    try {
        var v = localStorage.getItem(STORAGE_KEY);
        if (v === 'false') return false;
        if (v === 'true') return true;
    } catch (e) {}
    return true;
}

function saveVisiblePref(on) {
    try {
        localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    } catch (e) {}
}

/** WGS84 → UTM (easting, northing, zone, northern). */
export function latLngToUtm(lat, lng) {
    var a = 6378137;
    var f = 1 / 298.257223563;
    var k0 = 0.9996;
    var zone = Math.floor((lng + 180) / 6) + 1;
    var lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    var latRad = lat * Math.PI / 180;
    var lonRad = lng * Math.PI / 180;
    var e2 = 2 * f - f * f;
    var ep2 = e2 / (1 - e2);
    var n = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    var t = Math.tan(latRad) * Math.tan(latRad);
    var c = ep2 * Math.cos(latRad) * Math.cos(latRad);
    var aa = Math.cos(latRad) * (lonRad - lon0);
    var m = a * (
        (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latRad
        - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latRad)
        + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latRad)
        - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latRad)
    );
    var easting = k0 * n * (
        aa + (1 - t + c) * aa * aa * aa / 6
        + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * aa * aa * aa * aa * aa / 120
    ) + 500000;
    var northing = k0 * (
        m + n * Math.tan(latRad) * (
            aa * aa / 2
            + (5 - t + 9 * c + 4 * c * c) * aa * aa * aa * aa / 24
            + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * aa * aa * aa * aa * aa * aa / 720
        )
    );
    var northern = lat >= 0;
    if (!northern) northing += 10000000;
    return { easting: easting, northing: northing, zone: zone, northern: northern };
}

/** UTM → WGS84. */
export function utmToLatLng(easting, northing, zone, northern) {
    var a = 6378137;
    var f = 1 / 298.257223563;
    var k0 = 0.9996;
    var e2 = 2 * f - f * f;
    var ep2 = e2 / (1 - e2);
    var x = easting - 500000;
    var y = northern ? northing : northing - 10000000;
    var lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    var m = y / k0;
    var mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
    var e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    var phi1 = mu
        + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
        + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);
    var n1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
    var t1 = Math.tan(phi1) * Math.tan(phi1);
    var c1 = ep2 * Math.cos(phi1) * Math.cos(phi1);
    var r1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
    var d = x / (n1 * k0);
    var lat = phi1 - (n1 * Math.tan(phi1) / r1) * (
        d * d / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d * d * d * d / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d * d * d * d * d * d / 720
    );
    var lng = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d * d * d / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d * d * d * d * d / 120
    ) / Math.cos(phi1);
    return { lat: lat * 180 / Math.PI, lng: lng * 180 / Math.PI };
}

function pad3(n) {
    var s = String(Math.round(n));
    while (s.length < 3) s = '0' + s;
    return s.slice(-3);
}

function clearLayer() {
    if (!_layer) return;
    _layer.clearLayers();
}

function drawGrid() {
    if (!_map || !_layer || !_visible) {
        clearLayer();
        return;
    }
    clearLayer();
    var zoom = _map.getZoom();
    if (zoom < 11) return;

    var bounds = _map.getBounds().pad(0.08);
    var sw = latLngToUtm(bounds.getSouth(), bounds.getWest());
    var ne = latLngToUtm(bounds.getNorth(), bounds.getEast());
    var zone = sw.zone;
    if (ne.zone !== zone) zone = sw.zone;

    var step = zoom >= 15 ? 1000 : (zoom >= 13 ? 1000 : 2000);
    var eMin = Math.floor(Math.min(sw.easting, ne.easting) / step) * step;
    var eMax = Math.ceil(Math.max(sw.easting, ne.easting) / step) * step;
    var nMin = Math.floor(Math.min(sw.northing, ne.northing) / step) * step;
    var nMax = Math.ceil(Math.max(sw.northing, ne.northing) / step) * step;

    var northern = bounds.getCenter().lat >= 0;
    var labelEvery = step;
    var labelZoom = zoom >= 14;

    for (var e = eMin; e <= eMax; e += step) {
        var p1 = utmToLatLng(e, nMin, zone, northern);
        var p2 = utmToLatLng(e, nMax, zone, northern);
        var bold = e % 10000 === 0;
        var line = window.L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
            color: bold ? _GREEN_BOLD : _GREEN,
            weight: bold ? 1.5 : 1,
            opacity: bold ? 0.85 : 0.55,
            interactive: false,
            pane: 'mapGridPane'
        });
        _layer.addLayer(line);

        if (labelZoom && e % labelEvery === 0) {
            var lbl = utmToLatLng(e, nMin, zone, northern);
            var eastKm = pad3((e % 100000) / 1000);
            _layer.addLayer(window.L.marker([lbl.lat, lbl.lng], {
                icon: window.L.divIcon({
                    className: 'mgrs-grid-label mgrs-grid-e',
                    html: '<span>E' + eastKm + '</span>',
                    iconSize: [0, 0]
                }),
                interactive: false,
                pane: 'mapGridPane'
            }));
        }
    }

    for (var n = nMin; n <= nMax; n += step) {
        var q1 = utmToLatLng(eMin, n, zone, northern);
        var q2 = utmToLatLng(eMax, n, zone, northern);
        var boldN = n % 10000 === 0;
        var lineN = window.L.polyline([[q1.lat, q1.lng], [q2.lat, q2.lng]], {
            color: boldN ? _GREEN_BOLD : _GREEN,
            weight: boldN ? 1.5 : 1,
            opacity: boldN ? 0.85 : 0.55,
            interactive: false,
            pane: 'mapGridPane'
        });
        _layer.addLayer(lineN);

        if (labelZoom && n % labelEvery === 0) {
            var lblN = utmToLatLng(eMin, n, zone, northern);
            var northKm = pad3((n % 100000) / 1000);
            _layer.addLayer(window.L.marker([lblN.lat, lblN.lng], {
                icon: window.L.divIcon({
                    className: 'mgrs-grid-label mgrs-grid-n',
                    html: '<span>N' + northKm + '</span>',
                    iconSize: [0, 0]
                }),
                interactive: false,
                pane: 'mapGridPane'
            }));
        }
    }

    if (zoom >= 12 && zoom <= 13) {
        var c = bounds.getCenter();
        var utmC = latLngToUtm(c.lat, c.lng);
        var zoneLabel = utmC.zone + (northern ? 'N' : 'S');
        _layer.addLayer(window.L.marker([c.lat, c.lng], {
            icon: window.L.divIcon({
                className: 'mgrs-grid-label mgrs-grid-zone',
                html: '<span>UTM ' + zoneLabel + '</span>',
                iconSize: [0, 0]
            }),
            interactive: false,
            pane: 'mapGridPane'
        }));
    }
}

function bindMap() {
    if (_bound || !_map) return;
    _bound = true;
    _map.on('moveend zoomend resize', drawGrid);
}

export function initMgrsGrid(map) {
    if (!map || !window.L) return;
    _map = map;
    _visible = loadVisiblePref();
    if (!_layer) {
        _layer = window.L.layerGroup();
    }
    if (!map.getPane('mapGridPane')) {
        map.createPane('mapGridPane');
        map.getPane('mapGridPane').style.zIndex = 420;
    }
    if (_visible) _layer.addTo(map);
    bindMap();
    drawGrid();
    syncMgrsGridCheckbox();
}

export function setMgrsGridVisible(on) {
    _visible = !!on;
    saveVisiblePref(_visible);
    if (!_map || !_layer) return;
    if (_visible) {
        _layer.addTo(_map);
        drawGrid();
    } else {
        _map.removeLayer(_layer);
        clearLayer();
    }
    syncMgrsGridCheckbox();
}

export function isMgrsGridVisible() {
    return _visible;
}

export function syncMgrsGridCheckbox() {
    var cb = document.getElementById('map-filter-mgrs');
    if (cb) cb.checked = _visible;
}

export function refreshMgrsGrid() {
    drawGrid();
}
