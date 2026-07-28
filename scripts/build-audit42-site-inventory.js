#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = path.join(ROOT, 'data', 'audit42-site-inventory.json');
const CHECK = process.argv.includes('--check');

function walk(directory, accept) {
  const files = [];
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && accept(target)) files.push(target);
    }
  }
  return files.sort();
}

function relative(file) {
  return path.relative(PUBLIC, file).replace(/\\/g, '/');
}

function routeFor(file) {
  const rel = relative(file);
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -10)}`;
  return `/${rel}`;
}

function attribute(source, element, name) {
  const match = source.match(new RegExp(`<${element}\\b[^>]*\\b${name}=[\"']([^\"']+)[\"']`, 'i'));
  return match ? match[1].trim() : '';
}

function alternateLanguages(source) {
  const values = [];
  for (const tag of source.match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel=["'][^"']*\balternate\b[^"']*["']/i.test(tag)) continue;
    const match = tag.match(/\bhreflang=["']([^"']+)["']/i);
    if (match) values.push(match[1].toLowerCase());
  }
  return [...new Set(values)].sort();
}

function languageState(language, alternates) {
  const codes = new Set([language, ...alternates].map(value => value.split('-')[0]).filter(Boolean));
  if (codes.has('en') && codes.has('fr')) return 'bilingual_en_fr';
  if (codes.has('fa')) return 'persian';
  if (codes.has('fr')) return 'french';
  if (codes.has('en')) return 'english_only';
  return language ? 'other_language' : 'undeclared';
}

function htmlRow(file) {
  const source = fs.readFileSync(file, 'utf8');
  const language = attribute(source, 'html', 'lang').toLowerCase();
  const direction = (attribute(source, 'html', 'dir') || 'ltr').toLowerCase();
  const alternates = alternateLanguages(source);
  const title = (source.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    route: routeFor(file),
    file: relative(file),
    language: language || null,
    direction,
    alternate_languages: alternates,
    translation_state: languageState(language, alternates),
    has_title: Boolean(title),
    has_main: /<main\b/i.test(source),
    has_skip_link: /class=["'][^"']*\bskip-link\b/i.test(source),
  };
}

function pdfRow(file) {
  const buffer = fs.readFileSync(file);
  const source = buffer.toString('latin1');
  return {
    file: relative(file),
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    has_structure_tree: /\/StructTreeRoot\b/.test(source),
    has_mark_info: /\/MarkInfo\b/.test(source),
    has_document_language: /\/Lang\s*(?:\(|<)/.test(source),
    has_title_metadata: /\/Title\s*(?:\(|<)/.test(source),
    has_form: /\/AcroForm\b/.test(source),
  };
}

function build() {
  if (!fs.existsSync(PUBLIC)) throw new Error('public deploy surface is missing; run the canonical build first');
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
  const html = walk(
    PUBLIC,
    file => file.endsWith('.html')
      && !/^google[a-z0-9]+\.html$/i.test(relative(file)),
  ).map(htmlRow);
  const pdf = walk(PUBLIC, file => file.endsWith('.pdf')).map(pdfRow);
  const uniquePdf = new Map(pdf.map(row => [row.sha256, row]));
  const translationStates = {};
  for (const row of html) {
    translationStates[row.translation_state] = (translationStates[row.translation_state] || 0) + 1;
  }
  return {
    schema: 'seminar-schools-audit42-site-inventory-v1',
    release_id: release.release_id,
    generated_at: release.generated_at,
    summary: {
      html_routes: html.length,
      declared_language_routes: html.filter(row => row.language).length,
      rtl_routes: html.filter(row => row.direction === 'rtl').length,
      routes_with_alternates: html.filter(row => row.alternate_languages.length).length,
      translation_states: translationStates,
      pdf_paths: pdf.length,
      unique_pdfs: uniquePdf.size,
      pdf_paths_with_structure_tree: pdf.filter(row => row.has_structure_tree).length,
      pdf_paths_with_document_language: pdf.filter(row => row.has_document_language).length,
      pdf_paths_with_title_metadata: pdf.filter(row => row.has_title_metadata).length,
    },
    limitations: [
      'Search-engine ownership token files are deployment artifacts, not HTML routes, and are excluded from the route inventory.',
      'Translation state records declared route metadata and alternates, not editorial equivalence.',
      'PDF token inspection inventories structure metadata; manual reading order and native assistive-technology behavior require external sign-off.',
    ],
    html_routes: html,
    pdf_paths: pdf,
  };
}

const document = build();
const serialized = `${JSON.stringify(document, null, 2)}\n`;
if (CHECK) {
  let current = '';
  try {
    current = fs.readFileSync(OUTPUT, 'utf8');
  } catch (_) {
    // Reported below as a stale or missing inventory.
  }
  if (current !== serialized) {
    console.error('AUDIT 42 SITE INVENTORY FAILED — run node scripts/build-audit42-site-inventory.js after the canonical build.');
    process.exit(1);
  }
  console.log(
    `AUDIT 42 SITE INVENTORY PASSED — ${document.summary.html_routes} HTML routes and `
      + `${document.summary.pdf_paths} PDF paths are truthfully classified.`,
  );
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  console.log(
    `AUDIT 42 SITE INVENTORY WRITTEN — ${document.summary.html_routes} HTML routes, `
      + `${document.summary.pdf_paths} PDF paths.`,
  );
}
