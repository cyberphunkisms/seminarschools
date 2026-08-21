#!/usr/bin/env node
'use strict';

/*
 * Static release gate for the canonical background web.
 *
 * Every source/deploy page receives the same content-derived asset token and
 * canonical drawing. A stable path seed may select a camera; route type,
 * copy, DOM size, query parameters and hash fragments may never select or
 * remove shapes.
 */
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
const GOOGLE_TOKEN_BYTES = Buffer.from('google-site-verification: google20234ae70106ee9d.html\n', 'utf8');
const SOURCE_SKIP = new Set(['.git', 'node_modules', '.netlify', 'public', 'fixtures', '.public-build-staging', '.public-build-previous']);
const PUBLIC_SKIP = new Set(['.git', 'node_modules', '.netlify']);
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

function rel(base, file) { return path.relative(base, file).replace(/\\/g, '/'); }
function bodyTag(html) { return (html.match(/<body\b[^>]*>/i) || [''])[0]; }
function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'));
  return match ? match[2] : '';
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function assetTags(html, asset) {
  return html.match(new RegExp(`<[^>]+${escapeRegex(asset)}(?:\\?[^"']*)?["'][^>]*>`, 'ig')) || [];
}
function exactAssetVersion(html, asset) {
  const tags = assetTags(html, asset);
  return tags.length === 1 && new RegExp(`${escapeRegex(asset)}\\?v=${escapeRegex(ASSET_VERSION)}(?:["'])`, 'i').test(tags[0]);
}
function geometryKeyFor(route) {
  if (route === 'index.html') return '/';
  if (route.endsWith('/index.html')) return `/${route.slice(0, -'index.html'.length)}`;
  return `/${route}`;
}
function registerFor(route) {
  const key = geometryKeyFor(route);
  if (/^\/polymyth\/coherence(?:\/|$)/.test(key)) return 'quiet';
  if (key === '/' || /^\/(?:polymyth|bb|bookwormcard|campaigns|aa|ohm-dome|agora|florilegium)(?:\/|$)/.test(key)) return 'expressive';
  if (/^\/(?:about|leizu|saul|teacherresources|polymythseminars|seminars|writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships|marginalia|reviews)(?:\/|$)/.test(key)) return 'quiet';
  return 'standard';
}
function profileFor(route, routeType) {
  if (route === 'about/index.html') return 'about-dual';
  if (routeType === 'cv') return 'cv-quiet';
  return 'single';
}
function seedFor(route) {
  return crypto.createHash('sha256').update(geometryKeyFor(route)).digest('hex').slice(0, 16);
}

function stripAllowedMedia(css) {
  let output = '';
  let cursor = 0;
  while (cursor < css.length) {
    const matcher = /@media\s*([^\{]*)\{/ig;
    matcher.lastIndex = cursor;
    const found = matcher.exec(css);
    if (!found) { output += css.slice(cursor); break; }
    output += css.slice(cursor, found.index);
    let depth = 1;
    let index = matcher.lastIndex;
    let quote = '';
    let escaped = false;
    for (; index < css.length && depth > 0; index += 1) {
      const character = css[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      else if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
    }
    const query = found[1].toLowerCase();
    if (!/\bprint\b/.test(query) && !/forced-colors\s*:\s*active/.test(query)) output += css.slice(found.index, index);
    cursor = index;
  }
  return output;
}

function geometryHideRules(css) {
  const screen = stripAllowedMedia(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const failures = [];
  for (const match of screen.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const targetsLayer = match[1].split(',').some(selector =>
      /#indraLayer(?:\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?)*\s*$/.test(selector),
    );
    if (!targetsLayer) continue;
    const declarations = match[2];
    if (/(?:^|;)\s*display\s*:\s*(?:none|contents)\b/i.test(declarations)) failures.push('display');
    if (/(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)\b/i.test(declarations)) failures.push('visibility');
    if (/(?:^|;)\s*opacity\s*:\s*0(?:\.0*)?\s*(?:!important\s*)?(?:;|$)/i.test(declarations)) failures.push('opacity');
    if (/(?:^|;)\s*z-index\s*:\s*-/i.test(declarations)) failures.push('negative-z');
    if (/(?:^|;)\s*(?:inline-size|block-size|width|height|max-width|max-height)\s*:\s*0(?:px|rem|em|%|vh|vw|vmin|vmax)?\b/i.test(declarations)) failures.push('zero-size');
    if (/(?:^|;)\s*(?:clip-path\s*:\s*inset\(\s*(?:50|100)%|transform\s*:[^;]*scale(?:3d)?\(\s*0|content-visibility\s*:\s*hidden|filter\s*:[^;]*opacity\(\s*0)/i.test(declarations)) failures.push('clipped');
  }
  return [...new Set(failures)];
}

const cssCache = new Map();
function inspectLinkedCss(html, base, route, label, errors) {
  const hrefs = [...html.matchAll(/<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/ig)]
    .map(match => match[1] || match[2]);
  for (const href of hrefs) {
    if (/^(?:[a-z]+:)?\/\//i.test(href) || /^(?:data:|blob:)/i.test(href)) continue;
    const clean = href.split(/[?#]/, 1)[0];
    const file = clean.startsWith('/')
      ? path.join(base, clean.slice(1))
      : path.resolve(path.dirname(path.join(base, route)), clean);
    const key = `${base}:${file}`;
    if (!cssCache.has(key)) cssCache.set(key, fs.existsSync(file) ? geometryHideRules(fs.readFileSync(file, 'utf8')) : ['missing']);
    const defects = cssCache.get(key);
    if (defects.length) errors.push(`${label}:${route}: linked CSS ${href} hides/buries geometry via ${defects.join(', ')}`);
  }
}

function verifyGoogleToken(errors) {
  for (const [label, file] of [['source', path.join(ROOT, GOOGLE_TOKEN)], ['public', path.join(PUBLIC, GOOGLE_TOKEN)]]) {
    if (!fs.existsSync(file)) { errors.push(`${label}:${GOOGLE_TOKEN}: exact verification token missing`); continue; }
    const bytes = fs.readFileSync(file);
    if (!bytes.equals(GOOGLE_TOKEN_BYTES)) errors.push(`${label}:${GOOGLE_TOKEN}: verification token bytes changed`);
  }
}

function inspect(files, base, label, errors, stats) {
  for (const file of files) {
    const route = rel(base, file);
    if (route === GOOGLE_TOKEN) continue;
    const html = fs.readFileSync(file, 'utf8');
    const body = bodyTag(html);
    if (!body) { errors.push(`${label}:${route}: missing body`); continue; }
    for (const asset of ['/css/alive.css', '/js/mandala.js', '/js/indra.js']) {
      if (!exactAssetVersion(html, asset)) errors.push(`${label}:${route}: ${asset} must appear once with content token ${ASSET_VERSION}`);
    }
    const mandalaPosition = html.search(/<script\b[^>]*\/js\/mandala\.js/i);
    const indraPosition = html.search(/<script\b[^>]*\/js\/indra\.js/i);
    const footerPosition = html.search(/<script\b[^>]*\/js\/footer\.js/i);
    if (!(mandalaPosition >= 0 && indraPosition > mandalaPosition && (footerPosition < 0 || footerPosition > indraPosition))) errors.push(`${label}:${route}: geometry order must be mandala, indra, footer`);

    const required = ['data-route-type', 'data-geometry', 'data-indra-intensity', 'data-geometry-role', 'data-geometry-key', 'data-geometry-seed', 'data-geometry-register', 'data-geometry-profile', 'data-front-facing'];
    for (const name of required) {
      if ((body.match(new RegExp(`\\b${name}\\s*=`, 'ig')) || []).length !== 1) errors.push(`${label}:${route}: expected exactly one ${name}`);
    }
    const routeType = attr(body, 'data-route-type');
    const roles = CONTRACTS.route_types[routeType];
    if (!Array.isArray(roles)) errors.push(`${label}:${route}: unknown route type ${routeType || '(missing)'}`);
    else if (attr(body, 'data-geometry-role').trim().replace(/\s+/g, ' ') !== roles.join(' ')) errors.push(`${label}:${route}: geometry roles do not match ${routeType}`);
    if (attr(body, 'data-geometry') !== 'indra-web') errors.push(`${label}:${route}: missing canonical geometry marker`);
    if (attr(body, 'data-front-facing') !== 'general-audience') errors.push(`${label}:${route}: missing front-facing marker`);
    if (attr(body, 'data-geometry-key') !== geometryKeyFor(route)) errors.push(`${label}:${route}: geometry key is not the normalized route path`);
    if (attr(body, 'data-geometry-seed') !== seedFor(route)) errors.push(`${label}:${route}: geometry seed is not path-derived`);
    const register = registerFor(route);
    if (attr(body, 'data-geometry-register') !== register) errors.push(`${label}:${route}: expected ${register} register`);
    if (attr(body, 'data-geometry-profile') !== profileFor(route, routeType)) errors.push(`${label}:${route}: incorrect geometry profile`);
    const intensity = Number(attr(body, 'data-indra-intensity'));
    const expectedIntensity = Number(CONTRACTS.registers[register].default_intensity);
    if (!Number.isFinite(intensity) || Math.abs(intensity - expectedIntensity) > 0.0001) errors.push(`${label}:${route}: expected ${expectedIntensity.toFixed(3)} intensity`);
    if (/\bid=["']indraLayer["']/i.test(html)) errors.push(`${label}:${route}: page hardcodes runtime-owned #indraLayer`);
    if (/getElementById\(["']indraLayer["']\)[\s\S]{0,160}(?:remove\(|display\s*=\s*["']none|visibility\s*=\s*["']hidden)/i.test(html)) errors.push(`${label}:${route}: page script removes or hides canonical geometry`);
    const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
    if (/#indraLayer\s*\{[^{}]*\bopacity\s*:/i.test(inline)) errors.push(`${label}:${route}: inline CSS overrides the register-owned geometry opacity`);
    const inlineDefects = geometryHideRules(inline);
    if (inlineDefects.length) errors.push(`${label}:${route}: inline CSS hides/buries geometry via ${inlineDefects.join(', ')}`);
    inspectLinkedCss(html, base, route, label, errors);
    stats.pages += 1;
    if (/http-equiv=["']refresh["']/i.test(html)) stats.redirects += 1;
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) stats.noindex += 1;
  }
}

const errors = [];
verifyGoogleToken(errors);
const source = walk(ROOT, SOURCE_SKIP);
const deployed = walk(PUBLIC, PUBLIC_SKIP);
const sourceStats = { pages: 0, redirects: 0, noindex: 0 };
const publicStats = { pages: 0, redirects: 0, noindex: 0 };
inspect(source, ROOT, 'source', errors, sourceStats);
inspect(deployed, PUBLIC, 'public', errors, publicStats);
const sourceRoutes = new Set(source.map(file => rel(ROOT, file)).filter(route => route !== GOOGLE_TOKEN));
const publicRoutes = new Set(deployed.map(file => rel(PUBLIC, file)).filter(route => route !== GOOGLE_TOKEN));
for (const route of sourceRoutes) if (!SOURCE_ONLY_ROUTES.has(route) && !publicRoutes.has(route)) errors.push(`public:${route}: source route has no deploy twin`);
for (const route of publicRoutes) if (!sourceRoutes.has(route)) errors.push(`source:${route}: public route has no source twin`);

const alive = fs.readFileSync(path.join(ROOT, 'css', 'alive.css'), 'utf8');
if (!/#indraLayer\s*\{[\s\S]{0,550}position:\s*fixed[\s\S]{0,550}z-index:\s*2147483000[\s\S]{0,550}pointer-events:\s*none/.test(alive)) errors.push('css/alive.css must keep #indraLayer fixed, above opaque legacy wrappers, and pointer-safe');
if (!/#indraLayer\s+\.indra-camera\s*\{[\s\S]{0,500}position:\s*absolute[\s\S]{0,500}will-change:\s*transform/.test(alive)) errors.push('css/alive.css must define compositor-only camera surfaces');
if (!/#indraLayer\s+\.indra-coverage\s*\{[\s\S]{0,400}opacity:\s*\.82[\s\S]{0,200}filter:\s*drop-shadow\(0 0 \.25px currentColor\)/.test(alive) || !/\.indra-coverage\s+svg\s*\{[\s\S]{0,300}inline-size:\s*min\(180vmax, 1500px\)/.test(alive)) errors.push('css/alive.css must retain the calibrated seed-independent coverage opacity, extent, and edge halo');
if (!/\.indra-definition-bank\s*\{[\s\S]{0,300}(?:inline-size|width):\s*0[\s\S]{0,200}(?:block-size|height):\s*0/.test(alive)) errors.push('css/alive.css must hide only the shared SVG definition bank');
if (!/@media\s+print[\s\S]*#indraLayer/.test(alive)) errors.push('css/alive.css must omit geometry from print');
if (!/@media\s*\(forced-colors:\s*active\)[\s\S]*#indraLayer\s*\{\s*display:\s*none/.test(alive)) errors.push('css/alive.css must omit geometry in forced colours');
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*#indraLayer\s+\.indra-camera\s*\{\s*will-change:\s*auto/.test(alive)) errors.push('css/alive.css must keep reduced-motion geometry visible but static');

const calm = fs.readFileSync(path.join(ROOT, 'css', 'calm-ux.css'), 'utf8');
if (!/#indraLayer\s+\.indra-camera/.test(calm)) errors.push('css/calm-ux.css must preserve the canonical camera in calm mode');
const calmHides = geometryHideRules(calm);
if (calmHides.length) errors.push(`css/calm-ux.css hides canonical geometry via ${calmHides.join(', ')}`);
if (/(?:#geo\b|#geo2\b|#geoLayer\b)[^{}]*\{[^{}]*display\s*:\s*none/i.test(calm)) errors.push('css/calm-ux.css still uses legacy geometry hiding');

const mandala = fs.readFileSync(path.join(ROOT, 'js', 'mandala.js'), 'utf8');
for (const token of [CONTRACTS.canonical_web.id, 'buildCanonical', 'geo-gasket-circle', 'geo-flower', 'geo-jewel-prism', 'geo-jewel-core']) {
  if (!mandala.includes(token)) errors.push(`js/mandala.js missing canonical part ${token}`);
}
const indra = fs.readFileSync(path.join(ROOT, 'js', 'indra.js'), 'utf8');
for (const token of ['shared-background-web', 'normalized-path-scroll', 'indra-definition-bank', 'indra-canonical-symbol', 'canonical-use', 'about-dual', 'cv-quiet', 'static-reduced', 'scroll-responsive']) {
  if (!indra.includes(token)) errors.push(`js/indra.js missing canonical runtime contract ${token}`);
}
for (const token of ['indra-coverage', 'canonical-static-wide', "data-geometry-coverage-surfaces', '1'"]) {
  if (!indra.includes(token)) errors.push(`js/indra.js missing universal coverage contract ${token}`);
}
if (!/feMorphology[^>]+operator=\\?"dilate\\?"[^>]+radius=\\?"2\.8\\?"/.test(indra)) errors.push('js/indra.js must retain the bounded static coverage edge dilation');
if (!/Math\.abs\(requestedOpacity - registerOpacity\) <= 0\.001/.test(indra)) errors.push('js/indra.js must reject stale intensity markup and enforce the register-owned visibility level');
if (!/SCROLL_PAINT_FALLBACK_MS\s*=\s*48/.test(indra) || !/cancelAnimationFrame\(raf\)/.test(indra)) errors.push('js/indra.js must retain its bounded 48ms scroll paint fallback');
if (/pageStructureFacts|querySelectorAll\([^)]*(?:main|section|article|h1)|location\.(?:search|hash)/.test(indra)) errors.push('js/indra.js may not derive geometry from DOM structure, query, or hash');
if (/pointer(?:move|down|up|enter|leave)/i.test(indra) || /setInterval\s*\(/.test(indra)) errors.push('js/indra.js may not use pointer or permanent interval animation');

for (const route of ['about/index.html', 'saul/index.html', 'saul/fr/index.html', 'saul/fa/index.html', 'saul/zh-hans/index.html', 'saul/zh-hant/index.html']) {
  const html = fs.readFileSync(path.join(ROOT, route), 'utf8');
  if (/\bid=["'](?:geo|geo2|geoLayer)["']/i.test(html)) errors.push(`${route}: legacy bespoke geometry mount remains active`);
  if (/\b(?:buildGeo|buildMandala|updateGeometry|geometryToggle)\b/.test(html)) errors.push(`${route}: retired page-level geometry renderer remains`);
}
const about = fs.readFileSync(path.join(ROOT, 'about', 'index.html'), 'utf8');
for (const legacy of ['buildMandala', 'updateGeometry', 'geometryToggle', '#geo', '#geo2']) {
  if (about.includes(legacy)) errors.push(`about/index.html: retired geometry ownership remains (${legacy})`);
}

const geometryGenerators = [
  'scripts/build-search-pages.js', 'scripts/build-polymyth-data.mjs',
  'scripts/build-polymythcal-audit13.py', 'scripts/build-polymythcal-feeds.py',
  'scripts/build-audit45-localized-routes.py', 'scripts/build_section.py',
  'scripts/build_marginalia.py', 'scripts/build-saul-ultimate-web-cv.py',
];
for (const relative of geometryGenerators) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  if (source.includes('20260808-perceptible-scroll-geometry')) errors.push(`${relative}: retired fixed geometry asset token remains`);
  if (!/(?:geometryAssetVersion|geometry_asset_version)/.test(source)) errors.push(`${relative}: generator does not use the content-derived geometry token helper`);
}

if (errors.length) {
  console.error('VISIBLE GEOMETRY CHECK FAILED');
  errors.slice(0, 200).forEach(error => console.error(` - ${error}`));
  if (errors.length > 200) console.error(` ... ${errors.length - 200} more`);
  process.exit(1);
}
console.log(`VISIBLE GEOMETRY CHECK PASSED — ${sourceStats.pages} source and ${publicStats.pages} public pages use content token ${ASSET_VERSION}, exact path seeds/profiles/registers, the canonical background plane, and no page-level geometry hiding.`);
