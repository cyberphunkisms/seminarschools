# TR Submission Form Strategy
## CL-64, 2026-06-23

### Constraint
Static site. No backend. User submits a link. Saul reviews and approves. Approved entries update the TR catalog.

### Pipeline

**INTAKE.** Google Form. Five fields, all required except notes.

| Field | Type | Purpose |
|---|---|---|
| Resource title | Short text | Display name in catalog |
| URL | URL | The link the user is giving |
| Subject | Dropdown (ELA, Math, Sciences, History, Social Studies, Indigenous Studies, French, Civics, Arts, ESL, Multi) | Maps to `subject` key in JSON |
| Grade range | Short text (e.g. "7-10", "all") | Maps to `grade` key |
| Your name and email | Short text | For attribution and follow-up |
| Notes (optional) | Long text | Context, why this resource is good, what unit it pairs with |

The form takes under 60 seconds to fill. The user provides the link. The site does not host.

**REVIEW.** Responses land in a Google Sheet (automatic with Google Forms). Saul adds two columns manually: `approved` (yes/no) and `bucket` (which bucket ID in buckets.json). Rejected rows get a reason note. Approval is binary.

**UPDATE.** Two paths.

Path A (manual, immediate): Saul copies approved entries into `all_entries.json` and `buckets.json` by hand following the existing entry shape. Push to master. Done.

Path B (scripted, when volume justifies): A Python script reads the Google Sheet (via published CSV export URL), filters for `approved=yes` rows not yet in the JSON, appends them with proper format/host/subject fields derived from the form data, writes both JSON files atomically. Saul reviews the diff, pushes.

**SURFACE.** The contribute section of the TR page (currently broken by the missing `</style>` structural defect) gets a one-liner when repaired:

```
Know a resource that belongs here? <a href="[GOOGLE_FORM_URL]">Suggest it.</a>
```

The form link also goes in the TR page footer and in the RSS feed description.

### What Saul needs to do

1. Create the Google Form with the five fields above
2. Copy the form URL
3. Once the TR page `</style>` defect is repaired, add the link to the contribute section
4. Review the response sheet periodically
5. Approve or reject, then run the manual JSON append (Path A) or the script (Path B when built)

### Existing defect blocking surface deployment

The TR page `teacherresources/index.html` has no `</style>` tag. The `<style>` block opened at line 27 never closes. Browser error recovery renders the page, but the contribute div at line 672 contains leaked JavaScript instead of HTML content. Fixing this requires closing the style tag at the correct line, which I deferred because touching the page structure without render-verification risks breaking the catalog. This repair should be its own CL in the next session with render access.
