#!/usr/bin/env node
'use strict';

/**
 * Browser/source contract for the Set 13-15 Polymythcal facets.
 *
 * The default mode serves this source tree and exercises Chromium.  Use
 * --dom-only while the authored ledgers are still being assembled: that mode
 * checks the locked schema, both localized shells, and the controller/payload
 * wiring without pretending that a browser run or data-coverage run occurred.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOM_ONLY = process.argv.includes('--dom-only');
const SCHEMA_PATH = 'data/polymythcal-event-schema-v2.json';
const BROWSE_PATH = 'polymythseminars/browse.json';
const CONTROLLER_PATH = 'js/polymythcal-revamp.js';
const BROWSER_BUILDER_PATH = 'scripts/build-polymythcal-browser-payload.js';
const EXPECTED_GROUP_SIZES = Object.freeze([22, 14, 19]);
// Rendering and indexing 2,088 bilingual records can exceed the interaction
// timeout on a cold, resource-contended release runner. Readiness remains a
// hard requirement; it simply has a separate bounded convergence window.
const READY_TIMEOUT_MS = 60000;

const GROUP_SPECS = Object.freeze([
  {
    set: 13,
    key: 'communityFormats',
    field: 'community_heritage_formats',
    titleId: 'pmCommunityFormatsTitle',
  },
  {
    set: 14,
    key: 'digitalFormats',
    field: 'live_digital_formats',
    titleId: 'pmDigitalFormatsTitle',
  },
  {
    set: 15,
    key: 'programFormats',
    field: 'course_program_formats',
    titleId: 'pmProgramFormatsTitle',
  },
]);

const LOCALES = Object.freeze([
  {code: 'en', lang: 'en-CA', route: '/polymythseminars/'},
  {code: 'fr', lang: 'fr-CA', route: '/polymythseminars/fr/'},
]);

const LAYOUT_CASES = Object.freeze([
  {label: 'desktop-1440', width: 1440, height: 1000, touch: false, deviceScaleFactor: 1},
  {label: 'mobile-375-touch', width: 375, height: 812, touch: true, deviceScaleFactor: 1},
  // A 640 CSS-pixel viewport at DPR 2 is the layout space available to a
  // 1280-pixel-wide display at 200% browser zoom.
  {label: 'desktop-1280-at-200-percent', width: 640, height: 500, touch: false, deviceScaleFactor: 2},
]);

const failures = [];
let assertions = 0;

function check(condition, label, detail = '') {
  assertions += 1;
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

function equal(actual, expected, label) {
  check(
    actual === expected,
    label,
    `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function sameValues(actual, expected, label) {
  const left = [...actual].map(String).sort();
  const right = [...expected].map(String).sort();
  check(
    JSON.stringify(left) === JSON.stringify(right),
    label,
    `expected ${JSON.stringify(right)}, received ${JSON.stringify(left)}`,
  );
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function parseAttributes(tag) {
  const attributes = Object.create(null);
  const pattern = /([^\s=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(tag))) {
    const name = match[1].toLowerCase();
    if (name === 'input' || name === 'span' || name === 'label' || name === 'button') continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function tagsWithAttribute(html, tagName, attribute) {
  const pattern = new RegExp(`<${tagName}\\b(?=[^>]*\\b${attribute}(?:\\s*=|\\s|>))[^>]*>`, 'gi');
  return [...html.matchAll(pattern)].map(match => ({tag: match[0], attributes: parseAttributes(match[0])}));
}

function schemaGroups() {
  const schema = json(SCHEMA_PATH);
  return GROUP_SPECS.map((spec, index) => {
    const values = schema?.properties?.[spec.field]?.items?.enum;
    check(Array.isArray(values), `Set ${spec.set} locked schema exposes ${spec.field} enum`);
    const safeValues = Array.isArray(values) ? values.map(String) : [];
    equal(
      safeValues.length,
      EXPECTED_GROUP_SIZES[index],
      `Set ${spec.set} locked schema retains its complete facet vocabulary`,
    );
    equal(new Set(safeValues).size, safeValues.length, `Set ${spec.set} schema values are unique`);
    return {...spec, values: safeValues};
  });
}

function sourceContract(groups) {
  const controller = read(CONTROLLER_PATH);
  const builder = read(BROWSER_BUILDER_PATH);
  const setKeysMatch = controller.match(/const SET_KEYS\s*=\s*(\[[^;]+\])/);
  let controllerSetKeys = [];
  try {
    controllerSetKeys = setKeysMatch ? JSON.parse(setKeysMatch[1]) : [];
  } catch (_) {
    controllerSetKeys = [];
  }
  check(setKeysMatch, 'controller exposes an inspectable SET_KEYS contract');
  for (const group of groups) {
    check(controllerSetKeys.includes(group.key), `Set ${group.set} belongs to controller SET_KEYS`, group.key);
    check(
      controller.includes(`classifyDeclaredFormats(event, "${group.field}"`),
      `Set ${group.set} classifier reads only its explicit canonical field`,
      group.field,
    );
    check(
      controller.includes(`if (ignoreKey !== "${group.key}" && !setMatches(state.${group.key}, event._${group.key})) return false;`),
      `Set ${group.set} participates in result matching`,
    );
    check(
      controller.includes(`if (key === "${group.key}") return event._${group.key}.includes(value);`),
      `Set ${group.set} participates in facet membership checks`,
    );
    check(
      controller.includes(`: key === "${group.key}" ? event._${group.key}`),
      `Set ${group.set} participates in live facet counts`,
    );
    check(builder.includes(`'${group.field}'`) || builder.includes(`"${group.field}"`), `browse projection retains ${group.field}`);
  }
  check(
    controller.includes('for (const key of SET_KEYS.filter(key => key !== "content")) state[key].clear();'),
    'Reset all clears every current and future SET_KEYS facet through the shared registry',
  );
}

function localizedDomContract(groups) {
  for (const locale of LOCALES) {
    const relativePath = locale.code === 'fr' ? 'polymythseminars/fr/index.html' : 'polymythseminars/index.html';
    const html = read(relativePath);
    const inputs = tagsWithAttribute(html, 'input', 'data-state-set');
    const countNodes = tagsWithAttribute(html, 'span', 'data-count-for');
    const labels = tagsWithAttribute(html, 'label', 'data-label-key');
    const seenAll = [];

    check(
      new RegExp(`<html\\b[^>]*\\blang=["']${locale.lang}["']`, 'i').test(html),
      `${locale.code.toUpperCase()} shell declares ${locale.lang}`,
    );
    for (const group of groups) {
      const facetInputs = inputs.filter(item => item.attributes['data-state-set'] === group.key);
      const values = facetInputs.map(item => item.attributes.value);
      equal(
        facetInputs.length,
        group.values.length,
        `${locale.code.toUpperCase()} Set ${group.set} renders every locked control`,
      );
      sameValues(values, group.values, `${locale.code.toUpperCase()} Set ${group.set} control IDs match the locked schema`);
      check(
        new RegExp(`<section\\b[^>]*aria-labelledby=["']${group.titleId}["'][^>]*>`, 'i').test(html),
        `${locale.code.toUpperCase()} Set ${group.set} facet has a labelled section`,
      );
      check(
        new RegExp(`<button\\b[^>]*data-clear-section=["']${group.key}["'][^>]*>`, 'i').test(html),
        `${locale.code.toUpperCase()} Set ${group.set} facet has its own clear control`,
      );
      for (const value of group.values) {
        const contractId = `${group.key}:${value}`;
        equal(
          labels.filter(item => item.attributes['data-label-key'] === contractId).length,
          1,
          `${locale.code.toUpperCase()} ${contractId} has one interactive label`,
        );
        equal(
          countNodes.filter(item => item.attributes['data-count-for'] === contractId).length,
          1,
          `${locale.code.toUpperCase()} ${contractId} has one live count`,
        );
        seenAll.push(contractId);
      }
    }
    equal(seenAll.length, 55, `${locale.code.toUpperCase()} shell exposes all 55 Set 13-15 facet IDs`);
    equal(new Set(seenAll).size, 55, `${locale.code.toUpperCase()} Set 13-15 facet IDs are unique`);
  }
}

function browseContract(groups, requireCoverage) {
  const payload = json(BROWSE_PATH);
  const events = Array.isArray(payload) ? payload : payload.events;
  check(Array.isArray(events), 'browse payload exposes an events array');
  if (!Array.isArray(events)) return {payload, events: [], expected: new Map()};
  const declaredCount = Number.isInteger(payload.count) ? payload.count : events.length;
  equal(declaredCount, events.length, 'browse payload count matches its dynamic event array length');
  if (Number.isInteger(payload._canonical_count)) {
    equal(payload._canonical_count, events.length, 'browse payload canonical count matches its dynamic event array length');
  }
  const ids = events.map(event => String(event?.id || ''));
  check(ids.every(Boolean), 'every browse record has a non-empty ID');
  equal(new Set(ids).size, ids.length, 'browse record IDs are unique');

  const expected = new Map();
  for (const group of groups) {
    const allowed = new Set(group.values);
    for (const event of events) {
      if (!Object.hasOwn(event, group.field)) continue;
      check(Array.isArray(event[group.field]), `${event.id || '<missing-id>'} keeps ${group.field} as an array`);
      if (!Array.isArray(event[group.field])) continue;
      equal(
        new Set(event[group.field]).size,
        event[group.field].length,
        `${event.id} has no duplicate ${group.field} values`,
      );
      for (const value of event[group.field]) {
        check(allowed.has(value), `${event.id} uses a locked ${group.field} value`, String(value));
      }
    }
    for (const value of group.values) {
      const contractId = `${group.key}:${value}`;
      const matches = events
        .filter(event => Array.isArray(event[group.field]) && event[group.field].includes(value))
        .map(event => String(event.id));
      expected.set(contractId, matches);
      if (requireCoverage) {
        check(matches.length > 0, `${contractId} has at least one explicitly classified browse record`);
      }
    }
  }
  return {payload, events, expected};
}

function mime(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.ics': 'text/calendar; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveSource(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://polymythcal.test').pathname);
  } catch (_) {
    return null;
  }
  const requested = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
  if (requested !== ROOT && !requested.startsWith(`${ROOT}${path.sep}`)) return null;
  try {
    const stat = fs.statSync(requested);
    if (stat.isFile()) return requested;
    if (stat.isDirectory()) {
      const index = path.join(requested, 'index.html');
      if (fs.existsSync(index)) return index;
    }
  } catch (_) {}
  return null;
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const file = resolveSource(request.url || '/');
    if (!file) {
      response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
      response.end('Not found');
      return;
    }
    response.writeHead(200, {'cache-control': 'no-store', 'content-type': mime(file)});
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

function chromiumExecutable(chromium) {
  const candidates = [
    process.env.CHROME_EXECUTABLE,
    '/tmp/chromium',
    chromium.executablePath(),
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || '';
}

async function newRuntime(browser, base, options = {}) {
  const context = await browser.newContext({
    viewport: {width: options.width || 1280, height: options.height || 900},
    hasTouch: Boolean(options.touch),
    deviceScaleFactor: options.deviceScaleFactor || 1,
    locale: options.locale === 'fr' ? 'fr-CA' : 'en-CA',
    reducedMotion: 'reduce',
  });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    return route.fulfill({status: 204, body: ''});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.stack || error}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(base)) errors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`);
  });
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      errors.push(`response ${response.status()}: ${response.url()}`);
    }
  });
  return {context, page, errors};
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function ready(page, url) {
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS});
  await page.waitForFunction(() => (
    document.getElementById('pmResults')?.getAttribute('aria-busy') === 'false'
    && /^\s*[\d\s,.\u00a0\u202f]+\s/.test(document.getElementById('pmResultsTitle')?.textContent || '')
  ), undefined, {timeout: READY_TIMEOUT_MS});
  await settle(page);
}

async function openFilters(page) {
  await page.locator('#pmFilterDrawer').evaluate(drawer => { drawer.open = true; });
  await settle(page);
}

function integerFromText(text) {
  const digits = String(text || '').replace(/\D/g, '');
  return digits ? Number(digits) : Number.NaN;
}

async function resultCount(page) {
  return integerFromText(await page.locator('#pmResultsTitle').textContent());
}

async function waitForResultCount(page, expected) {
  await page.waitForFunction(value => {
    const digits = (document.getElementById('pmResultsTitle')?.textContent || '').replace(/\D/g, '');
    return digits && Number(digits) === value;
  }, expected);
}

async function collectAllResultIds(page, expectedCount) {
  await waitForResultCount(page, expectedCount);
  const loadMore = page.locator('#pmLoadMore');
  let guard = 0;
  while (!(await loadMore.evaluate(button => button.hidden))) {
    const before = await page.locator('.pm-event-card').count();
    await loadMore.click();
    await page.waitForFunction(previous => (
      document.querySelectorAll('.pm-event-card').length > previous
      || document.getElementById('pmLoadMore')?.hidden
    ), before);
    guard += 1;
    if (guard > 1000) throw new Error('Load-more guard exceeded');
  }
  const ids = await page.locator('.pm-event-card').evaluateAll(cards => cards.map(card => card.dataset.eventId));
  equal(ids.length, expectedCount, 'rendered result-card count matches the dynamic result total');
  equal(new Set(ids).size, ids.length, 'rendered result cards have unique IDs');
  return ids;
}

function expectedUnion(expected, group, values) {
  const ids = new Set();
  for (const value of values) {
    for (const id of expected.get(`${group.key}:${value}`) || []) ids.add(id);
  }
  return [...ids];
}

async function assertExactResults(page, ids, label) {
  const rendered = await collectAllResultIds(page, ids.length);
  sameValues(rendered, ids, `${label} returns exactly the explicitly declared record IDs`);
}

function queryUrl(base, locale, params) {
  const query = params.toString();
  return `${base}${locale.route}${query ? `?${query}` : ''}`;
}

async function assertRuntimeErrors(errors, label) {
  // Give deferred assets and promise handlers one final turn to report errors.
  await new Promise(resolve => setTimeout(resolve, 0));
  check(errors.length === 0, `${label} has no console, page, request, or local HTTP errors`, errors.join(' | '));
}

async function runExactFacetLocale(browser, base, locale, groups, expected) {
  const runtime = await newRuntime(browser, base, {locale: locale.code, width: 1280, height: 900});
  const {context, page, errors} = runtime;
  const label = `${locale.code.toUpperCase()} exact-facet`;
  try {
    const params = new URLSearchParams({time: 'all', sort: 'title'});
    await ready(page, queryUrl(base, locale, params));
    await openFilters(page);
    equal(await page.locator('html').getAttribute('lang'), locale.lang, `${label} loads the intended language shell`);
    equal(
      await page.locator('[data-state-set="communityFormats"], [data-state-set="digitalFormats"], [data-state-set="programFormats"]').count(),
      55,
      `${label} renders all 55 controls`,
    );

    for (const group of groups) {
      equal(
        await page.locator(`[data-state-set="${group.key}"]`).count(),
        group.values.length,
        `${label} Set ${group.set} renders ${group.values.length} controls`,
      );
      for (const value of group.values) {
        const contractId = `${group.key}:${value}`;
        const explicitIds = expected.get(contractId) || [];
        const countText = await page.locator(`[data-count-for="${contractId}"]`).textContent();
        equal(integerFromText(countText), explicitIds.length, `${label} ${contractId} live count is explicit-field-derived`);
      }
    }

    for (const group of groups) {
      for (const value of group.values) {
        const contractId = `${group.key}:${value}`;
        const explicitIds = expected.get(contractId) || [];
        const input = page.locator(`[data-state-set="${group.key}"][value="${value}"]`);
        check(!(await input.isDisabled()), `${label} ${contractId} is enabled because it has explicit records`);
        await input.check();
        await page.waitForFunction(({key, value}) => (
          new URLSearchParams(location.search).get(key)?.split(',').includes(value)
        ), {key: group.key, value});
        equal(
          new URL(page.url()).searchParams.get(group.key),
          value,
          `${label} ${contractId} serializes into the shareable URL`,
        );
        equal(await resultCount(page), explicitIds.length, `${label} ${contractId} result count is exact`);
        await assertExactResults(page, explicitIds, `${label} ${contractId}`);
        equal(
          await page.locator(`[data-remove-filter="${group.key}"][data-remove-value="${value}"]`).count(),
          1,
          `${label} ${contractId} exposes one removable active-filter chip`,
        );
        // Clear with the keyboard after the pointer-driven check. This still
        // proves the real checkbox interaction in every one of the 55 exact
        // facet cases, without relying on a second synthetic pointer action
        // after the result grid has reflowed and moved the control.
        await input.press('Space');
        await page.waitForFunction(({key, value}) => (
          !document.querySelector(`[data-state-set="${key}"][value="${value}"]`)?.checked
          && !new URLSearchParams(location.search).has(key)
        ), {key: group.key, value});
      }
    }

    for (const group of groups) {
      const values = firstCoveredValues(group, expected, 2);
      equal(values.length, 2, `${label} Set ${group.set} finds two covered values for OR multi-select`);
      if (values.length < 2) continue;
      for (const value of values) {
        await page.locator(`[data-state-set="${group.key}"][value="${value}"]`).check();
      }
      const serialized = [...values].sort().join(',');
      await page.waitForFunction(({key, value}) => new URLSearchParams(location.search).get(key) === value, {
        key: group.key,
        value: serialized,
      });
      equal(new URL(page.url()).searchParams.get(group.key), serialized, `${label} Set ${group.set} serializes OR multi-select`);
      await assertExactResults(page, expectedUnion(expected, group, values), `${label} Set ${group.set} OR multi-select`);
      await page.locator(`[data-clear-section="${group.key}"]`).click();
      await page.waitForFunction(key => !new URLSearchParams(location.search).has(key), group.key);
      equal(await page.locator(`[data-state-set="${group.key}"]:checked`).count(), 0, `${label} Set ${group.set} section clear removes its multi-select`);
    }
    await assertRuntimeErrors(errors, label);
  } finally {
    await context.close();
  }
}

function firstCoveredValues(group, expected, count) {
  return group.values.filter(value => (expected.get(`${group.key}:${value}`) || []).length > 0).slice(0, count);
}

async function runStateHistoryKeyboardLocale(browser, base, locale, groups, expected) {
  const runtime = await newRuntime(browser, base, {locale: locale.code, width: 1180, height: 900});
  const {context, page, errors} = runtime;
  const label = `${locale.code.toUpperCase()} state/history/keyboard`;
  try {
    const groupA = groups[0];
    const valuesA = firstCoveredValues(groupA, expected, 2);
    equal(valuesA.length, 2, `${label} finds two covered Set 13 values for OR multi-select`);
    const groupB = groups[1];
    const valueB = firstCoveredValues(groupB, expected, 1)[0];
    check(Boolean(valueB), `${label} finds a covered Set 14 value for history state`);
    if (valuesA.length < 2 || !valueB) return;

    const baseParams = new URLSearchParams({time: 'all', sort: 'title'});
    await ready(page, queryUrl(base, locale, baseParams));
    await openFilters(page);

    const first = page.locator(`[data-state-set="${groupA.key}"][value="${valuesA[0]}"]`);
    await first.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(({key, value}) => (
      document.activeElement?.matches(`[data-state-set="${key}"][value="${value}"]`)
      && document.activeElement.checked
    ), {key: groupA.key, value: valuesA[0]});
    check(await first.isChecked(), `${label} Space activates a Set 13 checkbox`);
    await page.locator(`[data-state-set="${groupA.key}"][value="${valuesA[1]}"]`).check();

    const expectedA = expectedUnion(expected, groupA, valuesA);
    const serializedA = [...valuesA].sort().join(',');
    await page.waitForFunction(({key, value}) => new URLSearchParams(location.search).get(key) === value, {
      key: groupA.key,
      value: serializedA,
    });
    equal(new URL(page.url()).searchParams.get(groupA.key), serializedA, `${label} sorts and serializes OR multi-select values`);
    await assertExactResults(page, expectedA, `${label} Set 13 OR multi-select`);
    const selectedUrl = page.url();

    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('pmResults')?.getAttribute('aria-busy') === 'false');
    sameValues(
      await page.locator(`[data-state-set="${groupA.key}"]:checked`).evaluateAll(inputs => inputs.map(input => input.value)),
      valuesA,
      `${label} reload restores every selected Set 13 value`,
    );
    await assertExactResults(page, expectedA, `${label} reloaded OR multi-select`);

    const stateBParams = new URLSearchParams({time: 'all', sort: 'title'});
    stateBParams.set(groupB.key, valueB);
    const stateBRelative = `${locale.route}?${stateBParams.toString()}`;
    await page.evaluate(relative => {
      history.pushState({setsBrowserGate: true}, '', relative);
      dispatchEvent(new PopStateEvent('popstate'));
    }, stateBRelative);
    await page.waitForFunction(({key, value}) => (
      new URLSearchParams(location.search).get(key) === value
      && document.querySelector(`[data-state-set="${key}"][value="${value}"]`)?.checked
    ), {key: groupB.key, value: valueB});
    await assertExactResults(page, expected.get(`${groupB.key}:${valueB}`) || [], `${label} pushed Set 14 state`);

    await page.goBack();
    await page.waitForFunction(({key, value}) => new URLSearchParams(location.search).get(key) === value, {
      key: groupA.key,
      value: serializedA,
    });
    equal(page.url(), selectedUrl, `${label} Back restores the prior shareable URL`);
    await assertExactResults(page, expectedA, `${label} Back-restored Set 13 state`);

    await page.goForward();
    await page.waitForFunction(({key, value}) => new URLSearchParams(location.search).get(key) === value, {
      key: groupB.key,
      value: valueB,
    });
    await assertExactResults(page, expected.get(`${groupB.key}:${valueB}`) || [], `${label} Forward-restored Set 14 state`);
    await assertRuntimeErrors(errors, label);
  } finally {
    await context.close();
  }
}

async function runResetLocale(browser, base, locale, groups) {
  const runtime = await newRuntime(browser, base, {locale: locale.code, width: 1100, height: 900});
  const {context, page, errors} = runtime;
  const label = `${locale.code.toUpperCase()} reset-all`;
  try {
    await ready(page, `${base}${locale.route}`);
    const stateSets = await page.locator('[data-state-set]').evaluateAll(inputs => {
      const byKey = {};
      for (const input of inputs) {
        if (!byKey[input.dataset.stateSet]) byKey[input.dataset.stateSet] = [];
        byKey[input.dataset.stateSet].push(input.value);
      }
      return byKey;
    });
    const near = await page.locator('#pmNear option').evaluateAll(options => options.map(option => option.value).find(Boolean) || '');
    const params = new URLSearchParams({
      q: 'reset-contract-sentinel',
      time: 'all',
      sort: near ? 'nearest' : 'latest',
    });
    if (near) params.set('near', near);
    const chosen = {};
    for (const [key, values] of Object.entries(stateSets)) {
      chosen[key] = values[0];
      params.set(key, values[0]);
    }
    await ready(page, queryUrl(base, locale, params));
    await openFilters(page);
    for (const [key, value] of Object.entries(chosen)) {
      check(
        await page.locator(`[data-state-set="${key}"][value="${value}"]`).isChecked(),
        `${label} precondition selects old/new ${key}`,
      );
    }
    for (const group of groups) {
      check(
        await page.locator(`[data-state-set="${group.key}"]:checked`).count() === 1,
        `${label} precondition selects Set ${group.set}`,
      );
    }

    await page.locator('#pmResetFilters').click();
    await page.waitForFunction(() => location.search === '');
    equal(await page.locator('#pmSearch').inputValue(), '', `${label} clears search`);
    equal(await page.locator('input[name="pm-time"]:checked').getAttribute('value'), 'upcoming', `${label} restores upcoming time`);
    equal(await page.locator('#pmSort').inputValue(), 'soonest', `${label} restores soonest sorting`);
    equal(await page.locator('#pmNear').inputValue(), '', `${label} clears the nearby origin`);
    equal(await page.locator('#pmActiveList').locator(':scope > *').count(), 0, `${label} removes every active-filter chip`);
    check(await page.locator('#pmResetFilters').isDisabled(), `${label} disables reset after returning to defaults`);
    equal(await page.locator('[data-state-set="content"]:checked').count(), stateSets.content.length, `${label} restores both default listing types`);
    for (const [key] of Object.entries(stateSets)) {
      if (key === 'content') continue;
      equal(await page.locator(`[data-state-set="${key}"]:checked`).count(), 0, `${label} clears ${key}`);
    }
    for (const group of groups) {
      equal(await page.locator(`[data-state-set="${group.key}"]:checked`).count(), 0, `${label} clears Set ${group.set}`);
    }
    equal(await page.evaluate(() => document.activeElement?.id), 'pmSearch', `${label} returns keyboard focus to search`);
    await assertRuntimeErrors(errors, label);
  } finally {
    await context.close();
  }
}

async function runTouchLocale(browser, base, locale, groups, expected) {
  const runtime = await newRuntime(browser, base, {locale: locale.code, width: 375, height: 812, touch: true});
  const {context, page, errors} = runtime;
  const label = `${locale.code.toUpperCase()} touch`;
  try {
    const params = new URLSearchParams({time: 'all', sort: 'title'});
    await ready(page, queryUrl(base, locale, params));
    const summary = page.locator('#pmFilterDrawer > summary');
    await summary.tap();
    check(await page.locator('#pmFilterDrawer').evaluate(drawer => drawer.open), `${label} opens the filter drawer by touch`);
    const group = groups[2];
    const value = firstCoveredValues(group, expected, 1)[0];
    check(Boolean(value), `${label} finds a covered Set 15 control`);
    if (!value) return;
    const contractId = `${group.key}:${value}`;
    const input = page.locator(`[data-state-set="${group.key}"][value="${value}"]`);
    const labelControl = page.locator(`[data-label-key="${contractId}"]`);
    const box = await labelControl.boundingBox();
    check(Boolean(box && box.height >= 43 && box.width >= 43), `${label} ${contractId} exposes a 44px-class touch target`, box ? `${box.width}×${box.height}` : 'no box');
    await labelControl.tap();
    await page.waitForFunction(({key, value}) => (
      document.querySelector(`[data-state-set="${key}"][value="${value}"]`)?.checked
      && new URLSearchParams(location.search).get(key) === value
    ), {key: group.key, value});
    check(await input.isChecked(), `${label} tap selects ${contractId}`);
    await assertExactResults(page, expected.get(contractId) || [], `${label} ${contractId}`);
    await labelControl.tap();
    await page.waitForFunction(({key, value}) => (
      !document.querySelector(`[data-state-set="${key}"][value="${value}"]`)?.checked
      && !new URLSearchParams(location.search).has(key)
    ), {key: group.key, value});
    check(!(await input.isChecked()), `${label} second tap clears ${contractId}`);
    await assertRuntimeErrors(errors, label);
  } finally {
    await context.close();
  }
}

async function runLayoutCase(browser, base, locale, groups, testCase) {
  const runtime = await newRuntime(browser, base, {
    locale: locale.code,
    width: testCase.width,
    height: testCase.height,
    touch: testCase.touch,
    deviceScaleFactor: testCase.deviceScaleFactor,
  });
  const {context, page, errors} = runtime;
  const label = `${locale.code.toUpperCase()} ${testCase.label} layout`;
  try {
    const params = new URLSearchParams({time: 'all'});
    await ready(page, queryUrl(base, locale, params));
    await openFilters(page);
    const measurements = await page.evaluate(keys => {
      const scrolling = document.scrollingElement;
      const viewportWidth = document.documentElement.clientWidth;
      const selector = [
        '.pm-shell',
        '#pmFilterDrawer',
        '.pm-filter-layout',
        ...keys.map(key => `[data-clear-section="${key}"]`),
      ].filter(Boolean).join(',');
      const sections = keys.map(key => document.querySelector(`[data-state-set="${key}"]`)?.closest('.pm-filter-section')).filter(Boolean);
      const chips = keys.flatMap(key => [...document.querySelectorAll(`[data-state-set="${key}"]`)].map(input => input.closest('.pm-chip'))).filter(Boolean);
      const nodes = [...new Set([...document.querySelectorAll(selector), ...sections, ...chips])];
      const outside = nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return {
          node: node.matches('.pm-chip') ? node.dataset.labelKey : node.id || node.className,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      }).filter(rect => rect.left < -2 || rect.right > viewportWidth + 2 || rect.width > viewportWidth + 2);
      const undersized = chips.map(node => {
        const rect = node.getBoundingClientRect();
        return {id: node.dataset.labelKey, width: rect.width, height: rect.height};
      }).filter(rect => rect.width < 43 || rect.height < 43);
      return {
        viewportWidth,
        scrollWidth: scrolling.scrollWidth,
        overflow: scrolling.scrollWidth - scrolling.clientWidth,
        outside,
        undersized,
        controls: chips.length,
      };
    }, groups.map(group => group.key));
    equal(measurements.controls, 55, `${label} measures all 55 visible new controls`);
    check(measurements.overflow <= 2, `${label} has no horizontal document overflow`, `${measurements.overflow}px at ${measurements.viewportWidth}px`);
    check(measurements.outside.length === 0, `${label} keeps every new facet surface inside the viewport`, JSON.stringify(measurements.outside.slice(0, 10)));
    check(measurements.undersized.length === 0, `${label} keeps all new controls at least 44px-class`, JSON.stringify(measurements.undersized.slice(0, 10)));
    await assertRuntimeErrors(errors, label);
  } finally {
    await context.close();
  }
}

async function guarded(label, callback) {
  try {
    await callback();
  } catch (error) {
    failures.push(`${label} threw — ${error.stack || error}`);
  }
}

function reportAndExit(mode) {
  if (failures.length) {
    console.error(`POLYMYTHCAL SETS 13-15 ${mode} CHECK FAILED`);
    for (const failure of failures.slice(0, 400)) console.error(` - ${failure}`);
    if (failures.length > 400) console.error(` - … ${failures.length - 400} additional failures`);
    process.exitCode = 1;
    return;
  }
  console.log(`POLYMYTHCAL SETS 13-15 ${mode} CHECK PASSED — ${assertions} assertions; locked 22/14/19 facets; EN/FR${DOM_ONLY ? ' DOM/controller/payload wiring only' : ' exact data, URL/history/reset, keyboard/touch, and responsive/200% layout'}.`);
}

(async () => {
  const groups = schemaGroups();
  sourceContract(groups);
  localizedDomContract(groups);
  const browse = browseContract(groups, !DOM_ONLY);
  if (DOM_ONLY) {
    reportAndExit('DOM-ONLY');
    return;
  }
  if (failures.length) {
    reportAndExit('BROWSER');
    return;
  }

  const {chromium} = require('playwright');
  const server = await startServer();
  let browser;
  try {
    const launchOptions = {headless: true};
    const executablePath = chromiumExecutable(chromium);
    if (executablePath) launchOptions.executablePath = executablePath;
    browser = await chromium.launch(launchOptions);
    for (const locale of LOCALES) {
      await guarded(`${locale.code} exact facets`, () => runExactFacetLocale(browser, server.base, locale, groups, browse.expected));
      await guarded(`${locale.code} state/history/keyboard`, () => runStateHistoryKeyboardLocale(browser, server.base, locale, groups, browse.expected));
      await guarded(`${locale.code} reset`, () => runResetLocale(browser, server.base, locale, groups));
      await guarded(`${locale.code} touch`, () => runTouchLocale(browser, server.base, locale, groups, browse.expected));
      for (const testCase of LAYOUT_CASES) {
        await guarded(`${locale.code} ${testCase.label}`, () => runLayoutCase(browser, server.base, locale, groups, testCase));
      }
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  reportAndExit('BROWSER');
})().catch(error => {
  console.error(`POLYMYTHCAL SETS 13-15 CHECK FAILED — ${error.stack || error}`);
  process.exit(1);
});
