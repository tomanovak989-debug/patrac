/**
 * SECTOR-TECH — scroll (2 kroky) a dotykové overlay nad fotkou vysílačky.
 */
function el(id) {
    return document.getElementById(id);
}

function snapScrollToNearestStep(scroll) {
    var max = scroll.scrollHeight - scroll.clientHeight;
    if (max <= 4) return;
    var mid = max * 0.5;
    var target = scroll.scrollTop < mid ? 0 : max;
    if (Math.abs(scroll.scrollTop - target) > 6) {
        scroll.scrollTo({ top: target, behavior: 'smooth' });
    }
}

export function initSectorTechShell() {
    var scroll = el('sector-tech-scroll');
    if (!scroll || scroll._sectorBound) return;
    scroll._sectorBound = true;

    var topBtn = el('sector-scroll-top');
    var botBtn = el('sector-scroll-bottom');
    if (topBtn) {
        topBtn.addEventListener('click', function() {
            scroll.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    if (botBtn) {
        botBtn.addEventListener('click', function() {
            scroll.scrollTo({ top: scroll.scrollHeight - scroll.clientHeight, behavior: 'smooth' });
        });
    }

    var snapTimer = null;
    scroll.addEventListener('scroll', function() {
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(function() {
            snapScrollToNearestStep(scroll);
        }, 140);
    }, { passive: true });

    /* Výchozí pohled: anténa + displej (krok 1) */
    scroll.scrollTop = 0;
}
