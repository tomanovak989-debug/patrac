import {
    POCTA_REGISTRY_VERSION,
    POCTA_STORAGE_KEY,
    TERMINAL_STATE_PREFIX
} from './constants.js';
import { normalizeCode } from './codes.js';
import {
    createCodedQuestEntity,
    createPoctaEntity,
    isCodedQuestEntity,
    isPoctaEntity
} from './types.js';

function readJson(key, fallback) {
    try {
        var raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function emptyRegistry() {
    return {
        version: POCTA_REGISTRY_VERSION,
        entities: {},
        byId: {}
    };
}

export function loadRegistry() {
    var reg = readJson(POCTA_STORAGE_KEY, null);
    if (!reg || typeof reg !== 'object') return emptyRegistry();
    if (!reg.entities) reg.entities = {};
    if (!reg.byId) reg.byId = {};
    reg.version = POCTA_REGISTRY_VERSION;
    return reg;
}

export function saveRegistry(registry) {
    writeJson(POCTA_STORAGE_KEY, registry);
}

export function getExistingCodes(registry) {
    registry = registry || loadRegistry();
    return registry.entities;
}

export function findEntityByCode(code, registry) {
    registry = registry || loadRegistry();
    code = normalizeCode(code);
    if (!code) return null;
    return registry.entities[code] || null;
}

export function findEntityById(id, registry) {
    registry = registry || loadRegistry();
    var code = registry.byId[id];
    if (!code) return null;
    return registry.entities[code] || null;
}

export function upsertEntity(entity, registry) {
    registry = registry || loadRegistry();
    if (!entity || !entity.code) return registry;
    var code = normalizeCode(entity.code);
    entity.code = code;
    registry.entities[code] = entity;
    registry.byId[entity.id] = code;
    saveRegistry(registry);
    return registry;
}

export function removeEntityByCode(code, registry) {
    registry = registry || loadRegistry();
    code = normalizeCode(code);
    var entity = registry.entities[code];
    if (!entity) return registry;
    delete registry.entities[code];
    delete registry.byId[entity.id];
    saveRegistry(registry);
    return registry;
}

export function createAndStorePocta(input, registry) {
    registry = registry || loadRegistry();
    var entity = createPoctaEntity(input, registry.entities);
    upsertEntity(entity, registry);
    return entity;
}

export function createAndStoreCodedQuest(input, registry) {
    registry = registry || loadRegistry();
    var entity = createCodedQuestEntity(input, registry.entities);
    upsertEntity(entity, registry);
    return entity;
}

export function importEntityPayload(payload, registry) {
    registry = registry || loadRegistry();
    if (!payload || !payload.entityType) return { ok: false, error: 'Neplatná data.' };
    var entity;
    if (payload.entityType === 'pocta') {
        entity = createPoctaEntity(payload, registry.entities);
    } else if (payload.entityType === 'coded_quest') {
        entity = createCodedQuestEntity(payload, registry.entities);
    } else {
        return { ok: false, error: 'Neznámý typ entity.' };
    }
    upsertEntity(entity, registry);
    return { ok: true, entity: entity };
}

function terminalStateKey(userId) {
    return TERMINAL_STATE_PREFIX + (userId || 'anon');
}

export function loadTerminalState(userId) {
    var state = readJson(terminalStateKey(userId), null);
    if (!state) {
        state = {
            activatedCodes: [],
            poctaInventoryIds: []
        };
    }
    if (!Array.isArray(state.activatedCodes)) state.activatedCodes = [];
    if (!Array.isArray(state.poctaInventoryIds)) state.poctaInventoryIds = [];
    return state;
}

export function saveTerminalState(userId, state) {
    writeJson(terminalStateKey(userId), state);
}

export function activateCodeForUser(userId, code, registry) {
    registry = registry || loadRegistry();
    code = normalizeCode(code);
    var entity = findEntityByCode(code, registry);
    if (!entity) return { ok: false, error: 'Kód nenalezen v síti PÁTRAČ.' };

    var state = loadTerminalState(userId);
    if (state.activatedCodes.indexOf(code) === -1) {
        state.activatedCodes.push(code);
        saveTerminalState(userId, state);
    }
    return { ok: true, entity: entity, code: code, state: state };
}

export function getActivatedEntities(userId, registry) {
    registry = registry || loadRegistry();
    var state = loadTerminalState(userId);
    var list = [];
    for (var i = 0; i < state.activatedCodes.length; i++) {
        var entity = registry.entities[state.activatedCodes[i]];
        if (entity) list.push(entity);
    }
    return list;
}

export function addPoctaToInventory(userId, poctaId) {
    var state = loadTerminalState(userId);
    if (state.poctaInventoryIds.indexOf(poctaId) === -1) {
        state.poctaInventoryIds.push(poctaId);
        saveTerminalState(userId, state);
    }
    return state;
}

export function getInventoryPoctaEntities(userId, registry) {
    registry = registry || loadRegistry();
    var state = loadTerminalState(userId);
    var list = [];
    for (var i = 0; i < state.poctaInventoryIds.length; i++) {
        var entity = findEntityById(state.poctaInventoryIds[i], registry);
        if (entity && isPoctaEntity(entity) && entity.phase === 'inactive') {
            list.push(entity);
        }
    }
    return list;
}

export function listRegistryEntities(registry) {
    registry = registry || loadRegistry();
    var out = [];
    for (var code in registry.entities) {
        if (registry.entities.hasOwnProperty(code)) out.push(registry.entities[code]);
    }
    return out;
}
