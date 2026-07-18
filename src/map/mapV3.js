/**
 * Mapa V3 — ikony bodů, kategorie, filtr vrstev.
 */

export const MAP_FILTER_STORAGE = 'patrac_map_layer_filter';

export const STORY_POINT_ICONS = {
    roxy: { label: 'Útočiště', color: '#2196F3', glyph: 'shelter' },
    sef: { label: 'Zdroj vody', color: '#00bcd4', glyph: 'water' },
    herbert: { label: 'Lesní sklad', color: '#4CAF50', glyph: 'warehouse' },
    ino: { label: 'Cvičiště', color: '#FFC107', glyph: 'training' },
    adam: { label: 'Rozhledna', color: '#FF5722', glyph: 'lookout' }
};

export function defaultMapLayerFilter() {
    return { permanent: true, custom: true, pocta: true };
}

export function loadMapLayerFilter() {
    try {
        var raw = localStorage.getItem(MAP_FILTER_STORAGE);
        if (raw) {
            var parsed = JSON.parse(raw);
            return {
                permanent: parsed.permanent !== false,
                custom: parsed.custom !== false,
                pocta: parsed.pocta !== false
            };
        }
    } catch (e) {}
    return defaultMapLayerFilter();
}

export function saveMapLayerFilter(filter) {
    try {
        localStorage.setItem(MAP_FILTER_STORAGE, JSON.stringify(filter));
    } catch (e) {}
}

/** Smírčí kříž — HTML pro UI a markery. */
export function poctaCrossHtml(size) {
    size = size || 'md';
    return '<span class="pocta-cross-icon pocta-cross-' + size + '" aria-hidden="true"></span>';
}

function svgWrap(inner, color) {
    return '<svg class="map-v3-glyph" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
}

function glyphSvg(glyph, color) {
    color = color || '#4af626';
    if (glyph === 'shelter') {
        return svgWrap(
            '<path d="M16 4 L28 14 V26 H4 V14 Z" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<rect x="12" y="18" width="8" height="8" fill="' + color + '" opacity="0.35"/>',
            color
        );
    }
    if (glyph === 'water') {
        return svgWrap(
            '<path d="M16 6 C16 6 8 16 8 21 a8 8 0 0 0 16 0 C24 16 16 6 16 6 Z" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<path d="M12 20 Q16 24 20 20" fill="none" stroke="' + color + '" stroke-width="1.5" opacity="0.7"/>',
            color
        );
    }
    if (glyph === 'warehouse') {
        return svgWrap(
            '<rect x="6" y="12" width="20" height="14" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<path d="M6 12 L16 6 L26 12" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<rect x="13" y="18" width="6" height="8" fill="' + color + '" opacity="0.4"/>',
            color
        );
    }
    if (glyph === 'training') {
        return svgWrap(
            '<circle cx="16" cy="16" r="10" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<circle cx="16" cy="16" r="2" fill="' + color + '"/>' +
            '<line x1="16" y1="6" x2="16" y2="10" stroke="' + color + '" stroke-width="2"/>' +
            '<line x1="16" y1="22" x2="16" y2="26" stroke="' + color + '" stroke-width="2"/>' +
            '<line x1="6" y1="16" x2="10" y2="16" stroke="' + color + '" stroke-width="2"/>' +
            '<line x1="22" y1="16" x2="26" y2="16" stroke="' + color + '" stroke-width="2"/>',
            color
        );
    }
    if (glyph === 'lookout') {
        return svgWrap(
            '<rect x="14" y="8" width="4" height="18" fill="' + color + '" opacity="0.5"/>' +
            '<rect x="8" y="10" width="16" height="4" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<path d="M10 14 L16 22 L22 14" fill="none" stroke="' + color + '" stroke-width="2"/>',
            color
        );
    }
    if (glyph === 'custom') {
        return svgWrap(
            '<path d="M16 4 C11 4 8 10 8 14 C8 22 16 28 16 28 S24 22 24 14 C24 10 21 4 16 4 Z" fill="none" stroke="' + color + '" stroke-width="2"/>' +
            '<circle cx="16" cy="14" r="3" fill="' + color + '" opacity="0.5"/>',
            color
        );
    }
    if (glyph === 'pocta') {
        return '<span class="pocta-cross-icon pocta-cross-map" aria-hidden="true"></span>';
    }
    if (glyph === 'quest') {
        return svgWrap(
            '<text x="16" y="22" text-anchor="middle" fill="' + color + '" font-size="20" font-weight="700" font-family="IBM Plex Mono, monospace">?</text>',
            color
        );
    }
    return svgWrap('<circle cx="16" cy="16" r="8" fill="' + color + '" opacity="0.4"/>', color);
}

/**
 * @param {{ id: string, mapLabel?: string, category?: string, storyId?: string, activeQuest?: boolean, color?: string, dimmed?: boolean }} opts
 */
export function buildMapMarkerHtml(opts) {
    opts = opts || {};
    var cat = opts.category || 'custom';
    var color = opts.color || '#4af626';
    var glyph = 'custom';
    var story = opts.storyId && STORY_POINT_ICONS[opts.storyId];
    if (cat === 'permanent' && story) {
        color = story.color;
        glyph = story.glyph;
    } else if (cat === 'pocta') {
        glyph = 'pocta';
        color = '#e8c547';
    } else if (cat === 'custom') {
        glyph = 'custom';
        color = opts.color || '#4af626';
    }
    if (opts.activeQuest) {
        glyph = 'quest';
        color = '#FFC107';
    }
    var label = (opts.mapLabel || '').replace(/</g, '&lt;').slice(0, 22);
    var dimClass = opts.dimmed ? ' map-v3-dimmed' : '';
    return (
        '<div class="map-v3-marker map-v3-cat-' + cat + dimClass + '" data-map-cat="' + cat + '">' +
        '<div class="map-v3-marker-halo" style="--marker-color:' + color + '"></div>' +
        '<div class="map-v3-marker-pin">' + glyphSvg(glyph, color) + '</div>' +
        (label ? '<div class="map-v3-marker-label">' + label + '</div>' : '') +
        '</div>'
    );
}

export function buildTacticalPopupHtml(opts) {
    opts = opts || {};
    var cat = opts.category || 'custom';
    var color = opts.color || '#4af626';
    if (opts.storyId && STORY_POINT_ICONS[opts.storyId]) {
        color = STORY_POINT_ICONS[opts.storyId].color;
    }
    if (cat === 'pocta') color = '#e8c547';
    var title = (opts.title || 'Bod').replace(/</g, '&lt;');
    var desc = (opts.desc || '').replace(/</g, '&lt;');
    var time = opts.timestamp || '';
    var catLabel = cat === 'permanent' ? 'TRVALÝ BOD' : (cat === 'pocta' ? 'POCTA' : 'VLASTNÍ BOD');
    var html = '<div class="map-v3-popup">';
    html += '<div class="map-v3-popup-header" style="border-color:' + color + ';color:' + color + '">';
    html += '<span class="map-v3-popup-cat">' + catLabel + '</span>';
    html += '<strong class="map-v3-popup-title">' + title + '</strong>';
    html += '</div>';
    html += '<div class="map-v3-popup-body">';
    if (desc) html += '<p class="map-v3-popup-desc">' + desc + '</p>';
    if (opts.extraHtml) html += opts.extraHtml;
    if (time) html += '<div class="map-v3-popup-time">' + time + '</div>';
    html += '</div></div>';
    return html;
}
