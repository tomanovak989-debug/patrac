/* PATRAC: storage, accounts, community cloud sync */
function getSafeJSON(key) {
    try {
        var data = localStorage.getItem(key);
        if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
}

function getSafeItems(key) {
    var data = getSafeJSON(key);
    return Array.isArray(data) ? data : [];
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        return false;
    }
}

var PATRAC_ACCOUNTS_MAX_BYTES = 100000;
var PATRAC_AVATAR_MAX_BYTES = 120000;

var PHOTO_PLACE_MAX_PX = 2560;
var PHOTO_PLACE_QUALITY = 0.92;
var PHOTO_AVATAR_MAX_PX = 768;
var PHOTO_AVATAR_QUALITY = 0.9;
var PHOTO_ITEM_MAX_PX = 1600;
var PHOTO_ITEM_QUALITY = 0.9;

function storageByteLength(str) {
    if (!str) return 0;
    try { return new Blob([str]).size; } catch (e) { return (str.length || 0) * 2; }
}

function getLocalStorageUsageBytes() {
    var total = 0;
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            total += storageByteLength(k) + storageByteLength(localStorage.getItem(k));
        }
    } catch (e) {}
    return total;
}

function getPatracAvatarKey(userId) {
    return 'patrac_avatar_' + userId;
}

function getPatracWearKey(userId) {
    return 'patrac_wear_' + userId;
}

function slimWearItem(item) {
    if (!item || !item.name) return null;
    var img = '';
    if (item.img && storageByteLength(item.img) <= 12000) img = item.img;
    return { name: String(item.name).slice(0, 48), img: img };
}

function syncCurrentAccountWearLoadout() {
    var session = getActiveInventoryUserId();
    if (!session) return;
    var items = getCurrentPersonalItems();
    var wear = [];
    for (var i = 0; i < items.length; i++) {
        var slim = slimWearItem(items[i]);
        if (slim) wear.push(slim);
    }
    try { safeLocalStorageSet(getPatracWearKey(session), JSON.stringify(wear)); } catch (e) { console.warn(e); }
    pushPlayerCloudAsync(function(mod) {
        return mod.syncPlayerWear(session, wear);
    });
}

function escapeHtmlText(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getMemberWearLoadout(userId) {
    if (!userId) return [];
    try {
        var wearRaw = localStorage.getItem(getPatracWearKey(userId));
        if (wearRaw) {
            var cached = JSON.parse(wearRaw);
            if (Array.isArray(cached) && cached.length) return cached;
        }
    } catch (e) {}
    var personal = (userId === getActiveInventoryUserId())
        ? getCurrentPersonalItems()
        : getUserPersonalItems(userId);
    var out = [];
    for (var i = 0; i < personal.length; i++) {
        var slim = slimWearItem(personal[i]);
        if (slim) out.push(slim);
    }
    return out;
}

function normalizeWearName(name) {
    return String(name || '').trim().toLowerCase();
}

function findWearItemByName(loadout, nameNorm) {
    for (var i = 0; i < loadout.length; i++) {
        if (normalizeWearName(loadout[i].name) === nameNorm) return loadout[i];
    }
    return null;
}

function getCommunitySharedWearItems(comCode) {
    var members = getCommunityMemberAccounts(comCode);
    if (members.length === 0) return [];
    var loadouts = members.map(function(m) { return getMemberWearLoadout(m.userId); });
    var memberCount = loadouts.length;
    var byName = {};

    for (var m = 0; m < loadouts.length; m++) {
        var seenInMember = {};
        for (var i = 0; i < loadouts[m].length; i++) {
            var item = loadouts[m][i];
            if (!item || !item.name) continue;
            var nameNorm = normalizeWearName(item.name);
            if (!nameNorm || seenInMember[nameNorm]) continue;
            seenInMember[nameNorm] = true;
            if (!byName[nameNorm]) {
                byName[nameNorm] = { name: item.name, img: item.img || '', count: 0 };
            }
            byName[nameNorm].count++;
            if (!byName[nameNorm].img && item.img) byName[nameNorm].img = item.img;
        }
    }

    var shared = [];
    for (var key in byName) {
        if (!Object.prototype.hasOwnProperty.call(byName, key)) continue;
        var entry = byName[key];
        shared.push({
            name: entry.name,
            img: entry.img,
            wornByAll: entry.count >= memberCount
        });
    }
    shared.sort(function(a, b) { return String(a.name).localeCompare(String(b.name), 'cs'); });
    return shared;
}

function buildWearRowHtml(items, extraClass, options) {
    options = options || {};
    if (!items || items.length === 0) {
        return '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Nic na sob─Ť</span>';
    }

    var compactThreshold = options.compactThreshold != null ? options.compactThreshold : 20;
    if (options.compact && items.length >= compactThreshold) {
        var listHtml = '<div class="wear-compact-list">';
        for (var c = 0; c < items.length; c++) {
            var cItem = items[c];
            var cName = cItem.name || 'ÔÇö';
            var cCls = cItem.wornByAll ? 'wear-all-shared' : '';
            if (c > 0) listHtml += '<span style="color:var(--panel-subtle);"> ┬Ě </span>';
            listHtml += '<span class="' + cCls + '" title="' + cName + (cItem.wornByAll ? ' (maj├ş v┼íichni)' : '') + '">' + cName + '</span>';
        }
        listHtml += '</div>';
        return listHtml;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var cls = 'wear-item-chip' + (extraClass ? ' ' + extraClass : '');
        if (item.wornByAll) cls += ' is-shared';
        var avHtml = item.img ? '<img src="' + item.img + '">' : '­čôŽ';
        var label = (item.name || '').split(' ')[0];
        if (label.length > 8) label = label.slice(0, 7) + 'ÔÇŽ';
        html += '<div class="' + cls + '" title="' + (item.name || '') + (item.wornByAll ? ' ÔÇö maj├ş v┼íichni' : '') + '">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += label + '</div>';
    }
    return html;
}

function buildCommunityMembersListHtml(members, activeUserId, founderId) {
    if (!members || members.length === 0) {
        return '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zat├şm ┼ż├ídn├ş p├ítra─Źi</span>';
    }
    var html = '';
    for (var m = 0; m < members.length; m++) {
        var mem = members[m];
        var av = localStorage.getItem(getPatracAvatarKey(mem.userId)) || '';
        var avHtml = av ? '<img src="' + av + '">' : 'ÔÇö';
        var rowCls = 'community-member-row';
        if (mem.userId === activeUserId) rowCls += ' is-active is-self';
        if (mem.userId === founderId) rowCls += ' is-founder';
        var displayName = mem.account.playerName
            || localStorage.getItem('patrac_member_name_' + mem.userId)
            || mem.userId;
        var label = displayName.split(' ')[0];
        var desc = localStorage.getItem(getPatracDescKey(mem.userId)) || '';
        var wear = getMemberWearLoadout(mem.userId);
        var rowId = mem.userId === activeUserId ? ' id="community-member-active"' : '';
        html += '<div class="' + rowCls + '"' + rowId + ' data-user-id="' + mem.userId + '" title="' + escapeHtmlText(mem.account.playerName || '') + (desc ? '\n' + desc : '') + '">';
        html += '<div class="community-member-row-profile">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += '<div class="community-member-row-text">';
        html += '<span class="community-member-row-name">' + escapeHtmlText(label) + '</span>';
        if (desc) {
            html += '<div class="community-member-row-desc">' + escapeHtmlText(desc) + '</div>';
        }
        html += '</div>';
        html += '</div>';
        html += '<div class="community-member-row-wear">';
        html += buildWearRowHtml(wear, '');
        html += '</div></div>';
    }
    return html;
}

function refreshCommunityMembersPanel(scrollToActive) {
    refreshCommunityMembersFromCloud(scrollToActive);
}

function normalizeComCodeValue(comCode) {
    return String(comCode || '').trim().toUpperCase();
}

function accountBelongsToCommunity(userId, comCode, accounts) {
    comCode = normalizeComCodeValue(comCode);
    if (!comCode || !userId) return false;
    accounts = accounts || getPatracAccounts();
    var acc = accounts[userId];
    if (!acc) return true;
    return normalizeComCodeValue(acc.comCode) === comCode;
}

function sanitizeCommunityMembers(comCode) {
    comCode = normalizeComCodeValue(comCode);
    if (!comCode) return;
    var comms = getPatracCommunities();
    var comm = comms[comCode];
    if (!comm) return;
    var accounts = getPatracAccounts();
    var filtered = [];
    var seen = {};
    var members = Array.isArray(comm.members) ? comm.members : [];
    var i;
    for (i = 0; i < members.length; i++) {
        var memberId = members[i];
        if (!memberId || seen[memberId]) continue;
        if (!accountBelongsToCommunity(memberId, comCode, accounts)) continue;
        seen[memberId] = true;
        filtered.push(memberId);
    }
    for (var id in accounts) {
        if (!Object.prototype.hasOwnProperty.call(accounts, id)) continue;
        if (normalizeComCodeValue(accounts[id].comCode) === comCode && !seen[id]) {
            seen[id] = true;
            filtered.push(id);
        }
    }
    var changed = filtered.length !== members.length;
    if (!changed) {
        for (i = 0; i < members.length; i++) {
            if (filtered.indexOf(members[i]) === -1) {
                changed = true;
                break;
            }
        }
    }
    if (changed) {
        comm.members = filtered;
        comms[comCode] = comm;
        savePatracCommunities(comms);
    }
}

function reconcileCommunityMembersList(comCode) {
    sanitizeCommunityMembers(comCode);
}

function refreshCommunityMembersFromCloud(scrollToActive) {
    var membersEl = document.getElementById('community-members-list');
    if (!membersEl) return;
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    reconcileCommunityMembersList(comCode);
    var stats = getCommunityAggregateStats(comCode);
    if (stats.members.length === 0) {
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zat├şm ┼ż├ídn├ş p├ítra─Źi</span>';
        membersEl.classList.remove('is-scrollable');
        return;
    }

    var userIds = stats.members.map(function(m) { return m.userId; });
    membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Na─Ź├şt├ím profily z clouduÔÇŽ</span>';

    patracImport('services/playerService.js').then(function(mod) {
        return mod.fetchPlayersPublicProfiles(userIds).then(function(profiles) {
            for (var uid in profiles) {
                if (!profiles.hasOwnProperty(uid)) continue;
                mod.cacheMemberProfileLocally(uid, profiles[uid]);
                if (profiles[uid].playerName) {
                    localStorage.setItem('patrac_member_name_' + uid, profiles[uid].playerName);
                }
            }
            return patracImport('services/accountService.js').then(function(accMod) {
                return Promise.all(userIds.map(function(uid) {
                    if (localStorage.getItem('patrac_member_name_' + uid)) return null;
                    return accMod.fetchAccountFromCloud(uid).then(function(acc) {
                        if (acc && acc.playerName) {
                            localStorage.setItem('patrac_member_name_' + uid, acc.playerName);
                        }
                    }).catch(function() {});
                }));
            }).then(function() {
                renderCommunityMembersListDom(scrollToActive);
            });
        });
    }).catch(function(err) {
        console.warn('[cloud] member profiles', err);
        renderCommunityMembersListDom(scrollToActive);
    });
}

function renderCommunityMembersListDom(scrollToActive) {
    var membersEl = document.getElementById('community-members-list');
    if (!membersEl) return;
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    reconcileCommunityMembersList(comCode);
    var activeUserId = getActiveInventoryUserId() || localStorage.getItem('patrac_session') || '';
    var comm = getCurrentCommunityRecord();
    var founderId = comm ? comm.founder : '';
    var stats = getCommunityAggregateStats(comCode);
    if (stats.members.length === 0) {
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zat├şm ┼ż├ídn├ş p├ítra─Źi</span>';
        membersEl.classList.remove('is-scrollable');
        return;
    }
    membersEl.classList.toggle('is-scrollable', stats.members.length >= 5);
    membersEl.innerHTML = buildCommunityMembersListHtml(stats.members, activeUserId, founderId);
    if (scrollToActive) scrollShelterMemberIntoView(membersEl, activeUserId);
}

function scrollShelterMemberIntoView(membersEl, activeUserId) {
    if (!membersEl || !activeUserId || !membersEl.classList.contains('is-scrollable')) return;
    var row = document.getElementById('community-member-active');
    if (!row || !membersEl.contains(row)) return;
    setTimeout(function() {
        var rowTop = row.offsetTop;
        var rowH = row.offsetHeight;
        var viewTop = membersEl.scrollTop;
        var viewH = membersEl.clientHeight;
        if (rowTop < viewTop) {
            membersEl.scrollTop = rowTop;
        } else if (rowTop + rowH > viewTop + viewH) {
            membersEl.scrollTop = rowTop + rowH - viewH;
        }
    }, 0);
}

function renderShelterStory() {
    var tierEl = document.getElementById('shelter-story-tier');
    var textEl = document.getElementById('shelter-story-text');
    if (!tierEl || !textEl) return;
    var comCode = localStorage.getItem('com_code') || '';
    if (!comCode) {
        tierEl.textContent = '├ÜTO─îI┼áT─Ü ÔÇö ─îEK├ü NA KOMUNITU';
        textEl.textContent = 'P┼Öipoj se ke komunit─Ť nebo zalo┼ż vlastn├ş. P┼Ö├şb─Ťh ├║to─Źi┼ít─Ť se odemkne podle spole─Źn├ę hodnosti a postupu ve h┼Öe.';
        return;
    }
    var rank = calculateCommunityRank(comCode);
    tierEl.textContent = 'HODNOST KOMUNITY: ' + rank.rankLabel;
    textEl.textContent = SHELTER_STORY_BY_TIER[rank.tier - 1] || SHELTER_STORY_BY_TIER[0];
}

function getPatracDescKey(userId) {
    return 'patrac_desc_' + userId;
}

function slimPatracAccount(acc) {
    if (!acc) return null;
    var out = {
        pass: String(acc.pass || ''),
        email: String(acc.email || '').trim().toLowerCase(),
        comName: String(acc.comName || '').slice(0, 80),
        comCode: String(acc.comCode || '').slice(0, 5).toUpperCase(),
        playerName: String(acc.playerName || '').slice(0, 80),
        playerCode: String(acc.playerCode || '').slice(0, 5).toUpperCase(),
        localMissions: typeof acc.localMissions === 'number' ? acc.localMissions : (parseInt(acc.localMissions, 10) || 0)
    };
    if (acc.isBot) out.isBot = true;
    return out;
}

function isBotAccount(acc) {
    return !!(acc && acc.isBot);
}

function sanitizePatracAccounts(accounts) {
    var slim = {};
    if (!accounts) return slim;
    for (var id in accounts) {
        if (accounts.hasOwnProperty(id)) slim[id] = slimPatracAccount(accounts[id]);
    }
    return slim;
}

function saveUserAvatar(userId, dataUrl) {
    if (!userId || !dataUrl) return true;
    if (/^https?:\/\//i.test(dataUrl)) {
        if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
            safeLocalStorageSet('player_avatar', dataUrl);
            pushPlayerCloudAsync(function(mod) {
                return mod.syncPlayerAvatarUrl(userId, dataUrl);
            });
            return true;
        }
        cleanPatracStorageAggressive();
        if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
            safeLocalStorageSet('player_avatar', dataUrl);
            pushPlayerCloudAsync(function(mod) {
                return mod.syncPlayerAvatarUrl(userId, dataUrl);
            });
            return true;
        }
        return false;
    }
    if (storageByteLength(dataUrl) > PATRAC_AVATAR_MAX_BYTES) {
        console.warn('Avatar p┼Ö├şli┼í velk├Ż, neukl├íd├ím.');
        return false;
    }
    if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
        safeLocalStorageSet('player_avatar', dataUrl);
        pushUserAvatarDataUrlToCloud(userId, dataUrl);
        return true;
    }
    cleanPatracStorageAggressive();
    if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
        safeLocalStorageSet('player_avatar', dataUrl);
        pushUserAvatarDataUrlToCloud(userId, dataUrl);
        return true;
    }
    return false;
}

function pushPlayerCloudAsync(work) {
    patracImport('services/playerService.js').then(work).catch(function(err) {
        console.warn('[cloud] player sync', err);
    });
}

function collectCommunityPoisForCloud() {
    var session = localStorage.getItem('patrac_session') || '';
    var playerName = localStorage.getItem('player_name') || 'Operativec';
    var pois = [];
    var free = getSafeJSON('map_free_pois');
    for (var i = 0; i < free.length; i++) {
        var p = free[i];
        if (!p || !p.id) continue;
        var img = p.img || '';
        pois.push({
            id: p.id,
            type: 'free',
            name: p.name || '',
            note: p.note || p.desc || '',
            img: img,
            imgUrl: /^https?:\/\//.test(img) ? img : '',
            lat: p.lat,
            lng: p.lng,
            creatorUserId: p.creatorUserId || session,
            creatorName: p.creator || playerName,
            createdAt: p.createdAt || Date.now(),
            updatedAt: Date.now()
        });
    }
    var storyIds = getStoryQuestIds();
    for (var s = 0; s < storyIds.length; s++) {
        var questId = storyIds[s];
        var note = getStoryPosCommunityNote(questId);
        var imgS = getStoryPosCommunityImg(questId);
        var lat = parseFloat(localStorage.getItem('point_' + questId + '_lat'));
        var lng = parseFloat(localStorage.getItem('point_' + questId + '_lng'));
        var hasCoords = !isNaN(lat) && !isNaN(lng);
        if (!note && !imgS && !hasCoords) continue;
        pois.push({
            id: 'story_' + questId,
            type: 'story',
            questId: questId,
            name: getQuestMapLabel(questId),
            note: note,
            img: imgS,
            imgUrl: /^https?:\/\//.test(imgS) ? imgS : '',
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            creatorUserId: session,
            creatorName: playerName,
            updatedAt: Date.now()
        });
    }
    return pois;
}

function getPreviousPoiImgById() {
    var map = {};
    var free = getSafeJSON('map_free_pois');
    for (var i = 0; i < free.length; i++) {
        if (free[i].id && /^https?:\/\//.test(free[i].img || '')) {
            map[free[i].id] = free[i].img;
        }
    }
    var storyIds = getStoryQuestIds();
    for (var s = 0; s < storyIds.length; s++) {
        var qid = storyIds[s];
        var img = getStoryPosCommunityImg(qid);
        if (/^https?:\/\//.test(img)) map['story_' + qid] = img;
    }
    return map;
}

function getCommunityMapCacheKey(comCode) {
    return 'patrac_map_cache_' + String(comCode || '').trim().toUpperCase();
}

function collectCommunityMapPointKeys() {
    var points = {};
    var i;
    for (i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf('point_') !== 0 || key.slice(-4) !== '_lat') continue;
        var questId = key.slice(6, -4);
        var lat = localStorage.getItem(key);
        var lng = localStorage.getItem('point_' + questId + '_lng');
        if (lat && lng) points[questId] = { lat: lat, lng: lng };
    }
    return points;
}

function collectStoryPosMetaKeys() {
    var meta = {};
    var i;
    for (i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        var noteMatch = key.match(/^story_pos_note_(.+)$/);
        var imgMatch = key.match(/^story_pos_img_(.+)$/);
        if (noteMatch) {
            if (!meta[noteMatch[1]]) meta[noteMatch[1]] = {};
            meta[noteMatch[1]].note = localStorage.getItem(key) || '';
        } else if (imgMatch) {
            if (!meta[imgMatch[1]]) meta[imgMatch[1]] = {};
            meta[imgMatch[1]].img = localStorage.getItem(key) || '';
        }
    }
    return meta;
}

function stripMapCachePayloadForStorage(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    var copy = JSON.parse(JSON.stringify(payload));
    if (Array.isArray(copy.freePois)) {
        for (var i = 0; i < copy.freePois.length; i++) {
            var img = copy.freePois[i] && copy.freePois[i].img;
            if (typeof img === 'string' && img.indexOf('data:') === 0) copy.freePois[i].img = '';
        }
    }
    if (copy.storyPosMeta && typeof copy.storyPosMeta === 'object') {
        for (var qid in copy.storyPosMeta) {
            if (!Object.prototype.hasOwnProperty.call(copy.storyPosMeta, qid)) continue;
            var sImg = copy.storyPosMeta[qid] && copy.storyPosMeta[qid].img;
            if (typeof sImg === 'string' && sImg.indexOf('data:') === 0) copy.storyPosMeta[qid].img = '';
        }
    }
    return copy;
}

function captureCommunityMapCachePayload(comCode) {
    comCode = String(comCode || localStorage.getItem('com_code') || operatorComCode || '').trim().toUpperCase();
    if (!comCode) return null;
    var fogPrefs = null;
    if (fogOfWarMod && fogOfWarMod.getFogPrefsForCache) {
        fogPrefs = fogOfWarMod.getFogPrefsForCache();
    }
    return {
        version: 1,
        comCode: comCode,
        points: collectCommunityMapPointKeys(),
        storyPosMeta: collectStoryPosMetaKeys(),
        freePois: getSafeJSON('map_free_pois'),
        customQuests: getSafeJSON('custom_quests_list'),
        randomQuests: getRandomQuestsList(),
        dismissed: getDismissedQuests(),
        reqOverrides: getQuestReqOverrides(),
        launched: getCommunityLaunchedQuests(),
        fogEnabled: fogPrefs ? fogPrefs.fogEnabled : undefined,
        fogRevealAll: fogPrefs ? fogPrefs.fogRevealAll : undefined,
        savedAt: Date.now()
    };
}

function snapshotCommunityMapCache(comCode, payload) {
    payload = payload || captureCommunityMapCachePayload(comCode);
    if (!payload) return null;
    comCode = String(payload.comCode || comCode || localStorage.getItem('com_code') || operatorComCode || '').trim().toUpperCase();
    if (!comCode) return payload;
    var stored = stripMapCachePayloadForStorage(payload);
    if (!safeLocalStorageSet(getCommunityMapCacheKey(comCode), JSON.stringify(stored))) {
        var minimal = {
            version: 1,
            comCode: comCode,
            points: stored.points || {},
            storyPosMeta: {},
            freePois: (stored.freePois || []).map(function(p) {
                return {
                    id: p.id,
                    name: p.name || '',
                    note: p.note || p.desc || '',
                    lat: p.lat,
                    lng: p.lng,
                    creator: p.creator || '',
                    creatorUserId: p.creatorUserId || '',
                    createdAt: p.createdAt || Date.now(),
                    updatedAt: p.updatedAt || Date.now()
                };
            }),
            customQuests: stored.customQuests || [],
            randomQuests: stored.randomQuests || [],
            dismissed: stored.dismissed || [],
            reqOverrides: stored.reqOverrides || {},
            launched: stored.launched || {},
            fogEnabled: stored.fogEnabled,
            fogRevealAll: stored.fogRevealAll,
            savedAt: Date.now()
        };
        safeLocalStorageSet(getCommunityMapCacheKey(comCode), JSON.stringify(minimal));
    }
    return payload;
}

function collectCommunityPoisFromMapPayload(payload) {
    payload = payload || captureCommunityMapCachePayload();
    if (!payload) return [];
    var session = localStorage.getItem('patrac_session') || '';
    var playerName = localStorage.getItem('player_name') || 'Operativec';
    var pois = [];
    var free = Array.isArray(payload.freePois) ? payload.freePois : [];
    for (var i = 0; i < free.length; i++) {
        var p = free[i];
        if (!p || !p.id) continue;
        var img = p.img || '';
        pois.push({
            id: p.id,
            type: 'free',
            name: p.name || '',
            note: p.note || p.desc || '',
            img: img,
            imgUrl: /^https?:\/\//.test(img) ? img : '',
            lat: p.lat,
            lng: p.lng,
            creatorUserId: p.creatorUserId || session,
            creatorName: p.creator || playerName,
            createdAt: p.createdAt || Date.now(),
            updatedAt: Date.now()
        });
    }
    var storyIds = getStoryQuestIds();
    var points = payload.points || {};
    var meta = payload.storyPosMeta || {};
    for (var s = 0; s < storyIds.length; s++) {
        var questId = storyIds[s];
        var note = (meta[questId] && meta[questId].note) || getStoryPosCommunityNote(questId);
        var imgS = (meta[questId] && meta[questId].img) || getStoryPosCommunityImg(questId);
        var pt = points[questId] || {};
        var lat = pt.lat != null ? parseFloat(pt.lat) : NaN;
        var lng = pt.lng != null ? parseFloat(pt.lng) : NaN;
        var hasCoords = !isNaN(lat) && !isNaN(lng);
        if (!note && !imgS && !hasCoords) continue;
        pois.push({
            id: 'story_' + questId,
            type: 'story',
            questId: questId,
            name: getQuestMapLabel(questId),
            note: note,
            img: imgS,
            imgUrl: /^https?:\/\//.test(imgS) ? imgS : '',
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            creatorUserId: session,
            creatorName: playerName,
            updatedAt: Date.now()
        });
    }
    return pois;
}

function collectCommunityQuestsFromMapPayload(payload) {
    payload = payload || captureCommunityMapCachePayload();
    if (!payload) return collectCommunityQuestsForCloud();
    var story = {};
    var storyIds = getStoryQuestIds();
    var points = payload.points || {};
    for (var i = 0; i < storyIds.length; i++) {
        var id = storyIds[i];
        var pt = points[id] || {};
        story[id] = {
            lat: pt.lat != null && pt.lat !== '' ? parseFloat(pt.lat) : null,
            lng: pt.lng != null && pt.lng !== '' ? parseFloat(pt.lng) : null
        };
    }
    var custom = (Array.isArray(payload.customQuests) ? payload.customQuests : []).map(function(q) {
        return enrichQuestWithCoordsFromPoints(q, points);
    });
    var random = (Array.isArray(payload.randomQuests) ? payload.randomQuests : []).map(function(q) {
        return enrichQuestWithCoordsFromPoints(q, points);
    });
    return {
        version: 1,
        story: story,
        custom: custom,
        random: random,
        dismissed: Array.isArray(payload.dismissed) ? payload.dismissed.slice() : [],
        reqOverrides: payload.reqOverrides && typeof payload.reqOverrides === 'object' ? payload.reqOverrides : {},
        launched: payload.launched && typeof payload.launched === 'object' ? payload.launched : {},
        updatedAt: Date.now()
    };
}

function restoreCommunityMapCache(comCode) {
    comCode = String(comCode || '').trim().toUpperCase();
    if (!comCode) return false;
    var raw = localStorage.getItem(getCommunityMapCacheKey(comCode));
    if (!raw) return false;
    try {
        var data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return false;

        var points = data.points || {};
        var qid;
        for (qid in points) {
            if (!Object.prototype.hasOwnProperty.call(points, qid)) continue;
            if (points[qid].lat) localStorage.setItem('point_' + qid + '_lat', points[qid].lat);
            if (points[qid].lng) localStorage.setItem('point_' + qid + '_lng', points[qid].lng);
        }

        var meta = data.storyPosMeta || {};
        for (qid in meta) {
            if (!Object.prototype.hasOwnProperty.call(meta, qid)) continue;
            if (meta[qid].note) localStorage.setItem('story_pos_note_' + qid, meta[qid].note);
            else try { localStorage.removeItem('story_pos_note_' + qid); } catch (e) {}
            if (meta[qid].img) localStorage.setItem('story_pos_img_' + qid, meta[qid].img);
            else try { localStorage.removeItem('story_pos_img_' + qid); } catch (e) {}
        }

        if (Array.isArray(data.freePois)) safeLocalStorageSet('map_free_pois', JSON.stringify(data.freePois));
        if (Array.isArray(data.customQuests)) safeLocalStorageSet('custom_quests_list', JSON.stringify(data.customQuests));
        if (Array.isArray(data.randomQuests)) localStorage.setItem('random_quests_list', JSON.stringify(data.randomQuests));
        if (Array.isArray(data.dismissed)) safeLocalStorageSet('dismissed_quests', JSON.stringify(data.dismissed));
        if (data.reqOverrides) safeLocalStorageSet('quest_req_overrides', JSON.stringify(data.reqOverrides));
        if (data.launched) setCommunityLaunchedQuests(data.launched);
        if (fogOfWarMod && fogOfWarMod.applyCommunityFogPrefs) {
            var fogApply = {};
            if (typeof data.fogEnabled === 'boolean') fogApply.fogEnabled = data.fogEnabled;
            if (typeof data.fogRevealAll === 'boolean') fogApply.fogRevealAll = data.fogRevealAll;
            if (Object.keys(fogApply).length) fogOfWarMod.applyCommunityFogPrefs(fogApply);
        }
        return true;
    } catch (e) {
        return false;
    }
}

function flushCommunityMapCacheToCloud(comCode, payload) {
    comCode = String(comCode || (payload && payload.comCode) || localStorage.getItem('com_code') || operatorComCode || '').trim().toUpperCase();
    if (!comCode) return Promise.resolve();
    payload = payload || snapshotCommunityMapCache(comCode);
    if (!payload) return Promise.resolve();
    var pois = collectCommunityPoisFromMapPayload(payload);
    var quests = collectCommunityQuestsFromMapPayload(payload);
    var previousImgById = getPreviousPoiImgById();
    var chain = Promise.resolve();
    chain = chain.then(function() {
        return patracImport('services/poiService.js').then(function(mod) {
            return mod.saveCommunityPoisToCloud(comCode, pois, previousImgById);
        });
    }).catch(function(err) { console.warn('[cloud] pois flush', err); });
    chain = chain.then(function() {
        return patracImport('services/questService.js').then(function(mod) {
            return mod.saveCommunityQuestsToCloud(comCode, quests);
        });
    }).catch(function(err) { console.warn('[cloud] quests flush', err); });
    return chain;
}

function isOperatorLocalOnlySession() {
    return isOperatorMode === true && !localStorage.getItem('patrac_session');
}

function syncCommunityPoisToCloud() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    snapshotCommunityMapCache(comCode);
    if (isOperatorLocalOnlySession()) return;
    var pois = collectCommunityPoisForCloud();
    var previousImgById = getPreviousPoiImgById();
    patracImport('services/poiService.js').then(function(mod) {
        return mod.saveCommunityPoisToCloud(comCode, pois, previousImgById);
    }).then(function() {
        if (typeof reloadAllMapPoints === 'function') reloadAllMapPoints();
    }).catch(function(err) {
        console.warn('[cloud] pois sync', err);
    });
}

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
    if (left <= 0) return 'vypr┼íelo';
    var mins = Math.ceil(left / 60000);
    if (mins >= 60) return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    return mins + ' min';
}

function renderCommunityQuestStatusHtml(questId, q) {
    if (!usesCommunityLaunchQuest(questId)) return '';
    if (isStoryQuestId(questId) && isPlayerCompletedCurrentRun(questId)) {
        if (isStoryQuestPlaced(questId)) {
            return '<div style="font-size:var(--text-sm);color:var(--text-green);margin:4px 0;">Ôťů V├Żkon potvrzen ÔÇö rank zaps├ín. Trval├Ż bod je na map─Ť.</div>';
        }
        return '<div style="font-size:var(--text-sm);color:var(--danger-orange);margin:4px 0;">Ôťů V├Żkon potvrzen ÔÇö rank zaps├ín, ale bod na map─Ť chyb├ş. Pou┼żij Ôć║ RESET a zam─Ť┼Ö znovu.</div>';
    }
    if (!isStoryQuestId(questId) && isQuestCompleted(q)) return '';
    if (isQuestMissedByPlayer(questId)) {
        return '<div class="logistics-error" style="display:block;margin:4px 0;">ÔĆ▒ Lh┼»ta vypr┼íela ÔÇö rank za tuto misi nez├şsk├í┼í.</div>';
    }
    var entry = getLaunchedQuestEntry(questId);
    if (!entry) return '';
    var starter = entry.startedByName || entry.startedBy || 'komunita';
    var html = '<div style="font-size:var(--text-sm);color:var(--accent-gold);margin:4px 0;">­čôí Spu┼ít─Ťno: ' + starter + '</div>';
    html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">Ka┼żd├Ż p├ítra─Ź mus├ş potvrdit v├Żkon na m├şst─Ť s├ím ÔÇö jinak rank nez├şsk├í.</div>';
    if (isStoryQuestId(questId)) {
        html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">Trval├Ż bod se na map─Ť aktualizuje hned po potvrzen├ş GPS.</div>';
    } else {
        var cd = formatQuestCountdown(questId);
        html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">Zb├Żv├í ~' + cd + '</div>';
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
        throw new Error('P┼Ö├şli┼í mnoho ├║─Źt┼» v s├şti (' + Math.round(size / 1024) + ' KB). Sma┼ż star├ę testovac├ş ├║─Źty ÔÇö RESET.');
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
    throw new Error('localStorage je pln├ę (~' + Math.round(usage / 1024) + ' KB). Vyma┼ż data prohl├ş┼że─Źe nebo pou┼żij Ôśá RESET.');
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

