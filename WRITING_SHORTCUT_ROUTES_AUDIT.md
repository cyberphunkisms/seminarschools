# Writing Shortcut Routes Audit

Date: 2026-06-28

Implemented and re-audited one-slash youth writing competition routes:

- https://seminarschools.com/writingclub/
- https://seminarschools.com/writingkids/
- https://seminarschools.com/writingjuniors/
- https://seminarschools.com/writingteens/
- https://seminarschools.com/writinggrads/

## Mapping

- `writingclub`: all youth writing competitions in polymythcalendar.
- `writingkids`: younger-child and elementary-open writing competitions.
- `writingjuniors`: junior, intermediate, middle-grade, and early-secondary-open writing competitions.
- `writingteens`: teen and high-school-open writing competitions.
- `writinggrads`: senior high-school, Grade 11, Grade 12, graduating, older-teen, and pre-university writing competitions.

## Counts from current data

- `writingclub`: 39
- `writingkids`: 13
- `writingjuniors`: 20
- `writingteens`: 36
- `writinggrads`: 36

## Technical changes

- Added root-level index pages for each shortcut route.
- Added visible Writing tabs to the calendar and each shortcut page.
- Added explicit `writing_bands` to the 39 youth writing competition records.
- Removed the generic `grades 1-12 pathway` text from band classification surfaces.
- Added route-aware filtering to polymythcalendar and every shortcut page.
- Added filtered server-rendered event cards to shortcut pages, so each route is meaningful without JavaScript.
- Added route-specific CollectionPage structured data to shortcut pages.
- Added sitemap.xml entries for all five routes.
- Added slashless redirects in `_redirects`.
- Added `scripts/verify-writing-shortcuts.js` and included it in `npm run verify:all`.

## Verification

```text
WRITING SHORTCUT CHECK PASSED — 39 current youth writing competitions; counts {"writingclub":39,"writingkids":13,"writingjuniors":20,"writingteens":36,"writinggrads":36}.
```

`npm run verify:all` passes.
