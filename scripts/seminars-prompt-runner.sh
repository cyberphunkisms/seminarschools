#!/usr/bin/env bash
#
# Bounded, observable polymythcalendar seminars harvest.
# A failed agent run never merges partial data. Its transcript and status are
# retained as a workflow artifact so the exact failure is visible in Actions.
set -euo pipefail

PROMPT_FILE="scripts/seminars-prompt.md"
OUTPUT_FILE="/tmp/seminars-output.json"
TODAY="$(date -u +'%Y-%m-%d')"
RUN_ID="$(date -u +'%Y%m%dT%H%M%SZ')"
LOG_DIR="${HARVEST_LOG_DIR:-data/harvest-runs}"
LOG_FILE="${LOG_DIR}/seminars-${RUN_ID}.log"
STATUS_FILE="${LOG_DIR}/seminars-${RUN_ID}.status.json"
MAX_TURNS="${MAX_TURNS:-70}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-2.50}"
HARVEST_TIMEOUT_SECONDS="${HARVEST_TIMEOUT_SECONDS:-1500}"
mkdir -p "${LOG_DIR}"

write_status() {
  python3 - "$STATUS_FILE" "$1" "$TODAY" "$RUN_ID" "$LOG_FILE" "$MAX_TURNS" "$MAX_BUDGET_USD" "$HARVEST_TIMEOUT_SECONDS" <<'PY'
import json, sys
out, code, today, run_id, log, turns, budget, timeout = sys.argv[1:]
json.dump({
  "stream":"seminars", "run_id":run_id, "date_utc":today,
  "exit_code":int(code), "log_file":log,
  "max_turns":int(turns), "max_budget_usd":float(budget),
  "timeout_seconds":int(timeout)
}, open(out,"w"), indent=2)
open(out,"a").write("\n")
PY
}

if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
  echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN env var not set. Generate it with claude setup-token." >&2
  write_status 78
  exit 78
fi

SHARD=$(( 10#$(date -u +%V) % 4 ))
PROMPT_BODY="Today is ${TODAY} (UTC). This run's SHARD number is ${SHARD}. $(cat "${PROMPT_FILE}")"
echo "=== polymythcalendar seminars harvest ${RUN_ID}; shard ${SHARD}; max ${HARVEST_TIMEOUT_SECONDS}s ==="

# Capture both stdout and stderr. `timeout` makes the job wall explicit; a
# partial JSON file is intentionally never merged because it could erase
# previously indexed records during a replacement merge.
set +e
timeout --signal=INT --kill-after=30s "${HARVEST_TIMEOUT_SECONDS}" \
  claude -p "${PROMPT_BODY}" \
    --model claude-sonnet-4-6 \
    --tools "WebFetch,Read,Write,Bash" \
    --allowedTools "WebFetch,Read,Write,Bash" \
    --permission-mode bypassPermissions \
    --max-turns "${MAX_TURNS}" \
    --max-budget-usd "${MAX_BUDGET_USD}" 2>&1 | tee "${LOG_FILE}"
CLAUDE_STATUS="${PIPESTATUS[0]}"
set -e
write_status "${CLAUDE_STATUS}"

if [[ "${CLAUDE_STATUS}" -ne 0 ]]; then
  echo "ERROR: claude -p exited ${CLAUDE_STATUS}; data was left unchanged. Read ${LOG_FILE} and ${STATUS_FILE}." >&2
  exit "${CLAUDE_STATUS}"
fi
if [[ ! -f "${OUTPUT_FILE}" ]]; then
  echo "ERROR: expected output file ${OUTPUT_FILE} was not produced. Data was left unchanged. Read ${LOG_FILE}." >&2
  exit 65
fi
python3 - "$OUTPUT_FILE" <<'PY'
import json,sys
p=sys.argv[1]
try: data=json.load(open(p))
except Exception as e: raise SystemExit(f"ERROR: malformed harvest JSON: {e}")
if not isinstance(data,dict) or not isinstance(data.get('events'),list): raise SystemExit('ERROR: harvest JSON must be an object with an events array')
for i,e in enumerate(data['events']):
    if not isinstance(e,dict) or not all(e.get(k) for k in ('title','date','source_url')):
        raise SystemExit(f'ERROR: harvest record {i} lacks title, date, or source_url')
print(f"=== valid full harvest: {len(data['events'])} events ===")
PY
python3 scripts/merge_and_finalize.py
