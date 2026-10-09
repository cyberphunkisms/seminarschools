#!/usr/bin/env node
'use strict';
// Read-only execution of production closures. This is a DOM stub test, not browser QA.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = process.argv[2] || path.resolve(__dirname, '..');
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
  const window={location,PolymythcalDiscoveryCore:CORE,addEventListener(){},setTimeout,clearTimeout,history:{replaceState(){},pushState(){}}};
  const env={document,window,location,localStorage,history:window.history,URL,URLSearchParams,Date:FrozenDate,Intl,console,Set,Map,Array,Object,Number,String,Boolean,Math,JSON,RegExp,Error,CustomEvent:class{},setTimeout,clearTimeout};
  vm.createContext(env);return env;
}
function mountDiscovery(locale='en-CA') {
  const env=makeEnv(locale==='fr-CA'?'/polymythseminars/fr/':'/polymythseminars/',locale);
  Object.assign(env.document.body.dataset,{pmdSurface:'main'});
  for(const id of ['pmdList','pmdPagination','pmdLiveStatus','pmdCalendar']) { const e=new Element('div');e.id=id;env.document.body.appendChild(e); }
  let src=fs.readFileSync(path.join(ROOT,'js/polymythcal-discovery.js'),'utf8');const cut=src.lastIndexOf('\n  bindEvents();');assert.ok(cut>0);
  src=src.slice(0,cut)+`\n globalThis.api={state,normalizeEvent,eventActions,eventCard,calendarMonth,eventOccursOnDay,isDateRange,dayInSelectedWindow,detailHref,rangeList,renderList,renderCalendar,calendarMonthEvents,dayValue,buildResultGroups,setRows(rows){events=rows;filteredEvents=rows;resultGroups=buildResultGroups(rows);activeToday=dayValue('2026-09-07');},setAxes(v){axes=v;}};\n})();`;
  vm.runInContext(src,env,{filename:'production-discovery.js'});return env;
}
function basicEvent(api,overrides={}) { return api.normalizeEvent({id:'test-event',title:'Useful event',date:'2026-09-10',description:'A bounded source description.',facets:{kind:['apply'],what:[]},actions:[],...overrides}); }
function mountFeatures(url='/polymythseminars/events/test-event/',lang='en-CA') {
  const env=makeEnv(url,lang);env.document.body.setAttribute('data-event-id','test-event');
  const main=new Element('main'),nav=new Element('nav'),back=new Element('a'),alternate=new Element('a'),article=new Element('article'),h1=new Element('h1'),actions=new Element('div');
  nav.className='pm-event-nav';back.setAttribute('data-calendar-return','');back.href='/polymythseminars/';back.textContent='← All listings';alternate.setAttribute('hreflang','fr-CA');alternate.href='/polymythseminars/fr/events/test-event/';nav.append(back,alternate);h1.textContent='Useful event';actions.className='pm-event-actions';article.append(h1,actions);main.append(nav,article);env.document.body.appendChild(main);
  let src=fs.readFileSync(path.join(ROOT,'js/polymythcal-features.js'),'utf8');const cut=src.lastIndexOf("\nif(document.readyState===");assert.ok(cut>0);
  src=src.slice(0,cut)+`\nglobalThis.api={init,injectSaveButtons,toggleEvent,savedEvents,savedSearches,removeSaved,removeSearch,safeCalendarReturn,restoreCalendarReturn,syncUrl,renderSaved,injectCurrentSavedTools};\n})();`;
  vm.runInContext(src,env,{filename:'production-features.js'});return env;
}
test('real Apply is primary external action; Details remains secondary',()=>{const {api}=mountDiscovery();const e=basicEvent(api,{actions:[{kind:'details',url:'/polymythseminars/events/test-event/',scope:'listing'},{kind:'application',url:'https://organizer.example/apply',scope:'event'}]});const html=api.eventActions(e);assert.match(html,/<a class="pm-action primary-link" href="https:\/\/organizer\.example\/apply"[^>]*>Apply/);assert.ok(html.indexOf('>Apply')<html.indexOf('>Details'));assert.doesNotMatch(html,/pmd-link-missing/);});
test('no external destination visibly explains absence without inventing an action',()=>{const {api}=mountDiscovery();const html=api.eventActions(basicEvent(api));assert.match(html,/pmd-link-missing/);assert.match(html,/>Details/);assert.doesNotMatch(html,/>Apply(?:<|\s)/);});
test('English and French inert categories are nouns',()=>{for(const [locale,noun]of[['en-CA','Opportunity'],['fr-CA','Possibilité']]){const {api}=mountDiscovery(locale);const html=api.eventCard(basicEvent(api));assert.match(html,new RegExp('class="pmd-badge apply">'+noun+'<'));assert.doesNotMatch(html,/class="pmd-badge apply">(?:Apply|Postuler)</);}});
test('Next 7 days starts September despite long-running March event; explicit month honored',()=>{const {api}=mountDiscovery();api.state.date='7d';api.setRows([basicEvent(api,{date:'2026-03-10',end_date:'2027-02-28'})]);assert.equal(api.calendarMonth().toISOString().slice(0,7),'2026-09');api.state.month='2026-11';assert.equal(api.calendarMonth().toISOString().slice(0,7),'2026-11');});
test('range excluded from daily sessions, genuine event included, window boundary excluded',()=>{const {api}=mountDiscovery();api.state.date='7d';api.setRows([]);const range=basicEvent(api,{date:'2026-03-10',end_date:'2027-02-28'});assert.equal(api.eventOccursOnDay(range,api.dayValue('2026-09-10')),false);assert.equal(api.eventOccursOnDay(basicEvent(api),api.dayValue('2026-09-10')),true);assert.equal(api.eventOccursOnDay(basicEvent(api,{date:'2026-09-14'}),api.dayValue('2026-09-14')),false);});
test('phone CSS keeps Today available',()=>{const css=fs.readFileSync(path.join(ROOT,'css/polymythcal-discovery.css'),'utf8');assert.doesNotMatch(css,/\.pmd-calendar-head\s+\.pmd-calendar-today\s*\{[^}]*display\s*:\s*none/);});
test('detail href preserves search, facets and page in from',()=>{const {api}=mountDiscovery();api.state.q='public philosophy';api.state.date='7d';api.state.page=3;api.state.facets={places:new Set(['toronto-gta'])};api.setAxes(new Map([['places',{}]]));const href=new URL(api.detailHref({id:'test-event'}),origin);const back=new URL(href.searchParams.get('from'),origin);assert.equal(back.searchParams.get('q'),'public philosophy');assert.equal(back.searchParams.get('page'),'3');assert.equal(back.searchParams.get('date'),'7d');assert.equal(back.searchParams.get('places'),'toronto-gta');});
test('detail Save toggles visible and accessible state both ways',()=>{const env=mountFeatures();env.api.init();const button=env.document.querySelector('.save-event');assert.equal(button.textContent,'Save event');assert.equal(button.getAttribute('aria-pressed'),'false');button.click();assert.equal(button.textContent,'Saved');assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(env.document.querySelector('#pmStatus').textContent,'Event saved');button.click();assert.equal(button.textContent,'Save event');assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(env.document.querySelector('#pmStatus').textContent,'Event removed');});
test('main results event adds usable Save and retrieval after asynchronous cards arrive',()=>{const env=mountFeatures('/polymythseminars/?date=7d');env.document.body.children=[];delete env.document.body.attrs['data-event-id'];delete env.document.body.dataset.eventId;const shell=new Element('main'),tools=new Element('details'),links=new Element('div'),list=new Element('div');shell.className='pmd-shell';tools.className='pmd-tools';links.className='pmd-tool-links';tools.append(links);list.id='pmdList';shell.append(tools,list);env.document.body.append(shell);env.api.init();const card=new Element('article'),h3=new Element('h3'),link=new Element('a'),actions=new Element('div');card.setAttribute('data-event-id','async-card');h3.append(link);link.href='/polymythseminars/events/async-card/';link.textContent='Asynchronous card';actions.className='pmd-card-actions';card.append(h3,actions);list.append(card);env.document.dispatchEvent({type:'polymythcal:results'});const save=card.querySelector('.save-event');assert.ok(save);save.click();assert.equal(save.textContent,'Saved');env.document.querySelector('#pmSavedToggle').click();assert.match(env.document.querySelector('.pm-saved-list').textContent,/Asynchronous card/);const remove=env.document.querySelector('.saved-remove');remove.click();assert.equal(save.textContent,'Save event');assert.equal(env.api.savedEvents().includes('async-card'),false);});
test('legacy saved event migrates once and remains removed',()=>{const env=mountFeatures();env.localStorage.setItem('polymythcal.savedEvents.v1',JSON.stringify([{id:'test-event',title:'Legacy event',href:'/polymythseminars/events/test-event/'}]));env.api.init();assert.ok(env.api.savedEvents().includes('test-event'));assert.equal(env.localStorage.getItem('polymythcal.savedEvents.v1'),null);env.api.removeSaved('test-event');assert.equal(env.api.savedEvents().includes('test-event'),false);assert.equal(env.document.querySelector('.save-event').getAttribute('aria-pressed'),'false');});
test('legacy saved search migrates once and remains removed',()=>{const env=mountFeatures();env.localStorage.setItem('polymythcal.savedSearches.v1',JSON.stringify([{label:'Old search',href:'/polymythseminars/?q=philosophy'}]));const first=env.api.savedSearches();assert.equal(first.length,1);assert.equal(env.localStorage.getItem('polymythcal.savedSearches.v1'),null);env.api.removeSearch(first[0].id);assert.equal(env.api.savedSearches().length,0);});
test('saved retrieval and detail return preserve validated view',()=>{const from='/polymythseminars/research/?q=philosophy&date=7d&page=2';const env=mountFeatures('/polymythseminars/events/test-event/?from='+encodeURIComponent(from));env.api.init();assert.equal(new URL(env.document.querySelector('[data-calendar-return]').href).pathname,'/polymythseminars/research/');assert.equal(new URL(env.document.querySelector('[data-calendar-return]').href).searchParams.get('page'),'2');assert.match(env.document.querySelector('[data-calendar-return]').textContent,/Back to results/);assert.equal(new URL(env.document.querySelector('a[hreflang]').href).searchParams.get('from'),from);const toggle=env.document.querySelector('#pmSavedToggle');toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(env.document.querySelector('#pmSavedPanel').hidden,false);});
test('return rejects off-site, code URLs, and unrelated site paths',()=>{const {api}=mountFeatures();for(const url of['https://other.example/polymythseminars/','//other.example/polymythseminars/','javascript:alert(1)','/polymyth/','/polymythseminars/events/test/'])assert.equal(api.safeCalendarReturn(url),'');assert.equal(api.safeCalendarReturn('/writingkids/fr/?q=poetry&page=2'),'/writingkids/fr/?q=poetry&page=2');});
test('range date display states end once',()=>{const {api}=mountDiscovery();const html=api.rangeList([basicEvent(api,{date:'2026-03-10',end_date:'2027-02-28'})]);assert.equal((html.match(/Feb 28, 2027/g)||[]).length,1,html);});
test('ongoing-only list never announces inverted 1–0 pagination',()=>{const env=mountDiscovery();env.api.setRows([basicEvent(env.api,{date:'2026-03-10',end_date:'2027-02-28'})]);env.api.renderList();assert.doesNotMatch(env.document.querySelector('#pmdLiveStatus').textContent,/1[–-]0/);});
test('calendar with ongoing ranges does not simultaneously claim no listings',()=>{const env=mountDiscovery();env.api.state.date='7d';env.api.setRows([basicEvent(env.api,{date:'2026-03-10',end_date:'2027-02-28'})]);env.api.renderCalendar();const html=env.document.querySelector('#pmdCalendar').innerHTML;assert.match(html,/Date ranges this month/);assert.ok(!html.includes('No listings in September 2026'),'Ranges exist, so no-listings message is false');});
console.log(JSON.stringify({production_root:ROOT,passes,failures},null,2));
process.exitCode=failures.length?1:0;
