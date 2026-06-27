#!/usr/bin/env node
/*
 * Security-focused static contract test for the Leizu paid conversion path.
 * This complements verify-payments.js by checking webhook ordering and the
 * account-bound routes that cannot be proved without a live test transaction.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
function read(file){ return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file){ return fs.existsSync(path.join(ROOT, file)); }
function assert(condition, message){ if(!condition) errors.push(message); }
function before(text, first, second){ return text.indexOf(first) !== -1 && text.indexOf(second) !== -1 && text.indexOf(first) < text.indexOf(second); }

const intake = read('leizu/intake/index.html');
const verifier = read('netlify/functions/leizu-verify-payment.mjs');
const cal = read('netlify/functions/cal-booking-webhook.mjs');
const stripe = read('netlify/functions/stripe-payment-webhook.mjs');
const common = read('netlify/functions/_leizu-payment-common.mjs');
const netlify = read('netlify.toml');
const env = read('netlify.env.example');
const setup = read('leizu/LEIZU-PIPELINE-SETUP.md');

assert(exists('netlify/functions/stripe-payment-webhook.mjs'), 'Stripe webhook function is missing.');
assert(exists('netlify/functions/_leizu-payment-common.mjs'), 'Shared payment-record helper is missing.');
assert(intake.includes('name="source"'), 'Intake does not capture source intent.');
assert(intake.includes("params.get('source')"), 'Intake does not map source query parameters.');
assert(intake.includes('hasCourseSelection() && !getProduct(selectedTier.value)'), 'Course selection can still submit without a real payment plan.');
for(const key of ['starter_block', 'term', 'forest_year_upfront', 'forest_year_two', 'forest_year_term', 'forest_year_monthly']){
  assert(intake.includes('data-payment-key="' + key + '"'), 'Intake plan picker is missing ' + key + '.');
}

assert(verifier.includes('claimReference(store, record)'), 'Payment verifier does not atomically claim the intake reference.');
assert(verifier.includes("state:'blocked_duplicate_reference'"), 'Payment verifier does not block duplicate paid sessions for one intake.');
assert(verifier.includes('alreadyBooked:true'), 'Payment verifier does not reject an already-booked payment.');
assert(common.includes('{onlyIfNew:true}'), 'Reference claim is not conditional.');
assert(common.includes('reference_already_claimed'), 'Reference claim does not expose duplicate-intake protection.');

assert(stripe.includes("req.headers.get('stripe-signature')"), 'Stripe webhook does not verify Stripe-Signature.');
assert(stripe.includes('STRIPE_WEBHOOK_SECRET'), 'Stripe webhook is missing STRIPE_WEBHOOK_SECRET.');
assert(stripe.includes('checkout.session.completed'), 'Stripe webhook does not handle checkout.session.completed.');
assert(stripe.includes('checkout.session.async_payment_succeeded'), 'Stripe webhook does not handle delayed-payment completion.');
assert(stripe.includes('{onlyIfNew:true}'), 'Stripe webhook does not deduplicate Stripe events.');
assert(stripe.includes('claimReference(store, record)'), 'Stripe webhook does not enforce one paid session per intake reference.');

assert(cal.includes('bookingReference(payload)'), 'Cal.com webhook does not require a Leizu booking reference.');
assert(cal.includes("store.get('reference/' + reference)"), 'Cal.com webhook does not load the paid payment record.');
assert(cal.includes('referenceRecord.paymentStatus !== \'paid\''), 'Cal.com webhook does not require a paid record.');
assert(cal.includes('paidEmail !== attendeeEmail'), 'Cal.com webhook does not require the attendee email to match Stripe checkout.');
assert(cal.includes("const claimKey = 'booking-claim/' + reference"), 'Cal.com webhook does not claim one booking per paid reference.');
assert(cal.includes('{onlyIfNew:true}'), 'Cal.com webhook does not use atomic duplicate protection.');
assert(before(cal, 'const referenceRecord', 'await sendResendEmail'), 'Cal.com webhook can send Resend before payment-record validation.');
assert(before(cal, 'const claimKey', 'await sendResendEmail'), 'Cal.com webhook can send Resend before claiming the paid booking.');

assert(netlify.includes('from = "/api/stripe-payment-webhook"'), 'Netlify is missing the Stripe webhook route.');
assert(netlify.includes('[functions]'), 'Netlify functions directory is not configured in the [functions] section.');
assert(netlify.includes('publish = "."'), 'Netlify publish directory is not configured under [build].');
assert(env.includes('STRIPE_WEBHOOK_SECRET='), 'Environment example is missing STRIPE_WEBHOOK_SECRET.');
assert(setup.includes('/api/stripe-payment-webhook'), 'Setup guide is missing the Stripe webhook step.');
assert(setup.includes('same email as Stripe Checkout'), 'Setup guide does not document attendee-email matching.');

console.log('=== verify-leizu-pipeline ===');
if(errors.length){
  console.log('ERRORS (' + errors.length + '):');
  errors.forEach(error => console.log('  X ' + error));
  process.exit(1);
}
console.log('PASS — Leizu code-level payment, booking, and confirmation safeguards are wired.');
