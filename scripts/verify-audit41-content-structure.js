#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const failures = [];
const metrics = {
  htmlPages: 0,
  ids: 0,
  idReferences: 0,
  crossPageFragments: 0,
  indexableCanonicals: 0,
  intentionallyNoindex: 0,
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function attr(tag, name) {
  const quoted = tag.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'),
  );
  if (quoted) return quoted[2];
  const bare = tag.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*([^\\s"'=<>` + '`' + `]+)`, 'i'),
  );
  return bare ? bare[1] : '';
}

function tags(markup) {
  return [...markup.matchAll(/<[a-z][^>]*>/gi)].map(match => match[0]);
}

function pagePath(file) {
  return path.relative(PUBLIC, file).replace(/\\/g, '/');
}

function routeFile(fromFile, rawHref) {
  const href = rawHref.split('#')[0].split('?')[0];
  if (!href) return fromFile;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null;
  let target;
  if (href.startsWith('/')) target = path.join(PUBLIC, href.slice(1));
  else target = path.resolve(path.dirname(fromFile), href);
  const candidates = [];
  if (target.endsWith(path.sep)) candidates.push(path.join(target, 'index.html'));
  candidates.push(target);
  if (!path.extname(target)) {
    candidates.push(`${target}.html`);
    candidates.push(path.join(target, 'index.html'));
  }
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function normaliseId(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

if (!fs.existsSync(PUBLIC)) {
  console.error('AUDIT 41 CONTENT STRUCTURE FAILED — public/ is missing; run the canonical build first.');
  process.exit(1);
}

const pages = walk(PUBLIC).sort();
const records = new Map();
const canonicalOwners = new Map();

for (const file of pages) {
  const relative = pagePath(file);
  const html = fs.readFileSync(file, 'utf8');
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const pageTags = tags(markup);
  const runtimeTags = tags(html);
  const ids = new Set();
  const runtimeIds = new Set();
  const names = new Set();
  const runtimeNames = new Set();
  const duplicates = new Set();

  for (const tag of pageTags) {
    const id = attr(tag, 'id');
    if (id) {
      if (ids.has(id)) duplicates.add(id);
      ids.add(id);
    }
    if (/^<(?:a|map)\b/i.test(tag)) {
      const name = attr(tag, 'name');
      if (name) names.add(name);
    }
  }
  for (const tag of runtimeTags) {
    const id = attr(tag, 'id');
    if (id) runtimeIds.add(id);
    if (/^<(?:a|map)\b/i.test(tag)) {
      const name = attr(tag, 'name');
      if (name) runtimeNames.add(name);
    }
  }
  if (
    runtimeTags.some(
      tag => attr(tag, 'data-dynamic-fragments').toLowerCase() === 'seed-ids',
    )
  ) {
    for (const match of html.matchAll(/\bid\s*:\s*(['"])([^'"]+)\1/g)) {
      runtimeIds.add(match[2]);
    }
  }
  if (duplicates.size) {
    failures.push(`${relative}: duplicate IDs ${[...duplicates].slice(0, 12).join(', ')}`);
  }

  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || '';
  const robotsTag = [...head.matchAll(/<meta\b[^>]*>/gi)].find(
    match => attr(match[0], 'name').toLowerCase() === 'robots',
  );
  const noindex = Boolean(
    robotsTag && attr(robotsTag[0], 'content').toLowerCase().split(',').map(v => v.trim()).includes('noindex'),
  );
  if (noindex) metrics.intentionallyNoindex += 1;

  const canonicalTag = [...head.matchAll(/<link\b[^>]*>/gi)].find(
    match => attr(match[0], 'rel').toLowerCase().split(/\s+/).includes('canonical'),
  );
  const canonical = canonicalTag ? attr(canonicalTag[0], 'href') : '';
  if (!noindex && canonical) {
    metrics.indexableCanonicals += 1;
    const owners = canonicalOwners.get(canonical) || [];
    owners.push(relative);
    canonicalOwners.set(canonical, owners);
  }

  records.set(file, {
    html,
    tags: pageTags,
    ids,
    names,
    runtimeIds,
    runtimeNames,
    relative,
  });
  metrics.htmlPages += 1;
  metrics.ids += ids.size;
}

const referenceAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for', 'list'];
for (const [file, record] of records) {
  for (const tag of record.tags) {
    for (const name of referenceAttrs) {
      const value = attr(tag, name).trim();
      if (!value || /(?:\\?\$\{|<%|\{\{)/.test(value)) continue;
      for (const target of value.split(/\s+/)) {
        metrics.idReferences += 1;
        if (!record.runtimeIds.has(target)) {
          failures.push(`${record.relative}: ${name} references missing #${target}`);
        }
      }
    }

    if (!/^<a\b/i.test(tag)) continue;
    const href = attr(tag, 'href');
    if (!href || !href.includes('#') || href === '#') continue;
    const fragment = normaliseId(href.slice(href.indexOf('#') + 1));
    if (
      !fragment
      || fragment.includes('=')
      || /(?:\\?\$\{|<%|\{\{)/.test(fragment)
    ) continue;
    const targetFile = routeFile(file, href);
    if (!targetFile || !records.has(targetFile)) continue;
    metrics.crossPageFragments += 1;
    const target = records.get(targetFile);
    if (
      !target.runtimeIds.has(fragment)
      && !target.runtimeNames.has(fragment)
    ) {
      failures.push(
        `${record.relative}: href ${href} references missing fragment in ${target.relative}`,
      );
    }
  }
}

for (const [canonical, owners] of canonicalOwners) {
  if (owners.length > 1) {
    failures.push(
      `indexable canonical ${canonical} is claimed by ${owners.length} pages: ${owners.slice(0, 8).join(', ')}`,
    );
  }
}

if (failures.length) {
  console.error('AUDIT 41 CONTENT STRUCTURE FAILED');
  failures.slice(0, 160).forEach(failure => console.error(` - ${failure}`));
  if (failures.length > 160) console.error(` - … ${failures.length - 160} more`);
  process.exit(1);
}

console.log(
  'AUDIT 41 CONTENT STRUCTURE PASSED — '
    + `${metrics.htmlPages} HTML pages, ${metrics.ids} unique IDs, `
    + `${metrics.idReferences} static ID references, ${metrics.crossPageFragments} local fragments, `
    + `${metrics.indexableCanonicals} indexable canonicals, and `
    + `${metrics.intentionallyNoindex} intentional noindex pages are coherent.`,
);
