#!/usr/bin/env python3
"""Idempotently import Polymythcal Set 8 — creator, participant, expert,
witness, and community-present events.

This set generalizes the Medusa correction: the discussion itself remains
visible even when exact participants are not announced, while named attendance
is never inferred from a production credit.
"""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import json

from polymythcal_set_import_common import make_record as R, apply_import, identity

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("America/Toronto")
CONFIG = {
    "src": "manual-polymythcal-creator-present-set8-2026-08-13",
    "research_set": "8-Creator-Participant-Witness-Present",
    "checked": "2026-08-13T20:08:00-04:00",
    "domain_label": "Creator-Present",
    "topic_slug": "creator-present",
    "set_tag": "Set 8",
    "entry_family": "creator-present",
    "field_name": "presence_categories",
    "metadata_key": "polymythcal_creator_present_set8_update_2026_08_13",
    "sources_metadata_key": "polymythcal_creator_present_set8_2026_08_13",
    "research_filename": "polymythcal-research-set-8-creator-present-2026-08-13.json",
    "research_dirname": "polymythcal-set8-creator-present-2026-08-13",
    "ledger_schema": "polymythcal-creator-present-set8-research-ledger-v1",
    "cl_ids": [f"CL-WEB-{n}" for n in range(236, 244)],
    "ledger_notes": [
        "Creator, participant, expert, witness, elder, host, and community presence are independent categories.",
        "Talkback existence, participant category, exact identity, and named-person attendance are separate claims.",
        "Production parents and dated discussion children remain linked but distinct.",
        "Student matinees, member-only events, ticketed events, and free public events retain their access constraints.",
        "Role credits prove role only; attendance-unconfirmed records remain discoverable without becoming false attendance claims.",
    ],
}

records: list[dict] = []
def A(event: dict): records.append(event)

def iso(day: str, clock: str = "00:00") -> str:
    local = datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=TZ)
    return local.isoformat(timespec="seconds")

def claim(person: str, role: str, *, category: str, status: str = "confirmed",
          mode: str = "in-person", scope: str = "discussion", evidence: str = "") -> dict:
    return {
        "person": person,
        "role": role,
        "category": category,
        "status": status,
        "mode": mode,
        "scope": scope,
        "evidence": evidence,
    }

def public_event(*, id: str, title: str, date: str, source_url: str, organizer: str,
                 summary: str, categories: list[str], type: str, venue: str,
                 claims: list[dict], end_date: str | None = None,
                 parent_id: str | None = None, series_title: str | None = None,
                 series_role: str | None = None, calendar_stage: str | None = None,
                 interaction_format: str | None = None, event_format: str = "in-person",
                 access_route: str = "public ticket or registration",
                 institutional_restriction: str | None = None,
                 age_band: str = "Public audience",
                 source_id: str | None = None,
                 source_notes: str | None = None,
                 source_inconsistency: str | None = None,
                 talkback: bool | None = None,
                 director_status: str | None = None,
                 entry_family: str = "creator-present",
                 extra: dict | None = None):
    payload = {
        "entry_family": entry_family,
        "interaction_format": interaction_format,
        "event_format": event_format,
        "presence_mode": "mixed" if event_format == "hybrid" else event_format,
        "presence_claims": claims,
        "participant_presence": [
            f"{c['person']} — {c['role']} ({c['status']}, {c['mode']}, {c['scope']})" for c in claims
        ],
    }
    if talkback is not None:
        payload["talkback_confirmed"] = talkback
        payload["talkback_status"] = "confirmed" if talkback else "not-applicable"
    if director_status is not None:
        payload["director_attendance_status"] = director_status
    if extra:
        payload.update(extra)
    A(R(
        config=CONFIG,
        id=id,
        title=title,
        date=date,
        end_date=end_date,
        source_url=source_url,
        source_id=source_id,
        organizer=organizer,
        summary=summary,
        subfields=categories,
        record_kind="event",
        type=type,
        city="Toronto",
        province="Ontario",
        country="Canada",
        venue=venue,
        age_band=age_band,
        education_levels=["open"] if not institutional_restriction else ["secondary"],
        participation_unit="audience member",
        access_route=access_route,
        institutional_restriction=institutional_restriction,
        registration_url=source_url,
        parent_id=parent_id,
        series_title=series_title,
        series_role=series_role,
        calendar_stage=calendar_stage,
        time_precision="exact",
        source_notes=source_notes,
        source_inconsistency=source_inconsistency,
        tags=["creator-present", "discussion"],
        extra=payload,
    ))

# ---------------------------------------------------------------------------
# Hot Docs Doc Soup: every listed screening includes a special-guest
# conversation; films and guest identities are announced later.
# ---------------------------------------------------------------------------
doc_soup_url = "https://hotdocs.ca/whats-on/doc-soup"
public_event(
    id="hot-docs-doc-soup-2026-27",
    title="Hot Docs Doc Soup 2026–27",
    date=iso("2026-10-07", "19:00"),
    end_date=iso("2027-04-08", "12:00"),
    source_url=doc_soup_url,
    organizer="Hot Docs",
    summary="Seven-film Toronto documentary series in which each screening is followed by a conversation with a special guest; films and guest identities are announced closer to each date.",
    categories=["identity-pending"],
    type="screening",
    venue="Hot Docs Ted Rogers Cinema",
    claims=[claim("Special guests", "post-screening conversation participants", category="identity-pending", status="identity-unannounced", evidence="Official series page confirms special-guest conversations for each screening; names are not yet announced.")],
    series_title="Hot Docs Doc Soup 2026–27",
    series_role="parent",
    calendar_stage="series run",
    interaction_format="post-screening special-guest conversation",
    talkback=True,
    director_status="not-announced",
    entry_family="creator-present-series",
)

doc_soup_occurrences = [
    ("2026-10-07", "19:00", "October evening"),
    ("2026-10-08", "10:30", "October matinee"),
    ("2026-11-04", "19:00", "November evening"),
    ("2026-11-05", "10:30", "November matinee"),
    ("2026-12-02", "19:00", "December evening"),
    ("2026-12-03", "10:30", "December matinee"),
    ("2027-01-13", "19:00", "January evening"),
    ("2027-01-14", "10:30", "January matinee"),
    ("2027-02-03", "19:00", "February evening"),
    ("2027-02-04", "10:30", "February matinee"),
    ("2027-03-03", "19:00", "March evening"),
    ("2027-03-04", "10:30", "March matinee"),
    ("2027-04-07", "19:00", "April evening"),
    ("2027-04-08", "10:30", "April matinee"),
]
for day, clock, label in doc_soup_occurrences:
    public_event(
        id=f"hot-docs-doc-soup-{day}-{clock.replace(':','')}",
        title=f"Doc Soup — {label} screening and special-guest conversation",
        date=iso(day, clock),
        source_url=doc_soup_url,
        organizer="Hot Docs",
        summary="Documentary screening followed by a special-guest conversation. The film and guest identity remain unannounced on the current official series page.",
        categories=["identity-pending"],
        type="screening",
        venue="Hot Docs Ted Rogers Cinema",
        claims=[claim("Special guest", "post-screening conversation participant", category="identity-pending", status="identity-unannounced", evidence="Official Doc Soup schedule confirms a special-guest conversation; identity pending.")],
        parent_id="hot-docs-doc-soup-2026-27",
        series_title="Hot Docs Doc Soup 2026–27",
        series_role="child",
        calendar_stage="screening with post-screening conversation",
        interaction_format="post-screening special-guest conversation",
        talkback=True,
        director_status="not-announced",
    )

# ---------------------------------------------------------------------------
# Tarragon Theatre: eight production parents and 46 occurrence-level artist
# talkbacks/Tarragon Talks. General participation categories are confirmed by
# Tarragon; individual creator attendance remains unconfirmed unless named.
# ---------------------------------------------------------------------------
tarragon_beyond = "https://tarragontheatre.com/education/beyond-the-stage/"
tarragon_productions = [
    {
        "slug":"prophetess", "title":"Prophetess", "start":"2026-09-29", "start_time":"19:30", "end":"2026-10-25",
        "playwright":"Ho Ka Kei (Jeff Ho)", "director":"Mike Payette",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/prophetess/",
        "talks":[
            ("2026-10-11","14:00","tarragon-talk"),("2026-10-13","19:30","talkback"),("2026-10-14","13:00","student"),
            ("2026-10-18","14:00","talkback"),("2026-10-20","19:30","talkback"),("2026-10-21","13:00","student"),
        ],
    },
    {
        "slug":"monks", "title":"MONKS", "start":"2026-10-20", "start_time":"19:30", "end":"2026-11-08",
        "playwright":"Veronica Hortigüela and Annie Luján", "director":"Veronica Hortigüela and Annie Luján",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/monks/",
        "talks":[("2026-10-25","14:00","tarragon-talk"),("2026-10-27","19:30","talkback"),("2026-11-01","14:00","talkback"),("2026-11-03","19:30","talkback")],
    },
    {
        "slug":"night-logan-woke-up", "title":"The Night Logan Woke Up", "start":"2026-11-17", "start_time":"19:30", "end":"2026-12-13",
        "playwright":"Michel Marc Bouchard", "director":"Jillian Keiley",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/the-night-logan-woke-up/",
        "talks":[("2026-11-29","14:00","tarragon-talk"),("2026-12-01","19:30","talkback"),("2026-12-02","13:00","student"),("2026-12-06","14:00","talkback"),("2026-12-09","13:00","student")],
        "source_inconsistency":"The general Beyond the Stage page also lists a December 8 talkback, while the current production page does not mark that performance. The occurrence was not imported pending reconciliation.",
    },
    {
        "slug":"call-me-by-my-cousins-name", "title":"Call Me By My Cousin’s Name", "start":"2027-02-02", "start_time":"19:30", "end":"2027-02-28",
        "playwright":"Anahita Dehbonehie", "director":"Mitchell Cushman",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/call-me-by-my-cousins-name/",
        "talks":[("2027-02-03","13:00","student"),("2027-02-14","14:00","tarragon-talk"),("2027-02-16","19:30","talkback"),("2027-02-17","13:00","student"),("2027-02-21","14:00","talkback"),("2027-02-23","19:30","talkback")],
    },
    {
        "slug":"shoplifters", "title":"The Shoplifters", "start":"2027-03-02", "start_time":"19:30", "end":"2027-03-28",
        "playwright":"Morris Panych", "director":"Morris Panych",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/the-shoplifters/",
        "talks":[("2027-03-12","13:00","student"),("2027-03-14","14:00","tarragon-talk"),("2027-03-16","19:30","talkback"),("2027-03-17","13:00","talkback"),("2027-03-21","14:00","talkback"),("2027-03-23","19:30","talkback"),("2027-03-24","13:00","student")],
    },
    {
        "slug":"youre-still-here", "title":"You’re Still Here", "start":"2027-03-23", "start_time":"19:30", "end":"2027-04-18",
        "playwright":"Katherine Gauthier", "director":"Andrew Kushnir",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/youre-still-here/",
        "talks":[("2027-04-04","14:00","tarragon-talk"),("2027-04-06","19:30","talkback"),("2027-04-07","13:00","student"),("2027-04-11","14:00","talkback"),("2027-04-13","19:30","talkback"),("2027-04-14","13:00","student")],
    },
    {
        "slug":"definition", "title":"Definition", "start":"2027-04-27", "start_time":"19:30", "end":"2027-05-23",
        "playwright":"Luke Reece", "director":"Mike Payette",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/definition/",
        "talks":[("2027-05-09","14:00","tarragon-talk"),("2027-05-11","19:30","talkback"),("2027-05-12","13:00","student"),("2027-05-16","14:00","talkback"),("2027-05-18","19:30","talkback"),("2027-05-19","13:00","student")],
    },
    {
        "slug":"yaga", "title":"YAGA", "start":"2027-05-11", "start_time":"19:30", "end":"2027-06-06",
        "playwright":"Kat Sandler", "director":"Jill Harper",
        "url":"https://tarragontheatre.com/plays/tarragon-season-26-27/yaga-2627/",
        "talks":[("2027-05-23","14:00","tarragon-talk"),("2027-05-25","19:30","talkback"),("2027-05-26","13:00","student"),("2027-05-30","14:00","talkback"),("2027-06-01","19:30","talkback"),("2027-06-02","13:00","student")],
    },
]

for production in tarragon_productions:
    parent_id = f"tarragon-{production['slug']}-2026-27"
    parent_claims = [
        claim(production["playwright"], "playwright/creator", category="author-writer", status="role-confirmed", mode="not-applicable", scope="production-credit", evidence="Official production page credits the playwright/creator; attendance is not implied."),
        claim(production["director"], "director", category="director-filmmaker", status="role-confirmed", mode="not-applicable", scope="production-credit", evidence="Official production page credits the director; attendance is not implied."),
    ]
    public_event(
        id=parent_id,
        title=f"{production['title']} — Tarragon Theatre",
        date=iso(production["start"], production["start_time"]),
        end_date=iso(production["end"], "23:00"),
        source_url=production["url"],
        organizer="Tarragon Theatre",
        summary=f"Tarragon Theatre production written/created by {production['playwright']} and directed by {production['director']}. Dated talkbacks are stored as child occurrences.",
        categories=[],
        type="performance",
        venue="Tarragon Theatre",
        claims=parent_claims,
        series_title=production["title"],
        series_role="parent",
        calendar_stage="production run",
        interaction_format="production parent",
        talkback=False,
        director_status="role-confirmed-attendance-unconfirmed",
        entry_family="performance",
        source_inconsistency=production.get("source_inconsistency"),
        extra={"presence_categories": []},
    )
    for day, clock, kind in production["talks"]:
        is_student = kind == "student"
        is_tarragon_talk = kind == "tarragon-talk"
        if is_tarragon_talk:
            suffix = "Tarragon Talk"
            categories = ["production-participants", "community-witness-elder", "identity-pending"]
            group_claims = [
                claim("Members of the creative team", "discussion participants", category="production-participants", status="identity-unannounced", evidence="Tarragon states that Tarragon Talks feature members of the creative team."),
                claim("Community leaders", "discussion participants", category="community-witness-elder", status="identity-unannounced", evidence="Tarragon states that Tarragon Talks feature community leaders."),
            ]
            interaction = "moderated post-show Tarragon Talk"
        else:
            suffix = "student matinee and artist talkback" if is_student else "post-show artist talkback"
            categories = ["production-participants", "identity-pending"]
            group_claims = [
                claim("Members of the cast and creative team", "post-show discussion participants", category="production-participants", status="identity-unannounced", evidence="Tarragon states that selected artist talkbacks feature members of the cast and creative teams."),
            ]
            interaction = "post-show artist talkback"
        named_uncertain = [
            claim(production["playwright"], "playwright/creator", category="author-writer", status="attendance-unconfirmed", mode="unknown", evidence="Creator role is confirmed; attendance at this occurrence is not named."),
            claim(production["director"], "director", category="director-filmmaker", status="attendance-unconfirmed", mode="unknown", evidence="Director role is confirmed; attendance at this occurrence is not named."),
        ]
        public_event(
            id=f"{parent_id}-{day}-{clock.replace(':','')}-{kind}",
            title=f"{production['title']} — {suffix}",
            date=iso(day, clock),
            source_url=production["url"],
            organizer="Tarragon Theatre",
            summary=f"Performance of {production['title']} followed by {interaction}. Participant categories are confirmed by Tarragon, while exact names remain unannounced.",
            categories=categories,
            type="performance",
            venue="Tarragon Theatre",
            claims=[*group_claims, *named_uncertain],
            parent_id=parent_id,
            series_title=production["title"],
            series_role="child",
            calendar_stage="student performance with post-show talkback" if is_student else "performance with post-show discussion",
            interaction_format=interaction,
            access_route="school-group booking" if is_student else "ticketed public performance",
            institutional_restriction="Student matinee; school-group booking required." if is_student else None,
            age_band="School groups" if is_student else "Public audience",
            source_notes=f"Official production page and Tarragon Beyond the Stage participation policy reviewed on 2026-08-13: {tarragon_beyond}",
            talkback=True,
            director_status="unconfirmed",
            extra={"talkback_time_precision": "after-performance"},
        )

# ---------------------------------------------------------------------------
# Canadian Stage production parents and talkback child occurrences.
# Existing Goodnight Desdemona and Rogers v. Rogers parents are enriched later
# without changing their stable IDs.
# ---------------------------------------------------------------------------
canadian_stage_new_parents = [
    {
        "id":"canadian-stage-sex-in-the-80s-2027", "title":"Sex in the ’80s", "start":"2027-01-16", "start_time":"19:30", "end":"2027-02-07",
        "playwright":"Kate Hennig", "director":"Tanja Jacobs", "url":"https://www.canadianstage.com/show/sex-in-the-80s", "venue":"Berkeley Street Theatre",
    },
    {
        "id":"canadian-stage-cabaret-2027", "title":"Cabaret", "start":"2027-02-13", "start_time":"19:30", "end":"2027-02-28",
        "playwright":"Joe Masteroff; John Kander; Fred Ebb", "director":"Kimberley Rampersad", "url":"https://www.canadianstage.com/show/cabaret", "venue":"Bluma Appel Theatre",
    },
    {
        "id":"canadian-stage-creditors-2027", "title":"Creditors", "start":"2027-04-09", "start_time":"19:30", "end":"2027-05-02",
        "playwright":"August Strindberg; adaptation by Jen Silverman", "director":"Brendan Healy", "url":"https://www.canadianstage.com/show/creditors", "venue":"Bluma Appel Theatre",
    },
]
for production in canadian_stage_new_parents:
    public_event(
        id=production["id"],
        title=f"{production['title']} — Canadian Stage",
        date=iso(production["start"], production["start_time"]),
        end_date=iso(production["end"], "23:00"),
        source_url=production["url"],
        organizer="Canadian Stage",
        summary=f"Canadian Stage production with a separately indexed post-show talkback. Written/adapted by {production['playwright']} and directed by {production['director']}.",
        categories=[],
        type="performance",
        venue=production["venue"],
        claims=[
            claim(production["playwright"], "writer/adaptor", category="author-writer", status="role-confirmed", mode="not-applicable", scope="production-credit", evidence="Official production page confirms the writing credit; attendance is not implied."),
            claim(production["director"], "director", category="director-filmmaker", status="role-confirmed", mode="not-applicable", scope="production-credit", evidence="Official production page confirms the director credit; attendance is not implied."),
        ],
        series_title=production["title"],
        series_role="parent",
        calendar_stage="production run",
        interaction_format="production parent",
        talkback=False,
        director_status="role-confirmed-attendance-unconfirmed",
        entry_family="performance",
        extra={"presence_categories": []},
    )

canadian_stage_talkbacks = [
    {
        "id":"goodnight-desdemona-talkback-2026-11-19", "title":"Goodnight Desdemona (Good Morning Juliet)", "day":"2026-11-19", "time":"19:30",
        "parent":"goodnight-desdemona-good-morning-juliet-2026-11-06", "url":"https://www.canadianstage.com/show/goodnight-desdemona-good-morning-juliet", "venue":"Bluma Appel Theatre",
        "director":"Alisa Palmer", "writer":"Ann-Marie MacDonald", "performer":"Ann-Marie MacDonald",
    },
    {
        "id":"rogers-v-rogers-talkback-2026-11-19", "title":"Rogers v. Rogers", "day":"2026-11-19", "time":"19:30",
        "parent":"rogers-v-rogers-healey-2026-11-08", "url":"https://www.canadianstage.com/show/rogers-v.-rogers", "venue":"Berkeley Street Theatre",
        "director":"Chris Abraham", "writer":"Michael Healey", "performer":"Tom Rooney",
    },
    {
        "id":"sex-in-the-80s-talkback-2027-01-28", "title":"Sex in the ’80s", "day":"2027-01-28", "time":"19:30",
        "parent":"canadian-stage-sex-in-the-80s-2027", "url":"https://www.canadianstage.com/show/sex-in-the-80s", "venue":"Berkeley Street Theatre",
        "director":"Tanja Jacobs", "writer":"Kate Hennig", "performer":"Kate Hennig",
    },
    {
        "id":"cabaret-talkback-2027-02-25", "title":"Cabaret", "day":"2027-02-25", "time":"19:30",
        "parent":"canadian-stage-cabaret-2027", "url":"https://www.canadianstage.com/show/cabaret", "venue":"Bluma Appel Theatre",
        "director":"Kimberley Rampersad", "writer":"Joe Masteroff; John Kander; Fred Ebb", "performer":None,
    },
    {
        "id":"creditors-talkback-2027-04-15", "title":"Creditors", "day":"2027-04-15", "time":"19:30",
        "parent":"canadian-stage-creditors-2027", "url":"https://www.canadianstage.com/show/creditors", "venue":"Bluma Appel Theatre",
        "director":"Brendan Healy", "writer":"August Strindberg; adaptation by Jen Silverman", "performer":None,
    },
]
for item in canadian_stage_talkbacks:
    claims = [
        claim("Talkback participants", "post-show discussion participants", category="production-participants", status="identity-unannounced", evidence="Official Canadian Stage page confirms the talkback date but does not identify its participants."),
        claim(item["director"], "director", category="director-filmmaker", status="attendance-unconfirmed", mode="unknown", evidence="Director role is confirmed; talkback attendance is not named."),
        claim(item["writer"], "writer/adaptor", category="author-writer", status="attendance-unconfirmed", mode="unknown", evidence="Writing role is confirmed; talkback attendance is not named."),
    ]
    if item["performer"]:
        claims.append(claim(item["performer"], "performer in the scheduled production", category="cast-crew", status="confirmed", scope="performance", evidence="Official cast listing confirms presence in the performance; this does not prove talkback participation."))
    public_event(
        id=item["id"],
        title=f"{item['title']} — post-show talkback",
        date=iso(item["day"], item["time"]),
        source_url=item["url"],
        organizer="Canadian Stage",
        summary=f"Performance of {item['title']} followed by a confirmed talkback. The official page does not name the talkback participants.",
        categories=["production-participants", "identity-pending"] + (["cast-crew"] if item["performer"] else []),
        type="performance",
        venue=item["venue"],
        claims=claims,
        parent_id=item["parent"],
        series_title=item["title"],
        series_role="child",
        calendar_stage="performance with post-show talkback",
        interaction_format="post-show talkback",
        talkback=True,
        director_status="unconfirmed",
        extra={"talkback_time_precision": "after-performance"},
    )

# ---------------------------------------------------------------------------
# Toronto International Festival of Authors: named author/storyteller presence.
# ---------------------------------------------------------------------------
tifa_calendar = "https://festivalofauthors.ca/whats-on/"
public_event(
    id="tifa-fall-program-2026",
    title="TIFA Presents — Fall 2026 creator programme",
    date=iso("2026-09-17", "19:30"),
    end_date=iso("2026-11-01", "19:30"),
    source_url=tifa_calendar,
    organizer="Toronto International Festival of Authors",
    summary="Fall series of author conversations and performances, including the flagship festival. Individual named-person occurrences are indexed separately.",
    categories=["author-writer", "performer-storyteller"],
    type="reading",
    venue="Multiple Toronto venues",
    claims=[claim("Published programme participants", "authors, storytellers, journalists, and performers", category="author-writer", status="programme-confirmed", scope="series", evidence="Official TIFA calendar names the participants for individual occurrences.")],
    series_title="TIFA Fall 2026",
    series_role="parent",
    calendar_stage="programme run",
    interaction_format="author conversations and literary performances",
    talkback=False,
    entry_family="creator-present-series",
)

tifa_events = [
    ("tifa-moth-mainstage-2026-09-17", "The Moth Mainstage", "2026-09-17", "19:30", "Koerner Hall", [("Featured storytellers", "storytellers", "performer-storyteller", "identity-unannounced")], "live storytelling performance"),
    ("tifa-rf-kuang-2026-09-22", "An Evening with R.F. Kuang", "2026-09-22", "19:30", "Winter Garden Theatre", [("R.F. Kuang", "author", "author-writer", "confirmed")], "author conversation"),
    ("tifa-bk-borison-danielle-mckechnie-2026-09-29", "B.K. Borison & Danielle McKechnie", "2026-09-29", "19:30", "Hot Docs Ted Rogers Cinema", [("B.K. Borison", "author", "author-writer", "confirmed"),("Danielle McKechnie", "author", "author-writer", "confirmed")], "author conversation"),
    ("tifa-bonnie-garmus-2026-10-15", "Bonnie Garmus", "2026-10-15", "19:30", "Hot Docs Ted Rogers Cinema", [("Bonnie Garmus", "author", "author-writer", "confirmed")], "author conversation"),
    ("tifa-emily-st-john-mandel-mattea-roach-2026-10-20", "Emily St. John Mandel in conversation with Mattea Roach", "2026-10-20", "19:30", "Hot Docs Ted Rogers Cinema", [("Emily St. John Mandel", "author", "author-writer", "confirmed"),("Mattea Roach", "interviewer and host", "host-moderator", "confirmed")], "author conversation"),
    ("tifa-ann-cleeves-2026-10-26", "Ann Cleeves", "2026-10-26", "19:30", "Isabel Bader Theatre", [("Ann Cleeves", "author", "author-writer", "confirmed")], "author conversation"),
    ("tifa-evan-gershkovich-pen-graeme-gibson-talk-2026-10-27", "PEN Canada Graeme Gibson Talk with Evan Gershkovich", "2026-10-27", "19:30", "Winter Garden Theatre", [("Evan Gershkovich", "journalist and speaker", "author-writer", "confirmed")], "public literary and journalism talk"),
    ("tifa-barbara-kingsolver-2026-10-30", "Barbara Kingsolver", "2026-10-30", "20:00", "Winter Garden Theatre", [("Barbara Kingsolver", "author", "author-writer", "confirmed")], "author conversation"),
    ("tifa-east-west-street-philippe-sands-2026-11-01", "East West Street: A Song of Good & Evil", "2026-11-01", "17:00", "Winter Garden Theatre", [("Philippe Sands", "author and performer", "author-writer", "confirmed")], "literary performance"),
]
for id_, title, day, clock, venue, people, interaction in tifa_events:
    claims = [claim(name, role, category=category, status=status, evidence="Official TIFA calendar names this participant for the occurrence.") for name, role, category, status in people]
    categories = list(dict.fromkeys([category for _, _, category, _ in people] + (["identity-pending"] if any(status == "identity-unannounced" for *_, status in people) else [])))
    public_event(
        id=id_, title=title, date=iso(day, clock), source_url=tifa_calendar,
        organizer="Toronto International Festival of Authors", summary=f"TIFA Presents occurrence featuring {', '.join(name for name, *_ in people)}.",
        categories=categories, type="performance" if "performance" in interaction or "storytelling" in interaction else "reading",
        venue=venue, claims=claims,
        parent_id="tifa-2026-festival" if day >= "2026-10-28" else "tifa-fall-program-2026",
        series_title="Toronto International Festival of Authors 2026",
        series_role="child", calendar_stage="live literary programme", interaction_format=interaction,
        talkback=False,
    )

# ---------------------------------------------------------------------------
# Author, artist, curator, and expert events outside the large series.
# ---------------------------------------------------------------------------
public_event(
    id="hot-docs-ian-brown-seventy-author-talk-2026-09-03",
    title="Ian Brown on Seventy — author discussion and signing",
    date=iso("2026-09-03", "19:00"),
    source_url="https://boxoffice.hotdocs.ca/websales/pages/info.aspx?epguid=a2104450-7e47-4369-a17d-c247570c3939&evtinfo=643175~cf285ddd-dacb-4f18-89b8-1252c6dcffa6&mdy=9%2F3%2F2026",
    organizer="Hot Docs",
    summary="Live discussion with author Ian Brown followed by a book signing.",
    categories=["author-writer"],
    type="book-talk",
    venue="Hot Docs Ted Rogers Cinema",
    claims=[claim("Ian Brown", "author and speaker", category="author-writer", evidence="Official event page identifies Ian Brown as the live discussion participant.")],
    interaction_format="author discussion and book signing",
    talkback=False,
)

public_event(
    id="revue-hilma-af-klint-expert-q-and-a-2026-08-30",
    title="Hilma Af Klint: The Pioneering Abstract Painter — expert Q&A",
    date=iso("2026-08-30", "12:30"),
    source_url="https://revuecinema.ca/films/extraordinary-women-hilma-af-klint-the-pioneering-abstract-painter/",
    organizer="The Revue Cinema",
    summary="Screening followed by a Q&A with University of Toronto associate professor Alison Syme and doctoral researcher Bronwen Cox.",
    categories=["scholar-expert"],
    type="screening",
    venue="The Revue Cinema",
    claims=[
        claim("Alison Syme", "associate professor and discussion participant", category="scholar-expert", evidence="Official Revue page names the expert Q&A participant."),
        claim("Bronwen Cox", "doctoral researcher and discussion participant", category="scholar-expert", evidence="Official Revue page names the expert Q&A participant."),
    ],
    interaction_format="post-screening expert Q&A",
    talkback=True,
    director_status="not-applicable",
)

rom_url = "https://www.rom.on.ca/whats-on/events/member-events-exchange-weekends-curator-coffee-and-chat-making-shokkan-0"
rom_claims = [
    claim("Akiko Takesue", "Bishop White Committee Curator of Japanese Art & Culture", category="artist-curator", evidence="Official ROM page names the curator, presentation, moderated talk, and audience Q&A."),
    claim("Kōsuke Ikeda", "featured artist and writer", category="artist-curator", evidence="Official ROM page names the artist, presentation, moderated talk, and audience Q&A."),
    claim("Colin Fleming", "moderator and ROM executive writer", category="host-moderator", evidence="Official ROM page names the moderator."),
]
for suffix, clock, end_clock, label in [("morning","11:00","12:00","morning session"),("afternoon","13:30","14:30","afternoon session")]:
    public_event(
        id=f"rom-shokkan-curator-coffee-chat-{suffix}-2026-08-28",
        title=f"The Making of Shokkan — curator coffee and chat ({label})",
        date=iso("2026-08-28", clock),
        end_date=iso("2026-08-28", end_clock),
        source_url=rom_url,
        organizer="Royal Ontario Museum",
        summary="Member event with curator Akiko Takesue, artist Kōsuke Ikeda, and moderator Colin Fleming, including presentations, moderated conversation, and audience Q&A.",
        categories=["artist-curator", "host-moderator"],
        type="artist-talk",
        venue="Royal Ontario Museum, c5 Lounge",
        claims=rom_claims,
        interaction_format="curator and artist conversation with audience Q&A",
        access_route="ROM member registration",
        institutional_restriction="ROM members only; registration required; limited capacity; guest privileges do not apply.",
        age_band="Adults; ROM members",
        talkback=True,
        source_inconsistency="The page header gives 13:00–14:30 for the afternoon session, while the detailed agenda gives 13:00 check-in and a 13:30 programme start. The calendar uses the programme start and preserves this note." if suffix == "afternoon" else None,
    )

# Cross-tag Set 7 occurrences and the Medusa benchmark without replacing their
# stable identities or source lineage.
set7_ids = [
    "hot-docs-nekai-walks-director-subject-q-and-a-2026-08-14",
    "hot-docs-green-valley-director-q-and-a-2026-08-15",
    "hot-docs-wild-inside-director-virtual-q-and-a-2026-08-16",
    "hot-docs-antidiva-carole-pope-director-q-and-a-2026-08-16",
    "revue-withdrawal-director-q-and-a-2026-08-19",
    "revue-leonora-morning-light-directors-q-and-a-2026-09-14",
    "revue-cash-cow-director-producer-q-and-a-2026-09-15",
    "paradise-lunar-sway-director-cast-q-and-a-2026-08-28",
    "hot-docs-bootstraps-filmmaker-special-guest-q-and-a-2026-08-22",
]
cross_tags = {
    **{id_: {"subjects":["Creator-Present"], "topics":["creator-present"], "presence_categories":[]} for id_ in set7_ids},
    "soulpepper-medusa-talkback-2026-07-08": {
        "subjects":["Creator-Present"], "topics":["creator-present"],
        "presence_categories":["production-participants", "identity-pending"],
    },
}

exclusions = [
    {"title":"Tarragon — The Night Logan Woke Up, December 8, 2026 talkback", "reason":"The general Beyond the Stage page lists the date, but the current production page does not mark that occurrence. Preserved as a source conflict, not imported as confirmed."},
    {"title":"Tarragon guest presentations without listed talkbacks", "reason":"The Fifth Step and Dial 1 for UK production pages did not supply occurrence-level talkback evidence in the current Beyond the Stage schedule."},
    {"title":"Canadian Stage production credits", "reason":"Writers, directors, and cast are credited on production pages, but those credits were not converted into claims that they will participate in a talkback."},
    {"title":"Old AGO, MOCA, TIFF, and venue search results", "reason":"Legacy pages and previous-edition results were excluded rather than re-dated as current occurrences."},
    {"title":"Toronto Public Library Fall 2026 Salon participants", "reason":"The official Salon Series page says the Fall programme is forthcoming and currently lists no events; retained as a source watch outside the public event batch."},
]

assert sum(len(p["talks"]) for p in tarragon_productions) == 46
assert len(records) == 91, f"Expected 91 Set 8 records, found {len(records)}"
apply_import(root=ROOT, config=CONFIG, records=records, cross_tags=cross_tags, exclusions=exclusions)

# Enrich three pre-existing parent records in place. This preserves their
# stable IDs/source lineage while correcting dates and attaching child events.
manual_path = ROOT / "data" / "manual-events.json"
manual = json.loads(manual_path.read_text(encoding="utf-8"))
events = manual["events"]

def merge_parent(existing: dict, patch: dict):
    history = list(existing.get("source_history") or [])
    prior = {"source_url": existing.get("source_url"), "source_id": existing.get("source_id"), "date": existing.get("date"), "end_date": existing.get("end_date")}
    changed = any(prior.get(field) != patch.get(field) for field in ("source_url", "source_id", "date", "end_date"))
    if changed and prior not in history: history.append(prior)
    keep_src = existing.get("_src")
    keep_first = existing.get("first_seen_at")
    existing.update(patch)
    if keep_src is not None: existing["_src"] = keep_src
    if keep_first: existing["first_seen_at"] = keep_first
    existing["source_history"] = history
    existing["research_set_cross_tags"] = list(dict.fromkeys([*(existing.get("research_set_cross_tags") or []), CONFIG["research_set"]]))
    existing["_upsert_batches"] = list(dict.fromkeys([*(existing.get("_upsert_batches") or []), CONFIG["src"]]))

parent_specs = {
    "goodnight-desdemona-good-morning-juliet-2026-11-06": {
        "title":"Goodnight Desdemona (Good Morning Juliet)", "date":iso("2026-11-06","19:30"), "end_date":iso("2026-11-22","23:00"),
        "url":"https://www.canadianstage.com/show/goodnight-desdemona-good-morning-juliet", "venue":"Bluma Appel Theatre", "writer":"Ann-Marie MacDonald", "director":"Alisa Palmer",
    },
    "rogers-v-rogers-healey-2026-11-08": {
        "title":"Rogers v. Rogers", "date":iso("2026-11-08","14:00"), "end_date":iso("2026-12-13","23:00"),
        "url":"https://www.canadianstage.com/show/rogers-v.-rogers", "venue":"Berkeley Street Theatre", "writer":"Michael Healey", "director":"Chris Abraham",
    },
}
for event in events:
    spec = parent_specs.get(event.get("id"))
    if not spec: continue
    patch = R(
        config=CONFIG, id=event["id"], title=spec["title"], date=spec["date"], end_date=spec["end_date"],
        source_url=spec["url"], source_id=event.get("source_id") or "canadian-stage", organizer="Canadian Stage",
        summary=f"Canadian Stage production written by {spec['writer']} and directed by {spec['director']}; the post-show talkback is stored as a child occurrence.",
        subfields=[], record_kind="event", type="performance", city="Toronto", province="Ontario", country="Canada", venue=spec["venue"],
        age_band="Public audience", education_levels=["open"], series_title=spec["title"], series_role="parent", calendar_stage="production run",
        time_precision="exact", extra={
            "entry_family":"performance", "presence_categories":[], "interaction_format":"production parent", "talkback_confirmed":False,
            "talkback_status":"not-applicable", "director_attendance_status":"role-confirmed-attendance-unconfirmed",
            "presence_claims":[
                claim(spec["writer"], "writer", category="author-writer", status="role-confirmed", mode="not-applicable", scope="production-credit", evidence="Official page confirms role only."),
                claim(spec["director"], "director", category="director-filmmaker", status="role-confirmed", mode="not-applicable", scope="production-credit", evidence="Official page confirms role only."),
            ],
        }
    )
    patch.pop("_src", None)
    merge_parent(event, patch)

# The legacy TIFA parent had no stable ID and carried an earlier announced
# start date. Assign a stable ID once and preserve the earlier range.
for event in events:
    if event.get("title") != "Toronto International Festival of Authors 2026 (TIFA)": continue
    old_date, old_end = event.get("date"), event.get("end_date")
    event_id = "tifa-2026-festival"
    current_date, current_end = iso("2026-10-28","17:00"), iso("2026-11-01","23:00")
    alternate_date_ranges = []
    prior_ranges = [*(event.get("alternate_date_ranges") or []), *(event.get("source_history") or [])]
    for prior in prior_ranges:
        date_value, end_value = prior.get("date"), prior.get("end_date")
        if not date_value or (date_value == current_date and end_value == current_end):
            continue
        candidate = {"date": date_value, "end_date": end_value, "status": "superseded-announcement"}
        if candidate not in alternate_date_ranges:
            alternate_date_ranges.append(candidate)
    if old_date and (old_date != current_date or old_end != current_end):
        candidate = {"date": old_date, "end_date": old_end, "status": "superseded-announcement"}
        if candidate not in alternate_date_ranges:
            alternate_date_ranges.append(candidate)
    patch = R(
        config=CONFIG, id=event_id, title=event["title"], date=current_date, end_date=current_end,
        source_url="https://festivalofauthors.ca/flagship-fall-festival/", source_id=event.get("source_id") or "manual-curated",
        organizer="Toronto International Festival of Authors", summary="The 2026 flagship festival at Victoria University, with individual creator-present events stored separately.",
        subfields=[], record_kind="festival", type="festival", city="Toronto", province="Ontario", country="Canada", venue="Victoria University at the University of Toronto",
        age_band="Public audience", education_levels=["open"], series_title="Toronto International Festival of Authors 2026", series_role="parent", calendar_stage="festival run",
        time_precision="exact", source_inconsistency="An earlier published surface used October 27–November 1; the current official festival page uses October 28–November 1.",
        extra={
            "entry_family":"festival",
            "presence_categories":[],
            "legacy_ids": list(dict.fromkeys([*(event.get("legacy_ids") or []), "toronto-international-festival-of-authors-2026-tif-2026-10-27"])),
            "alternate_date_ranges": alternate_date_ranges,
        },
    )
    patch.pop("_src", None)
    merge_parent(event, patch)
    break

manual["events"].sort(key=lambda e: (str(e.get("date", "")), str(e.get("title", "")), str(e.get("id", ""))))
manual["count"] = len(manual["events"])
meta = manual.get(CONFIG["metadata_key"], {})
meta["existing_parent_records_enriched"] = 3
meta["existing_parent_ids"] = ["goodnight-desdemona-good-morning-juliet-2026-11-06", "rogers-v-rogers-healey-2026-11-08", "tifa-2026-festival"]
manual[CONFIG["metadata_key"]] = meta
manual_path.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"existing_parent_records_enriched": 3, "manual_total": manual["count"]}, indent=2))
