# Saul true modular CV restore audit

Restores `/saul/` as a modular CV instrument rather than a flattened résumé page.

## Preserved and strengthened

- Visible CV section buttons are open by default: All, Culinary Hospitality, Teaching, Community, Education, Volunteer, Performance, Seminar Schools.
- A module status line explains that `Save as PDF` exports the selected version.
- Category tab clicks now behave like CV versions: one selected category produces one focused CV.
- Quick views still support useful combinations, including Current Work and Teaching + Education.
- The PDF path still builds from live state using `buildPrintCv()` and `window.print()`.
- Category-specific summaries, competencies, credentials, and entries are preserved.
- Share links still encode the selected module path.
- Geometry stays present through mandala/indra/alive includes and the normal verify-geometry chain.

## Guard strengthened

`scripts/verify-saul-page.js` now checks for visible module tabs, module status, PDF-state coupling, and per-module PDF routing.
