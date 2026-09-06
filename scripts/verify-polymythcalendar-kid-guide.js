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

function runtimeFor(lang = 'en-CA') {
  const marker = '\n  bindEvents();';
  const markerIndex = app.lastIndexOf(marker);
  if (markerIndex < 0) {
    failures.push('Discovery controller lacks its runtime verification seam');
    return null;
  }
  const source = `${app.slice(0, markerIndex)}
  globalThis.__pmdGuideTest = Object.freeze({
    terms(query) { return queryTerms(query); },
    match(event, query) { return searchMatch(event, queryTerms(query)); },
    invalid(query) { return queryIsInvalid(query); },
    guidance(query) { return { search: TEXT.searchStatus(query), suggestions: TEXT.suggestionHelp }; },
    actions(event) { return eventActions(event); },
    detail(id) { return detailHref({ id }); },
    researchUrl() { return targetUrl('research'); },
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
    body: { dataset: {} },
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
    vm.runInNewContext(source, context, { filename: 'polymythcal-guidance.runtime-test.js', timeout: 2000 });
    return context.__pmdGuideTest;
  } catch (error) {
    failures.push(`Discovery guidance runtime could not be exercised: ${error.message}`);
    return null;
  }
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

const searchable = {
  id: 'astronomy-night',
  title: 'Astronomy Night',
  search: {
    title: ['astronomy night'],
    description: ['an evening beneath the stars'],
    people: ['alice chen'],
    organizer: ['science centre'],
    place: ['toronto'],
    topics: ['astronomy'],
    format: ['in person'],
  },
  _searchDisplay: {
    title: ['Astronomy Night'],
    description: ['An evening beneath the stars'],
    people: ['Alice Chen'],
    organizer: ['Science Centre'],
    place: ['Toronto'],
    topics: ['Astronomy'],
    format: ['In person'],
  },
};
const englishRuntime = runtimeFor();
const frenchRuntime = runtimeFor('fr-CA');
if (englishRuntime && frenchRuntime) {
  check(englishRuntime.match(searchable, 'astronomy').matched, 'Exact-word search guidance does not match the exact word');
  check(englishRuntime.match(searchable, '"astronomy night"').matched, 'Quoted-phrase search guidance does not match the phrase');
  check(englishRuntime.match(searchable, 'astro').matched, 'Forward-prefix search guidance does not match a long-enough prefix');
  check(!englishRuntime.match(searchable, 'as').matched, 'Two-character text silently acts as a prefix');
  check(englishRuntime.match(searchable, 'as').matched === false && englishRuntime.match(searchable, 'astronimy').matched === false, 'Suggestions silently add non-matching results');
  check(englishRuntime.invalid('!!!'), 'Punctuation-only input is not rejected as an invalid query');
  check(englishRuntime.match(searchable, 'title:astronomy person:alice').matched, 'English fielded search is not applied with AND semantics');
  check(!englishRuntime.match(searchable, 'title:astronomy person:bob').matched, 'A missing fielded term does not exclude the listing');
  check(
    JSON.stringify([...frenchRuntime.terms('titre:astronomie personne:alice organisme:science lieu:toronto sujet:astronomie forme:personne').map(term => term.field)])
      === JSON.stringify(['title', 'people', 'organizer', 'place', 'topics', 'format']),
    'French field aliases do not map to all public search fields',
  );
  const englishGuidance = englishRuntime.guidance('astro');
  const frenchGuidance = frenchRuntime.guidance('astro');
  check(/exact words/i.test(englishGuidance.search) && /phrases/i.test(englishGuidance.search) && /at least five characters/i.test(englishGuidance.search), 'English live search status does not explain the actual matching rules');
  check(/never change or add results/i.test(englishGuidance.suggestions) && /choose/i.test(englishGuidance.suggestions), 'English suggestion guidance does not disclose click-to-apply behavior');
  check(/mots exacts/i.test(frenchGuidance.search) && /expressions/i.test(frenchGuidance.search) && /au moins cinq caractères/i.test(frenchGuidance.search), 'French live search status does not explain the actual matching rules');
  check(/ne changent ni n’ajoutent de résultats/i.test(frenchGuidance.suggestions), 'French suggestion guidance does not disclose click-to-apply behavior');
  check(englishRuntime.detail('a/b') === '/polymythseminars/events/a%2Fb/', 'English detail links do not safely encode listing IDs');
  check(frenchRuntime.detail('a/b') === '/polymythseminars/fr/events/a%2Fb/', 'French detail links do not use the localized route');
  const safeActions = englishRuntime.actions({ id: 'astronomy-night', title: 'Astronomy Night', actions: [
    { kind: 'details', url: '/polymythseminars/events/astronomy-night/', scope: 'listing' },
    { kind: 'detail', url: 'https://example.test/official', scope: 'event' },
  ] });
  check(safeActions.includes('https://example.test/official') && safeActions.includes('/polymythseminars/events/astronomy-night/'), 'Result actions do not expose verified and local detail paths');
  const unsafeActions = runtimeFor('en-CA')?.actions({ id: 'unsafe', title: 'Unsafe', actions: [
    { kind: 'detail', url: 'javascript:alert(1)', scope: 'event' },
    { kind: 'source', url: 'data:text/plain,test', scope: 'event' },
  ] }) || '';
  check(!unsafeActions.includes('javascript:') && !unsafeActions.includes('data:text'), 'Unsafe result-action URL schemes are not suppressed');
  check(new URL(englishRuntime.researchUrl(), 'https://example.test').pathname === '/polymythseminars/research/', 'Research handoff does not target the connected specialist view');
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
  for (const needle of [
    'class="pmd-search-panel" aria-labelledby="pmdSearchLabel"',
    'for="pmdSearch"',
    'aria-describedby="pmdSearchHelp pmdSearchStatus"',
    'id="pmdSearchHelp"',
    'id="pmdSearchStatus" class="pmd-status" role="status" aria-live="polite"',
    'id="pmdFilterDrawer"',
    'id="pmdCommonFilters"',
    'id="pmdResults"',
    'id="pmdResultsTitle" tabindex="-1"',
    'id="pmdSelected"',
    'id="pmdPagination"',
    'for="pmdSort"',
    'data-state-link="research"',
  ]) {
    if (!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  }
  const searchLabel = locale === 'fr' ? 'Rechercher dans le calendrier' : 'Search the calendar';
  if (!html.includes(searchLabel)) failures.push(`${rel}: missing localized search label`);
  if (slug) {
    const mode = ROUTES[slug].defaultContent;
    if (!html.includes(`data-pm-route="${slug}"`) || !html.includes(`data-pm-default-content="${mode}"`)) {
      failures.push(`${rel}: focused route scope/default kind is missing`);
    }
    if (!html.includes('class="pmd-route-context"')) failures.push(`${rel}: missing focused-route context`);
    if (!html.includes('class="pmd-focused"')) failures.push(`${rel}: missing focused-calendar navigation`);
    if (locale === 'en') {
      if (!html.includes('Browse all Polymythcal listings')) failures.push(`${rel}: missing plain-language escape path`);
      if (!html.includes(`/polymythseminars/research/?route=${slug}`)) failures.push(`${rel}: Research handoff drops route scope`);
      if (!new RegExp(`<a href="/${slug}/" aria-current="page">`).test(html)) failures.push(`${rel}: active focused calendar is not identified`);
    }
  }
  if (/id="quickGuideCopy"|Saved items stay on this device|polymythcal-revamp\.js/.test(html)) {
    failures.push(`${rel}: legacy guide or controller bloat remains`);
  }
}

if (failures.length) {
  console.error('POLYMYTHCALENDAR DISCOVERY GUIDANCE CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR DISCOVERY GUIDANCE CHECK PASSED — ${pages.length} EN/FR entry routes expose one labelled search path, concise exact-match guidance, accessible status/results regions, and focused-calendar escape/Research paths.`);
