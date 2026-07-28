# Website Audit 43 — Approved Evolution, Weekly Discovery, and Interaction Polish

Date: 2026-07-25  
Release: `2026-07-25-site-audit43-approved-evolution-weekly-final`

## Scope and direction

Audit 43 implements the approved recommendations without changing the established
identity or purpose of any project. It is additive: Audit 42 remains frozen and
verifiable, existing routes and content floors remain release-blocking, and the
new work cannot silently remove the prior calendar, Teacher Resources,
methodology, or project surfaces.

The user-directed constraints are explicit:

- all automatic discovery and maintenance workflows remain exactly once weekly;
- the View Transitions improvement is implemented;
- BB remains a teacher-led experience and has no automated session runner;
- translation expansion is deferred until the rest of the site work is complete;
- existing language routes and behavior are preserved;
- this release does not perform a security audit.

## Visitor-facing improvements

### Project identity and navigation

The homepage now gives Polymythcal, Leizu, Teacher Resources, BB, AA, and the CV
their own CSS-native visual marks. The marks use existing project colors and
routes, require no image download, preserve all six destinations, and remain
stable at mobile and desktop widths.

Shared page navigation now uses short same-origin View Transitions. The duration
is deliberately restrained, the effect is removed under reduced-motion
preferences, and ordinary navigation remains the fallback.

### Reader mode

An opt-in quiet reader mode is available only on six long-form reading surfaces:
AA, Polymyth, Bookworm Burrows, Campaign Codex, Methodology List, and Module
Canon. It persists locally, exposes an accessible pressed state, and is excluded
from catalogs and application-like pages.

### Polymythcal nearby ranking

Polymythcal now provides a manual “Near” origin picker with 13 useful regional
origins. It sorts known approximate locations by Haversine distance, shares the
selection in the URL, labels all distances as estimates, leaves unknown and
online locations unnumbered, and never requests device location.

### Teacher Resources

Teacher Resources now has a keyboard-efficient first-match path. The new action
starts disabled, enables only when a real filtered match exists, and Enter from
the search field opens that first visible resource. The full 644-resource,
25-collection, seven-group catalog remains intact and stays within the existing
compressed page budget.

### Undated announcements

Polymythcal can show useful organizer announcements whose event date is still
missing. They appear in a clearly separate “Announcements awaiting a date”
surface, including missing details and source context. They never become dated
calendar cards, RSS items, ICS occurrences, or generated event routes until a
real date is found.

## Discovery improvements

### Broader, bounded source handling

The protest source registry now contains 15 explicitly configured sources:

- 10 browser-rendered sources;
- seven flyer/OCR sources;
- six mixed calendars with mandatory event-level inclusion rules;
- 12 sources allowed to yield undated announcement candidates.

Browser work is bounded to one to three pages per configured source. OCR is
bounded by image count, byte size, language, and processing time. No open-web
autonomous crawl or paid-agent stage was added to the protest workflow.

### Better calendar interpretation

Discovery now expands real recurrence rules rather than treating an entire
calendar as a single listing. It supports `RRULE`, `COUNT`, `UNTIL`, `RDATE`,
`EXDATE`, recurrence IDs, and durations, with hard occurrence and time-horizon
caps. Mixed-topic calendars must provide source-specific inclusion rules; a
missing rule causes refusal instead of importing unrelated events.

### Conditional-fetch cache correctness

The HTTP cache binds parsed records, discovered URLs, empty-result evidence,
parser version, validators, and response-body hashes. A bare `304 Not Modified`
response is not considered authoritative without compatible parsed cache state,
preventing unchanged-source requests from accidentally erasing discoveries.

### Identity and rescheduling diagnostics

A non-mutating identity shadow records high-confidence reschedule candidates for
review while keeping recurring occurrences distinct. It does not merge or
rewrite live events automatically.

### Weekly credit control

The protest, seminar, festival, and external-link workflows each have one weekly
cron schedule. Shard selection advances once per calendar week, so manual reruns
within the same week repeat the same shard rather than consuming the next one.
The protest workflow does not invoke a paid model.

## Continuity floors

The release inventory preserves or exceeds:

- 838 Polymythcal events across 32 types and 422 registered sources;
- 842 event alias routes;
- 644 Teacher Resources across 25 collections and seven groups;
- 1,139 methodology entries across 16 sections;
- 2,475 generated public HTML routes;
- 15 configured protest sources and all browser/OCR/mixed-calendar coverage
  floors listed above.

## Release verification

The final release suite passed **140/140 shipping gates**. Fresh Chromium
evidence passed **63/63 assertions** across seven measured route states and six
SHA-256-bound screenshots. Every measured state had zero horizontal overflow,
one visible H1, and CLS between 0 and 0.0061.

The package is blocked on:

- the frozen Audit 42 SHA-256 ledger;
- calendar adapter, lifecycle, harvest, shard, recurrence, cache, candidate, and
  package-integrity tests;
- exact weekly cadence and no-paid-agent checks;
- canonical build and public/source parity;
- route, content, keyboard, responsive, typography, overflow, and runtime gates;
- Audit 43 Chromium checks for homepage identity, nearby ordering, reader mode,
  undated candidates, Teacher Resources first-match behavior, reduced motion,
  BB’s teacher-led boundary, JavaScript errors, local HTTP failures, CLS, and
  horizontal overflow;
- six SHA-256-bound screenshots tied to the release manifest and browser program.

The machine-readable assertion and release-gate results are recorded in
`data/audit43-browser/approved-direction-browser-audit.json` and
`scripts/reports/release-gate-report.json` inside the packaged release.

## Deliberately deferred work

Translation expansion is deferred by instruction. Native Safari/WebKit,
Firefox, VoiceOver, and NVDA validation requires compatible external operating
systems and is not represented as completed by the container Chromium evidence.
No BB session runner is planned: the teacher remains responsible for running the
session.
