#!/usr/bin/env node
'use strict';

/**
 * Collapse multiple Google Fonts CSS2 stylesheet requests in one source HTML
 * document into one equivalent request. Family order follows first use; repeated
 * families with the same axes receive the union of all requested tuples.
 *
 * This is deliberately a delivery optimization, not a typography redesign:
 * no family, axis, weight, or display mode is removed.
 */

const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');
const SKIP = new Set(['.git', '.netlify', 'node_modules', 'public', 'fixtures']);
const CSS2_LINK_RE = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']https:\/\/fonts\.googleapis\.com\/css2\?[^"']+["'])[^>]*>/gi;
const HREF_RE = /\bhref=["'](https:\/\/fonts\.googleapis\.com\/css2\?[^"']+)["']/i;
const PRECONNECT_RE = /<link\b(?=[^>]*\brel=["']preconnect["'])(?=[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/)?["'])[^>]*>/gi;
const PRECONNECT_HREF_RE = /\bhref=["'](https:\/\/fonts\.(?:googleapis|gstatic)\.com)(?:\/)?["']/i;

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || isGeneratedDependencyDirectory(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}

function parseFamily(spec) {
  const colon = spec.indexOf(':');
  if (colon === -1) return { name: spec, axes: '', tuples: [''] };
  const at = spec.indexOf('@', colon + 1);
  if (at === -1) {
    throw new Error(`Google Fonts family has axes but no tuples: ${spec}`);
  }
  return {
    name: spec.slice(0, colon),
    axes: spec.slice(colon + 1, at),
    tuples: spec.slice(at + 1).split(';'),
  };
}

function numericTupleCompare(left, right) {
  const a = left.split(',');
  const b = right.split(',');
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (a[index] === b[index]) continue;
    const aNumber = Number.parseFloat(a[index]);
    const bNumber = Number.parseFloat(b[index]);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
      return aNumber - bNumber;
    }
    return String(a[index] || '').localeCompare(String(b[index] || ''));
  }
  return 0;
}

function mergeFamilies(urls, relative) {
  const order = [];
  const families = new Map();
  const parameters = new Map();

  for (const rawUrl of urls) {
    const url = new URL(rawUrl.replaceAll('&amp;', '&'));
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'family') {
        if (parameters.has(key) && parameters.get(key) !== value) {
          throw new Error(`${relative}: conflicting Google Fonts ${key} parameters`);
        }
        parameters.set(key, value);
        continue;
      }

      const parsed = parseFamily(value);
      if (!families.has(parsed.name)) {
        families.set(parsed.name, {
          axes: parsed.axes,
          tuples: new Set(parsed.tuples),
        });
        order.push(parsed.name);
        continue;
      }

      const existing = families.get(parsed.name);
      if (existing.axes !== parsed.axes) {
        throw new Error(
          `${relative}: ${parsed.name} uses incompatible Google Fonts axes `
            + `(${existing.axes || 'default'} and ${parsed.axes || 'default'})`,
        );
      }
      parsed.tuples.forEach(tuple => existing.tuples.add(tuple));
    }
  }

  const familySpecs = order.map(name => {
    const family = families.get(name);
    if (!family.axes) return name;
    const tuples = [...family.tuples].sort(numericTupleCompare);
    return `${name}:${family.axes}@${tuples.join(';')}`;
  });

  const encode = value => encodeURIComponent(value)
    .replaceAll('%20', '+')
    .replaceAll('%3A', ':')
    .replaceAll('%2C', ',')
    .replaceAll('%40', '@')
    .replaceAll('%3B', ';');
  const query = [
    ...familySpecs.map(spec => `family=${encode(spec)}`),
    ...[...parameters].map(([key, value]) => `${encode(key)}=${encode(value)}`),
  ].join('&amp;');
  return `https://fonts.googleapis.com/css2?${query}`;
}

function consolidateDocument(original, relative) {
  const links = [...original.matchAll(CSS2_LINK_RE)];
  let html = original;

  if (links.length > 1) {
    const urls = links.map(match => match[0].match(HREF_RE)?.[1]).filter(Boolean);
    if (urls.length !== links.length) {
      throw new Error(`${relative}: could not read every Google Fonts stylesheet URL`);
    }
    const combined = mergeFamilies(urls, relative);
    let kept = false;
    html = html.replace(CSS2_LINK_RE, link => {
      if (kept) return '';
      kept = true;
      return link.replace(HREF_RE, (match, previousUrl) => match.replace(previousUrl, combined));
    });
  }

  const seenPreconnects = new Set();
  html = html.replace(PRECONNECT_RE, link => {
    const origin = link.match(PRECONNECT_HREF_RE)?.[1];
    if (!origin || !seenPreconnects.has(origin)) {
      if (origin) seenPreconnects.add(origin);
      return link;
    }
    return '';
  });

  return html;
}

let changed = 0;
const pending = [];
for (const absolute of walk(ROOT)) {
  const relative = path.relative(ROOT, absolute).replaceAll(path.sep, '/');
  const original = fs.readFileSync(absolute, 'utf8');
  const html = consolidateDocument(original, relative);
  if (html === original) continue;
  changed++;
  pending.push(relative);
  if (!CHECK_ONLY) fs.writeFileSync(absolute, html);
}

if (CHECK_ONLY && pending.length) {
  console.error('GOOGLE FONTS CONSOLIDATION REQUIRED');
  pending.forEach(relative => console.error(` - ${relative}`));
  process.exit(1);
}

console.log(
  `${CHECK_ONLY ? 'GOOGLE FONTS CONSOLIDATION CHECK PASSED' : 'GOOGLE FONTS CONSOLIDATED'}`
    + ` — ${changed} source HTML ${changed === 1 ? 'document' : 'documents'} changed.`,
);
