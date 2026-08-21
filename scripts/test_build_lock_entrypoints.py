#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest


SCRIPTS = Path(__file__).resolve().parent


class BuildLockEntrypointTests(unittest.TestCase):
    @staticmethod
    def independent_environment() -> dict[str, str]:
        environment = dict(os.environ)
        environment.pop("SS_RELEASE_BUILD_LOCK_TOKEN", None)
        return environment

    def test_unlocked_writer_fails_and_locked_writer_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary)
            unlocked_environment = self.independent_environment()
            unlocked = subprocess.run(
                [sys.executable, str(SCRIPTS / "assert-build-lock.py"), "--delivery-root", str(delivery)],
                cwd=SCRIPTS.parent,
                env=unlocked_environment,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(unlocked.returncode, 0)
            self.assertIn("run-with-build-lock.py", unlocked.stderr)

            locked = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                    "--",
                    sys.executable,
                    str(SCRIPTS / "assert-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                ],
                cwd=SCRIPTS.parent,
                env=unlocked_environment,
                capture_output=True,
                text=True,
            )
            self.assertEqual(locked.returncode, 0, locked.stderr)
            self.assertIn("RELEASE BUILD LOCK VERIFIED", locked.stdout)
            self.assertFalse((delivery / ".seminar-schools-build.lock").exists())

    def test_outer_wrapper_holds_lease_for_entire_child_lifetime(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("Node is unavailable for the run-python wrapper test")
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary)
            marker = delivery / "child-ready"
            release_marker = delivery / "child-release"
            environment = self.independent_environment()
            holder = subprocess.Popen(
                [
                    node,
                    str(SCRIPTS / "run-python.js"),
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                    "--",
                    sys.executable,
                    "-c",
                    "import pathlib,sys,time; ready=pathlib.Path(sys.argv[1]); stop=pathlib.Path(sys.argv[2]); ready.write_text('ready'); deadline=time.monotonic()+10;\nwhile not stop.exists() and time.monotonic()<deadline: time.sleep(.02)",
                    str(marker),
                    str(release_marker),
                ],
                cwd=SCRIPTS.parent,
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            try:
                deadline = time.monotonic() + 5
                while not marker.exists() and holder.poll() is None and time.monotonic() < deadline:
                    time.sleep(0.02)
                self.assertTrue(marker.exists(), "lock-holding child did not start")
                contender = subprocess.run(
                    [
                        node,
                        str(SCRIPTS / "run-python.js"),
                        str(SCRIPTS / "run-with-build-lock.py"),
                        "--delivery-root",
                        str(delivery),
                        "--",
                        sys.executable,
                        "-c",
                        "raise SystemExit(0)",
                    ],
                    cwd=SCRIPTS.parent,
                    env=environment,
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                self.assertNotEqual(contender.returncode, 0)
                self.assertIn("active advisory lease", contender.stderr)
            finally:
                release_marker.write_text("release", encoding="utf-8")
                try:
                    holder.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    holder.terminate()
                    holder.communicate(timeout=2)

    def test_verify_all_runner_cannot_write_report_without_live_lock(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("Node is unavailable for the verifier entrypoint test")
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary)
            site = delivery / "SITE_PACKAGE"
            site.mkdir()
            (site / "RELEASE_MANIFEST.json").write_text(
                '{"generated_at":"2026-08-09T00:00:00Z"}\n',
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    node,
                    str(SCRIPTS / "verify-all-runner.js"),
                    "--reuse-build",
                    "--timeout-ms=5000",
                ],
                cwd=site,
                env=self.independent_environment(),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("no live release-build lock", result.stderr)
            self.assertFalse(
                (site / "scripts/reports/release-gate-report.json").exists(),
                "unlocked verifier wrote canonical release evidence",
            )


if __name__ == "__main__":
    unittest.main()
