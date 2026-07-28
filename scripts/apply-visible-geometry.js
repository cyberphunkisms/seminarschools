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
const SKIP = new Set([
  'node_modules', '.git', '.netlify', 'public', 'fixtures',
  '.public-build-staging', '.public-build-previous',
]);
const VERSION = '20260723-steady';
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
    else if (ent.isFile() && ent.name.endsWith('.html') && !/^google.*\.html$/i.test(ent.name)) out.push(full);
  }
  return out;
}
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function intensityFor(r) {
  if (/^polymythseminars\//.test(r) || r === 'polymythseminars/index.html') return '0.105';
  if (/^(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\//.test(r)) return '0.095';
  if (/^saul\//.test(r)) return '0.075';
  if (/^teacherresources\//.test(r)) return '0.060';
  if (/^(polymyth|bb|bookwormcard|campaigns|aa)\//.test(r)) return '0.095';
  return '0.070';
}
function ensureHead(html) {
  if (!/<head\b/i.test(html) || !/<\/head>/i.test(html)) return html;

  // Pre-paint state must execute synchronously before styles can flash.
  if (!/\/js\/theme-init\.js/i.test(html)) {
    html = html.replace(/<head\b([^>]*)>/i, m => `${m}\n<script src="/js/theme-init.js?v=${VERSION}"></script>`);
  }

  if (!/\/css\/alive\.css/i.test(html)) {
    html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/css/alive.css?v=${VERSION}">\n</head>`);
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
      && calmLink[0].includes(`href="/css/calm-ux.css?v=${VERSION}"`);
    const laterHead = head.slice(calmLink.index + calmLink[0].length);
    const laterStylesheet = /<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])[^>]*>/i
      .test(laterHead);
    if (isCanonical && !laterStylesheet) return html;
  }
  html = html.replace(/\s*<link\b[^>]*href=["'][^"']*\/css\/calm-ux\.css[^"']*["'][^>]*>\s*/ig, '\n');
  html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/css/calm-ux.css?v=${VERSION}">\n</head>`);
  return html;
}
function ensureBody(html, intensity) {
  return html.replace(/<body\b([^>]*)>/i, (m, attrs) => {
    let a = attrs || '';
    if (!/data-geometry\s*=/.test(a)) a += ' data-geometry="indra-web"';
    else a = a.replace(/data-geometry\s*=\s*(['"])[\s\S]*?\1/, 'data-geometry="indra-web"');
    if (!/data-indra-intensity\s*=/.test(a)) a += ` data-indra-intensity="${intensity}"`;
    else a = a.replace(/data-indra-intensity\s*=\s*(['"])[\s\S]*?\1/, `data-indra-intensity="${intensity}"`);
    return `<body${a}>`;
  });
}
function ensureScripts(html) {
  if (!/<\/body>/i.test(html)) return html;
  const hasMandala = /\/js\/mandala\.js/i.test(html);
  const hasIndra = /\/js\/indra\.js/i.test(html);
  let inject = '';
  if (!hasMandala) inject += `<script src="/js/mandala.js?v=${VERSION}" defer></script>\n`;
  if (!hasIndra) inject += `<script src="/js/indra.js?v=${VERSION}" defer></script>\n`;
  if (inject) html = html.replace(/<\/body>/i, inject + '</body>');
  return html;
}

let changed = 0;
const files = walk(ROOT);
for (const file of files) {
  const r = rel(file);
  let html = fs.readFileSync(file, 'utf8');
  const old = html;
  html = ensureHead(html);
  html = ensureBody(html, intensityFor(r));
  html = ensureScripts(html);
  if (html !== old) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
  }
  if (OUTPUT_MTIME) fs.utimesSync(file, OUTPUT_MTIME, OUTPUT_MTIME);
}
console.log(`STEADY GEOMETRY APPLY — ${changed} of ${files.length} source HTML files updated.`);
