#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const {FULL_NOON_ID, FULL_NOON_URL} = require('./verify-polymythcal-destination-specificity');

const ROOT = path.resolve(__dirname, '..');
const GENERIC_ID = 'hastac-opportunities-and-cfp-scan-projected-2026-10-15-ac3dcc91';
const READY_TIMEOUT = 60000;
const failures = [];
let assertions = 0;

function check(condition, message, detail = '') {
  assertions += 1;
  if (!condition) failures.push(`${message}${detail ? ` — ${detail}` : ''}`);
}
function equal(actual, expected, message) {
  check(actual === expected, message, `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function contentType(file) {
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ics':'text/calendar; charset=utf-8'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function createServer() {
  const server = http.createServer((request, response) => {
    try {
      const parsed = new URL(request.url, 'http://127.0.0.1');
      let relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const file = path.resolve(ROOT, relative);
      if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) throw new Error('unsafe path');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); response.end('Not found'); return;
      }
      response.writeHead(200, {'content-type':contentType(file),'cache-control':'no-store'});
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(400, {'content-type':'text/plain; charset=utf-8'}); response.end(error.message);
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({server, base:`http://127.0.0.1:${server.address().port}`}));
  });
}

async function waitForCalendar(page) {
  await page.waitForFunction(() => document.getElementById('pmdResults')?.getAttribute('aria-busy') === 'false', undefined, {timeout:READY_TIMEOUT});
}

async function verifyLocale(browser, base, locale) {
  const french = locale === 'fr';
  const prefix = french ? '/polymythseminars/fr/' : '/polymythseminars/';
  const context = await browser.newContext({locale:french?'fr-CA':'en-CA',viewport:{width:1280,height:900}});
  const localOrigin = new URL(base).origin;
  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === localOrigin) await route.continue();
    else await route.fulfill({status:204,contentType:'text/plain; charset=utf-8',body:''});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => errors.push(`${request.failure()?.errorText || 'request failed'}: ${request.url()}`));
  try {
    await page.goto(`${base}${prefix}?time=all&q=${encodeURIComponent('Full Noon Fest')}`, {waitUntil:'domcontentloaded',timeout:READY_TIMEOUT});
    await waitForCalendar(page);
    equal(await page.locator('html').getAttribute('lang'), french ? 'fr-CA' : 'en-CA', `${locale}: localized calendar shell loaded`);
    const card = page.locator(`[data-event-id="${FULL_NOON_ID}"]`);
    equal(await card.count(), 1, `${locale}: Full Noon Fest card rendered once`);
    const actions = card.locator('.pm-card-actions > a');
    equal(await actions.count(), 2, `${locale}: Full Noon card has Details plus one exact external action`);
    check((await actions.nth(0).getAttribute('class') || '').split(/\s+/).includes('primary-link'), `${locale}: Details is the first card action`);
    equal(new URL(await actions.nth(0).getAttribute('href')).pathname, `${prefix}events/${FULL_NOON_ID}/`, `${locale}: first action targets localized internal Details`);
    check(!(await actions.nth(1).getAttribute('class') || '').split(/\s+/).includes('primary-link'), `${locale}: exact external page is a separate non-primary second action`);
    equal(await actions.nth(1).getAttribute('href'), FULL_NOON_URL, `${locale}: Full Noon external action uses the exact reviewed URL`);
    check((await actions.nth(1).getAttribute('rel') || '').split(/\s+/).includes('noreferrer'), `${locale}: Full Noon external action retains safe relationship metadata`);
    check((await actions.nth(1).innerText()).toLocaleLowerCase(french ? 'fr-CA' : 'en-CA').includes(french ? 'page officielle de la série' : 'official series page'), `${locale}: Full Noon action identifies recurring-series scope`);

    const detailUrl = `${base}${prefix}events/${FULL_NOON_ID}/`;
    await page.goto(detailUrl, {waitUntil:'domcontentloaded',timeout:READY_TIMEOUT});
    const detailAction = page.locator('.pm-event-action.primary');
    equal(await detailAction.count(), 1, `${locale}: Full Noon detail has one external primary action`);
    equal(await detailAction.getAttribute('href'), FULL_NOON_URL, `${locale}: detail page keeps the exact reviewed URL`);
    check((await detailAction.innerText()).includes(french ? 'page officielle de la série' : 'official series page'), `${locale}: detail action label keeps series scope`);

    await page.goto(`${base}${prefix}?time=all&q=${encodeURIComponent('HASTAC opportunities and CFP scan')}`, {waitUntil:'domcontentloaded',timeout:READY_TIMEOUT});
    await waitForCalendar(page);
    const genericCard = page.locator(`[data-event-id="${GENERIC_ID}"]`);
    equal(await genericCard.count(), 1, `${locale}: generic-source regression card rendered once`);
    equal(await genericCard.locator('.pm-card-actions > a').count(), 1, `${locale}: generic opportunities index is not surfaced as a second card action`);
    check((await genericCard.locator('.pm-card-actions > a').first().getAttribute('class') || '').split(/\s+/).includes('primary-link'), `${locale}: generic-source card still starts with internal Details`);
    await page.goto(`${base}${prefix}events/${GENERIC_ID}/`, {waitUntil:'domcontentloaded',timeout:READY_TIMEOUT});
    equal(await page.locator('.pm-event-action.primary').count(), 0, `${locale}: generic-source detail page has no external CTA`);
    check(errors.length === 0, `${locale}: destination browser flow has no page or console errors`, errors.join(' | '));
  } finally {
    await context.close();
  }
}

async function main() {
  const {chromium} = require('playwright');
  const {server, base} = await createServer();
  const executablePath = process.env.CHROME_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    await verifyLocale(browser, base, 'en');
    await verifyLocale(browser, base, 'fr');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  if (failures.length) {
    console.error(`POLYMYTHCAL DESTINATION BROWSER CHECK FAILED — ${failures.length} of ${assertions} assertions failed.`);
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log(`POLYMYTHCAL DESTINATION BROWSER CHECK PASSED — ${assertions} assertions across English/French, exact Full Noon actions, Details-first order, detail pages, and fail-closed generic-source cards.`);
}

main().catch((error) => {
  console.error(`POLYMYTHCAL DESTINATION BROWSER CHECK FAILED\n${error.stack || error.message}`);
  process.exit(1);
});
