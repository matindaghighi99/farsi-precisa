/* Precisa Solutions — safety net for every /api/* Function.
   If a Function throws instead of answering (usually a Supabase problem), turn
   the bare "500" into JSON that says what's actually wrong, so the dashboard
   can show it. The full error always goes to Cloudflare's Functions logs. */

// Find settings containing characters that can't go in an HTTP header. Reports
// the setting's name, the position and what the character is — never the value.
function badSettings(env) {
  const out = [];
  for (const k of Object.keys(env || {})) {
    const v = env[k];
    if (typeof v !== 'string') continue;
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i);
      if (c < 32 || c === 127 || c > 126) {
        const what = c === 10 || c === 13 ? 'a line break' : c === 32 ? 'a space' : c === 9 ? 'a tab'
          : c === 0x2022 || c === 0x25CF || c === 0x2026 ? 'a \u201C' + v[i] + '\u201D (you copied the hidden/shortened version of the key)'
          : 'the character \u201C' + v[i] + '\u201D';
        out.push(k + ' has ' + what + ' at position ' + (i + 1) + ' of ' + v.length);
        break;
      }
    }
  }
  return out;
}

function explain(msg) {
  const m = String(msg || '');
  let t = m.match(/Could not find the table '(?:public\.)?([\w]+)'/) || m.match(/relation "(?:public\.)?([\w]+)" does not exist/);
  if (t || /PGRST205|42P01/.test(m)) {
    return 'The ' + (t ? t[1] + ' ' : '') + 'table doesn\u2019t exist in Supabase yet. Run supabase/schema.sql in the Supabase SQL Editor (safe to re-run).';
  }
  t = m.match(/Could not find the '([\w]+)' column of '([\w]+)'/);
  let col = t ? t[1] : null, table = t ? t[2] : null;
  if (!t) {
    t = m.match(/column \\?"?(\w+)\.(\w+)\\?"? does not exist/) || m.match(/column \\?"?(\w+)\\?"? of relation \\?"?(\w+)\\?"? does not exist/);
    if (t) { if (/of relation/.test(t[0])) { col = t[1]; table = t[2]; } else { table = t[1]; col = t[2]; } }
  }
  if (t || /PGRST204|42703/.test(m)) {
    // schema.sql adds late columns to clients/applications; any other table with
    // a missing column is almost always an older table that shares the name.
    if (!table || table === 'clients' || table === 'applications') {
      return 'A database column is missing' + (col ? ' (' + (table ? table + '.' : '') + col + ')' : '') + '. Run supabase/schema.sql again in Supabase \u2014 it only adds what\u2019s missing.';
    }
    return 'The ' + table + ' table in Supabase has no "' + col + '" column \u2014 it\u2019s an older, different table with the same name, so supabase/schema.sql skipped it.';
  }
  t = m.match(/permission denied for (?:table|relation) "?([\w]+)"?/);
  if (t || /42501/.test(m)) {
    return 'Supabase refused access to the ' + (t ? t[1] + ' ' : '') + 'table. Run supabase/schema.sql again in Supabase (it grants the server access).';
  }
  t = m.match(/null value in column \\?"?([\w]+)\\?"? (?:of relation \\?"?([\w]+)\\?"? )?violates not-null/);
  if (t) {
    return 'The ' + (t[2] || 'database') + ' table in Supabase requires a column "' + t[1] + '" this site doesn\u2019t use \u2014 it looks like an older, different table with the same name.';
  }
  if (/failed: 401|Invalid API key|No API key|JWSError|invalid JWT/i.test(m)) {
    return 'Supabase rejected SUPABASE_SERVICE_ROLE_KEY. Re-copy the service_role (secret) key into Cloudflare \u2192 precisa \u2192 Settings \u2192 Variables and secrets, then Retry deployment.';
  }
  if (/Invalid header value|invalid header|ByteString|character at index/i.test(m)) {
    return 'A key saved in Cloudflare contains a character that isn\u2019t allowed (usually a line break or \u201C\u2026\u201D from copying). Re-paste SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY in Cloudflare \u2192 precisa \u2192 Settings \u2192 Variables and secrets, then Retry deployment.';
  }
  if (/fetch failed|ENOTFOUND|Invalid URL|Failed to parse URL/i.test(m)) {
    return 'Couldn\u2019t reach Supabase. Check SUPABASE_URL in Cloudflare.';
  }
  return null;
}

// Supabase's own error text (message + code) from a thrown error such as
// 'select tasks failed: 400 {"code":"42703","message":"…"}'. It names tables
// and columns only — never keys or data.
function supabaseMessage(msg) {
  const m = String(msg || '');
  const i = m.indexOf('{');
  if (i > -1) {
    try {
      const j = JSON.parse(m.slice(i));
      const text = [j.message || j.msg || j.error, j.code && '(' + j.code + ')'].filter(Boolean).join(' ');
      if (text) return (m.slice(0, i).trim() + ' \u2014 ' + text).slice(0, 240);
    } catch (e) { /* not JSON */ }
  }
  return m.replace(/(apikey|authorization|bearer)\s*\S*/gi, '').slice(0, 160);
}

// Settings pasted into Cloudflare often carry a trailing space or line break,
// which makes every Supabase request fail with "Invalid header value".
// Trim them once per request before any Function reads them.
function tidyEnv(env) {
  if (!env) return;
  for (const k of Object.keys(env)) {
    const v = env[k];
    if (typeof v === 'string' && v !== v.trim()) {
      try { env[k] = v.trim(); } catch (e) { /* read-only binding: leave it */ }
    }
  }
}

export async function onRequest(context) {
  tidyEnv(context.env);
  try {
    return await context.next();
  } catch (e) {
    const path = new URL(context.request.url).pathname;
    console.error('Unhandled error in ' + path + ':', e && (e.stack || e.message));
    const msg = e && e.message;
    if (/Invalid header value|invalid header|ByteString|character at index/i.test(String(msg))) {
      const bad = badSettings(context.env).filter((x) => /KEY|URL|SECRET|TOKEN/.test(x));
      if (bad.length) {
        return new Response(JSON.stringify({ ok: false, error: bad.join('; ') + '. In Supabase click Reveal, then the copy button next to the key, paste it into Cloudflare \u2192 precisa \u2192 Settings \u2192 Variables and secrets, and Retry deployment.' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      }
    }
    return new Response(JSON.stringify({
      ok: false,
      error: explain(msg) || ('Server error on ' + path + ': ' + (supabaseMessage(msg) || 'see Cloudflare \u2192 Functions \u2192 Real-time logs'))
    }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
}
