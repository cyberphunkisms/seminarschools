#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const selector = require('./lib/browser-test-tiers.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/browser-test-tiers.json'), 'utf8'));
const PUBLIC = path.join(ROOT, contract.public_root);

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find(value => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tier = option('tier', 'changed');
if (!contract.tiers[tier]) throw new Error(`unsupported browser tier ${tier}`);
const shardIndex = Number(option('shard-index', '0'));
const shardCount = Number(option('shard-count', '1'));
const changedListPath = option('changed-file-list');
const changedFiles = changedListPath && fs.existsSync(changedListPath)
  ? fs.readFileSync(changedListPath, 'utf8').split(/\r?\n/).filter(Boolean)
  : process.argv.filter(value => value.startsWith('--changed-file=')).map(value => value.slice('--changed-file='.length));
const pages = selector.inventory(PUBLIC, contract.exact_exceptions);
const selected = selector.selectPages({ tier, pages, changedFiles, shardIndex, shardCount });
if (!selected.length) throw new Error(`browser tier ${tier} selected no pages`);

function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function redirectFallback(html) {
  return html
    .replace(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/ig, '')
    .replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/ig, script =>
      /\blocation\s*(?:=|\.(?:replace|assign)\s*\()/.test(script) ? '' : script);
}

const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  let relative = pathname.replace(/^\/+/, '');
  if (!relative || pathname.endsWith('/')) relative += 'index.html';
  let file = path.resolve(PUBLIC, relative);
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
  const type = contentType(file);
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  if (type.startsWith('text/html')) {
    const html = fs.readFileSync(file, 'utf8');
    response.end(/http-equiv=["']refresh["']|\blocation\s*(?:=|\.(?:replace|assign)\s*\()/i.test(html) ? redirectFallback(html) : html);
  } else fs.createReadStream(file).pipe(response);
});

await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
function usableExecutable(candidate) {
  try { return candidate && fs.statSync(candidate).isFile() && fs.statSync(candidate).size > 0; }
  catch { return false; }
}
const requestedExecutable = process.env.CHROME_EXECUTABLE || '';
const executablePath = usableExecutable(requestedExecutable)
  ? requestedExecutable
  : usableExecutable('/tmp/chromium') ? '/tmp/chromium' : chromium.executablePath();
const browser = await chromium.launch({ headless: true, executablePath, args: executablePath === '/tmp/chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === origin) await route.continue(); else await route.abort();
});

const failures = [];
const results = [];
for (const candidate of selected) {
  const runtimeErrors = [];
  const onPageError = error => runtimeErrors.push(error.message);
  const onConsole = message => {
    if (message.type() !== 'error') return;
    const value = message.text();
    // The harness deliberately aborts cross-origin requests so it remains a
    // deterministic local-site test. Chromium logs that intentional action as
    // ERR_FAILED; retain every other console error, including local 404s.
    if (value === 'Failed to load resource: net::ERR_FAILED') return;
    runtimeErrors.push(value);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    await page.goto(origin + candidate.route, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-geometry-ready') === 'true', null, { timeout: 6000 });
    const state = await page.evaluate(() => {
      const layer = document.getElementById('indraLayer');
      const style = layer ? getComputedStyle(layer) : null;
      const rect = layer ? layer.getBoundingClientRect() : null;
      return {
        routeType: document.body.getAttribute('data-route-type') || '',
        frontFacing: document.body.getAttribute('data-front-facing') || '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        geometry: Boolean(layer),
        display: style && style.display,
        visibility: style && style.visibility,
        opacity: style ? Number.parseFloat(style.opacity || '0') : 0,
        position: style && style.position,
        pointerEvents: style && style.pointerEvents,
        width: rect && rect.width,
        height: rect && rect.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight
      };
    });
    const image = await page.screenshot({ type: 'png', fullPage: contract.tiers[tier].full_page === true, animations: 'disabled' });
    const prefix = `${candidate.routeType}:${candidate.route}`;
    if (state.routeType !== candidate.routeType) failures.push(`${prefix}: rendered route type changed`);
    if (state.frontFacing !== 'general-audience') failures.push(`${prefix}: general-audience marker missing`);
    if (!state.geometry || state.display === 'none' || state.visibility === 'hidden' || state.opacity < 0.09) failures.push(`${prefix}: geometry is absent or invisible`);
    if (state.position !== 'fixed' || state.pointerEvents !== 'none' || state.width < state.viewportWidth || state.height < state.viewportHeight) failures.push(`${prefix}: geometry is not viewport-covering and pointer-safe`);
    if (state.overflow > 1) failures.push(`${prefix}: ${state.overflow}px horizontal overflow`);
    if (image.length < 1000) failures.push(`${prefix}: rendered screenshot is unexpectedly empty`);
    if (runtimeErrors.length) failures.push(`${prefix}: runtime errors: ${runtimeErrors.slice(0, 3).join(' | ')}`);
    results.push({ route: candidate.route, route_type: candidate.routeType, screenshot_bytes: image.length, full_page: contract.tiers[tier].full_page === true });
  } catch (error) {
    failures.push(`${candidate.routeType}:${candidate.route}: ${error.message}`);
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

await context.close();
await browser.close();
await new Promise(resolve => server.close(resolve));
const report = {
  schema: 'seminar-schools-browser-tier-report-v1', contract_id: 'FP-08', tier,
  shard_index: shardIndex, shard_count: shardCount, selected: selected.length,
  failures, results
};
const reportPath = option('report');
if (reportPath) fs.writeFileSync(path.resolve(ROOT, reportPath), `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`FP-08 ${tier.toUpperCase()} BROWSER TIER FAILED — ${failures.length} failure(s) across ${selected.length} pages.`);
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`FP-08 ${tier.toUpperCase()} BROWSER TIER PASSED — rendered ${selected.length} page(s), shard ${shardIndex + 1}/${shardCount}${contract.tiers[tier].full_page ? ', full-page screenshots' : ''}.`);
