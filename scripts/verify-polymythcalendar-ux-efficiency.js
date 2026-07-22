#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');const errors=[];
const main=fs.readFileSync(path.join(ROOT,'polymythseminars/index.html'),'utf8');const app=fs.readFileSync(path.join(ROOT,'js/polymythcal-revamp.js'),'utf8');const css=fs.readFileSync(path.join(ROOT,'css/polymythcal-revamp.css'),'utf8');
for(const [name,needle,where] of [
 ['plain-language search guidance','Search accepts English, French, accents, and close spellings',main],['active filter panel','id="pmActivePanel"',main],['paginated list control','id="pmLoadMore"',main],['calendar view mount','id="pmCalendar"',main],['mobile filter controls','id="pmMobileBar"',main],['geometry mandala','/js/mandala.js',main],['geometry indra','/js/indra.js',main],['alive surface','/css/alive.css',main],['dynamic event descriptions','event.description',app],['50-item initial pagination','const PAGE_SIZE = 50',app],['calendar month navigation','data-calendar-nav',app],['mobile agenda rendering','pm-agenda-day',app],['URL-backed state','history.replaceState',app],['conditional event-data revalidation','cache: "no-cache"',app],['route restriction','function routeMatches(event)',app],['route-aware facets','allEvents.filter(routeMatches)',app],['content visibility for event cards','content-visibility: auto',css],['route context design','.pm-route-context',css]
]) if(!where.includes(needle)) errors.push(`shared Polymythcal missing ${name}`);
if(Buffer.byteLength(main,'utf8')>=100000) errors.push('main Polymythcal client shell exceeds 100 KB');
if(main.includes('id="eventsContainer"')||main.includes('id="events-fallback"')) errors.push('main Polymythcal regressed to embedded full-corpus markup');
const routes={writingclub:'apply',writingkids:'apply',writingjuniors:'apply',writingteens:'apply',writinggrads:'apply',university:'both',philosophy:'both',humanities:'both',cfps:'apply',lectures:'attend',fellowships:'apply'};
for(const [route,mode] of Object.entries(routes)){
 const rel=`${route}/index.html`;const html=fs.readFileSync(path.join(ROOT,rel),'utf8');
 if(Buffer.byteLength(html,'utf8')>=100000) errors.push(`${rel} exceeds 100 KB`);
 for(const [name,needle] of [['route identity',`data-pm-route="${route}"`],['route default',`data-pm-default-content="${mode}"`],['shared result mount','id="pmEventList"'],['shared app','/js/polymythcal-revamp.js'],['shared CSS','/css/polymythcal-revamp.css'],['route context','class="pm-route-context'],['filter escape path','Browse all Polymythcal listings'],['no-script current results','class="pm-noscript pm-panel"'],['calendar view mount','id="pmCalendar"'],['saved-state dialog','class="pm-saved-dialog" id="pmSavedPanel"'],['mobile filter controls','id="pmMobileBar"']]) if(!html.includes(needle)) errors.push(`${rel} missing ${name}`);
 if(/eventsContainer|quickFocusNav|watchlistPanel|calendarSearch|data-focus="deadlines"/.test(html)) errors.push(`${rel} retains legacy controls`);
}
const pkg=fs.readFileSync(path.join(ROOT,'package.json'),'utf8');if(!pkg.includes('verify-polymythcalendar-ux-efficiency.js')) errors.push('package verify:all does not include UX efficiency guard');
if(errors.length){console.error('POLYMYTHCALENDAR UX/EFFICIENCY CHECK FAILED');errors.forEach(e=>console.error(' - '+e));process.exit(1);}
console.log(`POLYMYTHCALENDAR UX/EFFICIENCY CHECK PASSED — one lightweight shared application powers the main calendar and ${Object.keys(routes).length} route-restricted entry pages.`);
