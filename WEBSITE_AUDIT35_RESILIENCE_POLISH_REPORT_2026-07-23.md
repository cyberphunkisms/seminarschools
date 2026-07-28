# Website Audit 35 — Resilience and Polish

Audit date: 2026-07-23  
Evidence consolidated: 2026-07-24  
Scope: non-security UI, design, efficiency, anti-yap, anti-jerk, failure recovery, accessibility-adjacent presentation, build/runtime, and package integrity

Release: `2026-07-23-site-audit35-resilience-polish-final`  
Asset stamp: `20260723-audit35`  
Release timestamp: `2026-07-23T23:35:00-04:00`

## Outcome

Audit 35 fixes the highest-priority remaining resilience and route-polish
problems without changing the website's direction. The work is deliberately
local: it improves short-screen control behavior, fallback-font wrapping,
forced-colour and print presentation, failed-data recovery, interrupted
navigation, duplicate initialization, large-page linking, verification
efficiency, delivery budgets, and deterministic packaging.

No global redesign, global font replacement, information-architecture change,
content-model rewrite, scraper-cadence change, or project-identity merge was
implemented. Audit 33 and Audit 34 reports, evidence, and evolution gates
remain historical records rather than being rewritten to make this release
look cleaner.

This was not a security audit. It makes no claim about vulnerabilities,
penetration resistance, secrets, permissions, abuse prevention, dependency
CVEs, or threat posture.

## Evolution and anti-backtracking

Audit 35 began from the exact Audit 34 release rather than reconstructing the
site from a partial tree. The following baselines remain held:

- Polymythcal retains 838 canonical listings, 32 event types, 422 registered
  sources, 838 source URLs, 595 visibly qualified unconfirmed records, and
  24-item browser batches.
- The four-hour protest crawl remains unsharded. Audit 35 neither reduces it
  to a weekly run nor adds a second duplicate crawl.
- Kingston–Montréal coverage, canonical source trails, and visible
  qualification details remain.
- Teacher Resources retains 644 resources, 25 collections, seven groups, and
  its complete source/public route inventory.
- Home continues to make Polymythcal the priority public entry point.
- BB, Bookwormcard, AA, Polymyth, Meaninglib, Methodology List, Leizu, the CV,
  Agora, and the remaining projects keep their distinct identities and local
  visual voices.
- The CV keeps additive multi-select, exact selected-view downloads, web-only
  portrait/map presentation, Performance as a separate focus, and Seminar
  Schools under Portfolio.
- Leizu booking, payment, trial-class, cancellation, and programme terms are
  not rewritten by this interface pass.
- The practical text floor, reduced-motion behavior, calm-before-paint
  treatment, and separation between front-facing content and AI instructions
  remain.
- No broad copy rewrite flattens the projects into one generic product voice.

The Audit 35 release-stamp script explicitly excludes Audit 33/Audit 34
reports, old evolution verifiers, old browser evidence, and historical report
directories from active asset-token replacement.

## Route UI and design audit

Eight identity-bearing routes received route-local fixes. These additions
avoid imposing a new global component system on pages whose differences are
intentional.

| Route | Audit 35 work |
| --- | --- |
| Home | Gives header actions full targets, preserves the interactive project map in normal browsing, supplies system-colour map treatment, and prints an ink-light index instead of the canvas-like stage. |
| About | Moves reading-size controls clear of the full-height header, lets the smallest navigation scroll instead of squeeze or clip, and removes the decorative frame in forced-colour and print modes. |
| BB | Lets long route labels wrap without displacing their arrows, preserves card identity under fallback fonts, adds forced-colour boundaries, and produces an ink-safe print view. |
| Bookwormcard | Sets its runtime class before first paint so JavaScript visitors do not watch explanatory content collapse; no-JavaScript visitors still receive that context. Toolbar targets are at least 44px, tooltips are viewport-bounded, and short-screen help/footer controls return to document flow instead of covering the prompt. |
| AA | Reserves the asynchronously populated filter footprint, gives controls visible focus, clears sibling navigation from the theme control, demotes the multi-row sticky deck on phones and short screens, makes each complete control family horizontally keyboard-scrollable, bounds the detail overlay, and adds forced-colour/print treatment. |
| Leizu | Gives the main language and reading controls 44px targets and strong focus, bounds the consolidated control bar on short screens, gives every language action an explicit accessible name, and shows Latin fallback codes `TC`, `SC`, and `FA` so Traditional Chinese, Simplified Chinese, and Persian remain identifiable when a webfont is blocked or lacks the needed glyph. It preserves all language choices, keeps the hidden pricing panel inert and absent from the accessibility order, and adds forced-colour/print treatment. |
| CV | Gives the return-home action a full target, contains the local navigator, wraps long contact/action rows, moves font controls clear on short desktop-height screens, and removes decorative geometry in forced-colour mode while preserving one semantic H1. |
| Agora | Gives project navigation and calls to action full targets, contains horizontal navigation, lets long actions wrap, and supplies explicit focus and forced-colour treatment. |

The focused source gate passes all eight routes. It also confirms that
Bookwormcard's late short-screen override wins the cascade, AA still exposes
all seven browse modes, Leizu retains all five principal language choices plus
ESL, the CV keeps one H1 and its archive/spectrum, and BB/Agora retain their
project destinations.

## Anti-jerk result

The route work reduces screen movement and control collision without removing
functionality:

- fixed and sticky clusters no longer consume the primary task area on the
  targeted short-screen layouts;
- help text and secondary controls move into normal flow when height is scarce;
- long URLs and action rows wrap under enlarged or fallback fonts;
- overlays use bounded scrolling and contained overscroll;
- focus indication does not depend on layout-changing borders;
- forced-colour modes suppress decorative fields that could obscure content;
- print modes remove interactive/decorative layers instead of printing a dark,
  ink-heavy interface;
- Bookwormcard establishes its runtime state before paint rather than hiding a
  large block after it appears.

The final canonical-public Chromium route audit passes 252 of 252 asserted checks over
11 representative routes at desktop, mobile-short, and landscape-short
viewports, with six additional forced-colour route samples. It verifies route
response, visible document identity, horizontal containment, recoverable
positioned controls, visible initial keyboard paths, and absence of uncaught
page errors, plus Teacher Resources and Polymythcal recovery paths. Third-party
fonts are intentionally blocked in this audit so the fallback-font path is
deterministic.

AA and Methodology List are intentionally exempt from the route audit's generic
CLS assertion because both are large client-rendered archives. Their measured
CLS is reported rather than hidden:

| Held route | Desktop CLS | Mobile-short CLS | Landscape-short CLS |
| --- | ---: | ---: | ---: |
| AA | 0.020006 | 0.000740 | 0.524338 |
| Methodology List | 0.371636 | 0.097282 | 0.082452 |

AA's material shift is concentrated in the short landscape viewport.
Methodology List's material shift is concentrated at desktop initialization.
Changing either archive to server rendering or virtualization would change its
delivery architecture and potentially its editing/content model. That
direction-level change was held for the user's approval rather than smuggled
into a polish audit.

## Anti-yap result

Audit 35 adds almost no explanatory front-facing prose. The visible additions
are short, state-specific recovery labels such as retrying, cached-data, and
storage-unavailable notices. Route improvements are primarily CSS and
behavioral changes.

The pass does not add onboarding tours, duplicate summaries, pedagogical
sequences, or generic marketing paragraphs. Provenance and qualification
details stay attached to the event or resource where they answer a real
question.

## Teacher Resources interactivity and resilience

Teacher Resources retains all 644 server-rendered resource cards, so the
catalogue remains present before client-side filtering starts. Audit 35 adds
failure and long-session discipline around the existing finder:

- a one-mount guard prevents duplicate chips and listeners if a preview or
  interrupted navigation evaluates the bundle twice;
- corrupt or out-of-domain saved filter values are ignored;
- a blocked or full local store moves the finder into URL-only persistence
  instead of disabling the interface;
- the copied-view URL is built from current in-memory state even when
  `history.replaceState` is unavailable;
- rapid searches settle on the newest query rather than an older delayed one;
- back/forward restoration and back-forward-cache return flush interrupted
  search state coherently;
- repeated expand/collapse ends in a coherent state;
- copied and printed views flush pending input first;
- duplicate evaluation neither creates extra chips nor doubles filter toggles.

The focused static gate passes with 644 resources, 25 collections, and seven
groups. The route is 412,242 HTML bytes, 47.6% below its historical 787,139-byte
baseline. Its initial HTML/CSS/JavaScript total is 62,163 gzip bytes, 45.2%
below the historical 113,509-byte baseline. These are retained efficiency
baselines, not a claim that Audit 35 removed resources.

The focused failure/stress browser run passes 27 of 27 checks across
Polymythcal and Teacher Resources. Teacher-specific checks cover corrupt saved
state, storage quota failure, duplicate evaluation, history failure, latest
rapid-search settlement, back-forward-cache restoration, repeated disclosure
changes, and absence of page errors.

## Polymythcal failure recovery

Polymythcal's visible dataset and discovery policy are unchanged. Audit 35
hardens delivery of that dataset:

- a one-mount guard prevents duplicate controller initialization;
- browser payloads must contain nonempty listings with consistent declared
  counts, unique IDs, titles, valid dates, and valid end dates;
- a request has a 12-second timeout and at most two attempts;
- the retry pause is bounded and visibly announced;
- a validated last-good Cache Storage copy is used when the network payload
  cannot be recovered;
- cached data is labelled as a browser-saved copy rather than presented as
  current;
- a visible retry button can recover without reloading the page;
- failed loading clears busy state and restores control availability;
- request IDs prevent stale results from replacing newer state;
- page departure aborts the active request and clears pending search work;
- back-forward-cache return can restart a missing load;
- storage quota failure preserves saved items for the visit and reports that
  limitation honestly.

The 27-check focused failure/stress run confirms the 838-record inventory,
24-card initial batch, inert duplicate evaluation, honest storage fallback,
malformed-payload retry, validated cache fallback, exactly two failed network
attempts, two bounded timeout attempts, visible recovery, request abortion on
navigation, and no page errors along those paths.

Audit 35 does not claim that deterministic local failure doubles prove every
remote organizer is currently reachable. Source health and discovery yield
remain harvest evidence, not interface evidence.

## Methodology List and shared linkability performance

The previous shared autolinker could select a large container and many of its
descendants, then walk the same text repeatedly. It could also observe one
mutation through nested containers. That amplified work on the 3.9MB
Methodology List route and contributed to the route matrix stalling before its
screenshot.

Audit 35 makes the smallest non-directional correction:

- nested selector roots are reduced to one outer root per subtree;
- nested MutationObserver containers are similarly compacted;
- canonical vocabulary resolution is memoized by matched text;
- automatic sweeps collect one deduplicated text-node queue;
- large queues run in bounded idle-time slices so the page can paint and
  accept input while linking continues;
- mutations that arrive during a sliced sweep request a follow-up pass.

The public `autolinkEntries` API, canonical vocabulary registry, raw star-file
content, link exclusions, generated concordance destinations, and linkability
policy remain intact.

The focused autolink verifier passes, and the existing linkability verifier
still reports 838 vocabulary records, 831 concordance terms, and 16,601
references.

A bounded Chromium fixture with 700 entries and 35,000 generated links reached
a callable state in 2.139 seconds, compared with 5.812 seconds for the Audit 34
autolinker—a 63% improvement in time to a responsive measurement point. Its
10ms heartbeat advanced 51 times instead of 14 during the same probe. The
sliced version eventually produced all 35,000 links in 7.588 seconds. The
tradeoff is intentional: complete background linking may take slightly longer,
but it no longer monopolizes the main thread until completion.

Methodology List remains a large inline, client-rendered canonical
editor/archive. Audit 35 does not split, rewrite, server-render, or virtualize
its corpus without a direction decision.

## Build, runtime, and release efficiency

Audit 35 preserves the complete release gate while removing repeated work:

- `verify:all:built` reuses a canonical build instead of rebuilding the browser
  payload, public tree, asset report, and build-owned gates;
- the deployer-compatible packager reuses its just-completed canonical build;
- the default verifier uses bounded four-worker concurrency while serial mode
  is genuinely one worker;
- the three-operating-system clean-build workflow is fail-fast and caches
  pinned Python dependencies on each test OS;
- expensive downstream jobs depend on the clean-build matrix;
- Playwright Chromium installation occurs after build and static gates;
- duplicated Ubuntu adapter/lifecycle work was removed while the six suites
  remain required by the operating-system matrix;
- the tracked-public regression creates only the fixture it needs before one
  canonical regression build.

Runtime and weight controls are tightened:

- 12 current large-page budgets replace stale page exceptions;
- any unbudgeted HTML above 350KB is a hard failure;
- the generated public tree has a 100MB ceiling;
- CSS, JavaScript, images, fonts, data, PDFs, text, and archives have
  type-specific limits;
- only the two canonical archival PDFs and complete concordance index receive
  narrow large-asset exceptions;
- asset reporting includes extension totals and a runtime-asset view;
- third-party styles must be mitigated Google Fonts requests with preconnect
  and `display=swap`;
- third-party scripts must defer or load asynchronously;
- external embeds and images must be lazy;
- external CSS imports are rejected;
- static assets have bounded caching and calendar browser data revalidates in
  five minutes.

The current focused page-budget gate passes all 12 explicit large-page budgets
with no stale exception and no unbudgeted HTML over 350KB. The current built
public snapshot contains 3,547 files and 94,516,439 bytes; its three intentional
large assets remain within narrow ceilings. The runtime-delivery gate passes
across 2,475 HTML files, 84 mitigated external font stylesheets, one deferred
external script, one lazy external iframe, and two lazy external images.

## Deterministic package integrity

Both package formats now:

- derive their timestamp and release identity from the release manifest;
- sort members stably;
- write `PACKAGE_CONTENTS_SHA256.json` with every path, byte count, and SHA-256;
- reopen the ZIP and verify member order, CRC, archived manifest equality,
  byte counts, and member hashes;
- emit a `.sha256` sidecar;
- exclude virtual environments, dependency trees, tool caches, and generated
  dependency directories.

The package-integrity unit test proves that two archives built from identical
inputs are byte-identical and share the same SHA-256. It also verifies the
internal content manifest and CRC.

## Final verification

All final evidence is aligned to
`2026-07-23-site-audit35-resilience-polish-final`:

- canonical build: passed;
- complete source/`public/` parity: 3,546 allowlisted files byte-identical;
- complete portable release suite using the canonical build: 103/103 passed;
- representative route/recovery browser audit: 252/252 passed across 11
  routes, three viewports, six forced-colour samples, and 39 screenshots;
- Polymythcal interaction/design browser audit: 94/94 passed;
- dedicated Polymythcal entry-page browser audit: 209/209 passed across 11
  routes;
- browser-assisted WCAG 2.2 audit: 42/42 passed;
- Polymythcal and Teacher Resources failure/stress audit: 27/27 passed;
- fresh-browser meta-gate: all five current-release reports accepted;
- Polymythcal Audit 14: 28/28 passed;
- Audit 35 route UI source gate: eight routes passed;
- autolink performance gate: passed;
- linkability overhaul gate: passed with 838 vocabulary records, 831
  concordance terms, and 16,601 references;
- page-size budget gate: 12 current heavy pages passed;
- asset-weight gate: 3,547 files and 94,516,439 bytes passed;
- Polymythcal adapter, protest-harvest, lifecycle, sharding, and
  deterministic-before-agent Python suites: 70 tests passed;
- occurrence-merge regression: passed;
- deterministic package-integrity unit test: passed;
- Audit 35 evolution gate: passed with exact Audit 34 historical hashes,
  current release/stamp alignment, and every frozen inventory/cadence
  invariant intact.

## Environment limitations and honest boundaries

- Local automated route evidence is Chromium-only.
- Firefox binaries were obtained, but Firefox did not become Playwright-ready
  in this container because its sandbox/profile startup could not use the
  required host facilities.
- WebKit could not launch because the host lacks required GTK/GStreamer shared
  libraries. The managed environment's read-only package-manager directories
  prevented installing those host dependencies.
- No Firefox or Safari interaction/visual pass is claimed.
- The clean-build workflow preserves Ubuntu, Windows, and macOS jobs, but this
  report must not claim those jobs executed successfully unless CI actually
  ran.
- Native VoiceOver and NVDA task sign-off remains manual and unclaimed. The
  existing screen-reader protocol remains available.
- Route evidence blocks third-party fonts to test system-font fallbacks. It is
  not a live availability test of Google Fonts.
- Failure tests use deterministic local network/storage doubles. They prove
  coherent behavior, not current health of every external source.
- Screenshot capture exists, but no cross-browser pixel-diff baseline is
  claimed.
- No security audit was performed.

## Held direction decisions

Two possible changes were not implemented because they would alter the site's
architecture:

1. **AA server rendering or virtualization.** This could reduce the measured
   0.524338 short-landscape CLS, but it changes how the seven-mode archive is
   delivered and potentially how its complete corpus remains inspectable.
2. **Methodology List server rendering, virtualization, or corpus splitting.**
   This could reduce its 0.371636 desktop initialization CLS, but it changes
   the canonical editor/archive delivery model. Audit 35 instead fixes the
   shared autolinker so the page remains usable while link generation
   continues.

These are the direction-level questions to present before any future
implementation. They are not concealed as unresolved bugs and not silently
chosen on the user's behalf.

## Final handoff

The final deliverable must be the deployer-compatible Audit 35 ZIP containing
the source, generated public mirror, this report, fresh Audit 35 browser
evidence, and the internal package-content hash manifest.

The enclosing ZIP's final filename, byte size, member count, and SHA-256 are
recorded in its `.sha256` sidecar and delivery handoff rather than inside this
embedded report. Keeping the archive hash external avoids a self-referential
file whose own hash would change whenever that value was inserted. Inside the
ZIP, `PACKAGE_CONTENTS_SHA256.json` remains the authoritative per-member
manifest; the packager reopens the completed archive and verifies order, CRC,
byte counts, and every member hash before handoff.
