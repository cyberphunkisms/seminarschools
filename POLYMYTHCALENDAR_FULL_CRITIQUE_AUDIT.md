# polymythcalendar full critique audit

Date: 2026-06-28
Scope: current `seminarschools-polymythcalendar-writing-shortcuts` working tree after the youth-writing competitions and one-slash shortcut routes were added.

## Executive status

The current working tree is deployable after the second audit pass.

Verified now:

- `npm run verify:all` passes.
- `node scripts/verify-writing-shortcuts.js` passes.
- `node scripts/verify-search-surface.js` passes after regenerating the static search-surface manifest.
- Calendar data parity passes with 470 mirrored calendar records.
- The writing shortcut pages exist, are in `sitemap.xml`, have slashless redirects, have route-specific canonical/schema URLs, and render filtered static HTML lists without requiring JavaScript.

## Release blockers found and fixed in this pass

### 1. Search-surface manifest was stale

Before the rebuild, the search-surface manifest expected 979 sitemap URLs while the current sitemap contained the five writing shortcut URLs as well. The regenerated manifest now matches the current sitemap.

Current check:

```text
SEARCH SURFACE CHECK PASSED — 719 catalog resources, 267 current event cards, 15 methodology sections, 982 sitemap URLs.
```

Files touched:

- `scripts/search-surface-manifest.json`
- `sitemap.xml`
- `scripts/build-search-pages.js`

### 2. Writing tabs existed as routes but were not visible enough

The earlier shortcut routes worked by URL, but the calendar UI still made users rely on hidden route logic. This pass added a visible writing shortcut row:

- Club
- Kids
- Juniors
- Teens
- Grads

Files touched:

- `polymythseminars/index.html`
- `writingclub/index.html`
- `writingkids/index.html`
- `writingjuniors/index.html`
- `writingteens/index.html`
- `writinggrads/index.html`

### 3. Writing-band filtering was too fuzzy

The phrase `grades 1-12 pathway` was present as a generic secondary type on researched entries. Because filtering read secondary type text, some high-school-only contests leaked into younger pages. The fix added explicit `writing_bands` data and removed the generic grade-band phrase from the classification surface.

Current explicit writing-band coverage:

```text
39 youth writing competitions with explicit writing_bands
0 remaining generic grades 1-12 pathway leaks
```

Current counts:

```text
writingclub: 39
writingkids: 13
writingjuniors: 20
writingteens: 36
writinggrads: 36
```

Files touched:

- `polymythseminars/events.json`
- `data/polymyth-seminar-events.json`
- `polymythseminars/index.html`
- five writing shortcut pages

### 4. Shortcut pages had unfiltered server-rendered fallback content

The shortcut pages previously loaded the right filter once JavaScript ran, but the static HTML fallback still contained the general calendar list. That created a mismatch for search engines, slow devices, and users with JavaScript disabled.

Current shortcut pages now ship filtered server-rendered content:

```text
writingclub/index.html: 39 event cards
writingkids/index.html: 13 event cards
writingjuniors/index.html: 20 event cards
writingteens/index.html: 36 event cards
writinggrads/index.html: 36 event cards
```

### 5. Shortcut page structured data was still generic

Shortcut pages now have route-specific CollectionPage structured data rather than the generic polymythcalendar description.

### 6. Count-line and build-stamp drift

The root count line now reports the rebuilt current event count. The build stamp was updated to `20260628`.

## Current data audit

```text
calendar records: 470
contest records: 43
youth writing competition records: 39
explicit writing-band records: 39
missing date/title/type/source_url/id: 0
duplicate ids: 0
duplicate title/date pairs: 0
invalid source URLs: 0
```

The 17 researched youth-writing additions remain present:

- The Aristotle Contest
- Hamilton Public Library Power of the Pen
- Royal Canadian Legion Literary Contest
- OSSTF Student Achievement Awards
- French for the Future National Essay Contest
- OECTA Young Authors Awards
- Meaning of Home Student Contest
- Ottawa Public Library Awesome Authors Youth Writing Contest
- Canadian Nuclear Society Essay Contest
- Kids Write 4 Kids
- YABS Young Writers Award
- Vancouver Writers Fest Youth Writing Contest
- Jessamy Stursberg Poetry Prize for Canadian Youth
- Queen's Commonwealth Writing Competition
- CNIB Braille Creative Writing Contest
- Fraser Institute Student Essay Contest
- Diverse Minds Manitoba

## Critique from every major point of view

### Student point of view

Strong:

- `writingclub`, `writingkids`, `writingjuniors`, `writingteens`, and `writinggrads` are short enough to say aloud.
- The route names avoid dashes and keep one slash.
- The pages now land directly on writing competitions.

Improve next:

- Add a large first-card explanation: “Pick your age group. Click the title. Submit on the official site.”
- Add chips on every competition card: `Free`, `Fee`, `Canada`, `Ontario`, `BC`, `Online`, `Poetry`, `Essay`, `Story`, `French`, `Braille`, `Indigenous`.
- Add “deadline confidence” labels: `Verified`, `Projected`, `Window`, `Confirm`.
- Add countdown language: `opens soon`, `due in 17 days`, `annual window`.
- Add a kid-readable difficulty label: `quick`, `medium`, `big project`.

### Grade 12 / graduating student point of view

Strong:

- `writinggrads` is memorable and now has explicit band logic.
- Grade 11, Grade 12, senior, older teen, and pre-university opportunities are grouped together.

Improve next:

- Rename the H1 from `Writing Grads` to `Writing Grads — Grade 11 & 12 competitions` while keeping the URL unchanged.
- Add a top note: “For Grade 12, start here.”
- Split `writinggrads` visually into `Essay`, `Creative`, `Poetry`, `Policy`, and `Big prestige` sections.
- Add a “university application value” badge for awards with stronger portfolio value.

### Younger student point of view

Strong:

- `writingkids` is easy to remember.
- It now avoids high-school-only false positives.

Improve next:

- Use softer page copy: “You can enter these with a parent or teacher.”
- Show word limits more prominently.
- Flag contests needing school/library/local eligibility.
- Add parent-facing safety note: official site opens in a new tab.

### Teacher point of view

Strong:

- One-slash links are easy to paste into Google Classroom, email, or a slide.
- Routes now match actual eligibility bands better.

Improve next:

- Add printable teacher version.
- Add CSV download for each writing shortcut page.
- Add a “classroom-friendly” filter for free contests with simple submissions.
- Add province filters: Ontario, BC, Alberta, Manitoba, Canada-wide, international.
- Add a “bulk planning” view grouped by month.

### Parent point of view

Strong:

- Source links are retained.
- The public pages are simpler than the full calendar.

Improve next:

- Add `fee`, `prize`, `who can enter`, `what to submit`, and `where to submit` fields as visible bullets.
- Add a “check eligibility before writing” reminder on projected or regional contests.
- Add “parent/guardian account required” when applicable.

### Curator / maintenance point of view

Strong:

- Data parity guard passes.
- Source URLs exist for every event.
- The new `verify-writing-shortcuts.js` catches future writing shortcut regressions.

Improve next:

- Add first-class fields instead of storing contest facts inside `venue` and `description`:
  - `organizer`
  - `eligibility_country`
  - `eligible_provinces`
  - `eligible_grades_min`
  - `eligible_grades_max`
  - `eligible_ages_min`
  - `eligible_ages_max`
  - `genres`
  - `entry_fee`
  - `prize_summary`
  - `deadline_status`
  - `deadline_verified_at`
  - `submission_url`
  - `rules_url`
- Add an annual “rollover” script that asks for confirmation before carrying a projected deadline forward.
- Add a stale-source guard for contests whose official pages have changed or disappeared.

### SEO point of view

Strong:

- Shortcut routes are in the sitemap.
- They have route-specific canonicals.
- They now have filtered static HTML content.

Improve next:

- Add route-specific FAQ structured data.
- Add `ItemList` structured data for each writing shortcut route.
- Make title tags more search-useful:
  - `Writing Competitions for Canadian Students | Writing Club`
  - `Grade 11 and 12 Writing Competitions | Writing Grads`
- Consider indexable detail pages for verified contests only, while keeping projected/uncertain contest detail pages noindexed.

### Accessibility point of view

Strong:

- Buttons are real buttons.
- Writing pages now have server-rendered content.
- Text-size controls remain present.

Improve next:

- Add `aria-live="polite"` to the count line so screen readers hear filter changes.
- Add `aria-pressed` to category and age buttons, matching the new writing shortcut buttons.
- Add a skip link directly to filters and a skip link directly to results.
- Make the horizontal filter rows easier to scroll on small screens.

### Mobile point of view

Strong:

- One-slash URLs are mobile-friendly.
- Filter buttons are compact.

Improve next:

- Make the writing row sticky on writing shortcut pages.
- Collapse the general category row behind “More filters” on writing pages.
- Put `Open source`, `Save`, and `Share` actions near the top of each card.

### Performance point of view

Strong:

- Static fallback prevents blank pages.
- External `events.json` still provides the live data path.

Improve next:

- Stop duplicating the full 449 KB event snapshot into every shortcut page.
- Move shared calendar JavaScript and CSS to cacheable external files.
- Let shortcut pages carry a small filtered snapshot plus the external full-data fetch.
- Add gzip/brotli awareness to deployment checks.

### Brand point of view

Strong:

- `writingclub` feels broad enough for essays, poetry, journalism, plays, and fiction.
- `writingkids`, `writingjuniors`, `writingteens`, and `writinggrads` sound like shareable destinations rather than internal filters.

Improve next:

- Treat `Writing Club` as a named public product, not just a filter.
- Add a tiny line tying it back to Polymythcal: “Powered by polymythcalendar.”
- Keep “polymythcalendar” in the machinery, and use “Writing Club” for humans.

## Recommended next implementation order

1. Build a richer writing card layout with visible eligibility, fee, genre, prize, and confidence chips.
2. Add first-class contest fields to the data model.
3. Add province, genre, free-only, and verified-deadline filters.
4. Add filtered RSS feeds or iCal feeds for the five writing shortcut pages.
5. Add a teacher print/CSV mode.
6. Add `ItemList` and FAQ structured data to shortcut pages.
7. Externalize shared JS/CSS and reduce duplicate inline event payloads.
8. Consider changing the public calendar label from category-only tabs to audience-aware navigation: `Events`, `Deadlines`, `Writing Club`, `For Students`, `For Teachers`.

## Verification references

Commands run:

```bash
node scripts/build-search-pages.js
npm run verify:writing-shortcuts
npm run verify:all
```

Key local files:

- `polymythseminars/events.json`
- `data/polymyth-seminar-events.json`
- `polymythseminars/index.html`
- `writingclub/index.html`
- `writingkids/index.html`
- `writingjuniors/index.html`
- `writingteens/index.html`
- `writinggrads/index.html`
- `scripts/verify-writing-shortcuts.js`
- `scripts/search-surface-manifest.json`
- `WRITING_SHORTCUT_ROUTES_AUDIT.md`
