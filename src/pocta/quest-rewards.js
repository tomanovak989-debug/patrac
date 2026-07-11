import { grantPoctaToCommunity } from './rewards.js';

/** Mise, které po prvním splnění komunitě udělí neaktivovanou Poctu. */
export const POCTA_QUEST_REWARDS = {
    herbert: {
        title: 'Pocta lesnímu skladu',
        story: 'Herbertův odkaz — místo, kde jsme poprvé uložili naději a zdravotnické zásoby do ticha lesa.'
    },
    sef: {
        title: 'Pocta prameni',
        story: 'Bez vody jsme mrtví. Tato pocta patří každému, kdo našel první zdroj.'
    },
    ino: {
        title: 'Pocta cvičišti',
        story: 'Mýtina, kde jsme poprvé procvičili tělo i odvahu — než šlo doopravdy.'
    }
};

export function getPoctaRewardConfig(questId) {
    return POCTA_QUEST_REWARDS[questId] || null;
}

export function maybeGrantPoctaForQuest(quest) {
    if (!quest || !quest.id) return null;
    var reward = getPoctaRewardConfig(quest.id);
    if (!reward) return null;

    var result = grantPoctaToCommunity({
        questId: quest.id,
        questTitle: quest.title || quest.mapLabel || quest.id,
        title: reward.title,
        story: reward.story,
        userId: localStorage.getItem('patrac_session') || '',
        userName: localStorage.getItem('player_name') || 'Operativec'
    });

    if (!result.ok) return null;
    return result.entity;
}

/** Rychlá simulace odměny z mise (prototyp). */
export function simulateQuestPoctaReward() {
    return grantPoctaToCommunity({
        questId: 'sim_' + Date.now(),
        questTitle: 'Simulovaná mise',
        title: 'Pocta z cesty',
        story: 'Simulace — komunita získala artefakt po splnění mise. Ukotvi ho v terénu, až budeš na místě.',
        force: true
    });
}
