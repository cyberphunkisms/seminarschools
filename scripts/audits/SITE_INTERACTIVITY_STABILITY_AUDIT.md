# Site Interactivity Stability Audit

Scope: whole public site scan plus strict Polymythcal route checks.

Findings addressed:

- Polymythcal shortcut pages used the active route as the visible `<h1>`, which made the title appear to change from page to page.
- Filter clicks re-anchored the internal scrollbox to today after every render, producing a jerky feeling.
- The empty-state action used an inline `onclick`, which made interaction harder to guard.
- The compact instructions existed, but the active description was too subtle and the page identity was unstable.

Fixes applied:

- Every Polymythcal route now keeps the visible title as `Polymythcal`.
- The changing part is now context and description: All Writing, Writing Juniors, University+, Philosophy, CFPs, etc.
- Filter clicks preserve scroll position instead of forcing a jump.
- Initial load can still anchor near today.
- Inline `onclick` is replaced by a delegated data-action handler.
- `scripts/verify-site-interactivity.js` now guards stable title, clear instructions, no Polymythcal inline click handlers, no title mutation, no accidental paste-artifact files, and basic site-wide link/scroll hazards.

Next visual work:

- Continue replacing dense button rows with grouped controls on mobile.
- Keep calendar mode as a date picker + agenda rather than a tiny spreadsheet.
- Review legacy shells with `href="#"` and decide whether each should become a button.
