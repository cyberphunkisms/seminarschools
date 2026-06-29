#!/usr/bin/env bash
# Writes the latest harvest status and log tail into the GitHub Actions summary.
# Usage: scripts/summarize-harvest-diagnostics.sh seminars|festivals
set -euo pipefail
STREAM="${1:?stream required: seminars or festivals}"
LOG_DIR="${HARVEST_LOG_DIR:-data/harvest-runs}"
if [[ -z "${GITHUB_STEP_SUMMARY:-}" ]]; then
  exit 0
fi
python3 - "$STREAM" "$LOG_DIR" "$GITHUB_STEP_SUMMARY" <<'PY'
from pathlib import Path
import json, sys
stream, log_dir, summary_path = sys.argv[1:]
root = Path(log_dir)
latest = root / f"{stream}-latest.status.json"
statuses = sorted(root.glob(f"{stream}-*.status.json"))
status_path = latest if latest.exists() else (statuses[-1] if statuses else None)
with open(summary_path, 'a', encoding='utf-8') as out:
    out.write(f"## {stream.title()} harvest diagnostics\n\n")
    if status_path is None:
        out.write("No harvest status file was written. The job likely failed before the runner script began.\n\n")
        raise SystemExit(0)
    try:
        status = json.loads(status_path.read_text(encoding='utf-8'))
    except Exception as exc:
        out.write(f"Could not parse `{status_path}`: {exc}\n\n")
        status = {"log_file": None}
    out.write(f"Status file: `{status_path}`  \n")
    out.write(f"Status: `{status.get('status','unknown')}`  \n")
    out.write(f"Failure kind: `{status.get('failure_kind','unknown')}`  \n")
    out.write(f"Message: `{status.get('message','')}`  \n")
    out.write(f"Exit code: `{status.get('exit_code','?')}`  \n")
    out.write(f"Budget: `${status.get('max_budget_usd','?')}` USD  \n")
    out.write(f"Turns: `{status.get('max_turns','?')}`  \n")
    out.write(f"Timeout: `{status.get('timeout_seconds','?')}` seconds  \n")
    out.write(f"Shard count: `{status.get('shard_count','?')}`  \n")
    out.write(f"Model: `{status.get('model','?')}`  \n\n")
    out.write("```json\n")
    out.write(json.dumps(status, indent=2)[:4000])
    out.write("\n```\n\n")
    log = status.get('log_file')
    if log and Path(log).exists():
        lines = Path(log).read_text(encoding='utf-8', errors='replace').splitlines()[-120:]
        out.write("### Last 120 log lines\n\n")
        out.write("```text\n")
        out.write("\n".join(lines)[-12000:])
        out.write("\n```\n\n")
    else:
        out.write("No log file was found for the latest status.\n\n")
PY
