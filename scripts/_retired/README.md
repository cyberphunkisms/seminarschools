# Retired

These files belong to the May 2025 - May 2026 Python-scraper architecture.
Retired on 2026-05-26 in favor of the `claude -p` headless harvest now living
at `/scripts/seminars-prompt.md` plus `/scripts/seminars-prompt-runner.sh`.

Why retired:
- 23 venues configured, only 1 working fetcher in production.
- Two real fetchers (jhi, revue) blocked by venue-side WAFs.
- 19 remaining sources were `fetch_todo` stubs returning empty.
- April 15 2026 Claude-research baseline = 70+ events. Last Python run = 8.

Kept for archaeology, not for execution. Do not call these scripts. They
will not produce the right output shape.
