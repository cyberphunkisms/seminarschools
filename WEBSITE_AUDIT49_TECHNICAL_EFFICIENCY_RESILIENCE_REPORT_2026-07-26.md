# Website Audit 49 — Technical Efficiency and Resilience

Release: `2026-07-28-site-audit53-shared-discovery-teacherresources-polymythcal-commons-final`
Asset version: `20260728-audit53`
Package version: `1.0.6`
Status: PASS

## Outcome

All locally executable Audit 49 work is complete and release-blocking evidence is current. The active metadata, crawl, runtime, build, CI, packaging, translation-governance, cadence, and inherited machine-validation contracts pass together.

This is a code, evidence, and release-orchestration audit. It does not represent a deployment. No security audit was performed.

## Aggregate evidence

| Surface | Result | Current evidence |
| --- | ---: | --- |
| Active HTML | 3,749 documents | 3,749 byte-identical public mirrors; 2,859 interactive; 890 redirects |
| Crawl/indexing | 1,218 indexable / 2,531 noindex | 1,238 sitemap URLs; 5,430 hreflang links |
| Structured data | 2,616 JSON-LD blocks | 1,230 documents; 1 declared indexable exemption |
| Runtime lifecycle | 10 interval files | 10 bounded routes; 45 bounded startup timer slots |
| Static-data delivery | 24 assets | 9.45 MiB under explicit bounded cache policies; 0 forced revalidations |
| Package resilience | 10 regressions | 2→1 archive source-read passes; compatible SHA-256 retained |
| CI/deployer work | 2→1 canonical Linux builds | duplicate deployer parity scans and browser gates reduced to zero |
| Audit 48 machine evidence | 857 calendars / 4,172 parsed VEVENT representations | 24 intended engine scenarios; 0 runtime engine checks honestly recorded |

The aggregate reads the component metrics directly from the JSON reports. It does not repeat their expensive repository walks.

## What Audit 49 changed

### Metadata, crawl surface, and generated-page ownership

- Added one repository-wide classifier for interactive versus redirect HTML, index/noindex state, title, description, viewport, canonical, robots, JSON-LD, hreflang, sitemap membership, source/public parity, and page-size distribution.
- Corrected metadata ownership at generators so rebuilds preserve the fix: localized Leizu funnel summaries, French event date titles, French calendar shells, teacher-resource category pages, the BB landing title, calendar legacy aliases, and intentional WebPage schema coverage.
- Closed every recorded metadata issue group at zero across 3,749 active source documents and the same number of public mirrors.
- Retained 1 indexable schema gap because it is exactly matched by 1 declared historical-archive exemption.

Google documents robots directives, canonical signals, localized alternates, sitemaps, and structured data at the official references listed below. Audit 49 treats those signals as one coherent contract rather than five unrelated spot checks.

### Runtime lifecycle and caching

- Inventoried every active repeating browser timer. The only remaining intervals are the 10 intentional Leizu ambient-leaf intervals across English, French, Traditional Chinese, Simplified Chinese, and Persian landing/teaching routes.
- Those intervals stop on hidden pages, navigation, reduced-motion, and calm states; clear pending startup timers and animated nodes; and restart only after an eligible back-forward-cache restoration.
- Bound 24 large public data assets (9.45 MiB) to explicit browser and edge cache policies, while removing redundant forced revalidation from Florilegium and Polymythcal candidate fetches.

The runtime decisions follow HTTP cache semantics, the Page Visibility lifecycle, and animation-frame scheduling references cited below.

### Verification, build, CI, and packaging

- Every release-runner command has a 600,000 ms upper bound, and a prerequisite failure writes a fresh failed report instead of leaving stale passing evidence.
- The public builder and package writer use recoverable exclusive locks. Package inputs reject duplicates, symlinks, escaping paths, output-transaction artifacts, and files that mutate during archive creation.
- Archive creation moved from 2 source reads per member to 1 while retaining the compatibility SHA-256 `c722e42d278abd6c3f97c3c13907fc62896bea169184c1e72fe03445bae1c3be`.
- Shared top-down selection enforces dependency and generated-directory pruning before descent; the committed report is independent of whether those disposable directories happen to exist locally.
- The deployer selection retained 10,963 files; the source package retained 6,068 files.
- Linux performs the canonical full audit once. Windows and macOS retain portable coverage, and the deployer inherits runner-owned parity/browser gates instead of repeating them.
- Metadata-aware Audit 49 successors preserve the frozen Audit 36 assertions while excluding inert non-JavaScript script payloads from inline-code analysis.

## Page-size distribution

The permanent ceilings are 4 MiB raw and 1,280 KiB gzip. Current maxima are 3.84 MiB raw and 1.17 MiB gzip.

| Route | Raw bytes | Gzip bytes | Indexable |
| --- | ---: | ---: | :---: |
| `/polymyth/methodologylist/` | 4,023,829 | 1,230,073 | yes |
| `/polymyth/methodologylist/methodology/` | 1,922,333 | 602,885 | yes |
| `/aa/` | 1,522,167 | 244,638 | yes |
| `/aa/cloud/` | 1,331,281 | 289,940 | no |
| `/polymyth/campaigncodex/` | 1,033,533 | 333,638 | yes |
| `/polymyth/bookwormburrows/` | 610,461 | 210,556 | yes |
| `/polymyth/methodologylist/citation/` | 586,706 | 133,629 | yes |
| `/polymyth/methodologylist/gorgonification/` | 445,990 | 133,136 | yes |
| `/teacherresources/` | 445,468 | 53,756 | yes |
| `/polymyth/modulecanon/` | 393,701 | 113,448 | yes |

These are governed outliers, not unexamined omissions. The two Methodology pages remain the strongest future candidates for structural payload splitting, but both remain under the release ceilings.

## Preserved product and governance boundaries

- English remains the translation source of truth.
- Organizer-authored titles and descriptions remain verbatim, visibly source-language bounded, and are never silently translated.
- All 20 high-stakes Leizu intake, booking-confirmation, policy, donation, and teaching routes remain `noindex,follow` until bilingual review. Each route retains its governed English-source SHA-256.
- BB remains teacher-led and does not add a site-owned session runner.
- Content harvesting, protest harvesting, festival harvesting, link auditing, and dependency health each remain exactly once weekly at their approved cron.
- Frozen Audit 37 through Audit 43 gates remain active. Audit 49 does not rewrite historical evidence.

## Audit 48 external-validation continuity

Audit 48 machine evidence remains passing: 857 calendar files, 4,172 parsed event representations, 200 live-source bindings, and 219 bounded unique requests.

The following rows remain external-only and are not represented as completed:

- branded Firefox validation
- native macOS Safari and VoiceOver validation
- Windows NVDA with Firefox and Chrome
- physical iPhone and Android validation
- real-user task completion and comprehension session
- Google Calendar, Apple Calendar, and Outlook account imports
- post-deploy calendar subscription refresh
- reachable protest-source browser/OCR validation
- authorized festival paid-agent execution

The zero cross-engine runtime count is intentional and honest: the portable program exists, but this workspace did not execute branded Firefox, native Safari, VoiceOver, NVDA, or physical-device validation.

## Release wiring

- The canonical build stamps Audit 49 before localized routes bind English-source hashes, applies translation UI before metadata hygiene, builds the public mirror, and runs the three component gates in dependency order.
- Reuse-build mode refreshes the three component reports without repeating the canonical build.
- The sequential runner refreshes Audit 48 external evidence and only then evaluates this aggregate.
- Release gates, predeploy checks, deployer packaging, source packaging, and predeploy artifact upload require the exact Audit 49 verifier, JSON reports, and this Markdown report.

## Verification artifacts

- `scripts/reports/audit49-metadata-surface.json`
- `scripts/reports/audit49-runtime-efficiency.json`
- `scripts/reports/audit49-build-packaging-efficiency.json`
- `scripts/reports/audit49-technical-efficiency.json`
- `scripts/reports/audit48-external-validation.json` (Audit 48 schema/program rebound to Audit 49; external-only rows preserved)

Run the aggregate with:

```sh
npm run verify:audit49-technical-efficiency
```

## Explicit limits

- No security audit was performed.
- No deployment was performed or claimed.
- Passing local automation does not substitute for the external-only native-browser, assistive-technology, physical-device, vendor-account, real-user, reachable protest browser/OCR, authorized festival paid-agent, or post-deployment work listed above.

## References

- robots meta directives: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- canonical URL signals: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- localized versions and hreflang: https://developers.google.com/search/docs/specialty/international/localized-versions
- sitemap construction: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- structured-data fundamentals: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- HTTP caching semantics: https://www.rfc-editor.org/rfc/rfc9111
- page visibility lifecycle: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- animation-frame scheduling: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- bounded child-process execution: https://nodejs.org/api/child_process.html
- ZIP archive implementation reference: https://docs.python.org/3/library/zipfile.html
- iCalendar interoperability: https://www.rfc-editor.org/rfc/rfc5545
- Playwright browser coverage: https://playwright.dev/docs/browsers
- native VoiceOver reference: https://support.apple.com/guide/voiceover/welcome-voic010/mac
- native NVDA reference: https://download.nvaccess.org/documentation/en/userGuide.html
- Google Calendar import reference: https://support.google.com/calendar/answer/37118?hl=en
- Apple Calendar import reference: https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac
- Outlook import and subscription reference: https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c
