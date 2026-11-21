# South African Tax Calculator — Product Requirements Document

**Working title:** ClearTax SA (placeholder — final name to be decided)
**Document status:** Final draft for engineering handoff
**Tax year covered:** 2026/2027 year of assessment (1 March 2026 – 28 February 2027)
**Document date:** 18 November 2026
**Intended readers:** Engineering teams, AI coding agents (Claude Code, Cursor, etc.), product designers, QA

---

## 1. Document Purpose

This PRD specifies a complete, privacy-first web application that helps salaried South African employees understand their income tax (PAYE), verify their take-home pay, and learn how to legally reduce their tax liability. It is written to be sufficient for an AI coding agent to build the entire application from scratch **without making assumptions about missing requirements**. Every screen, wizard step, input, validation rule, formula, tax parameter, edge case, component, data model, technical requirement, and acceptance criterion is documented here.

> **Scope of this document:** This is a **product and technical specification only**. No application code is included.

---

## 2. Product Overview

### 2.1 Problem statement

Millions of salaried South Africans do not understand:

- How much tax they should be paying under SARS rules.
- How PAYE is calculated from their salary.
- Whether their employer is deducting the correct amount.
- How they can legally reduce their tax liability.

Existing tax calculators are confusing: they ask for gross annual salary, taxable income, and deduction categories (e.g. "Section 11F deductions", "Section 6A credits") that ordinary employees do not understand. Most people only know **the amount of money that lands in their bank account each month**. The product starts from there.

### 2.2 Product vision

A beautifully designed, step-by-step tax calculator that speaks plain language, shows a live tax preview as the user answers simple questions, and ends with a clear, human-readable result — plus personalised education and practical, legally-supported tax-saving recommendations.

### 2.3 Design pillars

1. **Radical simplicity.** One question at a time. No tax jargon without an inline plain-language explanation.
2. **Start from the bank account.** Users can begin with take-home pay; the app estimates gross salary with stated assumptions, or accepts gross salary directly.
3. **Deterministic math, AI only as explainer.** Every figure is computed by a tested, versioned calculation engine. The optional AI assistant never computes tax.
4. **Privacy-first.** All calculations run in the browser. No mandatory accounts, no server-side storage of financial data, no ID numbers, no SARS tax reference numbers.
5. **Honest uncertainty.** Estimates are always labelled as estimates. Differences between payslip PAYE and calculated PAYE are explained, not alarmed over.
6. **Trustworthy fintech quality.** Clean, modern, minimal, responsive design that feels like a polished South African fintech product.

### 2.4 One-sentence elevator pitch

"Understand your salary, check your PAYE, and keep more of your money — in five minutes, in plain language, entirely in your browser."

### 2.5 Illustrative headline (required on landing page)

> **"Understand Your Salary. Pay the Right Tax. Keep More of Your Money."**

### 2.6 Illustrative result copy pattern (required style on results page)

> "Your estimated monthly PAYE is R4,250, and your take-home salary is R25,750." *(Illustrative figures only — actual values come from the calculation engine.)*

---

## 3. Target Users

| Persona | Description | Key needs |
|---|---|---|
| **First-jobber** (e.g. 21-year-old) | Starting first salaried job; receives payslip but doesn't understand it | Plain language, no jargon, "is my employer deducting correctly?" |
| **Established employee** (25–55) | Monthly salary, maybe a bonus, pension fund, medical aid | Gross-to-net breakdown, bracket explanation, tax-saving tips |
| **Older worker** (65+) / 75+ | Receives secondary/tertiary rebates; higher interest exemption | Correct age-based rebates, pension income clarity |
| **Family provider** | Medical aid with dependants; possibly donations | Medical credits per dependant, 18A donation savings |
| **Switched-on saver** | Wants to reduce tax legally via RA / TFSA | Rand-quantified, reliable savings recommendations only |

### 3.1 Out of scope for v1 (not target users)

Freelancers, provisional taxpayers, landlords, crypto traders, small business owners (turnover tax / SBC), expatriates dealing with tax residency, trusts, and estates. See §5 (Out of Scope) and §8.10 (exclusion flags).

---

## 4. Goals and Success Metrics

### 4.1 Goals (ordered)

1. A user starting with only their monthly bank-account deposit can complete the wizard and receive an estimated gross salary, PAYE, and take-home breakdown.
2. A user with their payslip can receive a high-confidence calculation and a PAYE comparison against their employer's deduction.
3. Every number on the results page can be traced to a deterministic formula using versioned 2026/2027 tax rules.
4. Users leave with at least one applicable, correctly quantified tax-saving insight.
5. Zero personal financial data leaves the browser.

### 4.2 Success metrics (v1)

| Metric | Target |
|---|---|
| Wizard completion rate (start → results) | ≥ 70% |
| Median time to results | ≤ 5 minutes |
| Calculation engine unit-test coverage of tax rules module | 100% of rule branches; ≥ 90% line coverage |
| Engine accuracy vs. independently computed SARS test vectors | 100% match on the approved test suite |
| Results page comprehension (self-reported "I understand my result") | ≥ 80% |
| AI assistant: 0 instances of AI-generated numerical tax output in audit logs | Mandatory |

---

## 5. Scope

### 5.1 In scope (v1)

- Salaried employees (single employer, possibly plus bonus/commission/overtime).
- Tax year 2026/2027 only, with a versioned rule engine supporting future tax years.
- Two entry modes: **take-home-first** (estimate) and **gross-first** (payslip-accurate).
- PAYE, UIF (employee share), retirement fund deductions (Section 11F), medical scheme fees tax credit (Section 6A), additional medical expenses tax credit (Section 6B), Section 18A donations, local interest exemption, tax-free investment limits (educational/recommendations), bonuses, overtime, commission, travel allowances (informational + optional), taxable fringe benefits at the level of employer retirement/medical contributions.
- Live preview dashboard, SARS bracket table, results page with breakdown + comparison + education + recommendations.
- Optional AI assistant for explanation only, with explicit consent before any data sharing.
- Privacy-first architecture: client-side only, no accounts required.

### 5.2 Out of scope (v1) — must be explicitly flagged in-app where relevant

| Excluded area | User-facing behaviour |
|---|---|
| Capital gains tax | Flag: "Investments sold at a profit may add CGT to your final liability." |
| Corporate tax, VAT, turnover tax, SBC | Not applicable; app is for salaried individuals |
| Freelance / side-hustle / business income | Flag: "Extra income not on a payslip (freelance, rentals, crypto) is taxed too and can change your result." |
| Rental income | Same flag as above |
| Cryptocurrency taxation | Same flag as above |
| Provisional tax | Not applicable to pure salaried employees; no UI |
| International tax residency / foreign income / expat rules | Flag: "If you worked abroad or are a non-resident, different rules may apply." |
| Donations tax (20%/25% donor tax, IT144) | Only the Section 18A *deduction* is modelled; flag that large donations can attract donations tax |
| Estate duty | Flag in education section only (one line) |
| Retirement lump-sum taxation, two-pot withdrawals, severance benefits | Flag in education section; NOT calculated (needs tax directives) |
| Home office expenses | Flag + link to SARS guidance; optionally an "advanced" input in later versions. v1: flag only. |
| Commission-earner business expense deductions (>50% commission earners) | Flag; optional "advanced" toggle if time permits — default off. v1: flag only. |
| SDL, COIDA | Employer-paid; never deducted from take-home; no UI (education note only) |
| Multiple employers simultaneously | Wizard supports "more than one job" as an informational flag + manual combined-income input; see §14 edge cases |
| Tax filing / ITR12 submission / refunds processing | The app is a calculator, not a filing platform |

---

## 6. Research Summary — SARS Rules for 2026/2027 (Authoritative Parameters)

> **Provenance.** All parameters below were compiled from official SARS sources and reputable professional summaries of the 25 February 2026 National Budget. Full source list with URLs and effective dates: **Appendix A**. The Budget delivered 25 February 2026 adjusted brackets (~3.4%), raised the primary rebate to R17,820, raised the Section 11F cap to R430,000, raised the tax-free investment annual limit to R46,000, and raised the CGT annual exclusion (out of scope). The 2026 Budget was confirmed in Parliament's subsequent sittings; parameters below are the operative law for the year of assessment ending 28 February 2027.

### 6.1 Individual income tax brackets (year of assessment ending 28 February 2027)

| Bracket # | Taxable income (R) | Tax on bracket (R) |
|---|---|---|
| 1 | 0 – 245,100 | 18% of taxable income |
| 2 | 245,101 – 383,100 | 44,118 + 26% of taxable income above 245,100 |
| 3 | 383,101 – 530,200 | 79,998 + 31% of taxable income above 383,100 |
| 4 | 530,201 – 695,800 | 125,599 + 36% of taxable income above 530,200 |
| 5 | 695,801 – 887,000 | 185,215 + 39% of taxable income above 695,800 |
| 6 | 887,001 – 1,878,600 | 259,783 + 41% of taxable income above 887,000 |
| 7 | 1,878,601 and above | 666,339 + 45% of taxable income above 1,878,600 |

- Rates and bracket thresholds are **progressive**: each bracket applies only to income inside it. The base amounts are cumulative (44,118 = 18% × 245,100, etc.), so an income exactly on a boundary pays exactly the base amount of the bracket above.
- Official source: SARS, "Rates of Tax for Individuals", 2027 tax year (updated 25 February 2026): https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/

### 6.2 Tax rebates (natural persons)

| Rebate | Amount (2026/2027) | Applies to |
|---|---|---|
| Primary rebate | R17,820 | All individuals |
| Secondary rebate | R9,765 (additional) | Age 65 and older |
| Tertiary rebate | R3,249 (additional) | Age 75 and older |

Rebates are subtracted from tax calculated on taxable income (not from income). Tax payable is floored at R0 — rebates and credits cannot create a negative liability or a refund on their own.

Source: SARS "Rates of Tax for Individuals" (2026/2027) and 2026 Budget Guide.

### 6.3 Age-based tax thresholds

| Age band | Threshold (2026/2027) |
|---|---|
| Under 65 | R99,000 |
| 65 to below 75 | R153,250 |
| 75 and older | R171,300 |

A taxpayer whose taxable income is at or below the age-appropriate threshold has zero income tax (the thresholds equal the rebate totals from §6.2 divided by 18%, the first bracket rate). Below-threshold taxpayers generally need not file a return unless SARS requests it or they want a refund of PAYE already withheld.

### 6.4 PAYE calculation (employees' tax withholding)

PAYE is collected under the Fourth Schedule to the Income Tax Act 58 of 1962. Standard SARS-acceptable method for monthly salaried employees (per SARS Guide PAYE-GEN-01-G01, *Guide for Employers in respect of Tax Deduction Tables*):

1. Determine gross monthly remuneration (salary + regular allowances + taxable fringe benefits; bonuses/commission handled per §6.4.2).
2. Deduct employee retirement fund contributions (§6.6) from remuneration.
3. Annualise: multiply by 12.
4. Apply the bracket table (§6.1).
5. Subtract rebates (§6.2) and annual medical scheme fees tax credit (§6.7).
6. Divide by 12 → monthly PAYE.
7. Floor at R0.

Worked example (also a mandatory test vector): monthly salary R30,000, employee pension contribution 10% (R3,000), under 65, medical aid main member + 1 dependant (s6A credit R752/month = R9,024/year):
- Annualised taxable remuneration = (30,000 − 3,000) × 12 = R324,000
- Tax on R324,000 = 44,118 + 26% × (324,000 − 245,100) = R64,632
- Less primary rebate R17,820 → R46,812
- Less s6A credit R9,024 → R37,788/year → **R3,149/month PAYE**

Note: SARS publishes official weekly/fortnightly/monthly/annual deduction tables; the engine implements the annualisation formula, which reproduces the tables. SARS confirmed no structural changes to the tables for 2026/2027.

#### 6.4.1 Periodic vs annual-equivalent methods

SARS accepts both the **periodic** method (monthly tables in isolation) and the **averaging/annual-equivalent** (YTD-based) method. The app engine models the steady-state case (fixed monthly salary), which both methods converge on. Variable income and bonuses are handled as:

#### 6.4.2 Bonuses, 13th cheques, overtime, commission

- **Bonuses/13th cheques (irregular income):** taxed as ordinary income in the month paid. SARS method: tax on irregular income = annual tax on (annualised regular income + irregular amount) − annual tax on (annualised regular income). This avoids the "annualisation inflation" pitfall of multiplying the bonus month by 12. Employers may alternatively use the cruder annualisation method; both are SARS-compliant — the app uses the balance-of-remuneration method and says so.
- **Overtime:** remuneration; taxed as part of the month's income at the applicable rate.
- **Commission:** taxed as ordinary remuneration. If commission exceeds 50% of total remuneration, additional business-expense deductions may apply (IRP5 codes) — flagged, not calculated in v1 (see §5.2).
- Take-home-first estimation (§13.4) must include an estimate of bonus effects on both gross and take-home.

#### 6.4.3 Rounding rules

- All intermediate calculations keep full precision.
- PAYE and UIF are rounded to **2 decimal places** (cents) per deduction.
- All display amounts are formatted to 2 decimals in Rand (R 1 234,56 style with space thousands separator — see §17 locale rules).
- SARS deduction tables round to the nearest cent; the engine matches.

### 6.5 UIF (Unemployment Insurance Fund)

| Parameter | Value |
|---|---|
| Employee contribution | 1% of remuneration |
| Employer contribution | 1% of remuneration |
| Remuneration ceiling | R17,712 per month (R212,544 per year) |
| Maximum employee deduction | R177.12 per month |
| Effective date of ceiling | 1 June 2021 — **unchanged for 2026/2027** |

- Employee UIF = 1% × min(remuneration, R17,712/month). UIF reduces take-home pay; the employer's matching 1% is not deducted from the employee.
- Source: SARS "Unemployment Insurance Fund" (UIC Act 4 of 2002): https://www.sars.gov.za/types-of-tax/unemployment-insurance-fund/
- SDL (1%, employer-paid, only for employers with payroll ≥ R500,000/year) and COIDA are **never** deducted from employees; mention once in education copy.
- Note for the PRD's rule-versioning table: the UIF ceiling is set by ministerial notice and can change at any time; the rule engine must treat it as a first-class parameter.

### 6.6 Retirement fund contributions — Section 11F

| Parameter | Value (2026/2027) | Previous (2025/2026) |
|---|---|---|
| Deduction rate | 27.5% of the **greater of remuneration or taxable income** (excluding retirement lump sums, severance benefits, and taxable capital gains) | Same rate |
| Annual rand cap | **R430,000** (first increase since 2016) | R350,000 |
| Effective date of new cap | 1 March 2026 | — |

Rules:

- Applies to **combined** contributions to pension funds, provident funds, and retirement annuities (employee + employer contributions).
- **Employer contributions** to pension/provident funds are a **taxable fringe benefit** in the employee's hands, then treated as if contributed by the employee for the deduction — net tax effect typically neutral, but the amounts must appear correctly in gross-to-net breakdowns.
- Contributions above the limit are **not lost**: the excess is carried forward to future years, and if still unused at retirement, offsets tax on lump sums/annuities under Section 10C.
- Deduction reduces **taxable income** (a deduction, not a credit): the saving equals the contribution × the marginal rate.
- Sources: SARS "Tax and Retirement"; 2026 Budget FAQ (SARS); KPMG SA Budget Guide 2026/27.

### 6.7 Medical scheme fees tax credit — Section 6A

Monthly credits (2026/2027 year of assessment):

| Member type | Monthly credit |
|---|---|
| Taxpayer (main member) | R376 |
| First dependant | R376 |
| Each additional dependant | R254 |

- Annual credit = monthly × 12 (for full-year membership). Credits apply regardless of income level. Credits are **non-refundable**: they can reduce tax to R0 but not below.
- If the employer pays scheme contributions as a payroll deduction, payroll typically applies the credit monthly; if paid personally, it is claimed on the annual return.
- Source: SARS "Medical Tax Credit Rates" (updated 25 February 2026): https://www.sars.gov.za/tax-rates/medical-tax-credit-rates/
- The main member must belong to a **registered South African medical scheme**.

### 6.8 Additional medical expenses tax credit — Section 6B

Two branches (annual amounts):

| Taxpayer group | Formula |
|---|---|
| Under 65, no disability | 25% × [ (qualifying out-of-pocket medical expenses) + (scheme contributions − 4 × annual s6A credit) − (7.5% × taxable income) ], result floored at R0 |
| 65 or older, or taxpayer/spouse/child with disability | 33.3% × [ (qualifying out-of-pocket expenses) + (scheme contributions − 3 × annual s6A credit) ], no 7.5% threshold |

- Qualifying expenses = amounts not recovered from the scheme, for services/medicines qualifying under s6B (prescribed list includes doctors, dentists, hospital fees, prescribed medicines, etc.).
- Employer-paid scheme contributions count as "contributions paid" for the excess test but generate a fringe benefit; v1 simplifies: if the employer pays the contribution and the employee sees a deduction, the engine uses the deduction amount as the contribution; this is a documented simplification (see §13.6).
- v1 default: s6B is computed only when the user provides out-of-pocket expenses in an optional step; otherwise shown as "possibly available — add your expenses to see".

### 6.9 Donations to public benefit organisations — Section 18A

| Parameter | Value |
|---|---|
| Deduction limit | 10% of taxable income (computed before the donation deduction, excluding retirement fund lump sums and severance benefits) |
| Excess over 10% | Carried forward and treated as a donation in the following tax year |
| Evidence | Valid Section 18A receipt from a SARS-approved PBO; third-party (IT3(d)) reporting lets SARS pre-populate returns |

- Only donations to SARS-approved Section 18A organisations qualify. The deduction reduces taxable income; saving = donation × marginal rate.
- Source: SARS PBO guidance; KPMG SA Budget Guide 2026/27; Income Tax Act s18A.
- Donations **tax** (20%/25% on donations above R100,000 — raised to R150,000 annual exemption per the 2026 Budget/operative for this year per the Budget Guide: first R150,000 donated per year by a natural person is exempt) is out of scope; flag in education copy for large donations.

### 6.10 Local interest income exemption (Section 10(1)(i))

| Age | Annual exemption |
|---|---|
| Under 65 | R23,800 |
| 65 and older | R34,500 |

- Applies to South African-source interest. Dividends tax (20%, withheld) and CGT are out of scope; flag only.
- Confirmed unchanged for 2026/2027 (2026 Budget made no change to interest or dividends tax).
- Relevance to v1: users who report interest income above the exemption have extra taxable income; wizard asks only whether they earn "noticeable bank interest" in the advanced step and flags the impact; no automatic calculation in v1 unless the user enters an amount (optional advanced field).

### 6.11 Tax-free investments (Section 12T)

| Parameter | Value (2026/2027) | Previous |
|---|---|---|
| Annual contribution limit | **R46,000** (from 1 March 2026) | R36,000 |
| Lifetime limit | R500,000 (unchanged) | R500,000 |
| Penalty on excess | 40% of the excess, added to normal tax | Same |

- No deduction on contribution; growth and withdrawals are fully tax-free. Used in the **recommendations** section ("you have R X of annual TFSA room left"), never in the PAYE calc.
- Source: SARS "Tax Free Investments" (updated 20 March 2026): https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-free-investments/

### 6.12 Travel allowances and business travel

| Parameter | Value (2026/2027) |
|---|---|
| Prescribed rate per kilometre (s8(1)(b)) | **R4.95 per km** (up from R4.76) |
| PAYE on fixed travel allowance | Withheld on **80%** of the allowance; reduced to **20%** if the employer is satisfied ≥80% of vehicle use is business use |
| Reimbursive allowance at/below prescribed rate | No PAYE; logbook still needed to substantiate business km |
| Logbook | Required to claim a deduction against a taxable travel allowance on assessment |

- v1: travel allowance is an optional advanced input. The engine (a) treats the taxable portion (80% default, 20% if user states ≥80% business use) as additional taxable income in the annual calc, and (b) shows the deemed-deduction estimate (business km × R4.95) as an **estimate** with a prominent logbook disclaimer. Reimbursements at ≤ R4.95/km are excluded entirely.
- Sources: SARS "Rates per kilometre" (updated 25/26 February 2026): https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/ ; SARS PAYE-GEN-01-G03 (Allowances guide).

### 6.13 Fringe benefits (employment)

In scope for v1:

| Benefit | Treatment |
|---|---|
| Employer pension/provident fund contribution | Taxable fringe benefit added to gross; simultaneously deductible under s11F within the 27.5%/R430,000 limits (§6.6) |
| Employer medical scheme contribution | Taxable fringe benefit added to gross; offset by s6A credit (§6.7) — net effect ≈ neutral at payroll level |
| Company car, housing, low-interest loans, assets | Out of scope for calculation; flag: "Some benefits (e.g. a company car) are taxable and aren't included here" |

### 6.14 Parameters that are **not** used in v1 calculations (reference only)

| Item | Value (2026/2027) | Why listed |
|---|---|---|
| Dividends tax | 20% withheld | Education only |
| CGT annual exclusion | R50,000 (raised in Budget 2026); max effective CGT rate individuals 18% | Education flag only |
| Retirement lump-sum tax-free threshold | R550,000 lifetime; table 0/18/27/36% | Education flag only |
| Donations tax exemption | First R150,000/year per natural person exempt; 20% above (25% above R30m cumulative) | Education flag only |
| SDL | 1% employer-paid | Never deducted from employee |
| Two-pot savings withdrawals | Taxed at marginal rate via directive | Education flag only |

### 6.15 Consolidated parameter table (engine config — 2026/2027)

This table is the single source of truth the `TaxRules2026_27` config object must contain (see §10). **Every value here must be traceable to Appendix A sources.**

```yaml
taxYear: "2026-27"
startDate: "2026-03-01"
endDate: "2027-02-28"
brackets:                # [lowerBoundInclusive, upperBoundInclusive, baseTax, marginalRate]
  - [0, 245100, 0, 0.18]
  - [245101, 383100, 44118, 0.26]
  - [383101, 530200, 79998, 0.31]
  - [530201, 695800, 125599, 0.36]
  - [695801, 887000, 185215, 0.39]
  - [887001, 1878600, 259783, 0.41]
  - [1878601, Infinity, 666339, 0.45]
rebates: { primary: 17820, secondary65: 9765, tertiary75: 3249 }
thresholds: { under65: 99000, age65to74: 153250, age75plus: 171300 }
uif: { employeeRate: 0.01, monthlyCeiling: 17712, maxMonthlyEmployee: 177.12 }
retirement11F: { rate: 0.275, annualCap: 430000 }
medical6A_monthly: { mainMember: 376, firstDependant: 376, additionalDependant: 254 }
medical6B:
  under65NoDisability: { multiplier: 0.25, contributionMultiple: 4, oopThresholdRate: 0.075 }
  age65OrDisability: { multiplier: 0.333, contributionMultiple: 3, oopThresholdRate: 0 }
donations18A: { limitRate: 0.10 }          # of taxable income before the donation deduction
interestExemption: { under65: 23800, age65plus: 34500 }
taxFreeInvestment: { annualLimit: 46000, lifetimeLimit: 500000, excessPenaltyRate: 0.40 }
travel: { prescribedRatePerKm: 4.95, allowanceTaxableDefaultRate: 0.80, allowanceTaxableBusinessRate: 0.20, businessUseThresholdFor20pct: 0.80 }
paye: { monthsPerYear: 12, roundingDecimals: 2, minLiability: 0 }
sdlNote: "employerPaidOnly"
effectiveDates:
  bracketsAndRebates: "2026-03-01"
  retirementCap430k: "2026-03-01"
  tfsa46k: "2026-03-01"
  uifCeiling: "2021-06-01 (unchanged)"
  travelRate495: "2026-03-01"
```

---
## 7. Information Architecture

```text
Landing page
├── Hero + headline + trust indicators + dashboard preview (static/animated demo)
├── "How it works" (3 steps)
├── "What you'll see" — preview of the live tax dashboard (non-functional demo with sample data)
├── Privacy promise strip
└── CTA → Wizard

Wizard (core flow)
├── Step 0: Starting point — "How do you want to start?" (take-home / gross / payslip-assisted)
├── Step 1: The money question (amount, per the chosen mode)
├── Step 2: How often are you paid? (monthly [default] / weekly / fortnightly)
├── Step 3: Your age group (<65 / 65–74 / 75+) — drives rebates, thresholds, s6B branch
├── Step 4: Pension / provident / retirement annuity? (yes → amounts & who contributes)
├── Step 5: Medical aid? (yes → dependants count, monthly contribution, employer-paid?)
├── Step 6: Bonus / 13th cheque / overtime / commission? (optional step; amounts optional)
├── Step 7: (Advanced, collapsible) Donations, out-of-pocket medical, interest income, travel allowance
├── Step 8: (Gross/payslip modes only) What does your payslip actually deduct? (PAYE + UIF actually withheld)
└── Step 9: Review & confirm → Results

Results page
├── Human-readable summary (headline numbers)
├── Complete gross-to-net breakdown (monthly + annual)
├── SARS bracket-by-bracket table (the exact engine workings)
├── Employer PAYE comparison (only if Step 8 data provided)
├── Personalised education ("How your answers shaped your tax")
├── Personalised recommendations (with rand savings where reliably computable)
├── Exclusions & flags
└── Optional: talk to the AI assistant (consent-gated)

AI assistant (modal/drawer, optional, consent-gated)
```

Mobile: wizard is full-screen single column; the live preview dashboard becomes a collapsible sticky "Your tax preview" bar at the top that expands to a bottom sheet.

---

## 8. Detailed Wizard Specification

Global wizard behaviour requirements:

- **One question per screen.** Never two inputs on one step except where specified (e.g. Step 8 payslip pair, Step 6 optional amount groups).
- **Progress indicator:** horizontal progress bar on desktop; progress dots (● ○ ○ ○) on mobile. Steps 7 is advanced/collapsed and does not add to the visible count by default (label it "Optional extras").
- **Back button** on every step after the first; browser Back must also work (each step is a routable state; see §19 routing).
- **Persist answers in-memory only** (see §18 privacy). Refreshing the page restarts the wizard (v1 — no localStorage persistence; see Open Questions §25).
- **Every step has a per-step FAQ** accordion at the bottom (2–4 items, plain language). FAQ content per step is specified below.
- **Validation** is inline, friendly, non-blocking unless specified. No red error walls.
- **Skip-ability:** all optional steps have a visible "Skip" / "No / none of these" option. Required steps: Steps 0–5 minimum; Step 6+ optional.
- The **live preview dashboard** updates on every answer (§12). It must show an "estimate" vs "payslip-accurate" badge according to mode.

### Step 0 — "How do you want to start?"

| Field | Spec |
|---|---|
| Question | "How would you like to start?" |
| Options (cards) | **A. "The money in my bank account"** — sub: "Tell us what you receive monthly and we'll work out the rest (estimate)." **B. "My gross salary (before deductions)"** — sub: "The amount on your payslip or offer letter before anything is deducted." **C. "My payslip"** — sub: "Gross salary plus what your employer actually deducts — the most accurate check." |
| Type | Single-select cards, required |
| Default | none |

FAQ:
- "What's gross salary?" → "It's your full salary before tax, UIF, pension or medical aid comes off — usually the biggest number on your payslip."
- "What's take-home pay?" → "The money that actually lands in your bank account after all deductions."
- "Which is best?" → "Payslip mode is the most accurate. Bank-account mode gives a good estimate if you don't have your payslip."

### Step 1 — The money question (varies by mode)

| Mode | Question | Input spec | Validation |
|---|---|---|---|
| A (take-home) | "How much money do you receive in your bank account every month?" | Currency input, R prefix, `min=0`, `max=10,000,000`, numeric, allow 2 decimals; "I'm not sure" toggle → shows slider R1,000–R150,000 | Required; must be > 0; if 0 → friendly message: "If you receive no income, you likely owe no PAYE — but let's double-check a few things" and continue with zeros |
| B (gross) | "What is your gross monthly salary — before anything is deducted?" | Same input spec | Same; also warn if below UIF ceiling behaviour (no — no warning needed) |
| C (payslip) | "What is your gross monthly salary?" + "How much PAYE (tax) was deducted this month?" + "How much UIF was deducted?" | Three currency inputs; UIF optional | Required gross; PAYE required (validation: 0 ≤ PAYE ≤ gross); UIF optional, auto-filled estimate of 1% min(gross, 17,712) if blank, flagged "assumed — check your payslip" |

Pay-frequency sub-question (all modes): "Are you paid monthly, weekly, or every two weeks?" Options: Monthly (default), Weekly, Fortnightly. Engine converts to monthly equivalents: weekly × 52/12; fortnightly × 26/12. Conversion is used everywhere; display states the converted monthly figure. (Weekly-paid edge case: SARS weekly tables exist; the engine uses the annualisation formula which is equivalent for steady income; document as simplification §13.5.)

FAQ (bank mode):
- "Do I include my bonus?" → "Not here — we'll ask about bonuses separately. Enter only your regular monthly deposit."
- "What if my amount changes every month?" → "Enter your most typical month. Overtime and commission can be added later."
- "My deposit includes expenses repaid" → "Only count money you actually keep. If your employer repays work expenses into the same account, subtract those."

### Step 2 — Age

| Field | Spec |
|---|---|
| Question | "How old are you? (Your age affects the tax breaks SARS gives you.)" |
| Options | "Younger than 65" (default if skipped), "65 to 74", "75 or older" |
| Type | Single-select segmented control, required |
| Note | Copy: "Taxpayers 65+ get an extra rebate of R9,765 a year, and 75+ get R3,249 more." |

FAQ:
- "Why does age matter?" → "SARS gives extra tax rebates at 65 and 75, and a higher tax-free threshold, so older workers pay less tax on the same salary."
- "What if I turn 65 during the tax year?" → "Rebates are based on your age at the end of the tax year (28 February 2027). If you'll be 65 by then, choose 65–74."

### Step 3 — Retirement contributions

| Field | Spec |
|---|---|
| Question | "Does money go towards a pension fund, provident fund or retirement annuity?" |
| Options | "Yes" → follow-up form; "No" (single-tap skip) |
| Follow-up (if yes) | (a) "How much of your own money goes in per month?" currency input. (b) "Does your employer also contribute?" yes/no + amount. (c) "Which type?" — [Pension fund / Provident fund / Retirement annuity / More than one] (informational; all share the same limit). (d) "Roughly what percentage of your salary is your own contribution?" — optional auto-computed display, not an input. |
| Validation | Amounts ≥ 0; combined own + employer annualised > R430,000 → inline info: "Contributions above R430,000 a year aren't all deductible this year, but they're not lost — SARS carries them forward." |

Engine: employee contributions reduce remuneration for PAYE (payroll deduction). Employer contributions are a fringe benefit (added to gross, then included in the s11F deduction pool). See §10 formulas.

FAQ:
- "What's the difference between pension, provident and RA?" → "They're different savings products with the same tax deduction. Pension/provident usually come from your employer; a retirement annuity (RA) is one you set up yourself."
- "How much can I deduct?" → "Up to 27.5% of your salary, capped at R430,000 a year (2026/27). Anything above the cap carries forward to future years."
- "Is it worth contributing more?" → "Every extra rand you contribute within the limit saves tax at your highest tax rate. You'll see exactly how much in your recommendations."

### Step 4 — Medical aid

| Field | Spec |
|---|---|
| Question | "Do you belong to a medical aid?" |
| Options | "Yes" → follow-up; "No" (skip) |
| Follow-up | (a) "Including you, how many people are on the plan?" integer 1–15, default 1. (b) "What do you pay per month in total?" currency (0 allowed if employer pays). (c) "Who pays it?" — [I pay it myself / My employer pays or deducts it / We share]. (d) "Did you pay any medical costs the medical aid didn't cover this year?" — optional currency (drives s6B). |
| Validation | dependants ≥ 1; contribution ≥ 0. If dependants = 1 and "who pays" = employer → info note: "Your employer's contribution counts as a small taxable benefit, but you still get the R376/month credit — it roughly cancels out." |

Engine: s6A credit = (376 [main] + (dependants ≥ 2 ? 376 + 254×(dependants−2) : 0)) × 12. If membership < 12 months, pro-rate by months (v1: full-year assumption + info note; partial-year input available in advanced step).

FAQ:
- "What counts as a dependant?" → "Anyone registered on your medical aid — your spouse, children, parents you support, or anyone your scheme recognises."
- "How does the tax credit work?" → "SARS gives R376 a month for you, R376 for your first dependant and R254 for each additional dependant — taken straight off your tax bill."
- "My employer pays my medical aid — do I still get the credit?" → "Yes. You'll see it already applied on your payslip as lower PAYE, or claim it when you file."

### Step 5 — Variable pay (bonus, 13th cheque, overtime, commission)

| Field | Spec |
|---|---|
| Question | "Besides your regular salary, do you earn any of these?" |
| Options (multi-select chips) | "Bonus or 13th cheque", "Overtime", "Commission", "None of these" |
| Follow-up per selected type | "Roughly how much per year?" currency (total annual amount expected in this tax year). Bonus: additional sub-input "How many times a year do you usually get it?" informational only. |
| Validation | ≥ 0; sum sanity check vs salary — if total variable pay > 3× salary, inline note "That's a lot of your income from extras — our estimate will be rougher." |

Engine: variable amounts are added to annual income. Bonus tax uses the balance-of-remuneration method (§6.4.2) for display of "tax attributable to your bonus". Monthly take-home display splits: regular-month take-home vs average take-home including variable pay.

FAQ:
- "Why is my bonus taxed so heavily?" → "A bonus is added to your income in one month. Payroll works out its share of your annual tax — if it pushes you into a higher bracket, that part is taxed higher."
- "Is commission taxed differently?" → "It's taxed like salary. If commission is more than half your pay, extra deductions may apply when you file."

### Step 6 — Advanced extras (collapsible, labelled "Optional extras")

All fields optional; section starts collapsed with summary chip showing how many filled.

| Field | Input | Engine effect |
|---|---|---|
| "Donations to registered charities (Section 18A)" | Annual amount + checkbox "I have a valid 18A receipt" | Deduction up to 10% of taxable income before donation; excess carried forward (display note); no receipt checkbox → estimate only, flagged |
| "Out-of-pocket medical expenses not covered by your scheme" | Annual amount | Feeds s6B calculation (with disability toggle: "Do you, your spouse or a child have a disability?" yes/no) |
| "Interest from South African bank accounts/fixed deposits" | Annual amount | Taxable portion = max(0, amount − exemption by age); added to taxable income |
| "Travel allowance" | Monthly allowance + business-use estimate (<80% / ≥80%) + annual business km (optional) | Taxable portion (80%/20%) added to income; estimated deduction (km × R4.95) shown as "possible deduction on assessment — keep a logbook" |
| "More than one employer this tax year" | Toggle + combined annual gross from other job (optional amount) | Adds to annual taxable income; info note about possible under-withholding and IRP3(q) directive option |

FAQ:
- "What is a Section 18A receipt?" → "A tax certificate a registered charity gives you. Without it, SARS won't allow the deduction — so keep it safe."
- "Why ask about interest?" → "The first R23,800 of local interest is tax-free (R34,500 if you're 65+). Above that, it's taxed like salary."
- "I have two jobs — why does it matter?" → "Each employer taxes you separately. Combined, you can end up in a higher bracket and owe SARS on assessment. A tax directive can fix the monthly deduction."

### Step 7 — Payslip check (modes B & C only)

| Field | Spec |
|---|---|
| Question | "Let's check your payslip. How much PAYE (income tax) and UIF were actually deducted this month?" |
| Inputs | PAYE deducted (monthly), UIF deducted (monthly), both currency, PAYE required in mode C, optional in mode B |
| Validation | 0 ≤ PAYE ≤ gross; UIF must be ≤ R177.12 or inline note "UIF above R177.12 isn't possible under 2026/27 rules — check the figure" (still allow override with warning) |

FAQ:
- "Where do I find these on my payslip?" → "Look for 'PAYE' or 'Tax' and 'UIF' in the deductions column of your latest payslip."
- "What if my PAYE changes every month?" → "Enter a typical month — February's is usually the cleanest (no bonus)."

### Step 8 — Review & confirm

- Read-only summary card of all answers grouped by topic ("Your income", "Your retirement", "Your medical aid", "Extras") with inline "Edit" links jumping back to the step.
- Primary CTA: "See my tax result".
- Small print: "This is an estimate for the 2026/27 tax year (1 Mar 2026 – 28 Feb 2027) based on the information you gave. It isn't tax advice or a SARS assessment."

---

## 9. Input Validation & Formatting Rules (global)

| Rule | Spec |
|---|---|
| Currency input | Text input with live formatting: thousands separator (space, SA convention), R prefix, 2 decimals on blur; raw numeric model. Accepts pasting "R30 000", "30000", "30,000.00" |
| Numeric input (dependants) | Integer stepper + direct entry, clamped 1–15 |
| Age selection | Segmented control; keyboard accessible; arrow keys switch options |
| Percent slider | Optional visual aid only for "rough percentage" displays |
| Empty required field | Inline message below field; CTA disabled until valid |
| Max value guard | > R10,000,000/month → "That seems very high — please double-check" (allow continue after confirm) |
| Localization | All amounts in ZAR; no currency switching; format: `R 30 000,00` (SI space thousands, comma decimals — matches SA convention and SARS documents) |
| Screen-reader | Every input labelled; currency announced as "Rand"; errors announced via `aria-live="polite"` |

---

## 10. Calculation Engine Specification

### 10.1 Architecture principles

- **Deterministic, pure functions.** No randomness, no Date-dependence (tax year is injected, not read from the clock), no floating-point drift (use integer cents or a decimal library — see §19).
- **Immutable rule config.** All 2026/2027 parameters (§6.15) live in a versioned `TaxRuleSet` object. The engine receives a rule set + inputs and returns a result. **No parameter hard-coded in logic.**
- **Every output number carries a provenance trail** (which rule objects produced it) so the UI can show bracket tables and the audit log can prove no AI computed anything.
- **Single pipeline:** `inputs → normalise → estimate (if needed) → annualise → deductions → tax → credits → monthly split → breakdown + explanations`.

### 10.2 Type definitions (TypeScript)

```typescript
type TaxYear = "2026-27";

interface TaxRuleSet {
  taxYear: TaxYear;
  brackets: Array<{ lower: number; upper: number; base: number; rate: number }>;
  rebates: { primary: number; secondary65: number; tertiary75: number };
  thresholds: { under65: number; age65to74: number; age75plus: number };
  uif: { employeeRate: number; monthlyCeiling: number; maxMonthlyEmployee: number };
  retirement11F: { rate: number; annualCap: number };
  medical6A: { monthlyMain: number; monthlyFirstDep: number; monthlyAdditionalDep: number };
  medical6B: {
    under65: { multiplier: number; contributionMultiple: number; incomeThresholdRate: number };
    olderOrDisabled: { multiplier: number; contributionMultiple: number };
  };
  donations18A: { limitRate: number };
  interestExemption: { under65: number; age65plus: number };
  tfsa: { annualLimit: number; lifetimeLimit: number; excessPenaltyRate: number };
  travel: { prescribedRatePerKm: number; taxableDefaultRate: number; taxableBusinessRate: number; businessUseThreshold: number };
  monthsPerYear: number;
}

type AgeBand = "UNDER_65" | "AGE_65_74" | "AGE_75_PLUS";

interface WizardInputs {
  mode: "TAKE_HOME" | "GROSS" | "PAYSLIP";
  payFrequency: "MONTHLY" | "WEEKLY" | "FORTNIGHTLY";
  statedMonthlyAmount: number;           // take-home or gross depending on mode
  payslipPaye?: number;                  // mode PAYSLIP
  payslipUif?: number;
  ageBand: AgeBand;
  retirement: {
    ownMonthly: number;                  // employee contribution
    employerMonthly: number;             // employer contribution (fringe benefit)
    fundTypes: Array<"PENSION" | "PROVIDENT" | "RA">;
  };
  medical: {
    member: boolean;
    dependants: number;                  // total incl. main member
    monthlyContribution: number;         // total scheme contribution
    paidBy: "SELF" | "EMPLOYER" | "SHARED";
    monthsCovered: number;               // default 12
    outOfPocketAnnual?: number;
    disabilityInFamily: boolean;
  };
  variablePay: { bonusAnnual: number; overtimeAnnual: number; commissionAnnual: number };
  advanced: {
    donations18AAnnual?: number; has18AReceipt: boolean;
    localInterestAnnual?: number;
    travelAllowanceMonthly?: number; travelBusinessPct: number; travelBusinessKmAnnual?: number;
    secondEmployerAnnualGross?: number;
  };
}

interface TaxBreakdownLine { label: string; monthly: number; annual: number; note?: string }

interface CalculationResult {
  mode: "TAKE_HOME" | "GROSS" | "PAYSLIP";
  confidence: "ESTIMATE" | "PAYSLIP_ACCURATE";
  grossSalary: TaxBreakdownLine;
  taxableIncomeBeforeRetirement: number;
  retirementDeduction: TaxBreakdownLine;
  taxableIncome: number;
  annualTaxBeforeCredits: number;
  rebates: TaxBreakdownLine;
  medical6ACredit: TaxBreakdownLine;
  medical6BCredit: TaxBreakdownLine;
  donationsDeduction: TaxBreakdownLine;
  annualPaye: number;
  monthlyPayeRegular: number;
  uifEmployee: TaxBreakdownLine;
  takeHomeRegular: number;               // non-bonus month
  takeHomeAverage: number;               // incl. variable pay spread
  effectiveRate: number;
  marginalRate: number;
  bracketIndex: number;
  bracketWalk: Array<{ bracket: string; rate: number; amountInBracket: number; taxInBracket: number }>;
  comparison?: { payslipPaye: number; calcPaye: number; diff: number; diffPct: number };
  flags: string[];                        // §8.10 exclusion notices
  explanations: Array<{ inputId: string; text: string; randEffect?: number }>;
  recommendations: Array<{ id: string; title: string; body: string; monthlySaving?: number; annualSaving?: number; confidence: "CALCULATED" | "ESTIMATED" | "INFORMATIONAL" }>;
  provenance: { ruleSetVersion: string; appliedRules: string[] };
}
```

### 10.3 Pipeline formulas (normative)

Notation: all amounts annual unless stated. `floor2(x)` = round to 2 decimals (half-up, matching SARS table convention — see §13.9).

**Step A — Normalise to monthly gross**

- `statedMonthlyGross` = statedMonthlyAmount if mode ≠ TAKE_HOME, else estimated (Step B).
- Frequency conversion: `monthly = weekly × 52/12`; `fortnightly × 26/12`.

**Step B — Take-home → gross estimation (mode TAKE_HOME only)**

Iterative solve (documented, tested):

1. Let `g0 = takeHome / 0.75` (seed).
2. For iteration i: compute PAYE(g_i) and UIF(g_i) via the full pipeline; `takeHome_i = g_i − monthlyPAYE − UIF(g_i)`. Adjust: `g_{i+1} = g_i + (takeHome_target − takeHome_i)` (fixed-point; damping factor 1.0, max 50 iterations, tolerance R0.01). Monotonicity of net pay in gross guarantees convergence; fallback: bisection over [0, g×4] if fixed point stalls.
3. Mark `confidence: ESTIMATE`; UI badge "Estimated from take-home pay"; show the assumed gross with "This is an estimate — your payslip will show the exact figure."
4. If the user later supplies payslip figures (Step 7 in gross mode) the engine switches to PAYSLIP_ACCURATE.
5. Estimation must **exclude** retirement/medical effects the user hasn't told us about: run estimation with Steps 3–4 answered so far; if not yet answered, assume none and re-run when they are (the live preview therefore re-solves on each step — memoise per input-hash).

**Step C — Build annual income**

```
grossAnnual = monthlyGross × 12
variableAnnual = bonus + overtime + commission
travelTaxableAnnual = (travelAllowanceMonthly × 12) × (businessPct ≥ 80% ? 0.20 : 0.80)
interestTaxableAnnual = max(0, localInterest − interestExemption[ageBand])
otherEmployerAnnual = secondEmployerAnnualGross
remuneration ≈ grossAnnual + employerRetirement × 12     // fringe benefit base for 27.5% test
incomeBeforeDeductions = grossAnnual + variableAnnual + travelTaxableAnnual + interestTaxableAnnual + otherEmployerAnnual + employerRetirementAnnual
```

Employer retirement contributions are added as fringe benefit (income) and simultaneously included in the deduction pool — net-zero effect on taxable income but visible in the gross-to-net breakdown.

**Step D — Section 11F retirement deduction**

```
retirementPool = ownAnnual + employerRetirementAnnual
limit11F = min(retirementRate × max(remuneration, taxableIncomeBeforeOwnDeduction), annualCap)
retirementDeduction = min(retirementPool, limit11F)
excess11F = retirementPool − retirementDeduction          // carry-forward note
```

Note the circularity (limit depends on taxable income which depends on the deduction): SARS resolves it using taxable income **before** the retirement deduction (and excluding capital gains). Engine: compute `taxableBeforeOwnDeduction = incomeBeforeDeductions − 0` (i.e. before any s11F), test limit on that. Document in code comment and tests.

**Step E — Donations**

```
donationCap = donationLimitRate × (incomeBeforeDeductions − retirementDeduction)
donationsDeduction = min(donations18AAnnual, donationCap)
donationCarryForward = donations18AAnnual − donationsDeduction
```

**Step F — Taxable income**

```
taxableIncome = incomeBeforeDeductions − retirementDeduction − donationsDeduction
```

**Step G — Tax on brackets**

```
annualTaxBeforeCredits = bracketBase(taxableIncome) + rate × (taxableIncome − bracketLower)
```

Then subtract rebates by age band; floor tax at 0 **after** all credits:

```
afterRebates = max(0, annualTaxBeforeCredits − rebatesTotal)
```

**Step H — Medical credits**

```
s6A_annual = (main + (deps≥2 ? firstDep + addDep×(deps−2) : 0)) × monthsCovered(monthsCovered=12 default)
after6A = max(0, afterRebates − s6A_annual)

if outOfPocket provided:
  if ageBand ≥ 65 or disability:
      s6B = 0.333 × max(0, contributionsAnnual − 3×s6A_annual) + 0.333 × outOfPocket
  else:
      base = max(0, contributionsAnnual − 4×s6A_annual) + outOfPocket − 0.075×taxableIncome
      s6B = 0.25 × max(0, base)
afterCredits = max(0, after6A − s6B)
```

**Step I — UIF**

```
uifMonthly = min(employeeRate × monthlyGross, 177.12)   // cents: floor2
```

UIF applies to regular remuneration; bonus months also attract UIF on the bonus (ceilings apply). v1: UIF on monthly gross incl. 1/12 of variable pay average — document simplification; flag.

**Step J — Monthly split**

```
annualPaye = afterCredits
monthlyPayeRegular = floor2(annualPaye / 12)            // for PAYE attributable to regular salary
takeHomeRegular = monthlyGross − ownRetirementMonthly − ownMedicalMonthly − monthlyPayeRegular − uifMonthly
takeHomeAverage = takeHomeRegular + (variableAnnual − variableTaxAnnual)/12   // variable tax via §6.4.2 method
```

The UI shows both, labelled: "A normal month" and "Averaged over the year (incl. your extras)".

**Step K — Payslip comparison (modes B/C with payslip figures)**

```
diff = payslipPaye − monthlyPayeRegular
diffPct = diff / monthlyPayeRegular × 100
```
Copy rules (§16.4): explain plausibly (other income, different payroll method, bonus month, fringe benefits) and **never** assert an employer error or a guaranteed refund.

### 10.4 Deterministic test vectors (normative — engine must match all)

| # | Scenario | Expected (R) |
|---|---|---|
| T1 | Under 65, gross 30,000/mo, pension 10% own, medical main+1 dep, no variable | PAYE 3,149.00/mo; take-home = 30,000 − 3,000 − 3,149 − 177.12 = 23,673.88 |
| T2 | Under 65, taxable income exactly 245,100 | Tax = 44,118 exactly (boundary) |
| T3 | Under 65, taxable income exactly 245,101 | Tax = 44,118.26 |
| T4 | Under 65, taxable 99,000 | Tax before rebate 17,820; after primary rebate = 0 |
| T5 | Age 65, taxable 153,250 | Tax before rebates = 27,585; rebates 27,585 → 0 |
| T6 | Age 75, taxable 171,300 | Tax before rebates = 30,834; rebates 30,834 → 0 |
| T7 | Gross 17,712/mo | UIF = 177.12; gross 17,713/mo → UIF still 177.12 |
| T8 | Gross 5,000/mo | UIF = 50.00; no income tax (below threshold) |
| T9 | Zero income | All zeros; take-home 0; no errors |
| T10 | Gross 60,000/mo, own RA 200,000/yr | 11F limit = min(0.275×720,000, 430,000) = 198,000 → deduction 198,000; excess 2,000 carry-forward note |
| T11 | Gross 150,000/mo (1.8m/yr), own+employer contributions 600,000/yr | Limit = 430,000 (cap bites) |
| T12 | Under 65, taxable 400,000, medical contributions 36,000, OOP 18,000, s6A 11,688/yr | s6B = 0 (worked example §6.8 reference: contributions < 4×credit; OOP < 7.5% threshold) |
| T13 | Under 65, taxable 400,000, contributions 66,000, OOP 60,000, s6A 17,592/yr | s6B = 7,500 (per §6.8 worked example, 2025/26 figures — recompute with 2026/27 credits and use as regression) |
| T14 | 65+, contributions 40,000, s6A 4,512, OOP 10,000 | s6B = 0.333×max(0, 40,000−13,536) + 0.333×10,000 = 8,815.61+3,330 = 12,145.61 |
| T15 | Donations 50,000, taxable before donation 300,000 | Deduction 30,000; carry-forward 20,000 |
| T16 | Take-home 20,000/mo, under 65, nothing else | Engine solves gross ≈ 25,253 (26% bracket); assert within R1.00 of reference solution |
| T17 | Payslip mode: gross 45,000, payslip PAYE 6,800 | Comparison shows diff vs engine figure with neutral explanation copy |
| T18 | Interest 30,000, under 65 | Taxable interest = 6,200 |
| T19 | Travel allowance 5,000/mo, business use 60% | Taxable = 4,000/mo |
| T20 | Travel allowance 5,000/mo, business use 85% (confirmed by employer) | Taxable = 1,000/mo |

(Tests T1–T20 must be automated; vectors T13/T16 include independently computed reference values held in the repo alongside the code.)

---

## 11. Edge Cases (research-driven requirements)

| # | Case | Engine/UI requirement |
|---|---|---|
| E1 | Zero income | All outputs 0; copy: "No income, no PAYE"; still show UIF 0 |
| E2 | Income below age threshold | PAYE 0 after rebates; copy: "Your income is below the SARS tax-free threshold (R99,000)" + note that UIF still applies; flag: "You may not need to file a return unless SARS asks or you're owed a refund" |
| E3 | Income exactly on bracket boundary | Exactly the bracket base tax (tests T2/T3) |
| E4 | Age 65/75 boundaries | Correct rebate stack; FAQ copy "based on age at end of tax year" |
| E5 | Retirement contributions exceeding limits | Cap at R430,000; carry-forward surfaced in explanations and recommendations ("excess not lost") |
| E6 | Medical dependants 0/1/many | Credit schedule per §6.7; dependants=1 → only main member credit |
| E7 | Incomplete payslip info | Mode degrades gracefully; missing UIF auto-estimated + flagged; missing PAYE in gross mode → comparison section hidden |
| E8 | Bonus month | Bonus shown separately; balance-of-remuneration method; note that payroll may use a different SARS-compliant method, causing month-to-month differences that square up on assessment |
| E9 | Variable monthly earnings | Annual-average approach; flag that payroll's YTD averaging may differ month to month but converges annually |
| E10 | Multiple employers | Combined-income flag; explain bracket stacking risk; IRP3(q) directive mention |
| E11 | Weekly/fortnightly pay | Conversion 52/12 and 26/12; display shows both actual and monthly-equivalent |
| E12 | Employer pays medical fully | Fringe benefit ≈ credit; net effect neutral; breakdown shows both lines transparently |
| E13 | Partial-year medical membership | monthsCovered input (advanced); pro-rated s6A |
| E14 | SDL/COIDA on payslip | Education note: "SDL and COIDA are employer costs — they must never be deducted from your pay" |
| E15 | Negative donations/excess flags | Donations > 10% → carry-forward notice; never negative taxable income (floor at 0) |
| E16 | Take-home exceeds any plausible net | Input guard (§9); if user insists, proceed with warning |
| E17 | Pension contribution > gross | Allowed by input; engine caps deduction at legal limit; warning copy |
| E18 | Taxable income exactly 0 after deductions | Tax 0; credits unused (non-refundable) — note "credits can't create a refund by themselves" |

---

## 12. Live Tax Preview Dashboard (right panel)

### 12.1 Desktop layout

Two-column wizard shell: left = current step (max-width 560px); right = sticky preview panel (min 340px, max 420px). Panel updates on every valid input change (debounced 150 ms).

### 12.2 Panel contents (top to bottom)

1. **Mode badge:** "Estimate" (amber) or "Payslip-accurate" (green).
2. **Headline numbers:** Monthly take-home (large), monthly PAYE (medium), annual tax (small).
3. **Summary list:** gross salary, taxable income, UIF, retirement contributions, medical aid credits, other deductions — each with monthly & annual values and an info tooltip with one-line plain explanation.
4. **Mini bracket visual:** horizontal stacked bar showing how much income falls in each bracket (colours per bracket), with the user's marginal bracket highlighted. Tooltip per segment: "R x taxed at y%".
5. **"Full SARS bracket table"** disclosure: complete 2026/27 table (§6.1) with the user's row highlighted and a "you are here" marker; shows bracket-by-bracket tax for the current taxable income when expanded.

### 12.3 Mobile layout

- Collapsed: sticky bar under the header showing "Take-home: R xx,xxx · PAYE: R x,xxx ▾".
- Tapping expands a full-screen bottom sheet containing the same content as desktop panel, with a grabber handle and close button; scrollable; focus trapped while open; closes on route change.

### 12.4 Behaviour

- Empty/invalid state: skeleton lines with copy "Answer the questions to build your tax picture."
- Every value recomputes through the engine (never approximated in UI).
- All numbers formatted `R 1 234,56`.
- Panel is `aria-live="off"` for bulk updates but announces mode-badge changes; individual number changes are not re-announced (avoid screen-reader noise) — verified in accessibility audit (§21).

---

## 13. Landing Page Specification

Must feel like a polished South African fintech product — **not** a blank white page with a form.

### 13.1 Sections (top to bottom)

1. **Nav bar:** product name, "2026/27 tax year" pill, "Privacy-first" pill (lock icon), CTA "Check my salary".
2. **Hero:** headline (§2.5), sub: "A free, plain-language tax calculator for salaried South Africans. No sign-up. Your numbers never leave your device."; two CTAs: "Start with my bank amount" (primary) / "Start with my salary"; hero visual: stylised, animated (subtle) payslip-to-dashboard morph that resolves into a mock of the real dashboard (sample data clearly labelled "Example").
3. **Trust strip:** "Based on official SARS 2026/27 rules" · "Calculations run 100% in your browser" · "No ID or tax number needed" · "Free".
4. **"How it works"** — 3 numbered cards: (1) Tell us what lands in your bank account; (2) Answer a few yes/no questions; (3) See your PAYE, your brackets, and ways to pay less — legally.
5. **Dashboard preview:** interactive-but-demo version of the live preview dashboard (fixed sample values, non-editable, labelled "Example result — yours will be personal").
6. **What the app checks:** compact grid of capabilities (PAYE, UIF, pension/provident/RA, medical credits, donations, bonuses, age rebates).
7. **Privacy promise:** 4 short lines mirroring §18.
8. **Footer:** disclaimer ("Educational estimates only — not tax advice, not a SARS service"), tax-year effective date, links to SARS sources (Appendix A), "Made for South African salary earners".

### 13.2 Visual direction

- Clean, modern, minimal, uncluttered; generous whitespace; single accent colour family (deep green or petrol-blue suggested) + neutral grays; SA-flag colours used only as tiny accents (avoid garish).
- Typography: one geometric sans for UI, one for numerals with tabular figures (all money columns align).
- Motion: subtle; respects `prefers-reduced-motion`.
- Photography/illustration: none required; if used, local, diverse, everyday South Africans (no clichés); better: abstract financial visuals.
- Fully responsive; hero stacks on mobile; CTAs thumb-reachable.

---

## 14. Results Page Specification

### 14.1 Summary block (top)

- Human-readable sentence (§2.6 pattern), generated from engine output:
  Template: "Your estimated monthly PAYE is **{monthlyPaye}**, and your take-home salary is **{takeHomeRegular}**." Payslip mode: "Your employer deducted **{payslipPaye}**; based on the SARS 2026/27 rules, our calculation gives **{calcPaye}**."
- Confidence badge; tax-year line: "2026/27 tax year · 1 March 2026 – 28 February 2027".
- CTAs: "Adjust my answers" (back to wizard), "Ask the AI assistant" (optional).

### 14.2 Gross-to-net breakdown table (monthly and annual columns)

Rows (exactly, in order): Gross salary → employer contributions added (fringe benefit, if any) → retirement contributions (own) → medical aid (own share, if any) → taxable income → tax before credits → less rebates (itemised: primary/secondary/tertiary) → less medical credits (s6A, s6B itemised) → plus UIF → **= Take-home pay**.
Every row shows monthly + annual and an info tooltip. The table must reconcile to the cent: (gross − own deductions − PAYE − UIF = take-home) verified by UI test.

### 14.3 SARS bracket-by-bracket calculation

Full 2026/27 table where each row shows: bracket range, rate, amount of the user's income inside the bracket, tax on that slice, running total. User's marginal bracket tagged "Your top bracket". Below: rebates itemised, credits itemised, final annual liability. This is a direct rendering of `bracketWalk` from the engine — no UI-side math.

### 14.4 Employer PAYE comparison (conditional)

Shown only when payslip figures were entered. Shows both numbers, the difference in rands and %, then a neutral explanation panel:

> "A difference doesn't automatically mean your employer made a mistake, and it doesn't guarantee a SARS refund. Common reasons: your employer uses a different SARS-allowed payroll method, the month you checked included a bonus or back-pay, you have other income, or your payroll applied credits differently. If you're unsure, compare a February payslip (no bonus) or ask your payroll team."

### 14.5 Personalised education section

One card per answered input that affected the result, each with a plain-language explanation and its rand effect (from engine `explanations`):

- Retirement: "You contribute R x/month to your pension/RA. That's deducted from your taxable income, saving you R y/month in tax at your 36% top rate. Contributions above R430,000/year carry forward."
- Medical aid: "Your medical aid gives you a tax credit of R z/month — R376 for you, R376 for your first dependant, R254 for each extra person — taken straight off your tax, not your income."
- Age rebates: "Because you're 65+, SARS subtracts an extra R9,765 from your tax this year (R3,249 more at 75+)."
- Donations: "Your R x donation to a registered charity reduced your taxable income, saving R y."
- Bonus: "Your bonus is taxed at your top rate once a year — that's why the deduction looks big in one month."
- UIF: "You pay 1% of your pay (max R177.12/month) to UIF; your employer matches it. It never comes back on your payslip, but it insures you if you lose your job."

### 14.6 Personalised recommendations

Generated from engine `recommendations`. Rules:

- Only recommend what is supported by the user's inputs. **Never promise savings that cannot be derived from the user's information.**
- Each recommendation shows a rand figure only when confidence = CALCULATED; otherwise mark "Estimated" or drop the figure.
- Recommendation templates:

| ID | Trigger | Content (pattern) | Rand basis |
|---|---|---|---|
| R1 | Own retirement < 27.5% limit and < R430k cap | "You have about R X/year of unused retirement deduction room. Contributing R Y more per month would cut your tax by about R Z/month." | Z = Y × marginal rate, CALCULATED |
| R2 | No retirement contributions | "Starting a retirement annuity or pension contribution is the single biggest legal PAYE reducer for most salaried people. Example: R 2,000/month saves you about R {2000×marginal} /month in tax." | CALCULATED (example basis) |
| R3 | Medical credit applies | "Make sure your payroll applies your full medical credit (R {amount}/month). If you pay the scheme yourself, claim it when you file." | CALCULATED |
| R4 | No medical aid | "A medical aid isn't only tax — but if you join, you'd receive R376/month (2026/27) off your tax." | CALCULATED |
| R5 | Donations < 10% limit & no donations entered | "Donations to SARS-registered charities (Section 18A) are deductible up to 10% of your taxable income. R 1,000 given saves you about R {1000×marginal} in tax — keep the 18A receipt." | CALCULATED (example basis) |
| R6 | Interest near/above exemption | "The first R23,800 of local interest is tax-free (R34,500 at 65+). Consider a tax-free investment — up to R46,000/year, R500,000 lifetime, no tax on growth." | INFORMATIONAL |
| R7 | TFSA room (recommendation-only; ask if they already contribute, default assume not and phrase as "you may have up to R46,000/year of room") | "Tax-free investments don't reduce PAYE, but growth is never taxed." | INFORMATIONAL |
| R8 | s6B potential | "Your out-of-pocket medical costs may qualify for an additional credit when you file." | ESTIMATED |
| R9 | Marginal bracket ≥ 39% | "You're in one of the top brackets — retirement contributions save you {rate} cents per rand." | CALCULATED |

- Disclaimer under the section: "These are general education suggestions based on the information you provided — not personalised financial advice."

### 14.7 Exclusions & flags

Render engine `flags` as a tidy list, each starting with a subtle ⚠ icon. Minimum flag set (when relevant): CGT, freelance/rental/crypto income, provisional tax, foreign income/residency, commission-earner deductions, home office, fringe benefits not modelled (company car), donations tax on large gifts, retirement lump sums/two-pot withdrawals, SDL/COIDA note. Each flag links to the relevant SARS page (Appendix A).

### 14.8 No exports

v1 has **no PDF export and no downloadable reports** (per requirements). "Share" is a plain-text copy-to-clipboard of the summary sentence + key numbers, user-initiated, clearly labelled "estimate".

---

## 15. AI Tax Assistant (optional, consent-gated)

### 15.1 Purpose

Explain calculations and answer common South African tax questions in simple language.

### 15.2 Hard constraints (architecturally enforced)

1. **The AI never calculates.** The assistant has read-only access to the `CalculationResult` (already computed by the engine) and the rule-set summary. It may **quote** engine outputs; it must never derive new numbers. Enforcement: the prompt/system instructions forbid arithmetic; the integration layer passes only pre-computed figures; an audit log records every AI response with its quoted figures for spot-checks; CI includes a test that an AI response containing a rand amount not present in the provided result fails review.
2. **Consent before sharing.** First launch shows a consent modal: "The assistant runs on an external AI service. If you continue, your answers and results (like salary and deductions — never your name, ID or tax number) will be sent to that service to generate explanations. Nothing is stored by us. You can say no and keep using the calculator." Options: "Enable assistant" / "No thanks". Choice persisted in `localStorage` (opt-in flag only — the only localStorage use in v1, §18).
3. **Minimal payload.** Only the fields needed for context (mode, age band, amounts, engine outputs). Never: name, employer name, ID number, SARS tax reference number, bank details. Wizard never collects these anyway.
4. **Fallback.** If the service is unavailable or declined: the assistant entry point shows "Assistant unavailable — your results are fully calculated and shown here regardless."
5. **Guardrails.** System prompt scope: South African personal income tax education for salaried employees, 2026/27 rules as provided; refuse to give financial advice ("consider speaking to a registered tax practitioner"); answer in simple English (and isiZulu/isiXhosa/Afrikaans if the UI is localised — v1 English only, see §25).

### 15.3 UX

- Entry: button on results page + a floating "?" on wizard steps that opens a generic-tax-Q&A context (no personal data pre-2026/27-consent).
- Drawer/modal with chat UI; messages clearly attributed ("Assistant — explanations only; all numbers come from the calculator engine").
- A persistent chip above the input: "AI explanations · calculations by the deterministic engine".

---

## 16. Copy & Tone Guidelines

- Plain, warm, South African English ("pay slip" is "payslip"; use rand amounts with spaces). Reading age ~ grade 8. No Latin terms; define any unavoidable tax term in-line on first use.
- Always say "estimate" when mode is take-home; always show the tax-year dates near every result.
- Never shame ("You're overpaying!") — always neutral, educational.
- Required standard disclaimers: (a) "Estimates only — not tax advice, not a SARS assessment." (b) on comparison: §14.4 neutral explanation. (c) on recommendations: §14.6 disclaimer.
- Numbers in prose follow the §2.6 pattern ("Your estimated monthly PAYE is R4,250, and your take-home salary is R25,750.").

---

## 17. Non-Functional Requirements

### 17.1 Privacy & security (normative)

- **100% client-side calculation.** The tax engine ships to the browser; results never leave the device except the optional, consented AI-assistant call (§15).
- **No mandatory accounts.** No sign-up, no login, no email collection anywhere in v1.
- **No collection of**: ID numbers, SARS tax reference numbers, names, employer names, bank details. The wizard schema (§10.2) must not contain fields for them.
- **Storage:** in-memory state only. Sole exception: AI-consent boolean in `localStorage`. No analytics payload may include financial values (if analytics are added later, page-view events only — flag in code review checklist).
- **Transport/security:** HTTPS everywhere; standard security headers (CSP, X-Content-Type-Options, Referrer-Policy, etc.); no third-party trackers on wizard/results pages.
- **AI payload minimisation** per §15.2.3, enforced by a typed payload builder with an allow-list.

### 17.2 Performance

- First load ≤ 150 KB compressed JS for landing (excluding optional AI bundle, lazy-loaded).
- Wizard step transition < 100 ms; preview recalculation < 16 ms for any input (engine is arithmetic-only).
- Lighthouse (mobile): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- Works on 2G-class networks after initial load; full offline capability after first visit (service worker cache of static assets; calculations always work offline).

### 17.3 Accessibility (WCAG 2.1 AA)

- Full keyboard operability of wizard (radio groups, segmented controls, currency inputs).
- Visible focus states; skip links; semantic landmarks (`header`, `main`, `aside` for preview, `footer`).
- Currency inputs with `aria-describedby` formatting hints; errors via `aria-live="polite"`.
- Progress indicator announced on step change (`aria-live="polite"`, "Step 4 of 8: Medical aid").
- Bracket visual has an equivalent data table (the §12.2(5) table serves this).
- Colour contrast ≥ 4.5:1; never colour-alone for mode badges (icon + text).
- `prefers-reduced-motion` honoured; no parallax.

### 17.4 Compatibility

- Latest 2 versions of Chrome, Safari, Edge, Firefox; Safari iOS 15+; Chrome Android current-2. Graceful degradation (no hard crash) elsewhere.
- Responsive breakpoints: 360, 768, 1024, 1440.

### 17.5 Locale & formatting

- ZAR only; format `R 30 000,00` (space thousands, comma decimals — SA convention per SARS documents).
- Date format `1 March 2026`; tax-year label "2026/27".

### 17.6 Reliability

- Engine never throws on any user input (fuzz-tested); all outputs clamped (no NaN/Infinity reaching UI).
- If the AI service fails, the calculator is unaffected (hard isolation of the lazy-loaded assistant bundle).

---

## 18. Data Model & State Management

- Single client-side store (framework-native state or Zustand-class library) holding `WizardInputs` (§10.2), current step, and last `CalculationResult`.
- Selectors recompute results via memoised engine call keyed on input hash (fixes take-home re-solve cost, §10.3-B5).
- No server, no DB in v1. AI assistant is a client-to-provider call with allow-listed payload.
- Routing: `/` landing, `/wizard` (step as query param, e.g. `/wizard?step=4` — deep-linkable steps, Back-button-safe), `/results`. Guard: `/results` without completed minimum inputs redirects to wizard start.

---

## 19. Technology Stack & Project Structure (recommended)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **React 19 + TypeScript (strict)** | Requirement; strict typing for money math |
| Styling | **Tailwind CSS** + CSS variables for the design tokens | Requirement; fast, consistent, responsive |
| UI primitives | Headless accessible components (Radix-style) for wizard controls, accordion, dialog, sheet | WCAG AA with keyboard support out of the box |
| Money math | `decimal.js` (or exact-integer cents) — **no raw float arithmetic** | Deterministic, matches SARS cent rounding |
| State | React state + one memoisation layer | Wizard fits in memory |
| Routing | React Router (or framework router) | Deep-linkable steps |
| Engine package | `packages/tax-engine`: pure TS, zero UI deps, own test suite | Testable, versioned rule sets |
| Tests | **Vitest** (unit, property-based with fast-check for engine), **React Testing Library**, **Playwright** (E2E golden paths) | Requirement for "thoroughly tested" |
| AI assistant | Lazy-loaded module behind consent; provider pluggable via interface `TaxAssistantProvider` | Swap providers without touching app |
| Build/deploy | Vite; static hosting (CDN) — no server required by design | Privacy-first, cheap, fast |
| CI | Typecheck, lint, engine tests (test vectors T1–T20 mandatory gate), UI tests, Lighthouse CI budget | Quality gates |

Suggested repo layout:

```text
apps/web/            # React app (landing, wizard, results, dashboard UI)
packages/tax-engine/ # pure calculation engine: rulesets/2026-27.ts, engine.ts, types.ts, __tests__/
packages/assistant/  # consent + provider interface + prompt construction (no math)
docs/                # this PRD, test-vector provenance, SARS source snapshots
```

Versioned rules: `packages/tax-engine/rulesets/<taxYear>.ts` exporting a validated `TaxRuleSet`; engine consumes any rule set; adding 2027/28 later = new file + tests + UI label. A schema-level validation function (`assertValidRuleSet`) runs in CI to catch malformed configs.

---

## 20. Development Phases, Deliverables & Acceptance Criteria

> **Gate policy:** A phase is "done" only when its acceptance criteria pass in CI. The engine vectors (T1–T20) are the global gate for anything touching calculations.

### Phase 0 — Research & rules freeze (≈ 3–5 days)

- **Deliverables:** this PRD's §6 parameter set locked in `rulesets/2026-27.ts`; snapshot copies (PDF/markdown) of every Appendix A source in `docs/sources/` with capture dates; provenance map parameter→source.
- **Acceptance:** every parameter in §6.15 traces to a SARS/official source; two independent reviewers sign off; uncertainties list (§25) written.

### Phase 1 — Calculation engine (≈ 1–2 weeks)

- **Deliverables:** `packages/tax-engine` complete: types, rule set, pipeline (§10.3), take-home solver, comparison, explanations, recommendations generator (§14.6 rules), flag generator; full unit test suite including T1–T20, property-based tests (monotonicity: more gross ⇒ ≥ net; rebates never make tax negative; bracket-boundary fuzzing across all 7 brackets × all ages × ±R1 boundaries), fuzz tests for arbitrary user inputs.
- **Acceptance:** 100% of T1–T20 pass; ≥90% line coverage; zero `any` types in engine; provenance field populated on every result; independent re-implementation cross-check of 5 random scenarios within R0.01.

### Phase 2 — Wizard UX (≈ 2 weeks)

- **Deliverables:** landing page (§13), all wizard steps (§8) with validation (§9), per-step FAQs, progress indicators, review screen; routing per §18.
- **Acceptance:** Playwright golden paths (landing→results via all 3 modes) green on desktop+mobile viewports; keyboard-only walkthrough passes; a11y audit (axe) zero critical/serious issues; copy review against §16.

### Phase 3 — Live preview dashboard + results page (≈ 2 weeks)

- **Deliverables:** desktop panel + mobile bottom sheet (§12), breakdown table, bracket walk, comparison, education, recommendations, flags (§14).
- **Acceptance:** every displayed number equals engine output (reconciliation test: breakdown sums to take-home to the cent); bracket table renders engine `bracketWalk` verbatim; Lighthouse budgets met (§17.2); axe clean.

### Phase 4 — AI assistant (≈ 1 week)

- **Deliverables:** consent modal (§15.2.2), lazy bundle, provider interface, guardrailed prompt construction, audit logging of AI responses (local, ephemeral), failure fallback.
- **Acceptance:** no network call before consent; payload allow-list verified by test (assert forbidden fields impossible to serialize); CI "no invented numbers" spot-check harness; assistant disabled state works with engine results intact.

### Phase 5 — Testing hardening (≈ 1 week)

- **Deliverables:** full test plan executed: engine (done P1), component/integration, Playwright E2E matrix (3 modes × age bands × with/without each optional step), cross-browser/device run, performance and Lighthouse CI, a11y audit report.
- **Acceptance:** zero critical defects open; E2E matrix green; budgets met; a11y issues ≥ 95 score with no criticals.

### Phase 6 — Deployment & launch (≈ 3 days)

- **Deliverables:** static CDN deploy, HTTPS, security headers, service worker, analytics (page-views only) if desired, monitoring (uptime; error tracking with financial-value scrubbing), launch checklist (disclaimers visible, SARS links live).
- **Acceptance:** Lighthouse scores ≥ targets on production URL; privacy checklist (§17.1) verified end-to-end (inspect network tab during full wizard run: zero financial payloads to any endpoint except consented assistant call).

### Phase 7 — Post-launch rule updates (ongoing)

- **Deliverables:** runbook for new tax years (duplicate rule set, update parameters from SARS Budget, extend tests, ship config-only release).
- **Acceptance:** adding 2027/28 requires no engine-logic changes if SARS parameter structure is unchanged (verified by adding a draft 2027/28 config in a spike).

---

## 21. Risks, Open Questions, Uncertainties

| # | Item | Type | Resolution path |
|---|---|---|---|
| Q1 | Should wizard progress survive a page refresh (localStorage)? Currently no (privacy-first default). | Open question | Decide in Phase 2; if yes, encrypt-at-rest is not required but re-confirm no-server stance |
| Q2 | Is weekly-pay SARS weekly-table equivalence acceptable as annualisation simplification? | Risk (low) | Documented §13.5-style note in UI for weekly users; revisit if user feedback demands weekly tables |
| Q3 | UIF ceiling is set by ministerial notice and could change mid-year. | Risk | Versioned parameter + "last verified" date in UI footer |
| Q4 | s6B simplification for employer-paid contributions (§6.8 note). | Risk (low) | Acceptable for estimates; flag in methodology note on results page |
| Q5 | Budget 2026 spousal-donation-residency change (donations tax) — out of scope but verify no effect on s18A. | Verified — no effect on the s18A deduction; donations-tax flag updated in §6.9 | Done |
| Q6 | Afrikaans/isiZulu/isiXhosa localisation. | Open question (v1 English; architecture: all copy in i18n files from day one) | Phase 2 decision |
| Q7 | Which AI provider. | Open question | Phase 4 decision behind the `TaxAssistantProvider` interface |

---

## 22. Appendix A — Authoritative Sources & Effective Dates

| # | Source | URL | Used for | Accessed |
|---|---|---|---|---|
| S1 | SARS — Rates of Tax for Individuals (2027 tax year, updated 25 Feb 2026) | https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/ | §6.1 brackets, §6.2 rebates, §6.3 thresholds | 2026-11-18 |
| S2 | SARS — Medical Tax Credit Rates (updated 25 Feb 2026) | https://www.sars.gov.za/tax-rates/medical-tax-credit-rates/ | §6.7 s6A monthly credits | 2026-11-18 |
| S3 | SARS — Medical Credits (2026/27 column) | https://www.sars.gov.za/types-of-tax/personal-income-tax/medical-credits/ | §6.7/§6.8 credit rules incl. s6B formulas | 2026-11-18 |
| S4 | SARS — Unemployment Insurance Fund | https://www.sars.gov.za/types-of-tax/unemployment-insurance-fund/ | §6.5 UIF 1%/1%, R17,712 ceiling, R177.12 max | 2026-11-18 |
| S5 | SARS — Tax Free Investments (updated 20 Mar 2026; Budget 2026 FAQ) | https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-free-investments/ | §6.11 R46,000 annual limit from 1 Mar 2026, R500k lifetime, 40% penalty | 2026-11-18 |
| S6 | SARS — Rates per kilometre (updated 25/26 Feb 2026) + PAYE-GEN-01-G03 | https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/ | §6.12 R4.95/km; allowance 80%/20% rule | 2026-11-18 |
| S7 | SARS — Guide for Employers in respect of Tax Deduction Tables (PAYE-GEN-01-G01) | https://www.sars.gov.za/wp-content/uploads/Legal-Counsel/Primary-Legislation/Guides/PAYE-GEN-01-G01.pdf (via sars.gov.za employers' guides page) | §6.4 PAYE annualisation; bonus (irregular income) method | 2026-11-18 |
| S8 | SARS — Guide for Employers in respect of Allowances (PAYE-GEN-01-G03) | https://www.sars.gov.za (employers' guides page) | §6.12 travel allowance treatment | 2026-11-18 |
| S9 | SARS — Tax and Retirement (incl. Budget 2026 retirement FAQ) | https://www.sars.gov.za/individuals/tax-during-all-life-stages-and-events/tax-and-retirement/ | §6.6 s11F 27.5%/R430,000; employer contributions fringe benefit; excess carry-forward | 2026-11-18 |
| S10 | SARS — Donations Tax + PBO/Section 18A guidance | https://www.sars.gov.za/types-of-tax/donations-tax/ | §6.9 donation rules; R150,000 exemption context | 2026-11-18 |
| S11 | National Treasury — 2026 Budget Review & Tax Guide (25 Feb 2026) | https://www.treasury.gov.za | §6.2/§6.3 rebates & thresholds; §6.10 interest exemptions unchanged; §6.14 reference values | 2026-11-18 |
| S12 | KPMG — SA Budget Guide 2026/2027 (Feb 2026) | https://assets.kpmg.com/content/dam/kpmgsites/za/pdf/2026/02/SA%20Budget%20Guide%202026.pdf | §6.1/§6.3 cross-check; §6.9 donations 10% & carry-forward; §6.12 travel; retirement reform notes | 2026-11-18 |
| S13 | PwC Worldwide Tax Summaries — South Africa (individual credits) | https://taxsummaries.pwc.com/south-africa/individual/other-tax-credits-and-incentives | §6.7/§6.8 s6A/s6B cross-check (R376/R376/R254; 4×/7.5%/25%; 3×/33.3%) | 2026-11-18 |
| S14 | SARS — PAYE (types of tax) | https://www.sars.gov.za/types-of-tax/pay-as-you-earn/ | §6.4 Fourth Schedule context | 2026-11-18 |
| S15 | SARS — Home Office Expenses | https://www.sars.gov.za (individuals > deductions) | §5.2 home-office flag wording | 2026-11-18 |

**Verification statement:** All numerical parameters in §6.15 were checked against at least one SARS source (S1–S14) and cross-checked against an independent professional summary (S12/S13). Where a secondary source alone carried a figure, it is marked in this appendix (none in §6.15 — every parameter has an SARS/Treasury primary anchor).

---

## 23. Appendix B — Glossary (plain language, for UI tooltips)

| Term | Plain-language definition (max ~20 words, for tooltips) |
|---|---|
| Gross salary | Your full pay before tax, UIF, pension or medical aid come off. |
| Take-home pay | The money that actually lands in your bank account. |
| PAYE | "Pay As You Earn" — the income tax your employer deducts monthly and pays to SARS for you. |
| Taxable income | The part of your income SARS actually taxes, after allowed deductions. |
| Tax bracket | A slice of income taxed at one rate. Only the income inside each slice is taxed at that rate. |
| Marginal rate | Your highest tax rate — the rate on your last rand of income. |
| Effective rate | Your total tax as a percentage of income — always lower than your marginal rate. |
| Rebate | A set amount SARS subtracts from your tax bill (not from your income). |
| UIF | Unemployment Insurance Fund — you pay 1% (max R177.12/month), your employer matches it. |
| Pension / provident / RA | Retirement savings products. Money you put in is tax-deductible up to set limits. |
| Medical scheme credit | A fixed monthly amount SARS takes off your tax for being on a medical aid. |
| Fringe benefit | A work perk (like employer pension or medical aid contributions) that counts as income for tax. |
| Section 18A donation | A gift to a registered charity that reduces your taxable income (up to 10% of it). |
| Tax-free investment | An investment where growth is never taxed — limited to R46,000/year, R500,000 lifetime. |
| Tax threshold | The income level below which you pay no income tax (R99,000 if you're under 65). |

---

*End of PRD. Questions to resolve before Phase 1 kickoff are listed in §21 (Q1, Q2, Q6, Q7 are product decisions; Q3 is an ongoing monitoring duty).*
