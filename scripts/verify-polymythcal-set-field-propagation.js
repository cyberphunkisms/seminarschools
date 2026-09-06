#!/usr/bin/env node
'use strict';

/** Prove researched fields survive privately while only exact facets cross the public boundary. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sourceOnly = process.argv.includes('--source-only');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const json = relative => JSON.parse(read(relative).toString('utf8'));
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const failures = [];
const fail = message => failures.push(message);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const byId = rows => new Map(rows.map(row => [String(row.id || ''), row]));

const sets = [
  {number: 12, field: 'civic_legal_labour_formats', axis: 'civicFormats', minimumTagged: 167, aliases: {'union-education': 'union-conference'}},
  {number: 13, field: 'community_heritage_formats', axis: 'communityFormats', minimumTagged: 170},
  {number: 14, field: 'live_digital_formats', axis: 'digitalFormats', minimumTagged: 1},
  {number: 15, field: 'course_program_formats', axis: 'programFormats', minimumTagged: 1},
];

const manual = json('data/manual-events.json').events || [];
const canonical = json('polymythseminars/events.json').events || [];
const browse = json('polymythseminars/browse.json');
const watchlist = json('polymythseminars/watchlist.json');
const research = json('polymythseminars/research.json');
const surfaces = json('data/polymythcal-publication-surfaces.json');
const manualById = byId(manual);
const canonicalById = byId(canonical);
const publicById = byId([...(browse.events || []), ...(watchlist.items || [])]);
const researchById = byId(research.records || []);
const chronologyIds = new Set(surfaces.chronology_ids || []);
const watchlistIds = new Set(surfaces.watchlist_ids || []);

for (const set of sets) {
  const tagged = manual.filter(event => Array.isArray(event[set.field]) && event[set.field].length);
  if (tagged.length < set.minimumTagged) fail(`Set ${set.number} has ${tagged.length} tagged manual records; expected at least ${set.minimumTagged}.`);
  const allowed = new Set(Object.keys(research.taxonomy?.axes?.[set.axis]?.values || {}));
  if (!allowed.size) fail(`Set ${set.number} Research taxonomy axis ${set.axis} is missing.`);
  for (const authored of tagged) {
    const id = String(authored.id || '');
    const output = canonicalById.get(id);
    const projected = publicById.get(id);
    const specialist = researchById.get(id);
    if (!output) { fail(`Set ${set.number} manual record ${id} is missing from canonical data.`); continue; }
    if (!projected) { fail(`Set ${set.number} canonical record ${id} is missing from both public projections.`); continue; }
    if (!equal(output[set.field], authored[set.field])) fail(`Set ${set.number} record ${id} changed ${set.field} between manual and canonical data.`);
    const expectedFacets = [...new Set((output[set.field] || []).map(value => set.aliases?.[value] || value).filter(value => allowed.has(value)))];
    if (chronologyIds.has(id)) {
      if (!specialist) fail(`Set ${set.number} chronology record ${id} is missing from the Research projection.`);
      else if (!equal(specialist.facets?.[set.axis] || [], expectedFacets)) fail(`Set ${set.number} record ${id} changed its exact ${set.axis} facets in the Research projection.`);
    } else if (watchlistIds.has(id)) {
      if (specialist) fail(`Set ${set.number} monitoring record ${id} leaked into the chronology-only Research projection.`);
    } else {
      fail(`Set ${set.number} record ${id} is missing from the chronology/watchlist publication partition.`);
    }
    for (const candidate of [projected, specialist].filter(Boolean)) for (const forbidden of [set.field, 'evidence', 'evidence_facts', 'source_control', 'qualification_reasons', 'raw_excerpt']) {
      if (Object.hasOwn(candidate, forbidden)) fail(`Set ${set.number} record ${id} exposes private field ${forbidden}.`);
    }
    if (!sourceOnly) {
      const en = `polymythseminars/events/${id}/index.html`;
      const fr = `polymythseminars/fr/events/${id}/index.html`;
      if (!exists(en) || !exists(fr)) fail(`Set ${set.number} stable EN/FR detail pair is missing for ${id}.`);
    }
  }
}

if (manualById.size !== manual.length) fail('Manual event IDs are not unique.');
if (canonicalById.size !== canonical.length) fail('Canonical event IDs are not unique.');
if (publicById.size !== canonical.length) fail('Public projections do not form a unique complete canonical partition.');
if (!sourceOnly) {
  if (exists('public/polymythseminars/events.json')) fail('Private canonical corpus leaked into public/.');
  for (const relative of ['polymythseminars/browse.json', 'polymythseminars/watchlist.json', 'polymythseminars/research.json']) {
    const publicRelative = `public/${relative}`;
    if (!exists(publicRelative)) fail(`${publicRelative} is missing.`);
    else if (!read(relative).equals(read(publicRelative))) fail(`${relative} differs from ${publicRelative}.`);
  }
}

if (failures.length) {
  console.error('POLYMYTHCAL SET FIELD PROPAGATION FAILED');
  failures.slice(0, 300).forEach(message => console.error(` - ${message}`));
  if (failures.length > 300) console.error(` - … ${failures.length - 300} additional failures`);
  process.exit(1);
}
console.log(`POLYMYTHCAL SET FIELD PROPAGATION PASSED — ${canonical.length} canonical records retain private research fields; exact Sets 12–15 facets are lazy Research overlays for ${research.records.length} chronology records while ${watchlist.items.length} monitoring records retain stable detail routes.`);
