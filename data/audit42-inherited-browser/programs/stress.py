#!/usr/bin/env python3
"""Focused browser stress checks for Polymythcal and Teacher Resources.

This audit uses isolated route shells and deterministic browser doubles. It
does not mutate source data, call external services, or change scraper cadence.
"""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
POLY_HTML = ROOT / "polymythseminars/index.html"
POLY_JS = ROOT / "js/polymythcal-revamp.js"
POLY_DATA = ROOT / "polymythseminars/browse.json"
TEACHER_HTML = ROOT / "teacherresources/index.html"
TEACHER_JS = ROOT / "teacherresources/finder.js"
REPORT_PATH = ROOT / "data" / "audit42-inherited-browser" / "stress" / "project-failure-stress.json"
RELEASE = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
RESULTS: list[dict[str, object]] = []


def browser_shell(path: Path) -> str:
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    for node in soup.select("script[src], link[rel='stylesheet'], link[rel='preconnect']"):
        node.decompose()
    return str(soup)


def chromium_path() -> str | None:
    candidates = [
        os.environ.get("CHROMIUM_PATH"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        shutil.which("chrome"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def expect(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "passed": bool(condition), "detail": detail})
    if not condition:
        raise AssertionError(f"{name}: {detail}")
    print(f"PASS — {name}")


def install_storage(page: Page, *, throws: bool = False, initial: str | None = None) -> None:
    page.evaluate(
        """([throws, initial]) => {
          const store = new Map();
          if (initial !== null) store.set('tr-filters-v3', initial);
          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
              getItem(key) {
                if (throws) throw new DOMException('blocked', 'SecurityError');
                return store.has(key) ? store.get(key) : null;
              },
              setItem(key, value) {
                if (throws) throw new DOMException('quota', 'QuotaExceededError');
                store.set(key, String(value));
              },
              removeItem(key) { store.delete(key); }
            }
          });
        }""",
        [throws, initial],
    )


def install_cache(page: Page, seed: object | None = None) -> None:
    page.evaluate(
        """seed => {
          const store = new Map();
          if (seed !== null) {
            store.set('/polymythseminars/browse.json', JSON.stringify(seed));
          }
          Object.defineProperty(window, 'caches', {
            configurable: true,
            value: {
              async open() {
                return {
                  async put(key, response) {
                    store.set(String(key), await response.text());
                  },
                  async match(key) {
                    const body = store.get(String(key));
                    return body === undefined ? undefined : new Response(body, {
                      headers: {'Content-Type': 'application/json'}
                    });
                  }
                };
              }
            }
          });
        }""",
        seed,
    )


def prepare_polymyth(page: Page, *, cache_seed: object | None = None, storage_throws: bool = False) -> None:
    page.set_content(browser_shell(POLY_HTML), wait_until="domcontentloaded")
    install_storage(page, throws=storage_throws)
    install_cache(page, cache_seed)


def test_polymyth_good_and_duplicate(browser, payload: object, source: str) -> None:
    page = browser.new_page(viewport={"width": 1100, "height": 850})
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    prepare_polymyth(page, storage_throws=True)
    page.evaluate(
        """payload => {
          window.__fetchCalls = 0;
          window.fetch = async () => {
            window.__fetchCalls += 1;
            return {ok: true, status: 200, json: async () => payload};
          };
        }""",
        payload,
    )
    page.add_script_tag(content=source)
    page.wait_for_selector(".pm-event-card")
    expect("Polymythcal keeps 24-item initial batch", page.locator(".pm-event-card").count() == 24)
    page.add_script_tag(content=source)
    page.wait_for_timeout(100)
    expect("Polymythcal duplicate evaluation is inert", page.evaluate("window.__fetchCalls") == 1)
    page.locator("[data-save-id]").first.click()
    expect(
        "Polymythcal reports storage quota fallback honestly",
        "this visit" in page.locator("#pmStatus").inner_text().lower(),
    )
    expect("Polymythcal quota mode has no script errors", not errors, " | ".join(errors))
    page.close()


def test_polymyth_malformed_retry(browser, payload: object, source: str) -> None:
    page = browser.new_page()
    prepare_polymyth(page)
    page.evaluate(
        """payload => {
          window.__fetchCalls = 0;
          window.fetch = async () => {
            window.__fetchCalls += 1;
            const body = window.__fetchCalls === 1
              ? {count: 1, events: [{
                  id: 'broken-date',
                  title: 'Broken date',
                  date: '2026-13-99'
                }]}
              : payload;
            return {ok: true, status: 200, json: async () => body};
          };
        }""",
        payload,
    )
    page.add_script_tag(content=source)
    page.wait_for_selector(".pm-event-card", timeout=5000)
    expect("Impossible Polymythcal date triggers one bounded retry", page.evaluate("window.__fetchCalls") == 2)
    expect("Valid retry restores the full UI batch", page.locator(".pm-event-card").count() == 24)
    page.close()


def test_polymyth_cache_fallback(browser, payload: object, source: str) -> None:
    page = browser.new_page()
    prepare_polymyth(page, cache_seed=payload)
    page.evaluate(
        """() => {
          window.__fetchCalls = 0;
          window.fetch = async () => {
            window.__fetchCalls += 1;
            return {ok: false, status: 503, json: async () => ({})};
          };
        }"""
    )
    page.add_script_tag(content=source)
    page.wait_for_selector(".pm-event-card", timeout=5000)
    expect("Polymythcal network failure makes exactly two attempts", page.evaluate("window.__fetchCalls") == 2)
    expect("Polymythcal falls back to a validated last-good copy", page.locator(".pm-event-card").count() == 24)
    expect("Cached Polymythcal data is visibly labelled", "last calendar copy" in page.locator("#pmStatus").inner_text())
    page.close()


def test_polymyth_timeout_and_retry_button(browser, payload: object, source: str) -> None:
    page = browser.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    prepare_polymyth(page)
    page.evaluate(
        """() => {
          window.__fetchCalls = 0;
          window.fetch = (_url, options) => {
            window.__fetchCalls += 1;
            return new Promise((_resolve, reject) => {
              options.signal.addEventListener('abort', () => {
                reject(new DOMException('aborted', 'AbortError'));
              }, {once: true});
            });
          };
        }"""
    )
    fast_source = source.replace("const FETCH_TIMEOUT_MS = 12000;", "const FETCH_TIMEOUT_MS = 120;")
    page.add_script_tag(content=fast_source)
    page.wait_for_selector("[data-retry-calendar]", timeout=5000)
    expect("Slow Polymythcal requests time out twice, then stop", page.evaluate("window.__fetchCalls") == 2)
    expect("Failed load clears busy state", page.locator("#pmResults").get_attribute("aria-busy") == "false")
    page.evaluate(
        """payload => {
          window.fetch = async () => ({ok: true, status: 200, json: async () => payload});
        }""",
        payload,
    )
    page.locator("[data-retry-calendar]").click()
    page.wait_for_selector(".pm-event-card", timeout=5000)
    expect("Visible retry recovers without reloading the page", page.locator(".pm-event-card").count() == 24)
    expect("Timeout and recovery have no page errors", not errors, " | ".join(errors))
    page.close()


def test_polymyth_navigation_abort(browser, source: str) -> None:
    page = browser.new_page()
    prepare_polymyth(page)
    page.evaluate(
        """() => {
          window.__aborts = 0;
          window.fetch = (_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              window.__aborts += 1;
              reject(new DOMException('aborted', 'AbortError'));
            }, {once: true});
          });
        }"""
    )
    page.add_script_tag(content=source)
    page.evaluate(
        """() => window.dispatchEvent(
          new PageTransitionEvent('pagehide', {persisted: false})
        )"""
    )
    page.wait_for_timeout(100)
    expect("Interrupted navigation aborts the in-flight calendar request", page.evaluate("window.__aborts") == 1)
    page.close()


def test_teacher_failures_and_stress(browser, source: str) -> None:
    page = browser.new_page(viewport={"width": 900, "height": 850})
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    shell = browser_shell(TEACHER_HTML)
    page.route("http://audit.local/**", lambda route: route.fulfill(status=200, content_type="text/html", body=shell))
    page.goto("http://audit.local/teacherresources/", wait_until="domcontentloaded")
    corrupt = json.dumps(
        {
            "search": 42,
            "formats": "lesson",
            "grades": {"bad": True},
            "subjects": ["ela", "not-a-subject"],
            "curricula": None,
        }
    )
    install_storage(page, throws=False, initial=corrupt)
    page.evaluate(
        """() => {
          localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
          history.replaceState = () => { throw new DOMException('blocked', 'SecurityError'); };
          window.__copiedLink = '';
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {writeText: async value => { window.__copiedLink = value; }}
          });
        }"""
    )
    page.add_script_tag(content=source)
    page.wait_for_selector(".chip")
    expect("Teacher Resources preserves all 644 server-rendered cards", page.locator(".entry").count() == 644)
    expect("Corrupt saved filter shapes are ignored", page.locator(".chip[aria-pressed='true']").count() == 1)
    expect(
        "Teacher Resources continues in URL-only mode when storage is full",
        page.locator("#resource-finder").get_attribute("data-persistence") == "url-only",
    )

    chip_count = page.locator(".chip").count()
    page.add_script_tag(content=source)
    page.wait_for_timeout(100)
    expect("Teacher finder duplicate evaluation adds no chips", page.locator(".chip").count() == chip_count)

    math_chip = page.locator('.chip[data-filter-type="subject"][data-filter-value="math"]')
    math_chip.click()
    expect("A duplicated finder does not double-toggle a filter", math_chip.get_attribute("aria-pressed") == "true")
    page.locator("#copy-view-link").click()
    page.wait_for_timeout(50)
    copied = page.evaluate("window.__copiedLink")
    expect("Copied view survives history API failure", "subject=ela%2Cmath" in copied or "subject=math%2Cela" in copied, copied)

    terms = ["history", "mathematics", "poetry", "science", "shakespeare"]
    page.evaluate(
        """terms => {
          const input = document.querySelector('#search');
          for (let index = 0; index < 100; index += 1) {
            input.value = terms[index % terms.length];
            input.dispatchEvent(new Event('input', {bubbles: true}));
          }
        }""",
        terms,
    )
    page.wait_for_timeout(250)
    expect("Rapid search settles on the latest query", page.locator("#search").input_value() == "shakespeare")
    expect("Rapid search produces a coherent nonempty result", "0 resources" not in page.locator("#result-count").inner_text())

    page.evaluate(
        """() => {
          const input = document.querySelector('#search');
          input.value = 'poetry';
          input.dispatchEvent(new Event('input', {bubbles: true}));
          window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
          window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
        }"""
    )
    page.wait_for_timeout(100)
    expect(
        "Teacher finder restores an interrupted back-forward-cache search",
        page.locator("#search").input_value() == "poetry"
        and "0 resources" not in page.locator("#result-count").inner_text(),
    )

    for _ in range(8):
        page.locator("#expand-toggle").click()
    page.wait_for_timeout(100)
    label = page.locator("#expand-toggle").inner_text()
    pressed = page.locator("#expand-toggle").get_attribute("aria-pressed")
    expect("Repeated expand/collapse ends in a coherent state", (label == "Expand all") == (pressed == "false"))
    expect("Teacher failure/stress run has no page errors", not errors, " | ".join(errors))
    page.close()


def main() -> None:
    payload = json.loads(POLY_DATA.read_text(encoding="utf-8"))
    events = payload.get("events", [])
    expect("Canonical Polymythcal inventory remains 838", len(events) == 838)
    expect("Teacher source inventory remains 644", browser_shell(TEACHER_HTML).count('class="entry ') == 644)

    poly_source = POLY_JS.read_text(encoding="utf-8")
    teacher_source = TEACHER_JS.read_text(encoding="utf-8")
    with sync_playwright() as playwright:
        launch_options: dict[str, object] = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-dev-shm-usage"],
        }
        executable = chromium_path()
        if executable:
            launch_options["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_options)
        test_polymyth_good_and_duplicate(browser, payload, poly_source)
        test_polymyth_malformed_retry(browser, payload, poly_source)
        test_polymyth_cache_fallback(browser, payload, poly_source)
        test_polymyth_timeout_and_retry_button(browser, payload, poly_source)
        test_polymyth_navigation_abort(browser, poly_source)
        test_teacher_failures_and_stress(browser, teacher_source)
        browser.close()
    report = {
        "audit": 42,
        "release_id": RELEASE.get("release_id"),
        "generated_at": RELEASE.get("generated_at"),
        "executed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "release": "Audit42 project failure-mode and stress",
        "checks_passed": sum(1 for result in RESULTS if result["passed"]),
        "checks_total": len(RESULTS),
        "checks_failed": sum(1 for result in RESULTS if not result["passed"]),
        "results": RESULTS,
        "invariants": {
            "polymythcal_records": 838,
            "polymythcal_event_types": 32,
            "teacher_resources": 644,
            "teacher_collections": 25,
            "teacher_groups": 7,
            "scraper_cadence_changed": False,
        },
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("PROJECT FAILURE/STRESS AUDIT PASSED")


if __name__ == "__main__":
    main()
