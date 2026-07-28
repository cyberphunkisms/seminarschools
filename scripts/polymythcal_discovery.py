#!/usr/bin/env python3
"""Bounded, reusable discovery crawler for Polymythcal sources.

The scheduled protest harvester uses this module on every protest source.
The same functions are intentionally category-neutral so the general seminar,
festival, opportunity, screening, performance, and contest harvesters can use
the feed, sitemap, pagination, detail-page, WordPress, and platform discovery
path without changing their event taxonomy.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Callable, Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from bs4 import BeautifulSoup
from dateutil.rrule import rrulestr

from polymythcal_adapters import (
    classify_adapter_event_type,
    creator_attendance_confirmed,
    event_identity_aliases,
    event_occurrence_key,
    infer_adapter,
    lifecycle_from_text,
    normalise_source_config,
    parse_datetime_text,
    parse_html,
    records_represent_same_occurrence,
    select_event_datetime_text,
    stable_id,
)

FETCH_STATUSES = {
    "success",
    "partial-failure",
    "not-modified",
    "confirmed-empty",
    "fetch-error",
    "blocked",
    "parse-empty-regression",
}

FEED_TYPES = {
    "application/rss+xml",
    "application/atom+xml",
    "text/calendar",
    "application/ics",
    "text/xml",
    "application/xml",
}

PLATFORM_HOSTS = (
    "actionnetwork.org",
    "eventbrite.ca",
    "eventbrite.com",
    "mobilize.us",
    "linktr.ee",
    "meetup.com",
    "lu.ma",
    "luma.com",
    "humanitix.com",
    "events.humanitix.com",
    "zeffy.com",
    "www.zeffy.com",
    "tickettailor.com",
    "www.tickettailor.com",
    "universe.com",
    "www.universe.com",
)

DETAIL_PATH_RE = re.compile(
    r"/(?:event|events|action|actions|campaign|campaigns|rally|march|protest|"
    r"calendar|take-action|news|press-release|media)(?:/|$)",
    re.I,
)
PAGINATION_RE = re.compile(r"(?:[?&](?:page|paged)=\d+|/page/\d+/?$)", re.I)
PROTEST_SIGNAL_RE = re.compile(
    r"\b(protest|demonstration|vigil|rally|march|picket|walkout|strike|"
    r"sit-in|teach-in|occupation|"
    r"blockade|day of action|solidarity action|counter-protest|mobilization|"
    r"mobilisation|manifestation|rassemblement|piquetage|grève|greve)\b",
    re.I,
)
EVENT_NAVIGATION_SIGNAL_RE = re.compile(
    r"\b(?:upcoming\s+events?|events?\s+calendar|calendar\s+of\s+events?|"
    r"actions?\s+calendar|view\s+(?:all\s+)?events?)\b",
    re.I,
)
CHALLENGE_PAGE_RE = re.compile(
    r"(?:<title>\s*(?:just a moment|attention required|access denied)|"
    r"cf-chl-|challenge-platform|cdn-cgi/challenge|"
    r"enable javascript and cookies to continue|"
    r"incapsula incident id|perimeterx|captcha-container)",
    re.I,
)
EMPTY_APP_SHELL_RE = re.compile(
    r"<(?:div|main)[^>]+id=[\"'](?:app|root|__next|___gatsby)[\"'][^>]*>"
    r"\s*(?:<!--.*?-->\s*)?</(?:div|main)>",
    re.I | re.S,
)
EXPLICIT_EMPTY_RE = re.compile(
    r"\b(?:no (?:upcoming )?(?:events?|actions?|activities)(?: found| posted| scheduled)?|"
    r"no additional (?:events?|actions?|activities)|"
    r"there (?:are|is) (?:currently )?no (?:events?|activities)|"
    r"nothing (?:is )?scheduled|calendar is empty|"
    r"aucun(?:e)? (?:événement|evenement|activité|activite)s?|"
    r"pas d['’](?:événements|evenements|activités|activites))\b",
    re.I,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat(timespec="seconds")


def source_timezone(source: dict):
    name = str(source.get("timezone") or "America/Toronto")
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=-4))


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def looks_like_challenge_page(text: str) -> bool:
    return bool(CHALLENGE_PAGE_RE.search(text or ""))


def looks_like_empty_app_shell(text: str) -> bool:
    if not EMPTY_APP_SHELL_RE.search(text or ""):
        return False
    soup = BeautifulSoup(text, "html.parser")
    visible = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()
    return len(visible) < 120


def visible_text(text: str) -> str:
    stripped = (text or "").lstrip()
    if re.match(
        r"(?:<\?xml[^>]*>\s*)?<(?:rss|feed|rdf|urlset|sitemapindex)\b",
        stripped,
        re.I,
    ):
        try:
            root = ET.fromstring(text)
            return re.sub(
                r"\s+",
                " ",
                " ".join(value.strip() for value in root.itertext() if value.strip()),
            ).strip()
        except ET.ParseError:
            pass
    return re.sub(
        r"\s+",
        " ",
        BeautifulSoup(text or "", "html.parser").get_text(" ", strip=True),
    ).strip()


@dataclass
class FetchOutcome:
    url: str
    status: str
    body: str = ""
    content_type: str = ""
    http_status: int | None = None
    error: str = ""
    failure_kind: str = ""
    etag: str = ""
    last_modified: str = ""
    final_url: str = ""
    body_hash: str = ""
    empty_evidence: str = ""
    cache_reused: bool = False
    retained_observation_at: str = ""
    harvest_method: str = "http"

    def __post_init__(self):
        if self.status not in FETCH_STATUSES:
            raise ValueError(f"unsupported fetch status: {self.status}")
        if self.body and not self.body_hash:
            self.body_hash = content_hash(self.body)
        if not self.final_url:
            self.final_url = self.url


class RequestsFetcher:
    """HTTP fetcher that distinguishes blocks, errors, 304s, and real pages."""

    def __init__(self, timeout: int = 10, user_agent: str | None = None):
        self.timeout = timeout
        self.session = requests.Session()
        self.user_agent = user_agent or (
            "Mozilla/5.0 (compatible; Polymythcal/2.0; "
            "+https://seminarschools.com/polymythseminars/)"
        )

    def clone(self):
        return RequestsFetcher(timeout=self.timeout, user_agent=self.user_agent)

    def fetch(self, url: str, *, headers: dict | None = None) -> FetchOutcome:
        request_headers = {
            "User-Agent": self.user_agent,
            "Accept": (
                "text/html,application/xhtml+xml,application/ld+json,"
                "application/json,text/calendar,application/rss+xml,"
                "application/atom+xml,application/xml;q=0.9,*/*;q=0.7"
            ),
            "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.7",
        }
        request_headers.update(headers or {})
        try:
            response = self.session.get(
                url,
                headers=request_headers,
                timeout=self.timeout,
                allow_redirects=True,
            )
        except requests.exceptions.SSLError as exc:
            return FetchOutcome(
                url=url,
                status="fetch-error",
                error=str(exc),
                failure_kind="tls-error",
            )
        except requests.exceptions.Timeout as exc:
            return FetchOutcome(
                url=url,
                status="fetch-error",
                error=str(exc),
                failure_kind="timeout",
            )
        except requests.exceptions.TooManyRedirects as exc:
            return FetchOutcome(
                url=url,
                status="fetch-error",
                error=str(exc),
                failure_kind="redirect-loop",
            )
        except requests.exceptions.ConnectionError as exc:
            message = str(exc)
            kind = (
                "dns-resolution"
                if re.search(
                    r"name or service not known|name resolution|"
                    r"temporary failure in name resolution|getaddrinfo failed|"
                    r"nodename nor servname",
                    message,
                    re.I,
                )
                else "connection-error"
            )
            return FetchOutcome(
                url=url,
                status="fetch-error",
                error=message,
                failure_kind=kind,
            )
        except requests.RequestException as exc:
            return FetchOutcome(
                url=url,
                status="fetch-error",
                error=str(exc),
                failure_kind="request-error",
            )
        common = {
            "url": url,
            "http_status": response.status_code,
            "content_type": response.headers.get("content-type", "").split(";")[0].lower(),
            "etag": response.headers.get("etag", ""),
            "last_modified": response.headers.get("last-modified", ""),
            "final_url": response.url,
        }
        if response.status_code == 304:
            return FetchOutcome(status="not-modified", **common)
        if response.status_code in {401, 403, 407, 429, 451, 503}:
            failure_kind = {
                401: "http-authentication",
                403: "http-forbidden",
                407: "http-proxy-authentication",
                429: "http-rate-limited",
                451: "http-legal-restriction",
                503: "http-service-unavailable",
            }[response.status_code]
            return FetchOutcome(
                status="blocked",
                error=f"HTTP {response.status_code}",
                failure_kind=failure_kind,
                **common,
            )
        if response.status_code < 200 or response.status_code >= 400:
            if 400 <= response.status_code < 500:
                failure_kind = "http-client-error"
            elif 500 <= response.status_code < 600:
                failure_kind = "http-server-error"
            else:
                failure_kind = "http-unexpected-status"
            return FetchOutcome(
                status="fetch-error",
                error=f"HTTP {response.status_code}",
                failure_kind=failure_kind,
                **common,
            )
        if looks_like_challenge_page(response.text):
            return FetchOutcome(
                status="blocked",
                body=response.text,
                error="challenge page detected",
                failure_kind="challenge-page",
                **common,
            )
        return FetchOutcome(status="success", body=response.text, **common)


@dataclass(frozen=True)
class DiscoveredURL:
    url: str
    kind: str
    depth: int


@dataclass
class CrawlResult:
    source_id: str
    status: str
    records: list[dict] = field(default_factory=list)
    fetches: list[FetchOutcome] = field(default_factory=list)
    discovered: list[DiscoveredURL] = field(default_factory=list)
    parse_errors: list[dict] = field(default_factory=list)

    @property
    def successful_fetches(self) -> int:
        return sum(x.status == "success" for x in self.fetches)

    def source_yield(self) -> dict:
        counts = {}
        failure_classes = {}
        for item in self.fetches:
            counts[item.status] = counts.get(item.status, 0) + 1
            if item.failure_kind:
                failure_classes[item.failure_kind] = (
                    failure_classes.get(item.failure_kind, 0) + 1
                )
        return {
            "source_id": self.source_id,
            "status": self.status,
            "events": len(self.records),
            "pages_fetched": len(self.fetches),
            "fetch_statuses": counts,
            "failure_classes": failure_classes,
            "http_statuses": [
                {
                    "url": item.url,
                    "status": item.http_status,
                    "result": item.status,
                    "failure_kind": item.failure_kind or None,
                    "error": item.error[:500] or None,
                    "empty_evidence": item.empty_evidence or None,
                    "cache_reused": item.cache_reused,
                    "retained_observation_at": item.retained_observation_at or None,
                    "harvest_method": item.harvest_method,
                }
                for item in self.fetches
            ],
            "parse_errors": self.parse_errors,
        }


def _origin(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _host(url: str) -> str:
    return (urllib.parse.urlsplit(url).hostname or "").lower()


def _same_site(a: str, b: str) -> bool:
    ah, bh = _host(a), _host(b)
    return bool(ah and bh and (ah == bh or ah.endswith("." + bh) or bh.endswith("." + ah)))


def _is_platform_url(url: str) -> bool:
    host = _host(url)
    return any(host == item or host.endswith("." + item) for item in PLATFORM_HOSTS)


def _clean_url(base_url: str, href: str) -> str:
    absolute = urllib.parse.urljoin(base_url, href.strip())
    parsed = urllib.parse.urlsplit(absolute)
    if parsed.scheme not in {"http", "https"}:
        return ""
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    query = [(k, v) for k, v in query if not k.lower().startswith(("utm_", "fbclid", "gclid"))]
    return urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path or "/", urllib.parse.urlencode(query), "")
    )


def _url_kind(url: str, anchor_text: str = "", rel: Iterable[str] = ()) -> str | None:
    low = f"{url} {anchor_text}".lower()
    rel_values = {str(value).lower() for value in rel}
    if "next" in rel_values or PAGINATION_RE.search(url):
        return "pagination"
    if any(token in low for token in (".ics", "ical", "text/calendar")):
        return "feed"
    if any(token in low for token in ("/feed", "rss", "atom")):
        return "feed"
    if "sitemap" in low:
        return "sitemap"
    if DETAIL_PATH_RE.search(urllib.parse.urlsplit(url).path) or _is_platform_url(url):
        return "detail"
    return None


def configured_seed_urls(source: dict) -> list[DiscoveredURL]:
    """Return configured feeds/APIs/sitemaps before HTML listing seeds."""
    events_url = str(source.get("events_url") or source.get("url") or "")
    seeds: list[DiscoveredURL] = []

    def values(*fields):
        for field_name in fields:
            value = source.get(field_name)
            if isinstance(value, str):
                yield value
            elif isinstance(value, list):
                yield from (str(item) for item in value)

    def add(raw: str, kind: str | None = None):
        if not raw:
            return
        url = _clean_url(events_url, raw)
        if not url:
            return
        resolved_kind = kind or _url_kind(url) or "seed"
        if "/wp-json/tribe/events/" in url:
            resolved_kind = "wordpress-tec"
        elif "/wp-json/wp/v2/" in url:
            resolved_kind = "wordpress-rest"
        item = DiscoveredURL(url, resolved_kind, 0)
        if item.url not in {prior.url for prior in seeds}:
            seeds.append(item)

    for url in values("feed_url", "feed_urls", "ical_url", "ical_urls", "ical_candidates"):
        add(url, "feed")
    for url in values("api_url", "api_urls"):
        add(url)
    for url in values("sitemap_url", "sitemap_urls"):
        add(url, "sitemap")
    add(events_url, "seed")
    for url in values("additional_urls"):
        add(url, "seed")
    return seeds


def bounded_javascript_fallbacks(source: dict, failed_url: str) -> list[DiscoveredURL]:
    """Small same-site fallback set for client-only listings.

    The budget remains bounded: one publisher/home route and one sitemap. A
    source-specific feed/API/SSR route in the registry still runs first.
    """
    if str(source.get("render_mode") or "").lower() != "javascript":
        return []
    candidates = []
    base = str(source.get("base_url") or "").strip()
    if base and base != failed_url:
        candidates.append(DiscoveredURL(_clean_url(failed_url, base), "seed", 0))
    origin = _origin(failed_url)
    candidates.append(DiscoveredURL(origin + "/sitemap.xml", "sitemap", 0))
    unique = {}
    for item in candidates:
        if item.url and _same_site(item.url, failed_url):
            unique.setdefault(item.url, item)
    return list(unique.values())[:2]


def discover_html_urls(
    html_text: str,
    page_url: str,
    source: dict,
    *,
    depth: int,
) -> list[DiscoveredURL]:
    """Discover feeds, sitemaps, pagination, detail pages, and public platforms."""
    soup = BeautifulSoup(html_text, "html.parser")
    found: dict[str, DiscoveredURL] = {}
    wordpress_api_roots: list[str] = []

    def add(href: str, kind: str | None, next_depth: int | None = None):
        url = _clean_url(page_url, href)
        if not url or not kind:
            return
        if not (_same_site(url, page_url) or _is_platform_url(url)):
            return
        candidate = DiscoveredURL(
            url,
            kind,
            depth + 1 if next_depth is None else next_depth,
        )
        existing = found.get(url)
        if existing is None or (
            kind == "priority-detail" and existing.kind == "detail"
        ):
            found[url] = candidate

    for link in soup.find_all("link", href=True):
        rel = link.get("rel") or []
        mime = str(link.get("type") or "").lower()
        href = str(link["href"])
        kind = "feed" if mime in FEED_TYPES else _url_kind(href, rel=rel)
        if any(str(x).lower() == "https://api.w.org/" for x in rel):
            api_root = _clean_url(page_url, href)
            if api_root:
                wordpress_api_roots.append(api_root)
                posts = urllib.parse.urljoin(api_root.rstrip("/") + "/", "wp/v2/posts")
                posts += (
                    "?per_page=20&orderby=modified&order=desc"
                    "&_fields=link,title,content,excerpt,date,modified"
                )
                add(posts, "wordpress-rest")
        else:
            add(href, kind)

    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        text = anchor.get_text(" ", strip=True)
        kind = _url_kind(href, text, anchor.get("rel") or [])
        scoped_civic_source = (
                source.get("default_type") == "protest"
                or str(source.get("platform_adapter") or "")
                in {"civic-action", "action-network", "campaign-page"}
        )
        explicit_event_signal = (
                PROTEST_SIGNAL_RE.search(text)
                or EVENT_NAVIGATION_SIGNAL_RE.search(text)
        )
        if scoped_civic_source and explicit_event_signal:
            # Organizer sites commonly publish advance action callouts below
            # ordinary /news/<slug>/ routes. The configured source boundary,
            # same-site restriction, crawl depth, and page budget remain in
            # force. Signal-bearing links run before generic news links so a
            # fixed page budget cannot crowd out the advance announcement.
            kind = "priority-detail"
        add(href, kind)

    source_adapter = str(source.get("platform_adapter") or "")
    html_low = html_text.lower()
    if (
        source_adapter == "wordpress-tec"
        or "tribe-events" in html_low
        or "the events calendar" in html_low
    ):
        roots = wordpress_api_roots or [_origin(page_url) + "/wp-json/"]
        for api_root in roots:
            endpoint = urllib.parse.urljoin(api_root.rstrip("/") + "/", "tribe/events/v1/events")
            endpoint += "?per_page=50&page=1"
            add(endpoint, "wordpress-tec")

    kind_priority = {
        "feed": 0,
        "wordpress-rest": 0,
        "wordpress-tec": 0,
        "priority-detail": 1,
    }
    return sorted(
        found.values(),
        key=lambda item: kind_priority.get(item.kind, 2),
    )


def _xml_local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def discover_xml_urls(
    xml_text: str,
    page_url: str,
    source: dict,
    *,
    depth: int,
) -> list[DiscoveredURL]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    root_kind = _xml_local(root.tag)
    found: list[DiscoveredURL] = []
    if root_kind in {"urlset", "sitemapindex"}:
        for node in root.iter():
            if _xml_local(node.tag) != "loc" or not (node.text or "").strip():
                continue
            url = _clean_url(page_url, node.text or "")
            if not url or not _same_site(url, page_url):
                continue
            path = urllib.parse.urlsplit(url).path
            if root_kind == "sitemapindex":
                kind = "sitemap"
            elif DETAIL_PATH_RE.search(path):
                kind = "detail"
            else:
                continue
            found.append(DiscoveredURL(url, kind, depth + 1))
    elif root_kind in {"rss", "feed", "rdf"}:
        for node in root.iter():
            if _xml_local(node.tag) not in {"item", "entry"}:
                continue
            link = _feed_entry_link(node)
            url = _clean_url(page_url, link)
            if url and (_same_site(url, page_url) or _is_platform_url(url)):
                found.append(DiscoveredURL(url, "detail", depth + 1))
    return found


def _feed_entry_link(entry) -> str:
    """Prefer an entry's canonical/alternate URL over comments or enclosures."""
    candidates = []
    for index, child in enumerate(entry.iter()):
        if _xml_local(child.tag) != "link":
            continue
        value = str(child.get("href") or (child.text or "")).strip()
        if not value:
            continue
        rel = str(child.get("rel") or "").lower()
        mime = str(child.get("type") or "").lower()
        score = 0
        if rel in {"", "alternate"}:
            score += 8
        if rel in {"self", "enclosure", "replies"}:
            score -= 8
        if "html" in mime:
            score += 3
        if re.search(r"(?:comments?|feed|attachment)", value, re.I):
            score -= 5
        candidates.append((score, -index, value))
    if not candidates:
        return ""
    return max(candidates, key=lambda row: (row[0], row[1]))[2]


def _unfold_ical(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def _ical_unescape(value: str) -> str:
    return (
        value.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )


def _ical_values(event: dict, key: str) -> list[tuple[dict, str]]:
    values = event.get("__all__", {}).get(key, [])
    if values:
        return values
    value = event.get(key)
    return [value] if isinstance(value, tuple) else []


def _ical_first(event: dict, key: str) -> tuple[dict, str]:
    values = _ical_values(event, key)
    return values[0] if values else ({}, "")


def _ical_organizer(event: dict) -> str:
    """Prefer the human-readable iCalendar CN parameter over a mailto URI."""
    params, value = _ical_first(event, "ORGANIZER")
    common_name = _ical_unescape(str(params.get("CN") or "")).strip().strip('"')
    if common_name:
        return common_name
    clean = _ical_unescape(value).strip()
    return re.sub(r"^mailto:", "", clean, flags=re.I)


def parse_ical_datetime(value: str, params: dict, source: dict) -> tuple[datetime | None, bool]:
    raw = value.strip()
    tz = source_timezone(source)
    tzid = str(params.get("TZID") or "").strip('"')
    if tzid:
        try:
            tz = ZoneInfo(tzid)
        except ZoneInfoNotFoundError:
            pass
    date_only = params.get("VALUE") == "DATE" or "T" not in raw
    try:
        if date_only:
            return datetime.strptime(raw[:8], "%Y%m%d").replace(tzinfo=tz), False
        if raw.endswith("Z"):
            return datetime.strptime(raw, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc), True
        fmt = "%Y%m%dT%H%M%S" if len(raw) >= 15 else "%Y%m%dT%H%M"
        return datetime.strptime(raw, fmt).replace(tzinfo=tz), True
    except ValueError:
        return None, False


MAX_RRULE_OCCURRENCES = 26
MAX_RRULE_HORIZON_DAYS = 366


def _ical_recurrence_dates(
    event: dict,
    *,
    start: datetime,
    source: dict,
) -> list[datetime]:
    """Expand a recurrence inside a hard time and occurrence budget."""
    recurrence_params, recurrence_raw = _ical_first(event, "RECURRENCE-ID")
    recurrence_value, _ = (
        parse_ical_datetime(recurrence_raw, recurrence_params, source)
        if recurrence_raw
        else (None, False)
    )
    if recurrence_value:
        return [start]

    _, rule_raw = _ical_first(event, "RRULE")
    if not rule_raw:
        return [start]

    timezone_value = source_timezone(source)
    reference_raw = str(source.get("recurrence_reference_date") or "").strip()
    try:
        reference = (
            datetime.fromisoformat(reference_raw.replace("Z", "+00:00"))
            if reference_raw
            else datetime.now(timezone_value)
        )
    except ValueError:
        reference = datetime.now(timezone_value)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone_value)
    else:
        reference = reference.astimezone(timezone_value)
    window_start = reference.replace(hour=0, minute=0, second=0, microsecond=0)
    requested_horizon = int(source.get("recurrence_horizon_days") or MAX_RRULE_HORIZON_DAYS)
    horizon_days = max(1, min(MAX_RRULE_HORIZON_DAYS, requested_horizon))
    window_end = window_start + timedelta(days=horizon_days)
    requested_cap = int(source.get("recurrence_occurrence_cap") or MAX_RRULE_OCCURRENCES)
    cap = max(1, min(MAX_RRULE_OCCURRENCES, requested_cap))

    try:
        rule = rrulestr(rule_raw.strip(), dtstart=start)
        values = list(rule.between(window_start, window_end, inc=True))
    except (TypeError, ValueError, OverflowError):
        values = [start]

    for params, raw_values in _ical_values(event, "RDATE"):
        for raw in raw_values.split(","):
            value, _ = parse_ical_datetime(raw, params, source)
            if value and window_start <= value <= window_end:
                values.append(value)

    excluded = set()
    for params, raw_values in _ical_values(event, "EXDATE"):
        for raw in raw_values.split(","):
            value, _ = parse_ical_datetime(raw, params, source)
            if value:
                excluded.add(value.astimezone(timezone.utc).isoformat())

    unique = {}
    for value in values:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone_value)
        marker = value.astimezone(timezone.utc).isoformat()
        if marker not in excluded:
            unique[marker] = value
    ordered = [unique[key] for key in sorted(unique)]
    # Retain the legacy single master record when a recurrence has no current
    # occurrence. Downstream date qualification can discard it without making
    # an otherwise healthy feed look like a parser failure.
    return ordered[:cap] or [start]


def _mixed_calendar_filter(records: list[dict], source: dict) -> list[dict]:
    """Apply an explicit allowlist to a calendar containing unrelated events."""
    if not source.get("mixed_calendar"):
        return records
    includes = [
        str(value) for value in source.get("include_event_patterns") or [] if str(value)
    ]
    excludes = [
        str(value) for value in source.get("exclude_event_patterns") or [] if str(value)
    ]
    if not includes:
        raise ValueError(
            f"mixed calendar {source.get('id') or ''} has no include_event_patterns"
        )
    try:
        include_patterns = [re.compile(value, re.I) for value in includes]
        exclude_patterns = [re.compile(value, re.I) for value in excludes]
    except re.error as exc:
        raise ValueError(f"mixed calendar has an invalid event pattern: {exc}") from exc
    allowed_types = {
        str(value).strip().lower()
        for value in source.get("allowed_event_types") or []
        if str(value).strip()
    }
    result = []
    for record in records:
        text = " ".join(
            str(record.get(key) or "")
            for key in (
                "title",
                "description",
                "raw_excerpt",
                "organizer",
                "venue",
                "type",
                "record_kind",
            )
        )
        if not any(pattern.search(text) for pattern in include_patterns):
            continue
        if any(pattern.search(text) for pattern in exclude_patterns):
            continue
        if allowed_types and str(record.get("type") or "").lower() not in allowed_types:
            continue
        result.append(record)
    return result


def _base_record(
    source: dict,
    *,
    title: str,
    start: datetime,
    has_time: bool,
    url: str,
    venue: str,
    description: str,
    organizer: str = "",
    end: datetime | None = None,
    lifecycle: str | None = None,
    external_uid: str = "",
    recurrence_id: str = "",
) -> dict:
    adapter = str(source.get("platform_adapter") or infer_adapter(source) or "municipal")
    text = " ".join((title, description, venue))
    event_type = classify_adapter_event_type(adapter, text, source)
    source_url = url or str(source.get("events_url") or source.get("url") or "")
    confidence = 90 if has_time and venue else 74 if (has_time or venue) else 58
    lifecycle_status = lifecycle or lifecycle_from_text(text)
    explicit_organizer = organizer or (
        str(source.get("name") or "") if source.get("source_is_organizer") else ""
    )
    if lifecycle_status in {"cancelled", "postponed", "rescheduled"}:
        confidence = max(confidence, 80)
    result = {
        "id": stable_id(source_url, start.isoformat(timespec="minutes"), title),
        "date": start.isoformat(timespec="minutes"),
        "end_date": end.isoformat(timespec="minutes") if end else None,
        "title": re.sub(r"\s+", " ", title).strip()[:240],
        "venue": re.sub(r"\s+", " ", venue).strip()[:240],
        "source_url": source_url,
        "source_id": source.get("id"),
        "type": event_type,
        "secondary_types": ["community"] if event_type == "protest" else [],
        "organizer": explicit_organizer,
        "publisher": source.get("name"),
        "speaker_or_director": explicit_organizer or None,
        "raw_excerpt": re.sub(r"\s+", " ", description or title).strip()[:700],
        "source_language": source.get("language") or "en",
        "platform_adapter": adapter,
        "city": source.get("city") or source.get("region") or "",
        "corridor_zone": source.get("corridor_zone") or "",
        "timezone": source.get("timezone") or "America/Toronto",
        "record_kind": "civic-action" if event_type == "protest" else "event",
        "date_precision": "exact" if has_time else "date",
        "time_precision": "exact" if has_time else "unknown",
        "lifecycle_status": lifecycle_status,
        "confidence": confidence,
        "attendance_confirmed": (
            creator_attendance_confirmed(text)
            if event_type == "screening"
            else bool(explicit_organizer)
        ),
        "attendance_evidence": (
            "explicit creator/principal attendance language"
            if event_type == "screening" and creator_attendance_confirmed(text)
            else ""
        ),
        "external_uid": external_uid or None,
        "recurrence_id": recurrence_id or None,
        "review_status": "auto-published" if confidence >= 70 else "queued",
        "scraped_at": iso_now(),
    }
    result["identity_aliases"] = event_identity_aliases(result)
    result["occurrence_key"] = event_occurrence_key(result)
    result["identity_key"] = result["occurrence_key"]
    return result


def parse_ical(text: str, source_config: dict) -> list[dict]:
    source = normalise_source_config(source_config)
    records: list[dict] = []
    event: dict | None = None
    for line in _unfold_ical(text):
        if line == "BEGIN:VEVENT":
            event = {}
            continue
        if line == "END:VEVENT":
            if not event:
                event = None
                continue
            summary = _ical_unescape(_ical_first(event, "SUMMARY")[1])
            start_params, start_raw = _ical_first(event, "DTSTART")
            start, has_time = parse_ical_datetime(start_raw, start_params, source)
            if summary and start:
                end_params, end_raw = _ical_first(event, "DTEND")
                end, _ = parse_ical_datetime(end_raw, end_params, source) if end_raw else (None, False)
                duration = end - start if end and end >= start else None
                status = _ical_first(event, "STATUS")[1].upper()
                lifecycle = {
                    "CANCELLED": "cancelled",
                    "TENTATIVE": "active",
                }.get(status)
                recurrence_params, recurrence_raw = _ical_first(
                    event, "RECURRENCE-ID"
                )
                recurrence_value, _ = (
                    parse_ical_datetime(recurrence_raw, recurrence_params, source)
                    if recurrence_raw
                    else (None, False)
                )
                occurrences = _ical_recurrence_dates(
                    event,
                    start=start,
                    source=source,
                )
                for occurrence in occurrences:
                    recurrence_id = (
                        recurrence_value or occurrence
                        if _ical_first(event, "RRULE")[1] or recurrence_value
                        else None
                    )
                    records.append(
                        _base_record(
                            source,
                            title=summary,
                            start=occurrence,
                            has_time=has_time,
                            url=_ical_unescape(_ical_first(event, "URL")[1]),
                            venue=_ical_unescape(_ical_first(event, "LOCATION")[1]),
                            description=_ical_unescape(
                                _ical_first(event, "DESCRIPTION")[1]
                            ),
                            organizer=_ical_organizer(event),
                            end=occurrence + duration if duration else None,
                            lifecycle=lifecycle,
                            external_uid=_ical_unescape(
                                _ical_first(event, "UID")[1]
                            ),
                            recurrence_id=(
                                recurrence_id.isoformat(timespec="minutes")
                                if recurrence_id
                                else ""
                            ),
                        )
                    )
            event = None
            continue
        if event is None or ":" not in line:
            continue
        key_part, value = line.split(":", 1)
        pieces = key_part.split(";")
        key = pieces[0].upper()
        params = {}
        for piece in pieces[1:]:
            if "=" in piece:
                name, param_value = piece.split("=", 1)
                params[name.upper()] = param_value
        event.setdefault("__all__", {}).setdefault(key, []).append((params, value))
        event.setdefault(key, (params, value))
    return records


def parse_wordpress_tec_json(text: str, source_config: dict) -> tuple[list[dict], list[DiscoveredURL]]:
    source = normalise_source_config(source_config)
    payload = json.loads(text)
    events = payload.get("events", []) if isinstance(payload, dict) else []
    records: list[dict] = []
    for item in events:
        if not isinstance(item, dict):
            continue
        title_value = item.get("title")
        title = title_value.get("rendered") if isinstance(title_value, dict) else title_value
        start_raw = item.get("start_date") or item.get("start_date_details") or item.get("startDate")
        if isinstance(start_raw, dict):
            start_raw = "-".join(
                str(start_raw.get(part, "")).zfill(2 if part != "year" else 4)
                for part in ("year", "month", "day")
            )
            start_raw += f" {item.get('start_date_details', {}).get('hour', '00')}:{item.get('start_date_details', {}).get('minutes', '00')}"
        start, has_time = parse_datetime_text(
            str(start_raw or ""),
            timezone_name=str(source.get("timezone") or "America/Toronto"),
        )
        if not title or not start:
            continue
        venue_value = item.get("venue")
        if isinstance(venue_value, dict):
            venue = ", ".join(
                str(venue_value.get(key) or "")
                for key in ("venue", "address", "city", "province")
                if venue_value.get(key)
            )
        else:
            venue = str(venue_value or "")
        organizer_value = item.get("organizer")
        if isinstance(organizer_value, list):
            organizer = ", ".join(
                str(x.get("organizer") or x.get("name") or "") for x in organizer_value if isinstance(x, dict)
            )
        elif isinstance(organizer_value, dict):
            organizer = str(organizer_value.get("organizer") or organizer_value.get("name") or "")
        else:
            organizer = str(organizer_value or "")
        description = BeautifulSoup(str(item.get("description") or ""), "html.parser").get_text(" ", strip=True)
        records.append(
            _base_record(
                source,
                title=str(title),
                start=start,
                has_time=has_time,
                url=str(item.get("url") or item.get("website") or source.get("events_url") or ""),
                venue=venue,
                description=description,
                organizer=organizer,
            )
        )
    discovered: list[DiscoveredURL] = []
    next_url = payload.get("next_rest_url") if isinstance(payload, dict) else None
    if next_url:
        discovered.append(DiscoveredURL(str(next_url), "wordpress-tec", 1))
    elif isinstance(payload, dict) and int(payload.get("next_page") or 0):
        base = str(source.get("events_url") or "")
        endpoint = _origin(base) + "/wp-json/tribe/events/v1/events?per_page=50&page=" + str(payload["next_page"])
        discovered.append(DiscoveredURL(endpoint, "wordpress-tec", 1))
    return records, discovered


def parse_wordpress_posts_json(
    text: str,
    source_config: dict,
    page_url: str,
) -> tuple[list[dict], list[DiscoveredURL]]:
    """Parse recent public WordPress announcement posts and follow their links."""
    source = normalise_source_config(source_config)
    payload = json.loads(text)
    if not isinstance(payload, list):
        raise ValueError("WordPress posts response must be an array")
    records: list[dict] = []
    discovered: list[DiscoveredURL] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        link = _clean_url(page_url, str(item.get("link") or ""))
        title_value = item.get("title")
        title = title_value.get("rendered") if isinstance(title_value, dict) else title_value
        content_value = item.get("content")
        content = content_value.get("rendered") if isinstance(content_value, dict) else content_value
        excerpt_value = item.get("excerpt")
        excerpt = excerpt_value.get("rendered") if isinstance(excerpt_value, dict) else excerpt_value
        if link:
            discovered.append(DiscoveredURL(link, "detail", 1))
        if not title:
            continue
        synthetic = (
            '<article class="event-announcement">'
            f'<h2><a href="{html.escape(link or page_url, quote=True)}">'
            f'{html.escape(str(title))}</a></h2>'
            f'{content or ""}{excerpt or ""}'
            "</article>"
        )
        adapter = str(source.get("platform_adapter") or infer_adapter(source) or "municipal")
        item_source = dict(source)
        publication = _publication_datetime(
            str(item.get("date") or item.get("modified") or "")
        )
        if publication:
            item_source["_announcement_reference"] = publication.isoformat()
        records.extend(parse_html(synthetic, item_source, adapter))
    return _dedupe_records(records), discovered


def parse_campaign_locations(html_text: str, page_url: str, source_config: dict) -> list[dict]:
    """Parse multi-location action pages into one event per dated location row."""
    source = normalise_source_config(source_config)
    soup = BeautifulSoup(html_text, "html.parser")
    candidates = soup.select(
        ".location-card,.event-location-card,[data-event-location],table tbody tr"
    )
    records: list[dict] = []
    page_heading = soup.find(["h1", "h2"])
    page_title = page_heading.get_text(" ", strip=True) if page_heading else ""
    for node in candidates:
        text = node.get_text(" ", strip=True)
        if len(text) < 12:
            continue
        start, has_time = parse_datetime_text(
            text,
            timezone_name=str(source.get("timezone") or "America/Toronto"),
        )
        if not start:
            continue
        city_node = node.select_one(".city,.location-city,[data-city]")
        city = (
            city_node.get_text(" ", strip=True)
            if city_node
            else str(node.get("data-city") or "")
        )
        configured_city = str(source.get("city") or "")
        if configured_city:
            city_haystack = city or text
            if configured_city.lower() not in city_haystack.lower():
                continue
        title_node = node.select_one("h2,h3,h4,.title,.event-title")
        title = title_node.get_text(" ", strip=True) if title_node else page_title
        venue_node = node.select_one(".venue,.address,.location,[data-address]")
        venue = (
            venue_node.get_text(" ", strip=True)
            if venue_node
            else str(node.get("data-address") or "")
        )
        link = (
            (title_node.find("a", href=True) if title_node else None)
            or node.select_one(
                "a[href*='/event/'],a[href*='/events/'],a[href*='/action/'],"
                "a[href*='/campaign/']"
            )
            or node.find("a", href=True)
        )
        url = _clean_url(page_url, link["href"]) if link else page_url
        records.append(
            _base_record(
                source,
                title=title,
                start=start,
                has_time=has_time,
                url=url,
                venue=venue,
                description=text,
            )
        )
    return records


def _publication_datetime(value: str) -> datetime | None:
    """Parse an announcement timestamp used only to anchor yearless event dates."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(str(value))
        except (TypeError, ValueError, OverflowError):
            return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def parse_feed_links_and_inline_events(
    text: str,
    page_url: str,
    source_config: dict,
) -> tuple[list[dict], list[DiscoveredURL]]:
    source = normalise_source_config(source_config)
    discovered = discover_xml_urls(text, page_url, source, depth=0)
    records: list[dict] = []
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return records, discovered
    if _xml_local(root.tag) not in {"rss", "feed", "rdf"}:
        return records, discovered
    for entry in root.iter():
        if _xml_local(entry.tag) not in {"item", "entry"}:
            continue
        values: dict[str, str] = {}
        for child in entry.iter():
            name = _xml_local(child.tag)
            if name in {
                "title",
                "description",
                "summary",
                "content",
                "pubdate",
                "start",
                "startdate",
                "dtstart",
                "eventdate",
                "location",
                "venue",
                "organizer",
            }:
                values.setdefault(name, child.get("href") or (child.text or ""))
        values["link"] = _feed_entry_link(entry)
        body = " ".join(
            BeautifulSoup(values.get(key, ""), "html.parser").get_text(" ", strip=True)
            for key in ("title", "description", "summary", "content")
        )
        # Publication dates describe the announcement, so only an event date
        # embedded in the announcement copy qualifies for event extraction.
        structured_date = next(
            (
                values.get(key, "")
                for key in ("start", "startdate", "dtstart", "eventdate")
                if values.get(key)
            ),
            "",
        )
        selected_date_text = select_event_datetime_text(body, structured_date)
        publication = _publication_datetime(values.get("pubdate", ""))
        start, has_time = parse_datetime_text(
            selected_date_text,
            default_year=publication.year if publication else None,
            reference_date=publication,
            timezone_name=str(source.get("timezone") or "America/Toronto"),
        )
        if not start or not values.get("title"):
            continue
        url = _clean_url(page_url, values.get("link") or page_url)
        records.append(
            _base_record(
                source,
                title=values["title"],
                start=start,
                has_time=has_time,
                url=url,
                venue=values.get("location") or values.get("venue") or "",
                description=body,
                organizer=values.get("organizer") or "",
            )
        )
    return records, discovered


def _looks_eventful(text: str, source: dict) -> bool:
    low = text.lower()
    return (
        "schema.org/event" in low
        or "tribe-events" in low
        or "begin:vevent" in low
        or bool(PROTEST_SIGNAL_RE.search(text))
        or str(source.get("default_type") or "") in low
    )


def authoritative_empty_evidence(outcome: FetchOutcome, kind: str) -> str:
    """Require affirmative evidence before a zero-record page is authoritative."""
    text = outcome.body or ""
    if EXPLICIT_EMPTY_RE.search(visible_text(text)):
        return "explicit-empty-message"
    if "BEGIN:VCALENDAR" in text.upper() and "BEGIN:VEVENT" not in text.upper():
        return "empty-ical-feed"
    stripped = text.lstrip()
    if outcome.content_type in {"application/json", "application/ld+json"} or kind in {
        "wordpress-rest",
        "wordpress-tec",
    }:
        try:
            payload = json.loads(text)
        except (TypeError, json.JSONDecodeError):
            payload = None
        if payload == []:
            return "empty-json-feed"
        if isinstance(payload, dict) and payload.get("events") == []:
            return "empty-json-event-list"
    if stripped.startswith("<"):
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            root = None
        if root is not None and _xml_local(root.tag) in {"rss", "feed", "rdf"}:
            if not any(_xml_local(node.tag) in {"item", "entry"} for node in root.iter()):
                return "empty-rss-atom-feed"
    return ""


def parse_fetched_document(
    outcome: FetchOutcome,
    source_config: dict,
    *,
    kind: str,
    depth: int,
) -> tuple[list[dict], list[DiscoveredURL]]:
    source = normalise_source_config(source_config)
    text = outcome.body
    ctype = outcome.content_type
    final_url = outcome.final_url or outcome.url
    stripped = text.lstrip()
    if "BEGIN:VCALENDAR" in text or ctype in {"text/calendar", "application/ics"}:
        return parse_ical(text, source), []
    if kind == "wordpress-rest":
        records, found = parse_wordpress_posts_json(text, source, final_url)
        return records, [
            DiscoveredURL(x.url, x.kind, depth + 1) for x in found
        ]
    if kind == "wordpress-tec":
        records, found = parse_wordpress_tec_json(text, source)
        return records, [
            DiscoveredURL(x.url, x.kind, depth + 1) for x in found
        ]
    if ctype in {"application/json", "application/ld+json"}:
        payload = json.loads(text)
        if isinstance(payload, list):
            records, found = parse_wordpress_posts_json(text, source, final_url)
        elif isinstance(payload, dict) and isinstance(payload.get("events"), list):
            records, found = parse_wordpress_tec_json(text, source)
        else:
            raise ValueError("unsupported event JSON shape")
        return records, [
            DiscoveredURL(x.url, x.kind, depth + 1) for x in found
        ]
    if stripped.startswith("<") and (
        ctype in {"application/rss+xml", "application/atom+xml", "application/xml", "text/xml"}
        or re.match(r"<(?:\?xml[^>]*>\s*)?(?:rss|feed|urlset|sitemapindex)", stripped, re.I)
    ):
        records, found = parse_feed_links_and_inline_events(text, final_url, source)
        if not found:
            found = discover_xml_urls(text, final_url, source, depth=depth)
        return records, found
    adapter = str(source.get("platform_adapter") or infer_adapter(source) or "municipal")
    document_source = dict(source)
    document_source["_document_url"] = final_url
    records = parse_html(text, document_source, adapter)
    if adapter in {"campaign-page", "civic-action"} or source.get("default_type") == "protest":
        records.extend(parse_campaign_locations(text, final_url, document_source))
    return _dedupe_records(records), discover_html_urls(
        text,
        final_url,
        source,
        depth=depth,
    )


def _record_score(record: dict) -> float:
    return (
        int(record.get("time_precision") == "exact") * 4
        + int(bool(record.get("venue"))) * 3
        + int(bool(record.get("organizer"))) * 2
        + min(len(str(record.get("raw_excerpt") or "")), 700) / 700
        + int(record.get("confidence") or 0) / 100
    )


def _merge_records(left: dict, right: dict) -> dict:
    richer, other = (left, right) if _record_score(left) >= _record_score(right) else (right, left)
    merged = dict(other)
    merged.update({key: value for key, value in richer.items() if value not in (None, "", [])})
    for field_name in ("secondary_types", "topics"):
        values = []
        for value in list(left.get(field_name) or []) + list(right.get(field_name) or []):
            if value and value not in values:
                values.append(value)
        if values:
            merged[field_name] = values
    return merged


def _dedupe_records(records: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for record in records:
        if not record.get("title") or not record.get("date"):
            continue
        record.setdefault("identity_aliases", event_identity_aliases(record))
        record.setdefault("occurrence_key", event_occurrence_key(record))
        if not record.get("identity_key") or record["identity_key"] in record["identity_aliases"]:
            record["identity_key"] = record["occurrence_key"]
        key = str(record["occurrence_key"])
        if key not in merged:
            compatible = next(
                (
                    prior_key
                    for prior_key, prior in merged.items()
                    if records_represent_same_occurrence(prior, record)
                ),
                None,
            )
            if compatible:
                key = compatible
        if key not in merged:
            merged[key] = record
            continue
        combined = _merge_records(merged[key], record)
        combined["identity_aliases"] = list(
            dict.fromkeys(
                event_identity_aliases(combined)
                + list(merged[key].get("identity_aliases") or event_identity_aliases(merged[key]))
                + list(record.get("identity_aliases") or event_identity_aliases(record))
            )
        )
        combined["occurrence_key"] = event_occurrence_key(combined)
        combined["identity_key"] = combined["occurrence_key"]
        del merged[key]
        merged[combined["occurrence_key"]] = combined
    return list(merged.values())


def _derive_status(fetches: list[FetchOutcome], records: list[dict], parse_errors: list[dict]) -> str:
    failures = bool(parse_errors) or any(
        item.status in {"fetch-error", "blocked", "parse-empty-regression"}
        for item in fetches
    )
    if failures and (records or any(item.status == "success" for item in fetches)):
        return "partial-failure"
    if records:
        return "success"
    if any(item.status == "success" and item.empty_evidence for item in fetches):
        return "confirmed-empty"
    if any(item.status == "success" for item in fetches):
        return "parse-empty-regression"
    if fetches and all(item.status == "not-modified" for item in fetches):
        return "not-modified"
    if any(item.status == "parse-empty-regression" for item in fetches):
        return "parse-empty-regression"
    if any(item.status == "blocked" for item in fetches):
        return "blocked"
    return "fetch-error"


def crawl_source(
    source_config: dict,
    *,
    fetcher: RequestsFetcher | None = None,
    seed_urls: list[str] | None = None,
    max_pages: int = 24,
    max_depth: int = 3,
    max_elapsed_seconds: float = 90,
    conditional_headers: dict[str, dict] | None = None,
    parsed_cache=None,
) -> CrawlResult:
    """Crawl one source through feeds, APIs, pagination, and detail pages."""
    source = normalise_source_config(source_config)
    source_id = str(source.get("id") or "")
    fetcher = fetcher or RequestsFetcher()
    queue: deque[DiscoveredURL] = deque()
    initial = configured_seed_urls(source)
    for url in seed_urls or []:
        clean = _clean_url(str(source.get("events_url") or ""), url)
        if clean and clean not in {item.url for item in initial}:
            initial.append(DiscoveredURL(clean, _url_kind(clean) or "detail", 0))
    queue.extend(initial)
    seen: set[str] = set()
    fetches: list[FetchOutcome] = []
    discovered: list[DiscoveredURL] = []
    records: list[dict] = []
    parse_errors: list[dict] = []
    started = time.monotonic()

    def enqueue_javascript_fallbacks(failed_url: str):
        for fallback in bounded_javascript_fallbacks(source, failed_url):
            if fallback.url not in seen and fallback.url not in {row.url for row in queue}:
                discovered.append(fallback)
                queue.append(fallback)

    while queue and len(fetches) < max_pages:
        if time.monotonic() - started >= max_elapsed_seconds:
            fetches.append(
                FetchOutcome(
                    url=queue[0].url,
                    status="fetch-error",
                    error="crawl-budget-exhausted",
                    failure_kind="crawl-budget-exhausted",
                )
            )
            break
        item = queue.popleft()
        if item.url in seen or item.depth > max_depth:
            continue
        seen.add(item.url)
        headers = dict((conditional_headers or {}).get(item.url, {}))
        if parsed_cache is not None:
            headers.update(parsed_cache.conditional_headers(item.url))
        outcome = fetcher.fetch(item.url, headers=headers)
        fetches.append(outcome)
        if outcome.status == "not-modified" and parsed_cache is not None:
            retained = parsed_cache.reuse(item.url, outcome)
            if retained is not None:
                outcome.status = "success"
                outcome.cache_reused = True
                outcome.retained_observation_at = retained["observed_at"]
                outcome.body_hash = retained["body_hash"]
                outcome.empty_evidence = retained["empty_evidence"]
                records.extend(retained["records"])
                cached_children = [
                    DiscoveredURL(
                        str(row.get("url") or ""),
                        str(row.get("kind") or "detail"),
                        int(row.get("depth") or item.depth + 1),
                    )
                    for row in retained["discovered_urls"]
                    if str(row.get("url") or "").startswith(("http://", "https://"))
                ]
                for child in cached_children:
                    if child.url in seen or child.depth > max_depth:
                        continue
                    discovered.append(child)
                    queue.append(child)
                continue
            # A validator without a retained parsed observation is never
            # authoritative. Retry once without validators.
            if headers:
                outcome = fetcher.fetch(item.url, headers={})
                fetches.append(outcome)
        if outcome.status != "success":
            continue
        if looks_like_challenge_page(outcome.body):
            outcome.status = "blocked"
            outcome.error = "challenge page detected"
            outcome.failure_kind = "challenge-page"
            continue
        empty_evidence = authoritative_empty_evidence(outcome, item.kind)
        empty_app_shell = looks_like_empty_app_shell(outcome.body)
        near_blank = len(visible_text(outcome.body)) < 40
        try:
            parsed, found = parse_fetched_document(
                outcome,
                source,
                kind=item.kind,
                depth=item.depth,
            )
            parsed = _mixed_calendar_filter(parsed, source)
            records.extend(parsed)
        except (ValueError, ET.ParseError, json.JSONDecodeError) as exc:
            parse_errors.append(
                {
                    "url": item.url,
                    "error": str(exc),
                    "failure_kind": "parser-exception",
                }
            )
            continue
        zero_result_handled = False
        if not parsed and empty_app_shell and not empty_evidence:
            outcome.status = "parse-empty-regression"
            outcome.error = "empty client-rendered application shell"
            outcome.failure_kind = "client-rendered-shell"
            parse_errors.append(
                {
                    "url": item.url,
                    "error": outcome.error,
                    "failure_kind": outcome.failure_kind,
                }
            )
            enqueue_javascript_fallbacks(item.url)
            zero_result_handled = True
        elif not parsed and near_blank and not empty_evidence:
            outcome.status = "parse-empty-regression"
            outcome.error = "blank or near-blank response without explicit empty evidence"
            outcome.failure_kind = "blank-response"
            parse_errors.append(
                {
                    "url": item.url,
                    "error": outcome.error,
                    "failure_kind": outcome.failure_kind,
                }
            )
            enqueue_javascript_fallbacks(item.url)
            zero_result_handled = True
        if not parsed and empty_evidence:
            outcome.empty_evidence = empty_evidence
        if parsed_cache is not None:
            parsed_cache.store(
                item.url,
                outcome,
                records=parsed,
                discovered_urls=found,
                empty_evidence=empty_evidence,
            )
        if (
            not parsed
            and str(source.get("render_mode") or "").lower() == "javascript"
            and not empty_evidence
            and not zero_result_handled
        ):
            message = "javascript source returned zero records; bounded fallbacks queued"
            parse_errors.append(
                {
                    "url": item.url,
                    "error": message,
                    "failure_kind": "javascript-zero-records",
                }
            )
            enqueue_javascript_fallbacks(item.url)
            zero_result_handled = True
        if (
            not parsed
            and not zero_result_handled
            and _looks_eventful(outcome.body, source)
        ):
            parse_errors.append(
                {
                    "url": item.url,
                    "error": "event signals found but parser returned zero records",
                    "failure_kind": "event-signals-unparsed",
                }
            )
        elif (
            not parsed
            and not zero_result_handled
            and not found
            and not empty_evidence
        ):
            parse_errors.append(
                {
                    "url": item.url,
                    "error": "zero records without authoritative empty evidence",
                    "failure_kind": "unproven-empty",
                }
            )
        for child in found:
            if child.url in seen or child.depth > max_depth:
                continue
            discovered.append(child)
            queue.append(child)
    records = _dedupe_records(records)
    status = _derive_status(fetches, records, parse_errors)
    if (
        str(source.get("render_mode") or "").lower() == "javascript"
        and status == "confirmed-empty"
    ):
        status = "parse-empty-regression"
        parse_errors.append(
            {
                "url": str(source.get("events_url") or ""),
                "error": "javascript source returned no deterministic event records",
                "failure_kind": "javascript-zero-records",
            }
        )
    return CrawlResult(
        source_id=source_id,
        status=status,
        records=records,
        fetches=fetches,
        discovered=discovered,
        parse_errors=parse_errors,
    )
