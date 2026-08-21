#!/usr/bin/env python3
"""Fail early with setup instructions for the strict browser audit."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


REQUIRED_MODULES = {
    "bs4": "beautifulsoup4",
    "playwright": "playwright",
}


def main() -> int:
    missing = [
        package
        for module, package in REQUIRED_MODULES.items()
        if importlib.util.find_spec(module) is None
    ]
    if missing:
        print(
            "PYTHON BROWSER AUDIT PREFLIGHT FAILED — missing packages: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        print(
            "Install them with: python -m pip install --require-hashes --requirement requirements-audit.lock",
            file=sys.stderr,
        )
        return 1

    from playwright.sync_api import sync_playwright

    try:
        with sync_playwright() as playwright:
            executable = Path(playwright.chromium.executable_path)
    except Exception as exc:
        print(
            f"PYTHON BROWSER AUDIT PREFLIGHT FAILED — Playwright could not start: {exc}",
            file=sys.stderr,
        )
        return 1

    if not executable.is_file():
        print(
            "PYTHON BROWSER AUDIT PREFLIGHT FAILED — Playwright Chromium is not installed.",
            file=sys.stderr,
        )
        print(
            "Install it with: python -m playwright install chromium",
            file=sys.stderr,
        )
        return 1

    print(f"PYTHON BROWSER AUDIT PREFLIGHT PASSED — Chromium ready at {executable}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
