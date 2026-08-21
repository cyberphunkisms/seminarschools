#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const {
  resolveSiteBuildDate,
} = require('./polymythcal-build-date');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
// Release verification must inspect the same Toronto calendar day that built
// the event pages.  SITE_BUILD_DATE is pinned by the primary and clean-room
// packagers; ordinary developer runs still fall back to the live Toronto day.
const TODAY = resolveSiteBuildDate({root: ROOT});
const PYTHON = process.env.PYTHON_BIN || 'python3';
const failures = [];
const fail = message => failures.push(message);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const eventRoute = event => `/polymythseminars/events/${encodeURIComponent(String(event.id || event.identity_key))}/`;
const eventFile = event => path.join(ROOT, eventRoute(event).replace(/^\/+|\/+$/g, ''), 'index.html');
const placeholders = new Set([
  '',
  'unknown',
  'location unconfirmed',
  'location unconfirmed · lieu non confirmé',
  'lieu non confirmé',
]);

function robotsOf(html) {
  return html.match(/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']([^"']+)["'])[^>]*>/i)?.[1] || '';
}

function eventEnd(event) {
  return String(event.end_date || event.date || '').slice(0, 10);
}

function eventIndexable(event, day = TODAY) {
  const city = String(event.city || '').trim().toLowerCase();
  const venue = String(event.venue || '').trim().toLowerCase();
  const end = eventEnd(event);
  return event.record_kind !== 'opportunity'
    && event.confirmation_status === 'confirmed'
    && event.date_precision === 'exact'
    && !placeholders.has(city)
    && !placeholders.has(venue)
    && !['cancelled', 'missing-on-source', 'archived'].includes(event.lifecycle_status)
    && /^\d{4}-\d{2}-\d{2}$/.test(end)
    && end >= day;
}

function dayAfter(day) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

function run(command, args, env = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: {...process.env, ...env},
    maxBuffer: 32 * 1024 * 1024,
  });
}

function generatedDigest() {
  const roots = [
    path.join(ROOT, 'polymythseminars', 'events'),
    path.join(ROOT, 'polymythseminars', 'ics'),
  ];
  const files = [
    path.join(ROOT, 'sitemap.xml'),
    path.join(ROOT, 'scripts', 'search-surface-manifest.json'),
  ];
  for (const initial of roots) {
    if (!fs.existsSync(initial)) continue;
    const stack = [initial];
    while (stack.length) {
      const active = stack.pop();
      for (const entry of fs.readdirSync(active, {withFileTypes: true})) {
        const file = path.join(active, entry.name);
        if (entry.isDirectory()) stack.push(file);
        else if (entry.isFile()) files.push(file);
      }
    }
  }
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) {
    hash.update(path.relative(ROOT, file).split(path.sep).join('/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function main() {
  const events = JSON.parse(read('polymythseminars/events.json')).events || [];
  const sitemap = read('sitemap.xml');
  const sitemapEvents = new Set(
    [...sitemap.matchAll(/<loc>(https:\/\/seminarschools\.com\/polymythseminars\/events\/[^<]+)<\/loc>/g)]
      .map(match => match[1])
  );
  const expectedSitemapEvents = new Set(
    // The interactive calendar keeps a one-year working horizon, but the
    // sitemap owns every current canonical page that is eligible to index.
    // Long-range confirmed records must not disappear from crawl coverage.
    events.filter(event => eventIndexable(event)).map(event => SITE + eventRoute(event))
  );

  if (
    sitemapEvents.size !== expectedSitemapEvents.size
    || [...expectedSitemapEvents].some(url => !sitemapEvents.has(url))
  ) {
    fail(`release-day sitemap event set differs: expected ${expectedSitemapEvents.size}, found ${sitemapEvents.size}`);
  }

  let expired = 0;
  let currentIndexable = 0;
  for (const event of events) {
    const file = eventFile(event);
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (!fs.existsSync(file)) {
      fail(`${rel}: canonical event page is missing`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const indexable = eventIndexable(event);
    if (robotsOf(html) !== (indexable ? 'index,follow' : 'noindex,follow')) {
      fail(`${rel}: robots state does not match release day ${TODAY}`);
    }
    const hasEventSchema = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type"\s*:\s*"Event"[\s\S]*?<\/script>/i.test(html);
    if (hasEventSchema !== indexable) fail(`${rel}: Event schema does not match release-day indexability`);
    if (indexable) currentIndexable++;
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventEnd(event)) && eventEnd(event) < TODAY) {
      expired++;
      if (!html.includes('data-event-archive-note')) fail(`${rel}: expired page lacks its visible archive note`);
    }
  }

  const eventIds = new Set(events.map(event => String(event.id || event.identity_key)));
  const eventDir = path.join(ROOT, 'polymythseminars', 'events');
  let aliases = 0;
  for (const entry of fs.readdirSync(eventDir, {withFileTypes: true})) {
    if (!entry.isDirectory() || eventIds.has(entry.name)) continue;
    aliases++;
    const file = path.join(eventDir, entry.name, 'index.html');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (!fs.existsSync(file)) {
      fail(`${rel}: stale generated event directory has no recovery page`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const target = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/seminarschools\.com\/polymythseminars\/events\/([^/"']+)\/["'])[^>]*>/i)?.[1];
    if (
      robotsOf(html) !== 'noindex,follow'
      || !/Event moved · Fiche déplacée/.test(html)
      || !target
      || !eventIds.has(decodeURIComponent(target))
    ) {
      fail(`${rel}: orphaned directory is neither a canonical event nor a valid noindex alias`);
    }
  }

  const searchSource = read('scripts/build-search-pages.js');
  const canonicalSource = read('scripts/build-polymythcal-audit13.py');
  const finalizeSource = read('scripts/finalize-polymythcal-publication.py');
  const packageJson = JSON.parse(read('package.json'));
  const buildCommand = packageJson.scripts?.build || '';
  const canonicalStep = 'node scripts/run-python.js scripts/build-polymythcal-audit13.py';
  const searchStep = 'node scripts/build-search-pages.js';
  if (
    !buildCommand.includes(canonicalStep)
    || !buildCommand.includes(searchStep)
    || buildCommand.indexOf(canonicalStep) > buildCommand.indexOf(searchStep)
  ) {
    fail('ordinary production build does not run the canonical event builder before the static search/sitemap builder');
  }
  if (
    finalizeSource.indexOf("[sys.executable,'scripts/build-polymythcal-audit13.py']")
      > finalizeSource.indexOf("['node','scripts/build-search-pages.js']")
  ) {
    fail('Polymythcal publication pipeline runs the search/sitemap builder before canonical event pages');
  }
  for (const marker of [
    '&& !eventExpired(event)',
    'canonical event page is stale for expired listing',
    'run scripts/build-polymythcal-audit13.py before scripts/build-search-pages.js',
    'archiveExpiredStableEventPages(events);',
  ]) {
    if (!searchSource.includes(marker)) fail(`static rollover contract is missing: ${marker}`);
  }
  for (const marker of [
    "os.environ.get('SITE_BUILD_DATE')",
    'def resolve_site_build_day():',
    'TODAY=resolve_site_build_day()',
    'and not past',
    'clean_dirs(valid_ids,set(alias_targets))',
    'shutil.rmtree(child)',
    'old.unlink()',
  ]) {
    if (!canonicalSource.includes(marker)) fail(`canonical rollover contract is missing: ${marker}`);
  }
  if ((canonicalSource.match(/ranked\.append\(/g) || []).length !== 1) {
    fail('canonical related-list ranking must append each candidate exactly once');
  }

  const before = generatedDigest();
  const canonicalCheck = run(PYTHON, ['scripts/build-polymythcal-audit13.py', '--check']);
  if (canonicalCheck.status !== 0) {
    fail(`canonical current-release check failed: ${(canonicalCheck.stdout + canonicalCheck.stderr).trim().slice(0, 1000)}`);
  }
  const searchCheck = run(process.execPath, ['scripts/build-search-pages.js', '--check']);
  if (searchCheck.status !== 0) {
    fail(`search/sitemap current-release check failed: ${(searchCheck.stdout + searchCheck.stderr).trim().slice(0, 1000)}`);
  }

  const boundary = events
    .map(eventEnd)
    .filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= TODAY)
    .sort()[0];
  if (!boundary) {
    fail('no future event boundary is available for the rollover simulation');
  } else {
    const rolloverDay = dayAfter(boundary);
    const canonicalRollover = run(
      PYTHON,
      ['scripts/build-polymythcal-audit13.py', '--check'],
      {SITE_BUILD_DATE: rolloverDay}
    );
    const canonicalOutput = `${canonicalRollover.stdout || ''}\n${canonicalRollover.stderr || ''}`;
    if (canonicalRollover.status === 0 || !canonicalOutput.includes('stale generated file: polymythseminars/events/')) {
      fail(`canonical builder did not detect the simulated ${boundary} to ${rolloverDay} rollover`);
    }
    const searchRollover = run(
      process.execPath,
      ['scripts/build-search-pages.js', '--check'],
      {SITE_BUILD_DATE: rolloverDay}
    );
    const searchOutput = `${searchRollover.stdout || ''}\n${searchRollover.stderr || ''}`;
    if (
      searchRollover.status === 0
      || !(
        searchOutput.includes('canonical event page is stale for expired listing')
        || searchOutput.includes('stale generated file: sitemap.xml')
      )
    ) {
      fail(`static search builder did not reject the simulated ${boundary} to ${rolloverDay} rollover`);
    }
  }
  const after = generatedDigest();
  if (after !== before) fail('a current-date or rollover check mode modified generated output');

  if (failures.length) {
    console.error('AUDIT41 EVENT ROLLOVER FAILED');
    failures.slice(0, 120).forEach(message => console.error(` - ${message}`));
    if (failures.length > 120) console.error(` - … ${failures.length - 120} more`);
    process.exit(1);
  }

  console.log(
    `AUDIT41 EVENT ROLLOVER PASSED — ${events.length} canonical pages, ${expired} archived pages, `
    + `${currentIndexable} current indexable pages, ${aliases} noindex aliases, `
    + `${sitemapEvents.size} sitemap events, and a no-write future-date rollover simulation.`
  );
}

try {
  main();
} catch (error) {
  console.error('AUDIT41 EVENT ROLLOVER FAILED:', error.stack || error.message);
  process.exit(1);
}
