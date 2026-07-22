# Polymythcal Audit 16

## Release result

- **91 of 91 interaction, clickability, design, bilingual, and browser checks passed**
- **28 of 28 clarity-regression checks passed**
- **28 of 28 Audit 14 structural checks passed**
- **839 canonical event records preserved**
- **839 stable source event pages and 839 deploy mirrors preserved**
- **24,912-byte calendar shell**
- **931 sitemap URLs passed SEO and classification checks**

## Critique and corrections

### 1. Information architecture

The earlier page mixed search, time, location, subject, audience, certainty, format, shortcuts, feeds, and contribution actions into one visual field. The revised hierarchy now follows the user’s decision sequence:

1. Search
2. Popular entry points
3. Personal and contribution tools
4. Filters
5. Results

Events to attend and opportunities to apply for remain independently selectable. Time uses a single-choice range. Place, topic, type, audience, format, and status support simultaneous selections.

### 2. Filter logic and clickability

- Choices inside one section use **OR**.
- Separate sections use **AND**.
- Active choices appear as individual removable buttons.
- Every section exposes its own Clear action when active.
- Reset All appears only when a real extra choice exists.
- A selected zero-result choice remains visible so it can always be removed.
- Unselected choices with zero matches in the current context disappear instead of acting like dead buttons.
- The interface prevents Events and Opportunities from both becoming empty.

### 3. Opportunity classification

Fellowships, grants, residencies, prizes, and competitions were previously swallowed by the generic source type `cfp`. Classification now prioritizes the actual opportunity being offered. The visible opportunity filters now contain real matching records:

- Calls for papers and proposals
- Competitions, prizes, and awards
- Fellowships, grants, and residencies

Empty application categories remain out of the current interface and can appear automatically when the corpus gains matching records.

### 4. Search

- Search is the first major control.
- The placeholder fits narrow screens.
- English, French, accents, synonyms, and close spellings remain supported.
- `montral` returns Montréal listings.
- Clear Search appears only when text exists.
- The result button reports the live count.
- Search, filter, and language state remain URL-backed and shareable.

### 5. Calendar design

The previous calendar repeated every multi-day exhibition and festival on every day of its run. This created cells containing “Show 100 more.” The revised calendar now:

- Shows a listing on its start date in the month grid.
- Consolidates ongoing and multi-day listings into one collapsed section above the month.
- Keeps each day compact at three visible links before an explicit expansion control.
- Uses a vertical agenda on mobile.
- Reports calendar-view status instead of list pagination language.
- Supports clickable previous, next, and Today controls.
- Supports the documented left and right arrow keyboard shortcut.

### 6. Result cards

- Every title is visibly linked.
- View details is the primary card action.
- Official source and Save remain separate actions.
- Save updates in place and preserves keyboard focus.
- Ongoing listings show an Ongoing label and end date.
- Placeholder venue strings are removed from public cards.
- Missing times and locations use plain-language pending labels.
- Event and opportunity badges remain visually distinct.

### 7. Saved listings and sharing

- Saved listings use a modal dialog with focus placement and Escape-to-close behavior.
- Saved entries include date and location context.
- Device-local save state updates without rebuilding the clicked card.
- Share View copies a URL containing the current choices.
- The French-language link preserves the current search and filters.

### 8. Mobile and responsive design

- Popular entry points and filters begin collapsed on mobile.
- Search and live results appear before the filter wall.
- A bottom action bar keeps Filters and View Results reachable.
- The empty current-choices panel disappears.
- 390-pixel and 320-pixel layouts have zero horizontal page overflow.
- Visible controls meet the 24-pixel WCAG target-size minimum tested by the browser suite.
- The mobile calendar uses an agenda instead of a compressed seven-column grid.
- Keyboard-only guidance remains visible on desktop and stays out of the mobile layout.

### 9. Keyboard and accessibility

The browser suite verified:

- Visible focus for buttons, links, hidden checkboxes, radios, active chips, and calendar controls
- Keyboard removal of active filters
- Saved-dialog focus and Escape behavior
- Arrow-key calendar navigation
- 320-pixel reflow
- Reduced-motion behavior
- Forced-colour selected-state visibility
- Accessible names for interactive controls
- Touch-target size
- English and French dynamic labels

Native VoiceOver and NVDA sign-off still requires macOS and Windows hardware. The existing manual protocol remains in `docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md`.

### 10. Date and timezone reliability

Upcoming counts, ongoing status, calendar grouping, and displayed corridor dates now use **America/Toronto** as the calendar timezone. The browser suite confirmed the same upcoming count in Toronto and UTC contexts. Date-only records retain their published calendar day.

### 11. Visual system

- Search receives the strongest visual emphasis.
- Popular entry points remain plentiful and visually secondary.
- Utility actions form a separate compact bar.
- Filter groups use headings, helper text, and consistent chips.
- Empty interface regions disappear.
- The site’s restrained Indra-web geometry is restored at a low intensity.
- Hover, pressed, selected, focus, and disabled states remain distinguishable.

## Verification gates

| Gate | Result |
|---|---:|
| Audit 16 interaction and design browser suite | 91/91 |
| Clarity revamp regression suite | 28/28 |
| Audit 14 structural compatibility | 28/28 |
| Site integrity | 2,474 public HTML pages |
| SEO deployment | 931 sitemap URLs |
| Keyboard navigation | 1,630 interactive pages load the shared helper |
| Responsive regression | mobile and 200% zoom source contracts |
| Visible geometry | 2,473 source/public route pairs |
| Site interactivity | 2,643 HTML/JS files scanned |
| Sitemap classification | 931 sitemap URLs and 1,560 classified non-sitemap routes |
| Search surface | 839 calendar records with stable pages |

## Included evidence

- `POLYMYTHCAL_AUDIT16_INTERACTION_DESIGN_VERIFICATION_2026-07-21.json`
- `POLYMYTHCAL_AUDIT16_RELEASE_VERIFICATION_2026-07-21.json`
- `data/polymythcal-audit16/desktop-initial.png`
- `data/polymythcal-audit16/mobile-initial.png`
- `data/polymythcal-audit16/small-mobile-initial.png`
- `data/polymythcal-audit16/desktop-final.png`
- `data/polymythcal-audit16/mobile-final.png`
- `data/polymythcal-audit16/small-mobile-final.png`
