# Polymythcal UX and Efficiency Overhaul Audit

Date: 2026-06-29

## Scope

Updated the Polymythcal calendar and all shortcut pages.

## Changes

- Replaced the wordy guide with a compact how-to block.
- Added a small active description line that changes with the selected filter or shortcut.
- Kept page titles stable while descriptions explain the current view.
- Added descriptions back into JavaScript-rendered event cards.
- Replaced repeated smooth-scroll timers with one cancelable requestAnimationFrame anchor.
- Removed whole-page jump behavior from event-tag clicks.
- Added card styling, line-clamped summaries, calmer filter pills, and scroll-shell polish.
- Added content-visibility hints for long event lists.
- Preserved mandala.js, indra.js, alive.css, and verify-geometry.js coverage.
- Added verify-polymythcalendar-ux-efficiency.js to the full verification chain.

## Guard

`npm run verify:all` now includes a Polymythcal UX/Efficiency check covering the twelve calendar and shortcut pages.
