/**
 * Přihlašovací brána — všechny gate panely.
 */
import { applyI18nToDom, setPatracLanguage, getPatracLanguage } from '../i18n.js';

var GATE_PANEL_IDS = ['gate-login', 'gate-register', 'gate-recover', 'gate-operator'];
export async function switchGateLanguage(code) {
    await setPatracLanguage(code);
    applyGateI18n();
}

export function applyGateHeaderI18n() {
    var header = document.querySelector('.gate-header');
    if (header) applyI18nToDom(header);
    var settings = document.getElementById('gate-settings-block');
    if (settings) applyI18nToDom(settings);
}

export function applyGatePanelsI18n() {
    for (var i = 0; i < GATE_PANEL_IDS.length; i++) {
        var panel = document.getElementById(GATE_PANEL_IDS[i]);
        if (panel) applyI18nToDom(panel);
    }
    syncGateSelectOptions();
}

export function applyGateI18n() {
    applyGateHeaderI18n();
    applyGatePanelsI18n();
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

function syncGateSelectOptions() {
    var comMode = document.getElementById('input-com-mode');
    if (comMode && comMode.options.length >= 2 && window.patracT) {
        comMode.options[0].textContent = window.patracT('gate.register.comCreate');
        comMode.options[1].textContent = window.patracT('gate.register.comJoin');
    }
    var opSel = document.getElementById('select-operator-com');
    if (opSel && opSel.options.length && opSel.options[0].value === '' && window.patracT) {
        opSel.options[0].textContent = window.patracT('gate.operator.loadingComs');
    }
}
