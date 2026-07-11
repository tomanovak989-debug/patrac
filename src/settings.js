/** Velikost textu a vizuální nastavení — localStorage + třídy na body. */

export function getTextSize() {
    return localStorage.getItem('patrac_text_size') || 'default';
}

export function applyTextSize(size) {
    size = size === 'large' ? 'large' : 'default';
    document.body.classList.toggle('text-size-large', size === 'large');
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

export function initPatracSettings() {
    document.body.classList.add('contrast-enhanced');
    applyTextSize(getTextSize());
}

export function setPatracTextSize(size) {
    applyTextSize(size);
}
