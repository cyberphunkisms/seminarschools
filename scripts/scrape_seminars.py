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
from datetime import datetime, timezone, timedelta
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
WATCHLIST_PATH = ROOT / "data" / "event-watchlist.json"
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
# Cross-source classification, topics, and provisional leads
# ---------------------------------------------------------------------------

TOPIC_KEYWORDS = {
    "FIFA": ["fifa", "world cup", "football", "soccer"],
    "Palestine": ["palestine", "palestinian", "gaza", "nakba"],
    "Human Rights": ["human rights", "civil rights", "rights"],
    "Labour": ["labour", "labor", "union", "strike", "worker", "workers", "picket"],
    "Climate": ["climate", "ecology", "environment", "environmental", "earth", "sustainability"],
    "Indigenous": ["indigenous", "first nations", "metis", "inuit", "turtle island"],
    "Black Studies": ["black", "african diaspora", "caribbean", "harlem", "race"],
    "Philosophy": ["philosophy", "ethics", "moral", "hegel", "kant", "aristotle", "plato"],
    "Humanities": ["humanities", "literature", "history", "religion", "theology", "classics"],
    "Writing": ["writing", "writer", "essay", "poetry", "fiction", "story", "submission"],
    "Youth": ["youth", "student", "students", "teen", "kid", "junior", "grades", "high school"],
    "Film": ["film", "cinema", "screening", "director", "filmmaker"],
    "Theatre": ["theatre", "theater", "stage", "performance", "play", "musical"],
    "Art": ["art", "artist", "gallery", "museum", "exhibition", "exhibit"],
    "Music": ["music", "concert", "choir", "opera", "jazz", "symphony"],
    "Community": ["community", "neighbourhood", "neighborhood", "mutual aid", "solidarity"],
    "Education": ["education", "teaching", "curriculum", "pedagogy", "school", "classroom", "learning"],
    "AI / Digital": ["artificial intelligence", "ai", "digital", "data", "algorithm", "technology", "media studies"],
    "Law / Justice": ["law", "legal", "justice", "rights", "prison", "abolition", "court"],
    "Politics": ["politics", "political", "democracy", "policy", "public sphere", "governance"],
    "Religion": ["religion", "theology", "islam", "christian", "jewish", "hindu", "buddhist", "scripture"],
    "Food / Hospitality": ["food", "culinary", "hospitality", "restaurant", "meal", "kitchen", "dining"],
    "Games / TTRPG": ["game", "games", "tabletop", "ttrpg", "rpg", "role-playing", "simulation"],
    "Health": ["health", "medicine", "medical", "wellness", "nutrition", "mental health", "bioethics"],
}


TYPE_HINTS = [
    ("protest", re.compile(r"\b(protest|rally|march|vigil|picket|strike|sit-in|walkout|demonstration|callout)\b", re.I)),
    ("cfp", re.compile(r"\b(call for papers|cfp|abstract deadline|proposal deadline|submission deadline)\b", re.I)),
    ("contest", re.compile(r"\b(contest|competition|prize|award|young writers|student writing)\b", re.I)),
    ("festival", re.compile(r"\b(festival|carnival|parade|street fair|arts fair)\b", re.I)),
    ("lecture", re.compile(r"\b(lecture|talk|panel|conversation|speaker series|artist talk|book talk)\b", re.I)),
    ("screening", re.compile(r"\b(screening|film|cinema|director q\s*&?\s*a|filmmaker)\b", re.I)),
    ("performance", re.compile(r"\b(performance|theatre|theater|musical|opera|concert|dance|ballet)\b", re.I)),
    ("exhibition", re.compile(r"\b(exhibition|exhibit|gallery|museum|installation)\b", re.I)),
    ("conference", re.compile(r"\b(conference|symposium|colloquium|congress)\b", re.I)),
    ("workshop", re.compile(r"\b(workshop|webinar|training|clinic)\b", re.I)),
    ("reading", re.compile(r"\b(reading|book launch|author talk|poetry)\b", re.I)),
    ("community", re.compile(r"\b(community|festival|fair|solidarity|mutual aid)\b", re.I)),
]

PUBLIC_TYPES = {
    "lecture", "screening", "reading", "artist-talk", "panel", "podcast-live", "scholar-talk",
    "philosophy-cafe", "conference", "workshop", "symposium", "colloquium", "book-talk",
    "book-launch", "talk", "forum", "webinar", "exhibition", "site-specific-art", "performance",
    "festival-of-form", "festival", "cultural-reproduction", "gathering", "memorial", "celebration",
    "networking", "residency", "retreat", "meeting", "protest", "community", "cfp",
    "defence", "other", "contest"
}

def event_text(record):
    parts = [
        record.get("title"), record.get("type"), record.get("speaker_or_director"),
        record.get("venue"), record.get("raw_excerpt"), record.get("description"),
        record.get("age_band"), record.get("source_id"),
    ]
    for key in ("secondary_types", "topics", "subjects", "genres", "academic_bands"):
        val = record.get(key)
        if isinstance(val, list):
            parts.append(" ".join(str(x) for x in val))
    return " ".join(str(p) for p in parts if p).lower()


def extract_topics(record):
    text = event_text(record)
    topics = []
    for topic, words in TOPIC_KEYWORDS.items():
        if any(w in text for w in words):
            topics.append(topic)
    return topics


def classify_event_type(record, source_config=None):
    current = record.get("type") or (source_config or {}).get("default_type") or "other"
    if current not in PUBLIC_TYPES:
        current = "other"
    text = event_text(record)
    # Keep highly specific existing types. Upgrade only broad/generic types.
    if current not in {"other", "talk", "gathering", "community", "meeting"}:
        return current
    for etype, pattern in TYPE_HINTS:
        if pattern.search(text):
            if etype == "community" and current == "gathering":
                return current
            return etype
    return current


def normalize_record(record, source_config=None):
    record = dict(record)
    record["type"] = classify_event_type(record, source_config)
    secondary = []
    for t in record.get("secondary_types") or []:
        if t and t in PUBLIC_TYPES and t != record["type"] and t not in secondary:
            secondary.append(t)
    record["secondary_types"] = secondary
    topics = []
    for t in record.get("topics") or []:
        if t and t not in topics:
            topics.append(str(t))
    for t in extract_topics(record):
        if t not in topics:
            topics.append(t)
    if topics:
        record["topics"] = topics
    return record


def provisional_status(record):
    status = str(record.get("status") or record.get("review_status") or "").lower()
    if status.startswith("needs-"):
        return status
    text = event_text(record)
    if record.get("confidence", 100) < CONFIDENCE_AUTO_PUBLISH_THRESHOLD and re.search(r"\b(tbd|tba|not available|more info to be shared soon|time to be confirmed|location to be confirmed)\b", text, re.I):
        if "location" in text or "venue" in text:
            return "needs-location"
        return "needs-time-place"
    return ""


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




# ---------------------------------------------------------------------------
# Generic category-aware discovery fetcher
# ---------------------------------------------------------------------------

DATE_WORD_RE = re.compile(
    r"\b(January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan\.?|Feb\.?|Mar\.?|Apr\.?|May|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+"
    r"(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b",
    re.I,
)
TIME_WORD_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)\b", re.I)
JSON_LD_EVENT_TYPES = {"Event", "EducationEvent", "PublicationEvent", "Festival", "MusicEvent", "TheaterEvent", "ExhibitionEvent", "ScreeningEvent", "SocialEvent"}
TOPIC_WORDS = [
    "FIFA", "World Cup", "football", "soccer", "Palestine", "Human Rights", "Indigenous", "climate", "labour", "labor",
    "philosophy", "ethics", "history", "literature", "poetry", "writing", "film", "theatre", "theater", "exhibition",
    "protest", "rally", "march", "vigil", "CFP", "call for papers", "conference", "fellowship", "contest",
    "education", "pedagogy", "AI", "artificial intelligence", "digital", "data", "law", "justice", "politics",
    "religion", "theology", "food", "culinary", "games", "TTRPG", "health", "bioethics", "community",
]


def _local_tz():
    offset = datetime.now().astimezone().utcoffset()
    return timezone(-(offset or timedelta(hours=4)))


def _clean_text(value, limit=500):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _extract_topics(*parts):
    text = "\n".join(str(p or "") for p in parts)
    low = text.lower()
    found = []
    for word in TOPIC_WORDS:
        if word.lower() in low and word not in found:
            found.append(word)
    return found[:12]


def _parse_loose_datetime(text, default_year=None):
    text = _clean_text(text, 300)
    if not text:
        return None, None
    m = DATE_WORD_RE.search(text)
    if not m:
        return None, None
    month, day, year = m.groups()
    year = int(year or default_year or datetime.now().year)
    month = month.replace('.', '')
    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            dt = datetime.strptime(f"{month} {int(day)} {year}", fmt)
            break
        except ValueError:
            dt = None
    if dt is None:
        return None, None
    now = datetime.now()
    if (now - dt).days > 60:
        dt = dt.replace(year=dt.year + 1)
    tm = TIME_WORD_RE.search(text)
    time_found = None
    if tm:
        hour = int(tm.group(1)); minute = int(tm.group(2) or 0); ap = tm.group(3).lower()
        if ap.startswith('p') and hour != 12: hour += 12
        if ap.startswith('a') and hour == 12: hour = 0
        dt = dt.replace(hour=hour, minute=minute)
        time_found = f"{tm.group(1)}:{tm.group(2) or '00'} {tm.group(3)}"
    else:
        dt = dt.replace(hour=0, minute=0)
    return dt.replace(tzinfo=_local_tz()), time_found


def _source_default_venue(source_config):
    return (source_config.get('extraction') or {}).get('venue_default') or source_config.get('default_venue') or "Toronto / online"


def _generic_specific_place(text, source_config):
    text = _clean_text(text, 900)
    lower = text.lower()
    if any(x in lower for x in ['location tbd', 'venue tbd', 'time tbd', 'more info', 'details soon']):
        return False
    venue_default = _source_default_venue(source_config).lower()
    if venue_default and venue_default not in {'toronto', 'toronto / online', 'online', 'virtual'}:
        return True
    return bool(re.search(r"\b(\d{1,5}\s+[A-Z][A-Za-z0-9'’.-]+\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Lane|Way)|Room\s+\w+|Theatre|Theater|Hall|Library|Museum|Gallery|Campus|Zoom|Online|Virtual)\b", text))


def _category_type_from_text(text, default_type):
    low = (text or '').lower()
    # Keep source default as the primary anchor, then upgrade only when the listing is explicit.
    if any(w in low for w in ['call for papers', 'cfp', 'abstract deadline', 'proposal deadline']): return 'cfp'
    if any(w in low for w in ['submission deadline', 'writing contest', 'essay contest', 'poetry prize', 'competition deadline']): return 'contest'
    if any(w in low for w in ['protest', 'rally', 'march', 'vigil', 'picket', 'strike', 'walkout', 'demonstration']): return 'protest'
    if any(w in low for w in ['screening', 'film', 'cinema']): return 'screening'
    if any(w in low for w in ['exhibition', 'exhibit', 'gallery opening']): return 'exhibition'
    if any(w in low for w in ['performance', 'theatre', 'theater', 'concert', 'dance']): return 'performance'
    if any(w in low for w in ['festival', 'carnival', 'parade']): return 'festival'
    if any(w in low for w in ['workshop', 'seminar', 'webinar', 'masterclass']): return 'workshop'
    if any(w in low for w in ['lecture', 'talk', 'colloquium', 'symposium', 'panel']): return 'lecture'
    if any(w in low for w in ['reading', 'book launch', 'author']): return 'reading'
    if any(w in low for w in ['community', 'mutual aid', 'teach-in', 'exhibit']): return 'community'
    return default_type or 'other'


def _jsonld_items(node):
    if isinstance(node, list):
        for item in node:
            yield from _jsonld_items(item)
    elif isinstance(node, dict):
        if '@graph' in node:
            yield from _jsonld_items(node.get('@graph'))
        yield node


def _jsonld_type_matches(item):
    t = item.get('@type') or item.get('type')
    if isinstance(t, list):
        return any(str(x) in JSON_LD_EVENT_TYPES for x in t)
    return str(t) in JSON_LD_EVENT_TYPES


def _parse_jsonld_date(value):
    if not value:
        return None
    if isinstance(value, list): value = value[0] if value else None
    value = str(value or '').strip()
    if not value: return None
    try:
        if value.endswith('Z'):
            return datetime.fromisoformat(value.replace('Z','+00:00'))
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None: dt = dt.replace(tzinfo=_local_tz())
        return dt
    except Exception:
        d, _ = _parse_loose_datetime(value)
        return d


def _location_from_jsonld(loc):
    if isinstance(loc, str): return loc
    if isinstance(loc, dict):
        parts = []
        if loc.get('name'): parts.append(loc.get('name'))
        addr = loc.get('address')
        if isinstance(addr, str): parts.append(addr)
        elif isinstance(addr, dict):
            for k in ['streetAddress','addressLocality','addressRegion','postalCode','addressCountry']:
                if addr.get(k): parts.append(addr[k])
        return ', '.join(str(x) for x in parts if x)
    return ''


def _event_record(source_config, title, dt, url, venue, raw, confidence, status=None, secondary_types=None):
    etype = _category_type_from_text(f"{title}\n{raw}\n{venue}", source_config.get('default_type', 'other'))
    if status is None:
        status = 'auto-published' if confidence >= CONFIDENCE_AUTO_PUBLISH_THRESHOLD else 'queued'
    return {
        'id': make_id(url or source_config.get('events_url',''), dt.isoformat(timespec='minutes')),
        'date': dt.isoformat(timespec='minutes'),
        'end_date': None,
        'title': _clean_text(title, 180),
        'venue': _clean_text(venue or _source_default_venue(source_config), 220),
        'source_url': url or source_config.get('events_url'),
        'source_id': source_config['id'],
        'type': etype,
        'secondary_types': secondary_types or [],
        'age_band': None,
        'speaker_or_director': None,
        'attendance_confirmed': confidence >= 80,
        'confidence': int(confidence),
        'four_condition_test': {
            'time_place': confidence >= 70,
            'prepared_offering': True,
            'substantive_engagement': etype not in {'other'},
            'intellectual_stake': etype in {'lecture','conference','workshop','reading','screening','exhibition','protest','community','cfp','contest'},
        },
        'raw_excerpt': _clean_text(raw or title, 500),
        'topics': _extract_topics(title, raw, venue, source_config.get('name')),
        'scraped_at': now_iso(),
        'review_status': status,
        'marginalia_url': None,
        'parent_id': None,
        'is_parent_festival': False,
    }


def fetch_generic_event_source(source_config):
    """Category-aware fallback for rostered event pages.

    Uses structured JSON-LD Event data when available, then conservative HTML
    date/link extraction. Fully specified JSON-LD/iCal events can publish;
    ambiguous HTML cards become queued/watchlist leads. This improves recall
    across all Polymythcal categories without inventing time, place, or status.
    """
    url = source_config.get('events_url') or ''
    if not url.startswith(('http://','https://')):
        return []
    ical_records = fetch_ical_then_html(source_config)
    if ical_records:
        return ical_records
    try:
        response = fetch(url)
        response.raise_for_status()
    except Exception:
        return []
    soup = BeautifulSoup(response.text, 'html.parser')
    records = []
    seen = set()
    # JSON-LD first: highest recall with lower false positives.
    for script in soup.find_all('script', attrs={'type': re.compile('ld\\+json', re.I)}):
        try:
            data = json.loads(script.string or script.get_text() or '')
        except Exception:
            continue
        for item in _jsonld_items(data):
            if not isinstance(item, dict) or not _jsonld_type_matches(item):
                continue
            title = item.get('name') or item.get('headline')
            dt = _parse_jsonld_date(item.get('startDate') or item.get('datePublished'))
            if not title or not dt:
                continue
            now = datetime.now(dt.tzinfo or timezone.utc)
            if dt < now - timedelta(days=14):
                continue
            src_url = item.get('url') or url
            if isinstance(src_url, list): src_url = src_url[0] if src_url else url
            venue = _location_from_jsonld(item.get('location')) or _source_default_venue(source_config)
            desc = item.get('description') or item.get('about') or title
            confidence = 88 if _generic_specific_place(venue + ' ' + str(desc), source_config) else 68
            rec = _event_record(source_config, title, dt, urllib.parse.urljoin(url, str(src_url)), venue, desc, confidence)
            key = (rec['title'].lower(), rec['date'][:16], rec['source_url'])
            if key not in seen:
                seen.add(key); records.append(rec)
    if records:
        return records
    # Conservative HTML fallback: look around links/headings for a date.
    blocks = []
    for node in soup.find_all(['article','li','section','div'], limit=500):
        text = node.get_text(' ', strip=True)
        if len(text) < 20 or len(text) > 1600 or not DATE_WORD_RE.search(text):
            continue
        link = node.find('a', href=True)
        heading = node.find(['h1','h2','h3','h4'])
        title = (heading.get_text(' ', strip=True) if heading else (link.get_text(' ', strip=True) if link else ''))
        if not title or len(title) < 4:
            continue
        dt, time_found = _parse_loose_datetime(text)
        if not dt:
            continue
        now = datetime.now(dt.tzinfo or timezone.utc)
        if dt < now - timedelta(days=14):
            continue
        href = urllib.parse.urljoin(url, link['href']) if link and link.get('href') else url
        venue = _source_default_venue(source_config)
        specific = _generic_specific_place(text, source_config)
        confidence = 72 if (time_found and specific) else 58
        rec = _event_record(source_config, title, dt, href, venue, text, confidence)
        key = (rec['title'].lower(), rec['date'][:16], rec['source_url'])
        if key not in seen:
            seen.add(key); blocks.append(rec)
        if len(blocks) >= 40:
            break
    return blocks


FINDAPROTEST_EVENT_RE = re.compile(r"/event/toronto/[^\"'?#\s]+")
FINDAPROTEST_PROTEST_WORDS = re.compile(
    r"\b(protest|rally|march|vigil|picket|strike|sit-in|walkout|demonstration)\b",
    re.I,
)


def _parse_findaprotest_date(date_text):
    """Parse date strings like 'Saturday, July 18th'. Year is inferred."""
    text = (date_text or "").strip()
    text = re.sub(r"^Date:\s*", "", text, flags=re.I).strip()
    text = re.sub(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+", "", text, flags=re.I)
    text = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", text, flags=re.I)
    if re.search(r"\b\d{4}\b", text):
        fmts = ["%B %d %Y", "%b %d %Y"]
    else:
        fmts = ["%B %d %Y", "%b %d %Y"]
        text = f"{text} {datetime.now().year}"
    for fmt in fmts:
        try:
            dt = datetime.strptime(text, fmt)
            now = datetime.now()
            if (now - dt).days > 60:
                dt = dt.replace(year=dt.year + 1)
            return dt.replace(tzinfo=timezone(timedelta(hours=-4)))
        except ValueError:
            continue
    return None


def _parse_findaprotest_time(time_text):
    text = (time_text or "").strip()
    text = re.sub(r"^Time:\s*", "", text, flags=re.I).strip()
    if not text or re.search(r"\b(TBD|TBA|not available|unknown)\b", text, re.I):
        return None
    if re.search(r"all\s*day", text, re.I):
        return (0, 0)
    for fmt in ("%I:%M %p", "%I %p", "%H:%M"):
        try:
            t = datetime.strptime(text.upper(), fmt).time()
            return (t.hour, t.minute)
        except ValueError:
            continue
    return None


def _generic_findaprotest_location(location):
    loc = re.sub(r"\s+", " ", (location or "").strip().lower())
    generic = {
        "toronto",
        "toronto, canada",
        "toronto, on, canada",
        "toronto, ontario, canada",
        "toronto, ontario, canada, toronto, ontario, canada",
        "old toronto, toronto, on, canada",
    }
    return (not loc) or loc in generic


def _line_after_prefix(lines, prefix):
    prefix_low = prefix.lower()
    for i, line in enumerate(lines):
        low = line.lower()
        if low.startswith(prefix_low):
            value = line.split(":", 1)[1].strip() if ":" in line else ""
            if value:
                return value
            if i + 1 < len(lines):
                return lines[i + 1]
    return ""


def _findaprotest_classify(title, full_text):
    tl = (title or "").lower()
    fl = (full_text or "").lower()
    if FINDAPROTEST_PROTEST_WORDS.search(f"{title}\n{full_text}"):
        return "protest", []
    if "film screening" in fl:
        return "screening", ["community"] if "community" in fl else []
    if "exhibit" in tl or "exhibition" in fl:
        return "exhibition", ["community"] if "community" in fl else []
    if "community" in fl:
        return "community", []
    return "community", []


def _extract_findaprotest_detail(html_text, detail_url, source_config):
    soup = BeautifulSoup(html_text, "html.parser")
    full_text = soup.get_text("\n", strip=True)
    lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]

    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    if not title:
        return None

    organizer = None
    h2 = soup.find("h2")
    if h2:
        organizer = h2.get_text(" ", strip=True).lstrip("#").strip() or None

    date_text = _line_after_prefix(lines, "Date:")
    time_text = _line_after_prefix(lines, "Time:")
    location = _line_after_prefix(lines, "Location:")
    parsed_date = _parse_findaprotest_date(date_text)
    if parsed_date is None:
        return None

    parsed_time = _parse_findaprotest_time(time_text)
    missing_time = parsed_time is None
    generic_location = _generic_findaprotest_location(location)
    if parsed_time:
        parsed_date = parsed_date.replace(hour=parsed_time[0], minute=parsed_time[1])
    else:
        # Date-only placeholder stays below the publication threshold.
        parsed_date = parsed_date.replace(hour=0, minute=0)

    etype, secondary_types = _findaprotest_classify(title, full_text)
    confidence = 60 if (missing_time or generic_location) else 90
    if missing_time:
        status = "needs-time-place"
    elif generic_location:
        status = "needs-location"
    else:
        status = "auto-published"
    excerpt_parts = [title]
    if organizer:
        excerpt_parts.append(organizer)
    if date_text:
        excerpt_parts.append(f"Date: {date_text}")
    if time_text:
        excerpt_parts.append(f"Time: {time_text}")
    if location:
        excerpt_parts.append(f"Location: {location}")
    # Add the about copy around the most useful terms when present.
    m = re.search(r"(SAVE THE DATE:.{0,700})", full_text, flags=re.I | re.S)
    if m:
        excerpt_parts.append(re.sub(r"\s+", " ", m.group(1)).strip())
    raw_excerpt = " | ".join(excerpt_parts)[:500]

    iso = parsed_date.isoformat(timespec="minutes")
    rec = {
        "id": make_id(detail_url, iso),
        "date": iso,
        "end_date": None,
        "title": title,
        "venue": location or "Toronto",
        "source_url": detail_url,
        "source_id": source_config["id"],
        "type": etype,
        "secondary_types": secondary_types,
        "age_band": None,
        "topics": [],
        "date_text": date_text,
        "time_text": time_text,
        "location_text": location,
        "status": status,
        "speaker_or_director": organizer,
        "attendance_confirmed": bool(organizer),
        "confidence": confidence,
        "four_condition_test": {
            "time_place": not (missing_time or generic_location),
            "prepared_offering": etype in {"community", "exhibition", "panel", "lecture", "screening"},
            "substantive_engagement": etype in {"community", "exhibition", "protest"},
            "intellectual_stake": any(k in full_text.lower() for k in ["fifa", "human rights", "palestine", "indigenous rights"]),
        },
        "raw_excerpt": raw_excerpt,
        "scraped_at": now_iso(),
        "review_status": "queued" if status.startswith("needs-") else status,
        "marginalia_url": None,
        "parent_id": None,
        "is_parent_festival": False,
    }
    return rec


def fetch_findaprotest_toronto(source_config):
    """Find a Protest Toronto scraper. Publishes only fully specified events;
    TBD/time-place-incomplete leads are returned below the verification threshold
    so they land in the review file rather than the public calendar."""
    urls = [source_config["events_url"], *source_config.get("additional_urls", [])]
    detail_urls = []
    seen = set()
    for url in urls:
        try:
            response = fetch(url)
            response.raise_for_status()
        except Exception:
            continue
        for match in FINDAPROTEST_EVENT_RE.findall(response.text):
            detail_url = urllib.parse.urljoin(url, match)
            if detail_url not in seen:
                seen.add(detail_url)
                detail_urls.append(detail_url)
    records = []
    for detail_url in detail_urls:
        try:
            response = fetch(detail_url)
            response.raise_for_status()
            rec = _extract_findaprotest_detail(response.text, detail_url, source_config)
            if rec:
                records.append(rec)
        except Exception:
            continue
    return records


def fetch_todo(source_config):
    """Placeholder fetcher for sources not yet implemented."""
    return []


# Source-id → fetcher dispatch
FETCHERS = {
    # Real fetchers
    "revue": fetch_revue,
    "jhi": fetch_jhi,
    "agora-self": fetch_agora_self,
    "findaprotest-toronto": fetch_findaprotest_toronto,
    "generic-html": fetch_generic_event_source,
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
    if sid in FETCHERS:
        return FETCHERS[sid]
    # For real HTTP roster sources, use the conservative generic discovery
    # fallback instead of silently returning []. Discovery-only/TODO pseudo-URLs
    # still return [] because publishing from vague source instructions would
    # fabricate events.
    if str(source_config.get("events_url", "")).startswith(("http://", "https://")):
        return fetch_generic_event_source
    return fetch_todo


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
    Public calendar stays strict: records below the auto-publish threshold
    do not appear as events. Provisional civic leads with a real source but
    missing time/place move to the watchlist instead of being lost.
    """
    kept = []
    dropped = []
    watchlist = []
    for r in records:
        if r.get("review_status") == "manual":
            kept.append(r)
            continue
        status = provisional_status(r)
        if status:
            r["review_status"] = "queued"
            r["status"] = status
            watchlist.append(r)
            continue
        if r.get("confidence", 0) >= CONFIDENCE_AUTO_PUBLISH_THRESHOLD:
            r["review_status"] = "auto-published"
            kept.append(r)
        else:
            r["review_status"] = "rejected"
            dropped.append(r)
    return kept, dropped, watchlist


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


def write_outputs(kept, dropped, watchlist, log):
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

    WATCHLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing_watchlist = []
    if WATCHLIST_PATH.exists():
        try:
            existing_payload = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
            if isinstance(existing_payload.get("items"), list):
                existing_watchlist = existing_payload["items"]
        except Exception:
            existing_watchlist = []

    def _wl_key(item):
        return (
            item.get("source_url")
            or f"{item.get('source_id','')}::{item.get('title','')}::{item.get('date','') or item.get('date_text','')}"
        )

    published_keys = {_wl_key(item) for item in kept}
    merged_watchlist = {}
    for item in existing_watchlist + watchlist:
        key = _wl_key(item)
        if not key or key in published_keys:
            continue
        merged_watchlist[key] = item
    watchlist_items = sorted(merged_watchlist.values(), key=lambda r: r.get("date", "") or r.get("date_text", ""))
    watchlist_payload = {
        "generated_at": now_iso(),
        "count": len(watchlist_items),
        "rule": "source-confirmed leads with missing time/place stay out of events until verified; existing leads persist until confirmed or published",
        "items": watchlist_items,
    }
    WATCHLIST_PATH.write_text(json.dumps(watchlist_payload, indent=2), encoding="utf-8")

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
            records = [normalize_record(r, source_config) for r in fetcher(source_config)]
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
        kept, dropped, watchlist = filter_to_verified_only(deduped)

        summary = (
            f"Sources run: {len(log['sources'])}. "
            f"Total candidates: {len(all_records)}. "
            f"After dedup: {len(deduped)}. "
            f"Verified and kept: {len(kept)}. "
            f"Dropped (unverified): {len(dropped)}. "
            f"Watchlist leads: {len(watchlist)}."
        )
        print(summary)

        if args.dry_run:
            for r in kept:
                print(f"  KEEP {r['date']}  {r['title'][:60]}  ({r['source_id']})")
            for r in dropped:
                print(f"  DROP {r['date']}  {r['title'][:60]}  ({r['source_id']})")
            for r in watchlist:
                print(f"  WATCH {r.get('date','')}  {r.get('title','')[:60]}  ({r.get('source_id','')})")
            return

        write_outputs(kept, dropped, watchlist, log)
        print(f"Wrote {OUTPUT_PATH}, {REVIEW_PATH}, {WATCHLIST_PATH}, {LOG_PATH}")
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
