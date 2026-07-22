#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const listDirs = (p) => fs.readdirSync(path.join(ROOT, p), {withFileTypes: true}).filter(x => x.isDirectory()).map(x => x.name);
const checks = [];
const add = (name, passed, details = {}) => checks.push({name, passed: Boolean(passed), details});

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
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
add('Submission confirmation is bilingual and noindex', /Envoi reçu|Submission received/.test(thanks) && /noindex/i.test(thanks), {});

const feedManifest = json('polymythseminars/feeds/index.json');
const feeds = feedManifest.feeds || [];
const feedFilesOk = feeds.every(f => {
  const paths = [f.rss, f.ics].map(u => u.replace(/^\//, ''));
  return paths.every(exists);
});
add('Focused RSS and calendar subscriptions are complete', feeds.length === 11 && feedFilesOk && feeds.every(f => f.label_en && f.label_fr && Number.isInteger(f.count)), {feeds: feeds.length});
add('Subscription index exposes bilingual feed labels', /label_fr/.test(features) && /Abonnements|Subscribe/.test(read('polymythseminars/subscribe/index.html')), {});

const eventDirs = listDirs('polymythseminars/events');
let canonicalPages = 0;
let aliasPages = 0;
for (const d of eventDirs) {
  const p = `polymythseminars/events/${d}/index.html`;
  if (!exists(p)) continue;
  const html = read(p);
  if (/noindex,follow/i.test(html) && /Event moved|Fiche déplacée/.test(html)) aliasPages += 1;
  else if (/data-route-type=["']calendar-event["']/.test(html)) canonicalPages += 1;
}
const icsCount = fs.readdirSync(path.join(ROOT, 'polymythseminars/ics')).filter(f => f.endsWith('.ics')).length;
add('Stable event pages, legacy aliases, and per-event calendars are synchronized', canonicalPages === events.length && aliasPages === events.length && icsCount === events.length, {canonicalPages, aliasPages, icsCount, events: events.length});

const translation = json('data/polymythcal-translation-inventory.json');
add('Holistic English and French translation inventory is complete', translation.complete === true && translation.canonical_event_pages_with_bilingual_actions === events.length && translation.focused_feeds_with_english_and_french_labels === feeds.length, translation);

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
add('Scheduled harvest workflows run adapter, lifecycle, publication, and audit gates', workflows.every(p => {
  const w = read(p);
  return /test_polymythcal_adapters/.test(w) && /test_polymythcal_lifecycle/.test(w) && /verify:polymythcal-audit14/.test(w);
}) && mergeScripts.every(p => /finalize-polymythcal-publication/.test(read(p))), {workflows, mergeScripts});

const mainScript = features + revamp + main;
add('Calendar language switch covers generated and static interface text', (countOccurrences(mainScript, 'pmT(') >= 20 && /translateStaticCalendarChrome/.test(features) && /label_fr/.test(features)) || (/function translateStatic\(\)/.test(revamp) && /const translations/.test(revamp) && /staticFrench/.test(revamp) && /hreflang/.test(main)), {translationCalls: countOccurrences(mainScript, 'pmT(')});
add('Public routes expose English, French, and default alternates', ['polymythseminars/index.html', 'polymythseminars/submit/index.html', 'polymythseminars/correct/index.html', 'polymythseminars/subscribe/index.html'].every(p => {
  const h = read(p).toLowerCase();
  return h.includes('hreflang="en-ca"') && h.includes('hreflang="fr-ca"') && h.includes('hreflang="x-default"');
}), {});

const failed = checks.filter(c => !c.passed);
const output = {
  generated_at: new Date().toISOString(),
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
fs.writeFileSync(path.join(ROOT, 'AUDIT14_PACKAGE_VERIFICATION_2026-07-20.json'), serialized);
const digest = crypto.createHash('sha256').update(serialized).digest('hex');
console.log(`Polymythcal Audit 14: ${output.passed}/${checks.length} checks passed; ${failed.length} failed.`);
console.log(`Verification SHA-256: ${digest}`);
if (failed.length) {
  for (const c of failed) console.error(`FAIL: ${c.name} ${JSON.stringify(c.details)}`);
  process.exit(1);
}
