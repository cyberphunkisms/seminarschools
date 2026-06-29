#!/usr/bin/env python3
"""
merge_and_finalize.py

Reads /tmp/seminars-output.json (Claude's harvest), merges with
/data/manual-events.json (Saul's hand-curated overrides), deduplicates,
validates against /data/seminars-schema.json, writes /seminars/events.json
and /seminars/feed.xml, updates /data/scrape-log.json and the dated
history snapshot.

Manual events take precedence over scraped duplicates by
(normalized_title, date_rounded_to_hour).
"""

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("FATAL: jsonschema not installed. pip install jsonschema", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
HARVEST_PATH = Path("/tmp/seminars-output.json")
MANUAL_PATH = ROOT / "data" / "manual-events.json"
SCHEMA_PATH = ROOT / "data" / "seminars-schema.json"
OUT_PATH = ROOT / "seminars" / "events.json"
RSS_PATH = ROOT / "seminars" / "feed.xml"
FESTIVALS_OUT_PATH = ROOT / "festivals" / "events.json"
FESTIVALS_RSS_PATH = ROOT / "festivals" / "feed.xml"
LOG_PATH = ROOT / "data" / "scrape-log.json"
PUBLIC_PATH = ROOT / "polymythseminars" / "events.json"
DATA_MASTER_PATH = ROOT / "data" / "polymyth-seminar-events.json"
HISTORY_DIR = ROOT / "data" / "history"

# Festival-type values per polymyth-broadened seminar test
FESTIVAL_TYPES = {"festival", "festival-of-form", "cultural-reproduction", "site-specific-art"}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def make_id(source_url, iso_date, title=""):
    """SHA-1 hash of source_url + ISO date + title (for uniqueness when
    multiple events share the same source_url and start date, as with
    a single source page listing many productions)."""
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


def load_harvest():
    if not HARVEST_PATH.exists():
        print(f"ERROR: harvest file {HARVEST_PATH} missing", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(HARVEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: harvest JSON malformed: {e}", file=sys.stderr)
        sys.exit(1)


def load_manual():
    """Read manual-events.json and convert each entry to the schema shape."""
    if not MANUAL_PATH.exists():
        return []
    try:
        data = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    records = []
    for entry in data.get("events", []):
        try:
            dt = datetime.fromisoformat(entry["date"])
        except Exception:
            continue
        iso = dt.isoformat(timespec="minutes")
        record_id = make_id(entry.get("source_url", entry["title"]), iso, entry["title"])
        # Optional end_date
        end_iso = None
        if entry.get("end_date"):
            try:
                end_iso = datetime.fromisoformat(entry["end_date"]).isoformat(timespec="minutes")
            except Exception:
                end_iso = None
        records.append({
            "id": record_id,
            "date": iso,
            "end_date": end_iso,
            "title": entry["title"],
            "venue": entry.get("venue", "Toronto"),
            "source_url": entry.get("source_url", "https://seminarschools.com/seminars/"),
            "source_id": entry.get("source_id", "manual-curated"),
            "type": entry.get("type", "lecture"),
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


def _is_midnight(dstr):
    return "T00:00" in str(dstr)


def _url_specificity(url):
    return (str(url).count("/") + len(str(url))) if url else 0


def _fold(into, order, rec):
    """Fold one record into the keyed map, keyed on (title, calendar day).
    Unions types on collision and upgrades the base toward the richest values."""
    key = (normalize_title(rec["title"]), str(rec.get("date", ""))[:10])
    if key not in into:
        into[key] = dict(rec)
        order.append(key)
        return
    base = into[key]
    sec = list(base.get("secondary_types") or [])
    for t in [rec.get("type")] + list(rec.get("secondary_types") or []):
        if t and t != base.get("type") and t not in sec:
            sec.append(t)
    base["secondary_types"] = sec
    if _is_midnight(base.get("date", "")) and not _is_midnight(rec.get("date", "")):
        base["date"] = rec["date"]
    if not base.get("end_date") and rec.get("end_date"):
        base["end_date"] = rec["end_date"]
    if not base.get("speaker_or_director") and rec.get("speaker_or_director"):
        base["speaker_or_director"] = rec["speaker_or_director"]
    if not base.get("parent_id") and rec.get("parent_id"):
        base["parent_id"] = rec["parent_id"]
    if rec.get("is_parent_festival"):
        base["is_parent_festival"] = True
    if len(str(rec.get("venue") or "")) > len(str(base.get("venue") or "")):
        base["venue"] = rec["venue"]
    if _url_specificity(rec.get("source_url")) > _url_specificity(base.get("source_url")):
        base["source_url"] = rec["source_url"]
    if not base.get("age_band") and rec.get("age_band"):
        base["age_band"] = rec["age_band"]


def merge(harvest_records, manual_records):
    """One event, one record. Manual wins base fields; collisions union types.
    Dedupes within each input as well as across them, keyed on
    (normalized_title, date_rounded_to_hour)."""
    into, order = {}, []
    for r in manual_records:
        _fold(into, order, r)
    for r in harvest_records:
        _fold(into, order, r)
    merged = [into[k] for k in order]
    merged.sort(key=lambda r: r["date"])
    return merged


def normalize_festival_parents(records):
    """One parent season always uses type=fes​tival; prior subtype remains searchable."""
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


def to_rfc822(iso_str):
    """Convert ISO 8601 datetime string to RFC 822 (required by RSS 2.0).
    Returns empty string if input is unparseable."""
    if not iso_str:
        return ""
    try:
        d = datetime.fromisoformat(iso_str)
    except (ValueError, TypeError):
        return ""
    # RFC 822 format: "Sun, 15 Nov 2026 19:30:00 -0500"
    # %z gives +HHMM but RFC 822 wants +HHMM (which is what Python produces) — OK
    return d.strftime("%a, %d %b %Y %H:%M:%S %z")


def write_rss(records, out_path=None, channel_title=None, channel_link=None, channel_desc=None):
    """Minimal RSS 2.0 feed. Newest first.
    Defaults to seminars feed; pass arguments to retarget for festivals."""
    out_path = out_path or RSS_PATH
    channel_title = channel_title or "Seminar Schools — Toronto Events"
    channel_link = channel_link or "https://seminarschools.com/seminars/"
    channel_desc = channel_desc or "Upcoming lectures, screenings, panels, readings."
    items = sorted(records, key=lambda r: r["date"], reverse=True)
    rss_items = []
    for r in items[:50]:
        title = xml_escape(r["title"] or "Untitled")
        link = xml_escape(r["source_url"])
        # Synthesize description from venue if raw_excerpt is missing — empty
        # description fields break some RSS readers and lose all context.
        desc_text = r.get("raw_excerpt") or ""
        if not desc_text and r.get("venue"):
            desc_text = f"At {r['venue']}."
        desc = xml_escape(desc_text)
        pub_rfc822 = to_rfc822(r["date"])
        rss_items.append(
            f"<item><title>{title}</title><link>{link}</link>"
            f"<pubDate>{pub_rfc822}</pubDate><guid isPermaLink=\"false\">{r['id']}</guid>"
            f"<description>{desc}</description></item>"
        )
    feed = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?xml-stylesheet type="text/xsl" href="/polymythseminars/feed.xsl"?>\n'
        '<rss version="2.0"><channel>'
        f'<title>{xml_escape(channel_title)}</title>'
        f'<link>{xml_escape(channel_link)}</link>'
        f'<description>{xml_escape(channel_desc)}</description>'
        f'<lastBuildDate>{to_rfc822(now_iso())}</lastBuildDate>'
        + "".join(rss_items)
        + '</channel></rss>'
    )
    out_path.write_text(feed, encoding="utf-8")


def write_log(harvest_data, final_records):
    """Per-source counts. Today's snapshot."""
    by_source = {}
    for r in final_records:
        sid = r.get("source_id", "unknown")
        by_source[sid] = by_source.get(sid, 0) + 1

    # Fail-loud source accounting (June 11 2026). The harvest output carries
    # a source_yields table covering EVERY rostered source. Reproduce it in
    # the public log, derive the zero-yield worklist, and cross-check it
    # against sources.json so an omitted source is itself surfaced.
    source_yields = harvest_data.get("source_yields", [])
    roster_ids = []
    try:
        roster = json.loads((ROOT / "scripts" / "sources.json").read_text(encoding="utf-8"))
        roster_ids = [s["id"] for s in roster.get("sources", [])]
    except Exception:
        pass
    accounted = {y.get("source_id") for y in source_yields}
    unaccounted = [sid for sid in roster_ids if sid not in accounted]
    zero_yield = [
        y["source_id"] for y in source_yields
        if y.get("status") == "crawled" and not y.get("events")
    ]
    log = {
        "run_at": now_iso(),
        "harvest_count": len(harvest_data.get("events", [])),
        "manual_count": sum(1 for r in final_records if r["review_status"] == "manual"),
        "final_count": len(final_records),
        "by_source": [{"id": k, "count": v} for k, v in sorted(by_source.items())],
        "roster_size": len(roster_ids),
        "source_yields": source_yields,
        "zero_yield_sources": zero_yield,
        "unaccounted_sources": unaccounted,
    }
    if unaccounted:
        print(f"WARNING: {len(unaccounted)} rostered sources missing from "
              f"harvest source_yields accounting: {unaccounted[:10]}...")
    if zero_yield:
        print(f"Zero-yield sources this run ({len(zero_yield)}): {zero_yield[:15]}")
    LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = HISTORY_DIR / f"seminars-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"
    snapshot.write_text(
        json.dumps({"generated_at": now_iso(), "count": len(final_records), "events": final_records}, indent=2),
        encoding="utf-8",
    )


def main():
    print("=== merge_and_finalize ===")
    harvest_data = load_harvest()
    harvest_records = harvest_data.get("events", [])
    print(f"harvest: {len(harvest_records)} records")

    manual_records = load_manual()
    print(f"manual:  {len(manual_records)} records")

    merged = normalize_festival_parents(merge(harvest_records, manual_records))
    print(f"merged:  {len(merged)} records after dedup")

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

    output = {
        "$schema_ref": "/data/seminars-schema.json",
        "generated_at": now_iso(),
        "count": len(merged),
        "events": merged,
    }
    OUT_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"wrote {OUT_PATH}")

    # Festivals consolidated into the single polymythcalendar (June 2026).
    # The standalone /festivals/ page and its split feed were retired; festival-type
    # events now live in the one calendar and ship in the main feed below.

    write_rss(merged)
    print(f"wrote {RSS_PATH}")

    write_log(harvest_data, merged)
    print(f"wrote {LOG_PATH} + history snapshot")

    # PUBLIC CALENDAR INTEGRATION (June 29 2026). Earlier versions wrote the
    # seminar stream directly to /polymythseminars/events.json, which could
    # erase festival, contest, CFP, and manual records from the public calendar
    # after a successful seminars-only harvest. Upsert this stream into the
    # consolidated calendar instead, then refresh the public mirror, fallback,
    # static event pages, sitemap, and writing shortcut pages.
    import subprocess as _subprocess
    for command in [
        ["node", str(ROOT / "scripts" / "merge-seminar-harvest-into-calendar.js")],
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
