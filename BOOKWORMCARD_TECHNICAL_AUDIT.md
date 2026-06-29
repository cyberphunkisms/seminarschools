# Bookwormcard Technical Audit and Fix Pass

Date: 2026-06-28
Site area: `/bookwormcard/`
Build source: latest Seminar Schools archive with Netlify registry fix, GitHub Actions Claude CLI fix, polymythcalendar backbone, and typography/control fixes.

## Purpose alignment

Bookwormcard is now treated as the BookwormBurrows character gate rather than a standalone novelty app. The public page explains that BB is the game and Bookwormcard is the identity-building entry surface that produces a portable wormcard.

## Fixes implemented

### Crawlable and no-JavaScript content

- Added a static, crawler-readable section to `/bookwormcard/`.
- The static section explains the BB relationship, what the card makes, sample prompts, controls, privacy/data behavior, and links to `/bb/`, `/bookwormcard/about/`, `/bookwormcard/glossary/`, and `/bookwormcard/print/?blank=1`.
- The static section is hidden only after the runtime adds `body.game-ready`, so a failed script load leaves helpful content visible instead of an empty shell.
- Replaced the preview fallback text from `building...` to `your wormcard preview will build here.`

### ESL mode

- Made the ESL button visible.
- Added a real ESL helper layer that displays plain-language helper text underneath questions while ESL mode is active.
- Added helper copy for the major entry prompts and a safe generic fallback for open-ended questions.
- Simplified placeholder prompts when ESL mode is active.

### Light/dark and high contrast

- Added a direct Bookwormcard light/dark button.
- Kept high contrast as a separate `HC` button.
- Synced Bookwormcard theme state with the sitewide `ss-theme` and Leizu `leizu-theme` keys where possible.
- Added light-mode CSS variables to Bookwormcard's custom terminal interface.

### Text size and accessibility

- Preserved the existing A− and A+ controls and added clearer visual states.
- Updated the input label to describe the current Bookwormcard response context.
- Added a screen-reader status region for display-control changes.
- Reduced the desktop layout's dependence on fixed `100vh` and page-level `overflow:hidden`, replacing it with `100svh`/scroll-safe behavior.

### Privacy and data clarity

- Added a visible static data note before play.
- The note explains browser checkpoint storage, optional AI function calls, and PDF/print output.
- The static command for disabling the AI reaction layer is now documented before play.

### Structured data

- Added `WebApplication` JSON-LD for Bookwormcard.
- Linked it as part of BookwormBurrows and described its educational uses.

## Verification added

Added `scripts/verify-bookwormcard-gate.js` and wired it into `npm run verify:all`.

The new gate checks:

- static BB context exists outside a `noscript`-only fallback
- static context links to BB, about, glossary, and blank-card routes
- privacy/data note is present
- ESL button is visible and wired
- ESL helper behavior exists
- light/dark and high-contrast controls are separate
- text-size controls remain wired
- app shell avoids the global `100vh`/`overflow:hidden` trap
- preview fallback no longer says only `building...`
- input label is contextual
- WebApplication schema is present
- the static command is surfaced before play

## Full verification result

`npm run verify:all` passed after the Bookwormcard repair.

Summary from the final suite:

- 1,103 HTML pages checked
- 76 JavaScript files checked
- 149 redirect rules checked
- 979 sitemap URLs checked
- crawlability/search-surface checks passed
- polymythcalendar checks passed
- GitHub harvest-pipeline checks passed
- Leizu localization and control checks passed
- site integrity and SEO checks passed
- typography/control inventory passed
- Bookwormcard gate verification passed

## Files changed in this pass

- `bookwormcard/index.html`
- `scripts/verify-bookwormcard-gate.js`
- `package.json`
- `BOOKWORMCARD_TECHNICAL_AUDIT.md`
