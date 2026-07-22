#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = '20260710-reviews-zoom-font-a';
const LINK = `<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=${BUILD}" data-site-wide-type-zoom="${BUILD}">`;
const SKIP = new Set(['.git', 'node_modules', '.netlify', 'public']);
// Match tagged and legacy untagged copies so each document ends with one link.
const TYPE_LINK_RE = /<link\b[^>]*href=["']\/css\/site-wide-type-zoom\.css(?:\?[^"']*)?["'][^>]*>/ig;
let changed = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && ent.name.endsWith('.html') && !/^google.*\.html$/i.test(ent.name)) {
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
        changed++;
      }
    }
  }
}
walk(ROOT);
console.log(`SITE-WIDE TYPE/ZOOM LINK APPLIED — ${changed} source HTML pages.`);
