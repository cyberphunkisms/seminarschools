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

Pick GitHub. Authorize Netlify GitHub App for the cyberphunkisms account if not already. Select `cyberphunkisms/seminarschools-site`. Branch: `main`. Build command: (leave blank, static site). Publish directory: (leave blank or `/`, the repo root is the publish root). Click "Deploy site".

Netlify will rebuild from the GitHub repo. The first build should look identical to your last drag-and-drop deploy because the bundle contains the same files.

### 4. Verify the first auto-deploy worked

Visit seminarschools.com. Spot-check the home page, /seminars/, /florilegium/, /leizu/. All should render correctly. If anything is broken, check the Netlify deploy log for missing files.

### 5. Enable Actions and trigger first cron run

GitHub repo → Settings → Actions → General → "Allow all actions and reusable workflows" (default for personal repos). Save.

GitHub repo → Actions tab → "Scrape seminars" workflow in the left sidebar → "Run workflow" button on the right → branch `main` → "Run workflow".

The workflow runs in 1-2 minutes. It produces a commit titled "Update seminars calendar (YYYY-MM-DD)" with `seminars/events.json`, `seminars/feed.xml`, and internal audit files in `/data/`. Netlify auto-deploys on this commit.

Visit seminarschools.com/seminars/ after the Netlify deploy completes (another 1-2 minutes). The page should now show real events from JHI plus any from Agora plus any from Revue.

## Ongoing operation

Daily at 11:00 UTC (07:00 Toronto), the cron fires. Scraper runs. Fresh `events.json` and `feed.xml` get committed. Netlify auto-deploys. The live calendar refreshes. You do nothing.

To edit the site outside the cron (add a page, fix a typo, update a price), the workflow changes.
- Before Path 2: drag-and-drop a zip to Netlify.
- After Path 2: edit files in your local clone of this repo, commit, push. Netlify auto-deploys on push.

If you ever want to manually trigger a scrape between scheduled runs (a venue announces a major event, you want it up immediately), Actions tab → "Scrape seminars" → "Run workflow".

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
