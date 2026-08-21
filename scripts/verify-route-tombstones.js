#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assertNoExactCycles, assertNoRouteReuse, parseRedirects, redirectKey } = require('./lib/route-tombstones');

const ROOT = path.resolve(__dirname, '..');

function verify() {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'route-tombstones.json'), 'utf8'));
  if (registry.schemaVersion !== '1.0.0') throw new Error('route tombstones must use schemaVersion 1.0.0');
  const ids = new Set();
  const sources = new Set();
  for (const route of registry.routes) {
    if (!route.id || ids.has(route.id)) throw new Error(`duplicate or missing tombstone id: ${route.id}`);
    if (!route.from || sources.has(route.from)) throw new Error(`duplicate or missing tombstone source: ${route.from}`);
    if (![301, 404].includes(route.status)) throw new Error(`${route.id}: unsupported tombstone status ${route.status}`);
    ids.add(route.id); sources.add(route.from);
  }
  const deployed = new Set(parseRedirects(fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8')).map(redirectKey));
  const missing = registry.routes.filter((route) => !deployed.has(redirectKey(route)));
  if (missing.length) throw new Error(`missing _redirects tombstones: ${missing.map((route) => route.id).join(', ')}`);
  assertNoExactCycles(registry.routes);
  assertNoRouteReuse(ROOT, registry.routes);
  return { routes: registry.routes.length };
}

if (require.main === module) {
  try {
    const result = verify();
    console.log(`ROUTE TOMBSTONES PASS — ${result.routes} retired-route rules remain enforced and unreused.`);
  } catch (error) {
    console.error(`ROUTE TOMBSTONES FAIL\n${error.message}`);
    process.exit(1);
  }
}

module.exports = { verify };
