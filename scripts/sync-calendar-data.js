#!/usr/bin/env node
'use strict';
/** Keep canonical/public Polymythcal JSON mirrors aligned across both legacy and client-shell pages. */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const PUBLIC=path.join(ROOT,'polymythseminars','events.json');
const MASTER=path.join(ROOT,'data','polymyth-seminar-events.json');
const WATCHLIST_DATA=path.join(ROOT,'data','event-watchlist.json');
const WATCHLIST_PUBLIC=path.join(ROOT,'polymythseminars','watchlist.json');
const CALENDAR=path.join(ROOT,'polymythseminars','index.html');
function read(p){return fs.readFileSync(p,'utf8');}
function writeIfChanged(p,s){const old=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';if(old===s)return false;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);return true;}
const data=JSON.parse(read(PUBLIC));
if(!Array.isArray(data.events)) throw new Error('polymythcalendar events.json must contain an events array');
data.count=data.events.length;
data._total_events=data.events.length;
data._comment='Consolidated Polymythcal events. Auto-written after harvests and verified manual additions. Drives /polymythseminars/.';
const text=JSON.stringify(data,null,2)+'\n';
let writes=Number(writeIfChanged(PUBLIC,text))+Number(writeIfChanged(MASTER,text));
let watchlist={generated_at:data._generated_at||null,count:0,rule:'watchlist only: not published as calendar events until time/place is confirmed',items:[]};
if(fs.existsSync(WATCHLIST_DATA)){
  watchlist=JSON.parse(read(WATCHLIST_DATA));
  if(!Array.isArray(watchlist.items)) watchlist.items=[];
  watchlist.count=watchlist.items.length;
}
writes+=Number(writeIfChanged(WATCHLIST_PUBLIC,JSON.stringify(watchlist,null,2)+'\n'));
if(!fs.existsSync(CALENDAR)) throw new Error('Polymythcal calendar shell is missing');
let html=read(CALENDAR);
const eventPattern=/(<script id="events-fallback" type="application\/json">).*?(<\/script>)/s;
const watchPattern=/(<script id="watchlist-fallback" type="application\/json">).*?(<\/script>)/s;
if(eventPattern.test(html)){
  const fallback={_comment:'Inline fallback snapshot. Auto-refreshed from /polymythseminars/events.json.',_generated_at:data._generated_at||null,_total_events:data.events.length,count:data.events.length,events:data.events};
  html=html.replace(eventPattern,(_,a,b)=>a+JSON.stringify(fallback).replace(/<\//g,'<\\/')+b);
}
if(watchPattern.test(html)) html=html.replace(watchPattern,(_,a,b)=>a+JSON.stringify(watchlist).replace(/<\//g,'<\\/')+b);
if(!eventPattern.test(html) && !html.includes('id="pmEventList"')) throw new Error('Calendar page has neither a legacy fallback injection point nor the client-shell event mount');
if(!eventPattern.test(html) && !html.includes('/js/polymythcal-revamp.js')) throw new Error('Client-shell calendar is missing its data-loading application');
writes+=Number(writeIfChanged(CALENDAR,html));
console.log(`CALENDAR DATA SYNC — ${data.events.length} events, ${watchlist.items.length} watchlist leads, ${writes} files updated; ${eventPattern.test(html)?'legacy fallback refreshed':'client shell validated'}.`);
