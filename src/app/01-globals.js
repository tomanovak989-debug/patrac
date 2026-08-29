/* PATRAC app chunk: 01-globals.js — do not reorder script tags in index.html */
var map = null, userMarker = null;
var PATRAC_BUILD = '20260829e218';
window.PATRAC_BUILD = PATRAC_BUILD;

/** Dynamický import ES modulů — absolutní cesta od kořene webu (skript běží z /src/app/, proto ne relativní!), s cache-bustem. Vnořené `from './x.js'` řeší import mapa v index.html. */
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

var topoRulerMod = null;

var routePlannerMod = null;
var mgrsGridMod = null;
var radioRangeMod = null;
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

