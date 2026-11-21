# Execution Plan: South African Tax Calculator (2026/27)

Source: [south-african-tax-calculator-prd.md](south-african-tax-calculator-prd.md) (Phases 1–15) and [south-african-tax-calculator-prd-updated.md](south-african-tax-calculator-prd-updated.md) (Phases 16–23)

This plan splits the PRD into **23 phases**. Phases 1–15 are the original plan and are built. Phases 16–23 add the two features from the updated PRD: a **tax-year selector** (2025/26 and 2026/27) and a **PDF summary export**. Each phase fits in a single working session. Every phase ends with an app you can start with one command, open in a browser, and judge before deciding to go on.

---

## How the plan is built

- **Engine first, behind a visible page.** Phases 1–4 build the calculation engine, the riskiest part of the product. Each of them also grows a plain "Workbench" page where you type inputs and see every number the engine produces. You never get a phase that only adds tests.
- **The polished product goes on top.** Phases 5–11 build the landing page, the wizard, the live preview and the results page. They all read from an engine that is already tested.
- **Shippable before AI.** Phase 13 deploys a complete calculator. The AI assistant (Phases 14–15) is optional and can be dropped without losing anything.

### Rules for every phase

1. `npm install` then `npm run dev` from the repo root starts the app. `npm test` runs all tests and must pass.
2. The Workbench (`/workbench`) stays available in development for the whole project. It shows raw engine output for any input and is your quick check against the PRD test vectors. It is left out of production builds.
3. No financial data is sent over the network or written to storage. State lives in memory only (PRD §17.1).
4. No tax parameter appears in logic code. Every value comes from the 2026/27 rule set (PRD §6.15, §10.1).
5. All UI numbers come from the engine. The UI does no tax arithmetic.
6. Each phase ends with a short entry in `PROGRESS.md`: what was built, what to look at, and any known gaps.

### Progress tracker

| # | Phase | What you can open at the end |
|---|---|---|
| 1 | Foundation + first real number | Workbench: gross + age → PAYE, UIF, take-home, bracket table |
| 2 | Retirement, medical aid, pay frequency | Workbench reproduces the PRD's R30,000 worked example |
| 3 | Take-home mode + bonuses | Workbench: type your bank deposit, get an estimated gross |
| 4 | Extras, payslip comparison, flags | Workbench covers every engine input; engine maths complete |
| 5 | Design system + landing page | Polished landing page at `/` |
| 6 | Wizard shell + first steps | Landing → start → amount → age → basic result |
| 7 | Wizard: retirement, medical, variable pay | Main wizard path works end to end |
| 8 | Wizard: extras, payslip check, review | Full wizard in all three modes |
| 9 | Live preview dashboard | Numbers update as you answer (desktop panel + mobile sheet) |
| 10 | Results page: the numbers | Summary, gross-to-net table, bracket walk, comparison, flags |
| 11 | Results page: education + recommendations | Personalised explanations and rand-quantified tips |
| 12 | Accessibility, responsiveness, end-to-end tests | Same app, keyboard/screen-reader/mobile solid |
| 13 | Offline, performance, deployment | Live public URL, works offline |
| 14 | AI assistant: consent + offline explainer | Assistant drawer with consent, no external calls yet |
| 15 | AI assistant: real provider | Assistant answers with a real model, numbers checked |
| 16 | 2025/26 rule set (draft) + year switch in the Workbench | Workbench: same inputs, both years side by side, every 2025/26 figure with its source |
| 17 | Year-aware engine + 2025/26 test vectors | Workbench: load a 2025/26 vector, switch years and back, identical to the cent |
| 18 | Tax-year selector in the product | Change the year on the landing page, wizard, preview or results; everything recalculates |
| 19 | Year-specific copy, tips and assistant | Every FAQ, tip, warning and assistant answer quotes the selected year's figures |
| 20 | PDF summary: library + first page | "Download PDF summary" gives a real PDF: header, details, income table, disclaimer |
| 21 | PDF summary: all tables | Full PDF: income, deductions, tax calculation, reconciliation, flags; multi-page safe |
| 22 | PDF summary: offline, privacy, failures, phones | Export works offline, sends nothing, recovers from errors, works on mobile |
| 23 | Multi-year release | Production build with both years signed off and the PDF, ready to deploy |

---

## Before Phase 1: decisions and PRD corrections (no code, ~30 minutes)

I checked the PRD's internal arithmetic. The bracket base amounts, the rebate thresholds and test vector T1 (R3,149 PAYE) are all consistent. I did **not** check the 2026/27 SARS figures against live SARS pages. Phase 1 assumes PRD §6.15 is correct.

The items below need a decision or correction first. They block particular phases, as noted.

| # | Issue | Recommendation | Blocks |
|---|---|---|---|
| D1 | **T16 expected value is wrong.** A take-home of R20,000 (under 65, no extras) gives a gross of about **R23,051.51**, not R25,253. R25,253 gross gives about R21,629 take-home. | Change T16's reference to R23,051.51 (±R1). | Phase 3 |
| D2 | **T14 arithmetic is wrong.** 0.333 × 26,464 = 8,812.51, not 8,815.61, so s6B = **R12,142.51**. | Fix the vector. | Phase 4 |
| D3 | **T12 and T13 use s6A amounts that no member count produces** (R11,688 and R17,592 a year). | Test the s6B function directly with the given s6A value. Optionally add vectors built from real member counts. | Phase 4 |
| D4 | **Regular-month PAYE.** §10.3 Step J divides annual PAYE *including bonus tax* by 12, which conflicts with the balance-of-remuneration method in §6.4.2. | Work out regular PAYE from regular income only. Bonus/variable tax = tax(all income) − tax(regular income). | Phase 3 |
| D5 | **Employer medical contribution as a fringe benefit** (§6.13, E12) is missing from the Step C income formula. | Add it to income as a fringe benefit and show it in the breakdown. | Phase 2 |
| D6 | **Step numbering differs between §7 and §8.** §7 makes pay frequency its own step; §8 makes it a sub-question. | Follow §8: 0 Start, 1 Amount + frequency, 2 Age, 3 Retirement, 4 Medical, 5 Variable pay, 6 Extras, 7 Payslip check, 8 Review. | Phase 6 |
| D7 | **Payslip mode asks for PAYE/UIF twice** (Step 1 mode C and Step 7). | Ask for them once, at Step 7: required in mode C, optional in mode B. | Phase 8 |
| D8 | **The AI assistant needs an API key**, and a static, serverless app cannot keep one secret. | Add a small proxy function that only forwards the allow-listed payload and stores nothing. This is a small exception to "no server". | Phase 15 |
| D9 | **Refresh restarts the wizard (Q1)** and **English only (Q6)**. | Keep both PRD defaults. Put all copy in one strings module from Phase 5 so translation is possible later. | Phase 5 |
| D10 | Rounding helper named `floor2` but defined as half-up. Some cross-references are broken (§8.10, §13.4–13.9, "§18 privacy"). | Use half-up to the cent. Correcting the references is optional. | — |
| D11 | **PRD §14.2 table order cannot add up.** It lists taxable income, tax, rebates and credits between salary and take-home, and says "plus UIF". UIF comes off pay. Rebates and credits come off tax, not income. | Split into blocks that each add up: pay to bank account (monthly and annual); income to taxable income; SARS brackets; tax to final tax; payroll tax against final tax. Same rows, same relative order, UIF shown as a deduction. Tax blocks are annual only. | Phase 10 |

---

## Phase 1: Foundation and the first real number

**Goal:** a running app that calculates real 2026/27 PAYE for a plain salary.

**Build**
- Repo layout from PRD §19: `apps/web` (Vite + React 19 + TypeScript strict + Tailwind) and `packages/tax-engine` (pure TypeScript, no UI dependencies), using npm workspaces.
- Money handling: decimal.js inside the engine, rounding half-up to the cent only where the PRD says (PAYE, UIF).
- `rulesets/2026-27.ts` holding the **full** §6.15 parameter set, plus `assertValidRuleSet`. Each parameter carries a source reference (Appendix A ID).
- Engine slice: annual bracket tax, `bracketWalk`, rebates by age band, the R0 floor, UIF with the ceiling, monthly PAYE, take-home, marginal and effective rate.
- Workbench page: gross monthly salary + age band → PAYE, UIF, take-home, marginal/effective rate, and the bracket-walk table.

**Tests:** T2–T9 (bracket boundaries, the three age thresholds, UIF ceiling, low and zero income). Rule-set validation test.

**Open it:** run `npm run dev` and go to `/workbench`. Try R30,000, R5,000, R0, and R17,712 vs R17,713.

**Done when:** T2–T9 pass; the Workbench shows correct PAYE for a plain salary at all three age bands.

**Decide:** Do the numbers match what you'd expect from a real payslip?

---

## Phase 2: Retirement, medical aid, pay frequency

**Goal:** the engine handles the deductions most salaried people have.

**Build**
- Section 11F: own + employer contributions, employer contributions added as a fringe benefit, 27.5% / R430,000 limit tested on income before the deduction, excess carry-forward amount.
- Section 6A medical credit by member count, with `monthsCovered`. Who pays (self / employer / shared). Employer share treated as a fringe benefit (D5).
- Pay frequency conversion: weekly × 52/12, fortnightly × 26/12. Keep the original figure for display.
- `provenance.appliedRules` filled on every result.
- Workbench gains these inputs and shows the gross-to-net lines.

**Tests:** T1 (the R30,000 worked example → R3,149.00 PAYE, R23,673.88 take-home), T10, T11. Medical credit with 1, 2 and 5 members. Property tests: more gross never means less take-home; tax is never negative.

**Open it:** enter the T1 scenario in the Workbench and check that the result matches the PRD to the cent.

**Done when:** T1, T10 and T11 pass; property tests pass.

**Decide:** Is the treatment of employer contributions (fringe benefit in, deduction out) clear enough when you see it on screen?

---

## Phase 3: Take-home mode and variable pay

**Goal:** the product's main idea works: start from what lands in your bank account.

**Build**
- Take-home → gross solver (§10.3 Step B): fixed-point iteration, bisection fallback, R0.01 tolerance, memoised by an input hash.
- `confidence` set to ESTIMATE or PAYSLIP_ACCURATE.
- Bonus, overtime and commission: tax on variable pay by the balance-of-remuneration method; regular-month PAYE from regular income only (D4); "a normal month" take-home and "averaged over the year" take-home.
- UIF on gross including 1/12 of variable pay (PRD simplification), flagged.
- Workbench: a mode switch (take-home / gross) and variable pay inputs.

**Tests:** T16 with the corrected reference (D1). Solver round-trip: gross → take-home → solver gives back the gross within R0.01, across all brackets and ages. Bonus tax tests.

**Open it:** type your own monthly bank deposit into the Workbench and see the estimated gross. Add a bonus and compare the two take-home figures.

**Done when:** T16 passes; the round-trip property test passes; the solver never fails to converge.

**Decide:** Is the gross estimate from take-home believable for your own situation?

---

## Phase 4: Extras, payslip comparison, flags (engine maths complete)

**Goal:** every calculation in the PRD exists and is tested.

**Build**
- Section 18A donations (10% cap, carry-forward), s6B additional medical credit (both branches, disability toggle), interest exemption by age, travel allowance (80%/20% taxable portion, km × R4.95 estimate), second employer income.
- Payslip comparison (diff and diff %; hidden when PAYE wasn't given).
- Flag generator: every exclusion in PRD §5.2/§14.7 that applies, with its SARS link.
- Edge cases E1–E18 handled. Taxable income never goes below 0.
- Fuzz test: random and extreme inputs never throw and never produce NaN or Infinity.
- Workbench: all inputs, plus a "Load test vector" dropdown for T1–T20.

**Tests:** T12–T15 (corrected per D2, D3), T17–T20. Fuzz suite. Coverage report (target ≥ 90% lines on the engine).

**Open it:** pick any test vector from the dropdown and compare the screen with the PRD table.

**Done when:** all T1–T20 pass; fuzz suite passes; engine coverage ≥ 90%.

**Decide:** The engine is complete. Is it trustworthy enough to build the real product on?

---

## Phase 5: Design system and landing page

**Goal:** the product looks and feels like a South African fintech app.

**Build**
- Design tokens (one accent colour family, neutrals, light/dark if wanted), a UI typeface plus tabular numerals for money.
- `R 30 000,00` currency formatter and date formatter (§17.5).
- Routing: `/`, `/wizard`, `/results`, plus dev-only `/workbench`.
- Strings module holding all user-facing copy (D9).
- Landing page, all sections from §13.1: nav, hero with headline and two CTAs, trust strip, "How it works", example dashboard preview (example figures produced by the engine and labelled "Example"), capability grid, privacy promise, footer with disclaimer and SARS links.
- Subtle hero animation that respects reduced-motion settings.

**Open it:** go to `/` on desktop, then narrow the window to phone width. The CTAs lead to a "Wizard coming next" placeholder.

**Done when:** the landing page is complete and responsive at 360 / 768 / 1024 / 1440 px.

**Decide:** Is this the look you want? Changing the visual direction is cheap now and expensive later.

---

## Phase 6: Wizard shell and the first steps

**Goal:** a first real end-to-end path from landing page to an answer.

**Build**
- Wizard store (in memory only) holding `WizardInputs`, current step and memoised result.
- Wizard layout: one question per screen, progress bar on desktop, dots on mobile, Back button, browser Back via `/wizard?step=N`, FAQ accordion per step.
- Reusable components: currency input (live formatting, accepts pasted values like "R30 000" or "30,000.00", raw numeric value), choice cards, segmented control.
- Step 0 (starting mode), Step 1 (amount + pay frequency, "I'm not sure" slider for take-home mode), Step 2 (age), each with its FAQ copy and validation.
- Temporary results page: the headline sentence and three numbers (take-home, PAYE, annual tax).

**Open it:** start from the landing page in each mode, answer three questions and see your result. Use browser Back to change an answer.

**Done when:** all three modes reach the temporary result; refresh restarts the wizard; Back works both ways.

**Decide:** Does one question per screen feel quick or slow? Is the tone right?

---

## Phase 7: Wizard: retirement, medical aid, variable pay

**Goal:** the steps that matter for most people are in.

**Build**
- Step 3 retirement (yes/no, own amount, employer contribution, fund type, auto-calculated percentage display, R430,000 carry-forward note).
- Step 4 medical aid (member count stepper 1–15, contribution, who pays, out-of-pocket costs, employer-pays note).
- Step 5 variable pay (multi-select chips, an amount for each, "more than 3× salary" note).
- Skip / "No" options; Continue disabled until required fields are valid; friendly inline messages.

**Open it:** go through the wizard as yourself, then as a 66-year-old with medical aid and a pension. Watch the temporary result change.

**Done when:** the T1 scenario entered through the wizard gives the same numbers as the Workbench.

**Decide:** Are any questions confusing? Fix the wording now.

---

## Phase 8: Wizard: extras, payslip check, review

**Goal:** the full wizard as specified, in all three modes.

**Build**
- Step 6 "Optional extras": collapsed section with a "filled" count chip, containing donations + receipt, out-of-pocket medical + disability, interest, travel allowance, second employer.
- Step 7 payslip check (modes B and C only, per D7): PAYE and UIF, UIF > R177.12 warning with override, auto-estimated UIF flagged when left blank.
- Step 8 review: answers grouped by topic with Edit links that jump back to a step, the "See my tax result" CTA, small-print disclaimer.
- Global validation from §9 (R10m sanity guard with confirmation, screen-reader-friendly errors).
- `/results` without the minimum answers redirects to the start of the wizard.

**Open it:** run all three modes end to end; edit an answer from the review screen.

**Done when:** each mode reaches the review screen and then the temporary result; the guard redirect works.

**Decide:** Is the wizard the right length? Is anything missing or unnecessary before the dashboard goes on top of it?

---

## Phase 9: Live preview dashboard

**Goal:** the "watch your tax take shape" experience.

**Build**
- Desktop: two-column wizard with a sticky right panel. It holds the mode badge (Estimate / Payslip-accurate, with an icon), the headline numbers, a summary list with tooltips, a stacked mini bracket bar with your bracket highlighted, and a collapsible full SARS bracket table with "you are here".
- Mobile: sticky "Take-home · PAYE ▾" bar that opens a full-screen bottom sheet (focus trapped, closes when you move to another step).
- Empty state with placeholder lines; updates debounced at 150 ms; only the mode badge is announced to screen readers.

**Open it:** answer questions and watch the panel update; switch to phone width and open the sheet.

**Done when:** the panel always matches the engine output for the current answers; recalculation feels instant.

**Decide:** Does the live preview help, or does it distract on small screens?

---

## Phase 10: Results page: the numbers

**Goal:** a complete, checkable answer.

**Build**
- Summary sentence (estimate pattern, or the payslip pattern in mode C), confidence badge, tax-year line, "Adjust my answers" CTA.
- Gross-to-net table with monthly and annual columns, rows in the exact §14.2 order, rebates and credits itemised, a tooltip on every row.
- SARS bracket walk drawn directly from `bracketWalk`, with "Your top bracket" tag, rebates, credits and final liability.
- Payslip comparison panel (only when payslip figures were given) with the neutral §14.4 wording.
- Exclusions and flags list with SARS links.
- "Copy summary" to clipboard, clearly labelled as an estimate. No PDF export.

**Tests:** reconciliation test: gross − own deductions − PAYE − UIF = take-home, to the cent, across many generated inputs.

**Open it:** finish the wizard and read the whole results page. Check the table against your own payslip if you have one.

**Done when:** the reconciliation test passes; the comparison panel appears only when it should.

**Decide:** Could someone with no tax knowledge follow this page?

---

## Phase 11: Results page: education and recommendations

**Goal:** people leave knowing how to keep more of their money, legally.

**Build**
- Engine: `explanations` generator (one entry per input that changed the result, with its rand effect) and `recommendations` generator for R1–R9, each with its trigger and confidence level (CALCULATED / ESTIMATED / INFORMATIONAL).
- Rand figures shown only when the confidence is CALCULATED (§14.6).
- "How your answers shaped your tax" cards and a recommendations section with its disclaimer.

**Tests:** trigger and no-trigger cases for every recommendation; savings = amount × marginal rate; no recommendation without its trigger.

**Open it:** try a profile with no pension, then one in the 39% bracket, and compare the recommendations.

**Done when:** all recommendation tests pass; every rand figure on the page comes from the engine.

**Decide:** The core product is now complete. Ship after Phases 12–13, or change something first?

---

## Phase 12: Accessibility, responsiveness, end-to-end tests

**Goal:** it works for everyone, on every screen, and stays that way.

**Build**
- Keyboard pass through the entire flow; visible focus; skip link; landmarks; step-change announcements ("Step 4 of 8: Medical aid").
- axe checks on landing, every wizard step and results: zero critical or serious issues.
- Contrast check; reduced-motion check; layout checks at the four breakpoints.
- Playwright golden paths: three modes × desktop + mobile; a smaller matrix across age bands and optional steps.
- Component tests for the currency input and segmented control.
- Basic CI script (typecheck, lint, all tests) runnable locally, ready for GitHub Actions.

**Open it:** use the whole app with only the keyboard, and on your phone.

**Done when:** E2E suite passes; axe is clean; keyboard-only walkthrough succeeds.

**Decide:** Is it ready for real users to try?

---

## Phase 13: Offline, performance, deployment

**Goal:** a public URL you can share.

**Build**
- Service worker so the app works offline after the first visit.
- Bundle check: landing JavaScript ≤ 150 KB compressed.
- Lighthouse run (mobile targets from §17.2).
- Static hosting setup with HTTPS and security headers (CSP, X-Content-Type-Options, Referrer-Policy).
- Privacy check: a full wizard run with the network tab open shows no financial data sent anywhere.
- Launch checklist: disclaimers visible, SARS links work, "last verified" date in the footer (for the UIF ceiling, Q3).
- Runbook for adding the 2027/28 rule set (PRD Phase 7).

**Open it:** the production URL on your phone. Turn on airplane mode and calculate again.

**Done when:** Lighthouse targets are met on the live URL; the privacy check passes.

**Decide:** Launch now and add the AI assistant later, or not at all?

---

## Phase 14: AI assistant: consent and offline explainer

**Goal:** the full assistant experience, with no external service yet.

**Build**
- `packages/assistant`: `TaxAssistantProvider` interface, payload builder with an allow-list (forbidden fields cannot be serialised), guardrailed prompt construction.
- Consent modal (§15.2.2); the consent flag is the only thing stored in `localStorage`.
- Chat drawer that loads only when opened, with the "AI explanations · calculations by the deterministic engine" chip and an entry point on the results page.
- A mock provider that answers from templates using only engine figures, so the whole flow runs without an API key.
- "No invented numbers" checker: flags any rand amount in a reply that isn't in the engine result. Local audit log for the session.
- Fallback message when the assistant is declined or unavailable.

**Tests:** no network call before consent; payload allow-list; the number checker catches an invented figure.

**Open it:** open the assistant on the results page, decline, then accept, and ask about your bracket.

**Done when:** all assistant tests pass; the calculator works exactly as before whether the assistant is on or off.

**Decide:** Is the assistant worth wiring to a real model? Which provider (Q7)?

---

## Phase 15: AI assistant: real provider

**Goal:** real explanations from a language model, with the same guarantees.

**Build**
- Small proxy function (D8) that holds the API key, accepts only the allow-listed payload, and logs nothing financial.
- Real provider implementation behind `TaxAssistantProvider`.
- Every reply passes through the number checker; a reply that fails is replaced with a safe fallback.
- Prompts for scope limits and refusal of personal financial advice.

**Tests:** CI check with recorded replies; one live smoke test, run manually.

**Open it:** ask the assistant "Why is my bonus taxed so heavily?" and "How much would an RA save me?". Check that every figure it quotes appears on the results page.

**Done when:** the assistant works on the live URL; the number checker passes on a set of sample questions.

**Decide:** Done for v1. Next candidates: progress that survives refresh (Q1), translations (Q6), 2027/28 rules.

---

# Part 2: Updated PRD (tax-year selector and PDF summary)

Source: [south-african-tax-calculator-prd-updated.md](south-african-tax-calculator-prd-updated.md), §6.16, §8 (tax-year selection), §10.2, §10.5, §14.1, §14.3, §14.8, §16, §19, §20, Q8, Q9 and Appendix C. Phases 1–15 stay as they are. Phase 10's "No PDF export" is replaced by Phases 20–22.

## How Part 2 is built

- **Research first.** The updated PRD forbids guessing 2025/26 figures and requires independent sign-off (§6.16, §10.5, Q8). A person has to do that sign-off, and it can take days. Phase 16 produces the sourced figures straight away, so the review runs while Phases 17–22 are built. Only Phase 23 (release) waits for it.
- **Draft years.** Until it is signed off, 2025/26 is a *draft* year. It can be selected in development, with a "Draft" label, and never in a production build. Every phase stays runnable and nothing unverified can ship.
- **Engine, then product, then release.** As in Part 1: the year contract goes into the engine behind the Workbench (16–17), the selector goes into the product (18–19), the PDF goes on top (20–22), and the release comes last (23).
- **Year before PDF.** The PDF is built after the selector, so it shows the selected year from the start and is tested for both years (§14.8 acceptance).

### Extra rules for Phases 16–23

These add to rules 1–6 above.

7. Rule 4 now reads "every value comes from the **selected year's** rule set". Nothing reads tax figures except through the rule-set registry.
8. The 2026/27 figures and the T1–T20 expected results do not change. 2025/26 gets its own vectors (§10.2 multi-year invariant).
9. No 2025/26 figure goes in without a cited official source and the date it was captured. Gaps are never filled with 2026/27 values.
10. No year ever falls back to another. An unknown or unverified year gives a clear, recoverable error, never a silent default (§10.5).
11. The PDF is made on the device. Making it sends nothing over the network and stores nothing. The only file written is the download the person asks for (§14.8).

## Before Phase 16: decisions and PRD gaps (no code, ~30 minutes)

| # | Issue | Recommendation | Blocks |
|---|---|---|---|
| D12 | **The summary example PDF is not in the repo.** The updated PRD describes it (Appendix C), and this plan is based on that description. | Save it as `docs/reference/summary-example.pdf` so every PDF phase can compare against it side by side. | Phase 20 |
| D13 | **"Same table format" vs the PRD's limits.** You want the example's table format. The PRD keeps its sections and table style but forbids copying SARS codes, reference numbers, branding or anything implying an official assessment (§14.8, Appendix C). | Keep the example's section order, heading style, table rhythm, right-aligned Rand column, section totals and highlighted result. Use two columns (Description, Rand) instead of three. No Code column, reference number or SARS logo. | Phase 20 |
| D14 | **Who signs off 2025/26?** The PRD requires independent reviewer sign-off before the year can be released. | I compile the figures with links and capture dates (Phase 16). You, and ideally an accountant or a second person, check each one against SARS and record sign-off in the sources file. The release is blocked until then. | Phase 23 |
| D15 | **The age answer means something different in each year.** Step 2 asks for the age band at the end of the tax year (28 February). Someone who is 65 on 28 Feb 2027 may have been 64 on 28 Feb 2026. The PRD says a changed meaning must be flagged and confirmed (§8). | When the year changes, ask again only if the band could be different: going back a year with a 65+ band, or going forward a year with a band below 75+. Example question: "Were you 65 or older on 28 February 2026?" Phase 16 lists any other inputs whose meaning changes. | Phase 18 |
| D16 | **The selected year after a refresh.** Q1 keeps "refresh restarts the wizard". | Keep the year in memory with the other answers. A refresh resets it to 2026/27. It is not put in the URL. | Phase 18 |
| D17 | **What the PDF's "Calculated Result" is.** The SARS example ends with an assessed result. This app makes no assessment, and the PRD forbids implying a refund (§14.8). | Highlight **Calculated annual income-tax liability**. Show the payslip comparison in its own subtable with the neutral §14.4 wording. Never use "refund" or "payable". | Phase 21 |
| D18 | **Monthly or annual figures in the PDF tables.** §14.8 mixes an annual liability, monthly PAYE and take-home in both periods. | Tables 1–3 are annual, like a year of assessment. Any monthly row says "per month" in its label. Monthly and annual columns appear side by side only in the reconciliation table. | Phase 21 |
| D19 | **"Reconciliation matching §14.2".** D11 already rearranged §14.2 into blocks that add up on the results page. | The PDF's reconciliation table reuses the results page's "pay to bank account" block (monthly and annual). The tax blocks are already Tables 1–3. Screen and paper match. | Phase 21 |
| D20 | **The PDF library (Q9).** It needs real, selectable text, an embedded font, tables that break across pages with repeated headers, "Page X of Y", offline use, and must run under the current Content-Security-Policy, which does not allow `unsafe-eval`. | Spend about an hour in Phase 20 trying two candidates (for example pdfmake, and jsPDF with AutoTable). Choose on CSP compatibility, size and table pagination. Load the library only when the button is pressed; the service worker caches it for offline use. | Phase 20 |
| D21 | **The assistant needs to know the year.** The Phase 14 allow-list and the Phase 15 proxy reject any field they don't know, so a year field would be refused. | Add `taxYear` to the allow-list and the proxy schema. Answers name the year. | Phase 19 |

---

## Phase 16: 2025/26 rule set (draft) and a year switch in the Workbench

**Goal:** every 2025/26 figure exists with its source, and you can compare the two years side by side.

**Build**
- Research every rule-set field for 2025/26 (the list in `docs/RUNBOOK-NEW-TAX-YEAR.md` §1) from dated official sources: SARS pages, the 2025 Budget Review, SARS tax tables. Write `docs/rulesets/2025-26-sources.md` with one row per field: value, source link, section, date captured, notes. Leave a blank sign-off block for the reviewer(s) (D14).
- List anything that changed partway through 2025/26 (for example a UIF ceiling notice) and any difference in method from 2026/27, with how the engine handles each one: a value with an effective date, or "unsupported" with a message for the user (§6.16). List inputs whose meaning changes between years (D15).
- `rulesets/2025-26.ts` built only from that table, with `status: "draft"`, `rulesVersion`, start and end dates, `lastVerifiedAt` and source IDs. It must pass `assertValidRuleSet`. The 2026/27 set gets the same metadata and stays verified as it is today.
- A rule-set registry listing both years with their status. Widen the `TaxYear` type to `"2025-26" | "2026-27"`.
- Workbench: a year dropdown (a draft year shows a "Draft: not signed off" banner); a **Compare years** view (same inputs, both years side by side, differences highlighted); and a **Parameters** view listing every value of the chosen year with its source link, which helps the reviewer.

**Tests:** 2025/26 passes rule-set validation; the registry holds both years; the "no figures in logic code" test (`newyear.test.ts`) still passes; T1–T20 unchanged and passing.

**Open it:** go to `/workbench`, enter R30,000 and switch years. Open Compare years. Open Parameters for 2025/26 and follow a few source links.

**Done when:** every 2025/26 field has a cited source; the Workbench shows both years; all existing tests pass unchanged.

**Decide:** Send the sources file to your reviewer now. Do the differences between the years match what the 2025 Budget announced?

---

## Phase 17: Year-aware engine and 2025/26 test vectors

**Goal:** the engine cannot mix years or fall back to another year, and it is shown to be correct for 2025/26.

**Build**
- `taxYear` on `WizardInputs` (default `"2026-27"`) and on every `CalculationResult`. The engine looks up the rule set through `getVerifiedRuleSet(taxYear)` and uses only that set for the whole calculation: solver, flags, explanations and recommendations (§10.2, §10.5).
- An unknown year, or a draft year in a build that doesn't allow drafts, gives a typed error the UI can show and recover from. It never falls back.
- Provenance carries `taxYear`, `rulesVersion`, source IDs, period and `lastVerifiedAt`. The memo key includes year and `rulesVersion` (§16).
- `CurrentTaxRules` becomes just the default year. Every caller that reads it today goes through the registry with the selected year instead.
- 2025/26 reference vectors (Y1, Y2, …), each built from an independent source (SARS tax deduction tables, the SARS calculator or published worked examples), never from the engine's own output. They cover the same ground as T1–T9: a worked example, bracket boundaries, the three age thresholds and the UIF ceiling, plus a bonus case, medical credits and a take-home round trip.
- Cross-year fixtures: the same inputs give different results in the two years, and switching back restores the original result to the cent. Boundary tests across brackets, rebates, credits, caps, PAYE, UIF, solver, rounding and recommendation amounts (§10.5).
- Workbench: the "Load test vector" dropdown gains the 2025/26 vectors and sets the year; a provenance panel shows which rule set produced the numbers.

**Tests:** all of the above; the fuzz suite runs for both years; engine coverage stays ≥ 90%.

**Open it:** load a 2025/26 vector and compare it with its source. Load T1, switch to 2025/26 and back, and check that the numbers return exactly.

**Done when:** T1–T20 pass unchanged; all 2025/26 vectors pass; the no-fallback test passes.

**Decide:** Are the 2025/26 vector sources independent enough for your reviewer to rely on?

---

## Phase 18: Tax-year selector in the product

**Goal:** people choose the year wherever they are, and everything recalculates.

**Build**
- The wizard store holds `taxYear` (in memory, default 2026/27, D16). Changing it keeps the entered inputs and mode, then re-runs validation and the calculation. Numbers from the previous year are cleared before new ones appear (§8).
- An accessible **Tax year** selector: a label, each option with its date range, full keyboard and screen-reader support. It goes in the landing-page CTA area, at the top of the wizard, in the live preview (desktop panel and mobile sheet) and on the results page. No new wizard step; step numbering is unchanged. The review screen shows the year with an Edit link.
- A non-blocking message, announced politely: "Tax year changed to {year}. Your results have been recalculated using that year's rules."
- The age question on a year change (D15), plus any other changed inputs from Phase 16, each confirmed before the new results show.
- Labels that come from the rule set: the results tax-year line, bracket walk and table headings, the mini bracket bar and "you are here", the date in the age question, the "SARS {year} rules" summary sentence, and the Copy summary text.
- Production builds list only verified years; development builds also list drafts, tagged "Draft".
- The date on the device is never used to choose a year (§8).

**Tests:** selector component tests; switching keeps inputs; no old-year number appears after a switch; the age confirmation; Playwright: switch year in the wizard and on results, in all three modes; axe on every placement.

**Open it:** go through the wizard for 2026/27, switch to 2025/26 on the results page and watch the numbers change. Switch back and check they match to the cent. Repeat on phone width.

**Done when:** the selector works in every placement; switching back restores the original result exactly; axe is clean.

**Decide:** Is the selector easy to find without getting in the way? Is the age question on switching clear?

---

## Phase 19: Year-specific copy, tips and the assistant

**Goal:** no sentence anywhere quotes the wrong year's figure.

**Build**
- Every figure written into copy becomes a template filled from the selected rule set (§6.16). That covers FAQ answers, notes such as the retirement cap and the UIF maximum, recommendation thresholds and amounts, flags, footnotes, and links that name a year.
- `figures.test.ts` checks the rendered copy for **both** years: every rand figure must belong to the selected year.
- Validation messages that quote a limit (for example the UIF warning in Step 7) read the selected year.
- The landing page's example dashboard and sample payslip stay on the default year and say so.
- The footer's "last verified" date follows the selected year. Source links are per year where SARS publishes year-specific pages; `npm run links:check` covers both years.
- Assistant (D21): `taxYear` in the allow-listed payload and the proxy schema; the prompt and the local explainer name the year; the number checker reads the selected year's result; recorded replies updated.

**Tests:** figures test for both years; recommendation savings use the selected year's marginal rate; assistant payload carries the year; the proxy rejects an unknown year; Playwright golden paths pass for 2 years × 3 modes.

**Open it:** switch to 2025/26 and read the retirement and payslip-check FAQs, the recommendations and the flags. Ask the assistant "What bracket am I in?"

**Done when:** the figures test passes for both years; all golden paths pass for both years.

**Decide:** The year selector is complete. Are you happy with how switching feels before the PDF is added?

---

## Phase 20: PDF summary: library and first page

**Goal:** a **Download PDF summary** button that gives a real, correct, readable PDF.

**Build**
- Try the candidate libraries and choose one (D20); record the choice and reasons in `PROGRESS.md`.
- `packages/pdf-export` in two parts (§19). (a) A pure function that turns a `CalculationResult` and its rule set into a "summary document" of sections, rows, totals and labels. It only reads engine values and does no tax arithmetic. (b) A renderer that turns that document into a PDF. Tests can then check the content without opening a PDF.
- Layout following D13 and Appendix C: A4 portrait; title **South African Income Tax — Calculation Summary**; subtitle **Independent estimate — not a SARS assessment**; a Details block (year of assessment, period, date generated, mode, confidence; no reference number, no ID); **Table 1, Income and taxable amounts** (only rows that apply, with a total); the §14.8 Disclaimer; a footer with "Page X of Y" and the rule-set version and last-verified date.
- The app's typeface embedded, tabular numerals, rand amounts to two decimals and right-aligned, formatted the same way as on screen.
- The button sits next to Copy summary on the results page. It is enabled only after a valid calculation and loads the library when pressed. File name: `cleartax-sa-summary-{year}-{date}.pdf`.
- All PDF wording goes in the strings module.

**Tests:** document rows equal engine values; rows that don't apply are left out; file name; the landing-page bundle stays within budget (the PDF code is a separate chunk).

**Open it:** finish the wizard, press Download PDF summary, and open the file next to `docs/reference/summary-example.pdf`.

**Done when:** the PDF downloads in Chrome; its text can be selected and searched; Table 1 matches the results page to the cent.

**Decide:** Is the look close enough to the example? Change the layout now, before the other tables go in.

---

## Phase 21: PDF summary: all tables

**Goal:** the full summary on paper, adding up to the results page.

**Build**
- **Table 2, Deductions:** eligible Section 11F retirement contributions, eligible Section 18A donations, any other deduction the engine calculated, a total, then a highlighted **Taxable income** row. A note separates these from payroll deductions that aren't tax-deductible, such as medical aid payments.
- **Table 3, Tax calculation:** normal tax before rebates; less each age rebate; less Section 6A and 6B medical credits; **Calculated annual income-tax liability** (highlighted, D17); estimated PAYE per month; PAYE withheld (only if given); UIF per month; take-home per month and per year (D18).
- **Payslip comparison** subtable when PAYE was given, with the §14.4 wording.
- **Gross-to-net reconciliation** table with monthly and annual columns (D19). With variable pay, the "a normal month" and "averaged over the year" figures are labelled as such.
- **Flags and exclusions** from the engine, with SARS links as text.
- Multi-page: rows are never split, clipped or overlapping; table headers repeat on a new page; text never shrinks below a readable size to fit one page.

**Tests:** PDF reconciliation: every amount equals the engine value within R0.01 and every total adds up, across generated inputs, both years and all three modes. Text-extraction test: read the generated PDF back and check that every row is present and in order. A multi-page test with every extra filled in and many flags.

**Open it:** download PDFs for three profiles: a plain salary; a bonus with an RA and medical aid; payslip mode with everything filled in (two pages).

**Done when:** the reconciliation and extraction tests pass; the multi-page PDF has no overlap or cut-off.

**Decide:** Would you hand this PDF to an accountant? Is anything missing or confusing?

---

## Phase 22: PDF summary: offline, privacy, failures and phones

**Goal:** the export is as trustworthy as the rest of the app.

**Build**
- The service worker caches the PDF code and font, so export works offline after the first visit, but they still don't load on the landing page.
- No network: Playwright records every request during generation and fails on any. Export works under the current CSP; if a change is unavoidable, make the smallest one and document it in `docs/DEPLOY.md`.
- File metadata holds only the app name and date generated: no author, subject, keywords or inputs. Checked by a test.
- Failure path: "We couldn't create the PDF. Please try again." with a retry button; the results stay on screen. Tested by forcing the renderer to fail.
- Phones: download behaviour on Android Chrome and iOS Safari; a "Creating PDF…" state on the button; Copy summary unchanged.
- Accessibility: the button is labelled and announces when the PDF is ready; the reading order of the extracted text is checked; a tagged PDF if the chosen library supports it, otherwise listed as a known gap (§14.8 says "where supported").
- Playwright downloads: 3 modes × 2 years × desktop and mobile; axe on the results page with the button.

**Open it:** open results, go offline (airplane mode or DevTools), and download the PDF. Do the same on your phone.

**Done when:** offline export works; no requests are made during generation; the failure path works; the E2E suite passes.

**Decide:** Are both features ready to release?

---

## Phase 23: Multi-year release

**Goal:** both years and the PDF in a production build, with 2025/26 signed off.

**Build**
- Sign-off gate: 2025/26 changes from draft to verified only once sign-off is recorded in the sources file (D14). Fixes from the review go in and the 2025/26 vectors are re-run. A CI check fails the production build unless both years are verified (§6.16: the release is blocked rather than shipping one year).
- The full regression matrix for both years, the Lighthouse run, the bundle budget, and the privacy check repeated with the network tab open (wizard, year switch, PDF download).
- Docs: rewrite `docs/RUNBOOK-NEW-TAX-YEAR.md` for several years (add a year to the registry instead of switching `CurrentTaxRules`; keep old years and their tests; the sign-off gate; when to change the default year). Add the year selector and PDF checks to `docs/LAUNCH-CHECKLIST.md`.
- `PROGRESS.md` entry for Part 2.

**Open it:** serve the production build locally and run through both years and the PDF. Then the live URL once you deploy it (deploying is yours, as in Phase 13, per `docs/DEPLOY.md`).

**Done when:** CI is green; Lighthouse targets are met; 2025/26 is signed off; the privacy check passes.

**Decide:** What next? Candidates: years before 2025/26; adding 2027/28 after the February 2027 Budget; making 2027/28 the default from 1 March 2027.

---

## Not in this plan

- The PRD's research-and-sign-off phase (Phase 0): getting two reviewers to approve the SARS parameters and storing snapshots of the sources. Do this alongside Phase 1 if you need formal sign-off.
- Analytics. The PRD allows page-view-only analytics later.
- Anything listed as out of scope in PRD §5.2.
- Tax years before 2025/26.
- SARS source codes, reference numbers or branding on the PDF (PRD Appendix C forbids them unless verified SARS mappings exist).
- Emailing, uploading or storing the PDF. It is only a download the person starts.
