#!/usr/bin/env node
'use strict';
// Read-only execution of production closures. This is a DOM stub test, not browser QA.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const CORE = require(path.join(ROOT, 'js/polymythcal-discovery-core.js'));
const failures = [];
let passes = 0;
function test(name, fn) { try { fn(); passes++; console.log('PASS ' + name); } catch (error) { const message=error.message.slice(0,800);failures.push({name, error: message}); console.log('FAIL ' + name + ': ' + message); } }
class FrozenDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-07T16:00:00Z'])); } static now() { return Date.parse('2026-09-07T16:00:00Z'); } }
const origin = 'https://seminarschools.com';
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this._html = ''; this._text = ''; this.hidden = false; }
  set id(v) { this.attrs.id = v; } get id() { return this.attrs.id || ''; }
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
  set href(v) { this.attrs.href = String(v); } get href() { return new URL(this.attrs.href || '', origin).href; }
  get classList() { return {contains: c => this.className.split(/\s+/).includes(c)}; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(v) { this._html = String(v); this.children = []; this._text = ''; for (const m of this._html.matchAll(/<ul class="(pm-(?:saved|search)-list)"><\/ul>/g)) { const ul = new Element('ul'); ul.className = m[1]; this.appendChild(ul); } }
  get innerHTML() { return this._html; }
  setAttribute(k,v) { this.attrs[k] = String(v); if(k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v); }
  getAttribute(k) { return Object.hasOwn(this.attrs,k) ? this.attrs[k] : null; }
  hasAttribute(k) { return Object.hasOwn(this.attrs,k); }
  appendChild(el) { el.parentNode=this; this.children.push(el); return el; }
  append(...els) { for(const el of els)this.appendChild(el); }
  insertAdjacentElement(where, el) { const parent=this.parentNode; assert.ok(parent,'fixture node has parent'); el.parentNode=parent; const i=parent.children.indexOf(this); parent.children.splice(i+(where==='afterend'?1:0),0,el); }
  insertAdjacentHTML(where,html) { this._html=where==='afterbegin'?String(html)+this._html:this._html+String(html); }
  addEventListener(type,fn) { (this.listeners[type] ||= []).push(fn); }
  click() { for(const fn of this.listeners.click||[])fn({target:this,currentTarget:this}); }
  focus() {}
  matches(selector) {
    selector=selector.trim();
    const tag=/^[a-z][a-z0-9-]*/i.exec(selector); if(tag&&this.tagName!==tag[0].toUpperCase())return false;
    for(const m of selector.matchAll(/#([\w-]+)/g))if(this.id!==m[1])return false;
    for(const m of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;
    for(const m of selector.matchAll(/\[([\w-]+)(?:(\*?=)"([^"]*)")?\]/g)){const val=this.getAttribute(m[1]);if(val===null)return false;if(m[2]==='='&&val!==m[3])return false;if(m[2]==='*='&&!val.includes(m[3]))return false;}
    return true;
  }
  querySelectorAll(selector) {
    const all=[]; const visit=n=>{for(const c of n.children){all.push(c);visit(c);}};visit(this);
    return all.filter(node=>selector.split(',').some(part=>{
      const parts=part.trim().split(/\s+(?![^[]*\])/); if(!node.matches(parts.pop()))return false;
      let parent=node.parentNode;while(parts.length){const wanted=parts.pop();while(parent&&!parent.matches(wanted))parent=parent.parentNode;if(!parent)return false;parent=parent.parentNode;}return true;
    }));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0]||null; }
}
function makeEnv(url='/polymythseminars/', lang='en-CA') {
  const document=new Element('document');document.body=new Element('body');document.documentElement={lang};document.appendChild(document.body);document.title='Fixture calendar';document.readyState='complete';
  document.createElement=tag=>new Element(tag);document.createTextNode=text=>{const e=new Element('text');e.textContent=text;return e;};document.dispatchEvent=event=>{for(const fn of document.listeners[event.type]||[])fn(event);};
  const location=new URL(url,origin), data=new Map();
  const localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  let facetCalls=0;const measuredCore={...CORE,facetCounts(...args){facetCalls++;return CORE.facetCounts(...args)}};const window={location,PolymythcalDiscoveryCore:measuredCore,addEventListener(){},setTimeout,clearTimeout,history:{replaceState(){},pushState(){}}};
  const env={document,window,location,localStorage,history:window.history,URL,URLSearchParams,Date:FrozenDate,Intl,console,Set,Map,Array,Object,Number,String,Boolean,Math,JSON,RegExp,Error,CustomEvent:class{},setTimeout,clearTimeout};
  env.facetCalls=()=>facetCalls;vm.createContext(env);return env;
}
function mountDiscovery(locale='en-CA',surface='main') {
  const env=makeEnv(locale==='fr-CA'?'/polymythseminars/fr/':'/polymythseminars/',locale);
  Object.assign(env.document.body.dataset,{pmdSurface:surface});
  for(const id of ['pmdList','pmdPagination','pmdLiveStatus','pmdCalendar']) { const e=new Element('div');e.id=id;env.document.body.appendChild(e); }
  let src=fs.readFileSync(path.join(ROOT,'js/polymythcal-discovery.js'),'utf8');const cut=src.lastIndexOf('\n  bindEvents();');assert.ok(cut>0);
  src=src.slice(0,cut)+`\n globalThis.api={state,normalizeEvent,eventActions,eventCard,calendarMonth,clearFilters,optionCount,axisMarkup,taxonomyFromPayload,renderCommonFilters,bindEvents,readStateFromUrl,renderAll,setRoute(v){routeScope=v;},referenceCount(key,value){if(key==='date'){return events.reduce((n,event)=>{if(!eventPasses(event,'date'))return n;const prior=state.date;state.date=value;const match=eventMatchesDate(event);state.date=prior;return n+(match?1:0)},0)}const eligible=events.filter(event=>routeMatches(event)&&eventMatchesDate(event)&&(!state.q||event._queryMatched));if(key==='kind'&&value==='all')return eligible.filter(event=>CORE.matchesFacets(event,state.facets,key)).length;return CORE.facetCounts(eligible,state.facets,key).get(value)||0},eventOccursOnDay,isDateRange,dayInSelectedWindow,detailHref,rangeList,renderList,renderCalendar,calendarMonthEvents,dayValue,buildResultGroups,setRows(rows){events=rows;filteredEvents=rows;resultGroups=buildResultGroups(rows);activeToday=dayValue('2026-09-07');},setAxes(v){axes=v;}};\n})();`;
  vm.runInContext(src,env,{filename:'production-discovery.js'});return env;
}
function basicEvent(api,overrides={}) { return api.normalizeEvent({id:'test-event',title:'Useful event',date:'2026-09-10',description:'A bounded source description.',facets:{kind:['apply'],what:[]},actions:[],...overrides}); }
function mountFeatures(url='/polymythseminars/events/test-event/',lang='en-CA') {
  const env=makeEnv(url,lang);env.document.body.setAttribute('data-event-id','test-event');
  const main=new Element('main'),nav=new Element('nav'),back=new Element('a'),alternate=new Element('a'),article=new Element('article'),h1=new Element('h1'),actions=new Element('div');
  nav.className='pm-event-nav';back.setAttribute('data-calendar-return','');back.href='/polymythseminars/';back.textContent='← All listings';alternate.setAttribute('hreflang','fr-CA');alternate.href='/polymythseminars/fr/events/test-event/';nav.append(back,alternate);h1.textContent='Useful event';actions.className='pm-event-actions';article.append(h1,actions);main.append(nav,article);env.document.body.appendChild(main);
  let src=fs.readFileSync(path.join(ROOT,'js/polymythcal-features.js'),'utf8');const cut=src.lastIndexOf("\nif(document.readyState===");assert.ok(cut>0);
  src=src.slice(0,cut)+`\nglobalThis.api={init,currentLang,localizeHref,eventData,injectSaveButtons,toggleEvent,savedEvents,savedSearches,removeSaved,removeSearch,safeCalendarReturn,restoreCalendarReturn,syncUrl,renderSaved,injectCurrentSavedTools};\n})();`;
  vm.runInContext(src,env,{filename:'production-features.js'});return env;
}

// Regression assertions execute production closures without network or real browser storage.
{
 const env=mountDiscovery('en-CA','monitoring');const row=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars/watchlist.json'),'utf8')).items[0];const html=env.api.eventCard(env.api.normalizeEvent(row,true));
 assert.match(html, /<h3[^>]*>\s*<a/);
 const f=mountFeatures('/polymythseminars/monitoring/');const a=new Element('article');a.setAttribute('data-event-id',row.id);const h=new Element('h3');if(/<h3[^>]*>\s*<a/.test(html)){const titleLink=new Element('a');titleLink.href='/polymythseminars/events/'+row.id+'/';titleLink.textContent=row.title;h.appendChild(titleLink)}else h.textContent=row.title;a.appendChild(h);const actions=new Element('div');actions.className='pmd-card-actions';const detail=new Element('a');detail.href='/polymythseminars/events/'+row.id+'/';detail.textContent='Details';actions.appendChild(detail);a.appendChild(actions);assert.ok(f.api.eventData(a));
}
{
 const env=mountFeatures('/polymythseminars/research/','en-CA');env.localStorage.setItem('polymythcal.lang.v1','fr');assert.equal(env.api.currentLang(),'en');
 assert.equal(env.api.localizeHref('/polymythseminars/events/test-event/'),'/polymythseminars/events/test-event/');
}
{
 const env=mountFeatures();env.api.init();env.localStorage.setItem=()=>{throw new Error('QuotaExceededError')};env.document.querySelector('.save-event').click();assert.match(env.document.querySelector('#pmStatus').textContent,/Could not save/);assert.equal(env.api.savedEvents().length,0);assert.equal(env.document.querySelector('.save-event').getAttribute('aria-pressed'),'false');
}
{
 const env=mountFeatures();env.localStorage.setItem('polymythcal.savedEvents.v1',JSON.stringify([{id:'old',title:'Old event',href:'/polymythseminars/events/old/'}]));env.localStorage.setItem=()=>{throw new Error('QuotaExceededError')};assert.equal(env.api.savedEvents()[0],'old');assert.ok(env.localStorage.getItem('polymythcal.savedEvents.v1'));assert.equal(env.api.savedEvents()[0],'old');
}
{
 const env=mountFeatures();env.localStorage.setItem('polymythcal.savedEventMeta.v1','42');assert.doesNotThrow(()=>env.api.toggleEvent({id:'test-event',title:'Useful event',href:'/polymythseminars/events/test-event/'}));assert.equal(env.api.savedEvents()[0],'test-event');
}
{
 const env=mountDiscovery();env.api.state.date='7d';env.api.state.view='calendar';env.api.state.month='2026-12';env.api.clearFilters(true);assert.equal(env.api.state.month,'');
}
{
 const env=mountDiscovery();const payload=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars/browse.json'),'utf8'));env.api.setRows(payload.events.map(e=>env.api.normalizeEvent(e)));env.api.setAxes(env.api.taxonomyFromPayload(payload));
 const axes=['kind','date','places','topics','audiences','formats'];for(let run=0;run<3;run++){const start=process.hrtime.bigint();let len=0;for(const a of axes)len+=env.api.axisMarkup(a).length;console.log('Common-filter markup ms',Number(process.hrtime.bigint()-start)/1e6,'html bytes',len,'facetCounts calls total',env.facetCalls());}
}

{
 const env=mountFeatures('/polymythseminars/correct/?event=https%3A%2F%2Fseminarschools.com%2Fpolymythseminars%2Fevents%2Ftest-event%2F');env.document.body.attrs={};const input=new Element('input');input.id='listing_url';input.value='';env.document.body.appendChild(input);env.api.init();assert.equal(input.value,'https://seminarschools.com/polymythseminars/events/test-event/');
}

{
 const env=mountDiscovery();const payload=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars/browse.json'),'utf8'));
 for(let run=0;run<3;run++){let start=process.hrtime.bigint();const rows=payload.events.map(e=>env.api.normalizeEvent(e));console.log('Normalize production rows ms',Number(process.hrtime.bigint()-start)/1e6);env.api.setRows(rows.filter(e=>String(e.end_date||e.date)>='2026-09-07'));start=process.hrtime.bigint();env.api.renderCalendar();console.log('Calendar September render ms',Number(process.hrtime.bigint()-start)/1e6,'HTML chars',env.document.querySelector('#pmdCalendar').innerHTML.length);}
}

{
 const env=mountDiscovery();const payload=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars/browse.json'),'utf8'));const Native=Intl.DateTimeFormat;let calls=0;const cache=new Map();
 Intl.DateTimeFormat=function(...args){calls++;const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,new Native(...args));return cache.get(key)};
 try{const start=process.hrtime.bigint();payload.events.map(e=>env.api.normalizeEvent(e));console.log('Normalize with formatter reuse ms',Number(process.hrtime.bigint()-start)/1e6,'formatter calls',calls,'unique',cache.size);}finally{Intl.DateTimeFormat=Native}
}

{
 const env=mountDiscovery();const payload=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars/browse.json'),'utf8'));let rows=payload.events.map(e=>env.api.normalizeEvent(e));env.api.setRows(rows);const axes=env.api.taxonomyFromPayload(payload);env.api.setAxes(axes);
 const scenarios=[['initial',()=>{}],['7-day',()=>env.api.state.date='7d'],['apply',()=>env.api.state.facets.kind=new Set(['apply'])],['humanities',()=>env.api.state.facets.topics=new Set(['humanities'])],['query',()=>env.api.state.q='philosophy'],['clear',()=>env.api.clearFilters(true)],['all-dates',()=>env.api.state.date='all'],['route-cfps',()=>env.api.setRoute('cfps')],['30-day',()=>env.api.state.date='30d'],['replace-data',()=>env.api.setRows(rows.slice(0,600))],['clear-reduced-data',()=>env.api.clearFilters(true)],['restore-data',()=>env.api.setRows(rows)]];
 let checked=0;for(const [name,change]of scenarios){change();env.api.renderAll();for(const [axis,definition]of axes){for(const option of definition.options){assert.equal(env.api.optionCount(axis,option.value),env.api.referenceCount(axis,option.value),name+' '+axis+' '+option.value);checked++}}assert.equal(env.api.optionCount('kind','all'),env.api.referenceCount('kind','all'),name+' kind all');checked++;}
 console.log('PASS cache invalidation parity',scenarios.length,'state changes;',checked,'count comparisons');
}
{
 const env=mountFeatures();let focused=null;Element.prototype.focus=function(){focused=this};env.api.init();env.api.toggleEvent({id:'other',title:'Other',href:'/polymythseminars/events/other/'});env.api.toggleEvent({id:'third',title:'Third',href:'/polymythseminars/events/third/'});env.api.removeSaved('other');assert.ok(focused&&focused.className.includes('saved-remove'));env.api.removeSaved('third');assert.equal(focused,env.document.querySelector('#pmSavedToggle'));console.log('PASS saved removal focuses remaining control and then toggle');
}
{
 const env=mountFeatures('/polymythseminars/correct/?event='+encodeURIComponent('https://evil.example/polymythseminars/events/x/'));env.document.body.attrs={};const input=new Element('input');input.id='listing_url';input.value='';env.document.body.appendChild(input);env.api.init();assert.equal(input.value,'');console.log('PASS correction prefill rejects external event route');
}

console.log("COMPREHENSIVE CALENDAR REGRESSIONS PASSED — storage, migrations, monitoring, language, correction context, month reset, cache invalidation and keyboard removal.");
