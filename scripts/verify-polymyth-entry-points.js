#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const siteOnly = process.argv.includes('--site-only');
const coherenceOnly = process.argv.includes('--coherence-only') || siteOnly;
const unknownArguments = process.argv.slice(2).filter(argument => !['--coherence-only', '--site-only'].includes(argument));
if (unknownArguments.length) {
  console.error('POLYMYTH ENTRY POINTS FAILED — unsupported argument(s): ' + unknownArguments.join(', '));
  process.exit(1);
}
const rootPage = path.join(ROOT, 'polymyth', 'index.html');
const publicPage = path.join(ROOT, 'public', 'polymyth', 'index.html');
const petAsset = path.join(ROOT, 'polymyth', 'img', 'mephistodata-waving.png');
const publicPetAsset = path.join(ROOT, 'public', 'polymyth', 'img', 'mephistodata-waving.png');
const activation = path.join(ROOT, 'polymyth', 'mephistodata-activation.md');
const hfActivation = path.join(ROOT, 'hf_export', 'ai_access_pack', 'MEPHISTODATA_ACTIVATION.md');
const coherencePage = path.join(ROOT, 'polymyth', 'coherence', 'index.html');
const coherenceWorkbook = path.join(ROOT, 'polymyth', 'coherence', 'Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx');
const coherenceProtocol = path.join(ROOT, 'polymyth', 'coherence', 'Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md');
const coherenceSchema = path.join(ROOT, 'polymyth', 'coherence', 'Polymyth_Coherence_Assessment_Schema_V5.1.2.json');
const publicCoherencePage = path.join(ROOT, 'public', 'polymyth', 'coherence', 'index.html');
const publicCoherenceWorkbook = path.join(ROOT, 'public', 'polymyth', 'coherence', 'Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx');
const publicCoherenceProtocol = path.join(ROOT, 'public', 'polymyth', 'coherence', 'Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md');
const publicCoherenceSchema = path.join(ROOT, 'public', 'polymyth', 'coherence', 'Polymyth_Coherence_Assessment_Schema_V5.1.2.json');
const editableCoherenceInstrument = path.join(ROOT, '..', 'EDITABLE_MASTERS', '07_POLYMYTH_COHERENCE', 'Polymyth_Coherence_Assessment_Instrument.xlsx');
const editableCoherenceApplications = path.join(ROOT, '..', 'EDITABLE_MASTERS', '07_POLYMYTH_COHERENCE', 'Polymyth_Coherence_Worked_Applications.xlsx');
const editableCoherenceReadme = path.join(ROOT, '..', 'EDITABLE_MASTERS', '07_POLYMYTH_COHERENCE', 'README.md');
const coherenceAddendum = path.join(ROOT, 'polymyth', 'methodologylist', 'polymyth-coherence-routing-addendum.js');
const publicCoherenceAddendum = path.join(ROOT, 'public', 'polymyth', 'methodologylist', 'polymyth-coherence-routing-addendum.js');
const coherenceHash = '0624c76e0ae1351dcfe6a9d2cabf6e4e581820b63a0fc40e5ad755bbd1d93550';
const required = [
  'href="methodologylist/"',
  'id="mlCopy"',
  'href="methodologylist.txt" download',
  'href="coherence/"',
  'href="mephistodata-activation.md" download',
  'https://huggingface.co/datasets/SeminarSchools/meaninglib',
  'aria-label="Mephistodata entry points"'
];
const coherenceRequired = [
  'https://seminarschools.com/polymyth/coherence/',
  'data-route-type="archive"',
  'data-shared-geometry-exempt="star-file"',
  'data-star-file-page="true"',
  'Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx',
  'Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md',
  'Polymyth_Coherence_Assessment_Schema_V5.1.2.json',
  'Download the blank instrument',
  'There are no completed case audits in these downloads.',
  'Applicable with Adaptation',
  'Outside Protocol Scope',
  'Screening can locate candidates and defects',
  'AI assists; people decide.',
  'genuinely different independent reviewer',
  'Internal is the absolute gate.',
  'Looking for the wider method?',
];
const petRequired = [
  'https://chatgpt.com/s/sharepet_6a74bbaba5e08191bfc0950076228f7f',
  'Open Mephistodata in ChatGPT',
  'src="img/mephistodata-waving.png"',
  'Add the animated devil-android to ChatGPT Work.'
];
function fail(msg){ console.error('POLYMYTH ENTRY POINTS FAILED — ' + msg); process.exit(1); }
for (const file of [
  coherencePage, coherenceWorkbook, coherenceProtocol, coherenceSchema,
  coherenceAddendum,
  ...(siteOnly
    ? [publicCoherencePage, publicCoherenceWorkbook, publicCoherenceProtocol, publicCoherenceSchema, publicCoherenceAddendum]
    : [editableCoherenceInstrument, editableCoherenceApplications, editableCoherenceReadme]),
  ...(!coherenceOnly ? [rootPage, publicPage, activation, hfActivation, petAsset, publicPetAsset] : []),
]) {
  if (!fs.existsSync(file)) fail('missing ' + path.relative(ROOT, file));
}
if (siteOnly) {
  for (const [sourceFile, publicFile] of [
    [coherencePage, publicCoherencePage],
    [coherenceWorkbook, publicCoherenceWorkbook],
    [coherenceProtocol, publicCoherenceProtocol],
    [coherenceSchema, publicCoherenceSchema],
    [coherenceAddendum, publicCoherenceAddendum],
  ]) {
    if (!fs.readFileSync(sourceFile).equals(fs.readFileSync(publicFile))) {
      fail(`source/public Coherence asset differs: ${path.relative(ROOT, sourceFile)}`);
    }
  }
}
if (!coherenceOnly) {
  for (const file of [rootPage, publicPage]) {
    const html = fs.readFileSync(file, 'utf8');
    for (const token of required) if (!html.includes(token)) fail(`${path.relative(ROOT, file)} missing ${token}`);
    for (const token of petRequired) if (!html.includes(token)) fail(`${path.relative(ROOT, file)} missing ${token}`);
  }
  if (!fs.readFileSync(rootPage).equals(fs.readFileSync(publicPage))) fail('source/public Polymyth pages differ');
}
const coherenceHtml = fs.readFileSync(coherencePage, 'utf8');
for (const token of coherenceRequired) {
  if (!coherenceHtml.includes(token)) fail(`${path.relative(ROOT, coherencePage)} missing ${token}`);
}
if (coherenceHtml.includes('V5.1.1') || coherenceHtml.includes('Polymyth_Coherence_V5.1.1.xlsx')) {
  fail('source Polymyth Coherence page still exposes V5.1.1');
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const coherenceWorkbooks = siteOnly
  ? [coherenceWorkbook, publicCoherenceWorkbook]
  : [coherenceWorkbook, editableCoherenceInstrument];
for (const file of coherenceWorkbooks) {
  if (sha256(file) !== coherenceHash) {
    fail(`${path.relative(ROOT, file)} is not the byte-exact blank canonical V5.1.2 workbook`);
  }
}
function findNamedFiles(directory, basename, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) findNamedFiles(full, basename, found);
    else if (entry.isFile() && entry.name === basename) found.push(full);
  }
  return found;
}
const leakedApplications = findNamedFiles(ROOT, 'Polymyth_Coherence_Worked_Applications.xlsx');
if (leakedApplications.length) {
  fail(`worked applications workbook entered SITE_PACKAGE: ${leakedApplications.map(file => path.relative(ROOT, file)).join(', ')}`);
}
const protocolText = fs.readFileSync(coherenceProtocol, 'utf8');
for (const token of [
  'no completed case audit',
  'Applicable with Adaptation',
  'Outside Protocol Scope',
  'Screening may locate candidates',
  'Never use `Polymyth_Coherence_Worked_Applications.xlsx` or a prior case result as an answer key.',
  'A human adjudicator must verify the evidence',
  'genuinely different independent reviewer',
  'Automated output alone cannot establish',
]) {
  if (!protocolText.includes(token)) fail(`${path.relative(ROOT, coherenceProtocol)} missing ${token}`);
}
let schema;
try {
  schema = JSON.parse(fs.readFileSync(coherenceSchema, 'utf8'));
} catch (error) {
  fail(`${path.relative(ROOT, coherenceSchema)} is invalid JSON: ${error.message}`);
}
if (schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail('blank JSON schema does not declare Draft 2020-12');
if (schema?.$ref !== '#/$defs/caseHandoff' || !schema?.$defs?.caseHandoff) {
  fail('blank JSON schema does not expose its case handoff through top-level $ref/$defs');
}
if (schema?.['x-instrument']?.version !== 'V5.1.2') fail('blank JSON schema has the wrong instrument version');
if (schema?.['x-instrument']?.sha256 !== coherenceHash) fail('blank JSON schema has the wrong workbook hash');
if (schema?.['x-blankState']?.completedCaseCount !== 0) fail('blank JSON schema claims a completed case');
if (schema?.['x-blankState']?.templateIsACompletedCase !== false) fail('blank JSON schema treats TEMPLATE-001 as completed');
function isBlankCaseValue(value) {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.values(value).every(isBlankCaseValue);
  return false;
}
const blankCase = schema?.examples?.[0];
if (!blankCase || !Object.values(blankCase).every(isBlankCaseValue)) {
  fail('blank JSON schema contains a case answer');
}

function resolveLocalRef(root, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
  return ref.slice(2).split('/').reduce((value, part) => {
    if (value === undefined || value === null) return undefined;
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    return value[key];
  }, root);
}
function matchesJsonType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}
function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function validateSchemaInstance(instance, node, root = schema, location = '$') {
  if (!node || typeof node !== 'object') return [`${location}: schema node is missing`];
  if (node.$ref) {
    const target = resolveLocalRef(root, node.$ref);
    if (!target) return [`${location}: unresolved schema reference ${node.$ref}`];
    return validateSchemaInstance(instance, target, root, location);
  }
  const errors = [];
  const allowedTypes = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  if (allowedTypes.length && !allowedTypes.some(type => matchesJsonType(instance, type))) {
    errors.push(`${location}: expected ${allowedTypes.join('|')}`);
    return errors;
  }
  if (Array.isArray(node.enum) && !node.enum.some(value => sameJsonValue(value, instance))) {
    errors.push(`${location}: value is outside enum`);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'const') && !sameJsonValue(node.const, instance)) {
    errors.push(`${location}: value does not match const`);
  }
  if (matchesJsonType(instance, 'object')) {
    const properties = node.properties || {};
    for (const required of node.required || []) {
      if (!Object.prototype.hasOwnProperty.call(instance, required)) errors.push(`${location}: missing ${required}`);
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(instance)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) errors.push(`${location}: unexpected ${key}`);
      }
    }
    for (const [key, value] of Object.entries(instance)) {
      if (properties[key]) errors.push(...validateSchemaInstance(value, properties[key], root, `${location}.${key}`));
    }
  }
  if (Array.isArray(instance) && node.items) {
    instance.forEach((value, index) => errors.push(...validateSchemaInstance(value, node.items, root, `${location}[${index}]`)));
  }
  return errors;
}
const blankValidation = validateSchemaInstance(blankCase, schema);
if (blankValidation.length) fail(`blank JSON schema example does not validate: ${blankValidation.join('; ')}`);
const malformedCase = JSON.parse(JSON.stringify(blankCase));
malformedCase.caseId = 42;
delete malformedCase.layerResults.external;
malformedCase.answerKey = 'expected verdict';
const malformedErrors = validateSchemaInstance(malformedCase, schema);
if (!malformedErrors.some(error => error.includes('expected string|null'))
    || !malformedErrors.some(error => error.includes('missing external'))
    || !malformedErrors.some(error => error.includes('unexpected answerKey'))) {
  fail(`operative JSON schema accepted a malformed case: ${malformedErrors.join('; ') || 'no errors'}`);
}
const obsoleteWorkbooks = [
  path.join(ROOT, 'polymyth', 'coherence', 'Polymyth_Coherence_V5.1.1.xlsx'),
  path.join(ROOT, 'public', 'polymyth', 'coherence', 'Polymyth_Coherence_V5.1.1.xlsx'),
];
if (!siteOnly) {
  obsoleteWorkbooks.push(path.join(ROOT, '..', 'EDITABLE_MASTERS', '07_POLYMYTH_COHERENCE', 'Polymyth_Coherence.xlsx'));
}
for (const obsolete of obsoleteWorkbooks) {
  if (fs.existsSync(obsolete)) fail(`obsolete Coherence workbook remains: ${path.relative(ROOT, obsolete)}`);
}
const workbookVerifier = path.join(__dirname, 'verify-polymyth-coherence-workbook.py');
const pythonRunner = path.join(__dirname, 'run-python.js');
const workbookArguments = [pythonRunner, workbookVerifier];
if (siteOnly) workbookArguments.push('--site-only');
const workbookResult = spawnSync(process.execPath, workbookArguments, {
  cwd: ROOT,
  stdio: 'inherit',
});
if (workbookResult.error) fail(`could not run workbook verifier: ${workbookResult.error.message}`);
if (workbookResult.status !== 0) fail(`workbook verifier exited ${workbookResult.status}`);
if (!coherenceOnly) {
  const petBytes = fs.readFileSync(petAsset);
  const publicPetBytes = fs.readFileSync(publicPetAsset);
  if (!petBytes.length || !petBytes.equals(publicPetBytes)) fail('source/public pet assets are empty or differ');
  if (petBytes.length < 24 || petBytes.toString('hex', 1, 4) !== '504e47') fail('pet asset is not a PNG');
  const width = petBytes.readUInt32BE(16);
  const height = petBytes.readUInt32BE(20);
  if (width !== 192 || height !== 208) fail(`pet asset dimensions are ${width}x${height}, expected 192x208`);
  if (fs.readFileSync(activation, 'utf8') !== fs.readFileSync(hfActivation, 'utf8')) {
    fail('public activation file is stale');
  }
}
console.log(siteOnly
  ? 'POLYMYTH COHERENCE ENTRY POINTS SITE-ONLY PASSED — source/public deploy parity, blank V5.1.2 instrument/protocol, operative answer-free schema, routing addendum, and no worked-applications leak verified without private release masters.'
  : coherenceOnly
    ? 'POLYMYTH COHERENCE ENTRY POINTS PASSED — blank V5.1.2 instrument/protocol, operative answer-free schema, and structurally locked editable applications verified without reading generated public mirrors.'
    : 'POLYMYTH ENTRY POINTS PASSED — activation routes, pet share card, blank Polymyth Coherence V5.1.2 instrument/protocol, operative answer-free schema, structurally locked editable applications, synchronized assets, and activation file verified.');
