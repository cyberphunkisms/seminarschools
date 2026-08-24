#!/usr/bin/env node
'use strict';

/*
 * Rendered release gate for the universal canonical geometry watermark.
 * Static markers are insufficient: every distinct public surface must produce
 * visible pixels, keep input/layout isolated, and move every camera on scroll.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SITE_ROOT = process.env.GEOMETRY_SITE_ROOT
  ? path.resolve(process.env.GEOMETRY_SITE_ROOT)
  : PUBLIC;
const CONTRACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'));
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const PHONE_TYPES = new Set(['home', 'project', 'resource-catalog', 'calendar-event', 'cv', 'redirect', 'commons-home', 'game-landing', 'service']);
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
const routeTypesSeen = new Set();
const candidateFiles = FOCUSED_ROUTES.length ? FOCUSED_ROUTES.map(fileForRoute) : walk(SITE_ROOT);
for (const file of candidateFiles) {
  if (!fs.existsSync(file)) throw new Error(`geometry browser route file missing: ${file}`);
  if (path.basename(file) === GOOGLE_TOKEN) continue;
  const html = fs.readFileSync(file, 'utf8');
  const routeType = bodyAttr(html, 'data-route-type');
  if (!routeType) continue;
  routeTypesSeen.add(routeType);
  const signature = FOCUSED_ROUTES.length ? routeFor(file) : surfaceSignature(html);
  if (!representatives.has(signature)) representatives.set(signature, {
    file, html, route: routeFor(file), routeType,
  });
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
const errors = [];
const canonicalHashes = new Set();
let checks = 0;

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

async function cameraSamples(page) {
  return page.evaluate(() => [...document.querySelectorAll('#indraLayer .indra-camera')].map(camera => ({
    name: camera.getAttribute('data-geometry-camera') || '',
    transform: camera.style.transform,
    progress: camera.style.getPropertyValue('--indra-progress'),
  })));
}

async function settleScrollSample(page, fraction, geometryMode = 'scroll') {
  await page.evaluate(position => {
    const layer = document.getElementById('indraLayer');
    if (layer) delete layer.__geometryGateSettledSignature;
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    scrollTo(0, maximum * position);
  }, fraction);
  const settled = await page.waitForFunction(
    ({ position, mode, positionTolerance, progressTolerance }) => {
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
      const expectedProgress = mode === 'static'
        ? 0
        : maximum > 1 ? actual / maximum : 0.32;
      const layerProgress = Number.parseFloat(layer.getAttribute('data-geometry-progress') || '');
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
      positionTolerance: SCROLL_POSITION_TOLERANCE_PX,
      progressTolerance: GEOMETRY_PROGRESS_TOLERANCE,
    },
    { timeout: SCROLL_SETTLE_TIMEOUT_MS, polling: 20 },
  );
  await settled.dispose();
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
      const coverage = layer.querySelector(':scope > .indra-coverage');
      const useNodes = cameras.map(camera => camera.querySelector('use'));
      const coverageUse = coverage && coverage.querySelector('use');
      const coverageStyle = coverage && getComputedStyle(coverage);
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
        bodyBackground: getComputedStyle(body).backgroundColor,
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
        coverageKind: coverage ? coverage.getAttribute('data-geometry-coverage') || '' : '',
        coverageInstance: coverage ? coverage.getAttribute('data-geometry-instance') || '' : '',
        coverageCanonicalId: coverage ? coverage.getAttribute('data-geometry-canonical-id') || '' : '',
        coverageOpacity: coverageStyle ? Number.parseFloat(coverageStyle.opacity) : NaN,
        coverageFilter: coverageStyle ? coverageStyle.filter : '',
        coverageTransform: coverageStyle ? coverageStyle.transform : '',
        coverageUseCoordinates: coverageUse ? [coverageUse.getAttribute('href'), coverageUse.getAttribute('x'), coverageUse.getAttribute('y'), coverageUse.getAttribute('width'), coverageUse.getAttribute('height')] : [],
        coverageViewBox: coverage ? coverage.querySelector('svg')?.getAttribute('viewBox') || '' : '',
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
      const expectedOpacity = registerContract && registerContract.default_intensity;
      if (result.display === 'none' || result.visibility === 'hidden' || !Number.isFinite(result.opacity) || Math.abs(result.opacity - expectedOpacity) > 0.001) errors.push(`${prefix}: geometry opacity ${result.opacity} does not equal ${expectedOpacity}`);
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
      if (result.bankCount !== 1 || result.coverageCount !== CONTRACTS.coverage.surfaces || result.coverageAttribute !== CONTRACTS.coverage.surfaces || result.useCount !== result.cameraData.length || result.allUseCount !== result.cameraData.length + CONTRACTS.coverage.surfaces || result.svgCount !== result.cameraData.length + CONTRACTS.coverage.surfaces + 1) errors.push(`${prefix}: shared definition/camera/coverage architecture is broken`);
      if (result.coverageKind !== 'canonical-static-wide' || result.coverageInstance !== 'canonical-use' || result.coverageCanonicalId !== CONTRACTS.canonical_web.id || Math.abs(result.coverageOpacity - CONTRACTS.coverage.opacity) > 0.001 || result.coverageFilter === 'none' || result.coverageTransform !== 'none' || result.coverageViewBox !== CONTRACTS.coverage.view_box || result.coverageUseCoordinates.join('|') !== '#indra-canonical-symbol|-380|-380|760|760') errors.push(`${prefix}: canonical static coverage surface drifted`);
      if (result.shapeCount !== CONTRACTS.canonical_web.circle_elements + CONTRACTS.canonical_web.path_elements || result.shapeCount > CONTRACTS.canonical_web.max_shapes_per_camera || result.canonicalShapes !== result.shapeCount) errors.push(`${prefix}: global shape budget/count mismatch (${result.shapeCount}/${result.canonicalShapes})`);
      if (result.circleCount !== CONTRACTS.canonical_web.circle_elements || result.pathCount !== CONTRACTS.canonical_web.path_elements || result.gasketCount !== CONTRACTS.canonical_web.gasket_circles || result.flowerPathCount !== CONTRACTS.canonical_web.flower_paths || result.flowerCenterCount !== CONTRACTS.canonical_web.flower_centers || result.prismCount !== CONTRACTS.canonical_web.jewel_prisms || result.jewelCount !== CONTRACTS.canonical_web.jewel_cores || result.highlightCount !== CONTRACTS.canonical_web.jewel_highlights) errors.push(`${prefix}: exact old geometry part counts drifted`);
      if (result.canonicalBytes > CONTRACTS.canonical_web.max_markup_bytes_per_camera || result.markupBytes > CONTRACTS.canonical_web.max_markup_bytes_per_camera + 12_000) errors.push(`${prefix}: canonical/shared markup budget exceeded (${result.canonicalBytes}/${result.markupBytes})`);
      if (result.canonicalId !== CONTRACTS.canonical_web.id || result.fallback) errors.push(`${prefix}: canonical ID/fallback failure`);
      if (result.kind !== 'shared-background-web' || result.source !== CONTRACTS.canonical_web.id || result.input !== 'normalized-path-scroll' || result.proof !== 'all-page-scroll') errors.push(`${prefix}: runtime contract markers are dishonest`);
      if (result.bodyRegister !== result.register || result.bodyProfile !== result.profile || result.bodyKey !== result.key) errors.push(`${prefix}: body/layer camera contract differs`);
      if (result.cameraData.some(camera => camera.display === 'none' || camera.visibility === 'hidden' || !(camera.opacity > 0) || camera.instance !== 'canonical-use' || camera.canonicalId !== CONTRACTS.canonical_web.id || camera.canonicalHash !== result.canonicalHash || camera.shapes !== result.shapeCount || camera.bytes !== result.canonicalBytes || camera.budget !== 'within' || camera.gaskets !== '0,1,2' || camera.flowers < CONTRACTS.canonical_web.flower_paths || camera.jewels !== CONTRACTS.canonical_web.jewel_cores || camera.prisms !== CONTRACTS.canonical_web.jewel_prisms)) errors.push(`${prefix}: camera canonical parts/budget markers disagree`);
      if (result.useCoordinates.some(values => values.join('|') !== '#indra-canonical-symbol|-380|-380|760|760')) errors.push(`${prefix}: canonical <use> viewport is not centered`);
      canonicalHashes.add(result.canonicalHash);
      if (fallbackMode && result.pathname !== new URL(origin + representative.route).pathname) errors.push(`${prefix}: redirect fallback changed route`);
      if (representative.routeType === 'home' && (result.homeNodes !== 15 || result.homeThreads < 23 || result.homeMapWidth < Math.min(700, result.viewportWidth * 0.55) || result.homeMapHeight < 180)) errors.push(`${prefix}: homepage project web is not structurally visible`);

      const thresholds = PIXEL_THRESHOLDS[result.register];
      if (!thresholds) errors.push(`${prefix}: unknown register ${result.register}`);
      const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
      async function sampleAt(fraction, sampleLabel) {
        await settleScrollSample(page, fraction, reducedMotion === 'reduce' ? 'static' : 'scroll');
        const cameras = await cameraSamples(page);
        /* Capture the composed layer before any isolation probe mutates its
           filtered SVG compositor surface. The probes remain causal and exact,
           but cannot make their own visibility measurement stale. */
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
          /* Hit testing is restored synchronously; filtered SVG composition is
             not. Cross two paint opportunities and force style/geometry before
             the following hidden-reference capture. */
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
        /* A filtered SVG may retain its last compositor texture when only
           visibility changes. `display:none` plus the paint barrier makes the
           reference image an exact layer-absent state, not cached `shown`. */
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
        return { cameras, hitProbe };
      }
      const top = await sampleAt(0, 'top');
      const middle = reducedMotion === 'reduce' ? null : await sampleAt(0.5, 'middle');
      const bottom = reducedMotion === 'reduce' ? null : await sampleAt(1, 'bottom');
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
      if (result.profile === 'about-dual' && topSamples.length !== 2) errors.push(`${prefix}: About no longer has two canonical camera windows`);
      if (result.profile === 'cv-quiet' && topSamples.length !== 1) errors.push(`${prefix}: CV quiet profile is not one camera`);
    }
    checks += 1;
  } catch (error) {
    errors.push(`${prefix}: ${error.message}`);
  } finally {
    await context.close();
  }
}

async function verifyQueryStable() {
  const route = representatives.size && [...representatives.values()].find(row => row.route === '/teacherresources/');
  if (!route) return;
  const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const page = await context.newPage();
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
  } finally { await context.close(); }
}

async function verifyPrintHidden() {
  const representative = representatives.values().next().value;
  if (!representative) return;
  const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const page = await context.newPage();
  await page.route('**/*', requestRoute => new URL(requestRoute.request().url()).origin === origin ? requestRoute.continue() : requestRoute.abort());
  try {
    await load(page, representative);
    await page.emulateMedia({ media: 'print' });
    const display = await page.locator('#indraLayer').evaluate(element => getComputedStyle(element).display);
    if (display !== 'none') errors.push(`${representative.route}: geometry is not removed from print`);
  } finally { await context.close(); }
}

try {
  for (const representative of representatives.values()) {
    await inspect(representative, { width: 1440, height: 900 }, 'desktop', 'no-preference');
    if (PHONE_TYPES.has(representative.routeType)) {
      await inspect(representative, { width: 390, height: 844 }, 'phone', 'no-preference');
    }
  }
  for (const representative of representatives.values()) {
    await inspect(representative, { width: 390, height: 844 }, 'reduced-motion', 'reduce');
  }
  await verifyQueryStable();
  await verifyPrintHidden();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

if (canonicalHashes.size !== 1) errors.push(`all surfaces must share one canonical geometry hash; found ${canonicalHashes.size}`);
if (errors.length) {
  console.error('VISIBLE GEOMETRY BROWSER CHECK FAILED');
  errors.forEach(error => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`VISIBLE GEOMETRY BROWSER CHECK PASSED — ${checks} desktop/phone/reduced renders cover ${representatives.size} distinct surfaces; every page composes visible canonical pixels through one shared 1,174-shape symbol, preserves hit/tab/layout isolation, meets register travel, and keeps reduced motion static.`);
