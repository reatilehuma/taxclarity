# ClearTax SA

A privacy-first South African PAYE calculator. Understand your salary, check your PAYE, and keep more of your money,
in plain language, entirely in your browser.

> *Understand Your Salary. Pay the Right Tax. Keep More of Your Money.*

ClearTax SA is for salaried employees who know what lands in their bank account but not how it got there. It starts
from either a bank deposit or a gross salary, and ends with a gross-to-net breakdown, a bracket-by-bracket
explanation, a comparison with the payslip, and practical, rand-quantified ways to legally pay less tax.

All figures are **estimates**. This is not tax advice.

## Features

- **Three ways in:** start from your bank deposit (take-home mode), from your gross salary, or from your payslip.
- **Step-by-step wizard** with a live preview that updates as you answer.
- **Full PAYE maths:** brackets, age rebates, UIF, retirement contributions (Section 11F), medical aid credits
  (Section 6A), employer medical aid as a fringe benefit, bonuses, pay frequency (monthly, fortnightly, weekly).
- **Results page:** gross-to-net table, bracket walk, payslip PAYE comparison, plain-language education, and
  personalised tips.
- **Tax-year selector:** 2026/27 (default) and 2025/26.
- **PDF summary** you can download. It is made on your device, works offline, and carries no personal data.
- **Works offline** as an installable web app (service worker).
- **Optional AI assistant** that explains results. It never calculates tax. By default it runs on the device; a
  remote model is opt-in (see [docs/DEPLOY.md](docs/DEPLOY.md)).
- **Accessible and responsive:** keyboard and screen-reader support, checked with axe and Lighthouse.

## Privacy

- Every calculation runs in the browser. No account, no database.
- Nothing you type (amounts, ID numbers, tax reference numbers) is sent anywhere or written to storage. State lives
  in memory only.
- A strict Content Security Policy limits the site to its own files. Browser tests record every network request and
  fail if any carries an amount or goes to another address.

## Tech stack

| Area | Choice |
|---|---|
| Front end | React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, React Router 8 |
| Tax maths | Pure TypeScript with `decimal.js`; no tax parameters in logic code |
| PDF | `pdfmake`, loaded only when you press "Download PDF summary" |
| Tests | Vitest, Testing Library, fast-check (property tests), Playwright, axe-core, Lighthouse |
| Lint | oxlint |
| Hosting | Static files; Cloudflare Pages or Netlify (the AI proxy is a Cloudflare Pages Function) |

## Repository layout

This is an npm workspaces monorepo.

```
apps/
  web/                 The site: wizard, results, landing page, service worker, e2e tests, build scripts
    functions/api/     Cloudflare Pages Function for the optional AI proxy (/api/assistant)
    public/            _headers (CSP), _redirects, manifest, robots.txt
packages/
  tax-engine/          The calculation engine and the versioned rule sets (2025-26, 2026-27)
  pdf-export/          PDF summary generation
  assistant/           On-device explainer and answer checking
  assistant-proxy/     Server-side proxy to the AI service (key never reaches the browser)
docs/                  Deploy guide, launch checklist, new-tax-year runbook, rule-set sources and test vectors
```

Planning documents: the product spec is in
[south-african-tax-calculator-prd-updated.md](south-african-tax-calculator-prd-updated.md), the build plan is in
[execution-plan.md](execution-plan.md), and [PROGRESS.md](PROGRESS.md) records what each phase delivered.

## Getting started

You need **Node 22.22 or newer** (CI uses Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
```

In development a **Workbench** page at `/workbench` shows raw engine output for any input. It is left out of
production builds.

### Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build the site to `apps/web/dist` |
| `npm run preview` | Preview the production build |
| `npm test` | Unit and component tests in every workspace |
| `npm run typecheck` | TypeScript checks in every workspace |
| `npm run lint` | oxlint |
| `npm run e2e:install` | Install the Playwright browser (once) |
| `npm run e2e` | Browser tests |
| `npm run bundle:check` | Check bundle size budgets (run after `build`) |
| `npm run lighthouse` | Lighthouse audit of the production build |
| `npm run links:check` | Check external links (needs internet) |
| `npm run release:check` | Release gate: every tax year must be verified and signed off |
| `npm run assistant:smoke` | Smoke-test the remote AI proxy (needs `ANTHROPIC_API_KEY`) |
| `npm run ci` | Everything above, as CI runs it |

## Tax years and the release gate

Tax figures live only in versioned rule sets in `packages/tax-engine/src/rulesets/`, each with a source ID for every
number. 2026/27 is the default year.

`npm run release:check` blocks a release until every known tax year is `verified`, listed as signed off in the
registry, and has a filled-in sign-off in `docs/rulesets/`. At the time of writing, **2025/26 is still a draft**, so
the production build offers only 2026/27 and the gate fails on purpose. Test builds can include draft years with
`VITE_ENABLE_DRAFT_YEARS=1`. To add or sign off a year, follow
[docs/RUNBOOK-NEW-TAX-YEAR.md](docs/RUNBOOK-NEW-TAX-YEAR.md).

## Deployment

The site is a folder of static files. Settings for any host:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Output directory | `apps/web/dist` |
| Node | 24 |

The security headers (`_headers`), the single-page-app redirect (`_redirects`) and the AI proxy function are written
for **Cloudflare Pages** (and Netlify for the first two). Other hosts, such as Vercel, need equivalent
configuration. The full guide, including HTTPS, caching, the optional AI assistant and its environment variables,
is in [docs/DEPLOY.md](docs/DEPLOY.md). Before launching, work through
[docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md).

## Disclaimer

ClearTax SA gives estimates based on the published SARS rules for the selected tax year. It does not replace your
payslip, your employer's payroll, SARS, or a registered tax practitioner. It does not cover provisional taxpayers,
freelancers, landlords, business owners, or other cases outside the scope in the product spec.
