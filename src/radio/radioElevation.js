/**
 * F4 — nadmořská výška pro rádiovou propagaci (Open-Meteo, bez klíče).
 */
var CACHE_KEY = 'patrac_elev_cache_v1';
var CACHE_MAX = 512;
var memCache = Object.create(null);

function cacheKey(lat, lng) {
    return Number(lat).toFixed(4) + ',' + Number(lng).toFixed(4);
}

function loadDiskCache() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function saveDiskCache(obj) {
    try {
        var keys = Object.keys(obj);
        if (keys.length > CACHE_MAX) {
            keys.slice(0, keys.length - CACHE_MAX).forEach(function(k) { delete obj[k]; });
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {}
}

export function getCachedElevationM(lat, lng) {
    var key = cacheKey(lat, lng);
    if (memCache[key] != null) return memCache[key];
    var disk = loadDiskCache();
    if (disk[key] != null) {
        memCache[key] = disk[key];
        return disk[key];
    }
    return null;
}

export function setCachedElevationM(lat, lng, elevationM) {
    if (!isFinite(elevationM)) return;
    var key = cacheKey(lat, lng);
    memCache[key] = elevationM;
    var disk = loadDiskCache();
    disk[key] = elevationM;
    saveDiskCache(disk);
}

/**
 * @param {Array<{lat:number,lng:number}>} points
 * @returns {Promise<number[]>} výšky v metrech (NaN pokud API selže)
 */
export async function fetchElevationsM(points) {
    points = (points || []).filter(function(p) {
        return p && isFinite(p.lat) && isFinite(p.lng);
    });
    if (!points.length) return [];

    var out = new Array(points.length);
    var needFetch = [];
    var i;
    for (i = 0; i < points.length; i++) {
        var cached = getCachedElevationM(points[i].lat, points[i].lng);
        if (cached != null) out[i] = cached;
        else needFetch.push({ index: i, lat: points[i].lat, lng: points[i].lng });
    }
    if (!needFetch.length) return out;

    var lats = needFetch.map(function(p) { return p.lat; }).join(',');
    var lngs = needFetch.map(function(p) { return p.lng; }).join(',');
    var url = 'https://api.open-meteo.com/v1/elevation?latitude=' + encodeURIComponent(lats) +
        '&longitude=' + encodeURIComponent(lngs);

    try {
        var res = await fetch(url);
        if (!res.ok) throw new Error('elevation http ' + res.status);
        var data = await res.json();
        var elevations = data && data.elevation;
        if (!Array.isArray(elevations)) throw new Error('bad elevation payload');
        for (i = 0; i < needFetch.length; i++) {
            var elev = Number(elevations[i]);
            if (!isFinite(elev)) elev = 0;
            var pt = needFetch[i];
            setCachedElevationM(pt.lat, pt.lng, elev);
            out[pt.index] = elev;
        }
    } catch (err) {
        console.warn('[radioElevation]', err);
        for (i = 0; i < needFetch.length; i++) {
            out[needFetch[i].index] = 0;
        }
    }
    return out;
}

export function midpointLatLng(a, b) {
    if (!a || !b) return null;
    return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Načte výšky pro dva body + střed (pro LoS).
 * @returns {Promise<{fromM:number,toM:number,midM:number}>}
 */
export async function fetchPathElevationsM(from, to) {
    var mid = midpointLatLng(from, to);
    var pts = [from, to];
    if (mid) pts.push(mid);
    var elevs = await fetchElevationsM(pts);
    return {
        fromM: elevs[0] != null ? elevs[0] : 0,
        toM: elevs[1] != null ? elevs[1] : 0,
        midM: mid && elevs[2] != null ? elevs[2] : null
    };
}
