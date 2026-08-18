/**
 * Rádiové uzly — abstrakce vysílací / přijímací pozice.
 * Fáze 4: shelter + handset + komunitní receivery.
 */

export var KIND_SHELTER = 'shelter';
export var KIND_HANDSET = 'handset';
export var KIND_RECEIVER = 'receiver';

export var NODE_KIND_LABELS = {
    shelter: 'BÁZE',
    handset: 'NOSIČ',
    receiver: 'RECEIVER'
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
    /* Vždy NOSIČ (GPS) — útočiště zůstává jen jako síťový receiver na mapě. */
    return KIND_HANDSET;
}

export function setStoredRadioKind(userId, kind) {
    kind = KIND_HANDSET;
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
        elevationM: meta.elevationM != null ? meta.elevationM : null,
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
 * Aktivní uzel pro TX/RX = NOSIČ (GPS). Útočiště jen nouzový fallback bez GPS.
 * @returns {{ node: object|null, kind: string, fallback: boolean }}
 */
export function resolveActiveRadioNode(deps) {
    deps = deps || {};
    var handset = resolveHandsetNode(deps);
    if (handset) return { node: handset, kind: KIND_HANDSET, fallback: false };
    var shelter = resolveShelterNode(deps);
    if (shelter) return { node: shelter, kind: KIND_SHELTER, fallback: true };
    return { node: null, kind: KIND_HANDSET, fallback: false };
}

export function cycleRadioKind(userId) {
    setStoredRadioKind(userId, KIND_HANDSET);
    return KIND_HANDSET;
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
    var receivers = typeof deps.getReceivers === 'function' ? deps.getReceivers() : [];
    var i;
    for (i = 0; i < receivers.length; i++) {
        var rx = receivers[i];
        if (!rx || !isFinite(rx.lat) || !isFinite(rx.lng)) continue;
        list.push({ node: rx, role: 'receiver' });
    }
    return list;
}
