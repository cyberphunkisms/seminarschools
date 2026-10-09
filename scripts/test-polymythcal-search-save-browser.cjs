#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.resolve(process.env.POLYMYTHCAL_TEST_SITE_ROOT || path.join(ROOT, 'public'));
const OUTPUT = process.env.POLYMYTHCAL_TEST_OUTPUT;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  let route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (route.endsWith('/')) route += 'index.html';
  const file = path.resolve(PUBLIC, '.' + route);
  if (!file.startsWith(PUBLIC + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

const checks = [], rows = [], errors = [];
function check(condition, label) {
  checks.push({ label, pass: Boolean(condition) });
  assert.ok(condition, label);
}
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  for (const language of ['en', 'fr']) for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: language + '-CA', timezoneId: 'America/Toronto' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({ status: 204, body: '' }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-03T16:00:00Z'));
    const prefix = '/polymythseminars/' + (language === 'fr' ? 'fr/' : '');
    const label = language + '/' + width;
    async function go(suffix = '') {
      await page.goto(origin + prefix + suffix, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.pmd-shell')?.dataset.savedSearchLabel);
    }
    await go();
    for (const [query, id] of [
      ['drop-in', 'research-e9b8f1c64f51'],
      ['year-round', 'teen-ink-submissions-2026-2027'],
      ['l’écoute', 'research-4025b4d53bc6'],
      ["l'écoute", 'research-4025b4d53bc6'],
      ['Montréal-Nord', 'montreal-nord-borough-council-fall-2026'],
      ['title:drop-in', 'research-e9b8f1c64f51'],
      ['place:montreal-nord', 'montreal-nord-borough-council-fall-2026'],
      ['"drop-in"', 'research-e9b8f1c64f51'],
    ]) {
      const result = await page.evaluate(query => new Promise(resolve => {
        document.addEventListener('polymythcal:results', () => resolve({
          count: document.querySelector('#pmdResultsCount').textContent,
          ids: [...document.querySelectorAll('#pmdList article[data-event-id]')].map(item => item.dataset.eventId),
        }), { once: true });
        const input = document.querySelector('#pmdSearch');
        input.value = query; input.dispatchEvent(new Event('input', { bubbles: true }));
      }), query);
      check(result.ids.includes(id), label + ' finds literal query ' + query);
      check(await page.locator('[data-event-id="' + id + '"]').isVisible(), label + ' matching record is visible');
      rows.push({ language, width, query, ...result });
    }
    await go('?q=Montr%C3%A9al-Nord&places=toronto-gta');
    check(await page.locator('.pmd-empty').isVisible(), label + ' query retains incompatible place filter');
    await page.locator('[data-action="clear-all"]').click();
    check(await page.locator('#pmdSearch').inputValue() === '', label + ' clear-all restores search');

    await go('?q=drop-in');
    check(await page.locator('[data-event-id="research-e9b8f1c64f51"]').isVisible(), label + ' bookmarked punctuation search loads');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' search fits viewport');
    if (OUTPUT && language === 'en' && [390, 1280].includes(width)) {
      await page.locator('#pmdResultsTitle').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUTPUT, 'search-' + width + '.png') });
    }

    await go('monitoring/?q=' + encodeURIComponent('title:"Canadian Political Science Association"'));
    const series = page.locator('[data-event-id="cpsa-2027-cfp-watch"]');
    check(await series.count() === 1, label + ' monitoring series is found');
    check(await series.locator('h3 a').count() === 0, label + ' existing plain series heading is preserved');
    check(await series.locator('.save-event').count() === 1, label + ' monitoring series has one Save button');
    const title = await series.locator('h3').innerText();
    const details = new URL(await series.locator('a[href*="/events/"]').first().getAttribute('href'), origin);
    await series.locator('.save-event').click();
    check(await series.locator('.save-event').getAttribute('aria-pressed') === 'true', label + ' monitoring save updates button');
    await page.locator('.pmd-tools summary').click();
    await page.locator('#pmSavedToggle').click();
    check(await page.locator('.pm-saved-list a').innerText() === title, label + ' saved title is the series title');
    const savedHref = await page.locator('.pm-saved-list a').getAttribute('href');
    check(savedHref === details.pathname + details.search, label + ' save keeps internal details and exact return view');
    if (OUTPUT && language === 'en' && width === 390) {
      await series.screenshot({ path: path.join(OUTPUT, 'monitoring-series-390.png') });
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.pmd-shell')?.dataset.savedSearchLabel);
    check(await series.locator('.save-event').getAttribute('aria-pressed') === 'true', label + ' monitoring save survives reload');
    await go('research/?q=philosophy&date=30d');
    await page.locator('.pmd-tools summary').click();
    await page.locator('#pmSavedToggle').click();
    check(await page.locator('.pm-saved-list a').getAttribute('href') === savedHref, label + ' saved view survives research navigation');
    await page.locator('.pm-saved-list a').click();
    await page.waitForLoadState('networkidle');
    check(await page.locator('.save-event').getAttribute('aria-pressed') === 'true', label + ' detail recognizes monitoring save');
    check(await page.locator('[data-calendar-return]').getAttribute('href') === details.searchParams.get('from'), label + ' details return to monitoring filters');
    await page.locator('.save-event').click();
    await page.locator('[data-calendar-return]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.querySelector('.pmd-shell')?.dataset.savedSearchLabel);
    check(await series.locator('.save-event').getAttribute('aria-pressed') === 'false', label + ' detail removal updates list save state');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' monitoring fits viewport');
    await context.close();
  }
  check(errors.length === 0, 'No browser runtime exceptions');
  const result = { status: 'passed', assertions: checks.length, browser: browser.version(), checks, rows, errors };
  if (OUTPUT) fs.writeFileSync(path.join(OUTPUT, 'browser-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, assertions: result.assertions, browser: result.browser, query_cases: rows.length, errors }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.close(); });
