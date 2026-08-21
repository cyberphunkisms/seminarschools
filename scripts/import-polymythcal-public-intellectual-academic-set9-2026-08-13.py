#!/usr/bin/env python3
"""Idempotently import Polymythcal Set 9 — Public Intellectual and Academic Events.

The set fixes a source-to-occurrence failure: venue and institutional calendar
coverage is insufficient unless every useful lecture, panel, colloquium,
workshop, seminar, book event, research showcase, and conference occurrence is
represented with its access conditions and participant evidence.
"""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import json

from polymythcal_set_import_common import make_record as R, apply_import, identity, slug

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("America/Toronto")
CONFIG = {
    "src": "manual-polymythcal-public-intellectual-academic-set9-2026-08-13",
    "research_set": "9-Public-Intellectual-and-Academic-Events",
    "checked": "2026-08-13T20:08:00-04:00",
    "domain_label": "Public Intellectual & Academic",
    "topic_slug": "academic-events",
    "set_tag": "Set 9",
    "entry_family": "public-intellectual-academic",
    "field_name": "public_intellectual_academic_formats",
    "metadata_key": "polymythcal_public_intellectual_academic_set9_update_2026_08_13",
    "sources_metadata_key": "polymythcal_public_intellectual_academic_set9_2026_08_13",
    "research_filename": "polymythcal-research-set-9-public-intellectual-academic-2026-08-13.json",
    "research_dirname": "polymythcal-set9-public-intellectual-academic-2026-08-13",
    "ledger_schema": "polymythcal-public-intellectual-academic-set9-research-ledger-v1",
    "cl_ids": [f"CL-WEB-{n}" for n in range(244, 252)],
    "ledger_notes": [
        "Institutional source coverage is not treated as occurrence coverage.",
        "Series parents and dated child occurrences remain linked but distinct.",
        "Public access, registration, audience, format, and named-participant evidence are independent fields.",
        "A credited role or institutional affiliation never proves attendance at an occurrence.",
        "Speaker or topic TBA remains discoverable with participant identity explicitly pending.",
        "Conflicting institutional listings are preserved as source conflicts instead of silently harmonized.",
    ],
}

records: list[dict] = []

def iso(day: str, clock: str = "00:00") -> str:
    return datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=TZ).isoformat(timespec="seconds")


def claim(person: str, role: str, *, category: str = "scholar-expert",
          status: str = "confirmed", mode: str = "in-person",
          scope: str = "event", evidence: str = "") -> dict:
    return {
        "person": person, "role": role, "category": category,
        "status": status, "mode": mode, "scope": scope,
        "evidence": evidence,
    }


def add_event(*, id: str, title: str, day: str, clock: str, source_url: str,
              organizer: str, summary: str, formats: list[str], type: str,
              venue: str, city: str = "Toronto", province: str = "Ontario",
              country: str = "Canada", end_day: str | None = None,
              end_clock: str | None = None, event_format: str = "in-person",
              interaction_format: str | None = None,
              public_access_status: str = "public",
              audience_scope: str = "public and academic audience",
              registration_required: bool | None = None,
              access_route: str = "official event page",
              participant_identity_status: str = "named",
              claims: list[dict] | None = None, source_id: str | None = None,
              parent_id: str | None = None, series_title: str | None = None,
              series_role: str | None = None, calendar_stage: str | None = None,
              time_precision: str = "exact", source_inconsistency: str | None = None,
              source_notes: str | None = None, source_language: str = "en",
              source_languages: list[str] | None = None,
              education_levels: list[str] | None = None,
              institutional_restriction: str | None = None,
              academic_disciplines: list[str] | None = None,
              qualification_reasons: list[str] | None = None,
              tags: list[str] | None = None, extra: dict | None = None):
    claim_rows = list(claims or [])
    payload = {
        "event_format": event_format,
        "interaction_format": interaction_format or formats[0],
        "public_access_status": public_access_status,
        "audience_scope": audience_scope,
        "registration_required": registration_required,
        "participant_identity_status": participant_identity_status,
        "presence_claims": claim_rows,
        "participant_presence": [
            f"{c['person']} — {c['role']} ({c['status']}, {c['mode']}, {c['scope']})"
            for c in claim_rows
        ],
        "presence_categories": list(dict.fromkeys(c.get("category") for c in claim_rows if c.get("category"))),
        "presence_mode": "mixed" if event_format == "hybrid" else event_format,
        "academic_event_forms": list(dict.fromkeys(formats)),
        "academic_disciplines": list(dict.fromkeys(academic_disciplines or [])),
    }
    if extra:
        payload.update(extra)
    end_date = None
    if end_day:
        end_date = iso(end_day, end_clock or clock)
    records.append(R(
        config=CONFIG, id=id, title=title, date=iso(day, clock), end_date=end_date,
        source_url=source_url, source_id=source_id, organizer=organizer,
        summary=summary, subfields=formats, record_kind="event", type=type,
        city=city, province=province, country=country, venue=venue,
        age_band=audience_scope,
        education_levels=education_levels or ["open", "undergraduate", "graduate", "professional"],
        participation_unit="audience member or registered participant",
        access_route=access_route, institutional_restriction=institutional_restriction,
        registration_url=source_url if registration_required else None,
        parent_id=parent_id, series_title=series_title, series_role=series_role,
        calendar_stage=calendar_stage, time_precision=time_precision,
        source_inconsistency=source_inconsistency, source_notes=source_notes,
        qualification_reasons=qualification_reasons,
        source_language=source_language, source_languages=source_languages,
        tags=["public-intellectual", "academic-event", *(tags or [])], extra=payload,
    ))


# ---------------------------------------------------------------------------
# Reconcile legacy no-ID records before the idempotent import. Stable identity
# is assigned once; prior source/date values are retained in source_history.
# ---------------------------------------------------------------------------
manual_path = ROOT / "data" / "manual-events.json"
manual_doc = json.loads(manual_path.read_text(encoding="utf-8"))
legacy_map = {
    "University Lecture Series: Esme Fuller-Thomson on Optimal Aging": "a9cf2946cd6e",
    "University Lecture Series: Catherine Fogerty on The Ethics of Storytelling": "2c6865c009bf",
    "University Lecture Series: W. David Ward, Alan Toff Lecturer: Eyes of Society": "8d9bc31ec525",
    "Guelph Jazz Festival Colloquium 2026: Artists On/Off the Record": "guelph-jazz-festival-colloquium-2026-artists-on-of-2026-09-10",
    "Hughlings Jackson Lecture 2026: Behaviour, Brain Computation, and Evolution": "285112aa8a67",
    "Health Policy Symposium and Sinclair Lecture: Aging in Communities": "f0c0fc6d67a3",
    "University of Toronto Philosophy Graduate Conference 2026": "university-of-toronto-philosophy-graduate-conferen-2026-10-16",
    "Toronto-Cologne Graduate Student Colloquium 2026": "toronto-cologne-graduate-colloquium-2026",
}
legacy_identity_keys = {
    "University Lecture Series: Esme Fuller-Thomson on Optimal Aging": "cd8ce4e07ff1cec7865b",
    "University Lecture Series: Catherine Fogerty on The Ethics of Storytelling": "5aa5ea6c3207373df913",
    "University Lecture Series: W. David Ward, Alan Toff Lecturer: Eyes of Society": "413f02e90918081b6220",
    "Guelph Jazz Festival Colloquium 2026: Artists On/Off the Record": "1417093cebb5e16fb99d",
    "Hughlings Jackson Lecture 2026: Behaviour, Brain Computation, and Evolution": "851f9b31929974157daf",
    "Health Policy Symposium and Sinclair Lecture: Aging in Communities": "275fd8c620a3abb14fb1",
    "University of Toronto Philosophy Graduate Conference 2026": "bdc7b9081245818ba7b8",
    "Toronto-Cologne Graduate Student Colloquium 2026": "eefd2428f0f6bcecfcf1",
}
temporary_set9_ids = {
    "University Lecture Series: Esme Fuller-Thomson on Optimal Aging": "utoronto-uls-optimal-aging-2026-10-08",
    "University Lecture Series: Catherine Fogerty on The Ethics of Storytelling": "utoronto-uls-ethics-of-storytelling-2026-10-22",
    "University Lecture Series: W. David Ward, Alan Toff Lecturer: Eyes of Society": "utoronto-uls-eyes-of-society-2026-11-12",
    "Guelph Jazz Festival Colloquium 2026: Artists On/Off the Record": "guelph-jazz-colloquium-2026",
    "Hughlings Jackson Lecture 2026: Behaviour, Brain Computation, and Evolution": "mcgill-hughlings-jackson-lecture-2026",
    "Health Policy Symposium and Sinclair Lecture: Aging in Communities": "queens-health-policy-symposium-2026",
    "University of Toronto Philosophy Graduate Conference 2026": "utoronto-philosophy-graduate-conference-2026",
    "Toronto-Cologne Graduate Student Colloquium 2026": "toronto-cologne-graduate-colloquium-2026",
}
legacy_reconciled = []
for event in manual_doc["events"]:
    title = str(event.get("title", ""))
    target = legacy_map.get(title)
    if not target:
        continue
    temporary = temporary_set9_ids[title]
    current = event.get("id")
    if current not in (None, "", target, temporary):
        raise RuntimeError(f"Legacy title already has a conflicting ID: {title} -> {current}")
    aliases = list(event.get("legacy_ids") or [])
    if current and current != target:
        aliases.append(str(current))
    aliases.append(slug(f"{title}-{str(event.get('date',''))[:10]}"))
    event["legacy_ids"] = list(dict.fromkeys(aliases))
    event["id"] = target
    event["identity_key"] = legacy_identity_keys[title]
    legacy_reconciled.append(target)
parent_id_migrations = {
    "guelph-jazz-colloquium-2026": "guelph-jazz-festival-colloquium-2026-artists-on-of-2026-09-10",
}
for event in manual_doc["events"]:
    if event.get("parent_id") in parent_id_migrations:
        event["parent_id"] = parent_id_migrations[event["parent_id"]]
manual_doc["events"].sort(key=lambda e: (str(e.get("date", "")), str(e.get("title", "")), str(e.get("id", ""))))
manual_doc["count"] = len(manual_doc["events"])
manual_path.write_text(json.dumps(manual_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# University of Toronto School of Continuing Studies lecture series.
# ---------------------------------------------------------------------------
uls_url = "https://learn.utoronto.ca/university-lecture-series"
uls_parent = "utoronto-university-lecture-series-2026-27"
add_event(
    id=uls_parent, title="University of Toronto University Lecture Series 2026–27",
    day="2026-10-08", clock="14:00", end_day="2027-03-11", end_clock="15:00",
    source_url=uls_url, source_id="u-t-lecture-series",
    organizer="University of Toronto School of Continuing Studies",
    summary="In-person hour-long talks across history, politics, geography, art, science, architecture, media, and related fields; every announced lecture is stored as its own child occurrence.",
    formats=["public-lecture-series"], type="lecture", venue="University of Toronto St. George Campus",
    interaction_format="lecture-series parent", registration_required=True,
    participant_identity_status="partly-named", claims=[], series_title="University Lecture Series 2026–27",
    series_role="parent", calendar_stage="series run",
)
uls_specs = [
    ("a9cf2946cd6e", "University Lecture Series: Esme Fuller-Thomson on Optimal Aging", "2026-10-08", "Esme Fuller-Thomson", "Optimal Aging"),
    ("utoronto-uls-tiny-chips-human-organs-2026-10-15", "University Lecture Series: Milicia Radisic on Tiny Chips, Big Breakthroughs: Engineering Human Organs", "2026-10-15", "Milicia Radisic", "Tiny Chips, Big Breakthroughs: Engineering Human Organs"),
    ("2c6865c009bf", "University Lecture Series: Catherine Fogerty on The Ethics of Storytelling", "2026-10-22", "Catherine Fogerty", "The Ethics of Storytelling: Telling Real Lives with Care, Accuracy, and Respect"),
    ("utoronto-uls-dna-research-museum-2026-10-29", "University Lecture Series: Oliver Haddrath on DNA Research in the Museum", "2026-10-29", "Oliver Haddrath", "DNA Research in the Museum: From Collections to Genomes"),
    ("utoronto-uls-guardians-of-tomorrow-2026-11-05", "University Lecture Series: Dolf DeJong on Guardians of Tomorrow", "2026-11-05", "Dolf DeJong", "Guardians of Tomorrow: Your Toronto Zoo – Moving From Place to Purpose"),
    ("8d9bc31ec525", "University Lecture Series: W. David Ward, Alan Toff Lecturer: Eyes of Society", "2026-11-12", "W. David Ward", "Eyes of Society"),
    ("utoronto-uls-tba-2027-02-05", "University Lecture Series — speaker and topic TBA", "2027-02-05", None, None),
    ("utoronto-uls-tba-2027-02-11", "University Lecture Series — speaker and topic TBA", "2027-02-11", None, None),
    ("utoronto-uls-tba-2027-02-18", "University Lecture Series — speaker and topic TBA", "2027-02-18", None, None),
    ("utoronto-uls-glp1-medicines-2027-02-25", "University Lecture Series: Daniel Drucker on The Expanding Landscape of GLP-1 Medicines", "2027-02-25", "Daniel Drucker", "The Expanding Landscape of GLP-1 Medicines"),
    ("utoronto-uls-tba-2027-03-04", "University Lecture Series — speaker and topic TBA", "2027-03-04", None, None),
    ("utoronto-uls-alan-toff-art-lecture-2027-03-11", "University Lecture Series: Alan Toff Art Lecture", "2027-03-11", None, "Alan Toff Art Lecture"),
]
for event_id, title, day, speaker, topic in uls_specs:
    tba = speaker is None
    claims = [claim(speaker, "lecturer", evidence="Official University Lecture Series schedule names the lecturer for this occurrence.")] if speaker else [claim("Speaker TBA", "lecturer", status="identity-unannounced", evidence="Official schedule confirms the date but lists the speaker as TBA.")]
    inconsistency = None
    if day == "2027-02-05":
        inconsistency = "The official page labels the winter series as Thursdays, but February 5, 2027 falls on a Friday; the published date is preserved pending organizer correction."
    add_event(
        id=event_id, title=title, day=day, clock="14:00", source_url=uls_url,
        source_id="u-t-lecture-series", organizer="University of Toronto School of Continuing Studies",
        summary=(f"Public University Lecture Series talk: {topic}." if topic else "The date and hour are confirmed; speaker and topic remain unannounced."),
        formats=["public-lecture"], type="lecture", venue="University of Toronto St. George Campus",
        registration_required=True, participant_identity_status="pending" if tba else "named",
        claims=claims, parent_id=uls_parent, series_title="University Lecture Series 2026–27",
        series_role="child", calendar_stage="lecture occurrence", source_inconsistency=inconsistency,
    )


# ---------------------------------------------------------------------------
# Munk School public talks and occurrence-level symposium programme.
# ---------------------------------------------------------------------------
add_event(
    id="munk-deterring-russia-baltic-view-2026-09-21",
    title="How can Europe and NATO deter Russia? A View from the Baltic",
    day="2026-09-21", clock="10:00", end_day="2026-09-21", end_clock="12:00",
    source_url="https://munkschool.utoronto.ca/event/how-can-europe-and-nato-deter-russia-view-baltic",
    source_id="munk-school-events", organizer="Munk School of Global Affairs & Public Policy",
    summary="Public in-person discussion of European and NATO deterrence from a Baltic perspective.",
    formats=["public-talk", "policy-discussion"], type="talk", venue="North House, Room 208",
    registration_required=True, claims=[
        claim("Marko Mihkelson", "speaker", evidence="Official event page names him as speaker."),
        claim("Andres Kasekamp", "chair and discussant", evidence="Official event page names him among the speakers."),
    ],
)
munk_sym_url = "https://munkschool.utoronto.ca/event/hungarian-history-memory-and-public-culture-symposium"
munk_parent = "munk-hungarian-history-memory-symposium-2026"
add_event(
    id=munk_parent, title="Hungarian History, Memory, and Public Culture Symposium",
    day="2026-10-01", clock="17:30", end_day="2026-10-02", end_clock="16:30",
    source_url=munk_sym_url, source_id="munk-school-events",
    organizer="Munk School of Global Affairs & Public Policy",
    summary="Two-day symposium with four keynotes, a book launch and moderated conversation, and a film screening; each programme item is stored separately.",
    formats=["symposium"], type="conference", venue="Campbell Conference Facility",
    registration_required=True, participant_identity_status="named", claims=[],
    series_title="Hungarian History, Memory, and Public Culture Symposium", series_role="parent", calendar_stage="symposium run",
)
for spec in [
    ("munk-symposium-attila-pok-keynote-2026-10-01", "Attila Pók keynote", "2026-10-01", "17:30", "keynote", "Attila Pók"),
    ("munk-symposium-susan-papp-keynote-2026-10-02", "Susan M. Papp keynote", "2026-10-02", "09:30", "keynote", "Susan M. Papp"),
    ("munk-symposium-gergely-romsics-keynote-2026-10-02", "Gergely Romsics keynote", "2026-10-02", "10:45", "keynote", "Gergely Romsics"),
    ("munk-symposium-tamas-scheibner-keynote-2026-10-02", "Tamás Scheibner keynote", "2026-10-02", "12:00", "keynote", "Tamás Scheibner"),
    ("munk-symposium-susan-papp-book-launch-2026-10-02", "Susan M. Papp book launch and moderated conversation", "2026-10-02", "14:00", "book-launch", "Susan M. Papp"),
    ("munk-symposium-young-rebels-screening-2026-10-02", "The Young Rebels screening", "2026-10-02", "15:30", "screening", "Programme participants"),
]:
    event_id, title, day, clock, fmt, person = spec
    add_event(
        id=event_id, title=title, day=day, clock=clock, source_url=munk_sym_url,
        source_id="munk-school-events", organizer="Munk School of Global Affairs & Public Policy",
        summary=f"Dated programme occurrence within the Hungarian history symposium: {title}.",
        formats=[fmt], type="screening" if fmt == "screening" else ("book-talk" if fmt == "book-launch" else "scholar-talk"),
        venue="Campbell Conference Facility", registration_required=True,
        participant_identity_status="partly-named" if fmt == "screening" else "named",
        claims=[claim(person, "featured participant" if fmt != "screening" else "programme participants", status="confirmed" if fmt != "screening" else "partly-announced", evidence="Official symposium programme identifies this occurrence.")],
        parent_id=munk_parent, series_title="Hungarian History, Memory, and Public Culture Symposium",
        series_role="child", calendar_stage="programme occurrence",
    )


# ---------------------------------------------------------------------------
# CIGI hybrid signature lecture.
# ---------------------------------------------------------------------------
add_event(
    id="cigi-canadian-standard-living-productivity-innovation-2026-10-07",
    title="The Canadian Standard of Living, Productivity and Innovation: Actions to Improve Living Standards in Canada",
    day="2026-10-07", clock="17:00", end_day="2026-10-07", end_clock="19:30",
    source_url="https://www.cigionline.org/events/the-canadian-standard-of-living-productivity-and-innovation-actions-to-improve-living-standards-in-canada/",
    source_id="cigi-events", organizer="Centre for International Governance Innovation",
    summary="Hybrid public signature lecture on productivity, innovation adoption, inequality, and Canadian living standards; the lecture begins at 5:45 p.m. after in-person networking.",
    formats=["public-lecture", "policy-discussion"], type="lecture", venue="CIGI Campus and online",
    city="Waterloo", event_format="hybrid", registration_required=True,
    claims=[
        claim("Armine Yalnizyan", "keynote speaker", mode="hybrid", evidence="Official CIGI event page names her as speaker."),
        claim("Joel Blit", "expert discussant", mode="hybrid", evidence="Official CIGI event page names him as speaker/discussant."),
    ], extra={"programme_start_time": iso("2026-10-07", "17:45")},
)


# ---------------------------------------------------------------------------
# Fields Institute conferences, symposia, and Coxeter lectures.
# ---------------------------------------------------------------------------
fields_specs = [
    ("fields-cqiqc-xi-2026", "Conference on Quantum Information and Quantum Control (CQIQC-XI)", "2026-08-17", "09:00", "2026-08-21", "17:00", "https://www.fields.utoronto.ca/activities/26-27/CQIQC-XI", ["conference"], "conference"),
    ("fields-mtns-2026", "International Symposium on Mathematical Theory of Networks and Systems (MTNS)", "2026-08-17", "09:00", "2026-08-21", "17:00", "https://www.fields.utoronto.ca/activities/26-27/MTNS", ["conference", "symposium"], "conference"),
    ("fields-cnam-nonlinear-days-2026", "Fields-CNAM Nonlinear Days 2026", "2026-09-14", "09:00", "2026-09-18", "17:00", "https://www.fields.utoronto.ca/activities/26-27/CNAM", ["conference", "workshop"], "conference"),
    ("fields-optimal-transport-workshop-2026", "Optimal Transport Workshop", "2026-10-19", "09:00", "2026-10-23", "17:00", "https://www.fields.utoronto.ca/activities/26-27/optimal-transport-workshop", ["workshop"], "workshop"),
    ("fields-medal-symposium-2026", "2026 Fields Medal Symposium: Hugo Duminil-Copin", "2026-10-13", "09:00", "2026-10-16", "17:00", "https://www.fields.utoronto.ca/activities/26-27/Fields-Medal-Symposium", ["symposium"], "conference"),
    ("fields-medal-student-night-2026", "2026 Fields Medal Symposium Student Night", "2026-10-14", "18:00", None, None, "https://www.fields.utoronto.ca/activities/26-27/FMS-student", ["student-research-event"], "talk"),
    ("fields-medal-symposium-2027", "2027 Fields Medal Symposium: Maryna Viazovska", "2027-04-12", "09:00", "2027-04-16", "17:00", "https://www.fields.utoronto.ca/activities/26-27/fieldsmedalsym", ["symposium"], "conference"),
]
for event_id, title, day, clock, end_day, end_clock, url, formats, typ in fields_specs:
    add_event(
        id=event_id, title=title, day=day, clock=clock, end_day=end_day, end_clock=end_clock,
        source_url=url, source_id="fields-institute", organizer="Fields Institute",
        summary=f"Fields Institute {formats[0]} for mathematical researchers, students, and interested registrants.",
        formats=formats, type=typ, venue="Fields Institute", public_access_status="specialized-public",
        audience_scope="students, researchers, professionals, and interested registrants",
        registration_required=True, participant_identity_status="partly-named",
        claims=[], institutional_restriction=None,
    )
cox_url = "https://www.fields.utoronto.ca/activities/26-27/gangbo"
cox_parent = "fields-coxeter-lectures-wilfrid-gangbo-2026"
add_event(
    id=cox_parent, title="Coxeter Distinguished Lecture Series: Wilfrid Gangbo",
    day="2026-10-19", clock="15:30", end_day="2026-10-21", end_clock="16:30",
    source_url=cox_url, source_id="fields-institute", organizer="Fields Institute",
    summary="Three-part Coxeter Distinguished Lecture Series by Wilfrid Gangbo; each lecture date is stored separately.",
    formats=["distinguished-lecture-series"], type="lecture", venue="Fields Institute",
    public_access_status="specialized-public", audience_scope="mathematical community and interested registrants",
    registration_required=True, claims=[claim("Wilfrid Gangbo", "Coxeter Distinguished Lecturer", evidence="Official Fields programme names the lecturer.")],
    series_title="Coxeter Distinguished Lecture Series: Wilfrid Gangbo", series_role="parent", calendar_stage="series run",
)
for n, day in enumerate(["2026-10-19", "2026-10-20", "2026-10-21"], 1):
    add_event(
        id=f"fields-coxeter-gangbo-lecture-{n}-2026", title=f"Coxeter Distinguished Lecture {n}: Wilfrid Gangbo",
        day=day, clock="15:30", end_day=day, end_clock="16:30", source_url=cox_url,
        source_id="fields-institute", organizer="Fields Institute",
        summary=f"Lecture {n} in Wilfrid Gangbo’s three-part Coxeter Distinguished Lecture Series.",
        formats=["distinguished-lecture"], type="lecture", venue="Fields Institute",
        public_access_status="specialized-public", audience_scope="mathematical community and interested registrants",
        registration_required=True, claims=[claim("Wilfrid Gangbo", "lecturer", evidence="Official Fields schedule names him for the series.")],
        parent_id=cox_parent, series_title="Coxeter Distinguished Lecture Series: Wilfrid Gangbo",
        series_role="child", calendar_stage="lecture occurrence",
    )


# ---------------------------------------------------------------------------
# University of Toronto public, research, conference, book, and seminar events.
# ---------------------------------------------------------------------------
add_event(
    id="utoronto-engineering-research-conference-2026", title="U of T Engineering Research Conference 2026",
    day="2026-08-21", clock="09:00", end_day="2026-08-21", end_clock="17:00",
    source_url="https://www.engineering.utoronto.ca/event/u-of-t-engineering-research-conference-2026/",
    source_id="utoronto-engineering-events", organizer="University of Toronto Faculty of Applied Science & Engineering",
    summary="Engineering research conference with keynote, oral presentations, posters, and networking.",
    formats=["research-conference", "poster-session", "research-showcase"], type="conference",
    venue="Myhal Centre for Engineering Innovation & Entrepreneurship", public_access_status="academic-public",
    audience_scope="engineering students, researchers, faculty, and invited participants", registration_required=True,
    participant_identity_status="partly-named", claims=[], education_levels=["undergraduate", "graduate", "professional"],
)
add_event(
    id="utoronto-unerd-undergraduate-engineering-research-day-2026", title="UnERD 2026 — Undergraduate Engineering Research Day",
    day="2026-08-25", clock="09:00", source_url="https://www.engineering.utoronto.ca/event/unerd-2026-undergraduate-engineering-research-day/",
    source_id="utoronto-engineering-events", organizer="University of Toronto Faculty of Applied Science & Engineering",
    summary="Undergraduate research showcase open to students, professors, and researchers; exact programme times were not stated on the source page reviewed.",
    formats=["undergraduate-research-day", "research-showcase", "poster-session"], type="conference",
    venue="Myhal Centre for Engineering Innovation & Entrepreneurship", public_access_status="academic-public",
    audience_scope="undergraduate students, professors, and researchers", registration_required=True,
    participant_identity_status="partly-named", claims=[], education_levels=["undergraduate", "graduate", "professional"],
    time_precision="unknown", source_notes="Official Engineering event page confirms the date and audience; exact start time was not stated in the reviewed surface, so 09:00 is a display anchor and time_precision remains unknown.",
)
add_event(
    id="hart-house-theatre-film-television-panel-2026-08-17", title="From Theatre to Film & Television Panel",
    day="2026-08-17", clock="18:30", end_day="2026-08-17", end_clock="20:30",
    source_url="https://harthouse.ca/theatre/workshop/from-theatre-to-film-and-television-panel/",
    source_id="hart-house-events", organizer="Hart House Theatre",
    summary="Free public panel on moving between theatre, film, and television, followed by moderated and audience questions.",
    formats=["panel", "audience-q-and-a"], type="panel", venue="Hart House East Common Room",
    public_access_status="free-public", registration_required=True, claims=[
        claim("Leah Doz", "panelist", category="production-participants", evidence="Official Hart House page names the panelist."),
        claim("Monica Sass", "panelist", category="production-participants", evidence="Official Hart House page names the panelist."),
        claim("Amanda Wong", "panelist", category="production-participants", evidence="Official Hart House page names the panelist."),
    ],
)
add_event(
    id="rotman-jill-lepore-artificial-state-2026-09-30", title='Jill Lepore on "The Rise of the Artificial State"',
    day="2026-09-30", clock="17:30", end_day="2026-09-30", end_clock="18:30",
    source_url="https://www.rotman.utoronto.ca/news-events-and-ideas/public-events/events-listings/2026/september-2026/sept-30-jill-lepore/",
    source_id="rotman-public-events", organizer="Rotman School of Management",
    summary="In-person fireside chat with moderated audience questions, followed by a meet-and-signing period.",
    formats=["author-talk", "fireside-chat", "audience-q-and-a"], type="book-talk",
    venue="Desautels Hall, Rotman School of Management", registration_required=True,
    claims=[
        claim("Jill Lepore", "featured author and speaker", category="author-writer", evidence="Official Rotman page names her as featured speaker."),
        claim("Michelle Shephard", "moderator", category="host-moderator", evidence="Official Rotman page names the moderator."),
    ], extra={"post_event_activity":"meet-and-signing"},
)
add_event(
    id="rotman-ranjay-gulati-everyday-courage-2026-11-11", title='Ranjay Gulati on "How to Be Bold: The Surprising Science of Everyday Courage"',
    day="2026-11-11", clock="17:30", end_day="2026-11-11", end_clock="18:30",
    source_url="https://www.rotman.utoronto.ca/news-events-and-ideas/public-events/events-listings/2026/november-2026/nov-11---ranjay-gulati--/",
    source_id="rotman-public-events", organizer="Rotman School of Management",
    summary="Hybrid author presentation with moderated questions and an in-person meet-and-signing period.",
    formats=["author-talk", "presentation", "audience-q-and-a"], type="book-talk",
    venue="Rotman School of Management and online", event_format="hybrid", registration_required=True,
    claims=[claim("Ranjay Gulati", "featured author and speaker", category="author-writer", mode="hybrid", evidence="Official Rotman page names him as featured speaker.")],
    extra={"post_event_activity":"meet-and-signing"},
)
add_event(
    id="utoronto-engineering-lectures-on-demand-2026", title="U of T Engineering Lectures on Demand",
    day="2026-08-13", clock="00:00", end_day="2026-08-31", end_clock="23:59",
    source_url="https://alumni.utoronto.ca/events-and-programs/engineering-lectures-demand",
    source_id="utoronto-alumni-events", organizer="University of Toronto Alumni",
    summary="Time-bounded online access to recorded engineering lectures; represented as a digital academic-program window rather than a live lecture occurrence.",
    formats=["recorded-lecture-series", "digital-program"], type="webinar", venue="Online",
    city="Online", province="", country="Canada", event_format="online", public_access_status="online-public",
    audience_scope="public online audience", registration_required=False, participant_identity_status="partly-named", claims=[],
    time_precision="all-day", extra={"live_event":False},
)
add_event(
    id="utoronto-public-history-lab-hitler-stalin-timothy-snyder-2026", title="Public History Lab: Hitler and Stalin Today by Timothy Snyder",
    day="2026-08-13", clock="00:00", end_day="2026-12-18", end_clock="23:59",
    source_url="https://alumni.utoronto.ca/events-and-programs/public-history-lab-hitler-and-stalin-today",
    source_id="utoronto-alumni-events", organizer="University of Toronto Alumni",
    summary="Extended public-history learning programme centred on Timothy Snyder’s work; only the future portion from August 13 is represented in this release.",
    formats=["public-history-lab", "extended-academic-program"], type="workshop", venue="Online / organizer-defined",
    city="Online", province="", country="Canada", event_format="online", public_access_status="registered-public",
    audience_scope="public and lifelong-learning audience", registration_required=True,
    claims=[claim("Timothy Snyder", "featured historian", category="scholar-expert", mode="online", scope="programme", evidence="Official U of T listing names the programme and featured historian.")],
    time_precision="all-day",
)
add_event(
    id="utoronto-climate-health-conference-2026-10-23", title="2026 Climate & Health Conference",
    day="2026-10-23", clock="09:00", source_url="https://brn.utoronto.ca/event/2026-climate-health-conference/",
    source_id="utoronto-black-research-network", organizer="University of Toronto Black Research Network",
    summary="Multidisciplinary climate-and-health conference listed by the Black Research Network; exact time and current event-detail surface require confirmation.",
    formats=["conference"], type="conference", venue="University of Toronto / organizer-defined",
    public_access_status="access-unclear", audience_scope="researchers, students, practitioners, and public registrants",
    registration_required=None, participant_identity_status="pending",
    claims=[claim("Participants TBA", "conference participants", status="identity-unannounced", evidence="The official U of T index confirms the conference date, but the detailed participant programme is not available on the accessible source surface.")],
    time_precision="unknown",
    source_notes="The central U of T events index confirms the October 23 date; the detailed BRN event URL currently redirects to the network home page.",
)
witten_parent = "utoronto-daniela-witten-distinguished-lecture-series-2026"
add_event(
    id=witten_parent,
    title="2026 Distinguished Lecture Series in Statistical Sciences: Daniela Witten",
    day="2026-10-01", clock="15:00", end_day="2026-10-02", end_clock="17:00",
    source_url="https://www.artsci.utoronto.ca/events/2026-distinguished-lecture-series-statistical-sciences-daniela-witten-day12",
    source_id="utoronto-statistical-sciences", organizer="University of Toronto Statistical Sciences",
    summary="Two-day distinguished lecture series by Daniela Witten; each announced lecture day is retained as its own child occurrence.",
    formats=["distinguished-lecture-series"], type="lecture", venue="University of Toronto St. George Campus",
    public_access_status="academic-public", registration_required=None, participant_identity_status="named",
    claims=[claim("Daniela Witten", "distinguished lecturer", evidence="Official U of T index names Daniela Witten for the two-day series.")],
    time_precision="unknown", series_title="2026 Distinguished Lecture Series in Statistical Sciences: Daniela Witten",
    series_role="parent", calendar_stage="lecture-series run",
)
for day, suffix in [("2026-10-01","day-1"),("2026-10-02","day-2")]:
    add_event(
        id=f"utoronto-daniela-witten-distinguished-lecture-{suffix}-2026", title=f"2026 Distinguished Lecture Series in Statistical Sciences: Daniela Witten — {suffix.replace('-', ' ').title()}",
        day=day, clock="15:00", source_url=f"https://www.artsci.utoronto.ca/events/2026-distinguished-lecture-series-statistical-sciences-daniela-witten-{suffix.replace('-', '')}2",
        source_id="utoronto-statistical-sciences", organizer="University of Toronto Statistical Sciences",
        summary="Dated occurrence in a two-day distinguished lecture series by Daniela Witten; exact time remains pending on the accessible source surface.",
        formats=["distinguished-lecture"], type="lecture", venue="University of Toronto St. George Campus",
        public_access_status="academic-public", registration_required=None, participant_identity_status="named",
        claims=[claim("Daniela Witten", "distinguished lecturer", evidence="Official U of T index names the lecturer for both dates.")],
        time_precision="unknown", parent_id=witten_parent,
        series_title="2026 Distinguished Lecture Series in Statistical Sciences: Daniela Witten",
        series_role="child", calendar_stage="lecture occurrence",
    )
add_event(
    id="utoronto-fifty-key-performance-artists-book-launch-2026-09-11", title="Fifty Key Performance Artists Book Launch",
    day="2026-09-11", clock="18:00", source_url="https://www.cdtps.utoronto.ca/events/fifty-key-performance-artists-book-launch",
    source_id="utoronto-cdtps-events", organizer="Centre for Drama, Theatre and Performance Studies",
    summary="Public launch and discussion of Fifty Key Performance Artists; exact event time remains pending on the accessible official surface.",
    formats=["book-launch", "academic-discussion"], type="book-talk", venue="University of Toronto / organizer-defined",
    public_access_status="academic-public", registration_required=None, participant_identity_status="partly-named", claims=[], time_precision="unknown",
)

# Philosophy talks and workshops — exact department pages.
philosophy_events = [
    ("utoronto-courtesy-of-phenomenology-2026-08-26", "The courtesy of phenomenology", "2026-08-26", "15:00", "17:00", "talk", "Jocelyn Benoist", "https://philosophy.utoronto.ca/event/the-courtesy-of-phenomenology/"),
    ("utoronto-idea-is-truth-alznauer-2026-09-04", "What Does It Mean that the Idea Is the truth", "2026-09-04", "15:00", "17:00", "talk", "Mark Alznauer", "https://philosophy.utoronto.ca/event/what-does-it-mean-that-the-idea-is-the-truth/"),
    ("utoronto-hegels-sole-idea-workshop-2026-09-05", "Workshop on Hegel’s Sole Idea with Mark Alznauer", "2026-09-05", "09:00", "17:00", "workshop", "Mark Alznauer", "https://philosophy.utoronto.ca/event/workshop-on-hegels-sole-idea-with-mark-alznauer/"),
    ("utoronto-medieval-philosophy-colloquium-2026", "2026 Toronto Colloquium in Medieval Philosophy: A Celebration of Deborah Black", "2026-09-18", "15:30", "18:15", "colloquium", "Multiple scholars", "https://philosophy.utoronto.ca/event/2025-toronto-colloquium-in-medieval-philosophy-a-celebration-of-deborah-black/"),
    ("utoronto-quine-lewis-loewer-2026-09-25", "Bringing Quine and Lewis Back Together", "2026-09-25", "15:00", "17:00", "talk", "Barry Loewer", "https://philosophy.utoronto.ca/event/bringin-quine-and-lewis-back-together/"),
    ("utoronto-linguistic-internalism-externalism-workshop-2026-10-03", "Linguistic Internalism and Externalism: Bridging Medieval and Contemporary Thought", "2026-10-03", "09:00", "18:30", "workshop", "Peter King, Gyula Klima, Simone L. Migliaro, Calvin Normore, Claude Panaccio, and Giorgio Pini", "https://philosophy.utoronto.ca/event/linguistic-internalism-and-externalism-bridging-medieval-and-contemporary-thought/"),
]
for event_id, title, day, clock, end_clock, fmt, people, url in philosophy_events:
    add_event(
        id=event_id, title=title, day=day, clock=clock,
        end_day="2026-09-19" if event_id == "utoronto-medieval-philosophy-colloquium-2026" else day,
        end_clock=end_clock, source_url=url, source_id="utoronto-philosophy-events",
        organizer="University of Toronto Department of Philosophy",
        summary=f"Public or academic philosophy {fmt} with {people}.", formats=[fmt, "philosophy-event"],
        type="workshop" if fmt == "workshop" else ("colloquium" if fmt == "colloquium" else "scholar-talk"),
        venue="Jackman Humanities Building", public_access_status="academic-public",
        audience_scope="philosophy students, scholars, and interested public attendees", registration_required=False,
        claims=[claim(people, "featured speaker(s)", evidence="Official Department of Philosophy event page names the participant or programme.")],
    )
add_event(
    id="utoronto-inqyr-beyond-limits-conference-2026", title="INQYR Beyond Limits: The Conference",
    day="2026-10-02", clock="09:00", source_url="https://socialwork.utoronto.ca/event/inqyr-beyond-limits-the-conference-mobilizing-innovative-global-social-research-for-2slgbtqia-youth-joy-and-resilience/",
    source_id="utoronto-social-work-events", organizer="International Partnership for Queer Youth Resilience",
    summary="One-day in-person conference connecting research, practice, community organizations, young people, policy, and lived experience.",
    formats=["conference", "community-research"], type="conference", venue="Chelsea Hotel Toronto",
    public_access_status="registered-public", audience_scope="researchers, practitioners, community organizations, students, young people, policymakers, and funders",
    registration_required=True, claims=[claim("Ilan H. Meyer", "opening keynote speaker", evidence="Official event page names the keynote speaker.")],
    time_precision="unknown",
)
add_event(
    id="utoronto-tanenbaum-science-sport-conference-2026", title="The 2026 Tanenbaum Institute for Science in Sport Conference",
    day="2026-09-18", clock="09:00", end_day="2026-09-19", end_clock="17:30",
    source_url="https://kpe.utoronto.ca/fri-09182026-0900/2026-tanenbaum-institute-science-sport-conference",
    source_id="utoronto-kpe-events", organizer="Tanenbaum Institute for Science in Sport",
    summary="Public conference on high-performance sport science, sport medicine, analytics, and evidence-based practice.",
    formats=["conference", "research-translation"], type="conference", venue="Goldring Centre for High Performance Sport",
    public_access_status="public", audience_scope="public, researchers, practitioners, coaches, and sport organizations",
    registration_required=True, participant_identity_status="partly-named", claims=[],
)
add_event(
    id="utoronto-jhi-new-faculty-salon-2026-10-01", title="2026 JHI New Faculty Salon",
    day="2026-10-01", clock="16:00", source_url="https://www.humanities.utoronto.ca/events/2026-jhi-new-faculty-salon",
    source_id="utoronto-jhi-events", organizer="Jackman Humanities Institute",
    summary="Humanities salon introducing and connecting new faculty research; exact start time remains pending on the accessible official surface.",
    formats=["salon", "faculty-research-showcase"], type="panel", venue="Jackman Humanities Institute",
    public_access_status="academic-public", registration_required=None, participant_identity_status="partly-named", claims=[], time_precision="unknown",
)
add_event(
    id="utoronto-jhi-varieties-of-uniqueness-2026-10-08", title="Varieties of Uniqueness: Defying Duplication",
    day="2026-10-08", clock="17:00", source_url="https://www.humanities.utoronto.ca/events/varieties-uniqueness-defying-duplication",
    source_id="utoronto-jhi-events", organizer="Jackman Humanities Institute",
    summary="Annual Jackman Lecture in the Humanities with Gwen Bradford; exact start time remains pending on the accessible official surface.",
    formats=["annual-humanities-lecture", "public-lecture"], type="lecture", venue="Jackman Humanities Institute",
    public_access_status="academic-public", registration_required=None,
    claims=[claim("Gwen Bradford", "Annual Jackman Lecturer", evidence="Official JHI events listing names the speaker.")], time_precision="unknown",
)
add_event(
    id="utoronto-leah-stokes-carbon-wave-2026-09-24", title="Leah Stokes on The Carbon Wave: A Story of Democracy, Parenthood, and the Race to Protect Our Planet",
    day="2026-09-24", clock="16:30", end_day="2026-09-24", end_clock="18:00",
    source_url="https://www.environment.utoronto.ca/events/the-carbon-wave", source_id="utoronto-environment-events",
    organizer="University of Toronto School of the Environment",
    summary="Public climate-policy lecture by Leah Stokes on democracy, parenthood, and climate action.",
    formats=["public-lecture", "climate-policy-talk"], type="lecture", venue="Seeley Hall",
    registration_required=True, claims=[claim("Leah C. Stokes", "speaker", evidence="Official event page names the speaker and time.")],
)

# Ecology & Evolutionary Biology exit seminars.
exit_specs = [
    ("utoronto-eeb-ilia-ferzoco-exit-seminar-2026-08-14", "Freshwater Biodiversity in Urban Stormwater Ponds: Ilia Ferzoco Exit Seminar", "2026-08-14", "10:00", "Ilia Ferzoco", "https://eeb.utoronto.ca/event/freshwater-biodiversity-in-urban-stormwater-ponds-community-assembly-dispersal-and-environmental-filtering-of-aquatic-insects-in-these-novel-ecosystems-ilia-ferzoco-exit-seminar/", "UTM, IB 280"),
    ("utoronto-eeb-puneeth-deraje-exit-seminar-2026-08-25", "Theoretically Speaking: Puneeth Deraje Exit Seminar", "2026-08-25", "12:00", "Puneeth Deraje", "https://eeb.utoronto.ca/event/theoretically-speaking-mathematical-and-statistical-models-for-evolutionary-rescue-and-spatial-inference-using-ancestral-recombination-graphs-puneeth-deraje-exit-seminar/", "University of Toronto / organizer-defined"),
    ("utoronto-eeb-ellen-nikelski-exit-seminar-2026-09-08", "Mitonuclear Coevolution and Avian Speciation: Ellen Nikelski Exit Seminar", "2026-09-08", "13:10", "Ellen Nikelski", "https://eeb.utoronto.ca/event/exploring-the-role-of-mitonuclear-coevolution-as-a-driver-of-avian-speciation-ellen-nikelski-exit-seminar/", "University of Toronto / organizer-defined"),
    ("utoronto-eeb-eniolaye-balogun-exit-seminar-2026-09-22", "Mutation and Trait Variation in Chlamydomonas: Eniolaye Balogun Exit Seminar", "2026-09-22", "09:00", "Eniolaye Balogun", "https://eeb.utoronto.ca/event/understanding-how-mutation-shapes-trait-variation-in-chlamydomonas-reinhardtii-eniolaye-balogun-exit-seminar/", "University of Toronto / organizer-defined"),
]
for event_id, title, day, clock, person, url, venue in exit_specs:
    add_event(
        id=event_id, title=title, day=day, clock=clock, source_url=url,
        source_id="utoronto-eeb-events", organizer="University of Toronto Ecology & Evolutionary Biology",
        summary=f"Graduate exit seminar presenting {person}’s research.", formats=["exit-seminar", "graduate-research-talk"],
        type="seminar", venue=venue, public_access_status="academic-public",
        audience_scope="students, researchers, faculty, and interested attendees", registration_required=False,
        claims=[claim(person, "graduate research presenter", evidence="Official EEB event page names the presenter.")],
        education_levels=["graduate", "professional", "open"],
        time_precision="exact" if event_id.endswith("08-14") else "unknown",
        source_notes=None if event_id.endswith("08-14") else "Official U of T event index confirms the date and presenter; exact time remains pending on the accessible event surface, so 10:00 is a display anchor and time_precision is unknown.",
    )

# Existing U of T graduate conference and Toronto–Cologne colloquium, now with stable IDs.
add_event(
    id="university-of-toronto-philosophy-graduate-conferen-2026-10-16", title="University of Toronto Philosophy Graduate Conference 2026",
    day="2026-10-16", clock="09:00", end_day="2026-10-17", end_clock="18:00",
    source_url="https://philevents.org/event/show/148365", source_id="manual-curated",
    organizer="University of Toronto Department of Philosophy",
    summary="Graduate philosophy conference featuring historical and contemporary work and keynote speakers Don Garrett and Alva Noë.",
    formats=["graduate-conference"], type="conference", venue="Jackman Humanities Building",
    public_access_status="academic-public", audience_scope="graduate students, scholars, and interested attendees",
    registration_required=False, claims=[
        claim("Don Garrett", "keynote speaker", evidence="Conference listing names the keynote speaker."),
        claim("Alva Noë", "keynote speaker", evidence="Conference listing names the keynote speaker."),
    ],
)
add_event(
    id="toronto-cologne-graduate-colloquium-2026", title="Toronto-Cologne Graduate Student Colloquium 2026",
    day="2026-10-29", clock="09:00", end_day="2026-10-31", end_clock="17:00",
    source_url="https://www.medieval.utoronto.ca/news/2026-toronto-cologne-graduate-student-colloquium",
    source_id="manual-curated", organizer="University of Toronto Centre for Medieval Studies",
    summary="Graduate colloquium with six papers from each institution and cross-institutional faculty commentary.",
    formats=["graduate-colloquium"], type="colloquium", venue="Centre for Medieval Studies, University of Toronto",
    public_access_status="academic-public", audience_scope="graduate students, faculty, and interested academic attendees",
    registration_required=False, participant_identity_status="partly-named", claims=[],
)

# Queen's, McGill, and McMaster corridor events.
add_event(
    id="f0c0fc6d67a3", title="Health Policy Symposium and Sinclair Lecture: Aging in Communities",
    day="2026-09-25", clock="09:00", end_day="2026-09-25", end_clock="12:00",
    source_url="https://www.queensu.ca/eventscalendar/calendar/events/health-policy-symposium-and-sinclair-lecture-aging-communities",
    source_id="queens-events", organizer="Queen's University",
    summary="Free health-policy symposium with expert mini-talks, panel discussion, and Sinclair Lecture on aging in communities.",
    formats=["symposium", "panel", "public-lecture"], type="conference", venue="University Club, Teves Room",
    city="Kingston", registration_required=True, claims=[claim("Paul McGarry", "Sinclair Lecturer", evidence="Official Queen's event page names the lecturer.")],
)
add_event(
    id="285112aa8a67", title="Hughlings Jackson Lecture 2026: Behaviour, Brain Computation, and Evolution",
    day="2026-10-15", clock="16:00", end_day="2026-10-15", end_clock="17:00",
    source_url="https://www.mcgill.ca/science/channels_item/33", source_id="mcgill-science",
    organizer="McGill University Faculty of Science",
    summary="Annual Hughlings Jackson public academic lecture on behaviour, brain computation, and evolution.",
    formats=["public-lecture", "distinguished-lecture"], type="lecture", venue="McGill University",
    city="Montréal", province="Québec", registration_required=True, participant_identity_status="partly-named", claims=[],
)
add_event(
    id="mcmaster-terri-lynne-defino-author-talk-2026-09-24", title="Author Talk with Terri-Lynne DeFino",
    day="2026-09-24", clock="18:00", end_day="2026-09-24", end_clock="19:00",
    source_url="https://library.mcmaster.ca/events/author-talk-terri-lynne-defino", source_id="mcmaster-library-events",
    organizer="McMaster University Library",
    summary="Online author talk with Terri-Lynne DeFino.", formats=["author-talk", "online-talk"], type="book-talk",
    venue="Online", city="Online", province="", country="Canada", event_format="online",
    public_access_status="online-public", audience_scope="public online audience", registration_required=True,
    claims=[claim("Terri-Lynne DeFino", "author and speaker", category="author-writer", mode="online", evidence="Official McMaster listing names the author and time.")],
)

# Indigenous learning and public medical research events replace an unverified CIGI lead.
add_event(
    id="utoronto-speaking-our-truths-reconciliation-2026-08-19", title="Speaking Our Truths: The Journey Towards Reconciliation Part 2",
    day="2026-08-19", clock="10:00", end_day="2026-08-19", end_clock="13:00",
    source_url="https://temertymedicine.utoronto.ca/event/speaking-our-truths-journey-towards-reconciliation-part-2",
    source_id="utoronto-temerty-events", organizer="University of Toronto Office of Indigenous Initiatives",
    summary="Workshop on settler colonialism, systemic inequality, Indigenous resilience, identity reclamation, rights, and futures.",
    formats=["workshop", "seminar"], type="workshop", venue="University of Toronto / registration-defined",
    public_access_status="registered-academic", audience_scope="University community and registered participants",
    registration_required=True, participant_identity_status="named-organizer", claims=[claim("John Croutch", "Indigenous Training Coordinator and contact", category="community-witness-elder", evidence="Official event page identifies the programme contact and organizer role.")],
)
add_event(
    id="utoronto-indigenous-land-acknowledgments-workshop-2026-08-26", title="Reflecting on Indigenous Land Acknowledgments",
    day="2026-08-26", clock="10:00", end_day="2026-08-26", end_clock="13:00",
    source_url="https://temertymedicine.utoronto.ca/event/reflecting-indigenous-land-acknowledgments",
    source_id="utoronto-temerty-events", organizer="University of Toronto Office of Indigenous Initiatives",
    summary="Workshop on the purpose, impact, responsibilities, and action-oriented practice of land acknowledgements.",
    formats=["workshop", "seminar"], type="workshop", venue="University of Toronto / registration-defined",
    public_access_status="registered-academic", audience_scope="University community and registered participants",
    registration_required=True, participant_identity_status="named-organizer", claims=[claim("John Croutch", "Indigenous Training Coordinator and contact", category="community-witness-elder", evidence="Official event page identifies the programme contact and organizer role.")],
)
add_event(
    id="utoronto-parkinsons-dementia-webinar-2026-08-27", title="Advances in Dementia Webinar: Understanding Parkinson’s Disease",
    day="2026-08-27", clock="12:00", end_day="2026-08-27", end_clock="13:00",
    source_url="https://temertymedicine.utoronto.ca/event/advances-dementia-webinar-understanding-parkinsons-disease-recognizing-symptoms-understanding",
    source_id="utoronto-temerty-events", organizer="University of Toronto Temerty Faculty of Medicine",
    summary="Public webinar on Parkinson’s disease, dementia, treatments, assistive technology, and current research.",
    formats=["public-webinar", "research-translation"], type="webinar", venue="Online",
    city="Online", province="", country="Canada", event_format="online", public_access_status="online-public",
    audience_scope="public, patients, care partners, clinicians, and researchers", registration_required=True,
    claims=[
        claim("Priti Gros", "neurologist and presenter", mode="online", evidence="Official event page names the presenter."),
        claim("Nadia Mirjan", "PhD candidate and presenter", mode="online", evidence="Official event page names the presenter."),
    ],
)


# ---------------------------------------------------------------------------
# McGill Community for Lifelong Learning lecture series.
# ---------------------------------------------------------------------------
mcll_url = "https://www.mcgill.ca/mcll/lectures/lectures-and-workshops-schedule"
mcll_parent = "mcgill-mcll-fall-2026-lectures"
add_event(
    id=mcll_parent, title="McGill Community for Lifelong Learning Fall 2026 Lectures",
    day="2026-09-11", clock="10:00", end_day="2026-10-23", end_clock="15:00",
    source_url=mcll_url, source_id="mcgill-mcll", organizer="McGill Community for Lifelong Learning",
    summary="Fall public and member-oriented lecture schedule for lifelong learners; selected substantive lectures are stored as dated children.",
    formats=["lifelong-learning-lecture-series"], type="lecture", venue="McGill University and online",
    city="Montréal", province="Québec", event_format="hybrid", public_access_status="registration-or-membership",
    audience_scope="adult lifelong learners and registered guests", registration_required=True,
    participant_identity_status="named", claims=[], series_title="MCLL Fall 2026 Lectures", series_role="parent", calendar_stage="series run",
)
mcll_specs = [
    ("mcll-irish-invaded-canada-2026-09-11", "When the Irish Invaded Canada", "2026-09-11", "10:00", "online", "Christopher Klein"),
    ("mcll-x-troop-forgotten-heroes-2026-09-18", "X Troop: The Forgotten Heroes of the Second World War", "2026-09-18", "10:00", "online", "Michael Allen"),
    ("mcll-great-omar-2026-09-25", "The Great Omar", "2026-09-25", "10:00", "in-person", "Angella Lambrou"),
    ("mcll-medieval-industrial-revolution-2026-09-25", "The Medieval Industrial Revolution", "2026-09-25", "10:00", "in-person", "Harald von Cramon"),
    ("mcll-rituals-grief-loss-2026-10-09", "The Necessity for Rituals in Grief and Loss", "2026-10-09", "10:00", "in-person", "Georgia Remond"),
    ("mcll-myth-human-supremacy-2026-10-09", "The Myth of Human Supremacy", "2026-10-09", "13:00", "online", "Nandita Bajaj"),
    ("mcll-sefton-delmer-secret-war-2026-10-16", "Sefton Delmer’s Secret War", "2026-10-16", "10:00", "online", "Harry Belsey"),
    ("mcll-overturning-history-bc-2026-10-16", "Overturning History in British Columbia", "2026-10-16", "13:00", "online", "Robin Fisher"),
    ("mcll-rise-fall-aztecs-2026-10-23", "The Rise and Fall of the Aztecs", "2026-10-23", "13:00", "in-person", "Peter Berry"),
]
for event_id, title, day, clock, mode, person in mcll_specs:
    add_event(
        id=event_id, title=title, day=day, clock=clock, source_url=mcll_url,
        source_id="mcgill-mcll", organizer="McGill Community for Lifelong Learning",
        summary=f"MCLL lifelong-learning lecture by {person}.", formats=["lifelong-learning-lecture"], type="lecture",
        venue="Online" if mode == "online" else "McGill University / schedule-defined room",
        city="Online" if mode == "online" else "Montréal", province="" if mode == "online" else "Québec",
        country="Canada", event_format=mode, public_access_status="registration-or-membership",
        audience_scope="adult lifelong learners and registered guests", registration_required=True,
        claims=[claim(person, "lecturer", mode=mode, evidence="Official MCLL schedule names the lecturer and occurrence.")],
        parent_id=mcll_parent, series_title="MCLL Fall 2026 Lectures", series_role="child", calendar_stage="lecture occurrence",
    )


# ---------------------------------------------------------------------------
# Guelph Jazz Festival Colloquium: parent plus every substantive programme item.
# ---------------------------------------------------------------------------
guelph_url = "https://improvisationinstitute.ca/workshops-conferences/guelph-jazz-festival-colloquium/"
guelph_parent = "guelph-jazz-festival-colloquium-2026-artists-on-of-2026-09-10"
add_event(
    id=guelph_parent, title="Guelph Jazz Festival Colloquium 2026: Artists On/Off the Record",
    day="2026-09-10", clock="13:00", end_day="2026-09-11", end_clock="16:00",
    source_url=guelph_url, source_id="iicsi-guelph-colloquium", organizer="International Institute for Critical Studies in Improvisation",
    summary="Free, public two-day colloquium on living archives, embodied memory, music, media, and improvisation; all substantive sessions are stored as children.",
    formats=["colloquium"], type="colloquium", venue="IICSI House",
    city="Guelph", public_access_status="free-public", audience_scope="public, artists, students, and scholars",
    registration_required=False, participant_identity_status="named", claims=[],
    series_title="Guelph Jazz Festival Colloquium 2026", series_role="parent", calendar_stage="colloquium run",
)
guelph_specs = [
    ("guelph-colloquium-on-exhibit-xroads-2026-09-10", "On Exhibit XRoads", "2026-09-10", "13:10", "presentation", "LuFuki"),
    ("guelph-colloquium-improvising-archive-jesse-stewart-2026-09-10", "Improvising Archive", "2026-09-10", "13:45", "scholar-talk", "Jesse Stewart"),
    ("guelph-colloquium-radio-active-community-2026-09-10", "A Radio Active Community", "2026-09-10", "14:35", "presentation", "David Dacks and Sydney Dacks"),
    ("guelph-colloquium-archiving-the-scene-panel-2026-09-10", "Archiving the Scene", "2026-09-10", "15:20", "panel", "Keisha Bell, Brandon Hocura, Brian Edward Jones, and Miles B. Jordan"),
    ("guelph-colloquium-statesman-of-piano-2026-09-10", "Statesman of Piano", "2026-09-10", "16:40", "conversation", "Sean Mills, Eric Fillion, and Désirée Rochat"),
    ("guelph-colloquium-big-ideas-2026-09-10", "Big Ideas", "2026-09-10", "19:15", "conversation", "Ahmed Abdullah and Monique Ngozi Nri"),
    ("guelph-colloquium-sun-ra-film-2026-09-10", "Sun Ra: Do the Impossible", "2026-09-10", "21:30", "screening", "Programme participants"),
    ("guelph-colloquium-lara-hill-workshop-2026-09-11", "Parallel Workshop: Lara Hill", "2026-09-11", "09:00", "workshop", "Lara Hill"),
    ("guelph-colloquium-mike-hansen-workshop-2026-09-11", "Parallel Workshop: Mike Hansen", "2026-09-11", "09:00", "workshop", "Mike Hansen"),
    ("guelph-colloquium-secret-lives-colour-2026-09-11", "The Secret Lives of Colour", "2026-09-11", "09:55", "conversation", "Myra Melford, François Houle, Joëlle Léandre, Gerry Hemingway, and Gordon Grdina"),
    ("guelph-colloquium-archive-archiving-improvisatory-2026-09-11", "Improvising Archive / Archiving Improvisatory", "2026-09-11", "11:10", "scholar-talk", "Eric Lewis"),
    ("guelph-colloquium-artist-communities-2026-09-11", "Artist Communities", "2026-09-11", "13:00", "panel", "Michael Palumbo, Curtis Sassur, and Simon Rogers"),
    ("guelph-colloquium-resonant-bodies-2026-09-11", "Resonant Bodies", "2026-09-11", "13:50", "panel", "Megan Harton, kat estacio, Monika Herzig, and Kathryn Ladano"),
    ("guelph-colloquium-we-are-archives-2026-09-11", "We Are Archives", "2026-09-11", "15:15", "conversation", "Georgia Simms and Heather Cornell"),
]
for event_id, title, day, clock, fmt, people in guelph_specs:
    add_event(
        id=event_id, title=title, day=day, clock=clock, source_url=guelph_url,
        source_id="iicsi-guelph-colloquium", organizer="International Institute for Critical Studies in Improvisation",
        summary=f"Programme occurrence in the Guelph Jazz Festival Colloquium: {title}.",
        formats=[fmt, "colloquium-session"], type="screening" if fmt == "screening" else ("workshop" if fmt == "workshop" else ("panel" if fmt in {"panel", "conversation"} else "scholar-talk")),
        venue="IICSI House", city="Guelph", public_access_status="free-public",
        audience_scope="public, artists, students, and scholars", registration_required=False,
        participant_identity_status="partly-named" if fmt == "screening" else "named",
        claims=[claim(people, "featured participant(s)", category="artist-curator" if fmt in {"conversation", "screening"} else "scholar-expert", status="partly-announced" if fmt == "screening" else "confirmed", evidence="Official colloquium programme identifies the occurrence and participants.")],
        parent_id=guelph_parent, series_title="Guelph Jazz Festival Colloquium 2026", series_role="child", calendar_stage="programme occurrence",
    )



# ---------------------------------------------------------------------------
# Concordia University public thesis-defence series. The official calendar
# explicitly identifies these oral examinations as free and open to the public.
# The series parent and every occurrence remain separate.
# ---------------------------------------------------------------------------
concordia_parent = "concordia-public-thesis-defences-2026-08-14-to-09-25"
concordia_index = "https://www.concordia.ca/events.html?category=examinations%2Fthesis-defenses"
add_event(
    id=concordia_parent,
    title="Concordia University Public Thesis Defences — August–September 2026",
    day="2026-08-14", clock="09:00", end_day="2026-09-25", end_clock="16:00",
    source_url=concordia_index, source_id="concordia-thesis-defences",
    organizer="Concordia University School of Graduate Studies",
    summary="Official series of free public doctoral and master's oral examinations, represented below as separate occurrence-level records with the candidate, discipline, thesis title, access mode, venue, and source page retained.",
    formats=["thesis-defence-series", "public-oral-examination"], type="thesis-defence",
    venue="Concordia University and online", city="Montréal", province="Québec",
    event_format="hybrid", interaction_format="thesis-defence series parent",
    public_access_status="free-public", audience_scope="public, graduate students, faculty, and researchers",
    registration_required=False, participant_identity_status="named",
    claims=[], series_title="Concordia University Public Thesis Defences — August–September 2026",
    series_role="parent", calendar_stage="series run",
    education_levels=["open", "graduate", "professional"],
    academic_disciplines=["multidisciplinary graduate research"],
    tags=["public-defence", "graduate-research", "montréal"],
    extra={"cost_details":"Free", "public_event":True},
)

concordia_specs = [
    ("concordia-phd-jose-luis-cortes-santander-2026-08-14", "Jose Luis Cortes Santander", "doctoral candidate", "Art Education", "(In)disciplinarity: Art as Education", "2026-08-14", "09:00", "12:00", "EV 5.825", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/14/phd-oral-exam-jose-luis-cortes-santander-art-education.html"),
    ("concordia-phd-alex-chartrand-2026-08-14", "Alex Chartrand", "doctoral candidate", "Communication Studies", "Trajectories of Digital Resistance from Montreal to Berlin: The Role of Queer Algorithmic Imaginaries in Challenging Discriminatory Conditions on Social Media", "2026-08-14", "09:30", "12:30", "LB 322", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/14/phd-oral-exam-alex-chartrand-communication-studies.html"),
    ("concordia-phd-negarsadat-rahimi-2026-08-14", "Negarsadat Rahimi", "doctoral candidate", "Individualized Program in Fine Arts", "A Framework for Façade Retrofitting Decision-Making to Decarbonize Buildings", "2026-08-14", "10:00", "13:00", "LB 205", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/14/phd-oral-exam-negarsadat-rahimi-individualized-program-in-fine-arts.html"),
    ("concordia-phd-rosanne-villemaire-krajden-2026-08-17", "Rosanne Villemaire-Krajden", "doctoral candidate", "Psychology", "Extracurricular Activity Participation and Psychosocial Development in Emerging Adulthood: A Mixed-Methods Study of Wellbeing and Career Adaptability", "2026-08-17", "11:00", "14:00", "Loyola PY 244", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/17/phd-oral-exam-rosanne-villemaire-krajden-psychology.html"),
    ("concordia-phd-xingnan-zhou-2026-08-18", "Xingnan Zhou", "doctoral candidate", "Civil Engineering", "Multi-Scale Deep Learning Frameworks for Trajectory Prediction, Scene Understanding, and Perception in Autonomous Driving", "2026-08-18", "10:00", "13:00", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/18/phd-oral-exam-xingnan-zhou-civil-engineering.html"),
    ("concordia-phd-antonio-cavalcante-pereira-2026-08-19", "Antônio Cavalcante Pereira", "doctoral candidate", "Civil Engineering", "Phosphorus Attenuation from Lake Water and Sediment Using Geotextile Filtration and Air-Induced Sediment Resuspension", "2026-08-19", "10:30", "13:30", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/19/phd-oral-exam-antonio-cavalcante-pereira-civil-engineering.html"),
    ("concordia-phd-mahmoud-abdelrahman-2026-08-19", "Mahmoud Abdelrahman", "doctoral candidate", "Civil Engineering", "Investigation of the compressive and in-plane shear behaviour of dry-stacked interlocking masonry compared to conventional masonry", "2026-08-19", "13:00", "16:00", "EV 001.162", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/19/phd-oral-exam-mahmoud-abdelrahman-civil-engineering.html"),
    ("concordia-phd-masoud-valinejadshoubi-2026-08-19", "Masoud Valinejadshoubi", "doctoral candidate", "Building Engineering", "Design and Adaptive Operation of a Switchable Multi-Inlet Photovoltaic/Thermal System with Applications to Façades and Infrastructure", "2026-08-19", "13:00", "16:00", "Online via Concordia University", "online", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/19/phd-oral-exam-masoud-valinejadshoubi-building-engineering.html"),
    ("concordia-phd-ariel-patricia-boyle-2026-08-20", "Ariel Patricia Boyle", "doctoral candidate", "Psychology", "Investigating the influence of intolerance of uncertainty and fear of depression recurrence on the development of depressive symptoms: Longitudinal studies of healthy and remitted depressed individuals", "2026-08-20", "09:00", "12:00", "Loyola PY 244", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/20/phd-oral-exam-ariel-patricia-boyle-psychology.html"),
    ("concordia-phd-ishfaq-bashir-sofi-2026-08-20", "Ishfaq Bashir Sofi", "doctoral candidate", "Electrical and Computer Engineering", "Generative Artificial Intelligence for Secure and Efficient Intrusion Detection in Imbalanced Multi-Attack Cyber Environments", "2026-08-20", "10:00", "13:00", "EV 2.184", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/20/phd-oral-exam-ishfaq-bashir-sofi-electrical-and-computer-engineering.html"),
    ("concordia-phd-amin-saber-2026-08-20", "Amin Saber", "doctoral candidate", "Mechanical Engineering", "A Robust Physics-based Thermo-Magneto-Viscoelastic Constitutive Model for Magnetorheological Elastomers with Experimental Validation", "2026-08-20", "10:00", "13:00", "EV 1.162", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/20/phd-oral-exam-amin-saber-mechanical-engineering.html"),
    ("concordia-phd-mahdieh-adib-2026-08-20", "Mahdieh Adib", "doctoral candidate", "Building Engineering", "Neural Surrogate-Based Model Predictive Control for Compressed Air Energy Storage", "2026-08-20", "10:00", "13:00", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/20/phd-oral-exam-mahdieh-adib-building-engineering.html"),
    ("concordia-phd-salma-elhankouri-2026-08-20", "Salma Elhankouri", "doctoral candidate", "Humanities", "Where Roots Flow: Portals of Trans-Indigenous Relational Practices in Montreal Contemporary Art and Research", "2026-08-20", "13:30", "16:30", "Hall 1226", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/20/phd-oral-exam-salma-elhankouri-humanities.html"),
    ("concordia-phd-saeed-fathollahzadeh-2026-08-21", "Saeed Fathollahzadeh", "doctoral candidate", "Computer Science", "LLM-assisted Data Systems for Efficient ML Pipeline Generation and Query Optimization", "2026-08-21", "09:00", "12:00", "Online via Concordia University", "online", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/21/phd-oral-exam-saeed-fathollahzadeh-computer-science.html"),
    ("concordia-phd-sean-francis-connolly-boutin-2026-08-21", "Sean Francis Connolly-Boutin", "doctoral candidate", "Mechanical Engineering", "Marrying Canonical Detonation Experiments and Fundamentals with Rotating Detonation Engine Research and Development", "2026-08-21", "10:00", "13:00", "EV 3.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/21/phd-oral-exam-sean-francis-connolly-boutin-mechanical-engineering.html"),
    ("concordia-phd-shima-jalili-2026-08-21", "Shima Jalili", "doctoral candidate", "Mathematics", "Dynamic Hedging under Market Incompleteness: Time-Consistent Risk Control, Jump Risk, and Deep Hedging Applications to Cryptocurrency Markets", "2026-08-21", "10:00", "13:00", "LB 921-4", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/21/phd-oral-exam-shima-jalili-mathematics.html"),
    ("concordia-phd-alina-gutierrez-mejia-2026-08-21", "Alina Gutiérrez Mejía", "doctoral candidate", "Individualized Program", "Visual Tools as Inclusive Facilitation Practices in Diverse Organizational Teams: A Qualitative Case Study of Facilitation Conditions, Barriers, and Post-Session Sensemaking in a DEI Organizational Context", "2026-08-21", "12:00", "15:00", "LB 362", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/21/phd-oral-exam-alina-gutierrez-mejia-individualized-program.html"),
    ("concordia-phd-hussein-atia-2026-08-21", "Hussein Atia", "doctoral candidate", "Civil Engineering", "Finite Element Formulations for the Analysis of Thin-walled Members and Composite Sections Considering the Distortional Deformations of the Cross-section", "2026-08-21", "14:00", "17:00", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/21/phd-oral-exam-hussein-atia-civil-engineering.html"),
    ("concordia-phd-wissam-abdallah-2026-08-24", "Wissam Abdallah", "doctoral candidate", "Mechanical Engineering", "In Vivo Investigation of Left Ventricular Flow Dynamics and Energetic Dissipation in Aortic regurgitation Using 4D-flow Magnetic Resonance Imaging", "2026-08-24", "09:30", "12:30", "EV 1.162", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/24/phd-oral-exam-wissam-abdallah-mechanical-engineering.html"),
    ("concordia-phd-edward-griffiths-2026-08-24", "Edward Griffiths", "doctoral candidate", "Education", "Speaking skills in Canadian core French programs: Materials, teaching practices, and systemic constraints", "2026-08-24", "10:00", "13:00", "Faubourg 5.335", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/24/phd-oral-exam-edward-griffiths-education.html"),
    ("concordia-phd-kristina-coulter-2026-08-24", "Kristina Coulter", "doctoral candidate", "Psychology", "The Contribution of Bilingualism to Brain and Cognitive Reserve: From Healthy Aging to Alzheimer's Disease", "2026-08-24", "10:00", "13:00", "Online via Concordia University", "online", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/24/phd-oral-exam-kristina-coulter-psychology.html"),
    ("concordia-phd-egor-shmonin-2026-08-24", "Egor Shmonin", "doctoral candidate", "Film and Moving Image Studies", "Baltic Postpoetic Documentary: The Aesthetic of Disappearance", "2026-08-24", "10:00", "13:00", "EV 2.776", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/24/phd-oral-exam-egor-shmonin-film-and-moving-image-studies.html"),
    ("concordia-phd-majid-maleki-2026-08-24", "Majid Maleki", "doctoral candidate", "Business Administration", "Essays on Risk Premia and Trading in Derivatives Markets", "2026-08-24", "13:00", "16:00", "John Molson 012-101", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/24/phd-oral-exam-majid-maleki-business-administration.html"),
    ("concordia-phd-ali-asghar-sedighi-2026-08-25", "Ali Asghar Sedighi", "doctoral candidate", "Civil Engineering", "Advancing Airborne Infection Risk Assessment in Indoor Environments: A CFD-Based Framework Integrating Exposure Modeling, Quanta Distribution, and Ventilation Control", "2026-08-25", "09:30", "12:30", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/25/phd-oral-exam-ali-asghar-sedighi-civil-engineering.html"),
    ("concordia-phd-maryam-jabbari-khasraghi-2026-08-25", "Maryam Jabbari Khasraghi", "doctoral candidate", "Mathematics and Statistics", "Testing for Cure-Rate and Sufficient Follow-Up under Random Censoring using Extreme-Value Theory", "2026-08-25", "09:30", "12:30", "LB 921-4", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/25/phd-oral-exam-maryam-jabbari-khasraghi-mathematics-and-statistics.html"),
    ("concordia-phd-narjes-tahaei-2026-08-25", "Narjes Tahaei", "doctoral candidate", "Computer Science", "Annotation-Aware Language Models as Representations of Disagreement and Perspective", "2026-08-25", "10:00", "13:00", "ER 1222", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/25/phd-oral-exam-narjes-tahaei-computer-science.html"),
    ("concordia-phd-joseph-trani-2026-08-25", "Joseph Trani", "doctoral candidate", "Biology", "Using Saccharomyces cerevisiae Extracellular Vesicles To Better Understand Conserved Mechanisms of Biogenesis And To Deliver Small-Molecule Drugs", "2026-08-25", "12:00", "15:00", "Loyola SP 457.03", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/25/phd-oral-exam-joseph-trani-biology.html"),
    ("concordia-phd-soroush-shahsafi-2026-08-25", "Soroush Shahsafi", "doctoral candidate", "Information and Systems Engineering", "Hybrid Deep Learning Frameworks for Financial Forecasting, Trading Decisions and Portfolio Allocation", "2026-08-25", "13:00", "16:00", "Online via Concordia University", "online", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/25/phd-oral-exam-soroush-shahsafi-information-and-systems-engineering.html"),
    ("concordia-phd-diane-roberts-2026-08-25", "Diane Roberts", "doctoral candidate", "Humanities — Fine Arts", "Sacred wandering: seeding new legacies of knowing, being and doing", "2026-08-25", "13:30", "16:30", "LB 1042-03", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/25/phd-oral-exam-diane-roberts-humanities-fine-arts.html"),
    ("concordia-phd-criscent-birungi-2026-08-26", "Criscent Birungi", "doctoral candidate", "Mathematics and Statistics", "Essays on Stochastic Control and Reinforcement Learning for Lifecycle Retirement and Annuitization", "2026-08-26", "09:00", "12:00", "LB 921-4", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/26/phd-oral-exam-criscent-birungi-mathematics-and-statistics.html"),
    ("concordia-phd-juliet-mackie-2026-08-26", "Juliet Mackie", "doctoral candidate", "Individualized Program", "Reconstituting Indigenous Identities through Portraiture and Storytelling: Reclaiming Representation for Indigenous Women and Two-Spirit People", "2026-08-26", "10:00", "13:00", "EV 11.705", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/26/phd-oral-exam-juliet-mackie-individualized-program.html"),
    ("concordia-phd-mohammadreza-amini-2026-08-26", "Mohammadreza Amini", "doctoral candidate", "Computer Science", "Modeling Steering Performance in 3D Virtual Environments", "2026-08-26", "13:00", "16:00", "ER 1072", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/26/phd-oral-exam-mohammadreza-amini-computer-science.html"),
    ("concordia-phd-jedidat-matoush-2026-08-26", "Jedidat Matoush", "doctoral candidate", "Political Science", "Culture and Self-Government in Eeyou Istchee", "2026-08-26", "13:30", "16:30", "Hall 1225.12", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/26/phd-oral-exam-jedidat-matoush-political-science.html"),
    ("concordia-phd-tianhao-xie-2026-08-27", "Tianhao Xie", "doctoral candidate", "Computer Science", "Graphics Meets ML: Revisiting Graphics Methods for Machine Learning-based 3D Synthesis and Editing", "2026-08-27", "10:00", "13:00", "Online via Concordia University", "online", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/27/phd-oral-exam-tianhao-xie-computer-science.html"),
    ("concordia-phd-alexis-hotte-kilburn-2026-08-27", "Alexis Hotte-Kilburn", "doctoral candidate", "Physics", "Design of Integrated Photonic Realizations of Tight-Binding Hamiltonians", "2026-08-27", "14:00", "17:00", "Loyola SP 367.07", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/27/phd-oral-exam-alexis-hotte-kilburn-physics.html"),
    ("concordia-phd-milad-ezzati-2026-08-27", "Milad Ezzati", "doctoral candidate", "Chemistry", "The role of iron minerals in preserving organic carbon and phosphate in marine sediments", "2026-08-27", "14:00", "17:00", "Loyola SP 265.29", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/27/phd-oral-exam-milad-ezzati-chemistry.html"),
    ("concordia-phd-maurice-jones-2026-08-28", "Maurice Jones", "doctoral candidate", "Humanities", "Temporally Autonomous Spaces: A Black Quantum Rhythmanalysis of Festivals at the Intersection of Art, Music, and Technology", "2026-08-28", "09:00", "12:00", "EV 11.705", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/28/phd-oral-exam-maurice-jones-humanities.html"),
    ("concordia-phd-soorena-salari-2026-08-28", "Soorena Salari", "doctoral candidate", "Computer Science", "Automatic Quantification of Medical Image Registration Quality Using Deep Learning", "2026-08-28", "13:00", "16:00", "Location pending", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/28/phd-oral-exam-soorena-salari-computer-science.html"),
    ("concordia-ma-zachary-yuzda-2026-08-28", "Zachary Yuzda", "master's candidate", "Philosophy", "A Phenomenological Response to Normate Ideas of Sport: How Embodied Imagining is Extended and Modified by Habits and the World", "2026-08-28", "13:30", "15:30", "Online via Concordia University", "online", "https://www.concordia.ca/cuevents/artsci/philosophy/2026/08/28/ma-defence-zachary-yuzda-philosophy.html"),
    ("concordia-phd-juanwei-chen-2026-08-31", "Juanwei Chen", "doctoral candidate", "Information and Systems Engineering", "Cybersecurity of Virtual Power Plants in the Smart Grid", "2026-08-31", "10:00", "13:00", "EV 2.301", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/31/phd-oral-exam-juanwei-chen-information-and-systems-engineering.html"),
    ("concordia-phd-shuyan-wan-2026-08-31", "Shuyan Wan", "doctoral candidate", "Civil Engineering", "Multiscale Assessment of Urban Green Infrastructure: Emergy-Based Planning, Green Roof Adoption, and City-Scale Environmental Performance", "2026-08-31", "10:00", "13:00", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/08/31/phd-oral-exam-shuyan-wan-civil-engineering.html"),
    ("concordia-phd-sneha-paul-2026-09-01", "Sneha Paul", "doctoral candidate", "Information and Systems Engineering", "Label-Efficient 3D Point Cloud Understanding: From Representation Learning to Foundation Model Adaptation", "2026-09-01", "13:00", "16:00", "EV 1.162", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/01/phd-oral-exam-sneha-paul-information-and-systems-engineering.html"),
    ("concordia-phd-bernardine-france-anougue-tonfack-2026-09-03", "Bernardine France Anougue Tonfack", "doctoral candidate", "Biology", "Habituation and ecology of western gorillas for conservation and ecotourism in the Campo-Ma’an National Park, Southern Cameroon", "2026-09-03", "09:00", "12:00", "Loyola SP 457.03", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/03/phd-oral-exam-bernardine-france-anougue-tonfack-biology.html"),
    ("concordia-phd-jasmine-latendresse-2026-09-03", "Jasmine Latendresse", "doctoral candidate", "Software Engineering", "Understanding and Supporting Software Dependency Management Across the Lifecycle", "2026-09-03", "10:00", "13:00", "ER 1222", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/03/phd-oral-exam-jasmine-latendresse-software-engineering.html"),
    ("concordia-phd-rewan-toubar-2026-09-10", "Rewan Toubar", "doctoral candidate", "Building Engineering", "Developing a Performance Metric, Criteria, and Process to Measure and Predict Speech Privacy in Office Buildings", "2026-09-10", "10:00", "13:00", "EV 003.309", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/10/phd-oral-exam-rewan-toubar-building-engineering.html"),
    ("concordia-phd-scott-dejong-2026-09-11", "Scott DeJong", "doctoral candidate", "Communication", "Playing with Misinformation and Media Literacy: Dual dimensions of information manipulation, educational responses, and designing games in the gap", "2026-09-11", "12:00", "15:00", "EV 11.705", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/11/phd-oral-exam-scott-dejong-communication.html"),
    ("concordia-phd-ranya-essmat-saad-2026-09-11", "Ranya Essmat Saad", "doctoral candidate", "Art Education", "Egyptian Zār: Trace, Transformation, and Representation of Gender-Based Violence", "2026-09-11", "13:00", "16:00", "EV 5.825", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/11/phd-oral-exam-ranya-essmat-saad-art-education.html"),
    ("concordia-phd-nima-moradi-2026-09-25", "Nima Moradi", "doctoral candidate", "Information and Systems Engineering", "Sustainable Last-mile Parcel Delivery using Integrated Electric Transport Solutions", "2026-09-25", "13:00", "16:00", "EV 1.162", "in-person", "https://www.concordia.ca/cuevents/offices/vprgs/sgs/2026/09/25/phd-oral-exam-nima-moradi-information-and-systems-engineering.html"),
]
assert len(concordia_specs) == 48
for event_id, person, degree_role, discipline, thesis, day, start, finish, venue, mode, url in concordia_specs:
    location_pending = venue == "Location pending"
    online = mode == "online"
    add_event(
        id=event_id,
        title=f"{person} — {discipline} {degree_role.replace(' candidate','').upper()} Defence",
        day=day, clock=start, end_day=day, end_clock=finish,
        source_url=url, source_id="concordia-thesis-defences",
        organizer="Concordia University School of Graduate Studies",
        summary=f"Free public oral examination by {person} in {discipline}: “{thesis}.”",
        formats=["thesis-defence", "public-oral-examination"], type="thesis-defence",
        venue=venue, city="Online" if online else "Montréal", province="Québec",
        event_format=mode, interaction_format="public thesis defence",
        public_access_status="free-public", audience_scope="public, graduate students, faculty, and researchers",
        registration_required=False, participant_identity_status="named",
        claims=[claim(person, degree_role, category="scholar-expert", status="confirmed", mode=mode, scope="event", evidence="The official Concordia occurrence page names the candidate, thesis, date, time, and access mode.")],
        parent_id=concordia_parent, series_title="Concordia University Public Thesis Defences — August–September 2026",
        series_role="child", calendar_stage="oral defence",
        education_levels=["open", "graduate", "professional"], academic_disciplines=[discipline],
        qualification_reasons=["location-unconfirmed"] if location_pending else None,
        tags=["public-defence", "graduate-research", "montréal"],
        extra={"thesis_title":thesis, "candidate":person, "degree_role":degree_role, "cost_details":"Free", "public_event":True},
    )


# ---------------------------------------------------------------------------
# Reading groups, philosophy cafés, and public discussion series. These are
# explicitly part of Set 9; they are not deferred to the later participatory-
# culture set merely because participants discuss rather than listen.
# ---------------------------------------------------------------------------
practical_url = "https://www.meetup.com/practical-philosophy-club-ontario/events/smkwwtyjclbjc/"
practical_parent = "practical-philosophy-club-biweekly-discussions-fall-2026"
add_event(
    id=practical_parent, title="Practical Philosophy Club — Biweekly Discussions, Fall 2026",
    day="2026-08-26", clock="19:30", end_day="2026-12-16", end_clock="21:30",
    source_url=practical_url, source_id="practical-philosophy-club-ontario",
    organizer="Practical Philosophy Club Ontario",
    summary="Biweekly public philosophy discussions at the Madison Avenue Pub; no specialist background is required and voluntary donations support the group.",
    formats=["philosophy-cafe-series", "discussion-group", "reading-group"], type="discussion-group",
    venue="Madison Avenue Pub, 14 Madison Avenue", event_format="in-person",
    interaction_format="facilitated public philosophy discussion series", public_access_status="public-rsvp",
    audience_scope="public; no prior philosophy expertise required", registration_required=True,
    participant_identity_status="named", claims=[claim("Jeffrey M.", "host and facilitator", category="host-moderator", evidence="The official Meetup occurrence names Jeffrey M. as host.")],
    series_title="Practical Philosophy Club — Biweekly Discussions, Fall 2026", series_role="parent", calendar_stage="series run",
    education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Philosophy"],
    tags=["philosophy-cafe", "discussion-group", "toronto"], extra={"cost_details":"Voluntary donation"},
)
for day in ["2026-08-26", "2026-09-09", "2026-09-23", "2026-10-07", "2026-10-21", "2026-11-04", "2026-11-18", "2026-12-02", "2026-12-16"]:
    add_event(
        id=f"practical-philosophy-club-discussion-{day}",
        title=f"Practical Philosophy Club Discussion — {day}", day=day, clock="19:30", end_day=day, end_clock="21:30",
        source_url=practical_url, source_id="practical-philosophy-club-ontario", organizer="Practical Philosophy Club Ontario",
        summary="A biweekly facilitated discussion in practical philosophy, open to people without prior specialist knowledge.",
        formats=["philosophy-cafe", "discussion-group"], type="discussion-group",
        venue="Madison Avenue Pub, 14 Madison Avenue", event_format="in-person",
        public_access_status="public-rsvp", audience_scope="public; no prior philosophy expertise required", registration_required=True,
        claims=[claim("Jeffrey M.", "host and facilitator", category="host-moderator", evidence="The official Meetup occurrence names Jeffrey M. as host.")],
        parent_id=practical_parent, series_title="Practical Philosophy Club — Biweekly Discussions, Fall 2026", series_role="child", calendar_stage="discussion occurrence",
        education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Philosophy"],
        tags=["philosophy-cafe", "discussion-group", "toronto"], extra={"cost_details":"Voluntary donation"},
    )

proust_url = "https://www.meetup.com/the-toronto-philosophy-meetup/events/315943564/"
proust_parent = "proust-readers-support-group-2026-27"
add_event(
    id=proust_parent, title="Proust Readers Support Group — 2026–27 Reading Series",
    day="2026-08-15", clock="19:00", end_day="2027-01-30", end_clock="21:00",
    source_url=proust_url, source_id="toronto-philosophy-meetup",
    organizer="The Toronto Philosophy Meetup",
    summary="Online close-reading series following Marcel Proust's In Search of Lost Time through scheduled page ranges.",
    formats=["reading-group-series", "literature-and-philosophy-discussion"], type="reading-group",
    venue="Online via The Toronto Philosophy Meetup", city="Online", event_format="online",
    public_access_status="public-rsvp", audience_scope="public readers and philosophy/literature participants", registration_required=True,
    participant_identity_status="not-applicable", claims=[], series_title="Proust Readers Support Group — 2026–27",
    series_role="parent", calendar_stage="series run", time_precision="estimated",
    source_notes="The source lists the complete reading schedule. The first occurrence displays 7:00 p.m.; later occurrence times are carried as estimated rather than silently treated as separately confirmed.",
    education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Literature", "Philosophy"],
    tags=["reading-group", "proust", "online"],
)
proust_specs = [
    ("2026-08-15", "The Guermantes Way, pp. 48–108"),
    ("2026-08-29", "The Guermantes Way, pp. 108–174"),
    ("2026-09-12", "The Guermantes Way, pp. 177–234"),
    ("2026-09-26", "The Guermantes Way, pp. 234–295"),
    ("2026-10-10", "The Guermantes Way, pp. 295–353"),
    ("2026-10-24", "The Guermantes Way, pp. 357–397"),
    ("2026-11-07", "The Guermantes Way: Cities of the Plain, pp. 5–65"),
    ("2026-11-21", "Cities of the Plain, pp. 65–133"),
    ("2026-12-05", "Cities of the Plain, pp. 133–190"),
    ("2026-12-19", "Cities of the Plain, pp. 193–260"),
    ("2027-01-02", "Cities of the Plain, pp. 261–328"),
    ("2027-01-16", "Cities of the Plain, pp. 328–398"),
    ("2027-01-30", "Cities of the Plain, pp. 398–466"),
]
for day, reading in proust_specs:
    add_event(
        id=f"proust-readers-support-group-{day}", title=f"Proust Readers Support Group — {reading}",
        day=day, clock="19:00", end_day=day, end_clock="21:00", source_url=proust_url,
        source_id="toronto-philosophy-meetup", organizer="The Toronto Philosophy Meetup",
        summary=f"Online group reading and discussion: {reading}.", formats=["reading-group", "literature-and-philosophy-discussion"], type="reading-group",
        venue="Online via The Toronto Philosophy Meetup", city="Online", event_format="online",
        public_access_status="public-rsvp", audience_scope="public readers and philosophy/literature participants", registration_required=True,
        participant_identity_status="not-applicable", claims=[], parent_id=proust_parent,
        series_title="Proust Readers Support Group — 2026–27", series_role="child", calendar_stage="reading-group occurrence",
        time_precision="exact" if day == "2026-08-15" else "estimated",
        source_notes="The source lists the reading date and page range. Only the first displayed occurrence separately confirms the 7:00 p.m. time; later times remain estimated.",
        education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Literature", "Philosophy"],
        tags=["reading-group", "proust", "online"], extra={"assigned_reading":reading},
    )

rip_url = "https://royalinstitutephilosophy.org/philosophy-events/"
rip_parent = "royal-institute-philosophy-phd-online-seminars-fall-2026"
add_event(
    id=rip_parent, title="Royal Institute of Philosophy PhD Online Seminar Series — Fall 2026",
    day="2026-09-09", clock="00:00", end_day="2026-11-10", end_clock="23:59",
    source_url=rip_url, source_id="royal-institute-philosophy-events", organizer="Royal Institute of Philosophy",
    summary="Member-only online seminar series featuring current doctoral research; official dates and speakers are preserved while unpublished times remain explicitly pending.",
    formats=["phd-online-seminar-series", "graduate-research-talk"], type="seminar",
    venue="Online via Royal Institute of Philosophy", city="Online", event_format="online",
    public_access_status="member-only", audience_scope="Royal Institute members and philosophy researchers", registration_required=True,
    institutional_restriction="Royal Institute of Philosophy membership required.", participant_identity_status="named",
    claims=[], series_title="Royal Institute of Philosophy PhD Online Seminar Series — Fall 2026", series_role="parent", calendar_stage="series run",
    time_precision="unknown", education_levels=["graduate", "professional"], academic_disciplines=["Philosophy"],
    tags=["phd-seminar", "member-only", "online"],
)
rip_specs = [
    ("2026-09-09", "Pain’s Normative Constraints", "Alon Isac", "named"),
    ("2026-10-07", "Is Fate Lovable?", "Heewon Seo", "named"),
    ("2026-10-26", "Negative Filmmaking", "Vincenzo Cerulli", "named"),
    ("2026-11-10", "Imaginative Excellence, Radical Hope, and Climate Change", "Miguel", "partly-named"),
]
for day, title, person, identity_status in rip_specs:
    add_event(
        id=f"royal-institute-philosophy-phd-seminar-{day}", title=f"{title} — {person}",
        day=day, clock="00:00", source_url=rip_url, source_id="royal-institute-philosophy-events",
        organizer="Royal Institute of Philosophy", summary=f"Online PhD seminar: {title}, presented by {person}.",
        formats=["phd-online-seminar", "graduate-research-talk"], type="seminar",
        venue="Online via Royal Institute of Philosophy", city="Online", event_format="online",
        public_access_status="member-only", audience_scope="Royal Institute members and philosophy researchers", registration_required=True,
        institutional_restriction="Royal Institute of Philosophy membership required.", participant_identity_status=identity_status,
        claims=[claim(person, "doctoral researcher and seminar speaker", category="scholar-expert", status="partly-announced" if identity_status == "partly-named" else "confirmed", mode="online", evidence="The official Royal Institute event list names the date, title, and speaker exactly as published.")],
        parent_id=rip_parent, series_title="Royal Institute of Philosophy PhD Online Seminar Series — Fall 2026", series_role="child", calendar_stage="seminar occurrence",
        time_precision="unknown", education_levels=["graduate", "professional"], academic_disciplines=["Philosophy"],
        tags=["phd-seminar", "member-only", "online"],
    )


# ---------------------------------------------------------------------------
# Additional verified academic and public-intellectual occurrences.
# ---------------------------------------------------------------------------
add_event(
    id="massey-house-of-anansi-cbc-massey-book-launch-2026-09-09",
    title="House of Anansi CBC Massey Book Launch: Housing, Inc.", day="2026-09-09", clock="17:00", end_day="2026-09-09", end_clock="19:00",
    source_url="https://masseycollege.ca/events/house-of-anansi-cbc-massey-book-launch/", source_id="massey-college-events",
    organizer="Massey College and House of Anansi Press", summary="Book launch and signing for Housing, Inc. with Leilani Farha.",
    formats=["book-launch", "author-talk", "public-conversation"], type="book-talk", venue="Massey College, 4 Devonshire Place",
    public_access_status="public-registration", audience_scope="public and academic audience", registration_required=True,
    claims=[claim("Leilani Farha", "author and featured speaker", category="author-writer", evidence="The official Massey College page names Leilani Farha and the launch/signing programme.")],
    education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Housing policy", "Law", "Social policy"], tags=["book-launch", "housing"],
)
add_event(
    id="massey-making-amends-historic-wrongs-book-launch-2026-09-14",
    title="Making Amends for Historic Wrongs — Book Launch and Conversation", day="2026-09-14", clock="17:00", end_day="2026-09-14", end_clock="19:00",
    source_url="https://masseycollege.ca/events/making-amends-for-historic-wrongs-by-dr-mayo-moran/", source_id="massey-college-events",
    organizer="Massey College", summary="Book launch and public conversation about historic wrongs with Mayo Moran, Rosalie Abella, and Frank Iacobucci.",
    formats=["book-launch", "panel", "public-conversation"], type="book-talk", venue="Massey College, 4 Devonshire Place",
    public_access_status="public-registration", audience_scope="public and academic audience", registration_required=True,
    claims=[
        claim("Mayo Moran", "author and speaker", category="author-writer", evidence="Official page names Mayo Moran as author and participant."),
        claim("Rosalie Abella", "conversation participant", category="scholar-expert", evidence="Official page names Rosalie Abella as a conversation participant."),
        claim("Frank Iacobucci", "conversation participant", category="scholar-expert", evidence="Official page names Frank Iacobucci as a conversation participant."),
    ],
    education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Law", "History", "Public policy"], tags=["book-launch", "historic-wrongs"],
)
add_event(
    id="cigi-quantum-nexus-canadian-strategic-advantage-2026-10-21",
    title="The Quantum Nexus: A Framework for Canadian Strategic Advantage in a Contested Domain", day="2026-10-21", clock="12:00", end_day="2026-10-21", end_clock="13:00",
    source_url="https://www.cigionline.org/events/the-quantum-nexus-a-framework-for-canadian-strategic-advantage-in-a-contested-domain/", source_id="cigionline-events",
    organizer="Centre for International Governance Innovation", summary="Virtual public workshop on Canadian quantum strategy with Tracey Forrest and Mauritz Kop.",
    formats=["public-webinar", "policy-workshop", "expert-discussion"], type="webinar", venue="Online via CIGI", city="Online", event_format="online",
    public_access_status="public-registration", audience_scope="public, policy, technology, and academic audience", registration_required=True,
    claims=[claim("Tracey Forrest", "speaker", category="scholar-expert", mode="online", evidence="Official CIGI page names the speaker."), claim("Mauritz Kop", "speaker", category="scholar-expert", mode="online", evidence="Official CIGI page names the speaker.")],
    education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Quantum technology", "Public policy", "International governance"], tags=["quantum", "policy", "online"],
)
add_event(
    id="utoronto-cris-sshrc-insight-grant-strategies-2026-08-18",
    title="SSHRC Insight Grant Strategies for Success", day="2026-08-18", clock="10:30", end_day="2026-08-18", end_clock="12:00",
    source_url="https://cris.utoronto.ca/event/sshrc-insight-grant-strategies-for-success-aug-18-2026/", source_id="utoronto-cris-events",
    organizer="University of Toronto Collaborative Research and Innovation Services", summary="Webinar and panel/Q&A for University of Toronto researchers preparing SSHRC Insight Grant applications.",
    formats=["research-funding-webinar", "panel", "audience-q-and-a"], type="webinar", venue="Online via University of Toronto", city="Online", event_format="online",
    public_access_status="institution-restricted", audience_scope="University of Toronto research community", registration_required=True,
    institutional_restriction="University of Toronto research community.", participant_identity_status="partly-named",
    claims=[], education_levels=["graduate", "professional"], academic_disciplines=["Humanities", "Social sciences", "Research funding"], tags=["sshrc", "research-funding", "online"],
)
add_event(
    id="sshrc-insight-grant-english-webinar-2026-08-20",
    title="2026 SSHRC Insight Grant English Webinar", day="2026-08-20", clock="13:00", end_day="2026-08-20", end_clock="15:00",
    source_url="https://cris.utoronto.ca/event/2026-sshrc-insight-grant-english-webinar-august-20-2026/", source_id="utoronto-cris-events",
    organizer="Social Sciences and Humanities Research Council and University of Toronto CRIS", summary="English-language online information session and Q&A on the 2026 SSHRC Insight Grant competition.",
    formats=["research-funding-webinar", "information-session", "audience-q-and-a"], type="webinar", venue="Online", city="Online", event_format="online",
    public_access_status="public-registration", audience_scope="Canadian researchers and research administrators", registration_required=True,
    participant_identity_status="partly-named", claims=[], source_languages=["en"],
    education_levels=["graduate", "professional"], academic_disciplines=["Humanities", "Social sciences", "Research funding"], tags=["sshrc", "research-funding", "online"],
)
add_event(
    id="perimeter-scicomm-collider-2026",
    title="Scicomm Collider 2026", day="2026-10-19", clock="09:00", end_day="2026-10-21", end_clock="17:00",
    source_url="https://events.perimeterinstitute.ca/event/2128/", source_id="perimeter-institute-events", organizer="Perimeter Institute",
    summary="Three-day science-communication workshop at Perimeter Institute; the proposal/application stage is closed, while the selected-participant programme remains a current academic event.",
    formats=["science-communication-workshop", "academic-intensive"], type="workshop", venue="Perimeter Institute, Alice Room", city="Waterloo",
    public_access_status="selected-participants", audience_scope="selected researchers and science communicators", registration_required=True,
    institutional_restriction="Participation requires prior selection; the proposal period is closed.", participant_identity_status="partly-named",
    claims=[], education_levels=["graduate", "professional"], academic_disciplines=["Science communication", "Physics"], tags=["science-communication", "waterloo"],
)
add_event(
    id="perimeter-relativity-reframed-2026",
    title="Relativity Reframed", day="2026-10-26", clock="08:00", end_day="2026-10-30", end_clock="17:05",
    source_url="https://events.perimeterinstitute.ca/event/2058/", source_id="perimeter-institute-events", organizer="Perimeter Institute",
    summary="Five-day research conference on reframing relativity, with registration and programme information published by Perimeter Institute.",
    formats=["research-conference", "physics-workshop"], type="conference", venue="Perimeter Institute Theatre", city="Waterloo",
    public_access_status="registration-required", audience_scope="physics researchers, graduate students, and invited academic participants", registration_required=True,
    participant_identity_status="named", claims=[], education_levels=["graduate", "professional"], academic_disciplines=["Physics", "Relativity"], tags=["physics", "relativity", "waterloo"],
)
add_event(
    id="queens-nserc-discovery-grant-summer-series-session-3-2026-08-19",
    title="2026 NSERC Discovery Grant Summer Series — Session 3", day="2026-08-19", clock="10:00", end_day="2026-08-19", end_clock="11:00",
    source_url="https://www.queensu.ca/eventscalendar/calendar/events/2026-nserc-discovery-grant-summer-series-session-3", source_id="queens-event-calendar",
    organizer="Queen's University", summary="Online grant-development session for Queen's researchers preparing NSERC Discovery Grant applications.",
    formats=["research-funding-webinar", "grant-development-workshop"], type="webinar", venue="Online via Queen's University", city="Online", event_format="online",
    public_access_status="institution-restricted", audience_scope="Queen's University researchers", registration_required=True,
    institutional_restriction="Queen's University research community.", participant_identity_status="partly-named", claims=[],
    education_levels=["graduate", "professional"], academic_disciplines=["Natural sciences", "Engineering", "Research funding"], tags=["nserc", "research-funding", "online"],
)
add_event(
    id="queens-protocol-development-online-2026-08-19",
    title="Protocol Development — Online", day="2026-08-19", clock="14:00", end_day="2026-08-19", end_clock="15:00",
    source_url="https://www.queensu.ca/eventscalendar/calendar/events/protocol-development-online", source_id="queens-event-calendar",
    organizer="Queen's University", summary="Online research-methods workshop on developing research protocols.",
    formats=["research-methods-workshop", "online-workshop"], type="workshop", venue="Online via Queen's University", city="Online", event_format="online",
    public_access_status="registration-required", audience_scope="researchers, students, and research staff", registration_required=True,
    participant_identity_status="partly-named", claims=[], education_levels=["undergraduate", "graduate", "professional"], academic_disciplines=["Research methods"], tags=["research-methods", "online"],
)
add_event(
    id="queens-under-shadow-of-empire-conference-2026",
    title="Under the Shadow of Empire: Minor Archives and Distribution Networks", day="2026-08-26", clock="10:00", end_day="2026-08-29", end_clock="15:00",
    source_url="https://www.queensu.ca/eventscalendar/calendar/events/under-shadow-empire-minor-archives-and-distribution-networks", source_id="queens-event-calendar",
    organizer="Queen's University Vulnerable Media Lab", summary="Four-day conference on minor archives and distribution networks, hosted at the Isabel Bader Centre and Vulnerable Media Lab.",
    formats=["research-conference", "archives-symposium"], type="conference", venue="Isabel Bader Centre / Vulnerable Media Lab", city="Kingston",
    public_access_status="public-registration", audience_scope="public, artists, archivists, students, and scholars", registration_required=True,
    participant_identity_status="partly-named", claims=[], education_levels=["open", "undergraduate", "graduate", "professional"], academic_disciplines=["Media studies", "Archival studies", "Cultural studies"], tags=["archives", "media", "kingston"],
)

# ---------------------------------------------------------------------------
# Cross-tag relevant existing records without replacing stable identity/source.
# ---------------------------------------------------------------------------
existing_ids = [
    "gerontocracy-in-america-how-the-old-are-hoarding-power-and-wealth-and-what-t-2026-09-17-d0dd7a87",
    "political-philosophy-colloquium-shterna-friedman-2026-09-24-d916e1b8",
    "political-philosophy-colloquium-stephen-eich-2026-10-08-bda35ae9",
    "program-in-ethics-and-public-affairs-ryan-pevnick-2026-10-15-7383334e",
    "james-a-moffett-29-lecture-in-ethics-2026-10-29-db94496b",
    "program-in-ethics-and-public-affairs-robert-wright-2026-11-05-58a1558b",
    "program-in-ethics-and-public-affairs-johanna-thoma-2027-02-25-8c009078",
    "political-philosophy-colloquium-laura-field-2027-03-04-66b2da34",
    "program-in-ethics-and-public-affairs-david-temin-2027-03-18-8779498a",
    "psyche-and-the-city-tanner-lectures-on-human-values-day-1-2027-03-24-35d565cc",
    "psyche-and-the-city-tanner-lectures-on-human-values-day-2-2027-03-25-9d22410c",
    "political-philosophy-colloquium-lois-mcnay-2027-04-01-45312cd8",
    "james-a-moffett-29-lecture-in-ethics-gina-schouten-2027-04-08-0d97e1a5",
    "program-in-ethics-and-public-affairs-jeffrey-howard-2027-04-15-3c960d8d",
    "political-philosophy-colloquium-eric-matthew-nelson-2027-04-29-d5a2a3f3",
    "critical-feminist-histories-2026",
    "ssuns-2026-conference",
    "scms-2027-conference",
    "ncph-2027-conference",
    "acla-2027-virtual-meeting",
    "relational-luhmann-2027-conference",
    "canadian-economics-association-2027-conference",
    "cha-2027-meeting",
]
cross_tags = {
    event_id: {
        "subjects":["Public Intellectual & Academic"],
        "topics":["academic-events"],
        "public_intellectual_academic_formats":["academic-event"],
    }
    for event_id in existing_ids
}

exclusions = [
    {"title":"CIGI Digital Policy Hub Research Conference, December 15, 2026", "reason":"Official source identifies it as a private event; excluded from the public discovery surface."},
    {"title":"Responsible Quantum AI Governance with Mauritz Kop", "reason":"Search surfaced a June 16, 2025 private seminar rather than a current October 2026 public event; no future occurrence imported."},
    {"title":"Daniels — Undisciplined, November 2, 2026", "reason":"The central U of T index displays November 2, 2026, while the specific official page documents February 11–12, 2026. The past specific page controls; no false future occurrence imported."},
    {"title":"Daniels — The Social Life of Small Urban Spaces, December 3, 2026", "reason":"The central U of T index displays December 3, 2026, while the specific official page documents March 12, 2026. The past specific page controls; no false future occurrence imported."},
    {"title":"Toronto Public Library Salon Series — Fall 2026", "reason":"Official programme remained forthcoming with no occurrence-level dates or participants."},
    {"title":"Perimeter Institute public lectures — 2026–27", "reason":"No exact upcoming public-lecture dates were announced on the reviewed official surface; retained as a monitored source family outside the event batch."},
    {"title":"Humanities for Humanity ten-week programme", "reason":"Multi-session course/programme belongs to Set 15 rather than Set 9."},
    {"title":"Open houses, orientations, admissions information sessions, and receptions", "reason":"Administrative access events and social-only functions were outside Set 9 unless they contained a substantive public intellectual programme."},
    {"title":"Festival breaks, receptions, and logistical programme blocks", "reason":"Non-substantive schedule blocks were not converted into separate events."},
]

EXPECTED_RECORDS = 181
assert len(records) == EXPECTED_RECORDS, f"Expected {EXPECTED_RECORDS} Set 9 records, found {len(records)}"
result = apply_import(root=ROOT, config=CONFIG, records=records, cross_tags=cross_tags, exclusions=exclusions)

# Attach source/date history to corrected ULS records after refresh without
# disturbing the first-seen identity preserved by apply_import.
manual_doc = json.loads(manual_path.read_text(encoding="utf-8"))
for event in manual_doc["events"]:
    if event.get("_src") == CONFIG["src"] and "registration_required" not in event:
        # Unknown is materially different from false; retain it explicitly.
        event["registration_required"] = None
by_id = {e.get("id"): e for e in manual_doc["events"] if e.get("id")}
superseded_uls_times = {
    "a9cf2946cd6e": "2026-10-08T19:00:00-04:00",
    "2c6865c009bf": "2026-10-22T19:00:00-04:00",
    "8d9bc31ec525": "2026-11-12T19:00:00-05:00",
}
for event_id, old_hour in superseded_uls_times.items():
    event = by_id[event_id]
    prior = {"source_url": uls_url, "source_id": "u-t-lecture-series", "date": old_hour, "status": "superseded-time"}
    history = list(event.get("source_history") or [])
    if prior not in history:
        history.append(prior)
    event["source_history"] = history
    event["source_inconsistency"] = "An earlier Polymythcal seed stored 7:00 p.m.; the current official University Lecture Series page confirms Thursdays from 2:00–3:00 p.m."
# Preserve the provisional Set 9 values that were corrected during the final
# adversarial pass. Identity remains stable while source/date lineage stays auditable.
correction_specs = {
    "utoronto-eeb-puneeth-deraje-exit-seminar-2026-08-25": {
        "prior": {"date": "2026-08-25T10:00:00-04:00", "status": "superseded-time"},
        "note": "The provisional Set 9 import stored 10:00 a.m.; the current official EEB page confirms 12:00 p.m."
    },
    "utoronto-eeb-ellen-nikelski-exit-seminar-2026-09-08": {
        "prior": {"date": "2026-09-08T10:00:00-04:00", "status": "superseded-time"},
        "note": "The provisional Set 9 import stored 10:00 a.m.; the current official EEB page confirms 1:10 p.m."
    },
    "utoronto-eeb-eniolaye-balogun-exit-seminar-2026-09-22": {
        "prior": {"date": "2026-09-22T10:00:00-04:00", "status": "superseded-time"},
        "note": "The provisional Set 9 import stored 10:00 a.m.; the current official EEB page confirms 9:00 a.m."
    },
    "utoronto-medieval-philosophy-colloquium-2026": {
        "prior": {"source_url": "https://philosophy.utoronto.ca/event/2026-toronto-colloquium-in-medieval-philosophy-a-celebration-of-deborah-black/", "status": "superseded-source-url"},
        "note": "The official page content and dates are for the 2026 colloquium, while its live URL slug begins with 2025; the live official URL is preserved exactly."
    },
    "utoronto-quine-lewis-loewer-2026-09-25": {
        "prior": {"source_url": "https://philosophy.utoronto.ca/event/bringing-quine-and-lewis-back-together/", "status": "superseded-source-url"},
        "note": "The official live URL uses the typographical slug ‘bringin-quine-and-lewis-back-together’; the URL is preserved exactly rather than silently normalized."
    },
}
for event_id, spec in correction_specs.items():
    event = by_id[event_id]
    history = list(event.get("source_history") or [])
    if spec["prior"] not in history:
        history.append(spec["prior"])
    event["source_history"] = history
    event["source_inconsistency"] = spec["note"]

# Alias the Set 9 form taxonomy for the front-facing academic-format filter and
# extend the same alias to compatible cross-tagged records.
for event in manual_doc["events"]:
    if event.get("research_set") == CONFIG["research_set"] or CONFIG["research_set"] in (event.get("research_set_cross_tags") or []):
        forms = list(dict.fromkeys([*(event.get(CONFIG["field_name"]) or []), *(event.get("academic_event_forms") or [])]))
        if forms:
            event["academic_event_forms"] = forms
        event["research_set_cross_tags"] = list(dict.fromkeys(event.get("research_set_cross_tags") or []))

meta = manual_doc.get(CONFIG["metadata_key"], {})
previous_legacy_ids = set(meta.get("legacy_reconciled_ids") or [])
previous_legacy_ids.update(legacy_reconciled)
meta["legacy_records_reconciled"] = max(int(meta.get("legacy_records_reconciled") or 0), len(previous_legacy_ids))
meta["legacy_reconciled_ids"] = sorted(previous_legacy_ids)
meta["official_time_corrections"] = 6
meta["source_url_corrections"] = 2
meta["net_new_records"] = 173
meta["existing_records_refreshed"] = 8
meta["parent_records"] = len([e for e in records if e.get("series_role") == "parent"])
meta["child_occurrences"] = len([e for e in records if e.get("series_role") == "child"])
manual_doc[CONFIG["metadata_key"]] = meta
manual_doc["events"].sort(key=lambda e: (str(e.get("date", "")), str(e.get("title", "")), str(e.get("id", ""))))
manual_doc["count"] = len(manual_doc["events"])
manual_path.write_text(json.dumps(manual_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({**result, "legacy_reconciled": len(legacy_reconciled), "official_time_corrections": 6, "source_url_corrections": 2}, indent=2))
