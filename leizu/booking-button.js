// === BOOKING + PAYMENT WIRING ===
// Drop into /leizu/index.html. Replaces the current mailto-based "Book consultation"
// button with a flow that:
//   1. Reads the user's cart (selected courses)
//   2. Maps cart total to the right Stripe Payment Link
//   3. Opens that Payment Link
//   4. After Stripe success, Stripe redirects to /leizu/booking-success which
//      automatically forwards to the Cal.com booking URL
//
// SETUP: After creating Stripe Payment Links and Cal.com event types,
// fill in the URL constants below with the real values.

// =================================================================
// PAYMENT LINK CONSTANTS — REPLACE WITH REAL URLS AFTER STRIPE SETUP
// =================================================================

const PAYMENT_LINKS = {
  // Session bundles (one-time)
  three_sessions:        'https://buy.stripe.com/6oUdR9aRlfZAad3bDc6oo02',    // $300 CAD — 3 sessions, $100 each
  five_sessions:         'https://buy.stripe.com/14A5kD2kP7t470R4aK6oo03',    // $510 CAD — 5 sessions (Pansession)
  seven_sessions:        'https://buy.stripe.com/5kQeVd9Nh3cOfxn22C6oo04',    // $610 CAD — 7 sessions (SeptSession)

  // Forest year (144 contact hours, one-on-one)
  forest_year_upfront:   'https://buy.stripe.com/14A6oHf7B8x82KB4aK6oo01',    // $14,000 CAD upfront
  forest_year_monthly:   'https://buy.stripe.com/9B69AT0cH3cO98ZePo6oo05',    // $1,400/mo CAD recurring

  // Seminar year (144 contact hours, small seminar, gated by 20-40 prior one-on-one sessions)
  seminar_year_upfront:  'https://buy.stripe.com/00w00j3oT28Kfxn6iS6oo00',    // $5,800 CAD upfront
  seminar_year_monthly:  'https://buy.stripe.com/bJe7sLaRlcNo3OFcHg6oo06',    // $600/mo CAD recurring

  // Donation (Mulberry Fund). Routed through Saul's existing Buy Me a Coffee
  // page for now. Donation is NOT in the cart-routing logic — the donate CTA
  // on leizu/index.html links directly to this URL. Replace with a Stripe
  // Payment Link later if/when the Mulberry Fund needs first-party billing.
  donation:              'https://buymeacoffee.com/cyberphunk',
};

// =================================================================
// CAL.COM BOOKING URLS
// =================================================================

const CAL_LINKS = {
  // One Cal.com event type per Stripe product. Keys match PAYMENT_LINKS keys
  // so the success handler can look up the right Cal.com URL by paymentKey.
  three_sessions:        'https://cal.com/seminarschools/weekly3',
  five_sessions:         'https://cal.com/seminarschools/weekly5',
  seven_sessions:        'https://cal.com/seminarschools/weekly7',
  forest_year_upfront:   'https://cal.com/seminarschools/forestyear',
  forest_year_monthly:   'https://cal.com/seminarschools/forestyear',
  seminar_year_upfront:  'https://cal.com/seminarschools/seminaryear',
  seminar_year_monthly:  'https://cal.com/seminarschools/seminaryear',
  donation:              'https://cal.com/seminarschools/class',  // donations fall through to a generic intake
};

// =================================================================
// CART → PAYMENT LINK MAPPING
// =================================================================

/**
 * Returns the PAYMENT_LINKS key that matches the current selection.
 * The key is also used to look up the matching CAL_LINKS URL in the success handler.
 *
 * Year-tier explicit selection takes precedence over cart-count routing.
 *
 *   yearTier='forest', yearMode='upfront'  → 'forest_year_upfront'
 *   yearTier='forest', yearMode='monthly'  → 'forest_year_monthly'
 *   yearTier='seminar', yearMode='upfront' → 'seminar_year_upfront'
 *   yearTier='seminar', yearMode='monthly' → 'seminar_year_monthly'
 *
 *   0 courses                              → null (button disabled)
 *   1 course                               → 'three_sessions'
 *   2-3 courses                            → 'five_sessions'
 *   4+ courses                             → 'seven_sessions'
 *
 * Backward-compatible boolean shape: getPaymentKeyForCart(ids, true) returns
 * 'forest_year_monthly' to preserve the original isForestYear boolean behavior.
 */
function getPaymentKeyForCart(selectedCourseIds, options){
  if(options === true) return 'forest_year_monthly';
  options = options || {};
  const yearTier = options.yearTier;
  const yearMode = options.yearMode || 'monthly';

  if(yearTier === 'forest')  return yearMode === 'upfront' ? 'forest_year_upfront'  : 'forest_year_monthly';
  if(yearTier === 'seminar') return yearMode === 'upfront' ? 'seminar_year_upfront' : 'seminar_year_monthly';

  const n = selectedCourseIds.length;
  if(n === 0) return null;
  if(n === 1) return 'three_sessions';
  if(n <= 3) return 'five_sessions';
  return 'seven_sessions';
}

/**
 * Returns the Stripe Payment Link URL for the current selection.
 * Thin wrapper over getPaymentKeyForCart for backward compatibility.
 */
function getPaymentLinkForCart(selectedCourseIds, options){
  const key = getPaymentKeyForCart(selectedCourseIds, options);
  return key ? PAYMENT_LINKS[key] : null;
}

/**
 * Build a Cal.com URL for a given paymentKey, with cart notes pre-filled.
 * The paymentKey is whatever getPaymentKeyForCart returned at click time.
 */
function buildCalLink(paymentKey, selectedCourseIds, courseNamesByLang){
  const baseUrl = CAL_LINKS[paymentKey] || CAL_LINKS.three_sessions;
  const courseNames = selectedCourseIds.map(id => (courseNamesByLang && courseNamesByLang[id]) || id).join(', ');
  const notes = `Selected courses: ${courseNames}`;
  return baseUrl + '?notes=' + encodeURIComponent(notes);
}

// =================================================================
// REPLACE EXISTING BOOK-BUTTON HANDLER
// =================================================================

/**
 * Replaces the current mailto-based booking button.
 * Call this in updatePricingPanel() instead of buildBookingMailto().
 */
function buildBookingHandler(){
  const bookButton = document.querySelector('[data-action="book"]');
  if(!bookButton) return;

  // Remove any existing href; we handle clicks manually
  bookButton.removeAttribute('href');

  bookButton.addEventListener('click', (e) => {
    e.preventDefault();
    const selectedCourseIds = Array.from(selected);  // assumes `selected` is a Set in scope
    // ESL-flagged course IDs (if eslSelected is in scope from the parent page)
    const eslCourseIds = (typeof eslSelected !== 'undefined' && eslSelected instanceof Set) ? Array.from(eslSelected) : [];

    // Year-tier detection. Course-id sentinels signal explicit tier selection.
    // Upfront-vs-monthly is set by a separate UI element when present; default to monthly.
    let yearTier = null;
    if(selectedCourseIds.includes('forest-year-flagship'))   yearTier = 'forest';
    else if(selectedCourseIds.includes('seminar-year-flagship')) yearTier = 'seminar';

    // Payment-mode element is optional. If absent, default to monthly.
    let yearMode = 'monthly';
    const modeElement = document.querySelector('[data-year-payment-mode]');
    if(modeElement && modeElement.value === 'upfront') yearMode = 'upfront';

    const options = { yearTier, yearMode };
    const paymentKey = getPaymentKeyForCart(selectedCourseIds, options);
    if(!paymentKey){
      // Empty cart — should not be clickable, but guard anyway
      return;
    }
    const paymentLink = PAYMENT_LINKS[paymentKey];

    // Save the payment key and cart metadata so the success page can route to
    // the matching Cal.com event type and pre-fill notes.
    try {
      localStorage.setItem('leizu-pending-booking', JSON.stringify({
        paymentKey,
        courseIds: selectedCourseIds,
        eslCourseIds: eslCourseIds,
        yearTier,
        yearMode,
        timestamp: Date.now()
      }));
    } catch(e){}

    // Guard: a missing or placeholder Payment Link must never strand the
    // buyer on a raw storage error page. Degrade to the mailto booking flow.
    if(!paymentLink || paymentLink.indexOf('REPLACE') !== -1 || paymentLink.indexOf('https://buy.stripe.com/') !== 0){
      if(typeof window.__leizuOpenPolicyModal === 'function'){ window.__leizuOpenPolicyModal(); }
      else if(typeof buildBookingMailto === 'function'){ window.location.href = buildBookingMailto(); }
      return;
    }
    // Open Stripe Payment Link in same window. After payment, Stripe redirects
    // to /leizu/booking-success which forwards to Cal.com.
    window.location.href = paymentLink;
  });
}

// =================================================================
// BOOKING-SUCCESS PAGE LOGIC (used on /leizu/booking-success/index.html)
// =================================================================
//
// This script runs on the success page after Stripe completes the payment.
// It reads the pending-booking data from localStorage, builds the Cal.com URL,
// and forwards the user to it.

function handleBookingSuccess(){
  let pending = null;
  try {
    const raw = localStorage.getItem('leizu-pending-booking');
    if(raw) pending = JSON.parse(raw);
  } catch(e){}

  if(!pending){
    // No pending booking — direct Stripe payment with no cart context
    // Show a generic "go to Cal.com" button
    return;
  }

  // Look up Cal.com URL by paymentKey. Fall back through legacy fields for
  // any pending records written by older versions of this script.
  let calUrl = CAL_LINKS[pending.paymentKey];
  if(!calUrl){
    if(pending.yearTier === 'forest')         calUrl = CAL_LINKS.forest_year_monthly;
    else if(pending.yearTier === 'seminar')   calUrl = CAL_LINKS.seminar_year_monthly;
    else if(pending.isForestYear === true)    calUrl = CAL_LINKS.forest_year_monthly;
    else                                      calUrl = CAL_LINKS.three_sessions;
  }

  const courseNames = pending.courseIds.join(', ');
  const noteParts = ['Paid courses: ' + courseNames];
  if(pending.yearTier)  noteParts.push('Year tier: ' + pending.yearTier);
  if(pending.yearMode)  noteParts.push('Payment mode: ' + pending.yearMode);
  if(pending.paymentKey) noteParts.push('Product: ' + pending.paymentKey);
  const fullUrl = calUrl + '?notes=' + encodeURIComponent(noteParts.join(' | '));

  try { localStorage.removeItem('leizu-pending-booking'); } catch(e){}

  window.location.href = fullUrl;
}

// =================================================================
// AUTO-INIT
// =================================================================
// On the main /leizu page, wire up the book button.
// On /leizu/booking-success, handle the redirect.

if(document.location.pathname.endsWith('/leizu/booking-success') ||
   document.location.pathname.endsWith('/leizu/booking-success/')){
  // Delay slightly so the user sees the page briefly
  setTimeout(handleBookingSuccess, 1500);
} else {
  // On main /leizu — wire the book button after the page renders
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(buildBookingHandler, 100);  // slight delay to let updatePricingPanel run first
  });
}
