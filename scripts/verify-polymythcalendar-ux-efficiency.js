#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const discoveryCore = require('../js/polymythcal-discovery-core');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const need = (source, token, label) => { if (!source.includes(token)) failures.push(`missing ${label}`); };
const forbid = (source, expression, label) => { if (expression.test(source)) failures.push(label); };

const app = read('js/polymythcal-discovery.js');
const css = read('css/polymythcal-discovery.css');
const browseText = read('polymythseminars/browse.json');
const watchText = read('polymythseminars/watchlist.json');
const browse = JSON.parse(browseText);
const watchlist = JSON.parse(watchText);
const surfaces = [
  ['polymythseminars/index.html', 'en-CA', 'main'],
  ['polymythseminars/fr/index.html', 'fr-CA', 'main'],
  ['polymythseminars/research/index.html', 'en-CA', 'research'],
  ['polymythseminars/fr/research/index.html', 'fr-CA', 'research'],
  ['polymythseminars/monitoring/index.html', 'en-CA', 'monitoring'],
  ['polymythseminars/fr/monitoring/index.html', 'fr-CA', 'monitoring'],
];

for (const [relative, lang, surface] of surfaces) {
  const html = read(relative);
  if (!new RegExp(`<html\\b[^>]*lang=["']${lang}["']`, 'i').test(html)) failures.push(`${relative} does not declare ${lang}`);
  for (const [token, label] of [
    [`data-pmd-surface="${surface}"`, `${surface} identity`],
    ['id="pmdSearch"', 'one primary search'],
    ['maxlength="240"', 'bounded search URL input'],
    ['class="skip-link" href="#pmdResultsTitle"', 'focusable results skip target'],
    ['id="pmdResults"', 'results region'],
    ['id="pmdPagination"', 'URL pagination'],
    ['/js/polymythcal-discovery.js', 'shared discovery app'],
    ['/css/polymythcal-discovery.css', 'shared discovery CSS'],
    ['/js/mandala.js', 'mandala geometry'],
    ['/js/indra.js', 'Indra geometry'],
    ['/css/alive.css', 'alive surface'],
    ['class="pmd-focused"', 'focused-calendar disclosure'],
    ['class="pmd-tools"', 'secondary tools disclosure'],
  ]) need(html, token, `${relative} ${label}`);
  if ((html.match(/id="pmdSearch"/g) || []).length !== 1) failures.push(`${relative} must expose exactly one search input`);
  if (Buffer.byteLength(html, 'utf8') >= 100000) failures.push(`${relative} exceeds the 100 KB shell budget`);
  forbid(html, /id="(?:pmQuickStarts|pmJumpResults|eventsContainer|events-fallback|watchlistPanel)"|data-preset=/, `${relative} restores a redundant legacy discovery layer`);
  forbid(html, /pm-lang-pending|visibility\s*:\s*hidden/, `${relative} hides content behind a language startup gate`);
  if (surface === 'research') {
    need(html, 'id="pmdFacetSearch"', `${relative} filter finder`);
    need(html, 'id="pmdResearchFilters"', `${relative} staged filter families`);
    if (!/<div id="pmdResearchFilters"[^>]*><\/div>/.test(html)) failures.push(`${relative} embeds the specialist taxonomy instead of staging it`);
    const mobileButton = html.match(/<button id="pmdMobileFilters"[^>]*>/)?.[0] || '';
    const controlledIds = (mobileButton.match(/aria-controls="([^"]+)"/)?.[1] || '').split(/\s+/);
    if (!controlledIds.includes('pmdResearchFilters')) failures.push(`${relative} Research mobile filter jump does not target the taxonomy`);
    if (mobileButton.includes('aria-expanded=')) failures.push(`${relative} Research mobile filter jump falsely exposes toggle state`);
  } else {
    need(html, 'id="pmdFilterDrawer"', `${relative} collapsed filter drawer`);
    if (/<details[^>]*id="pmdFilterDrawer"[^>]*\sopen(?:\s|=|>)/i.test(html)) failures.push(`${relative} filter drawer starts open`);
    const mobileButton = html.match(/<button id="pmdMobileFilters"[^>]*>/)?.[0] || '';
    if (!mobileButton.includes('aria-controls="pmdFilterDrawer"') || !mobileButton.includes('aria-expanded="false"')) failures.push(`${relative} mobile drawer control lacks its initial relationship/state`);
  }
  if (surface === 'monitoring') {
    need(html, 'data-pmd-source="/polymythseminars/watchlist.json"', `${relative} monitoring projection`);
    if (html.includes('id="pmdCalendar"')) failures.push(`${relative} renders monitoring markers as calendar dates`);
    need(html, '<option value="relevance">', `${relative} visible search-relevance sort`);
  } else {
    need(html, 'data-pmd-source="/polymythseminars/browse.json"', `${relative} chronology projection`);
    need(html, 'id="pmdCalendar"', `${relative} calendar view`);
  }
  if (lang === 'fr-CA') {
    for (const field of ['titre:', 'personne:', 'organisme:', 'lieu:', 'sujet:', 'forme:']) need(html, field, `${relative} French ${field} search alias help`);
    need(html, 'au moins cinq caractères', `${relative} honest prefix threshold help`);
  } else {
    need(html, 'at least five characters', `${relative} honest prefix threshold help`);
  }
}

const main = read('polymythseminars/index.html');
const mainOrder = ['id="pmdSearch"', 'class="pmd-popular"', 'id="pmdFilterDrawer"', 'id="pmdResults"'].map(token => main.indexOf(token));
if (mainOrder.some(index => index < 0) || mainOrder.some((index, position) => position > 0 && index <= mainOrder[position - 1])) {
  failures.push('main information hierarchy must be search, popular entries, collapsed filters, then results');
}
if (!/<div id="pmdCommonFilters"[^>]*><\/div>/.test(main)) failures.push('main shell embeds a filter wall instead of a data-driven common mount');
const focusedLinks = [...main.matchAll(/href="\/(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\/"/g)].map(match => match[1]);
if (new Set(focusedLinks).size !== 11) failures.push(`focused calendar inventory changed: ${new Set(focusedLinks).size}/11`);

for (const [token, label] of [
  ['const PAGE_SIZE = 24', '24-group pagination'],
  ["const COMMON_AXES = Object.freeze(['kind', 'date', 'places', 'topics', 'audiences', 'formats'])", 'six common filter families'],
  ['const RESEARCH_ORDER', 'separate specialist taxonomy registry'],
  ['function renderResearchFamilies()', 'staged specialist families'],
  ['function filterResearchFamilies()', 'filter finder'],
  ['function renderableOptions(key)', 'live Research family availability'],
  ['optionIsSelected(key, option.value) || optionCount(key, option.value) > 0', 'selected-zero escape and unselected-zero suppression'],
  ['function renderSelected()', 'visible selected-filter summary'],
  ["const visible = surface === 'main' ? items.slice(0, 3) : items", 'compact main selected-filter summary'],
  ["if (count === 0 && !checked) return ''", 'zero-option suppression with selected-zero escape'],
  ['function routeMatches(event)', 'focused-route restriction'],
  ["if (routeScope && !focusedRoute) items.push({ key: 'route'", 'visible connected-view route scope'],
  ["if (key === 'route' && !focusedRoute) routeScope = ''", 'removable connected-view route scope'],
  ['const defaultContent = document.body.dataset.pmDefaultContent', 'focused-route default kind'],
  ['state.kindExplicitAll', 'focused-route explicit all override'],
  ['routeScope', 'focused-route Research handoff'],
  ['function buildResultGroups(list)', 'series grouping'],
  ['function groupSortEvent(group', 'matching-event series sort key'],
  ['return CORE.groupSeries(list, effectiveSort(), UI_LOCALE).sort((left, right) => compareGroups(left, right))', 'group-aware result ordering'],
  ['const representative = groupSortEvent(group, effectiveSort())', 'group-aware chronology heading'],
  ["return state.q && !state.sortExplicit ? 'relevance' : state.sort", 'explicit sort authority'],
  ['function renderPagination(totalPages)', 'real URL pagination'],
  ['function updateStateLinks()', 'connected view state'],
  ['class="pmd-match-reason"', 'query match explanations'],
  ['function queryIsInvalid(query', 'punctuation-only query rejection'],
  ['event._queryMatched = match.matched', 'cached query truth for facet counts'],
  ['activeQueryMatchCount ? [] : correctionSuggestions(state.q)', 'query-only spelling suggestion authority'],
  ['function validCalendarDay(value)', 'strict shared chronology validator'],
  ['const end = addDays(today, days - 1)', 'inclusive 7/30-day boundary'],
  ["view: element.dataset.view || ''", 'view-toggle focus token'],
  ['if (!target && token.view)', 'view-toggle focus restoration'],
  ["window.addEventListener('pageshow'", 'back-forward cache recovery'],
  ['pageIsHiding = false', 'back-forward abort-lock reset'],
  ['celestialTitle:', 'celestial intent explanation'],
  ['astronomyTitle:', 'astronomy/astrology topic choice'],
  ['data-intent-values=', 'multi-value astronomy/astrology topic action'],
  ['observanceTitle:', 'separate observance choice'],
  ['matchingOccurrences:', 'filtered series occurrence truth'],
  ['const occurrenceLabel = matchingCount < declaredCount', 'filtered series occurrence label selection'],
  ['const CONFIRMATION_LABELS', 'bilingual confirmation trust labels'],
  ['const DESTINATION_LABELS', 'bilingual destination trust labels'],
  ['function eventOccursOnDay(event, day)', 'multi-day calendar coverage'],
  ['function calendarVisibleEvents()', 'calendar-visible count authority'],
  ["const targetDate = surface === 'monitoring' && targetSurface !== 'monitoring' ? 'upcoming'", 'monitoring-to-calendar date reset'],
  ['timeZone: CALENDAR_TIME_ZONE', 'fixed-zone date rendering'],
  ['date.getUTCFullYear()', 'client-zone-independent calendar arithmetic'],
  ["event.date_precision === 'month'", 'month-only precision display'],
  ["event.time_precision === 'approximate'", 'approximate time disclosure'],
  ["const summaryEvent = groupSortEvent(group", 'series date/place/trust authority'],
  ['const trust = trustLine(summaryEvent)', 'series trust disclosure'],
  ['if (loadFailed) return', 'stale-data render lock'],
  ['events = [];', 'stale-data clearing'],
]) need(app, token, label);
need(read('js/polymythcal-discovery-core.js'), '[...term.value].length >= 5', 'five-code-point prefix threshold');
forbid(app, /displayPlace\(event\)\}\$\{surface === 'monitoring'/, 'ordinary cards still duplicate their date beside the place');

for (const [pattern, label] of [
  [/\.pmd-search-panel\s*\{/, 'prominent search panel'],
  [/#pmdSearch\s*\{[^}]*min-height:\s*58px/s, 'large primary search target'],
  [/\.pmd-option\s*\{[^}]*min-height:\s*44px/s, '44px facet targets'],
  [/\.pmd-card-actions a\s*\{[^}]*min-height:\s*44px/s, '44px result actions'],
  [/@media \(max-width:\s*47\.5rem\)[\s\S]*?\.pmd-filter-grid\s*\{\s*grid-template-columns:\s*1fr;/s, 'single-column mobile filters'],
  [/@media \(max-width:\s*47\.5rem\)[\s\S]*?\.pmd-calendar-table-wrap\s*\{\s*display:\s*none;[\s\S]*?\.pmd-calendar-agenda\s*\{\s*display:\s*block;/s, 'mobile/high-zoom agenda'],
  [/@media \(forced-colors:\s*active\)/, 'forced-colours support'],
  [/@media \(prefers-reduced-motion:\s*reduce\)/, 'reduced-motion support'],
]) if (!pattern.test(css)) failures.push(`discovery CSS missing ${label}`);

const budgets = [
  ['js/polymythcal-discovery.js', Buffer.byteLength(app), 100000],
  ['css/polymythcal-discovery.css', Buffer.byteLength(css), 26000],
  ['polymythseminars/browse.json', Buffer.byteLength(browseText), 3200000],
  ['polymythseminars/watchlist.json', Buffer.byteLength(watchText), 240000],
];
for (const [relative, size, ceiling] of budgets) if (size > ceiling) failures.push(`${relative} exceeds its efficiency ceiling: ${size}/${ceiling} bytes`);
const browseGzip = zlib.gzipSync(Buffer.from(browseText), {level: 9}).length;
if (browseGzip > 350000) failures.push(`browse payload gzip exceeds 350 KB: ${browseGzip}`);
if (!Array.isArray(browse.events) || browse.events.length !== browse.count) failures.push('browse chronology count is inconsistent');
if (!Array.isArray(watchlist.items) || watchlist.items.length !== watchlist.count) failures.push('monitoring count is inconsistent');

function runtimeFor(lang = 'en-CA', dataset = {}) {
  const marker = '\n  bindEvents();';
  const markerIndex = app.lastIndexOf(marker);
  if (markerIndex < 0) {
    failures.push('discovery runtime test seam is missing');
    return null;
  }
  const source = `${app.slice(0, markerIndex)}
  globalThis.__pmdTest = Object.freeze({
    queryTerms,
    queryIsInvalid,
    termMatch: CORE.termMatch,
    searchMatch,
    validCalendarDay,
    validSort,
    effectiveSort,
    matchingOccurrences: COPY.matchingOccurrences,
    trustLine,
    setAxis(key, options) {
      axes.set(key, { key, label: key, options });
    },
    readUrl(search) {
      window.location.search = search;
      readStateFromUrl();
      return {
        routeScope,
        sort: state.sort,
        sortExplicit: state.sortExplicit,
        effectiveSort: effectiveSort(),
        kindExplicitAll: state.kindExplicitAll,
        facets: Object.fromEntries(Object.entries(state.facets).map(([key, values]) => [key, [...values]])),
      };
    },
    dateMatches(mode, today, start, end = '') {
      state.date = mode;
      activeToday = dayValue(today);
      return eventMatchesDate({ _startDay: dayValue(start), _endDay: dayValue(end || start) });
    },
    calendarRangeIncludes(start, end, day) {
      return eventOccursOnDay({ _startDay: dayValue(start), _endDay: dayValue(end || start), series: null }, dayValue(day));
    },
    dayKey(value) {
      return isoDay(dayValue(value));
    },
    displayValue(date, datePrecision = 'exact', timePrecision = 'exact', end = '') {
      const event = { date, date_precision: datePrecision, time_precision: timePrecision, _start: parseDate(date), _startDay: dayValue(date), _endDay: dayValue(end || date) };
      return { date: displayDate(event), time: displayTime(event) };
    },
    groupKey(sort, parentSpec, occurrenceSpecs) {
      const make = (spec, role) => ({ id: spec.id, title: spec.id, date: spec.date, last_checked_at: spec.checked || '', _matchScore: spec.score || 0, _start: parseDate(spec.date), _startDay: dayValue(spec.date), _endDay: dayValue(spec.date), series: { role, title: 'Series' } });
      const parent = make(parentSpec, 'parent');
      const occurrences = occurrenceSpecs.map(spec => make(spec, 'occurrence'));
      return groupSortEvent({ type: 'series', parent, occurrences, events: [parent, ...occurrences] }, sort)?.id || '';
    },
    sampleSeriesMarkup() {
      const make = (id, role, date) => ({ id, title: 'Series ' + role, description: 'Series description', facets: { kind: ['attend'] }, series: { id: 'series', role, title: 'Trusted Series', occurrence_count: 4 }, date, date_precision: 'exact', time_precision: 'approximate', _start: parseDate(date), _startDay: dayValue(date), _endDay: dayValue(date), venue: 'Civic Hall', city: 'Toronto', country: 'Canada', confirmation_status: 'confirmed', destination_status: 'official-series-page', last_checked_at: '2026-08-24T10:00:00-04:00', destination_url: 'https://example.test/series', source_url: 'https://example.test/source' });
      const parent = make('parent', 'parent', '2026-08-30T09:00:00-04:00');
      const occurrence = make('occurrence', 'occurrence', '2026-08-25T13:30:00-04:00');
      return seriesCard({ type: 'series', parent, occurrences: [occurrence], events: [parent, occurrence] });
    },
    connectedQuery(targetSurface) {
      return stateParams({}, targetSurface).toString();
    },
    calendarCount(items) {
      filteredEvents = items.map((item, index) => ({ id: String(index), series: item.parent ? { role: 'parent' } : null, _startDay: item.dated ? dayValue('2026-08-24') : null }));
      return calendarVisibleEvents().length;
    },
    queryOnlyState() {
      routeScope = '';
      state.q = 'moon';
      state.date = 'all';
      state.facets = Object.create(null);
      state.facets.topics = new Set(['history']);
      events = [{ id: 'moon', title: 'Moon', facets: { topics: ['astronomy'] }, search: { title: ['moon'] }, _searchDisplay: { title: ['Moon'] }, _start: parseDate('2026-08-24'), _startDay: dayValue('2026-08-24'), _endDay: dayValue('2026-08-24') }];
      applyFiltersAndSort();
      return { queryMatches: activeQueryMatchCount, filtered: filteredEvents.length };
    },
    celestialTopics(options) {
      axes.set('topics', { key: 'topics', label: 'Topics', options });
      return taxonomyValuesMatching('topics', /astronom|astrolog/);
    },
    researchOptions(options, eventValues, chosen = []) {
      routeScope = '';
      state.q = '';
      state.date = 'all';
      state.facets = Object.create(null);
      state.facets.topics = new Set(chosen);
      axes.set('topics', { key: 'topics', label: 'Topics', options });
      events = eventValues.map((values, index) => ({ id: String(index), facets: { topics: values }, _queryMatched: true, _startDay: dayValue('2026-08-24'), _endDay: dayValue('2026-08-24') }));
      return renderableOptions('topics').map(option => option.value);
    },
  });
})();`;
  const windowObject = {
    __polymythcalDiscoveryMounted: false,
    PolymythcalDiscoveryCore: discoveryCore,
    location: { origin: 'https://example.test', pathname: '/polymythseminars/', search: '', hash: '' },
    history: { pushState() {}, replaceState() {} },
  };
  const documentObject = {
    documentElement: { lang },
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
    Intl,
    Date,
    console,
    HTMLElement: class HTMLElement {},
    CSS: { escape: value => String(value) },
  };
  try {
    vm.runInNewContext(source, context, { filename: 'polymythcal-discovery.runtime-test.js', timeout: 2000 });
    return context.__pmdTest;
  } catch (error) {
    failures.push(`discovery runtime regression harness failed: ${error.message}`);
    return null;
  }
}

const check = (condition, label) => { if (!condition) failures.push(`runtime regression: ${label}`); };
const englishRuntime = runtimeFor();
const frenchRuntime = runtimeFor('fr-CA');
if (englishRuntime && frenchRuntime) {
  check(englishRuntime.termMatch('AI symposium', { value: 'ai', phrase: false })?.kind === 'exact wording', 'short exact token must still match');
  check(!englishRuntime.termMatch('Astronomy', { value: 'a', phrase: false }), 'one-character token must not prefix-match');
  check(!englishRuntime.termMatch('Astronomy', { value: 'as', phrase: false }), 'two-character token must not prefix-match');
  check(!englishRuntime.termMatch('冬至祭', { value: '冬至', phrase: false }), 'two-code-point token must not prefix-match');
  check(!englishRuntime.termMatch('冬至祭典', { value: '冬至祭', phrase: false }), 'three-code-point Unicode token must not prefix-match');
  check(englishRuntime.termMatch('冬至祭典会場', { value: '冬至祭典会', phrase: false })?.kind === 'word prefix', 'five-code-point Unicode prefix must match');
  check(!englishRuntime.termMatch('Astronomy', { value: 'ast', phrase: false }), 'three-character Latin token must not prefix-match');
  check(englishRuntime.termMatch('Astronomy', { value: 'astro', phrase: false })?.kind === 'word prefix', 'five-character Latin prefix must match');
  check(englishRuntime.queryIsInvalid('!!!', englishRuntime.queryTerms('!!!')), 'punctuation-only query must be invalid instead of matching everything');

  const frenchFields = frenchRuntime.queryTerms('titre:"Pleine lune" personne:Saul organisme:NASA lieu:Toronto sujet:astronomie forme:en-ligne').map(term => term.field);
  check(JSON.stringify(frenchFields) === JSON.stringify(['title', 'people', 'organizer', 'place', 'topics', 'format']), 'French field aliases must map to searchable fields');
  const searchable = {
    search: { title: ['astronomy night'], people: ['alice chen'], organizer: ['science centre'], place: ['toronto'], topics: ['astronomy'], format: ['online'] },
    _searchDisplay: { title: ['Astronomy Night'], people: ['Alice Chen'], organizer: ['Science Centre'], place: ['Toronto'], topics: ['Astronomy'], format: ['Online'] },
  };
  const exactMatch = englishRuntime.searchMatch(searchable, englishRuntime.queryTerms('title:astronomy person:alice'));
  const prefixMatch = englishRuntime.searchMatch(searchable, englishRuntime.queryTerms('title:astro'));
  check(exactMatch.matched && exactMatch.reason?.field === 'title', 'all fielded terms must match with an accurate reason');
  check(!englishRuntime.searchMatch(searchable, englishRuntime.queryTerms('title:astronomy person:bob')).matched, 'fielded terms must use AND semantics');
  check(exactMatch.score > prefixMatch.score, 'exact title matches must outrank prefixes');
  check(!englishRuntime.searchMatch(searchable, englishRuntime.queryTerms('astronimy')).matched, 'spelling suggestions must not silently add fuzzy results');

  check(englishRuntime.validCalendarDay('2026-08-24'), 'exact real calendar date must validate');
  check(englishRuntime.validCalendarDay('2026-08-24T14:30:00-04:00'), 'parseable timestamp with a real prefix day must validate');
  check(!englishRuntime.validCalendarDay('2026-08-24junk'), 'malformed date suffix must fail');
  check(!englishRuntime.validCalendarDay('2026-02-30'), 'impossible calendar day must fail');
  check(!englishRuntime.validCalendarDay('2026-08-24Tnot-a-time'), 'malformed timestamp must fail');
  check(englishRuntime.dateMatches('7d', '2026-08-24', '2026-08-30'), 'inclusive seven-day window must include day seven');
  check(!englishRuntime.dateMatches('7d', '2026-08-24', '2026-08-31'), 'inclusive seven-day window must exclude day eight');
  check(englishRuntime.dateMatches('30d', '2026-08-24', '2026-09-22'), 'inclusive thirty-day window must include day thirty');
  check(!englishRuntime.dateMatches('30d', '2026-08-24', '2026-09-23'), 'inclusive thirty-day window must exclude day thirty-one');
  check(englishRuntime.calendarRangeIncludes('2026-08-24', '2026-08-26', '2026-08-25'), 'multi-day event must appear on an intermediate calendar day');
  check(englishRuntime.dayKey('2026-08-24T23:59:00+14:00') === '2026-08-24', 'source calendar day must not shift with timestamp offset or visitor zone');
  const monthOnly = englishRuntime.displayValue('2027-09-01', 'month', 'unknown');
  check(monthOnly.date === 'September 2027', 'month precision must not invent the first day');
  check(englishRuntime.displayValue('2026-09-23T12:00:00-04:00', 'estimated', 'exact').date.startsWith('Estimated date:'), 'estimated date must disclose uncertainty');
  check(englishRuntime.displayValue('2026-09-23T12:00:00-04:00', 'exact', 'approximate').time.includes('Approx.') && englishRuntime.displayValue('2026-09-23T12:00:00-04:00', 'exact', 'approximate').time.includes('UTC−04:00'), 'approximate source time and offset must remain explicit');
  check(englishRuntime.displayValue('2026-09-23', 'date', 'all-day').time === 'All day', 'all-day precision must not appear unpublished');
  check(englishRuntime.displayValue('2026-09-23', 'date', 'not-applicable').time === 'Time not applicable', 'not-applicable time must remain explicit');

  check(englishRuntime.groupKey('soonest', { id: 'parent', date: '2026-01-01' }, [{ id: 'august', date: '2026-08-01' }, { id: 'september', date: '2026-09-01' }]) === 'august', 'series soonest key must use the earliest matching occurrence');
  check(englishRuntime.groupKey('latest', { id: 'parent', date: '2027-12-01' }, [{ id: 'august', date: '2026-08-01' }, { id: 'september', date: '2026-09-01' }]) === 'september', 'series latest key must use the latest matching occurrence');
  check(englishRuntime.groupKey('relevance', { id: 'parent', date: '2026-01-01', score: 20 }, [{ id: 'occurrence', date: '2026-08-01', score: 4 }]) === 'parent', 'series relevance key must use the strongest matching event');
  check(englishRuntime.calendarCount([{ parent: true, dated: true }, { parent: false, dated: true }, { parent: false, dated: false }]) === 1, 'calendar totals must count only visible dated non-parent records');
  const queryOnlyState = englishRuntime.queryOnlyState();
  check(queryOnlyState.queryMatches === 1 && queryOnlyState.filtered === 0, 'spelling authority must distinguish a valid query from an excluding facet');

  const celestialTopics = englishRuntime.celestialTopics([
    { value: 'astronomy', label: 'Astronomy' },
    { value: 'astrology', label: 'Astrology' },
    { value: 'science', label: 'Science' },
  ]);
  check(JSON.stringify([...celestialTopics]) === JSON.stringify(['astronomy', 'astrology']), 'celestial topic intent must apply astronomy and astrology together');
  const researchOptions = [
    { value: 'astronomy', label: 'Astronomy' },
    { value: 'astrology', label: 'Astrology' },
    { value: 'history', label: 'History' },
  ];
  check(JSON.stringify([...englishRuntime.researchOptions(researchOptions, [['astronomy']], [])]) === JSON.stringify(['astronomy']), 'unselected zero-count Research options must hide');
  check(JSON.stringify([...englishRuntime.researchOptions(researchOptions, [['astronomy']], ['history'])]) === JSON.stringify(['astronomy', 'history']), 'selected zero-count Research options must remain removable');

  check(englishRuntime.matchingOccurrences(1, 46) === '1 matching of 46 occurrences', 'English filtered series count must disclose matching and total occurrences');
  check(frenchRuntime.matchingOccurrences(1, 46) === '1 occurrence correspondante sur 46', 'French filtered series count must disclose matching and total occurrences');
  check(englishRuntime.trustLine({ confirmation_status: 'confirmed', destination_status: 'official-event-page' }) === 'Confirmed · link: official event page', 'English trust line must use public labels');
  check(frenchRuntime.trustLine({ confirmation_status: 'unconfirmed', destination_status: 'unavailable-specific-page' }) === 'Non confirmé · lien : page précise indisponible', 'French trust line must not leak English slugs');
  const seriesMarkup = englishRuntime.sampleSeriesMarkup();
  for (const [token, label] of [
    ['1 matching of 4 occurrences', 'filtered/total count'],
    ['Civic Hall · Toronto · Canada', 'place'],
    ['Approx.', 'time precision'],
    ['UTC−04:00', 'source time zone'],
    ['Confirmed · link: official series page', 'confirmation/destination trust'],
    ['Last checked', 'verification date'],
  ]) check(seriesMarkup.includes(token), `series card must expose ${label}`);

  englishRuntime.setAxis('kind', [{ value: 'attend', label: 'Attend' }, { value: 'apply', label: 'Apply' }]);
  const scopedState = englishRuntime.readUrl('?route=writingclub&sort=bogus&q=moon');
  check(scopedState.routeScope === 'writingclub', 'valid connected-view route scope must restore from URL');
  check(!scopedState.sortExplicit && scopedState.effectiveSort === 'relevance', 'invalid URL sort must not suppress automatic relevance ranking');
  check(englishRuntime.readUrl('?route=not-a-route').routeScope === '', 'unknown route scope must be discarded');

  const focusedRuntime = runtimeFor('en-CA', { pmRoute: 'writingclub', pmDefaultContent: 'apply' });
  focusedRuntime?.setAxis('kind', [{ value: 'attend', label: 'Attend' }, { value: 'apply', label: 'Apply' }]);
  const focusedState = focusedRuntime?.readUrl('?kind=bogus');
  check(focusedState?.facets.kind?.includes('apply'), 'invalid kind URL must not disable the focused-route default');
  const monitoringRuntime = runtimeFor('en-CA', { pmdSurface: 'monitoring' });
  check(monitoringRuntime?.validSort('relevance') === 'relevance', 'monitoring search relevance must be a visible valid sort');
  monitoringRuntime?.readUrl('');
  check(!new URLSearchParams(monitoringRuntime?.connectedQuery('main')).has('date'), 'Monitoring must not carry hidden date=all into Calendar');
  check(!new URLSearchParams(monitoringRuntime?.connectedQuery('research')).has('date'), 'Monitoring must not carry hidden date=all into Research');
  const monitoringSeries = monitoringRuntime?.sampleSeriesMarkup() || '';
  check(monitoringSeries.includes('Civic Hall · Toronto · Canada') && monitoringSeries.includes('Last checked'), 'Monitoring series card must expose place and recently-checked trust context');
}

const routes = {writingclub: 'apply', writingkids: 'apply', writingjuniors: 'apply', writingteens: 'apply', writinggrads: 'apply', university: 'both', philosophy: 'both', humanities: 'both', cfps: 'apply', lectures: 'attend', fellowships: 'apply'};
for (const [route, mode] of Object.entries(routes)) {
  const relative = `${route}/index.html`;
  if (!exists(relative)) { failures.push(`${relative} is missing`); continue; }
  const html = read(relative);
  for (const [token, label] of [
    [`data-pm-route="${route}"`, 'route identity'],
    [`data-pm-default-content="${mode}"`, 'route default'],
    ['Browse all Polymythcal listings', 'escape path'],
    ['id="pmdSearch"', 'shared search'],
    ['id="pmdResults"', 'shared results'],
    ['/js/polymythcal-discovery.js', 'discovery-v2 controller'],
    ['/css/polymythcal-discovery.css', 'discovery-v2 CSS'],
  ]) need(html, token, `${relative} ${label}`);
  if (Buffer.byteLength(html, 'utf8') >= 100000) failures.push(`${relative} exceeds 100 KB`);
  forbid(html, /id="(?:pmQuickStarts|pmJumpResults|eventsContainer|watchlistPanel)"|data-preset=/, `${relative} restores legacy discovery controls`);
}

const pkg = read('package.json');
need(pkg, 'verify-polymythcalendar-ux-efficiency.js', 'package verification wiring');
try { require('child_process').execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/polymythcal-discovery.js')], {stdio: 'pipe'}); }
catch (_) { failures.push('js/polymythcal-discovery.js fails node --check'); }

if (failures.length) {
  console.error('POLYMYTHCALENDAR UX/EFFICIENCY CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR UX/EFFICIENCY CHECK PASSED — six compact EN/FR discovery shells, six common facets, staged Research taxonomy, separate monitoring, 24-group pagination, 11 route-restricted entry pages, and ${browseGzip} byte gzip chronology payload.`);
