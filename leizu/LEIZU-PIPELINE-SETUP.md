# Leizu payment, calendar, and email pipeline

The deployed paid sequence is:

1. A visitor selects a published Leizu plan, or selects courses and then chooses a published plan on the intake page.
2. The intake page records the selected plan, selected course IDs, source, and a unique `intake-id` in the Netlify Form submission.
3. Stripe Checkout receives that `intake-id` as `client_reference_id`.
4. Stripe sends `checkout.session.completed` to the signed Stripe webhook and redirects the completed Checkout Session to the booking-success page with `{CHECKOUT_SESSION_ID}`.
5. The booking-success page independently retrieves the Checkout Session from Stripe, confirms that it is paid, confirms its configured Payment Link, and releases only the matching server-configured Cal.com route.
6. Cal.com creates the booking and sends a signed `BOOKING_CREATED` webhook.
7. The Cal.com webhook requires a matching paid Leizu record and matching payer email before it sends the final Resend confirmation.

A single `intake-id` can unlock one paid booking route. A second completed Checkout Session with the same `intake-id` is recorded as a duplicate and never releases another Cal.com route. A second Cal.com booking event for the same paid reference receives no Leizu confirmation.

## 1. Deploy and enable Netlify Forms

In Netlify, enable **Forms → Usage and configuration → Form detection**, then deploy this version. The static form is named `leizu-intake` and contains the hidden conversion fields that Netlify needs to capture.

The optional portfolio field uses multipart `FormData`, allowing Netlify to receive the file and fields together.

## 2. Add Netlify environment variables

Add these under **Site configuration → Environment variables**. Use matching test values in a test site or deploy preview before setting live values in production.

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM=Leizu Academy <noreply@seminarschools.com>
LEIZU_REPLY_TO=saulnassau@protonmail.com
CAL_WEBHOOK_SECRET=<a long random secret>
LEIZU_SITE_ORIGIN=https://seminarschools.com

CAL_BOOKING_URL_STARTER_BLOCK=https://cal.com/seminarschools/weekly3
CAL_BOOKING_URL_TERM=https://cal.com/seminarschools/weekly3
CAL_BOOKING_URL_FOREST_YEAR_UPFRONT=https://cal.com/seminarschools/forestyear
CAL_BOOKING_URL_FOREST_YEAR_TWO=https://cal.com/seminarschools/forestyear
CAL_BOOKING_URL_FOREST_YEAR_TERM=https://cal.com/seminarschools/forestyear
CAL_BOOKING_URL_FOREST_YEAR_MONTHLY=https://cal.com/seminarschools/forestyear
```

The six `STRIPE_PAYMENT_LINK_ID_*` variables come from the next step. They are internal Stripe `plink_...` IDs, not public `buy.stripe.com` URLs.

## 3. Configure all six Stripe Payment Links

Run this from the repository root with the Stripe secret key that owns the existing links:

```bash
STRIPE_SECRET_KEY=sk_live_... node scripts/configure-leizu-stripe-payment-links.mjs
```

The script changes every Payment Link’s after-payment behavior to:

```text
https://seminarschools.com/leizu/booking-success/?session_id={CHECKOUT_SESSION_ID}
```

It then prints the six values to paste into Netlify:

```text
STRIPE_PAYMENT_LINK_ID_STARTER_BLOCK=plink_...
STRIPE_PAYMENT_LINK_ID_TERM=plink_...
STRIPE_PAYMENT_LINK_ID_FOREST_YEAR_UPFRONT=plink_...
STRIPE_PAYMENT_LINK_ID_FOREST_YEAR_TWO=plink_...
STRIPE_PAYMENT_LINK_ID_FOREST_YEAR_TERM=plink_...
STRIPE_PAYMENT_LINK_ID_FOREST_YEAR_MONTHLY=plink_...
```

Use a test Stripe account and test Payment Links for the first full rehearsal. The included dry run checks that the public URLs belong to the connected Stripe account:

```bash
DRY_RUN=1 STRIPE_SECRET_KEY=sk_test_... node scripts/configure-leizu-stripe-payment-links.mjs
```

## 4. Create the Stripe webhook

In Stripe Dashboard → **Developers → Webhooks**, add an endpoint:

```text
Endpoint URL: https://seminarschools.com/api/stripe-payment-webhook
Events: checkout.session.completed, checkout.session.async_payment_succeeded
```

Copy Stripe’s endpoint signing secret into Netlify as `STRIPE_WEBHOOK_SECRET`.

This webhook records a paid Checkout Session even when a customer closes Stripe before the browser redirect completes. The booking-success page still verifies Stripe independently before it opens Cal.com.

## 5. Create the Cal.com webhook

In Cal.com → **Settings → Developer → Webhooks**, create one webhook for each paid Cal.com event type, or one webhook covering all of them:

```text
Subscriber URL: https://seminarschools.com/api/cal-booking-webhook
Trigger: BOOKING_CREATED
Secret: exactly the CAL_WEBHOOK_SECRET value in Netlify
```

The function accepts a booking only when the prefilled Leizu reference resolves to a paid Stripe record and the Cal.com attendee email matches the Checkout email.

## 6. Verify the Resend sender

Verify `seminarschools.com` in Resend and use a verified sender in `RESEND_FROM`. The booking webhook treats email delivery errors as retryable so it never records a confirmation as sent before Resend accepts it.

## 7. Run the full live test

Use a Stripe test Payment Link and a disposable email address:

1. Open `https://seminarschools.com/leizu`.
2. Test one tier card, then test the course selector path. The selected courses should appear at the top of the intake form.
3. Submit the intake. In Netlify Forms, confirm `intake-id`, `source`, `selected-tier`, and selected course fields are present.
4. Confirm Stripe Checkout opens with a non-empty `client_reference_id` and prefilled email.
5. Complete test payment. Confirm the Stripe webhook returns `200` and the browser returns to `/leizu/booking-success/?session_id=cs_...`.
6. Confirm the payment-success page opens the expected Cal.com event only after verification.
7. Book a time using the same email as Stripe Checkout.
8. Confirm Cal.com sends its normal invitation and Resend sends **Your Leizu session is booked**.
9. Reopen the Stripe-success URL. It should report that the payment already has a booked session instead of releasing another calendar route.
10. Try a direct Cal.com event without the Leizu note. It should create no Leizu Resend confirmation because it has no verified payment reference.

## Local verification

```bash
npm install
node scripts/verify-critical.js
node scripts/verify-geometry.js
node scripts/verify-register.js
node scripts/verify-payments.js
node scripts/verify-leizu-pipeline.js
```

The static checks catch wiring drift. The test transaction remains necessary because Stripe, Cal.com, Resend, and Netlify Forms each run in your own live accounts.
