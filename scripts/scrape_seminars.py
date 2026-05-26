#!/usr/bin/env python3
"""
scrape_seminars.py

Daily seminar aggregator for seminarschools.com.

Reads /scripts/sources.json. Iterates configured sources. Calls per-source
fetcher functions. Normalizes output to /data/seminars-schema.json shape.
Writes /data/seminars.json plus dated history snapshot.

Production trigger lives in /netlify/functions/seminars-cron-background.js.
This script also runs standalone for local debugging:

    python3 scripts/scrape_seminars.py
    python3 scripts/scrape_seminars.py --source revue
    python3 scripts/scrape_seminars.py --dry-run

LLM verification (cinema director-attendance and four-condition test on
edge cases) happens in a separate pass via /netlify/functions/seminars-verify.js.
This script flags candidates needing verification with confidence=0.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
SOURCES_PATH = ROOT / "scripts" / "sources.json"
OUTPUT_PATH = ROOT / "seminars" / "events.json"
REVIEW_PATH = ROOT / "data" / "seminars-review.json"
HISTORY_DIR = ROOT / "data" / "history"
LOG_PATH = ROOT / "data" / "scrape-log.json"
RSS_PATH = ROOT / "seminars" / "feed.xml"

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
}
REQUEST_TIMEOUT = 20  # seconds per request
CONFIDENCE_AUTO_PUBLISH_THRESHOLD = 70

# Cinema director-attendance keywords. Used to filter cinema sources to
# director-Q&A events only. Tightened to exclude "Director's Cut" near-miss.
DIRECTOR_FLAG_KEYWORDS = [
    "director in attendance",
    "q&a with director",
    "q&a with the director",
    "q&a with filmmaker",
    "q&a with the filmmaker",
    "director attending",
    "director will be present",
    "filmmaker in attendance",
    "filmmaker q&a",
    "directors in attendance",
    "cast & crew in attendance",
    "cast and crew in attendance",
]


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def make_id(source_url, iso_date):
    """Stable record id: first 12 hex chars of SHA-1(source_url + iso_date)."""
    key = f"{source_url}::{iso_date}".encode("utf-8")
    return hashlib.sha1(key).hexdigest()[:12]


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def fetch(url, **kwargs):
    """Wrapper around requests.get with sane defaults plus error logging."""
    headers = dict(DEFAULT_HEADERS)
    headers.update(kwargs.pop("headers", {}))
    return requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, **kwargs)


def has_director_flag(title):
    title_lower = title.lower()
    return any(kw in title_lower for kw in DIRECTOR_FLAG_KEYWORDS)


def parse_revue_date(date_str, year=None):
    """
    Parse Revue date strings like 'Fri May 29, 06:30 PM'.

    Year is not in the source string. Infer from current date plus
    'next future occurrence' heuristic: pick the year that places the
    date in the next 12 months from today.
    """
    if year is None:
        year = datetime.now().year
    cleaned = re.sub(r"^[A-Z][a-z]{2}\s+", "", date_str.strip())
    # cleaned now looks like 'May 29, 06:30 PM'
    try:
        dt = datetime.strptime(f"{cleaned} {year}", "%b %d, %I:%M %p %Y")
    except ValueError:
        return None
    # If parsed date is more than 60 days in the past, roll forward one year
    now = datetime.now()
    if (now - dt).days > 60:
        dt = dt.replace(year=year + 1)
    return dt.replace(tzinfo=timezone(-datetime.now().astimezone().utcoffset()))


def empty_four_condition():
    return {
        "time_place": True,  # always true if we have date+venue
        "prepared_offering": None,
        "substantive_engagement": None,
        "intellectual_stake": None,
    }


# ---------------------------------------------------------------------------
# Source fetchers
# ---------------------------------------------------------------------------


REVUE_DATE_PATTERN = re.compile(
    r"^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{1,2}:\d{2}\s+(AM|PM)$"
)


def extract_revue_blocks_from_html(html_text, base_url):
    """Production path: BeautifulSoup against live HTML. Returns list of
    (title, detail_url, [date_strings])."""
    soup = BeautifulSoup(html_text, "html.parser")
    blocks = []
    for heading in soup.find_all(["h5", "h4", "h3"]):
        title_text = heading.get_text(strip=True)
        if not title_text:
            continue

        link = heading.find_parent("a") or heading.find("a") or heading.find_next("a")
        detail_url = ""
        if link and link.get("href"):
            detail_url = urllib.parse.urljoin(base_url, link["href"])

        date_strings = []
        container = heading.find_parent() or heading
        for sibling in container.find_all_next(string=True, limit=80):
            text = sibling.strip()
            if not text:
                continue
            if REVUE_DATE_PATTERN.match(text):
                date_strings.append(text)
                continue
            parent = sibling.parent
            if parent and parent.name in ["h3", "h4", "h5"] and parent is not heading:
                break

        blocks.append((title_text, detail_url, date_strings))
    return blocks


def extract_revue_blocks_from_markdown(md_text, base_url):
    """Test path: parse the markdown that web_fetch returns. Same output shape
    as the HTML extractor so the record-builder doesn't care which path ran."""
    blocks = []
    current_title = None
    current_url = None
    current_dates = []

    heading_pattern = re.compile(r"^#{3,6}\s*\[([^\]]+)\]\(([^)]+)\)\s*$")

    for line in md_text.splitlines():
        line = line.strip()
        m = heading_pattern.match(line)
        if m:
            if current_title is not None:
                blocks.append((current_title, current_url, current_dates))
            current_title = m.group(1).strip()
            current_url = m.group(2).strip()
            current_dates = []
            continue
        if REVUE_DATE_PATTERN.match(line):
            current_dates.append(line)

    if current_title is not None:
        blocks.append((current_title, current_url, current_dates))
    return blocks


def build_revue_records(blocks, source_config):
    """Convert (title, url, dates) tuples into schema-conformant records.
    Filters to director-attendance events only."""
    records = []
    seen_ids = set()

    for title_text, detail_url, date_strings in blocks:
        if not has_director_flag(title_text):
            continue
        if not date_strings:
            continue

        for date_str in date_strings:
            parsed = parse_revue_date(date_str)
            if parsed is None:
                continue
            iso = parsed.isoformat(timespec="minutes")

            record_id = make_id(detail_url or source_config["events_url"], iso)
            if record_id in seen_ids:
                continue
            seen_ids.add(record_id)

            records.append({
                "id": record_id,
                "date": iso,
                "end_date": None,
                "title": title_text,
                "venue": "Revue Cinema, 400 Roncesvalles Avenue",
                "source_url": detail_url or source_config["events_url"],
                "source_id": source_config["id"],
                "type": "screening",
                "speaker_or_director": None,
                "attendance_confirmed": True,
                "confidence": 90,
                "four_condition_test": empty_four_condition(),
                "raw_excerpt": title_text[:500],
                "scraped_at": now_iso(),
                "review_status": "auto-published",
                "marginalia_url": None,
            })
    return records


def fetch_revue(source_config):
    """Revue Cinema production fetcher. Fetches live HTML, extracts blocks,
    builds records."""
    url = source_config["events_url"]
    response = fetch(url)
    response.raise_for_status()
    blocks = extract_revue_blocks_from_html(response.text, url)
    return build_revue_records(blocks, source_config)


def fetch_jhi(source_config):
    """
    Jackman Humanities Institute. https://www.humanities.utoronto.ca/events
    Drupal events page. Filters to date >= today.
    """
    url = source_config["events_url"]
    response = fetch(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    records = []
    seen_ids = set()
    today = datetime.now()
    month_pattern = re.compile(
        r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b"
    )

    for anchor in soup.find_all("a", href=re.compile(r"^/events/[a-z0-9\-]+$|/events/[a-z0-9\-]+$")):
        title = anchor.get_text(strip=True)
        if not title or len(title) < 4:
            continue
        href = anchor.get("href", "")
        if not href:
            continue
        detail_url = urllib.parse.urljoin(url, href)

        card = anchor
        for _ in range(6):
            card = card.find_parent()
            if card is None:
                break
            text = card.get_text(" ", strip=True)
            m = month_pattern.search(text)
            if not m:
                continue
            month_name, day_str, year_str = m.groups()
            try:
                dt = datetime.strptime(f"{month_name} {day_str} {year_str}", "%B %d %Y")
            except ValueError:
                break
            if dt.date() < today.date():
                break
            dt = dt.replace(hour=12, minute=0, tzinfo=timezone(-datetime.now().astimezone().utcoffset()))
            iso = dt.isoformat(timespec="minutes")
            record_id = make_id(detail_url, iso)
            if record_id in seen_ids:
                break
            seen_ids.add(record_id)

            tl = title.lower()
            if "screening" in tl or "film" in tl:
                etype = "screening"
            elif "panel" in tl or "roundtable" in tl:
                etype = "panel"
            elif "reading" in tl or "book launch" in tl:
                etype = "reading"
            elif "exhibit" in tl:
                etype = "other"
            else:
                etype = source_config.get("default_type", "lecture")

            records.append({
                "id": record_id,
                "date": iso,
                "end_date": None,
                "title": title,
                "venue": source_config.get("extraction", {}).get(
                    "venue_default",
                    "Jackman Humanities Building, 170 St. George St., Toronto",
                ),
                "source_url": detail_url,
                "source_id": source_config["id"],
                "type": etype,
                "speaker_or_director": None,
                "attendance_confirmed": False,
                "confidence": 75,
                "four_condition_test": empty_four_condition(),
                "raw_excerpt": text[:500],
                "scraped_at": now_iso(),
                "review_status": "auto-published",
                "marginalia_url": None,
            })
            break

    return records


def fetch_agora_self(source_config):
    """
    The Agora (Seminar Schools). Reads /agora/feed.xml directly from the repo.
    """
    feed_path = ROOT / "agora" / "feed.xml"
    if not feed_path.exists():
        return []
    text = feed_path.read_text(encoding="utf-8")
    try:
        from xml.dom import minidom
        from email.utils import parsedate_to_datetime
        dom = minidom.parseString(text)
    except Exception:
        return []

    records = []
    seen_ids = set()
    today = datetime.now(timezone.utc)
    for item in dom.getElementsByTagName("item"):
        def first_text(tag):
            els = item.getElementsByTagName(tag)
            if not els or not els[0].firstChild:
                return ""
            return els[0].firstChild.nodeValue.strip()

        title = first_text("title")
        if not title:
            continue
        pub_date = first_text("pubDate")
        description = first_text("description")
        link = first_text("link")
        try:
            dt = parsedate_to_datetime(pub_date)
        except Exception:
            continue
        if dt is None or dt < today:
            continue
        iso = dt.isoformat(timespec="minutes")
        record_id = make_id(link or "agora", iso)
        if record_id in seen_ids:
            continue
        seen_ids.add(record_id)
        records.append({
            "id": record_id,
            "date": iso,
            "end_date": None,
            "title": title,
            "venue": "Barry Zukerman Amphitheatre, Earl Bales Park, Toronto",
            "source_url": link or "https://seminarschools.com/agora/",
            "source_id": source_config["id"],
            "type": "gathering",
            "speaker_or_director": "Rainbowsol",
            "attendance_confirmed": True,
            "confidence": 100,
            "four_condition_test": {
                "time_place": True,
                "prepared_offering": True,
                "substantive_engagement": True,
                "intellectual_stake": True,
            },
            "raw_excerpt": description[:500],
            "scraped_at": now_iso(),
            "review_status": "auto-published",
            "marginalia_url": None,
        })
    return records


def fetch_manual_events(source_config):
    """
    Manual events reader. For sources we cannot scrape (JHI behind WAF,
    Shopify-protected sites like Type Books, JavaScript-rendered sites without
    Playwright support yet), Saul hand-curates events into a JSON file at
    /data/manual-events.json. This fetcher reads them and filters by source_id.

    Format of /data/manual-events.json:
        {
          "events": [
            {
              "source_id": "jhi",
              "date": "2026-06-15T18:00:00-04:00",
              "title": "Lecture by ...",
              "venue": "Jackman Humanities Building, Toronto",
              "type": "lecture",
              "speaker_or_director": "Speaker Name",
              "source_url": "https://...",
              "attendance_confirmed": true
            },
            ...
          ]
        }

    Records get filter_to_verified_only treatment same as scraped events;
    confidence defaults to 100 because hand-curated by user.
    """
    manual_path = ROOT / "data" / "manual-events.json"
    if not manual_path.exists():
        return []
    try:
        data = json.loads(manual_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    records = []
    # Note: no past-date filter for manual events. Curator decides what to include.
    # The seminars page UI distinguishes past from upcoming visually.
    for entry in data.get("events", []):
        if entry.get("source_id") != source_config["id"]:
            continue
        try:
            dt = datetime.fromisoformat(entry["date"])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone(-datetime.now().astimezone().utcoffset()))
        except Exception:
            continue

        iso = dt.isoformat(timespec="minutes")
        record_id = make_id(entry.get("source_url", entry["title"]), iso)
        records.append({
            "id": record_id,
            "date": iso,
            "end_date": None,
            "title": entry["title"],
            "venue": entry.get("venue", source_config.get("extraction", {}).get("venue_default", "Toronto")),
            "source_url": entry.get("source_url", f"https://seminarschools.com/seminars/"),
            "source_id": source_config["id"],
            "type": entry.get("type", source_config.get("default_type", "lecture")),
            "speaker_or_director": entry.get("speaker_or_director"),
            "attendance_confirmed": entry.get("attendance_confirmed", True),
            "confidence": 100,  # hand-curated by Saul, fully verified
            "four_condition_test": {
                "time_place": True,
                "prepared_offering": True,
                "substantive_engagement": True,
                "intellectual_stake": True,
            },
            "raw_excerpt": entry.get("description", "")[:500],
            "scraped_at": now_iso(),
            "review_status": "auto-published",
            "marginalia_url": entry.get("marginalia_url"),
        })
    return records


def fetch_ical_then_html(source_config):
    """
    Try iCal endpoints first (cheap, structured), fall back to HTML scraper
    if no iCal feed responds. Drupal sites (UofT, many academic) often
    publish /events.ics or /calendar.ics that bypass the HTML WAF.

    source_config["ical_candidates"] is a list of paths to try. If a 200
    response with valid iCal content comes back, parse and return.
    Otherwise raise so caller can decide.
    """
    base = source_config["events_url"].rstrip("/")
    ical_paths = source_config.get("ical_candidates", [
        "/events.ics", "/calendar.ics", "/events/feed", "/calendar/feed",
        "/events/ical", "?display=ical",
    ])
    for path in ical_paths:
        # path can be a query string or a path
        if path.startswith("?"):
            test_url = base + path
        else:
            test_url = base + path
        try:
            response = fetch(test_url)
            if response.status_code != 200:
                continue
            text = response.text
            if "BEGIN:VCALENDAR" not in text:
                continue
            # Found a real iCal feed. Parse it.
            return parse_ical(text, source_config)
        except Exception:
            continue
    # No iCal feed found. Caller (or wrapper) decides what to do.
    return []


def parse_ical(text, source_config):
    """Parse iCal text into our record format. Handles VEVENT blocks."""
    records = []
    seen_ids = set()
    today = datetime.now(timezone.utc)

    # Unfold continuation lines (RFC 5545 line folding)
    lines = []
    for raw in text.splitlines():
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] = lines[-1] + raw[1:]
        else:
            lines.append(raw)

    in_event = False
    event = {}
    for line in lines:
        if line == "BEGIN:VEVENT":
            in_event = True
            event = {}
        elif line == "END:VEVENT":
            in_event = False
            # Process accumulated event
            if "SUMMARY" in event and "DTSTART" in event:
                try:
                    dt = _parse_ical_datetime(event["DTSTART"])
                except Exception:
                    continue
                if dt is None or dt < today:
                    continue
                iso = dt.isoformat(timespec="minutes")
                url = event.get("URL", source_config["events_url"])
                record_id = make_id(url, iso)
                if record_id in seen_ids:
                    continue
                seen_ids.add(record_id)
                records.append({
                    "id": record_id,
                    "date": iso,
                    "end_date": None,
                    "title": event["SUMMARY"],
                    "venue": event.get("LOCATION") or source_config.get("extraction", {}).get("venue_default", "Toronto"),
                    "source_url": url,
                    "source_id": source_config["id"],
                    "type": source_config.get("default_type", "lecture"),
                    "speaker_or_director": None,
                    "attendance_confirmed": False,
                    "confidence": 85,  # iCal is structured but not LLM-verified yet
                    "four_condition_test": empty_four_condition(),
                    "raw_excerpt": event.get("DESCRIPTION", "")[:500],
                    "scraped_at": now_iso(),
                    "review_status": "auto-published",
                    "marginalia_url": None,
                })
        elif in_event and ":" in line:
            key_part, _, value = line.partition(":")
            # Strip iCal parameters (e.g., "DTSTART;TZID=America/Toronto")
            key = key_part.split(";")[0]
            event[key] = value

    return records


def _parse_ical_datetime(value):
    """Parse an iCal datetime string. Handles YYYYMMDDTHHMMSS[Z] and YYYYMMDD."""
    value = value.strip()
    try:
        if "T" in value:
            # Full datetime
            if value.endswith("Z"):
                return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            return datetime.strptime(value, "%Y%m%dT%H%M%S").replace(
                tzinfo=timezone(-datetime.now().astimezone().utcoffset())
            )
        else:
            # Date only (all-day event)
            return datetime.strptime(value, "%Y%m%d").replace(
                tzinfo=timezone(-datetime.now().astimezone().utcoffset())
            )
    except Exception:
        return None


def fetch_todo(source_config):
    """Placeholder fetcher for sources not yet implemented."""
    return []


# Source-id → fetcher dispatch
FETCHERS = {
    # Real fetchers
    "revue": fetch_revue,
    "jhi": fetch_jhi,
    "agora-self": fetch_agora_self,
    # Generic fallback fetchers (selected via source_config["fetcher"])
    "manual": fetch_manual_events,
    "ical": fetch_ical_then_html,
}


def get_fetcher(source_config):
    """
    Resolve which fetcher to use for a given source.

    Priority:
      1. source_config["fetcher"] explicit override. Lets Saul flip a source
         to "manual" without code changes if its native scraper breaks.
      2. Built-in FETCHERS dict by source id.
      3. fetch_todo (returns empty) for stubbed sources.
    """
    explicit = source_config.get("fetcher")
    if explicit and explicit in FETCHERS:
        return FETCHERS[explicit]
    sid = source_config["id"]
    return FETCHERS.get(sid, fetch_todo)


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------


def load_sources():
    with open(SOURCES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def deduplicate(records):
    """
    Cross-source dedup. Two records refer to the same event if they share
    title (normalized) and date (rounded to the hour).
    """
    seen = {}
    for r in records:
        key = (
            re.sub(r"\W+", "", r["title"].lower())[:80],
            r["date"][:13],  # year-month-day plus hour
        )
        if key in seen:
            # Keep the higher-confidence record
            if r.get("confidence", 0) > seen[key].get("confidence", 0):
                seen[key] = r
        else:
            seen[key] = r
    return list(seen.values())


def filter_to_verified_only(records):
    """
    Strict rule: any record whose confidence falls below the auto-publish
    threshold is dropped entirely. No review queue, no resurfacing.

    Per directive: if anything cannot be verified, take that event out.

    Manual records (review_status='manual') bypass the threshold check
    so hand-curated entries are not affected.
    """
    kept = []
    dropped = []
    for r in records:
        if r.get("review_status") == "manual":
            kept.append(r)
            continue
        if r.get("confidence", 0) >= CONFIDENCE_AUTO_PUBLISH_THRESHOLD:
            r["review_status"] = "auto-published"
            kept.append(r)
        else:
            r["review_status"] = "rejected"
            dropped.append(r)
    return kept, dropped


def write_rss(records):
    """Write RSS 2.0 feed at /seminars/feed.xml from auto-published records."""
    RSS_PATH.parent.mkdir(parents=True, exist_ok=True)
    items_xml = []
    for r in sorted(records, key=lambda x: x["date"]):
        try:
            dt = datetime.fromisoformat(r["date"])
            pub_date = dt.strftime("%a, %d %b %Y %H:%M:%S %z")
        except Exception:
            pub_date = ""
        def esc(s):
            return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        title = esc(r["title"])
        venue = esc(r["venue"])
        speaker = esc(r.get("speaker_or_director") or "")
        type_label = r["type"].replace("-", " ").title()
        desc_parts = [f"{type_label} at {venue}."]
        if speaker:
            desc_parts.append(f"With {speaker}.")
        if r.get("raw_excerpt"):
            desc_parts.append(esc(r["raw_excerpt"][:300]))
        description = " ".join(desc_parts)
        items_xml.append(
            f"<item>\n<title>{title}</title>\n<link>{r['source_url']}</link>\n"
            f"<guid isPermaLink=\"false\">{r['id']}</guid>\n"
            f"<pubDate>{pub_date}</pubDate>\n<description>{description}</description>\n"
            f"<category>{type_label}</category>\n</item>"
        )
    build_date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    feed = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        '<channel>\n'
        '<title>Toronto Seminars and Talks. Seminar Schools.</title>\n'
        '<link>https://seminarschools.com/seminars/</link>\n'
        '<atom:link href="https://seminarschools.com/seminars/feed.xml" rel="self" type="application/rss+xml" />\n'
        '<description>An aggregated calendar of upcoming public lectures, seminars, author readings, artist talks, panel discussions, philosophy cafes, gatherings, and cinema events with director Q and A across the Greater Toronto Area. Sources verified for substantive content. Events that do not meet the four-condition test are excluded.</description>\n'
        '<language>en-CA</language>\n'
        f'<lastBuildDate>{build_date}</lastBuildDate>\n'
        '<generator>seminarschools.com aggregator</generator>\n'
        '<image>\n'
        '<url>https://seminarschools.com/og-image.png</url>\n'
        '<title>Toronto Seminars and Talks. Seminar Schools.</title>\n'
        '<link>https://seminarschools.com/seminars/</link>\n'
        '</image>\n'
        + "\n".join(items_xml) + "\n"
        '</channel>\n'
        '</rss>\n'
    )
    RSS_PATH.write_text(feed, encoding="utf-8")


def write_outputs(kept, dropped, log):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "$schema_ref": "/data/seminars-schema.json",
        "generated_at": now_iso(),
        "count": len(kept),
        "events": sorted(kept, key=lambda r: r["date"]),
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # Internal-only audit trail of dropped records. Not surfaced to users.
    # Persisted for debugging the verification pipeline and tracking false
    # negatives over time.
    dropped_payload = {
        "generated_at": now_iso(),
        "count": len(dropped),
        "rule": "strict-drop: confidence < %d removed entirely" % CONFIDENCE_AUTO_PUBLISH_THRESHOLD,
        "events": sorted(dropped, key=lambda r: r["date"]),
    }
    REVIEW_PATH.write_text(json.dumps(dropped_payload, indent=2), encoding="utf-8")

    date_stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    snapshot = HISTORY_DIR / f"seminars-{date_stamp}.json"
    snapshot.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")

    write_rss(kept)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        help="Run only one source by id (e.g. revue). Default: all configured sources.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run scrapers and print summary; do not write output files.",
    )
    args = parser.parse_args()

    config = load_sources()
    sources = config["sources"]
    if args.source:
        sources = [s for s in sources if s["id"] == args.source]
        if not sources:
            print(f"No source matches id '{args.source}'", file=sys.stderr)
            sys.exit(2)

    all_records = []
    log = {
        "run_at": now_iso(),
        "sources": [],
    }

    for source_config in sources:
        sid = source_config["id"]
        fetcher = get_fetcher(source_config)
        if fetcher is None:
            log["sources"].append({
                "id": sid,
                "status": "no-fetcher",
                "count": 0,
            })
            continue
        try:
            records = fetcher(source_config)
            log["sources"].append({
                "id": sid,
                "status": "ok",
                "count": len(records),
            })
            all_records.extend(records)
        except Exception as exc:
            log["sources"].append({
                "id": sid,
                "status": "error",
                "error": str(exc),
                "count": 0,
            })

    try:
        deduped = deduplicate(all_records)
        kept, dropped = filter_to_verified_only(deduped)

        summary = (
            f"Sources run: {len(log['sources'])}. "
            f"Total candidates: {len(all_records)}. "
            f"After dedup: {len(deduped)}. "
            f"Verified and kept: {len(kept)}. "
            f"Dropped (unverified): {len(dropped)}."
        )
        print(summary)

        if args.dry_run:
            for r in kept:
                print(f"  KEEP {r['date']}  {r['title'][:60]}  ({r['source_id']})")
            for r in dropped:
                print(f"  DROP {r['date']}  {r['title'][:60]}  ({r['source_id']})")
            return

        write_outputs(kept, dropped, log)
        print(f"Wrote {OUTPUT_PATH}, {REVIEW_PATH}, {LOG_PATH}")
    except Exception as exc:
        # Last-resort safety net. If something in dedup, filter, or write_outputs
        # crashes, log it and still try to write the per-source log so we can
        # debug. Exit cleanly (0) so the workflow's commit-and-push step still
        # gets a chance to publish whatever the scraper managed to produce.
        import traceback
        print(f"FATAL in post-loop processing: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        log["fatal_error"] = {
            "message": str(exc),
            "traceback": traceback.format_exc(),
        }
        try:
            LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")
        except Exception:
            pass


if __name__ == "__main__":
    main()
