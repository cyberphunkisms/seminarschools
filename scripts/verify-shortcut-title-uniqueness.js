#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const { ROUTES, buildRoutePage } = require('./polymythcal-route-shell');
const rels = Object.keys(ROUTES);
const expectedModes = {
  writingclub: 'apply',
  writingkids: 'apply',
  writingjuniors: 'apply',
  writingteens: 'apply',
  writinggrads: 'apply',
  university: 'both',
  philosophy: 'both',
  humanities: 'both',
  cfps: 'apply',
  lectures: 'attend',
  fellowships: 'apply',
};
const titles = [];
const failures = [];

function metaContent(html, attr, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${escaped}["'])[^>]*>`, 'i'))?.[0] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
}

for (const dir of rels) {
  const full = path.join(ROOT, dir, 'index.html');
  if (!fs.existsSync(full)) {
    failures.push(`${dir}/index.html missing`);
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) failures.push(`${dir} lacks title`);
  else titles.push([dir,match[1].replace(/\s+/g,' ').trim()]);
}

const seen = new Map();
for (const [dir, title] of titles) {
  if (seen.has(title)) failures.push(`${dir} duplicates title with ${seen.get(title)}: ${title}`);
  seen.set(title, dir);
  if (/^Polymythcal \| Seminar Schools$/i.test(title)) failures.push(`${dir} still has generic Polymythcal title`);
}

const shell = fs.readFileSync(path.join(ROOT, 'scripts', 'polymythcal-route-shell.js'), 'utf8');
if (!/const title=`\$\{cfg\.heading\} \| Polymythcal \| Seminar Schools`/.test(shell) || !shell.includes("replaceMeta(html,'title',title)")) {
  failures.push('polymythcal-route-shell.js lacks centralized title generation logic');
}
for (const needle of ['focusedRouteNavigation(slug)', 'pmd-route-context', 'aria-current="page"', '?route=${slug}']) {
  if (!shell.includes(needle)) failures.push(`polymythcal-route-shell.js lacks focused-shell contract ${needle}`);
}
for (const script of ['build-writing-shortcuts.js', 'build-academic-shortcuts.js']) {
  const js = fs.readFileSync(path.join(ROOT, 'scripts', script), 'utf8');
  if (!js.includes("require('./polymythcal-route-shell')")) failures.push(`${script} does not delegate to centralized route generation`);
}

const controller = fs.readFileSync(path.join(ROOT, 'js', 'polymythcal-discovery.js'), 'utf8');

function runtimeFor({ lang = 'en-CA', dataset = {}, pathname = '/polymythseminars/' } = {}) {
  const marker = '\n  bindEvents();';
  const markerIndex = controller.lastIndexOf(marker);
  if (markerIndex < 0) {
    failures.push('Discovery controller lacks its runtime verification seam');
    return null;
  }
  const source = `${controller.slice(0, markerIndex)}
  axes.set('kind', { key: 'kind', label: 'Kind', options: [
    { value: 'attend', label: 'Attend' },
    { value: 'apply', label: 'Apply' },
  ] });
  globalThis.__pmdShortcutTest = Object.freeze({
    readUrl(search) {
      window.location.search = search;
      readStateFromUrl();
      return {
        routeScope,
        kind: [...selectedFor('kind')],
        kindExplicitAll: state.kindExplicitAll,
        main: targetUrl('main'),
        research: targetUrl('research'),
        monitoring: targetUrl('monitoring'),
      };
    },
  });
})();`;
  const windowObject = {
    __polymythcalDiscoveryMounted: false,
    location: { origin: 'https://example.test', pathname, search: '', hash: '' },
    history: { pushState() {}, replaceState() {} },
  };
  const documentObject = {
    documentElement: { lang },
    body: { dataset: { ...dataset } },
    activeElement: null,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  };
  const context = {
    window: windowObject,
    document: documentObject,
    URL,
    URLSearchParams,
    Intl,
    Date,
    console,
    HTMLElement: class HTMLElement {},
    CSS: { escape: value => String(value) },
  };
  try {
    vm.runInNewContext(source, context, { filename: 'polymythcal-shortcuts.runtime-test.js', timeout: 2000 });
    return context.__pmdShortcutTest;
  } catch (error) {
    failures.push(`Discovery focused-route runtime could not be exercised: ${error.message}`);
    return null;
  }
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

const writingRuntime = runtimeFor({ dataset: { pmRoute: 'writingclub', pmDefaultContent: 'apply' }, pathname: '/writingclub/' });
if (writingRuntime) {
  const defaults = writingRuntime.readUrl('');
  check(defaults.routeScope === 'writingclub', 'Focused route identity is not restored from the page shell');
  check(JSON.stringify([...defaults.kind]) === JSON.stringify(['apply']) && !defaults.kindExplicitAll, 'Focused writing route does not apply its default opportunity mode');
  const mainDefault = new URL(defaults.main, 'https://example.test');
  check(mainDefault.pathname === '/writingclub/' && !mainDefault.searchParams.has('route'), 'Focused main URL duplicates or drops its route identity');
  const researchDefault = new URL(defaults.research, 'https://example.test');
  check(researchDefault.pathname === '/polymythseminars/research/' && researchDefault.searchParams.get('route') === 'writingclub', 'Focused Research handoff drops route scope');
  const monitoringDefault = new URL(defaults.monitoring, 'https://example.test');
  check(monitoringDefault.pathname === '/polymythseminars/monitoring/' && monitoringDefault.searchParams.get('route') === 'writingclub', 'Focused Monitoring handoff drops route scope');

  const explicitAll = writingRuntime.readUrl('?kind=all');
  check(explicitAll.kind.length === 0 && explicitAll.kindExplicitAll, 'Explicit all-listings state does not disable the focused default');
  check(new URL(explicitAll.research, 'https://example.test').searchParams.get('kind') === 'all', 'Explicit all-listings state is not preserved across connected views');

  const explicitAttend = writingRuntime.readUrl('?kind=attend');
  check(JSON.stringify([...explicitAttend.kind]) === JSON.stringify(['attend']) && !explicitAttend.kindExplicitAll, 'Explicit Attend state is replaced by the focused default');
  const legacyEvents = writingRuntime.readUrl('?content=events');
  check(JSON.stringify([...legacyEvents.kind]) === JSON.stringify(['attend']), 'Legacy events URL state no longer maps to Attend');
  const legacyOpportunities = writingRuntime.readUrl('?content=opportunities');
  check(JSON.stringify([...legacyOpportunities.kind]) === JSON.stringify(['apply']), 'Legacy opportunities URL state no longer maps to Apply');
  const invalidKind = writingRuntime.readUrl('?kind=not-a-kind');
  check(JSON.stringify([...invalidKind.kind]) === JSON.stringify(['apply']), 'Invalid kind input suppresses the safe focused default');
}

const connectedRuntime = runtimeFor({ dataset: { pmdSurface: 'research' }, pathname: '/polymythseminars/research/' });
if (connectedRuntime) {
  const connected = connectedRuntime.readUrl('?route=writingclub&kind=apply');
  check(connected.routeScope === 'writingclub', 'Connected Research view does not restore a valid focused route');
  check(new URL(connected.main, 'https://example.test').pathname === '/writingclub/', 'Connected Research return path does not use the focused calendar URL');
  const invalid = connectedRuntime.readUrl('?route=unknown');
  check(invalid.routeScope === '' && new URL(invalid.main, 'https://example.test').pathname === '/polymythseminars/', 'Unknown route input is not rejected before building a return URL');
}

const bothRuntime = runtimeFor({ dataset: { pmRoute: 'university', pmDefaultContent: 'both' }, pathname: '/university/' });
if (bothRuntime) {
  const both = bothRuntime.readUrl('');
  check(both.kind.length === 0 && !both.kindExplicitAll, 'A both-mode route invents an Attend/Apply restriction');
}

const frenchRuntime = runtimeFor({ lang: 'fr-CA', dataset: { pmRoute: 'writingclub', pmDefaultContent: 'apply' }, pathname: '/writingclub/fr/' });
if (frenchRuntime) {
  const french = frenchRuntime.readUrl('');
  check(new URL(french.main, 'https://example.test').pathname === '/writingclub/fr/', 'French focused main URL loses its locale');
  check(new URL(french.research, 'https://example.test').pathname === '/polymythseminars/fr/research/', 'French Research handoff loses its locale');
}

const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'polymythseminars', 'browse.json'), 'utf8'));
for (const [slug, cfg] of Object.entries(ROUTES)) {
  const generated = buildRoutePage(slug, payload);
  const title = `${cfg.heading} | Polymythcal | Seminar Schools`;
  const url = `${SITE}/${slug}/`;
  if (cfg.defaultContent !== expectedModes[slug]) failures.push(`${slug}: expected ${expectedModes[slug]} content mode, found ${cfg.defaultContent}`);
  for (const needle of [
    'data-pmd-surface="main"',
    'data-pmd-source="/polymythseminars/browse.json"',
    `data-pm-route="${slug}"`,
    `data-pm-default-content="${cfg.defaultContent}"`,
    'id="pmdSearch"',
    'id="pmdCommonFilters"',
    'id="pmdResults"',
    'id="pmdSelected"',
    'id="pmdPagination"',
    '/js/polymythcal-discovery.js',
    'class="pmd-route-context"',
    'Browse all Polymythcal listings',
    `/polymythseminars/research/?route=${slug}`,
    'class="pmd-focused"',
    `<a href="/${slug}/" aria-current="page">`,
  ]) {
    if (!generated.includes(needle)) failures.push(`${slug}: generated compact shell missing ${needle}`);
  }
  if (metaContent(generated, 'property', 'og:url') !== url) failures.push(`${slug}: focused Open Graph URL was not generated`);
  if (metaContent(generated, 'property', 'og:title') !== title) failures.push(`${slug}: focused Open Graph title was not generated`);
  if (metaContent(generated, 'property', 'og:description') !== cfg.description) failures.push(`${slug}: focused Open Graph description was not generated`);
  if (/\bdata-preset=|id="pmLookingForTitle"|class="pm-filters"|polymythcal-revamp\.js/.test(generated)) {
    failures.push(`${slug}: generated focused route retains legacy filter-shell bloat`);
  }

  const english = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
  if (english !== generated) failures.push(`${slug}: checked-in English shortcut is stale against the centralized generator`);
  const frenchPath = path.join(ROOT, slug, 'fr', 'index.html');
  if (!fs.existsSync(frenchPath)) {
    failures.push(`${slug}/fr/index.html missing`);
  } else {
    const french = fs.readFileSync(frenchPath, 'utf8');
    for (const needle of [
      '<html lang="fr-CA"',
      'data-pmd-surface="main"',
      'data-pmd-source="/polymythseminars/browse.json"',
      `data-pm-route="${slug}"`,
      `data-pm-default-content="${cfg.defaultContent}"`,
      'id="pmdSearch"',
      'id="pmdResults"',
      '/js/polymythcal-discovery.js',
    ]) {
      if (!french.includes(needle)) failures.push(`${slug}/fr: localized shell missing ${needle}`);
    }
  }
}

if (failures.length) {
  console.error('SHORTCUT TITLE UNIQUENESS FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`SHORTCUT TITLE UNIQUENESS PASSED — ${titles.length} shortcut titles are unique and ${rels.length} EN/FR focused routes preserve compact Discovery scope/defaults, metadata, active navigation, and route-aware Research handoff.`);

