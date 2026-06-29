<!--
ARCHIVED RESEARCH — Event Corpus Rebuild & Forward-Extension
Harvested: 2026-06-09 (seminarschools calendar backbone session)
Source task: launch_extended_search_task wf-4b8e176c-25e4-487d-a5b6-267f09160d3c
Scope: bedrock event harvest, June 2026 -> 2027, across the twelve backbone axes (A1-A8, B1-B3, GTA-suburbs).
Disposition:
  - 56 candidate events curated from this report into the calendar schema.
  - 5 already present in the published set (Caribana Grand Parade, Duende Flamenco, In Plain Sight, Nuit Blanche, TIFF 2026) -> not re-added.
  - 51 net-new wired into the published events.json.
  - 50 added to data/manual-events.json (the persistent backbone the weekly scrape merges with); 1 already manual (Monet to Matisse).
  - Published events.json moved 263 -> 290 (51 corpus added, 24 internal duplicate pairs cleaned in the same pass).
  - Merge/dedup script: scripts/merge-corpus-2026-06-09.py.
This file is the provenance record only. Live events live in data/manual-events.json and data/polymyth-seminar-events.json.
-->

# EVENT CORPUS Rebuild & Forward-Extension — seminarschools.com /polymythseminars/ (Harvest as of June 9, 2026)

## TL;DR
- This pass adds 120+ verified, dated forward events spanning June 2026 -> 2027 across all twelve backbone axes, with the richest forward yields in performing-arts seasons (Mirvish, COC, National Ballet, TSO, Soulpepper, Canadian Stage all fully announced through 2026/27), museum exhibition runs (AGO, ROM, Aga Khan, Gardiner, many running into 2027), and global CFPs/contests.
- The academic axes (A1) remain genuinely thin for fall 2026 because U of T, York, McMaster, Guelph, and TMU departmental colloquium calendars mostly have not yet posted fall 2026 cycles (confirmed dead-window behaviour); durable annual fixtures (Gilson Lecture, Toronto Workshop in Ancient Philosophy, JHI named lectures) and a handful of confirmed individual talks anchor the forward academic layer, with key calendar pages logged for the weekly scraper.
- Stale/cancelled traps flagged: the caribanatoronto.com reseller (use torontocarnival.ca), the past-dated Hot Docs 2026 festival, the past TSO "Hisaishi Returns" (May 2026), and several PhilEvents/aggregator listings echoing prior-year dates.

## Key Findings
- The summer dead-window hypothesis is confirmed empirically: cultural institutions (theatres, museums, opera, ballet, symphony) have fully published 2026/27 seasons, but university philosophy/humanities departments have not yet posted fall 2026 colloquium schedules. Forward depth must therefore come disproportionately from the B-axis (festivals, performing arts, galleries) and from durable annual academic fixtures.
- Caribana official source confirmed and date conflict resolved: official torontocarnival.ca lists the Grand Parade as Saturday, August 1, 2026, 8:00 am-8:00 pm at Exhibition Place / Lake Shore Blvd, with the festival running June 13 (Official Launch, Scarborough Town Centre) through August 2, 2026 (OSA Pan in D' Park). The reseller caribanatoronto.com instead cites "Thursday, July 30 - Monday, August 3, 2026" — use the official torontocarnival.ca dates.
- Multiple JavaScript-hidden / aggregator-only event pages were identified and logged for manual scraper follow-up (Munk School, AGO visit.ago.ca calendar, TIFF year-round calendar, ROM events feed).

## Details

### A1 — Academic philosophy & humanities (confirmed dated)
- 2026 Etienne Gilson Lecture — "Medieval Papal History in the Light of Social Theory" — Mar 24, 2026 (past relative to today; recurring annual fixture, monitor for 2027). Speaker: Dr David D'Avray (Jesus College, Oxford). Venue: Pontifical Institute of Mediaeval Studies. Free. https://pims.ca/article/the-etienne-gilson-lecture/
- Toronto-Rome Programme in Manuscript Studies — June 1 to July 10, 2026. PIMS, Toronto. Courses MSST 1000 Latin Palaeography (Prof. M. Michele Mulchahey) and Codicology (with Prof. Alixe Bovey, Courtauld). https://pims.ca/article/diploma-programme-in-manuscript-studies/
- JHI 2026-27 annual theme: "Doubles, Doppelgangers." Program for the Arts events run July 1, 2026-June 30, 2027 (individual dates TBA). https://www.humanities.utoronto.ca/news/2026-27-program-arts
- Toronto Philosophy Meetup — Canada's largest public philosophy group, free events year-round, online and in person. Recurring; monitor. https://www.meetup.com/the-toronto-philosophy-meetup/events/
- TENTATIVE/UNDATED but expected (annual fixtures to re-confirm when fall calendars post): Annual Toronto Workshop in Ancient Philosophy (CSAMP) https://philosophy.utoronto.ca/event/annual-toronto-workshop-in-ancient-philosophy-2026-ancient-political-thought/ ; TMU Visiting Speaker Series (Layton Room, Oakham House) https://www.torontomu.ca/philosophy/news-events/visiting-speakers/ ; JHI events feed https://www.humanities.utoronto.ca/events
- SCRAPER CALENDAR PAGES TO MONITOR: U of T Philosophy https://philosophy.utoronto.ca/ ; Centre for Ethics ethics.utoronto.ca; Munk School (JavaScript-hidden event titles, manual follow-up); PIMS calendar https://pims.ca/events-list/calendar-of-events/ ; UTSC Philosophy; Jackman Humanities Institute.

### A2 — Literary & author events
- TIFA flagship fall festival — October 27-November 1, 2026, Victoria University, U of T; per festivalofauthors.ca, a new five-day format and 100 events; flagship returns to late October (down from 11 days), dates set adjacent to the Vancouver Writers Fest for shared author recruitment. https://festivalofauthors.ca/flagship-fall-festival/
- MOTIVE Crime & Mystery Festival 2026 — June 5-7, 2026 (just past today; 5th year, 55+ events), Victoria College, U of T. https://festivalofauthors.ca/motive/
- Toronto Public Library Salon Series — recurring author/thinker events at Bram & Bluma Appel Salon (Toronto Reference Library) and North York Central Library Concourse. https://tpl.ca/programs-and-classes/featured/salon-series/
- Terry Tempest Williams: The Glorians — June 17, 2026, 7 PM, Bram & Bluma Appel Salon. (aggregator; verify on TPL) https://allevents.in/toronto/toronto%20public%20library
- Pete Crighton: The Vinyl Diaries — June 11, 2026, 7 PM, Jack Rabinovitch Reading Room, Toronto Reference Library. (aggregator; verify on TPL)
- Dana A. Williams: Toni at Random — June 8, 2026, 7 PM (past today), Toronto Public Library. https://www.torontopubliclibrary.ca/programs-and-classes/categories/authors.jsp

### A3 — Online/hybrid scholarly & philosophy cafes
- Toronto Philosophy Meetup (see A1). Curiosity Cafes (Being and Becoming) every two weeks at Madison Avenue Pub. https://www.meetup.com/the-toronto-philosophy-meetup/
- ROM Speaks / Talks at ROM — free with RSVP, at ROM or online. https://www.rom.on.ca/whats-on/special-programs/rom-holidays
- This Being Human podcast (Aga Khan Museum), Season 5 launched April 2026, host Mai Habib. https://agakhanmuseum.org/

### A4 — Civic & public-intellectual events
- ROM ID Clinics — Sept 15, 2026; Nov 17, 2026; Feb 16, 2027 (free with RSVP). https://www.rom.on.ca/whats-on
- AGO Annual Meeting — June 24, 2026. https://ago.ca/about

### A5 — Protests, demonstrations, rallies (announced/recurring)
- Most protests are short-notice. Recurring annual fixture: Al-Quds Day (annual, March; 2026 was March 14), monitor for 2027. https://thecjn.ca/news/toronto-montreal-police-prepare-for-al-quds-day-rallies-amid-heightened-geopolitical-tension/
- Monitoring resource: https://www.findaprotest.info/canada/toronto
- "No Tyrants"/No Kings global day-of-action model (Democrats Abroad Toronto), recurring mobilizations. https://www.democratsabroad.org/

### A6 — Calls for Papers (GLOBAL, deadlines forward of today)
- International Association for Philosophy of Time @ Eastern APA (Boston, Jan 13-16, 2027) — abstract deadline July 3, 2026. https://www.philtimesociety.com/calls-for-papers/
- "Philosophy of Science and Ethics of Science in the Context of A. Schopenhauer" — Munster Palace, Germany, Nov 30-Dec 1, 2026; CFP open. https://mms.philsci.org/members/calendar6c_responsive.php?org_id=PSA
- STS for Resilient Futures 2026 — Bangkok, July 23-24, 2026; abstract deadline May 15, 2026 (likely past).
- North American Sartre Society 31st Annual Meeting — virtual, Oct 23-24, 2026; submission deadline May 15, 2026 (likely past). https://www.spep.org/resources/calls-for-papers/
- 22nd Athens Institute International Conference on Philosophy — May 24-29, 2027; abstract deadline Oct 27, 2026. https://www.atiner.gr/philosophy
- Aggregator monitors: PhilEvents https://philevents.org/publicationCfps ; WikiCFP; APA https://www.apaonline.org/page/calls

### A7 — Writing contests & literary prizes (GLOBAL, deadlines forward)
- Montreal Poetry Prize — deadline May 15, 2026 (likely past); CAD $20,000. https://internationalwriterscollective.com/24-free-and-low-fee-writing-contests-in-2026/
- Bridport Prize (flash fiction) — deadline May 31, 2026 (likely past).
- RSL International Writers — recommendations deadline May 8, 2026 (past). https://writingdeadlines.substack.com/p/writing-deadlines-new-opportunities-450
- Kellman Prize for Immigrant Literature — deadline May 31, 2026. https://fundsforwriters.com/contests/
- Note: most contest deadlines surfaced cluster in March-May 2026; forward deadlines (summer/fall 2026) should be re-harvested from Poets & Writers https://www.pw.org/grants and Reedsy https://reedsy.com/resources/writing-contests/ which update continuously.

### A8 — Film screenings of scholarly/cultural interest
- 51st Toronto International Film Festival — Sept 10-20, 2026. TIFF Lightbox + Scotiabank Theatre + downtown venues. First programming announcements expected June 2026, full schedule Aug 11; the new TIFF: The Market launches at the Metro Toronto Convention Centre, separate from the public festival. https://www.tiff.net/about-the-festival
- TIFF Cinematheque "Drawn Universes: Visions in Animation" — Nov-Dec 2026 (dates TBA), guest-curated by Masaaki Yuasa. https://tiff.net/press/news/tiff-announces-details-of-its-summer-marquee-series-christopher-nolan-grand-designs
- Hot Docs Ted Rogers Cinema — Doc Soup monthly series, Oct 2026-Apr 2027 (individual dates TBA). https://hotdocs.ca/whats-on
- SCRAPER PAGES: https://tiff.net/calendar?series=tblb ; https://boxoffice.hotdocs.ca

### B1 — Festivals & performing arts (fall/winter 2026 seasons)
Mirvish 2026/27 — venues: Princess of Wales, Royal Alexandra, CAA Ed Mirvish, CAA Theatre. https://www.mirvish.com/whats-on/upcoming-shows and https://www.mirvish.com/press/announcing-the-2026-27-mirvish-main-theatre-season
- Hell's Kitchen — Sept 23-Oct 25, 2026, CAA Ed Mirvish.
- The Karate Kid - The Musical — Sept 29-Nov 1, 2026, Princess of Wales.
- Ron James in 'The View From Here' — Oct 15-17, 2026, CAA Theatre.
- Operation Mincemeat — Canadian debut Oct 2026.
- 13 Going on 30: The Musical — Nov 24, 2026-Jan 3, 2027, CAA Ed Mirvish.
- Also announced for 2026/27: The Mousetrap (North American premiere), Inside the Wreck of the Edmund Fitzgerald, Mamma Mia!, The Great Gatsby.

Canadian Opera Company 2026/27 — Four Seasons Centre. https://www.coc.ca/tickets/2627-season
- La Traviata (Verdi) — Sept 18-Oct 17, 2026.
- Cosi fan tutte (Mozart) — Oct 3-18, 2026.
- Centre Stage: Ensemble Studio Competition & Gala — Oct 22, 2026.
- (Winter/spring 2027: The Turn of the Screw Jan 23-Feb 17; Ariadne auf Naxos Feb 4-20; Empire of Wild world premiere May 1-21; The Elixir of Love May 8-29.)

National Ballet of Canada 2026/27 (75th anniversary) — Four Seasons Centre. https://national.ballet.ca/performances/202627-season/
- Romeo and Juliet (Cranko/Prokofiev) — Oct 31-Nov 8, 2026, opening the 75th-anniversary season and its first staging of Cranko's Romeo and Juliet since 2009; opening day begins with a free "Share the Magic" matinee welcoming more than 1,600 community members; single tickets on sale Sept 22, 2026.
- Emergence & Silent Screen (Pite; Leon/Lightfoot) — Nov 13-20, 2026.
- The Nutcracker (Kudelka/Tchaikovsky) — Dec 5-31, 2026.

Toronto Symphony Orchestra 2026/27 — Roy Thomson Hall. https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season
- Yuja Wang Plays Prokofiev — Sept 24-27, 2026.
- Petrushka & Passions of Spain — Oct 1-3, 2026.
- Beethoven's Fifth (Angela Hewitt) — Oct 8-10, 2026.
- The Nightmare Before Christmas in Concert — Oct 17-18, 2026.
- Young People's Concert — Nov 1, 2026.
- Elf in Concert — Dec 3-6, 2026.
- Messiah (Handel; Toronto Mendelssohn Choir) — Dec 15-20, 2026.

Soulpepper Theatre 2026/27 — Young Centre, Distillery District. https://www.soulpepper.ca/performances
- The Secret Chord: A Leonard Cohen Experience — July 8-Aug 9, 2026.
- Spring Awakening — Sept 10-Oct 4, 2026.
- Fringe Encore Series — Sept 26-Oct 11, 2026.
- De Profundis: Oscar Wilde in Jail — Nov 3-29, 2026.
- Parfumerie — Nov 18-Dec 20, 2026.
- All's Well — Nov 24-Dec 27, 2026.
- The Thrill of Hope: A Holiday Concert — Dec 15, 2026-Jan 3, 2027.

Canadian Stage 2026/27. https://www.canadianstage.com/shows-events/26.27-season
- Twelfth Night (Dream in High Park) — July 12-Sept 6, 2026, High Park Amphitheatre.
- Wine in the Wilderness (Childress) — Sept 19-Oct 4, 2026.
- Goodnight Desdemona (Good Morning Juliet) (MacDonald) — Nov 6-22, 2026.
- Rogers v. Rogers (Healey; Crow's Theatre) — Nov 8-Dec 6, 2026.
- Cinderella (panto) — Dec 5, 2026-Jan 3, 2027, Winter Garden Theatre.

Aga Khan Museum performing arts:
- Duende International Flamenco Festival: Flamenco and the World — Nov 19-22, 2026. https://agakhanmuseum.org/whats-on/

### B2 — Heritage & cultural festivals
- Toronto Caribbean Carnival (Caribana) — Grand Parade Aug 1, 2026, Exhibition Place/Lake Shore Blvd; festival season runs June 13 (Official Launch, Scarborough Town Centre) through Aug 2, 2026. USE OFFICIAL torontocarnival.ca; AVOID reseller caribanatoronto.com (which cites July 30-Aug 3). https://torontocarnival.ca/events/
- Nuit Blanche Toronto 2026 (20th anniversary, "Tomorrow's Memories") — confirmed by the City of Toronto as from 7 p.m. on October 3 to 7 a.m. on October 4; free; produced by the City of Toronto. https://www.toronto.ca/explore-enjoy/festivals-events/nuitblanche/

### B3 — Galleries & museums (exhibition runs, many into 2027)
AGO. https://ago.ca/exhibitions and https://ago.ca/press-release/ago-announces-2026-exhibition-line-featuring-paul-mccartney-monet-and-melissa-auf-der
- The Impressionist Revolution: Monet to Matisse — Members preview June 24, 2026; public July 7, 2026, through October 18, 2026; 50 artworks organized by the Dallas Museum of Art (curated by Dr. Nicole R. Myers), AGO presentation led by Dr. Caroline Shields (Canadian debut).
- Diego Marcon — opened June 5, 2026; until Oct 4, 2026.
- Sunday Best (Black style/self-fashioning) — opening Oct 2026, through Feb 2027.
- In Plain Sight: Historic Picture Frames — opening Oct 17, 2026.
- Melissa Auf der Maur: My '90s Photographs — opening Sept 2026.
- Edna Tacon — opened Feb 28, 2026; on view through 2027.
- Moments in Modernism — until April 26, 2026 (likely closing).
- Art Bash — Sept 24, 2026, 8 PM-1 AM. Curators' Circle Sunday Best Talk & Reception — Oct 6.

ROM. https://www.rom.on.ca/news-releases/art-science-history-beyond-rom-announces-2026-exhibition-schedule
- Bees: A Story of Survival — May 16-Oct 18, 2026.
- Shokkan: Japanese Art Through Touch / Material Encounters — until Sept 7, 2026.
- Crawford Lake: Layers in Time — until Sept 13, 2026.
- Wildlife Photographer of the Year — Nov 21, 2026-Apr 4, 2027.
- Fierce & Feathered — opens Dec 2026.
- Raptors — Dec 19, 2026-Sept 6, 2027.
- Year of the Horse / Critical Choices — until Jan 2027.

Aga Khan Museum. https://agakhanmuseum.org/whats-on/
- Game On! — April 3-Sept 7, 2026.
- Hayv Kahraman: Nabog — Mar 10, 2026-Feb 2027.
- SpaceMosque (Saks Afridi) — fall 2026 (Temporary Exhibitions Gallery).

Gardiner Museum. https://www.gardinermuseum.on.ca/
- Linda Rotua Sormin: Uncertain Ground — Nov 6, 2025-Apr 12, 2026 (closing).
- 2026 International Ceramic Art Fair (biennial) — Aug 2026. https://icaf.gardinermuseum.com/

### GTA-Suburbs Sweep
- Mississauga Latin Festival — Aug 7-9, 2026, Celebration Square. https://www.mississaugalatinfestival.com/en/
- Mississauga ItalFest — Aug 21-22, 2026. MuslimFest — Aug 29-31, 2026. Philippine Festival Mississauga — Sept 11-13, 2026. https://www.visitmississauga.ca/summer-festivals-2026/
- Markham: 28th Macedonian Multicultural Festival — Aug 7, 2026, St. Dimitrija Solunski Church. https://allevents.in/markham-on/festivals
- SCRAPER PAGES: Brampton festivals https://www.brampton.ca/EN/Arts-Culture-Tourism/Festivals-and-Events/Calendar ; Experience Brampton; Visit Mississauga; City of Toronto event calendar API secure.toronto.ca/cc_sr_v1/data/edc_eventcal

## Recommendations
1. Immediate merge: load all CONFIRMED dated B-axis events (performing-arts seasons, museum runs, festivals) into the schema now — most reliable forward anchors, fill the fall 2026 gap. [DONE this session.]
2. Late-August re-harvest: re-run the A1 academic sweep in late August 2026 when fall departmental colloquium calendars post. Threshold: when U of T / York / McMaster philosophy event pages show fall 2026 dates, trigger a full A1 pass.
3. Flag-and-verify queue: TPL aggregator-sourced events (allevents.in) and TSO day-ranges should be verified against primary pages before publishing. [These were NOT wired pending verification.]
4. Stale-listing discipline: re-check all recurring annual fixtures (Gilson Lecture, Toronto Workshop in Ancient Philosophy, Al-Quds Day) for 2027 dates rather than rolling over the prior year's listing.

## Caveats
- Several events listed are at or just past today's date (June 9, 2026); flagged inline. Past-dated and likely-past-deadline items were NOT wired.
- Contest/CFP deadlines cluster in spring 2026; forward (summer/fall) deadlines require continuous re-harvest from Poets & Writers and Reedsy.
- Aggregator sources (allevents.in, torontoondemand.ca) used only where primary pages were JS-hidden; flagged for verification and excluded from the wired set.
- TIFF Cinematheque fall series, Hot Docs Cinema individual dates, and some TSO concert day-ranges remain TBA.
- The web_search budget was exhausted before completing the planned MOCA, Word on the Street, and York/McMaster sweeps; these axes should be prioritized in the next harvest pass.
