// netlify/functions/submission-created.js
//
// Auto-reply email on Netlify form submission.
// Fires automatically on every form submit (Netlify event-triggered function).
// Reads RESEND_API_KEY from environment. Sends tailored confirmation via Resend.
//
// Supported forms: leizu-intake, leizu-application
// Tailors reply based on the "purpose" field value.

exports.handler = async function (event) {
  var payload;
  try {
    payload = JSON.parse(event.body).payload;
  } catch (e) {
    return { statusCode: 400, body: 'Bad payload' };
  }

  var formName = payload.form_name || '';
  var data = payload.data || {};
  var email = data.email;

  // Only reply to forms we care about
  if (!email || (formName !== 'leizu-intake' && formName !== 'leizu-application')) {
    return { statusCode: 200, body: 'Skipped: no email or unrecognized form' };
  }

  var purpose = (data.purpose || '').toLowerCase();
  var childName = data['student-name'] || '';
  var greeting = childName ? ('Re: ' + childName) : 'Your inquiry';

  // Pick the right reply
  var subject;
  var body;

  if (purpose === 'mulberry') {
    subject = 'We received your application — Leizu Scholars';
    body = [
      'Thank you for applying to Leizu Scholars.',
      '',
      'We will read your letter carefully and get back to you within a few days. The program waives tuition but nothing else changes about how we work together.',
      '',
      'If you have any questions in the meantime, reply to this email or text us at 416-771-0382.',
      '',
      'Saul Nassau',
      'Leizu Academy',
      'seminarschools.com/leizu'
    ].join('\n');
  } else if (purpose === 'seminar') {
    subject = 'Seminar application received — Leizu Academy';
    body = [
      'Thank you for applying to the Seminar year.',
      '',
      'We will look over your application and follow up within a week to talk about next steps.',
      '',
      'If you have any questions, reply to this email or text us at 416-771-0382.',
      '',
      'Saul Nassau',
      'Leizu Academy',
      'seminarschools.com/leizu'
    ].join('\n');
  } else if (purpose === 'question') {
    subject = 'Got your message — Leizu Academy';
    body = [
      'Thank you for reaching out.',
      '',
      'We will get back to you within 24 hours. If it is urgent, text 416-771-0382 and we will reply faster.',
      '',
      'Saul Nassau',
      'Leizu Academy',
      'seminarschools.com/leizu'
    ].join('\n');
  } else if (purpose === 'forest') {
    subject = 'Forest Year inquiry received — Leizu Academy';
    body = [
      'Thank you for your interest in the Forest Year.',
      '',
      'We will follow up within 24 hours to discuss scheduling and how the year works. In the meantime, if you have questions, reply to this email or text us at 416-771-0382.',
      '',
      'Saul Nassau',
      'Leizu Academy',
      'seminarschools.com/leizu'
    ].join('\n');
  } else {
    // starter, term, booking, or anything else = tutoring confirmation
    subject = 'Booking received — Leizu Academy';
    body = [
      'Thank you for signing up.',
      '',
      'Your session will be confirmed and send a calendar invite within 24 hours. Sessions run on Google Meet and the link comes with the invite.',
      '',
      'If you have any questions before we start, reply to this email or text us at 416-771-0382.',
      '',
      'Saul Nassau',
      'Leizu Academy',
      'seminarschools.com/leizu'
    ].join('\n');
  }

  // Send via Resend
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return { statusCode: 500, body: 'Email service not configured' };
  }

  try {
    var res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Leizu Academy <noreply@seminarschools.com>',
        to: [email],
        reply_to: 'saulnassau@protonmail.com',
        subject: subject,
        text: body
      })
    });

    if (!res.ok) {
      var err = await res.text();
      console.error('Resend error:', res.status, err);
      return { statusCode: 200, body: 'Email send failed but form saved' };
    }

    return { statusCode: 200, body: 'Confirmation sent to ' + email };
  } catch (e) {
    console.error('Resend fetch error:', e.message);
    return { statusCode: 200, body: 'Email send failed but form saved' };
  }
};
