/* PATRAC: GPS geolocation and hard reset */
function geolocationErrorText(err) {
    if (!err) return 'GPS nedostupn├ę';
    if (err.code === 1) return 'Poloha zam├ştnuta ÔÇö povol v nastaven├ş prohl├ş┼że─Źe/telefonu';
    if (err.code === 2) return 'Poloha nedostupn├í ÔÇö zapni GPS a WiÔÇĹFi';
    if (err.code === 3) return 'GPS timeout ÔÇö stiskni CENTR. pro opakov├ín├ş';
    return err.message || 'GPS chyba';
}

var gpsWatchId = null;
var userAccuracyCircle = null;

function setGpsStatus(html) {
    var gpsEl = document.getElementById('gps-status-text');
    if (gpsEl) gpsEl.innerHTML = html;
}

function applyUserPosition(position) {
    if (!map || !position || !position.coords) return;
    var lat = position.coords.latitude;
    var lng = position.coords.longitude;
    var acc = position.coords.accuracy || 30;

    lastUserPosition = { lat: lat, lng: lng, accuracy: acc, ts: Date.now() };
    if (window.patracPoctaBridge) window.patracPoctaBridge.lastUserPosition = lastUserPosition;
    if (typeof window.patracPoctaOnGps === 'function') window.patracPoctaOnGps();
    updateTacticalHud();

    setGpsStatus('<span style="color:#0077ff;">ÔŚĆ GPS LOCK</span>');

    if (!userMarker) {
        userMarker = L.circleMarker([lat, lng], {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#0077ff',
            fillOpacity: 1,
            pane: 'markerPane'
        }).addTo(map);
        userMarker.bindPopup('­čôŹ Tvoje poloha');
    } else {
        userMarker.setLatLng([lat, lng]);
    }

    if (userAccuracyCircle) {
        map.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
    }
    userAccuracyCircle = L.circle([lat, lng], {
        radius: acc,
        color: '#0077ff',
        weight: 1,
        fillColor: '#0077ff',
        fillOpacity: 0.12
    }).addTo(map);

    if (!map._gpsCenteredOnce) {
        map.setView([lat, lng], 16);
        map._gpsCenteredOnce = true;
    }
    patracRefreshFogOfWar();
}

function onGpsError(err) {
    setGpsStatus('<span style="color:var(--danger-orange);">ÔŚĆ ' + geolocationErrorText(err) + '</span>');
}

function startGeolocation() {
    if (!navigator.geolocation) {
        setGpsStatus('<span style="color:var(--danger-orange);">ÔŚĆ GPS NEN├Ź V PROHL├Ź┼ŻE─îI</span>');
        return;
    }
    setGpsStatus('ÔŚĆ Hled├ím GPS sign├íl...');

    navigator.geolocation.getCurrentPosition(
        applyUserPosition,
        onGpsError,
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    gpsWatchId = navigator.geolocation.watchPosition(
        applyUserPosition,
        onGpsError,
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 }
    );
}

function hardResetData() {
    var msg = 'Smazat ve┼íker├í lok├íln├ş data v tomto prohl├ş┼że─Źi?\n\n'
        + 'ÔÇó Sma┼że se postup, ├║─Źty a invent├í┼Ö v tomto za┼Ö├şzen├ş.\n'
        + 'ÔÇó Data ve Firebase (cloud) z┼»stanou ÔÇö star├Ż ├║─Źet lze znovu na─Ź├şst p┼Öihl├í┼íen├şm.\n'
        + 'ÔÇó Pro ├║pln─Ť nov├Ż start zvol p┼Öi registraci NOV├ë ID operativce.\n\n'
        + 'Pokra─Źovat?';
    if (!confirm(msg)) return;
    try { sessionStorage.setItem('patrac_after_local_reset', '1'); } catch (e) {}
    localStorage.clear();
    window.location.reload();
}

