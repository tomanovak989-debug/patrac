/* PATRAC: inventory, stats, map center helpers */
function appendItemHistory(item, entry) {
    if (item.itemType === 'tool') return;
    if (entry.type === 'transfer') return;
    if (!item.itemHistory) item.itemHistory = [];
    entry.date = entry.date || new Date().toLocaleString('cs-CZ');
    entry.clan = entry.clan || localStorage.getItem('com_name') || 'ÔÇö';
    entry.player = entry.player || localStorage.getItem('player_name') || 'ÔÇö';
    item.itemHistory.unshift(entry);
    if (item.itemHistory.length > 25) item.itemHistory.length = 25;
}

function formatItemHistoryHtml(item) {
    if (item.itemType === 'tool' || !item.itemHistory || !item.itemHistory.length) return '';
    var html = '<div class="item-history-block"><strong style="color:var(--muted-fg);">­čôť HISTORIE:</strong>';
    var limit = Math.min(item.itemHistory.length, 6);
    for (var i = 0; i < limit; i++) {
        var h = item.itemHistory[i];
        var line = '';
        if (h.type === 'crafted') line = 'ÔÜĺ´ŞĆ Vyroben v ' + h.clan + ' (' + h.player + ')';
        else if (h.type === 'mission') line = 'Ôśú´ŞĆ Mise: ' + (h.detail || 'ÔÇö');
        else if (h.type === 'lore') line = '­čôŁ ' + (h.detail || '├Üprava z├íznamu komunity');
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
        elSpecLocal.innerHTML = '<strong>LOK├üLN├Ź SPEC:</strong> ' + formatIssuerStatsHtml(profile.localIssuerStats || emptyIssuerStats(), profile.localMissions);
    }
    if (elSpecGlobal) {
        elSpecGlobal.innerHTML = '<strong>GLOB├üLN├Ź SPEC:</strong> ' + formatIssuerStatsHtml(profile.globalIssuerStats || emptyIssuerStats(), profile.globalMissions);
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
        alert('Na map─Ť zat├şm nejsou ┼ż├ídn├ę ulo┼żen├ę body.');
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
        setGpsStatus('ÔŚĆ Na─Ź├şt├ím polohu...');
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
        alert('├Üto─Źi┼ít─Ť je┼ít─Ť nen├ş zam─Ť┼Öeno. Nejd┼Ö├şv spl┼ł misi od Roxy a ulo┼ż polohu.');
        return;
    }
    map.setView([parseFloat(lat), parseFloat(lng)], Math.max(map.getZoom(), 16));
}

function previewImage(input) {
    if (!input.files || !input.files[0]) return;
    compressAvatarForStorage(input.files[0], function(result) {
        if (!result) {
            alert('Avatar se nepoda┼Öilo zpracovat. Zkus men┼í├ş nebo jinou fotku.');
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
        alert('Foto je v─Ťt┼í├ş ÔÇö p┼Öi ulo┼żen├ş se zkomprimuje a nahraje do cloudu.');
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
    if (gamePrev) gamePrev.innerHTML = dataUrl ? '<img src="' + dataUrl + '">' : 'ÔÇö';
    var editPrev = document.getElementById('profile-edit-avatar-preview');
    if (editPrev) editPrev.innerHTML = dataUrl ? '<img src="' + dataUrl + '">' : 'ÔÇö';
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
    if (btn) { btn.disabled = false; btn.textContent = 'ZALO┼ŻIT A VSTOUPIT'; }
    try { onRegComModeChange(); } catch (e) {}
}

