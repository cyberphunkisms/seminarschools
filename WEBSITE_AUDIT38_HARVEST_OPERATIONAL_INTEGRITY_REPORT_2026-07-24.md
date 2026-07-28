# Website Audit 38 — Harvest Operational Integrity and Smoothness

Audit date: 2026-07-24  
Scope: non-security scraper coverage and quality, paid-run efficiency,
false-green prevention, workflow diagnostics, data evolution, cross-project
runtime smoothness, accessibility, interaction semantics, anti-yap,
anti-jerk, responsive behavior, and release continuity

Release: `2026-07-24-site-audit38-harvest-operational-integrity-final`  
Asset stamp: `20260724-audit38`  
Release timestamp: `2026-07-24T13:12:00-04:00`

## Outcome

Audit 38 continues from the verified Audit 37 release without changing the
site's direction. It concentrates on two risks that remained after the
all-source-outage protection added in Audit 37:

1. a deterministic run could still pass after observing too small a fraction
   of its selected sources; and
2. paid harvests spent prompt/output tokens accounting for sources they were
   not assigned to crawl or that deterministic discovery had already handled.

Both are fixed. Deterministic publication now requires broad authoritative
coverage, including a separate critical-source floor, and binds its result to
the exact stream, scope, and independently saved source selection. Paid
seminar work now reports only its real assignment, then a local validator
expands that compact result into the complete audited ledger. Every fully
successful deterministic source, not only Tier 1, is excluded from the paid
agent pass.

The release also fixes festival job bounds and accounting, preserves distinct
festival occurrences, makes degraded publication states visible, and improves
Polymythcal, Teacher Resources, AA, Saul, Methodology List, Leizu,
Bookwormcard, shared autolinking, and homepage landmark behavior.

There was no global redesign, font replacement, navigation rewrite, event
model rewrite, scraper-frequency increase, paid-agent-frequency increase,
project merge, or BB pedagogy change. No direction-level decision was needed
for the implemented work.

This was not a security audit. It makes no claim about vulnerabilities,
penetration resistance, secrets, permissions, abuse prevention, dependency
CVEs, or threat posture.

## Priority findings and implemented fixes

### P0 — source health could pass after a near-total coverage collapse

Audit 37 rejected an all-source deterministic outage, but one authoritative
row could still make a much larger selected run look healthy.

Implemented:

- at least 25% of every selected deterministic source set must produce an
  authoritative observation;
- at least 10% of its critical/Tier-1 subset must be authoritative;
- every selected source still requires exactly one diagnostic row;
- `success`, `confirmed-empty`, and evidence-bearing `partial-failure` are
  authoritative; blocked, fetch-failed, parser-regressed, and unsupported
  partial results are not;
- a bare HTTP `304 Not Modified` is not authoritative because no retained,
  validated parsed observation is bound to it yet;
- publication independently verifies the stream, scope, selected source IDs,
  diagnostic rows, quorum counts, and critical-source identities;
- malformed required configuration and corrupt protest candidate state fail
  closed instead of silently resetting or weakening the run;
- the protest harvester uses its configured positive request-timeout policy.

This improves coverage quality without adding speculative records, raising
frequency, or spending paid-agent credits on the four-hour protest pipeline.

### P0 — festival retries could exceed the declared job and credit envelope

The festival workflow allowed two 35-minute, $10 agent attempts inside a
45-minute job. It could therefore exceed both the job duration and a
single-run $10 expectation.

Implemented:

- one agent attempt per scheduled festival run;
- a 1,500-second agent timeout inside the existing 45-minute job;
- a maximum default exposure of $10 rather than two possible $10 attempts;
- no useless retry sleep after the final attempt;
- the workflow summary and diagnostics now address the `festivals` stream,
  rather than incorrectly asking for seminar status;
- merge failure receives an explicit failed publication status.

The Tuesday/Friday 09:42 UTC schedule and seven-run festival rotation are
unchanged.

### P1 — paid source accounting was needlessly verbose

The seminar prompt previously required 422 source-yield rows even though one
run was assigned only Tier-1 sources plus one of eight paid shards.

Implemented:

- the agent reports only every assigned source plus at most five eligible
  urgency-reserve `cfp`, `contest`, or `screening` sources;
- the normal eight paid shards require 87–93 accounting rows before
  deterministic-success skips, rather than 422, a roughly 78% reduction in
  routine accounting output;
- a local validator rejects missing, duplicate, unknown, miscounted,
  mis-statused, or unassigned rows, then expands the result to a complete
  422-source, roster-ordered ledger;
- deterministic successes, disabled/manual/non-HTTP sources, and out-of-shard
  sources receive locally derived skip statuses;
- every fully successful deterministic source, including rotating extras, is
  removed from paid crawling; partial, blocked, failed, parser-regressed,
  confirmed-empty, and unretained-304 observations remain retryable;
- festival output is separately validated against the exact 74-primary-source
  roster and order;
- merged diagnostics retain one top-level row per source while preserving
  both paid-agent status and deterministic observations.

The dollar saving from deterministic skips varies with each run, so no
invented fixed-dollar claim is made. The bounded festival maximum and the
seminar accounting-row reduction are deterministic.

### P1 — degraded harvests were not consistently distinguishable

Runner status now records publication state, agent exit code, and agent
failure kind separately. GitHub output marks a run degraded when publication
did not occur or when deterministic fallback published after an agent
failure. Degraded diagnostics are retained even when the workflow itself can
finish safely with existing public data intact. The summary reads the actual
status fields, and ephemeral run logs are ignored by default instead of
becoming release content.

### P1 — festival identity and feed edge cases could lose meaning

Festival merging now:

- preserves distinct same-title, same-day sessions;
- records reschedules and prior dates without collapsing separate
  occurrences;
- remaps child records to canonical parent IDs;
- evaluates an ongoing festival against its `end_date`;
- removes only an exact `www.` hostname prefix;
- emits RFC 822-compatible RSS publication dates; and
- publishes source-yield evidence.

## Cross-project smoothness, design, and accessibility

### Polymythcal

The mobile filter disclosure now synchronizes its open state and
`aria-expanded` value across resize, orientation change, and back-forward
cache restoration. The results control declares its target. Search performs
one debounced URL-state write rather than a redundant second write. The
24-card progressive batch, information architecture, and visual identity are
unchanged.

### Teacher Resources

All 26 generated catalog surfaces were regenerated from the source builder so
the improvement cannot disappear on the next build.

- Quick starts and Subject, Grade, Format, Province, and Program filters are
  labelled groups.
- The mobile filter control uses disclosure semantics without a redundant
  pressed state.
- Resource links have concise accessible names that retain useful context but
  omit long notes.
- Singular collection grammar is correct.
- The initial root interaction payload is 64,379 gzip bytes, below its 65 KB
  budget.

The inventory remains exactly 644 resources, 25 collections, and seven
groups. Every resource URL is unchanged.

### AA, Saul, and the homepage

AA Cloud now owns one cancellable animation frame, stops when hidden, calm,
reduced-motion, mobile-outline, settled, or eight seconds old, and resynchronizes
at viewport/orientation boundaries. Its mobile outline uses the same inclusive
600px boundary as CSS, scrolls vertically, and retains 44px controls.

AA result-card actions are native buttons handled by one delegated results
listener; nested cloud/tree links remain independent. Filter, mode, sort,
convergence, and tree controls synchronize pressed state. Result changes use
one concise atomic polite status. Dialog Escape, focus trapping, inert cleanup,
scroll restoration, and focus return remain intact.

Saul hydration preserves the static job-heading hierarchy and reports map
success or real load failure instead of declaring a lazy map unavailable after
an arbitrary timer. The full CV preview and selection count no longer act as
large live regions; one existing hidden atomic status announces a short
focus-update message only after a user or history change. All 14 Saul routes
were regenerated with that behavior.

The homepage skip link now reaches `#main-content`, and its heading, pathways,
and direct index sit inside exactly one main landmark.

### Methodology List

The 1,139-entry embedded corpus remains canonical. A fresh visit writes no
copy of that corpus to local storage. Only user deltas, tombstones, and
user-created records are persisted. Legacy full-record storage migrates
without losing edits, deletions, or user-created records; quota failure leaves
legacy data intact and still renders the embedded corpus. Fixed history is
stable and deduplicated, user notes are retained, and linkification no longer
mutates history.

This is a storage and correctness repair, not the held virtualization or
server-rendering direction change.

### Shared and remaining project runtime

- Shared autolinking performs its full initial/manual scan, then batches and
  deduplicates only newly added mutation subtrees instead of rescanning a
  large page after every card insertion.
- Leizu saves course-builder state only after real cart mutations rather than
  serializing it on every click and keyup. Calm and reduced-motion modes keep
  necessary chrome visible.
- Bookwormcard boots at DOM readiness and recovers on back-forward navigation;
  visible controls no longer wait for every font and image to finish loading.
- BB remains teacher-led. No automatic session runner or
  substitute-teacher behavior was introduced.

The anti-yap pass added no tour, repeated onboarding, marketing panel, or
front-facing scraper explanation. New visible copy is limited to concise
control labels, truthful status, and recovery text.

## Evolution and anti-backtracking

Eleven Audit 37 reports and gates are frozen byte-for-byte in
`data/audit37-frozen-sha256.json`. That historical snapshot records 838
Polymythcal listings, 32 event types, 595 qualified unconfirmed records, 422
registered sources, and the 644/25/7 Teacher Resources inventory.

Audit 38 currently retains:

- 838 canonical and browse-parity Polymythcal events across 32 types;
- 422 registered sources, including 407 active and 15 disabled rows;
- 41 every-run deterministic sources and 213 rotating deterministic sources;
- 24-item progressive browser batches;
- the Monday/Thursday 08:47 UTC seminar schedule;
- the Tuesday/Friday 09:42 UTC festival schedule;
- the four-hour-at-`:18`, unsharded, deterministic, no-paid-agent protest
  crawl;
- exactly 644 Teacher Resources, 25 collections, and seven groups;
- the 1,139-entry Methodology List corpus;
- each project's visual voice and BB's teacher-led direction.

Live integrity gates now treat the historical numbers as a baseline, not a
ceiling. Valid new events and sources may pass, while duplicate IDs,
canonical/browse drift, malformed counts, empty deterministic shards, missing
Teacher inventory, or collapse below 800 events, 25 types, 400 registered
sources, 390 active sources, 35 every-run deterministic sources, or 190
rotating deterministic sources fails.

## Verification status

Focused implementation checks passed for:

- source-health quorums, critical floors, 304 refusal, stream/scope/selection
  mismatch, and deterministic paid-work skips;
- compact and expanded source ledgers, urgency bounds, source/event counts,
  festival roster order, and combined paid/deterministic telemetry;
- seminar and festival occurrence identity;
- festival merge, feed, ongoing-date, and hostname behavior;
- degraded status summaries and workflow contracts;
- live-content growth, duplicate, parity, and collapse cases;
- Polymythcal responsive filter/URL behavior;
- Teacher Resources inventory, generated semantics, URL preservation, and
  payload budget;
- Methodology List fresh boot, compact persistence, legacy migration, quota
  fallback, and stable history;
- AA/Saul runtime and accessibility behavior;
- Leizu, Bookwormcard, and incremental autolink regressions; and
- the 11-file Audit 37 frozen-evidence manifest.

The final canonical production build passed, including byte-identical public
deploy parity across 3,550 allowlisted files. The complete portable release
runner then passed 124 of 124 blocking checks. The deployer-compatible archive
scan and whole-archive SHA-256 are recorded with the delivered ZIP rather than
embedded inside the archive whose digest they describe.

Fresh Audit 38 Chromium evidence is deliberately delegated to predeploy CI.
After static gates pass, CI runs interaction, entry-page, WCAG, route
resilience, and project stress audits and rejects stale, partial, failed, or
previous-release evidence. No local fresh-Chromium run, Firefox run, Safari
run, or native screen-reader session is claimed in this report.

## Direction-level work held for approval

The following remain unimplemented because each changes product architecture,
content direction, or long-term state behavior:

1. virtualizing or server-rendering Methodology List;
2. persisted `ETag`/`Last-Modified` caching with retained parsed observations
   for safe `304` reuse;
3. a true BB session runner;
4. AA result virtualization;
5. full Saul localization; and
6. re-enabling About-page creative mode.

These holds are explicit. None was partially introduced under the label of a
maintenance audit.
