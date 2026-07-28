#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const graphPath = path.join(root, 'polymyth', 'sitemap', 'graph', 'index.html');
const d3Path = path.join(root, 'js', 'vendor', 'd3-7.9.0.min.js');
const licensePath = path.join(root, 'js', 'vendor', 'd3-7.9.0.LICENSE.txt');
const assetBudgetPath = path.join(root, 'scripts', 'reports', 'asset-weight-budget.json');
const graph = fs.readFileSync(graphPath, 'utf8');
const failures = [];

function requireMatch(pattern, message) {
  if (!pattern.test(graph)) failures.push(message);
}

function requireToken(token, message) {
  if (!graph.includes(token)) failures.push(message);
}

requireToken('src="/js/vendor/d3-7.9.0.min.js"', 'graph must load the pinned, same-origin D3 asset');
if (/cdnjs|unpkg|jsdelivr/i.test(graph)) failures.push('graph must not depend on a third-party script host');
if (/setTimeout\s*\(\s*init\s*,/.test(graph)) failures.push('graph must not retry library initialization forever');
requireMatch(/id="graph-fallback"[^>]*role="alert"[^>]*hidden/, 'graph needs a hidden, announced tree-view fallback');
requireMatch(/id="detail"[^>]*aria-hidden="true"[^>]*inert/, 'closed detail panel must not expose hidden focus targets');
requireToken(".attr('role', 'button')", 'graph nodes must expose button semantics');
requireToken(".attr('tabindex', (d, index) => index === 0 ? 0 : -1)", 'graph nodes must use one roving tab stop');
requireToken("event.key === 'Enter' || event.key === ' '", 'graph nodes must support keyboard activation');
requireToken("event.key === 'ArrowRight' || event.key === 'ArrowDown'", 'graph nodes must support arrow-key traversal');
requireToken("matchMedia('(prefers-reduced-motion: reduce)')", 'graph must explicitly honor reduced-motion preference');
requireToken('duration(reducedMotion ? 0 : 750)', 'graph focus animation must stop under reduced motion');
requireToken('height: 100dvh', 'graph shell must use the dynamic viewport height');
requireMatch(/\.graph-frame\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/s, 'graph canvas must flex inside the visible viewport');
requireMatch(/\.graph-footer\s*\{[^}]*flex:\s*none;/s, 'graph footer must stay in flow without covering the canvas');
requireToken('@media (forced-colors: active)', 'graph needs an explicit forced-colours fallback');
requireToken('min-height:44px', 'graph controls and connection buttons must preserve 44px targets');

const duplicateRule = '.actions button,.connections button{';
const duplicateCount = graph.split(duplicateRule).length - 1;
if (duplicateCount !== 1) failures.push(`graph connection-button rule must appear once, found ${duplicateCount}`);

const inlineScripts = [...graph.matchAll(/<script(?![^>]*\btype="application\/json")[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(source => source.trim());
for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    failures.push(`inline graph script ${index + 1} does not compile: ${error.message}`);
  }
}

try {
  const d3 = fs.readFileSync(d3Path);
  const digest = crypto.createHash('sha256').update(d3).digest('hex');
  const expected = 'f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539';
  if (digest !== expected) failures.push(`pinned D3 7.9.0 checksum changed: ${digest}`);
  const license = fs.readFileSync(licensePath, 'utf8');
  if (!license.includes('Copyright 2010-2023 Mike Bostock') || !license.includes('Permission to use, copy, modify')) {
    failures.push('pinned D3 asset must retain its upstream licence notice');
  }
  const budget = JSON.parse(fs.readFileSync(assetBudgetPath, 'utf8'));
  const d3Budget = (budget.knownLargeAssets || []).find(row => row.path === 'js/vendor/d3-7.9.0.min.js');
  if (
    !d3Budget
    || d3Budget.baselineBytes !== 279706
    || d3Budget.ceilingBytes !== 280000
  ) {
    failures.push('pinned D3 must retain its narrow 279706/280000-byte asset budget');
  }
} catch (error) {
  failures.push(`pinned D3 asset, licence, or budget is missing: ${error.message}`);
}

if (failures.length) {
  console.error('AUDIT36 GRAPH RESILIENCE FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT36 GRAPH RESILIENCE PASSED — same-origin D3, finite failure fallback, keyboard nodes, motion/viewport/target safeguards.');
