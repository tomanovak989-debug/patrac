import { POCTA_PHASE } from './constants.js';
import { savePoctaVisit, getPoctaVisits, uploadPhoto } from '../services/dataService.js';
import { canReadPoctaLogs, canWritePoctaLog } from './permissions.js';
import { loadRegistry, upsertEntity } from './storage.js';
import { createVisitLog, isPoctaEntity } from './types.js';

var LOCAL_CACHE_LIMIT = 20;

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatVisitDate(timestamp) {
    if (timestamp == null) return '';
    try {
        return new Date(timestamp).toLocaleString('cs-CZ');
    } catch (e) {
        return '';
    }
}

function localVisitToNormalized(entry) {
    if (!entry) return null;
    var ts = entry.timestamp;
    if (ts == null && entry.date) {
        var parsed = Date.parse(entry.date);
        ts = Number.isNaN(parsed) ? Date.now() : parsed;
    }
    return {
        id: entry.id || ('local_' + (ts || Date.now())),
        poctaId: entry.poctaId || '',
        text: entry.text || '',
        timestamp: ts || Date.now(),
        location: entry.lat != null && entry.lng != null
            ? { lat: entry.lat, lng: entry.lng }
            : (entry.location || null),
        photoUrl: entry.photoUrl || null,
        userId: entry.userId || '',
        userName: entry.userName || 'Operativec',
        _localOnly: !!entry._localOnly
    };
}

function cloudVisitToNormalized(entry) {
    return {
        id: entry.id,
        poctaId: entry.poctaId,
        text: entry.text,
        timestamp: entry.timestamp,
        location: entry.location,
        photoUrl: entry.photoUrl,
        userId: entry.userId,
        userName: entry.userName,
        _localOnly: false
    };
}

function mergeVisits(cloudVisits, localVisits) {
    var byId = {};
    var merged = [];

    for (var i = 0; i < cloudVisits.length; i++) {
        var c = cloudVisitToNormalized(cloudVisits[i]);
        byId[c.id] = true;
        merged.push(c);
    }

    for (var j = 0; j < localVisits.length; j++) {
        var l = localVisitToNormalized(localVisits[j]);
        if (!l || byId[l.id]) continue;
        l._localOnly = true;
        merged.push(l);
    }

    merged.sort(function(a, b) {
        return b.timestamp - a.timestamp;
    });

    return merged;
}

function cacheVisitLocally(entity, visit) {
    if (!entity || !isPoctaEntity(entity)) return;
    entity.visitLogs = entity.visitLogs || [];
    entity.visitLogs.unshift({
        id: visit.id,
        userId: visit.userId,
        userName: visit.userName,
        text: visit.text,
        date: formatVisitDate(visit.timestamp),
        timestamp: visit.timestamp,
        lat: visit.location && visit.location.lat != null ? visit.location.lat : null,
        lng: visit.location && visit.location.lng != null ? visit.location.lng : null,
        photoUrl: visit.photoUrl || null
    });
    if (entity.visitLogs.length > LOCAL_CACHE_LIMIT) {
        entity.visitLogs.length = LOCAL_CACHE_LIMIT;
    }
    upsertEntity(entity, loadRegistry());
}

export function renderChronicleListHtml(visits) {
    if (!visits || !visits.length) {
        return '<p class="pocta-chronicle-empty">Zatím žádné záznamy v kronice.</p>';
    }

    var html = '<div class="pocta-chronicle-items">';
    for (var i = 0; i < visits.length; i++) {
        var v = visits[i];
        html += '<article class="pocta-chronicle-item">';
        html += '<div class="pocta-chronicle-meta">';
        html += '<strong>' + escapeHtml(v.userName || 'Operativec') + '</strong>';
        html += ' · <span>' + escapeHtml(formatVisitDate(v.timestamp)) + '</span>';
        if (v._localOnly) {
            html += ' · <span class="pocta-chronicle-local-tag">lokální</span>';
        }
        html += '</div>';
        html += '<p class="pocta-chronicle-text">' + escapeHtml(v.text) + '</p>';
        if (v.photoUrl) {
            html += '<a href="' + escapeHtml(v.photoUrl) + '" target="_blank" rel="noopener noreferrer" class="pocta-chronicle-photo-link">📷 Fotografie</a>';
        }
        html += '</article>';
    }
    html += '</div>';
    return html;
}

export function buildPoctaChronicleSection(entity, userId, near) {
    if (!isPoctaEntity(entity) || entity.phase !== POCTA_PHASE.ANCHORED) return '';

    var html = '<div class="pocta-chronicle" data-pocta-chronicle-root="' + escapeHtml(entity.id) + '">';

    if (near && canReadPoctaLogs(entity, userId, near)) {
        html += '<div class="pocta-chronicle-heading">📜 Kronika návštěv</div>';
        html += '<div class="pocta-chronicle-list"><p class="pocta-chronicle-loading">Načítám kroniku…</p></div>';

        if (canWritePoctaLog(entity, userId, near)) {
            html += '<form class="pocta-chronicle-form">';
            html += '<label class="pocta-chronicle-label">Nový záznam</label>';
            html += '<textarea class="pocta-chronicle-input" name="text" rows="2" maxlength="500" placeholder="Co se stalo na místě…" required></textarea>';
            html += '<input class="pocta-chronicle-file" type="file" name="photo" accept="image/*">';
            html += '<button type="submit" class="pocta-chronicle-submit">Uložit do kroniky</button>';
            html += '<p class="pocta-chronicle-status" aria-live="polite"></p>';
            html += '</form>';
        } else {
            html += '<p class="pocta-chronicle-hint">Jsi host — můžeš číst kroniku, ne přidávat záznamy.</p>';
        }
    } else {
        html += '<p class="pocta-chronicle-hint">Přibliž se na místo (~50 m) pro čtení kroniky.</p>';
    }

    html += '</div>';
    return html;
}

export async function loadChronicleForPocta(poctaId, localVisitLogs) {
    try {
        var cloud = await getPoctaVisits(poctaId);
        return mergeVisits(cloud, localVisitLogs || []);
    } catch (err) {
        console.warn('[chronicle] Cloud nedostupný, používám lokální cache.', err);
        return (localVisitLogs || []).map(localVisitToNormalized).filter(Boolean);
    }
}

export async function submitPoctaVisit(options) {
    var entity = options.entity;
    var userId = options.userId || '';
    var userName = options.userName || 'Operativec';
    var text = (options.text || '').trim();
    var photoFile = options.photoFile || null;
    var location = options.location || null;

    if (!entity || !isPoctaEntity(entity)) {
        throw new Error('Neplatná Pocta.');
    }
    if (!text) {
        throw new Error('Text záznamu je povinný.');
    }

    var photoUrl = null;
    if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
    }

    var locationPayload = null;
    if (location && location.lat != null && location.lng != null) {
        locationPayload = { lat: location.lat, lng: location.lng };
    }

    try {
        var saved = await savePoctaVisit({
            poctaId: entity.id,
            text: text,
            timestamp: Date.now(),
            location: locationPayload,
            photoUrl: photoUrl,
            userId: userId,
            userName: userName
        });
        cacheVisitLocally(entity, saved);
        return { ok: true, visit: saved, cachedLocally: false };
    } catch (err) {
        var fallback = createVisitLog(userId, userName, text,
            locationPayload ? locationPayload.lat : null,
            locationPayload ? locationPayload.lng : null);
        fallback.timestamp = Date.now();
        fallback.photoUrl = photoUrl;
        fallback._localOnly = true;
        var normalized = localVisitToNormalized(fallback);
        cacheVisitLocally(entity, normalized);
        return { ok: false, visit: normalized, cachedLocally: true, error: err };
    }
}

export function initPoctaChroniclePopup(entity, userId, near) {
    if (!isPoctaEntity(entity) || entity.phase !== POCTA_PHASE.ANCHORED) return;

    var root = document.querySelector('[data-pocta-chronicle-root="' + entity.id + '"]');
    if (!root) return;

    var listEl = root.querySelector('.pocta-chronicle-list');
    if (listEl && near && canReadPoctaLogs(entity, userId, near)) {
        loadChronicleForPocta(entity.id, entity.visitLogs || []).then(function(visits) {
            listEl.innerHTML = renderChronicleListHtml(visits);
        }).catch(function() {
            listEl.innerHTML = '<p class="pocta-chronicle-error">Kroniku se nepodařilo načíst.</p>';
        });
    }

    var formEl = root.querySelector('.pocta-chronicle-form');
    if (!formEl || !canWritePoctaLog(entity, userId, near)) return;
    if (formEl._poctaChronicleBound) return;
    formEl._poctaChronicleBound = true;

    formEl.addEventListener('submit', function(ev) {
        ev.preventDefault();

        var statusEl = formEl.querySelector('.pocta-chronicle-status');
        var textInput = formEl.querySelector('[name="text"]');
        var photoInput = formEl.querySelector('[name="photo"]');
        var submitBtn = formEl.querySelector('.pocta-chronicle-submit');
        var text = textInput ? textInput.value.trim() : '';
        var photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

        if (!text) {
            if (statusEl) statusEl.textContent = 'Napiš text záznamu.';
            return;
        }

        var bridge = window.patracPoctaBridge || {};
        var pos = bridge.lastUserPosition;
        var location = pos ? { lat: pos.lat, lng: pos.lng } : null;

        if (submitBtn) submitBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Ukládám do cloudu…';

        submitPoctaVisit({
            entity: entity,
            userId: userId,
            userName: localStorage.getItem('player_name') || 'Operativec',
            text: text,
            photoFile: photoFile,
            location: location
        }).then(function(result) {
            if (textInput) textInput.value = '';
            if (photoInput) photoInput.value = '';
            if (statusEl) {
                statusEl.textContent = result.ok
                    ? 'Uloženo v cloudu.'
                    : 'Cloud nedostupný — záznam uložen lokálně.';
            }
            return loadChronicleForPocta(entity.id, entity.visitLogs || []);
        }).then(function(visits) {
            if (visits && listEl) listEl.innerHTML = renderChronicleListHtml(visits);
        }).catch(function(err) {
            if (statusEl) {
                statusEl.textContent = err && err.message ? err.message : 'Uložení selhalo.';
            }
        }).finally(function() {
            if (submitBtn) submitBtn.disabled = false;
        });
    });
}
