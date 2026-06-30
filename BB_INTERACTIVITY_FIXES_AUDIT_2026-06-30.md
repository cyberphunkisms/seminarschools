# BB Interactivity Fixes Audit — 2026-06-30

Baseline: `seminarschools-bb-kid-friendly-rewrite.zip`

## Goal

Make the game path intuitive for kids while preserving all BB content, all 216 operations entries, the student-friendly reader layer, and the full teacher/archive notes.

## Fixes applied

### `/bb/`

- Added a visible “How BB is played” sequence.
- Renamed the misleading “Run the game” door to “Teacher rule library.”
- Added a separate future “Start a session” card so the teacher/archive library no longer reads like the playable session screen.
- Kept the kid-friendly path wording and the three major destinations.

### `/bookwormcard/`

- Added a visible start panel above the terminal: “Step 1: make your wormcard.”
- Added a clear play loop: pick text, make card, give both to helper, enter text-world, use evidence, write and grow.
- Added a large “Start my wormcard” button.
- Rewrote the intro from mystical/cinematic wording to explicit kid-facing instructions.
- Rewrote the opening sequence so it explains that the card is for playing inside a book-world.
- Added desktop-visible command buttons: back, skip, why, finish, enter.
- Kept animal previous/next buttons and scoped them to the animal phase.
- Replaced anonymous progress-bar wording with named phases: Animal, Time, Name, Story, People, Deep Questions, Stamps, Review.
- Simplified final save language to one primary action: “Save my wormcard as PDF.”
- Kept secondary actions: edit answers, copy text, print blank card.
- Kept typed commands as shortcuts.

### `/bookwormcard/about/`

- Added the same eight-step “How BB is played” sequence.
- Updated privacy/save language to match current code: checkpoints save in-browser, the finish path opens print/save-as-PDF, and AI reactions are optional.

### `/polymyth/bookwormburrows/`

- Added a visible “How BB is played” sequence at the top of the rule library.
- Kept the student-friendly reader layer first and the full teacher/archive notes inside each entry.
- Moved add/export/import and changelog into a teacher tools drawer.
- Changed search from current-tab search to global search across all sections.
- Added section labels to global search results.
- Kept edit mode available through `?edit=1`.

### Public artifact guard

- Added forced 404 blocks for root audit artifacts so `verify:all` can pass while keeping audit records inside the archive.

## Verification

Passed before final zip:

```text
npm run verify:bb-kid
npm run verify:bookwormcard
npm run verify:site-interactivity
npm run verify:bb-why
node bookwormcard/tests/run-tests.js
npm run verify:all
```
