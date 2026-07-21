/* PATRAC: launch, tabs, craft, boot */
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
                        'Firebase p┼Öihl├í┼íen├ş OK, ale profil v s├şti chyb├ş. Zkus obnovu hesla, nebo se registruj znovu.');
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
    var loginBtnLabel = loginBtn ? loginBtn.textContent : 'DE┼áIFROVAT A VSTOUPIT';
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'P┼śIPOJOV├üN├ŹÔÇŽ'; }

    var localAcc = resolveLocalPatracAccount(userId);

    withPatracTimeout(
        importAuthService().then(function(authMod) {
            return authMod.signInPatracAuth(userId, pass, localAcc);
        }).then(function() {
            return bootstrapAfterAuth(localAcc);
        }),
        45000,
        'P┼Öipojen├ş trv├í p┼Ö├şli┼í dlouho ÔÇö zkontroluj internet, vypni VPN/adblock, nebo obnov str├ínku (Ctrl+F5).'
    ).catch(function(err) {
        console.warn('[auth] login', err);
        var msg = (err && err.message) || '';
        if ((err && err.code === 'auth/wrong-password') || msg.indexOf('┼ápatn├ę heslo') !== -1) {
            showGateError('gate-login-error', 'gate.errors.loginBadPass');
        } else if (err && err.code === 'auth/weak-password') {
            showGateError('gate-login-error', msg);
        } else if (err && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
            showGateError('gate-login-error', 'gate.errors.loginBadPass');
        } else if (err && err.code === 'auth/network-request-failed') {
            showGateError('gate-login-error', 'CHYBA: S├ş┼ą neodpov├şd├í ÔÇö zkontroluj p┼Öipojen├ş.');
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
        if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
        return;
    }
    if (pass !== pass2) {
        showGateError('gate-register-error', 'gate.errors.registerPassMismatch');
        if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
        return;
    }
    if (!playerName) {
        showGateError('gate-register-error', 'gate.errors.registerMissingName');
        return;
    }

    if (submitBtnStart) { submitBtnStart.disabled = true; submitBtnStart.textContent = 'ZPRACOV├üV├üMÔÇŽ'; }

    var comName = '';
    var comCode = '';
    if (comMode === 'create') {
        comName = document.getElementById('input-com-name').value.trim();
        if (!comName) {
            showGateError('gate-register-error', 'gate.errors.registerMissingComName');
            if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
            return;
        }
        continueRegisterAfterCommunityCheck(comName, comCode, comMode, userId, email, pass, playerName);
    } else {
        comCode = (document.getElementById('input-com-code').value || '').trim().toUpperCase();
        if (comCode.length !== 5) {
            showGateError('gate-register-error', 'gate.errors.registerBadComCode');
            if (submitBtnStart) { submitBtnStart.disabled = false; submitBtnStart.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
            return;
        }
        var submitBtnEarly = submitBtnStart;
        if (submitBtnEarly) { submitBtnEarly.disabled = true; submitBtnEarly.textContent = 'OV─Ü┼śUJI KOMUNITUÔÇŽ'; }
        findCommunityByCodeWithCloud(comCode).then(function(existingComm) {
            if (!existingComm) {
                showGateError('gate-register-error', 'gate.errors.registerUnknownCom');
                if (submitBtnEarly) { submitBtnEarly.disabled = false; submitBtnEarly.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
                return;
            }
            continueRegisterAfterCommunityCheck(existingComm.name, comCode, comMode, userId, email, pass, playerName);
        }).catch(function() {
            showGateError('gate-register-error', 'gate.errors.registerUnknownCom');
            if (submitBtnEarly) { submitBtnEarly.disabled = false; submitBtnEarly.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
        });
    }
    } catch (err) {
        console.error('saveProfileAndLaunch', err);
        showGateError('gate-register-error', 'gate.errors.registerFailed', { msg: err.message || err });
        var btn = document.getElementById('btn-register-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
    }
}

function registerSubmitFail(msgOrKey, opts) {
    showGateError('gate-register-error', msgOrKey, opts);
    var btn = document.getElementById('btn-register-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
}

function continueRegisterAfterCommunityCheck(comName, comCode, comMode, userId, email, pass, playerName) {
    var submitBtn = document.getElementById('btn-register-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'OV─Ü┼śUJI IDÔÇŽ'; }

    patracImport('services/accountService.js').then(function(mod) {
        return mod.fetchAccountFromCloud(userId);
    }).then(function(cloudAcc) {
        if (cloudAcc) {
            showGateError('gate-register-error',
                'ID ÔÇ×' + userId + 'ÔÇť u┼ż existuje v cloudu. P┼Öihlas se, nebo zvol jin├ę ID operativce.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
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

    var msg = 'Registrace dokon─Źena.\n\nK├│d operativce: ' + playerCode;
    if (comMode === 'create') {
        msg += '\nK├│d komunity: ' + comCode + '\n(Sd├şlej ho s dal┼í├şmi p├ítra─Źi pro p┼Öipojen├ş.)';
    } else {
        msg += '\nP┼Öipojeno ke komunit─Ť: ' + comName + ' [' + comCode + ']';
    }
    if (base64Avatar && !avatarSaved) {
        msg += '\n\n(Pozn├ímka: avatar se neve┼íel do ├║lo┼żi┼ít─Ť ÔÇö ├║─Źet funguje bez fotky.)';
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
    if (submitBtn) submitBtn.textContent = 'ZPRACOV├üV├üMÔÇŽ';
    return importAuthService().then(function(authMod) {
        return authMod.registerPatracAuth(userId, pass, email);
    }).then(function() {
        return completeRegisterAfterAuth(comName, comCode, comMode, userId, email, pass, playerName);
    }).catch(function(err) {
        console.warn('[auth] register', err);
        var errMsg = err.message || 'Registrace selhala.';
        if (err && err.code === 'auth/email-already-in-use') {
            errMsg = 'E-mail je ve Firebase obsazen├Ż ÔÇö sma┼ż ho v Authentication, nebo pou┼żij jin├Ż.';
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
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'OV─Ü┼śUJI EMAILÔÇŽ'; }

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
        titleEl.textContent = 'Ukotvit polohu ├║kolu ÔÇö posu┼ł mapu do k┼Ö├ş┼że';
        btn.textContent = '­čôŹ ULO┼ŻIT POLOHU (bez spln─Ťn├ş mise)';
    } else {
        titleEl.textContent = 'Taktick├Ż re┼żim: Posu┼łte c├şl do k┼Ö├ş┼że';
        btn.textContent = '­čôŹ POTVRDIT LOKACI (ST┼śED MAPY)';
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
    alert('­čôŹ Poloha ÔÇ×' + getQuestMapLabel(q) + 'ÔÇť ulo┼żena. Misi spln├ş┼í po fyzick├ęm v├Żkonu a potvrzen├ş v rozkazech.');
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
        lbl.textContent = 'NAV├üZAT NA ├ÜKOL (PO┼ŻADOVAN├ë VYBAVEN├Ź):';
    } else {
        lbl.textContent = 'NAV├üZAT NA ├ÜKOL (Z├üM─ÜK DO BLUEPRINTU):';
    }
}

function rebuildSelectOptions() {
    var select = document.getElementById('craft-quest-bind');
    if (!select) return;
    var html = '<option value="none">ÔÇö Bez vazby (voln├Ż p┼Öedm─Ťt) ÔÇö</option>';
    var active = getActiveQuestsList();
    for (var i = 0; i < active.length; i++) {
        var q = active[i];
        html += '<option value="' + q.id + '">' + (q.char ? q.char + ': ' : '') + q.title + '</option>';
    }
    if (active.length === 0) {
        html += '<option value="none" disabled>(┼Ż├ídn├ę aktivn├ş ├║koly ÔÇö archivovan├ę/spln─Ťn├ę se neukazuj├ş)</option>';
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
        activeEl.innerHTML = activeHtml || '<p style="font-size:var(--text-sm);color:var(--faint-fg);text-align:center;">┼Ż├ídn├ę aktivn├ş rozkazy. Vy┼ż├ídej nov├Ż nebo vytvo┼Ö vlastn├ş.</p>';
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
        alert('Rozkaz u┼ż b─Ť┼ż├ş pro celou komunitu. Doje─Ć na m├şsto a potvr─Ć v├Żkon s├ím ÔÇö rank se zapisuje ka┼żd├ęmu zvl├í┼í┼ą.');
        renderQuestList();
        return;
    }

    if (isStoryQuestId(questId) && isQuestLaunchedCommunityWide(questId)) {
        alert('Prvotn├ş pozice u┼ż b─Ť┼ż├ş pro celou komunitu. Doje─Ć na m├şsto a potvr─Ć polohu s├ím ÔÇö rank se zapisuje ka┼żd├ęmu zvl├í┼í┼ą.');
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
            errEl.textContent = "LOGISTICK├ë SELH├üN├Ź: V osobn├şm batohu (Na z├ídech) chyb├ş: [" + missing.join(', ') + "] ÔÇö p┼Öesu┼ł v─Ťci z invent├í┼Öe komunity!";
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
            alert('­čôí Prvotn├ş pozice spu┼ít─Ťna pro celou komunitu!\nKa┼żd├Ż mus├ş na m├şst─Ť potvrdit GPS s├ím. Trval├Ż bod se na map─Ť objev├ş hned po prvn├şm potvrzen├ş.');
        } else {
            alert('­čôí Rozkaz spu┼ít─Ťn pro celou komunitu!\nV┼íichni ho vid├ş ÔÇö ka┼żd├Ż mus├ş na m├şst─Ť potvrdit v├Żkon s├ím, jinak rank nez├şsk├í.');
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
    var msg = "­čôŹ C├şl zam─Ť┼Öen (admin)! Mise zaps├ína do profilu. Odm─Ťna v invent├í┼Öi.";
    if (poctaReward) {
        msg += '\n\nÔťŁ Pocta: ÔÇ×' + poctaReward.title + 'ÔÇť Ôćĺ invent├í┼Ö komunity.';
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
    if (!name || !desc) { alert("Vypl┼ł pole!"); return; }

    var linkLat = null, linkLng = null;
    if (posMode === 'link') {
        var linkSel = document.getElementById('custom-loc-link-point');
        var opt = linkSel ? linkSel.options[linkSel.selectedIndex] : null;
        if (!opt || !opt.value) {
            alert('Vyber existuj├şc├ş bod na map─Ť, nebo zvol jin├Ż re┼żim polohy.');
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

    var msg = "Operace vytvo┼Öena.\nZadavatel: " + assignerChar + " (" + (SPECIALIZATION_MAP[assignerKey] || '') + ")";
    if (req.length) msg += "\nPo┼żadavek: " + req.join(', ');
    if (posMode === 'link') msg += "\n­čôŹ Poloha p┼Öipojena k vybran├ęmu bodu na map─Ť.";
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
        alert('Chyba p┼Öi v├Żrob─Ť: ' + (err.message || err));
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
            alert('Chyba formul├í┼Öe ÔÇö obnov str├ínku (F5).');
            return;
        }

        var name = nameEl.value.trim();
        var desc = descEl.value.trim();
        var spec = specEl ? specEl.value.trim() : '';
        var bind = bindEl.value || 'none';
        var itemType = typeEl.value || 'talisman';

        if (!name) { alert('Zadej n├ízev p┼Öedm─Ťtu!'); nameEl.focus(); return; }
        if (!desc) { alert('Zadej popis p┼Öedm─Ťtu!'); descEl.focus(); return; }
        if (!spec) spec = 'ÔÇö';

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
                    alert('Fotku se nepoda┼Öilo nahr├ít do cloudu. Zkus znovu, nebo ulo┼ż p┼Öedm─Ťt bez fotky.');
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
            appendItemHistory(newItem, { type: 'crafted', detail: 'V├Żroba v invent├í┼Öi komunity' });
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
            alert('ÔŁî Ulo┼żen├ş selhalo ÔÇö localStorage je pln├Ż.\nZkus men┼í├ş foto, sma┼ż star├ę p┼Öedm─Ťty, nebo NOUZOV├Ł RESET.');
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

        var msg = 'Ôťů P┼Öedm─Ťt ÔÇ×' + name + 'ÔÇť ulo┼żen do invent├í┼Öe komunity.';
        if (photoCloud) msg += '\n­čôĚ Fotka ulo┼żena v cloudu (Firebase Storage).';
        if (itemType === 'tool' && bind !== 'none') {
            msg += '\n­čôő Mise vy┼żaduje v batohu: ' + name;
        } else if (isLocked) {
            msg += '\n­čöĺ Blueprint zam─Źen do spln─Ťn├ş mise.';
        }
        alert(msg);
    } catch (err) {
        alert('Chyba p┼Öi v├Żrob─Ť: ' + (err.message || err));
    }
}

function getItemRankSummaryHtml(item) {
    if (item.itemType === 'tool') {
        return '<div class="item-rank-summary">­čöž N├ístroj</div>';
    }
    if (item.itemType === 'pocta') {
        var phaseLabel = item.poctaPhase === 'anchored' ? 'Ukotven├í' : 'Neaktivovan├í';
        return '<div class="item-rank-summary" style="color:#e8c547;">' + poctaCrossIcon('sm') + ' Pocta ┬Ě ' + phaseLabel + '</div>';
    }
    var rank = getTalismanStatusDisplay(item);
    if (!rank) return '';
    return '<div class="item-rank-summary">ÔşÉ ' + rank.label + '</div>';
}

function getItemDetailHtml(item) {
    var html = '';
    if (item.itemType === 'pocta') {
        html += '<div class="item-type-badge" style="margin-top:0;border-color:#e8c547;color:#e8c547;">' + poctaCrossIcon('sm') + ' POCTA ÔÇö p┼Ö├şb─Ťhov├Ż artefakt komunity</div>';
        html += '<div class="item-meta-info" style="color:#e8c547;">Termin├ílov├Ż k├│d: <strong style="letter-spacing:0.12em;">' + (item.poctaCode || 'ÔÇö') + '</strong></div>';
        html += '<div class="item-meta-info">F├íze: ' + (item.poctaPhase === 'anchored' ? 'Ukotven├í na map─Ť' : 'Neaktivovan├í ÔÇö ─Źek├í na ukotven├ş v ter├ęnu (GPS)') + '</div>';
        if (item.lore) {
            html += '<div class="item-meta-info" style="color:var(--subtle-fg);">' + item.lore + '</div>';
        }
        return html;
    }
    if (item.spec) {
        html += '<div style="font-size:var(--text-xs); color:var(--accent-gold); margin-top:2px;">ÔťĘ ' + item.spec + '</div>';
    }
    if (item.lore) {
        html += '<div class="item-meta-info" style="color:var(--danger-orange);">Ôśú´ŞĆ Z├üpis: ' + item.lore + '</div>';
    }
    if (item.bind && item.bind !== 'none') {
        var bindLabel = getQuestBindLabel(item.bind);
        if (item.itemType === 'tool') {
            html += '<div class="item-meta-info" style="color:var(--xp-blue);">­čôő Vybaven├ş mise: ' + bindLabel + '</div>';
        } else {
            html += '<div class="item-meta-info" style="color:var(--danger-orange);">­čöĺ Blueprint: ' + bindLabel + '</div>';
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
        html += '<div class="item-type-badge" style="margin-top:4px;">Logistick├í podm├şnka ÔÇö bez tier┼»</div>';
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
        btnEl.textContent = isOpen ? 'Ôľ▓ Skr├Żt detail' : 'Ôľ╝ Detail p┼Öedm─Ťtu';
    }
}

function getItemRankHtml(item) {
    if (item.itemType === 'tool') {
        return '<div class="item-type-badge">­čöž N├üSTROJ ÔÇö logistick├í podm├şnka</div>';
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
            var imgHtml = item.img ? '<img src="' + item.img + '">' : '­čôŽ';
            var blueprintWatermark = (item.locked && item.itemType !== 'tool') ? '<div class="blueprint-alert">PROTOTYP<br>PL├üN</div>' : '';
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
                html += '<button type="button" onclick="event.stopPropagation(); operatorAdjustItemLevel(' + i + ',-1,false)">Ôłĺ</button>';
                html += '<span>' + (item.missionCount || 0) + '</span>';
                html += '<button type="button" onclick="event.stopPropagation(); operatorAdjustItemLevel(' + i + ',1,false)">+</button>';
                html += '</div>';
            }
            html += '<button type="button" class="btn-item-detail" onclick="event.stopPropagation(); toggleItemDetail(\'' + detailId + '\', this)">Ôľ╝ Detail p┼Öedm─Ťtu</button>';
            html += '<div class="item-detail-panel" id="item-detail-' + detailId + '">';
            html += detailHtml;
            html += '<div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">';
            if (item.itemType === 'pocta') {
                html += '<button class="btn-accept" style="font-size:var(--text-xxs); padding:3px 6px; border-color:var(--danger-orange); color:var(--danger-orange);" onclick="event.stopPropagation(); destroyItem(' + i + ', ' + isComm + ')">­čŚĹ´ŞĆ SMAZAT POCTU</button>';
            } else {
                html += '<button class="btn-accept" style="font-size:var(--text-xxs); padding:3px 6px; border-color:var(--accent-gold); color:var(--accent-gold);" onclick="event.stopPropagation(); openLoreEditor(' + i + ', ' + isComm + ')">­čôŁ LORE</button>';
                html += '<button class="btn-accept" style="font-size:var(--text-xxs); padding:3px 6px; border-color:var(--danger-orange); color:var(--danger-orange);" onclick="event.stopPropagation(); destroyItem(' + i + ', ' + isComm + ')">­čŚĹ´ŞĆ SMAZAT</button>';
            }
            html += '</div></div></div>';
        }
        return html === "" ? '<p style="font-size:var(--text-sm); color:var(--panel-subtle); text-align:center;">Pr├ízdno</p>' : html;
    }

    comContainer.innerHTML = buildHtml(comItems, true);
    if (isOperatorMode && !currentlyEditingPlayerId) {
        persContainer.innerHTML = '<p style="font-size:var(--text-sm); color:var(--dim-fg); text-align:center;">V re┼żimu oper├ítor vyber hr├í─Źe v z├ílo┼żce ├Üto─Źi┼ít─Ť Ôćĺ P┼śEVZ├ŹT IDENTITU.</p>';
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
        alert('V re┼żimu oper├ítor nelze p┼Öesouvat p┼Öedm─Ťty mezi invent├í┼Öem komunity a hr├í─Źem.');
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
            alert('Pocta je majetek cel├ę komunity ÔÇö z┼»st├ív├í ve skladu, ne v osobn├şm batohu.');
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
            if (!confirm('Odstranit Poctu ÔÇ×' + (resolved.item.name || 'Pocta') + 'ÔÇť z invent├í┼Öe komunity? Souvisej├şc├ş z├íznam zmiz├ş i z registry.')) return;
            purgePoctaItem(resolved.item);
            var raw = getCommunityItemsRaw().slice();
            raw.splice(resolved.rawIdx, 1);
            saveCommunityItemsRaw(raw);
            loadCustomCraftedItems();
            if (typeof window.patracPoctaReloadMap === 'function') window.patracPoctaReloadMap();
            return;
        }
    }
    var confirmMsg = isComm ? 'Zni─Źit v─Ťc z invent├í┼Öe komunity?' : 'Zni─Źit v─Ťc z batohu?';
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
        appendItemHistory(raw[resolved.rawIdx], { type: 'lore', detail: '├Üprava z├íznamu komunity' });
        saveCommunityItemsRaw(raw);
    } else {
        var list = getCurrentPersonalItems().slice();
        if (!list[index]) return;
        list[index].lore = loreText;
        if (base64EditImg) list[index].img = base64EditImg;
        appendItemHistory(list[index], { type: 'lore', detail: '├Üprava z├íznamu komunity' });
        saveCurrentPersonalItems(list);
    }
    closeLoreEditor();
    loadCustomCraftedItems();
}


function renderChat() { /* legacy ÔÇö viz radioUi */ }

function updateRadioDisplayHud() {
    if (typeof window.patracRefreshRadioComms === 'function') window.patracRefreshRadioComms();
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
                'Lok├íln├ş data smaz├ína. Pro nov├Ż start zaregistruj NOV├ë ID operativce. Star├Ż ├║─Źet ve Firebase z┼»st├ív├í ÔÇö obnov├ş se p┼Öihl├í┼íen├şm.');
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
