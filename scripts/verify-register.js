#!/usr/bin/env node
/* =========================================================================
   VERIFY-REGISTER  —  Mephistodata register gate (rev1 2026-06-19)

   Doctrine on file did not stop register violations. A gate does. This
   refuses to package when banned constructions appear in copy that is mine
   to write, the same class that shipped "one organism, not a portfolio."

   PROSE checks run on chrome and UI copy. Authored prose and quoted
   material are exempt by path or by snippet in scripts/register-allow.json,
   because the ban governs my writing, not your diary and not a citation.

     DASH    em dash, en dash, or their entities attaching content
     NEGDEF  "X, not Y" and "not X but Y"
     FILLER  the words thing, things, stuff

   STRUCTURAL checks run on every real page.

     BORNALIVE  mandala.js and indra.js and alive.css all present
     OG         og:title present

   A hit is suppressed only if its path is exempt or its (file,type) sits
   in the allowlist. Any surviving hit fails the gate.

   Run:  node scripts/verify-register.js   (exit 0 = clean, 1 = blocked)
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const readL1 = (p) => fs.readFileSync(p, 'latin1');
function walk(dir){ let o=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.name==='node_modules'||e.name.startsWith('.'))continue; const fp=path.join(dir,e.name); if(e.isDirectory())o=o.concat(walk(fp)); else if(e.name.endsWith('.html'))o.push(path.relative(ROOT,fp).replace(/\\/g,'/')); } return o; }

let allow = { proseExemptPrefixes:[], ogExempt:[], bornAliveExempt:[], snippetAllow:[] };
try { allow = Object.assign(allow, JSON.parse(readL1(path.join(__dirname,'register-allow.json')))); } catch(e){ console.log('note: no register-allow.json, running with empty allowlist'); }

const underAny = (f, prefixes) => prefixes.some(p => f === p || f.startsWith(p.replace(/\/?$/,'/')) || f.startsWith(p));
const snippetAllowed = (f, type, count) => allow.snippetAllow.some(s => s.file === f && s.type === type && count <= (s.max || 0));

// strip scripts, styles, comments, then tags -> visible text (latin1-safe)
function visibleText(s){
  s = s.replace(/<script[\s\S]*?<\/script>/gi,' ')
       .replace(/<style[\s\S]*?<\/style>/gi,' ')
       .replace(/<!--[\s\S]*?-->/g,' ')
       .replace(/<[^>]+>/g,' ');
  return s;
}
const EM = '\u00e2\u0080\u0094';   // UTF-8 em dash bytes seen through latin1
const EN = '\u00e2\u0080\u0093';   // UTF-8 en dash bytes seen through latin1
function countDashes(t){
  let n = 0;
  n += (t.split(EM).length - 1);
  n += (t.split(EN).length - 1);
  n += (t.match(/&mdash;|&ndash;|&#8212;|&#8211;/g) || []).length;
  n += (t.match(/[\u2013\u2014]/g) || []).length;
  return n;
}
function negdefHits(t){
  const a = (t.match(/\b[\w'']+,\s+not\s+[\w'']/g) || []);
  const b = (t.match(/\bnot\b[^.;:!?\n]{1,60}\bbut\b/gi) || []);
  return a.concat(b);
}
function fillerHits(t){ return (t.match(/\b(things?|stuff)\b/gi) || []); }

const isRealPage = (f, s) =>
  !/http-equiv=["']refresh["']/i.test(s) &&
  !/google[0-9a-f]{10,}/.test(f) &&
  path.basename(f) !== '404.html';

const files = walk(ROOT);
let fail = 0;
const report = [];
function flag(f, type, count, detail){
  if (snippetAllowed(f, type, count)) return;
  report.push({ f, type, detail });
  fail = 1;
}

for (const f of files){
  const s = readL1(path.join(ROOT, f));
  const real = isRealPage(f, s);
  const vt = visibleText(s);

  if (!underAny(f, allow.proseExemptPrefixes)){
    const d = countDashes(vt);
    if (d) flag(f, 'DASH', d, d + ' dash(es) in visible copy');
    const nd = negdefHits(vt);
    if (nd.length) flag(f, 'NEGDEF', nd.length, nd.length + ' e.g. "' + nd[0].trim().replace(/\s+/g,' ').slice(0,48) + '"');
    const fl = fillerHits(vt);
    if (fl.length) flag(f, 'FILLER', fl.length, fl.length + ' e.g. "' + fl[0] + '"');
  }

  if (real){
    if (!underAny(f, allow.bornAliveExempt)){
      const missing = ['mandala.js','indra.js','alive.css'].filter(a => !s.includes(a));
      if (missing.length) flag(f, 'BORNALIVE', 1, 'missing ' + missing.join(', '));
    }
    if (!underAny(f, allow.ogExempt)){
      if (!/property=["']og:title["']/.test(s)) flag(f, 'OG', 1, 'no og:title');
    }
  }
}

const byType = {};
for (const r of report){ (byType[r.type]=byType[r.type]||[]).push(r); }
for (const t of ['DASH','NEGDEF','FILLER','BORNALIVE','OG']){
  const rs = byType[t] || [];
  console.log((rs.length?'FAIL':'PASS') + '  ' + t + '  (' + rs.length + ')');
  for (const r of rs) console.log('        ' + r.f + ' :: ' + r.detail);
}
console.log(fail ? '\nREGISTER GATE BLOCKED' : '\nregister gate clean');
process.exit(fail);
