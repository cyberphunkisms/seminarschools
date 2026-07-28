#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'aitr', 'index.html'), 'utf8');
const failures = [];

function requireToken(token, message) {
  if (!html.includes(token)) failures.push(message);
}

requireToken('id="tabs" role="group" aria-label="Filter activities by type"', 'AITR filters need an announced control group');
requireToken('id="count" role="status" aria-live="polite" aria-atomic="true"', 'AITR result changes need a concise live status');
requireToken("b.setAttribute('aria-controls', 'entries')", 'AITR type controls must identify their result region');
requireToken('id="clear-activities" type="button"', 'AITR empty state needs a one-action recovery');
requireToken("activeType = 'all';", 'AITR clear action must reset the type filter');
requireToken('<noscript>', 'AITR needs a no-JavaScript reading surface');
requireToken('Search and type filters need JavaScript; the complete activities remain readable below.', 'AITR no-JavaScript state must explain the lost enhancement');

const seedMatch = html.match(/const SEED = (\[[\s\S]*?\]);\s*\n\s*const TYPE_ORDER/);
if (!seedMatch) {
  failures.push('AITR seed could not be parsed');
} else {
  try {
    const seed = new Function(`return ${seedMatch[1]};`)();
    const noScript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] || '';
    for (const entry of seed) {
      if (!noScript.includes(`>${entry.t}<`)) failures.push(`AITR no-JavaScript surface is missing ${entry.t}`);
    }
    const staticCount = Number(html.match(/<span id="total">(\d+)<\/span>/)?.[1]);
    if (staticCount !== seed.length) failures.push(`AITR static count ${staticCount} differs from ${seed.length} seed entries`);
  } catch (error) {
    failures.push(`AITR seed does not evaluate: ${error.message}`);
  }
}

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(source => source.trim());
for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    failures.push(`AITR inline script ${index + 1} does not compile: ${error.message}`);
  }
}

if (failures.length) {
  console.error('AUDIT36 AITR RESILIENCE FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT36 AITR RESILIENCE PASSED — accurate static count, announced filters, empty-state reset, and complete no-JavaScript activity summaries.');
