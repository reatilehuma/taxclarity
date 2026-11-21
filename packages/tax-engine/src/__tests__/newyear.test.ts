import fc from "fast-check";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBreakdown } from "../breakdown.ts";
import { calculate } from "../calculate.ts";
import { dec, round2 } from "../money.ts";
import { TaxRules2026_27 as current } from "../rulesets/2026-27.ts";
import { assertValidRuleSet } from "../validate.ts";
import type { CalculationInputs, TaxBracket, TaxRuleSet } from "../types.ts";

/**
 * PRD Phase 7 acceptance: adding a new tax year needs no engine-logic changes if SARS keeps the same
 * structure. This is the spike: a made-up 2027/28 rule set (every parameter moved) is built from the
 * current one, validated and run through the whole engine.
 */

/** Parameters nudged the way a Budget might: brackets and rebates up about 5%, credits up a little. (Thresholds must equal rebates ÷ 18%: the validator insists, and a first draft of this test tripped it.) */
function draft2027_28(): TaxRuleSet {
  const up = (n: number) => Math.round((n * 1.05) / 100) * 100;
  let base = 0;
  const brackets: TaxBracket[] = current.brackets.map((b, i) => {
    const from = i === 0 ? 0 : up(b.from);
    const to = b.to === null ? null : up(b.to);
    const prev = i === 0 ? null : current.brackets[i - 1]!;
    if (prev) base = Number(dec(base).plus(dec(prev.rate).times(up(prev.to!) - (i === 1 ? 0 : up(prev.from)))).toString());
    return { from, to, base: i === 0 ? 0 : base, rate: b.rate };
  });
  return {
    ...(current as object),
    taxYear: "2027-28",
    label: "2027/28",
    startDate: "2027-03-01",
    endDate: "2028-02-29",
    lastVerified: "2027-02-25",
    brackets,
    rebates: { primary: 18_720, secondary65: 10_260, tertiary75: 3_420 },
    thresholds: { under65: 104_000, age65to74: 161_000, age75plus: 180_000 },
    retirement11F: { rate: 0.275, annualCap: 450_000 },
    medical6A: { monthlyMain: 395, monthlyFirstDep: 395, monthlyAdditionalDep: 266 },
    interestExemption: { under65: 25_000, age65plus: 36_200 },
  } as unknown as TaxRuleSet;
}

const t1: CalculationInputs = {
  mode: "GROSS",
  amount: 30_000,
  ageBand: "UNDER_65",
  retirement: { ownMonthly: 3_000, employerMonthly: 0 },
  medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
};

describe("a new tax year is a new rule set and nothing else", () => {
  const draft = draft2027_28();

  it("the draft passes the same validation as the real rule set", () => {
    expect(() => assertValidRuleSet(current)).not.toThrow();
    expect(() => assertValidRuleSet(draft)).not.toThrow();
  });

  it("validation still catches a broken draft (so a typo in a real new year cannot ship)", () => {
    const broken = { ...draft, brackets: draft.brackets.map((b, i) => (i === 2 ? { ...b, base: b.base + 1 } : b)) } as TaxRuleSet;
    expect(() => assertValidRuleSet(broken)).toThrow(/base/);
  });

  it("the engine calculates with it, using its numbers and not the current year's", () => {
    const r = calculate(draft, t1);
    expect(r.taxYear).toBe("2027-28");
    // Independent check: taxable R324 000 sits in the draft's second bracket.
    const b = draft.brackets[1]!;
    const tax = round2(dec(b.base).plus(dec(b.rate).times(324_000 - b.from)));
    expect(r.taxableIncome).toBe(324_000);
    expect(r.annualTaxBeforeRebates).toBe(tax.toNumber());
    expect(r.rebates.primary).toBe(18_720);
    expect(r.medical6A.monthlyCredit).toBe(790);
    const before = calculate(current, t1);
    expect(r.annualLiability).not.toBe(before.annualLiability);
    expect(r.monthlyPaye).toBeLessThan(before.monthlyPaye); // more allowances, wider brackets
  });

  it("the age thresholds, rebates and limits follow the draft too", () => {
    const old = calculate(draft, { mode: "GROSS", amount: 14_000, ageBand: "AGE_65_74" });
    expect(old.taxThreshold).toBe(161_000);
    const big = calculate(draft, { mode: "GROSS", amount: 200_000, ageBand: "UNDER_65", retirement: { ownMonthly: 60_000, employerMonthly: 0 } });
    expect(big.retirement.limitAnnual).toBe(450_000);
  });

  it("tables, bracket walk, advice and totals all reconcile under the draft, for any inputs", () => {
    const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
    const inputs = fc.record({
      mode: fc.constantFrom("GROSS", "TAKE_HOME"),
      amount: money(250_000),
      ageBand: fc.constantFrom("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
      retirement: fc.record({ ownMonthly: money(15_000), employerMonthly: money(5_000) }),
    }) as fc.Arbitrary<CalculationInputs>;
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calculate(draft, i);
        const b = buildBreakdown(r);
        let net = dec(0);
        for (const row of b.payslip) if (row.monthly !== null) net = row.kind === "add" ? net.plus(row.monthly) : row.kind === "less" ? net.minus(row.monthly) : net;
        expect(net.toNumber()).toBe(r.takeHomeMonthly);
        expect(r.bracketWalk).toHaveLength(draft.brackets.length);
        expect(Number.isFinite(r.annualLiability)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("no tax year or SARS number is written into the engine's logic", () => {
  const dir = join(import.meta.dirname, "..");
  const logic = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts");
  // Values that belong in a rule set. If one appears in logic, a new year would silently keep the old figure.
  const forbidden = [/2026/, /2027/, /\b17[_ ]?820\b/, /\b430[_ ]?000\b/, /\b245[_ ]?100\b/, /\b177\.12\b/, /\b0\.275\b/, /\b23[_ ]?800\b/, /\b46[_ ]?000\b/, /\b9[_ ]?765\b/];

  it.each(logic)("%s", (file) => {
    // Strip comments: explanations may quote a figure, code may not.
    const code = readFileSync(join(dir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const pattern of forbidden) expect(code, `${file} contains ${pattern}`).not.toMatch(pattern);
  });
});
