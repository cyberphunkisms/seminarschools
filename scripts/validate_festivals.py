#!/usr/bin/env python3
"""
validate_festivals.py

Post-merge gate. Confirms /festivals/events.json passes schema and that no
record's source_url leaks an aggregator URL. Two-tier guard:
  Tier A: discovery-only hostnames blocked outright
  Tier B: collision hosts (e.g. toronto.ca) blocked only on exact listed
          aggregator URLs; specific sub-pages on same host are kept
"""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("FATAL: jsonschema not installed.", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
EVENTS_PATH = ROOT / "festivals" / "events.json"
SCHEMA_PATH = ROOT / "data" / "seminars-schema.json"
SOURCES_PATH = ROOT / "scripts" / "festivals-sources.json"


def host_of(url):
    try:
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""


def main():
    if not EVENTS_PATH.exists():
        print(f"FATAL: {EVENTS_PATH} missing", file=sys.stderr)
        sys.exit(1)

    data = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
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

    validator = Draft7Validator(schema)
    events = data.get("events", [])
    schema_errors = []
    leak_errors = []
    for i, record in enumerate(events):
        for e in validator.iter_errors(record):
            schema_errors.append(f"  record[{i}] ({record.get('title','?')[:40]}): {e.message}")
        url = (record.get("source_url") or "").rstrip("/")
        src_host = host_of(url)
        if src_host in discovery_only_hosts:
            leak_errors.append(f"  record[{i}] ({record.get('title','?')[:40]}): "
                               f"discovery-only host '{src_host}'")
        elif url in blocked_exact_urls:
            leak_errors.append(f"  record[{i}] ({record.get('title','?')[:40]}): "
                               f"URL exact-matches a listed aggregator entry")

    if schema_errors:
        print(f"FATAL: {len(schema_errors)} schema errors in {EVENTS_PATH}", file=sys.stderr)
        for err in schema_errors[:20]:
            print(err, file=sys.stderr)
        sys.exit(1)
    if leak_errors:
        print(f"FATAL: {len(leak_errors)} aggregator-source leaks", file=sys.stderr)
        for err in leak_errors[:20]:
            print(err, file=sys.stderr)
        sys.exit(1)

    print(f"OK: {len(events)} festival records, all schema-valid, no aggregator leaks")
    sys.exit(0)


if __name__ == "__main__":
    main()
