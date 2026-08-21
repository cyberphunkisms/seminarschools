# Seminar Schools front-facing, geometry and overlap hardening

Date: 9 August 2026  
Package identity: `coherence-front-facing-geometry-overlap-hardened-2026-08-09`  
Deployment: none

## Outcome

This release makes the public website read like a website for visitors, restores the scroll-responsive geometric field across the complete page estate, and turns both rules into release blockers for future pages. It also separates the Polymyth Coherence assessment instrument from case answers and keeps the CV evidence inside the relevant résumé sections rather than in a detached evidence dump.

## Baseline and old-site forensics

The working baseline was the complete 8 August handoff `ss-site-front-facing-final-audited-cv-integrated-editable-masters-complete-2026-08-08.zip` (SHA-256 `3339860484f491edc04fd0b860ab0aa7196808b95b6ec557b67c1e85d0f73a52`; 10,984 ZIP members; CRC clean).

The supplied June archive `seminarschools-cv-design-fixes-20260621(1).zip` (SHA-256 `13caab4522fb5699b1753c92136ad203a600a1c2ee06a3e458ee9cf2a6c9a0f0`; 332 members; CRC clean) was used only to identify the lost geometry behaviour. No June page, copy, data file, or deployment surface was merged into this release.

The forensic result was precise: the older `/main/` page was the ancestor of the current `/about/` geometry. The code had not vanished completely; later calm-mode rules stopped the cameras before they updated and a universal mask suppressed the shared layer. The repaired system keeps calm mode while allowing the fixed geometry and page cameras to update from scroll position.

## Polymyth Coherence

The public Coherence entry point now provides three answer-free artifacts:

- a model-neutral Markdown application protocol;
- the complete blank V5.1.2 Excel assessment instrument;
- an operative Draft 2020-12 JSON Schema for a blank case handoff.

The instrument owns the criteria, protocol, formulas, QA definitions, sources and blank ledgers. A separate private workbook in `EDITABLE_MASTERS/07_POLYMYTH_COHERENCE/` owns worked case evidence and results. It is deliberately blank in this release. Prior case files are excluded from the neutral AI handoff and cannot serve as an answer key.

The final workbook SHA-256 is `0624c76e0ae1351dcfe6a9d2cabf6e4e581820b63a0fc40e5ad755bbd1d93550`. It retains 35 sheets, 85,768 formulas and formula signature `94a9cd749e53b71c056c2a41c68d27cdb9a344eaf9bb3865b37a27f2b58684be`. It contains P0–P23, forty mandatory QA checks, twenty-two synthetic regressions and zero completed cases. A final OOXML repair extended the EXTERNAL validation and conditional formatting through E-036 and the SOURCES validation through S-286 without changing any formula or cached result.

## Permanent front-facing rule

Every public HTML page must carry `data-front-facing="general-audience"` and provide a visible page heading, an intelligible introduction and a usable action. Reader-facing copy may not expose build state, raw classification codes, generator vocabulary, unexplained internal shorthand or AI/operator self-talk. Deliberate manuals and machine-facing artifacts are narrowly classified rather than used as an exemption for ordinary pages.

The static boundary gate currently covers 3,750 source HTML files, 3,749 public HTML files, 7,408 reader-facing documents, 89 deliberate manual/tool documents, 43 first-party browser JavaScript files and 23 generator/data sources. It also checks 36 summary-only locale routes, all 346 Polymyth Commons records, 3,380 event pages and 32 methodology sections. The same gate scans generators so a later rebuild cannot quietly restore rejected public wording.

## Permanent geometry rule

Every page except the exact 54-byte Google verification token receives one ordered `20260808-perceptible-scroll-geometry` contract. The shared field is fixed, pointer-safe, unmasked and driven only by scroll and resize. Reduced motion keeps it visible but still.

Route intensity is deliberately bounded:

- About: 0.090;
- Saul and Leizu: 0.095;
- quiet resources and Coherence: 0.100;
- standard pages: 0.110;
- expressive project and archive pages: 0.130.

About retains two independent cameras and Saul retains its professional CV camera. Both run in calm mode, use three distinct scroll positions, and become static under reduced motion. A legacy About preference that once muted hidden controls is now neutralized. On the CV, the reduced-motion watermark uses a fixed composition so it remains visible around the résumé card without moving.

Static verification classifies 3,749 source pages and 3,748 public pages, including 872 redirect fallbacks, 693 static-search pages and 2,511 noindex pages. Ninety-one distinct geometry contracts execute in the static VM. The real-browser gate passed 123 desktop, phone and reduced-motion renders covering 98 distinct surface signatures and all 45 route types, including real redirect URLs and the About/CV bespoke cameras.

## Overlap, reflow and reader-entry audit

The browser audit classifies all 3,749 deployed HTML routes into exactly 36 page families and renders 50 representative routes. Each route runs at seven viewport widths from 320 to 1,801 pixels, at normal and 145% text size, in light/dark and normal/reduced-motion modes. The audit checks seven scroll positions, visible fixed/sticky chrome, horizontal overflow, pathological narrow text columns, fragment destinations, every programmatically focusable control and real keyboard Tab movement.

Final rendered result: 50 fixtures × 14 viewport/mode scenarios, 700 page scenarios, 700 reader-entry checks, 4,900 scroll probes, 1,291 named anchors, 26,461 focus targets and 2,082 real keyboard Tab steps; zero failures.

The gate itself was hardened during the audit. Headless Chromium may suppress `requestAnimationFrame`; every visual settle now has a bounded timer fallback followed by synchronous layout reads. Redirect fallback pages are frozen only inside the verifier so their actual fallback UI is tested at the original route. Pages are reused, fixed/sticky candidate identities are cached without caching visibility or geometry, and the largest fixtures run first. These changes preserve the full matrix while preventing a hidden browser wait from masquerading as a clean or hung audit.

## CV and public copy

The rejected “Selected evidence / How the work was done” block is absent from the data, generator, navigation, CSS, JavaScript, print view and rendered page. Its facts now appear under Campus Crops, teaching, student leadership, McMUN, BUMI, refugee support and the other work that supports them. Public CV downloads use a restrained employer-facing hierarchy; localized pages retain one stable person identity with route-specific page metadata.

The site-wide copy audit also rewrote visitor-facing Polymyth Commons labels, removed stale build stamps and internal database terms, corrected current brand labels, clarified summary-only Leizu translations, and kept long research or facilitator manuals only where that depth is the product.

## Release verification and identity

The canonical build enforces source/public parity, the static front-facing boundary, Coherence workbook/schema checks, visible and meaningful geometry, localization, metadata, asset budgets and build hygiene. `verify:all:built` adds build idempotence plus the two real-browser release blockers.

The inherited runtime identity remains the July 28 Audit 53 site identity because this handoff does not migrate the production release lineage. The outer package identity above describes this new verified source/public/editable-masters handoff. The packaging wrapper rebuilds, runs the complete release suite, validates all editable-master hashes, regenerates inner and outer content manifests, and then writes a CRC-tested archive plus SHA-256 sidecar.

No website, repository, hosting service or external account was changed while preparing this release.
