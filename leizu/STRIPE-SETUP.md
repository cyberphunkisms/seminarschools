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

One philosophy governs every price. Within a delivery type, the more hours you commit to, the cheaper each hour becomes, with no exception, and buying upfront beats paying monthly because paying in full is the larger commitment. The tables below are built on that rule, anchored on a notional ninety dollar one-on-one hour. Move that anchor and the whole ladder moves with it, but the order never changes.

All prices CAD. One session is one contact hour. Create eight products.

**One-on-one, the Forest track.** Each hour cheaper than the one above it.

| product | price | hours | per hour | billing |
|---|---|---|---|---|
| 3 sessions | $270 | 3 | $90.00 | one time |
| 5 sessions | $430 | 5 | $86.00 | one time |
| 7 sessions | $575 | 7 | $82.14 | one time |
| Forest year, monthly | $950 per month | 144 | $79.17 | recurring, 12 cycles |
| Forest year, upfront | $10,500 | 144 | $72.92 | one time |

**Small seminar, the Seminar track, gated by 20 to 40 prior one-on-one sessions.** Group rate with its own floor, since group is a different product rather than a larger volume.

| product | price | hours | per hour | billing |
|---|---|---|---|---|
| Seminar year, monthly | $390 per month | 144 | $32.50 | recurring, 12 cycles |
| Seminar year, upfront | $4,350 | 144 | $30.21 | one time |

**Donation.** Mulberry Fund, customer chooses the amount, scholarship support.

The monthly option on each year carries a flat eight percent premium over upfront, the cost of spreading the commitment, and it is the same eight percent on both tracks so the financing stays consistent. Upfront is always the cheapest hour in its track. The three session pack is the on ramp and therefore the most expensive hour, which is correct, since it is the smallest purchase anyone can make.

The rule also locates the next tier for you. A multi year or sibling commitment is a larger purchase than a single Forest year, so it slots onto the bottom of the one-on-one table as the cheapest hour of all the moment you set its discount. That is the volume stacking tier, already placed.

REGENERATE. Five of the seven paid prices changed and two did not. Forest upfront at $10,500 and Seminar upfront at $4,350 are held, so their existing Payment Links stay exactly as they are. Recreate only the other five in Stripe, the three session pack at $270, the five session pack at $430, the seven session pack at $575, Forest monthly at $950, and Seminar monthly at $390. A Stripe price is immutable once created, so for each one you make a new price and a new Payment Link and archive the old. Test mode links do not carry to live. Send me the five new buy.stripe.com URLs and I wire the page text and booking-button.js together in one pass so the displayed price and the charged price can never drift apart.

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

- The buymeacoffee link (`https://buymeacoffee.com/cyberphunk`) is currently on the Agora page only. It is a separate channel from Stripe; buymeacoffee is for casual one-time tips on the free seminars, Stripe is for paid course bookings. Keep them separate.
- The Mulberry Fund is for student scholarships specifically. If you want to take Mulberry Fund donations via Stripe rather than the current /leizu/donate page setup, that is one more product to create.

End of guide.
