import { getStore } from '@netlify/blobs';

export const PLAN_KEYS = Object.freeze([
  'starter_block',
  'term',
  'forest_year_upfront',
  'forest_year_two',
  'forest_year_term',
  'forest_year_monthly'
]);

const PLAN_LABELS = Object.freeze({
  starter_block: 'Starter block',
  term: 'Term',
  forest_year_upfront: 'Forest Year, up front',
  forest_year_two: 'Forest Year, two payments',
  forest_year_term: 'Forest Year, by term',
  forest_year_monthly: 'Forest Year, monthly'
});

export function json(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}
  });
}

export function parseRecord(raw){
  if(!raw) return null;
  try { return JSON.parse(String(raw)); } catch(error) { return null; }
}

export function safeReference(value){
  return typeof value === 'string' && /^leizu_[A-Za-z0-9_]{12,180}$/.test(value) ? value : null;
}

export function normalizeEmail(value){
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isCompletedAndPaid(session){
  return Boolean(session) && session.status === 'complete' &&
    (session.payment_status === 'paid' || session.payment_status === 'no_payment_required');
}

export function planForPaymentLink(paymentLinkId){
  for(const key of PLAN_KEYS){
    const expected = process.env['STRIPE_PAYMENT_LINK_ID_' + key.toUpperCase()];
    if(expected && expected === paymentLinkId) return key;
  }
  return null;
}

export function calendarUrlFor(planKey){
  const value = process.env['CAL_BOOKING_URL_' + planKey.toUpperCase()];
  if(!value) return null;
  try {
    const url = new URL(value);
    if(url.protocol !== 'https:' || !/(^|\.)cal\.com$/i.test(url.hostname)) return null;
    return url;
  } catch(error) {
    return null;
  }
}

export function makeCalendarUrl(baseCalendar, reference, planKey){
  const url = new URL(baseCalendar.toString());
  const label = PLAN_LABELS[planKey] || planKey;
  url.searchParams.set('notes', 'Leizu booking reference: ' + reference + '\nPlan: ' + label);
  return url.toString();
}

export function getLeizuStore(){
  return getStore({name:'leizu-payment-sessions', consistency:'strong'});
}

export function referenceProjection(record){
  return {
    schema: 2,
    state: record.state,
    sessionId: record.sessionId,
    reference: record.reference,
    planKey: record.planKey,
    customerEmail: record.customerEmail || null,
    paymentStatus: record.paymentStatus || 'paid',
    calendarUrl: record.calendarUrl,
    createdAt: record.createdAt,
    verifiedAt: record.verifiedAt || null,
    bookedAt: record.bookedAt || null,
    bookingUid: record.bookingUid || null
  };
}

/*
 * A client reference is a single-payment entitlement. The first Stripe session
 * to claim it owns its calendar route. A second completed checkout can still be
 * refunded manually, but it cannot unlock another appointment.
 */
export async function claimReference(store, record){
  const key = 'reference/' + record.reference;
  const current = parseRecord(await store.get(key));
  if(current){
    if(current.sessionId === record.sessionId) return {ok:true, record:current, claimed:false};
    return {ok:false, record:current, reason:'reference_already_claimed'};
  }

  const result = await store.set(key, JSON.stringify(referenceProjection(record)), {onlyIfNew:true});
  if(result.modified) return {ok:true, record:referenceProjection(record), claimed:true};

  const raced = parseRecord(await store.get(key));
  if(raced && raced.sessionId === record.sessionId) return {ok:true, record:raced, claimed:false};
  return {ok:false, record:raced, reason:'reference_already_claimed'};
}

export async function writeReference(store, record){
  await store.set('reference/' + record.reference, JSON.stringify(referenceProjection(record)));
}

export async function writeSession(store, record){
  await store.set('session/' + record.sessionId, JSON.stringify(record));
}
