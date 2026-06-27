import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  getLeizuStore,
  normalizeEmail,
  parseRecord,
  writeReference,
  writeSession
} from './_leizu-payment-common.mjs';

function response(text, status = 200){
  return new Response(text, {status, headers:{'Cache-Control':'no-store'}});
}

function verifySignature(rawBody, received, secret){
  if(!received || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const actual = String(received).replace(/^sha256=/i, '').trim();
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  return actualBuffer.length === expectedBuffer.length && actualBuffer.length > 0 && timingSafeEqual(actualBuffer, expectedBuffer);
}

function firstAttendee(payload){
  return Array.isArray(payload.attendees) && payload.attendees.length ? payload.attendees[0] : null;
}

function friendlyTime(iso, timezone){
  if(!iso) return 'the time selected in your calendar invitation';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:timezone || 'America/Toronto', timeZoneName:'short'
    }).format(new Date(iso));
  } catch(error) {
    return iso;
  }
}

function bookingReference(payload){
  const text = [payload.additionalNotes, payload.description, payload.notes].filter(Boolean).join('\n');
  const match = text.match(/Leizu booking reference:\s*(leizu_[A-Za-z0-9_]{12,180})/i);
  return match ? match[1] : null;
}

function emailIdempotencyKey(bookingUid){
  return ('leizu_booking_' + String(bookingUid).replace(/[^A-Za-z0-9_]/g, '_')).slice(0, 240);
}

async function sendResendEmail({to, name, payload, bookingUid}){
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if(!apiKey || !from) throw new Error('RESEND_API_KEY or RESEND_FROM is not configured.');

  const timezone = (firstAttendee(payload) || {}).timeZone || 'America/Toronto';
  const when = friendlyTime(payload.startTime, timezone);
  const meetingUrl = (payload.metadata && payload.metadata.videoCallUrl) || payload.videoCallUrl || null;
  const location = payload.location || (meetingUrl ? 'Google Meet' : 'the location in your calendar invitation');
  const greeting = name ? 'Hello ' + name + ',' : 'Hello,';
  const lines = [
    greeting,
    '',
    'Your Leizu session is booked for ' + when + '.',
    'Location: ' + location + '.',
    meetingUrl ? 'Join link: ' + meetingUrl : 'Your calendar invitation contains the meeting details.',
    '',
    'Your calendar invitation includes the current meeting details and any rescheduling options.',
    '',
    'Saul Nassau',
    'Leizu Academy',
    'seminarschools.com/leizu'
  ];

  const body = {from, to:[to], subject:'Your Leizu session is booked', text:lines.join('\n')};
  if(process.env.LEIZU_REPLY_TO) body.reply_to = process.env.LEIZU_REPLY_TO;

  const result = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{
      Authorization:'Bearer ' + apiKey,
      'Content-Type':'application/json',
      'Idempotency-Key':emailIdempotencyKey(bookingUid)
    },
    body:JSON.stringify(body)
  });
  if(!result.ok) throw new Error('Resend returned ' + result.status + ': ' + await result.text());
}

export default async function(req){
  if(req.method !== 'POST') return response('Method not allowed', 405);

  const rawBody = await req.text();
  const secret = process.env.CAL_WEBHOOK_SECRET;
  const signature = req.headers.get('x-cal-signature-256');
  if(!verifySignature(rawBody, signature, secret)){
    console.error('Rejected Cal.com webhook with an invalid or missing signature.');
    return response('Unauthorized', 401);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch(error) { return response('Malformed JSON', 400); }
  if(event.triggerEvent !== 'BOOKING_CREATED') return response('Ignored', 200);

  const payload = event.payload || {};
  const attendee = firstAttendee(payload);
  const attendeeEmail = normalizeEmail(attendee && attendee.email);
  const bookingUid = String(payload.uid || payload.bookingUid || '');
  const reference = bookingReference(payload);
  if(!attendeeEmail) return response('Missing attendee email', 422);
  if(!bookingUid) return response('Missing booking UID', 422);
  if(!reference){
    console.error('Ignored Cal.com booking without a Leizu payment reference:', bookingUid);
    return response('Unlinked booking ignored', 403);
  }

  const store = getLeizuStore();
  const referenceRecord = parseRecord(await store.get('reference/' + reference));
  if(!referenceRecord || !referenceRecord.sessionId || referenceRecord.paymentStatus !== 'paid'){
    console.error('Ignored Cal.com booking without a verified Leizu payment record:', bookingUid, reference);
    return response('Verified payment required', 403);
  }

  const sessionRecord = parseRecord(await store.get('session/' + referenceRecord.sessionId));
  if(!sessionRecord || sessionRecord.reference !== reference || sessionRecord.paymentStatus !== 'paid'){
    console.error('Ignored Cal.com booking with an inconsistent Leizu payment record:', bookingUid, reference);
    return response('Verified payment required', 403);
  }

  const paidEmail = normalizeEmail(sessionRecord.customerEmail || referenceRecord.customerEmail);
  if(!paidEmail || paidEmail !== attendeeEmail){
    console.error('Ignored Cal.com booking whose attendee email does not match the verified payment:', bookingUid, reference);
    return response('Attendee email must match the paid checkout email', 403);
  }

  const claimKey = 'booking-claim/' + reference;
  let existingClaim = parseRecord(await store.get(claimKey));
  if(existingClaim){
    if(existingClaim.bookingUid !== bookingUid){
      console.error('Rejected second Cal.com booking for one paid Leizu session:', reference, bookingUid, existingClaim.bookingUid);
      return response('A payment can confirm one booking only', 409);
    }
    if(existingClaim.state === 'booked') return response('Duplicate booking webhook ignored', 200);
  } else {
    const claim = await store.set(claimKey, JSON.stringify({
      state:'processing', reference, sessionId:sessionRecord.sessionId, bookingUid, attendeeEmail, createdAt:new Date().toISOString()
    }), {onlyIfNew:true});
    if(!claim.modified){
      existingClaim = parseRecord(await store.get(claimKey));
      if(!existingClaim || existingClaim.bookingUid !== bookingUid){
        console.error('Rejected second Cal.com booking for one paid Leizu session:', reference, bookingUid, existingClaim && existingClaim.bookingUid);
        return response('A payment can confirm one booking only', 409);
      }
      if(existingClaim.state === 'booked') return response('Duplicate booking webhook ignored', 200);
    }
  }

  try {
    const claimedRecord = {...sessionRecord, state:'booking_claimed', bookingUid, bookingClaimedAt:new Date().toISOString()};
    await writeSession(store, claimedRecord);
    await writeReference(store, claimedRecord);

    // Resend receives an idempotency key tied to the Cal.com booking UID.
    // Safe retries can therefore finish a partially interrupted webhook without
    // delivering a second confirmation email.
    await sendResendEmail({to:attendeeEmail, name:attendee.name, payload, bookingUid});

    const bookedRecord = {...claimedRecord, state:'booked', bookedAt:new Date().toISOString()};
    await writeSession(store, bookedRecord);
    await writeReference(store, bookedRecord);
    await store.set(claimKey, JSON.stringify({state:'booked', reference, sessionId:bookedRecord.sessionId, bookingUid, attendeeEmail, bookedAt:bookedRecord.bookedAt}));
    await store.set('email/' + bookingUid, JSON.stringify({state:'sent', sentAt:new Date().toISOString(), email:attendeeEmail, bookingUid}));

    return response('Booking confirmation sent', 200);
  } catch(error) {
    console.error('Cal.com booking confirmation error:', error);
    // Keep the claim for the same booking so a retry cannot race a different
    // appointment into this paid entitlement. Resend's idempotency key makes
    // retried delivery safe when the first attempt reached its API.
    return response('Temporary delivery failure', 500);
  }
};
