# Polymythcal native screen-reader test protocol

## Test build

- Surface: `/polymythseminars/`
- Forms: `/polymythseminars/submit/` and `/polymythseminars/correct/`
- Stable detail sample: `/polymythseminars/events/clarkson-laureateships-high-table-2026-01-30/`
- French state: append `?lang=fr`
- Share-state sample: `?q=montral&focus=montreal&lang=fr`
- Standard: WCAG 2.2 AA

Record browser version, assistive-technology version, operating-system version, date, tester, spoken output, keyboard path, and outcome for every case.

## VoiceOver on macOS

Use current macOS, Safari, and VoiceOver. Start Safari with no extensions affecting page content. Enable VoiceOver with Command F5.

| Case | Path and keys | Expected result |
|---|---|---|
| Page entry | Open the calendar, press Control Option U, inspect Landmarks and Headings | One main landmark, one level-one heading named Polymythcal, named navigation regions, and a skip link as the first focusable control |
| Skip link | Reload, press Tab, then Return | VoiceOver announces the skip link and focus lands at the main content |
| Search | Press Control Option Command F to find “Search”, enter `montral` | The search field has a French or English accessible name matching the interface language; the result status announces an updated count; Montréal results remain present despite the typo |
| Filter states | Navigate to Montréal, Confirmed, and Unconfirmed controls; activate each with Control Option Space | Each control announces button role and pressed state; result status updates without moving focus unexpectedly |
| Shared state | Open `?q=montral&focus=montreal&lang=fr` | VoiceOver announces French page language, the restored query, Montréal as pressed, and the resulting count |
| Save event | Navigate to the first Save event button; activate twice | The button changes between Enregistrer and Enregistré, announces pressed state, and the polite status announces save and removal |
| Saved items | Open Éléments enregistrés; inspect headings and remove control | Events and Searches headings are exposed; saved links and Retirer buttons have unique names; expanded state is announced |
| Save search | Activate Enregistrer la recherche, then open saved items | The saved search link preserves the current URL parameters and has a meaningful name |
| Feeds | Open Abonnements | Expanded state is announced; each row exposes the bilingual feed label, count, RSS link, and ICS link |
| List and calendar views | Switch between Liste and Calendrier | Pressed state moves correctly; calendar date buttons announce full dates and listing counts; month controls announce previous and next month |
| Calendar keyboard | In calendar view, move among date buttons with arrow keys, Page Up, Page Down, Home, and End | Focus follows the documented date-grid model and remains visible; agenda heading and status correspond to the selected day |
| Event detail | Open a stable event title | Heading, confirmation state, qualification, last checked date, official source, calendar file, correction link, and save button are announced in reading order |
| Submission form | Open submit form; use Control Option Command J and Tab | Every field announces its visible bilingual label, required state where applicable, input type, help text, and validation message |
| Correction form | Open a correction URL from an event page | The stable listing URL is prefilled and announced; correction type, correct information, evidence source, and email fields have labels |
| French language | Open the French state and use the rotor through buttons and links | Interface controls, state messages, calendar instructions, feed labels, forms, and event actions are French or bilingual; organizer content remains in its source language |

## NVDA on Windows

Use current Windows, NVDA, Chrome, and Firefox. Run the sequence once in each browser. Start NVDA, open the page, and use NVDA F7 to inspect Elements List.

| Case | Path and keys | Expected result |
|---|---|---|
| Page structure | Press H, 1, D, and NVDA F7 | One H1, logical heading order, one main landmark, named navigation regions, and meaningful links and buttons |
| Skip link | Reload, press Tab, Enter | Skip link is first, receives a visible focus indicator, and moves focus to main content |
| Search and live results | Press E to reach the search field, type `montral`, pause | NVDA announces the search field name and the polite result-count update without repeating the whole page |
| Pressed filters | Press B through quick views and categories; activate Montréal and confirmation filters with Space | NVDA announces pressed or not pressed, and focus stays on the activated control |
| URL restoration | Open `?q=montral&focus=montreal&lang=fr` | Query and pressed filter state restore; document language is French; result count is present |
| Saved event | Press B to a save control; press Space | Name changes between Save event and Saved or the French equivalents; pressed state and polite confirmation are announced |
| Saved search and panels | Activate Save search and Saved items | Expanded and collapsed states are announced; headings, links, and remove buttons are reachable in browse and focus modes |
| Feed panel | Activate Feeds | Bilingual feed names, counts, RSS links, and ICS links are read in row order |
| Calendar view | Activate Calendar, then use arrows, Page Up, Page Down, Home, and End | Date buttons announce full date, count, selected state, and agenda changes; keyboard focus remains visible |
| Stable event page | Open a result | The event H1, status, qualification, source, add-to-calendar, correction, and local-save actions have distinct names |
| Submission form | Press F to move through fields and Space on the confirmation checkbox | Labels, required state, descriptions, current values, and error messages are announced |
| Correction form | Open from an event detail page | Listing URL is prefilled; all fields and the submit button are named; no browse-mode trap occurs |
| Zoom and reflow | Set browser zoom to 400 percent at 1280 by 1024 and repeat the main paths | Content reflows to one dimension, focus remains visible, and controls remain operable without horizontal page scrolling |
| High contrast and reduced motion | Enable Windows Contrast Theme and Reduce animation effects | Boundaries, selected state, focus, text, and controls remain perceptible; no essential information depends on animation |

## Keyboard-only pass

1. Reload each surface.
2. Traverse every interactive control with Tab and Shift Tab.
3. Operate buttons with Space and Enter.
4. Operate links with Enter.
5. Operate disclosure controls and filter controls without a pointer.
6. Enter and clear searches.
7. Switch list and calendar modes.
8. Complete both public forms through validation.
9. Confirm focus never enters hidden panels, never disappears, and never becomes obscured.
10. Confirm Escape has no undocumented destructive effect.

## Evidence record

For each row, record `Pass`, `Fail`, or `Blocked`, the exact spoken phrase, the focused element, the visible state, the URL, and a screenshot or short recording when a failure occurs. A failure requires an issue with the WCAG criterion, browser and assistive-technology pair, reproduction steps, expected output, actual output, and proposed repair.

## Release sign-off handoff

Native spoken-output testing remains a human platform test. Record each release pass through `.github/ISSUE_TEMPLATE/polymythcal-native-at-signoff.yml`. The issue records the release ID, exact operating-system, browser, and assistive-technology versions, every protocol outcome, spoken phrases, evidence, and repair links. Browser-assisted WCAG checks and multi-platform clean builds run automatically in `.github/workflows/predeploy.yml`; they complement rather than replace VoiceOver and NVDA speech confirmation.
