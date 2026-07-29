#!/usr/bin/env node
'use strict';

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
  checks.push({name, passed: Boolean(condition), detail});
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function hash(rel) {
  const abs = path.join(root, rel);
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

function staticMarkup(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
}

function ids(html) {
  return [...staticMarkup(html).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
}

function hrefFragments(html) {
  return [...staticMarkup(html).matchAll(/\bhref="#([^"]+)"/g)].map(match => match[1]);
}

const promptSets = new Map([
  [1, {
    id: 'oracle-mattingly-grief',
    prompts: [
      'Why is celebrating Daniel Mattingly as a brave queer child structurally like taking away his microphone?',
      'How did the school that censored Daniel Mattingly and the media that celebrated him replace his grief with opposing scripts?',
      'Why can censoring Daniel Mattingly, celebrating him, and exposing both reactions erase the same grieving boy?',
    ],
  }],
  [2, {
    id: 'oracle-mearsheimer-counterevidence',
    prompts: [
      'How do ‘that tells you all’ and Mearsheimer’s category of nonrational state action protect opposing explanations from the same evidence?',
      'Why is filing Mearsheimer under ‘blaming NATO and Ukraine for everything’ like filing a catastrophic state decision under ‘nonrational’?',
      'How can both a theory of state rationality and a slogan/hivemindidiom against that theory turn catastrophe into confirmation?',
    ],
  }],
  [3, {
    id: 'oracle-magna-carta-chains',
    prompts: [
      'How can worshipping Magna Carta as the birth of democracy and dismissing it as a feudal bargain hide the same surviving liberty?',
      'Why can a fact checker be right about Magna Carta’s past and wrong about what its myth produced?',
      'Why is debunking Magna Carta like worshipping it?',
    ],
  }],
  [4, {
    id: 'oracle-emotional-labor-responsibility',
    prompts: [
      'Why is refusing to educate someone as unpaid emotional labor like buying a carbon offset?',
      'How does refusing education as unpaid emotional labor reproduce the same account of private obligation as taxation is theft?',
      'Why can naming care as labor expose an old exploitation and establish a new market at the same time?',
    ],
  }],
  [5, {
    id: 'oracle-captured-myth',
    prompts: [
      'Why is calling Shambhala Nazi mythology like calling the Benin Bronzes British heritage?',
      'Why does defining Agartha through fascist appropriation grant fascism the ownership that anti-colonialism denies empire?',
      'How do fascists who seize a myth and anti-fascists who define it through that seizure complete the same capture?',
    ],
  }],
  [6, {
    id: 'oracle-superleague-onlyfans',
    prompts: ['Why is the European Super League like OnlyFans?'],
  }],
  [7, {
    id: 'oracle-borrowed-pain',
    prompts: [
      'Why is a trauma post shared to raise awareness like a colonial missionary tract?',
      'Why is reposting a child in rubble structurally like displaying a suffering child in a missionary appeal?',
      'How can a viral script make refusal of the civilizing mission appear to be refusal of the suffering person?',
    ],
  }],
  [8, {
    id: 'oracle-hamas-patriarchy',
    prompts: [
      'How do ‘Hamas’ in Zionist discourse and ‘patriarchy’ in feminist discourse share a self-sealing Hobbesian securitization logic?',
    ],
  }],
  [9, {
    id: 'oracle-gorgonwars',
    prompts: [
      'How can white feminism, carceral feminism, and neoliberal feminism name real failures while performing the same operation as a police department blaming abuse on a few bad officers?',
      'Why is saying feminism has no pope like saying capitalism has no shopkeeper?',
      'How can pricing education as unpaid emotional labor preserve inside feminism the market logic assigned to neoliberal feminism?',
    ],
  }],
  [10, {
    id: 'oracle-wildfire-responsibility',
    prompts: [
      'Why can we say we put people on the Moon while hesitating to say we increased wildfire risk?',
      'Why is blaming only fossil fuel companies for climate driven wildfires like a fossil fuel company blaming only consumers?',
      'Why does one person’s tiny effect preserve responsibility for an election but erase responsibility for climate risk?',
    ],
  }],
]);

const pages = new Map();
for (const [number, spec] of promptSets) {
  const rel = `polymyth/devilsdiary/${number}/index.html`;
  const html = read(rel);
  pages.set(number, {rel, html, spec});
  pass(
    `Diary ${number} contains its oracle heading`,
    html.includes(`<h3 id="${spec.id}">Ask your favourite AI</h3>`),
  );
  for (const prompt of spec.prompts) {
    pass(`Diary ${number} contains exact prompt: ${prompt}`, html.includes(prompt));
  }
  if (spec.prompts.length > 1) {
    pass(
      `Diary ${number} publishes its prompts as an ordered list`,
      html.includes('<ol class="prompt-list">'),
    );
  }
}

const d6 = pages.get(6).html;
const d8 = pages.get(8).html;
const d10 = pages.get(10).html;
const trace = read('polymyth/trace/index.html');
const method = read('polymyth/methodologylist/index.html');
const ledger = read('polymyth/devilsdiary/index.html');

pass(
  'Diary 8 names the trap of complicity',
  d8.includes('This is the trap of complicity: criticism is absorbed into the antagonist and returned as evidence that the critic serves it.'),
);
pass(
  'Diary 8 explains the Rockhill piper mechanism',
  d8.includes('The piper does not need to compose every tune.')
    && d8.includes('field of audibility has already been arranged'),
);
pass(
  'Diary 8 links the official Rockhill publisher page',
  d8.includes('https://monthlyreview.org/9781685901349/'),
);
pass(
  'Diary 8 corrects Rockhill publisher',
  d8.includes('(Monthly Review Press, 2025)')
    && !d8.includes('(NYU Press, 2025)'),
);
pass(
  'Diary 8 removes the inaccurate teenage description',
  !d8.includes('teenage climate activist') && !d8.includes('A Swedish teenager'),
);
pass(
  'Diary 8 corrects Greta/flotilla chronology',
  d8.includes('June 2025') && !d8.includes('2023–2024 Gaza flotilla'),
);
pass(
  'Diary 8 corrects Justice Canada date',
  d8.includes('19 June 2026') && !d8.includes('24 June 2026'),
);
pass('Diary 8 links Diary 6', d8.includes('href="/polymyth/devilsdiary/6/"'));

pass(
  'Diary 6 defines the shared enclosure operation',
  d6.includes('an older relation is enclosed, access is privatized, risk is pushed downward, and rent is pulled upward'),
);
pass(
  'Diary 6 explains neoliberal colonialism in plain language',
  d6.includes('formal freedom inside someone else’s privately owned territory'),
);
pass(
  'Diary 6 cites official Super League design',
  d6.includes('https://www.thesuperleague.com/press.html'),
);
pass(
  'Diary 6 cites OnlyFans labour research',
  d6.includes('https://doi.org/10.1080/23268743.2022.2096682'),
);
pass(
  'Diary 6 cites neoliberal colonialism research',
  d6.includes('https://doi.org/10.1080/14735784.2023.2221421'),
);
pass('Diary 6 links Diary 8', d6.includes('href="/polymyth/devilsdiary/8/"'));

pass(
  'Diary 10 states universal responsibility as an ethical thesis',
  d10.includes('The universal “we” is the article’s ethical thesis, not a statistical finding attributed to those sources.'),
);
pass(
  'Diary 10 distinguishes unequal contribution from moral exemption',
  d10.includes('Science can estimate different causal shares. It cannot convert a smaller share into moral nonexistence.'),
);
pass(
  'Diary 10 identifies the Derrida sentence as a project paraphrase',
  d10.includes('This sentence is a project paraphrase, not a verified quotation from Jacques Derrida.'),
);
pass(
  'Diary 10 links Diary 4 responsibility analysis',
  d10.includes('href="/polymyth/devilsdiary/4/"'),
);
pass(
  'Diary 10 cites both State of Wildfires reports',
  d10.includes('https://essd.copernicus.org/articles/16/3601/2024/index.html')
    && d10.includes('https://essd.copernicus.org/articles/17/5377/2025/index.html'),
);
pass(
  'Diary ledger exposes Entry 10',
  ledger.includes('href="/polymyth/devilsdiary/10/"')
    && ledger.includes('We Increased the Fire Risk'),
);
pass(
  'Diary 9 advances to Entry 10',
  pages.get(9).html.includes('href="/polymyth/devilsdiary/10/"'),
);

const allPrompts = [...promptSets.values()].flatMap(spec => spec.prompts);
pass('Trace names the complete question count', trace.includes('Twenty-six questions for the machine'));
pass(
  'Trace contains exactly ten diary question groups',
  (trace.match(/class="question-group"/g) || []).length === 10,
);
for (const prompt of allPrompts) {
  pass(`Trace contains exact prompt: ${prompt}`, trace.includes(prompt));
}

pass(
  'ML* contains the Mephistodata mirror criterion',
  method.includes('"t": "Mephistodata Ask your favourite AI mirror criterion"')
    && method.includes('FIVE GATES.')
    && method.includes('independent-thesis test'),
);
pass(
  'ML* contains the slogan/hivemindidiom lexical pairing rule',
  method.includes('"t": "Slogan/hivemindidiom lexical pairing rule"')
    && method.includes('slogans/hivemindidioms in the plural'),
);

for (const [number, {html}] of pages) {
  const allIds = ids(html);
  const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  pass(
    `Diary ${number} has unique HTML ids`,
    duplicates.length === 0,
    [...new Set(duplicates)].join(', '),
  );
  const missing = hrefFragments(html).filter(fragment => !allIds.includes(fragment));
  pass(
    `Diary ${number} fragment links resolve`,
    missing.length === 0,
    [...new Set(missing)].join(', '),
  );
}

for (const [label, html] of [
  ['Trace', trace],
  ['Diary ledger', ledger],
  ['Methodologylist', method],
]) {
  const allIds = ids(html);
  const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  pass(
    `${label} has unique HTML ids`,
    duplicates.length === 0,
    [...new Set(duplicates)].join(', '),
  );
  const missing = hrefFragments(html).filter(fragment => !allIds.includes(fragment));
  pass(
    `${label} fragment links resolve`,
    missing.length === 0,
    [...new Set(missing)].join(', '),
  );
}

const parityRoutes = [
  ...[...promptSets.keys()].map(number => `polymyth/devilsdiary/${number}/index.html`),
  'polymyth/devilsdiary/index.html',
  'polymyth/trace/index.html',
  'polymyth/methodologylist/index.html',
];
for (const rel of parityRoutes) {
  const publicRel = `public/${rel}`;
  if (fs.existsSync(path.join(root, publicRel))) {
    pass(`${rel} source/public mirrors match`, hash(rel) === hash(publicRel));
  }
}

if (failures.length) {
  console.error('POLYMYTH EDITORIAL PROMPT CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `POLYMYTH EDITORIAL PROMPT CHECK PASSED — ${checks.length}/${checks.length} checks, `
  + `${allPrompts.length} exact questions.`,
);
