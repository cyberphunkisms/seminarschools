#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const includesAll = (label, source, tokens) => {
  for (const token of tokens) check(source.includes(token), `${label} is missing ${token}`);
};

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      ['.git', '.netlify', 'node_modules', 'public'].includes(entry.name)
      || isGeneratedDependencyDirectory(entry.name)
    ) {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(target);
    } else if (entry.isFile() && /\.(?:css|html|js)$/i.test(entry.name)) {
      sourceFiles.push(target);
    }
  }
}
walk(ROOT);

let transitionAllCount = 0;
let externalImportCount = 0;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  transitionAllCount += (source.match(/\btransition\s*:\s*all\b/gi) || []).length;
  externalImportCount += (
    source.match(/@import\s+(?:url\()?["']?https?:\/\//gi) || []
  ).length;
}
check(transitionAllCount === 0, `${transitionAllCount} unbounded transition declarations remain`);
check(externalImportCount === 0, `${externalImportCount} third-party CSS @imports remain`);

const methodology = read('polymyth/methodologylist/index.html');
const sectionIds = [
  ...methodology.matchAll(/\{id:'([^']+)',label:/g),
].map(match => match[1]);
const staticTabIds = [
  ...methodology.matchAll(/<button class="tab(?: on)?" data-s="([^"]+)"/g),
].map(match => match[1]);
const expectedCorpusSections = [
  'methodology',
  'gorgonification',
  'degorgonification',
  'analysis',
  'sabachtan',
  'idiomary',
  'citation',
  'studylist',
  'coreplus',
  'corehistory',
  'framework-core',
  'rainbowsol',
  'pending',
  'pending-user-authorship',
  'learnings',
  'polycognate',
];
for (const id of [...expectedCorpusSections, 'tags']) {
  check(sectionIds.includes(id), `Methodology interactive section is missing: ${id}`);
  check(staticTabIds.includes(id), `Methodology pre-rendered tab is missing: ${id}`);
}
check(new Set(sectionIds).size === 17, `Methodology has ${new Set(sectionIds).size}/17 section definitions`);
check(new Set(staticTabIds).size === 17, `Methodology has ${new Set(staticTabIds).size}/17 pre-rendered tabs`);
const staticEditionCounts = [
  ...methodology.matchAll(/(\d+) indexed framework entries in a static HTML edition/g),
].map(match => Number(match[1]));
check(
  staticEditionCounts.length === 16
    && staticEditionCounts.reduce((sum, count) => sum + count, 0) === 1139,
  'Methodology static-edition parity changed from 16 editions / 1,139 entries',
);
includesAll('Methodology hydration', methodology, [
  'const existing=[...c.querySelectorAll(\'.tab\')]',
  'const reusable=existing.length===SECTIONS.length',
  "existing.forEach(button=>button.classList.toggle('on',button.dataset.s===curSec))",
  'https://fonts.googleapis.com/css2?',
]);
check(
  !/@import\s+(?:url\()?["']?https?:\/\//i.test(methodology),
  'Methodology still imports a third-party stylesheet from inline CSS',
);
const headerEnd = methodology.indexOf('</header>');
const preRenderedTxtTools = methodology.indexOf(
  '<div class="txt-tools" data-txt-tools>',
);
check(
  preRenderedTxtTools > 0 && preRenderedTxtTools < headerEnd,
  'Methodology TXT controls are not pre-rendered inside the header',
);

const alive = read('css/alive.css');
check(
  (
    alive.match(
      /main details:not\(\.static-methodology-editions\)/g,
    ) || []
  ).length >= 3,
  'Heavy-page containment does not consistently exclude above-fold Methodology details',
);
check(
  !/article,\s*details,\s*section\.card/.test(alive),
  'Heavy-page containment still targets every details element, including header disclosure',
);

const txtTools = read('js/txt-tools.js');
includesAll('TXT controls progressive enhancement', txtTools, [
  "document.querySelector('.txt-tools[data-txt-tools]')",
  'var needsInsert = !bar',
  'if(!bar)',
  'if(needsInsert)',
  'if(header) header.appendChild(bar)',
]);

const aitr = read('aitr/index.html');
includesAll('AITR fragment continuity', aitr, [
  'const fragment = decodeURIComponent(window.location.hash.replace(/^#/, \'\'))',
  "target.scrollIntoView({block:'start'})",
  'target.focus({preventScroll:true})',
  "window.addEventListener('hashchange'",
]);

const campaign = read('polymyth/campaigncodex/index.html');
includesAll('Campaigncodex fragment continuity', campaign, [
  'data-section="cc">Curriculum maps',
  "id:'cc-cmp001-curriculum-anchor-map'",
  "id:'cc-cmp001-triangulation-rubric'",
  'function activateHashEntry()',
  "target.scrollIntoView({block:'start'})",
  'target.focus({preventScroll:true})',
  "window.addEventListener('hashchange'",
]);

const intake = read('leizu/intake/index.html');
includesAll('Leizu selection summary', intake, [
  'aria-labelledby="selection-summary-title"',
  'id="selection-summary-title">Your selection',
  "summaryTitle.id = 'selection-summary-title'",
]);

const dmBoard = read('campaigns/thank-you-mam/dm-board/index.html');
includesAll('Thank You M’am DM board mobile and keyboard continuity', dmBoard, [
  '@media (max-width: 900px)',
  'grid-template-columns: minmax(0, 1fr)',
  '<button type="button" class="time-slot',
  '<button type="button" class="npc-card',
  '<button type="button" class="block',
  'role="dialog" aria-modal="true"',
  "overlay.setAttribute('inert', '')",
  "if (event.key === 'Escape')",
  'modalReturnFocus.focus()',
]);

const teacherFinderCss = read('teacherresources/finder.css');
check(
  /@media \(max-width: 600px\)[\s\S]*?\.project-nav\s*\{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?overflow-x:\s*visible;/m
    .test(teacherFinderCss),
  'Teacher Resources mobile project navigation can regress to a clipped rail',
);

const leizu = read('leizu/index.html');
includesAll('Leizu landmark and overview semantics', leizu, [
  'class="hero-facts" role="list" aria-label="Leizu Academy overview"',
  'class="hero-fact" role="listitem"',
  'class="academy-promise" role="note"',
  'data-i18n="nav.chinese">中文諮詢</a>',
  'data-i18n="hero.chinese">預約中文諮詢</a>',
  '"nav.chinese": "中文諮詢",',
  '"hero.chinese": "預約中文諮詢",',
]);

const dashboard = read('dashboard/index.html');
check(
  !/\sautofocus(?:\s|=|>)/i.test(dashboard),
  'Meaninglib dashboard still steals focus during page load',
);

const searchBuilder = read('scripts/build-search-pages.js');
check(
  (searchBuilder.match(/catalog\.css\?v=20260725-audit41/g) || []).length >= 2,
  'Teacher Resources and Methodology generated pages do not share the Audit 41 catalog token',
);

const headers = read('_headers');
for (const rule of [
  '/*.css',
  '/teacherresources/*.css',
  '/teacherresources/*.js',
  '/saul/assets/*.css',
  '/saul/assets/*.js',
  '/leizu/*.css',
  '/leizu/*.js',
  '/bookwormcard/*.js',
  '/bookwormcard/glossary/*.js',
  '/js/vendor/*.js',
]) {
  const escaped = rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(
    new RegExp(
      `^${escaped}\\s*\\n\\s*Cache-Control:\\s*public,\\s*max-age=86400,\\s*`
        + 'stale-while-revalidate=604800',
      'm',
    ).test(headers),
    `_headers lacks bounded route-code caching for ${rule}`,
  );
}

const delivery = read('scripts/verify-runtime-delivery-resilience.js');
includesAll('runtime delivery gate', delivery, [
  'contains a third-party CSS @import inside HTML',
  'has no bounded one-day local-code cache rule',
  'bounded_local_code_assets',
  'bounded_local_code_references',
]);

const runtimeBrowser = read('scripts/audit41-browser-runtime.py');
includesAll('Audit 41 DM-board browser coverage', runtimeBrowser, [
  '("/campaigns/thank-you-mam/dm-board/", "dm-board")',
  'def dm_board_mobile_checks',
  '"DM board native control inventory"',
  '"DM board keyboard changes time"',
  '"DM board dialog opens with focus and name"',
  '"DM board dialog returns focus"',
]);

if (failures.length) {
  console.error('AUDIT 41 RUNTIME EFFICIENCY FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 41 RUNTIME EFFICIENCY PASSED — ${sourceFiles.length} source HTML/CSS/JS files `
    + 'have explicit transitions and no third-party CSS imports; all 16 Methodology '
    + 'corpus sections, repaired deep links, dynamic labels, versioned Teacher Resources '
    + 'styles, and 10 bounded route-code cache rules remain active.',
);
