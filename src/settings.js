/** Velikost textu, kompas a režim zobrazení — localStorage + třídy na body. */

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
        ['btn-text-large', size === 'large']
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i][0]);
        if (el) el.classList.toggle('is-active', ids[i][1]);
    }
}

export function getDisplayMode() {
    var mode = localStorage.getItem('patrac_display_mode');
    return mode === 'light' ? 'light' : 'dark';
}

export function applyDisplayMode(mode) {
    mode = mode === 'light' ? 'light' : 'dark';
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(mode === 'light' ? 'theme-light' : 'theme-dark');
    localStorage.setItem('patrac_display_mode', mode);
    updateDisplayModeButtons(mode);
}

export function updateDisplayModeButtons(mode) {
    var ids = [
        ['btn-theme-dark', mode === 'dark'],
        ['btn-theme-light', mode === 'light']
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
        ['btn-compass-hide', !visible]
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i][0]);
        if (el) el.classList.toggle('is-active', ids[i][1]);
    }
}

export function initPatracSettings() {
    document.body.classList.add('contrast-enhanced');
    applyDisplayMode(getDisplayMode());
    applyTextSize(getTextSize());
    applyCompassVisible(getCompassVisible());
    bindFullscreenListeners();
    syncFullscreenSettingVisibility();
    updateFullscreenButtons();
}

export function setPatracTextSize(size) {
    applyTextSize(size);
}

export function setPatracDisplayMode(mode) {
    applyDisplayMode(mode);
}

export function setPatracCompassVisible(visible) {
    applyCompassVisible(visible);
}

function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function isBrowserFullscreen() {
    return !!getFullscreenElement();
}

export function isFullscreenSupported() {
    var el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function updateFullscreenButtons() {
    var active = isBrowserFullscreen();
    var ids = [
        ['btn-fullscreen-on', !active],
        ['btn-fullscreen-off', active]
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i][0]);
        if (el) el.classList.toggle('is-active', ids[i][1]);
    }
}

export function syncFullscreenSettingVisibility() {
    var row = document.getElementById('hud-menu-fullscreen-row');
    if (row) row.style.display = isFullscreenSupported() ? '' : 'none';
}

function bindFullscreenListeners() {
    if (bindFullscreenListeners._bound) return;
    bindFullscreenListeners._bound = true;
    document.addEventListener('fullscreenchange', updateFullscreenButtons);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtons);
}

export function setBrowserFullscreen(on) {
    if (!isFullscreenSupported()) {
        alert('Prohlížeč nepodporuje režim celé obrazovky.');
        return Promise.resolve(false);
    }
    if (on) {
        if (isBrowserFullscreen()) {
            updateFullscreenButtons();
            return Promise.resolve(true);
        }
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        return Promise.resolve(req.call(el)).then(function() {
            updateFullscreenButtons();
            return true;
        }).catch(function() {
            alert('Celou obrazovku nelze zapnout — zkus to znovu po klepnutí na tlačítko.');
            return false;
        });
    }
    if (!isBrowserFullscreen()) {
        updateFullscreenButtons();
        return Promise.resolve(true);
    }
    var exit = document.exitFullscreen || document.webkitExitFullscreen;
    return Promise.resolve(exit.call(document)).then(function() {
        updateFullscreenButtons();
        return true;
    }).catch(function() {
        updateFullscreenButtons();
        return false;
    });
}
