#!/usr/bin/env python3
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from bs4 import BeautifulSoup
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import scrape_seminars as scrape  # noqa: E402
import publish_protest_harvest as protest_publisher  # noqa: E402
from harvest_protests import (  # noqa: E402
    ConfigurationError,
    evaluate_source_health,
    extract_corroboration,
    load_candidate_state,
    load_protest_sources,
    qualify_record,
    run_harvest,
)
from harvest_structured_events import qualify as qualify_structured  # noqa: E402
from polymythcal_adapters import (  # noqa: E402
    classify_adapter_event_type,
    event_identity_aliases,
    event_identity_key,
    event_occurrence_key,
    parse_html,
)
from polymythcal_discovery import (  # noqa: E402
    FetchOutcome,
    crawl_source,
    discover_html_urls,
    parse_campaign_locations,
    parse_feed_links_and_inline_events,
    parse_ical,
    parse_wordpress_posts_json,
)
from publish_protest_harvest import (  # noqa: E402
    source_health_gate_error,
    upsert as upsert_protests,
)

FIXTURES = ROOT / "scripts" / "fixtures" / "protest_harvest"


def fixture(name):
    return (FIXTURES / name).read_text(encoding="utf-8")


class FakeFetcher:
    def __init__(self, mapping):
        self.mapping = mapping
        self.calls = []

    def fetch(self, url, *, headers=None):
        self.calls.append(url)
        value = self.mapping.get(url)
        if isinstance(value, FetchOutcome):
            return value
        if value is None:
            return FetchOutcome(
                url=url,
                status="fetch-error",
                error="fixture URL is intentionally unavailable",
            )
        if isinstance(value, tuple):
            body, content_type = value
        else:
            body, content_type = value, "text/html"
        return FetchOutcome(
            url=url,
            final_url=url,
            status="success",
            body=body,
            content_type=content_type,
            http_status=200,
        )


def source(**overrides):
    base = {
        "id": "test-source",
        "name": "Test Organizer",
        "events_url": "https://example.org/events/",
        "default_type": "protest",
        "city": "Toronto",
        "timezone": "America/Toronto",
        "platform_adapter": "civic-action",
        "harvest_enabled": True,
    }
    base.update(overrides)
    return base


class DiscoveryTests(unittest.TestCase):
    def test_corrupt_required_configuration_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            roster = root / "sources.json"
            config = root / "protest-sources.json"
            roster.write_text("{broken", encoding="utf-8")
            config.write_text('{"sources":[]}', encoding="utf-8")
            with self.assertRaises(ConfigurationError):
                load_protest_sources(roster, config)

    def test_corrupt_candidate_state_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            state.write_text('{"items":"not-an-array"}', encoding="utf-8")
            with self.assertRaises(ConfigurationError):
                load_candidate_state(state)

    def test_duplicate_candidate_occurrences_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            state.write_text(
                json.dumps(
                    {
                        "items": [
                            {
                                "identity_key": "same-identity-key-1234",
                                "occurrence_key": "same-occurrence-key-1234",
                            },
                            {
                                "identity_key": "same-identity-key-1234",
                                "occurrence_key": "same-occurrence-key-1234",
                            },
                        ],
                        "source_health": [],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                ConfigurationError, "duplicate occurrence identities"
            ):
                load_candidate_state(state)

    def test_duplicate_configured_source_ids_fail_before_crawl(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            roster = root / "sources.json"
            config = root / "protest-sources.json"
            duplicate = source(id="duplicate-source")
            roster.write_text(
                json.dumps({"sources": [duplicate, duplicate]}),
                encoding="utf-8",
            )
            config.write_text(
                json.dumps({"sources": [], "corroboration_sources": []}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ConfigurationError, "duplicate source ids"):
                load_protest_sources(roster, config)

    def test_missing_candidate_state_starts_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            state = load_candidate_state(Path(directory) / "missing.json")
            self.assertEqual(state, {"items": [], "source_health": []})

    def test_action_network_keeps_jsonld_and_html_events(self):
        config = source(
            id="action-network-test",
            events_url="https://actionnetwork.org/events/river-run-2026",
            platform_adapter="action-network",
        )
        result = crawl_source(
            config,
            fetcher=FakeFetcher(
                {
                    config["events_url"]: fixture("action-network.html"),
                    "https://actionnetwork.org/events/solidarity-teach-in": (
                        "<html><body>No additional details.</body></html>"
                    ),
                }
            ),
            max_pages=4,
        )
        by_title = {item["title"]: item for item in result.records}
        self.assertIn("River Run 2026", by_title)
        self.assertIn("Solidarity Teach-in and March", by_title)
        self.assertEqual(by_title["River Run 2026"]["date"][:16], "2026-09-24T12:00")
        self.assertEqual(by_title["Solidarity Teach-in and March"]["type"], "protest")

    def test_multi_location_campaign_emits_only_configured_city(self):
        config = source(platform_adapter="campaign-page")
        records = parse_campaign_locations(
            fixture("multi-location.html"),
            "https://protestdougford.com/july-25th-protest-locations/",
            config,
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "Ontario Day of Action")
        self.assertIn("Queen's Park", records[0]["venue"])
        self.assertEqual(records[0]["date"][:16], "2026-07-25T12:00")

    def test_announcement_publication_date_does_not_replace_event_date(self):
        records = parse_html(
            fixture("announcement-page.html"),
            source(id="announcement", events_url="https://example.org/news/"),
            "civic-action",
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2026-07-26T11:00")

    def test_exact_event_date_and_heading_link_beat_earlier_article_fields(self):
        records = parse_html(
            fixture("ambiguous-announcement.html"),
            source(id="ambiguous", events_url="https://example.org/latest-news/"),
            "civic-action",
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "Harbour Solidarity Rally")
        self.assertEqual(records[0]["date"][:16], "2026-09-05T18:30")
        self.assertEqual(
            records[0]["source_url"],
            "https://example.org/events/harbour-solidarity-rally/",
        )

    def test_publisher_is_not_assumed_to_be_event_organizer(self):
        config = source(name="Announcement Publisher", source_is_organizer=False)
        record = parse_html(
            fixture("ambiguous-announcement.html"), config, "civic-action"
        )[0]
        self.assertEqual(record["publisher"], "Announcement Publisher")
        self.assertEqual(record["organizer"], "")

    def test_atom_uses_alternate_event_link_and_selected_event_date(self):
        records, _ = parse_feed_links_and_inline_events(
            fixture("ambiguous-feed.xml"),
            "https://example.org/feed/",
            source(events_url="https://example.org/feed/"),
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2026-09-05T18:30")
        self.assertEqual(
            records[0]["source_url"],
            "https://example.org/events/harbour-solidarity-rally/",
        )

    def test_wordpress_post_uses_announced_event_date_not_post_metadata(self):
        payload = json.dumps([
            {
                "link": "https://example.org/events/harbour-solidarity-rally/",
                "title": {"rendered": "Harbour Solidarity Rally"},
                "modified": "2026-07-20T09:00:00-04:00",
                "content": {
                    "rendered": (
                        "<p>Volunteer applications open August 1, 2026.</p>"
                        "<p>Join us for the rally on September 5, 2026 at 6:30 pm.</p>"
                    )
                },
                "excerpt": {"rendered": ""},
            }
        ])
        records, _ = parse_wordpress_posts_json(
            payload,
            source(events_url="https://example.org/latest-news/"),
            "https://example.org/wp-json/wp/v2/posts",
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2026-09-05T18:30")

    def test_generic_non_protest_source_uses_shared_discovery_and_default_type(self):
        config = source(
            id="example-university",
            name="Example University",
            events_url="https://example.edu/events/",
            default_type="lecture",
            city="Kingston",
            platform_adapter="university",
        )
        mapping = {
            config["events_url"]: fixture("generic-listing.html"),
            "https://example.edu/events/feed/": (
                fixture("generic-feed.xml"),
                "application/rss+xml",
            ),
            "https://example.edu/events/page/2/": fixture("generic-page-2.html"),
            "https://example.edu/events/public-philosophy-lecture/": fixture("generic-detail.html"),
        }
        result = crawl_source(config, fetcher=FakeFetcher(mapping), max_pages=8)
        event = next(item for item in result.records if item["title"] == "Public Philosophy Lecture")
        self.assertEqual(event["type"], "lecture")
        self.assertEqual(event["date"][:16], "2026-10-20T19:00")
        self.assertIn("Watson Hall", event["venue"])
        fetched = {item.url for item in result.fetches}
        self.assertIn("https://example.edu/events/feed/", fetched)
        self.assertIn("https://example.edu/events/page/2/", fetched)
        self.assertIn("https://example.edu/events/public-philosophy-lecture/", fetched)

    def test_public_platform_hosts_are_allowlisted_for_detail_handoff(self):
        html = """
        <a href="https://events.humanitix.com/public-philosophy-night">Details</a>
        <a href="https://lu.ma/toronto-reading">Luma event</a>
        <a href="https://www.meetup.com/example/events/123/">Meetup event</a>
        """
        found = discover_html_urls(html, "https://example.org/events/", source(), depth=0)
        urls = {item.url for item in found}
        self.assertIn("https://events.humanitix.com/public-philosophy-night", urls)
        self.assertIn("https://lu.ma/toronto-reading", urls)
        self.assertIn("https://www.meetup.com/example/events/123/", urls)

    def test_official_news_links_with_action_signals_are_discovered(self):
        html = """
        <a href="/news/annual-policy-report/">Annual policy report</a>
        <a href="/news/global-day-of-action-beat-the-heat/">
          Global Day of Action: Beat the Heat
        </a>
        <a href="/index.php/news-events/upcoming-events/">
          View the OHC Events Calendar
        </a>
        """
        found = discover_html_urls(
            html,
            "https://organizer.example/toronto/",
            source(events_url="https://organizer.example/toronto/"),
            depth=0,
        )
        urls = [item.url for item in found]
        self.assertIn(
            "https://organizer.example/news/global-day-of-action-beat-the-heat/",
            urls,
        )
        self.assertIn(
            "https://organizer.example/index.php/news-events/upcoming-events/",
            urls,
        )
        self.assertLess(
            urls.index(
                "https://organizer.example/news/global-day-of-action-beat-the-heat/"
            ),
            urls.index("https://organizer.example/news/annual-policy-report/"),
        )

    def test_long_organizer_article_keeps_event_date_location_and_organizer(self):
        html = f"""
        <article>
          <h1><a href="/news/beat-the-heat-action/">
            ACORN Beat the Heat Day of Action on July 15th
          </a></h1>
          <p>Posted July 10th, 2026</p>
          <p>Join the public rally on July 15th, 2026 at 6:30 pm.</p>
          <address>Queen's Park, 111 Wellesley Street West</address>
          <p itemprop="organizer">Toronto ACORN</p>
          <p>{"Background on tenant organizing. " * 180}</p>
        </article>
        """
        self.assertGreater(len(BeautifulSoup(html, "html.parser").get_text()), 2400)
        records = parse_html(
            html,
            source(events_url="https://organizer.example/toronto/"),
            "civic-action",
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2026-07-15T18:30")
        self.assertIn("Queen's Park", records[0]["venue"])
        self.assertEqual(records[0]["organizer"], "Toronto ACORN")

    def test_organizer_news_container_uses_detail_page_as_announcement_url(self):
        listing_url = "https://organizer.example/toronto/"
        detail_url = "https://organizer.example/news/tenant-day-of-action/"
        detail = f"""
        <main id="content">
          <div class="news-post-content">
            <h1>Tenant Day of Action on September 5th</h1>
            <p>Posted August 20, 2026</p>
            <p>Join the public rally on September 5th at 6:30 pm.</p>
            <address>Queen's Park, Toronto</address>
            <a href="https://social.example/events/123">RSVP</a>
            <p>{"Campaign background. " * 180}</p>
          </div>
        </main>
        """
        config = source(events_url=listing_url)
        del config["platform_adapter"]
        result = crawl_source(
            config,
            fetcher=FakeFetcher(
                {
                    listing_url: (
                        '<a href="/news/tenant-day-of-action/">'
                        "Tenant Day of Action</a>"
                    ),
                    detail_url: detail,
                }
            ),
            max_pages=3,
            max_depth=2,
        )
        record = next(
            item for item in result.records
            if item["title"] == "Tenant Day of Action on September 5th"
        )
        self.assertEqual(record["source_url"], detail_url)
        self.assertEqual(record["date"][:16], "2026-09-05T18:30")

    def test_rss_explicit_event_fields_are_used_before_publication_date(self):
        xml = """<?xml version="1.0"?>
        <rss xmlns:ev="https://example.org/event">
          <channel><item>
            <title>Public Health Solidarity Vigil</title>
            <link>https://example.org/actions/health-vigil</link>
            <pubDate>Fri, 10 Jul 2026 10:00:00 -0400</pubDate>
            <description>Join the vigil. Full details are available.</description>
            <ev:startDate>2026-09-05T18:30:00-04:00</ev:startDate>
            <ev:location>Queen's Park</ev:location>
            <ev:organizer>Health Coalition</ev:organizer>
          </item></channel>
        </rss>
        """
        records, _ = parse_feed_links_and_inline_events(
            xml,
            "https://example.org/feed/",
            source(events_url="https://example.org/feed/"),
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2026-09-05T18:30")
        self.assertEqual(records[0]["venue"], "Queen's Park")
        self.assertEqual(records[0]["organizer"], "Health Coalition")

    def test_old_feed_post_cannot_roll_a_yearless_date_into_the_future(self):
        xml = """<?xml version="1.0"?>
        <rss><channel><item>
          <title>Tenant Solidarity Rally</title>
          <link>https://example.org/news/tenant-rally</link>
          <pubDate>Wed, 10 Aug 2022 10:00:00 -0400</pubDate>
          <description>Join the rally on September 1 at 6:30 pm.</description>
        </item></channel></rss>
        """
        records, _ = parse_feed_links_and_inline_events(
            xml,
            "https://example.org/feed/",
            source(events_url="https://example.org/feed/"),
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2022-09-01T18:30")

    def test_wordpress_publication_year_anchors_yearless_event_date(self):
        payload = json.dumps([
            {
                "link": "https://example.org/news/tenant-rally/",
                "title": {"rendered": "Tenant Solidarity Rally"},
                "date": "2022-08-10T09:00:00-04:00",
                "modified": "2026-07-20T09:00:00-04:00",
                "content": {
                    "rendered": "<p>Join the rally on September 1 at 6:30 pm.</p>"
                },
                "excerpt": {"rendered": ""},
            }
        ])
        records, _ = parse_wordpress_posts_json(
            payload,
            source(events_url="https://example.org/latest-news/"),
            "https://example.org/wp-json/wp/v2/posts",
        )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["date"][:16], "2022-09-01T18:30")

    def test_jsonld_object_url_address_identifier_and_status_are_preserved(self):
        html = """
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Event",
          "name": "Water Solidarity Rally",
          "startDate": "2026-09-05T18:30:00-04:00",
          "url": {"@id": "https://example.org/actions/water-rally"},
          "identifier": {"value": "organizer-event-447"},
          "eventStatus": "https://schema.org/EventPostponed",
          "location": {
            "@type": "Place",
            "name": "Queen's Park",
            "address": "111 Wellesley Street West, Toronto"
          },
          "organizer": {"@type": "Organization", "name": "Water Keepers"}
        }
        </script>
        """
        record = parse_html(html, source(), "civic-action")[0]
        self.assertEqual(
            record["source_url"], "https://example.org/actions/water-rally"
        )
        self.assertEqual(record["external_uid"], "organizer-event-447")
        self.assertEqual(record["lifecycle_status"], "postponed")
        self.assertIn("111 Wellesley Street West", record["venue"])

    def test_ical_organizer_prefers_cn_over_mailto(self):
        ical = """BEGIN:VCALENDAR
BEGIN:VEVENT
UID:rally-1@example.org
DTSTART:20260905T183000
SUMMARY:Public Solidarity Rally
LOCATION:Queen's Park
ORGANIZER;CN="Toronto Workers Coalition":mailto:events@example.org
END:VEVENT
END:VCALENDAR
"""
        record = parse_ical(ical, source())[0]
        self.assertEqual(record["organizer"], "Toronto Workers Coalition")

    def test_campaign_rows_without_city_markup_still_filter_by_city_text(self):
        html = """
        <div class="location-card">
          <h3>Toronto Public Rally</h3>
          <p>Toronto — September 5, 2026 at 6:30 pm</p>
        </div>
        <div class="location-card">
          <h3>Ottawa Public Rally</h3>
          <p>Ottawa — September 5, 2026 at 6:30 pm</p>
        </div>
        """
        records = parse_campaign_locations(
            html,
            "https://example.org/day-of-action/",
            source(platform_adapter="campaign-page", city="Toronto"),
        )
        self.assertEqual([record["title"] for record in records], ["Toronto Public Rally"])

    def test_wordpress_rest_and_tec_endpoints_are_discovered_separately(self):
        html = """
        <link rel="https://api.w.org/" href="https://example.org/wp-json/">
        <div class="tribe-events">Upcoming events</div>
        """
        found = discover_html_urls(
            html,
            "https://example.org/events/",
            source(platform_adapter="wordpress-tec"),
            depth=0,
        )
        by_kind = {item.kind: item.url for item in found}
        self.assertIn("/wp-json/wp/v2/posts?", by_kind["wordpress-rest"])
        self.assertIn("/wp-json/tribe/events/v1/events?", by_kind["wordpress-tec"])

    def test_configured_feed_runs_before_html_seed_with_correct_adapter(self):
        config = source(
            id="feed-first",
            events_url="https://example.org/events/",
            feed_url="https://example.org/wp-json/tribe/events/v1/events",
            platform_adapter="wordpress-tec",
        )
        fetcher = FakeFetcher(
            {
                config["feed_url"]: (
                    json.dumps(
                        {
                            "events": [
                                {
                                    "title": "Public Solidarity Rally",
                                    "start_date": "2026-10-04 13:00",
                                    "venue": {
                                        "venue": "City Hall",
                                        "address": "100 Queen Street West",
                                        "city": "Toronto"
                                    },
                                    "url": "https://example.org/event/rally"
                                }
                            ]
                        }
                    ),
                    "application/json",
                ),
                config["events_url"]: "<html><body>No additional events.</body></html>",
            }
        )
        result = crawl_source(config, fetcher=fetcher, max_pages=3)
        self.assertEqual(fetcher.calls[0], config["feed_url"])
        self.assertEqual(result.records[0]["title"], "Public Solidarity Rally")
        self.assertEqual(result.records[0]["type"], "protest")

    def test_partial_seed_failure_is_never_confirmed_empty(self):
        config = source(
            events_url="https://example.org/events/",
            additional_urls=["https://example.org/actions/"],
        )
        fetcher = FakeFetcher(
            {
                config["events_url"]: "<html><body>No events posted.</body></html>",
                "https://example.org/actions/": FetchOutcome(
                    url="https://example.org/actions/",
                    status="blocked",
                    http_status=403,
                    error="HTTP 403",
                ),
            }
        )
        result = crawl_source(config, fetcher=fetcher)
        self.assertEqual(result.status, "partial-failure")
        self.assertEqual(result.source_yield()["fetch_statuses"]["blocked"], 1)

    def test_fetch_error_and_block_are_distinct_from_empty(self):
        blocked = crawl_source(
            source(),
            fetcher=FakeFetcher(
                {
                    "https://example.org/events/": FetchOutcome(
                        url="https://example.org/events/",
                        status="blocked",
                        http_status=403,
                        error="HTTP 403",
                    )
                }
            ),
        )
        failed = crawl_source(source(), fetcher=FakeFetcher({}))
        self.assertEqual(blocked.status, "blocked")
        self.assertEqual(failed.status, "fetch-error")

    def test_per_source_wall_clock_budget_is_hard_bounded(self):
        result = crawl_source(
            source(),
            fetcher=FakeFetcher(
                {"https://example.org/events/": "<html><body>No events.</body></html>"}
            ),
            max_elapsed_seconds=0,
        )
        self.assertEqual(result.status, "fetch-error")
        self.assertEqual(result.fetches[0].error, "crawl-budget-exhausted")

    def test_javascript_empty_is_parser_regression_not_confirmed_empty(self):
        config = source(render_mode="javascript")
        result = crawl_source(
            config,
            fetcher=FakeFetcher(
                {config["events_url"]: "<html><body><div id='app'></div></body></html>"}
            ),
        )
        self.assertEqual(result.status, "parse-empty-regression")
        self.assertIn("application shell", result.parse_errors[0]["error"])

    def test_javascript_shell_uses_bounded_same_site_fallback(self):
        config = source(
            render_mode="javascript",
            base_url="https://example.org/",
        )
        fetcher = FakeFetcher(
            {
                config["events_url"]: fixture("javascript-shell.html"),
                "https://example.org/": fixture("javascript-fallback.html"),
            }
        )
        result = crawl_source(config, fetcher=fetcher, max_pages=4)
        self.assertIn("https://example.org/", fetcher.calls)
        self.assertIn("Server-readable Rally", {row["title"] for row in result.records})
        self.assertNotEqual(result.status, "confirmed-empty")

    def test_nonempty_javascript_skeleton_uses_bounded_fallback(self):
        config = source(
            render_mode="javascript",
            base_url="https://example.org/",
        )
        fetcher = FakeFetcher(
            {
                config["events_url"]: (
                    "<html><body><div id='app'><div class='skeleton'>"
                    "Loading events...</div><script src='/app.js'></script>"
                    "</div></body></html>"
                ),
                "https://example.org/": fixture("javascript-fallback.html"),
            }
        )
        result = crawl_source(config, fetcher=fetcher, max_pages=4)
        self.assertIn("https://example.org/", fetcher.calls)
        self.assertIn("Server-readable Rally", {row["title"] for row in result.records})
        self.assertEqual(result.status, "partial-failure")

    def test_blank_static_200_is_not_authoritative_empty(self):
        config = source(render_mode="static")
        result = crawl_source(
            config,
            fetcher=FakeFetcher({config["events_url"]: "<html><body> </body></html>"}),
        )
        self.assertEqual(result.status, "parse-empty-regression")
        self.assertNotEqual(result.status, "confirmed-empty")

    def test_explicit_empty_message_is_authoritative(self):
        config = source(render_mode="static")
        result = crawl_source(
            config,
            fetcher=FakeFetcher(
                {config["events_url"]: "<html><body>No upcoming events.</body></html>"}
            ),
        )
        self.assertEqual(result.status, "confirmed-empty")
        self.assertEqual(result.fetches[0].empty_evidence, "explicit-empty-message")

    def test_challenge_page_is_blocked_not_authoritative_empty(self):
        config = source()
        result = crawl_source(
            config,
            fetcher=FakeFetcher({config["events_url"]: fixture("challenge-page.html")}),
        )
        self.assertEqual(result.status, "blocked")
        self.assertEqual(result.fetches[0].error, "challenge page detected")

    def test_opseu_has_server_readable_announcement_fallbacks(self):
        sources, _, _ = load_protest_sources()
        opseu = next(row for row in sources if row.get("id") == "opseu")
        self.assertIn("https://opseu.org/latest-news/", opseu["additional_urls"])
        self.assertIn(
            "https://opseu.org/latest-news/events-calendar/",
            opseu["additional_urls"],
        )

    def test_same_title_time_and_place_with_different_urls_are_preserved(self):
        html = """
        <article class="event-card">
          <h2><a href="/events/a/">Solidarity Rally</a></h2>
          <time datetime="2026-09-05T18:30:00-04:00"></time>
          <p class="venue">City Hall</p><p>Join the public rally.</p>
        </article>
        <article class="event-card">
          <h2><a href="/events/b/">Solidarity Rally</a></h2>
          <time datetime="2026-09-05T18:30:00-04:00"></time>
          <p class="venue">City Hall</p><p>Join the public rally.</p>
        </article>
        """
        records = parse_html(html, source(), "civic-action")
        self.assertEqual(len(records), 2)
        self.assertEqual(len({row["identity_key"] for row in records}), 2)

    def test_ical_timezone_uses_dst_for_event_date(self):
        records = parse_ical(
            fixture("cupe-calendar.ics"),
            source(id="cupe", name="CUPE Ontario", events_url="https://cupe.on.ca/calendar/"),
        )
        by_title = {item["title"]: item for item in records}
        self.assertTrue(by_title["River Run 2026"]["date"].endswith("-04:00"))
        self.assertTrue(by_title["Winter Solidarity Rally"]["date"].endswith("-05:00"))

    def test_arcgis_road_restriction_is_corroboration_only(self):
        config = {
            "id": "toronto-road-restrictions",
            "events_url": "https://gis.toronto.ca/example/query",
            "timezone": "America/Toronto",
            "role": "corroboration",
        }
        outcome = FetchOutcome(
            url=config["events_url"],
            final_url=config["events_url"],
            status="success",
            body=fixture("toronto-road-restrictions.json"),
            content_type="application/json",
            http_status=200,
        )
        evidence = extract_corroboration(outcome, config)
        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0]["source_id"], "toronto-road-restrictions")
        self.assertEqual(evidence[0]["date"][:16], "2026-07-25T12:00")
        self.assertIn("Queen's Park Crescent", evidence[0]["text"])


class CandidateStateTests(unittest.TestCase):
    def setUp(self):
        self.config = source(
            id="cupe-ontario",
            name="CUPE Ontario",
            events_url="https://cupe.on.ca/calendar/",
        )
        self.now = datetime(2026, 7, 23, 15, 0, tzinfo=timezone.utc)

    def first_fetcher(self):
        return FakeFetcher(
            {
                self.config["events_url"]: fixture("cupe-calendar.html"),
                "https://cupe.on.ca/calendar/?ical=1": FetchOutcome(
                    url="https://cupe.on.ca/calendar/?ical=1",
                    status="blocked",
                    http_status=403,
                    error="HTTP 403",
                ),
                "https://cupe.on.ca/event/river-run-2026/": FetchOutcome(
                    url="https://cupe.on.ca/event/river-run-2026/",
                    status="blocked",
                    http_status=403,
                    error="HTTP 403",
                ),
            }
        )

    def test_all_primary_source_failures_block_publication(self):
        configs = [
            source(id="blocked-source", events_url="https://blocked.example/events/"),
            source(id="failed-source", events_url="https://failed.example/events/"),
        ]
        output, state = run_harvest(
            sources=configs,
            corroboration_sources=[],
            prior_state={"items": [], "source_health": []},
            fetcher=FakeFetcher(
                {
                    configs[0]["events_url"]: FetchOutcome(
                        url=configs[0]["events_url"],
                        status="blocked",
                        http_status=403,
                        error="HTTP 403",
                    ),
                    configs[1]["events_url"]: FetchOutcome(
                        url=configs[1]["events_url"],
                        status="fetch-error",
                        error="connection failed",
                    ),
                }
            ),
            now=self.now,
            max_pages=2,
            max_depth=1,
        )
        gate = output["source_health_gate"]
        self.assertEqual(gate["status"], "failed")
        self.assertEqual(
            gate["reason"], "no-authoritative-primary-source-observation"
        )
        self.assertEqual(gate["authoritative_primary_sources"], 0)
        self.assertEqual(
            gate["systemic_failure_source_ids"],
            ["blocked-source", "failed-source"],
        )
        self.assertEqual(output["events"], [])
        self.assertEqual(len(state["source_health"]), 2)
        self.assertIn("did not pass", source_health_gate_error(output))

    def test_all_parse_regressions_are_a_systemic_failure(self):
        configs = [
            source(id="parser-a", events_url="https://a.example/events/"),
            source(id="parser-b", events_url="https://b.example/events/"),
        ]
        gate = evaluate_source_health(
            configs,
            [
                {
                    "source_id": config["id"],
                    "status": "parse-empty-regression",
                    "events": 0,
                    "http_statuses": [],
                }
                for config in configs
            ],
        )
        self.assertEqual(gate["status"], "failed")
        self.assertEqual(
            gate["systemic_failure_source_ids"], ["parser-a", "parser-b"]
        )

    def test_confirmed_empty_zero_event_run_passes_source_health_gate(self):
        output, _ = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state={"items": [], "source_health": []},
            fetcher=FakeFetcher(
                {
                    self.config["events_url"]:
                        "<html><body>No upcoming events.</body></html>"
                }
            ),
            now=self.now,
            max_pages=2,
            max_depth=1,
        )
        gate = output["source_health_gate"]
        self.assertEqual(output["events"], [])
        self.assertEqual(gate["status"], "passed")
        self.assertEqual(gate["authoritative_primary_sources"], 1)
        self.assertEqual(gate["expected_primary_sources"], 1)
        self.assertEqual(gate["reported_primary_sources"], 1)
        self.assertEqual(source_health_gate_error(output), "")

    def test_protest_publisher_rejects_a_wrong_deterministic_stream(self):
        output, _ = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state={"items": [], "source_health": []},
            fetcher=FakeFetcher(
                {
                    self.config["events_url"]:
                        "<html><body>No upcoming events.</body></html>"
                }
            ),
            now=self.now,
            max_pages=2,
            max_depth=1,
        )
        output["stream"] = "deterministic-structured-events"
        self.assertIn(
            "expected 'deterministic-protests'",
            source_health_gate_error(output),
        )

    def test_missing_source_yield_and_missing_gate_are_rejected(self):
        gate = evaluate_source_health([self.config], [])
        self.assertEqual(gate["status"], "failed")
        self.assertEqual(gate["reason"], "incomplete-primary-source-coverage")
        self.assertEqual(gate["missing_source_ids"], ["cupe-ontario"])
        self.assertIn(
            "no source-health gate",
            source_health_gate_error({"sharded": False, "events": []}),
        )

    def test_publisher_refuses_failed_gate_before_writing_calendar(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            input_path = root / "harvest.json"
            public_path = root / "events.json"
            master_path = root / "master.json"
            baseline = '{"events":[],"count":0,"_total_events":0}\n'
            public_path.write_text(baseline, encoding="utf-8")
            master_path.write_text(baseline, encoding="utf-8")
            input_path.write_text(
                json.dumps(
                    {
                        "sharded": False,
                        "events": [],
                        "source_health_gate": {
                            "status": "failed",
                            "reason": "no-authoritative-primary-source-observation",
                            "expected_primary_sources": 2,
                            "reported_primary_sources": 2,
                            "authoritative_primary_sources": 0,
                        },
                    }
                ),
                encoding="utf-8",
            )
            with (
                mock.patch.object(protest_publisher, "PUBLIC_PATH", public_path),
                mock.patch.object(protest_publisher, "MASTER_PATH", master_path),
                mock.patch.object(
                    sys,
                    "argv",
                    [
                        "publish_protest_harvest.py",
                        "--input",
                        str(input_path),
                        "--skip-finalize",
                    ],
                ),
            ):
                self.assertEqual(protest_publisher.main(), 2)
            self.assertEqual(public_path.read_text(encoding="utf-8"), baseline)
            self.assertEqual(master_path.read_text(encoding="utf-8"), baseline)

    def test_incomplete_candidate_is_public_and_upgrades_in_place(self):
        first_output, first_state = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state={"items": [], "source_health": []},
            fetcher=self.first_fetcher(),
            now=self.now,
            max_pages=8,
            max_depth=3,
        )
        first = next(item for item in first_output["events"] if item["title"] == "River Run 2026")
        self.assertEqual(first["confirmation_status"], "unconfirmed")
        self.assertIn("time-unconfirmed", first["qualification_reasons"])
        self.assertIn("location-unconfirmed", first["qualification_reasons"])
        self.assertIn("organizer-unconfirmed", first["qualification_reasons"])
        self.assertEqual(first["review_status"], "auto-published")
        self.assertEqual(first_output["summary"]["source_failures"], 1)

        second_fetcher = FakeFetcher(
            {
                self.config["events_url"]: fixture("cupe-calendar.html"),
                "https://cupe.on.ca/calendar/?ical=1": (
                    fixture("cupe-calendar.ics"),
                    "text/calendar",
                ),
                "https://cupe.on.ca/event/river-run-2026/": fixture("cupe-detail.html"),
                "https://cupe.on.ca/event/winter-solidarity-rally/": "<html></html>",
            }
        )
        second_output, second_state = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state=first_state,
            fetcher=second_fetcher,
            now=self.now.replace(hour=19),
            max_pages=10,
            max_depth=3,
        )
        second = next(item for item in second_output["events"] if item["title"] == "River Run 2026")
        self.assertEqual(second["id"], first["id"])
        self.assertEqual(second["first_seen_at"], first["first_seen_at"])
        self.assertEqual(second["confirmation_status"], "confirmed")
        self.assertEqual(second["qualification_reasons"], [])
        self.assertIn("Grange Park", second["venue"])
        candidate_schema = json.loads(
            (ROOT / "data" / "polymythcal-protest-candidate-schema.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(
            list(Draft202012Validator(candidate_schema).iter_errors(second_state)),
            [],
        )

        failed_output, failed_state = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state=second_state,
            fetcher=FakeFetcher(
                {
                    self.config["events_url"]: FetchOutcome(
                        url=self.config["events_url"],
                        status="blocked",
                        http_status=403,
                        error="HTTP 403",
                    )
                }
            ),
            now=self.now.replace(day=24),
            max_pages=4,
            max_depth=2,
        )
        failed = next(item for item in failed_output["events"] if item["title"] == "River Run 2026")
        self.assertEqual(failed["lifecycle_status"], "active")
        self.assertEqual(
            failed_state["source_health"][0]["last_successful_extraction_at"],
            second_state["source_health"][0]["last_successful_extraction_at"],
        )

    def test_configured_recheck_intervals_control_candidate_timestamps(self):
        checked = self.now
        exact = qualify_record(
            {
                "title": "Exact Public Rally",
                "date": "2026-09-05T18:30:00-04:00",
                "time_precision": "exact",
                "venue": "Queen's Park",
                "organizer": "Test Organizer",
                "source_url": "https://example.org/events/exact",
                "source_id": "test-source",
                "type": "protest",
            },
            self.config,
            checked_at=checked,
            unresolved_recheck_hours=6,
            confirmed_recheck_hours=18,
        )
        incomplete = qualify_record(
            {
                "title": "Incomplete Public Rally",
                "date": "2026-09-06T00:00:00-04:00",
                "time_precision": "unknown",
                "venue": "Toronto",
                "source_url": "https://example.org/events/incomplete",
                "source_id": "test-source",
                "type": "protest",
            },
            self.config,
            checked_at=checked,
            unresolved_recheck_hours=6,
            confirmed_recheck_hours=18,
        )
        self.assertEqual(
            exact["next_recheck_at"],
            "2026-07-24T09:00:00+00:00",
        )
        self.assertEqual(
            incomplete["next_recheck_at"],
            "2026-07-23T21:00:00+00:00",
        )

    def test_partial_detail_failure_does_not_erase_known_event_facts(self):
        initial_html = """
        <article class="event-card">
          <h2><a href="/events/harbour-rally/">Harbour Solidarity Rally</a></h2>
          <time datetime="2026-09-05T18:30:00-04:00"></time>
          <p class="venue">Queen's Park</p>
          <p class="organizer">Harbour Workers Coalition</p>
          <p>Join the public rally.</p>
        </article>
        """
        first_output, first_state = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state={"items": [], "source_health": []},
            fetcher=FakeFetcher(
                {
                    self.config["events_url"]: initial_html,
                    "https://cupe.on.ca/events/harbour-rally/": FetchOutcome(
                        url="https://cupe.on.ca/events/harbour-rally/",
                        status="blocked",
                        http_status=403,
                        error="HTTP 403",
                    ),
                }
            ),
            now=self.now,
            max_pages=4,
            max_depth=2,
        )
        first = next(
            item for item in first_output["events"]
            if item["title"] == "Harbour Solidarity Rally"
        )
        self.assertEqual(first["time_precision"], "exact")

        incomplete_html = """
        <article class="event-card">
          <h2><a href="/events/harbour-rally/">Harbour Solidarity Rally</a></h2>
          <p>September 5, 2026 — join the public rally. Details follow.</p>
        </article>
        """
        second_output, _ = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state=first_state,
            fetcher=FakeFetcher(
                {
                    self.config["events_url"]: incomplete_html,
                    "https://cupe.on.ca/events/harbour-rally/": FetchOutcome(
                        url="https://cupe.on.ca/events/harbour-rally/",
                        status="blocked",
                        http_status=403,
                        error="HTTP 403",
                    ),
                }
            ),
            now=self.now.replace(hour=19),
            max_pages=4,
            max_depth=2,
        )
        second = next(
            item for item in second_output["events"]
            if item["title"] == "Harbour Solidarity Rally"
        )
        self.assertEqual(second["time_precision"], "exact")
        self.assertEqual(second["date"][:16], "2026-09-05T18:30")
        self.assertEqual(second["venue"], "Queen's Park")
        self.assertEqual(second["organizer"], "Harbour Workers Coalition")
        self.assertEqual(second["source_observation_status"], "observed-partial")
        self.assertIn(
            "start time", second["current_observation_missing_details"]
        )
        self.assertEqual(
            second["next_recheck_at"],
            "2026-07-23T23:00:00+00:00",
        )

    def test_two_authoritative_absences_required_before_missing(self):
        _, initial_state = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state={"items": [], "source_health": []},
            fetcher=self.first_fetcher(),
            now=self.now,
            max_pages=8,
            max_depth=3,
        )
        empty = FakeFetcher(
            {self.config["events_url"]: "<html><body>No upcoming events.</body></html>"}
        )
        _, first_absence = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state=initial_state,
            fetcher=empty,
            now=self.now.replace(hour=16),
            max_pages=2,
            max_depth=1,
        )
        first = next(row for row in first_absence["items"] if row["title"] == "River Run 2026")
        self.assertEqual(first["lifecycle_status"], "active")
        self.assertEqual(first["source_observation_status"], "not-observed-once")
        self.assertEqual(first["missing_count"], 1)
        _, second_absence = run_harvest(
            sources=[self.config],
            corroboration_sources=[],
            prior_state=first_absence,
            fetcher=FakeFetcher(
                {self.config["events_url"]: "<html><body>No upcoming events.</body></html>"}
            ),
            now=self.now.replace(hour=17),
            max_pages=2,
            max_depth=1,
        )
        second = next(row for row in second_absence["items"] if row["title"] == "River Run 2026")
        self.assertEqual(second["lifecycle_status"], "missing-on-source")
        self.assertEqual(second["missing_count"], 2)

    def test_publisher_reschedules_unique_identity_without_collapsing_recurrences(self):
        base = {
            "id": "canonical-old",
            "title": "Public Rally",
            "date": "2026-09-01T12:00:00-04:00",
            "venue": "City Hall",
            "source_url": "https://example.org/events/rally-old-url/",
            "source_id": "official-organizer",
            "external_uid": "rally-44@example.org",
            "type": "protest",
        }
        base["identity_key"] = event_identity_key(base)
        base["occurrence_key"] = event_occurrence_key(base)
        incoming = {
            **base,
            "id": "generated-new",
            "source_url": "https://example.org/events/rally-new-url/",
            "date": "2026-09-08T12:00:00-04:00",
        }
        incoming["identity_key"] = event_identity_key(incoming)
        incoming["occurrence_key"] = event_occurrence_key(incoming)
        self.assertNotEqual(incoming["identity_key"], base["identity_key"])
        self.assertTrue(
            set(event_identity_aliases(incoming)).intersection(event_identity_aliases(base))
        )
        updated, counts = upsert_protests(
            {"events": [base], "count": 1, "_total_events": 1},
            [incoming],
        )
        self.assertEqual(counts["added"], 0)
        self.assertEqual(counts["refreshed"], 1)
        self.assertEqual(updated["events"][0]["id"], "canonical-old")
        self.assertEqual(updated["events"][0]["date"][:10], "2026-09-08")
        self.assertIn("2026-09-01T12:00:00-04:00", updated["events"][0]["previous_dates"])

    def test_publisher_preserves_two_recurring_uid_occurrences(self):
        occurrences = []
        for day in ("01", "08"):
            event = {
                "id": "generated-" + day,
                "title": "Weekly Public Rally",
                "date": f"2026-09-{day}T12:00:00-04:00",
                "venue": "City Hall",
                "source_url": "https://example.org/events/weekly-rally/",
                "source_id": "official-organizer",
                "external_uid": "weekly-rally@example.org",
                "type": "protest",
            }
            event["identity_aliases"] = event_identity_aliases(event)
            event["occurrence_key"] = event_occurrence_key(event)
            event["identity_key"] = event_identity_key(event)
            occurrences.append(event)
        updated, counts = upsert_protests(
            {"events": [], "count": 0, "_total_events": 0},
            occurrences,
        )
        self.assertEqual(counts, {"added": 2, "refreshed": 0, "total": 2})
        self.assertEqual(len({event["identity_key"] for event in updated["events"]}), 2)
        self.assertEqual(len({event["occurrence_key"] for event in updated["events"]}), 2)

    def test_structured_screening_requires_explicit_creator_attendance(self):
        config = source(
            default_type="screening",
            platform_adapter="festival",
            source_is_organizer=False,
        )
        checked = datetime(2026, 7, 23, tzinfo=timezone.utc)
        ordinary = parse_html(
            fixture("screening-ordinary.html"), config, "festival"
        )[0]
        creator_qa = parse_html(
            fixture("screening-creator-qa.html"), config, "festival"
        )[0]
        self.assertIsNone(qualify_structured(ordinary, config, checked))
        qualified = qualify_structured(creator_qa, config, checked)
        self.assertIsNotNone(qualified)
        self.assertTrue(qualified["attendance_confirmed"])

    def test_general_filter_keeps_dated_incomplete_record_public(self):
        record = {
            "id": "future-protest",
            "date": "2099-09-24T00:00:00-04:00",
            "title": "Future Public Rally",
            "venue": "Toronto",
            "source_url": "https://example.org/future-rally",
            "source_id": "official-organizer",
            "type": "protest",
            "confidence": 58,
            "status": "needs-time-place",
            "review_status": "queued",
            "scraped_at": "2099-01-01T00:00:00+00:00",
        }
        kept, dropped, watchlist = scrape.filter_to_verified_only([record])
        self.assertEqual(len(kept), 1)
        self.assertEqual(dropped, [])
        self.assertEqual(watchlist, [])
        self.assertEqual(kept[0]["confirmation_status"], "unconfirmed")
        self.assertEqual(
            kept[0]["qualification_reasons"],
            ["time-unconfirmed", "location-unconfirmed"],
        )

    def test_general_filter_keeps_missing_date_out(self):
        record = {
            "id": "no-date",
            "date": "",
            "title": "Public Rally Date Forthcoming",
            "venue": "",
            "source_url": "https://example.org/rally",
            "source_id": "official-organizer",
            "type": "protest",
            "confidence": 58,
            "status": "needs-time-place",
            "review_status": "queued",
        }
        kept, _, watchlist = scrape.filter_to_verified_only([record])
        self.assertEqual(kept, [])
        self.assertEqual(len(watchlist), 1)
        self.assertEqual(watchlist[0]["status"], "needs-date")


class ClassificationTests(unittest.TestCase):
    def test_civic_intent_outranks_generic_talk_terms(self):
        config = source()
        self.assertEqual(
            classify_adapter_event_type(
                "civic-action",
                "Public rally with talks and a teach-in lecture",
                config,
            ),
            "protest",
        )

    def test_specific_event_families_are_preserved(self):
        cases = {
            "New book launch with the author": "book-launch",
            "Artist talk about the installation": "artist-talk",
            "Policy roundtable panel": "panel",
            "Annual ethics symposium": "symposium",
            "Medieval studies colloquium": "colloquium",
            "Public teaching webinar": "webinar",
            "Community policy forum": "forum",
            "Doctoral thesis defence": "defence",
            "Public memorial gathering": "memorial",
            "Neighbourhood celebration": "celebration",
            "Arts networking evening": "networking",
            "Writer residency information session": "residency",
            "Public philosophy retreat": "retreat",
            "Public meeting on transit": "meeting",
            "Live podcast recording with host": "podcast-live",
            "Public philosophy café": "philosophy-cafe",
            "Site-specific art walk": "site-specific-art",
            "Contemporary dance performance": "performance",
            "Neighbourhood gathering": "gathering",
        }
        config = source(default_type="other", platform_adapter="municipal")
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(
                    classify_adapter_event_type("municipal", text, config),
                    expected,
                )

    def test_discussion_about_protest_is_not_itself_a_protest(self):
        config = source(default_type="lecture", platform_adapter="university")
        self.assertEqual(
            classify_adapter_event_type(
                "university",
                "Lecture on the history of protest movements",
                config,
            ),
            "lecture",
        )
        self.assertEqual(
            classify_adapter_event_type(
                "university",
                "Exhibition about protest posters and archives",
                config,
            ),
            "exhibition",
        )
        self.assertEqual(
            classify_adapter_event_type(
                "civic-action",
                "Protest photography exhibition and archive tour",
                source(),
            ),
            "exhibition",
        )
        self.assertEqual(
            classify_adapter_event_type(
                "university",
                "Join the climate rally at City Hall",
                config,
            ),
            "protest",
        )


if __name__ == "__main__":
    unittest.main()
