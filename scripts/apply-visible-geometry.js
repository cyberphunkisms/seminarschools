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
const {
  assertGeometryVersionScheme,
  geometryBodyAttributes,
  geometryAssetVersion,
  geometryExemptionForRelativeHtmlPath,
  geometryKeyForRelativeHtmlPath,
  geometryProfileFor,
  geometryRegisterForKey,
  geometrySeedForKey,
  isStarPageRelativeHtmlPath,
  validGeometryOpacity,
} = require('./lib/geometry-asset-version');
const { refreshTranslationGovernanceForSources } = require('./lib/translation-governance');
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
assertGeometryVersionScheme(GEOMETRY_CONTRACTS);
const GEOMETRY_VERSION = geometryAssetVersion(ROOT);
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
// Preserve the finalizer's small public helper API for strict verifiers and
// downstream build tooling while the canonical calculations live in one
// shared module with generated-page builders.
function geometryKeyFor(r) { return geometryKeyForRelativeHtmlPath(r); }
function registerFor(r) { return geometryRegisterForKey(geometryKeyFor(r)); }
function profileFor(r, routeType) { return geometryProfileFor(r, routeType); }
function seedFor(r) { return geometrySeedForKey(geometryKeyFor(r)); }
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
function ensureBody(html, r, routeType, pageOwnedIntensity) {
  return html.replace(/<body\b([^>]*)>/i, (m, attrs) => {
    let a = attrs || '';
    for (const attribute of ['data-route-type', 'data-geometry', 'data-indra-intensity', 'data-indra-fade-source', 'data-geometry-role', 'data-geometry-key', 'data-geometry-seed', 'data-geometry-register', 'data-geometry-profile', 'data-geometry-surface', 'data-geometry-engine', 'data-star-file-page', 'data-shared-geometry-exempt', 'data-front-facing']) {
      const pattern = new RegExp(`\\s+${attribute}\\s*=\\s*(["'])[^"']*\\1`, 'ig');
      a = a.replace(pattern, '');
    }
    const geometry = ` ${geometryBodyAttributes(GEOMETRY_CONTRACTS, r, routeType, { pageOwnedIntensity })}`;
    return `<body${geometry}${a}>`;
  });
}

function ensureExemptBody(html, exemption) {
  return html.replace(/<body\b([^>]*)>/i, (m, attrs) => {
    let a = attrs || '';
    a = a.replace(/\s+data-(?:geometry(?:-[\w-]+)?|indra-(?:intensity|fade-source)|star-file-page|shared-geometry-exempt)\s*=\s*(["'])[^"']*\1/ig, '');
    const starMarker = exemption === GEOMETRY_CONTRACTS.coverage.star_page_exemption_value
      ? ' data-star-file-page="true"'
      : '';
    return `<body data-shared-geometry-exempt="${exemption}"${starMarker}${a}>`;
  });
}

function removeGeometryScripts(html) {
  return html.replace(
    /<script\b(?=[^>]*\bsrc=["'][^"']*\/js\/(?:mandala|indra)\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>[ \t]*(?:\r?\n)?/ig,
    '',
  );
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

function normalizePageOwnedLayerOpacity(html) {
  const property = GEOMETRY_CONTRACTS.presentation.page_owned_opacity_property;
  if (property !== '--indra-opacity') {
    throw new Error('geometry page-owned opacity property must be --indra-opacity');
  }
  let pageOwnedIntensity = null;
  const remember = value => {
    const opacity = validGeometryOpacity(GEOMETRY_CONTRACTS, value);
    if (opacity !== null) pageOwnedIntensity = opacity;
  };
  const declarationPattern = /--indra-opacity\s*:\s*([+]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*!important)?\s*(?:;|$)/ig;

  /* Older page owners wrote a numeric opacity directly on #indraLayer. Alive
     loads last, so translate only valid numeric declarations to the inherited
     custom property instead of deleting the page's design decision. */
  html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/ig, (whole, open, css, close) => {
    const normalizedCss = css.replace(/#indraLayer\s*\{([^{}]*)\}/gi, (rule, declarations) => {
      const normalizedDeclarations = declarations.replace(
        /(^|;)\s*opacity\s*:\s*([+]?(?:\d+(?:\.\d*)?|\.\d+))(\s*!important)?\s*(?=;|$)/ig,
        (declaration, separator, value, important) => {
          const opacity = validGeometryOpacity(GEOMETRY_CONTRACTS, value);
          if (opacity === null) return declaration;
          remember(opacity);
          return `${separator}${property}:${opacity.toFixed(3)}${important || ''}`;
        },
      );
      return `#indraLayer {${normalizedDeclarations}}`;
    });
    for (const match of normalizedCss.matchAll(declarationPattern)) remember(match[1]);
    return open + normalizedCss + close;
  });

  const body = /<body\b[^>]*>/i.exec(html);
  if (body) {
    const inlineStyle = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(body[0]);
    if (inlineStyle) {
      for (const match of inlineStyle[2].matchAll(declarationPattern)) remember(match[1]);
    }
  }
  return { html, pageOwnedIntensity };
}

function removeLegacyLayerOpacity(html) {
  return normalizePageOwnedLayerOpacity(html).html;
}

function existingBodyIntensity(html, r) {
  const body = /<body\b[^>]*>/i.exec(html);
  if (!body) return null;
  const match = /\bdata-indra-intensity\s*=\s*(["'])([^"']+)\1/i.exec(body[0]);
  const intensity = validGeometryOpacity(GEOMETRY_CONTRACTS, match && match[2]);
  if (intensity === null) return null;
  const register = geometryRegisterForKey(geometryKeyFor(r));
  const registerIntensity = Number(GEOMETRY_CONTRACTS.registers[register].default_intensity);
  return Math.abs(intensity - registerIntensity) > 0.0005 ? intensity : null;
}

function applyGeometryToHtml(html, r) {
  const exemption = geometryExemptionForRelativeHtmlPath(GEOMETRY_CONTRACTS, r);
  if (exemption) {
    html = ensureHead(html);
    html = ensureExemptBody(html, exemption);
    html = removeGeometryScripts(html);
    return html;
  }
  const routeType = routeTypeFor(r, html);
  const existingIntensity = existingBodyIntensity(html, r);
  const normalizedOpacity = normalizePageOwnedLayerOpacity(html);
  html = normalizedOpacity.html;
  const pageOwnedIntensity = normalizedOpacity.pageOwnedIntensity === null
    ? existingIntensity
    : normalizedOpacity.pageOwnedIntensity;
  html = ensureHead(html);
  html = ensureBody(html, r, routeType, pageOwnedIntensity);
  html = ensureScripts(html);
  return html;
}

function applyAllSourcePages() {
  let changed = 0;
  const changedSources = new Set();
  let geometryPages = 0;
  let starPages = 0;
  let controlPages = 0;
  const files = walk(ROOT);
  for (const file of files) {
    const r = rel(file);
    const priorMtimeMs = fs.statSync(file).mtimeMs;
    let html = fs.readFileSync(file, 'utf8');
    if (r === GOOGLE_TOKEN) {
      if (html !== GOOGLE_TOKEN_TEXT) throw new Error(`${GOOGLE_TOKEN}: verification token bytes changed`);
      continue;
    }
    const exemption = geometryExemptionForRelativeHtmlPath(GEOMETRY_CONTRACTS, r);
    if (exemption === GEOMETRY_CONTRACTS.coverage.star_page_exemption_value) starPages += 1;
    else if (exemption === GEOMETRY_CONTRACTS.coverage.control_page_exemption_value) controlPages += 1;
    else geometryPages += 1;
    const old = html;
    html = applyGeometryToHtml(html, r);
    if (html !== old) {
      fs.writeFileSync(file, html, 'utf8');
      changed += 1;
      changedSources.add(r);
    }
    // Artifact workspaces may restore an older extracted copy when a rewrite
    // falls back from its future release-stamp mtime to wall-clock time. Keep a
    // regenerated page newer than its prior future-stamped version even when a
    // caller did not provide an explicit deterministic timestamp.
    if (OUTPUT_MTIME || (html !== old && priorMtimeMs > Date.now() + 60_000)) {
      const configuredMs = OUTPUT_MTIME ? OUTPUT_MTIME.getTime() : priorMtimeMs + 2_000;
      const preservedMs = priorMtimeMs > Date.now() + 60_000
        ? Math.max(configuredMs, priorMtimeMs + 2_000)
        : configuredMs;
      const preserved = new Date(preservedMs);
      fs.utimesSync(file, preserved, preserved);
    }
  }
  if (starPages !== Number(GEOMETRY_CONTRACTS.coverage.expected_current_star_pages)) {
    throw new Error(`expected ${GEOMETRY_CONTRACTS.coverage.expected_current_star_pages} canonical star pages, found ${starPages}`);
  }
  if (controlPages !== Number(GEOMETRY_CONTRACTS.coverage.expected_current_control_pages_source)) {
    throw new Error(`expected ${GEOMETRY_CONTRACTS.coverage.expected_current_control_pages_source} source-only control pages, found ${controlPages}`);
  }
  /* Geometry rewrites only presentation metadata/assets, never localized
     prose. Keep the translation ledger aligned with those exact mechanical
     rewrites so a final geometry pass cannot invalidate an otherwise clean
     release. Arbitrary content writers remain responsible for rebuilding
     translations instead of calling this source-scoped helper. */
  refreshTranslationGovernanceForSources(ROOT, changedSources);
  console.log(`STEADY GEOMETRY APPLY — ${changed} of ${files.length} source HTML files updated; ${geometryPages} ordinary pages carry ${GEOMETRY_VERSION}, ${starPages} canonical star pages and ${controlPages} source-only controls remain shared-geometry-free.`);
}

module.exports = {
  GEOMETRY_VERSION,
  applyGeometryToHtml,
  geometryExemptionForRelativeHtmlPath: r => geometryExemptionForRelativeHtmlPath(GEOMETRY_CONTRACTS, r),
  removeLegacyLayerOpacity,
  normalizePageOwnedLayerOpacity,
  geometryKeyFor,
  profileFor,
  registerFor,
  routeTypeFor,
  seedFor,
  isStarPageRelativeHtmlPath: r => isStarPageRelativeHtmlPath(GEOMETRY_CONTRACTS, r),
};

if (require.main === module) applyAllSourcePages();
