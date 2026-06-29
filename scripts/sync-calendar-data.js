#!/usr/bin/env node
/*
 * Keeps the public polymythcalendar data file, its internal mirror, and the
 * offline HTML fallback byte-for-byte aligned. Run after any direct manual
 * calendar edit as well as after harvest merges.
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const PUBLIC=path.join(ROOT,'polymythseminars','events.json');
const MASTER=path.join(ROOT,'data','polymyth-seminar-events.json');
const CALENDAR=path.join(ROOT,'polymythseminars','index.html');
const MAIN=path.join(ROOT,'main','index.html');
const DAY=new Date().toISOString().slice(0,10).replaceAll('-','');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
let data=JSON.parse(read(PUBLIC));
if(!Array.isArray(data.events)) throw new Error('polymythcalendar events.json must contain an events array');
data.count=data.events.length;
data._total_events=data.events.length;
data._comment='Consolidated polymythcalendar events. Auto-written after harvests and verified manual additions. Drives /polymythseminars/ page.';
const text=JSON.stringify(data,null,2)+'\n';
write(PUBLIC,text); write(MASTER,text);
let html=read(CALENDAR);
const fallback={
  _comment:'Inline fallback snapshot. Auto-refreshed from /polymythseminars/events.json.',
  _generated_at:data._generated_at || new Date().toISOString(),
  _total_events:data.events.length,
  events:data.events,
  count:data.events.length
};
const encoded=JSON.stringify(fallback).replace(/<\//g,'<\\/');
const fallbackPattern=/(<script id="events-fallback" type="application\/json">).*?(<\/script>)/s;
if(!fallbackPattern.test(html)) throw new Error('events-fallback injection point is missing');
html=html.replace(fallbackPattern,(_,a,b)=>a+encoded+b);
html=html.replace(/events\.json\?v=\d+/g,`events.json?v=${DAY}`);
write(CALENDAR,html);
if(fs.existsSync(MAIN)) write(MAIN,read(MAIN).replace(/events\.json\?v=\d+/g,`events.json?v=${DAY}`));
console.log(`CALENDAR DATA SYNC — ${data.events.length} events, fallback and mirror refreshed.`);
