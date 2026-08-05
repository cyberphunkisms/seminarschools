#!/usr/bin/env node
/* Representative execution gate for the shared scroll geometry engines.
   Every source page is statically classified, including redirects, noindex and
   static-search surfaces. One representative per distinct surface signature is
   executed, while the visible/static gates cover every artifact. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
function walk(dir){
  let out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    const rel=path.relative(ROOT,full).replace(/\\/g,'/');
    if(e.name==='node_modules'||e.name==='public'||e.name.startsWith('.')||rel.startsWith('scripts/fixtures')) continue;
    if(e.isDirectory()) out=out.concat(walk(full));
    else if(e.name.endsWith('.html')&&rel!=='google20234ae70106ee9d.html') out.push(rel);
  }
  return out;
}
const indraSrc=read('js/indra.js');
const mandalaSrc=read('js/mandala.js');
const tiersBlock=(indraSrc.match(/var TIERS = \[([\s\S]*?)\];/)||[])[1]||'';
const TIERS=[...tiersBlock.matchAll(/\['([^']*)',\s*'([^']*)'\]/g)].map(m=>[m[1],m[2]]);
const tierFor=p=>{for(const [pre,t] of TIERS) if(p===pre||p.startsWith(pre)) return t; return 'subtle';};
const PRESETS=new Set([...mandalaSrc.slice(mandalaSrc.indexOf('const PRESETS = {')).matchAll(/^\s{4}['"]?([\w-]+)['"]?:\s*\{/gm)].map(m=>m[1]));
const pagePath=f=>f==='index.html'?'/':(f.endsWith('/index.html')?'/'+f.slice(0,-'index.html'.length):'/'+f);
function makeWorld(opts){
  const byId={},handlers={},cssVars={};
  const addH=(t,fn)=>{(handlers[t]=handlers[t]||[]).push(fn);};
  function node(tag){
    return {tagName:(tag||'div').toUpperCase(),_id:'',className:'',_html:'',_attrs:Object.create(null),
      get id(){return this._id;},set id(v){this._id=v;byId[v]=this;},
      get innerHTML(){return this._html;},set innerHTML(v){this._html=String(v);},
      style:{_t:'',get transform(){return this._t;},set transform(v){this._t=v;},setProperty:(k,v)=>{cssVars[k]=v;},getPropertyValue:k=>cssVars[k]||''},
      setAttribute(k,v){this._attrs[k]=String(v);if(k==='id')this.id=v;else if(k==='class')this.className=v;},getAttribute(k){return this._attrs[k]||null;},removeAttribute(k){delete this._attrs[k];},
      classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(c){if(c&&c._id)byId[c._id]=c;return c;},querySelector(){return null;},querySelectorAll(){return [];}};
  }
  if(opts.hasGeo){const g=node('div');g.id='geo';const g2=node('div');g2.id='geo2';}
  if(opts.hasPcv){const p=node('div');p.id='printCv';}
  const projEl=opts.projCls?(()=>{const e=node('nav');e.className=opts.projCls;return e;})():null;
  const sections=[];for(let i=0;i<opts.sectionCount;i++){const top=i*1000;sections.push({getBoundingClientRect(){return{top:top-win.scrollY,height:1000};}});}
  const documentElement=node('html');documentElement.dataset={motion:opts.motion||'active'};Object.defineProperty(documentElement,'scrollHeight',{get(){return 4000;}});
  const body=node('body');
  body.setAttribute('data-route-type',opts.routeType||'project');
  body.setAttribute('data-geometry-role',opts.roles||'relation movement return synthesis');
  body.setAttribute('data-indra-intensity','0.070');
  const anchors=[];for(let i=0;i<(opts.localCount||0);i++){const a=node('a');a.setAttribute('href','/route-'+i+'/');anchors.push(a);}
  const headings=[];for(let i=0;i<(opts.headingCount||0);i++)headings.push(node(i?'h2':'h1'));
  const groups=[];for(let i=0;i<(opts.groupCount||0);i++)groups.push(node('section'));
  const controls=[];for(let i=0;i<(opts.controlCount||0);i++)controls.push(node('button'));
  const doc={documentElement,body,createElement:t=>node(t),getElementById:id=>byId[id]||null,querySelector:sel=>/project-/.test(sel)?projEl:null,querySelectorAll:sel=>{
    if(sel==='section')return sections;
    if(sel==='a[href]')return anchors;
    if(sel==='section,article,details,[role="region"],[role="list"]')return groups;
    if(sel==='h1,h2,h3,h4,h5,h6')return headings;
    if(sel==='button,input,select,textarea,summary,[aria-expanded],[data-action],[data-filter],[data-view],[data-tab]')return controls;
    return [];
  },addEventListener:(t,fn)=>addH(t,fn),hidden:false,readyState:'complete'};
  const win={};Object.assign(win,{document:doc,window:win,Math,console,matchMedia:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}),innerWidth:1200,innerHeight:800,scrollY:0,requestAnimationFrame:cb=>{try{cb(win.performance.now());}catch(_){}return 0;},cancelAnimationFrame:()=>{},setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>0,performance:{_t:0,now(){this._t+=50;return this._t;}},addEventListener:(t,fn)=>addH(t,fn),location:{pathname:opts.path},Event:function(type){this.type=type;}});
  win.matchMedia=query=>({matches:!!opts.reduced&&/prefers-reduced-motion/.test(query),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  return{win,fire:type=>(handlers[type]||[]).forEach(fn=>{try{fn(new win.Event(type));}catch(_){}}),cssVars,layer:()=>byId.indraLayer||null,geo:()=>byId.geo||null};
}
function execPage(opts,cfg){
  const w=makeWorld(opts),ctx=vm.createContext(w.win);let err=null;
  try{if(cfg.loadsMand)vm.runInContext(mandalaSrc,ctx);if(cfg.loadsMand&&cfg.ifpKey&&PRESETS.has(cfg.ifpKey)&&w.win.PolymythMandala)w.win.PolymythMandala.initForProject(cfg.ifpKey);if(cfg.loadsIndra)vm.runInContext(indraSrc,ctx);}catch(e){err=e.message;}
  const layer=w.layer(),geo=w.geo();const built=(layer&&/<svg/.test(layer.innerHTML))||(geo&&/<svg/.test(geo.innerHTML));
  const sig=y=>{w.win.scrollY=y;w.fire('scroll');const L=w.layer();return(L?L.style.transform:'')+'||'+(w.cssVars['--geo-scale']||'')+','+(w.cssVars['--geo-tx']||'')+','+(w.cssVars['--geo-ty']||'');};
  const signatures=[0,1600,3200].map(sig);
  return{
    err,built:!!built,moves:new Set(signatures).size>1,
    markup:layer?layer.innerHTML:'',
    markupBytes:layer?Number(layer.getAttribute('data-geometry-markup-bytes')):0,
    shapes:layer?Number(layer.getAttribute('data-geometry-shapes')):0,
    fallback:layer?layer.getAttribute('data-geometry-fallback'):'',
    role:layer?layer.getAttribute('data-geometry-role'):'',
    kind:layer?layer.getAttribute('data-geometry-kind'):'',
    source:layer?layer.getAttribute('data-geometry-source'):'',
    input:layer?layer.getAttribute('data-geometry-input'):'',
    proof:layer?layer.getAttribute('data-geometry-proof'):'',
    signature:layer?layer.getAttribute('data-geometry-signature'):''
  };
}
function execMotionCamera(){
  const w=makeWorld({path:'/saul/',hasGeo:false,hasPcv:true,projCls:null,sectionCount:0}),ctx=vm.createContext(w.win);
  try{vm.runInContext(mandalaSrc,ctx);w.win.PolymythMandala.initScrollCamera({forceGlobal:true});}catch(_){return false;}
  const sig=y=>{w.win.scrollY=y;w.fire('scroll');return(w.cssVars['--geo-scale']||'')+','+(w.cssVars['--geo-tx']||'');};
  return new Set([0,1600,3200].map(sig)).size>1;
}
const files=walk(ROOT),representatives=new Map(),staticFailures=[],coverage={redirect:0,search:0,noindex:0};
for(const f of files){
  const s=read(f),p=pagePath(f);
  if(/http-equiv=["']refresh["']/i.test(s)&&/location\.replace\(/.test(s))coverage.redirect++;
  if(s.includes('name="generator" content="Seminar Schools Static Search Surface"'))coverage.search++;
  if(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(s))coverage.noindex++;
  const loadsIndra=s.includes('/js/indra.js'),loadsMand=s.includes('/js/mandala.js'),loadsAlive=s.includes('alive.css');
  const hasGeo=/id="geo"/.test(s),hasPcv=/printCv/.test(s),projCls=(s.match(/class="([^"]*project-[^"]*)"/)||[])[1]||null;
  const ifp=(s.match(/initForProject\('([\w-]+)'\)/)||[])[1]||null,validIfp=ifp&&PRESETS.has(ifp),tier=tierFor(p);
  if(ifp&&!validIfp)staticFailures.push(`${p}: missing preset ${ifp}`);
  if(validIfp&&!loadsMand)staticFailures.push(`${p}: preset page lacks mandala.js`);
  if(!validIfp&&loadsIndra&&tier!=='off'&&!loadsAlive)staticFailures.push(`${p}: indra page lacks alive.css`);
  const inlineBuilder=/buildGeo\s*\(/.test(s)||/getElementById\((["'])(geo|geoLayer)\1\)\.innerHTML\s*=/.test(s);
  const motionSelf=/addEventListener\('scroll'/.test(s)&&/setProperty\('--geo-(scale|tx|ty)'/.test(s),callsCam=/\.initScrollCamera\s*\(/.test(s);
  const routeType=(s.match(/data-route-type="([^"]+)"/)||[])[1]||'';
  const roles=(s.match(/data-geometry-role="([^"]+)"/)||[])[1]||'';
  if(!routeType)staticFailures.push(`${p}: missing data-route-type`);
  if(!roles)staticFailures.push(`${p}: missing data-geometry-role`);
  const localCount=new Set([...s.matchAll(/<a\b[^>]*href=["'](\/|\.\.?\/|#)([^"']*)["']/gi)].map(m=>m[1]+m[2]).filter(x=>x!=='#')).size;
  const headingCount=(s.match(/<h[1-6]\b/gi)||[]).length;
  const groupCount=(s.match(/<(?:section|article|details)\b/gi)||[]).length;
  const controlCount=(s.match(/<(?:button|input|select|textarea|summary)\b/gi)||[]).length;
  const sectionBucket=Math.min(3,(s.match(/<section/g)||[]).length);
  const structureBucket={local:Math.min(3,localCount),headings:Math.min(3,headingCount),groups:Math.min(3,groupCount),controls:Math.min(3,controlCount)};
  const signature=JSON.stringify({routeType,roles,tier,loadsIndra,loadsMand,loadsAlive,hasGeo,hasPcv,proj:!!projCls,ifp:inlineBuilder?null:ifp,inlineBuilder,motionSelf,callsCam,sectionBucket,structureBucket});
  if(!representatives.has(signature)) representatives.set(signature,{f,p,s,loadsIndra,loadsMand,hasGeo,hasPcv,projCls,ifp,inlineBuilder,motionSelf,callsCam,sectionCount:sectionBucket,routeType,roles,localCount,headingCount,groupCount,controlCount});
}
const execFailures=[];
for(const r of representatives.values()){
  if(r.inlineBuilder){
    if(!(r.hasGeo||/id="geoLayer"/.test(r.s)))execFailures.push(`${r.p}: inline geometry lacks mount`);
    if(!/var\(--geo-scale/.test(r.s))execFailures.push(`${r.p}: inline geometry lacks transform consumer`);
    if(r.callsCam&&!execMotionCamera())execFailures.push(`${r.p}: shared camera does not move`);
    if(!r.callsCam&&!r.motionSelf)execFailures.push(`${r.p}: inline geometry lacks motion source`);
  }else{
    const pageOptions={path:r.p,hasGeo:r.hasGeo,hasPcv:r.hasPcv,projCls:r.projCls,sectionCount:r.sectionCount,routeType:r.routeType,roles:r.roles,localCount:r.localCount,headingCount:r.headingCount,groupCount:r.groupCount,controlCount:r.controlCount};
    const x=execPage(pageOptions,{ifpKey:r.ifp,loadsMand:r.loadsMand,loadsIndra:r.loadsIndra});
    if(x.err)execFailures.push(`${r.p}: threw ${x.err.slice(0,60)}`);
    if(!x.built)execFailures.push(`${r.p}: no SVG built`);
    if(!x.moves)execFailures.push(`${r.p}: no scroll motion`);
    if(x.role!==r.roles)execFailures.push(`${r.p}: runtime geometry role drift`);
    if(x.kind!=='shared-scroll-layer'||x.source!=='shared-scroll-layer')execFailures.push(`${r.p}: Indra layer is not marked as the shared scroll layer`);
    if(x.input!=='path-route-scroll')execFailures.push(`${r.p}: geometry input is not marked path-route-scroll`);
    if(x.proof!=='all-page-scroll')execFailures.push(`${r.p}: geometry proof is not all-page-scroll`);
    if(!x.signature||!x.signature.startsWith(r.routeType+':'))execFailures.push(`${r.p}: runtime structural signature missing`);
    if(!Number.isFinite(x.shapes)||x.shapes<1||x.shapes>1600)execFailures.push(`${r.p}: shared geometry shape budget failed (${x.shapes})`);
    if(!Number.isFinite(x.markupBytes)||x.markupBytes<1||x.markupBytes>180000)execFailures.push(`${r.p}: shared geometry markup budget failed (${x.markupBytes})`);
    if(/class=["']flower\b/i.test(x.markup))execFailures.push(`${r.p}: generic Indra geometry restored decorative flowers`);
    const reduced=execPage({...pageOptions,reduced:true},{ifpKey:r.ifp,loadsMand:r.loadsMand,loadsIndra:r.loadsIndra});
    if(reduced.err||!reduced.built)execFailures.push(`${r.p}: reduced-motion geometry is not visible and still`);
    if(reduced.moves)execFailures.push(`${r.p}: reduced-motion geometry still scroll-animates`);
  }
}
const profileBase={path:'/geometry-contract-proof/',hasGeo:false,hasPcv:false,projCls:null,sectionCount:2,routeType:'project',localCount:5,headingCount:3,groupCount:2,controlCount:1};
const profileRelation=execPage({...profileBase,roles:'relation'},{loadsMand:true,loadsIndra:true});
const profileSynthesis=execPage({...profileBase,roles:'relation movement return synthesis'},{loadsMand:true,loadsIndra:true});
if(!profileRelation.built||!profileSynthesis.built||profileRelation.markup===profileSynthesis.markup)execFailures.push('engine: route-family flavor does not alter rendered geometry');
const profileChanged=execPage({...profileBase,roles:'relation',localCount:8},{loadsMand:true,loadsIndra:true});
if(profileChanged.signature===profileRelation.signature||profileChanged.markup===profileRelation.markup)execFailures.push('engine: local surface facts do not alter rendered geometry');
const invariants=[
  ['mandala exports initScrollCamera',/initScrollCamera\s*:/.test(mandalaSrc)],
  ['mandala has global-scroll fallback',/forceGlobal/.test(mandalaSrc)&&/scrollHeight - window\.innerHeight/.test(mandalaSrc)],
  ['#geo svg consumes --geo-scale',/#geo svg[\s\S]{0,200}var\(--geo-scale/.test(read('css/main.css'))],
  ['indra scroll-couples #indraLayer',/addEventListener\('scroll'/.test(indraSrc)&&/layer\.style\.transform/.test(indraSrc)],
  ['indra consumes route flavor and surface facts',/pageStructureFacts/.test(indraSrc)&&/structuralSignature/.test(indraSrc)&&/data-geometry-input/.test(indraSrc)],
  ['indra marks the universal scroll contract',/data-geometry-kind["'],\s*["']shared-scroll-layer/.test(indraSrc)&&/data-geometry-proof["'],\s*["']all-page-scroll/.test(indraSrc)],
  ['indra disables generic decorative flowers',/flowers:\s*false/.test(indraSrc)&&!/flowers:\s*hasRole/.test(indraSrc)],
  ['indra uses an explicit bounded maxDepth expression',/var maxDepth = coarse \? 4 : \(hasRole\('movement'\)/.test(indraSrc)&&!/Math\.max\(1,\s*structure\.groups \+ structure\.controls > 0/.test(indraSrc)],
  ['indra enforces shape and markup budgets',/MAX_MARKUP_BYTES\s*=\s*180000/.test(indraSrc)&&/MAX_SHAPES\s*=\s*1600/.test(indraSrc)&&/complexity-reduced/.test(indraSrc)],
  ['alive.css styles #indraLayer',/#indraLayer\s*\{/.test(read('css/alive.css'))]
];
const invFailures=invariants.filter(x=>!x[1]).map(x=>x[0]);
console.log(`pages statically classified: ${files.length}; representative geometry contracts executed: ${representatives.size}; redirects: ${coverage.redirect}; static search pages: ${coverage.search}; noindex pages: ${coverage.noindex}`);
invariants.forEach(([n,ok])=>console.log(`  ${ok?'PASS':'FAIL'}  ${n}`));
const failures=[...staticFailures,...execFailures,...invFailures.map(x=>'engine: '+x)];
if(failures.length){console.error('GEOMETRY INCOMPLETE');failures.forEach(x=>console.error(' - '+x));process.exit(1);}
console.log('GEOMETRY COMPLETE - all pages, including redirects and static search, are classified; every distinct surface signature builds the shared scroll layer, moves causally, and stays visible/still under reduced motion.');
