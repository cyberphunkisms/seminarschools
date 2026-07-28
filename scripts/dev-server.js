#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const host = option('--host', '127.0.0.1');
const port = Number(option('--port', process.env.PORT || '4173'));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid preview port.');
  process.exit(1);
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.rss': 'application/rss+xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
};

function targetFor(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://preview.local').pathname);
  } catch (_) {
    return null;
  }
  const relative = pathname.replace(/^\/+/, '');
  const requested = path.resolve(ROOT, relative);
  if (requested !== ROOT && !requested.startsWith(ROOT + path.sep)) return null;
  try {
    const stat = fs.statSync(requested);
    if (stat.isDirectory()) return path.join(requested, 'index.html');
    if (stat.isFile()) return requested;
  } catch (_) {
    const cleanIndex = path.join(requested, 'index.html');
    if (fs.existsSync(cleanIndex) && fs.statSync(cleanIndex).isFile()) return cleanIndex;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const target = targetFor(req.url || '/');
  const file = target && fs.existsSync(target) ? target : path.join(ROOT, '404.html');
  const status = target ? 200 : 404;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': type
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).on('error', () => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Preview file error.');
  }).pipe(res);
});

server.on('error', error => {
  console.error(`Preview server failed: ${error.message}`);
  process.exit(1);
});
server.listen(port, host, () => {
  console.log(`Static preview ready on ${host}:${port}`);
});
