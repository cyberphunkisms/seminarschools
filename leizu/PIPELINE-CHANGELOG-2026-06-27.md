# Leizu pipeline repair — 2026-06-27

## Conversion path

`plan/course choice → Netlify intake form → Stripe Checkout → verified Stripe session → Cal.com booking → signed Cal.com webhook → Resend booking email`

## Repairs

- Replaced browser-storage plan state with URL parameters and static hidden Netlify-form fields.
- Consolidated all six public Stripe Payment Links in `leizu/payment-config.js`.
- Preserved optional portfolio uploads through multipart `FormData` submission.
- Added Stripe Checkout Session verification in `netlify/functions/leizu-verify-payment.mjs`.
- Moved Cal.com routes from browser code to Netlify environment variables.
- Added a signed Cal.com `BOOKING_CREATED` webhook that sends the final Resend confirmation only after booking creation.
- Replaced the orphan HTTP form handler with a Netlify Forms event function.
- Added a Stripe Payment Link configuration script and a static verifier.
- Repaired the Leizu page’s French translation JavaScript syntax, which previously stopped the main curriculum script from loading.

## Account-side completion

The repository includes the exact instructions and placeholders in `leizu/LEIZU-PIPELINE-SETUP.md` and `netlify.env.example`. Stripe, Cal.com, Netlify, and Resend dashboard values remain account-specific and must be set during deployment.

## Hardening pass

- Added a signed Stripe webhook for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, so a paid session is recorded even when the customer closes Stripe before the browser redirect.
- Added atomic intake-reference ownership. A second paid Stripe session using the same `intake-id` is blocked from releasing a second calendar route.
- Changed the Cal.com webhook to require a paid Leizu record, the embedded Leizu booking reference, and an attendee email that matches the Stripe Checkout email before it sends Resend.
- Added an atomic one-booking claim per paid intake. A second Cal.com booking event for that payment receives no Leizu confirmation.
- Added a Resend idempotency key per Cal.com booking UID, allowing safe retries after a partially interrupted webhook without duplicate confirmation emails.
- Updated the course-selector path: it now carries every selected standard and ESL course into the intake form, shows the selections, and requires the visitor to choose one real published plan before checkout.
- Captured and mapped `source=seminar`, `source=mulberry`, and `source=contact` into the intake form’s purpose field.
- Moved Netlify `publish` and `ignore` settings into `[build]` and the functions directory into `[functions]`.
- Expanded the deploy script to run geometry, register, payment, and Leizu-pipeline checks before and after its merge.
- Added `scripts/verify-leizu-pipeline.js` and an npm `verify:all` command for the new conversion safeguards.

## Known operational boundary

A public Cal.com event can still be reached by someone who independently obtains its Cal.com URL. This code prevents that route from receiving a Leizu Resend confirmation unless it carries a real paid Leizu reference and matching Stripe email. Preventing the creation of a second external Cal.com appointment itself requires Cal.com account-level availability or cancellation controls; the code detects and refuses to confirm the second booking.
