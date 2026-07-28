'use strict';
const fs = require('fs');
const path = require('path');
const {resolveSiteBuildDate} = require('./polymythcal-build-date');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const TODAY = resolveSiteBuildDate({root:ROOT});
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
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date>=TODAY;
}
function replaceMeta(html, selector, value){
  if(selector==='title') return html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(value)}</title>`);
  const separator=selector.indexOf(':');
  if(separator<1 || separator===selector.length-1) throw new Error(`invalid metadata selector: ${selector}`);
  const attr=selector.slice(0,separator);
  const name=selector.slice(separator+1);
  const re=new RegExp(`<meta(?=[^>]*${attr}=["']${name}["'])[^>]*>`,`i`);
  const key=attr==='name'?'name':'property';
  return html.replace(re,`<meta ${key}="${esc(name)}" content="${esc(value)}"/>`);
}
function replaceLocaleLinks(html, englishUrl, frenchUrl){
  html=html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,`<link rel="canonical" href="${englishUrl}">`);
  html=html.replace(/<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhreflang=)[^>]*>\s*/gi,'');
  const block=[
    `<link rel="alternate" hreflang="en-CA" href="${englishUrl}">`,
    `<link rel="alternate" hreflang="fr-CA" href="${frenchUrl}">`,
    `<link rel="alternate" hreflang="x-default" href="${englishUrl}">`,
  ].join('\n');
  const stylesheet=html.match(/<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])[^>]*>/i);
  html=stylesheet
    ? html.replace(stylesheet[0],block+'\n'+stylesheet[0])
    : html.replace('</head>',block+'\n</head>');
  return html.replace(
    /(<a\b[^>]*\bid=["']pmLanguageLink["'][^>]*\bhref=["'])[^"']*(["'])/i,
    `$1${frenchUrl}$2`,
  );
}
function routeLinks(active, excludeActive=false){
  const groups=[
    ['Writing', ['writingclub','writingkids','writingjuniors','writingteens','writinggrads']],
    ['Academic', ['university','philosophy','humanities','cfps','lectures','fellowships']]
  ];
  return groups.map(([label,slugs])=>`<span class="pm-dedicated-group"><span>${label}</span>${slugs.filter(slug=>!excludeActive || slug!==active).map(slug=>`<a href="/${slug}/"${slug===active?' aria-current="page"':''}>${esc(ROUTES[slug].heading)}</a>`).join('')}</span>`).join('');
}
function focusedRouteNavigation(active){
  return `<details class="pm-quick-starts" id="pmQuickStarts" open="">
<summary class="pm-quick-summary"><span>Other focused calendars</span><span class="pm-summary-note">Choose another focused view</span></summary>
<div class="pm-quick-body"><div class="pm-dedicated-row"><span>Browse by focus</span><nav aria-label="Other focused Polymythcal calendars" class="pm-dedicated-links" id="academicNav">${routeLinks(active,true)}</nav></div></div>
</details>`;
}
function focusContentMode(html, mode){
  if(mode==='both') return html;
  html=html.replace(/<section aria-labelledby="pmLookingForTitle"[\s\S]*?<\/section>\s*/i,'');
  const hiddenLegend=mode==='apply'?'Events to attend':'Opportunities to apply for';
  const fieldset=new RegExp(`<fieldset class="pm-fieldset">\\s*<legend class="pm-legend">${hiddenLegend}<\\/legend>[\\s\\S]*?<\\/fieldset>\\s*`,'i');
  html=html.replace(fieldset,'');
  const help=mode==='apply'?'Choose one or more opportunity types.':'Choose one or more event types.';
  return html.replace(/(<section aria-labelledby="pmTypeTitle"[\s\S]*?<p class="pm-help">)[\s\S]*?(<\/p>)/i,`$1${help}$2`);
}
function buildRoutePage(slug, payload){
  const cfg=ROUTES[slug]; if(!cfg) throw new Error(`unknown Polymythcal route: ${slug}`);
  let html=read('polymythseminars/index.html');
  const url=`${SITE}/${slug}/`;
  const frenchUrl=`${SITE}/${slug}/fr/`;
  const title=`${cfg.heading} | Polymythcal | Seminar Schools`;
  html=replaceMeta(html,'title',title);
  html=replaceMeta(html,'name:description',cfg.description);
  html=replaceMeta(html,'property:og:url',url);
  html=replaceMeta(html,'property:og:title',title);
  html=replaceMeta(html,'property:og:description',cfg.description);
  if (!/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/i.test(html)) {
    html=html.replace(/(<meta(?=[^>]*\bname=["']viewport["'])[^>]*>)/i,'$1\n<meta name="robots" content="index,follow">');
  }
  html=replaceLocaleLinks(html,url,frenchUrl);
  html=html.replace(/<body([^>]*)>/i,(m,attrs)=>{
    const steadyAttrs=String(attrs).replace(/data-indra-intensity=(["'])[^"']*\1/i,'data-indra-intensity="0.095"');
    return `<body${steadyAttrs} data-pm-route="${slug}" data-pm-default-content="${cfg.defaultContent}">`;
  });
  html=html.replace(
    /<header class="pm-header">[\s\S]*?<\/header>/i,
    `<header class="pm-header"><p class="pm-kicker"><a href="/">Seminar Schools public calendar</a></p>
<p class="pm-commons-context"><a href="/polymythcommons/">Polymyth Commons</a><span aria-hidden="true"> / </span>focused calendar</p>
<h1>${esc(cfg.heading)}</h1>
<p class="pm-lede" id="polymythContext">${esc(cfg.description)}</p></header>
<section class="pm-route-context pm-panel" aria-label="Focused Polymythcal view"><p><strong>${esc(cfg.heading)}</strong> is selected. Use the filters below, <a href="/polymythseminars/">browse every listing</a>, or return to <a href="/polymythcommons/">Polymyth Commons</a>.</p></section>`,
  );
  html=html.replace(/<details class="pm-quick-starts" id="pmQuickStarts"[\s\S]*?<\/details>/i,focusedRouteNavigation(slug));
  html=focusContentMode(html,cfg.defaultContent);
  html=html.replace(/<h2 id="pmResultsTitle">[\s\S]*?<\/h2>/i,`<h2 id="pmResultsTitle">${esc(cfg.heading)} listings</h2>`);
  const events=(payload.events||[]).filter(e=>matchesRoute(e,slug)).filter(currentEvent).slice(0,40);
  const noScript=`<noscript><section class="pm-noscript pm-panel"><h2>${esc(cfg.heading)}</h2><p>These current listings are available without JavaScript.</p><ul>${events.map(e=>`<li><a href="/polymythseminars/events/${encodeURIComponent(e.id)}/">${esc(e.title)}</a> <span>${esc(String(e.date||'').slice(0,10))}</span></li>`).join('')}</ul><p><a href="/polymythseminars/subscribe/">RSS and calendar feeds</a> · <a href="/sitemap/">Site map</a></p></section></noscript>`;
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
