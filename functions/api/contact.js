/* Precisa Solutions — contact form handler (Cloudflare Pages Function)
   POST /api/contact  →  validates the submission, saves it to Supabase (leads),
   and emails it via Resend. The lead is saved even if email is not configured.
   Required secrets/vars (set in Cloudflare Pages → Settings → Environment variables):
     SUPABASE_URL              your project URL
     SUPABASE_SERVICE_ROLE_KEY secret, from Supabase → Settings → API
     RESEND_API_KEY   secret, from https://resend.com/api-keys
     TO_EMAIL         e.g. info@precisasolutions.ca
     FROM_EMAIL       a verified sender on your Resend domain, e.g. leads@precisasolutions.ca
*/

import { hasDb, sbInsert } from './_supa.js';
import { emailShell, detailTable, quote } from './_email.js';
import { rateLimit } from './_ratelimit.js';

const MAX_LEN = { name: 80, email: 120, company: 80, website: 120, tools: 160, message: 2000 };
const ALLOWED_SYSTEM = [
  '', 'AI phone agent', 'Workflow automation', 'CRM automation',
  'Appointment booking system', 'Dashboard & reporting', 'Website + funnel system',
  'Not sure yet — need guidance'
];
const ALLOWED_BUDGET = ['', 'Under $1,500', '$1,500 – $4,000', '$4,000 – $7,500', '$7,500+', 'Not sure yet'];
const ALLOWED_TIMELINE = ['', 'As soon as possible', 'Within 1–2 months', 'This quarter', 'Just exploring'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  // Honeypot: real visitors never fill this hidden field.
  if (body._hp) return json({ ok: true });

  // Rate limit AFTER the honeypot, so bot traffic caught there costs nothing.
  const rl = await rateLimit(request, env, 'contact');
  if (rl.limited) {
    return json({ ok: false, error: 'Too many submissions from your network. Please try again in a few minutes.' }, 429);
  }

  const name = clean(body.name, MAX_LEN.name);
  const email = clean(body.email, MAX_LEN.email);
  const company = clean(body.company, MAX_LEN.company);
  const website = clean(body.website, MAX_LEN.website);
  const system = ALLOWED_SYSTEM.includes(body.system) ? body.system : '';
  const tools = clean(body.tools, MAX_LEN.tools);
  const budget = ALLOWED_BUDGET.includes(body.budget) ? body.budget : '';
  const timeline = ALLOWED_TIMELINE.includes(body.timeline) ? body.timeline : '';
  const message = clean(body.message, MAX_LEN.message);
  // The Persian site (fa/, brand "Sanjeh") posts the same English field values
  // plus lang: 'fa', so its leads can be told apart in the inbox and dashboard.
  const persian = body.lang === 'fa';

  if (!name || !email || !message) {
    return json({ ok: false, error: 'Name, email, and message are required.' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Enter a valid email address.' }, 400);
  }

  const emailConfigured = !!(env.RESEND_API_KEY && env.TO_EMAIL && env.FROM_EMAIL);
  const dbConfigured = hasDb(env);

  if (!emailConfigured && !dbConfigured) {
    return json({ ok: false, error: 'Contact form is not configured yet. Please email us directly.' }, 500);
  }

  // 1) Save the lead so nothing is ever lost (best-effort — never blocks the email).
  let savedToDb = false;
  if (dbConfigured) {
    try {
      await sbInsert(env, 'contact_leads', {
        name, email, company, website, system, tools, budget, timeline, message,
        source: persian ? 'contact-form-fa' : 'contact-form'
      });
      savedToDb = true;
    } catch (e) {
      console.error('lead insert failed:', e && e.message);
    }
  }

  // 2) Email notification (skipped cleanly if Resend isn't set up).
  if (!emailConfigured) {
    // No email configured, but the lead is in the database.
    return json({ ok: savedToDb }, savedToDb ? 200 : 500);
  }

  const html = emailShell({
    eyebrow: 'New lead',
    title: name + (company ? ' · ' + company : ''),
    intro: 'A new strategy-call request just came in through your ' + (persian ? 'Persian (Sanjeh) site.' : 'site.'),
    contentHtml:
      detailTable([
        ['Name', name], ['Email', email], ['Company', company], ['Website', website],
        ['System', system], ['Tools', tools], ['Budget', budget], ['Timeline', timeline]
      ]) +
      quote('What feels manual or messy', message),
    cta: { href: 'mailto:' + email + '?subject=' + encodeURIComponent(persian ? 'پاسخ به درخواست شما از سنجه' : 'Re: your Precisa Solutions inquiry'), label: 'Reply to ' + name.split(' ')[0] },
    theme: 'lead',
    preheader: (persian ? '[FA] ' : '') + 'New lead — ' + name + (company ? ' (' + company + ')' : '')
  });

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.TO_EMAIL,
      reply_to: email,
      subject: `${persian ? '[FA] ' : ''}New lead — ${name}${company ? ' (' + company + ')' : ''}`,
      html
    })
  });

  if (!resendResp.ok) {
    // Email failed, but if we already saved the lead the request still succeeded.
    if (savedToDb) return json({ ok: true });
    return json({ ok: false, error: 'Could not send your request right now. Please try again or email us directly.' }, 502);
  }

  return json({ ok: true });
}
