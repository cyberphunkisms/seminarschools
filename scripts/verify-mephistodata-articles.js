#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED = Object.freeze([
  Object.freeze({
    title: 'Be Kind While We Exploit You',
    subtitle: 'A Mephistodata investigation',
    date: 'August 28, 2026',
    relative: 'polymyth/articles/be-kind-while-we-exploit-you.md',
    sha256: '53fef2183bcc589e5a109a0fb6d1ab6ead62c9181dba9e85b9b82c2603d949e8',
  }),
  Object.freeze({
    title: 'The Struggle to Control AI',
    subtitle: 'Who controls culture, identity, inspection, safety, and remedies for harm',
    date: 'August 26, 2026',
    relative: 'polymyth/articles/the-struggle-to-control-ai.md',
    sha256: 'cea0b1c9947757cb62eed1b1d57706da3e8a2d8b4de94fee5a84e9052599cc01',
  }),
]);

const failures = [];
function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function read(relative) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) {
    failures.push(`${relative} is missing`);
    return null;
  }
  return fs.readFileSync(target);
}

for (const article of EXPECTED) {
  const source = read(article.relative);
  if (!source) continue;
  const text = source.toString('utf8');
  if (!text.startsWith(`# ${article.title}\n\n## ${article.subtitle}\n\n*Updated ${article.date}.*\n`)) {
    failures.push(`${article.relative} has the wrong title, subtitle, or publication date`);
  }
  if (digest(source) !== article.sha256) {
    failures.push(`${article.relative} differs from its accepted dated article source`);
  }
  const publicRelative = `public/${article.relative}`;
  const publicCopy = read(publicRelative);
  if (publicCopy && !source.equals(publicCopy)) {
    failures.push(`${publicRelative} differs from the source article`);
  }
}

if (new Set(EXPECTED.map(article => article.date)).size !== EXPECTED.length) {
  failures.push('article publication dates are not distinct');
}

let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
} catch (error) {
  failures.push(`RELEASE_MANIFEST.json is invalid: ${error.message}`);
}
if (manifest) {
  const update = manifest.mephistodata_articles_synthesis || {};
  if (update.distinct_publication_dates !== true) {
    failures.push('release manifest does not certify distinct article dates');
  }
  if (JSON.stringify(update.articles) !== JSON.stringify(EXPECTED)) {
    failures.push('release manifest article registry differs from the accepted article set');
  }
}

if (failures.length) {
  console.error('Mephistodata article verification failed');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Mephistodata article verification passed: ${EXPECTED.map(article => `${article.title} (${article.date})`).join(' and ')}`);
