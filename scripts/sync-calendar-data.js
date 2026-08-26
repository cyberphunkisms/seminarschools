#!/usr/bin/env node
'use strict';
/** Keep canonical/public Polymythcal JSON mirrors aligned across both legacy and client-shell pages. */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const PUBLIC=path.join(ROOT,'polymythseminars','events.json');
const MASTER=path.join(ROOT,'data','polymyth-seminar-events.json');
const CALENDAR=path.join(ROOT,'polymythseminars','index.html');
function read(p){return fs.readFileSync(p,'utf8');}
function writeIfChanged(p,s){const old=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';if(old===s)return false;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);return true;}
const data=JSON.parse(read(MASTER));
if(!Array.isArray(data.events)) throw new Error('polymythcalendar events.json must contain an events array');
if(data.count!==data.events.length || data._total_events!==data.events.length) {
  throw new Error('Canonical Polymythcal inventory metadata does not match its events array');
}
// This is a private, build-only compatibility mirror. Copy the canonical bytes
// verbatim so legacy generators cannot observe a subtly different document.
const text=read(MASTER);
let writes=Number(writeIfChanged(PUBLIC,text));
if(!fs.existsSync(CALENDAR)) throw new Error('Polymythcal calendar shell is missing');
let html=read(CALENDAR);
const eventPattern=/(<script id="events-fallback" type="application\/json">).*?(<\/script>)/s;
const watchPattern=/(<script id="watchlist-fallback" type="application\/json">).*?(<\/script>)/s;
if(eventPattern.test(html) || watchPattern.test(html)) {
  throw new Error('Legacy inline calendar fallbacks would expose the editorial corpus; regenerate the client shell.');
}
const hasLegacyMount=html.includes('id="pmEventList"') && html.includes('/js/polymythcal-revamp.js');
const hasDiscoveryMount=html.includes('id="pmdList"') && html.includes('/js/polymythcal-discovery.js');
if(!eventPattern.test(html) && !hasLegacyMount && !hasDiscoveryMount) {
  throw new Error('Calendar page has neither a legacy fallback injection point nor a supported discovery-shell mount');
}
writes+=Number(writeIfChanged(CALENDAR,html));
console.log(`CALENDAR DATA SYNC — ${data.events.length} canonical records mirrored for build-only generators; ${writes} files updated; client shell validated.`);
