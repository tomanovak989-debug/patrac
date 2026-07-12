/**
 * Jednorázová migrace: font-size: Npx → var(--text-*)
 * Spuštění: node scripts/migrate-font-vars.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = [
    path.join(root, 'index.html'),
    path.join(root, 'predstaveni.html')
];

const replacements = [
    ['24px', 'var(--text-icon-lg)'],
    ['22px', 'var(--text-title)'],
    ['20px', 'var(--text-heading)'],
    ['18px', 'var(--text-heading)'],
    ['16px', 'var(--text-base)'],
    ['14px', 'var(--text-heading)'],
    ['13px', 'var(--text-base)'],
    ['12px', 'var(--text-lg)'],
    ['11px', 'var(--text-md)'],
    ['10px', 'var(--text-base)'],
    ['9px', 'var(--text-sm)'],
    ['8px', 'var(--text-xs)'],
    ['7px', 'var(--text-xxs)'],
    ['6px', 'var(--text-micro)']
];

function migrate(content) {
    let out = content;

    out = out.replace(/var\(--font-size-base(?:,\s*10px)?\)/g, 'var(--text-base)');
    out = out.replace(/var\(--font-size-sm(?:,\s*9px)?\)/g, 'var(--text-sm)');
    out = out.replace(/var\(--font-size-heading\)/g, 'var(--text-heading)');
    out = out.replace(/var\(--font-size-title\)/g, 'var(--text-title)');

    for (const [px, varName] of replacements) {
        const esc = px.replace('.', '\\.');
        out = out.replace(new RegExp('font-size:\\s*' + esc + '(\\s*!important)?', 'g'), 'font-size: ' + varName + '$1');
    }

    return out;
}

for (const file of targets) {
    const before = fs.readFileSync(file, 'utf8');
    const after = migrate(before);
    fs.writeFileSync(file, after, 'utf8');

    const remain = (after.match(/font-size:\s*\d+px/g) || []).length;
    console.log(path.basename(file) + ': remaining hardcoded font-size:', remain);
}
