import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { TaxRules2025_26 as y2025 } from "../rulesets/2025-26.ts";
import { TaxRules2026_27 as y2026 } from "../rulesets/2026-27.ts";
import { getRuleSet, RULE_SETS } from "../rulesets/drafts.ts";
import { buildRecommendations } from "../guidance.ts";
import { assertValidRuleSet } from "../validate.ts";
import type { TaxRuleSet, TaxYear } from "../types.ts";

/**
 * Phase 16: the 2025/26 rule set (draft) and the registry. The expected numbers below are typed from the SARS
 * published formulas ("42 678 + 26% of taxable income above 237 100"), not from the engine's output.
 */

describe("rule-set registry", () => {
  it("lists both years, oldest first, each once", () => {
    expect(RULE_SETS.map((r) => r.taxYear)).toEqual(["2025-26", "2026-27"]);
  });

  it("finds a year by name and throws for an unknown one instead of falling back", () => {
    expect(getRuleSet("2025-26")).toBe(y2025);
    expect(getRuleSet("2026-27")).toBe(y2026);
    expect(() => getRuleSet("2024-25" as TaxYear)).toThrow(/2024-25/);
  });

  it("marks 2026/27 verified and 2025/26 as draft until it is signed off", () => {
    expect(y2026.status).toBe("verified");
    expect(y2025.status).toBe("draft");
  });

  it("gives every year its own version and a period of exactly one year of assessment", () => {
    expect(new Set(RULE_SETS.map((r) => r.rulesVersion)).size).toBe(RULE_SETS.length);
    for (const r of RULE_SETS) {
      expect(r.startDate).toMatch(/^\d{4}-03-01$/);
      expect(r.endDate).toMatch(/^\d{4}-02-(28|29)$/);
      expect(Number(r.endDate.slice(0, 4))).toBe(Number(r.startDate.slice(0, 4)) + 1);
    }
  });
});

describe.each(RULE_SETS.map((r) => [r.label, r] as const))("rule set %s", (_label, rules) => {
  it("passes validation", () => {
    expect(() => assertValidRuleSet(rules)).not.toThrow();
  });

  it("cites a source for every parameter group", () => {
    for (const [group, ids] of Object.entries(rules.sources)) expect(ids.length, group).toBeGreaterThan(0);
    for (const group of ["brackets", "rebates", "thresholds", "uif", "retirement11F", "medical6A", "medical6B", "donations18A", "interestExemption", "tfsa", "travel"]) {
      expect(rules.sources[group], group).toBeDefined();
    }
  });
});

describe("2025/26 rule set against the SARS published figures", () => {
  it("has the published brackets (SARS Budget 2025 tax guide)", () => {
    expect(y2025.brackets.map((b) => [b.from, b.to, b.base, b.rate])).toEqual([
      [0, 237_100, 0, 0.18],
      [237_100, 370_500, 42_678, 0.26],
      [370_500, 512_800, 77_362, 0.31],
      [512_800, 673_000, 121_475, 0.36],
      [673_000, 857_900, 179_147, 0.39],
      [857_900, 1_817_000, 251_258, 0.41],
      [1_817_000, null, 644_489, 0.45],
    ]);
  });

  it("has the published rebates, thresholds, credits and limits", () => {
    expect(y2025.rebates).toEqual({ primary: 17_235, secondary65: 9_444, tertiary75: 3_145 });
    expect(y2025.thresholds).toEqual({ under65: 95_750, age65to74: 148_217, age75plus: 165_689 });
    expect(y2025.medical6A).toEqual({ monthlyMain: 364, monthlyFirstDep: 364, monthlyAdditionalDep: 246 });
    expect(y2025.retirement11F).toEqual({ rate: 0.275, annualCap: 350_000 });
    expect(y2025.interestExemption).toEqual({ under65: 23_800, age65plus: 34_500 });
    expect(y2025.tfsa).toEqual({ annualLimit: 36_000, lifetimeLimit: 500_000, excessPenaltyRate: 0.4 });
    expect(y2025.travel.prescribedRatePerKm).toBe(4.76);
    expect(y2025.uif.monthlyCeiling).toBe(17_712);
  });

  it("does not reuse any 2026/27 figure that SARS changed for that year", () => {
    expect(y2025.brackets[0]!.to).not.toBe(y2026.brackets[0]!.to);
    expect(y2025.rebates.primary).not.toBe(y2026.rebates.primary);
    expect(y2025.thresholds.under65).not.toBe(y2026.thresholds.under65);
    expect(y2025.medical6A.monthlyMain).not.toBe(y2026.medical6A.monthlyMain);
    expect(y2025.retirement11F.annualCap).not.toBe(y2026.retirement11F.annualCap);
    expect(y2025.tfsa.annualLimit).not.toBe(y2026.tfsa.annualLimit);
    expect(y2025.travel.prescribedRatePerKm).not.toBe(y2026.travel.prescribedRatePerKm);
  });

  it("calculates with its own numbers: R30 000 a month, no extras", () => {
    // Annual income 360 000 is in the 26% band: 42 678 + 26% × (360 000 − 237 100) = 42 678 + 31 954 = 74 632.
    // Less the primary rebate 17 235 = 57 397 a year; monthly PAYE 57 397 ÷ 12 = 4 783,0833…
    const r = calculate(y2025, { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" });
    expect(r.taxYear).toBe("2025-26");
    expect(r.annualTaxBeforeRebates).toBe(74_632);
    expect(r.rebates.primary).toBe(17_235);
    expect(r.annualLiability).toBe(57_397);
    expect(r.monthlyPaye).toBe(4_783.08);
    expect(r.provenance.ruleSetVersion).toBe("2025-26");
  });

  it("is a different answer from 2026/27 for the same person, and each year keeps its own", () => {
    const input = { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" } as const;
    const a = calculate(y2025, input);
    const b = calculate(y2026, input);
    expect(a.annualLiability).not.toBe(b.annualLiability);
    expect(calculate(y2025, input)).toEqual(a);
    expect(calculate(y2026, input)).toEqual(b);
  });

  it("owes nothing just below each age threshold and something just above", () => {
    // SARS prints the thresholds in whole rands (R26 679 ÷ 18% = R148 216,67 is printed as R148 217), so at the
    // printed figure itself the tax is a few cents: R148 217 × 18% − R26 679 = R0,06. A rand either side is clear.
    const tax = (income: number, age: "UNDER_65" | "AGE_65_74" | "AGE_75_PLUS") =>
      calculate(y2025, { mode: "GROSS", amount: income / 12, ageBand: age }).annualLiability;
    expect(tax(95_750, "UNDER_65")).toBe(0);
    expect(tax(95_751, "UNDER_65")).toBeGreaterThan(0);
    expect(tax(148_216, "AGE_65_74")).toBe(0);
    expect(tax(148_218, "AGE_65_74")).toBeGreaterThan(0);
    expect(tax(165_688, "AGE_75_PLUS")).toBe(0);
    expect(tax(165_690, "AGE_75_PLUS")).toBeGreaterThan(0);
  });
});

describe("validation still catches a wrong threshold", () => {
  it("says what the threshold should be", () => {
    const broken = { ...(y2025 as object), thresholds: { ...y2025.thresholds, age65to74: 148_000 } } as TaxRuleSet;
    expect(() => assertValidRuleSet(broken)).toThrow(/thresholds.age65to74: 148000 should be 148217/);
  });
});

describe("the top-bracket tip threshold lives in the rule set (Phase 19)", () => {
  it("must be the rate of one of the year's brackets", () => {
    const broken = { ...(y2025 as object), guidance: { topBracketRate: 0.4 } } as TaxRuleSet;
    expect(() => assertValidRuleSet(broken)).toThrow(/guidance.topBracketRate: 0.4 must be the rate of one of the brackets/);
  });

  it.each(RULE_SETS.map((r) => [r.label, r] as const))("%s: R9 appears from the rule set's rate and not from a number in the code", (_l, rules) => {
    const input = { mode: "GROSS", amount: 40_000, ageBand: "UNDER_65" } as const; // R480 000 a year: the 31% band in both years
    const r = calculate(rules, input);
    expect(r.marginalRate).toBe(0.31);
    const ids = (rs: TaxRuleSet) => buildRecommendations(rs, input, calculate(rs, input)).map((x) => x.id);
    expect(ids(rules)).not.toContain("R9");
    // The same person, in a year that set its threshold at 31%, is told. Only the rule set changed.
    const lower = { ...(rules as object), guidance: { topBracketRate: 0.31 } } as TaxRuleSet;
    expect(ids(lower)).toContain("R9");
  });
});
