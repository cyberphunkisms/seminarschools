#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const errors = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function visible(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, '’')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function requireHas(rel, tokens){
  const text = visible(read(rel));
  tokens.forEach(t => { if(!text.includes(t)) errors.push(`${rel}: missing front-facing label "${t}"`); });
}
function requireNotVisible(rel, tokens){
  const text = visible(read(rel));
  tokens.forEach(t => { if(text.includes(t)) errors.push(`${rel}: internal/admin phrase visible: "${t}"`); });
}
requireHas('saul/index.html', [
  'Curriculum vitae',
  'Work record across service, education, community, and projects.',
  'Relevant experience',
  'Focus areas',
  'Places behind the work',
  'Work record',
  'Focus filters',
  'Download current CV'
]);
requireNotVisible('saul/index.html', [
  'CV builder',
  'Select the version you need',
  'CV modules',
  'PDF follows active',
  'active modules',
  'Build modular CV',
  'Save selected CV',
  'World map'
]);
requireNotVisible('campaigns/thank-you-mam/pregame/index.html', [
  'Mephistodata-built',
  'Live build target',
  'Send corrections to Rainbowsol'
]);
const ml = read('polymyth/methodologylist.txt');
if(!ml.includes('Front-facing versus operator-to-AI instruction separation')) {
  errors.push('ml*: front-facing vs AI instruction boundary rule missing.');
}
if(!ml.includes('Treating operator command language as front-facing copy')) {
  errors.push('ml*: worked-example anti-twist text missing.');
}
// Public-page scan. Star/internal framework surfaces are deliberately excluded:
// aa*, bb*, bookwormcard*, ml*/polymyth*, dashboard/meaninglib, hf_export, and AITR.
const excludedPrefixes = [
  'polymyth/', 'aa/', 'bb/', 'bookwormcard/', 'aitr/', 'dashboard/', 'hf_export/'
];
const forbidden = [
  'CV builder',
  'Select the version you need',
  'CV modules — PDF follows active modules',
  'CV modules',
  'Build modular CV',
  'Save selected CV',
  'World map',
  'static collection page',
  'Browse English Language Arts as a static',
  'Resources Resources for Teachers',
  'Teaching Resources Teaching Resources',
  'Thank You Ma’am Teaching Activities',
  "Thank You M'am Teaching Activities",
  'Mephistodata-built',
  'Live build target',
  'Send corrections to Rainbowsol',
  'route is a working tool',
  'Front-facing versus operator-to-AI',
  'operator-to-AI instruction'
];
function walk(dir){
  for(const ent of fs.readdirSync(path.join(ROOT, dir), {withFileTypes:true})){
    const rel = path.posix.join(dir, ent.name);
    if(rel === 'node_modules' || rel === 'public') continue;
    if(excludedPrefixes.some(x => rel.startsWith(x))) continue;
    if(ent.isDirectory()) walk(rel);
    else if(ent.isFile() && ent.name.endsWith('.html')){
      const text = visible(read(rel));
      forbidden.forEach(t => { if(text.includes(t)) errors.push(`${rel}: internal/admin phrase visible: ${t}`); });
    }
  }
}
walk('.');
const resourcesHtml = read('teacherresources/index.html');
if(resourcesHtml.includes('"id":"lang-hughes"')) errors.push('teacherresources: retired Thank You Ma’am standalone group still present in resources-data.');
if(exists('teacherresources/lang-hughes/index.html')) errors.push('teacherresources: retired /teacherresources/lang-hughes/ page still exists.');
if(read('sitemap.xml').includes('/teacherresources/lang-hughes/')) errors.push('sitemap: retired /teacherresources/lang-hughes/ URLs still listed.');
if(!read('_redirects').includes('/teacherresources/lang-hughes/* /teacherresources/ 301')) errors.push('_redirects: retired Thank You Ma’am resource route lacks redirect.');
if(errors.length){
  console.error('FRONT-FACING BOUNDARY CHECK FAILED');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('FRONT-FACING BOUNDARY CHECK PASSED — public pages audited outside star/internal routes.');
