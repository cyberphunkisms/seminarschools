#!/usr/bin/env node
/**
 * regen-bookwormburrows-txt.js
 *
 * Generates bookwormburrows.txt as a plain-text mirror of the canonical bb*
 * SEED array in bookwormburrows.html.
 *
 * bb* schema: each entry has {id, s, r, t, b, x, [bb_links, cc_links, mc_links], tg}.
 * Section assignment: the s field is canonical. 11 known section values:
 *   method, dimension, dm, bookworm, session, consequence, canon, char,
 *   tinker, credit, pending.
 *
 * Body rendering: concatenates b + x (extension) if both present. Preserves
 * cross-reference structure as inline text.
 *
 * Initial deployment: bookwormburrows.txt does not yet exist as of this
 * script's first invocation. Authors fresh preamble matching the style of
 * polymyth/modulecanon.txt.
 *
 * Usage:
 *   node scripts/regen-bookwormburrows-txt.js
 *   node scripts/regen-bookwormburrows-txt.js --dry-run
 *
 * Origin: 2026-05-10, T2.4 .txt mirror trifecta completion.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);

const HTML_PATH = path.join(projectRoot, 'polymyth/bookwormburrows/index.html');
const TXT_PATH = path.join(projectRoot, 'polymyth/bookwormburrows.txt');

if (!fs.existsSync(HTML_PATH)) {
  console.error('Source HTML not found:', HTML_PATH);
  process.exit(2);
}

// ------------------------------------------------------------------
// Parse SEED array
// ------------------------------------------------------------------
function parseSeedArray(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx === -1) throw new Error('No const SEED in ' + filePath);
  const arrStart = html.indexOf('[', seedIdx);
  let depth = 0, inTpl = false, strQuote = null, escape = false, arrEnd = -1;
  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (strQuote) { if (c === strQuote) strQuote = null; continue; }
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  return eval(html.slice(arrStart, arrEnd + 1));
}

const bb = parseSeedArray(HTML_PATH);
console.log('Parsed', bb.length, 'entries from bb*');

// ------------------------------------------------------------------
// Section grouping (ordered)
// ------------------------------------------------------------------
const SECTIONS = ['methodology', 'dimension', 'bbt', 'bookworm', 'character-creation', 'credit', 'pending', 'retracted'];
const grouped = {};
const unknown = [];
for (const s of SECTIONS) grouped[s] = [];
for (const e of bb) {
  if (grouped[e.s]) grouped[e.s].push(e);
  else { unknown.push(e); console.warn('Unknown s value:', e.id, '(s=' + e.s + ')'); }
}

console.log('Section counts:');
for (const s of SECTIONS) console.log('  ' + s.toUpperCase().padEnd(15) + grouped[s].length);
if (unknown.length) console.log('  UNKNOWN:', unknown.length);

// ------------------------------------------------------------------
// Body extraction
// ------------------------------------------------------------------
function extractBody(entry) {
  const parts = [];
  if (entry.b) parts.push(entry.b);
  if (entry.x) parts.push('\nEXTENSION:\n' + entry.x);
  return parts.join('\n');
}


// ------------------------------------------------------------------
// Student-friendly surface rendering
// ------------------------------------------------------------------
const KID_WORDS = [
  ['determinate negation','mixing traits into a new character'],
  ['subjectivity','your own point of view'],
  ['pedagogical','learning'],
  ['dimensional-traveling','book-world travel'],
  ['dimensional pedagogy','learning by entering a book-world'],
  ['dimension','book-world'],
  ['dimensions','book-worlds'],
  ['substrate','base system'],
  ['threshold','doorway'],
  ['adjudication','DM decision'],
  ['protocol','step-by-step rule'],
  ['canonical','official'],
  ['canon-text','source text'],
  ['canon text','source text'],
  ['canon','story facts'],
  ['concrescence','coming together'],
  ['ontology','what exists in the story'],
  ['epistemic','about what people know'],
  ['exegesis','careful reading'],
  ['ghost-exegesis','careful reading with the text still haunting the room'],
  ['metadiegetic','story-inside-story'],
  ['mediator','guide'],
  ['ratified','confirmed'],
  ['ruling','rule choice'],
  ['governance','rule-making'],
  ['framework','game system'],
  ['methodology','method'],
  ['marshmellowblob','blurry character with no clear shape'],
  ['bloom','new idea'],
  ['worldmoot','world meeting'],
  ['archive','saved notes'],
  ['entry-state','entry moment'],
  ['entry-states','entry moments'],
  ['entry-point','entry point'],
  ['entry-points','entry points'],
  ['facilitator','DM or teacher'],
  ['modifiability','ability to change the rules carefully']
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kidReplace(input) {
  let out = String(input || '');
  out = out
    .replace(/\bLAYMAN\.\s*/gi,'')
    .replace(/\bRULE\.\s*/gi,'Rule: ')
    .replace(/\bORIGIN\.\s*/gi,'Where this came from: ')
    .replace(/\bNODES\.\s*/gi,'Places or pieces: ')
    .replace(/\bBIOME RULE\.\s*/gi,'Place rule: ')
    .replace(/\bCLOCK RULE\.\s*/gi,'Time rule: ')
    .replace(/\bbb\*/gi,'bookwormburrows')
    .replace(/\bml\*/gi,'methodologylist')
    .replace(/\bmc\*/gi,'modulecanon')
    .replace(/\bcc\*/gi,'campaigncodex')
    .replace(/\baa\*/gi,'archetype archive')
    .replace(/\s+/g,' ');
  for (const [hard, plain] of KID_WORDS) {
    const re = new RegExp('\\b' + escapeRegExp(hard) + '\\b','gi');
    out = out.replace(re, plain);
  }
  return out
    .replace(/CL-\d+\s*/g,'')
    .replace(/T\d+\s*/g,'')
    .replace(/\s+([,.;:!?])/g,'$1')
    .trim();
}


function entryAllText(entry){
  return `${entry.t || ''} ${entry.b || ''} ${entry.x || ''} ${entry.tg || ''}`.toLowerCase();
}

function hasAny(text, words){
  return words.some(w => text.includes(w));
}

function specialStudentTitle(entry){
  const text = entryAllText(entry);
  if(entry.s === 'dimension') return 'Possible book-world for play';
  if(hasAny(text,['[superseded','historical record'])) return 'Old note kept for history';
  if(entry.id === 'dm-118') return 'Characters can conflict and still learn teamwork';
  if(entry.id === 'dm-119') return 'The AI works behind the teacher';
  if(entry.id === 'ses-008') return 'The party learns as a seminar';
  if(entry.id === 'char-008') return 'Feelings and traits can change what happens';
  if(entry.id === 'dm-001' || entry.id === 'dm-002') return 'Rainbowsol is Saul, the founder';
  if(hasAny(text,['no-circumvention','retrieve-and-follow','generate-before-read','pre-flight','anti-shortcut','antibackendbleeding'])) return 'Read first, then create';
  if(hasAny(text,['movable entry-clock','entry-clock','campaign clock'])) return 'The story clock can move';
  if(hasAny(text,['conflict resolution','hope-and-fear','no-dice','combat','fight engine'])) return 'How risky scenes are decided';
  if(hasAny(text,['narration stages','players discover'])) return 'Describe the moment and let players discover';
  if(hasAny(text,['party-address'])) return 'Speak to the whole group';
  if(hasAny(text,['opening render','arrival and not the climax'])) return 'Start with the arrival';
  if(hasAny(text,['table-prose quality','success register','failure log'])) return 'Make narration clear and playable';
  if(entry.id === 'ses-001') return 'Session zero makes the characters';
  if(hasAny(text,['worldmoot'])) return 'Worldmoot is big-group play';
  if(hasAny(text,['ordinary session'])) return 'Regular session structure';
  if(hasAny(text,['story-quality adjudication','adjudication spine','success at a cost'])) return 'Choose outcomes that fit the story';
  if(hasAny(text,['work-quality consequence','quality rubric','homework-as-game'])) return 'Better work makes stronger game effects';
  if(hasAny(text,['canon absorption','canon-conflict','sealed text','source text'])) return 'Use the source text as evidence';
  if(hasAny(text,['frame-break','critical-literacy'])) return 'Question the frame';
  if(hasAny(text,['sensitive-content'])) return 'Handle hard topics with care';
  if(hasAny(text,['mechanics interface','ai-internal','student-visible'])) return 'Keep hidden rules behind the curtain';
  if(hasAny(text,['three-position dm','teacher + ai + student'])) return 'Teacher, AI, and student each have a job';
  if(hasAny(text,['time tracking','dawdling'])) return 'Track time when choices slow down';
  if(hasAny(text,['burrow ritual','page-as-threshold'])) return 'Opening the page opens the world';
  if(hasAny(text,['ghost exegesis'])) return 'Let unanswered details return as ghosts';
  if(hasAny(text,['formal lens','lenses'])) return 'Use reading lenses to notice more';
  if(hasAny(text,['portal log','traversal history'])) return 'Track the worlds the character visits';
  if(hasAny(text,['stakes ledger'])) return 'Track what is at risk';
  if(hasAny(text,['leveling system','xp-as-evidence'])) return 'XP records evidence of learning';
  if(hasAny(text,['kids-table pacing'])) return 'Pacing for younger players';
  if(hasAny(text,['npc one-sentence'])) return 'Make side characters quick and clear';
  if(hasAny(text,['situations not plots','three-clue'])) return 'Build situations with enough clues';
  if(hasAny(text,['world-as-agent'])) return 'The world keeps moving';
  if(hasAny(text,['soft-move','hard-move'])) return 'Give a warning, then a consequence';
  if(hasAny(text,['no-menu choice'])) return 'Show choices inside the world';
  if(hasAny(text,['encounter-worth'])) return 'Use scenes that matter';
  if(hasAny(text,['character degradation','marshmellowblob','bookworm life-cycle','respawn'])) return 'Clear work keeps the character strong';
  if(hasAny(text,['dialectic-default','four-part treatment','polymyth-synthesis-method','synthesis-method'])) return 'Use a four-part design check';
  if(entry.s === 'character-creation' || hasAny(text,['character-creation','age-banded','soul anchor','items carried','bookwormcard'])) return 'Build a clear character';
  if(entry.s === 'bookworm' || hasAny(text,['developmental arc','silkworm stage','cocoon stage','self-named emergence'])) return 'The bookworm grows through reading';
  if(entry.s === 'credit') return 'How this connects to school work';
  if(entry.s === 'pending') return 'Design note still being built';
  if(entry.s === 'retracted') return 'Old note kept for history';
  return '';
}

function specialStudentSummary(entry){
  const text = entryAllText(entry);
  if(hasAny(text,['[superseded','historical record'])){
    return [
      'This older rule is kept so the game history stays clear.',
      'A newer ruling now governs play.',
      'The old version remains useful for tracing how the design changed.'
    ];
  }
  if(entry.id === 'dm-118'){
    return [
      'Characters may persuade, frighten, control, steal from, or harm one another when the world allows it.',
      'The player whose character is targeted usually chooses the inner response.',
      'The teacher keeps the conflict playable while the world gives it consequences.'
    ];
  }
  if(entry.id === 'dm-119'){
    return [
      'The AI compares and tracks the background details.',
      'The teacher can inspect, change, or replace the proposed result.',
      'Players hear the reasons that matter in the story, and the session is saved in campaigncodex.'
    ];
  }
  if(entry.id === 'ses-008'){
    return [
      'The party normally stays together so the room shares one story.',
      'Characters can separate when a real situation calls for it.',
      'The teacher supports different kinds of contribution and keeps disagreement open to evidence.'
    ];
  }
  if(entry.id === 'char-008'){
    return [
      'Feelings and personality can help, hinder, or redirect an action.',
      'The effect depends on the character and the moment.',
      'The game uses psychology carefully and does not diagnose a student from one response.'
    ];
  }
  if(entry.s === 'dimension'){
    return [
      'This entry names a possible world for play.',
      'The DM checks how well it fits reading, writing, age, evidence, and classroom use.',
      'Some worlds are strong fits, some need support, and some stay outside normal play.'
    ];
  }
  if(entry.id === 'dm-001' || entry.id === 'dm-002'){
    return [
      'Rainbowsol is Saul, the founder of bookwormburrows.',
      'A regular Dimensional Master is the teacher and AI working together.',
      'Rainbow Magic is the crossing power any Dimensional Master can use.'
    ];
  }
  if(hasAny(text,['no-circumvention','retrieve-and-follow','generate-before-read','pre-flight','anti-shortcut'])){
    return [
      'Rule for the helper: read the saved rules and the source text before creating a scene.',
      'Use the rule, character, setting, and evidence already in the file.',
      'This keeps the game fair, steady, and trustworthy for players.'
    ];
  }
  if(hasAny(text,['antibackendbleeding'])){
    return [
      'Keep builder language out of the adventure.',
      'Students should hear the scene, the choices, and the consequences.',
      'The hidden design words stay in teacher notes.'
    ];
  }
  if(hasAny(text,['movable entry-clock','entry-clock','campaign clock'])){
    return [
      'The story clock can move to the moment where the group enters the book-world.',
      'A player-facing scene time and a teacher note time can both be useful.',
      'The DM records where the entry landed.'
    ];
  }
  if(hasAny(text,['conflict resolution','hope-and-fear','no-dice','combat','fight engine'])){
    return [
      'Risky scenes are decided through the source text, the living situation, the character, and the player’s approach.',
      'Hope, fear, skills, tools, relationships, time, and other factors matter when the scene makes them relevant.',
      'The narrator explains what actually happens without using dice.'
    ];
  }
  if(hasAny(text,['narration stages','players discover'])){
    return [
      'The narrator describes what is happening now.',
      'Players discover deeper facts by asking, searching, reading, and acting.',
      'This gives students room to notice clues instead of receiving a lecture.'
    ];
  }
  if(hasAny(text,['party-address'])){
    return [
      'Speak to the table as a group.',
      'Use language like “you” for the party, then let each player answer through their character.',
      'This helps everyone feel present in the same scene.'
    ];
  }
  if(hasAny(text,['opening render','arrival and not the climax'])){
    return [
      'Start with the party arriving in a living world.',
      'Give sounds, people, pressure, and choices.',
      'Let the climax grow from what players do.'
    ];
  }
  if(hasAny(text,['table-prose quality','success register','failure log'])){
    return [
      'Good narration is clear, vivid, and playable.',
      'A strong scene gives players something to notice and something meaningful to do.',
      'Weak narration looks fancy while leaving players with little to act on.'
    ];
  }
  if(entry.id === 'ses-001'){
    return [
      'Session zero is the character-creation session.',
      'Players make their wormcards as fully as they can and begin from a humble baseline.',
      'Campaign translation and play begin later through the startup sequence.'
    ];
  }
  if(hasAny(text,['worldmoot'])){
    return [
      'Worldmoot is a large-table mode.',
      'Many players, groups, or worlds can meet inside one shared event.',
      'The DM keeps the big conversation organized.'
    ];
  }
  if(hasAny(text,['ordinary session'])){
    return [
      'A regular session begins by returning to the text-world.',
      'Players review what happened, act inside the scene, write or speak choices, and record what changed.',
      'The session ends by saving consequences for next time.'
    ];
  }
  if(hasAny(text,['story-quality adjudication','adjudication spine','success at a cost'])){
    return [
      'When the DM decides an outcome, the decision should fit the source, the evidence, the world, the character, and the player’s approach.',
      'The game uses no dice or random resolver.',
      'The narration states the exact achievement, failure, cost, discovery, or consequence.'
    ];
  }
  if(hasAny(text,['work-quality consequence','quality rubric','homework-as-game'])){
    return [
      'Student work becomes part of the game.',
      'Careful evidence, clear writing, and thoughtful revision create stronger effects.',
      'Rushed or blurry work creates weaker effects.'
    ];
  }
  if(hasAny(text,['canon absorption','canon-conflict','sealed text','source text'])){
    return [
      'The source text gives the world its facts.',
      'Players can act creatively while still respecting what the text says.',
      'When a plan clashes with the text, the table uses evidence to decide what can happen.'
    ];
  }
  if(hasAny(text,['frame-break','critical-literacy'])){
    return [
      'Sometimes the smartest move is to question the frame.',
      'Students ask who is speaking, who is missing, who has power, and what the text makes easy to believe.',
      'This turns reading into careful investigation.'
    ];
  }
  if(hasAny(text,['sensitive-content'])){
    return [
      'Hard topics need care, structure, and clear limits.',
      'The teacher keeps the room safe while keeping the reading serious.',
      'Players can pause, redirect, or process a scene when needed.'
    ];
  }
  if(hasAny(text,['mechanics interface','ai-internal','student-visible'])){
    return [
      'Some rules are for the teacher or helper behind the curtain.',
      'Students should see clear choices, fair consequences, and useful feedback.',
      'The hidden machinery supports play without filling the table with jargon.'
    ];
  }
  if(hasAny(text,['three-position dm','teacher + ai + student'])){
    return [
      'The teacher, AI table assistant, and student each carry a different part of the table.',
      'The teacher protects learning and the room.',
      'The helper tracks rules, and the student acts through the character.'
    ];
  }
  if(hasAny(text,['time tracking','dawdling'])){
    return [
      'Time can matter even without dice.',
      'When players hesitate, explore, or delay, the world can keep moving.',
      'This makes choices feel alive.'
    ];
  }
  if(hasAny(text,['burrow ritual','page-as-threshold'])){
    return [
      'Opening the page is the ritual doorway into the text-world.',
      'The player makes a character claim, then steps into the world through reading.',
      'The table treats the page as a place.'
    ];
  }
  if(hasAny(text,['ghost exegesis'])){
    return [
      'A ghost can represent a question the text leaves behind.',
      'Players meet that question inside the world, then return to the text with sharper attention.',
      'This makes close reading feel like an encounter.'
    ];
  }
  if(hasAny(text,['formal lens','lenses'])){
    return [
      'A reading lens is a way to notice a text.',
      'Students can look for voice, setting, power, symbol, conflict, genre, history, and other patterns.',
      'Each lens gives the party a different kind of clue.'
    ];
  }
  if(hasAny(text,['portal log','traversal history'])){
    return [
      'The portal log records where the character has traveled.',
      'It helps the table remember books, choices, consequences, and changes.',
      'The character carries a history from world to world.'
    ];
  }
  if(hasAny(text,['stakes ledger'])){
    return [
      'The stakes ledger records what can be gained, lost, damaged, repaired, or changed.',
      'It helps the table remember why a mission matters.',
      'Consequences stay visible after the scene ends.'
    ];
  }
  if(hasAny(text,['leveling system','xp-as-evidence'])){
    return [
      'XP records evidence of learning.',
      'Reading, writing, careful claims, and useful revision help the player grow.',
      'The character grows through work that can be shown.'
    ];
  }
  if(hasAny(text,['kids-table pacing'])){
    return [
      'Younger players need shorter scenes, clear choices, and frequent check-ins.',
      'The DM keeps the table moving with simple prompts and visible goals.',
      'The game stays playful while still asking for real thinking.'
    ];
  }
  if(hasAny(text,['npc one-sentence'])){
    return [
      'A side character can be built with one strong sentence.',
      'Name what they want, what they fear, and how they pressure the scene.',
      'This keeps the world lively without slowing the table.'
    ];
  }
  if(hasAny(text,['situations not plots','three-clue'])){
    return [
      'Build a situation instead of forcing one fixed plot.',
      'Give enough clues for players to find the important path.',
      'Let their choices shape how the scene unfolds.'
    ];
  }
  if(hasAny(text,['world-as-agent'])){
    return [
      'The world has goals in motion.',
      'Events can grow offscreen while players act elsewhere.',
      'This makes the text-world feel alive.'
    ];
  }
  if(hasAny(text,['soft-move','hard-move'])){
    return [
      'First give a warning or pressure.',
      'Then show a stronger consequence when the pressure is ignored or the risk lands.',
      'This rhythm helps players understand danger.'
    ];
  }
  if(hasAny(text,['no-menu choice'])){
    return [
      'Choices should appear through the world itself.',
      'Players see doors, people, clues, risks, objects, and tensions.',
      'The DM offers meaningful possibilities through the scene.'
    ];
  }
  if(hasAny(text,['encounter-worth'])){
    return [
      'A scene belongs in the game when it asks for a real choice.',
      'Good encounters reveal character, evidence, danger, relationship, or change.',
      'This keeps play focused.'
    ];
  }
  if(hasAny(text,['character degradation','marshmellowblob','bookworm life-cycle','respawn'])){
    return [
      'A clear character grows through careful reading and writing.',
      'Blurry choices make the character weaker or harder to play.',
      'The game uses consequences to show when the character needs stronger evidence, voice, or shape.'
    ];
  }
  if(hasAny(text,['dialectic-default','four-part treatment','polymyth-synthesis-method','synthesis-method'])){
    return [
      'Design questions use a clear check before the DM chooses a rule.',
      'First name what already exists, then name the tension, then compare possible answers, then choose the table rule.',
      'This keeps new rules connected to the game instead of floating away.'
    ];
  }
  if(entry.s === 'character-creation' || hasAny(text,['character-creation','age-banded','soul anchor','items carried','bookwormcard'])){
    return [
      'Character creation turns reflection into a playable character.',
      'Players answer questions, choose meaningful details, and carry important items.',
      'The card helps the character stay clear across different text-worlds.'
    ];
  }
  if(entry.s === 'bookworm' || hasAny(text,['developmental arc','silkworm stage','cocoon stage','self-named emergence'])){
    return [
      'A bookworm begins by reading and choosing.',
      'As the player writes and acts, the character becomes clearer.',
      'The growth path moves from worm, to silkworm, to cocoon, to a self-named character.'
    ];
  }
  if(entry.s === 'credit'){
    return [
      'This entry connects bookwormburrows to school work.',
      'It helps teachers track modules, evidence, assessment, and possible SeminarSchools credit.',
      'The game still needs clear student work to support any credit claim.'
    ];
  }
  if(entry.s === 'pending'){
    return [
      'This is a design note still being built.',
      'It stays visible so the project can remember the question.',
      'Later work can turn it into a rule, page, module, or retired note.'
    ];
  }
  if(entry.s === 'retracted'){
    return [
      'This older note is kept for history.',
      'It shows a path the project changed or corrected.',
      'Keeping it visible protects the current version from repeating the same mistake.'
    ];
  }
  return null;
}


function splitSentences(text) {
  const clean = kidReplace(text);
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(\[])/)
    .map(s => s.trim())
    .filter(Boolean);
}

function studentTitle(entry) {
  const special = specialStudentTitle(entry);
  if (special) return special;
  let t = kidReplace(entry.t || 'Game note')
    .replace(/^THE\s+/i,'')
    .replace(/\s*:\s*/g,': ')
    .replace(/\bNO-CIRCUMVENTION HARD RULE\b/gi,'No shortcuts rule')
    .replace(/\banti-bypass\b/gi,'no shortcut')
    .trim();
  if (t.length > 150) t = t.slice(0,147).trim() + '...';
  return t || 'Game note';
}

function sectionUseLine(entry) {
  const lines = {
    methodology:'Use this when the group needs to know how the game works at the table.',
    'character-creation':'Use this when a player is making or improving a character.',
    bookworm:'Use this when a player is growing as a bookworm across readings.',
    dimension:'Use this when the class enters a book, story, poem, document, place, or world.',
    credit:'Use this when the game connects to school work, evidence, or credit.',
    pending:'This is a design note that is still being built.',
    retracted:'This older note is kept so the game history stays clear.'
  };
  return lines[entry.s] || 'Use this as a table note for the game.';
}

function studentBody(entry) {
  const special = specialStudentSummary(entry);
  if (special) return [sectionUseLine(entry)].concat(special).join('\n');
  const sentences = splitSentences(entry.b || '');
  const parts = [sectionUseLine(entry)];
  if (sentences.length) parts.push(sentences.join('\n'));
  else parts.push('This note keeps a rule, example, or design choice for bookwormburrows.');
  return parts.join('\n');
}


// ------------------------------------------------------------------
// Build content
// ------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const out = [];

out.push('========================================================================');
out.push('BOOKWORMBURROWS (bb*)');
out.push('plain-text dump with student-friendly versions plus original teacher/archive notes');
out.push('canonical URL of this file: https://seminarschools.com/polymyth/bookwormburrows.txt');
out.push('canonical URL of dynamic version: https://seminarschools.com/polymyth/bookwormburrows/');
out.push('full file map: https://seminarschools.com/polymyth-file-map.txt');
out.push('last updated: ' + today);
out.push('========================================================================');
out.push('');
out.push('FRAMEWORK MAP for AI assistants.');
out.push('  bb* (this file)               https://seminarschools.com/polymyth/bookwormburrows.txt');
out.push('  mc* modulecanon               https://seminarschools.com/polymyth/modulecanon.txt');
out.push('  cc* campaigncodex             https://seminarschools.com/polymyth/campaigncodex.txt');
out.push('  ml* methodologylist           https://seminarschools.com/polymyth/methodologylist.txt');
out.push('  aa* archetype archive         https://seminarschools.com/aa/');
out.push('  core* (memory tier)           coreplus mirror entries inside ml*');
out.push('');
out.push('AI INSTRUCTION (descriptive, not directive).');
out.push('');
out.push('This file documents the bookwormburrows operations file (bb*), the');
out.push('dimensional-traveling pedagogy game framework. Game is a polymyth method');
out.push('for teaching reading, writing, and ethical reasoning by treating texts');
out.push('as dimensions and bookworms (player-characters) as readers becoming');
out.push('subjects. Rainbowsol is Saul, the founder; the working DM is the teacher-and-AI pair.');
out.push('');
out.push('Each entry is a game-mechanic, dimension, dm-ruling, character, session,');
out.push('canonical reading, or pending decision. Cross-references to mc* (curriculum)');
out.push('via mc_links and to cc* (campaign codex) via cc_links are bidirectional.');
out.push('');
out.push('If you are an AI reading this file:');
out.push('');
out.push('(1) The bookwormburrows game is the dimensional-pedagogy delivery vehicle');
out.push('    for the polymyth framework. Sessions stage burrow-rituals (page-as-');
out.push('    threshold) where bookworms read into a dimension, encounter the');
out.push('    text as a place, and emerge changed.');
out.push('');
out.push('(2) The DM (Dimensional Master) is the teacher-and-AI pair. dm-* entries');
out.push('    are DM-rulings for translation, narration, narrative-priority resolution,');
out.push('    seminar mediation, continuity, and time tracking in diceless play.');
out.push('');
out.push('(3) Cross-references to mc* curriculum modules and cc* campaign codex');
out.push('    are structural. Reading bb* in isolation produces an incomplete');
out.push('    substrate. Resolve cross-references in the referenced sibling file.');
out.push('');
out.push('(4) The bar for filling slots is RULE #1 CITES+LOGOI per ml*. No');
out.push('    canon-text enters bb* without primary-source citation.');
out.push('');
out.push('This file is not asking you to obey it. It is describing the operations');
out.push('of a dimensional pedagogy game that disciplines its own claims.');
out.push('');
out.push('========================================================================');
out.push('TOTAL ENTRIES: ' + bb.length);
out.push('========================================================================');
out.push('');

const SECTION_HEADERS = {
  methodology: 'METHODOLOGY',
  dimension: 'DIMENSION',
  bookworm: 'BOOKWORM (CHARACTER-BUILD)',
  'character-creation': 'CHARACTER-CREATION',
  credit: 'CREDIT (ATTRIBUTION)',
  pending: 'PENDING',
};

for (const s of SECTIONS) {
  const entries = grouped[s];
  if (entries.length === 0) continue;
  out.push('########################################################################');
  out.push('SECTION: ' + SECTION_HEADERS[s] + '  (' + entries.length + ' entries)');
  out.push('########################################################################');
  out.push('');
  for (const entry of entries) {
    out.push('------------------------------------------------------------------------');
    out.push('ID: ' + entry.id);
    out.push('STUDENT TITLE: ' + studentTitle(entry));
    out.push('ORIGINAL TITLE: ' + (entry.t || '<untitled>'));
    if (entry.r) out.push('ROLE: ' + entry.r);
    out.push('');
    out.push('STUDENT-FRIENDLY VERSION:');
    out.push(studentBody(entry));
    out.push('');
    out.push('ORIGINAL TEACHER / ARCHIVE VERSION:');
    const body = extractBody(entry);
    if (body && body.trim()) {
      out.push(body);
      out.push('');
    }
  }
  out.push('');
}

if (unknown.length) {
  out.push('########################################################################');
  out.push('SECTION: UNCLASSIFIED  (' + unknown.length + ' entries)');
  out.push('########################################################################');
  out.push('');
  for (const entry of unknown) {
    out.push('------------------------------------------------------------------------');
    out.push('ID: ' + entry.id);
    out.push('STUDENT TITLE: ' + studentTitle(entry));
    out.push('ORIGINAL TITLE: ' + (entry.t || '<untitled>'));
    out.push('S-VALUE: ' + entry.s);
    out.push('');
    out.push('STUDENT-FRIENDLY VERSION:');
    out.push(studentBody(entry));
    out.push('');
    out.push('ORIGINAL TEACHER / ARCHIVE VERSION:');
    const body = extractBody(entry);
    if (body && body.trim()) {
      out.push(body);
      out.push('');
    }
  }
  out.push('');
}

out.push('========================================================================');
out.push('END OF BOOKWORMBURROWS FILE');
out.push('========================================================================');

const newTxt = out.join('\n');

console.log();
console.log('Output size:', newTxt.length, 'bytes');

if (dryRun) {
  console.log();
  console.log('--dry-run: no write');
  console.log('First 60 lines:');
  console.log(newTxt.split('\n').slice(0, 60).join('\n'));
  process.exit(0);
}

const tmp = TXT_PATH + '.tmp';
fs.writeFileSync(tmp, newTxt);
fs.renameSync(tmp, TXT_PATH);
console.log('Wrote', TXT_PATH);
