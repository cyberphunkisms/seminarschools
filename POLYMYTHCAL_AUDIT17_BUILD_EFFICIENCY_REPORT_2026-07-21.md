# PolymythCAL Audit 17 — Netlify Build and Package Efficiency

## Netlify failure repaired

The calendar revamp intentionally removed the legacy `#eventsContainer` and loads the canonical event corpus from `/polymythseminars/events.json`. `scripts/build-search-pages.js` still required the old mount and threw `Calendar event injection point is missing` before the remaining Netlify commands could run.

The builder now supports both contracts:

- legacy calendar pages may receive server-rendered cards through `#eventsContainer`
- the current PolymythCAL client shell uses `#pmEventList`, `polymythcal-revamp.js`, the canonical JSON endpoint, stable event pages, feeds, and the sitemap

The current shell remains 25,059 bytes. The build no longer reinserts 839 cards into the main page.

## Additional failures found during the full audit

1. `build-writing-shortcuts.js` was reading the main PolymythCAL page as the template for every writing route. A build therefore replaced `/writingclub/`, `/writingkids/`, `/writingjuniors/`, `/writingteens/`, and `/writinggrads/` with copies of the main calendar. Their canonical URLs and dedicated interaction code broke.
2. The writing builder now edits each route’s own dedicated template and links directly to stable event IDs.
3. `apply-sitewide-type-zoom-link.js` rewrote every HTML file even when its stylesheet link was already correct. The pass now leaves correct files byte-identical.
4. A fast final build gate now runs inside the Netlify command and checks the client-shell contract, page weight, 839-event corpus, five writing entry points, source/public parity, typography-pass idempotence, and the prior privacy removals.

## Why the privacy-cleaned ZIP became larger

The privacy cleanup removed a very small amount of text. Comparing Audit 16 before and after cleanup showed:

- compressed file payload became 44,577 bytes smaller
- ZIP container and entry metadata became 1,719,226 bytes larger
- total ZIP size therefore increased by 1,674,649 bytes

The larger download came from the archive-writing method and metadata overhead, rather than additional website content. The two cleanup reports added only 856 compressed bytes.

## Package efficiency decision

The earlier ZIP bundled the entire generated `public/` directory even though:

- `.gitignore` already excludes `public/`
- Netlify creates `public/` during every build
- the clean build regenerates 3,540 public files from source in 1.32 seconds

The Audit 17 distribution is a Netlify source package. It omits `public/`, local logs, secrets, caches, and two byte-identical legacy operator copies. It retains all source content, 839 event records, stable event pages, feeds, lifecycle data, Meaninglib, the private Hugging Face export, build scripts, tests, and reports.

Raw footprint before packaging:

- source retained in package: 165,781,513 bytes across 4,046 files before report additions
- generated public mirror omitted: 95,129,994 bytes across 3,540 files
- Meaninglib/Hugging Face export retained: 53,624,371 bytes
- Polymyth source archive retained: 63,705,154 bytes

The resulting source ZIP is approximately 75.3 MB, around 44% smaller than the 134.6 MB privacy-cleaned ZIP.

## Build and regression results

- exact Netlify command passed from a clean directory with no pre-existing `public/`
- clean build time: 1.32 seconds
- second consecutive build: zero source rewrites
- search-surface generation and check passed
- five writing shortcut builds and checks passed
- 28 of 28 clarity checks passed
- 91 of 91 interaction and design checks passed
- site integrity passed across 2,474 public HTML pages
- SEO passed across 931 sitemap URLs
- keyboard navigation passed across 1,630 interactive pages
- responsive, visible-geometry, site-interactivity, and sitemap-classification gates passed
- targeted privacy regression scan passed
