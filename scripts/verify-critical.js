#!/usr/bin/env node
// Refuses to let a broken calendar ship. Exit 1 = do not deploy.
'use strict';
const fs = require('fs');
let failed = false;
const read = relative => { try { return fs.readFileSync(relative, 'utf8'); } catch (_) { return ''; } };
const json = relative => { try { return JSON.parse(read(relative)); } catch (_) { return null; } };
function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) failed = true;
}

const calendar = read('polymythseminars/index.html');
const research = read('polymythseminars/research/index.html');
const monitoring = read('polymythseminars/monitoring/index.html');
const core = read('js/polymythcal-discovery-core.js');
const app = read('js/polymythcal-discovery.js');
const discoveryModel = read('scripts/lib/polymythcal-discovery-model.js');
const publicBuilder = read('scripts/build-public-deploy.js');
const publicParity = read('scripts/verify-public-deploy-parity.js');
const headers = read('_headers');
const release = json('RELEASE_MANIFEST.json');
const canonical = json('data/polymyth-seminar-events.json');
const mirror = json('polymythseminars/events.json');
const browse = json('polymythseminars/browse.json');
const watchlist = json('polymythseminars/watchlist.json');
const researchData = json('polymythseminars/research.json');
const surfaces = json('data/polymythcal-publication-surfaces.json');
const siteAssetVersion = String(release?.polymythcal_asset_version || '');
const discoveryAssetVersion = String(release?.polymythcal_discovery_asset_version || '');

check('release manifest preserves the frozen site asset version', /^[0-9]{8}-[a-z0-9-]+$/.test(siteAssetVersion));
check(
  'release manifest owns a coherent Discovery v2 identity',
  release?.polymythcal_discovery_release_id === '2026-08-26-polymythcal-discovery-v2'
    && release?.polymythcal_discovery_built_at === '2026-08-26T12:30:00-04:00'
    && discoveryAssetVersion === '20260826-discovery-v2',
);
check(
  'calendar uses the lightweight Discovery v2 core and shell',
  calendar.includes('id="pmdList"')
    && calendar.includes(`/js/polymythcal-discovery-core.js?v=${discoveryAssetVersion}`)
    && calendar.includes(`/js/polymythcal-discovery.js?v=${discoveryAssetVersion}`)
    && core.includes('PolymythcalDiscoveryCore'),
);
check('calendar avoids an embedded full-corpus fallback', !calendar.includes('id="events-fallback"') && !calendar.includes('id="eventsContainer"') && calendar.length < 100000);
check('connected Research and monitoring routes use the same bounded shell', research.includes('data-pmd-surface="research"') && monitoring.includes('data-pmd-surface="monitoring"') && research.length < 100000 && monitoring.length < 100000);
check('calendar carries the Discovery-owned build stamp', calendar.includes('name="ss-build"') && calendar.includes(`content="${discoveryAssetVersion}"`));
check('calendar application uses the safe data source selected by the shell', app.includes('document.body.dataset.pmdSource') && !app.includes('/polymythseminars/events.json'));
check('calendar application has bounded pagination', /const PAGE_SIZE = 24;/.test(app));
check(
  'calendar application preserves validated URL state and browser navigation',
  app.includes('function readStateFromUrl()')
    && app.includes('function stateParams(')
    && app.includes('function writeUrl(')
    && app.includes("const method = mode === 'push' ? 'pushState' : 'replaceState'")
    && app.includes('window.history[method]')
    && app.includes("window.addEventListener('popstate'"),
);
check(
  'calendar application fails closed for unavailable exact destinations',
  discoveryModel.includes("const destinationAvailable = safePublicUrl(event.destination_url)")
    && discoveryModel.includes("event.destination_status !== 'unavailable-specific-page'")
    && discoveryModel.includes('for (const [field, kind] of PUBLIC_ACTION_CANDIDATE_FIELDS)')
    && discoveryModel.includes("kind: 'source'")
    && app.includes('return CORE.safeHttpUrl(rawUrl, window.location.origin)')
    && app.includes('for (const action of asArray(event.actions))')
    && !app.includes('safeUrl(event.destination_url)')
    && !app.includes('safeUrl(event.source_url)')
    && app.includes('COPY.noVerifiedLink'),
);
check(
  'calendar has bounded validated loading, retry, and a readable fallback route',
  app.includes('const FETCH_TIMEOUT_MS = 12000;')
    && app.includes('const FETCH_ATTEMPTS = 2;')
    && app.includes('new AbortController()')
    && app.includes('if (!response.ok)')
    && app.includes('validatePayload(candidate)')
    && app.includes('id="pmdRetry"')
    && app.includes("window.addEventListener('pagehide'")
    && calendar.includes('/polymythseminars/subscribe/'),
);

check('private canonical data parses', Array.isArray(canonical?.events));
check('private canonical mirror remains byte-identical', read('data/polymyth-seminar-events.json') === read('polymythseminars/events.json'));
check('safe chronology projection parses', browse?._schema === 'polymythcal-discovery-v2' && Array.isArray(browse.events));
check('date-free monitoring projection parses', watchlist?._schema === 'polymythcal-watchlist-v2' && Array.isArray(watchlist.items));
check('lazy specialist Research projection parses', researchData?._schema === 'polymythcal-research-v1' && Array.isArray(researchData.records));
check('publication surfaces partition the canonical corpus', browse && watchlist && canonical && browse.events.length + watchlist.items.length === canonical.events.length);
check('monitoring records expose no invented dates', watchlist && watchlist.items.every(item => !Object.hasOwn(item, 'date') && !Object.hasOwn(item, 'end_date')));
check('publication manifest has exact v2 schema', surfaces?._schema === 'polymythcal-publication-surfaces-v2' && surfaces?.schema === 'polymythcal-publication-surfaces-v2');
check(
  'public deploy exposes only safe projections and returns a static 404 for the private corpus',
  !fs.existsSync('public/polymythseminars/events.json')
    && fs.existsSync('public/404.html')
    && read('public/polymythseminars/browse.json') === read('polymythseminars/browse.json')
    && read('public/polymythseminars/watchlist.json') === read('polymythseminars/watchlist.json')
    && read('public/polymythseminars/research.json') === read('polymythseminars/research.json')
    && publicBuilder.includes("'polymythseminars/events.json'")
    && publicParity.includes('public/polymythseminars/events.json exposes the canonical internal corpus')
    && headers.includes('/polymythseminars/events.json\n  Cache-Control: no-store, max-age=0'),
);
check(
  'all three public discovery projections use the same bounded revalidation policy',
  ['/polymythseminars/browse.json', '/polymythseminars/watchlist.json', '/polymythseminars/research.json']
    .every(route => headers.includes(`${route}\n  Cache-Control: public, max-age=300, must-revalidate`)),
);

const feed = read('polymythseminars/feed.xml');
check('RSS feed present with items', feed.includes('<item>'));
const home = read('about/index.html');
check('About page fetches the versioned compact featured file', home.includes(`/polymythseminars/featured.json?v=${siteAssetVersion}`));
const netlify = read('netlify.toml');
check('Netlify publishes only generated public/', /publish\s*=\s*"public"/.test(netlify));
check('Netlify blocks /data/* as defence in depth', netlify.includes('from = "/data/*"'));
const robot = json('seminars/events.json');
check('robot fallback file parses', !!robot && (robot.events || []).length > 0);

if (failed) {
  console.error('\nBLOCKED: calendar-critical files are broken. DO NOT PUSH.');
  process.exit(1);
}
console.log('\nALL CRITICAL CHECKS PASS — safe to deploy.');
