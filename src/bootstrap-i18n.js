import { initPatracI18n, t } from './i18n.js';
import { initPatracSettings } from './settings.js';
import { applyPatracI18n } from './apply-i18n.js';
import { translateQuest } from './quests-i18n.js';

window.__patracI18nBoot = (async function() {
    await initPatracI18n();
    initPatracSettings();
    window.patracT = t;
    window.patracTranslateQuest = translateQuest;
    await applyPatracI18n();
})();
