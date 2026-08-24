#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  assertDestination,
  destinationLabel,
  resolvePolymythcalDestination,
} = require('./lib/external-destination-contracts');
const { canonicalSourceUrl } = require('./apply-polymythcal-destination-specificity');

const ROOT = path.resolve(__dirname, '..');
const FIELDS = Object.freeze([
  'destination_url', 'destination_status', 'destination_scope', 'destination_kind', 'destination_evidence',
]);
const GENERIC_URLS = Object.freeze([
  'https://uwaterloo.ca/philosophy/',
  'https://journals.sagepub.com/special-issue-calls-for-papers',
  'https://okanagan.calendar.ubc.ca/academic-year-202627/september-2026',
  'https://www.canadashistory.ca/education/professional-learning',
  'https://www.torontopubliclibrary.ca/programs-and-classes/appel-salon/',
  'https://www.iwm.at/program/fellowships',
  'https://www.ias.edu/scholars/fellowships',
  'https://www.apaonline.org/page/grantsandfellowships',
  'https://aesthetics-online.org/page/grantsprizes',
  'https://www.hastac.org/opportunities',
]);
const FULL_NOON_ID = 'research-ca26383d41b1';
const FULL_NOON_URL = 'https://longgonesongs.com/full-noon-fest-26/';
const NSPA_ID = 'nspa-2027-convention';
const NSPA_URL = 'https://spring.journalismconvention.org/';
const EXPECTED_STATUS_COUNTS = Object.freeze({
  'official-event-page': 355,
  'official-series-page': 448,
  'source-event-page': 1,
  'source-series-page': 0,
  'unavailable-specific-page': 1284,
});
const EXPECTED_AVAILABLE = 804;
const EXPECTED_SHARED_SERIES = 361;
const EXPECTED_DIGEST = '2dd219f9f3525e66eb77a824ee35ccc4624f35d202fff811ccbfa22d3c090fb8';
let assertions = 0;
const failures = [];

function check(condition, message) {
  assertions += 1;
  if (!condition) failures.push(message);
}
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function htmlHref(value) { return String(value || '').replaceAll('&amp;', '&'); }
function primaryActions(html) {
  return [...html.matchAll(/<a\b(?=[^>]*\bclass=["'][^"']*\bpm-event-action\b[^"']*\bprimary\b[^"']*["'])[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({href: htmlHref(match[1]), text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().replace(/\s*↗\s*$/, '')}));
}
function expectedFields(destination) {
  return {
    destination_url: destination.href,
    destination_status: destination.status,
    destination_scope: destination.scope,
    destination_kind: destination.kind,
    destination_evidence: destination.evidence,
  };
}
function sameDestination(record, expected, context, {compact = false} = {}) {
  for (const field of FIELDS) {
    const actual = compact && field === 'destination_url' && expected[field] === '' && record[field] === undefined
      ? ''
      : record[field];
    check(actual === expected[field], `${context}: ${field} drifted`);
  }
}
function verifyDetailPage(relative, destination, lang, id) {
  const file = path.join(ROOT, relative);
  check(fs.existsSync(file), `${id}: missing ${lang} detail page`);
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  check(
    !html.includes('Open organizer website')
      && !html.includes('Voir le site de l’organisateur')
      && !html.includes("Voir le site de l'organisateur"),
    `${id}: ${lang} detail page retained a generic organizer label`,
  );
  const actions = primaryActions(html);
  if (!destination.href) {
    check(actions.length === 0, `${id}: unavailable ${lang} detail page surfaced an external action`);
  } else {
    check(actions.length === 1, `${id}: ${lang} detail page must expose exactly one external action`);
    if (actions[0]) {
      check(actions[0].href === destination.href, `${id}: ${lang} detail action is not the materialized exact URL`);
      const expectedLabel = destinationLabel(destination, lang);
      check(actions[0].text === expectedLabel, `${id}: ${lang} detail action label does not match scope/kind`);
    }
  }
  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of schemas) {
    try {
      const schema = JSON.parse(match[1]);
      if (schema && schema['@type'] === 'Event') {
        if (destination.href) {
          check(schema.sameAs === destination.href, `${id}: ${lang} Event JSON-LD sameAs drifted`);
        } else {
          check(!Object.hasOwn(schema, 'sameAs'), `${id}: ${lang} Event JSON-LD retained a generic sameAs URL`);
        }
      }
    } catch (_) { check(false, `${id}: ${lang} detail page contains invalid JSON-LD`); }
  }
}

function main() {
  const canonical = readJson('polymythseminars/events.json');
  const mirror = readJson('data/polymyth-seminar-events.json');
  const browse = readJson('polymythseminars/browse.json');
  const overrideDoc = readJson('data/polymythcal-destination-overrides.json');
  const events = canonical.events || [];
  const byId = new Map(events.map((event) => [String(event.id), event]));
  const mirrorById = new Map((mirror.events || []).map((event) => [String(event.id), event]));
  const browseById = new Map((browse.events || []).map((event) => [String(event.id), event]));
  const overrides = new Map((overrideDoc.overrides || []).map((value) => [String(value.event_id), value]));
  const groups = new Map();
  for (const event of events) {
    const key = canonicalSourceUrl(event.source_url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  check(events.length === 2088, `canonical record count changed: ${events.length}`);
  check(overrides.size === 17, `reviewed override count changed: ${overrides.size}`);
  check(mirrorById.size === events.length, 'canonical data mirror count changed');
  check(browseById.size === events.length, 'browser projection count changed');
  const counts = {};
  let available = 0;
  let sharedSeries = 0;
  for (const event of events) {
    const destination = assertDestination(resolvePolymythcalDestination(event, {
      override: overrides.get(String(event.id)),
      groupEvents: groups.get(canonicalSourceUrl(event.source_url)) || [],
    }), `Polymythcal event ${event.id}`);
    const expected = expectedFields(destination);
    sameDestination(event, expected, `${event.id} canonical`);
    const mirrorEvent = mirrorById.get(String(event.id));
    check(Boolean(mirrorEvent), `${event.id}: missing canonical data mirror record`);
    if (mirrorEvent) sameDestination(mirrorEvent, expected, `${event.id} mirror`);
    const browseEvent = browseById.get(String(event.id));
    check(Boolean(browseEvent), `${event.id}: missing browser record`);
    if (browseEvent) sameDestination(browseEvent, expected, `${event.id} browse`, {compact: true});
    counts[destination.status] = (counts[destination.status] || 0) + 1;
    if (destination.href) {
      available += 1;
      check(destination.href.startsWith('https://'), `${event.id}: external action is not HTTPS`);
      check(destination.href !== event.source_url || destination.evidence !== 'fail-closed', `${event.id}: invalid destination evidence`);
      if ((groups.get(canonicalSourceUrl(event.source_url)) || []).length > 1) {
        const declaredActions = [event.registration_url, event.application_url, event.submission_url]
          .filter(Boolean).map(canonicalSourceUrl);
        const canonicalDestination = canonicalSourceUrl(destination.href);
        const exactDistinctAction = destination.evidence === 'specific-action-url'
          && canonicalDestination !== canonicalSourceUrl(event.source_url)
          && declaredActions.includes(canonicalDestination);
        check(
          destination.scope === 'series'
            || destination.evidence === 'reviewed-override'
            || exactDistinctAction,
          `${event.id}: reused source URL surfaced as an event page without an exact distinct action`,
        );
        if (destination.scope === 'series') sharedSeries += 1;
      }
    }
    verifyDetailPage(`polymythseminars/events/${event.id}/index.html`, destination, 'en', event.id);
    verifyDetailPage(`polymythseminars/fr/events/${event.id}/index.html`, destination, 'fr', event.id);
  }
  for (const url of GENERIC_URLS) {
    const matches = events.filter((event) => event.source_url === url);
    check(matches.length > 0, `generic regression fixture has no records: ${url}`);
    for (const event of matches) check(!event.destination_url, `${event.id}: generic page surfaced as a visitor action`);
  }
  const fullNoon = byId.get(FULL_NOON_ID);
  check(Boolean(fullNoon), 'Full Noon Fest record is missing');
  if (fullNoon) {
    check(fullNoon.destination_url === FULL_NOON_URL, 'Full Noon Fest does not use its exact reviewed page');
    check(fullNoon.destination_scope === 'series', 'Full Noon Fest is not labelled as a recurring series page');
    check(overrides.has(FULL_NOON_ID), 'Full Noon Fest exact link is not protected by a reviewed override');
  }
  const nspa = byId.get(NSPA_ID);
  check(Boolean(nspa), 'NSPA/JEA Spring 2027 convention record is missing');
  if (nspa) {
    check(nspa.source_url === 'https://studentpress.org/nspa/conventions/', 'NSPA dead-source regression fixture changed');
    check(nspa.destination_url === NSPA_URL, 'NSPA Spring 2027 does not use its exact dedicated convention site');
    check(nspa.destination_scope === 'event', 'NSPA Spring 2027 exact page is not scoped to the event');
    check(overrides.has(NSPA_ID), 'NSPA Spring 2027 exact link is not protected by a reviewed override');
  }
  const acp = byId.get('acp-spring-conference-2027');
  check(Boolean(acp), 'ACP Spring 2027 regression record is missing');
  if (acp) {
    check(acp.source_url === 'https://studentpress.org/acp/conventions/', 'ACP dead-source regression fixture changed');
    check(!acp.destination_url, 'ACP Spring 2027 surfaced a dead or multi-event destination');
  }
  const exactMovedPages = [
    {
      id: 'doors-open-toronto-2026-05-24',
      source: 'https://www.toronto.ca/explore-enjoy/festivals-events/doorsopen/',
      destination: 'https://www.toronto.ca/explore-enjoy/festivals-events/doors-open-toronto/',
      scope: 'event',
    },
    {
      id: 'sshrc-storytellers-challenge-2027-watch',
      source: 'https://www.sshrc-crsh.gc.ca/society-societe/storytellers-jai_une_histoire_a_raconter/index-eng.aspx',
      destination: 'https://sshrc-crsh.canada.ca/en/research-in-action/storytellers.aspx',
      scope: 'series',
    },
    {
      id: 'nias-fellowships-projected-2027-03-15-604dca3d',
      source: 'https://nias.knaw.nl/fellowships/',
      destination: 'https://nias.knaw.nl/our-fellowships/',
      scope: 'series',
    },
    {
      id: 'folger-shakespeare-library-fellowships-projected-2027-01-15-a45831ec',
      source: 'https://www.folger.edu/research/fellowships/',
      destination: 'https://www.folger.edu/research/the-folger-institute/fellowships/',
      scope: 'series',
    },
    {
      id: 'apa-eastern-2028-submissions',
      source: 'https://www.apaonline.org/events/event_list.asp?DGPCrPg=1&DGPCrSrt=&group=110424&show=',
      destination: 'https://my.apaonline.org/events/event-description?CalendarEventKey=f2546a8a-ab55-4b84-b9d7-019a6ef43466&Home=%2Fevents%2Fcalendar',
      scope: 'event',
    },
    {
      id: 'warburg-institute-fellowships-projected-2026-11-30-af58d79d',
      source: 'https://warburg.sas.ac.uk/research/fellowships',
      destination: 'https://warburg.sas.ac.uk/research-fellowships/fellowships',
      scope: 'series',
    },
  ];
  for (const fixture of exactMovedPages) {
    const event = byId.get(fixture.id);
    check(Boolean(event), `${fixture.id}: moved-page regression record is missing`);
    if (!event) continue;
    check(event.source_url === fixture.source, `${fixture.id}: legacy-source regression fixture changed`);
    check(event.destination_url === fixture.destination, `${fixture.id}: exact replacement destination drifted`);
    check(event.destination_scope === fixture.scope, `${fixture.id}: replacement destination scope drifted`);
    check(overrides.has(fixture.id), `${fixture.id}: exact replacement is not protected by a reviewed override`);
  }
  const suppressedBroadWatches = [
    ['accute-graduate-creative-writing-2027-watch', 'https://accute.ca/category/contest/'],
    ['aia-grants-2027-watch', 'https://www.archaeological.org/programs/professionals/grants-awards/'],
    ['society-for-applied-philosophy-annual-conference-cfp-projected-2026-11-30-8c2d0535', 'https://www.appliedphil.org/conference'],
  ];
  for (const [id, source] of suppressedBroadWatches) {
    const event = byId.get(id);
    check(Boolean(event), `${id}: broad-watch regression record is missing`);
    if (!event) continue;
    check(event.source_url === source, `${id}: broad-watch source fixture changed`);
    check(!event.destination_url, `${id}: broad or unannounced watch page surfaced as a visitor action`);
  }
  for (const [status, expected] of Object.entries(EXPECTED_STATUS_COUNTS)) {
    check((counts[status] || 0) === expected, `${status} count changed: ${counts[status] || 0}/${expected}`);
  }
  check(available === EXPECTED_AVAILABLE, `exact external action count changed: ${available}/${EXPECTED_AVAILABLE}`);
  check(sharedSeries === EXPECTED_SHARED_SERIES, `shared-series record count changed: ${sharedSeries}/${EXPECTED_SHARED_SERIES}`);
  const digest = crypto.createHash('sha256').update(events.map((event) => FIELDS.map((field) => event[field] || '').join('\t')).join('\n')).digest('hex');
  check(digest === EXPECTED_DIGEST, `materialized destination digest changed: ${digest}/${EXPECTED_DIGEST}`);
  if (failures.length) {
    console.error(`POLYMYTHCAL DESTINATION SPECIFICITY FAILED — ${failures.length} of ${assertions} assertions failed.`);
    failures.slice(0, 100).forEach((failure) => console.error(` - ${failure}`));
    if (failures.length > 100) console.error(` - … ${failures.length - 100} more`);
    process.exit(1);
  }
  console.log(
    `POLYMYTHCAL DESTINATION SPECIFICITY PASSED — ${events.length} records; ${available} exact external actions; `
    + `${sharedSeries} shared-series records; ${Object.entries(counts).sort().map(([key, value]) => `${key} ${value}`).join('; ')}; digest ${digest}.`,
  );
}

if (require.main === module) main();

module.exports = {
  EXPECTED_AVAILABLE,
  EXPECTED_DIGEST,
  EXPECTED_SHARED_SERIES,
  EXPECTED_STATUS_COUNTS,
  FIELDS,
  GENERIC_URLS,
  FULL_NOON_ID,
  FULL_NOON_URL,
  NSPA_ID,
  NSPA_URL,
  primaryActions,
};
