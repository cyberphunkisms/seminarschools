#!/usr/bin/env python3
"""Run Audit 48 calendar-client regressions and emit deterministic evidence."""
from __future__ import annotations

import io
import json
import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

import icalendar
from icalendar import Calendar


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "scripts/reports/audit48-calendar-client-interoperability.json"


def write_if_changed(path: Path, content: str) -> None:
    encoded = content.encode("utf-8")
    if not path.exists() or path.read_bytes() != encoded:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encoded)
    stamp = os.environ.get("SS_REPORT_OUTPUT_MTIME")
    if stamp:
        moment = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        os.utime(path, (moment.timestamp(), moment.timestamp()))


def test_ids(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from test_ids(item)
        else:
            yield item.id()


def main() -> int:
    sys.path.insert(0, str(ROOT))
    from scripts import test_polymythcal_calendar_clients as tests

    suite = unittest.defaultTestLoader.loadTestsFromModule(tests)
    names = list(test_ids(suite))
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    transcript = stream.getvalue()
    print(transcript, end="")

    payload = json.loads(
        (ROOT / "data/polymyth-seminar-events.json").read_text(encoding="utf-8")
    )
    browse = json.loads(
        (ROOT / "polymythseminars/browse.json").read_text(encoding="utf-8")
    )
    watchlist = json.loads(
        (ROOT / "polymythseminars/watchlist.json").read_text(encoding="utf-8")
    )
    surfaces = json.loads(
        (ROOT / "data/polymythcal-publication-surfaces.json").read_text(encoding="utf-8")
    )
    canonical_events = payload["events"]
    canonical_by_id = {str(event["id"]): event for event in canonical_events}
    chronology_ids = [str(value) for value in surfaces["chronology_ids"]]
    monitoring_ids = [str(value) for value in surfaces["watchlist_ids"]]
    events = [canonical_by_id[event_id] for event_id in chronology_ids]
    monitoring_events = [canonical_by_id[event_id] for event_id in monitoring_ids]
    aliases = {
        str(alias): str(event.get("id") or event.get("identity_key"))
        for event in events
        for alias in (event.get("legacy_ids") or [])
    }
    event_files = sorted((ROOT / "polymythseminars/ics").glob("*.ics"))
    feed_files = sorted((ROOT / "polymythseminars/feeds").glob("*.ics"))
    files = event_files + feed_files
    component_count = 0
    max_line_octets = 0
    feed_uids: set[str] = set()
    for path in files:
        raw = path.read_bytes()
        max_line_octets = max(
            max_line_octets,
            *(len(line) for line in raw.split(b"\r\n")[:-1]),
        )
        calendar = Calendar.from_ical(raw)
        components = [component for component in calendar.walk() if component.name == "VEVENT"]
        component_count += len(components)
        if path.parent.name == "feeds":
            feed_uids.update(str(component.get("UID")) for component in components)

    monitoring_ics_ids: set[str] = set(monitoring_ids)
    monitoring_english_route_ids: set[str] = set()
    monitoring_french_route_ids: set[str] = set(monitoring_ids)
    monitoring_uids: set[str] = set()
    for event in monitoring_events:
        event_id = str(event["id"])
        monitoring_uids.add(f'{event.get("identity_key") or event_id}@seminarschools.com')
        monitoring_english_route_ids.update((event_id, tests.hashed_legacy_alias(event_id)))
        for alias in event.get("legacy_ids") or []:
            alias_id = str(alias)
            monitoring_ics_ids.add(alias_id)
            monitoring_english_route_ids.update((alias_id, tests.hashed_legacy_alias(alias_id)))
            monitoring_french_route_ids.add(alias_id)
    monitoring_ics_leaks = sum(
        path.exists()
        for route_id in monitoring_ics_ids
        for path in (
            ROOT / f"polymythseminars/ics/{route_id}.ics",
            ROOT / f"public/polymythseminars/ics/{route_id}.ics",
        )
    )
    monitoring_route_leaks = sum(
        path.exists()
        for route_id in monitoring_english_route_ids
        for path in (
            ROOT / f"polymythseminars/events/{route_id}/index.html",
            ROOT / f"public/polymythseminars/events/{route_id}/index.html",
        )
    ) + sum(
        path.exists()
        for route_id in monitoring_french_route_ids
        for path in (
            ROOT / f"polymythseminars/fr/events/{route_id}/index.html",
            ROOT / f"public/polymythseminars/fr/events/{route_id}/index.html",
        )
    )
    monitoring_feed_uid_leaks = len(monitoring_uids & feed_uids)

    failed_names = {
        case.id()
        for case, _ in [*result.failures, *result.errors]
    }
    checks = [
        {"name": name.rsplit(".", 1)[-1], "passed": name not in failed_names}
        for name in names
    ]
    release = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    report = {
        "schema": "seminar-schools-audit48-calendar-client-interoperability-v1",
        "audit": "Audit 48 calendar-client interoperability",
        "generated_at": release.get("generated_at"),
        "release_id": release.get("release_id"),
        "status": "pass" if result.wasSuccessful() else "fail",
        "checks": checks,
        "metrics": {
            "tests_passed": result.testsRun - len(result.failures) - len(result.errors),
            "tests_run": result.testsRun,
            "canonical_events": len(canonical_events),
            "chronology_events": len(events),
            "quarantined_monitoring_records": len(monitoring_events),
            "browse_records": len(browse.get("events", [])),
            "watchlist_records": len(watchlist.get("items", [])),
            "monitoring_ics_leaks": monitoring_ics_leaks,
            "monitoring_detail_or_alias_route_leaks": monitoring_route_leaks,
            "monitoring_feed_uid_leaks": monitoring_feed_uid_leaks,
            "explicit_legacy_ics_aliases": len(aliases),
            "single_event_ics_files": len(event_files),
            "focused_and_historical_feed_ics_files": len(feed_files),
            "total_ics_files": len(files),
            "independently_parsed_vevent_components": component_count,
            "maximum_physical_line_octets": max_line_octets,
            "independent_parser": f"icalendar {icalendar.__version__}",
        },
        "verified_clients": {
            "google_calendar": "official import envelope plus RFC 5545 transport and semantic checks",
            "apple_calendar": "official .ics import format plus RFC 5545 transport and semantic checks",
            "outlook": "official .ics import/subscription format plus RFC 5545 transport, MIME, and semantic checks",
        },
        "primary_references": [
            "https://www.rfc-editor.org/rfc/rfc5545",
            "https://support.google.com/calendar/answer/37118?hl=en",
            "https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac",
            "https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c",
            "https://docs.netlify.com/manage/routing/headers/",
            "https://pypi.org/project/icalendar/7.2.0/",
        ],
        "actual_account_imports_remaining": [
            "Google Calendar desktop import of one exact-time event, one all-day event, one legacy event URL, and all.ics",
            "Apple Calendar on macOS import of the same four fixtures",
            "Outlook desktop or Outlook on the web import of the same four fixtures",
            "Google Calendar, Apple Calendar, and Outlook web-subscription refresh from the production feed URL after deployment",
        ],
        "limitations": (
            "Local validation proves standards conformance, independent parser acceptance, "
            "stable identity, exact source semantics, delivery metadata, and deterministic "
            "edge cases. Vendor UI import and remote refresh behavior require the actual "
            "calendar applications and deployed HTTPS responses."
        ),
    }
    write_if_changed(REPORT, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        f"AUDIT 48 CALENDAR CLIENTS — {report['metrics']['tests_passed']}/"
        f"{report['metrics']['tests_run']} tests passed; {len(files)} ICS files and "
        f"{component_count} VEVENT components parsed with {report['metrics']['independent_parser']}."
    )
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())

