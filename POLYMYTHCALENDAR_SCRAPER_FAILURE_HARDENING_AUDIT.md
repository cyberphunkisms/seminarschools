# Polymythcalendar scrape failure hardening audit — 2026-06-29

## Trigger

GitHub Actions screenshots showed both `scrape-festivals.yml` and `scrape-seminars.yml` failing after roughly 16–18 minutes with only `Process completed with exit code 1` visible in the annotation panel.

## What the screenshot indicates

The red failure came from the harvest step returning a non-zero process exit. The Node.js 20 message shown in the screenshot is a GitHub Actions runtime deprecation warning, so it deserved cleanup, but it was not the immediate scrape failure.

## Root technical risks found

1. A Claude/browser/timeout/budget failure could make routine scheduled maintenance red even when the safe behavior is to keep the last verified calendar.
2. Failed runs did not consistently leave a latest machine-readable status file for GitHub summaries.
3. The runner could fail after producing invalid or incomplete JSON instead of preserving the old data and surfacing the precise failure kind.
4. The seminars prompt expected the expanded shard count, while the old runner behavior could still crawl too much of the roster in one run.
5. Festival shard count needed to be explicit and visible in both the runner and prompt.
6. The Actions were still producing the Node runtime warning in the screenshot.
7. Successful seminar harvest publication needed to preserve festival, CFP, contest, and manual records in the consolidated calendar.
8. Root audit/operator files needed forced public 404 rules after each new technical audit.

## Fixes applied

- Added bounded runners for both streams with explicit timeout, budget, max-turns, two attempts, full log capture, and GitHub summary diagnostics.
- Added `seminars-latest.status.json` and `festivals-latest.status.json` artifacts.
- Added status fields: `status`, `stage`, `failure_kind`, `message`, `attempt`, `attempts`, `log_file`, `max_budget_usd`, `timeout_seconds`, `shard_count`, and `model`.
- Converted Claude runtime failures, missing output, and invalid JSON into warning-level scheduled outcomes that preserve the existing verified calendar.
- Kept missing token/configuration failures as hard failures.
- Kept merge, rebuild, publication, and `npm run verify:all` failures as hard failures.
- Added manual `workflow_dispatch` input `strict_harvest` for intentionally failing a manual run when the external agent fails.
- Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` while upgrading to Node 24-compatible action majors.
- Updated actions to `actions/checkout@v7`, `actions/setup-node@v6`, `actions/setup-python@v6`, and `actions/upload-artifact@v7`.
- Updated seminars to use `SHARD_COUNT=8` from the workflow.
- Updated festivals to use `FESTIVAL_SHARD_COUNT=7` from the workflow and prompt.
- Added/updated `scripts/verify-harvest-pipeline.js` so future edits preserve the hardened behavior.
- Added public 404 rules for root audit/setup/verification artifacts.

## Soft-failure behavior tested locally

- Simulated `claude` process exit `1`: runner exited `0`, wrote `failure_kind: agent-nonzero`, and preserved the existing calendar.
- Simulated invalid harvest JSON: runner exited `0`, wrote `failure_kind: invalid-agent-output`, and preserved the existing calendar.
- The full static verification gate passed after the hardening work.

## Operational behavior now

- Scheduled scrape exhaustion becomes a warning with artifacts instead of a red opaque failure.
- Manual runs can still be made strict by selecting `strict_harvest`.
- Red scrape jobs now point to configuration, publication, merge, or verification failures.
- The latest verified Polymythcalendar remains live when the external harvester has a bad day.

## Verification result

```text
npm run verify:all PASS
PUBLIC ARTIFACT BLOCK CHECK PASSED — 21 root audit/setup artifacts are forced to 404.
SEARCH SURFACE CHECK PASSED — 719 catalog resources, 265 current event cards, 15 methodology sections, 980 sitemap URLs.
CALENDAR DATA PARITY OK — 470 mirrored entries.
WRITING SHORTCUT CHECK PASSED — 39 current youth writing competitions; counts {"writingclub":39,"writingkids":13,"writingjuniors":20,"writingteens":36,"writinggrads":36}.
HARVEST PIPELINE OK — bounded, observable, soft-failing regional harvest workflow.
SITE INTEGRITY GUARD PASS.
SEO DEPLOYMENT GUARD PASS.
BOOKWORMCARD GATE PASS.
```
