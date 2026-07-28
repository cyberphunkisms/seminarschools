#!/usr/bin/env node
'use strict';

/**
 * Fresh Chromium coverage for Audit 45's translated routes and language
 * boundaries. External requests are blocked deliberately so the audit also
 * proves that local/native font fallbacks keep every tested layout usable.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'data', 'audit45-browser');
const SCREENSHOTS = path.join(OUT, 'screenshots');
const REPORT = path.join(OUT, 'translation-browser-audit.json');
const AUDIT45_RELEASE_ID = '2026-07-25-site-audit45-full-translation-localization-final';
const AUDIT46_RELEASE_ID = '2026-07-26-site-audit46-technical-efficiency-rollover-final';
const AUDIT47_RELEASE_ID = '2026-07-26-site-audit47-technical-efficiency-continuity-final';
const AUDIT48_RELEASE_ID = '2026-07-26-site-audit48-external-validation-interoperability-final';
const AUDIT49_RELEASE_ID = '2026-07-26-site-audit49-technical-efficiency-resilience-final';
const SUPPORTED_RELEASE_IDS = new Set([
  AUDIT45_RELEASE_ID, AUDIT46_RELEASE_ID, AUDIT47_RELEASE_ID, AUDIT48_RELEASE_ID,
  AUDIT49_RELEASE_ID,
]);
const PROGRAM_SHA256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(__filename))
  .digest('hex');
const CHROME_EXECUTABLE = process.env.CHROME_EXECUTABLE || chromium.executablePath();
const checks = [];
const metrics = [];

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail: String(detail ?? '') });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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
    pathname = decodeURIComponent(new URL(requestUrl, 'http://audit45.local').pathname);
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
  const address = server.address();
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

async function makeContext(browser, base, viewport, locale = 'en-CA') {
  const context = await browser.newContext({
    viewport,
    locale,
    timezoneId: 'America/Toronto',
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await context.addInitScript(() => {
    window.__audit45Cls = 0;
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__audit45Cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}
  });
  await context.route('**/*', route => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith(base)) return route.continue();
    return route.abort();
  });
  return context;
}

function diagnostics(page, base) {
  const pageErrors = [];
  const localFailures = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      localFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  return { pageErrors, localFailures };
}

async function health(page, label, diagnostic) {
  await page.waitForTimeout(450);
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
          className: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
        };
      })
      .filter(item => item.left < -1 || item.right > innerWidth + 1)
      .slice(0, 8);
    return {
      cls: Number((window.__audit45Cls || 0).toFixed(4)),
      documentOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
      visibleH1: [...document.querySelectorAll('h1')].filter(visible).length,
      badEdges,
      language: document.documentElement.lang,
      direction: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
    };
  });
  metrics.push({ label, ...values });
  check(`${label}: CLS is at or below 0.1`, values.cls <= 0.1, values.cls);
  check(`${label}: document has no horizontal overflow`, values.documentOverflow <= 1, values.documentOverflow);
  check(`${label}: visible elements stay inside viewport`, values.badEdges.length === 0, JSON.stringify(values.badEdges));
  check(`${label}: exactly one visible H1`, values.visibleH1 === 1, values.visibleH1);
  check(`${label}: no page exceptions`, diagnostic.pageErrors.length === 0, JSON.stringify(diagnostic.pageErrors));
  check(`${label}: no failed local responses`, diagnostic.localFailures.length === 0, JSON.stringify(diagnostic.localFailures));
  return values;
}

async function auditPage(browser, base, spec) {
  const context = await makeContext(
    browser,
    base,
    spec.viewport || { width: 1440, height: 1000 },
    spec.locale,
  );
  const page = await context.newPage();
  const diagnostic = diagnostics(page, base);
  const response = await page.goto(base + spec.route, { waitUntil: 'domcontentloaded' });
  check(`${spec.label}: HTTP success`, Boolean(response && response.ok()), response && response.status());
  if (spec.waitFor) await page.locator(spec.waitFor).first().waitFor({ state: 'visible', timeout: 30_000 });
  if (spec.run) await spec.run(page, context);
  if (spec.screenshot) {
    await page.screenshot({ path: path.join(SCREENSHOTS, spec.screenshot), fullPage: false });
  }
  await health(page, spec.label, diagnostic);
  await context.close();
}

function firstFrenchEventRoute() {
  const root = path.join(PUBLIC, 'polymythseminars', 'fr', 'events');
  const slug = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'index.html')))
    .map(entry => entry.name)
    .sort()[0];
  if (!slug) throw new Error('No generated French Polymythcal event page is available.');
  return `/polymythseminars/fr/events/${slug}/`;
}

async function run() {
  if (!fs.existsSync(PUBLIC)) throw new Error('public/ is missing; run the canonical build first.');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
  check(
    'release manifest retains the Audit 45 translation browser scope',
    SUPPORTED_RELEASE_IDS.has(manifest.release_id),
    manifest.release_id,
  );
  fs.rmSync(SCREENSHOTS, { recursive: true, force: true });
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const frenchEventRoute = firstFrenchEventRoute();
  try {
    await auditPage(browser, server.base, {
      label: 'Leizu French home desktop',
      route: '/leizu/fr/',
      waitFor: 'main',
      screenshot: 'leizu-fr-desktop.png',
      locale: 'fr-CA',
      run: async (page, context) => {
        const root = await page.locator('html').evaluate(node => ({
          lang: node.lang,
          dir: node.dir,
          pending: node.classList.contains('language-pending'),
          dataLang: node.dataset.lang,
        }));
        check('Leizu French home: correct root language', root.lang === 'fr' && root.dir === 'ltr', JSON.stringify(root));
        check('Leizu French home: no language-pending flash state', !root.pending, JSON.stringify(root));
        check('Leizu French home: runtime state is French', root.dataLang === 'fr', JSON.stringify(root));
        const switchPage = await context.newPage();
        await switchPage.goto(page.url(), { waitUntil: 'domcontentloaded' });
        await Promise.all([
          switchPage.waitForURL(url => url.pathname === '/leizu/fa/'),
          switchPage.locator('[data-lang-set="fa"]').first().click(),
        ]);
        check(
          'Leizu French home: Persian switch uses a dedicated route',
          new URL(switchPage.url()).pathname === '/leizu/fa/',
          switchPage.url(),
        );
        await switchPage.close();
        check(
          'Leizu French home: intake link remains in French funnel',
          await page.locator('a[href^="/leizu/fr/intake/"]').count() > 0,
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Leizu Persian home mobile',
      route: '/leizu/fa/',
      waitFor: 'main',
      screenshot: 'leizu-fa-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'fa-IR',
      run: async page => {
        const root = await page.locator('html').evaluate(node => ({
          lang: node.lang,
          dir: node.dir,
          pending: node.classList.contains('language-pending'),
          dataLang: node.dataset.lang,
        }));
        check('Leizu Persian home: correct RTL root', root.lang === 'fa' && root.dir === 'rtl', JSON.stringify(root));
        check('Leizu Persian home: no language-pending flash state', !root.pending, JSON.stringify(root));
        check('Leizu Persian home: runtime state is Persian', root.dataLang === 'fa', JSON.stringify(root));
        check(
          'Leizu Persian home: intake link remains in Persian funnel',
          await page.locator('a[href^="/leizu/fa/intake/"]').count() > 0,
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Leizu Simplified Chinese intake mobile',
      route: '/leizu/zh-hans/intake/',
      waitFor: '#intake-form',
      screenshot: 'leizu-zh-hans-intake-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      run: async page => {
        check(
          'Leizu intake: translated reference summary is visible',
          await page.locator('.audit45-localized-summary[lang="zh-Hans"]').isVisible(),
        );
        check(
          'Leizu intake: English contract source has an explicit boundary',
          await page.locator('main[lang="en"][dir="ltr"]').count() === 1,
        );
        check(
          'Leizu intake: preferred language posts with the form',
          await page.locator('input[name="preferred_language"]').inputValue() === 'zh-Hans',
        );
        check(
          'Leizu intake: form action stays on dedicated localized route',
          (await page.locator('#intake-form').getAttribute('action') || '').startsWith('/leizu/zh-hans/intake/'),
        );
        check(
          'Leizu intake: bilingual-review status is declared',
          await page.locator('meta[name="translation-status"]').getAttribute('content')
            === 'draft-bilingual-review-required',
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Polymythcal French home desktop',
      route: '/polymythseminars/fr/',
      waitFor: '.pm-event-card',
      screenshot: 'polymythcal-fr-desktop.png',
      locale: 'fr-CA',
      run: async page => {
        const root = await page.locator('html').evaluate(node => ({
          lang: node.lang,
          dir: node.dir,
          pending: node.classList.contains('pm-language-pending'),
        }));
        check('Polymythcal French: correct root language', root.lang === 'fr-CA' && root.dir === 'ltr', JSON.stringify(root));
        check('Polymythcal French: no pending-language class', !root.pending, JSON.stringify(root));
        check(
          'Polymythcal French: English switch is a dedicated route',
          new URL(await page.locator('#pmLanguageLink').getAttribute('href'), page.url()).pathname
            === '/polymythseminars/',
        );
        const firstEvent = await page.locator('.pm-event-title a').first().getAttribute('href');
        check('Polymythcal French: event cards open French utility pages', /^\/polymythseminars\/fr\/events\//.test(firstEvent || ''), firstEvent);
        for (const [label, route] of [
          ['submit', '/polymythseminars/fr/submit/'],
          ['correct', '/polymythseminars/fr/correct/'],
          ['subscribe', '/polymythseminars/fr/subscribe/'],
        ]) {
          check(
            `Polymythcal French: ${label} flow stays French`,
            await page.locator(`a[href="${route}"]`).count() > 0,
            route,
          );
        }
        const state = await page.evaluate(() => ({
          language: localStorage.getItem('polymythcal.lang.v1'),
          legacyKeys: Object.keys(localStorage).filter(key => /polymythcal.*lang/i.test(key)
            && key !== 'polymythcal.lang.v1'),
        }));
        check('Polymythcal French: one language preference key', state.language === 'fr' && state.legacyKeys.length === 0, JSON.stringify(state));
        check(
          'Polymythcal French: no bilingual all-listings label',
          !(await page.locator('body').innerText()).includes('All listings ·'),
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Polymythcal French focused calendar mobile',
      route: '/writingclub/fr/',
      waitFor: '.pm-event-card',
      screenshot: 'polymythcal-writing-fr-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'fr-CA',
      run: async page => {
        const links = await page.locator('.pm-event-title a').evaluateAll(nodes =>
          nodes.slice(0, 8).map(node => node.getAttribute('href')),
        );
        check(
          'Polymythcal focused French: listed events use French routes',
          links.length > 0 && links.every(href => /^\/polymythseminars\/fr\/events\//.test(href || '')),
          JSON.stringify(links),
        );
        check(
          'Polymythcal focused French: main calendar link stays French',
          await page.locator('a[href="/polymythseminars/fr/"]').count() > 0,
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Polymythcal French event mobile',
      route: frenchEventRoute,
      waitFor: 'main',
      screenshot: 'polymythcal-fr-event-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'fr-CA',
      run: async page => {
        check(
          'Polymythcal event: organizer title declares its source language',
          await page.locator('h1[lang]').count() === 1,
        );
        check(
          'Polymythcal event: original wording policy is visible',
          /texte|libellé|source|original/i.test(await page.locator('body').innerText()),
        );
        check(
          'Polymythcal event: correction route stays French',
          await page.locator('a[href^="/polymythseminars/fr/correct/"]').count() > 0,
        );
        check(
          'Polymythcal event: reciprocal English alternate exists',
          await page.locator('link[rel="alternate"][hreflang="en-CA"]').count() === 1,
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Polymythcal French submission form mobile',
      route: '/polymythseminars/fr/submit/',
      waitFor: 'form',
      screenshot: 'polymythcal-fr-submit-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'fr-CA',
      run: async page => {
        check(
          'Polymythcal submit: French interface language posts with form',
          await page.locator('input[name="interface_language"]').inputValue() === 'fr-CA',
        );
        check(
          'Polymythcal submit: success action stays French',
          await page.locator('form').getAttribute('action') === '/polymythseminars/fr/thanks/',
        );
        check(
          'Polymythcal submit: all required fields retain labels',
          await page.locator('input[required], textarea[required], select[required]').evaluateAll(nodes =>
            nodes.every(node => Boolean(node.labels && node.labels.length)),
          ),
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Saul Persian archive mobile',
      route: '/saul/fa/',
      waitFor: '.audit45-saul-archive-hero[data-locale="fa"]',
      screenshot: 'saul-fa-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'fa-IR',
      run: async page => {
        check(
          'Saul Persian: localized archive hero is visible',
          await page.locator('.audit45-saul-archive-hero[data-locale="fa"]').isVisible(),
        );
        check(
          'Saul Persian: English application spectrum is hidden',
          !(await page.locator('.cv-spectrum').isVisible()),
        );
        check(
          'Saul Persian: career archive remains rendered',
          await page.locator('#careerArchive').isVisible(),
        );
        check(
          'Saul Persian: English application CV boundary is explicit',
          await page.locator('.audit45-saul-archive-hero[data-locale="fa"] a[lang="en"]').count() === 1,
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Saul Traditional Chinese archive desktop',
      route: '/saul/zh-hant/',
      waitFor: '.audit45-saul-archive-hero[data-locale="zh"]',
      screenshot: 'saul-zh-hant-desktop.png',
      locale: 'zh-TW',
      run: async page => {
        check(
          'Saul Traditional Chinese: localized archive hero is visible',
          await page.locator('.audit45-saul-archive-hero[data-locale="zh"]').isVisible(),
        );
        check(
          'Saul Traditional Chinese: document language tag is precise',
          await page.locator('html').getAttribute('lang') === 'zh-Hant',
        );
        check(
          'Saul Traditional Chinese: route language state is precise',
          await page.locator('html').getAttribute('data-saul-archive-language') === 'zh',
        );
      },
    });
    await auditPage(browser, server.base, {
      label: 'Teacher Resources source-language finder desktop',
      route: '/teacherresources/',
      waitFor: '#result-count',
      screenshot: 'teacherresources-language-filter.png',
      run: async page => {
        await page.locator('#filter-toggle').click();
        const french = page.locator('#language-chips [data-filter-type="language"][data-filter-value="fr-CA"]');
        await french.waitFor({ state: 'visible' });
        check('Teacher Resources: French source-language chip is available', await french.count() === 1);
        await french.click();
        await page.waitForFunction(() => new URLSearchParams(location.search).get('language') === 'fr-CA');
        const visibleLanguages = await page.locator('.entry').evaluateAll(nodes =>
          nodes.filter(node => !node.hidden).map(node => node.dataset.language || ''),
        );
        check(
          'Teacher Resources: French filter only shows compatible resources',
          visibleLanguages.length > 0 && visibleLanguages.every(value => value.split(',').includes('fr-CA')),
          JSON.stringify(visibleLanguages.slice(0, 12)),
        );
        check('Teacher Resources: source-language filter is shareable', page.url().includes('language=fr-CA'), page.url());
        check(
          'Teacher Resources: filter announces a nonzero result count',
          !/^0\b/.test((await page.locator('#result-count').innerText()).trim()),
          await page.locator('#result-count').innerText(),
        );
        const reset = page.locator('#clear');
        await reset.click();
        check('Teacher Resources: reset clears language URL state', !page.url().includes('language='), page.url());
      },
    });
    await auditPage(browser, server.base, {
      label: 'BB Simplified Chinese Why essay mobile',
      route: '/bb/why/zh/',
      waitFor: 'main',
      screenshot: 'bb-why-zh-mobile.png',
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      run: async page => {
        check('BB Chinese: precise Simplified Chinese root', await page.locator('html').getAttribute('lang') === 'zh-Hans');
        check('BB Chinese: translated skip link is present', await page.locator('.skip-link').innerText() === '跳到主要内容');
        check('BB Chinese: references heading is translated', await page.locator('.references h2').innerText() === '参考文献');
        const refs = await page.locator('.ref').count();
        const englishRefs = await page.locator('.ref[lang="en"]').count();
        check('BB Chinese: English references have language boundaries', refs >= 20 && refs === englishRefs, `${englishRefs}/${refs}`);
        check(
          'BB Chinese: local return link is translated',
          await page.getByRole('link', { name: '← 返回', exact: true }).innerText() === '← 返回',
        );
      },
    });
  } finally {
    await browser.close();
    await server.close();
  }

  const screenshots = fs.readdirSync(SCREENSHOTS)
    .filter(file => file.endsWith('.png'))
    .sort()
    .map(file => ({
      file: `screenshots/${file}`,
      sha256: sha256(path.join(SCREENSHOTS, file)),
      bytes: fs.statSync(path.join(SCREENSHOTS, file)).size,
    }));
  const failed = checks.filter(item => !item.passed);
  const report = {
    schema: 'seminar-schools-audit45-translation-browser-v1',
    release_id: manifest.release_id,
    generated_at: manifest.generated_at,
    status: failed.length ? 'failed' : 'passed',
    browser: await chromium.launch({
      executablePath: CHROME_EXECUTABLE,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    }).then(async instance => {
      const version = instance.version();
      await instance.close();
      return version;
    }),
    external_requests: 'blocked',
    source_program: 'scripts/audit45-translation-browser.js',
    source_program_sha256: PROGRAM_SHA256,
    checks_total: checks.length,
    checks_passed: checks.length - failed.length,
    checks_failed: failed.length,
    checks,
    metrics,
    screenshots,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
  if (failed.length) {
    console.error(`AUDIT 45 CHROMIUM FAILED — ${failed.length}/${checks.length} checks failed.`);
    for (const item of failed) console.error(`- ${item.name}: ${item.detail}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `AUDIT 45 CHROMIUM PASSED — ${checks.length}/${checks.length} checks, `
    + `${screenshots.length} screenshots, ${metrics.length} route/viewport samples.`,
  );
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
