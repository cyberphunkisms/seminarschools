# Typography and Controls Audit

Date: 2026-06-28
Archive baseline: `seminarschools-polymythcalendar-github-actions-cli-fix.zip`

## Scope

This pass targeted the visible control problems reported from the Leizu page and the broader site typography system:

- ESL button on the Leizu chrome bar.
- Light/dark buttons across the site.
- Leizu A-/A+ text-size controls.
- Sitewide text-size inventory across HTML and CSS.
- Regression checks so the controls remain wired after future edits.

## Repairs implemented

### Leizu ESL control

Added `leizu/chrome-controls.js`, a defensive control layer loaded by `leizu/index.html`.

The ESL button now:

- Always responds to click.
- Turns Simple English mode on/off through `applyESL()` when the full Leizu script is available.
- Falls back to direct `data-esl` attributes if a page-level script is interrupted.
- Switches the page back to English before enabling ESL when a visitor is currently in French, Traditional Chinese, Simplified Chinese, or Persian.
- Keeps the ESL status banner and button state synchronized.

### Leizu light/dark control

The Leizu theme button now:

- Directly toggles between light and dark.
- Synchronizes `data-theme`, `.dark`, `.light`, `leizu-theme`, and `ss-theme`.
- Updates the button icon and pressed state.
- Works even if an older page-level handler fails.

### Sitewide light/dark control

Updated `js/theme.js` so ordinary `.theme-toggle` buttons across the site use a direct two-state light/dark toggle.

Previous behaviour cycled through system preference, light, and dark. That made a click look ineffective when the system preference matched the current visual state. The new behaviour flips the visible state on every click and persists the choice.

### Leizu text-size controls

The Leizu A-/A+ buttons now:

- Use the same defensive delegated control layer as ESL and theme.
- Persist `leizu-type-scale`.
- Clamp text scaling between 0.85 and 1.45.
- Update disabled state at the minimum and maximum bounds.
- Use larger, clearer button typography.

### Visual control readability

The Leizu chrome bar now has larger control text, larger click targets, clearer active states, and explicit disabled styling.

## Text-size inventory

`verify-typography-controls.js` scans HTML and CSS files and records very-small font-size declarations under 10.5px.

Current result:

- HTML/CSS files scanned: 1,110
- Very-small font-size declarations inventoried: 212

The inventory is saved at:

`/scripts/audits/typography-controls-audit.json`

Most flagged declarations are metadata, labels, map/chrome annotations, dense archive UI, or intentionally small decorative interface text. The current pass fixes the broken controls and the most visible chrome text-size issue while preserving archive layouts. The next typography pass can target specific archive pages one by one.

## Regression guard

Added:

`npm run verify:typography-controls`

Integrated into:

`npm run verify:all`

The new guard checks that:

- Leizu ESL, theme, and text-size buttons exist.
- `leizu/chrome-controls.js` is loaded.
- The hardener delegates ESL, theme, and text-size clicks.
- Global theme toggling is direct and synchronizes `data-theme` for page-specific CSS.
- The typography inventory is regenerated.

## Verification

Full verification passed:

- HTML pages checked: 1,103
- JavaScript files checked by site integrity: 75
- Redirect rules: 149
- Sitemap URLs: 979
- Calendar parity: 459 mirrored entries
- Search surface: 719 catalog resources, 258 current event cards, 15 methodology sections
- Typography/control scan: 1,110 HTML/CSS files

