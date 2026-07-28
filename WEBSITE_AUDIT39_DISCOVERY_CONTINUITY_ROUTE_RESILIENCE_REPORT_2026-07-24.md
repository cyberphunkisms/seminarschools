# Website Audit 39 — Discovery Continuity, Route Resilience, and Smoothness

Audit date: 2026-07-24  
Scope: non-security Polymythcal discovery recall, generated-route truthfulness,
Teacher Resources interactivity, cross-project runtime efficiency, design and
font delivery, anti-yap, anti-jerk, accessibility semantics, cache coherence,
packaging continuity, and release evolution

Release:
`2026-07-24-site-audit39-discovery-continuity-route-resilience-final`  
Asset stamp: `20260724-audit39`  
Release timestamp: `2026-07-24T22:30:00-04:00`

## Outcome

Audit 39 continues from the byte-frozen Audit 38 release without changing the
site's direction. It fixes the specific class of Polymythcal miss that made an
official organizer announcement easy to overlook: the useful page was often a
dated action post or campaign detail nested under a generic news surface, while
the crawler spent its bounded page budget on less relevant news links.

The deterministic protest crawler now prioritizes event-bearing organizer
links, reads bounded long-form action posts, carries publication time into
yearless-date interpretation, understands more RSS, iCalendar, JSON-LD, and
organizer-page structures, and preserves already known facts when one detail
page temporarily fails. It does this inside the existing every-four-hours,
unsharded, paid-agent-free protest job. No new paid-agent run and no frequency
increase were introduced.

Generated Polymythcal and Teacher Resources routes are more truthful,
recoverable, and useful. Repeated event titles are disambiguated; uncertain
listings no longer claim structured `Event` facts that are not actually known;
legacy aliases provide semantic recovery; Teacher Resources gains breadcrumbs
and related-resource navigation without changing any resource URL.

Shared runtime work removes duplicate mounts, focus loss, resize storms,
unbounded animation work, and avoidable search rescans. Methodology List images
reserve their space before loading. Google Fonts requests are consolidated
without replacing the projects' chosen typefaces. Overlapping cache policies
now agree, and an extracted release can be repackaged without colliding with
its inherited integrity manifest.

There was no global redesign, project merge, navigation rewrite, content-model
rewrite, font replacement, event-frequency increase, BB pedagogy change, or
change to the meaning of Polymythcal, Teacher Resources, AA, Saul, Leizu,
Bookwormcard, or Methodology List. No direction-level decision was needed for
the implemented work.

This was not a security audit. It makes no claim about vulnerabilities,
penetration resistance, secrets, permissions, abuse prevention, dependency
CVEs, or threat posture.

## P0 — advance protest discovery was biased toward the wrong links

The failure was not that Polymythcal lacked a generic “Toronto protest
listings” search. That framing points toward aggregators and retrospective
news. Advance discovery depends on extracting event-bearing links from
organizers' own public pages.

The crawler previously had five material recall gaps:

1. generic news links could consume the bounded detail-page budget before
   explicit action, rally, campaign, calendar, and event links;
2. long organizer announcements could be discarded at 2,400 characters even
   when the date and assembly point appeared later in the page;
3. yearless dates in older RSS or WordPress posts could be rolled into the
   current year instead of being anchored to publication year;
4. structured feeds and pages could lose organizer, canonical URL, identity,
   lifecycle, or string-address facts; and
5. one partial detail-page failure could erase a previously known time,
   location, or organizer.

Implemented:

- signal-bearing action/calendar/detail links run before generic news links
  within the same per-source page and time bounds;
- protest sources without an explicit adapter can infer the civic-action
  parser instead of falling through to an unsuitable generic path;
- organizer article parsing uses a bounded 24,000-character window rather than
  dropping the entire post;
- organizer news containers use the detail announcement as the canonical URL;
- RSS and WordPress yearless event dates use the announcement's publication
  year, preventing expired posts from reappearing as future events;
- explicit RSS event date, start time, venue, and organizer fields are
  preferred to the article publication timestamp;
- iCalendar `ORGANIZER` common names, JSON-LD URL/identifier/status, object and
  string addresses, organizer fields, and lifecycle signals are retained;
- multi-location campaign text keeps enough unstructured location context to
  select Toronto rows before publication;
- partial observations preserve prior known facts while recording which fields
  were missing in the current crawl; and
- duplicate source IDs, occurrence identities, source-health rows, required
  configuration, and candidate-state corruption fail closed.

The unchanged lifecycle policy rechecks unresolved candidates every four hours
and confirmed candidates every twelve hours. The source inventory remains
additive: all 16 required protest-source IDs are present, and future legitimate
sources may increase that count.

A live validation recovered ACORN's July 10 organizer announcement for a July
15 Toronto action at 12:00 p.m., meeting at 181 University Avenue. That is the
kind of organizer-first, before-the-event page the revised discovery path is
designed to elevate:
[https://acorncanada.org/news/acorn-beat-the-heat-day-of-action-on-july-15th/](https://acorncanada.org/news/acorn-beat-the-heat-day-of-action-on-july-15th/).
The organizer's Toronto hub remains another public discovery seed:
[https://acorncanada.org/locations/toronto-acorn/](https://acorncanada.org/locations/toronto-acorn/).

Mixed public calendars remain useful inputs but require source-specific
interpretation before automatic publication. The Ontario Health Coalition
page illustrates a surface that mixes actions with other event classes:
[https://www.ontariohealthcoalition.ca/index.php/news-events/upcoming-events/](https://www.ontariohealthcoalition.ca/index.php/news-events/upcoming-events/).

## P0 — generated routes could overstate certainty or strand visitors

All current generated surfaces were regenerated from their canonical builders,
and check mode now proves that regeneration is read-only and idempotent after
the site's steady-state postprocessing.

Polymythcal:

- 838 canonical event pages remain in parity with the live event dataset;
- 19 repeated-title groups affecting 60 pages now use date/city
  disambiguation;
- speculative `Event` schema was removed from 485 uncertain pages;
- indexable pages use factual event metadata and matching canonical/Open Graph
  URLs;
- up to three valid related listings appear on 831 event pages;
- 842 legacy aliases are `noindex,follow` semantic recovery pages with a main
  landmark, heading, stable destination, pre-paint theme initialization, and
  calm geometry;
- 11 focused calendar routes are explicit indexable views whose “current”
  calculation is tied to the release build day rather than wall-clock drift;
  and
- the sitemap contains 841 unique, classified URLs.

Structured `Event` output is now limited to listings with the date, location,
confirmation, and lifecycle confidence needed to support it. This follows the
properties and event-status model documented at
[https://schema.org/Event](https://schema.org/Event). Calendar parsing keeps
iCalendar organizer semantics compatible with RFC 5545:
[https://www.rfc-editor.org/info/rfc5545/](https://www.rfc-editor.org/info/rfc5545/).

## P1 — Teacher Resources navigation and interaction continuity

The inventory remains exactly 644 resources, 25 collections, and seven groups.
The resulting 676 generated group, collection, and resource routes keep their
existing canonical URLs.

Implemented:

- all 676 routes have semantic breadcrumbs;
- all 644 resource details include up to three related resources from the same
  collection, adding 1,928 useful internal recovery links;
- 637 unverified author values are no longer asserted as `Organization`
  schema;
- fallback descriptions no longer repeat the page title as filler;
- stale generated catalog routes are archived as `noindex,follow` recovery
  pages instead of silently disappearing; and
- the interactive finder builds its search-match cache exactly once per
  filter update and reuses it for results and facet counts.

The last item improves responsiveness without reducing filter combinations,
quick starts, accessible labels, resource notes, or the 644-item catalog.

## P1 — anti-jerk, focus, and runtime efficiency across projects

Shared and project-specific controllers now mount once even if a script is
evaluated again after navigation or restoration. The guarded surfaces include
shared site behavior, theme and type controls, keyboard enhancements,
autolinking, Leizu chrome and booking, and Saul's CV spectrum.

Additional fixes:

- Bookwormcard's AA bridge restores focus without forcing the page to jump;
- AA and Leizu cloud detail tags are native keyboard controls;
- cloud overlays preserve and return focus, synchronize inert regions, and
  close cleanly across layout changes;
- cloud simulations use one retained animation-frame scheduler, stop when
  hidden, calm, reduced-motion, mobile/settled, or beyond their bounded active
  window, and do not use interval loops;
- responsive canvas/outline state is synchronized through coalesced resize
  work;
- the Polymyth sitemap graph uses a stable initial layout, bounded settling,
  `ResizeObserver`, visibility, page-hide, and back-forward-cache lifecycle
  handling; and
- the homepage coalesces resize and back-forward refreshes through one
  animation frame.

These changes target jerky movement and duplicate work without flattening the
projects' distinct visual identities.

## P1 — Methodology List layout continuity

Methodology List remains exactly 1,139 entries across 16 static editions. The
interactive corpus, local edit/migration behavior, and three-state register
order are unchanged.

Implemented:

- one register click advances exactly one state;
- known entry images carry their 760 × 950 intrinsic dimensions;
- live, split-section, and export render paths use the same image renderer; and
- offscreen images remain lazy-loaded with asynchronous decoding.

This reserves layout space before image arrival and removes one source of
screen jump. It is not the held virtualization/server-rendering redesign.

## P1 — font delivery and cache coherence

Eleven pages that issued two or three Google Fonts CSS2 stylesheets were
consolidated. Across all 69 font-bearing source pages:

- each page now issues at most one CSS2 stylesheet;
- `display=swap` remains present;
- duplicate font-origin preconnects are removed; and
- every audited project-specific family remains selected.

No font was replaced. The consolidation follows Google Fonts' documented
multi-family CSS2 request format:
[https://developers.google.com/fonts/docs/css2](https://developers.google.com/fonts/docs/css2).

The overlapping image-cache rules in `_headers` and `netlify.toml` now use the
same policy. HTML still revalidates immediately, shared CSS/JS revalidates
daily, images/fonts remain long-lived, and current calendar payloads retain
their five-to-sixty-minute freshness windows. Netlify documents both header
configuration surfaces and cache behavior here:
[https://docs.netlify.com/manage/routing/headers/](https://docs.netlify.com/manage/routing/headers/)
and
[https://docs.netlify.com/build/caching/caching-overview/](https://docs.netlify.com/build/caching/caching-overview/).

## P1 — package round-trip continuity

An extracted release contains `PACKAGE_CONTENTS_SHA256.json`. The previous
packagers could select that inherited manifest as input and then attempt to
write another manifest with the same archive path.

Both package builders now exclude the inherited reserved name. The shared
archive writer rejects it if selected accidentally, then verifies that the new
archive contains exactly one freshly generated manifest. Four package-integrity
unit tests, including the reserved-name regression, pass.

## No-backtracking ledger

Audit 38's exact figures are frozen historical evidence. Current Polymythcal
metrics use floors so a valid new event, type, source, route, or gate is not
rejected as drift.

| Surface | Audit 38 historical floor | Audit 39 verified state |
|---|---:|---:|
| Canonical Polymythcal events | 838 | 838 |
| Event types | 32 | 32 |
| Registered sources | 422 | 422 |
| Every-run deterministic sources | 41 | 41 |
| Rotating deterministic sources | 213 | 213 |
| Legacy event recovery aliases | — | 842 |
| Focused calendar routes | — | 11 |
| Classified sitemap URLs | — | 841 |
| Font-bearing source pages | — | 69 |
| Portable release checks | 124 | 132 |
| Public parity files | 3,550 | 3,550 |

The intentionally exact product constraints remain:

| Constraint | Required and verified |
|---|---:|
| Teacher Resources | 644 resources / 25 collections / 7 groups |
| Methodology List | 1,139 entries |
| Polymythcal progressive batch | 24 cards |
| Seminar schedule | Monday/Thursday at 08:47 UTC |
| Festival schedule | Tuesday/Friday at 09:42 UTC |
| Protest schedule | Every four hours at :18, deterministic and unsharded |

Audit 38's 25% authoritative-source quorum, independent 10% critical-source
floor, selected-stream/scope binding, compact paid seminar ledger, one-attempt
festival bound, and 1,500-second festival timeout remain active. The
four-hour protest job still has no Claude/Anthropic token, paid-agent runner,
budget variable, or shard matrix.

## Focused verification executed

The following focused evidence passed while this report was assembled:

- 14 frozen Audit 38 report/gate files remained byte-identical;
- Audit 39 protest recall verification passed at 838 events, 32 types,
  644/25/7 Teacher Resources, and at least 16 required protest sources;
- generated-route verification passed for 838 canonical events, 842 aliases,
  676 Teacher Resources routes, 11 focused calendars, and 841 sitemap URLs;
- runtime/UI syntax and continuity verification passed;
- cache-coherence verification passed;
- font-delivery verification passed across 69 pages;
- Methodology runtime verification passed;
- package round-trip verification passed;
- all four package-integrity unit tests passed; and
- the frozen Audit 38 Methodology state test still passed against the current
  1,139-entry corpus.

The canonical production build passed with 3,550 allowlisted public files
byte-identical to their source counterparts. The complete portable release
runner then passed 132 of 132 blocking checks, covering the accumulated site,
project, scraper, content, accessibility, packaging, and deployment contracts.
That complete runner remains the blocker for future releases; the focused list
above does not replace it.

No local fresh-Chromium run, Firefox run, Safari run, or native screen-reader
session is claimed in this report. Fresh Audit 39 Chromium evidence is a
separate predeploy step after the portable static/full gate and must carry the
current release ID, timestamp, complete assertion counts, and fresh execution
time. The inherited local Playwright driver executable segfaulted during
preflight, so the audit did not synthesize or reuse browser evidence; predeploy
installs a fresh Playwright Chromium before running the five browser suites.

## Direction-level work held for approval

The following remain unimplemented because they change architecture,
publication doctrine, cost profile, long-term identity behavior, or product
direction:

1. virtualizing or server-rendering the interactive Methodology List;
2. retained parsed HTTP caching with `ETag`/`Last-Modified` and validated
   `304 Not Modified` reuse;
3. a true BB session runner;
4. AA result virtualization;
5. full Saul localization;
6. re-enabling About-page creative mode;
7. publishing no-real-date organizer announcements as candidate-only public
   records;
8. automatic ingestion of mixed external calendars before each source has an
   explicit event-class filter;
9. adding headless-browser or OCR harvesting for client-only and
   image-announcement sources;
10. recurring iCalendar `RRULE` expansion; and
11. revising the canonical identity/reschedule heuristic.

None was partially introduced as maintenance. They require an explicit
direction decision before implementation.
