#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const core = require('../js/polymythcal-discovery-core.js');

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
