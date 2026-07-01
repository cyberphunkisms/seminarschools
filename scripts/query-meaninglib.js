#!/usr/bin/env node
/* Query local Meaninglib search index. Pure Node.js, no network. */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const root = process.cwd();
const indexPath = path.join(root, 'hf_export', 'search', 'meaninglib_search_index.json');
const reportsDir = path.join(root, 'hf_export', 'reports');
const lastReportPath = path.join(reportsDir, 'last_meaninglib_query.md');

const STOP = new Set([
  'the','a','an','and','or','but','if','then','else','of','to','in','on','for','with','by','as','is','are','was','were','be','being','been','this','that','these','those','it','its','into','from','at','about','not','no','yes','do','does','did','can','could','should','would','will','may','might','must','than','when','where','what','which','who','whom','whose','how','why','you','your','we','our','they','their','them','he','she','his','her','i','me','my','ours','also','all','any','each','one','two','three','first','second','third','via','per','within','without','over','under','up','down','out','more','less','same','other','new','old','entry','title','body','id','role','link','links','source','json','jsonl','index','file','files','route','routes','rule','rules','https','http','www','com'
]);

function cleanQuery(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[\\`]+/g, ' ')
    .replace(/^['"\s]+|['"\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return cleanQuery(value)
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
    .replace(/interdependen(?:t|ce)/gi, ' interdependence interdependent meaninglib mother category starfile access route crossref crossrefs relation relations ontology ')
    .replace(/\b(governs?|governed|governing|ruler|ruled|hierarchy|hierarchical)\b/gi, ' hierarchy interdependence meaninglib access route ontology rejected ruler ')
    .toLowerCase();
}

function tokenize(text) {
  const normalized = normalizeText(text);
  const raw = normalized.match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [];
  return raw.filter(t => t.length > 1 && !STOP.has(t));
}

function loadIndex() {
  if (!fs.existsSync(indexPath)) {
    console.error('Meaninglib search index not found. Run BUILD_MEANINGLIB_SEARCH.bat first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

function inferStarHints(query) {
  const q = normalizeText(query);
  const hints = new Set();
  if (/\b(bb|bbstar|bookwormburrows|bookworm|setupnpc|setupnpcs|improvnpc|improvnpcs|wormcard|wormcards|dimensional master)\b/.test(q)) hints.add('bb');
  if (/\b(mc|mcstar|modulecanon|module canon|curriculum module|delivery agnostic)\b/.test(q)) hints.add('mc');
  if (/\b(cc|ccstar|campaigncodex|campaign codex|campaign level)\b/.test(q)) hints.add('cc');
  if (/\b(ml|mlstar|methodologylist|anti twist|antitwist|gorgonification|degorgonification|psychologism|mephistodata|ouroboros|citation discipline|ai prose|law review|dual write|txt html|html txt|text mirror)\b/.test(q)) hints.add('ml');
  if (/\b(core|corestar|coreplus|core\+)\b/.test(q)) hints.add('core');
  if (/\b(meaninglib|interdependence|mother category|starfile|star file|ontology|hierarchy)\b/.test(q)) {
    hints.add('readme'); hints.add('relations');
  }
  return hints;
}

function exactRouteAlias(query) {
  const q = normalizeText(query).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (q === 'bookwormburrows' || q === 'bb' || q === 'bbstar') return { star: 'bb', name: 'bookwormburrows' };
  if (q === 'modulecanon' || q === 'module canon' || q === 'mc' || q === 'mcstar') return { star: 'mc', name: 'modulecanon' };
  if (q === 'campaigncodex' || q === 'campaign codex' || q === 'cc' || q === 'ccstar') return { star: 'cc', name: 'campaigncodex' };
  if (q === 'methodologylist' || q === 'ml' || q === 'mlstar') return { star: 'ml', name: 'methodologylist' };
  return null;
}

function isReportDoc(doc) {
  return doc.star_file === 'report' || String(doc.source_path || '').includes('/reports/');
}

function scoreDoc(doc, tokens, query, idf) {
  const hints = inferStarHints(query);
  const alias = exactRouteAlias(query);
  let score = 0;
  const qnorm = normalizeText(query);
  const titleNorm = normalizeText(doc.title || '');
  const previewNorm = normalizeText(doc.preview || '');
  const sourceNorm = normalizeText(doc.source_path || '');

  // Default user queries should retrieve substrate rows, not generated reports.
  if (isReportDoc(doc) && !qnorm.includes('report')) score -= 250;

  if (hints.has(doc.star_file)) score += 10;

  if (alias) {
    const isStarMapRow = doc.star_file === alias.star && String(doc.source_path || '').includes('star_file_map');
    const isNativeStar = doc.star_file === alias.star;
    const mentionsName = titleNorm.includes(alias.name) || previewNorm.includes(alias.name) || sourceNorm.includes(alias.name);
    if (isStarMapRow && mentionsName) score += 140;
    else if (isNativeStar && mentionsName) score += 75;
    else if (isNativeStar) score += 35;
  }

  const ontologyQuery = qnorm.includes('interdepend') || qnorm.includes('meaninglib') || qnorm.includes('ontology') || qnorm.includes('mother category') || qnorm.includes('starfile') || qnorm.includes('hierarchy') || qnorm.includes('govern');
  const ontologyDoc = ['readme','relations'].includes(doc.star_file) || String(doc.source_path || '').includes('/relations/');
  const interdependenceDoc = titleNorm.includes('interdepend') || previewNorm.includes('interdepend') || previewNorm.includes('mother category') || previewNorm.includes('mother-category') || previewNorm.includes('access route') || String(doc.source_path || '').includes('star_file_map');

  if (ontologyQuery && ontologyDoc) score += 40;
  if (ontologyQuery && interdependenceDoc) score += 50;
  if (doc.star_file === 'relations' && String(doc.source_path || '').includes('star_file_map')) score += 40;
  if (doc.star_file === 'readme' && qnorm.includes('meaninglib')) score += 35;
  if ((qnorm.includes('hierarchy') || qnorm.includes('govern')) && ontologyDoc) score += 75;
  if (ontologyQuery && !ontologyDoc && !interdependenceDoc) score -= 20;

  const htmlTxtQuery = qnorm.includes('html') && qnorm.includes('txt') || qnorm.includes('dual write') || qnorm.includes('text mirror');
  const htmlTxtDoc = titleNorm.includes('dual write') || titleNorm.includes('txt html') || titleNorm.includes('html sync') || previewNorm.includes('txt html') || previewNorm.includes('html is the published') || previewNorm.includes('working file');
  if (htmlTxtQuery && htmlTxtDoc) score += 120;
  if (htmlTxtQuery && doc.star_file === 'ml') score += 12;

  if (qnorm.length > 3) {
    const shortPhrase = qnorm.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (shortPhrase && titleNorm.includes(shortPhrase)) score += 18;
    if (shortPhrase && previewNorm.includes(shortPhrase)) score += 10;
  }

  if (String(doc.source_path || '').includes('all_meaninglib_rows.jsonl')) score -= 2;
  if (String(doc.source_path || '').includes('/sections/')) score += 1;

  for (const t of tokens) {
    const tf = doc.termFreq[t] || 0;
    if (!tf) continue;
    const fieldBoost = titleNorm.includes(t) ? 3 : (sourceNorm.includes(t) ? 2 : 1);
    const lenNorm = Math.sqrt(Math.max(50, doc.term_count || 50) / 100);
    score += (Math.min(tf, 12) * (idf[t] || 1) * fieldBoost) / lenNorm;
  }

  const safetyPhrases = ['interdependent', 'interdependence', 'mother-category', 'mother category', 'access route', 'star-file', 'star file', 'hierarchy', 'psychologism', 'anti-twist', 'antitwist', 'ai prose', 'law review', 'setupnpcs', 'improvnpcs', 'dual write', 'txt html', 'html txt', 'text mirror'];
  for (const phrase of safetyPhrases) {
    if (qnorm.includes(normalizeText(phrase)) && (titleNorm.includes(normalizeText(phrase)) || previewNorm.includes(normalizeText(phrase)))) score += 8;
  }

  return score;
}

function search(rawQuery, topK = 10) {
  const query = cleanQuery(rawQuery);
  const index = loadIndex();
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const scored = index.docs
    .map(doc => ({ doc, score: scoreDoc(doc, tokens, query, index.idf || {}) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const seen = new Set();
  const deduped = [];
  for (const r of scored) {
    let key = r.doc.id || `${r.doc.star_file}:${r.doc.title}`;
    if (r.doc.star_file === 'relations') key = `${r.doc.star_file}:${r.doc.source_path}:${r.doc.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
    if (deduped.length >= topK) break;
  }
  return deduped;
}

function printResults(rawQuery, results) {
  const query = cleanQuery(rawQuery);
  console.log('');
  console.log(`Query: ${query}`);
  console.log('');
  if (!results.length) {
    console.log('No results. Try a more specific Meaninglib term.');
    return;
  }
  results.forEach((r, i) => {
    const d = r.doc;
    console.log(`${i + 1}. [${d.star_file || 'unknown'}] ${d.title}`);
    console.log(`   score: ${r.score.toFixed(2)}`);
    console.log(`   id: ${d.id}`);
    console.log(`   source: ${d.source_path}`);
    if (d.route) console.log(`   route: ${d.route}`);
    const preview = (d.preview || '').replace(/\s+/g, ' ').trim();
    if (preview) console.log(`   preview: ${preview.slice(0, 280)}${preview.length > 280 ? '...' : ''}`);
    console.log('');
  });
}

function writeLastReport(rawQuery, results) {
  const query = cleanQuery(rawQuery);
  fs.mkdirSync(reportsDir, { recursive: true });
  const lines = [
    '# Last Meaninglib query report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Query: ${query}`,
    '',
    '## Results',
    ''
  ];
  results.forEach((r, i) => {
    const d = r.doc;
    lines.push(`### ${i + 1}. [${d.star_file || 'unknown'}] ${d.title}`);
    lines.push('');
    lines.push(`- Score: ${r.score.toFixed(2)}`);
    lines.push(`- ID: ${d.id}`);
    lines.push(`- Source: ${d.source_path}`);
    if (d.route) lines.push(`- Route: ${d.route}`);
    lines.push('');
    lines.push((d.preview || '').replace(/\s+/g, ' ').trim().slice(0, 700));
    lines.push('');
  });
  fs.writeFileSync(lastReportPath, lines.join('\n'), 'utf8');
}

async function main() {
  let query = cleanQuery(process.argv.slice(2).join(' '));
  if (!query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    query = await new Promise(resolve => rl.question('Meaninglib query: ', answer => { rl.close(); resolve(cleanQuery(answer)); }));
  }
  if (!query) {
    console.error('No query entered.');
    process.exit(1);
  }
  const results = search(query, 10);
  printResults(query, results);
  writeLastReport(query, results);
  console.log(`Saved: ${path.relative(root, lastReportPath).replace(/\\/g, '/')}`);
}

if (require.main === module) main();
module.exports = { search, tokenize, loadIndex, cleanQuery };
