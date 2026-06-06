#!/usr/bin/env bash
# Canonical deploy. Replaces the old one-liner whose `git pull -X theirs`
# resolved every conflict toward the REMOTE — meaning any previously-pushed
# breakage silently beat every local fix, forever. Here the local tree wins,
# the daily robot's data is preserved from origin, and a verifier refuses
# to push a broken calendar. Run from repo root AFTER extracting the bundle.
set -euo pipefail

ROBOT_PATHS=("seminars/events.json")   # daily-scraper-owned: origin wins

node scripts/verify-critical.js

git add -A
git commit -m "deploy: canonical tree $(date +%Y-%m-%d_%H%M)" || echo "(nothing new to commit)"
git fetch origin
git merge -X ours --no-edit origin/main   # LOCAL tree wins conflicts
for p in "${ROBOT_PATHS[@]}"; do
  git checkout origin/main -- "$p" 2>/dev/null || true
done
git add -A
git commit -m "deploy: keep robot-owned data from origin" || true

node scripts/verify-critical.js           # verify AGAIN post-merge

git push origin main
echo
echo "DEPLOYED. Hard-refresh /polymythseminars/ and confirm the footer reads: build 20260606"
