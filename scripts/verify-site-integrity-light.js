#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const required = [
  'index.html','main/index.html','saul/index.html','agora/index.html','polymythseminars/index.html',
  'css/alive.css','css/theme.css','js/indra.js','js/mandala.js','sitemap.xml','robots.txt','netlify.toml'
];
const errors=[];
for (const rel of required) if (!fs.existsSync(path.join(ROOT, rel))) errors.push(`missing ${rel}`);
const pages = ['index.html','main/index.html','saul/index.html','agora/index.html','polymythseminars/index.html','writingjuniors/index.html'];
for (const rel of pages) {
  const html = fs.readFileSync(path.join(ROOT, rel),'utf8');
  if (!/data-geometry="indra-web"/.test(html)) errors.push(`${rel}: missing geometry marker`);
  if (!/\/js\/indra\.js/.test(html)) errors.push(`${rel}: missing indra.js`);
  if (!/\/css\/alive\.css/.test(html)) errors.push(`${rel}: missing alive.css`);
}
if (errors.length) { console.error('SITE INTEGRITY LIGHT CHECK FAILED'); errors.forEach(e=>console.error(' - '+e)); process.exit(1); }
console.log('SITE INTEGRITY LIGHT CHECK PASSED — core routes, sitemap, assets, and geometry hooks are present.');
