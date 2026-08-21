#!/usr/bin/env python3
"""Reusable Polymythcal source adapters.

The adapters deliberately share one canonical output contract while keeping
profile-specific selectors, date vocabulary, status language, and confidence
rules for municipal, university, library, festival, French-language, and
civic-action sources.
"""
from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bs4 import BeautifulSoup

ADAPTER_NAMES = {
    "municipal",
    "university",
    "library",
    "festival",
    "french-language",
    "civic-action",
    "wordpress-tec",
    "action-network",
    "campaign-page",
}

FRENCH_MONTHS = {
    "janvier": 1, "janv": 1, "février": 2, "fevrier": 2, "févr": 2, "fevr": 2,
    "mars": 3, "avril": 4, "avr": 4, "mai": 5, "juin": 6, "juillet": 7,
    "juil": 7, "août": 8, "aout": 8, "septembre": 9, "sept": 9,
    "octobre": 10, "oct": 10, "novembre": 11, "nov": 11,
    "décembre": 12, "decembre": 12, "déc": 12, "dec": 12,
}
ENGLISH_MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7,
    "jul": 7, "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}
MONTHS = {**ENGLISH_MONTHS, **FRENCH_MONTHS}
MONTH_ABBREVIATION_PERIOD_RE = re.compile(
    r"\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|"
    r"janv|févr|fevr|avr|juil|sept|oct|nov|déc|dec)\.(?=\s+\d)",
    re.I,
)
MAX_HTML_EVENT_TEXT = 24000

STATUS_PATTERNS = {
    "cancelled": re.compile(r"\b(cancelled|canceled|annul(?:é|e|ée|ees|és)?|annulation)\b", re.I),
    "postponed": re.compile(r"\b(postponed|report(?:é|e|ée|ees|és)?|remis(?:e)?|différé(?:e)?)\b", re.I),
    "rescheduled": re.compile(r"\b(rescheduled|reprogrammé(?:e)?|nouvelle date|date modifiée|date change[sd]?)\b", re.I),
    "sold-out": re.compile(r"\b(sold[ -]?out|complet|complète|épuisé|epuise)\b", re.I),
    "registration-closed": re.compile(r"\b(registration closed|inscriptions? fermées?|fermeture des inscriptions)\b", re.I),
}

PROFILE_SELECTORS = {
    "municipal": ["article.event", ".event-item", ".calendar-event", "[data-event-id]", "article", "li"],
    "university": ["article.event", ".event-card", ".views-row", ".event", "article", "li"],
    "library": [".cp-event", ".event-card", "article.event", "[data-event-id]", "article", "li"],
    "festival": [".schedule-item", ".program-item", ".event-card", "article.event", "article", "li"],
    "french-language": ["article.evenement", ".carte-evenement", ".event-card", "article", "li"],
    "civic-action": [
        "article.action", ".action-card", ".event-card", "article.event",
        ".news-post-content", ".single-post-content", "article", "li",
    ],
    "wordpress-tec": [".tribe-events-calendar-list__event-row", ".tribe-events-pro-photo__event", ".type-tribe_events", ".event-card", "article"],
    "action-network": [
        ".event-detail", ".action-event", ".event-card", "article.event",
        ".news-post-content", ".single-post-content",
        "main article", "article",
    ],
    "campaign-page": [
        ".location-card", ".event-location-card", "[data-event-location]",
        ".action-card", ".event-card", ".news-post-content",
        ".single-post-content", "tbody tr", "article",
    ],
}

PROFILE_DEFAULT_TYPES = {
    "municipal": "community",
    "university": "lecture",
    "library": "workshop",
    "festival": "festival",
    "french-language": "other",
    "civic-action": "protest",
    "wordpress-tec": "other",
    "action-network": "protest",
    "campaign-page": "protest",
}

CREATOR_ROLE_PATTERN = (
    r"(?:director|filmmaker|creator|cast(?:\s+members?)?|writer|playwright|author|poet|"
    r"artist|curator|scholar|researcher|composer|translator|editor|organizer|activist|"
    r"subject|witness|survivor|elder|knowledge keeper|creative team|"
    r"artists? from (?:the )?(?:show|production)|cinematographer|producer|principal collaborator)"
)
CREATOR_ATTENDANCE_RE = re.compile(
    rf"\b{CREATOR_ROLE_PATTERN}\b(?:[^.\n]{{0,80}})"
    r"\b(?:in attendance|attending|present|will attend|will be present|joins?|appears?)\b|"
    rf"\b(?:q\s*(?:&|and)\s*a|talkback|conversation|introduction|panel|masterclass|live commentary)"
    rf"\s+(?:with|by|featuring)\s+(?:the\s+)?{CREATOR_ROLE_PATTERN}\b",
    re.I,
)
DIRECTOR_ATTENDANCE_RE = re.compile(
    r"\bdirector\b(?:[^.\n]{0,80})\b(?:in attendance|attending|present|will attend|will be present|joins?|appears?)\b|"
    r"\b(?:q\s*(?:&|and)\s*a|talkback|conversation|introduction|panel|masterclass|live commentary)"
    r"\s+(?:with|by|featuring)\s+(?:the\s+)?director\b",
    re.I,
)
TALKBACK_RE = re.compile(
    r"\b(?:post[- ]show|post[- ]performance)?\s*talkback\b|"
    r"\bpost[- ](?:show|performance)\s+(?:discussion|conversation|q\s*(?:&|and)\s*a)\b",
    re.I,
)
CREATOR_INTERACTION_PATTERNS = (
    ("post-show talkback", TALKBACK_RE),
    ("q-and-a", re.compile(r"\bq\s*(?:&|and)\s*a\b|\bquestion(?:s)? and answer(?:s)?\b", re.I)),
    ("post-performance discussion", re.compile(r"\bpost[- ](?:show|performance)\s+(?:discussion|conversation)\b", re.I)),
    ("live commentary", re.compile(r"\blive commentary\b", re.I)),
    ("masterclass", re.compile(r"\bmasterclass\b", re.I)),
    ("introduction", re.compile(r"\b(?:introduced|introduction)\s+(?:by|with)\b", re.I)),
    ("conversation", re.compile(r"\bconversation\s+(?:with|featuring)\b", re.I)),
    ("panel", re.compile(r"\bpanel\s+(?:with|featuring)\b", re.I)),
)

TORONTO_SOURCE_IDS = {
    "c4e", "jhi", "revue", "agora-self", "uoft-philosophy", "york-events",
    "practical-philosophy-on", "empire-club", "canadian-club", "massey-rth",
    "tso", "coc", "national-ballet", "to-live", "koerner-hall", "soulpepper",
    "mirvish", "rom", "aga-khan", "tpl-salon-series", "u-t-lecture-series",
    "tmu-research-events", "rom-talks",
}
KINGSTON_SOURCE_IDS = {"queens-events", "kingston-writersfest"}
MONTREAL_SOURCE_IDS = {
    "montreal-jazz", "osheaga", "concordia-fofa", "mcgill-science",
}
ONLINE_SOURCE_IDS = {
    "philevents-cfp", "upenn-cfp", "pw-grants", "reedsy-contests",
    "apa-meeting-submissions",
}
GLOBAL_SOURCE_GEOGRAPHY = {
    "princeton-uchv": ("Princeton", "outside-corridor", "America/New_York"),
    "harvard-safra-ethics": ("Cambridge, MA", "outside-corridor", "America/New_York"),
    "harvard-mahindra-humanities": ("Cambridge, MA", "outside-corridor", "America/New_York"),
    "stanford-humanities-center": ("Stanford", "outside-corridor", "America/Los_Angeles"),
    "cambridge-crassh": ("Cambridge, UK", "outside-corridor", "Europe/London"),
    "oxford-torch": ("Oxford", "outside-corridor", "Europe/London"),
    "institute-philosophy-london": ("London", "outside-corridor", "Europe/London"),
}


def creator_attendance_confirmed(text: str) -> bool:
    """Return true only when creator/participant presence is stated explicitly."""
    return bool(CREATOR_ATTENDANCE_RE.search(text or ""))


def director_attendance_confirmed(text: str) -> bool:
    """Do not infer director attendance from a director credit plus a generic talkback."""
    return bool(DIRECTOR_ATTENDANCE_RE.search(text or ""))


def creator_interaction_format(text: str) -> str:
    """Identify public access to people connected to a work, across media."""
    value = text or ""
    for label, pattern in CREATOR_INTERACTION_PATTERNS:
        if pattern.search(value):
            return label
    return ""


def creator_presence_claims(text: str) -> list[dict]:
    """Extract conservative, evidence-bearing role claims without inventing names."""
    value = text or ""
    interaction = creator_interaction_format(value)
    claims: list[dict] = []
    if re.search(r"\bartists? from (?:the )?(?:show|production)\b", value, re.I):
        claims.append({
            "role": "artists from production",
            "status": "confirmed",
            "evidence": interaction or "explicit attendance language",
        })
    if interaction and re.search(r"\bcreative team\b", value, re.I):
        claims.append({
            "role": "creative team",
            "status": "confirmed",
            "evidence": interaction,
        })
    if director_attendance_confirmed(value):
        claims.append({
            "role": "director",
            "status": "confirmed",
            "evidence": "explicit director attendance language",
        })
    return claims


def infer_source_geography(source: dict) -> tuple[str, str, str]:
    """Return a truthful source-level fallback when an event omits geography.

    Event-level structured location remains authoritative. These defaults keep
    deterministic records schema-valid without pretending that worldwide CFP
    directories have a physical Toronto venue.
    """
    city = str(source.get("city") or source.get("region") or "").strip()
    corridor = str(source.get("corridor_zone") or "").strip()
    timezone_name = str(source.get("timezone") or "").strip()
    source_id = str(source.get("id") or "")
    if source_id in TORONTO_SOURCE_IDS:
        inferred = ("Toronto", "toronto", "America/Toronto")
    elif source_id in KINGSTON_SOURCE_IDS:
        inferred = ("Kingston", "kingston", "America/Toronto")
    elif source_id in MONTREAL_SOURCE_IDS:
        inferred = ("Montréal", "montreal", "America/Toronto")
    elif source_id in ONLINE_SOURCE_IDS:
        inferred = ("Online", "online-global", "UTC")
    elif source_id in GLOBAL_SOURCE_GEOGRAPHY:
        inferred = GLOBAL_SOURCE_GEOGRAPHY[source_id]
    else:
        text = " ".join(
            str(source.get(key) or "")
            for key in ("id", "name", "events_url", "base_url", "scope")
        ).lower()
        if str(source.get("scope") or "") == "global-academic":
            inferred = ("Online / location varies", "online-global", "UTC")
        elif re.search(r"\b(montr[ée]al|mcgill|concordia)\b", text):
            inferred = ("Montréal", "montreal", "America/Toronto")
        elif re.search(r"\b(kingston|queen['’]?s)\b", text):
            inferred = ("Kingston", "kingston", "America/Toronto")
        elif re.search(r"\b(toronto|uoft|utoronto|yorku|rom\b|aga khan)\b", text):
            inferred = ("Toronto", "toronto", "America/Toronto")
        elif str(source.get("default_type") or "") in {"cfp", "contest"}:
            inferred = ("Online", "online-global", "UTC")
        else:
            inferred = ("Location varies", "unknown", "America/Toronto")
    return (
        city or inferred[0],
        corridor or inferred[1],
        timezone_name or inferred[2],
    )


def canonical_event_url(value: str) -> str:
    """Normalize an event URL without deleting event-identifying parameters."""
    if not value:
        return ""
    parsed = urllib.parse.urlsplit(str(value).strip())
    if parsed.scheme not in {"http", "https"}:
        return ""
    query = [
        (key, val)
        for key, val in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith(("utm_", "fbclid", "gclid"))
    ]
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urllib.parse.urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, urllib.parse.urlencode(query), "")
    )


def event_identity_key(record: dict) -> str:
    """Return the unique public-record identity for one occurrence.

    Stable UID/URL aliases are deliberately kept separately for reschedule
    reconciliation. The public identity includes the occurrence discriminator
    so repeated events never violate the calendar's uniqueness contract.
    """
    return event_occurrence_key(record)


def event_identity_aliases(record: dict) -> list[str]:
    """All stable identities known for cross-format reconciliation.

    A feed UID is canonical and survives URL changes. The canonical URL alias
    lets a server-rendered announcement merge with the same event found in an
    ICS/API response.
    """
    external_uid = str(
        record.get("external_uid")
        or record.get("uid")
        or record.get("event_uid")
        or ""
    ).strip()
    source_id = str(record.get("source_id") or "").strip().lower()
    title = re.sub(r"\W+", "", str(record.get("title") or "").lower())[:180]
    url = canonical_event_url(str(record.get("source_url") or ""))
    bases = []
    if external_uid:
        bases.append(f"uid::{source_id}::{external_uid}")
    if url:
        bases.append(f"url::{source_id}::{url}::{title}")
    if not bases:
        organizer = re.sub(
            r"\W+", "", str(record.get("organizer") or "").lower()
        )[:120]
        bases.append(f"fallback::{source_id}::{title}::{organizer}")
    return [
        hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]
        for basis in bases
    ]


def event_occurrence_key(record: dict) -> str:
    """Distinct occurrence key, preserving repeat performances and locations."""
    aliases = list(record.get("identity_aliases") or event_identity_aliases(record))
    identity = str(aliases[0])
    date_value = str(record.get("date") or "")
    venue = re.sub(r"\W+", "", str(record.get("venue") or "").lower())[:180]
    recurrence = str(record.get("recurrence_id") or "").strip()
    basis = f"{identity}::{recurrence or date_value}::{venue}"
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]


def records_represent_same_occurrence(left: dict, right: dict) -> bool:
    """Merge incomplete listing/feed views without collapsing real repeats."""
    aliases_left = set(left.get("identity_aliases") or event_identity_aliases(left))
    aliases_right = set(right.get("identity_aliases") or event_identity_aliases(right))
    if not aliases_left.intersection(aliases_right):
        return False
    if str(left.get("date") or "")[:10] != str(right.get("date") or "")[:10]:
        return False
    left_venue = re.sub(r"\W+", "", str(left.get("venue") or "").lower())
    right_venue = re.sub(r"\W+", "", str(right.get("venue") or "").lower())
    generic_venue = re.compile(
        r"^(?:|locationtbd|locationtba|tbd|tba|online|virtual|"
        r"toronto|montreal|montréal|kingston)$",
        re.I,
    )
    left_generic = bool(generic_venue.fullmatch(left_venue))
    right_generic = bool(generic_venue.fullmatch(right_venue))
    venue_compatible = (
        left_generic
        or right_generic
        or left_venue in right_venue
        or right_venue in left_venue
    )
    incomplete = (
        left.get("time_precision") != "exact"
        or right.get("time_precision") != "exact"
        or left_generic
        or right_generic
    )
    return venue_compatible and incomplete


def stable_id(source_url: str, date_value: str, title: str) -> str:
    raw = f"{source_url}::{date_value}::{title}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:12]


def source_url(source: dict) -> str:
    return str(source.get("events_url") or source.get("url") or source.get("base_url") or "")


def normalise_source_config(source: dict) -> dict:
    out = dict(source)
    if not out.get("events_url") and out.get("url"):
        out["events_url"] = out["url"]
    if not out.get("platform_adapter"):
        explicit = out.get("adapter")
        if explicit in ADAPTER_NAMES:
            out["platform_adapter"] = explicit
        else:
            out["platform_adapter"] = infer_adapter(out)
    events_url = str(out.get("events_url") or "").strip()
    render_mode = str(out.get("render_mode") or "").strip().lower()
    if events_url == "manual" or render_mode == "manual":
        out.setdefault("source_mode", "manual")
        out.setdefault("fetcher", "manual")
    elif events_url.startswith(("http://", "https://")):
        out.setdefault("source_mode", "crawl")
        out.setdefault("harvest_enabled", True)
    else:
        out.setdefault("source_mode", "discovery")
        out.setdefault("harvest_enabled", False)
    city, corridor, timezone_name = infer_source_geography(out)
    if not out.get("city"):
        out["city"] = city
    if not out.get("region"):
        out["region"] = city
    if not out.get("corridor_zone"):
        out["corridor_zone"] = corridor
    if not out.get("timezone"):
        out["timezone"] = timezone_name
    return out


def infer_adapter(source: dict) -> str | None:
    text = " ".join(str(source.get(k, "")) for k in (
        "id", "name", "events_url", "url", "base_url", "notes", "language", "region", "city"
    )).lower()
    if "actionnetwork.org/" in text:
        return "action-network"
    if any(x in text for x in ("tribe_events", "the events calendar", "/wp-json/tribe/events/")):
        return "wordpress-tec"
    if any(x in text for x in ("campaign locations", "protest locations", "day of action locations")):
        return "campaign-page"
    if str(source.get("default_type") or "") == "protest":
        return "civic-action"
    if any(x in text for x in ("protest", "civic", "rally", "solidarity", "labour", "labor", "activism", "action call")):
        return "civic-action"
    if any(x in text for x in ("library", "bibliothèque", "bibliotheque", "bibliocommons", "banq", "public library")):
        return "library"
    if any(x in text for x in ("university", "université", "universite", "college", "faculty", "department", "mcgill", "uqam", "queen's")):
        return "university"
    if any(x in text for x in ("festival", "fest ", "fest-", "writersfest", "fringe", "nuit blanche", "osheaga", "fantasia")):
        return "festival"
    if any(x in text for x in ("city of ", "ville de ", "town of ", "municipal", ".ca/en/play-here", "/community-services/events")):
        return "municipal"
    language = str(source.get("language", "")).lower()
    if language.startswith("fr") or "/fr/" in text or any(x in text for x in ("événement", "evenement", "calendrier")):
        return "french-language"
    return None


def lifecycle_from_text(text: str) -> str:
    for status, pattern in STATUS_PATTERNS.items():
        if pattern.search(text or ""):
            return status
    return "active"


def _strip_accents_for_month(value: str) -> str:
    return (value.lower().replace("é", "e").replace("è", "e").replace("ê", "e")
            .replace("ë", "e").replace("à", "a").replace("â", "a").replace("ô", "o")
            .replace("î", "i").replace("ï", "i").replace("û", "u").replace("ù", "u"))


def _source_timezone(timezone_name: str | None, tz_offset_hours: int | None = None):
    if timezone_name:
        try:
            return ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            pass
    return timezone(timedelta(hours=-4 if tz_offset_hours is None else tz_offset_hours))


def parse_datetime_text(
    text: str,
    *,
    default_year: int | None = None,
    reference_date: datetime | None = None,
    timezone_name: str = "America/Toronto",
    tz_offset_hours: int | None = None,
) -> tuple[datetime | None, bool]:
    """Parse ISO, English, and French event dates without guessing a time."""
    if not text:
        return None, False
    raw = re.sub(r"\s+", " ", text).strip()
    raw = MONTH_ABBREVIATION_PERIOD_RE.sub(r"\1", raw)
    iso = re.search(
        r"\b(20\d{2}-\d{2}-\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?",
        raw,
    )
    if iso:
        has_time = iso.group(2) is not None
        value = iso.group(1)
        if has_time:
            value += f"T{iso.group(2)}:{iso.group(3)}{iso.group(4) or ''}"
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=_source_timezone(timezone_name, tz_offset_hours))
            return parsed, has_time
        except ValueError:
            pass

    clean = _strip_accents_for_month(raw)
    month_re = "|".join(sorted({re.escape(_strip_accents_for_month(k)) for k in MONTHS}, key=len, reverse=True))
    patterns = [
        rf"\b(\d{{1,2}})(?:er|e|st|nd|rd|th)?\s+({month_re})\s*(20\d{{2}})?\b",
        rf"\b({month_re})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,)?\s*(20\d{{2}})?\b",
    ]
    day = month = year = None
    for i, pat in enumerate(patterns):
        m = re.search(pat, clean, re.I)
        if not m:
            continue
        if i == 0:
            day = int(m.group(1)); month_token = m.group(2); year = int(m.group(3) or 0)
        else:
            month_token = m.group(1); day = int(m.group(2)); year = int(m.group(3) or 0)
        month = MONTHS.get(month_token) or MONTHS.get(month_token.replace("e", "é"))
        if month is None:
            # All keys are compared accent-folded here.
            for key, val in MONTHS.items():
                if _strip_accents_for_month(key) == month_token:
                    month = val; break
        break
    if not (day and month):
        numeric = re.search(r"\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b", clean)
        if numeric:
            day, month, year = map(int, numeric.groups())
        else:
            return None, False
    if not year:
        reference = reference_date or datetime.now()
        if reference.tzinfo is not None:
            reference = reference.replace(tzinfo=None)
        year = default_year or reference.year
        trial = datetime(year, month, day)
        if trial < reference - timedelta(days=60):
            year += 1

    hour = minute = 0
    has_time = False
    time_match = None
    for candidate in re.finditer(
        r"\b(\d{1,2})(?::|\s*h\s*)(\d{2})?\s*(a\.?m\.?|p\.?m\.?)?\b",
        clean,
        re.I,
    ):
        token = candidate.group(0)
        if ":" in token or "h" in token or candidate.group(3):
            time_match = candidate
            break
    if time_match:
        h = int(time_match.group(1)); minute = int(time_match.group(2) or 0); ap = (time_match.group(3) or "").lower()
        if ap.startswith("p") and h < 12: h += 12
        if ap.startswith("a") and h == 12: h = 0
        if 0 <= h <= 23 and 0 <= minute <= 59:
            hour = h; has_time = True
    try:
        return datetime(
            year,
            month,
            day,
            hour,
            minute,
            tzinfo=_source_timezone(timezone_name, tz_offset_hours),
        ), has_time
    except ValueError:
        return None, False


def _jsonld_nodes(value) -> Iterable[dict]:
    if isinstance(value, dict):
        if isinstance(value.get("@graph"), list):
            yield from _jsonld_nodes(value["@graph"])
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _jsonld_nodes(item)


def _is_event_jsonld(node: dict) -> bool:
    t = node.get("@type")
    vals = t if isinstance(t, list) else [t]
    return any(str(x).lower().endswith("event") or str(x).lower() in {"screeningevent", "festival"} for x in vals if x)


def _location(node) -> str:
    if isinstance(node, str): return node
    if isinstance(node, dict):
        address = node.get("address")
        name = str(node.get("name") or "").strip()
        if isinstance(address, dict):
            bits = [address.get("streetAddress"), address.get("addressLocality"), address.get("addressRegion")]
            address_text = ", ".join(str(x) for x in bits if x)
            return ", ".join(x for x in (name, address_text) if x)
        if isinstance(address, str):
            return ", ".join(x for x in (name, address.strip()) if x)
        return str(name or address or "")
    if isinstance(node, list):
        return "; ".join(filter(None, (_location(x) for x in node)))
    return ""


def _profile_type(adapter: str, text: str, source: dict) -> str:
    value = (text or "").lower()
    protest_terms = re.compile(
        r"\b(protest|rally|march|manifestation|picket|picket line|vigil|grève|greve|"
        r"walkout|sit-in|teach-in|occupation|blockade|day of action|solidarity action|"
        r"counter-protest|counterprotest|mobilization|mobilisation|rassemblement|piquetage)\b",
        re.I,
    )
    civic_source = (
        adapter in {"civic-action", "action-network", "campaign-page"}
        or source.get("default_type") == "protest"
    )
    about_protest = bool(
        re.search(
            r"\b(lecture|talk|panel|book|film|screening|exhibition|exhibit|archive|history|study)\b"
            r".{0,60}\b(about|on|of|examining|exploring)\b.{0,40}"
            r"\b(protests?|marches?|demonstrations?)\b",
            value,
            re.I,
        )
        or re.search(
            r"\b(protests?|marches?|demonstrations?)\b.{0,50}"
            r"\b(history|photography|posters?|archive|study|film|screening|"
            r"exhibition|exhibit|lecture|panel|book)\b",
            value,
            re.I,
        )
    )
    explicit_assembly = bool(
        re.search(
            r"\b(join|attend|gather|assemble|meet|route|starting at|march from|"
            r"picket line|take to the streets|day of action)\b.{0,80}"
            r"\b(protest|rally|march|picket|walkout|strike|sit-in|demonstration)\b|"
            r"\b(protest|rally|march|picket|walkout|strike|sit-in|demonstration)\b"
            r".{0,80}\b(at|from|outside|join|gather|assemble|meet)\b",
            value,
            re.I,
        )
    )
    if not about_protest and (
        (civic_source and protest_terms.search(value))
        or explicit_assembly
        or (
            re.search(r"\bdemonstration\b", value)
            and civic_source
        )
    ):
        return "protest"
    if re.search(r"\b(call for papers|cfp|appel à communications|appel de propositions)\b", value): return "cfp"
    if re.search(r"\b(contest|competition|concours)\b", value): return "contest"
    if re.search(r"\b(book launch|lancement de livre)\b", value): return "book-launch"
    if re.search(r"\b(book talk|author talk|discussion avec l['’]auteur)\b", value): return "book-talk"
    if re.search(r"\b(artist talk|conversation avec l['’]artiste)\b", value): return "artist-talk"
    if re.search(r"\b(scholar talk)\b", value): return "scholar-talk"
    if re.search(r"\b(philosophy caf[eé]|café philosophique)\b", value): return "philosophy-cafe"
    if re.search(r"\b(live podcast|podcast live|live podcast recording)\b", value): return "podcast-live"
    if re.search(r"\b(panel|roundtable|table ronde)\b", value): return "panel"
    if re.search(r"\b(symposium|symposium)\b", value): return "symposium"
    if re.search(r"\b(colloquium|colloque)\b", value): return "colloquium"
    if re.search(r"\b(webinar|webinaire)\b", value): return "webinar"
    if re.search(r"\b(forum)\b", value): return "forum"
    if re.search(r"\b(thesis defence|thesis defense|dissertation defence|dissertation defense|soutenance)\b", value): return "defence"
    if re.search(r"\b(memorial|commemoration|commémoration)\b", value): return "memorial"
    if re.search(r"\b(celebration|célébration)\b", value): return "celebration"
    if re.search(r"\b(networking|réseautage)\b", value): return "networking"
    if re.search(r"\b(residency|résidence)\b", value): return "residency"
    if re.search(r"\b(retreat|retraite)\b", value): return "retreat"
    if re.search(r"\b(public meeting|town hall|assemblée publique)\b", value): return "meeting"
    if re.search(r"\b(site-specific art|site specific art)\b", value): return "site-specific-art"
    if re.search(r"\b(festival of form)\b", value): return "festival-of-form"
    if re.search(r"\b(cultural reproduction)\b", value): return "cultural-reproduction"
    if re.search(r"\b(exhibition|exhibit|exposition)\b", value): return "exhibition"
    if re.search(r"\b(screening|film|cinéma|cinema|projection)\b", value): return "screening"
    if re.search(r"\b(performance|theatre|theater|concert|dance|opera|ballet)\b", value): return "performance"
    if re.search(r"\b(festival|carnival|parade)\b", value): return "festival"
    if re.search(r"\b(workshop|atelier|formation)\b", value): return "workshop"
    if re.search(r"\b(reading|lecture d['’]auteur|book launch|lancement)\b", value): return "reading"
    if re.search(r"\b(conference|symposium|colloquium|colloque|congrès|congres)\b", value): return "conference"
    if re.search(r"\b(lecture|seminar|séminaire|conférence|conference)\b", value): return "lecture"
    if re.search(r"\b(talk|conversation)\b", value): return "talk"
    if re.search(r"\b(gathering|assembly|assemblée)\b", value): return "gathering"
    if adapter == "festival": return "festival"
    return str(source.get("default_type") or PROFILE_DEFAULT_TYPES.get(adapter) or "other")


def classify_adapter_event_type(adapter: str, text: str, source: dict) -> str:
    """Public classification hook shared by structured-feed crawlers."""
    return _profile_type(adapter, text, source)


def _record(source: dict, adapter: str, title: str, dt: datetime, has_time: bool, url: str,
            venue: str, raw: str, *, end_date: datetime | None = None, organizer: str | None = None,
            series_title: str | None = None, lifecycle_status: str | None = None,
            external_uid: str | None = None) -> dict:
    full_url = urllib.parse.urljoin(source_url(source), url or source_url(source))
    explicit_organizer = organizer or (
        str(source.get("name") or "") if source.get("source_is_organizer") else ""
    )
    lifecycle = lifecycle_status or lifecycle_from_text(" ".join((title, raw)))
    source_lang = str(source.get("language") or ("fr" if adapter == "french-language" else "en"))
    confidence = 90 if has_time and venue else 74 if (has_time or venue) else 58
    if lifecycle in {"cancelled", "postponed", "rescheduled"}: confidence = max(confidence, 80)
    presence_text = " ".join((title, raw))
    event_type = _profile_type(adapter, presence_text, source)
    record_kind = "festival" if event_type == "festival" else ("civic-action" if event_type == "protest" else "event")
    interaction_format = creator_interaction_format(presence_text)
    creator_presence = creator_attendance_confirmed(presence_text)
    director_presence = director_attendance_confirmed(presence_text)
    talkback_confirmed = bool(TALKBACK_RE.search(presence_text))
    presence_claims = creator_presence_claims(presence_text)
    result = {
        "id": stable_id(full_url, dt.isoformat(timespec="minutes"), title),
        "date": dt.isoformat(timespec="minutes"),
        "end_date": end_date.isoformat(timespec="minutes") if end_date else None,
        "title": re.sub(r"\s+", " ", title).strip()[:240],
        "venue": re.sub(
            r"\s+", " ", venue or str(source.get("default_venue") or "")
        ).strip()[:240],
        "source_url": full_url,
        "source_id": source.get("id"),
        "type": event_type,
        "secondary_types": ["community"] if adapter in {"municipal", "library", "civic-action"} and event_type != "community" else [],
        "organizer": explicit_organizer,
        "publisher": source.get("name"),
        "series_title": series_title,
        "raw_excerpt": re.sub(r"\s+", " ", raw).strip()[:700],
        "source_language": source_lang,
        "platform_adapter": adapter,
        "city": source.get("city") or source.get("region") or "",
        "corridor_zone": source.get("corridor_zone") or "",
        "timezone": source.get("timezone") or "America/Toronto",
        "record_kind": record_kind,
        "date_precision": "exact" if has_time else "date",
        "time_precision": "exact" if has_time else "unknown",
        "lifecycle_status": lifecycle,
        "external_uid": external_uid or None,
        "confidence": confidence,
        "attendance_confirmed": bool(creator_presence or interaction_format or explicit_organizer),
        "attendance_evidence": (
            "explicit creator or participant attendance language"
            if creator_presence
            else f"confirmed {interaction_format}"
            if interaction_format
            else ""
        ),
        "interaction_format": interaction_format or None,
        "talkback_confirmed": talkback_confirmed,
        "talkback_status": "confirmed" if talkback_confirmed else None,
        "presence_claims": presence_claims,
        "director_attendance_status": (
            "confirmed"
            if director_presence
            else "unconfirmed"
            if interaction_format and re.search(r"\bdirector\b", presence_text, re.I)
            else None
        ),
        "review_status": "auto-published" if confidence >= 70 else "needs-review",
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    result["identity_aliases"] = event_identity_aliases(result)
    result["occurrence_key"] = event_occurrence_key(result)
    result["identity_key"] = result["occurrence_key"]
    return result


def _jsonld_url(node: dict, fallback: str) -> str:
    """Read the common string and object forms of JSON-LD event URLs."""
    for value in (
        node.get("url"),
        node.get("@id"),
        node.get("mainEntityOfPage"),
    ):
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nested = value.get("@id") or value.get("url")
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
    return fallback


def _jsonld_identifier(node: dict) -> str:
    value = node.get("identifier")
    values = value if isinstance(value, list) else [value]
    for candidate in values:
        if isinstance(candidate, (str, int, float)) and str(candidate).strip():
            return str(candidate).strip()
        if isinstance(candidate, dict):
            nested = candidate.get("value") or candidate.get("@id")
            if nested is not None and str(nested).strip():
                return str(nested).strip()
    return ""


def _jsonld_lifecycle(node: dict) -> str | None:
    status = str(node.get("eventStatus") or "").lower()
    if status.endswith("eventcancelled"):
        return "cancelled"
    if status.endswith("eventpostponed"):
        return "postponed"
    if status.endswith("eventrescheduled"):
        return "rescheduled"
    return None


def _parse_jsonld(html_text: str, source: dict, adapter: str) -> list[dict]:
    soup = BeautifulSoup(html_text, "html.parser")
    records: list[dict] = []
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        try:
            data = json.loads(script.string or script.get_text() or "")
        except Exception:
            continue
        for node in _jsonld_nodes(data):
            if not _is_event_jsonld(node): continue
            title = str(node.get("name") or node.get("headline") or "").strip()
            dt, has_time = parse_datetime_text(
                str(node.get("startDate") or ""),
                timezone_name=str(source.get("timezone") or "America/Toronto"),
            )
            if not title or not dt: continue
            end_dt, _ = parse_datetime_text(
                str(node.get("endDate") or ""),
                timezone_name=str(source.get("timezone") or "America/Toronto"),
            )
            desc = str(node.get("description") or title)
            records.append(_record(
                source, adapter, title, dt, has_time,
                _jsonld_url(
                    node,
                    str(source.get("_document_url") or source_url(source)),
                ),
                _location(node.get("location")),
                desc,
                end_date=end_dt, organizer=_location(node.get("organizer")) or None,
                series_title=str(node.get("superEvent", {}).get("name") or "") if isinstance(node.get("superEvent"), dict) else None,
                lifecycle_status=_jsonld_lifecycle(node),
                external_uid=_jsonld_identifier(node),
            ))
    return records


def _candidate_nodes(soup: BeautifulSoup, adapter: str):
    seen = set()
    for selector in PROFILE_SELECTORS[adapter]:
        for node in soup.select(selector):
            marker = id(node)
            if marker in seen: continue
            seen.add(marker)
            yield node


HTML_DATE_CANDIDATE_RE = re.compile(
    r"\b(?:20\d{2}-\d{2}-\d{2}|"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|"
    r"janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)"
    r"\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?|"
    r"\d{1,2}(?:er|e|st|nd|rd|th)?\s+(?:"
    r"January|February|March|April|May|June|July|August|September|October|November|December|"
    r"janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)"
    r"(?:\s+20\d{2})?)\b",
    re.I,
)


TIME_CANDIDATE_RE = re.compile(
    r"\b(?:[01]?\d|2[0-3])(?::|\s*h\s*)[0-5]\d"
    r"(?:\s*(?:a\.?m\.?|p\.?m\.?))?\b|"
    r"\b(?:1[0-2]|0?[1-9])\s*(?:a\.?m\.?|p\.?m\.?)\b",
    re.I,
)
EVENT_LINK_PATH_RE = re.compile(
    r"/(?:event|events|action|actions|campaign|rally|march|protest|calendar|"
    r"news|latest-news|whats-on)(?:/|$)",
    re.I,
)


def select_event_datetime_text(text: str, explicit_value: str = "") -> str:
    """Select one exact event date token and its nearest time.

    Returning an entire article window allowed parsers to choose an earlier
    publication or application date. The selected token is now always first,
    and unrelated dates are never handed back to ``parse_datetime_text``.
    """
    if explicit_value:
        return explicit_value
    cleaned = MONTH_ABBREVIATION_PERIOD_RE.sub(r"\1", text)
    cleaned = re.sub(
        r"\b(?:published|posted|updated|last modified|mise à jour)\s*(?:on|le)?\s*"
        r"(?:20\d{2}-\d{2}-\d{2}|"
        r"[A-Za-zÀ-ÿ]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?|"
        r"\d{1,2}(?:er|e)?\s+[A-Za-zÀ-ÿ]+(?:\s+20\d{2})?)",
        " ",
        cleaned,
        flags=re.I,
    )
    matches = list(HTML_DATE_CANDIDATE_RE.finditer(cleaned))
    if not matches:
        return ""
    event_language = re.compile(
        r"\b(event date|join us|takes? place|when|starts?|doors|rally|march|"
        r"protest|picket|walkout|lecture|panel|workshop|screening|festival|"
        r"conference|deadline|submission due|on view)\b",
        re.I,
    )
    publication_language = re.compile(
        r"\b(published|posted|updated|modified|release date|article date|"
        r"applications? (?:open|start)|registration opens?|tickets? on sale)\b",
        re.I,
    )
    ranked = []
    for index, match in enumerate(matches):
        previous_end = matches[index - 1].end() if index else 0
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(cleaned)
        before = cleaned[max(previous_end, match.start() - 110): match.start()]
        after = cleaned[match.end(): min(next_start, match.end() + 120)]
        window = before + " " + match.group(0) + " " + after
        nearby_time = TIME_CANDIDATE_RE.search(after[:90])
        score = (
            8 * len(event_language.findall(window))
            - 12 * len(publication_language.findall(window))
            + (5 if nearby_time else 0)
        )
        ranked.append((score, -index, match))
    _, _, selected = max(ranked, key=lambda row: (row[0], row[1]))
    selected_index = matches.index(selected)
    next_start = (
        matches[selected_index + 1].start()
        if selected_index + 1 < len(matches)
        else len(cleaned)
    )
    previous_end = matches[selected_index - 1].end() if selected_index else 0
    after = cleaned[selected.end(): min(next_start, selected.end() + 100)]
    before = cleaned[max(previous_end, selected.start() - 50): selected.start()]
    nearby_time = TIME_CANDIDATE_RE.search(after) or TIME_CANDIDATE_RE.search(before)
    return " ".join(
        part for part in (selected.group(0), nearby_time.group(0) if nearby_time else "") if part
    )


def _ranked_event_date_text(node, text: str) -> str:
    """Prefer actual event language over article publication metadata."""
    explicit = node.select_one(
        "[data-start],[itemprop='startDate'],time.event-date,"
        ".event-date time,.event-time time,[data-event-date]"
    )
    explicit_value = str(
        node.get("data-start")
        or node.get("data-event-date")
        or node.get("data-date")
        or ""
    )
    if explicit:
        explicit_value = str(
            explicit.get("data-start")
            or explicit.get("data-event-date")
            or explicit.get("datetime")
            or explicit.get_text(" ", strip=True)
            or ""
        )
    node_classes = " ".join(str(x) for x in (node.get("class") or [])).lower()
    if not explicit_value and any(token in node_classes for token in ("event", "action", "calendar", "schedule")):
        event_time = node.find("time", datetime=True)
        if event_time and not re.search(
            r"(?:publish|post|update|modified|entry-date)",
            " ".join(str(x) for x in (event_time.get("class") or [])).lower()
            + " "
            + str(event_time.get("itemprop") or "").lower(),
        ):
            explicit_value = str(event_time.get("datetime") or "")
    return select_event_datetime_text(text, explicit_value)


def _event_title_and_href(node) -> tuple[str, str]:
    """Choose the event heading link, not an earlier category/navigation link."""
    title_node = node.select_one(
        ".event-title,.cp-event-title,[itemprop='name'],"
        "h1,h2,h3,h4,.title"
    )
    title = title_node.get_text(" ", strip=True) if title_node else ""
    preferred = None
    if title_node:
        if title_node.name == "a" and title_node.get("href"):
            preferred = title_node
        else:
            preferred = title_node.find("a", href=True)
            if not preferred:
                parent_link = title_node.find_parent("a", href=True)
                if parent_link and node in parent_link.parents:
                    preferred = parent_link
    if preferred:
        return title or preferred.get_text(" ", strip=True), str(preferred.get("href") or "")

    scored = []
    for index, anchor in enumerate(node.find_all("a", href=True)):
        anchor_text = anchor.get_text(" ", strip=True)
        low = anchor_text.lower()
        score = 0
        if anchor.find_parent(["h1", "h2", "h3", "h4"]):
            score += 10
        if EVENT_LINK_PATH_RE.search(urllib.parse.urlsplit(str(anchor["href"])).path):
            score += 5
        if 4 <= len(anchor_text) <= 240 and low not in {
            "learn more", "read more", "details", "see more", "category",
        }:
            score += 3
        if title and re.sub(r"\W+", "", anchor_text.lower()) in re.sub(
            r"\W+", "", title.lower()
        ):
            score += 3
        scored.append((score, -index, anchor))
    if not scored:
        return title, ""
    best_score, _, chosen = max(scored, key=lambda row: (row[0], row[1]))
    if title and best_score < 5:
        return title, ""
    return title or chosen.get_text(" ", strip=True), str(chosen.get("href") or "")


def parse_html(html_text: str, source_config: dict, adapter: str | None = None) -> list[dict]:
    source = normalise_source_config(source_config)
    adapter = adapter or source.get("platform_adapter") or infer_adapter(source) or "municipal"
    if adapter not in ADAPTER_NAMES:
        raise ValueError(f"Unsupported Polymythcal adapter: {adapter}")
    structured = _parse_jsonld(html_text, source, adapter)
    announcement_reference = None
    try:
        announcement_reference = datetime.fromisoformat(
            str(source.get("_announcement_reference") or "").replace("Z", "+00:00")
        )
    except ValueError:
        pass
    soup = BeautifulSoup(html_text, "html.parser")
    records: list[dict] = list(structured)
    for node in _candidate_nodes(soup, adapter):
        full_text = node.get_text(" ", strip=True)
        if len(full_text) < 12:
            continue
        # Advance callouts often live in long organizer news articles. Keep a
        # bounded parsing window instead of discarding the entire article.
        text = full_text[:MAX_HTML_EVENT_TEXT]
        title, href = _event_title_and_href(node)
        primary_heading = node.find("h1")
        if (
            source.get("_document_url")
            and primary_heading
            and not primary_heading.find("a", href=True)
        ):
            # A detail article's unlinked H1 identifies the current document.
            # A donation, RSVP, or social link inside its body is supporting
            # material rather than the canonical announcement URL.
            href = str(source["_document_url"])
        if len(title) < 4 or title.lower() in {"learn more", "read more", "details", "voir plus", "en savoir plus"}: continue
        date_text = _ranked_event_date_text(
            node,
            " ".join(
                filter(
                    None,
                    [
                        str(node.get("data-start", "")),
                        str(node.get("data-date", "")),
                        text,
                    ],
                )
            ),
        )
        dt, has_time = parse_datetime_text(
            date_text,
            default_year=(
                announcement_reference.year if announcement_reference else None
            ),
            reference_date=announcement_reference,
            timezone_name=str(source.get("timezone") or "America/Toronto"),
        )
        if not dt: continue
        end_dt = None
        end_attr = node.get("data-end", "")
        if end_attr:
            end_dt, _ = parse_datetime_text(
                end_attr,
                default_year=(
                    announcement_reference.year if announcement_reference else None
                ),
                reference_date=announcement_reference,
                timezone_name=str(source.get("timezone") or "America/Toronto"),
            )
        venue_node = node.select_one(
            ".location,.venue,.event-location,[itemprop='location'],"
            "[itemprop='streetAddress'],address,.lieu,.place,"
            "[data-location],[data-venue],[data-address]"
        )
        venue = (
            venue_node.get_text(" ", strip=True)
            if venue_node
            else str(
                node.get("data-location")
                or node.get("data-venue")
                or node.get("data-address")
                or source.get("default_venue")
                or ""
            )
        )
        href = href or str(source.get("_document_url") or source_url(source))
        organizer_node = node.select_one(
            ".organizer,.host,.hosted-by,.presented-by,.department,"
            ".organisation,.organisateur,[itemprop='organizer']"
        )
        organizer = organizer_node.get_text(" ", strip=True) if organizer_node else None
        parent = node.select_one(".festival-name,.series,.event-series")
        records.append(_record(source, adapter, title, dt, has_time, href, venue, text,
                               end_date=end_dt, organizer=organizer,
                               series_title=parent.get_text(" ", strip=True) if parent else None))
        if len(records) >= 100: break
    return _dedupe(records)


def _dedupe(records: list[dict]) -> list[dict]:
    best: dict[str, dict] = {}
    for record in records:
        record.setdefault("identity_aliases", event_identity_aliases(record))
        record.setdefault("occurrence_key", event_occurrence_key(record))
        if not record.get("identity_key") or record["identity_key"] in record["identity_aliases"]:
            record["identity_key"] = record["occurrence_key"]
        key = str(record["occurrence_key"])
        if key not in best:
            compatible = next(
                (
                    prior_key
                    for prior_key, prior in best.items()
                    if records_represent_same_occurrence(prior, record)
                ),
                None,
            )
            if compatible:
                key = compatible
        if key not in best:
            best[key] = record
            continue
        prior = best[key]
        record_score = (
            int(bool(record.get("time_precision") == "exact")) * 3
            + int(bool(record.get("venue"))) * 2
            + int(bool(record.get("organizer")))
            + int(record.get("confidence", 0)) / 100
        )
        prior_score = (
            int(bool(prior.get("time_precision") == "exact")) * 3
            + int(bool(prior.get("venue"))) * 2
            + int(bool(prior.get("organizer")))
            + int(prior.get("confidence", 0)) / 100
        )
        richer, other = (record, prior) if record_score > prior_score else (prior, record)
        merged = dict(other)
        merged.update({k: v for k, v in richer.items() if v not in (None, "", [])})
        if prior.get("raw_excerpt") and record.get("raw_excerpt"):
            merged["raw_excerpt"] = max(
                (prior["raw_excerpt"], record["raw_excerpt"]),
                key=len,
            )
        aliases = list(
            dict.fromkeys(
                event_identity_aliases(merged)
                + list(prior.get("identity_aliases") or event_identity_aliases(prior))
                + list(record.get("identity_aliases") or event_identity_aliases(record))
            )
        )
        merged["identity_aliases"] = aliases
        merged["occurrence_key"] = event_occurrence_key(merged)
        merged["identity_key"] = merged["occurrence_key"]
        del best[key]
        best[merged["occurrence_key"]] = merged
    return list(best.values())


def parse_source_with_adapter(html_text: str, source_config: dict) -> list[dict]:
    source = normalise_source_config(source_config)
    adapter = source.get("platform_adapter") or infer_adapter(source)
    if not adapter:
        return []
    return parse_html(html_text, source, adapter)
