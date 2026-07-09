#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const files = ['package-lock.json', 'package.json', 'netlify.toml', '.npmrc'].filter((file) => fs.existsSync(file));
const forbidden = [
  ['applied','caas','gateway'].join('-'),
  ['artifactory','api','npm','npm-public'].join('/'),
  ['internal','api','openai','org'].join('.'),
  ['packages','hub','ace-research','openai','org'].join('.')
];
let failed = false;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      console.error(`Forbidden npm registry reference in ${file}: ${needle}`);
      failed = true;
    }
  }
}
if (fs.existsSync('package-lock.json')) {
  JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
}
if (failed) process.exit(1);
console.log('NPM PUBLIC REGISTRY GUARD PASSED');
