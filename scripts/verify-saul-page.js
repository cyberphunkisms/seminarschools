#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'saul', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const errors = [];
const required = [
  'class="cv-intro"',
  'id="careerArchive"',
  'data-quick-view="current"',
  'data-quick-view="teaching"',
  'data-quick-view="all"',
  'data-cv-mode="chrono"',
  'data-cv-mode="theme"',
  'class="archive-tools"',
  'href="/leizu/intake/"',
  'href="/leizu/"',
  'href="/main/"',
  'const SAUL_PROFILE_COPY',
  'function renderProfile()',
  'renderProfile();',
  'Saul Karim Nassau,<span class="post">MA</span>',
  'body:not(.party) { --geo-density: 0.025 !important; }'
];
for (const token of required) if (!html.includes(token)) errors.push(`Missing required Saul page element: ${token}`);

for (const lang of ['en:', 'zh:', 'zhs:', 'fa:', 'fr:']) {
  const start = html.indexOf(`  ${lang}`, html.indexOf('const SAUL_PROFILE_COPY'));
  if (start < 0) errors.push(`Profile copy missing ${lang}`);
}

const introEnd = html.indexOf('<section class="archive-shell"', html.indexOf('class="cv-intro"'));
const filters = html.indexOf('id="filterNav"');
if (filters < introEnd) errors.push('Detailed filters appear before the professional front page/archive boundary.');

if (html.includes('Saul Karim NMH,<span class="post">MA</span>')) errors.push('Legacy NMH header remains visible.');

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
