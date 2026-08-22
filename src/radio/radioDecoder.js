/**
 * Dešifrátor — luštění zachycených šifrovaných zpráv z éteru.
 * Logika (frekvence, klíče, náhled dešifru) se doplní v další iteraci.
 */
export var DECODER_SCREENS = {
    HUB: 'hub',
    CAPTURE: 'capture',
    WORKBENCH: 'workbench'
};

export function createDecoderState() {
    return {
        screen: DECODER_SCREENS.HUB,
        focusIndex: 0,
        selectedCaptureId: null,
        draftKey: '',
        draftOutput: ''
    };
}

export function resetDecoderState(session) {
    if (!session) return createDecoderState();
    session.screen = DECODER_SCREENS.HUB;
    session.focusIndex = 0;
    session.selectedCaptureId = null;
    session.draftKey = '';
    session.draftOutput = '';
    return session;
}

/**
 * @param {object|null} session
 * @param {{ captures?: Array }} [notebook]
 */
export function buildDecoderOsView(session, notebook) {
    session = session || createDecoderState();
    notebook = notebook || {};

    if (session.screen === DECODER_SCREENS.HUB) {
        var captures = Array.isArray(notebook.autoscan) ? notebook.autoscan : [];
        var pending = 0;
        var i;
        for (i = 0; i < captures.length; i++) {
            if (captures[i] && captures[i].encrypted) pending++;
        }
        return {
            mode: 'decoder',
            status: 'DEŠIFRÁTOR',
            lines: [
                'Luštění zachycených',
                'šifrovaných signálů.',
                pending > 0 ? ('Ve frontě: ' + pending + ' zpr.') : 'Fronta prázdná.',
                'OK = brzy detail',
                '',
                ''
            ],
            focusLine: -1,
            footer: 'Zpět',
            buffer: ''
        };
    }

    return {
        mode: 'decoder',
        status: 'DEŠIFRÁTOR',
        lines: ['— připravuje se —', '', '', '', '', ''],
        focusLine: -1,
        footer: 'Zpět',
        buffer: ''
    };
}
