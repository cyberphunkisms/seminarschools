#!/usr/bin/env node
/*
 * Static experience guard for the Leizu public path.
 * It checks the handoffs a visitor can see before account-side services take
 * over. It is intentionally separate from the payment-security guard.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));
const assert = (condition, message) => { if(!condition) errors.push(message); };
const occursBefore = (text, first, second) => text.includes(first) && text.includes(second) && text.indexOf(first) < text.indexOf(second);

const home = read('leizu/index.html');
const intake = read('leizu/intake/index.html');
const handoff = read('leizu/booking-button.js');
const labels = read('leizu/course-labels.js');
const common = read('netlify/functions/_leizu-payment-common.mjs');
const cal = read('netlify/functions/cal-booking-webhook.mjs');
const setup = read('leizu/LEIZU-PIPELINE-SETUP.md');

assert(exists('leizu/course-labels.js'), 'Course-label source is missing.');
for(const name of ['World History', 'IB English A', 'Logic and argument']){
  assert(labels.includes(name), 'Course labels do not include ' + name + '.');
}
assert(home.includes('data-payment-key="starter_block"'), 'Starter block CTA is missing its intake handoff key.');
assert(home.includes('data-payment-key="term"'), 'Term CTA is missing its intake handoff key.');
for(const key of ['forest_year_upfront', 'forest_year_two', 'forest_year_term', 'forest_year_monthly']){
  assert(home.includes(key), 'Forest Year option is missing ' + key + '.');
}
assert(home.includes('https://calendly.com/kyrah0131/leizu'), 'Chinese consultation CTA no longer points to the approved Calendly route.');
assert(home.includes('中文諮詢服務'), 'Chinese consultation CTA label is missing from the public page.');
assert(home.includes('Plan selected in intake'), 'Course selector still implies an unconfigured automatic price.');
assert(home.includes('/leizu/policies/'), 'Home page no longer routes policy details to the canonical policy page.');
assert(home.includes('data-i18n="faq.a7" data-i18n-html'), 'FAQ policy answer cannot preserve the policy link after a language change.');
assert(!home.includes("'faq.a7':'Cancel or reschedule with at least 72 hours"), 'A language dictionary still hard-codes cancellation terms outside the canonical policy page.');

assert(handoff.includes('buildIntakeUrl'), 'Course selector does not build a dedicated intake URL.');
assert(handoff.includes("params.set('courses'"), 'Course selector does not carry standard course IDs into intake.');
assert(handoff.includes("params.set('esl_courses'"), 'Course selector does not carry ESL selections into intake.');
assert(handoff.includes('Choose at least one subject before continuing.'), 'Empty course selection does not provide a visible recovery message.');
assert(!handoff.includes('mailto:'), 'Course selector can still fall through to an email link.');

assert(intake.includes('data-netlify="true"'), 'Leizu intake is not marked for Netlify Forms detection.');
assert(intake.includes('enctype="multipart/form-data"'), 'Leizu intake no longer supports portfolio uploads.');
assert(intake.includes('/leizu/course-labels.js'), 'Intake does not load readable course labels.');
assert(intake.includes('name="selected-course-names"'), 'Intake does not submit readable standard course names.');
assert(intake.includes('name="selected-esl-course-names"'), 'Intake does not submit readable ESL course names.');
assert(intake.includes('id="selection-summary"'), 'Intake does not render a dedicated selection summary.');
assert(intake.includes('id="purpose"'), 'Intake purpose field lacks a unique label target.');
assert(intake.includes('id="native-submit"'), 'Intake has no native submission fallback after a failed AJAX attempt.');
assert(intake.includes('Your form was not sent. Your answers are still here.'), 'Intake error state does not preserve the visitor’s work in its message.');
assert(intake.includes('Continue to secure payment'), 'Paid intake path does not show a deliberate Stripe continuation CTA.');
assert(!/window\.location\.assign\(url\)/.test(intake), 'Intake still redirects to Stripe automatically after submission.');
assert(!/subjects\.value\s*=/.test(intake), 'Intake still writes raw course identifiers into the visible subject field.');

assert(common.includes("url.searchParams.set('email', email)"), 'Calendar handoff does not prefill the paid checkout email.');
assert(common.includes("url.searchParams.set('notes'"), 'Calendar handoff does not carry the protected Leizu booking reference.');
assert(cal.includes('payload.responses') && cal.includes('payload.bookingFieldsResponses'), 'Cal.com booking reference reader is too narrow for common payload shapes.');
assert(occursBefore(cal, "referenceRecord.paymentStatus !== 'paid'", 'await sendResendEmail'), 'Cal.com can email before validating the paid record.');
assert(occursBefore(cal, 'paidEmail !== attendeeEmail', 'await sendResendEmail'), 'Cal.com can email before verifying that checkout and attendee emails match.');
assert(setup.includes('pre-fills the Stripe Checkout email') && setup.includes('same email'), 'Setup guide does not explain the email-prefilled Cal.com booking step.');

console.log('=== verify-leizu-experience ===');
if(errors.length){
  console.log('ERRORS (' + errors.length + '):');
  errors.forEach(error => console.log('  X ' + error));
  process.exit(1);
}
console.log('PASS — Leizu public choices, intake context, payment handoff, and booking confirmation safeguards are wired.');
