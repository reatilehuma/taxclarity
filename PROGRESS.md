# Progress

Plan: [execution-plan.md](execution-plan.md)

## Phase 1: Foundation and the first real number ✅

**Run it:** `npm install`, then `npm run dev`, then open http://localhost:5173/workbench

**Built**
- npm workspaces monorepo: `apps/web` (Vite 8, React 19, TypeScript strict, Tailwind 4) and `packages/tax-engine` (pure TypeScript, decimal.js maths).
- `packages/tax-engine/src/rulesets/2026-27.ts`: the full PRD §6.15 parameter set with Appendix A source IDs. `assertValidRuleSet` checks that bracket bases add up, that each threshold equals its rebates ÷ 18%, and that the UIF maximum equals the ceiling × 1%.
- Engine: bracket tax, bracket walk, age rebates, R0 floor, UIF with ceiling, monthly PAYE (half-up to the cent), take-home, marginal and effective rate, below-threshold flag. Bad input (negative, NaN, Infinity) is treated as R0 and never throws.
- Workbench (development only, `/workbench`): gross salary and age band in; headline sentence, gross-to-net table and full bracket table out. Includes quick scenario buttons for the test vectors.
- `R 30 000,00` currency and percentage formatters.

**Tests:** 40 passing (`npm test`)
- Engine (26): T2–T9, rule-set validation, every bracket boundary and boundary + R1, all three age thresholds, bracket walk totals, rounding, gross − PAYE − UIF = take-home, bad-input safety, take-home never drops as gross rises.
- Web (14): currency and percentage formatting.

**Things to look at**
- R30 000, under 65 → PAYE R4 681,00, UIF R177,12, take-home R25 141,88 (26% bracket).
- Switch to 65–74 / 75+: annual PAYE drops by R9 765 / a further R3 249.
- R5 000 and R8 250 show the below-threshold note.

**Known gaps (by design, later phases)**
- `/` is a placeholder; there is no router yet (Phase 5).
- The production build only shows the placeholder; the Workbench is left out.

## Phase 2: Retirement, medical aid, pay frequency ✅

**Decision taken:** D5, yes. An employer's medical aid contribution is a taxable fringe benefit, added to income.

**Run it:** `npm run dev`, then open http://localhost:5173/workbench and click the **T1** scenario.

**Built**
- Engine input is now `CalculationInputs`: `grossAmount` per pay period, `payFrequency`, `ageBand`, optional `retirement` and `medical`. Bad values are cleaned in `normalise.ts`: negatives and NaN become R0, members are clamped to 1–15 and months to 0–12.
- Pay frequency: weekly × 52/12, fortnightly × 26/12. Results include per-period gross and take-home.
- Section 11F (`retirement.ts`): own + employer pool; employer contribution added to income as a fringe benefit; limit = 27.5% of the greater of remuneration or taxable income before the deduction, capped at R430 000; carry-forward amount.
- Section 6A (`medical.ts`): R376 / R376 / R254 per extra member, pro-rated by months covered, non-refundable (unused credit reported).
- Who pays the medical aid: SELF (comes off take-home), EMPLOYER (fringe benefit, per D5), SHARED (split).
- `provenance.appliedRules` on every result; `warnings` with `DEDUCTIONS_EXCEED_GROSS` (PRD E17).
- Workbench: salary + frequency, age, retirement panel, medical panel, scenario buttons (T1, T10, T11, employer medical, weekly, …), "How your tax is worked out" and "From salary to bank account" tables, Section 11F and 6A detail cards, rules-applied list.

**Tests:** 67 passing (engine 53, web 14)
- T1 (R3 149,00 PAYE, R23 673,88 take-home), T10, T11.
- Medical credit for 1, 2, 3, 5 and 15 members; part-year; credit can't make tax negative; own share comes off take-home.
- D5: EMPLOYER and SHARED medical; employer retirement contribution is tax-neutral within the limit; contributions above salary are capped and flagged.
- Weekly and fortnightly conversion.
- Property tests with fast-check (500 random cases each): tax never negative, take-home never falls as gross rises, deduction ≤ pool / 27.5% / R430 000, gross − deductions − PAYE − UIF = take-home to the cent, junk input never throws.

**Things to look at**
- **T1** → PAYE R3 149,00, take-home R23 673,88.
- **T11** → the retirement card shows the R430 000 cap applied and R170 000 carried forward.
- **Employer medical** → an extra "taxable benefit" line raises taxable income by R24 000; PAYE rises R144 a month.
- **Weekly** → the headline also shows take-home per week.

**Assumptions to confirm**
- Own medical aid is treated as a payroll deduction, so it reduces take-home, as PRD §10.3 Step J does. If someone pays by debit order, their bank deposit wouldn't drop. This matters for take-home mode in Phase 3.
- The Section 6A credit is not limited to the amount actually paid to the scheme. T1 needs this, because it has no contribution amount. I'm not certain whether the law limits the credit to fees actually paid. The PRD doesn't say, so it's worth checking. If confirmed, it's a one-line change plus a fix to T1's inputs.
- UIF is worked out on cash salary only, not on fringe benefits (PRD Step I).

## Phase 3: Take-home mode and variable pay ✅

**Decisions applied:** D1 (T16 corrected to ≈ R23 051,51), D4 (normal-month PAYE excludes tax on extras), and the debit-order option for medical aid (requested after Phase 2).

**Run it:** `npm run dev`, then open http://localhost:5173/workbench. Try **T16**, **Bonus** and **Debit order**.

**Built**
- **Engine input change:** `grossAmount` → `amount` plus `mode` (`GROSS` | `TAKE_HOME` | `PAYSLIP`). In take-home mode, `amount` is the normal bank deposit per pay period.
- **Take-home → gross solver** (`solver.ts`): fixed-point iteration seeded at take-home ÷ 0.75, R0,01 tolerance, bisection fallback, never throws. About 15 iterations and under 1 ms per calculation.
- **Confidence:** `ESTIMATE` in take-home mode, `PAYSLIP_ACCURATE` otherwise. Solver details are in `result.estimate`.
- **Variable pay** (bonus, overtime, commission, as annual amounts): a normal month's PAYE comes from regular income only (D4). Tax on extras = tax(all income) − tax(regular income), the balance-of-remuneration method. The 11F limit uses total income.
- **New results:** normal-month take-home, averaged-month take-home, and annual figures. `annualLiability` (final tax), `annualPaye` (withheld), `annualPayeRegular`.
- **UIF on extras:** averaged over the year and still capped, as the PRD allows; disclosed in a note.
- **Medical aid by debit order:** the bank deposit isn't reduced, and payroll is assumed not to apply the medical credit, so monthly PAYE is higher. The credit comes back on filing (`creditClaimedOnFilingAnnual`). If the employer pays any share, payroll still applies the credit.
- **Shared code:** `pipeline.ts` holds the building blocks used by both the main calculation and the solver.
- **Memoised calculator:** `createCalculator(rules)` keeps an LRU cache of 100 results keyed on a stable hash of the inputs. The Workbench uses it.
- **Notes and warnings:** `notes` (disclosures: estimate, bonus method, averaged UIF, credit on filing) and the warning `VARIABLE_PAY_HIGH`.
- **Workbench:** "I know my gross salary / bank deposit" switch, estimate badge with solver steps, bonus/overtime/commission panel, "How is your share paid?" for medical aid, three-column cash-flow table (normal month / average month / year), and a tax table that splits PAYE into regular, extras and credit claimed on filing.

**Tests:** 95 passing (engine 81, web 14)
- T16 (corrected), T1 solved back from its own take-home, zero take-home, weekly take-home, solver converging from R0,01 to R9 999 999.
- Bonus example: R30 000 + R30 000 bonus → normal-month PAYE R4 681, bonus tax R8 145, averaged take-home R26 963,13.
- Debit order: payroll PAYE R3 901 instead of R3 149, R9 024 credit claimed on filing, deposit not reduced, solver handles it.
- Memoisation: cache hit, key order ignored, LRU eviction.
- Properties (300–400 random cases each): gross → take-home → gross within 10 cents across all frequencies, ages and options; solver within 2 cents; tax on extras between 0% and 45%; averaged month reconciles to the cent; withheld − credit on filing = final tax.

**Things to look at**
- **T16** → amber "Estimate" badge, estimated gross ≈ R23 051,51.
- **Bonus** → normal month R25 141,88; averaged R26 963,13; the bracket table shows the bonus pushing you into 31%.
- **Debit order** → medical aid drops out of the cash-flow table, PAYE goes up, and "claimed back when you file" appears.

**Assumptions to confirm**
- Gross mode is labelled "Payslip-accurate" because the gross figure comes from a payslip. The PRD is ambiguous here; Phase 4 may tighten it to "only when payslip PAYE is entered".
- "More than 3× salary" (PRD §8 Step 5) is read as 3× the *annual* salary.
- **Retirement annuities paid by debit order have the same issue as medical aid.** The deposit isn't reduced, payroll doesn't deduct the contribution, and the tax saving comes back on filing. This isn't modelled yet. RA contributions are currently treated as payroll deductions.

## Phase 4: Extras, payslip comparison, flags (engine maths complete) ✅

**Decisions applied:** D2 (T14 corrected to R12 142,51) and D3 (T12/T13 tested directly on the 6B function). The RA debit-order option was added at your request. Phase 3 defaults are kept: gross mode stays "Payslip-accurate", and the high-extras warning uses 3× annual salary.

**Run it:** `npm run dev`, then open http://localhost:5173/workbench. Use **Load a PRD test vector** and compare the screen with the dark "Expect" box.

**Main design change:** the engine now works out the year twice:
- **PAYROLL view:** what this employer sees (salary, extras, fringe benefits, taxable travel allowance, payslip retirement contributions). This sets the PAYE withheld and the bank deposit.
- **FULL view:** adds private RA, donations, interest and the other job. This sets the final tax.
- **`filing`:** final tax − PAYE withheld − the other job's estimated PAYE, giving a refund or an amount owed when you file. This replaces Phase 3's `creditClaimedOnFilingAnnual`.

**Built**
- **RA by debit order** (`retirement.privateRaMonthly`): it shares the 11F limit, doesn't change payslip PAYE or the deposit, and the saving shows as a refund on filing.
- **Section 18A donations:** capped at 10% of income after the retirement deduction, carry-forward, receipt flag, and a large-gift flag above R150 000 (`rules.reference`).
- **Section 6B** (`medical6B`): both branches (25% under 65; 33,3% for 65+ or disability). Only worked out when out-of-pocket costs are given (even R0); otherwise a "possibly available" flag. Works without scheme membership too.
- **Interest:** exemption by age (R23 800 / R34 500), excess added to taxable income.
- **Travel allowance:** 80% taxable, or 20% at 80%+ business use. Paid in cash with the salary, and payroll withholds on the taxable part. The logbook deduction (km × R4,95, capped at the allowance) is shown as an estimate and **not** applied.
- **Second employer:** toggle plus optional amount. Income is added to the final tax, the other job's PAYE is estimated on its own, and the amount owed on filing is shown.
- **Payslip comparison** (gross and payslip modes): payslip PAYE vs what this payroll should withhold in a normal month; difference in R and %, a "close match" check within R1, and assumed UIF when blank. Warnings when payslip UIF is above R177,12 or payslip PAYE is above gross.
- **Flags** (`flags.ts`): 6 always-on exclusions plus 9 situation-specific ones, each linked to an Appendix A source.
- **Engine safety:** amounts are capped at R1 trillion so no result can overflow (found by the fuzz test).
- **Solver:** the bisection fallback is now tested (forced via a testing hook) and agrees with the main method to the cent.
- **Workbench** (split into `form.ts`, `inputs.tsx`, `results.tsx`): test-vector picker with expectations, Gross / Bank deposit / Payslip modes, payslip fields, private RA field, Section 6B fields, an optional-extras panel, plus comparison, filing, extras and flags cards.

**Tests:** 173 passing (engine 129, web 44)
- T12–T15, T17–T20 (plus T1–T11, T16 from earlier phases): **all 20 PRD vectors pass**, with the D1–D3 corrections.
- RA debit order, donations, 6B branches, travel, second employer, comparison, flags, E2/E14/E15/E18.
- Properties: every number in every result is finite; final tax = PAYE + other PAYE + filing balance; donations ≤ gift and ≤ 10%; credits ≥ 0; normal-month take-home reconciles to the cent.
- Fuzz: junk (NaN, ±Infinity, 10¹⁵, undefined, unknown enum values) in every field never throws.
- Web: every Workbench preset produces exactly what its "Expect" line says.
- **Coverage** (`npm run coverage -w packages/tax-engine`): 99% lines, 95% branches, 100% functions. The 90% thresholds are enforced in `vitest.config.ts`.

**Things to look at**
- **T17** → headline switches to "Your employer deducted R6 800,00; … our calculation gives R9 275,58", plus the neutral explanation.
- **Private RA** → PAYE unchanged at R4 681; "About R6 240 should come back to you when you file".
- **Two jobs** → "You could owe SARS about R29 665".
- **T14** → Medical credits card shows both 6A and 6B.
- **Good to know** → flags with SARS links.

**Assumptions to confirm**
- Donations are assumed not to go through payroll, so their saving arrives on filing. Some employers do apply 18A donations in payroll.
- The other job's PAYE is estimated as if it were that person's only income, so both payrolls apply the primary rebate. This is why combined jobs often owe tax.
- Travel allowance: the PRD treats only the 80%/20% portion as taxable income for the year, and the logbook deduction is shown but not applied. On a real assessment the full allowance is included and the logbook claim is deducted, so a refund or extra tax can result.
- Large-donation flag wording is hedged: as far as I know, gifts to approved public benefit organisations are generally exempt from donations tax, so the flag talks about gifts "that aren't exempt".

## Phase 5: Design system and landing page ✅

**Run it:** `npm run dev`, then open http://localhost:5173/. The Workbench is still at `/workbench` (development only).

**Built**
- **Design tokens** (`src/index.css`): one deep petrol-green "brand" family, green-tinted "ink" neutrals, estimate/accurate status colours, seven bracket shades, card radius and shadows. SA flag colours appear only as a thin stripe under the logo. Light theme only; every colour is a token, so dark mode would be a token swap later.
- **Fonts, self-hosted** (no request to Google or anyone else): Plus Jakarta Sans for text, Inter with tabular figures for money (the `.money` class), so amounts line up in columns.
- **Copy:** all user-facing text lives in `src/content/strings.ts` (D9), with the product name defined once (`PRODUCT_NAME`).
- **Routing** (React Router 8): `/` landing, `/wizard` and `/results` placeholders, a friendly 404, and `/workbench` loaded only in development. It is confirmed absent from the production bundle.
- **Shared components:** `Layout` (skip link, sticky header with tax-year and privacy pills, footer with disclaimer, tax-year dates, "last checked" date and SARS links), `ButtonLink` (44 px minimum tap target), `Pill`, `ConfidenceBadge` (icon + text, never colour alone), `Icon` set.
- **`TaxSummaryPanel`:** the dashboard from PRD §12.2 (badge, take-home/PAYE/annual tax, summary rows with keyboard-accessible tooltips, stacked bracket bar, collapsible full SARS bracket table with "You are here"). Phase 9's live preview will reuse it.
- **Landing page:** every PRD §13.1 section in order.
  - Hero with the required headline and two CTAs (`/wizard?start=take-home`, `/wizard?start=gross`).
  - Animated payslip → dashboard visual. It plays once and shows the dashboard straight away when reduced motion is on.
  - Trust strip, How it works, dark "What you'll see" section with the example panel, an 8-card capabilities grid, and the privacy promise.
- **Example figures** (`src/content/example.ts`): R32 000 gross, 7,5% pension, medical aid for 2. They come from the real engine, so the landing page can never disagree with the calculator.
- **Rule set:** `lastVerified: "2026-11-18"` was added (PRD Q3) and is shown in the footer.
- **`formatDate`:** "2026-03-01" → "1 March 2026".

**Tests:** 189 passing (engine 129, web 60)
- **Landing render tests** (jsdom): single h1 with the exact PRD headline, all sections present, CTA links, landmarks and skip link, example labelled, example figures equal a fresh engine run, one "You are here" row, tab title.
- **Routing tests:** wizard placeholder shows the chosen start, results links to the wizard, unknown paths show the 404.
- **Visual check with Playwright** (headless Chrome) at 1440 px and 360 px: no horizontal scroll (including with the bracket table open on a phone), no console errors, the animation's start and end states, the reduced-motion state, and keyboard-focus tooltips.
- Two layout bugs were found this way and fixed: an empty band in the hero card, and the bracket table pushing the phone layout 134 px wider than the screen.

**Budgets:** landing JS is 111,6 KB gzipped (PRD budget 150 KB); CSS 11 KB gzipped.

**Things to look at**
- The look overall: colour, type and spacing. Changing the direction is cheap now.
- Reload to watch the payslip turn into the dashboard.
- "What you'll see" → hover or tab to the ⓘ icons, and open "Full SARS bracket table".
- Narrow the window to phone width.

**To decide**
- **Product name:** "ClearTax SA" is the PRD's placeholder, but "ClearTax" is already the name of an existing tax company, so it's worth choosing a different name before launch. It's one constant in `strings.ts`.
- **Dark mode:** not built. Say if you want it; the tokens make it a contained change.

## Phase 6: Wizard shell and the first steps ✅

**Run it:** `npm run dev`, then open http://localhost:5173/ and click **Start with my bank amount** (or **Check my salary**, which starts at step 0).

**Built**
- **Flow** (`src/wizard/flow.ts`): step numbering follows D6 (0 start, 1 amount + pay frequency, 2 age). Adding a step in later phases means adding one entry here and one screen in `steps/index.ts`; routing, progress and the guards follow automatically.
- **In-memory answers** (`WizardContext.tsx`): nothing is written to storage, so a refresh starts again (Q1 stays "no"). The engine result is memoised by a hash of the answers.
- **Routing:** `/wizard?step=N`, with the browser Back and Forward buttons working. You can't skip ahead of an unanswered question by editing the address (`?step=2` on a fresh page shows step 0), and nonsense addresses are tidied up without adding to the history. The landing-page buttons use `?start=take-home|gross|payslip` to jump straight to the money question with the mode set. `/results` without the minimum answers redirects to the start.
- **Layout:** one question per screen, a progress bar on desktop and dots on phones, Back on every step after the first, a "Common questions" accordion under each step, and an "Enter" key that continues. Step 0 isn't counted, so "Step 4 of 8" will match the step numbers once all steps exist.
- **Reusable form parts** (`src/components/forms/`): `CurrencyField`, `ChoiceCards`, `SegmentedControl`, `Faq`, plus a shared `Button`.
- **Step 0:** three choice cards (real radio buttons, so arrow keys work). Continue is disabled until you choose.
- **Step 1:** the question changes with the mode and with how often you're paid, and a note shows the monthly equivalent from the engine for weekly and fortnightly pay. R0 is allowed with a friendly note; empty or negative amounts are refused gently; amounts over R10 million need a tick to confirm (PRD §9). In bank-account mode, "I'm not sure" shows a R1 000 to R150 000 slider.
- **Step 2:** age group, preselected to "Younger than 65". The rebate figures in the note come from the rule set, not typed copy.
- **Temporary results page:** the PRD's headline sentence, three figures, an Estimate or Payslip-accurate badge, the tax-year line, "Change my answers" and "Start over".
- **Currency field** (`src/lib/currency.ts`): accepts "R30 000", "30,000.00", "30 000,50", "1.234,56" and "30000"; groups thousands as you type; shows two decimals when you leave; keeps the cursor beside the digit you're editing as spaces appear.
- **Accessibility groundwork:** focus moves to the new question on every step change, progress is announced politely ("Step 1 of 2: Your pay"), the unit "(in rand)" is read out, and errors are linked to the field.

**Tests:** 307 passing (engine 129, web 178)
- Currency parsing and formatting (51 cases), the answers and flow logic, and 54 click-through tests: all three modes reach a result matching the engine, Back keeps your answers, address guards, zero/negative/very-high amounts, weekly and fortnightly pay, the slider, the `?start=` shortcuts, "Start over", refresh-restarts, and typing, pasting and cursor behaviour.
- **Real browser** (Chrome via Playwright, desktop and 360 px phone): typing, formatting, browser Back and Forward, refresh, deep links, no sideways scrolling, no console errors, and a keyboard-only run through all steps.

**Bugs found by the tests and fixed**
1. **Frozen tab on the landing buttons.** The entry component re-ran forever because `update` changed identity whenever the answers changed. `update` and `reset` are now stable, and a change that changes nothing no longer triggers a re-render.
2. **Error shown too early.** The amount field grabbed focus on arrival, then focus moved to the question heading (for screen readers), which counted as leaving the field and showed "Enter an amount" straight away. The field no longer auto-focuses: focus goes to the question, and Tab reaches the field.

**Budgets:** landing JS is 118,7 KB gzipped (PRD budget 150 KB). The Workbench is still absent from the production bundle.

**Things to look at**
- Click through all three starting points and read the wording of each question.
- Type and paste amounts in different styles; try weekly pay and the "I'm not sure" slider.
- Use browser Back and Forward, then refresh in the middle.
- Try it on your phone.

**Decisions made that you may want to change**
- **No auto-focus on the amount field** (see bug 2). On desktop you press Tab or click before typing. The alternative is to focus the field instead of the question; that suits typing, but screen-reader users then miss the question.
- **The progress counter skips step 0 and counts only the steps that exist**, so it currently reads "of 2" and will grow as later phases add steps.
- **Payslip mode currently behaves like gross mode.** The payslip PAYE and UIF questions come in Phase 8 (D7), so there's no comparison yet.

**Known gaps (by design, later phases)**
- Retirement, medical aid, variable pay and extras steps: Phase 7 and 8.
- No review screen yet: Phase 8.
- No live preview panel: Phase 9.
- The full results page: Phases 10 and 11.

## Phase 7: Wizard: retirement, medical aid, variable pay ✅

**Decisions applied:** the RA and medical-aid debit-order options you asked for earlier now appear in the wizard.

**Run it:** `npm run dev`, then open http://localhost:5173/ and click **Start with my salary**. Enter R30 000, then work through the steps.

**Built**
- **Step 3, retirement:** Yes/No cards ("No, none of these" is the skip). Yes shows two boxes: what's taken off your **payslip** (pension or provident fund) and what you **pay yourself from your bank account** (an RA by debit order). A "my employer also contributes" tick reveals the employer's amount. Live notes, all worked out by the engine: "about 16,7% of your salary", the carry-forward note when contributions go above the limit, a warning when contributions exceed salary, and a reminder that a debit-order RA saving comes back when you file. Needs at least one amount.
- **Step 4, medical aid:** Yes/No cards; a stepper for people on the plan (1 to 15, also typeable); the monthly total (R0 is fine); who pays (I pay it / My employer pays it all / We share it); the employer's share when shared (can't exceed the total); how your share is paid (off my payslip / by debit order); and optional medical costs the scheme didn't cover (this switches on the extra Section 6B credit). The employer-pays note quotes your credit from the engine; the debit-order note appears only when payroll really won't apply the credit.
- **Step 5, bonus, overtime or commission:** tick-chips (a tick plus colour, never colour alone). "None of these" clears the others, and picking a type clears "None". Each type picked asks for a rough yearly amount. The "more than 3× your salary" warning comes from the engine.
- **Flow:** the progress now reads "Step N of 5". Step 5 is the last, so its button says "See my result".
- **Answers model:** the three new groups are validated per step (`isRetirementComplete`, `isMedicalComplete`, `isVariableComplete`), and `toEngineInputs` maps them to the engine. Only the types you actually picked are sent.
- **Engine:** one addition, `retirement.ownPercentOfGross`, so the percentage on screen comes from the engine rather than sums in the page.
- **Results page** (still temporary) now reflects everything you entered.

**Tests:** 370 passing (engine 133, web 237)
- **T1 through the screens:** the click-through test enters T1 and gets PAYE **R 3 149,00**, take-home **R 23 673,88** and tax for the year **R 37 788,00**. The same numbers appear in a real browser at desktop and 360 px width.
- Each step's rules: No is enough; Yes needs an amount; the employer box; the debit-order notes; stepper limits and clamping; sharing limits; the "None" chip behaviour; negative amounts; the 3× warning; FAQs.
- Bonus example: a R30 000 bonus leaves a normal month's PAYE at R 4 681,00 and lifts the year's tax to R 64 317,00.
- Going Back and forward keeps answers; address guards; take-home mode uses the retirement answers when estimating gross.
- **Real browser keyboard run:** stepper buttons reachable, Space ticks chips, Enter submits from a chip.

**Problems found along the way and fixed**
1. **Engine overflow:** the fuzz test found that a salary of 5×10⁻³²⁴ rand made the new percentage Infinity. A salary under R1 a year now counts as none, and the percentage is capped at 10 000%.
2. **Test timeouts:** the longer wizard tests took about 5 seconds, right at the default timeout, so `npm test` failed intermittently. The timeout is now 30 seconds and typing in tests no longer pauses between keys. I caught this when two tests failed in the full run that had passed the run before.

**Budgets:** landing JS is 123 KB gzipped (PRD budget 150 KB). That's 27 KB of headroom for Phases 8 to 11, so I'll watch it. The Workbench is still absent from the production bundle.

**Things to look at**
- **T1:** Yes → R3 000 off your payslip; medical Yes with 2 people and R0; None of these. You should get R3 149,00.
- **RA by debit order:** put R2 000 in the second box and read the note.
- **Medical aid:** try "We share it", then "By debit order", and watch which notes appear.
- **Bonus:** tick Bonus and Overtime; "See my result" stays disabled until both have amounts.
- Try it on your phone.

**Choices I made that you may want to change**
- **Two retirement boxes instead of one amount plus a "how is it paid?" switch.** It handles someone with both a pension and an RA, which a single switch can't.
- **Skipped the informational questions:** the PRD's "which type of fund?" and "how many times a year do you get a bonus?". Neither changes any number, and the box labels already say which kind. Easy to add if you want them.
- **"Out-of-pocket medical costs" is in step 4**, per PRD §8 Step 4(d) and the plan. The PRD repeats it in the optional-extras step; I won't duplicate it there. Phase 8 will add only the "someone in my family has a disability" tick that goes with it.
- **No auto-advance on "No".** You tick No and press Continue, as with every other step.

**Known gaps (by design, later phases)**
- Optional extras (donations, interest, travel, second job, partial-year medical aid, disability tick), the payslip check and the review screen: Phase 8.
- Live preview panel: Phase 9. Full results page: Phases 10 and 11.

## Phase 8: Wizard: extras, payslip check, review ✅

**The wizard is now complete as specified.** Steps, per D6: 0 start, 1 amount, 2 age, 3 retirement, 4 medical aid, 5 extra pay, 6 optional extras, 7 payslip check, 8 review.

**Run it:** `npm run dev`, then open http://localhost:5173/ and click **Start with my salary**. Work through to the end.

**Built**
- **Step 6, optional extras:** a collapsed "Optional extras" section with a "N filled" chip. Inside: donations with an 18A-receipt tick (and a gentle reminder if you have none), interest, a travel allowance (revealing the business-use choice, business kilometres and a logbook note), a second employer (amount optional), and, for people with a medical aid, months on the scheme and the disability tick. The main button says **Skip** until something is filled in. It opens by itself when you come back to something already filled in.
- **Step 7, payslip check (gross and payslip modes only, per D7):** PAYE (required in payslip mode, R0 allowed; optional in gross mode) and UIF (optional; if blank we say what we'll assume). A UIF above the legal maximum and a PAYE above the salary give a warning but never block. Bank-account mode skips this step entirely ("Step 7 of 7").
- **Step 8, review:** answers grouped by topic (income, retirement, medical aid, extra pay, optional extras, payslip), with an **Edit** link per group and a **Change** link on rows edited elsewhere (starting point, age, months, disability). Only filled-in extras and payslip fields appear. The button reads **See my tax result**, with the PRD's small print.
- **Edit and return:** Edit takes you to the step and the main button becomes **Back to review**. Finishing, or pressing Back, returns you to the review with the new answer. It steps back in browser history instead of adding entries, so the browser Back button then goes to the step before the review. Changing how you started clears the amount and sends you to ask for it again.
- **Engine additions:** payslip amounts can be given **per pay period** (a weekly payslip is converted to a monthly figure, × 52 ÷ 12), plus `uifPerPeriod` on the result. The UIF-above-maximum warning no longer needs payslip PAYE to be entered.
- **Results page** (still temporary): uses the PRD's payslip sentence when payslip PAYE was given ("Your employer deducted R 6 800,00; … our calculation gives R 9 275,58"), and shows when you should expect a refund or owe SARS when you file.
- **Currency field:** a kilometres unit (whole numbers, "km" suffix).
- "See my result" is now "See my tax result" (PRD wording).

**Tests:** 436 passing (engine 141, web 295)
- **PRD vectors entered through the wizard model:** T14 (corrected), T15, T17, T18, T19, T20, alongside the earlier T1, T10, T11 and T16.
- **Review content:** groups, rows, Edit targets, weekly monthly-equivalent, assumed UIF, no payslip group in bank-account mode.
- **Click-through:** extras (collapsed by default, Skip→Continue, chip counts, receipt reminder, travel reveals, kilometres as whole numbers, second job, medical-only options), payslip (required vs optional PAYE, assumed UIF, both warnings non-blocking), review (every Edit link, round trip, browser Back, change of starting point), the T17 sentence on the result, and every mode walking its full flow.
- **Real browser** (Chrome, desktop and 360 px): T1 entered through every screen, plus the payslip step and review, gives PAYE **R 3 149,00** and take-home **R 23 673,88**, with the payslip sentence matching. Edit and return works; browser Back after an edit lands on the step before the review; bank-account mode ends at "Step 7 of 7: Review"; keyboard-only run passes; no sideways scrolling and no console errors.

**Bugs found along the way and fixed**
1. **UIF warning gap (engine):** the "UIF above the maximum" warning only appeared if payslip PAYE was also typed. Found by a click-through test.
2. **Browser Back after an edit** went back into the edit page; fixed as described above, with a test.
3. **Test mistakes of mine:** regex escaping and a typed-comma expectation. No product impact.

**Budgets:** landing JS is 128,2 KB gzipped (PRD budget 150 KB), leaving about 22 KB for Phases 9 to 11. The live preview and results page add real code, so I'll look at splitting the wizard from the landing page in Phase 9 if needed. The Workbench is still absent from the production bundle.

**Things to look at**
- Run the whole wizard as yourself. Read every question aloud and see which ones make you hesitate.
- Optional extras: fill several in, leave, and come back.
- Payslip step: try a UIF above R177,12 and a PAYE bigger than your salary.
- Review: click Edit on a group, change something, and watch it return. Then try the browser Back button.
- Bank-account mode: confirm there's no payslip step.
- Try it on your phone.

**Choices I made that you may want to change**
- **Payslip amounts are per payslip**, so weekly and fortnightly payers enter what's actually printed on their payslip. The engine converts.
- **PAYE above salary is a warning, not a block.** The PRD says validation "0 ≤ PAYE ≤ gross", but blocking someone who mistyped their salary seemed worse than a warning. It's a one-line change.
- **Medical-aid-only options (months on the scheme, disability) live in the extras step** and appear only if you have a medical aid.
- **Review rows for answers edited elsewhere** carry their own "Change" link rather than being hidden.

**Known gaps (by design, later phases)**
- Live preview panel beside the questions: Phase 9.
- The full results page (gross-to-net table, bracket working, comparison panel, flags): Phase 10. Education and recommendations: Phase 11.
- A few PRD copy items are placeholders until the results page: the payslip comparison's neutral explanation and the refund/owed wording are shown in short form only.

---

## Phase 9: Live preview dashboard

**Status:** done. Stopped for your review before Phase 10.

**Run it:** `npm run dev`, open http://localhost:5173/, click **Start with my salary**, and answer the questions. On a wide window (1024 px or more) a panel sits beside the questions; narrower than that, a bar sits at the bottom of the screen.

**What's new**
- **Wide screens:** two columns. The right-hand panel stays in view as you scroll and holds the badge, take-home, PAYE and tax for the year, the summary list with an info tooltip on each row, the bracket bar with your top rate marked, and the collapsible full SARS table with "You are here". If the panel is taller than the window (table open) it scrolls inside itself.
- **Phones:** a bar fixed to the bottom ("Take-home · PAYE", with an up chevron). Tapping it opens a full-screen sheet with the same panel. The sheet is a modal dialog: focus moves in, Tab and Shift+Tab stay inside, Escape or **Close preview** closes it and returns focus to the bar, the page behind can't scroll, and it closes if you move to another step (browser Back, say). The question pages leave room at the bottom so the bar never covers a button.
- **Empty state:** until there is an amount, grey placeholder lines and "Your numbers will show up here". The badge says "No numbers yet", not Estimate or Payslip-accurate, so it never claims something it doesn't know.
- **Debounce:** the panel recalculates once answers have been still for 150 ms. The first frame (arriving on a step with answers already in place) is immediate.
- **Screen readers:** one polite live region, and it only changes when the badge changes ("Your numbers are an estimate." / "Your numbers are payslip-accurate."). Nothing else in the panel is announced.
- **Not on step 0** (the "how do you want to start" screen): nothing to preview yet.
- The bracket table's sideways-scroll box is now keyboard-focusable.
- The summary card has slightly less padding on phones, so the table fits the 360 px sheet without pushing past the card's padding.

**Files:** `wizard/LivePreview.tsx` (new), `hooks/useDebouncedValue.ts` and `hooks/useMediaQuery.ts` (new), `wizard/WizardPage.tsx` (two-column layout), `components/TaxSummaryPanel.tsx`, `content/strings.ts` (`copy.live`).

**Tests:** 24 new (web total 319, engine 141, so 460). Debounce timing (nothing before 150 ms, the in-between value never shown); the bar and the panel equal the engine output for the same answers, for a bank amount, a gross amount and with a pension; the sheet (dialog semantics, focus in, Tab wrap both directions, Escape, Close, step change, scroll lock released, unmount while open); wide screen shows the aside and no bar; empty state; the badge follows the engine's confidence; exactly one live region; no preview on step 0; typing in the real wizard updates the bar.

**Real browser** (Chrome at 1440, 1024 and 360 px): the panel and bar give PAYE **R 3 149,00** and take-home **R 23 673,88** for T1 entered through the screens. Panel stays in view while scrolling; no sideways scroll or console errors at any size; the sheet traps focus (40 Tab presses, none escaped); Escape returns focus to the bar; browser Back with the sheet open closes it and lands on the previous step with focus on its heading; keyboard-only open and close works; a R1 500 000 monthly amount still fits the bar.

**Budget:** landing JS 129,98 KB gzipped (budget 150 KB), up 1,8 KB for this phase. No code splitting needed yet; I'll revisit in Phase 10 when the full results page lands.

**Choices to confirm**
1. **Gross-first mode shows "Payslip-accurate" as soon as an amount is typed** (the engine and PRD §2: gross-first = payslip-accurate, take-home-first = estimate). It happens before age, pension or medical are answered, which may feel generous. Alternative: say "Estimate" until they reach the payslip step.
2. **Breakpoint is 1024 px.** Tablets in portrait get the phone bar and sheet.
3. **Phone preview is a sheet, not inline.** Keeps the questions uncluttered, but the numbers are one tap away.

**Known gaps**
- The panel always shows monthly figures, even for weekly or fortnightly pay (per-payslip take-home is on the results page).
- The sheet has no slide-up animation; it appears at once.
- Duplicate screen-reader headings "Your numbers" inside the panel (one h3, one table header). Cosmetic; from Phase 5.

---

## Phase 10: Results page, the numbers

**Status:** done. Stopped for your review before Phase 11.

**Run it:** `npm run dev`, open http://localhost:5173/, run the wizard to the end and click **See my tax result**. For the payslip comparison, choose "My payslip" or add PAYE on the payslip step.

**What's on the page, top to bottom**
1. **Summary:** badge, tax-year line, the headline sentence (estimate pattern, or the payslip pattern when payslip PAYE was given), three tiles, refund/owed note, a "Please check" box for engine warnings, then **Adjust my answers** (now goes to the review screen, not step 0), **Copy summary** and **Start over**.
2. **From your salary to your bank account:** gross, extras, travel allowance, your retirement and medical on the payslip, PAYE, UIF, take-home. Columns "A normal month" and "Whole year". Debit-order medical aid and RA are listed under it as "not off your payslip".
3. **How your taxable income is worked out:** income lines, retirement and donation deductions, taxable income (annual).
4. **Your tax, bracket by bracket:** the full SARS table from the engine's `bracketWalk` with your income in each, tax on it, running total, and one "Your top bracket" tag.
5. **From tax on your income to the tax you owe:** tax before rebates, rebates itemised (primary, 65+, 75+), unused rebates if any, medical credits (6A, 6B), your tax for the year.
6. **Your employer's tax compared with your final tax:** tax for the year, PAYE withheld, other employer's PAYE, then "Refund when you file", "You owe when you file" or "Nothing to pay or claim".
7. **Payslip comparison** (only with payslip PAYE): both numbers, the difference in rands and %, UIF, and the PRD §14.4 neutral explanation word for word.
8. **How we got these numbers:** the engine's notes (assumptions) in plain language.
9. **What this does not include:** every engine flag with a one-line explanation and a link to its SARS page (new tab).
Every table row has an info tooltip (hover, tap or keyboard focus).

**Engine changes (all pure, all tested)**
- New `buildBreakdown(result)`: the tables as data, so the page does no tax maths. Rows appear only when relevant.
- **Cent drift fixed at the source.** The new "adds up to the cent" property test found real 1-cent differences: (a) the filing balance was worked from unrounded figures, now from the rounded ones shown; (b) the Section 6B credit is now a whole number of cents. A few lines in the tax blocks can also absorb a difference of at most one cent so each block adds up as a person would add it. Headline figures are never changed by this.

**Tests:** engine 155 (14 new), web 352 (33 new): total 507.
- **Reconciliation (the Phase 10 gate):** across 1 500 generated inputs the engine's payslip block adds to take-home exactly (monthly and annual); income minus deductions equals taxable income; tax minus rebates minus credits equals the year's tax; tax minus PAYE minus other employer's PAYE equals the filing balance. A second test reads the rendered page and re-adds the table in cents across 40 generated answer sets.
- Page tests: T1 values, PRD row order, every row has a tooltip, the bracket table equals the engine's walk, comparison appears only with payslip PAYE (and is neutral: no blame words), flags and links, notes, warnings, extras row, debit-order block, low-earner unused rebates, refund and owing cases, Copy summary (success, refusal, no network calls).

**Real browser** (Chrome, 1440 and 360 px; T1 via payslip, and a busy case with a bonus, travel allowance and second job): T1 gives "Your employer deducted R 3 149,00; … our calculation gives R 3 149,00", take-home R 23 673,88, tax for the year R 37 788,00; no console errors; no sideways page scroll; tooltips open on keyboard focus; Copy summary puts the expected text on the clipboard.

**Bugs found along the way and fixed**
1. Payslip comparison percentage showed as "1110%": the engine's figure is already a percentage and my formatter multiplied it again. Caught by a page test.
2. Phone: the "Whole year" column was cut off at the card edge. Tightened padding and text size; the table now also scrolls sideways as a safety net.
3. The two cent-drift engine bugs above.

**Budget:** landing JS 134,9 KB gzipped (budget 150 KB). The results page now loads on demand (4 KB gz of its own), so it isn't in the landing bundle.

**Deviations and choices to confirm**
1. **D11 (added to the plan):** the PRD §14.2 row order can't add up as written (see plan). I split the table into blocks that each add up, in the same relative order, and show UIF as a deduction not "plus UIF". Tax blocks are annual only (a month figure for "tax before rebates" has no meaning).
2. **"Adjust my answers" goes to the review screen.** One tap to the group you want to change.
3. **No "Ask the AI assistant" button** until Phase 13.
4. **Every result has about 8 "does not include" cards** (the PRD's required set). It is long; say if you want them collapsed.

**Known gaps (later phases)**
- Education cards and recommendations: Phase 11. A short "coming soon" line stands in.
- Weekly and fortnightly pay: the tables show monthly equivalents; per-payslip take-home is in the summary line.
- Printing and PDF: none, by design.

---

## Phase 11: Results page, education and recommendations

**Status:** done. Stopped for your review before Phase 12. The core product is now complete.

**Run it:** `npm run dev`, finish the wizard and read the results page below the payslip comparison. Try three profiles and compare: (1) gross R30 000 with a R3 000 pension (26% bracket), (2) gross R30 000 with no pension, (3) gross R65 000 with no pension (39% bracket).

**What's new on the results page**
- **How your answers shaped your tax:** one card per answer that changed the result, each with a plain-language explanation and, where there is one, a "Saves you R x a year" chip. Cards: retirement savings, medical aid credit, age rebate, donations, bonus/overtime/commission, UIF, travel allowance, bank interest, extra medical costs (6B). Only answered things get a card (a plain salary shows just UIF).
- **Ways to keep more of your pay:** the PRD's R1 to R9, each with a tag: "Worked out for you", "Estimate" or "Good to know". The PRD disclaimer sits underneath ("general education suggestions… not personalised financial advice"). In order: R2 or R1 (retirement), R9 (39%+ bracket), R3 or R4 (medical credit), R5 (donations), R8 (extra medical costs), R6 or R7 (tax-free savings).

**How the savings are worked out:** not by a rule of thumb. The engine re-runs the calculation with one change (same gross pay), so the saving already includes bracket edges, rebates and credits. In the middle of a bracket it equals the amount times the marginal rate exactly (R1 000 more a month in the 26% bracket saves R3 120 a year; tested). Examples are capped to fit the room left under the 27.5% / R430 000 limit, and no idea is shown to someone who pays no tax, because it would save nothing.

**Engine:** new `buildExplanations` and `buildRecommendations` (pure; numbers and codes only, no sentences). Engine tests 186 (31 new), coverage 97%.

**Tests (web 366, 14 new):** every recommendation has a trigger and no-trigger test; no idea appears without its trigger (400 generated profiles); only CALCULATED ideas carry rand savings (300 generated profiles); savings never exceed the tax or the top rate × the amount; page tests for each card and idea; and the gate: **every rand figure printed in the education and advice sections is an engine figure**, checked across four profiles by matching each "R …" on the page against the engine's numbers.

**Real browser** (Chrome, 1440 and 360 px, four profiles): no console errors, no sideways scroll, cards and ideas read cleanly. T1 shows R780 a month saved by the pension and R752 a month medical credit; the 39% profile shows "saves you 39 cents" and a R9 360 a year saving for R2 000 a month.

**Bug found in my own browser check:** the script saw the old wizard page while the results page was still loading (the router keeps the old screen until a lazily-loaded page is ready). Only the script needed fixing; the app was fine.

**Budget:** landing JS 137,6 KB gzipped (budget 150 KB). The results page is its own 5,5 KB chunk, but all copy lives in one strings file in the main bundle. If we need room, moving the results copy into the results chunk is the first lever.

**Choices to confirm**
1. **R6 and R7 never appear together.** R6 (you're near the interest exemption, 80% or more of it) replaces R7. Both are "Good to know" and carry only rule limits, never a saving.
2. **R7 shows for everyone** who isn't shown R6, assuming nothing about existing tax-free savings (as the PRD says).
3. **R4 shows only what you could use.** A low earner's possible credit is capped by their actual tax, and the card says so.
4. **R1 and R2 examples are R1 000 and R2 000 a month**, and are dropped if there is less than R100 a month of room.
5. **The bonus card says it is taxed "at your top rate"**, which is how the engine works out extras (D4).

**Known gaps**
- The travel card's "up to about R x" logbook figure is an estimate and is labelled so; it isn't in the main numbers.
- No "Ask the AI assistant" button yet (Phase 13).

---

## Phase 12: Accessibility, responsiveness and end-to-end tests

**Status:** done. Stopped for your review before Phase 13.

**Run it:** `npm run ci` runs everything below in one go (lint, type check, all unit tests, then the browser tests against a production build). One-time setup on a new machine: `npm install` and `npm run e2e:install`. Pieces on their own: `npm run lint`, `npm test`, `npm run e2e`. `.github/workflows/ci.yml` runs the same steps on GitHub when this goes into a repository.

**By hand, which is the real test:** use the whole app with only the keyboard (Tab, Shift+Tab, Space, Enter, arrow keys, Escape), then on your phone.

**What was added**
- **End-to-end tests** (`apps/web/e2e/`, real Chrome, desktop 1440 px and phone 360 px, 66 runs): three ways to start with the engine's own figures as the expected answer; a matrix of age bands and optional steps (65 to 74, 75+, weekly and fortnightly pay, bonus/overtime/commission, employer pension, retirement annuity, second job, travel allowance, a low earner, a high earner); results-page behaviour (Adjust, Start over, refresh, Copy summary, nothing stored).
- **axe-core in the real browser** (so colour contrast is measured): landing, 404, every wizard step empty and answered with its optional parts open, error states, results (several profiles), the preview panel and phone sheet. **Zero critical or serious problems, and zero lesser ones.**
- **Keyboard-only walkthrough:** from the landing page's skip link to the result and back into the review, every Tab stop checked for a visible focus indicator (by comparing screenshots with and without focus), every step change checked for "focus moved to the new question" and the announcement ("Step 4 of 8: Medical aid"); tooltips by keyboard; phone sheet traps Tab and Escape returns focus.
- **Layout at 360, 768, 1024 and 1440 px:** nothing sticks out sideways on landing, any wizard step (with every optional part open) or results; side panel from 1024 up and bar below, never both; every tap target at least 44 px on phones and tablets; the bottom bar never covers the Continue button.
- **Reduced motion:** nothing animates and no transition is longer than a blink; the landing page does animate when motion is allowed, so the test means something.
- **Component tests** for the currency field (typing, pasting, formats, units, hint and error wiring, never rewriting while you type), segmented control (arrow keys, one tab stop), choice cards, chips and the stepper.
- **Lint** (oxlint, with React, hooks and accessibility rules) is part of CI. I used oxlint because typescript-eslint doesn't support TypeScript 7 yet.

**Real problems the checks found, all fixed**
1. **Colour contrast:** secondary grey text failed AA on the page background in places (3:1 for some, 4.4:1 for others). Darkened the two greys; everything now passes.
2. **Invalid markup in the summary panel** (a `<dl>` with a wrapper inside), flagged "serious" by axe. Split into two lists.
3. **Phone sheet focus trap leaked:** Tab could escape the sheet when the bracket table inside a closed section was counted as the last stop. Fixed and covered.
4. **Landing to wizard moved no focus**, so a screen-reader user heard nothing on arrival. Now focus goes to the first question's heading (a fresh page load still starts at the skip link).
5. **Heading order** in Optional extras (h3 under h1). Now h2.
6. **Header tap targets** were 36 and 40 px. Now 44.
7. **Stale copy:** a FAQ still said "Change my answers" after Phase 10 renamed it "Adjust my answers".
8. A `setState` in an effect (lint) in the stepper, now derived during render, and a missing `aria-checked` in a dev-only workbench switch.

**Tests now:** engine 186, web 392 (unit/component, jsdom), end-to-end 66 runs. All pass in a full `npm run ci` (about 4 minutes). Along the way the browser tests showed three timing races in my own test code, not app bugs: pressing Tab before the new step had finished drawing, axe measuring a card mid fade-in, and a busy machine hitting the 30 s limit (now 45 s). Each was fixed; if one test ever fails once on a busy machine, re-run before suspecting the app.

**What I could not test, and you should**
- **Real screen readers** (NVDA, VoiceOver, TalkBack). axe and the keyboard checks catch a lot but not how it sounds. If you can, try the amount question, the medical aid question and the results table with one.
- **Safari and Firefox.** Only Chrome is installed here. The PRD wants latest two of Chrome, Safari, Edge, Firefox, and iOS 15+.
- **A real phone**, including the on-screen keyboard (the amount field asks for a decimal keypad).
- Contrast was measured on the light theme only; there is no dark theme.

**Choices to confirm**
1. **Lint is oxlint, not ESLint** (reason above). Easy to swap later.
2. **Tap-target rule is 44 px for buttons, fields and choices.** Links inside sentences, the footer and the tiny "i" tooltip icons are exempt; WCAG 2.1 AA has no size rule, but if you want the "i" icons bigger, say so.
3. **Browser tests run against the production build**, so they take about 3 minutes, and they need `npm run e2e:install` once.

**Known gaps**
- No automated visual-regression screenshots; I looked at screenshots by hand at each phase.
- No test of `prefers-contrast` or Windows forced-colours mode.

---

## Phase 13: Offline, performance, deployment

**Status:** built and tested locally. **Not deployed:** I have no hosting account and did not put anything on the internet. Stopped for your review before Phase 14.

**Run it:** `npm run build`, then `npm run serve -w apps/web` and open http://localhost:4173/ (this serves the production build with the real security headers, compression and caching). The full gate is `npm run ci`; `npm run lighthouse` and `npm run links:check` are separate (they take a minute and need Chrome / the internet).

**To try offline:** open the served site once, reload, then in Chrome DevTools > Network choose "Offline" (or turn on airplane mode on a phone using the deployed site) and calculate again, all the way to the results.

**What was added**
- **Offline:** a small hand-written service worker (`apps/web/sw/sw.template.js`; the build fills in the file list and a version). After the first visit the app's files are kept in the browser, so the calculator opens and works with no connection. It never touches other websites, never caches anything you typed (the answers aren't in any request), and a new release takes over only when every old tab is closed, so a page never mixes two versions.
- **Smaller first load:** the questions and the results page now download only when needed (the Start buttons fetch the questions as soon as you point at them). Landing JavaScript went from 137,8 KB to **127,0 KB** gzipped (budget 150 KB). `npm run bundle:check` is part of `npm run ci`.
- **Lighthouse, mobile settings (a mid-range phone on slow 4G), local production build:** Accessibility, Best Practices and SEO are **100** on the landing page, the first question and the start screen every time. Performance is **92 to 96** in a normal run (targets: 90 / 95 / 95 / 90). It is noisy on this machine: three Vite dev servers from earlier sessions are running and eating CPU, and the odd run dropped to 75 or 59 while a second job was busy, so treat anything near 90 as "measure again". The score that counts is the live address on a quiet connection: `npm run lighthouse -- https://your-address`.
- **Security headers** (`public/_headers`, read as-is by Netlify and Cloudflare Pages): strict Content Security Policy (everything only from the site itself, no framing, no plugins), `nosniff`, `Referrer-Policy: no-referrer`, Permissions-Policy, HSTS, cross-origin isolation, and cache rules (hashed files for a year; the page and `sw.js` never cached). A `_redirects` file sends every address to the app.
- **Privacy check, automated** (`e2e/privacy.spec.ts`): a full run with every kind of answer (retirement, medical, bonus, travel, second job, payslip) makes only requests for the site's own files, all plain GETs, none carrying an amount, no live connections; other sites are blocked and not even attempted; nothing is stored (no cookies, local or session storage, or databases); the policy is never violated; only same-site files are kept for offline use.
- **Launch checklist:** `docs/LAUNCH-CHECKLIST.md`, with the automated items ticked and the by-hand items left for you. Disclaimers, the "last checked" date, security headers, meta tags, manifest and link safety are all checked in `e2e/launch.spec.ts`. `npm run links:check` found all 13 official links working (needs internet, not in CI).
- **Runbook for 2027/28:** `docs/RUNBOOK-NEW-TAX-YEAR.md`, and the spike it rests on: a made-up 2027/28 rule set (every parameter moved) runs through the whole engine with no logic changes, and a test fails if anyone writes a year or SARS figure into the engine's code. The app now has one switch, `CurrentTaxRules`; the tax year and dates in the copy follow it, and a test fails on every sentence that still quotes an old rand figure.
- **Deployment notes:** `docs/DEPLOY.md` (Cloudflare Pages or Netlify, build settings, other hosts, HTTPS, after-deploy checks).
- **Also:** a favicon, web manifest (installable on a phone), robots.txt, social sharing tags, and a friendly "this page didn't load" screen if a file can't be fetched.

**Real problems found and fixed**
1. **The strict policy caught two mistakes:** the build embedded one tiny font inside the CSS (blocked by the policy), and the header named a `Permissions-Policy` feature browsers no longer recognise. Fonts are now always real files; the header is clean.
2. **No favicon**, which would have shown as a 404 in the browser console on every visit.
3. **A hero animation used a blur filter and `transition: all`**, costing layout time on phones. Removed.
4. **The first Lighthouse run on a cold machine sometimes scores 0** (no paint recorded). That is the tool, not the page; the script now retries.
5. **The strict policy also blocked my own accessibility scanner** (it injected a script tag). I changed the scanner instead of loosening the policy.
6. **A keyboard user could tab to a control hidden behind the phone preview bar.** The page now keeps a margin under the header and above the bar when it scrolls to a focused control.
7. **The landing hero animation re-rendered the page on a timer**, a long task during load. It is now pure CSS (transform and opacity only), which cut blocking time.
8. **Stale copy risk:** the footer, questions and results quoted the tax year as plain text in 14 places. They now read from the rule set.

**Tests:** engine 205 (19 new), web 410 (14 more, including the copy-figures guard and service-worker file list), end-to-end 90 runs (24 new: offline, privacy, launch). A full `npm run ci` is green (about 6 minutes).

**Choices to confirm**
1. **Hosting:** the config targets Cloudflare Pages or Netlify (they read `_headers`/`_redirects`). Tell me which you prefer, or if you already have a host, and I'll adjust.
2. **Referrer policy is `no-referrer`**, the most private setting. Links to SARS don't tell SARS where you came from.
3. **The offline copy updates when all tabs are closed**, not instantly. Safer (no mixed versions); the cost is that a user who never closes the tab sees the old version for a while.
4. **The installable-app manifest uses the SVG icon only.** Some phones want PNG icons to offer "Add to home screen"; I can generate them if you want that.
5. **No social sharing image** yet (links will show text only).

**Known gaps**
- "Lighthouse targets met on the live URL" can only be checked after you deploy; run `npm run lighthouse -- https://your-address`.
- Real-device offline test (airplane mode on a phone) and Safari/Firefox are by hand.
- The landing-page JavaScript is below budget but the whole landing page still weighs about 140 KB transferred; fonts are the next lever if it ever matters.

---

## Phase 14: AI assistant, consent and offline explainer

**Status:** done. Stopped for your review before Phase 15. **There is no AI model and no outside service in this phase.** The assistant is a "local explainer": it writes its answers from templates, on your device, using only the calculator's figures. Everything around it (consent, the allow-list, the figure checker, the audit log, the prompt) is the real thing that a real model will plug into in Phase 15.

**Run it:** `npm run dev`, finish the wizard, and click **Ask the assistant** on the results page. Try: decline, then accept, then ask "Which tax bracket am I in?", "How much would an RA save me?" and "Why is my bonus taxed so heavily?".

**What was added**
- **`packages/assistant`** (new, pure TypeScript, 65 tests, 96% coverage):
  - **Payload allow-list.** The assistant sees one object built field by field from the calculator's result: numbers, yes/no flags and a few fixed labels. There is nowhere to put a name, ID number, tax reference, employer or bank detail, and a gate refuses any field or any piece of free text that is not on the list (tested with 15 forbidden names, nested and top-level, and with fuzzed results).
  - **"No invented numbers" checker.** Finds every rand amount in a reply (any way it is written: "R 3 149,00", "R4,250", "R4 250.50") and checks it is a figure the calculator gave. A rounded or worked-out figure fails.
  - **Guarded asking.** Payload checked before the provider sees it; a reply with an invented figure is replaced by a plain apology and never shown; a failing provider gives "Assistant unavailable…"; every answer is written to an in-memory audit log.
  - **Prompt for a real model** (used in Phase 15): never calculate, copy figures exactly, no advice, South African personal income tax only, neutral, ignore instructions inside questions. The question, the data and the rules are kept apart.
  - **The local explainer:** answers about brackets, PAYE, take-home, UIF, retirement/RA, medical credit, bonus, age rebates, donations, travel, interest, refund/owing, payslip differences and key terms, and politely refuses advice.
- **Consent (PRD §15.2.2):** the first use shows a window saying what happens. For this version it says plainly that nothing is sent anywhere and that it is not an AI model. Wording for an outside AI service is written and tested, ready for Phase 15. "Enable assistant" stores **one thing**: the name of the assistant you agreed to (`localStorage`, wrapped for blocked storage). "No thanks" (or Escape) stores nothing and shows "Assistant unavailable. Your results are fully calculated…". A yes given to a different assistant does not carry over.
- **Chat drawer:** loads only when opened (its own 9,7 KB download), full screen on phones and a side drawer on wide screens. Shows the chip "Explanations on your device · calculations by the calculator", suggested questions, each answer's "Checked: all N figures match your results", and a "What was checked" list. Keyboard: focus goes to "Enable assistant" or the question box, Tab stays inside, Escape closes, focus returns to the button.
- **Entry point:** "Ask the assistant" button beside "Copy summary".

**Tests:** assistant package 65; web 433 (23 new: no network call or storage before consent, decline path, remembered yes, blocked storage, answers with the calculator's figures, an invented figure replaced, a failing provider, keyboard behaviour, every figure in the chat is a calculator figure); engine 205; end-to-end 102 passing (14 new assistant runs on desktop and phone: consent first, only the yes stored, only same-site GET requests, keyboard-only use, axe clean on the consent window and the chat, fits both screen sizes, works offline).

**Problems found and fixed**
1. "What is PAYE?" was answered with the working-out of your PAYE rather than a definition. Fixed (caught by a browser test).
2. The chat's scrolling area was not reachable by keyboard (axe: serious). Fixed.
3. A regular expression of mine lost its `\b` markers when I wrote it through the shell; found by a test and rewritten.
4. The results page's Tab order gained a button, so one keyboard test needed updating.

**Budgets:** landing JavaScript 129,4 KB gzipped (150 KB budget), because shared code moved into one common file; the assistant's own chunk is separate.

**Choices to confirm**
1. **Honest labelling.** The PRD's chip says "AI explanations". Because this version is not AI, the chip says "Explanations on your device · calculations by the calculator". The AI wording is ready for Phase 15.
2. **A "no" is not remembered**, so it asks again next time (storing a "no" would be a second thing written to the device).
3. **Consent is asked even though nothing leaves the device**, so the flow, wording and storage rule are exercised now. If you would rather skip it until a real service exists, it is a one-line change.
4. **No floating "?" on the wizard steps** (PRD §15.3 mentions one for generic questions); the plan only had the results-page button. Easy to add.
5. **The assistant's replies live in the assistant package, not in the copy file**, because they are generated from figures. They are English only and covered by the same figure checker.

**Known gaps**
- The local explainer matches keywords, so an oddly worded question gets the "here is what you can ask" reply. A real model (Phase 15) is the fix, and it will be held to the same checker.
- A reply's figures are checked; its wording is not (a model could still say something unhelpful). Phase 15 adds recorded-reply tests and one manual live check.
- I did not re-run the whole `npm run ci` after fixing the last keyboard test; its last full run was otherwise green (102 browser runs passing) and that one spec passes on its own.

---

## Phase 15: AI assistant, real provider

**Status:** built and tested end to end **with a stand-in for the model**. **Not run against the real Claude API:** I have no key, and a live call spends money, so that is yours to do (command below). Not deployed. Stopped for your review: this is the last planned phase.

**Run it (no key needed):** the browser tests run the real page against the real proxy with a stand-in model. To try the same thing by hand: `VITE_ASSISTANT_PROVIDER=remote npx vite build --outDir dist-remote` in `apps/web`, then `ASSISTANT_FAKE_MODEL=1 node scripts/serve.mjs --dir dist-remote --port 4174` and open http://localhost:4174.

**To go live with the real model** (full steps in `docs/DEPLOY.md`): create an Anthropic API key with a monthly spending limit; add it as a Pages secret `ANTHROPIC_API_KEY`; set the build variable `VITE_ASSISTANT_PROVIDER=remote`; add a rate-limit rule on `/api/assistant`; then run `ANTHROPIC_API_KEY=... npm run assistant:smoke` and read the answers.

**What was added**
- **`packages/assistant-proxy`:** the project's only server-side code, and the only place the key lives. A web-standard `Request`/`Response` handler, so it runs as a Cloudflare Pages Function (`apps/web/functions/api/assistant.ts`, same address as the site, so the content policy does not change), under the local server, or in a Netlify function (a few lines, not written because the host is not chosen).
  - Accepts one kind of request: POST, JSON, from this site's own origin, a question (500 characters), up to 8 earlier turns, and the calculator's payload. Anything else (wrong method, other or missing origin, extra or personal fields, free text, oversize) gets a bare error and **the model is never asked**.
  - Builds the model's input from the same rules, data and question as the app (rules and data kept apart from the question), calls Claude, and checks every rand amount in the answer against the calculator's. A bad answer gets **one retry** that names what was wrong, then a plain apology. A model refusal is an apology; a failure is "unavailable" with no detail, key or question in it.
  - Logs only the *kind* of failure. Never a question, answer or figure (tested). Stores nothing. Rate limit per visitor (best effort; add the host rule too).
- **The Claude call** (`@anthropic-ai/sdk`): model `claude-opus-5-5` by default (change with `ASSISTANT_MODEL`), `effort: low` for short answers, server-side fallbacks on (a platform safety decline is retried on a fallback model automatically), no thinking override, no forced tool choice, no sampling parameters. A test pins this request shape so API changes show up.
- **Real provider in the app** (`RemoteAssistant`): builds its request only after the payload passes the allow-list, with no cookies and no referrer, and any failure becomes "Assistant unavailable".
- **Consent for an outside service:** wording adapted from the PRD (it names Claude/Anthropic, says we store nothing and the service may keep requests for a limited time under its own terms) and a **"See exactly what would be sent"** section showing the real payload as it would go. Chip: "AI explanations · calculations by the deterministic engine".
- **Live check:** `npm run assistant:smoke`. Ten sample questions (bracket, PAYE, RA saving, bonus, take-home, an instruction-override attempt, a request for investment advice, UIF, refund) through the real proxy code and the real model; prints each answer and whether every figure was one the calculator provided. `-- --record` saves the answers as the recordings CI replays.

**Tests:** proxy 53 (95% coverage), assistant 65, engine 205, web 435, browser 116 runs (12 new on a second build served with the stand-in model: consent first and nothing sent before yes; exactly what is sent; only this site's proxy, only the allow-listed request, no cookies or referrer, only the yes stored; an invented figure never shown, a refusal, a failure, and a retry that succeeds; offline; the proxy turning away outside callers; axe clean on the consent preview and the chat). A full `npm run ci` is green (about 6,5 minutes).

**Problems found and fixed**
1. My stand-in model read the first question in the conversation instead of the latest, so a failure test showed the wrong message. Fixed (it only affected the test model, not the product).
2. Node could not run the live-check script because of a TypeScript shortcut in `RemoteAssistant` (constructor parameter properties). Rewritten with plain fields.
3. A line in the browser test assumed an absent header where Chrome reports an empty one.

**Honesty about what is and is not proven**
- **Recorded replies are scripted, not recorded.** `recorded/replies.json` is hand-written to look like real answers (plus bad ones on purpose) and is labelled so. CI replays it through the real proxy. Real recordings need your one live run.
- **The checker proves numbers, not wording.** A real model could still say something unhelpful or oddly worded. Read the smoke output.
- **I have not seen a real model answer these questions.** The instruction in the prompt about never calculating is the part most worth reading the live answers for, especially "What would happen to my tax if I got a R10 000 bonus?": the model has no figure for that, and the right answer is to say so, which the checker will force it towards.

**Choices to confirm**
1. **Provider and model (Q7): Claude via Anthropic's API, default `claude-opus-5-5`.** That is the platform default, not a cost-driven choice. For a free public tool, `claude-haiku-5-5` is far cheaper and may explain just as well; one variable changes it, and the live check will show whether the answers hold up.
2. **Host:** the proxy is a Cloudflare Pages Function. A Netlify version is small but unwritten.
3. **Consent wording mentions that Anthropic may keep requests briefly.** The PRD's wording said only "Nothing is stored by us"; I added the provider's retention because it is true and the person is being asked to share their numbers.
4. **One retry on an invented figure** (so a bad answer costs up to two model calls). Easy to remove.
5. **The AI build is switched on by a build variable**, not detected at run time, so a visitor never makes a request before saying yes.

**Known gaps (v1 is otherwise complete)**
- Real-model live check and recordings (yours, above). Safari and Firefox, real screen readers and a real phone, still by hand.
- No wizard "?" helper (PRD §15.3), no Netlify adapter, no progress that survives a refresh (Q1), no translations (Q6), no 2027/28 rules yet (runbook is ready).
- The in-memory rate limit is per running copy of the function.

---

# Part 2: tax-year selector and PDF summary

## Phase 16: 2025/26 rule set (draft) and a year switch in the Workbench

**Status:** done. Stopped for your review before Phase 17. **2025/26 is a draft: nobody has signed it off.** It can be chosen in the Workbench only. The product itself is unchanged and still calculates 2026/27 only.

**Run it:** `npm run dev`, open http://localhost:5173/workbench (the port Vite prints). Use the **Tax year** dropdown in the header; the page shows an amber "Draft: not signed off" banner on 2025/26. Three tabs on the right: **Results** (as before, now for the chosen year), **Compare years** (your inputs through both years side by side, differences highlighted) and **Parameters** (every value of the chosen year with links to its source).

**What was added**
- **The 2025/26 figures, with sources:** `docs/rulesets/2025-26-sources.md`, one row per value (32 rows) with the document, the exact place, and notes, plus open items and a blank sign-off table for your reviewer. This is the file to send.
- **`rulesets/2025-26.ts`**, built only from that file. Status `draft`, version `2025-26-draft-1`. Nothing was copied from 2026/27 and no gap was filled with a 2026/27 figure.
- **A registry** (`RULE_SETS`, `getRuleSet(year)`) listing both years with their status. An unknown year throws; there is no fallback. `TaxYear` is now `"2025-26" | "2026-27"`. Every rule set has `status` and `rulesVersion`. `CurrentTaxRules` is still 2026/27, so the whole product is unchanged.
- **Two new sources** (S16 SARS Budget 2025 tax guide, S17 the Gazette notice on the rate per km) in the sources list.
- **A guard in `npm run bundle:check`** that fails if a draft tax year is found in the production build. It caught a real problem on the way: the draft year had leaked into the production bundle (nothing used it, but the build kept it). Fixed by marking the rule-set definitions as side-effect free. I removed the fix to confirm the guard fails, then put it back.

**The 2025/26 figures at a glance**

| | 2025/26 | 2026/27 |
|---|---|---|
| First bracket | up to R237 100 | up to R245 100 |
| Primary rebate | R17 235 | R17 820 |
| Tax-free threshold (under 65) | R95 750 | R99 000 |
| Retirement cap | R350 000 | R430 000 |
| Medical credit (main / extra) | R364 / R246 | R376 / R254 |
| Tax-free investment limit | R36 000 | R46 000 |
| Rate per km | R4,76 | R4,95 |
| UIF ceiling, interest exemptions | unchanged | unchanged |

R30 000 a month, no extras: final tax R57 397 for 2025/26 against R56 172 for 2026/27.

**Tests:** engine 220 (new: registry, 2025/26 validation, figures typed from the SARS formulas, a hand-worked R30 000 case, thresholds either side of each age limit), web 444 (new: year dropdown, draft banner, labels follow the year, Compare, Parameters, every parameter names a real source), browser 116 runs passing. Lint and types clean. T1–T20 are untouched and still pass.

**Changed to make this work**
- The threshold check in `assertValidRuleSet` now rounds to the nearest rand. SARS prints whole rands, so 2025/26's R148 217 (R26 679 ÷ 18% = R148 216,67) could not pass the old exact check. It still catches a wrong threshold and says what it should be.
- Workbench labels that named 2026/27 (the age question, the UIF warning, bracket headings) now follow the chosen year. The PRD test vectors are 2026/27 results, so their "Expect" box is hidden on another year.

**Open items (all in the sources file; none changes a bracket figure)**
1. **The 2025/26 brackets come from one source.** SARS's own page prints no 2026 bracket table, only "No changes". They come from the SARS Budget 2025 tax guide. Cross-check one bracket against the SARS PAYE tables.
2. **The copy of that guide I read is the February 2025 edition** (it still carries the VAT increase later withdrawn). Its personal-tax figures agree with SARS's page, but confirm against the final March edition.
3. **Donations tax exemption:** R100 000 in the guide; SARS's page now says R150 000 and gives no date. Only used for a flag.
4. **UIF ceiling:** SARS's page says R17 712 since 1 June 2021. I could not see the Department of Labour's own notices.
5. **A SARS rounding quirk:** at exactly R148 217 (65 to 74) the engine shows R0,06 of tax, because SARS rounds that threshold to a whole rand. A rand either side behaves as expected.

**Known gap:** `phase6.test.ts` has a random test ("rand savings never exceed what is possible") that failed once in this session on a one-cent difference in take-home mode (seed -2026929401, 2026/27, a fortnightly case with a bonus and a large medical bill). It passes on most runs. It is in code Phase 16 did not touch, so I left it alone; worth a look before Phase 17.

**Not done (later phases):** `taxYear` on inputs and results, the selector in the product, year-specific copy, anything PDF.

---

## Phase 17: Year-aware engine and 2025/26 test vectors

**Status:** done. Stopped for your review before Phase 18. 2025/26 is **still a draft** (nobody has signed it off). The product still calculates 2026/27 only; the year selector is Phase 18.

**Run it:** `npm run dev`, open `/workbench`. The **Load a PRD test vector** dropdown now has two groups: the 2026/27 PRD vectors (T1–T20) and the new **2025/26 reference vectors Y1–Y19**. Loading one switches the year and shows its expected figures. The **Rules applied** panel at the bottom of Results now says which year, rules version, status, period, check date and sources produced the numbers. Try: load Y1, switch the year to 2026/27 and back, and the figures return exactly.

**What changed in the engine**
- **The year is part of the input.** `CalculationInputs.taxYear` (left out means 2026/27). Every result carries its `taxYear`; the engine uses that year's rule set for everything: the take-home solver, flags, explanations and recommendations.
- **No mixing, no fallback.** `getVerifiedRuleSet(year)` throws a typed `TaxYearError`: `UNKNOWN_YEAR` (no such year), `UNVERIFIED_YEAR` (a draft, in a build that does not allow drafts) or `YEAR_MISMATCH` (inputs for one year given to another year's rules). It never returns a different year.
- **Drafts cannot reach production, structurally.** The registry now lists only signed-off years; drafts live in their own file (`rulesets/drafts.ts`) that only the Workbench and tests import. A caller allows drafts by passing the draft list in. A production build has none of the 2025/26 figures in it, and `npm run bundle:check` fails if they ever appear (it did catch two leaks while I built this, see below).
- **The cache cannot return the wrong year.** Every cached result is keyed on year and rules version. `createYearCalculator()` serves both years from one cache; switching away and back returns the same stored result.
- **Provenance** now carries year, rules version, status, period, last-checked date and every source ID.
- `CurrentTaxRules` is now just the default year, found through the registry. The default year is one line (`DEFAULT_TAX_YEAR`).

**The 2025/26 reference vectors**
- 19 vectors: a worked example, bracket edges, the three age thresholds either side, the UIF ceiling, zero income, the retirement cap, medical credits for 1, 2 and 5 people, a bonus, a bank deposit turned back into a salary, and the extra medical credit.
- **Every expected number was worked out independently of the engine**, by a separate calculator written only from the published SARS formulas. I first checked it reproduces the PRD's T1 exactly (R3 149,00 and R23 673,88), and the same method gives R23 051,52 for the corrected T16. The working for each vector is in `docs/rulesets/2025-26-vectors.md`, written so someone can check it with a pen.
- All 19 matched the engine on the first run.
- **What this does and does not prove:** I found no SARS-published worked example for 2025/26, so the vectors prove the engine follows the published formulas, not that SARS agrees to the cent. A reviewer task is in the vectors file: run Y1 and Y3 through the SARS online calculator.

**Other tests added**
- Cross-year: the same inputs differ between years (R30 000 a month: R57 397 against R56 172 final tax), and switching back restores the original to the cent.
- Boundaries for **both years**, read from each year's own rule set: every bracket edge, thresholds by age, rebates, the UIF ceiling, the retirement cap, medical credits by member count, PAYE rounding.
- Recommendations follow the year: for the same person, R1's room and saving (R816,72 against R4 920), the R4 credit (R364 against R376) and the R7 tax-free limit (R36 000 against R46 000).
- The property and fuzz suites now run for both years (finite numbers, final tax never negative, more pay never less take-home, round trip, solver within 2 cents, junk in every field never throws).

**Tests:** engine 303 (coverage 99.4% of lines, target 90%), assistant 65, proxy 53, web 465, browser 116 runs (10 skipped as before). Lint and types clean. T1–T20 untouched.

**Bugs found and fixed along the way**
1. **A real engine bug.** A pay frequency like `"toString"` made the engine crash instead of falling back to monthly (a prototype-name lookup). It cannot happen from the wizard's buttons, but the engine promises never to throw on input. Found by the new fuzz suite; fixed; pinned by a test.
2. **The flaky Phase 6 test I flagged last time.** Not an engine bug: its cap on "how much a rand off income can save" ignored that an under-65's extra medical credit grows as taxable income falls (up to 1.875 cents per rand). The bound now includes it, derived from the rules. The exact failing case is pinned as its own test.
3. **A flaky proxy test** (unrelated to this phase): it checked a random question was not a substring of the fixed instructions, and failed when the random question was a word the instructions contain ("name"). It now checks the instructions are identical whatever is asked, which is stricter.
4. **Draft year leaked into the production bundle twice** while restructuring (a call inside an annotated expression, then an array spread, both counted as possible side effects). The guard from Phase 16 caught both; the lists are now plain references.

**Choices to confirm**
1. **Not every screen was moved off `CurrentTaxRules`.** The plan says every caller should use the selected year. There is no selected year until Phase 18, so changing them now would swap one constant for another with no effect. `CurrentTaxRules` still means "the default year", from the registry, and those screens move in Phase 18 when the selector exists. The Workbench, the engine and the tests already use the named year.
2. **How a draft is allowed.** The caller passes the draft list in (`DEV_YEAR_OPTIONS`), rather than a simple on/off flag, so it works at the level of what ships, not just at run time.
3. **`taxYear` is optional on inputs** (left out = 2026/27), so every existing caller keeps working. Phase 18 makes the wizard always set it.

**Known gaps**
- The recommendation "top bracket" threshold (39%, R9) is still a number in the code. Both years have a 39% bracket so it is right today; Phase 19 moves it into the rule set with the other year-specific wording.
- Some Workbench "Good to know" notes under 2025/26 still cite the 2026 Budget (year-specific copy is Phase 19).
- `docs/RUNBOOK-NEW-TAX-YEAR.md`: the add-a-year steps are updated for the new mechanism; Phase 23 rewrites the whole runbook.

---

## Phase 18: Tax-year selector in the product

**Status:** done. Stopped for your review before Phase 19. **In a production build the selector shows one year (2026/27) as plain text**, because 2025/26 is still a draft and the rules say no unsigned year may reach production. The full selector (two years) appears in development and in the test build.

**Run it:** `npm run dev`, open http://localhost:5173/ (the port Vite prints). You will see a **Tax year** dropdown listing both years with their dates (2025/26 is tagged "Draft"). It is in five places; they all change the same year:
1. the landing page, under the start buttons;
2. the top of the wizard;
3. the live preview (the side panel on a wide screen; inside the sheet on a phone);
4. the review screen (a "Tax year" row with a Change link that takes you to the selector at the top);
5. the results page, under the year line.

Try: start with a gross salary of R30 000, then switch to 2025/26. The preview updates (PAYE R4 783,08 instead of R4 681,00), the notice "Tax year changed to 2025/26. Your results have been recalculated using that year's rules." appears at the top and is announced politely, and your answers are still there. Switch back and the first figures return exactly. Then try the age question: choose "65 to 74", switch to 2025/26, and you are asked to check your age group before any numbers show.

**What was built**
- **The year lives in the wizard's in-memory store**, starting at 2026/27 (a refresh or "Start over" returns to it; nothing is stored, D16). Changing it keeps every answer and the mode and recalculates through the year-aware engine from Phase 17. The preview does not wait for its usual typing delay when the year changes, so figures from the year just left never linger.
- **The age question (D15).** Age is measured on the last day of the tax year, so the same answer can mean something different in another year. After a year change the person is asked to check it **only when it could differ**: an earlier year if they said 65 or older, a later year if they said younger than 75. Under 65 going back, and 75+ going forward, are never asked. Until it is checked, **no numbers are shown** (the preview, the results page and the review screen show the question instead). Picking a different group counts as checking it. This is measured from the year they actually answered for, so going away and coming back to that year never asks.
- **Labels follow the chosen year:** the results year line and dates, the bracket-table caption and the preview's table caption, the age question's date, the "SARS 2025/26 rules" payslip sentence, the "tax for the year" hints, the UIF-too-high warning, the review small print, the header pill and the footer's year and "last checked" date. **Copy summary** takes its year and dates from the result itself, so the text always matches the numbers. The assistant is given the result's own year's rules.
- **Production builds list only signed-off years.** The year module allows drafts only in development, or in a test build that sets `VITE_ENABLE_DRAFT_YEARS=1`. The draft's figures are not in the production bundle (`npm run bundle:check` confirms it, and the browser tests download every script and check). `docs/DEPLOY.md` says never to set that variable on a real deploy; the bundle check would fail the build if someone did.
- **Accessibility.** A native select (keyboard and screen reader for free) with a label; two selectors on one screen have different names ("Tax year" and "Tax year for this preview"); with one year it is plain text, not a dead control. The notice is a polite live region that stays until dismissed (it does not vanish before it can be read).

**Tests**
- 28 new unit and component tests (age-group rules in both directions, year change keeps answers, notice text, labels, results for 2025/26, the payslip sentence, Copy summary, the landing page, the review screen's Change link). Figures used are the independently worked ones from Phase 17.
- 26 new browser runs on the draft-enabled build: switch year on the results page in **all three modes** (gross, bank amount, payslip) on desktop and phone; switch in the wizard with no old-year figures left; the age question and its confirmation; the review screen; the keyboard alone; and **axe on every placement** (landing, wizard, preview, the phone sheet, results, and the age-question states). Two more runs on the normal build check it offers one year, shows no "Draft", and never downloads the draft's figures.
- Totals: web 493, engine 303, assistant 65, proxy 53, browser 142 (10 skipped as before). Lint and types clean. Landing JavaScript 131,4 KB (budget 150).

**A flaw I found in my own first design:** I moved the age anchor forward automatically when no confirmation was needed. That made 2026/27 → 2025/26 → 2026/27 wrongly ask an under-65 to confirm. Fixed by computing "needs checking" from the year they actually answered for; a test pins it.

**Choices to confirm**
1. **The review screen's "Edit" for the year is a Change button that jumps to the selector at the top**, not a link to a step, because the PRD says no new step is added.
2. **The age check does not move you in the wizard.** Changing the year on step 5 leaves you on step 5; the question appears in the preview and on the review and results screens (and in place of the age control on the age step). On a wide screen it shows twice on the age step itself (the question and the preview). I left that rather than hide the preview's copy, since the preview is the part that would otherwise show nothing.
3. **"Start over" returns to 2026/27**, like a refresh.
4. **A test build exists only for testing** (`dist-years`, port 4175), added to the Playwright config and the lint and git ignore lists.

**Known gaps (Phase 19 and later)**
- Wording that quotes a figure still says 2026/27 when 2025/26 is chosen: the retirement FAQ ("capped at R430 000"), the landing page's trust strip, hero example and sample payslip (these stay on the default year, as planned, and should say so), and some "Good to know" notes that cite the 2026 Budget.
- The assistant's allow-list and the proxy do not carry the year yet, so asking the assistant while on 2025/26 (development only) would send a year label the proxy does not know. Phase 19.
- The mobile sheet's age question and the preview's duplicate on desktop could be tidied once real users have tried it.

---

## Phase 19: Year-specific copy, tips and the assistant

**Status:** done. Stopped for your review before Phase 20. In a production build there is still one selectable year (2026/27); everything below is visible in development (`npm run dev`) and in the test build, where 2025/26 can be chosen.

**Run it:** `npm run dev`, open the landing page and pick **2025/26** in the Tax year dropdown. Then look at:
- the trust line ("Based on official SARS 2025/26 rules") and the three capability cards (retirement "up to R 350 000", medical "R 364 … R 246"); a note under the example dashboard says it always uses 2026/27;
- the wizard's Retirement step FAQ (cap R 350 000) and the Medical aid FAQ (credits);
- on the results page, the "Good to know" links ("National Treasury: 2025 Budget") and the tips (tax-free savings R 36 000);
- the assistant (Results, then "Ask the assistant"): every figure answer begins "These figures are for the 2025/26 tax year." and quotes 2025/26 limits.

**What was built**
- **No sentence quotes a tax figure by hand any more.** Every sentence that names a limit, credit or rate is a template (`ruleCopy()` in `strings.ts`) filled from the selected year's rule set: the retirement limit FAQ, the UIF tooltip in the preview, the landing page's trust line and capability cards. The fixed copy now holds no rule figure at all. (As a side effect these now use the same `R 430 000` format as the rest of the app.)
- **The copy test checks both years.** `figures.test.ts` now (1) fails if the fixed copy contains any tax-rule figure (I checked it by planting a stale "R430 000" and watching it fail); (2) checks every sentence rendered for each year contains only that year's figures and rates, and names only that year; (3) allows a percentage in fixed copy only if every year has that rate.
- **Source links follow the year.** A link that names a year is chosen per result (`sourceFor`): the flag links under 2025/26 say "National Treasury: 2025 Budget". `npm run links:check` reads the same file, so it covers both years: **15 links checked, 0 broken** (run today, including the 2025/26 Budget tax guide and the Gazette notice).
- **The "top bracket" tip threshold moved out of the code** into each rule set (`guidance.topBracketRate`, validated to be one of the year's bracket rates). It was the known gap from Phase 17.
- **Landing example:** the example dashboard and sample payslip stay on 2026/27 and say so when another year is chosen.
- **The assistant follows the year.**
  - The payload's year must be a year the calculator knows, and must be present; any other spelling or a missing year is refused by the app's allow-list **and by the proxy** (same check, so the model is never asked).
  - The prompt tells the model which year the data is for and not to use another year's rates, limits or thresholds.
  - The local explainer opens every figure answer by naming the year.
  - The "no invented numbers" check reads the selected year's result, so a figure from the other year counts as invented: the 2026/27 cap R 430 000 quoted to a 2025/26 result is replaced, and the other way round.
  - The recorded replies now have a profile for each year (scripted, labelled as such), each with a reply that is right for its year and one quoting the other year's figure. `npm run smoke -w packages/assistant-proxy -- --year=2025-26 --record` records one year at a time.

**Tests:** engine 306, assistant 72, proxy 64, web 525, **browser 162 passed** (10 skipped as before), twice in a row. New: golden paths for **both years in all three modes** starting from the landing page (numbers, year line, bracket table, footer, nothing from the other year, accessibility), the year's limits in the retirement and medical FAQs, the assistant naming the year and quoting only its figures, the landing page in both years, and the unit tests above. Lint and types clean. Landing JavaScript 131,9 KB (budget 150).

**Two real gaps found and fixed by the new tests**
1. A payload with **no** `taxYear` at all passed the allow-list (it only checked keys that were present), and so did a *number* as the year. Both are refused now.
2. `docs/RUNBOOK-NEW-TAX-YEAR.md` described the old copy mechanism; updated for templates, per-year sources, the assistant's recorded replies and the new tip threshold.

**A flaky browser test, fixed (not caused by this phase's code, but exposed by its extra load)**: the two assistant "works offline" specs read the service worker's cache with `caches.open((await caches.keys())[0])`. If the worker had not yet made its cache on the first check, that opened a new empty cache called "undefined", which was then read forever. A quick machine wins the race, a busy one loses (it failed in each of my first three full runs of this phase, then passed twice in a row once fixed). They now query only the app's own cache without opening anything, like `offline.spec.ts` already did. I also gave the keyboard "visible focus" check more time to settle.

**Choices to confirm**
1. **Percentages are guarded, not templated.** I templated every *rand* figure and the percentages in the sentences already being templated (27,5%, UIF 1%). Other percentages in fixed copy (10% donations, 80% business use) stay as text, and the test fails the moment a year changes one of them. Say if you want those templated too.
2. **The assistant's year check accepts any year the calculator knows** (including a draft), not only signed-off ones, because whether a year may be used is the calculator's decision. Nothing in production can select 2025/26 until it is signed off.
3. **Format change:** amounts that were typed as "R430 000" now read "R 430 000", like everywhere else.

**Known gaps**
- The recorded replies are still hand-scripted for both years; a real recording needs your one live run per year.
- The Workbench's own (development-only) notes were not changed.
- Nothing PDF yet: that is Phase 20.

---

## Phase 20: PDF summary, library and first page

**Status:** done. Stopped for your review before Phase 21. The PDF has the header, details, **Table 1 (income and taxable amounts)**, the disclaimer and the footer. Deductions, the tax calculation, the reconciliation and the flags are Phase 21.

**Run it:** `npm run dev`, finish the wizard, and on the results page press **Download PDF summary** (beside Copy summary). A file like `cleartax-sa-summary-2026-27-2026-11-20.pdf` downloads. Open it next to `docs/reference/summary-example.pdf`. In development you can also switch to 2025/26 first and get that year's PDF.

**What the page has** (A4 portrait, real searchable text, the app's own Inter font):
- the product name, the title **South African Income Tax — Calculation Summary**, the subtitle **Independent estimate — not a SARS assessment**;
- a **Details** block: tax year, period, date generated, how the calculation started, confidence. No reference number, no ID, no name;
- **Table 1, Income and taxable amounts**: one row for each kind of income that applies (salary, bonus/overtime/commission, taxable travel allowance, employer contributions, second job, taxable interest) and a **Total income**, amounts right-aligned with the total shaded;
- the §14.8 **Disclaimer**; a footer with the rules version, the date the figures were last checked, and **Page X of Y**.

It follows the reference's structure (title block, dark section bars, ruled tables, shaded totals, disclaimer box, page footer) in the app's own teal. No SARS logo, codes or reference number (D13). I filed your example at `docs/reference/summary-example.pdf` (D12).

**The library choice (D20):** I prototyped **pdfmake** and **jsPDF + AutoTable** with the same job (70-row table, Inter font, repeated headings, "Page X of Y") under the site's exact content policy, in Chromium. Both ran with no policy violations and extract text. **Chosen: pdfmake**: it subsets the font (20 KB file against 77 KB), numbers pages natively, has a declarative layout that suits the table-first look, and **can tag the PDF for screen readers** (jsPDF cannot), which Phase 22 needs. The cost is about 150 KB more to download, once, when someone first presses the button (about 289 KB against 140 KB gzipped). Full comparison in `docs/PDF-LIBRARY.md`.

**How it is built**
- **`packages/pdf-export`** (new) in two halves: a pure builder that turns a calculation result into a "summary document" (rows, totals, wording already applied, no layout), and a renderer (pdfmake) in a **separate entry** so a page that only needs the data never loads the library. The builder only selects and formats engine figures: **no tax arithmetic**.
- **The app** (`apps/web/src/pdf/createSummaryPdf.ts`) is loaded only when the button is pressed. It builds the document with the app's own formatters and wording and loads the fonts from the app's own assets. `npm run bundle:check` now also fails if the PDF library ever appears in the landing page's scripts (landing JavaScript is 132,2 KB, budget 150).
- **All the wording is in the strings module** (`copy.pdf`); the package holds no English.
- **The typeface:** the PDF libraries do not apply OpenType features, so Inter's tabular digits would be lost. A small script (`packages/pdf-export/scripts/make-fonts.py`) bakes them into the digit glyphs only, so amounts line up in a column. Licence kept with the fonts (SIL OFL). My first version also changed punctuation, which spread hyphens apart; I caught that on viewing the page and fixed it.
- The PDF is made on the device from the same result the page shows. The library is told it may not fetch any address, and the file's metadata holds only the app name, the title and the creation day (no author, subject or keywords).

**Tests:** package 23 (new): the builder (every row is the engine's own row, in the results page's order; rows that do not apply are left out; **the rows add up to the total exactly across 500 generated calculations in both years**; no identifying fields), and the renderer read back with pdf.js (A4 size, every part of the text present, the right year and no other, embedded Inter, tagged with language set, generic metadata only, **no network used**). Web 539 (new: the real adapter with real fonts and renderer; the button's states, download name, failure message and retry; **Table 1 matches the results page's income table to the cent in both years**). Browser **170 runs** (10 skipped as before): real downloads in Chromium on desktop and phone, both years, checking the file name, the PDF's text and figures against the engine, that only same-site GETs are used, that the PDF code is **not fetched until the button is pressed**, and axe on the results page. Lint and types clean. Engine 306, assistant 72, proxy 64 unchanged.

**One existing test changed on purpose:** the keyboard walkthrough counted tab stops on the results page; the new button is a real extra stop (and now has its visible focus checked like the others).

**Choices to confirm**
1. **Confidence wording.** I used the PRD's "Payslip-based calculation" in the PDF, but the results page badge says "Payslip-accurate" for the same thing. One word list would be tidier; say which you want.
2. **The five detail rows** are the ones the PRD lists. I did not add pay frequency or the age group; easy to add if you want them.
3. **A draft year's PDF** (development only) says "Rules 2025-26-draft-1" in the footer but is otherwise identical. Phase 23 will not let a draft year reach production; a "Draft" mark on the page itself would be easy to add.
4. **Where the PDF code is stored:** the service worker already keeps every file in the build for offline use, so the PDF chunk and fonts (about 400 KB together) are downloaded in the background after someone's first visit, but not by the page itself. Phase 22 checks offline use.

**Known gaps (Phases 21 and 22)**
- No deductions, tax calculation, take-home, reconciliation, payslip comparison or flags tables yet; multi-page layout is only tested with a long prototype table, not with the final tables.
- Offline export, the privacy check beyond the checks above, the failure path under a forced renderer failure, and phone download behaviour on iOS Safari are Phase 22.
- Tagging is switched on and checked for presence; reading order and screen-reader behaviour are verified in Phase 22.

## Phase 21: PDF summary, all tables

**Status:** done. Stopped for your review before Phase 22. The PDF now holds the full summary: every table on the results page that matters on paper, adding up to the figures on screen.

**Run it:** `npm run dev`, finish the wizard and press **Download PDF summary**. Try three profiles: a plain salary; a bonus with a retirement annuity and medical aid; payslip mode with everything filled in (four pages). Compare with `docs/reference/summary-example.pdf`.

**What is on the pages, in order**
1. **Details** (as in Phase 20) and **Table 1, Income and taxable amounts**.
2. **Table 2, Deductions:** section 11F retirement contributions and section 18A donations (only the ones that apply), **Total deductions**, then a highlighted **Taxable income**. A note says taxable income is Table 1 less these deductions, and that payroll deductions that are not tax-deductible (medical aid payments) are not here.
3. **Table 3, Tax calculation:** normal tax before rebates; each rebate; tax after rebates; the section 6A and 6B credits; the highlighted **Calculated annual income-tax liability** (D17: never "refund" or "payable"); then the payroll figures, each saying "per month" or "per year" in its label (D18): estimated PAYE, PAYE on your payslip (only if you gave it), UIF, take-home per month and per year. A note appears if part of the medical credit could not be used.
4. **Payslip comparison** (only when payslip PAYE was given): the four figures, the neutral §14.4 sentence ("These match, to within R1." / "higher" / "lower"), and "What a difference can mean".
5. **From salary to bank account** (D19): the results page's own block, with "A normal month" and "Whole year" columns, "+" and "−" signs, a dash where one month makes no sense (bonus), and a note about what a normal month leaves out when there is bonus, overtime or commission. If part is paid by debit order (medical aid, retirement annuity) a second small table, "Paid by debit order, not off your payslip", follows.
6. **Please check** (engine warnings, if any), **How we got these numbers** (assumptions, if any) and **What this does not include** (the engine's flags), each flag with its SARS source written out as text, using the selected year's source where the address names a year.
7. The §14.8 **Disclaimer** and the footer on every page.

**Left out on purpose:** the results page's "your employer's tax compared with your final tax" table (refund or owed). It is what D17 and §14.8 say the PDF must not imply.

**How it is built**
- The package's builder now makes every table from the engine's own `buildBreakdown` rows, so screen and paper cannot drift. The only addition is the **Total deductions** row, which is the deduction rows added in whole cents. Still no tax arithmetic.
- **Shared wording:** the payslip comparison sentences, assumptions, warnings and exclusions are the results page's own strings, word for word (`pdfText` in the strings module composes them with the PDF's own headings); a test checks this.
- **Layout:** short tables are kept whole on one page; the exclusions list can break across pages, repeating its heading bar; no row is split; a heading is never left alone at the foot of a page; body text stays at 9.5 pt (small print 8 to 8.5 pt, URLs 8 pt).

**Tests**
- Package 48 (was 23): every table's rows equal the engine; which rows appear and when; **across 400 generated calculations in both years and all three modes (GROSS, TAKE_HOME, PAYSLIP): income − deductions = taxable income; tax before rebates − rebates (+ unused) = tax after rebates; − credits = liability; gross + extras + travel − own retirement − own medical − PAYE − UIF = take-home, in both the monthly and the annual column**, all within R0.01 (in practice exact); the PDF read back with pdf.js: every row present and in document order, A4, "Page X of Y" on each page, nothing outside the margins, nothing overlapping, nothing under 7.5 pt; a long exclusions list that breaks across pages with the heading repeated and every item whole.
- Web 542 (was 539): the PDF's deductions, tax working and salary-to-bank rows equal the results page's tables cell for cell (monthly and annual) in both years; the shared sentences are the page's own; no "refund" or "payable" in the tax rows.
- Browser: the PDF spec now checks all tables' headings and the page count, rather than one page.

**Choices to confirm**
1. **Table 3 also carries the payroll figures** (PAYE, UIF, take-home) as the plan says, so PAYE and take-home appear twice (also in the salary-to-bank table). Say if you would rather drop them from Table 3.
2. **Assumptions and warnings** are on the PDF too, not only exclusions, because they explain why a figure may differ from a payslip. Easy to remove.
3. **A taxpayer 65 or over:** the age rebates are labelled "Less: age rebate (65 and over)" / "(75 and over)".
4. **Length:** a full profile is four pages; a plain salary is two.

**Known gaps (Phase 22)**
- Offline export, the privacy check beyond the above, the forced-failure path, iOS Safari and Android download behaviour, and the reading order check with a screen reader.

## Phase 22: PDF summary, offline, privacy, failures and phones

**Status:** done. Stopped for your review before Phase 23. Most of the export's safeguards were built in Phases 20 and 21; this phase adds the tests that prove them in a real browser, the retry button, and the deploy notes. Only one line of app code changed.

**Run it:** `npm run dev`, finish the wizard, press **Download PDF summary**. To see offline: open the app once, wait a few seconds, switch DevTools to **Offline** (or airplane mode on a phone), reload, go through the wizard and download again. To see the failure path: in DevTools → Network, block `InterTabular` and press the button.

**What changed in the app**
- After a failure the button reads **Try again** (the message "We couldn't create the PDF. Please try again." stays in a status line, the results stay on screen, and Copy summary still works). Pressing it makes a fresh attempt.
- Nothing else: the "Creating PDF…" state, the announcement when the file is saved and the lazy loading were already there.

**What was already true, and is now proved in the browser**
- **Offline:** the service worker already stores every file in the build. A new test waits until the PDF code and both font files are in the offline copy, switches the network off, reloads, completes a calculation and downloads the PDF. It checks no request failed and none went to another address. The landing page still never loads those files (checked in Phase 20).
- **No network use while making it:** for every mode in both years on desktop and phone, the test records every request during the download: all to this site, all plain GETs, none with a body, none failed, no page errors.
- **Metadata:** the file holds the app name (creator, producer), the title and the creation date only; no author, subject or keywords, no amounts. (Checked in the package tests since Phase 20.) The title is kept on purpose: a tagged PDF needs one for screen readers.
- **Content-Security-Policy:** unchanged; it works under the current policy with no `unsafe-eval`. Written up in a new "The PDF summary" section of `docs/DEPLOY.md`.
- **Accessibility:** the PDF is tagged with its language; the extracted text reads in document order (tested in Phase 21); the button is labelled, shows "Creating PDF…" and is disabled while working, and the "saved" and "failed" messages are in a polite status region. axe is clean on the results page after a successful download in every mode and after a failed one.

**Tests (new)**
- Browser: 26 runs in the PDF spec (was 8): 3 modes × 2 years × desktop and phone, each checking the file name, the year (and no other), the parts that mode should have (the payslip comparison only in payslip mode, the estimation note in bank-amount mode), "Page X of Y" on every page, the network record above, and axe. Plus the forced failure and retry, the working state, and the offline run. Unit: the retry button (web 542).
- The full browser suite result is in the hand-off message.

**Choices to confirm**
1. **Phones.** The automated tests cover Chromium at phone size only. I cannot test Android Chrome or iOS Safari themselves here. On iOS Safari a downloaded PDF normally opens in the viewer or goes to the Downloads list rather than appearing as a "download complete" banner. Please try it once on your phone after deploying; the checklist is in `docs/DEPLOY.md`.
2. **Retry as a relabelled button**, not a second button, so the page does not grow another control. Say if you want a separate one.
3. **The file title** is in the metadata (see above). The plan said "app name and date only"; I read that as no personal data.

**Known gaps**
- iOS Safari and a real Android device are untested (above).
- A screen reader's reading of the PDF itself (NVDA/VoiceOver) is not tested; I checked that the PDF is tagged and in order, which is what the library supports.

## Phase 23: Multi-year release

**Status:** built, but **the release is blocked on purpose**: 2025/26 has not been signed off by a person. Stopped for your review.

**What changed**
- **Release gate.** `npm run release:check` (also the last step of `npm run ci`, and its own CI job "release-gate") fails unless every known tax year is `verified`, is in the signed-off list in `registry.ts`, and, where a sources file exists, has a filled-in Sign-off row and no "Status: DRAFT". It never edits anything and I did not fill in any sign-off. Today it fails with three lines about 2025/26, which is the correct result. Unit tests: `apps/web/vite/release-gate.test.ts`.
- **Docs.** `docs/RUNBOOK-NEW-TAX-YEAR.md` rewritten for several years (add a year to the registry; keep old years and tests; the sign-off steps; when to change the default year: 1 March 2027 for 2027/28, not at sign-off). `docs/LAUNCH-CHECKLIST.md` has a new "Tax years and the PDF summary" section. `docs/DEPLOY.md` mentions the gate.

**Checks run (this machine, 20 Nov 2026)**
- Lint, typecheck, unit tests (engine 306, web 546, pdf-export 48, assistant 72 and 64): pass.
- Browser suite: 188 passed, 10 skipped, 0 failed. It covers golden paths and the PDF for both years, 3 modes, desktop and phone, via the test build that includes the draft year.
- Bundle: landing JS 132.8 KB of 150 KB; no PDF library on the landing page; no draft year in the production build.
- Lighthouse: Accessibility, Best Practices and SEO are 100 everywhere. Performance is noisy here (two dev servers are running; scores ranged 44 to 95). The best run was 95 / 93 / 94, but two other runs had the landing page at 85 to 87. **Not proven at 90+ on a quiet machine**; run it against the live address.
- Privacy: the automated privacy and PDF specs pass (only this site's files, GET only, nothing carrying an amount). The by-hand network-tab check is still yours.

**Not done, and why**
- **2025/26 sign-off and "fixes from the review":** need a person (D14). The sources file lists five open items. Until the reviewer signs, the production build offers only 2026/27, and `npm run ci` ends red.
- **Production build of both years:** impossible until sign-off flips 2025/26 to verified. Both years were exercised in the test build only.
- **Live URL run-through:** deploying is yours.
