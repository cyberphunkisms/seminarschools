#!/usr/bin/env python3
"""Audit 42 browser depth pass for heading, density, and event rollover continuity."""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT = ROOT / "data" / "audit42-inherited-browser" / "depth"
REPORT = OUT / "full-depth-browser-audit.json"
SCREENSHOTS = OUT / "screenshots"
RELEASE_ID = "2026-07-25-site-audit42-ledger-closure-multimode-final"
results: list[dict[str, Any]] = []


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: Any) -> None:
        return


def check(name: str, passed: bool, detail: Any = "") -> None:
    results.append({"name": name, "passed": bool(passed), "detail": str(detail)})


def event_route(indexable: bool) -> str:
    candidates: list[str] = []
    for source in sorted((PUBLIC / "polymythseminars" / "events").glob("*/index.html")):
        html = source.read_text(encoding="utf-8")
        if "Event moved · Fiche déplacée" in html:
            continue
        noindex = 'name="robots" content="noindex' in html
        has_event_schema = (
            'type="application/ld+json"' in html
            and ('"@type":"Event"' in html or '"@type": "Event"' in html)
        )
        if indexable and not noindex and has_event_schema:
            candidates.append("/" + source.parent.relative_to(PUBLIC).as_posix() + "/")
        if not indexable and noindex and not has_event_schema:
            candidates.append("/" + source.parent.relative_to(PUBLIC).as_posix() + "/")
    if not candidates:
        kind = "indexable" if indexable else "expired noindex"
        raise SystemExit(f"AUDIT 41 DEPTH FAILED — no {kind} event route exists")
    return candidates[0]


def wait_ready(page: Page, label: str) -> None:
    page.wait_for_load_state("domcontentloaded")
    if label == "teacher-resources":
        page.locator("#result-count").wait_for(state="visible", timeout=20_000)
    elif label == "polymythcal":
        page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    elif label == "bookwormcard":
        page.locator(".bookwormcard-runtime-title").wait_for(state="visible", timeout=20_000)
    elif label == "methodology":
        page.locator(".tab").first.wait_for(state="visible", timeout=20_000)
    page.wait_for_timeout(500)


def route_specific(page: Page, label: str) -> tuple[bool, str]:
    if label == "bookwormcard":
        visible = page.locator("h1:visible")
        text = visible.first.inner_text() if visible.count() else ""
        return visible.count() == 1 and "Bookwormcard" in text, text
    if label == "teacher-resources":
        toggle = page.locator("#filter-toggle")
        quick = page.locator(".quick-finder")
        initial = toggle.get_attribute("aria-expanded")
        toggle.click()
        opened = toggle.get_attribute("aria-expanded")
        panel_visible = page.locator("#filter-rows").is_visible()
        resource_count = page.locator("#catalog .entry").count()
        return (
            initial == "false"
            and opened == "true"
            and panel_visible
            and quick.is_visible()
            and resource_count == 644
        ), f"{initial}->{opened}; panel={panel_visible}; resources={resource_count}"
    if label == "polymythcal":
        count = page.locator(".pm-event-card").count()
        return count >= 1, f"{count} visible event cards"
    if label == "upcoming-event":
        robots = page.locator('meta[name="robots"]').get_attribute("content") or ""
        schemas = page.locator('script[type="application/ld+json"]').all_text_contents()
        has_event = any('"Event"' in schema for schema in schemas)
        return "noindex" not in robots.lower() and has_event, f"robots={robots}; Event={has_event}"
    if label == "expired-event":
        robots = page.locator('meta[name="robots"]').get_attribute("content") or ""
        schemas = page.locator('script[type="application/ld+json"]').all_text_contents()
        has_event = any('"Event"' in schema for schema in schemas)
        return "noindex" in robots.lower() and not has_event, f"robots={robots}; Event={has_event}"
    if label == "bb":
        text = page.locator("body").inner_text()
        return "BookwormBurrows" in text and "Dimensional Master" in text, "BB and DM named"
    if label == "methodology":
        tabs = page.locator(".tab").count()
        total = page.locator("#total").inner_text().replace(",", "").strip()
        return tabs == 17 and total == "1139", f"tabs={tabs}; entries={total}"
    if label == "home":
        polymyth_links = page.locator('a[href="/polymythseminars/"]').count()
        return polymyth_links >= 1, f"{polymyth_links} Polymythcal links"
    return False, "unknown route"


def audit_route(page: Page, base: str, route: str, label: str) -> None:
    page_errors: list[str] = []
    failed_local: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    def failed(request: Any) -> None:
        if request.url.startswith(base):
            failed_local.append(request.url)

    page.on("requestfailed", failed)
    response = page.goto(base + route, wait_until="domcontentloaded", timeout=45_000)
    wait_ready(page, label)

    check(f"{label}: HTTP success", bool(response and response.status == 200),
          response.status if response else "no response")
    title = page.title().strip()
    check(f"{label}: document title", bool(title), title)
    main_count = page.locator("main").count()
    check(f"{label}: one main landmark", main_count == 1, main_count)
    visible_h1_count = page.locator("h1:visible").count()
    check(f"{label}: one visible H1", visible_h1_count == 1, visible_h1_count)
    overflow = page.evaluate(
        "() => Math.max(0, document.documentElement.scrollWidth - innerWidth)"
    )
    check(f"{label}: no horizontal overflow", overflow <= 1, overflow)
    check(f"{label}: no runtime errors", not page_errors, page_errors)
    check(f"{label}: no failed local requests", not failed_local, failed_local)
    passed, detail = route_specific(page, label)
    check(f"{label}: focused depth contract", passed, detail)

    if label in {"bookwormcard", "teacher-resources", "upcoming-event", "expired-event"}:
        page.screenshot(path=str(SCREENSHOTS / f"{label}.png"), full_page=False)


def main() -> None:
    release = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    if release.get("release_id") != RELEASE_ID:
        raise SystemExit(
            "AUDIT 41 DEPTH FAILED — apply the Audit 42 release stamp before browser evidence"
        )

    routes = [
        ("/bookwormcard/", "bookwormcard"),
        ("/teacherresources/", "teacher-resources"),
        ("/polymythseminars/", "polymythcal"),
        (event_route(True), "upcoming-event"),
        (event_route(False), "expired-event"),
        ("/bb/", "bb"),
        ("/polymyth/methodologylist/", "methodology"),
        ("/", "home"),
    ]

    OUT.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    for old in SCREENSHOTS.glob("*.png"):
        old.unlink()

    handler = partial(QuietHandler, directory=str(PUBLIC))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    executed_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            context.route(
                "**/*",
                lambda route, request: route.continue_()
                if request.url.startswith(base)
                else route.abort(),
            )
            for route, label in routes:
                print(f"depth route: {label}", flush=True)
                page = context.new_page()
                audit_route(page, base, route, label)
                page.close()
            browser_name = f"Chromium {browser.version}"
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    failed = [result for result in results if not result["passed"]]
    report = {
        "audit": 42,
        "release": "Audit 42 full depth and rollover browser verification",
        "release_id": RELEASE_ID,
        "generated_at": release.get("generated_at"),
        "executed_at": executed_at,
        "browser": browser_name,
        "engine": "Chromium",
        "route_cases": len(routes),
        "routes": [{"route": route, "label": label} for route, label in routes],
        "checks_total": len(results),
        "checks_passed": len(results) - len(failed),
        "checks_failed": len(failed),
        "results": results,
        "environment_limits": [
            "Native VoiceOver requires macOS hardware and was not executed.",
            "Native NVDA requires Windows and was not executed.",
            "Firefox and WebKit require an unrestricted compatible host for final sign-off.",
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "passed": report["checks_passed"],
        "failed": report["checks_failed"],
        "total": report["checks_total"],
        "route_cases": report["route_cases"],
        "report": str(REPORT.relative_to(ROOT)),
    }))
    if len(results) != 64 or failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
