/* Precisa Solutions — shared Supabase helpers for Cloudflare Pages Functions.
   Files whose name starts with "_" are NOT routed by Pages; this is import-only.

   Required environment variables (Cloudflare Pages → Settings → Environment variables):
     SUPABASE_URL                e.g. https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY   secret — bypasses RLS, server-side only, NEVER ship to browser
     SUPABASE_ANON_KEY           public — used as the apikey for auth endpoints
*/

export function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  });
}

export function hasDb(env) {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

// Validate ids taken from the URL before splicing them into a PostgREST filter,
// so a crafted "id" can't inject extra query operators (e.g. &or=(...)).
export function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// The portal is single-admin. ONLY the emails in ADMIN_EMAILS may hold an
// admin session — so even if Supabase signups are open, no other registered
// account can reach the dashboard, leads, or applications.
// FAILS CLOSED: if ADMIN_EMAILS is unset, NOBODY is admin. Set it in
// Cloudflare Pages → Settings → Environment variables (and in .dev.vars
// locally) or the dashboard is unreachable — a loud failure by design.
export function isAllowedAdmin(user, env) {
  const allow = String(env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.length) return false; // fail closed — an unset allowlist unlocks nothing
  return !!(user && user.email && allow.indexOf(user.email.toLowerCase()) > -1);
}

function svcHeaders(env, extra) {
  return Object.assign({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

/* ---- PostgREST data access (service_role, bypasses RLS) ---- */

// Insert one or more rows. Returns the inserted rows.
export async function sbInsert(env, table, row) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: svcHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error(`insert ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// GET rows. `query` is a raw PostgREST query string, e.g. "owner=eq.<id>&order=created_at.desc".
export async function sbSelect(env, table, query) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}` + (query ? '?' + query : '');
  const res = await fetch(url, { headers: svcHeaders(env) });
  if (!res.ok) throw new Error(`select ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function sbUpdate(env, table, query, patch) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: svcHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(`update ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function sbDelete(env, table, query) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: svcHeaders(env)
  });
  if (!res.ok) throw new Error(`delete ${table} failed: ${res.status} ${await res.text()}`);
  return true;
}

// Upsert (insert or update on primary-key conflict).
export async function sbUpsert(env, table, row) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: svcHeaders(env, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error(`upsert ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/* ---- Auth: cookie helpers ---- */

const AT = 'ms_at';   // access token
const RT = 'ms_rt';   // refresh token

export function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('Cookie') || '';
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function cookie(name, value, maxAge) {
  // HttpOnly keeps tokens out of JS; Secure + SameSite=Strict hardens against theft/CSRF.
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function sessionCookies(accessToken, refreshToken, expiresIn) {
  return [
    cookie(AT, accessToken, expiresIn || 3600),
    cookie(RT, refreshToken, 30 * 24 * 60 * 60) // 30 days
  ];
}

export function clearCookies() {
  return [cookie(AT, '', 0), cookie(RT, '', 0)];
}

/* ---- Auth: verify the caller, refreshing the token if needed ---- */
// Low-level session check with NO role gate. Returns { user, setCookies } for
// any valid session, or null. setCookies is a (possibly empty) array of
// Set-Cookie strings the caller must attach to its Response so a refreshed
// token is persisted. Both the admin (authenticate) and client
// (authenticateClient) paths build on this.
export async function verifySession(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const anon = env.SUPABASE_ANON_KEY;

  if (cookies[AT]) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: 'Bearer ' + cookies[AT] }
    });
    if (res.ok) {
      const user = await res.json();
      if (user && user.id) return { user, token: cookies[AT], setCookies: [] };
    }
  }

  // Access token missing/expired → try the refresh token.
  if (cookies[RT]) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: cookies[RT] })
    });
    if (res.ok) {
      const t = await res.json();
      if (t && t.user && t.user.id) {
        return {
          user: t.user,
          token: t.access_token,
          setCookies: sessionCookies(t.access_token, t.refresh_token, t.expires_in)
        };
      }
    }
  }

  return null;
}

/* ---- Two-step sign-in (TOTP: Microsoft/Google Authenticator) ---- */
// Claims of a Supabase access token. Only call this on a token Supabase has
// just accepted (verifySession does), so the payload can be trusted.
export function jwtClaims(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64 + '==='.slice((b64.length + 3) % 4)));
  } catch (e) { return {}; }
}
// Verified authenticator apps on the account (unverified = setup never finished).
export function verifiedFactors(user) {
  return ((user && user.factors) || []).filter((f) => f.status === 'verified' && f.factor_type === 'totp');
}
// True when the account has an authenticator but this session hasn't passed
// the code step yet (Supabase marks passed sessions aal2).
export function mfaPending(user, token) {
  return verifiedFactors(user).length > 0 && jwtClaims(token).aal !== 'aal2';
}

// ADMIN gate. Returns { user, setCookies } for an allowlisted admin session, else null.
// Once an authenticator is turned on, a password-only session is NOT enough:
// the 6-digit code step must have been completed on this session too.
export async function authenticate(context) {
  const auth = await verifySession(context);
  if (!auth) return null;
  if (!isAllowedAdmin(auth.user, context.env)) return null;
  if (mfaPending(auth.user, auth.token)) return null;
  return auth;
}

// CLIENT gate. Returns { user, client, setCookies } when the session belongs to
// a login linked to a clients row, else null. Never applies the admin allowlist.
export async function authenticateClient(context) {
  const auth = await verifySession(context);
  if (!auth) return null;
  let rows;
  try {
    rows = await sbSelect(context.env, 'clients', `auth_user=eq.${auth.user.id}&limit=1`);
  } catch (e) {
    return null;
  }
  const client = rows && rows[0];
  if (!client) return null;
  return { user: auth.user, client, setCookies: auth.setCookies };
}

// Convenience: turn an array of Set-Cookie strings into Headers-append form.
export function withCookies(baseHeaders, setCookies) {
  const h = new Headers(baseHeaders || {});
  (setCookies || []).forEach((c) => h.append('Set-Cookie', c));
  return h;
}

/* ---- Password-reset / invite links ---- */
// Mints a one-time Supabase recovery token for `email` and returns a link to
// OUR reset page carrying it: <origin>/reset-password#token_hash=…&type=recovery
// (or null on failure).
//
// Why not just email Supabase's own action_link?
//  1. action_link bounces through Supabase and only lands back on our site if
//     the Supabase project's Site URL / Redirect URLs are configured exactly
//     right — otherwise it lands on localhost:3000 or the wrong domain.
//  2. The token sits in action_link's query string, so email security scanners
//     (Outlook Safe Links, Gmail, antivirus) that "pre-click" links spend the
//     one-time token before the person does → "link expired".
// Here the token lives in the URL #fragment, which browsers never send to any
// server, and it's only spent when the person submits a new password
// (see functions/api/auth/reset.js).
export async function recoveryLink(env, email, origin) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: svcHeaders(env),
    body: JSON.stringify({ type: 'recovery', email })
  });
  if (!res.ok) {
    console.error('generate_link failed:', res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const data = await res.json();
  const props = data.properties || data;
  const tokenHash = props.hashed_token || data.hashed_token;
  if (!tokenHash) {
    console.error('generate_link returned no hashed_token');
    return null;
  }
  return String(origin).replace(/\/$/, '') + '/reset-password#token_hash=' +
    encodeURIComponent(tokenHash) + '&type=recovery';
}
