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
  'Selected experience',
  'Current focus',
  'Places behind the work',
  'Work record',
  'Combine focus areas',
  'Download professional PDF',
  'Use the webpage for the visual record. Download a monochrome PDF for applications.'
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

requireHas('bb/index.html', [
  'Run a burrow with wormcards.',
  'AI-assisted BB is the priority workflow.',
  'Let time matter.'
]);
requireNotVisible('bb/index.html', [
  'Future DM table assistant',
  'This future tool starts',
  'coming soon: DM assistant mode',
  'setupnpcs',
  'improvnpcs',
  'AI helps behind the curtain',
  'memory clerk',
  'give a shit',
  'shitty teachers',
  'fucking motivation',
  'shit work',
  'AI explaining to AI',
  'bootstrap this file'
]);
requireHas('bookwormcard/about/index.html', [
  'teacher manual workflow',
  'AI-assisted BB is the priority workflow',
  'open the BB plain-text manual'
]);
requireNotVisible('bookwormcard/about/index.html', [
  'copy bootstrap',
  'DM table assistant',
  'first ask me for the wormcards',
  'setupnpcs',
  'improvnpcs',
  'AI helps behind the curtain'
]);
requireNotVisible('bookwormcard/index.html', [
  'AI chat running the table',
  'AI function',
  'AI reaction layer',
  'may use AI behind the curtain'
]);
requireHas('polymyth/dmboard/index.html', [
  'The priority AI-assisted workflow for opening a burrow with wormcards',
  'teacher as human mediator',
  'Paper or document play remains available' 
]);
requireNotVisible('polymyth/dmboard/index.html', [
  'SCAFFOLDING STUB',
  'Saul-authored content pending',
  'AI-side of the DM',
  'DM-AI scene-creation interaction surface',
  'pending Saul-authorship'
]);
const ml = read('polymyth/methodologylist.txt');
if(!ml.includes('Front-facing versus operator-to-AI instruction separation')) {
  errors.push('ml*: front-facing vs AI instruction boundary rule missing.');
}
if(!ml.includes('Treating operator command language as front-facing copy')) {
  errors.push('ml*: worked-example anti-twist text missing.');
}
if(!ml.includes('Surface translation firewall')) {
  errors.push('ml*: hardened surface translation firewall missing.');
}
if(!ml.includes('BB helps committed teachers turn class reading into a living world')) {
  errors.push('ml*: canonical BB public translation example missing.');
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
  'operator-to-AI instruction',
  'Future DM table assistant',
  'This future tool starts',
  'coming soon: DM assistant mode',
  'AI chat running the table',
  'AI function',
  'AI reaction layer',
  'copy bootstrap',
  'AI helps behind the curtain',
  'SCAFFOLDING STUB',
  'Saul-authored content pending',
  'AI-side of the DM',
  'give a shit',
  'shitty teachers',
  'fucking motivation',
  'shit work',
  'AI explaining to AI',
  'bootstrap this file'
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
