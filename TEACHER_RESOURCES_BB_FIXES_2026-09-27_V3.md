# Teacher Resources and BB fixes — V3, 27 September 2026

This successor uses the exact saved V2 archive, SHA-256 `51023737aa3b2e70ea84ea8aa4fc028cf5bccb6a4f35611f6565f01b638b45a0`. All 21,395 predecessor payload paths are retained. The archive includes the website source, generated public site, and editable masters. It has not been deployed.

## The eleven issue groups

| Priority | Issue | Status | Work and evidence |
| --- | --- | --- | --- |
| P1 | Search reliability | Fixed | Joined titles, aliases and misspellings now combine with author and file type. `telltale heart Poe`, `telltale haert pdf`, `telltlae heart Poe PDF`, `Thank You Maam Hughes`, and `Thank You Mam PDF` find the intended works. Unrelated title/author combinations remain excluded. |
| P1 | Release consistency | Partly fixed; release blocked | Canonical generation refreshed the site; final repeat-build validation is blocked by restored build-lock state. Concordance was refreshed from its unchanged source records and its exact-content gate passes. Source/public parity and asset identities pass. Large-page budgets still fail; this is not a fully certified release. See the current gate evidence below. |
| P2 | Keyboard and navigation | Fixed | Show more focuses the first added result. Removing filters preserves useful focus. Skip links and legacy task fragments route to the visible result panel. The finder uses the same cross-document transition opt-out as its detail pages, avoiding the observed native navigation-abort error. |
| P2 | Initial hierarchy | Fixed | The default view shows browsing tasks and subjects before the catalog, instead of thirty arbitrary ranked cards. Active searches and filters reveal results. Search is visible within an 850px viewport at widths 320, 375, 768 and 1280; task navigation begins around 1,123–1,253px rather than over 12,000px down the page. |
| P2 | BB onboarding | Fixed | The Thank You, Ma’am module opens with a five-step guide, current after-story opening, seven preparation links and an explicit fictional three-player trial. The 185-item contents list starts collapsed. The generator retains the shared styles and structured metadata under both scoped and full builds. Public instructions no longer depend on this conversation. |
| P2 | Metadata usefulness | Open; source verification owed | 641 of 646 resources lack access classifications; 356 lack curriculum classifications; 87 use the generic grade value “all”. Missing or unverified suitability information remains explicitly uncertain. No source-by-source review has been performed; suitability, licensing, timings and answer keys are not inferred. |
| P2 | JavaScript failure | Fixed | Search controls and query-based task links appear only after successful initialization. With scripts disabled or blocked, the page explains the fallback and retains all 646 static resources and subject navigation. |
| P2 | Regression integration | Fixed | All three Teacher Resources/BB browser suites are mandatory in the release runner. A static release check requires exactly one copy of each command. The suites use isolated browser contexts and ephemeral local ports. |
| P2 | Fullscreen geometry | Fixed | The earlier idle check observed the intentional, input-triggered 360ms settling animation too early. The runtime now exposes target/settled state; the browser gate waits for the target within 1,200ms before checking palette and subsequent idle stability. Canonical linework, eight-colour palette, smooth cameras and bounded repaint work are preserved. |
| P2 | Sitemap contract | Fixed | The canonical build restores the localized sitemap block. All 41,207 translation assertions pass, and the module remains in generated sitemap/search output. |
| P3 | Audit document accuracy | Fixed | Repaired the broken V2 Markdown table and corrected the claim about 5,591 changed paths: it demonstrated divergence from a delivered snapshot, not nondeterminism between consecutive builds. V2 failure logs remain historical evidence. |

## What to open

- Play instructions: `SITE_PACKAGE/polymyth/bookwormburrows.txt`; readable introduction: `/bb/`.
- Reusable Thank You, Ma’am module: `/polymyth/modulecanon/thank-you-maam/`; source: `polymyth/modulecanon/thank-you-maam.json`.
- Individual player/session records: CampaignCodex, `/polymyth/campaigncodex/`.
- IELTS and Tell-Tale Heart: `/teacherresources/`. The homepage remains free of an IELTS feature. Existing IELTS files and editable masters are preserved.

## Current verification

- The three search/module browser suites pass all 75 checks (26 + 16 + 33). The state/layout suite passes 373 assertions across seven widths. Current phone/desktop screenshots accompany the reports.
- **Final repeat-build validation remains open:** BUILD IDEMPOTENCE CHECK FAILED — canonical source before probe contains unverifiable public-build transient state: lock, staging (block). An earlier candidate passed a 21,300-file fixed-point check, but that is not certification of this final snapshot.
- A full canonical build completed during this work; its historical transcript is included. Translation validation passed all 41,207 assertions. The final candidate is not claimed to have passed the full repeat-build gate. Source/public parity covers 9,877 allowlisted files; the public inventory including its release record is 9,878 files.
- The full geometry sweep exposed only Reviews-page visibility failures after the fullscreen settling check was corrected. Reviews opacity was adjusted from 0.060 to 0.160. The final focused sweep covers Reviews, Teacher Resources, BB, the module, campaign and fullscreen routes, plus the gate’s natural-input/Reader View probes. VISIBLE GEOMETRY BROWSER CHECK PASSED — 84 renders at bounded concurrency 4 cover 7 distinct included surface signatures at desktop, phone, and reduced motion, including 9 non-deduplicated natural-input/Reader View regression probes; all 26 canonical star pages render at desktop and phone without shared Indra; every included surface uses the exact 8-colour palette and 121cc099 canonical hash through two bounded-fade scrolling cameras while preserving hit/tab/layout isolation. The earlier full-sweep failure log is retained; this focused pass is not represented as a new all-route sweep.
- Canonical geometry still hashes to `9eed9e07f1c79fffa3bdd926977745bad5f90283bee3f7c6705d752bce347a0b`; the controlled coarse-input comparison retains 18 colour writes, with no pending idle frames. No palette or drawing threshold was weakened.
- Packaging selection retains the same selected file set. All 16 package regression tests pass. Disposable build tombstones are now pruned before file consideration; the geometry walker and repeat-build probe exclude the already-classified build quarantine rather than treating cached abandoned pages as site content.
- The latest full release-runner attempt reports **7/194 checks passed before stopping** at `node scripts/verify-geometry.js`. That attempt’s cached-build traversal failure was repaired afterward, and the standalone geometry guard passes. The remaining aggregate commands were not completed. The final repeat-build gate and independent page-size gate still block certification. No whole-site release certification is claimed.

The current page-size failures are preserved verbatim below. Budget ceilings were not raised to conceal them.

```text
PAGE SIZE BUDGET FAILED
 - polymyth/methodologylist/methodology/index.html current-release baseline is stale: 2016523 != 2016524
 - polymyth/methodologylist/coreplus/index.html current-release baseline is stale: 396005 != 396006
 - polymyth/bookwormburrows/index.html 645657 exceeds budget ceiling 630000
 - polymyth/campaigncodex/index.html 1118506 exceeds budget ceiling 1070000
 - polymyth/modulecanon/index.html 426414 exceeds budget ceiling 425000
 - polymyth/modulecanon/thank-you-maam/index.html is 767303 bytes and lacks a page-size budget entry
 - teacherresources/index.html 842541 exceeds budget ceiling 730000
```

Current evidence is in `SITE_PACKAGE/scripts/reports/teacher-bb-fixes-20260927-*.txt`, the three browser report JSON files, their screenshots, `teacher-bb-preservation-20260927.json`, and the post-package verification receipt. Historical V2 failure logs describe that earlier snapshot.


## Preservation and scope

All 645 original resources plus the IELTS record remain. BB has 246 records, MC 235, CC 296. All 185 reusable module record objects and the saved player record remain unchanged. This update changes the module’s standalone startup guidance and generated presentation, not its inherited source records.

The CORE mirrors, ML source records, all 25 editable-master files, original PDFs and Office documents remain intact. The generated CORE history pages change only the shared CSS cache version and trailing head whitespace; their historical record markup and entire body bytes are identical. The packager verifies this narrow boundary and rejects body/content changes or unrelated asset edits. Earlier release objects are retained; the new V3 object records an exact predecessor-to-current hash chain.

The broad HTML delta comes from the canonical build, shared asset token refresh and dated calendar outputs. It does not mean thousands of authored records were rewritten. The package receipt verifies every selected file, nested and outer manifests, ZIP CRC, archive classes and recovery requirements. No predecessor path is removed.

External resources have not been reviewed individually. The missing Harlem attachment has not been recreated or inserted. Geometry evidence is local Chromium rendering, not physical-device or cross-engine certification. No live website deployment or external chat-host integration is claimed.
