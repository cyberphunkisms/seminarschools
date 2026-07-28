#!/usr/bin/env python3
"""Run frozen Audit 37 browser logic with Audit 38-owned evidence paths.

Audit 37 scripts stay byte-identical historical evidence. This adapter applies
only release-label/output-path substitutions in memory, so the proven browser
assertions can be reused without either rewriting history or duplicating five
large audit programs.
"""
from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINES = {
    "interaction": ROOT / "scripts" / "audit-polymythcal-interactivity-design-audit37.py",
    "entry-pages": ROOT / "scripts" / "audit-polymythcal-entry-pages-audit37.py",
    "wcag": ROOT / "scripts" / "audit-polymythcal-wcag22-audit37.py",
    "routes": ROOT / "scripts" / "audit-audit37-route-resilience.py",
    "stress": ROOT / "scripts" / "audit-project-failure-stress-audit37.py",
}


def audit38_source(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    replacements = (
        ("AUDIT37", "AUDIT38"),
        ("Audit37", "Audit38"),
        ("Audit 37", "Audit 38"),
        ("audit37", "audit38"),
        ('"audit": 37', '"audit": 38'),
        ("'audit': 37", "'audit': 38"),
    )
    for before, after in replacements:
        source = source.replace(before, after)
    return source


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audit", choices=sorted(BASELINES))
    args = parser.parse_args()
    baseline = BASELINES[args.audit]
    source = audit38_source(baseline)
    namespace = {
        "__name__": "__main__",
        "__file__": str(baseline),
        "__package__": None,
    }
    exec(compile(source, str(baseline), "exec"), namespace)


if __name__ == "__main__":
    main()
