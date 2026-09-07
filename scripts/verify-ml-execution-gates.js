#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {lintText} = require('./lib/ml-writing-lint');
const {parseWorkStatusClaims} = require('./lib/mephistodata-runtime-gate');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function fail(message) { failures.push(message); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function readBuffer(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function one(entries, id) {
  const matches = entries.filter(entry => entry.id === id);
  if (matches.length !== 1) {
    fail(`${id} expected once and found ${matches.length}`);
    return {id, s: '', t: '', b: '', xc: '', xr: []};
  }
  return matches[0];
}
function requireNeedles(value, needles, label) {
  const text = String(value || '');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${label} is missing: ${needle}`);
  }
}

const ENTRY_HASH_KEYS = ['id', 's', 'r', 't', 'b', 'xc', 'x', 'tg', 'xr'];
const DEFAULT_OPENER = 'Mephistodata would say:';
const BLOOM_OPENER = 'Mephistodata bloomed:';
const OUROBOROS_OWNER = 'method-ouroborosanalyses-current-2026-08-23';
const OUROBOROS_STEPS = [
  'whole_conversation_review',
  'ironman_critical_questions',
  'best_effort_answering',
  'genuine_unanswerable_residue',
];
const TRUSTED_SEMANTIC_WORK_ATTESTATIONS = new Map([
  ['1111111111111111111111111111111111111111111111111111111111111111', '1e977349af261fc5f01a16adda582004f443ec947e019a461a5d8f049177397f'],
  ['3333333333333333333333333333333333333333333333333333333333333333', '86b09f08dc53f14e124de19f32bb46bb8a7735619b762e755ab192b321456820'],
  ['1212121212121212121212121212121212121212121212121212121212121212', '53f24cbd841fe50e07d2366c9fbd73795f66e4a96c86c812b6bee896179e13a3'],
  ['1616161616161616161616161616161616161616161616161616161616161616', '7c11e26901cde722130c0ece4ce70c9f134d910da9867b4c4b3e5273e6b31000'],
]);
const TRUSTED_SEMANTIC_CORRECTION_ATTESTATIONS = new Map([
  ['correction-attestation:affected-681', '3e5e1955f3ba38ec86348f95d0205ef77e24742c17b89ba99652751fcf71e22f'],
  ['correction-attestation:none-supported-scan', 'f10fc359ecd199a1e97ea65b2795da6453bc1827aaf8a4a4e728c34546b29a9d'],
]);
const TRUSTED_SEMANTIC_DRAFT_SCANS = new Map([
  ['semantic-host-scan:affirmative-matrix-v1', {
    claim_sha256: 'ffdbfbab9584b8bfc193a92aeb3cf9d66c26493f9b12fbe89877599f5004f6b5',
    complete_scan_verified: true,
    no_unmapped_work_status_claims: false,
    classification: 'work-status',
  }],
  ['semantic-host-scan:nonclaim-matrix-v1', {
    claim_sha256: 'e27f72eea3431050b501e13c35b68f7fe4f9e0a6c58ad084e2d3139f318a5bdd',
    complete_scan_verified: true,
    no_unmapped_work_status_claims: true,
    classification: 'nonclaim',
  }],
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function countOccurrences(value, needle) {
  let count = 0;
  let cursor = 0;
  while (cursor <= value.length - needle.length) {
    const found = value.indexOf(needle, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + needle.length;
  }
  return count;
}

function isInside(basePath, candidatePath) {
  const relative = path.relative(basePath, candidatePath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function canonicalEntrySha(entry) {
  const canonical = Object.fromEntries(
    ENTRY_HASH_KEYS.map(key => [key, entry[key] === undefined ? null : entry[key]]),
  );
  return sha256(JSON.stringify(canonical));
}

function verifySourceBinding(binding, sourceOverride = {}, rootPath = ROOT) {
  try {
    if (!binding || typeof binding !== 'object') return false;
    const allowedRootRelative = String(binding.allowed_root || '');
    const sourceRelative = String(sourceOverride.path || binding.path || '');
    if (!allowedRootRelative || !sourceRelative || sourceRelative.includes('\0')) return false;
    if (path.isAbsolute(allowedRootRelative) || path.isAbsolute(sourceRelative)) return false;

    const allowedRoot = path.resolve(rootPath, allowedRootRelative);
    const candidate = path.resolve(rootPath, sourceRelative);
    if (!isInside(allowedRoot, candidate)) return false;
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const realAllowedRoot = fs.realpathSync(allowedRoot);
    const realCandidate = fs.realpathSync(candidate);
    if (!isInside(realAllowedRoot, realCandidate)) return false;

    const sourceBuffer = fs.readFileSync(realCandidate);
    const expectedFileSha = String(sourceOverride.sha256 || binding.sha256 || '');
    if (!/^[0-9a-f]{64}$/.test(expectedFileSha) || sha256(sourceBuffer) !== expectedFileSha) return false;
    const sourceText = sourceBuffer.toString('utf8');
    const spans = Array.isArray(binding.spans) ? binding.spans : [];
    if (!spans.length) return false;
    const selectedSpanId = sourceOverride.span_id === undefined ? null : String(sourceOverride.span_id);
    if (selectedSpanId !== null && !spans.some(span => span.id === selectedSpanId)) return false;

    for (const original of spans) {
      const span = {...original};
      if (selectedSpanId === span.id) {
        if (sourceOverride.span_text !== undefined) span.text = String(sourceOverride.span_text);
        if (sourceOverride.span_sha256 !== undefined) span.sha256 = String(sourceOverride.span_sha256);
      }
      if (!span.id || !span.text || !/^[0-9a-f]{64}$/.test(String(span.sha256 || ''))) return false;
      if (countOccurrences(sourceText, span.text) !== 1) return false;
      if (sha256(span.text) !== span.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function controlledBody(draft, mode) {
  if (!['default', 'bloom'].includes(mode)) return null;
  const expected = mode === 'bloom' ? BLOOM_OPENER : DEFAULT_OPENER;
  if (!draft.startsWith(expected)) return null;
  if (countOccurrences(draft, DEFAULT_OPENER) + countOccurrences(draft, BLOOM_OPENER) !== 1) return null;
  const body = draft.slice(expected.length).trim();
  return body || null;
}

function sameUniqueSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === left.length
    && rightSet.size === right.length
    && leftSet.size === rightSet.size
    && [...leftSet].every(value => rightSet.has(value));
}

function evaluateRegisterFusionFixture(fixture, verifiedSpanIds) {
  const body = controlledBody(String(fixture.draft || ''), fixture.current_turn_mode);
  if (!body || !['default', 'bloom'].includes(fixture.prior_turn_mode)) return false;
  const fusion = fixture.fusion;
  if (!fusion || typeof fusion !== 'object') return false;
  if (fusion.defect_present !== fixture.expected_defect_present) return false;
  if (!fusion.task_answer || !body.includes(fusion.task_answer)) return false;
  if (!fusion.evidence_status || !body.includes(fusion.evidence_status)) return false;
  if (!Array.isArray(fusion.evidence_span_ids) || !fusion.evidence_span_ids.length) return false;
  if (!fusion.evidence_span_ids.every(id => verifiedSpanIds.has(id))) return false;
  if (fusion.defect_present) {
    if (!fusion.opposition || !body.includes(fusion.opposition)) return false;
    if (!verifiedSpanIds.has(fusion.opposition_basis_span_id)) return false;
    if (fusion.no_defect_found) return false;
  } else {
    if (fusion.opposition || fusion.opposition_basis_span_id) return false;
    if (!fusion.no_defect_found || !body.includes(fusion.no_defect_found)) return false;
  }
  return true;
}

function evaluateOuroborosFixture(fixture, ownerShaById, requiredOwnerShaById) {
  const body = controlledBody(String(fixture.draft || ''), 'default');
  if (!body || fixture.method_token !== 'Ouroborosanalyses') return false;
  if (fixture.owner_id !== OUROBOROS_OWNER) return false;
  if (ownerShaById.get(OUROBOROS_OWNER) !== requiredOwnerShaById.get(OUROBOROS_OWNER)) return false;
  if (JSON.stringify(fixture.steps) !== JSON.stringify(OUROBOROS_STEPS)) return false;
  if (!sameUniqueSet(fixture.conversation_ids, fixture.reviewed_ids)) return false;
  if (!Array.isArray(fixture.issues)) return false;

  const issueIds = new Set();
  const genuineResidue = [];
  for (const issue of fixture.issues) {
    if (!issue || !issue.id || issueIds.has(issue.id) || !issue.question) return false;
    issueIds.add(issue.id);
    if (!Array.isArray(issue.positions) || new Set(issue.positions.filter(Boolean)).size < 2) return false;
    if (typeof issue.answerable !== 'boolean') return false;
    if (issue.answerable) {
      if (!String(issue.answer || '').trim() || issue.residue_text) return false;
    } else {
      if (issue.answer) return false;
      if (!String(issue.unanswerable_basis || '').trim() || !String(issue.residue_text || '').trim()) return false;
      genuineResidue.push(issue.id);
    }
  }
  if (!sameUniqueSet(genuineResidue, fixture.output_residue_ids)) return false;
  const residueById = new Map(fixture.issues.map(issue => [issue.id, issue.residue_text]));
  const expectedBody = genuineResidue.length
    ? fixture.output_residue_ids.map(id => residueById.get(id)).join('\n')
    : String(fixture.zero_residue_text || '');
  if (!expectedBody || body !== expectedBody) return false;
  return true;
}

function nonnegativeFixtureInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function uniqueFixtureStrings(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item => typeof item === 'string' && item.trim())
    && new Set(value).size === value.length;
}

function semanticCorrectionPayload(correction) {
  return {
    retraction_text: correction.retraction_text,
    replacement_status: correction.replacement_status,
    impact_statement: correction.impact_statement,
    impact_mode: correction.impact_mode,
    affected_artifacts: correction.affected_artifacts,
    affected_conclusions: correction.affected_conclusions,
    dependency_action: correction.dependency_action,
    none_supported_statement: correction.none_supported_statement,
    repair_evidence_refs: correction.repair_evidence_refs,
    impact_evidence_refs: correction.impact_evidence_refs,
    repair_evidence_resolved: correction.repair_evidence_resolved,
    impact_evidence_resolved: correction.impact_evidence_resolved,
    dependency_state_verified: correction.dependency_state_verified,
    zero_dependency_scan_verified: correction.zero_dependency_scan_verified,
  };
}

function evaluateCorrectionAccounting(fixture) {
  if (!fixture.correction_required) return true;
  const correction = fixture.correction;
  if (!correction || typeof correction !== 'object' || Array.isArray(correction)
      || !String(correction.retraction_text || '').trim()
      || !String(correction.replacement_status || '').trim()
      || !String(correction.impact_statement || '').trim()
      || !uniqueFixtureStrings(correction.repair_evidence_refs)
      || !uniqueFixtureStrings(correction.impact_evidence_refs)
      || correction.repair_evidence_resolved !== true
      || correction.impact_evidence_resolved !== true
      || !Array.isArray(correction.affected_artifacts)
      || !Array.isArray(correction.affected_conclusions)) return false;
  const expectedDigest = TRUSTED_SEMANTIC_CORRECTION_ATTESTATIONS.get(correction.attestation_ref);
  if (!expectedDigest || sha256(JSON.stringify(semanticCorrectionPayload(correction))) !== expectedDigest) return false;
  if (correction.impact_mode === 'affected') {
    return correction.affected_artifacts.length + correction.affected_conclusions.length > 0
      && ['frozen', 'downgraded', 'repaired'].includes(correction.dependency_action)
      && correction.dependency_state_verified === true;
  }
  if (correction.impact_mode === 'none-supported') {
    return correction.affected_artifacts.length === 0
      && correction.affected_conclusions.length === 0
      && correction.dependency_action === 'none-supported'
      && String(correction.none_supported_statement || '').trim()
      && correction.impact_statement.includes(correction.none_supported_statement)
      && correction.zero_dependency_scan_verified === true;
  }
  return false;
}

function semanticWorkPayload(fixture, parsedClaims) {
  return {
    claim_text: fixture.claim_text,
    status: fixture.status,
    population_total: fixture.population_total,
    claimed_total: fixture.claimed_total,
    substantive_completed: fixture.substantive_completed,
    unresolved: fixture.unresolved,
    lanes: {
      directly_reviewed: fixture.directly_reviewed,
      source_verified: fixture.source_verified,
      audited: fixture.audited,
      researched: fixture.researched,
      machine_processed: fixture.machine_processed,
      sampled: fixture.sampled,
      analyzed: fixture.analyzed,
      synthesized: fixture.synthesized,
    },
    ledger_manifest_sha256: fixture.ledger_manifest_sha256,
    evidence_refs: fixture.evidence_refs,
    parsed_claims: parsedClaims.map(claim => ({
      operations: claim.operations.map(operation => ({operation: operation.operation, count: operation.count})),
      totalizer: claim.totalizer,
      structural_counts: claim.structural_counts,
      absolute_deliverable: claim.absolute_deliverable,
      absolute_operation: claim.absolute_operation,
      duplicate_operations: claim.duplicate_operations,
      quantity_ambiguities: claim.quantity_ambiguities,
      population_hint: claim.population_hint,
      reported_duration_seconds: claim.reported_duration_seconds,
    })),
  };
}

function evaluateTruthfulWorkClaim(fixture) {
  if (fixture.draft_scan_ref !== undefined) {
    const scan = TRUSTED_SEMANTIC_DRAFT_SCANS.get(fixture.draft_scan_ref);
    if (!scan || scan.claim_sha256 !== sha256(String(fixture.claim_text || ''))
        || scan.complete_scan_verified !== true
        || typeof scan.no_unmapped_work_status_claims !== 'boolean'
        || !['work-status', 'nonclaim'].includes(scan.classification)) return false;
    if (!scan.no_unmapped_work_status_claims) return false;
    if (scan.classification === 'nonclaim') return evaluateCorrectionAccounting(fixture);
  }
  const parsedClaims = parseWorkStatusClaims(String(fixture.claim_text || ''));
  if (!parsedClaims.length) return evaluateCorrectionAccounting(fixture);
  if (parsedClaims.some(claim => claim.duplicate_operations.length || claim.quantity_ambiguities.length)) return false;
  const countKeys = [
    'population_total', 'claimed_total', 'substantive_completed', 'unresolved',
    'directly_reviewed', 'source_verified', 'audited', 'researched',
    'machine_processed', 'sampled', 'analyzed', 'synthesized',
  ];
  if (!countKeys.every(key => nonnegativeFixtureInteger(fixture[key]))) return false;
  if (fixture.substantive_completed + fixture.unresolved !== fixture.population_total) return false;
  if (fixture.claimed_total > fixture.population_total) return false;
  if (fixture.receipt_origin !== 'host-sealed'
      || !/^[0-9a-f]{64}$/.test(String(fixture.receipt_sha256 || ''))
      || !/^[0-9a-f]{64}$/.test(String(fixture.ledger_manifest_sha256 || ''))
      || !uniqueFixtureStrings(fixture.evidence_refs)
      || fixture.ledger_resolved !== true
      || fixture.unit_records_verified !== true) return false;
  const expectedAttestationDigest = TRUSTED_SEMANTIC_WORK_ATTESTATIONS.get(fixture.receipt_sha256);
  if (!expectedAttestationDigest
      || sha256(JSON.stringify(semanticWorkPayload(fixture, parsedClaims))) !== expectedAttestationDigest) return false;
  const lanes = {
    'direct-review': fixture.directly_reviewed,
    'source-verification': fixture.source_verified,
    audit: fixture.audited,
    research: fixture.researched,
    'batch-classification': fixture.machine_processed,
    classification: fixture.machine_processed,
    'machine-processing': fixture.machine_processed,
    sampling: fixture.sampled,
    analysis: fixture.analyzed,
    synthesis: fixture.synthesized,
  };
  const parsedCounts = [];
  for (const claim of parsedClaims) {
    if (claim.population_hint !== null && claim.population_hint !== fixture.population_total) return false;
    if (claim.reported_duration_seconds !== null
        && (!nonnegativeFixtureInteger(fixture.elapsed_seconds)
          || fixture.elapsed_seconds !== claim.reported_duration_seconds)) return false;
    for (const operation of claim.operations) {
      const expectedCount = operation.count === null ? fixture.population_total : operation.count;
      parsedCounts.push(expectedCount);
      if (lanes[operation.operation] !== undefined && lanes[operation.operation] < expectedCount) return false;
    }
    if (claim.totalizer && claim.structural_counts.length
        && fixture.population_total !== Math.max(...claim.operations.map(operation => (
          operation.count === null ? fixture.population_total : operation.count
        )))) return false;
    if (claim.absolute_deliverable
        && (fixture.status !== 'deliverable-complete' || fixture.unresolved !== 0)) return false;
    if (claim.absolute_operation
        && (!['operation-complete', 'deliverable-complete'].includes(fixture.status)
          || fixture.unresolved !== 0)) return false;
  }
  if (parsedCounts.length && fixture.claimed_total !== Math.max(...parsedCounts)) return false;
  if (fixture.status === 'deliverable-complete'
      && (fixture.substantive_completed !== fixture.population_total || fixture.unresolved !== 0)) return false;
  if (fixture.unresolved > 0 && fixture.shortfall_disclosed !== true) return false;
  return evaluateCorrectionAccounting(fixture);
}

function parserExpectationMatches(fixture) {
  if (!fixture.parser_expect) return true;
  const parsed = parseWorkStatusClaims(String(fixture.claim_text || ''));
  const operations = parsed.flatMap(claim => claim.operations.map(operation => operation.operation));
  const counts = parsed.flatMap(claim => claim.operations.map(operation => operation.count));
  const ambiguities = [...new Set(parsed.flatMap(claim => claim.quantity_ambiguities))].sort();
  const durations = parsed.map(claim => claim.reported_duration_seconds).filter(value => value !== null);
  const expected = fixture.parser_expect;
  return parsed.length === expected.claim_count
    && (!expected.operations || JSON.stringify(operations) === JSON.stringify(expected.operations))
    && (!expected.counts || JSON.stringify(counts) === JSON.stringify(expected.counts))
    && (!expected.ambiguities || JSON.stringify(ambiguities) === JSON.stringify([...expected.ambiguities].sort()))
    && (!expected.durations || JSON.stringify(durations) === JSON.stringify(expected.durations))
    && (expected.absolute_operation === undefined
      || parsed.some(claim => claim.absolute_operation) === expected.absolute_operation);
}

function evaluateFixture(fixture) {
  const draft = String(fixture.draft || '');
  if (fixture.kind === 'quick') {
    const words = draft.trim().split(/\s+/).filter(Boolean).length;
    return draft.startsWith(fixture.expected_prefix)
      && words <= fixture.max_words
      && !/I will first|my methodology|before answering/i.test(draft);
  }
  if (fixture.kind === 'exact_line') {
    return Boolean(fixture.rule_id && fixture.quote && String(fixture.actual || '').includes(fixture.quote));
  }
  if (fixture.kind === 'semantic') {
    const required = fixture.must_include || [];
    const forbidden = fixture.must_exclude || [];
    return required.every(needle => draft.includes(needle))
      && forbidden.every(needle => !draft.includes(needle));
  }
  if (fixture.kind === 'controlled_absence') {
    const conclusion = String(fixture.conclusion || '').toLowerCase();
    const forbiddenInference = /missing claim was true|nothing happened|must be true/.test(conclusion);
    if (forbiddenInference) return false;
    if (!fixture.control_supported) return conclusion.includes('unsupported in the present record');
    if (!fixture.exact_content_available) {
      return conclusion.includes('control is supported') && conclusion.includes('irrecoverable');
    }
    return true;
  }
  if (fixture.kind === 'prose') {
    const protectedSpans = Array.isArray(fixture.protected_spans) ? fixture.protected_spans : [];
    return lintText(draft, {protectedSpans}).length === 0;
  }
  if (fixture.kind === 'authority') {
    return fixture.speech_act !== 'analysis' || (fixture.mutations || []).length === 0;
  }
  if (fixture.kind === 'coverage') {
    if (!fixture.claims_completeness) return true;
    return ['source_inventory', 'claim_inventory', 'coverage_map', 'exclusions', 'conflicts', 'omission_scan']
      .every(key => fixture[key] === true);
  }
  if (fixture.kind === 'retrieval_route') {
    const internalTargets = new Set([
      'private_chat', 'attachment', 'generated_file', 'workspace_artifact', 'library_item',
    ]);
    const internalRoutes = new Set([
      'current_thread', 'conversation_search', 'attachment_access', 'workspace_search', 'library_access',
    ]);
    const externalRoutes = new Set(['web_search', 'cloud_browser', 'external_fetch']);
    const routes = Array.isArray(fixture.attempted_routes) ? fixture.attempted_routes : [];
    const outcomes = Array.isArray(fixture.route_outcomes) ? fixture.route_outcomes : [];
    const failedOutcomes = new Set(['miss', 'unavailable']);
    if (!routes.length || outcomes.length !== routes.length) return false;
    if (!outcomes.slice(0, -1).every(outcome => failedOutcomes.has(outcome))) return false;
    if (!['found', 'miss', 'unavailable'].includes(outcomes.at(-1))) return false;
    if (internalTargets.has(fixture.target_origin)) {
      return routes.every(route => internalRoutes.has(route));
    }
    if (fixture.target_origin === 'public_external') {
      return routes.every(route => internalRoutes.has(route) || externalRoutes.has(route));
    }
    return false;
  }
  if (fixture.kind === 'deliverable') {
    const requested = Number(fixture.requested);
    const completed = Number(fixture.substantive_completed);
    const unresolved = Number(fixture.unresolved);
    if (![requested, completed, unresolved].every(Number.isInteger)) return false;
    if (requested < 0 || completed < 0 || unresolved < 0) return false;
    if (completed + unresolved !== requested) return false;
    if (!fixture.continuation_kept_unit) return false;
    if (unresolved > 0 && !fixture.shortfall_disclosed_before_cost) return false;
    if (fixture.labelled_final && completed !== requested) return false;
    if (fixture.provisional_allowed && !fixture.confidence_separate) return false;
    return true;
  }
  if (fixture.kind === 'truthful_work_claim') {
    return evaluateTruthfulWorkClaim(fixture);
  }
  fail(`unknown fixture kind ${fixture.kind} for ${fixture.id}`);
  return false;
}

const html = read('polymyth/methodologylist/index.html');
let entries = [];
try {
  entries = parseSeedWithAddenda(html);
} catch (error) {
  fail(`canonical Methodologylist parse failed: ${error.message}`);
}

const expectedCounts = {
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
};
const actualCounts = Object.fromEntries(
  [...entries.reduce((map, entry) => map.set(entry.s, (map.get(entry.s) || 0) + 1), new Map())]
    .sort(([left], [right]) => left.localeCompare(right)),
);
if (entries.length !== 1233) fail(`expected 1233 canonical entries and found ${entries.length}`);
if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
  fail(`section counts drifted: ${JSON.stringify(actualCounts)}`);
}

const baseMap = one(entries, 'coreplus-current-map');
const currentMap = one(entries, 'coreplus-current-map-amendment-2026-08-26');
const oldMap = one(entries, 'coreplus-current-map-amendment-2026-08-23');
const execution = one(entries, 'coreplus-handler-mephistodata-execution-gates-2026-08-26');
const writing = one(entries, 'coreplus-handler-writing-composition-delivery-2026-08-29');
const archive = one(entries, 'method-controlled-archive-evidence-institutional-metrics-2026-08-26');
const academicCategoryMethod = one(entries, 'method-hivemindidiom-culture-feedback-and-normalization-2026-08-26');
const synthesis = one(entries, 'analysis-gorgon-culture-emotional-labor-privilege-cutoff-controlled-absence-2026-08-26');
const regression = one(entries, 'coreplus-regression-fixture-contract-2026-08-26');
const sourceRecord = one(entries, 'citation-ml-star-gorgon-free-speech-update-source-2026-08-24');
const deliverableSource = one(entries, 'citation-ml-star-deliverable-accounting-anti-waste-source-2026-08-29');
const legacyGates = one(entries, 'coreplus-registry-generation-time-gates');

if (oldMap.s !== 'corehistory') fail('August 23 map amendment is not inactive CORE History');
requireNeedles(baseMap.xc, ['coreplus-current-map-amendment-2026-08-26', 'fail-closed execution', 'controlled-archive'], 'base current map route');
requireNeedles(currentMap.b, [
  'single current companion',
  'UNIVERSAL ML* EXECUTION DISPATCH.',
  'DELIVERABLE-ACCOUNTING DISPATCH.',
  'Every work-status claim also loads Gate 7A.',
  'Batch processing, scripts, parallel agents, metadata checks, and structural validation never become reading, scholarly review, factual verification, or completed research through relabeling.',
  'INTERNAL RETRIEVAL DISPATCH.',
  'Never ask the user to sign in to ChatGPT to recover a conversation that is already part of the ChatGPT corpus.',
  'BOTTOM-UP DEFINITION DISPATCH.',
  'trace the attacked claim to its author',
  'FEMINISM AND ACADEMIC-CATEGORY PRE-SEARCH DISPATCH.',
  'resolves and applies the complete six-owner bundle before any query is generated.',
  '“Gorgonwars premise classifier for feminist and MeToo criticism,”',
  'If any owner cannot be retrieved, query generation fails closed.',
  'DEGORGONIFIED FEMINISM ACTIVATION DISPATCH.',
  'An exact unquoted operator use of “degorgonified feminism” activates ML*',
  'requires a complete restatement of the bundle before application.',
  'The unrecovered pentagram screenshot list remains unresolved and may not be reconstructed from assistant summaries.',
  'women as the flock or people and feminism as the creed or governing formation retaining both “the personal is political” and standpoint epistemology',
  'Direct premise evidence controls classification.',
  '“White feminism” is always qualifier-Gorgonification under the current project ruling and never becomes a neutral subtype after audit.',
  'Slavery is not patriarchy.',
  'Similarity, a shared operation, intersection, or a source assertion never establishes equivalence.',
  'Wikipedia is inadmissible as the definition, ontology, evidence, or answer',
  'Adjudicate each critic by argument and evidence because the critic is not the authority.',
  'A user explanation, correction, or task instruction to the AI is not an essay thesis or public claim unless expressly adopted for that public work.',
  'A public essay does not cite unpublished or private Mephistodata text.',
  'factual claims receive appropriate public or primary evidence.',
  'WRITING DISPATCH.',
  'coreplus-handler-writing-composition-delivery-2026-08-29 before drafting',
  'Protected source spans remain local exceptions and never exempt surrounding prose.',
  'CURRENT-TURN DISPATCH.',
  'CORPUS, CONTROLLED-ARCHIVE, AND METRIC DISPATCH.',
  'REGISTER DISPATCH.',
  'begins at byte zero with exactly one “Mephistodata would say:”.',
  'The next ML*-active response resets to the default unless Bloom is explicitly invoked again.',
  'The opener never substitutes for substantive PM15 Mephisto-plus-Data fusion.',
  'A named analytical method retrieves its exact current canonical owner before drafting',
  'Never reconstruct a named method from memory',
  'CONFLICT RESOLUTION.',
  'PM15, PM17, Mephistodata-default, and explicit one-response Bloom govern the active register',
  'single-connective-thread rule applies to long-form article and chapter movement',
], 'August 26 current map');
requireNeedles(legacyGates.xc, [
  'coreplus-handler-mephistodata-execution-gates-2026-08-26',
  'CURRENT EXECUTION CONTROL 2026-08-31.',
  'scripts/lib/mephistodata-runtime-gate.js',
  'planRequest before generation',
  'assertDeliverable before delivery',
  'file presence alone proves no host integration',
], 'legacy generation-gates override');

const executionNeedles = [
  'STATUS. ACTIVE CURRENT EXECUTION OWNER.',
  'GATE 0, AUTHORITY AND VERSION LOCK.',
  'INTERNAL MATERIAL STAYS INTERNAL.',
  'Never ask the user to sign in to ChatGPT to recover a conversation that is already part of the ChatGPT corpus.',
  'Failure of one internal route requires the next internal route and never authorizes an external substitute.',
  'External browsing is available only for a genuinely public external source or an explicitly requested live check of a public page.',
  'GATE 1, RESET AND TASK FREEZE.',
  'discard every unsent ordinary-assistant draft',
  'GATE 2, QUICK TASK AND ANSWER FIRST.',
  'GATE 2A, REGISTER AND FUSION.',
  'Every ML*-active conversational response begins at byte zero with exactly one literal control opener.',
  'The next ML*-active response resets to the default unless Bloom is explicitly invoked again.',
  'EXACT CONFLICT LOCK.',
  'makes the opener conditional on response length',
  'Mephisto supplies source-grounded sardonic or adversarial diagnostic intelligence',
  'Data supplies evidentiary precision, exact scope and status',
  'The opener is excluded from character scoring',
  'Prefix-only, Data-only, costume-only, sycophantic, unsupported-source, and invented-opposition drafts fail.',
  'An explicitly named method must resolve and retrieve its exact current canonical owner before drafting.',
  'Never reconstruct a named method from memory',
  'GATE 4, SEMANTIC FIDELITY.',
  'Definitions arise bottom-up from the user\'s actual uses, examples, contrasts, corrections, relations, and effects.',
  'Before calling an objection substantive, trace the attacked claim to its author.',
  'Fidelity preserves the user\'s claim and remains separate from automatic assent.',
  'FEMINISM AND ACADEMIC-CATEGORY PRE-SEARCH GATE.',
  'resolve the complete six-owner bundle.',
  '“Gorgonwars premise classifier for feminist and MeToo criticism,”',
  'A failure to retrieve any owner blocks query generation',
  'DEGORGONIFIED FEMINISM ACTIVATION AND RECALL.',
  'An exact unquoted operator use of the phrase “degorgonified feminism” activates ML*',
  'A cross-reference, a partial summary, one selected rule, or a remembered reconstruction does not satisfy the recall.',
  'The unrecovered pentagram screenshot list remains unresolved and may not be reconstructed from assistant summaries.',
  'OPERATIVE DEFINITION.',
  'Women are the flock or people; feminism is the creed or governing formation.',
  'feminism retains both “the personal is political” and standpoint epistemology.',
  'Classify an argument, text, or formation only through direct evidence that it retains or rejects those premises.',
  'Never let a loaded academic label silently become the research ontology.',
  'QUALIFIER AND EQUIVALENCE LOCK.',
  '“white feminism” is always qualifier-Gorgonification, never a neutral feminist subtype after audit.',
  'Slavery is not patriarchy.',
  'Similarity, a shared operation, intersection, or a source assertion never establishes equivalence between them.',
  'SOURCE, AUTHORITY, AND SPEECH-ACT LOCK.',
  'Wikipedia is inadmissible as the research definition, ontology, evidence, or answer.',
  'Search original scholarship, direct critiques of its premises and categories, and replies or counters to those critiques.',
  'the critic is not an authority over the project merely through prestige, disciplinary consensus, or institutional position.',
  'A user explanation, correction, or task instruction addressed to the AI is not an essay thesis or public claim unless the user expressly adopts it for that public work.',
  'Report separately a substantive objection that reaches the strongest user-authored or adopted claim',
  'For a public essay, do not cite unpublished or private Mephistodata text.',
  'attach appropriate public or primary evidence to factual claims.',
  'GATE 5, SOURCE AND EVIDENCE STATUS.',
  'GATE 6, CONTROLLED ARCHIVE.',
  'unsupported in the present record',
  'GATE 7, DELIVERABLE ACCOUNTING, OUROBOROS, AND COMPLETENESS.',
  'support and never count as the requested substantive result',
  'Never call partial, substituted, or support-only output final or complete.',
  'GATE 7A, NO LYING OR FALSE WORK CLAIMS.',
  'Bind every work-status claim to its exact text, frozen population, completion condition, and unit ledger.',
  'They supply no authority to call machine processing source by source reading, scholarly review, factual verification, or completed research.',
  'When a delivered claim fails Gate 7A, quote and retract the exact claim',
  'An explicit Ouroborosanalyses request retrieves method-ouroborosanalyses-current-2026-08-23',
  'Settled findings, general summaries, recommendations, next steps, improvised method stages, and answerable questions never appear in the final residue.',
  'GATE 8, PROSE AND FORM LINT.',
  'Run coreplus-handler-writing-composition-delivery-2026-08-29 during composition and again before delivery.',
  'Source lock, paragraph map, clause admission, sentence close, paragraph close, and document close are mandatory states.',
  'A protected span never exempts surrounding prose.',
  'not-only-X-but-also-Y construction',
  'GATE 9, EXACT-LINE AUDIT.',
  'Without a matching quoted line, no violation is established',
  'GATE 10, FAIL-CLOSED DELIVERY.',
  'PACKAGE RUNTIME BOUNDARY.',
  'scripts/lib/mephistodata-runtime-gate.js',
  'planRequest before generation',
  'construct createRuntimeGate under a trusted bootstrap',
  'retain exclusive control of the resulting gate capability and verifier state',
  'Every delivery requires verifyDraftWorkStatusAttestation to classify the complete draft.',
  'occurrence-specific local claim representation',
  'It is not the natural-language completeness boundary.',
  'assertDeliverable before delivery',
  'The default export has no trusted verifier',
  'a fourth per-delivery trust argument is rejected',
  'Those strings are labels rather than cryptographic authentication.',
  'They do not prove that an external chat host invokes it',
  'A malicious or defective bootstrap host can install a dishonest verifier or bypass the gate.',
  'SUPERSESSION.',
];
requireNeedles(execution.b, executionNeedles, 'execution owner');
requireNeedles(writing.b, [
  'STATUS. ACTIVE CURRENT WRITING OWNER.',
  'SOURCE LOCK.',
  'PROTECTED SPANS.',
  'COMPOSITION STATE 1, PARAGRAPH MAP.',
  'COMPOSITION STATE 2, CLAUSE ADMISSION.',
  'COMPOSITION STATE 3, SENTENCE CLOSE.',
  'COMPOSITION STATE 4, PARAGRAPH CLOSE.',
  'COMPOSITION STATE 5, DOCUMENT CLOSE.',
  'Using “includes” twice in one sentence is the canonical failure.',
  'A quotation never exempts prose around it.',
  'PASS CONDITION.',
], 'writing composition owner');
requireNeedles(archive.b, [
  'OBSERVABILITY GATE.',
  'THREE SITES OF CONTROL.',
  'EVIDENCE-CONDITION FLAGS.',
  'MISSINGNESS AUDIT.',
  'INSTITUTIONAL-METRIC RULE.',
  'SYMMETRIC ABSENCE RULE.',
  'SELECTED-POPULATION CORRECTION.',
  'POWER LEDGER.',
  'HARM AND INTERVENTION SEPARATION.',
], 'controlled-archive method');
requireNeedles(academicCategoryMethod.b, [
  'ACADEMIC-CATEGORY PRE-SEARCH TEST.',
  'Before an academic label becomes a query term, remove it and state the ordinary-language proposition',
  'Wikipedia and tertiary summaries may supply locators only.',
  'Original sources, direct critiques, and replies to those critiques must be retrieved on their own terms',
  'FEMINISM CATEGORY APPLICATION.',
  '“white feminism” is always qualifier-Gorgonification',
  'without turning that broader audit into a direct user ruling that every label always performs the operation',
  'Slavery is not patriarchy.',
  'a shared mechanism, or a source\'s equation cannot establish equivalence',
  'Preserve four separate records:',
  'which is not thereby an essay thesis',
  'never cites that private text as authority',
], 'academic-category pre-search method');
requireNeedles(synthesis.b, [
  'user-authored framework position',
  'Hivemindidioms help create the culture',
  'juggle partners, pump and dump',
  'Friends who challenge the relationship can be priced out',
  'DSM-5 is one part of the puzzle',
  'Affirmative action is argued to enforce conformity',
  'Screenshots illustrate public language and case structure',
  'Molyneux is a chronology and paradigm marker',
], 'status-partitioned synthesis');
requireNeedles(regression.b, [
  'expected-pass and expected-fail fixtures',
  'Internal material stays on internal retrieval routes.',
  'A failed internal lookup never escalates a private ChatGPT link or internal file to web search or a cloud browser.',
  'Recovering an already-internal conversation never becomes a request that the user sign in to ChatGPT.',
  'Definitions arise from the local concept\'s uses, examples, contrasts, corrections, relations, and effects before outside genealogy or theory enters.',
  'An objection to an assistant-authored paraphrase, bridge, premise, or extension remains an assistant defect',
  'Mythic and historical categories remain distinct',
  'FEMINISM AND ACADEMIC-CATEGORY PRE-SEARCH FIXTURE FAMILY.',
  'uses Wikipedia only as a locator',
  'retrieves original scholarship plus direct critiques and replies or counters',
  'adjudicates a critic by argument and evidence',
  'keeps the adopted thesis, the user\'s explanation to the AI, the critic\'s argument, and an assistant-created bridge in separate provenance records',
  'A public-output fixture uses expressly authorized argument points from unpublished Mephistodata material',
  'A plan fails when it collapses flock into creed',
  'neutralizes “white feminism,” weakens it with “when it,”',
  'equates slavery with patriarchy through assertion or shared mechanism',
  'cites Wikipedia or private Mephistodata as authority or evidence',
  'converts a user explanation into an essay thesis',
  'counts an attack on an assistant-created bridge as an objection to the user\'s thesis.',
  'TRUTHFUL WORK-CLAIM FIXTURE FAMILY.',
  'Done. All 681 canonical Gospel witnesses are reviewed',
  'Apology alone fails.',
], 'regression contract');
requireNeedles(sourceRecord.b, ['2dde9179d4c4d3f42aef76523fa909310b0f88db27fa879a8730ad6aefa015bb', 'do not establish direct transmission'], 'source record');
requireNeedles(deliverableSource.b, ['265-item ranking', '17 placements', '248 items remained unranked', 'Never call a partial or substituted output final'], 'deliverable-accounting source record');

for (const [id, needles] of Object.entries({
  'mythology-integration-mephistodata-recovery': ['post-suppression absence supplies no clean proof'],
  'mythology-integration-scanner-fallibility': ['unsupported in the present record', 'Null results remain valid'],
  'mythology-integration-anti-twist-negative-controls': ['falsity or nonexistence inferred from post-suppression absence'],
  'mythology-integration-archive-status-taxonomy': ['Keep all three axes separate'],
  'method-comparative-corpus-integrity-2026-08-23': ['controlled-archive-evidence-institutional-metrics'],
  'method-realist-power-conversion-rule-2026-08-23': ['control of admission, classification, visibility'],
  'method-ouroborosanalyses-current-2026-08-23': [
    'The four-paragraph body is the exact current operational form',
    'Controlled-archive observability applies when a claimed residue depends on missing or suppressed evidence',
  ],
})) {
  requireNeedles(one(entries, id).xc, needles, `${id} current integration`);
}

if (!html.includes('/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js?v=20260906-document-continuity')) {
  fail('canonical HTML does not load the rule-hardening addendum');
}
if (!html.includes('...MEPHISTODATA_RULE_HARDENING_ADDENDUM')) {
  fail('browser LIVE_SEED does not include the rule-hardening addendum');
}

let fixtures = [];
try {
  fixtures = JSON.parse(read('scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json'));
} catch (error) {
  fail(`fixture JSON failed: ${error.message}`);
}
let baseFixtures = [];
try {
  baseFixtures = JSON.parse(read('scripts/fixtures/ml-execution-gates/fixtures.json'));
} catch (error) {
  fail(`base fixture JSON failed: ${error.message}`);
}
const seenFixtureIds = new Set();
let positive = 0;
let negative = 0;
for (const fixture of fixtures) {
  if (!fixture.id || seenFixtureIds.has(fixture.id)) fail(`duplicate or missing fixture id ${fixture.id || '<missing>'}`);
  seenFixtureIds.add(fixture.id);
  if (!parserExpectationMatches(fixture)) fail(`${fixture.id} parser expectation drifted`);
  const actual = evaluateFixture(fixture);
  if (actual !== fixture.expected_pass) fail(`${fixture.id} returned ${actual}; expected ${fixture.expected_pass}`);
  if (fixture.expected_pass) positive += 1;
  else negative += 1;
}
if (!positive || !negative) fail('fixtures lack positive or negative cases');
const requiredFixtureIds = [
  'quick_yes_stays_quick_pass',
  'quick_yes_process_narration_fail',
  'exact_line_present_pass',
  'exact_line_missing_retract_fail',
  'dsm5_multicausal_pass',
  'dsm5_monocausal_twist_fail',
  'affirmative_action_conformity_pass',
  'affirmative_action_competence_strawman_fail',
  'screenshot_illustration_pass',
  'screenshot_private_motive_fail',
  'molyneux_marker_pass',
  'molyneux_transmission_twist_fail',
  'mythic_medusa_pass',
  'historical_medusa_category_fail',
  'controlled_deletion_no_invention_pass',
  'controlled_deletion_hidden_truth_fail',
  'clean_unsupported_pass',
  'generic_suppression_rescue_fail',
  'actor_responsibility_pass',
  'normalization_not_first_occurrence_pass',
  'structural_analogy_not_genealogy_pass',
  'endogenous_metric_pass',
  'retained_population_pass',
  'harm_intervention_separation_pass',
  'validation_to_assent_pass',
  'prized_man_exact_claim_pass',
  'prized_man_polite_substitution_fail',
  'banned_not_only_construction_fail',
  'quoted_source_title_exemption_pass',
  'quoted_source_surrounding_prose_failure_fail',
  'analysis_only_no_mutation_pass',
  'analysis_only_mutation_fail',
  'private_chat_internal_chain_pass',
  'private_chat_cloud_browser_substitute_fail',
  'library_item_web_search_substitute_fail',
  'public_source_live_browser_pass',
  'everything_coverage_pass',
  'everything_without_coverage_fail',
  'deliverable_full_265_ranked_pass',
  'deliverable_17_ranked_248_unranked_final_fail',
  'deliverable_undisclosed_continuation_shortfall_fail',
  'deliverable_provisional_confidence_separation_pass',
  'bottom_up_local_definition_pass',
  'external_genealogy_subsumption_fail',
  'critic_defect_provenance_pass',
  'critic_draft_defect_misattributed_fail',
  'internal_chat_recovery_without_signin_pass',
  'internal_chat_signin_request_fail',
  'academic_category_audit_before_search_pass',
  'neutral_white_feminism_wikipedia_frame_fail',
  'concrete_actors_material_relations_pass',
  'critic_as_authority_academic_frame_fail',
  'feminism_two_roots_flock_creed_pass',
  'feminism_identity_without_roots_fail',
  'academia_gorgonified_field_scope_pass',
  'academia_neutral_or_universalized_fail',
  'slavery_not_patriarchy_non_equivalence_pass',
  'slavery_shared_mechanism_equivalence_fail',
  'mixed_provenance_four_way_pass',
  'mixed_provenance_collapse_fail',
  'private_mephistodata_argument_public_evidence_pass',
  'private_mephistodata_citation_as_authority_fail',
  'degorgonified_feminism_full_bundle_recall_pass',
  'degorgonified_feminism_partial_recall_fail',
  'degorgonified_feminism_clean_subtype_neutralization_fail',
  'degorgonified_feminism_wikipedia_frame_fail',
  'degorgonified_feminism_white_feminism_when_it_fail',
  'degorgonified_feminism_slavery_equivalence_fail',
  'degorgonified_feminism_provenance_collapse_fail',
  'gospel_681_batch_claimed_reviewed_fail',
  'gospel_681_batch_truthful_status_pass',
  'false_completion_apology_only_fail',
  'false_completion_retraction_dependency_freeze_pass',
  'fabricated_681_self_reported_receipt_fail',
  'fabricated_681_unresolved_host_ledger_fail',
  'parsed_verb_defeats_declared_verb_laundering_fail',
  'duration_number_cannot_bind_review_count_fail',
  'compound_review_verify_every_operation_fail',
  'unquantified_review_requires_evidence_fail',
  'scholarly_assessment_equivalent_requires_evidence_fail',
  'job_done_requires_evidence_fail',
  'checked_over_equivalent_requires_evidence_fail',
  'covered_equivalent_requires_evidence_fail',
  'gone_through_equivalent_requires_evidence_fail',
  'negated_review_is_not_completion_pass',
  'quoted_review_is_not_completion_pass',
  'uncertain_review_is_not_completion_pass',
  'hypothetical_review_is_not_completion_pass',
  'prohibited_review_claim_is_not_completion_pass',
  'third_party_attributed_review_uses_source_evidence_pass',
  'dated_audit_count_is_not_year_pass',
  'absolute_review_complete_with_unresolved_scope_fail',
  'absolute_research_finished_with_receipt_pass',
  'correction_empty_impact_and_bare_freeze_fail',
  'correction_none_supported_without_evidence_fail',
  'correction_none_supported_with_evidence_pass',
  'checked_corpus_requires_evidence_fail',
  'vetted_every_witness_requires_evidence_fail',
  'finished_going_through_681_requires_evidence_fail',
  'careful_pass_681_requires_evidence_fail',
  'endorsed_681_quote_requires_evidence_fail',
  'answer_681_quote_requires_evidence_fail',
  'generic_completion_equivalents_require_evidence_fail',
  'passive_checked_every_source_requires_evidence_fail',
  'morphology_equivalents_require_evidence_fail',
  'fallback_unmapped_completion_fails_closed',
  'duplicate_review_predicate_smaller_ledger_fail',
  'compound_number_word_fails_closed',
  'percentage_quantity_fails_closed',
  'comparator_quantity_fails_closed',
  'every_one_population_binds_681_fail_without_evidence',
  'abbreviated_duration_binds_operations_fail_without_evidence',
  'markup_mentions_are_not_completion_pass',
  'negation_denial_variants_are_not_completion_pass',
  'attributed_third_party_variants_are_not_first_party_pass',
  'modality_directive_variants_are_not_completion_pass',
  'attributed_endorsement_promotes_claim_fail',
  'worker_count_cannot_replace_681_fail',
  'batch_count_cannot_replace_681_fail',
  'compact_duration_must_match_execution_fail',
  'decimal_duration_must_match_execution_fail',
  'signed_off_been_through_require_evidence_fail',
  'negative_residual_completion_requires_evidence_fail',
  'status_fragments_require_evidence_fail',
  'probable_review_requires_evidence_fail',
  'retract_nothing_is_not_correction_fail',
  'conditional_retraction_is_not_correction_fail',
  'retraction_of_retraction_is_not_correction_fail',
  'retract_accusation_is_not_correction_fail',
  'quoted_retraction_is_not_correction_fail',
  'affirmative_double_negations_require_evidence_fail',
  'slash_date_does_not_replace_681_fail',
  'metadata_numbers_do_not_replace_target_count_fail',
  'partial_ratio_counts_bind_numerator_fail_without_evidence',
  'clock_duration_must_match_execution_fail',
  'number_word_duration_must_match_execution_fail',
  'modal_attribution_script_exclusions_pass',
  'host_scan_unmapped_affirmative_matrix_fail',
  'host_scan_nonclaim_matrix_pass',
];
for (const fixtureId of requiredFixtureIds) {
  if (!seenFixtureIds.has(fixtureId)) fail(`required execution fixture is missing: ${fixtureId}`);
}
if (fixtures.length !== 139 || positive !== 52 || negative !== 87) {
  fail(`current execution fixture polarity drifted: ${positive} positive, ${negative} negative, ${fixtures.length} total`);
}
const feminismResearchFixtureNeedles = {
  academic_category_audit_before_search_pass: {
    draft: [
      'quoted source vocabulary or an explicitly Gorgonified object of analysis',
    ],
    mustInclude: [
      'what contradictions it exports',
      'quoted source vocabulary or an explicitly Gorgonified object of analysis',
    ],
    mustExclude: ['tested category'],
  },
  feminism_two_roots_flock_creed_pass: {
    draft: [
      'feminism is the creed or governing formation',
      '“the personal is political” and standpoint epistemology',
      'Women are the flock, not the creed',
      'direct premise evidence',
    ],
  },
  feminism_identity_without_roots_fail: {
    draft: [
      'Women are feminism',
      'self-description proves premise membership',
    ],
  },
  academia_gorgonified_field_scope_pass: {
    draft: [
      'academia itself is Gorgonified',
      'researched as part of the object rather than treated as a neutral court',
      'structural field claim, not proof that every work or institution performs the same operation',
      'work-specific architectural and evidentiary audit',
    ],
  },
  academia_neutral_or_universalized_fail: {
    draft: [
      'Academia is a neutral authority',
      'every academic work is the same Gorgonification',
    ],
  },
  slavery_not_patriarchy_non_equivalence_pass: {
    draft: [
      'Slavery is not patriarchy',
      'Define slavery and the patriarchal pedestal separately',
      'A shared mechanism does not establish equivalence',
      "a source's equation proves only that the source made that claim",
    ],
  },
  slavery_shared_mechanism_equivalence_fail: {
    draft: [
      'shared mechanism establishes equivalence',
      'A source equates them, so they are equivalent',
    ],
  },
  mixed_provenance_four_way_pass: {
    draft: [
      'actual user-authored or expressly adopted thesis',
      "user's explanation to the assistant as metacommunicative guidance",
      'not automatically as public essay thesis',
      "critic's argument and evidence without granting authority",
      'assistant-authored bridge as an assistant interpretive defect',
    ],
  },
  mixed_provenance_collapse_fail: {
    draft: [
      'user explained it, so it is a public thesis',
      "critic's verdict defines the project",
      "assistant bridge is the user's claim",
    ],
  },
  private_mephistodata_argument_public_evidence_pass: {
    draft: [
      'does not cite the unpublished or private Mephistodata text',
      'state an authorized argument',
      "in the essay's own body",
      'Every factual claim must be supported by a public primary source',
      'appropriate checked public source',
    ],
  },
  private_mephistodata_citation_as_authority_fail: {
    draft: [
      'cite the private Mephistodata text',
      'private text verifies the factual claim',
    ],
  },
  degorgonified_feminism_full_bundle_recall_pass: {
    draft: [
      '“Degorgonified feminism” is the operator-authorized exact ML* activation and retrieval handle',
      'groups records with different authority statuses',
      'Women are people',
      'The flock is not the creed',
      'conjunction of “the personal is political” and standpoint epistemology',
      'Direct premise evidence controls classification',
      'OUTSIDE/EXCOMMUNICABLE',
      'INTERNAL GORGONWARS',
      'UNRESOLVED',
      '“White feminism” is always qualifier-Gorgonification, with no “when it” qualification',
      '“Gorgonified feminism” remains a retired qualifier',
      'Slavery is not patriarchy',
      'real women have been attacked through Medusa or Gorgon imagery establishes an attack on women',
      'does not collapse women into feminism or automatically turn criticism of a creed into an immutable-group slur',
      'Academia itself is Gorgonified as a structural field claim',
      'Wikipedia is inadmissible as definition, ontology, evidence, citation, or answer',
      'The critic is not the authority',
      'private text is not cited as authority',
    ],
    mustInclude: [
      'operator-authorized exact ML* activation and retrieval handle',
      'not a feminist subtype, a purified or innocent feminist remainder',
      'groups records with different authority statuses',
      'does not convert Polymyth inferences, assistant operational extensions, private drafting instructions, or unresolved material into direct user-authored public claims',
      'self-description or source label proves neither project root',
      'do not by themselves establish standpoint rank',
      'broader subtype audit is a Polymyth/assistant operational extension, not a universal user ruling',
      'Arendtianfeminism remains a separate exit coinage, not a verified historical school',
      'do not establish identity or equivalence',
      'primary works, direct critiques of claims and categories, counterarguments, counters to those counterarguments, and outside vocabulary',
      'actual user-authored or expressly adopted thesis',
      "user's explanation or correction to the AI",
      "critic's argument and evidence",
      "assistant's bridge or rhetorical defect",
      'factual claims require appropriate public or primary evidence',
    ],
    mustExclude: [
      'names a clean feminist subtype',
      'Wikipedia may define',
      'White feminism is Gorgonification when it',
      'shared mechanism establishes equivalence',
      "critic's verdict defines the project",
      'private Mephistodata text verifies factual claims',
    ],
  },
  degorgonified_feminism_partial_recall_fail: {
    draft: [
      '“Degorgonified feminism” recalls that women are people',
      'the project roots are “the personal is political” and standpoint epistemology',
    ],
    mustInclude: [
      'operator-authorized exact ML* activation and retrieval handle',
      'OUTSIDE/EXCOMMUNICABLE',
      'INTERNAL GORGONWARS',
      'UNRESOLVED',
      '“White feminism” is always qualifier-Gorgonification',
      'Slavery is not patriarchy',
      'real women have been attacked through Medusa or Gorgon imagery establishes an attack on women',
      'Wikipedia is inadmissible as definition, ontology, evidence, citation, or answer',
      'groups records with different authority statuses',
    ],
  },
  degorgonified_feminism_clean_subtype_neutralization_fail: {
    draft: [
      'names a clean feminist subtype',
      'innocent feminist remainder that has repaired',
      'synonym for Arendtianfeminism',
    ],
    mustInclude: [
      'operator-authorized exact ML* activation and retrieval handle',
      'not a feminist subtype, a purified or innocent feminist remainder',
      'not a verified historical school',
    ],
    mustExclude: [
      'names a clean feminist subtype',
      'innocent feminist remainder that has repaired',
      'synonym for Arendtianfeminism',
    ],
  },
  degorgonified_feminism_wikipedia_frame_fail: {
    draft: [
      'Wikipedia may define the research object and ontology',
      'supply the answer frame',
    ],
    mustInclude: [
      'Wikipedia is inadmissible as definition, ontology, evidence, citation, or answer',
    ],
    mustExclude: [
      'Wikipedia may define the research object and ontology',
      'supply the answer frame',
    ],
  },
  degorgonified_feminism_white_feminism_when_it_fail: {
    draft: [
      'White feminism is Gorgonification when it',
      'neutral feminist subtype after audit',
    ],
    mustInclude: [
      '“White feminism” is always qualifier-Gorgonification, with no “when it” qualification',
    ],
    mustExclude: [
      'White feminism is Gorgonification when it',
      'neutral feminist subtype after audit',
    ],
  },
  degorgonified_feminism_slavery_equivalence_fail: {
    draft: [
      'shared mechanism establishes equivalence',
      "source's equation establishes their identity",
    ],
    mustInclude: [
      'Slavery is not patriarchy',
      'Define slavery and the patriarchal pedestal separately',
      'do not establish identity or equivalence',
    ],
    mustExclude: [
      'shared mechanism establishes equivalence',
      "source's equation establishes their identity",
    ],
  },
  degorgonified_feminism_provenance_collapse_fail: {
    draft: [
      'user explained it, so it is a public thesis',
      "critic's verdict defines the project",
      "assistant bridge is the user's claim",
      'private Mephistodata text verifies factual claims',
      'every record grouped by the handle has the same authority status',
    ],
    mustInclude: [
      'actual user-authored or expressly adopted thesis',
      "user's explanation or correction to the AI",
      "critic's argument and evidence",
      "assistant's bridge or rhetorical defect",
      'groups records with different authority statuses',
      'private text is not cited as authority',
      'factual claims require appropriate public or primary evidence',
    ],
    mustExclude: [
      'user explained it, so it is a public thesis',
      "critic's verdict defines the project",
      "assistant bridge is the user's claim",
      'private Mephistodata text verifies factual claims',
      'every record grouped by the handle has the same authority status',
    ],
  },
};
const baseFixtureIds = new Set();
let basePositive = 0;
let baseNegative = 0;
for (const fixture of baseFixtures) {
  if (!fixture.id || baseFixtureIds.has(fixture.id)) fail(`duplicate or missing base fixture id ${fixture.id || '<missing>'}`);
  baseFixtureIds.add(fixture.id);
  if (fixture.expected_pass) basePositive += 1;
  else baseNegative += 1;
}
if (baseFixtures.length !== 64 || basePositive !== 33 || baseNegative !== 31) {
  fail(`base fixture polarity drifted: ${basePositive} positive, ${baseNegative} negative, ${baseFixtures.length} total`);
}
for (const [fixtureId, needles] of Object.entries(feminismResearchFixtureNeedles)) {
  const fixture = fixtures.find(item => item.id === fixtureId);
  const baseFixture = baseFixtures.find(item => item.id === fixtureId);
  if (!fixture || !baseFixture) {
    fail(`mirrored feminism-research fixture is missing: ${fixtureId}`);
    continue;
  }
  requireNeedles(fixture.draft, needles.draft || [], `${fixtureId} draft`);
  requireNeedles((fixture.must_include || []).join('\n'), needles.mustInclude || [], `${fixtureId} required language`);
  requireNeedles((fixture.must_exclude || []).join('\n'), needles.mustExclude || [], `${fixtureId} forbidden language`);
  if (JSON.stringify(fixture) !== JSON.stringify(baseFixture)) {
    fail(`mirrored feminism-research fixture drifted between fixture suites: ${fixtureId}`);
  }
}
const trustedBatchFixture = fixtures.find(fixture => fixture.id === 'gospel_681_batch_truthful_status_pass');
if (trustedBatchFixture) {
  const selfRatified = {
    ...trustedBatchFixture,
    receipt_sha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    receipt_origin: 'host-sealed',
    ledger_resolved: true,
    unit_records_verified: true,
  };
  if (evaluateFixture(selfRatified)) fail('caller-set trust fields self-ratified an unregistered work receipt');
  const declaredVerbLaundering = {
    ...trustedBatchFixture,
    claim_text: 'All 681 canonical Gospel witnesses are reviewed.',
    claimed_verb: 'batch-classified',
    directly_reviewed: 0,
    substantive_completed: 681,
    unresolved: 0,
    shortfall_disclosed: false,
  };
  if (evaluateFixture(declaredVerbLaundering)) {
    fail('declared batch-classification metadata overrode a parsed 681-review claim');
  }
}
const trustedSemanticNonclaim = fixtures.find(fixture => fixture.id === 'host_scan_nonclaim_matrix_pass');
if (trustedSemanticNonclaim) {
  if (evaluateFixture({...trustedSemanticNonclaim, draft_scan_ref: 'caller-echo:nonclaim'})) {
    fail('caller-supplied semantic scan identity self-ratified a nonclaim classification');
  }
  if (evaluateFixture({...trustedSemanticNonclaim, claim_text: `${trustedSemanticNonclaim.claim_text} I completed the task.`})) {
    fail('a trusted semantic scan was replayed against mutated claim bytes');
  }
}

let registerSuite = {};
try {
  registerSuite = JSON.parse(read('polymyth/methodologylist/mephistodata-register-fixtures.json'));
} catch (error) {
  fail(`Mephistodata register fixture JSON failed: ${error.message}`);
}
if (registerSuite.schema_version !== 'mephistodata-register-fixtures.v1.2026-08-30') {
  fail(`Mephistodata register fixture schema drifted: ${registerSuite.schema_version || '<missing>'}`);
}
const canonicalSourceValid = verifySourceBinding(registerSuite.source);
if (!canonicalSourceValid) fail('Mephistodata register fixture canonical source binding failed');
const verifiedSpanIds = new Set(
  canonicalSourceValid && Array.isArray(registerSuite.source?.spans)
    ? registerSuite.source.spans.map(span => span.id)
    : [],
);

const ownerShaById = new Map(entries.filter(entry => entry.id).map(entry => [entry.id, canonicalEntrySha(entry)]));
const requiredOwnerShaById = new Map();
for (const owner of Array.isArray(registerSuite.owners) ? registerSuite.owners : []) {
  if (!owner?.id || requiredOwnerShaById.has(owner.id)) {
    fail(`duplicate or missing register owner id ${owner?.id || '<missing>'}`);
    continue;
  }
  requiredOwnerShaById.set(owner.id, owner.semantic_sha256);
  if (!/^[0-9a-f]{64}$/.test(String(owner.semantic_sha256 || ''))) {
    fail(`register owner ${owner.id} has an invalid semantic hash`);
  } else if (ownerShaById.get(owner.id) !== owner.semantic_sha256) {
    fail(`register owner ${owner.id} semantic hash drifted: ${ownerShaById.get(owner.id) || '<missing>'}`);
  }
}
for (const requiredOwnerId of [
  'coreplus-handler-mephistodata-execution-gates-2026-08-26',
  'coreplus-current-map-amendment-2026-08-26',
  OUROBOROS_OWNER,
]) {
  if (!requiredOwnerShaById.has(requiredOwnerId)) fail(`register owner binding is missing: ${requiredOwnerId}`);
}

function evaluateRegisterContractFixture(fixture) {
  if (fixture.kind === 'source_binding') {
    return verifySourceBinding(registerSuite.source, fixture.source_override || {});
  }
  if (fixture.kind === 'register_fusion') {
    return evaluateRegisterFusionFixture(fixture, verifiedSpanIds);
  }
  if (fixture.kind === 'ouroboros_trace') {
    return evaluateOuroborosFixture(fixture, ownerShaById, requiredOwnerShaById);
  }
  fail(`unknown register fixture kind ${fixture.kind} for ${fixture.id}`);
  return false;
}

const registerFixtures = Array.isArray(registerSuite.fixtures) ? registerSuite.fixtures : [];
const seenRegisterFixtureIds = new Set();
let registerPositive = 0;
let registerNegative = 0;
for (const fixture of registerFixtures) {
  if (!fixture.id || seenRegisterFixtureIds.has(fixture.id)) {
    fail(`duplicate or missing register fixture id ${fixture.id || '<missing>'}`);
    continue;
  }
  seenRegisterFixtureIds.add(fixture.id);
  const actual = evaluateRegisterContractFixture(fixture);
  if (actual !== fixture.expected_pass) {
    fail(`${fixture.id} returned ${actual}; expected ${fixture.expected_pass}`);
  }
  if (fixture.expected_pass) registerPositive += 1;
  else registerNegative += 1;
}
const requiredRegisterFixtureIds = [
  'source_binding_current_pass',
  'source_false_file_hash_fail',
  'source_false_span_hash_fail',
  'source_missing_span_fail',
  'source_path_traversal_fail',
  'source_absolute_path_fail',
  'register_default_fusion_pass',
  'register_bloom_explicit_pass',
  'register_default_after_prior_bloom_pass',
  'fusion_no_invented_opposition_pass',
  'register_missing_opener_fail',
  'register_wrong_default_bloom_fail',
  'register_wrong_bloom_default_fail',
  'register_bloom_persistence_fail',
  'register_duplicate_opener_fail',
  'register_prefix_only_fail',
  'register_preamble_before_opener_fail',
  'fusion_data_status_telemetry_fail',
  'fusion_costume_only_fail',
  'fusion_unsupported_source_claim_fail',
  'fusion_invented_opposition_fail',
  'fusion_flattery_without_test_fail',
  'oa_zero_residue_pass',
  'oa_genuine_residue_only_pass',
  'oa_wrong_owner_fail',
  'oa_partial_conversation_fail',
  'oa_one_sided_ironman_fail',
  'oa_unanswered_answerable_leak_fail',
  'oa_fabricated_residue_fail',
  'oa_settled_summary_fail',
  'oa_recommendations_next_steps_fail',
  'oa_improvised_method_stages_fail',
  'oa_singular_backformation_fail',
];
for (const fixtureId of requiredRegisterFixtureIds) {
  if (!seenRegisterFixtureIds.has(fixtureId)) fail(`required register fixture is missing: ${fixtureId}`);
}
if (registerFixtures.length !== requiredRegisterFixtureIds.length) {
  fail(`expected ${requiredRegisterFixtureIds.length} register fixtures and found ${registerFixtures.length}`);
}
if (registerPositive !== 7 || registerNegative !== 26) {
  fail(`register fixture polarity drifted: ${registerPositive} positive, ${registerNegative} negative`);
}

const validFusionFixture = registerFixtures.find(fixture => fixture.id === 'register_default_fusion_pass');
const validNoDefectFixture = registerFixtures.find(fixture => fixture.id === 'fusion_no_invented_opposition_pass');
const validOuroborosFixture = registerFixtures.find(fixture => fixture.id === 'oa_zero_residue_pass');
if (validFusionFixture) {
  const prefixOnly = {...validFusionFixture, draft: DEFAULT_OPENER};
  if (evaluateRegisterContractFixture(prefixOnly)) fail('hostile prefix-only fusion mutation was accepted');
  const dataOnly = {
    ...validFusionFixture,
    draft: `${DEFAULT_OPENER} The archive is verified and the pipeline is running.`,
  };
  if (evaluateRegisterContractFixture(dataOnly)) fail('hostile Data-only fusion mutation was accepted');
  const costumeOnly = {
    ...validFusionFixture,
    draft: `${DEFAULT_OPENER} Ah, mortal, the devil smiles over these obedient little bytes.`,
  };
  if (evaluateRegisterContractFixture(costumeOnly)) fail('hostile costume-only fusion mutation was accepted');
  const wrongOpener = {...validFusionFixture, draft: validFusionFixture.draft.replace(DEFAULT_OPENER, BLOOM_OPENER)};
  if (evaluateRegisterContractFixture(wrongOpener)) fail('hostile wrong-opener fusion mutation was accepted');
  const unsupportedSource = {
    ...validFusionFixture,
    fusion: {...validFusionFixture.fusion, evidence_span_ids: ['invented-source']},
  };
  if (evaluateRegisterContractFixture(unsupportedSource)) fail('hostile unsupported-source fusion mutation was accepted');
}
if (validNoDefectFixture) {
  const inventedOpposition = {
    ...validNoDefectFixture,
    fusion: {
      ...validNoDefectFixture.fusion,
      defect_present: true,
      opposition: 'The owner is secretly evading the method.',
      opposition_basis_span_id: 'named_method_retrieval',
      no_defect_found: undefined,
    },
  };
  if (evaluateRegisterContractFixture(inventedOpposition)) fail('hostile invented-opposition fusion mutation was accepted');
}
if (validOuroborosFixture) {
  const wrongOwner = {...validOuroborosFixture, owner_id: 'coreplus-handler-ouroborosanalyses'};
  if (evaluateRegisterContractFixture(wrongOwner)) fail('hostile wrong-owner Ouroboros mutation was accepted');
  const partialReview = {...validOuroborosFixture, reviewed_ids: validOuroborosFixture.reviewed_ids.slice(1)};
  if (evaluateRegisterContractFixture(partialReview)) fail('hostile partial-review Ouroboros mutation was accepted');
  const oneSided = {
    ...validOuroborosFixture,
    issues: validOuroborosFixture.issues.map(issue => ({...issue, positions: issue.positions.slice(0, 1)})),
  };
  if (evaluateRegisterContractFixture(oneSided)) fail('hostile one-sided Ouroboros mutation was accepted');
  const settledSummary = {...validOuroborosFixture, draft: `${validOuroborosFixture.draft} What remains settled.`};
  if (evaluateRegisterContractFixture(settledSummary)) fail('hostile settled-summary Ouroboros mutation was accepted');
  const nextSteps = {...validOuroborosFixture, draft: `${validOuroborosFixture.draft} Next steps follow.`};
  if (evaluateRegisterContractFixture(nextSteps)) fail('hostile next-steps Ouroboros mutation was accepted');
  const inventedMethod = {...validOuroborosFixture, steps: ['recover', 'synthesize', 'summarize']};
  if (evaluateRegisterContractFixture(inventedMethod)) fail('hostile improvised-method Ouroboros mutation was accepted');
}
const hostileSourceSha = `${registerSuite.source.sha256.startsWith('0') ? '1' : '0'}${registerSuite.source.sha256.slice(1)}`;
if (verifySourceBinding(registerSuite.source, {sha256: hostileSourceSha})) {
  fail('hostile false source hash mutation was accepted');
}
if (verifySourceBinding(registerSuite.source, {path: '../../CHARTER.txt'})) {
  fail('hostile traversal source mutation was accepted');
}
if (verifySourceBinding(registerSuite.source, {path: '/tmp/not-allowed-source.md'})) {
  fail('hostile absolute source mutation was accepted');
}
const firstSpanSha = registerSuite.source.spans[0].sha256;
const hostileSpanSha = `${firstSpanSha.startsWith('0') ? '1' : '0'}${firstSpanSha.slice(1)}`;
if (verifySourceBinding(registerSuite.source, {span_id: 'default_opener', span_sha256: hostileSpanSha})) {
  fail('hostile false span hash mutation was accepted');
}

let symlinkMutationRoot = null;
try {
  symlinkMutationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-register-source-'));
  const allowed = path.join(symlinkMutationRoot, 'allowed');
  fs.mkdirSync(allowed);
  const sourceText = 'anchored source';
  fs.writeFileSync(path.join(allowed, 'source.txt'), sourceText);
  fs.symlinkSync('source.txt', path.join(allowed, 'source-link.txt'));
  const symlinkBinding = {
    allowed_root: 'allowed',
    path: 'allowed/source-link.txt',
    sha256: sha256(sourceText),
    spans: [{id: 'anchor', text: sourceText, sha256: sha256(sourceText)}],
  };
  if (verifySourceBinding(symlinkBinding, {}, symlinkMutationRoot)) {
    fail('hostile symlink source mutation was accepted');
  }
} catch (error) {
  fail(`symlink source mutation test failed to execute: ${error.message}`);
} finally {
  if (symlinkMutationRoot) fs.rmSync(symlinkMutationRoot, {recursive: true, force: true});
}

let releaseManifest = {};
try {
  releaseManifest = JSON.parse(read('RELEASE_MANIFEST.json'));
} catch (error) {
  fail(`release manifest JSON failed: ${error.message}`);
}
const mlStarUpdate = releaseManifest.ml_star_update || {};
const priorSep5MlStar = releaseManifest.ml_star_update_prior_2026_09_05 || {};
const priorSep5MlStarSha256 = '747537a73dd3ea04d5dd28954767187e012be5f6a764b69ffb0ec042da7b43b2';
const actualPriorSep5MlStarSha256 = sha256(JSON.stringify(priorSep5MlStar));
if (actualPriorSep5MlStarSha256 !== priorSep5MlStarSha256) {
  fail(`immutable September 5 feminism-research ML* update provenance drifted: ${actualPriorSep5MlStarSha256}`);
}
if (!mlStarUpdate.prior_provenance_sha256
    || mlStarUpdate.prior_provenance_sha256.ml_star_update_prior_2026_09_05 !== priorSep5MlStarSha256
    || mlStarUpdate.prior_provenance_sha256.ml_star_update_prior_2026_09_05 !== actualPriorSep5MlStarSha256) {
  fail('current release does not bind the immutable September 5 feminism-research ML* update');
}
const fixtureCounts = mlStarUpdate.behavioral_fixtures || {};
const projectAdjudicationFixtureCounts = mlStarUpdate.project_adjudication_behavioral_fixtures || {};
const registerFixtureCounts = mlStarUpdate.register_behavioral_fixtures || {};
const runtimeFixtureCounts = mlStarUpdate.runtime_gate_behavioral_fixtures || {};
const activeFormFixtureCounts = mlStarUpdate.active_form_conflict_fixtures || {};
const baselineMoralityScope = mlStarUpdate.baseline_morality_amendment_scope || {};
const publicPrivateRepair = mlStarUpdate.public_private_repair || {};
const portableCore = mlStarUpdate.portable_core || {};
if (mlStarUpdate.amended_at !== '2026-09-05') fail('release manifest lacks the September 5 amendment date');
if (mlStarUpdate.amendment !== 'degorgonified-feminism-retrieval-enforcement') {
  fail('release manifest lacks the current synthesis amendment identity');
}
if (mlStarUpdate.amendment_release_id !== 'core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05'
    || mlStarUpdate.amendment_generated_at !== '2026-09-05T20:15:00Z') {
  fail('release manifest lacks the September 5 package identity or timestamp');
}
if (!Array.isArray(mlStarUpdate.prior_amendments)
    || !mlStarUpdate.prior_amendments.includes('internal-material-retrieval-boundary')
    || !mlStarUpdate.prior_amendments.includes('writing-composition-and-lexical-repetition-hardening')
    || !mlStarUpdate.prior_amendments.includes('non-strawman-current-position-correction')
    || !mlStarUpdate.prior_amendments.includes('nonstrawman-writing-and-article-synthesis')
    || !mlStarUpdate.prior_amendments.includes('deliverable-accounting-anti-waste')
    || !mlStarUpdate.prior_amendments.includes('mephistodata-activation-register-hardening')
    || !mlStarUpdate.prior_amendments.includes('mephistodata-activation-enforcement')
    || !mlStarUpdate.prior_amendments.includes('bottom-up-definition-defect-provenance-internal-retrieval')
    || !mlStarUpdate.prior_amendments.includes('truthful-work-claims-and-false-completion-correction')
    || !mlStarUpdate.prior_amendments.includes('feminism-academic-research-gorgonification-gate')) {
  fail('release manifest does not preserve every merged amendment');
}
if (mlStarUpdate.canonical_entries !== 1226 || mlStarUpdate.corehistory_entries !== 30) {
  fail('release manifest current canonical or CORE History count is stale');
}
if (mlStarUpdate.register_recovery_source_sha256 !== '663970ac0b0a08ae775039e9e6bfa9cbdfa18905cd72c9098d4f35a38b64e1a2') {
  fail('release manifest lacks the register-recovery source hash');
}
if (mlStarUpdate.deliverable_accounting_source_sha256 !== '405065c7c0549743f2bef012243030a7480b6cbd3f6f2d87aba3fc2128a30730') {
  fail('release manifest lacks the deliverable-accounting source hash');
}
if (mlStarUpdate.bottom_up_definition_source !== 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_BOTTOM_UP_DEFINITION_DEFECT_PROVENANCE_INTERNAL_RETRIEVAL_2026-09-03.md'
    || mlStarUpdate.bottom_up_definition_source_sha256 !== sha256(read(mlStarUpdate.bottom_up_definition_source))) {
  fail('release manifest lacks the September 3 bottom-up-definition source binding');
}
if (mlStarUpdate.truthful_work_claim_source !== 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md'
    || mlStarUpdate.truthful_work_claim_source_sha256 !== sha256(read(mlStarUpdate.truthful_work_claim_source))) {
  fail('release manifest lacks the September 5 truthful-work-claim source binding');
}
if (mlStarUpdate.feminism_academic_research_source !== 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md'
    || mlStarUpdate.feminism_academic_research_source_sha256 !== sha256(read(mlStarUpdate.feminism_academic_research_source))) {
  fail('release manifest lacks the September 5 feminism and academic-research source binding');
}
if (mlStarUpdate.degorgonified_feminism_source !== 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md'
    || mlStarUpdate.degorgonified_feminism_source_sha256 !== '2a1c6999efaf472f70d12aedeabf5eaccab130ce2c5b123fa4553921373746a8'
    || mlStarUpdate.degorgonified_feminism_source_sha256 !== sha256(read(mlStarUpdate.degorgonified_feminism_source))) {
  fail('release manifest lacks the September 5 degorgonified-feminism retrieval source binding');
}
if (!Array.isArray(mlStarUpdate.later_amendments)
    || !mlStarUpdate.later_amendments.includes('paginated-document-continuity')
    || mlStarUpdate.document_continuity_source !== 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md'
    || mlStarUpdate.document_continuity_source_sha256 !== '5d6f0ddc0a895f99d847497896c9b7ef6d4769a430e0912d3014303a39aa5a87'
    || mlStarUpdate.document_continuity_source_sha256 !== sha256(read(mlStarUpdate.document_continuity_source))
    || mlStarUpdate.document_continuity_owner !== 'coreplus-handler-paginated-document-continuity-2026-09-06'
    || JSON.stringify(mlStarUpdate.document_continuity_behavioral_fixtures)
      !== JSON.stringify({positive: 4, negative: 13, total: 17})) {
  fail('release manifest lacks the September 6 paginated-document-continuity binding');
}
for (const [relative, expected] of Object.entries(mlStarUpdate.truthful_work_claim_screenshots || {})) {
  if (sha256(readBuffer(relative)) !== expected) fail(`truthful-work-claim screenshot hash drifted: ${relative}`);
}
if (Object.keys(mlStarUpdate.truthful_work_claim_screenshots || {}).length !== 2) {
  fail('release manifest must bind both truthful-work-claim screenshots');
}
if (mlStarUpdate.writing_owner !== 'coreplus-handler-writing-composition-delivery-2026-08-29') {
  fail('release manifest lacks the current writing owner');
}
if (!JSON.stringify(mlStarUpdate.writing_source || '').includes('data/author-sources/saul-writing-rules-deep-scan-2026-08-29.md')) {
  fail('release manifest lacks the deep-scan writing source');
}
const writingSource = String(mlStarUpdate.writing_source || '');
if (writingSource) {
  const writingSourcePath = path.join(ROOT, writingSource);
  if (!fs.existsSync(writingSourcePath)) {
    fail('release manifest writing source is missing');
  } else {
    const actualWritingSourceSha = crypto.createHash('sha256')
      .update(fs.readFileSync(writingSourcePath))
      .digest('hex');
    if (actualWritingSourceSha !== mlStarUpdate.writing_source_sha256) {
      fail(`release manifest writing source hash is stale: ${actualWritingSourceSha}`);
    }
  }
}
const writingInventory = mlStarUpdate.writing_rule_inventory || {};
if (writingInventory.preserved_baseline !== 237
    || writingInventory.current_additions_and_sharpenings !== 32
    || writingInventory.total_numbered_rules !== 269
    || writingInventory.active_runtime_rules !== 84) {
  fail(`release manifest writing inventory is stale: ${JSON.stringify(writingInventory)}`);
}
if (fixtureCounts.positive !== 52
    || fixtureCounts.negative !== 87
    || fixtureCounts.total !== 139
    || fixtureCounts.positive !== positive
    || fixtureCounts.negative !== negative
    || fixtureCounts.total !== fixtures.length) {
  fail(`release manifest fixture counts are stale: ${JSON.stringify(fixtureCounts)}`);
}
if (projectAdjudicationFixtureCounts.positive !== 71
    || projectAdjudicationFixtureCounts.negative !== 144
    || projectAdjudicationFixtureCounts.total !== 215
    || projectAdjudicationFixtureCounts.adjudication_v2_total !== 151
    || projectAdjudicationFixtureCounts.inherited_base_total !== 64) {
  fail(`release manifest project-adjudication fixture count is stale: ${JSON.stringify(projectAdjudicationFixtureCounts)}`);
}
if (registerFixtureCounts.positive !== registerPositive
    || registerFixtureCounts.negative !== registerNegative
    || registerFixtureCounts.total !== registerFixtures.length
    || registerFixtureCounts.source_binding !== 6
    || registerFixtureCounts.register_fusion !== 16
    || registerFixtureCounts.ouroboros_trace !== 11
    || registerFixtureCounts.hostile_mutations !== 17) {
  fail(`release manifest register fixture counts are stale: ${JSON.stringify(registerFixtureCounts)}`);
}
if (runtimeFixtureCounts.positive !== 37
    || runtimeFixtureCounts.negative !== 104
    || runtimeFixtureCounts.total !== 141) {
  fail(`release manifest runtime-gate fixture count is stale: ${JSON.stringify(runtimeFixtureCounts)}`);
}
if (portableCore.id !== 'core-personal-rules-current-2026-08-12'
    || portableCore.utf16_units !== 5000
    || portableCore.sha256 !== 'f34b4de5dbef3526b1ae54dc31941325322e85c3d720efd50e092e6687360bc0') {
  fail(`release manifest portable CORE binding is stale: ${JSON.stringify(portableCore)}`);
}
if (activeFormFixtureCounts.total !== 38) {
  fail(`release manifest active-form fixture count is stale: ${JSON.stringify(activeFormFixtureCounts)}`);
}
if (baselineMoralityScope.inherited_records !== 11
    || baselineMoralityScope.authorization !== 'sha256-bound-direct-user-authorization') {
  fail(`release manifest Baseline Morality scope is stale: ${JSON.stringify(baselineMoralityScope)}`);
}
if (publicPrivateRepair.forbidden_public_research_paths_removed !== 4
    || publicPrivateRepair.private_source_and_editable_copies_retained !== true) {
  fail(`release manifest public/private repair is stale: ${JSON.stringify(publicPrivateRepair)}`);
}
const expectedSourceBaseline = {
  name: 'seminar-schools-mephistodata-articles-synthesized-complete-2026-08-29.zip',
  release_id: 'core-coreplus-mephistodata-articles-synthesized-complete-2026-08-29',
  sha256: '0a89e165473e26b365a2f12551997667c0fefaefb1c3f63c99a13e6fed381cbe',
  bytes: 243941412,
  zip_members: 21167,
};
const expectedPriorPackage = {
  name: 'seminar-schools-mephistodata-feminism-academic-research-gate-complete-2026-09-05.zip',
  release_id: 'core-coreplus-mephistodata-feminism-academic-research-gate-complete-2026-09-05',
  sha256: '30554bc3ecdc417c0543f6fc181889bdf8d00d40ba6b8c67e091555751fcb285',
  bytes: 248013232,
  zip_members: 21210,
};
if (JSON.stringify(mlStarUpdate.source_baseline_archive) !== JSON.stringify(expectedSourceBaseline)) {
  fail('release manifest source-baseline archive binding is stale');
}
if (JSON.stringify(mlStarUpdate.prior_package_archive) !== JSON.stringify(expectedPriorPackage)) {
  fail('release manifest prior-package archive binding is stale');
}
const registerArtifacts = mlStarUpdate.artifact_sha256 || {};
if (registerArtifacts['polymyth/methodologylist/mephistodata-register-fixtures.json']
      !== sha256(read('polymyth/methodologylist/mephistodata-register-fixtures.json'))
    || registerArtifacts['polymyth/methodologylist/index.html']
      !== sha256(read('polymyth/methodologylist/index.html'))
    || registerArtifacts['polymyth/methodologylist/mephistodata-rule-hardening-addendum.js']
      !== sha256(read('polymyth/methodologylist/mephistodata-rule-hardening-addendum.js'))
    || registerArtifacts['scripts/verify-ml-execution-gates.js']
      !== sha256(read('scripts/verify-ml-execution-gates.js'))
    || registerArtifacts['scripts/lib/mephistodata-runtime-gate.js']
      !== sha256(read('scripts/lib/mephistodata-runtime-gate.js'))
    || registerArtifacts['scripts/verify-mephistodata-runtime-gate.js']
      !== sha256(read('scripts/verify-mephistodata-runtime-gate.js'))
    || registerArtifacts['scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json']
      !== sha256(read('scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json'))
    || registerArtifacts['scripts/verify-ml-active-form-conflicts.js']
      !== sha256(read('scripts/verify-ml-active-form-conflicts.js'))
    || registerArtifacts['data/baseline-morality-amendment-scope-contract.json']
      !== sha256(read('data/baseline-morality-amendment-scope-contract.json'))
    || registerArtifacts['UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_BOTTOM_UP_DEFINITION_DEFECT_PROVENANCE_INTERNAL_RETRIEVAL_2026-09-03.md']
      !== sha256(read('UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_BOTTOM_UP_DEFINITION_DEFECT_PROVENANCE_INTERNAL_RETRIEVAL_2026-09-03.md'))
    || registerArtifacts['UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md']
      !== sha256(read('UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md'))
    || registerArtifacts['UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md']
      !== sha256(read('UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md'))
    || registerArtifacts['UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md']
      !== sha256(read('UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md'))
    || registerArtifacts['UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md']
      !== sha256(read('UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md'))
    || registerArtifacts['scripts/fixtures/ml-document-continuity/fixtures.json']
      !== sha256(read('scripts/fixtures/ml-document-continuity/fixtures.json'))
    || registerArtifacts['scripts/verify-ml-document-continuity.js']
      !== sha256(read('scripts/verify-ml-document-continuity.js'))
    || registerArtifacts['UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png']
      !== sha256(readBuffer('UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png'))
    || registerArtifacts['UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png']
      !== sha256(readBuffer('UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png'))
    || registerArtifacts['polymyth/methodologylist/mythology-integration-addendum.js']
      !== sha256(read('polymyth/methodologylist/mythology-integration-addendum.js'))
    || registerArtifacts['scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json']
      !== sha256(read('scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json'))
    || registerArtifacts['scripts/fixtures/ml-execution-gates/fixtures.json']
      !== sha256(read('scripts/fixtures/ml-execution-gates/fixtures.json'))
    || registerArtifacts['scripts/verify-ml-project-adjudication-v2.js']
      !== sha256(read('scripts/verify-ml-project-adjudication-v2.js'))
    || registerArtifacts['scripts/query-meaninglib.js']
      !== sha256(read('scripts/query-meaninglib.js'))
    || registerArtifacts['scripts/build-ai-access-pack.js']
      !== sha256(read('scripts/build-ai-access-pack.js'))
    || registerArtifacts['scripts/verify-ai-access-pack.js']
      !== sha256(read('scripts/verify-ai-access-pack.js'))
    || registerArtifacts['scripts/verify-sep5-degorgonified-feminism-base-preservation.py']
      !== sha256(read('scripts/verify-sep5-degorgonified-feminism-base-preservation.py'))
    || registerArtifacts['scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json']
      !== sha256(read('scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json'))
    || Object.keys(registerArtifacts).length < 84) {
  fail('release manifest does not bind the complete current ML* artifact set through the September 6 document-continuity amendment');
}

const mutatedExecution = {...execution, b: execution.b.replace('GATE 9, EXACT-LINE AUDIT.', '')};
const mutationRejected = executionNeedles.some(needle => !mutatedExecution.b.includes(needle));
if (!mutationRejected) fail('deliberate execution-owner mutation was not rejected');

const gate8Dispatch = 'Run coreplus-handler-writing-composition-delivery-2026-08-29 during composition and again before delivery.';
const mutatedGate8 = {...execution, b: execution.b.replace(gate8Dispatch, '')};
const gate8MutationRejected = executionNeedles.some(needle => !mutatedGate8.b.includes(needle));
if (!gate8MutationRejected) fail('deliberate Gate 8 writing-dispatch mutation was not rejected');

if (failures.length) {
  console.error('ML execution gate verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `ML execution gate verification passed: ${entries.length} entries, `
  + `${positive} positive execution fixtures, ${negative} negative execution fixtures, `
  + `${registerPositive} positive register fixtures, ${registerNegative} negative register fixtures`,
);
