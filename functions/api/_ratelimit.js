/* Precisa Solutions — coarse rate limiting for the public forms (contact,
   careers, bug) and the auth endpoints (login, forgot, reset, password).
   Import-only (leading underscore = not routed).

   Uses a Cloudflare KV namespace when one is bound, checked in this order:
     RATE_LIMIT_KV   preferred — bind a dedicated KV namespace under this name
                     (Workers & Pages → KV → Create namespace → bind to this
                     Pages project in BOTH Production and Preview), or
     DISPUTES_KV     reused as a zero-setup fallback (already bound for the
                     Stripe webhook). Keys here are prefixed "rl:" so they can
                     never collide with the webhook's "dispute:" keys.
   If neither is bound, the limiter is a NO-OP — the forms keep working with
   no limit, exactly as before. Nothing breaks if KV is missing.

   KV is eventually consistent across Cloudflare's edge, so treat this as
   abuse control, not a hard guarantee: it stops casual flooding and naive
   spam scripts, not a distributed attacker. For a hard, edge-enforced limit,
   ALSO add a Cloudflare WAF rate-limiting rule on /api/* in the dashboard.

   Window behaviour: every accepted submission refreshes the key's TTL, so an
   IP's counter only fully resets after `windowSeconds` of quiet — a sliding
   window that is slightly stricter than a fixed one. */

function limiterFor(request, env, route, opts) {
  const o = opts || {};
  const kv = env.RATE_LIMIT_KV || env.DISPUTES_KV;
  // Default bucket is the caller's IP. Pass opts.key to bucket by something
  // else instead (e.g. the email being targeted), so an attacker rotating IPs
  // still hits the same counter.
  const who = o.key != null ? String(o.key) : (request.headers.get('CF-Connecting-IP') || 'unknown');
  return {
    kv,
    key: `rl:${route}:${who}`,
    limit: o.limit || 5,                                  // attempts allowed…
    windowSeconds: Math.max(o.windowSeconds || 600, 60)   // …per window (KV TTL minimum is 60s)
  };
}

// Check-and-count in one step: every call uses up one attempt.
export async function rateLimit(request, env, route, opts) {
  if (await isRateLimited(request, env, route, opts)) return { limited: true };
  await recordAttempt(request, env, route, opts);
  return { limited: false };
}

// Check only — does NOT count. Pair with recordAttempt() to count just the
// attempts you care about (e.g. only FAILED logins, so the real owner signing
// in successfully never eats into the budget).
export async function isRateLimited(request, env, route, opts) {
  const l = limiterFor(request, env, route, opts);
  if (!l.kv) return false;
  try {
    const count = parseInt(await l.kv.get(l.key), 10) || 0;
    return count >= l.limit;
  } catch (e) {
    // A KV hiccup must never take the site down — fail open.
    return false;
  }
}

export async function recordAttempt(request, env, route, opts) {
  const l = limiterFor(request, env, route, opts);
  if (!l.kv) return;
  try {
    const count = parseInt(await l.kv.get(l.key), 10) || 0;
    await l.kv.put(l.key, String(count + 1), { expirationTtl: l.windowSeconds });
  } catch (e) { /* fail open */ }
}
