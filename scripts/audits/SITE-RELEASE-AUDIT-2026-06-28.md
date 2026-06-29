# Site Release Audit

## Result

All 69 published HTML pages, 61 first-party JavaScript modules, 130 redirect
rules, local routes, local assets, forms, anchors, core sitemap routes, and
inline JavaScript blocks pass static deployment validation.

## Repairs in this release

- Set the public Saul identity to Saul Karim Nassau, MA in the prior Saul-page
  revision and retained it as the current canonical header and metadata.
- Removed the pre-revamp Saul HTML backup from the deploy tree.
- Repaired the methodologylist HTML-export function. Literal closing script tags
  inside its export template now stay escaped until the downloaded document is
  generated, so the live methodologylist script remains syntactically valid.
- Replaced a missing Harlem map image placeholder in the Thank You, Ma'am
  campaign with a resilient New York Public Library primary-source link.
- Moved generated revision and audit material behind the site's blocked
  `/scripts/` route rather than publishing it as visitor-facing pages.
- Added a whole-site integrity guard to `npm run verify:all` and the canonical
  deploy script. It blocks missing local links and assets, broken anchors,
  malformed inline JavaScript, unsafe new-window links, public backup HTML, and
  missing core sitemap routes.

## Coverage

The release retains the existing guards for calendar data, geometry, copy
register, Leizu payment and booking, localisation, course selection, homepage
map behavior, bookwormburrows, the main-to-Leizu portfolio route, and Saul's
public CV.

## External-service boundary

Static validation cannot prove account-owned live services such as Stripe,
Cal.com, Calendly, Resend, Google Forms, or Google Drive. Run the small live
smoke test after deployment: a Starter path, a Forest Year path, a course-picker
path, the Chinese consultation route, a portfolio inquiry, and the bookwormburrows
pedagogical case.
