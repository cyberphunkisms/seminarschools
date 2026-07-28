#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function addRule(map, rule, surface) {
  if (map.has(rule.from)) {
    failures.push(`${surface} repeats redirect source ${rule.from}`);
    return;
  }
  map.set(rule.from, rule);
}

function tomlRules(source) {
  const rules = new Map();
  for (const block of source.split('[[redirects]]').slice(1)) {
    const read = key => block.match(new RegExp(`^\\s*${key}\\s*=\\s*(?:"([^"]*)"|(\\w+))`, 'm'));
    const from = read('from')?.[1];
    const to = read('to')?.[1];
    if (!from || !to) continue;
    const status = Number(read('status')?.[1] || read('status')?.[2] || 301);
    const force = String(read('force')?.[1] || read('force')?.[2] || 'false') === 'true';
    addRule(rules, {from, to, status, force}, 'netlify.toml');
  }
  return rules;
}

function redirectsRules(source) {
  const rules = new Map();
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const fields = line.split(/\s+/);
    if (fields.length < 2) continue;
    const statusToken = fields[2] || '301';
    const status = Number(statusToken.replace(/!$/, ''));
    addRule(
      rules,
      {from: fields[0], to: fields[1], status, force: statusToken.endsWith('!')},
      '_redirects',
    );
  }
  return rules;
}

const toml = tomlRules(fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'));
const redirects = redirectsRules(fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8'));
let overlaps = 0;

for (const [from, left] of toml) {
  const right = redirects.get(from);
  if (!right) continue;
  overlaps += 1;
  if (left.to !== right.to || left.status !== right.status || left.force !== right.force) {
    failures.push(
      `${from} conflicts across redirect surfaces: `
        + `netlify.toml -> ${left.to} ${left.status}${left.force ? '!' : ''}; `
        + `_redirects -> ${right.to} ${right.status}${right.force ? '!' : ''}`,
    );
  }
}

if (failures.length) {
  console.error('REDIRECT POLICY COHERENCE FAILED');
  failures.forEach(message => console.error(` - ${message}`));
  process.exit(1);
}

console.log(
  `REDIRECT POLICY COHERENCE PASSED — ${toml.size} netlify.toml rules, `
    + `${redirects.size} _redirects rules, ${overlaps} compatible overlaps, zero conflicts.`,
);
