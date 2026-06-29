#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const CHECK = process.argv.includes('--check');
const NOW = new Date();
const ROUTES = {
  university: {
    focus: 'university',
    label: 'University+',
    title: 'University+ | Philosophy, Humanities, CFPs & Fellowships | Seminar Schools',
    h1: 'University+',
    description: 'University-level philosophy, humanities, lectures, calls for papers, fellowships, conferences, and research opportunities worldwide.',
    countText: n => `${n} university-level opportunities`
  },
  philosophy: {
    focus: 'philosophy',
    label: 'Philosophy',
    title: 'Philosophy | University Events, CFPs & Fellowships | Seminar Schools',
    h1: 'Philosophy',
    description: 'Philosophy lectures, colloquia, ethics events, political theory, CFPs, graduate conferences, and fellowship opportunities worldwide.',
    countText: n => `${n} philosophy opportunities`
  },
  humanities: {
    focus: 'humanities',
    label: 'Humanities',
    title: 'Humanities | Lectures, CFPs & Fellowships | Seminar Schools',
    h1: 'Humanities',
    description: 'Humanities lectures, calls for papers, conferences, fellowships, and research opportunities in literature, history, classics, religion, art history, archaeology, and theory.',
    countText: n => `${n} humanities opportunities`
  },
  cfps: {
    focus: 'cfps',
    label: 'CFPs',
    title: 'CFPs | Philosophy & Humanities Calls for Papers | Seminar Schools',
    h1: 'CFPs',
    description: 'Calls for papers and conference submission deadlines in philosophy, humanities, history, literature, classics, religious studies, art history, archaeology, and theory.',
    countText: n => `${n} calls for papers`
  },
  lectures: {
    focus: 'lectures',
    label: 'Lectures',
    title: 'Lectures | University Philosophy & Humanities Talks | Seminar Schools',
    h1: 'Lectures',
    description: 'University public lectures, colloquia, seminars, talks, and humanities speaker series for students, scholars, and lifelong learners.',
    countText: n => `${n} lecture-family events`
  },
  fellowships: {
    focus: 'fellowships',
    label: 'Fellowships',
    title: 'Fellowships | Humanities Research Opportunities | Seminar Schools',
    h1: 'Fellowships',
    description: 'Humanities fellowships, research grants, residencies, visiting scholar opportunities, and deadline watch cards for university-level researchers.',
    countText: n => `${n} fellowship and funding opportunities`
  }
};
const TYPE_TO_CATEGORY = {
  lecture:'lecture', talk:'lecture', 'book-talk':'lecture', 'scholar-talk':'lecture', 'artist-talk':'lecture', defence:'lecture', panel:'lecture', 'podcast-live':'lecture',
  conference:'conference', symposium:'conference', colloquium:'conference', forum:'conference',
  workshop:'workshop', webinar:'workshop', meeting:'workshop', retreat:'workshop',
  reading:'reading', 'book-launch':'reading', residency:'reading',
  festival:'festival', 'festival-of-form':'festival', 'cultural-reproduction':'festival',
  exhibition:'exhibition', 'site-specific-art':'exhibition', performance:'performance', screening:'screening', cfp:'cfp', contest:'contest',
  gathering:'gathering', memorial:'gathering', celebration:'gathering', networking:'gathering', community:'gathering',
  protest:'protest', demonstration:'protest', march:'protest', rally:'protest', picket:'protest', vigil:'protest', 'sit-in':'protest', walkout:'protest'
};
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, text){
  const file = path.join(ROOT, rel);
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (old === text) return false;
  if (CHECK) throw new Error(`stale generated academic shortcut: ${rel}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return true;
}
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(v){ return esc(v); }
function slug(value){ const core=String(value||'resource').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,76); return core || 'resource'; }
function hash(value){ return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0,8); }
function stripTags(value){ return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
function cleanSentence(value, limit=260){ const text=stripTags(value).replace(/\s+/g,' ').trim(); if(!text) return ''; if(text.length<=limit) return text; const clip=text.slice(0, Math.max(1,limit-1)); const boundary=Math.max(clip.lastIndexOf('. '), clip.lastIndexOf('; '), clip.lastIndexOf(', ')); return (boundary>80?clip.slice(0,boundary):clip).trim()+'…'; }
function humanDate(date){ const d=new Date(date); if(Number.isNaN(d.getTime())) return String(date||'Date to be confirmed'); return new Intl.DateTimeFormat('en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Toronto',timeZoneName:'short'}).format(d); }
function catOf(type){ return TYPE_TO_CATEGORY[type] || 'other'; }
function categories(e){ return [e.type].concat(e.secondary_types || []).map(t => TYPE_TO_CATEGORY[t] || 'other').filter((c,i,a)=>a.indexOf(c)===i); }
function eventEligible(e){
  const start=new Date(e.date||'');
  const end=new Date(e.end_date||e.date||'');
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime()<NOW.getTime()) return false;
  const horizon=new Date(NOW); horizon.setFullYear(horizon.getFullYear()+1);
  return start.getTime()<=horizon.getTime();
}
function academicText(e){ return [e.title,e.type,(e.secondary_types||[]).join(' '),e.speaker_or_director,e.venue,e.description,e.age_band,e.source_id,(e.subjects||[]).join(' '),(e.genres||[]).join(' '),(e.academic_bands||[]).join(' ')].filter(Boolean).join(' ').toLowerCase(); }
function ageBucket(e){
  const t=String(e.age_band||'').toLowerCase();
  if(/adult|18\+|over ?18|mature|undergrad|graduate|emerging|professional|university|post-?secondary|faculty|scholar/.test(t)) return 'adult';
  if(/youth|teen|child|kid|junior|minor|under ?1[0-8]|grade|grades|k-?12|secondary|high ?school|elementary/.test(t)) return 'youth';
  if(/all ?ages|all-ages|family|everyone|open to all|open to the public/.test(t)) return 'allages';
  const cat=catOf(e.type);
  if(['lecture','conference','cfp','workshop','contest'].includes(cat)) return 'adult';
  return 'allages';
}
function academicBandMatches(e, focus){
  const explicit=Array.isArray(e.academic_bands)?e.academic_bands.map(x=>String(x).toLowerCase()):[];
  if(explicit.includes(focus)) return true;
  const t=academicText(e); const cats=categories(e);
  if(focus==='university') return ageBucket(e)==='adult' || cats.includes('cfp') || cats.includes('conference') || /university|graduate|undergraduate|postdoc|postdoctoral|faculty|scholar|researcher|academic|seminar|colloquium|symposium|conference|fellowship|call for papers|cfp/.test(t);
  if(focus==='philosophy') return /philosoph|ethic|moral|metaphysic|epistemolog|logic|aesthetic|phenomenolog|existential|political philosophy|normative|bioethic|human values|kant|aristotle|plato|spinoza|hegel|wittgenstein|critical theory/.test(t);
  if(focus==='humanities') return /humanities|literature|literary|history|historical|classic|medieval|renaissance|religion|theology|archaeolog|anthropolog|art history|visual culture|linguistic|philology|book history|digital humanities|cultural studies|comparative literature|philosoph|ethic|political theory|intellectual history|shakespeare|early modern|modernist|media studies|law and humanities/.test(t);
  if(focus==='cfps') return cats.includes('cfp') || /call for papers|cfp|abstract deadline|proposal deadline|submission deadline/.test(t);
  if(focus==='lectures') return cats.includes('lecture') || /lecture|colloquium|seminar|public talk|guest speaker|tanner|keynote|speaker series/.test(t);
  if(focus==='fellowships') return /fellowship|fellowships|grant|grants|prize|awards|funding|residency|visiting scholar|membership applications|research support/.test(t);
  return true;
}
function staticEventCard(event){
  const d=new Date(event.date); const route=`/polymythseminars/events/${slug(event.id || event.title)}-${hash(event.id || event.title)}/`;
  const date=event.end_date?`${humanDate(event.date)} to ${humanDate(event.end_date)}`:humanDate(event.date);
  const day=Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-CA',{day:'2-digit',timeZone:'America/Toronto'}).format(d);
  const mon=Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-CA',{month:'short',timeZone:'America/Toronto'}).format(d);
  const by=event.speaker_or_director?`<div class="event-speaker">${esc(event.speaker_or_director)}</div>`:'';
  return `<article class="event" data-date="${attr(event.date || '')}" data-end-date="${attr(event.end_date || '')}" data-type="${attr(event.type || 'other')}"><div class="date-col"><span class="day">${esc(day)}</span><span class="mon">${esc(mon)}</span></div><div class="body-col"><h2 class="title"><a href="${route}">${esc(event.title)}</a></h2>${by}<div class="event-meta">${esc(date)}${event.venue ? ` · ${esc(event.venue)}` : ''}</div>${event.description ? `<p class="event-desc">${esc(cleanSentence(event.description,260))}</p>` : ''}</div></article>`;
}
function setAcademicLinks(html, focus){
  html = html.replace(/<a href="\/(university|philosophy|humanities|cfps|lectures|fellowships)\/" data-academic="([^"]+)"(?: class="on")?(?: aria-current="page")?>([^<]+)<\/a>/g, (m, slug, band, label) => {
    const on = band === focus;
    return `<a href="/${slug}/" data-academic="${band}"${on?' class="on" aria-current="page"':''}>${label}</a>`;
  });
  return html;
}
function setTopStates(html, focus){
  const cat = focus === 'cfps' || focus === 'fellowships' ? 'deadlines' : (focus === 'lectures' ? 'lecture' : 'all');
  html = html.replace(/<button type="button" data-cat="([^"]+)"(?: class="on")? aria-pressed="(?:true|false)">/g, (m,c)=>`<button type="button" data-cat="${c}"${c===cat?' class="on"':''} aria-pressed="${c===cat?'true':'false'}">`);
  html = html.replace(/<button type="button" data-age="([^"]+)"(?: class="on")? aria-pressed="(?:true|false)">/g, (m,a)=>`<button type="button" data-age="${a}"${a==='adult'?' class="on"':''} aria-pressed="${a==='adult'?'true':'false'}">`);
  return html;
}
function itemList(events, info, route){
  return {
    '@context':'https://schema.org', '@type':'ItemList', '@id':`${SITE}/${route}/#itemlist`, name: info.h1 + ' opportunities', url:`${SITE}/${route}/`, numberOfItems: events.length,
    itemListElement: events.map((e,i)=>({'@type':'ListItem', position:i+1, name:e.title, url:`${SITE}/polymythseminars/events/${slug(e.id || e.title)}-${hash(e.id || e.title)}/`}))
  };
}
function collectionPage(info, route){ return {'@context':'https://schema.org','@type':'CollectionPage','@id':`${SITE}/${route}/#webpage`,url:`${SITE}/${route}/`,name:info.h1,description:info.description,isPartOf:{'@id':`${SITE}/#website`},inLanguage:'en-CA'}; }
function installSchema(html, schemas){
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '');
  const block = schemas.map(s=>`<script type="application/ld+json">\n${JSON.stringify(s,null,2)}\n</script>`).join('\n');
  return html.replace('</head>', `${block}\n</head>`);
}
function setHead(html, info, route){
  const url=`${SITE}/${route}/`;
  html=html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(info.title)}</title>`);
  html=html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(info.description)}">`);
  html=html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  html=html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(info.title)}">`);
  html=html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(info.description)}">`);
  html=html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${attr(info.title)}">`);
  html=html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${attr(info.description)}">`);
  html=html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  html=html.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${esc(info.h1)}</h1>`);
  return html;
}
function main(){
  const data=JSON.parse(read('polymythseminars/events.json'));
  const current=(data.events||[]).filter(eventEligible).sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title)));
  const base=read('polymythseminars/index.html');
  let writes=0;
  for(const [route, info] of Object.entries(ROUTES)){
    const events=current.filter(e=>academicBandMatches(e, info.focus));
    let html=base;
    const markup=`<div class="ssr-event-list" data-ssr-events="true"><p class="sr-only">${events.length} ${esc(info.label)} listings are listed below. Use the controls above to filter them when JavaScript is available.</p>${events.map(staticEventCard).join('\n')}</div>`;
    html=html.replace(/<script type="application\/json" id="events-fallback">[\s\S]*?<\/script>/, `<script type="application/json" id="events-fallback">${JSON.stringify(data)}</script>`);
    html=html.replace(/<!-- SS_STATIC_EVENTS_START -->[\s\S]*?<!-- SS_STATIC_EVENTS_END -->/, `<!-- SS_STATIC_EVENTS_START -->${markup}<!-- SS_STATIC_EVENTS_END -->`);
    html=html.replace(/<div class="count-line" id="countLine"[^>]*>[\s\S]*?<\/div>/, `<div class="count-line" id="countLine" role="status" aria-live="polite" aria-atomic="true">${info.countText(events.length)}</div>`);
    html=setAcademicLinks(html, info.focus);
    html=setTopStates(html, info.focus);
    html=setHead(html, info, route);
    html=installSchema(html, [collectionPage(info, route), itemList(events, info, route)]);
    if(write(`${route}/index.html`, html)) writes++;
  }
  console.log(`ACADEMIC SHORTCUT ${CHECK?'CHECK':'BUILD'} — ${Object.keys(ROUTES).length} routes, ${current.length} current events scanned, ${writes} files updated.`);
}
try { main(); } catch (err) { console.error('ACADEMIC SHORTCUT BUILD FAILED:', err.message || err); process.exit(1); }
