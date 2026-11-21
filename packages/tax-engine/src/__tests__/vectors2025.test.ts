import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { TaxRules2025_26 as rules } from "../rulesets/2025-26.ts";
import type { CalculationInputs, CalculationResult } from "../types.ts";

/**
 * Reference vectors Y1–Y19 for the 2025/26 year (draft). Phase 17.
 *
 * INDEPENDENCE. None of these numbers came from the engine. Each was worked out with a separate calculator
 * written only from the SARS published tables and formulas (docs/rulesets/2025-26-vectors.md shows the working
 * for each, so a person can check it with a pen). That calculator was first run on the PRD's T1 for 2026/27 and
 * reproduced R3 149,00 and R23 673,88 before it was trusted for 2025/26. No SARS-published worked example for
 * 2025/26 was found, so this is "checked against the published formula", not "checked against a SARS example".
 *
 * Ground covered, matching T1–T9 and friends: a worked example (Y1), bracket edge (Y2, Y3), the under-65
 * threshold (Y4, Y5), the 65+ and 75+ thresholds (Y6–Y9), the UIF ceiling (Y10), zero income (Y11), the
 * retirement cap (Y12, Y13), medical credits for 1, 2 and 5 people (Y14, Y1, Y15), a bonus (Y17), a bank
 * deposit turned back into a salary (Y18) and the extra medical credit (Y19).
 */

const gross = (amount: number, rest: Partial<CalculationInputs> = {}): CalculationInputs => ({
  mode: "GROSS",
  amount,
  ageBand: "UNDER_65",
  ...rest,
});
const run = (i: CalculationInputs) => calculate(rules, i);

interface Vector {
  id: string;
  label: string;
  inputs: CalculationInputs;
  expect: Partial<Record<"taxableIncome" | "annualTaxBeforeRebates" | "annualLiability" | "monthlyPaye" | "uifMonthly" | "takeHomeMonthly", number>>;
}

const VECTORS: Vector[] = [
  {
    id: "Y1",
    label: "R30 000, R3 000 pension, medical aid for 2",
    inputs: gross(30_000, {
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
    }),
    expect: { taxableIncome: 324_000, annualTaxBeforeRebates: 65_272, annualLiability: 39_301, monthlyPaye: 3_275.08, uifMonthly: 177.12, takeHomeMonthly: 23_547.8 },
  },
  { id: "Y2", label: "R19 750: last band is the 18% band", inputs: gross(19_750), expect: { taxableIncome: 237_000, annualTaxBeforeRebates: 42_660, annualLiability: 25_425, monthlyPaye: 2_118.75, takeHomeMonthly: 17_454.13 } },
  { id: "Y3", label: "R19 800: R500 into the 26% band", inputs: gross(19_800), expect: { taxableIncome: 237_600, annualTaxBeforeRebates: 42_808, annualLiability: 25_573, monthlyPaye: 2_131.08, takeHomeMonthly: 17_491.8 } },
  { id: "Y4", label: "R7 900: under the under-65 threshold", inputs: gross(7_900), expect: { taxableIncome: 94_800, annualTaxBeforeRebates: 17_064, annualLiability: 0, monthlyPaye: 0, uifMonthly: 79, takeHomeMonthly: 7_821 } },
  { id: "Y5", label: "R8 000: just over it", inputs: gross(8_000), expect: { taxableIncome: 96_000, annualTaxBeforeRebates: 17_280, annualLiability: 45, monthlyPaye: 3.75, uifMonthly: 80, takeHomeMonthly: 7_916.25 } },
  { id: "Y6", label: "65 to 74, R12 300: under their threshold", inputs: gross(12_300, { ageBand: "AGE_65_74" }), expect: { annualTaxBeforeRebates: 26_568, annualLiability: 0, monthlyPaye: 0, uifMonthly: 123, takeHomeMonthly: 12_177 } },
  { id: "Y7", label: "65 to 74, R12 400: just over it", inputs: gross(12_400, { ageBand: "AGE_65_74" }), expect: { annualTaxBeforeRebates: 26_784, annualLiability: 105, monthlyPaye: 8.75, uifMonthly: 124, takeHomeMonthly: 12_267.25 } },
  { id: "Y8", label: "75+, R13 700: under their threshold", inputs: gross(13_700, { ageBand: "AGE_75_PLUS" }), expect: { annualTaxBeforeRebates: 29_592, annualLiability: 0, monthlyPaye: 0, uifMonthly: 137, takeHomeMonthly: 13_563 } },
  { id: "Y9", label: "75+, R13 900: just over it", inputs: gross(13_900, { ageBand: "AGE_75_PLUS" }), expect: { annualTaxBeforeRebates: 30_024, annualLiability: 200, monthlyPaye: 16.67, uifMonthly: 139, takeHomeMonthly: 13_744.33 } },
  { id: "Y10", label: "R17 713: R1 above the UIF ceiling", inputs: gross(17_713), expect: { annualTaxBeforeRebates: 38_260.08, annualLiability: 21_025.08, monthlyPaye: 1_752.09, uifMonthly: 177.12, takeHomeMonthly: 15_783.79 } },
  { id: "Y11", label: "zero income", inputs: gross(0), expect: { taxableIncome: 0, annualTaxBeforeRebates: 0, annualLiability: 0, monthlyPaye: 0, uifMonthly: 0, takeHomeMonthly: 0 } },
  {
    id: "Y14",
    label: "R30 000, medical aid for 1 person",
    inputs: gross(30_000, { medical: { member: true, members: 1, monthlyContribution: 0, paidBy: "SELF" } }),
    expect: { annualTaxBeforeRebates: 74_632, annualLiability: 53_029, monthlyPaye: 4_419.08, takeHomeMonthly: 25_403.8 },
  },
  {
    id: "Y15",
    label: "R30 000, medical aid for 5 people",
    inputs: gross(30_000, { medical: { member: true, members: 5, monthlyContribution: 0, paidBy: "SELF" } }),
    expect: { annualLiability: 39_805, monthlyPaye: 3_317.08, takeHomeMonthly: 26_505.8 },
  },
];

describe.each(VECTORS)("$id · $label", ({ inputs, expect: want }) => {
  it("matches the independently worked figures", () => {
    const r = run(inputs);
    for (const [field, value] of Object.entries(want)) {
      expect(r[field as keyof CalculationResult], field).toBe(value);
    }
    expect(r.taxYear).toBe("2025-26");
  });
});

describe("2025/26: the figures that differ from 2026/27", () => {
  it("Y12: R600 000 a year into retirement is capped at R350 000, R250 000 carried forward", () => {
    // Income R1 800 000 + R240 000 employer benefit = R2 040 000; 27.5% = R561 000 > R350 000.
    const r = run(gross(150_000, { retirement: { ownMonthly: 30_000, employerMonthly: 20_000 } }));
    expect(r.retirement.limitAnnual).toBe(350_000);
    expect(r.retirement.deductionAnnual).toBe(350_000);
    expect(r.retirement.carryForwardAnnual).toBe(250_000);
  });

  it("Y13: R360 000 a year on R1 440 000 salary: capped at R350 000, R10 000 carried forward; R348 000 fits", () => {
    const over = run(gross(120_000, { retirement: { ownMonthly: 30_000, employerMonthly: 0 } }));
    expect([over.retirement.limitAnnual, over.retirement.deductionAnnual, over.retirement.carryForwardAnnual]).toEqual([350_000, 350_000, 10_000]);
    const fits = run(gross(120_000, { retirement: { ownMonthly: 29_000, employerMonthly: 0 } }));
    expect([fits.retirement.deductionAnnual, fits.retirement.carryForwardAnnual]).toEqual([348_000, 0]);
  });

  it("Y10: the UIF is the same at R17 712 and R17 713 (R177,12 is the most)", () => {
    expect(run(gross(17_712)).uifMonthly).toBe(177.12);
    expect(run(gross(17_713)).uifMonthly).toBe(177.12);
    expect(run(gross(17_712)).takeHomeMonthly).toBe(15_782.97);
  });

  it("Y17: R60 000 bonus: a normal month is untouched, the year pays R18 075 more tax on the bonus", () => {
    const r = run(gross(30_000, { variablePay: { bonusAnnual: 60_000, overtimeAnnual: 0, commissionAnnual: 0 } }));
    expect(r.monthlyPaye).toBe(4_783.08);
    expect(r.takeHomeMonthly).toBe(25_039.8);
    expect(r.annualPaye).toBe(75_472); // R57 397 regular + R18 075 on the bonus
    expect(r.variablePay.taxAnnual).toBe(18_075);
    expect(r.takeHomeMonthlyAverage).toBe(28_533.55);
  });

  it("Y18: a R20 000 deposit is a gross of about R23 189,47 (within R1)", () => {
    const r = run({ mode: "TAKE_HOME", amount: 20_000, ageBand: "UNDER_65" });
    expect(Math.abs(r.grossMonthly - 23_189.47)).toBeLessThanOrEqual(1);
    expect(r.takeHomeMonthly).toBeCloseTo(20_000, 1);
    expect(r.confidence).toBe("ESTIMATE");
  });

  it("Y19: 65 to 74, medical aid for 2 at R3 500, R10 000 out of pocket: credits R8 736 and R8 588,74", () => {
    // 6A: (364 + 364) × 12 = 8 736. 6B: 33,3% × (10 000 + (42 000 − 3 × 8 736)) = 33,3% × 25 792.
    const r = run(
      gross(30_000, {
        ageBand: "AGE_65_74",
        medical: { member: true, members: 2, monthlyContribution: 3_500, paidBy: "SELF", outOfPocketAnnual: 10_000 },
      }),
    );
    expect(r.medical6A.annualCredit).toBe(8_736);
    expect(r.medical6B.annualCredit).toBe(8_588.74);
    expect(r.annualTaxBeforeRebates).toBe(74_632);
    expect(r.annualLiability).toBe(30_628.26);
  });

  it("R30 000 a month: R57 397 a year here, R56 172 in 2026/27 (worked by hand: R1 225 apart)", () => {
    // Rebate R17 235 against R17 820, and the first bracket ends at R237 100 not R245 100.
    expect(run(gross(30_000)).annualLiability).toBe(57_397);
  });
});
