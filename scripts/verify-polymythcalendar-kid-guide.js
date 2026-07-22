#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');
const ROUTES=['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];const failures=[];
for(const route of ROUTES){
 const rel=`${route}/index.html`;const file=path.join(ROOT,rel);if(!fs.existsSync(file)){failures.push(`${rel}: missing file`);continue;}
 const html=fs.readFileSync(file,'utf8');
 for(const needle of ['Search the calendar','Choose events, opportunities, or both.','The listed date is the deadline.','Choose any number of areas.','Open a title for the stable Polymythcal page.','Missing times and locations stay visible as pending details.','aria-describedby="quickGuideCopy"','id="quickGuideCopy"']) if(!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
 if(route!=='polymythseminars'){
  if(!html.includes('class="pm-route-context')) failures.push(`${rel}: missing route-specific plain-language context`);
  if(!html.includes('Every filter below still works inside this view.')) failures.push(`${rel}: missing route filter guidance`);
  if(!html.includes('Browse all Polymythcal listings')) failures.push(`${rel}: missing route escape path`);
 }
}
if(failures.length){console.error('POLYMYTHCALENDAR GUIDE CHECK FAILED');failures.forEach(f=>console.error(' - '+f));process.exit(1);}
console.log(`POLYMYTHCALENDAR GUIDE CHECK PASSED — clear plain-language guidance is present on all ${ROUTES.length} calendar entry pages.`);
