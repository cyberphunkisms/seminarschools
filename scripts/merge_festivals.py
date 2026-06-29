#!/usr/bin/env python3
"""
merge_festivals.py

Reads /tmp/festivals-output.json (Claude's two-pass harvest), enforces the
no-aggregator-leak rule, dedupes against /data/manual-events.json on
(normalized_title, date_to_hour), validates against /data/seminars-schema.json,
writes /festivals/events.json and /festivals/feed.xml, updates the per-run
audit log.

The schema is shared with seminars. Festivals get their own output directory
because the surface mental-model is different (festivals span days/weeks;
seminars are point-in-time). The display page can union both feeds.
"""

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("FATAL: jsonschema not installed. pip install jsonschema", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
HARVEST_PATH = Path("/tmp/festivals-output.json")
MANUAL_PATH = ROOT / "data" / "manual-events.json"
SOURCES_PATH = ROOT / "scripts" / "festivals-sources.json"
SCHEMA_PATH = ROOT / "data" / "seminars-schema.json"
OUT_PATH = ROOT / "festivals" / "events.json"
RSS_PATH = ROOT / "festivals" / "feed.xml"
LOG_PATH = ROOT / "data" / "festivals-scrape-log.json"
HISTORY_DIR = ROOT / "data" / "festivals-history"


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def make_id(source_url, iso_date, title=""):
    key = f"{source_url}::{iso_date}::{title}".encode("utf-8")
    return hashlib.sha1(key).hexdigest()[:12]


def normalize_title(t):
    return re.sub(r"\s+", " ", t.lower().strip())


def round_to_hour(iso_date):
    try:
        dt = datetime.fromisoformat(iso_date)
        return dt.replace(minute=0, second=0, microsecond=0).isoformat()
    except Exception:
        return iso_date


def host_of(url):
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""


def load_aggregator_guard():
    """Build the two-tier leak guard from festivals-sources.json.

    Tier A: discovery-only hostnames. Hosts that appear in discovery_aggregators
    but NOT in primary_sources. Any source_url matching is a leak.
    Tier B: collision-host exact URLs. When a host (e.g. toronto.ca) is BOTH
    a discovery aggregator and a primary source, we cannot blanket-block the
    host. Instead, block source_urls that exactly match a discovery aggregator
    URL (the events_url or any additional_urls).

    Returns (discovery_only_hosts, blocked_exact_urls).
    """
    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))

    primary_hosts = set()
    for s in sources.get("primary_sources", []):
        h = host_of(s.get("events_url", ""))
        if h:
            primary_hosts.add(h)

    discovery_hosts = set()
    blocked_exact_urls = set()
    for agg in sources.get("discovery_aggregators", []):
        for url in [agg.get("events_url")] + agg.get("additional_urls", []):
            if url:
                h = host_of(url)
                if h:
                    discovery_hosts.add(h)
                blocked_exact_urls.add(url.rstrip("/"))

    discovery_only_hosts = discovery_hosts - primary_hosts
    return discovery_only_hosts, blocked_exact_urls


def load_harvest():
    if not HARVEST_PATH.exists():
        print(f"ERROR: harvest file {HARVEST_PATH} missing", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(HARVEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: harvest JSON malformed: {e}", file=sys.stderr)
        sys.exit(1)


def load_manual_festivals():
    """Read manual-events.json, filter to festival-class entries only.
    Manual entries with type ∈ {festival-of-form, cultural-reproduction,
    site-specific-art} or with a source_id matching festivals-sources
    primary entries get pulled into the festivals stream."""
    if not MANUAL_PATH.exists():
        return []
    try:
        data = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    festival_source_ids = {s["id"] for s in sources["primary_sources"]}
    festival_types = {"festival", "festival-of-form", "cultural-reproduction", "site-specific-art"}

    records = []
    for entry in data.get("events", []):
        is_festival = (
            entry.get("type") in festival_types
            or entry.get("source_id") in festival_source_ids
        )
        if not is_festival:
            continue
        try:
            dt = datetime.fromisoformat(entry["date"])
        except Exception:
            continue
        iso = dt.isoformat(timespec="minutes")
        record_id = make_id(entry.get("source_url", entry["title"]), iso, entry["title"])
        records.append({
            "id": record_id,
            "date": iso,
            "end_date": entry.get("end_date"),
            "title": entry["title"],
            "venue": entry.get("venue", "Toronto"),
            "source_url": entry.get("source_url", "https://seminarschools.com/festivals/"),
            "source_id": entry.get("source_id", "manual-curated"),
            "type": entry.get("type", "festival-of-form"),
            "speaker_or_director": entry.get("speaker_or_director"),
            "attendance_confirmed": entry.get("attendance_confirmed", True),
            "confidence": 100,
            "four_condition_test": {
                "time_place": True,
                "prepared_offering": True,
                "substantive_engagement": True,
                "intellectual_stake": True,
            },
            "raw_excerpt": entry.get("description", "")[:500],
            "scraped_at": now_iso(),
            "review_status": "manual",
            "marginalia_url": entry.get("marginalia_url"),
            "secondary_types": entry.get("secondary_types", []),
            "parent_id": entry.get("parent_id"),
            "is_parent_festival": entry.get("is_parent_festival", False),
            "age_band": entry.get("age_band"),
        })
    return records


def enforce_date_sanity(records, max_days_ahead=365):
    """Drop records whose date is more than max_days_ahead from today.
    A festival 365+ days out signals stale-rollover content (last year's
    page rolled forward as a placeholder for next year, no real edition
    confirmed). Defense against the stale-rollover hazard."""
    now = datetime.now(timezone.utc)
    kept, dropped = [], []
    for r in records:
        try:
            dt = datetime.fromisoformat(r["date"])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days_ahead = (dt - now).days
            if days_ahead > max_days_ahead:
                dropped.append({
                    "title": r.get("title", "?"),
                    "date": r["date"],
                    "days_ahead": days_ahead,
                    "reason": f"more than {max_days_ahead} days in future, likely stale-rollover"
                })
                continue
            if days_ahead < -7:
                dropped.append({
                    "title": r.get("title", "?"),
                    "date": r["date"],
                    "days_ahead": days_ahead,
                    "reason": f"event ended more than 7 days ago, stale"
                })
                continue
        except Exception:
            pass
        kept.append(r)
    return kept, dropped


def enforce_no_aggregator_leak(records, discovery_only_hosts, blocked_exact_urls):
    """Audit gate. Defense-in-depth against the agent putting an aggregator
    URL in source_url. Two-tier check:
      1. discovery-only host: anything on that host is dropped
      2. collision host (e.g. toronto.ca): only the exact aggregator URLs
         (events_url + additional_urls listed in festivals-sources.json) are
         dropped; specific sub-pages on the same host are kept.
    Offenders dropped and logged."""
    kept, dropped = [], []
    for r in records:
        url = (r.get("source_url") or "").rstrip("/")
        src_host = host_of(url)
        if src_host in discovery_only_hosts:
            dropped.append({
                "title": r.get("title", "?"),
                "source_url": r.get("source_url"),
                "reason": f"hostname '{src_host}' is discovery-only aggregator"
            })
        elif url in blocked_exact_urls:
            dropped.append({
                "title": r.get("title", "?"),
                "source_url": r.get("source_url"),
                "reason": f"URL exactly matches a listed aggregator entry"
            })
        else:
            kept.append(r)
    return kept, dropped


def merge(harvest_records, manual_records):
    """Manual wins on (normalized_title, date_to_hour) collision."""
    manual_keys = {
        (normalize_title(r["title"]), round_to_hour(r["date"]))
        for r in manual_records
    }
    deduped = list(manual_records)
    for r in harvest_records:
        key = (normalize_title(r["title"]), round_to_hour(r["date"]))
        if key in manual_keys:
            continue
        deduped.append(r)
    deduped.sort(key=lambda r: r["date"])
    return deduped


def normalize_festival_parents(records):
    """A festival season is type=fes​tival; form/cultural/site subtype remains secondary."""
    for r in records:
        if r.get("is_parent_festival") and r.get("type") != "festival":
            old = r.get("type")
            r["type"] = "festival"
            secondary = r.setdefault("secondary_types", [])
            if old and old not in secondary:
                secondary.append(old)
    return records


def validate(records, schema):
    validator = Draft7Validator(schema)
    errors = []
    for i, record in enumerate(records):
        for e in validator.iter_errors(record):
            errors.append(f"  record[{i}] ({record.get('title','?')[:40]}): {e.message}")
    return errors


def xml_escape(s):
    """Full XML escaping for RSS-safe text content."""
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
             .replace('"', "&quot;")
             .replace("'", "&apos;"))


def write_rss(records):
    items = sorted(records, key=lambda r: r["date"], reverse=True)
    rss_items = []
    for r in items[:50]:
        title = xml_escape(r["title"] or "Untitled")
        link = xml_escape(r["source_url"])
        desc = xml_escape(r.get("raw_excerpt") or "")
        rss_items.append(
            f"<item><title>{title}</title><link>{link}</link>"
            f"<pubDate>{r['date']}</pubDate><guid isPermaLink=\"false\">{r['id']}</guid>"
            f"<description>{desc}</description></item>"
        )
    feed = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?xml-stylesheet type="text/xsl" href="/polymythseminars/feed.xsl"?>\n'
        '<rss version="2.0"><channel>'
        '<title>Seminar Schools — Toronto Festivals</title>'
        '<link>https://seminarschools.com/festivals/</link>'
        '<description>Toronto-GTA festivals passing the polymyth-broadened test.</description>'
        f'<lastBuildDate>{now_iso()}</lastBuildDate>'
        + "".join(rss_items)
        + '</channel></rss>'
    )
    RSS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RSS_PATH.write_text(feed, encoding="utf-8")


def write_log(harvest_data, final_records, aggregator_drops):
    by_source = {}
    by_type = {}
    for r in final_records:
        sid = r.get("source_id", "unknown")
        by_source[sid] = by_source.get(sid, 0) + 1
        t = r.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1

    log = {
        "run_at": now_iso(),
        "harvest_count": len(harvest_data.get("events", [])),
        "aggregator_leaks_dropped": len(aggregator_drops),
        "final_count": len(final_records),
        "by_source": sorted([{"id": k, "count": v} for k, v in by_source.items()],
                            key=lambda x: -x["count"]),
        "by_type": sorted([{"type": k, "count": v} for k, v in by_type.items()],
                          key=lambda x: -x["count"]),
        "aggregator_leak_examples": aggregator_drops[:5],
    }
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = HISTORY_DIR / f"festivals-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"
    snapshot.write_text(
        json.dumps({"generated_at": now_iso(), "count": len(final_records),
                    "events": final_records}, indent=2),
        encoding="utf-8",
    )


def main():
    print("=== merge_festivals ===")

    harvest_data = load_harvest()
    harvest_records = harvest_data.get("events", [])
    print(f"harvest:           {len(harvest_records)} records")

    discovery_only_hosts, blocked_exact_urls = load_aggregator_guard()
    print(f"leak guard:        {len(discovery_only_hosts)} discovery-only hosts, "
          f"{len(blocked_exact_urls)} exact-URL blocks")

    clean_harvest, dropped = enforce_no_aggregator_leak(
        harvest_records, discovery_only_hosts, blocked_exact_urls
    )
    print(f"after leak-guard:  {len(clean_harvest)} kept, {len(dropped)} dropped")
    if dropped:
        for d in dropped[:5]:
            print(f"  LEAK DROPPED: '{d['title'][:50]}' source={d['source_url']}")

    date_clean, date_dropped = enforce_date_sanity(clean_harvest, max_days_ahead=365)
    print(f"after date-sanity: {len(date_clean)} kept, {len(date_dropped)} dropped")
    if date_dropped:
        for d in date_dropped[:5]:
            print(f"  DATE DROPPED: '{d['title'][:40]}' {d['date']} ({d['reason']})")
    clean_harvest = date_clean

    manual_records = load_manual_festivals()
    print(f"manual festivals:  {len(manual_records)} records")

    merged = normalize_festival_parents(merge(clean_harvest, manual_records))
    print(f"merged:            {len(merged)} records after dedup")

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    errors = validate(merged, schema)
    if errors:
        print("FATAL: schema validation failed:", file=sys.stderr)
        for err in errors[:20]:
            print(err, file=sys.stderr)
        if len(errors) > 20:
            print(f"  ... and {len(errors)-20} more", file=sys.stderr)
        sys.exit(1)
    print("schema validation: OK")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "$schema_ref": "/data/seminars-schema.json",
        "generated_at": now_iso(),
        "count": len(merged),
        "events": merged,
    }
    OUT_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"wrote {OUT_PATH}")

    write_rss(merged)
    print(f"wrote {RSS_PATH}")

    write_log(harvest_data, merged, dropped)
    print(f"wrote {LOG_PATH} + history snapshot")

    # The former split festival feed is retained as an audit artefact, while
    # every validated festival record is published into polymythcalendar.
    # This prevents the festival workflow from succeeding without updating
    # the calendar visitors and crawlers actually receive.
    import subprocess as _subprocess
    for command in [
        ["node", str(ROOT / "scripts" / "merge-festival-harvest-into-calendar.js")],
        ["node", str(ROOT / "scripts" / "sync-calendar-data.js")],
        ["node", str(ROOT / "scripts" / "build-search-pages.js")],
        ["node", str(ROOT / "scripts" / "build-writing-shortcuts.js")],
    ]:
        result = _subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            print(f"FATAL: calendar publication command failed: {' '.join(command)}", file=sys.stderr)
            sys.exit(result.returncode)
    print("=== done ===")


if __name__ == "__main__":
    main()
