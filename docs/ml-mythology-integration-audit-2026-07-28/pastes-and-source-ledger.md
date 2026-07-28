# ML* mythology integration audit: pasted texts and canonical source

Date: 2026-07-28  
Mode: read-only audit of the two pasted-text inputs and the current full static source.  
Source tree: `/workspace/scratch/5f16cb60de57/work/saul-site-update-20260727`

## Audit result

The two pasted texts contain substantial ML* material that is absent from the current canon. The largest clean additions are the mezo-logic layer, the pre-mezo internal-coherence gate, the Cave/fire/sun/Desert turning sequence, the mythology-project question ledgers, and a large set of narrative lexicon records that currently have no direct ML* entry.

The current ML* source is structurally healthy. All focused ML*/Meaninglib gates passed before any integration:

- methodologylist manifest: pass;
- anti-backtracking guard: pass;
- Gorgonwars premise-split guard: pass;
- stop-psychologism guard: pass;
- AI-prose-tells guard: pass;
- Meaninglib dataset verification: pass;
- Meaninglib search verification: pass.

No canonical source file was edited during this audit.

## Input receipts

| Input | Lines | Words | Bytes | SHA-256 |
|---|---:|---:|---:|---|
| `upload/Pasted text(57).txt` | 511 | 8,011 | 55,875 | `aae923dba847c3852b46e8a3db88eaf02a0b60563c4294ccfada768a1515f843` |
| `upload/Pasted text (2)(6).txt` | 512 | 4,284 | 29,964 | `8b8c361d304b935641eae128cb05dd6019851a15034d9ba14ebc7320f97b8e3a` |

`Pasted text(57).txt` contains page references written only as “PDF p.” or “PDF pp.” It does not name which attached PDF each page reference belongs to. The PDF audit must bind every page reference to a specific filename before those references become citation claims.

## Current canonical ML* state

### Canonical edit surface

1. `polymyth/methodologylist/index.html`
   - The embedded `const SEED` array is the canonical ML* content source.
   - `parseSeedWithAddenda()` also loads the narrowly scoped Snakelogic addendum between `SNAKELOGIC_EXAMPLE_ADDENDUM_START` and `SNAKELOGIC_EXAMPLE_ADDENDUM_END`.
   - This HTML is the only safe content-edit origin.

2. Generated mirrors and indexes
   - `polymyth/methodologylist.txt`
   - `polymyth/methodologylist-<section>.txt`
   - `polymyth/manifest.txt`
   - static section HTML under `polymyth/methodologylist/<section>/`
   - `hf_export/data/ml/`
   - `hf_export/data/all_meaninglib_rows.jsonl`
   - `hf_export/search/meaninglib_search_index.json`
   - AI access-pack outputs
   - `public/` copies

Direct edits to a generated mirror create drift and will be overwritten.

### Live counts before integration

- 1,145 entries
- 16 sections
- Roles:
  - `both`: 919
  - `ai`: 212
  - `core`: 2
  - `depth`: 3
  - `human`: 3
  - `methodology`: 2
  - `pm`: 4
- Sections:
  - methodology: 354
  - citation: 337
  - gorgonification: 128
  - degorgonification: 51
  - coreplus: 46
  - idiomary: 44
  - sabachtan: 34
  - studylist: 33
  - learnings: 28
  - analysis: 26
  - polycognate: 24
  - corehistory: 18
  - pending: 15
  - rainbowsol: 3
  - framework-core: 2
  - pending-user-authorship: 2

### Current hashes and parity

| Artifact | SHA-256 |
|---|---|
| `polymyth/methodologylist/index.html` | `b34c43bee0291de199dedb662514448e7815a3ff4e0ac3dc10e9452ef853055e` |
| `polymyth/methodologylist.txt` | `0e0afac20b78cc870da253c0ffbda49a56bcb7dbe69d0f49b77867249d07e596` |
| `ML_FULL_CONVERSATION_FIDELITY_AUDIT_2026-07-27.md` | `e0fce11add42f8039f5ebfa6e16c8d7d0b44f3fcffac784a5833e10f1ded10f8` |

The source and `public/` ML* HTML files are byte-identical. The source and `public/` ML* text mirrors are byte-identical.

The July 27 fidelity report records the older whole-file HTML hash `81114085...`, while the current HTML hash is `b34c43be...`. Its entry count remains correct at 1,145. Refresh that report’s whole-file hash after the mythology integration rather than treating the recorded hash as current.

## Provenance model required for integration

Every integrated block needs one visible status:

- `USER-SET`: direct user wording or a proposition the user explicitly adopted;
- `USER-SUPPLIED SOURCE EXTRACTION`: material supplied for integration whose sentence authorship is not established;
- `SOURCE EVIDENCE`: exact material verified in a named PDF and page;
- `ASSISTANT SYNTHESIS / UNRATIFIED`: an assistant inference, classification, formulation, or conclusion;
- `DIRECT QUOTATION`: exact quoted words, bound to a named source and location;
- `OPEN QUESTION`: a question that remains unresolved;
- `PROPOSAL`: a possible operation, term, analogy, or research lead;
- `NEGATIVE CONTROL`: a rejected account, contradiction warning, source boundary, or anti-TWIST rule;
- `EXTERNAL VALIDATION OWED`: a factual claim that requires a primary or authoritative source outside the supplied project corpus.

The existing `r` field alone is insufficient provenance. New entries should combine the role with status headings in `b`, explicit provenance in `x`, and machine-readable tags in `tg`.

Recommended tags:

- `user-set-2026-07-28`
- `user-supplied-source-extraction`
- `assistant-synthesis-unratified`
- `direct-quotation-verified`
- `open-question`
- `negative-control`
- `external-validation-owed`
- `mythology-integration-source`
- `mezo-logic`
- `corpus-delimitation`

## Pasted text 57: line-level ledger

### Structure and counts

The file contains 501 tagged atomic records under eleven headings.

| Heading | Lines | Atomic records | Status distribution |
|---|---:|---:|---|
| Direct ML* methodology | 1–48 | 47 | 46 `C`; 1 `C/P` |
| Reusable analytic operations | 49–113 | 64 | 44 `C`; 4 `C/Q`; 8 `C/P`; 5 `P`; 3 `C/P/Q` |
| Logic and classification machinery | 114–128 | 14 | 9 `C`; 2 `C/Q`; 1 `C/P`; 1 `C/P/Q`; 1 `Q/P` |
| Mephistodata material | 129–150 | 21 | 20 `C`; 1 `C/Q` |
| Lexicon and conceptual modules | 151–213 | 62 | 33 `C`; 23 `C/Q`; 3 `C/P/Q`; 1 `C/P`; 1 `P/Q`; 1 `Q/P` |
| Cave, fire, sun, Desert, and turning | 214–239 | 25 | 24 `C`; 1 `X` |
| Useful cases and examples | 240–274 | 34 | 23 `C`; 5 `C/Q`; 2 `P`; 3 `P/Q`; 1 `C/P/Q` |
| Philosophical and methodological research questions | 275–326 | 51 | 51 `Q` |
| Narrative and world-system questions | 327–396 | 69 | 69 `Q` |
| Research and bibliography leads | 397–438 | 41 | 10 `C`; 19 `C/Q`; 1 `C/P`; 1 `P`; 10 `P/Q` |
| Anti-TWIST and provenance warnings | 439–512 | 74 | 74 `X` |

Status totals:

- contains `C`: 283
- proposal/question records without `C`: 24
- pure open questions: 120
- negative controls: 74

The paste supplies no legend defining `C`, `P`, `Q`, and `X`. Preserve these original tags literally in the source ledger. A provisional operational reading is:

- `C`: source-supported or confirmed in the originating PDF analysis;
- `P`: proposal;
- `Q`: open question;
- `X`: exclusion, warning, contradiction, or negative control.

This provisional reading must not erase the literal original tag.

### Exact-duplicate audit

- Zero exact normalized substantive duplicates were found among the 501 atomic records.
- Zero exact normalized whole-claim matches were found in the current `methodologylist.txt`.
- The zero exact-match result concerns sentence identity. It does not mean zero conceptual coverage.

The following are semantic duplicate or paired-control clusters and should become one entry or one entry plus a negative-control clause:

| Lines | Shared subject |
|---|---|
| 20 and 139 | citation as factual support and intellectual genealogy |
| 17 and 140 | ironman before criticism or opposition |
| 19 and 150 | unavailable-source honesty |
| 22 and 143 | creation versus repetition or recombination |
| 25 and 444 | typed scale; do not collapse idiom/person/institution/system |
| 123 and 449 | binary awareness of one idiom versus graded wider lucidity |
| 131 and 499 | Mephistodata is not irreversible or viral reprogramming |
| 197 and 481 | Gods are outdated power systems; Titans are ancient religions |
| 211 and 425 | Polymorphous Mythology as PhD methodology/current academic priority |
| 314 and 364 | reversal of Collective Devaluation |
| 322 and 472 | sublation versus sublimation |
| 346 and 457 | Hannah’s conflicting snake states |
| 355 and 459 | German, universal, and Twitter zombies |
| 424 and 512 | `Carrying Over the Burdens of Trace` is the master’s work; Polymorphous Mythology is the PhD |

### Strong existing conceptual coverage

These records should extend current entries rather than create parallel entries:

| Pasted cluster | Existing ML* title or surface |
|---|---|
| internal/external logic | `Internal logic + external logic` |
| authorship, correction, source honesty | `* file handling protocol (AI-side)`, `CORE slot 28 mirror — CORRECTION DEFAULTS`, `Why some material is recorded verbatim`, `New-coinage approval gate and Mephistodata mode marker` |
| anti-backtracking and failure history | `Anti-backtracking affordance ledger, preserve the working thing before polishing it`, `STOP-BACKTRACKING` |
| ironmanning | `Ironman before research`, `Ironmanning as degorgonification`, related entries |
| concession | `Conceding as strength` |
| internal diversity and bounded application | `Mearsheimer test`, `Always-already boundary gate`, `Keep applications inside scope` material |
| fuzzy categories | `Fuzzy logic as set theory`, `Egregore (polymyth fuzzy logic)`, `FUZZY-LOGIC-ACROSS-EGREGORES` |
| confluence, concrescence, cross-world preservation | `Confluence-vs-concrescence operational-distinction`, `Regional-concrescence` |
| gorgonification | `Gorgonification`, `Gorgonification four-step process` |
| Hydra | `Hydra`, `Power-Before-P0 Hydra` |
| Gorgonwars | `Gorgonwars`, `Three-way distinction`, `Gorgonwars premise classifier` |
| platformstrawmanculture | `Platformstrawmanculture`, `Ironmanning as degorgonification` |
| Collective Devaluation | `Collective devaluation paradox`, `Commodifiedempathy`, `Emotional labor prostitution` |
| Cave and sun | `Cave as limited POV plus sun as totality of valid angles`, `Cave as parseltongue vehicle`, `Dual-logic filter` |
| Mephistodata | `Mephistodata`, `Mephistodata as notetaker`, `Mephistodata-default`, `Mephistodata-Hegelian eight-question pre-commit check` |
| Carrying Over the Burdens of Trace | citation entry of that title plus the four-level zoom-out entries |
| research ledgers | `Studylist register-split`, `AI research list`, `Pending-user-authorship registry` |

### Clear gaps in current ML*

The following exact concepts have no direct occurrence in the current plain-text canon or have only incidental nearby material:

- `mezo logic`
- `source contamination` as a failed mezo comparison
- a mezo structural-compatibility index
- corpus delimitation as a pre-mezo admissibility stage
- undefined mezo result versus zero correspondence
- local coherence versus global coherence
- invariant-core extraction for diachronically layered systems
- the Force/qi/Matrix mezo comparison
- the six-Lucas-film Force audit
- `gorgonity`
- `Goth Cops`
- `Arendtian Athenian Muse`
- `Nimrod` and `Nimrods`
- `Citadel / Terracotta Warriors`
- `black-pill people`
- `Sentinels`
- `Typhoon/Typhon` as the user-originated BRICS Gorgon
- `Mafia Bear`
- `ORDER 66`
- `Nether Realm`
- `block world`
- `Martin the Zombie`
- `Geeubeles`
- `Snape`, `Dumbledore`, and `Uncle Benji` character mappings
- `hogwartz`
- `Desert of Nothingness`
- `Desert of Many Suns`
- `Bridge of the Unknown`
- `Gates of Heaven`
- `Throat of the wormhole`
- `ENDLESS LOVE`
- `market veridiction`
- `Vampire Castle`
- `Lemures`
- `Raygun / The Shirk`
- `multi allusion myth`

Several of these may appear indirectly in the attached PDFs or older conversation history. Their absence from the current ML* text means integration is still needed.

### High-value new bundles from pasted text 57

1. **Corpus-first methodology**
   - close reading before universalization;
   - retraceable inference;
   - model fluency as an epistemic hazard;
   - correction, exclusion, and question ledgers;
   - literal, symbolic, philosophical, empirical, and poetic register separation;
   - typed movement across idiom, person, faction, institution, system, conduit, portal, and consequence.

2. **Reusable operation library**
   - speaker–idiom diagnostic;
   - borrowed-rumination diagnostic;
   - snake lifecycle and fluency/subjection tests;
   - universal-hammer test;
   - defensive-escalation and rhetorical-defense scans;
   - protection-rationalization and self-fulfilling-rationalization catalogues;
   - benefit-path, ROI, market-veridiction, externality, more-than-sum, and commodification-cascade tests;
   - mirror, Perseus, helm, winged-sandal, artifact-composition, fourth-wall, and comedy-interruption operations;
   - dimensional-petrification and stone-state typing;
   - event-horizon awareness;
   - bibliography screening and AI-failure analysis;
   - negative-control provenance.

3. **Mezo logic**
   - internal, mezo, and external logic as distinct operations;
   - compatibility before overlap;
   - cross-world comparison across fictional and nonfictional systems;
   - relation typing: archetypal continuity, functional analogy, causal equivalence, structural homology, surface resemblance;
   - source contamination as failure rather than partial success.

4. **Cave/fire/sun/Desert turning sequence**
   - shadows as mythos and apparent reality;
   - fire as partial logos, hearth, safety, and containment;
   - forest as first broader encounter;
   - singular sun as an apparent completeness that can become excommunicating;
   - many suns as competing perspectives and burden;
   - repeated realization, collapse, turning, and return;
   - return as teaching and shared responsibility.

5. **Full unresolved-question substrate**
   - 51 philosophical and methodological questions;
   - 69 narrative/world-system questions;
   - these should remain visible as questions rather than being silently answered.

6. **Research leads**
   - 41 source families, named works, thinkers, traditions, and source-status caveats;
   - provisional or source-needed records belong in `studylist`, not `citation`.

7. **Negative controls**
   - 74 explicit anti-TWIST rules;
   - these preserve failed drafts and rejected interpretations without granting them current doctrinal status.

## Pasted text 2: provenance-safe turn segmentation

The second pasted file contains four user turns and four assistant answer blocks. The file does not include explicit role labels. The `Worked for ...` lines make the segmentation recoverable.

| Lines | Provenance | Status |
|---|---|---|
| 1 | direct user text | asks why mezo is needed; uses initial spelling `mezzo` |
| 2 | interface timing metadata | exclude from content |
| 3–114 | assistant synthesis | distinct-object argument for mezo; unratified wording |
| 115 | direct user text | user-origin principle: a cross-world object can be compared only after internal consistency; Star Wars judgment explicitly uncertain |
| 116 | interface timing metadata | exclude from content |
| 117–283 | assistant synthesis | internal→mezo→external sequence, corpus delimitation, coherence thresholds, local/global and invariant-core methods |
| 284 | direct user text | tentative question: original Lucas films comparable, later material not |
| 285 | interface timing metadata | exclude from content |
| 286–300 | assistant synthesis | narrows the tentative claim; later corpora may be separate objects |
| 301 | direct user text quoting prior assistant wording | asks for the six-film audit |
| 302 | interface timing metadata | exclude from content |
| 303–512 | assistant synthesis | six-film Force audit and conclusion; requires external verification and user ratification |

### Direct user propositions

The only clear user-set methodological proposition in this paste is:

> “it can only be compared if it already has internal consistency”

The user’s claims that the Force “lost its own internal logic” and that “the original Lucas films CAN be compared but the rest can’t” are explicitly marked by the user as uncertain or interrogative. Preserve them as questions, not canon.

### Assistant synthesis suitable for ML* with visible status

These are strong candidate operations, yet their wording and classification remain assistant synthesis:

- mezo logic has a distinct object: relations between autonomous systems;
- mezo logic has a distinct procedure: cross-system translation with internal-fidelity checks;
- mezo logic produces graded compatibility rather than internal coherence or external truth;
- corpus delimitation precedes internal reconstruction;
- an object can be globally coherent, locally coherent, historically layered, internally contested, internally contradictory, or insufficiently specified;
- a mezo result may be undefined when an input lacks adequate coherence;
- zero correspondence and undefined comparison are different outcomes;
- an invariant core may be extracted from multiple historical versions;
- polymorphous transformation must remain traceable rather than logically amorphous.

These should enter as `ASSISTANT SYNTHESIS / UNRATIFIED` or as an AI-authored protocol linked to the direct user-set prerequisite.

### Six-film Force audit status

The conclusion that Episodes I–VI form “one globally compatible Force system with historically layered explanations” is assistant-authored and unratified.

The audit additionally makes external factual claims about:

- Lucasfilm descriptions;
- midi-chlorians;
- the living and cosmic Force;
- the Force dyad;
- healing and life restoration;
- official explanations of Force ghosts;
- film-specific powers, doctrines, and plot events.

Only Episode IV currently has a dedicated ML* citation record. The Matrix trilogy has citation records. The current ML* has no Dragon Ball/qi citation record and no citation records for Star Wars Episodes I, II, III, V, or VI.

Recommended status:

- store the six-film analysis under `analysis`, role `ai`;
- label the verdict `ASSISTANT SYNTHESIS / UNRATIFIED`;
- label every official-lore statement `EXTERNAL VALIDATION OWED` until linked;
- preserve the user’s narrower internal-coherence prerequisite as the controlling methodological claim.

### Quote-integrity warnings

The following quotation-like text must be checked against primary audiovisual or screenplay sources before it appears as direct quotation:

- “Luminous beings”
- “I cannot live without you”
- “I will die rather than become this”
- the quoted assistant sentence repeated by the user on line 301

The last item is conversation provenance rather than a Star Wars source quote.

## Conflicts and locked-rule seams

| Incoming material | Current lock or conflict | Safe handling |
|---|---|---|
| `Gorgon Wars / #gorgonwars` as story conflict and narrative corpus | Current `Gorgonwars` entry defines a recurring shared Gorgon operation and carries the latest feminism two-root synthesis | Type the senses: story title/corpus layer, general encounter-operation layer, current feminist application. Preserve all without replacement. |
| Siren as a Gorgon who consciously continues idiom advocacy | Later conversation material also describes Sirens as intelligent Gorgons who strategically remove snakes; the paste itself says the Siren–Witch boundary is unresolved | Keep as an unresolved classification question. Never silently choose one definition. |
| Witch as conscious snake/idiom wielder | Earlier academic/independent-magic layers remain present and the paste itself requires typing | Preserve conscious-wielder as one typed layer and retain the other layers visibly. |
| PDF says the Philosopher’s Stone is not identified with the sun and rays are not identified as perspectives | Later user-set canon explicitly identifies the Stone with the sun and rays with perspectives | Record the PDF finding as a source boundary. Preserve the later user-set Stone/sun/rays doctrine as current canon. |
| Existing `Internal logic + external logic` says both gates precede smashing | The second paste supplies the user-set prerequisite that internal coherence precedes comparison and assistant synthesis adds mezo between internal and external | Add a typed three-operation sequence without deleting the existing dual gate. Clarify when external fit is a precondition and when it is the post-mezo reality test. |
| Six-Lucas-film Force system is globally coherent | Assistant conclusion with no later user ratification | `analysis`, `ai`, unratified, verification owed. |
| `Polymorphous Mythology is the PhD` | This may be valid inside ML* while PhD language is explicitly excluded from the CV | Keep surface scope explicit. Never leak this statement into `/saul/` or application PDFs. |
| Power-Before-P0 Hydra | Current book correction says the book has no P0; the phrase names an AI failure in which power was inserted before a supposed P0 | Preserve as historical negative-control terminology. Do not infer that the current book has a P0. |
| `kyros` | The paste supplies this spelling without a source | Preserve exact spelling in provenance and flag for verification against `kairos`; do not silently normalize. |
| `Geeubeles`, `hogwartz`, and other deliberate-looking spellings | Exact coined spelling is part of the source history | Preserve exact source spelling and add a public normalization only if the user directs it. |
| named living-person archetypal candidates | Paste states they require individual evidence | Keep in `studylist` or `pending`; never classify a person from the compressed list alone. |
| ancient myth and post-1970 neoliberal structures | Paste explicitly warns against chronological collapse | Add chronology fields or headings and keep analogical relation separate from causal identity. |

## Candidate insertion map

| Bundle | Action | Section | Role/status |
|---|---|---|---|
| Mythology integration source/status register | new entry plus archive manifest | citation | `both`; user-supplied extraction; source evidence separated from synthesis |
| Mezo logic | new entry; cross-reference `Internal logic + external logic`, confluence, fuzzy logic, polymyth engine | methodology | `both`; user-set prerequisite plus source-supported definition |
| Pre-mezo admissibility protocol | new entry | methodology | `ai`; assistant synthesis; unratified |
| Force/qi/Matrix initial compatibility test | new entry or extension of mezo | methodology or analysis | mixed source status; citations required |
| Star Wars Episodes I–VI Force audit | new entry | analysis | `ai`; unratified; external validation owed |
| corpus-first methodology and ledgers | extend existing authorship, correction, source-honesty, and anti-backtracking entries | methodology/coreplus | preserve user/source/AI labels |
| reusable analytic operations | consolidate into a small operator-suite cluster; extend existing operations before adding titles | methodology/degorgonification | `both` for adopted source operations; `ai` for proposals |
| Gorgonwars story/corpus sense | extend current `Gorgonwars` with a typed narrative layer | gorgonification | `both`; must preserve latest two-root synthesis |
| unresolved Siren/Witch/Gorgon boundary | new pending record or extend current pending research | pending | open question |
| narrative lexicon and character mappings | one typed source-status ledger plus selected entries after PDF confirmation | analysis/pending/gorgonification | mixed; unresolved items remain questions |
| Cave/fire/sun/Desert turning | extend Cave/sun entries and add one turning-topology entry | sabachtan/methodology | `both`; later Stone/sun/rays correction preserved |
| 51 philosophical questions | one indexed research ledger with individual numbered questions | studylist | `both`; open questions |
| 69 narrative questions | one indexed narrative ledger | pending | `both` or `human` according to who owns the next move |
| 41 research leads | extend `AI research list` and specific citation records after verification | studylist first, citation after verification | proposal/source-needed |
| 74 anti-TWIST controls | extend `Anti-twisting rules` plus a dedicated source-bound negative-control ledger | methodology/coreplus | mixed; negative-control |

## Recommended source archive

Create a preserved source bundle under a path such as:

`polymyth/archive/mythology-integration-2026-07-28/`

Recommended files:

- both original PDFs;
- extracted text for each PDF;
- both pasted text files verbatim;
- `source-manifest.json` with filenames, sizes, SHA-256 values, page counts, and extraction method;
- `claim-ledger.jsonl` with:
  - source filename;
  - page or line;
  - original tag;
  - exact source wording;
  - normalized claim;
  - provenance class;
  - ML* destination;
  - existing-entry target;
  - status;
  - external verification debt;
- `README.md` explaining that source evidence, user adoption, assistant synthesis, quotations, proposals, questions, and negative controls remain distinct.

This archive follows the established `polymyth/archive/pre-meaninglib/` pattern.

## Integration and regeneration sequence

1. Hash the current canonical HTML and protected research artifacts.
2. Add an idempotent integration script, preferably:
   - `scripts/apply-ml-mythology-integration-2026-07-28.js`
3. Update or append entries only in `polymyth/methodologylist/index.html`.
4. Keep title-based update operations unique and fail loudly on zero or multiple matches.
5. Add a focused verifier, preferably:
   - `scripts/verify-ml-mythology-integration.js`
6. Run:
   - `npm run regen:all-txt`
   - `npm run export:meaninglib-dataset`
   - `npm run build:meaninglib-search`
   - `npm run build:ai-access-pack`
7. Run focused gates:
   - `npm run verify:methodologylist-manifest`
   - `npm run verify:ml-antibacktracking`
   - `npm run verify:ml-gorgonwars-premise-split`
   - `npm run verify:ml-stop-psychologism`
   - `npm run verify:ml-ai-prose-tells`
   - `npm run verify:meaninglib-dataset`
   - `npm run verify:meaninglib-search`
   - the new mythology integration verifier
8. Run the full build and complete release gate:
   - `npm run build`
   - `npm run verify:all:built`
9. Verify source/public byte parity.
10. Build the full/deployer-compatible ZIP and test its CRC and SHA-256.

The ordinary `npm run build` does not regenerate the ML* text mirrors or Meaninglib export from a changed SEED. The explicit regeneration and export steps above are required before the normal build.

## Focused anti-backtracking assertions to add

The new verifier should require:

- the user-set internal-coherence prerequisite;
- the exact spelling `mezo`;
- internal, mezo, and external logic as distinct typed operations;
- undefined versus zero mezo result;
- corpus delimitation and local/global/invariant-core options;
- no replacement of the current Gorgonwars two-root synthesis;
- Siren/Witch conflict remains visibly unresolved;
- the PDF-source boundary and later Stone/sun/rays canon both remain visible;
- the six-film Force verdict remains marked assistant synthesis and unratified;
- all Star Wars direct quotations require verified source anchors;
- 51 philosophical questions retained;
- 69 narrative questions retained;
- 41 research leads retained with status;
- 74 negative controls retained;
- PDF page references bind to named PDFs;
- generated text mirrors, section mirrors, static section pages, HF export, search index, AI access pack, and `public/` copies agree with the canonical HTML;
- re-running the integration script inserts zero additional entries and leaves the canonical hash unchanged.

## Counts to preserve through integration

- 501 atomic tagged records from `Pasted text(57).txt`
- 283 records containing `C`
- 24 proposal/question records without `C`
- 120 pure open questions
- 74 negative controls
- 4 direct user turns in `Pasted text (2)(6).txt`
- 4 assistant answer blocks in `Pasted text (2)(6).txt`
- 1 direct user-set mezo prerequisite
- 1 assistant-authored six-film Force verdict, retained as unratified

