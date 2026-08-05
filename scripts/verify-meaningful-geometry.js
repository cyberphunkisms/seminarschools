#!/usr/bin/env node
'use strict';

/*
  Historical filename, current contract.

  This gate no longer enforces the abandoned page-meaning/deletion-test
  expansion. It verifies the user-settled baseline: every real webpage carries
  the shared Indra scroll geometry contract, and the engine identifies that
  contract as all-page scroll geometry rather than a semantic proof.
*/
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const ASSET_VERSION = '20260805-geometry-hardening';
const SKIP_SOURCE = new Set(['.git', 'node_modules', '.netlify', 'public', 'fixtures']);
const SKIP_PUBLIC = new Set(['.git', 'node_modules', '.netlify']);
const SOURCE_ONLY_ROUTES = new Set(['dashboard/index.html']);

function walk(dir, skip, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || isGeneratedDependencyDirectory(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, skip, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function rel(base, file) {
  return path.relative(base, file).replace(/\\/g, '/');
}

function bodyTag(html) {
  const match = html.match(/<body\b[^>]*>/i);
  return match ? match[0] : '';
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'));
  return match ? match[2] : '';
}

function assetCount(html, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (html.match(new RegExp(`<[^>]+${escaped}[^>]*>`, 'ig')) || []).length;
}

function hasVersionedAsset(html, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\?v=${ASSET_VERSION}(?:["'])`, 'i').test(html);
}

function inspect(files, base, label, errors, stats) {
  for (const file of files) {
    const route = rel(base, file);
    if (route === GOOGLE_TOKEN) continue;
    const html = fs.readFileSync(file, 'utf8');
    const body = bodyTag(html);
    if (!body) {
      errors.push(`${label}:${route}: missing body`);
      continue;
    }
    for (const [asset, kind] of [
      ['/css/alive.css', 'alive stylesheet'],
      ['/js/mandala.js', 'mandala engine'],
      ['/js/indra.js', 'indra scroll engine'],
    ]) {
      const count = assetCount(html, asset);
      if (count !== 1) errors.push(`${label}:${route}: expected one ${kind}, found ${count}`);
      if (!hasVersionedAsset(html, asset)) errors.push(`${label}:${route}: ${kind} must use ${ASSET_VERSION}`);
    }
    const mandala = html.search(/<script\b[^>]*\/js\/mandala\.js/i);
    const indra = html.search(/<script\b[^>]*\/js\/indra\.js/i);
    const footer = html.search(/<script\b[^>]*\/js\/footer\.js/i);
    if (!(mandala >= 0 && indra > mandala && (footer < 0 || footer > indra))) {
      errors.push(`${label}:${route}: geometry scripts must load mandala, then indra, then footer`);
    }
    if (attr(body, 'data-geometry') !== 'indra-web') errors.push(`${label}:${route}: missing data-geometry="indra-web"`);
    const intensity = Number(attr(body, 'data-indra-intensity'));
    if (!Number.isFinite(intensity) || intensity < 0.025 || intensity > 0.13) {
      errors.push(`${label}:${route}: invalid data-indra-intensity`);
    }
    stats.pages += 1;
    if (/http-equiv=["']refresh["']/i.test(html) || /location\.replace\s*\(/i.test(html)) stats.redirects += 1;
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) stats.noindex += 1;
  }
}

const errors = [];
const source = walk(ROOT, SKIP_SOURCE);
const publicFiles = walk(PUBLIC, SKIP_PUBLIC);
const sourceStats = { pages: 0, redirects: 0, noindex: 0 };
const publicStats = { pages: 0, redirects: 0, noindex: 0 };

inspect(source, ROOT, 'source', errors, sourceStats);
inspect(publicFiles, PUBLIC, 'public', errors, publicStats);

const sourceRoutes = new Set(source.map(file => rel(ROOT, file)).filter(route => route !== GOOGLE_TOKEN));
const publicRoutes = new Set(publicFiles.map(file => rel(PUBLIC, file)).filter(route => route !== GOOGLE_TOKEN));
for (const route of sourceRoutes) {
  if (!SOURCE_ONLY_ROUTES.has(route) && !publicRoutes.has(route)) errors.push(`public:${route}: missing deploy twin`);
}
for (const route of publicRoutes) {
  if (!sourceRoutes.has(route)) errors.push(`source:${route}: public page has no source twin`);
}

const indra = fs.readFileSync(path.join(ROOT, 'js', 'indra.js'), 'utf8');
for (const [needle, label] of [
  ["layer.id = 'indraLayer'", 'runtime layer creation'],
  ["layer.setAttribute('data-geometry-engine', 'scroll')", 'scroll engine marker'],
  ["layer.setAttribute('data-geometry-kind', 'shared-scroll-layer')", 'shared scroll marker'],
  ["layer.setAttribute('data-geometry-input', 'path-route-scroll')", 'path route scroll input marker'],
  ["layer.setAttribute('data-geometry-proof', 'all-page-scroll')", 'all-page scroll proof marker'],
  ["window.addEventListener('scroll'", 'scroll listener'],
  ['layer.style.transform', 'transform-only motion'],
]) {
  if (!indra.includes(needle)) errors.push(`js/indra.js misses ${label}`);
}
for (const forbidden of [
  'cannot, by itself, prove CL-49',
  'deletion test',
  'data-geometry-proof\', \'baseline-only',
]) {
  if (indra.includes(forbidden)) errors.push(`js/indra.js retains overbroad semantic proof language: ${forbidden}`);
}

if (errors.length) {
  console.error('ALL-PAGE SCROLL GEOMETRY CHECK FAILED');
  errors.slice(0, 200).forEach(error => console.error(` - ${error}`));
  if (errors.length > 200) console.error(` ... ${errors.length - 200} more`);
  process.exit(1);
}

console.log(
  `ALL-PAGE SCROLL GEOMETRY CHECK PASSED - ${sourceStats.pages} source and ${publicStats.pages} public HTML pages carry the ${ASSET_VERSION} Indra scroll contract; source includes ${sourceStats.redirects} redirect fallbacks and ${sourceStats.noindex} noindex pages; public includes ${publicStats.redirects} redirect fallbacks and ${publicStats.noindex} noindex pages.`,
);
