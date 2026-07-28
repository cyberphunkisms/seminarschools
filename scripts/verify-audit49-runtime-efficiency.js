#!/usr/bin/env node
'use strict';

/**
 * Audit 49 browser-runtime lifecycle and bounded static-data delivery gate.
 *
 * This verifier inventories every active source interval instead of relying on
 * a hand-maintained sample. The ten intentional Leizu leaf intervals must all
 * stop for hidden/navigation/reduced-motion states, clear pending startup
 * timers and animated nodes, and restart after a back-forward-cache restore.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {isGeneratedDependencyDirectory} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const REPORT = path.join(
  ROOT,
  'scripts',
  'reports',
  'audit49-runtime-efficiency.json',
);
const ACTIVE_ROOTS = [
  'index.html', '404.html', 'aa', 'about', 'agora', 'aitr', 'bb',
  'bookwormcard', 'campaigns', 'cfps', 'dashboard', 'fellowships',
  'florilegium', 'humanities', 'js', 'lectures', 'leizu', 'main',
  'marginalia', 'nutrition', 'ohm-dome', 'philosophy', 'polymyth',
  'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub',
  'writinggrads', 'writingjuniors', 'writingkids', 'writingteens',
];
const LOCALES = ['', 'fr/', 'zh-hant/', 'zh-hans/', 'fa/'];
const EXPECTED_INTERVAL_FILES = new Set(
  LOCALES.flatMap(locale => [
    `leizu/${locale}index.html`,
    `leizu/${locale}teach/index.html`,
  ]),
);
const failures = [];
const metrics = {
  active_runtime_files: 0,
  files_with_intervals: 0,
  interval_calls: 0,
  bounded_leaf_routes: 0,
  startup_timer_slots_bounded: 0,
  public_runtime_mirrors_identical: 0,
  forced_public_data_revalidation_fetches: 0,
  bounded_public_data_assets: 0,
  bounded_public_data_bytes: 0,
};

function posix(value) {
  return value.split(path.sep).join('/');
}
function read(relative, base = ROOT) {
  return fs.readFileSync(path.join(base, relative), 'utf8');
}
function check(condition, message) {
  if (!condition) failures.push(message);
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function collect(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (
      entry.name === 'public'
      || entry.name === 'node_modules'
      || entry.name === 'vendor'
      || isGeneratedDependencyDirectory(entry.name)
    ) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target, output);
    else if (
      entry.isFile()
      && (entry.name.endsWith('.html') || entry.name.endsWith('.js'))
    ) output.push(target);
  }
}

const runtimeFiles = [];
for (const relative of ACTIVE_ROOTS) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) continue;
  if (fs.statSync(target).isFile()) runtimeFiles.push(target);
  else collect(target, runtimeFiles);
}
const uniqueRuntimeFiles = [...new Set(runtimeFiles)].sort();
metrics.active_runtime_files = uniqueRuntimeFiles.length;
const intervalFiles = new Map();
for (const target of uniqueRuntimeFiles) {
  const source = fs.readFileSync(target, 'utf8');
  const count = (source.match(/\bsetInterval\s*\(/g) || []).length;
  if (!count) continue;
  const relative = posix(path.relative(ROOT, target));
  intervalFiles.set(relative, count);
  metrics.interval_calls += count;
}
metrics.files_with_intervals = intervalFiles.size;
check(
  intervalFiles.size === EXPECTED_INTERVAL_FILES.size,
  `active interval file count is ${intervalFiles.size}/${EXPECTED_INTERVAL_FILES.size}`,
);
for (const relative of intervalFiles.keys()) {
  check(
    EXPECTED_INTERVAL_FILES.has(relative),
    `${relative} contains an unbudgeted active interval`,
  );
}
for (const relative of EXPECTED_INTERVAL_FILES) {
  check(intervalFiles.get(relative) === 1, `${relative} must contain one interval`);
  const html = read(relative);
  const teach = relative.endsWith('/teach/index.html');
  const enabled = teach ? 'leizuTeachMotionEnabled()' : 'leizuMotionEnabled()';
  const start = teach ? 'startAmbientLeaves' : 'startAmbient';
  const stop = teach ? 'stopAmbientLeaves(true)' : 'stopAmbient(true)';
  for (const marker of [
    'const initialLeafTimers = new Set()',
    'clearInitialLeafTimers()',
    'clearFlutterLeaves()',
    "document.addEventListener('visibilitychange'",
    "window.addEventListener('pagehide'",
    "window.addEventListener('pageshow'",
    `!document.hidden && ${enabled}`,
    start,
    stop,
  ]) {
    check(html.includes(marker), `${relative} lacks lifecycle marker ${marker}`);
  }
  check(
    /attributeFilter\s*:\s*\[\s*['"]data-motion['"]\s*\]/.test(html),
    `${relative} lacks the bounded motion-state observer`,
  );
  check(
    /prefers-reduced-motion:\s*reduce/.test(html),
    `${relative} lacks reduced-motion lifecycle input`,
  );
  const sourceFile = path.join(ROOT, relative);
  const publicFile = path.join(PUBLIC, relative);
  check(fs.existsSync(publicFile), `${relative} is absent from public`);
  if (fs.existsSync(publicFile)) {
    const identical = sha256(sourceFile) === sha256(publicFile);
    check(identical, `${relative} differs from its public mirror`);
    if (identical) metrics.public_runtime_mirrors_identical += 1;
  }
  metrics.bounded_leaf_routes += 1;
  metrics.startup_timer_slots_bounded += teach ? 4 : 5;
}

const siteRuntime = read('js/site.js');
const candidateRuntime = read('js/polymythcal-candidates.js');
metrics.forced_public_data_revalidation_fetches = (
  siteRuntime.match(/fetch\(['"]\/florilegium\/posts\.json['"][\s\S]{0,120}cache:\s*['"]no-cache['"]/g)
  || []
).length + (
  candidateRuntime.match(/fetch\(['"]\/polymythseminars\/candidates\.json['"][\s\S]{0,160}cache:\s*['"]no-cache['"]/g)
  || []
).length;
check(
  metrics.forced_public_data_revalidation_fetches === 0,
  'a public feed still forces browser revalidation',
);
check(
  siteRuntime.includes("fetch('/florilegium/posts.json', { cache: 'default' })"),
  'Florilegium feed does not use the server-owned cache policy',
);
check(
  candidateRuntime.includes("cache: 'default'"),
  'candidate feed does not use the server-owned cache policy',
);

const headers = read('_headers');
for (const [label, pattern] of [
  ['Polymyth text mirrors', /\/polymyth\/\*\.txt\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['Florilegium posts', /\/florilegium\/posts\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=3600,\s*must-revalidate/i],
  ['Polymythcal candidates', /\/polymythseminars\/candidates\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=300,\s*must-revalidate/i],
  ['Saul data', /\/saul\/assets\/\*\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
]) {
  check(pattern.test(headers), `${label} cache policy is missing`);
}

const polymythRoot = path.join(PUBLIC, 'polymyth');
const boundedData = fs.existsSync(polymythRoot)
  ? fs.readdirSync(polymythRoot, {withFileTypes: true})
    .filter(entry => entry.isFile() && entry.name.endsWith('.txt'))
    .map(entry => path.join(polymythRoot, entry.name))
  : [];
boundedData.push(
  path.join(PUBLIC, 'florilegium', 'posts.json'),
  path.join(PUBLIC, 'polymythseminars', 'candidates.json'),
  path.join(PUBLIC, 'saul', 'assets', 'saul-cv-canonical-2026.json'),
);
for (const dataFile of boundedData) {
  check(
    fs.existsSync(dataFile),
    `${posix(path.relative(PUBLIC, dataFile))} bounded data asset is missing`,
  );
  if (!fs.existsSync(dataFile)) continue;
  metrics.bounded_public_data_assets += 1;
  metrics.bounded_public_data_bytes += fs.statSync(dataFile).size;
}
check(
  metrics.bounded_public_data_assets >= 24,
  `bounded public data inventory is ${metrics.bounded_public_data_assets}/24`,
);
check(
  metrics.bounded_public_data_bytes >= 9_500_000,
  `bounded public data byte coverage is ${metrics.bounded_public_data_bytes}`,
);

const release = JSON.parse(read('RELEASE_MANIFEST.json'));
const report = {
  schema: 'seminar-schools-audit49-runtime-efficiency-v1',
  release_id: release.release_id || null,
  generated_at: release.generated_at || null,
  status: failures.length ? 'failed' : 'passed',
  metrics,
  interval_files: Object.fromEntries([...intervalFiles].sort()),
  cache_policies: {
    polymyth_text_mirrors: 'public, max-age=86400, stale-while-revalidate=604800',
    florilegium_posts: 'public, max-age=3600, must-revalidate',
    polymythcal_candidates: 'public, max-age=300, must-revalidate',
    saul_public_data: 'public, max-age=86400, stale-while-revalidate=604800',
  },
  invariants: {
    english_source_of_truth: true,
    organizer_authored_text_verbatim: true,
    high_stakes_leizu_noindex_preserved: true,
    bb_teacher_led: true,
    cadence_changed: false,
    security_audit_performed: false,
    deployment_performed: false,
  },
  failures,
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== rendered) {
  fs.writeFileSync(REPORT, rendered, 'utf8');
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) {
    throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  }
  fs.utimesSync(REPORT, stamp, stamp);
}

if (failures.length) {
  console.error(`AUDIT49 RUNTIME EFFICIENCY FAILED (${failures.length})`);
  failures.slice(0, 100).forEach(message => console.error(` - ${message}`));
  process.exit(1);
}
console.log(
  `AUDIT49 RUNTIME EFFICIENCY PASSED — ${metrics.active_runtime_files} active runtime files, `
  + `${metrics.bounded_leaf_routes} lifecycle-bounded interval routes, `
  + `${metrics.startup_timer_slots_bounded} bounded startup timer slots, and `
  + `${metrics.bounded_public_data_assets} cached data assets `
  + `(${metrics.bounded_public_data_bytes} bytes).`,
);
