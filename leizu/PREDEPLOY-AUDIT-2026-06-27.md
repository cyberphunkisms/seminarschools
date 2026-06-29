# Leizu predeployment audit

## Scope

This audit starts from the Leizu full revamp and reviews the public choices, intake form, Stripe handoff, payment verification, calendar release, booking webhook, Resend confirmation, visible copy, and Leizu-only navigation.

## Verified in the package

### Public choices

- Starter block, Term, and all four Forest Year payment shapes carry a real plan key to the intake page.
- Course and ESL selections carry their internal IDs to the intake page and appear there as readable course names.
- The course selector no longer invents a price for a collection of courses. It asks the family to choose one published plan in the intake before payment.
- An empty course selection gives a visible message and remains on the course section.
- The Chinese consultation route remains in the navigation, first screen, and contact section. It points to the approved Calendly consultation page.

### Intake

- The selected plan, selected course IDs, readable course names, source, and intake reference are captured as hidden Netlify form fields.
- The visible subject field remains open for an assignment, goal, or context. It no longer contains course IDs such as `H1` or `P3`.
- A selected-course intake shows a readable summary with wrapping course chips.
- The plan selector opens when a selected-course visitor needs a published plan.
- Stripe opens only after the form has submitted and the visitor chooses the secure-payment button.
- A failed asynchronous form request preserves the form and offers a native Netlify submission path.

### Payment and booking

- Payment Links receive a unique `client_reference_id`.
- The payment-success page checks Stripe server-side before it releases a plan-specific Cal.com route.
- Stripe webhooks record paid sessions even when a browser does not return from Checkout.
- The calendar URL carries the protected Leizu reference in booking notes and pre-fills the Stripe checkout email.
- The Cal.com webhook verifies its signature, requires a paid Leizu record, requires the booking email to match the paid checkout email, and then sends Resend.
- Duplicate Stripe events, duplicate payment references, and duplicate Cal.com webhook deliveries are deduplicated.

### Copy and policy consistency

- The first screen has one practical promise, three actions, and the Chinese consultation route.
- The course selector now describes the actual next step instead of an obsolete bundle-price model.
- The Term card now leads with its published total of `$400 / three months`, followed by the existing payment schedule.
- The Leizu home page and every translated FAQ route readers to the policy page instead of repeating cancellation numbers that can drift.
- Policy terms, rates, refund rules, eligibility thresholds, and program requirements are unchanged in the policy page.

## Automated checks run

- `verify-critical.js`
- `verify-geometry.js`
- `verify-register.js`
- `verify-payments.js`
- `verify-leizu-pipeline.js`
- `verify-leizu-experience.js`
- Inline JavaScript parsing for all public Leizu pages
- Internal Leizu link resolution

## Account-side checks that remain

The package proves static code and local handoffs. The following require the connected accounts.

1. Deploy this build and confirm Netlify detects `leizu-intake`.
2. Add the required Netlify environment variables and the six Stripe Payment Link IDs.
3. Run the Stripe configuration script to set the post-payment redirect on every Payment Link.
4. Add Stripe payment and Cal.com booking webhooks using the generated secrets.
5. Verify the Resend sender domain.
6. Test a paid path for Starter, Term, and each Forest Year payment shape.
7. Test one course-selector path and confirm the selected course names appear in Netlify Forms.
8. Test the Chinese Calendly consultation CTA separately.
9. Confirm the live Stripe amount and payment schedule for every card, especially the Term plan.
10. Attempt a second Cal.com booking from the same paid calendar URL. The code prevents a second Leizu confirmation, while Cal.com availability behavior must be observed in the live account.

## Remaining product decision

The page contains a multilingual interface. Some long new structural copy is still English when a visitor switches the page language. The existing language control remains useful for its translated sections, but a complete Chinese, French, and Farsi content pass requires approved translations for every revised public paragraph.
