/**
 * Quest Line board — kartičky na příběhové ose Main / Side (admin).
 */
import {
    QUEST_TYPE_MAIN,
    QUEST_TYPE_SIDE,
    normalizeQuestDefinitionList,
    findQuestDefinitionById
} from './questDefinition.js';

var STORAGE_KEY = 'quest_definitions_list';
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

function prereqLabel(prereqId, defs) {
    if (!prereqId) return '';
    var found = findQuestDefinitionById(defs, prereqId);
    if (found) return found.name || found.id;
    return prereqId;
}

/**
 * Seřadí Main questy podle prerekvizit (topologické pořadí).
 */
function orderMainChain(defs) {
    var mains = defs.filter(function(d) { return d.type === QUEST_TYPE_MAIN; });
    var byId = {};
    for (var i = 0; i < mains.length; i++) byId[mains[i].id] = mains[i];

    var depth = {};
    function getDepth(id, stack) {
        if (depth[id] != null) return depth[id];
        stack = stack || {};
        if (stack[id]) return 0;
        stack[id] = true;
        var d = byId[id];
        if (!d) return 0;
        var pre = d.trigger && d.trigger.prerequisiteQuestId;
        if (pre && byId[pre]) {
            depth[id] = getDepth(pre, stack) + 1;
        } else {
            depth[id] = 0;
        }
        return depth[id];
    }
    for (var m = 0; m < mains.length; m++) getDepth(mains[m].id);
    mains.sort(function(a, b) {
        var da = depth[a.id] || 0;
        var db = depth[b.id] || 0;
        if (da !== db) return da - db;
        return (a.name || a.id).localeCompare(b.name || b.id, 'cs');
    });
    return mains;
}

function renderCard(d, defs, isMain) {
    var range = d.trigger.minRadioRangeKm != null ? (d.trigger.minRadioRangeKm + ' km') : '—';
    var sig = d.trigger.signalId || d.trigger.signalFrequency || '—';
    var pre = prereqLabel(d.trigger.prerequisiteQuestId, defs);
    var typeClass = isMain ? 'qline-card-main' : 'qline-card-side';
    return (
        '<article class="qline-card ' + typeClass + '" data-id="' + escapeAttr(d.id) + '" tabindex="0">' +
        '<div class="qline-card-type">' + (isMain ? 'MAIN' : 'SIDE') + '</div>' +
        '<h3 class="qline-card-title">' + escapeHtml(d.name || d.id) + '</h3>' +
        '<div class="qline-card-id">' + escapeHtml(d.id) + '</div>' +
        (d.content && d.content.description
            ? '<p class="qline-card-desc">' + escapeHtml(d.content.description.slice(0, 120)) +
              (d.content.description.length > 120 ? '…' : '') + '</p>'
            : '') +
        '<div class="qline-card-meta">' +
        (pre ? '<span>← ' + escapeHtml(pre) + '</span>' : '<span>kořen</span>') +
        '<span>dosah ' + escapeHtml(range) + '</span>' +
        '<span>' + escapeHtml(sig) + '</span>' +
        '</div>' +
        '<div class="qline-card-actions">' +
        '<button type="button" class="qdef-btn" data-act="edit">Upravit</button>' +
        '<button type="button" class="qdef-btn" data-act="activate">Aktivovat</button>' +
        '</div>' +
        '</article>'
    );
}

function renderAxis(containerId, list, defs, isMain) {
    var box = el(containerId);
    if (!box) return;
    if (!list.length) {
        box.innerHTML = '<p class="qline-empty">' +
            (isMain ? 'Zatím žádné Main questy — založ první níže.' : 'Zatím žádné Side questy.') +
            '</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
        if (isMain && i > 0) html += '<div class="qline-arrow" aria-hidden="true">→</div>';
        html += renderCard(list[i], defs, isMain);
    }
    box.innerHTML = html;
}

export function refreshQuestLineBoard() {
    var defs = loadDefinitions();
    var mains = orderMainChain(defs);
    var sides = defs.filter(function(d) { return d.type === QUEST_TYPE_SIDE; });
    sides.sort(function(a, b) {
        return (a.name || a.id).localeCompare(b.name || b.id, 'cs');
    });
    renderAxis('qline-axis-main', mains, defs, true);
    renderAxis('qline-axis-side', sides, defs, false);
}

function scrollToForm() {
    var form = el('qdef-form-title') || el('quest-definitions-admin');
    if (form && form.scrollIntoView) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function onAxisClick(e) {
    var btn = e.target.closest('[data-act]');
    var card = e.target.closest('.qline-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    if (!id) return;
    var act = btn ? btn.getAttribute('data-act') : 'edit';
    if (act === 'activate') {
        if (typeof window.patracActivateQuestDefinition === 'function') {
            window.patracActivateQuestDefinition(id);
        }
        return;
    }
    if (typeof window.patracOpenQuestDefinition === 'function') {
        window.patracOpenQuestDefinition(id);
    }
    scrollToForm();
}

function bindUi() {
    if (bound) return;
    bound = true;
    var main = el('qline-axis-main');
    var side = el('qline-axis-side');
    if (main) main.addEventListener('click', onAxisClick);
    if (side) side.addEventListener('click', onAxisClick);
    var newBtn = el('qline-btn-new');
    if (newBtn) {
        newBtn.addEventListener('click', function() {
            if (typeof window.patracNewQuestDefinition === 'function') {
                window.patracNewQuestDefinition();
            }
            scrollToForm();
        });
    }
    var refreshBtn = el('qline-btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshQuestLineBoard();
        });
    }
}

export function initQuestLineBoard() {
    bindUi();
    refreshQuestLineBoard();
}
