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
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("FATAL: jsonschema not installed. pip install jsonschema", file=sys.stderr)
    sys.exit(1)

from polymythcal_adapters import (
    event_identity_aliases,
    event_occurrence_key,
    records_represent_same_occurrence,
)
from polymythcal_source_health import source_health_gate_error

ROOT = Path(__file__).resolve().parent.parent
HARVEST_PATH = Path("/tmp/seminars-output.json")
_DETERMINISTIC_PROTEST_VALUE = os.environ.get(
    "POLYMYTHCAL_DETERMINISTIC_PROTEST_PATH",
    "/tmp/polymythcal-protests.json",
)
DETERMINISTIC_PROTEST_PATH = (
    Path(_DETERMINISTIC_PROTEST_VALUE)
    if _DETERMINISTIC_PROTEST_VALUE
    else None
)
DETERMINISTIC_STRUCTURED_PATH = Path("/tmp/polymythcal-structured.json")
MANUAL_PATH = ROOT / "data" / "manual-events.json"
SCHEMA_PATH = ROOT / "data" / "seminars-schema.json"
OUT_PATH = ROOT / "seminars" / "events.json"
RSS_PATH = ROOT / "seminars" / "feed.xml"
FESTIVALS_OUT_PATH = ROOT / "festivals" / "events.json"
FESTIVALS_RSS_PATH = ROOT / "festivals" / "feed.xml"
LOG_PATH = ROOT / "data" / "scrape-log.json"
WATCHLIST_PATH = ROOT / "data" / "event-watchlist.json"
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


def merge_source_yield_telemetry(existing_rows, deterministic_rows, stream):
    """Keep one top-level row per source while retaining both crawl stages."""
    combined = [dict(row) for row in (existing_rows or []) if isinstance(row, dict)]
    positions = {
        str(row.get("source_id") or ""): index
        for index, row in enumerate(combined)
        if str(row.get("source_id") or "")
    }
    for raw in deterministic_rows or []:
        if not isinstance(raw, dict):
            continue
        source_id = str(raw.get("source_id") or "")
        if not source_id:
            continue
        observation = dict(raw)
        observation["stream"] = stream
        if source_id not in positions:
            row = dict(raw)
            row["stage"] = "deterministic"
            row["deterministic_stream"] = stream
            combined.append(row)
            positions[source_id] = len(combined) - 1
            continue
        index = positions[source_id]
        paid = combined[index]
        observations = list(paid.get("deterministic_observations") or [])
        observations.append(observation)
        paid_status = str(paid.get("status") or "")
        if paid_status == "skipped-deterministic-success":
            merged = {**paid, **raw}
            merged["paid_agent_status"] = paid_status
            merged["stage"] = "deterministic"
        else:
            merged = dict(paid)
            merged["stage"] = "paid-agent+deterministic"
        merged["deterministic_observations"] = observations
        combined[index] = merged
    return combined


def merge_deterministic_protests(harvest_data):
    """Fold the deterministic no-shard protest stage into the agent harvest.

    Incomplete dated announcements stay in ``events`` with native unconfirmed
    metadata. They are never diverted to the legacy hidden watchlist.
    """
    if DETERMINISTIC_PROTEST_PATH is None or not DETERMINISTIC_PROTEST_PATH.exists():
        return harvest_data
    try:
        deterministic = json.loads(
            DETERMINISTIC_PROTEST_PATH.read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"FATAL: deterministic protest harvest is unreadable: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)
    if deterministic.get("sharded") is not False:
        print("FATAL: deterministic protest harvest must declare sharded=false", file=sys.stderr)
        sys.exit(1)
    gate_error = source_health_gate_error(
        deterministic,
        stream_label="deterministic protest",
        expected_stream="deterministic-protests",
        expected_scope="all-enabled-protest-sources-unsharded",
    )
    if gate_error:
        print(f"FATAL: {gate_error}", file=sys.stderr)
        sys.exit(1)
    result = dict(harvest_data)
    result["events"] = list(harvest_data.get("events") or []) + list(
        deterministic.get("events") or []
    )
    result["source_yields"] = merge_source_yield_telemetry(
        harvest_data.get("source_yields") or [],
        deterministic.get("source_yields") or [],
        "deterministic-protests",
    )
    result["deterministic_protest_summary"] = deterministic.get("summary") or {}
    return result


def merge_deterministic_structured_events(harvest_data):
    """Add priority structured-source records without replacing any stream."""
    if not DETERMINISTIC_STRUCTURED_PATH.exists():
        return harvest_data
    try:
        deterministic = json.loads(
            DETERMINISTIC_STRUCTURED_PATH.read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"FATAL: deterministic structured harvest is unreadable: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)
    gate_error = source_health_gate_error(
        deterministic,
        stream_label="deterministic structured",
        expected_stream="deterministic-structured-events",
        expected_scope="priority-plus-rotating-deterministic-non-protest",
    )
    if gate_error:
        print(f"FATAL: {gate_error}", file=sys.stderr)
        sys.exit(1)
    result = dict(harvest_data)
    result["events"] = list(harvest_data.get("events") or []) + list(
        deterministic.get("events") or []
    )
    result["source_yields"] = merge_source_yield_telemetry(
        harvest_data.get("source_yields") or [],
        deterministic.get("source_yields") or [],
        "deterministic-structured-events",
    )
    result["deterministic_structured_summary"] = deterministic.get("summary") or {}
    return result


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
        # Superseded manual seeds remain in the source file as an audit trail,
        # but must not be reintroduced after lifecycle reconciliation has
        # assigned them to a stronger canonical record.
        if entry.get("superseded_by"):
            continue
        try:
            dt = datetime.fromisoformat(entry["date"])
        except Exception:
            continue
        iso = dt.isoformat(timespec="minutes")
        record_id = entry.get("id") or make_id(entry.get("source_url", entry["title"]), iso, entry["title"])
        # Optional end_date
        end_iso = None
        if entry.get("end_date"):
            try:
                end_iso = datetime.fromisoformat(entry["end_date"]).isoformat(timespec="minutes")
            except Exception:
                end_iso = None
        record = {
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
        }
        for field in (
            "city", "province", "country", "corridor_zone", "timezone",
            "identity_key", "legacy_ids", "confirmation_status",
            "qualification_reasons", "record_kind", "date_precision",
            "time_precision", "source_quality", "source_language",
            "platform_adapter", "organizer", "lifecycle_status",
            "missing_count", "writing_bands", "academic_bands", "subjects",
            "genres", "eligibility_region", "opportunity_kind",
            "application_url", "registration_url", "submission_url",
            "rules_url", "deadline_confidence", "source_notes", "topics",
            "tags", "source_name", "source_languages",
            "source_language_method", "source_language_review",
            "lifecycle_notes", "recurrence_note", "previous_dates",
            "date_change_reason",
        ):
            if entry.get(field) is not None:
                record[field] = entry[field]
        records.append(record)
    return records


def _is_midnight(dstr):
    return "T00:00" in str(dstr)


def _url_specificity(url):
    return (str(url).count("/") + len(str(url))) if url else 0


def _same_exact_event(left, right):
    if normalize_title(left.get("title", "")) != normalize_title(right.get("title", "")):
        return False
    try:
        left_date = datetime.fromisoformat(str(left.get("date") or "").replace("Z", "+00:00"))
        right_date = datetime.fromisoformat(str(right.get("date") or "").replace("Z", "+00:00"))
        if left_date != right_date:
            return False
    except (TypeError, ValueError):
        if str(left.get("date") or "") != str(right.get("date") or ""):
            return False
    left_venue = re.sub(r"\W+", "", str(left.get("venue") or "").lower())
    right_venue = re.sub(r"\W+", "", str(right.get("venue") or "").lower())
    return bool(left_venue and left_venue == right_venue)


def _fold(into, order, rec):
    """Fold only the same occurrence; preserve same-title same-day sessions."""
    rec = dict(rec)
    rec.setdefault("identity_aliases", event_identity_aliases(rec))
    rec.setdefault("occurrence_key", event_occurrence_key(rec))
    if not rec.get("identity_key") or rec["identity_key"] in rec["identity_aliases"]:
        rec["identity_key"] = rec["occurrence_key"]
    key = ("occurrence", str(rec["occurrence_key"]))
    if key not in into:
        compatible = next(
            (
                existing_key
                for existing_key, existing in into.items()
                if records_represent_same_occurrence(existing, rec)
                or _same_exact_event(existing, rec)
            ),
            None,
        )
        if compatible is None:
            into[key] = rec
            order.append(key)
            return
        key = compatible
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
    base["identity_aliases"] = list(dict.fromkeys(
        list(base.get("identity_aliases") or event_identity_aliases(base))
        + list(rec.get("identity_aliases") or event_identity_aliases(rec))
    ))


def merge(harvest_records, manual_records):
    """One event, one record. Manual wins base fields; collisions union types.
    Dedupes exact or compatible representations without collapsing distinct
    sessions that merely share a title and calendar day."""
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


def write_watchlist(harvest_data, final_records=None):
    """Persist only leads that still lack a real event date.

    Dated announcements with missing time or location belong in the main
    chronology as native unconfirmed records.
    """
    items = harvest_data.get("watchlist", [])
    if not isinstance(items, list):
        items = []
    existing = []
    if WATCHLIST_PATH.exists():
        try:
            prior = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
            if isinstance(prior.get("items"), list):
                existing = prior["items"]
        except Exception:
            existing = []

    def wl_key(item):
        return item.get("source_url") or f"{item.get('source_id','')}::{item.get('title','')}::{item.get('date','') or item.get('date_text','')}"

    published = set()
    for event in (final_records or harvest_data.get("events", [])):
        published.add(wl_key(event))

    merged = {}
    for item in existing + items:
        key = wl_key(item)
        if not key or key in published:
            continue
        if item.get("date"):
            continue
        merged[key] = item
    out_items = sorted(merged.values(), key=lambda x: x.get("date", "") or x.get("date_text", ""))
    payload = {
        "generated_at": now_iso(),
        "count": len(out_items),
        "rule": "internal recheck state for leads without a real event date; dated announcements belong in the public chronology with exact qualification reasons",
        "items": out_items,
    }
    WATCHLIST_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


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
    harvest_data = merge_deterministic_structured_events(
        merge_deterministic_protests(load_harvest())
    )
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
    write_watchlist(harvest_data, merged)
    print(f"wrote {LOG_PATH}, {WATCHLIST_PATH} + history snapshot")

    # PUBLIC CALENDAR INTEGRATION (June 29 2026). Earlier versions wrote the
    # seminar stream directly to /polymythseminars/events.json, which could
    # erase festival, contest, CFP, and manual records from the public calendar
    # after a successful seminars-only harvest. Upsert this stream into the
    # consolidated calendar instead, then refresh the public mirror, fallback,
    # static event pages, sitemap, and writing shortcut pages.
    import subprocess as _subprocess
    for command in [
        ["node", str(ROOT / "scripts" / "merge-seminar-harvest-into-calendar.js")],
        [sys.executable, str(ROOT / "scripts" / "finalize-polymythcal-publication.py")],
    ]:
        result = _subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            print(f"FATAL: calendar publication command failed: {' '.join(command)}", file=sys.stderr)
            sys.exit(result.returncode)

    print("=== done ===")


if __name__ == "__main__":
    main()
