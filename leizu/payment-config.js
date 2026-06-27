/*
 * Leizu payment catalogue — one public source of truth for every browser path.
 *
 * Payment Links are intentionally public checkout URLs. The server validates the
 * Stripe Checkout Session and routes to Cal.com using server-only identifiers.
 */
(function(root, factory){
  var config = factory();
  if(typeof module !== 'undefined' && module.exports) module.exports = config;
  if(root) root.LEIZU_PAYMENT_CONFIG = config;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  var products = {
    starter_block: {
      paymentLink: 'https://buy.stripe.com/eVq5kDcZt5kW2KB6iS6oo07',
      label: 'Starter block · $480',
      purpose: 'starter'
    },
    term: {
      paymentLink: 'https://buy.stripe.com/fZudR99NhaFg1Gx9v46oo0f',
      label: 'Term · $400 over 3 months',
      purpose: 'term'
    },
    forest_year_upfront: {
      paymentLink: 'https://buy.stripe.com/bJe28r6B528K84Vaz86oo0d',
      label: 'Forest Year · $8,400 up front',
      purpose: 'forest'
    },
    forest_year_two: {
      paymentLink: 'https://buy.stripe.com/00w28r7F96p0bh79v46oo0b',
      label: 'Forest Year · two payments of $4,700',
      purpose: 'forest'
    },
    forest_year_term: {
      paymentLink: 'https://buy.stripe.com/5kQ5kDe3x14G98ZbDc6oo0e',
      label: 'Forest Year · $3,300 per term',
      purpose: 'forest'
    },
    forest_year_monthly: {
      paymentLink: 'https://buy.stripe.com/5kQdR97F93cObh76iS6oo09',
      label: 'Forest Year · $900 per month',
      purpose: 'forest'
    }
  };

  return Object.freeze({
    products: Object.freeze(products),
    getProduct: function(key){ return products[key] || null; },
    isPaymentKey: function(key){ return Object.prototype.hasOwnProperty.call(products, key); }
  });
});
