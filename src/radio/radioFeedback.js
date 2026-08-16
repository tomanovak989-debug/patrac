/**
 * Zvuky + haptika vysílačky SECTOR-TECH (MP3, Web Audio, trim, přerušení).
 */
import {
    SIGNAL_CLEAR,
    SIGNAL_WEAK,
    SIGNAL_FRAGMENT,
    SIGNAL_NOISE
} from './radioPropagation.js';
import { normalizeSoundPrefs } from './radioComms.js';

var SFX_BASE = '/src/assets/radio/sfx/';
var _prefs = { key: 1, ring: 1, message: 1 };
var _unlocked = false;
var _ctx = null;
var _buffers = {};
var _keyVoice = null;
var _dialVoice = null;
var _miscVoice = null;
var _loading = {};
var _lastPlayAt = {};

/** Ořez ticha na začátku samply (s). */
var SFX_TRIM = {
    'key-1.mp3': 0.078,
    'key-2.mp3': 0.048,
    'key-3.mp3': 0.058,
    'dial.mp3': 0.048,
    'message-1.mp3': 0.012,
    'message-2.mp3': 0.010,
    'message-3.mp3': 0.015,
    'ring-1.mp3': 0.025,
    'ring-2.mp3': 0.018,
    'ring-3.mp3': 0.022,
    'ptt-start.mp3': 0.010,
    'ptt-end.mp3': 0.010,
    'signal-hill.mp3': 0.030,
    'signal-range.mp3': 0.030
};

function clampSoundVariant(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < 1) return 1;
    if (n > 3) return 3;
    return n;
}

function sfxName(prefix, variant) {
    return prefix + '-' + clampSoundVariant(variant) + '.mp3';
}

function getCtx() {
    if (_ctx) return _ctx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { _ctx = new Ctx(); } catch (e) { _ctx = null; }
    return _ctx;
}

function haptic(kind) {
    var pulse = kind === 'ok' ? 26 : (kind === 'back' ? 20 : 16);
    if (navigator.vibrate) {
        try { navigator.vibrate(pulse); } catch (e) {}
    }
}

function stopVoice(voice) {
    if (!voice) return;
    try { voice.source.stop(0); } catch (e) {}
    try {
        voice.source.disconnect();
        voice.gain.disconnect();
    } catch (e2) {}
}

function loadBuffer(file) {
    if (_buffers[file]) return Promise.resolve(_buffers[file]);
    if (_loading[file]) return _loading[file];
    _loading[file] = fetch(SFX_BASE + file)
        .then(function(r) { return r.arrayBuffer(); })
        .then(function(buf) {
            var ctx = getCtx();
            if (!ctx) return null;
            return ctx.decodeAudioData(buf);
        })
        .then(function(decoded) {
            if (decoded) _buffers[file] = decoded;
            return decoded;
        })
        .catch(function() { return null; })
        .finally(function() { delete _loading[file]; });
    return _loading[file];
}

function shouldSkipPlay(file, channel) {
    var stamp = channel + ':' + file;
    var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (_lastPlayAt[stamp] && now - _lastPlayAt[stamp] < 100) return true;
    _lastPlayAt[stamp] = now;
    return false;
}

function playDecoded(file, opts) {
    opts = opts || {};
    var channel = opts.channel || 'misc';
    if (shouldSkipPlay(file, channel)) return null;
    var decoded = _buffers[file];
    var ctx = getCtx();
    if (!decoded || !ctx) return null;
    if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch (e) {}
    }
    var trim = SFX_TRIM[file] || 0;
    var duration = Math.max(0.01, decoded.duration - trim);
    if (channel === 'key') {
        stopVoice(_keyVoice);
        _keyVoice = null;
    } else if (channel === 'dial') {
        stopVoice(_dialVoice);
        _dialVoice = null;
    } else if (channel === 'misc') {
        stopVoice(_miscVoice);
        _miscVoice = null;
    }
    var source = ctx.createBufferSource();
    source.buffer = decoded;
    var gain = ctx.createGain();
    gain.gain.value = opts.volume != null ? opts.volume : 0.88;
    source.connect(gain);
    gain.connect(ctx.destination);
    var when = ctx.currentTime;
    source.start(when, trim, duration);
    var voice = { source: source, gain: gain };
    if (channel === 'key') _keyVoice = voice;
    else if (channel === 'dial') _dialVoice = voice;
    else _miscVoice = voice;
    return voice;
}

function playSfx(file, opts) {
    if (_buffers[file]) {
        playDecoded(file, opts);
        return;
    }
    loadBuffer(file).then(function(decoded) {
        if (decoded) playDecoded(file, opts);
    });
}

function unlockAudio() {
    if (_unlocked) return;
    _unlocked = true;
    var ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
        try { ctx.resume(); } catch (e) {}
    }
}

export function setRadioSoundPrefs(prefs) {
    _prefs = normalizeSoundPrefs(prefs);
}

export function getRadioSoundPrefs() {
    return normalizeSoundPrefs(_prefs);
}

export function previewSoundPref(kind, variant) {
    unlockAudio();
    if (kind === 'key') playSfx(sfxName('key', variant), { channel: 'key' });
    else if (kind === 'ring') playSfx(sfxName('ring', variant), { channel: 'misc' });
    else if (kind === 'message') playSfx(sfxName('message', variant), { channel: 'misc' });
}

export function initRadioFeedback(prefs) {
    setRadioSoundPrefs(prefs);
    unlockAudio();
    var all = [];
    var p;
    for (p = 1; p <= 3; p++) {
        all.push(sfxName('key', p), sfxName('ring', p), sfxName('message', p));
    }
    all.push('dial.mp3', 'ptt-start.mp3', 'ptt-end.mp3', 'signal-hill.mp3', 'signal-range.mp3');
    for (var i = 0; i < all.length; i++) {
        loadBuffer(all[i]);
    }
}

export function radioKeyFeedback(kind) {
    kind = kind || 'key';
    unlockAudio();
    haptic(kind);
    if (kind === 'dial') {
        playSfx('dial.mp3', { channel: 'dial' });
        return;
    }
    playSfx(sfxName('key', _prefs.key), { channel: 'key' });
}

export function radioDialFeedback() {
    radioKeyFeedback('dial');
}

export function radioKeypadPttDown() {
    unlockAudio();
    playSfx('signal-range.mp3', { channel: 'misc', volume: 0.72 });
}

export function radioKeypadPttUp() {
    unlockAudio();
    playSfx('ptt-end.mp3', { channel: 'misc' });
}

export function radioTxStart() {
    radioKeypadPttDown();
}

export function radioTxEnd() {
    radioKeypadPttUp();
}

export function radioIncomingFeedback(signalQuality) {
    unlockAudio();
    if (signalQuality === SIGNAL_FRAGMENT) {
        playSfx('signal-hill.mp3', { channel: 'misc' });
        return;
    }
    if (signalQuality === SIGNAL_NOISE) {
        playSfx('signal-range.mp3', { channel: 'misc' });
        return;
    }
    if (signalQuality === SIGNAL_CLEAR || signalQuality === SIGNAL_WEAK) {
        playSfx(sfxName('ring', _prefs.ring), {
            channel: 'misc',
            volume: signalQuality === SIGNAL_WEAK ? 0.65 : 0.88
        });
        setTimeout(function() {
            playSfx(sfxName('message', _prefs.message), {
                channel: 'misc',
                volume: signalQuality === SIGNAL_WEAK ? 0.72 : 0.9
            });
        }, signalQuality === SIGNAL_WEAK ? 200 : 160);
    }
}
