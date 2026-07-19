import { applyI18nToDom, getPatracLanguage } from './i18n.js';
import { applyGateI18n, updateLanguageButtons } from './components/gate-i18n.js';
import { updateTextSizeButtons, getTextSize, updateCompassButtons, getCompassVisible } from './settings.js';

export function applySettingsMenuI18n() {
    var menu = document.getElementById('hud-menu-dropdown');
    if (menu) applyI18nToDom(menu);
    updateLanguageButtons(getPatracLanguage());
    updateTextSizeButtons(getTextSize());
    updateCompassButtons(getCompassVisible());
}

export async function applyPatracI18n() {
    applyGateI18n();
    applySettingsMenuI18n();

    if (typeof window.renderQuestList === 'function') window.renderQuestList();
    if (typeof window.updateStatsHud === 'function') window.updateStatsHud({ skipMembersList: true });
    if (typeof window.renderMissionLog === 'function') window.renderMissionLog();
    if (typeof window.renderCommunityProfile === 'function') window.renderCommunityProfile({ skipMembersList: true });
}
