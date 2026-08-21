#!/usr/bin/env python3
"""RFC 5545 and calendar-client interoperability regressions for Polymythcal."""
from __future__ import annotations

import importlib.util
import json
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time as time_module
import unittest
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from icalendar import Calendar


ROOT = Path(__file__).resolve().parents[1]
TORONTO = ZoneInfo("America/Toronto")
INVENTORY_CONTRACT = json.loads(
    (ROOT / "data" / "polymythcal-inventory-contract.json").read_text(encoding="utf-8")
)
MINIMUM_CANONICAL_EVENTS = int(INVENTORY_CONTRACT["minimum_canonical_events"])
EXPECTED_FEED_ICS_FILES = 12
ALLOWED_STATUSES = {"CONFIRMED", "TENTATIVE", "CANCELLED"}


def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def explicit_aliases(events):
    return {
        str(alias): str(event.get("id") or event.get("identity_key"))
        for event in events
        for alias in (event.get("legacy_ids") or [])
        if str(alias) != str(event.get("id") or event.get("identity_key"))
    }


def all_ics_files():
    return sorted((ROOT / "polymythseminars" / "ics").glob("*.ics")) + sorted(
        (ROOT / "polymythseminars" / "feeds").glob("*.ics")
    )


def parsed_events(path: Path):
    calendar = Calendar.from_ical(path.read_bytes())
    return calendar, [component for component in calendar.walk() if component.name == "VEVENT"]


def parse_source_datetime(value, timezone_name="America/Toronto"):
    if not value:
        return None
    text = str(value).strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return date.fromisoformat(text)
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        try:
            parsed = parsed.replace(tzinfo=ZoneInfo(timezone_name))
        except Exception:
            parsed = parsed.replace(tzinfo=TORONTO)
    return parsed


def load_feed_builder():
    path = ROOT / "scripts" / "build-polymythcal-feeds.py"
    scripts_path = str(path.parent)
    added_scripts_path = scripts_path not in sys.path
    if added_scripts_path:
        sys.path.insert(0, scripts_path)
    try:
        spec = importlib.util.spec_from_file_location("audit48_feed_builder", path)
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        return module
    finally:
        if added_scripts_path:
            sys.path.remove(scripts_path)


class CurrentCalendarCorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = load_json("polymythseminars/events.json")
        cls.events = cls.payload["events"]
        cls.by_id = {
            str(event.get("id") or event.get("identity_key")): event
            for event in cls.events
        }
        cls.aliases = explicit_aliases(cls.events)
        cls.manifest = load_json("polymythseminars/feeds/index.json")["feeds"]

    def test_current_and_legacy_inventory_is_exact(self):
        canonical_names = set(self.by_id)
        expected_event_names = canonical_names | set(self.aliases)
        actual_event_names = {
            path.stem for path in (ROOT / "polymythseminars" / "ics").glob("*.ics")
        }
        expected_feed_names = {str(feed["id"]) for feed in self.manifest} | {"deadlines"}
        actual_feed_names = {
            path.stem for path in (ROOT / "polymythseminars" / "feeds").glob("*.ics")
        }

        self.assertGreaterEqual(len(self.events), MINIMUM_CANONICAL_EVENTS)
        self.assertEqual(actual_event_names, expected_event_names)
        self.assertEqual(len(actual_event_names), len(self.events) + len(self.aliases))
        self.assertEqual(actual_feed_names, expected_feed_names)
        self.assertEqual(len(actual_feed_names), EXPECTED_FEED_ICS_FILES)
        self.assertEqual(
            len(all_ics_files()),
            len(self.events) + len(self.aliases) + EXPECTED_FEED_ICS_FILES,
        )

    def test_every_file_has_strict_rfc5545_transport_framing(self):
        for path in all_ics_files():
            with self.subTest(path=path.relative_to(ROOT)):
                raw = path.read_bytes()
                self.assertFalse(raw.startswith(b"\xef\xbb\xbf"), "UTF-8 BOM is forbidden")
                self.assertEqual(raw.decode("utf-8").encode("utf-8"), raw)
                self.assertTrue(raw.startswith(b"BEGIN:VCALENDAR\r\n"))
                self.assertTrue(raw.endswith(b"END:VCALENDAR\r\n"))
                without_crlf = raw.replace(b"\r\n", b"")
                self.assertNotIn(b"\r", without_crlf)
                self.assertNotIn(b"\n", without_crlf)
                for number, line in enumerate(raw.split(b"\r\n")[:-1], 1):
                    self.assertLessEqual(
                        len(line),
                        75,
                        f"physical line {number} is {len(line)} octets",
                    )
                    self.assertNotIn(b"\x00", line)

    def test_independent_parser_accepts_and_roundtrips_every_file(self):
        parsed_component_count = 0
        for path in all_ics_files():
            with self.subTest(path=path.relative_to(ROOT)):
                calendar, events = parsed_events(path)
                self.assertEqual(str(calendar.get("VERSION")), "2.0")
                self.assertTrue(str(calendar.get("PRODID")))
                self.assertEqual(str(calendar.get("METHOD")), "PUBLISH")
                self.assertGreater(len(events), 0)
                parsed_component_count += len(events)

                reparsed = Calendar.from_ical(calendar.to_ical())
                self.assertEqual(
                    len([item for item in reparsed.walk() if item.name == "VEVENT"]),
                    len(events),
                )
                for event in events:
                    for required in ("UID", "DTSTAMP", "DTSTART", "SUMMARY"):
                        self.assertIsNotNone(event.get(required), required)
                    uid = str(event.get("UID"))
                    self.assertLessEqual(len(uid.encode("utf-8")), 255)
                    self.assertTrue(uid.endswith("@seminarschools.com"))
                    self.assertIn(str(event.get("STATUS")), ALLOWED_STATUSES)
                    self.assertIsNone(event.get("ATTENDEE"))
                    self.assertIsNone(event.get("ORGANIZER"))

                    stamp = event.decoded("DTSTAMP")
                    self.assertIsInstance(stamp, datetime)
                    self.assertIsNotNone(stamp.tzinfo)
                    start = event.decoded("DTSTART")
                    end = event.decoded("DTEND") if event.get("DTEND") is not None else None
                    if isinstance(start, datetime):
                        self.assertIsNotNone(start.tzinfo)
                        self.assertEqual(start.utcoffset(), timedelta(0))
                        if end is not None:
                            self.assertIsInstance(end, datetime)
                            self.assertIsNotNone(end.tzinfo)
                            self.assertGreater(end, start)
                    else:
                        self.assertIsInstance(start, date)
                        if end is not None:
                            self.assertIsInstance(end, date)
                            self.assertNotIsInstance(end, datetime)
                            self.assertGreater(end, start)

                    event_url = urlsplit(str(event.get("URL")))
                    self.assertEqual(event_url.scheme, "https")
                    self.assertEqual(event_url.netloc, "seminarschools.com")
                    self.assertTrue(event_url.path.startswith("/polymythseminars/events/"))

        focused_components = sum(int(feed["count"]) for feed in self.manifest)
        deadlines_components = next(
            int(feed["count"])
            for feed in self.manifest
            if str(feed["id"]) == "opportunities"
        )
        expected_components = (
            len(self.events) + len(self.aliases)
            + focused_components
            + deadlines_components
        )
        self.assertEqual(parsed_component_count, expected_components)

    def test_canonical_single_event_files_match_source_semantics(self):
        ttc_parent = self.by_id["ttc-board-fall-2026"]
        self.assertEqual(ttc_parent.get("time_precision"), "not-applicable")
        self.assertEqual(
            str(ttc_parent.get("date"))[:10],
            str(ttc_parent.get("end_date"))[:10],
        )
        for event_id, source in self.by_id.items():
            path = ROOT / "polymythseminars" / "ics" / f"{event_id}.ics"
            with self.subTest(event_id=event_id):
                _, events = parsed_events(path)
                self.assertEqual(len(events), 1)
                item = events[0]
                self.assertEqual(
                    str(item.get("UID")),
                    f'{source.get("identity_key") or event_id}@seminarschools.com',
                )
                self.assertEqual(str(item.get("SUMMARY")), str(source.get("title") or "Untitled listing"))
                self.assertEqual(
                    str(item.get("URL")),
                    f"https://seminarschools.com/polymythseminars/events/{event_id}/",
                )
                expected_status = (
                    "CANCELLED"
                    if source.get("lifecycle_status") == "cancelled"
                    else "TENTATIVE"
                    if source.get("confirmation_status") != "confirmed"
                    else "CONFIRMED"
                )
                self.assertEqual(str(item.get("STATUS")), expected_status)

                actual_start = item.decoded("DTSTART")
                expected_start = parse_source_datetime(
                    source.get("date"), source.get("timezone") or "America/Toronto"
                )
                if source.get("time_precision") == "exact" and isinstance(expected_start, datetime):
                    self.assertEqual(actual_start, expected_start.astimezone(timezone.utc))
                else:
                    expected_day = expected_start.date() if isinstance(expected_start, datetime) else expected_start
                    self.assertEqual(actual_start, expected_day)

                actual_end = item.decoded("DTEND") if item.get("DTEND") is not None else None
                expected_end = parse_source_datetime(
                    source.get("end_date"), source.get("timezone") or "America/Toronto"
                )
                if expected_end is None:
                    self.assertIsNone(actual_end)
                elif source.get("time_precision") == "exact" and isinstance(expected_end, datetime):
                    self.assertEqual(actual_end, expected_end.astimezone(timezone.utc))
                else:
                    expected_day = expected_end.date() if isinstance(expected_end, datetime) else expected_end
                    self.assertEqual(actual_end, expected_day + timedelta(days=1))

    def test_explicit_legacy_files_preserve_canonical_identity_and_bytes(self):
        for alias, target in self.aliases.items():
            with self.subTest(alias=alias, target=target):
                legacy = ROOT / "polymythseminars" / "ics" / f"{alias}.ics"
                canonical = ROOT / "polymythseminars" / "ics" / f"{target}.ics"
                self.assertEqual(legacy.read_bytes(), canonical.read_bytes())
                _, events = parsed_events(legacy)
                self.assertEqual(len(events), 1)
                self.assertEqual(
                    str(events[0].get("URL")),
                    f"https://seminarschools.com/polymythseminars/events/{target}/",
                )

    def test_focused_feeds_match_manifest_predicates_and_stable_uids(self):
        builder = load_feed_builder()
        events = sorted(
            self.events,
            key=lambda event: (str(event.get("date") or ""), str(event.get("title") or "")),
        )
        for feed in self.manifest:
            feed_id = str(feed["id"])
            path = ROOT / "polymythseminars" / "feeds" / f"{feed_id}.ics"
            with self.subTest(feed=feed_id):
                calendar, components = parsed_events(path)
                expected = [event for event in events if builder.FOCUSES[feed_id][2](event)]
                expected_uids = [
                    f'{event.get("identity_key") or event.get("id")}@seminarschools.com'
                    for event in expected
                    if builder.event_time_lines(event)
                ]
                actual_uids = [str(component.get("UID")) for component in components]
                self.assertEqual(int(feed["count"]), len(expected))
                self.assertEqual(actual_uids, expected_uids)
                self.assertEqual(len(actual_uids), len(set(actual_uids)))
                self.assertTrue(str(calendar.get("X-WR-CALNAME")).startswith("Polymythcal"))
                self.assertEqual(str(calendar.get("X-WR-TIMEZONE")), "America/Toronto")

        self.assertEqual(
            (ROOT / "polymythseminars/feeds/deadlines.ics").read_bytes(),
            (ROOT / "polymythseminars/feeds/opportunities.ics").read_bytes(),
        )

    def test_http_and_link_contract_is_explicit_for_calendar_clients(self):
        headers = (ROOT / "_headers").read_text(encoding="utf-8")
        for route in ("/polymythseminars/ics/*.ics", "/polymythseminars/feeds/*.ics"):
            self.assertRegex(
                headers,
                re.escape(route) + r"\s+Content-Type:\s*text/calendar;\s*charset=utf-8",
            )
        dev_server = (ROOT / "scripts/dev-server.js").read_text(encoding="utf-8")
        self.assertIn("'.ics': 'text/calendar; charset=utf-8'", dev_server)
        public_builder = (ROOT / "scripts/build-public-deploy.js").read_text(encoding="utf-8")
        self.assertIn("'_headers'", public_builder)

        for event_id in self.by_id:
            expected = f'href="/polymythseminars/ics/{event_id}.ics"'
            for relative in (
                f"polymythseminars/events/{event_id}/index.html",
                f"polymythseminars/fr/events/{event_id}/index.html",
            ):
                html = (ROOT / relative).read_text(encoding="utf-8")
                self.assertIn('type="text/calendar"', html, relative)
                self.assertIn(expected, html, relative)

        for relative in (
            "polymythseminars/subscribe/index.html",
            "polymythseminars/fr/subscribe/index.html",
        ):
            html = (ROOT / relative).read_text(encoding="utf-8")
            self.assertEqual(html.count('type="text/calendar"'), len(self.manifest))
            for feed in self.manifest:
                self.assertIn(f'href="{feed["ics"]}"', html)

    def test_local_http_delivery_returns_calendar_mime_and_exact_bytes(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        server = subprocess.Popen(
            ["node", "scripts/dev-server.js", "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            ready = False
            for _ in range(50):
                if server.poll() is not None:
                    stderr = server.stderr.read() if server.stderr else ""
                    self.fail(f"preview server exited early: {stderr}")
                try:
                    with urlopen(f"http://127.0.0.1:{port}/polymythseminars/feeds/all.ics", timeout=1):
                        ready = True
                        break
                except OSError:
                    time_module.sleep(0.1)
            self.assertTrue(ready, "preview server did not become ready")

            canonical_id = sorted(self.by_id)[0]
            alias_id = sorted(self.aliases)[0]
            paths = (
                f"/polymythseminars/ics/{canonical_id}.ics",
                f"/polymythseminars/ics/{alias_id}.ics",
                "/polymythseminars/feeds/all.ics",
            )
            for relative in paths:
                with self.subTest(relative=relative):
                    request = Request(f"http://127.0.0.1:{port}{relative}", method="GET")
                    with urlopen(request, timeout=3) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(
                            response.headers.get_content_type(),
                            "text/calendar",
                        )
                        self.assertEqual(
                            response.headers.get_content_charset(),
                            "utf-8",
                        )
                        self.assertEqual(response.read(), (ROOT / relative.lstrip("/")).read_bytes())
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
            if server.stderr:
                server.stderr.close()


class CalendarBuilderEdgeCaseTests(unittest.TestCase):
    def test_builders_preserve_utf8_folding_dst_all_day_and_legacy_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            (root / "polymythseminars").mkdir()
            for relative in (
                "scripts/build-polymythcal-feeds.py",
                "scripts/build-polymythcal-audit13.py",
                "scripts/geometry_asset_version.py",
                "scripts/apply-sitewide-type-zoom-link.js",
                "data/geometry-route-contracts.json",
                "css/alive.css",
                "js/mandala.js",
                "js/indra.js",
            ):
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / relative, destination)
            (root / "RELEASE_MANIFEST.json").write_text(
                json.dumps(
                    {
                        "generated_at": "2026-07-26T12:00:00-04:00",
                        "polymythcal_asset_version": "20260726-audit48",
                    }
                ),
                encoding="utf-8",
            )
            timed = {
                "id": "unicode-dst-event",
                "identity_key": "unicode-dst-identity",
                "legacy_ids": ["unicode-legacy"],
                "date": "2026-03-08T01:30:00-05:00",
                "end_date": "2026-03-08T03:30:00-04:00",
                "date_precision": "exact",
                "time_precision": "exact",
                "timezone": "America/Toronto",
                "title": ("Événement 中文, point; slash\\ " * 12).strip(),
                "venue": "Salle Élan, étage 2; aile est",
                "city": "Montréal",
                "description": "Première ligne\rDeuxième ligne\nTroisième ligne, oui; chemin\\fin",
                "source_url": "https://example.test/event",
                "source_quality": "official",
                "source_language": "fr-CA",
                "confirmation_status": "confirmed",
                "qualification_reasons": [],
                "lifecycle_status": "active",
                "last_checked_at": "2026-07-26T12:00:00-04:00",
                "type": "lecture",
                "corridor_zone": "montreal",
            }
            all_day = {
                **timed,
                "id": "all-day-event",
                "identity_key": "all-day-identity",
                "legacy_ids": [],
                "date": "2026-08-01",
                "end_date": "2026-08-03",
                "time_precision": "date-only",
                "title": "Three-day event",
                "description": "All-day interval.",
                "source_language": "en-CA",
            }
            (root / "polymythseminars/events.json").write_text(
                json.dumps({"events": [timed, all_day]}, ensure_ascii=False),
                encoding="utf-8",
            )
            environment = {"SITE_BUILD_DATE": "2026-07-26"}
            for script in ("build-polymythcal-feeds.py", "build-polymythcal-audit13.py"):
                subprocess.run(
                    [sys.executable, str(root / "scripts" / script)],
                    cwd=root,
                    env={**__import__("os").environ, **environment},
                    check=True,
                    capture_output=True,
                    text=True,
                )

            for path in sorted((root / "polymythseminars").glob("**/*.ics")):
                raw = path.read_bytes()
                self.assertTrue(raw.endswith(b"END:VCALENDAR\r\n"), path)
                self.assertTrue(all(len(line) <= 75 for line in raw.split(b"\r\n")[:-1]), path)
                Calendar.from_ical(raw)

            canonical = root / "polymythseminars/ics/unicode-dst-event.ics"
            legacy = root / "polymythseminars/ics/unicode-legacy.ics"
            self.assertEqual(legacy.read_bytes(), canonical.read_bytes())
            _, components = parsed_events_for_root(canonical)
            item = components[0]
            self.assertEqual(item.decoded("DTSTART"), datetime(2026, 3, 8, 6, 30, tzinfo=timezone.utc))
            self.assertEqual(item.decoded("DTEND"), datetime(2026, 3, 8, 7, 30, tzinfo=timezone.utc))
            self.assertEqual(str(item.get("DESCRIPTION")), timed["description"].replace("\r", "\n"))

            _, all_day_components = parsed_events_for_root(
                root / "polymythseminars/ics/all-day-event.ics"
            )
            self.assertEqual(all_day_components[0].decoded("DTSTART"), date(2026, 8, 1))
            self.assertEqual(all_day_components[0].decoded("DTEND"), date(2026, 8, 4))


def parsed_events_for_root(path: Path):
    calendar = Calendar.from_ical(path.read_bytes())
    return calendar, [component for component in calendar.walk() if component.name == "VEVENT"]


if __name__ == "__main__":
    unittest.main()
