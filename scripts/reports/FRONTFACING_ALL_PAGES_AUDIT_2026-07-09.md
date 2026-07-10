# Front-facing audit, BB teacher workflow pass, 2026-07-09

## Scope

Audited all HTML route classes in the full site package after the BB and CV updates.

- Total index routes checked in source tree: 1050
- General public routes scanned by public-copy boundary guard: 997
- Star and internal framework routes separated from public-copy scan: 53
- Non-sitemap HTML routes intentionally classified by noindex or route type: 158
- Sitemap URLs verified: 912

## CV finding

Core Signals was removed from the CV output. The active public heading is Key Skills. The old label sounded like project-internal vocabulary. Key Skills matches hiring-reader expectations and is guarded by `scripts/verify-saul-modular-cv.js`.

## BB front-facing finding

The BB landing page and Bookwormcard pages had copy that explained the operating machinery to an AI or to the site builder. That material now lives in BB* and ML* where it can stay useful as doctrine and operating rules. Public pages now speak to teachers, students, and families.

## Pages patched

### `/bb/`

The public BB page now presents BB as a teacher-led academic reading game.

Front-facing copy now says:

- choose the anchor text
- make wormcards
- give the wormcards to the Dimensional Master
- open the burrow
- turn assignments into quests
- let work quality shape consequence
- let time matter
- record the adventure as learning

The former Future DM table assistant card was rewritten as a teacher manual workflow card. It now says BB runs from text and PDF materials, the anchor text, player wormcards, paper notes, a document, or the teacher's chosen AI tool.

### `/bookwormcard/`

The public card builder now sends the saved card to the Dimensional Master. The static context keeps privacy and data notes in human-facing wording and removes stale AI-function phrasing.

### `/bookwormcard/about/`

The about page now explains BB as a text-world game. It routes teacher workflow to the BB plain-text manual and teacher workflow page. The old bootstrap copy block and copy script were removed from visible and source page copy.

### `/polymyth/dmboard/`

The old scaffold page became a teacher workflow page. It explains manual setup with the anchor text, wormcards, BB teacher manual, paper notes, documents, and the teacher's chosen AI tool. The route remains noindex because it is a workflow support page rather than a public SEO page.

## Material moved into star files

### BB*

Added and regenerated:

- `dm-112` teacher manual workflow rule
- `dm-113` front-facing BB copy law

BB* now stores the operating rule that BB is a text and PDF based teacher workflow. It also stores the rule that public pages invite play, while star files hold setup machinery.

### ML*

Added and regenerated:

- July 9 2026 full front-facing audit learning

ML* now stores the boundary rule that human pages speak to humans, and AI or operator instructions belong in star files, teacher notes, scripts, or internal reports.

## Design and copy rule created

Public pages should say what a visitor can do.

Star files should say how the machinery works.

Teacher pages should explain portable workflows.

AI bootstrap language belongs in BB*, ML*, scripts, and reports.

## Verification

```text
FRONT-FACING BOUNDARY CHECK PASSED — public pages audited outside star/internal routes.
VERIFY ALL FAST PASSED — 77/77 checks in 18.4s.
```
