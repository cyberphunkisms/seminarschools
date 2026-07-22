#!/usr/bin/env node
/* Representative execution gate for the shared geometry engines.
   Every source page is statically classified. One representative per distinct
   geometry contract is executed, while verify-visible-geometry.js checks all
   source/public pages for asset and intensity parity. */
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
    else if(e.name.endsWith('.html')&&!/^google.*\.html$/i.test(e.name)) out.push(rel);
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
    return {tagName:(tag||'div').toUpperCase(),_id:'',className:'',_html:'',
      get id(){return this._id;},set id(v){this._id=v;byId[v]=this;},
      get innerHTML(){return this._html;},set innerHTML(v){this._html=String(v);},
      style:{_t:'',get transform(){return this._t;},set transform(v){this._t=v;},setProperty:(k,v)=>{cssVars[k]=v;},getPropertyValue:k=>cssVars[k]||''},
      setAttribute(k,v){if(k==='id')this.id=v;else if(k==='class')this.className=v;},getAttribute(){return null;},
      classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(c){if(c&&c._id)byId[c._id]=c;return c;},querySelector(){return null;},querySelectorAll(){return [];}};
  }
  if(opts.hasGeo){const g=node('div');g.id='geo';const g2=node('div');g2.id='geo2';}
  if(opts.hasPcv){const p=node('div');p.id='printCv';}
  const projEl=opts.projCls?(()=>{const e=node('nav');e.className=opts.projCls;return e;})():null;
  const sections=[];for(let i=0;i<opts.sectionCount;i++){const top=i*1000;sections.push({getBoundingClientRect(){return{top:top-win.scrollY,height:1000};}});}
  const documentElement=node('html');Object.defineProperty(documentElement,'scrollHeight',{get(){return 4000;}});
  const body=node('body');
  const doc={documentElement,body,createElement:t=>node(t),getElementById:id=>byId[id]||null,querySelector:sel=>/project-/.test(sel)?projEl:null,querySelectorAll:sel=>sel==='section'?sections:[],addEventListener:(t,fn)=>addH(t,fn),hidden:false,readyState:'complete'};
  const win={};Object.assign(win,{document:doc,window:win,Math,console,matchMedia:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}),innerWidth:1200,innerHeight:800,scrollY:0,requestAnimationFrame:cb=>{try{cb();}catch(_){}return 0;},setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>0,performance:{_t:0,now(){this._t+=50;return this._t;}},addEventListener:(t,fn)=>addH(t,fn),location:{pathname:opts.path},Event:function(type){this.type=type;}});
  return{win,fire:type=>(handlers[type]||[]).forEach(fn=>{try{fn(new win.Event(type));}catch(_){}}),cssVars,layer:()=>byId.indraLayer||null,geo:()=>byId.geo||null};
}
function execPage(opts,cfg){
  const w=makeWorld(opts),ctx=vm.createContext(w.win);let err=null;
  try{if(cfg.loadsMand)vm.runInContext(mandalaSrc,ctx);if(cfg.loadsMand&&cfg.ifpKey&&PRESETS.has(cfg.ifpKey)&&w.win.PolymythMandala)w.win.PolymythMandala.initForProject(cfg.ifpKey);if(cfg.loadsIndra)vm.runInContext(indraSrc,ctx);}catch(e){err=e.message;}
  const layer=w.layer(),geo=w.geo();const built=(layer&&/<svg/.test(layer.innerHTML))||(geo&&/<svg/.test(geo.innerHTML));
  const sig=y=>{w.win.scrollY=y;w.fire('scroll');const L=w.layer();return(L?L.style.transform:'')+'||'+(w.cssVars['--geo-scale']||'')+','+(w.cssVars['--geo-tx']||'')+','+(w.cssVars['--geo-ty']||'');};
  return{err,built:!!built,moves:new Set([0,1600,3200].map(sig)).size>1};
}
function execMotionCamera(){
  const w=makeWorld({path:'/saul/',hasGeo:false,hasPcv:true,projCls:null,sectionCount:0}),ctx=vm.createContext(w.win);
  try{vm.runInContext(mandalaSrc,ctx);w.win.PolymythMandala.initScrollCamera({forceGlobal:true});}catch(_){return false;}
  const sig=y=>{w.win.scrollY=y;w.fire('scroll');return(w.cssVars['--geo-scale']||'')+','+(w.cssVars['--geo-tx']||'');};
  return new Set([0,1600,3200].map(sig)).size>1;
}
const files=walk(ROOT),representatives=new Map(),staticFailures=[],skipped={redirect:0,search:0};
for(const f of files){
  const s=read(f),p=pagePath(f);
  if(/http-equiv=["']refresh["']/i.test(s)&&/location\.replace\(/.test(s)){skipped.redirect++;continue;}
  if(s.includes('name="generator" content="Seminar Schools Static Search Surface"')){skipped.search++;continue;}
  const loadsIndra=s.includes('/js/indra.js'),loadsMand=s.includes('/js/mandala.js'),loadsAlive=s.includes('alive.css');
  const hasGeo=/id="geo"/.test(s),hasPcv=/printCv/.test(s),projCls=(s.match(/class="([^"]*project-[^"]*)"/)||[])[1]||null;
  const ifp=(s.match(/initForProject\('([\w-]+)'\)/)||[])[1]||null,validIfp=ifp&&PRESETS.has(ifp),tier=tierFor(p);
  if(ifp&&!validIfp)staticFailures.push(`${p}: missing preset ${ifp}`);
  if(validIfp&&!loadsMand)staticFailures.push(`${p}: preset page lacks mandala.js`);
  if(!validIfp&&loadsIndra&&tier!=='off'&&!loadsAlive)staticFailures.push(`${p}: indra page lacks alive.css`);
  const inlineBuilder=/buildGeo\s*\(/.test(s)||/getElementById\((["'])(geo|geoLayer)\1\)\.innerHTML\s*=/.test(s);
  const motionSelf=/addEventListener\('scroll'/.test(s)&&/setProperty\('--geo-(scale|tx|ty)'/.test(s),callsCam=/\.initScrollCamera\s*\(/.test(s);
  const routeType=(s.match(/data-route-type="([^"]+)"/)||[])[1]||p.split('/')[1]||'root';
  const sectionBucket=Math.min(3,(s.match(/<section/g)||[]).length);
  const signature=JSON.stringify({routeType,tier,loadsIndra,loadsMand,loadsAlive,hasGeo,hasPcv,proj:!!projCls,ifp:inlineBuilder?null:ifp,inlineBuilder,motionSelf,callsCam,sectionBucket});
  if(!representatives.has(signature)) representatives.set(signature,{f,p,s,loadsIndra,loadsMand,hasGeo,hasPcv,projCls,ifp,inlineBuilder,motionSelf,callsCam,sectionCount:sectionBucket});
}
const execFailures=[];
for(const r of representatives.values()){
  if(r.inlineBuilder){
    if(!(r.hasGeo||/id="geoLayer"/.test(r.s)))execFailures.push(`${r.p}: inline geometry lacks mount`);
    if(!/var\(--geo-scale/.test(r.s))execFailures.push(`${r.p}: inline geometry lacks transform consumer`);
    if(r.callsCam&&!execMotionCamera())execFailures.push(`${r.p}: shared camera does not move`);
    if(!r.callsCam&&!r.motionSelf)execFailures.push(`${r.p}: inline geometry lacks motion source`);
  }else{
    const x=execPage({path:r.p,hasGeo:r.hasGeo,hasPcv:r.hasPcv,projCls:r.projCls,sectionCount:r.sectionCount},{ifpKey:r.ifp,loadsMand:r.loadsMand,loadsIndra:r.loadsIndra});
    if(x.err)execFailures.push(`${r.p}: threw ${x.err.slice(0,60)}`);
    if(!x.built)execFailures.push(`${r.p}: no SVG built`);
    if(!x.moves)execFailures.push(`${r.p}: no scroll motion`);
  }
}
const invariants=[
  ['mandala exports initScrollCamera',/initScrollCamera\s*:/.test(mandalaSrc)],
  ['mandala has global-scroll fallback',/forceGlobal/.test(mandalaSrc)&&/scrollHeight - window\.innerHeight/.test(mandalaSrc)],
  ['#geo svg consumes --geo-scale',/#geo svg[\s\S]{0,200}var\(--geo-scale/.test(read('css/main.css'))],
  ['indra scroll-couples #indraLayer',/addEventListener\('scroll'/.test(indraSrc)&&/layer\.style\.transform/.test(indraSrc)],
  ['alive.css styles #indraLayer',/#indraLayer\s*\{/.test(read('css/alive.css'))]
];
const invFailures=invariants.filter(x=>!x[1]).map(x=>x[0]);
console.log(`pages statically classified: ${files.length}; representative geometry contracts executed: ${representatives.size}; redirects: ${skipped.redirect}; static search pages: ${skipped.search}`);
invariants.forEach(([n,ok])=>console.log(`  ${ok?'PASS':'FAIL'}  ${n}`));
const failures=[...staticFailures,...execFailures,...invFailures.map(x=>'engine: '+x)];
if(failures.length){console.error('GEOMETRY INCOMPLETE');failures.forEach(x=>console.error(' - '+x));process.exit(1);}
console.log('GEOMETRY COMPLETE — all pages classified; every distinct geometry contract builds and moves; engine invariants pass.');
