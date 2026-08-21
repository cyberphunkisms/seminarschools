#!/usr/bin/env python3
"""Extend two truncated V5.1.2 validation ranges without recalculating cells."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
WORKBOOKS = (
    SITE_ROOT / "polymyth/coherence/Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx",
    SITE_ROOT / "public/polymyth/coherence/Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx",
    DELIVERY_ROOT / "EDITABLE_MASTERS/07_POLYMYTH_COHERENCE/Polymyth_Coherence_Assessment_Instrument.xlsx",
    DELIVERY_ROOT / "EDITABLE_MASTERS/07_POLYMYTH_COHERENCE/Polymyth_Coherence_Worked_Applications.xlsx",
)
REPAIRS = {
    "xl/worksheets/sheet5.xml": (
        (b'sqref="N7:N41"', b'sqref="N7:N42"', 2),
    ),
    "xl/worksheets/sheet9.xml": (
        (b'sqref="P7:P281"', b'sqref="P7:P292"', 1),
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def repair(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"Missing Coherence workbook: {path}")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with ZipFile(path, "r") as source:
            members = source.infolist()
            if len(members) != len({member.filename for member in members}):
                raise SystemExit(f"Duplicate OOXML members in {path}")
            with ZipFile(temporary, "w", compression=ZIP_DEFLATED, allowZip64=True) as target:
                target.comment = source.comment
                for member in members:
                    payload = source.read(member.filename)
                    for old, new, expected in REPAIRS.get(member.filename, ()):
                        old_count = payload.count(old)
                        new_count = payload.count(new)
                        if old_count == expected and new_count == 0:
                            payload = payload.replace(old, new)
                        elif old_count == 0 and new_count == expected:
                            pass
                        else:
                            raise SystemExit(
                                f"Unexpected {member.filename} validation state in {path.name}: "
                                f"old={old_count}, new={new_count}, expected={expected}"
                            )
                    target.writestr(member, payload)
        with ZipFile(temporary, "r") as check:
            bad_member = check.testzip()
            if bad_member:
                raise SystemExit(f"Repaired workbook has a corrupt member: {bad_member}")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


for workbook in WORKBOOKS:
    repair(workbook)

hashes = {sha256(workbook) for workbook in WORKBOOKS}
sizes = {workbook.stat().st_size for workbook in WORKBOOKS}
if len(hashes) != 1 or len(sizes) != 1:
    raise SystemExit("Repaired Coherence workbook copies are not byte-identical")
print(f"Coherence validation ranges repaired: {sizes.pop()} bytes; SHA-256 {hashes.pop()}")
