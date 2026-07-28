#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const failures = [];
const need = (source, token, message) => {
  if (!source.includes(token)) failures.push(message);
};

const aa = read('aa/index.html');
for (const [token, message] of [
  ['id="results-meta" role="status" aria-live="polite" aria-atomic="true"', 'AA results status is not concise, polite, and atomic'],
  ["document.getElementById('results').addEventListener('click', event => {", 'AA lacks stable result-action delegation'],
  ["button[data-open-taxonomy], button[data-open-untranslatable], button[data-open-tag]", 'AA delegation does not cover every result action'],
  ['data-open-taxonomy="${escapeHtml(t.id)}"', 'AA taxonomy cards lack native detail controls'],
  ['data-open-untranslatable="${escapeHtml(u.id)}"', 'AA untranslatable cards lack native detail controls'],
  ['data-open-tag="${escapeHtml(t.id)}"', 'AA category cards lack native detail controls'],
  ['data-open-taxonomy="${escapeHtml(tax.id)}"', 'AA occurrence cards lack native detail controls'],
  ['class="tp-mass-member" data-open-tag=', 'AA mass members lack native convergence controls'],
  ["savedScrollY = window.scrollY || document.documentElement.scrollTop || 0", 'AA does not capture scroll before opening details'],
  ["window.scrollTo({top:returnScrollY, left:window.scrollX, behavior:'auto'})", 'AA does not restore scroll when details close'],
  ["returnTarget.focus({preventScroll:true})", 'AA does not return focus without a page jump'],
  ['function openTagPage(tagId, invoker = null)', 'AA convergence details do not retain their invoking control'],
  ['tagReturnScrollY = window.scrollY || document.documentElement.scrollTop || 0', 'AA convergence details do not retain their invoking scroll position'],
  ['<h1 class="tp-name" tabindex="-1">', 'AA convergence details lack a programmatic focus destination'],
  ["button.dataset.openTag === returnTagId", 'AA convergence details cannot recover a re-rendered invoking button'],
  ["if (e.key === 'Escape')", 'AA detail view does not close with Escape'],
  ["setAttribute('aria-pressed', String(active))", 'AA visual toggle state is not synchronized programmatically'],
  ['href="/aa/cloud/?focus=untranslatables-gateway" class="uc-cloud-link"', 'AA nested cloud links were not preserved']
]) need(aa, token, message);

if (/<(?:article|div)\b[^>]*class="(?:tax-card|untrans-card|cat-group|tp-occ)"[^>]*\btabindex=/.test(aa)) {
  failures.push('AA cards retained synthetic keyboard semantics alongside native buttons');
}
if (/querySelectorAll\(['"]\.(?:tax-card|untrans-card|cat-group|tp-occ|tp-mass-member)[^'"]*['"]\)[\s\S]{0,140}addEventListener\(['"]click['"]/.test(aa)) {
  failures.push('AA retained per-card mouse-only activation');
}

const saulJs = read('saul/assets/saul-cv-spectrum-2026.js');
for (const [token, message] of [
  ["selectionCount.removeAttribute('aria-live')", 'Saul does not silence the secondary selection-count live region'],
  ['const render = (announceFocus = false) => {', 'Saul focus rendering lacks explicit announcement control'],
  ['CV focus updated: ${module.label}.', 'Saul lacks a short focus-change announcement'],
  ['render(true);', 'Saul focus changes do not request an announcement'],
  ["stage?.classList.add('is-unavailable')", 'Saul map runtime resilience regressed'],
  ['preparePrintJobs', 'Saul print hydration resilience regressed']
]) need(saulJs, token, message);
try {
  new Function(saulJs);
} catch (error) {
  failures.push(`Saul runtime script does not compile: ${error.message}`);
}

const saulPages = ['saul/index.html', 'saul/hospitality/index.html'];
const focusRoot = path.join(root, 'saul', 'cv');
for (const entry of fs.readdirSync(focusRoot, {withFileTypes:true})) {
  if (entry.isDirectory() && fs.existsSync(path.join(focusRoot, entry.name, 'index.html'))) {
    saulPages.push(path.posix.join('saul', 'cv', entry.name, 'index.html'));
  }
}
for (const relative of saulPages) {
  const html = read(relative);
  if (/<div\b(?=[^>]*\bcv-spectrum__preview\b)(?=[^>]*\baria-live=)[^>]*>/i.test(html)) {
    failures.push(`${relative} makes the full CV preview a live region`);
  }
  need(html, 'data-cv-share-status=""', `${relative} lost the short atomic interaction status`);
  need(html, 'aria-atomic="true" aria-live="polite" class="cv-spectrum__status"', `${relative} interaction status is not atomic and polite`);
}

const generator = read('scripts/build-saul-cv-professional.py');
need(generator, '<div class="cv-spectrum__preview">', 'Saul generator would restore the large preview live region');
need(generator, 'data-cv-share-status aria-live="polite" aria-atomic="true"', 'Saul generator would drop the short atomic status');
if (generator.includes('<div class="cv-spectrum__preview" aria-live="polite">')) {
  failures.push('Saul generator still marks the full preview live');
}

const home = read('index.html');
if ((home.match(/<main\b/gi) || []).length !== 1) failures.push('Homepage must have exactly one main landmark');
need(home, '<a class="skip-link" href="#main-content">Skip to main content</a>', 'Homepage skip link does not target the primary content');
const main = home.match(/<main\b[^>]*id="main-content"[^>]*>([\s\S]*?)<\/main>/i);
if (!main) {
  failures.push('Homepage primary main landmark is missing');
} else {
  need(main[1], '<h1>', 'Homepage H1 sits outside the main landmark');
  need(main[1], 'class="work-paths"', 'Homepage pathways sit outside the main landmark');
  need(main[1], 'class="index" id="index"', 'Homepage direct index sits outside the main landmark');
}

if (failures.length) {
  console.error('AUDIT38 ACCESSIBILITY P0 FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`AUDIT38 ACCESSIBILITY P0 PASSED — AA native result controls/dialog continuity, ${saulPages.length} Saul routes with concise announcements, and one complete homepage main landmark.`);
