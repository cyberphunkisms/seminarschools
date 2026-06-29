# Polymythcalendar Kid Guide UX Audit

## Change

Added a plain-language help card to the main polymythcalendar page and all writing/university shortcut pages.

## Problem addressed

A new visitor could see useful shortcut words without knowing how to act on them. The clearest example was “Club,” which could sound like a group to join instead of the full writing-opportunity board.

## Added copy

- Pick a row of buttons, then scroll.
- The list opens near today.
- Open any title to reach the official page.
- Writing Club means the full writing board: all writing contests together.
- Kids, Juniors, Teens, and Grads narrow the list by school stage.
- CFP means call for papers.
- Fellowship means funding, residency, visiting scholar, or research support.
- Projected deadlines are watch cards; use the official source before applying.

## Pages covered

- /polymythseminars/
- /writingclub/
- /writingkids/
- /writingjuniors/
- /writingteens/
- /writinggrads/
- /university/
- /philosophy/
- /humanities/
- /cfps/
- /lectures/
- /fellowships/

## Guard added

`scripts/verify-polymythcalendar-kid-guide.js`

The guard is included in `npm run verify:all` and confirms that all 12 pages keep the plain-language guide and accessible relationships.
