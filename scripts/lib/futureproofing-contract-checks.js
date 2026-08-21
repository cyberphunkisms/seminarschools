'use strict';

const crypto = require('crypto');
const path = require('path');
const {
  assertGeometryVersionScheme,
  geometryAssetVersion,
} = require('./geometry-asset-version');

const ROOT = path.resolve(__dirname, '..', '..');
const GEOMETRY_CONTRACTS = require(path.join(ROOT, 'data', 'geometry-route-contracts.json'));
assertGeometryVersionScheme(GEOMETRY_CONTRACTS);
const GEOMETRY_VERSION = geometryAssetVersion(ROOT);
const INTERNAL_COPY = [
  'AI explaining to AI',
  'Selected evidence',
  'How the work was done',
  'operator-to-AI instruction',
  'Live build target',
];

function bodyTag(html) {
  return (String(html).match(/<body\b[^>]*>/i) || [''])[0];
}

function visibleText(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function assetCount(html, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(html).match(new RegExp(`<[^>]+${escaped}[^>]*>`, 'ig')) || []).length;
}

function geometryDocumentDefects(html) {
  const failures = [];
  const source = String(html);
  const body = bodyTag(source);
  if (!body) failures.push('geometry-body-missing');
  for (const asset of ['/css/alive.css', '/js/mandala.js', '/js/indra.js']) {
    const count = assetCount(source, asset);
    if (count !== 1) failures.push(`geometry-asset-count:${asset}:${count}`);
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`${escaped}\\?v=${GEOMETRY_VERSION}(?:["'])`, 'i').test(source)) {
      failures.push(`geometry-asset-version:${asset}`);
    }
  }
  for (const [name, value] of [
    ['data-geometry', 'indra-web'],
    ['data-front-facing', 'general-audience'],
  ]) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\b${name}=["']${escaped}["']`, 'i').test(body)) {
      failures.push(`geometry-body-marker:${name}`);
    }
  }
  for (const name of ['data-route-type', 'data-geometry-role', 'data-indra-intensity']) {
    if (!new RegExp(`\\b${name}=["'][^"']+["']`, 'i').test(body)) {
      failures.push(`geometry-body-marker:${name}`);
    }
  }
  const mandala = source.search(/<script\b[^>]*\/js\/mandala\.js/i);
  const indra = source.search(/<script\b[^>]*\/js\/indra\.js/i);
  if (!(mandala >= 0 && indra > mandala)) failures.push('geometry-script-order');
  return failures;
}

function frontFacingDocumentDefects(html) {
  const failures = [];
  const body = bodyTag(html);
  if (!/\bdata-front-facing=["']general-audience["']/i.test(body)) {
    failures.push('front-facing-marker');
  }
  const text = visibleText(html);
  for (const phrase of INTERNAL_COPY) {
    if (text.includes(phrase)) failures.push(`front-facing-internal-copy:${phrase}`);
  }
  return failures;
}

function wrappingDocumentDefects(html) {
  const links = String(html).match(
    /<link\b[^>]*\bhref=["']\/css\/site-wide-type-zoom\.css(?:\?[^"']*)?["'][^>]*>/gi,
  ) || [];
  return links.length === 1 ? [] : [`wrapping-stylesheet-count:${links.length}`];
}

function wrappingStylesheetDefects(css) {
  const source = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const failures = [];
  if (/word-break\s*:\s*break-all\b/i.test(source)) {
    failures.push('wrapping-natural-word-break');
  }
  if (/overflow-wrap\s*:\s*anywhere\b/i.test(source) && !/data-allow-word-break|\.url|\.slug|\bcode\b|\bpre\b/i.test(source)) {
    failures.push('wrapping-anywhere-without-technical-scope');
  }
  return failures;
}

function sourceFirstPairDefects(pairs) {
  const failures = [];
  for (const [index, pair] of (pairs || []).entries()) {
    const primary = String(pair && pair.primaryHref || '');
    const detail = String(pair && pair.detailHref || '');
    if (!/^https?:\/\//i.test(primary) && !/^\/(?:aitr|aa)\/#/i.test(primary) && pair.allowInternalPrimary !== true) {
      failures.push(`source-link-primary:${index}`);
    }
    if (!/^\/(?!\/).+/.test(detail)) failures.push(`source-link-detail:${index}`);
    if (primary === detail) failures.push(`source-link-not-distinct:${index}`);
  }
  return failures;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function preservationDefects(entries, readBytes) {
  const failures = [];
  for (const row of entries || []) {
    const rel = String(row && row.path || '');
    let bytes;
    try { bytes = readBytes(rel); }
    catch (_) { failures.push(`preservation-missing:${rel}`); continue; }
    if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
    if (Number(row.bytes) !== bytes.length) failures.push(`preservation-size:${rel}`);
    if (String(row.sha256 || '') !== sha256(bytes)) failures.push(`preservation-sha256:${rel}`);
  }
  return failures;
}

module.exports = {
  GEOMETRY_VERSION,
  frontFacingDocumentDefects,
  geometryDocumentDefects,
  preservationDefects,
  sha256,
  sourceFirstPairDefects,
  visibleText,
  wrappingDocumentDefects,
  wrappingStylesheetDefects,
};
