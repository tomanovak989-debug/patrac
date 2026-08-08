/**
 * SECTOR-TECH — 2-krokový scroll + kalibrace overlay (800×800 PNG, scale 2.85).
 *
 * Snap 0: anténa + knoflíky + celý displej
 * Snap 1: celý displej + klávesnice (scroll mírně nad spodek obrázku)
 */
function el(id) {
    return document.getElementById(id);
}

/** Podíl výšky stage (0–1) — kalibrace k sector-tech-front.png */
var LAYOUT = {
    displayTop: 0.185,
    displayBottom: 0.445,
    keypadTop: 0.48
};

var snapBottomPx = 0;

function measureStage(scroll) {
    var stage = scroll.querySelector('.sector-tech-stage');
    if (!stage) return null;
    var stageH = stage.offsetHeight;
    var viewH = scroll.clientHeight;
    var max = Math.max(0, stageH - viewH);
    var margin = Math.max(8, viewH * 0.015);
    snapBottomPx = Math.max(0, Math.min(max, stageH * LAYOUT.displayTop - margin));
    return { stageH: stageH, viewH: viewH, max: max };
}

function snapScrollToNearestStep(scroll) {
    var m = measureStage(scroll);
    if (!m || m.max <= 4) return;
    var mid = (snapBottomPx || m.max * 0.5) * 0.5;
    var target = scroll.scrollTop < mid ? 0 : snapBottomPx;
    if (Math.abs(scroll.scrollTop - target) > 6) {
        scroll.scrollTo({ top: target, behavior: 'smooth' });
    }
}

export function initSectorTechShell() {
    var scroll = el('sector-tech-scroll');
    if (!scroll || scroll._sectorBound) return;
    scroll._sectorBound = true;

    function remeasure() {
        measureStage(scroll);
    }
    remeasure();

    var img = el('sector-tech-img');
    if (img && !img.complete) {
        img.addEventListener('load', remeasure);
    }

    if (!window._patracSectorResizeBound) {
        window._patracSectorResizeBound = true;
        var rt;
        window.addEventListener('resize', function() {
            if (rt) clearTimeout(rt);
            rt = setTimeout(function() {
                if (scroll) measureStage(scroll);
            }, 120);
        });
    }

    var snapTimer = null;
    scroll.addEventListener('scroll', function() {
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(function() {
            snapScrollToNearestStep(scroll);
        }, 140);
    }, { passive: true });

    scroll.scrollTop = 0;
}

export function scrollSectorTechTo(step) {
    var scroll = el('sector-tech-scroll');
    if (!scroll) return;
    measureStage(scroll);
    scroll.scrollTo({ top: step === 1 ? snapBottomPx : 0, behavior: 'smooth' });
}
