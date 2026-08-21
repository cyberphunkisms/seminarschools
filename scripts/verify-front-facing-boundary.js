#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const {
  frontFacingDocumentDefects,
  wrappingDocumentDefects,
  wrappingStylesheetDefects,
} = require('./lib/futureproofing-contract-checks');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const MAX_ERRORS = 240;

function fail(message) {
  if (errors.length < MAX_ERRORS) errors.push(message);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&rsquo;|&#8217;|&#x2019;/gi, '’')
    .replace(/&lsquo;|&#8216;|&#x2018;/gi, '‘')
    .replace(/&ldquo;|&#8220;|&#x201c;/gi, '“')
    .replace(/&rdquo;|&#8221;|&#x201d;/gi, '”')
    .replace(/&middot;|&#183;|&#xb7;/gi, '·')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '—')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
    .replace(/&rarr;|&#8594;|&#x2192;/gi, '→')
    .replace(/&larr;|&#8592;|&#x2190;/gi, '←')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function visible(html) {
  return decodeEntities(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requireRaw(rel, tokens) {
  if (!exists(rel)) {
    fail(`${rel}: required file is missing`);
    return;
  }
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) fail(`${rel}: missing required source token "${token}"`);
  }
}

function forbidRaw(rel, tokens) {
  if (!exists(rel)) return;
  const text = read(rel);
  for (const token of tokens) {
    if (text.includes(token)) fail(`${rel}: retired source token remains: "${token}"`);
  }
}

function requireVisible(rel, tokens) {
  if (!exists(rel)) {
    fail(`${rel}: required page is missing`);
    return;
  }
  const text = visible(read(rel));
  for (const token of tokens) {
    if (!text.includes(token)) fail(`${rel}: missing reader-facing text "${token}"`);
  }
}

function forbidVisible(rel, tokens) {
  if (!exists(rel)) return;
  const text = visible(read(rel));
  for (const token of tokens) {
    if (text.includes(token)) fail(`${rel}: retired or internal text is visible: "${token}"`);
  }
}

function skipDirectory(name) {
  return (
    name === '.git' ||
    name === '.github' ||
    name === 'fixtures' ||
    name === 'node_modules' ||
    name === '__pycache__' ||
    name.startsWith('.public-build-') ||
    isGeneratedDependencyDirectory(name)
  );
}

function collectFiles(baseRel, predicate, skipTopLevel = new Set()) {
  const out = [];
  const base = path.join(ROOT, baseRel);
  if (!fs.existsSync(base)) return out;
  function walk(abs, rel) {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? path.posix.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (skipDirectory(entry.name)) continue;
        if (!rel && skipTopLevel.has(entry.name)) continue;
        walk(path.join(abs, entry.name), childRel);
      } else if (entry.isFile() && predicate(childRel, entry.name)) {
        out.push(baseRel === '.' ? childRel : path.posix.join(baseRel, childRel));
      }
    }
  }
  walk(base, '');
  return out.sort();
}

const sourceHtml = collectFiles('.', (_rel, name) => name.endsWith('.html'), new Set(['public']));
const publicHtml = collectFiles('public', (_rel, name) => name.endsWith('.html'));
const allHtml = [...sourceHtml, ...publicHtml];
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const GOOGLE_TOKEN_TEXT = 'google-site-verification: google20234ae70106ee9d.html\n';

function canonicalPageRel(rel) {
  return rel.startsWith('public/') ? rel.slice('public/'.length) : rel;
}

const deliberateManualPrefixes = [
  'aa/',
  'aitr/',
  'bb/',
  'bookwormcard/',
  'campaigns/',
  'dashboard/',
  'hf_export/',
  'polymyth/bookwormburrows/',
  'polymyth/campaigncodex/',
  'polymyth/dmboard/',
  'polymyth/methodologylist/',
  'polymyth/modulecanon/',
  'polymyth/polymythdnd/',
];

function isDeliberateManual(rel) {
  const canonical = canonicalPageRel(rel);
  return deliberateManualPrefixes.some((prefix) => canonical.startsWith(prefix));
}

const universalVisibleForbidden = [
  'Selected evidence',
  'How the work was done',
  '嫲祖學院',
  'cl91 · 2026-06-25',
  'Book evidence only · current review pending',
];

const ordinaryVisibleForbidden = [
  'CV builder',
  'Select the version you need',
  'CV modules — PDF follows active modules',
  'Build modular CV',
  'Save selected CV',
  'Build a focused CV',
  'Choose the email shown in the file',
  'Download complete modular PDF',
  'EVERYTHING PDF',
  'static collection page',
  'Browse English Language Arts as a static',
  'Resources Resources for Teachers',
  'Teaching Resources Teaching Resources',
  'Mephistodata-built',
  'Live build target',
  'Send corrections to Rainbowsol',
  'route is a working tool',
  'Front-facing versus operator-to-AI',
  'operator-to-AI instruction',
  'SCAFFOLDING STUB',
  'Saul-authored content pending',
  'AI-side of the DM',
  'AI explaining to AI',
  'bootstrap this file',
  'open_transmission',
];

let manualHtmlCount = 0;
let readerHtmlCount = 0;
for (const rel of allHtml) {
  const canonical = canonicalPageRel(rel);
  const html = read(rel);
  if (canonical === GOOGLE_TOKEN) {
    if (html !== GOOGLE_TOKEN_TEXT) fail(`${rel}: sole front-facing exception is not the exact Google verification token`);
    continue;
  }
  for (const defect of wrappingDocumentDefects(html)) fail(`${rel}: shared-contract ${defect}`);
  const body = (html.match(/<body\b[^>]*>/i) || [])[0] || '';
  if (!body) fail(`${rel}: public document has no body`);
  const markerCount = (body.match(/\bdata-front-facing\s*=\s*["']general-audience["']/gi) || []).length;
  if (markerCount !== 1) fail(`${rel}: expected one data-front-facing="general-audience" body marker, found ${markerCount}`);
  const wrappingLinks = html.match(/<link\b[^>]*\bhref=["']\/css\/site-wide-type-zoom\.css(?:\?[^"']*)?["'][^>]*>/gi) || [];
  if (wrappingLinks.length !== 1) {
    fail(`${rel}: expected exactly one site-wide wrapping stylesheet, found ${wrappingLinks.length}`);
  }
  const text = visible(html);
  const manual = isDeliberateManual(rel);
  if (!manual) {
    for (const defect of frontFacingDocumentDefects(html)) fail(`${rel}: shared-contract ${defect}`);
  }
  if (manual) manualHtmlCount += 1;
  else readerHtmlCount += 1;
  for (const token of universalVisibleForbidden) {
    if (text.includes(token)) fail(`${rel}: retired text is visible: "${token}"`);
  }
  if (!manual) {
    for (const token of ordinaryVisibleForbidden) {
      if (text.includes(token)) fail(`${rel}: internal/admin wording is visible: "${token}"`);
    }
  }
}

for (const defect of wrappingStylesheetDefects(read('css/site-wide-type-zoom.css'))) {
  fail(`css/site-wide-type-zoom.css: shared-contract ${defect}`);
}

// Browser-loaded JavaScript is a second front-facing source: it can inject
// text after HTML verification has finished.
const browserScriptUrls = new Set();
for (const rel of allHtml) {
  const canonical = canonicalPageRel(rel);
  const html = read(rel);
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const src = decodeEntities(match[1]).split(/[?#]/, 1)[0];
    if (!src || /^(?:https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
    const normalized = src.startsWith('/')
      ? src.slice(1)
      : path.posix.normalize(path.posix.join(path.posix.dirname(canonical), src));
    if (exists(normalized)) browserScriptUrls.add(normalized);
  }
}
for (const rel of collectFiles('js', (_rel, name) => name.endsWith('.js'))) {
  browserScriptUrls.add(rel);
}
const browserJs = [...browserScriptUrls].sort();
const browserJsForbidden = [
  'cl91 · 2026-06-25',
  'SITE_BUILD',
  'polymythBuildHealth',
  'Audit14 · 513 records',
  'Audit 14 · 513 fiches',
  'same canonical calendar data',
  'Book evidence only · current review pending',
];
for (const rel of browserJs) {
  const text = read(rel);
  for (const token of browserJsForbidden) {
    if (text.includes(token)) fail(`${rel}: browser JavaScript can inject retired text "${token}"`);
  }
}

// Reader-facing generators and data sources must carry the correction too,
// otherwise the next build would silently restore the bad copy.
const generatorSources = new Set([
  'scripts/build-audit45-localized-routes.py',
  'scripts/build-search-pages.js',
  'scripts/polymythcal-route-shell.js',
  'scripts/build-polymyth-data.mjs',
  'js/polymythlib.js',
]);

requireRaw('polymyth/methodologylist/index.html', [
  'PUBLIC-PAGE HARDENING, 2026-08-08.',
  'PERCEPTIBILITY HARDENING, 2026-08-08.',
  'FRONT-FACING AND PERCEPTIBILITY HARDENING, 2026-08-08.',
  'A marker or passing text search is never proof by itself',
  'The geometry layer must also produce a register-appropriate visible pixel difference and minimum scroll displacement',
]);
requireRaw('polymyth/methodologylist-coreplus.txt', [
  'front-facing vocabulary rules, geometry and build gates',
  'Keep ML*-specific operations in CORE+ and their canonical project owners.',
  'Never narrow function for polish, simplification, redesign, regeneration, or convenience.',
]);
requireRaw('polymyth/mephistodata-activation.md', [
  'Write for a cold general reader',
  'Geometry presence alone does not pass',
  'verify-front-facing-overlap-browser',
]);
requireRaw('scripts/apply-visible-geometry.js', [
  'geometryAssetVersion',
  'assertGeometryVersionScheme',
  'geometryBodyAttributes',
]);
requireRaw('scripts/lib/geometry-asset-version.js', [
  'function geometryBodyAttributes',
  'data-front-facing="general-audience"',
]);
requireRaw('scripts/build-search-pages.js', [
  'geometryBodyAttributes',
]);
requireRaw('data/geometry-route-contracts.json', ['"asset_version_scheme": "sha256-12"']);
requireRaw('scripts/verify-all-runner.js', [
  'node scripts/verify-front-facing-overlap-browser.js',
  'node scripts/verify-visible-geometry-browser.mjs',
]);
requireRaw('scripts/verify-front-facing-overlap-browser.js', [
  'readerEntryContract',
  "route === '/google20234ae70106ee9d.html'",
  "id: 'polymyth-coherence'",
  "document.documentElement.setAttribute('data-motion', motionAttribute)",
  'chromeCandidateCache',
  'new MutationObserver',
  'fixtureWorkerCount',
  'right.bytes - left.bytes',
  'freezeRedirectFallbackHtml',
  'data-route-type=["\'](?:redirect|cv-redirect)',
  'Redirect fallback freeze incomplete',
  'WORD_BREAK_SKIP',
  'renderedLineBands',
  'isDeliberateInitialLetter',
  'Script=Latin',
  'splitOrdinaryWordFailures',
  'split-ordinary-word',
  'horizontalOverflowCulprits',
  'document.scrollingElement',
]);
requireRaw('scripts/verify-front-facing-overlap-browser.js', [
  '320', '390', '640', '768', '1024', '1440', '1801',
]);
requireRaw('css/site-wide-type-zoom.css', [
  'READER_WORD_INTEGRITY_CONTRACT',
  'READER WORD-INTEGRITY OVERRIDE',
  '[data-allow-word-break="true"]',
  'overflow-wrap: normal',
  'overflow-wrap: normal !important',
  '.source-domain',
]);
requireRaw('scripts/apply-sitewide-type-zoom-link.js', [
  'SITEWIDE_TYPE_ZOOM_VERSION',
  "ent.name !== 'google20234ae70106ee9d.html'",
  'originalStat.mtimeMs > Date.now() + 60000',
  'originalStat.mtimeMs + 1000',
]);
requireRaw('scripts/lib/sitewide-type-zoom-version.js', [
  '20260814-reader-word-integrity',
]);
for (const rel of collectFiles('saul/assets', (_rel, name) => /\.(?:css|js|json)$/i.test(name))) {
  generatorSources.add(rel);
}
for (const rel of collectFiles('scripts', (rel, name) => {
  return (
    !/^verify-/i.test(name) &&
    /(?:saul.*cv|cv.*saul)/i.test(rel) &&
    /\.(?:js|py|json)$/i.test(name)
  );
})) {
  generatorSources.add(rel);
}

// Saul: evidence belongs inside the relevant roles, not in a detached panel.
const saulRawForbidden = [
  'Selected evidence',
  'How the work was done',
  'public_highlights',
  'evidenceHighlights',
  'evidenceHighlightsHeading',
  'cv-evidence',
  'data-evidence-id',
];
const saulSourceFiles = ['saul/index.html', ...generatorSources].filter((rel) => {
  return rel === 'saul/index.html' || rel.startsWith('saul/') || /saul.*cv|cv.*saul/i.test(rel);
});
for (const rel of saulSourceFiles) forbidRaw(rel, saulRawForbidden);

requireVisible('saul/index.html', [
  'Educator | Program Coordinator | Community Organizer',
  'Countries taught in',
  'student governments',
  'run them independently',
  'Model UN',
  'environmental',
  'yearbook',
  'reviewed, approved and signed student volunteer-hour records',
  'approximately 20 core volunteers',
  'recruited, interviewed, oriented, placed, supported and evaluated',
  "farmers' market",
  'volunteer records',
  'Five days of festival operations serving nearly 2,000 participants',
  'crowd flow',
  'McMUN involved approximately 1,600 delegates',
  'Download professional CV',
  'Professional CV',
  'Full career history PDF',
  'Places behind the work',
  'Historical Career & Project Archive',
]);
requireRaw('saul/index.html', [
  'saul-karim-nassau-ultimate-school-cv-2026-protonmail.pdf',
  'aria-label="Professional CV in PDF format"',
  'aria-label="Professional CV in Word format"',
  '2006',
  'Not Current',
]);
forbidVisible('saul/index.html', [
  'Choose the email shown in the file',
  'Output archive',
  'Complete output archive',
  'Return to current CV focus',
]);
forbidRaw('saul/index.html', ['cv-return-focus']);

if (exists('saul/index.html')) {
  const html = read('saul/index.html');
  const nav = html.match(/<nav\b(?=[^>]*\bclass=["'][^"']*\bcv-local-nav\b)[^>]*>([\s\S]*?)<\/nav>/i);
  if (!nav) {
    fail('saul/index.html: primary CV section navigation is missing');
  } else {
    const hrefs = [...nav[1].matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]);
    const expected = ['#cvOverview', '#experienceLedger', '#educationLearningHeading', '#places', '#careerArchive'];
    if (JSON.stringify(hrefs) !== JSON.stringify(expected)) {
      fail(`saul/index.html: CV nav targets ${JSON.stringify(hrefs)}; expected ${JSON.stringify(expected)}`);
    }
  }
}

const localizedSaul = {
  fr: ['Carte', 'Parcours complet', 'Ouvrir le CV de candidature en anglais →'],
  'zh-hant': ['地圖', '完整經歷', '開啟英文求職履歷 →'],
  'zh-hans': ['地图', '完整经历', '打开英文求职简历 →'],
  fa: ['نقشه', 'سابقهٔ کامل', 'باز کردن رزومهٔ انگلیسی →'],
};
for (const [locale, labels] of Object.entries(localizedSaul)) {
  const rel = `saul/${locale}/index.html`;
  requireVisible(rel, labels);
  forbidVisible(rel, ['Open the English application CV', 'Return to current CV focus']);
  forbidRaw(rel, ['cv-return-focus']);
  if (!exists(rel)) continue;
  const html = read(rel);
  const nav = html.match(/<nav\b(?=[^>]*\bclass=["'][^"']*\bcv-local-nav\b)[^>]*>([\s\S]*?)<\/nav>/i);
  const hrefs = nav ? [...nav[1].matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]) : [];
  if (JSON.stringify(hrefs) !== JSON.stringify(['#places', '#careerArchive'])) {
    fail(`${rel}: localized archive nav must contain only #places and #careerArchive; found ${JSON.stringify(hrefs)}`);
  }
}

// Leizu: no speculative marketplace claims, false credentials, or partial
// translations presented as complete pages.
requireVisible('about/index.html', [
  'more than twelve years of teaching and program experience across six countries',
  'English; advanced spoken and read Farsi; basic French and Mandarin',
  'Polymythcal tracks events and deadlines',
  'public reading and announcements document',
]);
forbidVisible('about/index.html', ['PhD candidate in Education']);
requireVisible('leizu/index.html', [
  'Saul Nassau currently teaches all five subjects',
  'Future Leizu teachers may join after an interview and seminar-method training',
  'Exit Simple English',
  'Google Meet',
]);
requireVisible('leizu/teach/index.html', [
  'Saul currently teaches Leizu students',
  'Online sessions use Google Meet',
  'the teacher receives eighty percent of the agreed session rate',
]);
forbidVisible('leizu/teach/index.html', [
  'Wyzant',
  'Outschool',
  'Preply',
  'highest take-home rate',
  'Sessions run online through Zoom',
]);

const leizuLocales = ['fr', 'zh-hant', 'zh-hans', 'fa'];
const summaryOnlyRoutes = [
  'booking-success',
  'cloud',
  'donate',
  'flyer',
  'intake',
  'policies',
  'scholarship',
  'teach',
  'toronto-tutoring',
];
const sitemap = exists('sitemap.xml') ? read('sitemap.xml') : '';
let summaryOnlyCount = 0;
for (const locale of leizuLocales) {
  for (const route of summaryOnlyRoutes) {
    summaryOnlyCount += 1;
    const rel = `leizu/${locale}/${route}/index.html`;
    if (!exists(rel)) {
      fail(`${rel}: localized summary route is missing`);
      continue;
    }
    const html = read(rel);
    if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']noindex,follow["'])[^>]*>/i.test(html)) {
      fail(`${rel}: summary-only localized route must be noindex,follow`);
    }
    if (!/<meta\b(?=[^>]*\bname=["']translation-status["'])(?=[^>]*\bcontent=["']localized-summary-english-detail["'])[^>]*>/i.test(html)) {
      fail(`${rel}: translation-status must be localized-summary-english-detail`);
    }
    const summary = html.match(/<section\b(?=[^>]*\bclass=["'][^"']*\baudit45-localized-summary\b)[^>]*>([\s\S]*?)<\/section>/i);
    if (!summary || !new RegExp(`href=["']/leizu/${route}/["']`, 'i').test(summary[1])) {
      fail(`${rel}: localized summary must immediately link to the complete English page`);
    }
    const url = `https://seminarschools.com/leizu/${locale}/${route}/`;
    if (sitemap.includes(`<loc>${url}</loc>`)) {
      fail(`sitemap.xml: summary-only route must not be indexed: ${url}`);
    }
  }
}

requireRaw('scripts/build-audit45-localized-routes.py', [
  'localized-summary-english-detail',
  'noindex,follow',
  'english_link_text',
  '"@type": "WebPage"',
]);

// Generated catalog pages are public prose, not database inspections.
const eventPages = allHtml.filter((rel) => /^\/?(?:public\/)?polymythseminars\/events\/[^/]+\/index\.html$/.test(rel));
for (const rel of eventPages) {
  const raw = read(rel);
  const text = visible(raw);
  for (const token of ['Organizer text language', 'Qualification:', 'Not yet determined']) {
    if (text.includes(token)) fail(`${rel}: generated event page exposes pipeline wording "${token}"`);
  }
  const rawUnknownField = /<(?:dd|span|strong)\b[^>]*>\s*Unknown\s*<\/(?:dd|span|strong)>/i.test(raw)
    || /\bLast checked\b.{0,120}\bUnknown\b/i.test(text);
  if (rawUnknownField) fail(`${rel}: generated event page exposes raw Unknown enum`);
}

const methodologySectionPages = allHtml.filter((rel) => {
  const canonical = canonicalPageRel(rel);
  return /^polymyth\/methodologylist\/[^/]+\/index\.html$/.test(canonical);
});
for (const rel of methodologySectionPages) {
  const text = visible(read(rel));
  for (const token of ['Static archive route', 'crawlable entry anchors']) {
    if (text.includes(token)) fail(`${rel}: methodology section exposes generator language "${token}"`);
  }
}

// Polymythlib records keep raw codes in datasets and data attributes, but the
// browser presents ordinary labels and explanations.
const polymythRecordPages = sourceHtml.filter((rel) => /^polymythlib\/projects\/PC-\d+\/index\.html$/.test(rel));
if (polymythRecordPages.length !== 346) {
  fail(`polymythlib: expected 346 generated record pages, found ${polymythRecordPages.length}`);
}
const polymythRequiredLabels = [
  'About this project',
  'Directory status',
  'How the book uses it',
  'Status in the book',
  'Book citation',
  'Last checked',
  'Current status',
  'Responsible organization',
  'What this record includes',
  'Book source',
  'Sources and links',
  'Related records',
  'Included / Still needed',
  'Updates',
];
const polymythOldLabels = [
  'Verification state',
  'Steward / responsible body',
  'Relationship data',
  'Completeness',
  'Canonical book source',
  'Coverage tier',
  'Source role',
  'Citation locator',
  'Record sources',
  'At a glance',
  'Directory scope',
  'Candidate tier',
  'Role in the book',
  'Book portrayal',
  'Book evidence',
  'Current verification',
  'Current evidence state',
  'Commons anatomy',
  'Record signals',
  'Record history',
  'Sources and pointers',
  'Related by book type',
];
const rawVisibleCodes = [
  'Core candidate',
  'Example candidate',
  'Support node',
  'Context / analogy',
  'Commons Projects',
  'Supporting Ecosystem',
  'Concepts and Comparisons',
  'STATUS_UNRESOLVED',
  'BOOK_ONLY_HISTORICAL',
  'ACTIVE_AT_NEW_URL',
  'ARCHIVED_READ_ONLY',
  'ABSORBED',
  'MEDIUM_HIGH',
];
for (const rel of polymythRecordPages) {
  const text = visible(read(rel));
  for (const label of polymythRequiredLabels) {
    if (!text.includes(label)) fail(`${rel}: missing reader label "${label}"`);
  }
  for (const label of [...polymythOldLabels, ...rawVisibleCodes]) {
    if (text.includes(label)) fail(`${rel}: raw/retired record label is visible: "${label}"`);
  }
}
requireRaw('js/polymythlib.js', ['Current status not yet reviewed']);
forbidRaw('js/polymythlib.js', ['Book evidence only · current review pending']);

// Current public chrome uses the reader-facing product name. Historical
// essays and technical records are intentionally left untouched.
const currentChromePages = [
  '404.html',
  'index.html',
  'about/index.html',
  'agora/index.html',
  'florilegium/index.html',
  'marginalia/index.html',
  'nutrition/index.html',
  'ohm-dome/index.html',
];
for (const rel of currentChromePages) {
  if (!exists(rel)) continue;
  const text = visible(read(rel));
  if (/\bpolymythcalendar\b/.test(text) || /\bPolymythCalendar\b/.test(text)) {
    fail(`${rel}: current human chrome must use “Polymythcal”`);
  }
}

requireRaw('js/polymythcal-features.js', ['same calendar listings']);
forbidRaw('js/polymythcal-features.js', [
  'polymythBuildHealth',
  'same canonical calendar data',
  'Audit14 · 513 records',
]);
requireRaw('scripts/polymythcal-route-shell.js', ['Browse all Polymythcal listings']);
forbidRaw('scripts/polymythcal-route-shell.js', ['Showing <strong>']);
forbidRaw('js/site.js', ['SITE_BUILD', 'cl91 · 2026-06-25']);

// Deliberate manuals and game/operator surfaces retain substantive AI and
// facilitation language; these focused checks protect their public boundary.
requireVisible('bb/index.html', [
  'Run a burrow with wormcards.',
  'AI-assisted BB is the priority workflow.',
  'Let time matter.',
]);
requireVisible('bookwormcard/about/index.html', [
  'teacher manual workflow',
  'AI-assisted BB is the priority workflow',
  'open the BB plain-text manual',
]);
requireVisible('polymyth/dmboard/index.html', [
  'The priority AI-assisted workflow for opening a burrow with wormcards',
  'teacher as human mediator',
  'Paper or document play remains available',
]);
forbidVisible('campaigns/thank-you-mam/pregame/index.html', [
  'Mephistodata-built',
  'Live build target',
  'Send corrections to Rainbowsol',
]);
const ml = exists('polymyth/methodologylist.txt') ? read('polymyth/methodologylist.txt') : '';
for (const token of [
  'Front-facing versus operator-to-AI instruction separation',
  'Treating operator command language as front-facing copy',
  'Surface translation firewall',
  'BB helps committed teachers turn class reading into a living world',
]) {
  if (!ml.includes(token)) fail(`polymyth/methodologylist.txt: missing boundary rule "${token}"`);
}

// Existing retired-route boundary remains part of the all-page gate.
if (exists('teacherresources/resources-data.json') && read('teacherresources/resources-data.json').includes('"id":"lang-hughes"')) {
  fail('teacherresources: retired Thank You Ma’am standalone group remains in resources-data');
}
if (exists('teacherresources/lang-hughes/index.html')) {
  fail('teacherresources: retired /teacherresources/lang-hughes/ page still exists');
}
if (sitemap.includes('/teacherresources/lang-hughes/')) {
  fail('sitemap.xml: retired /teacherresources/lang-hughes/ route remains');
}
if (!exists('_redirects') || !read('_redirects').includes('/teacherresources/lang-hughes/* /teacherresources/ 301')) {
  fail('_redirects: retired Thank You Ma’am route lacks its 301 redirect');
}

const coverage = [
  `${sourceHtml.length} source HTML`,
  `${publicHtml.length} public HTML`,
  `${readerHtmlCount} reader-facing documents`,
  `${manualHtmlCount} deliberate manual/tool documents`,
  `${browserJs.length} browser JavaScript files`,
  `${generatorSources.size} generator/data sources`,
  `${summaryOnlyCount} summary-only locale routes`,
  `${polymythRecordPages.length} Polymythlib records`,
  `${eventPages.length} generated event pages`,
  `${methodologySectionPages.length} methodology section pages`,
].join('; ');

if (errors.length) {
  console.error('FRONT-FACING BOUNDARY CHECK FAILED');
  for (const error of errors) console.error(` - ${error}`);
  if (errors.length >= MAX_ERRORS) console.error(` - stopped after ${MAX_ERRORS} errors`);
  console.error(`Coverage: ${coverage}.`);
  process.exit(1);
}

console.log('FRONT-FACING BOUNDARY CHECK PASSED');
console.log(`Coverage: ${coverage}.`);
