#!/usr/bin/env node
// Refuses to let a broken calendar ship. Run from repo root. Exit 1 = DO NOT DEPLOY.
const fs=require('fs');
let fail=0;
function check(name,ok){ console.log((ok?'PASS':'FAIL')+'  '+name); if(!ok)fail=1; }
let cal=''; try{ cal=fs.readFileSync('polymythseminars/index.html','utf8'); }catch(e){}
check('calendar page exists', cal.length>1000);
check('calendar fetches /data/polymyth-seminar-events.json', cal.includes('/data/polymyth-seminar-events.json'));
check('calendar wraps titles in source_url links', cal.includes('source_url') && cal.includes('target="_blank"'));
check('calendar carries build stamp', /build 20\d{6}/.test(cal));
let data=null; try{ data=JSON.parse(fs.readFileSync('data/polymyth-seminar-events.json','utf8')); }catch(e){}
check('218-event data file parses', !!data);
check('data file has 200+ events', !!data && (data.events||[]).length>=200);
let feed=''; try{ feed=fs.readFileSync('polymythseminars/feed.xml','utf8'); }catch(e){}
check('rss feed present with items', feed.includes('<item>'));
let home=''; try{ home=fs.readFileSync('index.html','utf8'); }catch(e){}
check('homepage reads the 218 file', home.includes('/data/polymyth-seminar-events.json'));
check('homepage wraps titles in source_url links', home.includes('source_url'));
if(fail){ console.error('\nBLOCKED: calendar-critical files are broken. DO NOT PUSH.'); process.exit(1); }
console.log('\nALL CRITICAL CHECKS PASS — safe to deploy.');
