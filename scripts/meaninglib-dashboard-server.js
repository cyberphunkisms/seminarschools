#!/usr/bin/env node
/* Meaninglib local dashboard server. Pure Node.js, no network calls. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { search, loadIndex, cleanQuery } = require('./query-meaninglib.js');

const root = process.cwd();
const dashboardDir = path.join(root, 'dashboard');
const indexPath = path.join(root, 'hf_export', 'search', 'meaninglib_search_index.json');
const reportsDir = path.join(root, 'hf_export', 'reports');
const DEFAULT_PORT = Number(process.env.PORT || 8765);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safePath(base, requested) {
  const decoded = decodeURIComponent(requested.split('?')[0]);
  const clean = decoded === '/' ? '/index.html' : decoded;
  const full = path.normalize(path.join(base, clean));
  if (!full.startsWith(base)) return null;
  return full;
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': 'http://localhost'
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value, null, 2));
}

function publicDoc(doc, score) {
  return {
    id: doc.id || '',
    title: doc.title || '',
    star_file: doc.star_file || 'unknown',
    section: doc.section || '',
    source_path: doc.source_path || '',
    route: doc.route || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    score: Number(score || 0),
    preview: String(doc.preview || '').replace(/\s+/g, ' ').trim().slice(0, 900)
  };
}

function querySearch(params) {
  const q = cleanQuery(params.get('q') || '');
  const star = cleanQuery(params.get('star') || 'all').toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(params.get('limit') || 12)));
  if (!q) return { query: q, star, count: 0, results: [] };
  const raw = search(q, 200);
  let filtered = raw;
  if (star && star !== 'all') filtered = raw.filter(r => String(r.doc.star_file || '').toLowerCase() === star);
  filtered = filtered.slice(0, limit);
  return {
    query: q,
    star,
    count: filtered.length,
    results: filtered.map(r => publicDoc(r.doc, r.score))
  };
}

function health() {
  const index = readJson(indexPath);
  const counts = {};
  for (const d of index.docs || []) counts[d.star_file || 'unknown'] = (counts[d.star_file || 'unknown'] || 0) + 1;
  const reportFiles = ['search_report.md', 'meaninglib_search_verify_report.md', 'latest_export_report.md', 'privacy_scan_report.md'];
  return {
    ok: true,
    generated_at: index.generated_at,
    version: index.version,
    total_docs: index.total_docs || (index.docs || []).length,
    total_terms: index.total_terms || Object.keys(index.idf || {}).length,
    ontology_lock: index.ontology_lock || 'Meaninglib ontology lock missing',
    star_file_counts: counts,
    reports: reportFiles.map(name => ({ name, exists: fs.existsSync(path.join(reportsDir, name)) }))
  };
}

function handler(req, res) {
  const parsed = url.parse(req.url);
  const params = new URLSearchParams(parsed.query || '');
  try {
    if (parsed.pathname === '/api/health') return sendJson(res, 200, health());
    if (parsed.pathname === '/api/search') return sendJson(res, 200, querySearch(params));
    if (parsed.pathname && parsed.pathname.startsWith('/reports/')) {
      const file = safePath(reportsDir, parsed.pathname.replace('/reports', ''));
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      return send(res, 200, fs.readFileSync(file, 'utf8'), contentType(file));
    }
    const file = safePath(dashboardDir, parsed.pathname || '/');
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    return send(res, 200, fs.readFileSync(file), contentType(file));
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: String(err && err.message || err) });
  }
}

function listen(port, triesLeft = 20) {
  const server = http.createServer(handler);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) return listen(port + 1, triesLeft - 1);
    console.error('Dashboard server failed:', err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const link = `http://127.0.0.1:${port}`;
    console.log('==========================================');
    console.log('Meaninglib Dashboard running locally');
    console.log(`Open: ${link}`);
    console.log('Keep this window open while using the dashboard.');
    console.log('Press Ctrl+C to stop the dashboard.');
    console.log('==========================================');
  });
}

if (!fs.existsSync(indexPath)) {
  console.error('Meaninglib search index not found. Run BUILD_MEANINGLIB_SEARCH.bat first.');
  process.exit(1);
}
listen(DEFAULT_PORT);
