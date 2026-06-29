#!/usr/bin/env node
/**
 * Public naming gate: the calendar's public-facing name is polymythcalendar.
 * The canonical implementation route remains /polymythseminars/ for compatibility.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const publicRoots = [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'main'),
  path.join(ROOT, 'polymyth'),
  path.join(ROOT, 'polymythseminars'),
  path.join(ROOT, 'bookwormburrows'),
  path.join(ROOT, 'sitemap.xml'),
  path.join(ROOT, 'sitemap.xsl'),
  path.join(ROOT, 'llms.txt')
];
const allowedExtensions = new Set(['.html', '.js', '.xml', '.xsl', '.txt', '.md']);
const legacy = [
  /Polymyth Seminar Calendar/g,
  /Polymyth Calendar/g,
  /Lecture Calendar/g,
  /Toronto Event Calendar/g,
  /Toronto-area public calendar/g,
  /polymyth seminar calendar/g,
  /lecture calendar/g
];

function walk(target, out = []) {
  if (!fs.existsSync(target)) return out;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (allowedExtensions.has(path.extname(target))) out.push(target);
    return out;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    walk(path.join(target, entry.name), out);
  }
  return out;
}

const files = [...new Set(publicRoots.flatMap(p => walk(p)))];
const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of legacy) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) findings.push(`${path.relative(ROOT, file)}: ${matches[0]}`);
  }
}

if (findings.length) {
  console.error('Legacy public calendar names found:');
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`polymythcalendar naming gate passed (${files.length} public files scanned).`);
