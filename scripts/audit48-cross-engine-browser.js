#!/usr/bin/env node
'use strict';

/**
 * Audit 48 Firefox/WebKit browser-engine validation.
 *
 * The default --preflight mode inspects the Playwright/browser contract
 * without launching a browser. A browser run requires the explicit --execute
 * flag so a preflight can never be mistaken for runtime evidence.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { firefox, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'data', 'audit48-browser');
const SCREENSHOTS = path.join(OUT, 'screenshots');
const PREFLIGHT_REPORT = path.join(OUT, 'cross-engine-preflight.json');
const EXECUTION_REPORT = path.join(OUT, 'cross-engine-browser-audit.json');
const RELEASE_MANIFEST = path.join(ROOT, 'RELEASE_MANIFEST.json');
const PLAYWRIGHT_PACKAGE = path.join(ROOT, 'node_modules', 'playwright', 'package.json');
const PROGRAM_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
const OFFICIAL_REFERENCE = 'https://playwright.dev/docs/browsers';
const ENGINES = Object.freeze([
  { name: 'firefox', browserType: firefox },
  { name: 'webkit', browserType: webkit },
]);
const VIEWPORTS = Object.freeze({
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
});

function firstFrenchEventRoute() {
  const root = path.join(PUBLIC, 'polymythseminars', 'fr', 'events');
  if (!fs.existsSync(root)) return null;
  const slug = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'index.html')))
    .map(entry => entry.name)
    .sort()[0];
  return slug ? `/polymythseminars/fr/events/${slug}/` : null;
}

let cachedScenarios = null;
function scenarios() {
  if (cachedScenarios) return cachedScenarios;
  const frenchEventRoute = firstFrenchEventRoute();
  cachedScenarios = [
    {
      id: 'leizu-fr-desktop',
      route: '/leizu/fr/',
      viewport: 'desktop',
      locale: 'fr-CA',
      waitFor: 'main',
      validate: async (page, check) => {
        const root = await page.locator('html').evaluate(node => ({
          lang: node.lang,
          dir: node.dir,
          pending: node.classList.contains('language-pending'),
          dataLang: node.dataset.lang,
        }));
        check('French route exposes the precise language state',
          root.lang === 'fr' && root.dir === 'ltr' && root.dataLang === 'fr' && !root.pending,
          root);
        check('French intake stays inside the localized funnel',
          await page.locator('a[href^="/leizu/fr/intake/"]').count() > 0);
        const target = await page.locator('[data-lang-set="fa"]').first().getAttribute('href');
        check('Persian language choice uses a dedicated route',
          new URL(target || '', page.url()).pathname === '/leizu/fa/', target);
      },
    },
    {
      id: 'leizu-fa-mobile',
      route: '/leizu/fa/',
      viewport: 'mobile',
      locale: 'fa-IR',
      waitFor: 'main',
      validate: async (page, check) => {
        const root = await page.locator('html').evaluate(node => ({
          lang: node.lang,
          dir: node.dir,
          cssDirection: getComputedStyle(node).direction,
          dataLang: node.dataset.lang,
          pending: node.classList.contains('language-pending'),
        }));
        check('Persian route renders right to left without a pending language state',
          root.lang === 'fa' && root.dir === 'rtl' && root.cssDirection === 'rtl'
            && root.dataLang === 'fa' && !root.pending,
          root);
        check('Persian intake stays inside the localized funnel',
          await page.locator('a[href^="/leizu/fa/intake/"]').count() > 0);
      },
    },
    {
      id: 'leizu-zh-hans-intake-mobile',
      route: '/leizu/zh-hans/intake/',
      viewport: 'mobile',
      locale: 'zh-CN',
      waitFor: '#intake-form',
      validate: async (page, check) => {
        check('Simplified Chinese document language is precise',
          await page.locator('html').getAttribute('lang') === 'zh-Hans');
        check('Translated intake summary is visible',
          await page.locator('.audit45-localized-summary[lang="zh-Hans"]').isVisible());
        check('English contract source has an explicit language boundary',
          await page.locator('main[lang="en"][dir="ltr"]').count() === 1);
        check('Preferred language posts with the localized form',
          await page.locator('input[name="preferred_language"]').inputValue() === 'zh-Hans');
        check('High-stakes translation review state remains declared',
          await page.locator('meta[name="translation-status"]').getAttribute('content')
            === 'draft-bilingual-review-required');
      },
    },
    {
      id: 'polymythcal-fr-desktop',
      route: '/polymythseminars/fr/',
      viewport: 'desktop',
      locale: 'fr-CA',
      waitFor: '.pm-event-card',
      validate: async (page, check) => {
        const root = await page.locator('html').evaluate(node => ({
          lang: node.lang,
          dir: node.dir,
          pending: node.classList.contains('pm-language-pending'),
        }));
        check('French calendar language state is precise',
          root.lang === 'fr-CA' && root.dir === 'ltr' && !root.pending, root);
        const links = await page.locator('.pm-event-title a').evaluateAll(nodes =>
          nodes.slice(0, 8).map(node => node.getAttribute('href')));
        check('French calendar cards use French event routes',
          links.length > 0 && links.every(href =>
            /^\/polymythseminars\/fr\/events\//.test(href || '')), links);
        check('English language switch uses a dedicated route',
          new URL(await page.locator('#pmLanguageLink').getAttribute('href'), page.url()).pathname
            === '/polymythseminars/');
        const search = page.locator('#pmSearch');
        if (await search.count()) {
          await search.fill('Toronto');
          await page.waitForTimeout(250);
          check('Calendar search remains interactive',
            await page.locator('.pm-event-card:not([hidden])').count() > 0);
          await search.fill('');
        } else {
          check('Calendar search remains interactive', false, '#pmSearch is absent');
        }
      },
    },
    {
      id: 'polymythcal-writing-fr-mobile',
      route: '/writingclub/fr/',
      viewport: 'mobile',
      locale: 'fr-CA',
      waitFor: '.pm-event-card',
      validate: async (page, check) => {
        const links = await page.locator('.pm-event-title a').evaluateAll(nodes =>
          nodes.slice(0, 8).map(node => node.getAttribute('href')));
        check('Focused calendar uses French event routes',
          links.length > 0 && links.every(href =>
            /^\/polymythseminars\/fr\/events\//.test(href || '')), links);
        check('Focused calendar returns to the French main calendar',
          await page.locator('a[href="/polymythseminars/fr/"]').count() > 0);
      },
    },
    {
      id: 'polymythcal-fr-event-mobile',
      route: frenchEventRoute,
      viewport: 'mobile',
      locale: 'fr-CA',
      waitFor: 'main',
      validate: async (page, check) => {
        check('A generated French event route exists', Boolean(frenchEventRoute), frenchEventRoute);
        check('Organizer title declares its source language',
          await page.locator('h1[lang]').count() === 1);
        check('Correction action remains in the French funnel',
          await page.locator('a[href^="/polymythseminars/fr/correct/"]').count() > 0);
        check('Reciprocal English alternate remains declared',
          await page.locator('link[rel="alternate"][hreflang="en-CA"]').count() === 1);
      },
    },
    {
      id: 'polymythcal-fr-submit-mobile',
      route: '/polymythseminars/fr/submit/',
      viewport: 'mobile',
      locale: 'fr-CA',
      waitFor: 'form',
      validate: async (page, check) => {
        check('French interface language posts with the form',
          await page.locator('input[name="interface_language"]').inputValue() === 'fr-CA');
        check('Submission success action remains in French',
          await page.locator('form').getAttribute('action') === '/polymythseminars/fr/thanks/');
        check('Required form controls retain labels',
          await page.locator('input[required], textarea[required], select[required]')
            .evaluateAll(nodes => nodes.every(node => Boolean(node.labels && node.labels.length))));
      },
    },
    {
      id: 'saul-fa-mobile',
      route: '/saul/fa/',
      viewport: 'mobile',
      locale: 'fa-IR',
      waitFor: '.audit45-saul-archive-hero[data-locale="fa"]',
      validate: async (page, check) => {
        check('Persian archive hero remains visible',
          await page.locator('.audit45-saul-archive-hero[data-locale="fa"]').isVisible());
        check('Application-only English spectrum remains hidden',
          !(await page.locator('.cv-spectrum').isVisible()));
        check('Career archive remains rendered',
          await page.locator('#careerArchive').isVisible());
        check('English application boundary remains explicit',
          await page.locator('.audit45-saul-archive-hero[data-locale="fa"] a[lang="en"]').count()
            === 1);
      },
    },
    {
      id: 'teacherresources-language-filter-desktop',
      route: '/teacherresources/',
      viewport: 'desktop',
      locale: 'en-CA',
      waitFor: '#result-count',
      validate: async (page, check) => {
        await page.locator('#filter-toggle').click();
        const french = page.locator(
          '#language-chips [data-filter-type="language"][data-filter-value="fr-CA"]',
        );
        await french.waitFor({ state: 'visible' });
        await french.click();
        await page.waitForFunction(() =>
          new URLSearchParams(location.search).get('language') === 'fr-CA');
        const languages = await page.locator('.entry').evaluateAll(nodes =>
          nodes.filter(node => !node.hidden).map(node => node.dataset.language || ''));
        check('Source-language filtering shows compatible resources',
          languages.length > 0
            && languages.every(value => value.split(',').includes('fr-CA')),
          languages.slice(0, 12));
        check('Source-language filtering is shareable',
          page.url().includes('language=fr-CA'), page.url());
        await page.locator('#clear').click();
        check('Filter reset clears language URL state',
          !page.url().includes('language='), page.url());
      },
    },
    {
      id: 'bb-why-zh-mobile',
      route: '/bb/why/zh/',
      viewport: 'mobile',
      locale: 'zh-CN',
      waitFor: 'main',
      validate: async (page, check) => {
        check('BB essay exposes a precise Simplified Chinese root',
          await page.locator('html').getAttribute('lang') === 'zh-Hans');
        check('Translated skip link remains present',
          await page.locator('.skip-link').innerText() === '跳到主要内容');
        const references = await page.locator('.ref').count();
        const englishReferences = await page.locator('.ref[lang="en"]').count();
        check('English references retain source-language boundaries',
          references >= 20 && references === englishReferences,
          `${englishReferences}/${references}`);
        check('BB page remains an explanatory teacher-led surface',
          await page.locator('main').count() === 1);
      },
    },
    {
      id: 'methodologylist-search-desktop',
      route: '/polymyth/methodologylist/',
      viewport: 'desktop',
      locale: 'en-CA',
      waitFor: '#entries .entry',
      settleMs: 500,
      validate: async (page, check) => {
        const initial = await page.locator('#entries .entry').count();
        check('Methodology entries render from the embedded dataset', initial > 0, initial);
        await page.locator('#search').fill('anti-yapping');
        await page.waitForTimeout(300);
        const filtered = await page.locator('#entries .entry').count();
        check('Methodology search narrows the rendered entry set',
          filtered > 0 && filtered < initial, `${filtered}/${initial}`);
        await page.locator('#search').fill('');
        await page.waitForTimeout(300);
        check('Methodology search reset restores the entry set',
          await page.locator('#entries .entry').count() === initial, initial);
      },
    },
    {
      id: 'campaigncodex-search-mobile',
      route: '/polymyth/campaigncodex/',
      viewport: 'mobile',
      locale: 'en-CA',
      waitFor: '#entries .entry',
      settleMs: 500,
      validate: async (page, check) => {
        const initial = await page.locator('#entries .entry').count();
        check('Campaign codex entries render from the embedded dataset', initial > 0, initial);
        await page.locator('#search').fill('cmp-001 overview');
        await page.waitForTimeout(300);
        const filtered = await page.locator('#entries .entry').count();
        check('Campaign codex search narrows the rendered entry set',
          filtered > 0 && filtered < initial, `${filtered}/${initial}`);
        check('Campaign codex remains an archive rather than a session runner',
          await page.locator('body').getAttribute('data-session-runner') !== 'true');
      },
    },
  ];
  return cachedScenarios;
}

function mime(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.ics': 'text/calendar; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolvePublic(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://audit48.local').pathname);
  } catch {
    return null;
  }
  const requested = path.resolve(PUBLIC, pathname.replace(/^\/+/, ''));
  if (requested !== PUBLIC && !requested.startsWith(PUBLIC + path.sep)) return null;
  try {
    const stat = fs.statSync(requested);
    if (stat.isDirectory()) return path.join(requested, 'index.html');
    if (stat.isFile()) return requested;
  } catch {
    const index = path.join(requested, 'index.html');
    if (fs.existsSync(index) && fs.statSync(index).isFile()) return index;
  }
  return null;
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const target = resolvePublic(request.url || '/');
    if (!target || !fs.existsSync(target)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mime(target),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(target).pipe(response);
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

function releaseMetadata() {
  const manifest = JSON.parse(fs.readFileSync(RELEASE_MANIFEST, 'utf8'));
  const playwrightPackage = JSON.parse(fs.readFileSync(PLAYWRIGHT_PACKAGE, 'utf8'));
  return {
    release_id: manifest.release_id,
    generated_at: manifest.generated_at,
    playwright_version: playwrightPackage.version,
  };
}

function portableExecutablePath(executablePath) {
  if (!executablePath) return '';
  const configuredRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (configuredRoot) {
    const relative = path.relative(path.resolve(configuredRoot), path.resolve(executablePath));
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return `$PLAYWRIGHT_BROWSERS_PATH/${relative.split(path.sep).join('/')}`;
    }
  }
  const segments = path.resolve(executablePath).split(path.sep).filter(Boolean);
  const cacheIndex = segments.lastIndexOf('ms-playwright');
  if (cacheIndex >= 0 && cacheIndex + 1 < segments.length) {
    return `$PLAYWRIGHT_DEFAULT_CACHE/${segments.slice(cacheIndex + 1).join('/')}`;
  }
  return `$PLAYWRIGHT_BROWSER_CACHE/${path.basename(path.dirname(executablePath))}/`
    + path.basename(executablePath);
}

function browserAvailability(browser) {
  let executablePath = '';
  let lookupError = '';
  try {
    executablePath = browser.browserType.executablePath();
  } catch (error) {
    lookupError = String(error && error.message || error);
  }
  let installed = false;
  let executable = false;
  if (executablePath) {
    installed = fs.existsSync(executablePath);
    if (installed) {
      try {
        fs.accessSync(executablePath, fs.constants.X_OK);
        executable = true;
      } catch {}
    }
  }
  return {
    name: browser.name,
    installed,
    executable,
    executable_path: portableExecutablePath(executablePath),
    lookup_error: lookupError ? 'playwright-executable-lookup-failed' : '',
  };
}

function blockedReason(args) {
  const entry = args.find(arg => arg.startsWith('--blocked-reason='));
  return entry ? entry.slice('--blocked-reason='.length).trim() : '';
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rendered = JSON.stringify(value, null, 2) + '\n';
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== rendered) {
    fs.writeFileSync(file, rendered);
  }
  if (process.env.SS_REPORT_OUTPUT_MTIME) {
    const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
    if (Number.isNaN(stamp.getTime())) {
      throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp.');
    }
    fs.utimesSync(file, stamp, stamp);
  }
}

function preflight(args) {
  const meta = releaseMetadata();
  const availability = ENGINES.map(browserAvailability);
  const reason = blockedReason(args);
  const ready = availability.every(item => item.installed && item.executable);
  const report = {
    schema: 'seminar-schools-audit48-cross-engine-preflight-v1',
    ...meta,
    status: ready ? 'ready' : 'incomplete',
    execution_status: reason ? 'blocked' : 'pending',
    execution_blocker: reason,
    platform: process.platform,
    architecture: process.arch,
    browser_storage: process.env.PLAYWRIGHT_BROWSERS_PATH
      ? '$PLAYWRIGHT_BROWSERS_PATH'
      : '$PLAYWRIGHT_DEFAULT_CACHE',
    source_program: 'scripts/audit48-cross-engine-browser.js',
    source_program_sha256: PROGRAM_SHA256,
    engines: availability,
    scenarios: scenarios().map(item => ({
      id: item.id,
      route: item.route,
      viewport: item.viewport,
      dimensions: VIEWPORTS[item.viewport],
      locale: item.locale,
    })),
    scenario_count: scenarios().length,
    intended_engine_scenario_count: ENGINES.length * scenarios().length,
    external_requests: 'blocked-during-execution',
    claims: {
      runtime_checks_executed: 0,
      runtime_pass_claimed: false,
    },
    limitations: [
      'A preflight proves browser-program readiness and binary availability only.',
      'Playwright Firefox is a patched recent Firefox build rather than branded Firefox.',
      'Playwright WebKit is derived from WebKit main and is not branded Safari.',
      'Linux WebKit execution remains supplemental to native macOS Safari validation.',
    ],
    references: [OFFICIAL_REFERENCE],
  };
  writeJson(PREFLIGHT_REPORT, report);
  console.log(
    `AUDIT 48 CROSS-ENGINE PREFLIGHT ${report.status.toUpperCase()} — `
    + `${availability.filter(item => item.installed && item.executable).length}/${availability.length} `
    + `matched executable files present; runtime evidence ${report.execution_status}.`,
  );
  return report;
}

function diagnostics(page, base) {
  const maximumRows = 50;
  const pageErrors = [];
  const consoleErrors = [];
  const localFailures = [];
  const append = (rows, value) => {
    if (rows.length < maximumRows) rows.push(value);
  };
  page.on('pageerror', error => append(pageErrors, String(error)));
  page.on('console', message => {
    if (message.type() === 'error') append(consoleErrors, message.text());
  });
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      append(localFailures, `${response.status()} ${response.url()}`);
    }
  });
  return { pageErrors, consoleErrors, localFailures };
}

async function auditScenario(engineName, browser, base, scenario, checks, metrics) {
  const viewport = VIEWPORTS[scenario.viewport];
  const context = await browser.newContext({
    viewport,
    locale: scenario.locale,
    timezoneId: 'America/Toronto',
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const diagnostic = diagnostics(page, base);
  const check = (name, passed, detail = '') => {
    checks.push({
      engine: engineName,
      scenario: scenario.id,
      name,
      passed: Boolean(passed),
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  };
  try {
    if (!scenario.route) {
      check('Scenario route resolves', false, 'Generated French event route is absent.');
      return;
    }
    const response = await page.goto(base + scenario.route, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    check('Route returns an HTTP success', Boolean(response && response.ok()),
      response ? String(response.status()) : 'no response');
    await page.locator(scenario.waitFor).first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(scenario.settleMs || 350);
    await scenario.validate(page, check);
    const values = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0;
      };
      const badEdges = [...document.querySelectorAll('body *')]
        .filter(element => {
          if (!visible(element)) return false;
          if (element.matches('[aria-hidden="true"], .gotcha, #indraLayer')) return false;
          if (element.closest('[aria-hidden="true"], .gotcha, #indraLayer')) return false;
          if (element.matches('.skip-link:not(:focus)')) return false;
          return true;
        })
        .map(element => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || '',
            className: typeof element.className === 'string'
              ? element.className.slice(0, 80)
              : '',
            left: Number(rect.left.toFixed(2)),
            right: Number(rect.right.toFixed(2)),
          };
        })
        .filter(item => item.left < -1 || item.right > innerWidth + 1)
        .slice(0, 8);
      const brokenLocalImages = [...document.images]
        .filter(image => image.src.startsWith(location.origin)
          && image.complete && image.naturalWidth === 0)
        .map(image => image.src)
        .slice(0, 8);
      return {
        language: document.documentElement.lang,
        direction: document.documentElement.dir
          || getComputedStyle(document.documentElement).direction,
        documentOverflow: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        visibleH1: [...document.querySelectorAll('h1')].filter(visible).length,
        mainCount: document.querySelectorAll('main').length,
        badEdges,
        brokenLocalImages,
        supportsGrid: CSS.supports('display', 'grid'),
        supportsCustomProperties: CSS.supports('--audit48-probe', '1'),
      };
    });
    metrics.push({ engine: engineName, scenario: scenario.id, viewport, ...values });
    check('Document has no horizontal overflow', values.documentOverflow <= 1,
      values.documentOverflow);
    check('Visible elements remain inside the viewport', values.badEdges.length === 0,
      values.badEdges);
    check('Exactly one visible H1 remains', values.visibleH1 === 1, values.visibleH1);
    check('Exactly one main landmark remains', values.mainCount === 1, values.mainCount);
    check('Local images load successfully', values.brokenLocalImages.length === 0,
      values.brokenLocalImages);
    check('Required CSS primitives remain available',
      values.supportsGrid && values.supportsCustomProperties, values);
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({
      tag: document.activeElement && document.activeElement.tagName,
      id: document.activeElement && document.activeElement.id,
      body: document.activeElement === document.body,
    }));
    check('Keyboard focus enters the document', !focus.body && focus.tag !== 'HTML', focus);
    check('Page emits no uncaught exceptions', diagnostic.pageErrors.length === 0,
      diagnostic.pageErrors);
    check('Page emits no console errors', diagnostic.consoleErrors.length === 0,
      diagnostic.consoleErrors);
    check('Local requests avoid failed responses', diagnostic.localFailures.length === 0,
      diagnostic.localFailures);
    const screenshot = path.join(SCREENSHOTS, engineName, `${scenario.id}.png`);
    fs.mkdirSync(path.dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot, fullPage: false });
  } catch (error) {
    check('Scenario completes without harness exception', false,
      String(error && error.stack || error));
  } finally {
    await context.close();
  }
}

async function execute(args) {
  const readiness = preflight(args);
  if (readiness.execution_status === 'blocked') {
    throw new Error(`Browser execution is blocked: ${readiness.execution_blocker}`);
  }
  if (readiness.status !== 'ready') {
    const missing = readiness.engines.filter(item => !item.installed || !item.executable)
      .map(item => item.name);
    throw new Error(`Browser execution requires installed Playwright engines: ${missing.join(', ')}`);
  }
  if (!fs.existsSync(PUBLIC)) throw new Error('public/ is missing; run the canonical build first.');
  fs.rmSync(SCREENSHOTS, { recursive: true, force: true });
  const server = await startServer();
  const checks = [];
  const metrics = [];
  const engineResults = [];
  try {
    for (const engine of ENGINES) {
      const browser = await engine.browserType.launch({ headless: true });
      const version = browser.version();
      try {
        for (const scenario of scenarios()) {
          await auditScenario(engine.name, browser, server.base, scenario, checks, metrics);
        }
      } finally {
        await browser.close();
      }
      const engineChecks = checks.filter(item => item.engine === engine.name);
      engineResults.push({
        name: engine.name,
        version,
        status: engineChecks.every(item => item.passed) ? 'passed' : 'failed',
        checks_total: engineChecks.length,
        checks_passed: engineChecks.filter(item => item.passed).length,
        checks_failed: engineChecks.filter(item => !item.passed).length,
      });
    }
  } finally {
    await server.close();
  }
  const screenshots = [];
  for (const engine of ENGINES) {
    const directory = path.join(SCREENSHOTS, engine.name);
    if (!fs.existsSync(directory)) continue;
    for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.png')).sort()) {
      const absolute = path.join(directory, file);
      screenshots.push({
        file: path.relative(OUT, absolute).replaceAll(path.sep, '/'),
        bytes: fs.statSync(absolute).size,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),
      });
    }
  }
  const failed = checks.filter(item => !item.passed);
  const meta = releaseMetadata();
  const report = {
    schema: 'seminar-schools-audit48-cross-engine-browser-v1',
    ...meta,
    status: failed.length ? 'failed' : 'passed',
    source_program: 'scripts/audit48-cross-engine-browser.js',
    source_program_sha256: PROGRAM_SHA256,
    official_reference: OFFICIAL_REFERENCE,
    engine_results: engineResults,
    scenario_count: scenarios().length,
    engine_scenario_count: ENGINES.length * scenarios().length,
    checks_total: checks.length,
    checks_passed: checks.length - failed.length,
    checks_failed: failed.length,
    external_requests: 'blocked',
    checks,
    metrics,
    screenshots,
    limitations: [
      'Playwright Firefox is a patched recent Firefox build rather than branded Firefox.',
      'Playwright WebKit is derived from WebKit main and is not branded Safari.',
      'Linux WebKit execution remains supplemental to native macOS Safari validation.',
    ],
  };
  writeJson(EXECUTION_REPORT, report);
  if (failed.length) {
    console.error(
      `AUDIT 48 CROSS-ENGINE FAILED — ${failed.length}/${checks.length} checks failed.`,
    );
    for (const item of failed) {
      console.error(`- ${item.engine}/${item.scenario}/${item.name}: ${item.detail}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `AUDIT 48 CROSS-ENGINE PASSED — ${checks.length}/${checks.length} checks, `
    + `${screenshots.length} screenshots, ${engineResults.length} browser engines.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const executeRequested = args.includes('--execute');
  const preflightRequested = args.includes('--preflight');
  if (executeRequested === preflightRequested) {
    throw new Error('Choose exactly one mode: --preflight or --execute.');
  }
  if (executeRequested) {
    await execute(args);
    return;
  }
  preflight(args);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
