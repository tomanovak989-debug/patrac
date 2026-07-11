import {
    CODED_QUEST_ACTIVATE_RADIUS_M,
    CODED_QUEST_PHASE,
    POCTA_PHASE,
    POCTA_VISIT_RADIUS_M
} from './constants.js';
import { isOwner } from './permissions.js';
import {
    findEntityByCode,
    getActivatedEntities,
    loadRegistry,
    saveRegistry,
    upsertEntity
} from './storage.js';
import { getEntityMapId, isCodedQuestEntity, isPoctaEntity } from './types.js';

function getBridge() {
    return window.patracPoctaBridge || {};
}

function distanceMeters(lat1, lng1, lat2, lng2) {
    var fn = getBridge().distanceMeters;
    if (typeof fn === 'function') return fn(lat1, lng1, lat2, lng2);
    return Infinity;
}

function getUserPosition() {
    var pos = getBridge().lastUserPosition;
    if (!pos) return null;
    if (Date.now() - (pos.ts || 0) > 120000) return null;
    return pos;
}

function isNearCoords(lat, lng, radiusM) {
    var pos = getUserPosition();
    if (!pos || lat == null || lng == null) return false;
    var acc = Math.min(pos.accuracy || 30, 50);
    return distanceMeters(pos.lat, pos.lng, lat, lng) <= (radiusM + acc);
}

export function checkProximityForEntity(entity) {
    if (!entity || entity.lat == null || entity.lng == null) return false;
    if (isPoctaEntity(entity) && entity.phase === POCTA_PHASE.ANCHORED) {
        return isNearCoords(entity.lat, entity.lng, POCTA_VISIT_RADIUS_M);
    }
    if (isCodedQuestEntity(entity) && entity.phase !== CODED_QUEST_PHASE.COMPLETED) {
        return isNearCoords(entity.lat, entity.lng, CODED_QUEST_ACTIVATE_RADIUS_M);
    }
    return false;
}

export function maybeAdvanceCodedQuestOnProximity(entity, registry) {
    if (!isCodedQuestEntity(entity)) return entity;
    if (entity.phase !== CODED_QUEST_PHASE.MYSTERY) return entity;
    if (!checkProximityForEntity(entity)) return entity;
    entity.phase = CODED_QUEST_PHASE.ACTIVE;
    entity.activatedAt = new Date().toISOString();
    upsertEntity(entity, registry);
    return entity;
}

function markerStyle(entity, userId) {
    var own = isOwner(entity, userId);
    if (isPoctaEntity(entity)) {
        if (entity.phase !== POCTA_PHASE.ANCHORED) return null;
        return {
            color: own ? '#e8c547' : '#b8942e',
            fillColor: own ? '#e8c547' : '#b8942e',
            fillOpacity: own ? 0.45 : 0.28,
            weight: own ? 3 : 2,
            dashArray: own ? null : '4,4',
            radius: 10,
            labelPrefix: own ? '🕯️ ' : '🕯️ ',
            sharedTag: own ? 'Moje pocta' : 'Sdílená pocta'
        };
    }
    if (isCodedQuestEntity(entity)) {
        var isMystery = entity.phase === CODED_QUEST_PHASE.MYSTERY;
        var isActive = entity.phase === CODED_QUEST_PHASE.ACTIVE;
        var isDone = entity.phase === CODED_QUEST_PHASE.COMPLETED;
        var color = isDone ? '#5a6858' : (isActive ? '#4af626' : '#888888');
        return {
            color: color,
            fillColor: color,
            fillOpacity: isMystery ? 0.15 : (isDone ? 0.1 : 0.35),
            weight: own ? 3 : 2,
            dashArray: own ? null : '6,4',
            radius: isMystery ? 8 : 9,
            labelPrefix: isMystery ? '❓ ' : (isDone ? '✓ ' : '🎯 '),
            sharedTag: own ? 'Můj úkol' : 'Sdílený úkol'
        };
    }
    return null;
}

function buildPopupHtml(entity, userId, near) {
    var own = isOwner(entity, userId);
    var html = '<div class="map-popup-body pocta-popup">';
    html += '<div class="popup-meta">' + (own ? '👤 VLASTNÍK' : '👥 HOST') + ' · KÓD ' + entity.code + '</div>';

    if (isPoctaEntity(entity)) {
        html += '<strong style="color:#e8c547;">' + entity.title + '</strong>';
        if (entity.phase === POCTA_PHASE.ANCHORED) {
            if (near) {
                html += '<p class="popup-desc">' + (entity.story || 'Kronika místa.') + '</p>';
                if (entity.visitLogs && entity.visitLogs.length) {
                    html += '<div style="font-size:8px;color:#aaa;margin-top:6px;">Poslední návštěva: ' + entity.visitLogs[entity.visitLogs.length - 1].date + '</div>';
                }
                if (own) {
                    html += '<p style="font-size:8px;color:#888;margin-top:4px;">Jsi na místě — můžeš zapisovat do kroniky (brzy).</p>';
                } else {
                    html += '<p style="font-size:8px;color:#888;margin-top:4px;">Jsi host — můžeš číst kroniku, ne editovat.</p>';
                }
            } else {
                html += '<p class="popup-desc">Pocta ukotvena. Přibliž se na místo (~50 m) pro čtení kroniky.</p>';
            }
        }
    }

    if (isCodedQuestEntity(entity)) {
        if (entity.phase === CODED_QUEST_PHASE.MYSTERY) {
            html += '<strong style="color:#888;">ZÁHADA</strong>';
            html += '<p class="popup-desc">Neznámý signál. Přibliž se (~30 m) pro aktivaci úkolu.</p>';
        } else if (entity.phase === CODED_QUEST_PHASE.ACTIVE) {
            html += '<strong style="color:#4af626;">' + entity.title + '</strong>';
            html += '<p class="popup-desc">' + (entity.desc || '') + '</p>';
            if (near) {
                html += '<p style="font-size:8px;color:#888;">Na místě — splnění brzy.</p>';
            }
        } else {
            html += '<strong style="color:#666;">Splněno</strong>';
            html += '<p class="popup-desc">' + entity.title + '</p>';
        }
    }

    html += '</div>';
    return html;
}

function buildLabelHtml(entity, style) {
    var title = entity.title || entity.code;
    if (title.length > 18) title = title.slice(0, 17) + '…';
    return style.labelPrefix + title;
}

export function renderEntityOnMap(entity, userId) {
    var bridge = getBridge();
    if (!bridge.map || !bridge.mapPointsLayer || !window.L) return;
    var L = window.L;
    if (entity.lat == null || entity.lng == null) return;

    var style = markerStyle(entity, userId);
    if (!style) return;

    var mapId = getEntityMapId(entity);
    var registry = bridge.mapMarkerRegistry || {};
    if (registry[mapId] && bridge.mapPointsLayer.removeLayer) {
        bridge.mapPointsLayer.removeLayer(registry[mapId]);
    }

    var near = checkProximityForEntity(entity);
    var marker = L.circleMarker([entity.lat, entity.lng], {
        radius: style.radius,
        color: style.color,
        weight: style.weight,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        dashArray: style.dashArray || null,
        pane: 'mapPointsPane'
    }).addTo(bridge.mapPointsLayer);

    marker.bindTooltip(buildLabelHtml(entity, style), {
        permanent: true,
        direction: 'top',
        className: 'map-point-label' + (style.dashArray ? ' map-point-inactive' : ''),
        offset: [0, -10]
    });
    marker.bindPopup(buildPopupHtml(entity, userId, near), { maxWidth: 240, minWidth: 170 });
    marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var out = document.getElementById('map-sensor-output');
        if (out) out.innerHTML = '📡 ' + style.labelPrefix + entity.title + ' · ' + style.sharedTag;
        marker.openPopup();
    });

    registry[mapId] = marker;
    bridge.mapMarkerRegistry = registry;
}

export function reloadPoctaMapMarkers(userId) {
    var registry = loadRegistry();
    var entities = getActivatedEntities(userId, registry);
    for (var i = 0; i < entities.length; i++) {
        var entity = entities[i];
        entity = maybeAdvanceCodedQuestOnProximity(entity, registry) || entity;
        if (isPoctaEntity(entity) && entity.phase !== POCTA_PHASE.ANCHORED) continue;
        if (isCodedQuestEntity(entity) && entity.lat == null) continue;
        renderEntityOnMap(entity, userId);
    }
}

export function onGpsProximityTick(userId) {
    var registry = loadRegistry();
    var entities = getActivatedEntities(userId, registry);
    var changed = false;
    for (var i = 0; i < entities.length; i++) {
        var before = entities[i].phase;
        var updated = maybeAdvanceCodedQuestOnProximity(entities[i], registry);
        if (updated && updated.phase !== before) changed = true;
    }
    if (changed) reloadPoctaMapMarkers(userId);
    else {
        for (var j = 0; j < entities.length; j++) {
            renderEntityOnMap(entities[j], userId);
        }
    }
}

export function panToEntity(code) {
    var entity = findEntityByCode(code, loadRegistry());
    if (!entity || entity.lat == null || entity.lng == null) return false;
    var bridge = getBridge();
    if (!bridge.map) return false;
    bridge.map.setView([entity.lat, entity.lng], Math.max(bridge.map.getZoom(), 16));
    var out = document.getElementById('map-sensor-output');
    if (out) out.innerHTML = '📡 Terminál → ' + (entity.title || entity.code);
    if (typeof bridge.switchMainTab === 'function') {
        var btn = document.querySelectorAll('.bottom-action-bar button')[2];
        bridge.switchMainTab('map-only', btn);
    }
    return true;
}
