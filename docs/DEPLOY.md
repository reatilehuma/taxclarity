# Deploying ClearTax SA

The app is a folder of static files (`apps/web/dist`). There is no server code and no database, and nothing the
person types is ever sent anywhere, so any static host works. The steps below use Cloudflare Pages or Netlify
because both read the `_headers` and `_redirects` files already in the build. Nothing has been deployed yet.

## Before the first deploy

1. `npm install`, then `npm run ci`. Everything must pass.
2. `npm run lighthouse` (needs `npm run build` first; it serves the build locally, with the real headers).
3. `npm run links:check` (needs internet).
4. Walk through `docs/LAUNCH-CHECKLIST.md`.

## Build settings (either host)

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Output directory | `apps/web/dist` |
| Node | 24 |

Connect the repository, or upload the folder by hand for a first test (Netlify "Deploy manually", Cloudflare
Pages "Direct upload").

## What the build already contains

`apps/web/public/` is copied into the build as it is:

- `_headers`: the Content Security Policy (scripts, styles, fonts, images and connections only from the site
  itself; no framing; no plugins), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy`, HSTS, cross-origin isolation headers, and the cache rules (hashed files for a year;
  the page shell and `sw.js` never cached, so updates arrive).
- `_redirects`: every address loads the single-page app (`/wizard`, `/results` and so on).
- `robots.txt`, `favicon.svg`, `manifest.webmanifest`.

`sw.js` is written by the build. It must be served from the site root and with `Cache-Control: no-cache`
(the `_headers` file does this).

## HTTPS and a domain

Both hosts give an HTTPS address ending `pages.dev` or `netlify.app` straight away and issue a certificate for a
custom domain you point at them. Turn on "always use HTTPS". The `Strict-Transport-Security` header is already
in `_headers`; if you later add a domain that must also be reachable over plain HTTP, remove `includeSubDomains`
first.

## Other hosts

Any host works if it does three things:

1. Serves the files in `dist` over HTTPS with the headers in `public/_headers`.
2. Answers every address that is not a file with `index.html` (status 200).
3. Serves `sw.js`, `index.html` and `manifest.webmanifest` with `Cache-Control: no-cache`, and `/assets/*`
   with `Cache-Control: public, max-age=31536000, immutable`.

Nginx, for example: `try_files $uri /index.html;` plus an `add_header` line per header in `_headers`.
`apps/web/scripts/serve.mjs` is a small working reference of exactly this behaviour.

## After deploying

- Open the live address on a phone, run a calculation, then turn on airplane mode, reload and calculate again.
- `npm run lighthouse -- https://your-live-address` runs the same audit against the live site.
- The assistant in this version runs on the device, so the policy stays as it is. When a real AI service is added
  (Phase 15), `connect-src` in `_headers` needs the proxy's address, and nothing else. Do it then, not before.

## The AI assistant (optional)

The site works completely without this. The default build has an assistant that runs on the device and needs
nothing from you. To use a real AI model instead (Claude, through Anthropic's API), three things are needed:

1. **A key, kept secret.** Create an API key in the Anthropic Console and set a **monthly spending limit** on it there.
   In Cloudflare Pages: Settings > Environment variables > add `ANTHROPIC_API_KEY` as a **Secret** (encrypted).
   Never put it in the repository or in a build variable that starts with `VITE_` (those are published to every visitor).
2. **Switch the build to the AI assistant.** Add the build variable `VITE_ASSISTANT_PROVIDER = remote`. Without it the
   site keeps using the on-device assistant, even if the key is set.
3. **Nothing else.** The proxy is `apps/web/functions/api/assistant.ts`; Pages deploys it with the site at
   `/api/assistant` on the same address, so the content policy in `_headers` does not change (`connect-src 'self'`).

Optional settings (all environment variables on the same page):

| Variable | What it does | Default |
|---|---|---|
| `ASSISTANT_MODEL` | Which Claude model answers. `claude-haiku-5-5` is far cheaper and may be enough for explanations; try it with `npm run assistant:smoke` first. | `claude-opus-5-5` |
| `RATE_LIMIT_PER_MINUTE` | Questions per visitor per minute. Counted separately by each running copy of the function, so it is a brake, not a guarantee. | 12 |
| `ALLOWED_ORIGINS` | Comma-separated sites allowed to call the proxy. Empty means this site only. | empty |

Also add a **rate-limiting rule** in Cloudflare (Security > WAF > Rate limiting rules) for `/api/assistant`, for example
30 requests per minute per address. Together with the spending limit on the key, that caps what anyone can cost you.

**What the proxy does and does not do.** It accepts one kind of request (a question, up to 8 earlier turns, and the
calculator's figures), checks it against the same allow-list the app uses, and refuses anything else with a bare
"bad request". It sends the rules, the figures and the question to Claude, checks every rand amount in the answer
against the calculator's figures (one retry, then a plain apology), and returns the text. It stores nothing and logs
only the *kind* of failure, never a question, an answer or a figure. Anthropic, as the service provider, may keep
requests for a limited time under its own terms, which is why the consent window says so.

**Before you switch it on for the public**, run the live check once, on purpose (it costs a few cents):

    ANTHROPIC_API_KEY=sk-ant-... npm run assistant:smoke

It asks ten sample questions (including an attempt to order it around and a request for investment advice), prints each
answer and says whether every figure was one the calculator provided. Add `-- --record` to save the answers as the
recordings that CI replays. Read the answers yourself: the checker proves the numbers, not the wording.

**Netlify instead of Cloudflare:** the proxy is written against the web-standard Request and Response
(`packages/assistant-proxy`), so a Netlify function is a few lines that call `handleWithEnv(request, process.env)`.
It is not written yet because the host has not been chosen.

## The PDF summary

- **No policy change was needed.** The PDF is made in the browser from this site's own scripts and its two font files (`/assets/InterTabular-*.ttf`, loaded by `fetch` under `connect-src 'self'`). The file is handed over as an ordinary download link, so the existing Content-Security-Policy stands as it is: no `unsafe-eval`, no other origin.
- **Offline:** the service worker keeps the PDF code and fonts with the rest of the build, so the download works after one visit with the network off. The landing page never loads them.
- **After deploying, check once on real phones** (the automated tests use Chromium at phone size): on Android Chrome the file goes to Downloads and a "Download complete" notice appears; on iOS Safari the PDF opens in the viewer or the Downloads list (Share → Save to Files). Both should work from airplane mode after the first visit.

## Updating

Deploy again. Open tabs keep working on the old version; the new one takes over once every tab is closed.


## Tax years: never deploy the test build

A normal build offers only tax years that have been signed off, and the draft year's figures are not in it at all.
The browser tests use a **separate** build that also offers drafts: `VITE_ENABLE_DRAFT_YEARS=1` (see
`playwright.config.ts`, the build in `dist-years`). **Never set that variable on a real deploy.**

`npm run bundle:check` is the safety net: it fails if any draft rule set is found in `dist`, so a deploy built with the
variable set cannot pass `npm run ci`. If you build outside `npm run ci`, run `npm run bundle:check -w apps/web` before
you publish.

**The release gate.** `npm run release:check` (also the CI job "release-gate" and the last step of `npm run ci`)
fails until every tax year is `verified` and signed off in `docs/rulesets/`. Do not deploy while it is red. How a year
is signed off: docs/RUNBOOK-NEW-TAX-YEAR.md.
