#!/usr/bin/env python3
"""Wire the writing-competition + worldwide-CFP research into the seminar calendar.

- Appends contest and cfp entries to polymythseminars/events.json
- Dedupes against existing ids and normalized titles
- Regenerates the inline <script id="events-fallback"> snapshot in index.html
- Syncs data/polymyth-seminar-events.json byte-identical (PM35)
Run from repo root.
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTS = os.path.join(ROOT, "polymythseminars/events.json")
PAGE = os.path.join(ROOT, "polymythseminars/index.html")
MASTER = os.path.join(ROOT, "data/polymyth-seminar-events.json")

def offset(d):
    m = int(d[5:7])
    return "-05:00" if m in (11, 12, 1, 2, 3) else "-04:00"

def iso(d):
    return d + "T23:59:00" + offset(d)

def slugify(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return s[:60].rstrip("-")

def entry(title, date, typ, age_band, venue, url, conf, source_id):
    return {
        "date": iso(date),
        "end_date": None,
        "title": title,
        "type": typ,
        "secondary_types": [],
        "speaker_or_director": None,
        "venue": venue,
        "source_url": url,
        "source_id": source_id,
        "description": venue,
        "age_band": age_band,
        "parent_id": None,
        "is_parent_festival": False,
        "_src": "manual",
        "review_status": "manual" if conf >= 85 else "queued",
        "confidence": conf,
        "four_condition_test": {"time_place": True, "prepared_offering": True,
                                 "substantive_engagement": True, "intellectual_stake": True},
        "id": slugify(title) + "-" + date[:4],
    }

# ---- WRITING COMPETITIONS (type contest) ---------------------------------
# Foyle, Polar Student, Polar Summer, Jessamy Stursberg, John Locke already loaded.
COMP = [
 ("Patricia Grodd Poetry Prize for Young Writers", "2026-11-30", "Youth, grades 10 to 11",
  "Poetry submission window, November 1 to 30. One unpublished poem. Open internationally, grades 10 and 11. Free. Winner publishes in The Kenyon Review and earns a Young Writers workshop scholarship.",
  "https://kenyonreview.org/submit/patricia-grodd/", 90),
 ("Bennington Young Writers Awards", "2026-11-01", "Youth, grades 9 to 12",
  "Submission deadline, opens September 1. Poetry, fiction, or nonfiction. Open worldwide, grades 9 to 12, with a teacher sponsor. Free. Prizes to two thousand dollars plus Bennington scholarships.",
  "https://www.bennington.edu/events/young-writers-awards", 95),
 ("CBC First Page Student Writing Challenge", "2027-02-28", "Youth, grades 7 to 12",
  "Submission deadline, projected from the annual February window. One opening page of a novel set 150 years ahead, 300 to 400 words. Canadian residents, grades 7 to 12. Free. Confirm the date on the site.",
  "https://www.cbc.ca/books/the-first-page-student-writing-challenge-is-back-for-the-2025-2026-school-year-1.4269274", 75),
 ("Write the World Monthly Competitions", "2026-07-06", "Youth, ages 13 to 19",
  "Monthly competitions, a new genre each month, opening the first Monday. Poetry, fiction, journalism, screenwriting, and more. Open worldwide, ages 13 to 19. Free. Cash prizes and expert review.",
  "https://writetheworld.org/competitions", 90),
 ("New York Times Summer Reading Contest", "2026-08-14", "Youth, ages 13 to 19",
  "Submission window, June 5 to August 14, open now. Respond to anything in the Times that drew you in. Open worldwide, ages 13 to 19, middle and high school. Free. Part of the recurring Learning Network contest calendar.",
  "https://www.nytimes.com/section/learning", 95),
 ("Queen's Commonwealth Writing Competition", "2027-04-30", "Youth, under 18",
  "Submission deadline, projected from the annual April window. Any written form, up to 1000 words. Commonwealth nationals or residents, Canada included, under 18. Free. AI-written work barred. Confirm the date on the site.",
  "https://www.royalcwsociety.org/writing-competition", 80),
 ("The Concord Review", "2026-08-01", "Youth, secondary school",
  "Rolling deadlines, next August 1 for the Winter issue. History research essay, roughly 4000 to 21000 words. Secondary students worldwide, sole author. Seventy US dollar submission fee. Publishes about five percent.",
  "https://tcr.org/submit", 90),
 ("R.A. Butler Prize in Politics and International Studies", "2026-07-31", "Youth, Year 12",
  "Submission deadline, projected from the annual July window. Politics or international studies essay, up to 3000 words. Penultimate-year students worldwide. Free. Trinity College, Cambridge. Confirm the date on the site.",
  "https://www.polis.cam.ac.uk/about-us/ra-butler-prize", 75),
 ("Trinity College Cambridge Subject Essay Prizes", "2026-08-01", "Youth, Year 12 to 13",
  "Submission deadline, projected from the summer window. Subject essays in English, law, history, philosophy, and more, around 2000 to 2500 words. Year 12 and 13 students worldwide. Free. Some prizes skip a year, confirm each on the site.",
  "https://www.trin.cam.ac.uk/undergraduate/essay-prizes/", 70),
 ("Marshall Society Essay Competition in Economics", "2026-08-29", "Youth, ages 16 to 18",
  "Submission deadline, projected from the late-August window. Economics essay on a set question, about 1500 words. Pre-university students worldwide. Free. University of Cambridge. Confirm the date on the site.",
  "https://www.marshallsociety.com/", 70),
 ("The Adroit Prizes for Poetry and Prose", "2027-05-01", "Youth and undergraduate",
  "Submission window, projected from the annual April to May cycle. Up to five poems or three prose works. Secondary and undergraduate students worldwide. Fifteen US dollar fee with waivers. Confirm the date on the site.",
  "https://theadroitjournal.org/adroit-prizes/", 75),
 ("CBC Literary Prizes", "2026-11-01", "Adult, 18 and over",
  "Eligibility note, entrants must have reached the age of majority, 18 in Ontario, so most high schoolers wait. Next is the Short Story Prize, opening September, about a November deadline. Twenty-five dollar fee. Canadian residents. Confirm on the site.",
  "https://www.cbc.ca/books/literaryprizes", 70),
 ("Scholastic Art and Writing Awards", "2026-12-15", "Youth, grades 7 to 12",
  "Regional deadlines, projected across the December to January window. Eleven writing categories. Students in the US and Canada, grades 7 to 12, age 13 and over. Ten dollar per entry with waivers. Final work cannot be AI-generated. Confirm your region on the site.",
  "https://www.artandwriting.org/", 75),
 ("YoungArts National Arts Competition", "2026-10-08", "Youth, ages 15 to 18",
  "Not eligible for most Toronto students, US citizens, residents, or those able to receive US taxable income only. Submission deadline projected from the October window. Writing categories, ages 15 to 18. Thirty-five dollar fee with waivers.",
  "https://youngarts.org/", 75),
 ("James Bartleman Indigenous Youth Creative Writing Award", "2027-05-31", "Youth, under 18",
  "Submission deadline, projected from the annual May window. Any creative writing. Indigenous students enrolled in and resident in Ontario, under 18. Free. Twenty-five hundred dollars to up to six recipients. Confirm on the site.",
  "https://www.ontario.ca/page/honours-and-awards-arts-and-literature", 80),
 ("Toronto Public Library Young Voices Magazine", "2027-03-22", "Youth, ages 12 to 19",
  "Submission deadline, projected from the annual March window. Poems, stories, reviews, comics. Teens who live, work, or study in Toronto, ages 12 to 19. Free. Strict AI ban. Publication, no cash prize. Confirm on the site.",
  "https://tpl.ca/teens/young-voices/", 80),
 ("Stephen Leacock Student Humorous Writing Competition", "2027-04-15", "Youth, ages 14 to 19",
  "Postmark deadline, projected from the annual April window. Humorous short story or essay, about 1500 words, mailed. Ontario students, ages 14 to 19. Five dollar fee. Fifteen hundred dollar first prize. Confirm on the site.",
  "https://leacock.ca/studentaward.php", 75),
 ("Indigenous Arts and Stories", "2027-03-31", "Youth and adult, ages 6 to 29",
  "Program appears on hiatus, verify before relying on it. Historically a March 31 deadline. Creative writing and art. Canadians of Indigenous ancestry, ages 6 to 29. Free.",
  "http://www.our-story.ca/", 50),
 ("Hamilton Public Library Power of the Pen", "2026-09-30", "Youth, ages 12 to 18",
  "Hamilton-area residency required, most Toronto students do not qualify. Deadline projected from the annual September window. Poetry and short story. Ages 12 to 18. Free. Confirm on the site.",
  "https://www.hpl.ca/articles/power-pen-creative-writing-contest", 70),
 ("Ottawa Public Library Awesome Authors Youth Writing Contest", "2027-02-28", "Youth, ages 9 to 18",
  "Ottawa residency or library card required, Toronto students do not qualify. Deadline projected from the late-February window. Short story, poetry, comics, English or French. Ages 9 to 18. Free. Confirm on the site.",
  "https://biblioottawalibrary.ca/en/about/awesome-authors", 70),
 ("Princeton Ten-Minute Play Contest", "2027-03-31", "Youth, grade 11",
  "Deadline projected from the annual March window, or once 250 entries fill. One ten-minute play, up to ten pages. Eleventh-grade students or the international equivalent. Free. Princeton University. Confirm on the site.",
  "https://arts.princeton.edu/about/opportunities/high-school-contests/ten-minute-play-contest/", 75),
 ("Amazon Canada First Novel Award Youth Short Story", "2027-02-28", "Youth, ages 13 to 17",
  "Deadline approximate, projected from the winter window, verify. Short story. Canadian teens, ages 13 to 17. Free. Confirm the date on the site.",
  "https://thewalrus.ca/afna/", 65),
 ("Poetry In Voice Write Contest", "2027-02-15", "Youth, grades 7 to 12",
  "Submission window, projected August 15 to February 15, monthly winners. Poetry. Canadian students, grades 7 to 12, under 19. Free. FutureVerse intensive for senior winners. Confirm on the site.",
  "https://poetryinvoice.ca/write/get-published", 75),
 ("Kids Write 4 Kids", "2027-03-31", "Youth, grades 4 to 8",
  "Deadline projected from the annual cycle, opens October. Creative story or poetry. Canadian students, grades 4 to 8, so only the youngest Toronto students. Free. Confirm on the site.",
  "https://www.ripplefoundation.ca/kids-write-4-kids/", 70),
 ("River of Words Poetry and Art Contest", "2027-02-28", "Youth, grades K to 12",
  "Deadline approximate, projected from the late-February window, verify. Poetry and art on a watershed theme. Students worldwide, kindergarten to grade 12. Free. Confirm the date on the site.",
  "https://riverofwords.org/", 60),
 ("CNIB Braille Creative Writing Contest", "2027-02-28", "Youth, up to grade 12",
  "Details and cycle unverified, confirm on the site before relying on it. Poetry and prose. Canadian students up to grade 12. Free.",
  "https://www.cnib.ca/", 50),
]

# ---- WORLDWIDE CALLS FOR PAPERS (type cfp) --------------------------------
# IAPT Eastern APA already loaded (skip). One-off expired calls skipped.
CFP = [
 ("Society for Phenomenology and Existential Philosophy 64th Conference", "2027-01-20", "University and graduate",
  "Submission deadline projected from the annual January window. Continental philosophy papers, panels, and book sessions. Members worldwide. Loyola University Chicago. Confirm on the site.",
  "https://philevents.org/event/show/143379", 75),
 ("Canadian Philosophical Association Congress", "2027-01-05", "University and graduate",
  "Submission deadline projected from the annual January window. Papers and symposia across philosophy. CPA members, held with the Congress of the Humanities. Confirm on the site.",
  "https://www.acpcpa.ca/en/congress/", 75),
 ("Metaphysical Society of America 2027 Meeting", "2026-09-01", "University and graduate",
  "Submission deadline, September 1. Metaphysics abstracts and full papers, theme Habits of Being. Open, with student and early-career prizes. Gonzaga University, March 2027.",
  "https://philevents.org/event/show/148885", 90),
 ("Philosophy of Management 18th Annual Conference", "2027-02-01", "University and graduate",
  "Submission deadline projected from the annual February window. Philosophy of management and organization. EM Normandie, Paris. Confirm on the site.",
  "https://philevents.org/event/show/141342", 70),
 ("MLA 2027 Convention, just-in-time sessions", "2026-09-18", "University and graduate",
  "Just-in-time session window, open through about September 18. Literature and languages. MLA members. Los Angeles, January 2027. Most regular sessions already closed.",
  "https://www.mla.org/Events/Planning-a-Convention-Session/Calls-for-Papers", 85),
 ("Verge, Studies in Global Asias 14.2", "2026-09-30", "University and graduate",
  "Proposal deadline, September 30, essays May 2027. Special issue, The Cultural Labor of Internationalism. Global Asias scholarship. Penn State. Journal special issue.",
  "https://call-for-papers.sas.upenn.edu/category/all", 90),
 ("Elizabeth Bowen Review, Volume 8", "2026-09-30", "University and graduate",
  "Submission deadline, September 30. Essays up to 6000 words, Why Bowen Matters. Irish and modernist literary studies. Journal, double-blind review.",
  "https://call-for-papers.sas.upenn.edu/category/all", 85),
 ("PAMLA 2026 Conference", "2026-07-15", "University and graduate",
  "Panel submission window, projected, verify. Literature and languages. Seattle, November 2026. Pacific Ancient and Modern Language Association. Confirm on the portal.",
  "https://call-for-papers.sas.upenn.edu/category/graduate-conferences", 65),
 ("USC Cinema and Media Studies Graduate Conference, Delirium", "2027-06-15", "Graduate students",
  "Deadline projected for the next annual cycle, verify. Media studies, graduate. University of Southern California. Graduate conference. Confirm on the site.",
  "https://call-for-papers.sas.upenn.edu/category/all", 60),
 ("International Virginia Woolf Conference 36th", "2027-04-30", "University and graduate",
  "Submission deadline projected from the annual spring window. Modernist literary studies. Annual conference, location rotates. Confirm on the site.",
  "https://call-for-papers.sas.upenn.edu/category/modernist-studies", 65),
 ("SAAS 18th Conference, Negotiating Identity and Power", "2026-10-01", "University and graduate",
  "Panel and paper deadline projected, verify. American studies and literature. Universidad de Oviedo, March 2027. Spanish Association for American Studies. Confirm on the site.",
  "https://call-for-papers.sas.upenn.edu/category/american", 60),
 ("Journal of the Georgia Philological Association", "2026-09-30", "University and graduate",
  "Submission deadline, September 30. Literature, language, philology, interdisciplinary humanities. Journal.",
  "https://www.mga.edu/arts-letters/english/gpa/index.php", 80),
 ("American Historical Association 2028 Annual Meeting", "2027-02-15", "University and graduate",
  "Submission deadline projected from the annual mid-February window. History, all fields. AHA members. Annual meeting. Confirm on the site.",
  "https://www.historians.org/events/annual-meeting/call-for-proposals/", 80),
 ("Renaissance Society of America, Philadelphia 2027", "2026-08-15", "University and graduate",
  "Submission deadline, August 15. Renaissance and early-modern sessions and papers. RSA members, sessions need a degree-holding presenter. Philadelphia, March 2027.",
  "https://www.rsa.org/news/726650/Call-for-Papers-RSA-Philadelphia-2027.htm", 95),
 ("International Congress on Medieval Studies, Kalamazoo 62nd", "2026-09-15", "University and graduate",
  "Submission deadline, September 15. Medieval studies, interdisciplinary. Open, graduate students welcome. Western Michigan University, May 2027, hybrid.",
  "https://wmich.edu/medievalcongress/call", 90),
 ("International Medieval Congress, Leeds 2027, Communities", "2026-08-31", "University and graduate",
  "Paper deadline, August 31, sessions September 30. Medieval studies, theme Communities. University of Leeds, July 2027, hybrid.",
  "https://www.imc.leeds.ac.uk/imc-2027/", 85),
 ("Society for History in the Federal Government 2027 Meeting", "2027-01-15", "University and graduate",
  "Submission deadline projected from the annual January window. Public and federal history. Washington area. Confirm on the site.",
  "https://shfg.wildapricot.org/", 65),
 ("Hermann Weber Conference 9th, Communist Regimes and the World Economy", "2026-10-15", "University and graduate",
  "Submission deadline projected, verify. History, communist regimes and the world economy since the 1970s. University of Regensburg, April 2027. Confirm on the site.",
  "https://networks.h-net.org/", 55),
 ("EHESS, Exploring Plantation Records", "2026-09-15", "University and graduate",
  "Submission deadline, September 15, verify the year. History of slavery, French Caribbean. EHESS, Paris, June 2027. Confirm on the site.",
  "https://networks.h-net.org/", 60),
 ("Society for Global Nineteenth-Century Studies 2027 World Congress", "2026-11-01", "University and graduate",
  "Submission deadline projected, verify. Global nineteenth-century studies. Valparaiso, Chile, July 2027. Confirm on the site.",
  "https://networks.h-net.org/", 60),
 ("College Art Association 115th, Call for Participation", "2026-09-16", "University and graduate",
  "Participation window, chairs select by about September 16. Art history and visual studies. CAA members. New York, February 2027. Session proposals already closed.",
  "https://www.collegeart.org/programs/conference/proposals", 80),
 ("ICMA-sponsored session, CAA 2028", "2027-02-01", "University and graduate",
  "Session deadline projected from the annual February window. Medieval art history. International Center of Medieval Art. Confirm on the site.",
  "https://www.medievalart.org/", 65),
 ("Italian Art Society session, CAA 2028", "2027-04-10", "University and graduate",
  "Session deadline projected from the annual April window. Italian art history. Italian Art Society at the CAA conference. Confirm on the site.",
  "https://www.italianartsociety.org/", 65),
 ("American Academy of Religion 2027 Annual Meeting", "2027-03-06", "University and graduate",
  "Submission deadline projected from the annual March window. Religious studies and theology. AAR members. Washington, November 2027. Confirm on the site.",
  "https://aarweb.org/events/annual-meetings/call-for-papers-proposals/", 75),
 ("AAR Southeast Region 2027 Annual Meeting", "2026-10-01", "University and graduate",
  "Submission deadline, October 1, undergraduate award papers December 15. Religious studies. Virginia Commonwealth University, March 2027.",
  "https://relse.org/call-for-papers", 85),
 ("Midwest AAR 2027 Annual Meeting", "2027-01-09", "University and graduate",
  "Submission deadline projected from the annual January window. Religious studies, membership not required to submit. Confirm on the site.",
  "https://sites.google.com/view/midwestaar/CFP", 65),
 ("SBL International Meeting 2027", "2027-02-01", "University and graduate",
  "Submission deadline projected, verify. Biblical studies and religion. Leuven, Belgium, July 2027. Society of Biblical Literature. Confirm on the site.",
  "https://www.sbl-site.org/meetings/international-meeting/", 65),
 ("Society for Classical Studies 2028 Annual Meeting", "2027-04-05", "University and graduate",
  "Submission deadline projected from the annual April window. Classics. SCS members. Annual meeting with the Archaeological Institute. Confirm on the site.",
  "https://classicalstudies.org/annual-meeting", 75),
 ("Archaeological Institute of America 2027 Annual Meeting", "2026-08-03", "University and graduate",
  "Second deadline, August 3, workshops, open papers, and posters, with roundtables to November 1. Boston, January 2027.",
  "https://www.archaeological.org/programs/professionals/annual-meeting/", 90),
 ("American Sociological Association 2027 Annual Meeting", "2027-02-25", "University and graduate",
  "Main paper deadline projected, the call opens about November. Sociology, theme Realizing the Promise of Sociology. Chicago, August 2027. Confirm on the site.",
  "https://www.asanet.org/annual-meeting/2027-calls-for-proposals/", 75),
 ("International Studies Association 2027 Convention", "2026-07-01", "University and graduate",
  "Special-program deadlines June and July, confirm the general call. International relations. Atlanta, March 2027, with a virtual option for Global South scholars.",
  "https://www.isanet.org/Conferences/ISA2027/Call", 75),
 ("American Political Science Association 2027 Annual Meeting", "2027-01-14", "University and graduate",
  "Submission deadline projected from the annual January window. Political science. APSA. Annual meeting. Confirm on the site.",
  "https://apsanet.org/events/annual-meeting-exhibition/", 70),
 ("American Anthropological Association 2027 Annual Meeting", "2027-05-06", "University and graduate",
  "Submission deadline projected from the annual spring window. Anthropology, unified single call. AAA. Confirm on the site.",
  "https://annualmeeting.americananthro.org/submit/", 70),
 ("American Ethnological Society Spring 2027 Conference", "2027-01-15", "University and graduate",
  "Submission deadline projected from the annual January window. Cultural anthropology. American Ethnological Society. Confirm on the site.",
  "https://americananthro.org/", 60),
 ("Law and Society Association 2027 International Meeting", "2026-10-29", "University and graduate",
  "Submission deadline projected, the call opens about summer. Socio-legal studies. University of Hong Kong, June 2027. Confirm on the site.",
  "https://www.lawandsociety.org/annual-meetings/", 65),
 ("Association of American Law Schools 2027 Annual Meeting", "2026-08-15", "University and graduate",
  "Section calls vary, projected, verify. Legal education, theme Emancipate Academic Freedom. New York, January 2027. Confirm on the site.",
  "https://am.aals.org/", 60),
 ("Association for Law, Property, and Society 2027 Meeting", "2026-11-30", "University and graduate",
  "Submission deadline projected from a late-November window, verify. Property law, interdisciplinary. Cardiff University, 2027. Confirm on the site.",
  "https://alps-law.org/", 60),
 ("Digital Humanities 2027, Creativity", "2026-11-01", "University and graduate",
  "Submission deadline projected, verify, the call is expected late 2026. Digital humanities, theme Creativity. University of Galway, June and July 2027. Alliance of Digital Humanities Organizations.",
  "https://adho.org/conference/", 60),
 ("American Society for Bioethics and Humanities 2027 Conference", "2027-03-09", "University and graduate",
  "Submission deadline projected from the annual March window. Bioethics and health humanities. Columbus, October 2027. Confirm on the site.",
  "https://asbh.org/annual-meeting", 65),
 ("International Conference on Medical Humanities", "2026-11-01", "University and graduate",
  "Submission deadline projected from the annual late-year window, verify. Medical humanities, interdisciplinary. Online. Confirm on the site.",
  "https://medhumconf.lcir.co.uk/", 55),
 ("Paris Conference on AI and Digital Ethics 2027", "2027-05-15", "University and graduate",
  "Submission deadline projected from the annual spring window, verify. AI ethics, interdisciplinary, with a journal track. Paris. Confirm on the site.",
  "https://paris-conference.com/", 55),
 ("AIES 2027, AI Ethics and Society", "2027-05-14", "University and graduate",
  "Submission deadline projected from the annual spring window, verify. AI ethics, interdisciplinary. AAAI and ACM conference. Confirm on the site.",
  "https://www.aies-conference.com/", 55),
 ("Journal of Humanistic Psychology, Authenticity in Lived-Experience Work", "2026-07-01", "University and graduate",
  "Abstract deadline, July 1. Special issue on authenticity in peer and lived-experience workforces. Sage. Journal special issue.",
  "https://journals.sagepub.com/special-issue-calls-for-papers", 80),
 ("The Space Between, Literature and Culture 1914 to 1945", "2026-12-31", "University and graduate",
  "Rolling submissions for the 2027 and 2028 issues. Interwar literary and cultural studies. Journal.",
  "https://call-for-papers.sas.upenn.edu/category/modernist-studies", 75),
 ("Journal of Marlowe Studies 2027 Issue", "2026-12-31", "University and graduate",
  "Submission window, projected, verify. Early-modern literary studies. Sheffield Hallam University. Journal.",
  "https://journals.shu.ac.uk/index.php/Marlstud/index", 60),
]

def main():
    with open(EVENTS, encoding="utf-8") as f:
        data = json.load(f)
    existing_ids = {e.get("id") for e in data["events"]}
    existing_titles = {re.sub(r"[^a-z0-9]+", "", (e.get("title") or "").lower()) for e in data["events"]}

    new = []
    for (t, d, ab, v, u, c) in COMP:
        new.append(entry(t, d, "contest", ab, v, u, c, "writing-competitions-2"))
    for (t, d, ab, v, u, c) in CFP:
        new.append(entry(t, d, "cfp", ab, v, u, c, "cfp-worldwide"))

    added, skipped = [], []
    for e in new:
        norm = re.sub(r"[^a-z0-9]+", "", e["title"].lower())
        if e["id"] in existing_ids or norm in existing_titles:
            skipped.append(e["title"])
            continue
        # guarantee unique id
        base = e["id"]; n = 2
        while e["id"] in existing_ids:
            e["id"] = base + "-" + str(n); n += 1
        existing_ids.add(e["id"]); existing_titles.add(norm)
        data["events"].append(e); added.append(e["title"])

    data["_total_events"] = len(data["events"])
    data["count"] = len(data["events"])

    blob = json.dumps(data, ensure_ascii=False)
    with open(EVENTS, "w", encoding="utf-8") as f:
        f.write(blob)

    # regenerate inline fallback snapshot
    with open(PAGE, encoding="utf-8") as f:
        page = f.read()
    pat = re.compile(r'(<script id="events-fallback" type="application/json">)(.*?)(</script>)', re.S)
    if not pat.search(page):
        print("ERROR: fallback script block not found"); sys.exit(1)
    page = pat.sub(lambda m: m.group(1) + blob + m.group(3), page, count=1)
    with open(PAGE, "w", encoding="utf-8") as f:
        f.write(page)

    # sync master byte-identical
    with open(MASTER, "w", encoding="utf-8") as f:
        f.write(blob)

    contests = sum(1 for e in data["events"] if e["type"] == "contest")
    cfps = sum(1 for e in data["events"] if e["type"] == "cfp")
    print("added:", len(added), "skipped(dupe):", len(skipped))
    if skipped:
        print("  skipped:", "; ".join(skipped))
    print("total events:", data["count"], "| contest:", contests, "| cfp:", cfps)

if __name__ == "__main__":
    main()
