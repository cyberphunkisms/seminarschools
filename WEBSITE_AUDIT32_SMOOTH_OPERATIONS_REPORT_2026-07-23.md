# Seminar Schools website audit 32

Release: `2026-07-23-site-audit32-smooth-operations-final`  
Scope: efficiency, design, copy density, motion stability, accessibility-related operation, build/deploy behavior, and non-security technical correctness.  
Excluded: security audit and security-policy redesign.

## Result

The site is regenerated, deployable, and release-gated. The final canonical build produces zero source updates, the deploy tree matches its source twins, and the portable release suite passes 97 of 97 checks.

## Whole-site repairs

- Calm mode is set before first paint. Shared reveals, descent effects, party mode, Saul camera motion, Leizu ambient motion, and other decorative movement now respect calm or reduced-motion state.
- The shared mandala camera no longer runs a permanent animation loop. It updates once in calm mode; in active mode it settles for at most 520 ms, stops when converged, and cancels while the page is hidden.
- Shared Indra geometry caches its viewport class and avoids unnecessary rebuilds during same-width-class resizes.
- CSS and JavaScript smooth scrolling were removed from active routes. Fixed and sticky controls use reserved space, dynamic count labels have stable width, and mobile controls meet the 44 px coarse-pointer floor.
- Authored contextual footers are preserved. The canonical Seminar Schools footer is appended once, with current project names and routes.
- Saved text size now uses a CSS variable with a 15.5 px floor instead of restoring an obsolete 13.6 px inline size.
- The local preview no longer needs Vite or its dependency tree. `npm run dev` uses the repository’s small static server and works with the preview runner.
- `_redirects` no longer contains duplicate source rules. Integrity checks now reject future duplicates.
- The public build has a live asset-weight report. CSS and JavaScript receive short reusable caching; images and archives receive long caching; calendar data keeps shorter freshness windows.

## Project improvements

### Home and About

- Polymythcal remains the primary action and default jewel.
- Visible legacy “Polymythcalendar” labels were standardized to “Polymythcal”; legacy URLs still resolve.
- The simple home overview remains distinct from the immersive About narrative.
- About now exposes Teacher Resources alongside the other projects.
- About loads `featured.json` (17,598 bytes) instead of the full `events.json` (1,547,027 bytes), a 98.9% transfer reduction for that module.
- The teaser truthfully describes the next six chronological Polymythcal listings within 90 days and tells visitors to verify the official source.

### Polymythcal

- Search is first, results initially render in batches of 24, and focused calendars omit incompatible choices instead of showing impossible presets.
- Focused routes have correct canonical/Open Graph metadata, route-specific defaults, concise context, human labels, and no redundant self-link.
- Desktop count changes reserve width. Mobile calendar tools wrap without an inner horizontal scrollbar; the filter drawer starts closed and the result bar remains reachable.
- Event lifecycle reconciliation conservatively collapses only overlapping same-title/same-city shadows involving a generic or unconfirmed venue.
- The real 839-to-838 reconciliation is logged. Manual supersession, source-yield detection, blank-city handling, mixed timezone dates, chained legacy IDs, and previous-record reintroduction are covered by regression tests.
- All 838 canonical events retain stable detail pages. There are 842 alias pages, including four repaired historical routes for the collapsed listing.
- The release manifest is the only source for the Polymythcal asset token, preventing generator/verifier stamp drift.

### Teacher Resources

- Invalid main/catalog containment was repaired and the search field remains readable in dark mode.
- Browser facets now resolve every live subject, format, and curriculum code across all 644 embedded entries, including Sciences, Computer Science, French, Atlantic curriculum, French Lesson, Museum Lesson, and Indigenous PDF.
- Generated search/detail routes use the same labels. Generic “Classroom fit” filler is omitted when there is no genuine note.

### bookwormburrows

- The wormcard action and Dimensional Master workflow appear before explanatory material.
- The play guide is five direct steps, preserves the human mediator, makes the AI-assisted workflow explicit, retains paper play, and keeps the no-dice/assignment-to-quest logic.
- Mobile cards stack cleanly with stable backgrounds and reachable text-size controls.

### Agora, AA, Polymyth, and Methodologylist

- Agora now gives one coherent joining path: no application or fee, with dates and access delivered through the announcement list. Its About link now goes to `/about/`.
- AA’s long synthesis is collapsed behind a short introduction. The initial taxonomy count is correctly 404, pending-mode hashes initialize correctly, and the empty removed-entry audit widget stays hidden.
- Polymyth’s activation is two direct steps; etymology/background is optional, and a main-site exit prevents navigation trapping.
- Methodologylist starts with the searchable register. The AI map and section index are collapsed, no-JavaScript counts are accurate, and raw `pending-user-authorship` labels are humanized.

### Leizu and Saul

- Leizu HTML nesting, modal hiding/inert state, focus trapping/restoration, interval cleanup, and calm/reduced-motion gating were repaired.
- Rendered QA found and fixed a pricing-panel translation lookup that previously threw during language initialization.
- Saul’s visual CV retains its identity while shared reveals and camera motion are disabled in calm mode; resize work is bounded and print behavior remains intact.

## Technical and deploy repairs

- Invalid nesting and duplicate runtime IDs were repaired on core Leizu, Methodologylist, and Campaigncodex surfaces.
- Dashboard/Meaninglib remains available in the source package but is excluded from `public/` and the public sitemap.
- Python browser-audit dependencies are pinned and preflighted. The default 97-check suite is portable; the strict browser audit remains a separate CI gate.
- Canonical generators are side-effect-free when imported and converge with zero source changes on a clean rerun.
- The deployer-compatible packager now runs: canonical build → full 97-check verification → source/public parity → ZIP creation.
- Packaging excludes `node_modules`, repository metadata, generated work directories, and the output archive itself.

## Verification evidence

- Canonical unit tests: 22 passed (14 lifecycle and 8 adapter tests).
- Polymythcal Audit 14: 28 of 28 passed.
- Portable whole-site release suite: 97 of 97 passed.
- Calendar validation: 838 canonical records, 418 registered sources, 595 qualified unconfirmed listings.
- Search generation: 676 resource routes, 65 indexable event routes, 16 methodology sections, 843 sitemap URLs.
- Public deploy: 3,543 files, 93,856,257 bytes; 2,475 public HTML pages plus one intentionally local-only Dashboard source page.
- Rendered QA: 11 primary routes at 1,363 px and 390 px widths; no page-level horizontal overflow, duplicate IDs, duplicate shared footers, or new site console errors.

## Direction-level choices deliberately held

No direction-level change was made without approval. These choices remain available for a later decision:

- Keep Meaninglib Dashboard local-only or make it a public product.
- Retain the two archival source PDFs (35,587,348 bytes combined), remove them, or move them to separate storage.
- Keep or replace the Indra/mandala visual identity.
- Keep About party mode disabled under calm professional mode or restore a visitor-facing cinematic mode.
- Keep or redesign the home page’s mobile map/carousel model.
- Keep the current calendar information architecture or begin a broader redesign/holistic translation pass.

## Deploy

1. Unzip the package.
2. Run `npm ci`.
3. Run `npm run build`.
4. Run `npm run verify:all`.
5. Deploy with `public/` as the publish directory. The included Netlify configuration already uses that contract.
