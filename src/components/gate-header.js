/**
 * Přihlašovací brána — první i18n „komponenta“ (vanilla HTML + data-i18n).
 */
import { applyI18nToDom, setPatracLanguage, t, getPatracLanguage } from '../i18n.js';

export function applyGateHeaderI18n() {
    var header = document.querySelector('.gate-header');
    if (header) applyI18nToDom(header);
}

export function applyGateLoginI18n() {
    var panel = document.getElementById('gate-login');
    if (panel) applyI18nToDom(panel);
}

export function applyGateI18n() {
    applyGateHeaderI18n();
    applyGateLoginI18n();
    updateLanguageButtons(getPatracLanguage());
}

export function updateLanguageButtons(code) {
    var ids = ['btn-lang-cs', 'btn-lang-en', 'hud-btn-lang-cs', 'hud-btn-lang-en'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!el) continue;
        var isCs = ids[i].indexOf('-cs') !== -1;
        el.classList.toggle('is-active', (code === 'cs' && isCs) || (code === 'en' && !isCs));
    }
}

export async function switchGateLanguage(code) {
    await setPatracLanguage(code);
    applyGateI18n();
}

export { t };
