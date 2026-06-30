#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const POLY_ROUTES = ['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
let errors = [];
let warnings = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function allFiles(dir, out=[]){
  for (const name of fs.readdirSync(dir)){
    if (['.git','node_modules','.netlify'].includes(name)) continue;
    const p=path.join(dir,name); const st=fs.statSync(p);
    if (st.isDirectory()) allFiles(p,out); else out.push(p);
  }
  return out;
}
for (const route of POLY_ROUTES){
  const rel = `${route}/index.html`;
  if (!exists(rel)){ errors.push(`missing ${rel}`); continue; }
  const html = read(rel);
  if (!/<h1>\s*Polymythcal\s*<\/h1>/.test(html)) errors.push(`${rel} visible h1 is not stable Polymythcal`);
  if (!/id="polymythContext"/.test(html) || !/id="polymythDescription"/.test(html)) errors.push(`${rel} missing context/description fields`);
  if (!/id="quickGuideCopy"/.test(html) || !/Open a title to reach the official source|Open a title for the official source/.test(html)) errors.push(`${rel} missing plain-language use guide`);
  if (/onclick="/.test(html)) errors.push(`${rel} contains inline onclick handler`);
  if (/document\.title/.test(html)) errors.push(`${rel} mutates document.title`);
  if (/scheduleScrollToToday\('auto'\);\s*}\s*}\s*function dispatchRender/.test(html)) errors.push(`${rel} still anchors on every dispatchRender`);
  if (!/function dispatchRender\(opts\)/.test(html)) errors.push(`${rel} dispatchRender does not preserve scroll state`);
}
const rootFiles = fs.readdirSync(ROOT);
for (const junk of rootFiles){
  if (junk === ']]' || junk.startsWith('= git status') || junk.startsWith('ersuserDocumentsGitHub') || junk.startsWith('till failed')) errors.push(`junk paste artifact remains at repo root: ${junk}`);
}
const files = allFiles(ROOT).filter(p=>/\.(html|js)$/i.test(p));
let hrefHash=0, preventDefault=0, scrollCalls=0, javascriptHref=0;
for (const p of files){
  const rel = path.relative(ROOT,p).replace(/\\/g,'/');
  const s = fs.readFileSync(p,'utf8');
  if (/href=["']javascript:/i.test(s)) { javascriptHref++; errors.push(`${rel} has javascript: href`); }
  if (/href=["']#["']/i.test(s)) hrefHash++;
  if (/preventDefault\(/.test(s)) preventDefault++;
  if (/\bscroll(?:To|IntoView)\s*\(/.test(s)) scrollCalls++;
}
if (hrefHash > 12) warnings.push(`${hrefHash} bare hash links found; current allowance is 12 for legacy interactive shells.`);
if (scrollCalls > 30) warnings.push(`${scrollCalls} scroll calls found; current allowance is 30 after Polymythcal de-jank.`);
if (errors.length){
  console.error('SITE INTERACTIVITY CHECK FAILED');
  errors.forEach(e=>console.error(' - '+e));
  if (warnings.length) warnings.forEach(w=>console.warn('WARN '+w));
  process.exit(1);
}
console.log(`SITE INTERACTIVITY CHECK PASSED — ${POLY_ROUTES.length} Polymythcal pages keep a stable title, clear context/guide text, no inline click handlers, and no filter-click re-anchoring. Site scan: ${files.length} HTML/JS files, ${preventDefault} intentional preventDefault handlers, ${scrollCalls} scroll helpers, ${hrefHash} bare hash links, ${javascriptHref} javascript hrefs.`);
if (warnings.length) warnings.forEach(w=>console.warn('WARN '+w));
