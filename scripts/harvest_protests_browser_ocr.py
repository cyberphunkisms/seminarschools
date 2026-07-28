#!/usr/bin/env python3
"""Bounded source-specific browser and flyer-OCR pass for protest discovery.

This is a no-agent pre-pass. It renders only sources explicitly opted in by
scripts/protest-sources.json, OCRs a small number of likely announcement
images, and hands sanitized rendered HTML back to the deterministic parser.
Failure is recorded per source and never deletes or downgrades retained
calendar records.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from harvest_protests import load_protest_sources

DEFAULT_OUTPUT = Path("/tmp/polymythcal-protest-browser-ocr.json")
USER_AGENT = (
    "Mozilla/5.0 (compatible; PolymythcalBrowserHarvest/1.0; "
    "+https://seminarschools.com/polymythseminars/)"
)
ACTION_IMAGE_RE = re.compile(
    r"\b(protest|rally|march|picket|strike|walkout|solidarity|mobiliz|"
    r"demonstration|vigil|day.of.action|river.run|justice|action)\b",
    re.I,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean_ocr_text(value: str) -> str:
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]+", " ", value or "")
    return re.sub(r"[ \t]+", " ", value).strip()[:6000]


def download_image(url: str, target: Path) -> bool:
    try:
        with requests.get(
            url,
            timeout=12,
            headers={"User-Agent": USER_AGENT, "Accept": "image/*"},
            stream=True,
        ) as response:
            response.raise_for_status()
            if not str(response.headers.get("content-type") or "").lower().startswith(
                "image/"
            ):
                return False
            length = int(response.headers.get("content-length") or 0)
            if length > 8 * 1024 * 1024:
                return False
            size = 0
            with target.open("wb") as handle:
                for chunk in response.iter_content(64 * 1024):
                    size += len(chunk)
                    if size > 8 * 1024 * 1024:
                        return False
                    handle.write(chunk)
            return size >= 1024
    except (OSError, requests.RequestException, ValueError):
        return False


def ocr_image(file: Path) -> str:
    if not shutil.which("tesseract"):
        return ""
    commands = [
        ["tesseract", str(file), "stdout", "-l", "eng+fra", "--psm", "6"],
        ["tesseract", str(file), "stdout", "-l", "eng", "--psm", "6"],
    ]
    for command in commands:
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=25,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        text = clean_ocr_text(result.stdout)
        if result.returncode == 0 and len(text) >= 35:
            return text
    return ""


def likely_images(rows: list[dict], *, maximum: int) -> list[dict]:
    ranked = []
    seen = set()
    for row in rows:
        url = str(row.get("url") or "")
        if not url.startswith(("http://", "https://")) or url in seen:
            continue
        seen.add(url)
        width = int(row.get("width") or 0)
        height = int(row.get("height") or 0)
        clue = f"{row.get('alt') or ''} {url}"
        action = bool(ACTION_IMAGE_RE.search(clue))
        large = width >= 240 and height >= 180
        if not action and not large:
            continue
        ranked.append((0 if action else 1, -(width * height), row))
    return [row for _, __, row in sorted(ranked, key=lambda item: item[:2])[:maximum]]


def inject_ocr_articles(document: str, rows: list[dict]) -> str:
    if not rows:
        return document
    articles = []
    for row in rows:
        title = clean_ocr_text(str(row.get("alt") or ""))[:180]
        if not title or title.lower() in {"image", "photo", "poster", "flyer"}:
            title = "Organizer announcement flyer"
        articles.append(
            '<article class="action-card polymythcal-ocr-announcement" '
            'data-polymythcal-harvest="flyer-ocr">'
            f"<h2>{html.escape(title)}</h2>"
            f"<p>{html.escape(str(row['text']))}</p>"
            f'<p><a href="{html.escape(str(row["url"]), quote=True)}">'
            "Original announcement image</a></p></article>"
        )
    block = (
        '<section aria-label="Text recovered from public announcement images">'
        + "".join(articles)
        + "</section>"
    )
    if re.search(r"</body>", document, re.I):
        return re.sub(r"</body>", block + "</body>", document, count=1, flags=re.I)
    return document + block


def render_source(page, source: dict, url: str) -> tuple[dict | None, dict]:
    source_id = str(source.get("id") or "")
    try:
        # A committed document is enough for the bounded rendered snapshot.
        # Waiting for DOMContentLoaded can hang behind unrelated third-party
        # scripts even after the useful source page is already available.
        page.goto(url, wait_until="commit", timeout=18000)
        page.wait_for_timeout(700)
        final_url = page.url
        rendered = page.evaluate(
            """() => {
              const clone = document.documentElement.cloneNode(true);
              clone.querySelectorAll('script,style,noscript,svg,iframe').forEach(node => node.remove());
              return '<!doctype html>\\n' + clone.outerHTML;
            }"""
        )
        image_rows = page.eval_on_selector_all(
            "img",
            """nodes => nodes.map(node => ({
              url: node.currentSrc || node.src || '',
              alt: node.alt || '',
              width: node.naturalWidth || node.width || 0,
              height: node.naturalHeight || node.height || 0
            }))""",
        )
    except PlaywrightTimeoutError as exc:
        return None, {
            "source_id": source_id,
            "url": url,
            "status": "timeout",
            "failure_kind": "browser-navigation-timeout",
            "error": str(exc),
        }
    except Exception as exc:
        message = str(exc)
        if "ERR_TIMED_OUT" in message:
            failure_kind = "browser-network-timeout"
        elif "ERR_NAME_NOT_RESOLVED" in message:
            failure_kind = "browser-dns-resolution"
        elif "ERR_CERT" in message:
            failure_kind = "browser-tls-error"
        elif "ERR_TOO_MANY_REDIRECTS" in message:
            failure_kind = "browser-redirect-loop"
        else:
            failure_kind = "browser-runtime-error"
        return None, {
            "source_id": source_id,
            "url": url,
            "status": "browser-error",
            "failure_kind": failure_kind,
            "error": message,
        }

    ocr_rows = []
    if source.get("ocr_harvest"):
        maximum = max(1, min(8, int(source.get("max_ocr_images") or 5)))
        with tempfile.TemporaryDirectory(prefix="polymythcal-ocr-") as directory:
            root = Path(directory)
            for index, image in enumerate(likely_images(image_rows, maximum=maximum)):
                image_url = urljoin(final_url, str(image.get("url") or ""))
                target = root / f"announcement-{index}.img"
                if not download_image(image_url, target):
                    continue
                text = ocr_image(target)
                if not text:
                    continue
                ocr_rows.append(
                    {
                        "url": image_url,
                        "alt": str(image.get("alt") or "")[:300],
                        "text": text,
                        "text_sha256": hashlib.sha256(
                            text.encode("utf-8")
                        ).hexdigest(),
                    }
                )
    rendered = inject_ocr_articles(str(rendered), ocr_rows)
    document = {
        "source_id": source_id,
        "url": url,
        "final_url": final_url,
        "content_type": "text/html",
        "html": rendered,
        "harvest_method": (
            "headless-browser+ocr" if ocr_rows else "headless-browser"
        ),
        "ocr_images": [
            {key: value for key, value in row.items() if key != "text"}
            for row in ocr_rows
        ],
    }
    return document, {
        "source_id": source_id,
        "url": url,
        "status": "success",
        "failure_kind": "",
        "rendered_bytes": len(rendered.encode("utf-8")),
        "ocr_images": len(ocr_rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source", action="append")
    parser.add_argument(
        "--browser-executable",
        type=Path,
        default=(
            Path(os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"])
            if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
            else None
        ),
        help="Optional compatible Chromium executable for local validation",
    )
    args = parser.parse_args()
    sources, _, _ = load_protest_sources()
    selected = set(args.source or [])
    sources = [
        source
        for source in sources
        if source.get("browser_harvest")
        and (not selected or str(source.get("id") or "") in selected)
    ]
    documents = []
    results = []
    try:
        with sync_playwright() as playwright:
            launch_options = {"headless": True}
            if args.browser_executable:
                if not args.browser_executable.is_file():
                    raise FileNotFoundError(
                        f"configured Chromium executable is missing: "
                        f"{args.browser_executable}"
                    )
                launch_options["executable_path"] = str(
                    args.browser_executable.resolve()
                )
            browser = playwright.chromium.launch(**launch_options)
            context = browser.new_context(
                locale="en-CA",
                timezone_id="America/Toronto",
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()
            for source in sources:
                seeds = [
                    str(source.get("events_url") or ""),
                    *[str(value) for value in source.get("additional_urls") or []],
                ]
                maximum = max(1, min(3, int(source.get("max_browser_pages") or 2)))
                for url in list(dict.fromkeys(seeds))[:maximum]:
                    if not url.startswith(("http://", "https://")):
                        continue
                    document, result = render_source(page, source, url)
                    results.append(result)
                    if document:
                        documents.append(document)
            context.close()
            browser.close()
    except Exception as exc:
        results.append(
            {
                "source_id": "_browser_runtime",
                "url": "",
                "status": "browser-unavailable",
                "failure_kind": "browser-runtime-unavailable",
                "error": str(exc),
            }
        )

    payload = {
        "schema": "polymythcal-protest-browser-ocr-v1",
        "generated_at": now_iso(),
        "scope": "explicit-source-specific-browser-and-flyer-ocr",
        "browser_executable": (
            str(args.browser_executable.resolve())
            if args.browser_executable and args.browser_executable.is_file()
            else "playwright-managed"
        ),
        "source_ids": [str(source.get("id") or "") for source in sources],
        "documents": documents,
        "results": results,
        "summary": {
            "sources": len(sources),
            "documents": len(documents),
            "ocr_images": sum(
                len(row.get("ocr_images") or []) for row in documents
            ),
            "failures": sum(row.get("status") != "success" for row in results),
            "failure_classes": dict(
                sorted(
                    Counter(
                        str(row.get("failure_kind") or "")
                        for row in results
                        if row.get("failure_kind")
                    ).items()
                )
            ),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(payload["summary"], sort_keys=True))
    # A browser-specific failure must not suppress the deterministic HTTP pass.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
