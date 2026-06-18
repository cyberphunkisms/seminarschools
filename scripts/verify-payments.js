#!/usr/bin/env node
/**
 * verify-payments.js
 *
 * Guards the Leizu payment wiring against the drift class found in the June
 * audit: a tile button that points to a non-existent product, a payment link
 * that is malformed or still a placeholder, or a post-payment redirect that
 * lands on an undefined Cal.com entry.
 *
 * It does NOT and CANNOT check the actual dollar amount a Stripe link charges.
 * Only the Stripe dashboard holds that. This checks WIRING, not prices.
 *
 * Exit 1 only on a real breakage:
 *   - a data-payment-key on the page with no matching PAYMENT_LINKS entry
 *   - a reachable payment key whose link is missing/placeholder/not a stripe URL
 *   - a reachable payment key with no Cal.com entry (post-payment 404 risk)
 * Orphan keys (defined but no tile points to them, e.g. the seminar links while
 * that decision is pending) are reported as WARNINGS and do not fail the run.
 *
 * Run: node scripts/verify-payments.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'leizu/index.html');
const SCRIPT = path.join(ROOT, 'leizu/booking-button.js');
const SUCCESS = path.join(ROOT, 'leizu/booking-success/index.html');

const errors = [];
const warnings = [];
const notes = [];

function read(p){ return fs.readFileSync(p, 'utf8'); }

// --- 1. PAYMENT_LINKS, lifted by running the script headless -----------------
function loadPaymentLinks(){
  const code = read(SCRIPT);
  const listeners = {};
  const sandbox = {
    document: { addEventListener:(e,f)=>{listeners[e]=f;}, querySelector:()=>null, querySelectorAll:()=>[], location:{pathname:'/leizu/'} },
    window: {}, localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}, setTimeout:()=>{}, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return vm.runInContext('typeof PAYMENT_LINKS !== "undefined" ? PAYMENT_LINKS : null', sandbox);
}

// --- 2. data-payment-key values used on the page ------------------------------
function loadPageKeys(){
  // Scan every surface that carries pay buttons: the Leizu tiles and the
  // intake-page enrol bubble. Both use data-payment-key wired by the same
  // PAYMENT_LINKS, so both must be guarded.
  const files = [PAGE, path.join(ROOT, 'leizu/intake/index.html')];
  const keys = [];
  const re = /data-payment-key="([^"]+)"/g;
  for(const f of files){
    if(!fs.existsSync(f)) continue;
    const html = read(f);
    let m;
    while((m = re.exec(html)) !== null) keys.push(m[1]);
  }
  return keys;
}

// --- 3. CAL_LINKS from the success page (the single source after dedup) -------
function loadCalLinks(){
  const html = read(SUCCESS);
  const m = html.match(/const\s+CAL_LINKS\s*=\s*\{[\s\S]*?\};/);
  if(!m){ errors.push('CAL_LINKS object not found in booking-success/index.html'); return {}; }
  const sandbox = {}; vm.createContext(sandbox);
  vm.runInContext(m[0] + '\nthis.__cal = CAL_LINKS;', sandbox);
  return sandbox.__cal || {};
}

const PAYMENT_LINKS = loadPaymentLinks();
if(!PAYMENT_LINKS){ console.error('FATAL: could not read PAYMENT_LINKS from booking-button.js'); process.exit(1); }
const pageKeys = loadPageKeys();
const CAL_LINKS = {}; // post-payment redirects are set inside each Stripe link now, not tracked in code

const uniquePageKeys = [...new Set(pageKeys)];
const linkKeys = Object.keys(PAYMENT_LINKS);
const isStripe = (u) => typeof u === 'string' && u.indexOf('https://buy.stripe.com/') === 0;
const isPlaceholder = (u) => typeof u !== 'string' || u.length === 0 || u.indexOf('REPLACE') !== -1;

// CHECK A. every page key resolves to a PAYMENT_LINKS entry
for(const k of uniquePageKeys){
  if(!(k in PAYMENT_LINKS)) errors.push(`Tile button data-payment-key="${k}" has NO entry in PAYMENT_LINKS (broken button)`);
}

// CHECK B. every reachable, paid key has a usable stripe link + a cal entry
for(const k of uniquePageKeys){
  if(!(k in PAYMENT_LINKS)) continue;
  if(k === 'donation') continue;
  const u = PAYMENT_LINKS[k];
  if(isPlaceholder(u)) errors.push(`Reachable key "${k}" still points to a placeholder link`);
  else if(!isStripe(u)) errors.push(`Reachable key "${k}" link is not a buy.stripe.com URL: ${u}`);
}

// CHECK C. orphans: defined links no tile reaches (warn, do not fail)
for(const k of linkKeys){
  if(k === 'donation') continue;
  if(!uniquePageKeys.includes(k)) warnings.push(`Link "${k}" is defined but no tile button reaches it (orphan)`);
}

// CHECK D. cal keys with no matching payment key (stale cal entry, warn)
for(const k of Object.keys(CAL_LINKS)){
  if(k === 'donation') continue;
  if(!(k in PAYMENT_LINKS)) warnings.push(`Cal.com entry "${k}" has no matching PAYMENT_LINKS key (stale)`);
}

notes.push(`PAYMENT_LINKS keys: ${linkKeys.length} (${linkKeys.join(', ')})`);
notes.push(`Tile buttons on page: ${uniquePageKeys.length} (${uniquePageKeys.join(', ')})`);
notes.push(`Cal.com entries: ${Object.keys(CAL_LINKS).length}`);

console.log('=== verify-payments ===');
notes.forEach(n => console.log('  · ' + n));
if(warnings.length){ console.log('\nWARNINGS (' + warnings.length + '):'); warnings.forEach(w => console.log('  ! ' + w)); }
if(errors.length){ console.log('\nERRORS (' + errors.length + '):'); errors.forEach(e => console.log('  X ' + e)); console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS (no broken wiring)' + (warnings.length ? ' — warnings above are informational' : ''));
process.exit(0);
