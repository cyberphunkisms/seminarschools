#!/usr/bin/env node
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
const publicText=read('polymythseminars/events.json');
const masterText=read('data/polymyth-seminar-events.json');
const pub=JSON.parse(publicText), master=JSON.parse(masterText);
const fail=[];
if(publicText!==masterText) fail.push('Public event file and data master are not byte-identical.');
if(!Array.isArray(pub.events)) fail.push('Public event file lacks events array.');
if(pub.count!==pub.events.length || pub._total_events!==pub.events.length) fail.push(`Event totals disagree: declared ${pub.count}/${pub._total_events}, actual ${pub.events.length}.`);
const html=read('polymythseminars/index.html');
const m=html.match(/<script id="events-fallback" type="application\/json">([\s\S]*?)<\/script>/);
if(!m) fail.push('Calendar fallback data block is missing.');
else {
  let fallback;
  try{fallback=JSON.parse(m[1]);}catch(e){fail.push(`Calendar fallback JSON is malformed: ${e.message}`)}
  if(fallback){
    const ids=a=>a.map(x=>x.id).sort().join('|');
    if((fallback.count||0)!==pub.events.length || (fallback._total_events||0)!==pub.events.length) fail.push('Fallback totals do not match public event file.');
    if(!Array.isArray(fallback.events) || ids(fallback.events)!==ids(pub.events)) fail.push('Fallback event IDs do not match public event file.');
  }
}
if(fail.length){ console.error('CALENDAR DATA PARITY FAILED\n- '+fail.join('\n- ')); process.exit(1); }
console.log(`CALENDAR DATA PARITY OK — ${pub.events.length} mirrored entries.`);
