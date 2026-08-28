/**
 * Zoom / pohled vysílačky — localStorage na zařízení i záloha u účtu.
 * Jednou nastavené se po přihlášení nesmí vracet do kalibrace.
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
    src = src || DEFAULT_BANDS;
    return {
        full: { top: src.full.top, bottom: src.full.bottom },
        focus: { top: src.focus.top, bottom: src.focus.bottom }
    };
}

function currentUserId() {
    try { return String(localStorage.getItem('patrac_session') || '').trim(); } catch (e) {
        return '';
    }
}

function userPrefsKey(userId) {
    return DEVICE_PREFS_KEY + '_u_' + String(userId || '');
}

function bandsDifferFromDefault(bands) {
    if (!bands || !bands.full || !bands.focus) return false;
    var d = DEFAULT_BANDS;
    return bands.full.top !== d.full.top ||
        bands.full.bottom !== d.full.bottom ||
        bands.focus.top !== d.focus.top ||
        bands.focus.bottom !== d.focus.bottom;
}

function hasRadioStateForUser(userId) {
    if (!userId) return false;
    try { return localStorage.getItem('patrac_radio_state_' + userId) != null; } catch (e) {
        return false;
    }
}

function readStoredPrefs(key) {
    try {
        return normalizePrefs(JSON.parse(localStorage.getItem(key)));
    } catch (e) {
        return null;
    }
}

function normalizePrefs(raw) {
    if (!raw || !raw.bands || !raw.bands.full || !raw.bands.focus) return null;
    var locked = !!raw.locked;
    return {
        locked: locked,
        configured: !!(raw.configured || locked),
        viewMode: raw.viewMode === 'full' ? 'full' : 'focus',
        bands: cloneBands(raw.bands)
    };
}

function shouldKeepView(prefs, userId) {
    if (!prefs) return false;
    if (prefs.locked || prefs.configured) return true;
    if (prefs.viewMode === 'full') return true;
    if (bandsDifferFromDefault(prefs.bands)) return true;
    if (hasRadioStateForUser(userId || currentUserId())) return true;
    return false;
}

function commitIfNeeded(prefs, userId) {
    if (!shouldKeepView(prefs, userId)) return prefs;
    if (prefs.locked && prefs.configured) return prefs;
    prefs.locked = true;
    prefs.configured = true;
    return prefs;
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
        configured: hadLegacy,
        viewMode: viewMode,
        bands: bands
    };
}

function writePrefsKeys(prefs, userId) {
    var json = JSON.stringify(prefs);
    try { localStorage.setItem(DEVICE_PREFS_KEY, json); } catch (e) {}
    userId = userId || currentUserId();
    if (userId) {
        try { localStorage.setItem(userPrefsKey(userId), json); } catch (e2) {}
    }
}

export function loadSectorDisplayPrefs() {
    if (prefsCache) return prefsCache;
    var userId = currentUserId();
    var device = readStoredPrefs(DEVICE_PREFS_KEY);
    var user = userId ? readStoredPrefs(userPrefsKey(userId)) : null;
    var prefs = device || user || migrateLegacyPrefs();
    prefs = commitIfNeeded(prefs, userId);
    prefsCache = prefs;
    writePrefsKeys(prefsCache, userId);
    return prefsCache;
}

export function saveSectorDisplayPrefs(prefs) {
    prefs = normalizePrefs(prefs) || migrateLegacyPrefs();
    prefsCache = prefs;
    writePrefsKeys(prefsCache, currentUserId());
    return prefsCache;
}

/** Po přihlášení — znovu načíst zálohu účtu a držet už nastavený pohled. */
export function reloadSectorDisplayPrefs() {
    prefsCache = null;
    return loadSectorDisplayPrefs();
}

export function isSectorDisplayLocked() {
    return !!loadSectorDisplayPrefs().locked;
}

export function lockSectorDisplayPrefs() {
    var prefs = loadSectorDisplayPrefs();
    prefs.locked = true;
    prefs.configured = true;
    return saveSectorDisplayPrefs(prefs);
}

export function unlockSectorDisplayPrefs() {
    var prefs = loadSectorDisplayPrefs();
    prefs.locked = false;
    prefs.configured = true;
    return saveSectorDisplayPrefs(prefs);
}

export function getSectorViewModeFromPrefs() {
    return loadSectorDisplayPrefs().viewMode;
}

export function setSectorViewModeInPrefs(mode) {
    var prefs = loadSectorDisplayPrefs();
    prefs.viewMode = mode === 'full' ? 'full' : 'focus';
    prefs.configured = true;
    return saveSectorDisplayPrefs(prefs);
}

export function getSectorBandsFromPrefs() {
    return cloneBands(loadSectorDisplayPrefs().bands);
}

export function setSectorBandsInPrefs(bands) {
    var prefs = loadSectorDisplayPrefs();
    prefs.bands = cloneBands(bands);
    prefs.configured = true;
    return saveSectorDisplayPrefs(prefs);
}
