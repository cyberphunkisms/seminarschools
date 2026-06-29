#!/usr/bin/env node
/*
 * Configures every live Leizu Stripe Payment Link to redirect through the
 * verified booking-success page and prints the Payment Link IDs required by
 * the Netlify function. Run with a Stripe secret key in the matching mode.
 *
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/configure-leizu-stripe-payment-links.mjs
 *   DRY_RUN=1 STRIPE_SECRET_KEY=sk_test_... node scripts/configure-leizu-stripe-payment-links.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { products } = require('../leizu/payment-config.js');

const secret = process.env.STRIPE_SECRET_KEY;
const origin = String(process.env.LEIZU_SITE_ORIGIN || 'https://seminarschools.com').replace(/\/$/, '');
const dryRun = process.env.DRY_RUN === '1';
const successUrl = origin + '/leizu/booking-success/?session_id={CHECKOUT_SESSION_ID}';

if(!secret){
  console.error('STRIPE_SECRET_KEY is required. Use a test or live key that matches the links you want to configure.');
  process.exit(1);
}

async function stripe(path, options = {}){
  const response = await fetch('https://api.stripe.com' + path, {
    ...options,
    headers:{Authorization:'Bearer ' + secret, ...(options.headers || {})}
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch(e) { body = text; }
  if(!response.ok) throw new Error('Stripe ' + response.status + ': ' + (typeof body === 'string' ? body : JSON.stringify(body)));
  return body;
}

async function allPaymentLinks(){
  const output = [];
  let startingAfter = null;
  do {
    const query = new URLSearchParams({limit:'100'});
    if(startingAfter) query.set('starting_after', startingAfter);
    const page = await stripe('/v1/payment_links?' + query.toString());
    output.push(...(page.data || []));
    startingAfter = page.has_more && page.data && page.data.length ? page.data[page.data.length - 1].id : null;
  } while(startingAfter);
  return output;
}

const links = await allPaymentLinks();
const byUrl = new Map(links.map(function(link){ return [String(link.url || '').replace(/\?.*$/, ''), link]; }));
const found = [];
const missing = [];

for(const [key, product] of Object.entries(products)){
  const link = byUrl.get(product.paymentLink.replace(/\?.*$/, ''));
  if(!link){
    missing.push(key);
    continue;
  }
  found.push([key, link]);
}

if(missing.length){
  console.error('The Stripe account does not contain these configured Payment Link URLs: ' + missing.join(', '));
  process.exit(1);
}

console.log((dryRun ? 'DRY RUN — ' : '') + 'Stripe redirect target: ' + successUrl);
for(const [key, link] of found){
  if(!dryRun){
    const body = new URLSearchParams();
    body.set('after_completion[type]', 'redirect');
    body.set('after_completion[redirect][url]', successUrl);
    await stripe('/v1/payment_links/' + encodeURIComponent(link.id), {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:body.toString()
    });
  }
  console.log('STRIPE_PAYMENT_LINK_ID_' + key.toUpperCase() + '=' + link.id);
}

console.log('\nCopy the six lines above into Netlify environment variables, then deploy the site.');
