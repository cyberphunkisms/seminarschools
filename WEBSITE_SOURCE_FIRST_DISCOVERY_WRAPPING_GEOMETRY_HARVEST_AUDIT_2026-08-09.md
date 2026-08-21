# Seminar Schools source-first discovery, wrapping, geometry and harvest audit

Date: 9 August 2026  
Package identity: `source-first-discovery-wrapping-geometry-harvest-hardened-2026-08-09`  
Deployment: none

## Outcome

This release makes the original organizer, publisher or project website the primary destination in Polymythcal, Polymyth Commons and Teacher Resources. It also simplifies discovery, prevents ordinary words from breaking into fragments, preserves visible scroll-responsive geometry across the complete page estate, and makes harvest and external-link failures more honest and actionable. Nothing was deployed.

## Polymythcal: direct source access

- The calendar now opens as a compact, list-first search instead of an intent-card and preset maze.
- Redundant goal cards, repeated preset chips, duplicate result actions, duplicate mobile controls and the 90-day/365-day ranges were removed.
- Each result gives the organizer or original source the primary, visually dominant action and displays its hostname. Internal details and saving are secondary.
- English and French event pages use the same source-first hierarchy.
- The canonical inventory remains 833 records: 238 confirmed and 595 visibly unconfirmed.
- Qualification gaps remain visible rather than being converted into false certainty: 505 records lack an exact time, 297 lack an exact location, 86 lack current-edition confirmation and one lacks official-source confirmation.
- The public tree contains 857 ICS files: 833 event files plus focused and compatibility calendars.
- The focused Polymythcal browser matrix passed all 84 scenarios.

## Polymyth Commons and Teacher Resources

- Polymyth Commons retains 346 records and 346 stable research pages.
- All 120 records with a known original destination now use that external destination for the title and primary action. The internal page is labelled `Research details`.
- Teacher Resources retains 644 resources, 25 collections and seven plain-language subject areas: 676 subject, collection and resource pages.
- Resource titles and primary actions open the original publisher, archive or organization. Internal notes remain secondary.
- The focused Commons/Teacher browser audit passed 112/112 scenarios, 784 scroll probes, 3,392 focus-target checks and 352 real Tab steps.
- The source-first Teacher index is deliberately measured at 702,685 HTML bytes and remains below its narrow 730,000-byte ceiling; its route HTML/CSS/JS compresses to 82,913 bytes.

## Harvest coverage and the failed workflow screenshot

- The screenshot showed the scheduled external-link audit, not the Polymythcal scraper.
- The Node.js 20 message was a deprecation warning; it was not the cause of exit code 1.
- The old audit treated timeouts, access blocks, rate limits, server errors and proven dead links as the same failure.
- The current audit retries an unsuccessful HEAD request with GET. Only confirmed HTTP 404 or 410 results fail the job. Access blocks, timeouts, 429 responses and 5xx responses produce explicit warnings with their source rows.
- GitHub cache actions now use v5/Node 24.
- The source registry contains 422 rows: 407 active and 15 disabled.
- The weekly deterministic seminar selection is 95 sources: 41 priority and 54 rotating. A further 159 are deferred, while 133 require agent or browser work: 75 `todo` and 58 JavaScript-only sources.
- The paid-agent assignment starts at 91 sources before successful deterministic sources are removed.
- The retained 26 July live-endpoint sample covered 200 source bindings: 94 HTTP-usable, 12 browser-required and 94 unreachable or unsupported.
- That endpoint sample is historical evidence only. Current configuration differs in `scripts/sources.json`, `.github/workflows/scrape-seminars.yml` and `.github/workflows/scrape-polymythcal-protests.yml`. The explicit current-evidence verifier correctly refuses a current live claim until the remote audit is rerun.
- The exact number of missed external events is not knowable from the static inventory. The defensible evidence is the source-selection, endpoint-status and qualification-gap accounting above; the machine report records the exact missed-event count as `null`, not zero.
- Official destination repairs were made for the Power Plant, Soundstreams, Fields Institute, Concordia FOFA Gallery, Harvard Safra Center, Folger Shakespeare Library and Cornwall.
- Fifty-four focused harvest, sharding, source-health and workflow tests pass.
- The exact URL that failed the pictured historical run cannot be recovered from this package because that run's live JSON artifact was not retained here.

## Whole-site word integrity and reflow

- Normal reader-facing Latin-script text wraps between words. Mid-word breaking requires an explicit technical URL, slug or code opt-in.
- Script detection remains language-aware, so the Latin rule is not imposed incorrectly on Han text.
- Every source and public HTML route is assigned to exactly one audited page family before browser sampling.
- The permanent front-facing boundary covers 3,750 source HTML files, 3,749 public HTML files and 7,408 reader-facing documents.
- The full browser gate passed 50 fixtures across 14 viewport/mode scenarios: 700 page scenarios, 700 reader-entry checks, 4,900 scroll probes, 1,299 named anchors, 22,757 focus targets and 2,090 real keyboard Tab steps.
- All 50 high-risk fixtures also passed at 320 pixels and 145% text.
- The audit covers overlap, horizontal overflow, narrow columns, fragment destinations, sticky/fixed controls, word integrity and keyboard navigation.

## Scroll geometry

- Every renderable page except the exact 54-byte Google verification token carries one fixed, pointer-safe, unmasked `20260808-perceptible-scroll-geometry` contract.
- Reduced motion keeps the geometry visible but still.
- Static verification covers 3,749 source pages and 3,748 public pages. It executes 93 surface contracts and also checks 872 redirect fallbacks, 693 static-search pages, 1,690 event pages, 24 CV pages and 2,511 noindex pages.
- Real-browser verification passed 125 desktop, phone and reduced-motion renders, 99 distinct surface signatures and all 45 route types.
- About retains its bespoke dual cameras. The CV retains a subtler professional treatment. Both were tested at top, middle and bottom positions on desktop and phone.

## Preserved Coherence and CV work

- The blank Polymyth Coherence V5.1.2 instrument remains model-neutral: 35 sheets, 85,768 formulas, 24 protocol entries, 40 mandatory QA checks, 22 synthetic regressions and zero completed cases.
- Its final SHA-256 is `0624c76e0ae1351dcfe6a9d2cabf6e4e581820b63a0fc40e5ad755bbd1d93550`; its formula signature is `94a9cd749e53b71c056c2a41c68d27cdb9a344eaf9bb3865b37a27f2b58684be`.
- The employer-facing CV keeps volunteer leadership, student government, club, Campus Crops, McMUN, BUMI and refugee-support evidence integrated under the work that supports it. The rejected detached evidence-card panel remains absent.
- All ten listed editable masters remain private and hash-verified.

## Build and release verification

- Canonical source/public parity covers 4,896 allowlisted files.
- The generated public asset report contains 4,897 files totaling 132,452,863 bytes.
- The canonical build is idempotent across 10,980 durable files.
- Frozen historical audits remain byte-identical. Current successor gates enforce the changed source-first and source-health behavior.
- `verify:all:built` passed all 164/164 checks.
- The complete packaging wrapper rebuilds the site, repeats the full suite, validates editable-master hashes and writes a CRC-tested ZIP plus SHA-256 sidecar.
- No website, repository, hosting service or external account was changed.

## External limitations

- No scheduled remote harvest or current live endpoint crawl was run locally. The next remote run will produce source-level parsed, rejected, deduplicated and published counts under the new accounting contract.
- Access blocks, browser-only sources and upstream outages remain external conditions; they are now reported distinctly rather than being called dead links or zero-event sources.
- No deployment was performed.
