# Main homepage predeployment audit

## Implemented

- Replaced the outlined SVG text treatment with solid project labels on translucent plates.
- Added a persistent selected state for every jewel and its connecting threads.
- Added a project card that remains aligned with the selected jewel.
- Added an accessible mobile project rail so the map does not depend on overlapping text at narrow widths.
- Kept desktop mouse click-through and added select-before-navigate behavior for touch input.
- Moved the core jewel from `/main` to the homepage index.
- Routed bookwormburrows to `/bb/`, its current landing page.
- Reduced the Indra substrate to a quieter resting intensity and linked its color and opacity to the selected project.
- Replaced the permanent rendering loop with interaction-driven animation that rests when idle and pauses in hidden tabs.
- Focused the first action row on tutoring, the Agora, and teacher resources.
- Tightened homepage descriptions without changing the Leizu or other project flows.

## Verified

- `npm run verify:all`
- JavaScript syntax for the homepage and Indra engine
- New homepage map guard
- Existing Leizu payment, booking, language, and course-picker guards
- bb/why route and sitemap guard

## Decision retained for owner

`/main/` remains available as a separate legacy About page. The core jewel no longer sends visitors there. Decide later whether it should remain a long-form About page, receive a full rewrite, or redirect to the homepage.
