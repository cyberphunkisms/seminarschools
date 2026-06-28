# Seminar Schools Professional Predeployment Audit

## Scope

This audit treats the current ZIP as a release candidate. It examines the full static site, Netlify configuration, public routes, redirects, client scripts, forms, payment and booking functions, sitemap, robots rules, application metadata, dependency state, accessibility structure, performance footprint, and recovery posture.

The audit distinguishes three kinds of result.

- **Fixed in this ZIP** means the repository now carries the repair and an automated guard.
- **Verify in the deployed environment** means the code is ready, while only the real provider account can prove the last handoff.
- **Owner decision** means the item changes business policy, data governance, or public scope.

## Release Baseline

- 69 public HTML pages
- 62 first-party JavaScript files
- 145 redirect rules
- 6 Stripe-backed Leizu plans
- 2 Netlify-detected forms
- 6 Netlify functions
- 1 PWA manifest
- 68 current sitemap URLs after cleanup

## Fixed in This ZIP

### Public routing and indexation

- Replaced the client-side `/sitemap/` hop with forced HTTP redirects to `/polymyth/sitemap/`.
- Removed duplicate sitemap URLs.
- Removed noindex interface pages, draft interfaces, and a redirect alias from `sitemap.xml`.
- Updated `lastmod` for the current root, Main, Saul, Leizu, and bookwormburrows case pages.
- Gave `/main/` a distinct meta description instead of duplicating the root homepage description.

### Public build boundary

- Blocked unlinked operator files from public serving.
- Blocked setup instructions, environment-variable examples, package manifests, Netlify deployment files, build scripts, Leizu setup notes, and teacher-resource audit files.
- Kept the intended public polymyth source texts open.
- Added `/.well-known/security.txt` with a responsible disclosure contact.

### Sensitive flows

- Added `Cache-Control: no-store` to Leizu intake, Leizu booking success, and bookwormcard success routes.
- Tightened Leizu entitlement verification so only Stripe sessions with `payment_status: paid` unlock booking.
- Removed Gemini diagnostic fields that revealed whether an API key existed and how long it was.

### Installability and accessibility

- Added true square PWA icons at 192 and 512 pixels.
- Removed the rectangular social preview image from the PWA icon manifest.
- Restored real `href` values on the methodologylist architecture links while retaining the existing interactive filtering behaviour.
- Added accessible names to four search controls, the New York Public Library image link, and the saved wormcard file picker.

### Regression prevention

- Added `scripts/verify-professional-readiness.js`.
- Added the readiness guard to `npm run verify:all` and the canonical deploy script.
- The new guard protects the PWA icon dimensions, no-store rules, sitemap uniqueness, noindex exclusions, operator-file blocks, Stripe entitlement, Gemini diagnostic exposure, accessibility fixes, legacy sitemap canonicalisation, and security contact.

## Full Technical Checklist

### 1. Release integrity

- [x] ZIP opens and preserves the complete site tree.
- [x] Every first-party JavaScript file parses.
- [x] Every inline JavaScript block parses.
- [x] No public backup HTML files remain in the release tree.
- [x] The deployment script runs the full verification suite before and after a merge.
- [x] The release contains an auditable package lock.
- [ ] Confirm the production branch has a protected review path or a reliable rollback tag.
- [ ] Confirm Netlify retains enough historical deploys for rollback.

### 2. Internal links and routing

- [x] Local routes, local assets, form actions, and local fragments are scanned by the whole-site guard.
- [x] 130 redirect rules are scanned for known target routes.
- [x] `/bb/why` normalizes to `/bb/why/`.
- [x] `/apply/success` enters the canonical Leizu portfolio intake.
- [x] `/sitemap` and `/sitemap/` now normalize to `/polymyth/sitemap/`.
- [x] The core homepage jewel enters `/main/`.
- [x] The bookwormburrows jewel enters `/bb/`.
- [ ] Run a deployed redirect crawl because Netlify is the final authority on redirect precedence.
- [ ] Open all third-party links at least once after deployment because external services can change independently of this ZIP.

### 3. Forms and intake reliability

- [x] Leizu uses a static Netlify form with a honeypot.
- [x] Intake uses multipart `FormData` for the optional portfolio upload.
- [x] The visible form retains selected courses, paths, plan context, and Simple English support state.
- [x] A failed JavaScript submission retains answers and offers native form submission.
- [x] Portfolio applicants use manual review before any payment route.
- [x] Unpaid inquiries receive a receipt path separate from paid booking confirmation.
- [ ] Confirm Netlify detects `leizu-intake` and `bookwormcard` on the production deploy.
- [ ] Confirm Netlify form notifications reach a monitored mailbox.
- [ ] Decide the retention period for uploaded portfolios and form submissions.
- [ ] Add a concise public data-use and retention notice before collecting additional minor-student information.

### 4. Stripe, Cal.com, and Resend

- [x] Each published Leizu plan has one catalog key and one Stripe link mapping.
- [x] Stripe Checkout sessions must be complete and paid before booking release.
- [x] One intake reference can unlock one completed paid session.
- [x] Booking confirmation requires the signed Cal.com webhook, the verified Stripe record, and a matching attendee email.
- [x] Booking confirmation uses a stable Resend idempotency key.
- [x] Booking success pages and API responses are non-cacheable.
- [ ] Test every live plan with Stripe test mode or a controlled live test.
- [ ] Test asynchronous payment completion, abandoned checkout, repeat success-page visit, duplicate webhook delivery, and a duplicate calendar attempt.
- [ ] Confirm provider webhook secrets, Payment Link IDs, sender domain verification, and calendar URLs match the production account.
- [ ] Confirm refund, cancellation, and rescheduling messages match the policy page and the provider calendars.

### 5. AI feature controls

- [x] Gemini API credentials stay server-side.
- [x] Browser responses are rendered through escaping in the primary chat surfaces.
- [x] The public health endpoint no longer reveals API-key configuration details.
- [x] The browser has static fallbacks when Gemini fails or times out.
- [ ] Add an account-level rate limit or WAF rule for `/api/gemini-chat` before sustained public use.
- [ ] Decide an age and consent policy for birth data, email, and free-text responses collected through bookwormcard.
- [ ] Add a short disclosure explaining that submitted text can be sent to the selected AI provider when Gemini is enabled.

### 6. Security headers and secrets

- [x] HSTS, clickjacking protection, MIME sniffing protection, referrer policy, and a restrictive permissions policy are configured.
- [x] API responses use `Cache-Control: no-store`.
- [x] The repository scan found no Stripe secret, Stripe webhook secret, Resend key, Netlify token, or private-key material.
- [x] Internal setup, deployment, build, and environment-example files are blocked publicly.
- [x] `security.txt` provides a public vulnerability-reporting route.
- [ ] Plan a Content Security Policy migration. Current pages rely on many inline scripts and a smaller number of inline event handlers, so a strict CSP needs deliberate code migration rather than a blind header.
- [ ] Rotate all provider secrets on a fixed schedule and immediately after any accidental disclosure.
- [ ] Confirm Netlify access is limited to the people who actually administer deployment, domains, forms, and environment variables.

### 7. Dependency health

- [x] `@netlify/blobs` moved from 10.7.7 to current patch release 10.7.9.
- [x] The project has one production dependency and a locked dependency tree.
- [ ] `npm audit` still reports six moderate transitive OpenTelemetry advisories through the current Netlify package chain. The current upstream package line still resolves to the affected OpenTelemetry range. Track the upstream remediation and upgrade when Netlify publishes it.
- [ ] Run `npm audit` during each maintenance release.

### 8. Accessibility and inclusive interaction

- [x] Image-alt, target-blank safety, missing local anchors, and JavaScript parsing are guarded site-wide.
- [x] Search controls named only by placeholders now have explicit accessible names.
- [x] Methodology architecture links can be reached by keyboard.
- [x] Leizu supports Simple English, text scaling, theme control, persistent language selection, and Persian RTL direction.
- [x] The homepage constellation supports selection state, focus, touch selection before navigation, and a mobile project rail.
- [ ] Test keyboard-only completion of Leizu intake, Bookwormcard, home constellation, Saul filters, and polymyth search pages.
- [ ] Test at 200 percent and 400 percent browser zoom on desktop and mobile-width layouts.
- [ ] Test screen-reader announcements in the interactive archives and dynamic maps.
- [ ] Review the campaign DM board and older aa pages. They use legacy inline interactions that work today but deserve a dedicated keyboard audit.

### 9. Performance and device resilience

- [x] Background geometry pauses when pages are hidden or idle where the current geometry engine supports it.
- [x] Reduced-motion preferences suppress continuous visual movement.
- [x] Images use lazy loading where appropriate.
- [x] Long-lived static image caching is configured without making CSS or JavaScript stale after deployment.
- [ ] The largest interactive pages remain heavy before transfer compression. `polymyth/methodologylist/` is approximately 3.7 MB of local HTML, `aa/` is approximately 1.5 MB, and several framework pages exceed 500 KB. Treat code splitting or data-on-demand loading as a separate performance project.
- [ ] Measure Core Web Vitals on production mobile connections after deployment.
- [ ] Test the map, geometry, and Bookwormcard on a low-memory Android device.
- [ ] Audit Google Fonts as an external dependency and consider self-hosting only if performance or privacy priorities justify it.

### 10. Search, sharing, and structured presence

- [x] Core pages have titles, descriptions, canonical URLs, Open Graph data, and sitemap coverage.
- [x] The main page now has a distinct search description.
- [x] Sitemap duplicates and noindex URLs were removed.
- [x] PWA metadata now uses valid square icons.
- [ ] Several long-form research, archive, and campaign pages have descriptions longer than common search-snippet ranges. Refine them only when those pages become priority discovery routes.
- [ ] Add or verify Organization, Person, EducationalOrganization, Event, and Course structured data after deciding which public entities deserve search-result treatment.
- [ ] Confirm the canonical domain in Google Search Console and submit the revised sitemap after deployment.

### 11. Content operations and external dependencies

- [x] Intended public polymyth source texts remain reachable.
- [x] Internal build and audit material is no longer publicly reachable.
- [x] The Harlem campaign source uses a durable New York Public Library source link.
- [ ] Decide which raw research files should remain public, discoverable, and AI-readable. The present release preserves the polymyth corpus while closing setup and audit files.
- [ ] Review academic, video, calendar, Drive, Stripe, Cal.com, Calendly, Buy Me a Coffee, and Google Forms links after each quarterly maintenance cycle.
- [ ] Keep a single source of truth for prices, cancellation terms, calendar slugs, and payment links.

### 12. Observability, recovery, and human operations

- [x] Function code logs payment and booking exceptions without exposing credentials to the client.
- [x] Automated site checks cover route integrity, critical data, geometry, writing register, payments, localization, and public assets.
- [ ] Configure Netlify deploy failure notifications.
- [ ] Configure form-submission notifications for a monitored inbox.
- [ ] Add uptime monitoring for the home page, Leizu intake, Stripe success verifier, Cal webhook, and Gemini endpoint.
- [ ] Keep a short incident checklist for payment failure, booking mismatch, email delivery failure, calendar outage, and accidental deployment rollback.
- [ ] Create a quarterly restoration test from a downloaded ZIP and current environment-variable inventory.

## Findings That Need No Further Code Change Today

- The existing local route and asset scan finds no broken first-party targets.
- The full project verification suite passes after the new readiness guard is included.
- The payment and booking code follows a server-verified model rather than trusting browser storage.
- The public site has a small number of intentional, older inline event-handler patterns. They are operational today. They block a strict Content Security Policy until migrated.
- The remaining `npm audit` findings are moderate, transitive OpenTelemetry advisories inside the current Netlify dependency line. They require upstream remediation rather than an unsafe downgrade.

## Decisions for Saul Before a Production Release

1. Decide the privacy and retention policy for student records, portfolio uploads, Bookwormcard birth data, emails, and AI prompts.
2. Decide whether the Gemini feature should have a provider disclosure and an age gate.
3. Decide whether to fund a managed WAF or rate-limit service for the Gemini endpoint.
4. Decide which public raw framework and research files are intentionally part of the public archive.
5. Decide whether analytics and uptime monitoring are worth adding now or after the next live-content cycle.
6. Decide when a lawyer or privacy professional should review the data and payment surfaces before broader marketing.

## Required Live Verification After a Future Deploy

1. Confirm Netlify completes the deploy and detects both forms.
2. Confirm every redirect that moved in this release returns a single 301 hop.
3. Install the PWA on one Android and one iOS device.
4. Submit a generic Leizu inquiry, a portfolio intake, and a Bookwormcard submission.
5. Complete controlled Stripe and Cal.com tests for each Leizu payment shape.
6. Confirm Resend receipts and booking messages arrive, reply correctly, and do not duplicate.
7. Test root, Main, Saul, Leizu, Bookwormcard, aa, polymyth, teacher resources, and Agora on current Chrome, Safari, Firefox, and mobile Safari.
8. Test keyboard-only and reduced-motion interaction.
9. Test a simulated provider outage for Stripe, Gemini, Cal.com, and Resend.
10. Confirm the rollback procedure returns the prior Netlify deploy cleanly.
