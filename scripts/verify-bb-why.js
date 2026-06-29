#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const required = [
  ['bb/why/index.html', 'The Classroom Is Already a Role-Playing Game'],
  ['bb/index.html', 'href="/bb/why/"'],
  ['netlify.toml', 'from = "/bb/why"'],
  ['sitemap.xml', 'https://seminarschools.com/bb/why/']
];
let failed = false;
for (const [file, marker] of required) {
  try {
    const content = read(file);
    if (!content.includes(marker)) throw new Error(`missing marker: ${marker}`);
    console.log(`PASS ${file}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${file}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
