/**
 * Přihlašovací brána — první i18n „komponenta“ (vanilla HTML + data-i18n).
 * Vzor pro další panely: přidej klíče do cs.json/en.json, atributy do HTML, zavolej apply*.
 */
import { applyI18nToDom, setPatracLanguage, t } from '../i18n.js';

export function applyGateHeaderI18n() {
    var header = document.querySelector('.gate-header');
    if (header) applyI18nToDom(header);
}

export function applyGateLoginI18n() {
    var panel = document.getElementById('gate-login');
    if (panel) applyI18nToDom(panel);
}

/** Celá brána — header + přihlašovací panel (Main Menu). */
export function applyGateI18n() {
    applyGateHeaderI18n();
    applyGateLoginI18n();
}

export async function switchGateLanguage(code) {
    await setPatracLanguage(code);
    applyGateI18n();
}

export { t };
