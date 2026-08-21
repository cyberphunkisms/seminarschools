#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const { SITEWIDE_TYPE_ZOOM_VERSION } = require('./lib/sitewide-type-zoom-version');
const ROOT = path.resolve(__dirname, '..');
// Keep the literal for legacy Python generators that parse this authoritative
// finalizer; the equality assertion prevents drift from the shared JS owner.
const BUILD = '20260814-reader-word-integrity';
if (BUILD !== SITEWIDE_TYPE_ZOOM_VERSION) {
  throw new Error('site-wide type/zoom version drifted from its shared contract');
}
const LINK = `<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=${BUILD}" data-site-wide-type-zoom="${BUILD}">`;
// Fixtures are parser/gate inputs rather than reader-facing pages.  Mutating
// them during a sitewide finalization pass can invalidate the condition each
// fixture is meant to model and creates false preservation-ledger churn.
const SKIP = new Set(['.git', 'node_modules', '.netlify', 'public', 'fixtures']);
// Match tagged and legacy untagged copies so each document ends with one link.
const TYPE_LINK_RE = /<link\b[^>]*href=["']\/css\/site-wide-type-zoom\.css(?:\?[^"']*)?["'][^>]*>/ig;
let changed = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    if (SKIP.has(ent.name) || isGeneratedDependencyDirectory(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && ent.name.endsWith('.html') && ent.name !== 'google20234ae70106ee9d.html') {
      const originalStat = fs.statSync(full);
      const original = fs.readFileSync(full, 'utf8');
      if (!/<\/head>/i.test(original)) continue;
      const matches = original.match(TYPE_LINK_RE) || [];
      let html = original;
      if (matches.length === 1 && matches[0] === LINK) continue;
      if (matches.length) {
        let kept = false;
        html = html.replace(TYPE_LINK_RE, () => {
          if (kept) return '';
          kept = true;
          return LINK;
        });
      } else {
        html = html.replace(/<\/head>/i, `${LINK}\n</head>`);
      }
      if (html !== original) {
        fs.writeFileSync(full, html);
        if (originalStat.mtimeMs > Date.now() + 60000) {
          fs.utimesSync(full, originalStat.atime, new Date(originalStat.mtimeMs + 1000));
        }
        changed++;
      }
    }
  }
}
walk(ROOT);
console.log(`SITE-WIDE TYPE/ZOOM LINK APPLIED — ${changed} source HTML pages.`);
