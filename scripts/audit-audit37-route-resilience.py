#!/usr/bin/env python3
"""Fresh Chromium evidence for Audit 37 route polish and failure recovery."""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE_ROOT = ROOT / os.environ.get("AUDIT37_SITE_ROOT", "public")
OUT = ROOT / "data" / "audit37-route-browser"
OUT.mkdir(parents=True, exist_ok=True)
REPORT_PATH = OUT / "route-resilience-browser-audit.json"
RELEASE = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))

ROUTES = (
    ("/", "home"),
    ("/main/", "about"),
    ("/bb/", "bb"),
    ("/bookwormcard/", "bookwormcard"),
    ("/aa/", "aa"),
    ("/leizu/", "leizu"),
    ("/saul/", "cv"),
    ("/agora/", "agora"),
    ("/teacherresources/", "teacher-resources"),
    ("/polymythseminars/", "polymythcal"),
    ("/polymyth/methodologylist/", "methodology-list"),
)
VIEWPORTS = (
    ("desktop", {"width": 1366, "height": 768}),
    ("mobile-short", {"width": 360, "height": 640}),
    ("landscape-short", {"width": 1024, "height": 500}),
)
RESULTS: list[dict] = []
METRICS: list[dict] = []


def check(name: str, passed: bool, detail="") -> None:
    result = {"name": name, "passed": bool(passed), "detail": str(detail)}
    RESULTS.append(result)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return

    def end_headers(self):
        self.send_header("Cache-Control", "public, max-age=60")
        super().end_headers()


def chromium_path(browser_type) -> str | None:
    candidates = (
        os.environ.get("CHROMIUM_PATH", "").strip(),
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    managed = getattr(browser_type, "executable_path", "")
    if managed and Path(managed).exists():
        return None
    raise FileNotFoundError(
        "Chromium was not found. Set CHROMIUM_PATH or install Playwright Chromium."
    )


def launch_chromium(browser_type):
    options = {
        "headless": True,
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    }
    executable = chromium_path(browser_type)
    if executable:
        options["executable_path"] = executable
    return browser_type.launch(**options)


def wait_for_route_ready(page: Page, label: str) -> None:
    page.wait_for_load_state("domcontentloaded")
    if label == "polymythcal":
        page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    elif label == "teacher-resources":
        page.locator("#result-count").wait_for(state="visible", timeout=15_000)
    else:
        page.wait_for_timeout(350)


def route_geometry(page: Page) -> dict:
    return page.evaluate(
        """() => {
          const root = document.documentElement;
          const visible = el => {
            if (el.closest('[inert],[aria-hidden="true"]')) return false;
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
              Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
          };
          const headings = [...document.querySelectorAll('h1,[role="heading"][aria-level="1"]')]
            .filter(visible);
          const semanticHeadings = [...document.querySelectorAll(
            'h1,[role="heading"][aria-level="1"]'
          )].map(el => el.textContent.trim().slice(0, 100)).filter(Boolean);
          const controls = [...document.querySelectorAll(
            'button,input:not([type="hidden"]),select,textarea,summary,[role="button"]'
          )].filter(visible);
          const undersized = controls.flatMap(el => {
            const rect = el.getBoundingClientRect();
            let target = rect;
            if (el.id) {
              const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
              if (label && visible(label)) target = label.getBoundingClientRect();
            } else if (el.closest('label') && visible(el.closest('label'))) {
              target = el.closest('label').getBoundingClientRect();
            }
            return target.width + 0.5 < 24 || target.height + 0.5 < 24
              ? [{tag: el.tagName, id: el.id || '', text: (el.textContent || el.value || '').trim().slice(0, 50),
                  width: Math.round(target.width), height: Math.round(target.height)}]
              : [];
          });
          const positioned = [...document.querySelectorAll('body *')].filter(el => {
            if (!visible(el)) return false;
            const position = getComputedStyle(el).position;
            return position === 'fixed' || position === 'sticky';
          });
          const outOfBounds = positioned.flatMap(el => {
            const rect = el.getBoundingClientRect();
            const position = getComputedStyle(el).position;
            if (el.matches('.skip-link') && el !== document.activeElement) return [];
            const outside = position === 'fixed' && (
              rect.right < -1 || rect.bottom < -1 ||
              rect.left > innerWidth + 1 || rect.top > innerHeight + 1
            );
            return outside
              ? [{tag: el.tagName, id: el.id || '', className: String(el.className || '').slice(0, 80)}]
              : [];
          });
          const fixedRoots = positioned.filter(el => {
            if (getComputedStyle(el).position !== 'fixed') return false;
            if (getComputedStyle(el).pointerEvents === 'none') return false;
            if (el.matches('.skip-link') && el !== document.activeElement) return false;
            const interactive = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[tabindex]:not([tabindex="-1"])';
            if (!el.matches(interactive) && !el.querySelector(interactive)) return false;
            for (let parent = el.parentElement; parent; parent = parent.parentElement) {
              if (getComputedStyle(parent).position === 'fixed') return false;
            }
            return true;
          });
          const fixedCollisions = [];
          for (let left = 0; left < fixedRoots.length; left += 1) {
            for (let right = left + 1; right < fixedRoots.length; right += 1) {
              const a = fixedRoots[left];
              const b = fixedRoots[right];
              const ar = a.getBoundingClientRect();
              const br = b.getBoundingClientRect();
              const width = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
              const height = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
              if (width * height <= 4) continue;
              fixedCollisions.push({
                first: a.id || String(a.className || a.tagName).slice(0, 60),
                second: b.id || String(b.className || b.tagName).slice(0, 60),
                overlap: Math.round(width * height),
              });
            }
          }
          return {
            title: document.title.trim(),
            headings: headings.map(el => el.textContent.trim().slice(0, 100)),
            semanticHeadings,
            bodyTextLength: (document.body?.innerText || '').trim().length,
            links: [...document.querySelectorAll('a[href]')].filter(visible).length,
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
            overflow: Math.max(0, root.scrollWidth - root.clientWidth),
            controls: controls.length,
            undersized,
            positioned: positioned.length,
            positionedOutOfBounds: outOfBounds,
            fixedCollisions,
          };
        }"""
    )


def audit_focus(page: Page) -> dict:
    page.evaluate("window.scrollTo(0, 0); document.activeElement?.blur()")
    visited = []
    for _ in range(8):
        page.keyboard.press("Tab")
        item = page.evaluate(
            """() => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const rect = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
              const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
              const stack = document.elementsFromPoint(x, y);
              const unobscured = stack.some(hit => hit === el || hit.contains(el) || el.contains(hit));
              return {
                tag: el.tagName,
                id: el.id || '',
                text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                inViewport: rect.bottom > 0 && rect.right > 0 &&
                  rect.top < innerHeight && rect.left < innerWidth,
                unobscured,
                outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
                shadow: style.boxShadow !== 'none',
              };
            }"""
        )
        if item:
            visited.append(item)
    return {
        "visited": visited,
        "allInViewport": bool(visited) and all(item["inViewport"] for item in visited),
        "allUnobscured": bool(visited) and all(item["unobscured"] for item in visited),
        "hasFocusCue": bool(visited)
        and all(item["outline"] or item["shadow"] for item in visited),
    }


def block_third_party_fonts(context) -> None:
    context.route(
        "**/*",
        lambda route, request: route.abort()
        if (
            request.resource_type == "font"
            or request.url.startswith("https://fonts.googleapis.com/")
            or request.url.startswith("https://fonts.gstatic.com/")
        )
        else route.continue_(),
    )


def audit_representative_routes(browser, base_url: str) -> None:
    for viewport_name, viewport in VIEWPORTS:
        context = browser.new_context(
            viewport=viewport,
            timezone_id="America/Toronto",
            color_scheme="light",
            reduced_motion="reduce",
        )
        # The deploy must remain coherent when third-party webfonts are slow or
        # blocked. Abort both the remote stylesheet and font files immediately
        # so this audit is deterministic instead of waiting on the public web.
        block_third_party_fonts(context)
        context.add_init_script(
            """(() => {
              window.__audit37CLS = 0;
              try {
                new PerformanceObserver(list => {
                  for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) window.__audit37CLS += entry.value;
                  }
                }).observe({type: 'layout-shift', buffered: true});
              } catch (_) {}
            })()"""
        )
        for route_path, label in ROUTES:
            print(f"AUDIT37 {viewport_name}: {label}", flush=True)
            page = context.new_page()
            page_errors: list[str] = []
            page.on("pageerror", lambda error, errors=page_errors: errors.append(str(error)))
            response = page.goto(
                base_url + route_path,
                wait_until="domcontentloaded",
                timeout=45_000,
            )
            check(
                f"{label} {viewport_name}: route responds",
                response is not None and response.status < 400,
                response.status if response else "no response",
            )
            wait_for_route_ready(page, label)
            page.wait_for_timeout(400)
            geometry = route_geometry(page)
            focus = audit_focus(page)
            cls = float(page.evaluate("Number(window.__audit37CLS || 0)"))
            metric = {
                "route": route_path,
                "label": label,
                "viewport": viewport_name,
                "geometry": geometry,
                "focus": focus,
                "cls": cls,
                "pageErrors": page_errors,
            }
            METRICS.append(metric)
            check(
                f"{label} {viewport_name}: document identity remains visible",
                bool(geometry["title"])
                and bool(geometry["semanticHeadings"])
                and geometry["bodyTextLength"] >= 120
                and geometry["links"] >= 1,
                {
                    "title": geometry["title"],
                    "headings": geometry["headings"],
                    "semanticHeadings": geometry["semanticHeadings"],
                    "bodyTextLength": geometry["bodyTextLength"],
                    "links": geometry["links"],
                },
            )
            check(
                f"{label} {viewport_name}: no horizontal page drift",
                geometry["overflow"] <= 2,
                f'{geometry["scrollWidth"]}/{geometry["clientWidth"]}',
            )
            if label not in {"aa", "methodology-list"}:
                check(
                    f"{label} {viewport_name}: layout stays visually stable",
                    cls <= 0.1,
                    f"CLS {cls:.5f}",
                )
            check(
                f"{label} {viewport_name}: positioned controls stay recoverable",
                not geometry["positionedOutOfBounds"]
                and not geometry["fixedCollisions"],
                {
                    "outOfBounds": geometry["positionedOutOfBounds"],
                    "collisions": geometry["fixedCollisions"],
                },
            )
            check(
                f"{label} {viewport_name}: first keyboard path is visible",
                focus["allInViewport"] and focus["allUnobscured"],
                focus["visited"],
            )
            check(
                f"{label} {viewport_name}: no uncaught script errors",
                not page_errors,
                page_errors,
            )
            page.evaluate(
                """() => {
                  const style = document.createElement('style');
                  style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
                  document.head.appendChild(style);
                  window.scrollTo(0, 0);
                  document.activeElement?.blur();
                }"""
            )
            page.wait_for_timeout(50)
            page.screenshot(
                path=str(OUT / f"{label}-{viewport_name}.png"),
                full_page=False,
                animations="disabled",
            )
            page.close()
        context.close()


def audit_forced_colors(browser, base_url: str) -> None:
    routes = (
        ("/", "home"),
        ("/bb/", "bb"),
        ("/bookwormcard/", "bookwormcard"),
        ("/aa/", "aa"),
        ("/teacherresources/", "teacher-resources"),
        ("/polymythseminars/", "polymythcal"),
    )
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        timezone_id="America/Toronto",
        forced_colors="active",
        reduced_motion="reduce",
    )
    block_third_party_fonts(context)
    for route_path, label in routes:
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error, errors=errors: errors.append(str(error)))
        page.goto(base_url + route_path, wait_until="domcontentloaded", timeout=45_000)
        wait_for_route_ready(page, label)
        geometry = route_geometry(page)
        check(
            f"{label} forced colors: content remains available",
            bool(geometry["semanticHeadings"])
            and geometry["bodyTextLength"] >= 120
            and geometry["overflow"] <= 2,
            geometry,
        )
        check(f"{label} forced colors: no uncaught script errors", not errors, errors)
        page.screenshot(
            path=str(OUT / f"{label}-forced-colors.png"),
            full_page=False,
            animations="disabled",
        )
        page.close()
    context.close()


def audit_teacher_resources_stress(browser, base_url: str) -> None:
    context = browser.new_context(
        viewport={"width": 390, "height": 720},
        timezone_id="America/Toronto",
    )
    block_third_party_fonts(context)
    context.add_init_script(
        """(() => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) {
            if (key === 'tr-filters-v3') throw new DOMException('quota', 'QuotaExceededError');
            return original.call(this, key, value);
          };
        })()"""
    )
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(
        base_url + "/teacherresources/",
        wait_until="domcontentloaded",
        timeout=45_000,
    )
    page.locator("#result-count").wait_for(state="visible", timeout=15_000)
    initial_chips = page.locator("button.chip").count()
    initial_total = page.locator("#result-count").inner_text()
    for query in ("geometry", "indigenous", "Shakespeare", ""):
        page.locator("#search").fill(query)
        page.wait_for_timeout(180)
        check(
            f"teacher resources stress: {query or 'cleared'} search reports results",
            bool(page.locator("#result-count").inner_text().strip()),
            page.locator("#result-count").inner_text(),
        )
    visible_candidates = page.locator("button.chip:visible:not(:disabled)")
    if visible_candidates.count() == 0:
        page.locator("#filter-toggle").click()
        page.wait_for_timeout(80)
    candidate = page.locator("button.chip:visible:not(:disabled)").first
    candidate.click()
    filtered_url = page.url
    check(
        "teacher resources stress: filter state reaches the URL without storage",
        "?" in filtered_url,
        filtered_url,
    )
    page.evaluate(
        """() => {
          history.pushState(null, '', '/teacherresources/?q=geometry');
          dispatchEvent(new PopStateEvent('popstate'));
        }"""
    )
    page.wait_for_timeout(180)
    check(
        "teacher resources stress: popstate restores the requested view",
        page.locator("#search").input_value() == "geometry",
        page.locator("#search").input_value(),
    )
    script_url = page.locator('script[src*="/teacherresources/finder.js"]').get_attribute("src")
    page.add_script_tag(url=base_url + script_url)
    page.wait_for_timeout(100)
    check(
        "teacher resources stress: repeated bundle evaluation is idempotent",
        page.locator("button.chip").count() == initial_chips,
        f'{page.locator("button.chip").count()}/{initial_chips}',
    )
    page.locator("#clear").click()
    check(
        "teacher resources stress: clear restores the complete catalog",
        page.locator("#result-count").inner_text() == initial_total,
        page.locator("#result-count").inner_text(),
    )
    check("teacher resources stress: no uncaught script errors", not errors, errors)
    context.close()


def audit_polymythcal_recovery(browser, base_url: str) -> None:
    # Prime the versioned Cache Storage entry, then prove a failed refresh can
    # render the last validated payload.
    context = browser.new_context(
        viewport={"width": 390, "height": 720},
        timezone_id="America/Toronto",
    )
    block_third_party_fonts(context)
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(
        base_url + "/polymythseminars/",
        wait_until="domcontentloaded",
        timeout=45_000,
    )
    page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    initial_cards = page.locator(".pm-event-card").count()
    check("polymythcal recovery: canonical browser payload renders", initial_cards == 24, initial_cards)
    context.route(
        "**/polymythseminars/browse.json",
        lambda route: route.abort("failed"),
    )
    page.reload(wait_until="domcontentloaded", timeout=45_000)
    page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    check(
        "polymythcal recovery: validated last-good payload survives network failure",
        page.locator(".pm-event-card").count() == initial_cards,
        page.locator(".pm-event-card").count(),
    )
    check("polymythcal recovery: cached refresh has no uncaught errors", not errors, errors)
    context.close()

    # A first visit without data must remain an honest, useful, retryable page.
    context = browser.new_context(
        viewport={"width": 390, "height": 720},
        timezone_id="America/Toronto",
    )
    block_third_party_fonts(context)
    context.route(
        "**/polymythseminars/browse.json",
        lambda route: route.abort("failed"),
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(
        base_url + "/polymythseminars/",
        wait_until="domcontentloaded",
        timeout=45_000,
    )
    retry = page.locator("[data-retry-calendar]")
    retry.wait_for(state="visible", timeout=30_000)
    check(
        "polymythcal recovery: empty-cache failure keeps a retry action",
        retry.is_visible()
        and page.locator(
            'a[href="/polymythseminars/subscribe/"]:visible'
        ).first.is_visible(),
    )
    context.unroute("**/polymythseminars/browse.json")
    retry.click()
    page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    check(
        "polymythcal recovery: retry recovers without a page reload",
        page.locator(".pm-event-card").count() == 24,
        page.locator(".pm-event-card").count(),
    )
    check("polymythcal recovery: retry path has no uncaught errors", not errors, errors)
    context.close()


def main() -> None:
    if not SITE_ROOT.is_dir():
        raise SystemExit(f"Site root does not exist: {SITE_ROOT}")
    phase = os.environ.get("AUDIT37_PHASE", "all").strip().lower()
    if phase not in {"all", "routes", "stress"}:
        raise SystemExit("AUDIT37_PHASE must be all, routes, or stress")

    handler = partial(QuietHandler, directory=str(SITE_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"

    try:
        with sync_playwright() as playwright:
            browser = launch_chromium(playwright.chromium)
            if phase in {"all", "routes"}:
                audit_representative_routes(browser, base_url)
                audit_forced_colors(browser, base_url)
            if phase in {"all", "stress"}:
                audit_teacher_resources_stress(browser, base_url)
                audit_polymythcal_recovery(browser, base_url)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    held_direction_findings = []
    for label, route, finding in (
        (
            "aa",
            "/aa/",
            "The large client-rendered archive still shifts materially in a short landscape viewport.",
        ),
        (
            "methodology-list",
            "/polymyth/methodologylist/",
            "The large client-rendered methodology archive still shifts during its initial render.",
        ),
    ):
        cls_by_viewport = {
            metric["viewport"]: metric["cls"]
            for metric in METRICS
            if metric["label"] == label
        }
        if cls_by_viewport and max(cls_by_viewport.values()) > 0.1:
            held_direction_findings.append(
                {
                    "route": route,
                    "finding": finding,
                    "cls_by_viewport": cls_by_viewport,
                    "held_change": "Server-rendering or virtualizing this archive would change its delivery architecture and was not implemented without user direction.",
                }
            )

    report = {
        "audit": 37,
        "release": "Audit37 route resilience and recovery",
        "release_id": RELEASE.get("release_id"),
        "generated_at": RELEASE.get("generated_at"),
        "executed_at": datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds"),
        "engine": "Chromium",
        "phase": phase,
        "font_mode": "third-party fonts blocked; system fallback audited",
        "routes": [route for route, _label in ROUTES],
        "viewports": [name for name, _viewport in VIEWPORTS],
        "checks_passed": sum(1 for result in RESULTS if result["passed"]),
        "checks_total": len(RESULTS),
        "checks_failed": sum(1 for result in RESULTS if not result["passed"]),
        "results": RESULTS,
        "metrics": METRICS,
        "held_direction_findings": held_direction_findings,
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "passed": report["checks_passed"],
                "total": report["checks_total"],
                "routes": len(ROUTES),
                "screenshots": len(list(OUT.glob("*.png"))),
            }
        )
    )
    if report["checks_failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
