/* PATRAC: operator mode UI and community lookup */
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

