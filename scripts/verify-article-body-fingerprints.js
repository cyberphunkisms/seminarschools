#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { fingerprintArticle } = require('./lib/article-body-fingerprint');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'data', 'article-body-fingerprints.json');

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'public' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name.endsWith('.html')) output.push(full);
  }
  return output;
}

function verify(root = ROOT, registryPath = REGISTRY) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (registry.schemaVersion !== '1.0.0') throw new Error('article fingerprint registry must use schemaVersion 1.0.0');
  const configured = new Map(registry.articles.map((record) => [record.route, record]));
  if (configured.size !== registry.articles.length) throw new Error('article fingerprint registry has duplicate routes');
  const discovered = walk(root)
    .filter((file) => fs.readFileSync(file, 'utf8').includes('data-route-type="publication"'))
    .map((file) => path.relative(root, file).replace(/\\/g, '/'))
    .sort();
  const expected = [...configured.keys()].sort();
  const missing = discovered.filter((route) => !configured.has(route));
  const stale = expected.filter((route) => !discovered.includes(route));
  const failures = [];
  if (missing.length) failures.push(`unregistered publication routes: ${missing.join(', ')}`);
  if (stale.length) failures.push(`registered routes no longer marked publication: ${stale.join(', ')}`);
  for (const route of discovered) {
    const actual = fingerprintArticle(fs.readFileSync(path.join(root, route), 'utf8'));
    const record = configured.get(route);
    if (!record || actual.sha256 === record.sha256) continue;
    failures.push(`${route}: authored article changed (expected ${record.sha256}, got ${actual.sha256})`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return { routes: discovered.length };
}

if (require.main === module) {
  try {
    const result = verify();
    console.log(`ARTICLE BODY FINGERPRINTS PASS — ${result.routes} authored publication routes unchanged.`);
  } catch (error) {
    console.error(`ARTICLE BODY FINGERPRINTS FAIL\n${error.message}`);
    process.exit(1);
  }
}

module.exports = { verify, walk };
