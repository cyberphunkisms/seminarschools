#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_EXECUTABLE || (fs.existsSync('/tmp/chromium')
  ? '/tmp/chromium'
  : '');
const REPORTED_QUERY = '?format=indigenous&curriculum=alberta%2Cbc%2Ccommon-core';
const LEGACY_KEYS = ['tr-filters-v4', 'tr-filters-v3', 'tr-filters-v2'];
const WIDTHS = [320, 375, 600, 768, 820, 880, 1280];
const failures = [];
let assertions = 0;

function check(condition, label, detail = '') {
  assertions += 1;
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

function mime(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml; charset=utf-8',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveSource(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://teacher.test').pathname);
  } catch (_) {
    return null;
  }
  const requested = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
  if (requested !== ROOT && !requested.startsWith(`${ROOT}${path.sep}`)) return null;
  try {
    const stat = fs.statSync(requested);
    if (stat.isFile()) return requested;
    if (stat.isDirectory()) {
      const index = path.join(requested, 'index.html');
      if (fs.existsSync(index)) return index;
    }
  } catch (_) {}
  return null;
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const file = resolveSource(request.url || '/');
    if (!file) {
      response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
      response.end('Not found');
      return;
    }
    response.writeHead(200, {'cache-control': 'no-store', 'content-type': mime(file)});
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

async function newContext(browser, width, seedLegacy) {
  const context = await browser.newContext({
    viewport: {width, height: 900},
    locale: 'en-CA',
    reducedMotion: 'reduce',
  });
  if (seedLegacy) {
    await context.addInitScript(keys => {
      try {
        const value = JSON.stringify({
          search: '',
          formats: ['indigenous'],
          grades: [],
          subjects: [],
          curricula: ['alberta', 'bc', 'common-core'],
          languages: [],
        });
        keys.forEach(key => localStorage.setItem(key, value));
      } catch (_) {}
    }, LEGACY_KEYS);
  }
  return context;
}

async function ready(page, url) {
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => {
    const count = document.getElementById('result-count');
    return count && !count.hidden && document.querySelectorAll('.chip').length > 0;
  });
}

async function cleanUrlState(browser, base) {
  const context = await newContext(browser, 820, true);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await ready(page, `${base}/teacherresources/`);
    const initial = await page.evaluate(keys => ({
      search: location.search,
      count: document.getElementById('result-count').textContent.trim(),
      persistence: document.getElementById('resource-finder').dataset.persistence,
      storage: keys.map(key => localStorage.getItem(key)),
    }), LEGACY_KEYS);
    check(initial.search === '', 'clean URL remains clean with legacy storage', initial.search);
    check(initial.count === '645 resources across 25 collections', 'clean URL opens complete catalog', initial.count);
    check(initial.persistence === 'url-only', 'finder declares URL-only persistence', initial.persistence);
    check(initial.storage.every(value => value === null), 'legacy local filter records are removed safely');

    await page.locator('[data-preset-subject="indigenous"]').click();
    await page.waitForFunction(() => location.search.includes('subject=indigenous'));
    const selectedUrl = page.url();
    const selectedCount = (await page.locator('#result-count').textContent()).trim();
    check(new URL(selectedUrl).searchParams.get('subject') === 'indigenous', 'user filter writes a shareable URL', selectedUrl);

    await page.evaluate(() => {
      history.pushState(null, '', '?format=assessment');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(previous => document.getElementById('result-count').textContent.trim() !== previous, selectedCount);
    check((await page.locator('#result-count').textContent()).includes('resources'), 'popstate restores URL-selected results');
    await page.goBack({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => new URLSearchParams(location.search).get('subject') === 'indigenous');
    check((await page.locator('#result-count').textContent()).trim() === selectedCount, 'back navigation restores prior filtered view');

    await page.locator('#clear').click();
    await page.waitForFunction(() => location.search === '');
    check((await page.locator('#result-count').textContent()) === '645 resources across 25 collections', 'clear returns to complete clean catalog');
    check(errors.length === 0, 'clean/state scenario has no runtime errors', errors.join(' | '));
  } finally {
    await context.close();
  }
}

async function reportedLayout(browser, base, width) {
  const context = await newContext(browser, width, true);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await ready(page, `${base}/teacherresources/${REPORTED_QUERY}`);
    await page.waitForFunction(() => document.getElementById('result-count').textContent.startsWith('9 resources'));
    const result = await page.evaluate(keys => {
      function lineMetrics(element) {
        const tops = [];
        let characters = 0;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          for (let index = 0; index < node.nodeValue.length; index += 1) {
            if (/\s/.test(node.nodeValue[index])) continue;
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + 1);
            const rect = range.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            characters += 1;
            if (!tops.some(top => Math.abs(top - rect.top) < 1)) tops.push(rect.top);
          }
        }
        return {lines: tops.length, characters, charsPerLine: characters / Math.max(1, tops.length)};
      }
      const visible = [...document.querySelectorAll('.entry-shell:not([hidden])')].filter(shell => shell.getClientRects().length);
      const hiddenOrphans = [...document.querySelectorAll('.entry-shell[hidden] .entry-detail')]
        .filter(link => link.getClientRects().length).length;
      const cards = visible.map(shell => {
        const entry = shell.querySelector('.entry');
        const title = shell.querySelector('.entry-title');
        const entryRect = entry.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        return {
          title: title.textContent.trim(),
          shellWidth: shell.getBoundingClientRect().width,
          shellHeight: shell.getBoundingClientRect().height,
          entryWidth: entryRect.width,
          titleWidth: titleRect.width,
          widthRatio: titleRect.width / Math.max(1, entryRect.width),
          lines: lineMetrics(title),
          overflow: shell.scrollWidth > shell.clientWidth + 1 || entry.scrollWidth > entry.clientWidth + 1,
        };
      });
      return {
        search: location.search,
        count: document.getElementById('result-count').textContent.trim(),
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        hiddenOrphans,
        storage: keys.map(key => localStorage.getItem(key)),
        cards,
      };
    }, LEGACY_KEYS);

    check(result.search === REPORTED_QUERY, `w${width} explicit shared URL is preserved`, result.search);
    check(result.count === '9 resources across 1 collection', `w${width} reported filter returns nine resources`, result.count);
    check(result.cards.length === 9, `w${width} exposes exactly nine complete card shells`, String(result.cards.length));
    check(result.hiddenOrphans === 0, `w${width} has no orphan detail actions`, String(result.hiddenOrphans));
    check(!result.documentOverflow, `w${width} has no document overflow`);
    check(result.storage.every(value => value === null), `w${width} explicit URL clears legacy storage`);
    for (const card of result.cards) {
      check(card.titleWidth >= Math.min(176, card.entryWidth * 0.72), `w${width} title track remains usable`, `${card.title}: ${Math.round(card.titleWidth)}px`);
      check(card.widthRatio >= 0.72, `w${width} title is not starved by metadata`, `${card.title}: ${card.widthRatio.toFixed(2)}`);
      check(card.lines.lines <= 10 && card.lines.charsPerLine >= 4, `w${width} title does not collapse to one glyph per line`, `${card.title}: ${card.lines.lines} lines / ${card.lines.charsPerLine.toFixed(1)} chars`);
      check(card.shellHeight < 440, `w${width} card height remains bounded`, `${card.title}: ${Math.round(card.shellHeight)}px`);
      check(!card.overflow, `w${width} card has no horizontal overflow`, card.title);
    }
    check(errors.length === 0, `w${width} filtered layout has no runtime errors`, errors.join(' | '));
  } finally {
    await context.close();
  }
}

(async () => {
  const server = await startServer();
  let browser;
  try {
    const launchOptions = {headless: true};
    if (CHROME) launchOptions.executablePath = CHROME;
    browser = await chromium.launch(launchOptions);
    await cleanUrlState(browser, server.base);
    for (const width of WIDTHS) await reportedLayout(browser, server.base, width);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  if (failures.length) {
    console.error('TEACHER RESOURCES STATE/LAYOUT BROWSER CHECK FAILED');
    failures.forEach(failure => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log(`TEACHER RESOURCES STATE/LAYOUT BROWSER CHECK PASSED — ${assertions} assertions across clean, shared, history, and ${WIDTHS.length} responsive states.`);
})().catch(error => {
  console.error(`TEACHER RESOURCES STATE/LAYOUT BROWSER CHECK FAILED — ${error.stack || error}`);
  process.exit(1);
});
