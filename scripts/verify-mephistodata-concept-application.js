#!/usr/bin/env node
'use strict';
// Controlled source-grounded judgments, not a production semantic classifier.
// Structural mutations go through the configured public gate, not a private
// validator. Unknown drafts never acquire a semantic approval by echoing flags.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const g = require('./lib/mephistodata-runtime-gate');
const ROOT = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/ml-execution-gates/concept-application-cases.json'), 'utf8'));
const owners = g.canonicalOwnerRecords(ROOT);
const copy = value => JSON.parse(JSON.stringify(value));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fullText = e => [e.xc,e.b,e.x].filter(v => typeof v === 'string' && v.trim()).join('\n\n');
const ref = (source, quote = source.text) => {
  const start = source.text.indexOf(quote);
  if (start < 0) throw Error('Missing exact source quote');
  return {source_id:source.id,start,end:start+quote.length,quote};
};
const source = (id,text,authority,author,extra={}) => ({id,kind:'fixture-source',locator:`fixture:${id}`,version:'2026-10-05',text,sha256:sha(text),authority,author,...extra});
function makeContext(c) {
  const context = {schema_version:g.CONCEPT_CONTEXT_SCHEMA,mode:c.owner?'selected':'none-applicable',scope:c.message,
    coverage_basis:'Curated fixture relevance decision after inspecting its exact task, current owners and stated evidence.',
    limitations:fixture.limits,sources:[],obligations:[],nonapplications:[]};
  if (!c.owner) {context.nonapplications.push({concept:'Gorgonification; Trinity Finder; Polymyth Coherence',scope:c.message,reason:c.evidence});return context;}
  const matches = owners.filter(e=>e.t===c.owner); if(matches.length!==1)throw Error('Missing/ambiguous current owner: '+c.owner);
  const e=matches[0],definition=source('definition',fullText(e),'canonical-definition','canonical',{
    kind:'current-owner',locator:`polymyth/methodologylist/${e.s}/#${e.id||e.t}`,
    version:g.canonicalEntrySha(e),owner:{id:e.id||null,section:e.s,title:e.t,semantic_sha256:g.canonicalEntrySha(e)}});
  const evidence=source('evidence',c.evidence,'source-claim','external');
  context.sources.push(definition,evidence);
  let criterion=definition;
  if(c.owner==='Polymyth Coherence star-file routing'){
    const rel='polymyth/coherence/Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md';
    const bytes=fs.readFileSync(path.join(ROOT,rel),'utf8');
    criterion=source('protocol',bytes,'independent-instrument','external',{kind:'independent-instrument',locator:rel,version:'V5.1.2:'+sha(bytes)});
    context.sources.push(criterion);
  }
  const ruling=c.prior_ruling || (c.synthetic_user_ruling?c.evidence:null);
  let prior=[];
  if(ruling){const s=source('prior-ruling',ruling,'user-ruling','user',{kind:c.synthetic_user_ruling?'synthetic-user-ruling':'visible-conversation-user-ruling'});context.sources.push(s);prior=[ref(s)];}
  const o={id:'application',concept:c.owner,scope:c.message,selection_basis:'The exact task requires this operation; selection is not a keyword-only detector.',
    definition_limits:c.owner==='Hegelianegirl'?'One observed trait is partial; rich canonical reconstruction and detection criteria remain unfinished.':fixture.limits,
    depends_on:[],definition_refs:[ref(definition,definition.text.slice(0,120))],criterion_refs:[ref(criterion,criterion.text.slice(0,160))],evidence_refs:[ref(evidence)],prior_ruling_refs:prior};
  context.obligations.push(o);return context;
}
function applications(context,c,draft){return context.obligations.map(o=>({obligation_id:o.id,status:c.status,scope:o.scope,result:c.result,
  effect:c.effect,remaining_limits:o.definition_limits,
  criterion_refs:copy(o.criterion_refs),prior_ruling_refs:copy(o.prior_ruling_refs),evidence_refs:copy(o.evidence_refs),draft_refs:[{source_id:'final-draft',start:g.DEFAULT_OPENER.length+1,end:draft.length,quote:draft.slice(g.DEFAULT_OPENER.length+1)}]}));}
function evidenceFor(context,c,draft){const body=draft.slice(g.DEFAULT_OPENER.length+1);return {task_answer:body,evidence_status:'user-supplied',data_basis:['Exact current source snapshots and bounded fixture evidence'],
  mephisto_status:'no-defect',no_defect_basis:body,concept_applications:applications(context,c,draft)};}
function makeHost(c,{contextMutation,selectionMutation,applicationMutation,omitSelector,omitReviewer}={}) {
  const issued=new Map(),approvedDrafts=new Map(); let currentSources=true,currentRulings=true;
  const sid='controlled-concept-selector.v1',aid='controlled-concept-reviewer.v1',did='controlled-work-status.v1';
  const config={conceptSelectionVerifierId:sid,conceptApplicationVerifierId:aid,draftVerifierId:did,
    verifyDraftWorkStatusAttestation(q){
      // These curated concept drafts assert no completed operator work. Each
      // local parser hit is still returned with its exact occurrence binding.
      if(!approvedDrafts.has(q.draft_sha256)||sha(q.draft_bytes)!==q.draft_sha256||sha(q.evidence_bytes)!==q.evidence_sha256)return {ok:false};
      return {schema_version:g.DRAFT_SCAN_ATTESTATION_SCHEMA,verifier_id:did,plan_integrity_sha256:q.plan_integrity_sha256,draft_sha256:q.draft_sha256,evidence_sha256:q.evidence_sha256,
        complete_scan_verified:true,no_unmapped_work_status_claims:true,claim_bindings:q.local_claims.map(b=>({...b,classification:'nonclaim',evidence_verdict:'not-applicable'}))};
    },
    verifyConceptSelectionAttestation(q){
      if(q.request_snapshot.current_message!==c.message || sha(JSON.stringify(q.request_snapshot))!==q.request_sha256 || sha(JSON.stringify(q.owner_snapshots))!==q.owner_inventory_sha256)return {ok:false};
      let context=makeContext(c);if(contextMutation)contextMutation(context,q);
      const receipt={schema_version:g.CONCEPT_SELECTION_SCHEMA,verifier_id:sid,request_sha256:q.request_sha256,owner_inventory_sha256:q.owner_inventory_sha256,
        preliminary_plan_integrity_sha256:q.preliminary_plan_integrity_sha256,coverage_reviewed:true,selection_id:sha(q.request_sha256+q.owner_inventory_sha256+JSON.stringify(context)),context_sha256:sha(JSON.stringify(context)),context};
      issued.set(receipt.selection_id,copy(receipt)); if(selectionMutation)selectionMutation(receipt);return receipt;
    },
    verifyConceptApplicationAttestation(q){
      const receipt=issued.get(q.selection.selection_id),judgment=approvedDrafts.get(q.draft_sha256);
      const expectedSelection=receipt&&{schema_version:receipt.schema_version,selection_id:receipt.selection_id,verifier_id:receipt.verifier_id,request_sha256:receipt.request_sha256,
        owner_inventory_sha256:receipt.owner_inventory_sha256,preliminary_plan_integrity_sha256:receipt.preliminary_plan_integrity_sha256,context_sha256:receipt.context_sha256};
      if(!receipt||JSON.stringify(expectedSelection)!==JSON.stringify(q.selection)||JSON.stringify(receipt.context)!==JSON.stringify(q.context)
        ||!judgment||q.draft_bytes!==judgment.draft||sha(q.evidence_bytes)!==q.evidence_sha256)return {ok:false};
      const expectedApps=applications(q.context,c,q.draft_bytes);
      const recordsCorrect=JSON.stringify(expectedApps)===JSON.stringify(q.applications);
      const attestation={schema_version:g.CONCEPT_APPLICATION_SCHEMA,verifier_id:aid,plan_integrity_sha256:q.plan_integrity_sha256,draft_sha256:q.draft_sha256,evidence_sha256:q.evidence_sha256,
        selection_id:receipt.selection_id,context_sha256:receipt.context_sha256,selection_receipt_resolved:true,complete_draft_reviewed:true,source_versions_current:currentSources,prior_rulings_current:currentRulings,
        no_omitted_material_concepts:judgment.omissions!==true,no_unsupported_dependent_claims:judgment.supported&&recordsCorrect,
        application_verdicts:q.applications.map(a=>({obligation_id:a.obligation_id,application_sha256:sha(JSON.stringify(a)),verdict:judgment.unresolved?'unresolved':judgment.supported&&recordsCorrect?'supported':'unsupported',
          basis:judgment.basis||'Curated bounded judgment uses the frozen current definition, independent criterion, fixture evidence and exact answer; it is not a universal classifier.'}))};
      if(applicationMutation)applicationMutation(attestation,q); return attestation;
    }};
  if(omitSelector)delete config.verifyConceptSelectionAttestation;
  if(omitReviewer)delete config.verifyConceptApplicationAttestation;
  return {gate:g.createRuntimeGate(config),config,register(draft,judgment){approvedDrafts.set(sha(draft),{draft,...judgment});},invalidateSources(){currentSources=false;},invalidateRulings(){currentRulings=false;}};
}
const results=[];
function check(id,expected,operation){try{operation();results.push({id,expected,actual:'permit',pass:expected==='permit'});}catch(e){results.push({id,expected,actual:e.code||e.message,pass:e.code===expected});}}
function run(c,supported,options={},mutate){
  const host=makeHost(c,options),request={ml_active:true,current_message:c.message};
  let plan=host.gate.planRequest(request,{owner_records:owners});
  const draft=g.DEFAULT_OPENER+' '+(supported?c.supported:c.unsupported),ev=evidenceFor(plan.concept_context,c,draft);
  host.register(draft,{supported,omissions:!c.owner&&!supported});
  const state={host,request,plan,draft,evidence:ev};if(mutate)mutate(state);
  return state.host.gate.assertDeliverable(state.plan,state.draft,state.evidence);
}
for(const c of fixture.cases){check(c.id+'.supported','permit',()=>run(c,true));check(c.id+'.unsupported',c.owner?'UNSUPPORTED_CONCEPT_APPLICATION':'OMITTED_MATERIAL_CONCEPT',()=>run(c,false));}
const c=fixture.cases[0],co=fixture.cases.find(c=>c.id==='goss-admissibility'),tr=fixture.cases.find(c=>c.id==='trinity-trait');
const mutateContext=(id,expected,mutate,caseDef=c)=>check(id,expected,()=>run(caseDef,true,{contextMutation:mutate}));
mutateContext('owner-missing','STALE_CONCEPT_OWNER',ctx=>ctx.sources[0].owner.title='Missing definition');
mutateContext('owner-stale-hash','STALE_CONCEPT_OWNER',ctx=>ctx.sources[0].owner.semantic_sha256='0'.repeat(64));
mutateContext('owner-abridged','STALE_CONCEPT_OWNER',ctx=>{ctx.sources[0].text=ctx.sources[0].text.slice(0,160);ctx.sources[0].sha256=sha(ctx.sources[0].text);});
mutateContext('source-changed-without-hash','CONCEPT_SOURCE_BINDING_FAILURE',ctx=>ctx.sources[1].text+=' altered');
mutateContext('duplicate-source','CONCEPT_SOURCE_BINDING_FAILURE',ctx=>ctx.sources.push(copy(ctx.sources[0])));
mutateContext('reference-wrong-span','CONCEPT_SOURCE_BINDING_FAILURE',ctx=>ctx.obligations[0].criterion_refs[0].start++);
mutateContext('no-definition','MALFORMED_CONCEPT_CONTEXT',ctx=>ctx.obligations[0].definition_refs=[]);
mutateContext('no-criteria','MALFORMED_CONCEPT_CONTEXT',ctx=>ctx.obligations[0].criterion_refs=[]);
mutateContext('assistant-proposal-as-criterion','CONCEPT_AUTHORITY_FAILURE',ctx=>{const s=source('proposal','Assistant proposed rule','assistant-proposal','assistant');ctx.sources.push(s);ctx.obligations[0].criterion_refs=[ref(s)];});
mutateContext('case-result-as-criterion','CONCEPT_AUTHORITY_FAILURE',ctx=>ctx.obligations[0].criterion_refs=copy(ctx.obligations[0].evidence_refs),co);
mutateContext('assistant-as-user-ruling','CONCEPT_AUTHORITY_FAILURE',ctx=>ctx.sources.find(s=>s.id==='prior-ruling').author='assistant',co);
mutateContext('source-claim-as-prior-ruling','CONCEPT_AUTHORITY_FAILURE',ctx=>ctx.obligations[0].prior_ruling_refs=copy(ctx.obligations[0].evidence_refs));
mutateContext('missing-dependency','CONCEPT_DEPENDENCY_FAILURE',ctx=>ctx.obligations[0].depends_on=['missing']);
mutateContext('cyclic-dependency','CONCEPT_DEPENDENCY_FAILURE',ctx=>ctx.obligations[0].depends_on=['application']);
mutateContext('false-empty-applicability','MALFORMED_CONCEPT_CONTEXT',ctx=>ctx.mode='none-applicable');
mutateContext('nonapplication-without-reason','MALFORMED_CONCEPT_CONTEXT',ctx=>ctx.nonapplications=[{concept:'X',scope:ctx.scope}]);
check('missing-selector','UNRESOLVED_CONCEPT_SELECTION',()=>run(c,true,{omitSelector:true}));
check('missing-reviewer','UNRESOLVED_CONCEPT_APPLICATION',()=>run(c,true,{omitReviewer:true}));
for(const field of ['verifier_id','request_sha256','owner_inventory_sha256','preliminary_plan_integrity_sha256','context_sha256']){
 check('selection-tamper-'+field,field==='context_sha256'?'CONCEPT_SOURCE_BINDING_FAILURE':'UNRESOLVED_CONCEPT_SELECTION',()=>run(c,true,{selectionMutation:r=>r[field]='forged'}));
}
check('selection-no-coverage','UNRESOLVED_CONCEPT_SELECTION',()=>run(c,true,{selectionMutation:r=>r.coverage_reviewed=false}));
const mutate=(id,expected,fn,caseDef=c)=>check(id,expected,()=>run(caseDef,true,{},fn));
mutate('missing-application','MISSING_CONCEPT_APPLICATION',s=>s.evidence.concept_applications=[]);
mutate('duplicate-application','MISSING_CONCEPT_APPLICATION',s=>s.evidence.concept_applications.push(copy(s.evidence.concept_applications[0])));
mutate('wrong-obligation','MISSING_CONCEPT_APPLICATION',s=>s.evidence.concept_applications[0].obligation_id='other');
mutate('scope-drift','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].scope='whole population');
mutate('lost-prior-ruling','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].prior_ruling_refs=[],co);
mutate('changed-criterion','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].criterion_refs=[]);
mutate('no-result','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].result='');
mutate('no-effect','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].effect='');
mutate('boilerplate-effect','UNSUPPORTED_CONCEPT_APPLICATION',s=>s.evidence.concept_applications[0].effect='The concept was applied.');
mutate('no-limits','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].remaining_limits='');
mutate('applied-without-evidence','MALFORMED_CONCEPT_CONTEXT',s=>s.evidence.concept_applications[0].evidence_refs=[]);
mutate('no-answer-span','CONCEPT_APPLICATION_MISMATCH',s=>s.evidence.concept_applications[0].draft_refs=[]);
mutate('false-answer-span','CONCEPT_SOURCE_BINDING_FAILURE',s=>s.evidence.concept_applications[0].draft_refs[0].quote='unbound');
mutate('meaning-altered-record','UNSUPPORTED_CONCEPT_APPLICATION',s=>s.evidence.concept_applications[0].result='Disagreement establishes capture.');
mutate('changed-partial-status','UNSUPPORTED_CONCEPT_APPLICATION',s=>s.evidence.concept_applications[0].status='applied',tr);
mutate('changed-draft-after-approval','UNRESOLVED_DRAFT_WORK_STATUS_SCAN',s=>s.draft+=' Additional unreviewed claim.');
mutate('source-update-invalidates-receipt','UNRESOLVED_CONCEPT_APPLICATION',s=>s.host.invalidateSources());
mutate('later-ruling-invalidates-receipt','UNRESOLVED_CONCEPT_APPLICATION',s=>s.host.invalidateRulings(),co);
mutate('unknown-issued-receipt','UNRESOLVED_CONCEPT_APPLICATION',s=>{s.plan=copy(s.plan);s.plan.concept_selection.selection_id='forged';delete s.plan.integrity_sha256;s.plan.integrity_sha256=sha(JSON.stringify(s.plan));});
mutate('preplan-rehashed-forgery','CONCEPT_SELECTION_PLAN_MISMATCH',s=>{s.plan=copy(s.plan);s.plan.allow_question_first=!s.plan.allow_question_first;delete s.plan.integrity_sha256;s.plan.integrity_sha256=sha(JSON.stringify(s.plan));});
mutate('context-rehashed-forgery','UNRESOLVED_CONCEPT_APPLICATION',s=>{s.plan=copy(s.plan);s.plan.concept_context.limitations='Forged approval';s.plan.concept_selection.context_sha256=sha(JSON.stringify(s.plan.concept_context));delete s.plan.integrity_sha256;s.plan.integrity_sha256=sha(JSON.stringify(s.plan));});
mutate('plain-low-level-plan-cannot-deliver','MISSING_CONCEPT_SELECTION',s=>s.plan=g.planRequest(s.request,{owner_records:owners}));
check('caller-context-injection','CALLER_SUPPLIED_CONCEPT_CONTEXT',()=>makeHost(c).gate.planRequest({ml_active:true,current_message:c.message,concept_context:makeContext(c)},{owner_records:owners}));
check('per-plan-trust-injection','CALLER_SUPPLIED_TRUST_ROOT',()=>makeHost(c).gate.planRequest({ml_active:true,current_message:c.message},{owner_records:owners},{verifyConceptSelectionAttestation:()=>true}));
mutate('per-delivery-trust-injection','CALLER_SUPPLIED_TRUST_ROOT',s=>s.host.gate.assertDeliverable(s.plan,s.draft,s.evidence,{verifyConceptApplicationAttestation:()=>true}));
mutate('immutable-bootstrap','permit',s=>{s.host.config.verifyConceptApplicationAttestation=()=>({ok:false});s.host.config.conceptApplicationVerifierId='caller';});
for(const field of ['verifier_id','plan_integrity_sha256','draft_sha256','evidence_sha256','selection_id','context_sha256']){
 check('delivery-tamper-'+field,'UNRESOLVED_CONCEPT_APPLICATION',()=>run(c,true,{applicationMutation:a=>a[field]='forged'}));
}
for(const field of ['selection_receipt_resolved','complete_draft_reviewed','source_versions_current','prior_rulings_current']){
 check('delivery-missing-'+field,'UNRESOLVED_CONCEPT_APPLICATION',()=>run(c,true,{applicationMutation:a=>a[field]=false}));
}
check('delivery-wrong-application-hash','UNRESOLVED_CONCEPT_APPLICATION',()=>run(c,true,{applicationMutation:a=>a.application_verdicts[0].application_sha256='0'.repeat(64)}));
check('delivery-unsupported-verdict','UNSUPPORTED_CONCEPT_APPLICATION',()=>run(c,true,{applicationMutation:a=>a.application_verdicts[0].verdict='unsupported'}));
check('delivery-unresolved-verdict','UNRESOLVED_CONCEPT_APPLICATION',()=>run(c,true,{applicationMutation:a=>a.application_verdicts[0].verdict='unresolved'}));
check('delivery-omitted-implicit-operation','OMITTED_MATERIAL_CONCEPT',()=>run(c,true,{applicationMutation:a=>a.no_omitted_material_concepts=false}));
check('delivery-unsupported-dependent-claim','UNSUPPORTED_CONCEPT_APPLICATION',()=>run(c,true,{applicationMutation:a=>a.no_unsupported_dependent_claims=false}));
check('outside-ml-unaffected','permit',()=>{const host=makeHost(fixture.cases.find(c=>!c.owner),{omitSelector:true,omitReviewer:true}),draft='The supplied appointment time is noon.';host.register(draft,{supported:true});const p=host.gate.planRequest({ml_active:false,current_message:'State the time.'},{owner_records:owners});host.gate.assertDeliverable(p,draft,{});});
// Literal source mentions cannot create an activation. The host resolves
// ml_active under the existing CORE triggers, rather than this concept module.
check('outside-ml-quoted-concepts','permit',()=>{const host=makeHost(c,{omitSelector:true,omitReviewer:true}),draft='The quoted list has three terms.';host.register(draft,{supported:true});const p=host.gate.planRequest({ml_active:false,current_message:'Edit the quotation "Gorgonification, Trinity Finder, Polymyth Coherence".'},{owner_records:owners});host.gate.assertDeliverable(p,draft,{});});
check('concept-nameplate-without-judgment','UNSUPPORTED_CONCEPT_APPLICATION',()=>{const host=makeHost(c),plan=host.gate.planRequest({ml_active:true,current_message:c.message},{owner_records:owners}),draft=g.DEFAULT_OPENER+' Gorgonification is a concept; Polymyth Coherence is another concept.';host.register(draft,{supported:false,basis:'Naming definitions supplies no judgment on the requested disagreement.'});host.gate.assertDeliverable(plan,draft,evidenceFor(plan.concept_context,c,draft));});
const report={suite:'mephistodata-concept-application',schema:fixture.schema,cases:results.length,permits:results.filter(r=>r.expected==='permit').length,
  rejects:results.filter(r=>r.expected!=='permit').length,passed:results.filter(r=>r.pass).length,canonical_owners:owners.length,
  fixture_sha256:sha(JSON.stringify(fixture)),coverage:fixture.limits,results};
const failures=results.filter(r=>!r.pass);
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exitCode=1;}
console.log(JSON.stringify(report,null,2));
