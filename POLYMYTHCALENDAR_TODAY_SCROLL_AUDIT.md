# Polymythcal Today Scroll Audit

## Change

The Polymythcal internal event scrollbox now automatically lands on the viewer's local current date.

If there is an event starting today, the pane lands on that event. If there is no event starting today, it lands on the next upcoming event. If all visible events are ongoing/past in the filtered view, it uses the best available ongoing or final anchor instead of leaving the reader at the top.

## Pages covered

- `/polymythseminars/`
- `/writingclub/`
- `/writingkids/`
- `/writingjuniors/`
- `/writingteens/`
- `/writinggrads/`
- `/university/`
- `/philosophy/`
- `/humanities/`
- `/cfps/`
- `/lectures/`
- `/fellowships/`

## Technical notes

- Uses local date math instead of UTC `toISOString()`, so late-night timezone edges do not shift the anchor by a day.
- Adds `data-end-date` support so ongoing multi-day events can be recognized.
- Adds a visible `Today / next upcoming` marker before the chosen anchor.
- Schedules several short retries after render/load because fetched JSON, font loading, and route-specific filters can change layout after first paint.
- Adds `scripts/verify-polymythcalendar-today-scroll.js` to `npm run verify:all`.
