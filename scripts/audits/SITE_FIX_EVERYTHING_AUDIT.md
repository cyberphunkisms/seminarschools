# Site-Wide Fix Everything Audit

Date: 2026-06-29
Scope: full Seminar Schools static build after Saul modular CV restoration, Polymythcal calendar redesign, visible Indra geometry hardening, and UX/performance cleanup.

## Fixed

- Restored Saul's modular CV interface so category tabs behave like CV versions, including PDF/share routing.
- Replaced the unusable tiny Polymythcal month grid with a date navigator plus selected-day agenda.
- Kept List as the useful default view.
- Kept the Polymythcal title stable; contextual descriptions change below it.
- Added compact student-facing instructions and term definitions.
- Added source-level visible geometry contract to every public HTML page.
- Added `scripts/apply-visible-geometry.js` so new scraped/generated pages can be hardened before deploy.
- Strengthened `scripts/verify-visible-geometry.js` and kept it in `npm run verify:all`.
- Preserved ML* geometry: `/css/alive.css`, `/js/mandala.js`, `/js/indra.js`, `data-geometry="indra-web"`, and page intensity markers.

## Remaining design roadmap

- Teacher Resources and Bookwormcard are functional but dense; they should receive their own UI passes later.
- Event detail pages now have geometry but still need richer related-event navigation in a later pass.

## Deployment note

Apply this package to a fresh clone of latest `master`, run `node scripts/apply-visible-geometry.js`, rebuild shortcuts, run `npm.cmd run verify:all`, then push.
