/**
 * Admin UI — Quest Line Editor (katalog definic).
 */
import {
    QUEST_TYPE_MAIN,
    QUEST_TYPE_SIDE,
    OBJECTIVE_LABELS,
    RADIO_RANGE_PRESETS_KM,
    normalizeQuestDefinition,
    normalizeQuestDefinitionList,
    suggestQuestIdFromName,
    definitionToRuntimeQuest,
    findQuestDefinitionById
} from './questDefinition.js';

var STORAGE_KEY = 'quest_definitions_list';
var editingId = null;
var listFilter = 'all';
var bound = false;
var mgrsMod = null;

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
    }
    if (typeof window.patracRefreshQuestLine === 'function') {
        try { window.patracRefreshQuestLine(); } catch (e2) {}
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

function storyPrereqOptions() {
    return [
        { id: 'roxy', name: 'Útočiště (Roxy)' },
        { id: 'sef', name: 'Zdroj vody (Šéf)' },
        { id: 'herbert', name: 'Lesní sklad (Herbert)' },
        { id: 'ino', name: 'Cvičiště (Ino)' },
        { id: 'adam', name: 'Rozhledna (Adam)' }
    ];
}

function resolvePrereqLabel(prereqId, defs) {
    if (!prereqId) return '—';
    var found = findQuestDefinitionById(defs, prereqId);
    if (found) return found.name || found.id;
    var story = storyPrereqOptions();
    for (var i = 0; i < story.length; i++) {
        if (story[i].id === prereqId) return story[i].name;
    }
    return prereqId;
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
    var story = storyPrereqOptions();
    for (var s = 0; s < story.length; s++) {
        if (excludeId && story[s].id === excludeId) continue;
        var already = !!findQuestDefinitionById(defs, story[s].id);
        if (already) continue;
        var selS = selectedId && story[s].id === selectedId ? ' selected' : '';
        html += '<option value="' + escapeAttr(story[s].id) + '"' + selS + '>' +
            escapeHtml(story[s].name) + '</option>';
    }
    sel.innerHTML = html;
}

function fillRangeSelect(selId, selected, includeEmpty) {
    var sel = el(selId);
    if (!sel) return;
    var html = includeEmpty ? '<option value="">— bez limitu —</option>' : '';
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

function collectMapPoints() {
    var points = [];
    var storyIds = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    var labels = {
        roxy: 'Útočiště',
        sef: 'Zdroj vody',
        herbert: 'Lesní sklad',
        ino: 'Cvičiště',
        adam: 'Rozhledna'
    };
    for (var i = 0; i < storyIds.length; i++) {
        var id = storyIds[i];
        var lat = parseFloat(localStorage.getItem('point_' + id + '_lat'));
        var lng = parseFloat(localStorage.getItem('point_' + id + '_lng'));
        if (isFinite(lat) && isFinite(lng)) {
            points.push({ id: id, name: labels[id] || id, lat: lat, lng: lng });
        }
    }
    try {
        var custom = JSON.parse(localStorage.getItem('custom_quests_list') || '[]');
        if (Array.isArray(custom)) {
            for (var c = 0; c < custom.length; c++) {
                var q = custom[c];
                if (!q || !q.id) continue;
                var clat = parseFloat(localStorage.getItem('point_' + q.id + '_lat'));
                var clng = parseFloat(localStorage.getItem('point_' + q.id + '_lng'));
                if (!isFinite(clat) || !isFinite(clng)) continue;
                points.push({
                    id: q.id,
                    name: q.mapLabel || q.title || q.id,
                    lat: clat,
                    lng: clng
                });
            }
        }
    } catch (e) {}
    try {
        var pois = JSON.parse(localStorage.getItem('map_free_pois') || '[]');
        if (Array.isArray(pois)) {
            for (var p = 0; p < pois.length; p++) {
                var poi = pois[p];
                if (!poi || !poi.id || !isFinite(poi.lat) || !isFinite(poi.lng)) continue;
                points.push({
                    id: poi.id,
                    name: poi.name || poi.id,
                    lat: poi.lat,
                    lng: poi.lng
                });
            }
        }
    } catch (e2) {}
    return points;
}

function fillMapPointOptions(selectedId) {
    var sel = el('qdef-map-point');
    if (!sel) return;
    var points = collectMapPoints();
    var html = '<option value="">— žádný / ruční souřadnice —</option>';
    for (var i = 0; i < points.length; i++) {
        var pt = points[i];
        var selAttr = selectedId && pt.id === selectedId ? ' selected' : '';
        html += '<option value="' + escapeAttr(pt.id) + '"' + selAttr +
            ' data-lat="' + pt.lat + '" data-lng="' + pt.lng + '">' +
            escapeHtml(pt.name) + ' (' + escapeHtml(pt.id) + ')</option>';
    }
    sel.innerHTML = html;
}

function applyMapPointSelection() {
    var sel = el('qdef-map-point');
    if (!sel || !sel.value) return;
    var opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    var lat = opt.getAttribute('data-lat');
    var lng = opt.getAttribute('data-lng');
    if (lat != null) setVal('qdef-lat', lat);
    if (lng != null) setVal('qdef-lng', lng);
    fillMgrsFromLatLng();
}

function ensureMgrsMod(cb) {
    if (mgrsMod) {
        cb(mgrsMod);
        return;
    }
    var importer = typeof window.patracImport === 'function' ? window.patracImport : null;
    if (!importer) {
        cb(null);
        return;
    }
    importer('map/mgrsGrid.js').then(function(mod) {
        mgrsMod = mod;
        cb(mod);
    }).catch(function() {
        cb(null);
    });
}

function fillMgrsFromLatLng() {
    var lat = parseFloat(val('qdef-lat'));
    var lng = parseFloat(val('qdef-lng'));
    if (!isFinite(lat) || !isFinite(lng)) {
        alert('Nejdřív vyplň LAT a LNG.');
        return;
    }
    ensureMgrsMod(function(mod) {
        if (!mod || typeof mod.mgrsAtLatLng !== 'function') {
            alert('MGRS modul není dostupný.');
            return;
        }
        setVal('qdef-mgrs', mod.mgrsAtLatLng(lat, lng, 5) || '');
    });
}

function readForm() {
    var id = val('qdef-id');
    var name = val('qdef-name');
    if (!id && name) {
        id = suggestQuestIdFromName(name, loadDefinitions().map(function(d) { return d.id; }));
    }
    var type = val('qdef-type') === QUEST_TYPE_MAIN ? QUEST_TYPE_MAIN : QUEST_TYPE_SIDE;
    var minRangeRaw = val('qdef-min-range');
    var rewardRangeRaw = val('qdef-reward-range');
    return normalizeQuestDefinition({
        id: id,
        name: name,
        type: type,
        trigger: {
            prerequisiteQuestId: val('qdef-prereq') || null,
            minRadioRangeKm: minRangeRaw === '' ? null : parseFloat(minRangeRaw),
            signalId: val('qdef-signal-id') || null,
            signalFrequency: val('qdef-signal-freq') || null
        },
        content: {
            description: val('qdef-desc'),
            objectiveType: val('qdef-objective-type'),
            objectiveText: val('qdef-objective-text'),
            dispatchText: val('qdef-dispatch'),
            applySignalGarble: !!(el('qdef-garble') && el('qdef-garble').checked)
        },
        rewards: {
            xp: val('qdef-xp'),
            reputation: val('qdef-reputation'),
            unlockFrequency: val('qdef-reward-freq') || null,
            unlockEncryptionKey: val('qdef-reward-key') || null,
            itemName: val('qdef-reward-item') || null,
            unlockRangeKm: rewardRangeRaw === '' ? null : parseFloat(rewardRangeRaw),
            consequencesNote: val('qdef-consequences') || null
        },
        radio: {
            frequency: val('qdef-radio-freq') || null,
            encryptionKey: val('qdef-radio-key') || null
        },
        geo: {
            lat: val('qdef-lat') || null,
            lng: val('qdef-lng') || null,
            mgrs: val('qdef-mgrs') || null,
            mapPointId: val('qdef-map-point') || null,
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
            trigger: {
                prerequisiteQuestId: null,
                minRadioRangeKm: null,
                signalId: null,
                signalFrequency: null
            },
            content: {
                description: '',
                objectiveType: 'location',
                objectiveText: '',
                dispatchText: '',
                applySignalGarble: true
            },
            rewards: {
                xp: 0,
                reputation: 0,
                unlockFrequency: null,
                unlockEncryptionKey: null,
                itemName: null,
                unlockRangeKm: null,
                consequencesNote: null
            },
            radio: { frequency: null, encryptionKey: null },
            geo: {
                lat: null,
                lng: null,
                mgrs: null,
                mapPointId: null,
                radiusM: null,
                timeLimitHours: null
            },
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
    setVal('qdef-dispatch', def.content.dispatchText || '');
    var garbleCb = el('qdef-garble');
    if (garbleCb) garbleCb.checked = def.content.applySignalGarble !== false;
    setVal('qdef-signal-id', def.trigger.signalId || '');
    setVal('qdef-signal-freq', def.trigger.signalFrequency || '');
    setVal('qdef-xp', def.rewards.xp || 0);
    setVal('qdef-reputation', def.rewards.reputation || 0);
    setVal('qdef-reward-freq', def.rewards.unlockFrequency || '');
    setVal('qdef-reward-key', def.rewards.unlockEncryptionKey || '');
    setVal('qdef-reward-item', def.rewards.itemName || '');
    setVal('qdef-consequences', def.rewards.consequencesNote || '');
    setVal('qdef-radio-freq', def.radio.frequency || '');
    setVal('qdef-radio-key', def.radio.encryptionKey || '');
    setVal('qdef-lat', def.geo.lat != null ? def.geo.lat : '');
    setVal('qdef-lng', def.geo.lng != null ? def.geo.lng : '');
    setVal('qdef-mgrs', def.geo.mgrs || '');
    setVal('qdef-radius', def.geo.radiusM != null ? def.geo.radiusM : '');
    setVal('qdef-time-limit', def.geo.timeLimitHours != null ? def.geo.timeLimitHours : '');
    fillObjectiveOptions(def.content.objectiveType);
    fillRangeSelect('qdef-min-range', def.trigger.minRadioRangeKm, true);
    fillRangeSelect('qdef-reward-range', def.rewards.unlockRangeKm, true);
    fillPrerequisiteOptions(def.trigger.prerequisiteQuestId, def.id || null);
    fillMapPointOptions(def.geo.mapPointId);
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
    var countEl = el('qdef-count');
    if (!box) {
        if (typeof window.patracRefreshQuestLine === 'function') {
            try { window.patracRefreshQuestLine(); } catch (e) {}
        }
        return;
    }
    var defs = loadDefinitions();
    var filtered = defs.filter(function(d) {
        if (listFilter === 'main') return d.type === QUEST_TYPE_MAIN;
        if (listFilter === 'side') return d.type === QUEST_TYPE_SIDE;
        return true;
    });
    if (countEl) {
        countEl.textContent = filtered.length + ' / ' + defs.length;
    }
    if (!defs.length) {
        box.innerHTML = '<p class="qdef-empty">Zatím žádné definice. Vytvoř první quest níže.</p>';
        return;
    }
    if (!filtered.length) {
        box.innerHTML = '<p class="qdef-empty">Žádné questy v tomto filtru.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
        var d = filtered[i];
        var typeLabel = d.type === QUEST_TYPE_MAIN ? 'MAIN' : 'SIDE';
        var typeClass = d.type === QUEST_TYPE_MAIN ? 'qdef-badge-main' : 'qdef-badge-side';
        var range = d.trigger.minRadioRangeKm != null ? (d.trigger.minRadioRangeKm + ' km') : '—';
        var prereqId = d.trigger.prerequisiteQuestId || '';
        var prereqLabel = resolvePrereqLabel(prereqId, defs);
        var sig = d.trigger.signalId || d.trigger.signalFrequency || '—';
        var mgrs = d.geo.mgrs || '—';
        html += '<div class="qdef-row' + (editingId === d.id ? ' is-active' : '') + '" data-id="' + escapeAttr(d.id) + '">' +
            '<div class="qdef-row-main">' +
            '<span class="qdef-badge ' + typeClass + '">' + typeLabel + '</span> ' +
            '<strong>' + escapeHtml(d.name || d.id) + '</strong>' +
            '<div class="qdef-row-meta">id: ' + escapeHtml(d.id) +
            ' · dosah: ' + escapeHtml(range) +
            ' · signál: ' + escapeHtml(sig) +
            ' · MGRS: ' + escapeHtml(mgrs) + '</div>' +
            '<div class="qdef-row-meta">prerekv.: ' +
            (prereqId
                ? ('<button type="button" class="qdef-link" data-act="goto-prereq" data-prereq="' +
                    escapeAttr(prereqId) + '">' + escapeHtml(prereqLabel) + '</button>')
                : '—') +
            '</div>' +
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
    var def = findQuestDefinitionById(loadDefinitions(), id);
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
            window.renderPointOnMap(
                def.id,
                def.geo.lat,
                def.geo.lng,
                def.mapLabel || def.name,
                def.content.description
            );
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

function openDefinition(id) {
    var def = findQuestDefinitionById(loadDefinitions(), id);
    if (!def) {
        /* story prereq bez definice — jen info */
        alert('„' + id + '“ není v katalogu definic (story quest / jiný odkaz).');
        return;
    }
    writeForm(def);
    renderList();
    var form = el('qdef-form-title');
    if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    var row = e.target.closest('.qdef-row');
    if (!btn && !row) return;
    var act = btn ? btn.getAttribute('data-act') : 'edit';
    if (act === 'goto-prereq') {
        e.preventDefault();
        openDefinition(btn.getAttribute('data-prereq'));
        return;
    }
    if (!row) return;
    var id = row.getAttribute('data-id');
    if (!id) return;
    if (act === 'delete') {
        deleteDefinition(id);
        return;
    }
    if (act === 'activate') {
        activateDefinition(id);
        return;
    }
    openDefinition(id);
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
    var filter = el('qdef-filter-type');
    if (filter) {
        filter.value = listFilter;
        filter.addEventListener('change', function() {
            listFilter = filter.value || 'all';
            renderList();
        });
    }
    var mapPoint = el('qdef-map-point');
    if (mapPoint) {
        mapPoint.addEventListener('change', applyMapPointSelection);
    }
    var mgrsBtn = el('qdef-mgrs-fill');
    if (mgrsBtn) {
        mgrsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            fillMgrsFromLatLng();
        });
    }
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
    var filter = el('qdef-filter-type');
    if (filter) filter.value = listFilter;
    renderList();
    if (!editingId) resetForm();
    else {
        var found = findQuestDefinitionById(loadDefinitions(), editingId);
        if (found) writeForm(found);
        else resetForm();
    }
    if (typeof window.patracRefreshQuestLine === 'function') {
        try { window.patracRefreshQuestLine(); } catch (e) {}
    }
}

export function initQuestAdminUi() {
    bindUi();
    window.patracOpenQuestDefinition = function(id) {
        openDefinition(id);
    };
    window.patracNewQuestDefinition = function() {
        resetForm();
        renderList();
    };
    window.patracActivateQuestDefinition = function(id) {
        activateDefinition(id);
    };
    refreshQuestAdminUi();
}

export function getQuestDefinitions() {
    return loadDefinitions();
}
