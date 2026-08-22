/**
 * Boot / shutdown animace displeje vysílačky.
 */
import { radioIconUrl } from './radioMenuIcons.js';

export var BOOT_HELLO = ['HELLO .', 'HELLO ..', 'HELLO ...'];
export var BOOT_GOODBYE = ['GOODBYE ...', 'GOODBYE ..', 'GOODBYE .'];
export var BOOT_SIGNAL_FILES = [
    'boot-signal-0.png',
    'boot-signal-1.png',
    'boot-signal-2.png',
    'boot-signal-3.png',
    'boot-signal-4.png'
];

var HELLO_MS = 420;
var BLINK_MS = 180;
var BLINK_COUNT = 4;
var SIGNAL_MS = 220;
var GOODBYE_MS = 420;
var FADE_MS = 280;

export function createPowerAnimState() {
    return {
        active: false,
        direction: null,
        phase: 'idle',
        textStep: 0,
        signalLevel: 0,
        blinkOn: true,
        blinkCount: 0,
        timer: null
    };
}

export function isPowerAnimActive(session) {
    return !!(session && session.active);
}

export function stopPowerAnim(session) {
    if (!session) return;
    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    session.active = false;
    session.direction = null;
    session.phase = 'idle';
}

function schedule(session, ms, fn) {
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(fn, ms);
}

export function startBootAnim(session, onFrame, onComplete) {
    stopPowerAnim(session);
    session.active = true;
    session.direction = 'boot';
    session.phase = 'hello';
    session.textStep = 0;
    session.signalLevel = 0;
    session.blinkOn = true;
    session.blinkCount = 0;
    if (onFrame) onFrame();
    schedule(session, HELLO_MS, function() {
        advanceBoot(session, onFrame, onComplete);
    });
}

function advanceBoot(session, onFrame, onComplete) {
    if (!session.active || session.direction !== 'boot') return;

    if (session.phase === 'hello') {
        if (session.textStep < BOOT_HELLO.length - 1) {
            session.textStep++;
            if (onFrame) onFrame();
            schedule(session, HELLO_MS, function() {
                advanceBoot(session, onFrame, onComplete);
            });
            return;
        }
        session.phase = 'blink';
        session.blinkCount = 0;
        session.blinkOn = false;
        if (onFrame) onFrame();
        schedule(session, BLINK_MS, function() {
            advanceBoot(session, onFrame, onComplete);
        });
        return;
    }

    if (session.phase === 'blink') {
        session.blinkOn = !session.blinkOn;
        session.blinkCount++;
        if (onFrame) onFrame();
        if (session.blinkCount < BLINK_COUNT) {
            schedule(session, BLINK_MS, function() {
                advanceBoot(session, onFrame, onComplete);
            });
            return;
        }
        session.phase = 'signal';
        session.signalLevel = 0;
        session.blinkOn = true;
        if (onFrame) onFrame();
        schedule(session, SIGNAL_MS, function() {
            advanceBoot(session, onFrame, onComplete);
        });
        return;
    }

    if (session.phase === 'signal') {
        if (session.signalLevel < BOOT_SIGNAL_FILES.length - 1) {
            session.signalLevel++;
            if (onFrame) onFrame();
            schedule(session, SIGNAL_MS, function() {
                advanceBoot(session, onFrame, onComplete);
            });
            return;
        }
        session.phase = 'done';
        if (onFrame) onFrame();
        schedule(session, FADE_MS, function() {
            stopPowerAnim(session);
            if (onComplete) onComplete();
        });
    }
}

export function startShutdownAnim(session, onFrame, onComplete) {
    stopPowerAnim(session);
    session.active = true;
    session.direction = 'shutdown';
    session.phase = 'signal';
    session.signalLevel = BOOT_SIGNAL_FILES.length - 1;
    session.textStep = 0;
    if (onFrame) onFrame();
    schedule(session, SIGNAL_MS, function() {
        advanceShutdown(session, onFrame, onComplete);
    });
}

function advanceShutdown(session, onFrame, onComplete) {
    if (!session.active || session.direction !== 'shutdown') return;

    if (session.phase === 'signal') {
        if (session.signalLevel > 0) {
            session.signalLevel--;
            if (onFrame) onFrame();
            schedule(session, SIGNAL_MS, function() {
                advanceShutdown(session, onFrame, onComplete);
            });
            return;
        }
        session.phase = 'goodbye';
        session.textStep = 0;
        if (onFrame) onFrame();
        schedule(session, GOODBYE_MS, function() {
            advanceShutdown(session, onFrame, onComplete);
        });
        return;
    }

    if (session.phase === 'goodbye') {
        if (session.textStep < BOOT_GOODBYE.length - 1) {
            session.textStep++;
            if (onFrame) onFrame();
            schedule(session, GOODBYE_MS, function() {
                advanceShutdown(session, onFrame, onComplete);
            });
            return;
        }
        session.phase = 'black';
        if (onFrame) onFrame();
        schedule(session, FADE_MS, function() {
            stopPowerAnim(session);
            if (onComplete) onComplete();
        });
    }
}

export function getPowerAnimText(session) {
    if (!session || !session.active) return '';
    if (session.direction === 'boot' && session.phase === 'hello') {
        return BOOT_HELLO[session.textStep] || BOOT_HELLO[0];
    }
    if (session.direction === 'shutdown' && session.phase === 'goodbye') {
        return BOOT_GOODBYE[session.textStep] || BOOT_GOODBYE[0];
    }
    return '';
}

export function getPowerAnimSignalFile(session) {
    if (!session || !session.active) return BOOT_SIGNAL_FILES[0];
    if (session.phase === 'black') return null;
    if (session.direction === 'boot' && session.phase === 'hello') {
        return 'boot-signal-0.png';
    }
    if (session.direction === 'shutdown' && session.phase === 'goodbye') {
        return 'boot-signal-0.png';
    }
    if (session.phase === 'blink' && !session.blinkOn) {
        return null;
    }
    var level = session.signalLevel || 0;
    if (level < 0) level = 0;
    if (level >= BOOT_SIGNAL_FILES.length) level = BOOT_SIGNAL_FILES.length - 1;
    return BOOT_SIGNAL_FILES[level];
}

export function buildPowerAnimHtml(session, escapeFn) {
    escapeFn = escapeFn || function(v) { return String(v || ''); };
    var text = getPowerAnimText(session);
    var icon = getPowerAnimSignalFile(session);
    var iconHtml = icon
        ? '<img class="radio-boot-signal-icon" src="' + escapeFn(radioIconUrl(icon)) + '" alt="" draggable="false">'
        : '<span class="radio-boot-signal-icon is-empty" aria-hidden="true"></span>';
    return '<div class="radio-boot-screen">' +
        iconHtml +
        '<div class="radio-boot-text">' + escapeFn(text) + '</div>' +
        '</div>';
}
