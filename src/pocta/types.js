import {
    CODED_QUEST_PHASE,
    ENTITY_TYPE,
    POCTA_PHASE
} from './constants.js';
import { generateUniqueCode } from './codes.js';

function nowIso() {
    return new Date().toISOString();
}

function makeId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * @typedef {Object} PoctaVisitLog
 * @property {string} id
 * @property {string} userId
 * @property {string} userName
 * @property {string} text
 * @property {string} date
 * @property {number|null} lat
 * @property {number|null} lng
 */

/**
 * @typedef {Object} PoctaEntity
 * @property {string} id
 * @property {'pocta'} entityType
 * @property {string} code
 * @property {string} ownerUserId
 * @property {string} ownerName
 * @property {string} title
 * @property {string} story
 * @property {'inactive'|'anchored'} phase
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {PoctaVisitLog[]} visitLogs
 * @property {PoctaVisitLog[]} archive
 * @property {string} createdAt
 * @property {string|null} anchoredAt
 * @property {string|null} archivedAt
 */

/**
 * @typedef {Object} CodedQuestEntity
 * @property {string} id
 * @property {'coded_quest'} entityType
 * @property {string} code
 * @property {string} ownerUserId
 * @property {string} ownerName
 * @property {string} title
 * @property {string} desc
 * @property {'mystery'|'active'|'completed'} phase
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {string} createdAt
 * @property {string|null} activatedAt
 * @property {string|null} completedAt
 * @property {string|null} completedByUserId
 * @property {string|null} completedByName
 */

export function createPoctaEntity(input, existingCodes) {
    input = input || {};
    return {
        id: input.id || makeId('pocta'),
        entityType: ENTITY_TYPE.POCTA,
        code: input.code || generateUniqueCode(existingCodes),
        ownerUserId: input.ownerUserId || '',
        ownerName: input.ownerName || '',
        ownerComCode: input.ownerComCode || '',
        sourceQuestId: input.sourceQuestId || null,
        sourceQuestTitle: input.sourceQuestTitle || null,
        title: input.title || 'Pocta bez názvu',
        story: input.story || '',
        phase: input.phase || POCTA_PHASE.INACTIVE,
        lat: input.lat != null ? input.lat : null,
        lng: input.lng != null ? input.lng : null,
        visitLogs: Array.isArray(input.visitLogs) ? input.visitLogs.slice() : [],
        archive: Array.isArray(input.archive) ? input.archive.slice() : [],
        createdAt: input.createdAt || nowIso(),
        anchoredAt: input.anchoredAt || null,
        archivedAt: input.archivedAt || null
    };
}

export function createCodedQuestEntity(input, existingCodes) {
    input = input || {};
    return {
        id: input.id || makeId('cquest'),
        entityType: ENTITY_TYPE.CODED_QUEST,
        code: input.code || generateUniqueCode(existingCodes),
        ownerUserId: input.ownerUserId || '',
        ownerName: input.ownerName || '',
        title: input.title || 'Záhada',
        desc: input.desc || '',
        phase: input.phase || CODED_QUEST_PHASE.MYSTERY,
        lat: input.lat != null ? input.lat : null,
        lng: input.lng != null ? input.lng : null,
        createdAt: input.createdAt || nowIso(),
        activatedAt: input.activatedAt || null,
        completedAt: input.completedAt || null,
        completedByUserId: input.completedByUserId || null,
        completedByName: input.completedByName || null
    };
}

export function createVisitLog(userId, userName, text, lat, lng) {
    return {
        id: 'visit_' + Date.now().toString(36),
        userId: userId || '',
        userName: userName || 'Operativec',
        text: text || '',
        date: new Date().toLocaleString('cs-CZ'),
        lat: lat != null ? lat : null,
        lng: lng != null ? lng : null
    };
}

export function isPoctaEntity(entity) {
    return entity && entity.entityType === ENTITY_TYPE.POCTA;
}

export function isCodedQuestEntity(entity) {
    return entity && entity.entityType === ENTITY_TYPE.CODED_QUEST;
}

export function getEntityMapId(entity) {
    if (!entity || !entity.id) return '';
    if (isPoctaEntity(entity)) return 'pocta_ent_' + entity.id;
    if (isCodedQuestEntity(entity)) return 'cquest_ent_' + entity.id;
    return entity.id;
}
