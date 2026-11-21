import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { medical6AMonthly } from "../medical.ts";
import { dec } from "../money.ts";
import { TaxRules2026_27 as rules } from "../rulesets/2026-27.ts";
import type { AgeBand, CalculationInputs, MedicalPaidBy, PayFrequency } from "../types.ts";

const calc = (inputs: CalculationInputs) => calculate(rules, inputs);

describe("PRD test vectors", () => {
  it("T1: R30 000, 10% pension, medical aid main + 1 → PAYE R3 149, take-home R23 673.88", () => {
    const r = calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0, fundTypes: ["PENSION"] },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
    });
    expect(r.taxableIncome).toBe(324_000);
    expect(r.annualTaxBeforeRebates).toBe(64_632);
    expect(r.taxAfterRebates).toBe(46_812);
    expect(r.medical6A.annualCredit).toBe(9_024);
    expect(r.annualPaye).toBe(37_788);
    expect(r.monthlyPaye).toBe(3_149);
    expect(r.uifMonthly).toBe(177.12);
    expect(r.takeHomeMonthly).toBe(23_673.88);
  });

  it("T10: R60 000 a month, own RA R200 000 a year → deduction R198 000, R2 000 carried forward", () => {
    const r = calc({
      amount: 60_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 200_000 / 12, employerMonthly: 0, fundTypes: ["RA"] },
    });
    expect(r.retirement.percentageLimitAnnual).toBe(198_000);
    expect(r.retirement.limitAnnual).toBe(198_000);
    expect(r.retirement.capApplied).toBe(false);
    expect(r.retirement.deductionAnnual).toBe(198_000);
    expect(r.retirement.carryForwardAnnual).toBe(2_000);
    expect(r.taxableIncome).toBe(522_000);
  });

  it("T11: R150 000 a month, own + employer R600 000 a year → R430 000 cap applies", () => {
    const r = calc({
      amount: 150_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 30_000, employerMonthly: 20_000 },
    });
    expect(r.retirement.poolAnnual).toBe(600_000);
    expect(r.retirement.remunerationAnnual).toBe(2_040_000); // 1.8m salary + 240k fringe benefit
    expect(r.retirement.percentageLimitAnnual).toBe(561_000);
    expect(r.retirement.capApplied).toBe(true);
    expect(r.retirement.deductionAnnual).toBe(430_000);
    expect(r.retirement.carryForwardAnnual).toBe(170_000);
    expect(r.taxableIncome).toBe(2_040_000 - 430_000);
  });
});

describe("Section 6A medical credit", () => {
  it.each([
    [1, 376],
    [2, 752],
    [3, 1_006],
    [5, 1_514],
    [15, 4_054],
  ])("%i member(s) → R%i a month", (members, expected) => {
    expect(medical6AMonthly(rules, members).toNumber()).toBe(expected);
    const r = calc({
      amount: 40_000,
      ageBand: "UNDER_65",
      medical: { member: true, members, monthlyContribution: 3_000, paidBy: "SELF" },
    });
    expect(r.medical6A.monthlyCredit).toBe(expected);
    expect(r.medical6A.annualCredit).toBe(expected * 12);
  });

  it("no medical aid → no credit", () => {
    const r = calc({ amount: 40_000, ageBand: "UNDER_65" });
    expect(r.medical6A.annualCredit).toBe(0);
    expect(r.provenance.appliedRules).not.toContain("medical6A");
  });

  it("members are clamped to 1–15", () => {
    const base = { amount: 40_000, ageBand: "UNDER_65" as const };
    expect(calc({ ...base, medical: { member: true, members: 0, monthlyContribution: 0, paidBy: "SELF" } }).medical6A.members).toBe(1);
    expect(calc({ ...base, medical: { member: true, members: 40, monthlyContribution: 0, paidBy: "SELF" } }).medical6A.members).toBe(15);
  });

  it("pro-rates the credit for part-year membership (E13)", () => {
    const r = calc({
      amount: 40_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 2, monthlyContribution: 2_000, paidBy: "SELF", monthsCovered: 6 },
    });
    expect(r.medical6A.annualCredit).toBe(752 * 6);
    expect(r.ownMedicalAnnual).toBe(12_000);
    expect(r.ownMedicalMonthly).toBe(1_000); // spread over the year
  });

  it("credit can't push tax below R0 (non-refundable, E18)", () => {
    // R10 000 a month: 120 000 → 21 600 − 17 820 = 3 780 tax after rebates; credit 9 024.
    const r = calc({
      amount: 10_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 2, monthlyContribution: 1_500, paidBy: "SELF" },
    });
    expect(r.taxAfterRebates).toBe(3_780);
    expect(r.annualPaye).toBe(0);
    expect(r.medical6A.appliedAnnual).toBe(3_780);
    expect(r.medical6A.unusedAnnual).toBe(9_024 - 3_780);
    expect(r.marginalRate).toBe(0);
  });

  it("own share comes off take-home", () => {
    const withMed = calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 4_000, paidBy: "SELF" },
    });
    expect(withMed.monthlyPaye).toBe(3_149);
    expect(withMed.takeHomeMonthly).toBe(23_673.88 - 4_000);
  });
});

describe("employer medical contribution as a fringe benefit (D5)", () => {
  it("EMPLOYER: whole contribution is added to taxable income, nothing off take-home", () => {
    // R25 000 keeps both cases in the 26% bracket (300 000 and 324 000 a year).
    const none = calc({ amount: 25_000, ageBand: "UNDER_65" });
    const r = calc({
      amount: 25_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 1, monthlyContribution: 2_000, paidBy: "EMPLOYER" },
    });
    expect(r.employerMedicalAnnual).toBe(24_000);
    expect(r.ownMedicalMonthly).toBe(0);
    expect(r.taxableIncome).toBe(none.taxableIncome + 24_000);
    expect(r.medical6A.annualCredit).toBe(4_512);
    // Extra tax: 26% × 24 000 = 6 240, less credit 4 512 → +1 728 a year (+144 a month).
    expect(r.annualPaye).toBe(none.annualPaye + 1_728);
    expect(r.takeHomeMonthly).toBe(none.takeHomeMonthly - 144);
    expect(r.provenance.appliedRules).toContain("fringeBenefit.employerMedical");
  });

  it("SHARED: employer share is a fringe benefit, the rest comes off take-home", () => {
    const r = calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 3, monthlyContribution: 5_000, paidBy: "SHARED", employerMonthly: 2_000 },
    });
    expect(r.employerMedicalMonthly).toBe(2_000);
    expect(r.ownMedicalMonthly).toBe(3_000);
  });

  it("SHARED: employer share can't exceed the total", () => {
    const r = calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 1, monthlyContribution: 1_000, paidBy: "SHARED", employerMonthly: 9_000 },
    });
    expect(r.employerMedicalMonthly).toBe(1_000);
    expect(r.ownMedicalMonthly).toBe(0);
  });
});

describe("employer retirement contribution", () => {
  it("is a fringe benefit in and a deduction out — tax-neutral within the limit", () => {
    const own = calc({ amount: 40_000, ageBand: "UNDER_65", retirement: { ownMonthly: 2_000, employerMonthly: 0 } });
    const both = calc({ amount: 40_000, ageBand: "UNDER_65", retirement: { ownMonthly: 2_000, employerMonthly: 3_000 } });
    expect(both.incomeBeforeDeductions).toBe(own.incomeBeforeDeductions + 36_000);
    expect(both.retirement.deductionAnnual).toBe(own.retirement.deductionAnnual + 36_000);
    expect(both.taxableIncome).toBe(own.taxableIncome);
    expect(both.monthlyPaye).toBe(own.monthlyPaye);
    expect(both.takeHomeMonthly).toBe(own.takeHomeMonthly);
  });

  it("contributions larger than the salary are capped and flagged (E17)", () => {
    const r = calc({ amount: 10_000, ageBand: "UNDER_65", retirement: { ownMonthly: 15_000, employerMonthly: 0 } });
    expect(r.retirement.deductionAnnual).toBe(33_000); // 27.5% × 120 000
    expect(r.retirement.carryForwardAnnual).toBe(180_000 - 33_000);
    expect(r.warnings).toContain("DEDUCTIONS_EXCEED_GROSS");
    expect(r.takeHomeMonthly).toBeLessThan(0);
  });
});

describe("pay frequency", () => {
  it("weekly R5 000 → R260 000 a year, R21 666.67 a month", () => {
    const r = calc({ amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65" });
    expect(r.periodsPerYear).toBe(52);
    expect(r.grossPerPeriod).toBe(5_000);
    expect(r.grossAnnual).toBe(260_000);
    expect(r.grossMonthly).toBe(21_666.67);
    // 44 118 + 26% × 14 900 = 47 992 − 17 820 = 30 172 ÷ 12 = 2 514.33
    expect(r.monthlyPaye).toBe(2_514.33);
    expect(r.takeHomeMonthly).toBe(18_975.22);
    expect(r.takeHomePerPeriod).toBe(4_378.9); // 18 975.22 × 12 ÷ 52
    expect(r.provenance.appliedRules).toContain("payFrequency.weekly");
  });

  it("fortnightly R10 000 gives the same annual tax as weekly R5 000", () => {
    const f = calc({ amount: 10_000, payFrequency: "FORTNIGHTLY", ageBand: "UNDER_65" });
    const w = calc({ amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65" });
    expect(f.annualPaye).toBe(w.annualPaye);
    expect(f.takeHomePerPeriod).toBe(8_757.79); // 18 975.22 × 12 ÷ 26
  });

  it("monthly take-home per period equals the monthly figure", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65" });
    expect(r.takeHomePerPeriod).toBe(r.takeHomeMonthly);
  });
});

describe("provenance", () => {
  it("lists every rule used", () => {
    const r = calc({
      amount: 150_000,
      ageBand: "AGE_75_PLUS",
      retirement: { ownMonthly: 40_000, employerMonthly: 10_000 },
      medical: { member: true, members: 2, monthlyContribution: 6_000, paidBy: "SELF" },
    });
    expect(r.provenance.ruleSetVersion).toBe("2026-27");
    expect(r.provenance.appliedRules).toEqual(
      expect.arrayContaining([
        "brackets",
        "rebates.primary",
        "rebates.secondary65",
        "rebates.tertiary75",
        "uif",
        "retirement11F.rate",
        "retirement11F.annualCap",
        "fringeBenefit.employerRetirement",
        "medical6A",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (PRD §20 Phase 1 acceptance)
// ---------------------------------------------------------------------------

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const ageBand = fc.constantFrom<AgeBand>("UNDER_65", "AGE_65_74", "AGE_75_PLUS");
const frequency = fc.constantFrom<PayFrequency>("MONTHLY", "WEEKLY", "FORTNIGHTLY");
const paidBy = fc.constantFrom<MedicalPaidBy>("SELF", "EMPLOYER", "SHARED");

const inputs = fc.record({
  amount: money(500_000),
  payFrequency: frequency,
  ageBand,
  retirement: fc.record({ ownMonthly: money(60_000), employerMonthly: money(40_000) }),
  medical: fc.record({
    member: fc.boolean(),
    members: fc.integer({ min: 1, max: 15 }),
    monthlyContribution: money(20_000),
    paidBy,
    employerMonthly: money(20_000),
    monthsCovered: fc.integer({ min: 0, max: 12 }),
  }),
});

describe("properties", () => {
  it("tax is never negative and every number is finite", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc(i);
        for (const v of [r.annualPaye, r.monthlyPaye, r.uifMonthly, r.taxableIncome, r.retirement.deductionAnnual]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
        expect(Number.isFinite(r.takeHomeMonthly)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("more gross never means less take-home (other inputs fixed)", () => {
    fc.assert(
      fc.property(inputs, money(50_000), (i, extra) => {
        const lower = calc(i);
        const higher = calc({ ...i, amount: i.amount + extra });
        expect(higher.takeHomeMonthly).toBeGreaterThanOrEqual(lower.takeHomeMonthly);
      }),
      { numRuns: 500 },
    );
  });

  it("retirement deduction never exceeds the pool, 27.5% or the R430 000 cap", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const { retirement: r } = calc(i);
        expect(r.deductionAnnual).toBeLessThanOrEqual(r.poolAnnual);
        expect(r.deductionAnnual).toBeLessThanOrEqual(430_000);
        expect(r.deductionAnnual).toBeLessThanOrEqual(r.percentageLimitAnnual + 0.01);
        expect(r.deductionAnnual + r.carryForwardAnnual).toBeCloseTo(r.poolAnnual, 2);
      }),
      { numRuns: 500 },
    );
  });

  it("gross − own retirement − own medical − PAYE − UIF = take-home, to the cent", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc(i);
        const sum = dec(r.grossMonthly)
          .minus(r.ownRetirementMonthly)
          .minus(r.ownMedicalMonthly)
          .minus(r.monthlyPaye)
          .minus(r.uifMonthly);
        expect(sum.toNumber()).toBe(r.takeHomeMonthly);
      }),
      { numRuns: 500 },
    );
  });

  it("bad inputs never throw", () => {
    const junk = fc.oneof(fc.double(), fc.constant(Number.NaN), fc.constant(-1), fc.constant(Number.POSITIVE_INFINITY));
    fc.assert(
      fc.property(junk, junk, junk, junk, fc.integer({ min: -50, max: 50 }), (g, own, emp, med, members) => {
        expect(() =>
          calc({
            amount: g,
            ageBand: "UNDER_65",
            retirement: { ownMonthly: own, employerMonthly: emp },
            medical: { member: true, members, monthlyContribution: med, paidBy: "SHARED", employerMonthly: emp },
          }),
        ).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});
