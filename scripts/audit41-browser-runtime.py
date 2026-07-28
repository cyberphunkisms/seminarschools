#!/usr/bin/env python3
"""Fresh Chromium audit for Audit 41 runtime continuity and repaired deep links."""
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
SITE_ROOT = ROOT / "public"
OUT = ROOT / "data" / "audit41-browser"
REPORT_PATH = OUT / "runtime-continuity-browser-audit.json"
SCREENSHOT_DIR = OUT / "screenshots"
RELEASE = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))

ROUTES = (
    ("/", "home"),
    ("/teacherresources/", "teacher-resources"),
    ("/polymythseminars/", "polymythcal"),
    ("/aa/", "aa"),
    ("/bb/", "bb"),
    ("/aitr/", "aitr"),
    ("/bookwormcard/", "bookwormcard"),
    ("/leizu/", "leizu"),
    ("/saul/", "saul"),
    ("/polymyth/campaigncodex/", "campaigncodex"),
    ("/campaigns/thank-you-mam/dm-board/", "dm-board"),
    ("/polymyth/methodologylist/", "methodology"),
)
VIEWPORTS = (
    ("desktop", {"width": 1440, "height": 900}),
    ("mobile", {"width": 390, "height": 844}),
)
RESULTS: list[dict[str, Any]] = []
METRICS: list[dict[str, Any]] = []


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: Any) -> None:
        return


def check(name: str, passed: bool, detail: Any = "") -> None:
    RESULTS.append({"name": name, "passed": bool(passed), "detail": str(detail)})


def wait_ready(page: Page, label: str) -> None:
    page.wait_for_load_state("domcontentloaded")
    if label == "teacher-resources":
        page.locator("#result-count").wait_for(state="visible", timeout=20_000)
    elif label == "polymythcal":
        page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    elif label == "aa":
        page.locator("#results").wait_for(state="visible", timeout=20_000)
    elif label == "campaigncodex":
        page.locator("#entries .entry").first.wait_for(state="visible", timeout=20_000)
    elif label == "dm-board":
        page.locator(".time-slot").first.wait_for(state="visible", timeout=20_000)
    elif label == "methodology":
        page.locator("#entries, #results, main, [role='main']").first.wait_for(
            state="visible", timeout=30_000
        )
    page.wait_for_timeout(650)


def runtime_metrics(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const root = document.documentElement;
          const visible = element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
              Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
          };
          const main = [...document.querySelectorAll('main,[role="main"]')].filter(visible);
          const h1 = [...document.querySelectorAll(
            'h1,[role="heading"][aria-level="1"]'
          )];
          const audit = window.__audit41Runtime || {};
          const resources = performance.getEntriesByType('resource');
          return {
            title: document.title.trim(),
            mainCount: main.length,
            h1Count: h1.length,
            bodyTextLength: (document.body?.innerText || '').trim().length,
            overflow: Math.max(0, root.scrollWidth - root.clientWidth),
            cls: Number(audit.cls || 0),
            layoutShifts: Array.isArray(audit.shifts) ? audit.shifts : [],
            longTaskCount: Array.isArray(audit.longTasks) ? audit.longTasks.length : 0,
            maxLongTaskMs: Array.isArray(audit.longTasks) && audit.longTasks.length
              ? Math.max(...audit.longTasks) : 0,
            resourceCount: resources.length,
            transferSize: resources.reduce((sum, row) => sum + Number(row.transferSize || 0), 0),
          };
        }"""
    )


def route_matrix(browser, base_url: str) -> None:
    for viewport_name, viewport in VIEWPORTS:
        errors: list[str] = []
        failed_requests: list[str] = []
        context = browser.new_context(
            viewport=viewport,
            reduced_motion="reduce",
            color_scheme="light",
        )
        context.route(
            "**/*",
            lambda route, request: route.continue_()
            if request.url.startswith(base_url)
            else route.abort(),
        )
        context.add_init_script(
            """window.__audit41Runtime = {cls: 0, shifts: [], longTasks: []};
            try {
              new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                  if (!entry.hadRecentInput) {
                    window.__audit41Runtime.cls += entry.value;
                    window.__audit41Runtime.shifts.push({
                      value: entry.value,
                      sources: (entry.sources || []).map(source => {
                        const node = source.node;
                        return {
                          tag: node?.tagName || '',
                          id: node?.id || '',
                          className: String(node?.className || '').slice(0, 100),
                          previousRect: source.previousRect,
                          currentRect: source.currentRect,
                        };
                      }),
                    });
                  }
                }
              }).observe({type: 'layout-shift', buffered: true});
            } catch {}
            try {
              new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                  window.__audit41Runtime.longTasks.push(entry.duration);
                }
              }).observe({type: 'longtask', buffered: true});
            } catch {}"""
        )
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if (
                message.type == "error"
                and not message.text.startswith("Failed to load resource:")
            )
            else None,
        )
        page.on(
            "requestfailed",
            lambda request: failed_requests.append(request.url)
            if request.url.startswith(base_url)
            else None,
        )
        for route, label in ROUTES:
            errors.clear()
            failed_requests.clear()
            response = page.goto(
                f"{base_url}{route}", wait_until="domcontentloaded", timeout=45_000
            )
            wait_ready(page, label)
            values = runtime_metrics(page)
            values.update(
                {
                    "route": route,
                    "label": label,
                    "viewport": viewport_name,
                    "pageErrors": errors,
                    "failedLocalRequests": failed_requests,
                }
            )
            METRICS.append(values)
            print(
                f"route {viewport_name} {label}: cls={values['cls']:.6f} "
                f"long={values['maxLongTaskMs']:.1f}ms overflow={values['overflow']}",
                flush=True,
            )

            prefix = f"{viewport_name} {label}"
            check(f"{prefix}: HTTP success", bool(response and response.ok), response.status if response else "none")
            check(f"{prefix}: document title", bool(values["title"]), values["title"])
            check(f"{prefix}: one visible main", values["mainCount"] == 1, values["mainCount"])
            check(f"{prefix}: semantic H1", values["h1Count"] >= 1, values["h1Count"])
            check(f"{prefix}: no horizontal overflow", values["overflow"] <= 1, values["overflow"])
            check(f"{prefix}: no runtime errors", not errors and not failed_requests, {
                "pageErrors": errors,
                "failedLocalRequests": failed_requests,
            })
            check(f"{prefix}: CLS at most 0.1", values["cls"] <= 0.1, values["cls"])
        page.close()
        context.close()


def target_visible_and_focused(page: Page, selector: str) -> dict[str, Any]:
    return page.locator(selector).evaluate(
        """element => {
          const rect = element.getBoundingClientRect();
          return {
            visible: rect.width > 0 && rect.height > 0 &&
              rect.bottom > 0 && rect.top < innerHeight,
            focused: document.activeElement === element,
            top: Math.round(rect.top),
            text: (element.textContent || '').trim().slice(0, 160),
          };
        }"""
    )


def deep_link_and_interaction_checks(browser, base_url: str) -> None:
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.route(
        "**/*",
        lambda route, request: route.continue_()
        if request.url.startswith(base_url)
        else route.abort(),
    )
    page = context.new_page()
    targets = (
        ("/aitr/#denote", "#denote", "DENOTE", None),
        ("/aitr/#monster-battle", "#monster-battle", "Monster Battle", None),
        (
            "/polymyth/campaigncodex/#cc-cmp001-curriculum-anchor-map",
            "#cc-cmp001-curriculum-anchor-map",
            "curriculum anchor map",
            "cc",
        ),
        (
            "/polymyth/campaigncodex/#cc-cmp001-triangulation-rubric",
            "#cc-cmp001-triangulation-rubric",
            "triangulation rubric",
            "cc",
        ),
    )
    for index, (route, selector, text, section) in enumerate(targets, start=1):
        page.goto(f"{base_url}{route}", wait_until="domcontentloaded", timeout=45_000)
        page.locator(selector).wait_for(state="visible", timeout=20_000)
        page.wait_for_timeout(250)
        state = target_visible_and_focused(page, selector)
        print(f"deep-link {route}: {state}", flush=True)
        check(f"deep link {route}: target visible", state["visible"], state)
        check(f"deep link {route}: target focused", state["focused"], state)
        check(
            f"deep link {route}: target content",
            text.lower() in state["text"].lower(),
            state["text"],
        )
        if section:
            pressed = page.locator(f'.tab[data-section="{section}"]').evaluate(
                "element => element.classList.contains('on')"
            )
            check(f"deep link {route}: correct section", pressed, section)
        page.screenshot(
            path=str(SCREENSHOT_DIR / f"deep-link-{index}.png"),
            full_page=False,
        )

    page.goto(f"{base_url}/aa/#mode=pending", wait_until="domcontentloaded")
    page.locator(".pending-grid").wait_for(state="visible", timeout=20_000)
    pending_active = page.locator('.mode-btn[data-mode="pending"]').get_attribute(
        "aria-pressed"
    )
    check("AA pending state deep link", pending_active == "true", pending_active)

    page.goto(
        f"{base_url}/leizu/intake/?tier=term", wait_until="domcontentloaded"
    )
    page.locator("#selection-summary").wait_for(state="visible", timeout=15_000)
    summary = page.locator("#selection-summary").evaluate(
        """element => {
          const labelledby = element.getAttribute('aria-labelledby') || '';
          const label = labelledby ? document.getElementById(labelledby) : null;
          return {
            labelledby,
            labelText: (label?.textContent || '').trim(),
            text: (element.textContent || '').trim(),
          };
        }"""
    )
    check(
        "Leizu dynamic summary label resolves",
        summary["labelledby"] == "selection-summary-title"
        and summary["labelText"] == "Your selection",
        summary,
    )
    check("Leizu selected plan is announced", "Term" in summary["text"], summary["text"])

    page.goto(f"{base_url}/teacherresources/", wait_until="domcontentloaded")
    page.locator("#result-count").wait_for(state="visible", timeout=20_000)
    page.locator("#search").fill("DENOTE")
    page.wait_for_function(
        """() => {
          const text = document.getElementById('result-count')?.textContent || '';
          return /1 resource\\b/.test(text);
        }""",
        timeout=15_000,
    )
    filtered = page.locator("#result-count").inner_text()
    check("Teacher Resources live search narrows", "1 resource" in filtered, filtered)
    page.locator("#search").press("Escape")
    page.wait_for_function(
        """() => (document.getElementById('result-count')?.textContent || '').includes('644 resources')""",
        timeout=15_000,
    )
    reset = page.locator("#result-count").inner_text()
    check("Teacher Resources Escape resets", "644 resources" in reset, reset)
    page.screenshot(
        path=str(SCREENSHOT_DIR / "teacher-resources-reset.png"),
        full_page=False,
    )
    page.close()
    context.close()


def dm_board_mobile_checks(browser, base_url: str) -> None:
    errors: list[str] = []
    context = browser.new_context(
        viewport={"width": 375, "height": 812},
        reduced_motion="reduce",
    )
    context.route(
        "**/*",
        lambda route, request: route.continue_()
        if request.url.startswith(base_url)
        else route.abort(),
    )
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "console",
        lambda message: errors.append(message.text)
        if (
            message.type == "error"
            and not message.text.startswith("Failed to load resource:")
        )
        else None,
    )
    page.goto(
        f"{base_url}/campaigns/thank-you-mam/dm-board/",
        wait_until="domcontentloaded",
        timeout=45_000,
    )
    page.locator(".time-slot").first.wait_for(state="visible", timeout=20_000)
    page.wait_for_timeout(200)

    mobile = page.evaluate(
        """() => {
          const root = document.documentElement;
          const board = document.querySelector('.board');
          const center = document.querySelector('.center')?.getBoundingClientRect();
          const right = document.querySelector('.right')?.getBoundingClientRect();
          return {
            columns: board ? getComputedStyle(board).gridTemplateColumns : '',
            bodyOverflowY: getComputedStyle(document.body).overflowY,
            overflow: Math.max(0, root.scrollWidth - root.clientWidth),
            centerWidth: Math.round(center?.width || 0),
            rightWidth: Math.round(right?.width || 0),
          };
        }"""
    )
    check(
        "DM board mobile single-column reflow",
        mobile["overflow"] <= 1
        and mobile["centerWidth"] >= 340
        and mobile["rightWidth"] >= 340
        and "auto" in mobile["bodyOverflowY"],
        mobile,
    )

    controls = page.locator(
        ".time-slot,.npc-card,.block,.trigger-chip,.tool-btn"
    ).count()
    check("DM board native control inventory", controls >= 51, controls)

    alternate_time = page.locator(".time-slot:not(.active)").first
    before_clock = page.locator("#gameClock").inner_text()
    alternate_time.focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(100)
    after_clock = page.locator("#gameClock").inner_text()
    check(
        "DM board keyboard changes time",
        bool(after_clock and after_clock != before_clock),
        {"before": before_clock, "after": after_clock},
    )

    npc = page.locator(".npc-card").first
    npc.focus()
    page.keyboard.press("Enter")
    page.locator(".modal-overlay.open").wait_for(state="visible", timeout=10_000)
    modal_state = page.evaluate(
        """() => {
          const overlay = document.getElementById('modalOverlay');
          const modal = document.getElementById('modalContent');
          return {
            open: overlay?.classList.contains('open') || false,
            ariaHidden: overlay?.getAttribute('aria-hidden'),
            focusInside: Boolean(modal?.contains(document.activeElement)),
            labelled: Boolean(
              modal?.getAttribute('aria-labelledby') || modal?.getAttribute('aria-label')
            ),
          };
        }"""
    )
    check(
        "DM board dialog opens with focus and name",
        modal_state["open"]
        and modal_state["ariaHidden"] == "false"
        and modal_state["focusInside"]
        and modal_state["labelled"],
        modal_state,
    )

    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    closed_state = page.evaluate(
        """() => {
          const overlay = document.getElementById('modalOverlay');
          return {
            open: overlay?.classList.contains('open') || false,
            ariaHidden: overlay?.getAttribute('aria-hidden'),
            inert: overlay?.hasAttribute('inert') || false,
          };
        }"""
    )
    check(
        "DM board Escape closes dialog",
        not closed_state["open"]
        and closed_state["ariaHidden"] == "true"
        and closed_state["inert"],
        closed_state,
    )
    returned = npc.evaluate("element => document.activeElement === element")
    check("DM board dialog returns focus", returned, returned)
    check("DM board interaction has no runtime errors", not errors, errors)
    page.screenshot(
        path=str(SCREENSHOT_DIR / "dm-board-mobile.png"),
        full_page=False,
    )
    page.close()
    context.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    handler = partial(QuietHandler, directory=str(SITE_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    executed_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            route_matrix(browser, base_url)
            deep_link_and_interaction_checks(browser, base_url)
            dm_board_mobile_checks(browser, base_url)
            browser_version = browser.version
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    failed = [result for result in RESULTS if not result["passed"]]
    report = {
        "audit": 41,
        "release_id": RELEASE.get("release_id"),
        "generated_at": RELEASE.get("generated_at"),
        "executed_at": executed_at,
        "browser": "Chromium headless shell",
        "browser_version": browser_version,
        "route_cases": len(ROUTES) * len(VIEWPORTS),
        "checks_total": len(RESULTS),
        "checks_passed": len(RESULTS) - len(failed),
        "checks_failed": len(failed),
        "results": RESULTS,
        "metrics": METRICS,
        "held_direction_decisions": [
            {
                "route": "/polymyth/methodologylist/",
                "decision": "Server rendering or list virtualization",
                "reason": "Audit 41 removed the archive's layout shift. Replacing its full-payload rendering to eliminate the remaining startup long task would change the delivery architecture.",
            }
        ],
        "environment_limits": [
            "Native VoiceOver on macOS was unavailable.",
            "Native NVDA on Windows was unavailable.",
            "Firefox launch was blocked by the container user-namespace/profile runtime.",
            "WebKit host libraries were unavailable in the read-only system image.",
        ],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "passed": report["checks_passed"],
                "failed": report["checks_failed"],
                "total": report["checks_total"],
                "route_cases": report["route_cases"],
                "report": str(REPORT_PATH.relative_to(ROOT)),
            }
        )
    )
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
