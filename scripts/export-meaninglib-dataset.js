#!/usr/bin/env node
/*
  Export Meaninglib as a Hugging Face-ready private dataset mirror.

  This script preserves the existing star-file ontology:
  - Meaninglib is the mother-category for interdependent star-file routes.
  - ml*, bb*, mc*, cc*, core*, aa*, and related routes keep local function.
  - Hugging Face is a mirror/search/test layer, not the source of truth.
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'hf_export');
const DATA = path.join(OUT, 'data');
const REPORTS = path.join(OUT, 'reports');
const SCHEMAS = path.join(OUT, 'schemas');
const EVAL = path.join(OUT, 'eval');
const now = new Date().toISOString();

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function cleanDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
}
function hash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function sanitizeForHfExport(text) {
  return String(text || '')
    // Keep Meaninglib searchable while preventing private contact strings from leaving the local source tree.
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
}
function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
}
function jsonLine(obj) {
  return JSON.stringify(obj) + '\n';
}
function writeJsonl(rel, rows) {
  const outPath = path.join(OUT, rel);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, rows.map(jsonLine).join(''), 'utf8');
}
function writeText(rel, text) {
  const outPath = path.join(OUT, rel);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, text, 'utf8');
}
function routeForSource(rel) {
  if (rel.startsWith('polymyth/')) return `https://seminarschools.com/${rel}`;
  if (rel === 'polymyth-file-map.txt') return 'https://seminarschools.com/polymyth-file-map.txt';
  return '';
}
function rowBase({ id, star_file, title, body, section, source_txt, source_html = '', canonical_status = 'derived_txt', route = '', tags = [], crossrefs = [], record_type = 'entry' }) {
  const originalBody = String(body || '').trim();
  const cleanBody = sanitizeForHfExport(originalBody);
  return {
    id,
    star_file,
    title: String(title || id || '').trim(),
    body: cleanBody,
    section: String(section || '').trim(),
    source_html,
    source_txt,
    canonical_status,
    route: route || routeForSource(source_txt || source_html || ''),
    tags,
    crossrefs,
    record_type,
    source_hash: hash(originalBody),
    exported_at: now,
    embedding_text: [star_file, section, title, cleanBody].filter(Boolean).join('\n\n').slice(0, 120000)
  };
}
function extractCrossrefs(text) {
  const refs = new Set();
  const re = /\b(ml|bb|mc|cc|aa|core|aitr|cx)\*/gi;
  let m;
  while ((m = re.exec(text))) refs.add(m[0].toLowerCase());
  return [...refs].sort();
}
function firstNonemptyLine(text) {
  return text.split(/\r?\n/).map(x => x.trim()).find(Boolean) || '';
}

function parseMlSection(sectionKey, rel) {
  const text = read(rel);
  const rows = [];
  const chunks = [];
  const lines = text.split(/\r?\n/);
  let current = [];
  const startRe = /^\[[^\]]+\]\s+.+/;
  for (const line of lines) {
    if (startRe.test(line) && current.length) {
      chunks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.join('').trim()) chunks.push(current.join('\n').trim());

  let i = 0;
  for (const chunk of chunks) {
    const first = firstNonemptyLine(chunk);
    const tagMatch = first.match(/^\[([^\]]+)\]\s+(.+)$/);
    const title = tagMatch ? tagMatch[2].trim() : first.replace(/^#+\s*/, '').trim();
    const localTags = tagMatch ? tagMatch[1].split(/[,/ ]+/).filter(Boolean) : [];
    if (!title || /^#|^===|^Polymyth Methodologylist/.test(title)) continue;
    i += 1;
    rows.push(rowBase({
      id: `ml:${sectionKey}:${String(i).padStart(4, '0')}:${slugify(title)}`,
      star_file: 'ml',
      title,
      body: chunk,
      section: sectionKey,
      source_txt: rel,
      source_html: `polymyth/methodologylist/${sectionKey}/index.html`,
      canonical_status: 'derived_txt',
      tags: ['ml', sectionKey, ...localTags],
      crossrefs: extractCrossrefs(chunk)
    }));
  }
  return rows;
}

function parseSeparatorFile({ star, sectionFallback, rel, htmlRel }) {
  const text = read(rel);
  const rows = [];
  const parts = text.split(/\n-{40,}\n/g).map(s => s.trim()).filter(Boolean);
  let i = 0;
  for (const part of parts) {
    const first = firstNonemptyLine(part);
    if (/^=+|^#+|^TOTAL ENTRIES|^FRAMEWORK MAP|^AI INSTRUCTION/i.test(first)) continue;
    let id = (part.match(/^ID:\s*(.+)$/m) || [])[1]?.trim();
    if (id && /^(undefined|null|none|n\/?a)$/i.test(id)) id = '';
    const title =
      (part.match(/^STUDENT TITLE:\s*(.+)$/m) || [])[1]?.trim() ||
      (part.match(/^ORIGINAL TITLE:\s*(.+)$/m) || [])[1]?.trim() ||
      (part.match(/^TITLE:\s*(.+)$/m) || [])[1]?.trim() ||
      first.replace(/^#+\s*/, '').trim();
    if (!title) continue;
    const section = (part.match(/^SECTION:\s*(.+)$/m) || [])[1]?.trim()?.toLowerCase() || sectionFallback;
    i += 1;
    rows.push(rowBase({
      id: `${star}:${id ? slugify(id) : `${String(i).padStart(4, '0')}:${slugify(title)}`}`,
      star_file: star,
      title,
      body: part,
      section,
      source_txt: rel,
      source_html: htmlRel,
      canonical_status: 'derived_txt',
      tags: [star, section],
      crossrefs: extractCrossrefs(part)
    }));
  }
  return rows;
}

function parseWholeDocument({ star, rel, htmlRel = '', title, section = 'document', status = 'derived_txt' }) {
  const text = read(rel);
  return [rowBase({
    id: `${star}:${slugify(title || path.basename(rel))}:full`,
    star_file: star,
    title: title || firstNonemptyLine(text),
    body: text,
    section,
    source_txt: rel,
    source_html: htmlRel,
    canonical_status: status,
    tags: [star, section, 'full-document'],
    crossrefs: extractCrossrefs(text),
    record_type: 'full_document'
  })];
}

function parseHtmlRoute({ star, rel, title, section = 'route' }) {
  if (!exists(rel)) return [];
  const html = read(rel);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return [rowBase({
    id: `${star}:${slugify(title || rel)}:html-route`,
    star_file: star,
    title: title || rel,
    body: text,
    section,
    source_txt: '',
    source_html: rel,
    canonical_status: 'html_route_view',
    route: `https://seminarschools.com/${rel.replace(/\/index\.html$/, '/')}`,
    tags: [star, section, 'html-route'],
    crossrefs: extractCrossrefs(text),
    record_type: 'route_view'
  })];
}

function buildStarFileMap() {
  const files = [
    { star_file: 'ml', name: 'methodologylist', function: 'first-load AI scanner, methodology, citation discipline, anti-TWIST, writing rules, core/coreplus mirrors', source_txt: 'polymyth/methodologylist.txt', source_html: 'polymyth/methodologylist/index.html' },
    { star_file: 'bb', name: 'bookwormburrows', function: 'dimensional pedagogy game operations substrate', source_txt: 'polymyth/bookwormburrows.txt', source_html: 'polymyth/bookwormburrows/index.html' },
    { star_file: 'mc', name: 'modulecanon', function: 'delivery-agnostic curriculum module substrate', source_txt: 'polymyth/modulecanon.txt', source_html: 'polymyth/modulecanon/index.html' },
    { star_file: 'cc', name: 'campaigncodex', function: 'campaign-level curriculum and game content substrate', source_txt: 'polymyth/campaigncodex.txt', source_html: 'polymyth/campaigncodex/index.html' },
    { star_file: 'aa', name: 'archetype archive', function: 'archetype/archive access route when available', source_txt: '', source_html: 'aa/index.html' },
    { star_file: 'aitr', name: 'AI teacher resources route', function: 'AI/teacher-resource access route when available', source_txt: '', source_html: 'aitr/index.html' },
    { star_file: 'core', name: 'core/coreplus', function: 'memory-tier behavioral discipline mirrored inside ml*', source_txt: 'polymyth/methodologylist-coreplus.txt', source_html: 'polymyth/methodologylist/coreplus/index.html' }
  ];
  return files.filter(f => (f.source_txt && exists(f.source_txt)) || (f.source_html && exists(f.source_html))).map(f => ({
    ...f,
    mother_category: 'Meaninglib',
    relation_model: 'interdependent access route with local function',
    route: routeForSource(f.source_txt || f.source_html),
    exported_at: now
  }));
}

function buildCrossrefs(allRows) {
  const out = [];
  for (const row of allRows) {
    for (const ref of row.crossrefs || []) {
      out.push({ from_id: row.id, from_star_file: row.star_file, to_star_file: ref.replace('*', ''), relation: 'textual_crossref', source_txt: row.source_txt, source_html: row.source_html, exported_at: now });
    }
  }
  return out;
}

function main() {
  cleanDir(OUT);
  ensureDir(DATA); ensureDir(REPORTS); ensureDir(SCHEMAS); ensureDir(EVAL);

  const allRows = [];
  const mlRows = [];

  const mlFull = parseWholeDocument({ star: 'ml', rel: 'polymyth/methodologylist.txt', htmlRel: 'polymyth/methodologylist/index.html', title: 'methodologylist full text mirror', section: 'full' });
  mlRows.push(...mlFull);

  const sectionFiles = fs.readdirSync(path.join(ROOT, 'polymyth'))
    .filter(name => /^methodologylist-.+\.txt$/.test(name))
    .sort();
  for (const name of sectionFiles) {
    const sectionKey = name.replace(/^methodologylist-/, '').replace(/\.txt$/, '');
    const rows = parseMlSection(sectionKey, `polymyth/${name}`);
    mlRows.push(...rows);
    writeJsonl(`data/ml/sections/${sectionKey}.jsonl`, rows);
  }
  writeJsonl('data/ml/methodologylist.jsonl', mlRows);
  allRows.push(...mlRows);

  const bbRows = parseSeparatorFile({ star: 'bb', sectionFallback: 'bookwormburrows', rel: 'polymyth/bookwormburrows.txt', htmlRel: 'polymyth/bookwormburrows/index.html' });
  writeJsonl('data/bb/bookwormburrows.jsonl', bbRows);
  allRows.push(...bbRows);

  const mcRows = parseSeparatorFile({ star: 'mc', sectionFallback: 'modulecanon', rel: 'polymyth/modulecanon.txt', htmlRel: 'polymyth/modulecanon/index.html' });
  writeJsonl('data/mc/modulecanon.jsonl', mcRows);
  allRows.push(...mcRows);

  const ccRows = parseSeparatorFile({ star: 'cc', sectionFallback: 'campaigncodex', rel: 'polymyth/campaigncodex.txt', htmlRel: 'polymyth/campaigncodex/index.html' });
  writeJsonl('data/cc/campaigncodex.jsonl', ccRows);
  allRows.push(...ccRows);

  if (exists('polymyth/manifest.txt')) {
    const manifestRows = parseWholeDocument({ star: 'manifest', rel: 'polymyth/manifest.txt', title: 'methodologylist section manifest', section: 'manifest' });
    writeJsonl('data/manifest/manifest.jsonl', manifestRows);
    allRows.push(...manifestRows);
  }
  if (exists('polymyth-file-map.txt')) {
    const mapRows = parseWholeDocument({ star: 'manifest', rel: 'polymyth-file-map.txt', title: 'polymyth file map', section: 'file-map' });
    writeJsonl('data/manifest/polymyth-file-map.jsonl', mapRows);
    allRows.push(...mapRows);
  }

  const aaRows = parseHtmlRoute({ star: 'aa', rel: 'aa/index.html', title: 'archetype archive route' });
  if (aaRows.length) { writeJsonl('data/aa/archetype_archive_route.jsonl', aaRows); allRows.push(...aaRows); }
  const aitrRows = parseHtmlRoute({ star: 'aitr', rel: 'aitr/index.html', title: 'AI teacher resources route' });
  if (aitrRows.length) { writeJsonl('data/aitr/ai_teacher_resources_route.jsonl', aitrRows); allRows.push(...aitrRows); }

  writeJsonl('data/all_meaninglib_rows.jsonl', allRows);
  writeJsonl('data/relations/crossrefs.jsonl', buildCrossrefs(allRows));
  writeJsonl('data/relations/star_file_map.jsonl', buildStarFileMap());

  writeText('schemas/meaninglib_entry.schema.json', JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Meaninglib export row',
    type: 'object',
    required: ['id', 'star_file', 'title', 'body', 'section', 'canonical_status', 'source_hash', 'exported_at', 'embedding_text'],
    properties: {
      id: { type: 'string' },
      star_file: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
      section: { type: 'string' },
      source_html: { type: 'string' },
      source_txt: { type: 'string' },
      canonical_status: { type: 'string' },
      route: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      crossrefs: { type: 'array', items: { type: 'string' } },
      record_type: { type: 'string' },
      source_hash: { type: 'string' },
      exported_at: { type: 'string' },
      embedding_text: { type: 'string' }
    }
  }, null, 2));

  writeText('eval/retrieval_golden.jsonl', [
    { query: 'Meaninglib mother category star files', expected_star_files: ['ml'], expected_terms: ['Meaninglib', 'access routes'] },
    { query: 'interdependence bb mc cc incomplete substrate', expected_star_files: ['bb', 'mc', 'cc'], expected_terms: ['incomplete substrate', 'cross-references'] },
    { query: 'stop psychologism operator-facing diagnosis', expected_star_files: ['ml'], expected_terms: ['psychologism'] },
    { query: 'AI prose tells law review smoothness failure', expected_star_files: ['ml'], expected_terms: ['law review', 'smoothness failure'] }
  ].map(jsonLine).join(''));

  const counts = allRows.reduce((acc, row) => { acc[row.star_file] = (acc[row.star_file] || 0) + 1; return acc; }, {});
  const report = `# Meaninglib Hugging Face export report\n\nExported: ${now}\n\nTarget repo: SeminarSchools/meaninglib\n\n## Counts\n\n${Object.entries(counts).sort().map(([k,v]) => `- ${k}: ${v}`).join('\n')}\n\nTotal rows: ${allRows.length}\n\n## Ontology lock\n\nMeaninglib is the mother-category. ml*, bb*, mc*, cc*, core*, aa*, aitr*, and related routes are interdependent access routes with local functions. Hugging Face mirrors this structure and does not rename, flatten, or govern it.\n`;
  writeText('reports/latest_export_report.md', report);

  const readme = `---\npretty_name: Meaninglib\nprivate: true\ntags:\n- meaninglib\n- polymyth\n- methodologylist\n- seminar-schools\n---\n\n# Meaninglib\n\nPrivate working mirror for the Seminar Schools Meaninglib star-file substrate.\n\n## Source of truth\n\nThe Seminar Schools site/archive remains the source of truth. This Hugging Face dataset is a mirror, search surface, dashboard substrate, and verification layer.\n\n## Ontology\n\nMeaninglib is the mother-category for interdependent star-file access routes. ml*, bb*, mc*, cc*, core*, aa*, aitr*, and related routes keep local function and cross-reference one another. The export preserves this relation instead of treating ml* as a ruler over the others.\n\n## Included first-pass routes\n\n- ml* methodologylist\n- bb* bookwormburrows\n- mc* modulecanon\n- cc* campaigncodex\n- core/coreplus mirrors inside ml*\n- manifest and file-map views\n- available aa*/aitr* route views\n\n## AI Access Pack\n\nGenerate task-specific AI handoff files after export with \`npm run build:ai-access-pack\`.\n\nCurrent handoff files live at:\n\n- \`hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md\`\n- \`hf_export/ai_access_pack/latest_access_pack.md\`\n- \`hf_export/ai_access_pack/latest_access_pack.json\`\n\nFor another AI, paste \`MEPHISTODATA_ACTIVATION.md\` first, then paste or retrieve a task-specific \`latest_access_pack.md\`. If this dataset remains private, external AIs need pasted text or authorized access. Public browser access requires the Hugging Face repository or a curated companion Space to be public or protected.\n\n## Privacy stance\n\nPrivate first. Public curated views can be created later after ontology, privacy, and verification checks pass.\n\n## Generated by\n\n\`npm run export:meaninglib-dataset\`\n`;
  writeText('README.md', readme);

  console.log(`Meaninglib export complete: ${allRows.length} rows`);
  console.log(`Report: ${path.relative(ROOT, path.join(REPORTS, 'latest_export_report.md'))}`);
}

try {
  main();
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}
