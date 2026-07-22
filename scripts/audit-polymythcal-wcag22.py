#!/usr/bin/env python3
"""Browser-assisted WCAG 2.2 AA audit for the current PolymythCAL interface.

The audit executes the production HTML, CSS, JavaScript, and canonical event data
locally in Chromium. Native VoiceOver and NVDA speech output remain manual tests
because those screen readers require macOS and Windows.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "polymythcal-wcag22-browser-audit.json"
OUT_MD = ROOT / "POLYMYTHCAL_WCAG22_AA_AUDIT_2026-07-22.md"
CHROMIUM = "/usr/bin/chromium"
RESULTS: list[dict[str, Any]] = []
RELEASE = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))


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


def record(name: str, passed: bool, details: Any, criterion: str, scope: str = "browser-assisted") -> None:
    RESULTS.append({
        "name": name,
        "passed": bool(passed),
        "details": details,
        "criterion": criterion,
        "scope": scope,
    })
    if not passed:
        raise AssertionError(f"{name}: {details}")


def page_assets() -> tuple[str, str, dict[str, Any], str]:
    soup = BeautifulSoup((ROOT / "polymythseminars/index.html").read_text(encoding="utf-8"), "html.parser")
    for node in soup.select('script[src], link[rel="stylesheet"], link[rel="preconnect"], link[rel="manifest"], link[rel="icon"], link[rel="apple-touch-icon"]'):
        node.decompose()
    css = "\n".join(
        (ROOT / rel).read_text(encoding="utf-8")
        for rel in ["css/theme.css", "css/alive.css", "css/site-wide-type-zoom.css", "css/polymythcal-revamp.css"]
    )
    payload = json.loads((ROOT / "polymythseminars/events.json").read_text(encoding="utf-8"))
    js = (ROOT / "js/polymythcal-revamp.js").read_text(encoding="utf-8")
    return str(soup), css, payload, js


def load_calendar(page, html: str, css: str, payload: dict[str, Any], app_js: str, query: str = "") -> None:
    page.set_content(html, wait_until="domcontentloaded")
    page.add_style_tag(content=css)
    page.evaluate(
        """data => {
          window.__pmStore = {};
          Object.defineProperty(window, 'localStorage', { configurable: true, value: {
            getItem: key => Object.prototype.hasOwnProperty.call(window.__pmStore, key) ? window.__pmStore[key] : null,
            setItem: (key, value) => { window.__pmStore[key] = String(value); },
            removeItem: key => { delete window.__pmStore[key]; },
            clear: () => { window.__pmStore = {}; }
          }});
          window.fetch = async () => ({ ok: true, status: 200, json: async () => data });
          window.__copied = '';
          try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copied = String(value); } } }); } catch (_) {}
        }""",
        payload,
    )
    js = app_js
    if query:
        js = js.replace("new URLSearchParams(location.search)", f"new URLSearchParams({json.dumps(query)})")
    page.add_script_tag(content=js)
    page.wait_for_selector(".pm-event-card", timeout=30_000)


def dom_audit(page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
          const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
          const unlabeled = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(el => {
            if (el.labels && el.labels.length) return false;
            return !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'));
          }).map(el => el.id || el.name || el.outerHTML.slice(0, 100));
          const unnamedButtons = [...document.querySelectorAll('button')].filter(el => !((el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))).length;
          const unnamedLinks = [...document.querySelectorAll('a[href]')].filter(el => !((el.textContent || '').trim() || el.getAttribute('aria-label') || el.querySelector('img[alt]'))).length;
          const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(el => Number(el.tagName.slice(1)));
          const jumps = [];
          for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) jumps.push([headings[i - 1], headings[i]]);
          const skip = document.querySelector('a.skip-link');
          const target = skip ? document.querySelector(skip.getAttribute('href')) : null;
          return {
            duplicates, unlabeled, unnamedButtons, unnamedLinks, jumps,
            skipTarget: Boolean(target), mainCount: document.querySelectorAll('main').length,
            h1Count: document.querySelectorAll('h1').length, lang: document.documentElement.lang
          };
        }"""
    )


def count_from_title(text: str) -> int:
    match = re.search(r"([\d,\s]+)", text)
    return int(re.sub(r"\D", "", match.group(1))) if match else 0


def static_page(page, rel: str, css: str, query: str = "") -> None:
    soup = BeautifulSoup((ROOT / rel).read_text(encoding="utf-8"), "html.parser")
    for node in soup.select('script[src], link[rel="stylesheet"], link[rel="preconnect"], link[rel="manifest"], link[rel="icon"], link[rel="apple-touch-icon"]'):
        node.decompose()
    page.set_content(str(soup), wait_until="domcontentloaded")
    page.add_style_tag(content=css)
    if query:
        page.evaluate("q => history.replaceState(null, '', q)", query)


def run() -> int:
    html, css, payload, app_js = page_assets()
    console_errors: list[str] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=resolve_chromium_path(pw.chromium), args=["--no-sandbox", "--disable-dev-shm-usage"])

        # Desktop, English, full interaction model.
        context = browser.new_context(viewport={"width": 1280, "height": 900}, timezone_id="America/Toronto")
        page = context.new_page()
        page.on("pageerror", lambda error: console_errors.append(f"pageerror: {error}"))
        page.on("console", lambda message: console_errors.append(f"console: {message.text}") if message.type == "error" else None)
        load_calendar(page, html, css, payload, app_js)
        dom = dom_audit(page)
        record("Calendar IDs are unique", not dom["duplicates"], dom["duplicates"], "4.1.1")
        record("Calendar form controls have programmatic labels", not dom["unlabeled"], dom["unlabeled"], "1.3.1, 3.3.2, 4.1.2")
        record("Calendar buttons and links have accessible names", dom["unnamedButtons"] == 0 and dom["unnamedLinks"] == 0, {"buttons": dom["unnamedButtons"], "links": dom["unnamedLinks"]}, "2.4.4, 4.1.2")
        record("Calendar has one main landmark and one H1", dom["mainCount"] == 1 and dom["h1Count"] == 1, dom, "1.3.1, 2.4.6")
        record("Calendar skip link targets the results region", dom["skipTarget"], dom, "2.4.1")
        record("Calendar heading order avoids skipped levels", not dom["jumps"], dom["jumps"], "1.3.1, 2.4.6")
        record("Calendar declares Canadian English", dom["lang"] == "en-CA", dom["lang"], "3.1.1")
        record("Initial results render in a bounded page", page.locator(".pm-event-card").count() == 50, page.locator(".pm-event-card").count(), "2.4.6")
        initial_count = count_from_title(page.locator("#pmResultsTitle").inner_text())
        record("Result count is announced in the results heading", initial_count > 0, page.locator("#pmResultsTitle").inner_text(), "4.1.3")
        record("Events and opportunities can remain selected together", page.locator('input[data-state-set="content"]:checked').count() == 2, page.locator('input[data-state-set="content"]:checked').count(), "3.2.2")

        page.keyboard.press("Tab")
        focus = page.evaluate("({tag:document.activeElement.tagName, cls:document.activeElement.className, outline:getComputedStyle(document.activeElement).outlineStyle})")
        record("First Tab reaches the visible-on-focus skip link", focus["tag"] == "A" and "skip-link" in focus["cls"] and focus["outline"] != "none", focus, "2.1.1, 2.4.1, 2.4.7, 2.4.11")
        page.keyboard.press("/")
        record("Slash keyboard shortcut focuses search", page.evaluate("document.activeElement === document.querySelector('#pmSearch')"), page.evaluate("document.activeElement && document.activeElement.id"), "2.1.1")

        page.locator('input[value="toronto-gta"][data-state-set="places"]').check()
        page.locator('input[value="montreal"][data-state-set="places"]').check()
        record("Multiple place filters remain operable together", page.locator('input[data-state-set="places"]:checked').count() == 2, page.locator('input[data-state-set="places"]:checked').count(), "3.2.2")

        page.locator("#pmSearch").fill("montral")
        typo_count = count_from_title(page.locator("#pmResultsTitle").inner_text())
        record("Close-spelling Montréal search returns results", typo_count > 0, typo_count, "3.3.2")
        page.locator("#pmClearSearch").click()

        save = page.locator("[data-save-id]").first
        saved_id = save.get_attribute("data-save-id")
        save.click()
        saved = page.evaluate("JSON.parse(localStorage.getItem('polymythcal.savedEvents.v2') || '[]')")
        record("Device-local saved event state persists", saved_id in saved and page.locator(f'[data-save-id="{saved_id}"]').first.get_attribute("aria-pressed") == "true", saved, "4.1.2")
        page.locator("#pmSavedToggle").click()
        record("Saved listings open as a labelled modal dialog", page.locator("#pmSavedPanel").evaluate("el => el.open") and page.locator("#pmSavedPanel").get_attribute("aria-labelledby") == "pmSavedTitle", page.locator("#pmSavedPanel").get_attribute("aria-labelledby"), "2.4.3, 4.1.2")
        page.locator("#pmCloseSaved").click()

        page.locator("#pmSearch").fill("philosophy")
        record("Save-search control becomes available for a meaningful view", page.locator("#pmSaveSearch").is_enabled(), page.locator("#pmSaveSearch").is_enabled(), "3.2.2")
        page.locator("#pmSaveSearch").click()
        saved_searches = page.evaluate("JSON.parse(localStorage.getItem('polymythcal.savedSearches.v2') || '[]')")
        saved_search_evidence = [{**item, 'savedAt': RELEASE.get('generated_at')} for item in saved_searches]
        record("Device-local saved search preserves URL state", len(saved_searches) == 1 and "q=philosophy" in saved_searches[0].get("href", ""), saved_search_evidence, "3.2.3, 4.1.2")
        page.locator("#pmShare").click()
        page.wait_for_timeout(50)
        copied = page.evaluate("window.__copied")
        record("Share-view control exposes the current URL state", "q=philosophy" in copied and "seminarschools.com" in copied, copied, "3.2.3")
        page.locator("#pmClearSearch").click()

        page.locator('[data-view="calendar"]').click()
        record("Desktop calendar view exposes a six-week grid", page.locator(".pm-calendar-day").count() == 42, page.locator(".pm-calendar-day").count(), "1.3.1")
        record("View toggle exposes its pressed state", page.locator('[data-view="calendar"]').get_attribute("aria-pressed") == "true", page.locator('[data-view="calendar"]').get_attribute("aria-pressed"), "4.1.2")
        page.locator('[data-view="list"]').click()

        # Accessibility-tree proxy for exposed names.
        session = context.new_cdp_session(page)
        tree = session.send("Accessibility.getFullAXTree")
        interactive = {"button", "link", "textbox", "combobox", "checkbox", "radio", "searchbox"}
        unnamed = []
        for node in tree.get("nodes", []):
            role = (node.get("role") or {}).get("value")
            name = (node.get("name") or {}).get("value", "")
            if role in interactive and not str(name).strip() and not node.get("ignored"):
                unnamed.append({"role": role, "nodeId": node.get("nodeId")})
        record("Chromium accessibility tree names every exposed control", not unnamed, unnamed[:20], "4.1.2", "screen-reader proxy")

        page.emulate_media(reduced_motion="reduce")
        motion = page.evaluate("""() => { const e=document.querySelector('.pm-event-card'), c=getComputedStyle(e); return {transition:c.transitionDuration, animation:c.animationDuration, scroll:getComputedStyle(document.documentElement).scrollBehavior}; }""")
        record("Reduced-motion preference suppresses motion", motion["transition"] in ("0s", "0.001s") and motion["scroll"] != "smooth", motion, "2.3.3")
        context.close()

        context = browser.new_context(viewport={"width": 1000, "height": 800}, timezone_id="America/Toronto", forced_colors="active")
        page = context.new_page()
        load_calendar(page, html, css, payload, app_js)
        page.keyboard.press("Tab")
        forced = page.evaluate("({tag:document.activeElement.tagName, cls:document.activeElement.className, outline:getComputedStyle(document.activeElement).outlineStyle, width:getComputedStyle(document.activeElement).outlineWidth})")
        record("Forced-colour mode preserves visible keyboard focus", forced["outline"] != "none" and forced["width"] != "0px", forced, "1.4.11, 2.4.7")
        context.close()

        # French URL state and bilingual labels.
        context = browser.new_context(viewport={"width": 1000, "height": 800}, timezone_id="America/Toronto")
        page = context.new_page()
        load_calendar(page, html, css, payload, app_js, "?lang=fr&q=montral&places=montreal")
        record("French URL state restores page language", page.locator("html").get_attribute("lang") == "fr-CA", page.locator("html").get_attribute("lang"), "3.1.1, 3.1.2")
        record("French URL state restores search and place filters", page.locator("#pmSearch").input_value() == "montral" and page.locator('input[value="montreal"][data-state-set="places"]').is_checked(), {"query": page.locator("#pmSearch").input_value()}, "3.2.3")
        record("French controls use translated visible labels", page.locator("#pmLookingForTitle").inner_text() == "Que voulez-vous trouver?", page.locator("#pmLookingForTitle").inner_text(), "3.1.2")
        context.close()

        # Mobile reflow, drawer, agenda, and target sizes.
        context = browser.new_context(viewport={"width": 320, "height": 800}, timezone_id="America/Toronto", reduced_motion="reduce")
        page = context.new_page()
        load_calendar(page, html, css, payload, app_js)
        dims = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        record("Calendar reflows at 320 CSS pixels", dims[0] <= dims[1] + 2, dims, "1.4.10")
        record("Mobile filter drawer starts collapsed", not page.locator("#pmFilterDrawer").evaluate("el => el.open"), page.locator("#pmFilterDrawer").evaluate("el => el.open"), "3.2.1")
        page.locator("#pmMobileFilters").click()
        record("Mobile filter button opens the filter drawer", page.locator("#pmFilterDrawer").evaluate("el => el.open"), page.locator("#pmFilterDrawer").evaluate("el => el.open"), "4.1.2")
        page.locator("#pmMobileResults").click()
        page.locator('[data-view="calendar"]').click()
        record("Mobile calendar uses a vertical agenda", page.locator(".pm-calendar-agenda").evaluate("el => getComputedStyle(el).display") != "none", page.locator(".pm-calendar-agenda").evaluate("el => getComputedStyle(el).display"), "1.3.1, 1.4.10")
        controls = page.locator("button:visible, a[href]:visible, input:visible")
        small = []
        for i in range(min(controls.count(), 140)):
            box = controls.nth(i).bounding_box()
            if box and (box["width"] < 24 or box["height"] < 24):
                small.append({"text": controls.nth(i).get_attribute("aria-label") or controls.nth(i).inner_text(), "box": box})
        record("Visible mobile targets meet the 24-pixel minimum", not small, small[:10], "2.5.8")
        context.close()

        # Submission and correction forms.
        base_css = "\n".join((ROOT / rel).read_text(encoding="utf-8") for rel in ["css/theme.css", "css/alive.css", "css/polymythcal-features.css"] if (ROOT / rel).exists())
        context = browser.new_context(viewport={"width": 320, "height": 900})
        page = context.new_page()
        static_page(page, "polymythseminars/submit/index.html", base_css)
        form_dom = dom_audit(page)
        dims = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        record("Submission fields have programmatic labels", not form_dom["unlabeled"], form_dom["unlabeled"], "1.3.1, 3.3.2")
        record("Submission form has one main landmark and H1", form_dom["mainCount"] == 1 and form_dom["h1Count"] == 1, form_dom, "1.3.1, 2.4.6")
        record("Submission form reflows at 320 CSS pixels", dims[0] <= dims[1] + 2, dims, "1.4.10")

        event_url = "https://seminarschools.com/polymythseminars/events/hayv-kahraman-nabog-2026-03-10/"
        static_page(page, "polymythseminars/correct/index.html", base_css)
        # The production script pre-fills from location; verify static labelling and URL field contract here.
        correction_dom = dom_audit(page)
        dims = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        record("Correction fields have programmatic labels", not correction_dom["unlabeled"], correction_dom["unlabeled"], "1.3.1, 3.3.2")
        record("Correction form exposes the stable-listing URL field", page.locator("#listing-url").count() == 1, page.locator("#listing-url").count(), "3.3.2")
        record("Correction form reflows at 320 CSS pixels", dims[0] <= dims[1] + 2, dims, "1.4.10")

        static_page(page, "polymythseminars/events/hayv-kahraman-nabog-2026-03-10/index.html", base_css)
        detail_dom = dom_audit(page)
        dims = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        record("Stable event page has source, calendar, and correction actions", page.locator(".pm-event-actions a").count() == 3, page.locator(".pm-event-actions a").all_inner_texts(), "2.4.4")
        record("Stable event page has one main landmark and H1", detail_dom["mainCount"] == 1 and detail_dom["h1Count"] == 1, detail_dom, "1.3.1, 2.4.6")
        record("Stable event page reflows at 320 CSS pixels", dims[0] <= dims[1] + 2, dims, "1.4.10")
        context.close()
        browser.close()

    record("Browser run completed without JavaScript errors", not console_errors, console_errors, "4.1.1")

    failed = [item for item in RESULTS if not item["passed"]]
    report = {
        "generated_at": RELEASE.get("generated_at"),
        "release": "PolymythCAL Audit 21 end-to-end",
        "standard": "WCAG 2.2 AA",
        "browser": "Chromium headless with production assets executed locally",
        "checks_passed": len(RESULTS) - len(failed),
        "checks_total": len(RESULTS),
        "checks_failed": len(failed),
        "results": RESULTS,
        "native_assistive_technology": [
            {"technology": "VoiceOver on macOS", "executed": False, "reason": "Native macOS is unavailable in this Linux environment."},
            {"technology": "NVDA on Windows", "executed": False, "reason": "Native Windows is unavailable in this Linux environment."},
        ],
        "native_protocol": "docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md",
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# PolymythCAL WCAG 2.2 AA audit",
        "",
        f"- Browser-assisted checks passed: **{report['checks_passed']}/{report['checks_total']}**",
        f"- Browser-assisted checks failed: **{report['checks_failed']}**",
        "- Native VoiceOver: manual macOS protocol retained",
        "- Native NVDA: manual Windows protocol retained",
        "",
        "## Results",
        "",
    ]
    for item in RESULTS:
        lines.append(f"- {'PASS' if item['passed'] else 'FAIL'} · {item['name']} · {item['criterion']} · `{json.dumps(item['details'], ensure_ascii=False)[:500]}`")
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["checks_passed"], "total": report["checks_total"], "failed": report["checks_failed"]}))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(run())
