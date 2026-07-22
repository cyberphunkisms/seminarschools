#!/usr/bin/env python3
from __future__ import annotations
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / "seminarschools-netlify-source.zip"
FIXED_TIME = (2026, 7, 22, 0, 0, 0)
EXCLUDED_DIRS = {"public", ".git", ".netlify", "node_modules", "__pycache__", "polymythcal-audit18", "polymythcal-audit19"}
EXCLUDED_FILES = {
    "cv-modular-onepage-samples-2026-07-09.zip",  # byte-identical to the retained final archive
    "Saul_Karim_Nassau_CV_onepage_revamp_2026-07-09.pdf",  # byte-identical legacy operator copy
}

def include(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if any(part in EXCLUDED_DIRS for part in rel.parts):
        return False
    if rel.as_posix() in EXCLUDED_FILES:
        return False
    if path.name == ".env" or (path.name.startswith(".env.") and not path.name.endswith(".example")):
        return False
    if path.suffix.lower() in {".log", ".pyc"}:
        return False
    if path.resolve() == OUTPUT:
        return False
    return path.is_file()

files = sorted((p for p in ROOT.rglob("*") if include(p)), key=lambda p: p.relative_to(ROOT).as_posix())
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        info = zipfile.ZipInfo(rel, FIXED_TIME)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 3
        mode = path.stat().st_mode & 0o777
        info.external_attr = mode << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
print(f"PACKAGED {len(files)} files -> {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
