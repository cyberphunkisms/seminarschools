#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'aitr', 'index.html');
const TXT_PATH = path.join(__dirname, '..', 'polymyth', 'aitr.txt');

const html = fs.readFileSync(HTML_PATH, 'utf8');
const start = html.indexOf('const SEED = [');
const end = html.indexOf('];\n', start) + 2;
const seedStr = html.slice(start, end).replace('const SEED', 'var SEED');

const ctx = {};
vm.runInNewContext(seedStr, ctx);
const entries = ctx.SEED;

const now = new Date().toISOString().slice(0,10);
let out = `# AITR — AI Teacher Resources\n`;
out += `Source: https://seminarschools.com/aitr/\n`;
out += `AI-discovery index: https://seminarschools.com/polymyth/methodologylist.txt\n`;
out += `Last build: ${now}\n\n`;
out += `=== AITR (${entries.length} entries) ===\n\n`;

for (const e of entries) {
  out += `[${e.type}] ${e.t}\n`;
  out += `LEVEL. ${e.level}\n`;
  out += `BAND. ${e.band}\n`;
  out += `SUBJECTS. ${e.subjects.join(', ')}\n`;
  out += `PREMISE. ${e.premise}\n`;
  out += `STEPS.\n`;
  e.steps.forEach((s, i) => { out += `  ${i+1}. ${s}\n`; });
  out += `AI. ${e.ai}\n`;
  out += `LESSON. ${e.lesson}\n\n`;
}

fs.writeFileSync(TXT_PATH, out);
console.log(`Parsed ${entries.length} entries from AITR`);
console.log(`Wrote ${TXT_PATH}`);
