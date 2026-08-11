/**
 * Zvuky + haptika vysílačky SECTOR-TECH (MP3 samply).
 */
import {
    SIGNAL_CLEAR,
    SIGNAL_WEAK,
    SIGNAL_FRAGMENT,
    SIGNAL_NOISE
} from './radioPropagation.js';
import { normalizeSoundPrefs } from './radioComms.js';

var SFX_BASE = '/src/assets/radio/sfx/';
var _pool = {};
var _prefs = { key: 1, ring: 1, message: 1 };
var _unlocked = false;

function haptic(kind) {
    var pulse = kind === 'ok' ? 26 : (kind === 'back' ? 20 : 16);
    if (navigator.vibrate) {
        try { navigator.vibrate(pulse); } catch (e) {}
    }
}

function sfxName(prefix, variant) {
    return prefix + '-' + clampSoundVariant(variant) + '.mp3';
}

function clampSoundVariant(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < 1) return 1;
    if (n > 3) return 3;
    return n;
}

function unlockAudio() {
    if (_unlocked) return;
    _unlocked = true;
    playSfx(sfxName('key', _prefs.key), { volume: 0.001 });
}

function playSfx(file, opts) {
    opts = opts || {};
    if (!_pool[file]) {
        var audio = new Audio(SFX_BASE + file);
        audio.preload = 'auto';
        _pool[file] = audio;
    }
    var node = _pool[file].cloneNode(true);
    node.volume = opts.volume != null ? opts.volume : 0.88;
    var p = node.play();
    if (p && typeof p.catch === 'function') {
        p.catch(function() {});
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
    if (kind === 'key') playSfx(sfxName('key', variant));
    else if (kind === 'ring') playSfx(sfxName('ring', variant));
    else if (kind === 'message') playSfx(sfxName('message', variant));
}

export function initRadioFeedback(prefs) {
    setRadioSoundPrefs(prefs);
    var all = [];
    var p;
    for (p = 1; p <= 3; p++) {
        all.push(sfxName('key', p), sfxName('ring', p), sfxName('message', p));
    }
    all.push('dial.mp3', 'ptt-start.mp3', 'ptt-end.mp3', 'signal-hill.mp3', 'signal-range.mp3');
    for (var i = 0; i < all.length; i++) {
        if (!_pool[all[i]]) {
            var a = new Audio(SFX_BASE + all[i]);
            a.preload = 'auto';
            _pool[all[i]] = a;
        }
    }
}

export function radioKeyFeedback(kind) {
    kind = kind || 'key';
    unlockAudio();
    haptic(kind);
    if (kind === 'dial') {
        playSfx('dial.mp3');
        return;
    }
    playSfx(sfxName('key', _prefs.key));
}

export function radioTxStart() {
    unlockAudio();
    playSfx('ptt-start.mp3');
}

export function radioTxEnd() {
    unlockAudio();
    playSfx('ptt-end.mp3');
}

export function radioIncomingFeedback(signalQuality) {
    unlockAudio();
    if (signalQuality === SIGNAL_FRAGMENT) {
        playSfx('signal-hill.mp3');
        return;
    }
    if (signalQuality === SIGNAL_NOISE) {
        playSfx('signal-range.mp3');
        return;
    }
    if (signalQuality === SIGNAL_CLEAR || signalQuality === SIGNAL_WEAK) {
        playSfx(sfxName('ring', _prefs.ring), { volume: signalQuality === SIGNAL_WEAK ? 0.65 : 0.88 });
        setTimeout(function() {
            playSfx(sfxName('message', _prefs.message), { volume: signalQuality === SIGNAL_WEAK ? 0.72 : 0.9 });
        }, signalQuality === SIGNAL_WEAK ? 220 : 180);
    }
}
