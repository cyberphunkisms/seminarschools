/*
 * Verified Netlify Forms event handler.
 * Paid Leizu intakes do not receive a misleading "booking confirmed" message:
 * the final confirmation is sent only by cal-booking-webhook after Cal.com
 * creates the appointment. Unpaid enquiries continue to receive a receipt.
 */
async function sendResend({to, subject, text}){
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if(!apiKey || !from) throw new Error('RESEND_API_KEY or RESEND_FROM is not configured.');
  const payload = {from, to:[to], subject, text};
  if(process.env.LEIZU_REPLY_TO) payload.reply_to = process.env.LEIZU_REPLY_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{Authorization:'Bearer ' + apiKey, 'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('Resend returned ' + res.status + ': ' + await res.text());
}

function plain(value){ return String(value || '').trim(); }

export default {
  async formSubmitted(event){
    const data = event.data || {};
    const formName = plain(data['form-name'] || data.form_name || event.form?.name);
    const email = plain(data.email);
    if(!email || formName !== 'leizu-intake') return;

    // The secure paid sequence ends with a Cal.com BOOKING_CREATED webhook.
    if(formName === 'leizu-intake' && plain(data['selected-tier'])) return;

    const purpose = plain(data.purpose).toLowerCase();
    const childName = plain(data['student-name']);
    const lead = childName ? ' regarding ' + childName : '';
    let subject = 'We received your Leizu inquiry';
    let body = [
      'Thank you for writing to Leizu Academy' + lead + '.',
      '',
      'I have received your form and will reply with the next step shortly.',
      '',
      'For anything urgent, text 416-771-0382.',
      '',
      'Saul Nassau',
      'Leizu Academy',
      'seminarschools.com/leizu'
    ].join('\n');

    if(purpose === 'portfolio'){
      subject = 'Portfolio intake received — Leizu Academy';
      body = [
        'Thank you for sharing your work with Leizu Academy' + lead + '.', '',
        'I will review the portfolio and follow up with the portfolio rate and next step.', '',
        'Saul Nassau', 'Leizu Academy', 'seminarschools.com/leizu'
      ].join('\n');
    } else if(purpose === 'mulberry'){
      subject = 'We received your Mulberry Fund application — Leizu Academy';
      body = [
        'Thank you for applying to the Mulberry Fund.', '',
        'I will read your letter carefully and follow up within a few days.', '',
        'Saul Nassau', 'Leizu Academy', 'seminarschools.com/leizu'
      ].join('\n');
    } else if(purpose === 'seminar'){
      subject = 'Seminar application received — Leizu Academy';
    }

    try {
      await sendResend({to:email, subject, text:body});
    } catch(error) {
      // Netlify records the verified submission regardless; logging keeps retry
      // diagnostics in Functions logs without blocking form processing.
      console.error('Leizu form receipt failed:', error);
    }
  }
};
