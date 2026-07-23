/**
 * Datový model questu / úkolu (admin katalog).
 * Atributy 1–7: id/název, typ, spouštěč, obsah, odměny, rádio, geografie.
 */

export var QUEST_TYPE_MAIN = 'main';
export var QUEST_TYPE_SIDE = 'side';

export var QUEST_TYPE_LABELS = {
    main: 'Main — hlavní linka',
    side: 'Side — vedlejší / signál'
};

export var OBJECTIVE_LOCATION = 'location';
export var OBJECTIVE_RADIO = 'radio';
export var OBJECTIVE_ITEM = 'item';
export var OBJECTIVE_OTHER = 'other';

export var OBJECTIVE_LABELS = {
    location: 'Najít lokaci',
    radio: 'Zachytit / odposlechnout rádio',
    item: 'Získat předmět',
    other: 'Jiný cíl'
};

/** Předvolby min. dosahu podle matice rádia (km). */
export var RADIO_RANGE_PRESETS_KM = [5, 7.5, 10, 12.5];

function asString(v) {
    return v == null ? '' : String(v).trim();
}

function asNumberOrNull(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(v);
    return typeof n === 'number' && isFinite(n) ? n : null;
}

function asIntOrZero(v) {
    var n = parseInt(v, 10);
    return isFinite(n) && n > 0 ? n : 0;
}

function slugifyId(name) {
    var s = asString(name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    if (!s) s = 'quest';
    if (s.length > 40) s = s.slice(0, 40);
    return s;
}

export function createEmptyQuestDefinition(partial) {
    partial = partial || {};
    var id = asString(partial.id) || ('q_' + Date.now().toString(36));
    return normalizeQuestDefinition(Object.assign({
        id: id,
        name: '',
        type: QUEST_TYPE_SIDE,
        trigger: {
            prerequisiteQuestId: null,
            minRadioRangeKm: null
        },
        content: {
            description: '',
            objectiveType: OBJECTIVE_LOCATION,
            objectiveText: ''
        },
        rewards: {
            xp: 0,
            reputation: 0,
            unlockFrequency: null,
            unlockEncryptionKey: null,
            itemName: null
        },
        radio: {
            frequency: null,
            encryptionKey: null
        },
        geo: {
            lat: null,
            lng: null,
            radiusM: null,
            timeLimitHours: null
        },
        char: '',
        mapLabel: '',
        req: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    }, partial));
}

/**
 * @returns {object|null}
 */
export function normalizeQuestDefinition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = asString(raw.id);
    if (!id) return null;

    var type = raw.type === QUEST_TYPE_MAIN ? QUEST_TYPE_MAIN : QUEST_TYPE_SIDE;
    var triggerIn = raw.trigger && typeof raw.trigger === 'object' ? raw.trigger : {};
    var contentIn = raw.content && typeof raw.content === 'object' ? raw.content : {};
    var rewardsIn = raw.rewards && typeof raw.rewards === 'object' ? raw.rewards : {};
    var radioIn = raw.radio && typeof raw.radio === 'object' ? raw.radio : {};
    var geoIn = raw.geo && typeof raw.geo === 'object' ? raw.geo : {};

    var objType = asString(contentIn.objectiveType || raw.objectiveType);
    if (!OBJECTIVE_LABELS[objType]) objType = OBJECTIVE_LOCATION;

    var name = asString(raw.name || raw.title);
    var desc = asString(contentIn.description != null ? contentIn.description : raw.desc);

    var req = [];
    if (Array.isArray(raw.req)) {
        for (var i = 0; i < raw.req.length; i++) {
            var r = asString(raw.req[i]);
            if (r) req.push(r);
        }
    }

    var unlockFreq = asString(rewardsIn.unlockFrequency);
    var unlockKey = asString(rewardsIn.unlockEncryptionKey);
    var itemName = asString(rewardsIn.itemName);
    var radioFreq = asString(radioIn.frequency != null ? radioIn.frequency : raw.frequency);
    var radioKey = asString(radioIn.encryptionKey != null ? radioIn.encryptionKey : raw.encryptionKey);
    var prereq = asString(triggerIn.prerequisiteQuestId != null
        ? triggerIn.prerequisiteQuestId
        : raw.prerequisiteQuestId);

    return {
        id: id,
        name: name,
        type: type,
        trigger: {
            prerequisiteQuestId: prereq || null,
            minRadioRangeKm: asNumberOrNull(
                triggerIn.minRadioRangeKm != null ? triggerIn.minRadioRangeKm : raw.minRadioRangeKm
            )
        },
        content: {
            description: desc,
            objectiveType: objType,
            objectiveText: asString(contentIn.objectiveText || raw.objectiveText)
        },
        rewards: {
            xp: asIntOrZero(rewardsIn.xp != null ? rewardsIn.xp : raw.xp),
            reputation: asIntOrZero(rewardsIn.reputation != null ? rewardsIn.reputation : raw.reputation),
            unlockFrequency: unlockFreq || null,
            unlockEncryptionKey: unlockKey || null,
            itemName: itemName || null
        },
        radio: {
            frequency: radioFreq || null,
            encryptionKey: radioKey || null
        },
        geo: {
            lat: asNumberOrNull(geoIn.lat != null ? geoIn.lat : raw.lat),
            lng: asNumberOrNull(geoIn.lng != null ? geoIn.lng : raw.lng),
            radiusM: asNumberOrNull(geoIn.radiusM != null ? geoIn.radiusM : raw.radiusM),
            timeLimitHours: asNumberOrNull(
                geoIn.timeLimitHours != null ? geoIn.timeLimitHours : raw.timeLimitHours
            )
        },
        char: asString(raw.char),
        mapLabel: asString(raw.mapLabel) || name,
        req: req,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
}

export function normalizeQuestDefinitionList(raw) {
    var out = [];
    var seen = {};
    if (!Array.isArray(raw)) return out;
    for (var i = 0; i < raw.length; i++) {
        var def = normalizeQuestDefinition(raw[i]);
        if (!def || seen[def.id]) continue;
        seen[def.id] = true;
        out.push(def);
    }
    return out;
}

export function mergeQuestDefinitionLists(a, b) {
    var map = {};
    var lists = [a || [], b || []];
    for (var l = 0; l < lists.length; l++) {
        var list = normalizeQuestDefinitionList(lists[l]);
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var prev = map[item.id];
            if (!prev || (item.updatedAt || 0) >= (prev.updatedAt || 0)) {
                map[item.id] = item;
            }
        }
    }
    var out = [];
    for (var id in map) {
        if (Object.prototype.hasOwnProperty.call(map, id)) out.push(map[id]);
    }
    out.sort(function(x, y) {
        return (x.name || x.id).localeCompare(y.name || y.id, 'cs');
    });
    return out;
}

export function suggestQuestIdFromName(name, existingIds) {
    var base = slugifyId(name);
    var id = base;
    var n = 2;
    existingIds = existingIds || [];
    while (existingIds.indexOf(id) !== -1) {
        id = base + '_' + n;
        n++;
    }
    return id;
}

/**
 * Runtime custom quest z definice (pro aktivaci v Úkolech).
 */
export function definitionToRuntimeQuest(def) {
    def = normalizeQuestDefinition(def);
    if (!def) return null;
    var timeH = def.geo.timeLimitHours;
    return {
        id: def.id,
        title: def.name,
        mapLabel: def.mapLabel || def.name,
        desc: def.content.description,
        char: def.char || 'Operátor',
        req: def.req.slice(),
        time: timeH ? (String(timeH) + 'h') : '2h',
        latKey: 'point_' + def.id + '_lat',
        lngKey: 'point_' + def.id + '_lng',
        doneKey: 'quest_done_' + def.id,
        questType: def.type,
        definition: def,
        fromDefinition: true
    };
}
