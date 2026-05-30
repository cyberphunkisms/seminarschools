# Stripe setup guide for Leizu Academy

Last updated May 24 2026. This guide walks you through setting up Stripe to take payments for Leizu Academy course bookings. The Leizu page already references Stripe in its FAQ and policies, so this is about making that real.

## What Stripe does for you

Stripe is the payment processor. When a parent or student books a course, Stripe handles the credit card, charges them, sends the receipt, and deposits the money in your bank account. You do not handle credit card numbers directly. Stripe takes a fee per transaction (around 2.9% plus 30 cents per charge in Canada as of this writing; verify current rates at stripe.com/en-ca/pricing).

## Two paths for integration

**Path A: Payment Links (simplest).** You generate a hosted payment page for each product or tier through Stripe's dashboard. You paste the link into your booking emails or into the Leizu page. No code work. Recommended starting point.

**Path B: Stripe Checkout embedded in the site.** You add Stripe's hosted checkout to the Leizu page so people can click "Book" and pay in one flow. Requires a tiny bit of code (the Stripe.js snippet) on the Leizu page. Cleaner experience for the buyer. Do this after Path A is working.

Start with Path A. Migrate to Path B later if useful.

## Step-by-step setup

### 1. Create a Stripe account

Go to dashboard.stripe.com/register. Use the email you check most reliably. Stripe will ask whether the account is personal or for a business; pick whichever matches how you invoice. Sole proprietorship is fine if you have not incorporated Seminar Schools or Leizu Academy.

### 2. Verify your identity and business

Stripe requires verification before you can accept live payments. You will need:

- Your full legal name as it appears on government ID
- Date of birth
- Home address
- Canadian SIN (social insurance number) for identity verification
- Business name (Leizu Academy, or Saul Nassau if sole proprietor)
- Business address (can be your home if working from home)
- Business website (seminarschools.com)
- Description of what you sell ("Tutoring and educational coaching sessions")
- A bank account in your name to receive deposits

Allow a day or two for verification. Until verified you can only run test-mode transactions, which is fine for setup.

### 3. Set up your products and prices

In the Stripe dashboard, go to Product Catalog. Create one product per tier from the live Leizu page, eight products in total. All prices in CAD.

**Session bundles (one-time):**

1. **Three sessions** — $300.00 — Description "3 sessions, $100 each. The minimum to begin." One-time payment.
2. **Five sessions** — $510.00 — Description "5 sessions, $102 each. 11% off list." One-time payment.
3. **Seven-class bundle** — $610.00 — Description "7 sessions, $87 each. 24% off list." One-time payment.

**Forest year (144 contact hours, one-on-one):**

4. **Forest year — upfront** — $13,000.00 — Description "Full Forest year paid in one transaction. Saves $1,400 vs monthly total." One-time payment.
5. **Forest year — monthly** — $1,400.00 — Description "Forest year paid monthly across 12 months." Recurring billing, monthly interval, 12 cycles or open-ended (your choice). Total $14,000.

**Seminar year (144 contact hours, small seminar, gated by 20-40 prior sessions):**

6. **Seminar year — upfront** — $5,800.00 — Description "Full Seminar year paid in one transaction. Saves $1,400 vs monthly total." One-time payment.
7. **Seminar year — monthly** — $600.00 — Description "Seminar year paid monthly across 12 months." Recurring billing, monthly interval, 12 cycles or open-ended. Total $7,200.

**Donation:**

8. **Mulberry Fund donation** — Customer-chooses amount — Description "Scholarship fund supporting students who need financial help."

Decide for each year-tier product whether subscriptions cap at 12 cycles (cleaner accounting) or run open-ended (renewal each year is automatic until cancelled). The cleaner default is 12-cycle cap with manual renewal each year, but Stripe supports either.

Add the paper-materials fee as a separate add-on product if you want to invoice that separately.

### 4. Generate Payment Links

For each product, click "Create payment link." Customize:

- **After payment**: redirect to a confirmation page (you can create /leizu/confirmed/ as a simple thank-you page)
- **Collect customer details**: name, email, phone
- **Tax settings**: see step 5
- **Receipt emails**: auto-on

Stripe gives you a URL like `https://buy.stripe.com/abc123xyz`. Copy that URL for each tier.

### 5. Tax setup

Canada has GST (5%) and provincial sales tax (varies). In Ontario you charge HST (13%) for most services. Educational tutoring services to individuals are GST/HST-exempt in many cases under Schedule V of the Excise Tax Act, but this depends on whether the tutoring qualifies as an exempt educational service. Verify with a Canadian accountant or the Canada Revenue Agency directly. If exempt, do not charge HST. If not exempt and you make more than $30,000 a year in revenue, you must register for a GST/HST number and remit.

In Stripe, you can enable Stripe Tax to handle tax calculation automatically once you have set up your tax registrations. For now you can run without tax collection if you are below the $30K threshold or covered by the educational exemption.

### 6. Test it in test mode

Stripe accounts start in test mode. Use the test card number 4242 4242 4242 4242 with any future expiry and any 3-digit CVC. Go through a full booking on your own to see the receipt arrive and the confirmation flow work end to end. Fix any issues.

### 7. Switch to live mode

Once tested, toggle from Test to Live in the Stripe dashboard top-right. Re-generate Payment Links in live mode (test-mode links do not transfer). Update wherever you posted the links.

### 8. Connect Payment Links to your booking flow

The current Leizu page uses a "book now" flow that opens an email client with a pre-filled booking request. To add Stripe:

- **Simplest**: in your booking reply email, include the Stripe Payment Link for whichever tier the family selected. They pay; you confirm the session.
- **Better**: add a "Pay now" button next to each tier on the Leizu page that opens the Payment Link directly. Tell me when you want me to wire this in.
- **Cleanest (Path B)**: embed Stripe Checkout on the Leizu page so payment happens inside the booking flow. Requires a small backend or Stripe's no-code Checkout. Do this once Path A confirms the model works.

### 9. Refunds, disputes, payouts

- **Refunds**: handle from the Stripe dashboard. Match your cancellation policy on the Leizu page (24-hour rule with one late-cancellation per term per family).
- **Disputes**: if a parent disputes a charge, Stripe will email you. Respond within the time window or you lose the dispute automatically. Keep records of session attendance.
- **Payouts**: Stripe deposits to your bank account on a schedule you set (daily, weekly, or custom). Default in Canada is daily after a brief initial holding period.

### 10. Bookkeeping

Download monthly transaction reports from Stripe for your records. Pair with your invoicing and tax filing. Stripe integrates with QuickBooks, Xero, and Wave if you use any of those.

## What I can do next

Tell me which of these you want done:

- Wire Payment Link buttons into the Leizu page (one per tier).
- Create /leizu/confirmed/ landing page for post-payment confirmation.
- Add Stripe.js for embedded Checkout (Path B).
- Add a Stripe webhook handler if you want automatic Google Meet calendar invites on successful payment.
- Add a Mulberry Fund donate page using Stripe Payment Links (separate product, for scholarship donations).

Pick what to do first. I will execute when directed.

## Notes

- The buymeacoffee link (`https://buymeacoffee.com/cyberphunk`) now serves two roles. It is the casual tip channel on the Agora page for the free seminars, and as of May 2026 it is also the interim Mulberry Fund donation button on the /leizu/donate page, standing in until the dedicated Stripe donation Payment Link is created. When that Stripe link goes live, swap the donate-page button from buymeacoffee back to the Stripe link.
- The Mulberry Fund is for student scholarships specifically. If you want to take Mulberry Fund donations via Stripe rather than the current /leizu/donate page setup, that is one more product to create.

- Coupon and promotion codes (later, not yet built). When you want discount codes, here is the sequence. In the Stripe dashboard, create a Coupon, either a percentage off or a fixed amount off. Then generate one or more Promotion Codes tied to that coupon, which are the human-typed codes like WELCOME10. Then, on each Payment Link the code should work on, enable Allow promotion codes in the link settings. Existing Payment Links may need that toggle switched on, or the link regenerated, since it is off by default. Tell me when you want the donate page or the booking flow to show a promo-code field and I wire the page side.

End of guide.
