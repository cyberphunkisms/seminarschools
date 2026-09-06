#!/usr/bin/env node
'use strict';

/*
 * Static release gate for the canonical background web.
 *
 * Every included source/deploy page receives the same content-derived asset
 * token and canonical drawing. A stable path seed may select a camera; route type,
 * copy, DOM size, query parameters and hash fragments may never select or
 * remove shapes.
 */
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
  geometryRegisterForKey,
  geometrySeedForKey,
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
const EXEMPTION_ATTRIBUTE = CONTRACTS.coverage.exemption_attribute;
const STAR_EXEMPTION = CONTRACTS.coverage.star_page_exemption_value;
const CONTROL_EXEMPTION = CONTRACTS.coverage.control_page_exemption_value;
const OPACITY_PROPERTY = CONTRACTS.presentation.page_owned_opacity_property;
const OPACITY_MINIMUM = Number(CONTRACTS.presentation.opacity_bounds.minimum);
const OPACITY_MAXIMUM = Number(CONTRACTS.presentation.opacity_bounds.maximum);
if (!EXEMPTION_ATTRIBUTE || !OPACITY_PROPERTY
    || !Number.isFinite(OPACITY_MINIMUM) || !Number.isFinite(OPACITY_MAXIMUM)
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
function assetTags(html, asset) {
  return html.match(new RegExp(`<[^>]+${escapeRegex(asset)}(?:\\?[^"']*)?["'][^>]*>`, 'ig')) || [];
}
function exactAssetVersion(html, asset) {
  const tags = assetTags(html, asset);
  return tags.length === 1 && new RegExp(`${escapeRegex(asset)}\\?v=${escapeRegex(ASSET_VERSION)}(?:["'])`, 'i').test(tags[0]);
}
function geometryKeyFor(route) {
  return geometryKeyForRelativeHtmlPath(route);
}
function registerFor(route) {
  return geometryRegisterForKey(geometryKeyFor(route));
}
function profileFor(route, routeType) { return geometryProfileFor(route, routeType); }
function seedFor(route) {
  return geometrySeedForKey(geometryKeyFor(route));
}

function inspectPageOpacityDeclarations(css, label, errors) {
  const property = escapeRegex(OPACITY_PROPERTY);
  for (const match of String(css).matchAll(new RegExp(`${property}\\s*:\\s*([^;}]+)`, 'ig'))) {
    const authored = match[1].replace(/!important\s*$/i, '').trim();
    const value = Number(authored);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(authored) || !Number.isFinite(value)
        || value < OPACITY_MINIMUM || value > OPACITY_MAXIMUM) {
      errors.push(`${label}: ${OPACITY_PROPERTY} must be a numeric page-owned fade from ${OPACITY_MINIMUM.toFixed(3)} to ${OPACITY_MAXIMUM.toFixed(3)}`);
    }
  }
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
    const declarations = match[2];
    for (const selector of match[1].split(',')) {
      const targetsGeometry = /#indraLayer\b|\.indra-field\b|\.indra-camera\b/.test(selector);
      if (!targetsGeometry || /\.indra-definition-bank\b/.test(selector)) continue;
      if (/(?:^|;)\s*display\s*:\s*(?:none|contents)\b/i.test(declarations)) failures.push('display');
      if (/(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)\b/i.test(declarations)) failures.push('visibility');
      if (/(?:^|;)\s*opacity\s*:\s*0(?:\.0*)?\s*(?:!important\s*)?(?:;|$)/i.test(declarations)) failures.push('opacity');
      if (/(?:^|;)\s*z-index\s*:\s*-/i.test(declarations)) failures.push('negative-z');
      if (/(?:^|;)\s*(?:inline-size|block-size|width|height|max-width|max-height)\s*:\s*0(?:px|rem|em|%|vh|vw|vmin|vmax)?\b/i.test(declarations)) failures.push('zero-size');
      if (/(?:^|;)\s*(?:clip-path\s*:\s*inset\(\s*(?:50|100)%|transform\s*:[^;]*scale(?:3d)?\(\s*0|content-visibility\s*:\s*hidden|filter\s*:[^;]*opacity\(\s*0)/i.test(declarations)) failures.push('clipped');

      /* Descendant and ID-qualified rules can mutate the shared field even
         when the selector does not end at #indraLayer. Class-only Reader View
         declarations are cascade-safe because alive.css protects the layer
         with a stronger ID + !important contract; an ID-qualified mutation
         must remain exact. */
      if (/#indraLayer\b/.test(selector)) {
        const filter = declarations.match(/(?:^|;)\s*filter\s*:\s*([^;]+)/i)?.[1].replace(/!important\s*$/i, '').trim();
        if (filter && filter.toLowerCase() !== 'none') failures.push('color-filter');
        const blend = declarations.match(/(?:^|;)\s*mix-blend-mode\s*:\s*([^;]+)/i)?.[1].replace(/!important\s*$/i, '').trim();
        if (blend && blend.toLowerCase() !== 'normal') failures.push('blend');
        const colour = declarations.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1].replace(/!important\s*$/i, '').trim();
        if (colour && !/^var\(--indra-color\b/i.test(colour)) failures.push('recolor');
      }
      const directlyTargetsLayer = /#indraLayer(?:\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?)*\s*$/.test(selector);
      if (directlyTargetsLayer) {
        const opacity = declarations.match(/(?:^|;)\s*opacity\s*:\s*([^;]+)/i)?.[1].replace(/!important\s*$/i, '').trim();
        if (opacity && !/^var\(--indra-opacity-resolved\b/i.test(opacity)) failures.push('fade-override');
        const background = declarations.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1].replace(/!important\s*$/i, '').trim();
        if (background && !/^(?:none|transparent|rgba\([^)]*,\s*0(?:\.0*)?\s*\))$/i.test(background)) failures.push('field-background');
      }
    }
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
    const exemption = geometryExemptionForRelativeHtmlPath(CONTRACTS, route);
    if (exemption) {
      if (!exactAssetVersion(html, '/css/alive.css')) errors.push(`${label}:${route}: shared non-geometry CSS must use content token ${ASSET_VERSION}`);
      for (const asset of ['/js/mandala.js', '/js/indra.js']) {
        if (assetTags(html, asset).length !== 0) errors.push(`${label}:${route}: ${exemption} page must not load shared ${asset}`);
      }
      if ((body.match(new RegExp(`\\b${escapeRegex(EXEMPTION_ATTRIBUTE)}\\s*=`, 'ig')) || []).length !== 1
          || attr(body, EXEMPTION_ATTRIBUTE) !== exemption) {
        errors.push(`${label}:${route}: expected ${EXEMPTION_ATTRIBUTE}="${exemption}" exactly once`);
      }
      for (const name of ['data-geometry', 'data-indra-intensity', 'data-indra-fade-source', 'data-geometry-role', 'data-geometry-key', 'data-geometry-seed', 'data-geometry-register', 'data-geometry-profile', 'data-geometry-surface', 'data-geometry-engine']) {
        if (new RegExp(`\\b${name}\\s*=`, 'i').test(body)) errors.push(`${label}:${route}: ${exemption} page retained ${name}`);
      }
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
      if (!exactAssetVersion(html, asset)) errors.push(`${label}:${route}: ${asset} must appear once with content token ${ASSET_VERSION}`);
    }
    const mandalaPosition = html.search(/<script\b[^>]*\/js\/mandala\.js/i);
    const indraPosition = html.search(/<script\b[^>]*\/js\/indra\.js/i);
    const footerPosition = html.search(/<script\b[^>]*\/js\/footer\.js/i);
    if (!(mandalaPosition >= 0 && indraPosition > mandalaPosition && (footerPosition < 0 || footerPosition > indraPosition))) errors.push(`${label}:${route}: geometry order must be mandala, indra, footer`);

    const required = ['data-route-type', 'data-geometry', 'data-indra-intensity', 'data-indra-fade-source', 'data-geometry-role', 'data-geometry-key', 'data-geometry-seed', 'data-geometry-register', 'data-geometry-profile', 'data-front-facing'];
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
    if (!Number.isFinite(intensity) || intensity < OPACITY_MINIMUM || intensity > OPACITY_MAXIMUM) {
      errors.push(`${label}:${route}: data-indra-intensity must remain within ${OPACITY_MINIMUM.toFixed(3)}–${OPACITY_MAXIMUM.toFixed(3)}`);
    }
    const fadeSource = attr(body, 'data-indra-fade-source');
    if (!/^(?:page|route-register)$/.test(fadeSource)) errors.push(`${label}:${route}: invalid resolved fade source`);
    const ownerOpacity = geometryOwnerOpacityForKey(CONTRACTS, geometryKeyFor(route), routeType);
    if (ownerOpacity !== null) {
      if (fadeSource !== 'page' || Math.abs(intensity - ownerOpacity) > 0.0001) errors.push(`${label}:${route}: grounded page-owner fade must resolve to ${ownerOpacity.toFixed(3)}`);
    } else if (fadeSource === 'route-register') {
      const registerOpacity = Number(CONTRACTS.registers[register].default_intensity);
      if (Math.abs(intensity - registerOpacity) > 0.0001) errors.push(`${label}:${route}: route-register fallback must resolve to ${registerOpacity.toFixed(3)}`);
    }
    if (/\bid=["']indraLayer["']/i.test(html)) errors.push(`${label}:${route}: page hardcodes runtime-owned #indraLayer`);
    if (/getElementById\(["']indraLayer["']\)[\s\S]{0,160}(?:remove\(|display\s*=\s*["']none|visibility\s*=\s*["']hidden)/i.test(html)) errors.push(`${label}:${route}: page script removes or hides canonical geometry`);
    const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
    const screenInline = stripAllowedMedia(inline);
    if (/#indraLayer\s*\{[^{}]*(?<![-\w])opacity\s*:/i.test(screenInline)) errors.push(`${label}:${route}: inline CSS directly overrides canonical geometry opacity`);
    inspectPageOpacityDeclarations(screenInline, `${label}:${route}`, errors);
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
const sourceStats = { pages: 0, starPages: 0, controlPages: 0, redirects: 0, noindex: 0 };
const publicStats = { pages: 0, starPages: 0, controlPages: 0, redirects: 0, noindex: 0 };
inspect(source, ROOT, 'source', errors, sourceStats);
inspect(deployed, PUBLIC, 'public', errors, publicStats);
const sourceRoutes = new Set(source.map(file => rel(ROOT, file)).filter(route => route !== GOOGLE_TOKEN));
const publicRoutes = new Set(deployed.map(file => rel(PUBLIC, file)).filter(route => route !== GOOGLE_TOKEN));
for (const route of sourceRoutes) if (geometryExemptionForRelativeHtmlPath(CONTRACTS, route) !== CONTROL_EXEMPTION && !publicRoutes.has(route)) errors.push(`public:${route}: source route has no deploy twin`);
for (const route of publicRoutes) if (!sourceRoutes.has(route)) errors.push(`source:${route}: public route has no source twin`);
const expectedStarPages = Number(CONTRACTS.coverage.expected_current_star_pages);
const expectedControlPages = Number(CONTRACTS.coverage.expected_current_control_pages_source);
const expectedPublicControls = Number(CONTRACTS.coverage.expected_current_control_pages_public);
if (sourceStats.starPages !== expectedStarPages) errors.push(`source: expected ${expectedStarPages} canonical star pages, found ${sourceStats.starPages}`);
if (publicStats.starPages !== expectedStarPages) errors.push(`public: expected ${expectedStarPages} canonical star pages, found ${publicStats.starPages}`);
if (sourceStats.controlPages !== expectedControlPages) errors.push(`source: expected ${expectedControlPages} internal control page, found ${sourceStats.controlPages}`);
if (publicStats.controlPages !== expectedPublicControls) errors.push(`public: expected ${expectedPublicControls} internal control pages, found ${publicStats.controlPages}`);

const alive = fs.readFileSync(path.join(ROOT, 'css', 'alive.css'), 'utf8');
if (!/#indraLayer\s*\{[\s\S]{0,550}position:\s*fixed[\s\S]{0,550}z-index:\s*2147483000[\s\S]{0,550}pointer-events:\s*none/.test(alive)) errors.push('css/alive.css must keep #indraLayer fixed, above opaque legacy wrappers, and pointer-safe');
if (!/#indraLayer\s*\{[\s\S]{0,700}opacity:\s*var\(--indra-opacity-resolved,[^;]+\)\s*!important[\s\S]{0,260}filter:\s*none\s*!important[\s\S]{0,500}mix-blend-mode:\s*normal\s*!important/.test(alive)) errors.push('css/alive.css must protect the resolved fade and exact rainbow from Reader View and page filters');
if (!/#indraLayer\s+\.indra-camera\s*\{[\s\S]{0,500}position:\s*absolute[\s\S]{0,500}will-change:\s*transform/.test(alive)) errors.push('css/alive.css must define compositor-only camera surfaces');
if (!/#indraLayer\s+\.geo-stroke\s*\{[\s\S]{0,220}vector-effect:\s*non-scaling-stroke/.test(alive)) errors.push('css/alive.css must keep the restored geometry fine-lined at every camera zoom');
if (/\.indra-coverage\b/.test(alive) || /\bfilter\s*:\s*(?:drop-shadow|blur)\(/i.test(alive.slice(0, alive.indexOf('ZOOM_RESILIENCE_CONTRACT')))) errors.push('css/alive.css reintroduces the filtered static coverage presentation');
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
for (const token of ['shared-background-web', 'normalized-path-scroll', 'indra-definition-bank', 'indra-canonical-symbol', 'canonical-use', 'dual-field', 'fine-line-rainbow-dual', 'RAINBOW_PALETTE', 'static-reduced', 'scroll-responsive', 'data-geometry-motion-source', 'element-scroll']) {
  if (!indra.includes(token)) errors.push(`js/indra.js missing canonical runtime contract ${token}`);
}
if (/indra-coverage|canonical-static-wide|feMorphology|operator=\\?"dilate\\?"/.test(indra)) errors.push('js/indra.js reintroduces the square/bubble coverage renderer');
if (!/mountCamera\('primary', false\);[\s\S]{0,100}mountCamera\('secondary', true\);/.test(indra)) errors.push('js/indra.js must mount the two independent original field cameras on every included page');
if (!/setProperty\('--indra-color', rainbowColor\(progress\)\)/.test(indra)) errors.push('js/indra.js must move the original spectrum with scroll progress');
const paletteMatch = indra.match(/var RAINBOW_HEX\s*=\s*Object\.freeze\(\s*(\[[\s\S]*?\])\s*\);/);
let runtimePalette = null;
try { runtimePalette = paletteMatch ? JSON.parse(paletteMatch[1].replace(/'/g, '"')) : null; } catch (_) {}
if (JSON.stringify(runtimePalette) !== JSON.stringify(CONTRACTS.presentation.rainbow_palette)) errors.push('js/indra.js rainbow palette differs from the single canonical spectrum');
if (!new RegExp(`body\\.hasAttribute\\('${escapeRegex(EXEMPTION_ATTRIBUTE)}'\\)`).test(indra)) errors.push('js/indra.js lacks the shared geometry-exemption no-mount guard');
if (!indra.includes(OPACITY_PROPERTY)) errors.push(`js/indra.js must resolve the page-owned ${OPACITY_PROPERTY} fade`);
for (const [register, registerContract] of Object.entries(CONTRACTS.registers)) {
  const intensity = Number(registerContract.default_intensity);
  if (!Number.isFinite(intensity) || intensity < OPACITY_MINIMUM || intensity > OPACITY_MAXIMUM) {
    errors.push(`geometry register ${register} default intensity falls outside canonical opacity bounds`);
  }
}
if (!/SCROLL_PAINT_FALLBACK_MS\s*=\s*48/.test(indra) || !/cancelAnimationFrame\(raf\)/.test(indra)) errors.push('js/indra.js must retain its bounded 48ms scroll paint fallback');
if (/pageStructureFacts|querySelectorAll\([^)]*(?:main|section|article|h1)|location\.(?:search|hash)/.test(indra)) errors.push('js/indra.js may not derive geometry from DOM structure, query, or hash');
if (/setInterval\s*\(/.test(indra)) errors.push('js/indra.js may not use permanent interval animation');
if (!/document\.addEventListener\('scroll', onElementScroll, \{ passive: true, capture: true \}\)/.test(indra)) errors.push('js/indra.js does not listen to the visitor-owned nested scroll surface');
if (!/document\.addEventListener\('wheel', onWheel, \{ passive: true, capture: true \}\)/.test(indra)) errors.push('js/indra.js lacks the full-screen wheel fallback');
if (!/panPointerId === null/.test(indra) || !/panSurface\(event\.target\)/.test(indra)) errors.push('js/indra.js pointer fallback is not restricted to a pressed pan/zoom surface');

const geometryApplicator = fs.readFileSync(path.join(ROOT, 'scripts', 'apply-visible-geometry.js'), 'utf8');
if (!/refreshTranslationGovernanceForSources\(ROOT, changedSources\)/.test(geometryApplicator)) {
  errors.push('scripts/apply-visible-geometry.js can leave presentation-only source rewrites stale in translation governance');
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
console.log(`VISIBLE GEOMETRY CHECK PASSED — ${sourceStats.pages} source and ${publicStats.pages} public included pages use content token ${ASSET_VERSION}, one exact spectrum, protected page-fit fading, and document/nested/full-screen input ownership; ${sourceStats.starPages} source/${publicStats.starPages} public star pages and ${sourceStats.controlPages} source-only control remain free of shared geometry.`);
