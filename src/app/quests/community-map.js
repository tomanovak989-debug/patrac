/* PATRAC: map cache and POI cloud sync */
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

