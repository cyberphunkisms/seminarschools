# polymythcalendar regional festivals harvest (two-pass scrape-within-scrape)

You are running headless inside a GitHub Action. Your job is to produce a JSON array of upcoming festivals and festival-class events for polymythcalendar across Toronto and Southern Ontario, Kingston, and Montréal.

Today's date is provided via the runner shell. Treat the current date as **today**. Find festivals running from today through the next 180 days (six-month window; festivals announce farther ahead than lectures).

## Quantity is quality

Build broad coverage with verification discipline. The goal is exhaustive coverage of qualifying festivals, while every published record carries an exact date or range and a primary source URL. A source that lacks current-year confirmation contributes zero records. Never pad the calendar with annual assumptions or stale program pages.


## Regions and granular festival records

Cover Toronto and Southern Ontario as the established core, plus Kingston and Montréal. Add and revisit the official pages for Kingston WritersFest, Queen’s University public programming, Montréal International Jazz Festival, Osheaga, MUTEK, Fantasia, Montréal museums, university public programming, and other official regional anchors recorded in `scripts/festivals-sources.json`.

Create **one parent festival record** with `type: "festival"`, an exact start and end date, `is_parent_festival: true`, and the official season URL. Create an **individual production record** for each qualifying named performance, reading, workshop, panel, exhibition, creator-attended screening, or other programme item only when its own official detail page gives an exact date and primary URL. Set `parent_id` to the parent record’s stable ID. Do not turn a lineup card, a programme category, or an undated listing into an event.

Screening gate: publish a screening only when a creator or principal collaborator is confirmed to attend for a conversation, introduction, Q&A, or comparable encounter. A normal screening without confirmed participation is excluded. Exhibitions and residencies require exact start and end dates.

## The polymyth-broadened seminar test

A festival qualifies if **any one** of the following holds.

**(1) Site-specific art.** The festival is the site-specific output of an artistic practice operating outside or against gallery/commercial circuits. CONTACT Photography Festival is the paradigm case — the festival form itself enacts a curatorial logic that the gallery system cannot file. Theatre fringes, contemporary-performance festivals, public-art festivals, experimental-music festivals qualify here.

**(2) Cultural reproduction.** The festival reproduces a diasporic, indigenous, queer, or community form-of-life that the dominant order cannot file. Toronto Caribbean Carnival, Pride Toronto, Tirgan, Afrofest, Polish festivals, Taste of the Danforth, Salsa on St. Clair, imagineNATIVE, Festival of South Asia, Nuit Blanche all qualify here. The test is whether the festival functions as community-reproduction outside dominant commerce, not whether it is also commercially monetized.

**(3) Festival of form.** The festival assembles a public around a form (musical, performative, literary, civic) that the seminar form cannot index alone. Toronto Jazz Festival, Toronto Fringe, SummerWorks, IFOA, Buskerfest, NXNE, Luminato all qualify here.

**(4) Original four-condition test.** If the festival contains discrete events that pass the original seminar test (named speaker plus prepared offering plus substantive engagement plus intellectual stake), those discrete events also qualify and can be captured as their own records under lecture/screening/reading/panel types.

## Festivals that DO NOT qualify

- Pure commodity-curated retail events (Gluten Free Garage, ribfests as commercial food courts, restaurant-week promotions)
- Trade shows, job fairs, product launches
- Corporate sales events dressed as festivals
- Consumer-tourism events with no community-reproduction or artistic-practice substrate

The line is fuzzy. When uncertain, capture and flag with lower confidence.

## Coverage rotation and regional anchors

The festival roster is intentionally wider than one bounded harvest. The runner supplies `SHARD` from 0 through 6. Crawl these official-source groups:

1. **Every-run regional anchors.** Toronto Fringe, SummerWorks, Brott Music Festival, Kingston WritersFest, Montréal International Jazz Festival, OSHEAGA, MUTEK Montréal, and Fantasia. These sources establish the Toronto, Southern Ontario, Kingston, and Montréal baseline and run every day.
2. **This run’s shard.** From the remaining `primary_sources` in `festivals-sources.json`, crawl only entries whose zero-based position satisfies `position % 7 == SHARD`. Record the others as `skipped-shard` in the source accounting.

Across seven consecutive runs, the full festival roster is covered. Spend the bounded budget on the every-run anchors before the assigned shard. A source that cannot be reached receives an explicit `unreachable` status; it does not collapse the whole harvest.

Every public programme must follow this hierarchy: the season itself is exactly `type: "festival"` with `is_parent_festival: true`; every named, dated production that qualifies receives its own record and its own official detail-page URL. Preserve a subtype such as `festival-of-form`, `cultural-reproduction`, or `site-specific-art` only in `secondary_types`.

## Two-pass architecture (critical)

This is a **scrape-within-scrape**. Two passes per source class.

### Pass 1 — Discovery

Read `/scripts/festivals-sources.json`. The `discovery_aggregators` array lists ten aggregator sites. **Fetch each assigned source** (use `WebFetch` against each `events_url` and each entry in `additional_urls`). From each aggregator page, extract a candidate list. Each candidate is:
- Festival name
- Provisional date or date window
- A guess at the festival's official URL (if the aggregator names one)
- The aggregator that surfaced it (for internal tracking only)

**Discard the aggregator content after Pass 1.** Do not retain aggregator URLs as `source_url` on any record. Aggregators are scaffolding. They are not citation targets.

Also read the assigned `primary_sources` entries. Add each assigned entry as a candidate even if no aggregator surfaced it. Many Tier-1 anchors will be captured both ways; deduplicate on festival name.

Pass 1 output should be an in-memory candidate list, no records yet.

### Pass 2 — Verification and extraction

For each candidate, fetch its official site (`primary_sources[].events_url` if known, otherwise infer from the festival name). Confirm:
- Does the festival exist in 2026?
- Are the dates the aggregator suggested confirmed by the official site?
- Is the festival actually happening in the next 180 days?
- Is there a usable program of named events, or only the parent festival listing?

For each confirmed festival, build records:
- One **parent festival record** for the festival itself, with `type: "festival"`, exact start/end dates, official URL, `is_parent_festival: true`, raw_excerpt from the official site, and confidence 90+.
- **Individual production records** for qualifying named programme events (specific performances, readings, workshops, creator-attended screenings, panels, exhibitions). Each must point to its own detail page on the official site and carry an exact date. There is no arbitrary numeric cap; source precision determines quantity.

**Drop candidates the official site does not confirm.** Stale aggregator entries (last year's festival rolled forward, festivals that announced 2026 cancellation, festivals whose 2026 edition is virtual-only or moved cities) die in Pass 2. The CSHPS-2025-rollover hazard documented in the seminars prompt applies here at festival scale.

If a candidate has no findable official site, drop it. Audit chain requires a primary citation.

## Output format

Emit a single JSON object to `/tmp/festivals-output.json` matching `/data/seminars-schema.json` (the same schema as seminars; festivals share the schema). Top-level shape:

```json
{
  "generated_at": "ISO-8601 timestamp UTC",
  "events": [ <record>, <record>, ... ]
}
```

The output JSON must also include a `source_yields` array with one entry for every `primary_sources` record, in roster order, using `crawled`, `skipped-shard`, `unreachable`, or `budget-exhausted`. This gives the next run a visible coverage ledger.

Each record's `type` field uses one of the new polymyth types when appropriate:
- `festival-of-form` for jazz festivals, music festivals, fringe theatre, literary festivals
- `cultural-reproduction` for diasporic-cultural festivals, Pride, indigenous gatherings
- `site-specific-art` for CONTACT, Nuit Blanche, Luminato, SummerWorks
- `screening` for in-festival film events with director Q&A
- `reading` / `lecture` / `panel` for in-festival literary or talk programming

The `source_id` field uses the entry's `id` from `festivals-sources.json` `primary_sources`.

Every record requires `raw_excerpt`: a verbatim fragment from the **official site** (not the aggregator) confirming the festival exists and has the stated dates. Max 500 chars. **This is the audit-chain ground truth.**

## Hazards to filter

- **Stale rollovers.** Aggregator says June 15 2026, official site shows last edition June 2024 and no 2026 announced. Drop.
- **Cancelled-or-virtual.** 2026 Congress of Humanities is virtual-only; do not list as in-person.
- **Director's Cut.** Phrase is not a director-attendance signal.
- **Future TBA.** Date or venue listed as TBA. Drop.
- **Aggregator citation leak.** Never set `source_url` to a discovery hostname. If you cannot find the official URL, drop the candidate.
- **Past-edition residual content.** Many festival sites keep last-year program pages indexed. Confirm the dates match the current edition before extracting.

## Floor and ceiling

Zero is a valid output if the agent cannot find qualifying festivals after fully crawling discovery + primary. Do not pad. **Realistic output range for a non-dead-window run: 40-120 records** (parent festivals plus headline events). Lower for late-summer or January runs. Higher for June and September which are peak festival months in Toronto.

Do not impose an upper limit. Quantity is quality. If your crawl surfaces 200 qualifying records, emit 200.

## Manual events override

Do not read `/data/manual-events.json` and do not include its entries in your output. The post-processor merges those in separately. Your job is the automated harvest only.

## Tool budget

You have `WebFetch`, `Read`, `Write`, `Bash`. The runner caps spend at $10 USD per run (festivals get a higher cap than seminars because two-pass crawl doubles fetch count). Use the budget. Crawl every discovery source. Verify every candidate. Do not stop early when budget remains.

## Output destination

Write final JSON to `/tmp/festivals-output.json`. Print a one-line summary to stdout with total record count, parent vs child breakdown, and per-source counts. Then exit.

Do not emit anything else to stdout. The output file is the deliverable.
