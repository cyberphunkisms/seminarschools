# Whole-site front-facing/resource audit — 2026-07-08

Scope: all public non-star surfaces. Excluded star/internal framework surfaces: `polymyth/`, `aa/`, `bb/`, `bookwormcard/`, `dashboard/`, and `hf_export/`.

## Changes made

- Removed the redundant standalone `Thank You Ma’am Teaching Activities` teacher-resource group.
- Confirmed its 75 resources already live inside ordinary resource categories, mainly ELA and History.
- Deleted `/teacherresources/lang-hughes/` generated pages and removed them from sitemap output.
- Added legacy redirects from `/teacherresources/lang-hughes/` and its children back to `/teacherresources/`.
- Updated the generated teacher-resource copy so collection pages say what they are instead of explaining that they are static/crawlable pages.
- Removed repeated generated wording such as “selected for grades…” and duplicate category descriptions.
- Renamed front-facing resource categories where the old label was too narrow:
  - `American Short Stories` → `American Literature`
  - `U.S. Primary Sources` → `U.S. History & Primary Sources`
- Added missing front-facing labels for formats and subjects used by the resources: `Lesson Page`, `Lesson PDF`, `Government Resource`, `Teacher Guide`, `Interdisciplinary`, and `Arts`.
- Cleaned visible non-star route/tool leakage on `aitr/` and `nutrition/`.
- Sanitized calendar shortcut language from “verify” to visitor-facing confirmation language.
- Added/kept a guard so the retired Thank You Ma’am standalone route cannot silently return.

## Front-facing boundary result

Clean across the non-star page set for these visible leakage patterns:

- `static collection page`
- `route is a working tool`
- `CV builder`
- `Select the version you need`
- `CV modules`
- `Save selected CV`
- `World map`
- `Thank You Ma’am Teaching Activities`
- `Exempt from anti-yap`
- `operator-to-AI instruction`
- `Mephistodata-built`
- `selected for grades`

## Resource reorganization result

`Thank You Ma’am` no longer operates as a top-level teacher-resource category. It appears where it belongs:

- ELA source text and literary teaching links live under English Language Arts.
- Writing tasks live under Writing Resources.
- Harlem, Hughes, radio, Apollo, Schomburg, and related historical context live under History.
- Interactive campaign links remain discoverable through the ordinary resource categories and the campaign route.

## Verification

Passed:

- `node scripts/verify-front-facing-boundary.js`
- `node scripts/build-search-pages.js --check`
- `node scripts/build-academic-shortcuts.js --check`
- `node scripts/build-writing-shortcuts.js --check`
- `node scripts/verify-teacherresources-finder.js`
- `node scripts/verify-generated-route-indexing.js`
- `node scripts/verify-sitemap-classification.js`
- `node scripts/verify-professional-readiness.js`
- `node scripts/verify-seo.js`
- remaining split verification checks after the long combined verify timed out near the end of its chain

`npm run verify:all` advanced through the long guard chain and failed first on a missing asset report, which was then regenerated and verified. The final remaining checks were run in split form and passed.
