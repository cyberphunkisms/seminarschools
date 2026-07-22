#!/usr/bin/env python3
"""Generate deterministic bilingual RSS and calendar-subscription feeds."""
from __future__ import annotations

import html
import json
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
ASSET_VERSION = '20260722-audit21'


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
        or bool(re.search(r'art|film|cinema|music|theatre|festival|exhibition|gallery', text(event))),
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
        lambda event: str(event.get('source_language') or '').lower().startswith('fr')
        or bool(re.search(r'\b(montréal|conférence|atelier|exposition|bibliothèque)\b', text(event))),
    ),
}


def read_release_datetime() -> datetime:
    value = None
    if RELEASE.exists():
        try:
            value = json.loads(RELEASE.read_text(encoding='utf-8')).get('generated_at')
        except Exception:
            pass
    if not value and DATA.exists():
        try:
            payload = json.loads(DATA.read_text(encoding='utf-8'))
            value = payload.get('_generated_at') or payload.get('_lifecycle_reconciled_at')
        except Exception:
            pass
    if not value:
        value = '2026-07-22T14:30:00-04:00'
    parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TORONTO)
    return parsed.astimezone(timezone.utc)


BUILD_DT = read_release_datetime()
BUILD_ICS_STAMP = BUILD_DT.strftime('%Y%m%dT%H%M%SZ')
BUILD_RFC_DATE = format_datetime(BUILD_DT)


def write_text_if_changed(path: Path, value: str) -> bool:
    encoded = value.encode('utf-8')
    if path.exists() and path.read_bytes() == encoded:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)
    return True


def write_json_if_changed(path: Path, value) -> bool:
    return write_text_if_changed(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def escape_ics(value) -> str:
    return str(value or '').replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\r\n', '\\n').replace('\n', '\\n').replace('\r', '\\n')


def fold_ics_line(line: str) -> str:
    encoded = line.encode('utf-8')
    chunks = []
    while len(encoded) > 75:
        cut = 75
        while cut > 0 and (encoded[cut] & 0xC0) == 0x80:
            cut -= 1
        chunks.append(encoded[:cut].decode('utf-8'))
        encoded = encoded[cut:]
    chunks.append(encoded.decode('utf-8'))
    return '\r\n '.join(chunks)


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
            f'<a href="{html.escape(feed["ics"], quote=True)}">ICS</a>'
            '</span></li>'
        )
    return f'''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Polymythcal subscriptions · Abonnements Polymythcal</title><meta property="og:type" content="website"><meta property="og:url" content="https://seminarschools.com/polymythseminars/subscribe/"><meta property="og:title" content="Polymythcal subscriptions · Abonnements Polymythcal"><meta property="og:description" content="Focused RSS and calendar subscriptions for Polymythcal listings."><meta property="og:image" content="https://seminarschools.com/og-image.png"><meta name="description" content="Focused Polymythcal RSS and calendar subscriptions for confirmed, regional, civic, arts, learning, opportunity, English, and French listings."><meta name="robots" content="index,follow"><link rel="canonical" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="alternate" hreflang="en-ca" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="alternate" hreflang="fr-ca" href="https://seminarschools.com/polymythseminars/subscribe/?lang=fr"><link rel="alternate" hreflang="x-default" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/css/alive.css"><link rel="stylesheet" href="/css/polymythcal-features.css?v={ASSET_VERSION}"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a"></head><body data-route-type="calendar-form" data-geometry="indra-web" data-indra-intensity="0.055"><a class="skip-link" href="#main-content">Skip to subscriptions · Aller aux abonnements</a><main class="pm-form-shell" id="main-content"><p><a href="/polymythseminars/">← Polymythcal</a></p><h1>Subscriptions · <span lang="fr">Abonnements</span></h1><p>RSS works in feed readers. ICS works in calendar apps. · <span lang="fr">RSS fonctionne dans les lecteurs de fils. ICS fonctionne dans les applications de calendrier.</span></p><ul class="pm-feed-list">{''.join(rows)}</ul></main><script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v={ASSET_VERSION}" defer></script><script defer src="/js/site-keyboard-enhancements.js"></script><script defer src="/js/mandala.js?v=cl91"></script><script defer src="/js/indra.js?v=cl91"></script></body></html>'''


def main():
    payload = json.loads(DATA.read_text(encoding='utf-8'))
    events = sorted(payload.get('events', []), key=lambda event: (str(event.get('date') or ''), str(event.get('title') or '')))
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    updated = 0

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
    opportunities_ics = (OUT / 'opportunities.ics').read_text(encoding='utf-8')
    updated += int(write_text_if_changed(OUT / 'deadlines.xml', opportunities_rss))
    updated += int(write_text_if_changed(OUT / 'deadlines.ics', opportunities_ics))

    index_payload = {
        'generated_at': BUILD_DT.isoformat().replace('+00:00', 'Z'),
        'feeds': manifest,
    }
    updated += int(write_json_if_changed(OUT / 'index.json', index_payload))
    updated += int(write_text_if_changed(ROOT / 'polymythseminars/subscribe/index.html', build_subscribe_page(manifest)))
    print(f'Built {len(manifest)} focused bilingual RSS/ICS pairs and subscription index; {updated} files updated')


if __name__ == '__main__':
    main()
