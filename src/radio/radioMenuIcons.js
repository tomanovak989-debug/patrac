/**
 * Ikony menu — Garmin Instinct styl (kolečko vpravo nahoře).
 */
export var RADIO_ICON_DIR = 'src/assets/icons/radio/';

var ICON_BY_ID = {
    radio_comms: 'email-unread.png',
    new_sms: 'email-unread.png',
    inbox: 'email-upload.png',
    outbox: 'email-send.png',
    drafts: 'email-edit.png',
    autoscan: 'wifi-search.png',
    radio_autoscan: 'wifi-search.png',
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
    if (item.type === 'action' && item.id && ICON_BY_ID[item.id]) return ICON_BY_ID[item.id];
    return null;
}

export function menuIconForId(id) {
    return id && ICON_BY_ID[id] ? ICON_BY_ID[id] : null;
}
