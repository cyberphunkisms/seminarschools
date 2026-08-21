#!/usr/bin/env python3
"""Idempotently import Polymythcal Set 4 — Social Studies.

Scope: civics and parliamentary participation, economics, geography,
political science, sociology, anthropology, religious studies, Model UN,
legal education, Indigenous education, and cross-field social-science funding.
Confirmed dates remain distinct from annual-watch monitoring markers.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
MANUAL = ROOT / "data" / "manual-events.json"
SOURCES = ROOT / "scripts" / "sources.json"
RESEARCH_FILE = ROOT / "data" / "polymythcal-research-set-4-social-studies-2026-08-13.json"
RESEARCH_DIR = ROOT / "data" / "research" / "polymythcal-set4-social-studies-2026-08-13"
SRC = "manual-polymythcal-social-studies-set4-2026-08-13"
RESEARCH_SET = "4-Social-Studies"
CHECKED = "2026-08-13T20:08:00-04:00"


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:72] or "source"


def source_root(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}/" if parts.scheme and parts.netloc else url


def identity(source_url: str, title: str, date: str) -> str:
    return hashlib.sha256(f"{source_url}::{title}::{date[:10]}".encode()).hexdigest()[:20]


def grade_fields(age_band: str | None) -> dict:
    """Extract exact Canadian grade claims only when stated literally."""
    text = str(age_band or "").replace("–", "-").replace("—", "-")
    grades: list[str] = []
    for start, end in re.findall(r"\bGrades?\s*(\d{1,2})\s*-\s*(?:Grade\s*)?(\d{1,2})\b", text, re.I):
        a, b = int(start), int(end)
        if 1 <= a <= b <= 12:
            grades.extend(f"Grade {n}" for n in range(a, b + 1))
    for number in re.findall(r"\bGrade\s*(\d{1,2})\b", text, re.I):
        n = int(number)
        if 1 <= n <= 12:
            grades.append(f"Grade {n}")
    grades = list(dict.fromkeys(grades))
    levels: list[str] = []
    patterns = [
        ("elementary", r"\b(elementary|primary)\b"),
        ("secondary", r"\b(secondary|high school)\b"),
        ("CEGEP", r"\bCEGEP\b"),
        ("college", r"\bcollege\b"),
        ("undergraduate", r"\bundergraduate|first university degree|university student\b"),
        ("graduate", r"\bgraduate|master(?:'s|s)?|doctoral|PhD\b"),
        ("postdoctoral", r"\bpostdoctoral|post-doc\b"),
        ("educator", r"\beducator|teacher|pedagogical adviser\b"),
        ("professional", r"\bprofessional|faculty|scholar|researcher\b"),
        ("open", r"\bopen public|open to all\b"),
    ]
    for label, pattern in patterns:
        if re.search(pattern, text, re.I):
            levels.append(label)
    out: dict = {"exact_grades": grades, "education_levels": levels}
    if grades:
        nums = [int(re.search(r"\d+", g).group()) for g in grades]
        out["grade_min"] = min(nums)
        out["grade_max"] = max(nums)
    age = re.search(r"\bAges?\s*(\d{1,2})\s*-\s*(\d{1,2})\b", text, re.I)
    if age:
        out["age_range"] = {"min": int(age.group(1)), "max": int(age.group(2))}
    return out


def rec(
    id: str,
    title: str,
    date: str,
    source_url: str,
    organizer: str,
    *,
    summary: str,
    subfields: list[str],
    record_kind: str = "opportunity",
    type: str = "contest",
    end_date: str | None = None,
    confirmed: bool = True,
    date_precision: str = "date",
    time_precision: str = "unknown",
    source_id: str | None = None,
    source_language: str = "en",
    source_languages: list[str] | None = None,
    age_band: str | None = None,
    education_levels: list[str] | None = None,
    exact_grades: list[str] | None = None,
    local_grade_system: dict | None = None,
    city: str = "Online",
    province: str = "",
    country: str = "Canada",
    venue: str = "Online / organizer-defined",
    timezone: str = "America/Toronto",
    opportunity_kind: str | None = None,
    participation_unit: str | None = None,
    access_route: str | None = None,
    prize_form: str | None = None,
    institutional_restriction: str | None = None,
    registration_url: str | None = None,
    application_url: str | None = None,
    submission_url: str | None = None,
    parent_id: str | None = None,
    series_title: str | None = None,
    series_role: str | None = None,
    calendar_stage: str | None = None,
    source_inconsistency: str | None = None,
    source_notes: str | None = None,
    qualification_reasons: list[str] | None = None,
    recurrence_note: str | None = None,
    deadline_confidence: str | None = None,
    lifecycle_status: str = "active",
    ai_rule: str | None = None,
    tags: list[str] | None = None,
    extra: dict | None = None,
) -> dict:
    sid = source_id or slug(organizer)
    reasons = list(qualification_reasons or [])
    if not confirmed and not reasons:
        reasons = ["current-edition-unconfirmed", "date-unconfirmed", "time-unconfirmed"]
    event = {
        "id": id,
        "identity_key": identity(source_url, title, date),
        "date": date,
        "end_date": end_date,
        "title": title,
        "type": type,
        "secondary_types": ["social-studies"],
        "speaker_or_director": organizer,
        "organizer": organizer,
        "venue": venue,
        "source_url": source_url,
        "source_id": sid,
        "source_name": organizer,
        "description": summary,
        "age_band": age_band,
        "subjects": ["Social Studies", *subfields],
        "topics": ["social studies", *[s.lower() for s in subfields]],
        "opportunity_kind": opportunity_kind,
        "tags": list(dict.fromkeys(["Set 4", "social studies", *(tags or [])])),
        "parent_id": parent_id,
        "series_title": series_title,
        "series_role": series_role,
        "calendar_stage": calendar_stage,
        "is_parent_festival": False,
        "attendance_confirmed": True,
        "confidence": 96 if confirmed else 78,
        "record_kind": record_kind,
        "date_precision": date_precision,
        "time_precision": time_precision,
        "deadline_confidence": deadline_confidence or ("official-current-cycle" if confirmed else "annual-watch-date-unannounced"),
        "source_notes": source_notes or "Official or organizer-controlled source reviewed for Polymythcal Set 4 on 2026-08-13.",
        "source_inconsistency": source_inconsistency,
        "recurrence_note": recurrence_note,
        "source_quality": "official-or-institutional",
        "source_language": source_language,
        "source_languages": source_languages or [source_language],
        "source_language_method": "source-declared",
        "platform_adapter": "manual",
        "first_seen_at": CHECKED,
        "last_checked_at": CHECKED,
        "scraped_at": CHECKED,
        "lifecycle_status": lifecycle_status,
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
        "research_source_ref": RESEARCH_SET,
        "research_priority": "comprehensive-set-import",
        "research_registry_status": "included",
        "research_batch": SRC,
        "research_set": RESEARCH_SET,
        "social_studies_subfields": subfields,
        "participation_unit": participation_unit,
        "access_route": access_route,
        "prize_form": prize_form,
        "institutional_restriction": institutional_restriction,
        "registration_url": registration_url,
        "application_url": application_url,
        "submission_url": submission_url,
        "local_grade_system": local_grade_system,
        "ai_rule": ai_rule,
        "_upsert_batches": [SRC],
        "entry_family": "social-studies",
        "_src": SRC,
    }
    structured = grade_fields(age_band)
    if exact_grades is not None:
        structured["exact_grades"] = exact_grades
        nums = [int(re.search(r"\d+", g).group()) for g in exact_grades if re.search(r"\d+", g)]
        if nums:
            structured["grade_min"], structured["grade_max"] = min(nums), max(nums)
    if education_levels is not None:
        structured["education_levels"] = education_levels
    event.update({k: v for k, v in structured.items() if v not in (None, [], {})})
    if extra:
        event.update(extra)
    return {k: v for k, v in event.items() if v is not None and v != []}


def watch(id: str, title: str, marker: str, source_url: str, organizer: str, *, summary: str, subfields: list[str], **kwargs) -> dict:
    return rec(
        id,
        title,
        marker,
        source_url,
        organizer,
        summary=summary + " The displayed date is a monitoring marker, not a confirmed deadline or event date.",
        subfields=subfields,
        confirmed=False,
        date_precision="estimated",
        time_precision="unknown",
        qualification_reasons=kwargs.pop("qualification_reasons", ["current-edition-unconfirmed", "date-unconfirmed", "time-unconfirmed"]),
        deadline_confidence="annual-watch-date-unannounced",
        **kwargs,
    )


records: list[dict] = []
A = records.append

CIV = ["Civics", "Politics", "Government"]
ECO = ["Economics"]
GEO = ["Geography"]
POL = ["Political Science", "Politics"]
SOC = ["Sociology"]
ANT = ["Anthropology"]
REL = ["Religious Studies"]
IR = ["International Relations", "Model United Nations"]
LAW = ["Law", "Civics"]
IND = ["Indigenous Studies", "Education"]
FUND = ["Social Sciences", "Research Funding"]

# ---------------------------------------------------------------------------
# CIVICS, PARLIAMENTS, PAGES, AND INTERNSHIPS
# ---------------------------------------------------------------------------
A(rec("ontario-model-parliament-2027-series", "Ontario Model Parliament 2027", "2026-06-08T00:00:00-04:00", "https://www.ola.org/en/visit-learn/programs/model-parliament-high-school-students", "Legislative Assembly of Ontario", summary="Parent record for the Grade 10–12 Ontario Model Parliament cycle: applications run June 8–October 4, 2026, the virtual program begins November 5, and the onsite Toronto program runs February 24–26, 2027.", subfields=CIV, record_kind="opportunity", type="program", end_date="2027-02-26T23:59:00-05:00", age_band="Grades 10–12 in Ontario", opportunity_kind="model parliament program", participation_unit="individual student", access_route="direct application", series_title="Ontario Model Parliament 2027", series_role="parent", calendar_stage="program cycle", city="Toronto", province="Ontario", venue="Legislative Assembly of Ontario / virtual preparation", application_url="https://www.ola.org/en/visit-learn/programs/model-parliament-high-school-students"))
A(rec("ontario-model-parliament-2027-application-deadline", "Ontario Model Parliament 2027 application deadline", "2026-10-04T23:59:00-04:00", "https://www.ola.org/en/visit-learn/programs/model-parliament-high-school-students", "Legislative Assembly of Ontario", summary="Application deadline for the 2027 Ontario Model Parliament program for civic-minded Ontario students in Grades 10–12.", subfields=CIV, age_band="Grades 10–12 in Ontario", opportunity_kind="application deadline", participation_unit="individual student", access_route="direct application", parent_id="ontario-model-parliament-2027-series", series_title="Ontario Model Parliament 2027", series_role="child", calendar_stage="application closing", application_url="https://www.ola.org/en/visit-learn/programs/model-parliament-high-school-students"))
A(rec("ontario-model-parliament-2027-virtual-start", "Ontario Model Parliament 2027 virtual program begins", "2026-11-05T00:00:00-05:00", "https://www.ola.org/en/visit-learn/programs/model-parliament-high-school-students", "Legislative Assembly of Ontario", summary="The virtual preparation component of the 2027 Ontario Model Parliament program begins.", subfields=CIV, record_kind="event", type="workshop", age_band="Grades 10–12 in Ontario", parent_id="ontario-model-parliament-2027-series", series_title="Ontario Model Parliament 2027", series_role="child", calendar_stage="virtual program start", city="Online", venue="Online"))
A(rec("ontario-model-parliament-2027-onsite", "Ontario Model Parliament 2027 onsite program", "2027-02-24T00:00:00-05:00", "https://www.ola.org/en/visit-learn/programs/model-parliament-high-school-students", "Legislative Assembly of Ontario", summary="Three-day onsite parliamentary simulation for selected Ontario students.", subfields=CIV, record_kind="event", type="conference", end_date="2027-02-26T23:59:00-05:00", age_band="Grades 10–12 in Ontario", parent_id="ontario-model-parliament-2027-series", series_title="Ontario Model Parliament 2027", series_role="child", calendar_stage="onsite program", city="Toronto", province="Ontario", venue="Legislative Assembly of Ontario"))
A(rec("ontario-page-program-spring-2027-deadline", "Ontario Legislative Page Program spring 2027 application deadline", "2026-11-15T23:59:00-05:00", "https://www.ola.org/en/visit-learn/programs/page-program/application-process", "Legislative Assembly of Ontario", summary="Closing date for the September 15–November 15 application window. The program explicitly serves Ontario students in Grades 7–8; Grade 6 students are not eligible.", subfields=CIV, age_band="Grades 7–8 in Ontario", opportunity_kind="page program application", participation_unit="individual student", access_route="direct application with school consents", calendar_stage="application closing", application_url="https://www.ola.org/en/visit-learn/programs/page-program/application-process", source_inconsistency="Assembly pages describe the twice-yearly application window consistently, but older FAQ material contains stale pandemic-era language."))
A(rec("ontario-page-program-fall-2027-deadline", "Ontario Legislative Page Program fall 2027 application deadline", "2027-06-15T23:59:00-04:00", "https://www.ola.org/en/visit-learn/programs/page-program/application-process", "Legislative Assembly of Ontario", summary="Closing date for the April 15–June 15 application window for Ontario students in Grades 7–8.", subfields=CIV, age_band="Grades 7–8 in Ontario", opportunity_kind="page program application", participation_unit="individual student", access_route="direct application with school consents", calendar_stage="application closing", application_url="https://www.ola.org/en/visit-learn/programs/page-program/application-process"))
A(rec("quebec-parlement-ecolier-2027-registration-deadline", "Parlement écolier 2027 registration deadline", "2027-01-25T23:59:00-05:00", "https://www.paricilademocratie.com/participer/24-parlement-ecolier", "Assemblée nationale du Québec", summary="Registration deadline for the 29th Parlement écolier, a parliamentary simulation for Grade 6 primary-school students in Québec.", subfields=CIV, source_language="fr", source_languages=["fr"], age_band="Grade 6 primary students in Québec", opportunity_kind="school delegation registration", participation_unit="school delegation of 2–4 students per class", access_route="teacher or school registration", parent_id="quebec-parlement-ecolier-2027", series_title="Parlement écolier 2027", series_role="child", calendar_stage="registration closing", city="Québec", province="Québec", registration_url="https://www.paricilademocratie.com/participer/24-parlement-ecolier"))
A(rec("quebec-parlement-ecolier-2027", "Parlement écolier 2027", "2027-05-06T00:00:00-04:00", "https://www.paricilademocratie.com/participer/24-parlement-ecolier", "Assemblée nationale du Québec", summary="Two-day parliamentary simulation for Grade 6 primary-school students, including chamber debate, committee work, and an official meal.", subfields=CIV, record_kind="event", type="conference", end_date="2027-05-07T23:59:00-04:00", source_language="fr", source_languages=["fr"], age_band="Grade 6 primary students in Québec", participation_unit="school delegation of 2–4 students per class", series_title="Parlement écolier 2027", series_role="parent", calendar_stage="onsite program", city="Québec", province="Québec", venue="Assemblée nationale du Québec"))
A(rec("quebec-parlement-des-jeunes-2027", "Parlement des jeunes 2027", "2027-03-31T00:00:00-04:00", "https://www.paricilademocratie.com/participer/26-parlement-des-jeunes", "Assemblée nationale du Québec", summary="The 24th youth parliament simulation for Québec students in Secondary 3–4, focused on legislative procedure, debate, oral and written communication, and civic participation.", subfields=CIV, record_kind="event", type="conference", end_date="2027-04-02T23:59:00-04:00", source_language="fr", source_languages=["fr"], age_band="Québec Secondary 3–4 students", education_levels=["secondary"], local_grade_system={"system":"Québec secondary","levels":["Secondary 3","Secondary 4"]}, participation_unit="school delegation", series_title="Parlement des jeunes 2027", series_role="parent", calendar_stage="onsite program", city="Québec", province="Québec", venue="Assemblée nationale du Québec"))
A(watch("quebec-parlement-des-jeunes-2027-registration-watch", "Parlement des jeunes 2027 registration watch", "2026-09-01T00:00:00-04:00", "https://www.paricilademocratie.com/participer/26-parlement-des-jeunes", "Assemblée nationale du Québec", summary="The 2027 event dates are confirmed, but a clean universal registration deadline was not published on the retrieved public presentation page.", subfields=CIV, source_language="fr", source_languages=["fr"], age_band="Québec Secondary 3–4 students", education_levels=["secondary"], local_grade_system={"system":"Québec secondary","levels":["Secondary 3","Secondary 4"]}, opportunity_kind="registration watch", parent_id="quebec-parlement-des-jeunes-2027", series_role="child", calendar_stage="registration watch"))
A(rec("quebec-forum-etudiant-2027", "Forum étudiant 2027", "2027-01-11T00:00:00-05:00", "https://www.paricilademocratie.com/participer/31-forum-etudiant", "Assemblée nationale du Québec", summary="Five-day parliamentary simulation for Québec college and CEGEP students.", subfields=CIV, record_kind="event", type="conference", end_date="2027-01-15T23:59:00-05:00", source_language="fr", source_languages=["fr"], age_band="CEGEP and college students in Québec", education_levels=["CEGEP","college"], participation_unit="student delegation", series_title="Forum étudiant 2027", series_role="parent", calendar_stage="onsite program", city="Québec", province="Québec", venue="Assemblée nationale du Québec"))
A(watch("quebec-forum-etudiant-2027-registration-watch", "Forum étudiant 2027 registration watch", "2026-09-01T00:00:00-04:00", "https://www.paricilademocratie.com/participer/31-forum-etudiant", "Assemblée nationale du Québec", summary="The January 11–15 event is confirmed; the public page did not expose a single current registration deadline in the retrieved text.", subfields=CIV, source_language="fr", source_languages=["fr"], age_band="CEGEP and college students in Québec", education_levels=["CEGEP","college"], opportunity_kind="registration watch", parent_id="quebec-forum-etudiant-2027", series_role="child", calendar_stage="registration watch"))
A(rec("quebec-seminaire-des-profs-2027", "Séminaire des profs 2027", "2027-04-21T00:00:00-04:00", "https://www.paricilademocratie.com/participer/4478-seminaire-des-profs", "Assemblée nationale du Québec", summary="Three-day parliamentary and civic-education seminar for teachers, pedagogical advisers, school spiritual-care and community-involvement staff, and education students.", subfields=["Civics","Education"], record_kind="event", type="workshop", end_date="2027-04-23T23:59:00-04:00", source_language="fr", source_languages=["fr"], age_band="Teachers, pedagogical advisers, AVSEC staff, and education students", education_levels=["educator","undergraduate","graduate"], participation_unit="individual educator or education student", series_title="Séminaire des profs 2027", series_role="parent", calendar_stage="onsite seminar", city="Québec", province="Québec", venue="Assemblée nationale du Québec"))
A(watch("quebec-seminaire-des-profs-2027-registration-watch", "Séminaire des profs 2027 registration watch", "2026-09-01T00:00:00-04:00", "https://www.paricilademocratie.com/participer/4478-seminaire-des-profs", "Assemblée nationale du Québec", summary="The April 21–23 seminar is confirmed; the current public source did not expose a universal registration closing date in the retrieved presentation text.", subfields=["Civics","Education"], source_language="fr", source_languages=["fr"], age_band="Teachers, pedagogical advisers, AVSEC staff, and education students", education_levels=["educator","undergraduate","graduate"], opportunity_kind="registration watch", parent_id="quebec-seminaire-des-profs-2027", series_role="child", calendar_stage="registration watch"))
A(rec("jcb-internships-2027-28-applications-open", "Jean-Charles-Bonenfant Foundation internships 2027–28 applications open", "2026-11-15T00:00:00-05:00", "https://www.paricilademocratie.com/participer/980-stages-de-la-fondation-jean-charles-bonenfant", "Fondation Jean-Charles-Bonenfant / Assemblée nationale du Québec", summary="Application opening for five ten-month Québec parliamentary internships for university graduates; the public program page describes a C$28,000 award.", subfields=CIV, source_language="fr", source_languages=["fr"], age_band="University graduates", education_levels=["undergraduate","graduate"], opportunity_kind="parliamentary internship", participation_unit="individual applicant", access_route="direct application", calendar_stage="applications open", city="Québec", province="Québec", application_url="https://www.paricilademocratie.com/participer/980-stages-de-la-fondation-jean-charles-bonenfant", prize_form="C$28,000 internship award", source_inconsistency="A linked Assembly page still displays the 2025–26 cycle and a February 15, 2026 deadline; the 2027–28 opening is preserved separately."))
A(watch("quebec-assembly-page-program-2027-watch", "Québec National Assembly Page Program 2027–28 watch", "2027-01-15T00:00:00-05:00", "https://www.assnat.qc.ca/fr/lien/12587.html", "Assemblée nationale du Québec", summary="Paid page program for 14 undergraduate students, normally running September–June and carrying six academic credits; the 2026–27 cycle is closed and the next dates are pending.", subfields=CIV, source_language="fr", source_languages=["fr"], age_band="Undergraduate students", education_levels=["undergraduate"], opportunity_kind="page program", participation_unit="individual student", access_route="institution-linked application"))
A(watch("house-of-commons-page-program-2027-28-opening-watch", "House of Commons Page Program 2027–28 application opening watch", "2026-09-01T00:00:00-04:00", "https://www.ourcommons.ca/about/pageprogram/become-e.html", "House of Commons of Canada", summary="The House states that applications for the 2027–28 cohort will open in September 2026. The program hires 40 students entering first year at an eligible National Capital Region postsecondary institution.", subfields=CIV, age_band="Graduating high-school students entering first-year postsecondary study", education_levels=["secondary","undergraduate"], opportunity_kind="federal page program", participation_unit="individual applicant", access_route="direct application", calendar_stage="application opening month", institutional_restriction="Eligible National Capital Region postsecondary institution; Canadian citizen or permanent resident; bilingual requirements apply.", source_inconsistency="The 2027–28 page includes a stale eligibility line referring to beginning studies in September 2026.", qualification_reasons=["date-unconfirmed","time-unconfirmed"]))
A(rec("olip-2027-28-applications-open", "Ontario Legislature Internship Programme 2027–28 applications open", "2026-12-01T00:00:00-05:00", "https://www.olipinterns.ca/apply-to-olip", "Ontario Legislature Internship Programme", summary="Applications open for the 2027–28 paid, non-partisan Ontario legislative internship.", subfields=CIV, age_band="Recent university graduates", education_levels=["undergraduate","graduate"], opportunity_kind="legislative internship", participation_unit="individual applicant", access_route="direct application", calendar_stage="applications open", application_url="https://www.olipinterns.ca/apply-to-olip", prize_form="C$55,000 salary plus C$1,000 paper award"))
A(rec("olip-2027-28-application-deadline", "Ontario Legislature Internship Programme 2027–28 application deadline", "2027-01-31T23:59:00-05:00", "https://www.olipinterns.ca/apply-to-olip", "Ontario Legislature Internship Programme", summary="Application deadline for recent university graduates who are Canadian citizens or permanent residents and available full-time from September through June.", subfields=CIV, age_band="Recent university graduates", education_levels=["undergraduate","graduate"], opportunity_kind="legislative internship application", participation_unit="individual applicant", access_route="direct application", calendar_stage="application closing", application_url="https://www.olipinterns.ca/apply-to-olip", prize_form="C$55,000 salary plus C$1,000 paper award"))
A(watch("parliamentary-internship-programme-2027-28-opening-watch", "Parliamentary Internship Programme 2027–28 application opening watch", "2026-12-01T00:00:00-05:00", "https://pip-psp.org/apply/?lang=en", "Parliamentary Internship Programme", summary="The federal Parliamentary Internship Programme states that the 2027–28 application cycle will open in December 2026; the exact opening and closing dates remain pending.", subfields=CIV, age_band="University graduates", education_levels=["undergraduate","graduate"], opportunity_kind="federal parliamentary internship", participation_unit="individual applicant", access_route="direct application", ai_rule="Generative AI is prohibited for the two personal statements under the current application guidance."))
A(watch("senate-page-program-2027-28-watch", "Senate Page Program 2027–28 watch", "2026-09-01T00:00:00-04:00", "https://sencanada.ca/en/about/careers/page-program/selection-process/", "Senate of Canada", summary="Annual paid page program for undergraduate students in the National Capital Region. The Senate normally recruits about eight new pages into a 17-member team; the next exact application window is pending.", subfields=CIV, age_band="Undergraduate students completing a first university degree", education_levels=["undergraduate"], opportunity_kind="federal page program", participation_unit="individual applicant", access_route="direct application", institutional_restriction="National Capital Region study, bilingual capacity, and Canadian citizenship or permanent residency requirements apply."))
A(watch("civix-youth-parliament-canada-2027-watch", "CIVIX Youth Parliament of Canada 2027 watch", "2027-01-01T00:00:00-05:00", "https://civix.ca/", "CIVIX", summary="Bilingual Ottawa-based youth parliament for participants approximately ages 16–20; the exact 2027 cycle remains pending.", subfields=CIV, age_band="Ages 16–20", opportunity_kind="youth parliament", participation_unit="individual applicant", access_route="application"))

# ---------------------------------------------------------------------------
# ECONOMICS
# ---------------------------------------------------------------------------
A(watch("canadian-economics-olympiad-2027-registration-opening-watch", "Canadian Economics Olympiad 2027 registration opening watch", "2027-01-01T00:00:00-05:00", "https://www.ceo-oec.ca/", "Canadian Economics Olympiad", summary="The national high-school economics competition states that 2027 registration will open in January 2027. It is an official Canadian qualifier for international economics competitions.", subfields=ECO, age_band="High-school students", education_levels=["secondary"], opportunity_kind="economics olympiad", participation_unit="individual student", access_route="direct registration"))
A(watch("bank-of-canada-governors-challenge-2027-watch", "Bank of Canada Governor's Challenge 2027 watch", "2027-01-01T00:00:00-05:00", "https://www.bankofcanada.ca/research/engaging-with-the-research-community/governors-challenge/", "Bank of Canada", summary="Annual undergraduate team competition simulating monetary-policy analysis and decision-making; exact 2027 registration and competition dates remain pending.", subfields=ECO, age_band="Undergraduate university students", education_levels=["undergraduate"], opportunity_kind="monetary-policy case competition", participation_unit="university team", access_route="institutional registration"))
A(rec("canadian-economics-association-2027-conference", "Canadian Economics Association Annual Meeting 2027", "2027-05-28T00:00:00-04:00", "https://www.economics.ca/annual-meeting", "Canadian Economics Association", summary="Annual economics meeting at Wilfrid Laurier University in Waterloo, May 28–29, 2027.", subfields=ECO, record_kind="event", type="conference", end_date="2027-05-29T23:59:00-04:00", age_band="Economists, researchers, graduate students, and other participants", education_levels=["graduate","professional"], city="Waterloo", province="Ontario", venue="Wilfrid Laurier University", series_title="Canadian Economics Association 2027", series_role="parent", calendar_stage="conference"))
A(watch("canadian-economics-association-2027-cfp-watch", "Canadian Economics Association 2027 call for papers watch", "2026-10-01T00:00:00-04:00", "https://www.economics.ca/annual-meeting", "Canadian Economics Association", summary="The May 28–29, 2027 meeting is confirmed; its paper-submission deadline was not yet published on the retrieved annual-meeting surface.", subfields=ECO, age_band="Economists, researchers, and graduate students", education_levels=["graduate","professional"], opportunity_kind="conference submission", parent_id="canadian-economics-association-2027-conference", series_role="child", calendar_stage="CFP watch"))
A(rec("doug-purvis-memorial-prize-2027", "Doug Purvis Memorial Prize 2027 deadline", "2027-03-09T23:59:00-05:00", "https://www.economics.ca/doug-purvis-memorial-prize", "Canadian Economics Association", summary="Nomination deadline for work on Canadian economic policy published in 2026.", subfields=ECO, opportunity_kind="economic-policy prize", participation_unit="author or nominator", access_route="nomination", prize_form="professional prize", age_band="Professional economists and authors", education_levels=["professional"], calendar_stage="nomination closing"))
A(watch("cea-undergraduate-poster-award-2027-watch", "Canadian Economics Association undergraduate poster award 2027 watch", "2027-02-01T00:00:00-05:00", "https://www.economics.ca/", "Canadian Economics Association", summary="Recurring undergraduate research-poster opportunity associated with the annual meeting; exact 2027 rules and deadline remain pending.", subfields=ECO, age_band="Undergraduate students", education_levels=["undergraduate"], opportunity_kind="undergraduate poster award", participation_unit="individual or coauthored student poster"))

# ---------------------------------------------------------------------------
# GEOGRAPHY
# ---------------------------------------------------------------------------
A(watch("canadian-geographic-challenge-2027-series", "Canadian Geographic Challenge 2027 series watch", "2027-01-01T00:00:00-05:00", "https://challenge.canadiangeographic.ca/about-the-challenge/rules-and-regulations/", "Canadian Geographic Education", summary="Parent watch for the bilingual national geography competition. Current rules define three distinct levels, but the 2027 cycle dates are not yet published.", subfields=GEO, age_band="Grades 4–10 and ages 16–19 outside postsecondary study", opportunity_kind="geography competition", participation_unit="individual student or school-administered participant", access_route="school or organizer registration", series_title="Canadian Geographic Challenge 2027", series_role="parent", calendar_stage="annual cycle watch"))
A(watch("canadian-geographic-challenge-level-1-2027-watch", "Canadian Geographic Challenge Level 1 — 2027 watch", "2027-01-01T00:00:00-05:00", "https://challenge.canadiangeographic.ca/about-the-challenge/rules-and-regulations/", "Canadian Geographic Education", summary="Level 1 eligibility is explicitly Grades 4–6; the 2027 competition dates remain pending.", subfields=GEO, age_band="Grades 4–6", opportunity_kind="geography competition", participation_unit="individual student", parent_id="canadian-geographic-challenge-2027-series", series_role="child", calendar_stage="level 1 watch"))
A(watch("canadian-geographic-challenge-level-2-2027-watch", "Canadian Geographic Challenge Level 2 — 2027 watch", "2027-01-01T00:00:00-05:00", "https://challenge.canadiangeographic.ca/about-the-challenge/rules-and-regulations/", "Canadian Geographic Education", summary="Level 2 eligibility is explicitly Grades 7–10; the 2027 competition dates remain pending.", subfields=GEO, age_band="Grades 7–10", opportunity_kind="geography competition", participation_unit="individual student", parent_id="canadian-geographic-challenge-2027-series", series_role="child", calendar_stage="level 2 watch"))
A(watch("canadian-geographic-challenge-level-3-2027-watch", "Canadian Geographic Challenge Level 3 — 2027 watch", "2027-01-01T00:00:00-05:00", "https://challenge.canadiangeographic.ca/about-the-challenge/rules-and-regulations/", "Canadian Geographic Education", summary="Level 3 is for ages 16–19 who are not enrolled in postsecondary education; the 2027 competition dates remain pending.", subfields=GEO, age_band="Ages 16–19, not enrolled in postsecondary education", education_levels=["secondary"], opportunity_kind="geography competition", participation_unit="individual student", parent_id="canadian-geographic-challenge-2027-series", series_role="child", calendar_stage="level 3 watch"))
A(watch("canadian-association-geographers-2027-conference-watch", "Canadian Association of Geographers 2027 conference watch", "2027-05-01T00:00:00-04:00", "https://www.cag-acg.ca/", "Canadian Association of Geographers", summary="The association's 2027 meeting details were not yet published on the retrieved official surface.", subfields=GEO, age_band="Geographers, researchers, and students", education_levels=["undergraduate","graduate","professional"], record_kind="event", type="conference", opportunity_kind="conference watch", series_title="CAG 2027", series_role="parent"))
A(watch("canadian-association-geographers-2027-cfp-watch", "Canadian Association of Geographers 2027 call for papers watch", "2027-01-01T00:00:00-05:00", "https://www.cag-acg.ca/", "Canadian Association of Geographers", summary="Call-for-papers watch linked to the unannounced 2027 conference cycle.", subfields=GEO, age_band="Geographers, researchers, and students", education_levels=["undergraduate","graduate","professional"], opportunity_kind="conference submission", parent_id="canadian-association-geographers-2027-conference-watch", series_role="child", calendar_stage="CFP watch"))

# ---------------------------------------------------------------------------
# POLITICAL SCIENCE
# ---------------------------------------------------------------------------
A(rec("cpsa-2027-conference", "Canadian Political Science Association Conference 2027", "2027-05-26T00:00:00-07:00", "https://cpsa-acsp.ca/2026-conference/", "Canadian Political Science Association", summary="Annual conference at the University of British Columbia, May 26–28, 2027.", subfields=POL, record_kind="event", type="conference", end_date="2027-05-28T23:59:00-07:00", age_band="Political scientists, researchers, and students", education_levels=["graduate","professional"], city="Vancouver", province="British Columbia", timezone="America/Vancouver", venue="University of British Columbia", series_title="CPSA 2027", series_role="parent", calendar_stage="conference", source_inconsistency="The official page title says 2027 while its URL slug remains /2026-conference/."))
A(watch("cpsa-2027-cfp-watch", "Canadian Political Science Association 2027 call for papers watch", "2026-09-01T00:00:00-04:00", "https://cpsa-acsp.ca/2026-conference/", "Canadian Political Science Association", summary="The May 26–28 conference is confirmed; the submission closing date was not yet available on the retrieved page.", subfields=POL, age_band="Political scientists, researchers, and students", education_levels=["graduate","professional"], opportunity_kind="conference submission", parent_id="cpsa-2027-conference", series_role="child", calendar_stage="CFP watch", source_inconsistency="The official page title says 2027 while its URL slug remains /2026-conference/."))
A(rec("cpsa-vincent-lemieux-prize-2027", "CPSA Vincent Lemieux Prize 2027 nomination deadline", "2027-02-07T23:59:00-05:00", "https://cpsa-acsp.ca/prizes-vincent-lemieux-prize/", "Canadian Political Science Association", summary="Institutional nomination deadline for the C$1,000 prize recognizing the best Canadian political-science PhD thesis defended in 2025 or 2026.", subfields=POL, age_band="Recent political-science PhD graduates", education_levels=["graduate"], opportunity_kind="doctoral thesis prize", participation_unit="individual nominee", access_route="institutional nomination", prize_form="C$1,000", institutional_restriction="Eligible Canadian political-science doctoral thesis defended in 2025 or 2026.", calendar_stage="nomination closing"))
A(watch("cpsa-undergraduate-poster-prize-2027-watch", "CPSA undergraduate poster prize 2027 watch", "2027-02-01T00:00:00-05:00", "https://cpsa-acsp.ca/", "Canadian Political Science Association", summary="Recurring student poster opportunity associated with the annual conference; exact 2027 rules and deadline remain pending.", subfields=POL, age_band="Undergraduate students", education_levels=["undergraduate"], opportunity_kind="undergraduate poster prize", participation_unit="individual or student team"))
A(watch("cpsa-three-minute-thesis-2027-watch", "CPSA Three-Minute Thesis competition 2027 watch", "2027-02-01T00:00:00-05:00", "https://cpsa-acsp.ca/", "Canadian Political Science Association", summary="Recurring political-science research communication competition; exact 2027 eligibility and deadline remain pending.", subfields=POL, age_band="Graduate students", education_levels=["graduate"], opportunity_kind="three-minute thesis competition", participation_unit="individual student"))

# ---------------------------------------------------------------------------
# SOCIOLOGY AND ANTHROPOLOGY
# ---------------------------------------------------------------------------
A(rec("canadian-sociological-association-2027-conference", "Canadian Sociological Association Conference 2027", "2027-05-31T00:00:00-07:00", "https://www.csa-scs.ca/news/conference-news", "Canadian Sociological Association", summary="The 60th annual conference at the University of British Columbia, May 31–June 4, 2027; a virtual session is planned for the week before or after.", subfields=SOC, record_kind="event", type="conference", end_date="2027-06-04T23:59:00-07:00", age_band="Sociologists, researchers, practitioners, and students", education_levels=["graduate","professional"], city="Vancouver", province="British Columbia", timezone="America/Vancouver", venue="University of British Columbia", series_title="CSA 2027", series_role="parent", calendar_stage="conference"))
A(watch("canadian-sociological-association-2027-cfp-watch", "Canadian Sociological Association 2027 call for papers watch", "2026-09-01T00:00:00-04:00", "https://www.csa-scs.ca/news/conference-news", "Canadian Sociological Association", summary="The association states that 2027 conference details will be posted in early September 2026; the exact submission deadline remains pending.", subfields=SOC, age_band="Sociologists, researchers, practitioners, and students", education_levels=["graduate","professional"], opportunity_kind="conference submission", parent_id="canadian-sociological-association-2027-conference", series_role="child", calendar_stage="CFP watch"))
A(rec("relational-luhmann-2027-cfp", "Relational Luhmann 2027 call for papers deadline", "2026-09-30T23:59:00-04:00", "https://erica.uqam.ca/en/call-for-papers-for-our-2027-conference-on-the-relational-luhmann/", "ÉRICA / UQAM", summary="Paper-proposal deadline for the Montréal conference on relational approaches to Niklas Luhmann.", subfields=["Sociology","Social Theory"], opportunity_kind="conference submission", participation_unit="individual or panel proposer", access_route="direct submission", parent_id="relational-luhmann-2027-conference", series_role="child", calendar_stage="CFP closing", city="Montréal", province="Québec"))
A(rec("relational-luhmann-2027-conference", "Relational Luhmann Conference 2027", "2027-05-26T00:00:00-04:00", "https://erica.uqam.ca/en/call-for-papers-for-our-2027-conference-on-the-relational-luhmann/", "ÉRICA / UQAM", summary="International social-theory conference at UQAM in Montréal, May 26–28, 2027.", subfields=["Sociology","Social Theory"], record_kind="event", type="conference", end_date="2027-05-28T23:59:00-04:00", age_band="Researchers and graduate students", education_levels=["graduate","professional"], city="Montréal", province="Québec", venue="UQAM", series_title="Relational Luhmann 2027", series_role="parent", calendar_stage="conference"))
A(rec("isa-world-congress-2027-abstract-deadline", "ISA World Congress of Sociology 2027 abstract deadline", "2026-10-14T23:59:00+00:00", "https://www.isa-sociology.org/isa-events/xxi-world-congress-of-sociology/congress-guidelines/duties-and-deadlines", "International Sociological Association", summary="Closing time for authors to submit abstracts to specific sessions for the XXI World Congress of Sociology.", subfields=SOC, opportunity_kind="conference abstract", participation_unit="individual author", access_route="conference-system submission", parent_id="isa-world-congress-sociology-2027", series_role="child", calendar_stage="abstract closing", timezone="UTC", country="South Korea"))
A(rec("isa-world-congress-sociology-2027", "XXI ISA World Congress of Sociology", "2027-07-04T00:00:00+09:00", "https://www.isa-sociology.org/isa-events/xxi-world-congress-of-sociology", "International Sociological Association", summary="Global Sociology in Turbulent Times, held in Gwangju, South Korea, July 4–10, 2027.", subfields=SOC, record_kind="event", type="conference", end_date="2027-07-10T23:59:00+09:00", age_band="Sociologists, researchers, and students", education_levels=["graduate","professional"], city="Gwangju", country="South Korea", timezone="Asia/Seoul", venue="Gwangju, South Korea", series_title="XXI ISA World Congress of Sociology", series_role="parent", calendar_stage="congress"))
A(rec("isa-junior-sociologists-competition-2026", "ISA Worldwide Competition for Junior Sociologists deadline", "2026-10-30T23:59:00+00:00", "https://www.isa-sociology.org/", "International Sociological Association", summary="Worldwide submission deadline for the ISA competition for junior sociologists.", subfields=SOC, age_band="Junior sociologists under the current competition rules", education_levels=["graduate","professional"], opportunity_kind="junior sociologists competition", participation_unit="individual researcher", access_route="direct submission", timezone="UTC", calendar_stage="submission closing"))
A(rec("sfaa-2027-abstract-deadline", "Society for Applied Anthropology 2027 abstract deadline", "2026-10-15T23:59:00-04:00", "https://appliedanthro.org/annual-meeting/information-logistics/abstract-information/", "Society for Applied Anthropology", summary="Abstract deadline for the 87th Annual Meeting. The official abstract page currently states October 15.", subfields=ANT, opportunity_kind="conference abstract", participation_unit="individual or session participant", access_route="member portal submission", parent_id="sfaa-2027-annual-meeting", series_role="child", calendar_stage="abstract closing", source_inconsistency="Earlier research notes identified October 1; the current official abstract page states October 15, which governs this record."))
A(rec("sfaa-2027-annual-meeting", "Society for Applied Anthropology Annual Meeting 2027", "2027-03-23T00:00:00-04:00", "https://appliedanthro.org/annual-meeting/", "Society for Applied Anthropology", summary="Futures, Fractures, and Fixes, the 87th annual meeting in Norfolk, Virginia, March 23–27, 2027.", subfields=ANT, record_kind="event", type="conference", end_date="2027-03-27T23:59:00-04:00", age_band="Applied anthropologists, social scientists, practitioners, and students", education_levels=["graduate","professional"], city="Norfolk", province="Virginia", country="United States", venue="Norfolk Waterside Marriott", series_title="SfAA 2027", series_role="parent", calendar_stage="conference"))
A(watch("casca-2027-conference-watch", "Canadian Anthropology Society 2027 conference watch", "2027-05-01T00:00:00-04:00", "https://cas-sca.ca/en/conferences", "Canadian Anthropology Society", summary="The official conference surface still describes the 2026 meeting; no confirmed 2027 date or CFP was available.", subfields=ANT, age_band="Anthropologists, researchers, and students", education_levels=["graduate","professional"], record_kind="event", type="conference", opportunity_kind="conference watch"))
A(rec("congress-humanities-social-sciences-2027", "Congress of the Humanities and Social Sciences 2027", "2027-07-05T00:00:00-07:00", "https://www.federationhss.ca/en/congress/congress-2027", "Federation for the Humanities and Social Sciences", summary="Cross-disciplinary Congress at Simon Fraser University, July 5–9, 2027.", subfields=["Social Sciences","Humanities"], record_kind="event", type="conference", end_date="2027-07-09T23:59:00-07:00", age_band="Researchers, educators, students, and participating associations", education_levels=["graduate","professional"], city="Burnaby", province="British Columbia", timezone="America/Vancouver", venue="Simon Fraser University", calendar_stage="congress"))

# ---------------------------------------------------------------------------
# RELIGIOUS STUDIES
# ---------------------------------------------------------------------------
A(rec("ccsr-doctoral-fellowship-2027", "CCSR Doctoral Fellowship 2027 deadline", "2026-12-04T23:59:00-05:00", "https://ccsr.ca/en/doctoral-fellowship-2027/", "Canadian Corporation for the Study of Religion", summary="Application deadline for a C$10,000 fellowship supporting one doctoral candidate at the dissertation stage in religious studies or theology.", subfields=REL, age_band="Doctoral students in religious studies or theology", education_levels=["graduate"], opportunity_kind="doctoral fellowship", participation_unit="individual applicant", access_route="direct application", prize_form="C$10,000", institutional_restriction="Applicant must be a member of a constituent CCSR society and meet Canadian study or status requirements.", calendar_stage="application closing"))
A(watch("cssr-2027-annual-meeting-watch", "Canadian Society for the Study of Religion 2027 annual meeting watch", "2027-06-01T00:00:00-04:00", "https://cssrscer.ca/", "Canadian Society for the Study of Religion", summary="The current public surface still centres the 2026 meeting; 2027 dates and submission information remain pending.", subfields=REL, age_band="Religious-studies scholars and students", education_levels=["graduate","professional"], record_kind="event", type="conference", opportunity_kind="annual meeting watch"))

# ---------------------------------------------------------------------------
# MODEL UNITED NATIONS
# ---------------------------------------------------------------------------
A(rec("ssuns-2026-conference", "Secondary Schools' United Nations Symposium 2026", "2026-11-12T00:00:00-05:00", "https://www.ssuns.org/", "SSUNS / IRSAM at McGill University", summary="Large Model United Nations conference for secondary-school and CEGEP delegations in Montréal, November 12–15, 2026.", subfields=IR, record_kind="event", type="conference", end_date="2026-11-15T23:59:00-05:00", age_band="Secondary-school and CEGEP students", education_levels=["secondary","CEGEP"], participation_unit="school delegation", access_route="school registration", city="Montréal", province="Québec", venue="Sheraton Montréal", series_title="SSUNS 2026", series_role="parent", calendar_stage="conference"))
A(rec("ssuns-2026-registration-deadline", "SSUNS 2026 registration deadline", "2026-10-16T23:59:00-04:00", "https://www.ssuns.org/registration", "SSUNS / IRSAM at McGill University", summary="Delegation registration closes October 16, 2026 or earlier if capacity is reached.", subfields=IR, age_band="Secondary-school and CEGEP students", education_levels=["secondary","CEGEP"], opportunity_kind="Model UN registration", participation_unit="school delegation", access_route="MUNager registration", parent_id="ssuns-2026-conference", series_role="child", calendar_stage="registration closing", registration_url="https://www.ssuns.org/registration"))
A(rec("namun-2027-conference", "North American Model United Nations 2027", "2027-02-18T00:00:00-05:00", "https://www.namun.org/", "North American Model United Nations / University of Toronto", summary="University-level Model United Nations conference in Toronto, February 18–20, 2027.", subfields=IR, record_kind="event", type="conference", end_date="2027-02-20T23:59:00-05:00", age_band="University students", education_levels=["undergraduate","graduate"], participation_unit="university delegation or delegate", city="Toronto", province="Ontario", venue="University of Toronto / conference venues", series_title="NAMUN 2027", series_role="parent", calendar_stage="conference"))
A(watch("namun-2027-registration-watch", "NAMUN 2027 registration watch", "2026-09-01T00:00:00-04:00", "https://www.namun.org/", "North American Model United Nations / University of Toronto", summary="The February 18–20 conference is confirmed, but the retrieved homepage did not expose a single final registration deadline.", subfields=IR, age_band="University students", education_levels=["undergraduate","graduate"], opportunity_kind="Model UN registration", participation_unit="university delegation or delegate", parent_id="namun-2027-conference", series_role="child", calendar_stage="registration watch"))
A(rec("cahsmun-2027-conference", "Canadian High Schools Model United Nations 2027", "2027-04-02T00:00:00-07:00", "https://cahsmun.org/news/2023/01/22/cahsmun-confirms-future-conference-dates", "Canadian High Schools Model United Nations", summary="High-school Model United Nations conference in Vancouver, April 2–4, 2027.", subfields=IR, record_kind="event", type="conference", end_date="2027-04-04T23:59:00-07:00", age_band="High-school students", education_levels=["secondary"], participation_unit="school delegation or delegate", city="Vancouver", province="British Columbia", timezone="America/Vancouver", venue="Sheraton Vancouver Wall Centre", series_title="CAHSMUN 2027", series_role="parent", calendar_stage="conference"))
A(watch("cahsmun-2027-registration-watch", "CAHSMUN 2027 registration watch", "2026-09-01T00:00:00-04:00", "https://cahsmun.org/", "Canadian High Schools Model United Nations", summary="The April 2–4 conference dates are confirmed; the final 2027 registration deadline remains pending.", subfields=IR, age_band="High-school students", education_levels=["secondary"], opportunity_kind="Model UN registration", participation_unit="school delegation or delegate", parent_id="cahsmun-2027-conference", series_role="child", calendar_stage="registration watch"))

# ---------------------------------------------------------------------------
# LAW AND JUSTICE EDUCATION
# ---------------------------------------------------------------------------
A(watch("ojen-braiding-diversity-2027-watch", "OJEN Braiding Diversity into Justice 2027 watch", "2027-01-01T00:00:00-05:00", "https://ojen.ca/", "Ontario Justice Education Network", summary="Recurring justice-sector program for young people approximately ages 16–20, including young women and gender-diverse participants; exact 2027 dates remain pending.", subfields=LAW, age_band="Ages 16–20", opportunity_kind="justice education program", participation_unit="individual participant", access_route="application"))
A(watch("ojen-justice-education-fellowship-2027-watch", "OJEN Justice Education Fellowship 2027 watch", "2027-01-01T00:00:00-05:00", "https://ojen.ca/", "Ontario Justice Education Network", summary="Recurring justice-education fellowship or participation route; exact 2027 cycle details remain pending.", subfields=LAW, age_band="Eligibility varies by program", opportunity_kind="justice education fellowship", participation_unit="individual applicant"))
A(watch("ojen-mock-trials-2027-watch", "OJEN Mock Trials 2027 watch", "2027-01-01T00:00:00-05:00", "https://ojen.ca/", "Ontario Justice Education Network", summary="Recurring school mock-trial program; local competition dates and eligibility vary and the 2027 schedule remains pending.", subfields=LAW, age_band="Secondary-school students; local rules vary", education_levels=["secondary"], opportunity_kind="mock trial", participation_unit="school team", access_route="school or regional registration"))

# ---------------------------------------------------------------------------
# INDIGENOUS EDUCATION AND CROSS-FIELD SOCIAL-SCIENCE FUNDING
# ---------------------------------------------------------------------------
A(rec("indspire-bbf-2026-november-deadline", "Indspire Building Brighter Futures — November 2026 deadline", "2026-11-01T23:59:00-05:00", "https://indspire.ca/programs/students/bursaries-scholarships/", "Indspire", summary="Consideration deadline for First Nations, Inuit, and Métis students in postsecondary education, skilled trades, apprenticeships, and technology programs during the September 2026–August 2027 academic year.", subfields=IND, age_band="First Nations, Inuit, and Métis postsecondary and skilled-trades students", education_levels=["college","undergraduate","graduate"], opportunity_kind="bursary and scholarship", participation_unit="individual applicant", access_route="single Indspire application", prize_form="bursary or scholarship", calendar_stage="consideration deadline"))
A(rec("indspire-bbf-2027-february-deadline", "Indspire Building Brighter Futures — February 2027 deadline", "2027-02-01T23:59:00-05:00", "https://indspire.ca/programs/students/bursaries-scholarships/", "Indspire", summary="Final listed consideration deadline for the September 2026–August 2027 Building Brighter Futures cycle.", subfields=IND, age_band="First Nations, Inuit, and Métis postsecondary and skilled-trades students", education_levels=["college","undergraduate","graduate"], opportunity_kind="bursary and scholarship", participation_unit="individual applicant", access_route="single Indspire application", prize_form="bursary or scholarship", calendar_stage="consideration deadline"))
A(rec("indspire-awards-2027", "Indspire Awards 2027", "2027-05-06T00:00:00-06:00", "https://indspire.ca/events/indspire-awards/", "Indspire", summary="National ceremony recognizing First Nations, Inuit, and Métis professionals and youth, scheduled for May 6, 2027 at the BMO Centre in Calgary.", subfields=IND, record_kind="event", type="ceremony", age_band="Public audience; laureates selected through the Indspire process", city="Calgary", province="Alberta", timezone="America/Edmonton", venue="BMO Centre", calendar_stage="award ceremony"))
A(rec("sshrc-indigenous-innovation-leadership-stage2-2026", "SSHRC Indigenous Innovation and Leadership Research Network — Stage 2 deadline", "2026-12-03T20:00:00-05:00", "https://www.sshrc-crsh.gc.ca/en/funding/opportunities.aspx", "Social Sciences and Humanities Research Council", summary="Full-application deadline for invited teams advancing an Indigenous Innovation and Leadership Research Network.", subfields=["Indigenous Studies","Research Funding"], age_band="Eligible invited research teams", education_levels=["professional"], opportunity_kind="invitation-only research grant", participation_unit="research team", access_route="invitation following Stage 1", institutional_restriction="Only eligible Stage 1 teams may apply.", calendar_stage="full application closing"))
A(rec("canada-postdoctoral-research-award-2026", "Canada Postdoctoral Research Award 2026 deadline", "2026-09-10T20:00:00-04:00", "https://www.sshrc-crsh.gc.ca/en/funding/opportunities.aspx", "Canada's federal research funding agencies", summary="Application deadline for the Canada Postdoctoral Research Award, valued at C$70,000 per year for two years under the current program information.", subfields=FUND, age_band="Postdoctoral researchers", education_levels=["postdoctoral"], opportunity_kind="postdoctoral research award", participation_unit="individual applicant", prize_form="C$70,000 per year for two years", calendar_stage="application closing"))
A(rec("sshrc-partnership-engage-grants-2026-september", "SSHRC Partnership Engage Grants — September 2026 deadline", "2026-09-15T20:00:00-04:00", "https://www.sshrc-crsh.gc.ca/funding-financement/programs-programmes/partnership_engage_grants-subventions_engagement_partenarial-eng.aspx", "Social Sciences and Humanities Research Council", summary="Quarterly deadline for one-year partnership projects between eligible researchers and a partner organization, normally valued between C$10,000 and C$50,000.", subfields=FUND, age_band="Eligible researchers and partner organizations", education_levels=["professional"], opportunity_kind="partnership research grant", participation_unit="researcher-partner team", access_route="institutional application", prize_form="C$10,000–C$50,000", calendar_stage="application closing"))
A(rec("sshrc-partnership-engage-grants-2026-december", "SSHRC Partnership Engage Grants — December 2026 deadline", "2026-12-15T20:00:00-05:00", "https://www.sshrc-crsh.gc.ca/funding-financement/programs-programmes/partnership_engage_grants-subventions_engagement_partenarial-eng.aspx", "Social Sciences and Humanities Research Council", summary="Quarterly deadline for one-year partnership projects between eligible researchers and a partner organization, normally valued between C$10,000 and C$50,000.", subfields=FUND, age_band="Eligible researchers and partner organizations", education_levels=["professional"], opportunity_kind="partnership research grant", participation_unit="researcher-partner team", access_route="institutional application", prize_form="C$10,000–C$50,000", calendar_stage="application closing"))

assert len(records) == 68, f"Expected 68 Set 4 records, found {len(records)}"

# Cross-tag already canonical Set 2 records that are also core Set 4 economics/ethics records.
CROSS_TAG_IDS = {
    "cfa-canada-ethics-challenge-institution-2026",
    "cfa-canada-ethics-challenge-registration-2026",
    "cfa-canada-ethics-challenge-national-2027",
}

manual = json.loads(MANUAL.read_text(encoding="utf-8"))
sources_doc = json.loads(SOURCES.read_text(encoding="utf-8"))
source_rows = sources_doc["sources"]
source_by_id = {str(s.get("id")): s for s in source_rows}

for event in records:
    sid = event["source_id"]
    if sid in source_by_id:
        continue
    row = {
        "id": sid,
        "name": event.get("source_name") or event.get("organizer") or sid,
        "tier_priority": 3,
        "default_type": event.get("type", "other"),
        "base_url": source_root(event["source_url"]),
        "events_url": event["source_url"],
        "render_mode": "static",
        "feed_status": "manual-deep-research",
        "notes": f"Added by {SRC}; official or organizer-controlled Set 4 source.",
        "source_mode": "crawl",
        "harvest_enabled": True,
    }
    source_rows.append(row)
    source_by_id[sid] = row

by_id = {event.get("id"): index for index, event in enumerate(manual["events"])}
added = refreshed = 0
for event in records:
    if event["id"] in by_id:
        index = by_id[event["id"]]
        old = manual["events"][index]
        old_identity = old.get("identity_key")
        first_seen = old.get("first_seen_at")
        manual["events"][index] = {**old, **event}
        if old_identity:
            manual["events"][index]["identity_key"] = old_identity
        if first_seen:
            manual["events"][index]["first_seen_at"] = first_seen
        refreshed += 1
    else:
        by_id[event["id"]] = len(manual["events"])
        manual["events"].append(event)
        added += 1

cross_tagged = 0
for event in manual["events"]:
    if event.get("id") not in CROSS_TAG_IDS:
        continue
    subjects = list(dict.fromkeys([*(event.get("subjects") or []), "Social Studies", "Economics", "Ethics"] ))
    topics = list(dict.fromkeys([*(event.get("topics") or []), "social studies", "economics", "ethics"] ))
    subfields = list(dict.fromkeys([*(event.get("social_studies_subfields") or []), "Economics", "Ethics"] ))
    batches = list(dict.fromkeys([*(event.get("_upsert_batches") or []), SRC]))
    event.update({
        "subjects": subjects,
        "topics": topics,
        "social_studies_subfields": subfields,
        "research_set_cross_tags": list(dict.fromkeys([*(event.get("research_set_cross_tags") or []), RESEARCH_SET])),
        "_upsert_batches": batches,
    })
    cross_tagged += 1

manual["events"].sort(key=lambda event: (str(event.get("date", "")), str(event.get("title", "")), str(event.get("id", ""))))
manual["count"] = len(manual["events"])
manual["last_event_research_import"] = "2026-08-13"
manual["polymythcal_social_studies_set4_update_2026_08_13"] = {
    "source": SRC,
    "records_in_delta": len(records),
    "records_added": added,
    "records_refreshed": refreshed,
    "existing_records_cross_tagged": cross_tagged,
    "research_set": RESEARCH_SET,
    "subfields": sorted({s for event in records for s in event.get("social_studies_subfields", [])}),
    "change_list_components": [f"CL-WEB-{n}" for n in range(204, 212)],
}
MANUAL.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

sources_doc["$updated"] = "2026-08-13"
sources_doc["polymythcal_social_studies_set4_2026_08_13"] = {
    "source": SRC,
    "sources_added": len([s for s in source_rows if str(s.get("notes", "")).startswith(f"Added by {SRC}")]),
}
SOURCES.write_text(json.dumps(sources_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

exclusions = [
    {"title":"National programs with local-only deadlines","reason":"Retained as series or watch records rather than assigned one invented national deadline."},
    {"title":"Unannounced 2027 association conferences","reason":"Retained as annual watches until official dates or CFPs are published."},
    {"title":"Québec Secondary 3–4","reason":"Preserved in the local grade system; not converted into Canadian exact-grade fields."},
]
ledger = {
    "schema": "polymythcal-social-studies-set4-research-ledger-v1",
    "generated_at": CHECKED,
    "source_batch": SRC,
    "research_set": RESEARCH_SET,
    "record_count": len(records),
    "cross_tagged_existing_ids": sorted(CROSS_TAG_IDS),
    "records": records,
    "exclusions": exclusions,
    "notes": [
        "Confirmed current-cycle dates remain separate from annual-watch markers.",
        "Parent programs, deadlines, preparation stages, and final events remain linked but distinct.",
        "Exact grades are indexed only when stated explicitly by the organizer.",
        "Source inconsistencies remain visible rather than silently harmonized.",
    ],
}
RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
RESEARCH_FILE.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(RESEARCH_DIR / "research-ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(RESEARCH_DIR / "exclusions.json").write_text(json.dumps(exclusions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(json.dumps({
    "records": len(records),
    "added": added,
    "refreshed": refreshed,
    "cross_tagged_existing": cross_tagged,
    "manual_total": manual["count"],
    "sources_total": len(source_rows),
    "research_file": str(RESEARCH_FILE),
}, indent=2))
