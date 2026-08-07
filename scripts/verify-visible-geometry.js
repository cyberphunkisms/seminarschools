#!/usr/bin/env node
/*
  VERIFY VISIBLE GEOMETRY — hard guard for CL-63 / Indra geometry.
  Every actual source and deployable public webpage must be born connected to
  alive.css, mandala.js, indra.js, and the body-level geometry contract.
*/
'use strict';
const fs=require('fs');
const path=require('path');
const {isGeneratedDependencyDirectory}=require('./repository-walk-policy');
const ROOT=process.cwd();
const PUBLIC=path.join(ROOT,'public');
const ASSET_VERSION='20260806-front-facing-geometry';
const GEOMETRY_CONTRACTS=JSON.parse(fs.readFileSync(path.join(ROOT,'data','geometry-route-contracts.json'),'utf8'));
const GOOGLE_TOKEN='google20234ae70106ee9d.html';
const GOOGLE_TOKEN_BYTES=Buffer.from('google-site-verification: google20234ae70106ee9d.html\n','utf8');
const SOURCE_SKIP=new Set(['.git','node_modules','.netlify','public','fixtures']);
const NESTED_SKIP=new Set(['.git','node_modules','.netlify']);
const SOURCE_ONLY_ROUTES=new Set(['dashboard/index.html']);
function walk(dir,skip,acc=[]){
  if(!fs.existsSync(dir)) return acc;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(entry.name)||isGeneratedDependencyDirectory(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full,skip,acc);
    else if(entry.isFile()&&entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}
function rel(base,file){return path.relative(base,file).replace(/\\/g,'/');}
function assetTags(html, pattern){return html.match(pattern)||[];}
function exactVersion(tags,asset){
  return tags.length===1&&new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\?v=${ASSET_VERSION}(?:["'])`,'i').test(tags[0]);
}
function hasStructuralForeground(html){
  return /\bid=["'](?:geo|geo2|geoLayer|projectMap)["']/i.test(html)||
    /\bdata-geometry-foreground=["']structural["']/i.test(html)||
    /\bclass=["'][^"']*(?:project-map|cv-route-bridge__geometry|geometry-stage|mandala-stage)[^"']*["']/i.test(html);
}
function stripAllowedMedia(css){
  let out='';let cursor=0;
  while(cursor<css.length){
    const match=/@media\s*([^\{]*)\{/ig;match.lastIndex=cursor;
    const found=match.exec(css);
    if(!found){out+=css.slice(cursor);break;}
    out+=css.slice(cursor,found.index);
    let depth=1,index=match.lastIndex,quote='',escaped=false;
    for(;index<css.length&&depth>0;index++){
      const char=css[index];
      if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue;}
      if(char==='"'||char==="'"){quote=char;continue;}
      if(char==='{')depth++;else if(char==='}')depth--;
    }
    const query=found[1].toLowerCase();
    if(!/\bprint\b/.test(query)&&!/forced-colors\s*:\s*active/.test(query))out+=css.slice(found.index,index);
    cursor=index;
  }
  return out;
}
function geometryHideRules(css){
  const screen=stripAllowedMedia(css.replace(/\/\*[\s\S]*?\*\//g,''));
  const failures=[];let match;
  const rules=/([^{}]+)\{([^{}]*)\}/g;
  while((match=rules.exec(screen))){
    const selector=match[1],declarations=match[2];
    if(!/#indraLayer\b/.test(selector))continue;
    if(/(?:^|;)\s*display\s*:\s*(?:none|contents)\b/i.test(declarations))failures.push('display');
    if(/(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)\b/i.test(declarations))failures.push('visibility');
    if(/(?:^|;)\s*opacity\s*:\s*0(?:\.0*)?\s*(?:!important\s*)?(?:;|$)/i.test(declarations))failures.push('opacity');
    if(/(?:^|;)\s*z-index\s*:\s*-(?:\d|\.)/i.test(declarations))failures.push('z-index');
    if(/(?:^|;)\s*(?:inline-size|block-size|width|height|max-width|max-height)\s*:\s*0(?:px|rem|em|%|vh|vw|vmin|vmax)?\b/i.test(declarations))failures.push('zero-size');
    if(/(?:^|;)\s*(?:clip-path\s*:\s*inset\(\s*(?:50|100)%|transform\s*:[^;]*scale(?:3d)?\(\s*0|content-visibility\s*:\s*hidden|filter\s*:[^;]*opacity\(\s*0)/i.test(declarations))failures.push('clipped');
  }
  return [...new Set(failures)];
}
function geometryOpacityValues(css){
  const screen=stripAllowedMedia(css.replace(/\/\*[\s\S]*?\*\//g,''));
  const values=[];let match;
  const rules=/([^{}]+)\{([^{}]*)\}/g;
  while((match=rules.exec(screen))){
    if(!/#indraLayer\b/.test(match[1]))continue;
    const opacity=match[2].match(/(?:^|;)\s*opacity\s*:\s*([0-9]*\.?[0-9]+)/i);
    if(opacity)values.push(Number(opacity[1]));
  }
  return values.filter(Number.isFinite);
}
const cssCache=new Map();
function inspectLinkedCss(html,base,pageRoute,label,errors){
  const links=[...html.matchAll(/<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/ig)]
    .map(match=>match[1]||match[2]);
  for(const href of links){
    if(/^(?:[a-z]+:)?\/\//i.test(href)||/^(?:data:|blob:)/i.test(href))continue;
    const clean=href.split(/[?#]/,1)[0];
    const file=clean.startsWith('/')?path.join(base,clean.slice(1)):path.resolve(path.dirname(path.join(base,pageRoute)),clean);
    const key=`${base}:${file}`;
    let hidden=cssCache.get(key);
    if(hidden===undefined){
      if(!fs.existsSync(file)){errors.push(`${label}:${pageRoute}: linked local CSS missing: ${href}`);cssCache.set(key,[]);continue;}
      hidden=geometryHideRules(fs.readFileSync(file,'utf8'));cssCache.set(key,hidden);
    }
    if(hidden.length)errors.push(`${label}:${pageRoute}: linked CSS ${href} hides/buries geometry via ${hidden.join(', ')}`);
  }
}
function verifyGoogleToken(errors){
  const sourcePath=path.join(ROOT,GOOGLE_TOKEN);const publicPath=path.join(PUBLIC,GOOGLE_TOKEN);
  for(const [label,file] of [['source',sourcePath],['public',publicPath]]){
    if(!fs.existsSync(file)){errors.push(`${label}:${GOOGLE_TOKEN}: exact Google verification token missing`);continue;}
    const bytes=fs.readFileSync(file);
    if(!bytes.equals(GOOGLE_TOKEN_BYTES))errors.push(`${label}:${GOOGLE_TOKEN}: expected ${GOOGLE_TOKEN_BYTES.length} exact bytes, found ${bytes.length}`);
  }
  if(fs.existsSync(sourcePath)&&fs.existsSync(publicPath)&&!fs.readFileSync(sourcePath).equals(fs.readFileSync(publicPath)))errors.push(`${GOOGLE_TOKEN}: source/public bytes differ`);
  const attributes=path.join(ROOT,'.gitattributes');
  if(!fs.existsSync(attributes)||!/^google20234ae70106ee9d\.html\s+text\s+eol=lf\s*$/m.test(fs.readFileSync(attributes,'utf8')))errors.push('.gitattributes must lock the Google token to LF bytes');
}
function inspect(files,base,label,errors,coverage){
  for(const file of files){
    const r=rel(base,file); const html=fs.readFileSync(file,'utf8');
    if(r===GOOGLE_TOKEN)continue;
    if(!/<body\b/i.test(html)){errors.push(`${label}:${r}: missing body element`);continue;}
    const bodyTag=(html.match(/<body\b[^>]*>/i)||[])[0]||'';
    const isRedirect=/http-equiv=["']refresh["']/i.test(html)&&/location\.replace\(/.test(html);
    const alive=assetTags(html,/<link\b[^>]*href=["'][^"']*\/css\/alive\.css[^"']*["'][^>]*>/ig);
    const mandala=assetTags(html,/<script\b[^>]*src=["'][^"']*\/js\/mandala\.js[^"']*["'][^>]*>/ig);
    const indra=assetTags(html,/<script\b[^>]*src=["'][^"']*\/js\/indra\.js[^"']*["'][^>]*>/ig);
    if(alive.length!==1)errors.push(`${label}:${r}: expected one alive.css include, found ${alive.length}`);
    if(mandala.length!==1)errors.push(`${label}:${r}: expected one mandala.js include, found ${mandala.length}`);
    if(indra.length!==1)errors.push(`${label}:${r}: expected one indra.js include, found ${indra.length}`);
    if(!exactVersion(alive,'/css/alive.css'))errors.push(`${label}:${r}: alive.css must use exact version ${ASSET_VERSION}`);
    if(!exactVersion(mandala,'/js/mandala.js'))errors.push(`${label}:${r}: mandala.js must use exact version ${ASSET_VERSION}`);
    if(!exactVersion(indra,'/js/indra.js'))errors.push(`${label}:${r}: indra.js must use exact version ${ASSET_VERSION}`);
    const mandalaIndex=html.search(/<script\b[^>]*src=["'][^"']*\/js\/mandala\.js/i);
    const indraIndex=html.search(/<script\b[^>]*src=["'][^"']*\/js\/indra\.js/i);
    const footerIndex=html.search(/<script\b[^>]*src=["'][^"']*\/js\/footer\.js/i);
    if(!(mandalaIndex>=0&&indraIndex>mandalaIndex&&(footerIndex<0||footerIndex>indraIndex)))errors.push(`${label}:${r}: geometry assets must load mandala then indra then footer`);
    for(const attribute of ['data-geometry','data-route-type','data-geometry-role','data-indra-intensity']){
      const count=(bodyTag.match(new RegExp(`\\b${attribute}\\s*=`, 'ig'))||[]).length;
      if(count!==1)errors.push(`${label}:${r}: expected one ${attribute} body attribute, found ${count}`);
    }
    if(!/\bdata-geometry=["']indra-web["']/i.test(bodyTag))errors.push(`${label}:${r}: body missing data-geometry="indra-web"`);
    const routeType=(bodyTag.match(/\bdata-route-type=["']([^"']+)["']/i)||[])[1];
    const geometryRole=(bodyTag.match(/\bdata-geometry-role=["']([^"']+)["']/i)||[])[1];
    if(!routeType)errors.push(`${label}:${r}: body missing data-route-type`);
    else if(!GEOMETRY_CONTRACTS.route_types[routeType])errors.push(`${label}:${r}: unknown route type ${routeType}`);
    if(!geometryRole)errors.push(`${label}:${r}: body missing data-geometry-role`);
    else if(routeType&&GEOMETRY_CONTRACTS.route_types[routeType]){
      const expected=GEOMETRY_CONTRACTS.route_types[routeType].join(' ');
      const actual=geometryRole.trim().replace(/\s+/g,' ');
      if(actual!==expected)errors.push(`${label}:${r}: geometry role "${actual}" does not match ${routeType} contract "${expected}"`);
    }
    const geometryFloor=hasStructuralForeground(html)?0.055:0.06;
    const intensity=html.match(/<body\b[^>]*data-indra-intensity=["']([0-9.]+)["']/i);
    if(!intensity)errors.push(`${label}:${r}: body missing data-indra-intensity`);
    else {
      const n=Number(intensity[1]);
      if(!Number.isFinite(n)||n<geometryFloor||n>0.13)errors.push(`${label}:${r}: geometry intensity ${intensity[1]} outside ${geometryFloor.toFixed(3)}–0.13 for this foreground mode`);
    }
    const inlineStyles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
    const opacityCaps=geometryOpacityValues(inlineStyles).filter(value=>value<geometryFloor);
    if(opacityCaps.length)errors.push(`${label}:${r}: inline CSS caps #indraLayer opacity below ${geometryFloor.toFixed(3)} (${opacityCaps.join(', ')})`);
    const screenStyles=inlineStyles
      .replace(/@media\s+print\s*\{[\s\S]*?\}\s*\}/gi,'')
      .replace(/@media\s*\(forced-colors:\s*active\)\s*\{[\s\S]*?\}\s*\}/gi,'');
    if(/#indraLayer\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0*)?(?:\s*!important)?\s*(?:;|})|z-index\s*:\s*-)/i.test(screenStyles))errors.push(`${label}:${r}: ordinary screen CSS hides or buries #indraLayer`);
    if(/getElementById\(["']indraLayer["']\)[\s\S]{0,120}(?:remove\(|display\s*=\s*["']none|visibility\s*=\s*["']hidden)/i.test(html))errors.push(`${label}:${r}: page script hides or removes #indraLayer`);
    if(/\bid=["']indraLayer["']/i.test(html))errors.push(`${label}:${r}: HTML must not hardcode runtime-owned #indraLayer`);
    const inlineHides=geometryHideRules(inlineStyles);
    if(inlineHides.length)errors.push(`${label}:${r}: inline CSS hides/buries geometry via ${inlineHides.join(', ')}`);
    inspectLinkedCss(html,base,r,label,errors);
    coverage.total++;
    if(isRedirect)coverage.redirect++;
    if(/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html))coverage.noindex++;
    if(html.includes('Seminar Schools Static Search Surface'))coverage.staticSearch++;
    if(/^(?:saul|reviews)\//.test(r))coverage.cv++;
    if(/^polymythseminars\/events\//.test(r))coverage.events++;
  }
}
const source=walk(ROOT,SOURCE_SKIP);const deployed=walk(PUBLIC,NESTED_SKIP);const errors=[];const warnings=[];
verifyGoogleToken(errors);
const sourceCoverage={total:0,redirect:0,noindex:0,staticSearch:0,cv:0,events:0};
const publicCoverage={total:0,redirect:0,noindex:0,staticSearch:0,cv:0,events:0};
inspect(source,ROOT,'source',errors,sourceCoverage);inspect(deployed,PUBLIC,'public',errors,publicCoverage);
const sourceRoutes=new Set(source.map(f=>rel(ROOT,f)).filter(r=>r!==GOOGLE_TOKEN));const publicRoutes=new Set(deployed.map(f=>rel(PUBLIC,f)).filter(r=>r!==GOOGLE_TOKEN));
for(const r of sourceRoutes){if(!SOURCE_ONLY_ROUTES.has(r)&&!publicRoutes.has(r))errors.push(`public:${r}: source webpage missing from deploy tree`);}
for(const r of publicRoutes){if(!sourceRoutes.has(r))errors.push(`source:${r}: public webpage has no source twin`);}
const indraPath=path.join(ROOT,'js','indra.js');const alivePath=path.join(ROOT,'css','alive.css');
if(!fs.existsSync(indraPath))errors.push('js/indra.js missing');else{const x=fs.readFileSync(indraPath,'utf8');if(!/VISIBLE_GEOMETRY_GUARD/.test(x))warnings.push('js/indra.js lacks VISIBLE_GEOMETRY_GUARD marker');if(/document\.getElementById\(['"]printCv['"]\)/.test(x))errors.push('js/indra.js still disables geometry on CV pages via #printCv');if(!/layer\.id\s*=\s*['"]indraLayer['"]/.test(x))errors.push('js/indra.js does not create #indraLayer');if(!/data-geometry-proof["'],\s*["']all-page-scroll/.test(x))errors.push('js/indra.js must identify shared geometry as all-page-scroll');if(!/pointerEvents\s*=\s*['"]none['"]|pointer-events\s*:\s*none/.test(x)&&!(/pointer-events\s*:\s*none/.test(fs.readFileSync(alivePath,'utf8'))))warnings.push('geometry pointer-event isolation not found');}
if(!fs.existsSync(alivePath))errors.push('css/alive.css missing');else{const x=fs.readFileSync(alivePath,'utf8');if(!/#indraLayer\s*\{/.test(x))errors.push('css/alive.css missing #indraLayer styling');if(!/VISIBLE_GEOMETRY_CONTRACT/.test(x))warnings.push('css/alive.css lacks VISIBLE_GEOMETRY_CONTRACT marker');if(!/#indraLayer\s*\{[\s\S]{0,500}position:\s*fixed/.test(x))errors.push('css/alive.css must keep #indraLayer fixed');const z=(x.match(/#indraLayer\s*\{[\s\S]{0,500}?z-index:\s*(\d+)/)||[])[1];if(!z||Number(z)<2000000000)errors.push('css/alive.css must keep geometry at z-index >= 2000000000');if(!/#indraLayer\s*\{[\s\S]{0,500}pointer-events:\s*none/.test(x))errors.push('css/alive.css must keep geometry pointer-safe');if(!/@media\s+print[\s\S]*#indraLayer/.test(x))errors.push('css/alive.css must hide geometry in print');if(!/@media\s*\(forced-colors:\s*active\)[\s\S]*#indraLayer\s*\{\s*display:\s*none/.test(x))errors.push('css/alive.css may suppress geometry only in forced colours');if(!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*#indraLayer\s*\{\s*will-change:\s*auto/.test(x))errors.push('css/alive.css must keep reduced-motion geometry visible and static');}
const cvCss=fs.readFileSync(path.join(ROOT,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');
if(!/background:linear-gradient\([^\n]*rgba\([^)]*,\.(?:5|6|7|8)/.test(cvCss))warnings.push('CV surface translucency should be visually rechecked');
if(errors.length){console.error('VISIBLE GEOMETRY CHECK FAILED');errors.slice(0,160).forEach(e=>console.error(' - '+e));if(errors.length>160)console.error(` ... ${errors.length-160} more`);process.exit(1);}
if(warnings.length){console.warn('VISIBLE GEOMETRY WARNINGS');warnings.forEach(w=>console.warn(' - '+w));}
console.log(`VISIBLE GEOMETRY CHECK PASSED — ${sourceCoverage.total} source and ${publicCoverage.total} public HTML pages carry one ordered ${ASSET_VERSION} geometry contract, linked and inline CSS preserve it, and intensity respects structural-foreground floors; source coverage includes ${sourceCoverage.redirect} redirect fallbacks, ${sourceCoverage.staticSearch} static-search pages, ${sourceCoverage.events} event pages, ${sourceCoverage.cv} CV pages, and ${sourceCoverage.noindex} noindex pages; exact ${GOOGLE_TOKEN_BYTES.length}-byte Google tokens match in source/public.`);
