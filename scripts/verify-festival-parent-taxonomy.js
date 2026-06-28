#!/usr/bin/env node
/* Festival contracts: one parent season uses type=festival; child records point at real parents. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'polymythseminars', 'events.json'), 'utf8'));
const events = data.events || [];
const ids = new Map(events.map(e => [e.id, e]));
const problems = [];
for (const e of events) {
  if (e.is_parent_festival && e.type !== 'festival') problems.push(`parent ${e.title} has type ${e.type}, expected festival`);
  if (e.parent_id) {
    const p = ids.get(e.parent_id);
    if (!p) problems.push(`child ${e.title} references missing parent ${e.parent_id}`);
    else if (!p.is_parent_festival) problems.push(`child ${e.title} references non-parent ${p.title}`);
  }
}
if (problems.length) { console.error('FESTIVAL PARENT TAXONOMY FAILED\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`FESTIVAL PARENT TAXONOMY OK — ${events.filter(e=>e.is_parent_festival).length} parent seasons and ${events.filter(e=>e.parent_id).length} linked productions.`);
