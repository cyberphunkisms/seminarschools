'use strict';

const crypto = require('crypto');

const ARTICLE_RE = /<article\b[^>]*>([\s\S]*?)<\/article>/i;
const EXCLUDED_CHROME = [
  /<nav\b[\s\S]*?<\/nav>/gi,
  /<(?:div|aside)\b[^>]*class=["'][^"']*\b(?:colophon|ornament)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
];

function decodeEntities(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
    ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
    ldquo: '“', rdquo: '”', bull: '•', middot: '·', copy: '©', reg: '®',
  };
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(parseInt(number, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function normalizeSpace(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function extractArticle(html) {
  const match = String(html).match(ARTICLE_RE);
  if (!match) throw new Error('Expected exactly one authored <article> body.');
  const remainder = String(html).slice(match.index + match[0].length);
  if (ARTICLE_RE.test(remainder)) throw new Error('Expected exactly one authored <article> body.');
  return match[1];
}

function authoredArticleStream(html) {
  let body = extractArticle(html);
  for (const pattern of EXCLUDED_CHROME) body = body.replace(pattern, ' ');
  body = body
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ');

  const destinations = [];
  body.replace(/<(a|img|audio|video|source)\b[^>]*>/gi, (tag, kind) => {
    const attribute = kind.toLowerCase() === 'a' ? 'href' : 'src';
    const match = tag.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i'));
    if (match) destinations.push(`${kind.toLowerCase()}:${normalizeSpace(match[1])}`);
    return tag;
  });
  const text = normalizeSpace(body.replace(/<[^>]+>/g, ' '));
  return JSON.stringify({ text, destinations });
}

function fingerprintArticle(html) {
  const stream = authoredArticleStream(html);
  const parsed = JSON.parse(stream);
  return {
    sha256: crypto.createHash('sha256').update(stream, 'utf8').digest('hex'),
    textCharacters: parsed.text.length,
    destinationCount: parsed.destinations.length,
  };
}

module.exports = {
  authoredArticleStream,
  decodeEntities,
  extractArticle,
  fingerprintArticle,
  normalizeSpace,
};
