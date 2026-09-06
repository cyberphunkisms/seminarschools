#!/usr/bin/env node
'use strict';

/**
 * Discovery-v2 contract and browser regression gate for Sets 13-15.
 *
 * --dom-only verifies the authored shells, safe payloads, taxonomy, controller,
 * URL/filter semantics, and private/public boundary without claiming a browser
 * run. The default mode adds real Chromium interaction, responsive layout, and
 * EN/FR parity checks.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE = require(path.join(ROOT, 'js/polymythcal-discovery-core.js'));
const DOM_ONLY = process.argv.includes('--dom-only');
const READY_TIMEOUT_MS = 60000;
const GROUPS = Object.freeze([
  {set: 13, axis: 'communityFormats', field: 'community_heritage_formats', size: 22},
  {set: 14, axis: 'digitalFormats', field: 'live_digital_formats', size: 14},
  {set: 15, axis: 'programFormats', field: 'course_program_formats', size: 19},
]);
const RESEARCH_COMMON_AXES = Object.freeze(['kind', 'date', 'places', 'topics', 'audiences', 'formats']);
const RESEARCH_SPECIALIST_AXES = Object.freeze([
  'what', 'celestialKinds', 'presence', 'academicForms', 'artsFormats', 'participationFormats',
  'civicFormats', 'communityFormats', 'digitalFormats', 'programFormats', 'grades', 'statuses',
]);
const SHELLS = Object.freeze([
  {path: 'polymythseminars/index.html', lang: 'en-CA', surface: 'main', source: '/polymythseminars/browse.json'},
  {path: 'polymythseminars/fr/index.html', lang: 'fr-CA', surface: 'main', source: '/polymythseminars/browse.json'},
  {path: 'polymythseminars/research/index.html', lang: 'en-CA', surface: 'research', source: '/polymythseminars/browse.json'},
  {path: 'polymythseminars/fr/research/index.html', lang: 'fr-CA', surface: 'research', source: '/polymythseminars/browse.json'},
  {path: 'polymythseminars/monitoring/index.html', lang: 'en-CA', surface: 'monitoring', source: '/polymythseminars/watchlist.json'},
  {path: 'polymythseminars/fr/monitoring/index.html', lang: 'fr-CA', surface: 'monitoring', source: '/polymythseminars/watchlist.json'},
]);

const failures = [];
let assertions = 0;

function check(condition, label, detail = '') {
  assertions += 1;
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

function equal(actual, expected, label) {
  check(actual === expected, label, `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function sameValues(actual, expected, label) {
  const left = [...actual].map(String).sort();
  const right = [...expected].map(String).sort();
  check(JSON.stringify(left) === JSON.stringify(right), label, `expected ${JSON.stringify(right)}, received ${JSON.stringify(left)}`);
}

function read(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolute)) {
    failures.push(`${relativePath} is missing`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function json(relativePath) {
  const text = read(relativePath);
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON — ${error.message}`);
    return {};
  }
}

function collection(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

function taxonomyValues(payload, key) {
  return Object.keys(payload?.taxonomy?.axes?.[key]?.values || {});
}

function schemaAndPayloadContract() {
  const schema = json('data/polymythcal-event-schema-v2.json');
  const browse = json('polymythseminars/browse.json');
  const watchlist = json('polymythseminars/watchlist.json');
  const research = json('polymythseminars/research.json');
  const surfaces = json('data/polymythcal-publication-surfaces.json');
  const events = collection(browse, 'events');
  const monitored = collection(watchlist, 'items');
  const researchRecords = collection(research, 'records');

  equal(browse._schema || browse.schema, 'polymythcal-discovery-v2', 'chronology payload uses the discovery-v2 schema');
  equal(watchlist._schema || watchlist.schema, 'polymythcal-watchlist-v2', 'monitoring payload uses the watchlist-v2 schema');
  equal(research._schema || research.schema, 'polymythcal-research-v1', 'Research payload uses the research-v1 schema');
  equal(browse.count, events.length, 'chronology payload count is exact');
  equal(watchlist.count, monitored.length, 'monitoring payload count is exact');
  check(events.length > 0, 'chronology projection is non-empty');
  check(monitored.length > 0, 'monitoring projection is non-empty and separate');

  const chronologyIds = events.map(item => String(item?.id || ''));
  const monitoringIds = monitored.map(item => String(item?.id || ''));
  const monitoringIdSet = new Set(monitoringIds);
  check(chronologyIds.every(Boolean), 'every chronology item has an ID');
  check(monitoringIds.every(Boolean), 'every monitoring item has an ID');
  equal(new Set(chronologyIds).size, chronologyIds.length, 'chronology IDs are unique');
  equal(monitoringIdSet.size, monitoringIds.length, 'monitoring IDs are unique');
  equal(chronologyIds.filter(id => monitoringIdSet.has(id)).length, 0, 'chronology and monitoring IDs are disjoint');
  equal(surfaces.chronology_count, events.length, 'publication manifest chronology count is exact');
  equal(surfaces.watchlist_count, monitored.length, 'publication manifest monitoring count is exact');
  equal(surfaces.canonical_count, events.length + monitored.length, 'publication manifest accounts for the whole internal inventory');
  sameValues(surfaces.chronology_ids || [], chronologyIds, 'publication manifest chronology IDs are exact');
  sameValues(surfaces.watchlist_ids || [], monitoringIds, 'publication manifest monitoring IDs are exact');
  equal(research.count, researchRecords.length, 'Research payload count is exact');
  equal(researchRecords.length, events.length, 'Research projection covers the chronology exactly');
  sameValues(researchRecords.map(item => item.id), chronologyIds, 'Research projection IDs exactly match chronology IDs');

  const expected = new Map();
  for (const group of GROUPS) {
    const schemaValues = schema?.properties?.[group.field]?.items?.enum || [];
    const researchValues = taxonomyValues(research, group.axis);
    equal(schemaValues.length, group.size, `Set ${group.set} schema keeps ${group.size} controlled values`);
    equal(new Set(schemaValues).size, group.size, `Set ${group.set} schema values are unique`);
    sameValues(researchValues, schemaValues, `Set ${group.set} lazy Research taxonomy matches the locked schema`);
    equal(taxonomyValues(browse, group.axis).length, 0, `Set ${group.set} specialist taxonomy stays out of the main payload`);
    equal(taxonomyValues(watchlist, group.axis).length, 0, `Set ${group.set} specialist taxonomy stays out of the monitoring payload`);
    for (const value of schemaValues) {
      const ids = researchRecords.filter(item => (item.facets?.[group.axis] || []).includes(value)).map(item => item.id);
      expected.set(`${group.axis}:${value}`, ids);
    }
  }

  const forbiddenRawFields = GROUPS.map(group => group.field);
  for (const [name, items] of [['chronology', events], ['monitoring', monitored]]) {
    for (const item of items) {
      check(item && typeof item.facets === 'object' && !Array.isArray(item.facets), `${name} ${item?.id || '<missing>'} has a safe facet projection`);
      for (const field of forbiddenRawFields) {
        check(!Object.hasOwn(item || {}, field), `${name} ${item?.id || '<missing>'} does not expose private raw field ${field}`);
      }
      for (const group of GROUPS) {
        const values = item?.facets?.[group.axis];
        check(values === undefined || (Array.isArray(values) && values.length === 0), `${name} ${item?.id || '<missing>'} keeps specialist ${group.axis} out of the base payload`);
      }
    }
  }
  for (const item of researchRecords) {
    check(item && (item.facets === undefined || (typeof item.facets === 'object' && !Array.isArray(item.facets))), `Research ${item?.id || '<missing>'} has an optional safe specialist facet projection`);
    for (const field of forbiddenRawFields) check(!Object.hasOwn(item || {}, field), `Research ${item?.id || '<missing>'} does not expose private raw field ${field}`);
    for (const group of GROUPS) {
      const values = item?.facets?.[group.axis] || [];
      check(Array.isArray(values), `Research ${item?.id || '<missing>'} keeps ${group.axis} as an array`);
      equal(new Set(values).size, values.length, `Research ${item?.id || '<missing>'} has no duplicate ${group.axis} values`);
      const allowed = new Set(taxonomyValues(research, group.axis));
      for (const value of values) check(allowed.has(value), `Research ${item.id} uses a controlled ${group.axis} value`, value);
    }
  }
  const merged = CORE.mergeResearchProjection(browse, research);
  return {browse, watchlist, research, events: merged.events || [], baseEvents: events, monitored, expected};
}

function sourceContract() {
  const app = read('js/polymythcal-discovery.js');
  const core = read('js/polymythcal-discovery-core.js');
  const css = read('css/polymythcal-discovery.css');
  const mustInclude = [
    ['24-result page size', 'const PAGE_SIZE = 24'],
    ['specialist family registry', 'const RESEARCH_ORDER'],
    ['Set 13 research axis', "'communityFormats'"],
    ['Set 14 research axis', "'digitalFormats'"],
    ['Set 15 research axis', "'programFormats'"],
    ['exact facet counts', 'function optionCount(key, value)'],
    ['selected-zero retention and unselected-zero hiding', "if (count === 0 && !checked) return ''"],
    ['staged research families', 'function renderResearchFamilies()'],
    ['lazy research family mounting', 'function mountResearchFamily(details, options = null)'],
    ['filter finder', 'function filterResearchFamilies()'],
    ['route restriction', 'function routeMatches(event)'],
    ['route applied before inclusion', 'if (!routeMatches(event)'],
    ['focused-route default kind', 'const defaultContent = document.body.dataset.pmDefaultContent'],
    ['explicit focused-route all override', 'state.kindExplicitAll'],
    ['focused-route default restoration', "['attend', 'apply'].includes(defaultContent)"],
    ['focused-route Research handoff', 'routeScope'],
    ['URL state restoration', 'function readStateFromUrl()'],
    ['URL state serialization', 'function stateParams(overrides = {}, targetSurface = surface)'],
    ['history restoration', "window.addEventListener('popstate'"],
    ['click-only correction branch', "event.target.closest('[data-correction]')"],
    ['query-only correction authority', 'const suggestions = activeQueryMatchCount ? [] : correctionSuggestions(state.q)'],
    ['visible match reason', 'class="pmd-match-reason"'],
    ['explicit sort authority', "return state.q && !state.sortExplicit ? 'relevance' : state.sort"],
    ['semantic calendar table', 'class="pmd-calendar-table"'],
    ['small-screen agenda', 'class="pmd-calendar-agenda"'],
  ];
  for (const [label, token] of mustInclude) check(app.includes(token), `controller retains ${label}`);
  const matchStart = core.indexOf('function termMatchNormalized(');
  const matchEnd = core.indexOf('function termMatch(', matchStart);
  const inclusionLogic = matchStart >= 0 && matchEnd > matchStart ? core.slice(matchStart, matchEnd) : '';
  check(inclusionLogic.includes('words.includes(term.value)'), 'search inclusion supports exact whole words');
  check(inclusionLogic.includes('word.startsWith(term.value)'), 'search inclusion supports one-way forward prefixes');
  check(!/editDistance|levenshtein|fuzzy/i.test(inclusionLogic), 'search inclusion never uses fuzzy distance');
  const facetFixture = {facets: {topics: ['astronomy'], places: ['toronto-gta']}};
  check(
    CORE.matchesFacets(facetFixture, {topics: new Set(['history', 'astronomy'])}),
    'filters use OR within a facet',
  );
  check(
    !CORE.matchesFacets(facetFixture, {
      topics: new Set(['astronomy']),
      places: new Set(['montreal']),
    }),
    'filters use AND across selected facet families',
  );
  check(/\.pmd-option\s*\{[^}]*min-height:\s*44px/s.test(css), 'facet controls retain 44px-class targets');
  check(/@media \(max-width:\s*47\.5rem\)[\s\S]*?\.pmd-calendar-table-wrap\s*\{\s*display:\s*none;[\s\S]*?\.pmd-calendar-agenda\s*\{\s*display:\s*block;/s.test(css), 'calendar switches from table to agenda on narrow/high-zoom layouts');
  try {
    require('child_process').execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/polymythcal-discovery.js')], {stdio: 'pipe'});
  } catch (_) {
    failures.push('js/polymythcal-discovery.js fails node --check');
  }
}

function shellContract() {
  for (const shell of SHELLS) {
    const html = read(shell.path);
    check(new RegExp(`<html\\b[^>]*lang=["']${shell.lang}["']`, 'i').test(html), `${shell.path} declares ${shell.lang}`);
    check(html.includes(`data-pmd-surface="${shell.surface}"`), `${shell.path} declares the ${shell.surface} surface`);
    check(html.includes(`data-pmd-source="${shell.source}"`), `${shell.path} uses the correct public projection`);
    check(html.includes('/js/polymythcal-discovery.js'), `${shell.path} loads the discovery-v2 controller`);
    check(html.includes('/css/polymythcal-discovery.css'), `${shell.path} loads discovery-v2 CSS`);
    for (const id of ['pmdSearch', 'pmdSearchStatus', 'pmdResults', 'pmdResultsTitle', 'pmdResultsCount', 'pmdSelected', 'pmdLiveStatus', 'pmdList', 'pmdPagination']) {
      check(html.includes(`id="${id}"`), `${shell.path} exposes #${id}`);
    }
    check(html.includes('role="status" aria-live="polite"'), `${shell.path} exposes a polite live status`);
    check(html.includes('aria-busy="true"'), `${shell.path} declares loading state accessibly`);
    check(html.includes('hreflang="'), `${shell.path} exposes its language counterpart`);
    check(!/id="(?:pmQuickStarts|pmJumpResults|eventsContainer|watchlistPanel)"/.test(html), `${shell.path} does not restore legacy UI layers`);
    check(Buffer.byteLength(html, 'utf8') < 100000, `${shell.path} remains a compact client shell`);
    if (shell.surface === 'research') {
      check(html.includes('data-pmd-research-source="/polymythseminars/research.json"'), `${shell.path} declares its lazy Research projection`);
      check(html.includes('id="pmdFacetSearch"'), `${shell.path} exposes the research filter finder`);
      check(html.includes('id="pmdResearchFilters"'), `${shell.path} exposes staged research families`);
      check(!html.includes('id="pmdFilterDrawer"'), `${shell.path} does not wrap the specialist taxonomy in the common drawer`);
    } else {
      check(html.includes('id="pmdFilterDrawer"'), `${shell.path} exposes a collapsed common-filter drawer`);
      check(!/<details[^>]*id="pmdFilterDrawer"[^>]*\sopen(?:\s|=|>)/i.test(html), `${shell.path} common-filter drawer starts collapsed`);
    }
    if (shell.surface === 'monitoring') {
      check(!html.includes('id="pmdCalendar"'), `${shell.path} does not pretend monitoring markers are calendar dates`);
    } else {
      check(html.includes('id="pmdCalendar"'), `${shell.path} exposes the list/calendar view mount`);
    }
  }

  const main = read('polymythseminars/index.html');
  const research = read('polymythseminars/research/index.html');
  equal((main.match(/id="pmdSearch"/g) || []).length, 1, 'main shell has exactly one search field');
  check(/<div id="pmdCommonFilters"[^>]*><\/div>/.test(main), 'main shell leaves common filters data-driven instead of embedding a filter wall');
  check(/<div id="pmdResearchFilters"[^>]*><\/div>/.test(research), 'Research shell stages taxonomy families instead of embedding every option');
  const focused = [...main.matchAll(/href="\/(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\/"/g)].map(match => match[1]);
  equal(new Set(focused).size, 11, 'main shell keeps all 11 focused calendars in one disclosure');

  // The DOM-only gate also runs before public/ is rebuilt, so enforce the
  // public-builder policy here; parity gates inspect the generated tree later.
  const publicBuilder = read('scripts/build-public-deploy.js');
  check(publicBuilder.includes("'polymythseminars/events.json'"), 'public builder explicitly quarantines the private canonical corpus');
  check(/BLOCKED_DIRS[^;]*['"]data['"]/s.test(publicBuilder), 'public builder excludes the private data directory');
  check(publicBuilder.includes('PUBLICATION_BLOCKLISTS') && publicBuilder.includes('watchlistIds'), 'public builder quarantines monitoring ICS files while retaining stable detail routes');
}

function mime(file) {
  return ({'.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveSource(requestUrl) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(requestUrl, 'http://polymythcal.test').pathname); } catch (_) { return null; }
  const requested = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
  if (requested !== ROOT && !requested.startsWith(`${ROOT}${path.sep}`)) return null;
  try {
    const stat = fs.statSync(requested);
    if (stat.isFile()) return requested;
    if (stat.isDirectory() && fs.existsSync(path.join(requested, 'index.html'))) return path.join(requested, 'index.html');
  } catch (_) {}
  return null;
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const file = resolveSource(request.url || '/');
    if (!file) { response.writeHead(404, {'content-type': 'text/plain'}); response.end('Not found'); return; }
    response.writeHead(200, {'cache-control': 'no-store', 'content-type': mime(file)});
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve))};
}

function chromiumExecutable(chromium) {
  return [process.env.CHROME_EXECUTABLE, '/tmp/chromium', chromium.executablePath()].filter(Boolean).find(candidate => fs.existsSync(candidate)) || '';
}

async function runtime(browser, base, options = {}) {
  const context = await browser.newContext({
    viewport: {width: options.width || 1280, height: options.height || 900},
    hasTouch: Boolean(options.touch), deviceScaleFactor: options.deviceScaleFactor || 1,
    locale: options.locale || 'en-CA', reducedMotion: 'reduce',
  });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.fulfill({status: 204, body: ''}));
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', request => { if (request.url().startsWith(base)) errors.push(`requestfailed: ${request.url()}`); });
  return {context, page, errors};
}

async function ready(page, url) {
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS});
  await page.waitForFunction(() => document.getElementById('pmdResults')?.getAttribute('aria-busy') === 'false', undefined, {timeout: READY_TIMEOUT_MS});
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}

function integer(text) {
  const firstNumber = String(text || '').match(/\d[\d\s,.\u00a0\u202f]*/)?.[0] || '';
  const digits = firstNumber.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

async function waitCount(page, expected) {
  await page.waitForFunction(value => {
    const text = document.getElementById('pmdResultsCount')?.textContent || '';
    const firstNumber = text.match(/\d[\d\s,.\u00a0\u202f]*/)?.[0] || '';
    return Number(firstNumber.replace(/\D/g, '')) === value;
  }, expected);
}

function coveredValues(events, axis, amount = 2) {
  const counts = new Map();
  for (const event of events) for (const value of event.facets?.[axis] || []) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, amount).map(([value]) => value);
}

async function openFamily(page, axis) {
  const details = page.locator(`.pmd-research-family[data-axis="${axis}"]`);
  if (!(await details.evaluate(node => node.open))) await details.locator('summary').click();
  await page.waitForSelector(`.pmd-research-family[data-axis="${axis}"] input[data-axis="${axis}"]`);
}

async function browserLocale(browser, base, code, data) {
  const prefix = code === 'fr' ? '/polymythseminars/fr/research/' : '/polymythseminars/research/';
  const expectedLang = code === 'fr' ? 'fr-CA' : 'en-CA';
  const {context, page, errors} = await runtime(browser, base, {locale: expectedLang});
  try {
    await ready(page, `${base}${prefix}?date=all&sort=title`);
    equal(await page.locator('html').getAttribute('lang'), expectedLang, `${code.toUpperCase()} browser loads the intended Research shell`);
    const stagedResearchAxes = await page.evaluate(() => ({
      common: [...new Set([...document.querySelectorAll('#pmdResearchCommonFilters input[data-axis]')].map(input => input.dataset.axis))],
      specialist: [...document.querySelectorAll('.pmd-research-family')].map(details => details.dataset.axis),
    }));
    sameValues(stagedResearchAxes.common, RESEARCH_COMMON_AXES, `${code.toUpperCase()} browser stages all six common Research axes`);
    sameValues(stagedResearchAxes.specialist, RESEARCH_SPECIALIST_AXES, `${code.toUpperCase()} browser stages all twelve specialist Research families`);
    equal(new Set([...stagedResearchAxes.common, ...stagedResearchAxes.specialist]).size, 18, `${code.toUpperCase()} browser stages 18 distinct Research axes`);
    equal(await page.locator('.pmd-research-family[open]').count(), 0, `${code.toUpperCase()} research families start closed`);
    equal(await page.locator('.pmd-research-family input').count(), 0, `${code.toUpperCase()} closed research families are lazy`);

    for (const group of GROUPS) {
      await openFamily(page, group.axis);
      equal(await page.locator(`.pmd-research-family[data-axis="${group.axis}"] input[data-axis="${group.axis}"]`).count(), group.size, `${code.toUpperCase()} Set ${group.set} mounts all controlled values with nonzero counts`);
      const value = coveredValues(data.events, group.axis, 1)[0];
      const expected = data.expected.get(`${group.axis}:${value}`)?.length || 0;
      const input = page.locator(`input[data-axis="${group.axis}"][data-value="${value}"]`);
      const shownCount = integer(await input.locator('xpath=..').locator('.pmd-option-count').textContent());
      equal(shownCount, expected, `${code.toUpperCase()} Set ${group.set} option count is exact`);
      await input.check();
      await waitCount(page, expected);
      equal(new URL(page.url()).searchParams.get(group.axis), value, `${code.toUpperCase()} Set ${group.set} selection is shareable`);
      equal(await page.locator(`#pmdSelected [data-action="remove-filter"][data-axis="${group.axis}"][data-value="${value}"]`).count(), 1, `${code.toUpperCase()} Set ${group.set} selection is removable`);
      await page.locator(`#pmdSelected [data-action="remove-filter"][data-axis="${group.axis}"][data-value="${value}"]`).click();
      await page.waitForFunction(key => !new URLSearchParams(location.search).has(key), group.axis);
      await page.waitForFunction(expected => document.querySelectorAll('.pmd-research-family').length === expected, RESEARCH_SPECIALIST_AXES.length);
    }

    const group = GROUPS[0];
    const crossAxis = 'statuses';
    const crossableEvents = data.events.filter(event => (event.facets?.[crossAxis] || []).length > 0);
    const [left, right] = coveredValues(crossableEvents, group.axis, 2);
    check(Boolean(left && right), `${code.toUpperCase()} OR fixture has two Set 13 values compatible with the cross-family status test`);
    await openFamily(page, group.axis);
    await page.locator(`input[data-axis="${group.axis}"][data-value="${left}"]`).check();
    await page.locator(`input[data-axis="${group.axis}"][data-value="${right}"]`).check();
    const union = data.events.filter(event => (event.facets?.[group.axis] || []).some(value => value === left || value === right)).length;
    await waitCount(page, union);
    equal(new URL(page.url()).searchParams.get(group.axis), [left, right].sort().join(','), `${code.toUpperCase()} Set 13 uses OR within the family`);

    const unionEvents = data.events.filter(event => (
      event.facets?.[group.axis] || []
    ).some(value => value === left || value === right));
    const cross = coveredValues(unionEvents, crossAxis, 1)[0];
    check(Boolean(cross), `${code.toUpperCase()} cross-family fixture has a compatible status value`);
    await openFamily(page, crossAxis);
    await page.locator(`input[data-axis="${crossAxis}"][data-value="${cross}"]`).check();
    const intersection = unionEvents.filter(event => (event.facets?.[crossAxis] || []).includes(cross)).length;
    await waitCount(page, intersection);
    equal(integer(await page.locator('#pmdResultsCount').textContent()), intersection, `${code.toUpperCase()} research filters use AND across families`);
    check(errors.length === 0, `${code.toUpperCase()} Research run has no browser errors`, errors.join(' | '));
  } finally {
    await context.close();
  }
}

async function browserDiscovery(browser, base, data) {
  const {context, page, errors} = await runtime(browser, base, {width: 1280, height: 900});
  try {
    await ready(page, `${base}/polymythseminars/?date=all&sort=title`);
    equal(await page.locator('.pm-event-card').count(), 24, 'list view renders exactly one 24-group page');
    const secondPageLink = page.locator('#pmdPagination a[data-page="2"]:not([rel])');
    check(await secondPageLink.count() === 1, 'pagination exposes one numbered second-page link alongside navigation controls');
    await secondPageLink.click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('page') === '2');

    await page.locator('#pmdSearch').fill('celestail');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('q') === 'celestail');
    await waitCount(page, 0);
    equal(await page.locator('.pm-event-card').count(), 0, 'misspelling does not silently add fuzzy results');
    equal(await page.locator('[data-correction="celestial"]').count(), 1, 'misspelling offers a click-to-apply correction');
    await page.locator('[data-correction="celestial"]').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('q') === 'celestial');
    check(integer(await page.locator('#pmdResultsCount').textContent()) > 0, 'chosen correction performs a new exact/prefix search');
    equal(await page.locator('.pm-event-card:not(:has(.pmd-match-reason))').count(), 0, 'every visible query result explains its match');
    check(errors.length === 0, 'main discovery run has no browser errors', errors.join(' | '));
  } finally {
    await context.close();
  }

  for (const routeCase of [
    {route: 'writingkids', matches: event => (event.writing_bands || []).includes('kids'), kind: 'apply'},
    {route: 'cfps', matches: event => (event.academic_bands || []).includes('cfps'), kind: 'apply'},
  ]) {
    const routePath = path.join(ROOT, routeCase.route, 'index.html');
    if (!fs.existsSync(routePath) || !read(`${routeCase.route}/index.html`).includes('/js/polymythcal-discovery.js')) {
      failures.push(`${routeCase.route} focused route has not been rebuilt onto discovery-v2`);
      continue;
    }
    const routed = await runtime(browser, base, {width: 1100, height: 850});
    try {
      await ready(routed.page, `${base}/${routeCase.route}/?date=all&sort=title`);
      const expected = data.events.filter(event => routeCase.matches(event) && (event.facets?.kind || []).includes(routeCase.kind)).length;
      await waitCount(routed.page, expected);
      equal(integer(await routed.page.locator('#pmdResultsCount').textContent()), expected, `${routeCase.route} restricts the corpus and applies its default kind`);
      equal(new URL(routed.page.url()).searchParams.get('kind'), routeCase.kind, `${routeCase.route} persists its default kind in the shareable URL`);
      await routed.page.goto(`${base}/${routeCase.route}/?date=all&sort=title&kind=all`, {waitUntil: 'domcontentloaded'});
      await routed.page.waitForFunction(() => document.getElementById('pmdResults')?.getAttribute('aria-busy') === 'false');
      const allExpected = data.events.filter(routeCase.matches).length;
      await waitCount(routed.page, allExpected);
      equal(integer(await routed.page.locator('#pmdResultsCount').textContent()), allExpected, `${routeCase.route} honors explicit kind=all`);
      check(routed.errors.length === 0, `${routeCase.route} discovery run has no browser errors`, routed.errors.join(' | '));
    } finally {
      await routed.context.close();
    }
  }
}

async function browserResponsive(browser, base) {
  for (const layout of [
    {label: 'mobile touch', width: 375, height: 812, touch: true, scale: 1},
    {label: '200% desktop zoom equivalent', width: 640, height: 600, touch: false, scale: 2},
  ]) {
    const {context, page, errors} = await runtime(browser, base, {width: layout.width, height: layout.height, touch: layout.touch, deviceScaleFactor: layout.scale});
    try {
      await ready(page, `${base}/polymythseminars/?date=all&view=calendar`);
      const measurement = await page.evaluate(() => ({
        overflow: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        table: getComputedStyle(document.querySelector('.pmd-calendar-table-wrap')).display,
        agenda: getComputedStyle(document.querySelector('.pmd-calendar-agenda')).display,
        undersized: [...document.querySelectorAll('button, .pmd-option, .pmd-mobile-bar a')].filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.height < 43;
        }).length,
      }));
      check(measurement.overflow <= 2, `${layout.label} has no horizontal document overflow`, `${measurement.overflow}px`);
      equal(measurement.table, 'none', `${layout.label} hides the dense calendar table`);
      check(measurement.agenda !== 'none', `${layout.label} exposes the readable agenda`);
      equal(measurement.undersized, 0, `${layout.label} keeps interactive controls at 44px-class height`);
      check(errors.length === 0, `${layout.label} has no browser errors`, errors.join(' | '));
    } finally {
      await context.close();
    }
  }
}

function report(mode) {
  if (failures.length) {
    console.error(`POLYMYTHCAL SETS 13-15 ${mode} CHECK FAILED`);
    for (const failure of failures.slice(0, 300)) console.error(` - ${failure}`);
    if (failures.length > 300) console.error(` - … ${failures.length - 300} more`);
    process.exitCode = 1;
    return;
  }
  console.log(`POLYMYTHCAL SETS 13-15 ${mode} CHECK PASSED — ${assertions} assertions; exact 22/14/19 taxonomy, safe split payloads, compact EN/FR shells${DOM_ONLY ? '' : ', exact browser counts, URL state, pagination, no fuzzy inclusion, route filtering, and responsive accessibility'}.`);
}

(async () => {
  const data = schemaAndPayloadContract();
  sourceContract();
  shellContract();
  if (DOM_ONLY) { report('DOM-ONLY'); return; }
  if (failures.length) { report('BROWSER'); return; }

  const {chromium} = require('playwright');
  const server = await startServer();
  let browser;
  try {
    const launch = {headless: true};
    const executablePath = chromiumExecutable(chromium);
    if (executablePath) launch.executablePath = executablePath;
    browser = await chromium.launch(launch);
    await browserLocale(browser, server.base, 'en', data);
    await browserLocale(browser, server.base, 'fr', data);
    await browserDiscovery(browser, server.base, data);
    await browserResponsive(browser, server.base);
  } catch (error) {
    failures.push(`browser execution failed — ${error.stack || error}`);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  report('BROWSER');
})().catch(error => {
  console.error(`POLYMYTHCAL SETS 13-15 CHECK FAILED — ${error.stack || error}`);
  process.exit(1);
});
