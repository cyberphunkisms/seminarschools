#!/usr/bin/env python3
"""Independently verify the complete Always Already and ML* successor archive."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import zipfile


SITE_ROOT = Path(__file__).resolve().parents[1]
RELEASE_ID = "seminar-schools-alwaysalready-ml-complete-2026-09-06"
GENERATED_AT = "2026-09-06T23:50:28Z"
PACKAGE_KIND = "seminar-schools-complete-editable-masters-source-and-public"
PAGE = "SITE_PACKAGE/polymyth/alwaysalready/index.html"
PUBLIC_PAGE = "SITE_PACKAGE/public/polymyth/alwaysalready/index.html"
LEDGER = "SITE_PACKAGE/polymyth/alwaysalready/specimens.json"
PUBLIC_LEDGER = "SITE_PACKAGE/public/polymyth/alwaysalready/specimens.json"
IMAGE_NAMES = (
    "2026-07-09_reddit_mirror-shadow-realm.png",
    "2026-08-14_youtube_star-trek-vs-hunger-games.png",
    "2026-08-30_youtube_christianity-fandom-discourse.png",
    "2026-09-06_youtube_psychedelic-comments_full.png",
    "2026-09-06_youtube_psychedelic-comments_crop.png",
    "2026-09-06_youtube_matt-leblanc-joey-actor-as-vessel.png",
)
ADDENDUM = "SITE_PACKAGE/polymyth/methodologylist/assistant-twisting-alwaysalready-addendum.js"
PUBLIC_ADDENDUM = "SITE_PACKAGE/public/polymyth/methodologylist/assistant-twisting-alwaysalready-addendum.js"
SOURCE_INSTRUCTION = "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_ASSISTANT_TWISTING_ALWAYSALREADY_2026-09-06.md"
SOURCE_TRANSCRIPT = "SITE_PACKAGE/UPDATE_SOURCES/SCREENPUFF_MATT_LEBLANC_JOEY_TRANSCRIPT_USER_SUPPLIED_2026-09-06.md"


def load_complete_verifier():
    module_path = SITE_ROOT / "scripts" / "verify-complete-archive-classes.py"
    specification = importlib.util.spec_from_file_location("complete_archive_verifier", module_path)
    if specification is None or specification.loader is None:
        raise RuntimeError("Cannot load complete archive verifier")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    archive_path = args.archive.resolve()

    verifier = load_complete_verifier()
    verifier.EXPECTED_PACKAGE_KIND = PACKAGE_KIND
    verifier.EXPECTED_RELEASE_ID = RELEASE_ID
    verifier.EXPECTED_GENERATED_AT = GENERATED_AT
    verifier.REQUIRED_EXACT_PATHS = verifier.REQUIRED_EXACT_PATHS | {
        "ALWAYSALREADY_RELEASE_NOTES_2026-09-06.md",
        "ALWAYSALREADY_ML_RELEASE_NOTES_2026-09-06.md",
        PAGE,
        PUBLIC_PAGE,
        LEDGER,
        PUBLIC_LEDGER,
        "SITE_PACKAGE/scripts/verify-alwaysalready-page.js",
        "SITE_PACKAGE/scripts/package-alwaysalready-successor.py",
        "SITE_PACKAGE/scripts/verify-alwaysalready-archive.py",
        "SITE_PACKAGE/scripts/verify-assistant-twisting-alwaysalready.js",
        "SITE_PACKAGE/scripts/package-alwaysalready-ml-successor.py",
        "SITE_PACKAGE/scripts/verify-alwaysalready-ml-archive.py",
        ADDENDUM,
        PUBLIC_ADDENDUM,
        SOURCE_INSTRUCTION,
        SOURCE_TRANSCRIPT,
    }
    for image_name in IMAGE_NAMES:
        verifier.REQUIRED_EXACT_PATHS.add(
            f"SITE_PACKAGE/polymyth/alwaysalready/img/{image_name}"
        )
        verifier.REQUIRED_EXACT_PATHS.add(
            f"SITE_PACKAGE/public/polymyth/alwaysalready/img/{image_name}"
        )

    result = verifier.verify_archive(archive_path)

    with zipfile.ZipFile(archive_path, "r") as archive:
        page = archive.read(PAGE)
        public_page = archive.read(PUBLIC_PAGE)
        ledger_bytes = archive.read(LEDGER)
        public_ledger_bytes = archive.read(PUBLIC_LEDGER)
        require(page == public_page, "Always Already source/public page bytes differ")
        require(ledger_bytes == public_ledger_bytes, "Always Already source/public ledger bytes differ")
        ledger = json.loads(ledger_bytes)
        require(ledger.get("schema") == "polymyth-alwaysalready-specimens-v1", "wrong ledger schema")
        require(ledger.get("counts") == {
            "screenshots": 6,
            "public_contexts": 5,
            "sightings": 6,
            "observed": 5,
            "candidate": 1,
        }, "wrong Always Already counts")
        require(len(ledger.get("screenshots", [])) == 6, "ledger does not contain six screenshots")
        require(len(ledger.get("sightings", [])) == 6, "ledger does not contain six sightings")
        ledger_screenshots = {
            row.get("file"): row
            for row in ledger.get("screenshots", [])
            if isinstance(row, dict)
        }
        require(len(ledger_screenshots) == 6, "ledger screenshot paths are missing or duplicated")
        page_text = page.decode("utf-8")
        require('data-front-facing="general-audience"' in page_text, "page lacks general-reader marker")
        require('data-geometry="indra-web"' in page_text, "page lacks Indra geometry")
        require("methodologylist/sabachtan/#sabachtan-always-already-true-operating-mode-dadd2846" in page_text, "page lacks exact ML* link")
        require("analysis-always-already-leblanc-joey-actor-vessel-2026-09-06" in page_text, "page lacks LeBlanc / Joey ML* case link")
        require("https://www.youtube.com/watch?v=T_XfSdNYySc" in page_text, "page lacks ScreenPuff source link")
        for image_name in IMAGE_NAMES:
            source_path = f"SITE_PACKAGE/polymyth/alwaysalready/img/{image_name}"
            public_path = f"SITE_PACKAGE/public/polymyth/alwaysalready/img/{image_name}"
            source_image = archive.read(source_path)
            require(source_image == archive.read(public_path), f"source/public image differs: {image_name}")
            ledger_row = ledger_screenshots.get(f"img/{image_name}")
            require(ledger_row is not None, f"ledger omits {image_name}")
            require(
                ledger_row.get("sha256") == hashlib.sha256(source_image).hexdigest(),
                f"ledger hash differs for {image_name}",
            )
            require(f'src="img/{image_name}"' in page_text, f"page does not embed {image_name}")

        addendum = archive.read(ADDENDUM)
        require(addendum == archive.read(PUBLIC_ADDENDUM), "ML* addendum source/public bytes differ")
        addendum_text = addendum.decode("utf-8")
        for record_id in (
            "method-assistant-twisting-worked-examples-index-2026-09-06",
            "method-assistant-twist-medusa-agent-exemption-2026-09-06",
            "method-every-identified-twist-requires-organized-record-2026-09-06",
            "method-front-facing-outputs-avoid-platformstrawmanculture-2026-09-06",
            "analysis-always-already-leblanc-joey-actor-vessel-2026-09-06",
            "sabachtan-alwaysalready-public-evidence-archive-2026-09-06",
        ):
            require(record_id in addendum_text, f"ML* addendum omits {record_id}")
        require(
            "ml:methodology:anti-twisting-worked-example-psychologism-and-gorgonwars-session:9d1aaf3836d8" in addendum_text,
            "ML* addendum omits the preserved anti-twisting anchor identity",
        )
        require(
            "ml:gorgonification:platformstrawmanculture:b1e10aeffc03" in addendum_text,
            "ML* addendum omits the preserved Platformstrawmanculture identity",
        )
        require(
            hashlib.sha256(archive.read(SOURCE_TRANSCRIPT)).hexdigest()
            == "d65e610a02d0864703cb4d58e89a149b15db8dd172e5ea30293801ca524c96ef",
            "user-supplied ScreenPuff transcript hash differs",
        )

    result.update({
        "alwaysalready_screenshots": 6,
        "alwaysalready_public_contexts": 5,
        "alwaysalready_sightings": 6,
        "new_ml_records": 7,
        "anti_twisting_anchor_identity_preserved": True,
        "platformstrawmanculture_identity_preserved": True,
        "alwaysalready_source_public_parity": True,
    })
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ALWAYS ALREADY ARCHIVE VERIFICATION FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
