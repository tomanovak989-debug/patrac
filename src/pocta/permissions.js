import { ROLE } from './constants.js';
import { isCodedQuestEntity, isPoctaEntity } from './types.js';

export function getViewerRole(entity, userId) {
    if (!entity || !userId) return ROLE.GUEST;
    if (entity.ownerUserId && entity.ownerUserId === userId) return ROLE.OWNER;
    return ROLE.GUEST;
}

export function isOwner(entity, userId) {
    return getViewerRole(entity, userId) === ROLE.OWNER;
}

export function canEditPocta(entity, userId) {
    return isPoctaEntity(entity) && isOwner(entity, userId);
}

export function canEditCodedQuest(entity, userId) {
    return isCodedQuestEntity(entity) && isOwner(entity, userId);
}

export function canWritePoctaLog(entity, userId, nearLocation) {
    if (!isPoctaEntity(entity)) return false;
    if (!nearLocation) return false;
    return isOwner(entity, userId);
}

export function canReadPoctaLogs(entity, userId, nearLocation) {
    if (!isPoctaEntity(entity)) return false;
    return !!nearLocation;
}

export function canCompleteCodedQuest(entity, userId, nearLocation) {
    if (!isCodedQuestEntity(entity)) return false;
    if (!nearLocation) return false;
    if (entity.phase === 'completed') return false;
    return entity.phase === 'active';
}

export function canActivateCodedQuest(entity, nearLocation) {
    if (!isCodedQuestEntity(entity)) return false;
    if (!nearLocation) return false;
    return entity.phase === 'mystery';
}
