'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// These are the HTML-bearing route roots copied by build-public-deploy.js.
// Operator-only trees (including dashboard, data, docs, scripts, and hf_export)
// are intentionally outside the active public/source HTML inventory.
const HTML_ROUTE_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythcommons', 'polymythlib',
  'polymythseminars', 'reviews', 'saul', 'seminars', 'sitemap',
  'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];

const SAFE_ROUTE_ID = /^[A-Za-z0-9._~-]+$/;

function posix(relative) {
  return relative.split(path.sep).join('/');
}

function walkHtml(root, relativeRoot) {
  const start = path.join(root, relativeRoot);
  if (!fs.existsSync(start)) return [];
  if (!fs.statSync(start).isDirectory()) {
    throw new Error(`Source HTML route root is not a directory: ${relativeRoot}`);
  }
  const output = [];
  const stack = [start];
  while (stack.length) {
    const active = stack.pop();
    const entries = fs.readdirSync(active, {withFileTypes: true})
      .sort((left, right) => left.name.localeCompare(right.name));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const target = path.join(active, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        output.push(posix(path.relative(root, target)));
      }
    }
  }
  return output.sort();
}

function sourceHtmlDocuments(root) {
  const absoluteRoot = path.resolve(root);
  const rootDocuments = fs.readdirSync(absoluteRoot, {withFileTypes: true})
    .filter(entry => (
      entry.isFile()
      && entry.name.endsWith('.html')
      && !/^google.*\.html$/i.test(entry.name)
    ))
    .map(entry => entry.name);
  return [...new Set([
    ...rootDocuments,
    ...HTML_ROUTE_ROOTS.flatMap(relative => walkHtml(absoluteRoot, relative)),
  ])].sort();
}

function attribute(tag, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}

function isRedirect(html) {
  const head = String(html).match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '';
  return [...head.matchAll(/<meta\b[^>]*>/gi)]
    .some(match => attribute(match[0], 'http-equiv').toLowerCase() === 'refresh');
}

function classifySourceHtml(root) {
  const documents = sourceHtmlDocuments(root);
  const interactive = [];
  const redirects = [];
  for (const relative of documents) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    (isRedirect(html) ? redirects : interactive).push(relative);
  }
  return {documents, interactive, redirects};
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ['amp', '&'], ['apos', "'"], ['gt', '>'], ['lt', '<'],
    ['nbsp', '\u00a0'], ['quot', '"'],
  ]);
  return String(value).replace(/&(?:#(x[0-9a-f]+|\d+)|([a-z][a-z0-9]+));?/gi, (match, numeric, name) => {
    if (numeric) {
      const radix = numeric[0].toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? numeric.slice(1) : numeric;
      const codePoint = Number.parseInt(digits, radix);
      if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }
      return match;
    }
    return named.get(String(name).toLowerCase()) ?? match;
  });
}

// Mirrors legacy_slug() and legacy_alias() in build-polymythcal-audit13.py.
function hashedLegacyAlias(value) {
  const source = String(value || 'event');
  const slug = decodeHtmlEntities(source)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 76) || 'event';
  const digest = crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8);
  return `${slug}-${digest}`;
}

function registerAlias(aliases, canonicalIds, aliasValue, targetValue, label) {
  const alias = String(aliasValue || '');
  const target = String(targetValue || '');
  if (!SAFE_ROUTE_ID.test(alias)) {
    throw new Error(`Unsafe ${label} event route id: ${JSON.stringify(alias)}`);
  }
  if (alias === target) return;
  if (canonicalIds.has(alias)) {
    throw new Error(`${label} event route ${JSON.stringify(alias)} collides with a canonical event id`);
  }
  const prior = aliases.get(alias);
  if (prior && prior !== target) {
    throw new Error(
      `${label} event route ${JSON.stringify(alias)} maps to both `
      + `${JSON.stringify(prior)} and ${JSON.stringify(target)}`,
    );
  }
  aliases.set(alias, target);
}

function expectedPolymythcalEventRoutes(events) {
  if (!Array.isArray(events)) throw new TypeError('Polymythcal events must be an array');

  const canonicalIds = new Set();
  for (const event of events) {
    const id = String(event?.id || event?.identity_key || '');
    if (!SAFE_ROUTE_ID.test(id)) {
      throw new Error(`Unsafe canonical event route id: ${JSON.stringify(id)}`);
    }
    if (canonicalIds.has(id)) throw new Error(`Duplicate canonical event route id: ${id}`);
    canonicalIds.add(id);
  }

  const englishAliases = new Map();
  const frenchAliases = new Map();
  let explicitLegacyEntries = 0;
  for (const event of events) {
    const target = String(event.id || event.identity_key);
    registerAlias(
      englishAliases,
      canonicalIds,
      hashedLegacyAlias(target),
      target,
      'English legacy',
    );
    const legacyIds = event.legacy_ids || [];
    if (!Array.isArray(legacyIds)) {
      throw new TypeError(`${target}: legacy_ids must be an array`);
    }
    for (const value of legacyIds) {
      explicitLegacyEntries += 1;
      const legacyId = String(value || '');
      registerAlias(frenchAliases, canonicalIds, legacyId, target, 'French legacy');
      registerAlias(englishAliases, canonicalIds, legacyId, target, 'English legacy');
      registerAlias(
        englishAliases,
        canonicalIds,
        hashedLegacyAlias(legacyId),
        target,
        'English legacy',
      );
    }
  }

  return {
    canonicalIds,
    englishAliases,
    frenchAliases,
    englishRouteIds: new Set([...canonicalIds, ...englishAliases.keys()]),
    frenchRouteIds: new Set([...canonicalIds, ...frenchAliases.keys()]),
    explicitLegacyEntries,
  };
}

function inspectEventRouteDirectory(root, relativeDirectory) {
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(absoluteRoot, relativeDirectory);
  const prefix = `${absoluteRoot}${path.sep}`;
  if (absoluteDirectory !== absoluteRoot && !absoluteDirectory.startsWith(prefix)) {
    throw new Error(`Event route directory escapes the repository root: ${relativeDirectory}`);
  }
  if (!fs.existsSync(absoluteDirectory) || !fs.statSync(absoluteDirectory).isDirectory()) {
    throw new Error(`Event route directory is missing: ${relativeDirectory}`);
  }

  const directoryIds = fs.readdirSync(absoluteDirectory, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const routeIds = new Set(directoryIds);
  const htmlRouteIds = new Set();
  const missingIndexIds = [];
  for (const id of directoryIds) {
    const indexFile = path.join(absoluteDirectory, id, 'index.html');
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) htmlRouteIds.add(id);
    else missingIndexIds.push(id);
  }
  return {routeIds, htmlRouteIds, missingIndexIds};
}

function difference(left, right) {
  const rightSet = right instanceof Set ? right : new Set(right);
  return [...left].filter(value => !rightSet.has(value)).sort();
}

function summarizeValues(values, limit = 12) {
  const rows = [...values].map(String).sort();
  if (rows.length === 0) return 'none';
  const visible = rows.slice(0, Math.max(0, limit));
  return visible.join(', ') + (rows.length > visible.length ? ` … (+${rows.length - visible.length})` : '');
}

module.exports = {
  classifySourceHtml,
  difference,
  expectedPolymythcalEventRoutes,
  inspectEventRouteDirectory,
  isRedirect,
  sourceHtmlDocuments,
  summarizeValues,
};
