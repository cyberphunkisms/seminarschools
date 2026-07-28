# Website Audit 36 — Discovery and Interaction Resilience

Audit date: 2026-07-24  
Scope: non-security discovery coverage, source-health integrity, UI/design,
anti-yap, anti-jerk, accessibility-adjacent behavior, runtime efficiency,
build continuity, and package integrity

Release: `2026-07-24-site-audit36-discovery-resilience-final`  
Asset stamp: `20260724-audit36`  
Release timestamp: `2026-07-24T11:35:00-04:00`

## Outcome

Audit 36 continues from the exact Audit 35 artifact and fixes the highest-value
remaining failures without changing the site's direction. Polymythcal now
checks substantially more deterministic sources on its existing schedule,
cannot publish a catastrophic all-source protest failure as a successful empty
calendar, and uses gap-free rotation. Route-local fixes repair unreadable
Bookwormcard theming, mobile control collisions, disappearing Leizu controls,
AA dialog behavior, AITR no-JavaScript operation, and the graph sitemap's
third-party runtime dependency. Background work stops when it is not useful,
and failed builds or ZIP writes preserve the last good artifact.

No global redesign, global font replacement, information-architecture change,
scraper-frequency increase, paid-agent-frequency increase, content-model
rewrite, project merge, or framework-voice rewrite was implemented.

This was not a security audit. It makes no claim about vulnerabilities,
penetration resistance, secrets, permissions, abuse prevention, dependency
CVEs, or threat posture.

## Evolution and anti-backtracking

The following Audit 35 baselines remain held:

- 838 Polymythcal listings, 32 event types, 422 registered sources, 595
  visibly qualified unconfirmed records, and 24-item browser batches.
- The deterministic protest job remains a four-hour, unsharded crawl of every
  protest source. It uses GitHub/Python rather than the paid agent.
- Seminar discovery remains Monday/Thursday and festival discovery remains
  Tuesday/Friday. The optional paid-agent stages were not made more frequent.
- Teacher Resources retains 644 resources, 25 collections, seven groups,
  server-rendered cards, URL-backed filtering, saved-view recovery, copy,
  print, disclosure controls, and Audit 35 failure handling.
- Home, BB, Bookwormcard, AA, Polymyth, Methodology List, Leizu, the CV, Agora,
  AITR, and the other projects retain their distinct jobs and visual voices.
- Audit 33, Audit 34, and Audit 35 reports and browser evidence remain
  historical. Audit 36 adds a SHA-256 inventory that freezes all 55 selected
  Audit 35 evidence/gate files byte-for-byte.

## Polymythcal discovery coverage

The scheduled deterministic seminar discovery previously checked the 41
priority sources on every run and left most compatible registered sources to
slower optional discovery. Audit 36 keeps all 41 priority sources on every run
and adds a stable four-shard rotation over 213 active, harvest-enabled,
same-parser-compatible sources.

The four deterministic shards contain 49, 55, 55, and 54 sources. A complete
four-run cycle sees every one of the 213 additional sources exactly once.
Assignment is based on a stable SHA-256 hash of the source ID, so source order
or JSON formatting cannot reshuffle the cycle.

The expansion is deliberately bounded:

- only enabled HTTP sources using static, server-rendered, WordPress, or Drupal
  delivery enter the deterministic extra pool;
- manual, JavaScript-only, protest, disabled, legacy, and unfinished sources
  do not silently enter the wrong adapter;
- all 41 tier-1 sources remain every-run inputs;
- page, elapsed-time, and worker bounds remain;
- the twice-weekly schedule and optional paid-agent schedule remain unchanged.

The source registry still contains 422 rows: 407 active and 15 explicitly
disabled legacy rows. Audit 36 completes tier, default event type, and render
mode for the 16 active Kingston-to-Montréal rows that lacked them. A new source
schema requires active rows to declare source mode, harvest state, tier, type,
and render mode, while continuing to permit the 15 disabled historical rows.

## Protest false-green prevention

The earlier protest harvester could finish with exit code zero when every
source was blocked, failed to fetch, or stopped yielding authoritative
observations. The publisher could then accept an empty candidate list. That
looked operationally healthy while hiding a total discovery outage.

Audit 36 adds a source-health gate to both ends of the publication boundary:

- the harvester records and evaluates primary-source yield coverage;
- an all-source blocked, fetch-failed, parser-failed, or no-authoritative-yield
  run writes diagnostics and exits nonzero before publication;
- missing or duplicate expected primary-source yield also fails;
- the publisher independently refuses missing, incomplete, or failed
  source-health evidence before changing canonical files;
- an explicitly observed `confirmed-empty` result remains valid, so the gate
  does not invent events or treat every empty day as an outage.

Focused behavior tests cover total block/fetch failure, total parser
regression, missing yield, missing gate, no-write publisher refusal, partial
valid yield, and legitimate confirmed-empty publication.

## Deterministic dates and gap-free rotation

The seven festival shards previously derived from three-day epoch buckets even
though the workflow runs Tuesday and Friday. That arithmetic permanently
skipped one shard. Festival selection now uses the shared calendar-slot helper;
seven consecutive scheduled runs produce a complete permutation of shards
`0` through `6`.

Build-manifest current-record metrics no longer read the machine wall clock.
Search generation and manifest updates share one strict Toronto release-date
helper sourced from `RELEASE_MANIFEST.json` or a validated explicit override.
Boundary tests cover the Toronto UTC day change and leap-year rollover.
The manifest updater now runs inside the canonical production build before
publication and efficiency checks, so a newly stamped release cannot fail
because a release-date count was left stale.

Expired stable event permalinks now enter archive mode during that same build:
they retain their permanent URLs, gain a concise past-event note, switch to
`noindex,follow`, and leave scheduled-event schema behind when they leave the
sitemap. This closes the midnight boundary where a past page could remain
indexable-looking after sitemap removal.

## UI, design, and interaction fixes

### Bookwormcard

- The creator page now declares its fixed theme policy, so the later shared
  theme sheet cannot turn CRT text into dark-on-dark copy.
- Calculated text contrast is 6.71:1 for CRT body copy, 4.74:1 for the CRT
  heading, 12.71:1 in light mode, and 21:1 in high contrast.
- Creator and success-page rain use one shared display-synchronised lifecycle.
  It pauses while hidden, in calm mode, and under reduced motion; it caps
  high-density canvas work and preserves the original colours.
- Tamagotchi idle checks changed from a perpetual interval to a
  visibility/motion-aware self-scheduling timer.

### AA

- The sibling switcher enters normal document flow on narrow or short screens
  instead of covering the route note.
- The detail surface is now one persistent modal dialog. Both the normal
  taxonomy and untranslatable renderers reuse it rather than one renderer
  deleting the other's DOM.
- Opening the dialog makes the background inert, focuses the first control,
  traps Tab/Shift+Tab, closes on Escape or backdrop, and returns focus to the
  invoking item without scrolling the page.

### Leizu

- The control bar does not auto-hide while it contains focus or hover.
- Coarse-pointer and short-height layouts keep the bar visible.
- Idle hiding resumes after the user leaves or moves focus away.

### Graph sitemap

- D3 7.9.0 is pinned as a same-origin vendored asset with its upstream licence
  and SHA-256 `f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539`.
  Source: https://www.npmjs.com/package/d3/v/7.9.0
- A blocked/missing library or malformed graph payload now ends in a visible
  tree-sitemap fallback instead of retrying every 50 ms forever.
- Node controls use roving keyboard focus, arrow traversal, Enter/Space
  activation, pressed state, labelled link counts, and focus-visible styling.
- The detail panel is inert while closed; reduced motion removes force/zoom
  animation; forced-colour treatment and 44px controls are explicit.
- Dynamic viewport flex layout keeps the graph between the in-flow header and
  footer, and 14 accidentally duplicated CSS rules were reduced to one.

### AITR

- The static entry count is accurate before JavaScript runs.
- Type filters identify their results; result totals announce through one
  concise live status.
- The empty state has one clear-and-reset action.
- Both current activities remain readable and runnable when JavaScript is
  unavailable.

## Efficiency and anti-jerk result

- Hidden pages no longer wake for matrix-rain or Tamagotchi polling.
- Reduced-motion and the site's calm-mode control stop decorative work rather
  than merely hiding its output.
- The graph no longer polls forever for a remote script and no longer depends
  on a third-party runtime request.
- The pinned graph engine has an exact checksum and a narrow 280 KB asset
  exception; the ordinary 100 KB JavaScript ceiling remains unchanged.
- Bookwormcard theme, AA mobile navigation, Leizu chrome, graph footer, and
  hidden detail controls no longer jump into or obscure the active task area.
- Front-facing additions are limited to state-specific fallback, reset, and
  no-JavaScript copy. No tour, duplicate onboarding sequence, marketing block,
  or generic design-system prose was added.

## Build and package continuity

`build-public-deploy.js` now constructs and validates a same-filesystem staging
tree while the prior `public/` tree remains usable. Commit uses rename, restores
the prior tree if the staging rename fails, and recovers an interrupted prior
tree on the next run.

ZIP creation now writes a temporary archive, verifies ordered members, CRC,
embedded `PACKAGE_CONTENTS_SHA256.json`, member sizes, member SHA-256 values,
and whole-archive digest. Each final file uses same-filesystem atomic
replacement; a pair-level backup and rollback restores both prior files if the
ZIP replacement, sidecar replacement, or installed-pair check fails.
Failure-injection tests cover both an early archive-write failure and a failure
while committing the new checksum sidecar, proving that the prior verified ZIP
and sidecar remain paired and temporary or rollback parts are removed.

Current npm browser-audit shortcuts now write only Audit 36 evidence. Historical
Audit 34 and Audit 35 release stamps remain preserved as files but are no
longer exposed as runnable npm commands, so a routine operator command cannot
overwrite frozen evidence or reset the active release. Both packaging formats
also omit two redundant root-level CV output copies while retaining the current
public CV downloads.

## Verification

Focused gates cover:

- 85 combined Python scraper, adapter, protest, lifecycle, sharding,
  deterministic-order, and package-integrity tests;
- 422 source rows, 407 active rows, 15 disabled rows, and 41 priority sources;
- all 213 deterministic extras exactly once per four-run cycle;
- festival seven-slot completeness;
- catastrophic protest failures and confirmed-empty distinction;
- deterministic Toronto build-date boundaries;
- Bookwormcard contrast and Leizu control lifecycle;
- graph dependency, failure, keyboard, viewport, and motion contracts;
- AA modal persistence and focus behavior;
- AITR no-JavaScript and filter recovery;
- animation visibility/motion lifecycle;
- staged public build and atomic ZIP preservation;
- existing Audit 35 route, Teacher Resources, Polymythcal, content, build,
  package, and evolution gates.

The canonical production build passed, followed by all 109 portable release
gates. The focused seminar occurrence-merge regression also passed.

The canonical build and complete portable verifier are release blockers before
packaging. The packaged ZIP also rebuilds, reruns the complete verifier,
checks public/source parity, validates every ZIP member, and emits a SHA-256
sidecar.

Fresh Audit 36 Chromium execution was not claimed in the local workspace:
the browser binary was unavailable and the temporary browser download returned
empty archives. Audit 35 screenshots were used only to diagnose the original
Bookwormcard and AA visual failures. New source/behavior gates cover the fixes,
and the predeploy workflow is configured to generate fresh Audit 36 browser
evidence when Chromium is available. No Firefox, Safari, or native
screen-reader execution is claimed.

## Direction-level work held for approval

Two larger changes remain intentionally unimplemented:

1. Server-rendering or virtualizing the 3.9 MB Methodology List could reduce
   initialization shift, but it would alter the canonical editor/archive
   delivery model and persistence behavior.
2. HTTP `ETag`/`Last-Modified` reuse could reduce deterministic fetch traffic,
   but safe `304 Not Modified` handling requires retained per-URL parsed
   observations. Adding validators without that state could make unchanged
   events disappear.

Neither direction was smuggled into this maintenance release.
