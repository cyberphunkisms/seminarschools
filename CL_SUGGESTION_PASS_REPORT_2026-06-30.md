# CL Suggestion Pass — Navigation, Page Weight, Page Types — 2026-06-30

## Completed
1. Replaced the flat role-strip idea with work-path navigation on `/` and `/main/`.
2. Shortened the `/main/` primary navigation to practical top-level destinations.
3. Added descriptive, sentence-shaped pathway headings instead of staccato labels.
4. Used the pathway cards as the tasteful start-here layer; no broad yapping blocks were added.
5. Reduced generated Polymythcal shortcut page weight by embedding route-specific fallback data while keeping `/polymythseminars/events.json` as the canonical public data file.
6. Kept `/polymythseminars/` with the full inline fallback snapshot because it is the canonical calendar page and critical offline/static fallback.
7. Preserved ML* source-of-truth architecture. The huge `const SEED` pages were not externalized or chunked because those pages are part of how ML* remains loadable for human and AI readers.
8. Added render containment for known-heavy pages through the shared zoom/geometry contract.
9. Added page-type contracts to route doctrine for service, CV, calendar, game, archive, tool, resource-catalog, and campaign pages.
10. Added an explicit anti-TWIST rule to route doctrine.
11. Added verifiers for pathfinder navigation, heavy-page resilience, and page-type contracts.

## Held
1. BB session runner.
2. Public-positioning meta descriptions.
3. Structural ML* chunking or any change that would alter the canonical seed/source relationship.
4. Major public wording changes to ML*, AA*, polymyth, and CL meanings.

## Design decision
The replacement for “I’m a parent / student / teacher” is “start with the work in front of you.” That keeps the site practical without flattening visitors into roles or making the map sound like a generic SaaS homepage.

## Page-weight reduction results
Generated Polymythcal shortcut pages now embed only route-specific fallback data. The canonical event file remains `/polymythseminars/events.json`, and `/polymythseminars/` keeps the full inline fallback for the core calendar.

| Page | Before | After | Saved |
|---|---:|---:|---:|
| `/writingkids/` | 534,285 B | 126,206 B | 408,079 B |
| `/writingjuniors/` | 541,769 B | 141,512 B | 400,257 B |
| `/writingteens/` | 559,125 B | 177,125 B | 382,000 B |
| `/writinggrads/` | 559,693 B | 177,382 B | 382,311 B |
| `/writingclub/` | 562,463 B | 183,952 B | 378,511 B |
| `/university/` | 654,938 B | 370,959 B | 283,979 B |
| `/philosophy/` | 572,005 B | 201,733 B | 370,272 B |
| `/humanities/` | 620,489 B | 301,094 B | 319,395 B |
| `/cfps/` | 612,797 B | 280,280 B | 332,517 B |
| `/lectures/` | 559,052 B | 177,314 B | 381,738 B |
| `/fellowships/` | 564,372 B | 190,139 B | 374,233 B |

Total saved across these generated pages: 4,013,292 bytes.

## Verification
`npm run verify:all` passed with exit code 0 after these changes.
