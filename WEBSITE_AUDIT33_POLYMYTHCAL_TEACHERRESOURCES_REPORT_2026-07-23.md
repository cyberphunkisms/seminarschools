# Seminar Schools website audit 33

Release: `2026-07-23-site-audit33-polymythcal-teacherresources-final`  
Baseline: Audit 32 only  
Scope: Polymythcal discovery and publication, Teacher Resources interaction, whole-site efficiency, typography, copy density, motion stability, accessibility-related operation, build/deploy behavior, and non-security technical correctness.  
Excluded: security audit and security-policy redesign.

## Result

Audit 33 improves the site without changing its direction or removing an accepted Audit 32 behavior. Polymythcal remains the primary project and default home-page jewel; its 838-event canonical calendar is intact. Teacher Resources retains all 644 resources, 25 collections, seven groups, and every existing route. BB, the CV, Agora, AA, Meaninglib, Methodologylist, Leizu, the home/About split, and the Indra/mandala identity retain their accepted roles.

The completed release fixes the scraper’s structural blind spots rather than adding a separate inbox or depending on after-the-fact news. It also makes the Teacher Resources catalog substantially lighter and more useful, tightens shared keyboard and control behavior, and adds an Audit 33 evolution gate to prevent these gains from being silently reversed.

No direction-level choice was needed. The held decisions at the end of this report remain held.

## What the Toronto protest miss actually showed

The earlier approaches were too weak:

- Searching for generic “Toronto protest listings” assumes events are published on protest directories. Many are first announced on an organizer’s campaign, media, news, calendar, union, or public event-platform page.
- News is normally late. It is useful as a retrospective miss benchmark, but it cannot be the primary advance-discovery path. A July 8 Global News report described a CUPE rally after it occurred.
- An external newsletter inbox would create another manual system, move discovery outside Polymythcal, and still miss organizers that do not use newsletters.
- Scraping only visible listing-card HTML misses ICS/RSS feeds, WordPress APIs, JSON-LD detail pages, sitemaps, multi-location campaign pages, and client-rendered listings.
- Treating an HTTP 200 with no parsed events as “empty” conceals parser breakage, bot challenges, and JavaScript shells.

The source evidence supports an organizer-first approach. Environmental Defence published a July 15 advisory with two Toronto actions on July 23 and 26. ONA published River Run in June for a September march while the exact assembly location was still pending. Those are precisely the pages Polymythcal should discover early and publish with explicit uncertainty, rather than waiting for a news recap.

Benchmark references:

- [Environmental Defence advance advisory](https://environmentaldefence.ca/2026/07/15/advisory-toronto-residents-rally-against-jets-proposed-island-airport-expansion/)
- [ONA River Run 2026 announcement](https://ona.org/news/river-run-2026/)
- [Global News retrospective CUPE rally report](https://globalnews.ca/news/11958595/ontario-cupe-doug-ford-protest/)

## Polymythcal discovery and publication

### Organizer-first source coverage

- The canonical registry now contains 422 sources, up from Audit 32’s 418.
- Sixteen enabled protest sources run every four hours without sharding. They include organizer and campaign surfaces for labour, public health, housing, climate, Indigenous solidarity, student, and anti-austerity actions.
- Two official corroboration sources—the Toronto Police Service releases feed and City road-restriction data—can confirm time or route evidence but cannot invent an organizer or cause.
- Forty-one enabled tier-one non-protest sources use the same deterministic discovery layer. The improvement therefore applies to lectures, workshops, readings, screenings, performances, festivals, exhibitions, calls, contests, and other qualifying event families rather than becoming Toronto-protest-only code.

### Broader deterministic extraction

The shared crawler now supports:

- HTML listings and detail pages;
- JSON-LD Event records;
- ICS calendars;
- RSS and Atom feeds;
- XML sitemaps;
- pagination and “next” links;
- WordPress REST posts and The Events Calendar endpoints;
- bounded public-platform handoffs for Action Network, Eventbrite, Mobilize, Meetup, Lu.ma, Humanitix, Zeffy, Ticket Tailor, Universe, and organizer Linktree pages;
- multi-location campaign pages;
- configured alternate, news, media, and calendar routes;
- bounded JavaScript fallbacks when a public source returns a shell instead of records.

Source and event semantics are kept separate. A publisher is not silently promoted to organizer, publication dates do not replace event dates, and screenings still require evidence that the named creator or participant will attend.

### Publish early without pretending certainty

A public event with a real event date can enter Polymythcal even when its start time, assembly location, or organizer detail is missing. The record carries:

- confirmation and lifecycle status;
- explicit qualification reasons and missing details;
- original source URL and announcement excerpt;
- first-seen and last-checked timestamps;
- a four-hour recheck while incomplete;
- a stable public ID through later detail upgrades;
- previous-date history when an organizer reschedules it.

One failed fetch does not delete an event. Two successful authoritative absences are required before an event becomes `missing-on-source`.

### Failure visibility and false-empty prevention

- A blank HTTP 200 is now `parse-empty-regression`, not “no events.”
- A realistic non-empty JavaScript loading shell queues bounded fallbacks.
- An empty result is authoritative only when the source affirmatively says there are no events or returns a structurally empty feed/API response.
- Challenge pages, fetch errors, parser regressions, HTTP status, page yield, and last successful extraction remain visible in source-health output.
- Crawl depth, page count, elapsed time, request timeout, and worker count are bounded.

### Occurrence identity and reschedules

Stable UID and canonical-URL aliases reconcile representations of the same event, while the public identity includes the occurrence date/recurrence discriminator and venue. This prevents:

- two sessions with the same title on the same day from collapsing;
- recurring events sharing one feed UID from overwriting one another;
- a richer detail page from becoming a duplicate of its listing-card version.

A unique publisher reschedule still refreshes the existing public record in place and records its previous date.

### Deterministic results survive optional-agent failure

The scheduled general harvest now publishes and validates both deterministic streams before attempting to install or run the optional agent. Agent installation/version failures are bounded and non-blocking; deterministic merge or validation failures remain release-blocking. A failed optional stage can no longer discard already discovered public events.

## Polymythcal browser efficiency

The canonical `events.json` remains the full source for feeds, detail pages, and validation. Calendar browsing now loads `browse.json`, which preserves all 838 IDs in exact canonical order and all 32 event types:

| Payload | Raw bytes | Gzip bytes |
|---|---:|---:|
| Canonical `events.json` | 1,547,027 | 125,327 |
| Browser `browse.json` | 770,887 | 85,429 |
| Reduction | 50.17% | 31.84% |

The search-first UI, initial batch of 24, focused-route restrictions, truth labels, event source links, bilingual feed/detail infrastructure, and exact source/public parity remain intact.

## Teacher Resources

The catalog’s content and route identity are unchanged: 644 resources, 25 collections, seven groups, and 678 Teacher Resources HTML routes.

### Faster first load

- The main HTML fell from 787,139 bytes to 412,136 bytes, a 47.64% reduction.
- Current Teacher Resources HTML/CSS/JavaScript totals 60,228 bytes compressed.
- Data needed for interaction is consolidated without deleting a resource or changing its semantic card content.

### Better interaction

- Accent-insensitive, unordered multi-word search;
- strict combinable subject, grade, format, province, and program facets;
- useful quick-start presets;
- compact active-filter and result summaries;
- shareable URL state, copy-link action, and print action;
- saved state with migration from the Audit 32 key;
- `/` to focus search and `Escape` to clear or close;
- accurate “Expand all” state and small-result auto-opening;
- mobile filter disclosure with correct ARIA state;
- print output restricted to the currently visible groups, collections, and resources.

The updated verifier proves all facet counts against the source dataset and rejects duplicate IDs, broken ARIA references, duplicate chips, route loss, or resource loss.

## Whole-site design, copy-density, and motion refinements

- Removed the render-blocking Google Fonts `@import` from shared CSS. Pages using the shared main stylesheet load DM Sans and JetBrains Mono from the document head.
- Cache-busted changed shared typography, theme, type-size, and keyboard assets with the Audit 33 release token.
- Raised shared theme, type-size, search-clear, calendar, and Saul controls to a 44 px interaction floor.
- At narrow widths and high zoom, type-size and theme controls move to opposite safe-area corners instead of overlapping the masthead.
- Shared keyboard navigation yields to controls that already handled the key, ignores modified arrow keys, and does not hijack arrows inside interactive elements.
- Teacher controls remain sticky but clear the shared masthead.
- Copy additions are task guidance, status, or failure explanation. The release does not add promotional filler or long initial-page exposition.

Audit 32’s calm-before-paint behavior, no smooth scrolling, reduced-motion contract, bounded mandala/Indra rendering, 15.5 px type floor, no-horizontal-overflow contract, mobile project web, and reserved dynamic-layout space remain unchanged.

## Cross-project audit

- Home and About: Polymythcal remains primary; the overview/immersive split is preserved; About still loads only the compact featured feed.
- BB/bookwormburrows: current gameplay, mediator, paper-play, and AI-assisted workflow remain intact; no automatic session runner was added.
- Saul/CV: existing modular routes, print behavior, visual identity, and motion limits remain intact.
- Agora, AA, Polymyth, Methodologylist, Leizu, Campaigncodex, Meaninglib, and the remaining routes retain their accepted structure. Shared keyboard, typography, zoom, cache, and public-build checks cover them without rewriting project identities.
- Meaninglib Dashboard remains source-only and absent from `public/`.

## Verification evidence

- Python Polymythcal suites: 69 tests passed, including six deterministic-before-agent workflow tests.
- JavaScript occurrence merge: distinct sessions, recurring UIDs, and unique reschedules passed.
- Independent post-fix harvest review: all six release blockers cleared.
- Canonical validation: 838 records, 595 qualified unconfirmed records, 422 sources.
- Calendar data parity: 838 byte-synchronized mirrored entries.
- Polymythcal Audit 14: 28 of 28 checks passed.
- Browser payload: 838 IDs and 32 types preserved.
- Teacher Resources: 644 exact resource cards and 678 exact routes preserved; targeted interaction, responsive, keyboard, facet, URL-state, and ARIA checks passed.
- Audit 33 evolution guard: Audit 32 direction locks, data floors, asset stamps, control geometry, workflow ordering, source counts, Teacher counts, compact payload parity, and report/ledger completion are release blockers.
- Portable whole-site release suite: 102 of 102 checks passed.
- The canonical build regenerates `public/`; deployer packaging verifies every public file against its source twin before writing the ZIP.

Strict Playwright interaction and WCAG browser audits remain CI gates because a local Chromium executable was unavailable in this workspace. Source, DOM, unit, schema, build, parity, and portable whole-site release gates run locally.

## Honest boundary

Polymythcal can comprehensively improve discovery across the public web, but no scraper can guarantee events that exist only in private chats, closed groups, unindexed social posts, or invitation-only systems. The new design makes public-source coverage broader and failures observable. It does not claim that a live scheduled harvest has already run after deployment; the workflow will exercise the new source set on its next scheduled or manual run.

## Direction-level choices deliberately held

- Meaninglib Dashboard remains local/source-only.
- The archival source PDFs remain packaged.
- Indra and mandala remain the visual identity.
- Calm professional mode remains the default.
- The synchronized mobile home map/carousel remains the accepted model.
- The home overview and immersive About remain separate.
- The current calendar information architecture remains intact.
- Netlify `public/` remains the deployment contract.

## Deploy

1. Unzip the package.
2. Run `npm ci`.
3. Run `npm run build`.
4. Run `npm run verify:all`.
5. Deploy `public/`. The included Netlify configuration already uses that contract.
