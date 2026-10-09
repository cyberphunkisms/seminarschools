'use strict';

// Structural controls for source-bound concept selection and application.
// The trusted host owns semantic selection and adjudication. These controls
// neither invent concept definitions nor certify a host's honesty/invocation.
const CONTEXT_SCHEMA = 'mephistodata-concept-context.v1.2026-10-05';
const SELECTION_SCHEMA = 'mephistodata-concept-selection.v1.2026-10-05';
const APPLICATION_SCHEMA = 'mephistodata-concept-application.v1.2026-10-05';

function createConceptControls({reject, sha256, deepFreeze, canonicalEntrySha}) {
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const copy = v => JSON.parse(JSON.stringify(v));
  const ids = (v, empty = true) => Array.isArray(v) && (empty || v.length > 0)
    && v.every(text) && new Set(v).size === v.length;
  const same = (a, b) => ids(a) && ids(b) && a.length === b.length && a.every(x => b.includes(x));
  const ownerText = e => [e.xc, e.b, e.x].filter(text).join('\n\n');

  function reference(ref, sources) {
    const source = object(ref) && sources.get(ref.source_id);
    if (!source || !Number.isInteger(ref.start) || !Number.isInteger(ref.end)
        || ref.start < 0 || ref.end <= ref.start || ref.end > source.text.length
        || !text(ref.quote) || source.text.slice(ref.start, ref.end) !== ref.quote) {
      reject('CONCEPT_SOURCE_BINDING_FAILURE', 'Concept references must match exact frozen source spans.');
    }
    return source;
  }

  function references(refs, sources, empty = false) {
    if (!Array.isArray(refs) || (!empty && refs.length === 0)) {
      reject('MALFORMED_CONCEPT_CONTEXT', 'Concept reference lists are missing.');
    }
    refs.forEach(ref => reference(ref, sources));
  }

  function validateContext(value, owners) {
    if (!object(value)) reject('MISSING_CONCEPT_CONTEXT', 'Trusted planning must supply a concept context.');
    let context;
    try { context = copy(value); } catch { reject('MALFORMED_CONCEPT_CONTEXT', 'Concept context is not serializable.'); }
    if (context.schema_version !== CONTEXT_SCHEMA || !text(context.scope)
        || !text(context.coverage_basis) || !text(context.limitations)
        || !['selected', 'none-applicable'].includes(context.mode)
        || !Array.isArray(context.sources) || !Array.isArray(context.obligations)
        || !Array.isArray(context.nonapplications)) {
      reject('MALFORMED_CONCEPT_CONTEXT', 'Concept context requires bounded scope, coverage, limits, sources and decisions.');
    }
    const sources = new Map();
    const authorities = new Set(['canonical-definition', 'independent-instrument', 'user-ruling',
      'source-claim', 'assistant-proposal', 'unresolved', 'historical-provenance']);
    for (const source of context.sources) {
      if (!object(source) || !text(source.id) || sources.has(source.id)
          || !text(source.kind) || !text(source.locator) || !text(source.version)
          || !text(source.text) || source.sha256 !== sha256(source.text)
          || !authorities.has(source.authority)
          || !['user', 'assistant', 'external', 'canonical'].includes(source.author)) {
        reject('CONCEPT_SOURCE_BINDING_FAILURE', 'Concept sources require unique identities, authority, versions and matching hashes.');
      }
      if (source.authority === 'user-ruling' && source.author !== 'user') {
        reject('CONCEPT_AUTHORITY_FAILURE', 'Assistant material cannot become a user ruling.');
      }
      if (source.authority === 'canonical-definition') {
        const snapshot = source.owner;
        const matches = object(snapshot) ? owners.filter(e => snapshot.id
          ? e.id === snapshot.id : e.s === snapshot.section && e.t === snapshot.title) : [];
        if (matches.length !== 1 || matches[0].s === 'corehistory'
            || /^\[(?:RETIRED|SUPERSEDED|CONSOLIDATED|HISTORICAL)/i.test(matches[0].t)
            || snapshot.semantic_sha256 !== canonicalEntrySha(matches[0])
            || source.author !== 'canonical' || source.text !== ownerText(matches[0])) {
          reject('STALE_CONCEPT_OWNER', 'The full current concept owner must match the canonical registry.');
        }
      }
      sources.set(source.id, source);
    }
    const obligations = new Map();
    for (const obligation of context.obligations) {
      if (!object(obligation) || !text(obligation.id) || obligations.has(obligation.id)
          || !text(obligation.concept) || !text(obligation.scope)
          || !text(obligation.selection_basis) || !text(obligation.definition_limits)
          || !ids(obligation.depends_on)) {
        reject('MALFORMED_CONCEPT_CONTEXT', 'Every concept obligation needs its scope, relevance, definition limits and dependencies.');
      }
      references(obligation.definition_refs, sources);
      references(obligation.criterion_refs, sources);
      references(obligation.evidence_refs, sources, true);
      references(obligation.prior_ruling_refs, sources, true);
      for (const ref of [...obligation.definition_refs, ...obligation.criterion_refs]) {
        if (!['canonical-definition', 'independent-instrument', 'user-ruling'].includes(reference(ref, sources).authority)) {
          reject('CONCEPT_AUTHORITY_FAILURE', 'A proposal, case result or unresolved source cannot silently supply an adopted criterion.');
        }
      }
      if (obligation.prior_ruling_refs.some(ref => reference(ref, sources).authority !== 'user-ruling')) {
        reject('CONCEPT_AUTHORITY_FAILURE', 'Prior rulings require located user authorship.');
      }
      obligations.set(obligation.id, obligation);
    }
    const active = new Set(), done = new Set();
    function visit(id) {
      if (!obligations.has(id)) reject('CONCEPT_DEPENDENCY_FAILURE', 'A concept dependency is missing.');
      if (active.has(id)) reject('CONCEPT_DEPENDENCY_FAILURE', 'Concept application dependencies contain a cycle.');
      if (done.has(id)) return;
      active.add(id); obligations.get(id).depends_on.forEach(visit); active.delete(id); done.add(id);
    }
    [...obligations.keys()].forEach(visit);
    if ((context.mode === 'selected') !== (obligations.size > 0)) {
      reject('MALFORMED_CONCEPT_CONTEXT', 'An empty applicable set must be explicitly recorded as none-applicable.');
    }
    for (const decision of context.nonapplications) {
      if (!object(decision) || !text(decision.concept) || !text(decision.scope) || !text(decision.reason)) {
        reject('MALFORMED_CONCEPT_CONTEXT', 'Nonapplication requires a scoped reason.');
      }
    }
    return deepFreeze(context);
  }

  function plan(base, request, owners, trust) {
    if (!base.ml_active) return base;
    if (!trust || typeof trust.verifyConceptSelectionAttestation !== 'function') {
      reject('UNRESOLVED_CONCEPT_SELECTION', 'Active ML* planning requires a trusted concept-selection verifier.');
    }
    if (request.concept_context !== undefined || request.concept_selection !== undefined) {
      reject('CALLER_SUPPLIED_CONCEPT_CONTEXT', 'The bootstrap verifier owns concept selection; a draft cannot select its own required checks.');
    }
    let snapshot;
    try { snapshot = copy(request); } catch { reject('MALFORMED_REQUEST', 'The task snapshot is not serializable.'); }
    const ownerSnapshots = owners.map(e => ({id: e.id || null, section: e.s, title: e.t,
      semantic_sha256: canonicalEntrySha(e), text: ownerText(e)}));
    const query = deepFreeze({schema_version: SELECTION_SCHEMA,
      request_sha256: sha256(JSON.stringify(snapshot)), request_snapshot: snapshot,
      owner_inventory_sha256: sha256(JSON.stringify(ownerSnapshots)), owner_snapshots: ownerSnapshots,
      preliminary_plan_integrity_sha256: base.integrity_sha256});
    let answer;
    try { answer = trust.verifyConceptSelectionAttestation(query); }
    catch { reject('UNRESOLVED_CONCEPT_SELECTION', 'The trusted concept selector failed closed.'); }
    if (!object(answer) || answer.schema_version !== SELECTION_SCHEMA
        || answer.verifier_id !== trust.conceptSelectionVerifierId
        || answer.request_sha256 !== query.request_sha256
        || answer.owner_inventory_sha256 !== query.owner_inventory_sha256
        || answer.preliminary_plan_integrity_sha256 !== query.preliminary_plan_integrity_sha256
        || answer.coverage_reviewed !== true || !text(answer.selection_id)) {
      reject('UNRESOLVED_CONCEPT_SELECTION', 'Concept selection lacks an exactly bound trusted receipt.');
    }
    const context = validateContext(answer.context, owners);
    if (answer.context_sha256 !== sha256(JSON.stringify(context))) {
      reject('CONCEPT_SOURCE_BINDING_FAILURE', 'Concept selection does not bind its complete context.');
    }
    const next = {...base, concept_context: context, concept_selection: {
      schema_version: SELECTION_SCHEMA, selection_id: answer.selection_id,
      verifier_id: answer.verifier_id, request_sha256: query.request_sha256,
      owner_inventory_sha256: query.owner_inventory_sha256,
      preliminary_plan_integrity_sha256: query.preliminary_plan_integrity_sha256,
      context_sha256: answer.context_sha256,
    }};
    delete next.integrity_sha256;
    next.integrity_sha256 = sha256(JSON.stringify(next));
    return deepFreeze(next);
  }

  function delivery(plan, draft, evidence, trust) {
    if (!plan.ml_active) return null;
    const context = plan.concept_context, selection = plan.concept_selection;
    if (!object(context) || !object(selection) || selection.schema_version !== SELECTION_SCHEMA
        || selection.context_sha256 !== sha256(JSON.stringify(context))) {
      reject('MISSING_CONCEPT_SELECTION', 'Delivery requires concept selection frozen under the trusted bootstrap before generation.');
    }
    const preliminary = {...plan};
    delete preliminary.concept_context;
    delete preliminary.concept_selection;
    delete preliminary.integrity_sha256;
    if (selection.preliminary_plan_integrity_sha256 !== sha256(JSON.stringify(preliminary))) {
      reject('CONCEPT_SELECTION_PLAN_MISMATCH', 'Concept selection must bind the original pre-generation plan.');
    }
    if (!trust || selection.verifier_id !== trust.conceptSelectionVerifierId
        || typeof trust.verifyConceptApplicationAttestation !== 'function') {
      reject('UNRESOLVED_CONCEPT_APPLICATION', 'Concept application requires a bootstrap semantic verifier and its original selection.');
    }
    const applications = evidence.concept_applications === undefined && context.obligations.length === 0
      ? [] : evidence.concept_applications;
    if (!Array.isArray(applications) || !same(applications.map(a => a && a.obligation_id), context.obligations.map(o => o.id))) {
      reject('MISSING_CONCEPT_APPLICATION', 'Each selected concept requires exactly one application; an empty set must remain empty.');
    }
    const sources = new Map(context.sources.map(s => [s.id, s]));
    const obligations = new Map(context.obligations.map(o => [o.id, o]));
    for (const application of applications) {
      const obligation = obligations.get(application.obligation_id);
      if (!object(application) || !['applied', 'partial', 'not-applicable', 'blocked'].includes(application.status)
          || application.scope !== obligation.scope || !text(application.result)
          || !text(application.effect) || !text(application.remaining_limits)
          || JSON.stringify(application.criterion_refs) !== JSON.stringify(obligation.criterion_refs)
          || JSON.stringify(application.prior_ruling_refs) !== JSON.stringify(obligation.prior_ruling_refs)) {
        reject('CONCEPT_APPLICATION_MISMATCH', 'An application must preserve criteria, prior rulings, scope, effect and remaining limits.');
      }
      references(application.evidence_refs, sources, application.status !== 'applied');
      if (!Array.isArray(application.draft_refs) || !application.draft_refs.length) {
        reject('CONCEPT_APPLICATION_MISMATCH', 'Every result must bind its affected assertion, qualification or disclosed limit in the final draft.');
      }
      const draftSource = new Map([['final-draft', {text: draft}]]);
      application.draft_refs.forEach(ref => reference(ref, draftSource));
    }
    const query = deepFreeze({schema_version: APPLICATION_SCHEMA,
      plan_integrity_sha256: plan.integrity_sha256, draft_sha256: sha256(draft), draft_bytes: draft,
      evidence_sha256: sha256(JSON.stringify(evidence)), evidence_bytes: JSON.stringify(evidence),
      selection: copy(selection), context: copy(context), applications: copy(applications)});
    let answer;
    try { answer = trust.verifyConceptApplicationAttestation(query); }
    catch { reject('UNRESOLVED_CONCEPT_APPLICATION', 'The trusted concept reviewer failed closed.'); }
    const checks = answer && answer.application_verdicts;
    if (!object(answer) || answer.schema_version !== APPLICATION_SCHEMA
        || answer.verifier_id !== trust.conceptApplicationVerifierId
        || answer.plan_integrity_sha256 !== query.plan_integrity_sha256
        || answer.draft_sha256 !== query.draft_sha256 || answer.evidence_sha256 !== query.evidence_sha256
        || answer.selection_id !== selection.selection_id || answer.context_sha256 !== selection.context_sha256
        || answer.selection_receipt_resolved !== true || answer.complete_draft_reviewed !== true
        || answer.source_versions_current !== true || answer.prior_rulings_current !== true
        || !Array.isArray(checks) || !same(checks.map(c => c && c.obligation_id), applications.map(a => a.obligation_id))
        || checks.some(c => c.application_sha256 !== sha256(JSON.stringify(applications.find(a => a.obligation_id === c.obligation_id)))
          || !['supported', 'unsupported', 'unresolved'].includes(c.verdict) || !text(c.basis))) {
      reject('UNRESOLVED_CONCEPT_APPLICATION', 'Semantic review must resolve its issued selection and bind the complete final draft, evidence and every application.');
    }
    if (answer.no_omitted_material_concepts !== true) {
      reject('OMITTED_MATERIAL_CONCEPT', 'The full-draft review found a material concept omitted from planning.');
    }
    if (answer.no_unsupported_dependent_claims !== true || checks.some(c => c.verdict === 'unsupported')) {
      reject('UNSUPPORTED_CONCEPT_APPLICATION', 'The answer conflicts with its source-grounded application or exceeds its permitted judgment.');
    }
    if (checks.some(c => c.verdict === 'unresolved')) {
      reject('UNRESOLVED_CONCEPT_APPLICATION', 'An unresolved semantic verdict cannot certify a dependent claim.');
    }
    return deepFreeze({selection_id: selection.selection_id, context_sha256: selection.context_sha256,
      application_count: applications.length, coverage: 'trusted-host-bound-verdicts'});
  }

  return {plan, delivery, validateContext, ownerText};
}

module.exports = {CONTEXT_SCHEMA, SELECTION_SCHEMA, APPLICATION_SCHEMA, createConceptControls};
