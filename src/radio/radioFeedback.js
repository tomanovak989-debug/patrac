/**
 * Krátký klik + haptika pro tlačítka vysílačky SECTOR-TECH.
 */
var _audioCtx = null;

function getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
        _audioCtx = new Ctx();
    } catch (e) {
        _audioCtx = null;
    }
    return _audioCtx;
}

function playTone(freq, ms, gainVal) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch (e) {}
    }
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal || 0.045, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.01);
}

export function radioKeyFeedback(kind) {
    kind = kind || 'key';
    var pulse = kind === 'ok' ? 26 : (kind === 'back' ? 20 : 16);
    if (navigator.vibrate) {
        try { navigator.vibrate(pulse); } catch (e) {}
    }
    if (kind === 'ok') playTone(940, 42, 0.05);
    else if (kind === 'back') playTone(520, 38, 0.042);
    else if (kind === 'dial') playTone(660, 28, 0.035);
    else playTone(780, 32, 0.04);
}
