#!/usr/bin/env node
/*
  Build an AI-ready Meaninglib Access Pack from the local Meaninglib search index.
  Pure local Node.js: no network, no secrets, no model training.
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const exportDir = path.join(root, 'hf_export');
const indexPath = path.join(exportDir, 'search', 'meaninglib_search_index.json');
const outDir = path.join(exportDir, 'ai_access_pack');
const reportsDir = path.join(outDir, 'reports');
const latestMd = path.join(outDir, 'latest_access_pack.md');
const latestJson = path.join(outDir, 'latest_access_pack.json');
const latestReport = path.join(reportsDir, 'latest_access_pack_report.md');
const activationMd = path.join(outDir, 'MEPHISTODATA_ACTIVATION.md');

const STOP = new Set(['the','a','an','and','or','but','if','then','else','of','to','in','on','for','with','by','as','is','are','was','were','be','being','been','this','that','these','those','it','its','into','from','at','about','not','no','yes','do','does','did','can','could','should','would','will','may','might','must','than','when','where','what','which','who','whom','whose','how','why','you','your','we','our','they','their','them','he','she','his','her','i','me','my','ours','also','all','any','each','one','two','three','first','second','third','via','per','within','without','over','under','up','down','out','more','less','same','other','new','old','entry','title','body','id','role','link','links','source','json','jsonl','index','file','files','route','routes','rule','rules','https','http','www','com']);

function fail(message){ console.error('FAIL:', message); process.exit(1); }
function ensureDir(dir){ fs.mkdirSync(dir, { recursive: true }); }
function rel(file){ return path.relative(root, file).replace(/\\/g, '/'); }
function cleanQuery(value){ return String(value || '').replace(/[\\"“”]+$/g, '').trim(); }
function normalizeText(value){
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
    .replace(/interdependen(?:t|ce)/gi, ' interdependence interdependent meaninglib mother category starfile access route crossref crossrefs relation relations ontology ')
    .replace(/\b(governs?|governed|governing|ruler|ruled|hierarchy|hierarchical)\b/gi, ' hierarchy interdependence meaninglib access route ontology rejected ruler ')
    .toLowerCase();
}
function tokenize(text){
  const normalized = normalizeText(text);
  const raw = normalized.match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [];
  return raw.filter(t => t.length > 1 && !STOP.has(t));
}
function loadIndex(){
  if(!fs.existsSync(indexPath)) fail('Meaninglib search index missing. Run npm run build:meaninglib-search first.');
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}
function inferStarHints(query){
  const q = normalizeText(query);
  const hints = new Set();
  if(/\b(bb|bbstar|bookwormburrows|bookworm|setupnpc|setupnpcs|improvnpc|improvnpcs|wormcard|wormcards|dimensional master)\b/.test(q)) hints.add('bb');
  if(/\b(mc|mcstar|modulecanon|module canon|curriculum module|delivery agnostic)\b/.test(q)) hints.add('mc');
  if(/\b(cc|ccstar|campaigncodex|campaign codex|campaign level)\b/.test(q)) hints.add('cc');
  if(/\b(ml|mlstar|methodologylist|anti twist|antitwist|gorgonification|degorgonification|psychologism|mephistodata|ouroboros|citation discipline|ai prose|law review|dual write|txt html|html txt|text mirror)\b/.test(q)) hints.add('ml');
  if(/\b(core|corestar|coreplus|core\+)\b/.test(q)) hints.add('core');
  if(/\b(meaninglib|interdependence|mother category|starfile|star file|ontology|hierarchy)\b/.test(q)){ hints.add('readme'); hints.add('relations'); }
  return hints;
}
function exactRouteAlias(query){
  const q = normalizeText(query).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if(q === 'bookwormburrows' || q === 'bb' || q === 'bbstar') return {star:'bb', name:'bookwormburrows'};
  if(q === 'modulecanon' || q === 'module canon' || q === 'mc' || q === 'mcstar') return {star:'mc', name:'modulecanon'};
  if(q === 'campaigncodex' || q === 'campaign codex' || q === 'cc' || q === 'ccstar') return {star:'cc', name:'campaigncodex'};
  if(q === 'methodologylist' || q === 'ml' || q === 'mlstar') return {star:'ml', name:'methodologylist'};
  return null;
}
function scoreDoc(doc, tokens, query, idf){
  const hints = inferStarHints(query);
  const alias = exactRouteAlias(query);
  let score = 0;
  const qnorm = normalizeText(query);
  const titleNorm = normalizeText(doc.title || '');
  const previewNorm = normalizeText(doc.preview || '');
  const sourceNorm = normalizeText(doc.source_path || '');
  if(hints.has(doc.star_file)) score += 10;
  if(alias){
    const isNativeStar = doc.star_file === alias.star;
    const mentionsName = titleNorm.includes(alias.name) || previewNorm.includes(alias.name) || sourceNorm.includes(alias.name);
    if(isNativeStar && mentionsName) score += 85;
    else if(isNativeStar) score += 35;
  }
  const ontologyQuery = qnorm.includes('interdepend') || qnorm.includes('meaninglib') || qnorm.includes('ontology') || qnorm.includes('mother category') || qnorm.includes('starfile') || qnorm.includes('hierarchy') || qnorm.includes('govern');
  const ontologyDoc = ['readme','relations'].includes(doc.star_file) || String(doc.source_path || '').includes('/relations/');
  const interdependenceDoc = titleNorm.includes('interdepend') || previewNorm.includes('interdepend') || previewNorm.includes('mother category') || previewNorm.includes('mother-category') || previewNorm.includes('access route') || String(doc.source_path || '').includes('star_file_map');
  if(ontologyQuery && ontologyDoc) score += 40;
  if(ontologyQuery && interdependenceDoc) score += 50;
  if(doc.star_file === 'readme' && qnorm.includes('meaninglib')) score += 35;
  if((qnorm.includes('hierarchy') || qnorm.includes('govern')) && ontologyDoc) score += 75;
  if(ontologyQuery && !ontologyDoc && !interdependenceDoc) score -= 20;
  const htmlTxtQuery = (qnorm.includes('html') && qnorm.includes('txt')) || qnorm.includes('dual write') || qnorm.includes('text mirror');
  const htmlTxtDoc = titleNorm.includes('dual write') || titleNorm.includes('txt html') || titleNorm.includes('html sync') || previewNorm.includes('txt html') || previewNorm.includes('html is the published') || previewNorm.includes('working file');
  if(htmlTxtQuery && htmlTxtDoc) score += 120;
  if(htmlTxtQuery && doc.star_file === 'ml') score += 12;

  const mephistodataQuery = qnorm.includes('mephistodata') || qnorm.includes('mephydata');
  const activationQuery = qnorm.includes('activate') || qnorm.includes('activation') || qnorm.includes('access pack') || qnorm.includes('hugging face') || qnorm.includes('another ai');
  const mephistodataDoc = titleNorm.includes('mephistodata') || previewNorm.includes('mephistodata');
  const accessDoc = doc.star_file === 'readme' || sourceNorm.includes('hf_export/readme') || previewNorm.includes('hugging face') || previewNorm.includes('source of truth') || previewNorm.includes('mirror') || previewNorm.includes('retrieval') || titleNorm.includes('meaninglib');
  if(mephistodataQuery && mephistodataDoc) score += 45;
  if(mephistodataQuery && String(doc.section || '').toLowerCase() === 'pending') score -= 35;
  if(activationQuery && accessDoc) score += 60;
  if(activationQuery && ontologyDoc) score += 45;
  if(qnorm.length > 3){
    const phrase = qnorm.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if(phrase && titleNorm.includes(phrase)) score += 18;
    if(phrase && previewNorm.includes(phrase)) score += 10;
  }
  for(const t of tokens){
    const tf = (doc.termFreq && doc.termFreq[t]) || 0;
    if(!tf) continue;
    const fieldBoost = titleNorm.includes(t) ? 3 : (sourceNorm.includes(t) ? 2 : 1);
    const lenNorm = Math.sqrt(Math.max(50, doc.term_count || 50) / 100);
    score += (Math.min(tf, 12) * (idf[t] || 1) * fieldBoost) / lenNorm;
  }
  return score;
}
function search(query, topK=8){
  const cleaned = cleanQuery(query);
  const index = loadIndex();
  const tokens = tokenize(cleaned);
  if(!tokens.length) return [];
  const scored = index.docs.map(doc => ({doc, score: scoreDoc(doc, tokens, cleaned, index.idf || {})}))
    .filter(r => r.score > 0)
    .sort((a,b) => b.score - a.score);
  const seen = new Set();
  const out = [];
  for(const r of scored){
    const key = r.doc.id || `${r.doc.star_file}:${r.doc.title}`;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if(out.length >= topK) break;
  }
  return out;
}

function renderActivation(){
  return [
    '# MEPHISTODATA ACTIVATION',
    '',
    'Paste this whole file into another AI before asking it to work on Seminar Schools, Meaninglib, ML*, BB*, MC*, CC*, polymyth, or related tasks.',
    '',
    '## SOURCE OF TRUTH',
    'Seminar Schools site/archive is the source of truth. Hugging Face is a mirror, retrieval, dashboard, and verification layer.',
    '',
    '## LOAD STATEMENT',
    'Treat Mephistodata as an operating context for this session. Load Meaninglib as the substrate for interpreting the task.',
    '',
    '## ONTOLOGY LOCK',
    'Meaninglib is the mother-category. ml*, bb*, mc*, cc*, core*, aa*, aitr*, and related routes are interdependent access routes with local functions.',
    '',
    'Use interdependent access-route language. Avoid ruler-language that places ml* above bb*, mc*, cc*, core*, aa*, or aitr*.',
    '',
    '## OPERATING MODE',
    '1. Retrieve the relevant Meaninglib rows before answering.',
    '2. Preserve local route function, source hierarchy, page type, audience, and local authority.',
    '3. Keep star-files scannable instead of flattening them into one undifferentiated text blob.',
    '4. Name mechanical failures, missed files, wrong routing, lost invariants, and violated rules.',
    '5. Do not psychologize the operator.',
    '6. Apply anti-TWIST checks before proposing edits or advice.',
    '7. Use citations, source paths, or retrieved row IDs whenever possible.',
    '',
    '## TASK-SPECIFIC RETRIEVAL',
    'For a concrete task, first generate or load a task-specific pack from:',
    '',
    '- hf_export/ai_access_pack/latest_access_pack.md',
    '- hf_export/ai_access_pack/latest_access_pack.json',
    '- hf_export/search/meaninglib_search_index.json',
    '',
    'Recommended first query:',
    '',
    'activate Mephistodata using Hugging Face for another AI',
    '',
    'Then retrieve additional rows for the actual task terms, such as BB*, modulecanon, campaigncodex, stop psychologism, AI prose tells, anti-TWIST, route doctrine, or the exact page/file being edited.',
    '',
    '## RESPONSE CONTRACT',
    'Answer the user task from the retrieved substrate. Keep the framework active in the reasoning layer. Surface only the rules needed to prevent mistakes or explain a decision.',
    '',
    '## COPY-PASTE TASK PROMPT',
    'Use the Meaninglib / Mephistodata operating context above. Before answering, preserve the ontology lock, retrieve relevant Meaninglib rules when needed, avoid psychologism, avoid ML* hierarchy language, avoid anti-TWIST failures, and answer from the supplied substrate rather than guessing.',
    ''
  ].join('\n');
}

function renderPack(query, results){
  const generated = new Date().toISOString();
  const routes = [...new Set(results.map(r => r.doc.star_file).filter(Boolean))];
  const lines = [];
  lines.push('# Meaninglib AI Access Pack');
  lines.push('');
  lines.push(`Generated: ${generated}`);
  lines.push(`Query: ${query}`);
  lines.push('');
  lines.push('## SOURCE OF TRUTH');
  lines.push('Seminar Schools site/archive is the source of truth. Hugging Face and hf_export are mirror, retrieval, dashboard, and verification layers.');
  lines.push('');
  lines.push('## ONTOLOGY LOCK');
  lines.push('Meaninglib is the mother-category. ml*, bb*, mc*, cc*, core*, aa*, aitr*, and related routes are interdependent access routes with local functions. Do not treat ml* as a ruler over the other star-files.');
  lines.push('');
  lines.push('## LOADED ROUTES');
  lines.push(routes.length ? routes.map(r => `- ${r}`).join('\n') : '- none');
  lines.push('');
  lines.push('## RETRIEVED RULES');
  lines.push('');
  results.forEach((r, idx) => {
    const d = r.doc;
    lines.push(`### ${idx + 1}. [${d.star_file || 'unknown'}] ${d.title}`);
    lines.push(`- Score: ${r.score.toFixed(2)}`);
    lines.push(`- ID: ${d.id}`);
    lines.push(`- Source path: ${d.source_path}`);
    if(d.route) lines.push(`- Route: ${d.route}`);
    if(d.section) lines.push(`- Section: ${d.section}`);
    lines.push('');
    lines.push(String(d.preview || '').replace(/\s+/g, ' ').trim());
    lines.push('');
  });
  lines.push('## ANTI-TWIST CHECK');
  lines.push('- Preserve route function, source hierarchy, page type, audience, and local authority.');
  lines.push('- Do not flatten Meaninglib into one undifferentiated text blob.');
  lines.push('- Avoid hierarchy language that makes ml* the ruler of bb*, mc*, cc*, core*, aa*, or aitr*. Use interdependent access-route language.');
  lines.push('- Name mechanical failures and missed files. Do not psychologize the operator.');
  lines.push('- Apply AI prose tell detection when generating user-facing prose.');
  lines.push('');
  lines.push('## MEPHISTODATA MODE');
  lines.push('Operate from the retrieved substrate. Answer the actual task. Do not summarize the framework back to the operator unless asked. Retrieve before inventing.');
  lines.push('');
  lines.push('## CITATION PAYLOAD');
  lines.push('');
  results.forEach((r, idx) => {
    const d = r.doc;
    lines.push(`- ${idx + 1}. ${d.star_file || 'unknown'} | ${d.title} | ${d.id} | ${d.source_path}${d.route ? ` | ${d.route}` : ''}`);
  });
  lines.push('');
  return { generated, markdown: lines.join('\n') };
}
function main(){
  const args = process.argv.slice(2);
  let query = 'Meaninglib ontology Mephistodata default AI Access Pack';
  const qi = args.indexOf('--query');
  if(qi >= 0 && args[qi+1]) query = args.slice(qi+1).join(' ');
  else if(args.length) query = args.join(' ');
  query = cleanQuery(query);
  ensureDir(outDir); ensureDir(reportsDir);
  const results = search(query, 8);
  if(results.length < 3) fail(`too few retrieved rows for query: ${query}`);
  const {generated, markdown} = renderPack(query, results);
  const json = {
    generated_at: generated,
    query,
    source_of_truth: 'Seminar Schools site/archive is the source of truth.',
    ontology_lock: 'Meaninglib is the mother-category; star-files are interdependent access routes with local functions.',
    retrieved: results.map(r => ({ score: Number(r.score.toFixed(2)), ...r.doc }))
  };
  fs.writeFileSync(latestMd, markdown, 'utf8');
  fs.writeFileSync(latestJson, JSON.stringify(json, null, 2), 'utf8');
  fs.writeFileSync(activationMd, renderActivation(), 'utf8');
  const report = [
    '# Meaninglib AI Access Pack report', '',
    `Generated: ${generated}`,
    `Query: ${query}`,
    `Rows: ${results.length}`,
    `Markdown: ${rel(latestMd)}`,
    `JSON: ${rel(latestJson)}`,
    `Activation: ${rel(activationMd)}`,
    '',
    '## Top routes', '',
    ...[...new Set(results.map(r => r.doc.star_file || 'unknown'))].map(r => `- ${r}`),
    ''
  ].join('\n');
  fs.writeFileSync(latestReport, report, 'utf8');
  console.log(`AI Access Pack built for query: ${query}`);
  console.log(`Wrote: ${rel(latestMd)}`);
  console.log(`Wrote: ${rel(latestJson)}`);
  console.log(`Wrote: ${rel(activationMd)}`);
  console.log(`Report: ${rel(latestReport)}`);
}
if(require.main === module) main();
module.exports = { search, renderPack, loadIndex };
