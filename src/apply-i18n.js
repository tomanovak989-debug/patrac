import { applyI18nToDom, getPatracLanguage } from './i18n.js';
import { applyGateI18n, updateLanguageButtons } from './components/gate-i18n.js';
import { updateTextSizeButtons, getTextSize, updateCompassButtons, getCompassVisible, updateFullscreenButtons, syncFullscreenSettingVisibility, updateHudLangIcon } from './settings.js';

export function applySettingsMenuI18n() {
    updateLanguageButtons(getPatracLanguage());
    updateHudLangIcon(getPatracLanguage());
    updateTextSizeButtons(getTextSize());
    updateCompassButtons(getCompassVisible());
    syncFullscreenSettingVisibility();
    updateFullscreenButtons();
}

export async function applyPatracI18n() {
    applyGateI18n();
    applySettingsMenuI18n();

    if (typeof window.renderQuestList === 'function') window.renderQuestList();
    if (typeof window.updateStatsHud === 'function') window.updateStatsHud({ skipMembersList: true });
    if (typeof window.renderMissionLog === 'function') window.renderMissionLog();
    if (typeof window.renderCommunityProfile === 'function') window.renderCommunityProfile({ skipMembersList: true });
}
