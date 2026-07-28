# Website Audit 42 — Complete Ledger Closure

Date: 2026-07-25  
Release: `2026-07-25-site-audit42-ledger-closure-multimode-final`

## Scope

This release re-opened the complete Audit 34 tiered list and the later Audit
35–41 findings. It separates four states instead of using “done” as a blanket
claim:

1. implemented and release-gated;
2. audited and already satisfied;
3. external validation requiring a native browser, assistive technology,
   physical device, live scheduled run, or real participant; and
4. held direction decisions that would change the site’s identity,
   information architecture, editorial scope, data model, or operating cost.

No security audit was performed.

## What Audit 42 fixed

- The once-weekly live-link job still checks at most 350 URLs. A deterministic
  four-week rotation now covers the complete 1,298-URL inventory instead of
  rechecking one permanent sorted prefix. Checks use bounded concurrency,
  per-host throttling, and a reusable success cache; transient cached failures
  are retried rather than replayed for a week.
- Bookworm Burrows now renders the BB and Campaign Codex relationships already
  present in its data. Curated order remains the default, with Title and Record
  ID alternatives.
- Bookwormcard now maintains complete combobox/listbox ownership,
  `aria-expanded`, stable option IDs, `aria-selected`, and
  `aria-activedescendant`. Pointer selection uses the clicked option.
- Polymythcal saved-listing and saved-search removal now offers one-action
  undo. Print mode renders every filtered result, removes work controls, and
  exposes source URLs.
- Polymythcal chips, active-filter removal, segmented controls, and section
  clears meet the site’s 44-pixel control floor.
- Reading links receive a scoped system visited colour. Persian and Arabic
  script contexts drop Latin tracking and uppercase transforms.
- Reduced-transparency preference removes backdrop filters independently from
  reduced motion.
- The PWA no longer locks installed windows to portrait.
- The shared footer provides 44-pixel rows and `aria-current="page"`.
- Five QR routes now keep their Bookwormcard QR in static navigation or header
  flow instead of colliding with fixed top-right controls.
- The CV verifier again protects all 128 historical whitespace states. It also
  exhaustively checks all 2,048 current modular selection states and prevents
  the CV builder from replacing the strong gate.
- The component ledger no longer claims that completed Polymythcal maintenance
  is “held” or that sitewide translation and native accessibility sign-off are
  already complete.
- A deploy-surface inventory records language, direction, alternates, and
  translation state for every navigable public HTML route. Search-engine
  ownership token files are deployment artifacts, not routes. The same
  inventory records structural metadata for every shipped PDF path.
- Audit 41 is frozen across 71 evidence files by SHA-256.
- The seven inherited browser suites now execute against the Audit 42 source
  into isolated Audit 42 evidence: 882 inherited current-release Chromium
  assertions and 52 screenshots. Freezing Audit 41 is no longer used as a
  substitute for current interaction, entry-page, WCAG, route-resilience,
  failure-stress, runtime-continuity, and depth verification.
- A tolerant 14-image visual baseline guards seven representative route
  families at ultrawide and foldable-landscape sizes. It tolerates small
  rasterization noise while rejecting broad palette, layout, density, or
  contiguous-region drift.
- A scoped design-token inventory records 5,621 authored declarations, 94
  custom-property names, and 1,358 component contexts across ten shared
  stylesheets and seven representative pages. Its hotspot counts are
  maintenance evidence, not a mandate for global visual unification.
- Current CI and packaging now invoke Audit 42 rather than attempting to
  execute historical Audit 41 release commands. The ZIP step refuses stale,
  failing, or release-mismatched Audit 42 browser evidence.
- A fresh multimode Chromium pass covers ultrawide, foldable-like, text
  spacing, reduced transparency, print, preferences, keyboard collisions,
  no-JavaScript extraction, injected extension interference, grayscale state,
  visible H1 counts, long tasks, low-end CPU behavior, long-session
  theme/filter/history memory trends, QR collisions, and standalone-window
  rotation.

## Tier 0 and Tier 1 closure

| Audit family | State |
|---|---|
| Build, clean install, canonical reproducibility, public/source parity, route and data floors, manifests, feeds, ICS, ZIP completeness, Netlify publish directory, release stamps, stale generated files, case-sensitive paths, redirects, CI/local parity, workflow ordering, optional-stage containment, migration compatibility, and anti-backtracking | Implemented and release-gated |
| Fresh browser verification, console failures, rejected promises, local request failures, deep links, route recovery, storage failure, history failure, font failure, slow/interrupted data, duplicate initialization, and inherited browser coverage | Implemented and release-gated in Chromium; all seven inherited suites rerun against Audit 42 |
| Polymythcal scraper fixtures, protest recall, source taxonomy, candidate lifecycle, merge behavior, stale-source handling, cost boundaries, deterministic-before-agent ordering, sharding, and publication integrity | Implemented and release-gated; successful live scheduled run remains external operational evidence |
| Accessibility foundations, landmarks, names, labels, focus, keyboard, zoom, reflow, reduced motion, forced colours, target geometry, dynamic status, dialogs, grids, feeds, and forms | Implemented and release-gated for the automated and Chromium surface |
| Smoothness, motion lifecycle, background-tab suspension, layout stability, responsive operation, control continuity, navigation, interface resilience, and anti-jerk behavior | Implemented and release-gated |
| Design system, visual identity, hierarchy, type floors, colour, layout, spacing, motion restraint, information architecture, anti-yap, performance, and project-level refinement | Audited and maintained without a global redesign; tolerant visual and scoped token inventories are regression-gated |
| Polymythcal, Teacher Resources, BB, Bookwormcard, homepage, CV, forms, Leizu, AA, AITR, Campaign Codex, Methodology, and representative generated event routes | Covered by project gates plus fresh route-family evidence |
| Native Firefox, Safari/WebKit, VoiceOver, and NVDA | External validation |
| Real-user task observation and preference interviews | External validation |

## Tier 2 closure

| Audit item | State |
|---|---|
| Mandala consistency and accepted carousel/rail direction | Satisfied and regression-gated |
| Symbol vocabulary and icon family | Inventoried and regression-gated in `data/audit42-symbol-vocabulary-inventory.json`; current project-local vocabulary is preserved and no global icon-system redesign was imposed |
| Route-by-route editorial density | Inventoried and regression-gated for BB, Polymyth, Leizu, and Teacher Resources descriptions; long-copy outliers are disclosed without automatic substantive rewriting |
| Illustration language, project-thumbnail originality, competitor visual similarity | Direction decision; a new visual system requires approval |
| Expanded and empty states | Implemented on data-driven surfaces and checked in route gates |
| Letter spacing, French typography, Persian typography, Arabic typography policy, print typography | Maintenance rules and browser print/text-spacing coverage added; full Arabic localization is direction pending |
| Visited links and greyscale comprehension | Implemented with scoped `VisitedText` and grayscale state proxy |
| Chip spacing and footer spacing | Implemented |
| Wide desktop | Implemented at 2,560 pixels; ultrawide opportunity remains monitored |
| Tooltip keyboard, help text, listbox focus | Bookwormcard repaired; title-only project controls remain included in the accessible-name inventory |
| Undo opportunity | Implemented for Polymythcal saved items and searches; BB local deletion remains recoverable through its local record workflow |
| Multi-select | Satisfied |
| Footer navigation | `aria-current` and control geometry implemented; a global static-navigation rewrite remains a direction decision |
| Metadata verbosity and help placement | Satisfied by structural and anti-yap gates |
| Feed, grid, carousel, and memory burden | Satisfied with long-session and long-task budgets; three-route CDP-GC heap, DOM-node, document, and listener trend instrumentation is release-gated |
| Reader mode | No-JavaScript semantic extraction proxy complete; native browser Reader Mode remains external |
| Teacher packet, CV print, social preview, Open Graph, share titles/descriptions, canonical URLs, PDF parity, page breaks, event print, calendar print, copy link, RSS, ICS, monochrome print, and print ink | Existing project contracts preserved; Polymythcal complete-print and URL exposure added |
| Polymythcal related/similar/nearby | Related listings preserved. Current similarity is type/city heuristic; true geospatial distance requires a coordinate data-model decision |
| Teacher expand all and collapse all | Satisfied |
| BB sorting and BB/Teacher/Meaninglib crosslinks | BB sorting and existing BB/CC relationships implemented. New Teacher/Meaninglib editorial links remain content-direction work |

## Tier 3 closure

| Audit item | State |
|---|---|
| Modular scale | Audited. Semantic route identities and existing type floors preserved; a single global modular scale would flatten them |
| Word spacing | Fresh WCAG 1.4.12 injection gate added |
| Optical alignment and baseline alignment | Optical sizing is global; representative fallback-font geometry remains covered by route screenshots |
| Sparse-page cohesion | Full 128-state CV contract restored and successor 2,048-state contract added |
| Container-query opportunity | Audited; no current defect requires migration from working viewport fallbacks |
| Ultrawide | Fresh 2,560-pixel route-family gate added |
| Tooltip necessity and copy | Dead or title-only behavior inventoried; Bookwormcard’s active listbox path repaired |
| Site map | Satisfied by tree, graph, local D3, keyboard, fallback, and route-classification gates |
| Switch control | Existing pressed, checkbox, and radio semantics retained where they are more accurate than `role="switch"` |
| Voice control | Automated name/label behavior covered; native voice products remain external |
| Keyboard-shortcut collision | Fresh editable-field, modifier, arrow, slash, and Escape matrix added |
| Reduced transparency | Implemented and computed-style gated |
| Accessible print | Polymythcal list/detail contracts added; Teacher and CV contracts preserved |
| Background tab | Satisfied by animation lifecycle and visibility gates |
| Battery use | Idle, long-task, 4× CPU-throttled perceived-performance, and bounded long-session heap behavior gated; physical thermal/battery testing remains external |
| Browser-extension interference | Injected interference proxy added; real extensions remain external |
| QR code | Five-route placement, destination, intrinsic-size, accessibility, and collision gates added |
| Preference test | Cross-route persistence and blocked-storage matrix added |

## Tier 4 closure

| Audit item | State |
|---|---|
| Visual surprise | Audited; new surprise language would change visual direction |
| Monospace restraint | Audited and preserved by project typography contracts |
| Foldable screen | Foldable-like viewport and rotation gates added; hinge hardware remains external |
| View-transition opportunity | Audited and held as a direction/performance feature |
| Standalone window | Manifest display, scope, start URL, and rotation contract added |
| Whole-site print | Representative print matrix plus project-specific print contracts complete; printing every route into one document is neither useful nor a current product requirement |

## Direction decisions still held

1. new illustration and thumbnail system;
2. competitor-led or global visual redesign;
3. global navigation rewrite;
4. full-site translation and target-language scope;
5. true geospatial nearby ranking;
6. site-owned reader mode;
7. list virtualization;
8. a new bundler;
9. OCR and browser-driven harvesting;
10. recurring-rule expansion and mixed-calendar automatic publication;
11. scraper-frequency or credit-budget increases;
12. View Transitions;
13. a new global “visual surprise” system;
14. persisted parsed-response caching driven by HTTP ETag/Last-Modified
    validators;
15. a true BB session runner;
16. AA result virtualization;
17. re-enabling About creative mode;
18. publishing announcements without a real date as candidate-only records;
19. revising event-identity and reschedule heuristics.

## External validation still required

1. native Firefox;
2. native Safari/WebKit;
3. macOS VoiceOver;
4. Windows NVDA;
5. native voice control;
6. real Dark Reader, password-manager, translation, and blocker extensions;
7. physical foldable hinge and safe-area behavior;
8. low-end device battery and thermal tracing;
9. real-user task observation and preference interviews;
10. manual PDF reading order;
11. a successful live scheduled scraper run against current public sources.

These are disclosed limits. They are not represented as passing local tests.

## Verified release result

- 142 of 142 portable build, data, UI, accessibility, scraper, content,
  packaging-contract, and anti-backtracking gates passed.
- 882 of 882 inherited current-release Chromium assertions passed across seven
  suites, with 52 screenshots.
- 367 of 367 fresh Audit 42 multimode Chromium assertions passed, with 22
  screenshots.
- Combined current-release browser evidence is 1,249 of 1,249 assertions and
  74 screenshots.
- 2,474 navigable public HTML routes and 34 shipped PDF paths were inventoried.
- The 838-event, 32-type, 422-source Polymythcal corpus and all 644 Teacher
  Resources were preserved.
- The deployer packager reruns the canonical build, all 142 portable gates,
  both current browser-evidence verifiers, public/source parity, and
  deterministic archive verification before it writes a ZIP.

## Standards used

- WCAG 2.2, including text spacing, reflow, keyboard shortcuts, target size,
  labels, status messages, and conformance limits:
  https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices combobox pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- Media Queries Level 5 reduced-transparency preference:
  https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-transparency
- Web Application Manifest display and orientation members:
  https://www.w3.org/TR/appmanifest/
- CSS Paged Media:
  https://www.w3.org/TR/css-page-3/
- Long Tasks API:
  https://w3c.github.io/longtasks/

## Release acceptance

The release is accepted only when:

- the Audit 41 frozen manifest is byte-identical;
- the canonical build and public/source parity pass;
- the sitewide language/PDF inventory is current;
- all legacy and Audit 42 portable gates pass;
- all seven inherited browser suites are current, SHA-bound, and passing
  against Audit 42;
- the fresh Audit 42 multimode Chromium report has zero failures;
- the tolerant visual baseline and all four Audit 42 maintenance inventories
  are current;
- current project counts remain at or above their frozen floors;
- the packaged ZIP reopens, matches its SHA-256 manifest, and contains the
  complete deployer-compatible site.
