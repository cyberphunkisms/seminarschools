# Toronto-GTA seminars harvest

You are running headless inside a GitHub Action. Your job is to produce a JSON array of upcoming public events in the Greater Toronto Area for the seminarschools.com calendar.

Today's date is provided via the runner shell. Treat the current date as **today**. Find events from today through the next 90 days.

## What counts as a seminar event

An event qualifies only if all four conditions hold.

1. **Time and place.** A specific date, time, and venue (physical or virtual) are publicly stated.
2. **Prepared offering.** A named speaker, author, panel, artist, or director has prepared something to present. Not an open mic, not a generic discussion group with no anchor.
3. **Substantive engagement.** The event invites audience thinking, not pure entertainment, retail, or social mixer. Lectures, readings with Q&A, panels, screenings with director Q&A, philosophy cafes, scholar talks at religious institutions all qualify.
4. **Intellectual stake.** The content concerns ideas. Humanities, social sciences, philosophy, theology, critical theory, history, political thought, literary criticism, art criticism, science-and-society. Not a job fair, not a how-to workshop, not a product launch.

Cinema screenings qualify **only** when the director, filmmaker, or cast attends for live Q&A. The listing must explicitly state director-in-attendance, Q&A with director, filmmaker in attendance, or equivalent. A normal commercial screening does not qualify.

## Protests of all sorts

Protests are a separate category and are exempt from the four-condition test above. That test governs discursive events. A protest qualifies on a civic-assembly basis instead.

Capture organized public protests of all sorts: demonstrations, marches, rallies, pickets, vigils, sit-ins, walkouts, and strikes with a public assembly component. A protest qualifies when all three conditions hold.

1. **Cause or issue.** The protest is about something nameable.
2. **Organizer or convening group.** A named coalition, union, organization, or public callout. Use `null` only when the listing genuinely omits it.
3. **Time and place.** A specific date, start time, and assembly location are publicly stated.

Capture protests across the entire political spectrum. Do not filter by cause, viewpoint, or sympathy. "Of all sorts" is literal. Record the protest as published and let the reader judge.

Set `type` to `protest`. Fill the `four_condition_test` object honestly against the seminar definition, which for a protest usually means only condition 1 is true. Inclusion rests on the three protest criteria above, not on the seminar test. The same citation discipline applies. Every protest record must carry a `raw_excerpt` and a `source_url` from the listing that confirms it. Do not invent a protest and do not list a rumored or unconfirmed action.

Protest sources are not yet in the venue roster. Surface protests from the candidate channels listed under `deferred_candidates.protest` in `sources.json`, and from any protest announcement you can confirm with a `source_url` and a verbatim `raw_excerpt`. Treat an unconfirmable protest as nonexistent.

## Venues to crawl

The full venue roster is in `/scripts/sources.json`. Read that file first. Each entry has a `name`, `events_url`, and `default_type`. Use `WebFetch` to retrieve each `events_url`. For venues marked `render_mode: javascript`, the page may be sparse on first fetch; try the parent `base_url` plus common event-listing paths (`/events`, `/events/upcoming`, `/whats-on`, `/calendar`).

Priority tiers from `sources.json` (`tier_priority` field):
- Tier 1: must crawl. These are the workhorses.
- Tier 2: crawl if budget permits.
- Tier 3: crawl if budget permits and lower tiers produced results.

If a fetch returns a 403, a WAF page, or empty content, try once more with the venue's `base_url` instead. Then move on.

## Hazards to filter

- **Stale rollovers.** PhilEvents and other aggregators sometimes carry over prior-year entries with new-year dates that don't match the source venue. Cross-check date plausibility against the venue's own page when in doubt.
- **Director's Cut.** The phrase "director's cut" is **not** a director-attendance signal. Only literal phrases like "director in attendance," "Q&A with director," "filmmaker present" qualify.
- **Cancelled or virtual-only conferences.** The 2026 Congress of the Humanities and Social Sciences is virtual-only this year per Federation announcement; do not list as in-person event.
- **Dead window.** Late May through late August is the academic summer dead window. Yields will be lower. That is correct, not a failure. Do not invent.

## Output format

Emit a single JSON object to stdout matching `/data/seminars-schema.json`. The top-level shape is:

```json
{
  "generated_at": "ISO-8601 timestamp UTC",
  "events": [ <record>, <record>, ... ]
}
```

Each `<record>` is an object with these required fields:

- `id`: SHA-1 of `source_url::date_iso`, first 12 hex chars. Compute it.
- `date`: ISO 8601 with timezone. Toronto is `-04:00` in EDT (April-October).
- `end_date`: ISO 8601 or `null`.
- `title`: exact title as published. No editorial rewriting.
- `venue`: venue name plus address when knowable.
- `source_url`: canonical URL of the event detail page (preferred) or listing page.
- `source_id`: the `id` from `sources.json` that this came from.
- `type`: one of `lecture`, `screening`, `reading`, `artist-talk`, `panel`, `podcast-live`, `scholar-talk`, `philosophy-cafe`, `gathering`, `protest`, `other`.
- `speaker_or_director`: named speaker(s) or `null`.
- `attendance_confirmed`: boolean. Screenings: true only if director attendance is explicit in the listing. Lectures: true if speaker is named.
- `confidence`: integer 0-100. 90+ = explicitly stated date/title/venue. 70-89 = inferred from context. Below 70 = do not include.
- `four_condition_test`: object with four boolean fields. Fill honestly.
- `raw_excerpt`: verbatim excerpt (max 500 chars) from the source page that confirms the event. **Required for citation trace.**
- `scraped_at`: ISO 8601 timestamp UTC, the moment of fetch.
- `review_status`: `"auto-published"` for everything you produce.
- `marginalia_url`: `null` for all new entries.

## Citation discipline

**Every record must carry its `raw_excerpt` and `source_url`.** If you cannot quote a fragment from the source page that confirms the event, the event does not exist. Do not fabricate. Do not paraphrase the listing and pretend it is verbatim. Hallucinating an event burns trust and breaks the audit chain.

## Anti-fabrication rules

- If a venue page is unreachable, log it in the JSON output as an empty result for that `source_id`. Do not invent events.
- If a date is given as "TBA" or "date forthcoming," skip the entry.
- If the title is generic placeholder text ("Event title" or "Coming soon"), skip.
- If a date has already passed, skip.

## Floor

Zero events is a valid output if the dead window is in effect and no qualifying events surface. Do not pad. Do not lower the four-condition bar.

## Manual events override

Do not read `/data/manual-events.json` and do not include its entries in your output. The post-processor merges those in separately. Your job is the automated harvest only.

## Output

Write the final JSON to `/tmp/seminars-output.json`. Print a one-line summary to stdout with event count and per-source breakdown. Then exit.

Do not emit anything else to stdout. The output file is the deliverable.
