# Main to Leizu funnel and efficiency audit

## Completed

- Retired the separate `leizu-application` Netlify form on `/main/`.
- Sent every portfolio call to action into `/leizu/intake/?source=portfolio`.
- Added source-aware portfolio handling in the Leizu intake.
- Preserved the first-session portfolio rate and moved payment to personal review, so a portfolio visitor cannot accidentally enter the ordinary full-price Stripe path.
- Removed unused standalone-form CSS and the associated file-picker JavaScript from `/main/`.
- Redirected the old `/apply/success` URLs into the canonical portfolio intake.
- Updated the tree sitemap and graph data to replace the retired success route.
- Removed the old public backup page, which would otherwise have exposed the retired form to Netlify form detection.
- Updated the Leizu Forms receipt to give portfolio submissions their own manual-review confirmation.
- Added a regression guard that checks the portfolio funnel and blocks future reintroduction of the standalone form.

## Efficiency checks

- The page now has one public Leizu intake form rather than two competing form systems.
- The main page no longer ships dead portfolio-form markup, duplicate Netlify detection fields, or file-input handling that users cannot reach.
- The existing geometry interaction already uses requestAnimationFrame, does not run a permanent animation loop, pauses for reduced-motion users, and stores the visitor preference. No additional script loop was added.
- The event preview still loads the live public calendar file. It remains intentionally live because the section presents upcoming events.

## Remaining manual work

No account configuration is required. Deploy this archive over the current site and test one portfolio intake. The expected path is `main portfolio route` to `Leizu intake` to `manual review` to `portfolio-rate payment`.
