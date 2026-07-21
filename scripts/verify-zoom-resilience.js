#!/usr/bin/env node
/*
  VERIFY ZOOM RESILIENCE — source-level guard for browser zoom/reflow.
  The site has many one-off pages and generated catalog pages; this guard
  enforces the shared CSS contract that keeps words, cards, controls, and
  geometry from clipping when zoom changes the effective viewport.
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', '.netlify', 'public', 'fixtures']);
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile() && e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
const htmls = walk(ROOT);
const errors = [];
const warnings = [];
const alivePath = path.join(ROOT, 'css', 'alive.css');
if (!fs.existsSync(alivePath)) errors.push('css/alive.css missing');
else {
  const css = fs.readFileSync(alivePath, 'utf8');
  const required = [
    ['ZOOM_RESILIENCE_CONTRACT marker', /ZOOM_RESILIENCE_CONTRACT/],
    ['text-size-adjust preserved', /text-size-adjust:\s*100%/],
    ['global min-width:0 guard', /min-width:\s*0/],
    ['text wrapping guard', /overflow-wrap:\s*(break-word|anywhere)/],
    ['replaced media max-width guard', /img,\s*svg,\s*video,\s*canvas,\s*iframe/],
    ['Indra layer zoom guard', /#indraLayer\s*\{[\s\S]*inset:\s*-14vmax/],
    ['900px zoom media query', /@media\s*\(max-width:\s*900px\)/],
    ['760px one-column reflow query', /@media\s*\(max-width:\s*760px\)/],
    ['calendar event unwrap rule', /\.cal-ev[\s\S]*white-space:\s*normal/]
  ];
  for (const [name, rx] of required) if (!rx.test(css)) errors.push(`css/alive.css missing ${name}`);
}
for (const file of htmls) {
  const r = rel(file);
  const html = fs.readFileSync(file, 'utf8');
  if (/user-scalable\s*=\s*no/i.test(html)) errors.push(`${r}: disables user zoom with user-scalable=no`);
  if (/maximum-scale\s*=\s*1(?:["',\s>]|$)/i.test(html)) errors.push(`${r}: caps user zoom with maximum-scale=1`);
  const isRedirect = /http-equiv=["']refresh["']/i.test(html) && /location\.replace\(/.test(html);
  const hasHead = /<head[\s>]/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);
  if (hasHead && !/<meta[^>]+name=["']viewport["']/i.test(html)) warnings.push(`${r}: no viewport meta`);
  if (!isRedirect && (hasHead || hasBody) && !/alive\.css/.test(html)) errors.push(`${r}: missing shared alive.css, so zoom contract will not load`);
  if (/style=["'][^"']*(width|min-width)\s*:\s*(?:[7-9]\d\d|\d{4,})px/i.test(html)) warnings.push(`${r}: inline fixed width over 700px relies on zoom contract max-width override`);
  if (/white-space\s*:\s*nowrap/i.test(html) && !/overflow-wrap/i.test(html)) warnings.push(`${r}: nowrap content relies on zoom contract unwrap media query`);
}
if (errors.length) {
  console.error('ZOOM RESILIENCE CHECK FAILED');
  for (const e of errors.slice(0, 160)) console.error(' - ' + e);
  if (errors.length > 160) console.error(` ... ${errors.length - 160} more`);
  process.exit(1);
}
console.log(`ZOOM RESILIENCE CHECK PASSED — ${htmls.length} HTML pages inherit the shared zoom/reflow contract; user zoom is not disabled.`);
if (warnings.length) {
  console.log(`ZOOM RESILIENCE WARNINGS — ${warnings.length} known fixed/nowrap patterns are covered by the shared contract.`);
  for (const w of warnings.slice(0, 20)) console.log(' - ' + w);
  if (warnings.length > 20) console.log(` ... ${warnings.length - 20} more`);
}
