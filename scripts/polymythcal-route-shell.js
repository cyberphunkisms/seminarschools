'use strict';
const fs = require('fs');
const path = require('path');
const {resolveSiteBuildDate} = require('./polymythcal-build-date');
const {geometryBodyAttributes} = require('./lib/geometry-asset-version');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const TODAY = resolveSiteBuildDate({root:ROOT});
const GEOMETRY_CONTRACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'),
);
const ROUTES = {
  writingclub: {group:'writing', band:'club', defaultContent:'apply', navLabel:'Writing Club', heading:'All writing opportunities', description:'Writing contests, prizes, publications, and submission opportunities for young writers.'},
  writingkids: {group:'writing', band:'kids', defaultContent:'apply', navLabel:'Writing Kids', heading:'Writing opportunities for kids', description:'Elementary-friendly writing contests and publication opportunities.'},
  writingjuniors: {group:'writing', band:'juniors', defaultContent:'apply', navLabel:'Writing Juniors', heading:'Writing opportunities for juniors', description:'Middle-grade writing contests and publication opportunities.'},
  writingteens: {group:'writing', band:'teens', defaultContent:'apply', navLabel:'Writing Teens', heading:'Writing opportunities for teens', description:'High-school writing contests, prizes, and publication opportunities.'},
  writinggrads: {group:'writing', band:'grads', defaultContent:'apply', navLabel:'Writing Grads', heading:'Writing opportunities for Grades 11 and 12', description:'Senior high-school writing contests and portfolio-building opportunities.'},
  university: {group:'academic', band:'university', defaultContent:'both', navLabel:'University', heading:'University and graduate opportunities', description:'University talks, conferences, workshops, calls, and academic opportunities.'},
  philosophy: {group:'academic', band:'philosophy', defaultContent:'both', navLabel:'Philosophy', heading:'Philosophy and ethics', description:'Philosophy talks, conferences, workshops, calls for papers, and fellowships.'},
  humanities: {group:'academic', band:'humanities', defaultContent:'both', navLabel:'Humanities', heading:'Humanities', description:'Humanities talks, conferences, workshops, calls, and opportunities.'},
  cfps: {group:'academic', band:'cfps', defaultContent:'apply', navLabel:'Calls for papers', heading:'Calls for papers and proposals', description:'Calls for papers, proposals, abstracts, and conference submissions.'},
  lectures: {group:'academic', band:'lectures', defaultContent:'attend', navLabel:'Lectures', heading:'Talks and lectures', description:'Public talks, lectures, panels, colloquia, and speaker events.'},
  fellowships: {group:'academic', band:'fellowships', defaultContent:'apply', navLabel:'Fellowships', heading:'Fellowships, grants, and residencies', description:'Fellowships, grants, residencies, scholarships, and funding opportunities.'}
};
const ROUTE_FR = {
  writingclub: {navLabel:'Club d’écriture', heading:'Toutes les possibilités d’écriture', description:'Concours, prix, publications et possibilités de soumission pour les jeunes auteurs.'},
  writingkids: {navLabel:'Écriture : enfants', heading:'Possibilités d’écriture pour enfants', description:'Concours d’écriture et possibilités de publication adaptés au primaire.'},
  writingjuniors: {navLabel:'Écriture : juniors', heading:'Possibilités d’écriture pour juniors', description:'Concours d’écriture et possibilités de publication pour les années intermédiaires.'},
  writingteens: {navLabel:'Écriture : adolescents', heading:'Possibilités d’écriture pour adolescents', description:'Concours, prix et possibilités de publication pour le secondaire.'},
  writinggrads: {navLabel:'Écriture : cycles supérieurs', heading:'Possibilités d’écriture pour les 11e et 12e années', description:'Concours et possibilités d’écriture pour bâtir un portfolio au secondaire supérieur.'},
  university: {navLabel:'Université', heading:'Possibilités universitaires et aux cycles supérieurs', description:'Causeries, congrès, ateliers, appels et possibilités universitaires.'},
  philosophy: {navLabel:'Philosophie', heading:'Philosophie et éthique', description:'Causeries, congrès, ateliers, appels de communications et bourses en philosophie.'},
  humanities: {navLabel:'Sciences humaines', heading:'Sciences humaines', description:'Causeries, congrès, ateliers, appels et possibilités en sciences humaines.'},
  cfps: {navLabel:'Appels à contributions', heading:'Appels de communications et de propositions', description:'Appels de communications, de propositions, de résumés et de soumissions à des congrès.'},
  lectures: {navLabel:'Conférences', heading:'Causeries et conférences', description:'Causeries publiques, conférences, panels, colloques et activités avec conférenciers.'},
  fellowships: {navLabel:'Bourses', heading:'Bourses, subventions et résidences', description:'Bourses, subventions, résidences et possibilités de financement.'},
};
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel,text,check){
  const file=path.join(ROOT,rel); const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(old===text) return false;
  if(check) throw new Error(`stale generated Polymythcal entry page: ${rel}`);
  fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text,'utf8'); return true;
}
function esc(value){ return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function contentLang(event){
  const value=String(event&&event.content_language||'').trim();
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(value)?` lang="${esc(value)}"`:'';
}
function matchesRoute(event, slug){
  const cfg=ROUTES[slug]; if(!cfg) return true;
  const projectedRoutes=event && event.facets && Array.isArray(event.facets.routes)
    ? event.facets.routes.map(String)
    : [];
  if(projectedRoutes.length) return projectedRoutes.includes(slug);
  if(cfg.group==='writing') {
    const bands=Array.isArray(event.writing_bands)?event.writing_bands.map(String):[];
    return cfg.band==='club'?bands.length>0:bands.includes(cfg.band);
  }
  const bands=Array.isArray(event.academic_bands)?event.academic_bands.map(String):[];
  return bands.includes(cfg.band);
}
function currentEvent(event){
  const date=String(event.end || event.end_date || event.start || event.date || '').slice(0,10);
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
function replaceLocaleLinks(html, englishUrl, frenchUrl, canonicalUrl=englishUrl, alternateUrl=frenchUrl){
  html=html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,`<link rel="canonical" href="${canonicalUrl}">`);
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
    /(<a\b[^>]*\bid=["'](?:pm|pmd)LanguageLink["'][^>]*\bhref=["'])[^"']*(["'])/i,
    `$1${alternateUrl}$2`,
  );
}
function focusedRouteNavigation(active,locale='en'){
  const french=locale==='fr';
  const links=Object.entries(ROUTES).map(([slug,cfg])=>
    `<a href="/${slug}/${french?'fr/':''}"${slug===active?' aria-current="page"':''}>${esc(french?(ROUTE_FR[slug]?.navLabel||cfg.navLabel):cfg.navLabel)}</a>`,
  ).join('');
  const title=french?'Calendriers ciblés':'Focused calendars';
  const help=french?'Ouvrir un calendrier consacré à un seul public ou sujet':'Open a calendar dedicated to one audience or subject';
  return `<details class="pmd-focused"><summary><strong>${title}</strong><span>${help}</span></summary><nav aria-label="${title}">${links}</nav></details>`;
}
function replaceStateLink(html,target,href){
  const pattern=new RegExp(`(<a\\b(?=[^>]*\\bdata-state-link=["']${target}["'])[^>]*\\bhref=["'])[^"']*(["'])`,'gi');
  return html.replace(pattern,`$1${href}$2`);
}
function replaceJsonLdString(html,key,value){
  const escaped=String(key).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return html.replace(new RegExp(`("${escaped}"\\s*:\\s*)"(?:\\\\.|[^"\\\\])*"`),`$1${JSON.stringify(value)}`);
}
function buildRoutePage(slug, payload, locale='en'){
  const cfg=ROUTES[slug]; if(!cfg) throw new Error(`unknown Polymythcal route: ${slug}`);
  const french=locale==='fr';
  const copy=french?{...cfg,...ROUTE_FR[slug]}:cfg;
  let html=read(french?'polymythseminars/fr/index.html':'polymythseminars/index.html');
  const englishUrl=`${SITE}/${slug}/`;
  const frenchUrl=`${SITE}/${slug}/fr/`;
  const url=french?frenchUrl:englishUrl;
  const alternateUrl=french?englishUrl:frenchUrl;
  const title=`${copy.heading} | Polymythcal | Seminar Schools`;
  html=replaceMeta(html,'title',title);
  html=replaceMeta(html,'name:description',copy.description);
  html=replaceMeta(html,'property:og:url',url);
  html=replaceMeta(html,'property:og:title',title);
  html=replaceMeta(html,'property:og:description',copy.description);
  if (!/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/i.test(html)) {
    html=html.replace(/(<meta(?=[^>]*\bname=["']viewport["'])[^>]*>)/i,'$1\n<meta name="robots" content="index,follow">');
  }
  html=replaceLocaleLinks(html,englishUrl,frenchUrl,url,alternateUrl);
  html=html.replace(/<body([^>]*)>/i,(m,attrs)=>{
    /* Preserve page-specific body state, but derive the finalizer-owned
       geometry contract from the focused route's own pathname. Cloning the
       Polymythcal shell's key/seed made every generated shortcut depend on the
       source page's camera until the later catch-all finalizer repaired it. */
    let preserved=attrs || '';
    for(const attribute of ['data-route-type','data-geometry','data-indra-intensity','data-geometry-role','data-geometry-key','data-geometry-seed','data-geometry-register','data-geometry-profile','data-geometry-surface','data-front-facing']){
      preserved=preserved.replace(new RegExp(`\\s+${attribute}\\s*=\\s*(["'])[^"']*\\1`,'ig'),'');
    }
    const geometry=geometryBodyAttributes(GEOMETRY_CONTRACTS,`${slug}/${french?'fr/':''}index.html`,'calendar');
    return `<body ${geometry}${preserved} data-pm-route="${slug}" data-pm-default-content="${cfg.defaultContent}">`;
  });
  html=html.replace(
    /<header class="(?:pmd|pm)-header">[\s\S]*?<\/header>/i,
    `<header class="pmd-header"><p class="pmd-kicker"><a href="/">${french?'Calendrier public de Seminar Schools':'Seminar Schools public calendar'}</a></p>
<p class="pmd-commons"><a href="/polymythcommons/">Polymyth Commons</a><span aria-hidden="true"> / </span>${french?'calendrier ciblé':'focused calendar'}</p>
<h1>${esc(copy.heading)}</h1>
<p id="polymythContext">${esc(copy.description)}</p></header>`,
  );
  html=html.replace(
    /(<nav class="pmd-context-nav"[\s\S]*?<\/nav>)/i,
    match => `${match.replace(/\saria-current=["']page["']/gi, '')}\n<section class="pmd-route-context" aria-label="${french?'Contexte du calendrier ciblé':'Focused calendar context'}"><p>${french?`Affichage : ${esc(copy.heading.toLocaleLowerCase('fr-CA'))}. <a href="/polymythseminars/fr/">Parcourir toutes les fiches Polymythcal</a>.`:`Showing ${esc(copy.heading.toLowerCase())}. <a href="/polymythseminars/">Browse all Polymythcal listings</a>.`}</p><p><a href="/polymythseminars/${french?'fr/':''}research/?route=${slug}" data-state-link="research">${french?'Ouvrir les filtres de recherche pour ce calendrier ciblé':'Open Research filters for this focused calendar'}</a>.</p></section>`,
  );
  html=replaceStateLink(html,'research',`/polymythseminars/${french?'fr/':''}research/?route=${slug}`);
  html=replaceStateLink(html,'monitoring',`/polymythseminars/${french?'fr/':''}monitoring/?route=${slug}`);
  html=html.replace(/<details class="pmd-focused"[\s\S]*?<\/details>/i,focusedRouteNavigation(slug,locale));
  html=html.replace(/<h2 id="(?:pmd|pm)ResultsTitle"(?:\s+tabindex="-1")?>[\s\S]*?<\/h2>/i,`<h2 id="pmdResultsTitle" tabindex="-1">${esc(copy.heading)}${french?' — fiches':' listings'}</h2>`);
  const events=(payload.events||[]).filter(e=>matchesRoute(e,slug)).filter(currentEvent).slice(0,40);
  const noScript=`<noscript><section class="pmd-noscript"><h2>${esc(copy.heading)}</h2><p>${french?'Ces fiches courantes sont accessibles sans JavaScript.':'These current listings are available without JavaScript.'}</p><!-- SS_STATIC_EVENTS_START --><ul>${events.map(e=>`<li><a href="/polymythseminars/${french?'fr/':''}events/${encodeURIComponent(e.id)}/"${contentLang(e)}>${esc(e.title)}</a> <span>${esc(String(e.start||e.date||'').slice(0,10))}</span></li>`).join('')}</ul><!-- SS_STATIC_EVENTS_END --><p><a href="/polymythseminars/${french?'fr/':''}subscribe/">${french?'Fils RSS et calendriers':'RSS and calendar feeds'}</a> · <a href="/sitemap/">${french?'Plan du site':'Site map'}</a></p></section></noscript>`;
  html=html.replace(/<noscript>[\s\S]*?<\/noscript>/i,noScript);
  html=replaceJsonLdString(html,'@id',`${url}#webpage`);
  html=replaceJsonLdString(html,'url',url);
  html=replaceJsonLdString(html,'name',title);
  html=replaceJsonLdString(html,'description',copy.description);
  return html;
}
function buildGroup(group, check=false){
  const payload=JSON.parse(read('polymythseminars/browse.json')); let writes=0;
  for(const [slug,cfg] of Object.entries(ROUTES)) {
    if(cfg.group!==group) continue;
    if(write(`${slug}/index.html`,buildRoutePage(slug,payload),check)) writes++;
    if(write(`${slug}/fr/index.html`,buildRoutePage(slug,payload,'fr'),check)) writes++;
  }
  return writes;
}
module.exports={ROUTES,matchesRoute,buildRoutePage,buildGroup};
