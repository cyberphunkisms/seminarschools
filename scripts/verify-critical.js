#!/usr/bin/env node
// Refuses to let a broken calendar ship. Run from repo root. Exit 1 = DO NOT DEPLOY.
'use strict';
const fs = require('fs');
let fail = 0;
function read(rel){ try { return fs.readFileSync(rel, 'utf8'); } catch (_) { return ''; } }
function json(rel){ try { return JSON.parse(read(rel)); } catch (_) { return null; } }
function check(name, ok){ console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail = 1; }

const cal = read('polymythseminars/index.html');
const app = read('js/polymythcal-revamp.js');
check('calendar page exists', cal.length > 1000);
check('calendar uses the lightweight client shell', cal.includes('id="pmEventList"') && cal.includes('/js/polymythcal-revamp.js'));
check('calendar avoids an embedded full-corpus fallback', !cal.includes('id="events-fallback"') && cal.length < 100000);
check('calendar carries current build stamp', cal.includes('name="ss-build"') && cal.includes('20260721-audit18'));
check('calendar application fetches the public event path', app.includes('const DATA_URL = "/polymythseminars/events.json"'));
check('calendar application renders official source links', app.includes('event.source_url') && app.includes('rel="noopener noreferrer"'));
check('calendar has a readable load-failure route', app.includes('loadError') && app.includes('/polymythseminars/subscribe/'));
check('calendar revalidates cached event data efficiently', app.includes('cache: "no-cache"'));

const data = json('data/polymyth-seminar-events.json');
check('event data file parses', !!data);
check('data file has 200+ events', !!data && (data.events || []).length >= 200);
const pub = json('polymythseminars/events.json');
check('PUBLIC events copy exists at /polymythseminars/events.json', !!pub);
check('public copy has 200+ events', !!pub && (pub.events || []).length >= 200);
try {
  const a = fs.readFileSync('polymythseminars/events.json');
  const b = fs.readFileSync('data/polymyth-seminar-events.json');
  check('public copy byte-identical to data/ master', a.equals(b));
} catch (_) { check('public copy byte-identical to data/ master', false); }

const feed = read('polymythseminars/feed.xml');
check('rss feed present with items', feed.includes('<item>'));
const home = read('about/index.html');
check('main page fetches the public events file', home.includes("'/polymythseminars/events.json"));
check('main page wraps titles in source_url links', home.includes('source_url'));
check('main page uses the fallback loader', home.includes('fetchEventsWithFallback'));
const ntl = read('netlify.toml');
check('netlify publishes only the generated public directory', /publish\s*=\s*"public"/.test(ntl));
check('netlify still blocks /data/* as defence in depth', ntl.includes('from = "/data/*"'));
const robot = json('seminars/events.json');
check('robot fallback file parses', !!robot && (robot.events || []).length > 0);
if (fail) { console.error('\nBLOCKED: calendar-critical files are broken. DO NOT PUSH.'); process.exit(1); }
console.log('\nALL CRITICAL CHECKS PASS — safe to deploy.');
