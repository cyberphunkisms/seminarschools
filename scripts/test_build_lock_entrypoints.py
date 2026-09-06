#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from zoneinfo import ZoneInfo


SCRIPTS = Path(__file__).resolve().parent
TORONTO = ZoneInfo("America/Toronto")


class BuildLockEntrypointTests(unittest.TestCase):
    @staticmethod
    def independent_environment() -> dict[str, str]:
        environment = dict(os.environ)
        environment.pop("SS_RELEASE_BUILD_LOCK_TOKEN", None)
        environment.pop("SS_RELEASE_BUILD_LOCK_ROOT", None)
        return environment

    @staticmethod
    def environment_probe_command() -> list[str]:
        return [
            sys.executable,
            "-c",
            (
                "import json,os; "
                "print(json.dumps({"
                "'site_build_date':os.environ.get('SITE_BUILD_DATE'),"
                "'source_date_epoch':os.environ.get('SOURCE_DATE_EPOCH')"
                "}))"
            ),
        ]

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

    def test_plain_repository_wrapper_defaults_to_site_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            site = Path(temporary).resolve() / "repo"
            copied_scripts = site / "scripts"
            copied_scripts.mkdir(parents=True)
            for filename in (
                "build_lock.py",
                "run-with-build-lock.py",
                "assert-build-lock.py",
            ):
                shutil.copy2(SCRIPTS / filename, copied_scripts / filename)
            plain = subprocess.run(
                [
                    sys.executable,
                    str(copied_scripts / "run-with-build-lock.py"),
                    "--",
                    sys.executable,
                    str(copied_scripts / "assert-build-lock.py"),
                ],
                cwd=site,
                env=self.independent_environment(),
                capture_output=True,
                text=True,
            )
            self.assertEqual(plain.returncode, 0, plain.stderr)
            self.assertIn(f"owns {site}", plain.stdout)
            self.assertFalse((site / ".seminar-schools-build.lock").exists())
            self.assertTrue((site / ".seminar-schools-build.lease").is_file())

    def test_nested_wrapper_inherits_outer_delivery_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary).resolve()
            nested = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                    "--",
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--",
                    sys.executable,
                    str(SCRIPTS / "assert-build-lock.py"),
                ],
                cwd=SCRIPTS.parent,
                env=self.independent_environment(),
                capture_output=True,
                text=True,
            )
            self.assertEqual(nested.returncode, 0, nested.stderr)
            self.assertIn(f"owns {delivery}", nested.stdout)
            self.assertFalse((delivery / ".seminar-schools-build.lock").exists())

    def test_wrapper_preserves_explicit_site_build_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary).resolve()
            environment = self.independent_environment()
            environment["SITE_BUILD_DATE"] = "2042-03-04"
            environment["SOURCE_DATE_EPOCH"] = "0"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                    "--",
                    *self.environment_probe_command(),
                ],
                cwd=SCRIPTS.parent,
                env=environment,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            observed = json.loads(result.stdout.strip().splitlines()[-1])
            self.assertEqual(observed["site_build_date"], "2042-03-04")
            self.assertEqual(observed["source_date_epoch"], "0")

    def test_wrapper_propagates_one_live_toronto_fallback_through_nested_child(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary).resolve()
            environment = self.independent_environment()
            environment.pop("SITE_BUILD_DATE", None)
            # SOURCE_DATE_EPOCH remains an independent artifact clock. It must
            # neither supply nor be rewritten as the live publication day.
            environment["SOURCE_DATE_EPOCH"] = "0"
            before = datetime.now(TORONTO).date().isoformat()
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                    "--",
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--",
                    *self.environment_probe_command(),
                ],
                cwd=SCRIPTS.parent,
                env=environment,
                capture_output=True,
                text=True,
            )
            after = datetime.now(TORONTO).date().isoformat()
            self.assertEqual(result.returncode, 0, result.stderr)
            observed = json.loads(result.stdout.strip().splitlines()[-1])
            self.assertIn(observed["site_build_date"], {before, after})
            self.assertNotEqual(observed["site_build_date"], "1970-01-01")
            self.assertEqual(observed["source_date_epoch"], "0")

    def test_partial_inherited_environment_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary).resolve()
            for only_name, only_value in (
                ("SS_RELEASE_BUILD_LOCK_TOKEN", "orphan-token"),
                ("SS_RELEASE_BUILD_LOCK_ROOT", str(delivery)),
            ):
                with self.subTest(only_name=only_name):
                    environment = self.independent_environment()
                    environment[only_name] = only_value
                    result = subprocess.run(
                        [sys.executable, str(SCRIPTS / "assert-build-lock.py")],
                        cwd=SCRIPTS.parent,
                        env=environment,
                        capture_output=True,
                        text=True,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("must be set together", result.stderr)

    def test_inherited_root_mismatch_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            delivery = Path(temporary).resolve()
            different = delivery / "different"
            different.mkdir()
            mismatch = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "run-with-build-lock.py"),
                    "--delivery-root",
                    str(delivery),
                    "--",
                    sys.executable,
                    str(SCRIPTS / "assert-build-lock.py"),
                    "--delivery-root",
                    str(different),
                ],
                cwd=SCRIPTS.parent,
                env=self.independent_environment(),
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(mismatch.returncode, 0)
            self.assertIn("root does not match", mismatch.stderr)

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
