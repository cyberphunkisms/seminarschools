#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const root = path.resolve(__dirname, '..');
const canonicalPath = path.join(root, 'polymyth/methodologylist/index.html');
const canonicalHtml = fs.readFileSync(canonicalPath, 'utf8');
const entries = parseSeedWithAddenda(canonicalHtml);

function fail(message) {
  throw new Error(`ML* Gorgonwars premise-split guard failed: ${message}`);
}

function entry(title) {
  const matches = entries.filter((candidate) => candidate.t === title);
  if (matches.length !== 1) {
    fail(`expected one entry titled “${title}”; found ${matches.length}`);
  }
  return matches[0];
}

function requirePhrases(subject, label, phrases) {
  for (const phrase of phrases) {
    if (!subject.includes(phrase)) fail(`${label} is missing “${phrase}”`);
  }
}

function verifySha256(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (!fs.existsSync(absolutePath)) fail(`missing artifact ${relativePath}`);
  if (!fs.existsSync(sidecarPath)) fail(`missing checksum ${relativePath}.sha256`);
  const expected = fs.readFileSync(sidecarPath, 'utf8').trim().split(/\s+/)[0];
  const actual = crypto
    .createHash('sha256')
    .update(fs.readFileSync(absolutePath))
    .digest('hex');
  if (expected !== actual) {
    fail(`${relativePath} SHA-256 mismatch: ${actual} != ${expected}`);
  }
  return actual;
}

const classifierTitle =
  'Gorgonwars premise classifier for feminist and MeToo criticism';
const classifier = entry(classifierTitle);
requirePhrases(classifier.b, classifierTitle, [
  'EXCOMMUNICABLE / OUTSIDE',
  'INTERNAL GORGONWARS',
  'UNRESOLVED',
  'one rejection is sufficient',
  'standpoint epistemology + the personal is political = commodification of emotional labor through neoliberal cost-benefit analysis',
  'The AI-authored direct-evidence gate below is a conservative audit method, not a redefinition of Polymyth',
  'DIRECT-EVIDENCE AUDIT METHOD',
  'authorial adoption of the named premise or an explicitly stated equivalent',
  'an explicitly stated position demonstrably incompatible with it',
  'an explicit grant of epistemic privilege, authority, rank, or veto',
  'AI-PROPOSED NARROWER TEST, UNRATIFIED AND NON-CONTROLLING',
  'The operator did not ratify that definition',
  'It cannot override this audit method',
  'Testimony, interviews, first-person narrative',
  'due-process, liberal, or MeToo criticism alone establishes no premise position',
  'One author never establishes a school',
  'Premise membership is separate from dialectic',
  'The first 129-row split was 90 INTERNAL, 38 UNRESOLVED, and 1 provisional OUTSIDE',
  'It is withdrawn',
  '0 EXCOMMUNICABLE / OUTSIDE, 1 INTERNAL GORGONWARS, and 128 UNRESOLVED',
  'V092 is Sara Clarke-Vivier and Clio Stearns',
  'article page 58, PDF page 4',
  'article page 60, PDF page 6',
  'https://journal.jctonline.org/index.php/jct/article/download/827/417/2913',
  'those passages support Retains / Retains',
  'WITHDRAWN CANDIDATES',
  'V045’s Tarana Burke epigraph',
  'without proving Gaillard grants identity-based credibility',
  'V110, David García-Ramos',
  'Unstated / Unstated / UNRESOLVED',
  'White-feminism, carceral-feminism, anti-carceral',
  'DOI 10.24197/redd.5.2022.43-66',
  'https://revistas.uva.es/index.php/redd/en/article/view/7115',
  'metoo-critical-academic-premise-audit-2026-07-27.xlsx',
  'metoo-critical-academic-premise-audit-2026-07-27.jsonl',
  'metoo-critical-academic-premise-audit-WITHDRAWN-90-38-1-2026-07-27.xlsx',
  'metoo-critical-academic-premise-audit-WITHDRAWN-90-38-1-2026-07-27.jsonl',
  'The withdrawn files preserve every old row and do not revive it',
  'If PIP = Rejects OR Standpoint = Rejects',
  'Else if PIP = Retains AND Standpoint = Retains',
  'Else return UNRESOLVED',
]);

const gorgonwars = entry('Gorgonwars');
requirePhrases(gorgonwars.b, 'Gorgonwars', [
  'Standpoint epistemology + the personal is political = commodification of emotional labor through neoliberal cost-benefit analysis',
  'ALMOST BY DESIGN',
  'FUNCTIONAL EXCOMMUNICATION',
  'unsettled political subject',
  'essentialism bind',
  'GALLIE FOIL AND NO-POPE SNAKELOGIC',
  'MOVING GOALPOSTS',
  'INTERRUPTION TEST',
  'FRASER STATUS',
  'LEHRMAN STATUS',
  'the operator proposed that Lehrman might be a Hegelianegirl',
  'This is a user-set tentative Polymyth hypothesis',
  'functional excommunication and a moving taxonomic frontier',
  'Baehr’s cited primary pages remain uninspected',
  'It does not transfer to Christina Hoff Sommers',
  'USER-SET GORGONIFICATION CLASS AND HYDRA SNOWBALLING',
  'Credentialism, the replication crisis, scientism, diploma mills, Zionism, legalism, feminism, and psychologism are each classified by Polymyth as gorgonifications',
  'Double Down Gorgonification, also called Snakelogic snowballing',
  'the never-ending head-chopping relation Hercules faces',
  'This user-set classification establishes no fixed ordering among the heads',
  'POLYMYTH CLAIM; EXTERNAL VALIDATION DEFERRED',
  'this evidentiary debt does not erase the system claim',
  'External demographic validation remains deferred; the system claim does not',
  'external demographic validation of Polymyth’s fertility claim',
  'BESIEGED-COALITION TLDR',
  'FORTY-TWO-PRESSURE SOURCE/SYSTEM MATRIX',
  'The system tests and rejects this as a root objection',
  'which accepted feminisms reject standpoint epistemology',
  'omg its 2025 and we still have to xyz',
  'The user’s system counterclaim that four decades repeat the same Hivemindidioms is preserved rather than withdrawn',
  'dated-corpus validation remains owed',
  'The UN Women data-skew allegation remains unverified',
  '“MeToo killed Occupy” as a causal history',
  'SOURCE BOUNDARY',
  "preserves DD9's 42 source/system rows and 27 notes",
  'scoped to DD9 and is not a complete ledger of the whole conversation',
  'gorgonwars-conversation-source-ledger-2026-07-27.txt',
]);
const pressureLabels = Array.from(
  gorgonwars.b.matchAll(/\n([1-9]|[1-3][0-9]|4[0-2])\. \[([^\]]+)\] /g),
  (match) => ({number: Number(match[1]), label: match[2]}),
);
if (pressureLabels.length !== 42) {
  fail(`Gorgonwars source/system matrix has ${pressureLabels.length}/42 labels`);
}
for (let index = 0; index < pressureLabels.length; index += 1) {
  if (pressureLabels[index].number !== index + 1) {
    fail(`Gorgonwars pressure matrix is out of order at row ${index + 1}`);
  }
}
for (const [row, expected] of [
  [8, 'EXTERNAL · SYSTEM-TESTED; REJECTED AS ROOT OBJECTION'],
  [25, 'SYSTEM · RANK 5 HYPOTHESIS'],
  [26, 'SYSTEM · RANK 5'],
  [27, 'SYSTEM · RANK 5 HYPOTHESIS'],
  [28, 'SYSTEM · RANK 5'],
  [35, 'SYSTEM · RANK 5 HYPOTHESIS'],
  [36, 'SYSTEM · RANK 5'],
  [
    41,
    'EXTERNAL CLAIM REJECTED / SYSTEM-USER COUNTERCLAIM; DATED-CORPUS VALIDATION OWED',
  ],
]) {
  const actual = pressureLabels[row - 1]?.label;
  if (actual !== expected) {
    fail(`Gorgonwars pressure ${row} label is “${actual}”, expected “${expected}”`);
  }
}

const credentialism = entry('Credentialism');
requirePhrases(credentialism.b, credentialism.t, [
  'Credentialism is classified by Polymyth as a gorgonification',
  'substitutes title, degree, institutional rank, or credentialed permission',
  'This is an operation-level classification',
  'Double Down Gorgonification',
  'the replication crisis, or diploma mills',
]);

const hydra = entry('Hydra');
requirePhrases(hydra.b, hydra.t, [
  'USER-SET GORGONIFICATION CLASS',
  'Credentialism, the replication crisis, scientism, diploma mills, Zionism, legalism, feminism, and psychologism are each classified by Polymyth as gorgonifications',
  'DOUBLE DOWN GORGONIFICATION, also called Snakelogic snowballing',
  'the never-ending head-chopping relation Hercules faces',
  'This classification establishes no fixed ordering among the heads',
  'Named claims about credentialism, scientism, replication, diploma mills, institutions, or data still require source evidence',
]);

const retired = entry(
  '“Gorgonified feminism” qualifier-TWIST audit (retired third-head label)',
);
requirePhrases(retired.b, retired.t, [
  'RETIRED TERM',
  'changes the accused into an aberrant subtype and invents a clean remainder',
  'The third head is feminism as Gorgon operation',
  'The architecture is the Gorgon field. Gorgonification is the capture process',
  'Whenever “gorgonified feminism” is deployed as an operative qualifier, it is Snakelogic',
  'Metalinguistic quotation that identifies or audits the retired phrase does not redeploy it',
  'Every older unquoted occurrence of “gorgonified feminism” loses doctrinal authority',
]);

const snakelogic = entry('Snakelogic');
requirePhrases(snakelogic.b, 'Snakelogic', [
  'move (or chain of moves)',
  'CHAIN form',
  'SINGLE-MOVE form',
]);
entry(
  'Snakelogic example: Power-Before-P0 Hydra (AI insertion grows from critique into root premise, July 2026)',
);
entry(
  'Snakelogic example: “gorgonified feminism” as qualifier-TWIST (redundancy preserves the framework being criticized, July 2026)',
);

const gorgonlogic = entry('Gorgonlogic (discharge without operator thinking)');
requirePhrases(gorgonlogic.b, gorgonlogic.t, [
  'Gorgonlogic is automatic discharge',
  'Surface length determines neither Gorgonlogic nor Snakelogic',
  'canonical Snakelogic entry already permits a single move or a chain',
  'has not ratified a complete exclusivity-or-overlap ontology',
  'do not assert that every Snakelogic move is Gorgonlogic',
  'The operator classified “gorgonified feminism” as Snakelogic',
  'Whether the same occurrence may also receive the Gorgonlogic label remains unratified',
  'Cluster-discharge',
]);

const legalism = entry(
  'Legalism as fourth head of the demogorgon (Leviathan grows through definitional expansion)',
);
requirePhrases(legalism.b, legalism.t, [
  'Legalism-as-gorgonification is user-ratified',
  'numbered “fourth head” ordering remains an earlier AI proposal',
  'not a ratified final ontology',
  'GORGONLOGIC / SNAKELOGIC STATUS',
  '“It is the law” functions as Gorgonlogic',
  'Legalism functions as Snakelogic when one move or a chain',
  'Surface length alone determines neither category',
  'remains unratified',
]);
requirePhrases(legalism.tg, `${legalism.t} tags`, [
  'user-ratified-legalism-as-gorgonification',
  'fourth-head-ordering-ai-proposed-unratified',
]);
if (legalism.tg.split(',').map((tag) => tag.trim()).includes('AI-PROPOSED-fourth-head')) {
  fail('Legalism still has the stale undifferentiated AI-PROPOSED-fourth-head tag');
}

const arendtian = entry('Arendtianfeminism');
requirePhrases(arendtian.b, 'Arendtianfeminism', [
  'rejects standpoint as epistemic rank',
  'rejects “the personal is political” as limitless jurisdiction over private life',
  'The established Arendtianfeminism definition above remains controlling',
  'is not silently replaced by an assistant operationalization',
  'Record only the article-level premise evidence',
  'remains unratified and does not redefine this entry',
  'Arendt did not literally answer Hanisch',
  'framework coinage rather than a verified central feminist school',
  'Rejecting either root is enough for EXCOMMUNICABLE / OUTSIDE',
  'Arendtianfeminism is stricter because it rejects both',
]);

const sexwork = entry(
  '"Sexworkisrealwork" (three-layered hivemindidiom, gorgonwars substrate)',
);
requirePhrases(sexwork.b, sexwork.t, [
  'COMMODIFIED EMOTIONAL LABOR',
  'Agency can operate inside exploitation',
  'NO FACTION SHORTCUT',
  'Karen Lehrman',
  'The inspected Baehr source does not show Lehrman using the exact phrase',
  'Christina Hoff Sommers',
]);

const emotionalLabor = entry(
  'Emotional labor prostitution (commodification of mutual obligation into priced service)',
);
requirePhrases(emotionalLabor.b, emotionalLabor.t, [
  'IN-THE-WILD RULE',
  'Hochschild',
  'does not control this project',
  'DICTIONARY-DEFINITION GORGONIFICATION',
  'white feminism, carceral feminism',
]);

const standpoint = entry(
  'Standpoint epistemology (canonical training-data gorgonification)',
);
requirePhrases(standpoint.b, standpoint.t, [
  'POLYMYTH DOCTRINE',
  'standpoint epistemology is a founding Gorgonwars pillar',
  'privileged credibility, authority, epistemic rank, or veto',
  'does not narrow the system term to a protected subtype',
  'SOURCE-ATTRIBUTION BOUNDARY',
  'Every categorical claim below remains a Polymyth claim unless direct passages establish it for a named work',
  'The genealogy, universalism, and independent-traditions arguments are therefore Polymyth claims',
  'No named source may be made to carry the whole synthesis without work-specific passages',
  'POLYMYTH GENEALOGY, UNIVERSALISM, AND INDEPENDENT-TRADITIONS CLAIMS',
  'POLYMYTH CLAIM: DENIES UNIVERSALISM',
  'Pils and Schoenegger compare epistemological similarities',
  'Polymyth extends that narrower comparison',
]);

const hegelianegirl = entry(
  'Hegelianegirl-rising-as-aufheben (dual-substrate sublation)',
);
requirePhrases(hegelianegirl.b, hegelianegirl.t, [
  'JULY 2026 HISTORY AND CORRECTION',
  'where the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus',
  "The numbered trauma → personal-is-political → hivemindidioms → bread-and-circus expansion is the AI's four-stage mapping",
  'Stage 2 above remains visible as historical mapping and is not silently rewritten',
  '“the personal is political” is defective at the root',
  'later hivemindidiom capture, credentialing, and spectacle intensify and enforce that defect rather than creating it',
  'The exact quoted sentence',
  "The numbered four-stage expansion is the AI's historical mapping",
  'not additional user wording',
]);
if (
  hegelianegirl.b.includes(
    'The four-stage bread-and-circus chain (trauma → personal-is-political → hivemindidioms → bread-and-circus) is verbatim user formulation.',
  )
) {
  fail('Hegelianegirl still falsely calls the four-stage AI mapping verbatim user wording');
}

const actionDiagnostic = entry(
  'Action-verbs vs diagnostic-verbs distinction (philosopher-stack discipline)',
);
requirePhrases(actionDiagnostic.b, actionDiagnostic.t, [
  'VERBATIM USER SENTENCE',
  'where the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus',
  'AI-PROVENANCE SEAM',
  "Reading that sentence as a four-stage diagnostic chain is the AI's mapping",
  'not additional user wording',
]);
if (
  actionDiagnostic.b.includes(
    `Verbatim user-voice on the seam: "the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus" — the four-stage diagnostic chain`,
  )
) {
  fail('Action/diagnostic entry still fuses the user sentence with the AI four-stage mapping');
}

const gay = entry('Gay, Roxane. Bad Feminist (2014)');
requirePhrases(gay.b, gay.t, [
  'unverified paraphrase',
  'must not be quoted or treated as Gay’s wording',
  '300-point extraction point 168',
  'project history',
]);

const mackinnonDworkin = entry(
  'MacKinnon, Catharine / Dworkin, Andrea (radical feminist anti-pornography)',
);
requirePhrases(mackinnonDworkin.b, mackinnonDworkin.t, [
  'belongs to Polymyth',
  'does not establish that every work by either author',
  'python mode 1, stasis',
  'Sexworkisrealwork idiomary entry',
]);

const noDefault = entry('No-default-feminist-frame rule');
requirePhrases(noDefault.b, noDefault.t, [
  'only when the operator requests them',
  'when the user’s requested object is the framework itself',
  "never enter as the assistant's silent moral baseline",
  'SYSTEM-FIRST RULE',
  "Using Hochschild's historical definition to police vernacular emotional labor",
  'Softening feminism into “gorgonified feminism.”',
  'Answer the actual requested system and object',
]);

const sourceLedger = entry(
  'Devil’s Diary Entry 9 source/status ledger (42 pressures, 27 notes)',
);
requirePhrases(sourceLedger.b, sourceLedger.t, [
  "DD9's forty-two-pressure System/External/Synthesis/Hypothesis/Unresolved matrix",
  "all twenty-seven of DD9's notes",
  'It is not a complete ledger of the entire conversation',
  'does not contain the separate 129-row MeToo audit',
  'gorgonwars-conversation-source-ledger-2026-07-27.txt',
  '0be76da842e8da15749fdce6b93c36e7754f67a134f87bb52985c2bc897be95d',
  'distinguishes external sources from Polymyth synthesis',
]);

const audit49 = entry(
  'Audit49 external-validation boundary after technical-efficiency audit',
);
requirePhrases(audit49.b, audit49.t, [
  'Branded Firefox',
  'Native Safari',
  'VoiceOver',
  'NVDA',
  'Physical iPhone and Android',
  'Real-user sessions',
  'Google, Apple, and Outlook calendar imports',
  'Post-deployment calendar refresh',
  'reachable protest browser/OCR run',
  'authorized festival paid-agent run',
  'A security audit remained outside the chosen scope',
  'optional future performance-splitting candidates rather than unfinished audits',
]);

const metooOccupy = entry('Metoo killed Occupy (movement-capture worked example)');
requirePhrases(metooOccupy.b, metooOccupy.t, [
  'USER CLAIM UNDER EVIDENTIARY AUDIT',
  'current record does not establish this causal displacement',
  'Each causal arrow requires evidence before assertion',
]);

const threeWay = entry(
  'Three-way distinction: dialectic / gorgon-versus-dialectician / gorgonwars (operational, not ideological)',
);
requirePhrases(threeWay.b, threeWay.t, [
  'came from one personal blog',
  'It cannot represent Butler',
  'Encounter conduct and system membership are separate axes',
  'Never infer premise positions from tone',
]);

const antiTwist = entry(
  'Anti-twisting worked example, psychologism and gorgonwars session',
);
requirePhrases(antiTwist.b, antiTwist.t, [
  'The assistant imposed an external feminist framework',
  'Gallie is an external foil',
  'dictionary-definition strawman',
  'One author never establishes a school',
  'Karen Lehrman and Christina Hoff Sommers',
  'Missing evidence is a result',
]);

if (
  entries.some(
    (candidate) =>
      candidate.t === 'Gorgonified feminism (third head of the demogorgon)',
  )
) {
  fail('the contradictory active “Gorgonified feminism” title returned');
}

const forbiddenActivePhrases = [
  'feminism-as-gorgonified-operation',
  'Feminism as gorgonified operation',
  'feminism-as-gorgonified',
  'Gorgonified feminism converts structural claims',
  'enforces the gorgonified feminist framework',
  'exists for gorgonified feminism to look',
];
const activeCorpus = entries
  .map((candidate) =>
    [candidate.t, candidate.b, candidate.x].filter(Boolean).join('\n'),
  )
  .join('\n');
for (const phrase of forbiddenActivePhrases) {
  if (activeCorpus.includes(phrase)) {
    fail(`retired operational phrase remains active: “${phrase}”`);
  }
}

const jsonlPath =
  'polymyth/research/metoo-critical-academic-premise-audit-2026-07-27.jsonl';
verifySha256(jsonlPath);
verifySha256(
  'polymyth/research/metoo-critical-academic-premise-audit-2026-07-27.xlsx',
);
const withdrawnJsonlPath =
  'polymyth/research/metoo-critical-academic-premise-audit-WITHDRAWN-90-38-1-2026-07-27.jsonl';
verifySha256(withdrawnJsonlPath);
verifySha256(
  'polymyth/research/metoo-critical-academic-premise-audit-WITHDRAWN-90-38-1-2026-07-27.xlsx',
);
const records = fs
  .readFileSync(path.join(root, jsonlPath), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
if (records.length !== 129) fail(`MeToo JSONL has ${records.length}/129 rows`);
const expectedClassifier = {
  version: 'direct-evidence-premise-reaudit-2026-07-27',
  status:
    'AI-authored conservative audit method; not a definition or replacement of Polymyth’s two premises.',
  personal_is_political:
    'Retains only with explicit affirmation or use of “the personal is political” as a premise, or a demonstrably equivalent root-level claim. Rejects only on direct rejection or demonstrable incompatibility. Otherwise Unstated.',
  standpoint_epistemology:
    'Retains only with explicit affirmation or an explicit grant of epistemic credibility, authority, rank, or veto to identity, social position, or lived experience. Rejects only on direct rejection or demonstrable incompatibility. Otherwise Unstated. Testimony or interviews alone establish neither premise.',
};
const counts = new Map();
for (const record of records) {
  counts.set(record.split, (counts.get(record.split) || 0) + 1);
  if (record.classifier?.version !== expectedClassifier.version) {
    fail(`${record.id} does not use the direct-evidence classifier`);
  }
  if (
    record.classifier.status !== expectedClassifier.status ||
    record.classifier.personal_is_political !==
      expectedClassifier.personal_is_political ||
    record.classifier.standpoint_epistemology !==
      expectedClassifier.standpoint_epistemology
  ) {
    fail(`${record.id} classifier text diverges from the controlling audit rule`);
  }
  if (
    !record.withdrawn_prior ||
    record.withdrawn_prior.audit?.status !== 'WITHDRAWN'
  ) {
    fail(`${record.id} does not preserve its row-level withdrawn classification`);
  }
}
if ((counts.get('EXCOMMUNICABLE / OUTSIDE') || 0) !== 0) {
  fail('MeToo JSONL outside count is not 0');
}
if ((counts.get('INTERNAL GORGONWARS') || 0) !== 1) {
  fail('MeToo JSONL internal count is not 1');
}
if ((counts.get('UNRESOLVED') || 0) !== 128) {
  fail('MeToo JSONL unresolved count is not 128');
}
const byId = new Map(records.map((record) => [record.id, record]));
for (const id of ['V045', 'V110', 'V113']) {
  const record = byId.get(id);
  if (
    !record ||
    record.pip !== 'Unstated' ||
    record.standpoint !== 'Unstated' ||
    record.split !== 'UNRESOLVED'
  ) {
    fail(`${id} is not Unstated / Unstated / UNRESOLVED`);
  }
}
const v092 = byId.get('V092');
if (
  !v092 ||
  v092.pip !== 'Retains' ||
  v092.standpoint !== 'Retains' ||
  v092.split !== 'INTERNAL GORGONWARS'
) {
  fail('V092 is not Retains / Retains / INTERNAL GORGONWARS');
}
requirePhrases(v092.evidence, 'V092 current evidence', [
  'journal p. 58',
  'relies on the same ideology',
  'On p. 60',
  'in part because of our own survivorship',
  'The first directly retains personal-is-political',
  'retaining standpoint under this audit rule',
]);
requirePhrases(v092.evidenceUrls, 'V092 evidence URLs', [
  'https://journal.jctonline.org/index.php/jct/article/download/827/417/2913',
]);

const withdrawnRecords = fs
  .readFileSync(path.join(root, withdrawnJsonlPath), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
if (withdrawnRecords.length !== 129) {
  fail(`withdrawn MeToo JSONL has ${withdrawnRecords.length}/129 rows`);
}
const withdrawnCounts = new Map();
const withdrawnById = new Map();
for (const record of withdrawnRecords) {
  if (record.withdrawn_audit?.status !== 'WITHDRAWN') {
    fail(`${record.id} is not marked WITHDRAWN in the historical audit`);
  }
  withdrawnCounts.set(record.split, (withdrawnCounts.get(record.split) || 0) + 1);
  withdrawnById.set(record.id, record);
}
for (const [label, expected] of [
  ['EXCOMMUNICABLE / OUTSIDE', 1],
  ['INTERNAL GORGONWARS', 90],
  ['UNRESOLVED', 38],
]) {
  const actual = withdrawnCounts.get(label) || 0;
  if (actual !== expected) {
    fail(`withdrawn MeToo ${label} count is ${actual}, expected ${expected}`);
  }
}
for (const record of records) {
  const prior = withdrawnById.get(record.id);
  if (!prior) fail(`${record.id} is absent from the withdrawn row ledger`);
  for (const field of [
    'split',
    'pip',
    'standpoint',
    'confidence',
    'evidence',
    'evidenceUrls',
  ]) {
    if (record.withdrawn_prior[field] !== prior[field]) {
      fail(`${record.id} withdrawn_prior.${field} does not match the withdrawn ledger`);
    }
  }
}
const ledgerHash = verifySha256(
  'polymyth/research/gorgonwars-conversation-source-ledger-2026-07-27.txt',
);
if (
  ledgerHash !==
  '0be76da842e8da15749fdce6b93c36e7754f67a134f87bb52985c2bc897be95d'
) {
  fail(`conversation ledger hash changed unexpectedly: ${ledgerHash}`);
}
const ledgerText = fs.readFileSync(
  path.join(
    root,
    'polymyth/research/gorgonwars-conversation-source-ledger-2026-07-27.txt',
  ),
  'utf8',
);
requirePhrases(ledgerText, 'Gorgonwars conversation source/status ledger', [
  'DEVIL’S DIARY ENTRY 9, SOURCE AND STATUS LEDGER',
  'Scoped to Devil’s Diary Entry 9: its 42-pressure matrix and 27 notes',
  'This is not a complete ledger of the entire conversation or the separate MeToo corpus',
  'System · claim; external validation deferred',
  'this evidentiary debt does not erase the system claim',
  'External · rejected as cause; no-pope Snakelogic',
  'merely restates that no decree settles the dispute',
  'receives no external evidentiary conclusion',
  'does not cancel Polymyth’s stated system refutation',
  'POLYMYTH SYNTHESIS FROM ARENDT; EXACT PRIMARY-PASSAGE VERIFICATION PENDING',
  'Polymyth reads these works as a counterarchitecture',
  'The exact passages needed to verify the “lifetime’s architecture” formulation remain pending',
  'External · system-tested; rejected as root objection',
  'omg its 2025 and we still have to xyz',
  'System-user counterclaim; dated-corpus validation owed',
  'is preserved rather than withdrawn',
]);

const dd9Html = fs.readFileSync(
  path.join(root, 'polymyth/devilsdiary/9/index.html'),
  'utf8',
);
requirePhrases(dd9Html, 'Devil’s Diary Entry 9', [
  'Surface length decides neither category',
  'Whether one occurrence may carry both labels remains unratified',
  'Whenever deployed as that operative qualifier, it is Snakelogic',
  'Any additional Gorgonlogic label remains unratified',
  'political jurisdiction across personal relations and experience',
  'testimony or evidence alone proves neither root',
  'Polymyth synthesis from Arendt; exact primary-passage verification pending',
  'This is the system’s synthesis from Arendt, not her answer to Hanisch',
  'External survey; Polymyth inference separated',
  'Narrow external comparison; Polymyth extension',
  'omg its 2025 and we still have to xyz',
  'External · system-tested; rejected as root objection',
  'System-user counterclaim; dated-corpus validation owed',
  'is preserved rather than withdrawn',
  'The inspected Baehr source does not show Lehrman using the later slogan',
  'System · claim; external validation deferred',
  'External · rejected as cause; no-pope Snakelogic',
]);
for (const [label, text] of [
  ['Devil’s Diary Entry 9', dd9Html],
  ['DD9 source/status ledger', ledgerText],
]) {
  for (const phrase of [
    'self-authorizing political warrant',
    'presumptive jurisdiction',
    'publicly contestable reasons',
  ]) {
    if (text.includes(phrase)) {
      fail(`${label} still contains the unratified phrase “${phrase}”`);
    }
  }
}

const mirrorFiles = [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-gorgonification.txt',
  'polymyth/methodologylist-degorgonification.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist-citation.txt',
  'polymyth/methodologylist-pending.txt',
];
const mirrorPhrases = [
  classifierTitle,
  '0 EXCOMMUNICABLE / OUTSIDE, 1 INTERNAL GORGONWARS, and 128 UNRESOLVED',
  '“Gorgonified feminism” qualifier-TWIST audit (retired third-head label)',
  'No-default-feminist-frame rule',
  'Devil’s Diary Entry 9 source/status ledger (42 pressures, 27 notes)',
  'Audit49 external-validation boundary after technical-efficiency audit',
  'Arendtianfeminism',
  'IN-THE-WILD RULE',
  'Karen Lehrman and Christina Hoff Sommers',
  'the operator proposed that Lehrman might be a Hegelianegirl',
  'USER-SET GORGONIFICATION CLASS',
  'replication crisis, scientism, diploma mills',
];
const mirrorCorpus = mirrorFiles
  .map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) fail(`missing generated mirror ${relativePath}`);
    return fs.readFileSync(absolutePath, 'utf8');
  })
  .join('\n');
requirePhrases(mirrorCorpus, 'generated ML* mirrors', mirrorPhrases);

if (entries.length < 1145) {
  fail(`live Methodologylist fell below 1,145 entries: ${entries.length}`);
}

console.log(
  `ML* Gorgonwars premise-split guard passed for ${entries.length} live entries with corrected MeToo 0/1/128 split.`,
);
