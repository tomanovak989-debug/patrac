/** Data karta — Lore, Postapopedie, Mechanismus hry + vyhledávání od 3 znaků. */

import {
    DATA_PANELS,
    loadDataContentStore,
    getPanelEntries,
    entrySearchHaystack
} from './data/dataContentStore.js';

const MIN_QUERY_LEN = 3;

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function entryHaystack(entry) {
    return normalizeText(entrySearchHaystack(entry));
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

function renderImageBlock(block) {
    var widthPct = Math.max(15, Math.min(100, Number(block.widthPct) || 60));
    var align = block.align === 'right' || block.align === 'center' ? block.align : 'left';
    var wrapClass = block.wrap ? ' data-karta-img-wrap' : '';
    var floatStyle = '';
    if (block.wrap && align === 'left') floatStyle = ' style="float:left;margin:0 12px 8px 0;"';
    else if (block.wrap && align === 'right') floatStyle = ' style="float:right;margin:0 0 8px 12px;"';
    else if (align === 'center') floatStyle = ' style="display:block;margin:8px auto;"';

    return (
        '<figure class="data-karta-img' + wrapClass + ' data-karta-img-' + align + '"' + floatStyle + '>' +
            '<img src="' + escapeHtml(block.src) + '" alt="' + escapeHtml(block.alt || '') + '" ' +
                'style="width:' + widthPct + '%;max-width:100%;height:auto;">' +
            (block.alt ? '<figcaption>' + escapeHtml(block.alt) + '</figcaption>' : '') +
        '</figure>'
    );
}

function renderEntryBody(entry, query) {
    var blocks = entry.blocks || [];
    if (!blocks.length && entry.body) {
        blocks = [{ type: 'text', content: entry.body }];
    }
    if (!blocks.length) {
        return '<p class="data-karta-empty-body">—</p>';
    }

    var html = '<div class="data-karta-entry-content">';
    blocks.forEach(function(block) {
        if (block.type === 'image' && block.src) {
            html += renderImageBlock(block);
        } else if (block.type === 'text') {
            html += '<p>' + highlightText(block.content, query).replace(/\n/g, '<br>') + '</p>';
        }
    });
    html += '<div class="data-karta-clear"></div></div>';
    return html;
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
                renderEntryBody(entry, query) +
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
    var matched = filterEntries(getPanelEntries(panelKey), query);
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

function refreshAllPanels() {
    DATA_PANELS.forEach(function(panel) {
        onSearchInput(panel.key);
    });
}

export async function initDataKarta() {
    await loadDataContentStore();

    DATA_PANELS.forEach(function(panel) {
        bindSearch(panel.key);
        renderResults(panel.key, getPanelEntries(panel.key), '', null);
    });

    window.patracRefreshDataKarta = refreshAllPanels;
}

export function refreshDataKartaPanel(panelKey) {
    onSearchInput(panelKey);
}

export function refreshDataKarta() {
    refreshAllPanels();
}
