#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'saul', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const errors = [];
const required = [
  'data-cv-purpose="general-employment"',
  'class="cv-intro"',
  'id="careerArchive"',
  'Modular CV · employment profile · project archive',
  'A flexible CV for many kinds of work.',
  'CV builder',
  'Select the version you need',
  'data-quick-view="all"',
  'data-quick-view="service"',
  'data-quick-view="teaching"',
  'data-quick-view="portfolio"',
  'data-cv-mode="chrono"',
  'data-cv-mode="theme"',
  'class="archive-tools cv-module-tabs" open',
  'id="moduleStatus"',
  'CV modules — PDF follows active modules',
  'Select any combination, then use Save as PDF. The PDF exports exactly the active modules.',
  'data-cat="kitchen">Culinary Hospitality</button>',
  'data-cat="teaching">Teaching</button>',
  'data-cat="community">Community</button>',
  'data-cat="education">Education</button>',
  'data-cat="volunteer">Volunteer</button>',
  'data-cat="performance">Performance</button>',
  'data-cat="seminarschools">Portfolio</button>',
  'const CAT_ALIASES',
  "portfolio: 'seminarschools'",
  "culinary: 'kitchen'",
  "theatre: 'performance'",
  "const CAT_SLUGS = { seminarschools: 'portfolio' }",
  'Modular CV tabs are additive',
  'const next = new Set(active);',
  'active = next;',
  'buildPrintCv();',
  'window.print();',
  'class="cv-portrait-card"',
  'src="/img/saul.jpg"',
  'class="cv-map-section"',
  'google.com/maps/d/embed?mid=1n92i0SyhgddNp4TZjLFW8GW6Nzk9JH1B',
  'Saul Karim Nassau <span class="post">MA</span>',
  'body:not(.party) { --geo-density: 0.025 !important; }',
  'data-saul-modular-cv="true"',
  'function renderProfile()',
  'renderProfile();',
  'summaryRaw = pickL(SUMMARY_BY_CAT[activeCats[0]])'
];
for (const token of required) if (!html.includes(token)) errors.push(`Missing required Saul page element: ${token}`);

const banned = [
  'Three ways to begin',
  'href="/leizu/intake/"',
  'data-quick-view="current"',
  'Category tabs behave like CV versions: one selected tab = one printable CV.',
  'active = wasOnly ? new Set() : new Set([cat]);',
  'Teaching, curriculum, and public learning.',
  'Saul Karim Nassau,<span class="post">MA</span>',
  'data-cat="seminarschools">Seminar Schools</button>'
];
for (const token of banned) if (html.includes(token)) errors.push(`Backtracked/strawman Saul page element remains: ${token}`);

const introEnd = html.indexOf('<section class="archive-shell"', html.indexOf('class="cv-intro"'));
const filters = html.indexOf('id="filterNav"');
if (introEnd < 0 || filters < 0 || filters < introEnd) errors.push('Detailed filters appear before the professional front page/archive boundary.');

if (!/function buildPrintCv\(\)[\s\S]*activeCats\.length === 1[\s\S]*SUMMARY_BY_CAT/.test(html)) {
  errors.push('PDF builder no longer routes summary copy by selected CV module.');
}
if (!/D\.filter\(function\(x\)\{[\s\S]*tagMatches\(active, x\[2\]\)/.test(html)) {
  errors.push('PDF builder no longer filters entries by active CV module.');
}
if (!/document\.getElementById\("saveBtn"\)\.addEventListener\("click"[\s\S]*buildPrintCv\(\);[\s\S]*window\.print\(\);/.test(html)) {
  errors.push('Save as PDF no longer builds the current filtered CV before printing.');
}

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[0].includes('application/ld+json') ? null : m[1])
  .filter(Boolean);
const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'saul-js-'));
try {
  scripts.forEach((code, i) => {
    const temp = path.join(tmpDir, `script-${i}.js`);
    fs.writeFileSync(temp, code);
    execFileSync(process.execPath, ['--check', temp], { stdio: 'pipe' });
  });
} catch (err) {
  errors.push(`Inline JavaScript parse failure: ${String(err.stderr || err.message)}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (errors.length) {
  console.error('Saul page guard failed:');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log('Saul page guard passed — any-job modular CV, additive modules, website-only portrait/map, and no teaching-front regression.');
