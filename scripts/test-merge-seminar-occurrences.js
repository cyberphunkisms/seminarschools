#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MERGER = path.join(ROOT, 'scripts', 'merge-seminar-harvest-into-calendar.js');

function runCase(harvested, existing) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'polymythcal-merge-'));
  const seminars = path.join(folder, 'seminars.json');
  const publicPath = path.join(folder, 'public.json');
  const master = path.join(folder, 'master.json');
  fs.writeFileSync(seminars, JSON.stringify({ events: harvested }));
  fs.writeFileSync(publicPath, JSON.stringify({ events: existing, count: existing.length, _total_events: existing.length }));
  const result = spawnSync(process.execPath, [MERGER], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      POLYMYTHCAL_SEMINARS_PATH: seminars,
      POLYMYTHCAL_PUBLIC_PATH: publicPath,
      POLYMYTHCAL_MASTER_PATH: master,
    },
  });
  try {
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(fs.readFileSync(publicPath, 'utf8'));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

const common = {
  source_id: 'official-organizer',
  type: 'workshop',
  review_status: 'auto-published',
};
const distinct = runCase([
  {
    ...common,
    id: 'clinic-morning',
    title: 'Public Clinic',
    date: '2026-10-20T10:00:00-04:00',
    venue: 'Room A',
    source_url: 'https://example.org/events/clinic-morning',
  },
  {
    ...common,
    id: 'clinic-afternoon',
    title: 'Public Clinic',
    date: '2026-10-20T14:00:00-04:00',
    venue: 'Room B',
    source_url: 'https://example.org/events/clinic-afternoon',
  },
  ...['01', '08'].map(day => ({
    ...common,
    id: `weekly-${day}`,
    title: 'Weekly Public Rally',
    date: `2026-09-${day}T12:00:00-04:00`,
    venue: 'City Hall',
    source_url: 'https://example.org/events/weekly-rally',
    external_uid: 'weekly-rally@example.org',
    type: 'protest',
  })),
], []);
assert.strictEqual(distinct.events.length, 4);
assert.strictEqual(new Set(distinct.events.map(event => event.identity_key)).size, 4);

const existing = {
  ...common,
  id: 'canonical-rally',
  identity_key: 'canonical-rally-identity',
  title: 'Public Rally',
  date: '2026-09-01T12:00:00-04:00',
  venue: 'City Hall',
  source_url: 'https://example.org/events/rally-old',
  external_uid: 'rally@example.org',
  type: 'protest',
};
const rescheduled = runCase([
  {
    ...existing,
    id: 'generated-rally',
    identity_key: '',
    date: '2026-09-08T12:00:00-04:00',
    source_url: 'https://example.org/events/rally-new',
  },
], [existing]);
assert.strictEqual(rescheduled.events.length, 1);
assert.strictEqual(rescheduled.events[0].id, 'canonical-rally');
assert.strictEqual(rescheduled.events[0].identity_key, 'canonical-rally-identity');
assert.strictEqual(rescheduled.events[0].date.slice(0, 10), '2026-09-08');
assert.ok(rescheduled.events[0].previous_dates.includes('2026-09-01T12:00:00-04:00'));

console.log('SEMINAR OCCURRENCE MERGE TEST PASSED — distinct sessions and recurring UIDs remain separate; unique reschedules refresh in place.');

const independentOrganizers = runCase([
 { ...common, id:'new-source', external_uid:'1', source_id:'organizer-b', title:'Other event', date:'2026-10-21', venue:'Other room', source_url:'https://b.example/event/1' }
], [
 { ...common, id:'prior-source', external_uid:'1', source_id:'organizer-a', title:'Original event', date:'2026-10-20', venue:'First room', source_url:'https://a.example/event/1' }
]);
assert.strictEqual(independentOrganizers.events.length, 2, 'different organizers may reuse the same feed UID');
const manualBase = {...common, id:'curated', review_status:'manual', title:'Curated talk', date:'2026-10-20', venue:'Room A', source_url:'https://example.org/curated'};
const observation = {...manualBase, review_status:'auto-published', date:'2026-10-21', scraped_at:'2026-10-01T12:00:00Z', raw_excerpt:'Moved to October 21'};
const manualResult = runCase([observation], [manualBase]).events[0];
assert.strictEqual(manualResult.date, manualBase.date, 'curated date awaits review');
assert.strictEqual(manualResult.source_observations[0].changes.date.observed, observation.date);
assert.strictEqual(manualResult.source_observations[0].status, 'pending-source-review');
const replay = runCase([observation], [manualResult]).events[0];
assert.strictEqual(replay.source_observations.length, 1, 'repeated evidence is idempotent');
console.log('PASS source-scoped UIDs and retained manual-source conflicts');
