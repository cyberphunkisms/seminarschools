#!/usr/bin/env bash
#
# Festivals harvest runner. Two-pass scrape-within-scrape via claude -p.
# Higher token budget than seminars because Pass 1 crawls discovery
# aggregators and Pass 2 verifies against primary sites.
#
# Auth: CLAUDE_CODE_OAUTH_TOKEN env var (same as seminars).

set -euo pipefail

PROMPT_FILE="scripts/festivals-prompt.md"
OUTPUT_FILE="/tmp/festivals-output.json"
TODAY="$(date -u +'%Y-%m-%d')"

echo "=== Festivals harvest run ${TODAY} ==="
echo "Calling claude -p with prompt from ${PROMPT_FILE}"
echo

if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
    echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN env var not set." >&2
    exit 1
fi

PROMPT_BODY="Today is ${TODAY} (UTC). $(cat "${PROMPT_FILE}")"

# --max-budget-usd 10.00 (double seminars; two-pass + larger source roster)
# --max-turns 100 (more sources, more iterations expected)
# Same --tools restriction as seminars: no WebSearch (separately billed).

claude -p "${PROMPT_BODY}" \
    --model claude-sonnet-4-6 \
    --tools "WebFetch,Read,Write,Bash" \
    --allowedTools "WebFetch,Read,Write,Bash" \
    --permission-mode bypassPermissions \
    --max-turns 100 \
    --max-budget-usd 10.00 \
    || { echo "ERROR: claude -p invocation failed" >&2; exit 1; }

if [[ ! -f "${OUTPUT_FILE}" ]]; then
    echo "ERROR: expected output file ${OUTPUT_FILE} not produced by Claude" >&2
    exit 1
fi

EVENT_COUNT="$(python3 -c "import json; d=json.load(open('${OUTPUT_FILE}')); print(len(d.get('events',[])))")"
echo "=== Claude festivals harvest produced ${EVENT_COUNT} records ==="

# Hand off to merge + validate
python3 scripts/merge_festivals.py
