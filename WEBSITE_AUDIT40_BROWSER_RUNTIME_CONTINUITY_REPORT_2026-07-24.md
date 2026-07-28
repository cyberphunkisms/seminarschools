# Website Audit 40 — Browser and Runtime Continuity

Audit date: 2026-07-24  
Scope: non-security whole-site content structure, route and fragment
continuity, browser interaction, responsive layout, cumulative layout shift,
long tasks, runtime errors, horizontal overflow, keyboard focus, accessibility
semantics, typography delivery, cache coverage, transition discipline,
Teacher Resources interactivity, Methodology List completeness, release
evolution, responsive project-tool operability, and package continuity

Release:
`2026-07-24-site-audit40-browser-runtime-continuity-final`  
Asset stamp: `20260724-audit40`  
Release timestamp: assigned by the Audit 40 stamp at execution

## Outcome

Audit 40 continues from byte-frozen Audit 39 evidence without changing the
site's direction. It adds a whole-site structural crawl, fixes real deep-link
and labeling defects, makes every Methodology corpus section reachable,
removes avoidable render-blocking font imports and broad transition
declarations, extends bounded caching to route-local code, and adds a fresh
representative browser/runtime matrix across the site's major projects.

No direction-level site change was implemented. There was no project merge,
global redesign, navigation rewrite, font replacement, content-model rewrite,
scrape-frequency increase, event-publication doctrine change, Teacher
Resources inventory reduction, Methodology corpus reduction, list
virtualization, or bundler introduction.

This was not a security audit. It makes no claim about vulnerabilities,
penetration resistance, secrets, permissions, dependency CVEs, abuse
prevention, or threat posture.

## P0 — whole-site structural and fragment integrity

The new source crawl checks all 2,475 public HTML pages rather than a small
representative sample. Its current result covers:

- 5,682 unique element IDs;
- 1,724 static ID references;
- 3,241 local fragments;
- 821 indexable canonical owners; and
- 1,653 intentional `noindex` pages.

The gate rejects duplicate IDs within a page, unresolved static
`aria-labelledby`/`aria-describedby`/`for`/control references, broken local
fragments, and incoherent canonical ownership.

Repaired route behavior:

- AITR direct activity fragments now reveal, scroll to, and focus their target;
- AITR hash changes recover the unfiltered activity list before resolving the
  target;
- Campaigncodex now exposes the two-entry Curriculum maps section that existed
  in its data but had no tab;
- Campaigncodex direct fragments select the target's section, clear stale
  filtering, render the entry, and move keyboard focus to it;
- Leizu's dynamic selection summary always recreates the element named by its
  `aria-labelledby` value; and
- AA's `#mode=pending` remains an application-state fragment, not an element
  fragment, and is tested as such.

WCAG 2.2 is the normative accessibility reference for the semantic and
keyboard checks:
[https://www.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/).

## P0 — browser, responsive, and anti-jerk continuity

The Audit 40 browser contract has two layers.

First, the five inherited Chromium suites are adapted in memory from the
byte-preserved baseline and rerun under the current release ID. They retain
the 624-assertion floor covering Polymythcal interactions, all generated entry
pages, WCAG checks, 11 representative routes at three viewports, recovery
behavior, forced colors, and project failure stress.

Second, a new representative runtime suite covers 12 major routes at desktop
and mobile sizes: home, Teacher Resources, Polymythcal, AA, BB, AITR,
Bookwormcard, Leizu, Saul, Campaigncodex, the Thank You M’am DM board, and
Methodology List. Its 24 route
cases test HTTP success, title and landmark structure, H1 availability,
horizontal overflow, runtime errors, failed local requests, layout stability,
and targeted interactions. Six screenshots preserve repaired deep-link,
Teacher Resources, and mobile DM-board states.

Before the final release stamp, the inherited fresh Chromium suites passed
624 of 624 assertions and the new runtime suite passed 194 of 194 assertions.
The release gate requires all six reports to be regenerated after stamping,
to carry the exact current release timestamp, to be no more than two hours old,
and to retain a combined minimum of 818 assertions.

Layout-shift interpretation follows the Cumulative Layout Shift guidance:
[https://web.dev/articles/cls](https://web.dev/articles/cls).
The automated target is at most 0.1 on every route. Long tasks are measured
and reported as diagnostic evidence; the browser matrix does not pretend that
a single container run is a universal device-performance benchmark.

Playwright's documented browser installation and project model is the basis
for predeploy's clean Chromium setup:
[https://playwright.dev/python/docs/browsers](https://playwright.dev/python/docs/browsers).

## P1 — Methodology List completeness without corpus reduction

Methodology List remains exactly 1,139 entries across 16 static editions.
Three corpus sections that existed in the data and static editions but were
omitted from the interactive section registry are restored:

- CORE history — 18 entries;
- Framework core — 2 entries; and
- Pending user authorship — 2 entries.

All 16 corpus sections plus the Tags index are now pre-rendered as 17 tab
buttons with exact initial counts. Runtime startup hydrates and reuses those
buttons rather than replacing the whole tab row after first paint. The
existing storage migration, local edit, import/export, register cycle, static
editions, and 1,139-entry corpus remain intact.

The Google Fonts declaration was moved from an inline CSS `@import` to a direct
stylesheet link. The maintenance changes remove the page's measured layout
shift on desktop and mobile, including under 4× CPU throttling. Full-payload
virtualization, external-JSON delivery, and server rendering remain held only
as possible ways to address the remaining startup long task; they are not
needed for CLS and were not partially introduced.

## P1 — Teacher Resources interaction and route continuity

Teacher Resources remains exactly 644 resources, 25 collections, and seven
groups. No canonical resource route was removed, hidden behind a 24-item
initial window, or made dependent on JavaScript-only discovery.

Its generated catalog stylesheet references carry the Audit 40 release token.
The existing interactive finder retains live filtering, facets, quick starts,
accessible result counts, Escape-to-reset behavior, all 644 resources, and
the Audit 39 one-cache-per-filter-update efficiency fix. Fresh browser
evidence verifies that a query narrows to one matching resource and Escape
restores all 644. On screens up to 600px, its project navigation now wraps
instead of hiding part of the final route in an unmarked horizontal rail.

Catalog virtualization remains held because rendering only the first subset
would change the current full-catalog delivery and no-JavaScript behavior.

## P1 — project-tool mobile and semantic operability

The Thank You M’am DM board had a severe narrow-screen failure: its fixed
three-column viewport left the center at zero usable width, clipped the right
panel, disabled document scrolling, and exposed 51 generated controls only
through click handlers.

The board now:

- reflows into one column at 900px and below while retaining the desktop
  three-column layout;
- restores vertical document scrolling and removes horizontal clipping;
- emits native buttons for timeline, NPC, map, thread, tool, and layer
  controls;
- exposes selected state with `aria-pressed` where applicable;
- announces the updated active scene;
- opens a named modal dialog with focus inside it;
- traps Tab only while that modal is open; and
- closes on Escape and returns focus to the invoking control.

Fresh Chromium probes at 375px, 768px, and 1,440px found no runtime error or
horizontal overflow. The release browser suite independently repeats the
375px reflow, native-control, keyboard-time-change, modal-focus, Escape, and
focus-return checks.

Leizu's teaching promise is now a note rather than a duplicate complementary
landmark, and its three overview facts form a named list. The local Meaninglib
dashboard no longer autofocuses its query field on load, avoiding an
unrequested focus jump or mobile keyboard opening. Leizu's intentionally
Chinese consultation labels now remain identical through default-language
hydration, so those controls no longer widen after first paint.

## P1 — font, transition, and cache efficiency

Six remaining project pages that loaded Google Fonts through inline
`@import` now use direct stylesheet links. Across the canonical built surface:

- no source HTML, CSS, or JavaScript retains a third-party CSS `@import`;
- every font-bearing page keeps at most one Google Fonts CSS2 request;
- `display=swap` and the existing project-specific font families remain;
- no source HTML, CSS, or JavaScript retains `transition: all`; and
- transitions name the properties that can actually animate.

Route-local code now shares the existing bounded policy of one day plus seven
days of stale-while-revalidate coverage. Added rules cover root CSS, Teacher
Resources CSS/JS, Saul asset CSS/JS, Leizu CSS/JS, Bookwormcard JS, its glossary
JS, and vendor JS. The runtime delivery gate resolves each local CSS/JS
reference against the most specific Netlify rule; its current built-surface
result covers 47 local code assets across 21,037 references and 75
font-bearing pages.

Netlify's `_headers` syntax and wildcard behavior are documented here:
[https://docs.netlify.com/manage/routing/headers/](https://docs.netlify.com/manage/routing/headers/).

## No-backtracking ledger

Audit 39's exact report and gate files are frozen by SHA-256. Its product
figures are historical floors unless explicitly exact:

| Surface | Audit 39 baseline | Audit 40 requirement |
|---|---:|---:|
| Canonical Polymythcal events | 838 | at least 838 |
| Event types | 32 | at least 32 |
| Registered sources | 422 | at least 422 |
| Legacy event recovery aliases | 842 | at least 842 |
| Teacher Resources | 644 / 25 / 7 | exactly 644 / 25 / 7 |
| Methodology List | 1,139 | exactly 1,139 |
| Polymythcal progressive batch | 24 | exactly 24 |
| Portable release gates | 132 | at least 132 |
| Public parity files | 3,550 | at least 3,550 |
| Package members | 7,802 | historical archive fact |
| Inherited browser assertions | 624 | at least 624 |
| Combined Audit 40 browser assertions | — | at least 818 |

The seminar schedule remains Monday/Thursday at 08:47 UTC. The festival
schedule remains Tuesday/Friday at 09:42 UTC. The protest workflow remains an
unsharded, deterministic, paid-agent-free crawl every four hours at :18.

## Final verification contract

The release is blocked until all of the following pass after the Audit 40
stamp:

- the canonical production build and public source parity;
- the complete portable release runner;
- the frozen Audit 39 SHA-256 verifier;
- Audit 39's still-applicable protest, generated-route, runtime, cache, font,
  Methodology, and package-continuity gates;
- Audit 40 content-structure, runtime-efficiency, and evolution gates;
- five current-release inherited Chromium suites;
- the new 24-case Chromium runtime/deep-link/project-tool suite; and
- the fresh Audit 40 browser-evidence verifier.

The report does not count an old release's browser JSON as current evidence.
Each report must carry the current release ID and generated timestamp, contain
only passing assertions, and have a fresh execution timestamp.

## Environment limits

Native VoiceOver and NVDA were not executed in this container. Firefox
downloaded but could not launch under the container's user-namespace/profile
constraints. WebKit downloaded but its host libraries could not be installed
in the read-only system image. These limits are disclosed in the JSON evidence
and are not relabeled as passing native assistive-technology or cross-engine
tests.

They are meaningful remaining external audits:

1. native VoiceOver on macOS;
2. native NVDA on Windows;
3. Firefox on an unrestricted Linux/macOS/Windows host; and
4. WebKit/Safari on a compatible host.

## Direction-level work held for approval

The following remain unimplemented because they change delivery architecture,
content availability, product behavior, cost, or project direction:

1. virtualizing, externalizing, or server-rendering the full Methodology List;
2. rendering only an initial subset of Teacher Resources;
3. introducing a bundler or splitting the large legacy inline project apps;
4. replacing project fonts or imposing one global visual identity;
5. a global navigation or information-architecture rewrite;
6. a true BB session runner;
7. AA result virtualization;
8. full Saul localization;
9. changing Polymythcal scrape frequency, sharding, or paid-agent cost;
10. changing event identity, reschedule, or candidate-publication doctrine;
11. headless-browser/OCR harvesting for client-only or image announcements;
12. recurring iCalendar `RRULE` expansion; and
13. automatic publication from mixed calendars without source-specific event
    classification.

None was partially introduced as maintenance. Each requires an explicit
direction decision before implementation.
