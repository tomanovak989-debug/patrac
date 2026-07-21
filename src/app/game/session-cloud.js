/* PATRAC: cloud sync, accounts, community profile */
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

