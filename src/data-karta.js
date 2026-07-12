/** Data karta — Lore, Postapopedie, Mechanismus hry + vyhledávání od 3 znaků. */

const MIN_QUERY_LEN = 3;

const PANELS = [
    { key: 'lore', file: './src/data/lore.json' },
    { key: 'postapopedie', file: './src/data/postapopedie.json' },
    { key: 'mechanismy', file: './src/data/mechanismy.json' }
];

const store = {
    lore: [],
    postapopedie: [],
    mechanismy: []
};

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function entryHaystack(entry) {
    return normalizeText([
        entry.title,
        (entry.keywords || []).join(' '),
        entry.body
    ].join(' '));
}

function filterEntries(entries, query) {
    var q = normalizeText(query.trim());
    if (q.length < MIN_QUERY_LEN) return entries.slice();
    return entries.filter(function(entry) {
        return entryHaystack(entry).indexOf(q) !== -1;
    });
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function highlightText(text, query) {
    var raw = String(text || '');
    var q = query.trim();
    if (q.length < MIN_QUERY_LEN) return escapeHtml(raw);

    var normText = normalizeText(raw);
    var normQ = normalizeText(q);
    var idx = normText.indexOf(normQ);
    if (idx === -1) return escapeHtml(raw);

    var before = raw.slice(0, idx);
    var match = raw.slice(idx, idx + q.length);
    var after = raw.slice(idx + q.length);
    return escapeHtml(before) + '<mark>' + escapeHtml(match) + '</mark>' + escapeHtml(after);
}

function renderEntry(entry, query, expanded) {
    var openClass = expanded ? ' open' : '';
    var bodyStyle = expanded ? '' : ' style="display:none;"';
    return (
        '<article class="data-karta-entry' + openClass + '" data-entry-id="' + escapeHtml(entry.id) + '">' +
            '<button type="button" class="data-karta-entry-toggle">' +
                highlightText(entry.title, query) +
                '<span class="toggle-icon">▼</span>' +
            '</button>' +
            '<div class="data-karta-entry-body"' + bodyStyle + '>' +
                '<p>' + highlightText(entry.body, query).replace(/\n/g, '<br>') + '</p>' +
            '</div>' +
        '</article>'
    );
}

function renderResults(panelKey, entries, query, expandedId) {
    var container = document.querySelector('.data-karta-results[data-panel="' + panelKey + '"]');
    if (!container) return;

    if (!entries.length) {
        container.innerHTML = '<p class="data-karta-no-results">Žádný záznam neodpovídá „' + escapeHtml(query.trim()) + '“.</p>';
        return;
    }

    container.innerHTML = entries.map(function(entry) {
        return renderEntry(entry, query, expandedId === entry.id);
    }).join('');

    container.querySelectorAll('.data-karta-entry-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var article = btn.closest('.data-karta-entry');
            if (!article) return;
            var body = article.querySelector('.data-karta-entry-body');
            var isOpen = article.classList.contains('open');
            if (isOpen) {
                article.classList.remove('open');
                if (body) body.style.display = 'none';
            } else {
                article.classList.add('open');
                if (body) body.style.display = 'block';
            }
        });
    });
}

function renderSuggest(panelKey, entries, query) {
    var list = document.querySelector('.data-karta-suggest[data-panel="' + panelKey + '"]');
    if (!list) return;

    var q = query.trim();
    if (q.length > 0 && q.length < MIN_QUERY_LEN) {
        list.classList.add('visible');
        list.innerHTML = '<li class="data-karta-hint">Zadej alespoň ' + MIN_QUERY_LEN + ' znaky…</li>';
        return;
    }

    if (q.length < MIN_QUERY_LEN) {
        list.classList.remove('visible');
        list.innerHTML = '';
        return;
    }

    if (!entries.length) {
        list.classList.add('visible');
        list.innerHTML = '<li class="data-karta-hint">Nic nenalezeno.</li>';
        return;
    }

    list.classList.add('visible');
    list.innerHTML = entries.map(function(entry) {
        return (
            '<li role="option" tabindex="0" data-entry-id="' + escapeHtml(entry.id) + '">' +
                highlightText(entry.title, q) +
            '</li>'
        );
    }).join('');

    list.querySelectorAll('li[data-entry-id]').forEach(function(item) {
        function pick() {
            var id = item.getAttribute('data-entry-id');
            var input = document.querySelector('.data-karta-search[data-panel="' + panelKey + '"]');
            if (input) input.value = q;
            renderResults(panelKey, entries, q, id);
            list.classList.remove('visible');
            var target = document.querySelector('.data-karta-results[data-panel="' + panelKey + '"] [data-entry-id="' + id + '"]');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        item.addEventListener('mousedown', function(ev) {
            ev.preventDefault();
            pick();
        });
        item.addEventListener('keydown', function(ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                pick();
            }
        });
    });
}

function onSearchInput(panelKey) {
    var input = document.querySelector('.data-karta-search[data-panel="' + panelKey + '"]');
    if (!input) return;

    var query = input.value;
    var matched = filterEntries(store[panelKey] || [], query);
    renderSuggest(panelKey, matched, query);
    renderResults(panelKey, matched, query, null);
}

function bindSearch(panelKey) {
    var input = document.querySelector('.data-karta-search[data-panel="' + panelKey + '"]');
    var wrap = input && input.closest('.data-karta-search-wrap');
    if (!input || !wrap) return;

    input.addEventListener('input', function() {
        onSearchInput(panelKey);
    });

    input.addEventListener('focus', function() {
        onSearchInput(panelKey);
    });

    input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Escape') {
            var list = document.querySelector('.data-karta-suggest[data-panel="' + panelKey + '"]');
            if (list) list.classList.remove('visible');
        }
    });

    document.addEventListener('click', function(ev) {
        if (!wrap.contains(ev.target)) {
            var list = document.querySelector('.data-karta-suggest[data-panel="' + panelKey + '"]');
            if (list) list.classList.remove('visible');
        }
    });
}

async function loadPanelData(panel) {
    var res = await fetch(panel.file);
    if (!res.ok) throw new Error('Data load failed: ' + panel.file);
    var json = await res.json();
    store[panel.key] = json.entries || [];
}

export async function initDataKarta() {
    await Promise.all(PANELS.map(loadPanelData));

    PANELS.forEach(function(panel) {
        bindSearch(panel.key);
        renderResults(panel.key, store[panel.key], '', null);
    });
}

export function refreshDataKartaPanel(panelKey) {
    if (!store[panelKey]) return;
    onSearchInput(panelKey);
}
