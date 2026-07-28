#!/usr/bin/env python3
"""Deterministic, no-shard protest harvester for Polymythcal.

Every enabled protest source is crawled on every run. Public announcements with
a date remain native Polymythcal records while missing time or location is
shown through confirmation_status and qualification_reasons. Candidate state
persists first-seen metadata, explicit source failures, and recheck scheduling.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from polymythcal_adapters import (
    event_identity_aliases,
    event_identity_key,
    event_occurrence_key,
)
from polymythcal_discovery import (
    FETCH_STATUSES,
    FetchOutcome,
    RequestsFetcher,
    crawl_source,
    iso_now,
    parse_datetime_text,
)
from polymythcal_source_health import (
    SOURCE_HEALTH_FAILURE_EXIT,
    evaluate_source_health,
)
from polymythcal_http_cache import ParsedResponseCache

ROOT = Path(__file__).resolve().parents[1]
ROSTER_PATH = ROOT / "scripts" / "sources.json"
PROTEST_CONFIG_PATH = ROOT / "scripts" / "protest-sources.json"
STATE_PATH = ROOT / "data" / "polymythcal-protest-candidates.json"
DEFAULT_OUTPUT_PATH = Path("/tmp/polymythcal-protests.json")
HTTP_CACHE_PATH = ROOT / "data" / "polymythcal-http-cache.json"

GENERIC_LOCATIONS = {
    "",
    "toronto",
    "toronto, canada",
    "toronto, on",
    "toronto, ontario",
    "toronto, ontario, canada",
    "montréal",
    "montreal",
    "kingston",
    "online",
    "virtual",
    "tbd",
    "tba",
}


class ConfigurationError(ValueError):
    """Raised when a required crawl input is missing, malformed, or unsafe."""


class PreloadedBrowserFetcher:
    """Prefer rendered browser/OCR documents, then use ordinary HTTP."""

    def __init__(self, base: RequestsFetcher, documents: dict[str, dict]):
        self.base = base
        self.documents = documents

    def clone(self):
        return PreloadedBrowserFetcher(self.base.clone(), self.documents)

    def fetch(self, url: str, *, headers: dict | None = None) -> FetchOutcome:
        document = self.documents.get(url)
        if document:
            return FetchOutcome(
                url=url,
                final_url=str(document.get("final_url") or url),
                status="success",
                body=str(document.get("html") or ""),
                content_type="text/html",
                http_status=200,
                harvest_method=str(
                    document.get("harvest_method") or "headless-browser"
                ),
            )
        return self.base.fetch(url, headers=headers)


def _read_required_json(path: Path, label: str) -> dict:
    if not path.exists():
        raise ConfigurationError(f"{label} is missing: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigurationError(f"{label} is unreadable or invalid JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ConfigurationError(f"{label} must be a JSON object: {path}")
    return value


def load_preloaded_browser_documents(path: Path | None) -> dict[str, dict]:
    if path is None or not path.exists():
        return {}
    payload = _read_required_json(path, "browser/OCR protest harvest")
    if payload.get("schema") != "polymythcal-protest-browser-ocr-v1":
        raise ConfigurationError(
            "browser/OCR protest harvest has an unsupported schema"
        )
    documents = {}
    for index, row in enumerate(payload.get("documents") or []):
        if not isinstance(row, dict):
            raise ConfigurationError(
                f"browser/OCR protest harvest documents[{index}] must be an object"
            )
        url = str(row.get("url") or "")
        body = str(row.get("html") or "")
        if not url.startswith(("http://", "https://")) or not body:
            raise ConfigurationError(
                f"browser/OCR protest harvest documents[{index}] is incomplete"
            )
        documents[url] = row
    return documents


def load_candidate_state(path: Path) -> dict:
    if not path.exists():
        return {"items": [], "source_health": []}
    state = _read_required_json(path, "protest candidate state")
    if not isinstance(state.get("items", []), list):
        raise ConfigurationError("protest candidate state.items must be an array")
    if not isinstance(state.get("source_health", []), list):
        raise ConfigurationError("protest candidate state.source_health must be an array")
    if not isinstance(state.get("announcements", []), list):
        raise ConfigurationError(
            "protest candidate state.announcements must be an array"
        )
    occurrence_keys = []
    for index, item in enumerate(state.get("items", [])):
        if not isinstance(item, dict):
            raise ConfigurationError(
                f"protest candidate state.items[{index}] must be an object"
            )
        occurrence = str(
            item.get("occurrence_key") or item.get("identity_key") or ""
        )
        if not occurrence:
            raise ConfigurationError(
                f"protest candidate state.items[{index}] has no occurrence identity"
            )
        occurrence_keys.append(occurrence)
    duplicate_occurrences = sorted(
        key for key, count in Counter(occurrence_keys).items() if count > 1
    )
    if duplicate_occurrences:
        raise ConfigurationError(
            "protest candidate state contains duplicate occurrence identities: "
            + ", ".join(duplicate_occurrences)
        )
    announcement_ids = []
    for index, item in enumerate(state.get("announcements", [])):
        if not isinstance(item, dict):
            raise ConfigurationError(
                f"protest candidate state.announcements[{index}] must be an object"
            )
        identity = str(item.get("identity_key") or "")
        if not identity:
            raise ConfigurationError(
                f"protest candidate state.announcements[{index}] has no identity_key"
            )
        announcement_ids.append(identity)
    duplicate_announcements = sorted(
        key for key, count in Counter(announcement_ids).items() if count > 1
    )
    if duplicate_announcements:
        raise ConfigurationError(
            "protest candidate state contains duplicate undated announcement "
            "identities: "
            + ", ".join(duplicate_announcements)
        )
    health_ids = []
    for index, item in enumerate(state.get("source_health", [])):
        if not isinstance(item, dict):
            raise ConfigurationError(
                f"protest candidate state.source_health[{index}] must be an object"
            )
        source_id = str(item.get("source_id") or "")
        if not source_id:
            raise ConfigurationError(
                f"protest candidate state.source_health[{index}] has no source_id"
            )
        health_ids.append(source_id)
    duplicate_health = sorted(
        key for key, count in Counter(health_ids).items() if count > 1
    )
    if duplicate_health:
        raise ConfigurationError(
            "protest candidate state contains duplicate source-health rows: "
            + ", ".join(duplicate_health)
        )
    return state


def _positive_policy_number(policy: dict, name: str, default, *, integer: bool):
    raw = policy.get(name, default)
    try:
        value = int(raw) if integer else float(raw)
    except (TypeError, ValueError) as exc:
        raise ConfigurationError(f"crawl_policy.{name} must be numeric") from exc
    if value <= 0:
        raise ConfigurationError(f"crawl_policy.{name} must be greater than zero")
    return value


def _merge_source(existing: dict, override: dict) -> dict:
    merged = dict(existing)
    for key, value in override.items():
        if key == "additional_urls":
            combined = []
            for url in list(existing.get(key) or []) + list(value or []):
                if url and url not in combined:
                    combined.append(url)
            merged[key] = combined
        else:
            merged[key] = value
    return merged


def load_protest_sources(
    roster_path: Path = ROSTER_PATH,
    protest_config_path: Path = PROTEST_CONFIG_PATH,
) -> tuple[list[dict], list[dict], dict]:
    """Load every enabled protest source plus verified public additions."""
    roster = _read_required_json(roster_path, "Polymythcal source roster")
    config = _read_required_json(protest_config_path, "protest source configuration")
    if not isinstance(roster.get("sources"), list):
        raise ConfigurationError("Polymythcal source roster.sources must be an array")
    if not isinstance(config.get("sources", []), list):
        raise ConfigurationError("protest source configuration.sources must be an array")
    if not isinstance(config.get("corroboration_sources", []), list):
        raise ConfigurationError(
            "protest source configuration.corroboration_sources must be an array"
        )
    for label, rows in (
        ("Polymythcal source roster", roster.get("sources", [])),
        ("protest source configuration", config.get("sources", [])),
        ("protest corroboration configuration", config.get("corroboration_sources", [])),
    ):
        ids = [
            str(row.get("id") or "")
            for row in rows
            if isinstance(row, dict) and row.get("id")
        ]
        duplicates = sorted(
            source_id
            for source_id, count in Counter(ids).items()
            if count > 1
        )
        if duplicates:
            raise ConfigurationError(
                f"{label} contains duplicate source ids: {', '.join(duplicates)}"
            )
    by_id: dict[str, dict] = {}
    order: list[str] = []
    for source in roster.get("sources", []):
        if source.get("default_type") != "protest":
            continue
        if not source.get("harvest_enabled", True):
            continue
        sid = str(source.get("id") or "")
        if not sid:
            continue
        by_id[sid] = dict(source)
        order.append(sid)
    for source in config.get("sources", []):
        if not source.get("harvest_enabled", True):
            continue
        sid = str(source.get("id") or "")
        if not sid:
            continue
        if sid not in by_id:
            order.append(sid)
        by_id[sid] = _merge_source(by_id.get(sid, {}), source)
    # No tier, modulo, or time-derived shard filtering belongs here.
    sources = [by_id[sid] for sid in order]
    corroboration = [
        dict(source)
        for source in config.get("corroboration_sources", [])
        if source.get("harvest_enabled", True)
    ]
    return sources, corroboration, dict(config.get("crawl_policy") or {})


def _normalized(value: str) -> str:
    return re.sub(r"\W+", "", str(value or "").lower())


def identity_key(record: dict) -> str:
    return event_identity_key(record)


def _specific_location(value: str, city: str = "") -> bool:
    clean = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    if clean in GENERIC_LOCATIONS:
        return False
    if city and clean == city.strip().lower():
        return False
    return not bool(re.search(r"\b(tbd|tba|to be (?:announced|confirmed|determined))\b", clean))


def _quality(source: dict) -> str:
    declared = source.get("source_quality")
    if declared in {"official-or-institutional", "aggregator-or-social", "unavailable"}:
        return str(declared)
    if source.get("id") == "findaprotest-toronto":
        return "aggregator-or-social"
    return "official-or-institutional"


def qualify_record(
    record: dict,
    source: dict,
    *,
    checked_at: datetime,
    unresolved_recheck_hours: float = 4,
    confirmed_recheck_hours: float = 12,
) -> dict:
    result = dict(record)
    result["type"] = "protest"
    result["record_kind"] = "civic-action"
    result["identity_aliases"] = event_identity_aliases(result)
    result["occurrence_key"] = event_occurrence_key(result)
    result["identity_key"] = result["occurrence_key"]
    result["id"] = "protest-" + result["identity_key"]
    result["timezone"] = result.get("timezone") or source.get("timezone") or "America/Toronto"
    result["city"] = result.get("city") or source.get("city") or "Toronto"
    result["corridor_zone"] = (
        result.get("corridor_zone") or source.get("corridor_zone") or "toronto"
    )
    result["source_quality"] = _quality(source)
    result.setdefault("date_precision", "date")
    result.setdefault("time_precision", "unknown")
    missing: list[str] = []
    reasons: list[str] = []
    if not result.get("date"):
        missing.append("event date")
        reasons.append("date-unconfirmed")
    if result.get("time_precision") != "exact":
        missing.append("start time")
        reasons.append("time-unconfirmed")
    if not _specific_location(str(result.get("venue") or ""), str(result.get("city") or "")):
        result["venue"] = str(result.get("venue") or "")
        missing.append("assembly location")
        reasons.append("location-unconfirmed")
    if result["source_quality"] == "aggregator-or-social":
        reasons.append("aggregator-only")
    if not result.get("organizer"):
        missing.append("organizer")
        reasons.append("organizer-unconfirmed")
    result["qualification_reasons"] = list(dict.fromkeys(reasons))
    result["missing_details"] = list(dict.fromkeys(missing))
    result["confirmation_status"] = "confirmed" if not reasons else "unconfirmed"
    result["review_status"] = "auto-published"
    result["status"] = "confirmed" if not missing else "details-pending"
    result.setdefault("lifecycle_status", "active")
    result["last_checked_at"] = checked_at.isoformat(timespec="seconds")
    result["scraped_at"] = checked_at.isoformat(timespec="seconds")
    interval = timedelta(
        hours=unresolved_recheck_hours if missing else confirmed_recheck_hours
    )
    result["next_recheck_at"] = (checked_at + interval).isoformat(timespec="seconds")
    result["original_announcement_text"] = str(
        result.get("raw_excerpt") or result.get("description") or result.get("title") or ""
    )[:1200]
    result.setdefault("attendance_confirmed", bool(result.get("organizer")))
    result["missing_count"] = 0
    return result


def retain_prior_details_during_partial_crawl(
    prior: dict,
    incoming: dict,
    source: dict,
    *,
    checked_at: datetime,
    unresolved_recheck_hours: float,
    confirmed_recheck_hours: float,
) -> dict:
    """Keep already observed facts when a partial crawl loses detail fields.

    A listing page can remain readable while its detail page is blocked. That
    partial observation proves the event still exists, but it cannot revoke a
    previously observed exact time, assembly location, or organizer.
    """
    observed_missing = list(incoming.get("missing_details") or [])
    observed_reasons = list(incoming.get("qualification_reasons") or [])
    retained = dict(incoming)
    same_day = (
        str(prior.get("date") or "")[:10]
        == str(incoming.get("date") or "")[:10]
    )
    if (
        same_day
        and incoming.get("time_precision") != "exact"
        and prior.get("time_precision") == "exact"
    ):
        retained["date"] = prior.get("date")
        retained["date_precision"] = prior.get("date_precision") or "exact"
        retained["time_precision"] = "exact"
    if (
        not _specific_location(
            str(incoming.get("venue") or ""),
            str(incoming.get("city") or ""),
        )
        and _specific_location(
            str(prior.get("venue") or ""),
            str(prior.get("city") or ""),
        )
    ):
        retained["venue"] = prior.get("venue")
    if not incoming.get("organizer") and prior.get("organizer"):
        retained["organizer"] = prior.get("organizer")
    retained = qualify_record(
        retained,
        source,
        checked_at=checked_at,
        unresolved_recheck_hours=unresolved_recheck_hours,
        confirmed_recheck_hours=confirmed_recheck_hours,
    )
    retained["current_observation_missing_details"] = observed_missing
    retained["current_observation_qualification_reasons"] = observed_reasons
    retained["source_observation_status"] = "observed-partial"
    retained["next_recheck_at"] = (
        checked_at + timedelta(hours=unresolved_recheck_hours)
    ).isoformat(timespec="seconds")
    return retained


def _record_score(record: dict) -> float:
    return (
        int(record.get("time_precision") == "exact") * 5
        + int(_specific_location(str(record.get("venue") or ""), str(record.get("city") or ""))) * 4
        + int(bool(record.get("organizer"))) * 2
        + len(str(record.get("raw_excerpt") or "")) / 1000
    )


def merge_candidate(prior: dict | None, incoming: dict, *, checked_at: datetime) -> dict:
    if not prior:
        result = dict(incoming)
        result["first_seen_at"] = checked_at.isoformat(timespec="seconds")
        return result
    richer, other = (
        (incoming, prior)
        if _record_score(incoming) >= _record_score(prior)
        else (prior, incoming)
    )
    result = dict(other)
    result.update({key: value for key, value in richer.items() if value not in (None, "", [])})
    aliases = list(
        dict.fromkeys(
            event_identity_aliases(result)
            + list(prior.get("identity_aliases") or event_identity_aliases(prior))
            + list(incoming.get("identity_aliases") or event_identity_aliases(incoming))
        )
    )
    result["identity_aliases"] = aliases
    previous_identity = str(prior.get("identity_key") or "")
    result["occurrence_key"] = event_occurrence_key(result)
    result["identity_key"] = result["occurrence_key"]
    if previous_identity and previous_identity != result["identity_key"]:
        result["legacy_identity_keys"] = list(
            dict.fromkeys(
                list(prior.get("legacy_identity_keys") or []) + [previous_identity]
            )
        )
    result["first_seen_at"] = prior.get("first_seen_at") or checked_at.isoformat(timespec="seconds")
    result["last_checked_at"] = checked_at.isoformat(timespec="seconds")
    result["next_recheck_at"] = incoming.get("next_recheck_at") or result.get("next_recheck_at")
    # A later richer crawl controls confirmation and missing-detail fields.
    for key in (
        "confirmation_status",
        "qualification_reasons",
        "missing_details",
        "status",
        "time_precision",
        "date_precision",
        "venue",
        "date",
        "lifecycle_status",
        "source_observation_status",
        "current_observation_missing_details",
        "current_observation_qualification_reasons",
    ):
        if key in incoming:
            result[key] = incoming[key]
    canonical_id = prior.get("id") or incoming.get("id")
    result["id"] = canonical_id
    prior_ids = list(prior.get("legacy_ids") or [])
    if incoming.get("id") and incoming.get("id") != canonical_id:
        prior_ids.append(incoming["id"])
    if prior_ids:
        result["legacy_ids"] = list(dict.fromkeys(prior_ids))
    return result


def _parse_iso(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def due_recheck_urls(state: dict, source_id: str, now: datetime) -> list[str]:
    urls = []
    for item in list(state.get("items", [])) + list(
        state.get("announcements", [])
    ):
        if item.get("source_id") != source_id:
            continue
        due = _parse_iso(item.get("next_recheck_at"))
        if due and due > now:
            continue
        url = str(item.get("source_url") or "")
        if url.startswith(("http://", "https://")) and url not in urls:
            urls.append(url)
    return urls


UNDATED_ACTION_RE = re.compile(
    r"\b(protest|demonstration|vigil|rally|march|picket|walkout|strike|"
    r"sit-in|teach-in|day of action|solidarity action|mobilization|"
    r"mobilisation|manifestation|rassemblement|piquetage)\b",
    re.I,
)
UNDATED_PENDING_RE = re.compile(
    r"\b(date|time|location|details?|route|assembly point)\s+"
    r"(?:tba|tbd|to be (?:announced|confirmed)|coming soon)|"
    r"\b(save the date|details? (?:soon|to follow)|upcoming action|"
    r"more information (?:soon|to follow))\b",
    re.I,
)


def extract_undated_announcements(
    document: str,
    source: dict,
    source_url: str,
    *,
    checked_at: datetime,
    recheck_hours: float,
) -> list[dict]:
    """Extract strict no-date leads without putting them in the calendar."""
    if not source.get("undated_candidates") or not document:
        return []
    soup = BeautifulSoup(document, "html.parser")
    nodes = soup.select(
        "article, .action-card, .event-card, .news-post-content, "
        ".single-post-content, .polymythcal-ocr-announcement"
    )
    rows = {}
    for node in nodes[:120]:
        text = re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()
        if len(text) < 35 or len(text) > 6000:
            continue
        action = UNDATED_ACTION_RE.search(text)
        ocr_announcement = "polymythcal-ocr-announcement" in (
            node.get("class") or []
        )
        if not action or (
            not ocr_announcement and not UNDATED_PENDING_RE.search(text)
        ):
            continue
        parsed_date, _ = parse_datetime_text(
            text,
            timezone_name=str(source.get("timezone") or "America/Toronto"),
        )
        if parsed_date:
            continue
        heading = node.find(["h1", "h2", "h3", "h4"])
        title = re.sub(
            r"\s+",
            " ",
            heading.get_text(" ", strip=True) if heading else text[:180],
        ).strip()[:240]
        link = node.find("a", href=True)
        announcement_url = (
            urljoin(source_url, str(link.get("href") or ""))
            if link
            else source_url
        )
        basis = "::".join(
            (
                str(source.get("id") or ""),
                announcement_url,
                re.sub(r"\W+", "", title.lower())[:180],
            )
        )
        identity = hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]
        rows[identity] = {
            "id": f"announcement-{identity}",
            "record_kind": "announcement-candidate",
            "identity_key": identity,
            "title": title,
            "organizer": str(source.get("name") or ""),
            "cause": action.group(0).lower(),
            "source_id": str(source.get("id") or ""),
            "source_url": announcement_url,
            "announcement_url": announcement_url,
            "original_announcement_text": text[:2400],
            "first_seen_at": checked_at.isoformat(timespec="seconds"),
            "last_checked_at": checked_at.isoformat(timespec="seconds"),
            "next_recheck_at": (
                checked_at + timedelta(hours=recheck_hours)
            ).isoformat(timespec="seconds"),
            "confirmation_status": "unconfirmed",
            "qualification_reasons": [
                "event-date-unpublished",
                "not-yet-a-calendar-event",
            ],
            "missing_details": [
                "event-date",
                "start-time",
                "assembly-location",
            ],
            "lifecycle_status": "awaiting-date",
            "missing_count": 0,
        }
    return list(rows.values())[:12]


def _token_overlap(left: str, right: str) -> bool:
    stop = {
        "the", "and", "for", "from", "with", "toronto", "ontario", "road",
        "street", "avenue", "protest", "rally", "march",
    }
    a = {x for x in re.findall(r"[a-z0-9]{4,}", left.lower()) if x not in stop}
    b = {x for x in re.findall(r"[a-z0-9]{4,}", right.lower()) if x not in stop}
    return bool(a & b)


def _flatten_json(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _flatten_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from _flatten_json(child)


def extract_corroboration(outcome: FetchOutcome, source: dict) -> list[dict]:
    """Extract evidence snippets; callers never publish these as events."""
    if outcome.status != "success":
        return []
    evidence: list[dict] = []
    text = outcome.body
    if text.lstrip().startswith(("{", "[")):
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return []
        for item in _flatten_json(payload):
            joined = " ".join(str(x) for x in item.values() if isinstance(x, (str, int, float)))
            if not re.search(r"\b(protest|demonstration|rally|march|special event)\b", joined, re.I):
                continue
            date_value = next(
                (
                    str(item[key])
                    for key in item
                    if re.search(r"(?:start|from).*(?:date|time)|(?:date|time).*start", key, re.I)
                ),
                "",
            )
            if re.fullmatch(r"\d{12,13}", date_value):
                event_date = datetime.fromtimestamp(
                    int(date_value) / 1000,
                    tz=ZoneInfo(str(source.get("timezone") or "America/Toronto")),
                )
            else:
                event_date, _ = parse_datetime_text(
                    date_value or joined,
                    timezone_name=str(source.get("timezone") or "America/Toronto"),
                )
            evidence.append(
                {
                    "source_id": source.get("id"),
                    "source_url": outcome.final_url,
                    "date": event_date.isoformat() if event_date else "",
                    "text": joined[:1000],
                }
            )
        return evidence
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    for entry in root.iter():
        if entry.tag.rsplit("}", 1)[-1].lower() not in {"item", "entry"}:
            continue
        values = []
        link = ""
        for child in entry.iter():
            name = child.tag.rsplit("}", 1)[-1].lower()
            if name == "link":
                link = child.get("href") or child.text or link
            if name in {"title", "description", "summary", "content"}:
                values.append(BeautifulSoup(child.text or "", "html.parser").get_text(" ", strip=True))
        joined = " ".join(values)
        if not re.search(r"\b(protest|demonstration|rally|march)\b", joined, re.I):
            continue
        event_date, _ = parse_datetime_text(
            joined,
            timezone_name=str(source.get("timezone") or "America/Toronto"),
        )
        evidence.append(
            {
                "source_id": source.get("id"),
                "source_url": link or outcome.final_url,
                "date": event_date.isoformat() if event_date else "",
                "text": joined[:1000],
            }
        )
    return evidence


def add_corroboration(record: dict, evidence: list[dict]) -> dict:
    result = dict(record)
    matches = []
    record_date = str(record.get("date") or "")[:10]
    haystack = " ".join(
        str(record.get(key) or "")
        for key in ("title", "venue", "raw_excerpt", "organizer")
    )
    for item in evidence:
        if item.get("date") and str(item["date"])[:10] != record_date:
            continue
        if not _token_overlap(haystack, str(item.get("text") or "")):
            continue
        matches.append(
            {
                "source_id": item.get("source_id"),
                "source_url": item.get("source_url"),
            }
        )
    if matches:
        result["corroboration"] = matches
    return result


def run_harvest(
    *,
    sources: list[dict],
    corroboration_sources: list[dict],
    prior_state: dict,
    fetcher: RequestsFetcher,
    now: datetime,
    max_pages: int,
    max_depth: int,
    max_elapsed_seconds: float = 90,
    max_workers: int = 6,
    unresolved_recheck_hours: float = 4,
    confirmed_recheck_hours: float = 12,
    parsed_cache: ParsedResponseCache | None = None,
    undated_candidate_expiry_days: int = 90,
) -> tuple[dict, dict]:
    by_occurrence = {
        str(item.get("occurrence_key") or event_occurrence_key(item)): dict(item)
        for item in prior_state.get("items", [])
        if item.get("identity_key")
    }
    for occurrence, item in by_occurrence.items():
        item.setdefault("occurrence_key", occurrence)
    prior_occurrence_keys = set(by_occurrence)
    source_results = {}
    source_yields = []
    source_health = []
    prior_health = {
        str(item.get("source_id")): item
        for item in prior_state.get("source_health", [])
        if item.get("source_id")
    }
    observed: set[str] = set()
    source_configs = {str(source.get("id")): source for source in sources}
    announcement_by_identity = {
        str(item.get("identity_key") or ""): dict(item)
        for item in prior_state.get("announcements", [])
        if item.get("identity_key")
    }
    observed_announcements: set[str] = set()

    def crawl_one(source):
        sid = str(source.get("id") or "")
        seeds = [
            str(source.get("events_url") or ""),
            *[str(x) for x in source.get("additional_urls") or []],
            *due_recheck_urls(prior_state, sid, now),
        ]
        seeds = list(dict.fromkeys(url for url in seeds if url.startswith(("http://", "https://"))))
        source_fetcher = fetcher.clone() if hasattr(fetcher, "clone") else fetcher
        return crawl_source(
            source,
            fetcher=source_fetcher,
            seed_urls=seeds,
            max_pages=max_pages,
            max_depth=max_depth,
            max_elapsed_seconds=max_elapsed_seconds,
            parsed_cache=parsed_cache,
        )

    crawled: dict[str, object] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        futures = {
            str(source.get("id") or ""): pool.submit(crawl_one, source)
            for source in sources
        }
        for sid, future in futures.items():
            try:
                crawled[sid] = future.result()
            except Exception as exc:
                # A worker-level bug is a source failure, never an empty page.
                from polymythcal_discovery import CrawlResult
                crawled[sid] = CrawlResult(
                    source_id=sid,
                    status="fetch-error",
                    fetches=[
                        FetchOutcome(
                            url=str(source_configs[sid].get("events_url") or ""),
                            status="fetch-error",
                            error=f"crawl worker failed: {exc}",
                            failure_kind="worker-exception",
                        )
                    ],
                )

    for source in sources:
        sid = str(source.get("id") or "")
        result = crawled[sid]
        result_alias_counts = Counter(
            alias
            for raw in result.records
            if raw.get("type") == "protest"
            for alias in (raw.get("identity_aliases") or event_identity_aliases(raw))
        )
        source_results[sid] = result
        yield_row = result.source_yield()
        source_yields.append(yield_row)
        source_health.append(
            {
                **yield_row,
                "checked_at": now.isoformat(timespec="seconds"),
                "last_successful_extraction_at": (
                    now.isoformat(timespec="seconds") if result.records else None
                )
                or prior_health.get(sid, {}).get("last_successful_extraction_at"),
            }
        )
        for raw in result.records:
            if raw.get("type") != "protest":
                continue
            qualified = qualify_record(
                raw,
                source,
                checked_at=now,
                unresolved_recheck_hours=unresolved_recheck_hours,
                confirmed_recheck_hours=confirmed_recheck_hours,
            )
            qualified["source_observation_status"] = "observed"
            key = qualified["occurrence_key"]
            prior = by_occurrence.get(key)
            matched_key = key if prior is not None else None
            if prior is None:
                same_identity = [
                    (prior_key, item)
                    for prior_key, item in by_occurrence.items()
                    if set(
                        item.get("identity_aliases") or event_identity_aliases(item)
                    ).intersection(qualified["identity_aliases"])
                    and item.get("source_id") == qualified.get("source_id")
                ]
                if len(same_identity) == 1:
                    old_key, candidate = same_identity[0]
                    shared_aliases = set(
                        candidate.get("identity_aliases")
                        or event_identity_aliases(candidate)
                    ).intersection(qualified["identity_aliases"])
                    same_day_incomplete_match = (
                        str(candidate.get("date") or "")[:10]
                        == str(qualified.get("date") or "")[:10]
                        and (
                            candidate.get("time_precision") != "exact"
                            or qualified.get("time_precision") != "exact"
                            or not _specific_location(
                                str(candidate.get("venue") or ""),
                                str(candidate.get("city") or ""),
                            )
                            or not _specific_location(
                                str(qualified.get("venue") or ""),
                                str(qualified.get("city") or ""),
                            )
                        )
                    )
                    unique_publisher_reschedule = (
                        old_key in prior_occurrence_keys
                        and not candidate.get("recurrence_id")
                        and not qualified.get("recurrence_id")
                        and bool(shared_aliases)
                        and all(result_alias_counts[alias] == 1 for alias in shared_aliases)
                    )
                    if same_day_incomplete_match or unique_publisher_reschedule:
                        prior = candidate
                        matched_key = old_key
            if prior is not None and result.status == "partial-failure":
                qualified = retain_prior_details_during_partial_crawl(
                    prior,
                    qualified,
                    source,
                    checked_at=now,
                    unresolved_recheck_hours=unresolved_recheck_hours,
                    confirmed_recheck_hours=confirmed_recheck_hours,
                )
            merged = merge_candidate(prior, qualified, checked_at=now)
            merged["missing_count"] = 0
            merged_key = str(merged.get("occurrence_key") or event_occurrence_key(merged))
            merged["occurrence_key"] = merged_key
            merged["identity_key"] = merged_key
            if matched_key and matched_key != merged_key:
                del by_occurrence[matched_key]
                prior_occurrence_keys.discard(matched_key)
            by_occurrence[merged_key] = merged
            observed.add(merged_key)

        if source.get("undated_candidates"):
            for fetched in result.fetches:
                if fetched.status != "success" or not fetched.body:
                    continue
                for announcement in extract_undated_announcements(
                    fetched.body,
                    source,
                    fetched.final_url or fetched.url,
                    checked_at=now,
                    recheck_hours=unresolved_recheck_hours,
                ):
                    identity = announcement["identity_key"]
                    prior_announcement = announcement_by_identity.get(identity)
                    if prior_announcement:
                        announcement["first_seen_at"] = (
                            prior_announcement.get("first_seen_at")
                            or announcement["first_seen_at"]
                        )
                    announcement_by_identity[identity] = {
                        **(prior_announcement or {}),
                        **announcement,
                    }
                    observed_announcements.add(identity)

    expiry = now - timedelta(days=max(1, undated_candidate_expiry_days))
    for identity, announcement in list(announcement_by_identity.items()):
        first_seen = _parse_iso(announcement.get("first_seen_at"))
        if first_seen and first_seen < expiry:
            del announcement_by_identity[identity]
            continue
        if identity in observed_announcements:
            continue
        result = source_results.get(str(announcement.get("source_id") or ""))
        if result and result.status in {"success", "confirmed-empty"}:
            announcement["missing_count"] = int(
                announcement.get("missing_count") or 0
            ) + 1
            if announcement["missing_count"] >= 2:
                announcement["lifecycle_status"] = "missing-on-source"
        elif result:
            announcement["source_observation_status"] = "source-unavailable"
        announcement["last_checked_at"] = now.isoformat(timespec="seconds")
        announcement["next_recheck_at"] = (
            now + timedelta(hours=unresolved_recheck_hours)
        ).isoformat(timespec="seconds")

    evidence = []
    for source in corroboration_sources:
        url = str(source.get("events_url") or "")
        outcome = fetcher.fetch(url)
        evidence.extend(extract_corroboration(outcome, source))
        status = outcome.status
        source_yields.append(
            {
                "source_id": source.get("id"),
                "role": "corroboration",
                "status": status,
                "events": 0,
                "pages_fetched": 1,
                "fetch_statuses": {status: 1},
                "http_statuses": [
                    {"url": url, "status": outcome.http_status, "result": status}
                ],
                "parse_errors": [],
            }
        )

    for key, item in list(by_occurrence.items()):
        event_dt = _parse_iso(item.get("date"))
        if event_dt and event_dt < now - timedelta(days=14):
            del by_occurrence[key]
            continue
        if key in observed:
            continue
        sid = str(item.get("source_id") or "")
        result = source_results.get(sid)
        if not result:
            continue
        # Source failure preserves the last known event state. A successful
        # crawl that loses a prior event makes the disappearance visible.
        if result.status in {"success", "confirmed-empty"}:
            missing_count = int(item.get("missing_count") or 0) + 1
            item["missing_count"] = missing_count
            if missing_count >= 2:
                item["lifecycle_status"] = "missing-on-source"
                item["source_observation_status"] = "missing"
                item["confirmation_status"] = "unconfirmed"
                reasons = list(item.get("qualification_reasons") or [])
                if "official-source-unconfirmed" not in reasons:
                    reasons.append("official-source-unconfirmed")
                item["qualification_reasons"] = reasons
            else:
                item["source_observation_status"] = "not-observed-once"
            item["last_checked_at"] = now.isoformat(timespec="seconds")
            item["next_recheck_at"] = (
                now + timedelta(hours=unresolved_recheck_hours)
            ).isoformat(timespec="seconds")
        else:
            item["source_observation_status"] = "source-unavailable"
            item["next_recheck_at"] = (
                now + timedelta(hours=unresolved_recheck_hours)
            ).isoformat(timespec="seconds")

    items = [
        add_corroboration(item, evidence)
        for item in by_occurrence.values()
        if item.get("date")
    ]
    items.sort(key=lambda item: (str(item.get("date") or ""), str(item.get("title") or "")))
    announcements = sorted(
        announcement_by_identity.values(),
        key=lambda item: (
            str(item.get("first_seen_at") or ""),
            str(item.get("title") or ""),
        ),
        reverse=True,
    )
    source_health_gate = evaluate_source_health(sources, source_yields)
    state = {
        "$schema_ref": "/data/polymythcal-protest-candidate-schema.json",
        "version": 2,
        "updated_at": now.isoformat(timespec="seconds"),
        "items": items,
        "announcements": announcements,
        "source_health": source_health,
    }
    output = {
        "stream": "deterministic-protests",
        "generated_at": now.isoformat(timespec="seconds"),
        "scope": "all-enabled-protest-sources-unsharded",
        "sharded": False,
        "selected_source_ids": [str(source.get("id") or "") for source in sources],
        "events": items,
        "announcements": announcements,
        "watchlist": announcements,
        "source_yields": source_yields,
        "source_health_gate": source_health_gate,
        "summary": {
            "sources": len(sources),
            "corroboration_sources": len(corroboration_sources),
            "events": len(items),
            "confirmed": sum(item.get("confirmation_status") == "confirmed" for item in items),
            "unconfirmed": sum(item.get("confirmation_status") == "unconfirmed" for item in items),
            "undated_announcements": len(announcements),
            "source_failures": sum(
                item.get("status") in {
                    "partial-failure", "fetch-error", "blocked", "parse-empty-regression"
                }
                or any(
                    status in {"fetch-error", "blocked", "parse-empty-regression"}
                    for status in (item.get("fetch_statuses") or {})
                )
                for item in source_yields
            ),
            "source_health_gate": source_health_gate["status"],
            "authoritative_primary_sources": source_health_gate[
                "authoritative_primary_sources"
            ],
        },
    }
    return output, state


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--state", type=Path, default=STATE_PATH)
    parser.add_argument("--sources", type=Path, default=ROSTER_PATH)
    parser.add_argument("--protest-config", type=Path, default=PROTEST_CONFIG_PATH)
    parser.add_argument("--source", action="append", help="Run selected source id(s); tests/debug only.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--max-depth", type=int)
    parser.add_argument("--max-elapsed-seconds", type=float)
    parser.add_argument("--max-workers", type=int)
    parser.add_argument("--http-cache", type=Path, default=HTTP_CACHE_PATH)
    parser.add_argument("--browser-ocr-input", type=Path)
    args = parser.parse_args()

    try:
        sources, corroboration, policy = load_protest_sources(args.sources, args.protest_config)
        prior_state = load_candidate_state(args.state)
        request_timeout = _positive_policy_number(
            policy, "request_timeout_seconds", 10, integer=False
        )
        policy_max_pages = _positive_policy_number(
            policy, "max_pages_per_source", 12, integer=True
        )
        policy_max_depth = _positive_policy_number(
            policy, "max_depth", 3, integer=True
        )
        policy_max_elapsed = _positive_policy_number(
            policy, "max_elapsed_seconds_per_source", 90, integer=False
        )
        policy_max_workers = _positive_policy_number(
            policy, "max_workers", 6, integer=True
        )
        unresolved_recheck_hours = _positive_policy_number(
            policy, "unresolved_recheck_hours", 4, integer=False
        )
        confirmed_recheck_hours = _positive_policy_number(
            policy, "confirmed_recheck_hours", 12, integer=False
        )
        undated_candidate_expiry_days = _positive_policy_number(
            policy, "undated_candidate_expiry_days", 90, integer=True
        )
        preloaded_documents = load_preloaded_browser_documents(
            args.browser_ocr_input
        )
    except ConfigurationError as exc:
        print(f"PROTEST HARVEST CONFIGURATION FAILED — {exc}", file=sys.stderr)
        return 78
    if args.source:
        selected = set(args.source)
        sources = [source for source in sources if source.get("id") in selected]
        corroboration = [source for source in corroboration if source.get("id") in selected]
        missing = selected - {
            str(source.get("id")) for source in sources + corroboration
        }
        if missing:
            print(f"Unknown protest source id(s): {', '.join(sorted(missing))}", file=sys.stderr)
            return 2
    now = datetime.now(timezone.utc)
    parsed_cache = ParsedResponseCache(args.http_cache)
    fetcher: RequestsFetcher | PreloadedBrowserFetcher = RequestsFetcher(
        timeout=request_timeout
    )
    if preloaded_documents:
        fetcher = PreloadedBrowserFetcher(fetcher, preloaded_documents)
    output, state = run_harvest(
        sources=sources,
        corroboration_sources=corroboration,
        prior_state=prior_state,
        fetcher=fetcher,
        now=now,
        max_pages=args.max_pages or policy_max_pages,
        max_depth=args.max_depth or policy_max_depth,
        max_elapsed_seconds=args.max_elapsed_seconds or policy_max_elapsed,
        max_workers=args.max_workers or policy_max_workers,
        unresolved_recheck_hours=unresolved_recheck_hours,
        confirmed_recheck_hours=confirmed_recheck_hours,
        parsed_cache=parsed_cache,
        undated_candidate_expiry_days=undated_candidate_expiry_days,
    )
    print(json.dumps(output["summary"], sort_keys=True))
    if not args.dry_run:
        # Write complete diagnostics before returning a systemic failure. The
        # workflow stops before publication but can still upload the evidence.
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
        args.state.parent.mkdir(parents=True, exist_ok=True)
        args.state.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
        parsed_cache.save()
    gate = output["source_health_gate"]
    if gate["status"] != "passed":
        print(
            "PROTEST HARVEST SOURCE-HEALTH GATE FAILED — "
            f"{gate['reason']}; "
            f"{gate['authoritative_primary_sources']}/"
            f"{gate['expected_primary_sources']} primary sources produced an "
            "authoritative observation. Publication was blocked.",
            file=sys.stderr,
        )
        return SOURCE_HEALTH_FAILURE_EXIT
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
