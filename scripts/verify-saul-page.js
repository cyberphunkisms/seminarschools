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
  'Curriculum vitae',
  'Education, research, community development, arts, service, and independent project work.',
  'Focus areas',
  'Relevant experience',
  'data-quick-view="all"',
  'data-quick-view="evaluation"',
  'data-quick-view="teaching"',
  'data-quick-view="programs"',
  'data-quick-view="customer"',
  'data-quick-view="arts"',
  'data-quick-view="service"',
  'data-quick-view="portfolio"',
  'data-cv-mode="chrono"',
  'data-cv-mode="theme"',
  'class="archive-tools cv-module-tabs"',
  'id="moduleStatus"',
  'Focus filters',
  'Choose one or more areas before downloading.',
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
  'const next = new Set(active);',
  'active = next;',
  'buildPrintCv();',
  'window.print();',
  'class="cv-portrait-card"',
  'src="/img/saul.jpg"',
  'class="cv-map-section"',
  'google.com/maps/d/embed?mid=1n92i0SyhgddNp4TZjLFW8GW6Nzk9JH1B',
  'Saul Karim Nassau <span class="post">MA</span>',
  'data-saul-modular-cv="true"',
  'function renderProfile()',
  'renderProfile();',
  'CV_OUTPUT_REVAMP_2026_07_09',
  'fitPrintCvToOnePage(host)',
  'PRINT_FOCUS',
  'The experience, methods, education, professional development, and downloadable PDF follow the selected focus areas.',
  'CV_610_SYNTHESIS_2026_07_11',
  'const QUICK_VIEW_SETS',
  'const CV_METHODS_ALL',
  'const CV_LANGUAGES'
];
for (const token of required) if (!html.includes(token)) errors.push(`Missing required Saul page element: ${token}`);

const banned = [
  'CV builder',
  'Select the version you need',
  'Modular CV · employment profile · project archive',
  'CV modules — PDF follows active modules',
  'PDF follows active modules',
  'Build modular CV',
  'Save selected CV',
  'World map',
  'Three ways to begin',
  'href="/leizu/intake/"',
  'data-quick-view="current"',
  'Category tabs behave like CV versions: one selected tab = one printable CV.',
  'active = wasOnly ? new Set() : new Set([cat]);',
  'Teaching, curriculum, and public learning.',
  'Saul Karim Nassau,<span class="post">MA</span>',
  'data-cat="seminarschools">Seminar Schools</button>',
  'PhD Candidate',
  'Doctorant en',
  'نامزد دکتر',
  '博士候選人',
  '博士候选人',
  '1,000+',
  'Mentored 1,000',
  'References available on request',
  'advanced doctoral work',
  'umbrella practice that holds'
];
for (const token of banned) if (html.includes(token)) errors.push(`Backtracked/strawman Saul page element remains: ${token}`);

const introEnd = html.indexOf('<section class="archive-shell"', html.indexOf('class="cv-intro"'));
const filters = html.indexOf('id="filterNav"');
if (introEnd < 0 || filters < 0 || filters < introEnd) errors.push('Detailed filters appear before the professional front page/archive boundary.');

if (!/function buildPrintCv\(\)[\s\S]*activeCats\.length[\s\S]*PRINT_FOCUS[\s\S]*focusSummary/.test(html)) {
  errors.push('PDF builder no longer routes top profile copy by selected CV module.');
}
if (!/var itemMatches = function \(item\)[\s\S]*activeCats\.some\(function\(c\)\{ return hasTag\(item, c\); \}\)/.test(html)) {
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
console.log('Saul page guard passed — truthful role views, additive filters, factual corrections, methods/languages, project-status discipline, one-page output, and website-only portrait/map.');
