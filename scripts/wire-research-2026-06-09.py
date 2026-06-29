#!/usr/bin/env python3
"""Wire the A1-A8 / B1-B3 / GTA-suburbs research passes into the two source
rosters. JSON round-trip, dedup by id, atomic write. Run once on 2026-06-09."""
import json, os, tempfile

SRC = "scripts/sources.json"
FEST = "scripts/festivals-sources.json"
STAMP = "2026-06-09"


def S(sid, name, dtype, url, render, tier=2, base=None, notes=None):
    e = {"id": sid, "name": name, "tier_priority": tier, "default_type": dtype,
         "base_url": base or url, "events_url": url}
    if notes:
        e["notes"] = notes
    e["render_mode"] = render
    return e


def F(fid, name, dtype, url, notes=None, extra=None):
    e = {"id": fid, "name": name, "events_url": url}
    if extra:
        e["additional_urls"] = extra
    e["default_type"] = dtype
    if notes:
        e["notes"] = notes
    return e


def D(did, name, url, notes=None):
    e = {"id": did, "name": name, "events_url": url}
    if notes:
        e["notes"] = notes
    return e


# ---- sources.json additions (Pipeline A venues + B1 performance venues + B3 galleries + suburbs) ----
NEW_SOURCES = [
    # A1 academic philosophy & humanities (beyond the 8 already rostered)
    S("uoft-philosophy", "U of T Department of Philosophy", "lecture", "https://philosophy.utoronto.ca/news-events/", "drupal", 1),
    S("uoft-history", "U of T Department of History", "lecture", "https://www.history.utoronto.ca/events", "drupal", 2),
    S("uoft-english", "U of T Department of English", "lecture", "https://www.english.utoronto.ca/events", "drupal", 2, notes="Bot detection may block direct fetch; use headless/snippet fallback."),
    S("utm-historical", "UTM Department of Historical Studies", "lecture", "https://utm.utoronto.ca/historical-studies/events/events", "drupal", 2),
    S("cms-medieval", "U of T Centre for Medieval Studies", "lecture", "https://www.medieval.utoronto.ca/events", "drupal", 3),
    S("york-events", "York University central events calendar", "lecture", "https://events.yorku.ca/", "javascript", 1, notes="Modern Events Calendar (Webnus) plugin; list views exposed."),
    S("york-philosophy", "York Philosophy Speaker Series", "lecture", "https://www.yorku.ca/laps/phil/experience/speaker-series/philosophy/", "wordpress", 2),
    S("ycar", "York Centre for Asian Research", "lecture", "https://www.yorku.ca/research/ycar/ycar-events/", "javascript", 3),
    S("tmu-philosophy", "TMU Department of Philosophy", "lecture", "https://www.torontomu.ca/philosophy/news-events/", "javascript", 3, notes="Prefer the dept Google Calendar embed and PhilEvents host 17926; main page lags."),
    S("ocadu-events", "OCAD University What's On", "talk", "https://www.ocadu.ca/whats-on", "javascript", 2),
    S("pims", "Pontifical Institute of Mediaeval Studies", "lecture", "https://pims.ca/events-list/calendar-of-events/", "static", 3),
    S("tst", "Toronto School of Theology", "lecture", "https://www.tst.edu/events", "static", 3),
    S("rciscience", "Royal Canadian Institute for Science", "scholar-talk", "https://www.rciscience.ca/whats-on", "static", 2),

    # A2 literary & author events (beyond type-books, ifoa, glad-day)
    S("another-story", "Another Story Bookshop", "reading", "https://anotherstory.ca/events", "javascript", 2, notes="Bookmanager JS; prefer Eventbrite org page."),
    S("queen-books", "Queen Books", "reading", "https://shop.queenbooks.ca/events", "javascript", 2, notes="Bookmanager JS; prefer Eventbrite org page."),
    S("ben-mcnally", "Ben McNally Books", "reading", "https://benmcnallybooks.com/", "static", 3),
    S("a-different-booklist", "A Different Booklist", "reading", "http://adifferentbooklist.com", "static", 3),
    S("flying-books", "Flying Books", "reading", "https://flyingbooks.ca/", "static", 3),
    S("coach-house", "Coach House Books", "book-launch", "https://chbooks.com/Events", "static", 3),
    S("brockton-writers", "Brockton Writers Series", "reading", "https://brocktonwriters.com/", "wordpress", 2),
    S("junction-reads", "Junction Reads", "reading", "https://junctionreads.ca/upcoming-schedule/", "wordpress", 2),
    S("griffin-poetry", "Griffin Poetry Prize Readings", "reading", "https://griffinpoetryprize.com/", "static", 2),
    S("writers-trust", "Writers' Trust of Canada", "reading", "https://www.writerstrust.com/events", "static", 3),
    S("diaspora-dialogues", "Diaspora Dialogues", "reading", "https://diasporadialogues.com/category/upcoming-events/", "wordpress", 3),
    S("art-bar", "Art Bar Poetry Series", "reading", "https://www.instagram.com/artbarpoetry/", "javascript", 3, notes="DO NOT scrape artbarpoetryseries.com -- domain hijacked to casino spam. Schedule only via Instagram @artbarpoetry / artbarpoetry@gmail.com."),

    # A3 online/hybrid scholarly + live podcasts + cafes (beyond philevents, philosophy-cafe-toronto)
    S("royal-inst-philosophy", "Royal Institute of Philosophy", "lecture", "https://royalinstitutephilosophy.org/philosophy-events/", "wordpress", 2, notes="GLOBAL online/hybrid; some events ticketed with recording."),
    S("iai-live", "Institute of Art and Ideas / IAI Live", "talk", "https://iai.tv/", "javascript", 3, notes="GLOBAL online; IAI Live first Monday monthly."),
    S("aristotelian-society", "The Aristotelian Society", "lecture", "https://www.aristoteliansociety.org.uk/", "static", 3, notes="GLOBAL; fortnightly Monday talks, confirm livestream per event."),
    S("arendt-center", "Hannah Arendt Center, Bard College", "lecture", "https://hac.bard.edu/events/", "static", 3, notes="GLOBAL online/hybrid; fall forum webcast."),
    S("bisr", "Brooklyn Institute for Social Research", "workshop", "https://thebrooklyninstitute.com/events/", "static", 3, notes="GLOBAL online seminars by term."),
    S("catherine-project", "The Catherine Project", "workshop", "https://catherineproject.org/events/", "static", 3, notes="GLOBAL free Zoom seminars."),
    S("long-now", "Long Now Foundation Talks", "talk", "https://longnow.org/talks", "static", 3, notes="GLOBAL; SF in-person + livestream/podcast."),
    S("92ny", "92nd Street Y (92NY)", "talk", "https://www.92ny.org/talks", "javascript", 3, notes="GLOBAL; livestream + live podcast tapings."),
    S("nypl-live", "LIVE from NYPL", "talk", "https://www.nypl.org/events/live-nypl", "javascript", 3, notes="GLOBAL; in-person + livestream."),
    S("practical-philosophy-on", "Practical Philosophy Club - Ontario", "philosophy-cafe", "https://www.meetup.com/practical-philosophy-club-ontario/", "javascript", 1, notes="Most reliable in-person GTA cafe feed; multiple chapters."),
    S("toronto-philosophy-meetup", "The Toronto Philosophy Meetup", "philosophy-cafe", "https://www.meetup.com/the-toronto-philosophy-meetup/", "javascript", 2, notes="Largest group but near-term calendar mostly online."),
    S("being-becoming", "Being and Becoming Curiosity Cafe", "philosophy-cafe", "https://beingnbecoming.org/curiosity-cafes/", "static", 2, notes="Recurring in-person cafe, Madison Avenue Pub."),

    # A4 civic & community gatherings (beyond toronto-events, tpl-appel)
    S("empire-club", "Empire Club of Canada", "talk", "https://empireclubofcanada.com/upcoming-events/", "javascript", 1, notes="Swoogo cards; page renders empty between seasons."),
    S("canadian-club", "Canadian Club Toronto", "talk", "https://www.canadianclub.org/upcoming-events/", "wordpress", 1),
    S("economic-club", "Economic Club of Canada", "talk", "https://www.economicclub.ca/upcomingevents", "static", 2),
    S("board-of-trade", "Toronto Region Board of Trade", "networking", "https://bot.com/Events", "javascript", 2),
    S("cic-toronto", "Canadian International Council - Toronto", "talk", "https://thecic.org/events/", "wordpress", 2),
    S("civicaction", "CivicAction (Greater Toronto)", "gathering", "https://civicaction.ca/", "static", 3),
    S("janes-walk", "Jane's Walk Toronto", "gathering", "https://www.janeswalkfestivalto.com/", "static", 3, notes="Annual, first weekend of May."),
    S("trampoline-hall", "Trampoline Hall", "talk", "https://www.trampolinehall.net/", "static", 3, notes="Monthly barroom lectures; dates announced rolling via Luma."),
    S("walrus-talks", "The Walrus Talks", "talk", "https://thewalrus.ca/the-walrus-talks/", "static", 3),

    # A5 protest & civic action (beyond labour-council, protest-civic)
    S("cupe-ontario", "CUPE Ontario", "protest", "https://cupe.on.ca/calendar/", "static", 1, notes="iCal export; categorized rallies/conventions."),
    S("opseu", "OPSEU/SEFPO", "protest", "https://opseu.org/events/", "javascript", 1),
    S("ofl", "Ontario Federation of Labour", "protest", "https://ofl.ca/events/", "javascript", 2),
    S("ontario-health-coalition", "Ontario Health Coalition", "protest", "https://www.ontariohealthcoalition.ca/", "static", 1),
    S("acorn-toronto", "Toronto ACORN", "protest", "https://acorncanada.org/locations/toronto-acorn/", "static", 2),
    S("mwac", "Migrant Workers Alliance for Change", "protest", "https://migrantworkersalliance.org/", "static", 3),
    S("free-grassy", "Free Grassy Narrows / River Run", "protest", "https://freegrassy.net/", "static", 2, notes="Annual River Run, mid-late September."),
    S("kairos", "KAIROS Canada", "protest", "https://kairoscanada.org/events/list", "static", 2, notes="The Events Calendar with .ics export; only structured faith feed."),
    S("toronto350", "Toronto350 / climate action", "protest", "https://toronto350.org/", "static", 3),
    S("yfs", "York Federation of Students", "protest", "https://yfs.ca/events-home", "static", 3),

    # A6 GLOBAL CFPs -> sources.json, type cfp
    S("philevents-cfp", "PhilEvents -- Calls for Papers", "cfp", "https://philevents.org/cfps", "static", 1, notes="GLOBAL. RSS/iCal/CSV export per saved search ID; best machine feed in the set."),
    S("upenn-cfp", "UPenn Call for Papers (English/lit)", "cfp", "https://call-for-papers.sas.upenn.edu/category/all", "static", 1, notes="GLOBAL. ~40 per-category RSS feeds; explicit deadline field."),
    S("hnet-announce", "H-Net H-Announce", "cfp", "https://networks.h-net.org/h-announce", "javascript", 2, notes="GLOBAL. Bot-protected; rate-limit and corroborate at originating institution."),
    S("wikicfp", "WikiCFP (humanities/social sciences)", "cfp", "http://www.wikicfp.com/cfp/call?conference=humanities", "static", 3, notes="GLOBAL. Multidisciplinary; humanities coverage uneven."),
    S("cfplist", "CFPList.com", "cfp", "https://www.cfplist.com/", "static", 2, notes="GLOBAL. Curated; powers NeMLA/PAMLA portals (Ballast)."),
    S("arthist", "ArtHist.net", "cfp", "https://arthist.net/", "static", 3, notes="GLOBAL art history; CFP subject-line prefix."),
    S("mla-cfp", "MLA Calls for Papers", "cfp", "https://www.mla.org/Events/Planning-a-Convention-Session/Calls-for-Papers", "static", 2, notes="GLOBAL literary; just-in-time sessions open June."),
    S("aha-cfp", "American Historical Association CFP", "cfp", "https://www.historians.org/events/annual-meeting/call-for-proposals/", "static", 3, notes="GLOBAL history."),
    S("aar-cfp", "American Academy of Religion CFP", "cfp", "https://aarweb.org/events/annual-meetings/call-for-papers-proposals/", "static", 3, notes="GLOBAL religion/theology."),
    S("acla-cfp", "ACLA Calls for Papers", "cfp", "https://www.acla.org/resources-links/calls-papers", "static", 3, notes="GLOBAL comparative literature; seminar portal opens June."),
    S("apa-cfp", "American Philosophical Association Calls", "cfp", "https://www.apaonline.org/page/calls", "static", 2, notes="GLOBAL philosophy."),
    S("4s-cfp", "Society for Social Studies of Science (4S)", "cfp", "https://www.4sonline.org/", "static", 3, notes="GLOBAL STS; 4S 2026 is in Toronto (Sheraton)."),

    # A7 GLOBAL contests -> sources.json, type contest
    S("pw-grants", "Poets & Writers -- Grants & Awards", "contest", "https://www.pw.org/grants", "static", 1, notes="GLOBAL. Deadline-sortable, vetted; strongest legitimacy filter."),
    S("reedsy-contests", "Reedsy writing-contests directory", "contest", "https://reedsy.com/resources/writing-contests/", "static", 1, notes="GLOBAL. 460+ vetted, genre/deadline/fee filters."),
    S("submittable-discover", "Submittable Discover", "contest", "https://discover.submittable.com/", "javascript", 2, notes="GLOBAL. Wide net; Submittable-hosted calls only."),
    S("winning-writers", "Winning Writers", "contest", "https://winningwriters.com/", "static", 2, notes="GLOBAL. Best free/no-fee coverage + scam filter."),
    S("canadian-authors", "Canadian Authors Association -- Awards", "contest", "https://canadianauthors.org/national/links/awards-competitions/", "static", 2, notes="Month-by-month deadline pages; Canadian + some intl."),
    S("cbc-literary", "CBC Literary Prizes", "contest", "https://www.cbc.ca/books/literaryprizes", "javascript", 2, notes="Canada only; Short Story / Nonfiction / Poetry cycles."),
    S("league-cdn-poets", "League of Canadian Poets -- Awards", "contest", "https://poets.ca/offerings/awards/", "static", 3),
    S("writers-union", "The Writers' Union of Canada -- competitions", "contest", "https://writersunion.ca/short-prose-competition", "static", 3),

    # A8 screenings-with-discussion (beyond revue, royal, paradise, hot-docs, tiff-lightbox)
    S("fox-theatre", "Fox Theatre (the Beaches)", "screening", "https://www.foxtheatre.ca/", "wordpress", 3, notes="Discussion components intermittent."),
    S("innis-csi", "Innis Town Hall / Cinema Studies Institute", "screening", "https://innis.utoronto.ca/happening-at-innis/", "static", 2, notes="CLOSED for construction May 4 - Aug 21, 2026; screenings pause that summer."),
    S("tmu-image-arts", "TMU School of Image Arts", "screening", "https://www.torontomu.ca/image-arts/news-events/", "javascript", 3),
    S("york-cinema", "York Cinema & Media Arts / Nat Taylor", "screening", "https://events.yorku.ca/", "javascript", 3, notes="Includes Cinema Politica @ York."),
    S("ago-cinema", "AGO Art + Cinema (Jackman Hall)", "screening", "https://ago.ca/ago-art-cinema", "javascript", 3),
    S("goethe-films", "Goethe-Institut Toronto -- GOETHE FILMS", "screening", "https://www.goethe.de/ins/ca/en/sta/tor/ver.cfm", "javascript", 3),

    # B1 performing-arts VENUES & companies (run seasons, not multi-day festivals) -> sources.json
    S("massey-rth", "Massey Hall & Roy Thomson Hall", "performance", "https://tickets.mhrth.com/events", "javascript", 1),
    S("tso", "Toronto Symphony Orchestra", "performance", "https://www.tso.ca/concerts-and-events/calendar", "javascript", 1),
    S("coc", "Canadian Opera Company", "performance", "https://www.coc.ca/", "static", 1),
    S("national-ballet", "The National Ballet of Canada", "performance", "https://national.ballet.ca/performances/", "static", 1),
    S("to-live", "TO Live (Meridian Hall / St. Lawrence Centre)", "performance", "https://www.tolive.com/", "javascript", 1),
    S("koerner-hall", "Koerner Hall / Royal Conservatory", "performance", "https://www.rcmusic.com/concerts", "javascript", 1),
    S("harbourfront-centre", "Harbourfront Centre (year-round programming)", "performance", "https://harbourfrontcentre.com/whats-on/", "static", 2),
    S("soulpepper", "Soulpepper / Young Centre", "performance", "https://www.soulpepper.ca/", "static", 1),
    S("mirvish", "Mirvish Productions", "performance", "https://www.mirvish.com/whats-on/upcoming-shows", "static", 1),
    S("canadian-stage", "Canadian Stage", "performance", "https://www.canadianstage.com/shows-events", "static", 2),
    S("crows-theatre", "Crow's Theatre", "performance", "https://www.crowstheatre.com/shows-events", "static", 2),
    S("tarragon", "Tarragon Theatre", "performance", "https://tarragontheatre.com/whats-on/", "static", 2),
    S("buddies", "Buddies in Bad Times Theatre", "performance", "https://buddiesinbadtimes.com/", "static", 2),
    S("factory-theatre", "Factory Theatre", "performance", "https://www.factorytheatre.ca/whats-on/", "static", 3, notes="Venue calendar partially JS; fetch live for spring/summer dates."),
    S("ypt", "Young People's Theatre", "performance", "https://www.youngpeoplestheatre.org/shows-tickets/", "static", 3),
    S("native-earth", "Native Earth Performing Arts", "performance", "https://nativeearth.ca/current-season", "static", 2, notes="Ticketing via PatronBase."),
    S("tafelmusik", "Tafelmusik Baroque Orchestra", "performance", "https://www.tafelmusik.org/", "static", 2),
    S("opera-atelier", "Opera Atelier", "performance", "https://www.operaatelier.com/", "static", 2),
    S("soundstreams", "Soundstreams", "performance", "https://soundstreams.ca/upcoming-events/", "wordpress", 3),
    S("tdt", "Toronto Dance Theatre", "performance", "https://tdt.org/whats-on/", "static", 3),
    S("danceworks", "DanceWorks", "performance", "https://www.danceworks.ca/upcoming-events", "static", 3),
    S("citadel-cie", "Citadel + Compagnie", "performance", "https://www.citadelcie.com/", "static", 3),
    S("music-gallery", "The Music Gallery", "performance", "https://musicgallery.org/events/", "wordpress", 3, notes="WordPress event-category taxonomy; fall X Avant fest needs live fetch."),

    # B3 galleries & museums -> sources.json (beyond power-plant, ago, moca)
    S("rom", "Royal Ontario Museum", "exhibition", "https://www.rom.on.ca/whats-on/exhibitions", "javascript", 1, notes="Also scrape ROM Speaks/Talks for scholar-talks."),
    S("gardiner-museum", "Gardiner Museum", "exhibition", "https://www.gardinermuseum.on.ca/whats-on/", "static", 2),
    S("aga-khan", "Aga Khan Museum", "talk", "https://agakhanmuseum.org/whats-on/", "javascript", 1, notes="Exhibitions + Lectures & Talks + performances; ticketing subdomain is JS."),
    S("textile-museum", "Textile Museum of Canada", "exhibition", "https://textilemuseum.ca/", "static", 3),
    S("bata-shoe", "Bata Shoe Museum", "exhibition", "https://batashoemuseum.ca/exhibitions/", "static", 3),
    S("artmuseum-uoft", "Art Museum at the University of Toronto", "exhibition", "https://artmuseum.utoronto.ca/exhibitions/", "static", 2, notes="Main hub for 2026 Toronto Biennial (Sept 26-Dec 20)."),
    S("onsite-ocadu", "Onsite Gallery, OCAD U", "exhibition", "https://www.ocadu.ca/galleries/onsite-gallery", "javascript", 3),
    S("agyu-goldfarb", "AGYU / Joan & Martin Goldfarb Gallery", "exhibition", "https://thegoldfarbgallery.ca/exhibitions/", "static", 3),
    S("mcmichael", "McMichael Canadian Art Collection (Kleinburg)", "exhibition", "https://mcmichael.com/exhibitions/", "wordpress", 2),
    S("mercer-union", "Mercer Union", "exhibition", "https://www.mercerunion.org/exhibitions", "static", 2, notes="Co-presents Toronto Biennial commission; closed summers."),
    S("gallery44", "Gallery 44 Centre for Contemporary Photography", "exhibition", "https://www.gallery44.org/all-exhibitions", "static", 3),
    S("koffler", "Koffler Arts / Koffler Gallery", "exhibition", "https://www.kofflerarts.org/whatson/exhibitions", "static", 3),
    S("cooper-cole", "Cooper Cole", "exhibition", "https://coopercolegallery.com/exhibitions/", "static", 3, notes="Bimonthly cycles; crawl monthly."),
    S("daniel-faria", "Daniel Faria Gallery", "exhibition", "http://www.danielfariagallery.com/exhibitions", "static", 3),

    # GTA-suburbs venues -> sources.json
    S("living-arts-centre", "Living Arts Centre (Mississauga)", "performance", "https://www.mississauga.ca/arts-and-culture/locations/living-arts-centre/", "javascript", 2, notes="Ticketmaster venue feed."),
    S("the-rose-brampton", "The Rose / Brampton On Stage", "performance", "https://tickets.brampton.ca/", "javascript", 2),
    S("flato-markham", "Flato Markham Theatre", "performance", "https://flatomarkhamtheatre.ca/", "javascript", 2, notes="Ticketing feeds AXS."),
    S("rhcpa", "Richmond Hill Centre for the Performing Arts", "performance", "https://www.rhcentre.ca/", "javascript", 3),
    S("burlington-pac", "Burlington Performing Arts Centre", "performance", "https://burlingtonpac.ca/events/", "static", 3, notes="Ticketing via TixHub."),
    S("oakville-galleries", "Oakville Galleries", "exhibition", "https://www.oakvillegalleries.com/", "static", 3),
    S("pama", "Peel Art Gallery, Museum and Archives", "exhibition", "https://www.pama.peelregion.ca/exhibitions", "static", 3),
    S("varley", "Varley Art Gallery of Markham", "exhibition", "https://varleyartgallery.ca/exhibitions/", "static", 3),
    S("rmg", "Robert McLaughlin Gallery (Oshawa)", "exhibition", "https://rmg.on.ca/exhibitions/", "static", 2, notes="Largest public gallery in Durham; admission free."),
    S("station-gallery", "Station Gallery (Whitby)", "exhibition", "https://stationgallery.ca/exhibitions/", "static", 3),
    S("aurora-town-square", "Aurora Cultural Centre / Aurora Town Square", "performance", "https://www.auroratownsquare.ca/events-tickets/whats-on/", "javascript", 3),
    S("ontario-tech-events", "Ontario Tech University events", "lecture", "https://events.ontariotechu.ca/", "static", 3, notes="RSS/iCal/JSON feeds."),
    S("mississauga-library", "Mississauga Library", "reading", "https://mississauga.bibliocommons.com/events/search/", "javascript", 3, notes="BiblioCommons events module."),
    S("markham-library", "Markham Public Library", "reading", "https://markham.bibliocommons.com/events/search/", "javascript", 3, notes="BiblioCommons events module."),
]

# ---- festivals-sources.json primary additions (multi-day festivals) ----
NEW_FEST_PRIMARY = [
    # B2 heritage / cultural-reproduction festivals not already rostered
    F("jerkfest", "JerkFest (Canada's Jerk Food Festival)", "cultural-reproduction", "https://www.jerkfestival.ca/", notes="Caribbean jerk cuisine + music; Centennial Park, Etobicoke; early August."),
    F("taste-little-italy", "Taste of Little Italy", "cultural-reproduction", "https://tasteoflittleitaly.tolittleitaly.com/", notes="College St W (Bathurst-Shaw), Little Italy BIA; mid-June."),
    F("do-west-fest", "Do West Fest (Little Portugal)", "cultural-reproduction", "https://dowestfest.com/", notes="Dundas St W; Uma Nota Culture. Portugal Day Parade now split off to St. Clair -- track separately."),
    F("ukrainian-festival", "Toronto Ukrainian Festival (Bloor West Village)", "cultural-reproduction", "https://ukrainianfestival.com/", notes="Bloor St W (Jane-Runnymede); mid-September."),
    F("taste-of-manila", "Taste of Manila", "cultural-reproduction", "https://www.eventbrite.ca/e/taste-of-manila-2026-tickets-1989943073300", notes="SPARC Canada; Bathurst & Wilson 'Little Manila'; mid-August. Multiple SPARC web properties exist -- disambiguate the Toronto event."),
    F("toronto-korean-festival", "Toronto Korean Festival", "cultural-reproduction", "https://www.torontokfest.ca/", notes="Mel Lastman Square; formerly 'Korean Harvest Festival' (legacy domain torontokhf.com)."),
    F("indigenous-arts-festival", "Indigenous Arts Festival & Na-Me-Res Pow Wow", "cultural-reproduction", "https://www.toronto.ca/explore-enjoy/festivals-events/indigenous-arts-festival/", notes="City-produced; Fort York / Garrison Common; late June. Verify venue (one listing cites Biidaasige Park)."),
    F("chinatown-festival", "Toronto Chinatown Festival / Lunar New Year", "cultural-reproduction", "https://www.chinatownbia.com/", notes="Chinatown BIA, Spadina/Dundas; Lunar New Year in February, summer festival in August."),
    F("panorama-india", "India Day Festival & Grand Parade (Panorama India)", "cultural-reproduction", "https://panoramaindia.org/", notes="Nathan Phillips Square; August."),
    F("emancipation-toronto", "Emancipation Month (City of Toronto)", "cultural-reproduction", "https://www.toronto.ca/explore-enjoy/festivals-events/", notes="City CABR; August-long, Aug 1 Emancipation Day; Underground Freedom Train Ride + Emancipation Walk."),

    # B1 music festivals not already rostered (luminato/fringe/summerworks/harbourfront/jazz/nxne/veld present)
    F("beaches-jazz", "Beaches International Jazz Festival", "festival", "https://beachesjazz.com/", notes="Late July, the Beaches."),
    F("canadian-music-week", "Canadian Music Week", "festival", "https://cmw.net/", notes="Multi-venue music + conference."),

    # A8 film festivals not already rostered (imaginenative/inside-out present)
    F("tjff", "Toronto Jewish Film Festival", "festival", "https://tjff.com/", extra=["https://tjff.com/schedule/", "https://tjff.com/lineup/"], notes="Early-mid June; clean static per-film pages with guests in meta tags."),
    F("reel-asian", "Toronto Reel Asian International Film Festival", "festival", "https://www.reelasian.com/", notes="Mid-November; 30th anniversary 2026."),
    F("rendezvous-madness", "Rendezvous with Madness (Workman Arts)", "festival", "https://workmanarts.com/rendezvous-with-madness/", notes="Late October; every screening followed by a panel; PWYW."),
    F("regent-park-film", "Regent Park Film Festival", "festival", "https://regentparkfilmfestival.com/", notes="November; free community festival + Home Made Visible touring panels."),

    # B3 cross-venue festival node
    F("toronto-biennial", "Toronto Biennial of Art", "site-specific-art", "https://torontobiennial.org/", notes="2026 'Things Fall Apart', Sept 26-Dec 20; hub = Art Museum at U of T. Dedupe venue cross-listings by title+venue."),

    # A2 book festival
    F("word-on-street", "Word on the Street Toronto", "festival", "https://toronto.thewordonthestreet.ca/", notes="Canada's largest free book & magazine festival; late September."),

    # GTA-suburbs festivals
    F("markham-village-music", "Markham Village Music Festival", "festival", "https://www.markhamfestival.com/", notes="Main Street Markham; mid-June."),
    F("td-markham-jazz", "TD Markham Jazz Festival", "festival", "https://www.markhamjazzfestival.com/", notes="Main Street Unionville; late August (official dates over tourism listings)."),
    F("world-of-threads", "World of Threads Festival (Oakville)", "site-specific-art", "https://worldofthreadsfestival.com/", notes="Fibre/textile art; QEPCCC; Sept-Jan run."),
    F("taste-of-asia-markham", "Taste of Asia (Markham)", "cultural-reproduction", "https://visitmarkham.ca/things-to-do/festivals-events/", notes="Kennedy Rd, Markham; late June."),
]

# ---- festivals discovery additions ----
NEW_DISCOVERY = [
    D("akimbo", "Akimbo -- visual-art listings", "https://akimbo.ca/listings/", notes="Canada-wide gallery/exhibition discovery; strong for GTA shows."),
    D("destination-toronto", "Destination Toronto events", "https://www.destinationtoronto.com/", notes="Broad civic/cultural discovery."),
]


def atomic_dump(path, obj):
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, path)


def merge(existing, additions, key="id"):
    have = {e[key] for e in existing}
    added, skipped = [], []
    for e in additions:
        if e[key] in have:
            skipped.append(e[key])
        else:
            existing.append(e)
            have.add(e[key])
            added.append(e[key])
    return added, skipped


src = json.load(open(SRC))
fest = json.load(open(FEST))

src_before = len(src["sources"])
sa, ss = merge(src["sources"], NEW_SOURCES)
src["$updated"] = STAMP

fp_before = len(fest["primary_sources"])
fpa, fps = merge(fest["primary_sources"], NEW_FEST_PRIMARY)
da_before = len(fest["discovery_aggregators"])
da, ds = merge(fest["discovery_aggregators"], NEW_DISCOVERY)
fest["$updated"] = STAMP

atomic_dump(SRC, src)
atomic_dump(FEST, fest)

# Reload + validate
src2 = json.load(open(SRC))
fest2 = json.load(open(FEST))

print(f"sources.json: {src_before} -> {len(src2['sources'])} (+{len(sa)} added, {len(ss)} skipped as dup)")
if ss:
    print("  skipped dup ids:", ss)
print(f"festivals primary: {fp_before} -> {len(fest2['primary_sources'])} (+{len(fpa)} added, {len(fps)} skipped)")
if fps:
    print("  skipped dup ids:", fps)
print(f"festivals discovery: {da_before} -> {len(fest2['discovery_aggregators'])} (+{len(da)} added, {len(ds)} skipped)")

from collections import Counter
tally = Counter(e["default_type"] for e in src2["sources"])
print("sources default_type tally:", dict(sorted(tally.items())))
ftally = Counter(e["default_type"] for e in fest2["primary_sources"])
print("festival primary default_type tally:", dict(sorted(ftally.items())))
print("JSON revalidated OK.")
