/**
 * Admin UI — katalog definic questů (atributy 1–7).
 */
import {
    QUEST_TYPE_MAIN,
    QUEST_TYPE_SIDE,
    QUEST_TYPE_LABELS,
    OBJECTIVE_LABELS,
    RADIO_RANGE_PRESETS_KM,
    createEmptyQuestDefinition,
    normalizeQuestDefinition,
    normalizeQuestDefinitionList,
    suggestQuestIdFromName,
    definitionToRuntimeQuest
} from './questDefinition.js';

var STORAGE_KEY = 'quest_definitions_list';
var editingId = null;
var bound = false;

function el(id) {
    return document.getElementById(id);
}

function loadDefinitions() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return normalizeQuestDefinitionList(JSON.parse(raw));
    } catch (e) {
        return [];
    }
}

function saveDefinitions(list) {
    list = normalizeQuestDefinitionList(list);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('[questAdmin] save', e);
    }
    if (typeof window.syncCommunityQuestsToCloud === 'function') {
        window.syncCommunityQuestsToCloud();
    } else if (typeof window.patracSyncCommunityQuests === 'function') {
        window.patracSyncCommunityQuests();
    }
    return list;
}

function val(id) {
    var node = el(id);
    return node ? String(node.value || '').trim() : '';
}

function setVal(id, value) {
    var node = el(id);
    if (node) node.value = value == null ? '' : String(value);
}

function fillPrerequisiteOptions(selectedId, excludeId) {
    var sel = el('qdef-prereq');
    if (!sel) return;
    var defs = loadDefinitions();
    var html = '<option value="">— žádná —</option>';
    for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        if (excludeId && d.id === excludeId) continue;
        var selAttr = selectedId && d.id === selectedId ? ' selected' : '';
        html += '<option value="' + escapeAttr(d.id) + '"' + selAttr + '>' +
            escapeHtml(d.name || d.id) + ' (' + escapeHtml(d.id) + ')</option>';
    }
    /* Story questy jako možné prerekvizity */
    var story = [
        { id: 'roxy', name: 'Útočiště (Roxy)' },
        { id: 'sef', name: 'Zdroj vody (Šéf)' },
        { id: 'herbert', name: 'Lesní sklad (Herbert)' },
        { id: 'ino', name: 'Cvičiště (Ino)' },
        { id: 'adam', name: 'Rozhledna (Adam)' }
    ];
    for (var s = 0; s < story.length; s++) {
        if (excludeId && story[s].id === excludeId) continue;
        var already = false;
        for (var j = 0; j < defs.length; j++) {
            if (defs[j].id === story[s].id) { already = true; break; }
        }
        if (already) continue;
        var selS = selectedId && story[s].id === selectedId ? ' selected' : '';
        html += '<option value="' + escapeAttr(story[s].id) + '"' + selS + '>' +
            escapeHtml(story[s].name) + '</option>';
    }
    sel.innerHTML = html;
}

function fillRangeOptions(selected) {
    var sel = el('qdef-min-range');
    if (!sel) return;
    var html = '<option value="">— bez limitu —</option>';
    for (var i = 0; i < RADIO_RANGE_PRESETS_KM.length; i++) {
        var km = RADIO_RANGE_PRESETS_KM[i];
        var selAttr = selected != null && Number(selected) === km ? ' selected' : '';
        html += '<option value="' + km + '"' + selAttr + '>' + km + ' km</option>';
    }
    sel.innerHTML = html;
}

function fillObjectiveOptions(selected) {
    var sel = el('qdef-objective-type');
    if (!sel) return;
    var html = '';
    for (var key in OBJECTIVE_LABELS) {
        if (!Object.prototype.hasOwnProperty.call(OBJECTIVE_LABELS, key)) continue;
        var selAttr = selected === key ? ' selected' : '';
        html += '<option value="' + key + '"' + selAttr + '>' + OBJECTIVE_LABELS[key] + '</option>';
    }
    sel.innerHTML = html;
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
}

function readForm() {
    var id = val('qdef-id');
    var name = val('qdef-name');
    if (!id && name) {
        id = suggestQuestIdFromName(name, loadDefinitions().map(function(d) { return d.id; }));
    }
    var type = val('qdef-type') === QUEST_TYPE_MAIN ? QUEST_TYPE_MAIN : QUEST_TYPE_SIDE;
    var minRangeRaw = val('qdef-min-range');
    return normalizeQuestDefinition({
        id: id,
        name: name,
        type: type,
        trigger: {
            prerequisiteQuestId: val('qdef-prereq') || null,
            minRadioRangeKm: minRangeRaw === '' ? null : parseFloat(minRangeRaw)
        },
        content: {
            description: val('qdef-desc'),
            objectiveType: val('qdef-objective-type'),
            objectiveText: val('qdef-objective-text')
        },
        rewards: {
            xp: val('qdef-xp'),
            reputation: val('qdef-reputation'),
            unlockFrequency: val('qdef-reward-freq') || null,
            unlockEncryptionKey: val('qdef-reward-key') || null,
            itemName: val('qdef-reward-item') || null
        },
        radio: {
            frequency: val('qdef-radio-freq') || null,
            encryptionKey: val('qdef-radio-key') || null
        },
        geo: {
            lat: val('qdef-lat') || null,
            lng: val('qdef-lng') || null,
            radiusM: val('qdef-radius') || null,
            timeLimitHours: val('qdef-time-limit') || null
        },
        char: val('qdef-char'),
        mapLabel: val('qdef-map-label') || name,
        updatedAt: Date.now(),
        createdAt: editingId
            ? (function() {
                var list = loadDefinitions();
                for (var i = 0; i < list.length; i++) {
                    if (list[i].id === editingId) return list[i].createdAt || Date.now();
                }
                return Date.now();
            })()
            : Date.now()
    });
}

function writeForm(def) {
    var isNew = !def || !asStringSafe(def.id);
    if (isNew) {
        editingId = null;
        def = {
            id: '',
            name: '',
            type: QUEST_TYPE_SIDE,
            trigger: { prerequisiteQuestId: null, minRadioRangeKm: null },
            content: { description: '', objectiveType: 'location', objectiveText: '' },
            rewards: { xp: 0, reputation: 0, unlockFrequency: null, unlockEncryptionKey: null, itemName: null },
            radio: { frequency: null, encryptionKey: null },
            geo: { lat: null, lng: null, radiusM: null, timeLimitHours: null },
            char: '',
            mapLabel: ''
        };
    } else {
        def = normalizeQuestDefinition(def);
        editingId = def.id;
    }
    setVal('qdef-id', def.id);
    setVal('qdef-name', def.name);
    setVal('qdef-type', def.type || QUEST_TYPE_SIDE);
    setVal('qdef-char', def.char || '');
    setVal('qdef-map-label', def.mapLabel || '');
    setVal('qdef-desc', def.content.description || '');
    setVal('qdef-objective-text', def.content.objectiveText || '');
    setVal('qdef-xp', def.rewards.xp || 0);
    setVal('qdef-reputation', def.rewards.reputation || 0);
    setVal('qdef-reward-freq', def.rewards.unlockFrequency || '');
    setVal('qdef-reward-key', def.rewards.unlockEncryptionKey || '');
    setVal('qdef-reward-item', def.rewards.itemName || '');
    setVal('qdef-radio-freq', def.radio.frequency || '');
    setVal('qdef-radio-key', def.radio.encryptionKey || '');
    setVal('qdef-lat', def.geo.lat != null ? def.geo.lat : '');
    setVal('qdef-lng', def.geo.lng != null ? def.geo.lng : '');
    setVal('qdef-radius', def.geo.radiusM != null ? def.geo.radiusM : '');
    setVal('qdef-time-limit', def.geo.timeLimitHours != null ? def.geo.timeLimitHours : '');
    fillObjectiveOptions(def.content.objectiveType);
    fillRangeOptions(def.trigger.minRadioRangeKm);
    fillPrerequisiteOptions(def.trigger.prerequisiteQuestId, def.id || null);
    var idInput = el('qdef-id');
    if (idInput) idInput.readOnly = !!editingId;
    var title = el('qdef-form-title');
    if (title) title.textContent = editingId ? ('✎ ' + (def.name || def.id)) : '＋ Nový quest';
}

function asStringSafe(v) {
    return v == null ? '' : String(v).trim();
}

function renderList() {
    var box = el('qdef-list');
    if (!box) return;
    var defs = loadDefinitions();
    if (!defs.length) {
        box.innerHTML = '<p class="qdef-empty">Zatím žádné definice. Vytvoř první quest níže.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        var typeLabel = d.type === QUEST_TYPE_MAIN ? 'MAIN' : 'SIDE';
        var typeClass = d.type === QUEST_TYPE_MAIN ? 'qdef-badge-main' : 'qdef-badge-side';
        var range = d.trigger.minRadioRangeKm != null ? (d.trigger.minRadioRangeKm + ' km') : '—';
        var prereq = d.trigger.prerequisiteQuestId || '—';
        html += '<div class="qdef-row' + (editingId === d.id ? ' is-active' : '') + '" data-id="' + escapeAttr(d.id) + '">' +
            '<div class="qdef-row-main">' +
            '<span class="qdef-badge ' + typeClass + '">' + typeLabel + '</span> ' +
            '<strong>' + escapeHtml(d.name || d.id) + '</strong>' +
            '<div class="qdef-row-meta">id: ' + escapeHtml(d.id) +
            ' · prerekv.: ' + escapeHtml(prereq) +
            ' · dosah: ' + escapeHtml(range) + '</div>' +
            '</div>' +
            '<div class="qdef-row-actions">' +
            '<button type="button" class="qdef-btn" data-act="edit">Upravit</button>' +
            '<button type="button" class="qdef-btn" data-act="activate">Aktivovat</button>' +
            '<button type="button" class="qdef-btn qdef-btn-danger" data-act="delete">Smazat</button>' +
            '</div></div>';
    }
    box.innerHTML = html;
}

function saveFromForm() {
    var def = readForm();
    if (!def || !def.id) {
        alert('Vyplň ID questu.');
        return;
    }
    if (!def.name) {
        alert('Vyplň název questu.');
        return;
    }
    var list = loadDefinitions();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
        if (list[i].id === def.id) { idx = i; break; }
    }
    if (editingId && editingId !== def.id && idx !== -1) {
        alert('ID „' + def.id + '“ už existuje.');
        return;
    }
    if (idx === -1 && editingId) {
        /* rename id: remove old */
        list = list.filter(function(d) { return d.id !== editingId; });
        def.createdAt = Date.now();
        list.push(def);
    } else if (idx === -1) {
        def.createdAt = Date.now();
        list.push(def);
    } else {
        def.createdAt = list[idx].createdAt || Date.now();
        list[idx] = def;
    }
    saveDefinitions(list);
    editingId = def.id;
    writeForm(def);
    renderList();
    alert('Quest „' + def.name + '“ uložen.');
}

function deleteDefinition(id) {
    if (!id) return;
    if (!confirm('Smazat definici „' + id + '“?')) return;
    var list = loadDefinitions().filter(function(d) { return d.id !== id; });
    saveDefinitions(list);
    if (editingId === id) resetForm();
    renderList();
}

function activateDefinition(id) {
    var def = null;
    var list = loadDefinitions();
    for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { def = list[i]; break; }
    }
    if (!def) return;
    var runtime = definitionToRuntimeQuest(def);
    if (!runtime) return;

    var custom = [];
    try {
        custom = JSON.parse(localStorage.getItem('custom_quests_list') || '[]');
        if (!Array.isArray(custom)) custom = [];
    } catch (e) { custom = []; }

    var exists = false;
    for (var c = 0; c < custom.length; c++) {
        if (custom[c] && custom[c].id === runtime.id) {
            custom[c] = Object.assign({}, custom[c], runtime);
            exists = true;
            break;
        }
    }
    if (!exists) custom.push(runtime);
    try {
        localStorage.setItem('custom_quests_list', JSON.stringify(custom));
    } catch (e2) {}

    if (def.geo.lat != null && def.geo.lng != null) {
        try {
            localStorage.setItem('point_' + def.id + '_lat', String(def.geo.lat));
            localStorage.setItem('point_' + def.id + '_lng', String(def.geo.lng));
        } catch (e3) {}
        if (typeof window.renderPointOnMap === 'function') {
            window.renderPointOnMap(def.id, def.geo.lat, def.geo.lng, def.mapLabel || def.name, def.content.description);
        }
    }

    if (typeof window.syncCommunityQuestsToCloud === 'function') window.syncCommunityQuestsToCloud();
    if (typeof window.renderQuestList === 'function') window.renderQuestList();
    if (typeof window.reloadAllMapPoints === 'function') window.reloadAllMapPoints();
    alert('Quest „' + def.name + '“ aktivován v Úkolech.');
}

function resetForm() {
    editingId = null;
    writeForm(null);
}

function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    var row = e.target.closest('.qdef-row');
    if (!row) return;
    var id = row.getAttribute('data-id');
    if (!id) return;
    var act = btn ? btn.getAttribute('data-act') : 'edit';
    if (act === 'delete') {
        deleteDefinition(id);
        return;
    }
    if (act === 'activate') {
        activateDefinition(id);
        return;
    }
    var list = loadDefinitions();
    for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
            writeForm(list[i]);
            renderList();
            break;
        }
    }
}

function bindUi() {
    if (bound) return;
    bound = true;
    var list = el('qdef-list');
    if (list) list.addEventListener('click', onListClick);
    var saveBtn = el('qdef-save');
    if (saveBtn) saveBtn.addEventListener('click', function(e) {
        e.preventDefault();
        saveFromForm();
    });
    var newBtn = el('qdef-new');
    if (newBtn) newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        resetForm();
        renderList();
    });
    var nameInput = el('qdef-name');
    if (nameInput) {
        nameInput.addEventListener('blur', function() {
            var idInput = el('qdef-id');
            if (!idInput || idInput.readOnly || val('qdef-id')) return;
            var ids = loadDefinitions().map(function(d) { return d.id; });
            setVal('qdef-id', suggestQuestIdFromName(val('qdef-name'), ids));
        });
    }
}

export function refreshQuestAdminUi() {
    bindUi();
    renderList();
    if (!editingId) resetForm();
    else {
        var list = loadDefinitions();
        var found = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === editingId) { found = list[i]; break; }
        }
        if (found) writeForm(found);
        else resetForm();
    }
}

export function initQuestAdminUi() {
    bindUi();
    refreshQuestAdminUi();
}

export function getQuestDefinitions() {
    return loadDefinitions();
}
