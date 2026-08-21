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
const CASES = [
  {width: 1440, height: 1000, zoom: 1, touch: false},
  {width: 970, height: 904, zoom: 1, touch: false},
  {width: 760, height: 900, zoom: 1, touch: false},
  {width: 375, height: 812, zoom: 1, touch: true},
  {width: 320, height: 760, zoom: 1, touch: true},
  {width: 970, height: 904, zoom: 2, touch: false},
];
const failures = [];
let assertions = 0;

function check(condition, label, detail = '') {
  assertions += 1;
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

function equal(actual, expected, label) {
  check(actual === expected, label, `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function sameArray(actual, expected, label) {
  check(
    JSON.stringify(actual) === JSON.stringify(expected),
    label,
    `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function mime(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.webp': 'image/webp',
    '.xml': 'application/xml; charset=utf-8',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveSource(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://home.test').pathname);
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

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function snapshot(page) {
  return page.evaluate(() => ({
    panelHeight: document.getElementById('projectPanel').offsetHeight,
    listHeight: document.getElementById('projectList').offsetHeight,
    bodyHeight: document.body.scrollHeight,
    itemHeights: [...document.querySelectorAll('.project-list-item')].map(item => item.offsetHeight),
    selectedId: document.getElementById('projectPanel').dataset.selectedId,
    activeNodes: [...document.querySelectorAll('.project-node.active')].map(node => node.dataset.id),
    activeButtons: [...document.querySelectorAll('.project-list button.active')]
      .map(button => button.closest('.project-list-item').dataset.id),
    pressedButtons: [...document.querySelectorAll('.project-list button[aria-pressed="true"]')]
      .map(button => button.closest('.project-list-item').dataset.id),
    currentPreviews: [...document.querySelectorAll('.project-preview-card.is-current')]
      .map(preview => preview.dataset.previewId),
    activeLines: [...document.querySelectorAll('.threads line.active')]
      .map(line => `${line.dataset.from}>${line.dataset.to}`).sort(),
    inlineExpansions: document.querySelectorAll('[aria-expanded],.mobile-project-detail').length,
    interactivePreviewLinks: [...document.querySelectorAll('.project-preview-card .open-project')]
      .filter(link => link.tabIndex >= 0 && !link.closest('[inert]')).length,
  }));
}

async function expectedLines(page, id) {
  return page.evaluate(projectId => [...document.querySelectorAll('.threads line')]
    .filter(line => line.dataset.from === projectId || line.dataset.to === projectId)
    .map(line => `${line.dataset.from}>${line.dataset.to}`).sort(), id);
}

function stableHeights(now, initial, label) {
  equal(now.panelHeight, initial.panelHeight, `${label} keeps preview height fixed`);
  equal(now.listHeight, initial.listHeight, `${label} keeps list height fixed`);
  equal(now.bodyHeight, initial.bodyHeight, `${label} keeps document height fixed`);
  sameArray(now.itemHeights, initial.itemHeights, `${label} keeps every list item height fixed`);
}

function neutralState(now, label) {
  equal(now.selectedId, 'none', `${label} has no selected project`);
  sameArray(now.activeNodes, [], `${label} has no active map node`);
  sameArray(now.activeButtons, [], `${label} has no active list button`);
  sameArray(now.pressedButtons, [], `${label} has no pressed list button`);
  sameArray(now.currentPreviews, ['none'], `${label} shows only the neutral preview`);
  sameArray(now.activeLines, [], `${label} has no active line`);
  equal(now.inlineExpansions, 0, `${label} has no inline expansion surface`);
  equal(now.interactivePreviewLinks, 0, `${label} has no project link before selection`);
}

async function selectedState(page, now, id, label) {
  equal(now.selectedId, id, `${label} stores the selected project`);
  sameArray(now.activeNodes, [id], `${label} synchronizes the active map node`);
  sameArray(now.activeButtons, [id], `${label} synchronizes the active list button`);
  sameArray(now.pressedButtons, [id], `${label} synchronizes aria-pressed`);
  sameArray(now.currentPreviews, [id], `${label} synchronizes the visible preview`);
  sameArray(now.activeLines, await expectedLines(page, id), `${label} synchronizes every connected line`);
  equal(now.inlineExpansions, 0, `${label} creates no inline expansion surface`);
  equal(now.interactivePreviewLinks, 1, `${label} exposes only the selected project link`);
}

async function activateListControl(page, id, touch) {
  const control = page.locator(`.project-list-item[data-id="${id}"] button`);
  if (touch) await control.tap();
  else await control.click();
}

async function runCase(browser, base, testCase) {
  const {width, height, zoom, touch} = testCase;
  const caseLabel = `w${width} z${zoom}${touch ? ' touch' : ''}`;
  const context = await browser.newContext({
    viewport: {width, height},
    hasTouch: touch,
    locale: 'en-CA',
    reducedMotion: 'reduce',
  });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    return route.fulfill({status: 204, body: ''});
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  try {
    await page.goto(`${base}/`, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => (
      document.querySelectorAll('.project-list-item').length === 15
      && document.querySelectorAll('.project-preview-card').length === 16
    ));
    if (zoom !== 1) {
      await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, zoom);
    }
    await settle(page);

    equal(await page.locator('.project-list-item').count(), 15, `${caseLabel} retains all fifteen projects`);
    equal(await page.locator('.project-preview-card').count(), 16, `${caseLabel} retains fifteen previews plus neutral`);
    const initial = await snapshot(page);
    neutralState(initial, `${caseLabel} initial state`);
    const ids = await page.locator('.project-list-item').evaluateAll(items => items.map(item => item.dataset.id));

    for (const id of ids) {
      await activateListControl(page, id, touch);
      const now = await snapshot(page);
      stableHeights(now, initial, `${caseLabel} ${id}`);
      await selectedState(page, now, id, `${caseLabel} ${id}`);
    }

    const lastId = ids[ids.length - 1];
    await activateListControl(page, lastId, touch);
    const toggledNeutral = await snapshot(page);
    stableHeights(toggledNeutral, initial, `${caseLabel} toggle to neutral`);
    neutralState(toggledNeutral, `${caseLabel} toggle to neutral`);

    await activateListControl(page, 'teacher', touch);
    const teacher = page.locator('.project-list-item[data-id="teacher"] button');
    const nutrition = page.locator('.project-list-item[data-id="nutrition"] button');
    if (!touch) {
      await nutrition.hover();
      await settle(page);
      const hover = await page.evaluate(() => {
        const active = document.querySelector('.project-list-item[data-id="teacher"] button');
        const hovered = document.querySelector('.project-list-item[data-id="nutrition"] button');
        return {
          selectedId: document.getElementById('projectPanel').dataset.selectedId,
          activeBackground: getComputedStyle(active).backgroundColor,
          activeShadow: getComputedStyle(active).boxShadow,
          hoverBackground: getComputedStyle(hovered).backgroundColor,
          hoverShadow: getComputedStyle(hovered).boxShadow,
        };
      });
      equal(hover.selectedId, 'teacher', `${caseLabel} list hover does not activate another project`);
      check(
        hover.activeBackground !== hover.hoverBackground || hover.activeShadow !== hover.hoverShadow,
        `${caseLabel} hover remains visually distinct from active selection`,
        `active ${hover.activeBackground} / ${hover.activeShadow}; hover ${hover.hoverBackground} / ${hover.hoverShadow}`,
      );
    }

    await teacher.focus();
    await page.keyboard.press('Enter');
    const enterNeutral = await snapshot(page);
    stableHeights(enterNeutral, initial, `${caseLabel} Enter toggle`);
    neutralState(enterNeutral, `${caseLabel} Enter toggle`);
    await page.keyboard.press('Space');
    const spaceSelected = await snapshot(page);
    stableHeights(spaceSelected, initial, `${caseLabel} Space selection`);
    await selectedState(page, spaceSelected, 'teacher', `${caseLabel} Space selection`);

    if (!touch && width > 900 && zoom === 1) {
      const nutritionNode = page.locator('.project-node[data-id="nutrition"] .node-dot');
      await nutritionNode.hover();
      equal(
        (await snapshot(page)).selectedId,
        'teacher',
        `${caseLabel} constellation hover does not activate another project`,
      );
      await nutritionNode.click();
      const nodeSelected = await snapshot(page);
      stableHeights(nodeSelected, initial, `${caseLabel} constellation click`);
      await selectedState(page, nodeSelected, 'nutrition', `${caseLabel} constellation click`);
    }

    check(runtimeErrors.length === 0, `${caseLabel} produces no runtime errors`, runtimeErrors.join(' | '));
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
    for (const testCase of CASES) await runCase(browser, server.base, testCase);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
  if (failures.length) {
    console.error('HOME MAP STABILITY BROWSER CHECK FAILED');
    failures.forEach(failure => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log(`HOME MAP STABILITY BROWSER CHECK PASSED — ${assertions} assertions across fifteen projects, neutral, six desktop/mobile/touch/zoom states, keyboard, click, and hover.`);
})().catch(error => {
  console.error(`HOME MAP STABILITY BROWSER CHECK FAILED — ${error.stack || error}`);
  process.exit(1);
});
