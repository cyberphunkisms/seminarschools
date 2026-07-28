#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SITE='https://seminarschools.com';
const {ROUTES,buildRoutePage}=require('./polymythcal-route-shell');
const rels=Object.keys(ROUTES);
const expectedModes={
  writingclub:'apply',
  writingkids:'apply',
  writingjuniors:'apply',
  writingteens:'apply',
  writinggrads:'apply',
  university:'both',
  philosophy:'both',
  humanities:'both',
  cfps:'apply',
  lectures:'attend',
  fellowships:'apply'
};
const titles=[];
const failures=[];

function metaContent(html,attr,name){
  const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const tag=html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${escaped}["'])[^>]*>`,'i'))?.[0]||'';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]||'';
}

for(const dir of rels){
  const full=path.join(ROOT,dir,'index.html');
  if(!fs.existsSync(full)){
    failures.push(`${dir}/index.html missing`);
    continue;
  }
  const html=fs.readFileSync(full,'utf8');
  const match=html.match(/<title>([\s\S]*?)<\/title>/i);
  if(!match) failures.push(`${dir} lacks title`);
  else titles.push([dir,match[1].replace(/\s+/g,' ').trim()]);
}

const seen=new Map();
for(const [dir,title] of titles){
  if(seen.has(title)) failures.push(`${dir} duplicates title with ${seen.get(title)}: ${title}`);
  seen.set(title,dir);
  if(/^Polymythcal \| Seminar Schools$/i.test(title)) failures.push(`${dir} still has generic Polymythcal title`);
}

const shell=fs.readFileSync(path.join(ROOT,'scripts','polymythcal-route-shell.js'),'utf8');
if(!/const title=`\$\{cfg\.heading\} \| Polymythcal \| Seminar Schools`/.test(shell)||!shell.includes("replaceMeta(html,'title',title)")) failures.push('polymythcal-route-shell.js lacks centralized title generation logic');
for(const script of ['build-writing-shortcuts.js','build-academic-shortcuts.js']){
  const js=fs.readFileSync(path.join(ROOT,'scripts',script),'utf8');
  if(!js.includes("require('./polymythcal-route-shell')")) failures.push(`${script} does not delegate to centralized route generation`);
}

const payload=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars','events.json'),'utf8'));
for(const [slug,cfg] of Object.entries(ROUTES)){
  const html=buildRoutePage(slug,payload);
  const title=`${cfg.heading} | Polymythcal | Seminar Schools`;
  const url=`${SITE}/${slug}/`;
  if(cfg.defaultContent!==expectedModes[slug]) failures.push(`${slug}: expected ${expectedModes[slug]} content mode, found ${cfg.defaultContent}`);
  if(!html.includes(`data-pm-route="${slug}" data-pm-default-content="${cfg.defaultContent}"`)) failures.push(`${slug}: focused route defaults are missing from the body`);
  if(metaContent(html,'property','og:url')!==url) failures.push(`${slug}: focused Open Graph URL was not generated`);
  if(metaContent(html,'property','og:title')!==title) failures.push(`${slug}: focused Open Graph title was not generated`);
  if(metaContent(html,'property','og:description')!==cfg.description) failures.push(`${slug}: focused Open Graph description was not generated`);
  if(/\bdata-preset=/.test(html)) failures.push(`${slug}: generic quick-start presets remain on a focused route`);
  if(!html.includes('Other focused calendars')) failures.push(`${slug}: focused-route navigation is missing`);

  const hasChooser=html.includes('id="pmLookingForTitle"');
  const hasAttendTypes=html.includes('<legend class="pm-legend">Events to attend</legend>');
  const hasApplyTypes=html.includes('<legend class="pm-legend">Opportunities to apply for</legend>');
  if(cfg.defaultContent==='both'){
    if(!hasChooser || !hasAttendTypes || !hasApplyTypes) failures.push(`${slug}: mixed-content filters are incomplete`);
  }else{
    if(hasChooser || /\bdata-state-set=["']content["']/.test(html)) failures.push(`${slug}: single-content route still exposes the content-mode chooser`);
    if(cfg.defaultContent==='apply' && (hasAttendTypes || !hasApplyTypes)) failures.push(`${slug}: apply-only route exposes the wrong type facets`);
    if(cfg.defaultContent==='attend' && (!hasAttendTypes || hasApplyTypes)) failures.push(`${slug}: attend-only route exposes the wrong type facets`);
  }
}

if(failures.length){
  console.error('SHORTCUT TITLE UNIQUENESS FAILED');
  failures.forEach(failure=>console.error(' - '+failure));
  process.exit(1);
}
console.log(`SHORTCUT TITLE UNIQUENESS PASSED — ${titles.length} shortcut titles are unique and ${rels.length} focused route shells passed metadata/filter checks.`);
