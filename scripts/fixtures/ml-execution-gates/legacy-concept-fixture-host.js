'use strict';

// Fixture adapter only. The legacy suite's declared synthetic tasks already
// have dedicated definition-bundle / OA / register controls. This adapter
// records no ADDITIONAL generic obligations. It is not a production selector,
// a general semantic classifier, or proof of natural-language completeness.
const crypto = require('crypto');
const {CONTEXT_SCHEMA, SELECTION_SCHEMA, APPLICATION_SCHEMA} = require('../../lib/mephistodata-concept-application');
const sha = v => crypto.createHash('sha256').update(v).digest('hex');

module.exports = function legacyConceptFixtureHost(id) {
  const issued = new Map();
  const selectionId = `${id}.selection`;
  const applicationId = `${id}.application`;
  return {
    conceptSelectionVerifierId: selectionId,
    conceptApplicationVerifierId: applicationId,
    verifyConceptSelectionAttestation(request) {
      const context = {schema_version: CONTEXT_SCHEMA, mode: 'none-applicable',
        scope: 'Declared legacy synthetic fixture and its dedicated existing guards',
        coverage_basis: 'No additional generic obligations in this bounded fixture; dedicated guards remain independently tested.',
        limitations: 'Fixture routing only; no general semantic-selection or external-host certification.',
        sources: [], obligations: [], nonapplications: []};
      const contextSha = sha(JSON.stringify(context));
      const receipt = {schema_version: SELECTION_SCHEMA, verifier_id: selectionId,
        request_sha256: request.request_sha256, owner_inventory_sha256: request.owner_inventory_sha256,
        preliminary_plan_integrity_sha256: request.preliminary_plan_integrity_sha256,
        coverage_reviewed: true, selection_id: sha(JSON.stringify(request) + contextSha),
        context_sha256: contextSha, context};
      issued.set(receipt.selection_id, receipt);
      return receipt;
    },
    verifyConceptApplicationAttestation(request) {
      const receipt = issued.get(request.selection.selection_id);
      if (!receipt || receipt.context_sha256 !== request.selection.context_sha256
          || receipt.request_sha256 !== request.selection.request_sha256
          || receipt.owner_inventory_sha256 !== request.selection.owner_inventory_sha256
          || receipt.preliminary_plan_integrity_sha256 !== request.selection.preliminary_plan_integrity_sha256
          || JSON.stringify(receipt.context) !== JSON.stringify(request.context)
          || request.applications.length) return {ok: false};
      return {schema_version: APPLICATION_SCHEMA, verifier_id: applicationId,
        plan_integrity_sha256: request.plan_integrity_sha256, draft_sha256: request.draft_sha256,
        evidence_sha256: request.evidence_sha256, selection_id: receipt.selection_id,
        context_sha256: receipt.context_sha256, selection_receipt_resolved: true,
        complete_draft_reviewed: true, no_omitted_material_concepts: true,
        source_versions_current: true, prior_rulings_current: true,
        no_unsupported_dependent_claims: true, application_verdicts: []};
    },
  };
};
