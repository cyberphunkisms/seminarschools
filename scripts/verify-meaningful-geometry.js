#!/usr/bin/env node
'use strict';

/* Historical filename, current invariant: identical geometry everywhere;
 * meaningful variation is a path-stable camera into that canonical web. */
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const {
  assertGeometryVersionScheme,
  geometryExemptionForRelativeHtmlPath,
  geometryAssetVersion,
  geometryKeyForRelativeHtmlPath,
  geometryOwnerOpacityForKey,
  geometryProfileFor,
  geometryMotionPresetFor,
  geometryRegisterForKey,
  geometrySeedForKey,
} = require('./lib/geometry-asset-version');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const CONTRACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'));
assertGeometryVersionScheme(CONTRACTS);
const ASSET_VERSION = geometryAssetVersion(ROOT);
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const SOURCE_SKIP = new Set(['.git', 'node_modules', '.netlify', 'public', 'fixtures', '.public-build-staging', '.public-build-previous']);
const PUBLIC_SKIP = new Set(['.git', 'node_modules', '.netlify']);
const EXEMPTION_ATTRIBUTE = CONTRACTS.coverage.exemption_attribute;
const STAR_EXEMPTION = CONTRACTS.coverage.star_page_exemption_value;
const CONTROL_EXEMPTION = CONTRACTS.coverage.control_page_exemption_value;
const OPACITY_MINIMUM = Number(CONTRACTS.presentation.opacity_bounds.minimum);
const OPACITY_MAXIMUM = Number(CONTRACTS.presentation.opacity_bounds.maximum);
if (!EXEMPTION_ATTRIBUTE || !Number.isFinite(OPACITY_MINIMUM) || !Number.isFinite(OPACITY_MAXIMUM)
    || OPACITY_MINIMUM <= 0 || OPACITY_MAXIMUM < OPACITY_MINIMUM) {
  throw new Error('geometry contract must declare its exemption marker and finite positive opacity bounds');
}

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
  return geometryKeyForRelativeHtmlPath(route);
}
function expectedProfile(route, routeType) { return geometryProfileFor(route, routeType); }

function inspect(files, base, label, errors, stats) {
  for (const file of files) {
    const route = rel(base, file);
    if (route === GOOGLE_TOKEN) continue;
    const html = fs.readFileSync(file, 'utf8');
    const body = bodyTag(html);
    if (!body) { errors.push(`${label}:${route}: missing body`); continue; }
    const exemption = geometryExemptionForRelativeHtmlPath(CONTRACTS, route);
    if (exemption) {
      for (const asset of ['/js/mandala.js', '/js/indra.js']) {
        const escaped = escapeRegex(asset);
        const count = (html.match(new RegExp(`<[^>]+${escaped}(?:\\?[^"']*)?["'][^>]*>`, 'ig')) || []).length;
        if (count !== 0) errors.push(`${label}:${route}: ${exemption} page loads shared ${asset}`);
      }
      if ((body.match(new RegExp(`\\b${escapeRegex(EXEMPTION_ATTRIBUTE)}\\s*=`, 'ig')) || []).length !== 1
          || attr(body, EXEMPTION_ATTRIBUTE) !== exemption) {
        errors.push(`${label}:${route}: expected ${EXEMPTION_ATTRIBUTE}="${exemption}" exactly once`);
      }
      if (/\bdata-(?:geometry(?:-[\w-]+)?|indra-(?:intensity|fade-source))\s*=/i.test(body)) errors.push(`${label}:${route}: ${exemption} page retains shared geometry body attributes`);
      if (/\bid=["']indraLayer["']/i.test(html)) errors.push(`${label}:${route}: ${exemption} page hardcodes shared #indraLayer`);
      if (exemption === CONTROL_EXEMPTION && /\bdata-star-file-page\s*=/i.test(body)) errors.push(`${label}:${route}: internal control is mislabeled as a star file`);
      if (exemption === STAR_EXEMPTION) stats.starPages += 1;
      else if (exemption === CONTROL_EXEMPTION) stats.controlPages += 1;
      else errors.push(`${label}:${route}: unknown geometry exemption ${exemption}`);
      continue;
    }
    if (new RegExp(`\\b${escapeRegex(EXEMPTION_ATTRIBUTE)}\\s*=`, 'i').test(body)) errors.push(`${label}:${route}: included page is mislabeled as geometry-exempt`);
    if (/\bdata-star-file-page\s*=/i.test(body)) errors.push(`${label}:${route}: included page retains the legacy star-file no-mount marker`);
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
    if (attr(body, 'data-geometry-seed') !== geometrySeedForKey(key)) errors.push(`${label}:${route}: camera seed is not pathname-derived`);
    const expectedRegister = geometryRegisterForKey(key);
    if (attr(body, 'data-geometry-register') !== expectedRegister) errors.push(`${label}:${route}: expected ${expectedRegister} geometry register`);
    if (attr(body, 'data-geometry-profile') !== expectedProfile(route, routeType)) errors.push(`${label}:${route}: invalid geometry profile`);
    if (attr(body, 'data-geometry-motion-preset') !== geometryMotionPresetFor(CONTRACTS, key, routeType)) errors.push(`${label}:${route}: invalid thematic motion preset`);
    const intensity = Number(attr(body, 'data-indra-intensity'));
    if (!Number.isFinite(intensity) || intensity < OPACITY_MINIMUM || intensity > OPACITY_MAXIMUM) {
      errors.push(`${label}:${route}: fade must remain within ${OPACITY_MINIMUM.toFixed(3)}–${OPACITY_MAXIMUM.toFixed(3)}`);
    }
    const fadeSource = attr(body, 'data-indra-fade-source');
    if (!/^(?:page|route-register)$/.test(fadeSource)) errors.push(`${label}:${route}: invalid resolved fade source`);
    const ownerOpacity = geometryOwnerOpacityForKey(CONTRACTS, key, routeType);
    if (ownerOpacity !== null) {
      if (fadeSource !== 'page' || Math.abs(intensity - ownerOpacity) > 0.0001) errors.push(`${label}:${route}: grounded page-owner fade must resolve to ${ownerOpacity.toFixed(3)}`);
    } else if (fadeSource === 'route-register') {
      const registerOpacity = Number(CONTRACTS.registers[expectedRegister].default_intensity);
      if (Math.abs(intensity - registerOpacity) > 0.0001) errors.push(`${label}:${route}: route-register fallback must resolve to ${registerOpacity.toFixed(3)}`);
    }
    stats.pages += 1;
    if (/http-equiv=["']refresh["']/i.test(html)) stats.redirects += 1;
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) stats.noindex += 1;
  }
}

const errors = [];
const source = walk(ROOT, SOURCE_SKIP);
const deployed = walk(PUBLIC, PUBLIC_SKIP);
const sourceStats = { pages: 0, starPages: 0, controlPages: 0, redirects: 0, noindex: 0 };
const publicStats = { pages: 0, starPages: 0, controlPages: 0, redirects: 0, noindex: 0 };
inspect(source, ROOT, 'source', errors, sourceStats);
inspect(deployed, PUBLIC, 'public', errors, publicStats);
const sourceRoutes = new Set(source.map(file => rel(ROOT, file)).filter(route => route !== GOOGLE_TOKEN));
const publicRoutes = new Set(deployed.map(file => rel(PUBLIC, file)).filter(route => route !== GOOGLE_TOKEN));
for (const route of sourceRoutes) if (geometryExemptionForRelativeHtmlPath(CONTRACTS, route) !== CONTROL_EXEMPTION && !publicRoutes.has(route)) errors.push(`public:${route}: missing deploy twin`);
for (const route of publicRoutes) if (!sourceRoutes.has(route)) errors.push(`source:${route}: missing source twin`);
const expectedStarPages = Number(CONTRACTS.coverage.expected_current_star_pages);
const expectedControlPages = Number(CONTRACTS.coverage.expected_current_control_pages_source);
const expectedPublicControls = Number(CONTRACTS.coverage.expected_current_control_pages_public);
if (sourceStats.starPages !== expectedStarPages) errors.push(`source: expected ${expectedStarPages} star pages, found ${sourceStats.starPages}`);
if (publicStats.starPages !== expectedStarPages) errors.push(`public: expected ${expectedStarPages} star pages, found ${publicStats.starPages}`);
if (sourceStats.controlPages !== expectedControlPages) errors.push(`source: expected ${expectedControlPages} internal control page, found ${sourceStats.controlPages}`);
if (publicStats.controlPages !== expectedPublicControls) errors.push(`public: expected ${expectedPublicControls} internal control pages, found ${publicStats.controlPages}`);

const indra = fs.readFileSync(path.join(ROOT, 'js', 'indra.js'), 'utf8');
for (const [needle, label] of [
  ["layer.id = 'indraLayer'", 'runtime layer'],
  ["data-geometry-kind', 'shared-background-web'", 'background web marker'],
  ["data-geometry-input', 'normalized-path-scroll'", 'path-only input marker'],
  ["data-geometry-proof', 'eligible-page-scroll'", 'scroll proof marker'],
  ['buildCanonical', 'canonical builder'],
  ['indra-canonical-symbol', 'shared symbol'],
  ['canonical-use', 'shared use instance'],
  ['fine-line-rainbow-dual', 'restored dual rainbow field'],
  ['RAINBOW_PALETTE', 'original scroll spectrum'],
  ["window.addEventListener('scroll', onWindowScroll", 'window-scroll scheduler'],
  ["document.addEventListener('scroll', onElementScroll", 'captured element-scroll scheduler'],
  ["document.addEventListener('wheel', onWheel", 'fixed-surface wheel scheduler'],
  ["data-geometry-motion-source", 'runtime motion-owner marker'],
  ['cameras[index].element.style.transform', 'camera-only transform'],
  ['static-reduced', 'reduced-motion static state'],
]) {
  if (!indra.includes(needle)) errors.push(`js/indra.js misses ${label}`);
}
for (const forbidden of ['pageStructureFacts', 'location.search', 'location.hash', 'flowers: false', 'includeFlowers: false', 'setInterval(']) {
  if (indra.includes(forbidden)) errors.push(`js/indra.js violates canonical/path-only contract: ${forbidden}`);
}
for (const forbidden of ['indra-coverage', 'canonical-static-wide', 'feMorphology']) {
  if (indra.includes(forbidden)) errors.push(`js/indra.js restores the rejected static square/bubble presentation: ${forbidden}`);
}
const paletteMatch = indra.match(/var RAINBOW_HEX\s*=\s*Object\.freeze\(\s*(\[[\s\S]*?\])\s*\);/);
let runtimePalette = null;
try { runtimePalette = paletteMatch ? JSON.parse(paletteMatch[1].replace(/'/g, '"')) : null; } catch (_) {}
if (JSON.stringify(runtimePalette) !== JSON.stringify(CONTRACTS.presentation.rainbow_palette)) errors.push('js/indra.js differs from the single canonical rainbow palette');
if (!new RegExp(`body\\.hasAttribute\\('${escapeRegex(EXEMPTION_ATTRIBUTE)}'\\)`).test(indra)) errors.push('js/indra.js lacks the shared geometry-exemption no-mount guard');

if (errors.length) {
  console.error('PATH-STABLE CANONICAL GEOMETRY CHECK FAILED');
  errors.slice(0, 200).forEach(error => console.error(` - ${error}`));
  if (errors.length > 200) console.error(` ... ${errors.length - 200} more`);
  process.exit(1);
}
console.log(`PATH-STABLE CANONICAL GEOMETRY CHECK PASSED — ${sourceStats.pages} source and ${publicStats.pages} public included pages use ${ASSET_VERSION}; their exact spectrum and drawing are invariant while normalized-path cameras and bounded fading fit each page. ${sourceStats.starPages} source/${publicStats.starPages} public star pages and ${sourceStats.controlPages} source-only control remain free of shared geometry.`);
