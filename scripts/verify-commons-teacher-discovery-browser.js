#!/usr/bin/env node
'use strict';

/**
 * Focused source-first and reflow QA for Polymyth Commons and Teacher
 * Resources. These 14 scenarios use source pages so the discovery contract
 * can be checked independently of the complete deployment build.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_EXECUTABLE || (fs.existsSync('/tmp/chromium')
  ? '/tmp/chromium'
  : chromium.executablePath());
const failures = [];
const passed = [];

function check(condition, scenario, message, detail = '') {
  if (!condition) failures.push(`${scenario}: ${message}${detail ? ` — ${detail}` : ''}`);
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
    pathname = decodeURIComponent(new URL(requestUrl, 'http://qa.local').pathname);
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
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': mime(file) });
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

async function inspectLayout(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const elements = [];
    const seen = new Set();
    for (const selector of requestedSelectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) elements.push(element);
      }
    }
    const overflows = [];
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (
        element.scrollWidth > element.clientWidth + 1 ||
        rect.left < -1 ||
        rect.right > document.documentElement.clientWidth + 1
      ) {
        overflows.push({
          text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
          selector: element.className || element.tagName,
          client: element.clientWidth,
          scroll: element.scrollWidth,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          viewport: document.documentElement.clientWidth,
        });
      }
    }
    return {
      overflows,
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  }, selectors);
}

async function splitNaturalWords(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const failures = [];
    const seen = new Set();
    for (const selector of requestedSelectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        if (!element.getBoundingClientRect().width) continue;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const source = node.nodeValue || '';
          for (const match of source.matchAll(/[\p{L}\p{N}]+/gu)) {
            if (match[0].length < 2) continue;
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const lines = new Set(Array.from(range.getClientRects()).map(rect => Math.round(rect.top)));
            if (lines.size > 1) failures.push(`${match[0]} in ${(element.textContent || '').trim().slice(0, 70)}`);
          }
        }
      }
    }
    return failures;
  }, selectors);
}

async function overlappingActions(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const failures = [];
    for (const selector of requestedSelectors) {
      for (const container of document.querySelectorAll(selector)) {
        const actions = Array.from(container.querySelectorAll('a,button')).filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        for (let first = 0; first < actions.length; first += 1) {
          for (let second = first + 1; second < actions.length; second += 1) {
            const a = actions[first].getBoundingClientRect();
            const b = actions[second].getBoundingClientRect();
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            ) failures.push(`${actions[first].textContent.trim()} / ${actions[second].textContent.trim()}`);
          }
        }
      }
    }
    return failures;
  }, selectors);
}

const scenarios = [];
for (const width of [320, 390, 768]) {
  scenarios.push({
    name: `commons-home-${width}`,
    width,
    route: '/polymythcommons/',
    waitFor: '.vertical-card',
    layout: ['.vertical-grid', '.vertical-card', '.vertical-card h3'],
    natural: ['.vertical-card h3'],
    actions: [],
    assert: async (page, name) => {
      const columns = await page.locator('.vertical-card').evaluateAll(cards => (
        new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size
      ));
      check(columns === 1, name, 'project grid did not collapse before title squeeze', String(columns));
    },
  });
}
for (const width of [320, 390, 768]) {
  scenarios.push({
    name: `commons-directory-${width}`,
    width,
    route: '/polymythlib/?scope=All%20Book%20Records&q=AFFECT',
    waitFor: '.result-row',
    layout: ['.result-row', '.result-main', '.result-actions', '.result-actions a'],
    natural: ['.result-main h2', '.result-actions a'],
    actions: ['.result-actions'],
    assert: async (page, name) => {
      const title = await page.locator('.result-row h2 a').first().getAttribute('href');
      const source = await page.locator('.result-actions .primary').first().getAttribute('href');
      const details = await page.locator('.result-actions .research-link').first().getAttribute('href');
      check(title === 'http://www.affect.ucita.com/why.html', name, 'project title is not source-first', title);
      check(source === title, name, 'primary source button disagrees with title destination', `${source} / ${title}`);
      check(details === '/polymythlib/projects/PC-0002/', name, 'research details are not secondary', details);
    },
  });
}
for (const width of [320, 390, 768]) {
  scenarios.push({
    name: `teacher-root-${width}`,
    width,
    route: '/teacherresources/',
    waitFor: '.teacher-area-card',
    setup: async page => {
      await page.locator('details.group').first().evaluate(element => { element.open = true; });
      await page.locator('details.category').first().evaluate(element => { element.open = true; });
    },
    layout: [
      '.teacher-area-card', '.teacher-area-card strong',
      'details.group:first-of-type .grp-title',
      'details.group:first-of-type details.category:first-of-type .cat-title',
      'details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type',
      'details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type .entry',
      'details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type .entry-title',
      'details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type .entry-source-cta',
      'details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type .entry-detail',
    ],
    natural: [
      '.teacher-area-card strong',
      'details.group:first-of-type .grp-title',
      'details.group:first-of-type details.category:first-of-type .cat-title',
      'details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type .entry-title',
    ],
    actions: ['details.group:first-of-type details.category:first-of-type .entry-shell:first-of-type'],
    assert: async (page, name) => {
      const source = await page.locator('.entry-shell .entry').first().getAttribute('href');
      const details = await page.locator('.entry-shell .entry-detail').first().getAttribute('href');
      check(/^https?:/.test(source || ''), name, 'resource title does not open the original source', source);
      check(/^\/teacherresources\/.+\/$/.test(details || ''), name, 'secondary detail route is missing', details);
      check(await page.locator('.teacher-area-card').count() === 7, name, 'teaching-area inventory drifted');
    },
  });
}
for (const width of [320, 390, 768]) {
  scenarios.push({
    name: `teacher-collection-${width}`,
    width,
    route: '/teacherresources/ela/ela-tb-holt/',
    waitFor: '.resource-row',
    layout: ['.resource-row', '.resource-row h2', '.resource-actions', '.resource-actions .button'],
    natural: ['.resource-row h2'],
    actions: ['.resource-actions'],
    assert: async (page, name) => {
      const title = await page.locator('.resource-source-link').first().getAttribute('href');
      const source = await page.locator('.resource-actions .button').first().getAttribute('href');
      const details = await page.locator('.resource-actions .secondary').first().getAttribute('href');
      check(title === source && /^https?:/.test(title || ''), name, 'title/button do not share the source destination', `${title} / ${source}`);
      check(/^\/teacherresources\/.+\/$/.test(details || ''), name, 'collection detail route is not secondary', details);
    },
  });
}
scenarios.push({
  name: 'teacher-detail-320',
  width: 320,
  route: '/teacherresources/ela/ela-inst-esl/denote-92453e09/',
  waitFor: '.source-banner',
  layout: ['main', 'h1', '.source-banner', '.source-banner .button', '.definition'],
  natural: ['h1', '.source-banner .button'],
  actions: ['.source-banner'],
  assert: async (page, name) => {
    const source = await page.locator('.source-banner .button').getAttribute('href');
    check(source === '/aitr/#denote', name, 'detail page does not lead with its original resource', source);
  },
});
scenarios.push({
  name: 'commons-record-320',
  width: 320,
  route: '/polymythlib/projects/PC-0002/',
  waitFor: '.entity-actions .primary',
  layout: ['.entity-hero', '.entity-hero h1', '.entity-actions', '.entity-actions .button', '.destination-note'],
  natural: ['.entity-hero h1', '.entity-actions .button', '.destination-note'],
  actions: ['.entity-actions'],
  assert: async (page, name) => {
    const source = await page.locator('.entity-actions .primary').getAttribute('href');
    check(source === 'http://www.affect.ucita.com/why.html', name, 'record primary action is not its book-listed website', source);
  },
});

async function runScenario(browser, base, scenario) {
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: 900 },
    locale: 'en-CA',
    reducedMotion: 'reduce',
  });
  await context.route('**/*', route => (
    route.request().url().startsWith(base) ? route.continue() : route.abort()
  ));
  const page = await context.newPage();
  const runtimeErrors = [];
  const responseErrors = [];
  page.on('pageerror', error => runtimeErrors.push(String(error)));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      responseErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  try {
    await page.goto(`${base}${scenario.route}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(scenario.waitFor);
    if (scenario.setup) await scenario.setup(page);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--ss-user-font-size', '23.2px');
      document.documentElement.style.fontSize = '23.2px';
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await inspectLayout(page, scenario.layout);
    const splitWords = await splitNaturalWords(page, scenario.natural);
    const overlaps = await overlappingActions(page, scenario.actions);
    check(!layout.documentOverflow, scenario.name, 'document has horizontal overflow at 145% text');
    check(layout.overflows.length === 0, scenario.name, 'scoped element overflow at 145% text', JSON.stringify(layout.overflows.slice(0, 6)));
    check(splitWords.length === 0, scenario.name, 'ordinary word split across lines', splitWords.slice(0, 8).join(' | '));
    check(overlaps.length === 0, scenario.name, 'primary and secondary actions overlap', overlaps.slice(0, 6).join(' | '));
    check(runtimeErrors.length === 0, scenario.name, 'runtime errors', runtimeErrors.join(' | '));
    check(responseErrors.length === 0, scenario.name, 'local response failures', responseErrors.join(' | '));
    await scenario.assert(page, scenario.name);
    if (!failures.some(failure => failure.startsWith(`${scenario.name}:`))) passed.push(scenario.name);
  } finally {
    await context.close();
  }
}

async function main() {
  check(scenarios.length === 14, 'browser-matrix', 'scenario inventory must remain exactly 14', String(scenarios.length));
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    for (const scenario of scenarios) await runScenario(browser, server.base, scenario);
  } finally {
    await browser.close();
    await server.close();
  }
  if (failures.length) {
    console.error(`COMMONS / TEACHER DISCOVERY BROWSER CHECK FAILED — ${passed.length}/14 scenarios passed`);
    failures.forEach(failure => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log('COMMONS / TEACHER DISCOVERY BROWSER CHECK PASSED — 14/14 source-first, overlap, overflow, and natural-word scenarios at 145% text.');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
