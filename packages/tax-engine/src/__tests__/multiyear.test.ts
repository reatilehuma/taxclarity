import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { buildExplanations, buildRecommendations } from "../guidance.ts";
import { dec } from "../money.ts";
import { cacheKey, calculateForYear, createCalculator, createYearCalculator } from "../memo.ts";
import { CurrentTaxRules, DEFAULT_TAX_YEAR } from "../index.ts";
import { TaxRules2025_26 as y2025 } from "../rulesets/2025-26.ts";
import { TaxRules2026_27 as y2026 } from "../rulesets/2026-27.ts";
import { TaxYearError } from "../rulesets/errors.ts";
import { DEV_YEAR_OPTIONS, DRAFT_RULE_SETS, getRuleSet, RULE_SETS } from "../rulesets/drafts.ts";
import { getVerifiedRuleSet, KNOWN_TAX_YEARS, selectableRuleSets, VERIFIED_RULE_SETS } from "../rulesets/registry.ts";
import type { AgeBand, CalculationInputs, CalculationResult, TaxRuleSet } from "../types.ts";

/** Phase 17: the engine cannot mix years or fall back to another, and both years pass the same suites. */

const salary = (amount: number, rest: Partial<CalculationInputs> = {}): CalculationInputs => ({
  mode: "GROSS",
  amount,
  ageBand: "UNDER_65",
  ...rest,
});
const thrown = (fn: () => unknown): TaxYearError => {
  try {
    fn();
  } catch (e) {
    if (e instanceof TaxYearError) return e;
    throw e;
  }
  throw new Error("expected a TaxYearError, nothing was thrown");
};

describe("looking up a year", () => {
  it("the default year is 2026/27 and CurrentTaxRules is just that, found through the registry", () => {
    expect(DEFAULT_TAX_YEAR).toBe("2026-27");
    expect(CurrentTaxRules).toBe(getVerifiedRuleSet(DEFAULT_TAX_YEAR));
    expect(CurrentTaxRules).toBe(getRuleSet(DEFAULT_TAX_YEAR));
  });

  it("the signed-off list holds no draft, the draft list holds only drafts, and together they are every year", () => {
    expect(VERIFIED_RULE_SETS.every((r) => r.status === "verified")).toBe(true);
    expect(DRAFT_RULE_SETS.every((r) => r.status === "draft")).toBe(true);
    expect(RULE_SETS.map((r) => r.taxYear)).toEqual([...KNOWN_TAX_YEARS]);
    expect(new Set(RULE_SETS)).toEqual(new Set([...DRAFT_RULE_SETS, ...VERIFIED_RULE_SETS]));
    const starts = RULE_SETS.map((r) => r.startDate);
    expect(starts).toEqual([...starts].sort()); // oldest first
    expect(VERIFIED_RULE_SETS.map((r) => r.taxYear)).not.toContain("2025-26");
    expect(DEFAULT_TAX_YEAR).toBe(VERIFIED_RULE_SETS.find((r) => r.taxYear === DEFAULT_TAX_YEAR)?.taxYear); // the default is signed off
  });

  it("refuses a draft year unless the caller passes the drafts in, with a typed error", () => {
    const e = thrown(() => getVerifiedRuleSet("2025-26"));
    expect(e).toMatchObject({ code: "UNVERIFIED_YEAR", year: "2025-26", name: "TaxYearError" });
    expect(e.message).toMatch(/2025\/26/);
    expect(getVerifiedRuleSet("2025-26", DEV_YEAR_OPTIONS)).toBe(y2025);
    expect(getVerifiedRuleSet("2026-27")).toBe(y2026);
  });

  it("refuses an unknown year instead of falling back to the default", () => {
    for (const bad of ["2024-25", "2027-28", "", "garbage", "2026/27"]) {
      expect(thrown(() => getVerifiedRuleSet(bad, DEV_YEAR_OPTIONS)), bad).toMatchObject({ code: "UNKNOWN_YEAR", year: bad });
    }
  });

  it("offers only signed-off years unless drafts are allowed", () => {
    expect(selectableRuleSets().map((r) => r.taxYear)).toEqual(["2026-27"]);
    expect(selectableRuleSets(DEV_YEAR_OPTIONS).map((r) => r.taxYear)).toEqual(["2025-26", "2026-27"]);
  });
});

describe("calculating for a named year", () => {
  it("leaving the year out means the default year, and says so on the result", () => {
    const r = calculateForYear(salary(30_000));
    expect(r.taxYear).toBe("2026-27");
    expect(r).toEqual(calculate(y2026, salary(30_000)));
  });

  it("uses the named year's rules and nothing else", () => {
    const r = calculateForYear(salary(30_000, { taxYear: "2025-26" }), DEV_YEAR_OPTIONS);
    expect(r).toEqual(calculate(y2025, salary(30_000, { taxYear: "2025-26" })));
    expect(r.annualLiability).toBe(57_397);
    expect(r.rebates.primary).toBe(17_235);
  });

  it("does not calculate a draft year when drafts are off, and does not quietly use the default instead", () => {
    const e = thrown(() => calculateForYear(salary(30_000, { taxYear: "2025-26" })));
    expect(e.code).toBe("UNVERIFIED_YEAR");
  });

  it("refuses inputs for one year given the other year's rules", () => {
    expect(thrown(() => calculate(y2026, salary(30_000, { taxYear: "2025-26" })))).toMatchObject({ code: "YEAR_MISMATCH", year: "2025-26" });
    expect(thrown(() => calculate(y2025, salary(30_000, { taxYear: "2026-27" })))).toMatchObject({ code: "YEAR_MISMATCH" });
    // The year matching, or being left out, is fine.
    expect(() => calculate(y2025, salary(30_000, { taxYear: "2025-26" }))).not.toThrow();
    expect(() => calculate(y2025, salary(30_000))).not.toThrow();
  });

  it("explanations and recommendations refuse another year's result or inputs", () => {
    const inputs = salary(30_000);
    const r2025 = calculate(y2025, inputs);
    expect(thrown(() => buildExplanations(y2026, inputs, r2025)).code).toBe("YEAR_MISMATCH");
    expect(thrown(() => buildRecommendations(y2026, inputs, r2025)).code).toBe("YEAR_MISMATCH");
    expect(thrown(() => buildRecommendations(y2025, { ...inputs, taxYear: "2026-27" }, r2025)).code).toBe("YEAR_MISMATCH");
    expect(() => buildRecommendations(y2025, inputs, r2025)).not.toThrow();
  });
});

describe("what a result records about its rules", () => {
  it.each(RULE_SETS.map((r) => [r.label, r] as const))("%s: year, version, period, check date and every source", (_l, rules) => {
    const p = calculate(rules, salary(30_000)).provenance;
    expect(p).toMatchObject({
      taxYear: rules.taxYear,
      ruleSetVersion: rules.taxYear,
      rulesVersion: rules.rulesVersion,
      status: rules.status,
      period: { start: rules.startDate, end: rules.endDate },
      lastVerifiedAt: rules.lastVerified,
    });
    expect(p.sourceIds).toEqual([...new Set(Object.values(rules.sources).flat())].sort());
    expect(p.sourceIds.length).toBeGreaterThan(0);
  });

  it("the two years do not share a version or a source list", () => {
    const a = calculate(y2025, salary(30_000)).provenance;
    const b = calculate(y2026, salary(30_000)).provenance;
    expect(a.rulesVersion).not.toBe(b.rulesVersion);
    expect(a.sourceIds).not.toEqual(b.sourceIds);
  });
});

describe("the cache never hands back another year's answer", () => {
  it("the key changes with the year, the rules version and the inputs", () => {
    const i = salary(30_000);
    const a = cacheKey(y2025, i);
    expect(cacheKey(y2026, i)).not.toBe(a);
    expect(cacheKey({ ...y2025, rulesVersion: "2025-26-draft-2" } as TaxRuleSet, i)).not.toBe(a);
    expect(cacheKey(y2025, salary(30_001))).not.toBe(a);
    expect(cacheKey(y2025, { ageBand: "UNDER_65", amount: 30_000, mode: "GROSS" })).toBe(a); // key order does not matter
  });

  it("one calculator, both years: switching away and back gives the original to the cent, from the cache", () => {
    const calc = createYearCalculator(DEV_YEAR_OPTIONS);
    const i = salary(30_000);
    const a1 = calc({ ...i, taxYear: "2025-26" });
    const b = calc({ ...i, taxYear: "2026-27" });
    const a2 = calc({ ...i, taxYear: "2025-26" });
    expect(b.annualLiability).not.toBe(a1.annualLiability);
    expect(a2).toBe(a1); // same cached object, so it cannot have drifted
    expect(a2.annualLiability).toBe(57_397);
    expect(b.annualLiability).toBe(56_172);
    // A year left out is the default year and shares its entry with naming it.
    expect(calc(i)).toBe(calc({ ...i, taxYear: "2026-27" }));
  });

  it("a year calculator without drafts refuses the draft year every time, even after it was cached elsewhere", () => {
    const dev = createYearCalculator(DEV_YEAR_OPTIONS);
    const prod = createYearCalculator();
    dev({ ...salary(30_000), taxYear: "2025-26" });
    expect(thrown(() => prod({ ...salary(30_000), taxYear: "2025-26" })).code).toBe("UNVERIFIED_YEAR");
  });

  it("a calculator tied to one rule set refuses the other year's inputs", () => {
    const only2025 = createCalculator(y2025);
    expect(thrown(() => only2025(salary(30_000, { taxYear: "2026-27" }))).code).toBe("YEAR_MISMATCH");
  });

  it("evicts the oldest entry when full, and still answers correctly", () => {
    const calc = createYearCalculator({ cacheSize: 2 });
    const first = calc(salary(10_000));
    calc(salary(11_000));
    calc(salary(12_000));
    expect(calc(salary(10_000))).toEqual(first);
  });
});

describe("the same inputs give different results in different years", () => {
  it.each([10_000, 20_000, 30_000, 60_000, 150_000])("R%i a month", (amount) => {
    const a = calculate(y2025, salary(amount));
    const b = calculate(y2026, salary(amount));
    expect(a.taxYear).toBe("2025-26");
    expect(b.taxYear).toBe("2026-27");
    // Higher rebates and wider brackets: 2026/27 never costs more for the same pay.
    expect(b.annualLiability).toBeLessThanOrEqual(a.annualLiability);
    expect(b.takeHomeMonthly).toBeGreaterThanOrEqual(a.takeHomeMonthly);
  });

  it("zero pay is the same in both years", () => {
    expect(calculate(y2025, salary(0)).annualLiability).toBe(calculate(y2026, salary(0)).annualLiability);
  });
});

// ---------------------------------------------------------------------------
// Boundaries, written from each year's published formula and read from that year's own rule set
// ---------------------------------------------------------------------------

/** Tax by the SARS formula: base + rate × (income − where the bracket starts), found from the bracket table. */
function formulaTax(rules: TaxRuleSet, income: number): number {
  const b = rules.brackets.find((x) => x.to === null || income <= x.to)!;
  return dec(b.base).plus(dec(b.rate).times(income - b.from)).toNumber();
}

describe.each(RULE_SETS.map((r) => [r.label, r] as const))("boundaries in %s", (_label, rules) => {
  const wholeMonths = (annual: number) => annual / 12;

  it("tax before rebates follows the formula at, just below and just above every bracket edge", () => {
    for (const b of rules.brackets) {
      for (const income of [b.from + 12, b.from + 600, b.to ?? b.from + 120_000, (b.to ?? b.from + 120_000) + 12]) {
        const r = calculate(rules, salary(wholeMonths(income)));
        expect(r.taxableIncome, `${income}`).toBe(income);
        expect(r.annualTaxBeforeRebates, `${income}`).toBe(formulaTax(rules, income));
      }
    }
  });

  it("tax does not jump at a bracket edge: the next bracket's base is the tax at the edge", () => {
    for (const b of rules.brackets) {
      if (b.to === null) continue;
      const next = rules.brackets[rules.brackets.indexOf(b) + 1]!;
      expect(formulaTax(rules, b.to)).toBe(next.base);
    }
  });

  it("the three age thresholds: owes nothing a rand under, owes tax a rand over", () => {
    const bands: [AgeBand, number][] = [
      ["UNDER_65", rules.thresholds.under65],
      ["AGE_65_74", rules.thresholds.age65to74],
      ["AGE_75_PLUS", rules.thresholds.age75plus],
    ];
    for (const [ageBand, threshold] of bands) {
      const pay = (income: number) => calculate(rules, salary(wholeMonths(income), { ageBand }));
      expect(pay(threshold - 12).annualLiability, ageBand).toBe(0);
      expect(pay(threshold - 12).monthlyPaye, ageBand).toBe(0);
      expect(pay(threshold + 12).annualLiability, ageBand).toBeGreaterThan(0);
    }
  });

  it("rebates add up by age band", () => {
    const rb = (ageBand: AgeBand) => calculate(rules, salary(50_000, { ageBand })).rebates;
    expect(rb("UNDER_65").total).toBe(rules.rebates.primary);
    expect(rb("AGE_65_74").total).toBe(rules.rebates.primary + rules.rebates.secondary65);
    expect(rb("AGE_75_PLUS").total).toBe(rules.rebates.primary + rules.rebates.secondary65 + rules.rebates.tertiary75);
  });

  it("UIF stops at the ceiling", () => {
    const ceiling = rules.uif.monthlyCeiling;
    expect(calculate(rules, salary(ceiling - 1)).uifMonthly).toBe(Number(dec(ceiling - 1).times(rules.uif.employeeRate)));
    expect(calculate(rules, salary(ceiling)).uifMonthly).toBe(rules.uif.maxMonthlyEmployee);
    expect(calculate(rules, salary(ceiling + 1)).uifMonthly).toBe(rules.uif.maxMonthlyEmployee);
    expect(calculate(rules, salary(ceiling * 4)).uifMonthly).toBe(rules.uif.maxMonthlyEmployee);
  });

  it("the retirement deduction stops at the year's cap and carries the rest forward", () => {
    const { annualCap } = rules.retirement11F;
    const salaryForOverCap = annualCap / 0.275 / 12 + 20_000; // 27.5% of this is well above the cap
    const own = (annualCap + 12_000) / 12;
    const r = calculate(rules, salary(salaryForOverCap, { retirement: { ownMonthly: own, employerMonthly: 0 } }));
    expect(r.retirement.limitAnnual).toBe(annualCap);
    expect(r.retirement.deductionAnnual).toBe(annualCap);
    expect(r.retirement.carryForwardAnnual).toBe(12_000);
  });

  it("medical credits per member count follow the year's amounts", () => {
    const { monthlyMain, monthlyFirstDep, monthlyAdditionalDep } = rules.medical6A;
    const credit = (members: number) =>
      calculate(rules, salary(80_000, { medical: { member: true, members, monthlyContribution: 0, paidBy: "SELF" } })).medical6A.annualCredit;
    expect(credit(1)).toBe(monthlyMain * 12);
    expect(credit(2)).toBe((monthlyMain + monthlyFirstDep) * 12);
    expect(credit(5)).toBe((monthlyMain + monthlyFirstDep + 3 * monthlyAdditionalDep) * 12);
  });

  it("PAYE is annual tax ÷ 12 rounded to the cent, never negative", () => {
    for (const amount of [1_234.56, 9_999.99, 23_456.78, 45_678.9, 123_456.78]) {
      const r = calculate(rules, salary(amount));
      expect(r.monthlyPaye).toBeGreaterThanOrEqual(0);
      expect(Math.abs(r.monthlyPaye - r.annualLiability / 12)).toBeLessThanOrEqual(0.005 + 1e-9);
    }
  });
});

describe("recommendations follow the year", () => {
  const nearCap: CalculationInputs = salary(150_000, { retirement: { ownMonthly: 29_000, employerMonthly: 0 } });
  const rec = (rules: TaxRuleSet, id: string) => {
    const i = { ...nearCap, taxYear: rules.taxYear };
    return buildRecommendations(rules, i, calculate(rules, i)).find((x) => x.id === id);
  };

  it("R1, R4 and R7 quote the selected year's room, credit and tax-free limit", () => {
    // R348 000 saved on R1 800 000. Room under the cap: R2 000 in 2025/26 (cap R350 000), R82 000 in 2026/27 (cap R430 000).
    // 2025/26: R2 000 ÷ 12 = R166 a month at the 41% marginal rate = R816,72. 2026/27: the R1 000 example = R4 920.
    expect(rec(y2025, "R1")).toMatchObject({ roomAnnual: 2_000, extraMonthly: 166, annualSaving: 816.72 });
    expect(rec(y2026, "R1")).toMatchObject({ roomAnnual: 82_000, extraMonthly: 1_000, annualSaving: 4_920 });
    expect(rec(y2025, "R4")).toMatchObject({ monthlyCredit: 364 });
    expect(rec(y2026, "R4")).toMatchObject({ monthlyCredit: 376 });
    expect(rec(y2025, "R7")).toMatchObject({ tfsaAnnual: 36_000 });
    expect(rec(y2026, "R7")).toMatchObject({ tfsaAnnual: 46_000 });
  });

  it("a saving is the extra amount × that year's marginal rate", () => {
    for (const rules of RULE_SETS) {
      const i: CalculationInputs = { ...salary(30_000), taxYear: rules.taxYear };
      const r = calculate(rules, i);
      const r2 = buildRecommendations(rules, i, r).find((x) => x.id === "R2");
      expect(r2, rules.label).toBeDefined();
      if (r2 && r2.id === "R2") expect(r2.annualSaving).toBe(r2.extraMonthly * 12 * r.marginalRate);
    }
  });
});

// ---------------------------------------------------------------------------
// Properties and fuzzing, run for both years
// ---------------------------------------------------------------------------

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const profile = fc
  .record({
    mode: fc.constantFrom("GROSS", "TAKE_HOME", "PAYSLIP"),
    amount: money(250_000),
    payFrequency: fc.constantFrom("MONTHLY", "WEEKLY", "FORTNIGHTLY"),
    ageBand: fc.constantFrom("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
    retirement: fc.record({ ownMonthly: money(15_000), employerMonthly: money(15_000), privateRaMonthly: money(15_000) }),
    medical: fc.record({
      member: fc.boolean(),
      members: fc.integer({ min: 1, max: 15 }),
      monthlyContribution: money(15_000),
      paidBy: fc.constantFrom("SELF", "EMPLOYER", "SHARED"),
      employerMonthly: money(15_000),
      monthsCovered: fc.integer({ min: 0, max: 12 }),
      ownSharePaidVia: fc.constantFrom("PAYROLL", "DEBIT_ORDER"),
      outOfPocketAnnual: fc.option(money(150_000), { nil: undefined }),
      disabilityInFamily: fc.boolean(),
    }),
    variablePay: fc.record({ bonusAnnual: money(200_000), overtimeAnnual: money(50_000), commissionAnnual: money(200_000) }),
    advanced: fc.record({
      donations18AAnnual: money(200_000),
      has18AReceipt: fc.boolean(),
      localInterestAnnual: money(100_000),
      travelAllowanceMonthly: money(15_000),
      travelBusinessUse: fc.double({ min: 0, max: 1, noNaN: true }),
      travelBusinessKmAnnual: money(60_000),
      hasSecondEmployer: fc.boolean(),
      secondEmployerAnnualGross: money(500_000),
    }),
    payslip: fc.record({ payeMonthly: fc.option(money(100_000), { nil: undefined }), uifMonthly: fc.option(money(300), { nil: undefined }) }),
  })
  .map((i) => i as unknown as CalculationInputs);

const solverProfile = profile.map((i) => {
  const { advanced: _a, payslip: _p, ...rest } = i;
  return rest as CalculationInputs;
});

function everyNumber(value: unknown, visit: (n: number, path: string) => void, path = "result"): void {
  if (typeof value === "number") visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => everyNumber(v, visit, `${path}[${i}]`));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) everyNumber(v, visit, `${path}.${k}`);
}

describe.each(RULE_SETS.map((r) => [r.label, r] as const))("properties in %s", (_label, rules) => {
  const calc = (i: CalculationInputs): CalculationResult => calculate(rules, i);

  it("fuzz: every number in every result is finite, and the result is for this year", () => {
    fc.assert(
      fc.property(profile, (i) => {
        const r = calc(i);
        expect(r.taxYear).toBe(rules.taxYear);
        everyNumber(r, (v, path) => {
          if (!Number.isFinite(v)) throw new Error(`${path} is ${v}`);
        });
      }),
      { numRuns: 300 },
    );
  });

  it("fuzz: junk in every field never throws", () => {
    const junk = fc.oneof(fc.constant(Number.NaN), fc.constant(Infinity), fc.constant(-Infinity), fc.constant(-1), fc.constant(1e308), fc.constant(undefined), fc.constant(null), fc.string(), fc.constantFrom("toString", "constructor", "__proto__", "hasOwnProperty"));
    const junkInputs = fc.record({ amount: junk, ageBand: junk, mode: junk, payFrequency: junk, retirement: fc.record({ ownMonthly: junk, employerMonthly: junk }), variablePay: fc.record({ bonusAnnual: junk }) });
    fc.assert(
      fc.property(junkInputs, (i) => {
        const r = calc(i as unknown as CalculationInputs);
        everyNumber(r, (v, path) => {
          if (!Number.isFinite(v)) throw new Error(`${path} is ${v}`);
        });
      }),
      { numRuns: 300 },
    );
  });

  it("final tax is never negative and never more than tax after rebates", () => {
    fc.assert(
      fc.property(profile, (i) => {
        const r = calc(i);
        expect(r.annualLiability).toBeGreaterThanOrEqual(0);
        expect(r.annualLiability).toBeLessThanOrEqual(r.taxAfterRebates);
        expect(r.taxableIncome).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it("more gross pay never means less take-home", () => {
    fc.assert(
      fc.property(money(200_000), money(5_000), fc.constantFrom<AgeBand>("UNDER_65", "AGE_65_74", "AGE_75_PLUS"), (amount, extra, ageBand) => {
        const lo = calc(salary(amount, { ageBand }));
        const hi = calc(salary(amount + extra, { ageBand }));
        expect(hi.takeHomeMonthly).toBeGreaterThanOrEqual(lo.takeHomeMonthly - 0.02);
      }),
      { numRuns: 300 },
    );
  });

  it("round trip: gross → take-home → gross lands within 10 cents", () => {
    fc.assert(
      fc.property(money(200_000), fc.constantFrom<AgeBand>("UNDER_65", "AGE_65_74", "AGE_75_PLUS"), (amount, ageBand) => {
        const forward = calc(salary(amount, { ageBand }));
        fc.pre(forward.takeHomeMonthly > 0);
        const back = calc({ mode: "TAKE_HOME", amount: forward.takeHomePerPeriod, ageBand });
        expect(Math.abs(back.grossPerPeriod - forward.grossPerPeriod)).toBeLessThanOrEqual(0.1);
      }),
      { numRuns: 300 },
    );
  });

  it("the solver always lands within 2 cents of the target", () => {
    // Like the Phase 3 suite: no travel allowance, other job or payslip. A deposit smaller than an allowance paid
    // on top of it cannot be reached by any salary, so there is nothing to solve.
    fc.assert(
      fc.property(solverProfile, (i) => {
        const r = calc({ ...i, mode: "TAKE_HOME" });
        expect(Math.abs(r.estimate!.residual)).toBeLessThanOrEqual(0.02);
      }),
      { numRuns: 200 },
    );
  });

  it("guidance: finite figures, and no saving larger than the tax there is", () => {
    fc.assert(
      fc.property(profile, (i) => {
        const r = calc(i);
        const out = [...buildExplanations(rules, i, r), ...buildRecommendations(rules, i, r)];
        everyNumber(out, (v, path) => {
          if (!Number.isFinite(v)) throw new Error(`${path} is ${v}`);
        });
        for (const rec of buildRecommendations(rules, i, r)) {
          if ("annualSaving" in rec) expect(rec.annualSaving).toBeLessThanOrEqual(r.annualLiability + 0.01);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("a pay frequency that is not one of ours falls back to monthly (found by the fuzz suite in Phase 17)", () => {
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty", "DAILY", ""])("%j", (bad) => {
    for (const rules of RULE_SETS) {
      const got = calculate(rules, { ...salary(30_000), payFrequency: bad as never });
      expect(got).toEqual(calculate(rules, salary(30_000)));
    }
  });
});
