# Polymythcalendar scrape timeout repair audit

## Problem

The latest seminars run exceeded the workflow job cap at 45 minutes before the harvest runner produced a status file. The job summary therefore showed no harvest status and GitHub canceled the run.

## Root cause

The workflow allowed a worst-case external-agent window larger than the job budget: `HARVEST_TIMEOUT_SECONDS=2100` and `HARVEST_ATTEMPTS=2` can consume about 70 minutes before setup, verification, and commit steps. The job itself was capped at 45 minutes.

## Fix

- Add an immediate `Initialize harvest diagnostics` step so every run starts with a status file.
- Reduce scheduled harvest budget to one bounded agent attempt: 840 seconds, 40 turns.
- Add step-level timeouts for validators, npm install, Claude install, and harvest.
- Make Claude CLI installation `continue-on-error`; the runner reports a soft diagnostic instead of killing scheduled runs.
- Add interrupt trapping inside both harvest runners.
- Increase job timeout to 60 minutes while keeping the actual harvest step at 20 minutes.
- Strengthen `verify-harvest-pipeline.js` so the old 45-minute/2-attempt configuration cannot return.

## Files changed

- `.github/workflows/scrape-seminars.yml`
- `.github/workflows/scrape-festivals.yml`
- `scripts/seminars-prompt-runner.sh`
- `scripts/festivals-prompt-runner.sh`
- `scripts/initialize-harvest-status.js`
- `scripts/summarize-harvest-status.js`
- `scripts/summarize-harvest-diagnostics.sh`
- `scripts/verify-harvest-pipeline.js`

## Expected behavior

A normal external-agent timeout now yields a yellow warning plus a diagnostics artifact, while keeping existing calendar data intact. The workflow should stay green unless strict harvest is enabled or a true site-breaking stage fails.
