#!/usr/bin/env node
/*
 * Static contract test for the Leizu intake → Stripe → Cal.com → Resend flow.
 * It validates source-of-truth links and required source files. Live account
 * credentials are deliberately tested by the deployment checklist, not here.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
function read(relative){ return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function exists(relative){ return fs.existsSync(path.join(ROOT, relative)); }
function assert(condition, message){ if(!condition) errors.push(message); }
function requireConfig(){
  const code = read('leizu/payment-config.js');
  const sandbox = {globalThis:{}};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.globalThis.LEIZU_PAYMENT_CONFIG;
}
function pageKeys(relative){
  const keys = [];
  const re = /data-payment-key="([^"]+)"/g;
  const html = read(relative);
  let match;
  while((match = re.exec(html))) keys.push(match[1]);
  return keys;
}

const config = requireConfig();
assert(config && config.products, 'Could not load LEIZU_PAYMENT_CONFIG.');
const products = config ? config.products : {};
const keys = Object.keys(products);
const isStripeLink = value => typeof value === 'string' && /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(value);

for(const key of keys){
  const product = products[key];
  assert(isStripeLink(product.paymentLink), 'Invalid Stripe Payment Link for ' + key + '.');
  assert(typeof product.label === 'string' && product.label.length > 0, 'Missing label for ' + key + '.');
  assert(typeof product.purpose === 'string' && product.purpose.length > 0, 'Missing intake purpose for ' + key + '.');
}
assert(new Set(keys.map(key => products[key].paymentLink)).size === keys.length, 'Payment links must be unique across products.');

function dynamicYearKeys(relative){
  const html = read(relative);
  const output = [];
  const re = /key\s*:\s*["'](forest_year_[a-z]+)["']/g;
  let match;
  while((match = re.exec(html))) output.push(match[1]);
  return output;
}

const usedKeys = new Set([
  ...pageKeys('leizu/index.html'),
  ...pageKeys('leizu/intake/index.html'),
  ...dynamicYearKeys('leizu/index.html')
]);
for(const key of usedKeys){ assert(products[key], 'A page references unknown payment key: ' + key); }
for(const key of keys){
  if(!usedKeys.has(key)) warnings.push('Configured payment key has no reachable CTA or payment mode: ' + key);
}

const intake = read('leizu/intake/index.html');
for(const field of ['intake-id', 'selected-tier', 'selected-course-ids', 'selected-esl-course-ids']){
  assert(intake.includes('name="' + field + '"'), 'Intake form is missing capture field: ' + field);
}
assert(intake.includes('client_reference_id'), 'Intake form does not attach client_reference_id to Stripe.');
assert(!intake.includes('leizu-pending-tier'), 'Intake still trusts stale localStorage tier state.');
assert(!/https:\/\/buy\.stripe\.com\//.test(intake), 'Intake has a duplicate Stripe-link map; use payment-config.js only.');

const success = read('leizu/booking-success/index.html');
assert(success.includes('/api/leizu-verify-payment'), 'Booking success page does not verify Stripe server-side.');
assert(!success.includes('CAL_LINKS'), 'Booking success page must not contain public calendar routing.');
assert(!success.includes('localStorage'), 'Booking success page still trusts browser storage.');

const button = read('leizu/booking-button.js');
assert(button.includes('buildIntakeUrl'), 'Course selection does not route through intake.');
assert(!button.includes('localStorage'), 'Booking button still stores payment choices in browser storage.');
assert(button.includes("'forest_year_' + mode"), 'Forest payment modes are not routed dynamically.');

for(const file of [
  'netlify/functions/leizu-verify-payment.mjs',
  'netlify/functions/cal-booking-webhook.mjs',
  'netlify/functions/leizu-form-events.mjs',
  'scripts/configure-leizu-stripe-payment-links.mjs',
  'scripts/verify-leizu-pipeline.js',
  'leizu/LEIZU-PIPELINE-SETUP.md'
]) assert(exists(file), 'Missing pipeline file: ' + file);
assert(!exists('netlify/functions/submission-created.js'), 'Deprecated HTTP form handler still exists.');

const verifyFunction = read('netlify/functions/leizu-verify-payment.mjs');
const paymentCommon = read('netlify/functions/_leizu-payment-common.mjs');
assert(verifyFunction.includes('STRIPE_SECRET_KEY'), 'Stripe verification function is missing server secret use.');
assert(verifyFunction.includes('planForPaymentLink'), 'Stripe verification function does not map a session to a known plan.');
assert(paymentCommon.includes('STRIPE_PAYMENT_LINK_ID_'), 'Shared payment helper does not map a session to a known plan.');
assert(verifyFunction.includes('calendarUrlFor'), 'Stripe verification function does not use server-only Cal.com URLs.');
assert(paymentCommon.includes('CAL_BOOKING_URL_'), 'Shared payment helper does not use server-only Cal.com URLs.');
assert(verifyFunction.includes('claimReference'), 'Stripe verification function does not protect the intake reference atomically.');
assert(paymentCommon.includes('{onlyIfNew:true}'), 'Shared payment helper does not protect the payment session record atomically.');

const calWebhook = read('netlify/functions/cal-booking-webhook.mjs');
assert(calWebhook.includes('x-cal-signature-256'), 'Cal.com webhook signature header is not verified.');
assert(calWebhook.includes('BOOKING_CREATED'), 'Cal.com webhook does not filter for booked appointments.');
assert(calWebhook.includes('RESEND_API_KEY'), 'Cal.com webhook does not send through Resend.');
assert(calWebhook.includes('onlyIfNew'), 'Cal.com webhook does not deduplicate webhook retries.');

const formEvents = read('netlify/functions/leizu-form-events.mjs');
assert(formEvents.includes('formSubmitted'), 'Netlify Forms event handler is missing formSubmitted.');
assert(formEvents.includes("plain(data['selected-tier'])"), 'Form receipt handler can still mislabel paid intake as booked.');

const netlify = read('netlify.toml');
assert(netlify.includes('/api/leizu-verify-payment'), 'Netlify redirect for payment verification is missing.');
assert(netlify.includes('/api/cal-booking-webhook'), 'Netlify redirect for Cal.com webhook is missing.');
assert(netlify.includes('/api/stripe-payment-webhook'), 'Netlify redirect for Stripe webhook is missing.');

console.log('=== verify-payments ===');
console.log('  · payment plans: ' + keys.length + ' (' + keys.join(', ') + ')');
console.log('  · static CTAs: ' + [...usedKeys].length + ' (' + [...usedKeys].join(', ') + ')');
if(warnings.length){
  console.log('\nWARNINGS (' + warnings.length + '):');
  warnings.forEach(item => console.log('  ! ' + item));
}
if(errors.length){
  console.log('\nERRORS (' + errors.length + '):');
  errors.forEach(item => console.log('  X ' + item));
  process.exit(1);
}
console.log('\nPASS — static payment and booking contract is intact.');
