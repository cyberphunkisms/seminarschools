# Polymythcalendar scrape workflow technical audit — 2026-06-29

## Observed symptom

The screenshots show both scheduled `scrape-festivals.yml` and manual `scrape-seminars.yml` reaching the harvest step and ending with `Process completed with exit code 1` after roughly 16–18 minutes.

The screenshots do not include the Claude transcript, so the exact upstream reason is still inside the failed run artifact or log. The workflow now preserves a clearer artifact and summary for the next run.

## Fixes applied

- `actions/checkout@v7`, `actions/setup-node@v6`, `actions/setup-python@v6`, and `actions/upload-artifact@v7` are in place.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` is set in both scraper jobs.
- Manual runs now have a `strict_harvest` input. Scheduled runs use safe skip behavior; strict manual runs fail red on external harvest failure.
- External Claude CLI failures, timeouts, and invalid output leave current public data unchanged and produce warnings plus uploaded diagnostics.
- Missing `CLAUDE_CODE_OAUTH_TOKEN` remains a hard failure.
- Merge, schema, rebuild, and `npm run verify:all` failures remain hard failures.
- The diagnostics summary now reads `seminars-latest.status.json` or `festivals-latest.status.json`; the runners now write those files.
- Seminars use `SHARD_COUNT=8`; festivals use `FESTIVAL_SHARD_COUNT=7`.
- Both workflows retry the external Claude call twice.

## Expected result

Scheduled scraper runs should stop showing red solely because the external harvest timed out, ran out of budget, hit a network/model issue, or returned invalid JSON. The run will show a warning and preserve the last verified Polymythcalendar data. A strict manual rerun can still force red behavior for debugging.

## Remaining live check

The next GitHub Actions run will confirm whether the external harvest itself succeeds or cleanly skips with diagnostics. The screenshot alone shows exit code 1, not the transcript-level cause.
