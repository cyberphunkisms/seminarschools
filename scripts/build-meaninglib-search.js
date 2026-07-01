#!/usr/bin/env node
/*
  Build local Meaninglib retrieval index.
  Pure Node.js: no external model, no network, no secrets.
  This is Phase 2 search: a deterministic retrieval guard over the exported Meaninglib substrate.
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const exportDir = path.join(root, 'hf_export');
const dataDir = path.join(exportDir, 'data');
const reportsDir = path.join(exportDir, 'reports');
const searchDir = path.join(exportDir, 'search');
const indexPath = path.join(searchDir, 'meaninglib_search_index.json');
const reportPath = path.join(reportsDir, 'search_report.md');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, predicate, acc);
    else if (!predicate || predicate(full)) acc.push(full);
  }
  return acc;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\bml\*/gi, ' mlstar ml methodologylist ')
    .replace(/\bbb\*/gi, ' bbstar bb bookwormburrows ')
    .replace(/\bmc\*/gi, ' mcstar mc modulecanon ')
    .replace(/\bcc\*/gi, ' ccstar cc campaigncodex ')
    .replace(/\bcore\*/gi, ' corestar core coreplus ')
    .replace(/\baa\*/gi, ' aastar aa archetype archive ')
    .replace(/\baitr\*/gi, ' aitrstar aitr ai teacher resources ')
    .replace(/anti[-\s]?twist/gi, ' antitwist anti twist ')
    .replace(/source[-\s]?of[-\s]?truth/gi, ' sourceoftruth source truth ')
    .replace(/star[-\s]?file/gi, ' starfile star file ')
    .replace(/txt\s*\/?\s*html|html\s*\/?\s*txt/gi, ' txt html text mirror dual write sync canonical published working file ')
    .replace(/text[-\s]?mirror/gi, ' text mirror txt html sync ')
    .replace(/dual[-\s]?write/gi, ' dual write txt html sync ')
    .toLowerCase();
}

const STOP = new Set([
  'the','a','an','and','or','but','if','then','else','of','to','in','on','for','with','by','as','is','are','was','were','be','being','been','this','that','these','those','it','its','into','from','at','about','not','no','yes','do','does','did','can','could','should','would','will','may','might','must','than','when','where','what','which','who','whom','whose','how','why','you','your','we','our','they','their','them','he','she','his','her','i','me','my','ours','also','all','any','each','one','two','three','first','second','third','via','per','within','without','over','under','up','down','out','more','less','same','other','new','old','entry','title','body','id','role','link','links','source','json','jsonl','index','file','files','route','routes','rule','rules','https','http','www','com'
]);

function tokenize(text) {
  const normalized = normalizeText(text);
  const raw = normalized.match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [];
  return raw.filter(t => t.length > 1 && !STOP.has(t));
}

function textFromObject(obj) {
  const chunks = [];
  const fields = [
    'id','title','name','body','function','section','star_file','record_type','route','source_txt','source_html','mother_category','relation_model','canonical_status'
  ];
  for (const f of fields) {
    if (obj[f]) chunks.push(String(obj[f]));
  }
  if (Array.isArray(obj.tags)) chunks.push(obj.tags.join(' '));
  else if (obj.tags) chunks.push(String(obj.tags));
  if (Array.isArray(obj.crossrefs)) chunks.push(obj.crossrefs.join(' '));
  else if (obj.crossrefs) chunks.push(String(obj.crossrefs));
  if (obj.embedding_text) chunks.push(String(obj.embedding_text));
  return chunks.join('\n');
}

function inferStarFromPath(file) {
  const r = rel(file);
  if (r.includes('/data/ml/')) return 'ml';
  if (r.includes('/data/bb/')) return 'bb';
  if (r.includes('/data/mc/')) return 'mc';
  if (r.includes('/data/cc/')) return 'cc';
  if (r.includes('/data/aa/')) return 'aa';
  if (r.includes('/data/aitr/')) return 'aitr';
  if (r.includes('/data/manifest/')) return 'manifest';
  if (r.includes('/data/relations/')) return 'relations';
  if (r.includes('/reports/')) return 'report';
  if (r.endsWith('README.md')) return 'readme';
  return 'unknown';
}

function buildDocFromObject(obj, file, lineNo) {
  const star = obj.star_file || inferStarFromPath(file);
  const id = obj.id || `${rel(file)}:${lineNo}`;
  const title = obj.title || obj.name || obj.function || id;
  const text = textFromObject(obj);
  const tokens = tokenize(text);
  const termFreq = {};
  for (const t of tokens) termFreq[t] = (termFreq[t] || 0) + 1;
  return {
    id,
    title: String(title || id),
    star_file: star,
    section: obj.section || obj.record_type || null,
    source_path: rel(file),
    route: obj.route || obj.source_txt || obj.source_html || '',
    tags: obj.tags || [],
    term_count: tokens.length,
    termFreq,
    preview: String(obj.body || obj.function || obj.relation_model || text).replace(/\s+/g, ' ').slice(0, 600)
  };
}

function buildDocFromMarkdown(file) {
  const text = fs.readFileSync(file, 'utf8');
  const titleLine = text.split(/\r?\n/).find(l => l.trim().startsWith('#')) || path.basename(file);
  const title = titleLine.replace(/^#+\s*/, '').trim() || path.basename(file);
  const tokens = tokenize(`${title}\n${text}`);
  const termFreq = {};
  for (const t of tokens) termFreq[t] = (termFreq[t] || 0) + 1;
  return {
    id: `file:${rel(file)}`,
    title,
    star_file: inferStarFromPath(file),
    section: file.includes('/reports/') ? 'report' : 'readme',
    source_path: rel(file),
    route: '',
    tags: [],
    term_count: tokens.length,
    termFreq,
    preview: text.replace(/\s+/g, ' ').slice(0, 600)
  };
}

function main() {
  if (!fs.existsSync(exportDir)) fail('hf_export/ not found. Run EXPORT_MEANINGLIB_DATASET.bat first.');
  if (!fs.existsSync(dataDir)) fail('hf_export/data/ not found. Run EXPORT_MEANINGLIB_DATASET.bat first.');
  ensureDir(searchDir);
  ensureDir(reportsDir);

  const docs = [];
  const preferredAllRows = path.join(dataDir, 'all_meaninglib_rows.jsonl');
  // In the full website zip, hf_export/data/ contains both the canonical aggregated
  // Meaninglib export and split convenience views. Index the aggregate first to avoid
  // duplicate retrieval rows while still letting the split files exist for humans/tools.
  const jsonlFiles = fs.existsSync(preferredAllRows)
    ? [preferredAllRows]
    : walk(dataDir, f => f.endsWith('.jsonl'));
  for (const file of jsonlFiles) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    lines.forEach((line, idx) => {
      try {
        const obj = JSON.parse(line);
        docs.push(buildDocFromObject(obj, file, idx + 1));
      } catch (err) {
        fail(`Invalid JSONL in ${rel(file)} line ${idx + 1}: ${err.message}`);
      }
    });
  }

  // Default retrieval index excludes generated reports so user queries retrieve substrate rows, not logs.
  // README stays indexed because it carries the Hugging Face dataset card and ontology lock.
  const mdFiles = [path.join(exportDir, 'README.md')].filter(f => fs.existsSync(f));
  for (const file of mdFiles) docs.push(buildDocFromMarkdown(file));

  if (docs.length < 1900) fail(`too few Meaninglib search docs: ${docs.length}`);

  const df = {};
  for (const doc of docs) {
    for (const term of Object.keys(doc.termFreq)) df[term] = (df[term] || 0) + 1;
  }
  const totalDocs = docs.length;
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log(1 + (totalDocs + 1) / (count + 1));
  }

  const index = {
    generated_at: new Date().toISOString(),
    version: 'meaninglib-search-v1-lexical-star-aware',
    total_docs: totalDocs,
    total_terms: Object.keys(df).length,
    ontology_lock: 'Meaninglib is the mother-category; ml*, bb*, mc*, cc*, core*, aa*, aitr*, and related routes are interdependent access routes with local functions.',
    docs,
    idf
  };

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

  const starCounts = docs.reduce((acc, d) => {
    acc[d.star_file] = (acc[d.star_file] || 0) + 1;
    return acc;
  }, {});

  const report = [
    '# Meaninglib search build report',
    '',
    `Generated: ${index.generated_at}`,
    '',
    `Index: ${rel(indexPath)}`,
    `Documents: ${totalDocs}`,
    `Terms: ${Object.keys(df).length}`,
    '',
    '## Star-file document counts',
    '',
    ...Object.entries(starCounts).sort().map(([k,v]) => `- ${k}: ${v}`),
    '',
    '## Ontology lock',
    '',
    index.ontology_lock,
    '',
    '## Search mode',
    '',
    'Phase 2 uses deterministic local lexical/star-aware retrieval. It does not call external APIs, upload secrets, or train a model.',
    'Generated reports are excluded from the default retrieval index so searches return Meaninglib substrate rows rather than build logs.',
    ''
  ].join('\n');
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log(`Meaninglib search index built: ${rel(indexPath)}`);
  console.log(`Docs: ${totalDocs}`);
  console.log(`Report: ${rel(reportPath)}`);
}

main();
