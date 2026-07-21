import { onGpsProximityTick, reloadPoctaMapMarkers } from './map-bridge.js';
import { loadRegistry } from './storage.js';
import { maybeGrantPoctaForQuest, simulateQuestPoctaReward } from './quest-rewards.js';
import { anchorPoctaFromInventory } from './anchoring.js';
import { panToEntity } from './map-bridge.js';
import { submitTerminalCode } from './terminal.js';

function getContext() {
    return {
        userId: localStorage.getItem('patrac_session') || '',
        userName: localStorage.getItem('player_name') || 'Operativec'
    };
}

/** Runtime bez terminálového UI — mapa, questy, inventář. */
export function initPoctaModule(bridge) {
    window.patracPoctaBridge = Object.assign({
        map: null,
        mapPointsLayer: null,
        mapMarkerRegistry: {},
        lastUserPosition: null,
        distanceMeters: null,
        switchMainTab: null,
        startGeolocation: null,
        resolveCommunityItemAtDisplayIndex: null
    }, bridge || {});

    var ctx = getContext();
    reloadPoctaMapMarkers(ctx.userId);

    window.patracTerminalSubmit = function(code) {
        return submitTerminalCode(code, getContext());
    };
    window.patracTerminalPanTo = function(code) {
        return panToEntity(code);
    };
    window.patracPoctaReloadMap = function() {
        reloadPoctaMapMarkers(getContext().userId);
    };
    window.patracPoctaOnGps = function() {
        onGpsProximityTick(getContext().userId);
    };
    window.patracMaybeGrantPoctaReward = function(quest) {
        return maybeGrantPoctaForQuest(quest);
    };
    window.patracSimulateQuestPoctaReward = function() {
        var result = simulateQuestPoctaReward();
        return result.ok ? result.entity : null;
    };
    window.patracAnchorPoctaFromInventory = function(displayIndex) {
        var c = getContext();
        return anchorPoctaFromInventory(displayIndex, c.userId).then(function(result) {
            if (result.ok) {
                var b = window.patracPoctaBridge || {};
                if (typeof b.loadCustomCraftedItems === 'function') {
                    b.loadCustomCraftedItems();
                }
                alert('✝ Pocta ukotvena na mapě.\n\n→ záložka 🗺️ Mapa');
            } else {
                alert(result.error || 'Ukotvení selhalo.');
            }
            return result;
        });
    };

    return { registry: loadRegistry(), ctx: ctx };
}

export { loadRegistry };
