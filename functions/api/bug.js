/* Precisa Solutions — bug report handler (Cloudflare Pages Function)
   POST /api/bug  →  validates a bug report, saves it to Supabase (bug_reports),
   and emails a premium alert via Resend. Same SUPABASE_ and RESEND_ vars as the
   other forms. */

import { hasDb, sbInsert } from './_supa.js';
import { emailShell, detailTable, quote } from './_email.js';
import { rateLimit } from './_ratelimit.js';

const MAX = { summary: 160, details: 4000, email: 120, page_url: 300, user_agent: 400 };
const SEVERITY = ['low', 'normal', 'high'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'Invalid request.' }, 400); }

  if (body._hp) return json({ ok: true }); // honeypot

  // Rate limit AFTER the honeypot, so bot traffic caught there costs nothing.
  const rl = await rateLimit(request, env, 'bug');
  if (rl.limited) {
    return json({ ok: false, error: 'Too many submissions from your network. Please try again in a few minutes.' }, 429);
  }

  const bug = {
    summary: clean(body.summary, MAX.summary),
    details: clean(body.details, MAX.details),
    email: clean(body.email, MAX.email),
    page_url: clean(body.page_url, MAX.page_url),
    user_agent: clean(request.headers.get('user-agent') || body.user_agent, MAX.user_agent),
    severity: SEVERITY.indexOf(body.severity) > -1 ? body.severity : 'normal'
  };

  if (!bug.summary) return json({ ok: false, error: 'Please describe the bug.' }, 400);
  if (bug.email && !EMAIL_RE.test(bug.email)) return json({ ok: false, error: 'Enter a valid email or leave it blank.' }, 400);

  const emailConfigured = !!(env.RESEND_API_KEY && env.TO_EMAIL && env.FROM_EMAIL);
  const dbConfigured = hasDb(env);
  if (!emailConfigured && !dbConfigured) {
    return json({ ok: false, error: 'Bug reporting is not configured yet.' }, 500);
  }

  let savedToDb = false;
  if (dbConfigured) {
    try { await sbInsert(env, 'bug_reports', bug); savedToDb = true; }
    catch (e) { console.error('bug insert failed:', e && e.message); }
  }

  if (!emailConfigured) return json({ ok: savedToDb }, savedToDb ? 200 : 500);

  const html = emailShell({
    eyebrow: 'Bug report' + (bug.severity === 'high' ? ' · high severity' : ''),
    title: bug.summary,
    intro: 'Someone reported an issue on your site.',
    contentHtml:
      detailTable([
        ['Severity', bug.severity], ['Page', bug.page_url], ['Reporter', bug.email || 'anonymous'], ['Browser', bug.user_agent]
      ]) +
      quote('Details', bug.details),
    cta: bug.email ? { href: 'mailto:' + bug.email + '?subject=' + encodeURIComponent('About the bug you reported'), label: 'Reply to reporter' } : null,
    theme: bug.severity === 'high' ? 'alert' : 'bug',
    preheader: 'Bug report — ' + bug.summary
  });

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.TO_EMAIL,
      reply_to: bug.email || undefined,
      subject: `Bug report — ${bug.summary}`,
      html
    })
  });

  if (!resendResp.ok) {
    if (savedToDb) return json({ ok: true });
    return json({ ok: false, error: 'Could not submit the report right now. Please try again.' }, 502);
  }
  return json({ ok: true });
}
