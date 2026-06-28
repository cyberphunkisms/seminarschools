# Whole-Site Reliability Audit

## Scope

Static deployment audit across every HTML page, local route, local asset, form,
anchor, public script, inline script, core sitemap route, and configured redirect.
The audit also runs the established geometry, register, payment, Leizu pipeline,
localisation, course-picker, map, bookwormburrows, main-page, main-to-Leizu,
and Saul-page guards.

## Repairs in this release

- Removed the publicly reachable pre-revamp Saul backup page.
- Repaired the methodologylist export template so its generated document can
  include script tags without terminating the live export function early.
- Replaced a missing Harlem map image placeholder with a stable New York Public
  Library primary-source link.
- Added `verify-site-integrity.js` to prevent future missing local links,
  missing local assets, malformed inline JavaScript, public backup HTML,
  broken core sitemap routes, missing anchor targets, and unsafe new-window
  links from reaching deployment.
- Added the site-integrity guard to `npm run verify:all` and the canonical
  deployment script before and after repository merge.

## Boundaries

Static verification proves the published code, local routes, and deployable
assets are coherent. Stripe, Resend, Cal.com, Calendly, Google Forms, and other
third-party destinations remain live services owned outside this repository.
Their final availability requires ordinary post-deployment click testing.
