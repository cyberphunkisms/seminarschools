#!/usr/bin/env python3
"""Upload verified hf_export/ contents to the private Hugging Face dataset repo."""
from __future__ import annotations
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path.cwd()
EXPORT_DIR = ROOT / "hf_export"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_file(rel: str) -> None:
    if not (ROOT / rel).exists():
        print(f"Missing required file: {rel}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    load_dotenv(ROOT / ".env")
    repo_id = os.environ.get("HF_REPO_ID", "SeminarSchools/meaninglib")
    token = os.environ.get("HF_TOKEN")
    if not token:
        print("HF_TOKEN is missing. Put it in .env or your shell environment.", file=sys.stderr)
        sys.exit(1)
    if not EXPORT_DIR.exists():
        print("hf_export/ does not exist. Run npm run export:meaninglib-dataset first.", file=sys.stderr)
        sys.exit(1)
    require_file("hf_export/reports/latest_export_report.md")
    require_file("hf_export/reports/verification_report.md")
    require_file("hf_export/reports/privacy_scan_report.md")
    if (EXPORT_DIR / ".env").exists():
        print("Refusing to upload: hf_export/.env exists.", file=sys.stderr)
        sys.exit(1)
    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("Missing huggingface_hub. Install it with: pip install huggingface_hub", file=sys.stderr)
        sys.exit(1)
    api = HfApi(token=token)
    msg = f"Sync Meaninglib export {datetime.now(timezone.utc).isoformat(timespec='seconds')}"
    api.upload_folder(
        folder_path=str(EXPORT_DIR),
        repo_id=repo_id,
        repo_type="dataset",
        path_in_repo=".",
        commit_message=msg,
        token=token,
    )
    print(f"Uploaded hf_export/ to {repo_id}")


if __name__ == "__main__":
    main()
