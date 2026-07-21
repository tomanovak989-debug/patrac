/* PATRAC: profile data and operator edit draft */
function getAllQuestDefinitionsForOperator() {
    var list = [];
    for (var k in gameQuests) {
        if (!gameQuests.hasOwnProperty(k)) continue;
        list.push({
            id: k,
            title: gameQuests[k].title,
            char: gameQuests[k].char,
            doneKey: gameQuests[k].doneKey || ('quest_done_' + k)
        });
    }
    var custom = getSafeJSON('custom_quests_list');
    for (var c = 0; c < custom.length; c++) {
        list.push({
            id: custom[c].id,
            title: custom[c].title,
            char: custom[c].char,
            doneKey: custom[c].doneKey || ('quest_done_' + custom[c].id)
        });
    }
    var random = getRandomQuestsList();
    for (var r = 0; r < random.length; r++) {
        list.push({
            id: random[r].id,
            title: random[r].title,
            char: random[r].char,
            doneKey: 'quest_done_' + random[r].id
        });
    }
    return list;
}

function snapshotQuestDoneFromLocalStorage() {
    var done = {};
    var quests = getAllQuestDefinitionsForOperator();
    for (var i = 0; i < quests.length; i++) {
        if (localStorage.getItem(quests[i].doneKey) === 'true') {
            done[quests[i].id] = true;
        }
    }
    return done;
}

function snapshotCurrentUserToProfileData() {
    var profile = getPlayerProfile();
    return {
        localMissions: profile.localMissions || 0,
        globalMissions: profile.globalMissions || 0,
        localIssuerStats: profile.localIssuerStats ? JSON.parse(JSON.stringify(profile.localIssuerStats)) : emptyIssuerStats(),
        globalIssuerStats: profile.globalIssuerStats ? JSON.parse(JSON.stringify(profile.globalIssuerStats)) : emptyIssuerStats(),
        missionLog: profile.missionLog ? JSON.parse(JSON.stringify(profile.missionLog)) : [],
        chronicle: profile.chronicle ? JSON.parse(JSON.stringify(profile.chronicle)) : [],
        questDone: snapshotQuestDoneFromLocalStorage(),
        itemsPersonal: JSON.parse(JSON.stringify(getCurrentPersonalItems()))
    };
}

function createDefaultUserProfileData(userId) {
    var acc = getPatracAccounts()[userId] || {};
    return {
        localMissions: acc.localMissions || 0,
        globalMissions: acc.localMissions || 0,
        localIssuerStats: emptyIssuerStats(),
        globalIssuerStats: emptyIssuerStats(),
        missionLog: [],
        chronicle: [],
        questDone: {},
        itemsPersonal: []
    };
}

function setUserPersonalItemsLocal(userId, items) {
    if (!userId) return;
    var list = Array.isArray(items) ? items : [];
    safeLocalStorageSet(getPatracItemsPersonalKey(userId), JSON.stringify(list));
    if (userId === localStorage.getItem('patrac_session')) {
        safeLocalStorageSet('items_personal', JSON.stringify(list));
    }
}

function loadUserPersonalItemsIntoSession(userId) {
    if (!userId) {
        localStorage.setItem('items_personal', '[]');
        return [];
    }
    var key = getPatracItemsPersonalKey(userId);
    if (localStorage.getItem(key) !== null) {
        var existing = getUserPersonalItems(userId);
        localStorage.setItem('items_personal', JSON.stringify(existing));
        return existing;
    }

    var accounts = getPatracAccounts();
    var accountIds = Object.keys(accounts);
    var legacy = getSafeItems('items_personal');
    var items = [];

    if (accountIds.length === 1 && accountIds[0] === userId && legacy.length > 0) {
        items = legacy.slice();
        saveUserPersonalItems(userId, items);
    } else {
        setUserPersonalItemsLocal(userId, []);
    }

    return items;
}

function getUserPersonalItems(userId) {
    if (!userId) return [];
    var raw = localStorage.getItem(getPatracItemsPersonalKey(userId));
    if (raw !== null) {
        try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
    }
    return [];
}

function syncOperatorCommunityContext() {
    if (!isOperatorMode || !operatorComCode) return;
    localStorage.setItem('com_code', operatorComCode);
    var comm = findCommunityByCode(operatorComCode);
    if (comm && comm.name) localStorage.setItem('com_name', comm.name);
}

function ensureOperatorEditContext() {
    if (!isOperatorMode) return;
    syncOperatorCommunityContext();

    if (currentlyEditingPlayerId) {
        if (!operatorEditDraft) {
            operatorEditDraft = loadUserProfileDataFromStorage(currentlyEditingPlayerId);
        }
        if (!operatorEditDraft.questDone) operatorEditDraft.questDone = {};
        if (!operatorEditDraft.itemsPersonal) {
            operatorEditDraft.itemsPersonal = getUserPersonalItems(currentlyEditingPlayerId);
        }
        localStorage.setItem('patrac_session', currentlyEditingPlayerId);
        var acc = getPatracAccounts()[currentlyEditingPlayerId];
        if (acc) {
            applyAccountToLocalStorage(currentlyEditingPlayerId);
            applyUserProfileDataToSession(currentlyEditingPlayerId, operatorEditDraft);
        }
        document.body.classList.add('admin-editing-player');
    }

    updateAdminBar();
    renderOperatorClanUI();
    loadCustomCraftedItems();
}

function loadUserProfileDataFromStorage(userId) {
    var raw = localStorage.getItem(getPatracProfileKey(userId));
    if (raw) {
        try {
            var data = JSON.parse(raw);
            if (!data.questDone) data.questDone = {};
            if (!data.localIssuerStats) data.localIssuerStats = emptyIssuerStats();
            if (!data.globalIssuerStats) data.globalIssuerStats = emptyIssuerStats();
            data.itemsPersonal = getUserPersonalItems(userId);
            return data;
        } catch (e) {}
    }
    if (userId === localStorage.getItem('patrac_session') && !isOperatorMode) {
        return snapshotCurrentUserToProfileData();
    }
    return createDefaultUserProfileData(userId);
}

function getUserProfileData(userId) {
    if (isOperatorMode && userId === currentlyEditingPlayerId && operatorEditDraft) {
        return JSON.parse(JSON.stringify(operatorEditDraft));
    }
    return loadUserProfileDataFromStorage(userId);
}

function saveUserProfileData(userId, data) {
    if (!userId || !data) return false;
    var store = {
        localMissions: data.localMissions || 0,
        globalMissions: data.globalMissions != null ? data.globalMissions : (data.localMissions || 0),
        localIssuerStats: data.localIssuerStats || emptyIssuerStats(),
        globalIssuerStats: data.globalIssuerStats || emptyIssuerStats(),
        missionLog: data.missionLog || [],
        chronicle: data.chronicle || [],
        questDone: data.questDone || {}
    };
    var ok = safeLocalStorageSet(getPatracProfileKey(userId), JSON.stringify(store));
    saveUserPersonalItems(userId, data.itemsPersonal || []);
    syncPlayerQuestProgressToCloud();
    return ok;
}

function syncSessionUserToStorage() {
    var session = localStorage.getItem('patrac_session');
    if (!session || isOperatorMode) return;
    var data = snapshotCurrentUserToProfileData();
    saveUserProfileData(session, data);
    syncCurrentAccountMissionStats();
    syncCurrentAccountWearLoadout();
}

function applyUserProfileDataToSession(userId, data) {
    if (!data) return;
    var profile = getPlayerProfile();
    profile.localMissions = data.localMissions || 0;
    profile.globalMissions = data.globalMissions || data.localMissions || 0;
    profile.localIssuerStats = data.localIssuerStats ? JSON.parse(JSON.stringify(data.localIssuerStats)) : emptyIssuerStats();
    profile.globalIssuerStats = data.globalIssuerStats ? JSON.parse(JSON.stringify(data.globalIssuerStats)) : emptyIssuerStats();
    if (data.missionLog) profile.missionLog = JSON.parse(JSON.stringify(data.missionLog));
    profile.chronicle = data.chronicle ? JSON.parse(JSON.stringify(data.chronicle)) : [];
    savePlayerProfile(profile);

    var quests = getAllQuestDefinitionsForOperator();
    for (var i = 0; i < quests.length; i++) {
        var q = quests[i];
        var isDone = !!(data.questDone && data.questDone[q.id]);
        if (isDone) localStorage.setItem(q.doneKey, 'true');
        else try { localStorage.removeItem(q.doneKey); } catch (e) {}
    }
    localStorage.setItem('items_personal', JSON.stringify(data.itemsPersonal || []));
    reconcileCommunityInventory(localStorage.getItem('com_code') || '');
}

function recalculateOperatorDraftFromQuests() {
    if (!operatorEditDraft) return;
    var stats = emptyIssuerStats();
    var count = 0;
    var quests = getAllQuestDefinitionsForOperator();
    for (var i = 0; i < quests.length; i++) {
        if (operatorEditDraft.questDone[quests[i].id]) {
            count++;
            var fullQ = getQuestById(quests[i].id);
            if (fullQ) {
                var key = getIssuerKey(fullQ);
                stats[key] = (stats[key] || 0) + 1;
            }
        }
    }
    operatorEditDraft.localMissions = count;
    operatorEditDraft.localIssuerStats = stats;
}

function recalculateOperatorDraftMissionsFromStats() {
    if (!operatorEditDraft) return;
    var total = sumIssuerStats(operatorEditDraft.localIssuerStats);
    operatorEditDraft.localMissions = total;
}

