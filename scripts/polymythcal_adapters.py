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

from bs4 import BeautifulSoup

ADAPTER_NAMES = {
    "municipal",
    "university",
    "library",
    "festival",
    "french-language",
    "civic-action",
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
    "civic-action": ["article.action", ".action-card", ".event-card", "article.event", "article", "li"],
}

PROFILE_DEFAULT_TYPES = {
    "municipal": "community",
    "university": "lecture",
    "library": "workshop",
    "festival": "festival",
    "french-language": "other",
    "civic-action": "protest",
}


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
    return out


def infer_adapter(source: dict) -> str | None:
    text = " ".join(str(source.get(k, "")) for k in (
        "id", "name", "events_url", "url", "base_url", "notes", "language", "region", "city"
    )).lower()
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


def parse_datetime_text(text: str, *, default_year: int | None = None, tz_offset_hours: int = -4) -> tuple[datetime | None, bool]:
    """Parse ISO, English, and French event dates without guessing a time."""
    if not text:
        return None, False
    raw = re.sub(r"\s+", " ", text).strip()
    iso = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?", raw)
    if iso:
        y, m, d = map(int, iso.group(1, 2, 3))
        has_time = iso.group(4) is not None
        h, minute = (int(iso.group(4) or 0), int(iso.group(5) or 0))
        return datetime(y, m, d, h, minute, tzinfo=timezone(timedelta(hours=tz_offset_hours))), has_time

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
        year = default_year or datetime.now().year
        trial = datetime(year, month, day)
        if trial < datetime.now() - timedelta(days=60):
            year += 1

    hour = minute = 0
    has_time = False
    time_match = re.search(r"\b(\d{1,2})(?::|\s*h\s*)(\d{2})?\s*(a\.?m\.?|p\.?m\.?)?\b", clean, re.I)
    if time_match:
        h = int(time_match.group(1)); minute = int(time_match.group(2) or 0); ap = (time_match.group(3) or "").lower()
        # Avoid mistaking the date day for a time when no separator/AM/PM exists.
        token = time_match.group(0)
        if ":" in token or "h" in token or ap:
            if ap.startswith("p") and h < 12: h += 12
            if ap.startswith("a") and h == 12: h = 0
            if 0 <= h <= 23 and 0 <= minute <= 59:
                hour = h; has_time = True
    try:
        return datetime(year, month, day, hour, minute, tzinfo=timezone(timedelta(hours=tz_offset_hours))), has_time
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
        return str(name or address or "")
    if isinstance(node, list):
        return "; ".join(filter(None, (_location(x) for x in node)))
    return ""


def _profile_type(adapter: str, text: str, source: dict) -> str:
    value = (text or "").lower()
    if re.search(r"\b(call for papers|cfp|appel à communications|appel de propositions)\b", value): return "cfp"
    if re.search(r"\b(contest|competition|concours)\b", value): return "contest"
    if re.search(r"\b(exhibition|exhibit|exposition)\b", value): return "exhibition"
    if re.search(r"\b(screening|film|cinéma|cinema|projection)\b", value): return "screening"
    if re.search(r"\b(workshop|atelier|formation)\b", value): return "workshop"
    if re.search(r"\b(reading|lecture d['’]auteur|book launch|lancement)\b", value): return "reading"
    if re.search(r"\b(conference|symposium|colloquium|colloque|congrès|congres)\b", value): return "conference"
    if re.search(r"\b(lecture|talk|seminar|séminaire|conférence|conference)\b", value): return "lecture"
    if re.search(r"\b(protest|rally|march|manifestation|picket|vigil|grève|greve)\b", value): return "protest"
    if adapter == "festival": return "festival"
    return str(source.get("default_type") or PROFILE_DEFAULT_TYPES.get(adapter) or "other")


def _record(source: dict, adapter: str, title: str, dt: datetime, has_time: bool, url: str,
            venue: str, raw: str, *, end_date: datetime | None = None, organizer: str | None = None,
            series_title: str | None = None) -> dict:
    full_url = urllib.parse.urljoin(source_url(source), url or source_url(source))
    lifecycle = lifecycle_from_text(" ".join((title, raw)))
    source_lang = str(source.get("language") or ("fr" if adapter == "french-language" else "en"))
    confidence = 90 if has_time and venue else 74 if (has_time or venue) else 58
    if lifecycle in {"cancelled", "postponed", "rescheduled"}: confidence = max(confidence, 80)
    event_type = _profile_type(adapter, " ".join((title, raw)), source)
    record_kind = "festival" if event_type == "festival" else ("civic-action" if event_type == "protest" else "event")
    return {
        "id": stable_id(full_url, dt.isoformat(timespec="minutes"), title),
        "date": dt.isoformat(timespec="minutes"),
        "end_date": end_date.isoformat(timespec="minutes") if end_date else None,
        "title": re.sub(r"\s+", " ", title).strip()[:240],
        "venue": re.sub(r"\s+", " ", venue or str(source.get("default_venue") or source.get("city") or "")).strip()[:240],
        "source_url": full_url,
        "source_id": source.get("id"),
        "type": event_type,
        "secondary_types": ["community"] if adapter in {"municipal", "library", "civic-action"} and event_type != "community" else [],
        "organizer": organizer or source.get("name"),
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
        "confidence": confidence,
        "attendance_confirmed": confidence >= 80,
        "review_status": "auto-published" if confidence >= 70 else "needs-review",
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


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
            dt, has_time = parse_datetime_text(str(node.get("startDate") or ""))
            if not title or not dt: continue
            end_dt, _ = parse_datetime_text(str(node.get("endDate") or ""))
            desc = str(node.get("description") or title)
            records.append(_record(
                source, adapter, title, dt, has_time,
                str(node.get("url") or source_url(source)), _location(node.get("location")), desc,
                end_date=end_dt, organizer=_location(node.get("organizer")) or None,
                series_title=str(node.get("superEvent", {}).get("name") or "") if isinstance(node.get("superEvent"), dict) else None,
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


def parse_html(html_text: str, source_config: dict, adapter: str | None = None) -> list[dict]:
    source = normalise_source_config(source_config)
    adapter = adapter or source.get("platform_adapter") or infer_adapter(source) or "municipal"
    if adapter not in ADAPTER_NAMES:
        raise ValueError(f"Unsupported Polymythcal adapter: {adapter}")
    structured = _parse_jsonld(html_text, source, adapter)
    if structured:
        return _dedupe(structured)

    soup = BeautifulSoup(html_text, "html.parser")
    records: list[dict] = []
    for node in _candidate_nodes(soup, adapter):
        text = node.get_text(" ", strip=True)
        if len(text) < 12 or len(text) > 2400: continue
        title_node = node.select_one("h1,h2,h3,h4,.title,.event-title,.cp-event-title,[itemprop='name']")
        link = node.find("a", href=True)
        title = (title_node.get_text(" ", strip=True) if title_node else (link.get_text(" ", strip=True) if link else ""))
        if len(title) < 4 or title.lower() in {"learn more", "read more", "details", "voir plus", "en savoir plus"}: continue
        date_text = " ".join(filter(None, [
            node.get("data-start", ""), node.get("data-date", ""),
            (node.select_one("time") or {}).get("datetime", "") if node.select_one("time") else "",
            text,
        ]))
        dt, has_time = parse_datetime_text(date_text)
        if not dt: continue
        end_dt = None
        end_attr = node.get("data-end", "")
        if end_attr: end_dt, _ = parse_datetime_text(end_attr)
        venue_node = node.select_one(".location,.venue,.event-location,[itemprop='location'],.lieu,.place")
        venue = venue_node.get_text(" ", strip=True) if venue_node else str(source.get("default_venue") or source.get("city") or "")
        href = link.get("href") if link else source_url(source)
        organizer_node = node.select_one(".organizer,.host,.department,.organisation,.organisateur")
        organizer = organizer_node.get_text(" ", strip=True) if organizer_node else None
        parent = node.select_one(".festival-name,.series,.event-series")
        records.append(_record(source, adapter, title, dt, has_time, href, venue, text,
                               end_date=end_dt, organizer=organizer,
                               series_title=parent.get_text(" ", strip=True) if parent else None))
        if len(records) >= 100: break
    return _dedupe(records)


def _dedupe(records: list[dict]) -> list[dict]:
    best: dict[tuple, dict] = {}
    for record in records:
        key = (re.sub(r"\W+", "", record.get("title", "").lower())[:120], record.get("date", "")[:16])
        if key not in best or int(record.get("confidence", 0)) > int(best[key].get("confidence", 0)):
            best[key] = record
    return list(best.values())


def parse_source_with_adapter(html_text: str, source_config: dict) -> list[dict]:
    source = normalise_source_config(source_config)
    adapter = source.get("platform_adapter") or infer_adapter(source)
    if not adapter:
        return []
    return parse_html(html_text, source, adapter)
