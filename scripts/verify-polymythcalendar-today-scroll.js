#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');const failures=[];
const routes=['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
const app=fs.readFileSync(path.join(ROOT,'js/polymythcal-revamp.js'),'utf8');
if(!app.includes('CALENDAR_TIME_ZONE = "America/Toronto"')) failures.push('shared calendar application lacks Toronto timezone contract');
if(!app.includes('state.time === "upcoming"')) failures.push('shared calendar application lacks upcoming time window');
if(!app.includes('function chronologicalDate(event)')) failures.push('shared calendar application lacks soonest/ongoing chronology');
if(!app.includes('function routeMatches(event)')) failures.push('shared calendar application lacks dedicated route restriction');
for(const route of routes){
 const rel=`${route}/index.html`;const html=fs.readFileSync(path.join(ROOT,rel),'utf8');
 if(!html.includes('name="pm-time"')||!html.includes('value="upcoming"')) failures.push(`${rel}: missing Upcoming default`);
 if(!html.includes('<option value="soonest">Soonest first</option>')) failures.push(`${rel}: missing soonest-first sorting`);
 if(!html.includes('id="pmEventList"')||!html.includes('/js/polymythcal-revamp.js')) failures.push(`${rel}: missing shared lightweight result shell`);
 if(html.includes('id="eventsScroll"')||html.includes('today-anchor')||html.includes('scheduleScrollToToday')) failures.push(`${rel}: legacy auto-scroll model remains`);
}
if(failures.length){console.error('POLYMYTHCALENDAR TODAY/UPCOMING CHECK FAILED');failures.forEach(f=>console.error(' - '+f));process.exit(1);}
console.log(`POLYMYTHCALENDAR TODAY/UPCOMING CHECK PASSED — ${routes.length} calendar entry pages start with Toronto-aware upcoming, soonest-first results and no legacy auto-scroll wall.`);
