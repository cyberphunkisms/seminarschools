#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_THRESHOLDS,
  evaluateLiveContent,
} = require('./live-content-integrity');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = '2026-07-25-site-audit42-ledger-closure-multimode-final';
const ASSET = '20260725-audit42';
const REPORT = 'WEBSITE_AUDIT42_COMPLETE_LEDGER_CLOSURE_REPORT_2026-07-25.md';
const AUDIT41_MANIFEST_SHA256 =
  '4db62d91038e4797e7ddc7fec49e7c68481cb109f04488ab736d6bb37e6e232e';
const failures = [];

function read(relative) {
  try {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
  } catch (error) {
    failures.push(`${relative} is missing: ${error.message}`);
    return '';
  }
}

function json(relative) {
  const source = read(relative);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${relative} is invalid JSON: ${error.message}`);
    return {};
  }
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function includesAll(label, source, values) {
  for (const value of values) {
    check(source.includes(value), `${label} is missing ${value}`);
  }
}

function sha256(relative) {
  try {
    return crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, relative)))
      .digest('hex');
  } catch {
    return '';
  }
}

function countFiles(relative) {
  const root = path.join(ROOT, relative);
  let total = 0;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) total += 1;
    }
  }
  return total;
}

const release = json('RELEASE_MANIFEST.json');
const buildManifest = json('data/polymythcal-build-manifest.json');
const publicRelease = json('public/site-release.json');
check(read('RELEASE_ID.txt').trim() === RELEASE_ID, 'release ID is not Audit 42');
check(release.release_id === RELEASE_ID, 'release manifest is not Audit 42');
check(release.polymythcal_asset_version === ASSET, 'Audit 42 asset version is missing');
check(/^Audit 42\b/.test(String(release.release_type || '')), 'release type is not Audit 42');
check(
  buildManifest.release_id === RELEASE_ID
    && buildManifest.interface_release === RELEASE_ID
    && buildManifest.polymythcal_asset_version === ASSET,
  'Polymythcal build manifest is not aligned to Audit 42',
);
check(
  publicRelease.release_id === RELEASE_ID
    && publicRelease.generated_at === release.generated_at,
  'public release marker is stale',
);

check(
  sha256('data/audit41-frozen-sha256.json') === AUDIT41_MANIFEST_SHA256,
  'Audit 41 frozen manifest changed',
);
const frozen = json('data/audit41-frozen-sha256.json');
check(frozen.file_count === 71 && frozen.files?.length === 71,
  'Audit 41 frozen inventory is not 71 files');
check(frozen.historical_metrics?.browser_assertions === 882,
  'Audit 41 browser assertion history changed');
check(frozen.historical_metrics?.portable_release_checks === 138,
  'Audit 41 portable-gate history changed');

const inheritedBrowser = json('data/audit42-inherited-browser/run-summary.json');
check(
  inheritedBrowser.audit === 42
    && inheritedBrowser.contract === 'audit42-inherited-browser-v1'
    && inheritedBrowser.release_id === RELEASE_ID
    && inheritedBrowser.generated_at === release.generated_at,
  'inherited current-release browser summary is not aligned to Audit 42',
);
check(
  inheritedBrowser.suite_count === 7
    && inheritedBrowser.combined_checks === 882
    && Array.isArray(inheritedBrowser.suites)
    && inheritedBrowser.suites.length === 7
    && new Set(inheritedBrowser.suites.map(row => row.suite)).size === 7,
  'inherited current-release browser coverage backtracked below seven suites/882 assertions',
);

const report = read(REPORT);
includesAll('Audit 42 report', report, [
  '# Website Audit 42 — Complete Ledger Closure',
  'No security audit was performed',
  'Tier 0 and Tier 1 closure',
  'Tier 2 closure',
  'Tier 3 closure',
  'Tier 4 closure',
  'Direction decisions still held',
  'External validation still required',
  'https://www.w3.org/TR/WCAG22/',
  'https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-transparency',
  'https://www.w3.org/TR/appmanifest/',
  'tolerant 14-image visual baseline',
  'scoped design-token inventory',
  'Route-by-route editorial density',
  'data/audit42-symbol-vocabulary-inventory.json',
  '882 inherited current-release Chromium',
  '52 screenshots',
]);

const clRows = read('data/website-cl.jsonl').trim().split(/\n+/).map(line => JSON.parse(line));
const cl = Object.fromEntries(clRows.map(row => [row.id, row]));
check(cl['CL-WEB-201']?.status === 'complete', 'CL-WEB-201 remains falsely held');
check(
  cl['CL-WEB-202']?.status === 'inventory_complete_direction_pending',
  'CL-WEB-202 does not disclose its direction decision',
);
check(
  cl['CL-WEB-203']?.status === 'automated_complete_external_pending',
  'CL-WEB-203 does not disclose native validation',
);

const inventory = json('data/audit42-site-inventory.json');
check(inventory.release_id === RELEASE_ID, 'site inventory is not Audit 42');
check(inventory.summary?.html_routes >= 2400,
  `site inventory has only ${inventory.summary?.html_routes || 0} HTML routes`);
check(inventory.summary?.declared_language_routes === inventory.summary?.html_routes,
  'not every public HTML route declares a language');
check(inventory.summary?.pdf_paths >= 30,
  `site inventory has only ${inventory.summary?.pdf_paths || 0} PDF paths`);
check(Array.isArray(inventory.html_routes)
  && inventory.html_routes.length === inventory.summary?.html_routes,
  'HTML inventory rows are incomplete');
check(Array.isArray(inventory.pdf_paths)
  && inventory.pdf_paths.length === inventory.summary?.pdf_paths,
  'PDF inventory rows are incomplete');

const visualBaseline = json('data/audit42-visual-baseline.json');
check(
  visualBaseline.schema === 'seminar-schools-audit42-tolerant-visual-baseline-v1',
  'visual baseline schema is not Audit 42',
);
check(visualBaseline.captured_at === release.generated_at,
  'visual baseline is not aligned to the release timestamp');
check(
  visualBaseline.scope?.route_families === 7
    && visualBaseline.scope?.image_count === 14
    && Array.isArray(visualBaseline.scope?.viewport_modes)
    && visualBaseline.scope.viewport_modes.length === 2
    && visualBaseline.scope.viewport_modes.includes('ultrawide')
    && visualBaseline.scope.viewport_modes.includes('foldable_landscape'),
  'visual baseline does not cover seven families in both required modes',
);
const baselineImages = Array.isArray(visualBaseline.images)
  ? visualBaseline.images
  : [];
check(baselineImages.length === 14, 'visual baseline does not contain 14 images');
check(
  new Set(baselineImages.map(row => `${row.family}\0${row.mode}`)).size === 14,
  'visual baseline contains duplicated or missing family/mode cases',
);
for (const row of baselineImages) {
  check(Boolean(row.file) && fs.existsSync(path.join(ROOT, row.file)),
    `visual baseline image is missing: ${row.file || 'unknown'}`);
}

const tokenInventory = json('data/audit42-design-token-inventory.json');
check(
  tokenInventory.schema === 'seminar-schools-audit42-design-token-inventory-v1'
    && tokenInventory.release_id === RELEASE_ID
    && tokenInventory.generated_at === release.generated_at,
  'design-token inventory is not aligned to Audit 42',
);
check(tokenInventory.scope?.shared_css?.length === 10,
  'design-token inventory does not cover ten shared stylesheets');
const tokenFamilies = new Set(
  (tokenInventory.scope?.representative_pages || []).map(row => row.family),
);
for (const family of [
  'home',
  'polymythcal',
  'teacher-resources',
  'bb',
  'bookwormcard',
  'thank-you-mam',
  'thank-you-mam-pregame',
]) {
  check(tokenFamilies.has(family), `design-token inventory omits ${family}`);
}
check(/^[a-f0-9]{64}$/.test(String(tokenInventory.source_fingerprint_sha256 || '')),
  'design-token inventory has no source fingerprint');
check(tokenInventory.totals?.declarations > 0
  && tokenInventory.totals?.component_contexts > 0
  && tokenInventory.totals?.custom_property_names > 0,
  'design-token inventory is empty');

const editorialInventory = json('data/audit42-editorial-density-inventory.json');
check(
  editorialInventory.schema
    === 'seminar-schools-audit42-editorial-density-inventory-v1'
    && editorialInventory.release_id === RELEASE_ID
    && editorialInventory.release_generated_at === release.generated_at,
  'editorial-density inventory is not aligned to Audit 42',
);
check(/^[a-f0-9]{64}$/.test(
  String(editorialInventory.source_fingerprint_sha256 || ''),
), 'editorial-density inventory has no source fingerprint');
check(
  editorialInventory.summary?.project_routes === 3
    && editorialInventory.summary?.teacher_detail_routes_scanned === 644
    && editorialInventory.summary?.teacher_descriptions_measured === 100
    && editorialInventory.summary?.teacher_review_outliers === 0
    && editorialInventory.summary?.unexplained_project_outliers === 0,
  'editorial-density inventory is incomplete or has unresolved outliers',
);

const symbolInventory = json('data/audit42-symbol-vocabulary-inventory.json');
check(
  symbolInventory.schema
    === 'seminar-schools-audit42-symbol-vocabulary-inventory-v1'
    && symbolInventory.release_id === RELEASE_ID
    && symbolInventory.release_generated_at === release.generated_at,
  'symbol-vocabulary inventory is not aligned to Audit 42',
);
check(/^[a-f0-9]{64}$/.test(
  String(symbolInventory.source_fingerprint_sha256 || ''),
), 'symbol-vocabulary inventory has no source fingerprint');
check(
  symbolInventory.scope?.representative_html_surfaces?.length === 8
    && symbolInventory.scope?.source_files_fingerprinted === 14
    && symbolInventory.summary?.inventory_records > 0
    && symbolInventory.summary?.distinct_symbols_or_graphics > 0
    && symbolInventory.summary?.review_items === 0
    && symbolInventory.vocabulary_disposition?.unified_icon_family_claimed === false,
  'symbol-vocabulary inventory is incomplete or has unresolved accessibility items',
);

const manifest = json('manifest.json');
check(manifest.display === 'standalone', 'PWA standalone display changed');
check(manifest.orientation === 'any', 'PWA remains portrait-locked');
const sharedType = read('css/site-wide-type-zoom.css');
includesAll('shared type and preference CSS', sharedType, [
  'color: VisitedText;',
  ':lang(fa)',
  ':lang(ar)',
  '@media (prefers-reduced-transparency: reduce)',
  'backdrop-filter: none !important;',
]);
const footer = read('js/footer.js');
includesAll('shared footer', footer, [
  'min-height:44px',
  "link.setAttribute('aria-current', 'page')",
  '20260725-audit42-footer',
]);

const polymythcalHtml = read('polymythseminars/index.html');
const polymythcalJs = read('js/polymythcal-revamp.js');
const polymythcalCss = read('css/polymythcal-revamp.css');
includesAll('Polymythcal undo HTML', polymythcalHtml, [
  'id="pmUndoRegion"',
  'id="pmUndoMessage"',
  'id="pmUndoSaved"',
]);
includesAll('Polymythcal undo and print JavaScript', polymythcalJs, [
  'function offerSavedUndo',
  'function undoSavedRemoval',
  'function prepareCompletePrintView',
  'const unmodifiedShortcut = !event.ctrlKey && !event.metaKey && !event.altKey;',
  'window.addEventListener("beforeprint"',
  'window.addEventListener("afterprint"',
]);
includesAll('Polymythcal print CSS', polymythcalCss, [
  '@media print',
  '.pm-event-card a[href^="http"]::after',
  'content-visibility: visible',
]);
for (const token of [
  '.pm-section-clear {\n  min-height: 44px;',
  '.pm-segment { min-height: 44px;',
]) {
  check(polymythcalCss.includes(token), `Polymythcal target floor is missing ${token}`);
}

const bb = read('polymyth/bookwormburrows/index.html');
includesAll('BB relationships and sorting', bb, [
  '<select class="sort-select" id="sort">',
  "let sortMode = 'curated';",
  'function sortEntries(filtered)',
  "related.className = 'entry-links';",
  "addGroup('Campaign Codex records'",
]);
const bookwormcard = read('bookwormcard/index.html');
includesAll('Bookwormcard listbox semantics', bookwormcard, [
  'role="combobox"',
  'aria-controls="menu"',
  "el.setAttribute('aria-selected'",
  "inputEl.setAttribute('aria-activedescendant'",
]);

const cvGate = read('scripts/verify-saul-cv-whitespace.js');
includesAll('CV state-space gate', cvGate, [
  '1 << historicalCategories.length',
  '128 historical density/render states',
  '1 << selectable.length',
  '2,048 current modular states',
]);
const cvBuilder = read('scripts/build-saul-cv-professional.py');
check(
  !cvBuilder.includes("(ROOT / 'scripts' / 'verify-saul-cv-whitespace.js').write_text(VERIFY_LAYOUT"),
  'CV builder can still overwrite the strong whitespace verifier',
);
check(cvBuilder.includes('missing maintained CV whitespace verifier'),
  'CV builder does not require the maintained verifier');
check(read('saul/index.html')
  .includes('right:calc(4.25rem + env(safe-area-inset-right,0px));'),
  'Saul short-viewport controls can overlap the theme toggle');

const linkShardGate = read('scripts/verify-external-link-live-shards.js');
includesAll('weekly external-link rotation', linkShardGate, [
  'const LIMIT = 350;',
  'every URL appears exactly once per full cycle',
  'workflow remains once weekly on Sunday',
]);
check(read('.github/workflows/audit-external-links.yml').includes('17 10 * * 0'),
  'external-link workflow is no longer weekly');
check(read('.github/workflows/audit-external-links.yml')
  .includes('EXTERNAL_LINK_CHECK_LIMIT: "350"'),
  'external-link credit boundary changed from 350');

for (const gate of [
  'scripts/verify-frozen-audit41.js',
  'scripts/verify-external-link-live-shards.js',
  'scripts/verify-bb-qr-placement.js',
  'scripts/verify-saul-cv-whitespace.js',
  'scripts/audit42-multimode-browser.py',
  'scripts/verify-audit42-browser-evidence.js',
  'scripts/run-audit42-inherited-browser.py',
  'scripts/run-audit42-inherited-browser-all.py',
  'scripts/verify-audit42-inherited-browser-evidence.js',
  'data/audit42-inherited-browser/run-summary.json',
  'scripts/lib/audit42-png-signature.js',
  'scripts/build-audit42-visual-baseline.js',
  'scripts/test-audit42-visual-baseline.js',
  'scripts/verify-audit42-visual-baseline.js',
  'scripts/build-audit42-design-token-inventory.js',
  'data/audit42-visual-baseline.json',
  'data/audit42-design-token-inventory.json',
  'scripts/build-audit42-editorial-density-inventory.js',
  'data/audit42-editorial-density-inventory.json',
  'scripts/build-audit42-symbol-vocabulary-inventory.js',
  'data/audit42-symbol-vocabulary-inventory.json',
]) {
  check(fs.existsSync(path.join(ROOT, gate)), `${gate} is missing`);
}

const eventsDocument = json('polymythseminars/events.json');
const browseDocument = json('polymythseminars/browse.json');
const sourceDocument = json('scripts/sources.json');
const teacherDocument = json('teacherresources/resources-data.json');
const live = evaluateLiveContent({
  eventsDocument,
  browseDocument,
  sourceDocument,
  teacherDocument,
});
for (const failure of live.failures) failures.push(`live content: ${failure}`);
check(live.metrics.events >= 838, `event floor backtracked: ${live.metrics.events}/838`);
check(live.metrics.eventTypes >= 32,
  `event-type floor backtracked: ${live.metrics.eventTypes}/32`);
check(live.metrics.registeredSources >= 422,
  `source floor backtracked: ${live.metrics.registeredSources}/422`);
check(live.metrics.teacherResources === 644,
  `Teacher Resources changed: ${live.metrics.teacherResources}/644`);
check(live.metrics.teacherCollections === 25,
  `Teacher collections changed: ${live.metrics.teacherCollections}/25`);
check(live.metrics.teacherGroups === 7,
  `Teacher groups changed: ${live.metrics.teacherGroups}/7`);
const canonicalEventIds = new Set(
  (eventsDocument.events || []).map(event => String(event.id || event.identity_key)),
);
const eventAliases = fs.readdirSync(
  path.join(ROOT, 'polymythseminars', 'events'),
  { withFileTypes: true },
).filter(entry => entry.isDirectory() && !canonicalEventIds.has(entry.name)).length;
check(eventAliases >= 842, `event alias floor backtracked: ${eventAliases}/842`);
check(/const PAGE_SIZE\s*=\s*24;/.test(read('js/polymythcal-revamp.js')),
  'Polymythcal progressive batch changed from 24');
check(read('polymyth/methodologylist/index.html')
  .includes('<span class="c" id="total">1139</span>'),
  'Methodology entry floor changed from 1,139');
const publicFiles = countFiles('public');
check(publicFiles >= 3551, `public deploy file floor backtracked: ${publicFiles}/3551`);
check(DEFAULT_THRESHOLDS.minimumEvents === 800, 'event anti-collapse threshold changed');

const packageJson = json('package.json');
for (const [name, command] of Object.entries({
  'verify:frozen-audit41': 'node scripts/verify-frozen-audit41.js',
  'verify:external-link-live-shards': 'node scripts/verify-external-link-live-shards.js',
  'verify:bb-qr': 'node scripts/verify-bb-qr-placement.js',
  'verify:audit42-ledger': 'node scripts/verify-audit42-ledger-closure.js',
  'verify:audit42-browser-evidence': 'node scripts/verify-audit42-browser-evidence.js',
  'audit:audit42-inherited-browser': 'node scripts/run-python.js scripts/run-audit42-inherited-browser-all.py',
  'verify:audit42-inherited-browser-evidence': 'node scripts/verify-audit42-inherited-browser-evidence.js',
  'verify:audit42-current-browser-evidence': 'npm run verify:audit42-inherited-browser-evidence && npm run verify:audit42-browser-evidence',
  'build:audit42-visual-baseline': 'node scripts/build-audit42-visual-baseline.js',
  'verify:audit42-visual-baseline': 'node scripts/test-audit42-visual-baseline.js && node scripts/verify-audit42-visual-baseline.js',
  'build:audit42-design-token-inventory': 'node scripts/build-audit42-design-token-inventory.js',
  'verify:audit42-design-token-inventory': 'node scripts/build-audit42-design-token-inventory.js --check',
  'build:audit42-editorial-density-inventory': 'node scripts/build-audit42-editorial-density-inventory.js',
  'verify:audit42-editorial-density-inventory': 'node scripts/build-audit42-editorial-density-inventory.js --check',
  'build:audit42-symbol-vocabulary-inventory': 'node scripts/build-audit42-symbol-vocabulary-inventory.js',
  'verify:audit42-symbol-vocabulary-inventory': 'node scripts/build-audit42-symbol-vocabulary-inventory.js --check',
  'audit:audit42-multimode': 'node scripts/run-python.js scripts/audit42-multimode-browser.py',
  'apply:audit42-release-stamp': 'node scripts/apply-audit42-release-stamp.js',
})) {
  check(packageJson.scripts?.[name] === command, `package script ${name} is wrong`);
}
const runner = read('scripts/verify-all-runner.js');
for (const gate of [
  'verify-frozen-audit41.js',
  'verify-external-link-live-shards.js',
  'verify-bb-qr-placement.js',
  'verify-audit42-visual-baseline.js',
  'build-audit42-design-token-inventory.js',
  'build-audit42-editorial-density-inventory.js',
  'build-audit42-symbol-vocabulary-inventory.js',
  'verify-audit42-ledger-closure.js',
]) {
  check(runner.includes(gate), `central runner omits ${gate}`);
}

if (failures.length) {
  console.error('AUDIT 42 LEDGER CLOSURE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(
  `AUDIT 42 LEDGER CLOSURE PASSED — ${inventory.summary.html_routes} HTML routes, `
    + `${inventory.summary.pdf_paths} PDF paths, ${publicFiles} public files, `
    + `838+ events, ${eventAliases} aliases, 422+ sources, 644 Teacher Resources, `
    + 'and every maintenance-level ledger correction are guarded.',
);
