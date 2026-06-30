#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules','.git','.netlify']);
function walk(dir, out=[]){
  for (const ent of fs.readdirSync(dir, { withFileTypes:true })){
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile() && ent.name.endsWith('.html')) out.push(full);
  }
  return out;
}
function rel(file){ return path.relative(ROOT, file).replace(/\\/g,'/'); }
function intensityFor(r){
  if (/^polymythseminars\//.test(r) || r === 'polymythseminars/index.html') return '0.120';
  if (/^(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\//.test(r)) return '0.110';
  if (/^saul\//.test(r)) return '0.085';
  if (/^teacherresources\//.test(r)) return '0.070';
  return '0.075';
}
function ensureHead(html){
  if (!/\/css\/alive\.css/i.test(html)) {
    html = html.replace(/<\/head>/i, '<link rel="stylesheet" href="/css/alive.css?v=cl91">\n</head>');
  }
  return html;
}
function ensureBody(html, intensity){
  return html.replace(/<body\b([^>]*)>/i, (m, attrs) => {
    let a = attrs || '';
    if (!/data-geometry\s*=/.test(a)) a += ' data-geometry="indra-web"';
    else a = a.replace(/data-geometry\s*=\s*(['"])[\s\S]*?\1/, 'data-geometry="indra-web"');
    if (!/data-indra-intensity\s*=/.test(a)) a += ` data-indra-intensity="${intensity}"`;
    else a = a.replace(/data-indra-intensity\s*=\s*(['"])[\s\S]*?\1/, `data-indra-intensity="${intensity}"`);
    return `<body${a}>`;
  });
}
function ensureScripts(html){
  const hasMandala = /\/js\/mandala\.js/i.test(html);
  const hasIndra = /\/js\/indra\.js/i.test(html);
  let inject = '';
  if (!hasMandala) inject += '<script src="/js/mandala.js?v=cl91" defer></script>\n';
  if (!hasIndra) inject += '<script src="/js/indra.js?v=cl91" defer></script>\n';
  if (inject) html = html.replace(/<\/body>/i, inject + '</body>');
  return html;
}
let changed=0;
for (const file of walk(ROOT)){
  const r = rel(file);
  let html = fs.readFileSync(file,'utf8');
  const old = html;
  html = ensureHead(html);
  html = ensureBody(html, intensityFor(r));
  html = ensureScripts(html);
  if (html !== old){ fs.writeFileSync(file, html, 'utf8'); changed++; }
}
// CV pages keep geometry during reading; print CSS hides ornamentation instead.
const indra = path.join(ROOT, 'js', 'indra.js');
if (fs.existsSync(indra)){
  let js = fs.readFileSync(indra,'utf8');
  const old = js;
  js = js.replace(/if\s*\([^\n]*printCv[^\n]*\)\s*return;?/g, '');
  if (js !== old){ fs.writeFileSync(indra, js, 'utf8'); changed++; }
}
console.log(`VISIBLE GEOMETRY APPLY — ${changed} files updated.`);
