/** Velikost textu a vizuální nastavení — localStorage + třídy na body. */

export function getTextSize() {
    return localStorage.getItem('patrac_text_size') || 'default';
}

export function applyTextSize(size) {
    size = size === 'large' ? 'large' : 'default';
    document.body.classList.remove('theme-standard', 'theme-large', 'text-size-large');
    if (size === 'large') {
        document.body.classList.add('theme-large', 'text-size-large');
    } else {
        document.body.classList.add('theme-standard');
    }
    localStorage.setItem('patrac_text_size', size);
    updateTextSizeButtons(size);
}

export function updateTextSizeButtons(size) {
    var ids = [
        ['btn-text-default', size === 'default'],
        ['btn-text-large', size === 'large'],
        ['btn-gate-text-default', size === 'default'],
        ['btn-gate-text-large', size === 'large']
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i][0]);
        if (el) el.classList.toggle('is-active', ids[i][1]);
    }
}

export function getCompassVisible() {
    return localStorage.getItem('patrac_compass_visible') !== 'false';
}

export function applyCompassVisible(visible) {
    localStorage.setItem('patrac_compass_visible', visible ? 'true' : 'false');
    updateCompassButtons(visible);
    if (typeof window.updateMapCompassDisplay === 'function') {
        window.updateMapCompassDisplay();
    }
}

export function updateCompassButtons(visible) {
    var ids = [
        ['btn-compass-show', visible],
        ['btn-compass-hide', !visible],
        ['btn-gate-compass-show', visible],
        ['btn-gate-compass-hide', !visible]
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i][0]);
        if (el) el.classList.toggle('is-active', ids[i][1]);
    }
}

export function initPatracSettings() {
    document.body.classList.add('contrast-enhanced');
    applyTextSize(getTextSize());
    applyCompassVisible(getCompassVisible());
}

export function setPatracTextSize(size) {
    applyTextSize(size);
}

export function setPatracCompassVisible(visible) {
    applyCompassVisible(visible);
}
