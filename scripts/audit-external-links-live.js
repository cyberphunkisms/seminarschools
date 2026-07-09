#!/usr/bin/env node
'use strict';
/** Optional live rot-checker. It makes network calls, so it is intentionally
 * separate from the normal offline deploy guards. Results are cached in
 * scripts/reports/external-link-live-cache.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'scripts', 'reports');
const CACHE = path.join(REPORT_DIR, 'external-link-live-cache.json');
const MAX = Number(process.env.EXTERNAL_LINK_CHECK_LIMIT || 250);
const TTL_MS = Number(process.env.EXTERNAL_LINK_CACHE_HOURS || 168) * 3600_000;
const TIMEOUT_MS = Number(process.env.EXTERNAL_LINK_TIMEOUT_MS || 9000);
const EXCLUDE = new Set(['.git','node_modules','.netlify','public']);
function walk(d, out=[]) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.isFile() && e.name.endsWith('.html')) out.push(f);
  }
  return out;
}
function linksFrom(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const out = [];
  for (const m of text.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
    const v = m[2];
    if (/^https?:\/\//i.test(v) && !/^https?:\/\/seminarschools\.com/i.test(v)) out.push(v.split('#')[0]);
  }
  return out;
}
function request(url, method='HEAD', redirects=0) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, { method, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'SeminarSchoolsLinkAudit/1.0' } }, res => {
      const code = res.statusCode || 0;
      const loc = res.headers.location;
      res.resume();
      if ([301,302,303,307,308].includes(code) && loc && redirects < 3) {
        try { return resolve(request(new URL(loc, url).toString(), 'HEAD', redirects + 1)); } catch { }
      }
      if ((code === 405 || code === 403) && method === 'HEAD') return resolve(request(url, 'GET', redirects));
      resolve({ ok: code >= 200 && code < 400, status: code });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'timeout' }); });
    req.on('error', err => resolve({ ok: false, status: err.code || err.message }));
    req.end();
  });
}
(async function main(){
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const urls = [...new Set(walk(ROOT).flatMap(linksFrom))].slice(0, MAX);
  const now = Date.now();
  const results = {};
  let checked = 0;
  for (const url of urls) {
    if (cache[url] && now - cache[url].checked_at_ms < TTL_MS) { results[url] = cache[url]; continue; }
    const r = await request(url);
    results[url] = { ...r, checked_at: new Date().toISOString(), checked_at_ms: now };
    checked++;
  }
  fs.writeFileSync(CACHE, JSON.stringify({ ...cache, ...results }, null, 2));
  const bad = Object.entries(results).filter(([, r]) => !r.ok);
  const report = { checked_live_this_run: checked, considered: urls.length, failures: bad.map(([url, r]) => ({ url, status: r.status })) };
  fs.writeFileSync(path.join(REPORT_DIR, 'external-link-live-report.json'), JSON.stringify(report, null, 2));
  console.log(`LIVE EXTERNAL LINK AUDIT COMPLETE — ${checked} live checks, ${bad.length} possible failures. See scripts/reports/external-link-live-report.json`);
  if (process.env.EXTERNAL_LINK_STRICT === '1' && bad.length) process.exit(1);
})();
