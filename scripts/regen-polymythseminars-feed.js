#!/usr/bin/env node
// Regenerates /polymythseminars/feed.xml from /data/polymyth-seminar-events.json.
// Items: events from yesterday forward, soonest first, capped at 60.
// Run from repo root: node scripts/regen-polymythseminars-feed.js
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root,'data/polymyth-seminar-events.json'),'utf8'));
const events = (data.events || []).slice();
const today = new Date(); today.setHours(0,0,0,0);
const floor = new Date(today.getTime() - 86400000);
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function rfc822(d){return d.toUTCString().replace('GMT','+0000');}
const items = events
  .filter(e => { const d=new Date(e.date); return !isNaN(d) && d >= floor; })
  .sort((a,b) => new Date(a.date) - new Date(b.date))
  .slice(0,60)
  .map(e => {
    let title = e.title || 'Untitled event';
    if (e.speaker_or_director && title.indexOf(e.speaker_or_director) === -1)
      title = e.speaker_or_director + ': ' + title;
    const link = e.source_url || 'https://seminarschools.com/polymythseminars/';
    const guid = (e.source_url || 'https://seminarschools.com/polymythseminars/') + '#' + (e.date||'');
    const descBits = [e.venue, e.type, e.description].filter(Boolean).join(' — ');
    const d = new Date(e.date); d.setUTCHours(12,0,0,0);
    return ['<item>',
      '<title>'+esc(title)+'</title>',
      '<link>'+esc(link)+'</link>',
      '<guid isPermaLink="false">'+esc(guid)+'</guid>',
      '<pubDate>'+rfc822(d)+'</pubDate>',
      '<description>'+esc(descBits)+'</description>',
      '</item>'].join('\n');
  });
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/polymythseminars/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>polymythcalendar — Seminar Schools</title>
<link>https://seminarschools.com/polymythseminars/</link>
<atom:link href="https://seminarschools.com/polymythseminars/feed.xml" rel="self" type="application/rss+xml" />
<description>Public lectures, conferences, workshops, readings, festivals, exhibitions and civic events across Toronto and Southern Ontario, Kingston, and Montréal. Upcoming events from polymythcalendar.</description>
<language>en-CA</language>
<lastBuildDate>${rfc822(new Date())}</lastBuildDate>
<generator>seminarschools.com</generator>
${items.join('\n')}
</channel>
</rss>
`;
fs.writeFileSync(path.join(root,'polymythseminars/feed.xml'), xml);
console.log('feed.xml written:', items.length, 'items');
