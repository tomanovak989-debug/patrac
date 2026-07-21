/* PATRAC: session bootstrap and inventory persistence */
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

