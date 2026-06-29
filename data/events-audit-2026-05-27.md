# Seminar Schools Calendar — Full Event Audit
## State as of May 27, 2026

This document is the complete inventory of every event currently seeded in the calendar's manual dataset. The dataset is committed to `/site/data/manual-events.json` and propagates to `/site/seminars/events.json` (81 records) and `/site/festivals/events.json` (50 records, since exhibition-class events route to both feeds via the site-specific-art type tag).

---

## Top-line numbers

- **Total events:** 81
- **Past (entirely ended before May 27 2026):** 13
- **Future or currently running:** 68
- **Multi-day events (have an end_date):** 41
- **Source domains covered:** 30
- **Date range:** April 17 2026 → November 15 2026
- **Confidence:** 64 events at 100% (manual-curated, verified at source), 17 events at 85-95% (manual-curated with one degree of inference on time/format)

---

## Type distribution

| Type | Count | What it captures |
|---|---|---|
| festival-of-form | 27 | Durational non-institutional practice; Shaw productions, jazz festival sub-events, NXNE, Hillside, TIFF, Hot Docs |
| cultural-reproduction | 15 | Diasporic form-of-life; Caribana sub-events, Mississauga food/heritage festivals, AFROFEST, Pride sub-events |
| reading | 9 | TPL Salon Series author talks, Lindberg, Eden Mills Writers' Fest, MOTIVE, TIFA |
| lecture | 8 | Single-speaker scholarly or public lectures (most U of T-adjacent Agora seeds) |
| site-specific-art | 8 | Exhibitions; AGO three openings, Aga Khan Game On!, Power Plant Spring/Summer, CONTACT, Nuit Blanche |
| panel | 6 | Multi-speaker workshops; Bioethics, Moral Psych, CMS colloquium, Munk language politics, NXNE Sync Awards, Ian Hacking memorial |
| gathering | 4 | Parades and rallies; Pride parade, Trans March, Dyke March, Luminato Indigenous Day |
| scholar-talk | 2 | Academic department colloquia (Waterloo, Guelph Jazz Colloquium) |
| screening | 1 | imagineNATIVE Opening Night |
| artist-talk | 1 | imagineNATIVE Art Crawl |

---

## Inventory by source category

### Shaw Festival (10 events)

Niagara-on-the-Lake. Verified at shawfest.com. Most run as long multi-month residencies starting May 26 2026 (opening day of festival season), closing dates vary by production.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-05-26 | 2026-10-03 | Funny Girl | festival-of-form |
| 2026-05-26 | 2026-09-27 | The Wind in the Willows | festival-of-form |
| 2026-05-26 | — | Sleuth | festival-of-form |
| 2026-05-26 | — | Jeeves & Wooster in Perfect Nonsense (Canadian premiere) | festival-of-form |
| 2026-05-26 | — | Amadeus | festival-of-form |
| 2026-05-26 | — | One for the Pot | festival-of-form |
| 2026-05-26 | — | Heartbreak House | festival-of-form |
| 2026-05-26 | — | Ohio State Murders | festival-of-form |
| 2026-11-15 | 2026-12-23 | A Year with Frog and Toad (holiday) | festival-of-form |
| 2026-11-15 | 2026-12-23 | Rodgers + Hammerstein's Cinderella (holiday) | festival-of-form |

**Note:** rows with no end_date are single-night entries in the dataset that may need broader date-range coverage in a future scrape. Productions like Sleuth run multiple nights per week through the season — the current data captures opening night and treats the run as implicit.

### Toronto Public Library Salon Series (7 events)

Bram and Bluma Appel Salon, 789 Yonge Street + North York Central Library Concourse Event Space. Verified at torontopubliclibrary.ca/programs-and-classes/appel-salon/.

| Date | Title | Speaker | Type |
|---|---|---|---|
| 2026-04-22 | TPL Salon Series at Appel Salon | (placeholder, pre-Pass 1) | lecture |
| 2026-05-27 | The Cree Word for Love | **Tracey Lindberg** (North York Central) | reading |
| 2026-05-28 | Library of Brothel | Anakana Schofield | reading |
| 2026-06-08 | Toni at Random | Dana A. Williams | reading |
| 2026-06-11 | The Vinyl Diaries | Pete Crighton | reading |
| 2026-06-17 | The Glorians | Terry Tempest Williams | reading |
| 2026-06-22 | The Connection Cure | Julia Hotz | reading |

**Note:** Lindberg event is the one your screenshot flagged. It is now in the dataset. The April 22 entry is a generic placeholder from Pass 1 and could be cleaned up.

### Toronto Caribbean Carnival / Caribana (6 events)

Verified at caribanatoronto.com and torontocarnival.ca. 59th year.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-13 | — | Caribana Official Launch 2026 | cultural-reproduction |
| 2026-07-11 | — | Junior King & Queen Showcase | cultural-reproduction |
| 2026-07-30 | 2026-08-03 | Toronto Caribbean Carnival 2026 (main festival) | cultural-reproduction |
| 2026-07-31 | — | King & Queen Showcase | cultural-reproduction |
| 2026-08-01 | — | Grand Parade | cultural-reproduction |
| 2026-08-02 | — | Pan Alive / Closing Day | cultural-reproduction |

### Toronto Jazz Festival (8 events)

Verified at torontojazz.com. 39th edition. Plus Guelph Jazz Festival as a related but separate festival.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-19 | 2026-06-28 | Toronto Jazz Festival 2026 (umbrella) | festival-of-form |
| 2026-06-21 | — | Laila Biali at Jazz Bistro | festival-of-form |
| 2026-06-23 | — | Emilie-Claire Barlow at Koerner Hall | festival-of-form |
| 2026-06-26 | 2026-06-27 | Norma Winstone with Atlantic Jazz Collective | festival-of-form |
| 2026-06-27 | — | Hiromi's Sonicwonder at Koerner Hall | festival-of-form |
| 2026-06-27 | — | Ibrahim Maalouf T.O.M.A. at Danforth Music Hall | festival-of-form |
| 2026-09-10 | 2026-09-11 | Guelph Jazz Festival Colloquium 2026 | scholar-talk |
| 2026-09-11 | 2026-09-13 | Guelph Jazz Festival 2026 | festival-of-form |

### Pride Toronto (4 events)

Verified at pridetoronto.com. 45th anniversary, theme "We Won't Stop."

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-25 | 2026-06-28 | Pride Toronto 2026 (umbrella) | cultural-reproduction |
| 2026-06-26 | — | Toronto Trans March | gathering |
| 2026-06-27 | — | Toronto Dyke March | gathering |
| 2026-06-28 | — | Pride Toronto Parade | gathering |

### Art Gallery of Ontario (3 events)

Verified at ago.ca. All exhibition openings, with end-dates extending into 2027.

| Opens | Closes | Title | Curator/Subject |
|---|---|---|---|
| 2026-06-01 | 2026-12-31 | The Impressionist Revolution: Monet to Matisse | (Dallas Museum of Art, Canadian debut) |
| 2026-09-01 | 2027-01-31 | Melissa Auf der Maur: My '90s Photographs | Melissa Auf der Maur (artist) |
| 2026-10-17 | 2027-02-28 | Sunday Best: An exhibition of Black style and self-fashioning | Julie Crooks + Jason Cyrus (curators) |

### Munk School (2 events)

Verified at munkschool.utoronto.ca. Both 2026.

| Date | Title | Type |
|---|---|---|
| 2026-05-27 | The Changing Politics of Language: Europe and Beyond | panel |
| 2026-06-16 | The Algorithmic State: Sovereignty, Safety, and the Governance of Public Sector AI | lecture |

### University of Toronto Philosophy (3 events)

Verified via philevents.org. Includes the larger Jackman Humanities Annual Lecture seeded in Pass 1.

| Date | End | Title | Organizers/Type |
|---|---|---|---|
| 2026-06-05 | — | Jackman Humanities Annual Lecture | lecture |
| 2026-06-12 | 2026-06-13 | Third Annual Toronto Bioethics Workshop | Franklin-Hall, Mathison (panel) |
| 2026-11-07 | — | Toronto Workshop on Moral Psychology and Moral Theory | panel |

### Centre for Medieval Studies (1 event)

Verified at medieval.utoronto.ca.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-10-29 | 2026-10-31 | Toronto-Cologne Graduate Student Colloquium 2026 | panel |

### Aga Khan Museum (1 event)

Verified at agakhanmuseum.org.

| Opens | Closes | Title | Type |
|---|---|---|---|
| 2026-04-03 | 2026-09-07 | Game On! Exhibition | site-specific-art |

### Power Plant (1 event)

Verified at thepowerplant.org. Note: this is a season-bundle entry; individual artist talks and exhibition-specific openings within the program are not yet broken out.

| Opens | Closes | Title | Type |
|---|---|---|---|
| 2026-04-25 | 2026-09-07 | Power Plant Spring/Summer 2026 Exhibition Program | site-specific-art |

### University of Waterloo (1 event)

Verified at uwaterloo.ca/philosophy/.

| Date | Title | Speaker | Type |
|---|---|---|---|
| 2026-05-27 | Karolina Krzyżanowska on Experimental Epistemology of Figleaves | Krzyżanowska | scholar-talk |

### CONTACT Photography Festival (2 events)

Verified at contactphoto.com.

| Opens | Closes | Title | Type |
|---|---|---|---|
| 2026-05-26 | 2026-06-15 | Sin Wai Kin: ESSENCE | site-specific-art |
| 2026-05-26 | 2026-08-29 | April Hickox: Vantage Point – Passing | site-specific-art |

### imagineNATIVE Film + Media Arts Festival (3 events)

Verified at imaginenative.org.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-02 | 2026-06-07 | imagineNATIVE Film + Media Arts Festival 2026 (in-person) | festival-of-form |
| 2026-06-02 | — | imagineNATIVE Opening Night: AKI | screening |
| 2026-06-04 | — | imagineNATIVE Art Crawl | artist-talk |

### Luminato Festival (2 events)

Verified at luminatofestival.com. 20th anniversary year.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-03 | 2026-06-28 | Luminato Festival 2026 (umbrella) | festival-of-form |
| 2026-06-06 | — | The Power of Land — Indigenous Programming Day | gathering |

### Toronto International Festival of Authors / IFOA (2 events)

Verified at festivalofauthors.ca.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-05 | 2026-06-06 | MOTIVE Crime & Mystery Festival 2026 (TIFA) | reading |
| 2026-10-27 | 2026-11-01 | Toronto International Festival of Authors 2026 (TIFA) | reading |

### NXNE (2 events)

Verified at nxne.com. 31st edition.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-10 | 2026-06-14 | NXNE Music Festival 2026 | festival-of-form |
| 2026-06-11 | — | Canadian Sync Awards / NXNE 2026 | panel |

### Mississauga events (3 events)

Three separate festivals at Mississauga venues; verified at mississaugapolishdays.com, halalfoodfest.com/mississauga/, mississauga.ca/events/. **Audit flag:** these are exactly the URLs that an earlier audit identified as aggregator-substitutes; the first real scrape pass should re-verify them.

| Date | End | Title | Type |
|---|---|---|---|
| 2026-06-05 | 2026-06-06 | Mississauga Polish Days 2026 | cultural-reproduction |
| 2026-06-12 | 2026-06-13 | Mississauga Halal Food Festival 2026 | cultural-reproduction |
| 2026-06-27 | 2026-06-28 | Mississauga Taco Fest 2026 (debut) | cultural-reproduction |

### Single-event sources (10 events, alphabetical by source)

| Source | Date | End | Title | Type |
|---|---|---|---|---|
| afrofest.ca | 2026-08-14 | 2026-08-16 | AFROFEST 2026 | cultural-reproduction |
| bollywoodmashup.ca | 2026-07-24 | 2026-07-26 | BollywoodMonster Mashup 2026 | cultural-reproduction |
| festivalofsouthasia.ca | 2026-07-11 | 2026-07-12 | TD Festival of South Asia 2026 (24th) | cultural-reproduction |
| harbourfrontcentre.com | (varied; Pass 1 single entry) | — | Harbourfront programming | (varies) |
| hftco.ca | 2026-07-15 | 2026-07-26 | Hamilton Fringe Festival 2026 | festival-of-form |
| hillsidefestival.ca | 2026-07-17 | 2026-07-19 | Hillside Festival 2026 | festival-of-form |
| improvisationinstitute.ca | (Pass 1) | — | Improvisation Institute | (varies) |
| kitchenerbluesfestival.com | 2026-08-06 | 2026-08-09 | TD Kitchener Blues Festival 2026 | festival-of-form |
| niagarafilmfest.com | 2026-06-06 | 2026-06-07 | Niagara Canada International Film Festival 2026 | festival-of-form |
| salsaintoronto.com | 2026-07-11 | 2026-07-12 | TD Salsa on St. Clair 2026 | cultural-reproduction |
| sosfest.ca | 2026-07-31 | 2026-08-02 | SOS Fest (Summer Soca Festival) Mississauga 2026 | cultural-reproduction |

### Other events (4)

Events that didn't categorize cleanly into the above buckets:

| Date | End | Title | Type |
|---|---|---|---|
| 2026-09-10 | 2026-09-20 | Toronto International Film Festival 2026 (TIFF, 51st) | festival-of-form |
| 2026-09-11 | 2026-09-13 | Supercrawl 2026 (Hamilton, 17th edition) | festival-of-form |
| 2026-09-18 | 2026-09-20 | Eden Mills Writers' Festival 2026 | reading |
| 2026-10-03 | 2026-10-04 | Nuit Blanche Toronto 2026 (20th anniversary, "Tomorrow's Memories") | site-specific-art |
| 2026-11-11 | 2026-11-15 | Mighty Niagara Film Fest 2026 | festival-of-form |

### Seminar Schools / Agora seeds (6 events)

These are Saul's own events seeded directly into the dataset via seminarschools.com URLs. **Audit flag:** five of six have dates in April-May 2026, mostly past as of today. The Agora series will need fresh dated entries for Summer-Fall 2026.

| Date | Title | Type |
|---|---|---|
| 2026-04-17 | Rebecca Comay on Mourning Sickness | lecture |
| 2026-04-25 | Massey Dialogues | lecture |
| 2026-05-02 | Cheryl Misak on Frank Ramsey | lecture |
| 2026-05-09 | Ian Hacking Memorial Symposium | panel |
| 2026-05-14 | ROM Speaks on archaeology and memory | lecture |
| 2026-05-21 | Ethics@Noon-ish weekly talk | lecture |

---

## Calendar density by month

| Month | Events starting | Notes |
|---|---|---|
| April 2026 | 5 | Mostly past (Shaw opens, AGO Sunday Best precursor, Aga Khan Game On!, Pass 1 Agora seeds) |
| May 2026 | 18 | Shaw opening, CONTACT, May 27 cluster (Lindberg + Munk + Waterloo + Krzyżanowska) |
| **June 2026** | **31** | **Peak month.** Luminato, Pride, NXNE, Caribana launch, MOTIVE, Bioethics Workshop, Munk lectures, multiple TPL Salon, AGO Monet opening, Toronto Jazz, imagineNATIVE, Niagara Film, multiple Mississauga festivals |
| July 2026 | 9 | Bollywood Mashup, Salsa on St. Clair, Festival of South Asia, Hamilton Fringe, Hillside, SOS Fest start, Caribana run-up |
| August 2026 | 4 | Caribana climax (Grand Parade, Closing Day), AFROFEST, Kitchener Blues |
| September 2026 | 6 | TIFF, Supercrawl, Eden Mills, Guelph Jazz, AGO Auf der Maur opening |
| October 2026 | 4 | TIFA, Nuit Blanche, AGO Sunday Best opening, CMS Toronto-Cologne |
| November 2026 | 4 | Moral Psych Workshop, Mighty Niagara Film Fest, Shaw holiday productions begin |

**Gap warning:** December 2026 has zero seeded events. January-March 2027 also empty — these will populate when scraper runs in late August + onward catch the Winter 2027 academic colloquia.

---

## Source domains coverage (full list)

30 unique source domains. Top 10:

1. www.shawfest.com — 10
2. seminarschools.com — 8 (Agora seeds)
3. torontojazz.com — 6
4. www.torontopubliclibrary.ca — 6
5. torontocarnival.ca — 5
6. www.pridetoronto.com — 4
7. imaginenative.org — 3
8. ago.ca — 3
9. contactphoto.com — 2
10. festivalofauthors.ca — 2

Remaining 20: each contributes 1-2 events. Long tail of one-festival-per-venue.

---

## Audit findings

### Data hygiene issues caught during this audit

1. **Five Mississauga-area source URLs are flagged as possible aggregator-substitutes.** The first real scrape pass needs to verify these resolve to canonical pages: mississaugapolishdays.com, niagarafilmfest.com, halalfoodfest.com/mississauga/, mississauga.ca/events/, bollywoodmashup.ca, sosfest.ca. (This is the same flag carried from V12 audit notes.)
2. **TPL April 22 entry is a generic Pass 1 placeholder.** It says "TPL Salon Series at Appel Salon" with no specific author or talk. Recommend removing or replacing with a specific past entry for archival accuracy.
3. **Shaw Festival productions lack end_date on six of ten records.** Sleuth, Jeeves & Wooster, Amadeus, One for the Pot, Heartbreak House, and Ohio State Murders are seeded as single-night entries despite running multi-month seasons. The first scrape pass should fill in end_dates from shawfest.com.
4. **Power Plant entry is season-bundle only.** No individual artist talks or exhibition openings within the Spring/Summer program are broken out. Manual research could surface 3-5 specific artist-talk dates if needed.
5. **Agora seeds are all past as of May 27.** Saul's own seminarschools.com events from Pass 1 cover April-May 2026 only. The Agora needs Summer-Fall 2026 dated entries.
6. **One festival is mislabeled by source association.** "Hamilton Fringe Festival 2026" is sourced from hftco.ca (Hong Fook Mental Health Association), which doesn't run Hamilton Fringe. The actual organizer is hamiltonfringe.ca. Source URL needs correction.

### Coverage gaps where category exists but no events seeded

- **December 2026 through April 2027:** zero events. Fall 2026 university colloquia hadn't posted at search time. Winter 2027 colloquia post November-December.
- **Theological colleges:** Knox, Wycliffe, Regis, Trinity, Emmanuel, Tyndale all run public lectures on weekly cycles; none has surfaced a specific dated future lecture at search time.
- **York University, OCAD, Brock, Guelph (academic departments):** no specific dated events at search time.
- **Indigenous-led venues:** Native Canadian Centre of Toronto and Woodland Cultural Centre both run frequent programming; events not posted on a publicly-searchable calendar.
- **Toronto Public Library branches beyond Salon Series:** thousands of branch programs, currently unrepresented. Needs scraper + seminar-shape hard gate.
- **Centre for Ethics @ U of T:** events page shows "No events" in JS-rendered view; Fall 2026 lineup populates late August.
- **ROM Speaks Fall 2026:** lineup not yet announced.
- **Aga Khan Museum lectures beyond Game On!:** the museum runs a regular lectures-and-talks program; only the headline exhibition is seeded.

### Confidence levels

- **64 events at confidence 100:** Pass 1 manual curation, plus all directly-verified TPL Salon, Munk, Bioethics, Moral Psych, Waterloo, Lindberg, AGO Sunday Best, AKM Game On!, CMS Toronto-Cologne entries.
- **17 events at confidence 85-95:** Pass 2 entries where I inferred or estimated one field (typically the precise time of day, or the official opening hour for a multi-day exhibition).

### Type-distribution health

Festival-of-form at 27 is healthy — these are the substrate the festivals page surfaces. Lecture (8), reading (9), panel (6), scholar-talk (2) together = 25 academic-shaped events; this is the calendar's intellectual spine. Site-specific-art at 8 catches exhibitions appropriately. Gathering (4) covers parades and Indigenous programming day. Screening (1) and artist-talk (1) are thin — could grow if Power Plant and imagineNATIVE individual events were broken out.

---

## What changed between Pass 1 and Pass 2

- Pass 1 delivered the 64-event base seed: heavy festivals coverage, light academic coverage, one TPL placeholder.
- Pass 2 added 17 events focused on academic gap-fill: U of T Philosophy (2), Munk (2), Waterloo (1), TPL Salon authors (6 including Lindberg), AGO exhibitions (3), Aga Khan (1), Power Plant (1), CMS (1).
- The structural pattern: Pass 2 was constrained by the seasonal calendar. Mid-May to late-August is the academic dead zone; Fall colloquia haven't posted yet. The lifting still to do is automated, not manual.

---

## Recommended next moves

1. **C2 OAuth activation (Saul-side):** running `claude setup-token` locally, then adding `CLAUDE_CODE_OAUTH_TOKEN` as a GitHub secret. This is the bottleneck. Without it, the scraper can't run.
2. **Expand sources.json from 23 to ~100 sources** (next turn if requested). The list of categories to add was documented in the prior turn: library systems, indie bookstores, smaller universities, art galleries, Indigenous venues, theological colleges, civic centres, festival year-round programming arms.
3. **Cron change: weekly → daily.** One line in `.github/workflows/scrape-seminars.yml`.
4. **Seminar-shape verification as hard gate** in scripts/seminars-prompt.md, matching the architecture already in scripts/festivals-prompt.md.
5. **Late-August comprehensive research pass** to capture Fall 2026 academic lineups as they post.
6. **Data hygiene cleanups** (this turn or next):
   - Remove/replace the April 22 TPL placeholder.
   - Backfill Shaw Festival end_dates.
   - Correct the Hamilton Fringe source URL.
   - Verify the six aggregator-flagged URLs on first scrape.

---

*Document generated: May 27, 2026. Data version: V13 (post-Pass-2 research).*
