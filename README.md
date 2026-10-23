# رسا (Rasa) — Persian website

The Persian website of Precisa Solutions, for clients in Iran, under its own
brand: **رسا** (clear, far-reaching — a message that gets across). A static site
with two small Cloudflare Pages Functions for its forms. No build step.

## Pages

| File | Page |
| --- | --- |
| `index.html` | home — with the interactive 3D hero |
| `services.html` | services |
| `projects.html` | projects / portfolio |
| `about.html` | about |
| `contact.html` | contact form (the intake console) |

`demo-card.html`, `demo-code.html` and `demo-order.html` are the interaction
concepts `projects.html` shows in frames.

## Deploying

The repository is connected to Cloudflare Pages: a push to `main` deploys.
Project settings: framework preset **None**, no build command, build output
directory **/** (the repository root). `functions/` is picked up automatically.

### Settings for the forms

The contact form (`/api/contact`) and the «گزارش خطا» button (`/api/bug`)
need these in Cloudflare → this project → **Settings → Variables and
secrets** (then redeploy). Use the same values as the main Precisa site so
Persian leads land in the same Supabase table — tagged `contact-form-fa` —
and the same inbox, with `[FA]` in the subject.

| Name | What |
| --- | --- |
| `SUPABASE_URL` | the Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | its service-role (secret) key |
| `RESEND_API_KEY` | Resend API key, for the email notification (optional) |
| `TO_EMAIL` | where notifications go, e.g. `info@precisasolutions.ca` |
| `FROM_EMAIL` | the sender, e.g. `leads@precisasolutions.ca` |

Either Supabase or Resend is enough for the contact form to work. Without
any of them it answers with a polite Persian error. A KV namespace bound as
`RATE_LIMIT_KV` turns on rate limiting (optional; without it, it is off).

For local testing with the functions: copy `.dev.vars.example` to
`.dev.vars`, fill it in, and run `npx wrangler pages dev .`.

## Editing

- **Text** — in the `.html` files; change the Persian between the tags.
- **Persian look and right-to-left layout** — `assets/fa.css` (fonts, sizes,
  spacing, mirrored rules).
- **The home page hero** — its text, including the sample clinic site in the
  browser and on the phone, is in `index.html`. Styles:
  `assets/rasa-hero.css`; behaviour (the 3D scene, the layers view and the
  working phone): `assets/rasa-hero.js`.
- **Logo** — `images/rasa-mark.svg`; favicons `images/rasa-favicon-*.png`
  and `favicon.ico`.
- After changing any CSS or JS, run `node stamp-assets.mjs` so browsers pick
  up the new version (it updates the `?v=…` on every reference).
- There are no inline scripts — the security policy (in `_headers` and in
  each page's `<meta>`) blocks them. Put any new script in a file under
  `assets/`.

## Shared with the English site

`styles.css`, `enhance.css`, `main.js`, `contact.js`, `projects.js`,
`cookies.js` and the other files in `assets/` came from the main Precisa site
(`matindaghighi99/precisa`), where the scripts switch to Persian on pages
with `<html lang="fa">`. They are copies here: a change to one site does not
reach the other. The Privacy, Terms and Refund links point to the English
pages on precisasolutions.ca.

## Fonts

Self-hosted (Google Fonts is unreliable from inside Iran), both under the SIL
Open Font License:

- Estedad by Amin Abedi — headings and buttons (`assets/fonts/estedad/OFL.txt`)
- Vazirmatn by Saber Rastikerdar — running text (`assets/fonts/vazirmatn/OFL.txt`)
