# polymythcalendar scraper setup, plain-English version

## What is already done in this archive

- The calendar base has been updated with the deep-research backbone records.
- The calendar now has 459 total records and 230 upcoming records as of June 28, 2026.
- The public calendar data file, internal mirror, non-JavaScript fallback, static event pages, and sitemap were regenerated together.
- The scraper source list now includes the new durable backbone sources: Toronto Public Library Salon Series, University of Toronto Lecture Series, TMU Research Events, ROM events and talks, AGO events, McGill Science, Concordia FOFA, Concordia GradProSkills, and Rotman public events.
- The old combined scraper design has been replaced by two safer workflows: one for seminars and one for festivals.
- Failed scraper runs now preserve diagnostic logs instead of leaving only a vague GitHub failure email.

## What you still need to do

### 1. Put this archive into the GitHub repo

Open `github.com/cyberphunkisms/seminarschools` and replace the repository files with the files from this archive.

The important files are:

- `.github/workflows/scrape-seminars.yml`
- `.github/workflows/scrape-festivals.yml`
- `scripts/seminars-prompt-runner.sh`
- `scripts/festivals-prompt-runner.sh`
- `scripts/seminars-prompt.md`
- `scripts/festivals-prompt.md`
- `scripts/sources.json`
- `scripts/festivals-sources.json`
- `data/manual-events.json`
- `data/polymyth-seminar-events.json`
- `polymythseminars/events.json`
- `polymythseminars/index.html`
- `sitemap.xml`

### 2. Delete the old combined workflow

In GitHub, open `.github/workflows/`.

Delete the old file that created the email titled:

`Scrape seminars + festivals`

Keep these two new files:

- `scrape-seminars.yml`
- `scrape-festivals.yml`

The old workflow should disappear from future scheduled runs after the deletion is committed to the default branch.

### 3. Add the Claude token to GitHub Secrets

The workflows expect this secret name exactly:

`CLAUDE_CODE_OAUTH_TOKEN`

In GitHub:

1. Open the repository.
2. Click `Settings`.
3. Click `Secrets and variables`.
4. Click `Actions`.
5. Click `New repository secret`.
6. Name it `CLAUDE_CODE_OAUTH_TOKEN`.
7. Paste the Claude Code OAuth token as the value.
8. Save it.

GitHub stores repository secrets under `Settings → Secrets and variables → Actions → New repository secret`.

### 4. Commit and push

Commit the archive changes to the default branch of `cyberphunkisms/seminarschools`.

A normal Git push is enough. Netlify should detect the Git push and build the site automatically because Netlify triggers deploys when changes are pushed to a connected Git repository.

### 5. Confirm Netlify deployed the new site

After the push, open Netlify and check the deploy log.

The deploy should run the build from the repository. The site should publish the new static calendar, updated sitemap, source roster, redirects, and generated event pages.

### 6. Manually run the two new scrapers once

In GitHub:

1. Open the repository.
2. Click `Actions`.
3. Open `Refresh polymythcalendar seminars`.
4. Click `Run workflow`.
5. Run it on the default branch.
6. Wait for it to finish.
7. Repeat the same steps for `Refresh polymythcalendar festivals`.

GitHub allows manual runs when a workflow includes `workflow_dispatch`; both new scraper workflows include that trigger.

### 7. Check what happened after each run

Open the completed workflow run.

Good signs:

- The run finishes green.
- `Verify generated calendar` passes.
- A commit appears with a message like `data: refresh polymythcalendar seminars` or `data: refresh polymythcalendar festivals`.
- Netlify deploys after that commit.

If the run fails:

1. Open the failed workflow run.
2. Scroll to `Artifacts`.
3. Download the artifact named `polymythcalendar-seminars-...` or `polymythcalendar-festivals-...`.
4. Open the `.log` and `.status.json` files inside.
5. The `.status.json` gives the stream, exit code, log path, budget, turn limit, and timeout.
6. The `.log` gives the real failure message.

### 8. Verify the live calendar

After Netlify deploys, open:

- `www.seminarschools.com/polymythcalendar`
- `www.seminarschools.com/polymythcal`
- `www.seminarschools.com/polymythseminars/`
- `www.seminarschools.com/polymythseminars/events.json`
- `www.seminarschools.com/sitemap.xml`

The first two should redirect to the canonical calendar. The event JSON should show hundreds of records. The sitemap should include event pages.

## What a green result means

A green local verification means the archive is internally correct.

A green GitHub workflow means the scraper can run in GitHub with the real secret and real runner.

A green Netlify deploy means the public website received the new calendar files.

A visible live calendar with the new event count means the whole chain is working.

## What to send me if it fails again

Send one of these:

- the downloaded `harvest-diagnostics` artifact
- the `.log` file inside the artifact
- the `.status.json` file inside the artifact
- a screenshot of the failed GitHub Actions step with the last 30 lines visible

That gives the real cause. The old email only said the job failed after 36 minutes, which was not enough to diagnose the exact line.
