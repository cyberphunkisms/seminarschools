#!/usr/bin/env python3
"""Idempotently import Polymythcal Set 12 — Civic, Political, Legal, and Labour Events."""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import collections, json, re

from polymythcal_set_import_common import make_record as R, make_watch as W, apply_import

ROOT=Path(__file__).resolve().parents[1]
TZ=ZoneInfo("America/Toronto")
CONFIG={
 "src":"manual-polymythcal-civic-political-legal-labour-set12-2026-08-14",
 "research_set":"12-Civic-Political-Legal-Labour-Events",
 "checked":"2026-08-14T23:30:00-04:00",
 "domain_label":"Civic, Political, Legal, and Labour",
 "topic_slug":"civic-legal-labour",
 "set_tag":"Set 12",
 "entry_family":"civic-political-legal-labour",
 "field_name":"civic_legal_labour_formats",
 "metadata_key":"polymythcal_civic_political_legal_labour_set12_update_2026_08_14",
 "sources_metadata_key":"polymythcal_civic_political_legal_labour_set12_2026_08_14",
 "research_filename":"polymythcal-research-set-12-civic-political-legal-labour-2026-08-14.json",
 "research_dirname":"polymythcal-set12-civic-political-legal-labour-2026-08-14",
 "ledger_schema":"polymythcal-civic-political-legal-labour-set12-research-ledger-v1",
 "cl_ids":[f"CL-WEB-{n}" for n in range(268,276)],
 "ledger_notes":[
  "Election cycles, public bodies, legislatures, courts, labour organizations, and collective actions are represented as distinct linked structures.",
  "A public meeting is included only when an official body or organizer publishes a dated occurrence.",
  "Public attendance, deputation, question, registration, webcast, seat-reservation, publication-ban, and membership conditions remain independent fields.",
  "A case name or institutional schedule proves a hearing date; it does not prove unrestricted public or webcast access.",
  "Conflicting official dates remain visible through source inconsistency and alternate-date fields rather than being silently harmonized.",
  "Annual watches remain qualified and are never presented as confirmed current editions.",
 ]
}
records=[]

def iso(day:str, clock:str="00:00")->str:
 return datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=TZ).isoformat(timespec="seconds")

def add(*,id,title,day,source_url,organizer,summary,formats,type="meeting",clock="00:00",end_day=None,end_clock=None,
        venue,city="Toronto",province="Ontario",country="Canada",confirmed=True,time_precision="exact",date_precision="exact",
        parent_id=None,series_title=None,series_role=None,civic_domain="civic-governance",authority_level="municipal",
        public_role="observe",participation_route="official event page",public_input_status="not-stated",legal_access_status="not-applicable",
        collective_action_type=None,election_stage=None,access_restrictions=None,webcast_status="not-stated",publication_restriction=None,
        public_access_status="public",registration_required=None,event_format="in-person",source_id=None,source_language="en",
        source_languages=None,source_inconsistency=None,qualification_reasons=None,recurrence_note=None,alternate_dates=None,
        tags=None,extra=None):
 if series_role=="parent":
  # Parent records are inclusive date spans over their children; midnight is
  # only a serialization carrier and must never be presented as an exact time.
  time_precision="unknown"
 payload={
  "civic_domain":civic_domain,
  "authority_level":authority_level,
  "public_role":public_role,
  "participation_route":participation_route,
  "public_input_status":public_input_status,
  "legal_access_status":legal_access_status,
  "collective_action_type":collective_action_type,
  "election_stage":election_stage,
  "access_restrictions":access_restrictions or [],
  "webcast_status":webcast_status,
  "publication_restriction":publication_restriction,
  "public_access_status":public_access_status,
  "registration_required":registration_required,
  "event_format":event_format,
  "civic_evidence":summary,
  "alternate_dates":alternate_dates or [],
  "set12_classified_at":CONFIG["checked"],
 }
 if extra: payload.update(extra)
 rec=R(config=CONFIG,id=id,title=title,date=iso(day,clock),end_date=iso(end_day,end_clock or clock) if end_day else None,
   source_url=source_url,organizer=organizer,summary=summary,subfields=formats,record_kind="event",type=type,
   confirmed=confirmed,date_precision=date_precision,time_precision=time_precision,source_id=source_id,source_language=source_language,
   source_languages=source_languages,city=city,province=province,country=country,venue=venue,timezone="America/Toronto",
   access_route=participation_route,parent_id=parent_id,series_title=series_title,series_role=series_role,
   source_inconsistency=source_inconsistency,qualification_reasons=qualification_reasons,recurrence_note=recurrence_note,
   tags=tags,extra=payload)
 records.append(rec); return rec

def add_watch(*,id,title,marker,source_url,organizer,summary,formats,type="meeting",venue="Location pending",city="Toronto",
              province="Ontario",country="Canada",civic_domain="civic-governance",authority_level="municipal",
              public_role="observe",participation_route="official programme page",extra=None,source_inconsistency=None):
 payload={
  "civic_domain":civic_domain,"authority_level":authority_level,"public_role":public_role,
  "participation_route":participation_route,"public_input_status":"unconfirmed","legal_access_status":"not-applicable",
  "access_restrictions":[],"webcast_status":"unconfirmed","public_access_status":"unconfirmed",
  "registration_required":None,"event_format":"in-person","civic_evidence":summary,"alternate_dates":[],
  "set12_classified_at":CONFIG["checked"],"attendance_confirmed":False,
 }
 if extra: payload.update(extra)
 rec=W(config=CONFIG,id=id,title=title,marker=iso(marker),source_url=source_url,organizer=organizer,summary=summary,
  subfields=formats,type=type,record_kind="event",venue=venue,city=city,province=province,country=country,
  access_route=participation_route,source_inconsistency=source_inconsistency,extra=payload)
 records.append(rec); return rec

# ------------------------------------------------------------------
# Toronto municipal election — parent plus independently actionable stages.
# ------------------------------------------------------------------
toronto_election="https://www.toronto.ca/city-government/elections/key-dates/"
add(id="toronto-municipal-election-cycle-2026",title="Toronto municipal election cycle 2026",day="2026-08-21",end_day="2026-10-26",
 source_url=toronto_election,organizer="Toronto Elections",summary="The official election calendar links candidate, voter, advance-voting, election-day, and post-election compliance stages for Toronto's October 26 municipal election.",
 formats=["election-voting"],venue="City of Toronto and designated voting places",series_role="parent",civic_domain="election",
 authority_level="municipal",public_role="vote-or-participate",participation_route="Toronto Elections official calendar",public_input_status="voter-participation",
 election_stage="election-cycle",webcast_status="not-applicable",event_format="multi-site")

def tor_e(id,title,day,clock="00:00",end_day=None,end_clock=None,stage="election-stage",summary=None,role="comply-or-participate",venue="Toronto / online",confirmed=True):
 return add(id=id,title=title,day=day,clock=clock,end_day=end_day,end_clock=end_clock,source_url=toronto_election,organizer="Toronto Elections",
  summary=summary or title,formats=["election-voting" if "vote" in stage or "election" in stage else "civic-deadline-compliance"],
  type="meeting" if stage in {"candidate-session","advance-voting","kids-vote","election-day"} else "deadline",venue=venue,
  parent_id="toronto-municipal-election-cycle-2026",series_title="Toronto municipal election cycle 2026",series_role="child",
  civic_domain="election",authority_level="municipal",public_role=role,participation_route="Toronto Elections official calendar",
  public_input_status="voter-participation" if "vote" in stage or stage=="election-day" else "not-applicable",election_stage=stage,
  webcast_status="available" if stage=="candidate-session" else "not-applicable",event_format="hybrid" if stage=="candidate-session" else "multi-site",
  registration_required=False if stage=="candidate-session" else None,confirmed=confirmed,time_precision="exact" if clock!="00:00" else "unknown")

tor_e("toronto-election-nomination-deadline-2026","Toronto municipal election — nomination, withdrawal, and office-change deadline","2026-08-21","14:00",stage="candidate-nomination-deadline")
tor_e("toronto-election-candidate-certification-2026","Toronto municipal election — candidate certification deadline","2026-08-24",stage="candidate-certification")
tor_e("toronto-election-manage-campaign-session-2026-08-24","Toronto municipal election — Manage Your Campaign information session","2026-08-24","18:30",end_day="2026-08-24",end_clock="20:30",stage="candidate-session",summary="A no-registration hybrid campaign-management information session at Toronto City Hall and by Webex.",venue="Toronto City Hall Council Chamber and Webex")
tor_e("toronto-election-voter-services-open-2026-09-01","Toronto municipal election — mail voting, voters' list updates, and proxy requests open","2026-09-01",stage="voter-services-open",role="register-or-request")
tor_e("toronto-election-voter-card-mail-cutoff-2026","Toronto municipal election — voter information card mailing-list cutoff","2026-09-20","23:59",stage="voter-registration-deadline")
tor_e("toronto-election-mail-vote-request-deadline-2026","Toronto municipal election — vote-by-mail request deadline","2026-09-24","16:30",stage="mail-vote-request-deadline")
tor_e("toronto-election-spending-limits-2026","Toronto municipal election — final spending and self-contribution limits issued","2026-09-25",stage="campaign-finance-limit")
tor_e("toronto-election-voter-cards-mailed-2026","Toronto municipal election — voter information cards begin mailing","2026-09-28",stage="voter-information")
tor_e("toronto-election-sign-period-opens-2026","Toronto municipal election — election-sign period opens","2026-10-01",stage="campaign-sign-period")
tor_e("toronto-election-advance-voting-2026","Toronto municipal election — advance voting period","2026-10-06","10:00",end_day="2026-10-11",end_clock="19:00",stage="advance-voting",venue="Advance voting places across Toronto")
tor_e("toronto-election-kids-vote-weekend-2026","Toronto municipal election — Kids Vote Weekend","2026-10-10","10:00",end_day="2026-10-11",end_clock="19:00",stage="kids-vote",role="participate",venue="All Toronto advance voting places")
tor_e("toronto-election-mail-package-deadline-2026","Toronto municipal election — completed mail-in voting packages due","2026-10-14","12:00",stage="mail-vote-return-deadline")
tor_e("toronto-election-third-party-registration-deadline-2026","Toronto municipal election — third-party advertiser registration deadline","2026-10-23",stage="third-party-registration-deadline")
tor_e("toronto-municipal-election-day-2026","Toronto municipal election day 2026","2026-10-26","10:00",end_day="2026-10-26",end_clock="20:00",stage="election-day",role="vote",venue="Voting places across Toronto")
tor_e("toronto-election-sign-removal-deadline-2026","Toronto municipal election — election signs must be removed","2026-10-29","23:59",stage="campaign-sign-compliance")
tor_e("toronto-election-initial-campaign-period-ends-2026","Toronto municipal election — initial campaign period ends and Form 6 extension deadline","2026-12-31",stage="campaign-finance-period-end")
tor_e("toronto-election-initial-financial-statement-2027","Toronto municipal election — initial financial statement deadline","2027-03-30","14:00",stage="campaign-finance-filing")
tor_e("toronto-election-initial-financial-grace-2027","Toronto municipal election — initial financial statement grace deadline","2027-04-29","14:00",stage="campaign-finance-grace")
tor_e("toronto-election-initial-compliance-audit-2027","Toronto municipal election — initial compliance-audit application deadline","2027-06-28",stage="compliance-audit-deadline",role="file-application")
tor_e("toronto-election-supplementary-campaign-period-end-2027","Toronto municipal election — supplementary campaign period ends","2027-06-30",stage="campaign-finance-period-end")
tor_e("toronto-election-supplementary-financial-statement-2027","Toronto municipal election — supplementary financial statement deadline","2027-09-24","14:00",stage="campaign-finance-filing")
tor_e("toronto-election-supplementary-financial-grace-2027","Toronto municipal election — supplementary financial statement grace deadline","2027-10-25",stage="campaign-finance-grace")
tor_e("toronto-election-supplementary-compliance-audit-2027","Toronto municipal election — supplementary compliance-audit application deadline","2027-12-23",stage="compliance-audit-deadline",role="file-application")
tor_e("toronto-election-contribution-rebate-deadline-2027","Toronto municipal election — contribution rebate application deadline","2027-12-30",stage="contribution-rebate-deadline",role="apply")

# ------------------------------------------------------------------
# Québec provincial election — fixed election date plus qualified call marker.
# ------------------------------------------------------------------
qc_url="https://www.electionsquebec.qc.ca/en/vote/general-elections/"
add(id="quebec-general-election-cycle-2026",title="Québec general election cycle 2026",day="2026-08-29",end_day="2026-10-05",source_url=qc_url,
 organizer="Élections Québec",summary="The fixed-date provincial election calendar links the expected writ period, out-of-Québec registration, advance voting options, and October 5 election day.",
 formats=["election-voting"],venue="Québec and authorized out-of-Québec voting routes",city="Québec",province="Québec",series_role="parent",
 civic_domain="election",authority_level="provincial",public_role="vote-or-participate",participation_route="Élections Québec official information",
 public_input_status="voter-participation",election_stage="election-cycle",event_format="multi-site",source_language="fr",source_languages=["fr","en"])
add_watch(id="quebec-election-call-expected-2026",title="Québec general election — expected election call",marker="2026-08-29",source_url=qc_url,
 organizer="Élections Québec",summary="The fixed-date framework makes an August 29 call expected, but the writ is not treated as issued until officially proclaimed.",formats=["election-voting"],
 venue="Québec",city="Québec",province="Québec",civic_domain="election",authority_level="provincial",public_role="monitor",
 extra={"election_stage":"expected-writ","parent_id":"quebec-general-election-cycle-2026","series_title":"Québec general election cycle 2026","series_role":"child","source_language":"fr","source_languages":["fr","en"]})
add(id="quebec-election-outside-registration-deadline-2026",title="Québec general election — registration deadline for voting outside Québec",day="2026-09-16",source_url=qc_url,
 organizer="Élections Québec",summary="Deadline for eligible electors using the outside-Québec voting route to complete registration.",formats=["civic-deadline-compliance"],type="deadline",
 venue="Online / Élections Québec",city="Online",province="Québec",parent_id="quebec-general-election-cycle-2026",series_title="Québec general election cycle 2026",series_role="child",
 civic_domain="election",authority_level="provincial",public_role="register",participation_route="Élections Québec registration route",election_stage="outside-quebec-registration",
 source_language="fr",source_languages=["fr","en"],event_format="online")
add(id="quebec-election-voting-options-period-2026",title="Québec general election — advance and special voting options period",day="2026-09-25",end_day="2026-10-01",source_url=qc_url,
 organizer="Élections Québec",summary="Official voting options are available during the published pre-election period, with route-specific eligibility and schedules.",formats=["election-voting"],
 venue="Voting locations and authorized special routes across Québec",city="Québec",province="Québec",parent_id="quebec-general-election-cycle-2026",series_title="Québec general election cycle 2026",series_role="child",
 civic_domain="election",authority_level="provincial",public_role="vote",participation_route="Élections Québec voting options",public_input_status="voter-participation",
 election_stage="advance-and-special-voting",source_language="fr",source_languages=["fr","en"],event_format="multi-site",time_precision="unknown")
add(id="quebec-general-election-day-2026",title="Québec general election day 2026",day="2026-10-05",source_url=qc_url,organizer="Élections Québec",
 summary="Fixed-date provincial general election day.",formats=["election-voting"],venue="Voting places across Québec",city="Québec",province="Québec",
 parent_id="quebec-general-election-cycle-2026",series_title="Québec general election cycle 2026",series_role="child",civic_domain="election",authority_level="provincial",
 public_role="vote",participation_route="assigned voting place or authorized voting route",public_input_status="voter-participation",election_stage="election-day",
 source_language="fr",source_languages=["fr","en"],event_format="multi-site",time_precision="unknown")

# ------------------------------------------------------------------
# Toronto public bodies, hearings, deputations, and consultations.
# ------------------------------------------------------------------
def series(parent_id,title,dates,source_url,organizer,summary,formats,venue,**kw):
 first=dates[0][0]; last=dates[-1][0]
 parent_kw=dict(kw)
 add(id=parent_id,title=title,day=first,end_day=last,source_url=source_url,organizer=organizer,summary=summary,formats=formats,venue=venue,
  series_role="parent",**parent_kw)
 for ix,row in enumerate(dates,1):
  d=row[0]; clock=row[1] if len(row)>1 else "00:00"; child_title=row[2] if len(row)>2 else f"{title} — {d}"
  child_kw=dict(kw); child_kw.setdefault("time_precision","exact" if clock!="00:00" else "unknown")
  add(id=f"{parent_id}-{d}",title=child_title,day=d,clock=clock,source_url=source_url,organizer=organizer,summary=summary,formats=formats,venue=venue,
   parent_id=parent_id,series_title=title,series_role="child",**child_kw)

tpsb="https://tpsb.ca/home/board-meeting-schedule/"
series("toronto-police-service-board-fall-2026","Toronto Police Service Board meetings — fall 2026",
 [("2026-09-24","09:00","Toronto Police Service Board meeting — September 24, 2026"),("2026-11-12","09:00","Toronto Police Service Board meeting — November 12, 2026"),("2026-12-15","09:00","Toronto Police Service Board meeting — December 15, 2026")],
 tpsb,"Toronto Police Service Board","Monthly public board meetings normally open at 9 a.m., move in camera for confidential matters, and resume publicly around 1 p.m.; the Board provides in-person attendance, livestreaming, and a deputation route.",
 ["council-board-committee"],"Toronto Police Headquarters, 40 College Street and livestream",civic_domain="public-body",authority_level="municipal",
 public_role="observe-or-depute",participation_route="attend, livestream, or apply to make a deputation",public_input_status="deputation-available",webcast_status="live-and-archived",
 event_format="hybrid",access_restrictions=["agenda and exact public-session timing posted closer to meeting"])

tpl="https://tpl.ca/about-the-library/board/meetings/"
series("toronto-public-library-board-fall-2026","Toronto Public Library Board meetings — fall 2026",
 [("2026-09-28","18:00","Toronto Public Library Board meeting — September 28, 2026"),("2026-11-02","18:00","Toronto Public Library Board meeting — November 2, 2026"),("2026-12-07","18:00","Toronto Public Library Board meeting — December 7, 2026")],
 tpl,"Toronto Public Library Board","Public hybrid board meetings with published agendas and a route for members of the public to make deputations.",
 ["council-board-committee"],"Toronto Reference Library and online",civic_domain="public-body",authority_level="municipal",public_role="observe-or-depute",
 participation_route="attend, watch online, or register for a deputation",public_input_status="deputation-available",webcast_status="available",event_format="hybrid")

ttc="https://www.ttc.ca/public-meetings/board"
series("ttc-board-fall-2026","Toronto Transit Commission Board meetings — fall 2026",[("2026-12-15","00:00","Toronto Transit Commission Board meeting — December 15, 2026")],
 ttc,"Toronto Transit Commission Board","The TTC publishes public Board meetings, agendas, livestream information, and deputation procedures; the remaining 2026 date is listed without a final start time.",
 ["council-board-committee"],"Toronto venue and webcast pending agenda",civic_domain="public-body",authority_level="municipal",public_role="observe-or-depute",
 participation_route="official meeting page and deputation procedure",public_input_status="deputation-available",webcast_status="available",event_format="hybrid",
 access_restrictions=["final time and venue published with agenda"])

drp="https://www.toronto.ca/city-government/planning-development/outreach-engagement/design-review-panel/meeting-schedule/"
series("toronto-design-review-panel-fall-2026","Toronto Design Review Panel meetings — fall 2026",
 [("2026-09-09","12:00","Toronto Design Review Panel meeting — September 9, 2026"),("2026-10-07","12:00","Toronto Design Review Panel meeting — October 7, 2026"),("2026-11-04","12:00","Toronto Design Review Panel meeting — November 4, 2026"),("2026-12-02","12:00","Toronto Design Review Panel meeting — December 2, 2026")],
 drp,"City of Toronto Design Review Panel","Public design-review meetings are normally scheduled from noon to 5:30 p.m. in a hybrid format; agendas determine the projects considered.",
 ["public-hearing-deputation"],"Toronto City Hall and Webex",civic_domain="planning-review",authority_level="municipal",public_role="observe",
 participation_route="official agenda and meeting access",public_input_status="observation; input route agenda-dependent",webcast_status="available",event_format="hybrid",
 access_restrictions=["project agenda and exact end time may change"])

coa="https://www.toronto.ca/city-government/planning-development/committee-of-adjustment/toronto-east-york-schedule/"
coa_dates=[("2026-08-19","00:00","Toronto & East York Committee of Adjustment hearing — August 19, 2026"),("2026-09-02","00:00","Toronto & East York Committee of Adjustment hearing — September 2, 2026"),("2026-09-09","00:00","Toronto & East York Committee of Adjustment hearing — September 9, 2026"),("2026-09-23","00:00","Toronto & East York Committee of Adjustment hearing — September 23, 2026"),("2026-10-07","00:00","Toronto & East York Committee of Adjustment hearing — October 7, 2026"),("2026-10-14","00:00","Toronto & East York Committee of Adjustment hearing — October 14, 2026"),("2026-10-21","00:00","Toronto & East York Committee of Adjustment hearing — October 21, 2026"),("2026-11-04","00:00","Toronto & East York Committee of Adjustment hearing — November 4, 2026"),("2026-11-25","00:00","Toronto & East York Committee of Adjustment hearing — November 25, 2026"),("2026-12-02","00:00","Toronto & East York Committee of Adjustment hearing — December 2, 2026"),("2026-12-09","00:00","Toronto & East York Committee of Adjustment hearing — December 9, 2026"),("2026-12-16","00:00","Toronto & East York Committee of Adjustment hearing — December 16, 2026")]
series("toronto-east-york-committee-adjustment-fall-2026","Toronto & East York Committee of Adjustment hearings — fall 2026",coa_dates,coa,"City of Toronto Committee of Adjustment",
 "Hybrid statutory public hearings on minor variances, consents, and related planning applications; room assignments are published, while final start times depend on agendas.",
 ["public-hearing-deputation"],"Toronto City Hall and Webex",civic_domain="planning-hearing",authority_level="municipal",public_role="observe-or-participate",
 participation_route="attend, join Webex, or follow application-specific participation instructions",public_input_status="application-specific-public-input",webcast_status="live",
 legal_access_status="public-statutory-hearing",event_format="hybrid",access_restrictions=["start time and application order depend on published agenda"])

add_watch(id="toronto-budget-2027-public-consultation-watch",title="Toronto 2027 Budget public consultations — annual watch",marker="2026-10-01",
 source_url="https://www.toronto.ca/city-government/budget-finances/city-budget/",organizer="City of Toronto",summary="Toronto normally publishes public budget consultation meetings and survey routes before the annual budget process, but the 2027 schedule was not yet published.",
 formats=["public-consultation"],venue="Toronto and online",civic_domain="budget-consultation",authority_level="municipal",public_role="submit-input",
 extra={"public_input_status":"expected-date-unpublished","webcast_status":"unconfirmed","event_format":"hybrid"})

# ------------------------------------------------------------------
# Montréal municipal and borough governance.
# ------------------------------------------------------------------
mtl="https://montreal.ca/conseils-decisionnels/conseil-municipal"
mtl_dates=[("2026-08-24","13:00","Séance du conseil municipal de Montréal — 24 août 2026"),("2026-08-25","09:00","Séance supplémentaire du conseil municipal de Montréal — 25 août 2026"),("2026-09-21","13:00","Séance du conseil municipal de Montréal — 21 septembre 2026"),("2026-09-22","09:00","Séance supplémentaire du conseil municipal de Montréal — 22 septembre 2026"),("2026-10-19","13:00","Séance du conseil municipal de Montréal — 19 octobre 2026"),("2026-10-20","09:00","Séance supplémentaire du conseil municipal de Montréal — 20 octobre 2026"),("2026-11-16","13:00","Séance du conseil municipal de Montréal — 16 novembre 2026"),("2026-11-17","09:00","Séance supplémentaire du conseil municipal de Montréal — 17 novembre 2026"),("2026-12-14","13:00","Séance du conseil municipal de Montréal — 14 décembre 2026"),("2026-12-15","09:00","Séance supplémentaire du conseil municipal de Montréal — 15 décembre 2026")]
series("montreal-city-council-fall-2026","Séances du conseil municipal de Montréal — automne 2026",mtl_dates,mtl,"Ville de Montréal",
 "Séances décisionnelles publiques avec ordre du jour, retransmission et mécanismes permettant aux citoyennes et citoyens de poser une question en personne ou par écrit.",
 ["council-board-committee"],"Hôtel de ville de Montréal et webdiffusion",city="Montréal",province="Québec",civic_domain="municipal-council",authority_level="municipal",
 public_role="observer-ou-question",participation_route="assister, visionner ou soumettre une question",public_input_status="question-period-available",webcast_status="live-and-archived",
 event_format="hybrid",source_language="fr",source_languages=["fr"])

boroughs=[
 ("outremont-borough-council-fall-2026","Conseil d’arrondissement d’Outremont — automne 2026","https://montreal.ca/conseils-decisionnels/conseil-darrondissement-doutremont",[("2026-09-01","19:00","Séance du conseil d’arrondissement d’Outremont — 1 septembre 2026"),("2026-10-06","19:00","Séance du conseil d’arrondissement d’Outremont — 6 octobre 2026"),("2026-11-03","19:00","Séance du conseil d’arrondissement d’Outremont — 3 novembre 2026"),("2026-12-01","19:00","Séance du conseil d’arrondissement d’Outremont — 1 décembre 2026")],"Mairie d’arrondissement d’Outremont"),
 ("montreal-nord-borough-council-fall-2026","Conseil d’arrondissement de Montréal-Nord — automne 2026","https://montreal.ca/conseils-decisionnels/conseil-darrondissement-de-montreal-nord",[("2026-09-08","19:00","Séance du conseil de Montréal-Nord — 8 septembre 2026"),("2026-10-06","19:00","Séance du conseil de Montréal-Nord — 6 octobre 2026"),("2026-11-02","19:00","Séance du conseil de Montréal-Nord — 2 novembre 2026"),("2026-12-07","19:00","Séance du conseil de Montréal-Nord — 7 décembre 2026")],"Mairie d’arrondissement de Montréal-Nord"),
 ("anjou-borough-council-fall-2026","Conseil d’arrondissement d’Anjou — automne 2026","https://montreal.ca/conseils-decisionnels/conseil-darrondissement-danjou",[("2026-09-01","19:00","Séance du conseil d’arrondissement d’Anjou — 1 septembre 2026"),("2026-10-06","19:00","Séance du conseil d’arrondissement d’Anjou — 6 octobre 2026"),("2026-11-03","19:00","Séance du conseil d’arrondissement d’Anjou — 3 novembre 2026")],"Mairie d’arrondissement d’Anjou"),
]
for pid,title,url,dates,venue in boroughs:
 series(pid,title,dates,url,"Ville de Montréal",f"Séances publiques d’arrondissement avec période de questions, documents officiels et webdiffusion selon les modalités publiées.",["council-board-committee"],venue,
  city="Montréal",province="Québec",civic_domain="borough-council",authority_level="municipal",public_role="observer-ou-question",
  participation_route="assister, webdiffusion et période de questions",public_input_status="question-period-available",webcast_status="available",event_format="hybrid",
  source_language="fr",source_languages=["fr"])

ocpm="https://ocpm.qc.ca/fr"
series("ocpm-ahuntsic-cartierville-public-participation-2026","La participation publique à Ahuntsic-Cartierville — activités contributives",[("2026-09-16","00:00","La participation publique à Ahuntsic-Cartierville — 16 septembre 2026"),("2026-09-22","00:00","La participation publique à Ahuntsic-Cartierville — 22 septembre 2026")],
 ocpm,"Office de consultation publique de Montréal","Activités contributives citoyennes publiées par l’OCPM dans le cadre d’une démarche de participation publique.",
 ["public-consultation"],"Ahuntsic-Cartierville — lieu selon l’activité",city="Montréal",province="Québec",civic_domain="public-consultation",authority_level="municipal",
 public_role="contribute",participation_route="activité contributive de l’OCPM",public_input_status="active-contribution",webcast_status="not-stated",event_format="in-person",
 source_language="fr",source_languages=["fr"],time_precision="unknown")

# ------------------------------------------------------------------
# Legislatures and parliamentary sittings.
# ------------------------------------------------------------------
ola="https://www.ola.org/en/legislative-business/parliamentary-calendars"
add(id="ontario-legislature-fall-sitting-2026",title="Legislative Assembly of Ontario — fall 2026 sitting period",day="2026-10-27",end_day="2026-12-10",source_url=ola,
 organizer="Legislative Assembly of Ontario",summary="The parliamentary calendar shows the House returning after the summer exception on October 27 and able to meet through December 10, excluding November 9–12.",
 formats=["legislature-parliamentary-sitting"],venue="Ontario Legislative Building and webcast",city="Toronto",civic_domain="legislature",authority_level="provincial",
 public_role="observe",participation_route="public galleries, committee procedures, and webcast",public_input_status="committee-specific",webcast_status="live-and-archived",event_format="hybrid",
 recurrence_note="House may meet October 27–December 10, 2026, excluding November 9–12.")
add(id="ontario-legislature-return-2026-10-27",title="Legislative Assembly of Ontario returns for fall sitting",day="2026-10-27",source_url=ola,organizer="Legislative Assembly of Ontario",
 summary="First eligible sitting day after the published June 3–October 26 exception.",formats=["legislature-parliamentary-sitting"],venue="Ontario Legislative Building and webcast",parent_id="ontario-legislature-fall-sitting-2026",
 series_title="Legislative Assembly of Ontario — fall 2026 sitting period",series_role="child",civic_domain="legislature",authority_level="provincial",public_role="observe",
 participation_route="public galleries and webcast",public_input_status="not-applicable",webcast_status="live-and-archived",event_format="hybrid",time_precision="unknown")
add(id="ontario-legislature-2027-sitting-calendar",title="Legislative Assembly of Ontario — 2027 parliamentary calendar",day="2027-02-16",end_day="2027-12-09",source_url=ola,
 organizer="Legislative Assembly of Ontario",summary="The official calendar identifies the 2027 period in which the House may meet and lists statutory exception weeks.",formats=["legislature-parliamentary-sitting"],venue="Ontario Legislative Building and webcast",
 civic_domain="legislature",authority_level="provincial",public_role="observe",participation_route="public galleries, committees, and webcast",public_input_status="committee-specific",webcast_status="live-and-archived",
 event_format="hybrid",recurrence_note="May meet February 16–December 9, 2027, excluding March 15–18, March 29–April 1, May 24–27, June 7–September 9, October 11–14, and November 8–11.")
commons="https://www.ourcommons.ca/en/parliamentary-business/2026-09-21%20-04%3A00"
add(id="house-of-commons-return-2026-09-21",title="House of Commons returns — September 21, 2026",day="2026-09-21",source_url=commons,organizer="House of Commons of Canada",
 summary="The parliamentary-business calendar identifies September 21 as the next sitting after the summer adjournment; proceedings are publicly webcast.",formats=["legislature-parliamentary-sitting"],venue="House of Commons, Ottawa and webcast",city="Ottawa",
 civic_domain="legislature",authority_level="federal",public_role="observe",participation_route="public gallery and webcast",public_input_status="committee-specific",webcast_status="live-and-archived",event_format="hybrid",time_precision="unknown")
senate="https://sencanada.ca/en/in-the-chamber/order-papers-notice-papers/"
add(id="senate-of-canada-next-sitting-2026-09-28",title="Senate of Canada next sitting — September 28, 2026",day="2026-09-28",source_url=senate,organizer="Senate of Canada",
 summary="The current Order Paper and Notice Paper surface identifies the next Senate sitting date.",formats=["legislature-parliamentary-sitting"],venue="Senate of Canada Building, Ottawa and webcast",city="Ottawa",
 civic_domain="legislature",authority_level="federal",public_role="observe",participation_route="public proceedings and webcast",public_input_status="committee-specific",webcast_status="available",event_format="hybrid",time_precision="unknown")

# ------------------------------------------------------------------
# Supreme Court of Canada — public-access and publication restrictions are case-specific.
# ------------------------------------------------------------------
scc="https://www.scc-csc.ca/cases-dossiers/hearings-audiences/scheduled-prevues/"
hearings=[
 ("2026-10-06","R. v. Abdel Karim Chemlal","41766","webcast",None),
 ("2026-10-07","Atlantic Lottery Corporation Inc. et al. v. Attorney General of Ontario","42141","webcast",None),
 ("2026-10-08","NHK Spring Co. Ltd. et al. v. Tony Cheung et al.","41451","restricted","publication ban and sealed material"),
 ("2026-10-09","Vabuolas et al. v. British Columbia Information and Privacy Commissioner et al.","41816","webcast",None),
 ("2026-10-13","Diggs et al. v. Nova Scotia Health Authority et al.","41801","webcast",None),
 ("2026-10-14","Cold Ocean Salmon Inc. v. Nova Fish Farms Inc.","42032","webcast",None),
 ("2026-10-15","Ontario Place Protectors v. Ontario / Attorney General of Ontario","41805","webcast",None),
 ("2026-10-16","Consumers’ Union et al. v. Air Canada et al.","41866","webcast",None),
 ("2026-11-02","Lipson Dubé v. The King","42241","restricted","publication ban"),
 ("2026-11-02","Robert Regular v. The King","42236","restricted","publication ban and sealed material"),
 ("2026-11-03","R. v. Keven Boily","42025","restricted","publication ban"),
 ("2026-11-04","Bowcock v. The King","42055","webcast",None),
 ("2026-11-05","Sarroino v. The King","41927","webcast",None),
 ("2026-11-06","Named Persons v. Attorney General of Canada","41981","restricted","publication ban and sealed material"),
 ("2026-11-09","Christine Generoux et al. v. Attorney General of Canada","41858","webcast",None,"2026-11-10"),
 ("2026-11-09","Canadian Coalition for Firearm Rights et al. v. Attorney General of Canada","41859","webcast",None,"2026-11-10"),
 ("2026-11-09","Michael John Doherty et al. v. Attorney General of Canada","41860","webcast",None,"2026-11-10"),
 ("2026-11-09","Jennifer Eichenberg et al. v. Attorney General of Canada","41861","webcast",None,"2026-11-10"),
 ("2026-11-10","Hannah Lafferty v. The King","42284","webcast",None),
 ("2026-11-12","Canadian National Railway Company v. Alberta Pacific Forest Industries Inc.","42092","restricted","sealed material"),
 ("2026-11-13","H.N. v. School District No. 61 et al.","41910","restricted","publication ban"),
 ("2026-12-01","Alex Clarke v. The King","42291","restricted","publication ban"),
 ("2026-12-02","R. v. Éric Giroux","42331","webcast",None),
 ("2026-12-03","GCT Canada Limited Partnership v. International Longshore and Warehouse Union, Local 514","41951","webcast",None),
 ("2026-12-04","American Pacific Corporation v. RPG Receivables Purchase Group Inc.","41937","webcast",None),
 ("2026-12-07","North et al. v. BMW Canada Inc. et al.","41913","webcast",None),
 ("2026-12-08","Wood v. The King","42127","webcast",None),
 ("2026-12-09","Attorney General of Québec v. Petrishki et al.","42018","webcast",None),
 ("2026-12-10","Rhoden v. The King","41923","webcast",None),
 ("2026-12-10","Anderson v. The King","41925","webcast",None),
 ("2026-12-11","R. v. Patrick Dussault","42169","restricted","publication ban"),
]
add(id="supreme-court-canada-hearings-fall-2026",title="Supreme Court of Canada scheduled hearings — fall 2026",day="2026-10-06",end_day="2026-12-11",source_url=scc,
 organizer="Supreme Court of Canada",summary="The Court's official schedule lists appeal hearings, case numbers, live-webcast availability, and case-specific publication or sealing restrictions; courtroom seats require reservation.",
 formats=["court-tribunal-hearing"],venue="Supreme Court of Canada, Ottawa and online where permitted",city="Ottawa",series_role="parent",civic_domain="court-hearing",authority_level="federal",
 public_role="observe",participation_route="reserve courtroom seat or use webcast where permitted",public_input_status="not-applicable",legal_access_status="public-subject-to-case-restrictions",
 webcast_status="case-specific",publication_restriction="case-specific",event_format="hybrid",access_restrictions=["courtroom seat reservation required","publication bans or sealing orders may restrict access"])
for d,title,case,status,restriction,*end in hearings:
 restricted=status=="restricted"
 add(id=f"scc-hearing-{case}-{d}",title=f"Supreme Court of Canada hearing — {title} ({case})",day=d,end_day=(end[0] if end else None),source_url=scc,
  organizer="Supreme Court of Canada",summary=f"Scheduled appeal hearing in case {case}. " + (f"The official schedule identifies {restriction}; no unrestricted live webcast is represented." if restricted else "The official schedule indicates a live webcast, subject to any later Court notice."),
  formats=["court-tribunal-hearing"],venue="Supreme Court of Canada, Ottawa" + (" and webcast" if not restricted else ""),city="Ottawa",
  parent_id="supreme-court-canada-hearings-fall-2026",series_title="Supreme Court of Canada scheduled hearings — fall 2026",series_role="child",
  civic_domain="court-hearing",authority_level="federal",public_role="observe",participation_route="reserve courtroom seat" + (" or watch webcast" if not restricted else ""),
  public_input_status="not-applicable",legal_access_status="public-subject-to-case-restrictions" if restricted else "public-seat-reservation",
  webcast_status="unavailable-due-to-restriction" if restricted else "live-and-archived",publication_restriction=restriction,
  event_format="in-person" if restricted else "hybrid",access_restrictions=["courtroom seat reservation required"] + ([restriction] if restriction else []),time_precision="unknown",
  extra={"court_file_number":case})

# Ontario coroner inquest.
coroner="https://www.ontario.ca/page/schedule-coroners-inquests"
add(id="ontario-coroner-inquests-schedule-2026",title="Ontario coroner inquests — current schedule",day="2026-08-17",source_url=coroner,organizer="Office of the Chief Coroner for Ontario",
 summary="The official schedule publishes upcoming inquests and whether they proceed by videoconference or another stated format.",formats=["inquest-public-inquiry"],venue="Ontario / videoconference as listed",series_role="parent",
 civic_domain="inquest",authority_level="provincial",public_role="observe",participation_route="official inquest access instructions",public_input_status="not-applicable",legal_access_status="public-inquest-subject-to-directions",
 webcast_status="case-specific",event_format="online",time_precision="unknown")
add(id="ontario-coroner-inquest-sam-mirza-2026-08-17",title="Coroner's inquest into the death of Sam Mirza",day="2026-08-17",source_url=coroner,organizer="Office of the Chief Coroner for Ontario",
 summary="The official schedule lists the Sam Mirza inquest beginning August 17 by videoconference.",formats=["inquest-public-inquiry"],venue="Videoconference / access instructions from the coroner",city="Online",
 parent_id="ontario-coroner-inquests-schedule-2026",series_title="Ontario coroner inquests — current schedule",series_role="child",civic_domain="inquest",authority_level="provincial",
 public_role="observe",participation_route="official videoconference access instructions",public_input_status="not-applicable",legal_access_status="public-inquest-subject-to-directions",webcast_status="videoconference",
 event_format="online",time_precision="unknown")

# ------------------------------------------------------------------
# Labour governance, conferences, collective action, and annual watches.
# ------------------------------------------------------------------
cupe="https://cupe.on.ca/calendar/"
labour_events=[
 ("cupe-caco-caucus-2026","CUPE Ontario CACO Caucus 2026","2026-09-22","2026-09-24","Sheraton Parkway Hotel, Richmond Hill","union-conference","conference"),
 ("cupe-hcwcc-conference-2026","CUPE Ontario HCWCC Conference 2026","2026-09-22","2026-09-25","Sheraton Parkway Hotel, Richmond Hill","union-conference","conference"),
 ("cupe-iwac-hs-conference-2026","CUPE Ontario IWAC & HS Conference 2026","2026-10-05","2026-10-09","Sheraton Parkway Hotel, Richmond Hill","union-conference","conference"),
 ("cupe-fall-school-2026","CUPE Ontario Fall School 2026","2026-10-27","2026-11-01","Sheraton Centre Toronto Hotel","union-education","workshop"),
 ("cupe-worker-wellbeing-summit-2026","CUPE Ontario From Stress to Strength: Worker Wellbeing Summit 2026","2026-11-17","2026-11-20","Marriott on the Falls, Niagara Falls","union-conference","conference"),
 ("cupe-womens-conference-2026","CUPE Ontario Women’s Conference 2026","2026-12-06","2026-12-09","Sheraton Centre Toronto Hotel","union-conference","conference"),
 ("cupe-trades-conference-2027","CUPE Ontario Trades Conference 2027","2027-01-25","2027-01-28","Sheraton Parkway Hotel, Richmond Hill","union-conference","conference"),
 ("cupe-ouwcc-conference-2027","CUPE Ontario OUWCC Conference 2027","2027-02-16","2027-02-19","Marriott on the Falls, Niagara Falls","union-conference","conference"),
]
for id,title,start,end,venue,form,typ in labour_events:
 add(id=id,title=title,day=start,end_day=end,source_url=cupe,organizer="CUPE Ontario",summary="A CUPE Ontario member conference, caucus, school, or convention listed on the official provincial calendar; access and registration follow union eligibility and event notices.",formats=[form],type=typ,
  venue=venue,city="Richmond Hill" if "Richmond Hill" in venue else ("Niagara Falls" if "Niagara" in venue else "Toronto"),civic_domain="labour-governance",authority_level="union",
  public_role="member-participant",participation_route="CUPE Ontario registration and eligibility rules",public_input_status="member-deliberation",legal_access_status="not-applicable",
  collective_action_type="union-conference",webcast_status="not-stated",public_access_status="membership-or-delegate-restricted",registration_required=True,event_format="in-person",
  access_restrictions=["union membership, delegate, or event-specific eligibility may apply"],time_precision="unknown")
add(id="cupe-young-ontario-workers-conference-2026",title="CUPE Ontario Young Ontario Workers Conference 2026",day="2026-11-07",end_day="2026-11-10",source_url=cupe,organizer="CUPE Ontario",
 summary="The CUPE Ontario calendar lists a Young Ontario Workers Conference, but official surfaces conflict on whether it runs November 7–10 or November 19–21.",formats=["union-conference"],type="conference",venue="CUPE Ontario Regional Office / location per final notice",
 civic_domain="labour-governance",authority_level="union",public_role="member-participant",participation_route="CUPE Ontario registration and eligibility rules",public_input_status="member-deliberation",
 collective_action_type="union-conference",public_access_status="membership-or-delegate-restricted",registration_required=True,event_format="in-person",confirmed=False,date_precision="estimated",
 source_inconsistency="Official CUPE Ontario surfaces conflict between November 7–10 and November 19–21, 2026.",qualification_reasons=["official-source-date-conflict"],alternate_dates=["2026-11-19/2026-11-21"],
 access_restrictions=["final dates require organizer confirmation","union eligibility may apply"],time_precision="unknown")

ofl="https://ofl.ca/"
add(id="ofl-injured-ill-worker-conference-2026",title="Ontario Federation of Labour Injured and Ill Worker Conference 2026",day="2026-10-01",clock="09:30",end_day="2026-10-01",end_clock="17:00",source_url=ofl,
 organizer="Ontario Federation of Labour",summary="A full-day conference for injured and ill workers and labour participants at IBEW 353 Hall.",formats=["union-conference"],type="conference",venue="IBEW Local 353 Hall, Toronto",
 civic_domain="labour-governance",authority_level="labour-federation",public_role="participant",participation_route="official OFL registration",public_input_status="participant-deliberation",
 collective_action_type="worker-conference",public_access_status="registration-required",registration_required=True,event_format="in-person")

river="https://freegrassy.net/river-run-2026/"
add(id="river-run-grassy-narrows-2026",title="River Run 2026: Walk with Grassy Narrows for Mercury Justice",day="2026-09-23",clock="12:00",source_url=river,organizer="Grassy Narrows supporters / FreeGrassy.net",
 summary="A Toronto march and public action supporting Grassy Narrows and mercury justice; official-supporting sources conflict between September 23 and September 26.",formats=["rally-march-counterprotest"],type="community",venue="Downtown Toronto — final assembly point pending",
 civic_domain="collective-action",authority_level="civil-society",public_role="march-or-support",participation_route="organizer event page",public_input_status="collective-public-expression",
 collective_action_type="march",public_access_status="public",registration_required=False,event_format="in-person",confirmed=False,date_precision="estimated",
 source_inconsistency="The organizer-support page gives September 23 at noon; CUPE Ontario's calendar gives September 26 at noon.",qualification_reasons=["official-source-date-conflict"],alternate_dates=["2026-09-26T12:00:00-04:00"],
 access_restrictions=["final date and assembly point require confirmation"])

jfw="https://www.justice4workers.org/"
add(id="justice-for-workers-guelph-counter-protest-2026",title="Don’t Let Them Divide Us! counter-protest",day="2026-09-20",clock="08:30",end_day="2026-09-20",end_clock="11:30",source_url=jfw,
 organizer="Justice for Workers",summary="A public counter-protest at Guelph City Hall organized around anti-racist and worker-solidarity messaging.",formats=["rally-march-counterprotest"],type="community",venue="Guelph City Hall",city="Guelph",
 civic_domain="collective-action",authority_level="civil-society",public_role="demonstrate",participation_route="organizer event information",public_input_status="collective-public-expression",collective_action_type="counter-protest",
 public_access_status="public",registration_required=False,event_format="in-person")

labour_council="https://www.labourcouncil.ca/join/"
add_watch(id="toronto-labour-day-parade-2026-watch",title="Toronto Labour Day Parade 2026 — annual watch",marker="2026-09-07",source_url=labour_council,organizer="Toronto & York Region Labour Council",
 summary="The Labour Council identifies the Labour Day Parade as an annual event, but a current 2026 event page and exact route were not yet verified.",formats=["rally-march-counterprotest"],venue="Toronto route pending",civic_domain="collective-action",authority_level="labour-council",public_role="march-or-observe",extra={"collective_action_type":"labour-parade"})
add_watch(id="toronto-day-of-mourning-2027-watch",title="Toronto Day of Mourning 2027 — annual watch",marker="2027-04-28",source_url=labour_council,organizer="Toronto & York Region Labour Council",
 summary="The Labour Council recognizes the National Day of Mourning annually; the 2027 Toronto ceremony details were not yet published.",formats=["rally-march-counterprotest"],venue="Toronto location pending",civic_domain="labour-commemoration",authority_level="labour-council",public_role="commemorate",extra={"collective_action_type":"labour-memorial"})
add_watch(id="toronto-mayworks-2027-watch",title="Mayworks Festival of Working People and the Arts 2027 — annual watch",marker="2027-05-01",source_url=labour_council,organizer="Toronto & York Region Labour Council / Mayworks",
 summary="The Labour Council identifies Mayworks as an annual labour-cultural event, but the 2027 program and dates were not yet published.",formats=["union-conference"],type="festival",venue="Toronto venues pending",civic_domain="labour-culture",authority_level="labour-council",public_role="participate-or-attend",extra={"collective_action_type":"labour-cultural-festival"})
add_watch(id="toronto-labour-day-parade-2027-watch",title="Toronto Labour Day Parade 2027 — annual watch",marker="2027-09-06",source_url=labour_council,organizer="Toronto & York Region Labour Council",
 summary="The Labour Council identifies the parade as annual; the 2027 route and program were not yet published.",formats=["rally-march-counterprotest"],venue="Toronto route pending",civic_domain="collective-action",authority_level="labour-council",public_role="march-or-observe",extra={"collective_action_type":"labour-parade"})

# Existing municipal meeting identities are cross-tagged rather than duplicated.
cross_ids=[
 "research-31d15fc308bb","research-04d92240a8bd","research-909a1105bba4","research-1fc1d5f8f5ec","research-d70221231406",
 "research-5e21b9113546","research-1173f707557a","research-5280a4d73166","research-1c0aa0354759","research-a0a6df07dbdd",
 "research-8ceb17e16054","research-2f4967be4c87","research-2d612dc76ee2","research-336a2faa1e3f","research-a5cd9450c577",
 "research-92ee26b585f9","research-2beeee52e996","research-02adad38091c","research-7474ed411a1d","research-e49da132b73e",
 "research-eeeccbedc820","research-524a9a635c88","research-90f1db761a49","research-769a3ffe3348","research-ad01156d4ea6",
]
cross_tags={i:{"subjects":["Civic, Political, Legal, and Labour"],"topics":["civic-legal-labour"],"civic_legal_labour_formats":["council-board-committee"]} for i in cross_ids}

exclusions=[
 {"title":"Toronto 2026 candidate debates", "reason":"No comprehensive current official debate schedule was published during this pass."},
 {"title":"Toronto 2027 Budget consultation occurrences", "reason":"The next process is retained as a qualified annual watch because current dates were not yet published."},
 {"title":"TDSB regular trustee meetings", "reason":"Regular trustee-meeting scheduling is affected by provincial supervision; exact future public occurrences were not published."},
 {"title":"Law Commission of Ontario protection-order consultation", "reason":"The consultation closed March 13, 2026 and is outside the upcoming window."},
 {"title":"Unbounded recurring protests and organizing meetings", "reason":"A movement or organizer page does not prove a dated future occurrence."},
 {"title":"ACORN and Workers' Action Centre undated future actions", "reason":"No exact current official occurrences were verified for the research window."},
 {"title":"River Run date conflict", "reason":"Retained as one qualified occurrence with both official-supporting dates, rather than duplicated."},
 {"title":"CUPE Young Ontario Workers Conference date conflict", "reason":"Retained as one qualified record with both official date ranges."},
 {"title":"Private union business meetings", "reason":"Internal meetings without a public or member-facing official event page are outside the public discovery surface."},
]

# Reconcile exact title/date identities where a prior record exists but lacks an ID.
def norm(value): return re.sub(r"[^a-z0-9]+"," ",str(value or "").lower()).strip()
def dkey(value): return str(value or "")[:10]
manual_path=ROOT/"data"/"manual-events.json"; public_path=ROOT/"data"/"polymyth-seminar-events.json"
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
  if original!=old["id"]: legacy_reconciled.append({"existing_id":old["id"],"provisional_id":original,"title":proposed["title"],"date":proposed["date"]})
manual_path.write_text(json.dumps(manual_doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

ids=[r["id"] for r in records]
assert len(ids)==len(set(ids)),f"Set 12 proposed IDs are not unique: {[k for k,v in collections.Counter(ids).items() if v>1]}"
result=apply_import(root=ROOT,config=CONFIG,records=records,cross_tags=cross_tags,exclusions=exclusions)
manual_doc=json.loads(manual_path.read_text(encoding="utf-8")); meta=manual_doc.get(CONFIG["metadata_key"],{})
meta.update({
 "legacy_records_reconciled":max(int(previous_meta.get("legacy_records_reconciled") or 0),len(legacy_reconciled)),
 "legacy_reconciliation":legacy_reconciled or previous_meta.get("legacy_reconciliation",[]),
 "net_new_records":max(int(previous_meta.get("net_new_records") or 0),result["added"]),
 "initial_records_added":max(int(previous_meta.get("initial_records_added") or 0),int(previous_meta.get("net_new_records") or 0),result["added"]),
 "records_added_latest_run":result["added"],"existing_records_refreshed_latest_run":result["refreshed"],
 "parent_records":len([r for r in records if r.get("series_role")=="parent"]),
 "child_occurrences":len([r for r in records if r.get("series_role")=="child"]),
 "confirmed_records":len([r for r in records if r.get("confirmation_status")=="confirmed"]),
 "qualified_records":len([r for r in records if r.get("confirmation_status")!="confirmed"]),
 "court_hearings":len([r for r in records if "court-tribunal-hearing" in (r.get(CONFIG["field_name"]) or []) and r.get("series_role")=="child"]),
 "election_records":len([r for r in records if r.get("civic_domain")=="election"]),
})
manual_doc[CONFIG["metadata_key"]]=meta
manual_path.write_text(json.dumps(manual_doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
ledger_path=ROOT/"data"/CONFIG["research_filename"]
ledger=json.loads(ledger_path.read_text(encoding="utf-8")); ledger["legacy_reconciliation"]=legacy_reconciled
ledger_path.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
research_copy=ROOT/"data"/"research"/CONFIG["research_dirname"] / "research-ledger.json"
research_copy.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({**result,**{k:meta[k] for k in ["legacy_records_reconciled","parent_records","child_occurrences","confirmed_records","qualified_records","court_hearings","election_records"]}},indent=2))
