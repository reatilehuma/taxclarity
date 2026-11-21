import type { TaxRuleSet } from "../types.ts";

/**
 * SARS parameters for the 2026/27 year of assessment
 * (1 March 2026 – 28 February 2027). Single source of truth: PRD §6.15.
 * Source IDs refer to PRD Appendix A.
 *
 * Do not use these values directly in logic — pass the rule set to the engine.
 */
export const TaxRules2026_27: TaxRuleSet = Object.freeze({
  taxYear: "2026-27",
  label: "2026/27",
  status: "verified",
  rulesVersion: "2026-27-r1",
  startDate: "2026-03-01",
  endDate: "2027-02-28",
  lastVerified: "2026-11-18",

  // PRD §6.1 — `from` is the amount the rate applies above.
  brackets: Object.freeze([
    { from: 0, to: 245_100, base: 0, rate: 0.18 },
    { from: 245_100, to: 383_100, base: 44_118, rate: 0.26 },
    { from: 383_100, to: 530_200, base: 79_998, rate: 0.31 },
    { from: 530_200, to: 695_800, base: 125_599, rate: 0.36 },
    { from: 695_800, to: 887_000, base: 185_215, rate: 0.39 },
    { from: 887_000, to: 1_878_600, base: 259_783, rate: 0.41 },
    { from: 1_878_600, to: null, base: 666_339, rate: 0.45 },
  ]),

  // PRD §6.2
  rebates: { primary: 17_820, secondary65: 9_765, tertiary75: 3_249 },

  // PRD §6.3
  thresholds: { under65: 99_000, age65to74: 153_250, age75plus: 171_300 },

  // PRD §6.5 — ceiling unchanged since 1 June 2021.
  uif: { employeeRate: 0.01, monthlyCeiling: 17_712, maxMonthlyEmployee: 177.12 },

  // PRD §6.6
  retirement11F: { rate: 0.275, annualCap: 430_000 },

  // PRD §6.7
  medical6A: { monthlyMain: 376, monthlyFirstDep: 376, monthlyAdditionalDep: 254 },

  // PRD §6.8
  medical6B: {
    under65: { multiplier: 0.25, contributionMultiple: 4, incomeThresholdRate: 0.075 },
    olderOrDisabled: { multiplier: 0.333, contributionMultiple: 3 },
  },

  // PRD §6.9
  donations18A: { limitRate: 0.1 },

  // PRD §6.10
  interestExemption: { under65: 23_800, age65plus: 34_500 },

  // PRD §6.11
  tfsa: { annualLimit: 46_000, lifetimeLimit: 500_000, excessPenaltyRate: 0.4 },

  // PRD §6.12
  travel: {
    prescribedRatePerKm: 4.95,
    taxableDefaultRate: 0.8,
    taxableBusinessRate: 0.2,
    businessUseThreshold: 0.8,
  },

  // PRD §6.14 — reference only (flags and education).
  reference: { donationsTaxAnnualExemption: 150_000 },

  // Not a SARS figure: the marginal rate from which the "top bracket" tip (PRD R9) is shown. It is the rate of the year's fifth bracket.
  guidance: { topBracketRate: 0.39 },

  monthsPerYear: 12,

  effectiveDates: {
    bracketsAndRebates: "2026-03-01",
    retirementCap430k: "2026-03-01",
    tfsa46k: "2026-03-01",
    uifCeiling: "2021-06-01",
    travelRate495: "2026-03-01",
  },

  sources: {
    brackets: ["S1", "S12"],
    rebates: ["S1", "S11"],
    thresholds: ["S1", "S11", "S12"],
    uif: ["S4"],
    retirement11F: ["S9", "S12"],
    medical6A: ["S2", "S13"],
    medical6B: ["S3", "S13"],
    donations18A: ["S10", "S12"],
    interestExemption: ["S11"],
    tfsa: ["S5"],
    travel: ["S6", "S8", "S12"],
    paye: ["S7", "S14"],
    reference: ["S10", "S11"],
  },
}) as TaxRuleSet;
