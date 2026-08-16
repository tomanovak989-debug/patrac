/**
 * PTT — krátké hlasové zprávy (MediaRecorder, max ~8 s).
 */
export var PTT_MAX_MS = 8000;

export function createPttSession() {
    return {
        active: false,
        recorder: null,
        stream: null,
        chunks: [],
        startedAt: 0
    };
}

function pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (var i = 0; i < types.length; i++) {
        if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return '';
}

export function isPttSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
}

export async function startPttRecording(session) {
    if (!session || session.active || !isPttSupported()) return false;
    var stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
    });
    var mime = pickMimeType();
    var recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    session.stream = stream;
    session.chunks = [];
    session.recorder = recorder;
    session.startedAt = Date.now();
    session.active = true;
    recorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) session.chunks.push(e.data);
    };
    recorder.start(200);
    return true;
}

function stopStream(session) {
    if (session && session.stream) {
        var tracks = session.stream.getTracks();
        for (var i = 0; i < tracks.length; i++) {
            try { tracks[i].stop(); } catch (e) {}
        }
        session.stream = null;
    }
}

function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onloadend = function() {
            var data = reader.result || '';
            var idx = String(data).indexOf(',');
            resolve(idx >= 0 ? String(data).slice(idx + 1) : '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function stopPttRecording(session) {
    if (!session || !session.active || !session.recorder) {
        return Promise.resolve(null);
    }
    return new Promise(function(resolve) {
        var recorder = session.recorder;
        var timedOut = Date.now() - session.startedAt >= PTT_MAX_MS;
        recorder.onstop = function() {
            var mime = recorder.mimeType || 'audio/webm';
            var blob = new Blob(session.chunks, { type: mime });
            session.active = false;
            session.recorder = null;
            session.chunks = [];
            stopStream(session);
            if (!blob.size) {
                resolve(null);
                return;
            }
            blobToBase64(blob).then(function(base64) {
                resolve({
                    base64: base64,
                    mime: mime,
                    durationMs: Math.min(PTT_MAX_MS, Date.now() - session.startedAt),
                    timedOut: timedOut
                });
            }).catch(function() { resolve(null); });
        };
        try { recorder.stop(); } catch (e2) {
            session.active = false;
            stopStream(session);
            resolve(null);
        }
    });
}

export function cancelPttRecording(session) {
    if (!session || !session.active) return;
    if (session.recorder) {
        try { session.recorder.stop(); } catch (e) {}
    }
    session.active = false;
    session.recorder = null;
    session.chunks = [];
    stopStream(session);
}

export function playPttAudio(base64, mime) {
    if (!base64) return;
    mime = mime || 'audio/webm';
    try {
        var audio = new Audio('data:' + mime + ';base64,' + base64);
        audio.volume = 0.92;
        var p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(function() {});
    } catch (e) {}
}

export function formatPttNotebookText(durationMs) {
    var sec = Math.max(1, Math.round((durationMs || 1000) / 1000));
    return '[PTT ' + sec + 's]';
}
