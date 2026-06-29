#!/usr/bin/env bash
#
# Bounded, observable polymythcalendar festival harvest.
# Agent/network/budget/timeout failures leave public data unchanged and emit
# diagnostics; configuration and post-merge integrity failures still fail.
set -euo pipefail

PROMPT_FILE="scripts/festivals-prompt.md"
OUTPUT_FILE="/tmp/festivals-output.json"
STREAM="festivals"
TODAY="$(date -u +'%Y-%m-%d')"
RUN_ID="$(date -u +'%Y%m%dT%H%M%SZ')"
LOG_DIR="${HARVEST_LOG_DIR:-data/harvest-runs}"
LOG_FILE="${LOG_DIR}/${STREAM}-${RUN_ID}.log"
STATUS_FILE="${LOG_DIR}/${STREAM}-${RUN_ID}.status.json"
LATEST_STATUS_FILE="${LOG_DIR}/${STREAM}-latest.status.json"
MAX_TURNS="${MAX_TURNS:-40}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-3.00}"
HARVEST_TIMEOUT_SECONDS="${HARVEST_TIMEOUT_SECONDS:-840}"
HARVEST_ATTEMPTS="${HARVEST_ATTEMPTS:-1}"
FESTIVAL_SHARD_COUNT="${FESTIVAL_SHARD_COUNT:-10}"
STRICT_HARVEST_FAILURES="${STRICT_HARVEST_FAILURES:-false}"
HARVEST_STRICT="${HARVEST_STRICT:-0}"
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"
mkdir -p "${LOG_DIR}"
rm -f "${OUTPUT_FILE}"

failure_kind_for_code() {
  case "$1" in
    0) echo "none" ;;
    65|66|67) echo "invalid-agent-output" ;;
    78) echo "configuration" ;;
    124|130|137|143) echo "timeout-or-interrupted" ;;
    *) echo "agent-nonzero" ;;
  esac
}

is_strict_harvest() {
  [[ "${STRICT_HARVEST_FAILURES}" =~ ^(1|true|TRUE|yes|YES)$ || "${HARVEST_STRICT}" =~ ^(1|true|TRUE|yes|YES)$ ]]
}

write_status() {
  local code="$1" stage="${2:-agent}" message="${3:-}" attempt="${4:-0}"
  local kind status
  kind="$(failure_kind_for_code "${code}")"
  if [[ "${code}" == "0" ]]; then
    status="success"
  elif [[ "${kind}" == "configuration" || "${stage}" == "merge" || "${stage}" == "verify" ]]; then
    status="failed"
  else
    status="skipped"
  fi
  python3 - "$STATUS_FILE" "$LATEST_STATUS_FILE" "$code" "$status" "$stage" "$kind" "$message" "$attempt" "$HARVEST_ATTEMPTS" "$TODAY" "$RUN_ID" "$LOG_FILE" "$MAX_TURNS" "$MAX_BUDGET_USD" "$HARVEST_TIMEOUT_SECONDS" "$FESTIVAL_SHARD_COUNT" "$STRICT_HARVEST_FAILURES" "$HARVEST_STRICT" "$CLAUDE_MODEL" <<'PY'
import json, shutil, sys
(
    out, latest, code, status, stage, kind, message, attempt, attempts, today,
    run_id, log, turns, budget, timeout, shard_count, strict_flag, harvest_strict,
    model,
) = sys.argv[1:]
payload = {
    "stream": "festivals",
    "run_id": run_id,
    "date_utc": today,
    "status": status,
    "exit_code": int(code),
    "stage": stage,
    "failure_kind": kind,
    "message": message,
    "attempt": int(attempt),
    "attempts": int(attempts),
    "log_file": log,
    "max_turns": int(turns),
    "max_budget_usd": float(budget),
    "timeout_seconds": int(timeout),
    "shard_count": int(shard_count),
    "strict_harvest_failures": strict_flag.lower() in {"1", "true", "yes"},
    "harvest_strict": harvest_strict.lower() in {"1", "true", "yes"},
    "model": model,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")
shutil.copyfile(out, latest)
PY
}

soft_exit_or_fail() {
  local code="$1" msg="$2" attempt="${3:-0}"
  write_status "${code}" "agent" "${msg}" "${attempt}"
  if [[ "$(failure_kind_for_code "${code}")" == "configuration" ]] || is_strict_harvest; then
    echo "::error title=Polymythcalendar festivals harvest::${msg}" >&2
    exit "${code}"
  fi
  echo "::warning title=Polymythcalendar festivals harvest::${msg} Existing verified calendar data stayed intact. See ${LOG_FILE} and ${STATUS_FILE}." >&2
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Festivals harvest skipped"
      echo
      echo "${msg}"
      echo
      echo "Existing verified calendar data stayed intact."
      echo
      echo "- Status file: \`${STATUS_FILE}\`"
      echo "- Log file: \`${LOG_FILE}\`"
      echo "- Strict harvest: \`${STRICT_HARVEST_FAILURES}\`"
      echo
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
  exit 0
}


# Leave a useful diagnostic if the runner receives an interrupt before normal completion.
on_runner_interrupt() {
  write_status 143 "agent" "Harvest runner was interrupted before completion; existing verified calendar data stayed intact." "${ATTEMPT:-0}" || true
  if is_strict_harvest; then
    exit 143
  fi
  exit 0
}
trap on_runner_interrupt INT TERM

write_status 124 "agent" "Harvest runner started. If this status remains latest, the external agent timed out or the runner was interrupted before completion." 0

if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
  soft_exit_or_fail 78 "CLAUDE_CODE_OAUTH_TOKEN env var is not set." 0
fi
if ! [[ "${FESTIVAL_SHARD_COUNT}" =~ ^[1-9][0-9]*$ ]]; then
  soft_exit_or_fail 78 "FESTIVAL_SHARD_COUNT must be a positive integer." 0
fi
if ! [[ "${HARVEST_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  soft_exit_or_fail 78 "HARVEST_ATTEMPTS must be a positive integer." 0
fi

SHARD=$(( (10#$(date -u +%u) - 1) % FESTIVAL_SHARD_COUNT ))
PROMPT_BODY="Today is ${TODAY} (UTC). This run's SHARD number is ${SHARD} (0-$((FESTIVAL_SHARD_COUNT-1))). FESTIVAL_SHARD_COUNT is ${FESTIVAL_SHARD_COUNT}. $(cat "${PROMPT_FILE}")"
echo "=== polymythcalendar festivals harvest ${RUN_ID}; shard ${SHARD}/${FESTIVAL_SHARD_COUNT}; model ${CLAUDE_MODEL}; max ${HARVEST_TIMEOUT_SECONDS}s; budget ${MAX_BUDGET_USD}; turns ${MAX_TURNS}; attempts ${HARVEST_ATTEMPTS} ==="

CLAUDE_STATUS=1
for ATTEMPT in $(seq 1 "${HARVEST_ATTEMPTS}"); do
  rm -f "${OUTPUT_FILE}"
  echo "=== festivals harvest attempt ${ATTEMPT}/${HARVEST_ATTEMPTS} ===" | tee -a "${LOG_FILE}"
  set +e
  timeout --signal=INT --kill-after=30s "${HARVEST_TIMEOUT_SECONDS}" \
    claude -p "${PROMPT_BODY}" \
      --model "${CLAUDE_MODEL}" \
      --tools "WebFetch,Read,Write,Bash" \
      --allowedTools "WebFetch,Read,Write,Bash" \
      --permission-mode bypassPermissions \
      --max-turns "${MAX_TURNS}" \
      --max-budget-usd "${MAX_BUDGET_USD}" 2>&1 | tee -a "${LOG_FILE}"
  CLAUDE_STATUS="${PIPESTATUS[0]}"
  set -e
  if [[ "${CLAUDE_STATUS}" -eq 0 ]]; then
    break
  fi
  echo "::warning::festivals harvest attempt ${ATTEMPT} exited ${CLAUDE_STATUS}" | tee -a "${LOG_FILE}"
  sleep 10
done

if [[ "${CLAUDE_STATUS}" -ne 0 ]]; then
  soft_exit_or_fail "${CLAUDE_STATUS}" "claude -p exited ${CLAUDE_STATUS} after ${HARVEST_ATTEMPTS} attempt(s); automated festivals harvest skipped this run." "${HARVEST_ATTEMPTS}"
fi
if [[ ! -f "${OUTPUT_FILE}" ]]; then
  soft_exit_or_fail 65 "Expected output file ${OUTPUT_FILE} was not produced." "${HARVEST_ATTEMPTS}"
fi

set +e
python3 - "${OUTPUT_FILE}" <<'PY'
import json, sys
p = sys.argv[1]
try:
    data = json.load(open(p, encoding='utf-8'))
except Exception as e:
    raise SystemExit(f"ERROR: malformed harvest JSON: {e}")
if not isinstance(data, dict) or not isinstance(data.get('events'), list):
    raise SystemExit('ERROR: harvest JSON must be an object with an events array')
for i, e in enumerate(data['events']):
    if not isinstance(e, dict) or not all(e.get(k) for k in ('title', 'date', 'source_url')):
        raise SystemExit(f'ERROR: harvest record {i} lacks title, date, or source_url')
print(f"=== valid full harvest: {len(data['events'])} records ===")
PY
VALIDATE_STATUS="$?"
set -e
if [[ "${VALIDATE_STATUS}" -ne 0 ]]; then
  soft_exit_or_fail 66 "Harvest JSON failed validation; data was left unchanged." "${HARVEST_ATTEMPTS}"
fi

write_status 0 "agent" "Claude harvest produced a valid output file; merging." "${HARVEST_ATTEMPTS}"
python3 scripts/merge_festivals.py
write_status 0 "published" "Festival harvest merged, rebuilt, and verified." "${HARVEST_ATTEMPTS}"
