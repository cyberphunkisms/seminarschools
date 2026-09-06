#!/usr/bin/env node
/** Build the exact four-star-file vocabulary concordance. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {generatedAt} = require('./lib/deterministic-timestamp');

const projectRoot = path.resolve(__dirname, '..');
const SOURCES = Object.freeze([
  {id:'ml', label:'methodologylist*', file:'polymyth/methodologylist/index.html', url:'/polymyth/methodologylist/'},
  {id:'bb', label:'bookwormburrows*', file:'polymyth/bookwormburrows/index.html', url:'/polymyth/bookwormburrows/'},
  {id:'cc', label:'campaigncodex*', file:'polymyth/campaigncodex/index.html', url:'/polymyth/campaigncodex/'},
  {id:'mc', label:'modulecanon*', file:'polymyth/modulecanon/index.html', url:'/polymyth/modulecanon/'},
]);
const SEARCH_FIELDS = Object.freeze(['t', 'b', 'x', 'tg']);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}
function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function parseSeedArray(html) {
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx === -1) return [];
  const arrStart = html.indexOf('[', seedIdx);
  let depth = 0;
  let inTemplate = false;
  let quote = null;
  let escape = false;
  for (let index = arrStart; index < html.length; index += 1) {
    const char = html[index];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (quote) { if (char === quote) quote = null; continue; }
    if (inTemplate) { if (char === '`') inTemplate = false; continue; }
    if (char === '`') { inTemplate = true; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === '[') depth += 1;
    if (char === ']' && --depth === 0) {
      return Function(`"use strict"; return (${html.slice(arrStart, index + 1)});`)();
    }
  }
  throw new Error('Unclosed SEED array');
}
function loadSourceEntries(source, root = projectRoot) {
  const file = path.join(root, source.file);
  if (!fs.existsSync(file)) throw new Error(`Missing concordance source ${source.file}`);
  const html = fs.readFileSync(file, 'utf8');
  return source.id === 'ml' ? parseSeedWithAddenda(html) : parseSeedArray(html);
}
function loadVocabulary(root = projectRoot) {
  const vocabularyPath = path.join(root, 'polymyth/concordance/vocabulary.json');
  const parsed = JSON.parse(fs.readFileSync(vocabularyPath, 'utf8'));
  return parsed.terms.map(term => ({
    canonical: term.canonical,
    pattern: term.pattern,
    regex: new RegExp(term.pattern, 'i'),
  }));
}
function resetTest(regex, text) {
  regex.lastIndex = 0;
  return regex.test(text);
}
function currentLead(entry) {
  const status = String(entry.xc || '').replace(/\s+/g, ' ').trim();
  if (!/^CURRENT\b/i.test(status)) return '';
  const firstSentence = status.match(/^.{1,110}?(?:[.!?](?=\s|$)|$)/)?.[0] || status.slice(0, 110);
  return firstSentence.trim();
}
function matchContext(text, regex, maximum) {
  regex.lastIndex = 0;
  const match = regex.exec(text);
  if (!match) return '';
  const matched = match[0];
  if (matched.length > maximum) throw new Error(`Vocabulary match exceeds the ${maximum}-character snippet budget`);
  const ellipsisBudget = (match.index > 0 ? 1 : 0) + (match.index + matched.length < text.length ? 1 : 0);
  const contextBudget = Math.max(0, maximum - matched.length - ellipsisBudget);
  const left = Math.min(match.index, Math.floor(contextBudget / 2));
  const right = Math.min(text.length - (match.index + matched.length), contextBudget - left);
  const start = match.index - left;
  const end = match.index + matched.length + right;
  let value = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) value = `…${value}`;
  if (end < text.length) value = `${value}…`;
  return value;
}
function extractSnippet(entry, regex, matchedFields) {
  const field = matchedFields.find(name => resetTest(regex, String(entry[name] || '')));
  if (!field) throw new Error('Cannot make snippet for an unmatched entry');
  const lead = currentLead(entry);
  const separator = lead ? ' ' : '';
  const context = matchContext(String(entry[field] || ''), regex, 250 - lead.length - separator.length);
  let snippet = `${lead}${separator}${context}`;
  if (snippet.length > 250) snippet = context.slice(0, 250);
  if (!resetTest(regex, snippet)) throw new Error(`Generated snippet lost its vocabulary match in field ${field}; match=${JSON.stringify(String(entry[field] || '').match(regex)?.[0])}; snippet=${JSON.stringify(snippet)}`);
  return snippet;
}

function buildConcordance({root = projectRoot, timestamp = generatedAt()} = {}) {
  const vocabulary = loadVocabulary(root);
  const terms = Object.create(null);
  const currentStatusHashes = Object.create(null);
  const seenIdentities = new Set();
  let totalEntries = 0;

  for (const source of SOURCES) {
    const entries = loadSourceEntries(source, root);
    totalEntries += entries.length;
    for (const entry of entries) {
      const id = String(entry.id || `${entry.s || 'unknown'}-${slug(entry.t)}`);
      const identity = `${source.id}:${id}`;
      if (seenIdentities.has(identity)) throw new Error(`Duplicate concordance identity ${identity}`);
      seenIdentities.add(identity);
      const currentStatus = String(entry.xc || '');
      currentStatusHashes[identity] = sha256(currentStatus);
      const fieldValues = Object.fromEntries(SEARCH_FIELDS.map(field => [field, String(entry[field] || '')]));
      // One cached joined-text rejection test keeps the verifier bounded.  We
      // inspect the four fields separately only after a term is known to occur.
      const searchable = SEARCH_FIELDS.map(field => fieldValues[field]).join('\n');

      for (const term of vocabulary) {
        if (!resetTest(term.regex, searchable)) continue;
        const matchedFields = SEARCH_FIELDS.filter(field => resetTest(term.regex, fieldValues[field]));
        if (!matchedFields.length) continue;
        if (!Object.prototype.hasOwnProperty.call(terms, term.canonical)) {
          terms[term.canonical] = {count:0, entries:[]};
        }
        terms[term.canonical].entries.push({
          id,
          t:String(entry.t || '').slice(0, 200),
          s:String(entry.s || ''),
          src:source.id,
          url:`${source.url}#${id}`,
          fields:matchedFields,
          currentStatusHash:currentStatusHashes[identity],
          snip:extractSnippet(entry, term.regex, matchedFields),
        });
        terms[term.canonical].count += 1;
      }
    }
  }

  const termNames = Object.keys(terms);
  const totalReferences = termNames.reduce((sum, name) => sum + terms[name].count, 0);
  return {
    generated:timestamp,
    totalTerms:termNames.length,
    totalReferences,
    totalEntries,
    sources:SOURCES.map(({id,label,url}) => ({id,label,url})),
    searchFields:[...SEARCH_FIELDS],
    currentStatusHashes,
    terms,
  };
}

function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  const output = buildConcordance();
  const outputPath = path.join(projectRoot, 'polymyth/concordance/concordance-index.json');
  console.log(`Concordance index: ${output.totalTerms} terms, ${output.totalReferences} references across ${output.totalEntries} entries`);
  if (dryRun) {
    console.log(`[DRY RUN] Would write ${outputPath}`);
    return;
  }
  fs.mkdirSync(path.dirname(outputPath), {recursive:true});
  fs.writeFileSync(outputPath, JSON.stringify(output));
  console.log(`Wrote ${outputPath} (${Math.round(fs.statSync(outputPath).size / 1024)} KB)`);
}

if (require.main === module) main();
module.exports = {SOURCES, SEARCH_FIELDS, buildConcordance, loadSourceEntries, loadVocabulary, sha256};
