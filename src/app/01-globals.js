/* PATRAC app chunk: 01-globals.js — do not reorder script tags in index.html */
var map = null, userMarker = null;
var PATRAC_BUILD = '20260722e31';
window.PATRAC_BUILD = PATRAC_BUILD;

/** Dynamický import ES modulů — absolutní cesta od kořene webu (skript běží z /src/app/, proto ne relativní!), s cache-bustem. */
function patracImport(modulePath) {
    return import('/src/' + modulePath + '?v=' + PATRAC_BUILD);
}
window.patracImport = patracImport;

function importAuthService() {
    return patracImport('services/authService.js');
}
var base64Avatar = "", base64CraftImg = "", base64EditImg = "", base64PoiImg = "", base64PoiEditImg = "", base64StoryPosEditImg = "";
var pendingCraftPhotoFile = null;
var storyPosEditHadImg = false;
var activeTargetingQuest = null;
var targetingMode = 'complete';
var baseTileLayer = null;
var mapPointsLayer = null;
var mapMeasureLayer = null;
var mapCompassLayer = null;
var mapRouteLayer = null;
var fogOfWarMod = null;

var topoRulerMod = null;

function patracRefreshFogOfWar() {
    if (fogOfWarMod && fogOfWarMod.refreshFogOfWar) fogOfWarMod.refreshFogOfWar();
}

function collectFogRevealAnchors() {
    var anchors = [];
    function push(lat, lng) {
        if (lat == null || lng == null || !isFinite(lat) || !isFinite(lng)) return;
        anchors.push({ lat: lat, lng: lng });
    }

    var storyIds = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    var i;
    for (i = 0; i < storyIds.length; i++) {
        var sid = storyIds[i];
        var latS = parseFloat(localStorage.getItem('point_' + sid + '_lat'));
        var lngS = parseFloat(localStorage.getItem('point_' + sid + '_lng'));
        if (!isNaN(latS) && !isNaN(lngS)) push(latS, lngS);
    }

    var customQuests = getSafeJSON('custom_quests_list');
    for (i = 0; i < customQuests.length; i++) {
        var cq = customQuests[i];
        var latC = parseFloat(localStorage.getItem('point_' + cq.id + '_lat'));
        var lngC = parseFloat(localStorage.getItem('point_' + cq.id + '_lng'));
        if (!isNaN(latC) && !isNaN(lngC)) push(latC, lngC);
    }

    var randomQuests = getRandomQuestsList();
    for (i = 0; i < randomQuests.length; i++) {
        var rnd = randomQuests[i];
        var latR = parseFloat(localStorage.getItem('point_' + rnd.id + '_lat'));
        var lngR = parseFloat(localStorage.getItem('point_' + rnd.id + '_lng'));
        if (!isNaN(latR) && !isNaN(lngR)) push(latR, lngR);
    }

    var pois = getSafeJSON('map_free_pois');
    for (i = 0; i < pois.length; i++) {
        if (pois[i]) push(parseFloat(pois[i].lat), parseFloat(pois[i].lng));
    }

    try {
        var reg = JSON.parse(localStorage.getItem('patrac_pocta_registry') || '{}');
        if (reg && reg.entities) {
            for (var code in reg.entities) {
                if (!reg.entities.hasOwnProperty(code)) continue;
                var ent = reg.entities[code];
                if (ent && isFinite(ent.lat) && isFinite(ent.lng)) push(ent.lat, ent.lng);
            }
        }
    } catch (eFog) {}

    if (lastUserPosition && isFinite(lastUserPosition.lat) && isFinite(lastUserPosition.lng)) {
        push(lastUserPosition.lat, lastUserPosition.lng);
    }

    return anchors;
}

function initFogOfWarModule() {
    if (fogOfWarMod) {
        patracRefreshFogOfWar();
        if (fogOfWarMod.syncFogAdminControls) fogOfWarMod.syncFogAdminControls();
        return;
    }
    patracImport('map/fogOfWar.js').then(function(mod) {
        fogOfWarMod = mod;
        mod.initFogOfWar({
            getMap: function() { return map; },
            getRevealAnchors: collectFogRevealAnchors,
            isOperator: function() { return isOperatorMode === true; },
            revealRadiusM: 500
        });
        if (typeof refreshMapLayerStack === 'function') refreshMapLayerStack();
        updateAdminFogButtonUi();
    }).catch(function(err) { console.warn('[fogOfWar]', err); });
}

window.patracToggleFogEnabled = function(on) {
    if (!isOperatorMode || !fogOfWarMod) return;
    fogOfWarMod.setFogEnabled(on);
    updateAdminFogButtonUi();
    try { snapshotCommunityMapCache(); } catch (eFogSnap) {}
};
window.patracToggleFogRevealAll = function(on) {
    if (!isOperatorMode || !fogOfWarMod) return;
    fogOfWarMod.setFogRevealAll(on);
    updateAdminFogButtonUi();
    try { snapshotCommunityMapCache(); } catch (eFogSnap) {}
};

function updateAdminFogButtonUi() {
    var btn = document.getElementById('btn-admin-fog');
    if (!btn || !fogOfWarMod) return;
    var enabled = fogOfWarMod.isFogEnabled && fogOfWarMod.isFogEnabled();
    var revealAll = fogOfWarMod.isFogRevealAll && fogOfWarMod.isFogRevealAll();
    var fogActive = enabled && !revealAll;
    btn.classList.toggle('fog-off', !fogActive);
    btn.title = fogActive
        ? 'Mlha zapnutá — klepnutím vypnete (operátor)'
        : (revealAll ? 'Celá mapa viditelná — klepnutím zapnete mlhu' : 'Mlha vypnutá — klepnutím zapnete');
    var label = btn.querySelector('.fog-btn-label');
    if (label) label.textContent = fogActive ? 'MLHA' : 'VYP.';
}

window.patracToggleAdminFog = function() {
    if (!isOperatorMode || !fogOfWarMod) return;
    var enabled = fogOfWarMod.isFogEnabled && fogOfWarMod.isFogEnabled();
    var revealAll = fogOfWarMod.isFogRevealAll && fogOfWarMod.isFogRevealAll();
    if (enabled && !revealAll) {
        fogOfWarMod.setFogEnabled(false);
    } else if (revealAll) {
        fogOfWarMod.setFogRevealAll(false);
        fogOfWarMod.setFogEnabled(true);
    } else {
        fogOfWarMod.setFogEnabled(true);
    }
    updateAdminFogButtonUi();
    try { snapshotCommunityMapCache(); } catch (eFogSnap) {}
};
window.updateAdminFogButtonUi = updateAdminFogButtonUi;

var routePlannerMod = null;
var mgrsGridMod = null;
var mapMarkerRegistry = {};
var mapV3Module = null;
var mapNavTarget = null;
var compassBezelDeg = parseFloat(localStorage.getItem('patrac_compass_bezel') || '0') || 0;
var compassDeviceHeading = null;
var compassHeadingSource = null;
var compassOrientRaf = null;
var compassOrientLastEvent = null;
var compassOrientListening = false;
var compassOrientGranted = false;
var compassNeedsPermission = typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';
var compassScreenPos = { x: null, y: null };
var compassFloatListenersBound = false;
var mapLayerFilterState = null;
var lastUserPosition = null;
var QUEST_GPS_RADIUS_M = 80;

function mapHud() {
    return window.patracMapHud;
}

function canUseMapPlacement() {
    return isOperatorMode === true;
}

var isOperatorMode = false;
var currentlyEditingPlayerId = null;
var operatorComCode = '';
var operatorEditDraft = null;
var operatorEditDirty = false;
var _gateOperatorTimer = null;
var OPERATOR_ADMIN_KEY = 'Altavista2107';

var PLAYER_RANK_NAMES = ['Zelenáč', 'Makáč', 'Mazák', 'Veterán', 'Legenda'];
var COMMUNITY_RANK_NAMES = ['Zelenáči', 'Makáči', 'Mazáci', 'Veteráni', 'Legendy'];
var COMMUNITY_DIVISOR_DEFAULT = 4;
var SHELTER_STORY_BY_TIER = [
    'První dny v terénu. Útočiště je jen bod na mapě — provizorní přístřešek, kde se pátrači učí spolupracovat. Příběh komunity teprve začíná.',
    'Skupina se začíná organizovat. Společné vybavení na zádech znamená, že komunita drží pohromadě. Útočiště nabývá tvaru skutečné základny.',
    'Komunita už zná rytmus misí. Útočiště je místem návratu po každém výpadu — zde se sdílí zkušenosti a plánují další kroky do neznáma.',
    'Veteránská komunita. Útočiště přestalo být jen táborem — je to pevnost, ze které vyráží zkušení pátrači a kam se vrací ti, kdo přežili nejtěžší mise.',
    'Legenda mezi komunitami. Útočiště je symbolem přežití v Sektoru Alpha — příběh, který se bude vyprávět i po letech.'
];
var TALISMAN_STATUS_NAMES = ['Obyčejný', 'Prověřený', 'Kvalitní', 'Prvotřídní', 'Armádní kvalita'];
var SPECIALIZATION_MAP = {
    ino: '🏹 Cesta rebelie',
    herbert: '🧪 Herbertův odkaz',
    adam: '👦🐕 Stopařská čest',
    roxy: '👑 Vůdcovská disciplína',
    sef: '🔪 Dříčská krev'
};
var ISSUER_LABELS = {
    roxy: '👑 Roxy',
    sef: '🔪 Šéf',
    herbert: '🧪 Herbert',
    ino: '🏹 Ino',
    adam: '👦 Adam',
    klan: '👥 Klan'
};
var QUEST_ASSIGNERS = [
    { key: 'roxy', char: 'Roxy' },
    { key: 'sef', char: 'Šéf' },
    { key: 'herbert', char: 'Herbert' },
    { key: 'ino', char: 'Ino' },
    { key: 'adam', char: 'Adam' }
];
var ISSUER_ORDER = ['roxy', 'sef', 'herbert', 'ino', 'adam', 'klan'];

