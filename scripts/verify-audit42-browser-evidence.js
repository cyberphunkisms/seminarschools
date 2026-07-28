#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = '2026-07-25-site-audit42-ledger-closure-multimode-final';
const REPORT_PATH = path.join(
  ROOT,
  'data',
  'audit42-multimode-browser',
  'multimode-browser-audit.json',
);
const SCREENSHOT_DIR = path.join(
  ROOT,
  'data',
  'audit42-multimode-browser',
  'screenshots',
);
const BROWSER_PROGRAM = path.join(ROOT, 'scripts', 'audit42-multimode-browser.py');
const failures = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(ROOT, file)} is missing or invalid: ${error.message}`);
    return {};
  }
}

const release = readJson(path.join(ROOT, 'RELEASE_MANIFEST.json'));
const report = readJson(REPORT_PATH);
if (release.release_id !== RELEASE_ID) failures.push('release manifest is not Audit 42');
if (report.audit !== 42 || report.release_id !== RELEASE_ID) {
  failures.push('multimode report is not Audit 42');
}
if (report.generated_at !== release.generated_at) {
  failures.push('multimode report does not reference the release timestamp');
}
if (report.engine !== 'Chromium' || !String(report.browser || '').startsWith('Chromium')) {
  failures.push('multimode report did not execute in Chromium');
}
let browserProgramSha256 = '';
try {
  browserProgramSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(BROWSER_PROGRAM))
    .digest('hex');
} catch (error) {
  failures.push(`browser audit program is missing or unreadable: ${error.message}`);
}
if (!/^[0-9a-f]{64}$/.test(String(report.browser_program_sha256 || ''))
    || report.browser_program_sha256 !== browserProgramSha256) {
  failures.push('multimode evidence is not bound to the current browser audit program');
}
const executedAt = Date.parse(report.executed_at || '');
const releaseAt = Date.parse(release.generated_at || '');
const age = Date.now() - executedAt;
if (!Number.isFinite(executedAt) || age > 4 * 60 * 60 * 1000 || age < -5 * 60 * 1000) {
  failures.push('multimode evidence is not fresh');
}
if (Number.isFinite(executedAt) && Number.isFinite(releaseAt)
    && executedAt + 5 * 60 * 1000 < releaseAt) {
  failures.push('multimode evidence predates the release');
}
if (!Number.isInteger(report.checks_total) || report.checks_total < 367) {
  failures.push(`multimode report has only ${report.checks_total || 0} checks`);
}
if (report.checks_passed !== report.checks_total || report.checks_failed !== 0) {
  failures.push(
    `multimode report is ${report.checks_passed}/${report.checks_total} with `
      + `${report.checks_failed} failures`,
  );
}
if (!Array.isArray(report.results) || report.results.length !== report.checks_total) {
  failures.push('multimode result rows do not match the check count');
} else if (report.results.some(row => row?.passed !== true)) {
  failures.push('multimode result rows contain a failure');
}
if (Array.isArray(report.results)) {
  const qrNames = new Set(
    report.results
      .map(row => String(row?.name || ''))
      .filter(name => name.startsWith('QR ')),
  );
  const expectedQrNames = new Set();
  for (const mode of ['desktop', 'foldable-landscape', 'mobile']) {
    for (const label of [
      'thank-you-mam',
      'thank-you-mam-pregame',
      'bookwormburrows',
      'campaigncodex',
      'polymythdnd',
    ]) {
      for (const assertion of [
        'HTTP success and canonical destination',
        'in-flow control remains visible and operable',
        'fixed controls do not cover the QR',
      ]) {
        expectedQrNames.add(`QR ${mode} ${label}: ${assertion}`);
      }
    }
  }
  if (qrNames.size !== expectedQrNames.size
      || [...expectedQrNames].some(name => !qrNames.has(name))) {
    failures.push(
      `multimode report has ${qrNames.size}/${expectedQrNames.size} exact QR assertions`,
    );
  }

  const longSessionNames = new Set(
    report.results
      .map(row => String(row?.name || ''))
      .filter(name => name.startsWith('long-session ')),
  );
  const expectedLongSessionNames = new Set();
  for (const label of ['home', 'polymythcal', 'teacher-resources']) {
    for (const assertion of [
      'HTTP success',
      'repeated theme toggles settle coherently',
      'filter and history cycles settle coherently',
      'no page or local request failures',
      'JS heap growth budget',
      'DOM node growth budget',
      'document growth budget',
      'event-listener growth budget',
    ]) {
      expectedLongSessionNames.add(`long-session ${label}: ${assertion}`);
    }
  }
  if (longSessionNames.size !== expectedLongSessionNames.size
      || [...expectedLongSessionNames].some(name => !longSessionNames.has(name))) {
    failures.push(
      `multimode report has ${longSessionNames.size}/`
        + `${expectedLongSessionNames.size} exact long-session assertions`,
    );
  }
}
if (!Array.isArray(report.metrics) || report.metrics.length !== 26) {
  failures.push(`multimode report has ${report.metrics?.length || 0}/26 viewport metrics`);
} else {
  const cases = new Set(report.metrics.map(
    row => `${row.mode || ''}\0${row.label || ''}`,
  ));
  if (cases.size !== 26) failures.push('multimode viewport metrics are duplicated or missing');
  for (const mode of ['ultrawide', 'foldable-landscape']) {
    for (const label of [
      'home',
      'polymythcal',
      'teacher-resources',
      'bb',
      'bookwormcard',
      'leizu',
      'saul',
      'aa',
      'aitr',
      'campaigncodex',
      'methodology',
      'thank-you-mam',
      'thank-you-mam-pregame',
    ]) {
      if (!cases.has(`${mode}\0${label}`)) failures.push(`${mode} omits ${label}`);
    }
  }
  for (const row of report.metrics) {
    if (row.h1Visible !== 1) failures.push(`${row.mode} ${row.label} visible H1 changed`);
    if (Number(row.overflow || 0) > 1) failures.push(`${row.mode} ${row.label} overflows`);
    if (Array.isArray(row.fixedCollisions) && row.fixedCollisions.length) {
      failures.push(`${row.mode} ${row.label} has fixed-control collisions`);
    }
  }
}
if (!Array.isArray(report.cpu_metrics) || report.cpu_metrics.length !== 5) {
  failures.push(`multimode report has ${report.cpu_metrics?.length || 0}/5 CPU metrics`);
} else {
  const expectedCpuLabels = new Set([
    'home',
    'polymythcal',
    'teacher-resources',
    'bookwormcard',
    'methodology',
  ]);
  const cpuLabels = new Set(report.cpu_metrics.map(row => String(row?.label || '')));
  if (cpuLabels.size !== expectedCpuLabels.size
      || [...expectedCpuLabels].some(label => !cpuLabels.has(label))) {
    failures.push('multimode CPU traces are duplicated or omit a required route');
  }
  for (const row of report.cpu_metrics) {
    if (row.cpu_throttle_rate !== 4) {
      failures.push(`${row.label || 'unknown'} CPU trace did not use 4x throttling`);
    }
    if (Number(row.ready_ms || 0) > 15_000
        || Number(row.interaction_ms || 0) > 5_000
        || Number(row.max_long_task_ms || 0) > 2_500) {
      failures.push(`${row.label || 'unknown'} CPU trace exceeds its release budget`);
    }
  }
}

const longSessionBudgetContract = {
  home: {
    route: '/',
    js_heap_used_bytes: 8 * 1024 * 1024,
    dom_nodes: 100,
    documents: 1,
    event_listeners: 16,
    theme_control: 'audit-delegation-probe',
  },
  polymythcal: {
    route: '/polymythseminars/',
    js_heap_used_bytes: 32 * 1024 * 1024,
    dom_nodes: 1000,
    documents: 1,
    event_listeners: 32,
    theme_control: 'native',
  },
  'teacher-resources': {
    route: '/teacherresources/',
    js_heap_used_bytes: 24 * 1024 * 1024,
    dom_nodes: 500,
    documents: 1,
    event_listeners: 32,
    theme_control: 'audit-delegation-probe',
  },
};
if (!Array.isArray(report.long_session_metrics)
    || report.long_session_metrics.length !== 3) {
  failures.push(
    `multimode report has ${report.long_session_metrics?.length || 0}/3 `
      + 'long-session metric rows',
  );
} else {
  const labels = new Set(report.long_session_metrics.map(
    row => String(row?.label || ''),
  ));
  if (labels.size !== 3
      || Object.keys(longSessionBudgetContract).some(label => !labels.has(label))) {
    failures.push('long-session metrics are duplicated or omit a required route');
  }
  const metricKeys = [
    'js_heap_used_bytes',
    'dom_nodes',
    'documents',
    'event_listeners',
  ];
  for (const row of report.long_session_metrics) {
    const expected = longSessionBudgetContract[row.label];
    if (!expected) continue;
    if (row.route !== expected.route
        || row.theme_iterations !== 50
        || row.state_history_iterations !== 30
        || row.warmup_iterations !== 2
        || row.theme_control !== expected.theme_control) {
      failures.push(`${row.label} long-session execution contract changed`);
    }
    if (row.gc_before !== true || row.gc_after !== true) {
      failures.push(`${row.label} long-session trace did not collect CDP garbage`);
    }
    for (const key of metricKeys) {
      const before = row.before?.[key];
      const after = row.after?.[key];
      const delta = row.delta?.[key];
      const budget = row.budgets?.[key];
      if (![before, after, delta, budget].every(Number.isInteger)) {
        failures.push(`${row.label} long-session ${key} metric is incomplete`);
        continue;
      }
      if (delta !== after - before) {
        failures.push(`${row.label} long-session ${key} delta is inconsistent`);
      }
      if (budget !== expected[key]) {
        failures.push(`${row.label} long-session ${key} budget was weakened`);
      }
      if (delta > budget) {
        failures.push(`${row.label} long-session ${key} exceeds its release budget`);
      }
    }
  }
}

const coverage = Array.isArray(report.coverage) ? report.coverage.join('\n') : '';
for (const token of [
  'ultrawide and foldable-like',
  'WCAG text-spacing',
  'reduced transparency',
  'complete filtered-calendar print',
  'preference persistence',
  'shortcut collision',
  'no-JavaScript semantic extraction',
  'injected extension-interference',
  'grayscale state',
  'five-route QR overlay collision',
  '4x low-end mobile CPU',
  'long-session theme/filter/history',
  'standalone manifest rotation',
]) {
  if (!coverage.includes(token)) failures.push(`coverage disclosure omits ${token}`);
}
const limits = Array.isArray(report.environment_limits)
  ? report.environment_limits.join('\n')
  : '';
for (const token of [
  'Firefox',
  'Safari/WebKit',
  'VoiceOver',
  'NVDA',
  'extensions',
  'voice control',
  'foldable',
  'battery',
]) {
  if (!limits.includes(token)) failures.push(`environment limits omit ${token}`);
}

let screenshots = [];
try {
  screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(name => /\.png$/i.test(name));
} catch (error) {
  failures.push(`screenshot directory is missing: ${error.message}`);
}
if (screenshots.length < 20 || report.screenshots !== screenshots.length) {
  failures.push(
    `multimode screenshot evidence is ${screenshots.length}; report says `
      + `${report.screenshots || 0}; expected at least 20`,
  );
}
for (const name of [
  'ultrawide-home.png',
  'foldable-landscape-polymythcal.png',
  'text-spacing-teacher-resources.png',
  'reduced-transparency-home.png',
  'print-polymythcal.png',
  'grayscale-polymythcal.png',
]) {
  if (!screenshots.includes(name)) failures.push(`screenshot evidence omits ${name}`);
}

if (failures.length) {
  console.error('AUDIT 42 BROWSER EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(
  `AUDIT 42 BROWSER EVIDENCE PASSED — ${report.checks_total} multimode Chromium `
    + `assertions and ${screenshots.length} screenshots are current and complete.`,
);
