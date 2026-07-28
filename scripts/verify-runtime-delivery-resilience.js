#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const HEADERS = path.join(ROOT, '_headers');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'runtime-delivery-resilience.json');
const RELEASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
const failures = [];
const metrics = {
  html_files: 0,
  mitigated_external_font_stylesheets: 0,
  deferred_external_scripts: 0,
  lazy_external_iframes: 0,
  lazy_external_images: 0,
  bounded_local_code_assets: 0,
  bounded_local_code_references: 0,
  bounded_runtime_json_assets: 0,
  bounded_runtime_data_assets: 0,
  bounded_runtime_data_bytes: 0,
};
const localCodeReferences = new Map();

function readSource(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function walk(dir, extension, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extension, out);
    else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) out.push(full);
  }
  return out;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*([\"'])(.*?)\\1`, 'i'));
  return match ? match[2] : '';
}

function hasBooleanAttribute(tag, name) {
  return new RegExp(`\\b${name}(?:\\s*=|\\s|>)`, 'i').test(tag);
}

if (!fs.existsSync(PUBLIC)) failures.push('public/ is missing; run the canonical build first');
for (const file of walk(PUBLIC, '.html')) {
  metrics.html_files += 1;
  const rel = path.relative(PUBLIC, file).replace(/\\/g, '/');
  const html = fs.readFileSync(file, 'utf8');
  if (/@import\s+(?:url\()?["']?https?:\/\//i.test(html)) {
    failures.push(`${rel} contains a third-party CSS @import inside HTML`);
  }
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const hasGooglePreconnect = linkTags.some((tag) =>
    /\bpreconnect\b/i.test(attribute(tag, 'rel')) &&
    attribute(tag, 'href') === 'https://fonts.googleapis.com'
  );
  const hasGstaticPreconnect = linkTags.some((tag) =>
    /\bpreconnect\b/i.test(attribute(tag, 'rel')) &&
    attribute(tag, 'href') === 'https://fonts.gstatic.com' &&
    hasBooleanAttribute(tag, 'crossorigin')
  );

  for (const tag of linkTags) {
    if (!/\bstylesheet\b/i.test(attribute(tag, 'rel'))) continue;
    const href = attribute(tag, 'href').replace(/&amp;/gi, '&');
    if (!/^https?:\/\//i.test(href)) continue;
    if (!/^https:\/\/fonts\.googleapis\.com\//i.test(href)) {
      failures.push(`${rel} has an unbudgeted external render-blocking stylesheet: ${href}`);
      continue;
    }
    if (!/[?&]display=swap(?:&|$)/i.test(href)) failures.push(`${rel} Google Fonts request lacks display=swap`);
    if (!hasGooglePreconnect || !hasGstaticPreconnect) failures.push(`${rel} Google Fonts request lacks both preconnect hints`);
    metrics.mitigated_external_font_stylesheets += 1;
  }

  for (const tag of [
    ...linkTags,
    ...[...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]),
  ]) {
    const raw = /^<link\b/i.test(tag) ? attribute(tag, 'href') : attribute(tag, 'src');
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean || /^https?:\/\//i.test(clean) || clean.startsWith('//')) continue;
    if (!/\.(?:css|js)$/i.test(clean)) continue;
    const asset = clean.startsWith('/')
      ? clean
      : path.posix.normalize(`/${path.posix.join(path.posix.dirname(rel), clean)}`);
    localCodeReferences.set(asset, (localCodeReferences.get(asset) || 0) + 1);
  }

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi)) {
    const tag = match[0];
    const src = attribute(tag, 'src');
    if (!/^https?:\/\//i.test(src)) continue;
    if (!hasBooleanAttribute(tag, 'defer') && !hasBooleanAttribute(tag, 'async')) failures.push(`${rel} external script blocks parsing: ${src}`);
    else metrics.deferred_external_scripts += 1;
  }

  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = match[0];
    const src = attribute(tag, 'src');
    if (!/^https?:\/\//i.test(src)) continue;
    if (attribute(tag, 'loading').toLowerCase() !== 'lazy') failures.push(`${rel} external iframe is not lazy: ${src}`);
    else metrics.lazy_external_iframes += 1;
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = attribute(tag, 'src');
    if (!/^https?:\/\//i.test(src)) continue;
    if (attribute(tag, 'loading').toLowerCase() !== 'lazy') failures.push(`${rel} external image is not lazy: ${src}`);
    else metrics.lazy_external_images += 1;
  }
}

for (const file of walk(PUBLIC, '.css')) {
  const css = fs.readFileSync(file, 'utf8');
  if (/@import\s+(?:url\()?["']?https?:\/\//i.test(css)) {
    failures.push(`${path.relative(PUBLIC, file).replace(/\\/g, '/')} contains a third-party CSS @import`);
  }
}

const headers = fs.existsSync(HEADERS) ? fs.readFileSync(HEADERS, 'utf8') : '';
function headerRules(text) {
  const rules = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line) && line.startsWith('/')) {
      current = { path: line.trim(), cache: '' };
      rules.push(current);
      continue;
    }
    const match = line.match(/^\s+Cache-Control:\s*(.+)$/i);
    if (current && match) current.cache = match[1].trim();
  }
  return rules;
}
function matchesHeaderPath(pattern, asset) {
  if (pattern === '/*') return true;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(asset);
}
const parsedHeaderRules = headerRules(headers);
for (const [asset, references] of localCodeReferences) {
  const matching = parsedHeaderRules
    .filter((rule) => rule.path !== '/*' && matchesHeaderPath(rule.path, asset))
    .sort((left, right) => right.path.length - left.path.length);
  const cache = matching[0]?.cache || '';
  if (!/^public,\s*max-age=86400,\s*stale-while-revalidate=604800$/i.test(cache)) {
    failures.push(`${asset} has no bounded one-day local-code cache rule`);
  }
  metrics.bounded_local_code_assets += 1;
  metrics.bounded_local_code_references += references;
}
for (const [label, pattern] of [
  ['global revalidation', /\/\*\s*\n\s*Cache-Control:\s*no-cache,\s*max-age=0,\s*must-revalidate/i],
  ['CSS bounded caching', /\/css\/\*\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['JavaScript bounded caching', /\/js\/\*\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['route CSS bounded caching', /\/teacherresources\/\*\.css\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['route JavaScript bounded caching', /\/leizu\/\*\.js\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['image bounded caching', /\/img\/\*\s*\n\s*Cache-Control:\s*public,\s*max-age=2592000,\s*stale-while-revalidate=604800/i],
  ['archive bounded caching', /\/polymyth\/archive\/\*\s*\n\s*Cache-Control:\s*public,\s*max-age=2592000,\s*stale-while-revalidate=604800/i],
  ['calendar five-minute freshness', /\/polymythseminars\/browse\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=300,\s*must-revalidate/i],
  ['concordance bounded caching', /\/polymyth\/concordance\/concordance-index\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['autolink vocabulary bounded caching', /\/polymyth\/concordance\/vocabulary\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['Polymyth text-mirror bounded caching', /\/polymyth\/\*\.txt\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
  ['Florilegium post-feed bounded caching', /\/florilegium\/posts\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=3600,\s*must-revalidate/i],
  ['candidate-feed bounded caching', /\/polymythseminars\/candidates\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=300,\s*must-revalidate/i],
  ['Saul data bounded caching', /\/saul\/assets\/\*\.json\s*\n\s*Cache-Control:\s*public,\s*max-age=86400,\s*stale-while-revalidate=604800/i],
]) {
  if (!pattern.test(headers)) failures.push(`_headers lacks ${label}`);
}
const concordancePage = path.join(PUBLIC, 'polymyth', 'concordance', 'index.html');
const concordanceIndex = path.join(PUBLIC, 'polymyth', 'concordance', 'concordance-index.json');
if (
  !fs.existsSync(concordancePage)
  || !fs.readFileSync(concordancePage, 'utf8').includes("fetch('/polymyth/concordance/concordance-index.json')")
) {
  failures.push('concordance page does not fetch its audited local index');
} else if (!fs.existsSync(concordanceIndex)) {
  failures.push('concordance runtime index is absent from public/');
} else {
  metrics.bounded_runtime_json_assets += 1;
}

const publicPolymyth = path.join(PUBLIC, 'polymyth');
const polymythTextMirrors = fs.existsSync(publicPolymyth)
  ? fs.readdirSync(publicPolymyth, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.txt'))
    .map(entry => path.join(publicPolymyth, entry.name))
  : [];
const boundedDataFiles = [
  ...polymythTextMirrors,
  path.join(PUBLIC, 'florilegium', 'posts.json'),
  path.join(PUBLIC, 'polymythseminars', 'candidates.json'),
  path.join(PUBLIC, 'saul', 'assets', 'saul-cv-canonical-2026.json'),
];
if (polymythTextMirrors.length < 20) {
  failures.push(`only ${polymythTextMirrors.length} public Polymyth text mirrors are cache-bounded`);
}
for (const dataFile of boundedDataFiles) {
  if (!fs.existsSync(dataFile)) {
    failures.push(`${path.relative(PUBLIC, dataFile).replace(/\\/g, '/')} cache-bounded data asset is absent`);
    continue;
  }
  metrics.bounded_runtime_data_assets += 1;
  metrics.bounded_runtime_data_bytes += fs.statSync(dataFile).size;
}
if (!readSource('js/site.js').includes("fetch('/florilegium/posts.json', { cache: 'default' })")) {
  failures.push('Florilegium post feed still bypasses bounded browser caching');
}
if (!readSource('js/polymythcal-candidates.js').includes("cache: 'default'")) {
  failures.push('Polymythcal candidate feed still bypasses bounded browser caching');
}
const autolink = path.join(PUBLIC, 'js', 'autolink.js');
const vocabulary = path.join(PUBLIC, 'polymyth', 'concordance', 'vocabulary.json');
if (
  !fs.existsSync(autolink)
  || !fs.readFileSync(autolink, 'utf8').includes("fetch('/polymyth/concordance/vocabulary.json')")
) {
  failures.push('autolink runtime does not fetch its audited local vocabulary');
} else if (!fs.existsSync(vocabulary)) {
  failures.push('autolink runtime vocabulary is absent from public/');
} else {
  metrics.bounded_runtime_json_assets += 1;
}

const report = {
  generated_at: RELEASE.generated_at || null,
  release_id: RELEASE.release_id || null,
  status: failures.length ? 'failed' : 'passed',
  metrics,
  failures,
  policy: 'Third-party render dependencies must be preconnected/non-blocking or lazy; local static assets and the large concordance index use bounded caching while calendar data revalidates quickly.',
};
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const outputMtime = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(outputMtime.getTime())) throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  fs.utimesSync(REPORT, outputMtime, outputMtime);
}

if (failures.length) {
  console.error('RUNTIME DELIVERY RESILIENCE FAILED');
  failures.slice(0, 100).forEach(failure => console.error(` - ${failure}`));
  if (failures.length > 100) console.error(` - ...and ${failures.length - 100} more`);
  process.exit(1);
}
console.log(`RUNTIME DELIVERY RESILIENCE PASSED — ${metrics.html_files} HTML files; ${metrics.mitigated_external_font_stylesheets} font stylesheets mitigated, ${metrics.deferred_external_scripts} external scripts deferred, ${metrics.lazy_external_iframes + metrics.lazy_external_images} external embeds lazy, ${metrics.bounded_local_code_assets} local CSS/JS assets across ${metrics.bounded_local_code_references} references, and ${metrics.bounded_runtime_data_assets} public data assets (${metrics.bounded_runtime_data_bytes} bytes) use bounded caching.`);
