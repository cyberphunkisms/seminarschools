# Website Audit 45 — Full Translation Implementation

Release: `2026-07-25-site-audit45-full-translation-localization-final`  
Date: 2026-07-25  
Scope: translation architecture, localized routes, source-language semantics, interaction, layout, continuity, and release governance. No security audit was performed.

## Outcome

Audit 44’s translation recommendations are implemented without reducing any established content, source, route, or cadence floor.

- Polymythcal retains 838 events, 32 types, and 422 sources.
- Teacher Resources retains 644 resources.
- Methodology retains 1,139 entries.
- Every scheduled content and link workflow remains exactly once weekly.
- BB remains teacher-led; no site-owned session runner was added.

## Implemented surfaces

### Leizu

Leizu now has dedicated French, Traditional Chinese, Simplified Chinese, and Persian URLs for its homepage and nine local funnel routes. Language selection is path-aware and persistent, internal links stay inside the selected-language funnel, Persian uses correct RTL geometry, and local/native fallback fonts prevent font delivery from blocking layout.

English remains the contractual source of truth. High-stakes policy, intake, donation, teaching, and booking-confirmation translations are visibly bounded reference translations and remain `noindex` until bilingual review. Their forms submit the selected language. Lower-risk owned copy is indexable.

### Polymythcal

Polymythcal now has a complete French interface and utility layer:

- main browser;
- 11 focused calendars;
- all 838 event detail routes;
- submission, correction, subscription, and confirmation flows.

Organizer titles and descriptions are never silently machine-translated. The original wording is preserved, its source language is declared, and French interface copy surrounds it with an explicit boundary. English and French event pages have reciprocal canonicals and `hreflang` links. A single path-aware preference key replaces competing language state.

### Saul

Saul’s career archive now has dedicated French, Traditional Chinese, Simplified Chinese, and Persian routes. Persian centering and RTL behavior are corrected. Missing localized archive records, dates, and stale claims were repaired. Application CVs and PDFs remain explicitly marked as English.

### Teacher Resources

Teacher Resources remains intentionally English, while all 644 records now carry source-language semantics. Language is visible, searchable, filterable, shareable in the URL, persisted with the other finder filters, and emitted in `LearningResource.inLanguage` schema. Multilingual records retain all declared languages.

### BB

BB’s existing Simplified Chinese Why essay now has corrected language tags, skip text, return navigation, references heading, reference-level English boundaries, canonical alternates, footer behavior, and CJK fallback fonts. Translation was not expanded to the rest of BB in this release.

### Shared governance

Every localized route is tied to its English source by SHA-256, locale, and review status. The canonical build regenerates the language model, localized routes, interface dictionaries, public deployment, and translation evidence in a fixed order. Audit 43’s historical evidence is frozen separately so current generation cannot rewrite it.

### Release hardening

- Teacher Resources’ expanded language filtering remains below its established budgets: 445,506 HTML bytes and 64,923 gzip bytes across route HTML, CSS, and JavaScript.
- The build-only Teacher Resources dataset is no longer copied into production.
- All dedicated localized Leizu compositions have narrow page-size ceilings.
- The complete bilingual Polymythcal controller is 102,426 bytes uncompressed and 27,104 bytes gzip, with a narrow explicit asset ceiling.
- Polymythcal submission, correction, subscription, and confirmation routes now retain the shared typography, keyboard, metadata, and localized-footer contracts after every rebuild.
- Organizer-supplied titles, descriptions, venues, and related-listing names remain outside authored-copy rewriting and register rules.
- The sitemap contains 939 unique classified URLs.

## Verification

- Static Audit 45 translation gate: 18,421/18,421 assertions passed.
- Fresh Chromium translation and interaction audit: 127/127 checks passed across 11 route/viewport samples, with 11 screenshots.
- Browser-evidence integrity gate: 107/107 assertions passed, including 11 hashed screenshots.
- Full inherited and current release stack: 140/140 gates passed.
- Public deploy parity: 4,452 allowlisted source files plus the generated release marker, 4,453 public files total.
- Public asset budget: 107,898,474 bytes; every unbudgeted asset remains below its type ceiling.
- Preserved inventories: 838 Polymythcal events, 32 event types, 422 sources, 644 Teacher Resources, and 1,139 Methodology entries.
- Polymythcal and all other scheduled content/link workflows remain exactly once weekly.

No organizer copy was silently translated. High-stakes Leizu reference translations remain visibly bilingual and `noindex` until human bilingual review; this is the approved publication rule, not an unfinished implementation.

Native VoiceOver, NVDA, Firefox, Safari/WebKit, physical-device, and real-user validation remain external device checks because those environments are not available in this container. No security audit was performed.
