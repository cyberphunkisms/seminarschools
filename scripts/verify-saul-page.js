#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'saul', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const errors = [];
const required = [
  'id="careerArchive"',
  'data-cv-mode="chrono"',
  'data-cv-mode="theme"',
  'class="archive-tools cv-module-tabs" open',
  'id="filterNav"',
  'id="moduleStatus"',
  'Choose CV sections',
  'Select one area or combine several. The PDF follows your selection.',
  'Saul Karim Nassau,<span class="post">MA</span>',
  'Black-and-white portrait of Saul Nassau',
  'data-saul-modular-cv="true"',
  'SAUL_CV_FOCUSED_RELEASE',
  'buildPrintCv();',
  'window.print();',
  'if (active.has(cat)) active.delete(cat);',
  'else active.add(cat);',
  'summaryRaw = pickL(SUMMARY_BY_CAT[activeCats[0]])'
];
for (const token of required) if (!html.includes(token)) errors.push(`Missing required Saul page element: ${token}`);

for (const lang of ['en:', 'zh:', 'zhs:', 'fa:', 'fr:']) {
  const start = html.indexOf(`  ${lang}`, html.indexOf('const SAUL_PROFILE_COPY'));
  if (start < 0) errors.push(`Profile copy missing ${lang}`);
}

const introEnd = html.indexOf('<section class="archive-shell"', html.indexOf('class="cv-intro"'));
const filters = html.indexOf('id="filterNav"');
if (!html.includes('SAUL_CV_FOCUSED_RELEASE')) errors.push('Saul page is not marked as the focused CV release.');

if (html.includes('Saul Karim NMH,<span class="post">MA</span>')) errors.push('Legacy NMH header remains visible.');

const moduleTabTokens = [
  'data-cat="all" class="on" id="allBtn">Full CV</button>',
  'data-cat="kitchen">Culinary Hospitality</button>',
  'data-cat="teaching">Teaching</button>',
  'data-cat="community">Community</button>',
  'data-cat="education">Education</button>',
  'data-cat="volunteer">Volunteer</button>',
  'data-cat="performance">Performance</button>',
  'data-cat="seminarschools">Seminar Schools</button>'
];
for (const token of moduleTabTokens) if (!html.includes(token)) errors.push(`Missing visible CV module tab: ${token}`);

if (html.includes('CV module tabs') || html.includes('PDF follows active tabs') || html.includes('Choose one module') || html.includes('Three ways to begin')) {
  errors.push('Saul page still contains confusing or non-CV front-page language.');
}
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
console.log('Saul page guard passed.');
process.exit(0);
