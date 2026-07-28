# Website Audit 34 — Impeccable UI and Efficiency

Date: 2026-07-23  
Release: `2026-07-23-site-audit34-impeccable-ui-efficiency-final`  
Asset stamp: `20260723-audit34`

## Outcome

The highest-priority non-security problems were fixed without changing the
website's direction. This pass concentrated on interaction stability,
accessibility, visual consistency, concise feedback, harvest efficiency,
recoverability, build integrity, and anti-backtracking.

No direction-level decision was implemented. Audit 33's report, ledger, and
evolution gate remain as historical evidence.

## Tier 0 — Release blockers fixed

### Anti-jerk and responsive stability

- Prevented late Polymythcal drawer opening from shifting the desktop layout.
- Added mobile prepaint state so drawers start closed before first paint.
- Reserved safe mobile clearance for the global theme control and removed
  control overlap.
- Added stable viewport and overflow handling, safe-area-aware fixed controls,
  bounded short-screen dialogs, and non-layout-shifting focus rings.
- Removed reduced-motion scroll snapping and a body `will-change` condition
  that could break fixed controls on About.
- Confirmed final Polymythcal CLS of `0` desktop, `0.000313` at 390px, and
  below `0.0005` at 320px. Theme-control/mobile-bar overlap is `0px²`.

### Interaction recovery and state integrity

- Polymythcal now validates fetched payloads, exposes retry, and falls back to
  its compact feed when the main payload cannot load.
- Loading, empty, and error states now update busy/disabled state and live
  announcements instead of leaving a silent or apparently frozen screen.
- URL state restores on browser back/forward navigation; initial responsive
  state is hydrated before interaction.
- Teacher Resources now validates URL/saved state, restores back/forward
  navigation, flushes pending input before copy/print actions, and gives
  immediate pending-search feedback.

### Accessibility and control geometry

- Enforced a 15.5px practical text floor and a 16px iOS input floor.
- Stabilized the text-size controls and kept the visible control group near
  140px wide across states.
- Enforced 44px interactive targets, 3px focus indication, safe focus
  clearance, a working skip link, visible-search targeting, and real `?` help
  focus.
- Preserved keyboard, reduced-motion, type-floor, reset, slash-search, help,
  and skip-link behavior.

### Workflow-credit efficiency

- Preserved the held four-hour, no-shard protest crawl while removing the
  duplicate protest crawl from the seminar workflow.
- Removed repeated unit and full Audit 14 runs from scheduled data jobs; those
  remain mandatory in predeployment, where code-change checks belong.
- Added exact pinned harvest dependencies with pip caching and npm caching
  where used.
- Staggered the seminar schedule away from the four-hour protest job.
- Limited diagnostic uploads to failures and seven-day retention.
- Kept fast semantic calendar validation and source-health summaries on every
  scheduled run.

### Build and package integrity

- Added a complete byte-level source-to-`public/` parity gate to the canonical
  build.
- Added one shared repository-walk policy to 23 whole-site scanners so local
  virtual environments, dependency trees, and generated caches cannot pollute
  audits.
- Updated both ZIP packagers to exclude those generated dependency
  directories while preserving nested Audit 34 browser evidence.
- Rebuilt the typography audit after removing virtual-environment pollution.
- Replaced stale Audit 21 browser-evidence destinations with release-stamped
  Audit 34 reports and a freshness gate.
- Made all three Python browser audits prefer Playwright's managed headless
  shell, while still accepting an explicitly configured/system Chromium path.
  This removes a CI/container-only full-Chrome process-socket failure.

## Tier 1 — High-value polish completed

### Polymythcal clarity

- Exact times appear only when source precision is exact.
- Freshness, checked/projected status, official confirmation, and actual source
  domains are clearer without adding paragraphs of interface copy.
- Result, focus, zero-result, and incremental-load announcements are more
  precise; the remaining-count label is calculated rather than hard-coded.
- Preserved 838 canonical/browser events, 32 event types, 422 sources, 838
  source URLs, and the 24-item render batch.

### Teacher Resources finder

- Search tolerates accents, minor typos, and adjacent transpositions.
- Facet counts are contextual; impossible zero-result choices are disabled.
- Small result sets open automatically and live announcements explain the
  result without forcing the user to inspect every collection.
- Preserved 644 resources, 25 collections, seven groups, and 678
  source/public routes.

### Site-wide visual consistency

- Tightened type floors, focus treatment, control sizing, fixed-control safe
  areas, overflow behavior, and short-screen containment across the shared
  CSS/JavaScript layers.
- Chromium sampling covered 17 route/viewport combinations across Home, About,
  BB, AA, Leizu, Polymythcal, and Teacher Resources with zero page errors and
  no user-scrollable horizontal overflow.
- Observed CLS: Home at or below `0.0083`; About, BB, and Teacher Resources at
  `0`; AA desktop `0.0623`; Leizu desktop `0.0901` and mobile `0`.

## Anti-yap result

The pass favoured short, state-specific labels and announcements over new
instructional paragraphs. Provenance and qualification detail remain attached
to individual events/resources, where they are useful. No broad editorial
rewrite or flattening of the site's distinctive project voices was performed.
At 320px, redundant inter-panel whitespace was tightened without shrinking
controls or removing copy; the results heading now begins around `896px`
instead of below `915px`.

## Anti-backtracking controls

- Audit 34 has a dedicated evolution gate for event, source, Teacher Resources,
  scheduling, workflow, dependency, predeploy, and release-manifest baselines.
- Audit 33 evidence remains unchanged and independently runnable.
- Release ID, asset stamp, and Polymythcal build manifest are aligned.
- The canonical build must regenerate and then byte-check the public mirror
  before packaging.
- Fresh WCAG, interaction-design, and entry-page browser evidence is a
  predeployment requirement rather than a copied historical artifact.

## Held decisions

These were deliberately not changed:

- Four-hour, no-shard protest coverage. Moving to weekly would reduce run
  frequency but materially reduce advance-event detection, so it requires the
  user's explicit direction.
- Global information architecture, project identities, navigation doctrine,
  and core visual voice.
- Global typeface replacement or a brand redesign.
- Canonical event/resource inclusion rules and the preserved data baselines.
- Large content rewrites that could erase project-specific tone.

## Remaining ranked audit queue

### Tier 2 — Strong follow-ups

- Firefox and real-device Safari interaction/visual regression.
- Repeatable screenshot-diff baselines for the seven representative route
  families.
- Slow-network, offline, timeout, and interrupted-navigation recovery tests.
- Long-session memory and repeated filter/theme/history stress tests.
- Native VoiceOver and NVDA task sign-off using the preserved manual protocol.
- Route-by-route editorial density audit for BB, Polymyth, Leizu, and long
  Teacher Resources descriptions.

### Tier 3 — Optional refinement

- Perceived-performance tracing under low-end mobile CPU throttling.
- Expanded print, high-contrast, forced-colours, and browser text-only modes.
- Component-level design-token inventory to reduce isolated legacy values.
- User-task observation for calendar discovery and classroom-resource finding.

## Focused verification completed

- Audit 34 evolution gate: passed.
- Harvest pipeline contract: passed.
- Predeploy automation contract: passed.
- Release-runner contract: passed.
- Repository walk/package exclusion gate: passed for 23 scanners and both
  packagers.
- Complete portable release suite: 104/104 passed.
- Fresh interaction browser audit: 94/94 passed.
- Fresh dedicated-entry browser audit: 209/209 passed across 11 routes.
- Fresh browser-assisted WCAG 2.2 audit: 42/42 passed.
- Audit 14: 28/28 passed.
- Polymythcal adapter, protest-harvest, lifecycle, sharding, and
  deterministic-before-agent unit tests: 70/70 passed.
- Occurrence-merge regression: passed.
- Modified Python, JavaScript, package JSON, and workflow YAML syntax: passed.

The authoritative canonical build, fresh browser-evidence generation, and
complete release suite passed against the same source/public state prepared
for final ZIP packaging.
