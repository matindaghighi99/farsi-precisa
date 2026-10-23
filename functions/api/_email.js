/* Precisa Solutions — shared email template (import-only; leading underscore = not routed).
   Every email shares the website's look — navy letterhead, the pixel-P logo,
   blue accents, mono labels — and each kind of email gets its own colour and
   label. Deliberately plain email HTML (tables, solid colours, no web fonts,
   gradients or shadows) so it opens in every mail app, including phone apps. */

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SITE = 'https://precisasolutions.ca';
const LOGO_URL = SITE + '/images/email/precisa-logo.png';
const C = {
  navy: '#071233', navy2: '#0A1A4D', ink: '#0B1530', paper: '#F2F5FB', card: '#FFFFFF',
  border: '#E3E8F2', soft: '#4A5675', mute: '#8590A8', blue: '#2F6BE0'
};
const DISPLAY = "'Bricolage Grotesque', 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif";
const BODY = "'Figtree', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

/* One theme per kind of email: accent colour, light tint, tag. */
const THEMES = {
  lead:     { accent: '#2F6BE0', tint: '#EEF3FD', line: '#C9D9F8', tag: 'New lead' },
  builder:  { accent: '#6D4AFF', tint: '#F2EFFF', line: '#D7CCFF', tag: 'Website builder' },
  sale:     { accent: '#0E9F6E', tint: '#E9F7F1', line: '#B9E5D3', tag: 'New sale' },
  welcome:  { accent: '#2F6BE0', tint: '#EEF3FD', line: '#C9D9F8', tag: 'Welcome' },
  portal:   { accent: '#4F46E5', tint: '#EFEEFD', line: '#CFCCF8', tag: 'Client portal' },
  message:  { accent: '#0B7FB8', tint: '#E8F4FA', line: '#BCDDEE', tag: 'Message' },
  careers:  { accent: '#C2700A', tint: '#FBF2E6', line: '#EED3AE', tag: 'Careers' },
  security: { accent: '#0F8C8A', tint: '#E7F5F4', line: '#B8E0DE', tag: 'Account security' },
  bug:      { accent: '#D9640B', tint: '#FDF0E6', line: '#F3CDAF', tag: 'Bug report' },
  alert:    { accent: '#C8232C', tint: '#FBEAEB', line: '#F0C0C3', tag: 'Action needed' }
};
const LEGACY = { danger: 'alert', amber: 'bug', gold: 'lead' };
function themeOf(opts) { return THEMES[opts.theme] || THEMES[LEGACY[opts.accent]] || THEMES.lead; }

export function button(href, label, theme) {
  const t = typeof theme === 'object' ? theme : THEMES[theme] || THEMES[LEGACY[theme]] || THEMES.lead;
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 4px;"><tr>' +
    '<td bgcolor="' + t.accent + '" style="border-radius:999px;background-color:' + t.accent + ';">' +
    '<a href="' + escapeHtml(href) + '" style="display:inline-block;padding:15px 30px;font-family:' + BODY +
    ';font-size:15px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:999px;">' +
    escapeHtml(label) + '</a></td></tr></table>'
  );
}

// rows: array of [label, value] (value skipped if empty).
export function detailTable(rows) {
  const body = rows.filter((r) => r[1]).map((r) =>
    '<tr>' +
    '<td style="padding:12px 0;border-bottom:1px solid ' + C.border + ';font-family:' + MONO +
    ';font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:' + C.mute +
    ';white-space:nowrap;vertical-align:top;width:124px;">' + escapeHtml(r[0]) + '</td>' +
    // dir="auto": a value typed in Persian (fa/ site) reads right-to-left
    '<td dir="auto" style="padding:12px 0 12px 16px;border-bottom:1px solid ' + C.border + ';font-family:' + BODY +
    ';font-size:14.5px;line-height:1.5;color:' + C.ink + ';vertical-align:top;word-break:break-word;">' + escapeHtml(r[1]) + '</td>' +
    '</tr>'
  ).join('');
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:24px 0 0;">' + body + '</table>';
}

export function quote(label, text) {
  if (!text) return '';
  return (
    '<div style="margin:24px 0 0;">' +
    '<div style="font-family:' + MONO + ';font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:' +
    C.mute + ';margin-bottom:9px;">' + escapeHtml(label) + '</div>' +
    '<div dir="auto" style="font-family:' + BODY + ';font-size:14.5px;line-height:1.7;color:' + C.soft + ';background:' +
    C.paper + ';border:1px solid ' + C.border + ';border-left:3px solid ' + C.blue +
    ';border-radius:12px;padding:15px 17px;white-space:pre-wrap;">' + escapeHtml(text) + '</div></div>'
  );
}

// A big number/word in a tinted panel (e.g. the sale amount).
export function stat(label, value, sub, theme) {
  const t = THEMES[theme] || THEMES.lead;
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr>' +
    '<td bgcolor="' + t.tint + '" style="padding:20px 22px;border-radius:16px;background-color:' + t.tint + ';border:1px solid ' + t.line + ';">' +
    '<div style="font-family:' + MONO + ';font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:' + t.accent + ';">' + escapeHtml(label) + '</div>' +
    '<div style="margin-top:6px;font-family:' + DISPLAY + ';font-size:34px;font-weight:800;letter-spacing:-.02em;color:' + C.ink + ';">' + escapeHtml(value) + '</div>' +
    (sub ? '<div style="margin-top:4px;font-family:' + BODY + ';font-size:13.5px;color:' + C.soft + ';">' + escapeHtml(sub) + '</div>' : '') +
    '</td></tr></table>'
  );
}

// Numbered "what happens next" steps: [[title, text], ...]
export function steps(list, theme) {
  const t = THEMES[theme] || THEMES.lead;
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">' +
    list.map(([title, text], i) =>
      '<tr><td style="vertical-align:top;width:40px;padding:0 0 18px;">' +
      '<div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:' + t.accent + ';color:#fff;text-align:center;font-family:' + DISPLAY + ';font-weight:800;font-size:14px;">' + (i + 1) + '</div></td>' +
      '<td style="vertical-align:top;padding:3px 0 18px 6px;">' +
      '<div style="font-family:' + DISPLAY + ';font-size:16px;font-weight:700;color:' + C.ink + ';">' + escapeHtml(title) + '</div>' +
      '<div style="margin-top:4px;font-family:' + BODY + ';font-size:14.5px;line-height:1.6;color:' + C.soft + ';">' + text + '</div></td></tr>'
    ).join('') + '</table>';
}

// A short signed closing line.
export function signoff(sentence, name, role) {
  return (
    '<div style="margin:30px 0 0;padding:22px 0 0;border-top:1px solid ' + C.border + ';">' +
    '<div style="font-family:' + DISPLAY + ';font-size:18px;line-height:1.45;font-weight:600;color:' + C.ink + ';">' + escapeHtml(sentence) + '</div>' +
    '<div style="margin-top:12px;font-family:' + BODY + ';font-size:14px;color:' + C.soft + ';">— ' + escapeHtml(name) +
    (role ? '<span style="color:' + C.mute + ';">, ' + escapeHtml(role) + '</span>' : '') + '</div></div>'
  );
}

/* opts: { theme:'lead'|'builder'|'sale'|'welcome'|'portal'|'message'|'careers'|'security'|'bug'|'alert',
           eyebrow, title, intro, contentHtml, cta:{href,label}, closingHtml (after the button), preheader, footerNote,
           audience:'team'|'customer' }   (accent:'gold'|'danger'|'amber' still accepted) */
export function emailShell(opts) {
  const t = themeOf(opts);
  const customer = opts.audience === 'customer';
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<meta name="color-scheme" content="light only"/><meta name="supported-color-schemes" content="light"/>' +
    '<style>' +
    'body{margin:0;padding:0;background:' + C.paper + ';}' +
    '@media (max-width:620px){.ps-card{width:100%!important;}.ps-pad{padding-left:24px!important;padding-right:24px!important;}.ps-h1{font-size:25px!important;}.ps-tag{display:none!important;}}</style>' +
    '</head><body style="margin:0;padding:0;background:' + C.paper + ';">' +
    (opts.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + C.paper + ';">' + escapeHtml(opts.preheader) + '</div>' : '') +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' + C.paper + ';padding:32px 12px;"><tr><td align="center">' +
    '<table role="presentation" class="ps-card" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:' + C.card + ';border:1px solid ' + C.border + ';border-radius:22px;overflow:hidden;">' +
    // letterhead: navy, logo + wordmark, tag pill with this email's colour
    '<tr><td bgcolor="' + C.navy + '" style="background-color:' + C.navy + ';padding:24px 36px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td align="left" style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="vertical-align:middle;padding-right:12px;"><a href="' + SITE + '" style="text-decoration:none;"><img src="' + LOGO_URL + '" width="44" height="44" alt="Precisa Solutions" style="display:block;border:0;width:44px;height:44px;border-radius:11px;"/></a></td>' +
    '<td style="vertical-align:middle;font-family:' + DISPLAY + ';font-size:20px;font-weight:700;letter-spacing:-.01em;color:#FFFFFF;">Precisa <span style="color:#8FB4FF;">Solutions</span></td>' +
    '</tr></table></td>' +
    '<td align="right" class="ps-tag" style="vertical-align:middle;"><span style="display:inline-block;padding:7px 12px;border-radius:999px;border:1px solid #2A3A6B;background-color:#0F1E4A;font-family:' + MONO + ';font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#DCE6FF;">' +
    '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:' + t.accent + ';vertical-align:1px;"></span>&nbsp; ' + escapeHtml(t.tag) + '</span></td>' +
    '</tr></table></td></tr>' +
    '<tr><td bgcolor="' + t.accent + '" style="height:4px;line-height:4px;font-size:0;background-color:' + t.accent + ';">&nbsp;</td></tr>' +
    // body
    '<tr><td class="ps-pad" style="padding:36px 40px 18px;">' +
    '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;color:' + t.accent + ';">' + escapeHtml(opts.eyebrow || t.tag) + '</div>' +
    '<h1 class="ps-h1" style="margin:12px 0 0;font-family:' + DISPLAY + ';font-size:29px;line-height:1.12;font-weight:800;letter-spacing:-.02em;color:' + C.ink + ';">' + escapeHtml(opts.title) + '</h1>' +
    (opts.intro ? '<p style="margin:14px 0 0;font-family:' + BODY + ';font-size:15.5px;line-height:1.65;color:' + C.soft + ';">' + escapeHtml(opts.intro) + '</p>' : '') +
    (opts.contentHtml || '') +
    (opts.cta ? button(opts.cta.href, opts.cta.label, t) : '') +
    (opts.closingHtml || '') +
    '</td></tr>' +
    // footer
    '<tr><td class="ps-pad" bgcolor="' + C.paper + '" style="padding:22px 40px 28px;background-color:' + C.paper + ';border-top:1px solid ' + C.border + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="vertical-align:top;font-family:' + BODY + ';font-size:12.5px;line-height:1.7;color:' + C.mute + ';">' +
    '<span style="font-family:' + DISPLAY + ';font-weight:700;color:' + C.ink + ';font-size:13.5px;">Precisa <span style="color:' + C.blue + ';">Solutions</span></span>' +
    ' &nbsp;·&nbsp; Websites &amp; AI automation &nbsp;·&nbsp; Toronto, Ontario<br/>' +
    '<a href="' + SITE + '" style="color:' + C.blue + ';text-decoration:none;">precisasolutions.ca</a>' +
    (customer ? ' &nbsp;·&nbsp; <a href="mailto:info@precisasolutions.ca" style="color:' + C.blue + ';text-decoration:none;">info@precisasolutions.ca</a>' : '') + '<br/>' +
    escapeHtml(opts.footerNote || (customer ? 'Questions? Just reply to this email. A real person reads every one.' : 'Automated notification from your website.')) +
    '</td></tr></table></td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}
