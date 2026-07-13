import { POCTA_PHASE } from './constants.js';
import { isOwner } from './permissions.js';
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

export async function anchorPoctaAtPosition(poctaId, userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    var registry = loadRegistry();
    var entity = findEntityById(poctaId, registry);

    if (!entity || !isPoctaEntity(entity)) {
        return { ok: false, error: 'Pocta nenalezena v registru.' };
    }
    if (!isOwner(entity, userId)) {
        return { ok: false, error: 'Ukotvit může jen vlastník Pocty.' };
    }
    if (entity.phase === POCTA_PHASE.ANCHORED) {
        return { ok: false, error: 'Pocta je už ukotvená na mapě.' };
    }

    var pos = getFreshGpsPosition();
    if (!pos) {
        return {
            ok: false,
            error: 'GPS není k dispozici. Otevři mapu a počkej na fix polohy (do 2 min).'
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
