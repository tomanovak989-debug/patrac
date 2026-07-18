/**
 * UTM / MGRS mřížka — NATO (proj4js/NGA algoritmus).
 */

import {
    latLngToUtm,
    utmToLatLng,
    square100kId,
    latLngToMgrs,
    formatMgrs,
    mgrsPrecisionLabel
} from './mgrsCoords.js';

var _map = null;
var _layer = null;
var _visible = true;
var _bound = false;
var _MGRS_ACCURACY = 3;
var _GREEN = 'rgba(74,246,38,0.42)';
var _GREEN_BOLD = 'rgba(74,246,38,0.72)';

var STORAGE_KEY = 'patrac_mgrs_grid_visible';
var ACC_STORAGE_KEY = 'patrac_mgrs_accuracy';

function loadVisiblePref() {
    try {
        var v = localStorage.getItem(STORAGE_KEY);
        if (v === 'false') return false;
        if (v === 'true') return true;
    } catch (e) {}
    return true;
}

function loadAccuracyPref() {
    try {
        var a = parseInt(localStorage.getItem(ACC_STORAGE_KEY) || '3', 10);
        if (a >= 0 && a <= 5) return a;
    } catch (e) {}
    return 3;
}

function saveVisiblePref(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false'); } catch (e) {}
}

function pad2(n) {
    var s = String(Math.round(n));
    while (s.length < 2) s = '0' + s;
    return s.slice(-2);
}

function clearLayer() {
    if (!_layer) return;
    _layer.clearLayers();
}

function mgrsKmDigits(easting, northing) {
    return {
        e: pad2((easting % 100000) / 1000),
        n: pad2((northing % 100000) / 1000)
    };
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
    var center = bounds.getCenter();
    var sw = latLngToUtm(bounds.getSouth(), bounds.getWest());
    var ne = latLngToUtm(bounds.getNorth(), bounds.getEast());
    var zone = sw.zone;
    if (ne.zone !== zone) zone = sw.zone;

    var step = 1000;
    if (zoom < 13) step = 2000;

    var eMin = Math.floor(Math.min(sw.easting, ne.easting) / step) * step;
    var eMax = Math.ceil(Math.max(sw.easting, ne.easting) / step) * step;
    var nMin = Math.floor(Math.min(sw.northing, ne.northing) / step) * step;
    var nMax = Math.ceil(Math.max(sw.northing, ne.northing) / step) * step;

    var latHint = center.lat;
    var labelZoom = zoom >= 14;
    var squareZoom = zoom >= 12;

    for (var e = eMin; e <= eMax; e += step) {
        var p1 = utmToLatLng(e, nMin, zone, latHint);
        var p2 = utmToLatLng(e, nMax, zone, latHint);
        var bold = e % 10000 === 0;
        var line = window.L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
            color: bold ? _GREEN_BOLD : _GREEN,
            weight: bold ? 1.5 : 1,
            opacity: bold ? 0.85 : 0.55,
            interactive: false,
            pane: 'mapGridPane'
        });
        _layer.addLayer(line);

        if (labelZoom) {
            var lbl = utmToLatLng(e, nMin, zone, latHint);
            var km = mgrsKmDigits(e, nMin);
            _layer.addLayer(window.L.marker([lbl.lat, lbl.lng], {
                icon: window.L.divIcon({
                    className: 'mgrs-grid-label mgrs-grid-e',
                    html: '<span>' + km.e + '</span>',
                    iconSize: [0, 0]
                }),
                interactive: false,
                pane: 'mapGridPane'
            }));
        }
    }

    for (var n = nMin; n <= nMax; n += step) {
        var q1 = utmToLatLng(eMin, n, zone, latHint);
        var q2 = utmToLatLng(eMax, n, zone, latHint);
        var boldN = n % 10000 === 0;
        var lineN = window.L.polyline([[q1.lat, q1.lng], [q2.lat, q2.lng]], {
            color: boldN ? _GREEN_BOLD : _GREEN,
            weight: boldN ? 1.5 : 1,
            opacity: boldN ? 0.85 : 0.55,
            interactive: false,
            pane: 'mapGridPane'
        });
        _layer.addLayer(lineN);

        if (labelZoom) {
            var lblN = utmToLatLng(eMin, n, zone, latHint);
            var kmN = mgrsKmDigits(eMin, n);
            _layer.addLayer(window.L.marker([lblN.lat, lblN.lng], {
                icon: window.L.divIcon({
                    className: 'mgrs-grid-label mgrs-grid-n',
                    html: '<span>' + kmN.n + '</span>',
                    iconSize: [0, 0]
                }),
                interactive: false,
                pane: 'mapGridPane'
            }));
        }
    }

    if (squareZoom) {
        var e100 = Math.floor(eMin / 100000) * 100000;
        for (; e100 <= eMax; e100 += 100000) {
            var n100 = Math.floor(nMin / 100000) * 100000;
            for (; n100 <= nMax; n100 += 100000) {
                if (e100 < eMin - 1 || n100 < nMin - 1) continue;
                var ptSq = utmToLatLng(e100 + 50000, n100 + 50000, zone, latHint);
                var utmSq = latLngToUtm(ptSq.lat, ptSq.lng);
                var gzd = zone + utmSq.zoneLetter;
                var sq = square100kId(e100 + 50000, n100 + 50000, zone);
                var pt = utmToLatLng(e100, n100, zone, ptSq.lat);
                _layer.addLayer(window.L.marker([pt.lat, pt.lng], {
                    icon: window.L.divIcon({
                        className: 'mgrs-grid-label mgrs-grid-square',
                        html: '<span>' + gzd + ' ' + sq + '</span>',
                        iconSize: [0, 0]
                    }),
                    interactive: false,
                    pane: 'mapGridPane'
                }));
            }
        }
    }
}

function bindMap() {
    if (_bound || !_map) return;
    _bound = true;
    _map.on('moveend zoomend resize', function() {
        drawGrid();
        if (typeof window.patracUpdateMgrsReadout === 'function') {
            window.patracUpdateMgrsReadout();
        }
    });
}

export function initMgrsGrid(map) {
    if (!map || !window.L) return;
    _map = map;
    _visible = loadVisiblePref();
    _MGRS_ACCURACY = loadAccuracyPref();
    if (!_layer) _layer = window.L.layerGroup();
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

export function getMgrsAccuracy() {
    return _MGRS_ACCURACY;
}

export function setMgrsAccuracy(acc) {
    _MGRS_ACCURACY = Math.max(0, Math.min(5, parseInt(acc, 10) || 3));
    try { localStorage.setItem(ACC_STORAGE_KEY, String(_MGRS_ACCURACY)); } catch (e) {}
}

export function mgrsAtLatLng(lat, lng, accuracy) {
    var acc = typeof accuracy === 'number' ? accuracy : _MGRS_ACCURACY;
    try {
        return formatMgrs(latLngToMgrs(lat, lng, acc));
    } catch (e) {
        return '—';
    }
}

export function mgrsPrecisionText(accuracy) {
    return mgrsPrecisionLabel(typeof accuracy === 'number' ? accuracy : _MGRS_ACCURACY);
}

export function syncMgrsGridCheckbox() {
    var cb = document.getElementById('map-filter-mgrs');
    if (cb) cb.checked = _visible;
    var sel = document.getElementById('map-mgrs-accuracy');
    if (sel) sel.value = String(_MGRS_ACCURACY);
}

export function refreshMgrsGrid() {
    drawGrid();
}
