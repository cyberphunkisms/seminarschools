# BB* / PolymythDND clarification update report — 2026-06-30

## Ouroborosanalyses result

The earlier failure was a TWIST from website architecture into game architecture. I treated the missing center as a student-facing play screen. The corrected BB grammar is teacher-led, table-first, and curriculum-native.

BookwormBurrows, BB, and PolymythDND are the same game in different registers. The game starts when the Dimensional Master receives the wormcards and the anchor text or campaign. The text becomes the world. The sealed exegesis stays protected. Assignments become quests. AI supports the teacher behind the curtain. Narrative and academic quality stay primary.

## Clarifications installed

1. BB / BookwormBurrows / PolymythDND naming alias.
2. Assignments-as-quests motivation rule.
3. Dimensional Master handoff after wormcard creation.
4. AI as DM table assistant rather than player-facing replacement.
5. No-dice, narrative-first, academic-quality-first resolution.
6. SetupNPC and ImprovNPC taxonomy.
7. Adult seminar mode for independent study motivation.
8. BB next-build list for the upcoming BB-only chat.

## Files changed

### Public BB pages

- `bb/index.html`
- `bb/why/index.html`
- `bb/why/zh/index.html`
- `bookwormcard/index.html`
- `bookwormcard/about/index.html`

These now state that students give wormcards to the Dimensional Master, that BB is teacher-led academic TTRPG play, and that assignments become quests.

### BB rule archive

- `polymyth/bookwormburrows/index.html`
- `polymyth/bookwormburrows.txt`

Added five new BB entries:

- `dm-108` — BB / BookwormBurrows / PolymythDND naming alias and anti-TWIST ruling
- `dm-109` — Assignments-as-quests motivation rule
- `dm-110` — SetupNPC and ImprovNPC taxonomy
- `ses-006` — Adult seminar mode
- `pen-015` — BB* next build list after 2026-06-30 clarification

The plain text mirror now carries 221 entries.

### Campaigncodex

- `polymyth/campaigncodex/index.html`
- `polymyth/campaigncodex.txt`
- `polymyth/campaigncodex/cmp-001-npc-schedule.md`

Added the current campaign ruling: setupnpcs carry pregame learning and assignment structure; improvnpcs populate live play.

### PolymythDND rules

- `polymyth/polymythdnd/ruleset.md`

Updated the ruleset so BB / BookwormBurrows / PolymythDND are treated as the same game and so AI remains the Dimensional Master's table assistant.

### ML* studylist

- `polymyth/methodologylist-studylist.txt`
- `polymyth/methodologylist.txt`
- `polymyth/methodologylist/studylist/index.html`

Added studylist entry 33: `BB* / PolymythDND clarification and next build queue (2026-06-30)`.

### Verification

- `scripts/verify-bb-clarification.js`
- `scripts/verify-bb-final-readiness.js`
- `scripts/verify-bb-kid-friendly.js`
- `package.json`

Added the BB clarification guard and wired it into `npm run verify:all`.

## To-do list now captured in the zip

1. Audit `cmp-001` Thank You M’am assignments for visible in-game motivation.
2. Build an assignment-to-quest template.
3. Separate setupnpcs and improvnpcs across campaign templates.
4. Layer the 221-entry BB archive into teacher manual, AI doctrine, player-facing explanation, mechanics reference, campaign-building rules, design ledger, and unresolved questions.
5. Build adult seminar mode prompts for independent study.
6. Design the DM table assistant after the grammar is stable.
7. Keep the website as support for table play rather than replacing the teacher.

## Full game critique

See `BB_STAR_FULL_GAME_CRITIQUE_2026-06-30.md`.

## Verification plan

Run:

```text
npm run verify:bb-clarification
npm run verify:bb-final
npm run verify:bb-kid
npm run verify:bookwormcard
node bookwormcard/tests/run-tests.js
npm run verify:all
```

## Verification completed

```text
npm run verify:all
exit code 0
```

Key pass:

```text
BB clarification verification passed: alias, wormcards, Dimensional Master, assignments-as-quests, setupnpcs/improvnpcs, adult mode, studylist, and 221-entry mirror checked.
BB final readiness verification passed: local assets, depth engine load, start flow, command controls, save migration, print fallback, and 221-entry library all checked.
BB kid-friendly verification passed: student-facing copy, preserved archive notes, plain-text mirror, landing page, why pages, about/glossary/print copy.
SITE INTEGRITY GUARD: PASS
SEO DEPLOYMENT GUARD: PASS
Bookwormcard gate verification passed.
```
