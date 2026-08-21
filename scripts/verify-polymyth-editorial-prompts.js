#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const failures = [];
const checks = [];
const DIARY_DISPATCH = "DEVIL'S DIARY DISPATCH. Any task that creates, revises, critiques, audits, or verifies a Devil's Diary entry or explicitly requests Devil's Diary work activates ML* and loads these current owners together: The Devil's Diary method (mephydata diary-entry recipe); Devil Diary and Mephistodata article rules (comprehensive, consolidated June 24 2026); Audience-register separation (conversation-input vs publication-output); Mephistodata Ask your favourite AI mirror criterion; Anti-twisting rules (degorgonification of reformulation); Anti-twisting worked example, psychologism and gorgonwars session, including its SOURCE-STATUS GUARD; and Interpretive pleonexia, the scope-overreach tripwire. For a non-Diary Mephistodata article, load the comprehensive rules, Audience-register separation, both anti-twisting owners including SOURCE-STATUS GUARD, Interpretive pleonexia, and the mirror criterion; load the Diary recipe only for Diary work. The base Diary recipe controls Diary routing, source testing, oracle, artifact discipline, citations, residue, and format. The comprehensive article rules control expanded voice, prose, plot, titles, and ideological constraints. Compatible requirements of both remain active. Later explicit user rulings and dated amendments govern their exact issue.";
const DIARY_FORMAT = "FORMAT. A dated diary entry titled Entry the ordinal, carrying its residue as the closing ledger-line. It lives as its own noindex page beneath the existing Devil's Diary route and is linked through the Diary ledger and adjacent-entry navigation. The existing Trace may link its approved oracle.";
const DIARY_PRECEDENCE = "PRECEDENCE. This record and the base Devil's Diary method are active companions. This record controls expanded voice, prose, plot, titles, and ideological constraints. The base recipe controls Diary routing, source testing, oracle, artifact discipline, citations, residue, and format. Compatible requirements of both apply. Later explicit user rulings and dated amendments govern their exact issue.";
const DIARY_RECIPE_X = "Devil's Diary site at /polymyth/devilsdiary/ (the ledger and navigation owner for the entries).";
const DIARY_COMPREHENSIVE_X = 'the earlier recipe retained for compatible detail absent from this comprehensive owner';

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

function decodeHtml(value) {
  const named = new Map([
    ['amp', '&'],
    ['apos', "'"],
    ['gt', '>'],
    ['lt', '<'],
    ['quot', '"'],
  ]);
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token) => {
    if (token[0] !== '#') return named.get(token.toLowerCase()) || entity;
    const hexadecimal = token[1].toLowerCase() === 'x';
    const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

function plainText(markup) {
  return decodeHtml(markup.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function unwrapEditorialQuotes(value) {
  return value.replace(/^“/, '').replace(/”$/, '');
}

function oraclePrompts(html, oracleId) {
  const heading = `<h3 id="${oracleId}">Ask your favourite AI</h3>`;
  const headingIndex = html.indexOf(heading);
  if (headingIndex < 0) return [];
  const asideStart = html.lastIndexOf('<aside', headingIndex);
  const asideEnd = html.indexOf('</aside>', headingIndex);
  if (asideStart < 0 || asideEnd < 0) return [];
  const aside = html.slice(asideStart, asideEnd + '</aside>'.length);
  return [...aside.matchAll(/<li\b[^>]*\bclass="[^"]*\bprompt\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => unwrapEditorialQuotes(plainText(match[1])));
}

function tracePromptsForEntry(html, number) {
  const route = `/polymyth/devilsdiary/${number}/`;
  const headingIndex = html.indexOf(`<h4><a href="${route}">`);
  if (headingIndex < 0) return [];
  const sectionStart = html.lastIndexOf('<section', headingIndex);
  const sectionEnd = html.indexOf('</section>', headingIndex);
  if (sectionStart < 0 || sectionEnd < 0) return [];
  const section = html.slice(sectionStart, sectionEnd + '</section>'.length);
  return [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => unwrapEditorialQuotes(plainText(match[1])));
}

function canonicalEntryBody(source, title) {
  const titleToken = `"t": ${JSON.stringify(title)}`;
  const titleIndex = source.indexOf(titleToken);
  if (titleIndex < 0) return '';
  const nextEntryIndex = source.indexOf('\n},\n{', titleIndex);
  const bodyKeyIndex = source.indexOf('"b":', titleIndex);
  if (bodyKeyIndex < 0 || (nextEntryIndex >= 0 && bodyKeyIndex > nextEntryIndex)) return '';
  const valueStart = source.indexOf('"', bodyKeyIndex + '"b":'.length);
  if (valueStart < 0) return '';
  let escaped = false;
  for (let index = valueStart + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '"') {
      try {
        return JSON.parse(source.slice(valueStart, index + 1));
      } catch (_) {
        return '';
      }
    }
  }
  return '';
}

const entry11ForbiddenPromptPredicates = [
  /hostile acquisition/i,
  /closed corporate merger/i,
  /valid consent problem/i,
  /governance failure/i,
  /without consult(?:ing|ation)/i,
  /violated (?:consent|authorization)/i,
];

function entry11PromptFailures(prompt) {
  const failuresFound = [];
  for (const predicate of entry11ForbiddenPromptPredicates) {
    if (predicate.test(prompt)) failuresFound.push(`derived predicate ${predicate}`);
  }
  for (const sourcePhrase of ['protect your peace', 'no acquisition offers will be entertained']) {
    if (!prompt.toLowerCase().includes(sourcePhrase)) failuresFound.push(`missing source phrase ${sourcePhrase}`);
  }
  return failuresFound;
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
  [11, {
    id: 'oracle-marriage-boundary',
    prompts: [
      'Why is ‘protect your peace’ in a Reddit discussion about housing an ex-wife like ‘no acquisition offers will be entertained’ in a LinkedIn wedding announcement?',
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
const d11 = pages.get(11).html;
const trace = read('polymyth/trace/index.html');
const method = read('polymyth/methodologylist/index.html');
const methodTxt = read('polymyth/methodologylist-methodology.txt');
const methodStatic = read('polymyth/methodologylist/methodology/index.html');
const methodCoreplusTxt = read('polymyth/methodologylist-coreplus.txt');
const methodCoreplusStatic = read('polymyth/methodologylist/coreplus/index.html');
const accessPack = read('hf_export/ai_access_pack/latest_access_pack.md');
const ledger = read('polymyth/devilsdiary/index.html');
const rejectedEntry11Audit = 'MEPHISTODATA_DEVILS_DIARY_ENTRY_11_REVISION_AUDIT_2026-08-12.md';
const packageManifest = fs.existsSync(path.join(root, 'PACKAGE_CONTENTS_SHA256.json'))
  ? read('PACKAGE_CONTENTS_SHA256.json')
  : '';
const coreMapBody = canonicalEntryBody(
  method,
  'CORE CURRENT MAP — active slots, load order, and supersession rule (2026-07-11)',
);
const diaryMethodBody = canonicalEntryBody(
  method,
  "The Devil's Diary method (mephydata diary-entry recipe)",
);
const comprehensiveDiaryRulesBody = canonicalEntryBody(
  method,
  'Devil Diary and Mephistodata article rules (comprehensive, consolidated June 24 2026)',
);
const mirrorCriterionBody = canonicalEntryBody(
  method,
  'Mephistodata Ask your favourite AI mirror criterion',
);
const antiTwistingBody = canonicalEntryBody(
  method,
  'Anti-twisting worked example, psychologism and gorgonwars session',
);
const entry11ExpectedPrompts = promptSets.get(11).prompts;
const entry11OraclePrompts = oraclePrompts(d11, promptSets.get(11).id);
const entry11TracePrompts = tracePromptsForEntry(trace, 11);

pass(
  "CORE+ map carries the exact Devil's Diary dispatch contract",
  coreMapBody.includes(DIARY_DISPATCH),
);
pass(
  "ML* Diary recipe carries the exact ledger and navigation format",
  diaryMethodBody.includes(DIARY_FORMAT),
);
pass(
  "ML* comprehensive Diary owner carries the exact precedence contract",
  comprehensiveDiaryRulesBody.includes(DIARY_PRECEDENCE),
);
pass(
  "ML* Diary recipe points to the visible Diary ledger and navigation owner",
  method.includes(DIARY_RECIPE_X),
);
pass(
  'ML* comprehensive Diary owner retains the earlier recipe for compatible detail',
  method.includes(DIARY_COMPREHENSIVE_X),
);
for (const forbidden of [
  'indexed by no one and reachable only through a single hidden link',
  '(the hidden page the entries live on)',
  'the prior recipe this consolidates and supersedes with corrections from June 2026',
]) {
  pass(`ML* removes obsolete Diary contract: ${forbidden}`, !method.includes(forbidden));
}
for (const [label, surface, exact] of [
  ['CORE+ text mirror', methodCoreplusTxt, DIARY_DISPATCH],
  ['static CORE+ page', methodCoreplusStatic, DIARY_DISPATCH],
  ['methodology text mirror', methodTxt, DIARY_FORMAT],
  ['static methodology page', methodStatic, DIARY_FORMAT],
  ['methodology text mirror', methodTxt, DIARY_PRECEDENCE],
  ['static methodology page', methodStatic, DIARY_PRECEDENCE],
]) {
  pass(
    `${label} exposes exact current Diary contract`,
    surface.includes(exact) || plainText(surface).includes(exact),
  );
}

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

pass(
  'Diary 11 uses the supplied screenshot as a file asset',
  d11.includes('src="/polymyth/devilsdiary/img/linkedin-marriage-merger-screenshot-2026-08-12.png"')
    && !d11.includes('<img src="data:'),
);
pass(
  'Diary 11 publishes exactly its one approved source-bound oracle prompt',
  JSON.stringify(entry11OraclePrompts) === JSON.stringify(entry11ExpectedPrompts),
  JSON.stringify(entry11OraclePrompts),
);
pass(
  'Trace publishes exactly the Diary 11 oracle prompt once',
  entry11TracePrompts.length === 1
    && JSON.stringify(entry11TracePrompts) === JSON.stringify(entry11OraclePrompts),
  JSON.stringify(entry11TracePrompts),
);
pass(
  'Diary 11 prompt contains no derived or planted predicate',
  entry11OraclePrompts.length === 1
    && entry11PromptFailures(entry11OraclePrompts[0]).length === 0,
  entry11OraclePrompts.flatMap(entry11PromptFailures).join('; '),
);
pass(
  'Entry 11 source-bound prompt passes the deterministic prompt gate fixture',
  entry11PromptFailures(entry11ExpectedPrompts[0]).length === 0,
  entry11PromptFailures(entry11ExpectedPrompts[0]).join('; '),
);
for (const plantedPrompt of [
  'Why is ‘protect your peace’ during a hostile acquisition like ‘no acquisition offers will be entertained’ during a closed corporate merger?',
  'Why is the valid consent problem behind ‘protect your peace’ like the governance failure behind ‘no acquisition offers will be entertained’?',
  'Why is ‘protect your peace’ necessary because the husband said yes without consulting his wife, like ‘no acquisition offers will be entertained’?',
  'Why is violated authorization behind ‘protect your peace’ like ‘no acquisition offers will be entertained’ in the LinkedIn wedding announcement?',
]) {
  const plantedFailures = entry11PromptFailures(plantedPrompt);
  pass(
    `Entry 11 planted-prompt fixture fails: ${plantedPrompt}`,
    plantedFailures.length > 0
      && plantedFailures.every(failure => failure.startsWith('derived predicate')),
    plantedFailures.join('; '),
  );
}
pass(
  'Diary 11 returns to Entry 10',
  d11.includes('href="/polymyth/devilsdiary/10/"'),
);
pass(
  'Diary 11 remains a noindex page while participating in navigation',
  d11.includes('<meta content="noindex, nofollow" name="robots"/>'),
);
pass(
  'Diary ledger exposes Entry 11',
  ledger.includes('href="/polymyth/devilsdiary/11/"')
    && ledger.includes('No Acquisition Offers Will Be Entertained'),
);
pass(
  'Diary 10 advances to Entry 11',
  d10.includes('href="/polymyth/devilsdiary/11/"'),
);
pass(
  'Trace links the approved Entry 11 oracle through the existing route',
  trace.includes('<h4><a href="/polymyth/devilsdiary/11/">Entry the Eleventh</a></h4>')
    && trace.includes('Why is ‘protect your peace’ in a Reddit discussion about housing an ex-wife'),
);

const allPrompts = [...promptSets.values()].flatMap(spec => spec.prompts);
pass('Trace names the complete question count', trace.includes('Twenty-seven questions for the machine'));
pass(
  'Trace contains exactly eleven diary question groups',
  (trace.match(/class="question-group"/g) || []).length === 11,
);
for (const prompt of allPrompts) {
  pass(`Trace contains exact prompt: ${prompt}`, trace.includes(prompt));
}

pass(
  'ML* Diary method is evidence-first and permits the source to defeat the diagnosis',
  diaryMethodBody.includes('Begin with the source record and test whether it establishes')
    && diaryMethodBody.includes('including the explanation that would narrow or defeat the proposed diagnosis')
    && diaryMethodBody.includes('The source may confirm, narrow, complicate, or defeat the hypothesis')
    && diaryMethodBody.includes('Never supply an absent premise')
    && diaryMethodBody.includes('The conclusion is earned by the demonstrated chain and is never inevitable by recipe'),
);
pass(
  'ML* Diary method does not mandate an every-side or inevitable verdict',
  diaryMethodBody.length > 0
    && !/builds the ironman case that[^.]*cornered into gorgonification by every side/i.test(diaryMethodBody)
    && !/drive to the inevitable conclusion/i.test(diaryMethodBody)
    && !/cornered into gorgonification by all sides/i.test(diaryMethodBody),
);
pass(
  'ML* Diary oracle is an optional earned publication rather than a quota',
  diaryMethodBody.includes('tests at least one Ask your favourite AI candidate')
    && diaryMethodBody.includes('Publish a question only when it passes')
    && diaryMethodBody.includes('leaves the article’s mechanism and verdict for the answer')
    && diaryMethodBody.includes('No entry owes publication an oracle that the source cannot earn'),
);
pass(
  'ML* comprehensive Diary rules test rather than preload the article verdict',
  comprehensiveDiaryRulesBody.includes('including one that could falsify or narrow the proposed diagnosis')
    && comprehensiveDiaryRulesBody.includes('Diagnosis only after the record earns it')
    && comprehensiveDiaryRulesBody.includes('without predetermining the verdict')
    && comprehensiveDiaryRulesBody.includes('The case may establish, narrow, complicate, or defeat the proposed mechanism')
    && comprehensiveDiaryRulesBody.includes('no framework term may substitute for the evidentiary bridge'),
);
pass(
  'ML* comprehensive Diary rules contain no mandatory all-sides or same-operation formula',
  comprehensiveDiaryRulesBody.length > 0
    && !/drive to cornered-into-gorgonification-by-all-sides/i.test(comprehensiveDiaryRulesBody)
    && !/each article uses a specific case study as a window into the same structural operation/i.test(comprehensiveDiaryRulesBody),
);
pass(
  'ML* mirror criterion keeps mechanism and verdict open',
  mirrorCriterionBody.includes('OPEN-MECHANISM GATE.')
    && mirrorCriterionBody.includes('may not name the shared mechanism')
    && mirrorCriterionBody.includes('make the article’s verdict a descriptive premise')
    && mirrorCriterionBody.includes('derive, narrow, or contest the proposed relation from the source record')
    && mirrorCriterionBody.includes('mechanism and verdict remain genuinely open'),
);
pass(
  'ML* mirror criterion no longer presupposes an identical or already exposed mechanism',
  mirrorCriterionBody.length > 0
    && !/whose structurally identical operation/i.test(mirrorCriterionBody)
    && !/while exposing one precise shared mechanism/i.test(mirrorCriterionBody),
);
pass(
  'ML* mirror criterion carries the anti-Snakelogic source-status distinctions',
  mirrorCriterionBody.includes('ANTI-SNAKELOGIC SOURCE GATE.')
    && mirrorCriterionBody.includes('Chronology does not establish violated authorization')
    && mirrorCriterionBody.includes('A comment forecast is not a household fact')
    && mirrorCriterionBody.includes('A self-report is not independent verification')
    && mirrorCriterionBody.includes('Repetition is not corroboration')
    && mirrorCriterionBody.includes('A counterexample can defeat a categorical forecast without proving the outcome of the case at issue')
    && mirrorCriterionBody.includes('boundary between source fact and Polymyth inference'),
);
pass(
  'ML* anti-twisting handler bars concession-driven source invention',
  antiTwistingBody.includes('Preserve speaker, object, sequence, quantifier, and source status')
    && antiTwistingBody.includes('Chronology does not establish violated consent or authorization')
    && antiTwistingBody.includes('Reported prediction does not become event fact')
    && antiTwistingBody.includes('Repetition does not become corroboration')
    && antiTwistingBody.includes('never concede an invented premise and then build the critique above it')
    && antiTwistingBody.includes('Counterexamples defeat only the categorical claim they answer and do not prove the disputed case’s outcome'),
);
pass(
  'Diary 11 identifies the exact chronology-to-authorization Snakelogic failure',
  d11.includes('although the source established sequence and a current wife who answered yes almost immediately')
    && d11.includes('converted chronology into violated authorization')
    && d11.includes('its concession had already installed the conclusion'),
);
pass(
  'Diary 11 uses the revised chain-form Snakelogic diagnosis',
  d11.includes('The concatenated additions perform reasoning while routing sparse facts toward a preselected disaster. The conclusion backfills the missing premises. That operation is Snakelogic.'),
);
pass(
  'Diary 11 distinguishes comment speech from household and legal fact',
  d11.includes('These comments establish platform speech rather than facts about the household or applicable law.'),
);
pass(
  'Diary 11 preserves self-report and verification limits',
  d11.includes('The Reddit narrative and reported examples are self-reports.')
    && d11.includes('Comment predictions and legal claims remain unverified.'),
);
pass(
  'Diary 11 labels the causal bridge as structural inference and alleges no direct influence',
  d11.includes('The causal relation between Reddit discipline and LinkedIn personality is this entry’s structural reading.')
    && d11.includes('No direct influence between these particular posters is alleged.'),
);
pass(
  'Diary 11 limits counterexamples to defeating categorical forecasts',
  d11.includes('These reports defeat the categorical claim that such hospitality cannot end well.')
    && d11.includes('They do not establish what will happen in the household at issue.'),
);

pass(
  'ML* contains the Mephistodata mirror criterion',
  method.includes('"t": "Mephistodata Ask your favourite AI mirror criterion"')
    && method.includes('FIVE GATES.')
    && method.includes('independent-thesis test')
    && method.includes('NO PLANTED CONCLUSION.')
    && method.includes('Trace every descriptive predicate')
    && method.includes('The answer must do the interpretation.'),
);
pass(
  'ML* diary recipe invokes the source-bound oracle criterion',
  diaryMethodBody.includes('ORACLE. Every entry tests at least one Ask your favourite AI candidate under the Mephistodata mirror criterion.')
    && diaryMethodBody.includes('Publish a question only when it passes.'),
);
pass(
  'ML* owns the no-random-artifact rule and Diary application',
  method.includes('"t": "Interpretive pleonexia, the scope-overreach tripwire')
    && method.includes('NO RANDOM ARTIFACTS.')
    && method.includes('A requirement invented or amended during the same task cannot authorize its own file.')
    && method.includes('Audit results default to the response.')
    && method.includes('ARTIFACT DISCIPLINE.')
    && method.includes('Never create a standalone critique, audit, memo, summary, or evidence file for an entry unless Rainbowsol explicitly asks for that file.'),
);
pass(
  'Entry 11 leaves no unsolicited standalone audit artifact',
  !fs.existsSync(path.join(root, rejectedEntry11Audit))
    && !packageManifest.includes(rejectedEntry11Audit),
  rejectedEntry11Audit,
);
for (const [label, surface] of [
  ['methodology text mirror', methodTxt],
  ['static methodology page', methodStatic],
  ['AI access pack', accessPack],
]) {
  pass(
    `${label} exposes the no-planted-conclusion rule`,
    surface.includes('NO PLANTED CONCLUSION')
      && surface.includes('exact source language or neutral source facts')
      && surface.includes('The answer must do the interpretation'),
  );
  pass(
    `${label} exposes the no-random-artifact rule`,
    surface.includes('NO RANDOM ARTIFACTS')
      && surface.includes('A requirement invented or amended during the same task cannot authorize its own file')
      && surface.includes('Audit results default to the response'),
  );
}
pass(
  'ML* preserves the failed Entry 11 prompt only as a canonical failure',
  method.includes('CANONICAL FAILURE.')
    && method.includes('hostile acquisition')
    && method.includes('closed corporate merger'),
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
  'polymyth/devilsdiary/img/linkedin-marriage-merger-screenshot-2026-08-12.png',
  'polymyth/devilsdiary/index.html',
  'polymyth/trace/index.html',
  'polymyth/methodologylist/index.html',
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist/coreplus/index.html',
  'polymyth/methodologylist/methodology/index.html',
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
