#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  evaluateLiveContent,
} = require('./live-content-integrity');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = path.join(ROOT, 'data', 'audit43-continuity-inventory.json');
const CHECK = process.argv.includes('--check');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(read(relative));
}

function sha256(relative) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest('hex');
}

function walk(directory) {
  const rows = [];
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) rows.push(target);
    }
  }
  return rows;
}

function cron(relative) {
  return [...read(relative).matchAll(/\bcron:\s*["']([^"']+)["']/g)]
    .map(match => match[1]);
}

function fail(message) {
  throw new Error(`AUDIT 43 CONTINUITY INVENTORY FAILED — ${message}`);
}

function build() {
  if (!fs.existsSync(PUBLIC)) fail('public deploy surface is missing');
  const release = json('RELEASE_MANIFEST.json');
  const events = json('polymythseminars/events.json');
  const browse = json('polymythseminars/browse.json');
  const sources = json('scripts/sources.json');
  const teacher = json('teacherresources/resources-data.json');
  const live = evaluateLiveContent({
    eventsDocument: events,
    browseDocument: browse,
    sourceDocument: sources,
    teacherDocument: teacher,
  });
  if (live.failures.length) fail(live.failures.join('; '));

  const canonicalIds = new Set(
    events.events.map(event => String(event.id || event.identity_key || '')),
  );
  const eventDirectories = fs.readdirSync(
    path.join(ROOT, 'polymythseminars', 'events'),
    { withFileTypes: true },
  ).filter(entry => entry.isDirectory());
  const eventAliases = eventDirectories.filter(
    entry => !canonicalIds.has(entry.name),
  ).length;

  const methodology = read('polymyth/methodologylist/index.html');
  const sectionCounts = [
    ...methodology.matchAll(/(\d+) indexed framework entries in a static HTML edition/g),
  ].map(match => Number(match[1]));
  const methodologyEntries = sectionCounts.reduce((sum, value) => sum + value, 0);
  const publicFiles = walk(PUBLIC);
  const htmlFiles = publicFiles.filter(file => file.endsWith('.html'));
  const readerEligible = htmlFiles.filter(file =>
    read(path.relative(ROOT, file)).includes('data-reader-eligible="true"')
  ).length;
  const candidates = json('polymythseminars/candidates.json');
  const protestConfig = json('scripts/protest-sources.json');
  const protestSources = protestConfig.sources || [];

  const summary = {
    events: live.metrics.events,
    event_types: live.metrics.eventTypes,
    registered_sources: live.metrics.registeredSources,
    event_alias_routes: eventAliases,
    teacher_resources: live.metrics.teacherResources,
    teacher_collections: live.metrics.teacherCollections,
    teacher_groups: live.metrics.teacherGroups,
    methodology_entries: methodologyEntries,
    methodology_sections: sectionCounts.length,
    public_files: publicFiles.length,
    public_html_routes: htmlFiles.length,
    reader_routes: readerEligible,
    undated_public_candidates: Number(candidates.count || 0),
    protest_sources: protestSources.length,
    browser_harvest_sources: protestSources.filter(row => row.browser_harvest).length,
    flyer_ocr_sources: protestSources.filter(row => row.ocr_harvest).length,
    mixed_calendar_sources: protestSources.filter(row => row.mixed_calendar).length,
    candidate_enabled_sources: protestSources.filter(row => row.undated_candidates).length,
  };

  const floors = {
    events: 833,
    event_types: 32,
    registered_sources: 422,
    event_alias_routes: 857,
    methodology_entries: 1139,
    public_files: 3551,
    public_html_routes: 2474,
    browser_harvest_sources: 10,
    flyer_ocr_sources: 7,
    mixed_calendar_sources: 6,
    candidate_enabled_sources: 12,
  };
  for (const [key, minimum] of Object.entries(floors)) {
    if (summary[key] < minimum) fail(`${key} backtracked to ${summary[key]}/${minimum}`);
  }
  for (const [key, expected] of Object.entries({
    teacher_resources: 644,
    teacher_collections: 25,
    teacher_groups: 7,
    methodology_sections: 16,
    reader_routes: 6,
  })) {
    if (summary[key] !== expected) fail(`${key} changed to ${summary[key]}/${expected}`);
  }
  const workflows = {
    protests: cron('.github/workflows/scrape-polymythcal-protests.yml'),
    seminars: cron('.github/workflows/scrape-seminars.yml'),
    festivals: cron('.github/workflows/scrape-festivals.yml'),
    external_links: cron('.github/workflows/audit-external-links.yml'),
  };
  const expectedWorkflows = {
    protests: '18 8 * * 3',
    seminars: '47 8 * * 1',
    festivals: '42 9 * * 2',
    external_links: '17 10 * * 0',
  };
  for (const [name, expected] of Object.entries(expectedWorkflows)) {
    if (workflows[name].length !== 1 || workflows[name][0] !== expected) {
      fail(`${name} workflow is not one weekly cron`);
    }
  }

  const coreFiles = [
    'index.html',
    'polymythseminars/index.html',
    'polymythseminars/events.json',
    'polymythseminars/browse.json',
    'polymythseminars/candidates.json',
    'teacherresources/index.html',
    'teacherresources/finder.js',
    'polymyth/methodologylist/index.html',
    'scripts/protest-sources.json',
    'scripts/polymythcal_discovery.py',
    'scripts/polymythcal_http_cache.py',
    'scripts/harvest_protests_browser_ocr.py',
    'scripts/polymythcal_identity_shadow.py',
    'css/audit43-approved.css',
    'js/audit43-reader.js',
  ];

  return {
    schema: 'seminar-schools-audit43-continuity-inventory-v1',
    release_id: release.release_id,
    generated_at: release.generated_at,
    rule: (
      'Audit 42 values are historical floors; Audit 43 may add records and '
      + 'routes but cannot remove the established project surfaces.'
    ),
    summary,
    floors,
    weekly_workflows: workflows,
    core_sha256: Object.fromEntries(
      coreFiles.map(relative => [relative, sha256(relative)]),
    ),
  };
}

const document = build();
const serialized = `${JSON.stringify(document, null, 2)}\n`;
if (CHECK) {
  let current = '';
  try {
    current = fs.readFileSync(OUTPUT, 'utf8');
  } catch {
    // Reported below.
  }
  if (current !== serialized) {
    console.error(
      'AUDIT 43 CONTINUITY INVENTORY FAILED — generated inventory is stale; '
      + 'run node scripts/build-audit43-continuity-inventory.js after the build.',
    );
    process.exit(1);
  }
  console.log(
    `AUDIT 43 CONTINUITY INVENTORY PASSED — ${document.summary.events} events, `
    + `${document.summary.teacher_resources} teacher resources, `
    + `${document.summary.methodology_entries} methodology entries, and `
    + `${document.summary.public_files} public files.`,
  );
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  console.log(
    `AUDIT 43 CONTINUITY INVENTORY WRITTEN — ${document.summary.events} events, `
    + `${document.summary.event_alias_routes} aliases, `
    + `${document.summary.public_html_routes} HTML routes.`,
  );
}
