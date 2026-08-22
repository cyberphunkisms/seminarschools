#!/usr/bin/env python3
"""Repository-wide OS-leased single-writer lock for release mutations."""
from __future__ import annotations

from contextlib import AbstractContextManager
import errno
import json
import os
from pathlib import Path
import socket
import time
import uuid


LOCK_DIRECTORY_NAME = ".seminar-schools-build.lock"
OWNER_FILE_NAME = "owner.json"
LEASE_FILE_NAME = ".seminar-schools-build.lease"
INHERITED_TOKEN_ENV = "SS_RELEASE_BUILD_LOCK_TOKEN"
INHERITED_ROOT_ENV = "SS_RELEASE_BUILD_LOCK_ROOT"


def _inherited_lock_environment() -> tuple[str, Path] | None:
    """Return the complete inherited-lock identity, rejecting unsafe state.

    The token alone is not enough to identify a lock: nested repository builds
    also need to know which delivery root owns its advisory lease.  Requiring a
    canonical absolute root prevents an inherited token from being silently
    reinterpreted against a different checkout or working directory.
    """
    token = os.environ.get(INHERITED_TOKEN_ENV)
    root_value = os.environ.get(INHERITED_ROOT_ENV)
    if (token is None) != (root_value is None):
        raise RuntimeError(
            "inherited release-build lock environment is incomplete; "
            f"{INHERITED_TOKEN_ENV} and {INHERITED_ROOT_ENV} must be set together"
        )
    if token is None:
        return None
    if not token or not root_value:
        raise RuntimeError("inherited release-build lock token and root must be non-empty")
    inherited_root = Path(root_value)
    resolved_root = inherited_root.resolve()
    if not inherited_root.is_absolute() or inherited_root != resolved_root:
        raise RuntimeError(
            f"{INHERITED_ROOT_ENV} must be a canonical absolute path"
        )
    return token, resolved_root


def inherited_release_build_root(default: Path) -> Path:
    """Use an outer lock root when nested, otherwise the caller's safe default."""
    inherited = _inherited_lock_environment()
    if inherited is None:
        return Path(default).resolve()
    return inherited[1]


def advisory_lease_backend() -> str:
    return "msvcrt.locking" if os.name == "nt" else "fcntl.flock"


def _open_lease(path: Path) -> int:
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    if os.name == "nt" and os.fstat(descriptor).st_size == 0:
        # Windows byte-range locks require the locked byte to exist.
        os.write(descriptor, b"\0")
        os.fsync(descriptor)
    return descriptor


def _try_lock_lease(descriptor: int) -> bool:
    """Take a nonblocking OS lease, returning False only for contention."""
    if os.name == "nt":
        import msvcrt

        os.lseek(descriptor, 0, os.SEEK_SET)
        try:
            msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
        except OSError:
            # Windows lock error reporting varies by filesystem. Treat every
            # refusal conservatively as a live contender rather than stealing.
            return False
        return True

    import fcntl

    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as error:
        if error.errno in {errno.EACCES, errno.EAGAIN}:
            return False
        raise
    return True


def _unlock_lease(descriptor: int) -> None:
    if os.name == "nt":
        import msvcrt

        os.lseek(descriptor, 0, os.SEEK_SET)
        msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
        return
    import fcntl

    fcntl.flock(descriptor, fcntl.LOCK_UN)


def release_build_lease_is_held(delivery_root: Path) -> bool:
    """Return whether another open file description owns the OS lease.

    Owner JSON and PIDs are deliberately irrelevant here. The stable lease
    file remains in place between runs so a diagnostic-directory restore can
    never manufacture liveness or replace the inode held by an active writer.
    """
    lease_path = Path(delivery_root).resolve() / LEASE_FILE_NAME
    descriptor = _open_lease(lease_path)
    try:
        if not _try_lock_lease(descriptor):
            return True
        _unlock_lease(descriptor)
        return False
    finally:
        os.close(descriptor)


def require_release_build_lock(delivery_root: Path) -> dict:
    """Return diagnostics only when the inherited token has a live OS lease."""
    inherited = _inherited_lock_environment()
    if inherited is None:
        raise RuntimeError(
            "canonical writers must run through scripts/run-with-build-lock.py"
        )
    token, inherited_root = inherited
    required_root = Path(delivery_root).resolve()
    if inherited_root != required_root:
        raise RuntimeError(
            "inherited release-build lock root does not match the required root "
            f"({inherited_root} != {required_root})"
        )
    owner_path = required_root / LOCK_DIRECTORY_NAME / OWNER_FILE_NAME
    try:
        owner = json.loads(owner_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError) as error:
        raise RuntimeError("release-build lock owner is missing or invalid") from error
    if owner.get("token") != token:
        raise RuntimeError("inherited release-build lock token does not match its owner")
    if owner.get("scope") != "release_build":
        raise RuntimeError("release-build lock has the wrong scope")
    try:
        lease_is_held = release_build_lease_is_held(required_root)
    except OSError as error:
        raise RuntimeError("release-build advisory lease could not be inspected") from error
    if not lease_is_held:
        raise RuntimeError(
            "inherited release-build lock token has no live advisory lease"
        )
    return owner


def process_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return True
    return True


def process_identity(pid: int) -> dict[str, str | int]:
    """Return best-effort Linux process diagnostics when available.

    A numeric PID alone is not durable: it can be reused, and containerized
    release commands can observe different processes at the same PID. These
    fields aid incident reports but never decide lock ownership.
    """
    if pid <= 0:
        return {}
    identity: dict[str, str | int] = {}
    try:
        identity["pid_namespace"] = os.readlink(f"/proc/{pid}/ns/pid")
    except OSError:
        pass
    try:
        stat = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
        # The parenthesized command name can contain spaces and parentheses.
        # Fields after its final ')' begin with field 3; starttime is field 22.
        fields_after_command = stat[stat.rfind(")") + 2 :].split()
        identity["process_start_ticks"] = int(fields_after_command[19])
    except (OSError, ValueError, IndexError):
        pass
    return identity


def owner_process_is_alive(owner: dict) -> bool:
    """Return best-effort diagnostic process liveness.

    This value is never an ownership or reclamation decision. PID namespaces,
    wrapper processes, and PID reuse make metadata incapable of proving that a
    release writer still owns the delivery root; only the advisory lease can.
    """
    try:
        pid = int(owner.get("pid") or 0)
    except (TypeError, ValueError):
        return False
    if not process_is_alive(pid):
        return False
    expected = {
        key: owner.get(key)
        for key in ("pid_namespace", "process_start_ticks")
        if owner.get(key) is not None
    }
    if not expected:
        return True
    current = process_identity(pid)
    for key, value in expected.items():
        if current.get(key) is None:
            # Failure to inspect a live PID is ambiguous; preserve exclusion.
            return True
        if current[key] != value:
            return False
    return True


class ReleaseBuildLock(AbstractContextManager["ReleaseBuildLock"]):
    """Serialize all canonical build/package writers across the delivery root.

    Nested subprocesses inherit the exact owner token and therefore do not
    deadlock. The outer wrapper holds an OS lease for the entire child command
    lifetime. Owner JSON is diagnostic and can never create or extend liveness.
    """

    def __init__(self, delivery_root: Path, scope: str = "release_build") -> None:
        self.delivery_root = Path(delivery_root).resolve()
        self.lock_dir = self.delivery_root / LOCK_DIRECTORY_NAME
        self.owner_path = self.lock_dir / OWNER_FILE_NAME
        self.lease_path = self.delivery_root / LEASE_FILE_NAME
        self.scope = scope
        self.hostname = socket.gethostname()
        self.token = f"{self.hostname}:{os.getpid()}:{uuid.uuid4().hex}"
        self.acquired = False
        self.inherited = False
        self.previous_environment_token: str | None = None
        self.previous_environment_root: str | None = None
        self.lease_descriptor: int | None = None

    def _read_owner(self) -> dict:
        try:
            value = json.loads(self.owner_path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            return {}
        return value if isinstance(value, dict) else {}

    def _write_owner_exclusive(self) -> None:
        payload = {
            "schema": "seminar-schools-single-writer-lock-v2",
            "token": self.token,
            "hostname": self.hostname,
            "pid": os.getpid(),
            "created_epoch": time.time(),
            "scope": self.scope,
            "lease_file": LEASE_FILE_NAME,
            "lease_backend": advisory_lease_backend(),
            **process_identity(os.getpid()),
        }
        descriptor = os.open(self.owner_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
        except Exception:
            self.owner_path.unlink(missing_ok=True)
            raise

    def _acquire_advisory_lease(self) -> None:
        descriptor = _open_lease(self.lease_path)
        try:
            if not _try_lock_lease(descriptor):
                owner = self._read_owner()
                raise RuntimeError(
                    "release build is already owned by an active advisory lease "
                    f"({owner.get('hostname', 'unknown')}:{owner.get('pid', 'unknown')}; "
                    f"{self.lease_path})"
                )
        except Exception:
            os.close(descriptor)
            raise
        self.lease_descriptor = descriptor

    def _release_advisory_lease(self) -> None:
        descriptor = self.lease_descriptor
        self.lease_descriptor = None
        if descriptor is None:
            return
        try:
            _unlock_lease(descriptor)
        finally:
            os.close(descriptor)

    def _prepare_diagnostic_directory(self) -> None:
        """Replace any resurrected owner directory while holding the lease."""
        if self.lease_descriptor is None:
            raise RuntimeError("diagnostic owner replacement requires the advisory lease")
        for _ in range(4):
            if self.lock_dir.exists():
                quarantine = self.delivery_root / (
                    f".{LOCK_DIRECTORY_NAME}.stale-{os.getpid()}-{uuid.uuid4().hex}"
                )
                try:
                    os.replace(self.lock_dir, quarantine)
                except FileNotFoundError:
                    continue
                try:
                    # Owner metadata is the only file this lock creates. Leave
                    # an unexpected quarantine intact for inspection.
                    if quarantine.is_symlink():
                        quarantine.unlink()
                    elif quarantine.is_dir():
                        (quarantine / OWNER_FILE_NAME).unlink(missing_ok=True)
                        quarantine.rmdir()
                except OSError:
                    pass
            try:
                self.lock_dir.mkdir()
                return
            except FileExistsError:
                continue
        raise RuntimeError(
            f"could not prepare release-build diagnostic directory: {self.lock_dir}"
        )

    def acquire(self) -> "ReleaseBuildLock":
        inherited = _inherited_lock_environment()
        if inherited is not None:
            require_release_build_lock(self.delivery_root)
            self.token = inherited[0]
            self.inherited = True
            return self
        self._acquire_advisory_lease()
        try:
            self._prepare_diagnostic_directory()
            self._write_owner_exclusive()
        except Exception:
            try:
                self.lock_dir.rmdir()
            except OSError:
                pass
            self._release_advisory_lease()
            raise
        self.acquired = True
        self.previous_environment_token = os.environ.get(INHERITED_TOKEN_ENV)
        self.previous_environment_root = os.environ.get(INHERITED_ROOT_ENV)
        os.environ[INHERITED_TOKEN_ENV] = self.token
        os.environ[INHERITED_ROOT_ENV] = str(self.delivery_root)
        return self

    def release(self) -> None:
        if self.inherited or not self.acquired:
            return
        try:
            owner = self._read_owner()
            if owner.get("token") == self.token:
                self.owner_path.unlink(missing_ok=True)
                try:
                    self.lock_dir.rmdir()
                except OSError:
                    pass
            if self.previous_environment_token is None:
                os.environ.pop(INHERITED_TOKEN_ENV, None)
            else:
                os.environ[INHERITED_TOKEN_ENV] = self.previous_environment_token
            if self.previous_environment_root is None:
                os.environ.pop(INHERITED_ROOT_ENV, None)
            else:
                os.environ[INHERITED_ROOT_ENV] = self.previous_environment_root
            self.acquired = False
        finally:
            self._release_advisory_lease()

    def __enter__(self) -> "ReleaseBuildLock":
        return self.acquire()

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.release()
