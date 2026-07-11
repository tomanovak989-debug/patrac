import { bindTerminalUi, renderTerminalPanel, submitTerminalCode, terminalPanTo } from './terminal.js';
import { onGpsProximityTick, reloadPoctaMapMarkers } from './map-bridge.js';
import { loadRegistry } from './storage.js';
import { maybeGrantPoctaForQuest, simulateQuestPoctaReward } from './quest-rewards.js';

function getContext() {
    return {
        userId: localStorage.getItem('patrac_session') || '',
        userName: localStorage.getItem('player_name') || 'Operativec'
    };
}

export function initPoctaModule(bridge) {
    window.patracPoctaBridge = Object.assign({
        map: null,
        mapPointsLayer: null,
        mapMarkerRegistry: {},
        lastUserPosition: null,
        distanceMeters: null,
        switchMainTab: null
    }, bridge || {});

    var ctx = getContext();
    bindTerminalUi(ctx);
    reloadPoctaMapMarkers(ctx.userId);

    window.patracTerminalSubmit = function(code) {
        return submitTerminalCode(code, getContext());
    };
    window.patracTerminalPanTo = function(code) {
        return terminalPanTo(code);
    };
    window.patracPoctaReloadMap = function() {
        reloadPoctaMapMarkers(getContext().userId);
    };
    window.patracPoctaOnGps = function() {
        onGpsProximityTick(getContext().userId);
    };
    window.patracPoctaRenderTerminal = function() {
        renderTerminalPanel(getContext());
    };
    window.patracMaybeGrantPoctaReward = function(quest) {
        return maybeGrantPoctaForQuest(quest);
    };
    window.patracSimulateQuestPoctaReward = function() {
        var result = simulateQuestPoctaReward();
        return result.ok ? result.entity : null;
    };

    return { registry: loadRegistry(), ctx: ctx };
}

export { loadRegistry };
