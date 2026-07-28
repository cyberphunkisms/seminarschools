#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'merge-festival-harvest-into-calendar.js');

function run(harvested, existing = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit38-festival-merge-'));
  const festivals = path.join(directory, 'festivals.json');
  const publicPath = path.join(directory, 'public.json');
  const master = path.join(directory, 'master.json');
  fs.writeFileSync(festivals, `${JSON.stringify({ events: harvested })}\n`);
  fs.writeFileSync(
    publicPath,
    `${JSON.stringify({ events: existing, count: existing.length, _total_events: existing.length })}\n`,
  );
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      POLYMYTHCAL_FESTIVALS_PATH: festivals,
      POLYMYTHCAL_PUBLIC_PATH: publicPath,
      POLYMYTHCAL_MASTER_PATH: master,
    },
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(fs.readFileSync(publicPath, 'utf8')).events;
}

const base = {
  title: 'Shared Festival Session',
  venue: 'Harbour Hall',
  source_url: 'https://festival.example/program/shared-session',
  source_id: 'festival-example',
  type: 'festival',
  time_precision: 'exact',
  review_status: 'harvested',
};

const sessions = run([
  { ...base, id: 'morning', date: '2026-09-10T10:00:00-04:00' },
  { ...base, id: 'afternoon', date: '2026-09-10T14:00:00-04:00' },
]);
assert.strictEqual(sessions.length, 2, 'same-title same-day sessions must remain distinct');
assert.deepStrictEqual(new Set(sessions.map(event => event.id)), new Set(['morning', 'afternoon']));

const rescheduled = run(
  [{ ...base, id: 'new-id', date: '2026-09-12T10:00:00-04:00' }],
  [{ ...base, id: 'canonical-id', date: '2026-09-11T10:00:00-04:00' }],
);
assert.strictEqual(rescheduled.length, 1, 'a unique stable occurrence should refresh');
assert.strictEqual(rescheduled[0].id, 'canonical-id', 'a refresh must preserve canonical ID');
assert.strictEqual(rescheduled[0].lifecycle_status, 'rescheduled');
assert.deepStrictEqual(rescheduled[0].previous_dates, ['2026-09-11T10:00:00-04:00']);

const parent = {
  ...base,
  id: 'incoming-parent',
  title: 'Parent Festival',
  date: '2026-09-01T09:00:00-04:00',
  source_url: 'https://festival.example/program',
  is_parent_festival: true,
};
const child = {
  ...base,
  id: 'incoming-child',
  title: 'Child Session',
  date: '2026-09-01T11:00:00-04:00',
  source_url: 'https://festival.example/program/child',
  parent_id: 'incoming-parent',
};
const hierarchy = run(
  [child, parent],
  [{ ...parent, id: 'canonical-parent', review_status: 'manual' }],
);
assert.strictEqual(
  hierarchy.find(event => event.id === 'incoming-child').parent_id,
  'canonical-parent',
  'child parent_id must remap to retained canonical parent',
);

console.log(
  'FESTIVAL OCCURRENCE MERGE TESTS PASSED — distinct sessions, reschedules, canonical IDs, '
    + 'and parent remapping are preserved.',
);
