/** POCTA modul — konstanty a fáze entit. */

export const POCTA_STORAGE_KEY = 'patrac_pocta_registry';
export const POCTA_REGISTRY_VERSION = 1;

export const POCTA_CODE_LENGTH = 6;
export const POCTA_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const POCTA_PHASE = {
    INACTIVE: 'inactive',
    ANCHORED: 'anchored'
};

export const CODED_QUEST_PHASE = {
    MYSTERY: 'mystery',
    ACTIVE: 'active',
    COMPLETED: 'completed'
};

export const ENTITY_TYPE = {
    POCTA: 'pocta',
    CODED_QUEST: 'coded_quest'
};

export const ROLE = {
    OWNER: 'owner',
    GUEST: 'guest'
};

/** Fyzický příchod — aktivace úkolu (m). */
export const CODED_QUEST_ACTIVATE_RADIUS_M = 30;

/** Fyzický příchod — čtení/zápis kroniky Pocty (m). */
export const POCTA_VISIT_RADIUS_M = 50;

export const TERMINAL_STATE_PREFIX = 'patrac_terminal_';
