#!/usr/bin/env python3
"""Generate deterministic bilingual RSS and calendar-subscription feeds."""
from __future__ import annotations

import argparse
import html
import json
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'polymythseminars/events.json'
OUT = ROOT / 'polymythseminars/feeds'
RELEASE = ROOT / 'RELEASE_MANIFEST.json'
BASE = 'https://seminarschools.com/polymythseminars/'
TORONTO = ZoneInfo('America/Toronto')
RELEASE_DOC = json.loads(RELEASE.read_text(encoding='utf-8'))
ASSET_VERSION = str(RELEASE_DOC.get('polymythcal_asset_version') or '')
if not re.fullmatch(r'[0-9]{8}-[a-z0-9-]+', ASSET_VERSION):
    raise SystemExit('RELEASE_MANIFEST.json has no valid polymythcal_asset_version')
GEOMETRY_VERSION = '20260806-front-facing-geometry'
BUILD_OUTPUT_MTIME = None
if os.environ.get('SS_BUILD_OUTPUT_MTIME'):
    try:
        output_moment = datetime.fromisoformat(
            os.environ['SS_BUILD_OUTPUT_MTIME'].replace('Z', '+00:00')
        )
        if output_moment.tzinfo is None:
            output_moment = output_moment.replace(tzinfo=timezone.utc)
        BUILD_OUTPUT_MTIME = output_moment.timestamp()
    except ValueError as error:
        raise SystemExit('SS_BUILD_OUTPUT_MTIME must be a valid timestamp') from error


def text(event) -> str:
    return ' '.join(
        str(event.get(key) or '')
        for key in (
            'title', 'type', 'description', 'raw_excerpt', 'venue', 'city',
            'corridor_zone', 'record_kind', 'source_language',
        )
    ).lower()


def cats(event) -> set[str]:
    return {str(event.get('type') or ''), *map(str, event.get('secondary_types') or [])}


ARTS_TEXT_RE = re.compile(
    r'\b(?:art|arts|artist|artists|artistic|artwork|artworks|film|cinema|music|'
    r'musical|theatre|theater|festival|exhibition|gallery)\b'
)


def has_french_source_language(event) -> bool:
    """Use declared source languages, never a place name, as language evidence."""
    languages = {
        str(event.get('source_language') or '').strip().lower(),
        *(
            str(language or '').strip().lower()
            for language in (event.get('source_languages') or [])
        ),
    }
    return any(language == 'fr' or language.startswith('fr-') for language in languages)


FOCUSES = {
    'all': ('All listings', 'Toutes les fiches', lambda event: True),
    'confirmed': ('Confirmed listings', 'Fiches confirmées', lambda event: event.get('confirmation_status') == 'confirmed'),
    'unconfirmed': ('Unconfirmed listings', 'Fiches non confirmées', lambda event: event.get('confirmation_status') == 'unconfirmed'),
    'learning': (
        'Learning, lectures, workshops, and readings',
        'Apprentissage, conférences, ateliers et lectures',
        lambda event: bool(cats(event) & {'lecture', 'talk', 'conference', 'symposium', 'workshop', 'reading', 'book-talk', 'cfp', 'contest'})
        or bool(re.search(r'lecture|seminar|workshop|reading|university|library|student', text(event))),
    ),
    'arts': (
        'Arts, festivals, exhibitions, performances, and screenings',
        'Arts, festivals, expositions, spectacles et projections',
        lambda event: bool(cats(event) & {'festival', 'exhibition', 'performance', 'screening', 'reading'})
        or bool(ARTS_TEXT_RE.search(text(event))),
    ),
    'civic': (
        'Civic action and community listings',
        'Actions civiques et fiches communautaires',
        lambda event: event.get('record_kind') == 'civic-action'
        or bool(cats(event) & {'protest', 'community', 'demonstration', 'rally', 'march', 'vigil'})
        or bool(re.search(r'civic|protest|rally|march|solidarity|community action', text(event))),
    ),
    'opportunities': (
        'Applications, calls, competitions, fellowships, and funding',
        'Candidatures, appels, concours, bourses et financement',
        lambda event: bool(cats(event) & {'cfp', 'contest'})
        or bool(re.search(r'deadline|call for papers|submission|fellowship|grant|application|competition|prize', text(event))),
    ),
    'toronto': ('Toronto listings', 'Fiches de Toronto', lambda event: event.get('corridor_zone') == 'toronto' or str(event.get('city', '')).lower() == 'toronto'),
    'corridor': (
        'Kingston to Montréal corridor',
        'Corridor de Kingston à Montréal',
        lambda event: event.get('corridor_zone') in {'kingston', 'gananoque-thousand-islands', 'brockville-leeds-grenville', 'cornwall-sdg', 'montreal'},
    ),
    'montreal': ('Montréal listings', 'Fiches de Montréal', lambda event: event.get('corridor_zone') == 'montreal' or 'montréal' in str(event.get('city', '')).lower()),
    'fr': (
        'French-language listings',
        'Fiches de langue française',
        has_french_source_language,
    ),
}


def read_release_datetime() -> datetime:
    """Resolve one stable Toronto build moment for all date-sensitive feeds."""
    override = str(os.environ.get('SITE_BUILD_DATE') or '').strip()
    if override:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', override):
            raise SystemExit('SITE_BUILD_DATE must use YYYY-MM-DD')
        try:
            build_day = date.fromisoformat(override)
        except ValueError as error:
            raise SystemExit('SITE_BUILD_DATE is not a real calendar date') from error
    else:
        build_day = datetime.now(TORONTO).date()
    return datetime.combine(build_day, time(12, 0), TORONTO).astimezone(timezone.utc)


BUILD_DT = read_release_datetime()
BUILD_ICS_STAMP = BUILD_DT.strftime('%Y%m%dT%H%M%SZ')
BUILD_RFC_DATE = format_datetime(BUILD_DT)


def write_text_if_changed(path: Path, value: str) -> bool:
    encoded = value.encode('utf-8')
    if path.exists() and path.read_bytes() == encoded:
        if BUILD_OUTPUT_MTIME is not None:
            os.utime(path, (BUILD_OUTPUT_MTIME, BUILD_OUTPUT_MTIME))
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)
    if BUILD_OUTPUT_MTIME is not None:
        os.utime(path, (BUILD_OUTPUT_MTIME, BUILD_OUTPUT_MTIME))
    return True


def write_json_if_changed(path: Path, value) -> bool:
    return write_text_if_changed(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def escape_ics(value) -> str:
    return str(value or '').replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\r\n', '\\n').replace('\n', '\\n').replace('\r', '\\n')


def fold_ics_line(line: str) -> str:
    encoded = line.encode('utf-8')
    chunks = []
    first = True
    while encoded:
        # RFC 5545 section 3.1 limits the complete physical content line to
        # 75 octets. Continuation lines begin with one SPACE, so their text
        # payload has a 74-octet budget. Never split a UTF-8 code point.
        limit = 75 if first else 74
        cut = min(limit, len(encoded))
        while cut < len(encoded) and cut > 0 and (encoded[cut] & 0xC0) == 0x80:
            cut -= 1
        if cut == 0:
            raise ValueError('Unable to fold an iCalendar line at a UTF-8 boundary')
        prefix = '' if first else ' '
        chunks.append(prefix + encoded[:cut].decode('utf-8'))
        encoded = encoded[cut:]
        first = False
    return '\r\n'.join(chunks)


def parse_datetime(value) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TORONTO)
    return parsed


def parse_calendar_date(value) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        parsed = parse_datetime(value)
        return parsed.astimezone(TORONTO).date() if parsed else None


def event_dtstamp(event) -> str:
    for key in ('last_checked_at', 'updated_at', 'first_seen_at'):
        parsed = parse_datetime(event.get(key))
        if parsed:
            return parsed.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    return BUILD_ICS_STAMP


def event_time_lines(event) -> list[str]:
    precision = str(event.get('time_precision') or '').lower()
    if precision == 'exact':
        start = parse_datetime(event.get('date'))
        if not start:
            return []
        lines = ['DTSTART:' + start.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')]
        end = parse_datetime(event.get('end_date'))
        if end:
            lines.append('DTEND:' + end.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        return lines

    start_date = parse_calendar_date(event.get('date'))
    if not start_date:
        return []
    inclusive_end = parse_calendar_date(event.get('end_date')) or start_date
    exclusive_end = inclusive_end + timedelta(days=1)
    return [
        'DTSTART;VALUE=DATE:' + start_date.strftime('%Y%m%d'),
        'DTEND;VALUE=DATE:' + exclusive_end.strftime('%Y%m%d'),
    ]


def item_url(event) -> str:
    return BASE + 'events/' + str(event.get('id') or event.get('identity_key')) + '/'


def event_location(event) -> str:
    venue = str(event.get('venue') or '').strip()
    city = str(event.get('city') or '').strip()
    placeholders = {'', 'tbd', 'to be announced', 'location unconfirmed', 'venue unconfirmed', 'online / tbd'}
    if venue.lower() in placeholders:
        venue = ''
    return ', '.join(part for part in (venue, city) if part)


def build_ics(label_en: str, label_fr: str, events) -> str:
    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Seminar Schools//Polymythcal//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:' + escape_ics('Polymythcal — ' + label_en + ' · ' + label_fr),
        'X-WR-TIMEZONE:America/Toronto',
    ]
    for event in events:
        timing = event_time_lines(event)
        if not timing:
            continue
        lines.extend([
            'BEGIN:VEVENT',
            'UID:' + str(event.get('identity_key') or event.get('id')) + '@seminarschools.com',
            'DTSTAMP:' + event_dtstamp(event),
            *timing,
            'SUMMARY:' + escape_ics(event.get('title')),
        ])
        location = event_location(event)
        if location:
            lines.append('LOCATION:' + escape_ics(location))
        description = (event.get('description') or event.get('raw_excerpt') or '')[:1000]
        if description:
            lines.append('DESCRIPTION:' + escape_ics(description))
        lines.extend([
            'URL:' + item_url(event),
            'STATUS:' + (
                'CANCELLED' if event.get('lifecycle_status') == 'cancelled'
                else 'TENTATIVE' if event.get('confirmation_status') == 'unconfirmed'
                else 'CONFIRMED'
            ),
            'END:VEVENT',
        ])
    lines.append('END:VCALENDAR')
    return '\r\n'.join(fold_ics_line(line) for line in lines) + '\r\n'


def event_pub_date(event) -> str:
    parsed = parse_datetime(event.get('date'))
    if parsed:
        return format_datetime(parsed.astimezone(timezone.utc))
    day = parse_calendar_date(event.get('date'))
    if day:
        return format_datetime(datetime.combine(day, time.min, tzinfo=TORONTO).astimezone(timezone.utc))
    return BUILD_RFC_DATE


def build_rss(name: str, label_en: str, label_fr: str, events) -> str:
    items = []
    for event in events:
        description = ' · '.join(filter(None, [
            event_location(event),
            str(event.get('confirmation_status') or ''),
            str(event.get('lifecycle_status') or ''),
        ]))
        items.append(
            '<item>'
            f'<title>{html.escape(str(event.get("title") or ""))}</title>'
            f'<link>{html.escape(item_url(event))}</link>'
            f'<guid isPermaLink="false">{html.escape(str(event.get("identity_key") or event.get("id")))}</guid>'
            f'<pubDate>{event_pub_date(event)}</pubDate>'
            f'<description>{html.escape(description)}</description>'
            f'<category>{html.escape(str(event.get("type") or "Other"))}</category>'
            '</item>'
        )
    self_url = BASE + ('feed.xml' if name == 'all' else f'feeds/{name}.xml')
    title = f'Polymythcal — {label_en} · {label_fr}'
    description = f'{label_en} · {label_fr} — Polymythcal.'
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
        f'<title>{html.escape(title)}</title>'
        f'<link>{BASE}</link>'
        f'<atom:link href="{self_url}" rel="self" type="application/rss+xml"/>'
        f'<description>{html.escape(description)}</description>'
        '<language>en-CA</language>'
        f'<lastBuildDate>{BUILD_RFC_DATE}</lastBuildDate>'
        + ''.join(items)
        + '</channel></rss>\n'
    )


def build_subscribe_page(manifest) -> str:
    rows = []
    for feed in manifest:
        rows.append(
            '<li class="pm-feed-row"><span>'
            f'<span lang="en">{html.escape(feed["label_en"])}</span> · '
            f'<span lang="fr">{html.escape(feed["label_fr"])}</span> ({feed["count"]})'
            '</span><span>'
            f'<a href="{html.escape(feed["rss"], quote=True)}">RSS</a> · '
            f'<a type="text/calendar" href="{html.escape(feed["ics"], quote=True)}">ICS</a>'
            '</span></li>'
        )
    return f'''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Polymythcal subscriptions · Abonnements Polymythcal</title><meta property="og:type" content="website"><meta property="og:url" content="https://seminarschools.com/polymythseminars/subscribe/"><meta property="og:title" content="Polymythcal subscriptions · Abonnements Polymythcal"><meta property="og:description" content="Focused RSS and calendar subscriptions for Polymythcal listings."><meta property="og:image" content="https://seminarschools.com/og-image.png"><meta name="description" content="Focused Polymythcal RSS and calendar subscriptions for confirmed, regional, civic, arts, learning, opportunity, English, and French listings."><meta name="robots" content="index,follow"><link rel="canonical" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="alternate" hreflang="en-ca" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="alternate" hreflang="fr-ca" href="https://seminarschools.com/polymythseminars/subscribe/?lang=fr"><link rel="alternate" hreflang="x-default" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="stylesheet" href="/css/theme.css?v={ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_VERSION}"><link rel="stylesheet" href="/css/polymythcal-features.css?v={ASSET_VERSION}"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}"></head><body data-route-type="calendar-form" data-geometry="indra-web" data-indra-intensity="0.070" data-geometry-role="return"><a class="skip-link" href="#main-content">Skip to subscriptions · Aller aux abonnements</a><main class="pm-form-shell" id="main-content"><p><a href="/polymythseminars/">← Polymythcal</a></p><h1>Subscriptions · <span lang="fr">Abonnements</span></h1><p>RSS works in feed readers. ICS works in calendar apps. · <span lang="fr">RSS fonctionne dans les lecteurs de fils. ICS fonctionne dans les applications de calendrier.</span></p><ul class="pm-feed-list">{''.join(rows)}</ul></main><script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v={ASSET_VERSION}" defer></script><script defer src="/js/site-keyboard-enhancements.js?v={ASSET_VERSION}"></script><script src="/js/mandala.js?v={GEOMETRY_VERSION}" defer></script><script src="/js/indra.js?v={GEOMETRY_VERSION}" defer></script></body></html>'''


def build_featured(events) -> bool:
    # About needs a compact teaser rather than the full event corpus. Keep
    # enough future records for its client-side rolling window.
    build_day = BUILD_DT.astimezone(TORONTO).date()
    upcoming = []
    for event in events:
        start_day = parse_calendar_date(event.get('date'))
        if not start_day or start_day < build_day:
            continue
        upcoming.append({
            key: event.get(key)
            for key in ('id', 'date', 'title', 'speaker_or_director', 'venue', 'source_url')
            if event.get(key) not in (None, '')
        })
        if len(upcoming) >= 64:
            break
    featured_payload = {
        'generated_at': BUILD_DT.isoformat().replace('+00:00', 'Z'),
        'count': len(upcoming),
        'events': upcoming,
    }
    return write_json_if_changed(ROOT / 'polymythseminars/featured.json', featured_payload)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--featured-only', action='store_true')
    args = parser.parse_args()
    payload = json.loads(DATA.read_text(encoding='utf-8'))
    events = sorted(payload.get('events', []), key=lambda event: (str(event.get('date') or ''), str(event.get('title') or '')))
    updated = int(build_featured(events))
    if args.featured_only:
        print(f'Built compact featured feed; {updated} files updated')
        return

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    for name, (label_en, label_fr, predicate) in FOCUSES.items():
        subset = [event for event in events if predicate(event)]
        rss = build_rss(name, label_en, label_fr, subset)
        ics = build_ics(label_en, label_fr, subset)
        rss_path = ROOT / 'polymythseminars/feed.xml' if name == 'all' else OUT / f'{name}.xml'
        ics_path = OUT / f'{name}.ics'
        updated += int(write_text_if_changed(rss_path, rss))
        updated += int(write_text_if_changed(ics_path, ics))
        manifest.append({
            'id': name,
            'label': label_en,
            'label_en': label_en,
            'label_fr': label_fr,
            'count': len(subset),
            'rss': '/polymythseminars/feed.xml' if name == 'all' else f'/polymythseminars/feeds/{name}.xml',
            'ics': f'/polymythseminars/feeds/{name}.ics',
        })

    # Preserve the historical URL without presenting the ambiguous label in the UI.
    opportunities_rss = (OUT / 'opportunities.xml').read_text(encoding='utf-8')
    # Path.read_text() performs universal-newline conversion. Decode bytes
    # directly so the historical alias remains byte-identical and retains
    # the CRLF transport required by iCalendar clients.
    opportunities_ics = (OUT / 'opportunities.ics').read_bytes().decode('utf-8')
    updated += int(write_text_if_changed(OUT / 'deadlines.xml', opportunities_rss))
    updated += int(write_text_if_changed(OUT / 'deadlines.ics', opportunities_ics))

    index_payload = {
        'generated_at': BUILD_DT.isoformat().replace('+00:00', 'Z'),
        'feeds': manifest,
    }
    updated += int(write_json_if_changed(OUT / 'index.json', index_payload))
    updated += int(write_text_if_changed(ROOT / 'polymythseminars/subscribe/index.html', build_subscribe_page(manifest)))
    print(f'Built {len(manifest)} focused bilingual RSS/ICS pairs, compact featured feed, and subscription index; {updated} files updated')


if __name__ == '__main__':
    main()
