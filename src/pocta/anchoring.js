import { POCTA_PHASE } from './constants.js';
import { canAnchorPocta } from './permissions.js';
import { syncInventoryItemPhase } from './rewards.js';
import { reloadPoctaMapMarkers } from './map-bridge.js';
import {
    activateCodeForUser,
    findEntityById,
    loadRegistry,
    upsertEntity
} from './storage.js';
import { isPoctaEntity } from './types.js';

function getFreshGpsPosition() {
    var bridge = window.patracPoctaBridge || {};
    var pos = bridge.lastUserPosition;
    if (!pos || pos.lat == null || pos.lng == null) return null;
    if (Date.now() - (pos.ts || 0) > 120000) return null;
    return pos;
}

function requestFreshGpsPosition(timeoutMs) {
    var cached = getFreshGpsPosition();
    if (cached) return Promise.resolve(cached);

    return new Promise(function(resolve) {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function(position) {
                var pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy || 30,
                    ts: Date.now()
                };
                var bridge = window.patracPoctaBridge || {};
                bridge.lastUserPosition = pos;
                if (typeof window.patracPoctaOnGps === 'function') window.patracPoctaOnGps();
                resolve(pos);
            },
            function() { resolve(null); },
            { enableHighAccuracy: true, timeout: timeoutMs || 20000, maximumAge: 0 }
        );
    });
}

export async function anchorPoctaAtPosition(poctaId, userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    var registry = loadRegistry();
    var entity = findEntityById(poctaId, registry);

    if (!entity || !isPoctaEntity(entity)) {
        return { ok: false, error: 'Pocta nenalezena v registru.' };
    }
    if (!canAnchorPocta(entity, userId)) {
        return { ok: false, error: 'Ukotvit může člen stejné komunity, který má Poctu ve skladu.' };
    }
    if (entity.phase === POCTA_PHASE.ANCHORED) {
        return { ok: false, error: 'Pocta je už ukotvená na mapě.' };
    }

    var bridge = window.patracPoctaBridge || {};
    if (typeof bridge.switchMainTab === 'function') {
        var mapBtn = document.querySelectorAll('.bottom-action-bar button')[2];
        bridge.switchMainTab('map-only', mapBtn);
    }
    if (typeof bridge.startGeolocation === 'function') bridge.startGeolocation();

    var pos = await requestFreshGpsPosition(20000);
    if (!pos) {
        return {
            ok: false,
            error: 'GPS není k dispozici. Otevři záložku Mapa, povol polohu v prohlížeči a zkus znovu (do 20 s).'
        };
    }

    entity.phase = POCTA_PHASE.ANCHORED;
    entity.lat = pos.lat;
    entity.lng = pos.lng;
    entity.anchoredAt = new Date().toISOString();
    upsertEntity(entity, registry);
    syncInventoryItemPhase(entity.id, POCTA_PHASE.ANCHORED);

    await activateCodeForUser(userId, entity.code, registry);
    reloadPoctaMapMarkers(userId);

    return { ok: true, entity: entity };
}

export async function anchorPoctaFromInventory(displayIndex, userId) {
    var bridge = window.patracPoctaBridge || {};
    if (typeof bridge.resolveCommunityItemAtDisplayIndex !== 'function') {
        return { ok: false, error: 'Inventář komunity není připraven.' };
    }

    var item = bridge.resolveCommunityItemAtDisplayIndex(displayIndex);
    if (!item || item.itemType !== 'pocta' || !item.poctaId) {
        return { ok: false, error: 'Neplatná položka Pocty.' };
    }
    if (item.poctaPhase === POCTA_PHASE.ANCHORED) {
        return { ok: false, error: 'Tato Pocta je už ukotvená.' };
    }

    return anchorPoctaAtPosition(item.poctaId, userId);
}
