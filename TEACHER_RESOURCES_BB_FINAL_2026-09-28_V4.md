# Teacher Resources and BB final fixes — V4, 28 September 2026

This full successor is based on the verified V3 ZIP, SHA-256 `93f00bdef4a639eed7e349df26ba6764b6bc811ab33893ba12b43e71caebc6e9`. All predecessor payload paths, editable masters and source content are retained. No deployment was performed.

## Current status

The canonical build passed. All **195 of 195 release checks passed** across the interrupted and resumed serial executions. The first execution completed 114 checks. Source and public-file hashes were checked before the remaining 81 commands resumed. The release report records that continuity and the exact command sequence. The separate package receipt establishes archive integrity and preservation. Individual external teaching-resource review remains partial. Some inherited machine reports retain the deterministic base-release timestamp. The V4 amendment and package receipt identify this successor and bind its current evidence.

## Priority closeout

| Priority | Issue group | V4 status |
| --- | --- | --- |
| P1 | Search reliability | Fixed; final search and module browser suites pass |
| P1 | Release consistency | Fixed; complete build, repeat-build and release suite pass |
| P2 | Keyboard and navigation | Fixed; focused and full release browser coverage retained |
| P2 | Initial hierarchy | Fixed; task-first layout and bounded mobile controls retained |
| P2 | BB onboarding | Fixed; playable instructions, reusable module and individual campaign roles are explicit |
| P2 | Metadata usefulness | Improved; individual source review remains open |
| P2 | JavaScript failure | Fixed; 646-resource static fallback retained |
| P2 | Regression integration | Fixed; browser and metadata gates run in the release suite |
| P2 | Fullscreen geometry | Fixed; full geometry sweep passes |
| P2 | Sitemap contract | Fixed; 41,207 translation assertions and module discovery pass |
| P3 | Audit document accuracy | Fixed; historical failures retained and current evidence distinguished |

Ten of the eleven issue groups are resolved. Metadata source review remains partial and is not counted as resolved.

## Final fixes

- Teacher Resources keeps all 646 static resources and their original-source and detail links. Removing duplicate route attributes and unused defaults reduces the page from 842,541 to 724,344 bytes, under its existing 730,000-byte ceiling. The finder’s combined compressed HTML, CSS and JavaScript remain under the existing 100 KB budget.
- Access labels distinguish publisher policies from individual resource checks. Six primary publisher policy pages support 342 catalog records. Fifteen local resource records link to files or pages verified in this build. Four prior unavailable-source records remain unchanged. The other 285 resources retain an explicit unknown access status.
- Each affected resource detail includes its access-policy citation and review date. Grade and curriculum labels are identified as catalog classifications with source alignment unverified. Unrecorded audience, content, proficiency, length and answer-key fields are consolidated into one clear note. Generic “all” grades no longer produce a claim of multi-grade suitability in generated descriptions.
- BB and MC embedded JSON is compacted without changing any decoded record. They now fit their existing page ceilings. The complete 296-record CC archive and the full 185-record Thank You, Ma’am dossier have measured long-form exceptions with narrow headroom. All inherited source text, citations and identifiers remain available.
- September 6 asset measurements were stale for accepted V3 content. The Methodologylist text, concordance and rule-hardening addendum are byte-identical to V3. Their measured baselines are updated, with ceilings of 4,230,000, 11,300,000 and 141,000 bytes respectively. The full public deploy is 170,261,295 bytes, 2,747 bytes smaller than V3. Its aggregate ceiling is 171,000,000 bytes, less than 0.5% headroom. Default extension limits remain unchanged.
- The release and ML execution verifiers follow the V1 → V2 → V3 → V4 file-hash chain. Earlier amendment objects remain immutable and hash-pinned. Historical hashes no longer get mistaken for the current artifact hashes.
- Current verification contracts now recognize the accepted 646-resource catalog, current calendar partition and asset versions. The last aggregate failure exposed August asset and package constants in the Audit 49 verifier. These now match the unchanged September asset and package 1.0.7 already present in verified V3. Its release and predeployment dependencies were rechecked. The calendar tests preserve month-only end-date uncertainty and pass all ten interoperability checks.
- The active preservation gate now compares V4 with the exact verified V3 baseline. It rejects missing predecessor files, unauthorized new paths, changed masters or CORE, changed canonical BB/CC/MC records, and unbound source changes. Earlier historical transition verifiers remain intact. The fixture suite now verifies the sealed September 5 contract and tamper fixture as exact historical bytes, then tests the live V3 to V4 transition separately. Its five deliberate failure fixtures and positive fixture pass.
- The teacher asset updater preserves stylesheet placement while refreshing cache versions, removing the repeated relocation that made finalized pages fail freshness checks. The module now includes its social-preview metadata. BBT membership checks accept both valid JavaScript object and JSON representations.
- The register gate protects exact accepted V3 source wording and punctuation only while the visible-text fingerprint matches. New or changed prose invalidates that protection. The underlying accepted text was preserved.
- Verification runs in an isolated directory outside the synchronized workspace, with the existing build locks enforced. No lock guard was bypassed.
- The destination browser gate now checks the accepted source-first action order, supported by the unchanged actions-flow test and source-first audit. Exact external URLs, safe link attributes, localized secondary Details and explicit missing-link messages remain enforced. No calendar runtime or source record changed for this correction.
- The first complete browser sweep exceeded the default ten-minute per-command limit while the large overlap and geometry matrices ran together. The final verification uses serial mode and an explicit thirty-minute per-command ceiling. The successful receipts span the interrupted execution and subsequent resumed executions. All routes and assertions remain enabled. The candidate retains its original Toronto build day of 27 September. A first resumption after midnight correctly failed the featured-feed date check because the wrapper selected 28 September. The remaining 81 commands were restarted with the original build date explicitly pinned. After the aggregate contract correction at check 193, verification finished the remaining commands. Failed attempts remain in the historical transcript. Verify the delivered candidate with `SITE_BUILD_DATE=2026-09-27 PYTHONPATH=<pinned audit dependencies> CHROME_EXECUTABLE=<Chromium executable> npm run verify:all:built -- --concurrency=1 --timeout-ms=1800000`. A new canonical build selects the current Toronto day.

## Verification and preservation

All 75 search/module browser checks pass on V4. The metadata browser check verifies the publisher-account filter, result labels, cited detail-page evidence and phone overflow. Phone renders were inspected. The metadata regression gate also rejects lookalike hosts, out-of-scope URL paths, unavailable-source overrides and nonexistent local files.

The build passed all 41,207 translation assertions and source/public parity. All 646 original V3 resource records and the complete reusable module JSON remain byte-identical. BB has 246 records, CC 296 and MC 235, with every decoded record unchanged. All 25 editable-master payload files remain byte-identical. CORE mirrors and historical source records remain preserved.

Repeat-build gate evidence:

```
PASS 299944ms  node scripts/verify-build-idempotence.js
```

The 22 heavy-page entries are budgeted and the asset-weight gate passes. Current transcripts are in `SITE_PACKAGE/scripts/reports/teacher-bb-final-20260928-*.txt`. Earlier V2 and V3 failure transcripts remain historical evidence. The first V4 concurrent run is preserved separately in `teacher-bb-final-20260928-initial-runner.txt`.

## Remaining source-review work

Metadata enrichment is still partial. Publisher policy checks are not item-by-item availability, licensing, suitability or contents reviews. Access is unclassified for 285 resources, curriculum is unrecorded for 356, and 87 have an unspecified grade range. Existing grade/curriculum labels have not been independently certified. These gaps are visible and are not replaced with invented information.

The missing Harlem image attachment has not been recreated or inserted. No external chat-host integration or physical-device/cross-engine certification is claimed.

## Entry points

- Play instructions — `SITE_PACKAGE/polymyth/bookwormburrows.txt` and `/bb/`.
- Reusable module — `/polymyth/modulecanon/thank-you-maam/`.
- Individual games and players — `/polymyth/campaigncodex/`.
- IELTS and Tell-Tale Heart — `/teacherresources/`. IELTS remains outside the homepage feature area.
