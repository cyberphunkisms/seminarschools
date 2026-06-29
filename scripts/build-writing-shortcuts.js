#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const NOW = new Date();
const ROUTES = {
  writingclub: { band:'club', label:'All Writing', display:'All Writing', desc:'Student writing opportunities in one list.', countText:n=>`${n} writing competitions` },
  writingkids: { band:'kids', label:'Kids', display:'Kids', desc:'Writing opportunities for younger students.', countText:n=>`${n} writing competitions` },
  writingjuniors: { band:'juniors', label:'Juniors', display:'Juniors', desc:'Middle-grade writing opportunities.', countText:n=>`${n} writing competitions` },
  writingteens: { band:'teens', label:'Teens', display:'Teens', desc:'High-school writing opportunities.', countText:n=>`${n} writing competitions` },
  writinggrads: { band:'grads', label:'Grades 11 and 12', display:'Grades 11 and 12', desc:'Senior high-school writing opportunities.', countText:n=>`${n} writing competitions` }
};
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, text){
  const file = path.join(ROOT, rel);
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (old === text) return false;
  if (CHECK) throw new Error(`stale generated writing shortcut: ${rel}`);
  fs.writeFileSync(file, text, 'utf8');
  return true;
}
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(v){ return esc(v); }
function slug(value){ const core=String(value||'resource').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,76); return core || 'resource'; }
function hash(value){ return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0,8); }
function stripTags(value){ return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
function cleanSentence(value, limit=260){ const text=stripTags(value).replace(/\s+/g,' ').trim(); if(!text) return ''; if(text.length<=limit) return text; const clip=text.slice(0, Math.max(1,limit-1)); const boundary=Math.max(clip.lastIndexOf('. '), clip.lastIndexOf('; '), clip.lastIndexOf(', ')); return (boundary>80?clip.slice(0,boundary):clip).trim()+'…'; }
function humanDate(date){ const d=new Date(date); if(Number.isNaN(d.getTime())) return String(date||'Date to be confirmed'); return new Intl.DateTimeFormat('en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Toronto'}).format(d); }
function eventEligible(e){ const start=new Date(e.date||''); const end=new Date(e.end_date||e.date||''); if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime()<NOW.getTime()) return false; const horizon=new Date(NOW); horizon.setFullYear(horizon.getFullYear()+1); return start.getTime()<=horizon.getTime(); }
function isYouthWritingContest(e){ return Array.isArray(e.writing_bands) && e.writing_bands.length && e.type === 'contest'; }
function bandMatches(e, band){ if(band==='club') return true; const explicit=Array.isArray(e.writing_bands)?e.writing_bands.map(x=>String(x).toLowerCase()):[]; return explicit.includes(band); }
function staticEventCard(event){
  const d=new Date(event.date);
  const route=`/polymythseminars/events/${slug(event.id || event.title)}-${hash(event.id || event.title)}/`;
  const date=event.end_date?`${humanDate(event.date)} to ${humanDate(event.end_date)}`:humanDate(event.date);
  const day=Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-CA',{day:'2-digit',timeZone:'America/Toronto'}).format(d);
  const mon=Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-CA',{month:'short',timeZone:'America/Toronto'}).format(d);
  const by=event.speaker_or_director?`<div class="event-speaker">${esc(event.speaker_or_director)}</div>`:'';
  return `<article class="event" data-date="${attr(event.date || '')}" data-end-date="${attr(event.end_date || '')}" data-type="${attr(event.type || 'other')}"><div class="date-col"><span class="day">${esc(day)}</span><span class="mon">${esc(mon)}</span></div><div class="body-col"><h2 class="title"><a href="${route}">${esc(event.title)}</a></h2>${by}<div class="event-meta">${esc(date)}${event.venue ? ` · ${esc(event.venue)}` : ''}</div>${event.description ? `<p class="event-desc">${esc(cleanSentence(event.description,260))}</p>` : ''}</div></article>`;
}
function replaceDivInner(html, id, inner){
  const re = new RegExp(`(<div[^>]*id=["']${id}["'][^>]*>)[\\s\\S]*?(<\\/div>)`);
  return html.replace(re, `$1${inner}$2`);
}

function setStablePolymythcalHeader(html, info, route){
  const url = `https://seminarschools.com/${route}/`;
  const description = `Polymythcal view: ${info.label}. ${info.desc || 'Learning opportunities.'}`;
  html=html.replace(/<title>[\s\S]*?<\/title>/, '<title>Polymythcal | Seminar Schools</title>');
  html=html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(description)}">`);
  html=html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  html=html.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Polymythcal">');
  html=html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(description)}">`);
  html=html.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="Polymythcal">');
  html=html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${attr(description)}">`);
  html=html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  html=html.replace(/<header class="cv-header">[\s\S]*?<\/header>/, `<header class="cv-header">
    <h1>Polymythcal</h1>
    <div class="meta" id="polymythContext">${esc(info.label)}</div>
    <div class="tag" id="polymythDescription">${esc(info.desc || 'Learning opportunities.')}</div>
    <div class="tag helper-tag">Choose a filter. Open a title to check dates, rules, and sign-up.</div>
  </header>`);
  return html;
}

function setWritingButtons(html, activeBand){
  for (const [slug, info] of Object.entries(ROUTES)) {
    const on = info.band === activeBand;
    const label = info.display || info.label.replace('Writing ', '');
    const re = new RegExp(`<a href="/${slug}/" data-writing="${info.band}"(?: class="on")?(?: aria-current="page")?>[^<]*</a>`,'g');
    html = html.replace(re, `<a href="/${slug}/" data-writing="${info.band}"${on?' class="on" aria-current="page"':''}>${label}</a>`);
  }
  return html;
}
function main(){
  const data = JSON.parse(read('polymythseminars/events.json'));
  const current = (data.events || []).filter(isYouthWritingContest).filter(eventEligible).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  let writes=0;
  for (const [slug, info] of Object.entries(ROUTES)) {
    let html = read(`${slug}/index.html`);
    const events = current.filter(e=>bandMatches(e, info.band));
    const markup = `<div class="ssr-event-list" data-ssr-events="true"><p class="sr-only">${events.length} writing competition listings are listed below. Use the controls above to filter them when JavaScript is available.</p>${events.map(staticEventCard).join('\n')}</div>`;
    html = html.replace(/<script(?=[^>]*id=["']events-fallback["'])(?=[^>]*type=["']application\/json["'])[^>]*>[\s\S]*?<\/script>/, `<script type="application/json" id="events-fallback">${JSON.stringify(data)}</script>`);
    html = html.replace(/<!-- SS_STATIC_EVENTS_START -->[\s\S]*?<!-- SS_STATIC_EVENTS_END -->/, `<!-- SS_STATIC_EVENTS_START -->${markup}<!-- SS_STATIC_EVENTS_END -->`);
    html = html.replace(/<div class="count-line" id="countLine"[^>]*>[\s\S]*?<\/div>/, `<div class="count-line" id="countLine" role="status" aria-live="polite" aria-atomic="true">${info.countText(events.length)}</div>`);
    html = setStablePolymythcalHeader(html, info, slug);
    html = setWritingButtons(html, info.band);
    if (write(`${slug}/index.html`, html)) writes++;
  }
  console.log(`WRITING SHORTCUT ${CHECK?'CHECK':'BUILD'} — ${current.length} current youth writing competitions, ${writes} files updated.`);
}
try { main(); } catch (err) { console.error('WRITING SHORTCUT BUILD FAILED:', err.message || err); process.exit(1); }
