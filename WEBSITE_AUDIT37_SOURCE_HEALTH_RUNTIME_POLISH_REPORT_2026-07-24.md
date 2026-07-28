# Website Audit 37 — Source Health and Runtime Polish

Audit date: 2026-07-24  
Scope: non-security scraper reliability, false-green prevention, workflow
diagnostics, cross-project UI semantics, anti-yap, anti-jerk, runtime
efficiency, accessibility-adjacent behavior, release continuity, and package
integrity

Release: `2026-07-24-site-audit37-source-health-runtime-polish-final`  
Asset stamp: `20260724-audit37`  
Release timestamp: `2026-07-24T13:15:00-04:00`

## Outcome

Audit 37 continues from the exact verified Audit 36 artifact. It closes the
highest-priority remaining Polymythcal reliability gap: the main deterministic
structured crawl could previously finish successfully when every selected
source was blocked, fetch-failed, or parser-regressed. That false-green run
could then pass through the normal publisher or the direct fallback merger.

The structured and protest pipelines now use one source-health definition.
Structured diagnostics are saved before a distinct nonzero exit, retained by
the workflow, and independently revalidated at both publication boundaries.
A payload cannot claim a passing gate when its own source-yield rows show a
collapse. A legitimate explicit `confirmed-empty` observation remains valid.

Teacher Resources receives two small interaction-semantics improvements:
assistive technology can identify the current project page, and the existing
slash-to-search shortcut is declared on the search field. The inventory,
layout, filter model, and pedagogical content do not change.

No global redesign, font replacement, navigation rewrite, event-model rewrite,
scraper-frequency increase, paid-agent increase, project merge, BB session
runner, or Methodology List delivery change was implemented.

This was not a security audit. It makes no claim about vulnerabilities,
penetration resistance, secrets, permissions, abuse prevention, dependency
CVEs, or threat posture.

## Priority findings and disposition

### P0 — structured crawl could report a total discovery outage as success

The structured harvester already emitted per-source diagnostics, but it always
returned zero. An all-source block, transport failure, or parser collapse
therefore looked like an ordinary empty run.

Fixed:

- every selected structured source must produce exactly one diagnostic row;
- missing and duplicate configured/yield identities fail;
- `success`, `confirmed-empty`, and `not-modified` are authoritative;
- `partial-failure` is authoritative only when an event or explicit empty
  observation survived;
- an all-source non-authoritative run writes its complete payload and exits
  with source-health code 69;
- the existing schedule, page budgets, worker bounds, source rotation, and
  paid-agent frequency remain unchanged.

### P0 — a saved gate could disagree with its own diagnostics

A string-level `status: passed` check would still trust a malformed or forged
payload. The shared validator now reconstructs the configured source set from
the gate, recomputes health from the saved yield rows, rejects unknown or
unidentified rows, and verifies the authoritative IDs and count.

### P1 — the direct fallback merger bypassed publication validation

The agent-failure fallback calls the merger directly. Audit 37 adds the same
gate validation inside both deterministic merge functions before they add one
event or diagnostic row. The normal deterministic publisher also validates
before writing its agent placeholder, so refusal leaves publication state
untouched.

### P1 — failed structured diagnostics lived only in `/tmp`

The seminar workflow now copies a failed structured payload into
`data/harvest-runs/seminars-deterministic-failed.json` before the existing
failure artifact upload. Publication stays blocked, but the evidence needed to
distinguish a source outage from a parser regression is retained.

### P2 — Teacher Resources state was visually clear but not fully semantic

The current “Resources” project link now has `aria-current="page"`. The search
field declares its existing `/` keyboard shortcut with `aria-keyshortcuts`.
The route still contains 644 server-rendered resources, 25 collections, seven
groups, URL-backed filters, local recovery, copy-view, print, mobile filter
disclosure, and 24-result direct expansion.

## Cross-project audit results

The representative core-route scan covered AA, About, BB, Leizu, Polymythcal,
and Teacher Resources.

- No duplicate IDs were found.
- No image lacked an `alt` attribute.
- No form button lacked an explicit type.
- No `_blank` link lacked `noopener`.
- No unassociated visible form label was found.
- The apparent heading warnings were legacy event redirect stubs, not content
  pages; stable event pages remain the canonical reading surface.
- Leizu landing and teaching-page leaf emitters already pause while hidden and
  under calm/reduced motion.
- Leizu and AA concept-cloud simulations are bounded and stop when settled,
  after a frame ceiling, or while hidden; no perpetual cloud loop was added.
- Shared Bookwormcard rain, mandala, and Indra runtimes retain their Audit 36
  visibility and motion lifecycle.
- BB remains a teacher-led pedagogical TTRPG. No automatic session sequence or
  substitute-teacher logic was introduced.

The anti-yap pass added no tour, repeated onboarding, marketing panel, scraper
explanation block, or new front-facing operational prose. New copy is limited
to failure diagnostics and existing-control semantics.

## Evolution and anti-backtracking

Audit 37 preserves:

- 838 Polymythcal listings, 32 event types, 422 registered sources, 595 visibly
  qualified unconfirmed records, and 24-item browser batches;
- 407 active and 15 disabled source rows;
- all 41 priority deterministic sources on every seminar run plus the stable
  four-run rotation over 213 compatible additional sources;
- the four-hour, unsharded, non-agent protest crawl;
- Monday/Thursday seminar and Tuesday/Friday festival schedules;
- gap-free seven-run festival rotation;
- 644 Teacher Resources entries, 25 collections, and seven groups;
- project-specific visual voices and BB’s teacher-led direction;
- Audit 36 animation, dialog, graph, no-JavaScript, build atomicity, and package
  rollback protections.

Sixteen selected Audit 36 report, audit, release-stamp, and verification files
are frozen byte-for-byte in `data/audit36-frozen-sha256.json`. Audit 33 through
Audit 36 artifacts remain historical rather than being relabelled as new
evidence.

## Verification

Focused behavior tests cover:

- all-selected-source structured failure;
- legitimate `confirmed-empty` structured success;
- diagnostic-first code-69 exit;
- missing structured gate refusal before placeholder or merge;
- forged passing gate refusal when source rows fail;
- direct-merger gate refusal;
- workflow ordering and failed-diagnostic retention;
- the complete prior protest source-health suite;
- Teacher Resources inventory and semantics.

The focused Python adapter, harvest, lifecycle, sharding, deterministic
publication, and package-integrity families passed 92 tests; the separate
occurrence-merge regression also passed. The canonical production build and
complete portable verifier passed 110 of 110 gates.

Packaging rebuilds and reruns that full suite, checks public/source parity,
verifies every ZIP member, and writes the whole-archive SHA-256 sidecar through
the existing atomic pair commit.

Fresh Audit 37 Chromium execution is not claimed in this local workspace
because no browser executable is available. The predeploy workflow is updated
to generate five Audit 37 browser reports after static gates pass and to reject
stale, partial, failed, or previous-release evidence. No Firefox, Safari, or
native screen-reader execution is claimed.

## Direction-level work held for approval

Two previously identified larger changes remain unimplemented:

1. Server-rendering or virtualizing the 3.9 MB Methodology List would alter its
   canonical editor/archive delivery and persistence model.
2. HTTP conditional caching with persisted `ETag`/`Last-Modified` state could
   reduce fetch traffic, but safe `304` handling requires retained parsed
   observations so unchanged events cannot disappear.

A true BB session runner also remains a dialectical product decision, not a
maintenance audit change.
