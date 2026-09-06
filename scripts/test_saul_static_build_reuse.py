#!/usr/bin/env python3
"""Regression tests for static-build reuse of verified Saul documents."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest


SCRIPT = Path(__file__).with_name("build-saul-ultimate-web-cv.py")
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("build_saul_ultimate_web_cv", SCRIPT)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class StaticBuildDocumentReuseTests(unittest.TestCase):
    def test_parent_and_locked_build_lifecycles_reuse_committed_documents(self) -> None:
        for lifecycle in ("build", "build:locked"):
            with self.subTest(lifecycle=lifecycle):
                self.assertTrue(
                    BUILDER.should_reuse_generated_documents(
                        [str(SCRIPT)], {"npm_lifecycle_event": lifecycle}
                    )
                )

    def test_explicit_cv_build_still_regenerates_documents(self) -> None:
        self.assertFalse(
            BUILDER.should_reuse_generated_documents(
                [str(SCRIPT)], {"npm_lifecycle_event": "build:saul-cv"}
            )
        )

    def test_explicit_reuse_and_netlify_remain_supported(self) -> None:
        self.assertTrue(
            BUILDER.should_reuse_generated_documents(
                [str(SCRIPT), "--reuse-generated-documents"], {}
            )
        )
        self.assertTrue(
            BUILDER.should_reuse_generated_documents([str(SCRIPT)], {"NETLIFY": "true"})
        )

    def test_retired_routes_emit_the_final_geometry_contract(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('<body {geometry_attributes} data-page-weight="light">', source)
        self.assertIn("geometry_attributes=geometry_body_attributes(", source)
        self.assertIn(
            '<script src="/js/mandala.js?v={geometry_version}" defer></script>',
            source,
        )
        attributes = BUILDER.geometry_body_attributes(
            BUILDER.ROOT,
            "saul/cv/general/index.html",
            "cv-redirect",
            register="quiet",
        )
        for expected in (
            'data-indra-intensity="0.085"',
            'data-geometry-key="/saul/cv/general/"',
            'data-geometry-seed="',
            'data-geometry-register="quiet"',
            'data-geometry-profile="dual-field"',
        ):
            self.assertIn(expected, attributes)
        self.assertNotIn('data-indra-intensity="0.095"', attributes)

    def test_retired_routes_emit_the_current_type_zoom_contract(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        current = (
            '<link rel="stylesheet" '
            'href="/css/site-wide-type-zoom.css?v=20260814-reader-word-integrity" '
            'data-site-wide-type-zoom="20260814-reader-word-integrity">'
        )
        self.assertIn(current, source)
        self.assertNotIn(
            'site-wide-type-zoom.css?v=20260725-audit45" '
            'data-site-wide-type-zoom="20260725-audit45"',
            source,
        )


if __name__ == "__main__":
    unittest.main()
