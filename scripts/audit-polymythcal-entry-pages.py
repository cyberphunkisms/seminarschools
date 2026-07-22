#!/usr/bin/env python3
"""Browser-audit every dedicated Polymythcal entry page against the canonical corpus."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'data' / 'polymythcal-audit21'
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSON = OUT_DIR / 'entry-pages-browser-audit.json'
TORONTO = ZoneInfo('America/Toronto')
ROUTES = {
    'writingclub': ('writing', 'club', 'apply'),
    'writingkids': ('writing', 'kids', 'apply'),
    'writingjuniors': ('writing', 'juniors', 'apply'),
    'writingteens': ('writing', 'teens', 'apply'),
    'writinggrads': ('writing', 'grads', 'apply'),
    'university': ('academic', 'university', 'both'),
    'philosophy': ('academic', 'philosophy', 'both'),
    'humanities': ('academic', 'humanities', 'both'),
    'cfps': ('academic', 'cfps', 'apply'),
    'lectures': ('academic', 'lectures', 'attend'),
    'fellowships': ('academic', 'fellowships', 'apply'),
}
RESULTS: list[dict] = []


def check(name: str, passed: bool, detail='') -> None:
    RESULTS.append({'name': name, 'passed': bool(passed), 'detail': str(detail)})
    if not passed:
        raise AssertionError(f'{name}: {detail}')


def chromium_path(browser_type) -> str:
    candidates = [
        os.environ.get('CHROMIUM_PATH', '').strip(),
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    managed = getattr(browser_type, 'executable_path', '')
    if managed and Path(managed).exists():
        return managed
    raise FileNotFoundError('Chromium was not found. Set CHROMIUM_PATH or install Playwright Chromium.')


def route_matches(event: dict, slug: str) -> bool:
    group, band, _ = ROUTES[slug]
    if group == 'writing':
        bands = [str(item) for item in event.get('writing_bands') or []]
        return event.get('type') == 'contest' and (bool(bands) if band == 'club' else band in bands)
    return band in [str(item) for item in event.get('academic_bands') or []]


def current_event(event: dict) -> bool:
    value = str(event.get('end_date') or event.get('date') or '')[:10]
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return False
    return value >= datetime.now(TORONTO).date().isoformat()


def stripped_html(path: Path) -> str:
    soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
    for node in soup.select('script[src], link[rel="stylesheet"], link[rel="preconnect"], link[rel="manifest"], link[rel="icon"], link[rel="apple-touch-icon"]'):
        node.decompose()
    return str(soup)


def count_from_title(value: str) -> int:
    match = re.search(r'[\d,\s]+', value)
    return int(re.sub(r'\D', '', match.group(0))) if match and re.sub(r'\D', '', match.group(0)) else 0


payload = json.loads((ROOT / 'polymythseminars/events.json').read_text(encoding='utf-8'))
events = payload.get('events', [])
css = '\n'.join(
    (ROOT / rel).read_text(encoding='utf-8')
    for rel in ('css/theme.css', 'css/alive.css', 'css/site-wide-type-zoom.css', 'css/polymythcal-revamp.css')
    if (ROOT / rel).exists()
)
app_js = (ROOT / 'js/polymythcal-revamp.js').read_text(encoding='utf-8')

for slug, (_, _, default_content) in ROUTES.items():
    source = ROOT / slug / 'index.html'
    public = ROOT / 'public' / slug / 'index.html'
    check(f'{slug}: source page exists', source.exists())
    check(f'{slug}: public page exists', public.exists())
    check(f'{slug}: source and public match', source.read_bytes() == public.read_bytes())
    text = source.read_text(encoding='utf-8')
    soup = BeautifulSoup(text, 'html.parser')
    check(f'{slug}: route identity is explicit', soup.body and soup.body.get('data-pm-route') == slug)
    check(f'{slug}: default content is explicit', soup.body and soup.body.get('data-pm-default-content') == default_content)
    canonical = soup.select_one('link[rel="canonical"]')
    check(f'{slug}: canonical URL is correct', canonical and canonical.get('href') == f'https://seminarschools.com/{slug}/')
    check(f'{slug}: lightweight route page', source.stat().st_size < 100_000, source.stat().st_size)
    check(f'{slug}: legacy controls absent', not any(token in text for token in ('eventsContainer', 'quickFocusNav', 'watchlistPanel', 'calendarSearch', 'data-focus="deadlines"')))
    check(f'{slug}: no-script listings exist', soup.select_one('noscript .pm-noscript') is not None)
    eligible = [event for event in events if route_matches(event, slug) and current_event(event)]
    check(f'{slug}: canonical corpus has eligible records', len(eligible) > 0, len(eligible))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=chromium_path(playwright.chromium),
        args=['--no-sandbox', '--disable-dev-shm-usage'],
    )
    for slug, (_, _, default_content) in ROUTES.items():
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, timezone_id='America/Toronto')
        page = context.new_page()
        errors: list[str] = []
        page.on('pageerror', lambda error, errors=errors: errors.append(str(error)))
        page.on('console', lambda message, errors=errors: errors.append(f'{message.type}: {message.text}') if message.type == 'error' else None)
        page.set_content(stripped_html(ROOT / slug / 'index.html'), wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        page.evaluate("""data => {
          const store = {};
          Object.defineProperty(window, 'localStorage', {value: {
            getItem: key => Object.prototype.hasOwnProperty.call(store,key) ? store[key] : null,
            setItem: (key,value) => { store[key] = String(value); },
            removeItem: key => { delete store[key]; }
          }, configurable: true});
          window.fetch = async () => ({ok:true, json:async()=>data});
          try { Object.defineProperty(navigator, 'clipboard', {value:{writeText:async()=>{}}, configurable:true}); } catch (_) {}
        }""", payload)
        page.add_script_tag(content=app_js)
        page.wait_for_function("document.querySelector('#pmResultsTitle') && !/Loading|Chargement/.test(document.querySelector('#pmResultsTitle').textContent)", timeout=30_000)
        total = count_from_title(page.locator('#pmResultsTitle').inner_text())
        cards = page.locator('.pm-event-card')
        check(f'{slug}: interactive results load', total > 0, total)
        check(f'{slug}: pagination count is coherent', cards.count() == min(total, 50), f'{cards.count()} cards / {total} total')
        allowed_ids = {str(event.get('id')) for event in events if route_matches(event, slug) and current_event(event)}
        shown_ids = []
        for href in cards.locator('a[href*="/polymythseminars/events/"]').evaluate_all('nodes => [...new Set(nodes.map(n => n.getAttribute("href")))]'):
            match = re.search(r'/polymythseminars/events/([^/]+)/', href or '')
            if match:
                shown_ids.append(match.group(1))
        check(f'{slug}: every rendered result belongs to the route corpus', bool(shown_ids) and set(shown_ids) <= allowed_ids, f'{len(shown_ids)} shown')
        if default_content == 'apply':
            apply_badges = cards.locator('.pm-badge-row > .pm-badge.apply').count()
            check(f'{slug}: apply-only default is honoured', apply_badges == cards.count(), f'{apply_badges}/{cards.count()}')
        if default_content == 'attend':
            attend_badges = cards.locator('.pm-badge-row > .pm-badge.attend').count()
            check(f'{slug}: attend-only default is honoured', attend_badges == cards.count(), f'{attend_badges}/{cards.count()}')

        candidate = page.locator('label:visible input[data-state-set="topics"]:not(:disabled), label:visible input[data-state-set="places"]:not(:disabled)').first
        check(f'{slug}: at least one additional filter is clickable', candidate.count() == 1)
        candidate.check()
        check(f'{slug}: clicked filter remains selected', candidate.is_checked())
        check(f'{slug}: clicked filter becomes removable', page.locator('[data-remove-filter]').count() >= 1)
        page.locator('#pmResetFilters').click()
        check(f'{slug}: reset restores original route count', count_from_title(page.locator('#pmResultsTitle').inner_text()) == total)
        check(f'{slug}: browser console remains clean', not errors, errors)
        context.close()

    # One representative French route verifies that route-specific copy and controls translate together.
    context = browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='America/Toronto')
    page = context.new_page()
    page.set_content(stripped_html(ROOT / 'philosophy/index.html'), wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    page.evaluate("""data => {
      const store = {};
      Object.defineProperty(window, 'localStorage', {value:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]}, configurable:true});
      window.fetch = async () => ({ok:true,json:async()=>data});
    }""", payload)
    french_js = app_js.replace(
        'const lang = new URLSearchParams(location.search).get("lang") === "fr" ? "fr" : "en";',
        'const lang = "fr";'
    )
    page.add_script_tag(content=french_js)
    page.wait_for_function("document.querySelector('#pmResultsTitle') && !/Loading|Chargement/.test(document.querySelector('#pmResultsTitle').textContent)", timeout=30_000)
    check('French dedicated route translates route heading', 'Philosophie' in page.locator('h1').inner_text())
    check('French dedicated route translates filters', (page.locator('#pmLookingForTitle').text_content() or '').strip() == 'Que voulez-vous trouver?')
    check('French dedicated route reflows at 390px', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), page.evaluate('document.documentElement.scrollWidth'))
    context.close()
    browser.close()

report = {
    'release_id': json.loads((ROOT / 'RELEASE_MANIFEST.json').read_text(encoding='utf-8')).get('release_id'),
    'generated_at': json.loads((ROOT / 'RELEASE_MANIFEST.json').read_text(encoding='utf-8')).get('generated_at'),
    'routes': list(ROUTES),
    'checks_passed': sum(1 for result in RESULTS if result['passed']),
    'checks_total': len(RESULTS),
    'results': RESULTS,
}
OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': report['checks_passed'], 'total': report['checks_total'], 'routes': len(ROUTES)}))
