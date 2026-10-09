#!/usr/bin/env python3
"""Run the complete canonical Polymythcal publication pipeline after any harvest merge."""
from __future__ import annotations
import subprocess, sys
from pathlib import Path
from build_lock import ReleaseBuildLock, inherited_release_build_root
ROOT=Path(__file__).resolve().parents[1]
# Harvest publication and ordinary builds share one maintained generator chain.
COMMANDS=[
 [sys.executable,'scripts/reconcile_polymythcal_lifecycle.py'],
 ['npm','run','build'],
 ['node','scripts/verify-calendar-data-parity.js'],
 [sys.executable,'scripts/build-polymythcal-source-review-queue.py'],
]

with ReleaseBuildLock(inherited_release_build_root(ROOT)):
 for command in COMMANDS:
  print('===',' '.join(command),flush=True)
  result=subprocess.run(command,cwd=ROOT,check=False)
  if result.returncode: raise SystemExit(result.returncode)
 print('Polymythcal publication finalized: lifecycle, mirrors, unified entry pages, stable routes, ICS, feeds, translations, manifest, public deploy, and validation are current.')
