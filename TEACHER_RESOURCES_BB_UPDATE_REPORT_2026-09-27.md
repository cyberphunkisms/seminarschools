# Teacher Resources and BookwormBurrows update — September 27, 2026

This is a complete successor to `seminar-schools-mephistodata-ouroboros-claim-fidelity-complete-2026-09-11.zip`, SHA-256 `c8c82f7ad9f4b4d827f634a3f4e1802930681cbf30a2fdd71e783388ba4a9cdd`. Its 21,361 payload files were individually checked against the predecessor manifest before editing. A newer `upack.zip` contained only four unrelated Medusa documents and was not used as a website source.

The user authorized updating the newest full ZIP with the BB instruction correction, IELTS placement, and the Teacher Resources search improvements discussed in this conversation. No live deployment was requested or performed.

## What changed

| Problem | Implemented change | Evidence |
| --- | --- | --- |
| “telltale heart” failed while punctuation-sensitive variants worked | Normalized spacing, punctuation, accents and title aliases; ranked exact title, author, partial title and explicitly labelled approximate matches | Browser scenarios and shared search engine |
| “Poe” returned unrelated collection matches | Searches resource fields rather than inherited publisher/collection descriptions; shows why each result matched | Author-precision browser scenario |
| Texts excluded the Holt Tell-Tale Heart worktext | Overlapping Texts and Practice categories; aligned quick filters and task links | Text and practice browser scenarios |
| Results were buried beneath browsing structures | Ranked results directly below the controls, work grouping with all versions retained, 30-work pagination, removable filters | Browser scenarios and responsive checks |
| Mobile and sticky controls obstructed results | Collapsible mobile quick filters; filters stay in page flow; readable source actions; ornament stays outside result cards | 320–1280 px layout checks; screenshots |
| Enter unexpectedly opened the first external result | Enter shows and focuses the results; opening a source requires its own action | Keyboard scenario |
| Filters could look like missing content | Explicit query/filter URL state, filter-only recovery, close-title suggestions, retained detail-return query and scroll | Recovery, return and history scenarios |
| Unclassified metadata could imply suitability | Unknown grade/curriculum records excluded from specific filters unless explicitly included and labelled; resource details state unknown contents, length, proficiency and answer-key availability | Unknown-metadata scenario |
| File/access information was hard to compare | File/access filters and result facts; known unavailable sources retain their source notes; teacher-answer titles receive a teacher-material label | Static contracts and source preservation |
| IELTS sat outside normal discovery | Added the existing IELTS guide as TR-0646 with stable details, feed and sitemap entries; removed the oversized Teacher Resources landing-page feature | IELTS browser scenario and 646-record source/feed checks |
| Game preparation was confused with saved campaign state | BB startup instructions and rulebook distinguish BB play instructions, MC reusable modules, and CC individual playthroughs | BB regression and semantic preservation checks |
| Thank You, Ma’am material needed a clear module home | Added a readable MC dossier and structured JSON with 185 inherited reusable records; retained legacy CC references and identifiers | All 185 source objects compared to the predecessor |
| A new three-player pretend game could accidentally reuse a saved party | Explicit demo startup guidance; source characters remain separate; an actual saved player character is retained unchanged in CC and excluded from the reusable dossier | Saved-record preservation check |
| Image claims confused references with displayed assets | Instructions require separate checks for embedded images, links, stored assets and citations | BB startup, compiled rules and module guidance |

The site homepage in the verified predecessor already contained no IELTS feature. It remains unchanged. IELTS is now a normal searchable item inside Teacher Resources. The existing guide and all editable IELTS masters are preserved.

## Where to find the play instructions

- `SITE_PACKAGE/polymyth/bookwormburrows.txt` — complete downloadable BB instructions; startup entry `dm-115` is updated.
- `SITE_PACKAGE/polymyth/bookwormburrows/index.html` — canonical BB operation file.
- `SITE_PACKAGE/polymyth/polymythdnd/ruleset.md` — compiled pickup-and-run rulebook, with the same routing and demo-start correction.
- `SITE_PACKAGE/bb/index.html` — public how-to-play entry.
- `SITE_PACKAGE/polymyth/modulecanon/thank-you-maam/index.html` — readable reusable module dossier.
- `SITE_PACKAGE/polymyth/modulecanon/thank-you-maam.json` — structured preserved source records.

## Verification

- Browser: Chromium 153.0.8010.0. Search, title variants, Texts/Practice, author precision, edition grouping, IELTS, Enter, filter recovery, detail return, unknown metadata, multilingual input, pagination, print, reduced motion and no-JavaScript fallback passed. No page runtime errors remained.
- Existing state/layout regression: 373 assertions passed across seven widths (320, 375, 600, 768, 820, 880 and 1280 pixels), clean/shared URLs, legacy storage removal, history and complete result cards.
- All 645 original resource objects retain their original fields and values. IELTS adds one record. Original stable routes and original source actions remain.
- BB retains 246 entries; CC retains 296; MC has 235 after one new module entry. Unchanged record fields and original bodies were compared with the verified predecessor.
- BB clarification, mechanics synthesis, kid-friendly presentation and final-readiness checks passed.
- Teacher Resources static, scoped-generation, feed and external-destination classification checks passed.
- Meaninglib dataset, search and AI access-pack verification passed. Non-game export content is preserved; snapshot timestamps were refreshed consistently.
- The public build contains the matching source bytes and excludes private masters/operator material. The existing boundary gate checks ten primary editable masters; archive preservation separately retains every one of the 25 files in the complete editable-masters folder.
- Browser evidence and semantic preservation reports are under `SITE_PACKAGE/scripts/reports/`.
- Final archive manifests, predecessor retention, protected masters/CORE, file classes and disaster-recovery checks are performed by the successor packager. The accompanying verification JSON reports their results.

## Limits and remaining content work

This update fixes discovery and makes unknown metadata explicit. It does not claim to have opened and evaluated every external document, verified all links live, or assigned new reading levels, timings, licensing, full-text/excerpt or answer-key classifications. Existing source-availability findings remain; additional metadata requires reviewing those files.

The inherited historical dossier is preserved with its original citations and uncertainty. Migration does not newly verify its historical claims. The missing attached Harlem photograph was not reconstructed or inserted; the instructions now prevent a linked image or citation from being reported as an embedded photograph.

The ZIP contains source, build scripts, public files and editable masters. It has not been published to the live website.
