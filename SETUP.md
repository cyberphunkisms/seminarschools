# seminarschools-site setup

Path 2 architecture. The dedicated GitHub repo for the seminarschools.com site source. Wired to Netlify for auto-deploy. The cyberphunkisms/polymyth repo stays untouched as the pure contentinternet text-mirror.

## One-time setup (30-45 minutes)

### 1. Create the new GitHub repo

Web UI route. Go to https://github.com/new. Owner: cyberphunkisms. Repo name: `seminarschools-site` (or any name you prefer; substitute below as appropriate). Visibility: Public is fine (Private also works). Do NOT initialize with README, .gitignore, or license. Click "Create repository".

CLI route if you have `gh`:
```
gh repo create cyberphunkisms/seminarschools-site --public
```

### 2. Push this bundle to the new repo

Unzip this bundle into a clean directory on your machine, then:

```
cd seminarschools-site-bundle
git init
git branch -M main
git remote add origin https://github.com/cyberphunkisms/seminarschools-site.git
git add .
git status                              # confirm what is staged
git commit -m "Initial commit: seminarschools.com site source plus cron"
git push -u origin main
```

The `.gitignore` in the bundle excludes internal scratchpads, .DS_Store, .pyc, and the one-time Stripe provisioning scripts.

### 3. Wire Netlify to the new repo

Netlify dashboard → your seminarschools.com site (project legendary-arithmetic-e35ce4) → Site configuration → Build & deploy → Continuous deployment → "Link site to Git" (or similar wording in current Netlify UI).

Pick GitHub. Authorize the Netlify GitHub App for the cyberphunkisms account if not already. Select `cyberphunkisms/seminarschools-site` and branch `main`. Keep the repository's `netlify.toml` settings: build command `npm run build`, publish directory `public`. Do not override the publish directory with the repository root. Click "Deploy site".

Netlify will rebuild the allowlisted public site from the GitHub repo while keeping source, audit, and operator files outside the published directory.

### 4. Verify the first auto-deploy worked

Visit seminarschools.com. Spot-check the home page, `/polymythseminars/`, `/florilegium/`, and `/leizu/`. All should render correctly. If anything is broken, check the Netlify deploy log for the first failed build or verification command.

### 5. Enable Actions and trigger first cron run

GitHub repo → Settings → Actions → General → "Allow all actions and reusable workflows" (default for personal repos). Save.

GitHub repo → Actions tab → "Scrape seminars" workflow in the left sidebar → "Run workflow" button on the right → branch `main` → "Run workflow".

The workflow harvests and validates the calendar, then opens a publication pull request. The canonical event corpus is `data/polymyth-seminar-events.json`; the public copy is `polymythseminars/events.json`. Review the event and lifecycle diff before merging. Netlify deploys after the pull request is merged.

Visit `seminarschools.com/polymythseminars/` after the merged change deploys. The calendar should show the newly verified records.

## Ongoing operation

The seminar harvest runs Mondays and Thursdays at 08:18 UTC. The festival harvest runs Tuesdays and Fridays at 09:42 UTC. Each successful run opens or updates a reviewable pull request; it does not write directly to the live branch.

To edit the site outside the cron (add a page, fix a typo, update a price), the workflow changes.
- Before Path 2: drag-and-drop a zip to Netlify.
- After Path 2: edit files in your local clone of this repo, commit, push. Netlify auto-deploys on push.

To trigger an extra harvest, use Actions → "Scrape seminars" or "Scrape festivals" → "Run workflow", then review and merge the resulting publication pull request.

`npm run verify:all` is the complete repository gate. Browser-backed geometry
verification is now part of the release suite, so install Chromium once before
the first full local run:

```sh
npx playwright install chromium
npm run build
npm run verify:all:built
```

If Chromium is already installed somewhere else, set `CHROME_EXECUTABLE` to its
executable path. The older strict entry-page audit remains available after
installing `requirements-audit.txt` with `npm run
audit:polymythcal-entry-pages:strict`.

The full verifier also runs `verify:build-idempotence`: it repeats the
canonical build once and fails if any durable source, public mirror, data file,
or current report changes.

## Reverting to drag-and-drop

If Path 2 turns out to be the wrong call.
1. Netlify dashboard → Site configuration → Build & deploy → Continuous deployment → "Unlink repository".
2. Drag your most-recent zip to deploy. The site is back on drag-and-drop.
3. The GitHub repo persists; you can either delete it or keep it as a backup.

## The two repos and what each one is for

| Repo | Purpose | Updated by |
|------|---------|-----------|
| cyberphunkisms/polymyth | contentinternet text mirror per PM34. AI fetchers pull `methodologylist*.txt` from here. | Manual, when ml* changes. |
| cyberphunkisms/seminarschools-site | The site source code. Netlify auto-deploys from here. | Manual commits for site edits. Cron commits for seminar data. |

Keep them separate. Do not merge.
