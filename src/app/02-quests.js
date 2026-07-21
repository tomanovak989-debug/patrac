/* PATRAC app chunk: 02-quests.js — do not reorder script tags in index.html */
var gameQuests = {
    'roxy': { id: 'roxy', char: 'Roxy', mapLabel: 'Útočiště', title: 'Nastav si útočiště', desc: 'Dojdi fyzicky na bezpečné místo a ulož tam souřadnice Útočiště.', req: [], time: '2h', latKey: 'point_roxy_lat', lngKey: 'point_roxy_lng', doneKey: 'quest_done_roxy' },
    'sef': { id: 'sef', char: 'Šéf', mapLabel: 'Zdroj vody', title: 'Najdi zdroj vody', desc: 'Bez vody nepřežijeme. Najdi potok nebo studánku a zaměř polohu.', req: [], time: '4h', latKey: 'point_sef_lat', lngKey: 'point_sef_lng', doneKey: 'quest_done_sef' },
    'herbert': { id: 'herbert', char: 'Herbert', mapLabel: 'Lesní sklad', title: 'Lesní shromaždiště', desc: 'Vyhledej kryté prostranství vhodné pro ukládání zdravotnických zásob.', req: [], time: '16h', latKey: 'point_herbert_lat', lngKey: 'point_herbert_lng', doneKey: 'quest_done_herbert' },
    'ino': { id: 'ino', char: 'Ino', mapLabel: 'Cvičiště', title: 'Najdi cvičiště', desc: 'Musíme najít rovnou lesní mýtinu vhodnou pro fyzický trénink.', req: [], time: '3h', latKey: 'point_ino_lat', lngKey: 'point_ino_lng', doneKey: 'quest_done_ino' },
    'adam': { id: 'adam', char: 'Adam', mapLabel: 'Rozhledna', title: 'Najdi rozhlednu', desc: 'Dojdi přímo k patě nejbližší vyhlídky a zapiš ji jako pozorovací bod.', req: [], time: '12h', latKey: 'point_adam_lat', lngKey: 'point_adam_lng', doneKey: 'quest_done_adam' }
};

/** Šablony náhodných rozkazů — generují se dynamicky od postav */
var RANDOM_QUEST_TEMPLATES = {
    roxy: [
        { id: 'rx_perimeter', title: 'Obchůzka perimetru', desc: 'Obejdi okolí útočiště po směru hodinových ručiček. Zkontroluj, zda není prolomená linie.', time: '1h', req: [] },
        { id: 'rx_supplies', title: 'Inventura zásob', desc: 'Projdi sklad a sepiš, co dochází. Bez pořádku padneš jako první.', time: '2h', req: [] },
        { id: 'rx_nightwatch', title: 'Noční hlídka', desc: 'Vydrž do úsvitu u východní strany tábora. Hlásíš každý podezřelý zvuk.', time: '6h', req: [] },
        { id: 'rx_escape', title: 'Kontrola únikových tras', desc: 'Projdi všechny naplánované únikové cesty a ověř, že jsou průchozí.', time: '3h', req: [], needsMap: true },
        { id: 'rx_rally', title: 'Svolání družiny', desc: 'Dojdi na mýtinu a ověř, že se tam vejde celá jednotka — záložní shromaždiště.', time: '2h', req: [], needsMap: true }
    ],
    sef: [
        { id: 'sf_rain', title: 'Sběr dešťové vody', desc: 'Postav improvizovaný sběrač vody z plachty a nádob. Musí fungovat.', time: '3h', req: [] },
        { id: 'sf_filter', title: 'Čištění filtru', desc: 'Vyčisti nebo vyměň filtrační materiál u zdroje vody. Bez vody jsme mrtví.', time: '2h', req: [] },
        { id: 'sf_firewood', title: 'Zásoba paliva', desc: 'Nasekej a uskladni dřevo na tři dny topení. Práce pro dříče.', time: '4h', req: [] },
        { id: 'sf_stream', title: 'Průzkum potoka', desc: 'Sleduj potok po proudu a najdi nejčistší místo pro čerpání.', time: '3h', req: [], needsMap: true },
        { id: 'sf_repair', title: 'Oprava odvodnění', desc: 'Oprav kanál nebo výpust, ať se nám nezaplave sklad při dešti.', time: '5h', req: [] }
    ],
    herbert: [
        { id: 'hb_herbs', title: 'Sběr bylin', desc: 'Najdi místo s hojností léčivých rostlin a nasbírej do sáčku.', time: '2h', req: [], needsMap: true },
        { id: 'hb_disinfect', title: 'Dezinfekce zóny', desc: 'Vyčisti a dezinfikuj pracovní plochu zdravotního koutku.', time: '1h', req: [] },
        { id: 'hb_medcheck', title: 'Kontrola lékárničky', desc: 'Projdi obsah lékárničky. Prošlé věci vyhoď, chybějící doplň.', time: '2h', req: [] },
        { id: 'hb_pine', title: 'Borovicové pryskyřice', desc: 'Najdi borovici a nasbírej pryskyřici — na dezinfekci a lepení.', time: '3h', req: [] },
        { id: 'hb_dry', title: 'Sušení obvazů', desc: 'Vysuš čisté látky na slunci a ulož do vodotěsného obalu.', time: '2h', req: [] }
    ],
    ino: [
        { id: 'in_run', title: 'Okruh vytrvalosti', desc: 'Uběhni minimálně 3 km v terénu. Tempo drž, flákání neberu.', time: '2h', req: [] },
        { id: 'in_track', title: 'Stopování stopy', desc: 'Najdi a sleduj čerstvou stopu zvěře nebo lidí — zapiš směr.', time: '3h', req: [], needsMap: true },
        { id: 'in_night', title: 'Noční průzkum', desc: 'Projdi okolí za tmy bez svítilny po vyznačené trase. Ostražitost je život.', time: '4h', req: [] },
        { id: 'in_climb', title: 'Terénní překážka', desc: 'Najdi místo s přirozenou překážkou (pařez, skála) a třikrát ji zdolaj.', time: '1h', req: [], needsMap: true },
        { id: 'in_cache', title: 'Skrýš zásob', desc: 'Založ tajnou skrýš mimo hlavní tábor — záloha pro nouzi.', time: '2h', req: [], needsMap: true }
    ],
    adam: [
        { id: 'ad_scout', title: 'Výzvěda z výšky', desc: 'Vylez na nejbližší kopec nebo strom a 10 minut pozoruj okolí.', time: '2h', req: [], needsMap: true },
        { id: 'ad_weather', title: 'Záznam počasí', desc: 'Sleduj oblohu a vítr 30 minut. Zapiš, co přijde — bouřka nebo klid.', time: '1h', req: [] },
        { id: 'ad_trail', title: 'Značení stezky', desc: 'Vyznač bezpečnou stezku páskou nebo kamínky od tábora k cíli.', time: '2h', req: [], needsMap: true },
        { id: 'ad_animal', title: 'Stopa zvěře', desc: 'Najdi místo, kde zvířata pijí nebo se pasou — důležité pro pasti i varování.', time: '3h', req: [], needsMap: true },
        { id: 'ad_map', title: 'Kresba okolí', desc: 'Projdi okolí a doplň do mentální mapy nové cesty, které jsme ještě nešli.', time: '2h', req: [] }
    ]
};

var RANDOM_QUEST_MIN_ACTIVE = 2;
var RANDOM_QUEST_MAX_ACTIVE = 5;

function getRandomQuestsList() {
    return getSafeJSON('random_quests_list');
}

function saveRandomQuestsList(list) {
    localStorage.setItem('random_quests_list', JSON.stringify(list));
    syncCommunityQuestsToCloud();
}

function isRandomQuestId(questId) {
    return questId && questId.substring(0, 7) === 'random_';
}

function getActiveRandomQuests() {
    var list = getRandomQuestsList();
    var active = [];
    for (var i = 0; i < list.length; i++) {
        var q = list[i];
        if (!isQuestDismissed(q.id) && !isQuestCompleted(q)) active.push(q);
    }
    return active;
}

function pickRandomTemplateForIssuer(issuerKey, usedTemplateIds) {
    var templates = RANDOM_QUEST_TEMPLATES[issuerKey] || [];
    var pool = [];
    for (var i = 0; i < templates.length; i++) {
        if (usedTemplateIds.indexOf(templates[i].id) === -1) pool.push(templates[i]);
    }
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function createRandomQuestInstance(issuerKey, template) {
    var randId = 'random_' + issuerKey + '_' + Math.floor(Math.random() * 9000 + 1000);
    return {
        id: randId,
        templateId: template.id,
        issuerKey: issuerKey,
        char: getAssignerCharByKey(issuerKey),
        isRandom: true,
        title: template.title,
        desc: template.desc,
        req: template.req ? template.req.slice() : [],
        time: template.time || '2h',
        needsMap: !!template.needsMap,
        latKey: 'point_' + randId + '_lat',
        lngKey: 'point_' + randId + '_lng',
        doneKey: 'quest_done_' + randId,
        generatedAt: new Date().toLocaleString('cs-CZ')
    };
}

function generateOneRandomQuest() {
    var issuers = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    var active = getActiveRandomQuests();
    var usedTemplates = [];
    var issuersInPlay = {};
    for (var a = 0; a < active.length; a++) {
        usedTemplates.push(active[a].templateId);
        issuersInPlay[active[a].issuerKey] = (issuersInPlay[active[a].issuerKey] || 0) + 1;
    }

    var shuffled = issuers.slice();
    for (var s = shuffled.length - 1; s > 0; s--) {
        var r = Math.floor(Math.random() * (s + 1));
        var tmp = shuffled[s]; shuffled[s] = shuffled[r]; shuffled[r] = tmp;
    }

    for (var i = 0; i < shuffled.length; i++) {
        if ((issuersInPlay[shuffled[i]] || 0) >= 2) continue;
        var template = pickRandomTemplateForIssuer(shuffled[i], usedTemplates);
        if (template) return createRandomQuestInstance(shuffled[i], template);
    }
    for (var j = 0; j < shuffled.length; j++) {
        var template2 = pickRandomTemplateForIssuer(shuffled[j], usedTemplates);
        if (template2) return createRandomQuestInstance(shuffled[j], template2);
    }
    return null;
}

function ensureRandomQuests() {
    var list = getRandomQuestsList();
    var active = getActiveRandomQuests();
    var added = false;
    while (active.length < RANDOM_QUEST_MIN_ACTIVE) {
        var nq = generateOneRandomQuest();
        if (!nq) break;
        list.push(nq);
        active.push(nq);
        added = true;
    }
    if (added) saveRandomQuestsList(list);
    return added;
}

function requestNewRandomQuest() {
    var active = getActiveRandomQuests();
    if (active.length >= RANDOM_QUEST_MAX_ACTIVE) {
        alert('Maximum ' + RANDOM_QUEST_MAX_ACTIVE + ' aktivních náhodných rozkazů. Splň nebo archivuj starší.');
        return;
    }
    var nq = generateOneRandomQuest();
    if (!nq) {
        alert('Momentálně nejsou dostupné nové šablony rozkazů.');
        return;
    }
    var list = getRandomQuestsList();
    list.push(nq);
    saveRandomQuestsList(list);
    renderQuestList();
    rebuildSelectOptions();
    alert('📻 Nový rozkaz od ' + nq.char + ': „' + nq.title + '“');
}

function confirmRandomQuestDone(questId) {
    var q = getQuestById(questId);
    if (!q || !isRandomQuestId(questId)) return;
    if (!isQuestUnlockedForPlayer(questId)) {
        alert('Nejdřív musí někdo z komunity spustit rozkaz.');
        return;
    }
    completeQuestAtLocation(questId);
}

function renderQuestActionButtons(questId, opts) {
    opts = opts || {};
    var html = '';
    var placed = hasStoredQuestCoords(questId);
    if (!placed) {
        html += '<button class="btn-accept" style="border-color:var(--xp-blue);color:var(--xp-blue); width:100%; margin-bottom:4px;" onclick="placeQuestAtGps(\'' + questId + '\')">📍 ZAMĚŘIT POZICI (GPS)</button>';
        if (canUseMapPlacement()) {
            html += '<button class="btn-accept" style="border-color:var(--muted-fg);color:var(--muted-fg); width:100%; margin-bottom:4px;" onclick="activatePlacementMode(\'' + questId + '\')">🗺️ ADMIN: UMÍSTIT NA MAPĚ</button>';
        }
    } else {
        html += '<button class="btn-accept" style="border-color:var(--text-green);color:var(--text-green); width:100%; margin-bottom:4px;" onclick="completeQuestAtLocation(\'' + questId + '\')">✅ POTVRDIT VÝKON NA MÍSTĚ</button>';
        if (canUseMapPlacement()) {
            html += '<button class="btn-accept" style="border-color:var(--danger-orange);color:var(--danger-orange); width:100%;" onclick="activateTargeting(\'' + questId + '\')">🗺️ ADMIN: SPLNIT Z MAPY</button>';
        }
    }
    return html;
}

function renderRandomQuestCard(q) {
    var isDone = isQuestCompleted(q);
    if (isDone) {
        var html = '<div class="quest-card quest-completed" id="card-done-' + q.id + '">';
        html += '<div class="quest-completed-badge">✅ SPLNĚNO: ' + q.char + ' — ' + q.title + '</div>';
        html += '<div class="quest-assigner-badge">📡 ' + getQuestAssignerBadge(q) + ' · náhodný rozkaz</div>';
        html += '<div class="quest-reward-note">🎁 Odměna připsána. Postava si pamatuje tvůj výkon.</div>';
        html += '<button class="btn-accept" style="width:100%; margin-top:4px; border-color:var(--muted-fg); color:var(--muted-fg);" onclick="dismissQuest(\'' + q.id + '\')">📁 ARCHIVOVAT</button>';
        html += '</div>';
        return html;
    }

    var isUnlocked = isQuestUnlockedForPlayer(q.id);
    var reqIcons = '';
    for (var r = 0; r < q.req.length; r++) {
        reqIcons += '<span class="logistics-badge">📦 ' + q.req[r] + '</span>';
    }

    var html = '<div class="quest-card" id="card-new-' + q.id + '" style="border-color:rgba(255,204,0,0.35);">';
    html += '<div class="quest-assigner-badge">📡 ' + getQuestAssignerBadge(q) + ' · <span style="color:var(--accent-gold);">náhodný rozkaz</span></div>';

    if (!isUnlocked) {
        if (isQuestMissedByPlayer(q.id)) {
            html += '<div class="logistics-error" style="display:block;margin:4px 0;">⏱ Lhůta vypršela — rank za tuto misi nezískáš.</div>';
        } else {
            html += '<div class="quest-header" style="color:var(--dim-fg);">📻 PŘÍCHOZÍ SIGNÁL (' + q.char + ')</div>';
            html += '<div style="font-size:var(--text-base);color:var(--muted-fg);margin:4px 0;">⏳ ' + q.time + '</div>';
            if (reqIcons) html += '<div style="margin:4px 0;">' + reqIcons + '</div>';
            html += '<div class="logistics-error" id="log-err-' + q.id + '"></div>';
            html += '<button class="btn-accept" onclick="attemptStartQuest(\'' + q.id + '\')">🔓 SPUSTIT PRO KOMUNITU</button>';
        }
    } else {
        html += '<div class="quest-header">📻 ' + q.char + ': ' + q.title + '</div>';
        html += renderCommunityQuestStatusHtml(q.id, q);
        html += '<div class="quest-body" style="margin-top:4px;">' + q.desc + '</div>';
        html += '<div class="countdown-timer">⏳ AKTIVNÍ (' + q.time + ')</div>';
        if (reqIcons) html += '<div style="margin:4px 0;">' + reqIcons + '</div>';
        html += '<div class="quest-footer" style="margin-top:5px;">';
        html += renderQuestActionButtons(q.id);
        html += '</div>';
    }
    html += '</div>';
    return html;
}

function renderRandomQuestsContent() {
    var list = getRandomQuestsList();
    var html = '<p style="font-size:var(--text-sm);color:var(--muted-fg);margin:0 0 8px 0;">Náhodné impulzní mise od Roxy, Šéfa, Herberta, Ina a Adama.</p>';
    html += '<button class="btn-accept" style="width:100%; margin-bottom:10px; border-color:var(--accent-gold); color:var(--accent-gold);" onclick="requestNewRandomQuest()">🎲 VYŽÁDAT NOVÝ ROZKAZ</button>';

    var shown = 0;
    for (var i = 0; i < list.length; i++) {
        var q = getQuestWithReq(list[i]);
        if (isQuestDismissed(q.id)) continue;
        html += renderRandomQuestCard(q);
        shown++;
    }
    if (shown === 0) {
        html += '<p style="font-size:var(--text-sm);color:var(--faint-fg);text-align:center;margin-bottom:8px;">Žádné náhodné rozkazy. Stiskni tlačítko výše.</p>';
    }
    return html;
}

function renderCustomQuestsContent() {
    var customQuests = getSafeJSON('custom_quests_list');
    var html = '';
    var shown = 0;
    for (var j = 0; j < customQuests.length; j++) {
        var q = getQuestWithReq(customQuests[j]);
        if (gameQuests[q.id]) continue;
        if (isQuestDismissed(q.id)) continue;
        shown++;

        var isDone = localStorage.getItem(q.doneKey || ('quest_done_' + q.id)) === 'true';

        if (isDone) {
            html += '<div class="quest-card quest-completed" id="card-done-' + q.id + '">';
            html += '<div class="quest-completed-badge">✅ SPLNĚNO: ' + (q.char ? q.char + ' — ' : '') + q.title + '</div>';
            html += '<div class="quest-assigner-badge">📡 ' + getQuestAssignerBadge(q) + '</div>';
            html += '<div class="quest-reward-note">🎁 Odměna byla připsána do inventáře. Mise zapsána do profilu operativce.</div>';
            html += '<button class="btn-accept" style="width:100%; margin-top:4px; border-color:var(--muted-fg); color:var(--muted-fg);" onclick="dismissQuest(\'' + q.id + '\')">📁 ARCHIVOVAT ÚKOL</button>';
            html += '</div>';
            continue;
        }

        var isUnlocked = isQuestUnlockedForPlayer(q.id);
        var reqIcons = "";

        for (var r = 0; r < q.req.length; r++) {
            var reqItem = q.req[r];
            var icon = "📦";
            if (reqItem.toLowerCase().indexOf('seker') !== -1) icon = "🪓";
            if (reqItem.toLowerCase().indexOf('spac') !== -1) icon = "🛌";
            if (reqItem.toLowerCase().indexOf('lan') !== -1) icon = "🪢";
            reqIcons += '<span class="logistics-badge">' + icon + ' ' + reqItem + '</span>';
        }

        html += '<div class="quest-card" id="card-new-' + q.id + '">';
        html += '<div class="quest-assigner-badge">📡 Zadavatel: ' + getQuestAssignerBadge(q) + ' · vlastní</div>';

        if (!isUnlocked) {
            if (isQuestMissedByPlayer(q.id)) {
                html += '<div class="logistics-error" style="display:block;margin:4px 0;">⏱ Lhůta vypršela — rank za tuto misi nezískáš.</div>';
            } else {
                html += '<div class="quest-header" style="color:var(--dim-fg);">🔒 NEODHALENÁ OPERACE (' + (q.char || 'Mise') + ')</div>';
                if (reqIcons !== "") {
                    html += '<div style="margin: 5px 0;">' + reqIcons + '</div>';
                } else {
                    html += '<div style="margin: 5px 0; font-size:var(--text-sm); color:var(--muted-fg);">(Nevyžaduje žádné specifické vybavení)</div>';
                }
                html += '<div style="font-size:var(--text-base); color:var(--subtle-fg); margin-bottom: 4px;">⏳ Předpokládaná doba: ' + q.time + '</div>';
                html += '<div class="logistics-error" id="log-err-' + q.id + '"></div>';
                html += '<button class="btn-accept" onclick="attemptStartQuest(\'' + q.id + '\')">🔓 SPUSTIT PRO KOMUNITU</button>';
            }
        } else {
            html += '<div class="quest-header">📡 ' + (q.char ? q.char + ': ' : '') + q.title + '</div>';
            html += renderCommunityQuestStatusHtml(q.id, q);
            html += '<div class="quest-body" style="margin-top:4px;">' + q.desc + '</div>';
            html += '<div class="countdown-timer">⏳ LIMIT OPERACE SPUŠTĚN (' + q.time + ')</div>';
            html += '<div class="quest-footer" style="margin-top:5px;">' + renderQuestActionButtons(q.id) + '</div>';
        }

        html += '</div>';
    }
    if (shown > 0) {
        html = '<div class="quest-section-title" style="margin-top:12px;font-size:var(--text-sm);">📋 VLASTNÍ ROZKAZY</div>' + html;
    }
    return html;
}

function renderActiveOrdersContent() {
    return renderRandomQuestsContent() + renderCustomQuestsContent();
}

function renderStoryPositionsContent() {
    var ids = getStoryQuestIds();
    var html = '';
    for (var i = 0; i < ids.length; i++) {
        html += renderStoryPositionCardHtml(ids[i]);
    }
    return html;
}

var QUEST_SECTION_DEFAULTS = {
    'active-orders': true,
    'custom-form': false,
    'story-positions': true
};

function getQuestSectionsState() {
    try {
        var raw = localStorage.getItem('quest_sections_state');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

function saveQuestSectionsState(state) {
    localStorage.setItem('quest_sections_state', JSON.stringify(state));
}

function toggleQuestSection(sectionId) {
    var body = document.getElementById('section-' + sectionId);
    var btn = document.getElementById('toggle-' + sectionId);
    if (!body || !btn) return;
    var isOpen = body.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    var state = getQuestSectionsState();
    state[sectionId] = isOpen;
    saveQuestSectionsState(state);
}

function initQuestSections() {
    var state = getQuestSectionsState();
    var keys = ['active-orders', 'custom-form', 'story-positions'];
    for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var open = state.hasOwnProperty(id) ? state[id] : QUEST_SECTION_DEFAULTS[id];
        var body = document.getElementById('section-' + id);
        var btn = document.getElementById('toggle-' + id);
        if (body) body.classList.toggle('open', open);
        if (btn) btn.classList.toggle('open', open);
    }
}

/* ── TIER / RANK SYSTÉM ── */
function emptyIssuerStats() {
    return { roxy: 0, sef: 0, herbert: 0, ino: 0, adam: 0, klan: 0 };
}

function getTierThresholds() {
    return [16, 61, 151, 251];
}

function getMissionsNeededForNextTier(currentCount, currentTier) {
    if (currentTier >= 5) return null;
    var thresholds = getTierThresholds();
    var nextThreshold = thresholds[currentTier - 1];
    var needed = nextThreshold - currentCount;
    if (needed <= 0) return 1;
    return Math.ceil(needed * 10) / 10;
}

function formatMissionsNeededLabel(needed) {
    if (needed == null) return '';
    var rounded = Math.ceil(needed * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
        return String(Math.round(rounded));
    }
    return rounded.toFixed(1).replace('.', ',');
}

function buildNextRankHint(currentCount, currentTier, rankNames, options) {
    options = options || {};
    if (currentTier >= 5) {
        return 'Nejvyšší hodnost dosažena';
    }
    var needed = getMissionsNeededForNextTier(currentCount, currentTier);
    var nextName = rankNames[currentTier];
    var label = formatMissionsNeededLabel(needed);
    var unit = options.unitLabel || 'misí';
    return 'Další hodnost ' + nextName + ' za ' + label + ' ' + unit;
}

function getPlayerRankProgress(profile) {
    var tier = getEffectivePlayerTier(profile);
    var count = (tier >= 4) ? (profile.globalMissions || 0) : (profile.localMissions || 0);
    return buildNextRankHint(count, tier, PLAYER_RANK_NAMES, { unitLabel: 'misí' });
}

function getTierFromMissionCount(count) {
    if (count >= 251) return 5;
    if (count >= 151) return 4;
    if (count >= 61) return 3;
    if (count >= 16) return 2;
    return 1;
}

function getTierSymbols(tier) {
    if (tier <= 3) {
        var s = '';
        for (var i = 0; i < tier; i++) s += '🔸';
        return s;
    }
    if (tier === 4) return '⭐⭐⭐⭐';
    return '⭐⭐⭐⭐⭐';
}

function getSpecialization(issuerStats) {
    var best = null, bestCount = 0;
    for (var k in issuerStats) {
        if (k === 'klan') continue;
        if (issuerStats[k] > bestCount) { bestCount = issuerStats[k]; best = k; }
    }
    return (best && bestCount > 0 && SPECIALIZATION_MAP[best]) ? SPECIALIZATION_MAP[best] : null;
}

function sumIssuerStats(stats) {
    var total = 0;
    if (!stats) return 0;
    for (var k in stats) total += stats[k] || 0;
    return total;
}

function formatIssuerStatsHtml(stats, totalMissions) {
    if (!stats) return '';
    var chips = [];
    for (var i = 0; i < ISSUER_ORDER.length; i++) {
        var key = ISSUER_ORDER[i];
        var count = stats[key] || 0;
        if (count > 0) chips.push((ISSUER_LABELS[key] || key) + ': ' + count);
    }
    if (chips.length === 0) return '<span style="color:var(--faint-fg);">Zatím žádné specializace</span>';
    var total = totalMissions != null ? totalMissions : sumIssuerStats(stats);
    var tier = getTierFromMissionCount(total);
    var lead = getSpecialization(stats);
    var html = chips.join(' · ');
    if (lead) {
        if (tier >= 5) {
            html += '<div class="specialization-line" style="margin-top:2px;">🏆 ' + lead + '</div>';
        } else {
            html += '<div style="margin-top:2px; color:var(--muted-fg);">Směr → ' + lead + '</div>';
        }
    }
    return html;
}

function getQuestAssignerBadge(quest) {
    var key = getIssuerKey(quest);
    var label = ISSUER_LABELS[key] || quest.char || 'Mise';
    var spec = SPECIALIZATION_MAP[key];
    return spec ? (label + ' · ' + spec) : label;
}

function getAssignerCharByKey(key) {
    for (var i = 0; i < QUEST_ASSIGNERS.length; i++) {
        if (QUEST_ASSIGNERS[i].key === key) return QUEST_ASSIGNERS[i].char;
    }
    return 'Klan';
}

function getEffectivePlayerTier(profile) {
    var localTier = getTierFromMissionCount(profile.localMissions || 0);
    var globalTier = getTierFromMissionCount(profile.globalMissions || 0);
    if (globalTier >= 5) return 5;
    if (globalTier >= 4) return Math.max(localTier, 4);
    return localTier;
}

function getPlayerRankDisplay(profile) {
    var tier = getEffectivePlayerTier(profile);
    var name = PLAYER_RANK_NAMES[tier - 1];
    var symbols = getTierSymbols(tier);
    var result = { tier: tier, name: name, symbols: symbols, label: name + ' [' + symbols + ']' };
    if (tier === 5) {
        var spec = getSpecialization(profile.globalIssuerStats || emptyIssuerStats());
        if (spec) result.specialization = spec;
    }
    return result;
}

function getTalismanStatusDisplay(item) {
    if (item.itemType === 'tool') return null;
    var mc = item.missionCount || 0;
    var tier = getTierFromMissionCount(mc);
    var result = {
        tier: tier,
        name: TALISMAN_STATUS_NAMES[tier - 1],
        symbols: getTierSymbols(tier),
        label: TALISMAN_STATUS_NAMES[tier - 1] + ' [' + getTierSymbols(tier) + ']'
    };
    if (tier === 5) {
        var spec = getSpecialization(item.issuerStats || emptyIssuerStats());
        if (spec) result.specialization = spec;
    }
    return result;
}

/* ── PROFIL HRÁČE ── */
function getPlayerProfile() {
    try {
        var raw = localStorage.getItem('player_profile');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
        currentClan: localStorage.getItem('com_name') || '',
        localMissions: 0,
        globalMissions: 0,
        localIssuerStats: emptyIssuerStats(),
        globalIssuerStats: emptyIssuerStats(),
        chronicle: [],
        missionLog: [],
        migrated: false
    };
}

function savePlayerProfile(profile) {
    localStorage.setItem('player_profile', JSON.stringify(profile));
}

function migrateLegacyData() {
    var profile = getPlayerProfile();
    if (profile.migrated) return;

    var count = 0;
    var stats = emptyIssuerStats();
    for (var k in gameQuests) {
        if (localStorage.getItem('quest_done_' + k) === 'true') {
            count++;
            stats[k]++;
        }
    }
    var customQuests = getSafeJSON('custom_quests_list');
    for (var i = 0; i < customQuests.length; i++) {
        if (localStorage.getItem('quest_done_' + customQuests[i].id) === 'true') {
            count++;
            stats.klan++;
        }
    }

    if (count > 0 && profile.globalMissions === 0) {
        profile.localMissions = count;
        profile.globalMissions = count;
        profile.localIssuerStats = stats;
        profile.globalIssuerStats = JSON.parse(JSON.stringify(stats));
    }

    if (!profile.missionLog || profile.missionLog.length === 0) {
        profile.missionLog = [];
        for (var k2 in gameQuests) {
            if (localStorage.getItem('quest_done_' + k2) === 'true') {
                profile.missionLog.push({
                    questId: k2, title: gameQuests[k2].title, char: gameQuests[k2].char,
                    date: '(migrace)'
                });
            }
        }
        for (var c = 0; c < customQuests.length; c++) {
            if (localStorage.getItem('quest_done_' + customQuests[c].id) === 'true') {
                profile.missionLog.push({
                    questId: customQuests[c].id, title: customQuests[c].title, char: customQuests[c].char,
                    date: '(migrace)'
                });
            }
        }
    }

    backfillItemMissionStats();
    migrateToolQuestBindings();
    migrateCustomQuestIssuers();
    if (!profile.currentClan) profile.currentClan = localStorage.getItem('com_name') || '';
    profile.migrated = true;
    savePlayerProfile(profile);
}

function getIssuerKey(quest) {
    if (quest.issuerKey) return quest.issuerKey;
    if (gameQuests[quest.id]) return quest.id;
    var charToKey = { 'Roxy': 'roxy', 'Šéf': 'sef', 'Herbert': 'herbert', 'Ino': 'ino', 'Adam': 'adam' };
    if (quest.char && charToKey[quest.char]) return charToKey[quest.char];
    return 'klan';
}

function getQuestById(questId) {
    var q = null;
    if (gameQuests[questId]) q = gameQuests[questId];
    else {
        var randomQuests = getRandomQuestsList();
        for (var r = 0; r < randomQuests.length; r++) {
            if (randomQuests[r].id === questId) { q = randomQuests[r]; break; }
        }
    }
    if (!q) {
        var customQuests = getSafeJSON('custom_quests_list');
        for (var i = 0; i < customQuests.length; i++) {
            if (customQuests[i].id === questId) { q = customQuests[i]; break; }
        }
    }
    if (!q) return null;
    q = getQuestWithReq(q);
    if (window.patracTranslateQuest) q = window.patracTranslateQuest(q);
    return q;
}

function getQuestReqOverrides() {
    try {
        var raw = localStorage.getItem('quest_req_overrides');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

function getQuestWithReq(q) {
    var overrides = getQuestReqOverrides();
    var extra = overrides[q.id] || [];
    var mergedReq = (q.req || []).slice();
    for (var i = 0; i < extra.length; i++) {
        var dup = false;
        for (var j = 0; j < mergedReq.length; j++) {
            if (mergedReq[j].toLowerCase() === extra[i].toLowerCase()) { dup = true; break; }
        }
        if (!dup) mergedReq.push(extra[i]);
    }
    var copy = {};
    for (var k in q) copy[k] = q[k];
    copy.req = mergedReq;
    return copy;
}

function parseReqList(str) {
    if (!str || !str.trim()) return [];
    return str.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

function addQuestRequirement(questId, itemName) {
    var overrides = getQuestReqOverrides();
    if (!overrides[questId]) overrides[questId] = [];
    var lower = itemName.toLowerCase();
    var exists = false;
    for (var i = 0; i < overrides[questId].length; i++) {
        if (overrides[questId][i].toLowerCase() === lower) exists = true;
    }
    if (!exists) overrides[questId].push(itemName);
    localStorage.setItem('quest_req_overrides', JSON.stringify(overrides));
}

function getQuestBindLabel(questId) {
    if (!questId || questId === 'none') return '';
    var q = getQuestById(questId);
    return q ? ((q.char ? q.char + ': ' : '') + q.title) : questId;
}

function getDismissedQuests() {
    return getSafeJSON('dismissed_quests');
}

function isQuestDismissed(questId) {
    return getDismissedQuests().indexOf(questId) !== -1;
}

function recordMissionComplete(quest) {
    var profile = getPlayerProfile();
    var issuerKey = getIssuerKey(quest);

    profile.localMissions = (profile.localMissions || 0) + 1;
    profile.globalMissions = (profile.globalMissions || 0) + 1;
    if (!profile.localIssuerStats) profile.localIssuerStats = emptyIssuerStats();
    if (!profile.globalIssuerStats) profile.globalIssuerStats = emptyIssuerStats();
    profile.localIssuerStats[issuerKey] = (profile.localIssuerStats[issuerKey] || 0) + 1;
    profile.globalIssuerStats[issuerKey] = (profile.globalIssuerStats[issuerKey] || 0) + 1;

    if (!profile.missionLog) profile.missionLog = [];
    profile.missionLog.unshift({
        questId: quest.id,
        title: quest.title,
        char: quest.char || 'Mise',
        date: new Date().toLocaleString('cs-CZ')
    });

    savePlayerProfile(profile);
    syncCurrentAccountMissionStats();
    incrementBoundItemMissions(quest.id, issuerKey);
    incrementCarriedTalismanMissions(quest.id, issuerKey);
    absorbMissionToBoundItems(quest);
    absorbMissionToCarriedTalismans(quest);
    localStorage.setItem(quest.doneKey || ('quest_done_' + quest.id), 'true');
    syncSessionUserToStorage();
    updateStatsHud();
}

/** Talisman na zádech „zažije" misi — historie zůstává navždy. */
function incrementCarriedTalismanMissions(questId, issuerKey) {
    var items = getCurrentPersonalItems().slice();
    var changed = false;
    for (var i = 0; i < items.length; i++) {
        if (items[i].itemType === 'tool') continue;
        if (items[i].locked === true) continue;
        if (items[i].bind === questId) continue;
        items[i].missionCount = (items[i].missionCount || 0) + 1;
        if (!items[i].issuerStats) items[i].issuerStats = emptyIssuerStats();
        items[i].issuerStats[issuerKey] = (items[i].issuerStats[issuerKey] || 0) + 1;
        changed = true;
    }
    if (changed) saveCurrentPersonalItems(items);
}

function absorbMissionToCarriedTalismans(quest) {
    var loreSnippet = (quest.char || 'Mise') + ': ' + quest.title;
    var items = getCurrentPersonalItems().slice();
    var changed = false;
    for (var i = 0; i < items.length; i++) {
        if (items[i].itemType === 'tool') continue;
        if (items[i].locked === true) continue;
        var existing = items[i].lore || '';
        if (existing.indexOf(loreSnippet) === -1) {
            items[i].lore = existing ? existing + ' | ' + loreSnippet : loreSnippet;
            appendItemHistory(items[i], { type: 'mission', detail: loreSnippet });
            changed = true;
        }
    }
    if (changed) saveCurrentPersonalItems(items);
}

function absorbMissionToBoundItems(quest) {
    var loreSnippet = (quest.char || 'Mise') + ': ' + quest.title;
    var comRaw = getCommunityItemsRaw().slice();
    var comChanged = false;
    for (var i = 0; i < comRaw.length; i++) {
        if (comRaw[i].bind === quest.id) {
            var existing = comRaw[i].lore || '';
            if (existing.indexOf(loreSnippet) === -1) {
                comRaw[i].lore = existing ? existing + ' | ' + loreSnippet : loreSnippet;
                appendItemHistory(comRaw[i], { type: 'mission', detail: loreSnippet });
                comChanged = true;
            }
        }
    }
    if (comChanged) saveCommunityItemsRaw(comRaw);

    var persItems = getCurrentPersonalItems().slice();
    var persChanged = false;
    for (var j = 0; j < persItems.length; j++) {
        if (persItems[j].bind === quest.id) {
            var ex2 = persItems[j].lore || '';
            if (ex2.indexOf(loreSnippet) === -1) {
                persItems[j].lore = ex2 ? ex2 + ' | ' + loreSnippet : loreSnippet;
                appendItemHistory(persItems[j], { type: 'mission', detail: loreSnippet });
                persChanged = true;
            }
        }
    }
    if (persChanged) saveCurrentPersonalItems(persItems);
}

function backfillItemMissionStats() {
    if (localStorage.getItem('items_stats_migrated') === 'true') return;
    ['items_community', 'items_personal'].forEach(function(key) {
        var items = getSafeJSON(key);
        var changed = false;
        for (var i = 0; i < items.length; i++) {
            if (!items[i].issuerStats) { items[i].issuerStats = emptyIssuerStats(); changed = true; }
            if (items[i].missionCount === undefined) { items[i].missionCount = 0; changed = true; }
            if (!items[i].itemType) { items[i].itemType = 'talisman'; changed = true; }
            if (items[i].itemType === 'tool' && items[i].locked) { items[i].locked = false; changed = true; }
            if (items[i].bind && items[i].bind !== 'none') {
                var q = getQuestById(items[i].bind);
                if (q && localStorage.getItem(q.doneKey || ('quest_done_' + q.id)) === 'true') {
                    var ik = getIssuerKey(q);
                    if ((items[i].missionCount || 0) === 0) {
                        items[i].missionCount = 1;
                        items[i].issuerStats[ik] = (items[i].issuerStats[ik] || 0) + 1;
                        changed = true;
                    }
                }
            }
        }
        if (changed) localStorage.setItem(key, JSON.stringify(items));
    });
    localStorage.setItem('items_stats_migrated', 'true');
}

function migrateToolQuestBindings() {
    if (localStorage.getItem('tool_bind_migrated') === 'true') return;
    ['items_community', 'items_personal'].forEach(function(key) {
        var items = getSafeJSON(key);
        for (var i = 0; i < items.length; i++) {
            if (items[i].itemType === 'tool' && items[i].bind && items[i].bind !== 'none') {
                addQuestRequirement(items[i].bind, items[i].name);
            }
        }
    });
    localStorage.setItem('tool_bind_migrated', 'true');
}

function migrateCustomQuestIssuers() {
    if (localStorage.getItem('custom_issuer_migrated') === 'true') return;
    var customQuests = getSafeJSON('custom_quests_list');
    var changed = false;
    for (var i = 0; i < customQuests.length; i++) {
        if (!customQuests[i].issuerKey) {
            customQuests[i].issuerKey = getIssuerKey(customQuests[i]);
            if (customQuests[i].char === 'Klan' && customQuests[i].issuerKey === 'klan') {
                customQuests[i].issuerKey = 'ino';
                customQuests[i].char = 'Ino';
            }
            changed = true;
        }
    }
    if (changed) localStorage.setItem('custom_quests_list', JSON.stringify(customQuests));
    localStorage.setItem('custom_issuer_migrated', 'true');
}

function incrementBoundItemMissions(questId, issuerKey) {
    ['items_community', 'items_personal'].forEach(function(key) {
        var items = getSafeJSON(key);
        var changed = false;
        for (var i = 0; i < items.length; i++) {
            if (items[i].itemType === 'tool') continue;
            if (items[i].bind === questId) {
                items[i].missionCount = (items[i].missionCount || 0) + 1;
                if (!items[i].issuerStats) items[i].issuerStats = emptyIssuerStats();
                items[i].issuerStats[issuerKey] = (items[i].issuerStats[issuerKey] || 0) + 1;
                changed = true;
            }
        }
        if (changed) localStorage.setItem(key, JSON.stringify(items));
    });
}

function dismissQuest(questId) {
    if (gameQuests[questId]) {
        alert('Prvotní poziční úkoly nelze archivovat — body zůstávají součástí sektoru.');
        return;
    }
    var dismissed = getDismissedQuests();
    if (dismissed.indexOf(questId) === -1) dismissed.push(questId);
    localStorage.setItem('dismissed_quests', JSON.stringify(dismissed));
    if (!gameQuests[questId] && mapMarkerRegistry[questId] && mapPointsLayer) {
        mapPointsLayer.removeLayer(mapMarkerRegistry[questId]);
        delete mapMarkerRegistry[questId];
    }
    renderQuestList();
    rebuildCustomLocLinkSelect();
    reloadAllMapPoints();
    syncCommunityQuestsToCloud();
}

function hasStoredQuestCoords(questId) {
    var lat = localStorage.getItem('point_' + questId + '_lat');
    var lng = localStorage.getItem('point_' + questId + '_lng');
    return !!(lat && lng);
}

/** Prvotní poziční úkoly: bod vždy na mapě. Náhodné/vlastní: skrýt po archivaci. */
function shouldShowQuestPointOnMap(questId) {
    if (!hasStoredQuestCoords(questId)) return false;
    if (gameQuests[questId]) return true;
    return !isQuestDismissed(questId);
}

function checkClanOnLaunch() {
    var comName = localStorage.getItem('com_name') || '';
    var profile = getPlayerProfile();
    if (profile.currentClan && comName && comName !== profile.currentClan) {
        if (!profile.chronicle) profile.chronicle = [];
        profile.chronicle.unshift({
            from: profile.currentClan,
            to: comName,
            date: new Date().toLocaleString('cs-CZ'),
            missionsInClan: profile.localMissions || 0
        });
        profile.currentClan = comName;
        profile.localMissions = 0;
        profile.localIssuerStats = emptyIssuerStats();
        savePlayerProfile(profile);
    } else if (!profile.currentClan && comName) {
        profile.currentClan = comName;
        savePlayerProfile(profile);
    }
}

function renderChronicle() {
    var el = document.getElementById('chronicle-list');
    if (!el) return;
    var profile = getPlayerProfile();
    if (!profile.chronicle || profile.chronicle.length === 0) {
        el.innerHTML = '<p style="font-size:var(--text-sm); color:var(--panel-subtle); margin:0;">Zatím žádné záznamy o přestupu...</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < profile.chronicle.length; i++) {
        var c = profile.chronicle[i];
        html += '<div class="chronicle-entry">📜 ' + c.date + ': Opustil <strong>' + c.from + '</strong> (' + c.missionsInClan + ' misí) → vstoupil do <strong>' + c.to + '</strong></div>';
    }
    el.innerHTML = html;
}

function renderMissionLog() {
    var el = document.getElementById('mission-log-list');
    if (!el) return;
    var profile = getPlayerProfile();
    if (!profile.missionLog || profile.missionLog.length === 0) {
        el.innerHTML = '<p style="font-size:var(--text-sm); color:var(--panel-subtle); margin:0;">Mise se zapisují do profilu po splnění...</p>';
        return;
    }
    var html = '';
    var limit = Math.min(profile.missionLog.length, 20);
    for (var i = 0; i < limit; i++) {
        var m = profile.missionLog[i];
        var q = m.questId ? getQuestById(m.questId) : null;
        var title = q ? q.title : (m.title || '—');
        var charLabel = q ? (q.char || m.char) : (m.char || 'Mise');
        html += '<div class="mission-log-entry">☣️ ' + charLabel + ': ' + title + ' <span style="color:var(--muted-fg);">(' + m.date + ')</span></div>';
    }
    el.innerHTML = html;
}

/* ── UTIL ── */
function getSafeJSON(key) {
    try {
        var data = localStorage.getItem(key);
        if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
}

function getSafeItems(key) {
    var data = getSafeJSON(key);
    return Array.isArray(data) ? data : [];
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        return false;
    }
}

var PATRAC_ACCOUNTS_MAX_BYTES = 100000;
var PATRAC_AVATAR_MAX_BYTES = 120000;

var PHOTO_PLACE_MAX_PX = 2560;
var PHOTO_PLACE_QUALITY = 0.92;
var PHOTO_AVATAR_MAX_PX = 768;
var PHOTO_AVATAR_QUALITY = 0.9;
var PHOTO_ITEM_MAX_PX = 1600;
var PHOTO_ITEM_QUALITY = 0.9;

function storageByteLength(str) {
    if (!str) return 0;
    try { return new Blob([str]).size; } catch (e) { return (str.length || 0) * 2; }
}

function getLocalStorageUsageBytes() {
    var total = 0;
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            total += storageByteLength(k) + storageByteLength(localStorage.getItem(k));
        }
    } catch (e) {}
    return total;
}

function getPatracAvatarKey(userId) {
    return 'patrac_avatar_' + userId;
}

function getPatracWearKey(userId) {
    return 'patrac_wear_' + userId;
}

function slimWearItem(item) {
    if (!item || !item.name) return null;
    var img = '';
    if (item.img && storageByteLength(item.img) <= 12000) img = item.img;
    return { name: String(item.name).slice(0, 48), img: img };
}

function syncCurrentAccountWearLoadout() {
    var session = getActiveInventoryUserId();
    if (!session) return;
    var items = getCurrentPersonalItems();
    var wear = [];
    for (var i = 0; i < items.length; i++) {
        var slim = slimWearItem(items[i]);
        if (slim) wear.push(slim);
    }
    try { safeLocalStorageSet(getPatracWearKey(session), JSON.stringify(wear)); } catch (e) { console.warn(e); }
    pushPlayerCloudAsync(function(mod) {
        return mod.syncPlayerWear(session, wear);
    });
}

function escapeHtmlText(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getMemberWearLoadout(userId) {
    if (!userId) return [];
    try {
        var wearRaw = localStorage.getItem(getPatracWearKey(userId));
        if (wearRaw) {
            var cached = JSON.parse(wearRaw);
            if (Array.isArray(cached) && cached.length) return cached;
        }
    } catch (e) {}
    var personal = (userId === getActiveInventoryUserId())
        ? getCurrentPersonalItems()
        : getUserPersonalItems(userId);
    var out = [];
    for (var i = 0; i < personal.length; i++) {
        var slim = slimWearItem(personal[i]);
        if (slim) out.push(slim);
    }
    return out;
}

function normalizeWearName(name) {
    return String(name || '').trim().toLowerCase();
}

function findWearItemByName(loadout, nameNorm) {
    for (var i = 0; i < loadout.length; i++) {
        if (normalizeWearName(loadout[i].name) === nameNorm) return loadout[i];
    }
    return null;
}

function getCommunitySharedWearItems(comCode) {
    var members = getCommunityMemberAccounts(comCode);
    if (members.length === 0) return [];
    var loadouts = members.map(function(m) { return getMemberWearLoadout(m.userId); });
    var memberCount = loadouts.length;
    var byName = {};

    for (var m = 0; m < loadouts.length; m++) {
        var seenInMember = {};
        for (var i = 0; i < loadouts[m].length; i++) {
            var item = loadouts[m][i];
            if (!item || !item.name) continue;
            var nameNorm = normalizeWearName(item.name);
            if (!nameNorm || seenInMember[nameNorm]) continue;
            seenInMember[nameNorm] = true;
            if (!byName[nameNorm]) {
                byName[nameNorm] = { name: item.name, img: item.img || '', count: 0 };
            }
            byName[nameNorm].count++;
            if (!byName[nameNorm].img && item.img) byName[nameNorm].img = item.img;
        }
    }

    var shared = [];
    for (var key in byName) {
        if (!Object.prototype.hasOwnProperty.call(byName, key)) continue;
        var entry = byName[key];
        shared.push({
            name: entry.name,
            img: entry.img,
            wornByAll: entry.count >= memberCount
        });
    }
    shared.sort(function(a, b) { return String(a.name).localeCompare(String(b.name), 'cs'); });
    return shared;
}

function buildWearRowHtml(items, extraClass, options) {
    options = options || {};
    if (!items || items.length === 0) {
        return '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Nic na sobě</span>';
    }

    var compactThreshold = options.compactThreshold != null ? options.compactThreshold : 20;
    if (options.compact && items.length >= compactThreshold) {
        var listHtml = '<div class="wear-compact-list">';
        for (var c = 0; c < items.length; c++) {
            var cItem = items[c];
            var cName = cItem.name || '—';
            var cCls = cItem.wornByAll ? 'wear-all-shared' : '';
            if (c > 0) listHtml += '<span style="color:var(--panel-subtle);"> · </span>';
            listHtml += '<span class="' + cCls + '" title="' + cName + (cItem.wornByAll ? ' (mají všichni)' : '') + '">' + cName + '</span>';
        }
        listHtml += '</div>';
        return listHtml;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var cls = 'wear-item-chip' + (extraClass ? ' ' + extraClass : '');
        if (item.wornByAll) cls += ' is-shared';
        var avHtml = item.img ? '<img src="' + item.img + '">' : '📦';
        var label = (item.name || '').split(' ')[0];
        if (label.length > 8) label = label.slice(0, 7) + '…';
        html += '<div class="' + cls + '" title="' + (item.name || '') + (item.wornByAll ? ' — mají všichni' : '') + '">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += label + '</div>';
    }
    return html;
}

function buildCommunityMembersListHtml(members, activeUserId, founderId) {
    if (!members || members.length === 0) {
        return '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zatím žádní pátrači</span>';
    }
    var html = '';
    for (var m = 0; m < members.length; m++) {
        var mem = members[m];
        var av = localStorage.getItem(getPatracAvatarKey(mem.userId)) || '';
        var avHtml = av ? '<img src="' + av + '">' : '—';
        var rowCls = 'community-member-row';
        if (mem.userId === activeUserId) rowCls += ' is-active is-self';
        if (mem.userId === founderId) rowCls += ' is-founder';
        var displayName = mem.account.playerName
            || localStorage.getItem('patrac_member_name_' + mem.userId)
            || mem.userId;
        var label = displayName.split(' ')[0];
        var desc = localStorage.getItem(getPatracDescKey(mem.userId)) || '';
        var wear = getMemberWearLoadout(mem.userId);
        var rowId = mem.userId === activeUserId ? ' id="community-member-active"' : '';
        html += '<div class="' + rowCls + '"' + rowId + ' data-user-id="' + mem.userId + '" title="' + escapeHtmlText(mem.account.playerName || '') + (desc ? '\n' + desc : '') + '">';
        html += '<div class="community-member-row-profile">';
        html += '<div class="avatar-box">' + avHtml + '</div>';
        html += '<div class="community-member-row-text">';
        html += '<span class="community-member-row-name">' + escapeHtmlText(label) + '</span>';
        if (desc) {
            html += '<div class="community-member-row-desc">' + escapeHtmlText(desc) + '</div>';
        }
        html += '</div>';
        html += '</div>';
        html += '<div class="community-member-row-wear">';
        html += buildWearRowHtml(wear, '');
        html += '</div></div>';
    }
    return html;
}

function refreshCommunityMembersPanel(scrollToActive) {
    refreshCommunityMembersFromCloud(scrollToActive);
}

function normalizeComCodeValue(comCode) {
    return String(comCode || '').trim().toUpperCase();
}

function accountBelongsToCommunity(userId, comCode, accounts) {
    comCode = normalizeComCodeValue(comCode);
    if (!comCode || !userId) return false;
    accounts = accounts || getPatracAccounts();
    var acc = accounts[userId];
    if (!acc) return true;
    return normalizeComCodeValue(acc.comCode) === comCode;
}

function sanitizeCommunityMembers(comCode) {
    comCode = normalizeComCodeValue(comCode);
    if (!comCode) return;
    var comms = getPatracCommunities();
    var comm = comms[comCode];
    if (!comm) return;
    var accounts = getPatracAccounts();
    var filtered = [];
    var seen = {};
    var members = Array.isArray(comm.members) ? comm.members : [];
    var i;
    for (i = 0; i < members.length; i++) {
        var memberId = members[i];
        if (!memberId || seen[memberId]) continue;
        if (!accountBelongsToCommunity(memberId, comCode, accounts)) continue;
        seen[memberId] = true;
        filtered.push(memberId);
    }
    for (var id in accounts) {
        if (!Object.prototype.hasOwnProperty.call(accounts, id)) continue;
        if (normalizeComCodeValue(accounts[id].comCode) === comCode && !seen[id]) {
            seen[id] = true;
            filtered.push(id);
        }
    }
    var changed = filtered.length !== members.length;
    if (!changed) {
        for (i = 0; i < members.length; i++) {
            if (filtered.indexOf(members[i]) === -1) {
                changed = true;
                break;
            }
        }
    }
    if (changed) {
        comm.members = filtered;
        comms[comCode] = comm;
        savePatracCommunities(comms);
    }
}

function reconcileCommunityMembersList(comCode) {
    sanitizeCommunityMembers(comCode);
}

function refreshCommunityMembersFromCloud(scrollToActive) {
    var membersEl = document.getElementById('community-members-list');
    if (!membersEl) return;
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    reconcileCommunityMembersList(comCode);
    var stats = getCommunityAggregateStats(comCode);
    if (stats.members.length === 0) {
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zatím žádní pátrači</span>';
        membersEl.classList.remove('is-scrollable');
        return;
    }

    var userIds = stats.members.map(function(m) { return m.userId; });
    membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Načítám profily z cloudu…</span>';

    patracImport('services/playerService.js').then(function(mod) {
        return mod.fetchPlayersPublicProfiles(userIds).then(function(profiles) {
            for (var uid in profiles) {
                if (!profiles.hasOwnProperty(uid)) continue;
                mod.cacheMemberProfileLocally(uid, profiles[uid]);
                if (profiles[uid].playerName) {
                    localStorage.setItem('patrac_member_name_' + uid, profiles[uid].playerName);
                }
            }
            return patracImport('services/accountService.js').then(function(accMod) {
                return Promise.all(userIds.map(function(uid) {
                    if (localStorage.getItem('patrac_member_name_' + uid)) return null;
                    return accMod.fetchAccountFromCloud(uid).then(function(acc) {
                        if (acc && acc.playerName) {
                            localStorage.setItem('patrac_member_name_' + uid, acc.playerName);
                        }
                    }).catch(function() {});
                }));
            }).then(function() {
                renderCommunityMembersListDom(scrollToActive);
            });
        });
    }).catch(function(err) {
        console.warn('[cloud] member profiles', err);
        renderCommunityMembersListDom(scrollToActive);
    });
}

function renderCommunityMembersListDom(scrollToActive) {
    var membersEl = document.getElementById('community-members-list');
    if (!membersEl) return;
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    reconcileCommunityMembersList(comCode);
    var activeUserId = getActiveInventoryUserId() || localStorage.getItem('patrac_session') || '';
    var comm = getCurrentCommunityRecord();
    var founderId = comm ? comm.founder : '';
    var stats = getCommunityAggregateStats(comCode);
    if (stats.members.length === 0) {
        membersEl.innerHTML = '<span style="font-size:var(--text-sm);color:var(--faint-fg);">Zatím žádní pátrači</span>';
        membersEl.classList.remove('is-scrollable');
        return;
    }
    membersEl.classList.toggle('is-scrollable', stats.members.length >= 5);
    membersEl.innerHTML = buildCommunityMembersListHtml(stats.members, activeUserId, founderId);
    if (scrollToActive) scrollShelterMemberIntoView(membersEl, activeUserId);
}

function scrollShelterMemberIntoView(membersEl, activeUserId) {
    if (!membersEl || !activeUserId || !membersEl.classList.contains('is-scrollable')) return;
    var row = document.getElementById('community-member-active');
    if (!row || !membersEl.contains(row)) return;
    setTimeout(function() {
        var rowTop = row.offsetTop;
        var rowH = row.offsetHeight;
        var viewTop = membersEl.scrollTop;
        var viewH = membersEl.clientHeight;
        if (rowTop < viewTop) {
            membersEl.scrollTop = rowTop;
        } else if (rowTop + rowH > viewTop + viewH) {
            membersEl.scrollTop = rowTop + rowH - viewH;
        }
    }, 0);
}

function renderShelterStory() {
    var tierEl = document.getElementById('shelter-story-tier');
    var textEl = document.getElementById('shelter-story-text');
    if (!tierEl || !textEl) return;
    var comCode = localStorage.getItem('com_code') || '';
    if (!comCode) {
        tierEl.textContent = 'ÚTOČIŠTĚ — ČEKÁ NA KOMUNITU';
        textEl.textContent = 'Připoj se ke komunitě nebo založ vlastní. Příběh útočiště se odemkne podle společné hodnosti a postupu ve hře.';
        return;
    }
    var rank = calculateCommunityRank(comCode);
    tierEl.textContent = 'HODNOST KOMUNITY: ' + rank.rankLabel;
    textEl.textContent = SHELTER_STORY_BY_TIER[rank.tier - 1] || SHELTER_STORY_BY_TIER[0];
}

function getPatracDescKey(userId) {
    return 'patrac_desc_' + userId;
}

function slimPatracAccount(acc) {
    if (!acc) return null;
    var out = {
        pass: String(acc.pass || ''),
        email: String(acc.email || '').trim().toLowerCase(),
        comName: String(acc.comName || '').slice(0, 80),
        comCode: String(acc.comCode || '').slice(0, 5).toUpperCase(),
        playerName: String(acc.playerName || '').slice(0, 80),
        playerCode: String(acc.playerCode || '').slice(0, 5).toUpperCase(),
        localMissions: typeof acc.localMissions === 'number' ? acc.localMissions : (parseInt(acc.localMissions, 10) || 0)
    };
    if (acc.isBot) out.isBot = true;
    return out;
}

function isBotAccount(acc) {
    return !!(acc && acc.isBot);
}

function sanitizePatracAccounts(accounts) {
    var slim = {};
    if (!accounts) return slim;
    for (var id in accounts) {
        if (accounts.hasOwnProperty(id)) slim[id] = slimPatracAccount(accounts[id]);
    }
    return slim;
}

function saveUserAvatar(userId, dataUrl) {
    if (!userId || !dataUrl) return true;
    if (/^https?:\/\//i.test(dataUrl)) {
        if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
            safeLocalStorageSet('player_avatar', dataUrl);
            pushPlayerCloudAsync(function(mod) {
                return mod.syncPlayerAvatarUrl(userId, dataUrl);
            });
            return true;
        }
        cleanPatracStorageAggressive();
        if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
            safeLocalStorageSet('player_avatar', dataUrl);
            pushPlayerCloudAsync(function(mod) {
                return mod.syncPlayerAvatarUrl(userId, dataUrl);
            });
            return true;
        }
        return false;
    }
    if (storageByteLength(dataUrl) > PATRAC_AVATAR_MAX_BYTES) {
        console.warn('Avatar příliš velký, neukládám.');
        return false;
    }
    if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
        safeLocalStorageSet('player_avatar', dataUrl);
        pushUserAvatarDataUrlToCloud(userId, dataUrl);
        return true;
    }
    cleanPatracStorageAggressive();
    if (safeLocalStorageSet(getPatracAvatarKey(userId), dataUrl)) {
        safeLocalStorageSet('player_avatar', dataUrl);
        pushUserAvatarDataUrlToCloud(userId, dataUrl);
        return true;
    }
    return false;
}

function pushPlayerCloudAsync(work) {
    patracImport('services/playerService.js').then(work).catch(function(err) {
        console.warn('[cloud] player sync', err);
    });
}

function collectCommunityPoisForCloud() {
    var session = localStorage.getItem('patrac_session') || '';
    var playerName = localStorage.getItem('player_name') || 'Operativec';
    var pois = [];
    var free = getSafeJSON('map_free_pois');
    for (var i = 0; i < free.length; i++) {
        var p = free[i];
        if (!p || !p.id) continue;
        var img = p.img || '';
        pois.push({
            id: p.id,
            type: 'free',
            name: p.name || '',
            note: p.note || p.desc || '',
            img: img,
            imgUrl: /^https?:\/\//.test(img) ? img : '',
            lat: p.lat,
            lng: p.lng,
            creatorUserId: p.creatorUserId || session,
            creatorName: p.creator || playerName,
            createdAt: p.createdAt || Date.now(),
            updatedAt: Date.now()
        });
    }
    var storyIds = getStoryQuestIds();
    for (var s = 0; s < storyIds.length; s++) {
        var questId = storyIds[s];
        var note = getStoryPosCommunityNote(questId);
        var imgS = getStoryPosCommunityImg(questId);
        var lat = parseFloat(localStorage.getItem('point_' + questId + '_lat'));
        var lng = parseFloat(localStorage.getItem('point_' + questId + '_lng'));
        var hasCoords = !isNaN(lat) && !isNaN(lng);
        if (!note && !imgS && !hasCoords) continue;
        pois.push({
            id: 'story_' + questId,
            type: 'story',
            questId: questId,
            name: getQuestMapLabel(questId),
            note: note,
            img: imgS,
            imgUrl: /^https?:\/\//.test(imgS) ? imgS : '',
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            creatorUserId: session,
            creatorName: playerName,
            updatedAt: Date.now()
        });
    }
    return pois;
}

function getPreviousPoiImgById() {
    var map = {};
    var free = getSafeJSON('map_free_pois');
    for (var i = 0; i < free.length; i++) {
        if (free[i].id && /^https?:\/\//.test(free[i].img || '')) {
            map[free[i].id] = free[i].img;
        }
    }
    var storyIds = getStoryQuestIds();
    for (var s = 0; s < storyIds.length; s++) {
        var qid = storyIds[s];
        var img = getStoryPosCommunityImg(qid);
        if (/^https?:\/\//.test(img)) map['story_' + qid] = img;
    }
    return map;
}

function getCommunityMapCacheKey(comCode) {
    return 'patrac_map_cache_' + String(comCode || '').trim().toUpperCase();
}

function collectCommunityMapPointKeys() {
    var points = {};
    var i;
    for (i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf('point_') !== 0 || key.slice(-4) !== '_lat') continue;
        var questId = key.slice(6, -4);
        var lat = localStorage.getItem(key);
        var lng = localStorage.getItem('point_' + questId + '_lng');
        if (lat && lng) points[questId] = { lat: lat, lng: lng };
    }
    return points;
}

function collectStoryPosMetaKeys() {
    var meta = {};
    var i;
    for (i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        var noteMatch = key.match(/^story_pos_note_(.+)$/);
        var imgMatch = key.match(/^story_pos_img_(.+)$/);
        if (noteMatch) {
            if (!meta[noteMatch[1]]) meta[noteMatch[1]] = {};
            meta[noteMatch[1]].note = localStorage.getItem(key) || '';
        } else if (imgMatch) {
            if (!meta[imgMatch[1]]) meta[imgMatch[1]] = {};
            meta[imgMatch[1]].img = localStorage.getItem(key) || '';
        }
    }
    return meta;
}

function stripMapCachePayloadForStorage(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    var copy = JSON.parse(JSON.stringify(payload));
    if (Array.isArray(copy.freePois)) {
        for (var i = 0; i < copy.freePois.length; i++) {
            var img = copy.freePois[i] && copy.freePois[i].img;
            if (typeof img === 'string' && img.indexOf('data:') === 0) copy.freePois[i].img = '';
        }
    }
    if (copy.storyPosMeta && typeof copy.storyPosMeta === 'object') {
        for (var qid in copy.storyPosMeta) {
            if (!Object.prototype.hasOwnProperty.call(copy.storyPosMeta, qid)) continue;
            var sImg = copy.storyPosMeta[qid] && copy.storyPosMeta[qid].img;
            if (typeof sImg === 'string' && sImg.indexOf('data:') === 0) copy.storyPosMeta[qid].img = '';
        }
    }
    return copy;
}

function captureCommunityMapCachePayload(comCode) {
    comCode = String(comCode || localStorage.getItem('com_code') || operatorComCode || '').trim().toUpperCase();
    if (!comCode) return null;
    var fogPrefs = null;
    if (fogOfWarMod && fogOfWarMod.getFogPrefsForCache) {
        fogPrefs = fogOfWarMod.getFogPrefsForCache();
    }
    return {
        version: 1,
        comCode: comCode,
        points: collectCommunityMapPointKeys(),
        storyPosMeta: collectStoryPosMetaKeys(),
        freePois: getSafeJSON('map_free_pois'),
        customQuests: getSafeJSON('custom_quests_list'),
        randomQuests: getRandomQuestsList(),
        dismissed: getDismissedQuests(),
        reqOverrides: getQuestReqOverrides(),
        launched: getCommunityLaunchedQuests(),
        fogEnabled: fogPrefs ? fogPrefs.fogEnabled : undefined,
        fogRevealAll: fogPrefs ? fogPrefs.fogRevealAll : undefined,
        savedAt: Date.now()
    };
}

function snapshotCommunityMapCache(comCode, payload) {
    payload = payload || captureCommunityMapCachePayload(comCode);
    if (!payload) return null;
    comCode = String(payload.comCode || comCode || localStorage.getItem('com_code') || operatorComCode || '').trim().toUpperCase();
    if (!comCode) return payload;
    var stored = stripMapCachePayloadForStorage(payload);
    if (!safeLocalStorageSet(getCommunityMapCacheKey(comCode), JSON.stringify(stored))) {
        var minimal = {
            version: 1,
            comCode: comCode,
            points: stored.points || {},
            storyPosMeta: {},
            freePois: (stored.freePois || []).map(function(p) {
                return {
                    id: p.id,
                    name: p.name || '',
                    note: p.note || p.desc || '',
                    lat: p.lat,
                    lng: p.lng,
                    creator: p.creator || '',
                    creatorUserId: p.creatorUserId || '',
                    createdAt: p.createdAt || Date.now(),
                    updatedAt: p.updatedAt || Date.now()
                };
            }),
            customQuests: stored.customQuests || [],
            randomQuests: stored.randomQuests || [],
            dismissed: stored.dismissed || [],
            reqOverrides: stored.reqOverrides || {},
            launched: stored.launched || {},
            fogEnabled: stored.fogEnabled,
            fogRevealAll: stored.fogRevealAll,
            savedAt: Date.now()
        };
        safeLocalStorageSet(getCommunityMapCacheKey(comCode), JSON.stringify(minimal));
    }
    return payload;
}

function collectCommunityPoisFromMapPayload(payload) {
    payload = payload || captureCommunityMapCachePayload();
    if (!payload) return [];
    var session = localStorage.getItem('patrac_session') || '';
    var playerName = localStorage.getItem('player_name') || 'Operativec';
    var pois = [];
    var free = Array.isArray(payload.freePois) ? payload.freePois : [];
    for (var i = 0; i < free.length; i++) {
        var p = free[i];
        if (!p || !p.id) continue;
        var img = p.img || '';
        pois.push({
            id: p.id,
            type: 'free',
            name: p.name || '',
            note: p.note || p.desc || '',
            img: img,
            imgUrl: /^https?:\/\//.test(img) ? img : '',
            lat: p.lat,
            lng: p.lng,
            creatorUserId: p.creatorUserId || session,
            creatorName: p.creator || playerName,
            createdAt: p.createdAt || Date.now(),
            updatedAt: Date.now()
        });
    }
    var storyIds = getStoryQuestIds();
    var points = payload.points || {};
    var meta = payload.storyPosMeta || {};
    for (var s = 0; s < storyIds.length; s++) {
        var questId = storyIds[s];
        var note = (meta[questId] && meta[questId].note) || getStoryPosCommunityNote(questId);
        var imgS = (meta[questId] && meta[questId].img) || getStoryPosCommunityImg(questId);
        var pt = points[questId] || {};
        var lat = pt.lat != null ? parseFloat(pt.lat) : NaN;
        var lng = pt.lng != null ? parseFloat(pt.lng) : NaN;
        var hasCoords = !isNaN(lat) && !isNaN(lng);
        if (!note && !imgS && !hasCoords) continue;
        pois.push({
            id: 'story_' + questId,
            type: 'story',
            questId: questId,
            name: getQuestMapLabel(questId),
            note: note,
            img: imgS,
            imgUrl: /^https?:\/\//.test(imgS) ? imgS : '',
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            creatorUserId: session,
            creatorName: playerName,
            updatedAt: Date.now()
        });
    }
    return pois;
}

function collectCommunityQuestsFromMapPayload(payload) {
    payload = payload || captureCommunityMapCachePayload();
    if (!payload) return collectCommunityQuestsForCloud();
    var story = {};
    var storyIds = getStoryQuestIds();
    var points = payload.points || {};
    for (var i = 0; i < storyIds.length; i++) {
        var id = storyIds[i];
        var pt = points[id] || {};
        story[id] = {
            lat: pt.lat != null && pt.lat !== '' ? parseFloat(pt.lat) : null,
            lng: pt.lng != null && pt.lng !== '' ? parseFloat(pt.lng) : null
        };
    }
    var custom = (Array.isArray(payload.customQuests) ? payload.customQuests : []).map(function(q) {
        return enrichQuestWithCoordsFromPoints(q, points);
    });
    var random = (Array.isArray(payload.randomQuests) ? payload.randomQuests : []).map(function(q) {
        return enrichQuestWithCoordsFromPoints(q, points);
    });
    return {
        version: 1,
        story: story,
        custom: custom,
        random: random,
        dismissed: Array.isArray(payload.dismissed) ? payload.dismissed.slice() : [],
        reqOverrides: payload.reqOverrides && typeof payload.reqOverrides === 'object' ? payload.reqOverrides : {},
        launched: payload.launched && typeof payload.launched === 'object' ? payload.launched : {},
        updatedAt: Date.now()
    };
}

function restoreCommunityMapCache(comCode) {
    comCode = String(comCode || '').trim().toUpperCase();
    if (!comCode) return false;
    var raw = localStorage.getItem(getCommunityMapCacheKey(comCode));
    if (!raw) return false;
    try {
        var data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return false;

        var points = data.points || {};
        var qid;
        for (qid in points) {
            if (!Object.prototype.hasOwnProperty.call(points, qid)) continue;
            if (points[qid].lat) localStorage.setItem('point_' + qid + '_lat', points[qid].lat);
            if (points[qid].lng) localStorage.setItem('point_' + qid + '_lng', points[qid].lng);
        }

        var meta = data.storyPosMeta || {};
        for (qid in meta) {
            if (!Object.prototype.hasOwnProperty.call(meta, qid)) continue;
            if (meta[qid].note) localStorage.setItem('story_pos_note_' + qid, meta[qid].note);
            else try { localStorage.removeItem('story_pos_note_' + qid); } catch (e) {}
            if (meta[qid].img) localStorage.setItem('story_pos_img_' + qid, meta[qid].img);
            else try { localStorage.removeItem('story_pos_img_' + qid); } catch (e) {}
        }

        if (Array.isArray(data.freePois)) safeLocalStorageSet('map_free_pois', JSON.stringify(data.freePois));
        if (Array.isArray(data.customQuests)) safeLocalStorageSet('custom_quests_list', JSON.stringify(data.customQuests));
        if (Array.isArray(data.randomQuests)) localStorage.setItem('random_quests_list', JSON.stringify(data.randomQuests));
        if (Array.isArray(data.dismissed)) safeLocalStorageSet('dismissed_quests', JSON.stringify(data.dismissed));
        if (data.reqOverrides) safeLocalStorageSet('quest_req_overrides', JSON.stringify(data.reqOverrides));
        if (data.launched) setCommunityLaunchedQuests(data.launched);
        if (fogOfWarMod && fogOfWarMod.applyCommunityFogPrefs) {
            var fogApply = {};
            if (typeof data.fogEnabled === 'boolean') fogApply.fogEnabled = data.fogEnabled;
            if (typeof data.fogRevealAll === 'boolean') fogApply.fogRevealAll = data.fogRevealAll;
            if (Object.keys(fogApply).length) fogOfWarMod.applyCommunityFogPrefs(fogApply);
        }
        return true;
    } catch (e) {
        return false;
    }
}

function flushCommunityMapCacheToCloud(comCode, payload) {
    comCode = String(comCode || (payload && payload.comCode) || localStorage.getItem('com_code') || operatorComCode || '').trim().toUpperCase();
    if (!comCode) return Promise.resolve();
    payload = payload || snapshotCommunityMapCache(comCode);
    if (!payload) return Promise.resolve();
    var pois = collectCommunityPoisFromMapPayload(payload);
    var quests = collectCommunityQuestsFromMapPayload(payload);
    var previousImgById = getPreviousPoiImgById();
    var chain = Promise.resolve();
    chain = chain.then(function() {
        return patracImport('services/poiService.js').then(function(mod) {
            return mod.saveCommunityPoisToCloud(comCode, pois, previousImgById);
        });
    }).catch(function(err) { console.warn('[cloud] pois flush', err); });
    chain = chain.then(function() {
        return patracImport('services/questService.js').then(function(mod) {
            return mod.saveCommunityQuestsToCloud(comCode, quests);
        });
    }).catch(function(err) { console.warn('[cloud] quests flush', err); });
    return chain;
}

function isOperatorLocalOnlySession() {
    return isOperatorMode === true && !localStorage.getItem('patrac_session');
}

function syncCommunityPoisToCloud() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    snapshotCommunityMapCache(comCode);
    if (isOperatorLocalOnlySession()) return;
    var pois = collectCommunityPoisForCloud();
    var previousImgById = getPreviousPoiImgById();
    patracImport('services/poiService.js').then(function(mod) {
        return mod.saveCommunityPoisToCloud(comCode, pois, previousImgById);
    }).then(function() {
        if (typeof reloadAllMapPoints === 'function') reloadAllMapPoints();
    }).catch(function(err) {
        console.warn('[cloud] pois sync', err);
    });
}

function parseQuestTimeToMs(timeStr) {
    var raw = String(timeStr || '').trim().toLowerCase();
    var m = /^(\d+(?:\.\d+)?)\s*(h|m|min|d)?$/.exec(raw);
    if (!m) return 2 * 3600000;
    var n = parseFloat(m[1]);
    var unit = m[2] || 'h';
    if (unit === 'm' || unit === 'min') return n * 60000;
    if (unit === 'd') return n * 86400000;
    return n * 3600000;
}

function getCommunityLaunchedQuests() {
    var comCode = (localStorage.getItem('com_code') || operatorComCode || '').toUpperCase();
    if (!comCode) return {};
    try {
        var raw = localStorage.getItem('patrac_quest_launched_' + comCode);
        if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
}

function setCommunityLaunchedQuests(launched) {
    var comCode = (localStorage.getItem('com_code') || operatorComCode || '').toUpperCase();
    if (!comCode) return;
    localStorage.setItem('patrac_quest_launched_' + comCode, JSON.stringify(launched || {}));
}

function getLaunchedQuestEntry(questId) {
    var launched = getCommunityLaunchedQuests();
    return launched[questId] || null;
}

function isCommunityQuestType(questId) {
    return !!(questId && !gameQuests[questId]);
}

function usesCommunityLaunchQuest(questId) {
    return !!(questId && (gameQuests[questId] || isCommunityQuestType(questId)));
}

function isPlayerCompletedCurrentRun(questId, userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId) return false;
    var entry = getLaunchedQuestEntry(questId);
    if (!entry || !entry.completions) return false;
    return !!entry.completions[userId];
}

function isQuestLaunchedCommunityWide(questId) {
    var entry = getLaunchedQuestEntry(questId);
    return !!(entry && !entry.closed);
}

function isQuestRunExpired(questId) {
    var entry = getLaunchedQuestEntry(questId);
    if (!entry) return false;
    if (entry.closed) return true;
    return Date.now() > (entry.expiresAt || 0);
}

function getPlayerQuestMissedMap(userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId) return {};
    try {
        var raw = localStorage.getItem('patrac_quest_missed_' + userId);
        if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
}

function isQuestMissedByPlayer(questId, userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    var entry = getLaunchedQuestEntry(questId);
    if (entry && entry.completions && entry.completions[userId]) return false;
    if (entry && entry.closed && userId) {
        if (!entry.completions || !entry.completions[userId]) {
            var missedMap = getPlayerQuestMissedMap(userId);
            var missed = missedMap[questId];
            if (missed) {
                var runStartedAt = typeof missed === 'object' ? missed.runStartedAt : entry.startedAt;
                if (runStartedAt === entry.startedAt) return true;
            }
            return true;
        }
    }
    return false;
}

function markQuestMissedByPlayer(questId, userId, runStartedAt) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId || !questId) return;
    var entry = getLaunchedQuestEntry(questId);
    var missed = getPlayerQuestMissedMap(userId);
    missed[questId] = {
        runStartedAt: runStartedAt != null ? runStartedAt : (entry ? entry.startedAt : Date.now()),
        at: Date.now()
    };
    localStorage.setItem('patrac_quest_missed_' + userId, JSON.stringify(missed));
}

function launchCommunityQuest(questId, q) {
    var launched = getCommunityLaunchedQuests();
    var now = Date.now();
    launched[questId] = {
        startedAt: now,
        expiresAt: isStoryQuestId(questId) ? (now + 365 * 24 * 60 * 60 * 1000) : (now + parseQuestTimeToMs(q.time)),
        startedBy: localStorage.getItem('patrac_session') || '',
        startedByName: localStorage.getItem('player_name') || 'Operativec',
        closed: false,
        completions: {},
        pendingPosition: null,
        noPlacementCountdown: !!gameQuests[questId]
    };
    setCommunityLaunchedQuests(launched);
    try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
}

function applyStoryPendingPositionNow(questId, entry) {
    if (!entry || !entry.pendingPosition || entry.positionApplied) return false;
    if (!applyStoryPositionFromLaunch(questId, entry.pendingPosition)) return false;
    var launched = getCommunityLaunchedQuests();
    if (!launched[questId]) launched[questId] = entry;
    launched[questId].positionApplied = true;
    setCommunityLaunchedQuests(launched);
    syncCommunityQuestsToCloud();
    try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
    rebuildCustomLocLinkSelect();
    renderStoryPositionsList();
    return true;
}

function recordStoryRunCompletion(questId, lat, lng) {
    var launched = getCommunityLaunchedQuests();
    var entry = launched[questId];
    if (!entry) return;
    var session = localStorage.getItem('patrac_session') || '';
    var name = localStorage.getItem('player_name') || 'Operativec';
    if (!entry.completions) entry.completions = {};
    entry.completions[session] = { lat: lat, lng: lng, at: Date.now(), name: name };
    if (!entry.pendingPosition) {
        entry.pendingPosition = {
            lat: lat,
            lng: lng,
            confirmedBy: session,
            confirmedByName: name,
            confirmedAt: Date.now()
        };
    }
    setCommunityLaunchedQuests(launched);
    applyStoryPendingPositionNow(questId, entry);
}

function applyStoryPositionFromLaunch(questId, pendingPosition) {
    if (!gameQuests[questId] || !pendingPosition) return false;
    var lat = parseFloat(pendingPosition.lat);
    var lng = parseFloat(pendingPosition.lng);
    if (isNaN(lat) || isNaN(lng)) return false;
    saveQuestCoords(questId, lat, lng);
    var q = gameQuests[questId];
    renderPointOnMap(questId, lat, lng, q.mapLabel || q.title, q.desc);
    return true;
}

function applyStoryPendingPositions() {
    var launched = getCommunityLaunchedQuests();
    var changed = false;
    var mapChanged = false;
    for (var questId in launched) {
        if (!Object.prototype.hasOwnProperty.call(launched, questId)) continue;
        var entry = launched[questId];
        if (!gameQuests[questId] || !entry || !entry.pendingPosition || entry.positionApplied) continue;
        if (applyStoryPositionFromLaunch(questId, entry.pendingPosition)) {
            entry.positionApplied = true;
            changed = true;
            mapChanged = true;
        }
    }
    if (changed) setCommunityLaunchedQuests(launched);
    if (changed) syncCommunityQuestsToCloud();
    if (mapChanged) {
        try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
    }
    return changed;
}

function ensureClosedStoryPositionsApplied() {
    applyStoryPendingPositions();
    var launched = getCommunityLaunchedQuests();
    var changed = false;
    var mapChanged = false;
    for (var questId in launched) {
        if (!Object.prototype.hasOwnProperty.call(launched, questId)) continue;
        var entry = launched[questId];
        if (!gameQuests[questId] || !entry || !entry.closed || !entry.pendingPosition || entry.positionApplied) continue;
        if (applyStoryPositionFromLaunch(questId, entry.pendingPosition)) {
            entry.positionApplied = true;
            changed = true;
            mapChanged = true;
        }
    }
    if (changed) setCommunityLaunchedQuests(launched);
    if (changed) syncCommunityQuestsToCloud();
    if (mapChanged) {
        try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
    }
    return changed;
}

function processCommunityQuestExpiries() {
    var launched = getCommunityLaunchedQuests();
    var now = Date.now();
    var session = localStorage.getItem('patrac_session') || '';
    var changed = false;
    var playerChanged = false;

    for (var questId in launched) {
        if (!Object.prototype.hasOwnProperty.call(launched, questId)) continue;
        var entry = launched[questId];
        if (!entry || entry.closed) continue;
        if (now <= (entry.expiresAt || 0)) continue;

        entry.closed = true;
        changed = true;

        if (gameQuests[questId] && entry.pendingPosition && !entry.positionApplied) {
            if (applyStoryPositionFromLaunch(questId, entry.pendingPosition)) {
                entry.positionApplied = true;
                try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
            }
        }

        if (session) {
            var q = getQuestById(questId);
            var completedRun = entry.completions && entry.completions[session];
            if (q && !completedRun && !isQuestMissedByPlayer(questId, session)) {
                markQuestMissedByPlayer(questId, session, entry.startedAt);
                playerChanged = true;
            }
        }
    }

    if (changed) setCommunityLaunchedQuests(launched);
    if (changed) syncCommunityQuestsToCloud();
    if (playerChanged) syncPlayerQuestProgressToCloud();
    ensureClosedStoryPositionsApplied();
    return changed || playerChanged;
}

function isQuestUnlockedForPlayer(questId) {
    if (isQuestMissedByPlayer(questId)) return false;
    if (isQuestLaunchedCommunityWide(questId) && !isQuestRunExpired(questId)) return true;
    if (gameQuests[questId]) return false;
    return localStorage.getItem('unlocked_story_' + questId) === 'true';
}

function formatQuestCountdown(questId) {
    var entry = getLaunchedQuestEntry(questId);
    if (!entry || entry.closed) return '';
    var left = (entry.expiresAt || 0) - Date.now();
    if (left <= 0) return 'vypršelo';
    var mins = Math.ceil(left / 60000);
    if (mins >= 60) return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    return mins + ' min';
}

function renderCommunityQuestStatusHtml(questId, q) {
    if (!usesCommunityLaunchQuest(questId)) return '';
    if (isStoryQuestId(questId) && isPlayerCompletedCurrentRun(questId)) {
        if (isStoryQuestPlaced(questId)) {
            return '<div style="font-size:var(--text-sm);color:var(--text-green);margin:4px 0;">✅ Výkon potvrzen — rank zapsán. Trvalý bod je na mapě.</div>';
        }
        return '<div style="font-size:var(--text-sm);color:var(--danger-orange);margin:4px 0;">✅ Výkon potvrzen — rank zapsán, ale bod na mapě chybí. Použij ↺ RESET a zaměř znovu.</div>';
    }
    if (!isStoryQuestId(questId) && isQuestCompleted(q)) return '';
    if (isQuestMissedByPlayer(questId)) {
        return '<div class="logistics-error" style="display:block;margin:4px 0;">⏱ Lhůta vypršela — rank za tuto misi nezískáš.</div>';
    }
    var entry = getLaunchedQuestEntry(questId);
    if (!entry) return '';
    var starter = entry.startedByName || entry.startedBy || 'komunita';
    var html = '<div style="font-size:var(--text-sm);color:var(--accent-gold);margin:4px 0;">📡 Spuštěno: ' + starter + '</div>';
    html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">Každý pátrač musí potvrdit výkon na místě sám — jinak rank nezíská.</div>';
    if (isStoryQuestId(questId)) {
        html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">Trvalý bod se na mapě aktualizuje hned po potvrzení GPS.</div>';
    } else {
        var cd = formatQuestCountdown(questId);
        html += '<div style="font-size:var(--text-xs);color:var(--muted-fg);margin-bottom:4px;">Zbývá ~' + cd + '</div>';
    }
    return html;
}

function enrichQuestWithCoordsFromPoints(quest, points) {
    if (!quest || !quest.id) return quest;
    var copy = JSON.parse(JSON.stringify(quest));
    var pt = points && points[quest.id];
    var lat = pt && pt.lat != null && pt.lat !== '' ? parseFloat(pt.lat) : (copy.lat != null ? parseFloat(copy.lat) : null);
    var lng = pt && pt.lng != null && pt.lng !== '' ? parseFloat(pt.lng) : (copy.lng != null ? parseFloat(copy.lng) : null);
    copy.lat = typeof lat === 'number' && !isNaN(lat) ? lat : null;
    copy.lng = typeof lng === 'number' && !isNaN(lng) ? lng : null;
    return copy;
}

function enrichQuestWithCoords(quest) {
    if (!quest || !quest.id) return quest;
    var copy = JSON.parse(JSON.stringify(quest));
    var lat = localStorage.getItem('point_' + quest.id + '_lat');
    var lng = localStorage.getItem('point_' + quest.id + '_lng');
    copy.lat = lat ? parseFloat(lat) : (copy.lat != null ? parseFloat(copy.lat) : null);
    copy.lng = lng ? parseFloat(lng) : (copy.lng != null ? parseFloat(copy.lng) : null);
    return copy;
}

function collectCommunityQuestsForCloud() {
    var story = {};
    var storyIds = getStoryQuestIds();
    for (var i = 0; i < storyIds.length; i++) {
        var id = storyIds[i];
        var lat = localStorage.getItem('point_' + id + '_lat');
        var lng = localStorage.getItem('point_' + id + '_lng');
        story[id] = {
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null
        };
    }
    var custom = getSafeJSON('custom_quests_list').map(enrichQuestWithCoords);
    var random = getRandomQuestsList().map(enrichQuestWithCoords);
    return {
        version: 1,
        story: story,
        custom: custom,
        random: random,
        dismissed: getDismissedQuests(),
        reqOverrides: getQuestReqOverrides(),
        launched: getCommunityLaunchedQuests(),
        updatedAt: Date.now()
    };
}

function syncCommunityQuestsToCloud() {
    var comCode = localStorage.getItem('com_code') || operatorComCode || '';
    if (!comCode) return;
    snapshotCommunityMapCache(comCode);
    if (isOperatorLocalOnlySession()) {
        if (typeof reloadAllMapPoints === 'function') reloadAllMapPoints();
        if (typeof renderQuestList === 'function') renderQuestList();
        return;
    }
    var quests = collectCommunityQuestsForCloud();
    patracImport('services/questService.js').then(function(mod) {
        return mod.saveCommunityQuestsToCloud(comCode, quests);
    }).then(function() {
        if (typeof reloadAllMapPoints === 'function') reloadAllMapPoints();
        if (typeof renderQuestList === 'function') renderQuestList();
    }).catch(function(err) {
        console.warn('[cloud] quests sync', err);
    });
}

function collectPlayerQuestProgressForCloud(userId) {
    userId = userId || localStorage.getItem('patrac_session') || '';
    if (!userId) return null;
    var data = getUserProfileData(userId);
    var unlocked = {};
    function markUnlocked(id) {
        if (localStorage.getItem('unlocked_story_' + id) === 'true') unlocked[id] = true;
    }
    var storyIds = getStoryQuestIds();
    for (var s = 0; s < storyIds.length; s++) markUnlocked(storyIds[s]);
    var customQuests = getSafeJSON('custom_quests_list');
    for (var c = 0; c < customQuests.length; c++) markUnlocked(customQuests[c].id);
    var randomQuests = getRandomQuestsList();
    for (var r = 0; r < randomQuests.length; r++) markUnlocked(randomQuests[r].id);

    var done = snapshotQuestDoneFromLocalStorage();
    var missed = getPlayerQuestMissedMap(userId);

    var terminal = { activatedCodes: [], poctaInventoryIds: [] };
    try {
        var termRaw = localStorage.getItem('patrac_terminal_' + userId);
        if (termRaw) terminal = JSON.parse(termRaw);
    } catch (e) {}
    if (!Array.isArray(terminal.activatedCodes)) terminal.activatedCodes = [];
    if (!Array.isArray(terminal.poctaInventoryIds)) terminal.poctaInventoryIds = [];

    return {
        missions: {
            localMissions: data.localMissions || 0,
            globalMissions: data.globalMissions != null ? data.globalMissions : (data.localMissions || 0),
            localIssuerStats: data.localIssuerStats || emptyIssuerStats(),
            globalIssuerStats: data.globalIssuerStats || emptyIssuerStats(),
            missionLog: data.missionLog || []
        },
        quests: {
            done: done,
            unlocked: unlocked,
            missed: missed
        },
        terminal: terminal
    };
}

function syncPlayerQuestProgressToCloud() {
    var userId = localStorage.getItem('patrac_session') || '';
    if (!userId || isOperatorMode) return;
    var progress = collectPlayerQuestProgressForCloud(userId);
    if (!progress) return;
    patracImport('services/playerService.js').then(function(mod) {
        return mod.syncPlayerProgressToCloud(userId, progress);
    }).catch(function(err) {
        console.warn('[cloud] player quest sync', err);
    });
}

var patracCommunityUnsubscribe = null;

function startCommunityRealtimeSync(comCode) {
    comCode = (comCode || localStorage.getItem('com_code') || operatorComCode || '').toUpperCase();
    if (!comCode) return;
    if (isOperatorLocalOnlySession()) return;
    patracImport('services/questService.js').then(function(mod) {
        if (patracCommunityUnsubscribe) {
            patracCommunityUnsubscribe();
            patracCommunityUnsubscribe = null;
        }
        return mod.subscribeCommunityRealtime(comCode, function(payload) {
            if (Array.isArray(payload.inventory)) {
                var invKey = 'patrac_items_community_' + comCode;
                localStorage.setItem(invKey, JSON.stringify(payload.inventory));
                localStorage.setItem('items_community', JSON.stringify(payload.inventory));
                try { loadCustomCraftedItems(); } catch (e) { console.warn(e); }
            }
            if (payload.quests) {
                var merged = mod.mergeCommunityQuests(payload.quests, collectCommunityQuestsForCloud());
                mod.applyCommunityQuestsToLocalStorage(merged);
                snapshotCommunityMapCache(comCode);
                try { processCommunityQuestExpiries(); } catch (e) { console.warn(e); }
                try { ensureClosedStoryPositionsApplied(); } catch (e) { console.warn(e); }
                try { reloadAllMapPoints(); } catch (e) { console.warn(e); }
                try { renderQuestList(); } catch (e) { console.warn(e); }
            }
        }).then(function(unsub) {
            patracCommunityUnsubscribe = unsub;
        });
    }).catch(function(err) {
        console.warn('[cloud] community realtime', err);
    });
}

function pushUserAvatarDataUrlToCloud(userId, dataUrl) {
    Promise.all([
        patracImport('services/dataService.js'),
        patracImport('services/playerService.js')
    ]).then(function(mods) {
        return mods[0].uploadAvatarFromDataUrl(userId, dataUrl).then(function(url) {
            safeLocalStorageSet(getPatracAvatarKey(userId), url);
            safeLocalStorageSet('player_avatar', url);
            return mods[1].syncPlayerAvatarUrl(userId, url);
        });
    }).catch(function(err) {
        console.warn('[cloud] avatar upload', err);
    });
}

function saveUserDesc(userId, desc) {
    if (!userId) return;
    var text = (desc || '').trim().slice(0, 500);
    if (text) safeLocalStorageSet(getPatracDescKey(userId), text);
    else try { localStorage.removeItem(getPatracDescKey(userId)); } catch (e) {}
    pushPlayerCloudAsync(function(mod) {
        return mod.syncPlayerDesc(userId, text);
    });
}

function cleanPatracStorageAggressive() {
    var accounts = sanitizePatracAccounts(getPatracAccounts());
    try {
        localStorage.setItem('patrac_accounts', JSON.stringify(accounts));
    } catch (e) {}

    var pois = getSafeJSON('map_free_pois');
    var poiChanged = false;
    for (var p = 0; p < pois.length; p++) {
        if (pois[p].img && storageByteLength(pois[p].img) > 40000) {
            delete pois[p].img;
            poiChanged = true;
        }
    }
    if (poiChanged) safeLocalStorageSet('map_free_pois', JSON.stringify(pois));

    var storyIds = ['roxy', 'sef', 'herbert', 'ino', 'adam'];
    for (var s = 0; s < storyIds.length; s++) {
        var imgKey = 'story_pos_img_' + storyIds[s];
        var imgVal = localStorage.getItem(imgKey);
        if (imgVal && storageByteLength(imgVal) > 40000) {
            try { localStorage.removeItem(imgKey); } catch (e) {}
        }
    }

    try {
        var chatRaw = localStorage.getItem('local_chat_backup');
        if (chatRaw && storageByteLength(chatRaw) > 20000) localStorage.removeItem('local_chat_backup');
    } catch (e) {}
}

function migratePatracAccountsStorage() {
    var raw = localStorage.getItem('patrac_accounts');
    if (!raw) return;
    var accounts;
    try { accounts = JSON.parse(raw); } catch (e) { return; }

    var needsRewrite = false;
    for (var id in accounts) {
        if (!accounts.hasOwnProperty(id)) continue;
        var acc = accounts[id];
        if (acc.avatar && storageByteLength(acc.avatar) > 50) {
            saveUserAvatar(id, acc.avatar);
            needsRewrite = true;
        }
        if (acc.desc && !localStorage.getItem(getPatracDescKey(id))) {
            saveUserDesc(id, acc.desc);
        }
        if (acc.avatar || acc.desc || acc.legacy) needsRewrite = true;
    }

    var slim = sanitizePatracAccounts(accounts);
    if (needsRewrite || storageByteLength(raw) > storageByteLength(JSON.stringify(slim)) + 10) {
        try {
            localStorage.setItem('patrac_accounts', JSON.stringify(slim));
        } catch (e) {
            cleanPatracStorageAggressive();
            try { localStorage.setItem('patrac_accounts', JSON.stringify(slim)); } catch (e2) {}
        }
    }
}

function savePatracAccounts(accounts) {
    var slim = sanitizePatracAccounts(accounts);
    var json = JSON.stringify(slim);
    var size = storageByteLength(json);
    if (size > PATRAC_ACCOUNTS_MAX_BYTES) {
        throw new Error('Příliš mnoho účtů v síti (' + Math.round(size / 1024) + ' KB). Smaž staré testovací účty — RESET.');
    }
    if (safeLocalStorageSet('patrac_accounts', json)) {
        pushAccountsToCloud(slim);
        return;
    }

    cleanPatracStorageAggressive();
    if (safeLocalStorageSet('patrac_accounts', json)) {
        pushAccountsToCloud(slim);
        return;
    }

    var usage = getLocalStorageUsageBytes();
    throw new Error('localStorage je plné (~' + Math.round(usage / 1024) + ' KB). Vymaž data prohlížeče nebo použij ☠ RESET.');
}

function pushAccountsToCloud(accounts) {
    patracImport('services/accountService.js').then(function(mod) {
        for (var userId in accounts) {
            if (!accounts.hasOwnProperty(userId)) continue;
            mod.saveAccountToCloud(userId, accounts[userId]).catch(function(err) {
                console.warn('[cloud] account sync', userId, err);
            });
        }
    }).catch(function(err) {
        console.warn('[cloud] accountService', err);
    });
}

function isQuestCompleted(quest) {
    return localStorage.getItem(quest.doneKey || ('quest_done_' + quest.id)) === 'true';
}

function isQuestActive(quest) {
    if (!quest || !quest.id) return false;
    if (isQuestDismissed(quest.id)) return false;
    if (gameQuests[quest.id]) {
        if (!isQuestLaunchedCommunityWide(quest.id) || isQuestRunExpired(quest.id)) return false;
        if (isPlayerCompletedCurrentRun(quest.id)) return false;
        if (isQuestMissedByPlayer(quest.id)) return false;
        return true;
    }
    if (isQuestCompleted(quest)) return false;
    if (isQuestMissedByPlayer(quest.id)) return false;
    if (isCommunityQuestType(quest.id)) {
        if (isQuestLaunchedCommunityWide(quest.id) && !isQuestRunExpired(quest.id)) return true;
        return false;
    }
    return true;
}

function getActiveQuestsList() {
    var list = [];
    for (var k in gameQuests) {
        var q = getQuestById(gameQuests[k].id) || getQuestWithReq(gameQuests[k]);
        if (isQuestActive(q)) list.push(q);
    }
    var randomQuests = getRandomQuestsList();
    for (var r = 0; r < randomQuests.length; r++) {
        var rq = getQuestById(randomQuests[r].id) || getQuestWithReq(randomQuests[r]);
        if (isQuestActive(rq)) list.push(rq);
    }
    var customQuests = getSafeJSON('custom_quests_list');
    for (var i = 0; i < customQuests.length; i++) {
        var cq = getQuestWithReq(customQuests[i]);
        if (isQuestActive(cq)) list.push(cq);
    }
    return list;
}

function geolocationErrorText(err) {
    if (!err) return 'GPS nedostupné';
    if (err.code === 1) return 'Poloha zamítnuta — povol v nastavení prohlížeče/telefonu';
    if (err.code === 2) return 'Poloha nedostupná — zapni GPS a Wi‑Fi';
    if (err.code === 3) return 'GPS timeout — stiskni CENTR. pro opakování';
    return err.message || 'GPS chyba';
}

var gpsWatchId = null;
var userAccuracyCircle = null;

function setGpsStatus(html) {
    var gpsEl = document.getElementById('gps-status-text');
    if (gpsEl) gpsEl.innerHTML = html;
}

function applyUserPosition(position) {
    if (!map || !position || !position.coords) return;
    var lat = position.coords.latitude;
    var lng = position.coords.longitude;
    var acc = position.coords.accuracy || 30;

    lastUserPosition = { lat: lat, lng: lng, accuracy: acc, ts: Date.now() };
    if (window.patracPoctaBridge) window.patracPoctaBridge.lastUserPosition = lastUserPosition;
    if (typeof window.patracPoctaOnGps === 'function') window.patracPoctaOnGps();
    updateTacticalHud();

    setGpsStatus('<span style="color:#0077ff;">● GPS LOCK</span>');

    if (!userMarker) {
        userMarker = L.circleMarker([lat, lng], {
            radius: 9,
            color: '#ffffff',
            weight: 3,
            fillColor: '#0077ff',
            fillOpacity: 1,
            pane: 'markerPane'
        }).addTo(map);
        userMarker.bindPopup('📍 Tvoje poloha');
    } else {
        userMarker.setLatLng([lat, lng]);
    }

    if (userAccuracyCircle) {
        map.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
    }
    userAccuracyCircle = L.circle([lat, lng], {
        radius: acc,
        color: '#0077ff',
        weight: 1,
        fillColor: '#0077ff',
        fillOpacity: 0.12
    }).addTo(map);

    if (!map._gpsCenteredOnce) {
        map.setView([lat, lng], 16);
        map._gpsCenteredOnce = true;
    }
    patracRefreshFogOfWar();
}

function onGpsError(err) {
    setGpsStatus('<span style="color:var(--danger-orange);">● ' + geolocationErrorText(err) + '</span>');
}

function startGeolocation() {
    if (!navigator.geolocation) {
        setGpsStatus('<span style="color:var(--danger-orange);">● GPS NENÍ V PROHLÍŽEČI</span>');
        return;
    }
    setGpsStatus('● Hledám GPS signál...');

    navigator.geolocation.getCurrentPosition(
        applyUserPosition,
        onGpsError,
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    gpsWatchId = navigator.geolocation.watchPosition(
        applyUserPosition,
        onGpsError,
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 }
    );
}

function hardResetData() {
    var msg = 'Smazat veškerá lokální data v tomto prohlížeči?\n\n'
        + '• Smaže se postup, účty a inventář v tomto zařízení.\n'
        + '• Data ve Firebase (cloud) zůstanou — starý účet lze znovu načíst přihlášením.\n'
        + '• Pro úplně nový start zvol při registraci NOVÉ ID operativce.\n\n'
        + 'Pokračovat?';
    if (!confirm(msg)) return;
    try { sessionStorage.setItem('patrac_after_local_reset', '1'); } catch (e) {}
    localStorage.clear();
    window.location.reload();
}

