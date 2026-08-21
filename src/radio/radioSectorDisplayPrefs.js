/**
 * Zoom vysílačky — per-device cache v prohlížeči (localStorage).
 * Uživatel si nastaví vodící pásma, zamkne a lišty zmizí.
 */
export var DEVICE_PREFS_KEY = 'patrac_sector_display_prefs';
var LEGACY_BANDS_KEY = 'patrac_sector_view_bands';
var LEGACY_MODE_KEY = 'patrac_sector_view_mode';

export var DEFAULT_BANDS = {
    full: { top: 120, bottom: 790 },
    focus: { top: 333, bottom: 786 }
};

var prefsCache = null;

function cloneBands(src) {
    return {
        full: { top: src.full.top, bottom: src.full.bottom },
        focus: { top: src.focus.top, bottom: src.focus.bottom }
    };
}

function normalizePrefs(raw) {
    if (!raw || !raw.bands || !raw.bands.full || !raw.bands.focus) return null;
    return {
        locked: !!raw.locked,
        viewMode: raw.viewMode === 'full' ? 'full' : 'focus',
        bands: cloneBands(raw.bands)
    };
}

function migrateLegacyPrefs() {
    var bands = cloneBands(DEFAULT_BANDS);
    var viewMode = 'focus';
    var hadLegacy = false;

    try {
        if (localStorage.getItem(LEGACY_BANDS_KEY) || localStorage.getItem(LEGACY_MODE_KEY)) {
            hadLegacy = true;
        }
        var rawBands = JSON.parse(localStorage.getItem(LEGACY_BANDS_KEY));
        if (rawBands && rawBands.full && rawBands.focus) bands = cloneBands(rawBands);
    } catch (e) {}

    try {
        var m = localStorage.getItem(LEGACY_MODE_KEY);
        if (m === 'full' || m === 'focus') viewMode = m;
    } catch (e) {}

    return {
        locked: hadLegacy,
        viewMode: viewMode,
        bands: bands
    };
}

export function loadSectorDisplayPrefs() {
    if (prefsCache) return prefsCache;
    try {
        var raw = JSON.parse(localStorage.getItem(DEVICE_PREFS_KEY));
        var normalized = normalizePrefs(raw);
        if (normalized) {
            prefsCache = normalized;
            return prefsCache;
        }
    } catch (e) {}
    prefsCache = migrateLegacyPrefs();
    saveSectorDisplayPrefs(prefsCache);
    return prefsCache;
}

export function saveSectorDisplayPrefs(prefs) {
    prefs = normalizePrefs(prefs) || migrateLegacyPrefs();
    prefsCache = prefs;
    try {
        localStorage.setItem(DEVICE_PREFS_KEY, JSON.stringify(prefsCache));
    } catch (e) {}
    return prefsCache;
}

export function isSectorDisplayLocked() {
    return !!loadSectorDisplayPrefs().locked;
}

export function lockSectorDisplayPrefs() {
    var prefs = loadSectorDisplayPrefs();
    prefs.locked = true;
    return saveSectorDisplayPrefs(prefs);
}

export function unlockSectorDisplayPrefs() {
    var prefs = loadSectorDisplayPrefs();
    prefs.locked = false;
    return saveSectorDisplayPrefs(prefs);
}

export function getSectorViewModeFromPrefs() {
    return loadSectorDisplayPrefs().viewMode;
}

export function setSectorViewModeInPrefs(mode) {
    var prefs = loadSectorDisplayPrefs();
    prefs.viewMode = mode === 'full' ? 'full' : 'focus';
    return saveSectorDisplayPrefs(prefs);
}

export function getSectorBandsFromPrefs() {
    return cloneBands(loadSectorDisplayPrefs().bands);
}

export function setSectorBandsInPrefs(bands) {
    var prefs = loadSectorDisplayPrefs();
    prefs.bands = cloneBands(bands);
    return saveSectorDisplayPrefs(prefs);
}
