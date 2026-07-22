#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
results = []

def check(name, condition, detail=""):
    results.append({"name": name, "passed": bool(condition), "detail": detail})
    if not condition:
        raise AssertionError(f"{name}: {detail}")

page_path = ROOT / "polymythseminars/index.html"
public_page = ROOT / "public/polymythseminars/index.html"
js_path = ROOT / "js/polymythcal-revamp.js"
css_path = ROOT / "css/polymythcal-revamp.css"
events_path = ROOT / "polymythseminars/events.json"

check("revamped page exists", page_path.exists())
check("deploy mirror exists", public_page.exists())
check("page is lightweight", page_path.stat().st_size < 100_000, f"{page_path.stat().st_size} bytes")
check("source and deploy page match", page_path.read_bytes() == public_page.read_bytes())
check("source and deploy JavaScript match", js_path.read_bytes() == (ROOT / "public/js/polymythcal-revamp.js").read_bytes())
check("source and deploy CSS match", css_path.read_bytes() == (ROOT / "public/css/polymythcal-revamp.css").read_bytes())

subprocess.run(["node", "--check", str(js_path)], check=True)
check("JavaScript syntax", True)

soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "html.parser")
old_ids = ["quickFocusNav", "filterNav", "ageNav", "calendarSearch"]
check("old mutually exclusive filter system removed", not any(soup.select_one(f"#{x}") for x in old_ids))
check("academic entry points remain links rather than mutually exclusive controls", len(soup.select("#academicNav a[href]")) == 6 and not soup.select("#academicNav button"))
check("ambiguous Deadlines button removed", not any(x.get_text(" ", strip=True) == "Deadlines" for x in soup.select("button, label, a")))
check("attend and apply are independent checkboxes", len(soup.select('input[type="checkbox"][data-state-set="content"]')) == 2)
check("places are multi-select checkboxes", len(soup.select('input[type="checkbox"][data-state-set="places"]')) >= 9)
check("topics are multi-select checkboxes", len(soup.select('input[type="checkbox"][data-state-set="topics"]')) >= 7)
check("time alone uses radios", len(soup.select('input[type="radio"][name="pm-time"]')) >= 5)
check("plain language opportunity definition present", "The listed date is the deadline" in page_path.read_text(encoding="utf-8"))

payload = json.loads(events_path.read_text(encoding="utf-8"))
events = payload["events"]
check("canonical event count preserved", len(events) == 839, str(len(events)))
missing_routes = [e["id"] for e in events if not (ROOT / "polymythseminars/events" / e["id"] / "index.html").exists()]
check("all canonical event pages remain", not missing_routes, f"missing {len(missing_routes)}")
missing_public_routes = [e["id"] for e in events if not (ROOT / "public/polymythseminars/events" / e["id"] / "index.html").exists()]
check("all deploy event pages remain", not missing_public_routes, f"missing {len(missing_public_routes)}")

# Prepare a browser test document without external network font and theme requests.
html = page_path.read_text(encoding="utf-8")
browser_soup = BeautifulSoup(html, "html.parser")
for tag in browser_soup.select('script[src], link[rel="stylesheet"]'):
    tag.decompose()
test_html = ROOT / "data/polymythcal-revamp-browser-test.html"
test_html.write_text(str(browser_soup), encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page(viewport={"width": 1200, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_content(test_html.read_text(encoding="utf-8"), wait_until="domcontentloaded")
    page.add_style_tag(path=str(css_path))
    page.evaluate("""() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: key => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: key => { delete store[key]; }
      }});
    }""")
    page.evaluate("data => { window.fetch = async () => ({ok:true, json:async()=>data}); }", payload)
    page.add_script_tag(path=str(js_path))
    page.wait_for_selector(".pm-event-card", timeout=30_000)

    check("initial client render", page.locator(".pm-event-card").count() == 50, str(page.locator(".pm-event-card").count()))
    check("initial result count is populated", "listings" in page.locator("#pmResultsTitle").inner_text())
    check("both content entry points active", page.locator('input[data-state-set="content"]:checked').count() == 2)

    page.locator('input[value="toronto-gta"][data-state-set="places"]').check(force=True)
    page.locator('input[value="montreal"][data-state-set="places"]').check(force=True)
    check("multiple places can coexist", page.locator('input[data-state-set="places"]:checked').count() == 2)

    page.locator('input[value="arts"][data-state-set="topics"]').check(force=True)
    page.locator('input[value="writing"][data-state-set="topics"]').check(force=True)
    check("multiple topics can coexist", page.locator('input[data-state-set="topics"]:checked').count() == 2)

    page.locator('[data-view="calendar"]').click(force=True)
    check("calendar view renders", page.locator(".pm-calendar-day").count() == 42)
    page.locator('[data-view="list"]').click(force=True)

    first_save = page.locator("[data-save-id]").first
    saved_id = first_save.get_attribute("data-save-id")
    first_save.click(force=True)
    refreshed_save = page.locator(f'[data-save-id="{saved_id}"]').first
    check("device-local save works", refreshed_save.get_attribute("aria-pressed") == "true")

    page.set_viewport_size({"width": 320, "height": 800})
    widths = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    check("320 pixel reflow", widths[0] == widths[1], str(widths))
    check("browser has no script errors", not errors, " | ".join(errors))
    browser.close()

# French surface test.
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page(viewport={"width": 1000, "height": 800})
    page.set_content(test_html.read_text(encoding="utf-8"), wait_until="domcontentloaded")
    page.add_style_tag(path=str(css_path))
    page.evaluate("""() => {
      const store = {};
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: key => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: key => { delete store[key]; }
      }});
    }""")
    page.evaluate("data => { window.fetch = async () => ({ok:true, json:async()=>data}); }", payload)
    french_js = js_path.read_text(encoding="utf-8").replace(
        'const lang = new URLSearchParams(location.search).get("lang") === "fr" ? "fr" : "en";',
        'const lang = "fr";'
    )
    page.add_script_tag(content=french_js)
    page.wait_for_selector(".pm-event-card", timeout=30_000)
    check("French interface activates", page.locator("#pmLookingForTitle").inner_text() == "Que voulez-vous trouver?")
    check("French search placeholder", page.locator("#pmSearch").get_attribute("placeholder").startswith("Rechercher"))
    browser.close()

test_html.unlink(missing_ok=True)

report = {
    "release": "PolymythCAL Audit 18 predeploy",
    "date": "2026-07-21",
    "checks_passed": sum(1 for x in results if x["passed"]),
    "checks_total": len(results),
    "results": results,
}
(ROOT / "POLYMYTHCAL_CLARITY_REVAMP_VERIFICATION_2026-07-21.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"passed": report["checks_passed"], "total": report["checks_total"]}))
