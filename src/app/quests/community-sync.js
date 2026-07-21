/* PATRAC: quest launch, cloud sync, accounts migration */
function parseQuestTimeToMs(timeStr) {
    var raw = String(timeStr || '').trim().toLowerCase();
    var m = /^(\d+(?:\.\d+)?)\s*(h|m|min|d)?$/.exec(raw);
    if (!m) return 2 * 3600000;
    var n = parseFloat(m[1]);
    var unit = m[2] || 'h';
    if (unit === 'm' || unit === 'min') return n * 60000;
    if (unit === 'd') return n * 86400000;
    return n * 3600000;
}

function getCommunityLaunchedQuests() {
    var comCode = (localStorage.getItem('com_code') || operatorComCode || '').toUpperCase();
    if (!comCode) return {};
    try {
        var raw = localStorage.getItem('patrac_quest_launched_' + comCode);
        if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
}

function setCommunityLaunchedQuests(launched) {
    var comCode = (localStorage.getItem('com_code') || operatorComCode || '').toUpperCase();
    if (!comCode) return;
    localStorage.setItem('patrac_quest_launched_' + comCode, JSON.stringify(launched || {}));
}

function getLaunchedQuestEntry(questId) {
    var launched = getCommunityLaunchedQuests();
    return launched[questId] || null;
}

function isCommunityQuestType(questId) {
    return !!(questId && !gameQuests[questId]);
}

function usesCommunityLaunchQuest(questId) {
    return !!(questId && (gameQuests[questId] || isCommunityQuestType(questId)));
}

function isPlayerCompletedCurrentRun(questId, userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId) return false;
    var entry = getLaunchedQuestEntry(questId);
    if (!entry || !entry.completions) return false;
    return !!entry.completions[userId];
}

function isQuestLaunchedCommunityWide(questId) {
    var entry = getLaunchedQuestEntry(questId);
    return !!(entry && !entry.closed);
}

function isQuestRunExpired(questId) {
    var entry = getLaunchedQuestEntry(questId);
    if (!entry) return false;
    if (entry.closed) return true;
    return Date.now() > (entry.expiresAt || 0);
}

function getPlayerQuestMissedMap(userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId) return {};
    try {
        var raw = localStorage.getItem('patrac_quest_missed_' + userId);
        if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
}

function isQuestMissedByPlayer(questId, userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    var entry = getLaunchedQuestEntry(questId);
    if (entry && entry.completions && entry.completions[userId]) return false;
    if (entry && entry.closed && userId) {
        if (!entry.completions || !entry.completions[userId]) {
            var missedMap = getPlayerQuestMissedMap(userId);
            var missed = missedMap[questId];
            if (missed) {
                var runStartedAt = typeof missed === 'object' ? missed.runStartedAt : entry.startedAt;
                if (runStartedAt === entry.startedAt) return true;
            }
            return true;
        }
    }
    return false;
}

function markQuestMissedByPlayer(questId, userId, runStartedAt) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId || !questId) return;
    var entry = getLaunchedQuestEntry(questId);
    var missed = getPlayerQuestMissedMap(userId);
    missed[questId] = {
        runStartedAt: runStartedAt != null ? runStartedAt : (entry ? entry.startedAt : Date.now()),
        at: Date.now()
    };
    localStorage.setItem('patrac_quest_missed_' + userId, JSON.stringify(missed));
}

function launchCommunityQuest(questId, q) {
    var launched = getCommunityLaunchedQuests();
    var now = Date.now();
    launched[questId] = {
        startedAt: now,
        expiresAt: isStoryQuestId(questId) ? (now + 365 * 24 * 60 * 60 * 1000) : (now + parseQuestTimeToMs(q.time)),
        startedBy: localStorage.getItem('patrac_session') || '',
        startedByName: localStorage.getItem('player_name') || 'Operativec',
        closed: false,
        completions: {},
        pendingPosition: null,
        noPlacementCountdown: !!gameQuests[questId]
    };
    setCommunityLaunchedQuests(launched);
    try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
}

function applyStoryPendingPositionNow(questId, entry) {
    if (!entry || !entry.pendingPosition || entry.positionApplied) return false;
    if (!applyStoryPositionFromLaunch(questId, entry.pendingPosition)) return false;
    var launched = getCommunityLaunchedQuests();
    if (!launched[questId]) launched[questId] = entry;
    launched[questId].positionApplied = true;
    setCommunityLaunchedQuests(launched);
    syncCommunityQuestsToCloud();
    try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
    rebuildCustomLocLinkSelect();
    renderStoryPositionsList();
    return true;
}

function recordStoryRunCompletion(questId, lat, lng) {
    var launched = getCommunityLaunchedQuests();
    var entry = launched[questId];
    if (!entry) return;
    var session = localStorage.getItem('patrac_session') || '';
    var name = localStorage.getItem('player_name') || 'Operativec';
    if (!entry.completions) entry.completions = {};
    entry.completions[session] = { lat: lat, lng: lng, at: Date.now(), name: name };
    if (!entry.pendingPosition) {
        entry.pendingPosition = {
            lat: lat,
            lng: lng,
            confirmedBy: session,
            confirmedByName: name,
            confirmedAt: Date.now()
        };
    }
    setCommunityLaunchedQuests(launched);
    applyStoryPendingPositionNow(questId, entry);
}

function applyStoryPositionFromLaunch(questId, pendingPosition) {
    if (!gameQuests[questId] || !pendingPosition) return false;
    var lat = parseFloat(pendingPosition.lat);
    var lng = parseFloat(pendingPosition.lng);
    if (isNaN(lat) || isNaN(lng)) return false;
    saveQuestCoords(questId, lat, lng);
    var q = gameQuests[questId];
    renderPointOnMap(questId, lat, lng, q.mapLabel || q.title, q.desc);
    return true;
}

function applyStoryPendingPositions() {
    var launched = getCommunityLaunchedQuests();
    var changed = false;
    var mapChanged = false;
    for (var questId in launched) {
        if (!Object.prototype.hasOwnProperty.call(launched, questId)) continue;
        var entry = launched[questId];
        if (!gameQuests[questId] || !entry || !entry.pendingPosition || entry.positionApplied) continue;
        if (applyStoryPositionFromLaunch(questId, entry.pendingPosition)) {
            entry.positionApplied = true;
            changed = true;
            mapChanged = true;
        }
    }
    if (changed) setCommunityLaunchedQuests(launched);
    if (changed) syncCommunityQuestsToCloud();
    if (mapChanged) {
        try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
    }
    return changed;
}

function ensureClosedStoryPositionsApplied() {
    applyStoryPendingPositions();
    var launched = getCommunityLaunchedQuests();
    var changed = false;
    var mapChanged = false;
    for (var questId in launched) {
        if (!Object.prototype.hasOwnProperty.call(launched, questId)) continue;
        var entry = launched[questId];
        if (!gameQuests[questId] || !entry || !entry.closed || !entry.pendingPosition || entry.positionApplied) continue;
        if (applyStoryPositionFromLaunch(questId, entry.pendingPosition)) {
            entry.positionApplied = true;
            changed = true;
            mapChanged = true;
        }
    }
    if (changed) setCommunityLaunchedQuests(launched);
    if (changed) syncCommunityQuestsToCloud();
    if (mapChanged) {
        try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
    }
    return changed;
}

function processCommunityQuestExpiries() {
    var launched = getCommunityLaunchedQuests();
    var now = Date.now();
    var session = localStorage.getItem('patrac_session') || '';
    var changed = false;
    var playerChanged = false;

    for (var questId in launched) {
        if (!Object.prototype.hasOwnProperty.call(launched, questId)) continue;
        var entry = launched[questId];
        if (!entry || entry.closed) continue;
        if (now <= (entry.expiresAt || 0)) continue;

        entry.closed = true;
        changed = true;

        if (gameQuests[questId] && entry.pendingPosition && !entry.positionApplied) {
            if (applyStoryPositionFromLaunch(questId, entry.pendingPosition)) {
                entry.positionApplied = true;
                try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
            }
        }

        if (session) {
            var q = getQuestById(questId);
            var completedRun = entry.completions && entry.completions[session];
            if (q && !completedRun && !isQuestMissedByPlayer(questId, session)) {
                markQuestMissedByPlayer(questId, session, entry.startedAt);
                playerChanged = true;
            }
        }
    }

    if (changed) setCommunityLaunchedQuests(launched);
    if (changed) syncCommunityQuestsToCloud();
    if (playerChanged) syncPlayerQuestProgressToCloud();
    ensureClosedStoryPositionsApplied();
    return changed || playerChanged;
}

function isQuestUnlockedForPlayer(questId) {
    if (isQuestMissedByPlayer(questId)) return false;
    if (isQuestLaunchedCommunityWide(questId) && !isQuestRunExpired(questId)) return true;
    if (gameQuests[questId]) return false;
    return localStorage.getItem('unlocked_story_' + questId) === 'true';
}

function formatQuestCountdown(questId) {
    var entry = getLaunchedQuestEntry(questId);
    if (!entry || entry.closed) return '';
    var left = (entry.expiresAt || 0) - Date.now();
    if (left <= 0) return 'vyprÔö╝├şelo';
    var mins = Math.ceil(left / 60000);
    if (mins >= 60) return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    return mins + ' min';
}

function renderCommunityQuestStatusHtml(questId, q) {
    if (!usesCommunityLaunchQuest(questId)) return '';
    if (isStoryQuestId(questId) && isPlayerCompletedCurrentRun(questId)) {
        if (isStoryQuestPlaced(questId)) {
            return '<div style="font-size:var(--text-sm);color:var(--text-green);margin:4px 0;">├ö┼ą┼» VÔöť┼╗kon potvrzen ├ö├ç├Â rank zapsÔöť├şn. TrvalÔöť┼╗ bod je na mapÔöÇ┼Ą.</div>';
        }
        return '<div style="font-size:var(--text-sm);color:var(--danger-orange);margin:4px 0;">├ö┼ą┼» VÔöť┼╗kon potvrzen ├ö├ç├Â rank zapsÔöť├şn, ale bod na mapÔöÇ┼Ą chybÔöť┼č. PouÔö╝┼╝ij ├ö─çÔĽĹ RESET a zamÔöÇ┼ĄÔö╝├ľ znovu.</div>';
    }
    if (!isStoryQuestId(questId) && isQuestCompleted(q)) return '';
    if (isQuestMissedByPlayer(questId)) {
        return '<div class="logistics-error" style="display:block;margin:4px 0;">├ö─ćÔľĺ LhÔö╝┬╗ta vyprÔö╝├şela ├ö├ç├Â rank za tuto misi nezÔöť┼čskÔöť├şÔö╝├ş.</div>';
    }
    var entry = getLaunchedQuestEntry(questId);
    if (!entry) return '';
    var starter = entry.startedByName || entry.startedBy || 'komunita';
    var html = '<div style="font-size:var(--text-sm);color:var(--accent-gold);margin:4px 0;">┬ş─Ź├┤├ş SpuÔö╝├ştÔöÇ┼Ąno: ' + starter + '</div>';
    html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">KaÔö╝┼╝dÔöť┼╗ pÔöť├ştraÔöÇ┼╣ musÔöť┼č potvrdit vÔöť┼╗kon na mÔöť┼čstÔöÇ┼Ą sÔöť├şm ├ö├ç├Â jinak rank nezÔöť┼čskÔöť├ş.</div>';
    if (isStoryQuestId(questId)) {
        html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">TrvalÔöť┼╗ bod se na mapÔöÇ┼Ą aktualizuje hned po potvrzenÔöť┼č GPS.</div>';
    } else {
        var cd = formatQuestCountdown(questId);
        html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">ZbÔöť┼╗vÔöť├ş ~' + cd + '</div>';
    }
    return html;
}

function enrichQuestWithCoordsFromPoints(quest, points) {
    if (!quest || !quest.id) return quest;
    var copy = JSON.parse(JSON.stringify(quest));
    var pt = points && points[quest.id];
    var lat = pt && pt.lat != null && pt.lat !== '' ? parseFloat(pt.lat) : (copy.lat != null ? parseFloat(copy.lat) : null);
    var lng = pt && pt.lng != null && pt.lng !== '' ? parseFloat(pt.lng) : (copy.lng != null ? parseFloat(copy.lng) : null);
    copy.lat = typeof lat === 'number' && !isNaN(lat) ? lat : null;
    copy.lng = typeof lng === 'number' && !isNaN(lng) ? lng : null;
    return copy;
}

function enrichQuestWithCoords(quest) {
    if (!quest || !quest.id) return quest;
    var copy = JSON.parse(JSON.stringify(quest));
    var lat = localStorage.getItem('point_' + quest.id + '_lat');
    var lng = localStorage.getItem('point_' + quest.id + '_lng');
    copy.lat = lat ? parseFloat(lat) : (copy.lat != null ? parseFloat(copy.lat) : null);
    copy.lng = lng ? parseFloat(lng) : (copy.lng != null ? parseFloat(copy.lng) : null);
    return copy;
}

function collectCommunityQuestsForCloud() {
    var story = {};
    var storyIds = getStoryQuestIds();
    for (var i = 0; i < storyIds.length; i++) {
        var id = storyIds[i];
        var lat = localStorage.getItem('point_' + id + '_lat');
        var lng = localStorage.getItem('point_' + id + '_lng');
        story[id] = {
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null
        };
    }
    var custom = getSafeJSON('custom_quests_list').map(enrichQuestWithCoords);
    var random = getRandomQuestsList().map(enrichQuestWithCoords);
    return {
        version: 1,
        story: story,
        custom: custom,
        random: random,
        dismissed: getDismissedQuests(),
        reqOverrides: getQuestReqOverrides(),
        launched: getCommunityLaunchedQuests(),
        updatedAt: Date.now()
    };
}

function syncCommunityQuestsToCloud() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    snapshotCommunityMapCache(comCode);
    if (isOperatorLocalOnlySession()) {
        if (typeof reloadAllMapPoints === 'function') reloadAllMapPoints();
        if (typeof renderQuestList === 'function') renderQuestList();
        return;
    }
    var quests = collectCommunityQuestsForCloud();
    patracImport('services/questService.js').then(function(mod) {
        return mod.saveCommunityQuestsToCloud(comCode, quests);
    }).then(function() {
        if (typeof reloadAllMapPoints === 'function') reloadAllMapPoints();
        if (typeof renderQuestList === 'function') renderQuestList();
    }).catch(function(err) {
        console.warn('[cloud] quests sync', err);
    });
}

function collectPlayerQuestProgressForCloud(userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId) return null;
    var data = getUserProfileData(userId);
    var unlocked = {};
    function markUnlocked(id) {
        if (localStorage.getItem('unlocked_story_' + id) === 'true') unlocked[id] = true;
    }
    var storyIds = getStoryQuestIds();
    for (var s = 0; s < storyIds.length; s++) markUnlocked(storyIds[s]);
    var customQuests = getSafeJSON('custom_quests_list');
    for (var c = 0; c < customQuests.length; c++) markUnlocked(customQuests[c].id);
    var randomQuests = getRandomQuestsList();
    for (var r = 0; r < randomQuests.length; r++) markUnlocked(randomQuests[r].id);

    var done = snapshotQuestDoneFromLocalStorage();
    var missed = getPlayerQuestMissedMap(userId);

    var terminal = { activatedCodes: [], poctaInventoryIds: [] };
    try {
        var termRaw = localStorage.getItem('patrac_terminal_' + userId);
        if (termRaw) terminal = JSON.parse(termRaw);
    } catch (e) {}
    if (!Array.isArray(terminal.activatedCodes)) terminal.activatedCodes = [];
    if (!Array.isArray(terminal.poctaInventoryIds)) terminal.poctaInventoryIds = [];

    return {
        missions: {
            localMissions: data.localMissions || 0,
            globalMissions: data.globalMissions != null ? data.globalMissions : (data.localMissions || 0),
            localIssuerStats: data.localIssuerStats || emptyIssuerStats(),
            globalIssuerStats: data.globalIssuerStats || emptyIssuerStats(),
            missionLog: data.missionLog || []
        },
        quests: {
            done: done,
            unlocked: unlocked,
            missed: missed
        },
        terminal: terminal
    };
}

function syncPlayerQuestProgressToCloud() {
    var userId = localStorage.getItem('patrac_session') || '';
    if (!userId || isOperatorMode) return;
    var progress = collectPlayerQuestProgressForCloud(userId);
    if (!progress) return;
    patracImport('services/playerService.js').then(function(mod) {
        return mod.syncPlayerProgressToCloud(userId, progress);
    }).catch(function(err) {
        console.warn('[cloud] player quest sync', err);
    });
}

var patracCommunityUnsubscribe = null;

function startCommunityRealtimeSync(comCode) {
    comCode = (comCode || localStorage.getItem('com_code') || operatorComCode || '').toUpperCase();
    if (!comCode) return;
    if (isOperatorLocalOnlySession()) return;
    patracImport('services/questService.js').then(function(mod) {
        if (patracCommunityUnsubscribe) {
            patracCommunityUnsubscribe();
            patracCommunityUnsubscribe = null;
        }
        return mod.subscribeCommunityRealtime(comCode, function(payload) {
            if (Array.isArray(payload.inventory)) {
                var invKey = 'patrac_items_community_' + comCode;
                localStorage.setItem(invKey, JSON.stringify(payload.inventory));
                localStorage.setItem('items_community', JSON.stringify(payload.inventory));
                try { loadCustomCraftedItems(); } catch (e) { console.warn(e); }
            }
            if (payload.quests) {
                var merged = mod.mergeCommunityQuests(payload.quests, collectCommunityQuestsForCloud());
                mod.applyCommunityQuestsToLocalStorage(merged);
                snapshotCommunityMapCache(comCode);
                try { processCommunityQuestExpiries(); } catch (e) { console.warn(e); }
                try { ensureClosedStoryPositionsApplied(); } catch (e) { console.warn(e); }
                try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
                try { renderQuestList(); } catch (e) { console.warn(e); }
            }
        }).then(function(unsub) {
            patracCommunityUnsubscribe = unsub;
        });
    }).catch(function(err) {
        console.warn('[cloud] community realtime', err);
    });
}

function pushUserAvatarDataUrlToCloud(userId, dataUrl) {
    Promise.all([
        patracImport('services/dataService.js'),
        patracImport('services/playerService.js')
    ]).then(function(mods) {
        return mods[0].uploadAvatarFromDataUrl(userId, dataUrl).then(function(url) {
            safeLocalStorageSet(getPatracAvatarKey(userId), url);
            safeLocalStorageSet('player_avatar', url);
            return mods[1].syncPlayerAvatarUrl(userId, url);
        });
    }).catch(function(err) {
        console.warn('[cloud] avatar upload', err);
    });
}

function saveUserDesc(userId, desc) {
    if (!userId) return;
    var text = (desc || '').trim().slice(0, 500);
    if (text) safeLocalStorageSet(getPatracDescKey(userId), text);
    else try { localStorage.removeItem(getPatracDescKey(userId)); } catch (e) {}
    pushPlayerCloudAsync(function(mod) {
        return mod.syncPlayerDesc(userId, text);
    });
}

function cleanPatracStorageAggressive() {
    var accounts = sanitizePatracAccounts(getPatracAccounts());
    try {
        localStorage.setItem('patrac_accounts', JSON.stringify(accounts));
    } catch (e) {}

    var pois = getSafeJSON('map_free_pois');
    var poiChanged = false;
    for (var p = 0; p < pois.length; p++) {
        if (pois[p].img && storageByteLength(pois[p].img) > 40000) {
            delete pois[p].img;
            poiChanged = true;
        }
    }
    if (poiChanged) safeLocalStorageSet('map_free_pois', JSON.stringify(pois));

    var storyIds = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    for (var s = 0; s < storyIds.length; s++) {
        var imgKey = 'story_pos_img_' + storyIds[s];
        var imgVal = localStorage.getItem(imgKey);
        if (imgVal && storageByteLength(imgVal) > 40000) {
            try { localStorage.removeItem(imgKey); } catch (e) {}
        }
    }

    try {
        var chatRaw = localStorage.getItem('local_chat_backup');
        if (chatRaw && storageByteLength(chatRaw) > 20000) localStorage.removeItem('local_chat_backup');
    } catch (e) {}
}

function migratePatracAccountsStorage() {
    var raw = localStorage.getItem('patrac_accounts');
    if (!raw) return;
    var accounts;
    try { accounts = JSON.parse(raw); } catch (e) { return; }

    var needsRewrite = false;
    for (var id in accounts) {
        if (!accounts.hasOwnProperty(id)) continue;
        var acc = accounts[id];
        if (acc.avatar && storageByteLength(acc.avatar) > 50) {
            saveUserAvatar(id, acc.avatar);
            needsRewrite = true;
        }
        if (acc.desc && !localStorage.getItem(getPatracDescKey(id))) {
            saveUserDesc(id, acc.desc);
        }
        if (acc.avatar || acc.desc || acc.legacy) needsRewrite = true;
    }

    var slim = sanitizePatracAccounts(accounts);
    if (needsRewrite || storageByteLength(raw) > storageByteLength(JSON.stringify(slim)) + 10) {
        try {
            localStorage.setItem('patrac_accounts', JSON.stringify(slim));
        } catch (e) {
            cleanPatracStorageAggressive();
            try { localStorage.setItem('patrac_accounts', JSON.stringify(slim)); } catch (e2) {}
        }
    }
}

function savePatracAccounts(accounts) {
    var slim = sanitizePatracAccounts(accounts);
    var json = JSON.stringify(slim);
    var size = storageByteLength(json);
    if (size > PATRAC_ACCOUNTS_MAX_BYTES) {
        throw new Error('PÔö╝├ľÔöť┼čliÔö╝├ş mnoho ÔöťÔĽĹÔöÇ┼╣tÔö╝┬╗ v sÔöť┼čti (' + Math.round(size / 1024) + ' KB). SmaÔö╝┼╝ starÔöť─Ö testovacÔöť┼č ÔöťÔĽĹÔöÇ┼╣ty ├ö├ç├Â RESET.');
    }
    if (safeLocalStorageSet('patrac_accounts', json)) {
        pushAccountsToCloud(slim);
        return;
    }

    cleanPatracStorageAggressive();
    if (safeLocalStorageSet('patrac_accounts', json)) {
        pushAccountsToCloud(slim);
        return;
    }

    var usage = getLocalStorageUsageBytes();
    throw new Error('localStorage je plnÔöť─Ö (~' + Math.round(usage / 1024) + ' KB). VymaÔö╝┼╝ data prohlÔöť┼čÔö╝┼╝eÔöÇ┼╣e nebo pouÔö╝┼╝ij ├ö┼Ť├í RESET.');
}

function pushAccountsToCloud(accounts) {
    patracImport('services/accountService.js').then(function(mod) {
        for (var userId in accounts) {
            if (!accounts.hasOwnProperty(userId)) continue;
            mod.saveAccountToCloud(userId, accounts[userId]).catch(function(err) {
                console.warn('[cloud] account sync', userId, err);
            });
        }
    }).catch(function(err) {
        console.warn('[cloud] accountService', err);
    });
}

function isQuestCompleted(quest) {
    return localStorage.getItem(quest.doneKey || ('quest_done_' + quest.id)) === 'true';
}

function isQuestActive(quest) {
    if (!quest || !quest.id) return false;
    if (isQuestDismissed(quest.id)) return false;
    if (gameQuests[quest.id]) {
        if (!isQuestLaunchedCommunityWide(quest.id) || isQuestRunExpired(quest.id)) return false;
        if (isPlayerCompletedCurrentRun(quest.id)) return false;
        if (isQuestMissedByPlayer(quest.id)) return false;
        return true;
    }
    if (isQuestCompleted(quest)) return false;
    if (isQuestMissedByPlayer(quest.id)) return false;
    if (isCommunityQuestType(quest.id)) {
        if (isQuestLaunchedCommunityWide(quest.id) && !isQuestRunExpired(quest.id)) return true;
        return false;
    }
    return true;
}

function getActiveQuestsList() {
    var list = [];
    for (var k in gameQuests) {
        var q = getQuestById(gameQuests[k].id) || getQuestWithReq(gameQuests[k]);
        if (isQuestActive(q)) list.push(q);
    }
    var randomQuests = getRandomQuestsList();
    for (var r = 0; r < randomQuests.length; r++) {
        var rq = getQuestById(randomQuests[r].id) || getQuestWithReq(randomQuests[r]);
        if (isQuestActive(rq)) list.push(rq);
    }
    var customQuests = getSafeJSON('custom_quests_list');
    for (var i = 0; i < customQuests.length; i++) {
        var cq = getQuestWithReq(customQuests[i]);
        if (isQuestActive(cq)) list.push(cq);
    }
    return list;
}

