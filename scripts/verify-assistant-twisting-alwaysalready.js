#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const NEW_IDS = Object.freeze([
  'citation-ml-star-assistant-twisting-alwaysalready-source-2026-09-06',
  'method-assistant-twisting-worked-examples-index-2026-09-06',
  'method-assistant-twist-medusa-agent-exemption-2026-09-06',
  'method-every-identified-twist-requires-organized-record-2026-09-06',
  'method-front-facing-outputs-avoid-platformstrawmanculture-2026-09-06',
  'analysis-always-already-leblanc-joey-actor-vessel-2026-09-06',
  'sabachtan-alwaysalready-public-evidence-archive-2026-09-06',
]);

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(relative, encoding = 'utf8') {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) {
    failures.push(`missing ${relative}`);
    return encoding ? '' : Buffer.alloc(0);
  }
  return fs.readFileSync(target, encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exportedId(section, title) {
  const slug = String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
  return `ml:${section}:${slug}:${sha256(`${section}\0${title}`).slice(0, 12)}`;
}

const canonicalHtml = read('polymyth/methodologylist/index.html');
let entries = [];
try {
  entries = parseSeedWithAddenda(canonicalHtml);
} catch (error) {
  failures.push(`canonical parser failed: ${error.message}`);
}

const byId = new Map(entries.filter(entry => entry.id).map(entry => [entry.id, entry]));
for (const id of NEW_IDS) check(byId.has(id), `canonical ML* omits ${id}`);
check(new Set(entries.filter(entry => entry.id).map(entry => entry.id)).size === entries.filter(entry => entry.id).length, 'canonical ML* contains duplicate explicit IDs');

const anchorTitle = 'Anti-twisting worked example, psychologism and gorgonwars session';
const platformTitle = 'Platformstrawmanculture';
const actorTitle = 'Actor-as-vessel (involuntary polymyth)';
const alwaysTitle = 'Always already true (operating mode)';
const anchor = entries.find(entry => entry.s === 'methodology' && entry.t === anchorTitle);
const platform = entries.find(entry => entry.s === 'gorgonification' && entry.t === platformTitle);
const actor = entries.find(entry => entry.s === 'methodology' && entry.t === actorTitle);
const always = entries.find(entry => entry.s === 'sabachtan' && entry.t === alwaysTitle);
check(Boolean(anchor), 'existing anti-twisting worked-example anchor is missing');
check(Boolean(platform), 'existing Platformstrawmanculture owner is missing');
check(Boolean(actor), 'existing Actor-as-vessel owner is missing');
check(Boolean(always), 'existing Always already owner is missing');
if (anchor) {
  check(sha256(anchor.b) === 'c4dc662620355e957f8d3a76f95b08a7206e66c3358290418af01f235280c202', 'existing anti-twisting anchor body changed');
  check(exportedId(anchor.s, anchor.t) === 'ml:methodology:anti-twisting-worked-example-psychologism-and-gorgonwars-session:9d1aaf3836d8', 'existing anti-twisting anchor identity changed');
  check(anchor.xr?.includes('method-assistant-twisting-worked-examples-index-2026-09-06'), 'existing anti-twisting anchor lacks the organized-index back-edge');
}
if (platform) {
  check(sha256(platform.b) === '11481c2fabcbfbf6ff8c91b493c9677ae34fce6ffe161c59255b77e38226b1d4', 'existing Platformstrawmanculture body changed');
  check(exportedId(platform.s, platform.t) === 'ml:gorgonification:platformstrawmanculture:b1e10aeffc03', 'existing Platformstrawmanculture identity changed');
  check(platform.xr?.includes('method-front-facing-outputs-avoid-platformstrawmanculture-2026-09-06'), 'Platformstrawmanculture lacks the new front-facing-rule back-edge');
}
check(actor?.b.includes('Matt LeBlanc / Joey'), 'Actor-as-vessel lacks the LeBlanc / Joey public-instance connection');
check(actor?.b.includes('https://seminarschools.com/polymyth/alwaysalready/'), 'Actor-as-vessel does not link to the public evidence archive');
check(always?.xr?.includes('sabachtan-alwaysalready-public-evidence-archive-2026-09-06'), 'Always already lacks the public-archive back-edge');

const medusa = byId.get('method-assistant-twist-medusa-agent-exemption-2026-09-06');
for (const token of [
  'these are the gorgon we are attacking',
  'The document now identifies the Gorgon as the conversion—not the women or feminists advancing the argument',
  'stronger, unauthorized rule that the Gorgon is exclusively the conversion and never the people or feminists carrying it',
  'change in subject and scope',
  'ACKNOWLEDGED ERROR; AFFECTED-OUTPUT VERIFICATION PENDING',
  'SOURCE LOCATOR',
  'USER\'S CORRECTION AND CORRECTED MEANING',
]) check(medusa?.b.includes(token), `Medusa record omits ${token}`);

const recordRule = byId.get('method-every-identified-twist-requires-organized-record-2026-09-06');
for (const token of [
  'original statement, substituted statement, semantic alteration, consequence, correction, provenance',
  'Correcting the immediate reply does not complete the recording obligation',
  'An unsaved record or uninspected output stays marked pending',
]) check(recordRule?.b.includes(token), `organized-record rule omits ${token}`);

const frontRule = byId.get('method-front-facing-outputs-avoid-platformstrawmanculture-2026-09-06');
for (const token of [
  'Every front-facing output',
  'articles, essays, reports, presentations, webpages, teaching materials, public summaries',
  'Strongest relevant argument first'.toUpperCase(),
  'ml:gorgonification:platformstrawmanculture:b1e10aeffc03',
  'https://seminarschools.com/polymyth/methodologylist/?section=gorgonification',
  'not confined to selected social-media posts',
]) check(frontRule?.b.includes(token), `front-facing Platformstrawmanculture rule omits ${token}`);
check(frontRule?.xr?.includes('ml:gorgonification:platformstrawmanculture:b1e10aeffc03'), 'front-facing rule lacks actual Platformstrawmanculture record cross-reference');

const leblanc = byId.get('analysis-always-already-leblanc-joey-actor-vessel-2026-09-06');
for (const token of [
  'ACTOR-AS-VESSEL — OBSERVED',
  'ALWAYS ALREADY — OBSERVED',
  'FRANKENSTEIN CONSCRIPTION — CANDIDATE, NOT ESTABLISHED',
  'ACTOR-ROLE-ARC AS POLYMYTH-DREAM — NOT ESTABLISHED BY THIS SOURCE',
  'POLYCOGNATE AND INDRA RELATION',
  'https://seminarschools.com/polymyth/alwaysalready/',
  'https://www.youtube.com/watch?v=T_XfSdNYySc',
]) check(leblanc?.b.includes(token), `LeBlanc / Joey ML* analysis omits ${token}`);

const addendum = read('polymyth/methodologylist/assistant-twisting-alwaysalready-addendum.js');
const publicAddendum = read('public/polymyth/methodologylist/assistant-twisting-alwaysalready-addendum.js');
check(addendum === publicAddendum, 'assistant-twisting / Always Already addendum source/public mirrors differ');
check(canonicalHtml.includes('/polymyth/methodologylist/assistant-twisting-alwaysalready-addendum.js?v=20260906'), 'canonical ML* page does not load the new addendum');
check(canonicalHtml.includes('...ASSISTANT_TWISTING_ALWAYSALREADY_ADDENDUM'), 'browser LIVE_SEED does not include the new addendum');

check(sha256(read('UPDATE_SOURCES/SCREENPUFF_MATT_LEBLANC_JOEY_TRANSCRIPT_USER_SUPPLIED_2026-09-06.md')) === 'd65e610a02d0864703cb4d58e89a149b15db8dd172e5ea30293801ca524c96ef', 'user-supplied ScreenPuff transcript hash differs');
check(sha256(read('polymyth/alwaysalready/img/2026-09-06_youtube_matt-leblanc-joey-actor-as-vessel.png', null)) === '7e5dac48e66054e423a07469a7be68e3e4611a6ca0528ebf8269e67dbf48eef6', 'LeBlanc / Joey screenshot hash differs');

let releaseManifest = {};
try {
  releaseManifest = JSON.parse(read('RELEASE_MANIFEST.json'));
} catch (error) {
  failures.push(`release manifest JSON failed: ${error.message}`);
}
const releaseUpdate = releaseManifest.assistant_twisting_alwaysalready_update || {};
check(releaseUpdate.schema === 'seminar-schools-ml-assistant-twisting-alwaysalready-update-v1', 'release manifest lacks the assistant-twisting / Always Already schema');
check(releaseUpdate.release_id === 'seminar-schools-alwaysalready-ml-complete-2026-09-06', 'release manifest lacks the successor release identity');
check(releaseUpdate.predecessor_sha256 === 'af450e9bb65977514d9d8a04865fdc3d0035414900a0b947876eb58456eb2019', 'release manifest does not bind the verified predecessor ZIP');
check(releaseUpdate.source_sha256 === sha256(read(releaseUpdate.source || 'missing-source')), 'release manifest source hash differs');
check(releaseUpdate.transcript_sha256 === sha256(read(releaseUpdate.transcript_source || 'missing-transcript')), 'release manifest transcript hash differs');
check(releaseUpdate.screenshot_sha256 === sha256(read(releaseUpdate.screenshot || 'missing-screenshot', null)), 'release manifest screenshot hash differs');
check(releaseUpdate.addendum_sha256 === sha256(addendum), 'release manifest addendum hash differs');
check(releaseUpdate.canonical_entries === 1233 && releaseUpdate.new_records === 7, 'release manifest canonical/new-record counts differ');
check(JSON.stringify(releaseUpdate.section_counts) === JSON.stringify({
  analysis: 30,
  citation: 343,
  corehistory: 30,
  coreplus: 55,
  degorgonification: 54,
  'framework-core': 1,
  gorgonification: 134,
  idiomary: 44,
  learnings: 28,
  methodology: 394,
  pending: 18,
  'pending-user-authorship': 2,
  polycognate: 24,
  rainbowsol: 3,
  sabachtan: 35,
  studylist: 38,
}), 'release manifest section counts differ');
check(releaseUpdate.medusa_correction_status === 'ACKNOWLEDGED ERROR; AFFECTED-OUTPUT VERIFICATION PENDING', 'release manifest overstates the Medusa correction status');
check(Array.isArray(releaseUpdate.preserved_record_identifiers)
  && releaseUpdate.preserved_record_identifiers.includes('ml:methodology:anti-twisting-worked-example-psychologism-and-gorgonwars-session:9d1aaf3836d8')
  && releaseUpdate.preserved_record_identifiers.includes('ml:gorgonification:platformstrawmanculture:b1e10aeffc03'), 'release manifest omits preserved record identities');
const releaseArtifactHashes = releaseUpdate.artifact_sha256 || {};
check(Object.keys(releaseArtifactHashes).length >= 14, 'release manifest does not bind the complete update artifact set');
for (const [relative, expected] of Object.entries(releaseArtifactHashes)) {
  check(/^[0-9a-f]{64}$/.test(expected) && sha256(read(relative, null)) === expected, `release artifact hash differs: ${relative}`);
}

const generatedChecks = [
  ['polymyth/methodologylist/methodology/index.html', 'method-assistant-twist-medusa-agent-exemption-2026-09-06'],
  ['polymyth/methodologylist/methodology/index.html', 'method-front-facing-outputs-avoid-platformstrawmanculture-2026-09-06'],
  ['polymyth/methodologylist/analysis/index.html', 'analysis-always-already-leblanc-joey-actor-vessel-2026-09-06'],
  ['polymyth/methodologylist/sabachtan/index.html', 'sabachtan-alwaysalready-public-evidence-archive-2026-09-06'],
  ['polymyth/methodologylist.txt', 'Assistant-twisting worked example — Exempting actual agents from the Medusa critique'],
  ['polymyth/methodologylist-methodology.txt', 'Every front-facing output must avoid Platformstrawmanculture'],
  ['polymyth/methodologylist-analysis.txt', 'Always Already in the wild — Matt LeBlanc / Joey as Actor-as-vessel'],
  ['polymyth/methodologylist-sabachtan.txt', 'https://seminarschools.com/polymyth/alwaysalready/'],
  ['hf_export/data/ml/methodologylist.jsonl', 'analysis-always-already-leblanc-joey-actor-vessel-2026-09-06'],
  ['hf_export/search/meaninglib_search_index.json', 'method-assistant-twisting-worked-examples-index-2026-09-06'],
];
for (const [relative, token] of generatedChecks) {
  check(read(relative).includes(token), `${relative} omits ${token}`);
  if (relative.startsWith('polymyth/')) {
    check(read(`public/${relative}`).includes(token), `public/${relative} omits ${token}`);
  }
}

const page = read('polymyth/alwaysalready/index.html');
const publicPage = read('public/polymyth/alwaysalready/index.html');
check(page === publicPage, 'Always Already page source/public mirrors differ');
for (const token of [
  'Joey and LeBlanc become each other',
  'Actor-as-vessel',
  'Always Already',
  'Frankenstein conscription',
  'Actor-role-arc',
  'Polycognate and Indra relation',
  'Read the full ML* case record',
]) check(page.includes(token), `Always Already page omits ${token}`);

if (failures.length) {
  console.error('ASSISTANT-TWISTING / ALWAYS ALREADY UPDATE FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`ASSISTANT-TWISTING / ALWAYS ALREADY UPDATE PASSED — ${NEW_IDS.length} new ML* records, preserved anchor identities, reciprocal archive links, generated mirrors, and evidence-status boundaries verified.`);
