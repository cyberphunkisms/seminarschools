#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLE = '/css/audit45-localization.css?v=20260725-audit45';
const FOOTER = '/js/footer.js?v=20260805-predeploy-audit';
const roots = [
  'leizu/fr', 'leizu/zh-hant', 'leizu/zh-hans', 'leizu/fa',
  'polymythseminars/events', 'polymythseminars/fr',
  'writingclub/fr', 'writingkids/fr', 'writingjuniors/fr',
  'writingteens/fr', 'writinggrads/fr', 'university/fr',
  'philosophy/fr', 'humanities/fr', 'cfps/fr', 'lectures/fr',
  'fellowships/fr', 'saul/fr', 'saul/zh-hant', 'saul/zh-hans',
  'saul/fa', 'bb/why/zh', 'teacherresources'
];

function walk(relative, output) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    if (absolute.endsWith('.html')) output.push(absolute);
    return;
  }
  for (const entry of fs.readdirSync(absolute, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue;
    walk(path.join(relative, entry.name), output);
  }
}

const files = [];
for (const root of roots) walk(root, files);
let changed = 0;
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const original = text;
  text = text.replace(
    /<link\b[^>]*href=["']\/css\/audit45-localization\.css[^"']*["'][^>]*>\s*/gi,
    ''
  );
  const styleLink = `<link rel="stylesheet" href="${STYLE}" data-audit45-localization="true">`;
  const audit43Link = text.match(
    /<link\b[^>]*href=["'][^"']*\/css\/audit43-approved\.css[^"']*["'][^>]*>/i,
  );
  const calmLink = text.match(
    /<link\b[^>]*href=["'][^"']*\/css\/calm-ux\.css[^"']*["'][^>]*>/i,
  );
  if (audit43Link) {
    text = text.replace(
      audit43Link[0],
      `${styleLink}\n${audit43Link[0]}`,
    );
  } else if (calmLink) {
    text = text.replace(calmLink[0], `${styleLink}\n${calmLink[0]}`);
  } else {
    text = text.replace('</head>', `${styleLink}\n</head>`);
  }
  text = text.replace(/\/js\/footer\.js\?v=[^"'&\s<]+/g, FOOTER);
  if (text !== original) {
    const priorMtime = fs.statSync(file).mtime;
    fs.writeFileSync(file, text);
    if (priorMtime.getTime() > Date.now() + 60_000) {
      const regeneratedMtime = new Date(priorMtime.getTime() + 2_000);
      fs.utimesSync(file, regeneratedMtime, regeneratedMtime);
    }
    changed += 1;
  }
}

console.log(`AUDIT 45 TRANSLATION UI APPLIED — ${files.length} pages checked, ${changed} updated.`);
