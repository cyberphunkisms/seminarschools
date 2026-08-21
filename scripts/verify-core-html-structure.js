#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'aa/index.html',
  'leizu/index.html',
  'leizu/fr/index.html',
  'leizu/fa/index.html',
  'leizu/zh-hans/index.html',
  'leizu/zh-hant/index.html',
  'leizu/intake/index.html',
  'leizu/teach/index.html',
  'polymyth/campaigncodex/index.html',
  'polymyth/methodologylist/index.html',
  'public/leizu/index.html',
  'public/leizu/fr/index.html',
  'public/leizu/fa/index.html',
  'public/leizu/zh-hans/index.html',
  'public/leizu/zh-hant/index.html'
];
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const OPTIONAL_CLOSE = {
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  thead: new Set(['tbody', 'tfoot']),
  tbody: new Set(['tbody', 'tfoot']),
  tr: new Set(['tr']),
  th: new Set(['th', 'td']),
  td: new Set(['th', 'td']),
  option: new Set(['option', 'optgroup']),
  p: new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'])
};
const failures = [];

function maskRawBlocks(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, match => '\n'.repeat((match.match(/\n/g) || []).length))
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, match => '\n'.repeat((match.match(/\n/g) || []).length));
}

function lineNumber(text, index) {
  return (text.slice(0, index).match(/\n/g) || []).length + 1;
}

function checkFile(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const markup = maskRawBlocks(raw);
  const stack = [];
  for (const match of markup.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)\b[^>]*>/g)) {
    const token = match[0];
    const tag = match[1].toLowerCase();
    const line = lineNumber(markup, match.index);
    if (/^<\//.test(token)) {
      if (stack.at(-1)?.tag === tag) {
        stack.pop();
        continue;
      }
      const openIndex = stack.map(item => item.tag).lastIndexOf(tag);
      if (openIndex < 0) {
        failures.push(`${rel}:${line}: closing </${tag}> has no open element`);
        continue;
      }
      const unclosed = stack.slice(openIndex + 1);
      if (!unclosed.every(item => OPTIONAL_CLOSE[item.tag])) {
        failures.push(`${rel}:${line}: closing </${tag}> while ${unclosed.map(item => `<${item.tag}> from line ${item.line}`).join(', ')} remains open`);
      }
      stack.length = openIndex;
      continue;
    }
    if (VOID.has(tag) || /\/\s*>$/.test(token)) continue;
    while (stack.length && OPTIONAL_CLOSE[stack.at(-1).tag]?.has(tag)) stack.pop();
    stack.push({ tag, line });
  }
  for (const item of stack.filter(item => !OPTIONAL_CLOSE[item.tag])) {
    failures.push(`${rel}:${item.line}: unclosed <${item.tag}>`);
  }

  const ids = new Map();
  for (const match of markup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    const id = match[1];
    const locations = ids.get(id) || [];
    locations.push(lineNumber(markup, match.index));
    ids.set(id, locations);
  }
  for (const [id, lines] of ids) {
    if (lines.length > 1) failures.push(`${rel}: duplicate id="${id}" on lines ${lines.join(', ')}`);
  }

  const mainLandmarks = [...markup.matchAll(/<([a-zA-Z][\w:-]*)\b[^>]*>/g)]
    .filter(match => {
      if (match[0].startsWith('</')) return false;
      return match[1].toLowerCase() === 'main' || /\brole\s*=\s*["']main["']/i.test(match[0]);
    });
  if (mainLandmarks.length !== 1) failures.push(`${rel}: expected exactly one main landmark, found ${mainLandmarks.length}`);

  const mainContentDefinitions = (raw.match(/\bid\s*=\s*["']main-content["']/gi) || []).length;
  if (mainContentDefinitions > 1) failures.push(`${rel}: id="main-content" is defined ${mainContentDefinitions} times, including runtime templates`);

  for (const match of markup.matchAll(/<a\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bskip-link\b)(?=[^>]*\bhref\s*=\s*["']#([^"']+)["'])[^>]*>/gi)) {
    if (!ids.has(match[1])) failures.push(`${rel}: skip link target #${match[1]} does not exist`);
  }
}

for (const rel of TARGETS) checkFile(rel);
if (failures.length) {
  console.error('CORE HTML STRUCTURE CHECK FAILED');
  failures.forEach(failure => console.error(' - ' + failure));
  process.exit(1);
}
console.log(`CORE HTML STRUCTURE CHECK PASSED — ${TARGETS.length} high-value routes have valid nesting, unique IDs, and one main landmark.`);
