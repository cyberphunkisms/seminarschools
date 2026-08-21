# Polymythcal Grade 4 writing contests update

Date: 2026-08-11

## Result

- Added seven verified source-backed records to the canonical Polymythcal corpus.
- Refreshed four existing records whose prior dates or links relied on older cycle projections.
- Added six official organizer sources to `scripts/sources.json`.
- Added explicit Grade 4 search language in `topics` and `tags`, plus the `kids` writing band, to every record in this review.
- Preserved all existing record IDs for refreshed contests.
- Excluded Story Search Canada from the 2027 set because its official site confirms only the inaugural 2026 edition.
- Corrected the Winnipeg and Vancouver watch-marker offsets without treating either correction as a reschedule.
- Preserved an explicitly blank province for Canada-wide and worldwide online contests instead of applying the Ontario default used for older manual records with no province field.
- Kept discovery labels out of `secondary_types`, whose schema is reserved for canonical event-type values.

## Why the earlier search looked incomplete

Four contests were already present: Kids Write 4 Kids, Awesome Authors, CNIB Braille Creative Writing Contest, and Meaning of Home. Their canonical records came from a June 2026 projection pass. Grade 4 eligibility appeared mainly inside prose, while the focused discovery surface depends on `writing_bands`. The official pages later supplied stronger 2027 evidence for three of those records. Meaning of Home remains an annual watch record because its 2027 edition is unannounced.

The genuinely absent records were Next Generation Short Story Awards, Inklings Book Contest, TSL International Student Competition, World Historian Student Essay Prize, the 2027 Royal Canadian Legion cycle, North Shore Writers' Association Annual Writing Contest, and Imagine a Canada.

## Confirmed 2027 dates

- Kids Write 4 Kids: closes 2027-03-31 at 11:59:59 pm Pacific Time.
- Next Generation Short Story Awards, Grade 8 and Under: closes 2027-01-28; closing time and timezone are unstated.
- Ottawa Public Library Awesome Authors: closes 2027-02-28 at 11:59 pm; timezone is unstated.

## Confirmed 2027 editions with exact dates pending

- Inklings Book Contest: opens in January 2027 and accepts submissions January through March.
- TSL International Student Competition: opens in early September 2026.
- World Historian Student Essay Prize: deadline announcement promised for September 2026.
- CNIB Braille Creative Writing Contest: opens in early 2027.

## Annual or recurring records awaiting a 2027 announcement

- Meaning of Home Student Contest.
- Royal Canadian Legion Literary Contest, with deadlines set by local branches.
- North Shore Writers' Association Annual Writing Contest.
- Imagine a Canada, Art and Essay Stream.

These records use visibly estimated calendar markers and retain `current-edition-unconfirmed`, `date-unconfirmed`, and `time-unconfirmed` reasons as applicable.

## Canonical identity and rebuild contract

The source-of-truth additions live in `data/manual-events.json`. `scripts/upsert-manual-calendar-events.js` now resolves explicit IDs before title and date keys, so a corrected estimated date refreshes the stable record instead of creating a duplicate. `scripts/merge_and_finalize.py` now carries the writing, eligibility, source-language, and opportunity fields through future harvest merges.

The search matcher now requires whole-word matches for short tokens, so `grade 4` cannot match unrelated phrases such as `400 words`. The civic feed also classifies marches through structural types and action-title language rather than treating the calendar month March as civic evidence. Regression coverage protects both cases.

The build verifier now compares every reviewed manual record's city, province, country, timezone, and eligibility region with its canonical counterpart. This prevents a future upsert from silently narrowing a nationwide or worldwide contest to Ontario.

## Official sources

- https://kidswrite4kids.ripplefoundation.ca/kids-write-4-kids-contest-rules/
- https://shortstoryawards.com/category.php?id=21
- https://collections.biblioottawalibrary.ca/en/awesome-authors-youth-writing-contest-0
- https://www.younginklings.org/inklingsbookcontest/
- https://trustforsustainableliving.org/take-part/international-schools-essay-competition-and-debate
- https://www.thewha.org/prizes-awarded-by-the-wha
- https://www.cnib.ca/en/about-contest
- https://www.meaningofhome.ca/
- https://www.remembrancecontests.ca/
- https://nswriters.org/annual-writing-contest/
- https://nctr.ca/education/imagine-a-canada/art-and-essay-stream/

## Validation

- The canonical build completed with 840 events and 428 registered sources.
- The manual upsert is idempotent: all 11 reviewed records refresh in place and no duplicate is inserted.
- The private and public canonical event files are byte-identical.
- All 11 reviewed records appear on the `writingkids` surface.
- A browser search for `grade 4` returns 13 genuine matches, includes all 11 reviewed records, and excludes the unrelated `400 words` false positive.
- The civic feeds exclude Kids Write 4 Kids and Inklings while retaining the Toronto Trans March and Toronto Dyke March records.
- The canonical release suite passed 166 of 166 checks on 2026-08-12.
- The exhaustive overlap browser gate passed 700 page scenarios, 4,900 scroll probes, 22,165 focus targets, and 2,090 real Tab steps.
- The visible geometry browser gate passed 125 renders across 99 surface signatures and all 45 route types.
- The futureproofing test suite passed, the 12 source-stage controls passed, and the final Audit 53 preservation gate passed across 10,915 governed baseline rows.
- A final field-level audit confirmed that all eight blank province values for Canada-wide or worldwide contests remain blank in the canonical and public copies.

## Complete release verification

On 2026-08-12, the exact hash-pinned Python audit dependencies were installed from `requirements-audit.lock`, the matching Chromium 149 runtime was supplied, and the canonical 166-check release suite passed in full. The complete packaging workflow now regenerates and verifies the checksum, clean-room report, disaster-recovery report, and artifact audit receipt from this exact source state; only those freshly generated companions belong to this update.
