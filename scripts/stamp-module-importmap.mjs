/**
 * Do index.html doplní import mapu: každý /src/*.js → ?v=PATRAC_BUILD.
 * Safari kešuje vnořené ES importy (from './radioHitmap.js') bez query — bez mapy
 * zůstane stará vysílačka, dokud se nesmaže celá cache webu.
 *
 * Spuštění: node scripts/stamp-module-importmap.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');
const globalsPath = join(root, 'src', 'app', '01-globals.js');
const srcDir = join(root, 'src');

function readBuild() {
    const src = readFileSync(globalsPath, 'utf8');
    const m = src.match(/var PATRAC_BUILD = '([^']+)'/);
    if (!m) throw new Error('PATRAC_BUILD nenalezen v 01-globals.js');
    return m[1];
}

function listJsFiles(dir, acc) {
    const entries = readdirSync(dir);
    for (const name of entries) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
            listJsFiles(full, acc);
            continue;
        }
        if (name.endsWith('.js')) acc.push(full);
    }
    return acc;
}

function toSrcUrl(absPath) {
    return '/' + relative(root, absPath).replace(/\\/g, '/');
}

const build = readBuild();
const html = readFileSync(htmlPath, 'utf8');
const mapRe = /<script type="importmap"[^>]*>\s*([\s\S]*?)<\/script>/;
const match = html.match(mapRe);
if (!match) throw new Error('importmap v index.html nenalezena');

const map = JSON.parse(match[1]);
if (!map.imports || typeof map.imports !== 'object') {
    throw new Error('importmap nemá imports');
}

const vendor = {};
for (const [key, value] of Object.entries(map.imports)) {
    if (key.startsWith('/src/') || key.startsWith('./src/')) continue;
    vendor[key] = value;
}

const files = listJsFiles(srcDir, []).sort();
const imports = { ...vendor };
for (const file of files) {
    const url = toSrcUrl(file);
    imports[url] = url + '?v=' + build;
}

const formatted = JSON.stringify({ imports }, null, 4)
    .split('\n')
    .map(function(line) { return '    ' + line; })
    .join('\n');

const next = html.replace(mapRe, '<script type="importmap">\n' + formatted + '\n    </script>');
writeFileSync(htmlPath, next);
console.log('Import mapa: ' + files.length + ' modulů, v=' + build);
