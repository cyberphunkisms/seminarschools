#!/usr/bin/env node
// Refuses to let a broken calendar ship. Run from repo root. Exit 1 = DO NOT DEPLOY.
const fs=require('fs');
let fail=0;
function check(name,ok){ console.log((ok?'PASS':'FAIL')+'  '+name); if(!ok)fail=1; }
let cal=''; try{ cal=fs.readFileSync('polymythseminars/index.html','utf8'); }catch(e){}
check('calendar page exists', cal.length>1000);
let embOk=false; try{ const m=cal.match(/<script id="events-fallback" type="application\/json">([\s\S]*?)<\/script>/); embOk = !!m && (JSON.parse(m[1]).events||[]).length>=200; }catch(e){}
check('calendar embeds a 200+ event snapshot fallback', embOk);
check('calendar wraps titles in source_url links', cal.includes('source_url') && cal.includes('target="_blank"'));
check('calendar carries build stamp', /build 20\d{6}/.test(cal));
let data=null; try{ data=JSON.parse(fs.readFileSync('data/polymyth-seminar-events.json','utf8')); }catch(e){}
check('event data file parses', !!data);
check('data file has 200+ events', !!data && (data.events||[]).length>=200);
let feed=''; try{ feed=fs.readFileSync('polymythseminars/feed.xml','utf8'); }catch(e){}
check('rss feed present with items', feed.includes('<item>'));
let home=''; try{ home=fs.readFileSync('index.html','utf8'); }catch(e){}
check('homepage fetches the public events file', home.includes("'/polymythseminars/events.json"));
check('homepage wraps titles in source_url links', home.includes('source_url'));
let pub=null; try{ pub=JSON.parse(fs.readFileSync('polymythseminars/events.json','utf8')); }catch(e){}
check('PUBLIC events copy exists at /polymythseminars/events.json', !!pub);
check('public copy has 200+ events', !!pub && (pub.events||[]).length>=200);
try{
  const a=fs.readFileSync('polymythseminars/events.json'), b=fs.readFileSync('data/polymyth-seminar-events.json');
  check('public copy byte-identical to data/ master', a.equals(b));
}catch(e){ check('public copy byte-identical to data/ master', false); }
check('calendar primary fetch targets the PUBLIC path', cal.includes("'/polymythseminars/events.json"));
check('homepage uses the fallback loader', home.includes('fetchEventsWithFallback'));
let ntl=''; try{ ntl=fs.readFileSync('netlify.toml','utf8'); }catch(e){}
check('netlify still blocks /data/* (PM35 guard)', ntl.includes('from = "/data/*"'));
let robot=null; try{ robot=JSON.parse(fs.readFileSync('seminars/events.json','utf8')); }catch(e){}
check('robot fallback file parses', !!robot && (robot.events||[]).length>0);
if(fail){ console.error('\nBLOCKED: calendar-critical files are broken. DO NOT PUSH.'); process.exit(1); }
console.log('\nALL CRITICAL CHECKS PASS — safe to deploy.');
