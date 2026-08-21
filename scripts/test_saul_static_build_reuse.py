#!/usr/bin/env python3
"""Regression tests for static-build reuse of verified Saul documents."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).with_name("build-saul-ultimate-web-cv.py")
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


if __name__ == "__main__":
    unittest.main()
