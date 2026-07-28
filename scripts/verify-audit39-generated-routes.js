#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const {dateOneYearAfter, resolveSiteBuildDate} = require('./polymythcal-build-date');
const {resourceRoute, slug} = require('./build-search-pages');
const {ROUTES} = require('./polymythcal-route-shell');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const TODAY = resolveSiteBuildDate({root:ROOT});
const failures = [];
const fail = message => failures.push(message);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const count = (pattern, text) => [...text.matchAll(pattern)].length;
const sourcePath = route => route.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
const placeholders = new Set(['', 'unknown', 'location unconfirmed', 'location unconfirmed · lieu non confirmé', 'lieu non confirmé']);

function jsonScripts(html) {
  const records = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      records.push(JSON.parse(match[1]));
    } catch (error) {
      fail(`invalid JSON-LD: ${error.message}`);
    }
  }
  return records;
}
function canonicalOf(html) {
  return html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1] || '';
}
function titleOf(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
}
function robotsOf(html) {
  return html.match(/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']([^"']+)["'])[^>]*>/i)?.[1] || '';
}
function checkUniqueMetadata(html, rel) {
  if (count(/<title\b/gi, html) !== 1) fail(`${rel}: expected one title`);
  if (count(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi, html) !== 1) fail(`${rel}: expected one description`);
  if (count(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/gi, html) !== 1) fail(`${rel}: expected one robots directive`);
  if (count(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, html) !== 1) fail(`${rel}: expected one canonical`);
  if (count(/<h1\b/gi, html) !== 1) fail(`${rel}: expected one H1`);
}
function resourceInventory(data) {
  const items = [];
  let globalIndex = 0;
  for (const group of data.groups || []) {
    const groupRoute = `/teacherresources/${slug(group.id)}/`;
    items.push({kind:'group', route:groupRoute, group});
    for (const category of group.categories || []) {
      const categoryRoute = `/teacherresources/${slug(group.id)}/${slug(category.id)}/`;
      items.push({kind:'category', route:categoryRoute, group, category});
      for (const [entryOffset, entry] of category.entries.entries()) {
        const route = resourceRoute(group, category, entry, globalIndex++);
        items.push({kind:'resource', route, group, category, entry, entryOffset});
      }
    }
  }
  return items;
}
function eventIndexable(event) {
  const city = String(event.city || '').trim().toLowerCase();
  const venue = String(event.venue || '').trim().toLowerCase();
  const end = String(event.end_date || event.date || '').slice(0, 10);
  return event.confirmation_status === 'confirmed'
    && event.date_precision === 'exact'
    && !placeholders.has(city)
    && !placeholders.has(venue)
    && !['cancelled', 'missing-on-source', 'archived'].includes(event.lifecycle_status)
    && /^\d{4}-\d{2}-\d{2}$/.test(end)
    && end >= TODAY;
}
function eventSitemapEligible(event) {
  const start = String(event.date || '').slice(0, 10);
  const end = String(event.end_date || event.date || '').slice(0, 10);
  return eventIndexable(event)
    && /^\d{4}-\d{2}-\d{2}$/.test(start)
    && end >= TODAY
    && start <= dateOneYearAfter(TODAY);
}
function runCheck(command, args, label) {
  const result = spawnSync(command, args, {cwd:ROOT, encoding:'utf8'});
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`${label} failed${detail ? `: ${detail.slice(0, 1200)}` : ''}`);
  }
}
function ownedOutputDigest() {
  const roots = [
    'teacherresources',
    'polymythseminars',
    'polymyth/methodologylist',
    ...Object.keys(ROUTES),
  ];
  const files = ['sitemap.xml', 'scripts/search-surface-manifest.json'];
  for (const rel of roots) {
    const initial = path.join(ROOT, rel);
    if (!fs.existsSync(initial)) continue;
    const stack = [initial];
    while (stack.length) {
      const active = stack.pop();
      for (const entry of fs.readdirSync(active, {withFileTypes:true})) {
        const file = path.join(active, entry.name);
        if (entry.isDirectory()) stack.push(file);
        else files.push(path.relative(ROOT, file).split(path.sep).join('/'));
      }
    }
  }
  const hash = crypto.createHash('sha256');
  for (const rel of [...new Set(files)].sort()) {
    hash.update(rel);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(ROOT, rel)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function main() {
  const teacher = JSON.parse(read('teacherresources/resources-data.json'));
  const eventsPayload = JSON.parse(read('polymythseminars/events.json'));
  const events = eventsPayload.events || [];
  const sources = JSON.parse(read('scripts/sources.json')).sources || [];
  const categories = (teacher.groups || []).flatMap(group => group.categories || []);
  const entries = categories.flatMap(category => category.entries || []);
  if (events.length !== 833) fail(`Polymythcal canonical event count changed: ${events.length}/833`);
  if (new Set(events.map(event => event.type)).size < 32) fail('Polymythcal type floor regressed');
  if (sources.length < 422) fail(`Polymythcal source floor regressed: ${sources.length}`);
  if (entries.length !== 644 || categories.length !== 25 || teacher.groups.length !== 7) {
    fail(`Teacher Resources baseline changed: ${entries.length}/${categories.length}/${teacher.groups.length}`);
  }
  if (!read('js/polymythcal-revamp.js').includes('const PAGE_SIZE = 24;')) fail('Polymythcal 24-card pagination changed');

  const sitemap = read('sitemap.xml');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const sitemapSet = new Set(sitemapUrls);
  if (sitemapSet.size !== sitemapUrls.length) fail('sitemap.xml contains duplicate URLs');

  const resourceItems = resourceInventory(teacher);
  const resourceTitles = new Map();
  const resourceCanonicals = new Set();
  for (const item of resourceItems) {
    const rel = sourcePath(item.route);
    if (!exists(rel)) {
      fail(`${rel}: generated Teacher Resource route is missing`);
      continue;
    }
    const html = read(rel);
    const canonical = SITE + item.route;
    checkUniqueMetadata(html, rel);
    if (canonicalOf(html) !== canonical) fail(`${rel}: canonical mismatch`);
    if (robotsOf(html) !== 'index,follow') fail(`${rel}: Teacher Resource route must remain indexable`);
    if (!sitemapSet.has(canonical)) fail(`${rel}: indexable route is missing from the sitemap`);
    if (!/<main\b[^>]*\bid="content"/.test(html) || !/<header\b[^>]*\bclass="catalog-top"/.test(html) || !/<footer\b[^>]*\bclass="catalog-footer"/.test(html)) {
      fail(`${rel}: generated landmarks are incomplete`);
    }
    if (!/<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>/.test(html) || !/aria-current="page"/.test(html)) {
      fail(`${rel}: semantic breadcrumb trail is missing`);
    }
    const title = titleOf(html);
    if (resourceTitles.has(title)) fail(`${rel}: duplicate generated title shared with ${resourceTitles.get(title)}`);
    else resourceTitles.set(title, rel);
    if (resourceCanonicals.has(canonical)) fail(`${rel}: duplicate canonical`);
    resourceCanonicals.add(canonical);
    if (item.kind === 'resource') {
      const related = html.match(/<section aria-labelledby="related-resources-title">([\s\S]*?)<\/section>/i)?.[1] || '';
      const expected = Math.min(3, item.category.entries.length - 1);
      const relatedLinks = [...related.matchAll(/href="(\/teacherresources\/[^"]+\/)"/g)].map(match => match[1]);
      if (relatedLinks.length !== expected) fail(`${rel}: expected ${expected} related resources, found ${relatedLinks.length}`);
      const categoryPrefix = `/teacherresources/${slug(item.group.id)}/${slug(item.category.id)}/`;
      if (relatedLinks.some(route => !route.startsWith(categoryPrefix) || route === item.route)) fail(`${rel}: related-resource scope drift`);
      const learning = jsonScripts(html).find(record => record['@type'] === 'LearningResource');
      if (!learning) fail(`${rel}: LearningResource schema is missing`);
      if (learning && learning.author && typeof learning.author === 'object' && learning.author['@type'] === 'Organization') {
        fail(`${rel}: an unclassified author is asserted as an organization`);
      }
    }
  }
  if (resourceItems.length !== 676 || resourceTitles.size !== 676 || resourceCanonicals.size !== 676) {
    fail(`generated Teacher Resource route parity changed: ${resourceItems.length}/${resourceTitles.size}/${resourceCanonicals.size}`);
  }

  const eventIds = new Set(events.map(event => String(event.id)));
  let eventPageCount = 0;
  const expectedSitemapEvents = new Set(events.filter(eventSitemapEligible).map(event => `${SITE}/polymythseminars/events/${encodeURIComponent(event.id)}/`));
  const actualSitemapEvents = new Set(sitemapUrls.filter(url => url.startsWith(`${SITE}/polymythseminars/events/`)));
  if (expectedSitemapEvents.size !== actualSitemapEvents.size || [...expectedSitemapEvents].some(url => !actualSitemapEvents.has(url))) {
    fail(`event sitemap classification mismatch: expected ${expectedSitemapEvents.size}, found ${actualSitemapEvents.size}`);
  }
  let relatedEventPages = 0;
  for (const event of events) {
    const rel = `polymythseminars/events/${event.id}/index.html`;
    if (!exists(rel)) {
      fail(`${rel}: canonical event page is missing`);
      continue;
    }
    const html = read(rel);
    const canonical = `${SITE}/polymythseminars/events/${encodeURIComponent(event.id)}/`;
    const indexable = eventIndexable(event);
    checkUniqueMetadata(html, rel);
    if (canonicalOf(html) !== canonical) fail(`${rel}: canonical mismatch`);
    if (robotsOf(html) !== (indexable ? 'index,follow' : 'noindex,follow')) fail(`${rel}: robots classification mismatch`);
    if (!/<main\b[^>]*\bid="main-content"/.test(html) || !/<nav\b[^>]*\bclass="pm-event-nav"/.test(html) || !/<article\b[^>]*\bclass="pm-event-detail"/.test(html)) {
      fail(`${rel}: event landmarks are incomplete`);
    }
    const themeInitPosition = html.indexOf('/js/theme-init.js');
    const firstStylesheetPosition = html.search(/<link\b[^>]*rel=["']stylesheet["']/i);
    const head = html.slice(0, html.search(/<\/head>/i) + 7);
    const calmPosition = head.lastIndexOf('/css/calm-ux.css');
    const finalStylesheetPosition = Math.max(-1, ...[...head.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)].map(match => match.index));
    if (themeInitPosition < 0 || firstStylesheetPosition < 0 || themeInitPosition > firstStylesheetPosition) fail(`${rel}: pre-paint theme initialization is missing or late`);
    if (calmPosition < 0 || calmPosition < finalStylesheetPosition) fail(`${rel}: calm-ux.css is not the final stylesheet`);
    if (!/<body\b[^>]*data-indra-intensity=["']0\.105["']/.test(html)) fail(`${rel}: canonical event geometry intensity drift`);
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/i)?.[1] || '';
    if (ogUrl !== canonical) fail(`${rel}: Open Graph URL does not match canonical`);
    const pageTitle = titleOf(html);
    const dateToken = String(event.date || '').slice(0, 10);
    if (dateToken && !pageTitle.includes(dateToken)) fail(`${rel}: event title lacks date disambiguation`);
    if (!pageTitle) fail(`${rel}: canonical event title is missing`);
    eventPageCount++;
    const hasEventSchema = jsonScripts(html).some(record => record['@type'] === 'Event');
    if (hasEventSchema !== indexable) fail(`${rel}: Event schema confidence does not match indexability`);
    const relatedBlock = html.match(/<nav class="pm-event-related"[\s\S]*?<\/nav>/i)?.[0] || '';
    const relatedLinks = [...relatedBlock.matchAll(/href="\/polymythseminars\/events\/([^"/]+)\//g)].map(match => decodeURIComponent(match[1]));
    if (relatedLinks.length) relatedEventPages++;
    if (relatedLinks.length > 3 || relatedLinks.some(id => id === String(event.id) || !eventIds.has(id))) {
      fail(`${rel}: related-event navigation contains an invalid target`);
    }
  }
  if (eventPageCount !== events.length) fail(`canonical event page parity changed: ${eventPageCount}/${events.length}`);
  if (!relatedEventPages) fail('no canonical event page received related-event recovery navigation');

  const eventDirectory = path.join(ROOT, 'polymythseminars', 'events');
  const aliases = fs.readdirSync(eventDirectory, {withFileTypes:true})
    .filter(entry => entry.isDirectory() && !eventIds.has(entry.name));
  if (!aliases.length) fail('legacy event aliases are missing');
  for (const alias of aliases) {
    const rel = `polymythseminars/events/${alias.name}/index.html`;
    const html = read(rel);
    if (robotsOf(html) !== 'noindex,follow' || !/<main><h1>Event moved/.test(html) || !/Open the stable event page/.test(html)
      || !html.includes('/js/theme-init.js') || !html.includes('/css/calm-ux.css')
      || !/<body\b[^>]*data-indra-intensity=["']0\.105["']/.test(html)) {
      fail(`${rel}: alias recovery shell is incomplete`);
    }
  }

  for (const route of Object.keys(ROUTES)) {
    const rel = `${route}/index.html`;
    const html = read(rel);
    checkUniqueMetadata(html, rel);
    if (canonicalOf(html) !== `${SITE}/${route}/`) fail(`${rel}: focused-route canonical mismatch`);
    if (!html.includes(`data-pm-route="${route}"`) || !/<main\b/.test(html)) fail(`${rel}: focused route shell is incomplete`);
  }
  const routeGenerator = read('scripts/polymythcal-route-shell.js');
  if (!routeGenerator.includes("resolveSiteBuildDate({root:ROOT})") || /new Intl\.DateTimeFormat\('en-CA'.*new Date\(\)/s.test(routeGenerator)) {
    fail('focused-route current-event filtering is tied to wall-clock time');
  }

  const manifest = JSON.parse(read('scripts/search-surface-manifest.json'));
  if ((manifest.resourceGroupPrefixes || []).length !== 7 || (manifest.methodologyPrefixes || []).length !== 16) {
    fail('generated-route ownership prefixes are missing from the search-surface manifest');
  }
  const searchGenerator = read('scripts/build-search-pages.js');
  for (const marker of ['archiveStaleGeneratedRoutes(', 'data-generated-route-archive', 'previousManifest.resourceGroupPrefixes', 'previousManifest.methodologyPrefixes', 'function eventExpired(event)', 'if (!eventExpired(event)) continue']) {
    if (!searchGenerator.includes(marker)) fail(`stale-route recovery contract missing: ${marker}`);
  }
  const eventGenerator = read('scripts/build-polymythcal-audit13.py');
  for (const marker of ["CHECK='--check'", 'release_build_day(', 'related_events(', 'schema={', "path.read_bytes().decode('utf-8')", "STEADY_VERSION='20260723-steady'", "EVENT_GEOMETRY_INTENSITY='0.105'"]) {
    if (!eventGenerator.includes(marker)) fail(`event generator contract missing: ${marker}`);
  }

  const notFound = read('404.html');
  if (robotsOf(notFound) !== 'noindex,follow' || !/<main\b[^>]*\bid="main-content"/.test(notFound) || !/<h1\b/.test(notFound)) {
    fail('404 route classification or landmarks are incomplete');
  }
  for (const recovery of ['href="/"', 'href="/polymythseminars/"', 'href="/polymyth/sitemap/"']) {
    if (!notFound.includes(recovery)) fail(`404 recovery link missing: ${recovery}`);
  }

  const beforeCheckDigest = ownedOutputDigest();
  runCheck(process.execPath, ['scripts/build-search-pages.js', '--check'], 'static search-surface check');
  runCheck(process.execPath, ['scripts/build-writing-shortcuts.js', '--check'], 'writing route-shell check');
  runCheck(process.execPath, ['scripts/build-academic-shortcuts.js', '--check'], 'academic route-shell check');
  const afterCheckDigest = ownedOutputDigest();
  if (afterCheckDigest !== beforeCheckDigest) fail('generator check modes modified owned output files');

  if (failures.length) {
    console.error('AUDIT39 GENERATED ROUTE CHECK FAILED');
    failures.slice(0, 180).forEach(message => console.error(` - ${message}`));
    if (failures.length > 180) console.error(` - … ${failures.length - 180} more`);
    process.exit(1);
  }
  console.log(`AUDIT39 GENERATED ROUTE CHECK PASSED — ${events.length} canonical events, ${aliases.length} noindex aliases, ${resourceItems.length} Teacher Resource routes, ${Object.keys(ROUTES).length} focused calendars, ${sitemapUrls.length} classified sitemap URLs.`);
}

try {
  main();
} catch (error) {
  console.error('AUDIT39 GENERATED ROUTE CHECK FAILED:', error.stack || error.message);
  process.exit(1);
}
