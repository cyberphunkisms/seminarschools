#!/usr/bin/env python3
"""Idempotently import Polymythcal Set 11 — Participatory Cultural Events."""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import collections, json, re

from polymythcal_set_import_common import make_record as R, make_watch as W, apply_import

ROOT=Path(__file__).resolve().parents[1]
TZ=ZoneInfo("America/Toronto")
CONFIG={
 "src":"manual-polymythcal-participatory-cultural-set11-2026-08-14",
 "research_set":"11-Participatory-Cultural-Events",
 "checked":"2026-08-14T22:00:00-04:00",
 "domain_label":"Participatory Culture",
 "topic_slug":"participatory-culture",
 "set_tag":"Set 11",
 "entry_family":"participatory-cultural",
 "field_name":"participatory_formats",
 "metadata_key":"polymythcal_participatory_cultural_set11_update_2026_08_14",
 "sources_metadata_key":"polymythcal_participatory_cultural_set11_2026_08_14",
 "research_filename":"polymythcal-research-set-11-participatory-cultural-2026-08-14.json",
 "research_dirname":"polymythcal-set11-participatory-cultural-2026-08-14",
 "ledger_schema":"polymythcal-participatory-cultural-set11-research-ledger-v1",
 "cl_ids":[f"CL-WEB-{n}" for n in range(260,268)],
 "ledger_notes":[
  "A participatory event requires an evidenced audience role beyond passive attendance.",
  "Series parents and dated child occurrences remain separate and linked.",
  "Drop-in, registration, skill level, facilitation, access, and participation mode are independent fields.",
  "A recurring venue or general program page does not prove an unlisted occurrence.",
  "Annual watches remain qualified; no date is projected as confirmed.",
 ]
}
records=[]

def iso(day:str, clock:str="00:00")->str:
 return datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=TZ).isoformat(timespec="seconds")

def add(*,id,title,day,source_url,organizer,summary,formats,type="community",clock="00:00",end_day=None,end_clock=None,
        venue,city="Toronto",province="Ontario",country="Canada",confirmed=True,time_precision="exact",date_precision="exact",
        parent_id=None,series_title=None,series_role=None,participation_mode="co-creation",participation_roles=None,
        facilitation_status="facilitated",skill_level="all-levels",drop_in_status="unknown",registration_required=None,
        public_access_status="public",audience_scope="public",participation_required=True,interaction_format=None,
        access_route="official event page",source_id=None,source_quality="official-or-institutional",source_notes=None,
        age_band=None,education_levels=None,source_inconsistency=None,qualification_reasons=None,recurrence_note=None,
        social_functions=None,tags=None,extra=None):
 payload={
  "participation_mode":participation_mode,
  "participation_roles":participation_roles or ["participant"],
  "facilitation_status":facilitation_status,
  "skill_level":skill_level,
  "drop_in_status":drop_in_status,
  "registration_required":registration_required,
  "public_access_status":public_access_status,
  "audience_scope":audience_scope,
  "participation_required":participation_required,
  "interaction_format":interaction_format or participation_mode,
  "event_format":"in-person" if city!="Online" else "online",
  "participation_evidence":summary,
  "social_functions":social_functions or ["community participation","skill sharing","social connection"],
 }
 if extra: payload.update(extra)
 rec=R(config=CONFIG,id=id,title=title,date=iso(day,clock),end_date=iso(end_day,end_clock or clock) if end_day else None,
   source_url=source_url,organizer=organizer,summary=summary,subfields=formats,record_kind="event",type=type,
   confirmed=confirmed,date_precision=date_precision,time_precision=time_precision,source_id=source_id,age_band=age_band,
   education_levels=education_levels,city=city,province=province,country=country,venue=venue,timezone="America/Toronto",
   participation_unit="individual or small group",access_route=access_route,parent_id=parent_id,series_title=series_title,
   series_role=series_role,source_inconsistency=source_inconsistency,source_notes=source_notes,
   qualification_reasons=qualification_reasons,recurrence_note=recurrence_note,tags=tags,extra=payload)
 rec["source_quality"]=source_quality
 records.append(rec)
 return rec

def add_watch(*,id,title,marker,source_url,organizer,summary,formats,type="community",venue="Location pending",city="Toronto",
              participation_mode="co-creation",audience_scope="public",extra=None):
 payload={
  "participation_mode":participation_mode,"participation_roles":["participant"],"facilitation_status":"programme-confirmed-date-pending",
  "skill_level":"all-levels","drop_in_status":"unconfirmed","registration_required":None,"public_access_status":"public-access-unconfirmed",
  "audience_scope":audience_scope,"participation_required":True,"interaction_format":participation_mode,"event_format":"in-person",
  "participation_evidence":summary,"social_functions":["community participation","skill sharing","social connection"],
  "attendance_confirmed":False,
 }
 if extra: payload.update(extra)
 rec=W(config=CONFIG,id=id,title=title,marker=iso(marker),source_url=source_url,organizer=organizer,summary=summary,
  subfields=formats,type=type,record_kind="event",venue=venue,city=city,province="Ontario",country="Canada",
  participation_unit="individual or team",access_route="official programme page",extra=payload)
 records.append(rec);return rec

# ------------------------------------------------------------------
# Repair Cafés: participant works with volunteer fixers rather than handing off.
# ------------------------------------------------------------------
mid_url="https://repaircafetoronto.ca/rc-events/mid-scarborough-repair-hub-2025-2/"
add(id="repair-cafe-mid-scarborough-fall-2026",title="Mid-Scarborough Repair Hub — fall 2026 series",day="2026-09-12",end_day="2026-11-07",source_url=mid_url,organizer="Repair Café Toronto",summary="Free first-come repair sessions where visitors work alongside volunteer fixers on household objects; the official series lists three fall dates.",formats=["maker-repair-craft"],type="workshop",clock="11:30",end_clock="14:30",venue="Mid-Scarborough Hub",series_role="parent",participation_mode="repair-with-mentor",participation_roles=["visitor-repairer","volunteer-fixer"],drop_in_status="drop-in",registration_required=False,recurrence_note="September 12, October 3, and November 7, 2026.",social_functions=["repair knowledge transmission","waste reduction","mutual aid"])
for d in ["2026-09-12","2026-10-03","2026-11-07"]:
 add(id=f"repair-cafe-mid-scarborough-{d}",title=f"Mid-Scarborough Repair Hub — {d}",day=d,source_url=mid_url,organizer="Repair Café Toronto",summary="Visitors bring repairable household objects and work with volunteer fixers; repair is not guaranteed and intake is first-come.",formats=["maker-repair-craft"],type="workshop",clock="11:30",end_day=d,end_clock="14:30",venue="Mid-Scarborough Hub",parent_id="repair-cafe-mid-scarborough-fall-2026",series_title="Mid-Scarborough Repair Hub — fall 2026 series",series_role="child",participation_mode="repair-with-mentor",participation_roles=["visitor-repairer","volunteer-fixer"],drop_in_status="drop-in",registration_required=False,social_functions=["repair knowledge transmission","waste reduction","mutual aid"])
reuse_url="https://repaircafetoronto.ca/rc-events/creative-reuse-toronto-storefront-drop-in-repair-events-2025-2/"
reuse_dates=["2026-08-16","2026-08-23","2026-08-30","2026-09-13","2026-09-20","2026-09-27","2026-10-04","2026-10-18","2026-10-25","2026-11-01","2026-11-08","2026-11-15","2026-11-22","2026-11-29","2026-12-06"]
add(id="repair-cafe-creative-reuse-fall-2026",title="Creative Reuse Toronto drop-in repair series — fall 2026",day=reuse_dates[0],end_day=reuse_dates[-1],source_url=reuse_url,organizer="Repair Café Toronto",summary="Recurring storefront repair sessions for small appliances, electronics, clothing, jewellery, and small furniture; participants work with volunteer fixers.",formats=["maker-repair-craft"],type="workshop",clock="12:00",end_clock="16:00",venue="Creative Reuse Toronto storefront",series_role="parent",participation_mode="repair-with-mentor",participation_roles=["visitor-repairer","volunteer-fixer"],drop_in_status="drop-in",registration_required=False,recurrence_note="Fifteen official Sunday dates from August 16 through December 6, 2026; intake normally ends at 3:00 p.m.",social_functions=["repair knowledge transmission","waste reduction","mutual aid"])
for d in reuse_dates:
 add(id=f"repair-cafe-creative-reuse-{d}",title=f"Creative Reuse Toronto drop-in repair — {d}",day=d,source_url=reuse_url,organizer="Repair Café Toronto",summary="A free drop-in repair session where visitors work alongside volunteer fixers; item intake normally ends at 3:00 p.m.",formats=["maker-repair-craft"],type="workshop",clock="12:00",end_day=d,end_clock="16:00",venue="Creative Reuse Toronto storefront",parent_id="repair-cafe-creative-reuse-fall-2026",series_title="Creative Reuse Toronto drop-in repair series — fall 2026",series_role="child",participation_mode="repair-with-mentor",participation_roles=["visitor-repairer","volunteer-fixer"],drop_in_status="drop-in",registration_required=False,social_functions=["repair knowledge transmission","waste reduction","mutual aid"])

# ------------------------------------------------------------------
# Improv drop-ins.
# ------------------------------------------------------------------
baddog_url="https://baddogtheatre.com/improv-drop-ins"
baddog_dates=["2026-08-15","2026-08-17","2026-08-24","2026-08-29","2026-09-14","2026-09-21","2026-09-28","2026-10-05","2026-10-19","2026-10-26"]
add(id="bad-dog-improv-drop-ins-fall-2026",title="Bad Dog Theatre improv drop-ins — fall 2026",day=baddog_dates[0],end_day=baddog_dates[-1],source_url=baddog_url,organizer="Bad Dog Theatre",summary="Open improv drop-ins invite participants to practise scenes and games with a facilitator; the studio page publishes ten fall dates.",formats=["improv-theatre"],type="workshop",clock="18:00",end_clock="20:00",venue="Bad Dog Comedy Theatre Studio",series_role="parent",participation_mode="guided-improvisation",participation_roles=["improviser"],drop_in_status="drop-in",registration_required=False,recurrence_note="Ten official sessions from August 15 through October 26, 2026.",source_inconsistency="The main studio is reached by stairs and is not wheelchair accessible; the organizer asks patrons to contact it about an accessible beginner option.",social_functions=["collective improvisation","performance practice","peer learning"])
for d in baddog_dates:
 add(id=f"bad-dog-improv-drop-in-{d}",title=f"Bad Dog Theatre improv drop-in — {d}",day=d,source_url=baddog_url,organizer="Bad Dog Theatre",summary="A facilitated two-hour improv drop-in in which attendees actively practise games and scenes.",formats=["improv-theatre"],type="workshop",clock="18:00",end_day=d,end_clock="20:00",venue="Bad Dog Comedy Theatre Studio",parent_id="bad-dog-improv-drop-ins-fall-2026",series_title="Bad Dog Theatre improv drop-ins — fall 2026",series_role="child",participation_mode="guided-improvisation",participation_roles=["improviser"],drop_in_status="drop-in",registration_required=False,source_inconsistency="The main studio is reached by stairs and is not wheelchair accessible; contact the organizer about an accessible beginner option.",social_functions=["collective improvisation","performance practice","peer learning"])

# ------------------------------------------------------------------
# Social dance: free instruction plus public dancing.
# ------------------------------------------------------------------
dance_url="https://harbourfrontcentre.com/series/dancing-on-the-square/"
add(id="harbourfront-dancing-on-square-2026",title="Dancing on the Square 2026",day="2026-07-15",end_day="2026-09-02",source_url=dance_url,organizer="Harbourfront Centre",summary="A free Wednesday social-dance series combining instruction with communal dancing; all experience levels are welcomed.",formats=["social-dance"],type="performance",clock="19:00",end_clock="21:00",venue="Harbourfront Centre Public Square",series_role="parent",participation_mode="social-dance-class-and-dance",participation_roles=["learner","social-dancer"],drop_in_status="registered-or-walk-up",registration_required=True,public_access_status="free-public-registration",recurrence_note="Weekly from July 15 through September 2, 2026.",social_functions=["embodied cultural transmission","public sociability","intergenerational participation"])
for d,title in [("2026-08-19","Cajun dance with Tom and Myra"),("2026-08-26","Lindy Hop with Gabrielle and Charlie"),("2026-09-02","Scottish Country Dance with the Royal Scottish Country Dance Society")]:
 add(id=f"harbourfront-dancing-on-square-{d}",title=f"Dancing on the Square — {title}",day=d,source_url=dance_url,organizer="Harbourfront Centre",summary=f"Free all-levels instruction and social dancing: {title}.",formats=["social-dance"],type="performance",clock="19:00",end_day=d,end_clock="21:00",venue="Harbourfront Centre Public Square",parent_id="harbourfront-dancing-on-square-2026",series_title="Dancing on the Square 2026",series_role="child",participation_mode="social-dance-class-and-dance",participation_roles=["learner","social-dancer"],drop_in_status="registered-or-walk-up",registration_required=True,public_access_status="free-public-registration",social_functions=["embodied cultural transmission","public sociability","intergenerational participation"])
add_watch(id="toronto-contra-dance-2026-27-season",title="Toronto Contra Dance 2026–27 season",marker="2026-09-01",source_url="https://www.tcdance.org/",organizer="Toronto Contra Dance",summary="The organizer confirms a return for the 2026–27 season and normally dances on second and fourth Saturdays, but exact dates had not yet been posted at review time.",formats=["social-dance"],type="performance",venue="Toronto venue pending",participation_mode="social-dance",audience_scope="public; beginners and experienced dancers",extra={"recurrence_note":"Typical format: beginner introduction 7:00–7:30 p.m.; dance 7:30–10:30 p.m."})

# ------------------------------------------------------------------
# Toronto Public Library participatory writing, comics, language, reading, and games.
# ------------------------------------------------------------------
tpl_art_url="https://tpl.ca/programs-and-classes/featured/artists-in-the-library/"
story_dates=["2026-09-23","2026-09-30","2026-10-07","2026-10-14","2026-10-21","2026-10-28"]
add(id="tpl-story-planet-comic-lab-fall-2026",title="Story Planet Comic Lab — fall 2026",day=story_dates[0],end_day=story_dates[-1],source_url=tpl_art_url,organizer="Toronto Public Library and Story Planet",summary="A six-session comic lab led by professional creators for school-age participants, combining story development, drawing, and collaborative making.",formats=["zine-comics","public-art-making"],type="workshop",clock="16:00",end_clock="17:30",venue="Toronto Public Library — Evelyn Gregory branch",series_role="parent",participation_mode="guided-comic-making",participation_roles=["young-comic-creator"],drop_in_status="series-registration",registration_required=True,audience_scope="children ages 6–12",age_band="Ages 6-12",education_levels=["elementary"],recurrence_note="Six Wednesdays from September 23 through October 28, 2026.",social_functions=["creative authorship","visual storytelling","peer learning"])
for d in story_dates:
 add(id=f"tpl-story-planet-comic-lab-{d}",title=f"Story Planet Comic Lab — session {story_dates.index(d)+1}",day=d,source_url=tpl_art_url,organizer="Toronto Public Library and Story Planet",summary="A hands-on comic-making session for ages 6–12 with professional facilitators.",formats=["zine-comics","public-art-making"],type="workshop",clock="16:00",end_day=d,end_clock="17:30",venue="Toronto Public Library — Evelyn Gregory branch",parent_id="tpl-story-planet-comic-lab-fall-2026",series_title="Story Planet Comic Lab — fall 2026",series_role="child",participation_mode="guided-comic-making",participation_roles=["young-comic-creator"],drop_in_status="series-registration",registration_required=True,audience_scope="children ages 6–12",age_band="Ages 6-12",education_levels=["elementary"],social_functions=["creative authorship","visual storytelling","peer learning"])

conversation_events=[
 ("tpl-english-conversation-fort-york-2026-08-22","English Conversation Circle — Fort York","2026-08-22","10:30","11:30","https://tpl.bibliocommons.com/v2/events/6a3acf4a9571053ed63c4385","Toronto Public Library — Fort York branch","drop-in"),
 ("tpl-english-conversation-trl-2026-09-23","English Conversation Circle — Toronto Reference Library","2026-09-23","15:00","16:30","https://tpl.bibliocommons.com/v2/events/6a1f05482ea730c17ab3a964","Toronto Reference Library","registration"),
 ("tpl-english-conversation-parliament-2026-10-09","English Conversation Circle — Parliament Street","2026-10-09","19:00","20:00","https://tpl.bibliocommons.com/v2/events/6a18d2edf56bd86e00b2e5b3","Toronto Public Library — Parliament Street branch","drop-in"),
 ("tpl-english-conversation-northern-2026-10-22","English Conversation Circle — Northern District","2026-10-22","14:00","15:00","https://tpl.bibliocommons.com/v2/events/697bad20491b809c6f1625ad","Toronto Public Library — Northern District branch","unknown"),
 ("tpl-english-conversation-lillian-smith-2026-11-03","English Conversation Circle — Lillian H. Smith","2026-11-03","14:00","15:00","https://tpl.bibliocommons.com/v2/events/6a5bcff70ed7b4521ed65faf","Toronto Public Library — Lillian H. Smith branch","unknown"),
]
for id,title,d,start,end,url,venue,status in conversation_events:
 add(id=id,title=title,day=d,source_url=url,organizer="Toronto Public Library",summary="A facilitated English conversation circle for practising everyday speaking and listening; it is not a formal language class.",formats=["conversation-language"],type="discussion-group",clock=start,end_day=d,end_clock=end,venue=venue,participation_mode="facilitated-conversation",participation_roles=["language-learner","conversation-partner"],drop_in_status=status,registration_required=True if status=="registration" else False if status=="drop-in" else None,audience_scope="adult English-language learners",social_functions=["language practice","newcomer inclusion","peer support"])

east_url="https://tpl.bibliocommons.com/v2/events/696a4ea9491b809c6f1335ca"
east_dates=[("2026-09-23","https://tpl.bibliocommons.com/v2/events/696a4ea9491b809c6f1335ca"),("2026-10-28","https://tpl.bibliocommons.com/v2/events/696a4ea9491b809c6f1335cb"),("2026-11-25",east_url)]
add(id="tpl-east-end-writers-group-fall-2026",title="East End Writers’ Group — fall 2026",day=east_dates[0][0],end_day=east_dates[-1][0],source_url=east_url,organizer="Toronto Public Library",summary="A recurring peer writing group where participants share work, discuss craft, and support continuing writing practice.",formats=["writing-poetry-circle"],type="discussion-group",clock="18:30",end_clock="20:30",venue="Toronto Public Library — east-end branch",series_role="parent",participation_mode="peer-writing-circle",participation_roles=["writer","peer-reader"],drop_in_status="drop-in-or-registration",registration_required=None,recurrence_note="September 23, October 28, and November 25, 2026.",social_functions=["peer critique","creative continuity","literary community"])
for d,url in east_dates:
 add(id=f"tpl-east-end-writers-group-{d}",title=f"East End Writers’ Group — {d}",day=d,source_url=url,organizer="Toronto Public Library",summary="A peer writing-circle session for sharing work and discussing writing practice.",formats=["writing-poetry-circle"],type="discussion-group",clock="18:30",end_day=d,end_clock="20:30",venue="Toronto Public Library — east-end branch",parent_id="tpl-east-end-writers-group-fall-2026",series_title="East End Writers’ Group — fall 2026",series_role="child",participation_mode="peer-writing-circle",participation_roles=["writer","peer-reader"],drop_in_status="drop-in-or-registration",registration_required=None,social_functions=["peer critique","creative continuity","literary community"])

poetry_dates=[("2026-11-13","https://tpl.bibliocommons.com/v2/events/69979982d34a4e759286487e"),("2026-12-11","https://tpl.bibliocommons.com/v2/events/69979982d34a4e759286487f")]
add(id="tpl-poetry-fridays-fall-2026",title="Poetry Fridays — fall 2026",day=poetry_dates[0][0],end_day=poetry_dates[-1][0],source_url=poetry_dates[0][1],organizer="Toronto Public Library",summary="A recurring poetry gathering centred on reading, discussing, and sharing poems.",formats=["writing-poetry-circle","open-mic-stage"],type="reading",clock="15:30",end_clock="16:30",venue="Toronto Public Library",series_role="parent",participation_mode="poetry-sharing-circle",participation_roles=["reader","poet","listener-discussant"],drop_in_status="drop-in",registration_required=False,recurrence_note="November 13 and December 11, 2026.",social_functions=["poetic exchange","public voice","literary community"])
for d,url in poetry_dates:
 add(id=f"tpl-poetry-fridays-{d}",title=f"Poetry Fridays — {d}",day=d,source_url=url,organizer="Toronto Public Library",summary="Participants read, discuss, or share poetry in a facilitated library gathering.",formats=["writing-poetry-circle","open-mic-stage"],type="reading",clock="15:30",end_day=d,end_clock="16:30",venue="Toronto Public Library",parent_id="tpl-poetry-fridays-fall-2026",series_title="Poetry Fridays — fall 2026",series_role="child",participation_mode="poetry-sharing-circle",participation_roles=["reader","poet","listener-discussant"],drop_in_status="drop-in",registration_required=False,social_functions=["poetic exchange","public voice","literary community"])

weston_url="https://tpl.bibliocommons.com/v2/events/693f0f5294297d36009feee9"
weston_dates=["2026-08-15","2026-09-19","2026-10-17","2026-11-21","2026-12-19"]
add(id="tpl-weston-book-club-fall-2026",title="Weston Book Club — fall 2026",day=weston_dates[0],end_day=weston_dates[-1],source_url=weston_url,organizer="Toronto Public Library",summary="A monthly facilitated book discussion with advance registration.",formats=["book-reading-group"],type="reading-group",clock="10:00",end_clock="11:00",venue="Toronto Public Library — Weston branch",series_role="parent",participation_mode="book-discussion",participation_roles=["reader","discussant"],drop_in_status="registration",registration_required=True,recurrence_note="August 15, September 19, October 17, November 21, and December 19, 2026.",social_functions=["collective reading","interpretive discussion","neighbourhood sociability"])
for d in weston_dates:
 url="https://tpl.bibliocommons.com/v2/events/693f0f5294297d36009feeec" if d=="2026-12-19" else weston_url
 add(id=f"tpl-weston-book-club-{d}",title=f"Weston Book Club — {d}",day=d,source_url=url,organizer="Toronto Public Library",summary="A one-hour registered book-club discussion at the Weston branch.",formats=["book-reading-group"],type="reading-group",clock="10:00",end_day=d,end_clock="11:00",venue="Toronto Public Library — Weston branch",parent_id="tpl-weston-book-club-fall-2026",series_title="Weston Book Club — fall 2026",series_role="child",participation_mode="book-discussion",participation_roles=["reader","discussant"],drop_in_status="registration",registration_required=True,social_functions=["collective reading","interpretive discussion","neighbourhood sociability"])

book_events=[
 ("tpl-nonfiction-book-club-thinking-fast-slow-2026-10-13","Nonfiction Book Club: Thinking, Fast and Slow","2026-10-13","19:00","20:00","https://tpl.bibliocommons.com/v2/events/6a4eaf9a71ef13620051875a","Online","Online",True),
 ("tpl-parkdale-2slgbtq-book-club-2026-10-28","Parkdale 2SLGBTQ+ Book Club — October","2026-10-28","18:30","20:00","https://tpl.bibliocommons.com/v2/events?programs=68b054f3101e8736007ad738","Toronto Public Library — Parkdale branch","Toronto",None),
 ("tpl-parkdale-2slgbtq-book-club-2026-11-25","Parkdale 2SLGBTQ+ Book Club — November","2026-11-25","18:30","20:00","https://tpl.bibliocommons.com/v2/events?programs=68b054f3101e8736007ad738","Toronto Public Library — Parkdale branch","Toronto",None),
 ("tpl-danforth-book-club-2026-10-22","Danforth Book Club — October","2026-10-22","19:00","20:00","https://tpl.bibliocommons.com/v2/events?locations=DA","Toronto Public Library — Danforth/Coxwell branch","Toronto",None),
 ("tpl-long-branch-book-club-2026-09-29","Long Branch Book Club — September","2026-09-29","19:00","20:00","https://tpl.bibliocommons.com/v2/events?locations=LB","Toronto Public Library — Long Branch branch","Toronto",None),
 ("tpl-long-branch-polish-book-club-2026-10-07","Long Branch Polish Book Club — October","2026-10-07","15:00","16:30","https://tpl.bibliocommons.com/v2/events?locations=LB","Toronto Public Library — Long Branch branch","Toronto",None),
 ("tpl-fairview-book-club-2026-10-06","Fairview Book Club — October","2026-10-06","13:00","14:30","https://tpl.bibliocommons.com/v2/events?locations=FV","Toronto Public Library — Fairview branch","Toronto",None),
 ("tpl-reading-challenge-fall-book-talk-2026-10-29","Reading Challenge Fall Book Talk","2026-10-29","18:30","19:30","https://tpl.bibliocommons.com/v2/events?programs=reading-challenge","Toronto Public Library","Toronto",None),
 ("tpl-reading-challenge-book-club-2026-11-09","Reading Challenge Book Club","2026-11-09","19:00","20:00","https://tpl.bibliocommons.com/v2/events?programs=reading-challenge","Toronto Public Library","Toronto",None),
]
for id,title,d,start,end,url,venue,city,reg in book_events:
 add(id=id,title=title,day=d,source_url=url,organizer="Toronto Public Library",summary="A participatory book discussion in which readers interpret and discuss a selected work together.",formats=["book-reading-group"],type="reading-group",clock=start,end_day=d,end_clock=end,venue=venue,city=city,province="" if city=="Online" else "Ontario",country="Global" if city=="Online" else "Canada",participation_mode="book-discussion",participation_roles=["reader","discussant"],drop_in_status="registration" if reg else "unknown",registration_required=reg,social_functions=["collective reading","interpretive discussion","community formation"])

board_events=[
 ("tpl-board-game-meetup-deer-park-2026-08-17","Board Game Meet-Up — Deer Park","2026-08-17","18:00","20:00","https://tpl.bibliocommons.com/v2/events/69efabccfca21471b7f07552","Toronto Public Library — Deer Park branch","public"),
 ("tpl-game-on-mimico-2026-08-22","Game On! Board Game Playtime — Mimico Centennial","2026-08-22","09:00","16:30","https://tpl.bibliocommons.com/v2/events/69c42a5abf48d63c596cc23f","Toronto Public Library — Mimico Centennial branch","children and families"),
]
for id,title,d,start,end,url,venue,audience in board_events:
 add(id=id,title=title,day=d,source_url=url,organizer="Toronto Public Library",summary="A library board-game session built around shared play rather than passive spectatorship.",formats=["board-tabletop-games"],type="community",clock=start,end_day=d,end_clock=end,venue=venue,participation_mode="shared-game-play",participation_roles=["player"],drop_in_status="drop-in",registration_required=False,audience_scope=audience,participation_required=True,social_functions=["rule-governed play","intergenerational sociability","informal learning"])

add(id="tpl-culture-days-2026",title="Toronto Public Library Culture Days 2026",day="2026-09-18",end_day="2026-10-04",source_url="https://tpl.ca/programs-and-classes/featured/culture-days/",organizer="Toronto Public Library",summary="TPL confirms its Culture Days period; individual participatory programs were still forthcoming at review time, so the parent remains discoverable without invented child events.",formats=["public-art-making"],type="festival",venue="Toronto Public Library branches",series_role="parent",participation_mode="programme-varies",participation_roles=["participant"],facilitation_status="programme-forthcoming",drop_in_status="unconfirmed",registration_required=None,public_access_status="public-programme-details-pending",time_precision="unknown",qualification_reasons=["time-unconfirmed","registration-unconfirmed"],recurrence_note="September 18 through October 4, 2026; child programme forthcoming.",social_functions=["public cultural participation","library-based community formation"])

# ------------------------------------------------------------------
# Harbourfront craft workshops and Artists in the Library.
# ------------------------------------------------------------------
hc_url="https://harbourfrontcentre.com/whats-on/"
hc_workshops=[
 ("harbourfront-shibori-silk-scarf-2026-08-16","Make Your Own: Shibori Dyed Silk Scarf","2026-08-16","13:30"),
 ("harbourfront-copperware-making-2026-08-17","Introduction to Copperware Making","2026-08-17","13:00"),
 ("harbourfront-summer-ornament-2026-08-18","Make Your Own: Summer Ornament","2026-08-18","18:30"),
 ("harbourfront-embroidery-101-2026-08-19","Take a Dot for a Walk — Embroidery 101","2026-08-19","18:00"),
 ("harbourfront-ceramic-planters-2026-08-20","Ceramic Planters, Plates and Palettes","2026-08-20","18:00"),
 ("harbourfront-summer-ornament-2026-08-20","Make Your Own: Summer Ornament — August 20","2026-08-20","18:30"),
 ("harbourfront-summer-ornament-2026-08-25","Make Your Own: Summer Ornament — August 25","2026-08-25","18:30"),
 ("harbourfront-glass-blowing-weekend-2026-08-28","Introduction to Glass Blowing Weekend","2026-08-28","18:30"),
 ("harbourfront-glass-fusing-101-2026-08-29","Glass Fusing 101","2026-08-29","12:00"),
 ("harbourfront-ceramic-planters-2026-08-29","Ceramic Planters, Plates and Palettes — August 29","2026-08-29","13:00"),
 ("harbourfront-glass-blowing-weekend-2026-09-04","Introduction to Glass Blowing Weekend — September 4","2026-09-04","18:30"),
]
for id,title,d,start in hc_workshops:
 add(id=id,title=title,day=d,source_url=hc_url,organizer="Harbourfront Centre",summary="A hands-on craft workshop listed by Harbourfront Centre; participants make an object with guided instruction.",formats=["maker-repair-craft","public-art-making"],type="workshop",clock=start,venue="Harbourfront Centre",participation_mode="guided-making",participation_roles=["maker","learner"],drop_in_status="registration",registration_required=True,public_access_status="ticketed-public",time_precision="exact",social_functions=["craft knowledge transmission","material experimentation","creative agency"])

for id,title,d,clock in [
 ("tpl-artists-responsive-creation-2026-09-10","Responsive Creation","2026-09-10","00:00"),
 ("tpl-artists-botanical-photography-sunprints-2026-09-12","Botanical Photography and Sunprints","2026-09-12","00:00"),
 ("tpl-artists-hidden-rivers-2026-09-14","Hidden Rivers","2026-09-14","00:00"),
 ("tpl-artists-soundscape-2026-09-17","Soundscape","2026-09-17","00:00"),
]:
 add(id=id,title=title,day=d,source_url=tpl_art_url,organizer="Toronto Public Library — Artists in the Library",summary="An Artists in the Library participatory arts program; the official featured page confirms the date and hands-on creative format.",formats=["public-art-making"],type="workshop",clock=clock,venue="Toronto Public Library branch listed by organizer",participation_mode="guided-art-making",participation_roles=["participant-maker"],drop_in_status="check-official-page",registration_required=None,public_access_status="public",time_precision="unknown",qualification_reasons=["time-unconfirmed","registration-unconfirmed"],social_functions=["public art participation","artist-community exchange","creative learning"])

# ------------------------------------------------------------------
# Zines, creator fairs, storytelling, poetry, open stages, and jams.
# ------------------------------------------------------------------
add(id="zine-dream-16-2026",title="Zine Dream 16",day="2026-08-15",source_url="https://zinedream.com/",organizer="Zine Dream",summary="An annual small-press art fair where zinesters, artists, and readers exchange self-published work and sustain an independent publishing community.",formats=["zine-comics"],type="festival",clock="11:00",end_day="2026-08-15",end_clock="17:00",venue="Parkdale Hall",participation_mode="small-press-fair",participation_roles=["zinester","artist","reader","buyer"],drop_in_status="drop-in",registration_required=False,public_access_status="public",social_functions=["independent publishing","peer distribution","counterpublic formation"])
add(id="pin-patch-show-2026",title="Pin + Patch Show 2026",day="2026-09-19",source_url="https://www.pinandpatchshow.com/",organizer="Pin + Patch Show",summary="A free creator market centred on pins, patches, small-edition art, and direct exchange between makers and visitors.",formats=["zine-comics","maker-repair-craft"],type="festival",clock="10:00",end_day="2026-09-19",end_clock="17:00",venue="Parkdale Hall",participation_mode="creator-fair",participation_roles=["maker","vendor","collector","visitor"],drop_in_status="drop-in",registration_required=False,public_access_status="free-public",social_functions=["maker exchange","micro-enterprise","subcultural community"])
add(id="creator-convention-toronto-2026",title="Creator Convention Toronto 2026",day="2026-10-09",end_day="2026-10-11",source_url="https://www.cctoronto.org/",organizer="Creator Convention Toronto",summary="A three-day creator convention themed “Tech and Textiles: Wearable Art,” combining participatory making, fandom, and creative exchange.",formats=["maker-repair-craft","zine-comics","public-art-making"],type="festival",venue="Toronto venue listed by organizer",participation_mode="creator-convention",participation_roles=["maker","cosplayer","artist","participant"],drop_in_status="ticketed-or-registered",registration_required=True,public_access_status="ticketed-public",time_precision="unknown",social_functions=["maker community","fandom participation","skill exchange"])
add(id="ontario-east-fibre-fest-2026",title="Ontario East Fibre Fest 2026",day="2026-10-03",end_day="2026-10-04",source_url="https://www.ontarioeastfibrefest.ca/",organizer="Ontario East Fibre Fest",summary="A fibre-arts gathering with makers, demonstrations, and sheep-to-shawl activity, connecting visitors with regional craft processes.",formats=["maker-repair-craft"],type="festival",venue="Lombardy Agricultural Society Fairgrounds",city="Lombardy",participation_mode="craft-festival-and-demonstrations",participation_roles=["maker","demonstrator","learner","visitor"],drop_in_status="public",registration_required=False,public_access_status="public",time_precision="unknown",social_functions=["craft knowledge transmission","regional maker economy","material culture"])
add(id="toronto-zine-library-open-hours-2026",title="Toronto Zine Library weekly open hours",day="2026-08-18",end_day="2026-12-18",source_url="https://www.torontozinelibrary.org/hourslocation/",organizer="Toronto Zine Library",summary="Volunteer-run Tuesday and Friday open hours allow visitors to read, discuss, donate, and participate in Toronto’s zine culture.",formats=["zine-comics","book-reading-group"],type="community",clock="18:00",end_clock="20:00",venue="Tranzac Club",series_role="parent",participation_mode="community-library-open-hours",participation_roles=["reader","zinester","volunteer","donor"],drop_in_status="drop-in",registration_required=False,recurrence_note="Tuesdays and Fridays, 6:00–8:00 p.m.; individual dates are not duplicated indefinitely.",social_functions=["independent publishing archive","peer access","volunteer cultural infrastructure"])

add(id="toronto-poetry-festival-multilingual-readings-2026",title="Toronto Poetry Festival — multilingual community readings",day="2026-09-12",source_url="https://writersunion.ca/community-board/opportunity-to-read-poetry-in-your-own-language",organizer="Toronto Poetry Festival",summary="An open community festival where poets may read in their own language; participation is free and multilingual.",formats=["open-mic-stage","writing-poetry-circle"],type="festival",clock="11:00",end_day="2026-09-12",end_clock="17:00",venue="Taylor Creek Park",participation_mode="open-poetry-reading",participation_roles=["poet-reader","audience-participant"],drop_in_status="open-call-and-public",registration_required=None,public_access_status="free-public",source_quality="official-or-institutional",source_notes="Organizer opportunity posted on the Writers’ Union of Canada community board and reviewed August 14, 2026.",social_functions=["multilingual public voice","poetic exchange","diaspora visibility"])
add(id="tales-toronto-new-beginnings-2026-09-08",title="Tales Toronto: New Beginnings",day="2026-09-08",source_url="https://www.talestoronto.com/",organizer="Tales Toronto",summary="A monthly storytelling gathering featuring true and traditional stories, followed by audience conversation and opportunities to share.",formats=["storytelling"],type="performance",venue="Toronto venue listed by organizer",participation_mode="storytelling-and-discussion",participation_roles=["storyteller","listener-discussant"],drop_in_status="public",registration_required=None,time_precision="unknown",qualification_reasons=["time-unconfirmed","registration-unconfirmed"],social_functions=["oral tradition","collective memory","public narration"])

openmic_url="https://tranzac.org/events/toronto-cabaret-productions-open-mic-night-2026-08-21"
openmic_dates=[("2026-08-21","https://tranzac.org/events/toronto-cabaret-productions-open-mic-night-2026-08-21"),("2026-09-18","https://tranzac.org/events/toronto-cabaret-productions-open-mic-night-2026-09-18"),("2026-10-16",openmic_url)]
add(id="tranzac-cabaret-open-mic-fall-2026",title="Toronto Cabaret Productions Open Mic — fall 2026",day=openmic_dates[0][0],end_day=openmic_dates[-1][0],source_url=openmic_url,organizer="Toronto Cabaret Productions and Tranzac",summary="A recurring late-night open mic where performers sign up for stage time.",formats=["open-mic-stage"],type="performance",clock="22:30",end_clock="23:59",venue="Tranzac Club — Living Room",series_role="parent",participation_mode="open-stage-sign-up",participation_roles=["performer","audience"],drop_in_status="sign-up",registration_required=False,recurrence_note="August 21, September 18, and October 16, 2026; sessions continue after midnight.",social_functions=["open cultural production","performer development","nightlife community"])
for d,url in openmic_dates:
 add(id=f"tranzac-cabaret-open-mic-{d}",title=f"Toronto Cabaret Productions Open Mic — {d}",day=d,source_url=url,organizer="Toronto Cabaret Productions and Tranzac",summary="A late-night open mic with performer sign-up and public stage participation.",formats=["open-mic-stage"],type="performance",clock="22:30",end_day=d,end_clock="23:59",venue="Tranzac Club — Living Room",parent_id="tranzac-cabaret-open-mic-fall-2026",series_title="Toronto Cabaret Productions Open Mic — fall 2026",series_role="child",participation_mode="open-stage-sign-up",participation_roles=["performer","audience"],drop_in_status="sign-up",registration_required=False,source_notes="Official Tranzac event page; programme continues after midnight beyond the bounded same-day calendar display.",social_functions=["open cultural production","performer development","nightlife community"])
add(id="tranzac-open-stage-2026-09-14",title="Tranzac Open Stage",day="2026-09-14",source_url="https://tranzac.org/events/tranzac-open-stage-2026-09-14",organizer="Tranzac",summary="An all-welcome open stage with 6:30 p.m. sign-up and short performance slots in a stated safe-space format.",formats=["open-mic-stage"],type="performance",clock="18:30",end_day="2026-09-14",end_clock="21:30",venue="Tranzac Club",participation_mode="open-stage-sign-up",participation_roles=["performer","audience"],drop_in_status="same-day-sign-up",registration_required=False,source_inconsistency="The page’s machine-readable timestamp appears converted to UTC; the organizer’s prose states 6:30 p.m. local sign-up.",social_functions=["open cultural production","low-barrier performance","community norms"])

music_events=[
 ("tranzac-the-shed-2026-09-06","The Shed — tap and music jam","2026-09-06","19:30","22:00","https://tranzac.org/events/the-shed-2026-09-06","weekly improvisation reconnecting tap dancers and musicians","music-jam"),
 ("tranzac-sympathetic-string-band-2026-09-27","Sympathetic String Band & Friends","2026-09-27","19:30","21:30","https://tranzac.org/events/sympathetic-string-band-friends-2026-09-27","collaborative group improvisation","music-jam"),
 ("tranzac-caju-collective-2026-09-12","Caju Collective","2026-09-12","19:30","21:30","https://tranzac.org/events/caju-collective-2026-08-08","Toronto musicians perform and record with a house band","music-jam"),
 ("tranzac-toque-trad-jam-2026-08-16","ToQue Trad Québécois Jam — August","2026-08-16","16:00","18:00","https://tranzac.org/events/toque-trad-quebecois-jam-2026-05-17","participatory Québécois traditional-music jam","music-jam"),
 ("tranzac-toque-trad-jam-2026-09-20","ToQue Trad Québécois Jam — September","2026-09-20","16:00","18:00","https://tranzac.org/events/toque-trad-quebecois-jam-2026-05-17","participatory Québécois traditional-music jam","music-jam"),
]
for id,title,d,start,end,url,desc,fmt in music_events:
 add(id=id,title=title,day=d,source_url=url,organizer="Tranzac",summary=f"A {desc}; active music-making is central to the event.",formats=[fmt],type="performance",clock=start,end_day=d,end_clock=end,venue="Tranzac Club",participation_mode="collaborative-music-making",participation_roles=["musician","dancer" if "tap" in desc else "listener-participant"],drop_in_status="public",registration_required=False,source_inconsistency="Where the page exposes a UTC-like machine timestamp, the local time follows the organizer’s prose listing.",social_functions=["collective improvisation","traditional music transmission","peer musicianship"])

klez_url="https://tranzac.org/events/toronto-klezmer-society-epic-klezmer-jam-2026-07-15"
klez_dates=["2026-08-19","2026-09-16","2026-10-21","2026-11-18"]
add(id="tranzac-epic-klezmer-jam-fall-2026",title="Toronto Klezmer Society Epic Klezmer Jam — fall 2026",day=klez_dates[0],end_day=klez_dates[-1],source_url=klez_url,organizer="Toronto Klezmer Society and Tranzac",summary="A third-Wednesday participatory klezmer jam; musicians gather to play repertoire together.",formats=["music-jam"],type="performance",clock="21:30",end_clock="23:30",venue="Tranzac Club",series_role="parent",participation_mode="traditional-music-jam",participation_roles=["musician","listener-participant"],drop_in_status="public",registration_required=False,recurrence_note="Third Wednesdays: August 19, September 16, October 21, and November 18, 2026.",source_inconsistency="The official page’s rendered occurrence dates may show the following UTC calendar day; local recurrence follows the explicit third-Wednesday 9:30–11:30 p.m. description.",social_functions=["diasporic music transmission","collective improvisation","community continuity"])
for d in klez_dates:
 add(id=f"tranzac-epic-klezmer-jam-{d}",title=f"Toronto Klezmer Society Epic Klezmer Jam — {d}",day=d,source_url=klez_url,organizer="Toronto Klezmer Society and Tranzac",summary="A participatory klezmer jam for collective playing and listening.",formats=["music-jam"],type="performance",clock="21:30",end_day=d,end_clock="23:30",venue="Tranzac Club",parent_id="tranzac-epic-klezmer-jam-fall-2026",series_title="Toronto Klezmer Society Epic Klezmer Jam — fall 2026",series_role="child",participation_mode="traditional-music-jam",participation_roles=["musician","listener-participant"],drop_in_status="public",registration_required=False,source_inconsistency="Local date follows the organizer’s explicit third-Wednesday recurrence; machine timestamps may render the following UTC day.",social_functions=["diasporic music transmission","collective improvisation","community continuity"])

# ------------------------------------------------------------------
# Tabletop and game-making series/watches.
# ------------------------------------------------------------------
add(id="claringcon-2027",title="ClaringCon 2027",day="2027-04-30",end_day="2027-05-01",source_url="https://claringcon.ca/",organizer="ClaringCon",summary="A two-day tabletop convention with open play, a game library, tournaments, and a bring-and-buy area.",formats=["board-tabletop-games"],type="festival",venue="Bowmanville venue listed by organizer",city="Bowmanville",participation_mode="tabletop-convention",participation_roles=["player","game-master","designer","trader"],drop_in_status="ticketed-or-registered",registration_required=True,public_access_status="ticketed-public",time_precision="unknown",social_functions=["shared rule systems","hobby community","peer teaching"])
add_watch(id="tojam-2027-watch",title="TOJam 2027 — annual watch",marker="2027-05-01",source_url="https://www.tojam.ca/",organizer="Toronto Game Jam",summary="The organizer confirms a May 2027 return for its free three-day game jam at George Brown College, with exact dates still unannounced.",formats=["game-jam-hackathon"],type="workshop",venue="George Brown College",participation_mode="team-game-making",audience_scope="game makers of all experience levels",extra={"public_access_status":"registration-required","participation_roles":["designer","programmer","artist","writer","audio-creator"]})
add_watch(id="breakout-con-2027-watch",title="Breakout Gaming Convention 2027 — annual watch",marker="2027-03-01",source_url="https://breakoutcon.com/",organizer="Breakout Gaming Convention",summary="The 2026 convention is documented, but the 2027 edition and dates were not yet announced; retain as a qualified tabletop-community watch.",formats=["board-tabletop-games"],type="festival",venue="Toronto venue pending",participation_mode="tabletop-convention")

# Existing participatory records are cross-tagged without replacing identity.
cross_ids=[
 "research-dbd4f8f30b18","research-7c9c5c455222","research-170d166cdf26","research-574b30623d26","research-c84ae4435173"
]
cross_tags={i:{"subjects":["Participatory Culture"],"topics":["participatory-culture"],"participatory_formats":["social-dance"]} for i in cross_ids}

exclusions=[
 {"title":"Canzine 2026", "reason":"No current official 2026 edition was verified; archival or closed pages were not projected forward."},
 {"title":"Shab-e She’r future occurrence", "reason":"No exact future occurrence was recovered from an official source during this pass."},
 {"title":"General maker spaces and Digital Innovation Hubs", "reason":"Ongoing facilities are sources, not dated events, unless an occurrence is published."},
 {"title":"Multi-week comedy and improv courses", "reason":"Bounded instructional courses belong to Set 15 rather than Set 11."},
 {"title":"Festival markets without an evidenced participant role", "reason":"A fair is included only where making, direct creator exchange, demonstrations, play, or another active role is documented."},
 {"title":"Unbounded weekly recurrences", "reason":"A parent series is retained without generating infinite duplicate occurrences."},
]

# Reconcile exact existing title/date identities before apply_import. This prevents
# a researched occurrence from duplicating a legacy manual record that lacked an ID.
def norm(value): return re.sub(r"[^a-z0-9]+"," ",str(value or "").lower()).strip()
def dkey(value): return str(value or "")[:10]
manual_path=ROOT/"data"/"manual-events.json"
public_path=ROOT/"data"/"polymyth-seminar-events.json"
manual_doc=json.loads(manual_path.read_text(encoding="utf-8")); existing=manual_doc["events"]
previous_meta=dict(manual_doc.get(CONFIG["metadata_key"]) or {})
public_doc=json.loads(public_path.read_text(encoding="utf-8")); public_events=public_doc.get("events",public_doc)
public_map=collections.defaultdict(list)
for e in public_events: public_map[(norm(e.get("title")),dkey(e.get("date")))].append(e)
legacy_reconciled=[]
for proposed in records:
 matches=[e for e in existing if norm(e.get("title"))==norm(proposed.get("title")) and dkey(e.get("date"))==dkey(proposed.get("date"))]
 if len(matches)!=1: continue
 old=matches[0]
 if not old.get("id"):
  pmatches=public_map.get((norm(old.get("title")),dkey(old.get("date"))),[])
  if len(pmatches)==1 and pmatches[0].get("id"):
   old["id"]=pmatches[0]["id"]
   if pmatches[0].get("identity_key") and not old.get("identity_key"): old["identity_key"]=pmatches[0]["identity_key"]
 if old.get("id"):
  original=proposed["id"]; proposed["id"]=old["id"]
  if original != old["id"]:
   legacy_reconciled.append({"existing_id":old["id"],"provisional_id":original,"title":proposed["title"],"date":proposed["date"]})
manual_path.write_text(json.dumps(manual_doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

# Unique final IDs are a release requirement.
ids=[r["id"] for r in records]
assert len(ids)==len(set(ids)),f"Set 11 proposed IDs are not unique: {[k for k,v in collections.Counter(ids).items() if v>1]}"
result=apply_import(root=ROOT,config=CONFIG,records=records,cross_tags=cross_tags,exclusions=exclusions)
manual_doc=json.loads(manual_path.read_text(encoding="utf-8")); meta=manual_doc.get(CONFIG["metadata_key"],{})
meta.update({
 "legacy_records_reconciled":max(int(previous_meta.get("legacy_records_reconciled") or 0),len(legacy_reconciled)),"legacy_reconciliation":legacy_reconciled or previous_meta.get("legacy_reconciliation",[]),
 "net_new_records":max(int(previous_meta.get("net_new_records") or 0),result["added"]),
 "initial_records_added":max(int(previous_meta.get("initial_records_added") or 0),int(previous_meta.get("net_new_records") or 0),result["added"]),
 "records_added_latest_run":result["added"],"existing_records_refreshed_latest_run":result["refreshed"],
 "parent_records":len([r for r in records if r.get("series_role")=="parent"]),
 "child_occurrences":len([r for r in records if r.get("series_role")=="child"]),
 "confirmed_records":len([r for r in records if r.get("confirmation_status")=="confirmed"]),
 "qualified_records":len([r for r in records if r.get("confirmation_status")!="confirmed"]),
})
manual_doc[CONFIG["metadata_key"]]=meta
manual_path.write_text(json.dumps(manual_doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
# Add reconciliation evidence to the ledger produced by apply_import.
ledger_path=ROOT/"data"/CONFIG["research_filename"]
ledger=json.loads(ledger_path.read_text(encoding="utf-8")); ledger["legacy_reconciliation"]=legacy_reconciled
ledger_path.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
research_copy=ROOT/"data"/"research"/CONFIG["research_dirname"]/"research-ledger.json"
research_copy.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({**result,**{k:meta[k] for k in ["legacy_records_reconciled","parent_records","child_occurrences","confirmed_records","qualified_records"]}},indent=2))
