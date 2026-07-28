#!/usr/bin/env bash
#
# Bounded, observable polymythcalendar seminars harvest.
# Agent/network/budget/timeout failures leave public data unchanged and emit
# diagnostics; configuration and post-merge integrity failures still fail.
set -euo pipefail

PROMPT_FILE="scripts/seminars-prompt.md"
OUTPUT_FILE="/tmp/seminars-output.json"
STREAM="seminars"
TODAY="$(date -u +'%Y-%m-%d')"
RUN_ID="$(date -u +'%Y%m%dT%H%M%SZ')"
LOG_DIR="${HARVEST_LOG_DIR:-data/harvest-runs}"
LOG_FILE="${LOG_DIR}/${STREAM}-${RUN_ID}.log"
STATUS_FILE="${LOG_DIR}/${STREAM}-${RUN_ID}.status.json"
LATEST_STATUS_FILE="${LOG_DIR}/${STREAM}-latest.status.json"
MAX_TURNS="${MAX_TURNS:-90}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-5.00}"
HARVEST_TIMEOUT_SECONDS="${HARVEST_TIMEOUT_SECONDS:-2100}"
HARVEST_ATTEMPTS="${HARVEST_ATTEMPTS:-2}"
SHARD_COUNT="${SHARD_COUNT:-8}"
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
  local code="$1" stage="${2:-agent}" message="${3:-}" attempt="${4:-0}" agent_code="${5:-$1}"
  local kind status
  kind="$(failure_kind_for_code "${code}")"
  if [[ "${stage}" == "merge" ]]; then
    kind="merge-failure"
  elif [[ "${stage}" == "verify" ]]; then
    kind="verification-failure"
  fi
  if [[ "${code}" == "0" ]]; then
    status="success"
  elif [[ "${kind}" == "configuration" || "${stage}" == "merge" || "${stage}" == "verify" ]]; then
    status="failed"
  else
    status="skipped"
  fi
  python3 - "$STATUS_FILE" "$LATEST_STATUS_FILE" "$code" "$status" "$stage" "$kind" "$message" "$attempt" "$HARVEST_ATTEMPTS" "$TODAY" "$RUN_ID" "$LOG_FILE" "$MAX_TURNS" "$MAX_BUDGET_USD" "$HARVEST_TIMEOUT_SECONDS" "$SHARD_COUNT" "$STRICT_HARVEST_FAILURES" "$HARVEST_STRICT" "$CLAUDE_MODEL" "$agent_code" "$(failure_kind_for_code "${agent_code}")" <<'PY'
import json, shutil, sys
(
    out, latest, code, status, stage, kind, message, attempt, attempts, today,
    run_id, log, turns, budget, timeout, shard_count, strict_flag, harvest_strict,
    model, agent_code, agent_failure_kind,
) = sys.argv[1:]
payload = {
    "stream": "seminars",
    "run_id": run_id,
    "date_utc": today,
    "status": status,
    "exit_code": int(code),
    "stage": stage,
    "failure_kind": kind,
    "publication_status": (
        "published" if stage in {"published", "published-deterministic"} and int(code) == 0
        else "blocked" if status == "failed"
        else "pending" if int(code) == 0
        else "unchanged"
    ),
    "agent_exit_code": int(agent_code),
    "agent_failure_kind": agent_failure_kind,
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

publish_deterministic_fallback() {
  local agent_code="$1" agent_message="$2" attempt="${3:-0}"
  if [[ ! -f "/tmp/polymythcal-protests.json" && ! -f "/tmp/polymythcal-structured.json" ]]; then
    return 1
  fi
  python3 - "${OUTPUT_FILE}" <<'PY'
import json, sys
from datetime import datetime, timezone
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "events": [],
        "source_yields": [],
        "agent_stage": "skipped",
    }, handle, indent=2)
    handle.write("\n")
PY
  if ! python3 scripts/merge_and_finalize.py; then
    write_status 67 "merge" "Deterministic outputs existed, but fallback publication failed after agent error ${agent_code}: ${agent_message}" "${attempt}"
    echo "::error title=Polymythcalendar deterministic publication::Fallback merge failed." >&2
    exit 67
  fi
  write_status 0 "published-deterministic" "Available deterministic outputs published; agent stage skipped after ${agent_code}: ${agent_message}" "${attempt}" "${agent_code}"
  echo "::warning title=Polymythcalendar agent stage skipped::Deterministic outputs were still merged and verified. ${agent_message}" >&2
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Deterministic calendar data published"
      echo
      echo "The agent stage skipped: ${agent_message}"
      echo
      echo "The available deterministic stages were merged, rebuilt, and verified independently."
      echo
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
  return 0
}

soft_exit_or_fail() {
  local code="$1" msg="$2" attempt="${3:-0}"
  if publish_deterministic_fallback "${code}" "${msg}" "${attempt}"; then
    exit 0
  fi
  write_status "${code}" "agent" "${msg}" "${attempt}"
  if [[ "$(failure_kind_for_code "${code}")" == "configuration" ]] || is_strict_harvest; then
    echo "::error title=Polymythcalendar seminars harvest::${msg}" >&2
    exit "${code}"
  fi
  echo "::warning title=Polymythcalendar seminars harvest::${msg} Existing verified calendar data stayed intact. See ${LOG_FILE} and ${STATUS_FILE}." >&2
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Seminars harvest skipped"
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

if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
  soft_exit_or_fail 78 "CLAUDE_CODE_OAUTH_TOKEN env var is not set. Generate it with claude setup-token." 0
fi
if ! [[ "${SHARD_COUNT}" =~ ^[1-9][0-9]*$ ]]; then
  soft_exit_or_fail 78 "SHARD_COUNT must be a positive integer." 0
fi
if ! [[ "${HARVEST_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  soft_exit_or_fail 78 "HARVEST_ATTEMPTS must be a positive integer." 0
fi

SHARD="$(python3 scripts/polymythcal_sharding.py shard --date "${TODAY}" --count "${SHARD_COUNT}")"
DETERMINISTIC_SKIP_IDS="$(python3 scripts/polymythcal_sharding.py skip-ids \
  --roster scripts/sources.json \
  --payload /tmp/polymythcal-protests.json \
  --payload /tmp/polymythcal-structured.json)"
PROMPT_BODY="Today is ${TODAY} (UTC). This run's SHARD number is ${SHARD}. SHARD_COUNT is ${SHARD_COUNT}. Skip these configured sources whose deterministic stage fully succeeded: ${DETERMINISTIC_SKIP_IDS:-none}. Do not skip a source whose deterministic status was partial-failure, blocked, fetch-error, parse-empty-regression, confirmed-empty, or not-modified; this explicitly includes JavaScript protest sources without a successful server-readable route. Crawl every other source whose zero-based full-roster position satisfies position % ${SHARD_COUNT} == ${SHARD}. $(cat "${PROMPT_FILE}")"
echo "=== polymythcalendar seminars harvest ${RUN_ID}; shard ${SHARD}/${SHARD_COUNT}; model ${CLAUDE_MODEL}; max ${HARVEST_TIMEOUT_SECONDS}s; budget ${MAX_BUDGET_USD}; turns ${MAX_TURNS}; attempts ${HARVEST_ATTEMPTS} ==="

CLAUDE_STATUS=1
for ATTEMPT in $(seq 1 "${HARVEST_ATTEMPTS}"); do
  rm -f "${OUTPUT_FILE}"
  echo "=== seminars harvest attempt ${ATTEMPT}/${HARVEST_ATTEMPTS} ===" | tee -a "${LOG_FILE}"
  set +e
  timeout --signal=INT --kill-after=30s "${HARVEST_TIMEOUT_SECONDS}" \
    claude -p "${PROMPT_BODY}" \
      --model "${CLAUDE_MODEL}" \
      --tools "WebFetch,Read,Write" \
      --allowedTools "WebFetch,Read,Write" \
      --permission-mode acceptEdits \
      --max-turns "${MAX_TURNS}" \
      --max-budget-usd "${MAX_BUDGET_USD}" 2>&1 | tee -a "${LOG_FILE}"
  CLAUDE_STATUS="${PIPESTATUS[0]}"
  set -e
  if [[ "${CLAUDE_STATUS}" -eq 0 ]]; then
    break
  fi
  echo "::warning::seminars harvest attempt ${ATTEMPT} exited ${CLAUDE_STATUS}" | tee -a "${LOG_FILE}"
  sleep 10
done

if [[ "${CLAUDE_STATUS}" -ne 0 ]]; then
  soft_exit_or_fail "${CLAUDE_STATUS}" "claude -p exited ${CLAUDE_STATUS} after ${HARVEST_ATTEMPTS} attempt(s); automated seminars harvest skipped this run." "${HARVEST_ATTEMPTS}"
fi
if [[ ! -f "${OUTPUT_FILE}" ]]; then
  soft_exit_or_fail 65 "Expected output file ${OUTPUT_FILE} was not produced." "${HARVEST_ATTEMPTS}"
fi

set +e
python3 scripts/validate_harvest_source_ledger.py seminars \
  --harvest "${OUTPUT_FILE}" \
  --roster scripts/sources.json \
  --shard "${SHARD}" \
  --shard-count "${SHARD_COUNT}" \
  --deterministic-success-ids "${DETERMINISTIC_SKIP_IDS}"
VALIDATE_STATUS="$?"
set -e
if [[ "${VALIDATE_STATUS}" -ne 0 ]]; then
  soft_exit_or_fail 66 "Harvest JSON or source accounting failed validation; data was left unchanged." "${HARVEST_ATTEMPTS}"
fi

write_status 0 "agent" "Claude harvest produced a valid output file; merging." "${HARVEST_ATTEMPTS}"
if ! python3 scripts/merge_and_finalize.py; then
  write_status 67 "merge" "Seminars harvest merge, rebuild, or verification failed." "${HARVEST_ATTEMPTS}" 0
  exit 67
fi
write_status 0 "published" "Seminars harvest merged, rebuilt, and verified." "${HARVEST_ATTEMPTS}"
