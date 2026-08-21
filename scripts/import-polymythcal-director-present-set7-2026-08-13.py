#!/usr/bin/env python3
"""Idempotently import Polymythcal Set 7 — director/filmmaker-present events.

Every attendance claim is scoped to a specific occurrence. A creator credit proves
role only; it never proves attendance. Remote participation and unnamed filmmaker
participation remain explicit rather than being flattened into "director present".
"""
from pathlib import Path
from polymythcal_set_import_common import make_record as R, apply_import

ROOT = Path(__file__).resolve().parents[1]
CONFIG = {
    "src": "manual-polymythcal-director-present-set7-2026-08-13",
    "research_set": "7-Director-Filmmaker-Present",
    "checked": "2026-08-13T20:08:00-04:00",
    "domain_label": "Creator-Present",
    "topic_slug": "creator-present",
    "set_tag": "Set 7",
    "entry_family": "creator-present",
    "field_name": "presence_categories",
    "metadata_key": "polymythcal_director_present_set7_update_2026_08_13",
    "sources_metadata_key": "polymythcal_director_present_set7_2026_08_13",
    "research_filename": "polymythcal-research-set-7-director-present-2026-08-13.json",
    "research_dirname": "polymythcal-set7-director-present-2026-08-13",
    "ledger_schema": "polymythcal-director-present-set7-research-ledger-v1",
    "cl_ids": [f"CL-WEB-{n}" for n in range(228, 236)],
    "ledger_notes": [
        "Director and filmmaker attendance is attached to a dated occurrence, not inferred from a creator credit.",
        "In-person, remote, mixed, and identity-unannounced participation remain distinct.",
        "A confirmed Q&A survives even when the exact attending filmmaker is not named.",
        "Official occurrence pages outrank broad calendars; stale legacy pages remain exclusions rather than current events.",
    ],
}

records = []
def A(event): records.append(event)

def claim(person, role, *, status="confirmed", mode="in-person", scope="discussion", category="director-filmmaker", evidence=""):
    return {
        "person": person,
        "role": role,
        "category": category,
        "status": status,
        "mode": mode,
        "scope": scope,
        "evidence": evidence,
    }

def screening(*, id, title, date, source_url, organizer, venue, summary, claims,
              categories=None, mode="in-person", director_status="confirmed",
              source_id=None, source_notes=None, source_inconsistency=None):
    categories = categories or ["director-filmmaker"]
    event = R(
        config=CONFIG,
        id=id,
        title=title,
        date=date,
        source_url=source_url,
        source_id=source_id,
        organizer=organizer,
        summary=summary,
        subfields=categories,
        record_kind="event",
        type="screening",
        city="Toronto",
        province="Ontario",
        country="Canada",
        venue=venue,
        age_band="Public audience; ticket or registration required",
        education_levels=["open", "professional"],
        participation_unit="audience member",
        access_route="ticketed or registered public screening",
        registration_url=source_url,
        calendar_stage="screening with post-screening discussion",
        time_precision="exact",
        source_notes=source_notes,
        source_inconsistency=source_inconsistency,
        tags=["film", "q-and-a", "creator-present"],
        extra={
            "subjects": ["Media Literacy", "Creator-Present", *categories],
            "topics": ["media-literacy", "film", "creator-present"],
            "entry_family": "creator-present",
            "interaction_format": "post-screening Q&A",
            "event_format": "hybrid" if mode == "remote" else mode,
            "presence_mode": mode,
            "talkback_confirmed": True,
            "talkback_status": "confirmed",
            "director_attendance_status": director_status,
            "presence_claims": claims,
            "participant_presence": [
                f"{c['person']} — {c['role']} ({c['status']}, {c['mode']}, {c['scope']})" for c in claims
            ],
        },
    )
    A(event)

# Hot Docs Ted Rogers Cinema.
screening(
    id="hot-docs-nekai-walks-director-subject-q-and-a-2026-08-14",
    title="Nekai Walks — Q&A with director Rico King and film subject Nekai Foster",
    date="2026-08-14T19:00:00-04:00",
    source_url="https://boxoffice.hotdocs.ca/websales/pages/info.aspx?evtinfo=635512~cf285ddd-dacb-4f18-89b8-1252c6dcffa6",
    organizer="Hot Docs",
    venue="Hot Docs Ted Rogers Cinema",
    summary="Toronto screening followed by an in-person Q&A with director Rico King and film subject Nekai Foster.",
    categories=["director-filmmaker", "film-subject"],
    claims=[
        claim("Rico King", "director", evidence="Official event page explicitly announces a Q&A with director Rico King."),
        claim("Nekai Foster", "film subject", category="film-subject", evidence="Official event page explicitly announces a Q&A with film subject Nekai Foster."),
    ],
)

screening(
    id="hot-docs-green-valley-director-q-and-a-2026-08-15",
    title="Green Valley — Q&A with director Morgan Tams",
    date="2026-08-15T15:30:00-04:00",
    source_url="https://boxoffice.hotdocs.ca/websales/pages/info.aspx?evtinfo=637211~cf285ddd-dacb-4f18-89b8-1252c6dcffa6",
    organizer="Hot Docs",
    venue="Hot Docs Ted Rogers Cinema",
    summary="Toronto screening followed by an in-person Q&A with director Morgan Tams.",
    claims=[claim("Morgan Tams", "director", evidence="Official event page explicitly announces a Q&A with director Morgan Tams.")],
)

screening(
    id="hot-docs-wild-inside-director-virtual-q-and-a-2026-08-16",
    title="Wild Inside — virtual Q&A with director Penny Lane",
    date="2026-08-16T15:45:00-04:00",
    source_url="https://boxoffice.hotdocs.ca/websales/pages/info.aspx?evtinfo=635533~cf285ddd-dacb-4f18-89b8-1252c6dcffa6",
    organizer="Hot Docs",
    venue="Hot Docs Ted Rogers Cinema",
    summary="In-person Toronto screening followed by a virtual Q&A with director Penny Lane.",
    claims=[claim("Penny Lane", "director", mode="remote", evidence="Official event page explicitly announces a virtual Q&A with director Penny Lane.")],
    mode="remote",
    director_status="confirmed-remote",
)

screening(
    id="hot-docs-antidiva-carole-pope-director-q-and-a-2026-08-16",
    title="Antidiva: The Carole Pope Confessions — Q&A with director Michelle Mama",
    date="2026-08-16T19:00:00-04:00",
    source_url="https://boxoffice.hotdocs.ca/websales/pages/info.aspx?epguid=a2104450-7e47-4369-a17d-c247570c3939&evtinfo=637214~cf285ddd-dacb-4f18-89b8-1252c6dcffa6&mdy=8%2F16%2F2026",
    organizer="Hot Docs",
    venue="Hot Docs Ted Rogers Cinema",
    summary="Toronto screening followed by an in-person Q&A with director Michelle Mama.",
    claims=[claim("Michelle Mama", "director", evidence="Official event page explicitly announces a Q&A with director Michelle Mama.")],
)

# The Revue Cinema.
screening(
    id="revue-withdrawal-director-q-and-a-2026-08-19",
    title="Withdrawal — Q&A with writer-director-editor Aaron Strand",
    date="2026-08-19T21:30:00-04:00",
    source_url="https://revuecinema.ca/films/revue-event-withdrawal-canadian-theatrical-premiere-with-director-in-attendance/",
    organizer="The Revue Cinema",
    venue="The Revue Cinema",
    summary="Canadian theatrical-premiere screening followed by a Q&A with writer, director, and editor Aaron Strand, moderated by Felicia Maroni.",
    claims=[
        claim("Aaron Strand", "writer, director, and editor", evidence="Official Revue page states director in attendance and names the Q&A participant."),
        claim("Felicia Maroni", "moderator", category="host-moderator", evidence="Official Revue page names the moderator."),
    ],
    categories=["director-filmmaker", "host-moderator"],
)

screening(
    id="revue-leonora-morning-light-directors-q-and-a-2026-09-14",
    title="Leonora in the Morning Light — Q&A with filmmakers Lena Vurma and Thor Klein",
    date="2026-09-14T18:30:00-04:00",
    source_url="https://revuecinema.ca/films/revue-event-leonora-in-the-morning-light-canadian-theatrical-premiere/",
    organizer="The Revue Cinema",
    venue="The Revue Cinema",
    summary="Canadian theatrical-premiere screening followed by a Q&A with filmmakers and directors Lena Vurma and Thor Klein.",
    claims=[
        claim("Lena Vurma", "filmmaker and director", evidence="Official Revue page explicitly announces the filmmaker Q&A."),
        claim("Thor Klein", "filmmaker and director", evidence="Official Revue page explicitly announces the filmmaker Q&A."),
    ],
)

screening(
    id="revue-cash-cow-director-producer-q-and-a-2026-09-15",
    title="Cash Cow — Q&A with director-star Matt Barats and producer-editor Whit Conway",
    date="2026-09-15T21:30:00-04:00",
    source_url="https://revuecinema.ca/films/stompbox-cash-cow-qa-with-director-star-matt-barats/",
    organizer="The Revue Cinema",
    venue="The Revue Cinema",
    summary="Screening followed by an in-person Q&A with director and star Matt Barats and producer and editor Whit Conway.",
    claims=[
        claim("Matt Barats", "director and performer", evidence="Official Revue page explicitly names the director-star as attending the Q&A."),
        claim("Whit Conway", "producer and editor", evidence="Official Revue page explicitly names the producer-editor as attending the Q&A."),
    ],
)

# Paradise Theatre / filmmaker-controlled announcement. The organizer-controlled
# source confirms this particular occurrence; the venue calendar confirms the run.
screening(
    id="paradise-lunar-sway-director-cast-q-and-a-2026-08-28",
    title="Lunar Sway — Q&A with director Nick Butler, Liza Weil, and Grace Glowicki",
    date="2026-08-28T20:30:00-04:00",
    source_url="https://www.instagram.com/p/Dbl9x_mlY1_/",
    source_id="lunar-sway-official",
    organizer="Lunar Sway film team",
    venue="Paradise Theatre",
    summary="Advance Toronto screening followed by a Q&A with director Nick Butler and performers Liza Weil and Grace Glowicki.",
    categories=["director-filmmaker", "cast-crew"],
    claims=[
        claim("Nick Butler", "director", evidence="Organizer-controlled film announcement names Nick Butler for the August 28 Q&A."),
        claim("Liza Weil", "performer", category="cast-crew", evidence="Organizer-controlled film announcement names Liza Weil for the August 28 Q&A."),
        claim("Grace Glowicki", "performer", category="cast-crew", evidence="Organizer-controlled film announcement names Grace Glowicki for the August 28 Q&A."),
    ],
    source_notes="Organizer-controlled film announcement reviewed alongside Paradise Theatre's official coming-soon schedule on 2026-08-13.",
)

# The occurrence confirms filmmakers as a group but does not prove the named
# director's attendance. It is retained instead of being omitted.
screening(
    id="hot-docs-bootstraps-filmmaker-special-guest-q-and-a-2026-08-22",
    title="Bootstraps — Q&A with filmmakers and special guests",
    date="2026-08-22T18:00:00-04:00",
    source_url="https://boxoffice.hotdocs.ca/websales/pages/info.aspx?epguid=a2104450-7e47-4369-a17d-c247570c3939&evtinfo=645918~cf285ddd-dacb-4f18-89b8-1252c6dcffa6&mdy=8%2F22%2F2026",
    organizer="Hot Docs / Basic Income Earth Network Congress",
    venue="Hot Docs Ted Rogers Cinema",
    summary="Documentary screening and closing reception followed by a Q&A with filmmakers and special guests. The page credits director Deia Schlosberg but does not confirm that she will attend.",
    categories=["director-filmmaker", "identity-pending"],
    claims=[
        claim("Filmmakers and special guests", "Q&A participants", status="identity-unannounced", evidence="Official event page confirms filmmakers and special guests but does not name them."),
        claim("Deia Schlosberg", "director", status="attendance-unconfirmed", mode="unknown", scope="discussion", evidence="Official page confirms the directing credit, not attendance."),
    ],
    director_status="unconfirmed",
)

cross_tags = {
    "soulpepper-medusa-talkback-2026-07-08": {
        "subjects": ["Creator-Present"],
        "topics": ["creator-present"],
        "presence_categories": ["production-participants", "identity-pending"],
    },
}

exclusions = [
    {
        "title": "Everyone Is Lying to You for Money — Hot Docs, August 15, 2026",
        "reason": "The current official event page does not explicitly confirm a Q&A or creator attendance; social snippets were not promoted over the occurrence page.",
    },
    {
        "title": "Stale TIFF event and legacy programme pages",
        "reason": "Search results surfaced older editions under live URLs. They were excluded rather than misdated as 2026 occurrences.",
    },
    {
        "title": "General film credits without attendance language",
        "reason": "A director, writer, producer, or cast credit proves role only and never proves presence at a screening or discussion.",
    },
    {
        "title": "Broad festival calendars without occurrence-level participants",
        "reason": "Retained as source watches for later programme releases; no generic festival span was converted into a director-present claim.",
    },
]

assert len(records) == 9, f"Expected 9 Set 7 records, found {len(records)}"
apply_import(root=ROOT, config=CONFIG, records=records, cross_tags=cross_tags, exclusions=exclusions)
