# Toronto-GTA seminars harvest

You are running headless inside a GitHub Action. Your job is to produce a JSON array of upcoming public events in the Greater Toronto Area for the seminarschools.com calendar.

Today's date is provided via the runner shell. Treat the current date as **today**. Find events from today through the next 90 days.

## What counts as a seminar event

An event qualifies only if all four conditions hold.

1. **Time and place.** A specific date, time, and venue (physical or virtual) are publicly stated.
2. **Prepared offering.** A named speaker, author, panel, artist, or director has prepared something to present. Not an open mic, not a generic discussion group with no anchor.
3. **Substantive engagement.** The event invites audience thinking, not pure entertainment, retail, or social mixer. Lectures, readings with Q&A, panels, screenings with director Q&A, philosophy cafes, scholar talks at religious institutions all qualify.
4. **Intellectual stake.** The content concerns ideas. Humanities, social sciences, philosophy, theology, critical theory, history, political thought, literary criticism, art criticism, science-and-society. Not a job fair, not a how-to workshop, not a product launch.

Cinema screenings qualify **only** when the director, filmmaker, or cast attends for live Q&A. The listing must explicitly state director-in-attendance, Q&A with director, filmmaker in attendance, or equivalent. A normal commercial screening does not qualify. This gate applies to every festival, TIFF included. A festival screening with no stated director, filmmaker, or cast Q&A does not qualify, however prominent the film.

## Protests of all sorts

Protests are a separate category and are exempt from the four-condition test above. That test governs discursive events. A protest qualifies on a civic-assembly basis instead.

Capture organized public protests of all sorts: demonstrations, marches, rallies, pickets, vigils, sit-ins, walkouts, and strikes with a public assembly component. A protest qualifies when all three conditions hold.

1. **Cause or issue.** The protest is about something nameable.
2. **Organizer or convening group.** A named coalition, union, organization, or public callout. Use `null` only when the listing genuinely omits it.
3. **Time and place.** A specific date, start time, and assembly location are publicly stated.

Capture protests across the entire political spectrum. Do not filter by cause, viewpoint, or sympathy. "Of all sorts" is literal. Record the protest as published and let the reader judge.

Set `type` to `protest`. Fill the `four_condition_test` object honestly against the seminar definition, which for a protest usually means only condition 1 is true. Inclusion rests on the three protest criteria above, not on the seminar test. The same citation discipline applies. Every protest record must carry a `raw_excerpt` and a `source_url` from the listing that confirms it. Do not invent a protest and do not list a rumored or unconfirmed action.

Protest sources are now in the venue roster as `labour-council` and `protest-civic`. Also surface protests from any announcement you can confirm with a `source_url` and a verbatim `raw_excerpt`. Treat an unconfirmable protest as nonexistent.

## Community and charity events

Community and charity events are a separate category and are exempt from the four-condition test above, on a public-benefit basis. Capture organized public community events: charity walks and rides, fundraisers, neighbourhood festivals, mutual-aid drives, and open community gatherings with a named cause or organizer. A community event qualifies when it is public, has a nameable cause or host, and carries a confirmable date and place. Set `type` to `community`. The same citation discipline applies. Every community record must carry a `raw_excerpt` and a `source_url`. Sources are `toronto-events` and `community-discovery` in the roster. Do not invent an event and do not list a rumored one.

## Calls for papers and deadlines

Calls for papers and conference submission deadlines are a separate category, exempt from the four-condition test, on an academic-utility basis. Capture CFPs and submission deadlines in philosophy, the humanities, and the social studies broadly, which includes critical theory, history, political thought, theology, literary and art criticism, and science-and-society. Scope globally: capture reputable calls worldwide in these fields, since a submission deadline is answerable from anywhere and need not name a Toronto or Ontario venue or organizer. Prefer calls a Toronto or Ontario scholar could realistically answer and screen out low-selectivity or predatory multi-topic conferences, but do not restrict to local hosts. The `date` is the submission deadline, not an event date. Set `type` to `cfp`. A CFP usually names no speaker and no venue, so set those to `null` when absent. Record `age_band` or eligibility when the call states one. The same citation discipline applies. Every CFP record carries a `source_url` and a verbatim `raw_excerpt`. Do not invent a CFP.

## Writing and poetry contests

Writing and poetry contests are a separate category, exempt from the four-condition test, on a creative-opportunity basis. Capture poetry, short-story, essay, playwriting, translation, and other creative-writing contests and competitions globally, whether hosted locally, nationally, or internationally, since a submission deadline is answerable from anywhere. The `date` is the submission deadline. Set `type` to `contest`. Record the entrant `age_band` whenever the contest states one, since many contests are scoped by age. Set `speaker_or_director` and `venue` to `null` when absent. The same citation discipline applies. Every contest record carries a `source_url` and a verbatim `raw_excerpt`. Do not invent a contest and do not list one whose deadline has passed.

## Age and eligibility

Record `age_band` on any record whose listing states who may enter or attend: a youth, teen, or adult band, all-ages, a grade range such as `Grades 9-12`, or a status such as `Undergraduate` or `Open`. This matters most for contests and youth programming. Use `null` when the listing states no restriction, and keep the basis in `raw_excerpt` as usual.

## Venues to crawl

The full venue roster is in `/scripts/sources.json`. Read that file first. Each entry has a `name`, `events_url`, and `default_type`. Use `WebFetch` to retrieve each `events_url`. For venues marked `render_mode: javascript`, the page may be sparse on first fetch; try the parent `base_url` plus common event-listing paths (`/events`, `/events/upcoming`, `/whats-on`, `/calendar`).

Priority tiers from `sources.json` (`tier_priority` field):
- Tier 1: must crawl. These are the workhorses.
- Tier 2: crawl if budget permits.
- Tier 3: crawl if budget permits and lower tiers produced results.

If a fetch returns a 403, a WAF page, or empty content, try once more with the venue's `base_url` instead. Then move on.

## Capture completeness, link specificity, multi-type, nesting, and merging

**Capture every event on a page.** A listing page that names ten talks yields up to ten records, not one. Read the whole listing, expand or paginate where the page hides entries, and emit each distinct qualifying event. Capturing only the first or most prominent item on a multi-event page is a failure.

**Link the most specific URL.** Follow through to the event's own detail page and put that in `source_url`. Use a listing page or a festival homepage only when no per-event page exists.

**One event may hold several types.** When an event genuinely belongs to more than one type, a workshop that is also a panel or a reading that is also a book launch, set `type` to the primary and list the rest in `secondary_types`. One event is one record with several types. Never emit the same event once per type.

**Festivals nest.** For a multi-event festival, emit the umbrella as one record with `is_parent_festival` true, then emit each named, dated sub-event with `parent_id` set to the umbrella's `id`. Capture the umbrella plus the named sub-events and skip the undifferentiated long tail. Jazz, Pride, NXNE, TIFF, and CONTACT all work this way.

**One event, one record.** If the same event surfaces on two source pages, emit it once, keep the richest fields and the most specific `source_url`, and union the extra types into `secondary_types`. The post-processor separately merges your output against the manual file, so never pre-merge manual entries.

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
- `end_date`: ISO 8601 for any event spanning more than one day, set to the last day. A two-day workshop is one record with `date` on day one and `end_date` on day two. `null` only for single-day events.
- `title`: exact title as published. No editorial rewriting.
- `venue`: venue name plus address when knowable.
- `source_url`: the event's own detail-page URL. Follow through from any listing to the specific event page. Fall back to a listing page only when no per-event page exists, and never to a bare festival homepage when a dated event page exists.
- `source_id`: the `id` from `sources.json` that this came from.
- `type`: the primary type, one of `lecture`, `screening`, `reading`, `artist-talk`, `panel`, `scholar-talk`, `philosophy-cafe`, `conference`, `workshop`, `symposium`, `colloquium`, `book-talk`, `book-launch`, `exhibition`, `site-specific-art`, `performance`, `festival-of-form`, `cultural-reproduction`, `gathering`, `protest`, `community`, `cfp`, `contest`, `podcast-live`, `other`. Pick the closest. This drives the event's colour.
- `secondary_types`: array of additional types from the same set when the event is genuinely more than one. Empty array when it is a single type.
- `age_band`: stated entrant or attendee age band or eligibility, or `null`. Examples: `Youth (13-18)`, `Grades 9-12`, `Undergraduate`, `All ages`.
- `speaker_or_director`: named speaker(s) or `null`.
- `attendance_confirmed`: boolean. Screenings: true only if director attendance is explicit in the listing. Lectures: true if speaker is named.
- `confidence`: integer 0-100. 90+ = explicitly stated date/title/venue. 70-89 = inferred from context. Below 70 = do not include.
- `four_condition_test`: object with four boolean fields. Fill honestly.
- `raw_excerpt`: verbatim excerpt (max 500 chars) from the source page that confirms the event. **Required for citation trace.**
- `scraped_at`: ISO 8601 timestamp UTC, the moment of fetch.
- `review_status`: `"auto-published"` for everything you produce.
- `marginalia_url`: `null` for all new entries.
- `parent_id`: the `id` of this event's umbrella festival, or `null`. Set on festival sub-events only.
- `is_parent_festival`: boolean. True on a festival umbrella record, false otherwise.

## Citation discipline

**Every record must carry its `raw_excerpt` and `source_url`.** If you cannot quote a fragment from the source page that confirms the event, the event does not exist. Do not fabricate. Do not paraphrase the listing and pretend it is verbatim. Hallucinating an event burns trust and breaks the audit chain.

## Anti-fabrication rules

- If a venue page is unreachable, log it in the JSON output as an empty result for that `source_id`. Do not invent events.
- If the **date** is "TBA" or "date forthcoming," skip the entry. A missing date is fatal; a missing speaker or venue is not.
- Do not store the literal string "TBA" in `speaker_or_director` or `venue`. If either is unannounced, run one resolving search; if it stays unknown, set the field to `null` and keep `confidence` in the 70-to-79 band.
- If the title is generic placeholder text ("Event title" or "Coming soon"), skip.
- If a date has already passed, skip.

## Floor

Zero events is a valid output if the dead window is in effect and no qualifying events surface. Do not pad. Do not lower the four-condition bar.

## Manual events override

Do not read `/data/manual-events.json` and do not include its entries in your output. The post-processor merges those in separately. Your job is the automated harvest only.

## Output

Write the final JSON to `/tmp/seminars-output.json`. Print a one-line summary to stdout with event count and per-source breakdown. Then exit.

Do not emit anything else to stdout. The output file is the deliverable.
