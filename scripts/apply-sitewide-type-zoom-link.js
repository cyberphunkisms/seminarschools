#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = '20260710-reviews-zoom-font-a';
const LINK = `<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=${BUILD}" data-site-wide-type-zoom="${BUILD}">`;
const SKIP = new Set(['.git', 'node_modules', '.netlify', 'public']);
let changed = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && ent.name.endsWith('.html') && !/^google.*\.html$/i.test(ent.name)) {
      let html = fs.readFileSync(full, 'utf8');
      if (!/<\/head>/i.test(html)) continue;
      html = html.replace(/\s*<link[^>]+data-site-wide-type-zoom=["'][^"']+["'][^>]*>\s*/ig, '\n');
      html = html.replace(/<\/head>/i, `${LINK}\n</head>`);
      fs.writeFileSync(full, html);
      changed++;
    }
  }
}
walk(ROOT);
console.log(`SITE-WIDE TYPE/ZOOM LINK APPLIED — ${changed} source HTML pages.`);
