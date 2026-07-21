/* PATRAC: quest data, logic, render */
var gameQuests = {
    'roxy': { id: 'roxy', char: 'Roxy', mapLabel: '├Üto─Źi┼ít─Ť', title: 'Nastav si ├║to─Źi┼ít─Ť', desc: 'Dojdi fyzicky na bezpe─Źn├ę m├şsto a ulo┼ż tam sou┼Öadnice ├Üto─Źi┼ít─Ť.', req: [], time: '2h', latKey: 'point_roxy_lat', lngKey: 'point_roxy_lng', doneKey: 'quest_done_roxy' },
    'sef': { id: 'sef', char: '┼á├ęf', mapLabel: 'Zdroj vody', title: 'Najdi zdroj vody', desc: 'Bez vody nep┼Öe┼żijeme. Najdi potok nebo stud├ínku a zam─Ť┼Ö polohu.', req: [], time: '4h', latKey: 'point_sef_lat', lngKey: 'point_sef_lng', doneKey: 'quest_done_sef' },
    'herbert': { id: 'herbert', char: 'Herbert', mapLabel: 'Lesn├ş sklad', title: 'Lesn├ş shroma┼żdi┼ít─Ť', desc: 'Vyhledej kryt├ę prostranstv├ş vhodn├ę pro ukl├íd├ín├ş zdravotnick├Żch z├ísob.', req: [], time: '16h', latKey: 'point_herbert_lat', lngKey: 'point_herbert_lng', doneKey: 'quest_done_herbert' },
    'ino': { id: 'ino', char: 'Ino', mapLabel: 'Cvi─Źi┼ít─Ť', title: 'Najdi cvi─Źi┼ít─Ť', desc: 'Mus├şme naj├şt rovnou lesn├ş m├Żtinu vhodnou pro fyzick├Ż tr├ęnink.', req: [], time: '3h', latKey: 'point_ino_lat', lngKey: 'point_ino_lng', doneKey: 'quest_done_ino' },
    'adam': { id: 'adam', char: 'Adam', mapLabel: 'Rozhledna', title: 'Najdi rozhlednu', desc: 'Dojdi p┼Ö├şmo k pat─Ť nejbli┼ż┼í├ş vyhl├şdky a zapi┼í ji jako pozorovac├ş bod.', req: [], time: '12h', latKey: 'point_adam_lat', lngKey: 'point_adam_lng', doneKey: 'quest_done_adam' }
};

/** ┼áablony n├íhodn├Żch rozkaz┼» ÔÇö generuj├ş se dynamicky od postav */
var RANDOM_QUEST_TEMPLATES = {
    roxy: [
        { id: 'rx_perimeter', title: 'Obch┼»zka perimetru', desc: 'Obejdi okol├ş ├║to─Źi┼ít─Ť po sm─Ťru hodinov├Żch ru─Źi─Źek. Zkontroluj, zda nen├ş prolomen├í linie.', time: '1h', req: [] },
        { id: 'rx_supplies', title: 'Inventura z├ísob', desc: 'Projdi sklad a sepi┼í, co doch├íz├ş. Bez po┼Ö├ídku padne┼í jako prvn├ş.', time: '2h', req: [] },
        { id: 'rx_nightwatch', title: 'No─Źn├ş hl├şdka', desc: 'Vydr┼ż do ├║svitu u v├Żchodn├ş strany t├íbora. Hl├ís├ş┼í ka┼żd├Ż podez┼Öel├Ż zvuk.', time: '6h', req: [] },
        { id: 'rx_escape', title: 'Kontrola ├║nikov├Żch tras', desc: 'Projdi v┼íechny napl├ínovan├ę ├║nikov├ę cesty a ov─Ť┼Ö, ┼że jsou pr┼»choz├ş.', time: '3h', req: [], needsMap: true },
        { id: 'rx_rally', title: 'Svol├ín├ş dru┼żiny', desc: 'Dojdi na m├Żtinu a ov─Ť┼Ö, ┼że se tam vejde cel├í jednotka ÔÇö z├ílo┼żn├ş shroma┼żdi┼ít─Ť.', time: '2h', req: [], needsMap: true }
    ],
    sef: [
        { id: 'sf_rain', title: 'Sb─Ťr de┼í┼ąov├ę vody', desc: 'Postav improvizovan├Ż sb─Ťra─Ź vody z plachty a n├ídob. Mus├ş fungovat.', time: '3h', req: [] },
        { id: 'sf_filter', title: '─îi┼ít─Ťn├ş filtru', desc: 'Vy─Źisti nebo vym─Ť┼ł filtra─Źn├ş materi├íl u zdroje vody. Bez vody jsme mrtv├ş.', time: '2h', req: [] },
        { id: 'sf_firewood', title: 'Z├ísoba paliva', desc: 'Nasekej a uskladni d┼Öevo na t┼Öi dny topen├ş. Pr├íce pro d┼Ö├ş─Źe.', time: '4h', req: [] },
        { id: 'sf_stream', title: 'Pr┼»zkum potoka', desc: 'Sleduj potok po proudu a najdi nej─Źist┼í├ş m├şsto pro ─Źerp├ín├ş.', time: '3h', req: [], needsMap: true },
        { id: 'sf_repair', title: 'Oprava odvodn─Ťn├ş', desc: 'Oprav kan├íl nebo v├Żpust, a┼ą se n├ím nezaplave sklad p┼Öi de┼íti.', time: '5h', req: [] }
    ],
    herbert: [
        { id: 'hb_herbs', title: 'Sb─Ťr bylin', desc: 'Najdi m├şsto s hojnost├ş l├ę─Źiv├Żch rostlin a nasb├şrej do s├í─Źku.', time: '2h', req: [], needsMap: true },
        { id: 'hb_disinfect', title: 'Dezinfekce z├│ny', desc: 'Vy─Źisti a dezinfikuj pracovn├ş plochu zdravotn├şho koutku.', time: '1h', req: [] },
        { id: 'hb_medcheck', title: 'Kontrola l├ęk├írni─Źky', desc: 'Projdi obsah l├ęk├írni─Źky. Pro┼íl├ę v─Ťci vyho─Ć, chyb─Ťj├şc├ş dopl┼ł.', time: '2h', req: [] },
        { id: 'hb_pine', title: 'Borovicov├ę prysky┼Öice', desc: 'Najdi borovici a nasb├şrej prysky┼Öici ÔÇö na dezinfekci a lepen├ş.', time: '3h', req: [] },
        { id: 'hb_dry', title: 'Su┼íen├ş obvaz┼»', desc: 'Vysu┼í ─Źist├ę l├ítky na slunci a ulo┼ż do vodot─Ťsn├ęho obalu.', time: '2h', req: [] }
    ],
    ino: [
        { id: 'in_run', title: 'Okruh vytrvalosti', desc: 'Ub─Ťhni minim├íln─Ť 3 km v ter├ęnu. Tempo dr┼ż, fl├ík├ín├ş neberu.', time: '2h', req: [] },
        { id: 'in_track', title: 'Stopov├ín├ş stopy', desc: 'Najdi a sleduj ─Źerstvou stopu zv─Ť┼Öe nebo lid├ş ÔÇö zapi┼í sm─Ťr.', time: '3h', req: [], needsMap: true },
        { id: 'in_night', title: 'No─Źn├ş pr┼»zkum', desc: 'Projdi okol├ş za tmy bez sv├ştilny po vyzna─Źen├ę trase. Ostra┼żitost je ┼żivot.', time: '4h', req: [] },
        { id: 'in_climb', title: 'Ter├ęnn├ş p┼Öek├í┼żka', desc: 'Najdi m├şsto s p┼Öirozenou p┼Öek├í┼żkou (pa┼Öez, sk├íla) a t┼Öikr├ít ji zdolaj.', time: '1h', req: [], needsMap: true },
        { id: 'in_cache', title: 'Skr├Ż┼í z├ísob', desc: 'Zalo┼ż tajnou skr├Ż┼í mimo hlavn├ş t├íbor ÔÇö z├íloha pro nouzi.', time: '2h', req: [], needsMap: true }
    ],
    adam: [
        { id: 'ad_scout', title: 'V├Żzv─Ťda z v├Ż┼íky', desc: 'Vylez na nejbli┼ż┼í├ş kopec nebo strom a 10 minut pozoruj okol├ş.', time: '2h', req: [], needsMap: true },
        { id: 'ad_weather', title: 'Z├íznam po─Źas├ş', desc: 'Sleduj oblohu a v├ştr 30 minut. Zapi┼í, co p┼Öijde ÔÇö bou┼Öka nebo klid.', time: '1h', req: [] },
        { id: 'ad_trail', title: 'Zna─Źen├ş stezky', desc: 'Vyzna─Ź bezpe─Źnou stezku p├ískou nebo kam├şnky od t├íbora k c├şli.', time: '2h', req: [], needsMap: true },
        { id: 'ad_animal', title: 'Stopa zv─Ť┼Öe', desc: 'Najdi m├şsto, kde zv├ş┼Öata pij├ş nebo se pasou ÔÇö d┼»le┼żit├ę pro pasti i varov├ín├ş.', time: '3h', req: [], needsMap: true },
        { id: 'ad_map', title: 'Kresba okol├ş', desc: 'Projdi okol├ş a dopl┼ł do ment├íln├ş mapy nov├ę cesty, kter├ę jsme je┼ít─Ť ne┼íli.', time: '2h', req: [] }
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
        alert('Maximum ' + RANDOM_QUEST_MAX_ACTIVE + ' aktivn├şch n├íhodn├Żch rozkaz┼». Spl┼ł nebo archivuj star┼í├ş.');
        return;
    }
    var nq = generateOneRandomQuest();
    if (!nq) {
        alert('Moment├íln─Ť nejsou dostupn├ę nov├ę ┼íablony rozkaz┼».');
        return;
    }
    var list = getRandomQuestsList();
    list.push(nq);
    saveRandomQuestsList(list);
    renderQuestList();
    rebuildSelectOptions();
    alert('­čô╗ Nov├Ż rozkaz od ' + nq.char + ': ÔÇ×' + nq.title + 'ÔÇť');
}

function confirmRandomQuestDone(questId) {
    var q = getQuestById(questId);
    if (!q || !isRandomQuestId(questId)) return;
    if (!isQuestUnlockedForPlayer(questId)) {
        alert('Nejd┼Ö├şv mus├ş n─Ťkdo z komunity spustit rozkaz.');
        return;
    }
    completeQuestAtLocation(questId);
}

function renderQuestActionButtons(questId, opts) {
    opts = opts || {};
    var html = '';
    var placed = hasStoredQuestCoords(questId);
    if (!placed) {
        html += '<button class="btn-accept" style="border-color:var(--xp-blue);color:var(--xp-blue); width:100%; margin-bottom:4px;" onclick="placeQuestAtGps(\'' + questId + '\')">­čôŹ ZAM─Ü┼śIT POZICI (GPS)</button>';
        if (canUseMapPlacement()) {
            html += '<button class="btn-accept" style="border-color:var(--muted-fg);color:var(--muted-fg); width:100%; margin-bottom:4px;" onclick="activatePlacementMode(\'' + questId + '\')">­čŚ║´ŞĆ ADMIN: UM├ŹSTIT NA MAP─Ü</button>';
        }
    } else {
        html += '<button class="btn-accept" style="border-color:var(--text-green);color:var(--text-green); width:100%; margin-bottom:4px;" onclick="completeQuestAtLocation(\'' + questId + '\')">Ôťů POTVRDIT V├ŁKON NA M├ŹST─Ü</button>';
        if (canUseMapPlacement()) {
            html += '<button class="btn-accept" style="border-color:var(--danger-orange);color:var(--danger-orange); width:100%;" onclick="activateTargeting(\'' + questId + '\')">­čŚ║´ŞĆ ADMIN: SPLNIT Z MAPY</button>';
        }
    }
    return html;
}

function renderRandomQuestCard(q) {
    var isDone = isQuestCompleted(q);
    if (isDone) {
        var html = '<div class="quest-card quest-completed" id="card-done-' + q.id + '">';
        html += '<div class="quest-completed-badge">Ôťů SPLN─ÜNO: ' + q.char + ' ÔÇö ' + q.title + '</div>';
        html += '<div class="quest-assigner-badge">­čôí ' + getQuestAssignerBadge(q) + ' ┬Ě n├íhodn├Ż rozkaz</div>';
        html += '<div class="quest-reward-note">­čÄü Odm─Ťna p┼Öips├ína. Postava si pamatuje tv┼»j v├Żkon.</div>';
        html += '<button class="btn-accept" style="width:100%; margin-top:4px; border-color:var(--muted-fg); color:var(--muted-fg);" onclick="dismissQuest(\'' + q.id + '\')">­čôü ARCHIVOVAT</button>';
        html += '</div>';
        return html;
    }

    var isUnlocked = isQuestUnlockedForPlayer(q.id);
    var reqIcons = '';
    for (var r = 0; r < q.req.length; r++) {
        reqIcons += '<span class="logistics-badge">­čôŽ ' + q.req[r] + '</span>';
    }

    var html = '<div class="quest-card" id="card-new-' + q.id + '" style="border-color:rgba(255,204,0,0.35);">';
    html += '<div class="quest-assigner-badge">­čôí ' + getQuestAssignerBadge(q) + ' ┬Ě <span style="color:var(--accent-gold);">n├íhodn├Ż rozkaz</span></div>';

    if (!isUnlocked) {
        if (isQuestMissedByPlayer(q.id)) {
            html += '<div class="logistics-error" style="display:block;margin:4px 0;">ÔĆ▒ Lh┼»ta vypr┼íela ÔÇö rank za tuto misi nez├şsk├í┼í.</div>';
        } else {
            html += '<div class="quest-header" style="color:var(--dim-fg);">­čô╗ P┼ś├ŹCHOZ├Ź SIGN├üL (' + q.char + ')</div>';
            html += '<div style="font-size:var(--text-base);color:var(--muted-fg);margin:4px 0;">ÔĆ│ ' + q.time + '</div>';
            if (reqIcons) html += '<div style="margin:4px 0;">' + reqIcons + '</div>';
            html += '<div class="logistics-error" id="log-err-' + q.id + '"></div>';
            html += '<button class="btn-accept" onclick="attemptStartQuest(\'' + q.id + '\')">­čöô SPUSTIT PRO KOMUNITU</button>';
        }
    } else {
        html += '<div class="quest-header">­čô╗ ' + q.char + ': ' + q.title + '</div>';
        html += renderCommunityQuestStatusHtml(q.id, q);
        html += '<div class="quest-body" style="margin-top:4px;">' + q.desc + '</div>';
        html += '<div class="countdown-timer">ÔĆ│ AKTIVN├Ź (' + q.time + ')</div>';
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
    var html = '<p style="font-size:var(--text-sm);color:var(--muted-fg);margin:0 0 8px 0;">N├íhodn├ę impulzn├ş mise od Roxy, ┼á├ęfa, Herberta, Ina a Adama.</p>';
    html += '<button class="btn-accept" style="width:100%; margin-bottom:10px; border-color:var(--accent-gold); color:var(--accent-gold);" onclick="requestNewRandomQuest()">­čÄ▓ VY┼Ż├üDAT NOV├Ł ROZKAZ</button>';

    var shown = 0;
    for (var i = 0; i < list.length; i++) {
        var q = getQuestWithReq(list[i]);
        if (isQuestDismissed(q.id)) continue;
        html += renderRandomQuestCard(q);
        shown++;
    }
    if (shown === 0) {
        html += '<p style="font-size:var(--text-sm);color:var(--faint-fg);text-align:center;margin-bottom:8px;">┼Ż├ídn├ę n├íhodn├ę rozkazy. Stiskni tla─Ź├ştko v├Ż┼íe.</p>';
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
            html += '<div class="quest-completed-badge">Ôťů SPLN─ÜNO: ' + (q.char ? q.char + ' ÔÇö ' : '') + q.title + '</div>';
            html += '<div class="quest-assigner-badge">­čôí ' + getQuestAssignerBadge(q) + '</div>';
            html += '<div class="quest-reward-note">­čÄü Odm─Ťna byla p┼Öips├ína do invent├í┼Öe. Mise zaps├ína do profilu operativce.</div>';
            html += '<button class="btn-accept" style="width:100%; margin-top:4px; border-color:var(--muted-fg); color:var(--muted-fg);" onclick="dismissQuest(\'' + q.id + '\')">­čôü ARCHIVOVAT ├ÜKOL</button>';
            html += '</div>';
            continue;
        }

        var isUnlocked = isQuestUnlockedForPlayer(q.id);
        var reqIcons = "";

        for (var r = 0; r < q.req.length; r++) {
            var reqItem = q.req[r];
            var icon = "­čôŽ";
            if (reqItem.toLowerCase().indexOf('seker') !== -1) icon = "­č¬ô";
            if (reqItem.toLowerCase().indexOf('spac') !== -1) icon = "­čŤî";
            if (reqItem.toLowerCase().indexOf('lan') !== -1) icon = "­č¬ó";
            reqIcons += '<span class="logistics-badge">' + icon + ' ' + reqItem + '</span>';
        }

        html += '<div class="quest-card" id="card-new-' + q.id + '">';
        html += '<div class="quest-assigner-badge">­čôí Zadavatel: ' + getQuestAssignerBadge(q) + ' ┬Ě vlastn├ş</div>';

        if (!isUnlocked) {
            if (isQuestMissedByPlayer(q.id)) {
                html += '<div class="logistics-error" style="display:block;margin:4px 0;">ÔĆ▒ Lh┼»ta vypr┼íela ÔÇö rank za tuto misi nez├şsk├í┼í.</div>';
            } else {
                html += '<div class="quest-header" style="color:var(--dim-fg);">­čöĺ NEODHALEN├ü OPERACE (' + (q.char || 'Mise') + ')</div>';
                if (reqIcons !== "") {
                    html += '<div style="margin: 5px 0;">' + reqIcons + '</div>';
                } else {
                    html += '<div style="margin: 5px 0; font-size:var(--text-sm); color:var(--muted-fg);">(Nevy┼żaduje ┼ż├ídn├ę specifick├ę vybaven├ş)</div>';
                }
                html += '<div style="font-size:var(--text-base); color:var(--subtle-fg); margin-bottom: 4px;">ÔĆ│ P┼Öedpokl├ídan├í doba: ' + q.time + '</div>';
                html += '<div class="logistics-error" id="log-err-' + q.id + '"></div>';
                html += '<button class="btn-accept" onclick="attemptStartQuest(\'' + q.id + '\')">­čöô SPUSTIT PRO KOMUNITU</button>';
            }
        } else {
            html += '<div class="quest-header">­čôí ' + (q.char ? q.char + ': ' : '') + q.title + '</div>';
            html += renderCommunityQuestStatusHtml(q.id, q);
            html += '<div class="quest-body" style="margin-top:4px;">' + q.desc + '</div>';
            html += '<div class="countdown-timer">ÔĆ│ LIMIT OPERACE SPU┼áT─ÜN (' + q.time + ')</div>';
            html += '<div class="quest-footer" style="margin-top:5px;">' + renderQuestActionButtons(q.id) + '</div>';
        }

        html += '</div>';
    }
    if (shown > 0) {
        html = '<div class="quest-section-title" style="margin-top:12px;font-size:var(--text-sm);">­čôő VLASTN├Ź ROZKAZY</div>' + html;
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

/* ÔöÇÔöÇ TIER / RANK SYST├ëM ÔöÇÔöÇ */
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
        return 'Nejvy┼í┼í├ş hodnost dosa┼żena';
    }
    var needed = getMissionsNeededForNextTier(currentCount, currentTier);
    var nextName = rankNames[currentTier];
    var label = formatMissionsNeededLabel(needed);
    var unit = options.unitLabel || 'mis├ş';
    return 'Dal┼í├ş hodnost ' + nextName + ' za ' + label + ' ' + unit;
}

function getPlayerRankProgress(profile) {
    var tier = getEffectivePlayerTier(profile);
    var count = (tier >= 4) ? (profile.globalMissions || 0) : (profile.localMissions || 0);
    return buildNextRankHint(count, tier, PLAYER_RANK_NAMES, { unitLabel: 'mis├ş' });
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
        for (var i = 0; i < tier; i++) s += '­čöŞ';
        return s;
    }
    if (tier === 4) return 'ÔşÉÔşÉÔşÉÔşÉ';
    return 'ÔşÉÔşÉÔşÉÔşÉÔşÉ';
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
    if (chips.length === 0) return '<span style="color:var(--faint-fg);">Zat├şm ┼ż├ídn├ę specializace</span>';
    var total = totalMissions != null ? totalMissions : sumIssuerStats(stats);
    var tier = getTierFromMissionCount(total);
    var lead = getSpecialization(stats);
    var html = chips.join(' ┬Ě ');
    if (lead) {
        if (tier >= 5) {
            html += '<div class="specialization-line" style="margin-top:2px;">­čĆć ' + lead + '</div>';
        } else {
            html += '<div style="margin-top:2px; color:var(--muted-fg);">Sm─Ťr Ôćĺ ' + lead + '</div>';
        }
    }
    return html;
}

function getQuestAssignerBadge(quest) {
    var key = getIssuerKey(quest);
    var label = ISSUER_LABELS[key] || quest.char || 'Mise';
    var spec = SPECIALIZATION_MAP[key];
    return spec ? (label + ' ┬Ě ' + spec) : label;
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

/* ÔöÇÔöÇ PROFIL HR├ü─îE ÔöÇÔöÇ */
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
    var charToKey = { 'Roxy': 'roxy', '┼á├ęf': 'sef', 'Herbert': 'herbert', 'Ino': 'ino', 'Adam': 'adam' };
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

/** Talisman na z├ídech ÔÇ×za┼żije" misi ÔÇö historie z┼»st├ív├í nav┼żdy. */
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
        alert('Prvotn├ş pozi─Źn├ş ├║koly nelze archivovat ÔÇö body z┼»st├ívaj├ş sou─Ź├íst├ş sektoru.');
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

/** Prvotn├ş pozi─Źn├ş ├║koly: bod v┼żdy na map─Ť. N├íhodn├ę/vlastn├ş: skr├Żt po archivaci. */
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
        el.innerHTML = '<p style="font-size:var(--text-sm); color:var(--panel-subtle); margin:0;">Zat├şm ┼ż├ídn├ę z├íznamy o p┼Öestupu...</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < profile.chronicle.length; i++) {
        var c = profile.chronicle[i];
        html += '<div class="chronicle-entry">­čôť ' + c.date + ': Opustil <strong>' + c.from + '</strong> (' + c.missionsInClan + ' mis├ş) Ôćĺ vstoupil do <strong>' + c.to + '</strong></div>';
    }
    el.innerHTML = html;
}

function renderMissionLog() {
    var el = document.getElementById('mission-log-list');
    if (!el) return;
    var profile = getPlayerProfile();
    if (!profile.missionLog || profile.missionLog.length === 0) {
        el.innerHTML = '<p style="font-size:var(--text-sm); color:var(--panel-subtle); margin:0;">Mise se zapisuj├ş do profilu po spln─Ťn├ş...</p>';
        return;
    }
    var html = '';
    var limit = Math.min(profile.missionLog.length, 20);
    for (var i = 0; i < limit; i++) {
        var m = profile.missionLog[i];
        var q = m.questId ? getQuestById(m.questId) : null;
        var title = q ? q.title : (m.title || 'ÔÇö');
        var charLabel = q ? (q.char || m.char) : (m.char || 'Mise');
        html += '<div class="mission-log-entry">Ôśú´ŞĆ ' + charLabel + ': ' + title + ' <span style="color:var(--muted-fg);">(' + m.date + ')</span></div>';
    }
    el.innerHTML = html;
}

/* ÔöÇÔöÇ UTIL ÔöÇÔöÇ */
