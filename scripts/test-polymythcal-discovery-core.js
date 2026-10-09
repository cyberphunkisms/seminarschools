#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/polymythcal-discovery-core.js');
const model = require('./lib/polymythcal-discovery-model.js');

assert.deepEqual(model.buildFacets({}).audiences || [], [], 'unknown eligibility is not public access');
assert.deepEqual(model.buildFacets({public_access_status:'membership-or-delegate-restricted'}).audiences || [], [], 'restricted access does not enter public results');
assert.ok(model.buildFacets({public_access_status:'free-public-registration'}).audiences.includes('public'), 'explicit public registration remains discoverable');
assert.ok(!model.buildFacets({audience_scope:'public',public_access_status:'member-only'}).audiences?.includes('public'), 'restricted access overrides conflicting broad audience');
assert.ok(!model.buildFacets({public_access_status:'public-access-unconfirmed'}).audiences?.includes('public'), 'unconfirmed public access is not asserted');
const people = model.buildSearchGroups({presence_claims:[{person:'Timothy Snyder',status:'confirmed'},{person:'Unannounced Guest',status:'identity-unannounced'}]},{}).people;
assert.ok(people.includes('timothy snyder'), 'verified participant names reach the existing people index');
assert.ok(!people.includes('unannounced guest'), 'unannounced identities are not asserted');

assert.equal(core.normalizeText('Éclipse — 冬至'), 'eclipse 冬至');
assert.equal(core.queryIsInvalid('!!!'), true);
assert.equal(core.searchMatch({ title: 'Anything' }, '!!!').matched, false);
assert.equal(core.searchMatch({ title: 'Dongzhi 冬至' }, '冬至').matched, true);

const moon = { title: 'Full Moon over Toronto', description: 'Public astronomy evening' };
assert.equal(core.searchMatch(moon, 'full moon').matched, true, 'multi-token queries use AND');
assert.equal(core.searchMatch(moon, 'full missing').matched, false, 'every query term is required');
assert.equal(core.searchMatch(moon, '"full moon"').reason.kind, 'phrase');
assert.equal(core.searchMatch(moon, 'astro').matched, true, 'five-character forward prefixes work');
assert.equal(core.searchMatch(moon, 'astr').matched, false, 'short prefixes do not contaminate results');
assert.equal(core.searchMatch({ title: 'Full Moon', search: { aliases: ['pleine lune'] } }, 'pleine lune').matched, true, 'curated bilingual aliases are searchable');

const collisionFixture = { title: 'Come From Away at Marshall Hall', description: 'June venues and course listings' };
for (const query of ['comet', 'venus', 'mars', 'lune', 'bourse']) {
  assert.equal(core.searchMatch(collisionFixture, query).matched, false, `${query} must not fuzzy-collide`);
}

// Literal title and place wording must survive the same punctuation folding
// already applied to indexed text, including field-qualified queries.
for (const [title, query] of [
  ['Seniors Drop-In', 'drop-in'],
  ['Teen Ink year-round submissions', 'year-round'],
  ['À l’écoute des archives', 'l’écoute'],
  ['Director’s Panel', "director's"],
  ['Conseil de Montréal-Nord', 'Montréal-Nord'],
  ['Arts/Crafts workshop', 'arts/crafts'],
  ['Drop–in workshop', 'drop–in'],
]) {
  for (const qualified of [query, `title:${query}`, `"${query}"`]) {
    assert.equal(core.searchMatch({ title }, qualified).matched, true, qualified);
  }
}
assert.equal(core.searchMatch({ title: 'Drop', description: 'in' }, 'title:drop-in').matched, false, 'field scope covers every part of a punctuated term');
assert.equal(core.searchMatch({ title: 'Drop by and join in' }, '"drop-in"').matched, false, 'quoted compounds retain phrase adjacency');
assert.equal(core.searchMatch({ title: 'Drop by and join in' }, 'drop-in').matched, true, 'unquoted punctuation has the same AND semantics as spaces');
assert.equal(core.searchMatch({ title: 'Droplet Institute' }, 'drop-in').matched, false, 'compound splitting cannot enable short-prefix collisions');
assert.equal(core.searchMatch({ title: 'Montreal Nord' }, 'place:Montréal-Nord').matched, false, 'place scope cannot leak into title');
assert.equal(core.searchMatch({ title: 'Council', city: 'Montréal-Nord' }, 'place:montreal-nord').matched, true, 'place search folds accents and punctuation');

const chronology = JSON.parse(fs.readFileSync(path.join(__dirname, '../polymythseminars/browse.json'), 'utf8')).events;
let punctuationTitleChecks = 0;
const punctuationTitleRecords = new Set();
for (const event of chronology) {
  for (const term of event.title.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)+/gu) || []) {
    assert.equal(core.searchMatch(event, term).matched, true, `${event.id}: literal title term ${term}`);
    punctuationTitleChecks += 1;
    punctuationTitleRecords.add(event.id);
  }
}
console.log(`PUNCTUATION TITLE REGRESSIONS PASSED — ${punctuationTitleChecks} terms across ${punctuationTitleRecords.size} records`);

const facetRecords = [
  { id: 'a', facets: { kind: ['attend'], topics: ['astronomy'], places: ['online'] } },
  { id: 'b', facets: { kind: ['attend'], topics: ['astrology'], places: ['toronto-gta'] } },
  { id: 'c', facets: { kind: ['apply'], topics: ['astronomy'], places: ['toronto-gta'] } },
];
assert.equal(core.matchesFacets(facetRecords[0], { kind: new Set(['attend']), topics: new Set(['astronomy', 'astrology']) }), true);
assert.equal(core.matchesFacets(facetRecords[2], { kind: new Set(['attend']), topics: new Set(['astronomy', 'astrology']) }), false);
assert.equal(core.facetCounts(facetRecords, { kind: new Set(['attend']) }, 'topics').get('astronomy'), 1);

const discovery = {
  taxonomy: { axes: { kind: { values: {} } } },
  events: [{ id: 'a', facets: { kind: ['attend'] }, search: { topics: ['public'] } }]
};
const research = {
  taxonomy: { axes: { academicForms: { values: {} } } },
  records: [{ id: 'a', facets: { academicForms: ['public-lecture'] }, search: { format: ['public lecture'] } }]
};
const merged = core.mergeResearchProjection(discovery, research);
assert.deepEqual(merged.events[0].facets, { kind: ['attend'], academicForms: ['public-lecture'] });
assert.deepEqual(merged.events[0].search, { topics: ['public'], format: ['public lecture'] });
assert.ok(merged.taxonomy.axes.academicForms);
assert.equal(discovery.events[0].facets.academicForms, undefined, 'Research merge is non-mutating');

const grouped = core.groupSeries([
  { id: 'parent', date: '2026-09-01', relations: { series_id: 's1', role: 'parent', occurrence_count: 2 } },
  { id: 'one', date: '2026-09-02', relations: { series_id: 's1', role: 'occurrence', parent_id: 'parent', occurrence_count: 2 } },
  { id: 'two', date: '2026-09-03', relations: { series_id: 's1', role: 'occurrence', parent_id: 'parent', occurrence_count: 2 } },
  { id: 'solo', date: '2026-09-04' },
]);
assert.equal(grouped.length, 2, 'list grouping collapses a series');
assert.equal(grouped.find(group => group.type === 'series').occurrences.length, 2);
const filteredSeries = core.groupSeries([
  { id: 'one', title: 'A specific talk', date: '2026-09-02', relations: { series_id: 's1', role: 'occurrence' } }
], 'relevance', 'en-CA', [
  { id: 'parent', title: 'The actual series', relations: { series_id: 's1', role: 'parent', occurrence_count: 2 } }
]);
assert.equal(filteredSeries[0].parent.title, 'The actual series', 'filtered occurrences retain their parent identity');
assert.deepEqual(filteredSeries[0].events.map(record => record.id), ['one'], 'parent context cannot inflate matching records');
assert.equal(filteredSeries[0].occurrences.length, 1, 'nonmatching occurrences stay excluded');
assert.equal(core.paginate(Array.from({ length: 50 }), 2, 24).items.length, 24);
assert.equal(core.paginate(Array.from({ length: 50 }), 9, 24).page, 3);
assert.deepEqual(core.sortRecords([
  { id: 'old', title: 'A', checked_on: '2026-08-01' },
  { id: 'new', title: 'Z', checked_on: '2026-08-20' },
], 'checked').map(record => record.id), ['new', 'old']);

const crossingTemporal = { type: 'global-instant', timezone: 'America/Toronto' };
assert.equal(core.zonedCalendarDay('2026-09-11T03:27+00:00', crossingTemporal), '2026-09-10');
assert.match(core.temporalClock('2026-09-11T03:27+00:00', crossingTemporal, 'en-CA').text, /11:27/);
assert.equal(core.zonedCalendarDay('2026-09-11', { type: 'all-day-local-date' }), '2026-09-11');

assert.equal(core.safeHttpUrl(''), '');
assert.equal(core.safeHttpUrl('javascript:alert(1)'), '');
assert.equal(core.safeHttpUrl('/polymythseminars/'), 'https://seminarschools.com/polymythseminars/');

console.log('POLYMYTHCAL DISCOVERY CORE TESTS PASSED');
