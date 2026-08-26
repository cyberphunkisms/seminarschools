#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const focused = ['writingclub', 'writingkids', 'writingjuniors', 'writingteens', 'writinggrads', 'university', 'philosophy', 'humanities', 'cfps', 'lectures', 'fellowships'];
const surfaces = [
  ['polymythseminars/index.html', '/polymythseminars/', 'en-CA', 'main'],
  ['polymythseminars/fr/index.html', '/polymythseminars/fr/', 'fr-CA', 'main'],
  ['polymythseminars/research/index.html', '/polymythseminars/research/', 'en-CA', 'research'],
  ['polymythseminars/fr/research/index.html', '/polymythseminars/fr/research/', 'fr-CA', 'research'],
  ['polymythseminars/monitoring/index.html', '/polymythseminars/monitoring/', 'en-CA', 'monitoring'],
  ['polymythseminars/fr/monitoring/index.html', '/polymythseminars/fr/monitoring/', 'fr-CA', 'monitoring'],
  ...focused.flatMap(slug => [
    [`${slug}/index.html`, `/${slug}/`, 'en-CA', 'focused'],
    [`${slug}/fr/index.html`, `/${slug}/fr/`, 'fr-CA', 'focused'],
  ])
];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

for (const [relative, route, language, kind] of surfaces) {
  const html = read(relative);
  assert.match(html, /data-pm-app="discovery-v2"/, `${relative} mounts Discovery v2`);
  assert.doesNotMatch(html, /polymythcal-revamp\.(?:js|css)/, `${relative} has no legacy assets`);
  assert.match(html, /\/css\/polymythcal-discovery\.css\?v=20260826-discovery-v2/);
  const coreAt = html.indexOf('/js/polymythcal-discovery-core.js?v=20260826-discovery-v2');
  const runtimeAt = html.indexOf('/js/polymythcal-discovery.js?v=20260826-discovery-v2');
  assert.ok(coreAt >= 0 && runtimeAt > coreAt, `${relative} loads core before runtime`);
  assert.match(html, new RegExp(`<html lang="${language}"`));
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE.replaceAll('.', '\\.')}${route.replaceAll('/', '\\/')}"`));
  const schemaMatch = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(schemaMatch, `${relative} has JSON-LD`);
  const schema = JSON.parse(schemaMatch[1]);
  assert.equal(schema['@type'], 'CollectionPage');
  assert.equal(schema.url, `${SITE}${route}`);
  assert.equal(schema.inLanguage, language);
  assert.ok(schema.name && schema.description);
  if (kind === 'research') {
    assert.match(html, /id="pmdResearchFilters"/);
    assert.match(html, /id="pmdResearchCommonDrawer"/);
    assert.match(html, /id="pmdResearchCommonFilters"/);
    assert.match(html, /data-pmd-research-source="\/polymythseminars\/research\.json"/);
    assert.doesNotMatch(html, /id="pmdCommonFilters"/);
  } else {
    assert.doesNotMatch(html, /id="pmdResearchFilters"/);
    assert.match(html, /data-pmd-source="\/polymythseminars\/(?:browse|watchlist)\.json"/);
  }
  if (kind === 'focused') assert.match(html, /data-pm-route="[a-z]+"/);
  if (kind === 'monitoring') assert.doesNotMatch(html, /"@type":"Event"/);
}

const runtime = read('js/polymythcal-discovery.js');
for (const call of ['CORE.matchesFacets', 'CORE.facetCounts', 'CORE.sortRecords', 'CORE.compareRecords', 'CORE.groupSeries', 'CORE.paginate']) assert.match(runtime, new RegExp(call.replace('.', '\\.')));
assert.match(runtime, /urlNeedsResearchProjection\(\)/);
assert.match(runtime, /event\.key !== '\/'/);
assert.doesNotMatch(runtime, /ArrowLeft|ArrowRight/);
assert.doesNotMatch(runtime, /source_languages?|identity_key|entry_family|legacyWhat|legacyPlace/);
assert.match(runtime, /sortControl\.hidden = inCalendar/);
assert.match(runtime, /sort\.disabled = inCalendar/);
assert.match(runtime, /relevanceOption\.hidden = !state\.q/);
assert.match(runtime, /relevanceOption\.disabled = !state\.q/);
assert.match(runtime, /!state\.q && state\.sort === 'relevance'/);
assert.match(runtime, /state\.sort = surface === 'monitoring' \? 'checked' : 'soonest'/);
assert.match(runtime, /kind === 'detail' && scope === 'series'/);
assert.match(runtime, /scope === 'series' && kind === 'source'/);
assert.match(runtime, /ACTION_LABELS\[kind\]/);
assert.doesNotMatch(runtime, /scope === 'series'\s*\?\s*COPY\.officialSeries\s*:\s*\(ACTION_LABELS/);

const css = read('css/polymythcal-discovery.css');
assert.match(css, /min-height:\s*44px/);
assert.match(css, /@media \(max-width:\s*47\.5rem\)/);
assert.match(css, /@media \(forced-colors:\s*active\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);

const deploy = read('scripts/build-public-deploy.js');
assert.match(deploy, /'js\/polymythcal-revamp\.js'/);
assert.match(deploy, /'css\/polymythcal-revamp\.css'/);

console.log(`POLYMYTHCAL DISCOVERY SHELL TESTS PASSED — ${surfaces.length} routes`);
