#!/usr/bin/env node
'use strict';

/* Historical filename, current invariant: identical geometry everywhere;
 * meaningful variation is a path-stable camera into that canonical web. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const {
  assertGeometryVersionScheme,
  geometryAssetVersion,
} = require('./lib/geometry-asset-version');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const CONTRACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'));
assertGeometryVersionScheme(CONTRACTS);
const ASSET_VERSION = geometryAssetVersion(ROOT);
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const SOURCE_SKIP = new Set(['.git', 'node_modules', '.netlify', 'public', 'fixtures', '.public-build-staging', '.public-build-previous']);
const PUBLIC_SKIP = new Set(['.git', 'node_modules', '.netlify']);
const SOURCE_ONLY = new Set(['dashboard/index.html']);

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
function rel(base, file) { return path.relative(base, file).replace(/\\/g, '/'); }
function bodyTag(html) { return (html.match(/<body\b[^>]*>/i) || [''])[0]; }
function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'));
  return match ? match[2] : '';
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function keyFor(route) {
  if (route === 'index.html') return '/';
  return route.endsWith('/index.html') ? `/${route.slice(0, -'index.html'.length)}` : `/${route}`;
}
function expectedProfile(route, routeType) {
  return route === 'about/index.html' ? 'about-dual' : routeType === 'cv' ? 'cv-quiet' : 'single';
}

function inspect(files, base, label, errors, stats) {
  for (const file of files) {
    const route = rel(base, file);
    if (route === GOOGLE_TOKEN) continue;
    const html = fs.readFileSync(file, 'utf8');
    const body = bodyTag(html);
    if (!body) { errors.push(`${label}:${route}: missing body`); continue; }
    for (const asset of ['/css/alive.css', '/js/mandala.js', '/js/indra.js']) {
      const escaped = escapeRegex(asset);
      const count = (html.match(new RegExp(`<[^>]+${escaped}(?:\\?[^"']*)?["'][^>]*>`, 'ig')) || []).length;
      if (count !== 1) errors.push(`${label}:${route}: expected one ${asset}, found ${count}`);
      if (!new RegExp(`${escaped}\\?v=${escapeRegex(ASSET_VERSION)}(?:["'])`, 'i').test(html)) errors.push(`${label}:${route}: ${asset} lacks content-derived token ${ASSET_VERSION}`);
    }
    const mandala = html.search(/<script\b[^>]*\/js\/mandala\.js/i);
    const indra = html.search(/<script\b[^>]*\/js\/indra\.js/i);
    if (!(mandala >= 0 && indra > mandala)) errors.push(`${label}:${route}: mandala must load before indra`);
    const key = keyFor(route);
    const routeType = attr(body, 'data-route-type');
    if (!CONTRACTS.route_types[routeType]) errors.push(`${label}:${route}: unregistered route type ${routeType || '(missing)'}`);
    if (attr(body, 'data-geometry') !== 'indra-web') errors.push(`${label}:${route}: missing indra-web marker`);
    if (attr(body, 'data-geometry-key') !== key) errors.push(`${label}:${route}: camera key is not normalized pathname`);
    if (attr(body, 'data-geometry-seed') !== crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)) errors.push(`${label}:${route}: camera seed is not pathname-derived`);
    if (!CONTRACTS.registers[attr(body, 'data-geometry-register')]) errors.push(`${label}:${route}: invalid geometry register`);
    if (attr(body, 'data-geometry-profile') !== expectedProfile(route, routeType)) errors.push(`${label}:${route}: invalid geometry profile`);
    stats.pages += 1;
    if (/http-equiv=["']refresh["']/i.test(html)) stats.redirects += 1;
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) stats.noindex += 1;
  }
}

const errors = [];
const source = walk(ROOT, SOURCE_SKIP);
const deployed = walk(PUBLIC, PUBLIC_SKIP);
const sourceStats = { pages: 0, redirects: 0, noindex: 0 };
const publicStats = { pages: 0, redirects: 0, noindex: 0 };
inspect(source, ROOT, 'source', errors, sourceStats);
inspect(deployed, PUBLIC, 'public', errors, publicStats);
const sourceRoutes = new Set(source.map(file => rel(ROOT, file)).filter(route => route !== GOOGLE_TOKEN));
const publicRoutes = new Set(deployed.map(file => rel(PUBLIC, file)).filter(route => route !== GOOGLE_TOKEN));
for (const route of sourceRoutes) if (!SOURCE_ONLY.has(route) && !publicRoutes.has(route)) errors.push(`public:${route}: missing deploy twin`);
for (const route of publicRoutes) if (!sourceRoutes.has(route)) errors.push(`source:${route}: missing source twin`);

const indra = fs.readFileSync(path.join(ROOT, 'js', 'indra.js'), 'utf8');
for (const [needle, label] of [
  ["layer.id = 'indraLayer'", 'runtime layer'],
  ["data-geometry-kind', 'shared-background-web'", 'background web marker'],
  ["data-geometry-input', 'normalized-path-scroll'", 'path-only input marker'],
  ["data-geometry-proof', 'all-page-scroll'", 'scroll proof marker'],
  ['buildCanonical', 'canonical builder'],
  ['indra-canonical-symbol', 'shared symbol'],
  ['canonical-use', 'shared use instance'],
  ['canonical-static-wide', 'seed-independent canonical coverage'],
  ["window.addEventListener('scroll', schedule", 'scroll scheduler'],
  ['cameras[index].element.style.transform', 'camera-only transform'],
  ['static-reduced', 'reduced-motion static state'],
]) {
  if (!indra.includes(needle)) errors.push(`js/indra.js misses ${label}`);
}
for (const forbidden of ['pageStructureFacts', 'location.search', 'location.hash', 'flowers: false', 'includeFlowers: false', 'setInterval(']) {
  if (indra.includes(forbidden)) errors.push(`js/indra.js violates canonical/path-only contract: ${forbidden}`);
}

if (errors.length) {
  console.error('PATH-STABLE CANONICAL GEOMETRY CHECK FAILED');
  errors.slice(0, 200).forEach(error => console.error(` - ${error}`));
  if (errors.length > 200) console.error(` ... ${errors.length - 200} more`);
  process.exit(1);
}
console.log(`PATH-STABLE CANONICAL GEOMETRY CHECK PASSED — ${sourceStats.pages} source and ${publicStats.pages} public pages use ${ASSET_VERSION}; their shared drawing is invariant and only normalized-path cameras differ.`);
