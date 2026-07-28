#!/usr/bin/env python3
"""Audit 42 browser coverage for the remaining maintenance-level UI modes."""
from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT = ROOT / "data" / "audit42-multimode-browser"
SCREENSHOTS = OUT / "screenshots"
REPORT = OUT / "multimode-browser-audit.json"
RELEASE_ID = "2026-07-25-site-audit42-ledger-closure-multimode-final"
BROWSER_PROGRAM_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

ROUTES = (
    ("/", "home"),
    ("/polymythseminars/", "polymythcal"),
    ("/teacherresources/", "teacher-resources"),
    ("/bb/", "bb"),
    ("/bookwormcard/", "bookwormcard"),
    ("/leizu/", "leizu"),
    ("/saul/", "saul"),
    ("/aa/", "aa"),
    ("/aitr/", "aitr"),
    ("/polymyth/campaigncodex/", "campaigncodex"),
    ("/polymyth/methodologylist/", "methodology"),
    ("/campaigns/thank-you-mam/", "thank-you-mam"),
    ("/campaigns/thank-you-mam/pregame/", "thank-you-mam-pregame"),
)
TEXT_SPACING_ROUTES = ROUTES[:7] + (ROUTES[9], ROUTES[10])
NO_JS_ROUTES = ROUTES[:5] + (ROUTES[10],)
QR_ROUTES = (
    ("/campaigns/thank-you-mam/", "thank-you-mam"),
    ("/campaigns/thank-you-mam/pregame/", "thank-you-mam-pregame"),
    ("/polymyth/bookwormburrows/", "bookwormburrows"),
    ("/polymyth/campaigncodex/", "campaigncodex"),
    ("/polymyth/polymythdnd/", "polymythdnd"),
)
LONG_TASK_BUDGETS = {
    "methodology": 700,
    "campaigncodex": 350,
    "leizu": 300,
}
DEFAULT_LONG_TASK_BUDGET = 250
LONG_SESSION_THEME_ITERATIONS = 50
LONG_SESSION_STATE_ITERATIONS = 30
LONG_SESSION_WARMUP_ITERATIONS = 2
LONG_SESSION_BUDGETS = {
    "home": {
        "js_heap_used_bytes": 8 * 1024 * 1024,
        "dom_nodes": 100,
        "documents": 1,
        "event_listeners": 16,
    },
    "polymythcal": {
        "js_heap_used_bytes": 32 * 1024 * 1024,
        "dom_nodes": 1_000,
        "documents": 1,
        "event_listeners": 32,
    },
    "teacher-resources": {
        "js_heap_used_bytes": 24 * 1024 * 1024,
        "dom_nodes": 500,
        "documents": 1,
        "event_listeners": 32,
    },
}
RESULTS: list[dict[str, Any]] = []
METRICS: list[dict[str, Any]] = []
CPU_METRICS: list[dict[str, Any]] = []
LONG_SESSION_METRICS: list[dict[str, Any]] = []


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: Any) -> None:
        return


def check(name: str, passed: bool, detail: Any = "") -> None:
    RESULTS.append({"name": name, "passed": bool(passed), "detail": str(detail)})


def routed_context(
    browser: Browser,
    base: str,
    *,
    viewport: dict[str, int],
    java_script_enabled: bool = True,
    reduced_motion: str = "reduce",
    color_scheme: str = "light",
) -> BrowserContext:
    context = browser.new_context(
        viewport=viewport,
        java_script_enabled=java_script_enabled,
        reduced_motion=reduced_motion,
        color_scheme=color_scheme,
    )
    context.route(
        "**/*",
        lambda route, request: route.continue_()
        if request.url.startswith(base)
        else route.abort(),
    )
    return context


def wait_ready(page: Page, label: str) -> None:
    page.wait_for_load_state("domcontentloaded")
    if label == "polymythcal":
        page.locator(".pm-event-card").first.wait_for(state="visible", timeout=30_000)
    elif label == "teacher-resources":
        page.locator("#result-count").wait_for(state="visible", timeout=20_000)
    elif label == "bookwormcard":
        page.locator(".bookwormcard-runtime-title").wait_for(state="visible", timeout=20_000)
    elif label == "campaigncodex":
        page.locator("#entries .entry").first.wait_for(state="visible", timeout=20_000)
    elif label == "methodology":
        page.locator(".tab").first.wait_for(state="visible", timeout=30_000)
    page.wait_for_timeout(500)


def page_geometry(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
          const visible = element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
              Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
          };
          const fixed = [...document.querySelectorAll('body *')].filter(element => {
            if (!visible(element) || getComputedStyle(element).position !== 'fixed') return false;
            const rect = element.getBoundingClientRect();
            return rect.width >= 20 && rect.height >= 20 &&
              rect.width < innerWidth * .92 && rect.height < innerHeight * .92;
          });
          const collisions = [];
          for (let i = 0; i < fixed.length; i += 1) {
            for (let j = i + 1; j < fixed.length; j += 1) {
              const a = fixed[i], b = fixed[j];
              if (a.contains(b) || b.contains(a)) continue;
              const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
              const width = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
              const height = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
              if (width > 4 && height > 4) {
                collisions.push({
                  a: `${a.tagName}#${a.id}.${String(a.className).slice(0, 60)}`,
                  b: `${b.tagName}#${b.id}.${String(b.className).slice(0, 60)}`,
                  overlap: [Math.round(width), Math.round(height)],
                });
              }
            }
          }
          const h1 = [...document.querySelectorAll('h1,[role="heading"][aria-level="1"]')];
          return {
            overflow: Math.max(0, document.documentElement.scrollWidth -
              document.documentElement.clientWidth),
            mainVisible: [...document.querySelectorAll('main,[role="main"]')].filter(visible).length,
            h1Total: h1.length,
            h1Visible: h1.filter(visible).length,
            fixedCollisions: collisions,
            maxLongTaskMs: Math.max(0, ...(window.__audit42LongTasks || [])),
            longTaskCount: (window.__audit42LongTasks || []).length,
          };
        }"""
    )


def viewport_matrix(browser: Browser, base: str) -> None:
    modes = (
        ("ultrawide", {"width": 2560, "height": 1080}),
        ("foldable-landscape", {"width": 717, "height": 512}),
    )
    screenshot_labels = {
        "home",
        "polymythcal",
        "teacher-resources",
        "bb",
        "bookwormcard",
        "thank-you-mam",
        "thank-you-mam-pregame",
    }
    for mode, viewport in modes:
        context = routed_context(browser, base, viewport=viewport)
        context.add_init_script(
            """window.__audit42LongTasks = [];
            try {
              new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                  window.__audit42LongTasks.push(entry.duration);
                }
              }).observe({type: 'longtask', buffered: true});
            } catch {}"""
        )
        for route, label in ROUTES:
            errors: list[str] = []
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
            wait_ready(page, label)
            values = page_geometry(page)
            values.update({"mode": mode, "route": route, "label": label})
            METRICS.append(values)
            prefix = f"{mode} {label}"
            check(f"{prefix}: HTTP success", bool(response and response.ok),
                  response.status if response else "none")
            check(f"{prefix}: one visible main", values["mainVisible"] == 1,
                  values["mainVisible"])
            check(f"{prefix}: exactly one visible H1", values["h1Visible"] == 1,
                  {"visible": values["h1Visible"], "total": values["h1Total"]})
            check(f"{prefix}: no horizontal overflow", values["overflow"] <= 1,
                  values["overflow"])
            check(f"{prefix}: fixed controls do not collide",
                  not values["fixedCollisions"], values["fixedCollisions"])
            check(f"{prefix}: no page errors", not errors, errors)
            if mode == "ultrawide":
                budget = LONG_TASK_BUDGETS.get(label, DEFAULT_LONG_TASK_BUDGET)
                check(f"{prefix}: long-task regression budget",
                      values["maxLongTaskMs"] <= budget,
                      f"{values['maxLongTaskMs']:.1f}ms / {budget}ms")
            if label in screenshot_labels:
                page.screenshot(
                    path=str(SCREENSHOTS / f"{mode}-{label}.png"),
                    full_page=False,
                )
            page.close()
        context.close()


def text_spacing_matrix(browser: Browser, base: str) -> None:
    context = routed_context(browser, base, viewport={"width": 1280, "height": 900})
    for route, label in TEXT_SPACING_ROUTES:
        page = context.new_page()
        page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
        wait_ready(page, label)
        page.add_style_tag(
            content="""
              p, li, dd, dt, blockquote, figcaption, label, summary,
              h1, h2, h3, h4, h5, h6 {
                line-height: 1.5 !important;
                letter-spacing: .12em !important;
                word-spacing: .16em !important;
              }
              p { margin-bottom: 2em !important; }
            """
        )
        page.wait_for_timeout(150)
        values = page.evaluate(
            """() => {
              const clipped = [];
              for (const element of document.querySelectorAll(
                'p,li,dd,dt,blockquote,figcaption,label,summary,h1,h2,h3,h4,h5,h6'
              )) {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                if (rect.width < 4 || rect.height < 4 || style.visibility === 'hidden') continue;
                if (
                  element.scrollWidth > element.clientWidth + 2 &&
                  ['hidden', 'clip'].includes(style.overflowX)
                ) {
                  clipped.push({
                    tag: element.tagName,
                    id: element.id,
                    className: String(element.className).slice(0, 70),
                    text: (element.textContent || '').trim().slice(0, 90),
                  });
                }
              }
              return {
                overflow: Math.max(0, document.documentElement.scrollWidth -
                  document.documentElement.clientWidth),
                clipped: clipped.slice(0, 20),
              };
            }"""
        )
        check(f"text spacing {label}: no page overflow", values["overflow"] <= 1,
              values["overflow"])
        check(f"text spacing {label}: no clipped reading text", not values["clipped"],
              values["clipped"])
        if label in {"polymythcal", "teacher-resources", "bookwormcard"}:
            page.screenshot(
                path=str(SCREENSHOTS / f"text-spacing-{label}.png"),
                full_page=False,
            )
        page.close()
    context.close()


def reduced_transparency_matrix(browser: Browser, base: str) -> None:
    routes = (ROUTES[0], ROUTES[1], ROUTES[2], ROUTES[5], ROUTES[6])
    context = routed_context(browser, base, viewport={"width": 1440, "height": 900})
    for route, label in routes:
        page = context.new_page()
        session = context.new_cdp_session(page)
        session.send(
            "Emulation.setEmulatedMedia",
            {
                "media": "screen",
                "features": [
                    {"name": "prefers-reduced-transparency", "value": "reduce"},
                    {"name": "prefers-reduced-motion", "value": "reduce"},
                ],
            },
        )
        page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
        wait_ready(page, label)
        values = page.evaluate(
            """() => ({
              preference: matchMedia('(prefers-reduced-transparency: reduce)').matches,
              remaining: [...document.querySelectorAll('*')].filter(element => {
                const style = getComputedStyle(element);
                return style.display !== 'none' &&
                  style.backdropFilter && style.backdropFilter !== 'none';
              }).slice(0, 20).map(element => ({
                tag: element.tagName,
                id: element.id,
                className: String(element.className).slice(0, 80),
                value: getComputedStyle(element).backdropFilter,
              })),
            })"""
        )
        check(f"reduced transparency {label}: preference emulated",
              values["preference"], values["preference"])
        check(f"reduced transparency {label}: backdrop filters removed",
              not values["remaining"], values["remaining"])
        if label in {"home", "polymythcal", "leizu"}:
            page.screenshot(
                path=str(SCREENSHOTS / f"reduced-transparency-{label}.png"),
                full_page=False,
            )
        page.close()
    context.close()


def event_route() -> str:
    for source in sorted((PUBLIC / "polymythseminars" / "events").glob("*/index.html")):
        html = source.read_text(encoding="utf-8")
        if (
            'name="robots" content="noindex' not in html
            and '"@type":"Event"' in html
            and "Event moved · Fiche déplacée" not in html
        ):
            return "/" + source.parent.relative_to(PUBLIC).as_posix() + "/"
    raise RuntimeError("No current indexable event route is available")


def print_matrix(browser: Browser, base: str) -> None:
    context = routed_context(browser, base, viewport={"width": 1440, "height": 900})

    page = context.new_page()
    page.goto(base + "/polymythseminars/?q=philosophy",
              wait_until="domcontentloaded", timeout=60_000)
    wait_ready(page, "polymythcal")
    page.emulate_media(media="print")
    page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
    page.wait_for_timeout(250)
    values = page.evaluate(
        """() => {
          const countText = document.querySelector('.pm-results-count')?.textContent || '';
          const total = Number((countText.match(/[\\d,]+/) || ['0'])[0].replace(/,/g, ''));
          const source = document.querySelector('.pm-event-card a[href^="http"]');
          return {
            total,
            cards: document.querySelectorAll('.pm-event-card').length,
            filtersDisplay: getComputedStyle(document.querySelector('.pm-filter-drawer')).display,
            sourceAfter: source ? getComputedStyle(source, '::after').content : '',
          };
        }"""
    )
    check("print polymythcal: every filtered result is rendered",
          values["total"] > 0 and values["cards"] == values["total"], values)
    check("print polymythcal: filter controls are removed",
          values["filtersDisplay"] == "none", values["filtersDisplay"])
    check("print polymythcal: external source URLs are exposed",
          values["sourceAfter"] not in {"", "none", '""'}, values["sourceAfter"])
    page.screenshot(path=str(SCREENSHOTS / "print-polymythcal.png"), full_page=False)
    page.close()

    page = context.new_page()
    page.goto(base + "/teacherresources/", wait_until="domcontentloaded", timeout=60_000)
    wait_ready(page, "teacher-resources")
    page.emulate_media(media="print")
    values = page.evaluate(
        """() => ({
          entries: document.querySelectorAll('#catalog .entry').length,
          controls: getComputedStyle(document.querySelector('.controls')).display,
          overflow: Math.max(0, document.documentElement.scrollWidth -
            document.documentElement.clientWidth),
        })"""
    )
    check("print teacher resources: all 644 resources remain present",
          values["entries"] == 644, values["entries"])
    check("print teacher resources: finder controls are removed",
          values["controls"] == "none", values["controls"])
    check("print teacher resources: no horizontal overflow",
          values["overflow"] <= 1, values["overflow"])
    page.close()

    route = event_route()
    page = context.new_page()
    page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
    page.emulate_media(media="print")
    values = page.evaluate(
        """() => {
          const links = [...document.querySelectorAll('.pm-event-actions a[href]')]
            .filter(link => getComputedStyle(link).display !== 'none');
          return {
            links: links.length,
            exposed: links.filter(link =>
              !['', 'none', '""'].includes(getComputedStyle(link, '::after').content)
            ).length,
          };
        }"""
    )
    check("print event detail: action links remain readable", values["links"] >= 2, values)
    check("print event detail: action destinations are exposed",
          values["exposed"] == values["links"], values)
    page.close()
    context.close()


def preference_matrix(browser: Browser, base: str) -> None:
    context = routed_context(
        browser,
        base,
        viewport={"width": 1280, "height": 800},
        color_scheme="light",
    )
    page = context.new_page()
    page.goto(base + "/", wait_until="domcontentloaded", timeout=45_000)
    page.evaluate(
        """() => {
          localStorage.setItem('ss-theme', 'dark');
          localStorage.setItem('ss-fontscale', '1.15');
        }"""
    )
    for route, label in (ROUTES[0], ROUTES[1], ROUTES[2], ROUTES[3], ROUTES[6]):
        page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
        if label in {"polymythcal", "teacher-resources"}:
            wait_ready(page, label)
        values = page.evaluate(
            """() => ({
              dark: document.documentElement.classList.contains('dark') ||
                document.documentElement.getAttribute('data-theme') === 'dark',
              fontScale: parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--font-scale')
              ) || 1,
            })"""
        )
        check(f"preferences {label}: explicit dark theme persists", values["dark"], values)
        check(f"preferences {label}: font scale persists",
              values["fontScale"] >= 1.14, values["fontScale"])
    page.close()
    context.close()

    blocked = routed_context(browser, base, viewport={"width": 1280, "height": 800})
    blocked.add_init_script(
        """for (const name of ['getItem', 'setItem', 'removeItem']) {
          try {
            Object.defineProperty(Storage.prototype, name, {
              configurable: true,
              value() { throw new DOMException('blocked by audit', 'SecurityError'); }
            });
          } catch {}
        }"""
    )
    for route, label in (ROUTES[0], ROUTES[1], ROUTES[2]):
        errors: list[str] = []
        page = blocked.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        response = page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
        if label in {"polymythcal", "teacher-resources"}:
            wait_ready(page, label)
        check(f"blocked preferences {label}: route remains operational",
              bool(response and response.ok), response.status if response else "none")
        check(f"blocked preferences {label}: no uncaught storage error", not errors, errors)
        page.close()
    blocked.close()


def keyboard_matrix(browser: Browser, base: str) -> None:
    context = routed_context(browser, base, viewport={"width": 1280, "height": 800})
    page = context.new_page()

    page.goto(base + "/polymythseminars/", wait_until="domcontentloaded", timeout=60_000)
    wait_ready(page, "polymythcal")
    page.locator("body").press("/")
    check("keyboard polymythcal: slash focuses search",
          page.evaluate("document.activeElement?.id") == "pmSearch",
          page.evaluate("document.activeElement?.id"))
    page.locator("#pmSearch").fill("abc")
    page.locator("#pmSearch").press("ArrowLeft")
    page.locator("#pmSearch").press("/")
    check("keyboard polymythcal: editable keys stay in the input",
          page.locator("#pmSearch").input_value() == "ab/c",
          page.locator("#pmSearch").input_value())
    page.locator("#pmSearch").blur()
    page.keyboard.press("Control+/")
    check("keyboard polymythcal: modified slash is ignored",
          page.evaluate("document.activeElement?.id") != "pmSearch",
          page.evaluate("document.activeElement?.id"))
    page.locator("#pmSavedToggle").click()
    check("keyboard polymythcal: saved dialog opens",
          page.locator("#pmSavedPanel").evaluate("node => node.open"), "")
    page.keyboard.press("Escape")
    check("keyboard polymythcal: Escape closes saved dialog",
          not page.locator("#pmSavedPanel").evaluate("node => node.open"), "")

    page.goto(base + "/teacherresources/", wait_until="domcontentloaded", timeout=60_000)
    wait_ready(page, "teacher-resources")
    page.locator("body").press("/")
    check("keyboard teacher resources: slash focuses search",
          page.evaluate("document.activeElement?.id") == "search",
          page.evaluate("document.activeElement?.id"))
    page.locator("#search").fill("math")
    page.locator("#search").press("ArrowLeft")
    check("keyboard teacher resources: arrow stays in search",
          page.evaluate("document.activeElement?.id") == "search",
          page.evaluate("document.activeElement?.id"))

    page.goto(base + "/bookwormcard/", wait_until="domcontentloaded", timeout=60_000)
    wait_ready(page, "bookwormcard")
    page.locator("#start-wormcard").click()
    page.locator('input[role="combobox"]').wait_for(state="visible", timeout=20_000)
    page.locator("#user-input").press("ArrowRight")
    page.locator("#user-input").press("Enter")
    page.locator("#user-input").fill("2000")
    page.locator("#user-input").press("Enter")
    page.locator("#menu.visible").wait_for(state="visible", timeout=20_000)
    combobox = page.locator('[role="combobox"]').first
    if combobox.count():
        combobox.focus()
        combobox.press("ArrowDown")
        values = {
            "expanded": combobox.get_attribute("aria-expanded"),
            "active": combobox.get_attribute("aria-activedescendant"),
        }
        active_selected = page.locator(
            f"#{values['active']}"
        ).get_attribute("aria-selected") if values["active"] else None
        check("keyboard bookwormcard: listbox opens with active descendant",
              values["expanded"] == "true" and bool(values["active"]), values)
        check("keyboard bookwormcard: active option is selected",
              active_selected == "true", active_selected)
    else:
        check("keyboard bookwormcard: combobox exists", False, "missing")
    page.close()
    context.close()


def no_js_reader_proxy(browser: Browser, base: str) -> None:
    context = routed_context(
        browser,
        base,
        viewport={"width": 1280, "height": 800},
        java_script_enabled=False,
    )
    minimum_text = {
        "home": 500,
        "polymythcal": 500,
        # Teacher Resources has a stronger route-specific assertion below:
        # all 644 static links plus native disclosure operation. Keep this
        # generic text-presence proxy aligned with the other route shells.
        "teacher-resources": 500,
        "bb": 500,
        "bookwormcard": 500,
        "methodology": 1_000,
    }
    for route, label in NO_JS_ROUTES:
        page = context.new_page()
        response = page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
        values = page.evaluate(
            """() => ({
              main: document.querySelectorAll('main,[role="main"]').length,
              h1: document.querySelectorAll('h1,[role="heading"][aria-level="1"]').length,
              text: (document.body?.innerText || '').trim().length,
              links: document.querySelectorAll('a[href]').length,
              staticResourceEntries: document.querySelectorAll(
                '#catalog a.entry[href]'
              ).length,
              staticMethodologyEditions: document.querySelectorAll(
                '#static-methodology-editions a.resource-card[href]'
              ).length,
              methodologyTextLinks: document.querySelectorAll(
                'a[href$="methodologylist.txt"]'
              ).length,
              overflow: Math.max(0, document.documentElement.scrollWidth -
                document.documentElement.clientWidth),
            })"""
        )
        check(f"no-JS {label}: HTTP success", bool(response and response.ok),
              response.status if response else "none")
        check(f"no-JS {label}: semantic main and H1",
              values["main"] >= 1 and values["h1"] >= 1, values)
        check(f"no-JS {label}: meaningful text remains",
              values["text"] >= minimum_text[label], values["text"])
        check(f"no-JS {label}: links remain available", values["links"] >= 3,
              values["links"])
        if label == "teacher-resources":
            check("no-JS teacher-resources: all static resource links remain",
                  values["staticResourceEntries"] >= 644,
                  values["staticResourceEntries"])
            page.locator("details.group > summary").first.click()
            page.locator("details.category > summary").first.click()
            check("no-JS teacher-resources: native disclosure reveals entries",
                  page.locator("a.entry:visible").count() > 0,
                  page.locator("a.entry:visible").count())
        if label == "methodology":
            check("no-JS methodology: all static section editions remain",
                  values["staticMethodologyEditions"] >= 16,
                  values["staticMethodologyEditions"])
            check("no-JS methodology: complete plain-text route remains",
                  values["methodologyTextLinks"] >= 1,
                  values["methodologyTextLinks"])
        check(f"no-JS {label}: no horizontal overflow", values["overflow"] <= 1,
              values["overflow"])
        page.close()
    context.close()


def injected_interference_proxy(browser: Browser, base: str) -> None:
    context = routed_context(browser, base, viewport={"width": 1280, "height": 800})
    context.add_init_script(
        """addEventListener('DOMContentLoaded', () => {
          const host = document.createElement('div');
          host.id = 'audit-extension-host';
          host.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;z-index:2147483647';
          host.attachShadow({mode:'open'}).innerHTML = '<span>extension proxy</span>';
          document.documentElement.appendChild(host);
          document.documentElement.style.setProperty('--audit-extension-noise', '1');
        }, {once:true});"""
    )
    for route, label in (ROUTES[0], ROUTES[1], ROUTES[2], ROUTES[4], ROUTES[5]):
        errors: list[str] = []
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
        wait_ready(page, label)
        values = page_geometry(page)
        check(f"extension proxy {label}: one visible main",
              values["mainVisible"] == 1, values["mainVisible"])
        check(f"extension proxy {label}: no page errors", not errors, errors)
        check(f"extension proxy {label}: no horizontal overflow",
              values["overflow"] <= 1, values["overflow"])
        page.close()
    context.close()


def grayscale_state_proxy(browser: Browser, base: str) -> None:
    context = routed_context(browser, base, viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.goto(base + "/polymythseminars/", wait_until="domcontentloaded", timeout=60_000)
    wait_ready(page, "polymythcal")
    page.add_style_tag(content="html { filter: grayscale(1) !important; }")
    chip = page.locator(".pm-chip input").first
    chip.check()
    state = chip.is_checked()
    label_text = chip.locator("xpath=..").inner_text().strip()
    check("grayscale polymythcal: selection retains checked state and text",
          state and bool(label_text), {"checked": state, "text": label_text})
    page.screenshot(path=str(SCREENSHOTS / "grayscale-polymythcal.png"), full_page=False)
    page.close()
    context.close()


def qr_collision_matrix(browser: Browser, base: str) -> None:
    modes = (
        ("desktop", {"width": 1280, "height": 800}),
        ("foldable-landscape", {"width": 717, "height": 512}),
        ("mobile", {"width": 390, "height": 844}),
    )
    for mode, viewport in modes:
        context = routed_context(browser, base, viewport=viewport)
        for route, label in QR_ROUTES:
            page = context.new_page()
            response = page.goto(
                base + route,
                wait_until="domcontentloaded",
                timeout=60_000,
            )
            qr = page.locator("[data-bb-qr]")
            qr.wait_for(state="attached", timeout=20_000)
            qr.evaluate("node => node.scrollIntoView({block: 'center', inline: 'nearest'})")
            page.wait_for_timeout(100)
            values = page.evaluate(
                """() => {
                  const qr = document.querySelector('[data-bb-qr]');
                  const visible = element => {
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden'
                      && Number(style.opacity || 1) > 0
                      && rect.width > 0 && rect.height > 0;
                  };
                  const rect = qr?.getBoundingClientRect();
                  const overlaps = [];
                  if (qr && rect && visible(qr)) {
                    for (const element of document.querySelectorAll('body *')) {
                      if (element === qr || qr.contains(element) || element.contains(qr)) continue;
                      const style = getComputedStyle(element);
                      if (!visible(element) || style.position !== 'fixed') continue;
                      // Decorative fixed layers cannot intercept a pointer or keyboard
                      // action, so they are not controls and cannot obstruct QR use.
                      if (style.pointerEvents === 'none') continue;
                      const other = element.getBoundingClientRect();
                      const width = Math.min(rect.right, other.right)
                        - Math.max(rect.left, other.left);
                      const height = Math.min(rect.bottom, other.bottom)
                        - Math.max(rect.top, other.top);
                      if (width > 4 && height > 4) {
                        overlaps.push({
                          element: `${element.tagName}#${element.id}.${String(element.className).slice(0, 60)}`,
                          overlap: [Math.round(width), Math.round(height)],
                        });
                      }
                    }
                  }
                  return {
                    visible: Boolean(qr && visible(qr)),
                    width: rect?.width || 0,
                    height: rect?.height || 0,
                    href: qr?.getAttribute('href') || '',
                    overlaps,
                  };
                }"""
            )
            prefix = f"QR {mode} {label}"
            check(f"{prefix}: HTTP success and canonical destination",
                  bool(response and response.ok)
                  and values["href"] == "/bookwormcard/",
                  {"status": response.status if response else "none",
                   "href": values["href"]})
            check(f"{prefix}: in-flow control remains visible and operable",
                  values["visible"]
                  and values["width"] >= 44
                  and values["height"] >= 44,
                  values)
            check(f"{prefix}: fixed controls do not cover the QR",
                  not values["overlaps"], values["overlaps"])
            page.close()
        context.close()


def cpu_throttle_matrix(browser: Browser, base: str) -> None:
    cases = (
        ("/", "home"),
        ("/polymythseminars/", "polymythcal"),
        ("/teacherresources/", "teacher-resources"),
        ("/bookwormcard/", "bookwormcard"),
        ("/polymyth/methodologylist/", "methodology"),
    )
    context = routed_context(
        browser,
        base,
        viewport={"width": 390, "height": 844},
    )
    context.add_init_script(
        """window.__audit42CpuLongTasks = [];
        try {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              window.__audit42CpuLongTasks.push(entry.duration);
            }
          }).observe({type: 'longtask', buffered: true});
        } catch {}"""
    )
    for route, label in cases:
        page = context.new_page()
        session = context.new_cdp_session(page)
        session.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        ready_started = time.perf_counter()
        response = page.goto(
            base + route,
            wait_until="domcontentloaded",
            timeout=60_000,
        )
        wait_ready(page, label)
        ready_ms = (time.perf_counter() - ready_started) * 1000

        action_started = time.perf_counter()
        if label == "polymythcal":
            page.locator("#pmSearch").fill("Toronto")
            page.wait_for_timeout(350)
        elif label == "teacher-resources":
            page.locator("#search").fill("math")
            page.wait_for_timeout(350)
        elif label == "bookwormcard":
            page.locator("#start-wormcard").click()
            page.locator('input[role="combobox"]').wait_for(
                state="visible",
                timeout=20_000,
            )
        elif label == "methodology":
            page.locator('.tab[data-s="gorgonification"]').click()
            page.locator("#entries .entry").first.wait_for(
                state="visible",
                timeout=20_000,
            )
        else:
            page.evaluate("scrollTo(0, Math.min(600, document.body.scrollHeight))")
            page.wait_for_timeout(100)
        action_ms = (time.perf_counter() - action_started) * 1000
        long_tasks = page.evaluate("window.__audit42CpuLongTasks || []")
        max_long_task_ms = max([0, *long_tasks])
        metric = {
            "label": label,
            "route": route,
            "cpu_throttle_rate": 4,
            "ready_ms": round(ready_ms, 1),
            "interaction_ms": round(action_ms, 1),
            "max_long_task_ms": round(max_long_task_ms, 1),
            "long_task_count": len(long_tasks),
        }
        CPU_METRICS.append(metric)
        prefix = f"4x CPU {label}"
        check(f"{prefix}: HTTP success", bool(response and response.ok),
              response.status if response else "none")
        check(f"{prefix}: perceived-ready budget",
              ready_ms <= 15_000, metric)
        check(f"{prefix}: interaction and long-task budgets",
              action_ms <= 5_000 and max_long_task_ms <= 2_500, metric)
        session.detach()
        page.close()
    context.close()


def cdp_memory_metrics(session: Any) -> dict[str, int]:
    names = {
        "JSHeapUsedSize": "js_heap_used_bytes",
        "Nodes": "dom_nodes",
        "Documents": "documents",
        "JSEventListeners": "event_listeners",
    }
    raw = session.send("Performance.getMetrics").get("metrics", [])
    values = {
        names[row["name"]]: int(round(row["value"]))
        for row in raw
        if row.get("name") in names
    }
    missing = sorted(set(names.values()) - set(values))
    if missing:
        raise RuntimeError(
            "Chromium performance metrics omitted " + ", ".join(missing)
        )
    return values


def collect_cdp_garbage(session: Any) -> bool:
    try:
        session.send("HeapProfiler.collectGarbage")
        return True
    except Exception:
        return False


def exercise_shared_theme(page: Page, iterations: int) -> dict[str, Any]:
    return page.evaluate(
        """iterations => {
          let toggle = document.querySelector('.theme-toggle');
          let control = 'native';
          if (!toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'theme-toggle';
            toggle.hidden = true;
            toggle.dataset.audit42DelegationProbe = 'true';
            document.body.appendChild(toggle);
            control = 'audit-delegation-probe';
          } else if (toggle.dataset.audit42DelegationProbe === 'true') {
            control = 'audit-delegation-probe';
          }
          const currentTheme = () => (
            document.documentElement.classList.contains('dark') ||
            document.documentElement.getAttribute('data-theme') === 'dark'
          ) ? 'dark' : 'light';
          const before = currentTheme();
          for (let index = 0; index < iterations; index += 1) toggle.click();
          const after = currentTheme();
          return {
            control,
            iterations,
            before,
            after,
            toggleCount: document.querySelectorAll('.theme-toggle').length,
            liveRegions: document.querySelectorAll('#theme-toggle-live').length,
            pressed: toggle.getAttribute('aria-pressed'),
          };
        }""",
        iterations,
    )


def exercise_history_state(page: Page, label: str, iterations: int) -> dict[str, Any]:
    return page.evaluate(
        """({label, iterations}) => {
          const terms = ['history', 'Toronto', 'math', 'poetry', 'science'];
          const pathname = location.pathname;
          for (let index = 0; index < iterations; index += 1) {
            const key = label === 'home' ? 'audit42-session' : 'q';
            const value = terms[index % terms.length];
            const query = new URLSearchParams([[key, value]]);
            history.replaceState(null, '', `${pathname}?${query}`);
            dispatchEvent(new PopStateEvent('popstate'));
          }
          history.replaceState(null, '', pathname);
          dispatchEvent(new PopStateEvent('popstate'));
          return {
            iterations,
            pathname: location.pathname,
            search: location.search,
          };
        }""",
        {"label": label, "iterations": iterations},
    )


def long_session_state(page: Page, label: str) -> dict[str, Any]:
    return page.evaluate(
        """label => {
          const common = {
            pathname: location.pathname,
            search: location.search,
            mainCount: document.querySelectorAll('main,[role="main"]').length,
            visibleH1: [...document.querySelectorAll(
              'h1,[role="heading"][aria-level="1"]'
            )].filter(element => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden'
                && rect.width > 0 && rect.height > 0;
            }).length,
          };
          if (label === 'polymythcal') {
            return {
              ...common,
              input: document.querySelector('#pmSearch')?.value ?? null,
              resultCards: document.querySelectorAll('.pm-event-card').length,
              busy: document.querySelector('#pmResults')?.getAttribute('aria-busy'),
            };
          }
          if (label === 'teacher-resources') {
            return {
              ...common,
              input: document.querySelector('#search')?.value ?? null,
              resultText: document.querySelector('#result-count')?.textContent?.trim() || '',
              entries: document.querySelectorAll('#catalog .entry').length,
            };
          }
          return common;
        }""",
        label,
    )


def long_session_matrix(browser: Browser, base: str) -> None:
    cases = (
        ("/", "home"),
        ("/polymythseminars/", "polymythcal"),
        ("/teacherresources/", "teacher-resources"),
    )
    for route, label in cases:
        context = routed_context(
            browser,
            base,
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        errors: list[str] = []
        failed_local: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def failed(request: Any) -> None:
            if request.url.startswith(base):
                failed_local.append(request.url)

        page.on("requestfailed", failed)
        session = context.new_cdp_session(page)
        session.send("Performance.enable")
        response = page.goto(
            base + route,
            wait_until="domcontentloaded",
            timeout=60_000,
        )
        wait_ready(page, label)

        # Populate first-use caches and the shared theme status node before the
        # baseline so the trend measures repetition rather than initialization.
        exercise_shared_theme(page, LONG_SESSION_WARMUP_ITERATIONS)
        exercise_history_state(
            page,
            label,
            LONG_SESSION_WARMUP_ITERATIONS,
        )
        page.wait_for_timeout(250)
        gc_before = collect_cdp_garbage(session)
        page.wait_for_timeout(100)
        before = cdp_memory_metrics(session)

        theme = exercise_shared_theme(
            page,
            LONG_SESSION_THEME_ITERATIONS,
        )
        history_state = exercise_history_state(
            page,
            label,
            LONG_SESSION_STATE_ITERATIONS,
        )
        page.wait_for_timeout(350)
        state = long_session_state(page, label)
        gc_after = collect_cdp_garbage(session)
        page.wait_for_timeout(100)
        after = cdp_memory_metrics(session)
        delta = {
            key: after[key] - before[key]
            for key in before
        }
        budgets = LONG_SESSION_BUDGETS[label]
        metric = {
            "label": label,
            "route": route,
            "theme_iterations": LONG_SESSION_THEME_ITERATIONS,
            "state_history_iterations": LONG_SESSION_STATE_ITERATIONS,
            "warmup_iterations": LONG_SESSION_WARMUP_ITERATIONS,
            "theme_control": theme["control"],
            "gc_before": gc_before,
            "gc_after": gc_after,
            "before": before,
            "after": after,
            "delta": delta,
            "budgets": budgets,
        }
        LONG_SESSION_METRICS.append(metric)
        prefix = f"long-session {label}"
        theme_matches_pressed = (
            (theme["after"] == "dark" and theme["pressed"] == "true")
            or (theme["after"] == "light" and theme["pressed"] == "false")
        )
        if label == "polymythcal":
            state_ok = (
                state["input"] == ""
                and state["resultCards"] >= 1
                and state["busy"] == "false"
            )
        elif label == "teacher-resources":
            state_ok = (
                state["input"] == ""
                and state["entries"] == 644
                and state["resultText"].startswith("644 resources")
            )
        else:
            state_ok = state["mainCount"] == 1 and state["visibleH1"] == 1
        state_ok = (
            state_ok
            and state["pathname"] == route
            and state["search"] == ""
            and history_state["search"] == ""
        )

        check(f"{prefix}: HTTP success", bool(response and response.ok),
              response.status if response else "none")
        check(
            f"{prefix}: repeated theme toggles settle coherently",
            theme["iterations"] == LONG_SESSION_THEME_ITERATIONS
            and theme["before"] == theme["after"]
            and theme["toggleCount"] == 1
            and theme["liveRegions"] == 1
            and theme_matches_pressed,
            theme,
        )
        check(
            f"{prefix}: filter and history cycles settle coherently",
            history_state["iterations"] == LONG_SESSION_STATE_ITERATIONS
            and state_ok,
            {"history": history_state, "state": state},
        )
        check(
            f"{prefix}: no page or local request failures",
            not errors and not failed_local,
            {"page_errors": errors, "failed_local": failed_local},
        )
        check(
            f"{prefix}: JS heap growth budget",
            delta["js_heap_used_bytes"] <= budgets["js_heap_used_bytes"],
            metric,
        )
        check(
            f"{prefix}: DOM node growth budget",
            delta["dom_nodes"] <= budgets["dom_nodes"],
            metric,
        )
        check(
            f"{prefix}: document growth budget",
            delta["documents"] <= budgets["documents"],
            metric,
        )
        check(
            f"{prefix}: event-listener growth budget",
            delta["event_listeners"] <= budgets["event_listeners"],
            metric,
        )
        session.detach()
        page.close()
        context.close()


def manifest_contract(base: str) -> None:
    manifest = json.loads((PUBLIC / "manifest.json").read_text(encoding="utf-8"))
    check("standalone manifest: display remains standalone",
          manifest.get("display") == "standalone", manifest.get("display"))
    check("standalone manifest: orientation supports rotation and foldables",
          manifest.get("orientation") in {None, "any"},
          manifest.get("orientation"))
    check("standalone manifest: start URL and scope remain root",
          manifest.get("start_url") == "/" and manifest.get("scope") == "/",
          {"start_url": manifest.get("start_url"), "scope": manifest.get("scope")})


def main() -> None:
    release = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    if release.get("release_id") != RELEASE_ID:
        raise SystemExit(
            "AUDIT 42 MULTIMODE FAILED — apply the Audit 42 release stamp first"
        )
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
    browser_name = ""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            browser_name = f"Chromium {browser.version}"
            viewport_matrix(browser, base)
            text_spacing_matrix(browser, base)
            reduced_transparency_matrix(browser, base)
            print_matrix(browser, base)
            preference_matrix(browser, base)
            keyboard_matrix(browser, base)
            no_js_reader_proxy(browser, base)
            injected_interference_proxy(browser, base)
            grayscale_state_proxy(browser, base)
            qr_collision_matrix(browser, base)
            cpu_throttle_matrix(browser, base)
            long_session_matrix(browser, base)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    manifest_contract(base)
    failures = [result for result in RESULTS if not result["passed"]]
    report = {
        "audit": 42,
        "release": "Audit 42 multimode maintenance closure",
        "release_id": RELEASE_ID,
        "generated_at": release.get("generated_at"),
        "executed_at": executed_at,
        "browser": browser_name,
        "engine": "Chromium",
        "browser_program_sha256": BROWSER_PROGRAM_SHA256,
        "checks_total": len(RESULTS),
        "checks_passed": len(RESULTS) - len(failures),
        "checks_failed": len(failures),
        "results": RESULTS,
        "metrics": METRICS,
        "cpu_metrics": CPU_METRICS,
        "long_session_metrics": LONG_SESSION_METRICS,
        "screenshots": len(list(SCREENSHOTS.glob("*.png"))),
        "coverage": [
            "ultrawide and foldable-like viewport geometry",
            "visible H1 and long-task route budgets",
            "WCAG text-spacing override",
            "reduced transparency",
            "complete filtered-calendar print and print URLs",
            "theme and text-size preference persistence and blocked storage",
            "shortcut collision behavior",
            "no-JavaScript semantic extraction proxy",
            "injected extension-interference proxy",
            "grayscale state proxy",
            "five-route QR overlay collision matrix",
            "4x low-end mobile CPU perceived-performance tracing",
            "long-session theme/filter/history heap and DOM trend matrix",
            "standalone manifest rotation",
        ],
        "environment_limits": [
            "Native Firefox and Safari/WebKit require a compatible unrestricted host.",
            "Native VoiceOver requires macOS hardware.",
            "Native NVDA requires Windows hardware.",
            "Real browser extensions, voice control, foldable hinges, and low-end battery or thermal behavior require physical-device testing.",
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "passed": report["checks_passed"],
        "failed": report["checks_failed"],
        "total": report["checks_total"],
        "screenshots": report["screenshots"],
        "report": str(REPORT.relative_to(ROOT)),
    }))
    if failures:
        for failure in failures:
            print(f"FAIL {failure['name']}: {failure['detail']}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
