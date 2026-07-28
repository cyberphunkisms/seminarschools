#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateLiveContent } = require('./live-content-integrity');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(read(relative));
}

function requireText(relative, needles) {
  const text = read(relative);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${relative} is missing ${JSON.stringify(needle)}`);
    }
  }
  return text;
}

const discovery = requireText('scripts/polymythcal_discovery.py', [
  'EVENT_NAVIGATION_SIGNAL_RE',
  '"priority-detail"',
  'Signal-bearing links run before generic news links',
  'startdate',
  'eventdate',
  'def _ical_organizer',
  'Prefer the human-readable iCalendar CN parameter',
  'def _publication_datetime',
  '_announcement_reference',
  'document_source["_document_url"] = final_url',
]);
const adapters = requireText('scripts/polymythcal_adapters.py', [
  'MAX_HTML_EVENT_TEXT = 24000',
  'MONTH_ABBREVIATION_PERIOD_RE',
  'reference_date: datetime | None = None',
  'def _jsonld_url',
  'def _jsonld_identifier',
  'def _jsonld_lifecycle',
  'if str(source.get("default_type") or "") == "protest"',
  '[itemprop=\'streetAddress\']',
  '[itemprop=\'organizer\']',
  '".news-post-content"',
  'source.get("_document_url")',
  'bounded parsing window instead of discarding the entire article',
]);
const harvest = requireText('scripts/harvest_protests.py', [
  'duplicate occurrence identities',
  'duplicate source-health rows',
  'duplicate source ids',
  'def retain_prior_details_during_partial_crawl',
  '"observed-partial"',
  '"current_observation_missing_details"',
  '"current_observation_qualification_reasons"',
  'unresolved_recheck_hours=unresolved_recheck_hours',
  'confirmed_recheck_hours=confirmed_recheck_hours',
]);
requireText('scripts/test_polymythcal_protest_harvest.py', [
  'test_official_news_links_with_action_signals_are_discovered',
  'test_long_organizer_article_keeps_event_date_location_and_organizer',
  'test_organizer_news_container_uses_detail_page_as_announcement_url',
  'test_rss_explicit_event_fields_are_used_before_publication_date',
  'test_old_feed_post_cannot_roll_a_yearless_date_into_the_future',
  'test_wordpress_publication_year_anchors_yearless_event_date',
  'test_jsonld_object_url_address_identifier_and_status_are_preserved',
  'test_partial_detail_failure_does_not_erase_known_event_facts',
]);

if (/len\(text\)\s*>\s*2400/.test(adapters)) {
  failures.push('long organizer announcement articles are still discarded at 2,400 characters');
}
if (!/city_haystack\s*=\s*city\s+or\s+text/.test(discovery)) {
  failures.push('campaign location rows do not retain the unstructured Toronto fallback');
}
if (!/result\.status\s*==\s*"partial-failure"/.test(harvest)) {
  failures.push('partial crawls do not invoke prior-detail retention');
}

const workflow = read('.github/workflows/scrape-polymythcal-protests.yml');
if (!workflow.includes('cron: "18 */4 * * *"')) {
  failures.push('protest schedule changed from every four hours at :18');
}
for (const forbidden of ['claude', 'anthropic', 'MAX_BUDGET_USD', 'shard-index', 'matrix:']) {
  if (workflow.toLowerCase().includes(forbidden.toLowerCase())) {
    failures.push(`protest workflow gained paid-agent or sharding marker ${forbidden}`);
  }
}

const roster = json('scripts/sources.json');
const protestConfig = json('scripts/protest-sources.json');
const mergedIds = new Set(
  roster.sources
    .filter(source =>
      source.default_type === 'protest'
      && source.harvest_enabled !== false
    )
    .map(source => String(source.id)),
);
for (const source of protestConfig.sources || []) {
  if (source.harvest_enabled !== false) mergedIds.add(String(source.id));
}
const expectedIds = [
  'acorn-toronto',
  'action-network-public-organizer-links',
  'cupe-ontario',
  'environmental-defence-nojetsto',
  'findaprotest-toronto',
  'free-grassy',
  'kairos',
  'labour-council',
  'mwac',
  'ofl',
  'ontario-health-coalition',
  'opseu',
  'protest-doug-ford-campaigns',
  'spring-magazine-events',
  'toronto350',
  'yfs',
].sort();
const actualIds = [...mergedIds].sort();
const missingExpectedIds = expectedIds.filter(sourceId => !mergedIds.has(sourceId));
if (actualIds.length < expectedIds.length || missingExpectedIds.length) {
  failures.push(
    `enabled protest inventory lost required sources: ${missingExpectedIds.join(', ')}`,
  );
}
if (protestConfig.crawl_policy?.sharded !== false) {
  failures.push('protest crawl policy is no longer explicitly unsharded');
}
if (
  protestConfig.crawl_policy?.unresolved_recheck_hours !== 4
  || protestConfig.crawl_policy?.confirmed_recheck_hours !== 12
) {
  failures.push('protest 4-hour unresolved / 12-hour confirmed recheck policy changed');
}

const live = evaluateLiveContent({
  eventsDocument: json('polymythseminars/events.json'),
  browseDocument: json('polymythseminars/browse.json'),
  sourceDocument: roster,
  teacherDocument: json('teacherresources/resources-data.json'),
});
failures.push(...live.failures.map(failure => `live invariant: ${failure}`));
if (live.metrics.events < 838 || live.metrics.eventTypes < 32) {
  failures.push(
    `Audit38 event baseline collapsed: ${live.metrics.events} events / ${live.metrics.eventTypes} types`,
  );
}
if (
  live.metrics.teacherResources !== 644
  || live.metrics.teacherCollections !== 25
  || live.metrics.teacherGroups !== 7
) {
  failures.push(
    'Teacher Resources changed from the 644/25/7 Audit38 baseline',
  );
}
if (!/const PAGE_SIZE\s*=\s*24/.test(read('js/polymythcal-revamp.js'))) {
  failures.push('Polymythcal progressive pagination changed from 24 cards');
}

if (failures.length) {
  console.error('AUDIT39 PROTEST RECALL VERIFICATION FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  'AUDIT39 PROTEST RECALL VERIFICATION PASSED — organizer action links are '
  + 'prioritized inside the existing bounded crawl; long callouts, structured '
  + 'RSS fields, iCalendar organizers, JSON-LD identity/status, partial-crawl '
  + 'fact retention, and corrupt-state refusal are guarded. The calendar is '
  + `at or above Audit38's 838-event / 32-type baseline; current totals are `
  + `${live.metrics.events}/${live.metrics.eventTypes}, with `
  + `${live.metrics.teacherResources}/${live.metrics.teacherCollections}/`
  + `${live.metrics.teacherGroups} Teacher Resources and at least 16 unsharded protest sources.`,
);
