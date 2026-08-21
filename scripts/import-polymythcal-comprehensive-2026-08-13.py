#!/usr/bin/env python3
"""Idempotently import the 2026-08-13 Polymythcal research sets.

Scope: English/writing/literature/poetry; philosophy; history; the
Polymorphous Mythology Calendar celestial/ritual family; and the Medusa
creator-present regression benchmark. Existing stable IDs are refreshed.
"""
from __future__ import annotations

from urllib.parse import urlsplit
from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[1]
MANUAL = ROOT / "data" / "manual-events.json"
SOURCES = ROOT / "scripts" / "sources.json"
RESEARCH_DIR = ROOT / "data" / "research" / "polymythcal-2026-08-13"
SRC = "manual-polymythcal-comprehensive-2026-08-13"
CHECKED = "2026-08-13T00:00:00-04:00"


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:72] or "source"


def identity(source_url: str, title: str, date: str) -> str:
    return hashlib.sha256(f"{source_url}::{title}::{date[:10]}".encode()).hexdigest()[:20]


def source_root(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}/" if parts.scheme and parts.netloc else url


def _grade_label(number: int) -> str:
    return f"Grade {number}"


def explicit_grade_structure(age_band: str | None) -> dict:
    """Extract only grade/level claims stated literally in the organizer summary.

    Broad labels such as youth, children, or high school are retained as
    education levels but never converted into exact grades.  This avoids the
    inference failure that previously hid Grade 4 eligibility in prose.
    """
    text = str(age_band or "")
    normalized = text.replace("–", "-").replace("—", "-")
    grades: list[str] = []
    if re.search(r"\b(?:kindergarten|K)\s*-\s*Grade\s*12\b", normalized, re.I):
        grades.append("Kindergarten")
        grades.extend(_grade_label(n) for n in range(1, 13))
    for start, end in re.findall(r"\bGrades?\s*(\d{1,2})\s*-\s*(?:Grade\s*)?(\d{1,2})\b", normalized, re.I):
        a, b = int(start), int(end)
        if 1 <= a <= b <= 12:
            grades.extend(_grade_label(n) for n in range(a, b + 1))
    for number in re.findall(r"\bGrade\s*(\d{1,2})\b", normalized, re.I):
        n = int(number)
        if 1 <= n <= 12:
            grades.append(_grade_label(n))
    if re.search(r"\bKindergarten\b", normalized, re.I):
        grades.append("Kindergarten")
    grades = list(dict.fromkeys(grades))

    levels: list[str] = []
    level_patterns = [
        ("elementary", r"\b(elementary|primary|junior school)\b"),
        ("secondary", r"\b(secondary|high school|senior school)\b"),
        ("CEGEP", r"\bCEGEP\b"),
        ("undergraduate", r"\bundergraduate|college/university|university student\b"),
        ("graduate", r"\bgraduate|master(?:'s|s)?|doctoral|PhD\b"),
        ("postdoctoral", r"\bpostdoctoral|post-doc\b"),
        ("educator", r"\beducator|teacher\b"),
        ("professional", r"\bprofessional|faculty|scholar\b"),
        ("open", r"\bopen public|general audience|open to all\b"),
    ]
    for label, pattern in level_patterns:
        if re.search(pattern, normalized, re.I):
            levels.append(label)

    age_match = re.search(r"\bAges?\s*(\d{1,2})\s*-\s*(\d{1,2})\b", normalized, re.I)
    age_range = {"min": int(age_match.group(1)), "max": int(age_match.group(2))} if age_match else None
    out = {"exact_grades": grades, "education_levels": levels}
    if grades:
        numeric = [int(re.search(r"\d+", g).group()) for g in grades if g.startswith("Grade ")]
        if numeric:
            out["grade_min"] = min(numeric)
            out["grade_max"] = max(numeric)
    if age_range:
        out["age_range"] = age_range
    return out


def apply_explicit_eligibility(event: dict) -> dict:
    structured = explicit_grade_structure(event.get("age_band"))
    for field, value in structured.items():
        if value and not event.get(field):
            event[field] = value
    return event


def rec(
    id: str, title: str, date: str, source_url: str, organizer: str,
    *, set_name: str, summary: str, type: str = "contest",
    record_kind: str = "opportunity", end_date: str | None = None,
    venue: str = "Online / organizer-defined", city: str = "Online",
    province: str = "", country: str = "International",
    timezone: str = "America/Toronto", confirmed: bool = True,
    date_precision: str = "date", time_precision: str = "unknown",
    confidence: int | None = None, source_id: str | None = None,
    age_band: str | None = None, writing_bands=None, academic_bands=None,
    subjects=None, genres=None, opportunity_kind: str | None = None,
    topics=None, tags=None, secondary_types=None, qualification_reasons=None,
    recurrence_note: str | None = None, deadline_confidence: str | None = None,
    source_notes: str | None = None, speaker_or_director: str | None = None,
    parent_id: str | None = None, attendance_confirmed: bool = True,
    entry_family: str | None = None, extra=None, **fields,
):
    sid = source_id or slug(organizer)
    reasons = list(qualification_reasons or [])
    if not confirmed and not reasons:
        reasons = ["current-edition-unconfirmed", "date-unconfirmed", "time-unconfirmed"]
    obj = {
        "id": id,
        "identity_key": identity(source_url, title, date),
        "date": date,
        "end_date": end_date,
        "title": title,
        "type": type,
        "secondary_types": secondary_types or [],
        "speaker_or_director": speaker_or_director or organizer,
        "organizer": organizer,
        "venue": venue,
        "source_url": source_url,
        "source_id": sid,
        "source_name": organizer,
        "description": summary,
        "age_band": age_band,
        "writing_bands": writing_bands or [],
        "academic_bands": academic_bands or [],
        "subjects": subjects or [],
        "genres": genres or [],
        "opportunity_kind": opportunity_kind,
        "topics": topics or [],
        "tags": tags or [],
        "parent_id": parent_id,
        "is_parent_festival": False,
        "attendance_confirmed": attendance_confirmed,
        "confidence": confidence if confidence is not None else (96 if confirmed else 78),
        "record_kind": record_kind,
        "date_precision": date_precision,
        "time_precision": time_precision,
        "deadline_confidence": deadline_confidence or ("official-current-cycle" if confirmed else "annual-watch-date-unannounced"),
        "source_notes": source_notes or f"Official or organizer-controlled source reviewed in the Set {set_name} research pass; imported 2026-08-13.",
        "recurrence_note": recurrence_note,
        "source_quality": "official-or-institutional",
        "source_language": "en",
        "source_languages": ["en"],
        "source_language_method": "source-declared",
        "platform_adapter": "manual",
        "first_seen_at": CHECKED,
        "last_checked_at": CHECKED,
        "scraped_at": CHECKED,
        "lifecycle_status": "active",
        "city": city,
        "province": province,
        "country": country,
        "corridor_zone": "online-global" if city == "Online" else "unknown",
        "timezone": timezone,
        "confirmation_status": "confirmed" if confirmed else "unconfirmed",
        "qualification_reasons": reasons,
        "legacy_ids": [],
        "missing_count": 0,
        "research_id": f"{SRC}:{id}",
        "research_source_ref": set_name,
        "research_priority": "comprehensive-set-import",
        "research_registry_status": "included",
        "research_batch": SRC,
        "_upsert_batches": [SRC],
        "entry_family": entry_family or ("opportunity" if record_kind == "opportunity" else "public-event"),
        "_src": SRC,
    }
    if fields:
        obj.update({k: v for k, v in fields.items() if v is not None})
    if extra:
        obj.update(extra)
    return {k: v for k, v in obj.items() if v is not None and v != []}


def watch(id, title, marker, url, organizer, *, set_name, summary, **kw):
    return rec(
        id, title, marker, url, organizer, set_name=set_name,
        summary=summary + " The displayed date is a monitoring marker, not a confirmed deadline.",
        confirmed=False, date_precision="estimated", time_precision="unknown",
        qualification_reasons=kw.pop("qualification_reasons", ["current-edition-unconfirmed", "date-unconfirmed", "time-unconfirmed"]),
        deadline_confidence="annual-watch-date-unannounced", **kw,
    )


def rolling(id, title, start, url, organizer, *, set_name, summary, end="2027-12-31T23:59:00-05:00", **kw):
    return rec(
        id, title, start, url, organizer, set_name=set_name, summary=summary,
        end_date=end, date_precision="range", time_precision="unknown",
        recurrence_note="Rolling or recurring route; check the official source before submitting.", **kw,
    )

records = []
A = records.append

# ---------------------------------------------------------------------------
# SET 1 — ENGLISH, WRITING, LITERATURE, POETRY
# ---------------------------------------------------------------------------
W = dict(set_name="1-English", subjects=["English", "writing", "literature"], academic_bands=["humanities"], topics=["writing", "literature"])
A(rec("dc-canada-childrens-writing-contest-2026", "DC Canada Children's Writing Contest", "2026-10-21T00:00:00-04:00", "https://dc-canada.ca/blogs/news/writing-contests-past-and-present-the-2026-writing-contest-is-open", "DC Canada Education Publishing", summary="Canada-wide Grades 1–6 writing contest with separate word limits for Grades 1–2, 3–4, and 5–6.", age_band="Grades 1–6 in Canada", writing_bands=["kids","juniors"], genres=["student writing"], opportunity_kind="writing contest", **W))
A(rec("kids-world-travel-guide-writing-competition-2026", "Kids World Travel Guide Writing Competition", "2026-10-01T22:00:00+00:00", "https://www.kids-world-travel-guide.com/writing-competition.html", "Kids World Travel Guide", summary="Free international travel-writing competition with age groups 8–11 and 12–15.", age_band="Ages 8–15 worldwide", writing_bands=["kids","juniors","teens"], genres=["travel writing"], opportunity_kind="writing contest", time_precision="exact", timezone="UTC", **W))
A(rec("canterbury-tales-transformations-2027", "Canterbury Tales Writing Competition: Transformations", "2027-02-28T23:59:00+00:00", "https://chaucer.org.uk/canterbury-tales-writing-competition-2026-7-transformations/", "Chaucer Heritage Trust", summary="International poem-or-story competition themed Transformations, with age divisions 5–10, 11–14, and 15–18.", age_band="Ages 5–18 worldwide", writing_bands=["kids","juniors","teens"], genres=["poetry","short story"], opportunity_kind="writing contest", time_precision="exact", timezone="Europe/London", **W))
A(rolling("bazoof-youth-submissions-2026-2027", "BAZOOF! Youth Submissions", "2026-08-14T00:00:00-04:00", "https://www.bazoof.com/submit/", "BAZOOF!", summary="Rolling publication route for stories, nonfiction, poems, and comics by writers ages 7–12.", age_band="Ages 7–12", writing_bands=["kids","juniors"], genres=["fiction","nonfiction","poetry","comics"], opportunity_kind="publication submission", **W))
A(watch("river-of-words-2027-watch", "River of Words 2027 annual watch", "2027-01-01T00:00:00-05:00", "https://www.stmarys-ca.edu/academics/schools/kalmanovitz-school-of-education/centers-institutes/center-environmental-literacy/river-of-words", "River of Words", summary="Recurring Kindergarten–Grade 12 poetry and art program; the next exact deadline remains pending.", age_band="Kindergarten–Grade 12", writing_bands=["kids","juniors","teens","grads"], genres=["poetry","art"], opportunity_kind="student contest", **W))
A(watch("polar-expressions-paused-watch", "Polar Expressions student contests — paused watch", "2027-01-01T00:00:00-05:00", "https://www.polarexpressions.ca/StudentContests.html", "Polar Expressions Publishing", summary="Canadian K–12 poetry and short-story program currently paused pending future viability.", age_band="Kindergarten–Grade 12 in Canada", writing_bands=["kids","juniors","teens","grads"], genres=["poetry","short story"], opportunity_kind="paused writing contest", qualification_reasons=["program-paused","current-edition-unconfirmed","date-unconfirmed"], **W))
A(rec("bennington-young-writers-awards-2026", "Bennington Young Writers Awards", "2026-11-01T00:00:00-04:00", "https://www.bennington.edu/events/bennington-young-creators-awards/bennington-young-writers-awards", "Bennington College", summary="Worldwide Grades 9–12 fiction, nonfiction, and poetry competition requiring teacher or mentor sponsorship.", age_band="Grades 9–12 worldwide", writing_bands=["teens","grads"], genres=["fiction","nonfiction","poetry"], opportunity_kind="writing awards", **W))
A(rec("hamilton-power-of-the-pen-2026", "Hamilton Power of the Pen Creative Writing Contest", "2026-09-30T00:00:00-04:00", "https://www.hpl.ca/articles/power-pen-creative-writing-contest", "Hamilton Public Library", summary="English- or French-language poetry and short-story contest for young people ages 12–18.", age_band="Ages 12–18", writing_bands=["juniors","teens","grads"], genres=["poetry","short story"], opportunity_kind="youth writing contest", province="Ontario", country="Canada", **W))
A(rec("gallaudet-national-literary-competition-2027", "Gallaudet National Literary Competition 2026–27", "2027-01-08T00:00:00-05:00", "https://gallaudet.edu/youth-programs/national-literary-competition/", "Gallaudet University Youth Programs", summary="Writing and ASL competition for Deaf and hard-of-hearing students in the United States and Canada; writing categories cover Grades 6–12.", age_band="Grades 6–12; Deaf or hard-of-hearing students in Canada and the US", writing_bands=["juniors","teens","grads"], genres=["literary writing","ASL"], opportunity_kind="student literary competition", **W))
A(rec("hir-academic-writing-contest-2026-august", "Harvard International Review Academic Writing Contest — August deadline", "2026-08-24T00:00:00-04:00", "https://hir.harvard.edu/contest/", "Harvard International Review", summary="Paid international academic-writing contest for Grades 7–12.", age_band="Grades 7–12 worldwide", writing_bands=["juniors","teens","grads"], genres=["academic essay"], opportunity_kind="academic writing contest", **W))
A(rec("hir-academic-writing-contest-2027-january", "Harvard International Review Academic Writing Contest — January deadline", "2027-01-02T00:00:00-05:00", "https://hir.harvard.edu/contest/", "Harvard International Review", summary="Second announced deadline in the 2026–27 paid international academic-writing contest for Grades 7–12.", age_band="Grades 7–12 worldwide", writing_bands=["juniors","teens","grads"], genres=["academic essay"], opportunity_kind="academic writing contest", **W))
A(rec("ncte-promising-young-writers-2027", "NCTE Promising Young Writers", "2027-02-15T00:00:00-05:00", "https://ncte.org/awards/student-writing-awards/promising-young-writers/", "National Council of Teachers of English", summary="Educator-nominated writing award for Grade 8 students.", age_band="Grade 8", writing_bands=["juniors","teens"], genres=["student writing"], opportunity_kind="student writing award", access_route="educator nomination" if False else None, **W))
A(rec("ncte-achievement-awards-writing-2027", "NCTE Achievement Awards in Writing", "2027-02-15T00:00:00-05:00", "https://ncte.org/awards/student-writing-awards/achievement-awards-in-writing/", "National Council of Teachers of English", summary="Educator-nominated writing award for Grades 10–11.", age_band="Grades 10–11", writing_bands=["teens","grads"], genres=["student writing"], opportunity_kind="student writing award", **W))
A(rec("speech-debate-canada-speak-up-2027", "Speech & Debate Canada: Speak Up", "2027-01-03T00:00:00-05:00", "https://www.speechanddebatecanada.com/persuasive-speech-competition", "Speech & Debate Canada", summary="Online English- and French-language persuasive-speech competition with Grades 6–9 and 10–12 divisions.", type="contest", age_band="Grades 6–12", writing_bands=["juniors","teens","grads"], genres=["persuasive speech","oratory"], opportunity_kind="speech competition", country="Canada", **W))
A(rec("scholastic-art-writing-awards-2027-open", "Scholastic Art & Writing Awards 2027 cycle opens", "2026-10-01T00:00:00-04:00", "https://www.artandwriting.org/awards/", "Scholastic Art & Writing Awards", summary="The 2027 regional cycle opens for Grades 7–12, age 13 or older. Regional deadlines vary from December 2026 through January 2027, and Canadian regional eligibility must be checked.", age_band="Grades 7–12, age 13+; regional eligibility applies", writing_bands=["juniors","teens","grads"], genres=["writing","art"], opportunity_kind="regional awards cycle", date_precision="date", deadline_confidence="opening-date-confirmed-regional-deadlines-vary", **W))
A(rec("jessamy-stursberg-poetry-prize-2027", "Jessamy Stursberg Poetry Prize", "2027-04-30T00:00:00-04:00", "https://poets.ca/offerings/awards/", "League of Canadian Poets", summary="Canadian youth poetry prize with Grade 7–9 and Grade 10–12 divisions.", age_band="Canadian Grades 7–12", writing_bands=["juniors","teens","grads"], genres=["poetry"], opportunity_kind="poetry prize", country="Canada", **W))
A(rec("tpl-young-voices-2027", "Toronto Public Library Young Voices — next issue deadline", "2027-03-22T00:00:00-04:00", "https://tpl.ca/teens/young-voices/", "Toronto Public Library", summary="Issue deadline for Toronto teens submitting writing and visual art to Young Voices magazine; the broader publication route remains open throughout the year.", age_band="Toronto teens", writing_bands=["teens","grads"], genres=["writing","visual art"], opportunity_kind="youth magazine submission", city="Toronto", province="Ontario", country="Canada", **W))
# Polyphony parent and windows
A(rec("polyphony-lit-2026-2027-parent", "Polyphony Lit 2026–27 submission season", "2026-10-01T00:00:00-04:00", "https://www.polyphonylit.org/submission-guidelines", "Polyphony Lit", summary="Parent season for general submissions and themed contests for high-school writers ages 14–18 worldwide. Child entries preserve each published window.", type="contest", record_kind="opportunity", end_date="2027-06-30T23:59:00-04:00", date_precision="range", age_band="Ages 14–18 worldwide", writing_bands=["teens","grads"], genres=["creative writing","literary magazine"], opportunity_kind="submission season", **W))
poly = [
("polyphony-fall-heritage-2026", "Polyphony Lit Fall and Latin/Native American Heritage contests", "2026-11-30T00:00:00-05:00", "Fall and heritage-month contest deadline."),
("polyphony-general-fall-2026", "Polyphony Lit general submissions — fall window", "2026-11-30T00:00:00-05:00", "General submissions run October 1–November 30."),
("polyphony-winter-2027", "Polyphony Lit Winter Contest", "2027-02-28T00:00:00-05:00", "Winter contest runs December 1–February 28."),
("polyphony-black-history-2027", "Polyphony Lit Black History Contest", "2027-03-31T00:00:00-04:00", "Black History contest runs January 1–March 31."),
("polyphony-general-spring-2027", "Polyphony Lit general submissions — spring window", "2027-04-30T00:00:00-04:00", "General submissions run March 1–April 30."),
("polyphony-spring-contest-2027", "Polyphony Lit Spring Contest", "2027-05-31T00:00:00-04:00", "Spring contest runs March 1–May 31."),
("polyphony-api-month-2027", "Polyphony Lit API Month Contest", "2027-05-31T00:00:00-04:00", "Asian and Pacific Islander heritage contest during May."),
("polyphony-pride-2027", "Polyphony Lit Pride Contest", "2027-06-30T00:00:00-04:00", "Pride-themed contest during June."),
]
for i,t,d,s in poly:
    A(rec(i,t,d,"https://www.polyphonylit.org/submission-guidelines","Polyphony Lit",summary=s,age_band="Ages 14–18 worldwide",writing_bands=["teens","grads"],genres=["creative writing"],opportunity_kind="youth literary submission",parent_id="polyphony-lit-2026-2027-parent",**W))
A(watch("one-teen-story-2027-watch", "One Teen Story Contest 2027 watch", "2026-10-01T00:00:00-04:00", "https://one-story.com/write/one-teen-story-contest/", "One Story", summary="The 2027 fiction contest for ages 13–19 is confirmed to open in fall 2026; exact dates remain pending.", age_band="Ages 13–19", writing_bands=["teens","grads"], genres=["short story"], opportunity_kind="fiction contest", **W))
A(rolling("write-the-world-monthly-competitions-2026-2027", "Write the World monthly competitions", "2026-08-14T00:00:00-04:00", "https://writetheworld.org/competitions", "Write the World", summary="Free monthly international writing competitions for ages 13–19; individual monthly calls should be linked as released.", age_band="Ages 13–19 worldwide", writing_bands=["teens","grads"], genres=["monthly writing prompts"], opportunity_kind="recurring writing competitions", **W))
A(rolling("teen-ink-submissions-2026-2027", "Teen Ink year-round submissions", "2026-08-14T00:00:00-04:00", "https://www.teenink.com/submission-guidelines", "Teen Ink", summary="Free year-round publication route for writers ages 13–19.", age_band="Ages 13–19", writing_bands=["teens","grads"], genres=["youth writing"], opportunity_kind="publication submission", **W))
A(rolling("blue-marble-review-submissions-2026-2027", "Blue Marble Review submissions", "2026-08-14T00:00:00-04:00", "https://bluemarblereview.com/submit/", "Blue Marble Review", summary="Recurring poetry, fiction, nonfiction, essay, opinion, and travel-writing submissions for ages 13–22.", age_band="Ages 13–22", writing_bands=["teens","grads"], genres=["poetry","fiction","nonfiction","essay"], opportunity_kind="literary magazine submission", **W))
A(rolling("stone-soup-submissions-2026-2027", "Stone Soup rolling submissions", "2026-08-14T00:00:00-04:00", "https://stonesoup.com/", "Stone Soup", summary="Rolling short-form publication route for writers age 18 and younger.", age_band="Age 18 and younger", writing_bands=["kids","juniors","teens","grads"], genres=["youth writing"], opportunity_kind="publication submission", **W))
A(rec("stone-soup-long-form-fiction-2026", "Stone Soup Long-Form Fiction Contest", "2026-08-30T00:00:00-04:00", "https://stonesoup.com/stone-soup-novel-contest/", "Stone Soup", summary="Long-form fiction opportunity for writers age 18 and younger; manuscripts begin at 8,000 words and selected work may be published.", age_band="Age 18 and younger", writing_bands=["kids","juniors","teens","grads"], genres=["long-form fiction","novel"], opportunity_kind="fiction contest", **W))
A(rolling("skipping-stones-youth-submissions-2026-2027", "Skipping Stones youth submissions and awards", "2026-08-14T00:00:00-04:00", "https://www.skippingstones.org/wp/annual-haiku-contest/", "Skipping Stones", summary="Youth publication and award routes, including K–12 haiku and tanka and Youth Honor Awards for ages 7–18.", age_band="Ages 7–18", writing_bands=["kids","juniors","teens","grads"], genres=["haiku","tanka","youth writing"], opportunity_kind="publication and awards", **W))
# Annual watches
for i,title,url,org,summary in [
("foyle-young-poets-2027-watch","Foyle Young Poets 2027 watch","https://foyleyoungpoets.org/","The Poetry Society","Established international youth poetry prize; next exact cycle pending."),
("bow-seat-ocean-awareness-2027-watch","Bow Seat Ocean Awareness Contest 2027 watch","https://bowseat.org/programs/ocean-awareness-contest/","Bow Seat Ocean Awareness Programs","Recurring youth environmental arts and writing contest; next exact cycle pending."),
("never-such-innocence-2027-watch","Never Such Innocence 2027 watch","https://www.neversuchinnocence.com/competitions","Never Such Innocence","Recurring international youth poetry, art, speech, and song competition; next exact cycle pending."),
("vancouver-writers-fest-youth-2027-watch","Vancouver Writers Fest Youth Writing Contest 2027 watch","https://writersfest.bc.ca/","Vancouver Writers Fest","Recurring youth writing opportunity; next exact cycle pending."),
("poetry-in-voice-2027-watch","Poetry In Voice competitions 2027 watch","https://poetryinvoice.ca/","Poetry In Voice","Canadian recitation and poetry programs; next exact competition cycle pending."),
("royal-commonwealth-society-canada-writing-2027-watch","Royal Commonwealth Society Canada writing and speaking contests 2027 watch","https://rcs.ca/","Royal Commonwealth Society of Canada","Recurring student writing and public-speaking divisions; local and national dates pending."),
("cbc-first-page-student-writing-2027-watch","CBC First Page Student Writing Challenge 2027 watch","https://www.cbc.ca/books/","CBC Books","Official public evidence does not yet confirm a 2027 deadline."),
("walrus-amazon-youth-short-story-2027-watch","Walrus/Amazon youth short-story category 2027 watch","https://thewalrus.ca/","The Walrus","Recurring youth short-story route; 2027 cycle pending."),
("sejong-sijo-2027-watch","Sejong International Sijo Competition 2027 watch","https://www.sejongculturalsociety.org/writing/current/","Sejong Cultural Society","The Sijo competition continues; the former essay category was discontinued beginning in 2026."),
("canadian-innovation-creative-writing-2027-watch","Canadian Innovation Creative Writing Contest 2027 watch","https://canadianinnovationcontest.ca/","Canadian Innovation Contest","Recurring student creative-writing competition; next exact cycle pending."),
("surrey-libraries-youth-writing-2027-watch","Surrey Libraries Youth Writing Contest 2027 watch","https://www.surreylibraries.ca/","Surrey Libraries","Recurring youth writing contest; next exact cycle pending."),
("waterloo-public-library-teen-writing-2027-watch","Waterloo Public Library Teen Writing Contest 2027 watch","https://www.wpl.ca/","Waterloo Public Library","Recurring teen writing contest; next exact cycle pending."),
]:
    A(watch(i,title,"2027-01-01T00:00:00-05:00",url,org,summary=summary,age_band="Youth / exact eligibility pending",writing_bands=["kids","juniors","teens","grads"],genres=["writing"],opportunity_kind="annual writing watch",**W))
# Additional exact Set 1 records
A(rec("lance-ton-balado-2027", "Lance ton balado 2027", "2027-01-15T16:00:00-05:00", "https://slo.qc.ca/prix-et-concours/lance-ton-balado/", "Salon du livre de l'Outaouais", summary="Canada-wide French-language podcast contest for ages 12–18; entries are 4–6 minutes and may be individual or in groups of up to three. The source contains one stale 2026 date that remains flagged.", age_band="Ages 12–18 in Canada", writing_bands=["juniors","teens","grads"], genres=["podcast","audio storytelling"], opportunity_kind="podcast contest", time_precision="exact", country="Canada", source_notes="Official page checked in the Set 1 pass; one internal stale-year inconsistency is preserved.", extra={"source_inconsistency": "One secondary line still names 2026 within the otherwise 2027 cycle."}, **W))
A(rec("french-for-the-future-essay-2026", "French for the Future National Essay Contest", "2026-12-18T23:59:59-05:00", "https://www.french-future.org/programs/essay-contest/rules-and-regulations/", "French for the Future", summary="National French-language essay contest for Canadian Grades 10–12, Secondary IV–V, and eligible CEGEP students; the cycle opens October 14, 2026 and offers university scholarships.", age_band="Canadian Grades 10–12, Secondary IV–V, and eligible CEGEP students", writing_bands=["teens","grads"], genres=["French essay"], opportunity_kind="scholarship essay contest", time_precision="exact", country="Canada", **W))
A(rec("world-literature-today-translation-prize-2027", "World Literature Today Student Translation Prize", "2027-01-10T00:00:00-05:00", "https://worldliteraturetoday.org/translation-prize", "World Literature Today", summary="Worldwide student translation prize for entrants enrolled in translation-studies programs; submissions open September 30, 2026 and separate prose and poetry awards include publication.", age_band="University and graduate translation-studies students worldwide", writing_bands=["grads"], academic_bands=["university","humanities"], genres=["translation","prose","poetry"], opportunity_kind="student translation prize", **{k:v for k,v in W.items() if k!='academic_bands'}))
A(rec("adina-talve-goodman-fellowship-2026", "Adina Talve-Goodman Fellowship", "2026-10-13T23:59:00-04:00", "https://one-story.com/learn/fellowship/", "One Story", summary="No-fee emerging-writer fellowship; applications open September 8, 2026 and results are expected in January 2027.", genres=["fiction"], opportunity_kind="writing fellowship", academic_bands=["humanities","fellowships"], **{k:v for k,v in W.items() if k!='academic_bands'}))
A(rec("esse-darkness-call-2026", "Esse call for papers: Darkness", "2026-09-01T00:00:00-04:00", "https://esse.ca/en/call-for-papers/", "Esse arts + opinions", summary="Thematic call for critical writing on Darkness.", type="cfp", genres=["criticism","essay"], opportunity_kind="thematic call for papers", academic_bands=["humanities","cfps"], **{k:v for k,v in W.items() if k!='academic_bands'}))
A(rec("esse-home-call-2027", "Esse call for papers: Home", "2027-01-10T00:00:00-05:00", "https://esse.ca/en/call-for-papers/", "Esse arts + opinions", summary="Thematic call for critical writing on Home.", type="cfp", genres=["criticism","essay"], opportunity_kind="thematic call for papers", academic_bands=["humanities","cfps"], **{k:v for k,v in W.items() if k!='academic_bands'}))
A(rec("salon-saguenay-literary-prize-2027", "Salon du livre du Saguenay–Lac-Saint-Jean literary prize", "2027-04-30T00:00:00-04:00", "https://salondulivre.ca/voletslsj/prix-litteraires/", "Salon du livre du Saguenay–Lac-Saint-Jean", summary="Publisher-submitted French-language literary prize for qualifying books and authors meeting the regional connection rules.", opportunity_kind="regional literary prize", country="Canada", province="Quebec", **W))
# Local-deadline parent watches
for i,title,url,org,summary in [
("optimist-oratorical-2027-watch","Optimist International Oratorical Contest 2026–27","https://www.optimist.org/member/scholarships4.cfm","Optimist International","Topic and age rules are confirmed; deadlines are set by local clubs and districts."),
("optimist-essay-2027-watch","Optimist International Essay Contest 2026–27","https://www.optimist.org/member/scholarships3.cfm","Optimist International","Topic and general cycle are confirmed; deadlines are set locally."),
("lions-peace-essay-2027-watch","Lions International Peace Essay Contest 2026–27","https://www.lionsclubs.org/en/member-resource-center/marketing-events/events-programs/international-peace-contests/peace-essay-contest","Lions Clubs International","Contest for visually impaired students ages 11–13 with staged club and district deadlines."),
("dictee-pgl-2027-watch","La Dictée P.G.L. 2026–27 cycle","https://fondationpgl.ca/dictee-pgl/","Fondation Paul Gérin-Lajoie","Current cycle and grade categories are confirmed, while several phase dates remain unpublished."),
]:
    A(watch(i,title,"2026-09-01T00:00:00-04:00",url,org,summary=summary,age_band="School-age; exact division rules on official source",writing_bands=["kids","juniors","teens","grads"],genres=["writing","oratory"],opportunity_kind="staged student competition",qualification_reasons=["local-deadline-varies","time-unconfirmed"],**W))
# Funding and professional deadlines
funding = [
("canada-council-translation-2026","Canada Council Translation grant deadline","2026-09-02T00:00:00-04:00","Translation component."),
("canada-council-international-translation-2026","Canada Council International Translation grant deadline","2026-09-02T00:00:00-04:00","International Translation component."),
("canada-council-circulation-touring-2026","Canada Council Circulation and Touring deadline","2026-10-07T00:00:00-04:00","Circulation and Touring component."),
("canada-council-public-outreach-2026","Canada Council Public Outreach deadline","2026-10-14T00:00:00-04:00","Public Outreach component."),
("canada-council-international-residencies-2026","Canada Council International Residencies deadline","2026-10-21T00:00:00-04:00","International Residencies component."),
("canada-council-short-term-projects-2026","Canada Council Short-Term Projects deadline","2026-11-04T00:00:00-05:00","Short-Term Projects component."),
("canada-council-composite-activities-2026","Canada Council Composite Activities deadline","2026-11-25T00:00:00-05:00","Composite Activities component."),
]
for i,t,d,s in funding:
    A(rec(i,t,d,"https://canadacouncil.ca/funding/grants/deadlines","Canada Council for the Arts",summary=s+" This is a funding deadline rather than a writing contest.",type="cfp",opportunity_kind="grant deadline",academic_bands=["humanities","fellowships"],country="Canada",**{k:v for k,v in W.items() if k!='academic_bands'}))
A(watch("canada-council-literary-publishers-2027-watch","Canada Council Literary Publishers 2027 deadline watch","2027-03-01T00:00:00-05:00","https://canadacouncil.ca/funding/grants/deadlines","Canada Council for the Arts",summary="The Literary Publishers component is expected in spring 2027; exact date remains pending.",type="cfp",opportunity_kind="grant deadline",academic_bands=["humanities","fellowships"],country="Canada",**{k:v for k,v in W.items() if k!='academic_bands'}))
A(rec("canada-japan-literary-awards-2026","Canada–Japan Literary Awards","2026-10-14T00:00:00-04:00","https://canadacouncil.ca/funding/prizes/canada-japan-literary-awards","Canada Council for the Arts",summary="Biennial English- and French-language literary awards.",opportunity_kind="literary award",country="Canada",**W))
A(watch("league-canadian-poets-microgrants-2027-watch","League of Canadian Poets event microgrants 2027 watch","2027-01-15T00:00:00-05:00","https://poets.ca/offerings/funding/","League of Canadian Poets",summary="The next expected application window opens in mid-January 2027 for events held April–September 2027.",type="cfp",opportunity_kind="event microgrant",academic_bands=["humanities","fellowships"],country="Canada",**{k:v for k,v in W.items() if k!='academic_bands'}))
A(watch("cbc-literary-prizes-2027-parent-watch","CBC Literary Prizes 2026–27 parent watch","2026-09-01T00:00:00-04:00","https://www.cbc.ca/books/literaryprizes","CBC Books",summary="Parent family for Short Story, Nonfiction, and Poetry prizes; category-specific opening, closing, finalist, and result dates require direct reconciliation.",opportunity_kind="literary prizes",country="Canada",**W))
# Playwriting board
for i,t,d,s in [
("pgc-propeller-residency-2026","Propeller Residency deadline","2026-08-28T00:00:00-04:00","Residency opportunity."),
("pgc-majdi-bou-matar-bursary-2026","Majdi Bou-Matar Bursary deadline","2026-08-31T00:00:00-04:00","Bursary opportunity."),
("pgc-fireworks-development-2026","Fireworks Play Development Program deadline","2026-08-31T00:00:00-04:00","Play-development opportunity."),
("pgc-write-on-q-2026","Write-on-Q deadline","2026-09-08T00:00:00-04:00","Playwriting opportunity."),
("pgc-tremors-festival-2027","Tremors Festival 2027 deadline","2026-09-15T00:00:00-04:00","Festival submission opportunity."),
("pgc-women-at-plays-2026","Women At Play(s) deadline","2026-09-25T00:00:00-04:00","Playwriting opportunity."),
("pgc-shubert-fendrich-2026","Shubert Fendrich Memorial Playwriting Contest","2026-12-31T00:00:00-05:00","Recurring playwriting contest deadline."),
]:
    A(rec(i,t,d,"https://playwrightsguild.ca/opportunities-board/","Playwrights Guild of Canada",summary=s,genres=["playwriting"],opportunity_kind="playwriting opportunity",country="Canada",**W))
for i,t,s in [
("pgc-first-born-reading-room-rolling","First Born Theatre Reading Room — rolling","Ongoing script-reading opportunity."),
("pgc-indigenous-theatre-creators-rolling","Indigenous Theatre Creators script submissions — rolling","Ongoing Indigenous theatre script-submission route."),
("pgc-dramaturgical-reading-rolling","Dramaturgical Reading Program — rolling","Ongoing dramaturgical reading route."),
]:
    A(rolling(i,t,"2026-08-14T00:00:00-04:00","https://playwrightsguild.ca/opportunities-board/","Playwrights Guild of Canada",summary=s,genres=["playwriting"],opportunity_kind="script submission",country="Canada",**W))
# Residencies and academic
for args in [
("banff-futurisms-residency-2027","Banff Futurisms Intensive Writing Residency application deadline","2026-08-19T00:00:00-06:00","https://www.banffcentre.ca/programs/literary-arts/futurisms-intensive-writing-residency-2027","Banff Centre","Program runs February 15–26, 2027.","writing residency"),
("macdowell-spring-summer-2027","MacDowell spring/summer 2027 residency deadline","2026-09-10T00:00:00-04:00","https://www.macdowell.org/apply/application-guidelines","MacDowell","Applications run August 17–September 10, 2026 for residencies March–August 2027.","artist residency"),
("macdowell-fall-winter-2027-28","MacDowell fall/winter 2027–28 residency deadline","2027-02-10T00:00:00-05:00","https://www.macdowell.org/apply/application-guidelines","MacDowell","Deadline for the fall/winter 2027–28 cycle.","artist residency"),
("vermont-studio-fall-2026","Vermont Studio Center application deadline — fall cycle","2026-09-30T00:00:00-04:00","https://vermontstudiocenter.org/apply","Vermont Studio Center","International writers and artists; recurring fall cycle.","artist residency"),
("vermont-studio-spring-2027","Vermont Studio Center application deadline — spring cycle","2027-03-31T00:00:00-04:00","https://vermontstudiocenter.org/apply","Vermont Studio Center","International writers and artists; recurring spring cycle.","artist residency"),
]:
    i,t,d,u,o,s,k=args; A(rec(i,t,d,u,o,summary=s,type="cfp",opportunity_kind=k,academic_bands=["university","humanities","fellowships"],**{k2:v for k2,v in W.items() if k2!='academic_bands'}))
academic1 = [
("acla-2027-proposals","ACLA 2027 paper proposals","2026-09-22T00:00:00-04:00","https://www.acla.org/annual-meeting/conference-faqs","American Comparative Literature Association","Proposal deadline for the May 2027 virtual and Houston meetings."),
("mla-2027-late-breaking","MLA 2027 late-breaking submissions","2026-09-14T00:00:00-04:00","https://www.mla.org/Events/2027-MLA-Convention","Modern Language Association","Late-breaking submission deadline for the January 7–10, 2027 convention in Los Angeles."),
("american-literature-association-2027","American Literature Association 2027 proposals","2027-01-30T00:00:00-05:00","https://americanliteratureassociation.org/ala-conferences/ala-annual-conference/","American Literature Association","Proposal deadline for the May 26–29, 2027 meeting in Boston."),
("canadian-literature-phyllis-webb-2026","Canadian Literature CFP: Phyllis Webb at 100","2026-10-01T00:00:00-07:00","https://accute.ca/2026/07/16/call-for-papers-phyllis-webb-at-one-hundred-canadian-literature/","Canadian Literature","Article deadline for a special issue on Phyllis Webb."),
("canadian-literature-graphic-autobiography-2027","Canadian Literature CFP: Canadian Graphic Auto/Biography","2027-01-31T00:00:00-08:00","https://accute.ca/2026/07/16/call-for-papers-truth-or-dare-canadian-graphic-auto-biography/","Canadian Literature","Articles, interviews, and graphic essays."),
("allegheny-review-2026","The Allegheny Review undergraduate submissions","2026-10-15T00:00:00-04:00","https://allegheny.edu/publications/allegheny-review/","The Allegheny Review","Creative writing by enrolled undergraduate students worldwide."),
("awp-intro-journals-2026","AWP Intro Journals Project nominations","2026-12-01T00:00:00-05:00","https://awpwriter.org/AWP/AWP/Contests/Overview.aspx","Association of Writers & Writing Programs","Annual October 1–December 1 nomination window for students in AWP member programs."),
("ncte-realm-2027","NCTE REALM literary magazine nominations","2027-07-31T00:00:00-04:00","https://ncte.org/awards/student-writing-awards/","National Council of Teachers of English","Annual nomination period for middle-school, high-school, and university literary magazines."),
]
for i,t,d,u,o,s in academic1:
    A(rec(i,t,d,u,o,summary=s,type="cfp",academic_bands=["university","humanities","cfps"],opportunity_kind="academic submission",genres=["literature","writing"],**{k:v for k,v in W.items() if k!='academic_bands'}))
for i,t,u,o,s in [
("awp-undergraduate-magazine-prize-2027-watch","AWP Prize for Undergraduate Literary Magazines 2027 watch","https://awpwriter.org/AWP/AWP/Contests/Overview.aspx","Association of Writers & Writing Programs","Annual February submission window; exact 2027 dates pending."),
("jasna-student-essay-2027-watch","JASNA Student Essay Contest 2027 watch","https://jasna.org/programs/essay-contest/","Jane Austen Society of North America","Worldwide high-school, college/university, and graduate divisions; 2027 topic expected November 2026 and submissions begin in February 2027."),
("accute-graduate-creative-writing-2027-watch","ACCUTE Creative Writing Collective Graduate Student Contest 2027 watch","https://accute.ca/category/contest/","ACCUTE","Creative prose and poetry contest for eligible graduate-student members; exact deadline pending."),
("esse-young-critics-2027-watch","Esse/Hnatyshyn Young Critics Competition 2027 watch","https://esse.ca/en/young-critics-competition/","Esse arts + opinions","Canadian undergraduate and master's criticism opportunity with editorial development and publication; exact deadline pending."),
]:
    A(watch(i,t,"2027-02-01T00:00:00-05:00",u,o,summary=s,type="cfp",academic_bands=["university","humanities","cfps"],opportunity_kind="academic annual watch",**{k:v for k,v in W.items() if k!='academic_bands'}))

# Linked event milestones discovered in the Set 1 pass.  These remain separate
# from their proposal/deadline records so the calendar preserves the complete
# opportunity-to-event sequence.
A(rec("acla-2027-virtual-meeting", "ACLA 2027 Virtual Annual Meeting", "2027-05-15T00:00:00-04:00", "https://www.acla.org/annual-meeting/conference-faqs", "American Comparative Literature Association", set_name="1-English", summary="Virtual component of the 2027 ACLA annual meeting, May 15–16, 2027.", type="conference", record_kind="event", end_date="2027-05-16T23:59:00-04:00", date_precision="range", academic_bands=["university","humanities"], subjects=["English","writing","literature","comparative literature"], topics=["writing","literature"], opportunity_kind="conference", parent_id="acla-2027-proposals", city="Online", country="International"))
A(rec("acla-2027-houston-meeting", "ACLA 2027 Houston Annual Meeting", "2027-05-20T00:00:00-05:00", "https://www.acla.org/annual-meeting/conference-faqs", "American Comparative Literature Association", set_name="1-English", summary="In-person component of the 2027 ACLA annual meeting in Houston, May 20–23, 2027.", type="conference", record_kind="event", end_date="2027-05-23T23:59:00-05:00", date_precision="range", academic_bands=["university","humanities"], subjects=["English","writing","literature","comparative literature"], topics=["writing","literature"], opportunity_kind="conference", parent_id="acla-2027-proposals", venue="Conference venue, Houston", city="Houston", province="Texas", country="United States"))
A(rec("mla-2027-convention", "MLA 2027 Convention", "2027-01-07T00:00:00-08:00", "https://www.mla.org/Events/2027-MLA-Convention", "Modern Language Association", set_name="1-English", summary="Modern Language Association convention in Los Angeles, January 7–10, 2027; linked to the separate late-breaking submission record.", type="conference", record_kind="event", end_date="2027-01-10T23:59:00-08:00", date_precision="range", academic_bands=["university","humanities"], subjects=["English","writing","literature"], topics=["writing","literature"], opportunity_kind="conference", parent_id="mla-2027-late-breaking", venue="Los Angeles convention venues", city="Los Angeles", province="California", country="United States", timezone="America/Los_Angeles"))
A(rec("berkeley-essay-prize-2027-result", "Berkeley Essay Prize 2027 winner announcement", "2027-03-01T00:00:00-05:00", "https://www.sas.rochester.edu/phl/about/prize.html", "University of Rochester Department of Philosophy", set_name="2-Philosophy", summary="Officially stated result date for the 2027 Berkeley Essay Prize; linked to the November 1, 2026 submission deadline.", type="other", record_kind="event", academic_bands=["university","philosophy"], subjects=["philosophy","George Berkeley"], topics=["philosophy"], opportunity_kind="award result", parent_id="berkeley-essay-prize-2026", city="Online", country="International"))

# ---------------------------------------------------------------------------
# SET 2 — PHILOSOPHY
# ---------------------------------------------------------------------------
P = dict(set_name="2-Philosophy", subjects=["philosophy","ethics"], academic_bands=["university","philosophy"], topics=["philosophy","ethics"])
ph_exact = [
("berggruen-prize-essay-2026","Berggruen Prize Essay Competition","2026-08-17T23:59:00-07:00","https://berggruen.org/essay-competition-open","Berggruen Institute","Open English- or Chinese-language essay competition on A New Axial Age? with a US$50,000 prize in each language category.","essay prize"),
("neuroethics-essay-contest-2026","International Neuroethics Society–IYNA Neuroethics Essay Contest","2026-08-21T23:30:00-07:00","https://neuroethicsessaycontest.com/call-for-neuroethics-essays-2026/","International Neuroethics Society and IYNA","Worldwide high-school, general-audience, academic, and video categories; prizes up to US$500.","neuroethics competition"),
("arpa-2026-submissions","Atlantic Region Philosophers’ Association 2026 submissions","2026-08-24T00:00:00-03:00","https://www.acpcpa.ca/cpages/calls","Atlantic Region Philosophers’ Association","Conference paper or abstract submission deadline.","conference submission"),
("apa-pacific-2027-submissions","APA 2027 Pacific Division paper submissions","2026-09-01T00:00:00-04:00","https://www.apaonline.org/events/EventDetails.aspx?id=2009785","American Philosophical Association","Paper-submission deadline for the March 24–27, 2027 meeting in Portland.","conference submission"),
("concepcion-teaching-prize-2026","David W. Concepción Prize for Excellence in Philosophy Teaching","2026-09-06T00:00:00-04:00","https://www.apaonline.org/news/732911/Deadline-Extension-2026-David-W.-Concepcin-Prize-for-Excellence-in-Philosophy-Teaching.htm","American Philosophical Association","Extended deadline for a philosophy teaching prize.","teaching prize"),
("nhc-residential-fellowship-2027-28","National Humanities Center Residential Fellowship 2027–28","2026-10-01T00:00:00-04:00","https://nationalhumanitiescenter.org/residential-fellowships/","National Humanities Center","Advanced humanities fellowship; references are due October 8, 2026.","research fellowship"),
("sanders-early-modern-2026","Sanders Prize in the History of Early Modern Philosophy","2026-10-01T00:00:00-04:00","https://marcsandersfoundation.org/early-modern-philosophy/","Marc Sanders Foundation","US$5,000 unpublished-paper prize for eligible graduate, early-career, and independent scholars.","philosophy paper prize"),
("tertiary-ethics-olympiad-2026","Tertiary Ethics Olympiad","2026-10-08T00:00:00+11:00","https://ethicsolympiad.org/?page_id=6616","Ethics Olympiad","Online undergraduate team competition; the source carries stale 2025 wording alongside the 2026 date.","ethics team competition"),
("immerse-philosophy-essay-2026","Immerse Education Essay Competition — Philosophy","2026-10-25T00:00:00+00:00","https://www.immerse.education/essay-competition/","Immerse Education","Free worldwide essay competition for ages 13–18; prizes are program scholarships. The official site contains stale secondary FAQ language.","scholarship essay competition"),
("berkeley-essay-prize-2026","Berkeley Essay Prize","2026-11-01T00:00:00-04:00","https://www.sas.rochester.edu/phl/about/prize.html","University of Rochester Department of Philosophy","George Berkeley essay prize; general eligibility is not clearly stated on the official page.","philosophy essay prize"),
("cfa-canada-ethics-challenge-institution-2026","CFA Societies Canada Ethics Challenge — institution confirmation","2026-10-31T00:00:00-04:00","https://cfacanada.org/ethics/canada-ethics-challenge/","CFA Societies Canada","University participation-confirmation deadline for the staged Canadian ethics case competition.","ethics case competition"),
("cfa-canada-ethics-challenge-registration-2026","CFA Societies Canada Ethics Challenge — team registration","2026-11-30T00:00:00-05:00","https://cfacanada.org/ethics/canada-ethics-challenge/","CFA Societies Canada","Team or individual registration deadline; learning and competition stages continue into May 2027.","ethics case competition"),
("cfa-canada-ethics-challenge-national-2027","CFA Societies Canada Ethics Challenge — national competition","2027-05-07T00:00:00-04:00","https://cfacanada.org/ethics/canada-ethics-challenge/","CFA Societies Canada","National virtual competition following local events in January and February.","ethics case competition"),
("apa-lebowitz-2026","APA Lebowitz Prize nominations","2026-11-30T00:00:00-05:00","https://www.apaonline.org/events/EventDetails.aspx?group=110432&id=455214","American Philosophical Association","Nomination or self-nomination deadline under APA eligibility rules.","professional philosophy prize"),
("apa-edinburgh-fellowship-2027-28","APA–University of Edinburgh Fellowship 2027–28","2026-12-15T00:00:00-05:00","https://www.apaonline.org/page/edinburgh","American Philosophical Association","Professional research fellowship deadline.","research fellowship"),
("st-gallen-global-essay-2027","St. Gallen Global Essay Competition","2027-02-01T00:00:00+01:00","https://symposium.org/initiatives/global-essay-competition/","St. Gallen Symposium","Postgraduate essay competition with a CHF20,000 prize pool; some inherited prior-cycle wording requires rechecking.","postgraduate essay competition"),
("john-fisher-aesthetics-2027","John Fisher Memorial Prize in Aesthetics","2027-01-15T00:00:00-05:00","https://aesthetics-online.org/page/grantsprizes","American Society for Aesthetics","Biennial original-essay prize in aesthetics.","aesthetics essay prize"),
("asa-monograph-prize-2027","American Society for Aesthetics Outstanding Monograph Prize","2027-02-01T00:00:00-05:00","https://aesthetics-online.org/page/MonographPrize","American Society for Aesthetics","Professional book or monograph recognition, not an essay-submission opportunity.","book prize"),
]
for i,t,d,u,o,s,k in ph_exact:
    A(rec(i,t,d,u,o,summary=s,type="cfp" if "submission" in k or "fellowship" in k else "contest",opportunity_kind=k,age_band="See official eligibility",**P))
# APA prize sequence
for i,t,d,k in [
("apa-plantinga-2027","APA Plantinga Prize","2027-01-10T00:00:00-05:00","professional prize"),
("apa-book-prize-2027","APA Book Prize","2027-01-15T00:00:00-05:00","book prize"),
("apa-teaching-technology-2027","APA/OUP Teaching with Technology Prize","2027-01-25T00:00:00-05:00","teaching prize"),
("apa-frank-chapman-sharp-2027","Frank Chapman Sharp Memorial Prize","2027-03-10T00:00:00-05:00","philosophy prize"),
("apa-gittler-award-2027","APA Gittler Award","2027-03-15T00:00:00-04:00","professional award"),
("apa-public-philosophy-oped-2027","APA Public Philosophy Op-Ed Contest","2027-04-15T00:00:00-04:00","public philosophy contest"),
("apa-latin-american-thought-2027","APA Essay Prize in Latin American Thought","2027-04-25T00:00:00-04:00","essay prize"),
("apa-routledge-tf-prize-2027","APA Routledge, Taylor & Francis Prize","2027-04-30T00:00:00-04:00","professional prize"),
("apa-pdc-program-prize-2027","APA/PDC Prize for Excellence and Innovation in Philosophy Programs","2027-06-30T00:00:00-04:00","program prize"),
]:
    A(rec(i,t,d,"https://www.apaonline.org/events/eventdetails.aspx?id=1472741","American Philosophical Association",summary="Confirmed APA 2027 deadline; membership, nomination, publication, or institutional eligibility varies by prize and must be checked.",opportunity_kind=k,**P))
A(rec("apa-eastern-2028-submissions","APA 2028 Eastern Division submissions","2027-02-15T00:00:00-05:00","https://www.apaonline.org/events/event_list.asp?DGPCrPg=1&DGPCrSrt=&group=110424&show=","American Philosophical Association",summary="Submission window runs January 15–February 15, 2027 for a 2028 meeting.",type="cfp",opportunity_kind="conference submission",extra={"event_year":2028,"deadline_year":2027},**P))
A(rec("sanders-political-philosophy-2027-provisional","Sanders Prize in Political Philosophy — provisional official date","2027-07-15T00:00:00-04:00","https://oxfordstudiespoliticalphilosophy.sbs.arizona.edu/marc-sanders-prize-and-recipients","Marc Sanders Foundation",summary="The official source names July 15, 2027 but contains tense inconsistency; reconfirm before reliance.",opportunity_kind="political philosophy paper prize",confirmed=False,qualification_reasons=["official-page-date-requires-reconfirmation","time-unconfirmed"],**P))
A(watch("applied-philosophy-postdoc-2027","Applied Philosophy Postdoctoral Fellowship 2027–28","2027-03-01T00:00:00-05:00","https://www.appliedphil.org/funding/sap-post-doctoral-fellowship-scheme/","Society for Applied Philosophy",summary="Applications open March 1, 2027; the final closing date is not yet published.",type="cfp",opportunity_kind="postdoctoral fellowship",qualification_reasons=["opening-date-confirmed","closing-date-unconfirmed"],**P))
# Youth/education philosophy
for i,t,marker,u,o,s,age in [
("junior-ethics-olympiad-2027-watch","Junior Ethics Olympiad 2027","2027-06-08T00:00:00+10:00","https://ethicsolympiad.org/?page_id=7149","Ethics Olympiad","Official dates include June 8, 10, 11, 16, and 18; Canadian participation is not clearly established.","Approximately ages 9–12; school teams"),
("questions-philosophy-young-people-watch","Questions: Philosophy for Young People submission watch","2027-01-01T00:00:00-05:00","https://www.pdcnet.org/questions/Submission-Guidelines","Philosophy Documentation Center","K–12 philosophical publication route; a current dependable deadline was not recovered.","K–12"),
("aristotle-contest-2027-watch","University of Toronto Aristotle Contest 2027 watch","2027-01-01T00:00:00-05:00","https://philosophy.utoronto.ca/the-aristotle-a-high-school-philosophy-essay-contest/","University of Toronto Department of Philosophy","Canadian high-school philosophy essay contest in English or French; 2027 date unannounced.","Canadian high-school students at or below Grade 12"),
("ethics-bowl-canada-2027-watch","Ethics Bowl Canada 2026–27 series watch","2027-01-15T00:00:00-05:00","https://www.ethicsbowl.ca/","Ethics Bowl Canada","English and French regional, provincial, national, junior, and university Ethics Bowl pathways; exact 2026–27 dates pending.","High school, junior, and university divisions"),
("international-philosophy-olympiad-2027-watch","International Philosophy Olympiad 2027 watch","2027-05-01T00:00:00+00:00","https://www.philosophy-olympiad.org/","International Philosophy Olympiad","International event and national selection pathway; Canada's exact public selection route remains unresolved.","High-school students or recent graduates, generally age 20 or younger"),
("international-logic-olympiad-2027-watch","International Logic Olympiad 2027 watch","2027-01-15T00:00:00-05:00","https://www.logicolympiad.org/","International Logic Olympiad","Worldwide logic competition; 2027 dates not yet announced.","Approximately Grades 9–12 / ages 14–18"),
("john-locke-philosophy-2027-watch","John Locke Global Essay Prize — Philosophy 2027 watch","2027-04-01T00:00:00+00:00","https://www.johnlockeinstitute.com/essay-competition","John Locke Institute","Worldwide under-19 philosophy category; 2027 cycle not yet announced and principal prizes include program scholarships.","Under 19 worldwide"),
("think-essay-prize-2027-watch","Think Essay Prize 2027 watch","2027-01-01T00:00:00+00:00","https://royalinstitutephilosophy.org/news/think-essay-prize/","Royal Institute of Philosophy","Recurring philosophy essay prize for ages 15–18; exact 2027 cycle pending.","Ages 15–18"),
("cambridge-rethink-2027-watch","Cambridge Re:Think Essay Competition 2027 watch","2027-01-01T00:00:00+00:00","https://cambridge-research.org/essay-competition/","Cambridge Centre for International Research","Worldwide free essay competition with ages 11–13 and 14–18 divisions; organizer is independent of the University of Cambridge.","Ages 11–18"),
("ayn-rand-essay-contests-watch","Ayn Rand Institute Essay Contests watch","2027-01-01T00:00:00-05:00","https://aynrand.org/students/essay-contests","Ayn Rand Institute","Text-specific worldwide essay competitions, generally age 13+, with the next deadline listed as TBD; ideological sponsorship must remain visible.","Generally age 13+"),
("concours-philosopher-2027-watch","Concours Philosopher 2027 watch","2027-05-01T00:00:00-04:00","https://www.concoursphilosopher.org/%C3%A9tudiant-e-s/pour-participer","Concours Philosopher","Quebec CEGEP philosophical-dissertation contest; next theme and deadline pending. Generative AI was prohibited in 2026.","Quebec CEGEP students"),
("cpa-student-prizes-2027-watch","Canadian Philosophical Association student prizes 2027 watch","2027-01-01T00:00:00-05:00","https://www.acpcpa.ca/cpages/prizes","Canadian Philosophical Association","English- and French-language student essay prizes associated with the CPA Congress; 2027 details forthcoming.","Postsecondary students under CPA rules"),
]:
    A(watch(i,t,marker,u,o,summary=s,age_band=age,opportunity_kind="philosophy annual watch",writing_bands=["juniors","teens","grads"] if "Grade" in age or "age" in age.lower() or "K–12" in age else [],**P))
# Publications, programs, funding
for i,t,u,o,s in [
("high-school-journal-contemporary-philosophy-rolling","High School Journal of Contemporary Philosophy submissions","https://www.journalofcontemporaryphilosophy.com/","High School Journal of Contemporary Philosophy","Independent high-school journal accepting philosophy essays, reviews, and related work; no dependable deadline is shown."),
("student-philosophy-journal-rolling","Student Philosophy Journal submissions","https://www.studentphilosophyjournal.ca/submission-criteria","Student Philosophy Journal","Recurring Canadian postsecondary publication route with undergraduate emphasis and some graduate/informal-learner access."),
("stance-undergraduate-journal-rolling","Stance undergraduate philosophy submissions","https://openjournals.bsu.edu/stance/about/submissions","Stance","Worldwide current undergraduates may submit philosophy papers; no dependable fixed closing date is shown."),
]:
    A(rolling(i,t,"2026-08-14T00:00:00-04:00",u,o,summary=s,opportunity_kind="philosophy journal submission",**P))
for i,t,u,o,s in [
("dialexicon-dormant-watch","Dialexicon dormant watch","https://www.dialexicon.org/submit","Dialexicon","Canadian high-school philosophy journal currently closed and showing an older deadline."),
("plato-high-school-essay-dormant-watch","PLATO High School Essay Contest dormant watch","https://philosophyteachers.org/plato-essay-contest/","PLATO","Only historical cycles were located; no current edition is confirmed."),
("aporia-byu-2027-watch","Aporia BYU undergraduate journal 2027 watch","https://aporia.byu.edu/site.php?id=submissions","Aporia at Brigham Young University","Undergraduate philosophy journal; current page still shows a 2026 deadline."),
("aporia-st-andrews-2027-watch","Aporia St Andrews 2027 watch","https://ojs.st-andrews.ac.uk/index.php/aporia","Aporia at the University of St Andrews","Next call has not yet been announced."),
("prometheus-philosophy-2027-watch","Prometheus undergraduate philosophy journal 2027 watch","https://prometheus.students.jh.edu/?page_id=190","Prometheus","Previous submission cycle is closed; 2027 call pending."),
("sanders-philosophy-religion-2027-watch","Sanders Philosophy of Religion Prize 2027 watch","https://marcsandersfoundation.org/philosophy-of-religion/","Marc Sanders Foundation","Current competition is closed and directs readers to return in 2027."),
("isee-essay-contest-2027-watch","International Society for Environmental Ethics essay contest 2027 watch","https://iseepi.org/ethics_and_philosophy_essay_co.php","International Society for Environmental Ethics","The 2026 cycle closed; a 2027 call must be confirmed before activation."),
("piksi-boston-2027-watch","PIKSI Boston 2027 application watch","https://piksiboston.weebly.com/","PIKSI Boston","Philosophy access institute; 2027 application dates pending."),
("piksi-rock-2027-watch","PIKSI Rock 2027 application watch","https://www.piksi.org/","PIKSI","Philosophy access institute; 2027 application dates pending."),
("rutgers-diversity-philosophy-2027-watch","Rutgers Summer Institute for Diversity in Philosophy 2027 watch","https://philosophy.rutgers.edu/graduate/summer-institute","Rutgers Philosophy","2027 application dates pending."),
]:
    A(watch(i,t,"2027-01-01T00:00:00-05:00",u,o,summary=s,opportunity_kind="philosophy source watch",**P))
A(rec("ucalgary-graduate-philosophy-essay-2027","University of Calgary Graduate Essay Prize","2027-03-01T00:00:00-07:00","https://arts.ucalgary.ca/philosophy/current-students/graduate/resources/graduate-essay-prize","University of Calgary Philosophy",summary="Department-restricted annual graduate essay prize; not a generally open Canadian opportunity.",opportunity_kind="campus-restricted graduate prize",country="Canada",province="Alberta",extra={"institutional_restriction":"University of Calgary graduate students"},**P))
A(rec("plato-public-philosophy-grants-2027","PLATO public-philosophy grants","2027-01-31T00:00:00-05:00","https://www.apaonline.org/page/grantsandfellowships","PLATO and American Philosophical Association",summary="Recurring educator and public-philosophy funding deadline.",type="cfp",opportunity_kind="public philosophy grant",academic_bands=["philosophy","fellowships"],**{k:v for k,v in P.items() if k!='academic_bands'}))

# ---------------------------------------------------------------------------
# SET 3 — HISTORY
# ---------------------------------------------------------------------------
H = dict(set_name="3-History", subjects=["history","social studies"], academic_bands=["university","humanities"], topics=["history","heritage"])
A(watch("heritage-fairs-2027-parent","Canadian Heritage Fairs 2027 parent watch","2027-01-01T00:00:00-05:00","https://www.canadashistory.ca/youth/heritage-fairs-en/heritage-fair-national-showcase/rules-and-criteria","Canada's History Society",summary="National program with regional child fairs; students research Canadian history, heritage, or culture in English, French, or bilingually. Grade eligibility and dates vary by regional fair.",age_band="School students; exact regional grade rules vary",opportunity_kind="heritage fair series",country="Canada",**H))
A(rec("legion-video-contest-2026","Royal Canadian Legion National Youth Remembrance Video Contest","2026-12-15T00:00:00-05:00","https://www.remembrancecontests.ca/","Royal Canadian Legion",summary="National video submission window runs September 1–December 15, 2026 for Grades 7–12; English, French, or bilingual entries.",age_band="Grades 7–12 in Canada",writing_bands=["juniors","teens","grads"],genres=["video","remembrance"],opportunity_kind="history video contest",country="Canada",**H))
A(rec("capture-ton-patrimoine-2027","Capture ton patrimoine 2027","2026-12-17T00:00:00-05:00","https://actionpatrimoine.ca/activite/capture-national-2027/","Action patrimoine",summary="French-language heritage interpretation and photography contest for Grades 5–6 and all secondary grades, with national and Québec City streams.",age_band="Grades 5–6 and secondary students",writing_bands=["kids","juniors","teens","grads"],genres=["photography","heritage interpretation"],opportunity_kind="heritage competition",country="Canada",province="Quebec",**H))
A(rec("iac-canada-nationals-2027","International Academic Competitions Canada National Championships","2027-06-05T00:00:00-07:00","https://ihbbcanada.com/","International Academic Competitions Canada",summary="Vancouver national championships June 5–6, 2027, including History Bee, History Bowl, Geography Bee, Science Bee, and related exams across school divisions.",type="contest",record_kind="event",end_date="2027-06-06T23:59:00-07:00",date_precision="range",age_band="Elementary, Middle School, Junior Varsity, and Varsity divisions",opportunity_kind="academic tournament",city="Vancouver",province="British Columbia",country="Canada",**H))
A(watch("iac-canada-regionals-2027-watch","International Academic Competitions Canada 2026–27 regional tournaments watch","2027-01-01T00:00:00-05:00","https://ihbbcanada.com/","International Academic Competitions Canada",summary="Regional tournaments are anticipated in Toronto, Vancouver, Ottawa, Alberta, and online; registration details remain pending.",age_band="Elementary through high school",opportunity_kind="academic tournament series",country="Canada",**H))
A(watch("international-history-olympiad-2027-watch","International History Olympiad 2027 watch","2027-07-01T00:00:00+00:00","https://ihbbcanada.com/worldchampionships","International Academic Competitions",summary="International History Olympiad planned for July 2027; exact dates, location, and qualification details remain pending.",age_band="Qualified school-age competitors",opportunity_kind="history olympiad",**H))
for i,t,u,o,s in [
("beaverbrook-vimy-prize-2027-watch","Beaverbrook Vimy Prize 2027 watch","https://vimyfoundation.ca/programs/beaverbrook-vimy-prize","Vimy Foundation","Established Canadian history and remembrance opportunity generally for students ages 15–17; exact 2027 cycle pending."),
("vimy-pilgrimage-award-2027-watch","Vimy Pilgrimage Award 2027 watch","https://vimyfoundation.ca/programs/vimy-pilgrimage-award","Vimy Foundation","Established Canadian history and remembrance opportunity generally for students ages 15–17; exact 2027 cycle pending."),
("vimy-inspires-tomorrow-2027-watch","Vimy Inspires Tomorrow 2027 watch","https://vimyfoundation.ca/programs/vimy-inspires-tomorrow","Vimy Foundation","Project coaching and grants for ages 13–17; public page carries an older deadline and needs refresh."),
]:
    A(watch(i,t,"2027-01-01T00:00:00-05:00",u,o,summary=s,age_band="Ages 13–17 or 15–17, depending on program",opportunity_kind="history and remembrance program",country="Canada",**H))
A(rolling("concord-review-submissions-2026-2027","The Concord Review historical research submissions","2026-08-14T00:00:00-04:00","https://tcr.org/submit","The Concord Review",summary="Rolling international publication route for sole-authored secondary-school historical research in English; a submission fee applies.",age_band="Secondary-school students worldwide",writing_bands=["teens","grads"],genres=["historical research"],opportunity_kind="history journal submission",**H))
A(rec("ink-of-ages-fiction-prize-2027","Ink of Ages Fiction Prize 2027","2026-08-22T00:00:00-04:00","https://fictionprize.worldhistory.org/","World History Encyclopedia",summary="Free worldwide historical- or mythology-inspired fiction prize; submission window runs July 14–August 22, 2026 and entries are limited to 2,000 words.",genres=["historical fiction","mythology-inspired fiction"],opportunity_kind="historical fiction prize",**H))
for i,t,u,o,s in [
("young-historian-awards-2027-watch","Historical Association Young Historian Awards 2027 watch","https://www.history.org.uk/secondary/categories/main-young-historian-awards","Historical Association","Recurring student history awards; exact next cycle pending."),
("historical-association-fiction-2027-watch","Historical Association historical-fiction competition 2027 watch","https://www.history.org.uk/primary/categories/7/news/3452/historical-fiction-competition","Historical Association","Recurring historical-fiction competition for ages 9–14; exact next cycle pending."),
("wha-world-historian-essay-2027-watch","World Historian Student Essay Prize 2027 watch","https://www.thewha.org/prizes-awarded-by-the-wha","World History Association","Existing canonical watch record should be refreshed when the official deadline is announced."),
("minds-underground-history-2027-watch","Minds Underground History competitions 2027 watch","https://www.mindsunderground.com/competitions","Minds Underground","Recurring youth history competition family; exact next cycle pending."),
("societe-historique-quebec-student-2027-watch","Société historique de Québec student historical-writing contest 2027 watch","https://societehistoriquedequebec.qc.ca/","Société historique de Québec","French-language Secondary III–IV historical-writing competition; exact next cycle pending."),
("valour-canada-scholarship-2027-watch","Valour Canada History and Heritage Scholarship 2027 watch","https://valourcanada.ca/","Valour Canada","Current source contains stale or contradictory details and excludes Quebec; preserve those restrictions.")]:
    A(watch(i,t,"2027-01-01T00:00:00-05:00",u,o,summary=s,age_band="Student eligibility varies",opportunity_kind="history annual watch",**H))
# Professional history
hist_exact = [
("cha-2027-proposals","Canadian Historical Association 2027 proposals","2026-10-16T00:00:00-04:00","https://cha-shc.ca/about/what-we-do/annual-meeting/","Canadian Historical Association","Proposal deadline for the June 14–16, 2027 meeting in Winnipeg.","conference submission"),
("cha-2027-meeting","Canadian Historical Association Annual Meeting 2027","2027-06-14T00:00:00-05:00","https://cha-shc.ca/about/what-we-do/annual-meeting/","Canadian Historical Association","Annual meeting at St John's College in Winnipeg, June 14–16, 2027.","conference"),
("wha-bloomsbury-diversity-2026","WHA/Bloomsbury Diversity in World History deadline","2026-09-01T00:00:00-04:00","https://www.thewha.org/","World History Association","Publishing initiative deadline.","publishing opportunity"),
("wha-dissertation-prize-2026","World History Association Dissertation Prize","2026-10-01T00:00:00-04:00","https://www.thewha.org/","World History Association","Dissertation prize deadline.","dissertation prize"),
("wha-bentley-book-prize-2027","World History Association Bentley Book Prize","2027-02-01T00:00:00-05:00","https://www.thewha.org/","World History Association","Book-prize deadline for books published in 2026.","book prize"),
("ncph-2027-poster-proposals","NCPH 2027 poster proposals","2026-10-07T00:00:00-04:00","https://ncph.org/conference/ncph-2027/call-for-proposals/","National Council on Public History","Poster-proposal deadline for the 2027 conference.","conference submission"),
("ncph-2027-conference","National Council on Public History 2027 conference","2027-04-21T00:00:00-05:00","https://ncph.org/conference/ncph-2027/call-for-proposals/","National Council on Public History","St. Louis conference, April 21–24, 2027.","conference"),
("oral-history-book-award-2027","Oral History Association Book Award","2027-04-01T00:00:00-04:00","https://oralhistory.org/award/","Oral History Association","Book Award deadline.","book award"),
("oral-history-emerging-crises-2027","Emerging Crises Oral History Research Fund","2027-04-15T00:00:00-04:00","https://oralhistory.org/award/","Oral History Association","Research-fund deadline.","research grant"),
("oral-history-indigenous-initiative-2027","Indigenous Initiative Research Fund","2027-06-01T00:00:00-04:00","https://oralhistory.org/award/","Oral History Association","Indigenous oral-history research-fund deadline.","research grant"),
("oral-history-article-award-2027","Oral History Association Article Award","2027-07-01T00:00:00-04:00","https://oralhistory.org/award/","Oral History Association","Article Award deadline.","article award"),
("oral-history-multimedia-award-2027","Elizabeth B. Mason Multimedia Award","2027-07-01T00:00:00-04:00","https://oralhistory.org/award/","Oral History Association","Multimedia oral-history award deadline.","multimedia award"),
("oral-history-teaching-award-2027","Martha Ross Teaching Award","2027-07-01T00:00:00-04:00","https://oralhistory.org/award/","Oral History Association","Teaching Award deadline.","teaching award"),
("saa-2027-submissions","Society for American Archaeology 2027 submissions","2026-09-10T15:00:00-04:00","https://saa.org/AnnualMeeting/SAAAnnualMeeting/Annual-Meeting.aspx","Society for American Archaeology","Submission deadline for the April 7–11, 2027 meeting in Indianapolis.","archaeology conference submission"),
("aia-field-school-scholarship-2027","AIA Field School Scholarships","2027-03-01T23:59:00-05:00","https://www.archaeological.org/grant/waldbaum-scholarship/","Archaeological Institute of America","US$2,000 support for qualifying Canadian or American students undertaking first fieldwork experiences.","field-school scholarship"),
("labour-history-conference-panels-2026","Making History labour conference — panels, roundtables, workshops","2026-12-11T00:00:00-05:00","https://cawls.ca/en/call-for-papers-making-history-workers-conflict-and-collective-action/","Canadian Committee on Labour History / CAWLS","First proposal deadline for panels, roundtables, and workshops.","conference submission"),
("labour-history-conference-papers-2027","Making History labour conference — individual papers","2027-01-10T00:00:00-05:00","https://cawls.ca/en/call-for-papers-making-history-workers-conflict-and-collective-action/","Canadian Committee on Labour History / CAWLS","Separate deadline for individual papers.","conference submission"),
("critical-feminist-histories-2026","Critical Feminist Histories in Canada","2026-10-02T00:00:00-04:00","https://niche-canada.org/2026/03/20/call-for-papers-critical-feminist-histories-in-canada/","Queen's University organizers","Conference at Queen's University, October 2–4, 2026; official surfaces disagree on the already-closed proposal date.","conference"),
("crilcq-scholarships-2026-27","CRILCQ cultural-history scholarships 2026–27","2026-10-12T00:00:00-04:00","https://crilcq.org/actualites/concours-de-bourses-2026-2027-de-la-chaire-de-recherche-en-histoire-culturelle-des-pratiques-non-dominantes/","CRILCQ","French-language master's and doctoral scholarships for cultural history of non-dominant practices.","research scholarship"),
("azrieli-postdoctoral-2027","Azrieli International Postdoctoral Fellowship","2026-11-11T00:00:00+02:00","https://azrielifoundation.org/fellows/internationalpostdoctoral/","Azrieli Foundation","Multidisciplinary fellowship window opens August 9 and closes November 11, 2026; history is eligible.","postdoctoral fellowship"),
]
for i,t,d,u,o,s,k in hist_exact:
    A(rec(i,t,d,u,o,summary=s,type="conference" if k=="conference" else ("cfp" if "submission" in k or "grant" in k or "scholarship" in k or "fellowship" in k or "publishing" in k else "contest"),record_kind="event" if k=="conference" else "opportunity",opportunity_kind=k,**H))
A(rolling("jcha-submissions-2026-2027","Journal of the Canadian Historical Association submissions","2026-08-14T00:00:00-04:00","https://cha-shc.ca/publications/cha-journal/","Canadian Historical Association",summary="Rolling English- and French-language original historical research publication route.",opportunity_kind="history journal submission",country="Canada",**H))
for i,t,marker,u,o,s in [
("wha-2027-conference-watch","World History Association 2027 conference CFP watch","2026-09-01T00:00:00-04:00","https://www.thewha.org/","World History Association","The Pittsburgh conference is announced; the CFP is forthcoming."),
("ncph-awards-2027-watch","NCPH public-history awards 2027 watch","2027-01-01T00:00:00-05:00","https://ncph.org/about/awards/ph-project-award/","National Council on Public History","Outstanding Public History Project and Book Award schedules remain pending."),
("aia-grants-2027-watch","Archaeological Institute of America grants and awards 2027 watch","2027-01-01T00:00:00-05:00","https://www.archaeological.org/programs/professionals/grants-awards/","Archaeological Institute of America","Separate digital archaeology, conservation, heritage, public engagement, publication, diversity, graduate-paper, teaching, and book opportunities require individual dates as announced."),
("caa-pei-2027-watch","Canadian Archaeological Association PEI 2027 meeting watch","2027-01-01T00:00:00-04:00","https://canadianarchaeology.com/presidents-messages/presidents-fall-message","Canadian Archaeological Association","Prince Edward Island is announced as the 2027 site; final dates and CFP remain pending."),
("carkner-labour-history-media-2027-watch","Arthur Carkner Labour History Media Prize 2027 watch","2027-04-10T00:00:00-04:00","https://workershistorymuseum.ca/en/about/the-arthur-carkner-labour-history-media-prize-contest/","Workers' History Museum","Recurring April 10 deadline should be reconfirmed for the current cycle."),
("governor-general-history-awards-parent","Governor General's History Awards — year-round nominations","2026-08-14T00:00:00-04:00","https://www.canadashistory.ca/awards/governor-general-s-history-awards","Canada's History Society","Parent award family spanning Teaching, Community Programming, Popular Media, Museums, and Scholarly Research, with category-specific calendars."),
("canadas-history-inquiry-program-watch","Canada's History bilingual inquiry program watch","2027-01-01T00:00:00-05:00","https://www.canadashistory.ca/education/professional-learning","Canada's History Society","Forthcoming bilingual inquiry-based history-education program; dates pending."),
("cundill-prize-2027-watch","Cundill History Prize 2027 watch","2027-01-01T00:00:00-05:00","https://www.cundillprize.com/submit","Cundill History Prize","Publisher-submitted professional book prize; 2027 submissions have not yet opened."),
]:
    A(watch(i,t,marker,u,o,summary=s,opportunity_kind="history source watch",**H))
A(rec("historical-thinking-institute-2026","Bilingual Historical Thinking Institute 2026","2026-09-01T00:00:00-04:00","https://www.canadashistory.ca/education/professional-learning","Canada's History Society",summary="Bilingual virtual professional-learning institute running from September through December 2026.",type="workshop",record_kind="event",end_date="2026-12-31T23:59:00-05:00",date_precision="range",age_band="Educators",opportunity_kind="professional learning",country="Canada",**H))

# ---------------------------------------------------------------------------
# POLYMORPHOUS MYTHOLOGY CALENDAR — celestial, astrology, ritual
# ---------------------------------------------------------------------------
CBASE = dict(set_name="Polymorphous-Mythology-Calendar", type="other", record_kind="event", entry_family="celestial", source_id="swiss-ephemeris", organizer="Swiss Ephemeris", source_url="https://www.astro.com/swisseph/", subjects=["astronomy","astrology","mythology"], topics=["celestial","astronomy","astrology"], series_title="Polymorphous Mythology Calendar", city="Toronto", province="Ontario", country="Canada", venue="Toronto sky / astronomical instant", timezone="America/Toronto")
# Moon phases calculated from Swiss Ephemeris; UTC instants stored and Toronto context in description.
new_moons = [
("2026-08-12T17:36:44+00:00"),("2026-09-11T03:27:01+00:00"),("2026-10-10T15:50:07+00:00"),("2026-11-09T07:02:07+00:00"),("2026-12-09T00:51:51+00:00"),
("2027-01-07T20:24:25+00:00"),("2027-02-06T15:56:09+00:00"),("2027-03-08T09:29:30+00:00"),("2027-04-06T23:51:09+00:00"),("2027-05-06T10:58:37+00:00"),("2027-06-04T19:40:21+00:00"),("2027-07-04T03:02:04+00:00"),("2027-08-02T10:05:13+00:00"),("2027-08-31T17:41:12+00:00"),("2027-09-30T02:36:06+00:00"),("2027-10-29T13:36:35+00:00"),("2027-11-28T03:24:26+00:00"),("2027-12-27T20:12:20+00:00")]
full_moons = [
("2026-08-28T04:18:33+00:00"),("2026-09-26T16:49:01+00:00"),("2026-10-26T04:11:47+00:00"),("2026-11-24T14:53:36+00:00"),("2026-12-24T01:28:16+00:00"),
("2027-01-22T12:17:22+00:00"),("2027-02-20T23:23:38+00:00"),("2027-03-22T10:43:49+00:00"),("2027-04-20T22:27:11+00:00"),("2027-05-20T10:59:02+00:00"),("2027-06-19T00:44:20+00:00"),("2027-07-18T15:44:56+00:00"),("2027-08-17T07:28:43+00:00"),("2027-09-15T23:03:32+00:00"),("2027-10-15T13:46:59+00:00"),("2027-11-14T03:25:55+00:00"),("2027-12-13T16:08:50+00:00")]
for phase, seq in [("New Moon",new_moons),("Full Moon",full_moons)]:
    for d in seq:
        day=d[:10]
        A(rec(f"{phase.lower().replace(' ','-')}-{day}",f"{phase} — {day}",d,summary=f"Astronomical {phase.lower()} instant. The entry treats lunar phase as a physical event while allowing documented calendars and rituals to link to it without collapsing those traditions into one meaning.",date_precision="exact",time_precision="exact",confidence=99,extra={"celestial_system":"astronomical lunar phase","astronomy_visibility":"Phase instant; practical observation depends on local sky and phase.","social_functions":["calendar synchronization","ritual timing","seasonal coordination"],"socio_note":"Across societies, lunar phases have been used to coordinate ritual, fasting, feasting, agriculture, and public time; each linked tradition requires its own evidence."},**CBASE))
# Eclipses
ECLIPSES = [
("annular-solar-eclipse-2026-02-17","Annular solar eclipse","2026-02-17T12:13:06+00:00","Annular eclipse; central path outside Toronto. NASA gives greatest eclipse at 12:13:06 TD (12:12 UT).","https://eclipse.gsfc.nasa.gov/OH/OH2026.html"),
("total-lunar-eclipse-2026-03-03","Total lunar eclipse","2026-03-03T11:34:52+00:00","Total lunar eclipse. NASA gives greatest eclipse at 11:34:52 TD (11:34 UT).","https://eclipse.gsfc.nasa.gov/OH/OH2026.html"),
("total-solar-eclipse-2026-08-12","Total solar eclipse","2026-08-12T17:47:06+00:00","Totality crossed Greenland, Iceland, Spain, Russia, and a small part of Portugal; Toronto experienced a partial eclipse. NASA gives greatest eclipse at 17:47:06 TD (17:46 UT).","https://eclipse.gsfc.nasa.gov/OH/OH2026.html"),
("partial-lunar-eclipse-2026-08-28","Partial lunar eclipse","2026-08-28T04:14:04+00:00","Partial lunar eclipse visible from the Americas, Europe, and Africa; this corrects the earlier mistaken September 7 total-eclipse entry. NASA gives greatest eclipse at 04:14:04 TD (04:13 UT).","https://eclipse.gsfc.nasa.gov/OH/OH2026.html"),
("annular-solar-eclipse-2027-02-06","Annular solar eclipse","2027-02-06T15:56:00+00:00","Annular eclipse visible in parts of South America and Africa; not visible as an annular eclipse from Toronto.","https://science.nasa.gov/eclipses/future-eclipses/"),
("penumbral-lunar-eclipse-2027-02-20","Penumbral lunar eclipse","2027-02-20T23:14:06+00:00","Penumbral lunar eclipse visible from the Americas, Europe, Africa, and Asia.","https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html"),
("penumbral-lunar-eclipse-2027-07-18","Penumbral lunar eclipse","2027-07-18T16:04:09+00:00","Penumbral lunar eclipse mainly visible from Africa, Asia, Australia, and the Pacific.","https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html"),
("total-solar-eclipse-2027-08-02","Total solar eclipse","2027-08-02T10:05:00+00:00","Totality visible across southern Spain, North Africa, Saudi Arabia, Yemen, and nearby regions; eastern Canada sees a partial eclipse.","https://science.nasa.gov/eclipses/future-eclipses/"),
("penumbral-lunar-eclipse-2027-08-17","Penumbral lunar eclipse","2027-08-17T07:14:59+00:00","Penumbral lunar eclipse visible from the Pacific and Americas.","https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html"),
]
for i,t,d,s,u in ECLIPSES:
    A(rec(i,t,d,u,"NASA",set_name="Polymorphous-Mythology-Calendar",summary=s+" Eclipse entries distinguish physical visibility from the political, ritual, and mythic interpretations historically attached to eclipses.",type="other",record_kind="event",entry_family="celestial",date_precision="exact",time_precision="exact",source_id="nasa-eclipses",subjects=["astronomy","mythology"],topics=["celestial","eclipse"],tags=["eclipse","Polymorphous Mythology Calendar"],series_title="Polymorphous Mythology Calendar",venue="Sky event; visibility region in description",city="Toronto",province="Ontario",country="Canada",timezone="America/Toronto",extra={"celestial_system":"eclipse","social_functions":["collective attention","omens and legitimacy in historical traditions","public science coordination"],"socio_note":"Eclipses often become sites where astronomical prediction, public authority, ritual response, and collective anxiety meet; tradition-specific claims require documented sources."}))
# Equinoxes and solstices Toronto local times
seasons=[
("september-equinox-2026","September equinox","2026-09-22T20:05:00-04:00"),
("december-solstice-2026","December solstice","2026-12-21T15:50:00-05:00"),
("march-equinox-2027","March equinox","2027-03-20T16:24:00-04:00"),
("june-solstice-2027","June solstice","2027-06-21T10:10:00-04:00"),
("september-equinox-2027","September equinox","2027-09-23T02:01:00-04:00"),
("december-solstice-2027","December solstice","2027-12-21T21:42:00-05:00"),
]
for i,t,d in seasons:
    A(rec(i,t,d,"https://www.timeanddate.com/calendar/seasons.html?n=250","Time and Date",set_name="Polymorphous-Mythology-Calendar",summary=f"{t} in Toronto. Seasonal turning points structure agricultural, religious, civic, and household calendars, but each tradition's account remains separate.",type="other",record_kind="event",entry_family="celestial",date_precision="exact",time_precision="exact",source_id="toronto-seasons",subjects=["astronomy","ritual studies"],topics=["celestial","seasonal","ritual"],tags=["equinox" if "equinox" in t.lower() else "solstice","Polymorphous Mythology Calendar"],series_title="Polymorphous Mythology Calendar",venue="Toronto astronomical instant",city="Toronto",province="Ontario",country="Canada",timezone="America/Toronto",extra={"celestial_system":"seasonal solar cycle","social_functions":["seasonal synchronization","agricultural coordination","ritual calendar anchoring","labour and rest coordination"]}))
# Major meteor showers; dates are peak-night calendar windows and not minute predictions.
showers=[
("perseids-2026","Perseid meteor shower peak","2026-08-12T23:00:00-04:00","2026-08-13T05:00:00-04:00"),
("draconids-2026","Draconid meteor shower peak","2026-10-08T20:00:00-04:00",None),
("orionids-2026","Orionid meteor shower peak","2026-10-21T23:00:00-04:00","2026-10-22T05:00:00-04:00"),
("leonids-2026","Leonid meteor shower peak","2026-11-17T23:00:00-05:00","2026-11-18T05:00:00-05:00"),
("geminids-2026","Geminid meteor shower peak","2026-12-13T23:00:00-05:00","2026-12-14T05:00:00-05:00"),
("ursids-2026","Ursid meteor shower peak","2026-12-21T23:00:00-05:00","2026-12-22T05:00:00-05:00"),
("quadrantids-2027","Quadrantid meteor shower peak","2027-01-03T23:00:00-05:00","2027-01-04T05:00:00-05:00"),
("lyrids-2027","Lyrid meteor shower peak","2027-04-22T23:00:00-04:00","2027-04-23T05:00:00-04:00"),
("eta-aquariids-2027","Eta Aquariid meteor shower peak","2027-05-05T23:00:00-04:00","2027-05-06T05:00:00-04:00"),
("perseids-2027","Perseid meteor shower peak","2027-08-12T23:00:00-04:00","2027-08-13T05:00:00-04:00"),
("orionids-2027","Orionid meteor shower peak","2027-10-21T23:00:00-04:00","2027-10-22T05:00:00-04:00"),
("leonids-2027","Leonid meteor shower peak","2027-11-17T23:00:00-05:00","2027-11-18T05:00:00-05:00"),
("geminids-2027","Geminid meteor shower peak","2027-12-13T23:00:00-05:00","2027-12-14T05:00:00-05:00"),
("ursids-2027","Ursid meteor shower peak","2027-12-21T23:00:00-05:00","2027-12-22T05:00:00-05:00"),
]
for i,t,d,e in showers:
    A(rec(i,t,d,"https://science.nasa.gov/solar-system/meteors-meteorites/meteor-showers/","NASA",set_name="Polymorphous-Mythology-Calendar",summary=f"Approximate Toronto observing window for the {t.lower()}; weather, moonlight, radiant altitude, and light pollution affect visibility. Meteor-shower names preserve historical constellational mapping while modern observation coordinates public scientific attention.",type="other",record_kind="event",entry_family="celestial",end_date=e,date_precision="range",time_precision="approximate",source_id="nasa-meteor-showers",subjects=["astronomy","mythology"],topics=["celestial","meteor shower"],tags=["meteor shower","Toronto sky","Polymorphous Mythology Calendar"],series_title="Polymorphous Mythology Calendar",venue="Dark Toronto-area sky; exact site user-selected",city="Toronto",province="Ontario",country="Canada",timezone="America/Toronto",confidence=90,extra={"celestial_system":"meteor shower","astronomy_visibility":"Best from a dark site with an open sky; no telescope required.","social_functions":["collective observation","public science participation","seasonal skywatching"]}))
# Major astrology events actually discussed, plus real Mercury stations replacing the inaccurate generic four-month reminder.
astrology=[
("neptune-enters-aries-2026","Neptune enters Aries — tropical astrology","2026-01-26T12:40:04-05:00","Neptune's geocentric tropical longitude crosses 0° Aries."),
("saturn-enters-aries-2026","Saturn enters Aries — tropical astrology","2026-02-13T19:11:34-05:00","Saturn's geocentric tropical longitude crosses 0° Aries."),
("uranus-enters-gemini-2026","Uranus enters Gemini — tropical astrology","2026-04-25T20:51:19-04:00","Uranus's geocentric tropical longitude crosses 0° Gemini."),
("mercury-retrograde-2026-oct","Mercury stations retrograde","2026-10-24T03:12:48-04:00","Actual tropical geocentric station, replacing the earlier inaccurate fixed four-month recurrence."),
("mercury-direct-2026-nov","Mercury stations direct","2026-11-13T10:53:57-05:00","Actual tropical geocentric direct station."),
("mercury-retrograde-2027-feb","Mercury stations retrograde","2027-02-09T12:36:09-05:00","Actual tropical geocentric station."),
("mercury-direct-2027-mar","Mercury stations direct","2027-03-03T07:32:06-05:00","Actual tropical geocentric station."),
("mercury-retrograde-2027-jun","Mercury stations retrograde","2027-06-10T14:15:19-04:00","Actual tropical geocentric station."),
("mercury-direct-2027-jul","Mercury stations direct","2027-07-04T15:39:28-04:00","Actual tropical geocentric station."),
("mercury-retrograde-2027-oct","Mercury stations retrograde","2027-10-07T10:37:09-04:00","Actual tropical geocentric station."),
("mercury-direct-2027-oct","Mercury stations direct","2027-10-28T10:10:43-04:00","Actual tropical geocentric station."),
]
for i,t,d,s in astrology:
    A(rec(i,t,d,"https://www.astro.com/swisseph/","Swiss Ephemeris",set_name="Polymorphous-Mythology-Calendar",summary=s+" This is an ephemeris-defined astrology entry, not an astronomical claim about social causation; Polymythcal tracks how astrology narrativizes and coordinates uncertainty.",type="other",record_kind="event",entry_family="astrology",date_precision="exact",time_precision="exact",source_id="swiss-ephemeris",subjects=["astrology","cultural studies"],topics=["celestial","astrology"],tags=["tropical astrology","Polymorphous Mythology Calendar"],series_title="Polymorphous Mythology Calendar",venue="Ephemeris event; not location-dependent",city="Online",province="",country="International",timezone="America/Toronto",extra={"celestial_system":"tropical geocentric astrology","social_functions":["uncertainty management","narrative time organization"],"socio_note":"The entry records a calendrical/narrative practice and does not assert that the transit causes social events."}))
# Taiwanese and Han calendar observances explicitly discussed; date rules from Taiwan DGPA.
rituals=[
("taiwan-zhongyuan-2026","Zhongyuan Festival / 中元節","2026-08-27T00:00:00+08:00","Seventh lunar month, day 15; ancestor and ghost-related observances coordinate offerings, communal memory, and boundaries between households, communities, and the dead."),
("taiwan-mid-autumn-2026","Mid-Autumn Festival / 中秋節","2026-09-25T00:00:00+08:00","Eighth lunar month, day 15; family gathering, gift exchange, food sharing, and lunar symbolism organize kinship and seasonal time."),
("taiwan-double-ninth-2026","Double Ninth Festival / 重陽節","2026-10-19T00:00:00+08:00","Ninth lunar month, day 9; age, ascent, remembrance, and seasonal practices vary by community."),
("taiwan-lunar-new-year-2027","Lunar New Year / 春節","2027-02-07T00:00:00+08:00","First lunar month, day 1; household reunion, ancestor offerings, gift circulation, debt and obligation settlement, and calendrical reset."),
("taiwan-lantern-festival-2027","Lantern Festival / 元宵節","2027-02-21T00:00:00+08:00","First lunar month, day 15; closes the New Year season through public display, food, riddles, and community gathering."),
("taiwan-qingming-2027","Qingming Festival / 清明節","2027-04-05T00:00:00+08:00","Solar-term-linked ancestor observance centred on grave tending, offerings, kinship memory, and land attachment."),
("taiwan-buddha-birthday-2027","Buddha's Birthday / 佛陀誕辰日","2027-05-13T00:00:00+08:00","Fourth lunar month, day 8; Buddhist ritual observance with temple, devotional, charitable, and communal forms."),
("taiwan-dragon-boat-2027","Dragon Boat Festival / 端午節","2027-06-09T00:00:00+08:00","Fifth lunar month, day 5; racing, food, protection rites, commemoration, and local civic spectacle coordinate community identity."),
("taiwan-zhongyuan-2027","Zhongyuan Festival / 中元節","2027-08-16T00:00:00+08:00","Seventh lunar month, day 15; offerings and public ritual organize relations among households, communities, ancestors, and wandering spirits."),
("taiwan-mid-autumn-2027","Mid-Autumn Festival / 中秋節","2027-09-15T00:00:00+08:00","Eighth lunar month, day 15; family gathering, gifting, shared food, and lunar time coordinate kinship and seasonal identity."),
("taiwan-double-ninth-2027","Double Ninth Festival / 重陽節","2027-10-08T00:00:00+08:00","Ninth lunar month, day 9; practices concerning elders, ascent, remembrance, and seasonal transition vary by community."),
]
for i,t,d,s in rituals:
    A(rec(i,t,d,"https://www.dgpa.gov.tw/en/information?pid=13028&uid=353","Directorate-General of Personnel Administration, Taiwan",set_name="Polymorphous-Mythology-Calendar",summary=s+" Polymythcal separates the tradition's date rule and practices from its own socio-structural analysis.",type="other",record_kind="event",entry_family="ritual",date_precision="date",time_precision="all-day",source_id="taiwan-dgpa-calendar",subjects=["ritual studies","Taiwan","social studies"],topics=["ritual","holiday","Taiwan"],tags=["Taiwan","lunisolar calendar","Polymorphous Mythology Calendar"],series_title="Polymorphous Mythology Calendar",venue="Taiwan and diaspora observance; local practice varies",city="Taipei",province="",country="Taiwan",timezone="Asia/Taipei",extra={"calendar_systems":["Chinese lunisolar calendar","Taiwan civil calendar"],"traditions":["Taiwanese","Han Chinese"],"social_functions":["family aggregation","collective memory","ritual synchronization","intergenerational transmission"],"socio_note":s}))
# Dongzhi explicitly discussed as a solstice-linked Taiwanese/Han ritual complex.
for y,d in [(2026,"2026-12-21T15:50:00-05:00"),(2027,"2027-12-21T21:42:00-05:00")]:
    A(rec(f"dongzhi-winter-solstice-{y}",f"Dongzhi / 冬至 — winter solstice {y}",d,"https://www.dgpa.gov.tw/en/information?pid=13028&uid=353","Taiwan DGPA and documented Han/Taiwanese practice",set_name="Polymorphous-Mythology-Calendar",summary="Solstice-linked observance associated in Taiwanese and Han practice with tangyuan, family gathering, ancestor rites, nourishment, and seasonal renewal. The astronomical solstice and the ritual complex remain linked but analytically distinct.",type="other",record_kind="event",entry_family="ritual",date_precision="exact",time_precision="exact",source_id="taiwan-dgpa-calendar",subjects=["ritual studies","astronomy","Taiwan"],topics=["ritual","celestial","seasonal"],tags=["Dongzhi","winter solstice","Polymorphous Mythology Calendar"],series_title="Polymorphous Mythology Calendar",venue="Taiwanese and Han communities; local practice varies",city="Taipei",province="",country="Taiwan",timezone="America/Toronto",extra={"calendar_systems":["solar seasonal cycle","Chinese calendrical tradition"],"traditions":["Taiwanese","Han Chinese"],"social_functions":["family aggregation","ancestor veneration","seasonal synchronization","food-based social cohesion"]}))

# ---------------------------------------------------------------------------
# MEDUSA — creator-present regression benchmark, applied last as requested
# ---------------------------------------------------------------------------
A(rec("soulpepper-medusa-2026","Medusa — Soulpepper / Outside the March","2026-06-19T19:30:00-04:00","https://www.soulpepper.ca/performances/medusa","Soulpepper and Outside the March",set_name="Medusa-regression",summary="Erin Shields's Medusa, directed by Mitchell Cushman. The principal public run is preserved as June 19–July 12, 2026, while an alternate published June 16–July 19 schedule remains recorded rather than silently erased.",type="performance",record_kind="event",end_date="2026-07-12T23:00:00-04:00",date_precision="range",time_precision="approximate",source_id="soulpepper",subjects=["theatre","mythology","media studies"],topics=["Medusa","theatre","mythological reinterpretation"],tags=["Soulpepper","Outside the March","creator-present benchmark"],speaker_or_director="Mitchell Cushman",venue="Young Centre for the Performing Arts, Toronto",city="Toronto",province="Ontario",country="Canada",timezone="America/Toronto",entry_family="performance",extra={"alternate_date_ranges":[{"start":"2026-06-16","end":"2026-07-19","source":"https://mqlit.ca/plays-musicals/medusa"}],"date_conflict":"Primary public run June 19–July 12; alternate published schedule June 16–July 19.","presence_claims":[{"person":"Mitchell Cushman","role":"director","status":"role-confirmed","source":"https://mqlit.ca/plays-musicals/medusa"}]}))
A(rec("soulpepper-medusa-talkback-2026-07-08","Medusa — post-show talkback","2026-07-08T19:30:00-04:00","https://www.soulpepper.ca/performances/medusa","Soulpepper / Toronto Star Theatre Club",set_name="Medusa-regression",summary="July 8 performance followed by a confirmed post-show talkback involving artists from the production. Mitchell Cushman's role as director is confirmed; his attendance at this specific talkback is unconfirmed and therefore remains visible rather than causing the occurrence to disappear.",type="panel",record_kind="event",date_precision="exact",time_precision="approximate",source_id="soulpepper",subjects=["theatre","mythology","media studies"],topics=["Medusa","talkback","creator present"],tags=["post-show talkback","artists from production present","director attendance unconfirmed"],speaker_or_director="Artists from the production; Mitchell Cushman attendance unconfirmed",venue="Young Centre for the Performing Arts, Toronto",city="Toronto",province="Ontario",country="Canada",timezone="America/Toronto",entry_family="creator-present",parent_id="soulpepper-medusa-2026",attendance_confirmed=True,confirmed=True,extra={"talkback_status":"confirmed","director_attendance_status":"unconfirmed","participant_presence":["artists from the production"],"presence_claims":[{"role":"artists from production","status":"confirmed"},{"person":"Mitchell Cushman","role":"director","status":"attendance-unconfirmed"}]},qualification_reasons=["exact-talkback-participants-unconfirmed","director-attendance-unconfirmed"]))

# Explicit exclusions and corrections retained in the research ledger, not published as active events.
exclusions = [
    {"name":"Sejong essay category","reason":"Discontinued beginning in 2026; Sijo route retained."},
    {"name":"Bluefire","reason":"Ended permanently in November 2025."},
    {"name":"Future Scholar Foundation","reason":"Closed permanently in April 2026."},
    {"name":"Goi Peace Foundation International Essay Contest","reason":"Ended after 2024."},
    {"name":"Juvenes Translatores","reason":"Restricted to European Union secondary schools."},
    {"name":"Young Walter Scott Prize","reason":"Geographically restricted; not generally Canada-eligible."},
    {"name":"Blue Kite","reason":"Restricted to students in South Korea."},
    {"name":"Kids Philosophy Slam","reason":"No credible active 2026–27 cycle found."},
    {"name":"Elie Wiesel Prize in Ethics","reason":"Restricted to eligible US institutions."},
    {"name":"Young Citizens","reason":"Program ran through 2024 and is discontinued."},
    {"name":"National History Day","reason":"No Canadian affiliate verified."},
    {"name":"Historical Association Great Debate","reason":"UK regional-heats route; not a general Canadian entry."},
    {"name":"Earlier 2026 September 7 total lunar eclipse claim","reason":"Incorrect; replaced by NASA-confirmed August 28 partial lunar eclipse."},
]

# Derive exact grade and education-level fields only from explicit wording.
for event in records:
    apply_explicit_eligibility(event)

# Add source registry rows, without replacing existing sources.
manual = json.loads(MANUAL.read_text(encoding="utf-8"))
sources_doc = json.loads(SOURCES.read_text(encoding="utf-8"))
source_rows = sources_doc["sources"]
source_by_id = {s.get("id"): s for s in source_rows}
for e in records:
    sid = e["source_id"]
    if sid in source_by_id:
        continue
    row = {
        "id": sid,
        "name": e.get("source_name") or e.get("organizer") or sid,
        "tier_priority": 3,
        "default_type": e.get("type", "other"),
        "base_url": source_root(e["source_url"]),
        "events_url": e["source_url"],
        "render_mode": "static",
        "feed_status": "manual-deep-research",
        "notes": f"Added by {SRC}; official or organizer-controlled source for Set {e.get('research_source_ref')}.",
        "source_mode": "crawl",
        "harvest_enabled": True,
    }
    source_rows.append(row)
    source_by_id[sid] = row

# Stable-ID refresh, no duplicate IDs.
by_id = {e.get("id"): i for i,e in enumerate(manual["events"])}
added = refreshed = 0
for e in records:
    if e["id"] in by_id:
        i = by_id[e["id"]]
        old = manual["events"][i]
        old_identity = old.get("identity_key")
        first_seen = old.get("first_seen_at")
        manual["events"][i] = {**old, **e}
        if old_identity: manual["events"][i]["identity_key"] = old_identity
        if first_seen: manual["events"][i]["first_seen_at"] = first_seen
        refreshed += 1
    else:
        by_id[e["id"]] = len(manual["events"])
        manual["events"].append(e)
        added += 1

for event in manual["events"]:
    apply_explicit_eligibility(event)
manual["events"].sort(key=lambda e: (str(e.get("date","")), str(e.get("title","")), str(e.get("id",""))))
manual["count"] = len(manual["events"])
manual["last_event_research_import"] = "2026-08-13"
manual["polymythcal_comprehensive_update_2026_08_13"] = {
    "source": SRC,
    "records_in_delta": len(records),
    "records_added": added,
    "records_refreshed": refreshed,
    "sets": ["English/writing/literature/poetry", "Philosophy", "History", "Polymorphous Mythology Calendar", "Medusa creator-present regression"],
    "exclusions_retained": len(exclusions),
}
MANUAL.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
sources_doc["$updated"] = "2026-08-13"
sources_doc["polymythcal_comprehensive_expansion_2026_08_13"] = {
    "source": SRC,
    "sources_added": len([s for s in source_rows if str(s.get("notes","")).startswith(f"Added by {SRC}")]),
}
SOURCES.write_text(json.dumps(sources_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
ledger = {
    "schema": "polymythcal-comprehensive-research-ledger-v1",
    "generated_at": CHECKED,
    "source_batch": SRC,
    "record_count": len(records),
    "records": records,
    "exclusions": exclusions,
    "notes": [
        "Confirmed dates remain distinct from annual-watch markers.",
        "Watch-marker dates are explicitly not deadlines.",
        "The September 7, 2026 total lunar eclipse claim was rejected and replaced with the NASA-confirmed August 28 partial lunar eclipse.",
        "The Medusa talkback remains discoverable although director attendance is unconfirmed.",
    ],
}
(RESEARCH_DIR / "research-ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
(RESEARCH_DIR / "exclusions.json").write_text(json.dumps(exclusions, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(json.dumps({"records":len(records),"added":added,"refreshed":refreshed,"manual_total":manual["count"],"sources_total":len(source_rows),"research_dir":str(RESEARCH_DIR)}, indent=2))
