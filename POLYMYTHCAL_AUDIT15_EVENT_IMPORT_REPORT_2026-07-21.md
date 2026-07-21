# PolymythCAL Audit 15 event research merge

Date: 2026-07-21  
Baseline: `ss-site-polymythcal-audit14-complete-2026-07-20.zip`  
Release state: research events merged, publication rebuilt, deployment verified

## Import result

- Baseline canonical events: 513
- Baseline upcoming events from July 21, 2026: 244
- Research records reviewed: 349
- Verified specific research events: 327
- Source-calendar placeholders retained for adapter work and excluded as events: 22
- Existing duplicate excluded: 1
- Net-new events imported: 326
- Final canonical events: 839
- Final upcoming events from July 21, 2026: 570
- Imported cities and areas: 26

## Truth handling

- Fully confirmed imported listings with published time and venue: 25
- Qualified imported listings: 301
- Listings carrying `time-unconfirmed`: 211
- Listings carrying `location-unconfirmed`: 298
- Explicitly French records: 24
- Explicitly bilingual records: 13
- Records whose research did not specify a language and therefore use `und`: 289

No missing time, venue, or language was inferred. Every imported event preserves its official source URL and research ID.

## Rebuilt publication surface

- Stable canonical event pages: 839
- Legacy redirect aliases: 839
- Individual ICS files: 839
- Focused bilingual RSS/ICS feed pairs: 11
- Indexable canonical event pages: 153
- Sitemap URLs: 931
- Deployed HTML pages: 2474

## Lifecycle correction

Repeated occurrences sharing the same title and source can no longer inherit one rescheduled-event ID. Fallback rescheduling matches now require a unique previous occurrence and a unique current occurrence. Equivalent ISO timestamps with and without seconds compare as the same moment. Two regression tests were added, increasing the lifecycle suite from four to six tests.

## Validation

- Adapter tests: 8 of 8 pass
- Lifecycle tests: 6 of 6 pass
- Canonical validation: pass
- Canonical, master, and public deploy parity: pass
- Search surface and sitemap: pass
- Site integrity across 2,474 deployed HTML pages: pass
- SEO and generated-route indexing: pass
- Keyboard, responsive, zoom, geometry, and interactivity gates: pass
- Browser-assisted WCAG 2.2 AA audit: 26 of 26 pass
- Audit 14 structural verifier after expansion: 28 of 28 pass

Native VoiceOver and NVDA execution remains governed by the existing macOS and Windows protocol in `docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md`.

## Retained research queue

The 22 high-volume calendar/feed records remain in `data/research/polymythcal-2026-07-21/` as adapter targets. They were kept out of the public event corpus because they represent sources rather than events.

## Machine-readable evidence

- `POLYMYTHCAL_AUDIT15_EVENT_IMPORT_VERIFICATION_2026-07-21.json`
- `POLYMYTHCAL_EVENT_IMPORT_VERIFICATION_2026-07-21.json`
- `AUDIT14_PACKAGE_VERIFICATION_2026-07-20.json`
- `data/polymythcal-wcag22-browser-audit.json`
- `data/polymythcal-build-manifest.json`
- `data/polymythcal-lifecycle-log.json`
