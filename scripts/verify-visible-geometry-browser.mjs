#!/usr/bin/env node
'use strict';

/*
 * Rendered release gate for the universal canonical rainbow geometry field.
 * Static markers are insufficient: every distinct public surface must produce
 * visible pixels, keep input/layout isolated, and move every camera on scroll.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const {
  geometryExemptionForRelativeHtmlPath,
  isGeometryExemptRelativeHtmlPath,
} = require('./lib/geometry-asset-version');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SITE_ROOT = process.env.GEOMETRY_SITE_ROOT
  ? path.resolve(process.env.GEOMETRY_SITE_ROOT)
  : PUBLIC;
const CONTRACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'));
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const NAVIGATION_TIMEOUT_MS = 45_000;
const READY_TIMEOUT_MS = 15_000;
const SCREENSHOT_TIMEOUT_MS = 60_000;
const SCROLL_SETTLE_TIMEOUT_MS = 5_000;
const SCROLL_POSITION_TOLERANCE_PX = 2;
const GEOMETRY_PROGRESS_TOLERANCE = 0.002;
const PIXEL_THRESHOLDS = {
  quiet: { mean: 0.006, changedPercent: 0.15, activeCells: 3 },
  standard: { mean: 0.006, changedPercent: 0.25, activeCells: 4 },
  expressive: { mean: 0.006, changedPercent: 0.35, activeCells: 4 },
};
const FOCUSED_ROUTES = String(process.env.GEOMETRY_ROUTES || '')
  .split(',').map(value => value.trim()).filter(Boolean);
const GEOMETRY_BROWSER_CONCURRENCY = Number(
  process.env.GEOMETRY_BROWSER_CONCURRENCY || 4,
);
if (
  !Number.isInteger(GEOMETRY_BROWSER_CONCURRENCY)
  || GEOMETRY_BROWSER_CONCURRENCY < 1
  || GEOMETRY_BROWSER_CONCURRENCY > 4
) {
  throw new Error('GEOMETRY_BROWSER_CONCURRENCY must be an integer from 1 through 4');
}
/* These routes are deliberately not deduplicated through surfaceSignature().
   They are causal regression probes for real page input models that the
   representative renderer cannot infer from body attributes or stylesheet
   names alone. Nothing in these probes manufactures document height. */
const NESTED_SCROLL_PROBES = Object.freeze([
  Object.freeze({
    route: '/campaigns/thank-you-mam/dm-board/',
    selectors: Object.freeze(['.left', '.center', '.right']),
    viewport: Object.freeze({ width: 1280, height: 720 }),
  }),
  Object.freeze({
    route: '/bookwormcard/',
    selectors: Object.freeze(['#chat', '#menu', '#card-preview']),
    viewport: Object.freeze({ width: 1280, height: 700 }),
    activate: '#start-wormcard',
    readyTimeout: 30_000,
  }),
]);
const FULLSCREEN_MOTION_PROBES = Object.freeze([
  Object.freeze({ route: '/leizu/cloud/', selector: '#canvas' }),
  Object.freeze({ route: '/leizu/fa/cloud/', selector: '#canvas' }),
  Object.freeze({ route: '/leizu/fr/cloud/', selector: '#canvas' }),
  Object.freeze({ route: '/leizu/zh-hans/cloud/', selector: '#canvas' }),
  Object.freeze({ route: '/leizu/zh-hant/cloud/', selector: '#canvas' }),
  Object.freeze({ route: '/polymyth/sitemap/graph/', selector: '#graph-svg' }),
]);
const READER_VIEW_PROBE_ROUTE = '/polymyth/';

function normalizedRelativeHtmlPath(file) {
  return path.relative(SITE_ROOT, file).replace(/\\/g, '/');
}

function normalizeCanonicalIds(markup) {
  return String(markup)
    .replace(/[a-zA-Z0-9_-]+-jewel-(?:core|prism)/g, 'canonical-jewel')
    .replace(/\s+/g, ' ');
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function runtimeCanonicalHash(markup) {
  const normalized = String(markup)
    .replace(/indra-(?:primary|secondary)-jewel-(?:core|prism)/g, 'indra-camera-jewel')
    .replace(/\s+/g, ' ');
  return (`00000000${fnv1a(normalized).toString(16)}`).slice(-8);
}

function rgbTuple(hex) {
  const match = String(hex).trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return match.slice(1).map(value => Number.parseInt(value, 16));
}

function parseComputedRgb(value) {
  const match = String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

function expectedRainbowRgb(progress) {
  const palette = CONTRACTS.presentation.rainbow_palette.map(rgbTuple);
  const scaled = Math.max(0, Math.min(1, progress)) * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return [0, 1, 2].map(channel => Math.round(
    palette[index][channel] + (palette[index + 1][channel] - palette[index][channel]) * local,
  ));
}

function sameRgb(actualCss, expected) {
  const actual = parseComputedRgb(actualCss);
  return actual && expected.every((value, index) => Math.abs(value - actual[index]) <= 1);
}

const startupErrors = [];
const fadeBounds = CONTRACTS.presentation.opacity_bounds || {};
const FADE_MIN = Number(fadeBounds.minimum);
const FADE_MAX = Number(fadeBounds.maximum);
if (!Number.isFinite(FADE_MIN) || !Number.isFinite(FADE_MAX) || FADE_MIN <= 0 || FADE_MAX < FADE_MIN || FADE_MAX > 1) {
  startupErrors.push(`invalid presentation fade bounds ${JSON.stringify(fadeBounds)}`);
}
const mandalaSource = fs.readFileSync(path.join(ROOT, 'js', 'mandala.js'), 'utf8');
const indraSource = fs.readFileSync(path.join(ROOT, 'js', 'indra.js'), 'utf8');
const mandalaWindow = {};
vm.runInNewContext(mandalaSource, { window: mandalaWindow, console, Math, Object });
const canonicalMarkup = mandalaWindow.PolymythMandala?.buildCanonical?.({ idPrefix: 'indra-shared' }) || '';
const EXPECTED_RUNTIME_CANONICAL_HASH = runtimeCanonicalHash(canonicalMarkup);
const normalizedCanonicalHash = crypto.createHash('sha256').update(normalizeCanonicalIds(canonicalMarkup)).digest('hex');
if (!canonicalMarkup || normalizedCanonicalHash !== CONTRACTS.canonical_web.normalized_sha256) {
  startupErrors.push(`canonical mandala digest ${normalizedCanonicalHash || '(missing)'} does not equal ${CONTRACTS.canonical_web.normalized_sha256}`);
}
const paletteBlock = indraSource.match(/var\s+RAINBOW_HEX\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
const sourcePalette = paletteBlock
  ? [...paletteBlock[1].matchAll(/['"](#[0-9a-f]{6})['"]/g)].map(match => match[1])
  : [];
if (JSON.stringify(sourcePalette) !== JSON.stringify(CONTRACTS.presentation.rainbow_palette.map(value => value.toLowerCase()))) {
  startupErrors.push(`runtime rainbow palette ${JSON.stringify(sourcePalette)} does not equal the exact contract palette`);
}
if (sourcePalette.length !== 8) startupErrors.push(`runtime rainbow palette must contain exactly 8 colours; found ${sourcePalette.length}`);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('screenshot is not PNG');
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(colorType)) throw new Error(`unsupported PNG depth=${bitDepth} type=${colorType}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const stride = width * channels;
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const rows = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[source++];
    const row = rows.subarray(y * stride, (y + 1) * stride);
    const prior = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[source++];
      const left = x >= channels ? row[x - channels] : 0;
      const up = prior ? prior[x] : 0;
      const upperLeft = prior && x >= channels ? prior[x - channels] : 0;
      if (filter === 0) row[x] = raw;
      else if (filter === 1) row[x] = raw + left;
      else if (filter === 2) row[x] = raw + up;
      else if (filter === 3) row[x] = raw + Math.floor((left + up) / 2);
      else if (filter === 4) row[x] = raw + paeth(left, up, upperLeft);
      else throw new Error(`unsupported PNG filter ${filter}`);
    }
  }
  return { width, height, channels, colorType, rows };
}
function pixelDifference(shownBuffer, hiddenBuffer) {
  const a = decodePng(shownBuffer), b = decodePng(hiddenBuffer);
  if (a.width !== b.width || a.height !== b.height || a.colorType !== b.colorType) throw new Error('geometry screenshots have incompatible formats');
  let changed = 0, totalDifference = 0;
  const pixels = a.width * a.height;
  const cellChanged = new Array(9).fill(0);
  const cellPixels = new Array(9).fill(0);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const x = pixel % a.width;
    const y = Math.floor(pixel / a.width);
    const cellX = Math.min(2, Math.floor(x * 3 / a.width));
    const cellY = Math.min(2, Math.floor(y * 3 / a.height));
    const cell = cellY * 3 + cellX;
    cellPixels[cell] += 1;
    const ai = pixel * a.channels, bi = pixel * b.channels;
    const ar = a.rows[ai], ag = [0, 4].includes(a.colorType) ? ar : a.rows[ai + 1], ab = [0, 4].includes(a.colorType) ? ar : a.rows[ai + 2];
    const br = b.rows[bi], bg = [0, 4].includes(b.colorType) ? br : b.rows[bi + 1], bb = [0, 4].includes(b.colorType) ? br : b.rows[bi + 2];
    const difference = Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
    if (difference >= 3) { changed += 1; cellChanged[cell] += 1; totalDifference += difference; }
  }
  const activeCells = cellChanged.filter((count, index) => count / cellPixels[index] * 100 >= 0.01).length;
  return {
    changedPercent: changed / pixels * 100,
    meanChanged: changed ? totalDifference / (changed * 3 * 255) : 0,
    activeCells,
    cellChangedPercent: cellChanged.map((count, index) => count / cellPixels[index] * 100),
  };
}
function translation(transform) {
  const match = String(transform || '').match(/translate3d\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/i);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
}
function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'fixtures' || (SITE_ROOT === ROOT && entry.name === 'public')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
function bodyAttr(html, name) {
  const body = html.match(/<body\b[^>]*>/i);
  const match = body && body[0].match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']+)\\1`, 'i'));
  return match ? match[2] : '';
}
function routeFor(file) {
  const relative = path.relative(SITE_ROOT, file).replace(/\\/g, '/');
  if (relative === 'index.html') return '/';
  return `/${relative.replace(/index\.html$/, '')}`;
}
function fileForRoute(route) {
  const pathname = new URL(route, 'https://example.invalid').pathname;
  const relative = pathname.replace(/^\/+/, '');
  return path.join(SITE_ROOT, relative && !pathname.endsWith('/') ? relative : `${relative}index.html`);
}
function orderedLocalCss(html) {
  return [...html.matchAll(/<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/ig)]
    .map(match => match[1] || match[2]).filter(href => !/^(?:[a-z]+:)?\/\//i.test(href));
}
function surfaceSignature(html) {
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
  return JSON.stringify({
    routeType: bodyAttr(html, 'data-route-type'),
    register: bodyAttr(html, 'data-geometry-register'),
    profile: bodyAttr(html, 'data-geometry-profile'),
    bodyClass: bodyAttr(html, 'class').trim().replace(/\s+/g, ' '),
    localCss: orderedLocalCss(html),
    inlineStyleHash: crypto.createHash('sha256').update(inline).digest('hex'),
  });
}
function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  let relative = pathname.replace(/^\/+/, '');
  if (!relative || pathname.endsWith('/')) relative += 'index.html';
  let file = path.resolve(SITE_ROOT, relative);
  if (file !== SITE_ROOT && !file.startsWith(SITE_ROOT + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
  response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;

const representatives = new Map();
const exemptPages = [];
const routeTypesSeen = new Set();
const allHtmlFiles = walk(SITE_ROOT);
const focusedFiles = FOCUSED_ROUTES.length ? new Set(FOCUSED_ROUTES.map(fileForRoute)) : null;
for (const file of allHtmlFiles) {
  if (!fs.existsSync(file)) throw new Error(`geometry browser route file missing: ${file}`);
  if (path.basename(file) === GOOGLE_TOKEN) continue;
  const html = fs.readFileSync(file, 'utf8');
  const relative = normalizedRelativeHtmlPath(file);
  const exemption = geometryExemptionForRelativeHtmlPath(CONTRACTS, relative);
  if (Boolean(exemption) !== isGeometryExemptRelativeHtmlPath(CONTRACTS, relative)) {
    throw new Error(`${relative}: central geometry exemption classifiers disagree`);
  }
  const routeType = bodyAttr(html, 'data-route-type');
  /* Exempt pages are still rendered below and therefore remain valid public
     representatives of their declared route family. Count their route type
     before the geometry-exemption branch; only the shared-Indra surface map
     should exclude them. */
  if (routeType) routeTypesSeen.add(routeType);
  if (exemption) {
    exemptPages.push({ file, html, relative, route: routeFor(file), routeType, exemption });
    continue;
  }
  if (!routeType) continue;
  if (focusedFiles && !focusedFiles.has(file)) continue;
  const signature = FOCUSED_ROUTES.length || routeFor(file) === '/polymyth/alwaysalready/'
    ? routeFor(file) : surfaceSignature(html);
  if (!representatives.has(signature)) representatives.set(signature, {
    file, html, relative, route: routeFor(file), routeType,
  });
}
const starPages = exemptPages.filter(page => page.exemption === 'star-file');
const controlPages = exemptPages.filter(page => page.exemption === 'internal-control');
const expectedStarPages = Number(CONTRACTS.coverage.expected_current_star_pages);
const expectedControlPages = SITE_ROOT === PUBLIC
  ? Number(CONTRACTS.coverage.expected_current_control_pages_public)
  : Number(CONTRACTS.coverage.expected_current_control_pages_source);
if (starPages.length !== expectedStarPages) {
  startupErrors.push(`central classifier found ${starPages.length} star pages under ${SITE_ROOT}; expected ${expectedStarPages}`);
}
if (controlPages.length !== expectedControlPages) {
  startupErrors.push(`central classifier found ${controlPages.length} internal-control pages under ${SITE_ROOT}; expected ${expectedControlPages}`);
}
if (!FOCUSED_ROUTES.length && SITE_ROOT === PUBLIC) {
  const missing = Object.keys(CONTRACTS.route_types).filter(type => !routeTypesSeen.has(type));
  if (missing.length) {
    server.close();
    console.error(`VISIBLE GEOMETRY BROWSER CHECK FAILED — no public representative: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const customExecutable = process.env.CHROME_EXECUTABLE || '';
const browser = await chromium.launch({
  headless: true,
  executablePath: customExecutable || chromium.executablePath(),
  args: customExecutable ? ['--no-sandbox', '--disable-gpu'] : [],
});
const errors = [...startupErrors];
const canonicalHashes = new Set();
let checks = 0;
let causalChecks = 0;

function collectRuntimeFailures(page) {
  const failures = [];
  page.on('pageerror', error => failures.push(`uncaught ${error.message}`));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400) {
      failures.push(`same-origin ${response.status()} ${url.pathname}`);
    }
  });
  return failures;
}

async function load(page, representative, suffix = '') {
  const isRedirect = representative.routeType === 'redirect' || /http-equiv=["']refresh["']/i.test(representative.html);
  if (isRedirect) {
    const fallback = representative.html
      .replace(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/ig, '')
      .replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/ig, script =>
        /\blocation\s*(?:=|\.(?:replace|assign)\s*\()/.test(script) ? '' : script);
    await page.route(origin + representative.route + suffix, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fallback }), { times: 1 });
  }
  await page.goto(origin + representative.route + suffix, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-geometry-ready') === 'true', null, { timeout: READY_TIMEOUT_MS });
  return isRedirect;
}

async function loadExempt(page, representative) {
  await page.goto(origin + representative.route, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete', null, { timeout: READY_TIMEOUT_MS });
}

async function cameraSamples(page) {
  return page.evaluate(() => [...document.querySelectorAll('#indraLayer .indra-camera')].map(camera => ({
    name: camera.getAttribute('data-geometry-camera') || '',
    transform: camera.style.transform,
    progress: camera.style.getPropertyValue('--indra-progress'),
  })));
}

async function settleScrollSample(page, fraction, geometryMode = 'scroll', fallbackProgress = 0.32) {
  await page.evaluate(position => {
    const layer = document.getElementById('indraLayer');
    if (layer) delete layer.__geometryGateSettledSignature;
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    scrollTo(0, maximum * position);
  }, fraction);
  const settled = await page.waitForFunction(
    ({ position, mode, fallback, positionTolerance, progressTolerance }) => {
      const root = document.documentElement;
      const layer = document.getElementById('indraLayer');
      if (!layer) return false;
      const maximum = Math.max(0, root.scrollHeight - innerHeight);
      const target = maximum * position;
      const actual = window.scrollY || root.scrollTop || 0;
      if (Math.abs(actual - target) > positionTolerance) {
        scrollTo(0, target);
        delete layer.__geometryGateSettledSignature;
        return false;
      }
      const layerProgress = Number.parseFloat(layer.getAttribute('data-geometry-progress') || '');
      const expectedProgress = mode === 'static'
        ? 0
        : maximum > 1 ? actual / maximum : fallback;
      const cameras = [...layer.querySelectorAll('.indra-camera')];
      if (
        !Number.isFinite(layerProgress)
        || Math.abs(layerProgress - expectedProgress) > progressTolerance
        || !cameras.length
      ) return false;
      const cameraState = cameras.map(camera => ({
        progress: Number.parseFloat(camera.style.getPropertyValue('--indra-progress')),
        transform: camera.style.transform,
      }));
      if (cameraState.some(camera =>
        !Number.isFinite(camera.progress)
        || Math.abs(camera.progress - expectedProgress) > progressTolerance
        || !camera.transform
        || camera.transform === 'none')) return false;
      /* Require two consecutive identical observations after scroll position,
         layer progress, and every camera transform agree. This proves the
         compositor input has converged instead of sampling a stale frame after
         an arbitrary sleep. */
      const signature = JSON.stringify([
        Math.round(actual), maximum, layerProgress,
        cameraState.map(camera => [camera.progress, camera.transform]),
      ]);
      if (layer.__geometryGateSettledSignature !== signature) {
        layer.__geometryGateSettledSignature = signature;
        return false;
      }
      delete layer.__geometryGateSettledSignature;
      return true;
    },
    {
      position: fraction,
      mode: geometryMode,
      fallback: fallbackProgress,
      positionTolerance: SCROLL_POSITION_TOLERANCE_PX,
      progressTolerance: GEOMETRY_PROGRESS_TOLERANCE,
    },
    { timeout: SCROLL_SETTLE_TIMEOUT_MS, polling: 20 },
  );
  await settled.dispose();
}

function requiredRepresentative(route) {
  const file = fileForRoute(route);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    errors.push(`natural-motion:${route}: required route file is missing`);
    return null;
  }
  const html = fs.readFileSync(file, 'utf8');
  const relative = normalizedRelativeHtmlPath(file);
  const exemption = geometryExemptionForRelativeHtmlPath(CONTRACTS, relative);
  const routeType = bodyAttr(html, 'data-route-type');
  if (exemption) {
    errors.push(`natural-motion:${route}: required causal route is unexpectedly ${exemption}`);
    return null;
  }
  if (!routeType) {
    errors.push(`natural-motion:${route}: required causal route has no data-route-type`);
    return null;
  }
  return { file, html, relative, route, routeType };
}

async function isolateLocalRequests(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
}

async function motionSnapshot(page) {
  return page.evaluate(() => {
    const layer = document.getElementById('indraLayer');
    const scrolling = document.scrollingElement || document.documentElement;
    if (!layer) return { missing: true };
    const style = getComputedStyle(layer);
    return {
      missing: false,
      progress: Number.parseFloat(layer.getAttribute('data-geometry-progress') || ''),
      source: layer.getAttribute('data-geometry-motion-source') || '',
      motion: layer.getAttribute('data-geometry-motion') || '',
      color: style.color,
      filter: style.filter,
      opacity: Number.parseFloat(style.opacity),
      mixBlendMode: style.mixBlendMode,
      palette: layer.getAttribute('data-geometry-palette') || '',
      canonicalHash: layer.getAttribute('data-geometry-canonical-hash') || '',
      bodyIntensity: Number.parseFloat(document.body.getAttribute('data-indra-intensity') || ''),
      documentRange: Math.max(0, scrolling.scrollHeight - innerHeight),
      documentScrollTop: window.scrollY || scrolling.scrollTop || 0,
      documentScrollHeight: scrolling.scrollHeight,
      cameras: [...layer.querySelectorAll(':scope > .indra-camera')].map(camera => ({
        transform: camera.style.transform,
        progress: Number.parseFloat(camera.style.getPropertyValue('--indra-progress')),
      })),
    };
  });
}

function assertExactMotionState(state, prefix, expectedSource = '', expectedProgress = null) {
  if (state.missing) {
    errors.push(`${prefix}: #indraLayer missing`);
    return;
  }
  const expectedPalette = CONTRACTS.presentation.rainbow_palette.map(value => value.toLowerCase()).join(',');
  if (!Number.isFinite(state.progress)) errors.push(`${prefix}: geometry progress is not finite`);
  if (expectedSource && state.source !== expectedSource) errors.push(`${prefix}: motion source is ${state.source || 'missing'}; expected ${expectedSource}`);
  if (state.motion !== 'scroll-responsive') errors.push(`${prefix}: geometry motion marker is ${state.motion || 'missing'}`);
  if (expectedProgress !== null && Math.abs(state.progress - expectedProgress) > GEOMETRY_PROGRESS_TOLERANCE) {
    errors.push(`${prefix}: geometry progress ${state.progress} differs from real input progress ${expectedProgress}`);
  }
  if (state.palette.toLowerCase() !== expectedPalette) errors.push(`${prefix}: exact eight-colour palette marker changed`);
  if (!sameRgb(state.color, expectedRainbowRgb(state.progress))) errors.push(`${prefix}: rendered colour ${state.color} does not match exact palette interpolation at ${state.progress}`);
  if (state.canonicalHash !== EXPECTED_RUNTIME_CANONICAL_HASH) errors.push(`${prefix}: canonical hash changed to ${state.canonicalHash || 'missing'}`);
  if (state.cameras.length !== CONTRACTS.presentation.cameras) errors.push(`${prefix}: expected ${CONTRACTS.presentation.cameras} cameras, found ${state.cameras.length}`);
  if (state.cameras.some(camera => !camera.transform || camera.transform === 'none'
      || !Number.isFinite(camera.progress)
      || Math.abs(camera.progress - state.progress) > GEOMETRY_PROGRESS_TOLERANCE)) {
    errors.push(`${prefix}: camera transform/progress does not agree with the causal layer progress`);
  }
}

async function setNestedScrollFraction(page, selector, fraction) {
  await page.locator(selector).evaluate((element, position) => {
    const range = Math.max(0, element.scrollHeight - element.clientHeight);
    element.scrollTop = range * position;
  }, fraction);
  const settled = await page.waitForFunction(
    ({ selector: targetSelector, position, positionTolerance, progressTolerance }) => {
      const element = document.querySelector(targetSelector);
      const layer = document.getElementById('indraLayer');
      if (!element || !layer) return false;
      const range = Math.max(0, element.scrollHeight - element.clientHeight);
      if (range <= 1) return false;
      const expectedTop = range * position;
      if (Math.abs(element.scrollTop - expectedTop) > positionTolerance) return false;
      const expectedProgress = element.scrollTop / range;
      const progress = Number.parseFloat(layer.getAttribute('data-geometry-progress') || '');
      const cameras = [...layer.querySelectorAll(':scope > .indra-camera')];
      return layer.getAttribute('data-geometry-motion-source') === 'element-scroll'
        && Number.isFinite(progress)
        && Math.abs(progress - expectedProgress) <= progressTolerance
        && cameras.length === 2
        && cameras.every(camera => {
          const cameraProgress = Number.parseFloat(camera.style.getPropertyValue('--indra-progress'));
          return Number.isFinite(cameraProgress)
            && Math.abs(cameraProgress - expectedProgress) <= progressTolerance
            && camera.style.transform && camera.style.transform !== 'none';
        });
    },
    {
      selector,
      position: fraction,
      positionTolerance: SCROLL_POSITION_TOLERANCE_PX,
      progressTolerance: GEOMETRY_PROGRESS_TOLERANCE,
    },
    { timeout: SCROLL_SETTLE_TIMEOUT_MS, polling: 20 },
  );
  await settled.dispose();
}

async function verifyNestedScrollProbe(probe) {
  const representative = requiredRepresentative(probe.route);
  if (!representative) return;
  const context = await browser.newContext({ viewport: probe.viewport || { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  const prefix = `natural-nested:${probe.route}`;
  await isolateLocalRequests(page);
  try {
    await load(page, representative);
    if (probe.activate) {
      const activation = page.locator(probe.activate);
      await activation.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
      await activation.click();
      await page.waitForFunction(() => document.body.classList.contains('wormcard-started')
        && !document.body.classList.contains('bypass-mode'), null, { timeout: READY_TIMEOUT_MS });
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const baseline = await motionSnapshot(page);
    if (baseline.documentRange > SCROLL_POSITION_TOLERANCE_PX) {
      errors.push(`${prefix}: document unexpectedly has ${baseline.documentRange}px of scroll; this probe must exercise the real nested scroller`);
    }
    /* Bookwormcard types its opening lines asynchronously. Wait for the real
       content to create overflow; do not plant content or alter page height. */
    await page.waitForFunction(selectors => selectors.some(selector => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor);
        if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden'
            || Number.parseFloat(ancestorStyle.opacity) <= 0.01) return false;
      }
      return rect.width > 2 && rect.height > 2 && style.display !== 'none'
        && style.visibility !== 'hidden'
        && /^(?:auto|scroll|overlay)$/.test(style.overflowY)
        && element.scrollHeight - element.clientHeight > 40;
    }), probe.selectors, { timeout: probe.readyTimeout || READY_TIMEOUT_MS, polling: 50 });
    const candidates = await page.evaluate(selectors => selectors.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const range = Math.max(0, element.scrollHeight - element.clientHeight);
      let composedVisible = true;
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor);
        if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden'
            || Number.parseFloat(ancestorStyle.opacity) <= 0.01) composedVisible = false;
      }
      return {
        selector,
        range,
        visible: composedVisible && rect.width > 2 && rect.height > 2,
        overflowY: style.overflowY,
      };
    }).filter(candidate => candidate && candidate.visible && candidate.range > 40
      && /^(?:auto|scroll|overlay)$/.test(candidate.overflowY)), probe.selectors);
    if (!candidates.length) {
      errors.push(`${prefix}: no required selector is a visible naturally overflowing element at the desktop viewport`);
      return;
    }
    for (const candidate of candidates) {
      /* Warm the element away from zero so the following top sample is caused
         by a genuine browser scroll event rather than an already-zero value. */
      await setNestedScrollFraction(page, candidate.selector, 0.9);
      const samples = [];
      for (const [fraction, label] of [[0, 'top'], [0.5, 'middle'], [1, 'bottom']]) {
        await setNestedScrollFraction(page, candidate.selector, fraction);
        const state = await motionSnapshot(page);
        const actual = await page.locator(candidate.selector).evaluate(element => ({
          top: element.scrollTop,
          range: Math.max(0, element.scrollHeight - element.clientHeight),
        }));
        const expectedProgress = actual.range > 1 ? actual.top / actual.range : NaN;
        assertExactMotionState(state, `${prefix}:${candidate.selector}:${label}`, 'element-scroll', expectedProgress);
        if (Math.abs(state.documentScrollTop - baseline.documentScrollTop) > SCROLL_POSITION_TOLERANCE_PX
            || Math.abs(state.documentRange - baseline.documentRange) > SCROLL_POSITION_TOLERANCE_PX
            || state.documentScrollHeight !== baseline.documentScrollHeight) {
          errors.push(`${prefix}:${candidate.selector}:${label}: nested motion fabricated or changed document scrolling`);
        }
        samples.push(state);
      }
      for (let index = 0; index < CONTRACTS.presentation.cameras; index += 1) {
        const transforms = samples.map(state => state.cameras[index]?.transform);
        if (new Set(transforms).size !== 3) errors.push(`${prefix}:${candidate.selector}: camera ${index} lacks three nested-scroll views`);
      }
    }
    canonicalHashes.add((await motionSnapshot(page)).canonicalHash);
    checks += 1;
    causalChecks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${prefix}: runtime ${failure}`);
    await context.close();
  }
}

async function waitForVirtualMotion(page, previousProgress, direction) {
  const settled = await page.waitForFunction(
    ({ previous, expectedDirection, progressTolerance }) => {
      const layer = document.getElementById('indraLayer');
      if (!layer || layer.getAttribute('data-geometry-motion-source') !== 'wheel') return false;
      const progress = Number.parseFloat(layer.getAttribute('data-geometry-progress') || '');
      if (!Number.isFinite(progress) || (progress - previous) * expectedDirection <= progressTolerance) return false;
      const cameras = [...layer.querySelectorAll(':scope > .indra-camera')];
      return cameras.length === 2 && cameras.every(camera => {
        const cameraProgress = Number.parseFloat(camera.style.getPropertyValue('--indra-progress'));
        return Number.isFinite(cameraProgress)
          && Math.abs(cameraProgress - progress) <= progressTolerance
          && camera.style.transform && camera.style.transform !== 'none';
      });
    },
    { previous: previousProgress, expectedDirection: direction, progressTolerance: GEOMETRY_PROGRESS_TOLERANCE },
    { timeout: SCROLL_SETTLE_TIMEOUT_MS, polling: 20 },
  );
  await settled.dispose();
}

async function verifyFullscreenMotionProbe(probe) {
  const representative = requiredRepresentative(probe.route);
  if (!representative) return;
  const context = await browser.newContext({ viewport: { width: 1200, height: 720 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  const prefix = `natural-fullscreen:${probe.route}`;
  await isolateLocalRequests(page);
  try {
    await load(page, representative);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const baseline = await motionSnapshot(page);
    assertExactMotionState(baseline, `${prefix}:baseline`);
    if (baseline.documentRange > SCROLL_POSITION_TOLERANCE_PX) {
      errors.push(`${prefix}: document has ${baseline.documentRange}px of scroll; the fullscreen fallback is not being tested`);
    }
    const surface = page.locator(probe.selector);
    await surface.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await surface.hover();
    const wheelDelta = Math.max(1800, 2.5 * 720);
    await page.mouse.wheel(0, wheelDelta);
    await waitForVirtualMotion(page, baseline.progress, 1);
    await page.waitForTimeout(80);
    const advanced = await motionSnapshot(page);
    assertExactMotionState(advanced, `${prefix}:forward-wheel`, 'wheel');
    if (Math.abs(advanced.documentScrollTop - baseline.documentScrollTop) > SCROLL_POSITION_TOLERANCE_PX
        || Math.abs(advanced.documentRange - baseline.documentRange) > SCROLL_POSITION_TOLERANCE_PX
        || advanced.documentScrollHeight !== baseline.documentScrollHeight) {
      errors.push(`${prefix}: wheel fallback fabricated or changed document scrolling`);
    }
    for (let index = 0; index < CONTRACTS.presentation.cameras; index += 1) {
      if (baseline.cameras[index]?.transform === advanced.cameras[index]?.transform) errors.push(`${prefix}: camera ${index} did not respond to the real wheel interaction`);
    }
    await page.waitForTimeout(100);
    const idle = await motionSnapshot(page);
    if (idle.progress !== advanced.progress
        || JSON.stringify(idle.cameras.map(camera => camera.transform)) !== JSON.stringify(advanced.cameras.map(camera => camera.transform))) {
      errors.push(`${prefix}: geometry moves without further fullscreen input`);
    }
    await page.mouse.wheel(0, -wheelDelta);
    await waitForVirtualMotion(page, advanced.progress, -1);
    await page.waitForTimeout(80);
    const reversed = await motionSnapshot(page);
    assertExactMotionState(reversed, `${prefix}:reverse-wheel`, 'wheel');
    if (!(reversed.progress + GEOMETRY_PROGRESS_TOLERANCE < advanced.progress)) errors.push(`${prefix}: reverse wheel did not reverse geometry progress`);
    if (Math.abs(reversed.documentScrollTop - baseline.documentScrollTop) > SCROLL_POSITION_TOLERANCE_PX
        || Math.abs(reversed.documentRange - baseline.documentRange) > SCROLL_POSITION_TOLERANCE_PX
        || reversed.documentScrollHeight !== baseline.documentScrollHeight) {
      errors.push(`${prefix}: reverse wheel changed document scrolling`);
    }
    canonicalHashes.add(reversed.canonicalHash);
    checks += 1;
    causalChecks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${prefix}: runtime ${failure}`);
    await context.close();
  }
}

async function verifyReaderViewGeometry() {
  const representative = requiredRepresentative(READER_VIEW_PROBE_ROUTE);
  if (!representative) return;
  const context = await browser.newContext({ viewport: { width: 1200, height: 760 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  const prefix = `reader-view:${READER_VIEW_PROBE_ROUTE}`;
  await context.addInitScript(storageKey => {
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }, 'seminarSchools.readerMode.v1');
  await isolateLocalRequests(page);
  try {
    await load(page, representative);
    const toggle = page.locator('.a43-reader-toggle');
    await toggle.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    if (await toggle.getAttribute('aria-pressed') !== 'false') errors.push(`${prefix}: Reader View did not start opt-in and off`);
    const baseline = await motionSnapshot(page);
    await toggle.click();
    await page.waitForFunction(() => document.documentElement.classList.contains('a43-reader-mode')
      && document.querySelector('.a43-reader-toggle')?.getAttribute('aria-pressed') === 'true', null, { timeout: READY_TIMEOUT_MS });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const reader = await motionSnapshot(page);
    const ancestorEffects = await page.locator('#indraLayer').evaluate(layer => {
      const effects = [];
      for (let element = layer.parentElement; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        effects.push({
          element: element.tagName.toLowerCase(),
          filter: style.filter,
          opacity: Number.parseFloat(style.opacity),
          mixBlendMode: style.mixBlendMode,
        });
      }
      return effects;
    });
    assertExactMotionState(reader, prefix);
    if (reader.filter !== 'none') errors.push(`${prefix}: canonical rainbow is colour-filtered (${reader.filter})`);
    if (reader.mixBlendMode !== 'normal') errors.push(`${prefix}: canonical rainbow blend mode changed to ${reader.mixBlendMode}`);
    if (!Number.isFinite(reader.opacity) || !Number.isFinite(reader.bodyIntensity)
        || Math.abs(reader.opacity - reader.bodyIntensity) > 0.001) {
      errors.push(`${prefix}: Reader View bypasses the page-owned fade (${reader.opacity}/${reader.bodyIntensity})`);
    }
    const alteredAncestor = ancestorEffects.find(effect => effect.filter !== 'none'
      || effect.mixBlendMode !== 'normal' || !Number.isFinite(effect.opacity) || Math.abs(effect.opacity - 1) > 0.001);
    if (alteredAncestor) errors.push(`${prefix}: ${alteredAncestor.element} alters the exact canonical colours/fade`);
    if (reader.palette !== baseline.palette || reader.canonicalHash !== baseline.canonicalHash
        || reader.cameras.length !== baseline.cameras.length
        || JSON.stringify(reader.cameras.map(camera => camera.transform)) !== JSON.stringify(baseline.cameras.map(camera => camera.transform))) {
      errors.push(`${prefix}: enabling Reader View changes the canonical palette, drawing, or camera view`);
    }
    canonicalHashes.add(reader.canonicalHash);
    checks += 1;
    causalChecks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${prefix}: runtime ${failure}`);
    await context.close();
  }
}

async function waitForLayerPaint(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const layer = document.getElementById('indraLayer');
      if (layer) {
        getComputedStyle(layer).display;
        getComputedStyle(layer).visibility;
        layer.getBoundingClientRect();
      }
      resolve();
    }));
  }));
}

async function verifyLayoutIsolation(page) {
  return page.evaluate(async () => {
    const layer = document.getElementById('indraLayer');
    const parent = layer && layer.parentNode;
    if (!layer || !parent) return { isolated: false, reason: 'layer is detached' };
    const next = layer.nextSibling;
    const probes = [...document.body.querySelectorAll('*')]
      .filter(element => element !== layer && !layer.contains(element));
    function dimensions() {
      return {
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        bodyWidth: document.body.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        rects: probes.map(element => {
          const rect = element.getBoundingClientRect();
          return [rect.x, rect.y, rect.width, rect.height];
        }),
      };
    }
    function labelFor(element) {
      if (!element) return '(document extent)';
      const id = element.id ? `#${element.id}` : '';
      const className = typeof element.className === 'string' && element.className.trim()
        ? `.${element.className.trim().replace(/\s+/g, '.')}` : '';
      return `${element.tagName.toLowerCase()}${id}${className}`;
    }
    function firstDifference(left, right) {
      for (const key of ['documentWidth', 'documentHeight', 'bodyWidth', 'bodyHeight']) {
        if (left[key] !== right[key]) return `${key} ${left[key]} -> ${right[key]}`;
      }
      for (let index = 0; index < left.rects.length; index += 1) {
        for (let field = 0; field < 4; field += 1) {
          if (Math.abs(left.rects[index][field] - right.rects[index][field]) > 0.001) {
            const names = ['x', 'y', 'width', 'height'];
            return `${labelFor(probes[index])} ${names[field]} ${left.rects[index][field].toFixed(3)} -> ${right.rects[index][field].toFixed(3)}`;
          }
        }
      }
      return '';
    }
    const present = dimensions();
    layer.remove();
    const absent = dimensions();
    parent.insertBefore(layer, next);
    const restored = dimensions();
    const removalDifference = firstDifference(present, absent);
    const restorationDifference = firstDifference(present, restored);
    /* Reinserting a filtered SVG restores layout synchronously, but its
       compositor surface may not be painted until later. Cross two real paint
       opportunities and force computed-style/geometry resolution before the
       probe returns. */
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        getComputedStyle(layer).visibility;
        layer.getBoundingClientRect();
        resolve();
      }));
    });
    return {
      isolated: !removalDifference && !restorationDifference,
      reason: removalDifference || restorationDifference,
      probes: probes.length,
    };
  });
}

async function inspect(representative, viewport, label, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  const prefix = `${representative.routeType}:${label}:${representative.route}`;
  try {
    const fallbackMode = await load(page, representative);
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      scrollTo(0, 0);
    });
    await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}' });
    await page.waitForTimeout(80);
    const result = await page.evaluate(() => {
      const layer = document.getElementById('indraLayer');
      if (!layer) return { missing: true };
      const style = getComputedStyle(layer);
      const rect = layer.getBoundingClientRect();
      const body = document.body;
      const cameras = [...layer.querySelectorAll(':scope > .indra-camera')];
      const bank = layer.querySelector(':scope > .indra-definition-bank');
      const useNodes = cameras.map(camera => camera.querySelector('use'));
      const lineNodes = bank ? [...bank.querySelectorAll('.geo-stroke')] : [];
      const cameraData = cameras.map(camera => {
        const computed = getComputedStyle(camera);
        return {
          display: computed.display,
          visibility: computed.visibility,
          opacity: Number.parseFloat(computed.opacity),
          transform: camera.style.transform,
          instance: camera.getAttribute('data-geometry-instance') || '',
          canonicalId: camera.getAttribute('data-geometry-canonical-id') || '',
          canonicalHash: camera.getAttribute('data-geometry-canonical-hash') || '',
          shapes: Number.parseInt(camera.getAttribute('data-geometry-shapes') || '', 10),
          bytes: Number.parseInt(camera.getAttribute('data-geometry-markup-bytes') || '', 10),
          budget: camera.getAttribute('data-geometry-budget') || '',
          gaskets: camera.getAttribute('data-geometry-gaskets') || '',
          flowers: Number.parseInt(camera.getAttribute('data-geometry-flowers') || '', 10),
          jewels: Number.parseInt(camera.getAttribute('data-geometry-jewels') || '', 10),
          prisms: Number.parseInt(camera.getAttribute('data-geometry-prisms') || '', 10),
        };
      });
      const map = document.getElementById('projectMap');
      const mapRect = map && map.getBoundingClientRect();
      return {
        missing: false,
        display: style.display, visibility: style.visibility,
        opacity: Number.parseFloat(style.opacity), color: style.color,
        mixBlendMode: style.mixBlendMode,
        bodyBackground: getComputedStyle(body).backgroundColor,
        rootOverflowY: getComputedStyle(document.documentElement).overflowY,
        bodyOverflowY: getComputedStyle(body).overflowY,
        position: style.position, pointerEvents: style.pointerEvents,
        zIndex: Number.parseInt(style.zIndex, 10),
        width: rect.width, height: rect.height,
        clip: style.clip, clipPath: style.clipPath,
        maskImage: style.maskImage, webkitMaskImage: style.webkitMaskImage,
        contentVisibility: style.contentVisibility,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        svgCount: layer.querySelectorAll('svg').length,
        useCount: layer.querySelectorAll('.indra-camera use').length,
        allUseCount: layer.querySelectorAll('use').length,
        bankCount: layer.querySelectorAll(':scope > .indra-definition-bank').length,
        coverageCount: layer.querySelectorAll(':scope > .indra-coverage').length,
        coverageAttribute: Number.parseInt(layer.getAttribute('data-geometry-coverage-surfaces') || '', 10),
        field: layer.getAttribute('data-geometry-field') || '',
        morphologyCount: layer.querySelectorAll('feMorphology').length,
        filteredUseCount: layer.querySelectorAll('use[filter]').length,
        nonScalingStrokeCount: lineNodes.filter(node => getComputedStyle(node).vectorEffect === 'non-scaling-stroke').length,
        lineNodeCount: lineNodes.length,
        shapeCount: bank ? bank.querySelectorAll('circle,path,line,polygon,polyline,rect').length : 0,
        circleCount: bank ? bank.querySelectorAll('circle').length : 0,
        pathCount: bank ? bank.querySelectorAll('path').length : 0,
        gasketCount: bank ? bank.querySelectorAll('.geo-gasket-circle').length : 0,
        flowerPathCount: bank ? bank.querySelectorAll('path.geo-flower').length : 0,
        flowerCenterCount: bank ? bank.querySelectorAll('.geo-flower-center').length : 0,
        prismCount: bank ? bank.querySelectorAll('.geo-jewel-prism').length : 0,
        jewelCount: bank ? bank.querySelectorAll('.geo-jewel-core').length : 0,
        highlightCount: bank ? bank.querySelectorAll('.geo-jewel-highlight').length : 0,
        markupBytes: new TextEncoder().encode(layer.innerHTML).length,
        canonicalShapes: Number.parseInt(layer.getAttribute('data-geometry-shapes') || '', 10),
        canonicalBytes: Number.parseInt(layer.getAttribute('data-geometry-markup-bytes') || '', 10),
        camerasAttribute: Number.parseInt(layer.getAttribute('data-geometry-cameras') || '', 10),
        cameraData,
        useCoordinates: useNodes.map(node => node ? [node.getAttribute('href'), node.getAttribute('x'), node.getAttribute('y'), node.getAttribute('width'), node.getAttribute('height')] : []),
        canonicalId: layer.getAttribute('data-geometry-canonical-id') || '',
        canonicalHash: layer.getAttribute('data-geometry-canonical-hash') || '',
        palette: layer.getAttribute('data-geometry-palette') || '',
        fadeSource: layer.getAttribute('data-geometry-fade-source') || '',
        fallback: layer.getAttribute('data-geometry-fallback') || '',
        kind: layer.getAttribute('data-geometry-kind') || '',
        source: layer.getAttribute('data-geometry-source') || '',
        input: layer.getAttribute('data-geometry-input') || '',
        proof: layer.getAttribute('data-geometry-proof') || '',
        register: layer.getAttribute('data-geometry-register') || '',
        profile: layer.getAttribute('data-geometry-profile') || '',
        key: layer.getAttribute('data-geometry-key') || '',
        motion: layer.getAttribute('data-geometry-motion') || '',
        bodyRegister: body.getAttribute('data-geometry-register') || '',
        bodyProfile: body.getAttribute('data-geometry-profile') || '',
        bodyKey: body.getAttribute('data-geometry-key') || '',
        bodyIntensity: Number.parseFloat(body.getAttribute('data-indra-intensity') || ''),
        bodyFadeSource: body.getAttribute('data-indra-fade-source') || '',
        rootReady: document.documentElement.getAttribute('data-geometry-ready') || '',
        ariaHidden: layer.getAttribute('aria-hidden') || '', role: layer.getAttribute('role') || '',
        focusables: layer.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length,
        scrollRange: Math.max(0, document.documentElement.scrollHeight - innerHeight),
        pathname: location.pathname,
        homeNodes: document.querySelectorAll('#mapNodes .project-node').length,
        homeThreads: document.querySelectorAll('#mapThreads line').length,
        homeMapWidth: mapRect ? mapRect.width : 0,
        homeMapHeight: mapRect ? mapRect.height : 0,
      };
    });
    if (result.missing) errors.push(`${prefix}: #indraLayer missing`);
    else {
      const registerContract = CONTRACTS.registers[result.register];
      const profileContract = CONTRACTS.profiles[result.profile];
      const expectedPalette = CONTRACTS.presentation.rainbow_palette.map(value => value.toLowerCase()).join(',');
      if (
        result.display === 'none'
        || result.visibility === 'hidden'
        || !Number.isFinite(result.opacity)
        || !Number.isFinite(result.bodyIntensity)
        || result.opacity < FADE_MIN - 0.001
        || result.opacity > FADE_MAX + 0.001
        || Math.abs(result.opacity - result.bodyIntensity) > 0.001
      ) errors.push(`${prefix}: geometry fade ${result.opacity}/${result.bodyIntensity} is not the body-owned bounded fade ${FADE_MIN}-${FADE_MAX}`);
      if (!['page', 'route-register'].includes(result.fadeSource)) errors.push(`${prefix}: geometry fade source is not page or route-register (${result.fadeSource || 'missing'})`);
      if (result.fadeSource !== result.bodyFadeSource) errors.push(`${prefix}: body/layer fade-source contract differs (${result.bodyFadeSource}/${result.fadeSource})`);
      if (result.mixBlendMode !== 'normal' || CONTRACTS.presentation.blend_mode !== 'normal-in-light-and-dark') errors.push(`${prefix}: geometry blend mode alters the exact shared colours (${result.mixBlendMode || 'missing'})`);
      if (result.palette.toLowerCase() !== expectedPalette) errors.push(`${prefix}: runtime does not expose the exact shared 8-colour palette (${result.palette || 'missing'})`);
      if (result.color === 'transparent' || /rgba\([^)]*,\s*0(?:\.0*)?\s*\)/i.test(result.color)) errors.push(`${prefix}: geometry colour is transparent`);
      if (result.position !== 'fixed' || result.pointerEvents !== 'none') errors.push(`${prefix}: geometry is not fixed/pointer-isolated`);
      if (result.zIndex < 2_000_000_000) errors.push(`${prefix}: watermark is below opaque legacy wrappers (${result.zIndex})`);
      /* Fixed-position layout excludes a classic scrollbar gutter in some
         Chromium builds even when clientWidth reports the outer viewport.
         Twenty-four pixels covers that non-content gutter, never page area. */
      if (result.width + 24 < result.viewportWidth || result.height + 24 < result.viewportHeight) errors.push(`${prefix}: layer does not cover viewport content (${result.width}x${result.height} vs ${result.viewportWidth}x${result.viewportHeight})`);
      if (result.clipPath !== 'none' || !['auto', 'rect(auto, auto, auto, auto)'].includes(result.clip) || result.contentVisibility === 'hidden') errors.push(`${prefix}: geometry is clipped/content-hidden`);
      if (![undefined, '', 'none'].includes(result.maskImage) || ![undefined, '', 'none'].includes(result.webkitMaskImage)) errors.push(`${prefix}: geometry is masked`);
      if (result.ariaHidden !== 'true' || result.role !== 'presentation' || result.focusables !== 0) errors.push(`${prefix}: geometry is exposed to accessibility/tab order`);

      if (!profileContract || result.cameraData.length !== profileContract.cameras || result.camerasAttribute !== result.cameraData.length) errors.push(`${prefix}: wrong camera count/profile (${result.cameraData.length}/${result.profile})`);
      if (result.bankCount !== 1 || result.coverageCount !== CONTRACTS.presentation.static_coverage_surfaces || result.coverageAttribute !== CONTRACTS.presentation.static_coverage_surfaces || result.useCount !== result.cameraData.length || result.allUseCount !== result.cameraData.length || result.svgCount !== result.cameraData.length + 1) errors.push(`${prefix}: shared definition/dual-camera architecture is broken`);
      if (result.field !== CONTRACTS.presentation.field || result.morphologyCount !== 0 || result.filteredUseCount !== 0) errors.push(`${prefix}: static square/bubble coverage returned`);
      if (!result.lineNodeCount || result.nonScalingStrokeCount !== result.lineNodeCount) errors.push(`${prefix}: camera zoom thickens the restored fine-line geometry (${result.nonScalingStrokeCount}/${result.lineNodeCount} non-scaling strokes)`);
      if (result.shapeCount !== CONTRACTS.canonical_web.circle_elements + CONTRACTS.canonical_web.path_elements || result.shapeCount > CONTRACTS.canonical_web.max_shapes_per_camera || result.canonicalShapes !== result.shapeCount) errors.push(`${prefix}: global shape budget/count mismatch (${result.shapeCount}/${result.canonicalShapes})`);
      if (result.circleCount !== CONTRACTS.canonical_web.circle_elements || result.pathCount !== CONTRACTS.canonical_web.path_elements || result.gasketCount !== CONTRACTS.canonical_web.gasket_circles || result.flowerPathCount !== CONTRACTS.canonical_web.flower_paths || result.flowerCenterCount !== CONTRACTS.canonical_web.flower_centers || result.prismCount !== CONTRACTS.canonical_web.jewel_prisms || result.jewelCount !== CONTRACTS.canonical_web.jewel_cores || result.highlightCount !== CONTRACTS.canonical_web.jewel_highlights) errors.push(`${prefix}: exact old geometry part counts drifted`);
      if (result.canonicalBytes > CONTRACTS.canonical_web.max_markup_bytes_per_camera || result.markupBytes > CONTRACTS.canonical_web.max_markup_bytes_per_camera + 12_000) errors.push(`${prefix}: canonical/shared markup budget exceeded (${result.canonicalBytes}/${result.markupBytes})`);
      if (result.canonicalId !== CONTRACTS.canonical_web.id || result.canonicalHash !== EXPECTED_RUNTIME_CANONICAL_HASH || result.fallback) errors.push(`${prefix}: canonical ID/hash/fallback failure (${result.canonicalId}/${result.canonicalHash}/${EXPECTED_RUNTIME_CANONICAL_HASH})`);
      if (result.kind !== 'shared-background-web' || result.source !== CONTRACTS.canonical_web.id || result.input !== 'normalized-path-scroll' || result.proof !== 'eligible-page-scroll') errors.push(`${prefix}: runtime contract markers are dishonest`);
      if (result.rootReady !== 'true') errors.push(`${prefix}: geometry never reached its runtime-ready state`);
      if (result.bodyRegister !== result.register || result.bodyProfile !== result.profile || result.bodyKey !== result.key) errors.push(`${prefix}: body/layer camera contract differs`);
      if (result.cameraData.some(camera => camera.display === 'none' || camera.visibility === 'hidden' || !(camera.opacity > 0) || camera.instance !== 'canonical-use' || camera.canonicalId !== CONTRACTS.canonical_web.id || camera.canonicalHash !== result.canonicalHash || camera.shapes !== result.shapeCount || camera.bytes !== result.canonicalBytes || camera.budget !== 'within' || camera.gaskets !== '0,1,2' || camera.flowers < CONTRACTS.canonical_web.flower_paths || camera.jewels !== CONTRACTS.canonical_web.jewel_cores || camera.prisms !== CONTRACTS.canonical_web.jewel_prisms)) errors.push(`${prefix}: camera canonical parts/budget markers disagree`);
      if (result.useCoordinates.some(values => values.join('|') !== '#indra-canonical-symbol|-380|-380|760|760')) errors.push(`${prefix}: canonical <use> viewport is not centered`);
      canonicalHashes.add(result.canonicalHash);
      if (fallbackMode && result.pathname !== new URL(origin + representative.route).pathname) errors.push(`${prefix}: redirect fallback changed route`);
      if (representative.routeType === 'home' && (result.homeNodes !== 15 || result.homeThreads < 23 || result.homeMapWidth < Math.min(700, result.viewportWidth * 0.55) || result.homeMapHeight < 180)) errors.push(`${prefix}: homepage project web is not structurally visible`);

      const thresholds = PIXEL_THRESHOLDS[result.register];
      if (!thresholds) errors.push(`${prefix}: unknown register ${result.register}`);
      const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
      const nestedProbeBacked = NESTED_SCROLL_PROBES.some(probe => probe.route === representative.route);
      const fullscreenProbeBacked = FULLSCREEN_MOTION_PROBES.some(probe => probe.route === representative.route);
      const lockedViewport = maxScroll <= 1
        && /^(?:hidden|clip)$/.test(result.rootOverflowY)
        && /^(?:hidden|clip)$/.test(result.bodyOverflowY);
      const nestedOwned = lockedViewport && nestedProbeBacked;
      if (lockedViewport && !nestedProbeBacked && !fullscreenProbeBacked) {
        errors.push(`${prefix}: locked viewport has no exact nested/fullscreen causal probe`);
      }
      async function sampleAt(fraction, sampleLabel) {
        const sampleMode = reducedMotion === 'reduce'
          ? 'static'
          : 'scroll';
        await settleScrollSample(page, fraction, sampleMode, nestedOwned ? 0 : 0.32);
        const cameras = await cameraSamples(page);
        const visualState = await page.locator('#indraLayer').evaluate(layer => ({
          color: getComputedStyle(layer).color,
          progress: Number.parseFloat(layer.getAttribute('data-geometry-progress') || ''),
        }));
        const color = visualState.color;
        if (!Number.isFinite(visualState.progress) || !sameRgb(color, expectedRainbowRgb(visualState.progress))) {
          errors.push(`${prefix}:${sampleLabel}: rendered colour ${color} does not match exact palette interpolation at ${visualState.progress}`);
        }
        /* Capture the composed layer before any isolation probe mutates its
           compositor surface. The probes remain causal and exact, but cannot
           make their own visibility measurement stale. */
        const shown = await page.screenshot({ type: 'png', animations: 'disabled', timeout: SCREENSHOT_TIMEOUT_MS });
        const hitProbe = sampleLabel === 'top' ? await page.locator('#indraLayer').evaluate(layer => {
          const priorValue = layer.style.getPropertyValue('visibility');
          const priorPriority = layer.style.getPropertyPriority('visibility');
          const width = document.documentElement.clientWidth;
          const height = document.documentElement.clientHeight;
          const points = [1 / 6, 1 / 2, 5 / 6].flatMap(y =>
            [1 / 6, 1 / 2, 5 / 6].map(x => [width * x, height * y]));
          const shown = points.map(([x, y]) => document.elementFromPoint(x, y));
          layer.style.setProperty('visibility', 'hidden', 'important');
          const hidden = points.map(([x, y]) => document.elementFromPoint(x, y));
          if (priorValue) layer.style.setProperty('visibility', priorValue, priorPriority);
          else layer.style.removeProperty('visibility');
          const restored = points.map(([x, y]) => document.elementFromPoint(x, y));
          function describe(node) {
            if (!node) return '(none)';
            const id = node.id ? `#${node.id}` : '';
            const className = typeof node.className === 'string' && node.className.trim()
              ? `.${node.className.trim().replace(/\s+/g, '.')}` : '';
            return `${node.tagName.toLowerCase()}${id}${className}`;
          }
          const mismatch = points.findIndex((_, index) =>
            shown[index] !== hidden[index] || shown[index] !== restored[index]
              || shown[index] === layer || Boolean(shown[index] && shown[index].closest && shown[index].closest('#indraLayer')));
          return {
            isolated: mismatch < 0,
            reason: mismatch < 0 ? '' : `point ${mismatch + 1}: ${describe(shown[mismatch])} -> ${describe(hidden[mismatch])} -> ${describe(restored[mismatch])}`,
          };
        }) : { isolated: true, reason: '' };
        if (sampleLabel === 'top') {
          /* Cross two paint opportunities and force style/geometry before the
             following hidden-reference capture. */
          await waitForLayerPaint(page);
        }
        const priorDisplay = await page.locator('#indraLayer').evaluate(element => {
          const prior = {
            value: element.style.getPropertyValue('display'),
            priority: element.style.getPropertyPriority('display'),
          };
          element.style.setProperty('display', 'none', 'important');
          return prior;
        });
        /* `display:none` plus the paint barrier makes the reference image an
           exact layer-absent state, not a cached `shown` frame. */
        await waitForLayerPaint(page);
        const hidden = await page.screenshot({ type: 'png', animations: 'disabled', timeout: SCREENSHOT_TIMEOUT_MS });
        await page.locator('#indraLayer').evaluate((element, prior) => {
          if (prior.value) element.style.setProperty('display', prior.value, prior.priority);
          else element.style.removeProperty('display');
        }, priorDisplay);
        await waitForLayerPaint(page);
        const pixels = pixelDifference(shown, hidden);
        if (thresholds && (pixels.meanChanged < thresholds.mean || pixels.changedPercent < thresholds.changedPercent || pixels.activeCells < thresholds.activeCells)) {
          errors.push(`${prefix}:${sampleLabel}: composed geometry is too faint or sparse (${pixels.meanChanged.toFixed(4)} mean, ${pixels.changedPercent.toFixed(3)}%, ${pixels.activeCells}/9 active cells; requires ${thresholds.mean.toFixed(3)}, ${thresholds.changedPercent.toFixed(2)}%, ${thresholds.activeCells}/9; layer ${result.color} on body ${result.bodyBackground})`);
        }
        // Causal paint proof through the actual production <symbol>/<use>.
        // Bright filled jewels cannot stand in for missing gasket/flower lines.
        const priorFills = await page.locator('#indraLayer').evaluate(layer => {
          return [...layer.querySelectorAll('.geo-flower-center, .geo-jewel')].map(node => {
            const prior = node.getAttribute('display');
            node.setAttribute('display', 'none');
            return prior;
          });
        });
        await waitForLayerPaint(page);
        const lines = await page.screenshot({ type: 'png', animations: 'disabled', timeout: SCREENSHOT_TIMEOUT_MS });
        await page.locator('#indraLayer').evaluate((layer, priors) => {
          [...layer.querySelectorAll('.geo-flower-center, .geo-jewel')].forEach((node, index) => {
            if (priors[index] === null) node.removeAttribute('display');
            else node.setAttribute('display', priors[index]);
          });
        }, priorFills);
        await waitForLayerPaint(page);
        const linePixels = pixelDifference(lines, hidden);
        if (thresholds && (linePixels.meanChanged < thresholds.mean
            || linePixels.changedPercent < thresholds.changedPercent
            || linePixels.activeCells < thresholds.activeCells)) {
          errors.push(`${prefix}:${sampleLabel}: rendered line-only geometry failed; filled bubbles cannot satisfy the web (${linePixels.meanChanged.toFixed(4)} mean, ${linePixels.changedPercent.toFixed(3)}%, ${linePixels.activeCells}/9 cells)`);
        }
        return { cameras, hitProbe, color, progress: visualState.progress };
      }
      const top = await sampleAt(0, 'top');
      const middle = reducedMotion === 'reduce' || nestedOwned ? null : await sampleAt(0.5, 'middle');
      const bottom = reducedMotion === 'reduce' || nestedOwned ? null : await sampleAt(1, 'bottom');
      const topSamples = top.cameras;
      const middleSamples = middle ? middle.cameras : topSamples;
      const bottomSamples = bottom ? bottom.cameras : topSamples;
      if (!top.hitProbe.isolated) errors.push(`${prefix}: geometry changes hit testing despite pointer-events:none (${top.hitProbe.reason})`);

      if (reducedMotion === 'reduce') {
        await settleScrollSample(page, 1, 'static');
        const reducedAfterScroll = await cameraSamples(page);
        for (let index = 0; index < topSamples.length; index += 1) {
          if (topSamples[index]?.transform !== reducedAfterScroll[index]?.transform || result.motion !== 'static-reduced') errors.push(`${prefix}: reduced-motion camera ${index} moves`);
        }
      }
      if (reducedMotion !== 'reduce' && maxScroll > 80 && new Set([top.color, middle.color, bottom.color]).size !== 3) errors.push(`${prefix}: rainbow field colour does not advance with scroll`);
      for (let index = 0; index < topSamples.length; index += 1) {
        const sequence = [topSamples[index]?.transform, middleSamples[index]?.transform, bottomSamples[index]?.transform];
        if (reducedMotion !== 'reduce' && maxScroll > 80) {
          if (new Set(sequence).size !== 3 || result.motion !== 'scroll-responsive') errors.push(`${prefix}: camera ${index} lacks three scroll views`);
          const displacement = distance(translation(sequence[0]), translation(sequence[2]));
          if (registerContract && displacement + 0.01 < registerContract.minimum_scroll_displacement) errors.push(`${prefix}: camera ${index} travels ${displacement.toFixed(2)}px; requires ${registerContract.minimum_scroll_displacement}`);
        }
      }
      /* Measure geometry's causal layout effect, not unrelated page CLS from
         deferred footers, data hydration, fonts, or content-visibility. This
         runs after pixel capture so the proof cannot perturb its subject. */
      const layoutIsolation = await verifyLayoutIsolation(page);
      if (!layoutIsolation.isolated) errors.push(`${prefix}: #indraLayer changes document layout (${layoutIsolation.reason})`);
      if (topSamples.length !== CONTRACTS.presentation.cameras) errors.push(`${prefix}: page does not retain both independent field cameras`);
    }
    checks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${prefix}: runtime ${failure}`);
    await context.close();
  }
}

async function verifyExactPaletteStops(viewport, label) {
  const representative = [...representatives.values()].find(row => row.route === '/') || representatives.values().next().value;
  if (!representative) return;
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  const prefix = `exact-palette:${label}:${representative.route}`;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  try {
    await load(page, representative);
    await page.addStyleTag({ content: 'html body{min-height:500vh!important}' });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await settleScrollSample(page, 0, 'scroll');
    const firstTransforms = await cameraSamples(page);
    for (let index = 0; index < CONTRACTS.presentation.rainbow_palette.length; index += 1) {
      const progress = index / (CONTRACTS.presentation.rainbow_palette.length - 1);
      await settleScrollSample(page, progress, 'scroll');
      const rendered = await page.locator('#indraLayer').evaluate(layer => ({
        color: getComputedStyle(layer).color,
        progress: Number.parseFloat(layer.getAttribute('data-geometry-progress') || ''),
        palette: layer.getAttribute('data-geometry-palette') || '',
      }));
      const expected = rgbTuple(CONTRACTS.presentation.rainbow_palette[index]);
      if (Math.abs(rendered.progress - progress) > GEOMETRY_PROGRESS_TOLERANCE || !sameRgb(rendered.color, expected)) {
        errors.push(`${prefix}: palette stop ${index + 1}/8 rendered ${rendered.color} at ${rendered.progress}; expected ${CONTRACTS.presentation.rainbow_palette[index]} at ${progress.toFixed(4)}`);
      }
    }
    const lastTransforms = await cameraSamples(page);
    if (firstTransforms.length !== 2 || lastTransforms.length !== 2) errors.push(`${prefix}: exact-palette proof lost one of two cameras`);
    for (let index = 0; index < 2; index += 1) {
      if (firstTransforms[index]?.transform === lastTransforms[index]?.transform) errors.push(`${prefix}: camera ${index} did not move across the full exact-palette scroll`);
    }
    checks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${prefix}: runtime ${failure}`);
    await context.close();
  }
}

async function verifyExemptPage(representative, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  const prefix = `${representative.exemption}:${label}:${representative.route}`;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  try {
    await loadExempt(page, representative);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const body = document.body;
      const bodyStyle = getComputedStyle(body);
      const headings = [...document.querySelectorAll('h1')].filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0;
      });
      const interactive = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
        .filter(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden'
            && Number.parseFloat(style.opacity) > 0 && style.pointerEvents !== 'none' && !element.disabled;
        });
      let focusWorked = false;
      if (interactive[0]) {
        interactive[0].focus({ preventScroll: true });
        focusWorked = document.activeElement === interactive[0] || interactive[0].contains(document.activeElement);
      }
      const sharedBodyAttributes = [...body.attributes]
        .map(attribute => attribute.name)
        .filter(name => name === 'data-geometry' || name === 'data-indra-intensity' || name === 'data-indra-fade-source' || /^data-geometry-(?:role|key|seed|register|profile|engine)$/.test(name));
      const sharedScripts = [...document.scripts]
        .map(script => script.getAttribute('src') || '')
        .filter(src => /(?:^|\/)js\/(?:mandala|indra)\.js(?:\?|$)/.test(src));
      const bodyRect = body.getBoundingClientRect();
      return {
        marker: body.getAttribute('data-shared-geometry-exempt') || '',
        layerCount: document.querySelectorAll('#indraLayer,.indra-camera,.indra-definition-bank').length,
        sharedBodyAttributes,
        sharedScripts,
        mandalaGlobal: Boolean(window.PolymythMandala),
        rootReady: document.documentElement.getAttribute('data-geometry-ready') || '',
        bodyVisible: bodyStyle.display !== 'none' && bodyStyle.visibility !== 'hidden' && Number.parseFloat(bodyStyle.opacity) > 0,
        bodyWidth: bodyRect.width,
        bodyHeight: Math.max(bodyRect.height, body.scrollHeight),
        headingCount: headings.length,
        headingText: headings.map(element => element.textContent.trim()).join(' | '),
        visibleInteractiveCount: interactive.length,
        focusWorked,
        textLength: (body.innerText || '').trim().length,
        localGeoCount: document.querySelectorAll('#geo').length,
      };
    });
    if (result.marker !== representative.exemption) errors.push(`${prefix}: exemption marker is ${result.marker || 'missing'}`);
    if (result.layerCount || result.sharedScripts.length || result.mandalaGlobal || result.rootReady === 'true' || result.sharedBodyAttributes.length) {
      errors.push(`${prefix}: shared Indra leaked onto exempt page (nodes=${result.layerCount}, scripts=${result.sharedScripts.join(',') || 'none'}, attrs=${result.sharedBodyAttributes.join(',') || 'none'}, global=${result.mandalaGlobal}, ready=${result.rootReady || 'unset'})`);
    }
    if (!result.bodyVisible || result.bodyWidth < Math.min(240, viewport.width * 0.7) || result.bodyHeight < Math.min(160, viewport.height * 0.35)) {
      errors.push(`${prefix}: existing page is not visibly rendered (${result.bodyWidth}x${result.bodyHeight})`);
    }
    if (!result.headingCount || !result.headingText || result.textLength < 80) errors.push(`${prefix}: existing page content/heading is not visibly usable`);
    if (!result.visibleInteractiveCount || !result.focusWorked) errors.push(`${prefix}: existing page exposes no visible keyboard-usable control`);
    if (representative.exemption === 'internal-control' && result.localGeoCount !== 1) errors.push(`${prefix}: dashboard's existing page-owned #geo motif was not preserved`);
    checks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${prefix}: runtime ${failure}`);
    await context.close();
  }
}

async function verifyQueryStable() {
  const route = representatives.size && [...representatives.values()].find(row => row.route === '/teacherresources/');
  if (!route) return;
  const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  await page.route('**/*', requestRoute => new URL(requestRoute.request().url()).origin === origin ? requestRoute.continue() : requestRoute.abort());
  try {
    await load(page, route);
    const baseline = await page.evaluate(() => {
      const layer = document.getElementById('indraLayer');
      return [layer.getAttribute('data-geometry-canonical-hash'), layer.getAttribute('data-geometry-camera-signature'), [...layer.querySelectorAll('.indra-camera')].map(camera => camera.style.transform)];
    });
    await page.goto(`${origin}${route.route}?format=indigenous&curriculum=alberta%2Cbc%2Ccommon-core#results`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForFunction(() => document.documentElement.dataset.geometryReady === 'true', null, { timeout: READY_TIMEOUT_MS });
    const queried = await page.evaluate(() => {
      const layer = document.getElementById('indraLayer');
      return [layer.getAttribute('data-geometry-canonical-hash'), layer.getAttribute('data-geometry-camera-signature'), [...layer.querySelectorAll('.indra-camera')].map(camera => camera.style.transform)];
    });
    if (JSON.stringify(baseline) !== JSON.stringify(queried)) errors.push('teacherresources: query/hash changes canonical geometry or pathname camera');
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`teacherresources:query-runtime ${failure}`);
    await context.close();
  }
}

async function verifyPrintHidden() {
  const representative = representatives.values().next().value;
  if (!representative) return;
  const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const page = await context.newPage();
  const runtimeFailures = collectRuntimeFailures(page);
  await page.route('**/*', requestRoute => new URL(requestRoute.request().url()).origin === origin ? requestRoute.continue() : requestRoute.abort());
  try {
    await load(page, representative);
    await page.emulateMedia({ media: 'print' });
    const display = await page.locator('#indraLayer').evaluate(element => getComputedStyle(element).display);
    if (display !== 'none') errors.push(`${representative.route}: geometry is not removed from print`);
  } finally {
    for (const failure of new Set(runtimeFailures)) errors.push(`${representative.route}:print-runtime ${failure}`);
    await context.close();
  }
}

async function runBounded(items, worker) {
  let next = 0;
  async function consume() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(GEOMETRY_BROWSER_CONCURRENCY, items.length) },
      consume,
    ),
  );
}

try {
  const ordinaryJobs = [];
  for (const representative of representatives.values()) {
    ordinaryJobs.push(
      { representative, viewport: { width: 1440, height: 900 }, label: 'desktop', reducedMotion: 'no-preference' },
      { representative, viewport: { width: 390, height: 844 }, label: 'phone', reducedMotion: 'no-preference' },
      { representative, viewport: { width: 390, height: 844 }, label: 'reduced-motion', reducedMotion: 'reduce' },
    );
  }
  /* Heavy application surfaces own large DOM/data states and nested scroll
     models.  Render those nine signatures without competing screenshot
     contexts, then use the bounded pool for the remaining independent static
     surfaces.  This preserves the five-second causal convergence assertion
     instead of weakening it to accommodate resource contention. */
  const heavyJobs = ordinaryJobs.filter(job =>
    /\bdata-page-weight\s*=\s*(["'])heavy\1/i.test(job.representative.html));
  const pooledJobs = ordinaryJobs.filter(job => !heavyJobs.includes(job));
  for (const job of heavyJobs) {
    await inspect(job.representative, job.viewport, job.label, job.reducedMotion);
  }
  await runBounded(pooledJobs, job => inspect(
    job.representative,
    job.viewport,
    job.label,
    job.reducedMotion,
  ));
  await verifyExactPaletteStops({ width: 1440, height: 900 }, 'desktop');
  await verifyExactPaletteStops({ width: 390, height: 844 }, 'phone');
  const exemptJobs = [];
  for (const representative of exemptPages) {
    exemptJobs.push(
      { representative, viewport: { width: 1440, height: 900 }, label: 'desktop' },
      { representative, viewport: { width: 390, height: 844 }, label: 'phone' },
    );
  }
  await runBounded(exemptJobs, job => verifyExemptPage(job.representative, job.viewport, job.label));
  for (const probe of NESTED_SCROLL_PROBES) await verifyNestedScrollProbe(probe);
  for (const probe of FULLSCREEN_MOTION_PROBES) await verifyFullscreenMotionProbe(probe);
  await verifyReaderViewGeometry();
  await verifyQueryStable();
  await verifyPrintHidden();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

if (canonicalHashes.size !== 1 || !canonicalHashes.has(EXPECTED_RUNTIME_CANONICAL_HASH)) errors.push(`all included surfaces must share exact canonical geometry hash ${EXPECTED_RUNTIME_CANONICAL_HASH}; found ${[...canonicalHashes].join(',') || '(none)'}`);
if (errors.length) {
  console.error('VISIBLE GEOMETRY BROWSER CHECK FAILED');
  [...errors].sort().forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`VISIBLE GEOMETRY BROWSER CHECK PASSED — ${checks} renders at bounded concurrency ${GEOMETRY_BROWSER_CONCURRENCY} cover ${representatives.size} distinct included surface signatures at desktop, phone, and reduced motion, including ${causalChecks} non-deduplicated natural-input/Reader View regression probes; all ${starPages.length} canonical star pages${controlPages.length ? ` plus ${controlPages.length} source-only internal control page` : ''} render at desktop and phone without shared Indra; every included surface uses the exact 8-colour palette and ${EXPECTED_RUNTIME_CANONICAL_HASH} canonical hash through two bounded-fade scrolling cameras while preserving hit/tab/layout isolation.`);
