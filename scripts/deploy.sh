#!/usr/bin/env bash
# Canonical deploy. Replaces the old one-liner whose `git pull -X theirs`
# resolved every conflict toward the REMOTE — meaning any previously-pushed
# breakage silently beat every local fix, forever. Here the local tree wins,
# the daily robot's data is preserved from origin, and a verifier refuses
# to push a broken calendar. Run from repo root AFTER extracting the bundle.
set -euo pipefail

# Branch-agnostic: works whether the repo uses main, master, or anything else.
BR=$(git branch --show-current)
echo "repo:   $(git remote get-url origin 2>/dev/null || echo NO-REMOTE)"
echo "branch: $BR"
[ -n "$BR" ] || { echo "FATAL: not on a branch (detached HEAD?)"; exit 1; }

ROBOT_PATHS=("seminars/events.json")   # daily-scraper-owned: origin wins

# sync the public events copy (netlify force-404s /data/*)
cp data/polymyth-seminar-events.json polymythseminars/events.json

node scripts/verify-critical.js
node scripts/verify-payments.js

git add -A
git commit -m "deploy: canonical tree $(date +%Y-%m-%d_%H%M)" || echo "(nothing new to commit)"
git fetch origin
git merge -X ours --no-edit "origin/$BR"   # LOCAL tree wins conflicts
for p in "${ROBOT_PATHS[@]}"; do
  git checkout "origin/$BR" -- "$p" 2>/dev/null || true
done
git add -A
git commit -m "deploy: keep robot-owned data from origin" || true

node scripts/verify-critical.js           # verify AGAIN post-merge
node scripts/verify-payments.js           # payment wiring guard, post-merge

git push origin "$BR"
echo
echo "DEPLOYED. Hard-refresh /polymythseminars/ and confirm the footer reads: build 20260606"
