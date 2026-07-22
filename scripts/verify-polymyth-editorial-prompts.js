const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const failures = [];
const checks = [];

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function pass(name, condition, detail = '') {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function hash(rel) {
  const abs = path.join(root, rel);
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

function ids(html) {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
}

function hrefFragments(html) {
  return [...html.matchAll(/\bhref="#([^"]+)"/g)].map((m) => m[1]);
}

const d8 = read('polymyth/devilsdiary/8/index.html');
const d6 = read('polymyth/devilsdiary/6/index.html');
const trace = read('polymyth/trace/index.html');

const hamasPrompt = 'How do ‘Hamas’ in Zionist discourse and ‘patriarchy’ in feminist discourse share a self-sealing Hobbesian securitization logic?';
const superPrompt = 'Why is the European Super League like OnlyFans?';

pass('Diary 8 contains exact Hamas/patriarchy prompt', d8.includes(hamasPrompt));
pass('Diary 8 names the trap of complicity', d8.includes('This is the trap of complicity: criticism is absorbed into the antagonist and returned as evidence that the critic serves it.'));
pass('Diary 8 explains the Rockhill piper mechanism', d8.includes('The piper does not need to compose every tune.') && d8.includes('field of audibility has already been arranged'));
pass('Diary 8 links the official Rockhill publisher page', d8.includes('https://monthlyreview.org/9781685901349/'));
pass('Diary 8 corrects Rockhill publisher', d8.includes('(Monthly Review Press, 2025)') && !d8.includes('(NYU Press, 2025)'));
pass('Diary 8 removes the inaccurate teenage description', !d8.includes('teenage climate activist') && !d8.includes('A Swedish teenager'));
pass('Diary 8 corrects Greta/flotilla chronology', d8.includes('June 2025') && !d8.includes('2023–2024 Gaza flotilla'));
pass('Diary 8 corrects Justice Canada date', d8.includes('19 June 2026') && !d8.includes('24 June 2026'));
pass('Diary 8 links Diary 6', d8.includes('href="/polymyth/devilsdiary/6/"'));

pass('Diary 6 contains exact Super League/OnlyFans prompt', d6.includes(superPrompt));
pass('Diary 6 defines the shared enclosure operation', d6.includes('an older relation is enclosed, access is privatized, risk is pushed downward, and rent is pulled upward'));
pass('Diary 6 explains neoliberal colonialism in plain language', d6.includes('formal freedom inside someone else’s privately owned territory'));
pass('Diary 6 cites official Super League design', d6.includes('https://www.thesuperleague.com/press.html'));
pass('Diary 6 cites OnlyFans labour research', d6.includes('https://doi.org/10.1080/23268743.2022.2096682'));
pass('Diary 6 cites neoliberal colonialism research', d6.includes('https://doi.org/10.1080/14735784.2023.2221421'));
pass('Diary 6 links Diary 8', d6.includes('href="/polymyth/devilsdiary/8/"'));

pass('Trace contains the Hamas/patriarchy prompt', trace.includes(hamasPrompt));
pass('Trace contains the Super League/OnlyFans prompt', trace.includes(superPrompt));
pass('Trace links both diary entries', trace.includes('href="/polymyth/devilsdiary/8/"') && trace.includes('href="/polymyth/devilsdiary/6/"'));

for (const [label, html] of [['Diary 8', d8], ['Diary 6', d6], ['Trace', trace]]) {
  const allIds = ids(html);
  const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  pass(`${label} has unique HTML ids`, dupes.length === 0, dupes.join(', '));
  const fragments = hrefFragments(html);
  const missing = fragments.filter((fragment) => !allIds.includes(fragment));
  pass(`${label} fragment links resolve`, missing.length === 0, missing.join(', '));
}

for (const rel of [
  'polymyth/devilsdiary/8/index.html',
  'polymyth/devilsdiary/6/index.html',
  'polymyth/trace/index.html'
]) {
  const publicRel = `public/${rel}`;
  if (fs.existsSync(path.join(root, publicRel))) {
    pass(`${rel} source/public mirrors match`, hash(rel) === hash(publicRel));
  }
}

if (failures.length) {
  console.error('POLYMYTH EDITORIAL PROMPT CHECK FAILED');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(`POLYMYTH EDITORIAL PROMPT CHECK PASSED — ${checks.length}/${checks.length} checks.`);
