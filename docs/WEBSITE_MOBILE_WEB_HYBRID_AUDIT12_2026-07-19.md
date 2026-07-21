# Mobile Project Web Synchronized Hybrid — Audit12

Date: 2026-07-19
Release: `2026-07-19-mobile-web-hybrid-audit12`
Baseline: Audit11

## Implemented interaction

The phone layout keeps the geometric project web and the named horizontal rail visible together. Every selection now moves through one shared state.

- Tapping a map node selects the matching rail button and project card.
- Tapping a rail button selects the matching map node and project card.
- The active rail button moves into the centre of the horizontal rail.
- The mobile SVG recentres around the selected project and the Seminar Schools core, preserving the connecting geometry.
- Selecting Seminar Schools restores the whole-web overview.
- The selected project label and the Seminar Schools anchor remain readable on the web.
- The map hint displays the plain-language project category and position in the ten-project web.
- Map touch targets expand on phones and return to their original desktop radius above 720 pixels.
- Arrow keys, Home, and End move through the project rail with one roving tab stop.
- Reduced-motion preferences replace animated recentering and rail movement with immediate state changes.
- Desktop map dimensions, labels, hover behaviour, active card, and geometry remain unchanged.

## Anti-backtracking

Audit12 is the final post-build migration. Audit11 hands forward to Audit12 when run directly, and the canonical CV builder runs Final8, Final9, Audit10, Audit11, then Audit12. The Audit12 verifier blocks releases that lose the shared map/rail state, mobile recentering, active-project rail centring, keyboard model, reduced-motion handling, completed CL state, or public mirror.

## Remaining focused passes

- CL-WEB-201 — Polymythcal calendar improvement.
- CL-WEB-202 — Holistic translation update.
- CL-WEB-203 — Whole-site WCAG 2.2 AA accessibility audit.

## Verification

- Central release runner: 89 of 89 gates passed.
- Browser interaction audit: 24 of 24 checks passed.
- Tested widths: 320 pixels, 390 pixels, and 1440 pixels.
- Tested state: reduced motion.
- Tested overflow: zero horizontal overflow at all representative widths.
- Canonical CV rebuild: Final8, Final9, Audit10, Audit11, and Audit12 completed in order.
