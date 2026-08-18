/** Data karta — localStorage store (seed ze statických JSON). */

export var DATA_PANELS = [
    { key: 'lore', label: 'Lore', file: './src/data/lore.json' },
    { key: 'postapopedie', label: 'Postapopedie', file: './src/data/postapopedie.json' },
    { key: 'mechanismy', label: 'Mechanismus hry', file: './src/data/mechanismy.json' },
    { key: 'napady', label: 'Schránka nápadů', file: null }
];

var STORAGE_KEY = 'patrac_data_karta_v1';
var _cache = null;

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'zaznam';
}

function normalizeKeywords(raw) {
    if (Array.isArray(raw)) {
        return raw.map(function(k) { return String(k || '').trim(); }).filter(Boolean);
    }
    return String(raw || '')
        .split(/[,;]+/)
        .map(function(k) { return k.trim(); })
        .filter(Boolean);
}

function normalizeTextBlock(block) {
    return {
        type: 'text',
        content: String(block && block.content != null ? block.content : '')
    };
}

function normalizeImageBlock(block) {
    var widthPct = Number(block && block.widthPct);
    if (!isFinite(widthPct) || widthPct < 15) widthPct = 60;
    if (widthPct > 100) widthPct = 100;
    var align = block && block.align;
    if (align !== 'left' && align !== 'right' && align !== 'center') align = 'left';
    return {
        type: 'image',
        src: String(block && block.src || ''),
        widthPct: Math.round(widthPct),
        align: align,
        wrap: !!(block && block.wrap),
        alt: String(block && block.alt || '')
    };
}

export function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = String(raw.id || '').trim();
    var title = String(raw.title || '').trim();
    if (!id || !title) return null;

    var blocks = [];
    if (Array.isArray(raw.blocks) && raw.blocks.length) {
        raw.blocks.forEach(function(block) {
            if (!block || !block.type) return;
            if (block.type === 'image') {
                var img = normalizeImageBlock(block);
                if (img.src) blocks.push(img);
            } else if (block.type === 'text') {
                blocks.push(normalizeTextBlock(block));
            }
        });
    }
    if (!blocks.length && raw.body) {
        blocks.push({ type: 'text', content: String(raw.body) });
    }

    return {
        id: id,
        title: title,
        keywords: normalizeKeywords(raw.keywords),
        blocks: blocks
    };
}

function normalizePanelEntries(entries) {
    var out = [];
    var seen = {};
    (entries || []).forEach(function(entry) {
        var norm = normalizeEntry(entry);
        if (!norm || seen[norm.id]) return;
        seen[norm.id] = true;
        out.push(norm);
    });
    return out;
}

function emptyStore() {
    var panels = {};
    DATA_PANELS.forEach(function(panel) {
        panels[panel.key] = [];
    });
    return { version: 1, panels: panels };
}

function readStore() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.panels) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function writeStore(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
        console.warn('[dataContentStore] save', e);
    }
}

async function fetchPanelSeed(panel) {
    if (!panel.file) return [];
    var res = await fetch(panel.file);
    if (!res.ok) throw new Error('Data load failed: ' + panel.file);
    var json = await res.json();
    return normalizePanelEntries(json.entries || []);
}

export function suggestEntryId(title, existingIds) {
    var base = slugify(title);
    var ids = existingIds || [];
    if (ids.indexOf(base) === -1) return base;
    var n = 2;
    while (ids.indexOf(base + '-' + n) !== -1) n++;
    return base + '-' + n;
}

export async function loadDataContentStore(forceReseed) {
    if (_cache && !forceReseed) return _cache;

    var stored = forceReseed ? null : readStore();
    if (stored && stored.panels) {
        var normalized = emptyStore();
        DATA_PANELS.forEach(function(panel) {
            normalized.panels[panel.key] = normalizePanelEntries(stored.panels[panel.key]);
        });
        _cache = normalized;
        return _cache;
    }

    var seeded = emptyStore();
    await Promise.all(DATA_PANELS.map(async function(panel) {
        if (!panel.file) return;
        try {
            seeded.panels[panel.key] = await fetchPanelSeed(panel);
        } catch (e) {
            console.warn('[dataContentStore] seed', panel.key, e);
            seeded.panels[panel.key] = [];
        }
    }));
    _cache = seeded;
    writeStore(_cache);
    return _cache;
}

export function getPanelEntries(panelKey) {
    if (!_cache || !_cache.panels) return [];
    return (_cache.panels[panelKey] || []).slice();
}

export function getAllPanelEntries() {
    var out = {};
    DATA_PANELS.forEach(function(panel) {
        out[panel.key] = getPanelEntries(panel.key);
    });
    return out;
}

export function savePanelEntries(panelKey, entries) {
    if (!_cache) _cache = emptyStore();
    _cache.panels[panelKey] = normalizePanelEntries(entries);
    writeStore(_cache);
    return _cache.panels[panelKey];
}

export function upsertPanelEntry(panelKey, entry) {
    var norm = normalizeEntry(entry);
    if (!norm) return null;
    var list = getPanelEntries(panelKey);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
        if (list[i].id === norm.id) {
            idx = i;
            break;
        }
    }
    if (idx === -1) list.push(norm);
    else list[idx] = norm;
    savePanelEntries(panelKey, list);
    return norm;
}

export function deletePanelEntry(panelKey, entryId) {
    var list = getPanelEntries(panelKey).filter(function(entry) {
        return entry.id !== entryId;
    });
    savePanelEntries(panelKey, list);
    return list;
}

export function movePanelEntry(panelKey, entryId, delta) {
    var list = getPanelEntries(panelKey).slice();
    var idx = -1;
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === entryId) {
            idx = i;
            break;
        }
    }
    if (idx < 0) return list;
    var newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= list.length) return list;
    var tmp = list[newIdx];
    list[newIdx] = list[idx];
    list[idx] = tmp;
    savePanelEntries(panelKey, list);
    return list;
}

export function entrySearchHaystack(entry) {
    var parts = [entry.title, (entry.keywords || []).join(' ')];
    (entry.blocks || []).forEach(function(block) {
        if (block.type === 'text') parts.push(block.content);
        if (block.type === 'image') parts.push(block.alt);
    });
    return parts.join(' ');
}
