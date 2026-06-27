import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  calendarUrlFor,
  claimReference,
  getLeizuStore,
  isCompletedAndPaid,
  makeCalendarUrl,
  normalizeEmail,
  parseRecord,
  planForPaymentLink,
  safeReference,
  writeReference,
  writeSession
} from './_leizu-payment-common.mjs';

function response(text, status = 200){
  return new Response(text, {status, headers:{'Cache-Control':'no-store'}});
}

function safeEqualHex(left, right){
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch(error) {
    return false;
  }
}

function verifyStripeSignature(rawBody, header, secret){
  if(!header || !secret) return false;
  const values = new Map();
  String(header).split(',').forEach(function(part){
    const index = part.indexOf('=');
    if(index > 0){
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if(!values.has(key)) values.set(key, []);
      values.get(key).push(value);
    }
  });
  const timestamp = Number((values.get('t') || [])[0]);
  const signatures = values.get('v1') || [];
  if(!Number.isFinite(timestamp) || !signatures.length) return false;
  if(Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(String(timestamp) + '.' + rawBody, 'utf8').digest('hex');
  return signatures.some(function(signature){ return safeEqualHex(expected, signature); });
}

function customerEmail(session){
  return normalizeEmail((session.customer_details && session.customer_details.email) || session.customer_email || '');
}

async function recordPaidCheckout(session){
  if(!isCompletedAndPaid(session)) return {ignored:true, reason:'payment_not_final'};

  const planKey = planForPaymentLink(typeof session.payment_link === 'string' ? session.payment_link : null);
  const reference = safeReference(session.client_reference_id);
  const baseCalendar = planKey ? calendarUrlFor(planKey) : null;
  if(!planKey || !reference || !baseCalendar){
    throw new Error('Paid Checkout Session is missing a configured Leizu plan, intake reference, or calendar route.');
  }

  const store = getLeizuStore();
  const sessionKey = 'session/' + session.id;
  const existing = parseRecord(await store.get(sessionKey));
  if(existing && ['booked', 'booking_claimed'].includes(existing.state)) return {ok:true, existing:true};
  if(existing && existing.state === 'blocked_duplicate_reference') return {ok:true, blocked:true};

  const now = new Date().toISOString();
  const paidEmail = customerEmail(session) || (existing && existing.customerEmail) || '';
  if(!paidEmail){
    throw new Error('Paid Leizu Checkout Session is missing the checkout email required for Cal.com confirmation.');
  }
  const record = {
    schema:3,
    state:'paid',
    paymentStatus:'paid',
    sessionId:session.id,
    reference,
    planKey,
    customerEmail:paidEmail,
    calendarUrl:makeCalendarUrl(baseCalendar, reference, planKey, paidEmail),
    createdAt:(existing && existing.createdAt) || now,
    verifiedAt:null,
    bookedAt:null,
    bookingUid:null,
    stripeWebhookAt:now
  };

  const claim = await claimReference(store, record);
  if(!claim.ok){
    await writeSession(store, {...record, state:'blocked_duplicate_reference', blockedAt:now, conflictingSessionId:claim.record && claim.record.sessionId || null});
    console.error('Stripe webhook rejected duplicate Leizu intake reference:', reference, session.id, claim.record && claim.record.sessionId);
    return {ok:true, blocked:true};
  }

  const merged = {...record, ...existing, ...record, state:(existing && existing.state) || record.state};
  await writeSession(store, merged);
  await writeReference(store, merged);
  return {ok:true};
}

export default async function(req){
  if(req.method !== 'POST') return response('Method not allowed', 405);

  const rawBody = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if(!verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret)){
    console.error('Rejected Stripe webhook with an invalid or missing signature.');
    return response('Unauthorized', 401);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch(error) { return response('Malformed JSON', 400); }
  if(!event.id || !event.type) return response('Malformed Stripe event', 400);
  if(!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return response('Ignored', 200);

  const store = getLeizuStore();
  const eventKey = 'stripe-event/' + String(event.id);
  const claimed = await store.set(eventKey, JSON.stringify({state:'processing', eventType:event.type, createdAt:new Date().toISOString()}), {onlyIfNew:true});
  if(!claimed.modified) return response('Duplicate Stripe webhook ignored', 200);

  try {
    await recordPaidCheckout(event.data && event.data.object || {});
    await store.set(eventKey, JSON.stringify({state:'processed', eventType:event.type, processedAt:new Date().toISOString()}));
    return response('Stripe payment recorded', 200);
  } catch(error) {
    console.error('Stripe payment webhook error:', error);
    await store.delete(eventKey);
    return response('Temporary processing failure', 500);
  }
};
