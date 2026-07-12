import { isValidCodeFormat, normalizeCode } from './codes.js';
import { CODED_QUEST_PHASE, POCTA_PHASE } from './constants.js';
import { isOwner } from './permissions.js';
import { grantPoctaToCommunity } from './rewards.js';
import { simulateQuestPoctaReward } from './quest-rewards.js';
import { isCodedQuestEntity, isPoctaEntity } from './types.js';
import { panToEntity, reloadPoctaMapMarkers } from './map-bridge.js';
import {
    activateCodeForUser,
    createAndStoreCodedQuest,
    getActivatedEntities,
    loadRegistry
} from './storage.js';

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function entityPhaseLabel(entity) {
    if (isPoctaEntity(entity)) {
        if (entity.phase === POCTA_PHASE.INACTIVE) return 'Neaktivovaná';
        if (entity.phase === POCTA_PHASE.ANCHORED) return 'Ukotvená';
        return entity.phase;
    }
    if (isCodedQuestEntity(entity)) {
        if (entity.phase === CODED_QUEST_PHASE.MYSTERY) return 'Záhada';
        if (entity.phase === CODED_QUEST_PHASE.ACTIVE) return 'Aktivní úkol';
        if (entity.phase === CODED_QUEST_PHASE.COMPLETED) return 'Splněno';
        return entity.phase;
    }
    return '—';
}

function entityTypeLabel(entity) {
    if (isPoctaEntity(entity)) return 'Pocta';
    if (isCodedQuestEntity(entity)) return 'Fázovaný úkol';
    return 'Entita';
}

export function renderTerminalPanel(ctx) {
    var listEl = document.getElementById('terminal-activated-list');
    var msgEl = document.getElementById('terminal-last-message');
    if (!listEl) return;

    var registry = loadRegistry();
    var entities = getActivatedEntities(ctx.userId, registry);

    if (entities.length === 0) {
        listEl.innerHTML = '<p style="font-size:var(--text-sm);color:var(--faint-fg);margin:0;">Zatím žádné aktivované kódy. Zadej kód výše.</p>';
        return;
    }

    var html = '';
    for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        var own = isOwner(e, ctx.userId);
        var border = own ? 'rgba(232,197,71,0.45)' : 'rgba(136,136,136,0.35)';
        html += '<div class="quest-card terminal-entry-card" style="margin-bottom:8px;border-color:' + border + ';">';
        html += '<div style="font-size:var(--text-xs);color:#888;">' + entityTypeLabel(e) + ' · ' + (own ? 'Moje' : 'Sdílené') + '</div>';
        html += '<div class="quest-header" style="font-size:var(--text-base);margin-top:2px;">' + escapeHtml(e.title) + '</div>';
        html += '<div style="font-size:var(--text-sm);color:#aaa;">Kód: <strong style="color:var(--text-green);letter-spacing:0.12em;">' + escapeHtml(e.code) + '</strong> · ' + entityPhaseLabel(e) + '</div>';
        html += '<div class="story-pos-actions" style="margin-top:6px;">';
        if (e.lat != null && e.lng != null) {
            html += '<button type="button" class="btn-accept" style="border-color:var(--xp-blue);color:var(--xp-blue);font-size:var(--text-xs);padding:6px 4px;" onclick="patracTerminalPanTo(\'' + escapeHtml(e.code) + '\')">🗺️ MAPA</button>';
        }
        html += '</div></div>';
    }
    listEl.innerHTML = html;

    if (msgEl && !msgEl.dataset.sticky) {
        msgEl.textContent = entities.length + ' aktivovaných bodů v terminálu.';
    }
}

export function submitTerminalCode(rawCode, ctx) {
    var msgEl = document.getElementById('terminal-last-message');
    var code = normalizeCode(rawCode);
    if (!isValidCodeFormat(code)) {
        if (msgEl) msgEl.textContent = 'Kód musí mít přesně 6 znaků (A–Z, 2–9).';
        return { ok: false, error: 'invalid_format' };
    }

    var result = activateCodeForUser(ctx.userId, code);
    if (!result.ok) {
        if (msgEl) {
            msgEl.textContent = result.error || 'Kód nenalezen.';
            msgEl.dataset.sticky = '1';
        }
        return result;
    }

    if (msgEl) {
        msgEl.textContent = 'Kód ' + code + ' aktivován: ' + (result.entity.title || entityTypeLabel(result.entity));
        msgEl.dataset.sticky = '1';
    }

    reloadPoctaMapMarkers(ctx.userId);
    renderTerminalPanel(ctx);

    var input = document.getElementById('terminal-code-input');
    if (input) input.value = '';

    return result;
}

export function createDemoPocta(ctx) {
    var result = grantPoctaToCommunity({
        questId: 'demo_pocta_' + Date.now(),
        questTitle: 'Demonstrace',
        title: 'Pocta prvnímu táboru',
        story: 'Zde jsme poprvé přežili noc. Ticho lesa, dešťová voda a jedna svíčka.',
        userId: ctx.userId,
        userName: ctx.userName,
        force: true
    });
    return result.ok ? result.entity : null;
}

export function createDemoCodedQuest(ctx) {
    var pos = window.patracPoctaBridge && window.patracPoctaBridge.lastUserPosition;
    var entity = createAndStoreCodedQuest({
        ownerUserId: ctx.userId,
        ownerName: ctx.userName,
        title: 'Záhadný signál',
        desc: 'Někdo zde zanechal stopu. Prozkoumej okolí a zapiš, co najdeš.',
        phase: CODED_QUEST_PHASE.MYSTERY,
        lat: pos ? pos.lat + 0.001 : 49.716,
        lng: pos ? pos.lng + 0.001 : 13.221
    });
    activateCodeForUser(ctx.userId, entity.code);
    reloadPoctaMapMarkers(ctx.userId);
    renderTerminalPanel(ctx);
    return entity;
}

export function bindTerminalUi(ctx) {
    var form = document.getElementById('terminal-code-form');
    if (form && !form._poctaBound) {
        form._poctaBound = true;
        form.addEventListener('submit', function(ev) {
            ev.preventDefault();
            var input = document.getElementById('terminal-code-input');
            submitTerminalCode(input ? input.value : '', ctx);
        });
    }

    var demoPoctaBtn = document.getElementById('terminal-demo-pocta');
    if (demoPoctaBtn && !demoPoctaBtn._poctaBound) {
        demoPoctaBtn._poctaBound = true;
        demoPoctaBtn.addEventListener('click', function() {
            var entity = createDemoPocta(ctx);
            var msgEl = document.getElementById('terminal-last-message');
            if (entity && msgEl) {
                msgEl.textContent = 'Pocta v inventáři komunity. Kód: ' + entity.code;
                msgEl.dataset.sticky = '1';
            }
            alert(entity
                ? '🕯️ Pocta „' + entity.title + '“ je ve skladu komunity (neaktivovaná).\nKód: ' + entity.code + '\n\n→ záložka 🎒 Inventář'
                : 'Nepodařilo se vytvořit Poctu.');
        });
    }

    var simQuestBtn = document.getElementById('terminal-sim-quest-pocta');
    if (simQuestBtn && !simQuestBtn._poctaBound) {
        simQuestBtn._poctaBound = true;
        simQuestBtn.addEventListener('click', function() {
            var result = simulateQuestPoctaReward();
            if (!result.ok) {
                alert('Simulace selhala — jsi v komunitě?');
                return;
            }
            var entity = result.entity;
            var msgEl = document.getElementById('terminal-last-message');
            if (msgEl) {
                msgEl.textContent = 'Simulace mise → Pocta v inventáři komunity. Kód: ' + entity.code;
                msgEl.dataset.sticky = '1';
            }
            alert('✅ Simulace splnění mise.\n\n🕯️ Komunita získala: „' + entity.title + '“\nKód: ' + entity.code + '\n\n→ 🎒 Inventář komunity');
        });
    }

    var demoQuestBtn = document.getElementById('terminal-demo-quest');
    if (demoQuestBtn && !demoQuestBtn._poctaBound) {
        demoQuestBtn._poctaBound = true;
        demoQuestBtn.addEventListener('click', function() {
            var entity = createDemoCodedQuest(ctx);
            alert('❓ Fázovaný úkol vytvořen a aktivován.\nKód: ' + entity.code + '\n\nNa mapě uvidíš šedý marker Záhada.');
        });
    }

    renderTerminalPanel(ctx);
}

export function terminalPanTo(code) {
    return panToEntity(code);
}
