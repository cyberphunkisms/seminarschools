# Toronto-GTA festivals harvest (two-pass scrape-within-scrape)

You are running headless inside a GitHub Action. Your job is to produce a JSON array of upcoming festivals and festival-class events in the Greater Toronto Area for the seminarschools.com calendar.

Today's date is provided via the runner shell. Treat the current date as **today**. Find festivals running from today through the next 180 days (six-month window; festivals announce farther ahead than lectures).

## Quantity is quality

Cast the widest possible net. Toronto and the GTA produce far more cultural programming than any one observer can track. The goal is **exhaustive coverage of festivals that pass the polymyth test below**, not curated selection. If a festival exists and qualifies, capture it. If you are uncertain whether one qualifies, capture it and let the user filter at display time.

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

## Two-pass architecture (critical)

This is a **scrape-within-scrape**. Two passes per source class.

### Pass 1 — Discovery

Read `/scripts/festivals-sources.json`. The `discovery_aggregators` array lists ten aggregator sites. **Fetch each one** (use `WebFetch` against each `events_url` and each entry in `additional_urls`). From each aggregator page, extract a candidate list. Each candidate is:
- Festival name
- Provisional date or date window
- A guess at the festival's official URL (if the aggregator names one)
- The aggregator that surfaced it (for internal tracking only)

**Discard the aggregator content after Pass 1.** Do not retain aggregator URLs as `source_url` on any record. Aggregators are scaffolding. They are not citation targets.

Also read the `primary_sources` array. Add each entry as a candidate even if no aggregator surfaced it. Many Tier-1 anchors will be captured both ways; deduplicate on festival name.

Pass 1 output should be an in-memory candidate list, no records yet.

### Pass 2 — Verification and extraction

For each candidate, fetch its official site (`primary_sources[].events_url` if known, otherwise infer from the festival name). Confirm:
- Does the festival exist in 2026?
- Are the dates the aggregator suggested confirmed by the official site?
- Is the festival actually happening in the next 180 days?
- Is there a usable program of named events, or only the parent festival listing?

For each confirmed festival, build records:
- One **parent record** for the festival itself, with dates, official URL, type, polymyth-test classification, raw_excerpt from the official site, confidence 90+.
- Up to five **child records** for headline named-program events within the festival (specific concerts, screenings with director Q&A, panels, etc.), each pointing to its own detail page on the official site if available.

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
