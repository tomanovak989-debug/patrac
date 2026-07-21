import { isValidCodeFormat, normalizeCode } from './codes.js';
import { activateCodeForUser } from './storage.js';
import { reloadPoctaMapMarkers } from './map-bridge.js';

/** Aktivace kódu bez terminálového UI (inventář / API). */
export async function submitTerminalCode(rawCode, ctx) {
    var code = normalizeCode(rawCode);
    if (!isValidCodeFormat(code)) {
        return { ok: false, error: 'invalid_format' };
    }

    var result = await activateCodeForUser(ctx.userId, code);
    if (!result.ok) {
        return result;
    }

    reloadPoctaMapMarkers(ctx.userId);
    return result;
}
