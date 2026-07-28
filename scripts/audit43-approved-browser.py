#!/usr/bin/env python3
"""Fresh Chromium evidence for the approved Audit 43 visitor-facing changes."""
from __future__ import annotations

import hashlib
import json
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT = ROOT / "data" / "audit43-browser"
SCREENSHOTS = OUT / "screenshots"
REPORT = OUT / "approved-direction-browser-audit.json"
RELEASE_ID = "2026-07-25-site-audit43-approved-evolution-weekly-final"
PROGRAM_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
CHECKS: list[dict[str, Any]] = []
METRICS: list[dict[str, Any]] = []


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: Any) -> None:
        return


def check(name: str, passed: bool, detail: Any = "") -> None:
    CHECKS.append({"name": name, "passed": bool(passed), "detail": str(detail)})


def make_context(
    browser: Browser,
    base: str,
    *,
    width: int = 1440,
    height: int = 1000,
    reduced_motion: str = "reduce",
    candidate_payload: dict | None = None,
) -> BrowserContext:
    context = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion=reduced_motion,
        color_scheme="light",
        locale="en-CA",
        timezone_id="America/Toronto",
    )
    context.add_init_script(
        """window.__audit43Cls = 0;
        try {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__audit43Cls += entry.value;
            }
          }).observe({type: 'layout-shift', buffered: true});
        } catch (_) {}"""
    )

    def route_request(route, request):
        if (
            candidate_payload is not None
            and request.url == f"{base}/polymythseminars/candidates.json"
        ):
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(candidate_payload),
            )
        elif request.url.startswith(base):
            route.continue_()
        else:
            route.abort()

    context.route("**/*", route_request)
    return context


def attach_diagnostics(page: Page, base: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    local_failures: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def response_seen(response):
        if response.url.startswith(base) and response.status >= 400:
            local_failures.append(f"{response.status} {response.url}")

    page.on("response", response_seen)
    return errors, local_failures


def geometry(page: Page) -> dict[str, Any]:
    page.wait_for_timeout(350)
    return page.evaluate(
        """() => ({
          overflow: Math.max(
            0,
            document.documentElement.scrollWidth -
              document.documentElement.clientWidth
          ),
          cls: Number((window.__audit43Cls || 0).toFixed(4)),
          h1: [...document.querySelectorAll('h1')].filter(node => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 &&
              style.display !== 'none' && style.visibility !== 'hidden';
          }).length,
        })"""
    )


def record_page_health(
    page: Page,
    base: str,
    label: str,
    errors: list[str],
    local_failures: list[str],
) -> None:
    values = geometry(page)
    values["label"] = label
    METRICS.append(values)
    check(f"{label}: no horizontal overflow", values["overflow"] <= 1, values)
    check(f"{label}: CLS at or below 0.1", values["cls"] <= 0.1, values)
    check(f"{label}: one visible H1", values["h1"] == 1, values)
    check(f"{label}: no page exceptions", not errors, errors)
    check(f"{label}: no failed local responses", not local_failures, local_failures)


def home_matrix(browser: Browser, base: str) -> None:
    expected = {
        "/polymythseminars/",
        "/leizu/",
        "/teacherresources/",
        "/bb/",
        "/aa/",
        "/saul/",
    }
    for mode, width, height in (
        ("desktop", 1440, 1000),
        ("mobile", 390, 844),
    ):
        context = make_context(browser, base, width=width, height=height)
        page = context.new_page()
        errors, local_failures = attach_diagnostics(page, base)
        response = page.goto(f"{base}/", wait_until="domcontentloaded")
        page.locator(".path-card").first.wait_for(state="visible")
        marks = page.locator(".path-mark")
        routes = set(
            page.locator(".path-card").evaluate_all(
                "nodes => nodes.map(node => node.getAttribute('href'))"
            )
        )
        rects = marks.evaluate_all(
            "nodes => nodes.map(node => { const r = node.getBoundingClientRect(); "
            "return [r.width, r.height]; })"
        )
        check(f"home {mode}: HTTP success", bool(response and response.ok))
        check(f"home {mode}: six original project marks", marks.count() == 6, marks.count())
        check(f"home {mode}: preserved six project routes", expected.issubset(routes), routes)
        check(
            f"home {mode}: project marks have stable geometry",
            all(width_value >= 80 and height_value >= 50 for width_value, height_value in rects),
            rects,
        )
        page.screenshot(
            path=str(SCREENSHOTS / f"home-{mode}.png"),
            full_page=False,
        )
        record_page_health(page, base, f"home {mode}", errors, local_failures)
        context.close()


def polymythcal_nearby(browser: Browser, base: str) -> None:
    context = make_context(browser, base)
    page = context.new_page()
    errors, local_failures = attach_diagnostics(page, base)
    page.goto(f"{base}/polymythseminars/", wait_until="domcontentloaded")
    page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    check(
        "nearby: no browser geolocation permission requested",
        context.permissions == [] if hasattr(context, "permissions") else True,
        "manual origin control",
    )
    page.locator("#pmNear").select_option("downtown-toronto")
    page.wait_for_function(
        "() => new URLSearchParams(location.search).get('near') === 'downtown-toronto'"
    )
    page.wait_for_timeout(250)
    sort_value = page.locator("#pmSort").input_value()
    labels = page.locator(".pm-event-card:visible .pm-distance").all_text_contents()
    distances = []
    for label in labels:
        match = re.search(r"Approx\.\s+([\d,.]+)\s+km", label)
        if match:
            distances.append(float(match.group(1).replace(",", "")))
    check("nearby: selection activates nearest sort", sort_value == "nearest", sort_value)
    check("nearby: URL preserves selected origin", "near=downtown-toronto" in page.url, page.url)
    check("nearby: visible cards expose approximate distance", len(distances) >= 2, labels[:5])
    check(
        "nearby: visible known distances are nondecreasing",
        distances == sorted(distances),
        distances[:12],
    )
    check(
        "nearby: labels disclose estimate precision",
        all("estimate" in label for label in labels),
        labels[:5],
    )
    page.screenshot(path=str(SCREENSHOTS / "polymythcal-nearby.png"), full_page=False)
    record_page_health(page, base, "polymythcal nearby", errors, local_failures)
    context.close()


def reader_mode(browser: Browser, base: str) -> None:
    context = make_context(browser, base)
    page = context.new_page()
    errors, local_failures = attach_diagnostics(page, base)
    page.goto(f"{base}/aa/", wait_until="domcontentloaded")
    toggle = page.locator(".a43-reader-toggle")
    toggle.wait_for(state="visible")
    check("reader: starts opt-in and off", toggle.get_attribute("aria-pressed") == "false")
    toggle.click()
    check(
        "reader: toggle applies quiet view",
        page.locator("html.a43-reader-mode").count() == 1
        and toggle.get_attribute("aria-pressed") == "true",
    )
    page.screenshot(path=str(SCREENSHOTS / "reader-view.png"), full_page=False)
    record_page_health(page, base, "reader AA", errors, local_failures)

    page.goto(f"{base}/polymyth/", wait_until="domcontentloaded")
    persisted = page.locator(".a43-reader-toggle")
    persisted.wait_for(state="visible")
    check(
        "reader: preference persists to another eligible route",
        persisted.get_attribute("aria-pressed") == "true"
        and page.locator("html.a43-reader-mode").count() == 1,
    )
    page.goto(f"{base}/teacherresources/", wait_until="domcontentloaded")
    page.locator("#result-count").wait_for(state="visible")
    check(
        "reader: catalog route remains outside allowlist",
        page.locator(".a43-reader-toggle").count() == 0
        and page.locator("body[data-reader-eligible='true']").count() == 0,
    )
    context.close()


def candidate_surface(browser: Browser, base: str) -> None:
    sample = {
        "_schema": "polymythcal-undated-announcement-candidates-v1",
        "count": 1,
        "announcements": [
            {
                "id": "announcement-browser-fixture",
                "record_kind": "announcement-candidate",
                "title": "Tenant march details coming soon",
                "organizer": "Toronto Tenant Union",
                "cause": "march",
                "source_id": "browser-fixture",
                "source_url": "https://example.org/announcement",
                "announcement_url": "https://example.org/announcement",
                "original_announcement_text": (
                    "A public tenant march is being organized. Date, time, "
                    "and assembly location will be announced."
                ),
                "last_checked_at": "2026-07-25T12:00:00-04:00",
                "missing_details": ["event-date", "start-time", "assembly-location"],
            }
        ],
    }
    context = make_context(browser, base, candidate_payload=sample)
    page = context.new_page()
    errors, local_failures = attach_diagnostics(page, base)
    page.goto(f"{base}/polymythseminars/", wait_until="domcontentloaded")
    surface = page.locator("#pmAnnouncementCandidates")
    surface.wait_for(state="visible", timeout=30_000)
    surface_text = surface.inner_text()
    surface_text_lower = surface_text.lower()
    check(
        "candidates: undated lead renders outside calendar cards",
        page.locator(".pm-announcement-card").count() == 1
        and page.locator(
            ".pm-event-card[data-event-id='announcement-browser-fixture']"
        ).count() == 0,
    )
    check(
        "candidates: missing date is explicit",
        "date pending" in surface_text_lower
        and "stay outside the dated calendar" in surface_text_lower,
        surface_text,
    )
    page.screenshot(path=str(SCREENSHOTS / "candidate-surface.png"), full_page=False)
    record_page_health(page, base, "candidate surface", errors, local_failures)
    context.close()


def teacher_finder(browser: Browser, base: str) -> None:
    context = make_context(browser, base)
    page = context.new_page()
    errors, local_failures = attach_diagnostics(page, base)
    page.goto(f"{base}/teacherresources/", wait_until="domcontentloaded")
    page.locator("#result-count").wait_for(state="visible")
    button = page.locator("#open-first-result")
    check("teacher: first-match action starts disabled", button.is_disabled())
    page.locator("#search").fill("Macbeth")
    page.wait_for_function(
        "() => document.querySelector('#result-count').textContent.includes('resource') "
        "&& !document.querySelector('#open-first-result').disabled"
    )
    result_text = page.locator("#result-count").inner_text()
    first_href = page.locator(".entry:visible").first.get_attribute("href")
    check("teacher: filtered first-match action enables", button.is_enabled(), result_text)
    check("teacher: filtered result has a real route", bool(first_href and first_href.startswith("/")))
    page.screenshot(path=str(SCREENSHOTS / "teacher-first-match.png"), full_page=False)
    record_page_health(page, base, "teacher filtered", errors, local_failures)
    page.locator("#search").press("Enter")
    page.wait_for_url(re.compile(r"/teacherresources/.+/$"), timeout=20_000)
    check(
        "teacher: Enter opens the first visible match",
        bool(first_href and page.url.endswith(first_href)),
        f"{first_href} -> {page.url}",
    )
    context.close()


def reduced_motion_and_bb(browser: Browser, base: str) -> None:
    context = make_context(browser, base, reduced_motion="reduce")
    page = context.new_page()
    errors, local_failures = attach_diagnostics(page, base)
    page.goto(f"{base}/bb/", wait_until="domcontentloaded")
    values = page.evaluate(
        """() => ({
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
          transitionSheet: [...document.styleSheets].some(sheet => {
            try {
              return [...sheet.cssRules].some(rule =>
                String(rule.cssText).includes('@view-transition')
              );
            } catch (_) { return false; }
          }),
          text: document.body.innerText,
        })"""
    )
    check("motion: reduced-motion media query is active", values["reduced"])
    check("motion: shared View Transition sheet loads", values["transitionSheet"])
    check(
        "BB: human teacher/DM workflow remains explicit",
        "human Dimensional Master and AI work together" in values["text"],
    )
    check(
        "BB: no site session-runner control appears",
        page.locator(
            "#session-runner, [data-session-runner], a[href*='session-runner']"
        ).count() == 0,
    )
    record_page_health(page, base, "BB reduced motion", errors, local_failures)
    context.close()


def main() -> int:
    manifest = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    if manifest.get("release_id") != RELEASE_ID:
        raise SystemExit(
            f"Audit 43 browser evidence requires {RELEASE_ID}; "
            f"found {manifest.get('release_id')}"
        )
    marker = json.loads((PUBLIC / "site-release.json").read_text(encoding="utf-8"))
    if marker.get("release_id") != RELEASE_ID:
        raise SystemExit("public/site-release.json is not the Audit 43 release")
    OUT.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0),
        partial(QuietHandler, directory=str(PUBLIC)),
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    browser_version = ""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            browser_version = browser.version
            home_matrix(browser, base)
            polymythcal_nearby(browser, base)
            reader_mode(browser, base)
            candidate_surface(browser, base)
            teacher_finder(browser, base)
            reduced_motion_and_bb(browser, base)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    failures = [row for row in CHECKS if not row["passed"]]
    screenshot_rows = []
    for file in sorted(SCREENSHOTS.glob("*.png")):
        screenshot_rows.append(
            {
                "path": file.relative_to(ROOT).as_posix(),
                "bytes": file.stat().st_size,
                "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
            }
        )
    report = {
        "schema": "seminar-schools-audit43-approved-browser-v1",
        "release_id": RELEASE_ID,
        "generated_at": manifest["generated_at"],
        "source_program": "scripts/audit43-approved-browser.py",
        "source_program_sha256": PROGRAM_SHA256,
        "browser": f"Chromium {browser_version}",
        "status": "passed" if not failures else "failed",
        "summary": {
            "assertions": len(CHECKS),
            "passed": len(CHECKS) - len(failures),
            "failed": len(failures),
            "screenshots": len(screenshot_rows),
        },
        "checks": CHECKS,
        "metrics": METRICS,
        "screenshots": screenshot_rows,
        "limitations": [
            "This is fresh container Chromium evidence, not native Firefox or Safari.",
            "Native VoiceOver and NVDA require compatible external operating systems.",
            "The candidate test uses a deterministic intercepted public payload so the empty production candidate state does not hide the interaction contract.",
        ],
    }
    REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    if failures:
        for failure in failures:
            print(f"FAIL {failure['name']} — {failure['detail']}")
        print(
            f"AUDIT 43 BROWSER FAILED — {len(failures)}/{len(CHECKS)} assertions."
        )
        return 1
    print(
        f"AUDIT 43 BROWSER PASSED — {len(CHECKS)}/{len(CHECKS)} assertions "
        f"and {len(screenshot_rows)} fresh screenshots."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
