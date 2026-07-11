import { POCTA_CODE_CHARS, POCTA_CODE_LENGTH } from './constants.js';

export function normalizeCode(raw) {
    return String(raw || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, POCTA_CODE_LENGTH);
}

export function isValidCodeFormat(code) {
    code = normalizeCode(code);
    if (code.length !== POCTA_CODE_LENGTH) return false;
    for (var i = 0; i < code.length; i++) {
        if (POCTA_CODE_CHARS.indexOf(code.charAt(i)) === -1) return false;
    }
    return true;
}

export function generateRandomCode() {
    var out = '';
    for (var i = 0; i < POCTA_CODE_LENGTH; i++) {
        out += POCTA_CODE_CHARS.charAt(Math.floor(Math.random() * POCTA_CODE_CHARS.length));
    }
    return out;
}

export function generateUniqueCode(existingCodes) {
    existingCodes = existingCodes || {};
    var code;
    var guard = 0;
    do {
        code = generateRandomCode();
        guard++;
    } while (existingCodes[code] && guard < 200);
    return code;
}

export function formatCodeDisplay(code) {
    return normalizeCode(code);
}
