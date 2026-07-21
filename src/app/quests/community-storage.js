/* PATRAC: local storage helpers, wear, members */
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
        return '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Nic na sobÔöÇ┼Ą</span>';
    }

    var compactThreshold = options.compactThreshold != null ? options.compactThreshold : 20;
    if (options.compact && items.length >= compactThreshold) {
        var listHtml = '<div class="wear-compact-list">';
        for (var c = 0; c < items.length; c++) {
            var cItem = items[c];
            var cName = cItem.name || '├ö├ç├Â';
            var cCls = cItem.wornByAll ? 'wear-all-shared' : '';
            if (c > 0) listHtml += '<span style="color:var(--panel-subtle);"> ÔöČ─Ü </span>';
            listHtml += '<span class="' + cCls + '" title="' + cName + (cItem.wornByAll ? ' (majÔöť┼č vÔö╝├şichni)' : '') + '">' + cName + '</span>';
        }
        listHtml += '</div>';
        return listHtml;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var cls = 'wear-item-chip' + (extraClass ? ' ' + extraClass : '');
        if (item.wornByAll) cls += ' is-shared';
        var avHtml = item.img ? '<img src="' + item.img + '">' : '┬ş─Ź├┤┼Ż';
        var label = (item.name || '').split(' ')[0];
        if (label.length > 8) label = label.slice(0, 7) + '├ö├ç┼Ż';
        html += '<div class="' + cls + '" title="' + (item.name || '') + (item.wornByAll ? ' ├ö├ç├Â majÔöť┼č vÔö╝├şichni' : '') + '">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += label + '</div>';
    }
    return html;
}

function buildCommunityMembersListHtml(members, activeUserId, founderId) {
    if (!members || members.length === 0) {
        return '<span style="font-size:var(--text-sm);color:var(--faint-fg);">ZatÔöť┼čm Ôö╝┼╝Ôöť├şdnÔöť┼č pÔöť├ştraÔöÇ┼╣i</span>';
    }
    var html = '';
    for (var m = 0; m < members.length; m++) {
        var mem = members[m];
        var av = localStorage.getItem(getPatracAvatarKey(mem.userId)) || '';
        var avHtml = av ? '<img src="' + av + '">' : '├ö├ç├Â';
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
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">ZatÔöť┼čm Ôö╝┼╝Ôöť├şdnÔöť┼č pÔöť├ştraÔöÇ┼╣i</span>';
        membersEl.classList.remove('is-scrollable');
        return;
    }

    var userIds = stats.members.map(function(m) { return m.userId; });
    membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">NaÔöÇ┼╣Ôöť┼čtÔöť├şm profily z cloudu├ö├ç┼Ż</span>';

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
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">ZatÔöť┼čm Ôö╝┼╝Ôöť├şdnÔöť┼č pÔöť├ştraÔöÇ┼╣i</span>';
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
        tierEl.textContent = 'Ôöť├ťTOÔöÇ├«IÔö╝├íTÔöÇ├ť ├ö├ç├Â ÔöÇ├«EKÔöť├╝ NA KOMUNITU';
        textEl.textContent = 'PÔö╝├ľipoj se ke komunitÔöÇ┼Ą nebo zaloÔö╝┼╝ vlastnÔöť┼č. PÔö╝├ľÔöť┼čbÔöÇ┼Ąh ÔöťÔĽĹtoÔöÇ┼╣iÔö╝├ştÔöÇ┼Ą se odemkne podle spoleÔöÇ┼╣nÔöť─Ö hodnosti a postupu ve hÔö╝├ľe.';
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
        console.warn('Avatar pÔö╝├ľÔöť┼čliÔö╝├ş velkÔöť┼╗, neuklÔöť├şdÔöť├şm.');
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

