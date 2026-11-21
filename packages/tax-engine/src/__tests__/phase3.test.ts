import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { createCalculator, stableKey } from "../memo.ts";
import { dec } from "../money.ts";
import { TaxRules2026_27 as rules } from "../rulesets/2026-27.ts";
import type {
  AgeBand,
  CalculationInputs,
  MedicalPaidBy,
  MedicalPaidVia,
  PayFrequency,
} from "../types.ts";

const calc = (inputs: CalculationInputs) => calculate(rules, inputs);

describe("take-home → gross estimate", () => {
  it("T16 (corrected, D1): R20 000 take-home, under 65 → gross ≈ R23 051.51", () => {
    const r = calc({ mode: "TAKE_HOME", amount: 20_000, ageBand: "UNDER_65" });
    expect(Math.abs(r.grossMonthly - 23_051.51)).toBeLessThanOrEqual(1);
    expect(r.takeHomeMonthly).toBeCloseTo(20_000, 1);
    expect(r.bracketIndex).toBe(1); // 26% bracket
    expect(r.confidence).toBe("ESTIMATE");
    expect(r.notes).toContain("ESTIMATED_FROM_TAKE_HOME");
    expect(r.estimate?.method).toBe("FIXED_POINT");
  });

  it("gross mode is not an estimate", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65" });
    expect(r.confidence).toBe("PAYSLIP_ACCURATE");
    expect(r.estimate).toBeUndefined();
  });

  it("zero take-home → zero gross, no errors (E1)", () => {
    const r = calc({ mode: "TAKE_HOME", amount: 0, ageBand: "UNDER_65" });
    expect(r.grossMonthly).toBe(0);
    expect(r.monthlyPaye).toBe(0);
    expect(r.estimate?.method).toBe("NONE");
  });

  it("reproduces T1 from its take-home", () => {
    const base = {
      ageBand: "UNDER_65" as const,
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" as const },
    };
    const r = calc({ ...base, mode: "TAKE_HOME", amount: 23_673.88 });
    expect(r.grossMonthly).toBe(30_000);
    expect(r.monthlyPaye).toBe(3_149);
  });

  it("weekly take-home is converted before solving", () => {
    const gross = calc({ amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65" });
    const back = calc({ mode: "TAKE_HOME", amount: gross.takeHomePerPeriod, payFrequency: "WEEKLY", ageBand: "UNDER_65" });
    expect(Math.abs(back.grossPerPeriod - 5_000)).toBeLessThanOrEqual(0.05);
  });

  it("bonuses don't change the solved gross (a normal month has no bonus)", () => {
    const plain = calc({ mode: "TAKE_HOME", amount: 25_000, ageBand: "UNDER_65" });
    const withBonus = calc({
      mode: "TAKE_HOME",
      amount: 25_000,
      ageBand: "UNDER_65",
      variablePay: { bonusAnnual: 40_000 },
    });
    expect(withBonus.grossMonthly).toBe(plain.grossMonthly);
    expect(withBonus.takeHomeMonthlyAverage).toBeGreaterThan(plain.takeHomeMonthlyAverage);
  });

  it("converges for very large and very small targets", () => {
    for (const amount of [0.01, 1, 50, 3_000, 150_000, 1_000_000, 9_999_999]) {
      const r = calc({ mode: "TAKE_HOME", amount, ageBand: "AGE_75_PLUS" });
      expect(Math.abs(r.estimate!.residual)).toBeLessThanOrEqual(0.02);
    }
  });
});

describe("variable pay (D4: balance-of-remuneration)", () => {
  // R30 000 + R30 000 bonus. Regular 360 000 → 56 172 tax. With bonus 390 000 →
  // 79 998 + 31% × 6 900 = 82 137 − 17 820 = 64 317. Bonus tax = 8 145.
  const r = calc({ amount: 30_000, ageBand: "UNDER_65", variablePay: { bonusAnnual: 30_000 } });

  it("a normal month's PAYE ignores the bonus", () => {
    expect(r.monthlyPaye).toBe(4_681);
    expect(r.takeHomeMonthly).toBe(25_141.88);
  });

  it("tax on the bonus = tax with it − tax without it", () => {
    expect(r.variablePay.taxAnnual).toBe(8_145);
    expect(r.variablePay.effectiveRate).toBeCloseTo(0.2715, 4);
    expect(r.annualPaye).toBe(64_317);
    expect(r.annualLiability).toBe(64_317);
  });

  it("the bonus is taxed at the higher bracket it pushes into", () => {
    expect(r.taxableIncome).toBe(390_000);
    expect(r.bracketIndex).toBe(2);
    expect(r.marginalRate).toBe(0.31);
  });

  it("averaged month and year include the bonus after tax", () => {
    expect(r.monthlyPayeAverage).toBe(5_359.75);
    expect(r.uifMonthlyAverage).toBe(177.12);
    expect(r.takeHomeMonthlyAverage).toBe(26_963.13);
    expect(r.takeHomeAnnual).toBe(323_557.56);
    expect(r.notes).toEqual(expect.arrayContaining(["VARIABLE_PAY_BALANCE_METHOD", "UIF_ON_AVERAGED_VARIABLE_PAY"]));
  });

  it("overtime and commission add up with bonus", () => {
    const all = calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      variablePay: { bonusAnnual: 10_000, overtimeAnnual: 12_000, commissionAnnual: 8_000 },
    });
    expect(all.variablePay.totalAnnual).toBe(30_000);
    expect(all.variablePay.taxAnnual).toBe(8_145);
  });

  it("UIF on extras is averaged and still capped", () => {
    const low = calc({ amount: 10_000, ageBand: "UNDER_65", variablePay: { overtimeAnnual: 24_000 } });
    expect(low.uifMonthly).toBe(100);
    expect(low.uifMonthlyAverage).toBe(120);
    const high = calc({ amount: 17_000, ageBand: "UNDER_65", variablePay: { bonusAnnual: 60_000 } });
    expect(high.uifMonthlyAverage).toBe(177.12);
  });

  it("warns when extras are more than 3× the annual salary", () => {
    expect(calc({ amount: 10_000, ageBand: "UNDER_65", variablePay: { commissionAnnual: 360_001 } }).warnings).toContain(
      "VARIABLE_PAY_HIGH",
    );
    expect(calc({ amount: 10_000, ageBand: "UNDER_65", variablePay: { commissionAnnual: 360_000 } }).warnings).not.toContain(
      "VARIABLE_PAY_HIGH",
    );
  });

  it("extras raise the retirement limit (27.5% of a bigger income)", () => {
    const base = { amount: 20_000, ageBand: "UNDER_65" as const, retirement: { ownMonthly: 10_000, employerMonthly: 0 } };
    const plain = calc(base);
    const withBonus = calc({ ...base, variablePay: { bonusAnnual: 100_000 } });
    expect(plain.retirement.deductionAnnual).toBe(66_000);
    expect(withBonus.retirement.deductionAnnual).toBe(93_500);
  });
});

describe("medical aid paid by debit order", () => {
  const t1 = (paidVia: MedicalPaidVia, paidBy: MedicalPaidBy = "SELF", employerMonthly = 0) =>
    calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 4_000, paidBy, employerMonthly, ownSharePaidVia: paidVia },
    });

  it("payroll: medical comes off the payslip and the credit is applied monthly", () => {
    const r = t1("PAYROLL");
    expect(r.monthlyPaye).toBe(3_149);
    expect(r.takeHomeMonthly).toBe(19_673.88);
    expect(r.filing.refundAnnual).toBe(0);
  });

  it("debit order: deposit isn't reduced, payroll PAYE has no credit, credit comes back on filing", () => {
    const r = t1("DEBIT_ORDER");
    expect(r.ownMedicalPaidVia).toBe("DEBIT_ORDER");
    expect(r.ownMedicalMonthly).toBe(4_000);
    // 46 812 ÷ 12 = 3 901 withheld; liability still 37 788.
    expect(r.monthlyPaye).toBe(3_901);
    expect(r.annualPaye).toBe(46_812);
    expect(r.annualLiability).toBe(37_788);
    expect(r.filing.refundAnnual).toBe(9_024);
    expect(r.takeHomeMonthly).toBe(30_000 - 3_000 - 3_901 - 177.12);
    expect(r.notes).toContain("MEDICAL_CREDIT_CLAIMED_ON_FILING");
  });

  it("shared with employer: payroll still applies the credit", () => {
    const r = t1("DEBIT_ORDER", "SHARED", 1_000);
    expect(r.filing.refundAnnual).toBe(0);
    expect(r.ownMedicalMonthly).toBe(3_000);
  });

  it("debit order is ignored when the employer pays everything", () => {
    const r = t1("DEBIT_ORDER", "EMPLOYER");
    expect(r.ownMedicalPaidVia).toBe("PAYROLL");
    expect(r.filing.refundAnnual).toBe(0);
  });

  it("take-home mode: a bank deposit with debit-order medical solves to the right gross", () => {
    const gross = t1("DEBIT_ORDER");
    const back = calc({
      mode: "TAKE_HOME",
      amount: gross.takeHomeMonthly,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 4_000, paidBy: "SELF", ownSharePaidVia: "DEBIT_ORDER" },
    });
    expect(back.grossMonthly).toBe(30_000);
  });
});

describe("memoised calculator", () => {
  it("returns the cached result for the same inputs, in any key order", () => {
    const calcMemo = createCalculator(rules);
    const a = calcMemo({ amount: 30_000, ageBand: "UNDER_65", mode: "TAKE_HOME" });
    const b = calcMemo({ mode: "TAKE_HOME", ageBand: "UNDER_65", amount: 30_000 });
    expect(b).toBe(a);
    expect(calcMemo({ amount: 30_001, ageBand: "UNDER_65", mode: "TAKE_HOME" })).not.toBe(a);
  });

  it("evicts the least recently used entry", () => {
    const calcMemo = createCalculator(rules, { cacheSize: 2 });
    const first = calcMemo({ amount: 1, ageBand: "UNDER_65" });
    calcMemo({ amount: 2, ageBand: "UNDER_65" });
    calcMemo({ amount: 3, ageBand: "UNDER_65" });
    expect(calcMemo({ amount: 1, ageBand: "UNDER_65" })).not.toBe(first);
  });

  it("stable key ignores property order", () => {
    expect(stableKey({ b: 1, a: { d: 2, c: 3 } })).toBe(stableKey({ a: { c: 3, d: 2 }, b: 1 }));
  });
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const inputs = fc.record({
  amount: money(300_000),
  payFrequency: fc.constantFrom<PayFrequency>("MONTHLY", "WEEKLY", "FORTNIGHTLY"),
  ageBand: fc.constantFrom<AgeBand>("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
  retirement: fc.record({ ownMonthly: money(20_000), employerMonthly: money(20_000) }),
  medical: fc.record({
    member: fc.boolean(),
    members: fc.integer({ min: 1, max: 15 }),
    monthlyContribution: money(15_000),
    paidBy: fc.constantFrom<MedicalPaidBy>("SELF", "EMPLOYER", "SHARED"),
    employerMonthly: money(15_000),
    monthsCovered: fc.integer({ min: 0, max: 12 }),
    ownSharePaidVia: fc.constantFrom<MedicalPaidVia>("PAYROLL", "DEBIT_ORDER"),
  }),
  variablePay: fc.record({ bonusAnnual: money(200_000), overtimeAnnual: money(50_000), commissionAnnual: money(100_000) }),
});

describe("properties", () => {
  it("round trip: gross → take-home → gross lands within 10 cents", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const forward = calc({ ...i, mode: "GROSS" });
        fc.pre(forward.takeHomeMonthly > 0);
        const back = calc({ ...i, mode: "TAKE_HOME", amount: forward.takeHomePerPeriod });
        expect(Math.abs(back.grossPerPeriod - forward.grossPerPeriod)).toBeLessThanOrEqual(0.1);
      }),
      { numRuns: 400 },
    );
  });

  it("the solver always lands within 2 cents of the target", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc({ ...i, mode: "TAKE_HOME" });
        expect(Math.abs(r.estimate!.residual)).toBeLessThanOrEqual(0.02);
      }),
      { numRuns: 300 },
    );
  });

  it("tax on extras is never negative and never more than 45% of them", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc(i);
        expect(r.variablePay.taxAnnual).toBeGreaterThanOrEqual(0);
        expect(r.variablePay.taxAnnual).toBeLessThanOrEqual(r.variablePay.totalAnnual * 0.45 + 0.01);
      }),
      { numRuns: 400 },
    );
  });

  it("averaged month reconciles to the cent", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc(i);
        const medical = r.ownMedicalPaidVia === "PAYROLL" ? r.ownMedicalMonthly : 0;
        const sum = dec(r.grossMonthly)
          .plus(dec(r.variablePay.totalAnnual).dividedBy(12).toDecimalPlaces(2))
          .minus(r.ownRetirementMonthly)
          .minus(medical)
          .minus(r.monthlyPayeAverage)
          .minus(r.uifMonthlyAverage);
        expect(sum.toNumber()).toBe(r.takeHomeMonthlyAverage);
      }),
      { numRuns: 400 },
    );
  });

  it("withheld PAYE + filing balance = final tax", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc(i);
        expect(dec(r.annualPaye).plus(r.filing.balanceAnnual).toNumber()).toBeCloseTo(r.annualLiability, 2);
      }),
      { numRuns: 400 },
    );
  });
});
