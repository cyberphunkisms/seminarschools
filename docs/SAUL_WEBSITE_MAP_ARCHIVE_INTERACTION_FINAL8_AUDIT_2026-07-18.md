# Saul Website Map, Archive, and Interaction Final8 Audit

**Release ID:** `2026-07-18-map-archive-interaction-final8`  
**Baseline:** `ss-site-performance-cv-synthesis-final7-audited-2026-07-18.zip`  
**Date:** 2026-07-18

## Decisions carried forward from the earlier website conversation

- The web CV remains visual, modular, geometric, and mildly spectral.
- The application PDFs remain professional, monochrome, extractable, and free of website-only decoration.
- `/saul/` remains the canonical complete CV surface.
- Every focused route uses the same modular CV card and canonical data rather than becoming a disconnected résumé page.
- Focus areas remain additive and shareable through URL state.
- The portrait and geographic map remain website-only evidence.
- Performance stays distinct while relevant credits can appear in Arts and Culture, Teaching, and the complete record.
- Project material remains gated behind the Project selection and excluded from ordinary professional outputs.
- Geometry communicates relation, movement, return, and synthesis rather than functioning as a generic background texture.
- The release remains a full deployable site rather than a partial Saul-only patch.

## Implemented revisions

### Focused CV routes

- Replaced the browser-default “Same visual system” block with a designed geometric archive bridge.
- Added two clear 44px actions for the complete CV and map.
- Added a current-view panel that retains the selected focus context.
- Matched the bridge width, colour state, spacing, typography, border system, and geometry to the modular CV card.
- Applied the bridge to all 12 focused CV routes and the hospitality route.

### Main Saul CV

- Kept the map immediately after the modular CV card.
- Rebuilt the map as a two-part section with a framed interactive map and an accessible companion panel.
- Added archive-linked location threads for teaching and study, community and service, hospitality, stage and screen, and independent projects.
- Added a full-map action and a text location list.
- Added a sticky local navigator for CV, Map, Timeline, Education, and Methods.
- Added scroll-state indication to the local navigator.
- Added URL-persisted archive filters through the `archive=` query parameter.
- Added accurate archive result counts after section visibility rules are applied.
- Converted archive periods into open native `details` groups so visitors can collapse long sections while all content remains available.
- Added a return-to-current-focus control after the archive.

### Modular CV interaction

- Added selection counts for additive focus combinations.
- Added specific profile language for important two-focus combinations and a more coherent multi-focus fallback.
- Added share confirmation through an accessible live region.
- Added map loading state handling.
- Raised important controls and actions to a 44px minimum target.
- Added restrained hover and selected-state movement with reduced-motion support.
- Preserved deterministic focused routes and generated outputs.

### Print and machine readability

- Removed duplicate print experience from the ordinary document tree.
- Stored print records in an inert `template` and creates the print copy only during the print lifecycle.
- Preserved the professional PDF hierarchy, ATS outputs, plain-text outputs, one-page rules, and project gating.
- Preserved GEICO as the sole commercial credit and removed TELUS completely.

### Geometry and design

- Connected the spectrum, local navigation, map frame, archive groups, and focused-route bridge through one geometric system.
- Used orbit, node, curve, and returning-line forms to structure transitions.
- Kept decorative geometry outside pointer interaction and the accessibility tree.
- Reduced geometry on narrow screens and under reduced-motion preferences.
- Preserved the existing site spirit and avoided replacing it with a generic corporate template.

### Main Seminar Schools page

- Consolidated the competing Google Fonts requests into one deliberate homepage type system.
- Increased fixed type-size controls from 30px to 44px.
- Preserved the existing threshold, section order, public service hierarchy, and deeper project pathways.

### Accessibility and integrity repairs

- Extended skip links across the previously identified public routes.
- Left the Google verification file unchanged because it is a verification token rather than a navigable page.
- Converted in-place anchor controls to native buttons where appropriate.
- Added direct accessible names to Bookwormcard textareas.
- Added a label to the dashboard filter.
- Repaired the booking and Stripe fallback links.
- Removed the broken internal dashboard privacy-report link.
- Added explicit dimensions to every image missing them.
- Preserved canonical and robots metadata ordering required by the existing static release guards.
- Added a dedicated Final8 release verifier and integrated it into the full release gate.

## Release verification

- **Full release gate:** 85 of 85 checks passed.
- **Source HTML pages:** 1,067.
- **Public mirror HTML pages:** 1,067.
- **Literal static `href="#"` placeholders:** 0.
- **Images missing explicit dimensions:** 0.
- **Interactive map iframes:** 1, with a descriptive title.
- **Professional and ATS role PDFs:** 24 total, all covered by the one-page professional PDF gate.
- **Canonical generator durability:** confirmed by regenerating the full Saul CV system, applying the Final8 post-build polish automatically, rebuilding generated shortcuts, and rerunning all 85 release checks.
- **Source and public deployment parity:** confirmed by `build-public-deploy` and the site-integrity release gate.
- **TELUS references in the Saul CV and canonical data:** 0.
- **GEICO credit:** present and synchronized.

## Deliberate map boundary

The Google My Maps iframe retains native pan, zoom, and pin interaction. Browser cross-origin rules prevent the parent CV controls from filtering the internal Google map directly. Final8 connects the map to archive filters through accessible companion links. A future fully synchronized map would require a locally rendered SVG, MapLibre, or Leaflet implementation with local location data.

## Deployment

Upload the contents of the enclosed `meaninglib_work` folder using the same full-site deployment process as the prior audited releases. The ZIP contains the source tree, public mirror, canonical CV data, generated focused routes, professional outputs, release scripts, and the new Final8 audit gate.
