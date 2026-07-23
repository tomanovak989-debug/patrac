/**
 * Rádiové uzly — abstrakce vysílací / přijímací pozice.
 * Fáze 1: shelter (útočiště) + handset (GPS). Receiver později.
 */

export var KIND_SHELTER = 'shelter';
export var KIND_HANDSET = 'handset';

export var NODE_KIND_LABELS = {
    shelter: 'BÁZE',
    handset: 'NOSIČ'
};

function parseLatLng(lat, lng) {
    var la = typeof lat === 'number' ? lat : parseFloat(lat);
    var ln = typeof lng === 'number' ? lng : parseFloat(lng);
    if (!isFinite(la) || !isFinite(ln)) return null;
    return { lat: la, lng: ln };
}

function storageKey(userId) {
    return 'patrac_radio_node_kind_' + (userId || 'local');
}

export function getStoredRadioKind(userId) {
    try {
        var raw = localStorage.getItem(storageKey(userId));
        if (raw === KIND_HANDSET || raw === KIND_SHELTER) return raw;
    } catch (e) {}
    return KIND_SHELTER;
}

export function setStoredRadioKind(userId, kind) {
    kind = kind === KIND_HANDSET ? KIND_HANDSET : KIND_SHELTER;
    try { localStorage.setItem(storageKey(userId), kind); } catch (e) {}
    return kind;
}

export function makeRadioNode(kind, latLng, meta) {
    meta = meta || {};
    var pos = parseLatLng(latLng && latLng.lat, latLng && latLng.lng);
    if (!pos) return null;
    return {
        id: meta.id || (kind + '_' + String(pos.lat.toFixed(5)) + '_' + String(pos.lng.toFixed(5))),
        kind: kind,
        lat: pos.lat,
        lng: pos.lng,
        label: meta.label || NODE_KIND_LABELS[kind] || kind
    };
}

/**
 * @param {{ getShelterLatLng?: Function, getPlayerLatLng?: Function, userId?: string }} deps
 */
export function resolveShelterNode(deps) {
    deps = deps || {};
    var pos = null;
    if (typeof deps.getShelterLatLng === 'function') {
        try { pos = deps.getShelterLatLng(); } catch (e) {}
    }
    if (!pos) {
        try {
            pos = parseLatLng(localStorage.getItem('point_roxy_lat'), localStorage.getItem('point_roxy_lng'));
        } catch (e2) {}
    }
    return makeRadioNode(KIND_SHELTER, pos, { id: 'shelter_roxy', label: 'Útočiště' });
}

/**
 * @param {{ getPlayerLatLng?: Function }} deps
 */
export function resolveHandsetNode(deps) {
    deps = deps || {};
    var pos = null;
    if (typeof deps.getPlayerLatLng === 'function') {
        try { pos = deps.getPlayerLatLng(); } catch (e) {}
    }
    return makeRadioNode(KIND_HANDSET, pos, { id: 'handset_gps', label: 'Nosič (GPS)' });
}

/**
 * Aktivní uzel pro TX/RX. Preferuje zvolený kind; při chybě souřadnic spadne na druhý.
 * @returns {{ node: object|null, kind: string, fallback: boolean }}
 */
export function resolveActiveRadioNode(deps) {
    deps = deps || {};
    var userId = deps.userId || '';
    try {
        if (!userId && typeof localStorage !== 'undefined') {
            userId = localStorage.getItem('patrac_session') || '';
        }
    } catch (e) {}

    var want = getStoredRadioKind(userId);
    var shelter = resolveShelterNode(deps);
    var handset = resolveHandsetNode(deps);

    if (want === KIND_HANDSET) {
        if (handset) return { node: handset, kind: KIND_HANDSET, fallback: false };
        if (shelter) return { node: shelter, kind: KIND_SHELTER, fallback: true };
        return { node: null, kind: KIND_HANDSET, fallback: false };
    }

    if (shelter) return { node: shelter, kind: KIND_SHELTER, fallback: false };
    if (handset) return { node: handset, kind: KIND_HANDSET, fallback: true };
    return { node: null, kind: KIND_SHELTER, fallback: false };
}

export function cycleRadioKind(userId) {
    var cur = getStoredRadioKind(userId);
    var next = cur === KIND_HANDSET ? KIND_SHELTER : KIND_HANDSET;
    return setStoredRadioKind(userId, next);
}

export function nodesForRangeDisplay(deps) {
    deps = deps || {};
    var active = resolveActiveRadioNode(deps);
    var shelter = resolveShelterNode(deps);
    var list = [];
    if (active.node) list.push({ node: active.node, role: 'active' });
    /* Při NOSIČI ukaž i slabší kruhy z útočiště (báze), pokud není na stejném místě. */
    if (active.kind === KIND_HANDSET && active.node && shelter &&
        (Math.abs(shelter.lat - active.node.lat) > 1e-5 || Math.abs(shelter.lng - active.node.lng) > 1e-5)) {
        list.push({ node: shelter, role: 'base' });
    }
    return list;
}
