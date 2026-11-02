"""Regression coverage for the October 28 mailto publication failure."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from polymythcal_adapters import http_source_url, parse_html
from polymythcal_http_cache import ParsedResponseCache
from publish_protest_harvest import upsert


class HarvestSourceURLTests(unittest.TestCase):
    source = {
        'id': 'ontario-health-coalition', 'name': 'Ontario Health Coalition',
        'events_url': 'https://www.ontariohealthcoalition.ca/events/',
        '_document_url': 'https://www.ontariohealthcoalition.ca/index.php/caravan/',
        'platform_adapter': 'civic-action', 'default_type': 'protest',
    }

    def test_contact_links_cannot_become_event_titles(self):
        html = '''<article><p>Toronto to Ottawa caravan leaves November 26, 2026.
        Email <a href="mailto:info@ontariohc.ca">info@ontariohc.ca</a>
        to join the protest.</p></article>'''
        self.assertEqual(parse_html(html, self.source), [])

    def test_heading_survives_contact_link_and_uses_actual_document(self):
        for href in ['mailto:info@ontariohc.ca', 'tel:+14165550123', 'javascript:void(0)', '#contact']:
            html = f'''<article><h2>Toronto to Ottawa caravan protest</h2>
            November 26, 2026. <a href="{href}">Contact us</a></article>'''
            with self.subTest(href=href):
                rows = parse_html(html, self.source)
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]['source_url'], self.source['_document_url'])
                self.assertEqual(rows[0]['title'], 'Toronto to Ottawa caravan protest')

    def test_relative_detail_link_resolves_against_fetched_document(self):
        html = '''<article><h2><a href="details/">Caravan protest</a></h2>
        November 26, 2026</article>'''
        self.assertEqual(parse_html(html, self.source)[0]['source_url'],
                         self.source['_document_url'] + 'details/')

    def test_only_http_documents_are_valid_publication_sources(self):
        for value in ['', 'mailto:info@ontariohc.ca', 'tel:123', 'javascript:void(0)', 'https://', 'https://[broken', '/relative']:
            with self.subTest(value=value):
                self.assertEqual(http_source_url(value), '')
        self.assertEqual(http_source_url('/event', 'https://example.org/list'), 'https://example.org/event')

    def test_invalid_incoming_is_retained_without_changing_existing_or_confirmation(self):
        old = {'id': 'reviewed', 'title': 'Reviewed event', 'date': '2026-11-01',
               'source_url': 'https://example.org/reviewed', 'review_status': 'manual'}
        valid = {'id': 'incoming', 'title': 'Caravan protest', 'date': '2026-11-26',
                 'source_url': 'https://example.org/caravan', 'type': 'protest',
                 'confirmation_status': 'unconfirmed', 'qualification_reasons': ['time-unconfirmed']}
        invalid = dict(valid, id='bad', title='info@ontariohc.ca', source_url='mailto:info@ontariohc.ca')
        baseline = {'events': [old]}
        original = copy.deepcopy(baseline)
        rejected = []
        updated, counts = upsert(baseline, [invalid, valid], rejected_sink=rejected)
        self.assertEqual(counts, {'added': 1, 'refreshed': 0, 'total': 2})
        self.assertEqual(baseline, original)
        self.assertIn(old, updated['events'])
        added = next(e for e in updated['events'] if e['id'] == 'incoming')
        self.assertEqual(added['confirmation_status'], 'unconfirmed')
        self.assertEqual(added['qualification_reasons'], valid['qualification_reasons'])
        self.assertEqual(rejected, [{'reason': 'invalid-source-url', 'event': invalid}])
        with self.assertRaisesRegex(ValueError, 'rejection ledger'):
            upsert(baseline, [invalid])

    def test_old_parsed_cache_cannot_reintroduce_contact_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'cache.json'
            url = 'https://example.org/'
            path.write_text(json.dumps({
                'schema': 'polymythcal-parsed-http-cache-v1',
                'entries': {url: {
                    'parser_version': 'polymythcal-parser-audit43-v1',
                    'etag': 'old', 'body_hash': 'hash',
                    'parsed_records': [], 'discovered_urls': [],
                }},
            }))
            self.assertEqual(ParsedResponseCache(path).conditional_headers(url), {})


if __name__ == '__main__':
    unittest.main()
