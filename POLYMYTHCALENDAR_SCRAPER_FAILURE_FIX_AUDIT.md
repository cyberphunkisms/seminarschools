# Polymythcalendar scraper failure fix audit — 2026-06-29

## Screenshot diagnosis

Both GitHub Actions screenshots show the workflow reaching the `Harvest seminars` / `Harvest festivals` step, running for roughly 16–17 minutes, and finishing with `Process completed with exit code 1`. The visible Node.js 20 warning is separate from the red failure; the red failure is the harvest command returning nonzero.

## Issues found

1. External Claude CLI failures were treated as hard scheduled-run failures, even when the safe data policy is to keep the previous verified calendar live.
2. The seminars crawl was too wide for one agent run after the source roster grew, especially with contest, CFP, and screening sources all competing for the same run budget.
3. The diagnostics contract was inconsistent: `summarize-harvest-status.js` expected `*-latest.status.json`, but the runner only wrote timestamped status files.
4. The workflow actions were on old majors that generate Node.js 20 runtime warnings on the GitHub runner migration path.
5. The festival budget in the workflow was lower than the festival task implied.

## Changes made

- Upgraded workflow actions to `actions/checkout@v7`, `actions/setup-node@v6`, `actions/setup-python@v6`, and `actions/upload-artifact@v7`.
- Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to make Node 24 runtime compatibility explicit.
- Added a `strict_harvest` manual input. Scheduled runs preserve the old verified calendar on external harvest failure; strict manual runs can still turn red for debugging.
- Added `HARVEST_ATTEMPTS=2` retry behavior around the Claude CLI call.
- Added `seminars-latest.status.json` and `festivals-latest.status.json` alongside timestamped status files.
- Added structured status fields: `status`, `stage`, `failure_kind`, `message`, `attempt`, `attempts`, `budget`, `timeout_seconds`, `shard_count`, and `model`.
- Kept missing `CLAUDE_CODE_OAUTH_TOKEN` as a hard configuration failure.
- Kept merge, schema, rebuild, and verification failures hard.
- Set seminars to `SHARD_COUNT=8` and festivals to `FESTIVAL_SHARD_COUNT=7`.
- Aligned festival budget to `$10.00` and kept seminars at `$5.00`.

## Resulting behavior

A transient model, network, timeout, budget, or malformed-output scrape issue now produces a warning, uploads `data/harvest-runs/`, and leaves the public calendar unchanged. A real site-integrity issue after a valid harvest still fails the workflow.

## Files changed

- `.github/workflows/scrape-seminars.yml`
- `.github/workflows/scrape-festivals.yml`
- `scripts/seminars-prompt-runner.sh`
- `scripts/festivals-prompt-runner.sh`
- `scripts/summarize-harvest-status.js`
- `scripts/verify-harvest-pipeline.js`
- `scripts/festivals-prompt.md`
- `data/harvest-runs/.gitignore`
