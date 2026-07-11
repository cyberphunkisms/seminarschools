# CORE, CORE+, and persistent-memory audit

Date: 2026-07-11

Scope: the persistent context accessible in this conversation, the canonical Methodologylist SEED, the generated CORE+ mirrors, the always-on charter, and the current full-site archive. Exact platform-side byte usage and hidden slot allocation are not exposed, so this audit compares the memory content available to the model with the project files that define CORE and CORE+.

## Rule added by explicit instruction

**CORE MEMORY LOCK.** Persistent memory changes are explicit-only. The AI does not add, infer, revise, merge, or delete memory because information appears durable, useful, repeated, personally relevant, or likely to matter later. A memory write occurs only when the user explicitly gives a memory instruction such as remember this, add this to memory, save this, update memory, forget this, or delete this from memory. Behavioral rules use the shortest adequate CORE trigger in memory and the expanded text in CORE+. Project facts, research, source corpora, locators, and extended notes belong in files unless memory storage is explicitly requested. The lock exists because memory space is limited.

This rule was integrated into the current R38 REMEMBRANCE-AUDIT and added as a dedicated CORE+ entry. No other memory was added, changed, consolidated, or deleted during this audit.

## What each layer is

| Layer | Function | Correct content | Incorrect content |
|---|---|---|---|
| Persistent memory | Platform persistence available across conversations | Explicitly saved personal facts and compact behavioral triggers | Automatically inferred preferences, temporary logistics, long project histories, source corpora, conversation locators |
| CORE | The compressed behavioral-trigger subset inside persistent memory | Current cross-session rules that must fire quickly | Examples, origin stories, citations, historical versions, research, project archives |
| CORE+ | The expanded canonical mirror inside ml* | Full rule text, failure modes, examples, origins, citations, cross-references, retired history | A substitute for loading current CORE triggers at response time |
| ml* and sibling files | Project canon, framework content, study material, source routes, module content | Extended project knowledge and source-preserving records | Scarce memory triggers unless a rule requires runtime activation |

CORE is therefore a subset of persistent memory. Persistent memory is broader than CORE. CORE+ is a file-backed expansion of CORE and also preserves retired or historical rule states.

## Current numerical state

- The canonical Methodologylist contained 1,136 entries before this update and now contains 1,137.
- CORE+ contained 61 entries before this update and now contains 62.
- CORE+ includes current mirrors, historical mirrors, retired mirrors, adjacent enforcement rules, project-specific routing rules, and reference locators.
- The static `/polymyth/methodologylist/core/` page contains two framework entries. It is not the compressed CORE memory layer. The shared word `core` creates a naming collision.

## The accessible persistent memory now

The persistent context available in this conversation contains far more than CORE. It includes these broad categories.

1. Personal profile, education, languages, location, partner, and historical health notes.
2. Employment history, application targets, availability, compensation figures, CV architecture, and writing preferences.
3. Creative and public projects including Astral Craft, OHMDOME, BookwormBurrows, and related specifications.
4. Seminar Schools, Meaninglib, Hugging Face, star-file architecture, deployers, baselines, and operational history.
5. E-bike routes, charging constraints, Muskoka travel details, and confirmed outlets.
6. Local food, shopping, restaurant, and neighbourhood preferences.
7. Intellectual themes, sources, political and philosophical interests, and project vocabulary.
8. General response rules, provenance rules, anti-TWIST rules, full-ZIP behavior, citation expectations, and build-state expectations.
9. The compact pointer to follow CORE and CORE+.
10. The new explicit-only CORE MEMORY LOCK.

These categories show that persistent memory currently functions as a mixed personal profile, project-state cache, preference store, and behavioral-rule layer. That is broader than the intended CORE architecture.

## Differences between CORE and current memory

### 1. CORE is behavioral. Memory is mixed.

CORE is supposed to contain compressed rules that govern future behavior. Current memory also contains personal history, temporary trip information, old job applications, local food requests, past health episodes, versioned ZIP names, and deployment history.

### 2. CORE should be current-only. Memory contains accumulated state.

A trigger should represent the current rule. Current memory contains older operational facts that may have been correct for one release or trip and later became stale.

### 3. CORE uses scarcity deliberately. Memory accumulated convenience context.

Many remembered facts were useful in one domain but consume the same limited persistence layer as load-bearing behavioral rules.

### 4. CORE has a file-backed expansion. Ordinary memory does not.

A CORE trigger can point to CORE+ for detail. Personal, travel, employment, and health memories have no equivalent canonical expansion or change history.

### 5. CORE edits require synchronization. Ordinary memory edits do not automatically update files.

Slot 13 requires behavioral CORE edits to update the CORE+ mirror in the same turn. Personal facts remain memory-only unless the user explicitly requests another destination.

## Differences between CORE and CORE+

### 1. Compression versus expansion

CORE stores a compact trigger. CORE+ stores full operational language, failure modes, examples, origin notes, citations, and cross-references.

### 2. Current state versus archive

CORE should contain only the active rule. CORE+ deliberately preserves historical and retired versions.

### 3. Immediate firing versus retrieval

CORE can fire from persistent context. CORE+ must be retrieved from the project file or website. A memory entry that merely says `follow CORE and CORE+` is a useful pointer, but the detailed rules cannot operate reliably when CORE+ is unavailable or never loaded.

### 4. Slot identity versus conceptual archive

CORE uses numbered slots. CORE+ contains multiple generations of the same slot number because content moved or slots were reassigned.

Current duplicate or historical slot-number clusters include:

- Slot 2: historical Ouroborosanalyses mirror and current Activations Dispatch.
- Slot 18: historical Standpoint Epistemology and current Scope + Organize-Mine + Injection.
- Slot 20: historical Spectacle-Asymmetry and current R31-R35 + R39 behavioral bundle.
- Slot 23: historical Ironmanning and current R36-R42 methodology bundle.
- Slot 24: historical Deus Vult, current Bootstrap, and a Bootstrap amendment.
- Slot 29: retired Seminar Schools, historical Tool-Budget + Componentlists, and current PM17 Binary Opener.
- Former slot references also survive inside preserved research entries for slots 19 and 22.

The history is useful, but CORE+ is not a clean current-slot map. A reader must interpret `current`, `historical`, `retired`, and changelog language.

### 5. CORE+ contains more than expanded CORE mirrors

CORE+ also contains CL rules, teacher-resource routing, deployment locators, project definitions, generation gates, and preserved research. This is legitimate as an expanded reference layer, but the section name now covers both `expanded runtime rules` and `core-adjacent operational archive`.

## Duplication between current memory and CORE+

The accessible memory repeats or summarizes several rules already represented in CORE+.

- Writing rules including no staccato prose, no inferable restatement, and no prohibited punctuation habits.
- Anti-yapping and answer-the-question discipline.
- Full-site ZIP default.
- Meaninglib and star-file routing.
- Source-preserving authorship boundaries.
- Anti-TWIST, stop psychologism, no backtracking, and build-state discipline.
- Citation and verification expectations.
- The pointer to use CORE and CORE+.

This duplication gives short-term reliability when files are unavailable, but it consumes memory and creates drift when one copy changes without the other.

## Drift and contradiction audit

### 1. Proactive memory capture contradicted the intended architecture

The assistant stored a Draft 3 writing instruction without an explicit memory request. That action treated durability as authorization. The new MEMORY LOCK closes this route.

### 2. R38 was explicit in its trigger but incomplete in its prohibition

The former R38 began `When user says remember X`, which described what to do after an explicit request. It did not directly prohibit proactive memory writes. R38 now includes that prohibition.

### 3. The `follow CORE and CORE+` pointer is smaller than the behavior it represents

The pointer saves memory, but it only works when CORE+ is actually available and retrieved. The website ZIP or current ml* mirror remains necessary for full fidelity.

### 4. The `/core/` route does not represent CORE memory

The route has two framework entries and may be mistaken for the compressed runtime rule layer. No content was moved during this audit because the route is an existing framework section. The distinction is now documented.

### 5. CORE+ preserves history at the cost of immediate clarity

Multiple slot generations are correctly preserved under consolidation-not-deletion, but a current-only index would make runtime loading safer. No new index was added because this audit was asked to diagnose differences, and the new memory rule forbids unrequested proliferation.

### 6. Current memory contains likely stale operational facts

Versioned release names, previous deployer names, old baseline ZIPs, temporary route constraints, open-now food searches, and past application targets can become obsolete. They have no automatic freshness mechanism.

### 7. Current memory includes sensitive or highly personal categories

Health history, partner references, and detailed personal logistics sit outside CORE. Their presence may be useful in relevant conversations, but they consume limited memory and should remain only by explicit user choice under the new rule.

## What belongs in memory under the corrected architecture

### Strong candidates to retain

- `Follow CORE and CORE+.`
- `CORE MEMORY LOCK.`
- The smallest triggers required to retrieve and apply CORE+.
- Personal facts the user explicitly asks to preserve.

### Material that usually belongs in CORE+

- Expanded behavioral rules.
- Worked examples and failure cases.
- Rule origins and changelogs.
- Cross-references and citations.
- Historical or retired rule versions.

### Material that usually belongs in project files

- Book source prose and conversation corpora.
- Website architecture and release state.
- ZIP baselines and deployer details.
- Research, author lists, and citation ledgers.
- Travel routes, event data, restaurant research, and temporary logistics.
- Extended CV, employment, and application history.

### Material that should remain conversation-only unless explicitly saved

- One-off preferences.
- Temporary plans.
- Passing corrections that are already covered by an existing CORE rule.
- Short-lived health or location context.
- Current shopping or open-now constraints.

## Candidate memory reductions

No deletion was performed. The following categories are candidates for a future explicit deletion or consolidation instruction.

1. Muskoka e-bike route history and old charging-stop state.
2. Local restaurant, bakery, iced-coffee, hotel, and open-now searches.
3. Past job applications, salary figures, and expired availability windows.
4. Old deployer versions, superseded ZIP baselines, and release-specific filenames.
5. Temporary health episodes and one-off symptom questions.
6. Duplicate writing rules already covered by CORE and CORE+.
7. Duplicate full-ZIP, anti-TWIST, anti-backtracking, and provenance rules already represented in project files.
8. Detailed project history that is already preserved inside the full website archive.

A deletion pass now requires an explicit instruction naming the categories or individual memories to remove.

## Synchronization completed in this update

- Persistent memory: compact CORE MEMORY LOCK saved by explicit instruction.
- CORE: the memory trigger is active without creating a second long-form rule slot.
- CORE+: dedicated expanded rule added.
- Current slot 23 R38: updated to include explicit-only memory writes and file routing.
- Canonical Methodologylist SEED: updated.
- Full and section text mirrors: regenerated.
- Static CORE+ HTML: regenerated.
- Concordance, manifest, search, dataset, AI access pack, and public deploy: rebuilt.
- No unrelated memory deletion, memory consolidation, or project-rule proliferation performed.

## Release verification

The rebuilt full site passed all 81 release checks after regeneration and public-deploy rebuilding.
