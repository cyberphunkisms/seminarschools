# Website Audit 46

## Technical efficiency, rollover, and runtime smoothness

Release `2026-07-26-site-audit46-technical-efficiency-rollover-final`

Audit date `2026-07-26`

## Completion status

The locally executable Audit 42 through Audit 45 queue is complete. Audit 42 closed the inherited ledger. Audit 43 implemented the approved evolution direction while retaining weekly harvest cadence and the BB teacher-led boundary. Audit 45 implemented the authorized translation and localization work.

Audit 46 found and fixed ten additional technical-efficiency defects. The canonical build, complete release runner, translation gate, public parity gate, rollover simulation, and deterministic package tests now pass.

Seven validations remain external because this workspace cannot truthfully execute them.

1. Native Firefox review
2. Native Safari and WebKit review
3. VoiceOver review
4. NVDA review
5. Physical-device review
6. Real-user observation
7. A successful live scheduled harvest run

The preserved Audit 45 Chromium evidence remains integrity-checked and inherited. Predeploy CI is configured to create fresh current-release Chromium evidence. This report does not relabel inherited evidence as a new browser run.

No security audit was performed.

## Findings implemented

| Quantity | Finding | Implementation |
|---:|---|---|
| 1 | Shared asset regression | Removed duplicate Audit 43 stylesheet and reader-controller requests by pathname and added a canonical normalization gate. |
| 1 | Frozen build date | Changed the default calendar day to the current Toronto date and retained `SITE_BUILD_DATE` as the deterministic override. |
| 620 | Expired bilingual routes | Required archived, noindex English and French routes, removed active Event schema, and excluded them from the sitemap. |
| 903 | Repeated geometry writes | Added a final-linked-stylesheet guard so already-canonical pages are not rewritten. |
| 8 | Repeated utility-page writes | Aligned generated Audit 43 and calm stylesheet boundaries with the frozen postprocessor. |
| 12 | Cloud controllers | Coalesced pointer, touch, and wheel changes into animation-frame updates, cached canvas geometry, invalidated on viewport changes, and cancelled pending work on exit. |
| 1 | Package integrity path | Streamed source members and combined ZIP size, CRC, and SHA verification into one archive pass. |
| 5 | Redundant npm installs | Reduced predeploy to one locked install and added a production-function import smoke test. |
| 1 | Large concordance index | Added a one-day cache window with a seven-day stale-while-revalidate allowance. |
| 82 | Redirect overlaps | Confirmed every overlap is compatible and added a force, destination, and status coherence gate. |

`requestAnimationFrame` schedules work before repaint and normally tracks the display refresh rate, which supports the one-frame input coalescing used by the cloud controllers. [www.developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

Netlify documents that `stale-while-revalidate` can serve cached content immediately while refreshing it in the background. [www.docs.netlify.com/build/caching/caching-overview](https://docs.netlify.com/build/caching/caching-overview/#stale-while-revalidate-directive)

Netlify also documents that forced rules override file shadowing, so redirect force and status must remain coherent across configuration surfaces. [www.docs.netlify.com/manage/routing/redirects/redirect-options](https://docs.netlify.com/manage/routing/redirects/redirect-options/#force-redirects)

Google requires structured event dates in the documented date format and defines how status changes retain or update those dates. Expired local archive pages therefore do not present themselves as active Event entities. [www.developers.google.com/search/docs/appearance/structured-data/event](https://developers.google.com/search/docs/appearance/structured-data/event#structured-data-type-definitions)

Netlify supports exact Node selection through `NODE_VERSION` or `.nvmrc` and warns that local and hosted versions should match. It also accepts an exact `NPM_VERSION`. [www.docs.netlify.com/build/configure-builds/manage-dependencies](https://docs.netlify.com/build/configure-builds/manage-dependencies/#node-js-and-javascript)

## Verification evidence

| Gate | Result |
|---|---:|
| Complete release runner | 144 of 144 passed |
| Audit 45 translation assertions | 18,421 of 18,421 passed |
| Audit 45 browser-evidence integrity assertions | 109 of 109 passed |
| Inherited Chromium checks | 127 passed |
| Hashed browser screenshots | 11 verified |
| Audit 46 source HTML | 3,372 checked |
| Audit 46 public HTML | 3,372 checked |
| Shared stylesheet references across source and public | 6,744 canonical, 0 duplicate |
| Reader-controller references across source and public | 12 canonical, 0 duplicate |
| Calm-link rewrites required | 0 |
| Audit 45 UI rewrites required | 0 |
| Public parity | 4,452 allowlisted files byte-identical |
| Total public artifact | 4,453 files, 107,394,041 bytes |
| Deployer archive surface | 9,967 files, 9,900 release floor |
| Calendar records | 838 events, 32 types, 422 sources |
| Rollover state | 310 archived, 60 indexable, 842 aliases, 60 sitemap events |
| Teacher Resources | 644 preserved |
| Methodology records | 1,139 preserved |
| Weekly schedules | 3 preserved, each exactly once weekly |

The final canonical build required zero geometry, Audit 43, shared-normalization, and Audit 45 HTML writes. A full-tree SHA-256 before and after that build was identical.

`35f20f65ced9972333e895995731112efbb8809e1676613697b3380e18db01f6`

The package-integrity implementation retained byte-identical deterministic output on a 35.36 MB fixture. Its measured verification path changed from 1.118 seconds and 89,488 KB peak RSS to 1.056 seconds and 23,624 KB peak RSS. That is approximately 5.5 percent faster with 73.6 percent lower peak memory. All six package-integrity tests passed.

## Preserved product boundaries

1. Seminar, festival, and protest harvests remain exactly once weekly.
2. BB remains teacher-led and has no site-owned session runner.
3. English remains the versioned source of truth for translation governance.
4. Organizer-authored event copy remains verbatim with visible source-language boundaries.
5. High-stakes Leizu translations remain bilingual and noindex pending human review.
6. Audit 43 frozen evidence remains byte-locked.
7. Audit 45 visual assets retain their existing asset version because Audit 46 changes technical delivery and generation behavior.
