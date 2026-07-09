# Front-facing / anti-yap / redundancy audit — 2026-07-08

## Governing rule added to ML*

Added the Mephistodata rule **Front-facing versus operator-to-AI instruction separation, website-edit boundary rule**.

The rule requires every website edit to classify language before applying it:

- Public-facing copy belongs to visitors, employers, students, parents, readers, and clients.
- Operator-to-AI/build doctrine belongs in code, guards, reports, route logic, exports, and ML*.
- A user instruction such as "make the CV modular" must preserve the hidden modular behavior without turning the public page into a public explanation of the machinery.
- Public labels must describe the work, value, and navigation, not the implementation.

## CV audit and changes

The Saul CV page had mixed the build system with public copy. Public labels such as **Modular CV**, **CV Builder**, **Select the version you need**, **World map**, and **CV modules — PDF follows active modules** were removed from the front-facing surface.

Current public-facing language:

- `Curriculum vitae`
- `Work record across service, education, community, and projects.`
- `Relevant experience`
- `Focus areas`
- `Places behind the work`
- `Work record`
- `Focus filters`
- `Download CV`
- `Download current CV`

Hidden behavior preserved:

- Default CV remains broad.
- Selected focus areas remain targeted.
- Multiple selections combine.
- PDF/export follows the exact selected combination.
- Portrait and map remain website-only.
- Performance remains separate.
- Seminar Schools remains under Portfolio.

## Redundancy audit

Removed the duplicate quick-view/control block from the visible CV archive area. The four public cards now carry the polished front-facing entry points, while the detailed focus filters remain available in a collapsed `Focus filters` panel.

The CV now avoids repeating the same selector logic in multiple visible places.

## Professionalism / anti-yap audit

Changed obvious or internal labels into professional labels:

- `World map` -> `Places behind the work`
- `CV builder` -> `Focus areas`
- `Select the version you need` -> `Relevant experience`
- `CV modules — PDF follows active modules` -> `Focus filters`
- `Save selected CV` -> `Download current CV`

Shortened module-card descriptions so they function as employer-facing summaries rather than explanations of the site logic.

## Whole-site front-facing scan

Audited visible HTML outside framework/operator areas for common AI/build leakage terms and exact regressions:

- `CV builder`
- `Select the version you need`
- `World map`
- `CV modules`
- `Save selected CV`
- `Modular CV`
- `active modules`
- `Build modular CV`
- `Mephistodata-built`
- `Live build target`
- `Send corrections to Rainbowsol`
- `Not student-facing`

The CV page and the Thank You, M'am pregame page were corrected. Framework/project areas such as ML*, dashboards, and HF exports remain allowed to use internal terminology because those routes are themselves operator/framework surfaces.

## Guard added

Added `scripts/verify-front-facing-boundary.js` and wired it into `verify:all` after the Saul page guard.

The guard checks the Saul CV public labels, bans the old visible internal labels, confirms the ML* rule exists, and scans non-framework HTML for exact front-facing/build-doctrine regressions.

## Verification

Passed directly:

- `node scripts/verify-front-facing-boundary.js`
- `node scripts/verify-saul-page.js`
- `node scripts/verify-saul-modular-cv.js`
- `node scripts/verify-saul-print.js`
- `npm run verify:ml-antibacktracking`
- `npm run verify:meaninglib-dataset`
- `npm run verify:meaninglib-search`
- `npm run verify:ai-access-pack`
- `npm run verify:site`
- `npm run verify:professional`
- `npm run verify:seo`
- `npm run verify:search-surface`

The full all-in-one `npm run verify:all` command exceeded the tool timeout during the long combined run. The same checks were completed in split form, including the remaining checks after the timeout point.
