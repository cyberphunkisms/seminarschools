# Research tasks — events-calendar scrape backbone

Backbone map for the two harvest pipelines. Each task is a category cluster the
scraper builds on. Pipeline A (seminars) reads `scripts/seminars-prompt.md` +
`scripts/sources.json`. Pipeline B (festivals) reads `scripts/festivals-prompt.md`
+ `scripts/festivals-sources.json`. Routing rule: multi-day festivals live in the
festivals roster; every venue-like source (galleries, cinemas, bookstores,
performing-arts halls, departments, speaker clubs, CFP/contest aggregators) lives
in `sources.json`.

Status as of 2026-06-09: all twelve passes researched and wired.
`sources.json` 27 → 160. `festivals-sources.json` 31 → 53 primary, 10 → 12 discovery.

## Pipeline A — seminars (`sources.json`)

| Task | Categories | Scope | Status |
|---|---|---|---|
| A1 Academic philosophy & humanities | lecture, conference, workshop, talk, panel, symposium, colloquium, defence, scholar-talk | Toronto + GTA, in-person/hybrid | researched + wired (U of T depts, York, TMU, OCAD U, TST, PIMS, RCIScience added) |
| A2 Literary & author events | reading, artist-talk, book-talk, book-launch | Toronto | researched + wired (bookstores, reading series, presses, prizes). Art Bar domain hijacked — Instagram only |
| A3 Online/hybrid + live podcasts + cafes | webinar, podcast-live, philosophy-cafe, talk | online = global; cafes = Toronto | researched + wired (Royal Inst, IAI, Arendt, BISR, 92NY, NYPL, Practical Philosophy Club ON, Being and Becoming) |
| A4 Civic & community gatherings | gathering, forum, memorial, networking, residency, retreat, meeting, community | Toronto, four-condition test | researched + wired (Empire/Canadian/Economic clubs, Board of Trade, CIC, City commemorations) |
| A5 Protests & civic action | protest | Toronto, confirmed-only | researched + wired (labour councils, CUPE/OPSEU/OFL, OHC, ACORN, MWAC, Free Grassy, KAIROS) |
| A6 Calls for papers | cfp | GLOBAL (deadline answerable from anywhere) | researched + wired (PhilEvents, UPenn, H-Net, WikiCFP, CFPList, association pages). Prompt rule rewritten global |
| A7 Writing & literary contests | contest | GLOBAL | researched + wired (Poets & Writers, Reedsy, Submittable, Winning Writers, CBC, CAA). Prompt rule rewritten global |
| A8 Film screenings with discussion | screening | Toronto | researched + wired (Fox, Innis/CSI [closed May 4–Aug 21 2026], TMU Image Arts, York/Nat Taylor, AGO cinema, Goethe) |
| A9 Global university philosophy & humanities | lecture, conference, workshop, talk, panel, symposium, colloquium, cfp | worldwide university, philosophy, humanities, and opportunity sources | researched + wired 2026-06-29 (UCHV, major humanities centers, philosophy societies, CFP networks, fellowships; routes `/university/`, `/philosophy/`, `/humanities/`, `/cfps/`, `/lectures/`, `/fellowships/`) |

## Pipeline B — festivals (`festivals-sources.json`)

| Task | Categories | Scope | Status |
|---|---|---|---|
| B1 Performing-arts festivals & venues | festival-of-form, festival, performance | Toronto + GTA | researched + wired. Festivals → festivals roster; venues/companies (Massey/RTH, TSO, COC, National Ballet, TO Live, Koerner, Mirvish, Soulpepper, theatres, dance/new-music) → `sources.json` |
| B2 Heritage & cultural festivals | cultural-reproduction, celebration | Toronto + GTA | researched + wired (Caribana, JerkFest, Taste of Little Italy, Do West, Ukrainian, Manila, Korean, Indigenous Arts Festival, Panorama India, Emancipation). cultural-reproduction now 21 primary entries |
| B3 Galleries & museums | exhibition, site-specific-art | Toronto + GTA | researched + wired (AGO, ROM, MOCA, Power Plant, Gardiner, Aga Khan, Textile, Bata, university + artist-run + commercial galleries). Toronto Biennial as festival node |

## Cross-cutting

| Pass | Scope | Status |
|---|---|---|
| GTA-suburbs sweep | Peel, Halton, York Region, Durham, Toronto inner suburbs — all categories | researched + wired. Venues (Living Arts Centre, The Rose, Flato Markham, RHCPA, Burlington PAC, suburban galleries, BiblioCommons libraries) → `sources.json`; suburban festivals (Markham Village Music, TD Markham Jazz, World of Threads, Taste of Asia) → festivals roster |

## Empty / non-target categories
`other` is a catch-all, never a hunt target. `protest`, `community`, `podcast-live`,
`philosophy-cafe`, `cfp`, `contest` were empty in the served set before this pass and
are now sourced.

## Notes carried in the rosters
- Caribana conflation: official organizer is the Festival Management Committee
  (torontocarnival.ca); caribanatoronto.com is a licensed reseller.
- Afrofest / Salsa show date drift across aggregators — hard-pin to organizer.
- Tirgan is biennial — confirm a 2026 Toronto edition before assuming annual.
- Taste of the Danforth returns Aug 7–9 2026 after a two-year hiatus.
- Discovery hostnames may never appear as a record's `source_url`
  (`merge_festivals.py` enforces this).
