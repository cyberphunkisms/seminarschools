#!/usr/bin/env node
'use strict';

/** Audit 47 invariant continuity under the current sitewide stability patch. */
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {loadInventoryContract} = require('./lib/polymythcal-inventory-contract');

const ROOT = path.resolve(__dirname, '..');
const inventory = loadInventoryContract(ROOT);
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit47-technical-efficiency.json');
const AUDIT47_RELEASE = '2026-07-26-site-audit47-technical-efficiency-continuity-final';
const EXPECTED_RELEASE = '2026-08-15-polymythcal-sets1-15-sitewide-fixes-synthesized-final';
const EXPECTED_ASSET = '20260815-sets1-15-synthesis';
const EXPECTED_EXPLICIT_ALIASES = 28;
const SOURCE_HTML_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const failures = [];
const metrics = {
  canonical_events: 0,
  event_types: 0,
  sources: 0,
  explicit_legacy_identifiers: 0,
  generated_english_alias_routes: 0,
  french_alias_routes: 0,
  methodology_archive_sections: 0,
  methodology_archive_rows: 0,
  localized_leizu_secondary_routes: 0,
  predeploy_npm_dependency_installs: 0,
  source_html_files: 0,
  public_html_files: 0,
};

function file(relative) {
  return path.join(ROOT, relative);
}
function exists(relative) {
  return fs.existsSync(file(relative));
}
function read(relative) {
  try {
    return fs.readFileSync(file(relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}
function json(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    failures.push(`${relative} is invalid JSON: ${error.message}`);
    return {};
  }
}
function check(condition, message) {
  if (!condition) failures.push(message);
}
function byteEqual(left, right) {
  return exists(left) && exists(right) && fs.readFileSync(file(left)).equals(fs.readFileSync(file(right)));
}
function directories(relative) {
  if (!exists(relative)) return [];
  return fs.readdirSync(file(relative), {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}
function countFiles(relative, predicate) {
  const root = file(relative);
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  const stack = [root];
  while (stack.length) {
    const active = stack.pop();
    for (const entry of fs.readdirSync(active, {withFileTypes: true})) {
      const target = path.join(active, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile() && predicate(target)) count += 1;
    }
  }
  return count;
}
function canonicalOf(html) {
  return html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1] || '';
}
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${escaped}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i'))?.[1] || '';
}

const release = json('RELEASE_MANIFEST.json');
check(read('RELEASE_ID.txt').trim() === EXPECTED_RELEASE, 'RELEASE_ID.txt is not the current release');
check(release.release_id === EXPECTED_RELEASE, 'release manifest is not the current release');
check(release.polymythcal_asset_version === EXPECTED_ASSET, 'Polymythcal asset version is not current');
check((release.notes || []).includes('No security audit was performed.'), 'release manifest does not preserve the no-security-audit boundary');

const eventPayload = json('polymythseminars/events.json');
const events = Array.isArray(eventPayload.events) ? eventPayload.events : [];
const ids = new Set(events.map(event => String(event.id)));
const sources = json('scripts/sources.json').sources || [];
metrics.canonical_events = events.length;
metrics.event_types = new Set(events.map(event => event.type)).size;
metrics.sources = sources.length;
check(events.length >= inventory.minimum_canonical_events, `canonical event inventory is ${events.length}; floor ${inventory.minimum_canonical_events}`);
check(ids.size === events.length, `canonical event IDs are ${ids.size}/${events.length} unique`);
check(metrics.event_types >= inventory.minimum_event_types, `event type inventory fell below ${inventory.minimum_event_types}: ${metrics.event_types}`);
check(sources.length >= inventory.minimum_sources, `source inventory fell below ${inventory.minimum_sources}: ${sources.length}`);
check(byteEqual('polymythseminars/events.json', 'data/polymyth-seminar-events.json'), 'canonical event payloads are not byte-identical');

const lifecycle = json('data/polymythcal-lifecycle-state.json').events || [];
check(lifecycle.length === events.length, `lifecycle inventory is ${lifecycle.length}/${events.length}`);
check(new Set(lifecycle.map(event => String(event.id))).size === lifecycle.length, 'lifecycle IDs are not unique');
check(lifecycle.every(event => ids.has(String(event.id))), 'lifecycle state contains a noncanonical event ID');

const expectedRetiredTargets = new Map([
  ['98410ad8a93b', '3018f2437e1f'],
  ['9da10dbbb785', '3018f2437e1f'],
  ['toronto-caribbean-carnival-2026-caribana-59th-year-2026-07-30', '275a3d6c2cb5'],
  ['caribana-grand-parade-2026-08-01', '119d86af47de'],
  ['caribana-official-launch-2026-2026-06-13', 'edb124435d99'],
]);
const aliasTargets = new Map();
for (const event of events) {
  for (const alias of event.legacy_ids || []) {
    const value = String(alias);
    check(!ids.has(value), `${value}: explicit alias collides with a canonical ID`);
    check(!aliasTargets.has(value), `${value}: explicit alias is assigned more than once`);
    aliasTargets.set(value, String(event.id));
  }
}
metrics.explicit_legacy_identifiers = aliasTargets.size;
check(aliasTargets.size === EXPECTED_EXPLICIT_ALIASES, `explicit legacy identifiers are ${aliasTargets.size}/${EXPECTED_EXPLICIT_ALIASES}`);
for (const [retired, target] of expectedRetiredTargets) {
  check(!ids.has(retired), `${retired}: retired duplicate remains canonical`);
  check(aliasTargets.get(retired) === target, `${retired}: legacy target is not ${target}`);
}
for (const event of events) {
  const parent = String(event.parent_event_id || event.parent_id || '');
  check(!expectedRetiredTargets.has(parent), `${event.id}: parent points to retired duplicate ${parent}`);
}

for (const [alias, target] of aliasTargets) {
  check(
    byteEqual(`polymythseminars/ics/${alias}.ics`, `polymythseminars/ics/${target}.ics`),
    `${alias}: legacy ICS is not byte-identical to ${target}`,
  );
}
const englishEventDirectories = directories('polymythseminars/events');
metrics.generated_english_alias_routes = englishEventDirectories.filter(id => !ids.has(id)).length;
check(metrics.generated_english_alias_routes >= aliasTargets.size, `English generated alias routes omit one or more of ${aliasTargets.size} explicit aliases`);
for (const alias of englishEventDirectories.filter(id => !ids.has(id))) {
  const html = read(`polymythseminars/events/${alias}/index.html`);
  const target = canonicalOf(html).match(/\/polymythseminars\/events\/([^/]+)\/$/)?.[1] || '';
  check(meta(html, 'robots') === 'noindex,follow', `${alias}: English generated alias is indexable`);
  check(ids.has(decodeURIComponent(target)), `${alias}: English generated alias target is not canonical`);
}
for (const [alias, target] of aliasTargets) {
  const html = read(`polymythseminars/events/${alias}/index.html`);
  check(meta(html, 'robots') === 'noindex,follow', `${alias}: English explicit alias is indexable`);
  check(canonicalOf(html) === `https://seminarschools.com/polymythseminars/events/${encodeURIComponent(target)}/`, `${alias}: English alias canonical is wrong`);
}
for (const [alias, target] of aliasTargets) {
  const html = read(`polymythseminars/fr/events/${alias}/index.html`);
  check(meta(html, 'robots') === 'noindex,follow', `${alias}: French explicit alias is indexable`);
  check(meta(html, 'translation-status') === 'legacy-alias', `${alias}: French alias status is missing`);
  check(canonicalOf(html) === `https://seminarschools.com/polymythseminars/fr/events/${encodeURIComponent(target)}/`, `${alias}: French alias canonical is wrong`);
}
metrics.french_alias_routes = directories('polymythseminars/fr/events').filter(id => !ids.has(id)).length;
check(metrics.french_alias_routes === aliasTargets.size, `French alias routes are ${metrics.french_alias_routes}/${aliasTargets.size}`);

const app = read('js/polymythcal-revamp.js');
for (const marker of [
  'cache: "default"',
  'const ARTS_TOPIC_RE =',
  'const payloadVersion = String(payload?._generated_at || "");',
  'existing?.headers.get("X-Polymythcal-Version") === payloadVersion',
]) check(app.includes(marker), `calendar runtime lacks ${marker}`);
check(!app.includes('cache: "no-cache"'), 'calendar runtime still forces conditional revalidation');
const feedBuilder = read('scripts/build-polymythcal-feeds.py');
check(feedBuilder.includes('ARTS_TEXT_RE'), 'feed builder lacks bounded arts classification');
check(!feedBuilder.includes("event_text(event) + ' ' + event.get('city'"), 'French feed still infers language from city text');
const lifecycleBuilder = read('scripts/reconcile_polymythcal_lifecycle.py');
for (const marker of ['itertools.islice', 'ZoneInfo', '366']) {
  check(lifecycleBuilder.includes(marker), `lifecycle recurrence path lacks ${marker}`);
}

const headers = read('_headers');
check(
  /\/polymyth\/concordance\/vocabulary\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i.test(headers),
  'vocabulary JSON lacks bounded one-day caching',
);
const methodology = read('polymyth/methodologylist/index.html');
const methodologyManifest = read('polymyth/manifest.txt');
const methodologyExpectedRows = Number(
  methodologyManifest.match(/Full file: [^\n]*,\s*([\d,]+) entries across/i)?.[1].replace(/,/g, '') || 0,
);
const liveMethodologyEntries = parseSeedWithAddenda(methodology);
const liveMethodologySections = new Set(
  liveMethodologyEntries.map(entry => entry.s).filter(Boolean),
);
for (const marker of [
  "const tagQuery=q.startsWith('tg:')?q.slice(3).trim():null;",
  'let _entrySearchText = new WeakMap();',
  'searchRenderTimer = setTimeout(()=>{',
  '},120);',
]) check(methodology.includes(marker), `Methodology runtime lacks ${marker}`);
const campaign = read('polymyth/campaigncodex/index.html');
for (const marker of [
  'const normalizedEntrySearchText = new WeakMap();',
  'function scheduleSearchRender()',
  '},120);',
]) check(campaign.includes(marker), `Campaigncodex runtime lacks ${marker}`);

const methodologyArchives = directories('polymyth/methodologylist')
  .map(name => `polymyth/methodologylist/${name}/index.html`)
  .filter(relative => exists(relative) && read(relative).includes('class="resource-row"'));
metrics.methodology_archive_sections = methodologyArchives.length;
metrics.methodology_archive_rows = methodologyArchives.reduce(
  (total, relative) => total + (read(relative).match(/class="resource-row"/g) || []).length,
  0,
);
check(liveMethodologyEntries.length >= 1141, `Methodology live entries fell below the Audit47 floor: ${liveMethodologyEntries.length}/1141`);
check(liveMethodologySections.size >= 16, `Methodology live sections fell below the Audit47 floor: ${liveMethodologySections.size}/16`);
check(
  methodologyArchives.length === liveMethodologySections.size,
  `Methodology archive sections are ${methodologyArchives.length}/${liveMethodologySections.size}`,
);
check(
  methodologyExpectedRows === liveMethodologyEntries.length,
  `Methodology manifest rows are ${methodologyExpectedRows || 'unavailable'}/${liveMethodologyEntries.length} canonical live entries`,
);
check(
  metrics.methodology_archive_rows === liveMethodologyEntries.length,
  `Methodology archive rows are ${metrics.methodology_archive_rows}/${liveMethodologyEntries.length}`,
);
for (const relative of methodologyArchives) {
  check(read(relative).includes('data-page-weight="heavy"'), `${relative}: heavy-page containment is inactive`);
}

const leizuLocales = ['fr', 'zh-hant', 'zh-hans', 'fa'];
const leizuRoutes = ['intake', 'booking-success', 'policies', 'scholarship', 'donate', 'teach', 'toronto-tutoring', 'cloud', 'flyer'];
for (const locale of leizuLocales) {
  for (const route of leizuRoutes) {
    const relative = `leizu/${locale}/${route}/index.html`;
    const html = read(relative);
    const main = html.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/i);
    const mainId = main?.[1].match(/\bid=["']([^"']+)["']/i)?.[1] || '';
    const skipTarget = html.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bskip-link\b)(?=[^>]*\bhref=["']#([^"']+)["'])[^>]*>/i)?.[1] || '';
    check(Boolean(main) && main[2].includes('audit45-localized-summary'), `${relative}: localized summary is outside main`);
    check(Boolean(mainId) && skipTarget === mainId, `${relative}: skip link misses main`);
    check((html.match(/<h1\b/gi) || []).length === 1, `${relative}: expected one H1`);
    metrics.localized_leizu_secondary_routes += 1;
  }
}

const publicBuilder = read('scripts/build-public-deploy.js');
check(publicBuilder.includes('isGeneratedDependencyDirectory'), 'public builder does not share generated-dependency exclusions');
check(read('scripts/repository-walk-policy.js').includes("'.rsync-tmp'"), 'repository walk policy does not exclude transient sync directories');
check(read('scripts/normalize-shared-asset-references.js').includes('isGeneratedDependencyDirectory'), 'shared-asset normalizer does not use the repository walk policy');
check(read('scripts/build-polymythcal-browser-payload.js').includes('process.env.SS_BUILD_OUTPUT_MTIME'), 'browser payload builder ignores deterministic output stamps');
check(read('scripts/update-polymythcal-build-manifest.js').includes('writeIfChanged(scrapeFile'), 'build-manifest updater rewrites an unchanged scrape summary');
const predeploy = read('.github/workflows/predeploy.yml');
metrics.predeploy_npm_dependency_installs = (predeploy.match(/\bnpm\s+(?:ci|install)\b/g) || []).length;
check(metrics.predeploy_npm_dependency_installs === 1, `predeploy performs ${metrics.predeploy_npm_dependency_installs} npm dependency installs`);
check(predeploy.includes('npx playwright install --with-deps chromium'), 'predeploy lost deferred Chromium binary installation');
const pkg = json('package.json');
const lock = json('package-lock.json');
check(pkg.devDependencies?.playwright === '1.61.1', 'Playwright is not pinned in package.json');
check(lock.packages?.['']?.devDependencies?.playwright === '1.61.1', 'Playwright is not pinned in the lock root');

for (const [relative, cron] of [
  ['.github/workflows/scrape-seminars.yml', '47 8 * * 1'],
  ['.github/workflows/scrape-festivals.yml', '42 9 * * 2'],
  ['.github/workflows/scrape-polymythcal-protests.yml', '18 8 * * 3'],
  ['.github/workflows/audit-external-links.yml', '17 10 * * 0'],
]) {
  const schedules = [...read(relative).matchAll(/\bcron:\s*["']([^"']+)["']/g)].map(match => match[1]);
  check(schedules.length === 1 && schedules[0] === cron, `${relative}: cadence is not exactly once weekly`);
}

const runner = read('scripts/verify-all-runner.js');
for (const command of [
  'node scripts/verify-audit47-technical-efficiency.js',
  'node scripts/verify-polymythcal-audit47.js',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_audit47.py',
  'node scripts/run-python.js scripts/build-polymythcal-audit13.py --check',
  'node scripts/verify-polymythcal-build-efficiency.js',
  'node scripts/verify-polymythcal-sets13-15-browser.js',
]) check(runner.includes(command), `release runner omits ${command}`);
const lockedBuildSteps = String(pkg.scripts?.['build:locked'] || '').split(' && ');
check(
  lockedBuildSteps.filter(step => step === 'node scripts/verify-polymythcal-sets13-15-browser.js --dom-only').length === 1
    && !lockedBuildSteps.includes('node scripts/verify-polymythcal-sets13-15-browser.js'),
  'production build does not isolate the Sets 13-15 DOM-only gate from the full release browser gate',
);
check(runner.includes('renderedReport') && runner.includes("fs.readFileSync(reportFile, 'utf8') !== renderedReport"), 'release-gate report rewrites unchanged content');
check(read('scripts/verify-audit46-technical-efficiency.js').includes("fs.readFileSync(REPORT, 'utf8') !== renderedReport"), 'Audit 46 report rewrites unchanged content');
check(read('scripts/verify-audit45-translations.py').includes('REPORT.read_text(encoding="utf-8") != rendered_report'), 'Audit 45 report rewrites unchanged content');
const typographyGate = read('scripts/verify-reviews-zoom-font-release.js');
check(typographyGate.includes('allowedContractVersions.has(hrefVersion)'), 'typography gate hard-codes one historical asset token');
check(typographyGate.includes("fs.readFileSync(reportFile, 'utf8') !== renderedReport"), 'typography evidence rewrites unchanged content');
check(read('scripts/verify-keyboard-navigation.js').includes('allowedAssetVersions.has(references[0][1])'), 'keyboard gate hard-codes one historical asset token');

metrics.source_html_files = fs.readdirSync(ROOT, {withFileTypes: true})
  .filter(entry => entry.isFile() && entry.name.endsWith('.html')).length
  + SOURCE_HTML_ROOTS.reduce(
    (total, relative) => total + countFiles(relative, target => target.endsWith('.html')),
    0,
  );
metrics.public_html_files = countFiles('public', target => target.endsWith('.html'));
for (const relative of [
  'js/polymythcal-revamp.js',
  'polymyth/methodologylist/index.html',
  'polymyth/campaigncodex/index.html',
  '_headers',
]) check(byteEqual(relative, `public/${relative}`), `${relative}: source/public parity failed`);

const report = {
  schema: 'seminar-schools-audit47-technical-efficiency-v1',
  release_id: AUDIT47_RELEASE,
  generated_at: '2026-07-26T16:00:00-04:00',
  status: failures.length ? 'failed' : 'passed',
  metrics,
  fixes: [
    'deduplicated-calendar-identity-continuity',
    'canonical-legacy-ics-parity',
    'bounded-dst-safe-recurrence',
    'declared-language-and-bounded-topic-classification',
    'http-and-cache-storage-reuse',
    'methodology-and-campaigncodex-search-efficiency',
    'localized-main-landmark-repair',
    'dependency-install-and-public-walk-efficiency',
    'deterministic-build-output-stamping-and-transient-sync-resilience',
    'idempotent-verification-evidence',
    'postprocessor-aware-generated-route-consistency',
    'current-contract-verifier-compatibility',
    'manifest-owned-asset-token-verification',
  ],
  failures,
  external_validation_remaining: [
    'Firefox native-engine validation',
    'Safari/WebKit native-engine validation',
    'VoiceOver validation',
    'NVDA validation',
    'physical-device and real-user validation',
    'Google, Apple, and Outlook calendar-client import validation',
    'live scheduled harvest and current source-endpoint validation',
  ],
  policy: 'Audit 47 preserves user-approved design, translation, organizer-text, weekly-cadence, BB teacher-led, frozen-history, and no-security-audit boundaries while making current runtime and build paths smoother.',
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
const rendered = JSON.stringify(report, null, 2) + '\n';
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== rendered) {
  fs.writeFileSync(REPORT, rendered, 'utf8');
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  fs.utimesSync(REPORT, stamp, stamp);
}

if (failures.length) {
  console.error(`AUDIT47 TECHNICAL EFFICIENCY FAILED (${failures.length})`);
  failures.slice(0, 100).forEach(message => console.error(` - ${message}`));
  if (failures.length > 100) console.error(` - … ${failures.length - 100} more`);
  process.exit(1);
}
console.log(
  `AUDIT47 TECHNICAL EFFICIENCY PASSED — ${metrics.canonical_events} canonical events, `
  + `${metrics.explicit_legacy_identifiers} explicit identifiers, ${metrics.generated_english_alias_routes} English aliases, `
  + `${metrics.methodology_archive_rows} contained Methodology rows, 36 localized landmarks, and one npm dependency install.`,
);
