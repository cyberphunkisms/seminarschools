'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const ROUTES = {
  writingclub: {group:'writing', band:'club', defaultContent:'apply', kicker:'Writing opportunities', heading:'All writing opportunities', description:'Writing contests, prizes, publications, and submission opportunities for young writers.'},
  writingkids: {group:'writing', band:'kids', defaultContent:'apply', kicker:'Writing opportunities', heading:'Writing opportunities for kids', description:'Elementary-friendly writing contests and publication opportunities.'},
  writingjuniors: {group:'writing', band:'juniors', defaultContent:'apply', kicker:'Writing opportunities', heading:'Writing opportunities for juniors', description:'Middle-grade writing contests and publication opportunities.'},
  writingteens: {group:'writing', band:'teens', defaultContent:'apply', kicker:'Writing opportunities', heading:'Writing opportunities for teens', description:'High-school writing contests, prizes, and publication opportunities.'},
  writinggrads: {group:'writing', band:'grads', defaultContent:'apply', kicker:'Writing opportunities', heading:'Writing opportunities for Grades 11 and 12', description:'Senior high-school writing contests and portfolio-building opportunities.'},
  university: {group:'academic', band:'university', defaultContent:'both', kicker:'Academic calendar', heading:'University and graduate opportunities', description:'University talks, conferences, workshops, calls, and academic opportunities.'},
  philosophy: {group:'academic', band:'philosophy', defaultContent:'both', kicker:'Academic calendar', heading:'Philosophy and ethics', description:'Philosophy talks, conferences, workshops, calls for papers, and fellowships.'},
  humanities: {group:'academic', band:'humanities', defaultContent:'both', kicker:'Academic calendar', heading:'Humanities', description:'Humanities talks, conferences, workshops, calls, and opportunities.'},
  cfps: {group:'academic', band:'cfps', defaultContent:'apply', kicker:'Academic opportunities', heading:'Calls for papers and proposals', description:'Calls for papers, proposals, abstracts, and conference submissions.'},
  lectures: {group:'academic', band:'lectures', defaultContent:'attend', kicker:'Academic calendar', heading:'Talks and lectures', description:'Public talks, lectures, panels, colloquia, and speaker events.'},
  fellowships: {group:'academic', band:'fellowships', defaultContent:'apply', kicker:'Academic opportunities', heading:'Fellowships, grants, and residencies', description:'Fellowships, grants, residencies, scholarships, and funding opportunities.'}
};
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel,text,check){
  const file=path.join(ROOT,rel); const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(old===text) return false;
  if(check) throw new Error(`stale generated Polymythcal entry page: ${rel}`);
  fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text,'utf8'); return true;
}
function esc(value){ return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function matchesRoute(event, slug){
  const cfg=ROUTES[slug]; if(!cfg) return true;
  if(cfg.group==='writing') {
    const bands=Array.isArray(event.writing_bands)?event.writing_bands.map(String):[];
    return event.type==='contest' && (cfg.band==='club'?bands.length>0:bands.includes(cfg.band));
  }
  const bands=Array.isArray(event.academic_bands)?event.academic_bands.map(String):[];
  return bands.includes(cfg.band);
}
function currentEvent(event){
  const date=String(event.end_date || event.date || '').slice(0,10);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date>=today;
}
function replaceMeta(html, selector, value){
  if(selector==='title') return html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(value)}</title>`);
  const [attr,name]=selector.split(':');
  const re=new RegExp(`<meta(?=[^>]*${attr}=["']${name}["'])[^>]*>`,`i`);
  const key=attr==='name'?'name':'property';
  return html.replace(re,`<meta ${key}="${esc(name)}" content="${esc(value)}"/>`);
}
function routeLinks(active){
  const groups=[
    ['Writing', ['writingclub','writingkids','writingjuniors','writingteens','writinggrads']],
    ['Academic', ['university','philosophy','humanities','cfps','lectures','fellowships']]
  ];
  return groups.map(([label,slugs])=>`<span class="pm-dedicated-group"><span>${label}</span>${slugs.map(slug=>`<a href="/${slug}/"${slug===active?' aria-current="page"':''}>${esc(ROUTES[slug].heading)}</a>`).join('')}</span>`).join('');
}
function buildRoutePage(slug, payload){
  const cfg=ROUTES[slug]; if(!cfg) throw new Error(`unknown Polymythcal route: ${slug}`);
  let html=read('polymythseminars/index.html');
  const url=`${SITE}/${slug}/`;
  const title=`${cfg.heading} | Polymythcal | Seminar Schools`;
  html=replaceMeta(html,'title',title);
  html=replaceMeta(html,'name:description',cfg.description);
  html=replaceMeta(html,'property:og:url',url);
  html=replaceMeta(html,'property:og:title',title);
  html=replaceMeta(html,'property:og:description',cfg.description);
  html=html.replace(/<link href="https:\/\/seminarschools\.com\/polymythseminars\/" rel="canonical"\/>/i,`<link href="${url}" rel="canonical"/>`)
    .replace(/<link href="https:\/\/seminarschools\.com\/polymythseminars\/" hreflang="en-ca" rel="alternate"\/>/i,`<link href="${url}" hreflang="en-ca" rel="alternate"/>`)
    .replace(/<link href="https:\/\/seminarschools\.com\/polymythseminars\/\?lang=fr" hreflang="fr-ca" rel="alternate"\/>/i,`<link href="${url}?lang=fr" hreflang="fr-ca" rel="alternate"/>`)
    .replace(/<link href="https:\/\/seminarschools\.com\/polymythseminars\/" hreflang="x-default" rel="alternate"\/>/i,`<link href="${url}" hreflang="x-default" rel="alternate"/>`);
  html=html.replace(/<body([^>]*)>/i,(m,attrs)=>`<body${attrs} data-pm-route="${slug}" data-pm-default-content="${cfg.defaultContent}">`);
  html=html.replace(/<p class="pm-kicker">[\s\S]*?<\/p>\s*<h1>[\s\S]*?<\/h1>\s*<p class="pm-lede" id="polymythContext">[\s\S]*?<\/p>/i,
    `<p class="pm-kicker">${esc(cfg.kicker)}</p>\n<h1>${esc(cfg.heading)}</h1>\n<p class="pm-lede" id="polymythContext">${esc(cfg.description)}</p>`);
  html=html.replace(/<header class="pm-header">([\s\S]*?)<\/header>/i,`<header class="pm-header">$1</header><section class="pm-route-context pm-panel" aria-label="Dedicated Polymythcal view"><p><strong>${esc(cfg.heading)}</strong> limits the results to this entry point. Every filter below still works inside this view. <a href="/polymythseminars/">Browse all Polymythcal listings</a>.</p></section>`);
  html=html.replace(/<div class="pm-dedicated-row">[\s\S]*?<\/div>\s*<\/div>\s*<\/details>/i,`<div class="pm-dedicated-row"><span>Dedicated pages</span><nav aria-label="Dedicated Polymythcal pages" class="pm-dedicated-links" id="academicNav">${routeLinks(slug)}</nav></div>\n</div>\n</details>`);
  html=html.replace(/<h2 id="pmResultsTitle">[\s\S]*?<\/h2>/i,`<h2 id="pmResultsTitle">${esc(cfg.heading)} listings</h2>`);
  const events=(payload.events||[]).filter(e=>matchesRoute(e,slug)).filter(currentEvent).slice(0,40);
  const noScript=`<noscript><section class="pm-noscript pm-panel"><h2>${esc(cfg.heading)}</h2><p>JavaScript adds interactive filters. These current listings remain available without it.</p><ul>${events.map(e=>`<li><a href="/polymythseminars/events/${encodeURIComponent(e.id)}/">${esc(e.title)}</a> <span>${esc(String(e.date||'').slice(0,10))}</span></li>`).join('')}</ul><p><a href="/polymythseminars/subscribe/">RSS and calendar feeds</a> · <a href="/sitemap/">Site map</a></p></section></noscript>`;
  html=html.replace(/<noscript>[\s\S]*?<\/noscript>/i,noScript);
  html=html.replace(/"url": "https:\/\/seminarschools\.com\/polymythseminars\/"/,`"url": "${url}"`)
    .replace(/"name": "Polymythcal"/,`"name": ${JSON.stringify(cfg.heading)}`)
    .replace(/"description": "A public calendar of events and application opportunities from Toronto through Kingston to Montréal\."/,`"description": ${JSON.stringify(cfg.description)}`);
  return html;
}
function buildGroup(group, check=false){
  const payload=JSON.parse(read('polymythseminars/events.json')); let writes=0;
  for(const [slug,cfg] of Object.entries(ROUTES)) {
    if(cfg.group!==group) continue;
    if(write(`${slug}/index.html`,buildRoutePage(slug,payload),check)) writes++;
  }
  return writes;
}
module.exports={ROUTES,matchesRoute,buildRoutePage,buildGroup};
