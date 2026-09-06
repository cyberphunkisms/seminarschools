#!/usr/bin/env node
'use strict';

/**
 * Standalone front-facing overlap and reflow verifier.
 *
 * Full gate:
 *   node scripts/verify-front-facing-overlap-browser.js
 *
 * Useful diagnostics:
 *   node scripts/verify-front-facing-overlap-browser.js --inventory-only
 *   node scripts/verify-front-facing-overlap-browser.js --families=about,teacher-index
 *   node scripts/verify-front-facing-overlap-browser.js --base-url=http://127.0.0.1:4173
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCROLL_FRACTIONS = Object.freeze([0, 0.10, 0.25, 0.50, 0.75, 0.90, 1]);
const MAX_REPORTED_FAILURES = 240;
const MAX_COLLISIONS_PER_PROBE = 24;
const MAX_REFLOW_FAILURES_PER_PROBE = 24;

function parseArgs(argv) {
  const options = {
    baseUrl: '',
    executablePath: '',
    contentRoot: fs.existsSync(path.join(ROOT, 'public')) ? path.join(ROOT, 'public') : ROOT,
    families: new Set(),
    scenarios: new Set(),
    inventoryOnly: false,
  };
  for (const argument of argv) {
    if (argument === '--inventory-only') options.inventoryOnly = true;
    else if (argument.startsWith('--base-url=')) {
      options.baseUrl = argument.slice('--base-url='.length).replace(/\/+$/, '');
    } else if (argument.startsWith('--executable-path=')) {
      options.executablePath = path.resolve(argument.slice('--executable-path='.length));
    } else if (argument.startsWith('--content-root=')) {
      options.contentRoot = path.resolve(ROOT, argument.slice('--content-root='.length));
    } else if (argument.startsWith('--families=')) {
      options.families = new Set(
        argument.slice('--families='.length).split(',').map(value => value.trim()).filter(Boolean),
      );
    } else if (argument.startsWith('--scenarios=')) {
      options.scenarios = new Set(
        argument.slice('--scenarios='.length).split(',').map(value => value.trim()).filter(Boolean),
      );
    } else if (argument === '--help' || argument === '-h') {
      console.log([
        'Usage: node scripts/verify-front-facing-overlap-browser.js [options]',
        '',
        '  --base-url=URL       Test an existing server instead of starting one.',
        '  --executable-path=P  Chromium binary (fallback: CHROME_EXECUTABLE, then Playwright).',
        '  --content-root=PATH  Static HTML root used for classification (default: public).',
        '  --families=A,B       Run named families only; inventory still covers every page.',
        '  --scenarios=A,B      Diagnostic: run named scenario labels only (default: exhaustive).',
        '  --inventory-only     Validate family/fixture coverage without launching Chromium.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

/*
 * Every deployed HTML file must match exactly one family. Generated
 * collections use stable representatives instead of rendering thousands of
 * identical templates. Localized fixtures are real localized routes, not an
 * English fixture with its lang attribute changed by the test.
 */
const FAMILIES = Object.freeze([
  { id: 'home', match: route => route === '/', fixtures: ['/'] },
  { id: 'not-found', match: route => route === '/404.html', fixtures: ['/404.html'] },
  {
    id: 'host-verification',
    match: route => route === '/google20234ae70106ee9d.html',
    fixtures: [],
    browser: false,
  },
  { id: 'site-map', match: route => route === '/sitemap/', fixtures: ['/sitemap/'] },
  { id: 'about', match: route => route === '/about/', fixtures: ['/about/'] },
  {
    id: 'project-prose',
    match: route => /^\/(?:agora|florilegium|nutrition|ohm-dome)\/$/.test(route),
    fixtures: ['/agora/', '/florilegium/', '/nutrition/', '/ohm-dome/'],
  },
  {
    id: 'marginalia',
    match: route => /^\/marginalia(?:\/[^/]+)?\/$/.test(route),
    // The obsolete example-review is deliberately not a release fixture.
    fixtures: ['/marginalia/'],
  },
  { id: 'reviews', match: route => route === '/reviews/', fixtures: ['/reviews/'] },
  { id: 'main-alias', match: route => route === '/main/', fixtures: ['/main/'] },
  {
    id: 'program-landing',
    match: route => /^\/(?:cfps|fellowships|humanities|lectures|philosophy|university|writingclub|writinggrads|writingjuniors|writingkids|writingteens)(?:\/fr)?\/$/.test(route),
    fixtures: ['/writingteens/', '/writingteens/fr/'],
  },
  { id: 'aa', match: route => /^\/aa(?:\/|$)/.test(route), fixtures: ['/aa/'] },
  { id: 'aitr', match: route => route === '/aitr/', fixtures: ['/aitr/'] },
  { id: 'bb', match: route => /^\/bb(?:\/|$)/.test(route), fixtures: ['/bb/'] },
  {
    id: 'bookwormcard',
    match: route => /^\/bookwormcard(?:\/|$)/.test(route),
    fixtures: ['/bookwormcard/'],
  },
  {
    id: 'campaigns',
    match: route => /^\/campaigns(?:\/|$)/.test(route),
    fixtures: ['/campaigns/thank-you-mam/'],
  },
  {
    id: 'leizu-home-locales',
    match: route => /^\/leizu\/(?:fr\/|fa\/|zh-hans\/|zh-hant\/)?$/.test(route),
    fixtures: ['/leizu/', '/leizu/fr/', '/leizu/fa/', '/leizu/zh-hans/'],
  },
  {
    id: 'leizu-auxiliary-locales',
    match: route => /^\/leizu\/(?:[^/]+|(?:fr|fa|zh-hans|zh-hant)\/[^/]+)\/$/.test(route)
      && !/^\/leizu\/(?:fr|fa|zh-hans|zh-hant)\/$/.test(route),
    fixtures: ['/leizu/teach/', '/leizu/fr/teach/', '/leizu/fa/teach/', '/leizu/zh-hans/teach/'],
  },
  {
    id: 'polymyth-methodology',
    match: route => /^\/polymyth\/methodologylist(?:\/|$)/.test(route),
    fixtures: ['/polymyth/methodologylist/', '/polymyth/methodologylist/analysis/'],
  },
  {
    id: 'polymyth-coherence',
    match: route => route === '/polymyth/coherence/',
    fixtures: ['/polymyth/coherence/'],
  },
  {
    id: 'polymyth-manuals',
    match: route => /^\/polymyth(?:\/|$)/.test(route)
      && !/^\/polymyth\/(?:methodologylist(?:\/|$)|coherence\/$)/.test(route),
    fixtures: ['/polymyth/'],
  },
  { id: 'polymythcal-alias', match: route => route === '/polymythcal/', fixtures: ['/polymythcal/'] },
  { id: 'polymythcommons', match: route => route === '/polymythcommons/', fixtures: ['/polymythcommons/'] },
  { id: 'polymythlib-home', match: route => route === '/polymythlib/', fixtures: ['/polymythlib/'] },
  {
    id: 'polymythlib-guides',
    match: route => /^\/polymythlib\/(?:book-backbone|collections|contribute|method)\/$/.test(route),
    fixtures: ['/polymythlib/method/'],
  },
  {
    id: 'polymythlib-record',
    match: route => /^\/polymythlib\/projects\/[^/]+\/$/.test(route),
    fixtures: ['/polymythlib/projects/PC-0001/'],
  },
  {
    id: 'polymythseminars-home-locales',
    match: route => /^\/polymythseminars\/(?:fr\/)?$/.test(route),
    fixtures: ['/polymythseminars/', '/polymythseminars/fr/'],
  },
  {
    id: 'polymythseminars-discovery-secondary',
    match: route => /^\/polymythseminars\/(?:fr\/)?(?:research|monitoring)\/$/.test(route),
    fixtures: [
      '/polymythseminars/research/',
      '/polymythseminars/monitoring/',
      '/polymythseminars/fr/research/',
      '/polymythseminars/fr/monitoring/',
    ],
  },
  {
    id: 'polymythseminars-forms',
    match: route => /^\/polymythseminars\/(?:fr\/)?(?:correct|submit|subscribe|thanks)\/$/.test(route),
    fixtures: ['/polymythseminars/submit/'],
  },
  {
    id: 'polymythseminars-event-en',
    match: route => /^\/polymythseminars\/events\/[^/]+\/$/.test(route),
    fixtures: ['/polymythseminars/events/0397c5dce167/'],
  },
  {
    id: 'polymythseminars-event-fr',
    match: route => /^\/polymythseminars\/fr\/events\/[^/]+\/$/.test(route),
    fixtures: ['/polymythseminars/fr/events/0397c5dce167/'],
  },
  {
    id: 'saul-home-locales',
    match: route => /^\/saul\/(?:fr\/|fa\/|zh-hans\/|zh-hant\/)?$/.test(route),
    fixtures: ['/saul/', '/saul/fr/', '/saul/fa/', '/saul/zh-hans/'],
  },
  {
    id: 'saul-tailored-cv',
    match: route => /^\/saul\/cv\/[^/]+\/$/.test(route),
    fixtures: ['/saul/cv/community/'],
  },
  {
    id: 'saul-portfolio',
    match: route => /^\/saul\/(?:hospitality|kitchen|performance|portfolio|teaching)(?:\/[^/]+)?\/$/.test(route),
    fixtures: ['/saul/portfolio/'],
  },
  { id: 'teacher-index', match: route => route === '/teacherresources/', fixtures: ['/teacherresources/'] },
  {
    id: 'teacher-subject',
    match: route => /^\/teacherresources\/[^/]+\/$/.test(route),
    fixtures: ['/teacherresources/ela/', '/teacherresources/ieltsrubric/'],
  },
  {
    id: 'teacher-collection',
    match: route => /^\/teacherresources\/[^/]+\/[^/]+\/$/.test(route),
    fixtures: ['/teacherresources/ela/ela-inst-esl/'],
  },
  {
    id: 'teacher-resource',
    match: route => /^\/teacherresources\/[^/]+\/[^/]+\/[^/]+\/$/.test(route),
    fixtures: ['/teacherresources/ela/ela-inst-esl/denote-92453e09/'],
  },
]);

const VIEWPORTS = Object.freeze([
  { label: 'w320-short', width: 320, height: 568 },
  { label: 'w390-short', width: 390, height: 667 },
  { label: 'w640-short', width: 640, height: 568 },
  { label: 'w768-short', width: 768, height: 667 },
  { label: 'w1024', width: 1024, height: 768 },
  { label: 'w1440', width: 1440, height: 900 },
  { label: 'w1801', width: 1801, height: 900 },
]);

/* Both text scales run at every required width. Anchor and focus traversal
 * runs once narrow and once wide rather than multiplying every named anchor
 * by all fourteen visual contexts. */
const SCENARIOS = Object.freeze(VIEWPORTS.flatMap(viewport => [
  {
    ...viewport,
    label: `${viewport.label}-normal-light-calm`,
    textScale: 1,
    theme: 'light',
    reducedMotion: 'no-preference',
    motionAttribute: 'calm',
    deep: viewport.width === 390,
  },
  {
    ...viewport,
    label: `${viewport.label}-max-dark-reduced`,
    textScale: 1.45,
    theme: 'dark',
    reducedMotion: 'reduce',
    motionAttribute: 'calm',
    deep: viewport.width === 1440,
  },
]));

const LANGUAGE_EXPECTATIONS = Object.freeze(new Map([
  ['/writingteens/fr/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/leizu/fr/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/leizu/fr/teach/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/leizu/fa/', { lang: /^fa(?:-|$)/i, dir: 'rtl' }],
  ['/leizu/fa/teach/', { lang: /^fa(?:-|$)/i, dir: 'rtl' }],
  ['/leizu/zh-hans/', { lang: /^zh(?:-|$)/i, dir: 'ltr' }],
  ['/leizu/zh-hans/teach/', { lang: /^zh(?:-|$)/i, dir: 'ltr' }],
  ['/polymythseminars/fr/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/polymythseminars/fr/research/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/polymythseminars/fr/monitoring/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/polymythseminars/fr/events/0397c5dce167/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/saul/fr/', { lang: /^fr(?:-|$)/i, dir: 'ltr' }],
  ['/saul/fa/', { lang: /^fa(?:-|$)/i, dir: 'rtl' }],
  ['/saul/zh-hans/', { lang: /^zh(?:-|$)/i, dir: 'ltr' }],
]));

function walkHtml(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walkHtml(full, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function routeForFile(contentRoot, file) {
  const relative = path.relative(contentRoot, file).replace(/\\/g, '/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -10)}`;
  return `/${relative}`;
}

function fileForRoute(contentRoot, route) {
  if (route === '/') return path.join(contentRoot, 'index.html');
  const relative = route.replace(/^\/+/, '');
  return path.join(contentRoot, route.endsWith('/') ? relative + 'index.html' : relative);
}

function validateInventory(options) {
  const failures = [];
  if (!fs.existsSync(options.contentRoot) || !fs.statSync(options.contentRoot).isDirectory()) {
    failures.push(`content root does not exist: ${options.contentRoot}`);
    return { failures, routes: [], counts: new Map() };
  }
  const routes = walkHtml(options.contentRoot).map(file => routeForFile(options.contentRoot, file)).sort();
  const counts = new Map(FAMILIES.map(family => [family.id, 0]));
  for (const route of routes) {
    const matches = FAMILIES.filter(family => family.match(route));
    if (matches.length === 0) failures.push(`unclassified public HTML route: ${route}`);
    else if (matches.length > 1) {
      failures.push(`multiply classified route ${route}: ${matches.map(family => family.id).join(', ')}`);
    } else {
      counts.set(matches[0].id, counts.get(matches[0].id) + 1);
    }
  }
  for (const family of FAMILIES) {
    if (!counts.get(family.id)) failures.push(`declared family has no public HTML routes: ${family.id}`);
    if (family.browser !== false && family.fixtures.length === 0) {
      failures.push(`browser family has no fixture: ${family.id}`);
    }
    for (const fixture of family.fixtures) {
      const file = fileForRoute(options.contentRoot, fixture);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        failures.push(`missing fixture for ${family.id}: ${fixture}`);
        continue;
      }
      const matches = FAMILIES.filter(candidate => candidate.match(fixture));
      if (matches.length !== 1 || matches[0].id !== family.id) {
        failures.push(`fixture ${fixture} is not uniquely classified as ${family.id}`);
      }
    }
  }
  const known = new Set(FAMILIES.map(family => family.id));
  for (const family of options.families) {
    if (!known.has(family)) failures.push(`unknown --families entry: ${family}`);
  }
  const knownScenarios = new Set(SCENARIOS.map(scenario => scenario.label));
  for (const scenario of options.scenarios) {
    if (!knownScenarios.has(scenario)) failures.push(`unknown --scenarios entry: ${scenario}`);
  }
  return { failures, routes, counts };
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
  })[extension] || 'application/octet-stream';
}

/* Redirect doorways still have a useful human-readable fallback, but their
 * zero-delay navigation makes it impossible to inspect that surface in a
 * deterministic browser gate. Freeze only pages that explicitly identify as
 * redirect fallbacks; canonical destination routes remain separate fixtures. */
function freezeRedirectFallbackHtml(html, sourceLabel) {
  if (!/<body\b[^>]*\bdata-route-type=["'](?:redirect|cv-redirect)["']/i.test(html)) return html;
  const withoutRefresh = html.replace(
    /<meta\b(?=[^>]*\bhttp-equiv=["']?refresh["']?)[^>]*>/gi,
    '',
  );
  const frozen = withoutRefresh.replace(
    /<script\b[^>]*>\s*(?:window\.)?location\.replace\(\s*["'][^"']+["'](?:\s*\+\s*location\.(?:search|hash))*\s*\);?\s*<\/script>/gi,
    '',
  );
  if (/<meta\b(?=[^>]*\bhttp-equiv=["']?refresh["']?)[^>]*>/i.test(frozen)
    || /<script\b[^>]*>\s*(?:window\.)?location\.replace\(/i.test(frozen)) {
    throw new Error(`Redirect fallback freeze incomplete for ${sourceLabel}`);
  }
  return frozen;
}

async function startStaticServer(contentRoot) {
  const server = http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    let relative = pathname.replace(/^\/+/, '');
    if (!relative || pathname.endsWith('/')) relative += 'index.html';
    const resolved = path.resolve(contentRoot, relative);
    if (resolved !== contentRoot && !resolved.startsWith(contentRoot + path.sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    let file = resolved;
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    let payload = fs.readFileSync(file);
    if (path.extname(file).toLowerCase() === '.html') {
      payload = Buffer.from(freezeRedirectFallbackHtml(payload.toString('utf8'), relative), 'utf8');
    }
    response.writeHead(200, {
      'content-type': contentType(file),
      'cache-control': 'no-store',
      'content-length': String(payload.length),
    });
    response.end(payload);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

/* This function must remain self-contained because Playwright serializes it
 * into the page rather than preserving Node closures. */
function installBrowserProbe() {
  'use strict';

  const BLOCK_SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', '[role="heading"]', 'summary',
    'p', 'li', 'dt', 'dd', 'figcaption', 'label', '.title', '.entry-title',
    '.grp-title', '.cat-title',
  ].join(',');
  const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
  const FLOW_SKIP = 'script,style,noscript,template,option,svg,canvas';
  const WORD_BREAK_SKIP = [
    'script', 'style', 'noscript', 'template', 'option', 'svg', 'canvas',
    'code', 'pre', 'kbd', 'samp', 'var',
    '.url', '.source-url', '.source-domain', '.slug', '.breadcrumbs', '.host',
    '[data-allow-word-break="true"]', '[contenteditable="true"]',
  ].join(',');

  function styleVisible(style) {
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.visibility !== 'collapse'
      && style.contentVisibility !== 'hidden'
      && Number.parseFloat(style.opacity || '1') > 0.001;
  }

  function hiddenByClosedDetails(element) {
    let current = element;
    while (current && current !== document.documentElement) {
      if (current.tagName === 'DETAILS' && !current.open) {
        if (current === element) {
          current = current.parentElement;
          continue;
        }
        const summary = [...current.children].find(child => child.tagName === 'SUMMARY');
        if (!summary || !summary.contains(element)) return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function elementVisible(element, requireViewport = true) {
    if (!element || !element.isConnected || hiddenByClosedDetails(element)) return false;
    if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (!styleVisible(getComputedStyle(current))) return false;
      current = current.parentElement;
    }
    const rects = [...element.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5);
    if (!rects.length) return false;
    return !requireViewport || rects.some(rect => rect.bottom > 0 && rect.right > 0
      && rect.top < innerHeight && rect.left < innerWidth);
  }

  function positionedAncestor(element) {
    let current = element && element.parentElement;
    while (current && current !== document.documentElement) {
      const position = getComputedStyle(current).position;
      if (position === 'fixed' || position === 'sticky') return current;
      current = current.parentElement;
    }
    return null;
  }

  function stableLabel(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const classes = [...element.classList].slice(0, 3).map(value => `.${CSS.escape(value)}`).join('');
    return `${element.tagName.toLowerCase()}${classes}`;
  }

  function clippedRect(rect) {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);
    if (right - left <= 0.5 || bottom - top <= 0.5) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function intersection(first, second) {
    const left = Math.max(first.left, second.left);
    const top = Math.max(first.top, second.top);
    const right = Math.min(first.right, second.right);
    const bottom = Math.min(first.bottom, second.bottom);
    if (right - left <= 1 || bottom - top <= 1) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function colorAlpha(color) {
    if (!color || color === 'transparent') return 0;
    const match = color.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return 1;
    const parts = match[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
    if (parts.length < 4) return 1;
    const alpha = Number.parseFloat(parts[3]);
    return Number.isFinite(alpha) ? alpha : 1;
  }

  let chromeCandidateCache = null;

  function discoverChromeCandidates() {
    return [...document.querySelectorAll('*')].filter(element => {
      const position = getComputedStyle(element).position;
      return (position === 'fixed' || position === 'sticky')
        && !positionedAncestor(element);
    });
  }

  function subtreeIntroducesChrome(root) {
    const elements = [];
    if (root && root.nodeType === Node.ELEMENT_NODE) elements.push(root);
    if (root && root.querySelectorAll) elements.push(...root.querySelectorAll('*'));
    return elements.some(element => {
      if (chromeCandidateCache && chromeCandidateCache.includes(element)) return false;
      const position = getComputedStyle(element).position;
      return (position === 'fixed' || position === 'sticky') && !positionedAncestor(element);
    });
  }

  const chromeCandidateObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        if ([...mutation.addedNodes].some(node => subtreeIntroducesChrome(node))) {
          chromeCandidateCache = null;
          return;
        }
        continue;
      }
      if (mutation.type !== 'attributes') continue;
      if (mutation.target === document.documentElement && mutation.attributeName === 'style') {
        continue;
      }
      if (subtreeIntroducesChrome(mutation.target)) {
        chromeCandidateCache = null;
        return;
      }
    }
  });
  chromeCandidateObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });

  function topLevelChrome() {
    if (!chromeCandidateCache) chromeCandidateCache = discoverChromeCandidates();
    return chromeCandidateCache.filter(element => {
      if (!element.isConnected) return false;
      const position = getComputedStyle(element).position;
      return (position === 'fixed' || position === 'sticky')
        && !positionedAncestor(element)
        && elementVisible(element, true);
    }).map(element => {
      const style = getComputedStyle(element);
      const rect = clippedRect(element.getBoundingClientRect());
      const surfaceAlpha = colorAlpha(style.backgroundColor);
      const paintsSurface = surfaceAlpha > 0.01
        || style.backgroundImage !== 'none'
        || Boolean(style.backdropFilter && style.backdropFilter !== 'none')
        || Boolean(style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none');
      return {
        element,
        label: stableLabel(element),
        position: style.position,
        rect,
        surfaceAlpha,
        paintsSurface,
      };
    }).filter(item => item.rect);
  }

  function rangeRects(textNode, clipToViewport = true) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rects = [...range.getClientRects()].map(rect => {
      if (clipToViewport) return clippedRect(rect);
      if (rect.width <= 0.5 || rect.height <= 0.5) return null;
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    }).filter(Boolean);
    range.detach();
    return rects;
  }

  function chromePaintFragments(chrome) {
    const fragments = [];
    if (chrome.paintsSurface) fragments.push({ rect: chrome.rect, kind: 'surface' });
    const walker = document.createTreeWalker(chrome.element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const owner = node.parentElement;
      if (!owner || !elementVisible(owner, true)) continue;
      for (const rect of rangeRects(node)) fragments.push({ rect, kind: 'text' });
    }
    for (const element of chrome.element.querySelectorAll('button,input,select,textarea,img,svg,canvas,video')) {
      if (!elementVisible(element, true)) continue;
      const rect = clippedRect(element.getBoundingClientRect());
      if (rect) fragments.push({ rect, kind: 'control' });
    }
    return fragments;
  }

  function visibleFlowText() {
    const roots = [...document.querySelectorAll('main,article,[role="main"]')];
    if (!roots.length) roots.push(document.body);
    const nodes = [];
    const seen = new Set();
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (seen.has(node) || !node.textContent.trim()) continue;
        seen.add(node);
        const owner = node.parentElement;
        if (!owner || owner.closest(FLOW_SKIP) || hiddenByClosedDetails(owner)) continue;
        if (owner.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
        if (positionedAncestor(owner) || !elementVisible(owner, true)) continue;
        for (const rect of rangeRects(node)) {
          nodes.push({ owner, rect, text: node.textContent.trim().slice(0, 90) });
        }
      }
    }
    return nodes;
  }

  function readerEntryContract() {
    const root = document.querySelector('main,[role="main"],article') || document.body;
    /* A page header may correctly precede its main landmark. Require one
     * visible page-level heading anywhere in the reader surface, excluding
     * navigation/footer chrome, instead of falsely treating that structure as
     * a missing introduction. */
    const heading = [...document.querySelectorAll('h1,[role="heading"][aria-level="1"]')]
      .find(element => !element.closest('nav,footer') && elementVisible(element, false));
    const introduction = [...root.querySelectorAll('p,.lede,.intro,.dek,.summary,li,dd')]
      .find(element => !element.closest('nav,footer')
        && elementVisible(element, false)
        && element.textContent.replace(/\s+/g, ' ').trim().length >= 24);
    const actions = [...root.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,form')]
      .filter(element => elementVisible(element, false) && !element.closest('[inert]'));
    return {
      marker: document.body.getAttribute('data-front-facing') || '',
      heading: heading ? heading.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : '',
      introduction: introduction ? introduction.textContent.replace(/\s+/g, ' ').trim().slice(0, 180) : '',
      actions: actions.length,
    };
  }

  function chromeAboveTarget(chromeElement, owner, overlap) {
    const points = [
      [(overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2],
      [overlap.left + 0.75, overlap.top + 0.75],
      [overlap.right - 0.75, overlap.bottom - 0.75],
    ];
    return points.some(([x, y]) => {
      const stack = document.elementsFromPoint(x, y);
      const chromeIndex = stack.findIndex(element => element === chromeElement || chromeElement.contains(element));
      const targetIndex = stack.findIndex(element => element === owner || owner.contains(element));
      return chromeIndex >= 0 && targetIndex >= 0 && chromeIndex < targetIndex;
    });
  }

  function mergeLineRects(rects) {
    const sorted = rects.slice().sort((a, b) => a.top - b.top || a.left - b.left);
    const lines = [];
    for (const rect of sorted) {
      const line = lines.find(candidate => Math.abs(candidate.top - rect.top) <= 2
        && Math.abs(candidate.bottom - rect.bottom) <= 3);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.width = line.right - line.left;
      } else {
        lines.push({ ...rect });
      }
    }
    return lines;
  }

  function renderedLineBands(rects) {
    const sorted = rects.slice().sort((a, b) => a.top - b.top || a.left - b.left);
    const bands = [];
    for (const rect of sorted) {
      const band = bands.find(candidate => Math.abs(candidate.top - rect.top) <= 2
        && Math.abs(candidate.bottom - rect.bottom) <= 3);
      if (band) {
        band.top = Math.min(band.top, rect.top);
        band.bottom = Math.max(band.bottom, rect.bottom);
      } else {
        bands.push({ top: rect.top, bottom: rect.bottom });
      }
    }
    return bands;
  }

  function isDeliberateInitialLetter(owner, node, start) {
    /* A floated or enlarged `::first-letter` creates a separate client rect
     * for the initial glyph. That is intentional drop-cap typography, not a
     * word broken by wrapping. Exempt only the first textual word and only
     * when the browser confirms an actual initial-letter treatment. */
    const prefix = document.createRange();
    try {
      prefix.setStart(owner, 0);
      prefix.setEnd(node, start);
      if (prefix.toString().trim()) return false;
    } catch {
      return false;
    } finally {
      prefix.detach();
    }
    const ownerStyle = getComputedStyle(owner);
    const initialStyle = getComputedStyle(owner, '::first-letter');
    const ownerSize = Number.parseFloat(ownerStyle.fontSize) || 0;
    const initialSize = Number.parseFloat(initialStyle.fontSize) || ownerSize;
    const initialLetter = initialStyle.getPropertyValue('initial-letter');
    return initialStyle.float !== 'none'
      || initialSize > ownerSize * 1.45
      || (initialLetter && initialLetter !== 'normal' && initialLetter !== 'none');
  }

  function splitOrdinaryWordFailures(limit = 24) {
    const failures = [];
    const roots = [...document.querySelectorAll('main,article,[role="main"]')];
    if (!roots.length) roots.push(document.body);
    const seen = new Set();
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (failures.length >= limit) break;
        if (seen.has(node)) continue;
        seen.add(node);
        const owner = node.parentElement;
        const text = node.textContent || '';
        if (!owner || !text.trim() || owner.closest(WORD_BREAK_SKIP)
          || hiddenByClosedDetails(owner) || !elementVisible(owner, true)) continue;
        const style = getComputedStyle(owner);
        if (!style.writingMode.startsWith('horizontal')) continue;
        /* Han text is normally allowed to wrap between ideographs; treating a
         * whole Chinese phrase as one Western-style word reports legitimate
         * line breaking as damage. This contract protects ordinary
         * Latin-script words (including letters with combining marks), which
         * are the words that the site's legacy `break-word` rules can visibly
         * split. Four base letters keeps punctuation and isolated marks out of
         * the detector without weakening the reader-word invariant. */
        const wordPattern = /(?:\p{Script=Latin}\p{M}*){4,}/gu;
        let match;
        while ((match = wordPattern.exec(text))) {
          if (failures.length >= limit) break;
          const start = match.index;
          const end = start + match[0].length;
          if (isDeliberateInitialLetter(owner, node, start)) continue;
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, end);
          const rects = [...range.getClientRects()].filter(rect => (
            rect.width > 0.5 && rect.height > 0.5
            && rect.bottom > 0 && rect.top < innerHeight
            && rect.right > 0 && rect.left < innerWidth
          ));
          range.detach();
          const bands = renderedLineBands(rects);
          if (bands.length > 1) {
            failures.push({
              type: 'split-ordinary-word',
              element: stableLabel(owner),
              word: match[0],
              renderedLines: bands.length,
              wordBreak: style.wordBreak,
              overflowWrap: style.overflowWrap,
            });
          }
        }
      }
    }
    return failures;
  }

  function horizontalOverflowCulprits(limit = 10) {
    const culprits = [];
    for (const element of document.querySelectorAll('body *')) {
      if (culprits.length >= limit || !elementVisible(element, false)) continue;
      if (element.id === 'indraLayer' || element.closest('#indraLayer')) continue;
      if (element.matches('.skip-link') && !element.matches(':focus')) continue;
      const rect = element.getBoundingClientRect();
      const excessRight = rect.right - innerWidth;
      const excessLeft = -rect.left;
      if (excessRight <= 2 && excessLeft <= 2) continue;
      culprits.push({
        element: stableLabel(element),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        excess: Math.round(Math.max(excessLeft, excessRight) * 10) / 10,
      });
    }
    return culprits;
  }

  function descendantTextRects(element) {
    const rects = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || !node.parentElement || hiddenByClosedDetails(node.parentElement)) continue;
      rects.push(...rangeRects(node, false));
    }
    return rects;
  }

  function availableAncestorWidth(element, fontSize) {
    let available = element.getBoundingClientRect().width;
    let current = element.parentElement;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none') continue;
      available = Math.max(available, current.getBoundingClientRect().width);
    }
    return available / Math.max(fontSize, 1);
  }

  function reflowFailures() {
    const failures = [];
    const scrollingElement = document.scrollingElement || document.documentElement;
    const overflow = scrollingElement.scrollWidth - scrollingElement.clientWidth;
    if (overflow > 2) {
      failures.push({
        type: 'horizontal-overflow',
        overflow: Math.round(overflow * 10) / 10,
        viewport: scrollingElement.clientWidth,
        culprits: horizontalOverflowCulprits(),
      });
    }
    for (const element of document.querySelectorAll(BLOCK_SELECTOR)) {
      if (failures.length >= 24 || !elementVisible(element, false) || hiddenByClosedDetails(element)) continue;
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 18 || text.split(/\s+/).length < 3) continue;
      const style = getComputedStyle(element);
      if (!style.writingMode.startsWith('horizontal')) continue;
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      const box = element.getBoundingClientRect();
      const lines = mergeLineRects(descendantTextRects(element));
      if (lines.length < 3) continue;
      const widthEm = box.width / fontSize;
      const availableEm = availableAncestorWidth(element, fontSize);
      const charsPerLine = text.replace(/\s/g, '').length / lines.length;
      const maxLineEm = Math.max(...lines.map(line => line.width)) / fontSize;
      const pathological = availableEm >= 16 && (
        (widthEm < 5.5 && charsPerLine < 8)
        || (lines.length >= 5 && charsPerLine < 6 && maxLineEm < 7)
      );
      if (pathological) {
        failures.push({
          type: 'squeezed-text',
          element: stableLabel(element),
          text: text.slice(0, 120),
          lines: lines.length,
          widthEm: Math.round(widthEm * 10) / 10,
          availableEm: Math.round(availableEm * 10) / 10,
          charsPerLine: Math.round(charsPerLine * 10) / 10,
        });
      }
    }
    if (failures.length < 24) {
      failures.push(...splitOrdinaryWordFailures(24 - failures.length));
    }
    return failures;
  }

  function scan() {
    const chrome = topLevelChrome();
    const flow = visibleFlowText();
    const collisions = [];
    for (const item of chrome) {
      /* Fully opaque sticky/fixed chrome intentionally hides content that has
       * scrolled behind it. Anchor and focus landing checks below still fail
       * any obscured destination. Transparent and translucent chrome must not
       * leave two simultaneously readable layers. */
      if (item.surfaceAlpha >= 0.98) continue;
      const fragments = chromePaintFragments(item);
      for (const fragment of fragments) {
        for (const content of flow) {
          const overlap = intersection(fragment.rect, content.rect);
          if (!overlap || overlap.width * overlap.height < 2) continue;
          if (!chromeAboveTarget(item.element, content.owner, overlap)) continue;
          collisions.push({
            chrome: item.label,
            position: item.position,
            chromeKind: fragment.kind,
            surfaceAlpha: Math.round(item.surfaceAlpha * 1000) / 1000,
            text: content.text,
            overlap: {
              width: Math.round(overlap.width * 10) / 10,
              height: Math.round(overlap.height * 10) / 10,
            },
          });
          if (collisions.length >= 24) break;
        }
        if (collisions.length >= 24) break;
      }
      if (collisions.length >= 24) break;
    }
    return {
      scrollY: Math.round(scrollY),
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      chrome: chrome.map(item => ({
        label: item.label,
        position: item.position,
        surfaceAlpha: Math.round(item.surfaceAlpha * 1000) / 1000,
      })),
      collisions,
      reflow: reflowFailures(),
    };
  }

  function anchorLanding(element) {
    const heading = element.matches(HEADING_SELECTOR)
      ? element
      : [...element.querySelectorAll(HEADING_SELECTOR)].find(candidate => elementVisible(candidate, true));
    if (heading) {
      const headingRect = clippedRect(heading.getBoundingClientRect());
      if (headingRect) return { owner: heading, rect: headingRect, kind: 'heading' };
    }
    const source = element.getBoundingClientRect();
    const leading = {
      left: source.left,
      right: source.right,
      top: source.top,
      bottom: Math.min(source.bottom, source.top + 44),
      width: source.width,
      height: Math.min(source.height, 44),
    };
    return { owner: element, rect: clippedRect(leading), kind: 'leading-44px' };
  }

  function activeChromeObstruction(element, anchorMode = false) {
    if (!element || !elementVisible(element, true)) return null;
    const landing = anchorMode
      ? anchorLanding(element)
      : { owner: element, rect: clippedRect(element.getBoundingClientRect()), kind: 'full-control' };
    if (!landing.rect) return null;
    for (const chrome of topLevelChrome()) {
      if (chrome.element === landing.owner || chrome.element.contains(landing.owner)) continue;
      const overlap = intersection(chrome.rect, landing.rect);
      if (!overlap) continue;
      if (chromeAboveTarget(chrome.element, landing.owner, overlap)) {
        return {
          chrome: chrome.label,
          target: stableLabel(element),
          landing: landing.kind,
          overlap,
        };
      }
    }
    return null;
  }

  async function nextFrame() {
    await Promise.race([
      new Promise(resolve => requestAnimationFrame(resolve)),
      new Promise(resolve => setTimeout(resolve, 24)),
    ]);
  }

  async function inspectAnchors() {
    const targets = [];
    const seen = new Set();
    const missingReferenced = [];
    const referenced = new Set([...document.querySelectorAll('a[href^="#"]')].map(link => {
      try { return decodeURIComponent(link.hash.slice(1)); } catch { return link.hash.slice(1); }
    }).filter(Boolean));
    const candidates = document.querySelectorAll([
      'a[name]', 'main[id]', 'article[id]', 'section[id]', 'header[id]', 'footer[id]',
      'nav[id]', 'aside[id]', 'h1[id]', 'h2[id]', 'h3[id]', 'h4[id]', 'h5[id]',
      'h6[id]', 'details[id]', '[role="main"][id]', '[role="region"][id]',
    ].join(','));
    for (const element of candidates) {
      const name = element.id || element.getAttribute('name');
      if (!name || seen.has(name)) continue;
      seen.add(name);
      targets.push(element);
    }
    for (const name of referenced) {
      if (seen.has(name)) continue;
      const element = document.getElementById(name)
        || document.querySelector(`a[name="${CSS.escape(name)}"]`);
      if (!element) {
        missingReferenced.push(name);
        continue;
      }
      seen.add(name);
      targets.push(element);
    }

    const failures = [];
    let checked = 0;
    for (const target of targets) {
      const ancestors = [];
      let current = target.parentElement;
      while (current) {
        if (current.tagName === 'DETAILS') ancestors.unshift(current);
        current = current.parentElement;
      }
      if (target.tagName === 'DETAILS' && !target.open) target.open = true;
      for (const details of ancestors) if (!details.open) details.open = true;
      if (!elementVisible(target, false)) continue;
      const beforeScroll = { x: scrollX, y: scrollY };
      target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      if (scrollX !== beforeScroll.x || scrollY !== beforeScroll.y) await nextFrame();
      checked += 1;
      const obstruction = activeChromeObstruction(target, true);
      if (obstruction && failures.length < 24) {
        failures.push({ anchor: target.id || target.getAttribute('name'), ...obstruction });
      }
    }
    return {
      discovered: targets.length,
      checked,
      skippedNotRendered: targets.length - checked,
      missingReferenced,
      failures,
    };
  }

  async function inspectProgrammaticFocus() {
    const selector = 'a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
    const controls = [...document.querySelectorAll(selector)].filter(element => {
      if (!elementVisible(element, false) || element.closest('[inert]')) return false;
      if ('disabled' in element && element.disabled) return false;
      return Number.parseInt(element.getAttribute('tabindex') || '0', 10) >= 0;
    });
    const failures = [];
    let checked = 0;
    for (const control of controls) {
      const beforeScroll = { x: scrollX, y: scrollY };
      control.focus({ preventScroll: false });
      if (scrollX !== beforeScroll.x || scrollY !== beforeScroll.y) await nextFrame();
      if (document.activeElement !== control) {
        if (failures.length < 24) {
          failures.push({ target: stableLabel(control), reason: 'focus-not-received' });
        }
        continue;
      }
      checked += 1;
      // Focus uses the complete interactive rectangle, not the anchor strip.
      const obstruction = activeChromeObstruction(control, false);
      if (obstruction && failures.length < 24) failures.push(obstruction);
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return { discovered: controls.length, checked, failures };
  }

  window.__frontFacingOverlapProbe = {
    scan,
    readerEntryContract,
    inspectAnchors,
    inspectProgrammaticFocus,
    activeFocusObstruction() { return activeChromeObstruction(document.activeElement, false); },
    focusableCount() {
      return [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')]
        .filter(element => elementVisible(element, false)
          && !element.closest('[inert]')
          && !('disabled' in element && element.disabled)).length;
    },
  };
}

async function configurePage(page, scenario) {
  await page.addInitScript(({ theme, textScale, motionAttribute }) => {
    document.documentElement.setAttribute('data-motion', motionAttribute);
    try {
      localStorage.setItem('ss-theme', theme);
      localStorage.setItem('leizu-theme', theme);
      if (textScale === 1) localStorage.removeItem('ss-fontscale');
      else localStorage.setItem('ss-fontscale', String(textScale));
    } catch { /* Storage may be unavailable in hardened contexts. */ }
  }, {
    theme: scenario.theme,
    textScale: scenario.textScale,
    motionAttribute: scenario.motionAttribute,
  });
}

async function applyScenario(page, scenario) {
  await page.evaluate(({ theme, textScale, motionAttribute }) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    root.setAttribute('data-motion', motionAttribute);
    if (textScale === 1) {
      root.style.removeProperty('--font-scale');
      root.style.removeProperty('--ss-user-font-size');
    } else {
      root.style.setProperty('--font-scale', String(textScale));
      root.style.setProperty('--ss-user-font-size', `${16 * textScale}px`);
    }
  }, scenario);
  await page.addStyleTag({ content: [
    '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}',
    'html{scroll-behavior:auto!important}',
    scenario.textScale === 1
      ? ''
      : `html{font-size:${16 * scenario.textScale}px!important;--font-scale:${scenario.textScale}!important;--ss-user-font-size:${16 * scenario.textScale}px!important}`,
  ].join('\n') });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await page.evaluate(() => Promise.race([
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    new Promise(resolve => setTimeout(resolve, 24)),
  ]));
  await page.evaluate(installBrowserProbe);
}

function summarizeFailure(route, family, scenario, phase, details) {
  return { route, family, scenario: scenario.label, phase, details };
}

async function inspectScrollMatrix(page, fixture, scenario, failures, counters) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerHeight,
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  }));
  const maxScroll = Math.max(0, dimensions.height - dimensions.viewport);
  const stops = [...new Set(SCROLL_FRACTIONS.map(fraction => Math.round(maxScroll * fraction)))];
  const reflowKeys = new Set();
  for (const targetY of stops) {
    const result = await page.evaluate(async y => {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      await Promise.race([
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        new Promise(resolve => setTimeout(resolve, 24)),
      ]);
      /* Geometry reads below force style/layout even when Chromium suppresses
       * animation frames for an otherwise fully loaded background document. */
      return window.__frontFacingOverlapProbe.scan();
    }, targetY);
    counters.scrollProbes += 1;
    if (result.collisions.length) {
      failures.push(summarizeFailure(fixture.route, fixture.family, scenario, `scroll:${targetY}`, {
        collisions: result.collisions.slice(0, MAX_COLLISIONS_PER_PROBE),
      }));
    }
    for (const item of result.reflow) {
      const key = JSON.stringify(item);
      if (reflowKeys.has(key)) continue;
      reflowKeys.add(key);
      failures.push(summarizeFailure(fixture.route, fixture.family, scenario, 'reflow', item));
      if (reflowKeys.size >= MAX_REFLOW_FAILURES_PER_PROBE) break;
    }
  }
}

async function inspectDeepInteractions(page, fixture, scenario, failures, counters) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const anchors = await page.evaluate(() => window.__frontFacingOverlapProbe.inspectAnchors());
  counters.anchors += anchors.checked;
  if (anchors.missingReferenced.length) {
    failures.push(summarizeFailure(fixture.route, fixture.family, scenario, 'anchors', {
      reason: 'fragment-links-reference-missing-targets',
      targets: anchors.missingReferenced,
    }));
  }
  if (anchors.failures.length) {
    failures.push(summarizeFailure(fixture.route, fixture.family, scenario, 'anchors', anchors.failures));
  }

  const focus = await page.evaluate(() => window.__frontFacingOverlapProbe.inspectProgrammaticFocus());
  counters.focusTargets += focus.checked;
  if (focus.checked !== focus.discovered || focus.failures.length) {
    failures.push(summarizeFailure(fixture.route, fixture.family, scenario, 'focus-all', focus));
  }

  /* Direct focus covers every control. A real Tab sample verifies that the
   * browser's sequential focus mechanism enters and continues through the
   * document without being hidden by chrome. */
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.scrollTo(0, 0);
    const sentinel = document.createElement('span');
    sentinel.id = 'overlap-verifier-keyboard-sentinel';
    sentinel.tabIndex = 0;
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;top:0;left:0';
    document.body.prepend(sentinel);
    sentinel.focus({ preventScroll: true });
  });
  const focusableCount = await page.evaluate(() => window.__frontFacingOverlapProbe.focusableCount());
  const tabSteps = Math.min(24, focusableCount);
  for (let index = 0; index < tabSteps; index += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => ({
      active: document.activeElement && document.activeElement !== document.body
        ? (document.activeElement.id
          ? `#${document.activeElement.id}`
          : document.activeElement.tagName.toLowerCase())
        : '',
      obstruction: window.__frontFacingOverlapProbe.activeFocusObstruction(),
    }));
    counters.keyboardTabs += 1;
    if (!state.active || state.obstruction) {
      failures.push(summarizeFailure(
        fixture.route,
        fixture.family,
        scenario,
        `keyboard-tab:${index + 1}`,
        state,
      ));
      break;
    }
  }
  await page.evaluate(() => document.getElementById('overlap-verifier-keyboard-sentinel')?.remove());
}

async function runBrowser(options, inventory) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (error) {
    throw new Error(`Playwright is unavailable (${error.message}); use --inventory-only for static coverage.`);
  }

  let ownedServer = null;
  let baseUrl = options.baseUrl;
  if (!baseUrl) {
    ownedServer = await startStaticServer(options.contentRoot);
    baseUrl = ownedServer.baseUrl;
  }

  const executablePath = options.executablePath
    || process.env.CHROME_EXECUTABLE
    || playwright.chromium.executablePath();
  if (!executablePath || !fs.existsSync(executablePath) || fs.statSync(executablePath).size === 0) {
    if (ownedServer) await new Promise(resolve => ownedServer.server.close(resolve));
    throw new Error(
      `Chromium executable is unavailable at ${executablePath || '(empty path)'}. `
      + 'Install the pinned Playwright browser or set CHROME_EXECUTABLE.',
    );
  }

  const selectedFamilies = FAMILIES.filter(family => family.browser !== false
    && (!options.families.size || options.families.has(family.id)));
  const fixtures = selectedFamilies.flatMap(family => family.fixtures.map(route => ({
    family: family.id,
    route,
    bytes: fs.statSync(fileForRoute(options.contentRoot, route)).size,
  }))).sort((left, right) => right.bytes - left.bytes || left.route.localeCompare(right.route));
  const baseOrigin = new URL(baseUrl).origin;
  const scenarios = SCENARIOS.filter(scenario => !options.scenarios.size
    || options.scenarios.has(scenario.label));
  const failures = [];
  const counters = { pages: 0, readerEntries: 0, scrollProbes: 0, anchors: 0, focusTargets: 0, keyboardTabs: 0 };
  try {
    let nextScenario = 0;
    // Two independent scenario workers keep the complete 50-by-14 matrix
    // inside the release window without increasing the proven four-page
    // pressure inside either fresh browser. Coverage and assertions are
    // unchanged; the bound is deliberately fixed for clean-room stability.
    const scenarioWorkerCount = Math.min(2, scenarios.length);
    const runScenarioWorker = async () => {
      while (nextScenario < scenarios.length) {
        const scenarioIndex = nextScenario;
        nextScenario += 1;
        const scenario = scenarios[scenarioIndex];
      // A fresh browser per scenario prevents font/GPU/page state accumulated
      // by hundreds of probes from turning later local navigations into
      // nondeterministic timeouts. Every route and assertion still runs.
      const browser = await playwright.chromium.launch({ headless: true, executablePath });
      const context = await browser.newContext({
        viewport: { width: scenario.width, height: scenario.height },
        colorScheme: scenario.theme,
        reducedMotion: scenario.reducedMotion,
        locale: 'en-CA',
      });
      try {
        let nextFixture = 0;
        const fixtureWorkerCount = Math.min(4, fixtures.length);
        const runFixtureWorker = async () => {
          const page = await context.newPage();
          await page.route('**/*', async route => {
            const requestUrl = new URL(route.request().url());
            if (requestUrl.origin !== baseOrigin) await route.abort();
            else await route.continue();
          });
          await configurePage(page, scenario);
          try {
            while (nextFixture < fixtures.length) {
              const fixtureIndex = nextFixture;
              nextFixture += 1;
              const fixture = fixtures[fixtureIndex];
              const fixtureStarted = Date.now();
              if (process.env.FRONT_FACING_BROWSER_PROGRESS === '1') {
                console.log(`[overlap] start ${scenario.label} ${fixture.family} ${fixture.route}`);
              }
              try {
                const response = await page.goto(baseUrl + fixture.route, {
                  /* The probe mutates audit CSS and then awaits document.fonts.ready.
                   * Enter only after the final document (including client-side
                   * redirect destinations) has completed stylesheet loading, or
                   * Chromium can retain a permanently pending FontFaceSet promise. */
                  waitUntil: 'load',
                  timeout: 45_000,
                });
                if (!response || response.status() >= 400) {
                  failures.push(summarizeFailure(fixture.route, fixture.family, scenario, 'navigation', {
                    status: response ? response.status() : 'no-response',
                  }));
                  continue;
                }
                await applyScenario(page, scenario);
                counters.pages += 1;

                const modeState = await page.evaluate(() => ({
                  fontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
                  dark: document.documentElement.classList.contains('dark')
                    || document.documentElement.getAttribute('data-theme') === 'dark',
                  calm: document.documentElement.getAttribute('data-motion') === 'calm',
                  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                }));
                const modeMismatch = modeState.dark !== (scenario.theme === 'dark')
                  || modeState.calm !== (scenario.motionAttribute === 'calm')
                  || modeState.reduced !== (scenario.reducedMotion === 'reduce')
                  || (scenario.textScale === 1.45 && modeState.fontSize < 22.5);
                if (modeMismatch) {
                  failures.push(summarizeFailure(
                    fixture.route,
                    fixture.family,
                    scenario,
                    'mode-contract',
                    modeState,
                  ));
                }

                const readerEntry = await page.evaluate(() => window.__frontFacingOverlapProbe.readerEntryContract());
                counters.readerEntries += 1;
                if (
                  readerEntry.marker !== 'general-audience'
                  || !readerEntry.heading
                  || !readerEntry.introduction
                  || readerEntry.actions < 1
                ) {
                  failures.push(summarizeFailure(
                    fixture.route,
                    fixture.family,
                    scenario,
                    'reader-entry-contract',
                    readerEntry,
                  ));
                }

                const language = LANGUAGE_EXPECTATIONS.get(fixture.route);
                if (language) {
                  const actual = await page.evaluate(() => ({
                    lang: document.documentElement.lang,
                    dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
                  }));
                  if (!language.lang.test(actual.lang) || actual.dir !== language.dir) {
                    failures.push(summarizeFailure(
                      fixture.route,
                      fixture.family,
                      scenario,
                      'language-contract',
                      actual,
                    ));
                  }
                }

                await inspectScrollMatrix(page, fixture, scenario, failures, counters);
                if (scenario.deep) {
                  await inspectDeepInteractions(page, fixture, scenario, failures, counters);
                }
              } catch (error) {
                failures.push(summarizeFailure(
                  fixture.route,
                  fixture.family,
                  scenario,
                  'exception',
                  error.message,
                ));
              }
              if (process.env.FRONT_FACING_BROWSER_PROGRESS === '1') {
                console.log(`[overlap] done ${scenario.label} ${fixture.family} ${fixture.route} ${Date.now() - fixtureStarted}ms`);
              }
            }
          } finally {
            await page.close();
          }
        };
        await Promise.all(Array.from({ length: fixtureWorkerCount }, () => runFixtureWorker()));
      } finally {
        await context.close();
        await browser.close();
      }
      }
    };
    await Promise.all(Array.from({ length: scenarioWorkerCount }, () => runScenarioWorker()));
  } finally {
    if (ownedServer) await new Promise(resolve => ownedServer.server.close(resolve));
  }

  return {
    failures,
    counters,
    fixtures: fixtures.length,
    scenarios: scenarios.length,
    classifiedRoutes: inventory.routes.length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = validateInventory(options);
  if (inventory.failures.length) {
    console.error('FRONT-FACING OVERLAP INVENTORY FAILED');
    for (const failure of inventory.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const countSummary = FAMILIES.map(family => `${family.id}:${inventory.counts.get(family.id)}`).join(', ');
  console.log(
    `Route-family inventory passed: ${inventory.routes.length} HTML routes `
      + `across ${FAMILIES.length} declared families.`,
  );
  console.log(countSummary);
  if (options.inventoryOnly) return;

  const result = await runBrowser(options, inventory);
  if (result.failures.length) {
    result.failures.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    console.error(
      `FRONT-FACING OVERLAP/REFLOW FAILED — ${result.failures.length} grouped failures `
        + `after ${result.counters.pages} page scenarios and `
        + `${result.counters.scrollProbes} scroll probes.`,
    );
    for (const failure of result.failures.slice(0, MAX_REPORTED_FAILURES)) {
      console.error(JSON.stringify(failure));
    }
    if (result.failures.length > MAX_REPORTED_FAILURES) {
      console.error(
        `Displayed ${MAX_REPORTED_FAILURES}/${result.failures.length} failures; `
          + 'execution still covered the complete matrix.',
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log([
    'Front-facing overlap/reflow browser gate passed.',
    `${result.fixtures} fixtures × ${result.scenarios} viewport/mode scenarios`,
    `${result.counters.pages} page scenarios`,
    `${result.counters.readerEntries} reader-entry contracts`,
    `${result.counters.scrollProbes} scroll probes`,
    `${result.counters.anchors} named anchors`,
    `${result.counters.focusTargets} focus targets`,
    `${result.counters.keyboardTabs} real Tab steps`,
  ].join(' '));
}

main().catch(error => {
  console.error(`FRONT-FACING OVERLAP/REFLOW ERROR — ${error.stack || error.message}`);
  process.exitCode = 1;
});
