import i18next from 'i18next';

let initPromise = null;

async function loadLocaleFile(code) {
    var res = await fetch('src/locales/' + code + '.json');
    if (!res.ok) throw new Error('Failed to load locale: ' + code);
    return res.json();
}

export function getPatracLanguage() {
    return localStorage.getItem('patrac_lang') || document.documentElement.lang || 'cs';
}

export async function initPatracI18n() {
    if (initPromise) return initPromise;
    initPromise = (async function() {
        var lng = getPatracLanguage();
        var cs = await loadLocaleFile('cs');
        var resources = { cs: { translation: cs } };
        if (lng !== 'cs') {
            try {
                resources[lng] = { translation: await loadLocaleFile(lng) };
            } catch (e) {
                console.warn('patrac i18n fallback to cs', e);
                lng = 'cs';
            }
        }
        await i18next.init({
            lng: lng,
            fallbackLng: 'cs',
            resources: resources
        });
        document.documentElement.lang = lng;
        return i18next;
    })();
    return initPromise;
}

export function t(key, options) {
    return i18next.t(key, options);
}

/** Aplikuje data-i18n, data-i18n-placeholder a data-i18n-title v root elementu. */
export function applyI18nToDom(root) {
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach(function(el) {
        el.textContent = i18next.t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        el.placeholder = i18next.t(el.getAttribute('data-i18n-placeholder'));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        el.title = i18next.t(el.getAttribute('data-i18n-title'));
    });
}

export async function setPatracLanguage(code) {
    if (!i18next.isInitialized) await initPatracI18n();
    if (!i18next.hasResourceBundle(code, 'translation')) {
        i18next.addResourceBundle(code, 'translation', await loadLocaleFile(code), true, true);
    }
    localStorage.setItem('patrac_lang', code);
    await i18next.changeLanguage(code);
    document.documentElement.lang = code;
}

export { i18next };
