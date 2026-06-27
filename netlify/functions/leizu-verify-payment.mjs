import {
  calendarUrlFor,
  claimReference,
  getLeizuStore,
  isCompletedAndPaid,
  json,
  makeCalendarUrl,
  normalizeEmail,
  parseRecord,
  planForPaymentLink,
  safeReference,
  writeReference,
  writeSession
} from './_leizu-payment-common.mjs';

function validSessionId(value){
  return /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(value || '');
}

function customerEmail(session){
  return normalizeEmail((session.customer_details && session.customer_details.email) || session.customer_email || '');
}

export default async function(req){
  if(req.method !== 'GET') return json({error:'Method not allowed'}, 405);

  const sessionId = new URL(req.url).searchParams.get('session_id') || '';
  if(!validSessionId(sessionId)){
    return json({error:'A valid Stripe Checkout Session ID is required.'}, 400);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if(!stripeKey){
    console.error('Leizu payment verification is missing STRIPE_SECRET_KEY.');
    return json({error:'Payment verification is temporarily unavailable.'}, 503);
  }

  let session;
  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
      headers:{Authorization:'Bearer ' + stripeKey}
    });
    if(!stripeResponse.ok){
      console.error('Stripe session lookup failed:', stripeResponse.status, await stripeResponse.text());
      return json({error:'This payment session could not be confirmed.'}, 404);
    }
    session = await stripeResponse.json();
  } catch(error) {
    console.error('Stripe session lookup network error:', error);
    return json({error:'Payment verification is temporarily unavailable.'}, 503);
  }

  if(!isCompletedAndPaid(session)){
    return json({
      error:'Stripe has not confirmed this payment yet.',
      status:session.status,
      payment_status:session.payment_status
    }, 409);
  }

  const planKey = planForPaymentLink(typeof session.payment_link === 'string' ? session.payment_link : null);
  if(!planKey){
    console.error('Stripe session uses an unconfigured Payment Link:', session.payment_link, session.id);
    return json({error:'This payment is valid but its booking route has not been configured.'}, 503);
  }

  const reference = safeReference(session.client_reference_id);
  if(!reference){
    return json({error:'This payment was not connected to a Leizu intake form. Please contact Leizu so your booking can be released safely.'}, 409);
  }

  const baseCalendar = calendarUrlFor(planKey);
  if(!baseCalendar){
    console.error('Calendar URL is missing or invalid for plan:', planKey);
    return json({error:'The booking calendar is temporarily unavailable.'}, 503);
  }

  const store = getLeizuStore();
  const sessionKey = 'session/' + session.id;
  const existing = parseRecord(await store.get(sessionKey));
  if(existing && ['booked', 'booking_claimed'].includes(existing.state)){
    return json({
      error:existing.state === 'booked' ? 'A session has already been booked for this payment.' : 'This payment already has a booking in progress.',
      alreadyBooked:true,
      bookingUid:existing.bookingUid || null
    }, 409);
  }
  if(existing && existing.state === 'blocked_duplicate_reference'){
    return json({error:'This intake reference has already been used for another completed payment. Contact Leizu before booking.'}, 409);
  }

  const now = new Date().toISOString();
  const paidEmail = customerEmail(session) || (existing && existing.customerEmail) || '';
  if(!paidEmail){
    return json({error:'Stripe did not provide the checkout email required to release the booking calendar. Please contact Leizu.'}, 409);
  }
  const record = {
    schema: 3,
    state:'booking_available',
    paymentStatus:'paid',
    sessionId:session.id,
    reference,
    planKey,
    customerEmail:paidEmail,
    calendarUrl:makeCalendarUrl(baseCalendar, reference, planKey, paidEmail),
    createdAt:(existing && existing.createdAt) || now,
    verifiedAt:now,
    bookedAt:null,
    bookingUid:null
  };

  const claim = await claimReference(store, record);
  if(!claim.ok){
    const blocked = {...record, state:'blocked_duplicate_reference', blockedAt:now, conflictingSessionId:claim.record && claim.record.sessionId || null};
    await writeSession(store, blocked);
    console.error('Rejected second completed payment for one Leizu intake reference:', reference, session.id, claim.record && claim.record.sessionId);
    return json({error:'This intake reference has already been used for another completed payment. Contact Leizu before booking.'}, 409);
  }

  const preservedState = existing && ['booking_claimed', 'booked'].includes(existing.state) ? existing.state : record.state;
  const merged = {
    ...record,
    ...existing,
    ...record,
    state:preservedState,
    bookingUid:(existing && existing.bookingUid) || null,
    bookedAt:(existing && existing.bookedAt) || null
  };
  await writeSession(store, merged);
  await writeReference(store, merged);

  if(['booked', 'booking_claimed'].includes(merged.state)){
    return json({
      error:merged.state === 'booked' ? 'A session has already been booked for this payment.' : 'This payment already has a booking in progress.',
      alreadyBooked:true,
      bookingUid:merged.bookingUid || null
    }, 409);
  }

  return json({
    verified:true,
    planKey,
    calendarUrl:merged.calendarUrl,
    customerEmail:merged.customerEmail || null
  });
};
