/** Admin UI — Data karta (CRUD ve všech složkách + obrázky). */
import {
    DATA_PANELS,
    loadDataContentStore,
    getPanelEntries,
    upsertPanelEntry,
    deletePanelEntry,
    suggestEntryId,
    normalizeEntry
} from './dataContentStore.js';

var editingPanel = 'lore';
var editingId = null;
var draftBlocks = [];
var bound = false;

function el(id) {
    return document.getElementById(id);
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
}

function val(id) {
    var node = el(id);
    return node ? String(node.value || '').trim() : '';
}

function setVal(id, value) {
    var node = el(id);
    if (node) node.value = value == null ? '' : String(value);
}

function panelLabel(key) {
    for (var i = 0; i < DATA_PANELS.length; i++) {
        if (DATA_PANELS[i].key === key) return DATA_PANELS[i].label;
    }
    return key;
}

function readFileAsDataUrl(file) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function refreshDataKartaPanels() {
    if (typeof window.patracRefreshDataKarta === 'function') {
        try { window.patracRefreshDataKarta(); } catch (e) {}
    }
}

function renderBlockEditor() {
    var host = el('data-admin-blocks');
    if (!host) return;

    if (!draftBlocks.length) {
        host.innerHTML = '<p class="data-admin-blocks-empty">Zatím žádný obsah — přidej text nebo obrázek.</p>';
        return;
    }

    host.innerHTML = draftBlocks.map(function(block, index) {
        if (block.type === 'text') {
            return (
                '<div class="data-admin-block" data-block-index="' + index + '" data-block-type="text">' +
                    '<div class="data-admin-block-head">' +
                        '<span>Text</span>' +
                        '<div class="data-admin-block-actions">' +
                            '<button type="button" class="data-admin-mini" data-act="up" title="Nahoru">▲</button>' +
                            '<button type="button" class="data-admin-mini" data-act="down" title="Dolů">▼</button>' +
                            '<button type="button" class="data-admin-mini danger" data-act="remove" title="Smazat">✕</button>' +
                        '</div>' +
                    '</div>' +
                    '<textarea class="data-admin-text-block" rows="4" placeholder="Text odstavce…">' +
                        escapeHtml(block.content) +
                    '</textarea>' +
                '</div>'
            );
        }

        var wrapChecked = block.wrap ? ' checked' : '';
        return (
            '<div class="data-admin-block" data-block-index="' + index + '" data-block-type="image">' +
                '<div class="data-admin-block-head">' +
                    '<span>Obrázek / GIF</span>' +
                    '<div class="data-admin-block-actions">' +
                        '<button type="button" class="data-admin-mini" data-act="up" title="Nahoru">▲</button>' +
                        '<button type="button" class="data-admin-mini" data-act="down" title="Dolů">▼</button>' +
                        '<button type="button" class="data-admin-mini danger" data-act="remove" title="Smazat">✕</button>' +
                    '</div>' +
                '</div>' +
                '<div class="data-admin-image-preview">' +
                    '<img src="' + escapeAttr(block.src) + '" alt="' + escapeAttr(block.alt || '') + '">' +
                '</div>' +
                '<div class="data-admin-image-controls">' +
                    '<label>Velikost <input type="range" class="data-admin-width" min="20" max="100" step="5" value="' +
                        escapeAttr(block.widthPct) + '"> <span class="data-admin-width-val">' + block.widthPct + '%</span></label>' +
                    '<label>Zarovnání <select class="data-admin-align">' +
                        '<option value="left"' + (block.align === 'left' ? ' selected' : '') + '>Vlevo</option>' +
                        '<option value="center"' + (block.align === 'center' ? ' selected' : '') + '>Na střed</option>' +
                        '<option value="right"' + (block.align === 'right' ? ' selected' : '') + '>Vpravo</option>' +
                    '</select></label>' +
                    '<label class="data-admin-check"><input type="checkbox" class="data-admin-wrap"' + wrapChecked + '> Obtekání textu</label>' +
                    '<label>Popisek <input type="text" class="data-admin-alt" value="' + escapeAttr(block.alt || '') + '" placeholder="Volitelný alt text"></label>' +
                '</div>' +
            '</div>'
        );
    }).join('');

    host.querySelectorAll('.data-admin-block').forEach(function(blockEl) {
        var index = Number(blockEl.getAttribute('data-block-index'));
        var type = blockEl.getAttribute('data-block-type');

        blockEl.querySelectorAll('[data-act]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                syncBlocksFromDom();
                var act = btn.getAttribute('data-act');
                if (act === 'remove') {
                    draftBlocks.splice(index, 1);
                } else if (act === 'up' && index > 0) {
                    var tmp = draftBlocks[index - 1];
                    draftBlocks[index - 1] = draftBlocks[index];
                    draftBlocks[index] = tmp;
                } else if (act === 'down' && index < draftBlocks.length - 1) {
                    var tmp2 = draftBlocks[index + 1];
                    draftBlocks[index + 1] = draftBlocks[index];
                    draftBlocks[index] = tmp2;
                }
                renderBlockEditor();
            });
        });

        if (type === 'text') {
            var ta = blockEl.querySelector('.data-admin-text-block');
            if (ta) {
                ta.addEventListener('input', function() {
                    draftBlocks[index].content = ta.value;
                });
            }
            return;
        }

        var width = blockEl.querySelector('.data-admin-width');
        var widthVal = blockEl.querySelector('.data-admin-width-val');
        if (width) {
            width.addEventListener('input', function() {
                draftBlocks[index].widthPct = Number(width.value);
                if (widthVal) widthVal.textContent = width.value + '%';
                var img = blockEl.querySelector('.data-admin-image-preview img');
                if (img) img.style.maxWidth = width.value + '%';
            });
        }
        var align = blockEl.querySelector('.data-admin-align');
        if (align) {
            align.addEventListener('change', function() {
                draftBlocks[index].align = align.value;
            });
        }
        var wrap = blockEl.querySelector('.data-admin-wrap');
        if (wrap) {
            wrap.addEventListener('change', function() {
                draftBlocks[index].wrap = wrap.checked;
            });
        }
        var alt = blockEl.querySelector('.data-admin-alt');
        if (alt) {
            alt.addEventListener('input', function() {
                draftBlocks[index].alt = alt.value;
            });
        }
    });
}

function syncBlocksFromDom() {
    var host = el('data-admin-blocks');
    if (!host) return;
    host.querySelectorAll('.data-admin-block').forEach(function(blockEl) {
        var index = Number(blockEl.getAttribute('data-block-index'));
        var block = draftBlocks[index];
        if (!block) return;
        if (block.type === 'text') {
            var ta = blockEl.querySelector('.data-admin-text-block');
            if (ta) block.content = ta.value;
        } else if (block.type === 'image') {
            var width = blockEl.querySelector('.data-admin-width');
            var align = blockEl.querySelector('.data-admin-align');
            var wrap = blockEl.querySelector('.data-admin-wrap');
            var alt = blockEl.querySelector('.data-admin-alt');
            if (width) block.widthPct = Number(width.value);
            if (align) block.align = align.value;
            if (wrap) block.wrap = wrap.checked;
            if (alt) block.alt = alt.value;
        }
    });
}

function resetForm() {
    editingId = null;
    draftBlocks = [{ type: 'text', content: '' }];
    setVal('data-admin-title', '');
    setVal('data-admin-keywords', '');
    setVal('data-admin-id', '');
    var idInput = el('data-admin-id');
    if (idInput) idInput.readOnly = false;
    var titleEl = el('data-admin-form-title');
    if (titleEl) titleEl.textContent = '＋ Nový příspěvek — ' + panelLabel(editingPanel);
    renderBlockEditor();
}

function writeForm(entry) {
    editingId = entry.id;
    draftBlocks = (entry.blocks || []).map(function(block) {
        if (block.type === 'image') {
            return {
                type: 'image',
                src: block.src,
                widthPct: block.widthPct,
                align: block.align,
                wrap: block.wrap,
                alt: block.alt
            };
        }
        return { type: 'text', content: block.content || '' };
    });
    if (!draftBlocks.length) draftBlocks = [{ type: 'text', content: '' }];
    setVal('data-admin-id', entry.id);
    setVal('data-admin-title', entry.title);
    setVal('data-admin-keywords', (entry.keywords || []).join(', '));
    var idInput = el('data-admin-id');
    if (idInput) idInput.readOnly = true;
    var titleEl = el('data-admin-form-title');
    if (titleEl) titleEl.textContent = '✎ Upravit — ' + panelLabel(editingPanel);
    renderBlockEditor();
}

function renderList() {
    var list = el('data-admin-list');
    if (!list) return;
    var entries = getPanelEntries(editingPanel);
    if (!entries.length) {
        list.innerHTML = '<p class="data-admin-empty">Ve složce zatím nic není.</p>';
        return;
    }
    list.innerHTML = entries.map(function(entry) {
        var active = editingId === entry.id ? ' active' : '';
        return (
            '<button type="button" class="data-admin-list-item' + active + '" data-entry-id="' + escapeAttr(entry.id) + '">' +
                '<span class="data-admin-list-title">' + escapeHtml(entry.title) + '</span>' +
                '<span class="data-admin-list-meta">' + escapeHtml(entry.id) + '</span>' +
            '</button>'
        );
    }).join('');

    list.querySelectorAll('.data-admin-list-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var id = item.getAttribute('data-entry-id');
            var found = getPanelEntries(editingPanel).find(function(e) { return e.id === id; });
            if (found) writeForm(found);
            renderList();
        });
    });
}

function saveFromForm() {
    syncBlocksFromDom();
    var title = val('data-admin-title');
    if (!title) {
        alert('Vyplň název příspěvku.');
        return;
    }
    var panelEntries = getPanelEntries(editingPanel);
    var ids = panelEntries.map(function(e) { return e.id; });
    var id = val('data-admin-id');
    if (!id) {
        id = suggestEntryId(title, ids);
        setVal('data-admin-id', id);
    }
    if (!editingId && ids.indexOf(id) !== -1) {
        alert('ID už existuje — zvol jiné.');
        return;
    }

    var entry = normalizeEntry({
        id: id,
        title: title,
        keywords: val('data-admin-keywords'),
        blocks: draftBlocks.filter(function(block) {
            if (block.type === 'text') return String(block.content || '').trim().length > 0;
            if (block.type === 'image') return !!block.src;
            return false;
        })
    });
    if (!entry) {
        alert('Příspěvek musí mít název a alespoň jeden blok obsahu.');
        return;
    }

    upsertPanelEntry(editingPanel, entry);
    editingId = entry.id;
    var idInput = el('data-admin-id');
    if (idInput) idInput.readOnly = true;
    renderList();
    refreshDataKartaPanels();
}

function deleteCurrent() {
    if (!editingId) return;
    if (!confirm('Smazat příspěvek „' + val('data-admin-title') + '“?')) return;
    deletePanelEntry(editingPanel, editingId);
    resetForm();
    renderList();
    refreshDataKartaPanels();
}

function onPanelChange() {
    var sel = el('data-admin-panel');
    editingPanel = sel ? (sel.value || 'lore') : 'lore';
    resetForm();
    renderList();
}

async function onImagePick(ev) {
    var input = ev.target;
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (!/^image\//i.test(file.type)) {
        alert('Vyber obrázek nebo GIF.');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        alert('Soubor je příliš velký (max 2 MB).');
        return;
    }
    try {
        syncBlocksFromDom();
        var src = await readFileAsDataUrl(file);
        draftBlocks.push({
            type: 'image',
            src: src,
            widthPct: 60,
            align: 'left',
            wrap: true,
            alt: file.name.replace(/\.[^.]+$/, '')
        });
        renderBlockEditor();
    } catch (e) {
        console.warn('[dataAdmin] image', e);
        alert('Obrázek se nepodařilo načíst.');
    }
}

function bindUi() {
    if (bound) return;
    bound = true;

    var panelSel = el('data-admin-panel');
    if (panelSel) {
        panelSel.innerHTML = DATA_PANELS.map(function(panel) {
            return '<option value="' + escapeAttr(panel.key) + '">' + escapeHtml(panel.label) + '</option>';
        }).join('');
        panelSel.value = editingPanel;
        panelSel.addEventListener('change', onPanelChange);
    }

    var saveBtn = el('data-admin-save');
    if (saveBtn) saveBtn.addEventListener('click', function(e) {
        e.preventDefault();
        saveFromForm();
    });

    var newBtn = el('data-admin-new');
    if (newBtn) newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        resetForm();
        renderList();
    });

    var delBtn = el('data-admin-delete');
    if (delBtn) delBtn.addEventListener('click', function(e) {
        e.preventDefault();
        deleteCurrent();
    });

    var addTextBtn = el('data-admin-add-text');
    if (addTextBtn) addTextBtn.addEventListener('click', function(e) {
        e.preventDefault();
        syncBlocksFromDom();
        draftBlocks.push({ type: 'text', content: '' });
        renderBlockEditor();
    });

    var addImageBtn = el('data-admin-add-image');
    var imageInput = el('data-admin-image-input');
    if (addImageBtn && imageInput) {
        addImageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            imageInput.click();
        });
        imageInput.addEventListener('change', onImagePick);
    }

    var titleInput = el('data-admin-title');
    if (titleInput) {
        titleInput.addEventListener('blur', function() {
            var idInput = el('data-admin-id');
            if (!idInput || idInput.readOnly || val('data-admin-id')) return;
            var ids = getPanelEntries(editingPanel).map(function(e) { return e.id; });
            setVal('data-admin-id', suggestEntryId(val('data-admin-title'), ids));
        });
    }
}

export async function initDataAdminUi() {
    await loadDataContentStore();
    bindUi();
    resetForm();
    renderList();
}

export function refreshDataAdminUi() {
    bindUi();
    renderList();
    if (editingId) {
        var found = getPanelEntries(editingPanel).find(function(e) { return e.id === editingId; });
        if (found) writeForm(found);
        else resetForm();
    }
}
