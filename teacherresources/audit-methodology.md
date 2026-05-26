# Teacher Resources Audit — Methodology

## Purpose

The seminarschools.com/teacherresources index has 554 entries across 50 collections. Of these, **149 entries are text-only** (no worksheets, no vocabulary, no comprehension questions, no visual organizers). The Amy Tan "Rules of the Game" entry shown by Saul on May 9 2026 is the canonical example: a clean PDF of the story with nothing attached.

The audit goal is **additive**. For every text-only entry that has a strong worksheet/study-guide ecosystem available on the open web, add a companion entry pointing to the worksheet version. Never delete the standalone-text version. Some teachers want clean text. The goal is to make the worksheet version reachable from the same row.

## Scope inventory

| Group | Format | Count | Audit priority |
|---|---|---|---|
| literature | gutenberg-text | 109 | Bucket 2 (longer-form, novels) |
| curated | clean-text | 26 | **Bucket 1 (Saul's example bucket; canonical short stories)** |
| history | primary-source | 14 | Bucket 3 (specialized; LOC and DocsTeach already-companion-rich) |
| **TOTAL TEXT-ONLY** | | **149** | |

Batch 01 covered 8 of the 26 clean-text entries. 18 clean-text plus 109 gutenberg-text plus 14 primary-source remain.

## Acceptance criteria for an audit-add entry

A worksheet/study-guide companion qualifies if it has at least one of:

- vocabulary list with definitions
- comprehension questions (short answer, multiple choice, true/false)
- discussion questions (open-ended, Socratic, paired)
- quiz or assessment with answer key
- visual organizer (plot diagram, character chart, theme tracker, irony tracker, Cornell Notes)
- lesson plan (timed, with procedures and standards alignment)
- paired-text companion
- close-reading scaffold

Plus must be:

- free
- public-facing (no login wall)
- on a stable host (see priority order below)

## Preferred host priority

1. **State DOE / Provincial Ministry** (Louisiana DOE, NY State ED, Ontario, BC, etc). Most stable. Curriculum-aligned.
2. **School district CMS** on `.k12.*` domains. Moderately stable.
3. **University / college** on `.edu` domains. Stable. K20 Center (Univ. of Oklahoma) and Lit2Go (USF) are repeat-canonical sources.
4. **Museums and public libraries**. Stable.
5. **CommonLit, ReadWorks, Newsela** free tier. Stable but free-tier may shrink over time.
6. **eNotes, LitCharts, SparkNotes, GradeSaver, Shmoop**. Stable but commercial. Free tier is reliable for these specific URLs.
7. **Teacher Weebly / classroom CMS**. Least stable. Often best content. Use only if no higher-tier source.
8. **Internet Archive scans** of textbook teacher editions. Stable but borrow-restricted.

## Hosts to reject

- **TeachersPayTeachers** (paywalled)
- **Course Hero** (paywalled)
- **Scribd** (paywalled, low-quality)
- **study.com** (paywalled past first paragraph)
- **brainly, gradesaver question forums** (low-quality, often wrong)
- **SEO-redirect domains** (voteforthepig.tennessee.edu and similar fake subdomains pretending to be .edu)
- **Aggregator blog spam**

## Format-tag mapping

The existing format vocabulary in `data.formats` is closed-set (25 tags). The audit reuses existing tags rather than coining new ones:

| Audit-add type | Existing format tag |
|---|---|
| Single-PDF lesson with worksheet | `lesson-pdf` |
| Webpage lesson | `lesson-page` |
| Multi-page teacher curriculum unit | `teacher-guide` |
| Curated link directory of free lesson plans | `aggregator` |
| State-DOE companion document | `teacher-guide` (sometimes `full-book` if substantive) |

If a future batch encounters a resource that genuinely needs a new format tag (e.g. `worksheet-set`, `study-guide`, `comprehension-questions`), flag it for Saul to decide naming. Do not coin slugs unilaterally.

## Workflow per entry

1. Identify the text-only entry from the JSON catalog.
2. Web-search the title plus author plus `worksheet OR vocabulary OR study guide OR lesson plan` plus a host hint (`site:k12 OR site:edu OR site:doe`).
3. Filter by host priority. Reject TPT and paywalled sources.
4. For each surviving candidate, verify:
   - The URL resolves to actual content (not 404, not redirect to home).
   - The content matches the acceptance criteria (vocab OR questions OR organizer OR lesson plan).
   - The host is on the priority list, not the rejection list.
5. Write an audit-add entry following the existing schema. Use existing format tag. Mark `_pairs_with` for human-readable cross-reference.
6. Append to the patch file. Never modify or delete the existing text-only entry.

## Architectural decision pending Saul

**BW-beside-ELA rule.** Saul's instruction on May 9 2026: "from now on the future links should be a BB beside the ELA perhaps." This requires a schema decision:

- **Option A (multi-subject array)**: change `subject: "ela"` to `subject: ["ela", "bb"]`. Requires updating the rendering JS that filters and tags entries.
- **Option B (companion field)**: add `bb_link: "url"` field. Single-subject preserved. Rendering JS adds a second tag pill from the new field.
- **Option C (separate entry pair)**: each subject is its own entry with shared metadata. Doubles row count.

**Decision pending.** Per no-naming rule, this audit batch does not implement either option. Audit-add entries continue with `subject: "ela"` until Saul specifies. When the spec is set, the audit batch can be re-emitted with the new field.

## HTML coordination rule pending implementation

**cmp-001.html and every future cc⋆ HTML page must include a top-bar link to seminarschools.com/teacherresources** alongside the existing project-nav. The teacherresources page itself already has a project-nav with seven projects (Home, Agora, Marginalia, Sabachtan, Ohm Dome, Nutrition, Resources, Florilegium). The cmp-001 page when built should match this nav structure.

## Merge protocol

The patch file is a delta. To merge:

1. Open `index.html`.
2. Locate `<script type="application/json" id="resources-data">`.
3. For each patch in the patches array, find the target category by `target_category_id` inside the `groups[].categories[]` tree.
4. Insert each `entries_to_add[]` block into the target `category.entries[]` array. Insertion point: after the `_pairs_with`-named existing entry, so the worksheet companion sits adjacent in the rendered page.
5. Strip the `_pairs_with` and `_meta` keys before serializing. They are audit-trail metadata, not catalog data.
6. Re-run the feed-build script to regenerate `feed.xml`.
7. Verify byte-count and entry-count change matches the patch (Batch 01 adds 14 entries, expected new total 568).

## Subsequent batches

| Batch | Bucket | Count | Priority |
|---|---|---|---|
| 02 | clean-text remaining | 18 | High (jerrywbrown.com hosts these; same audience and grade level as Batch 01) |
| 03 | gutenberg-text — top 20 most-taught | 20 | Medium (Pride and Prejudice, Frankenstein, Gatsby, Mockingbird, etc) |
| 04 | gutenberg-text — remaining 89 | 89 | Lower (long-tail classics) |
| 05 | primary-source — 14 history docs | 14 | Specialized; LOC, DocsTeach, iCivics already have lesson plans for most |

Each batch produces its own JSON patch file (`audit-batch-NN.json`) and summary report. Batches are merged sequentially with byte-count verification.

## Verification on this batch

- Catalog before: 554 entries / 50 collections / 11 groups / 25 formats.
- Catalog after Batch 01 merge: 568 entries / 50 collections / 11 groups / 25 formats.
- Format tags introduced: zero (per no-naming).
- Format tags reused: `lesson-pdf` (5 times), `lesson-page` (6 times), `teacher-guide` (1 time), `aggregator` (2 times). Total 14 audit-add entries.
- Hosts represented: theaegisinstitute.org, litcharts.com, doe.louisiana.gov, studylib.net, k20center.ou.edu (×2), etc.usf.edu, users.manchester.edu, eltbuzz.com, varsitytutors.com, libguides.southflorida.edu, sparknotes.com, lcps.org. Twelve distinct hosts.
- All URLs verified to resolve as of 2026-05-09.
