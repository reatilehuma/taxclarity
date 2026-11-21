import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { dec } from "../money.ts";
import { TaxRules2026_27 as rules } from "../rulesets/2026-27.ts";
import { bracketWalk, rebatesFor, taxAfterRebates, taxBeforeRebates } from "../tax.ts";
import type { AgeBand, TaxRuleSet } from "../types.ts";
import { assertValidRuleSet } from "../validate.ts";

const tax = (taxable: number) => taxBeforeRebates(rules, dec(taxable)).toNumber();
const AGE_BANDS: AgeBand[] = ["UNDER_65", "AGE_65_74", "AGE_75_PLUS"];

describe("rule set 2026/27", () => {
  it("is internally consistent", () => {
    expect(() => assertValidRuleSet(rules)).not.toThrow();
  });

  it("rejects a rule set with a wrong bracket base", () => {
    const broken: TaxRuleSet = {
      ...rules,
      brackets: rules.brackets.map((b, i) => (i === 2 ? { ...b, base: 80_000 } : b)),
    };
    expect(() => assertValidRuleSet(broken)).toThrow(/bracket 3: base 80000 should be 79998/);
  });

  it("rejects a threshold that does not match the rebates", () => {
    const broken: TaxRuleSet = { ...rules, thresholds: { ...rules.thresholds, under65: 95_000 } };
    expect(() => assertValidRuleSet(broken)).toThrow(/thresholds.under65/);
  });

  it("has a source reference for every parameter group", () => {
    for (const key of ["brackets", "rebates", "thresholds", "uif", "paye"]) {
      expect(rules.sources[key]?.length).toBeGreaterThan(0);
    }
  });
});

describe("PRD test vectors T2–T9", () => {
  it("T2: taxable income exactly R245 100 → tax R44 118", () => {
    expect(tax(245_100)).toBe(44_118);
  });

  it("T3: taxable income R245 101 → tax R44 118.26", () => {
    expect(tax(245_101)).toBe(44_118.26);
  });

  it("T4: under 65, taxable R99 000 → R17 820 before rebate, R0 after", () => {
    expect(tax(99_000)).toBe(17_820);
    expect(taxAfterRebates(rules, dec(99_000), "UNDER_65").toNumber()).toBe(0);
    const r = calculate(rules, { amount: 8_250, ageBand: "UNDER_65" });
    expect(r.taxableIncome).toBe(99_000);
    expect(r.monthlyPaye).toBe(0);
    expect(r.belowThreshold).toBe(true);
  });

  it("T5: age 65, taxable R153 250 → R27 585 before rebates, R0 after", () => {
    expect(tax(153_250)).toBe(27_585);
    expect(rebatesFor(rules, "AGE_65_74").total).toBe(27_585);
    expect(taxAfterRebates(rules, dec(153_250), "AGE_65_74").toNumber()).toBe(0);
  });

  it("T6: age 75, taxable R171 300 → R30 834 before rebates, R0 after", () => {
    expect(tax(171_300)).toBe(30_834);
    expect(rebatesFor(rules, "AGE_75_PLUS").total).toBe(30_834);
    expect(taxAfterRebates(rules, dec(171_300), "AGE_75_PLUS").toNumber()).toBe(0);
  });

  it("T7: UIF caps at R177.12 from R17 712 a month", () => {
    expect(calculate(rules, { amount: 17_712, ageBand: "UNDER_65" }).uifMonthly).toBe(177.12);
    expect(calculate(rules, { amount: 17_713, ageBand: "UNDER_65" }).uifMonthly).toBe(177.12);
    expect(calculate(rules, { amount: 250_000, ageBand: "UNDER_65" }).uifMonthly).toBe(177.12);
  });

  it("T8: R5 000 a month → UIF R50, no income tax", () => {
    const r = calculate(rules, { amount: 5_000, ageBand: "UNDER_65" });
    expect(r.uifMonthly).toBe(50);
    expect(r.monthlyPaye).toBe(0);
    expect(r.annualPaye).toBe(0);
    expect(r.takeHomeMonthly).toBe(4_950);
    expect(r.belowThreshold).toBe(true);
  });

  it("T9: zero income → all zeros, no errors", () => {
    const r = calculate(rules, { amount: 0, ageBand: "UNDER_65" });
    expect(r).toMatchObject({
      grossMonthly: 0,
      grossAnnual: 0,
      taxableIncome: 0,
      annualTaxBeforeRebates: 0,
      annualPaye: 0,
      monthlyPaye: 0,
      uifMonthly: 0,
      takeHomeMonthly: 0,
      effectiveRate: 0,
      marginalRate: 0,
    });
  });
});

describe("plain salary calculation", () => {
  it("R30 000 a month, under 65, no deductions → R4 681 PAYE", () => {
    // 360 000 → 44 118 + 26% × 114 900 = 73 992; less 17 820 = 56 172; ÷ 12 = 4 681.
    const r = calculate(rules, { amount: 30_000, ageBand: "UNDER_65" });
    expect(r.annualTaxBeforeRebates).toBe(73_992);
    expect(r.annualPaye).toBe(56_172);
    expect(r.monthlyPaye).toBe(4_681);
    expect(r.uifMonthly).toBe(177.12);
    expect(r.takeHomeMonthly).toBe(25_141.88);
    expect(r.bracketIndex).toBe(1);
    expect(r.marginalRate).toBe(0.26);
  });

  it("older age bands pay less on the same salary", () => {
    const [u65, a65, a75] = AGE_BANDS.map(
      (ageBand) => calculate(rules, { amount: 30_000, ageBand }).annualPaye,
    );
    expect(u65! - a65!).toBe(9_765);
    expect(a65! - a75!).toBe(3_249);
  });

  it("rounds monthly PAYE half-up to the cent", () => {
    // 20 000 × 12 = 240 000 → 43 200 − 17 820 = 25 380 ÷ 12 = 2 115.
    expect(calculate(rules, { amount: 20_000, ageBand: "UNDER_65" }).monthlyPaye).toBe(2_115);
    // 20 000.01 × 12 = 240 000.12 → 25 380.0216 ÷ 12 = 2 115.0018 → 2 115.00
    expect(calculate(rules, { amount: 20_000.01, ageBand: "UNDER_65" }).monthlyPaye).toBe(2_115);
  });

  it("gross − PAYE − UIF = take-home, to the cent", () => {
    for (const grossMonthly of [1, 999.99, 8_250, 17_712, 23_051.51, 44_444.44, 160_000, 1_000_000]) {
      for (const ageBand of AGE_BANDS) {
        const r = calculate(rules, { amount: grossMonthly, ageBand });
        expect(dec(r.grossMonthly).minus(r.monthlyPaye).minus(r.uifMonthly).toNumber()).toBe(r.takeHomeMonthly);
      }
    }
  });
});

describe("bracket boundaries", () => {
  it("income on each upper limit pays exactly the next bracket's base", () => {
    rules.brackets.forEach((b, i) => {
      if (b.to === null) return;
      expect(tax(b.to)).toBe(rules.brackets[i + 1]!.base);
    });
  });

  it("R1 above each boundary is taxed at the next rate", () => {
    rules.brackets.forEach((b, i) => {
      if (b.to === null) return;
      const next = rules.brackets[i + 1]!;
      expect(tax(b.to + 1)).toBeCloseTo(next.base + next.rate, 10);
    });
  });

  it("bracket walk adds up to the tax and marks one top bracket", () => {
    for (const taxable of [0, 50_000, 245_100, 245_101, 600_000, 2_500_000]) {
      const walk = bracketWalk(rules, dec(taxable));
      expect(walk).toHaveLength(rules.brackets.length);
      expect(walk.filter((r) => r.isTopBracket)).toHaveLength(1);
      expect(walk.at(-1)!.runningTotal).toBe(Number(tax(taxable).toFixed(2)));
      expect(walk.reduce((s, r) => s + r.amountInBracket, 0)).toBeCloseTo(taxable, 2);
    }
  });

  it("each age band pays tax just above its threshold and none at it", () => {
    for (const ageBand of AGE_BANDS) {
      const threshold = calculate(rules, { amount: 0, ageBand }).taxThreshold;
      expect(taxAfterRebates(rules, dec(threshold), ageBand).toNumber()).toBe(0);
      expect(taxAfterRebates(rules, dec(threshold + 100), ageBand).toNumber()).toBe(18);
    }
  });
});

describe("robustness", () => {
  it.each([Number.NaN, -5_000, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "treats %s as zero income without throwing",
    (grossMonthly) => {
      const r = calculate(rules, { amount: grossMonthly, ageBand: "UNDER_65" });
      expect(r.grossMonthly).toBe(0);
      expect(r.takeHomeMonthly).toBe(0);
    },
  );

  it("never returns NaN or negative money values", () => {
    for (let g = 0; g <= 2_000_000; g += 7_919.37) {
      const r = calculate(rules, { amount: g, ageBand: "UNDER_65" });
      for (const v of [r.monthlyPaye, r.annualPaye, r.uifMonthly, r.takeHomeMonthly, r.effectiveRate]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("more gross never means less take-home", () => {
    let prev = -1;
    for (let g = 0; g <= 400_000; g += 1_234.56) {
      const takeHome = calculate(rules, { amount: g, ageBand: "UNDER_65" }).takeHomeMonthly;
      expect(takeHome).toBeGreaterThanOrEqual(prev);
      prev = takeHome;
    }
  });
});
