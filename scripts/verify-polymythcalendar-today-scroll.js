#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROUTES } = require('./polymythcal-route-shell');
const discoveryCore = require('../js/polymythcal-discovery-core');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const app = fs.readFileSync(path.join(ROOT, 'js/polymythcal-discovery.js'), 'utf8');

if (/behavior\s*:\s*['"]smooth['"]|scheduleScrollToToday|eventsScroll|today-anchor/.test(app)) {
  failures.push('Discovery controller retains a legacy smooth-scroll or auto-scroll model');
}

function runtimeFor(dataset = {}, fixedNow = '') {
  const marker = '\n  bindEvents();';
  const markerIndex = app.lastIndexOf(marker);
  if (markerIndex < 0) {
    failures.push('Discovery controller lacks its runtime verification seam');
    return null;
  }
  const source = `${app.slice(0, markerIndex)}
  globalThis.__pmdTodayTest = Object.freeze({
    readUrl(search) {
      window.location.search = search;
      readStateFromUrl();
      return { date: state.date, sort: state.sort, routeScope };
    },
    matchesDate(mode, today, start, end = start) {
      state.date = mode;
      activeToday = dayValue(today);
      return eventMatchesDate({ _startDay: dayValue(start), _endDay: dayValue(end) });
    },
    routeMatchesFor(event) { return routeMatches(event); },
    target(targetSurface) { return targetUrl(targetSurface); },
    today() { return isoDay(calendarToday()); },
    observedTimeZones() { return [...globalThis.__pmdObservedTimeZones]; },
  });
})();`;
  const observedTimeZones = [];
  const RuntimeDate = class extends Date {
    constructor(...args) {
      super(...(!args.length && fixedNow ? [fixedNow] : args));
    }
    static now() { return fixedNow ? Date.parse(fixedNow) : Date.now(); }
  };
  const RuntimeDateTimeFormat = function RuntimeDateTimeFormat(locales, options = {}) {
    if (options.timeZone) observedTimeZones.push(options.timeZone);
    return new Intl.DateTimeFormat(locales, options);
  };
  RuntimeDateTimeFormat.supportedLocalesOf = Intl.DateTimeFormat.supportedLocalesOf.bind(Intl.DateTimeFormat);
  const RuntimeIntl = Object.create(Intl);
  RuntimeIntl.DateTimeFormat = RuntimeDateTimeFormat;
  const windowObject = {
    __polymythcalDiscoveryMounted: false,
    PolymythcalDiscoveryCore: discoveryCore,
    location: { origin: 'https://example.test', pathname: '/polymythseminars/', search: '', hash: '' },
    history: { pushState() {}, replaceState() {} },
  };
  const documentObject = {
    documentElement: { lang: 'en-CA' },
    body: { dataset: { ...dataset } },
    activeElement: null,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  };
  const context = {
    window: windowObject,
    document: documentObject,
    URL,
    URLSearchParams,
    Intl: RuntimeIntl,
    Date: RuntimeDate,
    console,
    HTMLElement: class HTMLElement {},
    CSS: { escape: value => String(value) },
    __pmdObservedTimeZones: observedTimeZones,
  };
  try {
    vm.runInNewContext(source, context, { filename: 'polymythcal-today.runtime-test.js', timeout: 2000 });
    return context.__pmdTodayTest;
  } catch (error) {
    failures.push(`Discovery chronology runtime could not be exercised: ${error.message}`);
    return null;
  }
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

const mainRuntime = runtimeFor();
if (mainRuntime) {
  const defaults = mainRuntime.readUrl('');
  check(defaults.date === 'upcoming', 'Main Discovery does not default to upcoming chronology');
  check(defaults.sort === 'soonest', 'Main Discovery does not default to soonest-first order');
  check(mainRuntime.readUrl('?date=today').date === 'today', 'Today URL state is not restored');
  check(mainRuntime.readUrl('?date=invalid').date === 'upcoming', 'Invalid date state does not fall back to upcoming');
  check(mainRuntime.matchesDate('upcoming', '2026-08-24', '2026-08-23', '2026-08-24'), 'An event ending today is missing from upcoming results');
  check(!mainRuntime.matchesDate('upcoming', '2026-08-24', '2026-08-22', '2026-08-23'), 'A fully past event leaks into upcoming results');
  check(mainRuntime.matchesDate('today', '2026-08-24', '2026-08-23', '2026-08-25'), 'A multi-day event spanning today is missing');
  check(/^\d{4}-\d{2}-\d{2}$/.test(mainRuntime.today()), 'Toronto calendar today does not resolve to an ISO day');
  check(mainRuntime.observedTimeZones().includes('America/Toronto'), 'Calendar today is not evaluated in the Toronto time zone');
  check(mainRuntime.readUrl('?route=writingclub').routeScope === 'writingclub', 'A valid connected-view route scope is not restored');
  check(mainRuntime.routeMatchesFor({ facets: { routes: ['writingclub'] } }), 'Focused route rejects its own projected listing');
  check(!mainRuntime.routeMatchesFor({ facets: { routes: ['lectures'] } }), 'Focused route accepts a listing from another projected route');
  check(mainRuntime.readUrl('?route=not-a-route').routeScope === '', 'Unknown connected-view route scope is not discarded');
}

const midnightBoundaryRuntime = runtimeFor({}, '2026-01-01T03:00:00Z');
if (midnightBoundaryRuntime) {
  check(midnightBoundaryRuntime.today() === '2025-12-31', 'Calendar today follows UTC instead of the Toronto day at the midnight boundary');
}

const focusedRuntime = runtimeFor({ pmRoute: 'lectures', pmDefaultContent: 'attend' });
if (focusedRuntime) {
  check(focusedRuntime.readUrl('?route=writingclub').routeScope === 'lectures', 'Focused-page route identity can be overridden by URL input');
  check(focusedRuntime.routeMatchesFor({ facets: { routes: ['lectures'] } }), 'Focused page does not retain its own route restriction');
  check(!focusedRuntime.routeMatchesFor({ facets: { routes: ['writingclub'] } }), 'Focused page leaks listings from another route');
  const researchUrl = new URL(focusedRuntime.target('research'), 'https://example.test');
  check(researchUrl.pathname === '/polymythseminars/research/' && researchUrl.searchParams.get('route') === 'lectures', 'Focused Research handoff does not retain route scope');
}

const monitoringRuntime = runtimeFor({ pmdSurface: 'monitoring' });
if (monitoringRuntime) {
  const monitoringState = monitoringRuntime.readUrl('?date=today');
  check(monitoringState.date === 'all', 'Monitoring incorrectly treats marker dates as chronology filters');
  check(monitoringState.sort === 'checked', 'Monitoring does not default to last-checked order');
}

const pages = [
  { rel: 'polymythseminars/index.html', locale: 'en', slug: '' },
  { rel: 'polymythseminars/fr/index.html', locale: 'fr', slug: '' },
];
for (const slug of Object.keys(ROUTES)) {
  pages.push({ rel: `${slug}/index.html`, locale: 'en', slug });
  pages.push({ rel: `${slug}/fr/index.html`, locale: 'fr', slug });
}

for (const { rel, locale, slug } of pages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel}: missing route`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (!new RegExp(`<html\\b[^>]*lang=["']${locale === 'fr' ? 'fr-CA' : 'en-CA'}["']`, 'i').test(html)) {
    failures.push(`${rel}: wrong document language`);
  }
  for (const needle of [
    'data-pmd-surface="main"',
    'data-pmd-source="/polymythseminars/browse.json"',
    'id="pmdSearch"',
    'id="pmdResults"',
    'id="pmdSort"',
    '<option value="soonest">',
    '/js/polymythcal-discovery.js',
  ]) {
    if (!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  }
  if (slug) {
    const mode = ROUTES[slug].defaultContent;
    if (!html.includes(`data-pm-route="${slug}"`) || !html.includes(`data-pm-default-content="${mode}"`)) {
      failures.push(`${rel}: focused route scope/default kind is missing`);
    }
  } else if (/\bdata-pm-route=/.test(html)) {
    failures.push(`${rel}: general calendar must not inherit a focused route`);
  }
  if (/id=["'](?:pmSearch|pmEventList|eventsScroll)["']|polymythcal-revamp\.js/.test(html)) {
    failures.push(`${rel}: legacy calendar shell remains`);
  }
}

if (failures.length) {
  console.error('POLYMYTHCALENDAR TODAY/UPCOMING CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR TODAY/UPCOMING CHECK PASSED — ${pages.length} EN/FR calendar routes use Toronto-aware upcoming chronology, soonest-first Discovery results, and no auto-scroll wall.`);
