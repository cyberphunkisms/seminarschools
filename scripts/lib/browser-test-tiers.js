'use strict';

const fs = require('fs');
const path = require('path');

function walkHtml(root, out = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) walkHtml(absolute, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(absolute);
  }
  return out;
}

function bodyAttribute(html, name) {
  const body = html.match(/<body\b[^>]*>/i);
  if (!body) return '';
  const match = body[0].match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']+)\\1`, 'i'));
  return match ? match[2] : '';
}

function routeFor(relative) {
  const normalized = relative.replace(/\\/g, '/');
  return normalized === 'index.html' ? '/' : `/${normalized.replace(/index\.html$/, '')}`;
}

function inventory(publicRoot, exactExceptions = []) {
  const exceptions = new Set(exactExceptions.map(value => value.replace(/\\/g, '/')));
  return walkHtml(publicRoot).map(file => {
    const relative = path.relative(publicRoot, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    return {
      file,
      relative,
      route: routeFor(relative),
      routeType: bodyAttribute(html, 'data-route-type'),
      html
    };
  }).filter(page => !exceptions.has(page.relative));
}

function familyRepresentatives(pages) {
  const byType = new Map();
  for (const page of [...pages].sort((a, b) => a.route.length - b.route.length || a.route.localeCompare(b.route))) {
    if (page.routeType && !byType.has(page.routeType)) byType.set(page.routeType, page);
  }
  return [...byType.values()].sort((a, b) => a.routeType.localeCompare(b.routeType));
}

function normalizeChangedFile(file) {
  return String(file || '').trim().replace(/^\.\//, '').replace(/\\/g, '/');
}

function directChangedPages(pages, changedFiles) {
  const wanted = new Set();
  for (const input of changedFiles) {
    const file = normalizeChangedFile(input);
    if (!file) continue;
    if (file.startsWith('public/') && file.endsWith('.html')) wanted.add(file.slice('public/'.length));
    if (file.endsWith('.html') && !file.startsWith('public/')) wanted.add(file);
  }
  return pages.filter(page => wanted.has(page.relative));
}

function hasSharedImpact(changedFiles) {
  return changedFiles.map(normalizeChangedFile).some(file =>
    /^(?:css|js|data)\//.test(file)
    || /^scripts\/(?:build|apply|lib\/)/.test(file)
    || /^_includes\//.test(file)
    || /^(?:package(?:-lock)?\.json|netlify\.toml)$/.test(file)
  );
}

function selectPages({ tier, pages, changedFiles = [], shardIndex = 0, shardCount = 1 }) {
  let selected;
  if (tier === 'changed') {
    const direct = directChangedPages(pages, changedFiles);
    selected = hasSharedImpact(changedFiles) || direct.length === 0
      ? familyRepresentatives(pages)
      : direct;
  } else if (tier === 'family') selected = familyRepresentatives(pages);
  else if (tier === 'full') selected = [...pages].sort((a, b) => a.relative.localeCompare(b.relative));
  else throw new Error(`unknown browser test tier: ${tier}`);

  if (!Number.isInteger(shardIndex) || !Number.isInteger(shardCount) || shardCount < 1 || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error('invalid browser test shard');
  }
  return selected.filter((_, index) => index % shardCount === shardIndex);
}

module.exports = {
  bodyAttribute,
  directChangedPages,
  familyRepresentatives,
  hasSharedImpact,
  inventory,
  routeFor,
  selectPages
};
