/**
 * Jediný zdroj pravdy pro viditelnost mapových nástrojů (HUD, pravítko, trasa, kompas).
 * Preference uživatele v localStorage × aktivní záložka Mapa.
 */

export var LS = {
    ruler: 'patrac_topo_ruler_visible',
    route: 'patrac_route_planner_visible',
    compass: 'patrac_compass_visible',
    mapToolsTab: 'patrac_map_tools_tab'
};

var _mapToolsTabActive = false;

export function isMapToolsTabActive() {
    return _mapToolsTabActive;
}

export function setMapToolsTabActive(active) {
    _mapToolsTabActive = !!active;
    try {
        localStorage.setItem(LS.mapToolsTab, active ? 'true' : 'false');
    } catch (e) {}
    return _mapToolsTabActive;
}

export function readBool(key, defaultTrue) {
    try {
        var v = localStorage.getItem(key);
        if (v == null) return defaultTrue !== false;
        return v === 'true';
    } catch (e) {
        return defaultTrue !== false;
    }
}

export function writeBool(key, on) {
    try {
        localStorage.setItem(key, on ? 'true' : 'false');
    } catch (e) {}
}

/** Uživatel chce pravítko (FAB / localStorage). */
export function isRulerWanted() {
    return readBool(LS.ruler, false);
}

/** Pravítko viditelné jen na záložce Mapa a když ho uživatel zapnul. */
export function isRulerEffective() {
    return isRulerWanted() && _mapToolsTabActive;
}

export function isRouteWanted() {
    return readBool(LS.route, false);
}

export function isRouteEffective() {
    return isRouteWanted() && _mapToolsTabActive;
}

/** Kompas defaultně zapnutý. */
export function isCompassWanted() {
    return readBool(LS.compass, true);
}

export function isCompassEffective() {
    return isCompassWanted() && _mapToolsTabActive;
}

/** Při vstupu na záložku Mapa vypnout pravítko (jednotné chování). */
export function resetRulerOnMapTabEnter() {
    writeBool(LS.ruler, false);
}
