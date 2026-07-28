# Website Audit 47 — Technical Efficiency and Continuity

Date: July 26, 2026  
Release: `2026-07-26-site-audit47-technical-efficiency-continuity-final`  
Status: PASS, subject only to the explicitly external validation listed below

## Outcome

The complete Audit 42 through Audit 46 ledger was rechecked before this pass. Every authorized item that can be executed in this workspace remains implemented. Audit 47 then performed a new technical-efficiency audit across calendar data identity, recurrence handling, feed classification, browser caching, large-page rendering, interactive search, localized landmark structure, repository traversal, dependency installation, build determinism, and verification idempotence.

This was an implementation audit, not a planning exercise. Every confirmed local issue below was fixed, regenerated, and placed behind a permanent regression gate. Audit 43 remains frozen and byte-locked. English remains the translation source of truth. Organizer-authored text remains verbatim and source-language bounded. High-stakes Leizu translations remain noindex pending bilingual review. BB remains teacher-led and has no site-owned session runner. All scheduled content and link workflows remain exactly once weekly.

No security audit was performed.

## Implemented findings

| Priority | Finding | Implemented result | Permanent check |
|---|---|---|---|
| P1 | The calendar contained five exact or structural duplicates across Nuit Blanche and Toronto Caribbean Carnival records. | Consolidated the historical 838-record raw snapshot to 833 canonical records. Retired two extra Nuit Blanche records, one duplicate Carnival parent, one duplicate Grand Parade, and one duplicate Official Launch. | Audit 47 identity map, canonical count, lifecycle parity, parent-target, alias, route, and ICS checks. |
| P1 | Removing duplicate IDs could have broken saved links and calendar subscriptions. | Preserved 12 explicit legacy identifiers. The English generator now emits 857 aliases in total; French explicit aliases are noindex and canonicalize to the retained French routes. Every explicit legacy ICS file is byte-identical to its canonical ICS file. | Audit 47 verifies every explicit alias and byte-compares every legacy ICS file. |
| P1 | Open-ended recurrence expansion could materialize an unbounded rule before slicing. | Bounds recurrence iteration with `itertools.islice` before materialization and caps the safety horizon at 366 occurrences. | Eight Audit 47 lifecycle tests plus the existing 15-test lifecycle suite. Python documents `islice` as an iterator slice that does not require constructing the entire source sequence: [itertools.islice](https://docs.python.org/3/library/itertools.html#itertools.islice). |
| P1 | Recurrence normalization could shift Toronto wall time across daylight-saving transitions. | Normalizes into the event’s IANA timezone before expansion. Spring-forward and fall-back fixtures preserve local wall time while offsets change correctly. | Audit 47 spring and fall DST fixtures. Python’s `zoneinfo` is designed to handle daylight-saving transitions with IANA data: [zoneinfo](https://docs.python.org/3/library/zoneinfo.html). |
| P1 | French-feed membership inferred language from Montréal text, creating false French classifications. | French feeds now use declared `source_language` and `source_languages` only. The current French feed contains 37 accurately declared records instead of 63 mixed records. | Audit 47 language-metadata fixtures and translation gate. |
| P1 | Arts matching used an unbounded `art` substring, matching words such as department, party, start, and Bartleman. | Added bounded arts vocabulary to the Python feed path and JavaScript browser path. | Eight topic fixtures: five negatives and three positives. |
| P1 | Calendar fetches used `cache: "no-cache"`, forcing revalidation on each cross-route visit despite a five-minute server policy. | Uses the browser’s default cache mode, preserving the audited five-minute HTTP freshness window. MDN specifies that the default mode can reuse a fresh cached response, while `no-cache` conditionally revalidates a match: [Request.cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache). | Critical, UX-efficiency, build-efficiency, and Audit 47 gates reject `no-cache`. |
| P2 | The calendar rewrote its large last-good Cache Storage response even when `_generated_at` was unchanged. | Stores an `X-Polymythcal-Version` marker and skips a redundant write when the cached and incoming versions match. | Audit 47 runtime contract check. |
| P1 | Sixteen generated Methodology archives lacked the heavy-page marker, so the existing `content-visibility: auto` rule never activated for 1,139 rows. | Every generated archive now emits `data-page-weight="heavy"`, activating containment. `content-visibility: auto` allows the browser to skip off-screen rendering work: [MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility). | Search-surface and Audit 47 archive checks. |
| P1 | Clicking a Methodology tag generated a `tg:` query that the renderer never parsed, so tag controls returned zero results. | Added exact comma-separated tag parsing; partial and substring tags remain rejected. | Functional tag-click and exact-tag fixtures in the search-surface gate. |
| P2 | Methodology rebuilt title, section, count, and normalized search data on repeated input. | Added cached title, section-count, and normalized-entry indexes with explicit invalidation after load, edit, add, delete, and import; added a 120 ms trailing debounce. | Search-surface runtime contract. |
| P2 | Campaigncodex synchronously lowercased and filtered a 296-record seed and rebuilt up to 157 records on every keystroke. | Added a `WeakMap` normalized-text cache and 120 ms trailing debounce while preserving immediate tab and hash navigation. | Search-surface source/public and runtime checks. |
| P1 | Thirty-six secondary localized Leizu routes placed the localized summary outside the true main landmark; cloud used a header-only `role=main`. | Moved each summary inside the true main, retargeted skip links, wrapped the cloud application in the main landmark, demoted inherited English headings, and retained exactly one H1 with an explicit English boundary. W3C identifies a skip link to the main content as a direct bypass mechanism: [WCAG Technique G1](https://www.w3.org/WAI/WCAG22/Techniques/general/G1). | 18,555 translation assertions plus direct landmark checks. |
| P1 | The public builder could copy nested virtual environments into production. | Reused the shared repository-walk policy and added fixture coverage for generated dependency directories. | Repository-walk gate now covers 25 scanners and both packagers. |
| P2 | Predeploy performed `npm ci` and then a second dependency resolution for Playwright. | Pinned Playwright 1.61.1 in package and lock, removed the second npm install, and retained browser-binary installation after portable gates pass. | Predeploy and Audit 47 require exactly one npm dependency installation. |
| P1 | Several canonical generators hard-coded a 2034 output timestamp, allowing an older reconciled artifact to replace newly generated bytes. | Browser payload, manifest, scrape-summary, language-model, translation-report, and related output paths now honor deterministic environment-owned output stamps. Unchanged scrape/report content is not rewritten. | Build-efficiency, report-idempotence, and Audit 47 output-stamp checks. |
| P1 | A transient `.rsync-tmp` directory could appear during a recursive scan and vanish before read, aborting the build. | The shared walk policy excludes transient sync directories; the shared-asset normalizer also tolerates a disappearing path between enumeration and read. Packagers use the same exclusion. | Repository-walk and Audit 47 transient-sync checks. |
| P2 | Audit 45, Audit 46, and release-gate evidence could be rewritten when content had not changed. | All three report paths compare rendered bytes before writing; deterministic report timestamps remain supported. | Repeated-run mtime checks and Audit 47 static contract. |
| P1 | The canonical full runner did not distinguish gates already covered by `npm run build` from gates omitted only in reuse mode. | Full mode avoids true duplicate work. Reuse mode restores every gate not executed by its preparation path. Audit 47 JavaScript and Python regressions are shipping blockers. | Release-gate contract checks execution mode and preparation coverage. |
| P1 | The canonical event generator’s `--check` mode treated a downstream-owned site-wide stylesheet token as route drift, creating ten false stale-page failures after a valid production build. | The comparison now normalizes only the postprocessor-owned token while continuing to compare route content, redirects, canonicals, metadata, and all other generated bytes. The standalone check is an explicit current-release blocker. | `build-polymythcal-audit13.py --check` passes for all 833 canonical pages, 857 aliases, and ICS files inside the full runner. |
| P1 | Two portable verifiers encoded superseded implementation details: a redundant second Playwright package install and the older two-argument rollover cleanup API. | The browser contract now requires one lock-pinned npm install plus deferred Chromium binaries. The route cleanup API preserves the historical call contract while retaining current explicit legacy-ICS cleanup. | Browser-contract, Audit 41 rollover simulation, current Audit 47, and frozen Audit 41 gates pass together. |
| P1 | Typography and keyboard gates hard-coded the Audit 45 cache token and therefore misreported valid Audit 47 assets as missing or stale. | Both gates now derive the owned tokens from the release manifest and the global asset owner, require exactly one reference, and reject mismatched or unowned tokens. Typography evidence is now also idempotent. | 3,389 deploy pages pass typography/zoom checks; 2,517 interactive pages pass keyboard-helper checks. |

## Current release metrics

- 833 canonical calendar records, 32 event types, 422 sources, and 595 qualified unconfirmed records.
- 5 duplicate records retired with 12 explicit legacy identifiers preserved.
- 857 generated English event aliases and 12 explicit French event aliases.
- 833 English and 833 French canonical event detail routes.
- 37 declared French-language feed records, with no city-name language inference.
- 854,858-byte browser payload and 87,320-byte gzip projection, 31.21% below the canonical gzip payload.
- 1,139 Methodology archive rows across 16 contained section pages.
- 3,390 source HTML files and 3,390 public HTML files in Audit 47’s allowlisted surface.
- 18,555 of 18,555 static translation assertions passed.
- One locked npm dependency installation in predeploy.
- Exactly once-weekly cadence preserved for seminar, festival, protest, and external-link workflows.

## Validation

- Canonical production build: passed.
- Source/public parity: 4,476 allowlisted files passed byte-identical parity.
- Audit 47 JavaScript topic/classification fixtures: passed.
- Audit 47 Python lifecycle/identity fixtures: 8 of 8 passed.
- Existing lifecycle suite: 15 of 15 passed.
- Frozen Audit 43: unchanged.
- Full canonical release runner: 146 of 146 checks passed after a fresh production build.
- Full reuse-mode portable release runner: 151 of 151 checks passed against the verified canonical build.
- Inherited Audit 45 Chromium evidence: 109 of 109 verifier assertions, 127 recorded checks, and 11 hashed screenshots passed continuity verification.
- Deterministic package creation and archive round-trip: passed for 10,020 selected deployer files plus the embedded integrity manifest; every archived member passed CRC, byte-count, and SHA-256 verification before the ZIP/checksum pair was atomically published.

## External validation still required

The container cannot truthfully complete the following, so they are not relabelled as passed:

1. Firefox native-engine validation.
2. Safari/WebKit native-engine validation.
3. VoiceOver validation.
4. NVDA validation.
5. Physical-device and real-user validation.
6. Google Calendar, Apple Calendar, and Outlook import validation for current and legacy ICS links.
7. A live scheduled harvest with current source-endpoint verification.

The inherited Audit 45 Chromium matrix remains valid historical evidence. It is not presented as a fresh Audit 47 browser run.
