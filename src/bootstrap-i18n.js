import { initPatracI18n } from './i18n.js';
import { applyGateI18n } from './components/gate-header.js';

window.__patracI18nBoot = (async function() {
    await initPatracI18n();
    applyGateI18n();
})();
