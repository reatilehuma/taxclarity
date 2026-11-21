import type { TaxRuleSet } from "../types.ts";

/**
 * SARS parameters for the 2025/26 year of assessment (1 March 2025 – 28 February 2026; SARS calls it the
 * "2026 tax year"). DRAFT: every value below comes from docs/rulesets/2025-26-sources.md, which records the
 * source, the section and the date it was read. Nothing here is copied from the 2026/27 set, and no gap is
 * filled with a 2026/27 figure. It stays "draft" until the reviewer signs the sources file (PRD §6.16, Q8).
 *
 * Source IDs: S16 = SARS Budget 2025 tax guide; S17 = Gazette notice 5936 of 28 Feb 2025; the rest are the
 * live SARS pages in apps/web/src/lib/sources.ts that carry a 2026-year column.
 *
 * Do not use these values directly in logic: pass the rule set to the engine.
 */
export const TaxRules2025_26: TaxRuleSet = /* @__PURE__ */ Object.freeze({
  taxYear: "2025-26",
  label: "2025/26",
  status: "draft",
  rulesVersion: "2025-26-draft-1",
  startDate: "2025-03-01",
  endDate: "2026-02-28",
  lastVerified: "2026-11-20",

  // S16 "Tax rates from 1 March 2025 to 28 February 2026". `from` is the amount the rate applies above.
  brackets: /* @__PURE__ */ Object.freeze([
    { from: 0, to: 237_100, base: 0, rate: 0.18 },
    { from: 237_100, to: 370_500, base: 42_678, rate: 0.26 },
    { from: 370_500, to: 512_800, base: 77_362, rate: 0.31 },
    { from: 512_800, to: 673_000, base: 121_475, rate: 0.36 },
    { from: 673_000, to: 857_900, base: 179_147, rate: 0.39 },
    { from: 857_900, to: 1_817_000, base: 251_258, rate: 0.41 },
    { from: 1_817_000, to: null, base: 644_489, rate: 0.45 },
  ]),

  // S16 and S1 (2026 column)
  rebates: { primary: 17_235, secondary65: 9_444, tertiary75: 3_145 },

  // S16 and S1 (2026 column)
  thresholds: { under65: 95_750, age65to74: 148_217, age75plus: 165_689 },

  // S4. Ceiling unchanged since 1 June 2021; no 2025 or 2026 notice found.
  uif: { employeeRate: 0.01, monthlyCeiling: 17_712, maxMonthlyEmployee: 177.12 },

  // S16: lower of R350 000 or 27.5% of taxable income.
  retirement11F: { rate: 0.275, annualCap: 350_000 },

  // S16 and S2 (2026 column): R364 for each of the first two persons, R246 for each additional dependant.
  medical6A: { monthlyMain: 364, monthlyFirstDep: 364, monthlyAdditionalDep: 246 },

  // S16: 33.3% (65+ or disability, contributions above 3 × credits); 25% (others, 4 × credits, above 7.5% of taxable income).
  medical6B: {
    under65: { multiplier: 0.25, contributionMultiple: 4, incomeThresholdRate: 0.075 },
    olderOrDisabled: { multiplier: 0.333, contributionMultiple: 3 },
  },

  // S16
  donations18A: { limitRate: 0.1 },

  // S16
  interestExemption: { under65: 23_800, age65plus: 34_500 },

  // S5: R36 000 a year "for the 2021 to 2026 year of assessment"; lifetime R500 000; 40% penalty.
  tfsa: { annualLimit: 36_000, lifetimeLimit: 500_000, excessPenaltyRate: 0.4 },

  // S17: simplified rate of 476 cents per km for years of assessment starting on or after 1 March 2025.
  // S16: 80% of an allowance is taxable, 20% if at least 80% of the vehicle's use is for business.
  travel: {
    prescribedRatePerKm: 4.76,
    taxableDefaultRate: 0.8,
    taxableBusinessRate: 0.2,
    businessUseThreshold: 0.8,
  },

  // S16: reference only (flags and education). Differs from the figure SARS's donations-tax page shows now (R150 000).
  reference: { donationsTaxAnnualExemption: 100_000 },

  // Not a SARS figure: the marginal rate from which the "top bracket" tip (PRD R9) is shown. It is the rate of the year's fifth bracket.
  guidance: { topBracketRate: 0.39 },

  monthsPerYear: 12,

  // None of these changed inside the year. Brackets and rebates were left as they were by the 12 March 2025 Budget.
  effectiveDates: {
    bracketsAndRebates: "2025-03-01",
    retirementCap350k: "2025-03-01",
    tfsa36k: "2025-03-01",
    uifCeiling: "2021-06-01",
    travelRate476: "2025-03-01",
  },

  sources: {
    brackets: ["S16"],
    rebates: ["S16", "S1"],
    thresholds: ["S16", "S1"],
    uif: ["S4"],
    retirement11F: ["S16"],
    medical6A: ["S16", "S2"],
    medical6B: ["S16"],
    donations18A: ["S16"],
    interestExemption: ["S16"],
    tfsa: ["S5"],
    travel: ["S16", "S17"],
    paye: ["S7"],
    reference: ["S16"],
  },
}) as TaxRuleSet;
