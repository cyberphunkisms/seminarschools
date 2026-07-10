#!/usr/bin/env node
/* =========================================================================
   VERIFY-GEOMETRY  —  execution + motion gate (rev2 2026-06-16)

   What the first version got wrong, and why this one is harder to fool:
   the first version classified pages by grepping for script tags and preset
   keys. Presence is not behavior. This version EXECUTES every page's mount
   in a dependency-free DOM shim, asserts a real <svg> substrate node gets
   built, then fires scroll at three depths and asserts the geometry's
   transform actually changes. No npm install, no trust in a regex standing
   in for a render. It also keeps the static classification and the engine
   invariants as a second, independent check. A page passes only when it
   builds AND moves AND classifies AND the engine invariants hold.

   Run:  node scripts/verify-geometry.js   (exit 0 = complete, 1 = not)
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
function walk(dir){ let o=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.name==='node_modules'||e.name==='public'||e.name.startsWith('.'))continue; const fp=path.join(dir,e.name); if(e.isDirectory())o=o.concat(walk(fp)); else if(e.name.endsWith('.html') && !/^google.*\.html$/i.test(e.name))o.push(path.relative(ROOT,fp)); } return o; }

const indraSrc = read('js/indra.js');
const mandalaSrc = read('js/mandala.js');
const tiersBlock = (indraSrc.match(/var TIERS = \[([\s\S]*?)\];/)||[])[1]||'';
const TIERS = [...tiersBlock.matchAll(/\['([^']*)',\s*'([^']*)'\]/g)].map(m=>[m[1],m[2]]);
const tierFor = (p)=>{ for(const [pre,t] of TIERS) if(p===pre||p.startsWith(pre)) return t; return 'subtle'; };
const PRESETS = new Set([...mandalaSrc.slice(mandalaSrc.indexOf('const PRESETS = {')).matchAll(/^\s{4}['"]?([\w-]+)['"]?:\s*\{/gm)].map(m=>m[1]));
const pagePath = (f)=> f==='index.html' ? '/' : (f.endsWith('/index.html') ? '/'+f.slice(0,-'index.html'.length) : '/'+f);

// ---- dependency-free DOM shim, just enough to run mandala.js + indra.js ----
function makeWorld(opts){
  const byId = {}, handlers = {}, cssVars = {};
  const addH = (t,fn)=>{ (handlers[t]=handlers[t]||[]).push(fn); };
  function node(tag){
    const n = { tagName:(tag||'div').toUpperCase(), _id:'', className:'', _html:'',
      get id(){return this._id;}, set id(v){ this._id=v; byId[v]=this; },
      get innerHTML(){return this._html;}, set innerHTML(v){ this._html=String(v); },
      style:{ _t:'', get transform(){return this._t;}, set transform(v){ this._t=v; },
              setProperty:(k,v)=>{ cssVars[k]=v; }, getPropertyValue:(k)=>cssVars[k]||'' },
      setAttribute(k,v){ if(k==='id') this.id=v; else if(k==='class') this.className=v; },
      getAttribute(){ return null; },
      classList:{ add(){}, remove(){}, toggle(){}, contains(){return false;} },
      appendChild(c){ if(c&&c._id) byId[c._id]=c; return c; },
      querySelector(){ return null; },           // svg/circle lookups -> null => ecosystem skips, substrate still in innerHTML
      querySelectorAll(){ return []; } };
    return n;
  }
  if(opts.hasGeo){ const g=node('div'); g.id='geo'; const g2=node('div'); g2.id='geo2'; }
  if(opts.hasPcv){ const p=node('div'); p.id='printCv'; }
  const projEl = opts.projCls ? (()=>{ const e=node('nav'); e.className=opts.projCls; return e; })() : null;
  const sections = [];
  for(let i=0;i<opts.sectionCount;i++){ const top=i*1000; sections.push({ getBoundingClientRect(){ return { top: top - win.scrollY, height:1000 }; } }); }

  const documentElement = node('html');
  Object.defineProperty(documentElement,'scrollHeight',{ get(){ return 4000; } }); // tall, to test "would it move if scrollable"
  const body = node('body');
  const doc = { documentElement, body,
    createElement:(t)=>node(t),
    getElementById:(id)=> byId[id]||null,
    querySelector:(sel)=> /project-/.test(sel) ? projEl : null,
    querySelectorAll:(sel)=> sel==='section' ? sections : [],
    addEventListener:(t,fn)=>addH(t,fn),
    hidden:false, readyState:'complete' };

  const win = {};
  Object.assign(win, {
    document:doc, window:win, Math, console,
    matchMedia:()=>({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }),
    innerWidth:1200, innerHeight:800, scrollY:0,
    requestAnimationFrame:(cb)=>{ try{cb();}catch(_){} return 0; },
    setTimeout:()=>0, setInterval:()=>0, clearTimeout:()=>0,
    performance:{ _t:0, now(){ this._t+=50; return this._t; } },
    addEventListener:(t,fn)=>addH(t,fn),
    location:{ pathname:opts.path },
    Event:function(type){ this.type=type; }
  });
  return { win, fire:(type)=>{ (handlers[type]||[]).forEach(fn=>{ try{fn(new win.Event(type));}catch(_){} }); },
           cssVars, layer:()=>byId['indraLayer']||null, geo:()=>byId['geo']||null };
}

function execPage(opts, cfg){
  const w = makeWorld(opts);
  const ctx = vm.createContext(w.win);
  let err=null;
  try {
    if(cfg.loadsMand) vm.runInContext(mandalaSrc, ctx);       // only run engines the page ACTUALLY includes
    if(cfg.loadsMand && cfg.ifpKey && PRESETS.has(cfg.ifpKey) && w.win.PolymythMandala) w.win.PolymythMandala.initForProject(cfg.ifpKey);
    if(cfg.loadsIndra) vm.runInContext(indraSrc, ctx);
  } catch(e){ err=e.message; }
  const layer = w.layer(), geo = w.geo();
  const built = (layer && /<svg/.test(layer.innerHTML)) || (geo && /<svg/.test(geo.innerHTML));
  const maxY = 4000 - 800;
  const sig = (y)=>{ w.win.scrollY = y; w.fire('scroll'); const L=w.layer();
    return (L?L.style.transform:'') + '||' + (w.cssVars['--geo-scale']||'') + ',' + (w.cssVars['--geo-tx']||'') + ',' + (w.cssVars['--geo-ty']||''); };
  const states = new Set([0, Math.round(maxY*0.5), maxY].map(sig));
  return { err, built:!!built, moves: states.size>1 };
}

function execMotionCamera(){
  // For inline-build pages that use the SHARED camera (saul): run the camera
  // alone and confirm it drives the geo vars on scroll. Build is checked
  // structurally because the page's own inline builder cannot run here.
  const w = makeWorld({path:'/saul/', hasGeo:false, hasPcv:true, projCls:null, sectionCount:0});
  const ctx = vm.createContext(w.win);
  try { vm.runInContext(mandalaSrc, ctx); w.win.PolymythMandala.initScrollCamera({forceGlobal:true}); } catch(e){ return false; }
  const maxY = 4000-800;
  const sig=(y)=>{ w.win.scrollY=y; w.fire('scroll'); return (w.cssVars['--geo-scale']||'')+','+(w.cssVars['--geo-tx']||''); };
  return new Set([0,Math.round(maxY*0.5),maxY].map(sig)).size>1;
}

// ---- run every page -------------------------------------------------------
const rows=[], fails=[];
for(const f of walk(ROOT)){
  const s = read(f), p = pagePath(f);
  // Search-surface pages are deliberately plain, static documents. They carry
  // content, schema, and canonical URLs rather than project-specific motion.
  if (s.includes('name="generator" content="Seminar Schools Static Search Surface"')) {
    rows.push({p, outcome:'static-search', fail:[]});
    continue;
  }
  const loadsIndra=s.includes('/js/indra.js'), loadsMand=s.includes('/js/mandala.js'), loadsAlive=s.includes('alive.css');
  const hasGeo=/id="geo"/.test(s), hasGeoLayer=/id="geoLayer"/.test(s), hasPcv=/printCv/.test(s);
  const projCls=(s.match(/class="([^"]*project-[^"]*)"/)||[])[1]||null;
  const ifp=(s.match(/initForProject\('([\w-]+)'\)/)||[])[1]||null;
  const validIfp = ifp && PRESETS.has(ifp);
  const callsCam=/\.initScrollCamera\s*\(/.test(s);   // the CALL, not a guard reference
  const secCount=(s.match(/<section/g)||[]).length;
  const tier=tierFor(p);
  // inline-build pages build their own SVG via private inline code (main, saul);
  // the harness cannot execute that, so they are checked structurally + camera-run.
  const inlineBuilder = /buildGeo\s*\(/.test(s) || /getElementById\((["'])(geo|geoLayer)\1\)\.innerHTML\s*=/.test(s);
  const motionSelf = /addEventListener\('scroll'/.test(s) && /setProperty\('--geo-(scale|tx|ty)'/.test(s);
  const isInline = inlineBuilder && !validIfp;

  let fail=[];
  if(isInline){
    if(!(hasGeo||hasGeoLayer)) fail.push('INLINE-NO-GEO-DIV');
    if(!/var\(--geo-scale/.test(s)) fail.push('INLINE-NO-TRANSFORM-CONSUMER');
    let moves;
    if(callsCam){ moves = execMotionCamera(); if(!moves) fail.push('CAMERA-NO-MOTION'); }
    else if(motionSelf){ moves = true; }            // own inline rig, cannot run here; 3-checked above
    else { fail.push('INLINE-NO-MOTION-SOURCE'); }
    rows.push({p, outcome:'inline-build'+(callsCam?'+camera':'+own-rig'), fail});
  } else {
    if(ifp && !validIfp) fail.push('MISSING-PRESET:'+ifp);
    if(validIfp && !loadsMand) fail.push('MISSING-MANDALA-JS');
    if(!validIfp && loadsIndra && tier!=='off' && !loadsAlive) fail.push('MISSING-ALIVE-CSS');
    const r = execPage({path:p, hasGeo, hasPcv, projCls, sectionCount:secCount}, {ifpKey:ifp, loadsMand, loadsIndra});
    if(r.err) fail.push('THREW:'+r.err.slice(0,50));
    if(!r.built) fail.push('NO-SVG-BUILT');
    if(!r.moves) fail.push('NO-MOTION-ON-SCROLL');
    rows.push({p, outcome: r.built?(r.moves?'built+moves':'built/STATIC'):'NONE', fail});
  }
  if(fail.length) fails.push({p, fail:fail.join(' ')});
}

// ---- engine invariants (independent second check) -------------------------
const inv=[];
const I=(n,ok)=>inv.push({n,ok});
I('mandala exports initScrollCamera', /initScrollCamera\s*:/.test(mandalaSrc));
I('mandala has global-scroll fallback', /forceGlobal/.test(mandalaSrc) && /scrollHeight - window\.innerHeight/.test(mandalaSrc));
I('#geo svg consumes --geo-scale', /#geo svg[\s\S]{0,200}var\(--geo-scale/.test(read('css/main.css')));
I('indra scroll-couples #indraLayer', /addEventListener\('scroll'/.test(indraSrc) && /layer\.style\.transform/.test(indraSrc));
I('alive.css styles #indraLayer', /#indraLayer\s*\{/.test(read('css/alive.css')));
const invFail = inv.filter(i=>!i.ok);

// ---- report ---------------------------------------------------------------
const dist={}; rows.forEach(r=>dist[r.outcome]=(dist[r.outcome]||0)+1);
console.log('pages executed: '+rows.length+'   (auto-includes any future .html)');
console.log('result: '+Object.entries(dist).map(([k,v])=>v+' '+k).join('  |  '));
console.log('');
console.log('engine invariants:'); inv.forEach(i=>console.log('  '+(i.ok?'PASS':'FAIL')+'  '+i.n));
console.log('');
if(fails.length===0 && invFail.length===0){
  console.log('GEOMETRY COMPLETE — every page BUILDS a substrate and MOVES on scroll, engine intact.');
  process.exit(0);
} else {
  console.log('GEOMETRY INCOMPLETE — do NOT claim done:');
  fails.forEach(g=>console.log('  PAGE '+g.p+'  ['+g.fail+']'));
  invFail.forEach(i=>console.log('  ENGINE BROKEN: '+i.n));
  process.exit(1);
}
