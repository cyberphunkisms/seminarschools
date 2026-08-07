const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function decoded(text) {
  return text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

function normalized(text) {
  return decoded(text).replace(/\s+/g, ' ').trim();
}

function requirePhrase(text, phrase, label) {
  if (!normalized(text).includes(normalized(phrase))) {
    throw new Error(`${label} is missing required shorthand doctrine: ${phrase}`);
  }
}

function block(text, start, end, label) {
  const source = decoded(text);
  const startAt = source.indexOf(start);
  if (startAt < 0) throw new Error(`${label} start marker is missing: ${start}`);
  const endAt = source.indexOf(end, startAt + start.length);
  if (endAt < 0) throw new Error(`${label} end marker is missing: ${end}`);
  return source.slice(startAt, endAt);
}

function blocks(text, start, end, expectedCount, label) {
  const source = decoded(text);
  const found = [];
  let cursor = 0;
  while (cursor < source.length) {
    const startAt = source.indexOf(start, cursor);
    if (startAt < 0) break;
    const endAt = source.indexOf(end, startAt + start.length);
    if (endAt < 0) throw new Error(`${label} has an unterminated doctrine block.`);
    found.push(source.slice(startAt, endAt));
    cursor = endAt + end.length;
  }
  if (found.length !== expectedCount) {
    throw new Error(`${label} expected ${expectedCount} doctrine blocks and found ${found.length}.`);
  }
  return found;
}

function sortedNormalized(items) {
  return items.map(normalized).sort();
}

function resolveExplicitCommand(token, commandBody) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = decoded(commandBody).match(new RegExp(`["“]${escaped}["”]\\s*\\(([^)]+)\\)`));
  return match ? match[1].trim() : null;
}

const charter = read('CHARTER.txt');
const canonical = read('polymyth/methodologylist/index.html');
const methodology = read('polymyth/methodologylist-methodology.txt');
const coreplus = read('polymyth/methodologylist-coreplus.txt');
const fullMirror = read('polymyth/methodologylist.txt');

const charterRule = block(
  charter,
  '1A. PROJECT SHORTHAND IS RETRIEVED BEFORE INTERPRETATION.',
  '2. MEMORY IS A SCARCE TRIGGER LAYER.',
  'CHARTER 1A',
);
const canonicalQ7 = blocks(
  canonical,
  'Q7. PROJECT-SHORTHAND-INFERENCE.',
  'Q8. MEPHISTODATA-AT-CLAUSE-LEVEL.',
  2,
  'canonical Q7',
);
const mirrorQ7 = blocks(
  methodology,
  'Q7. PROJECT-SHORTHAND-INFERENCE.',
  'Q8. MEPHISTODATA-AT-CLAUSE-LEVEL.',
  2,
  'methodology mirror Q7',
);
const canonicalTrigger = blocks(
  canonical,
  '(iii) POLYMYTH-CONCEPT-ANALYSIS OR PROJECT-SHORTHAND?',
  '(iv) COMPONENTLIST TRIGGER?',
  1,
  'canonical CORE trigger iii',
)[0];
const mirrorTrigger = blocks(
  coreplus,
  '(iii) POLYMYTH-CONCEPT-ANALYSIS OR PROJECT-SHORTHAND?',
  '(iv) COMPONENTLIST TRIGGER?',
  1,
  'CORE+ mirror trigger iii',
)[0];

const controllingBlocks = [
  [charterRule, 'CHARTER 1A'],
  ...canonicalQ7.map((value, index) => [value, `canonical Q7 block ${index + 1}`]),
  [canonicalTrigger, 'canonical CORE trigger iii'],
];
const requiredDoctrine = [
  'before semantic interpretation of any candidate token or any emitted text',
  'Uncertainty makes a term a candidate; it never licenses a guess.',
  'Retrieval succeeds only when exact-token search leads to a canonical defining entry read in context.',
  'A mention, cross-reference, filename, search snippet, or unrelated hit is not a definition.',
  'Record the literal token, canonical path or entry, and exact defining text before using a meaning.',
  'If ownership is unknown, search all current canonical star files',
  'A direct or one-step derivation may be used only when the retrieved defining entry expressly records that derivation.',
  'Letter shape, acronym conventions, suffix stripping, and remembered patterns never create a meaning.',
  'Before successful retrieval, the only permitted emitted text is a neutral retrieval notice that repeats the token unchanged',
  'The notice may not expand, paraphrase, classify, operationalize, or promise downstream action.',
  'commentary, status updates, retrieval headers, plans, tool-call preambles, analysis, and final answers',
  'A missing retrieval record forbids interpretation.',
  'Worked examples document failures; they never limit this rule to named tokens.',
];

for (const [text, label] of controllingBlocks) {
  for (const phrase of requiredDoctrine) requirePhrase(text, phrase, label);
}

if (JSON.stringify(sortedNormalized(canonicalQ7)) !== JSON.stringify(sortedNormalized(mirrorQ7))) {
  throw new Error('Canonical Q7 doctrine does not match its generated methodology TXT mirror.');
}
if (normalized(canonicalTrigger) !== normalized(mirrorTrigger)) {
  throw new Error('Canonical CORE trigger iii does not match its generated CORE+ TXT mirror.');
}

for (const relativePath of [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist-coreplus.txt',
]) {
  const source = read(relativePath);
  const deployed = read(path.join('public', relativePath));
  if (source !== deployed) throw new Error(`Public shorthand doctrine mirror is stale: ${relativePath}`);
}

const commandBody = block(
  canonical,
  'VERIFIED COMMANDS (from corpus scan, each lives in its canonical slot):',
  'RECOGNITION-AND-CORRECTION ALLOWANCE',
  'canonical Command list',
);
if (resolveExplicitCommand('OA', commandBody) !== 'Ouroborosanalyses') {
  throw new Error('Non-CL fixture failed: OA did not resolve from its explicit canonical definition.');
}
if (resolveExplicitCommand('ZXQ-UNDEFINED-90817', commandBody) !== null) {
  throw new Error('Undefined-token fixture failed: an absent synthetic token acquired a meaning.');
}

requirePhrase(fullMirror, 'Q7. PROJECT-SHORTHAND-INFERENCE.', 'full methodologylist mirror');
requirePhrase(fullMirror, '(iii) POLYMYTH-CONCEPT-ANALYSIS OR PROJECT-SHORTHAND?', 'full methodologylist mirror');

console.log('General project-shorthand doctrine and mirror guard passed.');
