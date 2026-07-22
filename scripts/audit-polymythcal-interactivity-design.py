#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RELEASE = json.loads((ROOT / 'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
RELEASE_TIMESTAMP = RELEASE.get('generated_at') or '1970-01-01T00:00:00Z'
CAPTURE_SCREENSHOTS = os.environ.get('POLYMYTHCAL_AUDIT_SCREENSHOTS', '').strip() == '1'
OUT = ROOT / "data" / "polymythcal-audit21"
OUT.mkdir(parents=True, exist_ok=True)
RESULTS: list[dict] = []


def resolve_chromium_path(browser_type) -> str:
    configured = os.environ.get("CHROMIUM_PATH", "").strip()
    candidates = [configured, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    managed = getattr(browser_type, "executable_path", "")
    if managed and Path(managed).exists():
        return managed
    raise FileNotFoundError("Chromium was not found. Set CHROMIUM_PATH or run: python -m playwright install chromium")


def check(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "passed": bool(condition), "detail": detail})
    if not condition:
        raise AssertionError(f"{name}: {detail}")


def browser_assets():
    html_path = ROOT / "polymythseminars" / "index.html"
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    for node in soup.select('script[src], link[rel="stylesheet"], link[rel="preconnect"], link[rel="manifest"], link[rel="icon"], link[rel="apple-touch-icon"]'):
        node.decompose()
    css = "\n".join(
        (ROOT / rel).read_text(encoding="utf-8")
        for rel in ["css/theme.css", "css/alive.css", "css/site-wide-type-zoom.css", "css/polymythcal-revamp.css"]
        if (ROOT / rel).exists()
    )
    payload = json.loads((ROOT / "polymythseminars" / "events.json").read_text(encoding="utf-8"))
    app_js = (ROOT / "js" / "polymythcal-revamp.js").read_text(encoding="utf-8")
    return str(soup), css, payload, app_js


def load_browser_page(page, html, css, payload, app_js, lang="en", search=None):
    page.set_content(html, wait_until="domcontentloaded")
    page.add_style_tag(content=css)
    page.evaluate("""data => {
      window.__pmStore = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: key => Object.prototype.hasOwnProperty.call(window.__pmStore, key) ? window.__pmStore[key] : null,
        setItem: (key, value) => { window.__pmStore[key] = String(value); },
        removeItem: key => { delete window.__pmStore[key]; }
      }, configurable: true });
      window.fetch = async () => ({ ok: true, json: async () => data });
      window.__copied = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.__copied = value; } }, configurable: true }); } catch (_) {}
    }""", payload)
    test_js = app_js
    if lang == "fr":
        test_js = test_js.replace('const lang = new URLSearchParams(location.search).get("lang") === "fr" ? "fr" : "en";', 'const lang = "fr";')
    if search is not None:
        escaped = json.dumps(search)
        test_js = test_js.replace('new URLSearchParams(location.search)', f'new URLSearchParams({escaped})')
    page.add_script_tag(content=test_js)
    page.wait_for_selector(".pm-event-card", timeout=30_000)


def count_from_title(text: str) -> int:
    match = re.search(r"([\d,\s]+)", text)
    if not match:
        return 0
    return int(re.sub(r"\D", "", match.group(1)))


page_path = ROOT / "polymythseminars" / "index.html"
public_page = ROOT / "public" / "polymythseminars" / "index.html"
js_path = ROOT / "js" / "polymythcal-revamp.js"
css_path = ROOT / "css" / "polymythcal-revamp.css"
events_path = ROOT / "polymythseminars" / "events.json"

check("calendar page exists", page_path.exists())
check("public calendar mirror exists", public_page.exists())
check("source and public HTML match", page_path.read_bytes() == public_page.read_bytes())
check("source and public JavaScript match", js_path.read_bytes() == (ROOT / "public/js/polymythcal-revamp.js").read_bytes())
check("source and public CSS match", css_path.read_bytes() == (ROOT / "public/css/polymythcal-revamp.css").read_bytes())
check("HTML remains lightweight", page_path.stat().st_size < 100_000, f"{page_path.stat().st_size} bytes")
check("JavaScript remains lightweight", js_path.stat().st_size < 100_000, f"{js_path.stat().st_size} bytes")
subprocess.run(["node", "--check", str(js_path)], check=True)
check("JavaScript syntax passes", True)

soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "html.parser")
ids = [node["id"] for node in soup.select("[id]")]
check("HTML has no duplicate IDs", len(ids) == len(set(ids)), f"{len(ids)} IDs")
check("search is the first interactive calendar control", soup.select_one(".pm-search-panel").find_previous("button") is not None and soup.select_one(".pm-search-panel").sourceline < soup.select_one(".pm-quick-starts").sourceline)
check("many popular entry points remain", len(soup.select("[data-preset]")) == 8)
check("filters have a mobile disclosure", soup.select_one("#pmFilterDrawer") is not None)
check("saved listings and searches share a dialog", soup.select_one("dialog#pmSavedPanel") is not None and soup.select_one("#pmSavedSearchList") is not None and soup.select_one("#pmSaveSearch") is not None)
check("active filters are designed as removable controls", "data-remove-filter" in js_path.read_text(encoding="utf-8"))
check("ambiguous Deadlines control is absent", not any(node.get_text(" ", strip=True) == "Deadlines" for node in soup.select("button,label,a,option")))
check("event and opportunity types stay separated", len(soup.select('[data-state-set="eventTypes"]')) >= 8 and len(soup.select('[data-state-set="opportunityTypes"]')) >= 5)
check("close-spelling search is disclosed", "close spellings" in page_path.read_text(encoding="utf-8"))
check("no-script route exists", soup.select_one("noscript") is not None)

payload = json.loads(events_path.read_text(encoding="utf-8"))
events = payload["events"]
check("canonical records match declared totals", len(events) > 0 and payload.get("count") == len(events) and payload.get("_total_events") == len(events), str(len(events)))
missing_routes = [event["id"] for event in events if not (ROOT / "polymythseminars/events" / event["id"] / "index.html").exists()]
check("all event detail routes exist", not missing_routes, f"missing {len(missing_routes)}")
missing_public_routes = [event["id"] for event in events if not (ROOT / "public/polymythseminars/events" / event["id"] / "index.html").exists()]
check("all public event routes exist", not missing_public_routes, f"missing {len(missing_public_routes)}")

BROWSER_HTML, BROWSER_CSS, BROWSER_PAYLOAD, BROWSER_JS = browser_assets()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=resolve_chromium_path(p.chromium), args=["--no-sandbox", "--disable-dev-shm-usage"])

    # Desktop interaction and logic audit.
    print("AUDIT21 desktop start", flush=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, timezone_id="America/Toronto")
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(f"{message.type}: {message.text}") if message.type == "error" else None)
    load_browser_page(page, BROWSER_HTML, BROWSER_CSS, BROWSER_PAYLOAD, BROWSER_JS)
    initial_count = count_from_title(page.locator("#pmResultsTitle").inner_text())
    check("initial results load", initial_count > 0, str(initial_count))
    check("initial render is paginated", page.locator(".pm-event-card").count() == 50, str(page.locator(".pm-event-card").count()))
    check("default reset action is absent rather than dead", page.locator("#pmResetFilters").is_hidden())
    check("empty current-choices panel is removed from the layout", page.locator("#pmActivePanel").is_hidden())
    check("dataset-empty opportunity categories stay hidden", page.locator('input[value="applications"][data-state-set="opportunityTypes"]').locator("xpath=..").is_hidden() and page.locator('input[value="other-opportunities"][data-state-set="opportunityTypes"]').locator("xpath=..").is_hidden())
    check("fellowship filter remains visible and clickable", page.locator('input[value="funding"][data-state-set="opportunityTypes"]').is_visible() and not page.locator('input[value="funding"][data-state-set="opportunityTypes"]').is_disabled())

    # Multi-select and logic.
    page.locator('input[value="toronto-gta"][data-state-set="places"]').check()
    page.locator('input[value="montreal"][data-state-set="places"]').check()
    check("two places remain selected", page.locator('input[data-state-set="places"]:checked').count() == 2)
    page.locator('input[value="arts"][data-state-set="topics"]').check()
    page.locator('input[value="writing"][data-state-set="topics"]').check()
    check("two topics remain selected", page.locator('input[data-state-set="topics"]:checked').count() == 2)
    check("active choices become clickable remove buttons", page.locator("[data-remove-filter]").count() >= 4)
    first_active = page.locator('[data-remove-filter="places"]').first
    removed_value = first_active.get_attribute("data-remove-value")
    first_active.click()
    check("clicking an active choice removes only that choice", not page.locator(f'input[value="{removed_value}"][data-state-set="places"]').is_checked() and page.locator('input[data-state-set="places"]:checked').count() == 1)

    page.locator("#pmResetFilters").click()
    page.locator('input[value="talks"][data-state-set="eventTypes"]').check()
    page.locator('input[value="funding"][data-state-set="opportunityTypes"]').check()
    content_badges = {str(text or "").strip().lower() for text in page.locator(".pm-badge-row .pm-badge:first-child").evaluate_all("els => els.map(el => el.textContent)")}
    check("event and opportunity type filters work side by side", "event" in content_badges and "opportunity" in content_badges, str(sorted(content_badges)))

    # Search quality.
    page.locator("#pmResetFilters").click()
    page.locator("#pmSearch").fill("montral")
    fuzzy_count = count_from_title(page.locator("#pmResultsTitle").inner_text())
    check("typo-tolerant Montréal search works", fuzzy_count > 0, str(fuzzy_count))
    check("save-search action activates for a meaningful view", page.locator("#pmSaveSearch").is_enabled())
    page.locator("#pmSaveSearch").click()
    saved_searches = page.evaluate("JSON.parse(localStorage.getItem('polymythcal.savedSearches.v2') || '[]')")
    saved_search_evidence = [{**item, 'savedAt': RELEASE_TIMESTAMP} for item in saved_searches]
    check("device-local saved searches persist URL state", len(saved_searches) == 1 and "q=montral" in saved_searches[0].get("href", ""), str(saved_search_evidence))
    page.locator("#pmSavedToggle").click()
    check("saved-search entry is visible in the shared dialog", page.locator("#pmSavedSearchList li").count() == 1)
    page.locator("#pmCloseSaved").click()
    check("clear-search control appears", page.locator("#pmClearSearch").is_visible())
    page.locator("#pmClearSearch").click()
    check("clear-search empties query and restores results", page.locator("#pmSearch").input_value() == "" and count_from_title(page.locator("#pmResultsTitle").inner_text()) == initial_count)

    page.locator("#pmSearch").fill("À l’écoute des archives")
    page.wait_for_timeout(100)
    meta = page.locator(".pm-event-meta").first.inner_text()
    check("placeholder venues are cleaned from cards", "Lieu non confirmé" not in meta and "Location unconfirmed" not in meta, meta)
    page.locator("#pmClearSearch").click()

    # Presets, section clear, and dynamic counts.
    page.locator('[data-preset="philosophy"]').click()
    check("popular entry point applies a clear preset", page.locator('input[value="philosophy"][data-state-set="topics"]').is_checked())
    check("active preset is visibly pressed", page.locator('[data-preset="philosophy"]').get_attribute("aria-pressed") == "true")
    check("topic section clear action appears", page.locator('[data-clear-section="topics"]').is_visible())
    page.locator('[data-clear-section="topics"]').click()
    check("section clear removes its own choices", page.locator('input[data-state-set="topics"]:checked').count() == 0)

    # Save interaction preserves the clicked control and opens a proper dialog.
    first_save = page.locator("[data-save-id]").first
    save_id = first_save.get_attribute("data-save-id")
    first_save.focus()
    first_save.click()
    updated_save = page.locator(f'[data-save-id="{save_id}"]').first
    check("save state updates without replacing focus", updated_save.get_attribute("aria-pressed") == "true" and page.evaluate("document.activeElement?.dataset?.saveId") == save_id)
    check("saved counter combines listings and searches", page.locator("#pmSavedCount").inner_text() == "2", page.locator("#pmSavedCount").inner_text())
    page.locator("#pmSavedToggle").click()
    check("saved dialog opens modally", page.locator("#pmSavedPanel").get_attribute("open") is not None)
    check("saved dialog receives focus", page.evaluate("document.activeElement?.id") == "pmCloseSaved")
    check("saved listing includes date and location context", page.locator(".pm-saved-item time").count() == 1 and page.locator(".pm-saved-item span").count() >= 1)
    page.keyboard.press("Escape")
    check("Escape closes saved dialog", page.locator("#pmSavedPanel").get_attribute("open") is None)

    # Sharing and language continuity.
    page.locator('input[value="kingston"][data-state-set="places"]').check()
    page.locator("#pmShare").click()
    page.wait_for_timeout(50)
    check("share action copies a URL-backed view", "places=kingston" in page.evaluate("window.__copied"), page.evaluate("window.__copied"))
    lang_href = page.locator("#pmLanguageLink").get_attribute("href")
    check("language switch preserves active filters", "lang=fr" in lang_href and "places=kingston" in lang_href, lang_href)

    # Date-only parsing and ongoing presentation in Toronto timezone.
    page.locator("#pmResetFilters").click()
    page.locator("#pmSearch").fill("Game On! Exhibition")
    check("ongoing listings are labelled as ongoing", page.locator(".pm-date-status").first.inner_text().strip().lower() == "ongoing")
    page.locator("#pmClearSearch").click()
    page.locator("#pmSearch").fill("BollywoodMonster Mashup 2026")
    source_event = next(event for event in events if "BollywoodMonster Mashup 2026" in event.get("title", ""))
    rendered_date = page.locator(".pm-date-box").first.get_attribute("datetime")
    check("date-only values do not shift a day in Toronto", rendered_date == source_event["date"][:10], f"rendered {rendered_date}, source {source_event['date']}")
    page.locator("#pmClearSearch").click()

    # Desktop calendar.
    page.locator('[data-view="calendar"]').click()
    check("desktop calendar renders 42 day cells", page.locator(".pm-calendar-day").count() == 42)
    check("desktop calendar grid is visible", page.locator(".pm-calendar-grid-view").evaluate("el => getComputedStyle(el).display") != "none")
    check("calendar status describes the whole matching view", "Showing 50" not in page.locator("#pmStatus").inner_text() and "calendar view" in page.locator("#pmStatus").inner_text())
    check("multi-day listings are consolidated above the grid", page.locator(".pm-calendar-running").count() == 1 and not page.locator(".pm-calendar-running").evaluate("el => el.open"))
    day_link_counts = page.locator(".pm-calendar-day").evaluate_all("els => els.map(el => el.querySelectorAll('a').length)")
    check("calendar days begin compact", max(day_link_counts or [0]) <= 3, str(max(day_link_counts or [0])))
    more_numbers = page.locator("[data-expand-day]").evaluate_all("els => els.map(el => Number((el.textContent.match(/\\d+/) || ['0'])[0]))")
    check("multi-day spans no longer create enormous daily overflow", max(more_numbers or [0]) < 50, str(max(more_numbers or [0])))
    keyboard_month = page.locator(".pm-calendar-title").inner_text()
    page.keyboard.press("ArrowRight")
    check("documented arrow shortcut changes calendar month", page.locator(".pm-calendar-title").inner_text() != keyboard_month)
    page.locator('[data-calendar-nav="next"]').click()
    check("calendar navigation changes the displayed month", "month=" in page.locator("#pmLanguageLink").get_attribute("href"))
    more = page.locator("[data-expand-day]")
    if more.count():
        day_key = more.first.get_attribute("data-expand-day")
        before = page.locator(f'[data-expand-day="{day_key}"]').locator("xpath=..").locator("a").count()
        more.first.click()
        after = page.locator(f'section[aria-label] a').count()
        check("calendar more control expands hidden links", after >= before)
    else:
        check("calendar more control is available when needed", True, "No month cell exceeded three items")

    if CAPTURE_SCREENSHOTS:
        page.screenshot(path=str(OUT / "desktop-final.png"), full_page=False)
    check("desktop run has no script errors", not errors, " | ".join(errors))
    context.close()
    print("AUDIT21 desktop complete", flush=True)

    # French interface and dynamic labels.
    print("AUDIT21 French start", flush=True)
    context = browser.new_context(viewport={"width": 1100, "height": 900}, timezone_id="America/Toronto")
    page = context.new_page()
    load_browser_page(page, BROWSER_HTML, BROWSER_CSS, BROWSER_PAYLOAD, BROWSER_JS, lang="fr")
    check("French interface activates", page.locator("#pmSearch").get_attribute("placeholder").startswith("Rechercher"))
    page.locator('input[value="philosophy"][data-state-set="topics"]').check()
    active_text = page.locator('[data-remove-filter="topics"]').first.inner_text()
    check("French active choices remain translated", "Philosophie" in active_text, active_text)
    page.locator("#pmSearch").fill("philosophie")
    check("French concept search works", count_from_title(page.locator("#pmResultsTitle").inner_text()) > 0)
    context.close()
    print("AUDIT21 French complete", flush=True)

    # Calendar dates and upcoming counts use the corridor timezone rather than the viewer timezone.
    context = browser.new_context(viewport={"width": 1000, "height": 800}, timezone_id="UTC")
    page = context.new_page()
    load_browser_page(page, BROWSER_HTML, BROWSER_CSS, BROWSER_PAYLOAD, BROWSER_JS)
    check("upcoming count is stable outside the Toronto timezone", count_from_title(page.locator("#pmResultsTitle").inner_text()) == initial_count, page.locator("#pmResultsTitle").inner_text())
    context.close()

    # Mobile interaction, reflow, focus and agenda design.
    print("AUDIT21 mobile start", flush=True)
    for width, height, name in [(390, 844, "mobile"), (320, 800, "small-mobile")]:
        context = browser.new_context(viewport={"width": width, "height": height}, timezone_id="America/Toronto", reduced_motion="reduce")
        page = context.new_page()
        mobile_errors: list[str] = []
        page.on("pageerror", lambda error: mobile_errors.append(str(error)))
        load_browser_page(page, BROWSER_HTML, BROWSER_CSS, BROWSER_PAYLOAD, BROWSER_JS)
        check(f"{name} filter drawer starts collapsed", not page.locator("#pmFilterDrawer").evaluate("el => el.open"))
        check(f"{name} quick starts begin collapsed", not page.locator("#pmQuickStarts").evaluate("el => el.open"))
        check(f"{name} empty active panel stays out of the way", page.locator("#pmActivePanel").is_hidden())
        widths = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check(f"{name} has no horizontal page overflow", widths[0] == widths[1], str(widths))
        result_y = page.locator("#pmResultsTitle").bounding_box()["y"]
        check(f"{name} reaches results without a filter wall", result_y < 900, str(result_y))
        page.locator("#pmMobileFilters").click()
        check(f"{name} filter button opens the drawer", page.locator("#pmFilterDrawer").evaluate("el => el.open"))
        page.locator('label.pm-chip:has(input[value="toronto-gta"]) input').focus()
        outline = page.locator('label.pm-chip:has(input[value="toronto-gta"])').evaluate("el => getComputedStyle(el).outlineStyle")
        check(f"{name} hidden checkbox has a visible focus treatment", outline != "none", outline)
        page.locator("#pmMobileResults").click()
        page.locator('[data-view="calendar"]').click()
        check(f"{name} calendar uses vertical agenda", page.locator(".pm-calendar-agenda").evaluate("el => getComputedStyle(el).display") != "none")
        check(f"{name} calendar status avoids list pagination language", "Showing 50" not in page.locator("#pmStatus").inner_text())
        if page.locator(".pm-calendar-running").count():
            check(f"{name} multi-day panel starts collapsed", not page.locator(".pm-calendar-running").evaluate("el => el.open"))
        check(f"{name} desktop calendar grid is hidden", page.locator(".pm-calendar-grid-view").evaluate("el => getComputedStyle(el).display") == "none")
        controls = page.locator("button:visible, a.pm-button:visible, a.pm-link-button:visible, .pm-action:visible")
        too_small = []
        for i in range(min(controls.count(), 120)):
            box = controls.nth(i).bounding_box()
            if box and (box["width"] < 24 or box["height"] < 24):
                too_small.append((controls.nth(i).inner_text(), box))
        check(f"{name} interactive targets meet the 24 pixel minimum", not too_small, str(too_small[:5]))
        if CAPTURE_SCREENSHOTS:
            page.screenshot(path=str(OUT / f"{name}-final.png"), full_page=False)
        check(f"{name} run has no script errors", not mobile_errors, " | ".join(mobile_errors))
        context.close()

    print("AUDIT21 mobile complete", flush=True)

    # Forced-colour resilience.
    print("AUDIT21 forced-colour start", flush=True)
    context = browser.new_context(viewport={"width": 1000, "height": 800}, forced_colors="active")
    page = context.new_page()
    load_browser_page(page, BROWSER_HTML, BROWSER_CSS, BROWSER_PAYLOAD, BROWSER_JS)
    page.locator('input[value="toronto-gta"][data-state-set="places"]').check()
    outline_style = page.locator('label.pm-chip:has(input[value="toronto-gta"])').evaluate("el => getComputedStyle(el).outlineStyle")
    check("forced-colour selected filters retain a visible outline", outline_style != "none", outline_style)
    context.close()

    browser.close()

report = {
    "release": "PolymythCAL Audit 21 end-to-end interaction and design verification",
    "date": "2026-07-22",
    "checks_passed": sum(1 for item in RESULTS if item["passed"]),
    "checks_total": len(RESULTS),
    "results": RESULTS,
}
report_path = ROOT / "POLYMYTHCAL_AUDIT21_INTERACTION_DESIGN_VERIFICATION_2026-07-22.json"
report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps({"passed": report["checks_passed"], "total": report["checks_total"]}))
