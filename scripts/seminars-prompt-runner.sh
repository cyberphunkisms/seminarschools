#!/usr/bin/env bash
#
# Invokes claude -p with the seminars harvest prompt. Captures the JSON
# output to /tmp/seminars-output.json, then runs the merge with
# /data/manual-events.json into the final /seminars/events.json.
#
# Auth: CLAUDE_CODE_OAUTH_TOKEN env var, generated via `claude setup-token`.
# Routes through Max 20x subscription; post June 15 2026 draws from the
# $200/mo Agent SDK credit pool.

set -euo pipefail

PROMPT_FILE="scripts/seminars-prompt.md"
OUTPUT_FILE="/tmp/seminars-output.json"
TODAY="$(date -u +'%Y-%m-%d')"

echo "=== Seminars harvest run ${TODAY} ==="
echo "Calling claude -p with prompt from ${PROMPT_FILE}"
echo

# Sanity check: token must be set
if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
    echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN env var not set. Cannot authenticate." >&2
    echo "Generate one locally with: claude setup-token" >&2
    exit 1
fi

# Prepend the date context so Claude knows what "today" means inside the
# headless run.
PROMPT_BODY="Today is ${TODAY} (UTC). $(cat "${PROMPT_FILE}")"

# Tool restrictions (audit fix #1):
# --tools STRICTLY restricts which tools are available. --allowedTools only
# skips confirmation prompts but does not bound capability. We need BOTH:
#   --tools to cap the set
#   --allowedTools to skip prompts on that set in headless mode
# Tool set: WebFetch for venue pages, Read for sources.json, Write for the
# output JSON, Bash for sha1 computation. WebSearch is REMOVED because it
# bills as a separately-metered hosted tool.
#
# Budget cap (audit fix #2): --max-budget-usd 5.00 hard-stops the run if
# a runaway loop or expensive web-fetch chain pushes past the projection.
#
# Model pin (audit fix #4): --model claude-sonnet-4-6 prevents silent drift
# to Opus or future default models that would change cost projection.
#
# --permission-mode bypassPermissions ensures no interactive prompts hang
# the headless run. Combined with the restrictive --tools set, this is safe.
#
# --max-turns 60 caps agentic iteration. With 23 venues + retries, 60 turns
# is generous. Hitting this is a signal the agent got stuck.

claude -p "${PROMPT_BODY}" \
    --model claude-sonnet-4-6 \
    --tools "WebFetch,Read,Write,Bash" \
    --allowedTools "WebFetch,Read,Write,Bash" \
    --permission-mode bypassPermissions \
    --max-turns 60 \
    --max-budget-usd 5.00 \
    || { echo "ERROR: claude -p invocation failed" >&2; exit 1; }

if [[ ! -f "${OUTPUT_FILE}" ]]; then
    echo "ERROR: expected output file ${OUTPUT_FILE} not produced by Claude" >&2
    echo "The agent may have exited without writing. Check token, prompt, and tool perms." >&2
    exit 1
fi

EVENT_COUNT="$(python3 -c "import json; d=json.load(open('${OUTPUT_FILE}')); print(len(d.get('events',[])))")"
echo "=== Claude harvest produced ${EVENT_COUNT} events ==="

# Hand off to merge + validate
python3 scripts/merge_and_finalize.py
