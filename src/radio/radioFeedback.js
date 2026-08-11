/**
 * Zvuky + haptika vysílačky SECTOR-TECH (MP3 samply).
 */
import {
    SIGNAL_CLEAR,
    SIGNAL_WEAK,
    SIGNAL_FRAGMENT,
    SIGNAL_NOISE
} from './radioPropagation.js';

var SFX_BASE = '/src/assets/radio/sfx/';
var _pool = {};
var _keyIdx = 0;
var _msgIdx = 0;
var _ringIdx = 0;
var _unlocked = false;

var KEY_SFX = ['key-1.mp3', 'key-2.mp3', 'key-3.mp3'];
var MESSAGE_SFX = ['message-1.mp3', 'message-2.mp3', 'message-3.mp3'];
var RING_SFX = ['ring-1.mp3', 'ring-2.mp3', 'ring-3.mp3'];

function haptic(kind) {
    var pulse = kind === 'ok' ? 26 : (kind === 'back' ? 20 : 16);
    if (navigator.vibrate) {
        try { navigator.vibrate(pulse); } catch (e) {}
    }
}

function unlockAudio() {
    if (_unlocked) return;
    _unlocked = true;
    playSfx('key-2.mp3', { volume: 0.001 });
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

function nextFrom(list, idx) {
    var file = list[idx % list.length];
    return { file: file, next: (idx + 1) % list.length };
}

export function initRadioFeedback() {
    var all = KEY_SFX.concat(MESSAGE_SFX, RING_SFX, [
        'dial.mp3', 'ptt-start.mp3', 'ptt-end.mp3',
        'signal-hill.mp3', 'signal-range.mp3'
    ]);
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
    var pick = nextFrom(KEY_SFX, _keyIdx);
    _keyIdx = pick.next;
    playSfx(pick.file);
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
        var ringPick = nextFrom(RING_SFX, _ringIdx);
        _ringIdx = ringPick.next;
        playSfx(ringPick.file, { volume: signalQuality === SIGNAL_WEAK ? 0.65 : 0.88 });
        setTimeout(function() {
            var msgPick = nextFrom(MESSAGE_SFX, _msgIdx);
            _msgIdx = msgPick.next;
            playSfx(msgPick.file, { volume: signalQuality === SIGNAL_WEAK ? 0.72 : 0.9 });
        }, signalQuality === SIGNAL_WEAK ? 220 : 180);
    }
}
