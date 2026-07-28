# Website Audit 41 — Depth, Rollover, and Density

Audit date: 2026-07-25  
Release: `2026-07-25-site-audit41-depth-rollover-density-final`  
Asset stamp: `20260725-audit41`  
Scope: non-security browser depth, heading ownership, catalog density,
generated-event date rollover, build determinism, release continuity, and
no-backtracking verification

## Outcome

Audit 41 continues from byte-frozen Audit 40 evidence. It closes the remaining
maintenance defects found by the final depth pass without changing any
project's purpose, event doctrine, content inventory, scrape schedule, or
delivery architecture.

No direction-level site change was implemented. This was not a security audit.

## P0 — generated-event midnight rollover

The July 24 to July 25 rollover exposed an operational defect. Generated event
pages changed indexability at midnight, but the ordinary production build did
not run the canonical bilingual event-page generator. The static search builder
could update robots and sitemap state while leaving older page markup and
related-event recovery stale.

The production build now:

1. runs the canonical event-page generator first;
2. runs the static search and sitemap builder against that completed surface;
3. treats stale generated-event output as a release failure; and
4. removes generated event directories that no longer belong to a canonical
   event or recovery alias.

The permanent rollover gate checks all 838 canonical event pages, exact sitemap
membership, archived robots/schema/note parity, 842 alias targets, orphan
cleanup, and generator order. A no-write future-date simulation advances to the
next event boundary and confirms that both generators reject stale output
without changing the working tree.

This is publication maintenance. Event identity, rescheduling, confidence,
classification, and candidate-publication rules are unchanged.

## P0 — current-release browser depth

Audit 41 regenerates all current browser evidence after the release stamp:

- 624 inherited interaction, entry-page, WCAG, route, and failure-stress
  assertions;
- 194 representative runtime and deep-link assertions; and
- 64 new full-depth assertions across eight routes.

The combined floor is 882 passing assertions. The new depth routes cover
Bookwormcard, Teacher Resources, Polymythcal, one current indexable event, one
expired event, BB, Methodology List, and the home page. Every route checks HTTP
success, title, main landmark, visible H1 ownership, horizontal overflow,
runtime errors, failed local requests, and one route-specific contract.

The accessibility reference remains
[WCAG 2.2](https://www.w3.org/TR/WCAG22/). The layout-stability target remains
the good CLS threshold described by
[web.dev](https://web.dev/articles/cls). Netlify header behavior continues to
follow the documented
[custom-header rules](https://docs.netlify.com/manage/routing/headers/).

## P1 — Bookwormcard heading ownership

Bookwormcard's pre-paint JavaScript class hid the crawler-readable static H1,
while the enhanced game shell exposed an H2. Earlier structural checks counted
the hidden source H1 and therefore missed that the live interface had no active
H1.

Heading ownership is now mutually exclusive:

- JavaScript mode exposes the live Bookwormcard H1; and
- no-JavaScript mode exposes the static explanatory H1.

The character-card flow, static context, stored progress, print/PDF paths,
theme controls, questions, and BookwormBurrows handoff remain unchanged.

## P1 — Teacher Resources density

The sticky Teacher Resources finder exposed every generated facet group at
once on desktop. Hydration could turn the controls into a tall screen-obscuring
wall before the resource list.

Quick starts now remain visible while the complete facet set sits behind one
keyboard-operable `More filters` disclosure at every viewport. Its accessible
name and expanded state remain synchronized. All 644 server-rendered resource
cards, 25 collections, seven groups, live search, filters, history behavior,
and no-JavaScript discovery remain intact. Catalog virtualization was not
introduced.

## No-backtracking ledger

Audit 40 is frozen across 60 SHA-256-recorded report, gate, browser-result, and
screenshot files.

| Surface | Audit 40 baseline | Audit 41 requirement |
|---|---:|---:|
| Canonical Polymythcal events | 838 | at least 838 |
| Event types | 32 | at least 32 |
| Registered sources | 422 | at least 422 |
| Event recovery aliases | 842 | at least 842 |
| Teacher Resources | 644 / 25 / 7 | exactly 644 / 25 / 7 |
| Methodology List | 1,139 | exactly 1,139 |
| Polymythcal progressive batch | 24 | exactly 24 |
| Audit 40 portable gates | 135 | historical floor |
| Public parity files | 3,550 | at least 3,550 |
| Audit 40 package members | 7,910 | historical archive fact |
| Audit 40 browser assertions | 818 | inherited floor |
| Audit 41 browser assertions | — | at least 882 |

The seminar schedule remains Monday and Thursday at 08:47 UTC. The festival
schedule remains Tuesday and Friday at 09:42 UTC. The protest workflow remains
the existing unsharded, deterministic, paid-agent-free crawl every four hours
at minute 18. Audit 41 does not increase scraper frequency or credit use.

## Final verification contract

The package is blocked until the following pass:

- canonical event-page generation before static search generation;
- public/source parity and generated-route rollover verification;
- the complete portable release runner;
- frozen Audit 40 SHA-256 verification;
- Audit 41 content-structure, runtime-efficiency, Teacher Resources density,
  rollover, Bookwormcard, and evolution gates;
- five regenerated inherited Chromium suites;
- the regenerated 24-case runtime suite;
- the new 64-assertion depth suite; and
- the 882-assertion fresh-evidence verifier.

## Environment limits

Native VoiceOver and NVDA were not executed in this container. Native Firefox
and Safari/WebKit sign-off also requires compatible unrestricted hosts. These
are external audits and are not relabeled as passing evidence.

## Direction-level work held for approval

The following remain held because they alter architecture, content
availability, product behavior, or operating cost:

1. Methodology or Teacher Resources virtualization;
2. a bundler or large legacy-app split;
3. a global redesign, font replacement, or navigation rewrite;
4. a true BB session runner;
5. AA result virtualization;
6. full Saul localization;
7. scraper-frequency, sharding, or paid-agent changes;
8. browser/OCR harvesting;
9. recurring iCalendar expansion; and
10. automatic publication from mixed calendars.

None was partially introduced.
