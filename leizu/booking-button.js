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
  // Starter and Term
  starter_block:         'https://buy.stripe.com/eVq5kDcZt5kW2KB6iS6oo07',    // $480 CAD one-off
  term:                  'https://buy.stripe.com/fZudR99NhaFg1Gx9v46oo0f',    // $200 today then $100/mo, ends at 3

  // Forest Year, four payment shapes
  forest_year_upfront:   'https://buy.stripe.com/bJe28r6B528K84Vaz86oo0d',    // $8,400 CAD one-off
  forest_year_two:       'https://buy.stripe.com/00w28r7F96p0bh79v46oo0b',    // $4,700 CAD x2 every 6 months
  forest_year_term:      'https://buy.stripe.com/5kQ5kDe3x14G98ZbDc6oo0e',    // $3,300 CAD x3 every 3 months
  forest_year_monthly:   'https://buy.stripe.com/5kQdR97F93cObh76iS6oo09',    // $900/mo CAD, ends at 12

  // Donation, Mulberry Fund (Buy Me a Coffee for now)
  donation:              'https://buymeacoffee.com/cyberphunk',
};

// NOTE: Cal.com booking URLs live in ONE place now. They are inline in
// /leizu/booking-success/index.html, the only page that uses them. This
// script no longer carries a second copy, which was a silent drift hazard.

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
    // Save Stripe URL so the intake thank-you page can link to it.
    // Route through intake form first. The intake page shows the Stripe link
    // on its thank-you state. After Stripe, booking-success reads localStorage
    // and forwards to Cal.com.
    try { localStorage.setItem('leizu-pending-stripe', paymentLink); } catch(e){}
    window.location.href = '/leizu/intake?tier=' + paymentKey;
  });
}

// =================================================================
// NOTE: The booking-success page runs its OWN inline forwarding logic
// (see /leizu/booking-success/index.html). The previous duplicate handler
// that lived here never executed, because this script is not loaded on that
// page, and has been removed to stop two implementations from drifting apart.
// =================================================================

function wireTileCtas(){
  document.querySelectorAll('a[data-payment-key]').forEach(function(a){
    var key = a.dataset.paymentKey;
    var u = PAYMENT_LINKS[key];
    if (!u || u.indexOf('REPLACE') !== -1 || u.indexOf('https://buy.stripe.com/') !== 0) { a.style.display = 'none'; return; }
    // Route through intake form first, then Stripe after form submission.
    // The intake page reads ?tier= and shows the correct Stripe link on its thank-you state.
    a.href = '/leizu/intake?tier=' + key;
  });
}

// =================================================================
// AUTO-INIT
// =================================================================
// This script loads only on the main /leizu page. Wire the book button and
// tile CTAs after render. The booking-success page is handled by its own
// inline script, not by this file.

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(buildBookingHandler, 100);  // slight delay to let updatePricingPanel run first
  wireTileCtas();
});
wireTileCtas();
