# Site Beautification + Visible Geometry Pre-Deploy Audit

Date: 2026-06-29
Scope: full Seminar Schools static build represented by `seminarschools-polymythcalendar-ux-efficiency-overhaul.zip`, overlaid with the Saul true modular CV restore patch.

## Executive finding

Do **not** rely on the old geometry gate as proof of visible geometry. It proved that the geometry engine and a subset of pages could mount/move, but the source audit found a different issue: most public HTML pages did not carry the source-level geometry contract, and the key Polymythcal/CV pages relied on low-visibility runtime behavior.

## Geometry source audit

| Check | Before hardening | After hardening |
|---|---:|---:|
| HTML pages scanned | 1166 | 1166 |
| Pages missing `alive.css` + `mandala.js` + `indra.js` includes | 1085 | 0 |
| Engine-included pages with no explicit source layer | 78 | runtime layer required by guard |
| Pages with `printCv` present | 1 | CV no longer disables geometry in `indra.js` |
| Pages missing `data-geometry="indra-web"` | not checked | 0 |
| Pages missing `data-indra-intensity` | not checked | 0 |

## What was wrong with the previous pass

The prior verifier reported `GEOMETRY COMPLETE`, but its own summary separated pages into built/moving pages and `static-search` pages. That meant the guard was too permissive for the ML* rule: a page could pass the site-wide engine invariant without visibly carrying Indra's Web as part of the page experience.

## New visible geometry standard

Every public HTML page must now carry:

```text
/css/alive.css
/js/mandala.js
/js/indra.js
<body data-geometry="indra-web" data-indra-intensity="...">
```

The engine must be allowed to mount on CV pages. Print output hides geometry through CSS rather than disabling it at runtime.

## Page-family beautification audit

### Polymythcal + shortcut pages

Status: **highest priority visual redesign**.

Findings:
- Calendar view is visually dense and hard to scan.
- Month-grid cells truncate titles into fragments.
- Event chips compete with the controls.
- The hierarchy is unclear: page title, category description, filters, and calendar/list modes all visually fight.
- Geometry is present only through a runtime layer and was too subtle to serve as an obvious ML* substrate.

Recommended design:
- Default to list view for usefulness.
- Keep calendar as a date navigator and day/agenda picker, not a miniature spreadsheet.
- Make active section description change while title remains stable.
- Use larger card spacing, clear deadlines, and short official-source links.
- Use Polymythcal-specific geometry intensity: `0.120` on the main calendar and `0.110` on shortcut pages.

### Saul modular CV

Status: **restore before beautifying**.

Findings:
- The page must behave as modular CV versions, not a flattened résumé.
- Category tabs should route the visible CV and the PDF/export state.
- `printCv` previously caused the geometry engine to skip the page entirely.

Recommended design:
- Restore modular tabs and PDF routing.
- Keep profile → current work → modular archive as the page order.
- Use geometry at a readable intensity and hide it only for print.

### Main / homepage / map

Status: **strongest visual system**.

Findings:
- The homepage already has the clearest geometry language.
- It should become the reference style for project pages: visible but readable substrate, clearer cards, calmer labels.

### Teacher Resources

Status: **powerful but too dense**.

Findings:
- The catalog scale is impressive, but browsing needs stronger visual grouping.
- Cards and filters need more whitespace and clearer grade/subject badges.

### Bookwormcard

Status: **visually coherent but dense**.

Findings:
- Distinctive identity is intact.
- Needs progressive disclosure and more consistent mobile spacing.

### Leizu pages

Status: **usable, mostly polished**.

Findings:
- Stronger funnel structure than Polymythcal.
- Keep geometry subtle because forms/payment/booking need clarity.

### Static event/detail pages

Status: **source-level geometry missing before hardening**.

Findings:
- These pages were a major gap in the CL-63 interpretation.
- They now receive the same geometry source contract.
- Next beauty pass should improve event-page cards, back links, source clarity, and related-event links.

## Deployment recommendation

1. Deploy Saul true modular CV restore together with visible-geometry hardening.
2. Run the new `npm run verify:visible-geometry` and full `npm run verify:all` before push.
3. Then redesign Polymythcal calendar view as a separate UX patch.

## New guard added

```text
scripts/verify-visible-geometry.js
npm run verify:visible-geometry
```

This guard is designed to fail when:
- any HTML page lacks the geometry CSS/JS source contract,
- any body lacks geometry markers,
- Saul/CV pages are excluded through `#printCv`,
- the visible geometry layer styling is missing.
