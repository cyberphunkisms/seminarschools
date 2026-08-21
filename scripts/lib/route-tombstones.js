'use strict';

const fs = require('fs');
const path = require('path');

function parseRedirects(text) {
  return String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const [from, to, status] = line.split(/\s+/);
    return { from, to, status: Number(String(status || '').replace(/!$/, '')) };
  });
}

function redirectKey(rule) {
  return `${rule.from}\0${rule.to}\0${rule.status}`;
}

function assertNoExactCycles(routes) {
  const next = new Map(routes.filter((route) => !route.from.includes('*') && !route.to.includes(':')).map((route) => [route.from.replace(/\/$/, ''), route.to.replace(/\/$/, '')]));
  for (const start of next.keys()) {
    const seen = new Set();
    let current = start;
    while (next.has(current)) {
      if (seen.has(current)) throw new Error(`redirect cycle includes ${current || '/'}`);
      seen.add(current);
      current = next.get(current);
    }
  }
}

function isRedirectFallback(html) {
  return /data-route-type=["']redirect["']/i.test(html)
    && (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html) || /location\.replace\s*\(/.test(html));
}

function sourceCandidates(root, route) {
  if (route.includes('*')) return [];
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  if (!clean) return [];
  if (clean.endsWith('.html')) return [path.join(root, clean)];
  return [path.join(root, clean, 'index.html'), path.join(root, `${clean}.html`)];
}

function assertNoRouteReuse(root, routes) {
  for (const route of routes) {
    for (const file of sourceCandidates(root, route.from)) {
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf8');
      if (!isRedirectFallback(html)) throw new Error(`${route.from}: tombstoned route reused by live source ${path.relative(root, file)}`);
    }
  }
}

module.exports = { assertNoExactCycles, assertNoRouteReuse, isRedirectFallback, parseRedirects, redirectKey, sourceCandidates };
