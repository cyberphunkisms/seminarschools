# Polymythcal Audit 14 completion report

Date: 2026-07-20  
Release state: engineering implementation complete, publication pipeline regenerated, deploy surface rebuilt

## Audit-note completion matrix

| Audit requirement | Completed implementation | Verification evidence |
|---|---|---|
| Dedicated municipal, university, library, festival, French-language, and civic-action adapters | Six adapter profiles in `scripts/polymythcal_adapters.py`; source normalization accepts legacy and canonical fields; manual and discovery sources carry explicit modes; 164 sources use dedicated profiles | 8 adapter tests pass; fixtures cover all six profiles; profile counts: municipal 4, university 44, library 24, festival 81, French-language 1, civic-action 10 |
| Cancellation, disappearance, recurrence, and rescheduling reconciliation | Canonical lifecycle reconciler detects cancelled, postponed, rescheduled, reappeared, and missing-on-source states; retains previous dates; expands RRULE recurrence; disappearance waits for successful source checks and a threshold | 4 lifecycle tests pass; current 513-record rebuild reconciles with zero unexplained changes |
| Typo-tolerant bilingual search | Accent folding, bilingual synonym groups, token normalization, and bounded edit distance operate in the main calendar | Browser test restores `q=montral`, activates Montréal, switches to French, and returns matching listings |
| Shareable URL-backed filters | Query, category, age, corridor focus, view, mode, and language state serialize into the URL; share control uses Web Share or clipboard | Browser test restores URL state; Audit 14 verifier confirms all seven parameters |
| Device-local saved events and saved searches | Local storage collections persist up to 200 events and 30 searches; controls expose pressed and expanded state; saved searches retain their URL query | Browser tests pass for saved events and saved searches |
| Public event submission and correction forms | Netlify-compatible bilingual forms, honeypots, required labels, correction prefill from stable event URLs, and bilingual confirmation route | Form label, landmark, reflow, and prefill checks pass; site-integrity form scan passes |
| Focused RSS and calendar-subscription feeds | 11 bilingual RSS and ICS pairs from the canonical event dataset; public subscription directory; per-event ICS files | 11 focused pairs, 513 event ICS files, bilingual feed inventory complete |
| Holistic translation update | English and French interface dictionary covers the toolbar, generated calendar, status text, navigator, shortcuts, forms, subscription directory, event actions, and language metadata | Translation inventory complete across 5 surfaces, 513 canonical event pages, and 11 feed pairs |
| WCAG 2.2 AA audit and remediation | Keyboard flow, labels, names, skip links, landmarks, French language state, 320 CSS-pixel reflow, reduced motion, forced colours, accessibility tree, forms, saved tools, and stable event pages | 26 of 26 browser-assisted checks pass; 28 of 28 package checks pass |

## Release metrics

- Registered sources: 418
- Sources using dedicated adapter profiles: 164
- Canonical events: 513
- Qualified unconfirmed events: 295
- Canonical stable event pages: 513
- Legacy redirect aliases: 513
- Per-event ICS files: 513
- Focused bilingual RSS/ICS pairs: 11
- Indexable canonical event pages in sitemap: 128
- Sitemap URLs: 906
- Public HTML pages: 1,822
- Generated routes checked: 1,702
- Interactive HTML pages loading the shared keyboard helper: 1,304

## Validation record

- `python3 -m unittest scripts/test_polymythcal_adapters.py` — 8 of 8 pass
- `python3 -m unittest scripts/test_polymythcal_lifecycle.py` — 4 of 4 pass
- `python3 scripts/finalize-polymythcal-publication.py` — pass
- `python3 scripts/validate-polymythcal.py` — 513 canonical records pass
- `node scripts/verify-calendar-data-parity.js` — 513 mirrored entries pass
- `python3 scripts/audit-polymythcal-wcag22.py` — 26 of 26 pass
- `node scripts/verify-polymythcal-audit14.js` — 28 of 28 pass
- Static search-surface, sitemap, keyboard, zoom, responsive, interactivity, geometry, site-integrity, SEO, and generated-indexing gates — pass

## Canonical generator correction

The audit found two generators claiming event-detail HTML. `scripts/build-search-pages.js` now owns server-rendered calendar cards and sitemap route selection. `scripts/build-polymythcal-audit13.py` exclusively owns stable bilingual event pages, legacy aliases, structured data, and per-event ICS files. Rebuild and `--check` now agree.

## Assistive-technology sign-off boundary

Chromium accessibility-tree testing completed and exposed names for every interactive control in the tested surfaces. Native VoiceOver speech, rotor behaviour, and Safari interaction require macOS. Native NVDA speech and browse-mode interaction require Windows. Their complete routes, keystrokes, expected announcements, high-contrast checks, reflow checks, reduced-motion checks, evidence fields, and pass criteria are in `docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md`.

Native execution status recorded in `data/polymythcal-wcag22-browser-audit.json`:

- VoiceOver on macOS: executed `false`, protocol prepared
- NVDA on Windows: executed `false`, protocol prepared

Formal WCAG conformance evaluation combines testable criteria with human evaluation and a defined audit scope. Reference standard and evaluation procedure:

- www.w3.org/TR/WCAG22/
- www.w3.org/WAI/WCAG22/quickref/
- www.w3.org/WAI/test-evaluate/conformance/wcag-em/

## Core source files

- `scripts/polymythcal_adapters.py`
- `scripts/fixtures/polymythcal/`
- `scripts/test_polymythcal_adapters.py`
- `scripts/reconcile_polymythcal_lifecycle.py`
- `scripts/test_polymythcal_lifecycle.py`
- `scripts/finalize-polymythcal-publication.py`
- `scripts/build-polymythcal-audit13.py`
- `scripts/build-polymythcal-feeds.py`
- `scripts/build-polymythcal-translation-inventory.py`
- `scripts/audit-polymythcal-wcag22.py`
- `scripts/verify-polymythcal-audit14.js`
- `js/polymythcal-features.js`
- `css/polymythcal-features.css`
- `polymythseminars/index.html`
- `polymythseminars/submit/index.html`
- `polymythseminars/correct/index.html`
- `polymythseminars/subscribe/index.html`

## Machine-readable evidence

- `AUDIT14_PACKAGE_VERIFICATION_2026-07-20.json`
- `data/polymythcal-wcag22-browser-audit.json`
- `data/polymythcal-translation-inventory.json`
- `data/polymythcal-lifecycle-log.json`
- `POLYMYTHCAL_WCAG22_AA_AUDIT_2026-07-20.md`
- `docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md`
