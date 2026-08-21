/**
 * Ikony menu — inline před textem položky.
 */
export var RADIO_ICON_DIR = 'src/assets/icons/radio/';

var ICON_BY_ID = {
    radio_comms: 'email-unread.png',
    radio_presets: 'archive-presets.png',
    radio_autoscan: 'wifi-search.png',
    radio_beacon: 'beacon-lighthouse.png',
    radio_snake: 'snake.png',
    radio_settings: 'settings-cog.png',
    settings_sounds: 'music-note.png',
    new_sms: 'email-add.png',
    inbox: 'email-upload.png',
    outbox: 'email-send.png',
    drafts: 'email-edit.png',
    autoscan: 'wifi-search.png',
    templates: 'email-unread.png'
};

export function radioIconUrl(filename) {
    if (!filename) return '';
    var build = (typeof window !== 'undefined' && window.PATRAC_BUILD) ? window.PATRAC_BUILD : '';
    return '/' + RADIO_ICON_DIR + filename + (build ? ('?v=' + build) : '');
}

export function menuIconForItem(item) {
    if (!item) return null;
    if (item.id && ICON_BY_ID[item.id]) return ICON_BY_ID[item.id];
    if (item.id && item.id.indexOf('preset_') === 0) return 'archive-presets.png';
    if (item.type === 'action' && item.id && ICON_BY_ID[item.id]) return ICON_BY_ID[item.id];
    return null;
}

export function menuIconForId(id) {
    if (id && ICON_BY_ID[id]) return ICON_BY_ID[id];
    if (id && id.indexOf('preset_') === 0) return 'archive-presets.png';
    return null;
}
