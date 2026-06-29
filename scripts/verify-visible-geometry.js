#!/usr/bin/env node
/*
  VERIFY VISIBLE GEOMETRY — hard guard for CL-63 / Indra geometry.
  This checks the source contract, not just the engine. The older geometry
  gate could pass because many pages were classified as static-search or
  because geometry was present as an engine invariant but invisible/disabled
  on key pages.
*/
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.netlify']);
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
const htmlFiles = walk(ROOT);
const errors = [];
const warnings = [];
for (const file of htmlFiles) {
  const r = rel(file);
  const html = fs.readFileSync(file, 'utf8');
  if (!/alive\.css/.test(html)) errors.push(`${r}: missing alive.css include`);
  if (!/\/js\/mandala\.js/.test(html)) errors.push(`${r}: missing mandala.js include`);
  if (!/\/js\/indra\.js/.test(html)) errors.push(`${r}: missing indra.js include`);
  if (!/<body\b/i.test(html)) { continue; }
  if (!/<body\b[^>]*data-geometry=["']indra-web["']/i.test(html)) errors.push(`${r}: body missing data-geometry="indra-web"`);
  if (!/<body\b[^>]*data-indra-intensity=["'][0-9.]+["']/i.test(html)) errors.push(`${r}: body missing data-indra-intensity`);
  const key = /^(polymythseminars|writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships|saul)\//.test(r) || r === 'index.html';
  if (key && !(/id=["']geo["']/.test(html) || /id=["']indraLayer["']/.test(html) || /\/js\/indra\.js/.test(html))) {
    errors.push(`${r}: key page has no visible geometry mount path`);
  }
}
const indraPath = path.join(ROOT, 'js', 'indra.js');
const alivePath = path.join(ROOT, 'css', 'alive.css');
if (!fs.existsSync(indraPath)) errors.push('js/indra.js missing');
else {
  const indra = fs.readFileSync(indraPath, 'utf8');
  if (!/VISIBLE_GEOMETRY_GUARD/.test(indra)) warnings.push('js/indra.js lacks VISIBLE_GEOMETRY_GUARD marker');
  if (/document\.getElementById\(['"]printCv['"]\)/.test(indra)) errors.push('js/indra.js still disables geometry on CV pages via #printCv');
  if (!/layer\.id\s*=\s*['"]indraLayer['"]/.test(indra)) errors.push('js/indra.js does not create #indraLayer');
}
if (!fs.existsSync(alivePath)) errors.push('css/alive.css missing');
else {
  const alive = fs.readFileSync(alivePath, 'utf8');
  if (!/#indraLayer\s*\{/.test(alive)) errors.push('css/alive.css missing #indraLayer styling');
  if (!/VISIBLE_GEOMETRY_CONTRACT/.test(alive)) warnings.push('css/alive.css lacks VISIBLE_GEOMETRY_CONTRACT marker');
}
if (errors.length) {
  console.error('VISIBLE GEOMETRY CHECK FAILED');
  for (const e of errors.slice(0, 120)) console.error(' - ' + e);
  if (errors.length > 120) console.error(` ... ${errors.length - 120} more`);
  process.exit(1);
}
if (warnings.length) {
  console.warn('VISIBLE GEOMETRY WARNINGS');
  for (const w of warnings) console.warn(' - ' + w);
}
console.log(`VISIBLE GEOMETRY CHECK PASSED — ${htmlFiles.length} HTML pages carry alive.css, mandala.js, indra.js, body geometry markers, and CV pages are not excluded.`);
