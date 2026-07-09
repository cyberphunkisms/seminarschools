# Polymythcal scraper and interface update — 2026-07-09

## Anti-twist scope

This update applies the requested Polymythcal scraper/layout work without changing ML*, BB*, AA*, CV doctrine, or public/front-facing rules.

## Scraper upgrades

- Applied the Find a Protest Toronto upgrade patch.
- Added `findaprotest-toronto` as a first-class source.
- Added deterministic Find a Protest parsing with detail-page following.
- Added watchlist handling for source-confirmed leads that lack time/place.
- Kept TBD listings out of the public event feed until they have usable details.
- Preserved the Palestinian Football Exhibit / PYM Toronto / FIFA lead as a watchlist item.
- Added generic category-aware HTML event discovery fallback for HTTP sources that do not have custom fetchers.
- Expanded topic extraction across civic, arts, humanities, education, AI/digital, law/justice, religion, food/hospitality, games/TTRPG, health, and student-writing areas.
- Added festival and lecture/panel type inference so broad cards classify more accurately.
- Preserved the anti-fabrication rule: missing date/time/place cannot be invented.

## Public Polymythcal interface upgrades

- Kept one front-facing search box: `calendarSearch`.
- Removed duplicate/internal search UI (`eventSearch`, `quickFocus`, `polymythcal-tools`).
- Expanded quick filters: Everything, Today, This week, Learning, Arts, Civic, Deadlines, Students, University+, Toronto/GTA, Online.
- Search now scans titles, venues, organizers, source ids, topics, descriptions, raw excerpts, and watchlist leads.
- Source-confirmed leads remain in a separate panel until time/place is confirmed.
- Topic chips on watchlist leads can be clicked to search the calendar.
- Category label `Protest` appears as the more front-facing `Public action`.
- `/` focuses the search box.

## Data/public-build changes

- `data/event-watchlist.json` remains the internal watchlist memory.
- `polymythseminars/watchlist.json` is the public watchlist feed.
- `scripts/sync-calendar-data.js` now refreshes both event and watchlist fallbacks.
- `public/` deploy surface includes the updated calendar, watchlist, and generated route pages.

## Guards added or strengthened

- Added `scripts/verify-polymythcal-scraper-layout.js`.
- Kept `scripts/verify-polymythcal-scraper-ui.js` active.
- Added the new guard to `package.json` and the serial verify chain.
- Existing harvest guard now protects Find a Protest and watchlist support.

## Verification completed

- `python3 -m py_compile scripts/scrape_seminars.py scripts/merge_and_finalize.py`
- `node --check` on extracted inline Polymythcal JavaScript
- `node scripts/verify-polymythcal-scraper-layout.js`
- `node scripts/verify-polymythcal-scraper-ui.js`
- `node scripts/verify-harvest-pipeline.js`
- `node scripts/verify-calendar-data-parity.js`
- `node scripts/verify-polymythcalendar-ux-efficiency.js`
- `node scripts/build-writing-shortcuts.js --check`
- `node scripts/verify-writing-shortcuts.js`
- `node scripts/build-academic-shortcuts.js --check`
- `node scripts/verify-academic-shortcuts.js`
- `node scripts/build-search-pages.js`
- `node scripts/build-public-deploy.js`
- `node scripts/verify-public-artifact-blocks.js`
- `node scripts/verify-site-integrity.js`
- `node scripts/verify-professional-readiness.js`
- `node scripts/verify-seo.js`
- `node scripts/verify-front-facing-boundary.js`
- `node scripts/verify-saul-modular-cv.js`
- `node scripts/verify-saul-print.js`
- `node scripts/scan-private-data.js`

## Deployment note

The one-zip model stays intact. Netlify publishes `public/`; the root archive still carries source, scripts, reports, ML*/BB*/AA* material, and operator files.
