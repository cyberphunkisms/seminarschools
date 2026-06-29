#!/usr/bin/env node
/**
 * COMPREHENSIVE SITE AUDIT — seminarschools.com
 * Catches recurring bug categories. Run before every zip.
 * Exit 0 = clean, Exit 1 = issues found.
 *
 * CATEGORIES:
 *  1. HTML tag balance (script, style)
 *  2. PM35 guard (events.json parity)
 *  3. Events data integrity (dates, titles, types, duplicates)
 *  4. Feed XML well-formedness
 *  5. CSS duplicate declarations
 *  6. Substrate vocabulary leaks
 *  7. Geometry undeclared variables
 *  8. Stripe/Cal.com placeholder links
 *  9. Broken internal links
 * 10. UTF-8 BOM detection
 * 11. Dark-mode CSS var completeness
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let issues = [], warnings = [];
const issue = (f, m) => issues.push(`[ISSUE] ${f}: ${m}`);
const warn  = (f, m) => warnings.push(`[WARN]  ${f}: ${m}`);

function walkHTML(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (/^(node_modules|\.git|_retired)$/.test(e.name)) continue;
    if (e.isDirectory()) out.push(...walkHTML(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const HTML = walkHTML(ROOT).filter(f => !f.includes('/scripts/'));

// ── 1. TAG BALANCE ──
for (const f of HTML) {
  const s = fs.readFileSync(f,'utf8'), r = path.relative(ROOT,f);
  const chk = (tag) => {
    const o = (s.match(new RegExp(`<${tag}[\\s>]`,'gi'))||[]).length;
    const c = (s.match(new RegExp(`</${tag}>`,'gi'))||[]).length;
    if (o!==c) issue(r, `<${tag}> mismatch: ${o} opens, ${c} closes`);
  };
  chk('script'); chk('style');
}

// ── 2. PM35 GUARD ──
{
  const a=path.join(ROOT,'polymythseminars/events.json'), b=path.join(ROOT,'data/polymyth-seminar-events.json');
  if (fs.existsSync(a)&&fs.existsSync(b)) {
    if (!fs.readFileSync(a).equals(fs.readFileSync(b)))
      issue('PM35',`polymythseminars/events.json ≠ data/polymyth-seminar-events.json`);
  } else {
    if (!fs.existsSync(a)) issue('PM35','polymythseminars/events.json MISSING');
    if (!fs.existsSync(b)) issue('PM35','data/polymyth-seminar-events.json MISSING');
  }
}

// ── 3. EVENTS DATA ──
for (const ef of ['polymythseminars/events.json','data/polymyth-seminar-events.json','seminars/events.json']) {
  const fp = path.join(ROOT,ef);
  if (!fs.existsSync(fp)) { warn(ef,'missing'); continue; }
  try {
    const d = JSON.parse(fs.readFileSync(fp,'utf8'));
    const ev = Array.isArray(d)?d:(d.events||[]);
    let bad=0, nt=0, dupes=0;
    const seen = new Set();
    for (const e of ev) {
      if (!e.title) nt++;
      if (e.date && isNaN(new Date(e.date).getTime())) bad++;
      const k = (e.title||'')+'|'+(e.date||'');
      if (seen.has(k)) dupes++;
      seen.add(k);
    }
    if (bad) issue(ef,`${bad} unparseable dates`);
    if (nt) issue(ef,`${nt} events with no title`);
    if (dupes) warn(ef,`${dupes} duplicate title+date pairs`);
  } catch(e) { issue(ef,`JSON parse fail: ${e.message.slice(0,80)}`); }
}

// ── 4. FEED XML ──
for (const ff of ['polymythseminars/feed.xml','teacherresources/feed.xml','seminars/feed.xml','agora/feed.xml']) {
  const fp = path.join(ROOT,ff);
  if (!fs.existsSync(fp)) continue;
  const x = fs.readFileSync(fp,'utf8');
  const bad = x.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g);
  if (bad) issue(ff,`${bad.length} unescaped ampersands`);
}

// ── 5. CSS DUPLICATES ──
for (const f of HTML) {
  const s = fs.readFileSync(f,'utf8'), r = path.relative(ROOT,f);
  for (const block of s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const rb of block[1].matchAll(/\{([^}]+)\}/g)) {
      const props=[];
      for (const p of rb[1].matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) props.push(p[1]);
      const dupes = props.filter((v,i)=>props.indexOf(v)!==i);
      if (dupes.length) warn(r,`Duplicate CSS vars in rule: ${[...new Set(dupes)].join(', ')}`);
    }
    const lines = block[1].split('\n');
    for (let i=0;i<lines.length-1;i++){
      const a=lines[i].trim(), b=lines[i+1].trim();
      if (a && a===b && a.includes(':') && !a.startsWith('/'))
        warn(r,`Duplicate CSS line: "${a.slice(0,70)}"`);
    }
  }
}

// ── 6. SUBSTRATE LEAKS ──
{
  const BANNED = ['cmp-001','ses-002','dream-Harlem','badge tier','DM mechanics'];
  const pub = HTML.filter(f=>{const r=path.relative(ROOT,f);return!/^(polymyth\/|data\/|scripts\/|campaigns\/)/.test(r);});
  for (const f of pub) {
    const s=fs.readFileSync(f,'utf8'), r=path.relative(ROOT,f);
    for (const t of BANNED) if(s.includes(t)) issue(r,`Substrate leak: "${t}"`);
  }
}

// ── 7. GEOMETRY BUGS ──
for (const f of HTML) {
  const s=fs.readFileSync(f,'utf8'), r=path.relative(ROOT,f);
  for (const block of s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const js = block[1];
    if (js.includes('leanX') && !/(?:let|var|const)\s+leanX/.test(js))
      issue(r,'leanX used without declaration');
    if (js.includes('leanY') && !/(?:let|var|const)\s+leanY/.test(js))
      issue(r,'leanY used without declaration');
  }
}

// ── 8. PLACEHOLDER LINKS ──
for (const f of HTML) {
  const s=fs.readFileSync(f,'utf8'), r=path.relative(ROOT,f);
  for (const m of s.matchAll(/href="([^"]*(?:test_|placeholder|example\.com)[^"]*)"/gi))
    warn(r,`Placeholder link: ${m[1].slice(0,80)}`);
}

// ── 9. BROKEN INTERNAL LINKS ──
{
  const exists = new Set(['/']);
  (function walk(d,p){
    for (const e of fs.readdirSync(d,{withFileTypes:true})){
      if (e.name.startsWith('.')||e.name==='node_modules'||e.name==='scripts'||e.name==='data') continue;
      const full=path.join(d,e.name);
      if (e.isDirectory()){
        if (fs.existsSync(path.join(full,'index.html'))) exists.add('/'+p+e.name+'/');
        walk(full,p+e.name+'/');
      } else {
        exists.add('/'+p+e.name);
      }
    }
  })(ROOT,'');
  for (const f of HTML) {
    const s=fs.readFileSync(f,'utf8'), r=path.relative(ROOT,f);
    for (const m of s.matchAll(/href="(\/[^"#?]+)"/g)) {
      const t=m[1], n=t.match(/\.[a-z]+$/)?t:(t.endsWith('/')?t:t+'/');
      if (!exists.has(n)&&!exists.has(t)){
        const dp=path.join(ROOT,t.replace(/\/$/,'')),di=dp+'/index.html';
        if (!fs.existsSync(dp)&&!fs.existsSync(di)&&!fs.existsSync(dp+'.html'))
          warn(r,`Broken link: ${t}`);
      }
    }
  }
}

// ── 10. BOM ──
for (const f of HTML) {
  const b=fs.readFileSync(f), r=path.relative(ROOT,f);
  if (b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF) warn(r,'UTF-8 BOM');
}

// ── 11. DARK-MODE CSS VAR COMPLETENESS ──
for (const f of HTML) {
  const s=fs.readFileSync(f,'utf8'), r=path.relative(ROOT,f);
  // Find light-mode cat vars, then check dark-mode has them all
  const lightCats=new Set(), darkCats=new Set();
  for (const m of s.matchAll(/(--cat-[a-z]+)\s*:\s*#[0-9a-fA-F]+/g)) {
    // crude: first half of style block = light, after @media = dark
    lightCats.add(m[1]);
  }
  // Check dark blocks specifically
  const darkBlocks = s.matchAll(/@media\s*\(prefers-color-scheme:\s*dark\)[^{]*\{([\s\S]*?)\}\s*\}/g);
  for (const db of darkBlocks) {
    for (const m of db[1].matchAll(/(--cat-[a-z]+)\s*:/g)) darkCats.add(m[1]);
  }
  if (lightCats.size > 0 && darkCats.size > 0) {
    for (const lc of lightCats) {
      if (!darkCats.has(lc) && lc.startsWith('--cat-'))
        warn(r,`Light-mode var ${lc} missing from dark @media block`);
    }
  }
}

// ── REPORT ──
console.log('=== COMPREHENSIVE SITE AUDIT ===');
console.log(`Scanned ${HTML.length} HTML files\n`);
if (issues.length) { console.log(`❌ ${issues.length} ISSUES:`); issues.forEach(i=>console.log('  '+i)); }
if (warnings.length) { console.log(`\n⚠  ${warnings.length} WARNINGS:`); warnings.forEach(w=>console.log('  '+w)); }
if (!issues.length&&!warnings.length) console.log('✅ Clean');
console.log(`\n--- ${issues.length} issues, ${warnings.length} warnings ---`);
process.exit(issues.length?1:0);
