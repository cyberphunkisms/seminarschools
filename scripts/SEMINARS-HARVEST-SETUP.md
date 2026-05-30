# Seminars harvest — setup and operations

Weekly Toronto-GTA event scraper for seminarschools.com. Runs as a GitHub
Action invoking `claude -p` (Claude Code headless mode) against a curated
venue roster. Result is committed to the repo. Netlify auto-deploys.

## Architecture

```
.github/workflows/scrape-seminars.yml   ← cron Mon 06:00 UTC
        ↓
scripts/seminars-prompt-runner.sh        ← shell wrapper
        ↓
claude -p (Sonnet 4.6, --tools WebFetch+Read+Write+Bash, --max-budget-usd 5)
        ↓
/tmp/seminars-output.json                ← raw harvest
        ↓
scripts/merge_and_finalize.py            ← merge + dedup + validate
        ↓
seminars/events.json + seminars/feed.xml + data/scrape-log.json
        ↓
git commit + push → Netlify deploy
```

## Files

| File | Purpose |
| --- | --- |
| `.github/workflows/scrape-seminars.yml` | GitHub Actions cron + workflow steps |
| `scripts/seminars-prompt.md` | The prompt Claude executes |
| `scripts/seminars-prompt-runner.sh` | Shell wrapper, captures output |
| `scripts/merge_and_finalize.py` | Merges harvest with manual-events, validates, writes outputs |
| `scripts/validate_seminars.py` | Standalone schema gate before commit |
| `scripts/sources.json` | Venue roster (read by prompt) |
| `data/manual-events.json` | Hand-curated overrides (precedence over scrape) |
| `data/seminars-schema.json` | JSON Schema for record shape |
| `seminars/events.json` | The deployed feed |
| `seminars/feed.xml` | RSS feed regenerated each run |
| `data/scrape-log.json` | Per-run audit log |
| `data/history/seminars-YYYY-MM-DD.json` | Daily snapshots |

## One-time setup

### Step 1. Generate an OAuth token for headless authentication

On your local machine (with Claude Code installed and logged in to the Max
20x subscription):

```bash
claude setup-token
```

This prints a long-lived OAuth token. **Copy it once.** It will not be
shown again. The token authenticates against the Max 20x subscription, so
usage after June 15 2026 draws from the $200/mo Agent SDK credit pool. An
API key from console.anthropic.com bills pay-as-you-go and does NOT use
the subscription credit pool.

### Step 2. Add the token as a repository secret

1. Go to the repo's `Settings → Secrets and variables → Actions`.
2. Click `New repository secret`.
3. Name: `CLAUDE_CODE_OAUTH_TOKEN`.
4. Value: paste the token from step 1.
5. Save.

### Step 3. Test manually before relying on the schedule

1. Go to `Actions → Scrape seminars → Run workflow → Run`.
2. Watch the run. Verify the `Run Claude headless scrape` step produces a
   non-empty event count.
3. Verify the `Validate output against schema` step exits 0.
4. Verify the commit landed and Netlify rebuilt.

If step 3 fails, check:
- Token expired? Re-run `claude setup-token` and rotate the secret.
- Budget cap hit? `--max-budget-usd 5.00` aborts the run cleanly.
- Schema violation? `validate_seminars.py` prints the exact record indices
  that failed.

## Running locally for debugging

```bash
# Install Claude Code via the native binary
curl -fsSL https://claude.ai/install.sh | bash

# Authenticate (one time)
claude auth login

# Generate token for headless (optional locally; auth login already works)
claude setup-token

# Run the scraper
export CLAUDE_CODE_OAUTH_TOKEN=...   # from setup-token output
pip install jsonschema
bash scripts/seminars-prompt-runner.sh
```

## Cost projection

Per run: $1-3 of Sonnet 4.6 tokens. Hard cap: $5 via `--max-budget-usd`.
Weekly cadence: $4-12/month under normal operation, $20/month worst-case
if every run hits the cap.

Max 20x credit pool: $200/month, resets monthly, does not roll over.
Headroom: enormous.

If costs drift, audit `data/scrape-log.json` for per-source counts. A
venue returning zero week after week may have moved its listing page or
implemented stronger anti-bot. Update its `events_url` in `sources.json`.

## Adjusting cadence

`.github/workflows/scrape-seminars.yml` line 30: `cron: '0 6 * * 1'`.
Monday 06:00 UTC = 02:00 Toronto EDT.

Daily: `0 6 * * *`. Twice-weekly: `0 6 * * 1,4`. Biweekly: requires
external scheduler since cron does not natively support `every other week`.

## Adding venues

Append entries to `scripts/sources.json` under `sources`. Required:
- `id`: stable short identifier (`uoft-philosophy`)
- `name`: human-readable
- `tier_priority`: 1 (must crawl) to 4 (optional)
- `default_type`: one of the schema enum types
- `base_url`: venue homepage
- `events_url`: events listing URL

Optional:
- `notes`: free-form notes for the agent
- `render_mode`: strategy hint (`static`, `javascript`, `drupal`, `google-sites`, etc.)

Claude reads this file fresh each run. No code change needed to add a venue.

## Manual events

`data/manual-events.json` is the override layer. Hand-curated entries
take precedence over scraped duplicates on `(normalized_title, date_to_hour)`.
Use for:
- Sources Claude cannot reach (paywalled, login-gated)
- Events you attended already, kept for archival (set `review_status: manual`)
- Forced corrections when scrape gets a venue or speaker wrong

## Audit trail

Every run produces:
- A git commit with timestamp
- `data/scrape-log.json` with per-source counts
- `data/history/seminars-YYYY-MM-DD.json` snapshot

Every record in `seminars/events.json` carries:
- `source_url`: canonical link
- `raw_excerpt`: verbatim fragment from source
- `scraped_at`: fetch timestamp
- `confidence`: 0-100 verification score
- `four_condition_test`: pass/fail per condition

Audits trace from displayed event → record → source URL → verbatim quote.

## Known failure modes

- **403 from venue.** Claude retries with `base_url`. If both fail, that
  venue contributes zero this run. Log entry shows the empty.
- **Hallucinated event.** Schema requires `raw_excerpt`. If the agent
  produces an event without quoting the source, validation drops it.
  Worst case: hallucinated event with hallucinated quote. Mitigation:
  manual spot-check of new entries weekly.
- **Stale rollover.** PhilEvents 2025-into-2026 dates already documented
  as hazard in the prompt. Agent instructed to cross-check date plausibility.
- **Token budget overrun.** `--max-budget-usd 5.00` aborts cleanly before
  blowing past the projection. Workflow `timeout-minutes: 30` is the
  outer wall.
- **Token expiry.** `claude setup-token` produces a long-lived token but
  not infinite. If runs start failing with auth errors, regenerate.

## Audit-known limitations

These are known gaps not yet addressed:

- **No `--json-schema` enforcement.** The agent writes to a file and the
  Python validator reads it back. A more robust pattern is `--json-schema`
  with a document-level schema (currently only the per-record schema
  exists). Requires writing a wrapper schema spec.
- **Smoke test coverage.** The build was tested only for the happy path.
  Failure modes (Claude exits non-zero, output file missing, deliberately
  bad record) were verified at code-read time, not at runtime.

## When to revisit

- New Anthropic billing changes (June 15 2026 cutover already factored in)
- A venue starts publishing iCal/RSS — note in `sources.json` `render_mode`
  so Claude prefers the structured endpoint
- Agent-side improvements to Claude Code's tool set (Playwright via MCP, etc.)
- Yields below 10 events/run two weeks in a row → audit which sources went dark
