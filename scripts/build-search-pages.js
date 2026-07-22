#!/usr/bin/env node
/**
 * Static search-surface builder for Seminar Schools.
 *
 * Generates crawlable HTML from the same data already used by the interactive
 * teacher-resource catalog, seminar calendar, and polymyth methodology list.
 * The browser still enhances these pages with filters and calendars, while a
 * non-JS fetch receives real text, internal links, canonical URLs, and schema.
 *
 * Run after content updates:
 *   node scripts/build-search-pages.js
 * Verify without writes:
 *   node scripts/build-search-pages.js --check
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
// Keep generation aligned with the site’s publication date, rather than container UTC.
const TODAY = process.env.SITE_BUILD_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
const CHECK = process.argv.includes('--check');
let writes = 0;
let errors = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function write(rel, content) {
  const file = path.join(ROOT, rel);
  if (CHECK) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) errors.push(`stale generated file: ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
    fs.writeFileSync(file, content, 'utf8');
    writes++;
  }
}
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function attr(value) { return esc(value); }
function linkExternalUrls(value) {
  return esc(value).replace(/https?:\/\/[^\s<]+/g, function(url) {
    const m = url.match(/[.,;:!?]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${tail}`;
  });
}
function slug(value) {
  const core = String(value || 'resource').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 76);
  return core || 'resource';
}
function hash(value) { return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8); }
function eventRoute(event) {
  const id = String(event.id || event.identity_key || event.title || 'event');
  return `/polymythseminars/events/${encodeURIComponent(id)}/`;
}
function stripTags(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function cleanSentence(value, limit = 156) {
  const text = stripTags(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  const clip = text.slice(0, Math.max(1, limit - 1));
  const boundary = Math.max(clip.lastIndexOf('. '), clip.lastIndexOf('; '), clip.lastIndexOf(', '));
  return (boundary > 80 ? clip.slice(0, boundary) : clip).trim() + '…';
}
function toIso(date) {
  if (!date) return '';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
function humanDate(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date || 'Date to be confirmed');
  return new Intl.DateTimeFormat('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto', timeZoneName: 'short' }).format(d);
}
function geometryIntensity(canonical) {
  if (/\/polymythseminars\//.test(canonical)) return '0.120';
  if (/\/teacherresources\//.test(canonical)) return '0.070';
  if (canonical.includes('/saul/')) return '0.085';
  return '0.075';
}
function pageHead({ title, description, canonical, schema = [], robots = 'index,follow', css = '/teacherresources/catalog.css' }) {
  const cards = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Seminar Schools">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${attr(canonical)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(description)}">`
  ].join('\n');
  const schemas = schema.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n');
  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${robots}">
<meta name="generator" content="Seminar Schools Static Search Surface">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
<link rel="stylesheet" href="${css}">
<link rel="stylesheet" href="/css/alive.css?v=cl91">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a">
${cards}
${schemas}
</head>`;
}
function breadcrumb(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type':'ListItem', position:i+1, name:item.name, item:item.url }))
  };
}
function htmlPage({title, description, canonical, crumbs, body, schema = [], robots, css, routeType}) {
  const typeAttr = routeType || (canonical.includes('/polymyth/methodologylist/') ? 'archive' : canonical.includes('/teacherresources/') ? 'resource-catalog' : canonical.includes('/polymythseminars/events/') ? 'calendar' : 'archive');
  const graph = [
    { '@context':'https://schema.org', '@type':'WebPage', '@id': canonical + '#webpage', url: canonical, name:title, description, inLanguage:'en-CA', isPartOf:{ '@id': SITE + '/#website' } },
    ...(crumbs ? [breadcrumb(crumbs)] : []),
    ...schema
  ];
  return `${pageHead({title, description, canonical, schema:graph, robots, css})}
<body data-route-type="${attr(typeAttr)}" data-geometry="indra-web" data-indra-intensity="${geometryIntensity(canonical)}">
<a class="skip-link" href="#content">Skip to content</a>
<header class="catalog-top"><a href="/" class="brand">Seminar <em>Schools</em></a><nav aria-label="Primary"><a href="/teacherresources/">Teacher Resources</a><a href="/polymythseminars/">polymythcalendar</a><a href="/leizu/">Leizu Academy</a></nav></header>
<main id="content" class="catalog-page">
${body}
</main>
<footer class="catalog-footer"><a href="/teacherresources/">Teacher Resources</a> · <a href="/">Seminar Schools</a> · Toronto</footer>
<script src="/js/site-keyboard-enhancements.js?v=cl91" defer></script>
<script src="/js/mandala.js?v=cl91" defer></script>
<script src="/js/indra.js?v=cl91" defer></script>
</body>
</html>\n`;
}
function sourcePathFor(route) { return route.replace(/^\//, '').replace(/\/$/, '') + '/index.html'; }
function routeUrl(route) { return SITE + route; }
function replaceDivInner(html, id, inner) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp('<div\\b[^>]*\\bid=[\"\']' + escapedId + '[\"\'][^>]*>', 'i');
  const openMatch = openRe.exec(html);
  if (!openMatch) throw new Error(`Missing div#${id}`);
  const contentStart = openMatch.index + openMatch[0].length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = contentStart;
  let depth = 1, match;
  while ((match = tagRe.exec(html))) {
    if (/^<\/div/i.test(match[0])) depth--; else depth++;
    if (depth === 0) return html.slice(0, contentStart) + inner + html.slice(match.index);
  }
  throw new Error(`Unclosed div#${id}`);
}

function extractJsonScript(html, id) {
  const re = new RegExp(`<script\\s+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
  const match = html.match(re);
  if (!match) throw new Error(`Could not find JSON script #${id}`);
  return JSON.parse(match[1]);
}
function parseSeedArray(html) {
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx < 0) throw new Error('No const SEED found in methodology list');
  const arrStart = html.indexOf('[', seedIdx);
  let depth = 0, inTpl = false, strQuote = null, escape = false, arrEnd = -1;
  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (strQuote) { if (c === strQuote) strQuote = null; continue; }
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  if (arrEnd < 0) throw new Error('Could not find closing SEED bracket');
  // Source is repository-owned data, identical parsing model to the existing mirror builder.
  // eslint-disable-next-line no-eval
  return eval(html.slice(arrStart, arrEnd + 1));
}

const RESOURCE_CSS = `/* Generated static catalog pages: crawlable HTML with the same calm, readable surface. */
:root{--bg:#f7f5ef;--ink:#1f211e;--muted:#65675f;--line:#d9d6ca;--paper:#fffdf8;--accent:#52654d;--gold:#947a2c;--max:980px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Georgia,serif}.catalog-top{display:flex;gap:1.5rem;justify-content:space-between;align-items:center;padding:1rem max(1rem,calc((100vw - var(--max))/2));border-bottom:1px solid var(--line);font-family:Arial,sans-serif;font-size:.9rem}.catalog-top nav{display:flex;gap:1rem;flex-wrap:wrap}.brand{font-size:1.05rem;font-weight:700;text-decoration:none;color:var(--ink);letter-spacing:.02em}.brand em{font-weight:400}.catalog-top a,.catalog-footer a{color:inherit;text-decoration:none;border-bottom:1px solid transparent}.catalog-top a:hover,.catalog-footer a:hover{border-color:currentColor}.catalog-page{max-width:var(--max);margin:0 auto;padding:3rem 1.1rem 4rem}.eyebrow{font:600 .76rem/1.2 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 .75rem}.catalog-page h1{font-size:clamp(2rem,5vw,3.6rem);line-height:1.08;letter-spacing:-.03em;margin:.1rem 0 1rem}.catalog-page h2{font-size:1.45rem;line-height:1.2;margin:2.5rem 0 .8rem}.catalog-page h3{font-size:1.1rem;margin:.2rem 0}.lede{font-size:1.15rem;max-width:70ch;color:#34362f}.breadcrumbs{font:14px/1.4 Arial,sans-serif;color:var(--muted);margin:0 0 1.5rem}.breadcrumbs a{color:inherit}.resource-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:1rem;margin:1.5rem 0}.resource-card{display:block;background:var(--paper);border:1px solid var(--line);padding:1rem 1.05rem;text-decoration:none;color:inherit;border-radius:.35rem}.resource-card:hover{border-color:var(--accent);transform:translateY(-1px)}.resource-card h2{font-size:1.02rem;line-height:1.3;margin:.2rem 0}.resource-card p{font-size:.92rem;color:var(--muted);margin:.55rem 0 0}.resource-meta{font:12px/1.45 Arial,sans-serif;letter-spacing:.015em;color:var(--muted);margin:.5rem 0 0}.resource-list{display:grid;gap:.8rem;margin:1.25rem 0}.resource-row{display:block;background:var(--paper);border:1px solid var(--line);padding:1rem 1.1rem;text-decoration:none;color:inherit;border-radius:.3rem}.resource-row:hover{border-color:var(--accent)}.resource-row h2,.resource-row h3{margin:0;font-size:1.08rem}.resource-row p{margin:.35rem 0 0;color:var(--muted);font-size:.94rem}.button{display:inline-block;background:var(--accent);color:white!important;text-decoration:none;padding:.65rem .9rem;border-radius:.25rem;font:600 .9rem/1 Arial,sans-serif}.button.secondary{background:transparent;color:var(--ink)!important;border:1px solid var(--ink)}.definition{background:var(--paper);border-left:4px solid var(--gold);padding:1.2rem 1.25rem;margin:1.4rem 0}.definition dl{display:grid;grid-template-columns:minmax(120px,180px) 1fr;gap:.35rem 1rem;margin:0}.definition dt{font:600 .84rem/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.definition dd{margin:0}.callout{background:#edf1ea;border-left:4px solid var(--accent);padding:1rem 1.1rem;margin:1.4rem 0}.catalog-footer{max-width:var(--max);margin:0 auto;padding:1.5rem 1.1rem 2.5rem;border-top:1px solid var(--line);font:13px/1.5 Arial,sans-serif;color:var(--muted)}.skip-link{position:absolute;left:-999px;top:0}.skip-link:focus{left:0;background:#fff;padding:.75rem;z-index:3}@media(max-width:650px){.catalog-top{align-items:flex-start;flex-direction:column;gap:.5rem}.catalog-page{padding-top:2rem}.definition dl{grid-template-columns:1fr}.resource-grid{grid-template-columns:1fr}}\n`;
write('teacherresources/catalog.css', RESOURCE_CSS);

function resourceMeta(entry, data) {
  const labels = [];
  if (entry.subject && data.subjects[entry.subject]) labels.push(data.subjects[entry.subject]);
  if (entry.grade && entry.grade !== 'all') labels.push('Grades ' + entry.grade);
  if (entry.curriculum && data.curricula[entry.curriculum]) labels.push(data.curricula[entry.curriculum]);
  if (entry.format && data.formats[entry.format]) labels.push(data.formats[entry.format]);
  if (entry.host) labels.push(entry.host);
  return labels;
}
function resourceDescription(entry, category, group, data) {
  const note = cleanSentence(entry.notes || entry.blurb || '', 300);
  if (note) return note;
  const fields = resourceMeta(entry, data).filter(Boolean);
  const audience = entry.grade && entry.grade !== 'all' ? `Grades ${entry.grade}` : 'Multi-grade classroom use';
  const format = data.formats[entry.format] || entry.format || 'Teaching resource';
  const parts = [format, audience, ...fields.filter(x => x !== format && x !== audience)].slice(0, 4);
  return `${entry.title}. ${parts.join(' · ')}.`;
}
function resourceRoute(group, category, entry, i) {
  const stable = hash(`${group.id}|${category.id}|${entry.title}|${entry.url}|${i}`);
  return `/teacherresources/${slug(group.id)}/${slug(category.id)}/${slug(entry.title)}-${stable}/`;
}
function staticResourceCard(entry, category, group, data, index) {
  const route = resourceRoute(group, category, entry, index);
  const meta = resourceMeta(entry, data);
  const search = [entry.title, entry.author, entry.host, ...(meta || []), category.title, category.kicker, entry.notes, entry.blurb, entry.grade].filter(Boolean).join(' ').toLowerCase();
  const stripe = ({'holt-worktext':'apparatus','pearson-notebook':'apparatus','mcdougal-littell':'apparatus','contest-paper':'apparatus','ib-paper':'apparatus','released-test':'apparatus','full-book':'archive','anthology':'archive','aggregator':'archive','gutenberg-text':'archive','openstax-book':'archive','ck12-book':'archive','khan-course':'archive','french-text':'archive','clean-text':'clean'})[entry.format] || 'clean';
  return `<a class="entry stripe-${stripe}" href="${route}" data-format="${attr(entry.format||'')}" data-grade="${attr(entry.grade||'')}" data-subject="${attr(entry.subject||'')}" data-curriculum="${attr(entry.curriculum||'')}" data-search="${attr(search)}"><div class="entry-main"><div class="entry-title">${esc(entry.title)}</div>${entry.author ? `<div class="entry-byline">${esc(entry.author)}</div>` : ''}</div><div class="entry-meta">${meta.map((m,j)=>`<span class="${j===0?'subj':'host'}">${esc(m)}</span>`).join('')}</div>${entry.notes ? `<div class="entry-notes">${esc(entry.notes)}</div>` : ''}</a>`;
}
function renderResourceCatalogRoot(data) {
  const groups = data.groups || [];
  let globalIndex = 0;
  return groups.map(group => {
    const count = group.categories.reduce((n,c)=>n+c.entries.length,0);
    const cats = group.categories.map(category => {
      const cards = category.entries.map(entry => staticResourceCard(entry, category, group, data, globalIndex++)).join('\n');
      const catRoute = `/teacherresources/${slug(group.id)}/${slug(category.id)}/`;
      return `<details class="category" id="${attr(category.id)}" data-category-id="${attr(category.id)}"><summary class="category-head"><span class="caret" aria-hidden="true">›</span><span class="cat-headtext"><span class="cat-kicker">${esc(category.kicker || 'Collection')}</span><span class="cat-title">${esc(category.title)}</span></span><span class="cat-count" data-cat-count="${attr(category.id)}">${category.entries.length} items</span></summary><div class="cat-body"><p class="cat-blurb">${esc(category.blurb || 'Curated classroom resources.')}</p><p class="seo-collection-link"><a href="${catRoute}">Open ${esc(category.title)}</a></p><div class="entries">${cards}</div></div></details>`;
    }).join('\n');
    const groupRoute = `/teacherresources/${slug(group.id)}/`;
    return `<details class="group" id="grp-${attr(group.id)}" data-group-id="${attr(group.id)}"><summary class="group-head"><span class="caret-g" aria-hidden="true">›</span><span class="grp-headtext"><span class="grp-kicker">${esc(group.kicker || 'Teacher resources')}</span><span class="grp-title">${esc(group.title)}</span></span><span class="grp-count" data-grp-count="${attr(group.id)}"><span class="grp-count-sec">${group.categories.length} collections</span><span class="grp-count-ent">${count} items</span></span></summary><div class="grp-body"><p class="seo-collection-link"><a href="${groupRoute}">Open ${esc(group.title)}</a></p>${cats}</div></details>`;
  }).join('\n');
}
function injectResourceRoot(data) {
  const rel = 'teacherresources/index.html';
  let html = read(rel);
  const markup = renderResourceCatalogRoot(data);
  if (!html.includes('id="catalog"')) throw new Error('Teacher resources catalog injection point is missing');
  html = html.replace(/<div id="catalog"[^>]*>/, '<div id="catalog" data-ssr-catalog="true">');
  html = replaceDivInner(html, 'catalog', `\n<!-- SS_STATIC_CATALOG_START -->\n${markup}\n<!-- SS_STATIC_CATALOG_END -->\n`);
  const marker = '// ---- catalog render: nested group -> category -> entry ----';
  const markerAt = html.indexOf(marker);
  const start = html.indexOf('  GROUPS.forEach(function(grp) {', markerAt);
  const end = html.indexOf('\n  function renderCategory(cat) {', start);
  if (start < 0 || end < 0) throw new Error('Teacher resources client-render block is missing');
  const beforeRender = html.slice(markerAt, start);
  if (!beforeRender.includes("if (!catalog.querySelector('details.group'))")) {
    const block = html.slice(start, end);
    const wrapped = `  if (!catalog.querySelector('details.group')) {\n${block}\n  }`;
    html = html.slice(0,start) + wrapped + html.slice(end);
  }
  write(rel, html);
}
function generateResourcePages(data) {
  const all = [];
  let globalIndex = 0;
  const topCrumbs = [{ name:'Seminar Schools', url:SITE+'/' }, { name:'Teacher Resources', url:SITE+'/teacherresources/' }];
  for (const group of data.groups || []) {
    const groupRoute = `/teacherresources/${slug(group.id)}/`;
    const groupUrl = routeUrl(groupRoute);
    const groupCount = group.categories.reduce((n,c)=>n+c.entries.length,0);
    const groupDesc = `${groupCount} resources for classroom planning, source selection, and lesson design.`;
    const groupCards = group.categories.map(cat => {
      const catRoute = `/teacherresources/${slug(group.id)}/${slug(cat.id)}/`;
      const n = cat.entries.length;
      return `<a class="resource-card" href="${catRoute}"><h2>${esc(cat.title)}</h2><p>${esc(cat.blurb || cat.kicker || 'Curated classroom resources.')}</p><div class="resource-meta">${n} resources</div></a>`;
    }).join('\n');
    const groupBody = `<p class="breadcrumbs"><a href="/">Seminar Schools</a> / <a href="/teacherresources/">Teacher Resources</a> / ${esc(group.title)}</p><p class="eyebrow">Teacher resources</p><h1>${esc(group.title)}</h1><p class="lede">${esc(group.kicker || groupDesc)}</p><div class="resource-grid">${groupCards}</div><p><a class="button secondary" href="/teacherresources/">All teacher resources</a></p>`;
    const groupSchema = [{ '@context':'https://schema.org','@type':'CollectionPage','@id':groupUrl+'#collection',url:groupUrl,name:group.title,description:groupDesc,numberOfItems:groupCount }];
    write(sourcePathFor(groupRoute), htmlPage({ title:`${group.title} | Teacher Resources | Seminar Schools`, description:cleanSentence(groupDesc), canonical:groupUrl, crumbs:[...topCrumbs,{name:group.title,url:groupUrl}], body:groupBody, schema:groupSchema }));
    all.push({route:groupRoute, url:groupUrl, kind:'group'});

    for (const category of group.categories) {
      const catRoute = `/teacherresources/${slug(group.id)}/${slug(category.id)}/`;
      const catUrl = routeUrl(catRoute);
      const catDesc = `${category.entries.length} resources in ${group.title}.`;
      const cards = category.entries.map(entry => {
        const route = resourceRoute(group, category, entry, globalIndex++);
        const d = resourceDescription(entry, category, group, data);
        return `<a class="resource-row" href="${route}"><h2>${esc(entry.title)}</h2>${entry.author ? `<p>${esc(entry.author)}</p>` : ''}<div class="resource-meta">${esc(resourceMeta(entry,data).join(' · '))}</div><p>${esc(cleanSentence(d, 260))}</p></a>`;
      }).join('\n');
      const body = `<p class="breadcrumbs"><a href="/">Seminar Schools</a> / <a href="/teacherresources/">Teacher Resources</a> / <a href="${groupRoute}">${esc(group.title)}</a> / ${esc(category.title)}</p><p class="eyebrow">${esc(group.title)}</p><h1>${esc(category.title)}</h1><p class="lede">${esc(category.blurb || category.kicker || catDesc)}</p><div class="resource-list">${cards}</div><p><a class="button secondary" href="${groupRoute}">Back to ${esc(group.title)}</a></p>`;
      const listSchema = [{ '@context':'https://schema.org','@type':'CollectionPage','@id':catUrl+'#collection',url:catUrl,name:category.title,description:catDesc,numberOfItems:category.entries.length }];
      write(sourcePathFor(catRoute), htmlPage({ title:`${category.title} | Teacher Resources | Seminar Schools`,description:cleanSentence(catDesc),canonical:catUrl,crumbs:[...topCrumbs,{name:group.title,url:groupUrl},{name:category.title,url:catUrl}],body,schema:listSchema }));
      all.push({route:catRoute, url:catUrl, kind:'category'});
    }
  }
  // A second pass mirrors the exact IDs used in the root catalog without index drift.
  globalIndex = 0;
  for (const group of data.groups || []) {
    for (const category of group.categories) {
      for (const entry of category.entries) {
        const route = resourceRoute(group, category, entry, globalIndex++);
        const url = routeUrl(route);
        const groupRoute = `/teacherresources/${slug(group.id)}/`;
        const catRoute = `/teacherresources/${slug(group.id)}/${slug(category.id)}/`;
        const meta = resourceMeta(entry, data);
        const desc = resourceDescription(entry, category, group, data);
        const availability = entry.url ? `<p><a class="button" href="${attr(entry.url)}" target="_blank" rel="noopener noreferrer">Open resource${entry.host ? ` on ${esc(entry.host)}` : ''}</a></p>` : '';
        const sourceHost = entry.host || (entry.url ? (()=>{try{return new URL(entry.url, SITE).hostname.replace(/^www\./,'')}catch(e){return ''}})() : '');
        const titleQualifier = entry.author || sourceHost || (entry.grade && entry.grade !== 'all' ? `Grades ${entry.grade}` : category.title);
        const seoDescription = cleanSentence(`${entry.title} for ${category.title}. ${desc}${sourceHost ? ` Source: ${sourceHost}.` : ''}`, 300);
        const details = [
          ['Collection', `<a href="${catRoute}">${esc(category.title)}</a>`],
          ['Subject', data.subjects[entry.subject] || entry.subject || 'General'],
          ['Grades', entry.grade && entry.grade !== 'all' ? `Grades ${esc(entry.grade)}` : 'General / multi-grade'],
          ['Format', data.formats[entry.format] || entry.format || 'Teaching resource'],
          ['Curriculum', data.curricula[entry.curriculum] || entry.curriculum || 'Cross-curricular'],
          ['Publisher or host', sourceHost || 'Source link supplied']
        ].map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('');
        const review = entry.notes || entry.blurb || `Use this as a ${data.formats[entry.format] || 'teaching'} resource for ${entry.grade && entry.grade !== 'all' ? `grades ${entry.grade}` : 'classroom use'}. The record keeps subject, level, and source visible before you open the original link.`;
        const body = `<p class="breadcrumbs"><a href="/">Seminar Schools</a> / <a href="/teacherresources/">Teacher Resources</a> / <a href="${groupRoute}">${esc(group.title)}</a> / <a href="${catRoute}">${esc(category.title)}</a></p><p class="eyebrow">Curated teaching resource</p><h1>${esc(entry.title)}</h1>${entry.author ? `<p class="lede">By ${esc(entry.author)}</p>` : ''}<div class="definition"><dl>${details}</dl></div><h2>Classroom fit</h2><p>${esc(review)}</p>${availability}<p><a class="button secondary" href="${catRoute}">Back to ${esc(category.title)}</a></p>`;
        const schema = [{ '@context':'https://schema.org','@type':'LearningResource','@id':url+'#resource',url,name:entry.title,description:desc,author:entry.author ? { '@type':'Organization', name:entry.author } : undefined,educationalLevel:entry.grade || undefined,learningResourceType:data.formats[entry.format] || entry.format || undefined,about:data.subjects[entry.subject] || entry.subject || undefined,isPartOf:{'@id':routeUrl(catRoute)+'#collection'},sameAs:entry.url ? new URL(entry.url, SITE).href : undefined }];
        // Avoid serializing undefined properties.
        const normalized = schema.map(o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v !== undefined && v !== '')));
        write(sourcePathFor(route), htmlPage({title:`${entry.title} | ${titleQualifier} | ${category.title} | Seminar Schools`,description:seoDescription,canonical:url,crumbs:[...topCrumbs,{name:group.title,url:routeUrl(groupRoute)},{name:category.title,url:routeUrl(catRoute)},{name:entry.title,url}],body,schema:normalized}));
        all.push({route, url, kind:'resource'});
      }
    }
  }
  return all;
}

function staticEventCard(event) {
  const route = eventRoute(event);
  const date = event.end_date ? `${humanDate(event.date)} to ${humanDate(event.end_date)}` : humanDate(event.date);
  const by = event.speaker_or_director ? `<div class="event-speaker">${esc(event.speaker_or_director)}</div>` : '';
  return `<article class="event" data-date="${attr(event.date || '')}" data-type="${attr(event.type || 'other')}"><div class="date-col"><span class="day">${esc(new Intl.DateTimeFormat('en-CA',{day:'2-digit',timeZone:'America/Toronto'}).format(new Date(event.date)))}</span><span class="mon">${esc(new Intl.DateTimeFormat('en-CA',{month:'short',timeZone:'America/Toronto'}).format(new Date(event.date)))}</span></div><div class="body-col"><h2 class="title"><a href="${route}">${esc(event.title)}</a></h2>${by}<div class="event-meta">${esc(date)}${event.venue ? ` · ${esc(event.venue)}` : ''}</div>${event.description ? `<p class="event-desc">${esc(cleanSentence(event.description,260))}</p>` : ''}</div></article>`;
}
function eventEligible(event) {
  const start = String(event.date || '').slice(0, 10);
  const end = String(event.end_date || event.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < TODAY) return false;
  const horizon = new Date(`${TODAY}T12:00:00-04:00`);
  horizon.setFullYear(horizon.getFullYear() + 1);
  return start <= horizon.toISOString().slice(0, 10);
}
function eventIndexable(event) {
  // Event-detail ownership belongs to build-polymythcal-audit13.py. Keep the
  // sitemap contract aligned with that canonical builder's robots policy.
  const city=String(event.city || '').trim().toLowerCase();
  const venue=String(event.venue || '').trim().toLowerCase();
  const placeholders=new Set(['','unknown','location unconfirmed','location unconfirmed · lieu non confirmé','lieu non confirmé']);
  return event.confirmation_status === 'confirmed'
    && event.date_precision === 'exact'
    && !placeholders.has(city)
    && !placeholders.has(venue)
    && !['cancelled', 'missing-on-source', 'archived'].includes(event.lifecycle_status);
}
function injectEventRoot(events) {
  const rel='polymythseminars/index.html';
  let html=read(rel);
  const current=events.filter(eventEligible).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  // Legacy calendar pages render their complete event list into #eventsContainer.
  // The Audit 16 calendar is intentionally a lightweight client shell backed by
  // /polymythseminars/events.json and stable event-detail pages. Re-injecting all
  // events into that shell would restore the 1.6+ MB page that the revamp removed.
  if (html.includes('id="eventsContainer"')) {
    const markup=`<div class="ssr-event-list" data-ssr-events="true"><p class="sr-only">${current.length} upcoming calendar entries are listed below. Use the controls above to filter them when JavaScript is available.</p>${current.map(staticEventCard).join('\n')}</div>`;
    html=replaceDivInner(html, 'eventsContainer', `<!-- SS_STATIC_EVENTS_START -->${markup}<!-- SS_STATIC_EVENTS_END -->`);
    html=html.replace(/<div class="count-line" id="countLine"[^>]*>[\s\S]*?<\/div>/, `<div class="count-line" id="countLine" role="status" aria-live="polite" aria-atomic="true">${current.length} upcoming events</div>`);
    write(rel,html);
    return current;
  }

  const clientShell = html.includes('id="pmEventList"')
    && /\/js\/polymythcal-revamp\.js/.test(html)
    && /<noscript>[\s\S]*RSS and calendar feeds[\s\S]*site map/i.test(html);
  if (clientShell) {
    // Remove stale legacy payloads if an older generated page was merged into the
    // new shell. The live controller fetches the canonical JSON data instead.
    html=html.replace(/<!-- SS_STATIC_EVENTS_START -->[\s\S]*?<!-- SS_STATIC_EVENTS_END -->/g, '');
    write(rel,html);
    return current;
  }

  throw new Error('Calendar root supports neither the legacy #eventsContainer mount nor the Polymythcal client-shell contract');
}
function archiveGeneratedEventPage(ix) {
  if (!fs.existsSync(ix)) return;
  let html = fs.readFileSync(ix, 'utf8');
  const robots = /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/i;
  if (robots.test(html)) html = html.replace(robots, '<meta name="robots" content="noindex,follow">');
  else html = html.replace('</head>', '<meta name="robots" content="noindex,follow">\n</head>');
  html = html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>\s*\{[^<]*"@type"\s*:\s*"Event"[^<]*\}\s*<\/script>\s*/gi, '');
  html = html.replace(/"eventStatus"\s*:\s*"https:\/\/schema\.org\/EventScheduled"/g, '"eventStatus":"https://schema.org/EventCompleted"');
  html = html.replace('\n<script defer src="/js/site-keyboard-enhancements.js"></script>', '');
  if (!html.includes('data-event-archive-note')) {
    const note = '<div class="callout" data-event-archive-note="true"><strong>Past event.</strong> This permalink is retained as an archive record. Check the original source for a current edition or related event.</div>';
    html = html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1${note}`);
  }
  write(path.relative(ROOT, ix).split(path.sep).join('/'), html);
}
function archiveExpiredStableEventPages(events) {
  for (const event of events) {
    if (eventEligible(event)) continue;
    const stable = path.join(ROOT, sourcePathFor(eventRoute(event)));
    archiveGeneratedEventPage(stable);
  }
}
function cleanGeneratedEventPages(currentRoutes) {
  const base = path.join(ROOT, 'polymythseminars', 'events');
  if (!fs.existsSync(base)) return;
  const keep = new Set(currentRoutes.map(route => path.join(ROOT, sourcePathFor(route))));
  for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const ix = path.join(base, ent.name, 'index.html');
    if (!keep.has(ix)) archiveGeneratedEventPage(ix);
  }
}
function generateEventPages(events) {
  const currentEventRoutes = events.filter(eventEligible).map(eventRoute);
  cleanGeneratedEventPages(currentEventRoutes);
  const indexable=[];
  for (const event of events.filter(eventEligible)) {
    const route=eventRoute(event);
    const url=routeUrl(route);
    const dateLabel=event.end_date ? `${humanDate(event.date)} to ${humanDate(event.end_date)}` : humanDate(event.date);
    const baseDescription=event.description || `${event.title}${event.venue ? ` at ${event.venue}` : ''}.`;
    const desc=cleanSentence(`${event.title}. ${dateLabel}${event.venue ? ` at ${event.venue}.` : ''} ${baseDescription}`, 300);
    const source = event.source_url ? `<p><a class="button" href="${attr(event.source_url)}" target="_blank" rel="noopener noreferrer">Open the event source</a></p>` : '';
    const status = eventIndexable(event) ? '' : `<div class="callout"><strong>Calendar status.</strong> This listing remains visible in the calendar, and the source link is provided for final confirmation before attending.</div>`;
    const fields=[['Date',dateLabel],['Format',event.type || 'Event'],['Venue',event.venue || 'Venue to be confirmed'],['Speaker or artist',event.speaker_or_director || 'See source'],['Audience',event.age_band || 'Open / see source']].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    const body=`<p class="breadcrumbs"><a href="/">Seminar Schools</a> / <a href="/polymythseminars/">polymythcalendar</a> / ${esc(event.title)}</p><p class="eyebrow">polymythcalendar · regional public events</p><h1>${esc(event.title)}</h1><div class="definition"><dl>${fields}</dl></div>${event.description ? `<h2>About this listing</h2><p>${esc(event.description)}</p>` : ''}${status}${source}<p><a class="button secondary" href="/polymythseminars/">Back to polymythcalendar</a></p>`;
    const schema=[];
    if (eventIndexable(event)) {
      const eventSchema={'@context':'https://schema.org','@type':'Event','@id':url+'#event',name:event.title,startDate:toIso(event.date),endDate:toIso(event.end_date)||undefined,description:desc,url,location:event.venue?{'@type':'Place',name:event.venue}:undefined,performer:event.speaker_or_director?{'@type':'Person',name:event.speaker_or_director}:undefined,eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',eventStatus:'https://schema.org/EventScheduled'};
      schema.push(Object.fromEntries(Object.entries(eventSchema).filter(([,v])=>v!==undefined&&v!=='')));
      indexable.push({route,url});
    }
    write(sourcePathFor(route),htmlPage({title:`${event.title} | ${String(event.date || '').slice(0,10)} | polymythcalendar | Seminar Schools`,description:desc,canonical:url,crumbs:[{name:'Seminar Schools',url:SITE+'/'},{name:'polymythcalendar',url:SITE+'/polymythseminars/'},{name:event.title,url}],body,schema,robots:eventIndexable(event)?'index,follow':'noindex,follow'}));
  }
  return indexable;
}

const SECTION_LABELS={methodology:'Methodology',gorgonification:'Gorgonification',degorgonification:'Degorgonification',analysis:'Analysis',sabachtan:'Sabachtan Gnosticism',idiomary:'Idiomary',citation:'Citations',studylist:'Study List',rainbowsol:'Rainbowsol',polycognate:'Polycognate',learnings:'Learnings',coreplus:'CORE+',corehistory:'CORE History','framework-core':'Framework Core',pending:'Pending'};
function methodologyStaticIndex(seed) {
  const counts={}; seed.forEach(e=>counts[e.s||'unknown']=(counts[e.s||'unknown']||0)+1);
  const links=Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0])).map(([section,count])=>`<a class="resource-card" href="/polymyth/methodologylist/${slug(section)}/"><h3>${esc(SECTION_LABELS[section]||section)}</h3><p>${count} indexed framework entries in a static HTML edition.</p></a>`).join('\n');
  return `<section id="static-methodology-editions" class="static-methodology-editions" aria-label="Static methodology editions"><p class="eyebrow">Static HTML editions</p><h2>Browse the framework by section</h2><p>Each section is available as a crawlable HTML edition with permanent entry anchors. The interactive editor remains available below.</p><div class="resource-grid">${links}</div></section>`;
}
function injectMethodologyRoot(seed) {
  const rel='polymyth/methodologylist/index.html'; let html=read(rel);
  const markup=methodologyStaticIndex(seed);
  const re=/<main>\s*\n\s*<div class="tabs"/;
  if (html.includes('id="static-methodology-editions"')) {
    html = html.replace(/<section id="static-methodology-editions"[\s\S]*?<\/section>\s*/i, markup + '\n');
  } else {
    if(!re.test(html)) throw new Error('Methodology static index injection point is missing');
    html=html.replace(re, `<main>\n${markup}\n<div class="tabs"`);
  }
  // Lightweight styling shares page variables without importing broad new design dependencies.
  if(!html.includes('.static-methodology-editions')) {
    html=html.replace('</style>', `.static-methodology-editions{margin:28px 0;padding:18px;border:1px solid var(--brd);background:var(--bg1)}.static-methodology-editions h2{font-size:22px;color:var(--txt);margin:0 0 8px}.static-methodology-editions p{color:var(--dim);max-width:70ch}.static-methodology-editions .resource-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.static-methodology-editions .resource-card{display:block;padding:12px;border:1px solid var(--brd);background:var(--bg2);color:var(--txt);text-decoration:none}.static-methodology-editions .resource-card:hover{border-color:var(--fire)}.static-methodology-editions .resource-card h3{margin:0 0 5px;font-size:15px}.static-methodology-editions .resource-card p{font-size:12px;margin:0}.static-methodology-editions .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--fire2)}\n</style>`);
  }
  write(rel,html);
}
function generateMethodologyPages(seed) {
  const by={}; for(const e of seed){(by[e.s||'unknown'] ||= []).push(e);}
  const routes=[];
  for(const section of Object.keys(by).sort()) {
    const entries=by[section];
    const route=`/polymyth/methodologylist/${slug(section)}/`; const url=routeUrl(route);
    const label=SECTION_LABELS[section]||section;
    const cards=entries.map((entry,index)=>{
      const anchor=entry.id || `${section}-${slug(entry.t)}-${hash(entry.t+'|'+index)}`;
      const tags=entry.tg ? `<div class="resource-meta">${esc(entry.tg)}</div>` : '';
      return `<article class="resource-row" id="${attr(anchor)}"><h2>${esc(entry.t || 'Untitled entry')}</h2><p>${linkExternalUrls(entry.b || '')}</p>${entry.x ? `<p>${linkExternalUrls(entry.x)}</p>`:''}${tags}<p><a href="#${attr(anchor)}">Permanent link</a></p></article>`;
    }).join('\n');
    const desc=`${entries.length} polymyth framework entries in the ${label} section, presented as a static HTML reference edition.`;
    const body=`<p class="breadcrumbs"><a href="/">Seminar Schools</a> / <a href="/polymyth/methodologylist/">Polymyth Methodologylist</a> / ${esc(label)}</p><p class="eyebrow">Polymyth framework</p><h1>${esc(label)}</h1><p class="lede">${esc(desc)}</p><p class="archive-route-note route-note">Static archive route for this methodologylist section. Use this page for crawlable entry anchors, or open the interactive methodologylist for search and full navigation.</p><p><a class="button secondary" href="/polymyth/methodologylist/">Open the interactive methodologylist</a></p><div class="resource-list">${cards}</div>`;
    const schema=[{'@context':'https://schema.org','@type':'CollectionPage','@id':url+'#collection',url,name:`Polymyth Methodologylist: ${label}`,description:desc,numberOfItems:entries.length}];
    write(sourcePathFor(route),htmlPage({title:`${label} | Polymyth Methodologylist | Seminar Schools`,description:desc,canonical:url,crumbs:[{name:'Seminar Schools',url:SITE+'/'},{name:'Polymyth Methodologylist',url:SITE+'/polymyth/methodologylist/'},{name:label,url}],body,schema,css:'/teacherresources/catalog.css'}));
    routes.push({route,url});
  }
  return routes;
}

function escapeXml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function generateSitemap(generated) {
  const existing=read('sitemap.xml');
  const existingUrls=[...existing.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  // Remove only routes owned by this generated surface. Preserve hand-authored
  // teacher-resource and methodology pages that happen to share a parent path.
  const groupPrefixes=[...new Set(generated.resources.filter(x=>x.kind==='group').map(x=>x.url))];
  const eventPrefix=SITE+'/polymythseminars/events/';
  const methodologyPrefixes=[...new Set(generated.methodology.map(x=>x.url))];
  const retiredPrefixes=[SITE+'/teacherresources/lang-hughes/', SITE+'/polymyth/methodologylist/core/'];
  const keep=existingUrls.filter(u=> !retiredPrefixes.some(p=>u===p || u.startsWith(p)) && !groupPrefixes.some(p=>u===p || u.startsWith(p)) && !u.startsWith(eventPrefix) && !methodologyPrefixes.some(p=>u===p || u.startsWith(p)));
  const all=[...new Set([...keep, SITE+'/teacherresources/', SITE+'/polymythseminars/subscribe/', ...generated.resources.map(x=>x.url), ...generated.events.map(x=>x.url), ...generated.methodology.map(x=>x.url)])].sort((a,b)=>a.localeCompare(b));
  const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for(const url of all) xml.push(`  <url><loc>${escapeXml(url)}</loc><lastmod>${TODAY}</lastmod></url>`);
  xml.push('</urlset>','');
  write('sitemap.xml',xml.join('\n'));
  return all;
}

function main(){
  try{
    const resourceHtml=read('teacherresources/index.html');
    const resourceData=extractJsonScript(resourceHtml,'resources-data');
    injectResourceRoot(resourceData);
    const resources=generateResourcePages(resourceData);

    const events=JSON.parse(read('polymythseminars/events.json')).events || [];
    injectEventRoot(events);
    // Stable event pages, legacy aliases, and per-event ICS files are generated
    // by the canonical PolymythCAL builder. The deploy build still refreshes
    // archive status as dates pass, then contributes only current, indexable
    // routes to the sitemap. Redirect aliases remain untouched.
    const eventIndex=events.filter(event => eventEligible(event) && eventIndexable(event)).map(event => {
      const route=eventRoute(event);
      return {route,url:routeUrl(route)};
    });

    const methodHtml=read('polymyth/methodologylist/index.html');
    const seed=parseSeedArray(methodHtml);
    injectMethodologyRoot(seed);
    const methodology=generateMethodologyPages(seed);

    const sitemap=generateSitemap({resources,events:eventIndex,methodology});
    const summary={resourceRoutes:resources.length,resourceDetailPages:resources.filter(x=>x.kind==='resource').length,resourceCollectionPages:resources.filter(x=>x.kind!=='resource').length,upcomingEvents:events.filter(eventEligible).length,indexableEvents:eventIndex.length,methodologyEntries:seed.length,methodologySections:methodology.length,sitemapUrls:sitemap.length};
    write('scripts/search-surface-manifest.json',JSON.stringify(summary,null,2)+'\n');
    console.log(`SEARCH SURFACE ${CHECK?'CHECK':'BUILD'} — ${resources.length} resource pages, ${eventIndex.length} indexable event pages, ${methodology.length} methodology sections, ${sitemap.length} sitemap URLs${CHECK?'':`, ${writes} files updated`}.`);
  }catch(err){
    console.error('SEARCH SURFACE BUILD FAILED:',err.stack||err.message);
    process.exit(1);
  }
  if(errors.length){errors.forEach(e=>console.error('FAIL '+e));process.exit(1);}
}
main();
