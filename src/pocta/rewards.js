import { POCTA_PHASE } from './constants.js';
import { createAndStorePocta } from './storage.js';

function grantKey(comCode, questId) {
    return 'patrac_pocta_granted_' + (comCode || '').toUpperCase() + '_' + (questId || 'manual');
}

export function wasPoctaGrantedForQuest(comCode, questId) {
    return localStorage.getItem(grantKey(comCode, questId)) === 'true';
}

export function markPoctaGrantedForQuest(comCode, questId) {
    localStorage.setItem(grantKey(comCode, questId), 'true');
}

export function createPoctaInventoryItem(entity) {
    return {
        id: 'inv_pocta_' + entity.id,
        name: entity.title,
        desc: entity.story
            ? (entity.story.length > 140 ? entity.story.slice(0, 137) + '…' : entity.story)
            : 'Vzácný příběhový artefakt komunity — zatím neaktivovaný.',
        itemType: 'pocta',
        poctaId: entity.id,
        poctaCode: entity.code,
        poctaPhase: entity.phase || POCTA_PHASE.INACTIVE,
        locked: false,
        img: '',
        lore: entity.sourceQuestTitle
            ? 'Nalezena po misi: ' + entity.sourceQuestTitle
            : 'Odměna komunity z mise.',
        spec: 'Terminálový kód: ' + entity.code
    };
}

export function grantPoctaToCommunity(options) {
    options = options || {};
    var comCode = (options.comCode || localStorage.getItem('com_code') || '').toUpperCase();
    if (!comCode) return { ok: false, error: 'Chybí kód komunity.' };

    var questId = options.questId || 'manual';
    if (!options.force && wasPoctaGrantedForQuest(comCode, questId)) {
        return { ok: false, error: 'already_granted' };
    }

    var bridge = window.patracPoctaBridge || {};
    var entity = createAndStorePocta({
        ownerUserId: options.userId || localStorage.getItem('patrac_session') || '',
        ownerName: options.userName || localStorage.getItem('player_name') || 'Operativec',
        ownerComCode: comCode,
        title: options.title || 'Pocta komunity',
        story: options.story || '',
        phase: POCTA_PHASE.INACTIVE,
        sourceQuestId: options.questId || null,
        sourceQuestTitle: options.questTitle || null
    });

    var invItem = createPoctaInventoryItem(entity);
    if (typeof bridge.getCommunityItemsRaw === 'function' && typeof bridge.saveCommunityItemsRaw === 'function') {
        var raw = bridge.getCommunityItemsRaw().slice();
        raw.push(invItem);
        bridge.saveCommunityItemsRaw(raw);
    }

    markPoctaGrantedForQuest(comCode, questId);
    if (typeof bridge.loadCustomCraftedItems === 'function') bridge.loadCustomCraftedItems();

    return { ok: true, entity: entity, inventoryItem: invItem };
}

export function syncInventoryItemPhase(poctaId, phase) {
    var bridge = window.patracPoctaBridge || {};
    if (!poctaId || typeof bridge.getCommunityItemsRaw !== 'function') return;
    var raw = bridge.getCommunityItemsRaw().slice();
    var changed = false;
    for (var i = 0; i < raw.length; i++) {
        if (raw[i].itemType === 'pocta' && raw[i].poctaId === poctaId) {
            raw[i].poctaPhase = phase;
            changed = true;
        }
    }
    if (changed && typeof bridge.saveCommunityItemsRaw === 'function') {
        bridge.saveCommunityItemsRaw(raw);
    }
}
