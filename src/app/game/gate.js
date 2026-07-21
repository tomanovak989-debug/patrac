/* PATRAC: login gate and operator entry */
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
        : 'ÔÇö vyber komunitu (n├ízev + k├│d) ÔÇö';
    var html = '<option value="">' + placeholder + '</option>';
    if (list.length === 0) {
        html += '<option value="" disabled>(Zat├şm ┼ż├ídn├í komunita ÔÇö zadej k├│d ru─Źn─Ť)</option>';
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
            : 'ÔÇö na─Ź├şt├ím komunityÔÇŽ ÔÇö';
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
        el.textContent = (name ? name + ' ┬Ě ' : '') + session;
    } else {
        el.textContent = 'M├şstn├ş relace (bez ├║─Źtu)';
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
    clearGlobalSessionGameCache();
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
        return 'Do pole U┼żivatelsk├ę ID ned├ívej e-mail ÔÇö zadej ID operativce (nap┼Ö. mvit).';
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

/** Sma┼że glob├íln├ş hern├ş cache ÔÇö p┼Öed p┼Öepnut├şm ├║─Źtu/komunity. */
function clearGlobalSessionGameCache() {
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (key.indexOf('quest_done_') === 0 ||
            key.indexOf('unlocked_story_') === 0 ||
            key.indexOf('point_') === 0 ||
            key.indexOf('story_pos_note_') === 0 ||
            key.indexOf('story_pos_img_') === 0) {
            keysToRemove.push(key);
        }
    }
    for (var r = 0; r < keysToRemove.length; r++) {
        try { localStorage.removeItem(keysToRemove[r]); } catch (e) {}
    }
    safeLocalStorageSet('items_community', '[]');
    safeLocalStorageSet('map_free_pois', '[]');
    safeLocalStorageSet('custom_quests_list', '[]');
    safeLocalStorageSet('random_quests_list', '[]');
    safeLocalStorageSet('dismissed_quests', '[]');
    safeLocalStorageSet('quest_req_overrides', '{}');
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
        updatedAt: Date.now()
    };
}

