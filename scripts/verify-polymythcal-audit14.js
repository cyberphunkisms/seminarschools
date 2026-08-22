#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {loadInventoryContract} = require('./lib/polymythcal-inventory-contract');
const {
  difference,
  expectedPolymythcalEventRoutes,
  inspectEventRouteDirectory,
} = require('./lib/source-html-inventory');

const ROOT = path.resolve(__dirname, '..');
const inventory = loadInventoryContract(ROOT);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const releaseManifest = json('RELEASE_MANIFEST.json');
const releaseTimestamp = releaseManifest.generated_at || '1970-01-01T00:00:00Z';
const SITE = 'https://seminarschools.com';
const checks = [];
const add = (name, passed, details = {}) => checks.push({name, passed: Boolean(passed), details});

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function htmlAttribute(source, element, attribute) {
  const tag = source.match(new RegExp(`<${element}\\b([^>]*)>`, 'i'));
  if (!tag) return '';
  const value = tag[1].match(new RegExp(`\\b${attribute}=["']([^"']*)["']`, 'i'));
  return value?.[1] || '';
}

function metaContent(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${escaped}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i'))?.[1] || '';
}

function canonicalHref(source) {
  return source.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']*)["'])[^>]*>/i)?.[1] || '';
}

function hasAlternate(source, language, href) {
  const escapedLanguage = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<link\\b(?=[^>]*\\brel=["']alternate["'])(?=[^>]*\\bhreflang=["']${escapedLanguage}["'])(?=[^>]*\\bhref=["']${escapedHref}["'])[^>]*>`, 'i').test(source);
}

function pythonHtmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const sourcesDoc = json('scripts/sources.json');
const sources = sourcesDoc.sources || [];
const profiles = ['municipal', 'university', 'library', 'festival', 'french-language', 'civic-action'];
const profileCounts = Object.fromEntries(profiles.map(p => [p, sources.filter(s => s.platform_adapter === p).length]));
const crawlSources = sources.filter(s => s.source_mode === 'crawl' || /^https?:\/\//.test(String(s.events_url || '')));
const nonCrawlSources = sources.filter(s => !crawlSources.includes(s));
add('Every automated source has a crawl URL and every exception is explicit', crawlSources.length > 0 && crawlSources.every(s => /^https?:\/\//.test(String(s.events_url || ''))) && nonCrawlSources.every(s => ['manual','discovery'].includes(s.source_mode) && (s.source_mode !== 'discovery' || s.harvest_enabled === false)), {sources: sources.length, crawlSources: crawlSources.length, explicitExceptions: nonCrawlSources.length});
add('All six dedicated adapter profiles are populated', profiles.every(p => profileCounts[p] > 0), profileCounts);
add('All six adapter fixtures exist', profiles.every(p => exists(`scripts/fixtures/polymythcal/${({'french-language':'french','civic-action':'civic'}[p] || p)}.html`)), {profiles});

const adapter = read('scripts/polymythcal_adapters.py');
const scraper = read('scripts/scrape_seminars.py');
add('Adapter module implements all six profiles', profiles.every(p => adapter.includes(`'${p}'`) || adapter.includes(`"${p}"`)), {profiles});
add('Scraper imports and uses adapter normalization', /polymythcal_adapters/.test(scraper) && /normalise_source_config/.test(scraper) && /parse_source_with_adapter/.test(scraper), {});
add('Adapter test suite is present', exists('scripts/test_polymythcal_adapters.py'), {});

const lifecycle = read('scripts/reconcile_polymythcal_lifecycle.py');
const lifecycleMarkers = ['rrulestr', 'previous_dates', 'missing_count', 'cancelled', 'rescheduled', 'missing-on-source'];
add('Lifecycle reconciler covers cancellation, disappearance, recurrence, and rescheduling', lifecycleMarkers.every(m => lifecycle.toLowerCase().includes(m)), {markers: lifecycleMarkers});
add('Lifecycle test suite is present', exists('scripts/test_polymythcal_lifecycle.py'), {});

const eventDoc = json('data/polymyth-seminar-events.json');
const events = eventDoc.events || [];
const CURRENT_EVENT_COUNT = events.length;
add('Canonical event inventory meets the verified floor', CURRENT_EVENT_COUNT >= inventory.minimum_canonical_events, {events: CURRENT_EVENT_COUNT, floor: inventory.minimum_canonical_events});
add('Canonical event data is internally complete', events.length === eventDoc._total_events && events.length === eventDoc.count, {events: events.length, declared: eventDoc._total_events, count: eventDoc.count});
add('Every event has stable identity and lifecycle fields', events.every(e => e.id && e.identity_key && e.lifecycle_status && Number.isInteger(e.missing_count)), {events: events.length});
add('Event IDs and identity keys are unique', new Set(events.map(e => e.id)).size === events.length && new Set(events.map(e => e.identity_key)).size === events.length, {events: events.length});

const main = read('polymythseminars/index.html');
const features = read('js/polymythcal-features.js');
const revamp = read('js/polymythcal-revamp.js');
const css = read('css/polymythcal-features.css') + read('css/polymythcal-revamp.css');
add('Bilingual typo-tolerant search is wired', (['normalizeSearchText', 'BILINGUAL_SEARCH_GROUPS', 'editDistance', 'PM_LANG', 'PM_FR'].every(m => main.includes(m))) || (['normalizeText', 'searchSynonyms', 'editDistance', 'translations', 'fr:'].every(m => revamp.includes(m))), {});
const filterParams = ['q', 'time', 'sort', 'view', 'content', 'places', 'topics', 'eventTypes', 'opportunityTypes', 'audiences', 'formats', 'statuses', 'lang'];
add('Filters are URL-backed and shareable', filterParams.every(p => revamp.includes(`'${p}'`) || revamp.includes(`\"${p}\"`)) && /URLSearchParams/.test(revamp) && /history\.(replaceState|pushState)/.test(revamp) && /navigator\.share|clipboard/.test(revamp), {parameters: filterParams});
const localKeys = ['polymythcal.savedEvents.v2', 'polymythcal.savedSearches.v2'];
add('Saved events and searches use device-local storage', localKeys.every(k => revamp.includes(k)) && /localStorage/.test(revamp), {keys: localKeys});

const submit = read('polymythseminars/submit/index.html');
const correct = read('polymythseminars/correct/index.html');
const thanks = read('polymythseminars/thanks/index.html');
for (const [label, html] of [['submission', submit], ['correction', correct]]) {
  add(`Public ${label} form is deployable and labelled`, /data-netlify=["']true["']/.test(html) && /<label\b/i.test(html) && /required/i.test(html) && /hreflang=["']fr-ca["']/i.test(html), {});
}
const thanksFr = read('polymythseminars/fr/thanks/index.html');
const thanksRoutes = [
  {
    locale: 'en-CA',
    html: thanks,
    canonical: `${SITE}/polymythseminars/thanks/`,
    heading: 'Thank you: details received',
  },
  {
    locale: 'fr-CA',
    html: thanksFr,
    canonical: `${SITE}/polymythseminars/fr/thanks/`,
    heading: 'Merci : renseignements reçus',
  },
];
const thanksFailures = [];
for (const route of thanksRoutes) {
  if (htmlAttribute(route.html, 'html', 'lang') !== route.locale) thanksFailures.push(`${route.locale}: wrong root language`);
  if (metaContent(route.html, 'robots') !== 'noindex,follow') thanksFailures.push(`${route.locale}: confirmation is indexable`);
  if (canonicalHref(route.html) !== route.canonical) thanksFailures.push(`${route.locale}: wrong canonical`);
  if (!route.html.includes(`<h1>${route.heading}</h1>`)) thanksFailures.push(`${route.locale}: localized heading missing`);
  if (!hasAlternate(route.html, 'en-CA', `${SITE}/polymythseminars/thanks/`)) thanksFailures.push(`${route.locale}: English alternate missing`);
  if (!hasAlternate(route.html, 'fr-CA', `${SITE}/polymythseminars/fr/thanks/`)) thanksFailures.push(`${route.locale}: French alternate missing`);
  if (!hasAlternate(route.html, 'x-default', `${SITE}/polymythseminars/thanks/`)) thanksFailures.push(`${route.locale}: default alternate missing`);
}
add('Dedicated English and French submission confirmations are localized, reciprocal, and noindex', thanksFailures.length === 0, {routes: thanksRoutes.length, failures: thanksFailures});

const feedManifest = json('polymythseminars/feeds/index.json');
const feeds = feedManifest.feeds || [];
const feedFilesOk = feeds.every(f => {
  const paths = [f.rss, f.ics].map(u => u.replace(/^\//, ''));
  return paths.every(exists);
});
add('Focused RSS and calendar subscriptions are complete', feeds.length === 11 && feedFilesOk && feeds.every(f => f.label_en && f.label_fr && Number.isInteger(f.count)), {feeds: feeds.length});
const subscribe = read('polymythseminars/subscribe/index.html');
const subscribeFr = read('polymythseminars/fr/subscribe/index.html');
const feedManifestSha = crypto.createHash('sha256').update(read('polymythseminars/feeds/index.json')).digest('hex');
const subscriptionFailures = [];
for (const [locale, html, canonical] of [
  ['en-CA', subscribe, `${SITE}/polymythseminars/subscribe/`],
  ['fr-CA', subscribeFr, `${SITE}/polymythseminars/fr/subscribe/`],
]) {
  if (htmlAttribute(html, 'html', 'lang') !== locale) subscriptionFailures.push(`${locale}: wrong root language`);
  if (canonicalHref(html) !== canonical) subscriptionFailures.push(`${locale}: wrong canonical`);
  if (metaContent(html, 'translation-source') !== 'polymythseminars/feeds/index.json') subscriptionFailures.push(`${locale}: wrong translation source`);
  if (metaContent(html, 'translation-source-sha256') !== feedManifestSha) subscriptionFailures.push(`${locale}: stale translation source hash`);
  if (metaContent(html, 'translation-status') !== 'complete-owned-copy') subscriptionFailures.push(`${locale}: incomplete translation status`);
  if (!hasAlternate(html, 'en-CA', `${SITE}/polymythseminars/subscribe/`)) subscriptionFailures.push(`${locale}: English alternate missing`);
  if (!hasAlternate(html, 'fr-CA', `${SITE}/polymythseminars/fr/subscribe/`)) subscriptionFailures.push(`${locale}: French alternate missing`);
  if (!hasAlternate(html, 'x-default', `${SITE}/polymythseminars/subscribe/`)) subscriptionFailures.push(`${locale}: default alternate missing`);
}
for (const feed of feeds) {
  if (!subscribe.includes(`>${feed.label_en} (${feed.count})</span>`)) subscriptionFailures.push(`${feed.id}: English label/count missing`);
  if (!subscribeFr.includes(`>${feed.label_fr} (${feed.count})</span>`)) subscriptionFailures.push(`${feed.id}: French label/count missing`);
  for (const route of [subscribe, subscribeFr]) {
    if (!route.includes(`href="${feed.rss}"`) || !route.includes(`href="${feed.ics}"`)) subscriptionFailures.push(`${feed.id}: feed links missing from one locale`);
  }
}
add('Dedicated English and French subscription indexes exactly expose the governed feed labels', subscriptionFailures.length === 0, {feeds: feeds.length, routes: 2, failures: subscriptionFailures});

// The canonical event manifest owns the alias contract. The shared contract
// mirrors the two generators exactly: English receives deterministic hashed
// aliases plus explicit legacy IDs, while French and ICS receive only the
// explicit legacy IDs declared by each canonical event.
const aliasContract = expectedPolymythcalEventRoutes(events);
const canonicalIds = aliasContract.canonicalIds;
const expectedAliases = aliasContract.englishAliases;
const explicitAliases = aliasContract.frenchAliases;
const aliasConflicts = [];
if (aliasContract.explicitLegacyEntries !== explicitAliases.size) {
  aliasConflicts.push(
    `canonical manifest declares ${aliasContract.explicitLegacyEntries} explicit legacy entries but only ${explicitAliases.size} unique route IDs`,
  );
}

function exactSetContract(actual, expected) {
  const missing = difference(expected, actual);
  const unexpected = difference(actual, expected);
  return {exact: missing.length === 0 && unexpected.length === 0, missing, unexpected};
}

const englishRoutes = inspectEventRouteDirectory(ROOT, 'polymythseminars/events');
const publicEnglishRoutes = inspectEventRouteDirectory(ROOT, 'public/polymythseminars/events');
const englishRouteSet = exactSetContract(englishRoutes.routeIds, aliasContract.englishRouteIds);
const publicEnglishRouteSet = exactSetContract(publicEnglishRoutes.routeIds, aliasContract.englishRouteIds);
const frenchRoutes = inspectEventRouteDirectory(ROOT, 'polymythseminars/fr/events');
const publicFrenchRoutes = inspectEventRouteDirectory(ROOT, 'public/polymythseminars/fr/events');
const frenchRouteSet = exactSetContract(frenchRoutes.routeIds, aliasContract.frenchRouteIds);
const publicFrenchRouteSet = exactSetContract(publicFrenchRoutes.routeIds, aliasContract.frenchRouteIds);

let canonicalPages = 0;
let aliasPages = 0;
for (const d of englishRoutes.routeIds) {
  const p = `polymythseminars/events/${d}/index.html`;
  if (!exists(p)) continue;
  const html = read(p);
  if (/noindex,follow/i.test(html) && /Event moved|Fiche déplacée/.test(html)) aliasPages += 1;
  else if (/data-route-type=["']calendar-event["']/.test(html)) canonicalPages += 1;
}
const icsFiles = fs.readdirSync(path.join(ROOT, 'polymythseminars/ics')).filter(f => f.endsWith('.ics')).sort();
const icsCount = icsFiles.length;
const expectedIcsFiles = [...canonicalIds, ...explicitAliases.keys()].map(id => `${id}.ics`).sort();
const expectedIcsIds = new Set(expectedIcsFiles.map(file => file.slice(0, -4)));
const icsIds = new Set(icsFiles.map(file => file.slice(0, -4)));
const icsSet = exactSetContract(icsIds, expectedIcsIds);
const publicIcsFiles = fs.readdirSync(path.join(ROOT, 'public/polymythseminars/ics')).filter(f => f.endsWith('.ics')).sort();
const publicIcsIds = new Set(publicIcsFiles.map(file => file.slice(0, -4)));
const publicIcsSet = exactSetContract(publicIcsIds, expectedIcsIds);
const exactIcsSet = icsSet.exact && publicIcsSet.exact;
const publicIcsMismatches = expectedIcsFiles.filter(file => {
  const source = path.join(ROOT, 'polymythseminars/ics', file);
  const published = path.join(ROOT, 'public/polymythseminars/ics', file);
  return !fs.existsSync(source) || !fs.existsSync(published)
    || !fs.readFileSync(source).equals(fs.readFileSync(published));
});
const legacyIcsMismatches = [];
for (const [alias, target] of explicitAliases) {
  const aliasFile = path.join(ROOT, 'polymythseminars', 'ics', `${alias}.ics`);
  const targetFile = path.join(ROOT, 'polymythseminars', 'ics', `${target}.ics`);
  if (!fs.existsSync(aliasFile) || !fs.existsSync(targetFile) || !fs.readFileSync(aliasFile).equals(fs.readFileSync(targetFile))) {
    legacyIcsMismatches.push(`${alias}: not byte-identical to ${target}`);
  }
}
const missingOrWrongAliases = [];
for (const [alias, target] of expectedAliases) {
  const rel = `polymythseminars/events/${alias}/index.html`;
  const publicRel = `public/${rel}`;
  if (!exists(rel)) {
    missingOrWrongAliases.push(`${alias}: missing`);
    continue;
  }
  const aliasHtml = read(rel);
  const targetPath = `/polymythseminars/events/${target}/`;
  if (metaContent(aliasHtml, 'robots') !== 'noindex,follow'
      || htmlAttribute(aliasHtml, 'body', 'data-route-type') !== 'calendar-event-alias'
      || canonicalHref(aliasHtml) !== `${SITE}${targetPath}`) {
    missingOrWrongAliases.push(`${alias}: wrong target or route contract`);
  }
  if (!exists(publicRel) || !fs.readFileSync(path.join(ROOT, rel)).equals(fs.readFileSync(path.join(ROOT, publicRel)))) missingOrWrongAliases.push(`${alias}: public mismatch`);
}
add(
  'Canonical manifest exactly owns stable English event routes, redirects, and legacy ICS aliases',
  events.length === CURRENT_EVENT_COUNT
    && canonicalPages === CURRENT_EVENT_COUNT
    && aliasPages === expectedAliases.size
    && englishRouteSet.exact
    && publicEnglishRouteSet.exact
    && englishRoutes.missingIndexIds.length === 0
    && publicEnglishRoutes.missingIndexIds.length === 0
    && icsCount === expectedIcsIds.size
    && exactIcsSet
    && publicIcsMismatches.length === 0
    && legacyIcsMismatches.length === 0
    && aliasConflicts.length === 0
    && missingOrWrongAliases.length === 0,
  {
    canonicalPages,
    aliasPages,
    expectedAliases: expectedAliases.size,
    explicitLegacyAliases: explicitAliases.size,
    icsCount,
    events: events.length,
    exactIcsSet,
    englishRouteSet,
    publicEnglishRouteSet,
    missingEnglishIndexes: englishRoutes.missingIndexIds,
    missingPublicEnglishIndexes: publicEnglishRoutes.missingIndexIds,
    icsSet,
    publicIcsSet,
    publicIcsMismatches: publicIcsMismatches.slice(0, 20),
    legacyIcsMismatches,
    aliasConflicts,
    missingOrWrongAliases: missingOrWrongAliases.slice(0, 20),
  }
);

const translation = json('data/polymythcal-translation-inventory.json');
const translationGovernance = json('data/audit45-translation-governance.json');
const eventSourceSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'polymythseminars/events.json'))).digest('hex');
const localizedRouteFailures = [];
if (!fs.readFileSync(path.join(ROOT, 'polymythseminars/events.json')).equals(fs.readFileSync(path.join(ROOT, 'data/polymyth-seminar-events.json')))) {
  localizedRouteFailures.push('canonical event data copies differ');
}
for (const event of events) {
  const eventId = String(event.id || event.identity_key);
  const encodedId = encodeURIComponent(eventId);
  const title = pythonHtmlEscape(String(event.title || 'Untitled listing').trim().replace(/\s+/g, ' '));
  const sourceLanguages = event.source_languages;
  if (!Array.isArray(sourceLanguages)) {
    localizedRouteFailures.push(`${eventId}: source_languages is not an array`);
    continue;
  }
  const sourcePartLanguage = sourceLanguages.length === 1 ? sourceLanguages[0] : 'und';
  if (event.source_language === 'und' && event.source_language_review !== 'required') {
    localizedRouteFailures.push(`${eventId}: unknown source language lost its review requirement`);
  }
  for (const route of [
    {
      relative: `polymythseminars/events/${eventId}/index.html`,
      locale: 'en-CA',
      status: 'canonical-interface-source-verbatim',
      canonical: `${SITE}/polymythseminars/events/${encodedId}/`,
    },
    {
      relative: `polymythseminars/fr/events/${eventId}/index.html`,
      locale: 'fr-CA',
      status: 'localized-interface-source-verbatim',
      canonical: `${SITE}/polymythseminars/fr/events/${encodedId}/`,
    },
  ]) {
    if (!exists(route.relative)) {
      localizedRouteFailures.push(`${route.relative}: missing`);
      continue;
    }
    const html = read(route.relative);
    const heading = html.match(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/i);
    const headingLanguage = heading?.[1].match(/\blang=["']([^"']+)["']/i)?.[1] || '';
    if (htmlAttribute(html, 'html', 'lang') !== route.locale) localizedRouteFailures.push(`${route.relative}: wrong root language`);
    if (canonicalHref(html) !== route.canonical) localizedRouteFailures.push(`${route.relative}: wrong canonical`);
    if (metaContent(html, 'translation-source') !== 'polymythseminars/events.json') localizedRouteFailures.push(`${route.relative}: wrong translation source`);
    if (metaContent(html, 'translation-source-sha256') !== eventSourceSha) localizedRouteFailures.push(`${route.relative}: stale source hash`);
    if (metaContent(html, 'translation-status') !== route.status) localizedRouteFailures.push(`${route.relative}: wrong translation status`);
    if (!heading || heading[2] !== title) localizedRouteFailures.push(`${route.relative}: organizer title was altered`);
    if (headingLanguage !== sourcePartLanguage) localizedRouteFailures.push(`${route.relative}: organizer title language boundary is wrong`);
    if (!hasAlternate(html, 'en-CA', `${SITE}/polymythseminars/events/${encodedId}/`)) localizedRouteFailures.push(`${route.relative}: English alternate missing`);
    if (!hasAlternate(html, 'fr-CA', `${SITE}/polymythseminars/fr/events/${encodedId}/`)) localizedRouteFailures.push(`${route.relative}: French alternate missing`);
    if (!hasAlternate(html, 'x-default', `${SITE}/polymythseminars/events/${encodedId}/`)) localizedRouteFailures.push(`${route.relative}: default alternate missing`);
  }
}
for (const [alias, target] of explicitAliases) {
  const relative = `polymythseminars/fr/events/${alias}/index.html`;
  const publicRelative = `public/${relative}`;
  if (!exists(relative)) {
    localizedRouteFailures.push(`${relative}: missing`);
    continue;
  }
  const html = read(relative);
  if (htmlAttribute(html, 'html', 'lang') !== 'fr-CA') localizedRouteFailures.push(`${relative}: wrong root language`);
  if (htmlAttribute(html, 'body', 'data-route-type') !== 'calendar-event-alias') localizedRouteFailures.push(`${relative}: wrong route type`);
  if (metaContent(html, 'robots') !== 'noindex,follow') localizedRouteFailures.push(`${relative}: alias is indexable`);
  if (metaContent(html, 'translation-status') !== 'legacy-alias') localizedRouteFailures.push(`${relative}: wrong translation status`);
  if (metaContent(html, 'translation-source') !== 'polymythseminars/events.json') localizedRouteFailures.push(`${relative}: wrong translation source`);
  if (metaContent(html, 'translation-source-sha256') !== eventSourceSha) localizedRouteFailures.push(`${relative}: stale source hash`);
  if (canonicalHref(html) !== `${SITE}/polymythseminars/fr/events/${encodeURIComponent(target)}/`) localizedRouteFailures.push(`${relative}: wrong canonical target`);
  if (!exists(publicRelative) || !fs.readFileSync(path.join(ROOT, relative)).equals(fs.readFileSync(path.join(ROOT, publicRelative)))) localizedRouteFailures.push(`${relative}: public mismatch`);
}
const exactFrenchRouteTree = frenchRouteSet.exact
  && publicFrenchRouteSet.exact
  && frenchRoutes.missingIndexIds.length === 0
  && publicFrenchRoutes.missingIndexIds.length === 0;
const governanceCounts = translationGovernance.counts || {};
add(
  'Audit 45 English/French event routes preserve organizer text and source-language boundaries',
  events.length === CURRENT_EVENT_COUNT
    && translationGovernance.english_source_of_truth === true
    && translationGovernance.organizer_text_policy === 'preserve verbatim; mark source language; never silently translate'
    && governanceCounts.polymythcal_interface_locales === 2
    && governanceCounts.polymythcal_event_routes_per_locale === CURRENT_EVENT_COUNT
    && governanceCounts.polymythcal_french_legacy_alias_routes === explicitAliases.size
    && exactFrenchRouteTree
    && localizedRouteFailures.length === 0,
  {
    events: events.length,
    interfaceLocales: governanceCounts.polymythcal_interface_locales,
    eventRoutesPerLocale: governanceCounts.polymythcal_event_routes_per_locale,
    frenchLegacyAliases: governanceCounts.polymythcal_french_legacy_alias_routes,
    exactFrenchRouteTree,
    frenchRouteSet,
    publicFrenchRouteSet,
    missingFrenchIndexes: frenchRoutes.missingIndexIds,
    missingPublicFrenchIndexes: publicFrenchRoutes.missingIndexIds,
    failures: localizedRouteFailures.slice(0, 20),
  }
);

const wcag = json('data/polymythcal-wcag22-browser-audit.json');
const wcagPassed = wcag.checks_passed ?? wcag.passed ?? 0;
const wcagFailed = wcag.checks_failed ?? wcag.failed ?? 0;
const wcagChecks = wcag.results ?? wcag.automated_checks ?? [];
add('Browser WCAG 2.2 AA audit passes every automated check', wcag.standard === 'WCAG 2.2 AA' && wcagFailed === 0 && wcagPassed === wcagChecks.length && wcagPassed >= 20, {passed: wcagPassed, failed: wcagFailed, browser: wcag.browser});
add('Browser audit covers keyboard, reflow, forced colours, and reduced motion', ['keyboard', 'reflow', 'forced', 'reduced'].every(term => JSON.stringify(wcag).toLowerCase().includes(term)), {});
add('Native VoiceOver and NVDA protocol is documented', exists('docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md') && /VoiceOver/.test(read('docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md')) && /NVDA/.test(read('docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md')), {});

add('Feature CSS includes touch targets, focus, forced colours, reflow, and reduced motion', /44px/.test(css) && /focus-visible/.test(css) && /forced-colors/.test(css) && /prefers-reduced-motion/.test(css) && /overflow-x:clip/.test(css), {});

const workflows = ['.github/workflows/scrape-seminars.yml', '.github/workflows/scrape-festivals.yml'];
const mergeScripts = ['scripts/merge_and_finalize.py', 'scripts/merge_festivals.py'];
const predeployWorkflow = read('.github/workflows/predeploy.yml');
const releaseRunner = read('scripts/verify-all-runner.js');
add('Scheduled harvests use fast data gates and predeploy retains full adapter, lifecycle, publication, and Audit 14 gates', workflows.every(p => {
  const w = read(p);
  return /validate-polymythcal\.py/.test(w)
    && /verify:calendar-data/.test(w)
    && /requirements-harvest\.txt/.test(w)
    && !/python3 -m unittest/.test(w)
    && !/verify:polymythcal-audit14/.test(w);
}) && /test:polymythcal-adapters/.test(predeployWorkflow)
  && /test:polymythcal-lifecycle/.test(predeployWorkflow)
  && /npm run verify:repository:built/.test(predeployWorkflow)
  && /verify-polymythcal-audit14\.js/.test(releaseRunner)
  && mergeScripts.every(p => /finalize-polymythcal-publication/.test(read(p))), {
    workflows,
    predeploy: '.github/workflows/predeploy.yml',
    mergeScripts,
  });

const mainScript = features + revamp + main;
add('Calendar language switch covers generated and static interface text', (countOccurrences(mainScript, 'pmT(') >= 20 && /translateStaticCalendarChrome/.test(features) && /label_fr/.test(features)) || (/function translateStatic\(\)/.test(revamp) && /const translations/.test(revamp) && /staticFrench/.test(revamp) && /hreflang/.test(main)), {translationCalls: countOccurrences(mainScript, 'pmT(')});
add('Public routes expose English, French, and default alternates', ['polymythseminars/index.html', 'polymythseminars/submit/index.html', 'polymythseminars/correct/index.html', 'polymythseminars/subscribe/index.html'].every(p => {
  const h = read(p).toLowerCase();
  return h.includes('hreflang="en-ca"') && h.includes('hreflang="fr-ca"') && h.includes('hreflang="x-default"');
}), {});

const failed = checks.filter(c => !c.passed);
const output = {
  generated_at: releaseTimestamp,
  audit: 'Polymythcal Audit 14 completion verification',
  checks,
  passed: checks.length - failed.length,
  failed: failed.length,
  metrics: {
    registered_sources: sources.length,
    dedicated_adapter_sources: Object.values(profileCounts).reduce((a, b) => a + b, 0),
    adapter_profile_counts: profileCounts,
    canonical_events: events.length,
    canonical_event_pages: canonicalPages,
    legacy_redirect_aliases: aliasPages,
    event_ics_files: icsCount,
    focused_feed_pairs: feeds.length,
    browser_wcag_checks_passed: wcagPassed,
    browser_wcag_checks_failed: wcagFailed,
    translation_surfaces: translation.surfaces?.length || 0,
  },
};
const serialized = JSON.stringify(output, null, 2) + '\n';
const outputFile = path.join(ROOT, 'AUDIT14_PACKAGE_VERIFICATION_2026-07-20.json');
if (!fs.existsSync(outputFile) || fs.readFileSync(outputFile, 'utf8') !== serialized) {
  fs.writeFileSync(outputFile, serialized);
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) {
    throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  }
  fs.utimesSync(outputFile, stamp, stamp);
}
const digest = crypto.createHash('sha256').update(serialized).digest('hex');
console.log(`Polymythcal Audit 14: ${output.passed}/${checks.length} checks passed; ${failed.length} failed.`);
console.log(`Verification SHA-256: ${digest}`);
if (failed.length) {
  for (const c of failed) console.error(`FAIL: ${c.name} ${JSON.stringify(c.details)}`);
  process.exit(1);
}
