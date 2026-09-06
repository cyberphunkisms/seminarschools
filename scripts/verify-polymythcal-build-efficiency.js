#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const {
  currentTorontoDate,
  dateOneYearAfter,
  resolveSiteBuildDate,
  torontoDateFromTimestamp,
} = require('./polymythcal-build-date');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];
const fail = message => failures.push(message);
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const bytes = relative => fs.readFileSync(path.join(ROOT, relative));
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const same = (left, right) => exists(left) && exists(right) && bytes(left).equals(bytes(right));
const sha = relative => crypto.createHash('sha256').update(bytes(relative)).digest('hex');

if (torontoDateFromTimestamp('2026-07-24T03:59:59Z') !== '2026-07-23'
  || torontoDateFromTimestamp('2026-07-24T04:00:00Z') !== '2026-07-24') {
  fail('shared Toronto build clock fails the UTC-midnight boundary regression');
}
if (resolveSiteBuildDate({root: ROOT, override: null}) !== currentTorontoDate()) fail('shared site build date is not current in Toronto');
if (resolveSiteBuildDate({root: ROOT, override: '2026-02-03'}) !== '2026-02-03') fail('SITE_BUILD_DATE override is not deterministic');
if (dateOneYearAfter('2024-02-29') !== '2025-03-01') fail('calendar-year horizon rollover changed');

const releaseId = read('RELEASE_ID.txt').trim();
const release = JSON.parse(read('RELEASE_MANIFEST.json'));
const buildManifest = JSON.parse(read('data/polymythcal-build-manifest.json'));
const canonicalText = read('data/polymyth-seminar-events.json');
const canonical = JSON.parse(canonicalText);
const mirrorText = read('polymythseminars/events.json');
const browseBytes = bytes('polymythseminars/browse.json');
const browse = JSON.parse(browseBytes);
const watchlist = JSON.parse(read('polymythseminars/watchlist.json'));
const surfaces = JSON.parse(read('data/polymythcal-publication-surfaces.json'));
const chronology = browse.events || [];
const monitored = watchlist.items || [];

if (release.release_id !== releaseId) fail('RELEASE_ID.txt and RELEASE_MANIFEST.json disagree');
if (!/^[0-9]{8}-[a-z0-9-]+$/.test(String(release.polymythcal_asset_version || ''))) fail('release lacks a valid Polymythcal asset version');
if (canonicalText !== mirrorText) fail('private canonical mirrors are not byte-identical');
if (canonical.events.length !== 2088) fail(`canonical inventory changed (${canonical.events.length}/2088)`);
if (chronology.length !== 1954 || monitored.length !== 134) fail(`publication partition changed (${chronology.length}+${monitored.length}/2088)`);
if (browse._schema !== 'polymythcal-discovery-v2' || watchlist._schema !== 'polymythcal-watchlist-v2') fail('public projection schema is stale');
if (surfaces.schema !== 'polymythcal-publication-surfaces-v2') fail('publication-surface schema is stale');
const chronologyIds = new Set(chronology.map(event => event.id));
const watchlistIds = new Set(monitored.map(event => event.id));
if ([...chronologyIds].some(id => watchlistIds.has(id))) fail('chronology and monitoring overlap');
if (chronologyIds.size + watchlistIds.size !== canonical.events.length) fail('publication surfaces are not a complete unique partition');
const exactReason = JSON.stringify({
  code: 'monitoring-marker',
  detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
});
if (Object.keys(surfaces.reasons || {}).length !== monitored.length
  || [...watchlistIds].some(id => JSON.stringify(surfaces.reasons?.[id]) !== exactReason)) {
  fail('monitoring-marker reasons are not exact');
}
if (monitored.some(item => Object.hasOwn(item, 'date') || Object.hasOwn(item, 'end_date'))) fail('monitoring payload exposes invented chronology dates');
if (browseBytes.length > 3250000) fail(`browse projection exceeds 3.25 MB (${browseBytes.length})`);
const browseGzip = zlib.gzipSync(browseBytes, {level: 9}).length;
if (browseGzip > 360000) fail(`browse projection exceeds 360 KB gzip (${browseGzip})`);

if (buildManifest.release_id !== releaseId || buildManifest.record_count !== canonical.events.length) fail('build manifest release/canonical count is stale');
if (buildManifest.chronology_count !== chronology.length || buildManifest.watchlist_count !== monitored.length) fail('build manifest publication counts are stale');
if (buildManifest.canonical_data_sha256 !== sha('data/polymyth-seminar-events.json')) fail('build manifest canonical hash is stale');
if (buildManifest.browser_payload_sha256 !== sha('polymythseminars/browse.json')) fail('build manifest browse hash is stale');
if (buildManifest.browser_payload_raw_bytes !== browseBytes.length || buildManifest.browser_payload_gzip_bytes !== browseGzip) fail('build manifest browse sizes are stale');

const shell = read('polymythseminars/index.html');
const shellBytes = Buffer.byteLength(shell, 'utf8');
if (!shell.includes('id="pmdSearch"') || !shell.includes('id="pmdList"') || !shell.includes('/js/polymythcal-discovery.js')) fail('main calendar is not the Discovery v2 shell');
if (!shell.includes('/css/polymythcal-discovery.css') || !shell.includes('data-pmd-surface="main"')) fail('main calendar lacks the Discovery v2 styling/surface contract');
if (shell.includes('id="eventsContainer"') || shell.includes('id="events-fallback"') || shell.includes('/js/polymythcal-revamp.js')) fail('main calendar retains the legacy embedded/filter-wall application');
if (shellBytes >= 100000) fail(`main calendar shell exceeds 100 KB (${shellBytes})`);

for (const [relative, surface, language] of [
  ['polymythseminars/index.html', 'main', 'en-CA'],
  ['polymythseminars/fr/index.html', 'main', 'fr-CA'],
  ['polymythseminars/research/index.html', 'research', 'en-CA'],
  ['polymythseminars/fr/research/index.html', 'research', 'fr-CA'],
  ['polymythseminars/monitoring/index.html', 'monitoring', 'en-CA'],
  ['polymythseminars/fr/monitoring/index.html', 'monitoring', 'fr-CA'],
]) {
  if (!exists(relative)) { fail(`${relative} is missing`); continue; }
  const page = read(relative);
  if (!page.includes(`lang="${language}"`) || !page.includes(`data-pmd-surface="${surface}"`)) fail(`${relative} has the wrong locale or surface`);
  if (!page.includes('/js/polymythcal-discovery.js') || Buffer.byteLength(page, 'utf8') >= 100000) fail(`${relative} is not a lightweight shared discovery shell`);
  if (surface === 'research' && (!page.includes('id="pmdFacetSearch"') || !page.includes('id="pmdResearchFilters"'))) fail(`${relative} lacks connected Research controls`);
  if (surface === 'monitoring' && !page.includes('/polymythseminars/watchlist.json')) fail(`${relative} lacks the date-free monitoring source`);
}

const focusedRoutes = ['writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
for (const slug of focusedRoutes) {
  const relative = `${slug}/index.html`;
  if (!exists(relative)) { fail(`${relative} is missing`); continue; }
  const page = read(relative);
  const canonicalUrl = page.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  if (canonicalUrl !== `https://seminarschools.com/${slug}/`) fail(`${slug} canonical URL is stale`);
  if (!page.includes(`data-pm-route="${slug}"`) || !page.includes('id="pmdList"') || !page.includes('/js/polymythcal-discovery.js')) fail(`${slug} does not use the shared route-restricted Discovery v2 shell`);
  if (exists(`public/${relative}`) && !same(relative, `public/${relative}`)) fail(`${slug} source/public mirror differs`);
}

const missingDetails = chronology.filter(event => !exists(`polymythseminars/events/${event.id}/index.html`));
const missingIcs = chronology.filter(event => !exists(`polymythseminars/ics/${event.id}.ics`));
if (missingDetails.length) fail(`${missingDetails.length} chronology detail pages are missing`);
if (missingIcs.length) fail(`${missingIcs.length} chronology ICS files are missing`);
const missingWatchDetails = monitored.filter(event => !exists(`polymythseminars/events/${event.id}/index.html`) || !exists(`public/polymythseminars/events/${event.id}/index.html`));
const leakedIcs = monitored.filter(event => exists(`public/polymythseminars/ics/${event.id}.ics`));
const invalidWatchDetails = monitored.filter(event => {
  const relative = `public/polymythseminars/events/${event.id}/index.html`;
  if (!exists(relative)) return false;
  const detail = read(relative);
  return !detail.includes('data-publication-surface="watchlist"')
    || /<time\s+datetime=/i.test(detail)
    || detail.includes(`/polymythseminars/ics/${event.id}.ics`)
    || /"@type"\s*:\s*"Event"/.test(detail);
});
if (missingWatchDetails.length || invalidWatchDetails.length || leakedIcs.length) {
  fail(`monitoring publication boundary changed (${missingWatchDetails.length} missing details, ${invalidWatchDetails.length} dated details, ${leakedIcs.length} ICS)`);
}
if (exists('public/polymythseminars/events.json')) fail('private canonical corpus is present in public/');
if (!same('polymythseminars/browse.json', 'public/polymythseminars/browse.json')) fail('public browse projection differs from source');
if (!same('polymythseminars/watchlist.json', 'public/polymythseminars/watchlist.json')) fail('public monitoring projection differs from source');

const pkg = JSON.parse(read('package.json'));
const build = String(pkg.scripts?.['build:locked'] || '');
const firstPayloadIndex = build.indexOf('build-polymythcal-browser-payload.js');
const secondPayloadIndex = build.lastIndexOf('build-polymythcal-browser-payload.js');
const finalLocalizationIndex = Math.max(
  build.lastIndexOf('build-audit45-localized-routes.py'),
  build.lastIndexOf('apply-audit49-metadata-hygiene.js'),
);
const orderedBuildIndexes = [
  build.indexOf('apply-audit45-language-model.py'),
  firstPayloadIndex,
  build.indexOf('build-polymythcal-audit13.py'),
  build.indexOf('build-search-pages.js'),
  build.indexOf('build-polymythcal-feeds.py'),
  secondPayloadIndex,
  finalLocalizationIndex,
  build.lastIndexOf('build-polymythcal-discovery-site.js'),
  build.lastIndexOf('build-writing-shortcuts.js'),
  build.lastIndexOf('build-academic-shortcuts.js'),
  build.lastIndexOf('update-release-asset-identity.js'),
  build.lastIndexOf('update-polymythcal-build-manifest.js'),
  build.lastIndexOf('build-public-deploy.js'),
];
if (orderedBuildIndexes.some((index, position) => index < 0 || (position && index <= orderedBuildIndexes[position - 1]))) {
  fail('canonical build omits or misorders the Discovery v2 truth/site/identity/public sequence');
}
if ((build.match(/build-polymythcal-browser-payload\.js/g) || []).length !== 2 || firstPayloadIndex === secondPayloadIndex) fail('canonical build must generate the safe projection before pages and again at fixed point');
if (!build.includes('verify-polymythcal-discovery-v2.js')) fail('canonical build lacks the Discovery v2 release gate');
const expectedEntrypoint = 'node scripts/assert-canonical-build-delegation.js "node scripts/run-python.js scripts/build-polymythcal-audit13.py" "node scripts/build-search-pages.js" && node scripts/run-python.js scripts/run-with-build-lock.py -- npm run build:locked';
if (pkg.scripts?.build !== expectedEntrypoint) fail('production build is not routed through the repository-wide writer lock');
if (build.includes('update-polymythcal-editable-master-')) fail('deploy build mutates private editable masters');

const publicationFinalizer = read('scripts/finalize-polymythcal-publication.py');
const orderedFinalizerSteps = [
  'scripts/build-audit45-localized-routes.py',
  'scripts/apply-audit45-translation-ui.js',
  'scripts/apply-audit49-metadata-hygiene.js',
  'scripts/build-polymythcal-discovery-site.js',
  'scripts/apply-visible-geometry.js',
  'scripts/update-release-asset-identity.js',
  'scripts/update-polymythcal-build-manifest.js',
  'scripts/build-public-deploy.js',
  'scripts/verify-public-deploy-parity.js',
  'scripts/verify-release-asset-identity.js',
];
const orderedFinalizerIndexes = orderedFinalizerSteps.map(step => publicationFinalizer.indexOf(step));
if (
  orderedFinalizerIndexes.some((index, position) => (
    index < 0
    || (publicationFinalizer.split(orderedFinalizerSteps[position]).length - 1) !== 1
    || (position > 0 && index <= orderedFinalizerIndexes[position - 1])
  ))
) {
  fail('Polymythcal publication finalizer omits, duplicates, or misorders the localization/discovery/geometry/identity/public verification sequence');
}

const app = read('js/polymythcal-discovery.js');
for (const token of ['const PAGE_SIZE = 24', 'URLSearchParams', "mode === 'push' ? 'pushState' : 'replaceState'", 'pmdResearchFilters', 'pmdCalendar']) {
  if (!app.includes(token)) fail(`Discovery controller lacks ${token}`);
}
if (app.includes('/polymythseminars/events.json')) fail('Discovery controller references the private canonical corpus');
if (!exists('public/site-release.json')) fail('public release marker is missing');
else {
  const siteRelease = JSON.parse(read('public/site-release.json'));
  if (siteRelease.release_id !== releaseId || siteRelease.generated_at !== release.generated_at) fail('public release marker is stale');
}

const gitignore = exists('.gitignore') ? read('.gitignore') : '';
if (!/^\/?public\/$/m.test(gitignore)) warnings.push('public/ is absent from .gitignore');

if (failures.length) {
  console.error('POLYMYTHCAL BUILD/EFFICIENCY CHECK FAILED');
  failures.forEach(message => console.error(` - ${message}`));
  process.exit(1);
}
console.log(`POLYMYTHCAL BUILD/EFFICIENCY CHECK PASSED — ${shellBytes} byte shell; ${canonical.events.length} canonical = ${chronology.length} chronology + ${monitored.length} monitoring; ${browseBytes.length} raw / ${browseGzip} gzip discovery payload; ${focusedRoutes.length} focused routes.`);
if (warnings.length) warnings.forEach(message => console.warn(`WARNING ${message}`));
