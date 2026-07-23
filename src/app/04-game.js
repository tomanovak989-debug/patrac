/* PATRAC app chunk: 04-game.js — do not reorder script tags in index.html */
function appendItemHistory(item, entry) {
    if (item.itemType === 'tool') return;
    if (entry.type === 'transfer') return;
    if (!item.itemHistory) item.itemHistory = [];
    entry.date = entry.date || new Date().toLocaleString('cs-CZ');
    entry.clan = entry.clan || localStorage.getItem('com_name') || '—';
    entry.player = entry.player || localStorage.getItem('player_name') || '—';
    item.itemHistory.unshift(entry);
    if (item.itemHistory.length > 25) item.itemHistory.length = 25;
}

function formatItemHistoryHtml(item) {
    if (item.itemType === 'tool' || !item.itemHistory || !item.itemHistory.length) return '';
    var html = '<div class="item-history-block"><strong style="color:var(--muted-fg);">📜 HISTORIE:</strong>';
    var limit = Math.min(item.itemHistory.length, 6);
    for (var i = 0; i < limit; i++) {
        var h = item.itemHistory[i];
        var line = '';
        if (h.type === 'crafted') line = '⚒️ Vyroben v ' + h.clan + ' (' + h.player + ')';
        else if (h.type === 'mission') line = '☣️ Mise: ' + (h.detail || '—');
        else if (h.type === 'lore') line = '📝 ' + (h.detail || 'Úprava záznamu komunity');
        else if (h.type !== 'transfer') line = h.detail || h.type;
        else continue;
        html += '<div class="item-history-line">' + h.date + ': ' + line + '</div>';
    }
    html += '</div>';
    return html;
}

function updateStatsHud(options) {
    options = options || {};
    if (isOperatorMode) syncOperatorCommunityContext();
    var profile = getPlayerProfile();
    if (isOperatorMode && currentlyEditingPlayerId && operatorEditDraft &&
        currentlyEditingPlayerId === localStorage.getItem('patrac_session')) {
        profile.localMissions = operatorEditDraft.localMissions || 0;
        profile.localIssuerStats = operatorEditDraft.localIssuerStats || emptyIssuerStats();
    }
    var rank = getPlayerRankDisplay(profile);

    var elLocal = document.getElementById('display-missions-local');
    var elGlobal = document.getElementById('display-missions-global');
    var elR = document.getElementById('display-rank');
    var elSpec = document.getElementById('display-specialization');

    if (elLocal) elLocal.textContent = profile.localMissions || 0;
    if (elGlobal) elGlobal.textContent = profile.globalMissions || 0;
    if (elR) elR.innerHTML = rank.label;
    var elRankNext = document.getElementById('display-rank-next');
    if (elRankNext) elRankNext.textContent = getPlayerRankProgress(profile);

    var elSpecLocal = document.getElementById('display-spec-local');
    var elSpecGlobal = document.getElementById('display-spec-global');
    if (elSpecLocal) {
        elSpecLocal.innerHTML = '<strong>LOKÁLNÍ SPEC:</strong> ' + formatIssuerStatsHtml(profile.localIssuerStats || emptyIssuerStats(), profile.localMissions);
    }
    if (elSpecGlobal) {
        elSpecGlobal.innerHTML = '<strong>GLOBÁLNÍ SPEC:</strong> ' + formatIssuerStatsHtml(profile.globalIssuerStats || emptyIssuerStats(), profile.globalMissions);
    }

    if (elSpec) {
        if (rank.specialization) {
            elSpec.style.display = 'block';
            elSpec.textContent = 'Specializace: ' + rank.specialization;
        } else {
            elSpec.style.display = 'none';
        }
    }
    renderChronicle();
    renderMissionLog();
    renderCommunityProfile({ skipMembersList: !!options.skipMembersList, scrollToActive: !!options.scrollToActive });
    syncCurrentAccountMissionStats();
}

function collectAllSavedMapCoords() {
    var coords = [];
    var seen = {};
    function add(lat, lng) {
        var la = parseFloat(lat);
        var ln = parseFloat(lng);
        if (isNaN(la) || isNaN(ln)) return;
        var key = la.toFixed(6) + ',' + ln.toFixed(6);
        if (seen[key]) return;
        seen[key] = true;
        coords.push([la, ln]);
    }

    var points = collectCommunityMapPointKeys();
    for (var qid in points) {
        if (!Object.prototype.hasOwnProperty.call(points, qid)) continue;
        add(points[qid].lat, points[qid].lng);
    }

    var pois = getSafeJSON('map_free_pois');
    for (var p = 0; p < pois.length; p++) {
        if (pois[p]) add(pois[p].lat, pois[p].lng);
    }

    try {
        var reg = JSON.parse(localStorage.getItem('patrac_pocta_registry') || '{}');
        var ents = reg.entities || {};
        for (var id in ents) {
            if (!Object.prototype.hasOwnProperty.call(ents, id)) continue;
            var ent = ents[id];
            if (ent && ent.lat != null && ent.lng != null) add(ent.lat, ent.lng);
        }
    } catch (e) {}

    return coords;
}

function centerMapToAllSavedPoints() {
    if (!map || !window.L) return;
    var coords = collectAllSavedMapCoords();
    if (!coords.length) {
        alert('Na mapě zatím nejsou žádné uložené body.');
        return;
    }
    if (coords.length === 1) {
        map.setView(coords[0], Math.max(map.getZoom(), 15));
    } else {
        map.fitBounds(window.L.latLngBounds(coords), {
            padding: [48, 48],
            maxZoom: 17,
            animate: true
        });
    }
    try { patracRefreshFogOfWar(); } catch (e) {}
}

function centerMapToUser() {
    if (userMarker && map) {
        map.setView(userMarker.getLatLng(), 16);
        return;
    }
    if (navigator.geolocation && map) {
        setGpsStatus('● Načítám polohu...');
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                applyUserPosition(pos);
                map.setView([pos.coords.latitude, pos.coords.longitude], 16);
            },
            function(err) { alert(geolocationErrorText(err)); },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        );
    }
}

function centerMapToShelter() {
    if (!map) return;
    var lat = localStorage.getItem('point_roxy_lat');
    var lng = localStorage.getItem('point_roxy_lng');
    if (!lat || !lng) {
        alert('Útočiště ještě není zaměřeno. Nejdřív splň misi od Roxy a ulož polohu.');
        return;
    }
    map.setView([parseFloat(lat), parseFloat(lng)], Math.max(map.getZoom(), 16));
}

function previewImage(input) {
    if (!input.files || !input.files[0]) return;
    compressAvatarForStorage(input.files[0], function(result) {
        if (!result) {
            alert('Avatar se nepodařilo zpracovat. Zkus menší nebo jinou fotku.');
            return;
        }
        base64Avatar = result;
        var prev = document.getElementById('avatar-setup-preview');
        if (prev) prev.innerHTML = '<img src="' + result + '">';
    });
}

function previewCraftImage(input) {
    if (!input.files || !input.files[0]) {
        pendingCraftPhotoFile = null;
        return;
    }
    pendingCraftPhotoFile = input.files[0];
    var file = input.files[0];
    if (file.size > 800000) {
        alert('Foto je větší — při uložení se zkomprimuje a nahraje do cloudu.');
    }
    compressImageFile(file, PHOTO_ITEM_MAX_PX, PHOTO_ITEM_QUALITY, function(result) {
        base64CraftImg = result;
    });
}

function compressImageFile(file, maxPx, quality, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var w = img.width, h = img.height;
            if (w > maxPx || h > maxPx) {
                if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
                else { w = Math.round(w * maxPx / h); h = maxPx; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = function() { callback(e.target.result); };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function compressAvatarForStorage(file, callback) {
    var steps = [
        { px: PHOTO_AVATAR_MAX_PX, q: PHOTO_AVATAR_QUALITY },
        { px: 512, q: 0.88 },
        { px: 384, q: 0.82 }
    ];
    var stepIdx = 0;
    function tryNext() {
        if (stepIdx >= steps.length) {
            callback(null);
            return;
        }
        var step = steps[stepIdx++];
        compressImageFile(file, step.px, step.q, function(result) {
            if (result && storageByteLength(result) <= PATRAC_AVATAR_MAX_BYTES) {
                callback(result);
            } else {
                tryNext();
            }
        });
    }
    tryNext();
}

function updateAvatarPreviewElements(dataUrl) {
    var gamePrev = document.getElementById('avatar-game-preview');
    if (gamePrev) gamePrev.innerHTML = dataUrl ? '<img src="' + dataUrl + '">' : '—';
    var editPrev = document.getElementById('profile-edit-avatar-preview');
    if (editPrev) editPrev.innerHTML = dataUrl ? '<img src="' + dataUrl + '">' : '—';
}

function previewEditImage(input) {
    if (input.files && input.files[0]) {
        var r = new FileReader();
        r.onload = function(e) { base64EditImg = e.target.result; };
        r.readAsDataURL(input.files[0]);
    }
}

function resetRegisterForm() {
    var ids = [
        'input-gate-user-id', 'input-gate-email', 'input-gate-password', 'input-gate-password2',
        'input-com-name', 'input-com-code', 'input-player-name', 'input-desc'
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.value = '';
    }
    var comMode = document.getElementById('input-com-mode');
    if (comMode) comMode.value = 'create';
    var fileInput = document.getElementById('input-file');
    if (fileInput) fileInput.value = '';
    base64Avatar = '';
    var prev = document.getElementById('avatar-setup-preview');
    if (prev) prev.innerHTML = 'NO DATA';
    var btn = document.getElementById('btn-register-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'ZALOŽIT A VSTOUPIT'; }
    try { onRegComModeChange(); } catch (e) {}
}

function switchGatePage(pageId) {
    var panels = document.querySelectorAll('.gate-panel');
    for (var i = 0; i < panels.length; i++) panels[i].classList.remove('active');
    var el = document.getElementById(pageId);
    if (el) el.classList.add('active');
    hideGateError('gate-login-error');
    hideGateError('gate-register-error');
    hideGateError('gate-recover-error');
    hideGateError('gate-operator-error');
    if (pageId === 'gate-register') resetRegisterForm();
    if (pageId === 'gate-operator') populateOperatorCommunitySelect();
}

function renderOperatorCommunityOptions(comms) {
    var sel = document.getElementById('select-operator-com');
    var input = document.getElementById('input-operator-com-code');
    if (!sel) return;
    var list = [];
    for (var code in comms) {
        if (!Object.prototype.hasOwnProperty.call(comms, code)) continue;
        var c = comms[code];
        list.push({
            code: String(c.code || code).toUpperCase(),
            name: String(c.name || code).trim() || code
        });
    }
    list.sort(function(a, b) {
        return a.name.localeCompare(b.name, 'cs');
    });
    var placeholder = window.patracT
        ? window.patracT('gate.operator.comSelectPlaceholder')
        : '— vyber komunitu (název + kód) —';
    var html = '<option value="">' + placeholder + '</option>';
    if (list.length === 0) {
        html += '<option value="" disabled>(Zatím žádná komunita — zadej kód ručně)</option>';
    } else {
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            html += '<option value="' + item.code + '">' + item.name + ' [' + item.code + ']</option>';
        }
    }
    sel.innerHTML = html;
    sel.disabled = false;
    if (input && input.value) onOperatorCommunityCodeInput();
}

function setOperatorCommunitySelectLoading(loading) {
    var sel = document.getElementById('select-operator-com');
    if (!sel) return;
    if (loading) {
        var loadingLabel = window.patracT
            ? window.patracT('gate.operator.loadingComs')
            : '— načítám komunity… —';
        sel.innerHTML = '<option value="">' + loadingLabel + '</option>';
        sel.disabled = true;
    }
}

function mergeCommunitiesFromAccounts(comms) {
    comms = comms || {};
    var accounts = getPatracAccounts();
    for (var id in accounts) {
        if (!Object.prototype.hasOwnProperty.call(accounts, id)) continue;
        var acc = accounts[id];
        var code = String(acc.comCode || '').trim().toUpperCase();
        if (!code) continue;
        if (!comms[code]) {
            comms[code] = {
                name: String(acc.comName || code).trim() || code,
                code: code,
                founder: '',
                members: [id]
            };
        } else if (comms[code].members && comms[code].members.indexOf(id) === -1) {
            comms[code].members.push(id);
        }
    }
    return comms;
}

function getPatracCommunitiesForOperator() {
    return mergeCommunitiesFromAccounts(getPatracCommunities());
}

function populateOperatorCommunitySelect() {
    var sel = document.getElementById('select-operator-com');
    if (!sel) return;
    var localComms = getPatracCommunitiesForOperator();
    var hasLocal = Object.keys(localComms).length > 0;
    if (hasLocal) {
        renderOperatorCommunityOptions(localComms);
    } else {
        setOperatorCommunitySelectLoading(true);
    }
    withPatracTimeout(
        patracImport('services/communityService.js').then(function(mod) {
            return mod.hydrateAllCommunitiesFromCloud();
        }).then(function(comms) {
            return mergeCommunitiesFromAccounts(comms || getPatracCommunities());
        }),
        20000,
        'operator communities timeout'
    ).then(function(comms) {
        renderOperatorCommunityOptions(comms || getPatracCommunitiesForOperator());
    }).catch(function(err) {
        console.warn('[operator] communities cloud', err);
        renderOperatorCommunityOptions(getPatracCommunitiesForOperator());
    });
}

function onOperatorCommunitySelectChange() {
    var sel = document.getElementById('select-operator-com');
    var input = document.getElementById('input-operator-com-code');
    if (!sel || !input || !sel.value) return;
    input.value = sel.value;
    hideGateError('gate-operator-error');
}

function onOperatorCommunityCodeInput() {
    var sel = document.getElementById('select-operator-com');
    var input = document.getElementById('input-operator-com-code');
    if (!sel || !input) return;
    var code = (input.value || '').trim().toUpperCase();
    if (!code) {
        sel.value = '';
        return;
    }
    var matched = false;
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === code) {
            sel.selectedIndex = i;
            matched = true;
            break;
        }
    }
    if (!matched) sel.value = '';
}

function updateHudMenuUser() {
    var el = document.getElementById('hud-menu-user-id');
    if (!el) return;
    var session = localStorage.getItem('patrac_session');
    var name = localStorage.getItem('player_name') || '';
    if (session) {
        el.textContent = (name ? name + ' · ' : '') + session;
    } else {
        el.textContent = 'Místní relace (bez účtu)';
    }
}

function closeHudMenu() {
    var dd = document.getElementById('hud-menu-dropdown');
    var btn = document.getElementById('btn-hud-menu');
    if (dd) dd.classList.remove('open');
    if (btn) btn.classList.remove('open');
}

function toggleHudMenu(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var dd = document.getElementById('hud-menu-dropdown');
    var btn = document.getElementById('btn-hud-menu');
    if (!dd) return;
    var willOpen = !dd.classList.contains('open');
    closeHudMenu();
    if (willOpen) {
        updateHudMenuUser();
        dd.classList.add('open');
        if (btn) btn.classList.add('open');
        if (!window._hudMenuClickBound) {
            window._hudMenuClickBound = true;
            document.addEventListener('click', closeHudMenu);
        }
    }
}

function teardownGameUiForGate() {
    setMapToolsVisible(false);
    updateRoutePlannerDisplay();

    closeAddPoiPanel();
    closeStoryPositionsPanel();
    closePoiEditor();
    closeStoryPosEditor();
    closeMapLayersPanel();
    cancelTargeting();

    if (gpsWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    var crosshair = document.getElementById('map-crosshair');
    if (crosshair) crosshair.style.display = 'none';

    var floatIds = ['map-compass', 'map-topo-ruler', 'map-route-planner', 'map-tools-bar'];
    for (var fi = 0; fi < floatIds.length; fi++) {
        var fel = document.getElementById(floatIds[fi]);
        if (!fel) continue;
        fel.style.display = 'none';
        fel.classList.remove('is-ready');
    }

    var fabs = document.getElementById('map-tool-fabs');
    if (fabs) fabs.classList.remove('visible');
    var zoom = document.getElementById('map-zoom-controls');
    if (zoom) {
        zoom.classList.remove('visible');
        zoom.setAttribute('aria-hidden', 'true');
    }
    var tactical = document.getElementById('map-tactical-hud');
    if (tactical) tactical.classList.remove('visible');

    var layersPanel = document.getElementById('map-layers-panel');
    if (layersPanel) layersPanel.classList.remove('visible');

    if (topoRulerMod && topoRulerMod.updateTopoRulerDisplay) topoRulerMod.updateTopoRulerDisplay(false);
    if (routePlannerMod && routePlannerMod.updateRoutePlannerDisplay) routePlannerMod.updateRoutePlannerDisplay(false);
    if (typeof window.patracStopRadioComms === 'function') window.patracStopRadioComms();
}

function patracLogout() {
    closeHudMenu();
    syncSessionUserToStorage();
    syncCurrentAccountMissionStats();
    syncCurrentAccountWearLoadout();
    var logoutComCode = localStorage.getItem('com_code') || operatorComCode || '';
    var logoutMapPayload = snapshotCommunityMapCache(logoutComCode);
    flushCommunityMapCacheToCloud(logoutComCode, logoutMapPayload).catch(function(err) {
        console.warn('[logout] cloud flush', err);
    });
    importAuthService().then(function(mod) {
        return mod.signOutPatracAuth();
    }).catch(function(err) {
        console.warn('[auth] logout', err);
    });
    try { localStorage.removeItem('patrac_session'); } catch (e) {}
    // Mapové body patří komunitě — při odhlášení / odchodu z admina je NEmazat,
    // jinak ruční přihlášení zpět smaže útočiště (a sync pošle null do cloudu).
    clearGlobalSessionGameCache({ keepMapPoints: true });
    localStorage.setItem('items_community', '[]');
    localStorage.setItem('items_personal', '[]');

    isOperatorMode = false;
    operatorComCode = '';
    currentlyEditingPlayerId = null;
    operatorEditDraft = null;
    operatorEditDirty = false;
    document.body.classList.remove('admin-mode');
    document.body.classList.remove('admin-editing-player');
    updateAdminBar();

    teardownGameUiForGate();

    var profilePanel = document.getElementById('profile-edit-panel');
    if (profilePanel) profilePanel.classList.remove('open');
    closeLoreEditor();

    document.getElementById('gate-box').style.display = 'flex';
    document.getElementById('hud-top').style.display = 'none';
    document.getElementById('hud-left').style.display = 'none';
    document.getElementById('hud-bottom').style.display = 'none';
    var centerTabs = document.getElementById('hud-center-tabs');
    if (centerTabs) centerTabs.style.display = 'none';
    var targetingBar = document.getElementById('map-targeting-bar');
    if (targetingBar) targetingBar.style.display = 'none';

    var mapEl = document.getElementById('map');
    if (mapEl) mapEl.classList.remove('blur-mode');

    var loginId = document.getElementById('input-login-id');
    var loginPass = document.getElementById('input-login-pass');
    if (loginId) loginId.value = '';
    if (loginPass) loginPass.value = '';

    switchGatePage('gate-login');
}

function onRegComModeChange() {
    var mode = document.getElementById('input-com-mode').value;
    var createBox = document.getElementById('reg-com-create');
    var joinBox = document.getElementById('reg-com-join');
    if (createBox) createBox.classList.toggle('active', mode === 'create');
    if (joinBox) joinBox.classList.toggle('active', mode === 'join');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
    email = (email || '').trim().toLowerCase();
    if (email.endsWith('@gmail.co')) email += 'm';
    return email;
}

function validatePatracUserIdInput(userId, errorKey) {
    if (String(userId || '').indexOf('@') !== -1) {
        return 'Do pole Uživatelské ID nedávej e-mail — zadej ID operativce (např. mvit).';
    }
    return '';
}

function showPatracBuildLabel() {
    var el = document.getElementById('patrac-build-label');
    if (el && window.PATRAC_BUILD) el.textContent = 'build ' + window.PATRAC_BUILD;
}

function getPatracCommunities() {
    try {
        var data = localStorage.getItem('patrac_communities');
        if (data) return JSON.parse(data);
    } catch (e) {}
    return {};
}

function savePatracCommunities(comms) {
    localStorage.setItem('patrac_communities', JSON.stringify(comms));
    patracImport('services/communityService.js').then(function(mod) {
        for (var code in comms) {
            if (!comms.hasOwnProperty(code)) continue;
            mod.saveCommunityToCloud(code, comms[code]).catch(function(err) {
                console.warn('[cloud] community sync', code, err);
            });
        }
    }).catch(function(err) {
        console.warn('[cloud] communityService', err);
    });
}

function getAllUsedPatracCodes() {
    var used = {};
    var comms = getPatracCommunities();
    for (var k in comms) used[k] = true;
    var accs = getPatracAccounts();
    for (var id in accs) {
        if (accs[id].playerCode) used[accs[id].playerCode] = true;
        if (accs[id].comCode) used[accs[id].comCode] = true;
    }
    return used;
}

function generatePatracCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var used = getAllUsedPatracCodes();
    for (var attempt = 0; attempt < 200; attempt++) {
        var code = '';
        for (var i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!used[code]) return code;
    }
    return 'P' + Date.now().toString(36).slice(-4).toUpperCase();
}

function verifyOperatorAdminKey(input) {
    return (input || '').trim() === OPERATOR_ADMIN_KEY;
}

function getPatracProfileKey(userId) {
    return 'patrac_profile_' + userId;
}

/** Smaže globální herní cache — před přepnutím účtu/komunity. */
function clearGlobalSessionGameCache(options) {
    options = options || {};
    var keepMapPoints = options.keepMapPoints === true;
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (key.indexOf('quest_done_') === 0 ||
            key.indexOf('unlocked_story_') === 0) {
            keysToRemove.push(key);
            continue;
        }
        if (keepMapPoints) continue;
        if (key.indexOf('point_') === 0 ||
            key.indexOf('story_pos_note_') === 0 ||
            key.indexOf('story_pos_img_') === 0) {
            keysToRemove.push(key);
        }
    }
    for (var r = 0; r < keysToRemove.length; r++) {
        try { localStorage.removeItem(keysToRemove[r]); } catch (e) {}
    }
    safeLocalStorageSet('items_community', '[]');
    if (!keepMapPoints) {
        safeLocalStorageSet('map_free_pois', '[]');
        safeLocalStorageSet('custom_quests_list', '[]');
        safeLocalStorageSet('random_quests_list', '[]');
        safeLocalStorageSet('dismissed_quests', '[]');
        safeLocalStorageSet('quest_req_overrides', '{}');
        safeLocalStorageSet('quest_definitions_list', '[]');
    }
    safeLocalStorageSet('quest_sections_state', '{}');
}

function loadCommunityInventoryFromComCode(comCode) {
    comCode = String(comCode || '').trim().toUpperCase();
    if (!comCode) {
        localStorage.setItem('items_community', '[]');
        return;
    }
    var raw = localStorage.getItem(getPatracItemsCommunityKey(comCode));
    if (raw !== null) {
        localStorage.setItem('items_community', raw);
    } else {
        localStorage.setItem('items_community', '[]');
    }
}

function emptyCommunityQuestsForCloud() {
    return {
        version: 1,
        story: {},
        custom: [],
        random: [],
        dismissed: [],
        reqOverrides: {},
        launched: {},
        definitions: [],
        updatedAt: Date.now()
    };
}

function beginSessionForUser(userId, options) {
    options = options || {};
    var previousCom = String(localStorage.getItem('com_code') || '').trim().toUpperCase();
    if (previousCom) snapshotCommunityMapCache(previousCom);
    var accounts = getPatracAccounts();
    var acc = accounts[userId];
    var nextCom = String((acc && acc.comCode) || '').trim().toUpperCase();
    // Stejná komunita (reload / re-login / odchod z admina): nemazat mapové body.
    var keepMapPoints = !!(previousCom && nextCom && previousCom === nextCom);
    clearGlobalSessionGameCache({ keepMapPoints: keepMapPoints });
    applyAccountToLocalStorage(userId);
    var comCode = String(localStorage.getItem('com_code') || '').trim().toUpperCase();
    loadCommunityInventoryFromComCode(comCode);
    if (!keepMapPoints) {
        if (!restoreCommunityMapCache(comCode) && previousCom && previousCom !== comCode) {
            restoreCommunityMapCache(previousCom);
        }
    }
    // Vždy doplň chybějící body z cache (kryje logout→ruční login i admin→hráč).
    if (comCode) restoreCommunityMapCache(comCode, { fillOnly: true });
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
        var previousCom = String(localStorage.getItem('com_code') || '').trim().toUpperCase();
        var nextCom = String(comCode || '').trim().toUpperCase();
        if (previousCom) snapshotCommunityMapCache(previousCom);
        var keepMapPoints = !!(previousCom && nextCom && previousCom === nextCom);
        clearGlobalSessionGameCache({ keepMapPoints: keepMapPoints });
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
        if (keepMapPoints) restoreCommunityMapCache(comCode, { fillOnly: true });
        else restoreCommunityMapCache(comCode);
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
        if (textEl) textEl.textContent = '🔶 REŽIM OPERÁTOR — ' + comName + editLabel;
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
        el.innerHTML = '<p style="font-size:var(--text-sm);color:var(--faint-fg);">V komunitě zatím nejsou registrovaní pátrači.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < members.length; i++) {
        var mem = members[i];
        var av = localStorage.getItem(getPatracAvatarKey(mem.userId)) || '';
        var avHtml = av ? '<img src="' + av + '">' : (isBotAccount(mem.account) ? '🤖' : '—');
        var cls = 'operator-member-row';
        if (mem.userId === currentlyEditingPlayerId) cls += ' is-editing';
        if (isBotAccount(mem.account)) cls += ' is-bot';
        var label = mem.account.playerName || mem.userId;
        html += '<div class="' + cls + '">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += '<div style="flex:1;"><strong>' + label + '</strong><br><span style="font-size:var(--text-xs);color:var(--dim-fg);">';
        html += (isBotAccount(mem.account) ? '🤖 test · ' : '') + mem.userId + ' · ' + (mem.account.localMissions || 0) + ' misí</span></div>';
        html += '<button type="button" class="btn-op-edit" onclick="enterOperatorEditPlayer(\'' + mem.userId.replace(/'/g, "\\'") + '\')">' + (mem.userId === currentlyEditingPlayerId ? '✎ EDITUJI' : 'PŘEVZÍT IDENTITU') + '</button>';
        if (isBotAccount(mem.account)) {
            html += '<button type="button" class="btn-op-remove" onclick="operatorRemoveBotOperative(\'' + mem.userId.replace(/'/g, "\\'") + '\')">🗑 ODSTRANIT</button>';
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
        missionEl.innerHTML = mhtml || '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Žádné definované mise</span>';
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
            shtml += '<button type="button" onclick="adjustOperatorSpec(\'' + key + '\', -1)">−</button>';
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
        if (!confirm('Mise „' + (gameQuests[questId].mapLabel || gameQuests[questId].title) + '“ nemá uloženou polohu na mapě.\nOznačit jako splněnou i bez bodu? (Doporučeno: nejdřív umístit na mapě.)')) {
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
        alert('Změny hráče „' + (accounts[playerId] && accounts[playerId].playerName || playerId) + '“ uloženy.');
    }
    return true;
}

function saveOperatorEdits() {
    if (!persistOperatorEdits({})) {
        alert('Nejdřív vyber hráče k editaci.');
    }
}

function patracExitOperatorKeepIdentity() {
    if (!isOperatorMode) return;
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    snapshotCommunityMapCache(comCode);
    var userId = currentlyEditingPlayerId || localStorage.getItem('patrac_session');
    if (!userId) {
        alert('Nejdřív v záložce Útočiště převez identitu hráče (PŘEVZÍT IDENTITU).');
        return;
    }
    if (operatorEditDirty && currentlyEditingPlayerId && operatorEditDraft) {
        if (confirm('Uložit neuložené změny před ukončením administrace?')) {
            persistOperatorEdits({ silent: true, skipUiRefresh: true });
        } else if (!confirm('Ukončit administraci bez uložení? Neuložené změny budou ztraceny.')) {
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
    // Doplň mapové body z cache (admin clear / jiný účet je nesměl smazat).
    var playerCom = String(localStorage.getItem('com_code') || comCode || '').trim().toUpperCase();
    if (playerCom) restoreCommunityMapCache(playerCom, { fillOnly: true });
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
    if (avPrev) avPrev.innerHTML = av ? '<img src="' + av + '">' : '—';

    updateAdminBar();
    renderOperatorEditPanel();
    renderCommunityProfile();
    updateStatsHud();
    loadCustomCraftedItems();
    updateHudMenuUser();
    updateRadioDisplayHud();
    try { reloadAllMapPoints(); } catch (eReload) {}
    var editBtn = document.getElementById('btn-toggle-profile-edit');
    if (editBtn) editBtn.style.display = 'block';
}

function patracExitOperator() {
    if (operatorEditDirty && !confirm('Ukončit režim operátor? Neuložené změny v aktuální editaci mohou být ztraceny.')) return;
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
            try { restoreCommunityMapCache(comCode, { fillOnly: true }); } catch (eFill) {}
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

/** E-mail je obsazený jen pokud existuje v cloudu — starý localStorage ghost se ignoruje. */
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
        alert('Chybí kód komunity.');
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
    alert('Přidán testovací operativce ' + botName + ' (ID: ' + userId + ').');
}

function operatorRemoveBotOperative(userId) {
    if (!isOperatorMode || !userId) return;
    var accounts = getPatracAccounts();
    var acc = accounts[userId];
    if (!acc || !isBotAccount(acc)) {
        alert('Lze odstranit pouze testovací BOT operativce.');
        return;
    }
    var comm = getCurrentCommunityRecord();
    if (comm && comm.founder === userId) {
        alert('Tento BOT je zapsán jako zakladatel komunity — nejdřív předej správcovství jinému hráči.');
        return;
    }
    if (!confirm('Odstranit „' + (acc.playerName || userId) + '“ včetně profilu a inventáře?')) return;

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
    if (!memberCount || memberCount <= 0) return '—';
    var rounded = Math.round(efficiency * 100) / 100;
    return rounded.toFixed(1).replace('.', ',') + '×';
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
    if (tier >= 5) return 'Nejvyšší hodnost dosažena';
    if (memberCount <= 0) {
        return buildNextRankHint(0, 1, COMMUNITY_RANK_NAMES, { unitLabel: 'misí' });
    }
    var missionsNeeded = getCommunityMissionsNeededForNextTier(totalXP, tier, memberCount, divisor);
    var nextName = COMMUNITY_RANK_NAMES[tier];
    return 'Další hodnost ' + nextName + ' za ' + missionsNeeded + ' misí';
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
            teamEfficiencyLabel: '—',
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
    /* divisor UI přesunut — migrace profilu později */
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
        if (comRankEl) comRankEl.textContent = '—';
        if (comMissionsEl) comMissionsEl.textContent = '0';
        var effEl = document.getElementById('display-com-efficiency');
        if (effEl) effEl.textContent = '—';
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
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zatím žádní pátrači</span>';
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
    var html = '<option value="">— vyber pátrače —</option>';
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
        btn.textContent = open ? '✎ SKRÝT ÚPRAVU PROFILU' : '✎ UPRAVIT PROFIL OPERATIVCE';
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
            alert('Avatar se nepodařilo zpracovat. Zkus menší nebo jinou fotku.');
            return;
        }
        base64ProfileEditAvatar = result;
        updateAvatarPreviewElements(result);
    });
}

function saveProfileEdits() {
    var session = localStorage.getItem('patrac_session');
    if (!session) { alert('Nejsi přihlášen.'); return; }
    var accounts = getPatracAccounts();
    var acc = accounts[session];
    if (!acc) return;

    var newName = document.getElementById('edit-player-name').value.trim();
    var newDesc = document.getElementById('edit-player-desc').value.trim();
    var newEmail = normalizeEmail(document.getElementById('edit-player-email').value);
    var newPass = document.getElementById('edit-player-pass').value;

    if (!newName) { alert('Jméno operativce je povinné.'); return; }
    if (!isValidEmail(newEmail)) { alert('Zadej platný email.'); return; }
    if (isEmailTaken(newEmail, session)) { alert('Tento email už používá jiný účet.'); return; }
    if (newPass && newPass.length < 6) { alert('Nové heslo musí mít alespoň 6 znaků (Firebase).'); return; }

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
            alert('Avatar se nepodařilo uložit — localStorage je plné nebo je fotka příliš velká.');
            return;
        }
    }

    document.getElementById('display-player-name').textContent = newName;
    if (localStorage.getItem('player_avatar')) {
        updateAvatarPreviewElements(localStorage.getItem('player_avatar'));
    }
    renderCommunityProfile();
    alert('Profil operativce uložen.');
}

function transferCommunityAdmin() {
    var session = localStorage.getItem('patrac_session');
    if (!isCommunityAdmin(session)) { alert('Pouze správce může předat správcovství.'); return; }
    var sel = document.getElementById('edit-transfer-admin');
    var newAdmin = sel ? sel.value : '';
    if (!newAdmin) { alert('Vyber nového správce.'); return; }
    var comCode = localStorage.getItem('com_code');
    var comms = getPatracCommunities();
    if (!comCode || !comms[comCode]) return;
    if (!confirm('Předat správcovství komunity pátrači „' + (sel.options[sel.selectedIndex].text || newAdmin) + '“? Tuto akci lze zvrátit jen novým správcem.')) return;
    comms[comCode].founder = newAdmin;
    savePatracCommunities(comms);
    renderCommunityProfile();
    fillProfileEditForm();
    alert('Správcovství předáno.');
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
        showGateError('gate-recover-error', 'Zadej uživatelské ID operativce.');
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
        alert('Heslo obnoveno. Přihlas se svým uživatelským ID: ' + userId);
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
        'gate.errors.loginMissingId': 'CHYBA: Zadej uživatelské ID.',
        'gate.errors.loginUnknownId': 'CHYBA: ID není v síti, nebo heslo nesedí. Zkus znovu, nebo obnovu hesla.',
        'gate.errors.loginBadPass': 'CHYBA: Heslo nesouhlasí. Signál zamítnut.',
        'gate.errors.loginFailed': 'CHYBA: Přihlášení selhalo — zkontroluj připojení a zkus znovu.'
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
            reject(new Error(message || 'Vypršel časový limit — obnov stránku (Ctrl+F5) a zkus znovu.'));
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

function patracLogin() {
    hideGateError('gate-login-error');
    var userId = normalizePatracId(document.getElementById('input-login-id').value);
    var pass = document.getElementById('input-login-pass').value;
    if (!userId) {
        showGateError('gate-login-error', 'gate.errors.loginMissingId');
        return;
    }
    var loginIdErr = validatePatracUserIdInput(userId, 'gate-login-error');
    if (loginIdErr) {
        showGateError('gate-login-error', loginIdErr);
        return;
    }

    function finishLogin() {
        try {
            beginSessionForUser(userId, { profileData: getUserProfileData(userId) });
            isOperatorMode = false;
            operatorComCode = '';
            currentlyEditingPlayerId = null;
            operatorEditDraft = null;
            operatorEditDirty = false;
            launchGame();
        } catch (launchErr) {
            console.error('[auth] finishLogin', launchErr);
            showGateError('gate-login-error', launchErr.message || 'gate.errors.loginFailed');
        }
    }

    function mergeAndFinishLogin(cloudAcc, localAcc) {
        var accounts = getPatracAccounts();
        var merged = cloudAcc
            ? slimPatracAccount(Object.assign({}, localAcc || {}, cloudAcc, { pass: pass }))
            : slimPatracAccount(Object.assign({}, localAcc || {}, { pass: pass }));
        if (!merged) {
            showGateError('gate-login-error', 'gate.errors.loginUnknownId');
            return;
        }
        accounts[userId] = merged;
        ensureLegacyPatracCodes(userId, accounts[userId]);
        savePatracAccounts(accounts);
        finishLogin();
    }

    function bootstrapAfterAuth(localAcc) {
        return patracImport('services/accountService.js').then(function(accMod) {
            return accMod.fetchAccountFromCloud(userId).catch(function(e) {
                console.warn('[login] cloud account fetch', e);
                return null;
            });
        }).then(function(cloudAcc) {
            if (cloudAcc || localAcc) {
                mergeAndFinishLogin(cloudAcc, localAcc);
                return;
            }
            return importAuthService().then(function(authMod) {
                return authMod.fetchPatracIdMapping(userId);
            }).then(function(mapping) {
                if (!mapping || !mapping.firebaseUid) {
                    showGateError('gate-login-error',
                        'Firebase přihlášení OK, ale profil v síti chybí. Zkus obnovu hesla, nebo se registruj znovu.');
                    return;
                }
                var accounts = getPatracAccounts();
                accounts[userId] = slimPatracAccount({
                    pass: pass,
                    email: mapping.registrationEmail || mapping.loginEmail || '',
                    comName: '',
                    comCode: '',
                    playerName: userId,
                    playerCode: generatePatracCode(),
                    localMissions: 0
                });
                ensureLegacyPatracCodes(userId, accounts[userId]);
                savePatracAccounts(accounts);
                finishLogin();
            });
        });
    }

    var loginBtn = document.getElementById('btn-login-submit');
    var loginBtnLabel = loginBtn ? loginBtn.textContent : 'DEŠIFROVAT A VSTOUPIT';
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'PŘIPOJOVÁNÍ…'; }

    var localAcc = resolveLocalPatracAccount(userId);

    withPatracTimeout(
        importAuthService().then(function(authMod) {
            return authMod.signInPatracAuth(userId, pass, localAcc);
        }).then(function() {
            return bootstrapAfterAuth(localAcc);
        }),
        45000,
        'Připojení trvá příliš dlouho — zkontroluj internet, vypni VPN/adblock, nebo obnov stránku (Ctrl+F5).'
    ).catch(function(err) {
        console.warn('[auth] login', err);
        var msg = (err && err.message) || '';
        if ((err && err.code === 'auth/wrong-password') || msg.indexOf('Špatné heslo') !== -1) {
            showGateError('gate-login-error', 'gate.errors.loginBadPass');
        } else if (err && err.code === 'auth/weak-password') {
            showGateError('gate-login-error', msg);
        } else if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
            showGateError('gate-login-error', 'gate.errors.loginBadPass');
        } else if (err && err.code === 'auth/network-request-failed') {
            showGateError('gate-login-error', 'CHYBA: Síť neodpovídá — zkontroluj připojení.');
        } else if (msg) {
            showGateError('gate-login-error', msg);
        } else {
            showGateError('gate-login-error', 'gate.errors.loginUnknownId');
        }
    }).finally(function() {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = loginBtnLabel;
        }
    });
}

function switchSetupPage(id) {
    switchGatePage(id === 'sub-page-avatar' ? 'gate-register' : 'gate-login');
}

function saveProfileAndLaunch() {
    try {
    try { migratePatracAccountsStorage(); } catch (migrateErr) { console.warn(migrateErr); }
    hideGateError('gate-register-error');
    var submitBtnStart = document.getElementById('btn-register-submit');
    var userId = normalizePatracId(document.getElementById('input-gate-user-id').value);
    var email = normalizeEmail(document.getElementById('input-gate-email').value);
    var pass = document.getElementById('input-gate-password').value;
    var pass2 = document.getElementById('input-gate-password2').value;
    var comModeEl = document.getElementById('input-com-mode');
    var comMode = comModeEl ? comModeEl.value : 'create';
    var playerName = document.getElementById('input-player-name').value.trim();

    if (!userId) {
        showGateError('gate-register-error', 'gate.errors.registerMissingId');
        return;
    }
    var regIdErr = validatePatracUserIdInput(userId, 'gate-register-error');
    if (regIdErr) {
        showGateError('gate-register-error', regIdErr);
        return;
    }
    if (!isValidEmail(email)) {
        showGateError('gate-register-error', 'gate.errors.registerBadEmail');
        return;
    }
    if (pass.length < 6) {
        showGateError('gate-register-error', 'gate.errors.registerShortPass');
        if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALOŽIT A VSTOUPIT'; }
        return;
    }
    if (pass !== pass2) {
        showGateError('gate-register-error', 'gate.errors.registerPassMismatch');
        if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALOŽIT A VSTOUPIT'; }
        return;
    }
    if (!playerName) {
        showGateError('gate-register-error', 'gate.errors.registerMissingName');
        return;
    }

    if (submitBtnStart) { submitBtnStart.disabled = true; submitBtnStart.textContent = 'ZPRACOVÁVÁM…'; }

    var comName = '';
    var comCode = '';
    if (comMode === 'create') {
        comName = document.getElementById('input-com-name').value.trim();
        if (!comName) {
            showGateError('gate-register-error', 'gate.errors.registerMissingComName');
            if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALOŽIT A VSTOUPIT'; }
            return;
        }
        continueRegisterAfterCommunityCheck(comName, comCode, comMode, userId, email, pass, playerName);
    } else {
        comCode = (document.getElementById('input-com-code').value || '').trim().toUpperCase();
        if (comCode.length !== 5) {
            showGateError('gate-register-error', 'gate.errors.registerBadComCode');
            if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALOŽIT A VSTOUPIT'; }
            return;
        }
        var submitBtnEarly = submitBtnStart;
        if (submitBtnEarly) { submitBtnEarly.disabled = true; submitBtnEarly.textContent = 'OVĚŘUJI KOMUNITU…'; }
        findCommunityByCodeWithCloud(comCode).then(function(existingComm) {
            if (!existingComm) {
                showGateError('gate-register-error', 'gate.errors.registerUnknownCom');
                if (submitBtnEarly) { submitBtnEarly.disabled = false; submitBtnEarly.textContent = 'ZALOŽIT A VSTOUPIT'; }
                return;
            }
            continueRegisterAfterCommunityCheck(existingComm.name, comCode, comMode, userId, email, pass, playerName);
        }).catch(function() {
            showGateError('gate-register-error', 'gate.errors.registerUnknownCom');
            if (submitBtnEarly) { submitBtnEarly.disabled = false; submitBtnEarly.textContent = 'ZALOŽIT A VSTOUPIT'; }
        });
    }
    } catch (err) {
        console.error('saveProfileAndLaunch', err);
        showGateError('gate-register-error', 'gate.errors.registerFailed', { msg: err.message || err });
        var btn = document.getElementById('btn-register-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'ZALOŽIT A VSTOUPIT'; }
    }
}

function registerSubmitFail(msgOrKey, opts) {
    showGateError('gate-register-error', msgOrKey, opts);
    var btn = document.getElementById('btn-register-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'ZALOŽIT A VSTOUPIT'; }
}

function continueRegisterAfterCommunityCheck(comName, comCode, comMode, userId, email, pass, playerName) {
    var submitBtn = document.getElementById('btn-register-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'OVĚŘUJI ID…'; }

    patracImport('services/accountService.js').then(function(mod) {
        return mod.fetchAccountFromCloud(userId);
    }).then(function(cloudAcc) {
        if (cloudAcc) {
            showGateError('gate-register-error',
                'ID „' + userId + '“ už existuje v cloudu. Přihlas se, nebo zvol jiné ID operativce.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ZALOŽIT A VSTOUPIT'; }
            return;
        }
        finishRegisterAfterCloudCheck(comName, comCode, comMode, userId, email, pass, playerName);
    }).catch(function(err) {
        console.warn('[cloud] register id check', err);
        finishRegisterAfterCloudCheck(comName, comCode, comMode, userId, email, pass, playerName);
    });
}

function completeRegisterAfterAuth(comName, comCode, comMode, userId, email, pass, playerName) {
    var launched = false;
    try {
    var accounts = getPatracAccounts();
    var playerCode = generatePatracCode();
    if (comMode === 'create') {
        comCode = registerPatracCommunity(comName, userId);
    } else {
        addMemberToCommunity(comCode, userId);
    }

    var descText = document.getElementById('input-desc').value.trim();
    accounts[userId] = slimPatracAccount({
        pass: pass,
        email: email,
        comName: comName,
        comCode: comCode,
        playerName: playerName,
        playerCode: playerCode
    });
    savePatracAccounts(accounts);

    var defaultProfile = createDefaultUserProfileData(userId);
    beginSessionForUser(userId, {
        profileData: defaultProfile,
        comName: comName,
        resetChronicle: true
    });

    saveUserDesc(userId, descText);
    var avatarSaved = true;
    if (base64Avatar) avatarSaved = saveUserAvatar(userId, base64Avatar);
    saveUserProfileData(userId, defaultProfile);

    try { sessionStorage.setItem('patrac_fresh_register', '1'); } catch (e) {}

    var msg = 'Registrace dokončena.\n\nKód operativce: ' + playerCode;
    if (comMode === 'create') {
        msg += '\nKód komunity: ' + comCode + '\n(Sdílej ho s dalšími pátrači pro připojení.)';
    } else {
        msg += '\nPřipojeno ke komunitě: ' + comName + ' [' + comCode + ']';
    }
    if (base64Avatar && !avatarSaved) {
        msg += '\n\n(Poznámka: avatar se nevešel do úložiště — účet funguje bez fotky.)';
    }
    isOperatorMode = false;
    operatorComCode = '';
    currentlyEditingPlayerId = null;
    operatorEditDraft = null;
    operatorEditDirty = false;

    resetRegisterForm();
    launched = true;
    alert(msg);
    launchGame();

    patracImport('services/playerService.js').then(function(mod) {
        return mod.syncPlayerFromLocalStorage(userId);
    }).catch(function(err) {
        console.warn('[register] player cloud sync', err);
    });
    } catch (err) {
        console.error('[register] completeRegisterAfterAuth', err);
        if (!launched) {
            registerSubmitFail(err.message || 'gate.errors.registerFailed');
            return Promise.reject(err);
        }
    }
    return Promise.resolve();
}

function runRegisterAuthFlow(comName, comCode, comMode, userId, email, pass, playerName, submitBtn) {
    if (submitBtn) submitBtn.textContent = 'ZPRACOVÁVÁM…';
    return importAuthService().then(function(authMod) {
        return authMod.registerPatracAuth(userId, pass, email);
    }).then(function() {
        return completeRegisterAfterAuth(comName, comCode, comMode, userId, email, pass, playerName);
    }).catch(function(err) {
        console.warn('[auth] register', err);
        var errMsg = err.message || 'Registrace selhala.';
        if (err && err.code === 'auth/email-already-in-use') {
            errMsg = 'E-mail je ve Firebase obsazený — smaž ho v Authentication, nebo použij jiný.';
        }
        registerSubmitFail(errMsg);
    });
}

function finishRegisterAfterCloudCheck(comName, comCode, comMode, userId, email, pass, playerName) {
    try {
    var accounts = getPatracAccounts();
    if (accounts[userId]) {
        delete accounts[userId];
        try { savePatracAccounts(accounts); } catch (e) { console.warn(e); }
    }

    var submitBtn = document.getElementById('btn-register-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'OVĚŘUJI EMAIL…'; }

    isEmailTakenForRegister(email, userId).then(function(emailTaken) {
        if (emailTaken) {
            registerSubmitFail('gate.errors.registerEmailTaken');
            return;
        }
        runRegisterAuthFlow(comName, comCode, comMode, userId, email, pass, playerName, submitBtn);
    }).catch(function(err) {
        console.warn('[register] email check', err);
        runRegisterAuthFlow(comName, comCode, comMode, userId, email, pass, playerName, submitBtn);
    });
    } catch (err) {
        console.error('finishRegisterAfterCloudCheck', err);
        registerSubmitFail('gate.errors.registerFailed', { msg: err.message || err });
    }
}

function launchGame() {
    try { migrateLegacyData(); } catch (e) { console.error('migrateLegacyData', e); }
    try { checkClanOnLaunch(); } catch (e) { console.error('checkClanOnLaunch', e); }
    try { migratePoiNotes(); repairStoryQuestDismissed(); ensureRandomQuests(); } catch (e) { console.error('migratePoi', e); }
    var launchComCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (launchComCode) {
        try { restoreCommunityMapCache(launchComCode); } catch (e) { console.warn('restoreCommunityMapCache', e); }
    }
    try { reconcileCommunityInventory(localStorage.getItem('com_code') || operatorComCode || ''); } catch (e) { console.error('reconcileCommunityInventory', e); }

    document.getElementById('gate-box').style.display = 'none';
    document.getElementById('setup-box').style.display = 'none';
    document.getElementById('hud-top').style.display = 'flex';
    document.getElementById('hud-left').style.display = 'flex';
    document.getElementById('hud-bottom').style.display = 'flex';

    document.getElementById('display-com-name').textContent = localStorage.getItem('com_name') || "---";
    document.getElementById('display-player-name').textContent = localStorage.getItem('player_name') || "---";
    updateProfileCodeDisplay();
    renderCommunityProfile();

    var session = localStorage.getItem('patrac_session');
    var editBtn = document.getElementById('btn-toggle-profile-edit');
    if (editBtn) editBtn.style.display = session ? 'block' : 'none';
    updateHudMenuUser();

    if (session) {
        var accs = getPatracAccounts();
        if (accs[session] && ensureLegacyPatracCodes(session, accs[session])) {
            savePatracAccounts(accs);
            applyAccountToLocalStorage(session);
            updateProfileCodeDisplay();
        }
    }
    if (localStorage.getItem('player_avatar')) {
        document.getElementById('avatar-game-preview').innerHTML = '<img src="' + localStorage.getItem('player_avatar') + '">';
    }

    initMap();
    updateCompassUi();
    updateStatsHud();
    initQuestSections();
    initCraftSection();
    renderQuestList();
    rebuildSelectOptions();
    rebuildCustomLocLinkSelect();
    loadCustomCraftedItems();
    syncCurrentAccountWearLoadout();
    updateRadioDisplayHud();

    var craftTypeEl = document.getElementById('craft-item-type');
    if (craftTypeEl && !craftTypeEl._bindListener) {
        craftTypeEl._bindListener = true;
        craftTypeEl.addEventListener('change', updateCraftBindLabel);
    }
    updateCraftBindLabel();

    updateAdminBar();
    renderOperatorClanUI();

    initPoctaModuleAsync();
    initQuestAdminAsync();
    initRadioCommsAsync();
    initCloudSyncAsync();
    initDataKartaAsync();

    var tabBtn = document.querySelectorAll('.bottom-action-bar button')[0];
    switchMainTab('shelter', tabBtn);
}

function cancelTargeting() {
    activeTargetingQuest = null;
    targetingMode = 'complete';
    document.getElementById('map-targeting-bar').style.display = 'none';
    updateTargetingBarUI();
    updateMapCrosshair();
}

function updateTargetingBarUI() {
    var titleEl = document.getElementById('targeting-bar-title');
    var btn = document.getElementById('btn-lock-target');
    if (!titleEl || !btn) return;
    if (targetingMode === 'place_only') {
        titleEl.textContent = 'Ukotvit polohu úkolu — posuň mapu do kříže';
        btn.textContent = '📍 ULOŽIT POLOHU (bez splnění mise)';
    } else {
        titleEl.textContent = 'Taktický režim: Posuňte cíl do kříže';
        btn.textContent = '📍 POTVRDIT LOKACI (STŘED MAPY)';
    }
}

function activatePlacementMode(questId) {
    if (!canUseMapPlacement()) {
        placeQuestAtGps(questId);
        return;
    }
    targetingMode = 'place_only';
    activeTargetingQuest = questId;
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
    document.getElementById('map-targeting-bar').style.display = 'block';
    updateTargetingBarUI();
    document.getElementById('btn-lock-target').onclick = function() { lockCurrentLocation(questId); };
    updateMapCrosshair();
}

function lockQuestLocationOnly(char) {
    var q = getQuestById(char);
    if (!q) return;
    var lat, lng;
    if (canUseMapPlacement()) {
        var center = getMapCenterCoords();
        lat = center.lat;
        lng = center.lng;
    } else {
        var pos = getUserPositionOrAlert();
        if (!pos) return;
        lat = pos.lat;
        lng = pos.lng;
    }
    saveQuestCoords(char, lat, lng);
    renderPointOnMap(char, lat, lng, q.mapLabel || q.title, q.desc);
    rebuildCustomLocLinkSelect();
    cancelTargeting();
    switchMainTab('tasks', document.querySelectorAll('.bottom-action-bar button')[1]);
    alert('📍 Poloha „' + getQuestMapLabel(q) + '“ uložena. Misi splníš po fyzickém výkonu a potvrzení v rozkazech.');
}

function initPoctaModuleAsync() {
    patracImport('pocta/index.js').then(function(mod) {
        mod.initPoctaModule({
            map: map,
            mapPointsLayer: mapPointsLayer,
            mapMarkerRegistry: mapMarkerRegistry,
            lastUserPosition: lastUserPosition,
            distanceMeters: distanceMeters,
            switchMainTab: switchMainTab,
            startGeolocation: startGeolocation,
            getCommunityItemsRaw: getCommunityItemsRaw,
            saveCommunityItemsRaw: saveCommunityItemsRaw,
            loadCustomCraftedItems: loadCustomCraftedItems,
            resolveCommunityItemAtDisplayIndex: resolveCommunityItemAtDisplayIndex
        });
    }).catch(function(err) {
        console.error('initPoctaModule', err);
    });
}

function initDataKartaAsync() {
    patracImport('data-karta.js').then(function(mod) {
        mod.initDataKarta();
    }).catch(function(err) {
        console.error('initDataKarta', err);
    });
}

function switchMainTab(tab, element) {
    var m = document.getElementById('map');
    var c = document.getElementById('hud-center-tabs');

    var btns = document.querySelectorAll('.bottom-action-bar button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    if (element) element.classList.add('active');

    if (activeTargetingQuest && tab !== 'map-only') cancelTargeting();
    if (tab !== 'map-only') {
        closeAddPoiPanel();
        closeStoryPositionsPanel();
        closePoiEditor();
        closeStoryPosEditor();
    }

    setMapToolsVisible(tab === 'map-only');

    if (tab === 'map-only') {
        if (m) m.classList.remove('blur-mode');
        c.style.display = 'none';
        setTimeout(function() {
            if (map) {
                ensureMapPanes();
                map.invalidateSize();
                refreshMapLayerStack();
                reloadAllMapPoints();
                if (!userMarker) startGeolocation();
            }
        }, 150);
    } else {
        if (m) m.classList.add('blur-mode');
        c.style.display = 'block';
        document.getElementById('content-shelter').style.display = (tab === 'shelter') ? 'block' : 'none';
        document.getElementById('content-tasks').style.display = (tab === 'tasks') ? 'block' : 'none';
        document.getElementById('content-clan').style.display = (tab === 'clan') ? 'block' : 'none';
        if (tab === 'clan') {
            updateRadioDisplayHud();
        }
        document.getElementById('data-karta').style.display = (tab === 'data-karta') ? 'block' : 'none';
        document.getElementById('content-inventory').style.display = (tab === 'inventory') ? 'block' : 'none';
        if (isOperatorMode) ensureOperatorEditContext();
    }
}

function updateCraftBindLabel() {
    var sel = document.getElementById('craft-item-type');
    var lbl = document.getElementById('craft-bind-label');
    if (!sel || !lbl) return;
    if (sel.value === 'tool') {
        lbl.textContent = 'NAVÁZAT NA ÚKOL (POŽADOVANÉ VYBAVENÍ):';
    } else {
        lbl.textContent = 'NAVÁZAT NA ÚKOL (ZÁMĚK DO BLUEPRINTU):';
    }
}

function rebuildSelectOptions() {
    var select = document.getElementById('craft-quest-bind');
    if (!select) return;
    var html = '<option value="none">— Bez vazby (volný předmět) —</option>';
    var active = getActiveQuestsList();
    for (var i = 0; i < active.length; i++) {
        var q = active[i];
        html += '<option value="' + q.id + '">' + (q.char ? q.char + ': ' : '') + q.title + '</option>';
    }
    if (active.length === 0) {
        html += '<option value="none" disabled>(Žádné aktivní úkoly — archivované/splněné se neukazují)</option>';
    }
    select.innerHTML = html;
}

function renderQuestList() {
    try { processCommunityQuestExpiries(); } catch (e) { console.warn(e); }
    try { ensureClosedStoryPositionsApplied(); } catch (e) { console.warn(e); }
    var activeEl = document.getElementById('active-quests-list');
    var storyEl = document.getElementById('story-positions-list');
    if (activeEl) {
        var activeHtml = renderActiveOrdersContent();
        activeEl.innerHTML = activeHtml || '<p style="font-size:var(--text-sm);color:var(--faint-fg);text-align:center;">Žádné aktivní rozkazy. Vyžádej nový nebo vytvoř vlastní.</p>';
    }
    if (storyEl) {
        storyEl.innerHTML = renderStoryPositionsContent();
    }
}

function attemptStartQuest(questId) {
    processCommunityQuestExpiries();
    var q = getQuestById(questId);
    if (!q) return;

    if (isCommunityQuestType(questId) && isQuestLaunchedCommunityWide(questId)) {
        alert('Rozkaz už běží pro celou komunitu. Dojeď na místo a potvrď výkon sám — rank se zapisuje každému zvlášť.');
        renderQuestList();
        return;
    }

    if (isStoryQuestId(questId) && isQuestLaunchedCommunityWide(questId)) {
        alert('Prvotní pozice už běží pro celou komunitu. Dojeď na místo a potvrď polohu sám — rank se zapisuje každému zvlášť.');
        renderQuestList();
        return;
    }

    var personalItems = getCurrentPersonalItems();
    var missing = [];

    for (var i = 0; i < q.req.length; i++) {
        var requiredName = q.req[i];
        var found = false;
        for (var p = 0; p < personalItems.length; p++) {
            if (personalItems[p].name.toLowerCase() === requiredName.toLowerCase() && personalItems[p].locked !== true) {
                found = true;
            }
        }
        if (!found) missing.push(requiredName);
    }

    var errEl = document.getElementById('log-err-' + q.id);
    if (missing.length > 0) {
        if (errEl) {
            errEl.textContent = "LOGISTICKÉ SELHÁNÍ: V osobním batohu (Na zádech) chybí: [" + missing.join(', ') + "] — přesuň věci z inventáře komunity!";
            errEl.style.display = "block";
        }
        var btn = document.querySelector('#card-new-' + q.id + ' button');
        if (btn) { btn.style.borderColor = "var(--danger-orange)"; btn.style.color = "var(--danger-orange)"; }
        return;
    }

    if (errEl) errEl.style.display = "none";

    if (usesCommunityLaunchQuest(questId)) {
        launchCommunityQuest(questId, q);
        syncCommunityQuestsToCloud();
        if (isStoryQuestId(questId)) {
            alert('📡 Prvotní pozice spuštěna pro celou komunitu!\nKaždý musí na místě potvrdit GPS sám. Trvalý bod se na mapě objeví hned po prvním potvrzení.');
        } else {
            alert('📡 Rozkaz spuštěn pro celou komunitu!\nVšichni ho vidí — každý musí na místě potvrdit výkon sám, jinak rank nezíská.');
        }
    }

    localStorage.setItem('unlocked_story_' + q.id, 'true');
    renderQuestList();
    reloadAllMapPoints();
    syncPlayerQuestProgressToCloud();
}

function activateTargeting(char) {
    if (!canUseMapPlacement()) {
        if (isStoryQuestId(char) && isQuestLaunchedCommunityWide(char) && !isQuestRunExpired(char)) {
            completeQuestAtLocation(char);
        } else if (hasStoredQuestCoords(char)) {
            completeQuestAtLocation(char);
        } else {
            placeQuestAtGps(char);
        }
        return;
    }
    targetingMode = 'complete';
    activeTargetingQuest = char;
    switchMainTab('map-only', document.querySelectorAll('.bottom-action-bar button')[2]);
    document.getElementById('map-targeting-bar').style.display = 'block';
    updateTargetingBarUI();
    document.getElementById('btn-lock-target').onclick = function() { lockCurrentLocation(char); };
    updateMapCrosshair();
}

function lockCurrentLocation(char) {
    if (targetingMode === 'place_only') {
        lockQuestLocationOnly(char);
        return;
    }
    var q = getQuestById(char);
    if (!q) return;

    var center = getMapCenterCoords();
    if (isStoryQuestId(char)) {
        if (!isQuestLaunchedCommunityWide(char)) {
            launchCommunityQuest(char, q);
        }
        recordStoryRunCompletion(char, center.lat, center.lng);
    }
    saveQuestCoords(char, center.lat, center.lng);
    var poctaReward = finalizeQuestComplete(q);
    renderPointOnMap(char, center.lat, center.lng, q.mapLabel || q.title, q.desc);

    cancelTargeting();
    switchMainTab('tasks', document.querySelectorAll('.bottom-action-bar button')[1]);
    var msg = "📍 Cíl zaměřen (admin)! Mise zapsána do profilu. Odměna v inventáři.";
    if (poctaReward) {
        msg += '\n\n✝ Pocta: „' + poctaReward.title + '“ → inventář komunity.';
    }
    alert(msg);
}

function createNewCustomLocation() {
    var name = document.getElementById('custom-loc-name').value.trim();
    var desc = document.getElementById('custom-loc-desc').value.trim();
    var req = parseReqList(document.getElementById('custom-loc-req').value);
    var assignerKey = document.getElementById('custom-loc-assigner').value || 'ino';
    var assignerChar = getAssignerCharByKey(assignerKey);
    var posMode = document.getElementById('custom-loc-position-mode').value || 'later';
    if (!name || !desc) { alert("Vyplň pole!"); return; }

    var linkLat = null, linkLng = null;
    if (posMode === 'link') {
        var linkSel = document.getElementById('custom-loc-link-point');
        var opt = linkSel ? linkSel.options[linkSel.selectedIndex] : null;
        if (!opt || !opt.value) {
            alert('Vyber existující bod na mapě, nebo zvol jiný režim polohy.');
            return;
        }
        linkLat = parseFloat(opt.getAttribute('data-lat'));
        linkLng = parseFloat(opt.getAttribute('data-lng'));
    }

    var randId = 'custom_' + Math.floor(Math.random() * 10000);
    var customQuests = getSafeJSON('custom_quests_list');
    var newQuest = {
        id: randId,
        char: assignerChar,
        issuerKey: assignerKey,
        mapLabel: name,
        title: name,
        desc: desc,
        req: req,
        time: '2h',
        latKey: 'point_' + randId + '_lat',
        lngKey: 'point_' + randId + '_lng',
        doneKey: 'quest_done_' + randId
    };
    customQuests.push(newQuest);
    localStorage.setItem('custom_quests_list', JSON.stringify(customQuests));

    if (posMode === 'link') {
        saveQuestCoords(randId, linkLat, linkLng);
        renderPointOnMap(randId, linkLat, linkLng, name, desc);
    }

    document.getElementById('custom-loc-name').value = "";
    document.getElementById('custom-loc-desc').value = "";
    document.getElementById('custom-loc-req').value = "";
    document.getElementById('custom-loc-position-mode').value = 'later';
    onCustomLocModeChange();
    rebuildSelectOptions();
    rebuildCustomLocLinkSelect();
    renderQuestList();
    syncCommunityQuestsToCloud();

    var msg = "Operace vytvořena.\nZadavatel: " + assignerChar + " (" + (SPECIALIZATION_MAP[assignerKey] || '') + ")";
    if (req.length) msg += "\nPožadavek: " + req.join(', ');
    if (posMode === 'link') msg += "\n📍 Poloha připojena k vybranému bodu na mapě.";
    alert(msg);
}

window.requestNewRandomQuest = requestNewRandomQuest;
window.confirmRandomQuestDone = confirmRandomQuestDone;
window.resetStoryQuestPosition = resetStoryQuestPosition;
window.startStoryQuestPlacement = startStoryQuestPlacement;
window.panToStoryQuest = panToStoryQuest;
window.closeMapLayersPanel = closeMapLayersPanel;
window.openStoryPositionsPanel = openStoryPositionsPanel;
window.closeStoryPositionsPanel = closeStoryPositionsPanel;
window.openPoiEditor = openPoiEditor;
window.savePoiChanges = savePoiChanges;
window.deleteMapPoi = deleteMapPoi;
window.deleteMapPoiFromEditor = deleteMapPoiFromEditor;
window.closePoiEditor = closePoiEditor;
window.openStoryPosEditor = openStoryPosEditor;
window.saveStoryPosChanges = saveStoryPosChanges;
window.closeStoryPosEditor = closeStoryPosEditor;
window.previewStoryPosEditImage = previewStoryPosEditImage;
window.previewPoiImage = previewPoiImage;
window.previewPoiEditImage = previewPoiEditImage;
window.onCustomLocModeChange = onCustomLocModeChange;
window.openAddPoiPanel = openAddPoiPanel;
window.confirmAddMapPoi = confirmAddMapPoi;
window.closeAddPoiPanel = closeAddPoiPanel;
window.centerMapToShelter = centerMapToShelter;
window.centerMapToAllSavedPoints = centerMapToAllSavedPoints;
window.switchMapTile = switchMapTile;

function craftCustomItem() {
    craftCustomItemAsync().catch(function(err) {
        alert('Chyba při výrobě: ' + (err.message || err));
    });
}

async function craftCustomItemAsync() {
    try {
        var nameEl = document.getElementById('craft-name');
        var descEl = document.getElementById('craft-desc');
        var specEl = document.getElementById('craft-spec');
        var bindEl = document.getElementById('craft-quest-bind');
        var typeEl = document.getElementById('craft-item-type');
        if (!nameEl || !descEl || !bindEl || !typeEl) {
            alert('Chyba formuláře — obnov stránku (F5).');
            return;
        }

        var name = nameEl.value.trim();
        var desc = descEl.value.trim();
        var spec = specEl ? specEl.value.trim() : '';
        var bind = bindEl.value || 'none';
        var itemType = typeEl.value || 'talisman';

        if (!name) { alert('Zadej název předmětu!'); nameEl.focus(); return; }
        if (!desc) { alert('Zadej popis předmětu!'); descEl.focus(); return; }
        if (!spec) spec = '—';

        var imgValue = '';
        var photoCloud = false;
        if (pendingCraftPhotoFile) {
            try {
                var photoMod = await patracImport('services/dataService.js');
                imgValue = await photoMod.uploadPhoto(pendingCraftPhotoFile);
                photoCloud = !!imgValue;
            } catch (uploadErr) {
                console.warn('craftCustomItem uploadPhoto:', uploadErr);
                if (base64CraftImg) {
                    imgValue = base64CraftImg;
                } else {
                    alert('Fotku se nepodařilo nahrát do cloudu. Zkus znovu, nebo ulož předmět bez fotky.');
                    return;
                }
            }
        } else {
            imgValue = base64CraftImg || '';
        }

        var comItems = getCommunityItemsRaw().slice();
        var isTalisman = (itemType === 'talisman');
        var isLocked = (bind !== 'none' && isTalisman);

        if (itemType === 'tool' && bind !== 'none') {
            addQuestRequirement(bind, name);
        }

        var newItem = {
            id: 'item_' + Date.now(),
            name: name,
            desc: desc,
            spec: spec,
            bind: bind,
            img: imgValue,
            lore: '',
            locked: isLocked,
            itemType: itemType,
            missionCount: 0,
            issuerStats: emptyIssuerStats(),
            itemHistory: []
        };
        if (itemType !== 'tool') {
            appendItemHistory(newItem, { type: 'crafted', detail: 'Výroba v inventáři komunity' });
        }
        comItems.push(newItem);

        var comCode = localStorage.getItem('com_code') || operatorComCode || '';
        var saved = saveCommunityItemsRaw(comItems, comCode);
        if (!saved && newItem.img) {
            newItem.img = '';
            comItems[comItems.length - 1] = newItem;
            saved = saveCommunityItemsRaw(comItems, comCode);
        }
        if (!saved) {
            alert('❌ Uložení selhalo — localStorage je plný.\nZkus menší foto, smaž staré předměty, nebo NOUZOVÝ RESET.');
            comItems.pop();
            return;
        }

        nameEl.value = '';
        descEl.value = '';
        if (specEl) specEl.value = '';
        base64CraftImg = '';
        pendingCraftPhotoFile = null;
        var fileEl = document.getElementById('craft-file');
        if (fileEl) fileEl.value = '';
        bindEl.value = 'none';
        typeEl.value = 'talisman';
        updateCraftBindLabel();

        loadCustomCraftedItems();
        renderQuestList();
        rebuildSelectOptions();

        var msg = '✅ Předmět „' + name + '“ uložen do inventáře komunity.';
        if (photoCloud) msg += '\n📷 Fotka uložena v cloudu (Firebase Storage).';
        if (itemType === 'tool' && bind !== 'none') {
            msg += '\n📋 Mise vyžaduje v batohu: ' + name;
        } else if (isLocked) {
            msg += '\n🔒 Blueprint zamčen do splnění mise.';
        }
        alert(msg);
    } catch (err) {
        alert('Chyba při výrobě: ' + (err.message || err));
    }
}

function getItemRankSummaryHtml(item) {
    if (item.itemType === 'tool') {
        return '<div class="item-rank-summary">🔧 Nástroj</div>';
    }
    if (item.itemType === 'pocta') {
        var phaseLabel = item.poctaPhase === 'anchored' ? 'Ukotvená' : 'Neaktivovaná';
        return '<div class="item-rank-summary" style="color:#e8c547;">' + poctaCrossIcon('sm') + ' Pocta · ' + phaseLabel + '</div>';
    }
    var rank = getTalismanStatusDisplay(item);
    if (!rank) return '';
    return '<div class="item-rank-summary">⭐ ' + rank.label + '</div>';
}

function getItemDetailHtml(item) {
    var html = '';
    if (item.itemType === 'pocta') {
        html += '<div class="item-type-badge" style="margin-top:0;border-color:#e8c547;color:#e8c547;">' + poctaCrossIcon('sm') + ' POCTA — příběhový artefakt komunity</div>';
        html += '<div class="item-meta-info" style="color:#e8c547;">Terminálový kód: <strong style="letter-spacing:0.12em;">' + (item.poctaCode || '—') + '</strong></div>';
        html += '<div class="item-meta-info">Fáze: ' + (item.poctaPhase === 'anchored' ? 'Ukotvená na mapě' : 'Neaktivovaná — čeká na ukotvení v terénu (GPS)') + '</div>';
        if (item.lore) {
            html += '<div class="item-meta-info" style="color:var(--subtle-fg);">' + item.lore + '</div>';
        }
        return html;
    }
    if (item.spec) {
        html += '<div style="font-size:var(--text-xs); color:var(--accent-gold); margin-top:2px;">✨ ' + item.spec + '</div>';
    }
    if (item.lore) {
        html += '<div class="item-meta-info" style="color:var(--danger-orange);">☣️ ZÁpis: ' + item.lore + '</div>';
    }
    if (item.bind && item.bind !== 'none') {
        var bindLabel = getQuestBindLabel(item.bind);
        if (item.itemType === 'tool') {
            html += '<div class="item-meta-info" style="color:var(--xp-blue);">📋 Vybavení mise: ' + bindLabel + '</div>';
        } else {
            html += '<div class="item-meta-info" style="color:var(--danger-orange);">🔒 Blueprint: ' + bindLabel + '</div>';
        }
    }
    if (item.itemType !== 'tool') {
        var rank = getTalismanStatusDisplay(item);
        if (rank) {
            var stats = item.issuerStats || emptyIssuerStats();
            html += '<div class="item-meta-info">Mise talismanu: ' + (item.missionCount || 0) + '</div>';
            html += '<div class="item-meta-info spec-breakdown" style="border:none;padding:0;margin-top:2px;">' + formatIssuerStatsHtml(stats, item.missionCount) + '</div>';
        }
    } else {
        html += '<div class="item-type-badge" style="margin-top:4px;">Logistická podmínka — bez tierů</div>';
    }
    html += formatItemHistoryHtml(item);
    return html;
}

function toggleItemDetail(detailId, btnEl) {
    var panel = document.getElementById('item-detail-' + detailId);
    if (!panel) return;
    var isOpen = panel.classList.toggle('open');
    if (btnEl) {
        btnEl.classList.toggle('open', isOpen);
        btnEl.textContent = isOpen ? '▲ Skrýt detail' : '▼ Detail předmětu';
    }
}

function getItemRankHtml(item) {
    if (item.itemType === 'tool') {
        return '<div class="item-type-badge">🔧 NÁSTROJ — logistická podmínka</div>';
    }
    var rank = getTalismanStatusDisplay(item);
    if (!rank) return '';
    var stats = item.issuerStats || emptyIssuerStats();
    var html = '<div class="item-meta-info">Status: ' + rank.label + '</div>';
    html += '<div class="item-meta-info">Mise talismanu: ' + (item.missionCount || 0) + '</div>';
    html += '<div class="item-meta-info spec-breakdown" style="border:none;padding:0;margin-top:2px;">' + formatIssuerStatsHtml(stats, item.missionCount) + '</div>';
    return html;
}

function loadCustomCraftedItems() {
    var comContainer = document.getElementById('inventory-community-container');
    var persContainer = document.getElementById('inventory-personal-container');
    if (!comContainer || !persContainer) return;

    var comItems = getCommunityInventoryItems();
    var persItems = getCurrentPersonalItems();
    if (isOperatorMode && !currentlyEditingPlayerId) persItems = [];
    var showOpItemControls = isOperatorMode && currentlyEditingPlayerId && operatorEditDraft;

    function buildHtml(list, isComm) {
        var html = "";
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if (!item.issuerStats) item.issuerStats = emptyIssuerStats();
            if (item.missionCount === undefined) item.missionCount = 0;
            if (!item.itemType) item.itemType = 'talisman';

            var detailId = (isComm ? 'com' : 'pers') + '-' + i;
            var imgHtml = item.img ? '<img src="' + item.img + '">' : '📦';
            var blueprintWatermark = (item.locked && item.itemType !== 'tool') ? '<div class="blueprint-alert">PROTOTYP<br>PLÁN</div>' : '';
            if (item.itemType === 'pocta') {
                imgHtml = poctaCrossIcon('md');
                blueprintWatermark = '<div class="blueprint-alert" style="border-color:#e8c547;color:#e8c547;font-size:var(--text-xxs);">POCTA<br>NEAKT.</div>';
            }
            var rankSummary = getItemRankSummaryHtml(item);
            var detailHtml = getItemDetailHtml(item);
            var cardClick = (isOperatorMode || item.itemType === 'pocta') ? '' : ' onclick="moveItem(' + i + ', ' + isComm + ')"';

            html += '<div class="item-craft-card"' + cardClick + '>';
            html += '<div class="item-main-row">';
            html += '<div class="item-img-box">' + imgHtml + blueprintWatermark + '</div>';
            html += '<div style="flex:1;">';
            html += '<strong>' + item.name + '</strong><br>';
            html += '<span style="font-size:var(--text-sm); color:var(--subtle-fg); line-height:1.5;">' + item.desc + '</span>';
            html += '</div></div>';
            html += rankSummary;
            if (showOpItemControls && !isComm && item.itemType !== 'tool') {
                html += '<div class="operator-item-level-row" onclick="event.stopPropagation()">';
                html += 'Level/Rank: ';
                html += '<button type="button" onclick="event.stopPropagation(); operatorAdjustItemLevel(' + i + ',-1,false)">−</button>';
                html += '<span>' + (item.missionCount || 0) + '</span>';
                html += '<button type="button" onclick="event.stopPropagation(); operatorAdjustItemLevel(' + i + ',1,false)">+</button>';
                html += '</div>';
            }
            html += '<button type="button" class="btn-item-detail" onclick="event.stopPropagation(); toggleItemDetail(\'' + detailId + '\', this)">▼ Detail předmětu</button>';
            html += '<div class="item-detail-panel" id="item-detail-' + detailId + '">';
            html += detailHtml;
            html += '<div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">';
            if (item.itemType === 'pocta') {
                html += '<button class="btn-accept" style="font-size:var(--text-xxs); padding:3px 6px; border-color:var(--danger-orange); color:var(--danger-orange);" onclick="event.stopPropagation(); destroyItem(' + i + ', ' + isComm + ')">🗑️ SMAZAT POCTU</button>';
            } else {
                html += '<button class="btn-accept" style="font-size:var(--text-xxs); padding:3px 6px; border-color:var(--accent-gold); color:var(--accent-gold);" onclick="event.stopPropagation(); openLoreEditor(' + i + ', ' + isComm + ')">📝 LORE</button>';
                html += '<button class="btn-accept" style="font-size:var(--text-xxs); padding:3px 6px; border-color:var(--danger-orange); color:var(--danger-orange);" onclick="event.stopPropagation(); destroyItem(' + i + ', ' + isComm + ')">🗑️ SMAZAT</button>';
            }
            html += '</div></div></div>';
        }
        return html === "" ? '<p style="font-size:var(--text-sm); color:var(--panel-subtle); text-align:center;">Prázdno</p>' : html;
    }

    comContainer.innerHTML = buildHtml(comItems, true);
    if (isOperatorMode && !currentlyEditingPlayerId) {
        persContainer.innerHTML = '<p style="font-size:var(--text-sm); color:var(--dim-fg); text-align:center;">V režimu operátor vyber hráče v záložce Útočiště → PŘEVZÍT IDENTITU.</p>';
    } else {
        persContainer.innerHTML = buildHtml(persItems, false);
    }
    syncCurrentAccountWearLoadout();
    refreshCommunityMembersPanel();
}

function resolveCommunityItemAtDisplayIndex(index) {
    var display = getCommunityInventoryItems();
    if (index < 0 || index >= display.length) return null;
    var item = display[index];
    var raw = getCommunityItemsRaw();
    var rawIdx = findItemIndexInRawByIdentity(raw, item);
    if (rawIdx < 0) return null;
    return { raw: raw, rawIdx: rawIdx, item: raw[rawIdx] };
}

function moveItem(index, fromCommunity) {
    if (isOperatorMode) {
        alert('V režimu operátor nelze přesouvat předměty mezi inventářem komunity a hráčem.');
        return;
    }
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    var comDisplay = getCommunityInventoryItems();
    var persItems = getCurrentPersonalItems().slice();
    var comRaw = getCommunityItemsRaw().slice();

    if (fromCommunity) {
        if (index < 0 || index >= comDisplay.length) return;
        var item = comDisplay[index];
        if (item.itemType === 'pocta') {
            alert('Pocta je majetek celé komunity — zůstává ve skladu, ne v osobním batohu.');
            return;
        }
        var rawIdx = findItemIndexInRawByIdentity(comRaw, item);
        if (rawIdx === -1) return;
        comRaw.splice(rawIdx, 1);
        persItems.push(item);
    } else {
        if (index < 0 || index >= persItems.length) return;
        var itemOut = persItems.splice(index, 1)[0];
        comRaw.push(itemOut);
    }

    saveCommunityItemsRaw(comRaw, comCode);
    saveCurrentPersonalItems(persItems);
    loadCustomCraftedItems();
}

function deleteItemCloudPhotoAsync(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string' || imgUrl.indexOf('data:') === 0) return;
    patracImport('services/dataService.js').then(function(mod) {
        return mod.deleteStorageFileByUrl(imgUrl);
    }).catch(function(err) {
        console.warn('[cloud] delete item photo', err);
    });
}

function purgePoctaItem(item) {
    if (!item || item.itemType !== 'pocta') return;
    patracImport('pocta/storage.js').then(function(mod) {
        var registry = mod.loadRegistry();
        if (item.poctaCode) mod.removeEntityByCode(item.poctaCode, registry);
        mod.saveRegistry(registry);
        var userId = localStorage.getItem('patrac_session') || '';
        if (userId && item.poctaId) {
            var term = mod.loadTerminalState(userId);
            if (Array.isArray(term.poctaInventoryIds)) {
                term.poctaInventoryIds = term.poctaInventoryIds.filter(function(id) {
                    return id !== item.poctaId;
                });
                mod.saveTerminalState(userId, term);
            }
        }
    }).catch(function(err) {
        console.warn('[pocta] purge', err);
    });
}

function destroyItem(index, isComm) {
    if (isComm) {
        var resolved = resolveCommunityItemAtDisplayIndex(index);
        if (resolved && resolved.item.itemType === 'pocta') {
            if (!confirm('Odstranit Poctu „' + (resolved.item.name || 'Pocta') + '“ z inventáře komunity? Související záznam zmizí i z registry.')) return;
            purgePoctaItem(resolved.item);
            var raw = getCommunityItemsRaw().slice();
            raw.splice(resolved.rawIdx, 1);
            saveCommunityItemsRaw(raw);
            loadCustomCraftedItems();
            if (typeof window.patracPoctaReloadMap === 'function') window.patracPoctaReloadMap();
            return;
        }
    }
    var confirmMsg = isComm ? 'Zničit věc z inventáře komunity?' : 'Zničit věc z batohu?';
    if (confirm(confirmMsg)) {
        if (isComm) {
            var resolved = resolveCommunityItemAtDisplayIndex(index);
            if (!resolved) return;
            deleteItemCloudPhotoAsync(resolved.item.img);
            var raw = getCommunityItemsRaw().slice();
            raw.splice(resolved.rawIdx, 1);
            saveCommunityItemsRaw(raw);
        } else {
            var list = getCurrentPersonalItems().slice();
            if (list[index]) deleteItemCloudPhotoAsync(list[index].img);
            list.splice(index, 1);
            saveCurrentPersonalItems(list);
        }
        loadCustomCraftedItems();
    }
}

var globalEditIsComm = true;
function openLoreEditor(index, isComm) {
    globalEditIsComm = isComm;
    var item;
    if (isComm) {
        var resolved = resolveCommunityItemAtDisplayIndex(index);
        if (!resolved) return;
        item = resolved.item;
    } else {
        var list = getCurrentPersonalItems();
        item = list[index];
        if (!item) return;
    }

    document.getElementById('edit-item-index').value = index;
    document.getElementById('edit-item-lore').value = item.lore || "";
    base64EditImg = item.img || "";
    document.getElementById('lore-edit-box').style.display = "block";
}

function closeLoreEditor() { document.getElementById('lore-edit-box').style.display = "none"; }

function saveItemLoreChanges() {
    var index = parseInt(document.getElementById('edit-item-index').value, 10);
    var loreText = document.getElementById('edit-item-lore').value.trim();

    if (globalEditIsComm) {
        var resolved = resolveCommunityItemAtDisplayIndex(index);
        if (!resolved) return;
        var raw = getCommunityItemsRaw().slice();
        raw[resolved.rawIdx].lore = loreText;
        if (base64EditImg) raw[resolved.rawIdx].img = base64EditImg;
        appendItemHistory(raw[resolved.rawIdx], { type: 'lore', detail: 'Úprava záznamu komunity' });
        saveCommunityItemsRaw(raw);
    } else {
        var list = getCurrentPersonalItems().slice();
        if (!list[index]) return;
        list[index].lore = loreText;
        if (base64EditImg) list[index].img = base64EditImg;
        appendItemHistory(list[index], { type: 'lore', detail: 'Úprava záznamu komunity' });
        saveCurrentPersonalItems(list);
    }
    closeLoreEditor();
    loadCustomCraftedItems();
}


function renderChat() { /* legacy — viz radioUi */ }

function updateRadioDisplayHud() {
    if (typeof window.patracRefreshRadioComms === 'function') window.patracRefreshRadioComms();
}

function initQuestAdminAsync() {
    patracImport('quests/questAdminUi.js').then(function(mod) {
        mod.initQuestAdminUi();
        window.patracRefreshQuestAdmin = mod.refreshQuestAdminUi;
        window.patracGetQuestDefinitions = mod.getQuestDefinitions;
    }).catch(function(err) {
        console.warn('[questAdmin]', err);
    });
}

function initRadioCommsAsync() {
    patracImport('radio/radioUi.js').then(function(mod) {
        mod.initRadioCommsSystem({
            getUserId: function() { return localStorage.getItem('patrac_session') || ''; },
            getPlayerName: function() { return localStorage.getItem('player_name') || 'Operativec'; },
            getComCode: function() { return localStorage.getItem('com_code') || operatorComCode || ''; },
            getComName: function() { return localStorage.getItem('com_name') || ''; },
            getCommunityRadioKey: function() {
                var code = localStorage.getItem('com_code') || operatorComCode || '';
                var name = localStorage.getItem('com_name') || '';
                try {
                    var stored = localStorage.getItem('patrac_com_radio_key_' + code);
                    if (stored) return stored;
                } catch (e) {}
                return null;
            },
            getShelterLatLng: function() {
                var lat = parseFloat(localStorage.getItem('point_roxy_lat'));
                var lng = parseFloat(localStorage.getItem('point_roxy_lng'));
                if (!isFinite(lat) || !isFinite(lng)) return null;
                return { lat: lat, lng: lng };
            },
            getPlayerLatLng: function() {
                if (typeof lastUserPosition !== 'undefined' && lastUserPosition &&
                    isFinite(lastUserPosition.lat) && isFinite(lastUserPosition.lng)) {
                    return { lat: lastUserPosition.lat, lng: lastUserPosition.lng };
                }
                return null;
            },
            isLocalOnly: function() { return isOperatorLocalOnlySession(); }
        });
        window.patracRefreshRadioComms = mod.refreshRadioCommsContext;
        window.patracStopRadioComms = mod.stopRadioComms;
    }).catch(function(err) {
        console.error('initRadioComms', err);
    });
}

function sendChatMessage() {
    var input = document.getElementById('chat-input-field');
    if (input && input.value.trim()) {
        var ent = document.getElementById('radio-key-ent');
        if (ent) ent.click();
    }
}

window.craftCustomItem = craftCustomItem;
window.createNewCustomLocation = createNewCustomLocation;
window.moveItem = moveItem;
window.dismissQuest = dismissQuest;
window.toggleQuestSection = toggleQuestSection;
window.toggleItemDetail = toggleItemDetail;
window.patracLogin = patracLogin;
window.switchGatePage = switchGatePage;
window.patracRecoverPassword = patracRecoverPassword;
window.onRegComModeChange = onRegComModeChange;
window.saveProfileAndLaunch = saveProfileAndLaunch;
window.toggleProfileEditPanel = toggleProfileEditPanel;
window.saveProfileEdits = saveProfileEdits;
window.transferCommunityAdmin = transferCommunityAdmin;
window.previewProfileEditAvatar = previewProfileEditAvatar;
window.toggleCraftSection = toggleCraftSection;
window.toggleHudMenu = toggleHudMenu;
window.patracLogout = patracLogout;
window.patracOperatorLogin = patracOperatorLogin;
window.populateOperatorCommunitySelect = populateOperatorCommunitySelect;
window.onOperatorCommunitySelectChange = onOperatorCommunitySelectChange;
window.onOperatorCommunityCodeInput = onOperatorCommunityCodeInput;
window.enterOperatorEditPlayer = enterOperatorEditPlayer;
window.saveOperatorEdits = saveOperatorEdits;
window.patracExitOperator = patracExitOperator;
window.patracExitOperatorKeepIdentity = patracExitOperatorKeepIdentity;
window.toggleOperatorMission = toggleOperatorMission;
window.adjustOperatorSpec = adjustOperatorSpec;
window.operatorAdjustItemLevel = operatorAdjustItemLevel;
window.operatorAddBotOperative = operatorAddBotOperative;
window.operatorRemoveBotOperative = operatorRemoveBotOperative;
window.attemptStartQuest = attemptStartQuest;

window.patracSetLanguage = function(code) {
    patracImport('components/gate-i18n.js').then(function(mod) {
        mod.switchGateLanguage(code).then(function() {
            patracImport('apply-i18n.js').then(function(app) {
                app.applyPatracI18n();
            });
        });
    });
};

window.patracSetTextSize = function(size) {
    patracImport('settings.js').then(function(mod) {
        mod.setPatracTextSize(size);
    });
};

window.patracSetCompassVisible = function(visible) {
    patracImport('settings.js').then(function(mod) {
        mod.setPatracCompassVisible(visible);
    });
};

window.patracSetDisplayMode = function(mode) {
    patracImport('settings.js').then(function(mod) {
        mod.setPatracDisplayMode(mode);
    });
};

window.patracSetBrowserFullscreen = function(on) {
    patracImport('settings.js').then(function(mod) {
        mod.setBrowserFullscreen(on);
    });
};

window.placeQuestAtGps = placeQuestAtGps;
window.completeQuestAtLocation = completeQuestAtLocation;

window.renderQuestList = renderQuestList;

function openPhotoLightbox(src, caption) {
    if (!src) return;
    var overlay = document.getElementById('photo-lightbox');
    if (!overlay) return;
    var img = overlay.querySelector('.photo-lightbox-img');
    var cap = overlay.querySelector('.photo-lightbox-caption');
    if (img) {
        img.src = src;
        img.alt = caption || 'Fotografie';
    }
    if (cap) {
        cap.textContent = caption || '';
        cap.style.display = caption ? 'block' : 'none';
    }
    overlay.hidden = false;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closePhotoLightbox() {
    var overlay = document.getElementById('photo-lightbox');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.hidden = true;
    var img = overlay.querySelector('.photo-lightbox-img');
    if (img) img.src = '';
    document.body.style.overflow = '';
}

function isPhotoLightboxTarget(img) {
    if (!img || img.tagName !== 'IMG' || !img.src) return false;
    if (img.closest('.photo-lightbox-overlay')) return false;
    return !!(
        img.classList.contains('poi-popup-img') ||
        img.closest('.item-img-box') ||
        img.closest('.avatar-box') ||
        img.closest('.poi-preview-box') ||
        img.closest('.pocta-chronicle-thumb-wrap')
    );
}

function initPhotoLightbox() {
    if (document.body._photoLightboxBound) return;
    document.body._photoLightboxBound = true;

    document.addEventListener('click', function(e) {
        if (!isPhotoLightboxTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        var img = e.target;
        openPhotoLightbox(img.src, img.alt || img.title || '');
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closePhotoLightbox();
    });

    var overlay = document.getElementById('photo-lightbox');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay || e.target.classList.contains('photo-lightbox-close')) {
                closePhotoLightbox();
            }
        });
    }
}

window.openPhotoLightbox = openPhotoLightbox;
window.closePhotoLightbox = closePhotoLightbox;

window.onload = async function() {
    initPhotoLightbox();
    showPatracBuildLabel();
    if (window.__patracI18nBoot) await window.__patracI18nBoot;
    try { migratePatracAccountsStorage(); } catch (e) { console.warn('migratePatracAccountsStorage', e); }
    initGateOperatorTrigger();
    migrateLegacyPatracAccount();
    try {
        if (sessionStorage.getItem('patrac_after_local_reset') === '1') {
            sessionStorage.removeItem('patrac_after_local_reset');
            showGateError('gate-login-error',
                'Lokální data smazána. Pro nový start zaregistruj NOVÉ ID operativce. Starý účet ve Firebase zůstává — obnoví se přihlášením.');
        }
    } catch (e) {}
    var session = localStorage.getItem('patrac_session');
    if (session && getPatracAccounts()[session]) {
        try {
            var authMod = await importAuthService();
            await authMod.restorePatracSessionFromLocal(session);
        } catch (restoreErr) {
            console.warn('[auth] session restore on load', restoreErr);
        }
        beginSessionForUser(session, { profileData: getUserProfileData(session) });
        launchGame();
    }
};
