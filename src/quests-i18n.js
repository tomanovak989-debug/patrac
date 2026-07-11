/**
 * Překlad systémových úkolů podle id / templateId.
 * Vlastní (custom) úkoly a user content se nepřekládají.
 */
import { t, i18next } from './i18n.js';

var STORY_QUEST_IDS = ['roxy', 'sef', 'herbert', 'ino', 'adam'];

function hasTranslation(key) {
    if (!i18next.isInitialized) return false;
    return t(key) !== key;
}

export function translateQuest(quest) {
    if (!quest) return quest;
    var copy = Object.assign({}, quest);
    var keyBase = null;
    if (quest.templateId) {
        keyBase = 'quests.random.' + quest.templateId;
    } else if (STORY_QUEST_IDS.indexOf(quest.id) !== -1) {
        keyBase = 'quests.story.' + quest.id;
    }
    if (!keyBase) return copy;

    if (hasTranslation(keyBase + '.title')) copy.title = t(keyBase + '.title');
    if (hasTranslation(keyBase + '.desc')) copy.desc = t(keyBase + '.desc');
    if (hasTranslation(keyBase + '.mapLabel')) copy.mapLabel = t(keyBase + '.mapLabel');
    return copy;
}

export function translateQuestList(list) {
    if (!list || !list.length) return list || [];
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(translateQuest(list[i]));
    return out;
}
