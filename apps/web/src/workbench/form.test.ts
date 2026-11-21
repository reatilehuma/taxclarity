import { calculate, CurrentTaxRules as rules, getRuleSet } from "@taxclarity/tax-engine";
import { describe, expect, it } from "vitest";
import { EMPTY, parseAmount, SCENARIOS, TEST_VECTORS, toInputs, Y_VECTORS } from "./form.ts";

/** Every Workbench preset must produce what its "Expect" line promises. */
const run = (id: string) => {
  const s = [...TEST_VECTORS, ...SCENARIOS].find((x) => x.id === id);
  if (!s) throw new Error(`No preset ${id}`);
  return calculate(rules, toInputs({ ...EMPTY, ...s.form }));
};

describe("Workbench presets match their expectations", () => {
  it.each([
    ["T1", (r: ReturnType<typeof run>) => [r.monthlyPaye, r.takeHomeMonthly], [3_149, 23_673.88]],
    ["T2", (r: ReturnType<typeof run>) => [r.taxableIncome, r.annualTaxBeforeRebates], [245_100, 44_118]],
    ["T4", (r: ReturnType<typeof run>) => [r.annualTaxBeforeRebates, r.monthlyPaye], [17_820, 0]],
    ["T6", (r: ReturnType<typeof run>) => [r.annualTaxBeforeRebates, r.rebates.total, r.monthlyPaye], [30_834, 30_834, 0]],
    ["T7", (r: ReturnType<typeof run>) => [r.uifMonthly], [177.12]],
    ["T8", (r: ReturnType<typeof run>) => [r.uifMonthly, r.monthlyPaye], [50, 0]],
    ["T9", (r: ReturnType<typeof run>) => [r.grossMonthly, r.takeHomeMonthly], [0, 0]],
    ["T10", (r: ReturnType<typeof run>) => [r.retirement.deductionAnnual, r.retirement.carryForwardAnnual], [198_000, 2_000]],
    ["T11", (r: ReturnType<typeof run>) => [r.retirement.limitAnnual, r.retirement.carryForwardAnnual], [430_000, 170_000]],
    ["T14", (r: ReturnType<typeof run>) => [r.medical6A.annualCredit, r.medical6B.annualCredit], [4_512, 12_142.51]],
    ["T15", (r: ReturnType<typeof run>) => [r.donations.deductionAnnual, r.donations.carryForwardAnnual], [30_000, 20_000]],
    ["T16", (r: ReturnType<typeof run>) => [r.grossMonthly], [23_051.51]],
    ["T17", (r: ReturnType<typeof run>) => [r.comparison?.calcPaye, r.comparison?.diff, r.comparison?.diffPct], [9_275.58, -2_475.58, -26.7]],
    ["T18", (r: ReturnType<typeof run>) => [r.interest.taxableAnnual], [6_200]],
    ["T19", (r: ReturnType<typeof run>) => [r.travel.taxableMonthly], [4_000]],
    ["T20", (r: ReturnType<typeof run>) => [r.travel.taxableMonthly], [1_000]],
    ["bonus", (r: ReturnType<typeof run>) => [r.takeHomeMonthly, r.takeHomeMonthlyAverage], [25_141.88, 26_963.13]],
    ["medical-debit", (r: ReturnType<typeof run>) => [r.monthlyPaye, r.filing.refundAnnual], [3_901, 9_024]],
    ["ra-debit", (r: ReturnType<typeof run>) => [r.monthlyPaye, r.filing.refundAnnual], [4_681, 6_240]],
    ["two-jobs", (r: ReturnType<typeof run>) => [r.annualLiability, r.filing.owedAnnual], [86_017, 29_665]],
    ["weekly", (r: ReturnType<typeof run>) => [r.takeHomePerPeriod], [4_378.9]],
  ] as const)("%s", (id, pick, expected) => {
    const values = pick(run(id));
    values.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 2));
  });

  it("every test vector has an expectation and a unique id", () => {
    const ids = TEST_VECTORS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TEST_VECTORS.every((t) => t.expect.length > 0)).toBe(true);
  });
});

describe("parseAmount", () => {
  it.each([
    ["30000", 30_000],
    ["R30 000", 30_000],
    ["30,000.00", 30_000],
    ["30 000,50", 30_000.5],
    ["", Number.NaN],
    ["abc", Number.NaN],
  ])("%s → %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });
});

describe("toInputs", () => {
  it("leaves blank optional fields out, so Section 6B isn't worked out", () => {
    const inputs = toInputs({ ...EMPTY, hasMedical: true, outOfPocket: "" });
    expect(inputs.medical).not.toHaveProperty("outOfPocketAnnual");
    expect(inputs.payslip).toEqual({});
  });

  it("ignores the extras panel while it's switched off", () => {
    expect(toInputs({ ...EMPTY, hasExtras: false, donations: "5000" }).advanced).toEqual({});
  });
});

/** The 2025/26 presets: figures worked out independently (docs/rulesets/2025-26-vectors.md), run in their own year. */
describe("Workbench 2025/26 presets match their expectations", () => {
  const y2025 = getRuleSet("2025-26");
  const runY = (id: string) => {
    const s = Y_VECTORS.find((x) => x.id === id);
    if (!s) throw new Error(`No preset ${id}`);
    return calculate(y2025, { ...toInputs({ ...EMPTY, ...s.form }), ...(s.year ? { taxYear: s.year } : {}) });
  };
  type R = ReturnType<typeof runY>;

  it.each([
    ["Y1", (r: R) => [r.monthlyPaye, r.takeHomeMonthly], [3_275.08, 23_547.8]],
    ["Y2", (r: R) => [r.annualTaxBeforeRebates, r.monthlyPaye], [42_660, 2_118.75]],
    ["Y3", (r: R) => [r.annualTaxBeforeRebates, r.monthlyPaye], [42_808, 2_131.08]],
    ["Y4", (r: R) => [r.annualLiability, r.takeHomeMonthly], [0, 7_821]],
    ["Y5", (r: R) => [r.monthlyPaye, r.takeHomeMonthly], [3.75, 7_916.25]],
    ["Y6", (r: R) => [r.annualLiability, r.takeHomeMonthly], [0, 12_177]],
    ["Y7", (r: R) => [r.monthlyPaye, r.takeHomeMonthly], [8.75, 12_267.25]],
    ["Y8", (r: R) => [r.annualLiability, r.takeHomeMonthly], [0, 13_563]],
    ["Y9", (r: R) => [r.monthlyPaye, r.takeHomeMonthly], [16.67, 13_744.33]],
    ["Y10", (r: R) => [r.uifMonthly, r.monthlyPaye, r.takeHomeMonthly], [177.12, 1_752.09, 15_783.79]],
    ["Y11", (r: R) => [r.grossMonthly, r.takeHomeMonthly], [0, 0]],
    ["Y12", (r: R) => [r.retirement.limitAnnual, r.retirement.carryForwardAnnual], [350_000, 250_000]],
    ["Y13", (r: R) => [r.retirement.deductionAnnual, r.retirement.carryForwardAnnual], [350_000, 10_000]],
    ["Y14", (r: R) => [r.monthlyPaye, r.takeHomeMonthly], [4_419.08, 25_403.8]],
    ["Y15", (r: R) => [r.monthlyPaye, r.takeHomeMonthly], [3_317.08, 26_505.8]],
    ["Y17", (r: R) => [r.monthlyPaye, r.takeHomeMonthly, r.annualPaye, r.takeHomeMonthlyAverage], [4_783.08, 25_039.8, 75_472, 28_533.55]],
    ["Y19", (r: R) => [r.medical6A.annualCredit, r.medical6B.annualCredit, r.annualLiability], [8_736, 8_588.74, 30_628.26]],
  ] as const)("%s", (id, pick, expected) => {
    expect(pick(runY(id))).toEqual([...expected]);
  });

  it("Y18: a R20 000 deposit is a gross within R1 of R23 189,47", () => {
    expect(Math.abs(runY("Y18").grossMonthly - 23_189.47)).toBeLessThanOrEqual(1);
  });

  it("every Y preset is for 2025/26, every id is unique and none clashes with a T preset", () => {
    expect(Y_VECTORS.every((v) => v.year === "2025-26")).toBe(true);
    const ids = [...TEST_VECTORS, ...SCENARIOS, ...Y_VECTORS].map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
