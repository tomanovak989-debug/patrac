/**
 * Záložka Gridy — automatický sešit MGRS bodů a tras.
 * Stránky: 1) trvalé poziční body → 2) body BOD+ → 3+) trasy (název + body 1…N).
 */
import { mgrsAtLatLng } from '../map/mgrsGrid.js';
import { NOTEBOOK_LINES_PER_PAGE } from './radioComms.js';

var STORY_IDS = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
var STORY_FALLBACK = {
    roxy: 'ROXY',
    sef: 'ŠÉF',
    herbert: 'HERBERT',
    ino: 'INO',
    adam: 'ADAM'
};

function safeJson(key, fallback) {
    try {
        var raw = localStorage.getItem(key);
        if (!raw) return fallback;
        var v = JSON.parse(raw);
        return v != null ? v : fallback;
    } catch (e) {
        return fallback;
    }
}

function fmtMgrs(lat, lng) {
    if (lat == null || lng == null || !isFinite(lat) || !isFinite(lng)) return '—';
    try {
        return mgrsAtLatLng(lat, lng, 5) || '—';
    } catch (e) {
        return '—';
    }
}

function pointLabel(id) {
    if (typeof window.getQuestMapLabel === 'function') {
        try {
            var lab = window.getQuestMapLabel(id);
            if (lab) return String(lab).toUpperCase();
        } catch (e) {}
    }
    if (STORY_FALLBACK[id]) return STORY_FALLBACK[id];
    return String(id || 'BOD').toUpperCase();
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function makeRow(label, mgrs) {
    var name = String(label || 'BOD').trim() || 'BOD';
    var coord = String(mgrs || '—').trim();
    var text = name + '  ' + coord;
    return { kind: 'point', text: text, copyText: text, label: name, mgrs: coord };
}

function makeHeader(title) {
    return { kind: 'header', text: '── ' + title + ' ──', copyText: title, label: title, mgrs: '' };
}

function makeEmpty(msg) {
    return { kind: 'empty', text: msg || '— žádné —', copyText: '', label: '', mgrs: '' };
}

/** Trvalé poziční body = prvotní + vlastní/náhodné úkoly s uloženou polohou (ne BOD+). */
function collectPermanentPoints() {
    var rows = [];
    var i;
    for (i = 0; i < STORY_IDS.length; i++) {
        var id = STORY_IDS[i];
        var lat = parseFloat(localStorage.getItem('point_' + id + '_lat'));
        var lng = parseFloat(localStorage.getItem('point_' + id + '_lng'));
        if (isFinite(lat) && isFinite(lng)) {
            rows.push(makeRow(pointLabel(id), fmtMgrs(lat, lng)));
        }
    }
    var custom = safeJson('custom_quests_list', []);
    for (i = 0; i < custom.length; i++) {
        var cq = custom[i];
        if (!cq || !cq.id) continue;
        var latC = parseFloat(localStorage.getItem('point_' + cq.id + '_lat'));
        var lngC = parseFloat(localStorage.getItem('point_' + cq.id + '_lng'));
        if (isFinite(latC) && isFinite(lngC)) {
            rows.push(makeRow(cq.mapLabel || cq.title || cq.id, fmtMgrs(latC, lngC)));
        }
    }
    var random = safeJson('random_quests_list', []);
    if (Array.isArray(random)) {
        for (i = 0; i < random.length; i++) {
            var rq = random[i];
            if (!rq || !rq.id) continue;
            var latR = parseFloat(localStorage.getItem('point_' + rq.id + '_lat'));
            var lngR = parseFloat(localStorage.getItem('point_' + rq.id + '_lng'));
            if (isFinite(latR) && isFinite(lngR)) {
                rows.push(makeRow(rq.mapLabel || rq.title || rq.id, fmtMgrs(latR, lngR)));
            }
        }
    }
    return rows;
}

function collectFreePois() {
    var pois = safeJson('map_free_pois', []);
    var rows = [];
    for (var i = 0; i < pois.length; i++) {
        var p = pois[i];
        if (!p) continue;
        rows.push(makeRow(p.name || ('BOD ' + (i + 1)), fmtMgrs(p.lat, p.lng)));
    }
    return rows;
}

function routeVertexList(route) {
    var pts = [];
    if (route.start && isFinite(route.start.lat) && isFinite(route.start.lng)) {
        pts.push(route.start);
    }
    var wps = Array.isArray(route.waypoints) ? route.waypoints : [];
    for (var i = 0; i < wps.length; i++) {
        if (wps[i] && isFinite(wps[i].lat) && isFinite(wps[i].lng)) pts.push(wps[i]);
    }
    if (route.target && isFinite(route.target.lat) && isFinite(route.target.lng)) {
        pts.push(route.target);
    }
    return pts;
}

function collectRouteBlocks() {
    var routes = safeJson('patrac_topo_routes', []);
    var blocks = [];
    for (var i = 0; i < routes.length; i++) {
        var r = routes[i];
        if (!r) continue;
        var name = (r.name || ('Trasa ' + (i + 1))).trim();
        var verts = routeVertexList(r);
        var rows = [makeHeader(name)];
        if (!verts.length) {
            rows.push(makeEmpty('— trasa bez bodů —'));
        } else {
            for (var v = 0; v < verts.length; v++) {
                rows.push(makeRow(String(v + 1), fmtMgrs(verts[v].lat, verts[v].lng)));
            }
        }
        blocks.push({ title: name, rows: rows });
    }
    return blocks;
}

/**
 * Sbalí řádky do stránek (každá stránka začíná nadpisem sekce).
 * linesPerPage zahrnuje i řádek nadpisu.
 */
function packSectionPages(sectionTitle, rows, linesPerPage) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var pages = [];
    var body = rows && rows.length ? rows.slice() : [makeEmpty('— žádné —')];
    var capacity = Math.max(1, linesPerPage - 1);
    var offset = 0;
    var part = 1;
    while (offset < body.length) {
        var chunk = body.slice(offset, offset + capacity);
        var title = part === 1 ? sectionTitle : (sectionTitle + ' (' + part + ')');
        pages.push({
            section: sectionTitle,
            title: title,
            rows: [makeHeader(title)].concat(chunk)
        });
        offset += capacity;
        part++;
    }
    return pages;
}

/**
 * Sestaví všechny stránky Gridů (živě z localStorage).
 * @returns {{ pages: Array<{title, section, rows}>, pageCount: number }}
 */
export function buildGridBook(linesPerPage) {
    linesPerPage = linesPerPage || NOTEBOOK_LINES_PER_PAGE;
    var pages = [];

    pages = pages.concat(packSectionPages('TRVALÉ BODY', collectPermanentPoints(), linesPerPage));
    pages = pages.concat(packSectionPages('BODY (BOD+)', collectFreePois(), linesPerPage));

    var routeBlocks = collectRouteBlocks();
    if (!routeBlocks.length) {
        pages = pages.concat(packSectionPages('TRASY', [], linesPerPage));
    } else {
        for (var r = 0; r < routeBlocks.length; r++) {
            var block = routeBlocks[r];
            var routeRows = block.rows.slice(1);
            if (!routeRows.length) {
                pages.push({
                    section: 'TRASY',
                    title: 'TRASA: ' + block.title,
                    rows: [makeHeader('TRASA: ' + block.title), makeEmpty('— trasa bez bodů —')]
                });
                continue;
            }
            var capacity = Math.max(1, linesPerPage - 1);
            var offset = 0;
            var part = 1;
            while (offset < routeRows.length) {
                var chunk = routeRows.slice(offset, offset + capacity);
                var title = part === 1
                    ? ('TRASA: ' + block.title)
                    : ('TRASA: ' + block.title + ' (' + part + ')');
                pages.push({
                    section: 'TRASY',
                    title: title,
                    rows: [makeHeader(title)].concat(chunk)
                });
                offset += capacity;
                part++;
            }
        }
    }

    return { pages: pages, pageCount: Math.max(1, pages.length) };
}

export function getGridPageCount(linesPerPage) {
    return buildGridBook(linesPerPage).pageCount;
}

export function getGridPage(pageIndex, linesPerPage) {
    var book = buildGridBook(linesPerPage);
    var idx = Math.max(0, Math.min(pageIndex || 0, book.pageCount - 1));
    return book.pages[idx] || { title: 'Gridy', section: '', rows: [makeEmpty()] };
}

/** HTML jedné stránky Gridů (řádky + tlačítko kopírovat). */
export function renderGridPageHtml(page) {
    if (!page || !page.rows || !page.rows.length) {
        return '<p class="radio-notebook-empty">Gridy — zatím bez bodů a tras.</p>';
    }
    var html = '';
    for (var i = 0; i < page.rows.length; i++) {
        var row = page.rows[i];
        if (row.kind === 'header' || row.kind === 'empty') {
            html += '<div class="radio-notebook-line radio-grid-line radio-grid-' + row.kind + '">' +
                escapeHtml(row.text) + '</div>';
            continue;
        }
        html += '<div class="radio-notebook-line radio-grid-line radio-grid-point">' +
            '<span class="radio-grid-text">' + escapeHtml(row.text) + '</span>' +
            '<button type="button" class="radio-grid-copy map-float-hit" title="Kopírovat řádek" ' +
            'aria-label="Kopírovat" data-copy="' + escapeHtml(row.copyText) + '">⧉</button>' +
            '</div>';
    }
    return html;
}

export async function copyGridLineText(text) {
    var t = String(text || '');
    if (!t) return false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(t);
            return true;
        }
    } catch (e) {}
    try {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
    } catch (e2) {
        return false;
    }
}
