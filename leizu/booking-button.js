// === INTAKE + PAYMENT WIRING ===
// Cart "Get started" → intake form with course context
// Tier buttons → Stripe Payment Links (wired by wireTileCtas)

const PAYMENT_LINKS = {
  starter_block:       'https://buy.stripe.com/eVq5kDcZt5kW2KB6iS6oo07',
  term:                'https://buy.stripe.com/fZudR99NhaFg1Gx9v46oo0f',
  forest_year_upfront: 'https://buy.stripe.com/bJe28r6B528K84Vaz86oo0d',
  forest_year_two:     'https://buy.stripe.com/00w28r7F96p0bh79v46oo0b',
  forest_year_term:    'https://buy.stripe.com/5kQ5kDe3x14G98ZbDc6oo0e',
  forest_year_monthly: 'https://buy.stripe.com/5kQdR97F93cObh76iS6oo09',
  donation:            'https://buymeacoffee.com/cyberphunk',
};

function buildBookingHandler(){
  const bookButton = document.querySelector('[data-action="book"]');
  if(!bookButton) return;
  bookButton.addEventListener('click', (e) => {
    e.preventDefault();
    const ids = typeof selected !== 'undefined' ? Array.from(selected) : [];
    const panel = document.getElementById('pricing-panel');
    const priceEl = panel ? panel.querySelector('.total') : null;
    const price = priceEl ? priceEl.textContent.trim() : '';
    const perEl = panel ? panel.querySelector('.per') : null;
    const per = perEl ? perEl.textContent.trim() : '';
    const params = new URLSearchParams();
    if(ids.length) params.set('courses', ids.join(','));
    if(price) params.set('est', price);
    if(per) params.set('per', per);
    const qs = params.toString();
    window.location.href = '/leizu/intake' + (qs ? '?' + qs : '');
  });
}

function wireTileCtas(){
  document.querySelectorAll('a[data-payment-key]').forEach(function(a){
    var u = PAYMENT_LINKS[a.dataset.paymentKey];
    if (!u || u.indexOf('REPLACE') !== -1 || u.indexOf('https://buy.stripe.com/') !== 0) { a.style.display = 'none'; return; }
    a.href = u;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(buildBookingHandler, 100);
  wireTileCtas();
});
wireTileCtas();
