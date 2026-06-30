# CL Self-Guard Completion Report — 2026-06-30

## Decision
The remaining safe CL items were executable without another design decision. I kept the held items parked.

## Completed
1. Expanded `scripts/route-doctrine.json` from a small route list into a v2 doctrine with 61 explicit routes and 5 generated route groups.
2. Replaced the route-doctrine verifier with route-type checks for public, private, generated, archive, tool, service, CV, calendar, game, resource, and campaign routes.
3. Added `scripts/verify-page-size-budget.js` and `scripts/reports/page-size-budget.json` so huge HTML pages are budgeted and future size regressions fail.
4. Added `scripts/verify-generated-route-indexing.js` so generated event/resource pages are either sitemap-indexed or intentionally noindexed.
5. Added `scripts/verify-sitemap-classification.js` so sitemap gaps are classified by reason instead of treated as mystery failures.
6. Added visible archive/tool route notes to dense archive surfaces.
7. Added short route intros where a page purpose was unclear, without expanding public project philosophy.
8. Added Polymythcal loading-state copy and clearer zero-result copy.
9. Added shared keyboard helpers in `js/site-keyboard-enhancements.js`.
10. Added keyboard hints to cloud/graph/map-style pages.
11. Added `scripts/verify-keyboard-navigation.js`.
12. Added `scripts/verify-responsive-regression.js` for source-level 200 percent zoom and mobile contract checks.
13. Added `scripts/verify-saul-print.js` for CV print, zoom, and name-comma regression.
14. Strengthened `/saul/` as a general-employment CV route.
15. Removed remaining `Saul Karim Nassau, MA` title/metadata patterns and kept the visible name line clean.
16. Added `scripts/verify-teacherresources-finder.js` for the quick finder.
17. Added Teacher Resources quick-finder smoke coverage.
18. Added AA* to Polymyth funnel links on all aa* surfaces.
19. Added `scripts/verify-aa-polymyth-funnel.js`.
20. Added `scripts/verify-polymythcal-freshness-labels.js`.
21. Added `scripts/verify-shortcut-title-uniqueness.js`.
22. Added hidden-field scanner logic through `scripts/verify-visible-input-labels.js`.
23. Converted Bookwormcard machine/honeypot fields so hidden form fields stop looking like visible unlabeled fields.
24. Added `scripts/audit-external-links.js` and generated `scripts/reports/external-link-inventory.json`.
25. Added `scripts/verify-dense-anchors.js` for dense archive/catalog anchor integrity.
26. Added `scripts/verify-asset-weights.js` and generated `scripts/reports/asset-weight-report.json`.
27. Added `SITE_HEALTH_DASHBOARD_2026-06-30.md`.
28. Added CL record files in `scripts/audits/`.
29. Added `scripts/audits/PARKED_SUGGESTIONS_2026-06-30.md`.
30. Wired the new guards into `npm run verify:all`.

## Held
1. BB session runner.
2. Public-positioning meta descriptions.
3. Big archive chunking.
4. Major public wording changes to ML*, AA*, polymyth, and CL meanings.

## Verification
`npm run verify:all` passed with exit code 0.

Key new guard output:

```text
ROUTE DOCTRINE CHECK PASSED — 61 explicit routes and 5 route groups governed.
PAGE SIZE BUDGET PASSED — 20 known-heavy pages budgeted; no unbudgeted HTML over 500000 bytes.
GENERATED ROUTE INDEXING PASSED — 1070 generated pages checked, 911 sitemap-indexed, 159 intentionally noindexed.
SITEMAP CLASSIFICATION PASSED — 996 sitemap URLs classified (976 HTML, 19 txt, 1 md, 0 xml, 0 other); 187 non-sitemap HTML routes are intentionally classified.
KEYBOARD NAVIGATION CHECK PASSED — shared helper loaded on 1165 HTML files, dense routes carry keyboard hints.
RESPONSIVE REGRESSION CHECK PASSED — 200 percent zoom and mobile source contracts are present on smoke routes.
SAUL PRINT/CV CHECK PASSED — general CV marker, no comma before MA, print and zoom guards present.
TEACHER RESOURCES FINDER CHECK PASSED — 4 subject, 2 grade, 3 format quick buttons wired.
AA TO POLYMYTH FUNNEL CHECK PASSED — aa* surfaces point to polymorphousmythology.
POLYMYTHCAL FRESHNESS CHECK PASSED — 12 calendar/shortcut surfaces expose freshness labels.
SHORTCUT TITLE UNIQUENESS PASSED — 11 shortcut titles are unique.
VISIBLE INPUT LABEL CHECK PASSED — 39 visible fields checked, 100 hidden/honeypot/machine fields ignored.
DENSE ANCHOR CHECK PASSED — 6 dense pages have intact local anchors or explicit search/dynamic navigation.
ASSET WEIGHT CHECK PASSED — asset report present and no image exceeds 2.5MB.
```

## Deployment
This zip was not deployed.
