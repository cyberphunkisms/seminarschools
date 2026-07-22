#!/usr/bin/env python3
"""Run the complete canonical Polymythcal publication pipeline after any harvest merge."""
from __future__ import annotations
import subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
COMMANDS=[
 [sys.executable,'scripts/reconcile_polymythcal_lifecycle.py'],
 ['node','scripts/sync-calendar-data.js'],
 ['node','scripts/build-search-pages.js'],
 ['node','scripts/build-writing-shortcuts.js'],
 ['node','scripts/build-academic-shortcuts.js'],
 [sys.executable,'scripts/build-polymythcal-audit13.py'],
 [sys.executable,'scripts/build-polymythcal-feeds.py'],
 [sys.executable,'scripts/build-polymythcal-translation-inventory.py'],
 ['node','scripts/update-polymythcal-build-manifest.js'],
 [sys.executable,'scripts/validate-polymythcal.py'],
 ['node','scripts/verify-calendar-data-parity.js'],
 ['node','scripts/build-public-deploy.js'],
 ['node','scripts/verify-polymythcal-build-efficiency.js'],
]
for command in COMMANDS:
 print('===',' '.join(command),flush=True)
 result=subprocess.run(command,cwd=ROOT,check=False)
 if result.returncode: raise SystemExit(result.returncode)
print('Polymythcal publication finalized: lifecycle, mirrors, unified entry pages, stable routes, ICS, feeds, translations, manifest, public deploy, and validation are current.')
