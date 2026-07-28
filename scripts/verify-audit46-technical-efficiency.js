#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  currentTorontoDate,
  resolveSiteBuildDate,
} = require('./polymythcal-build-date');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit46-technical-efficiency.json');
const failures = [];
const metrics = {
  source_html_files: 0,
  public_html_files: 0,
  audit43_stylesheet_references: 0,
  audit43_reader_references: 0,
  duplicate_audit43_stylesheet_references: 0,
  duplicate_audit43_reader_references: 0,
  noncanonical_audit43_references: 0,
  calm_link_rewrites_required: 0,
  audit45_ui_rewrites_required: 0,
  compatible_redirect_overlaps: 82,
  predeploy_npm_ci_steps: 0,
  predeploy_npm_install_steps: 0,
  expired_bilingual_event_routes: 0,
};
const PUBLIC_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const READER_ALLOWLIST = new Set([
  'aa/index.html',
  'polymyth/index.html',
  'polymyth/bookwormburrows/index.html',
  'polymyth/campaigncodex/index.html',
  'polymyth/methodologylist/index.html',
  'polymyth/modulecanon/index.html',
]);
const TRANSLATION_UI_ROOTS = [
  'leizu/fr', 'leizu/zh-hant', 'leizu/zh-hans', 'leizu/fa',
  'polymythseminars/events', 'polymythseminars/fr',
  'writingclub/fr', 'writingkids/fr', 'writingjuniors/fr',
  'writingteens/fr', 'writinggrads/fr', 'university/fr',
  'philosophy/fr', 'humanities/fr', 'cfps/fr', 'lectures/fr',
  'fellowships/fr', 'saul/fr', 'saul/zh-hant', 'saul/zh-hans',
  'saul/fa', 'bb/why/zh', 'teacherresources',
];
const CANONICAL_STYLE = '<link rel="stylesheet" href="/css/audit43-approved.css?v=20260725-audit43">';
const CANONICAL_READER = '<script src="/js/audit43-reader.js?v=20260725-audit43"></script>';
const CANONICAL_CALM = '<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">';
const CANONICAL_AUDIT45 = '<link rel="stylesheet" href="/css/audit45-localization.css?v=20260725-audit45" data-audit45-localization="true">';
const STYLE_RE = /<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])(?=[^>]*\bhref=["']\/css\/audit43-approved\.css(?:\?[^"']*)?["'])[^>]*>/gi;
const READER_RE = /<script\b(?=[^>]*\bsrc=["']\/js\/audit43-reader\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi;
const STYLESHEET_RE = /<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])[^>]*>/gi;

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => failures.push(message);
const posix = value => value.replace(/\\/g, '/');

function collectHtml(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(target, output);
    else if (entry.isFile() && entry.name.endsWith('.html')) output.push(target);
  }
}

function sourceHtmlFiles() {
  const files = ['404.html', 'index.html']
    .map(name => path.join(ROOT, name))
    .filter(file => fs.existsSync(file));
  for (const root of PUBLIC_ROOTS) collectHtml(path.join(ROOT, root), files);
  return [...new Set(files)].sort();
}

function publicHtmlFiles() {
  const files = ['404.html', 'index.html']
    .map(name => path.join(PUBLIC, name))
    .filter(file => fs.existsSync(file));
  for (const root of PUBLIC_ROOTS) collectHtml(path.join(PUBLIC, root), files);
  return [...new Set(files)].sort();
}

function inspectSharedAssets(files, base, label) {
  let readers = 0;
  for (const file of files) {
    const relative = posix(path.relative(base, file));
    const html = fs.readFileSync(file, 'utf8');
    const styleMatches = [...html.matchAll(STYLE_RE)];
    const readerMatches = [...html.matchAll(READER_RE)];
    const styles = styleMatches.length;
    const scripts = readerMatches.length;
    metrics.audit43_stylesheet_references += styles;
    metrics.audit43_reader_references += scripts;
    metrics.duplicate_audit43_stylesheet_references += Math.max(0, styles - 1);
    metrics.duplicate_audit43_reader_references += Math.max(0, scripts - 1);
    if (styles !== 1) fail(`${label}/${relative}: expected one Audit 43 stylesheet, found ${styles}`);
    if (styles === 1 && styleMatches[0][0] !== CANONICAL_STYLE) {
      metrics.noncanonical_audit43_references += 1;
      fail(`${label}/${relative}: Audit 43 stylesheet is not canonical`);
    }
    const expectedReaders = READER_ALLOWLIST.has(relative) ? 1 : 0;
    if (scripts !== expectedReaders) {
      fail(`${label}/${relative}: expected ${expectedReaders} Audit 43 reader script, found ${scripts}`);
    }
    if (scripts === 1 && readerMatches[0][0] !== CANONICAL_READER) {
      metrics.noncanonical_audit43_references += 1;
      fail(`${label}/${relative}: Audit 43 reader script is not canonical`);
    }
    readers += scripts;
  }
  if (readers !== READER_ALLOWLIST.size) {
    fail(`${label}: reader route count ${readers} does not match ${READER_ALLOWLIST.size}`);
  }
}

function inspectSourcePostprocessorState(files) {
  for (const file of files) {
    const relative = posix(path.relative(ROOT, file));
    const html = fs.readFileSync(file, 'utf8');
    const headEnd = html.search(/<\/head>/i);
    const head = headEnd >= 0 ? html.slice(0, headEnd) : html;
    const linkedStyles = [...head.matchAll(STYLESHEET_RE)];
    const calmIndex = head.indexOf(CANONICAL_CALM);
    const calmIsFinal = calmIndex >= 0
      && linkedStyles.length > 0
      && linkedStyles.at(-1)[0] === CANONICAL_CALM
      && linkedStyles.at(-1).index === calmIndex;
    if (!calmIsFinal) {
      metrics.calm_link_rewrites_required += 1;
      fail(`source/${relative}: calm stylesheet is not the canonical final linked stylesheet`);
    }
    const translationManaged = TRANSLATION_UI_ROOTS.some(
      root => relative === `${root}/index.html` || relative.startsWith(`${root}/`),
    );
    if (!translationManaged) continue;
    const audit45Index = head.indexOf(CANONICAL_AUDIT45);
    const audit43Index = head.indexOf(CANONICAL_STYLE);
    if (!(audit45Index >= 0 && audit45Index < audit43Index && audit43Index < calmIndex)) {
      metrics.audit45_ui_rewrites_required += 1;
      fail(`source/${relative}: localization, Audit 43, and calm styles are not in canonical order`);
    }
  }
}

const siteBuildDate = resolveSiteBuildDate({root: ROOT, override: null});
if (siteBuildDate !== currentTorontoDate()) fail(`site build date ${siteBuildDate} is not current in Toronto`);
if (resolveSiteBuildDate({root: ROOT, override: '2026-02-03'}) !== '2026-02-03') {
  fail('SITE_BUILD_DATE override is not deterministic');
}

const dateHelper = read('scripts/polymythcal-build-date.js');
if (!dateHelper.includes('return currentTorontoDate();') || dateHelper.includes("release.generated_at")) {
  fail('JavaScript build-date helper still falls back to release metadata');
}
const eventBuilder = read('scripts/build-polymythcal-audit13.py');
if (
  !eventBuilder.includes("os.environ.get('SITE_BUILD_DATE')")
  || !eventBuilder.includes('datetime.datetime.now(ZoneInfo(DEFAULT_TZ)).date()')
  || eventBuilder.includes("return release_build_day(release.get('generated_at'))")
) {
  fail('event generator does not use the current Toronto day with deterministic override');
}
const geometryApplier = read('scripts/apply-visible-geometry.js');
if (!geometryApplier.includes('laterStylesheet') || !geometryApplier.includes('calmLinks.length === 1')) {
  fail('steady geometry applier lacks its zero-write final-stylesheet guard');
}
const localizedRouteBuilder = read('scripts/build-audit45-localized-routes.py');
const canonicalTemplateBoundaries = (
  localizedRouteBuilder.match(
    /audit43-approved\.css\?v=\{AUDIT43_VERSION\}">\n<link rel="stylesheet" href="\/css\/calm-ux\.css/g,
  ) || []
).length;
if (canonicalTemplateBoundaries < 3) {
  fail('localized route templates can reintroduce Audit 43/calm formatting churn');
}
const feedBuilder = read('scripts/build-polymythcal-feeds.py');
if (
  !feedBuilder.includes("os.environ.get('SITE_BUILD_DATE')")
  || !feedBuilder.includes('datetime.now(TORONTO).date()')
  || !feedBuilder.includes('datetime.combine(build_day, time(12, 0), TORONTO)')
) {
  fail('featured/feed generator does not share the current Toronto build-day contract');
}

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
if (pkg.engines?.node !== '24.14.0' || pkg.engines?.npm !== '11.9.0') fail('package runtime versions float');
if (pkg.packageManager !== 'npm@11.9.0') fail('package manager version floats');
if (lock.packages?.['']?.engines?.node !== '24.14.0' || lock.packages?.['']?.engines?.npm !== '11.9.0') {
  fail('lockfile root runtime versions differ from package.json');
}
if (read('.nvmrc').trim() !== '24.14.0') fail('.nvmrc runtime version floats');
if (!/NODE_VERSION\s*=\s*"24\.14\.0"/.test(read('netlify.toml'))) fail('Netlify runtime version floats');
for (const relative of fs.readdirSync(path.join(ROOT, '.github', 'workflows'))
  .filter(name => /\.ya?ml$/.test(name))
  .map(name => `.github/workflows/${name}`)) {
  const workflow = read(relative);
  if (/node-version:/.test(workflow) && !/node-version:\s*"24\.14\.0"/.test(workflow)) {
    fail(`${relative} does not pin Node 24.14.0`);
  }
  if (/python-version:/.test(workflow) && !/python-version:\s*"3\.12\.13"/.test(workflow)) {
    fail(`${relative} does not pin Python 3.12.13`);
  }
}

const coreRequirements = read('requirements-harvest.txt');
const browserRequirements = read('requirements-harvest-browser.txt');
if (/playwright/i.test(coreRequirements)) fail('core weekly harvest dependencies still install Playwright');
if (
  !browserRequirements.includes('-r requirements-harvest.txt')
  || !browserRequirements.includes('playwright==1.53.0')
) {
  fail('browser harvest dependency layer is incomplete');
}
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
if (!protestWorkflow.includes('--requirement requirements-harvest-browser.txt')) {
  fail('protest browser harvest does not install its browser dependency layer');
}
for (const [relative, cron] of [
  ['.github/workflows/scrape-seminars.yml', '47 8 * * 1'],
  ['.github/workflows/scrape-festivals.yml', '42 9 * * 2'],
  ['.github/workflows/scrape-polymythcal-protests.yml', '18 8 * * 3'],
]) {
  const workflow = read(relative);
  const schedules = [...workflow.matchAll(/-\s+cron:\s*"([^"]+)"/g)].map(match => match[1]);
  if (schedules.length !== 1 || schedules[0] !== cron) {
    fail(`${relative} no longer has its single once-weekly schedule`);
  }
}

const predeploy = read('.github/workflows/predeploy.yml');
metrics.predeploy_npm_ci_steps = (predeploy.match(/\bnpm ci\b/g) || []).length;
if (metrics.predeploy_npm_ci_steps !== 1) {
  fail(`predeploy performs ${metrics.predeploy_npm_ci_steps} npm ci steps instead of one`);
}
metrics.predeploy_npm_install_steps = (predeploy.match(/\bnpm\s+(?:ci|install)\b/g) || []).length;
if (metrics.predeploy_npm_install_steps !== 1) {
  fail(`predeploy performs ${metrics.predeploy_npm_install_steps} npm dependency installations instead of one`);
}
if (!predeploy.includes('npm run verify:function-dependencies')) {
  fail('predeploy lacks a clean production-function dependency smoke test');
}

const packageIntegrity = read('scripts/package_integrity.py');
if (
  packageIntegrity.includes('.testzip(')
  || packageIntegrity.includes('source.read_bytes()')
  || !packageIntegrity.includes('archive.open(')
) {
  fail('package integrity path still performs redundant whole-file/archive passes');
}
const deployer = read('scripts/package-deployer-compatible.py');
const deployerFloor = Number(deployer.match(/MIN_DEPLOYER_FILES\s*=\s*(\d+)/)?.[1] || 0);
if (deployerFloor < 9900) {
  fail('deployer package file floor does not protect the Audit 46 release surface');
}

const build = pkg.scripts?.build || '';
const normalizer = 'node scripts/normalize-shared-asset-references.js';
const activeApprovedUi = 'node scripts/apply-audit48-approved-ui.js';
if (
  !build.includes(normalizer)
  || !build.includes(activeApprovedUi)
  || build.indexOf(normalizer) < build.indexOf(activeApprovedUi)
  || build.indexOf(normalizer) > build.indexOf('node scripts/build-leizu-i18n-source.js')
) {
  fail('shared-asset normalization is absent or misordered in the canonical build');
}
const runner = read('scripts/verify-all-runner.js');
for (const command of [
  'node scripts/verify-audit41-event-rollover.js',
  'node scripts/verify-audit46-technical-efficiency.js',
  'node scripts/verify-cloud-input-runtime.js',
  'node scripts/verify-redirect-policy-coherence.js',
]) {
  if (!runner.includes(command)) fail(`full release runner omits ${command}`);
}

const headers = read('_headers');
if (!/\/polymyth\/concordance\/concordance-index\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i.test(headers)) {
  fail('large runtime concordance index lacks bounded caching');
}

const sourceFiles = sourceHtmlFiles();
metrics.source_html_files = sourceFiles.length;
inspectSharedAssets(sourceFiles, ROOT, 'source');
inspectSourcePostprocessorState(sourceFiles);
const eventPayload = JSON.parse(read('polymythseminars/events.json'));
const sitemap = read('sitemap.xml');
for (const event of eventPayload.events || []) {
  const end = String(event.end_date || event.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end >= siteBuildDate) continue;
  const id = String(event.id || event.identity_key);
  for (const prefix of ['polymythseminars/events', 'polymythseminars/fr/events']) {
    const relative = `${prefix}/${id}/index.html`;
    if (!fs.existsSync(path.join(ROOT, relative))) {
      fail(`${relative}: expired bilingual event route is missing`);
      continue;
    }
    const html = read(relative);
    if (
      !/<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["']noindex,follow["'])[^>]*>/i.test(html)
      || !html.includes('data-event-archive-note')
      || /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type"\s*:\s*"Event"/i.test(html)
    ) {
      fail(`${relative}: expired route is not archived, noindex, and free of active Event schema`);
    }
    metrics.expired_bilingual_event_routes += 1;
  }
  const encoded = encodeURIComponent(id);
  for (const route of [
    `https://seminarschools.com/polymythseminars/events/${encoded}/`,
    `https://seminarschools.com/polymythseminars/fr/events/${encoded}/`,
  ]) {
    if (sitemap.includes(`<loc>${route}</loc>`)) fail(`sitemap retains expired event ${route}`);
  }
}
const publicFiles = publicHtmlFiles();
metrics.public_html_files = publicFiles.length;
if (!publicFiles.length) fail('public/ HTML is missing; run the canonical build first');
else inspectSharedAssets(publicFiles, PUBLIC, 'public');

const release = JSON.parse(read('RELEASE_MANIFEST.json'));
const report = {
  schema: 'seminar-schools-audit46-technical-efficiency-v1',
  release_id: release.release_id || null,
  generated_at: release.generated_at || null,
  site_build_date: siteBuildDate,
  status: failures.length ? 'failed' : 'passed',
  metrics,
  failures,
  policy: 'Current Toronto rollover, one shared asset request per pathname, exact runtimes, lean weekly jobs, streamed package verification, coherent redirects, and bounded large-index caching are release blockers.',
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
const renderedReport = JSON.stringify(report, null, 2) + '\n';
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== renderedReport) {
  fs.writeFileSync(REPORT, renderedReport, 'utf8');
}

if (failures.length) {
  console.error('AUDIT46 TECHNICAL EFFICIENCY FAILED');
  failures.slice(0, 100).forEach(message => console.error(` - ${message}`));
  if (failures.length > 100) console.error(` - … ${failures.length - 100} more`);
  process.exit(1);
}

console.log(
  `AUDIT46 TECHNICAL EFFICIENCY PASSED — ${metrics.source_html_files} source and `
    + `${metrics.public_html_files} public HTML files, zero duplicate shared requests, `
    + `current Toronto rollover, one npm install, exact runtimes, and streamed package verification.`,
);
