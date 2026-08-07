#!/usr/bin/env node
'use strict';
/**
 * Apply the shared pre-paint, calm-interaction, and scroll-geometry contract to
 * every source HTML page. The public/ tree is generated afterwards from these
 * source files, so this script never edits public/ directly.
 */
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const ROOT = path.resolve(__dirname, '..');
const GEOMETRY_CONTRACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'),
);
const GOOGLE_TOKEN = 'google20234ae70106ee9d.html';
const GOOGLE_TOKEN_TEXT = 'google-site-verification: google20234ae70106ee9d.html\n';
const SKIP = new Set([
  'node_modules', '.git', '.netlify', 'public', 'fixtures',
  '.public-build-staging', '.public-build-previous',
]);
const STEADY_VERSION = '20260723-steady';
const GEOMETRY_VERSION = '20260806-front-facing-geometry';
const OUTPUT_MTIME = process.env.SS_BUILD_OUTPUT_MTIME
  ? new Date(process.env.SS_BUILD_OUTPUT_MTIME)
  : null;
if (OUTPUT_MTIME && Number.isNaN(OUTPUT_MTIME.getTime())) {
  throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name) || isGeneratedDependencyDirectory(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile() && ent.name.endsWith('.html')) out.push(full);
  }
  return out;
}
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function intensityFor(r) {
  if (r === 'index.html') return '0.060';
  if (/^polymythseminars\//.test(r) || r === 'polymythseminars/index.html') return '0.105';
  if (/^(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\//.test(r)) return '0.095';
  if (/^saul\//.test(r)) return '0.075';
  if (/^teacherresources\//.test(r)) return '0.060';
  if (/^(polymyth|bb|bookwormcard|campaigns|aa)\//.test(r)) return '0.095';
  return '0.070';
}
function routeTypeFor(r, html) {
  const existing = (html.match(/<body\b[^>]*\bdata-route-type\s*=\s*(['"])([^'"]+)\1/i) || [])[2];
  if (existing) {
    if (!GEOMETRY_CONTRACTS.route_types[existing]) {
      throw new Error(`${r}: unknown data-route-type ${existing}; add its structural geometry role before building`);
    }
    return existing;
  }
  if (/http-equiv=["']refresh["']/i.test(html) && /location\.replace\(/.test(html)) return 'redirect';
  if (r === '404.html') return 'error';
  if (r === 'aa/editorial.html') return 'archive-tool';
  if (/^bookwormcard\/(?:pdf|print)\/index\.html$/.test(r)) return 'game-print';
  if (r === 'bookwormcard/success/index.html') return 'form-success';
  if (r === 'campaigns/index.html') return 'campaign';
  if (/^campaigns\//.test(r)) return 'campaign-tool';
  if (r === 'dashboard/index.html') return 'tool';
  if (/^leizu\/(?:[^/]+\/)?booking-success\/index\.html$/.test(r)) return 'form-success';
  if (/^leizu\/(?:[^/]+\/)?intake\/index\.html$/.test(r)) return 'service-form';
  if (/^polymyth\/(?:devils-notebook|devilsdiary)\//.test(r)) return 'publication';
  if (/^marginalia\/[^/]+\/index\.html$/.test(r)) return 'archive';
  if (/^(?:nutrition|agora|sabachtan-seminar|ohm-dome)\/[^/]+\/index\.html$/.test(r)) return 'publication';
  if (r === 'polymyth/sitemap/graph/index.html') return 'map';
  if (r === 'teacherresources/pedagogical-case/index.html') return 'teacher-manual';
  throw new Error(`${r}: missing data-route-type; classify its structural geometry role before building`);
}
function ensureHead(html) {
  if (!/<head\b/i.test(html) || !/<\/head>/i.test(html)) return html;

  // Pre-paint state must execute synchronously before styles can flash.
  if (!/\/js\/theme-init\.js/i.test(html)) {
    html = html.replace(/<head\b([^>]*)>/i, m => `${m}\n<script src="/js/theme-init.js?v=${STEADY_VERSION}"></script>`);
  }

  const aliveLink = `<link rel="stylesheet" href="/css/alive.css?v=${GEOMETRY_VERSION}">`;
  let aliveLinks = 0;
  html = html.replace(
    /<link\b(?=[^>]*\bhref=["'][^"']*\/css\/alive\.css(?:\?[^"']*)?["'])[^>]*>/ig,
    () => {
      aliveLinks += 1;
      return aliveLinks === 1 ? aliveLink : '';
    },
  );
  if (aliveLinks === 0) {
    html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/css/alive.css?v=${GEOMETRY_VERSION}">\n</head>`);
  }

  // Calm UX must be the last stylesheet in the head so historic page-specific
  // transform and animation rules cannot reintroduce moving targets. Metadata,
  // scripts, and inline language-state guards may validly follow it, so avoid
  // rewriting a page that already has one canonical final linked stylesheet.
  const headEnd = html.search(/<\/head>/i);
  const head = html.slice(0, headEnd);
  const calmLinks = [...head.matchAll(
    /<link\b[^>]*href=["'][^"']*\/css\/calm-ux\.css[^"']*["'][^>]*>/ig,
  )];
  if (calmLinks.length === 1) {
    const [calmLink] = calmLinks;
    const isCanonical = /\brel=["'][^"']*\bstylesheet\b[^"']*["']/i.test(calmLink[0])
      && calmLink[0].includes(`href="/css/calm-ux.css?v=${STEADY_VERSION}"`);
    const laterHead = head.slice(calmLink.index + calmLink[0].length);
    const laterStylesheet = /<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])[^>]*>/i
      .test(laterHead);
    if (isCanonical && !laterStylesheet) return html;
  }
  html = html.replace(/\s*<link\b[^>]*href=["'][^"']*\/css\/calm-ux\.css[^"']*["'][^>]*>\s*/ig, '\n');
  html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/css/calm-ux.css?v=${STEADY_VERSION}">\n</head>`);
  return html;
}
function ensureBody(html, intensity, routeType) {
  const roles = GEOMETRY_CONTRACTS.route_types[routeType];
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error(`${routeType}: missing structural geometry roles`);
  }
  return html.replace(/<body\b([^>]*)>/i, (m, attrs) => {
    let a = attrs || '';
    for (const attribute of ['data-route-type', 'data-geometry', 'data-indra-intensity', 'data-geometry-role']) {
      const pattern = new RegExp(`\\s+${attribute}\\s*=\\s*(["'])[^"']*\\1`, 'ig');
      a = a.replace(pattern, '');
    }
    const geometry = ` data-route-type="${routeType}"`
      + ' data-geometry="indra-web"'
      + ` data-indra-intensity="${intensity}"`
      + ` data-geometry-role="${roles.join(' ')}"`;
    return `<body${geometry}${a}>`;
  });
}
function ensureScripts(html) {
  if (!/<\/body>/i.test(html)) return html;
  // These two scripts are a coupled dependency: mandala defines the shared
  // geometry utilities consumed by Indra. Remove stale/duplicate references,
  // then install one canonical pair immediately before the shared footer (or
  // at the end of body when the page has no shared footer).
  html = html.replace(
    /<script\b(?=[^>]*\bsrc=["'][^"']*\/js\/(?:mandala|indra)\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>[ \t]*(?:\r?\n)?/ig,
    '',
  );
  const inject = `<script src="/js/mandala.js?v=${GEOMETRY_VERSION}" defer></script>\n`
    + `<script src="/js/indra.js?v=${GEOMETRY_VERSION}" defer></script>\n`;
  const footer = /<script\b(?=[^>]*\bsrc=["'][^"']*\/js\/footer\.js(?:\?[^"']*)?["'])[^>]*>/i.exec(html);
  if (footer) html = html.slice(0, footer.index) + inject + html.slice(footer.index);
  else html = html.replace(/<\/body>/i, inject + '</body>');
  return html;
}

let changed = 0;
const files = walk(ROOT);
for (const file of files) {
  const r = rel(file);
  const priorMtimeMs = fs.statSync(file).mtimeMs;
  let html = fs.readFileSync(file, 'utf8');
  if (r === GOOGLE_TOKEN) {
    if (html !== GOOGLE_TOKEN_TEXT) throw new Error(`${GOOGLE_TOKEN}: verification token bytes changed`);
    continue;
  }
  const old = html;
  const routeType = routeTypeFor(r, html);
  html = ensureHead(html);
  html = ensureBody(html, intensityFor(r), routeType);
  html = ensureScripts(html);
  if (html !== old) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
  }
  if (OUTPUT_MTIME) {
    const configuredMs = OUTPUT_MTIME.getTime();
    const preservedMs = priorMtimeMs > Date.now() + 60_000
      ? Math.max(configuredMs, priorMtimeMs + 2_000)
      : configuredMs;
    const preserved = new Date(preservedMs);
    fs.utimesSync(file, preserved, preserved);
  }
}
console.log(`STEADY GEOMETRY APPLY — ${changed} of ${files.length} source HTML files updated.`);
