#!/usr/bin/env node
'use strict';

/*
  Computed-render gate for the CL-49 / CL-63 all-page scroll layer.

  Static checks prove wiring. This gate serves the built public tree and proves
  that one representative of every registered page family actually mounts a
  visible, viewport-covering, pointer-safe SVG that responds to scroll. High-use
  families are also checked at a phone viewport.
*/
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const CONTRACTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'));
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const PHONE_TYPES = new Set(['home', 'project', 'resource-catalog', 'calendar-event', 'cv', 'redirect', 'commons-home', 'game-landing', 'service']);
const MAX_MARKUP_BYTES = 180000;
const MAX_SHAPES = 1600;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
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
  const rel = path.relative(PUBLIC, file).replace(/\\/g, '/');
  return rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
}

function orderedLocalCss(html) {
  return [...html.matchAll(/<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/ig)]
    .map(match => match[1] || match[2])
    .filter(href => !/^(?:[a-z]+:)?\/\//i.test(href) && !/^(?:data:|blob:)/i.test(href));
}

function inlineStyleHash(html) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
  return crypto.createHash('sha256').update(css).digest('hex');
}

function foregroundMode(html) {
  return /\bid=["'](?:geo|geo2|geoLayer|projectMap)["']/i.test(html) ||
    /\bdata-geometry-foreground=["']structural["']/i.test(html) ||
    /\bclass=["'][^"']*(?:project-map|cv-route-bridge__geometry|geometry-stage|mandala-stage)[^"']*["']/i.test(html)
    ? 'structural' : 'shared';
}

function surfaceSignature(html) {
  return JSON.stringify({
    routeType: bodyAttr(html, 'data-route-type'),
    bodyClass: bodyAttr(html, 'class').trim().replace(/\s+/g, ' '),
    localCss: orderedLocalCss(html),
    inlineStyleHash: inlineStyleHash(html),
    foregroundMode: foregroundMode(html)
  });
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  })[ext] || 'application/octet-stream';
}

const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  let relative = pathname.replace(/^\/+/, '');
  if (!relative || pathname.endsWith('/')) relative += 'index.html';
  const resolved = path.resolve(PUBLIC, relative);
  if (resolved !== PUBLIC && !resolved.startsWith(PUBLIC + path.sep)) {
    response.writeHead(403).end('Forbidden'); return;
  }
  let file = resolved;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found'); return;
  }
  response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

const representatives = new Map();
const routeTypesSeen = new Set();
for (const file of walk(PUBLIC)) {
  const rel = path.relative(PUBLIC, file).replace(/\\/g, '/');
  if (rel === GOOGLE_TOKEN) continue;
  const html = fs.readFileSync(file, 'utf8');
  const routeType = bodyAttr(html, 'data-route-type');
  if (!routeType) continue;
  routeTypesSeen.add(routeType);
  const signature = surfaceSignature(html);
  if (!representatives.has(signature)) representatives.set(signature, {
    file, html, route: routeFor(file), routeType, signature,
    bodyClass: bodyAttr(html, 'class').trim().replace(/\s+/g, ' '),
    localCss: orderedLocalCss(html),
    inlineStyleHash: inlineStyleHash(html),
    foregroundMode: foregroundMode(html)
  });
}

const missing = Object.keys(CONTRACTS.route_types).filter(type => !routeTypesSeen.has(type));
if (missing.length) {
  server.close();
  console.error(`VISIBLE GEOMETRY BROWSER CHECK FAILED — no public representative: ${missing.join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXECUTABLE || (fs.existsSync('/tmp/chromium') ? '/tmp/chromium' : chromium.executablePath())
});
const errors = [];
let checks = 0;

async function load(page, representative) {
  const isRedirect = representative.routeType === 'redirect' || /http-equiv=["']refresh["']/i.test(representative.html);
  if (isRedirect) {
    const fallback = representative.html
      .replace(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/ig, '')
      .replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/ig, script =>
        /\blocation\s*(?:=|\.(?:replace|assign)\s*\()/.test(script) ? '' : script);
    await page.route(origin + representative.route, async route => {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fallback });
    }, { times: 1 });
  }
  await page.goto(origin + representative.route, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-geometry-ready') === 'true', null, { timeout: 5000 });
  return isRedirect;
}

async function inspect(representative, viewport, label, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) await route.abort();
    else await route.continue();
  });
  try {
    const fallbackMode = await load(page, representative);
    const result = await page.evaluate(() => {
      const layer = document.getElementById('indraLayer');
      if (!layer) return { missing: true };
      const style = getComputedStyle(layer);
      const rect = layer.getBoundingClientRect();
      const body = document.body;
      const centre = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      const map = document.getElementById('projectMap');
      const mapStyle = map ? getComputedStyle(map) : null;
      const mapRect = map ? map.getBoundingClientRect() : null;
      const labels = [...document.querySelectorAll('#mapNodes text')].filter(node => {
        const computed = getComputedStyle(node);const box = node.getBoundingClientRect();
        return computed.display !== 'none' && computed.visibility !== 'hidden' && Number.parseFloat(computed.opacity || '1') > 0 && box.width > 0 && box.height > 0;
      }).length;
      const firstDot = document.querySelector('#mapNodes .node-dot');
      const firstThread = document.querySelector('#mapThreads line');
      return {
        missing: false,
        display: style.display,
        visibility: style.visibility,
        opacity: Number.parseFloat(style.opacity),
        color: style.color,
        position: style.position,
        pointerEvents: style.pointerEvents,
        zIndex: Number.parseInt(style.zIndex, 10),
        width: rect.width,
        height: rect.height,
        clip: style.clip,
        clipPath: style.clipPath,
        contentVisibility: style.contentVisibility,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        svg: layer.querySelectorAll('svg').length,
        shapes: layer.querySelectorAll('circle,path,line,polygon,polyline,rect').length,
        shapeAttribute: Number.parseInt(layer.getAttribute('data-geometry-shapes') || '', 10),
        markupBytes: new TextEncoder().encode(layer.innerHTML).length,
        markupAttribute: Number.parseInt(layer.getAttribute('data-geometry-markup-bytes') || '', 10),
        bodyRole: body.getAttribute('data-geometry-role') || '',
        layerRole: layer.getAttribute('data-geometry-role') || '',
        kind: layer.getAttribute('data-geometry-kind') || '',
        source: layer.getAttribute('data-geometry-source') || '',
        input: layer.getAttribute('data-geometry-input') || '',
        proof: layer.getAttribute('data-geometry-proof') || '',
        signature: layer.getAttribute('data-geometry-signature') || '',
        routeType: body.getAttribute('data-route-type') || '',
        centreIsLayer: centre === layer || Boolean(centre && centre.closest && centre.closest('#indraLayer')),
        scrollRange: Math.max(0, document.documentElement.scrollHeight - innerHeight),
        transform: style.transform,
        homeNodes: document.querySelectorAll('#mapNodes .project-node').length,
        homeThreads: document.querySelectorAll('#mapThreads line').length,
        homeLabels: labels,
        homeMapDisplay: mapStyle ? mapStyle.display : '',
        homeMapVisibility: mapStyle ? mapStyle.visibility : '',
        homeMapOpacity: mapStyle ? Number.parseFloat(mapStyle.opacity || '1') : 0,
        homeMapWidth: mapRect ? mapRect.width : 0,
        homeMapHeight: mapRect ? mapRect.height : 0,
        homeDotStroke: firstDot ? getComputedStyle(firstDot).stroke : '',
        homeThreadStroke: firstThread ? getComputedStyle(firstThread).stroke : '',
        pathname: location.pathname
      };
    });
    const prefix = `${representative.routeType}:${representative.foregroundMode}:${label}:${representative.route}`;
    if (result.missing) errors.push(`${prefix}: #indraLayer missing`);
    else {
      const opacityFloor = representative.foregroundMode === 'structural' ? 0.025 : 0.04;
      if (result.display === 'none' || result.visibility === 'hidden' || !(result.opacity >= opacityFloor)) errors.push(`${prefix}: geometry opacity ${result.opacity} is below ${opacityFloor}`);
      if (result.color === 'transparent' || /rgba\([^)]*,\s*0(?:\.0*)?\s*\)/i.test(result.color)) errors.push(`${prefix}: geometry colour is transparent`);
      if (result.position !== 'fixed') errors.push(`${prefix}: geometry is not fixed`);
      if (result.pointerEvents !== 'none' || result.centreIsLayer) errors.push(`${prefix}: geometry intercepts pointer input`);
      if (!(result.width >= result.viewportWidth && result.height >= result.viewportHeight)) errors.push(`${prefix}: geometry does not cover viewport`);
      if (result.svg !== 1 || result.shapes < 1) errors.push(`${prefix}: runtime SVG is empty`);
      if (result.shapes > MAX_SHAPES || result.shapeAttribute !== result.shapes) errors.push(`${prefix}: shape budget/attribute mismatch (${result.shapes}/${result.shapeAttribute})`);
      if (result.markupBytes > MAX_MARKUP_BYTES || result.markupAttribute !== result.markupBytes) errors.push(`${prefix}: markup budget/attribute mismatch (${result.markupBytes}/${result.markupAttribute})`);
      if (result.clipPath !== 'none' || !['auto', 'rect(auto, auto, auto, auto)'].includes(result.clip) || result.contentVisibility === 'hidden') errors.push(`${prefix}: geometry is clipped or content-hidden`);
      if (result.bodyRole !== result.layerRole) errors.push(`${prefix}: body/layer structural roles disagree`);
      if (result.kind !== 'shared-scroll-layer' || result.source !== 'shared-scroll-layer' || result.input !== 'path-route-scroll' || result.proof !== 'all-page-scroll' || !result.signature.startsWith(`${result.routeType}:`)) errors.push(`${prefix}: Indra layer is not honestly marked as the all-page scroll geometry contract`);
      if (!Number.isFinite(result.zIndex) || result.zIndex < 2000000000) errors.push(`${prefix}: geometry z-index ${result.zIndex} is below 2000000000`);
      if (fallbackMode && result.pathname !== new URL(origin + representative.route).pathname) errors.push(`${prefix}: redirect fallback was not tested at its real route`);
      if (representative.routeType === 'home') {
        // Mobile layouts retain deliberate page gutters; 80% of the viewport
        // proves a substantial structural map without falsely requiring it to
        // bleed into those gutters.
        const minimumWidth = label === 'phone' || label === 'reduced-motion' ? result.viewportWidth * 0.80 : Math.min(700, result.viewportWidth * 0.55);
        const labelsRequired = label === 'desktop' ? 15 : 0;
        const colourInvisible = value => !value || value === 'none' || value === 'transparent' || /rgba\([^)]*,\s*0(?:\.0*)?\s*\)/i.test(value);
        if (result.homeNodes !== 15 || result.homeThreads < 23 || result.homeLabels < labelsRequired ||
            result.homeMapDisplay === 'none' || result.homeMapVisibility === 'hidden' || result.homeMapOpacity < 0.8 ||
            result.homeMapWidth < minimumWidth || result.homeMapHeight < 180 ||
            colourInvisible(result.homeDotStroke) || colourInvisible(result.homeThreadStroke)) {
          errors.push(`${prefix}: homepage structural project web is not strongly visible (${result.homeMapWidth}x${result.homeMapHeight}, ${result.homeLabels} labels)`);
        }
      }
      if (reducedMotion === 'reduce') {
        const before = result.transform;
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(80);
        const after = await page.locator('#indraLayer').evaluate(element => getComputedStyle(element).transform);
        if (before !== after) errors.push(`${prefix}: reduced-motion geometry does not remain still`);
      } else if (result.scrollRange > 80) {
        const before = result.transform;
        await page.evaluate(() => scrollTo(0, Math.max(120, document.documentElement.scrollHeight - innerHeight)));
        await page.waitForTimeout(120);
        const after = await page.locator('#indraLayer').evaluate(element => getComputedStyle(element).transform);
        if (before === after) errors.push(`${prefix}: scroll-reactive geometry did not move after scrolling`);
      }
    }
    checks += 1;
  } catch (error) {
    errors.push(`${representative.routeType}:${label}:${representative.route}: ${error.message}`);
  } finally {
    await context.close();
  }
}

try {
  for (const representative of representatives.values()) {
    await inspect(representative, { width: 1440, height: 900 }, 'desktop');
    if (PHONE_TYPES.has(representative.routeType)) await inspect(representative, { width: 390, height: 844 }, 'phone');
  }
  const home = [...representatives.values()].find(representative => representative.routeType === 'home');
  await inspect(home, { width: 390, height: 844 }, 'reduced-motion', 'reduce');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

if (errors.length) {
  console.error('VISIBLE GEOMETRY BROWSER CHECK FAILED');
  errors.forEach(error => console.error(` - ${error}`));
  process.exit(1);
}

console.log(`VISIBLE GEOMETRY BROWSER CHECK PASSED - ${checks} desktop/mobile/reduced-motion renders cover ${representatives.size} distinct surface signatures across all ${routeTypesSeen.size} route types; every sample has a nontransparent, nonclipped, bounded shared scroll layer at z-index >= 2000000000, scrollable samples move on scroll, reduced-motion remains still, redirect fallbacks run at real routes, and the homepage project web is strongly visible.`);
