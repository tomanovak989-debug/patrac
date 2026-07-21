/* PATRAC: session, accounts, cloud sync, operator edit */
function beginSessionForUser(userId, options) {
    options = options || {};
    var previousCom = localStorage.getItem('com_code') || '';
    if (previousCom) snapshotCommunityMapCache(previousCom);
    clearGlobalSessionGameCache();
    applyAccountToLocalStorage(userId);
    var comCode = localStorage.getItem('com_code') || '';
    loadCommunityInventoryFromComCode(comCode);
    if (!restoreCommunityMapCache(comCode) && previousCom && previousCom !== comCode) {
        restoreCommunityMapCache(previousCom);
    }
    var profileData = options.profileData || getUserProfileData(userId);
    applyUserProfileDataToSession(userId, profileData);
    var profile = getPlayerProfile();
    if (options.comName) profile.currentClan = options.comName;
    if (options.resetChronicle) profile.chronicle = [];
    savePlayerProfile(profile);
}

function getPatracItemsCommunityKey(comCode) {
    return 'patrac_items_community_' + (comCode || '').toUpperCase();
}

function getActiveInventoryUserId() {
    if (isOperatorMode && currentlyEditingPlayerId) return currentlyEditingPlayerId;
    return localStorage.getItem('patrac_session') || '';
}

function getItemIdentity(item) {
    if (!item) return '';
    if (item.id) return String(item.id);
    return 'name:' + String(item.name || '').trim().toLowerCase();
}

function saveUserPersonalItems(userId, items) {
    if (!userId) return;
    var list = items || [];
    safeLocalStorageSet(getPatracItemsPersonalKey(userId), JSON.stringify(list));
    pushPlayerCloudAsync(function(mod) {
        return mod.syncPlayerInventory(userId, list);
    });
}

function getCommunityItemsRaw() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (comCode) {
        var key = getPatracItemsCommunityKey(comCode);
        var rawKey = localStorage.getItem(key);
        if (rawKey !== null) {
            try {
                var keyed = JSON.parse(rawKey);
                if (Array.isArray(keyed)) return keyed;
            } catch (e) {}
        }
        return [];
    }
    return [];
}

function saveCommunityItemsRaw(items, comCode) {
    comCode = comCode || localStorage.getItem('com_code') || operatorComCode || '';
    var list = Array.isArray(items) ? items : [];
    var ok = true;
    if (comCode) {
        ok = safeLocalStorageSet(getPatracItemsCommunityKey(comCode), JSON.stringify(list));
    }
    if (ok) ok = safeLocalStorageSet('items_community', JSON.stringify(list));
    if (ok && comCode) {
        patracImport('services/communityService.js').then(function(mod) {
            return mod.saveCommunityInventory(comCode, list);
        }).catch(function(err) {
            console.warn('[cloud] inventory sync', comCode, err);
        });
    }
    return ok;
}

function getAllEquippedItemIds(comCode) {
    comCode = comCode || localStorage.getItem('com_code') || operatorComCode || '';
    var ids = {};
    if (!comCode) return ids;
    var members = getCommunityMemberAccounts(comCode);
    for (var i = 0; i < members.length; i++) {
        var personal = getUserPersonalItems(members[i].userId);
        for (var j = 0; j < personal.length; j++) {
            ids[getItemIdentity(personal[j])] = true;
        }
    }
    return ids;
}

function getCommunityInventoryItems() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    var raw = getCommunityItemsRaw();
    var equipped = getAllEquippedItemIds(comCode);
    var visible = [];
    for (var i = 0; i < raw.length; i++) {
        if (!equipped[getItemIdentity(raw[i])]) visible.push(raw[i]);
    }
    return visible;
}

function getCurrentPersonalItems() {
    if (isOperatorMode && currentlyEditingPlayerId && operatorEditDraft) {
        return operatorEditDraft.itemsPersonal || [];
    }
    var userId = getActiveInventoryUserId();
    if (userId) return getUserPersonalItems(userId);
    return getSafeItems('items_personal');
}

function saveCurrentPersonalItems(items) {
    var list = Array.isArray(items) ? items : [];
    var userId = getActiveInventoryUserId();
    if (userId) saveUserPersonalItems(userId, list);
    localStorage.setItem('items_personal', JSON.stringify(list));
    if (isOperatorMode && currentlyEditingPlayerId && operatorEditDraft) {
        operatorEditDraft.itemsPersonal = JSON.parse(JSON.stringify(list));
    }
}

function findItemIndexInRawByIdentity(raw, item) {
    var id = getItemIdentity(item);
    for (var i = 0; i < raw.length; i++) {
        if (getItemIdentity(raw[i]) === id) return i;
    }
    return -1;
}

function reconcileCommunityInventory(comCode) {
    comCode = comCode || localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    var raw = getCommunityItemsRaw();
    var equipped = getAllEquippedItemIds(comCode);
    var cleaned = [];
    var changed = false;
    for (var i = 0; i < raw.length; i++) {
        if (equipped[getItemIdentity(raw[i])]) changed = true;
        else cleaned.push(raw[i]);
    }
    if (changed) saveCommunityItemsRaw(cleaned, comCode);
}

function getPatracItemsPersonalKey(userId) {
    return 'patrac_items_personal_' + userId;
}

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

function initGateOperatorTrigger() {
    var corner = document.getElementById('gate-scan-corner');
    if (!corner || corner._operatorBound) return;
    corner._operatorBound = true;
    var holdMs = 1400;
    function startHold() {
        clearTimeout(_gateOperatorTimer);
        corner.classList.add('operator-armed');
        _gateOperatorTimer = setTimeout(function() {
            switchGatePage('gate-operator');
            corner.classList.remove('operator-armed');
        }, holdMs);
    }
    function cancelHold() {
        clearTimeout(_gateOperatorTimer);
        corner.classList.remove('operator-armed');
    }
    corner.addEventListener('mousedown', startHold);
    corner.addEventListener('mouseup', cancelHold);
    corner.addEventListener('mouseleave', cancelHold);
    corner.addEventListener('touchstart', function(e) { e.preventDefault(); startHold(); }, { passive: false });
    corner.addEventListener('touchend', cancelHold);
    corner.addEventListener('touchcancel', cancelHold);
}

function findCommunityForOperatorLogin(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return Promise.resolve(null);
    var local = findCommunityByCode(code);
    if (local) return Promise.resolve(local);
    return withPatracTimeout(
        patracImport('services/communityService.js').then(function(mod) {
            return mod.fetchCommunityMeta(code);
        }),
        15000,
        'operator community lookup timeout'
    ).then(function(cloud) {
        if (!cloud) return null;
        var comms = getPatracCommunities();
        comms[code] = cloud;
        localStorage.setItem('patrac_communities', JSON.stringify(comms));
        return cloud;
    }).catch(function(err) {
        console.warn('[operator] community lookup', err);
        return null;
    });
}

function patracOperatorLogin() {
    hideGateError('gate-operator-error');
    var comCode = (document.getElementById('input-operator-com-code').value || '').trim().toUpperCase();
    var adminKey = (document.getElementById('input-operator-admin-key').value || '').trim();
    if (!comCode || !adminKey) {
        showGateError('gate-operator-error', 'gate.errors.operatorMissingFields');
        return;
    }
    if (comCode.length !== 5) {
        showGateError('gate-operator-error', 'gate.errors.registerBadComCode');
        return;
    }
    if (!verifyOperatorAdminKey(adminKey)) {
        showGateError('gate-operator-error', 'gate.errors.operatorBadKey');
        return;
    }
    var submitBtn = document.querySelector('#gate-operator .gate-btn-primary');
    if (submitBtn) submitBtn.disabled = true;
    findCommunityForOperatorLogin(comCode).then(function(comm) {
        if (submitBtn) submitBtn.disabled = false;
        if (!comm) {
            comm = findCommunityByCode(comCode);
        }
        if (!comm) {
            comm = {
                name: comCode,
                code: comCode,
                founder: '',
                members: []
            };
        }
        var previousCom = localStorage.getItem('com_code') || '';
        if (previousCom) snapshotCommunityMapCache(previousCom);
        clearGlobalSessionGameCache();
        isOperatorMode = true;
        operatorComCode = comCode;
        currentlyEditingPlayerId = null;
        operatorEditDraft = null;
        operatorEditDirty = false;
        localStorage.setItem('com_code', comCode);
        localStorage.setItem('com_name', comm.name || comCode);
        try { localStorage.removeItem('patrac_session'); } catch (e) {}
        localStorage.setItem('items_personal', '[]');
        sanitizeCommunityMembers(comCode);
        restoreCommunityMapCache(comCode);
        launchGame();
    }).catch(function(err) {
        if (submitBtn) submitBtn.disabled = false;
        console.warn('[operator] login', err);
        showGateError('gate-operator-error', 'gate.errors.operatorCloudError');
    });
}

function markOperatorEditDirty() {
    if (!isOperatorMode || !currentlyEditingPlayerId) return;
    operatorEditDirty = true;
    updateAdminBar();
}

function updateAdminBar() {
    var bar = document.getElementById('operator-admin-bar');
    var textEl = document.getElementById('operator-bar-text');
    var saveBtn = document.getElementById('btn-operator-save');
    var exitAdminBtn = document.getElementById('btn-operator-exit-admin');
    if (!bar) return;
    if (isOperatorMode) {
        bar.classList.add('visible');
        document.body.classList.add('admin-mode');
        var comName = localStorage.getItem('com_name') || operatorComCode;
        var editLabel = '';
        if (currentlyEditingPlayerId) {
            var acc = getPatracAccounts()[currentlyEditingPlayerId];
            editLabel = ' | Editace: ' + ((acc && acc.playerName) || currentlyEditingPlayerId);
        }
        if (textEl) textEl.textContent = '­čöÂ RE┼ŻIM OPER├üTOR ÔÇö ' + comName + editLabel;
        if (saveBtn) saveBtn.style.display = (currentlyEditingPlayerId && operatorEditDirty) ? 'inline-block' : 'none';
        if (exitAdminBtn) exitAdminBtn.style.display = currentlyEditingPlayerId ? 'inline-block' : 'none';
    } else {
        bar.classList.remove('visible');
        document.body.classList.remove('admin-mode');
        document.body.classList.remove('admin-editing-player');
        if (exitAdminBtn) exitAdminBtn.style.display = 'none';
    }
    if (fogOfWarMod && fogOfWarMod.syncFogAdminControls) fogOfWarMod.syncFogAdminControls();
    updateAdminFogButtonUi();
    patracRefreshFogOfWar();
}

function renderOperatorMemberList() {
    var el = document.getElementById('operator-members-list');
    if (!el || !isOperatorMode) return;
    var comCode = operatorComCode || localStorage.getItem('com_code') || '';
    var members = getCommunityMemberAccounts(comCode);
    if (members.length === 0) {
        el.innerHTML = '<p style="font-size:var(--text-sm);color:var(--faint-fg);">V komunit─Ť zat├şm nejsou registrovan├ş p├ítra─Źi.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < members.length; i++) {
        var mem = members[i];
        var av = localStorage.getItem(getPatracAvatarKey(mem.userId)) || '';
        var avHtml = av ? '<img src="' + av + '">' : (isBotAccount(mem.account) ? '­čĄľ' : 'ÔÇö');
        var cls = 'operator-member-row';
        if (mem.userId === currentlyEditingPlayerId) cls += ' is-editing';
        if (isBotAccount(mem.account)) cls += ' is-bot';
        var label = mem.account.playerName || mem.userId;
        html += '<div class="' + cls + '">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += '<div style="flex:1;"><strong>' + label + '</strong><br><span style="font-size:var(--text-xs);color:var(--dim-fg);">';
        html += (isBotAccount(mem.account) ? '­čĄľ test ┬Ě ' : '') + mem.userId + ' ┬Ě ' + (mem.account.localMissions || 0) + ' mis├ş</span></div>';
        html += '<button type="button" class="btn-op-edit" onclick="enterOperatorEditPlayer(\'' + mem.userId.replace(/'/g, "\\'") + '\')">' + (mem.userId === currentlyEditingPlayerId ? 'ÔťÄ EDITUJI' : 'P┼śEVZ├ŹT IDENTITU') + '</button>';
        if (isBotAccount(mem.account)) {
            html += '<button type="button" class="btn-op-remove" onclick="operatorRemoveBotOperative(\'' + mem.userId.replace(/'/g, "\\'") + '\')">­čŚĹ ODSTRANIT</button>';
        }
        html += '</div>';
    }
    el.innerHTML = html;
}

function renderOperatorEditPanel() {
    var panel = document.getElementById('operator-edit-panel');
    if (!panel) return;
    if (!isOperatorMode || !currentlyEditingPlayerId || !operatorEditDraft) {
        panel.classList.remove('open');
        return;
    }
    panel.classList.add('open');
    var acc = getPatracAccounts()[currentlyEditingPlayerId] || {};
    var titleEl = document.getElementById('operator-edit-title');
    var rankEl = document.getElementById('operator-edit-rank');
    var missEl = document.getElementById('operator-edit-missions');
    if (titleEl) titleEl.textContent = 'Editace: ' + (acc.playerName || currentlyEditingPlayerId);
    var fakeProfile = {
        localMissions: operatorEditDraft.localMissions || 0,
        globalMissions: operatorEditDraft.globalMissions || 0,
        localIssuerStats: operatorEditDraft.localIssuerStats
    };
    if (rankEl) rankEl.textContent = getPlayerRankDisplay(fakeProfile).label.replace(/<[^>]+>/g, '');
    if (missEl) missEl.textContent = operatorEditDraft.localMissions || 0;

    var missionEl = document.getElementById('operator-mission-list');
    if (missionEl) {
        var quests = getAllQuestDefinitionsForOperator();
        var mhtml = '';
        for (var q = 0; q < quests.length; q++) {
            var quest = quests[q];
            var checked = operatorEditDraft.questDone[quest.id] ? ' checked' : '';
            mhtml += '<label class="operator-mission-row">';
            mhtml += '<input type="checkbox"' + checked + ' onchange="toggleOperatorMission(\'' + quest.id.replace(/'/g, "\\'") + '\', this.checked)">';
            mhtml += '<span>' + (quest.char ? quest.char + ': ' : '') + quest.title + '</span>';
            mhtml += '</label>';
        }
        missionEl.innerHTML = mhtml || '<span style="font-size:var(--text-sm);color:var(--faint-fg);">┼Ż├ídn├ę definovan├ę mise</span>';
    }

    var specEl = document.getElementById('operator-spec-grid');
    if (specEl) {
        var shtml = '';
        for (var s = 0; s < ISSUER_ORDER.length; s++) {
            var key = ISSUER_ORDER[s];
            var val = (operatorEditDraft.localIssuerStats && operatorEditDraft.localIssuerStats[key]) || 0;
            var specLabel = SPECIALIZATION_MAP[key] || ISSUER_LABELS[key] || key;
            shtml += '<div class="operator-spec-label">' + specLabel + '</div>';
            shtml += '<div class="operator-spec-controls">';
            shtml += '<button type="button" onclick="adjustOperatorSpec(\'' + key + '\', -1)">Ôłĺ</button>';
            shtml += '<input type="number" min="0" step="1" class="operator-spec-input" id="operator-spec-val-' + key + '" value="' + val + '" onchange="setOperatorSpec(\'' + key + '\', this.value)" onblur="setOperatorSpec(\'' + key + '\', this.value)">';
            shtml += '<button type="button" onclick="adjustOperatorSpec(\'' + key + '\', 1)">+</button>';
            shtml += '</div>';
        }
        specEl.innerHTML = shtml;
    }
}

function updateOperatorEditPanelSummary() {
    if (!operatorEditDraft || !isOperatorMode || !currentlyEditingPlayerId) return;
    var rankEl = document.getElementById('operator-edit-rank');
    var missEl = document.getElementById('operator-edit-missions');
    var fakeProfile = {
        localMissions: operatorEditDraft.localMissions || 0,
        globalMissions: operatorEditDraft.globalMissions || 0,
        localIssuerStats: operatorEditDraft.localIssuerStats
    };
    if (rankEl) rankEl.textContent = getPlayerRankDisplay(fakeProfile).label.replace(/<[^>]+>/g, '');
    if (missEl) missEl.textContent = operatorEditDraft.localMissions || 0;
    for (var s = 0; s < ISSUER_ORDER.length; s++) {
        var key = ISSUER_ORDER[s];
        var val = (operatorEditDraft.localIssuerStats && operatorEditDraft.localIssuerStats[key]) || 0;
        var input = document.getElementById('operator-spec-val-' + key);
        if (input && document.activeElement !== input) input.value = val;
    }
}

function enterOperatorEditPlayer(userId) {
    if (!isOperatorMode || !userId) return;
    var previousId = currentlyEditingPlayerId;
    if (previousId && previousId !== userId && operatorEditDraft && operatorEditDirty) {
        saveUserProfileData(previousId, operatorEditDraft);
        reconcileCommunityInventory(operatorComCode || localStorage.getItem('com_code') || '');
    }
    var keepDraft = (previousId === userId && operatorEditDraft);
    currentlyEditingPlayerId = userId;
    operatorEditDirty = false;
    if (!keepDraft) {
        operatorEditDraft = loadUserProfileDataFromStorage(userId);
    }
    if (!operatorEditDraft.questDone) operatorEditDraft.questDone = {};
    operatorEditDraft.itemsPersonal = getUserPersonalItems(userId);
    document.body.classList.add('admin-editing-player');

    var acc = getPatracAccounts()[userId];
    if (acc) {
        applyAccountToLocalStorage(userId);
        applyUserProfileDataToSession(userId, operatorEditDraft);
    }

    reconcileCommunityInventory(operatorComCode || localStorage.getItem('com_code') || '');
    renderOperatorMemberList();
    renderOperatorEditPanel();
    updateAdminBar();
    updateStatsHud({ scrollToActive: true });
    loadCustomCraftedItems();
}

function toggleOperatorMission(questId, isDone) {
    if (!operatorEditDraft) return;
    if (!operatorEditDraft.questDone) operatorEditDraft.questDone = {};
    if (isDone && gameQuests[questId] && !hasStoredQuestCoords(questId)) {
        if (!confirm('Mise ÔÇ×' + (gameQuests[questId].mapLabel || gameQuests[questId].title) + 'ÔÇť nem├í ulo┼żenou polohu na map─Ť.\nOzna─Źit jako spln─Ťnou i bez bodu? (Doporu─Źeno: nejd┼Ö├şv um├şstit na map─Ť.)')) {
            renderOperatorEditPanel();
            return;
        }
    }
    if (isDone) operatorEditDraft.questDone[questId] = true;
    else delete operatorEditDraft.questDone[questId];
    recalculateOperatorDraftFromQuests();
    if (currentlyEditingPlayerId === localStorage.getItem('patrac_session')) {
        var q = getQuestById(questId);
        if (q) {
            if (isDone) localStorage.setItem(q.doneKey || ('quest_done_' + questId), 'true');
            else try { localStorage.removeItem(q.doneKey || ('quest_done_' + questId)); } catch (e) {}
        }
    }
    markOperatorEditDirty();
    updateOperatorEditPanelSummary();
    updateStatsHud({ skipMembersList: true });
    renderQuestList();
}

function adjustOperatorSpec(key, delta) {
    if (!operatorEditDraft) return;
    if (!operatorEditDraft.localIssuerStats) operatorEditDraft.localIssuerStats = emptyIssuerStats();
    var val = (operatorEditDraft.localIssuerStats[key] || 0) + delta;
    if (val < 0) val = 0;
    operatorEditDraft.localIssuerStats[key] = val;
    recalculateOperatorDraftMissionsFromStats();
    if (currentlyEditingPlayerId === localStorage.getItem('patrac_session')) {
        var profile = getPlayerProfile();
        profile.localIssuerStats = JSON.parse(JSON.stringify(operatorEditDraft.localIssuerStats));
        profile.localMissions = operatorEditDraft.localMissions;
        savePlayerProfile(profile);
    }
    markOperatorEditDirty();
    updateOperatorEditPanelSummary();
    updateStatsHud({ skipMembersList: true });
}

function setOperatorSpec(key, rawVal) {
    if (!operatorEditDraft) return;
    var val = parseInt(rawVal, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (!operatorEditDraft.localIssuerStats) operatorEditDraft.localIssuerStats = emptyIssuerStats();
    if (operatorEditDraft.localIssuerStats[key] === val) return;
    operatorEditDraft.localIssuerStats[key] = val;
    recalculateOperatorDraftMissionsFromStats();
    if (currentlyEditingPlayerId === localStorage.getItem('patrac_session')) {
        var profile = getPlayerProfile();
        profile.localIssuerStats = JSON.parse(JSON.stringify(operatorEditDraft.localIssuerStats));
        profile.localMissions = operatorEditDraft.localMissions;
        savePlayerProfile(profile);
    }
    var input = document.getElementById('operator-spec-val-' + key);
    if (input && String(input.value) !== String(val)) input.value = val;
    markOperatorEditDirty();
    updateOperatorEditPanelSummary();
    updateStatsHud({ skipMembersList: true });
}

function operatorAdjustItemLevel(index, delta, isComm) {
    if (!isOperatorMode || !currentlyEditingPlayerId || !operatorEditDraft || isComm) return;
    var list = operatorEditDraft.itemsPersonal;
    if (!list || !list[index]) return;
    var item = list[index];
    if (item.itemType === 'tool') return;
    item.missionCount = Math.max(0, (item.missionCount || 0) + delta);
    saveCurrentPersonalItems(operatorEditDraft.itemsPersonal);
    markOperatorEditDirty();
    loadCustomCraftedItems();
}

function persistOperatorEdits(options) {
    options = options || {};
    if (!isOperatorMode || !currentlyEditingPlayerId || !operatorEditDraft) return false;
    recalculateOperatorDraftMissionsFromStats();
    var playerId = currentlyEditingPlayerId;
    saveUserProfileData(playerId, operatorEditDraft);

    var accounts = getPatracAccounts();
    if (accounts[playerId]) {
        accounts[playerId].localMissions = operatorEditDraft.localMissions || 0;
        savePatracAccounts(accounts);
    }

    if (playerId === localStorage.getItem('patrac_session')) {
        applyUserProfileDataToSession(playerId, operatorEditDraft);
    }

    reconcileCommunityInventory(operatorComCode || localStorage.getItem('com_code') || '');
    operatorEditDirty = false;
    syncCurrentAccountWearLoadout();
    if (!options.skipUiRefresh) {
        renderCommunityProfile();
        renderOperatorMemberList();
        renderOperatorEditPanel();
        updateAdminBar();
        updateStatsHud();
    }
    if (!options.silent) {
        alert('Zm─Ťny hr├í─Źe ÔÇ×' + (accounts[playerId] && accounts[playerId].playerName || playerId) + 'ÔÇť ulo┼żeny.');
    }
    return true;
}

function saveOperatorEdits() {
    if (!persistOperatorEdits({})) {
        alert('Nejd┼Ö├şv vyber hr├í─Źe k editaci.');
    }
}

function patracExitOperatorKeepIdentity() {
    if (!isOperatorMode) return;
    snapshotCommunityMapCache(localStorage.getItem('com_code') || operatorComCode || '');
    var userId = currentlyEditingPlayerId || localStorage.getItem('patrac_session');
    if (!userId) {
        alert('Nejd┼Ö├şv v z├ílo┼żce ├Üto─Źi┼ít─Ť p┼Öevez identitu hr├í─Źe (P┼śEVZ├ŹT IDENTITU).');
        return;
    }
    if (operatorEditDirty && currentlyEditingPlayerId && operatorEditDraft) {
        if (confirm('Ulo┼żit neulo┼żen├ę zm─Ťny p┼Öed ukon─Źen├şm administrace?')) {
            persistOperatorEdits({ silent: true, skipUiRefresh: true });
        } else if (!confirm('Ukon─Źit administraci bez ulo┼żen├ş? Neulo┼żen├ę zm─Ťny budou ztraceny.')) {
            return;
        }
    }

    isOperatorMode = false;
    operatorComCode = '';
    currentlyEditingPlayerId = null;
    operatorEditDraft = null;
    operatorEditDirty = false;
    document.body.classList.remove('admin-mode');
    document.body.classList.remove('admin-editing-player');

    applyAccountToLocalStorage(userId);
    var storedProfile = loadUserProfileDataFromStorage(userId);
    applyUserProfileDataToSession(userId, storedProfile);
    reconcileCommunityInventory(localStorage.getItem('com_code') || '');
    syncCurrentAccountWearLoadout();
    syncCurrentAccountMissionStats();

    document.getElementById('display-com-name').textContent = localStorage.getItem('com_name') || '---';
    document.getElementById('display-player-name').textContent = localStorage.getItem('player_name') || '---';
    updateProfileCodeDisplay();
    var avPrev = document.getElementById('avatar-game-preview');
    var av = localStorage.getItem('player_avatar');
    if (avPrev) avPrev.innerHTML = av ? '<img src="' + av + '">' : 'ÔÇö';

    updateAdminBar();
    renderOperatorEditPanel();
    renderCommunityProfile();
    updateStatsHud();
    loadCustomCraftedItems();
    updateHudMenuUser();
    updateRadioDisplayHud();
    var editBtn = document.getElementById('btn-toggle-profile-edit');
    if (editBtn) editBtn.style.display = 'block';
}

function patracExitOperator() {
    if (operatorEditDirty && !confirm('Ukon─Źit re┼żim oper├ítor? Neulo┼żen├ę zm─Ťny v aktu├íln├ş editaci mohou b├Żt ztraceny.')) return;
    patracLogout();
}

function renderOperatorClanUI() {
    if (!isOperatorMode) return;
    renderOperatorMemberList();
    renderOperatorEditPanel();
}

function findCommunityByCode(code) {
    if (!code) return null;
    code = String(code).trim().toUpperCase();
    var comms = getPatracCommunities();
    if (comms[code]) return comms[code];
    var accounts = getPatracAccounts();
    for (var id in accounts) {
        if (!Object.prototype.hasOwnProperty.call(accounts, id)) continue;
        var acc = accounts[id];
        if (String(acc.comCode || '').trim().toUpperCase() === code) {
            return {
                name: String(acc.comName || code).trim() || code,
                code: code,
                founder: (comms[code] && comms[code].founder) || '',
                members: [id]
            };
        }
    }
    return null;
}

function findCommunityByCodeWithCloud(code) {
    var local = findCommunityByCode(code);
    if (local) return Promise.resolve(local);
    return withPatracTimeout(
        patracImport('services/communityService.js').then(function(mod) {
            return mod.fetchCommunityMeta(code);
        }),
        15000,
        'community lookup timeout'
    ).then(function(cloud) {
        if (!cloud) return null;
        var comms = getPatracCommunities();
        comms[String(code).trim().toUpperCase()] = cloud;
        localStorage.setItem('patrac_communities', JSON.stringify(comms));
        return cloud;
    }).catch(function(err) {
        console.warn('[community] cloud lookup', code, err);
        return null;
    });
}

function initCloudSyncAsync() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    var session = localStorage.getItem('patrac_session') || '';
    var operatorLocalOnly = isOperatorLocalOnlySession();
    var skipPlayerHydrate = false;
    var skipCommunityLocalMerge = false;
    try {
        skipPlayerHydrate = sessionStorage.getItem('patrac_fresh_register') === '1';
        skipCommunityLocalMerge = skipPlayerHydrate;
        if (skipPlayerHydrate) sessionStorage.removeItem('patrac_fresh_register');
    } catch (e) {}

    var chain = Promise.resolve();

    if (session) {
        chain = chain.then(function() {
            return importAuthService().then(function(mod) {
                return mod.restorePatracSessionFromLocal(session);
            });
        });
    }

    if (session && !skipPlayerHydrate) {
        chain = chain.then(function() {
            return patracImport('services/playerService.js').then(function(mod) {
                return mod.hydratePlayerFromCloud(session);
            });
        });
    }

    if (comCode) {
        chain = chain.then(function() {
            return patracImport('services/communityService.js').then(function(mod) {
                return mod.hydrateCommunityFromCloud(comCode);
            });
        }).catch(function(err) {
            console.warn('[cloud] community meta hydrate', err);
        });
        chain = chain.then(function() {
            return patracImport('services/poiService.js').then(function(mod) {
                return mod.hydrateCommunityPoisFromCloud(comCode).then(function(result) {
                    if (result.ok || operatorLocalOnly || skipCommunityLocalMerge) return result;
                    var localPois = collectCommunityPoisForCloud();
                    if (!localPois.length) return result;
                    return mod.saveCommunityPoisToCloud(comCode, localPois, getPreviousPoiImgById());
                });
            });
        }).catch(function(err) {
            console.warn('[cloud] pois hydrate', err);
            return { ok: false };
        });
        chain = chain.then(function() {
            return patracImport('services/questService.js').then(function(mod) {
                return mod.hydrateCommunityQuestsFromCloud(
                    comCode,
                    skipCommunityLocalMerge ? emptyCommunityQuestsForCloud() : collectCommunityQuestsForCloud(),
                    { readOnly: operatorLocalOnly }
                );
            });
        }).catch(function(err) {
            console.warn('[cloud] quests hydrate', err);
            return { ok: false };
        });
        chain = chain.then(function() {
            snapshotCommunityMapCache(comCode);
        });
    }

    chain.then(function() {
        if (session) {
            try { applyAccountToLocalStorage(session); } catch (e) { console.warn(e); }
            var av = localStorage.getItem('player_avatar');
            if (av) {
                var prev = document.getElementById('avatar-game-preview');
                if (prev) prev.innerHTML = '<img src="' + av + '">';
            }
            try { renderCommunityProfile(); } catch (e) { console.warn(e); }
        }
        if (comCode) {
            try { reconcileCommunityMembersList(comCode); } catch (e) { console.warn(e); }
            try { reconcileCommunityInventory(comCode); } catch (e) { console.warn(e); }
            try { loadCustomCraftedItems(); } catch (e) { console.warn(e); }
            try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
            try { renderQuestList(); } catch (e) { console.warn(e); }
            if (typeof window.patracPoctaReloadMap === 'function') {
                window.patracPoctaReloadMap();
            }
            try { startCommunityRealtimeSync(comCode); } catch (e) { console.warn(e); }
        }
    }).catch(function(err) {
        console.warn('[cloud] hydrate', err);
    });
}

function findAccountByEmail(email) {
    var norm = normalizeEmail(email);
    if (!norm) return null;
    var accounts = getPatracAccounts();
    for (var id in accounts) {
        if (normalizeEmail(accounts[id].email) === norm) {
            return { userId: id, account: accounts[id] };
        }
    }
    return null;
}

function isEmailTaken(email, exceptUserId) {
    var found = findAccountByEmail(email);
    return found && found.userId !== exceptUserId;
}

/** E-mail je obsazen├Ż jen pokud existuje v cloudu ÔÇö star├Ż localStorage ghost se ignoruje. */
function isEmailTakenForRegister(email, exceptUserId) {
    return patracImport('services/accountService.js').then(function(mod) {
        var found = findAccountByEmail(email);
        if (!found || found.userId === exceptUserId) return false;
        return mod.fetchAccountFromCloud(found.userId).then(function(cloud) {
            if (!cloud) {
                var accounts = getPatracAccounts();
                if (accounts[found.userId]) {
                    delete accounts[found.userId];
                    try { savePatracAccounts(accounts); } catch (e) { console.warn(e); }
                }
                return false;
            }
            return normalizeEmail(cloud.email) === normalizeEmail(email);
        });
    }).catch(function(err) {
        console.warn('[register] email cloud verify', err);
        return false;
    });
}

function registerPatracCommunity(comName, founderUserId) {
    var comms = getPatracCommunities();
    var code = generatePatracCode();
    comms[code] = {
        name: comName,
        code: code,
        createdAt: new Date().toISOString(),
        founder: founderUserId || '',
        members: founderUserId ? [founderUserId] : []
    };
    savePatracCommunities(comms);
    return code;
}

function addMemberToCommunity(comCode, userId) {
    var comms = getPatracCommunities();
    var comm = comms[comCode];
    if (!comm) return;
    if (!comm.members) comm.members = [];
    if (comm.members.indexOf(userId) === -1) comm.members.push(userId);
    savePatracCommunities(comms);
}

function removeMemberFromCommunity(comCode, userId) {
    comCode = (comCode || '').toUpperCase();
    if (!comCode || !userId) return;
    var comms = getPatracCommunities();
    var comm = comms[comCode];
    if (!comm || !comm.members) return;
    var idx = comm.members.indexOf(userId);
    if (idx >= 0) comm.members.splice(idx, 1);
    savePatracCommunities(comms);
}

function getNextBotNumber(comCode) {
    var members = getCommunityMemberAccounts(comCode);
    var maxN = 0;
    for (var i = 0; i < members.length; i++) {
        var name = members[i].account.playerName || '';
        var m = /^BOT(\d+)$/i.exec(name.trim());
        if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    return maxN + 1;
}

function purgeBotUserData(userId) {
    if (!userId) return;
    var keys = [
        getPatracProfileKey(userId),
        getPatracItemsPersonalKey(userId),
        getPatracWearKey(userId),
        getPatracAvatarKey(userId),
        getPatracDescKey(userId)
    ];
    for (var i = 0; i < keys.length; i++) {
        try { localStorage.removeItem(keys[i]); } catch (e) {}
    }
}

function operatorAddBotOperative() {
    if (!isOperatorMode) return;
    var comCode = operatorComCode || localStorage.getItem('com_code') || '';
    if (!comCode) {
        alert('Chyb├ş k├│d komunity.');
        return;
    }
    var comm = findCommunityByCode(comCode);
    if (!comm) {
        alert('Komunita nenalezena.');
        return;
    }

    var accounts = getPatracAccounts();
    var n = getNextBotNumber(comCode);
    var botName = 'BOT' + n;
    var userId = 'bot' + n;
    while (accounts[userId]) {
        n++;
        botName = 'BOT' + n;
        userId = 'bot' + n;
    }

    var comName = comm.name || localStorage.getItem('com_name') || '';
    accounts[userId] = slimPatracAccount({
        pass: '',
        email: '',
        comName: comName,
        comCode: comCode,
        playerName: botName,
        playerCode: generatePatracCode(),
        localMissions: 0,
        isBot: true
    });
    savePatracAccounts(accounts);
    addMemberToCommunity(comCode, userId);
    saveUserProfileData(userId, createDefaultUserProfileData(userId));
    reconcileCommunityMembersList(comCode);
    pushPlayerCloudAsync(function(mod) {
        return mod.savePlayerToCloud(userId, { playerName: botName });
    });

    renderOperatorMemberList();
    renderCommunityProfile();
    updateStatsHud();
    alert('P┼Öid├ín testovac├ş operativce ' + botName + ' (ID: ' + userId + ').');
}

function operatorRemoveBotOperative(userId) {
    if (!isOperatorMode || !userId) return;
    var accounts = getPatracAccounts();
    var acc = accounts[userId];
    if (!acc || !isBotAccount(acc)) {
        alert('Lze odstranit pouze testovac├ş BOT operativce.');
        return;
    }
    var comm = getCurrentCommunityRecord();
    if (comm && comm.founder === userId) {
        alert('Tento BOT je zaps├ín jako zakladatel komunity ÔÇö nejd┼Ö├şv p┼Öedej spr├ívcovstv├ş jin├ęmu hr├í─Źi.');
        return;
    }
    if (!confirm('Odstranit ÔÇ×' + (acc.playerName || userId) + 'ÔÇť v─Źetn─Ť profilu a invent├í┼Öe?')) return;

    var comCode = acc.comCode || operatorComCode || localStorage.getItem('com_code') || '';

    if (currentlyEditingPlayerId === userId) {
        currentlyEditingPlayerId = null;
        operatorEditDraft = null;
        operatorEditDirty = false;
        document.body.classList.remove('admin-editing-player');
        try { localStorage.removeItem('patrac_session'); } catch (e) {}
        localStorage.setItem('items_personal', '[]');
    }

    delete accounts[userId];
    savePatracAccounts(accounts);
    removeMemberFromCommunity(comCode, userId);
    purgeBotUserData(userId);
    reconcileCommunityInventory(comCode);

    renderOperatorMemberList();
    renderOperatorEditPanel();
    updateAdminBar();
    renderCommunityProfile();
    loadCustomCraftedItems();
}

function formatPatracCodeLabel(code) {
    return code ? '[' + code + ']' : '';
}

function updateProfileCodeDisplay() {
    var comCodeEl = document.getElementById('display-com-code');
    var playerCodeEl = document.getElementById('display-player-code');
    if (comCodeEl) comCodeEl.textContent = formatPatracCodeLabel(localStorage.getItem('com_code') || '');
    if (playerCodeEl) playerCodeEl.textContent = formatPatracCodeLabel(localStorage.getItem('player_code') || '');
}

function syncCurrentAccountMissionStats() {
    var session = localStorage.getItem('patrac_session');
    if (!session) return;
    var accounts = getPatracAccounts();
    if (!accounts[session]) return;
    var profile = getPlayerProfile();
    accounts[session].localMissions = profile.localMissions || 0;
    accounts[session].playerName = localStorage.getItem('player_name') || accounts[session].playerName;
    try { savePatracAccounts(accounts); } catch (e) { console.warn(e); }
}

function getCurrentCommunityRecord() {
    var comCode = localStorage.getItem('com_code') || '';
    if (!comCode) return null;
    return findCommunityByCode(comCode);
}

function isCommunityAdmin(userId) {
    if (!userId) userId = localStorage.getItem('patrac_session');
    if (!userId) return false;
    var comm = getCurrentCommunityRecord();
    return comm && comm.founder === userId;
}

function getCommunityMemberAccounts(comCode) {
    comCode = normalizeComCodeValue(comCode);
    if (!comCode) return [];
    sanitizeCommunityMembers(comCode);
    var accounts = getPatracAccounts();
    var comm = findCommunityByCode(comCode);
    var list = [];
    var seen = {};

    if (comm && Array.isArray(comm.members)) {
        for (var m = 0; m < comm.members.length; m++) {
            var memberId = comm.members[m];
            if (!memberId || seen[memberId]) continue;
            if (!accountBelongsToCommunity(memberId, comCode, accounts)) continue;
            seen[memberId] = true;
            var acc = accounts[memberId];
            if (!acc) {
                acc = {
                    pass: '',
                    email: '',
                    comName: comm.name || '',
                    comCode: comCode,
                    playerName: localStorage.getItem('patrac_member_name_' + memberId) || memberId,
                    playerCode: '',
                    localMissions: 0
                };
            }
            list.push({ userId: memberId, account: acc });
        }
    }

    for (var id in accounts) {
        if (!Object.prototype.hasOwnProperty.call(accounts, id)) continue;
        if (normalizeComCodeValue(accounts[id].comCode) === comCode && !seen[id]) {
            list.push({ userId: id, account: accounts[id] });
        }
    }
    return list;
}

function getCommunityAggregateStats(comCode) {
    var members = getCommunityMemberAccounts(comCode);
    var total = 0;
    for (var i = 0; i < members.length; i++) {
        total += members[i].account.localMissions || 0;
    }
    return { totalMissions: total, memberCount: members.length, members: members };
}

function getCommunityDivisor() {
    try {
        var raw = localStorage.getItem('patrac_community_divisor');
        if (raw != null && raw !== '') {
            var n = parseFloat(raw);
            if (!isNaN(n) && n > 0) return n;
        }
    } catch (e) {}
    return COMMUNITY_DIVISOR_DEFAULT;
}

function setCommunityDivisor(value) {
    var n = parseFloat(value);
    if (isNaN(n) || n <= 0) return false;
    localStorage.setItem('patrac_community_divisor', String(n));
    return true;
}

function getCommunityRankNamePlural(tier) {
    return COMMUNITY_RANK_NAMES[Math.max(1, Math.min(5, tier)) - 1] || COMMUNITY_RANK_NAMES[0];
}

function formatTeamEfficiencyLabel(efficiency, memberCount) {
    if (!memberCount || memberCount <= 0) return 'ÔÇö';
    var rounded = Math.round(efficiency * 100) / 100;
    return rounded.toFixed(1).replace('.', ',') + '├Ś';
}

function formatCommunityXp(value) {
    var n = Math.round(value * 10) / 10;
    return (n % 1 === 0) ? String(n) : n.toFixed(1).replace('.', ',');
}

function getCommunityMissionsNeededForNextTier(totalXP, tier, memberCount, divisor) {
    if (tier >= 5) return null;
    var thresholds = getTierThresholds();
    var nextThreshold = thresholds[tier - 1];
    var targetTotalXP = nextThreshold * memberCount * divisor;
    var needed = targetTotalXP - totalXP;
    if (needed <= 0) return 1;
    return Math.ceil(needed - 1e-9);
}

function buildCommunityNextRankHint(totalXP, tier, memberCount, divisor) {
    if (tier >= 5) return 'Nejvy┼í┼í├ş hodnost dosa┼żena';
    if (memberCount <= 0) {
        return buildNextRankHint(0, 1, COMMUNITY_RANK_NAMES, { unitLabel: 'mis├ş' });
    }
    var missionsNeeded = getCommunityMissionsNeededForNextTier(totalXP, tier, memberCount, divisor);
    var nextName = COMMUNITY_RANK_NAMES[tier];
    return 'Dal┼í├ş hodnost ' + nextName + ' za ' + missionsNeeded + ' mis├ş';
}

function calculateCommunityRank(comCode) {
    var stats = getCommunityAggregateStats(comCode || '');
    var divisor = getCommunityDivisor();
    var memberCount = stats.memberCount;
    var totalXP = stats.totalMissions || 0;

    if (memberCount <= 0) {
        return {
            totalXP: 0,
            communityXP: 0,
            memberCount: 0,
            tier: 1,
            rankLabel: getCommunityRankNamePlural(1) + ' [' + getTierSymbols(1) + ']',
            teamEfficiency: 1,
            teamEfficiencyLabel: 'ÔÇö',
            divisor: divisor,
            nextRankHint: buildCommunityNextRankHint(0, 1, 0, divisor)
        };
    }

    var communityXP = totalXP / (memberCount * divisor);
    var tier = getTierFromMissionCount(communityXP);
    var teamEfficiency = divisor / memberCount;
    var nextRankHint = buildCommunityNextRankHint(totalXP, tier, memberCount, divisor);

    return {
        totalXP: totalXP,
        communityXP: communityXP,
        memberCount: memberCount,
        tier: tier,
        rankLabel: getCommunityRankNamePlural(tier) + ' [' + getTierSymbols(tier) + ']',
        teamEfficiency: teamEfficiency,
        teamEfficiencyLabel: formatTeamEfficiencyLabel(teamEfficiency, memberCount),
        divisor: divisor,
        nextRankHint: nextRankHint
    };
}

function applyCommunityRankToDisplays(comCode) {
    var rank = calculateCommunityRank(comCode);
    var pairs = [
        ['display-com-rank', rank.rankLabel],
        ['display-com-missions', rank.totalXP],
        ['display-com-efficiency', rank.teamEfficiencyLabel]
    ];
    for (var i = 0; i < pairs.length; i++) {
        var el = document.getElementById(pairs[i][0]);
        if (el) el.textContent = pairs[i][1];
    }
    var nextHint = rank.nextRankHint || '';
    var nextEls = ['display-com-rank-next'];
    for (var n = 0; n < nextEls.length; n++) {
        var nel = document.getElementById(nextEls[n]);
        if (nel) nel.textContent = nextHint;
    }
    return rank;
}

function syncCommunityDivisorInput() {
    /* divisor UI p┼Öesunut ÔÇö migrace profilu pozd─Ťji */
}

function renderCommunityProfile(options) {
    options = options || {};
    var comNameEl = document.getElementById('display-com-name');
    var comRankEl = document.getElementById('display-com-rank');
    var comMissionsEl = document.getElementById('display-com-missions');
    var membersEl = document.getElementById('community-members-list');
    var adminBadge = document.getElementById('com-admin-badge');
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    var session = localStorage.getItem('patrac_session') || '';

    if (comNameEl) comNameEl.textContent = localStorage.getItem('com_name') || '---';
    updateRadioDisplayHud();
    updateProfileCodeDisplay();

    if (!comCode) {
        if (comRankEl) comRankEl.textContent = 'ÔÇö';
        if (comMissionsEl) comMissionsEl.textContent = '0';
        var effEl = document.getElementById('display-com-efficiency');
        if (effEl) effEl.textContent = 'ÔÇö';
        var comRankNext = document.getElementById('display-com-rank-next');
        if (comRankNext) comRankNext.textContent = '';
        if (membersEl) membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Bez komunity</span>';
        if (adminBadge) adminBadge.style.display = 'none';
        return;
    }

    applyCommunityRankToDisplays(comCode);
    reconcileCommunityMembersList(comCode);
    var stats = getCommunityAggregateStats(comCode);

    if (adminBadge) adminBadge.style.display = isCommunityAdmin(session) ? 'block' : 'none';

    if (!membersEl) return;
    if (stats.members.length === 0) {
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zat├şm ┼ż├ídn├ş p├ítra─Źi</span>';
        membersEl.classList.remove('is-scrollable');
        return;
    }

    if (!options.skipMembersList) {
        refreshCommunityMembersPanel(!!options.scrollToActive);
    }
    populateTransferAdminSelect();
    renderShelterStory();
}

function populateTransferAdminSelect() {
    var sel = document.getElementById('edit-transfer-admin');
    var block = document.getElementById('profile-admin-block');
    if (!sel || !block) return;
    var session = localStorage.getItem('patrac_session');
    var comCode = localStorage.getItem('com_code') || '';
    if (!isCommunityAdmin(session) || !comCode) {
        block.style.display = 'none';
        return;
    }
    block.style.display = 'block';
    var members = getCommunityMemberAccounts(comCode);
    var html = '<option value="">ÔÇö vyber p├ítra─Źe ÔÇö</option>';
    for (var i = 0; i < members.length; i++) {
        if (members[i].userId === session) continue;
        html += '<option value="' + members[i].userId + '">' + (members[i].account.playerName || members[i].userId) + '</option>';
    }
    sel.innerHTML = html;
}

var base64ProfileEditAvatar = '';

function toggleProfileEditPanel() {
    var panel = document.getElementById('profile-edit-panel');
    var btn = document.getElementById('btn-toggle-profile-edit');
    if (!panel) return;
    var open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (btn) {
        btn.classList.toggle('open', open);
        btn.textContent = open ? 'ÔťÄ SKR├ŁT ├ÜPRAVU PROFILU' : 'ÔťÄ UPRAVIT PROFIL OPERATIVCE';
    }
    if (open) fillProfileEditForm();
}

function fillProfileEditForm() {
    var session = localStorage.getItem('patrac_session');
    if (!session) return;
    var acc = getPatracAccounts()[session] || {};
    var nameEl = document.getElementById('edit-player-name');
    var descEl = document.getElementById('edit-player-desc');
    var emailEl = document.getElementById('edit-player-email');
    if (nameEl) nameEl.value = localStorage.getItem('player_name') || acc.playerName || '';
    if (descEl) descEl.value = localStorage.getItem('player_desc') || '';
    if (emailEl) emailEl.value = acc.email || '';
    base64ProfileEditAvatar = '';
    var av = localStorage.getItem('player_avatar') || '';
    updateAvatarPreviewElements(av);
    populateTransferAdminSelect();
}

function previewProfileEditAvatar(input) {
    if (!input.files || !input.files[0]) return;
    compressAvatarForStorage(input.files[0], function(result) {
        if (!result) {
            alert('Avatar se nepoda┼Öilo zpracovat. Zkus men┼í├ş nebo jinou fotku.');
            return;
        }
        base64ProfileEditAvatar = result;
        updateAvatarPreviewElements(result);
    });
}

function saveProfileEdits() {
    var session = localStorage.getItem('patrac_session');
    if (!session) { alert('Nejsi p┼Öihl├í┼íen.'); return; }
    var accounts = getPatracAccounts();
    var acc = accounts[session];
    if (!acc) return;

    var newName = document.getElementById('edit-player-name').value.trim();
    var newDesc = document.getElementById('edit-player-desc').value.trim();
    var newEmail = normalizeEmail(document.getElementById('edit-player-email').value);
    var newPass = document.getElementById('edit-player-pass').value;

    if (!newName) { alert('Jm├ęno operativce je povinn├ę.'); return; }
    if (!isValidEmail(newEmail)) { alert('Zadej platn├Ż email.'); return; }
    if (isEmailTaken(newEmail, session)) { alert('Tento email u┼ż pou┼ż├şv├í jin├Ż ├║─Źet.'); return; }
    if (newPass && newPass.length < 6) { alert('Nov├ę heslo mus├ş m├şt alespo┼ł 6 znak┼» (Firebase).'); return; }

    acc.playerName = newName;
    acc.email = newEmail;
    if (newPass) acc.pass = newPass;
    accounts[session] = slimPatracAccount(acc);
    try {
        savePatracAccounts(accounts);
    } catch (e) {
        alert(e.message || e);
        return;
    }

    localStorage.setItem('player_name', newName);
    localStorage.setItem('patrac_member_name_' + session, newName);
    saveUserDesc(session, newDesc);
    if (newDesc) localStorage.setItem('player_desc', newDesc);
    else localStorage.removeItem('player_desc');
    pushPlayerCloudAsync(function(mod) {
        return mod.savePlayerToCloud(session, { playerName: newName, desc: newDesc });
    });
    if (base64ProfileEditAvatar) {
        if (!saveUserAvatar(session, base64ProfileEditAvatar)) {
            alert('Avatar se nepoda┼Öilo ulo┼żit ÔÇö localStorage je pln├ę nebo je fotka p┼Ö├şli┼í velk├í.');
            return;
        }
    }

    document.getElementById('display-player-name').textContent = newName;
    if (localStorage.getItem('player_avatar')) {
        updateAvatarPreviewElements(localStorage.getItem('player_avatar'));
    }
    renderCommunityProfile();
    alert('Profil operativce ulo┼żen.');
}

function transferCommunityAdmin() {
    var session = localStorage.getItem('patrac_session');
    if (!isCommunityAdmin(session)) { alert('Pouze spr├ívce m┼»┼że p┼Öedat spr├ívcovstv├ş.'); return; }
    var sel = document.getElementById('edit-transfer-admin');
    var newAdmin = sel ? sel.value : '';
    if (!newAdmin) { alert('Vyber nov├ęho spr├ívce.'); return; }
    var comCode = localStorage.getItem('com_code');
    var comms = getPatracCommunities();
    if (!comCode || !comms[comCode]) return;
    if (!confirm('P┼Öedat spr├ívcovstv├ş komunity p├ítra─Źi ÔÇ×' + (sel.options[sel.selectedIndex].text || newAdmin) + 'ÔÇť? Tuto akci lze zvr├ítit jen nov├Żm spr├ívcem.')) return;
    comms[comCode].founder = newAdmin;
    savePatracCommunities(comms);
    renderCommunityProfile();
    fillProfileEditForm();
    alert('Spr├ívcovstv├ş p┼Öed├íno.');
}

function toggleCraftSection() {
    var body = document.getElementById('section-craft');
    var btn = document.getElementById('toggle-craft-section');
    if (!body || !btn) return;
    var isOpen = body.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    try { localStorage.setItem('craft_section_open', isOpen ? '1' : '0'); } catch (e) {}
}

function initCraftSection() {
    var open = localStorage.getItem('craft_section_open') === '1';
    var body = document.getElementById('section-craft');
    var btn = document.getElementById('toggle-craft-section');
    if (body) body.classList.toggle('open', open);
    if (btn) btn.classList.toggle('open', open);
}

function patracRecoverPassword() {
    hideGateError('gate-recover-error');
    var userId = normalizePatracId(document.getElementById('input-recover-id').value);
    var email = normalizeEmail(document.getElementById('input-recover-email').value);
    var pass = document.getElementById('input-recover-pass').value;
    var pass2 = document.getElementById('input-recover-pass2').value;
    if (!userId) {
        showGateError('gate-recover-error', 'Zadej u┼żivatelsk├ę ID operativce.');
        return;
    }
    var idErr = validatePatracUserIdInput(userId, 'gate-recover-error');
    if (idErr) {
        showGateError('gate-recover-error', idErr);
        return;
    }
    if (!isValidEmail(email)) {
        showGateError('gate-recover-error', 'gate.errors.recoverBadEmail');
        return;
    }
    if (pass.length < 6) {
        showGateError('gate-recover-error', 'gate.errors.recoverShortPass');
        return;
    }
    if (pass !== pass2) {
        showGateError('gate-recover-error', 'gate.errors.recoverPassMismatch');
        return;
    }
    var localAcc = getPatracAccounts()[userId] || null;

    importAuthService().then(function(mod) {
        return mod.recoverPatracPassword(userId, email, pass, localAcc);
    }).then(function() {
        var accounts = getPatracAccounts();
        if (accounts[userId]) {
            accounts[userId].pass = pass;
            accounts[userId].email = email;
            savePatracAccounts(accounts);
        }
        alert('Heslo obnoveno. P┼Öihlas se sv├Żm u┼żivatelsk├Żm ID: ' + userId);
        switchGatePage('gate-login');
    }).catch(function(err) {
        console.warn('[auth] recover', err);
        showGateError('gate-recover-error', err.message || 'Obnova hesla selhala.');
    });
}

function gateErr(key, opts) {
    if (window.patracT) return window.patracT(key, opts);
    return key;
}

function gateErrorFallback(key) {
    var map = {
        'gate.errors.loginMissingId': 'CHYBA: Zadej u┼żivatelsk├ę ID.',
        'gate.errors.loginUnknownId': 'CHYBA: ID nen├ş v s├şti, nebo heslo nesed├ş. Zkus znovu, nebo obnovu hesla.',
        'gate.errors.loginBadPass': 'CHYBA: Heslo nesouhlas├ş. Sign├íl zam├ştnut.',
        'gate.errors.loginFailed': 'CHYBA: P┼Öihl├í┼íen├ş selhalo ÔÇö zkontroluj p┼Öipojen├ş a zkus znovu.'
    };
    return map[key] || key;
}

function showGateError(elId, msgOrKey, opts) {
    var el = document.getElementById(elId);
    if (!el) return;
    var msg = msgOrKey;
    if (typeof msgOrKey === 'string' && msgOrKey.indexOf('gate.errors.') === 0) {
        if (window.patracT) msg = window.patracT(msgOrKey, opts || {});
        if (!msg || msg === msgOrKey) msg = gateErrorFallback(msgOrKey);
    }
    el.textContent = msg;
    el.classList.add('visible');
    try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
}

function hideGateError(elId) {
    var el = document.getElementById(elId);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
}

function normalizePatracId(raw) {
    return String(raw || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/^\.+|\.+$/g, '');
}

function getPatracAccounts() {
    try {
        var data = localStorage.getItem('patrac_accounts');
        if (data) return sanitizePatracAccounts(JSON.parse(data));
    } catch (e) {}
    return {};
}

function applyAccountToLocalStorage(userId) {
    var accounts = getPatracAccounts();
    var acc = accounts[userId];
    if (!acc) return false;
    localStorage.setItem('patrac_session', userId);
    localStorage.setItem('player_name', acc.playerName || '');
    localStorage.setItem('player_code', acc.playerCode || '');
    if (isOperatorMode) {
        syncOperatorCommunityContext();
    } else {
        localStorage.setItem('com_name', acc.comName || '');
        localStorage.setItem('com_code', acc.comCode || '');
    }
    var avatar = localStorage.getItem(getPatracAvatarKey(userId)) || '';
    if (avatar) localStorage.setItem('player_avatar', avatar);
    else localStorage.removeItem('player_avatar');
    var desc = localStorage.getItem(getPatracDescKey(userId)) || '';
    if (desc) localStorage.setItem('player_desc', desc);
    else localStorage.removeItem('player_desc');
    loadUserPersonalItemsIntoSession(userId);
    return true;
}

function ensureLegacyPatracCodes(userId, acc) {
    var changed = false;
    if (!acc.playerCode) {
        acc.playerCode = generatePatracCode();
        changed = true;
    }
    if (!acc.comCode && acc.comName) {
        var comms = getPatracCommunities();
        var foundCode = null;
        for (var k in comms) {
            if (comms[k].name === acc.comName) { foundCode = k; break; }
        }
        if (foundCode) {
            acc.comCode = foundCode;
        } else {
            acc.comCode = registerPatracCommunity(acc.comName, userId);
        }
        changed = true;
    }
    if (!acc.email) { acc.email = ''; changed = true; }
    return changed;
}

function migrateLegacyPatracAccount() {
    if (localStorage.getItem('patrac_legacy_migrated') === '1') return;
    var com = localStorage.getItem('com_name');
    var player = localStorage.getItem('player_name');
    if (!com || !player) return;
    var accounts = getPatracAccounts();
    if (Object.keys(accounts).length > 0) {
        localStorage.setItem('patrac_legacy_migrated', '1');
        return;
    }
    var id = normalizePatracId(player) || 'patrac_' + Date.now();
    var playerCode = generatePatracCode();
    var comCode = registerPatracCommunity(com, id);
    accounts[id] = slimPatracAccount({
        pass: '',
        email: '',
        comName: com,
        comCode: comCode,
        playerName: player,
        playerCode: playerCode,
        localMissions: (getPlayerProfile().localMissions || 0)
    });
    var legacyAvatar = localStorage.getItem('player_avatar');
    if (legacyAvatar) saveUserAvatar(id, legacyAvatar);
    saveUserDesc(id, localStorage.getItem('player_desc') || '');
    savePatracAccounts(accounts);
    localStorage.setItem('com_code', comCode);
    localStorage.setItem('player_code', playerCode);
    localStorage.setItem('patrac_session', id);
    localStorage.setItem('patrac_legacy_migrated', '1');
}

function resolveLocalPatracAccount(userId) {
    var accounts = getPatracAccounts();
    if (accounts[userId]) return accounts[userId];
    if (accounts[userId + '.']) return accounts[userId + '.'];
    for (var k in accounts) {
        if (accounts.hasOwnProperty(k) && normalizePatracId(k) === userId) return accounts[k];
    }
    return null;
}

function withPatracTimeout(promise, ms, message) {
    return new Promise(function(resolve, reject) {
        var done = false;
        var timer = setTimeout(function() {
            if (done) return;
            done = true;
            reject(new Error(message || 'Vypr┼íel ─Źasov├Ż limit ÔÇö obnov str├ínku (Ctrl+F5) a zkus znovu.'));
        }, ms || 45000);
        Promise.resolve(promise).then(function(v) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(v);
        }, function(e) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            reject(e);
        });
    });
}

