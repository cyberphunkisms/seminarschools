#!/usr/bin/env node
'use strict';
/**
 * build-meaninglib-linkability-registry.js
 *
 * Builds the contentinternet vocabulary registry used by autolink.js and the
 * concordance from the existing curated vocabulary plus star-file lexicon cues.
 * Raw .txt/source-note prose is not mutated; clickability is a generated HTML
 * and concordance surface over the source layer.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VOCAB_PATH = path.join(ROOT, 'polymyth/concordance/vocabulary.json');
const STAR_TXT = [
  'polymyth/methodologylist.txt',
  'polymyth/bookwormburrows.txt',
  'polymyth/campaigncodex.txt',
  'polymyth/modulecanon.txt'
];

function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }
function canonicalize(s){
  return String(s || '')
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function simpleCanonical(s){
  return canonicalize(s)
    .replace(/[*]/g, '-star')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
}
function phrasePattern(aliases){
  const parts = [];
  for (const raw of aliases){
    if (!raw) continue;
    let a = String(raw).trim();
    if (!a) continue;
    // Chinese and mixed CJK terms are left as direct escaped strings.
    if (/[^\x00-\x7F]/.test(a)) { parts.push(escRe(a)); continue; }
    // Allow spaces, hyphens, underscores, and optional star marker variation.
    let tokens = a
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/\*/g, '\\*')
      .split(/([\s\-_]+)/)
      .map(part => /[\s\-_]+/.test(part) ? '[\\s\\-_]+' : escRe(part))
      .join('');
    // Boundary for ordinary alphanumeric terms. Avoid boundary after literal *.
    const left = /^[A-Za-z0-9]/.test(a) ? '\\b' : '';
    const right = /[A-Za-z0-9]$/.test(a) ? '\\b' : '';
    parts.push(left + tokens + right);
  }
  return uniq(parts).join('|');
}

const explicit = [
  ['always-already', ['always already', 'always-already']],
  ['taboo', ['TABOO', 'taboo']],
  ['equifinality', ['equifinality', '殊途同歸性', '殊途同歸']],
  ['collective-synchronicity', ['collective synchronicity', 'collective-synchronicity']],
  ['collective-memory', ['collective memory', 'collective-memory']],
  ['waking-life', ['Waking Life', 'waking life']],
  ['devils-dictionary', ["Devil's Dictionary", 'The Devils Dictionary', "The Devil's Dictionary", 'Devils Dictionary']],
  ['idiomary', ['idiomary']],
  ['malefactor', ['malefactor', 'malefactors']],
  ['persona', ['Persona', 'Persona 5', 'Persona 5 Royal', 'P5R']],
  ['sabachtan-gnostic', ['sabachtan gnostic', 'sabachtan gnosticism', 'sabachtan gnostic polymyth']],
  ['sabachtan', ['sabachtan', 'sabachtani', 'sabachthani']],
  ['synchronicity', ['synchronicity']],
  ['collective-unconscious', ['collective unconscious', 'collective-unconscious']],
  ['morphic-resonance', ['morphic resonance', 'morphic-resonance']],
  ['indras-net', ["Indra's Net", 'Indras Net', 'indra net', 'indras-net']],
  ['jewel-position', ['jewel position', 'jewel-position']],
  ['critical-lexicography', ['critical lexicography', 'critical-lexicography']],
  ['satirical-lexicography', ['satirical lexicography', 'satirical-lexicography']],
  ['new-coinage-approval', ['new coinage approval', 'new-coinage approval', 'new-coinage-approval', 'NO-NAMING', 'no naming']],
  ['mephistodata-mode', ['Mephistodata would say', 'Mephistodata bloomed', 'mephistodata mode', 'Mephistodata-mode']],
  ['surface-translation-firewall', ['surface translation firewall', 'surface-translation firewall', 'surface-translation-firewall']],
  ['verbatim-preservation-gate', ['verbatim preservation gate', 'verbatim-preservation gate', 'verbatim-preservation-gate']],
  ['raw-note-layer', ['raw note layer', 'raw-note layer', 'raw-note-layer', 'raw notes', 'raw-notes']],
  ['five-books', ['five books', 'five-books']],
  ['source-trace', ['source trace', 'source-trace']],
  ['book-source-layer', ['book source layer', 'book-source layer', 'book-source-layer']],
  ['meaninglib', ['Meaninglib', 'meaninglib', 'ML*', 'ml*', 'methodologylist*', 'methodologylist']],
  ['bookwormburrows', ['BookwormBurrows', 'bookwormburrows', 'BB*', 'bb*']],
  ['campaigncodex', ['Campaign Codex', 'campaigncodex', 'CC*', 'cc*']],
  ['modulecanon', ['ModuleCanon', 'modulecanon', 'MC*', 'mc*']],
  ['bbt', ['BBT', 'BookwormBurrows Therapy', 'BB therapy']],
  ['therapeutic-ttrpg', ['therapeutic TTRPG', 'therapeutic-TTRPG', 'TA-RPG', 'therapeutically applied role-playing games']],
  ['ttrpg', ['TTRPG', 'TTRPGs', 'tabletop role-playing game', 'tabletop role-playing games']],
  ['bleed', ['bleed', 'bleed-in', 'bleed-out']],
  ['psychological-safety', ['psychological safety', 'psychological-safety']],
  ['x-card', ['X-card', 'X Card', 'X-card']],
  ['lines-and-veils', ['Lines and Veils', 'Lines-and-Veils', 'lines and veils']],
  ['bibliotherapy', ['bibliotherapy']],
  ['psychodrama', ['psychodrama']],
  ['drama-therapy', ['drama therapy', 'drama-therapy']],
  ['rainbowmagic', ['rainbowmagic', 'rainbow magic']],
  ['dimensional-master', ['Dimensional Master', 'dimensional master']],
  ['wormcard', ['wormcard', 'wormcards']],
  ['bookwormcard', ['bookwormcard', 'bookwormcards']],
  ['portal-seed', ['portal seed', 'portal-seed']],
  ['quest-prompt', ['quest prompt', 'quest-prompt']],
  ['campaign-dimension', ['campaign dimension', 'campaign-dimension']],
  ['setupnpc', ['setupNPC', 'setupnpcs', 'setup NPC', 'setup NPCs']],
  ['improvnpc', ['improvNPC', 'improvnpcs', 'improv NPC', 'improv NPCs']],
  ['sealed-exegesis', ['sealed exegesis', 'sealed-exegesis']],
  ['assignments-as-quests', ['assignments as quests', 'assignments-as-quests', 'assignment as quest', 'assignment-to-quest']],
  ['timebound-quest', ['timebound quest', 'timebound quests', 'time-bound quest', 'time-bound quests']],
  ['consequence-repair', ['consequence repair', 'consequence-repair', 'repair route', 'repair routes']],
  ['teacher-override', ['teacher override', 'teacher-override']],
  ['public-portal-log', ['public portal log', 'public-portal-log']],
  ['private-assessment-log', ['private assessment log', 'private-assessment-log']],
  ['kingdom-come-deliverance', ['Kingdom Come Deliverance', 'KCD']],
  ['gorgonification', ['gorgonification', 'gorgonified', 'gorgonifying', 'gorgonifies']],
  ['degorgonification', ['degorgonification', 'degorgonified', 'degorgonifying']],
  ['platformstrawmanculture', ['platformstrawmanculture', 'platform strawman culture', 'platformstrawmanning']],
  ['ironmanning', ['ironmanning', 'ironman', 'ironmanned']],
  ['hivemindidiom', ['hivemindidiom', 'hivemindidioms', 'hivemindidiomsnake', 'hivemindidiomsnakes']],
  ['parseltongue', ['parseltongue', 'parceltongue']],
  ['ouroborosanalyses', ['ouroborosanalyses', 'ouroborosanalysis', 'ouroborosanalytic']],
  ['psychologism', ['psychologism']],
  ['snakelogic', ['snakelogic', 'snake logic']],
  ['gorgon-ai-ethics', ['gorgon AI ethics', 'gorgon-ai ethics', 'gorgon-ai-ethics']],
  ['hydra', ['hydra', 'hydras']],
  ['gorgon', ['gorgon', 'gorgons']],
  ['mephistodata', ['mephistodata']],
];

const badParts = [
  '2026', 'origin', 'overhaul', 'overhauled', 'ratified', 't115', 't107',
  'may-', 'june-', 'july-', 'april-', 'cl-', 'pending', 'migrated',
  'report', 'audit', 'patch', 'updated', 'verify', 'verification',
  'canonical-case', 'worked-example', 'named-version', 'saul-ratified'
];
const stop = new Set(('ai both methodology learning learnings source user public internal entry entries note notes rule rules text texts works work old new model route use used using make makes made case cases field fields example examples current future live final best worst good bad true false original teacher student role both section file page context core prompt build update patch report verify system meaning data list time world way point version concept surface front facing historical structural architecture deployment multilingual register category categories application applications').split(/\s+/));
function tagAllowed(t){
  if (!t || t.length < 5) return false;
  if (stop.has(t)) return false;
  if (/^\d/.test(t)) return false;
  if (/\d{4}/.test(t)) return false;
  if (badParts.some(p => t.includes(p))) return false;
  if (/^[a-z]$/.test(t)) return false;
  if (!(/[\-]/.test(t) || t.length >= 10 || /[A-Z]/.test(t))) return false;
  return true;
}
function cleanTag(t){
  return t
    .replace(/-anchor$/,'')
    .replace(/-entry$/,'')
    .replace(/-cluster$/,'-cluster')
    .replace(/^-+|-+$/g,'');
}

const existing = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
const entries = new Map();
function add(canonical, aliases, source, oldPattern){
  const c = simpleCanonical(canonical);
  if (!c || c.length < 2) return;
  if (!entries.has(c)) entries.set(c, { canonical: c, aliases: [], sources: new Set(), pattern: null });
  const e = entries.get(c);
  if (oldPattern) e.pattern = oldPattern;
  for (const a of aliases || [canonical]) e.aliases.push(a);
  if (source) e.sources.add(source);
}

for (const t of existing.terms || []) add(t.canonical, [t.canonical], 'existing-curated', t.pattern);
for (const [canonical, aliases] of explicit) add(canonical, aliases, 'explicit-linkability');

const tagCounts = new Map();
for (const rel of STAR_TXT){
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const txt = fs.readFileSync(fp, 'utf8');
  for (const m of txt.matchAll(/\btags:\s*([^\n]+)/gi)){
    for (const raw of m[1].split(/[,;]\s*|\s+/)){
      let t = cleanTag(raw.trim().replace(/[.,]+$/,'').toLowerCase());
      if (!tagAllowed(t)) continue;
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
}
// Add frequent stable tags and all known operator/idiosyncratic tags with high signal.
const tagList = Array.from(tagCounts.entries())
  .filter(([t,c]) => c >= 2 || /(?:gorgon|sabachtan|mephisto|rainbow|burrow|psychologism|persona|taboo|equifinality|synchronicity|idiom|hivemind|faust|arendt|hegel|mephisto|ouroboros|parseltongue|polycognate|bookworm|campaign|consequence|portal)/.test(t))
  .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
for (const [tag] of tagList.slice(0, 700)) {
  const aliases = [tag, tag.replace(/-/g, ' ')];
  add(tag, aliases, 'star-tag');
}

const terms = Array.from(entries.values()).map(e => {
  const aliases = uniq(e.aliases.map(a => String(a).trim()).filter(Boolean));
  const pattern = e.pattern || phrasePattern([e.canonical, ...aliases]);
  return {
    canonical: e.canonical,
    pattern,
    aliases: aliases.filter(a => simpleCanonical(a) !== e.canonical).slice(0, 12),
    source: Array.from(e.sources).sort().join(',')
  };
}).filter(t => t.pattern && t.pattern.length < 1200);

// Longest pattern first prevents short terms hijacking longer phrases in the autolinker.
terms.sort((a,b) => b.pattern.length - a.pattern.length || a.canonical.localeCompare(b.canonical));
const out = {
  version: 2,
  updated: '2026-07-09',
  note: 'Canonical contentinternet vocabulary and linkability registry. Raw star-file source remains unmutated. Generated HTML autolinks important terms through the concordance. Built by scripts/build-meaninglib-linkability-registry.js from curated terms, current vocabulary, and stable star-file lexicon cues.',
  totalTerms: terms.length,
  terms
};
fs.mkdirSync(path.dirname(VOCAB_PATH), { recursive: true });
fs.writeFileSync(VOCAB_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`LINKABILITY REGISTRY BUILT — ${terms.length} terms written to ${path.relative(ROOT, VOCAB_PATH)}`);
console.log('Top explicit terms present:', ['equifinality','collective-synchronicity','taboo','always-already','persona','devils-dictionary','bbt','rainbowmagic'].map(k => terms.some(t=>t.canonical===k) ? k+':yes' : k+':NO').join(' '));
