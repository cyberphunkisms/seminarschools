#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');
const {ROUTES: ROUTE_CONFIG}=require('./polymythcal-route-shell.js');
const ROUTES=['polymythseminars',...Object.keys(ROUTE_CONFIG)];const failures=[];
for(const route of ROUTES){
 const rel=`${route}/index.html`;const file=path.join(ROOT,rel);if(!fs.existsSync(file)){failures.push(`${rel}: missing file`);continue;}
 const html=fs.readFileSync(file,'utf8');
 for(const needle of ['Search the calendar','Choose any number.','Open a title for details, the official source, calendar download, and corrections.','Saved items stay on this device.','aria-describedby="quickGuideCopy"','id="quickGuideCopy"']) if(!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
 const mode=route==='polymythseminars'?'both':ROUTE_CONFIG[route].defaultContent;
 if(mode==='both'){
  for(const needle of ['Choose one or both.','The date shown is when applications close.']) if(!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
 } else {
  const needle=mode==='apply'?'Choose one or more opportunity types.':'Choose one or more event types.';
  if(!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  if(html.includes('id="pmLookingForTitle"')) failures.push(`${rel}: retains a redundant content-mode chooser`);
 }
 if(route!=='polymythseminars'){
  if(!html.includes('class="pm-route-context')) failures.push(`${rel}: missing route-specific plain-language context`);
  if(!html.includes('is selected. Use the filters below')) failures.push(`${rel}: missing route filter guidance`);
  if(!html.includes('browse every listing')) failures.push(`${rel}: missing route escape path`);
 }
}
if(failures.length){console.error('POLYMYTHCALENDAR GUIDE CHECK FAILED');failures.forEach(f=>console.error(' - '+f));process.exit(1);}
console.log(`POLYMYTHCALENDAR GUIDE CHECK PASSED — concise plain-language guidance is present on all ${ROUTES.length} calendar entry pages.`);
