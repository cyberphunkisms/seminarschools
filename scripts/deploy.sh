#!/usr/bin/env bash
# Canonical deploy. Replaces the old one-liner whose `git pull -X theirs`
# resolved every conflict toward the REMOTE — meaning any previously-pushed
# breakage silently beat every local fix, forever. Here the local tree wins,
# the scheduled harvest's canonical data is preserved from origin, and a verifier refuses
# to push a broken calendar. Run from repo root AFTER extracting the bundle.
set -euo pipefail

# Branch-agnostic: works whether the repo uses main, master, or anything else.
BR=$(git branch --show-current)
echo "repo:   $(git remote get-url origin 2>/dev/null || echo NO-REMOTE)"
echo "branch: $BR"
[ -n "$BR" ] || { echo "FATAL: not on a branch (detached HEAD?)"; exit 1; }

ROBOT_PATHS=("data/polymyth-seminar-events.json")   # harvest-owned: origin wins

# sync the public events copy (netlify force-404s /data/*)
cp data/polymyth-seminar-events.json polymythseminars/events.json

npm run verify:all
git add -A
git commit -m "deploy: canonical tree $(date +%Y-%m-%d_%H%M)" || echo "(nothing new to commit)"
git fetch origin
git merge -X ours --no-edit "origin/$BR"   # LOCAL tree wins conflicts
for p in "${ROBOT_PATHS[@]}"; do
  git checkout "origin/$BR" -- "$p" 2>/dev/null || true
done
# Rebuild the public event copy from whichever canonical corpus won the merge.
cp data/polymyth-seminar-events.json polymythseminars/events.json
git add -A
git commit -m "deploy: keep robot-owned data from origin" || true

npm run verify:all
git push origin "$BR"
echo
RELEASE_ID=$(tr -d '\r\n' < RELEASE_ID.txt)
echo "DEPLOYED. Check /site-release.json and confirm release_id is: $RELEASE_ID"
