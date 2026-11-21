import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { buildExplanations, buildRecommendations, type Explanation, type Recommendation } from "../guidance.ts";
import { TaxRules2026_27 as rules } from "../rulesets/2026-27.ts";
import type { AgeBand, CalculationInputs, CalculationMode, MedicalPaidBy, MedicalPaidVia, PayFrequency } from "../types.ts";

const explain = (i: CalculationInputs) => buildExplanations(rules, i, calculate(rules, i));
const recommend = (i: CalculationInputs) => buildRecommendations(rules, i, calculate(rules, i));
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const pick = <T extends Explanation["id"]>(xs: Explanation[], id: T) => xs.find((x) => x.id === id) as Extract<Explanation, { id: T }>;
const rec = <T extends Recommendation["id"]>(xs: Recommendation[], id: T) => xs.find((x) => x.id === id) as Extract<Recommendation, { id: T }>;

/** T1: gross R30 000, pension R3 000, two-person medical aid with nothing to pay. */
const t1: CalculationInputs = {
  mode: "GROSS",
  amount: 30_000,
  ageBand: "UNDER_65",
  retirement: { ownMonthly: 3_000, employerMonthly: 0 },
  medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
};

describe("explanations", () => {
  it("T1: retirement, medical credit and UIF, with their rand effects", () => {
    const e = explain(t1);
    expect(ids(e)).toEqual(["RETIREMENT", "MEDICAL_CREDIT", "UIF"]);
    const ret = pick(e, "RETIREMENT");
    expect(ret.contributedMonthly).toBe(3_000);
    // R36 000 a year off income, all inside the 26% bracket: saves 36 000 × 26% = R9 360 a year, R780 a month.
    expect(ret.savingAnnual).toBe(9_360);
    expect(ret.savingMonthly).toBe(780);
    expect(ret.marginalRate).toBe(0.26);
    expect(ret.carryForwardAnnual).toBe(0);
    const med = pick(e, "MEDICAL_CREDIT");
    expect(med).toMatchObject({ members: 2, monthlyCredit: 752, annualCredit: 9_024, appliedAnnual: 9_024, mainMonthly: 376, additionalMonthly: 254 });
    expect(pick(e, "UIF")).toMatchObject({ monthly: 177.12, maxMonthly: 177.12 });
  });

  it("includes nothing that doesn't apply", () => {
    const e = explain({ mode: "GROSS", amount: 20_000, ageBand: "UNDER_65" });
    expect(ids(e)).toEqual(["UIF"]);
    for (const id of ["RETIREMENT", "MEDICAL_CREDIT", "AGE_REBATE", "DONATIONS", "VARIABLE_PAY", "TRAVEL", "INTEREST", "MEDICAL_6B"]) {
      expect(ids(e)).not.toContain(id);
    }
  });

  it("a retirement annuity paid by debit order counts as retirement saving too", () => {
    const e = explain({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", retirement: { ownMonthly: 0, employerMonthly: 0, privateRaMonthly: 2_000 } });
    expect(pick(e, "RETIREMENT").contributedMonthly).toBe(2_000);
    expect(pick(e, "RETIREMENT").savingAnnual).toBe(6_240);
  });

  it("employer-only contributions don't produce a 'you contribute' card", () => {
    const e = explain({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", retirement: { ownMonthly: 0, employerMonthly: 2_000 } });
    expect(ids(e)).not.toContain("RETIREMENT");
  });

  it("retirement above the limit reports the carry-forward", () => {
    const e = explain({ mode: "GROSS", amount: 100_000, ageBand: "UNDER_65", retirement: { ownMonthly: 50_000, employerMonthly: 0 } });
    expect(pick(e, "RETIREMENT").carryForwardAnnual).toBeGreaterThan(0);
  });

  it("age rebates: 65+ shows the extra rebate, 75+ both", () => {
    const base = { mode: "GROSS", amount: 40_000 } as const;
    const a65 = pick(explain({ ...base, ageBand: "AGE_65_74" }), "AGE_REBATE");
    expect(a65).toMatchObject({ secondary: rules.rebates.secondary65, tertiary: 0, savingAnnual: rules.rebates.secondary65 });
    const a75 = pick(explain({ ...base, ageBand: "AGE_75_PLUS" }), "AGE_REBATE");
    expect(a75.savingAnnual).toBe(rules.rebates.secondary65 + rules.rebates.tertiary75);
  });

  it("age rebate effect is capped by the tax there is to rebate", () => {
    // Little tax: the extra rebate can't take more off than the tax after the primary rebate.
    const r = calculate(rules, { mode: "GROSS", amount: 9_000, ageBand: "AGE_65_74" });
    const a = pick(buildExplanations(rules, { mode: "GROSS", amount: 9_000, ageBand: "AGE_65_74" }, r), "AGE_REBATE");
    expect(a.savingAnnual).toBeLessThan(rules.rebates.secondary65);
    expect(a.savingAnnual).toBeGreaterThanOrEqual(0);
  });

  it("donations: the saving is the donation at the marginal rate", () => {
    const d = pick(explain({ ...t1, advanced: { donations18AAnnual: 5_000, has18AReceipt: true } }), "DONATIONS");
    expect(d).toMatchObject({ givenAnnual: 5_000, deductionAnnual: 5_000, savingAnnual: 1_300, hasReceipt: true });
  });

  it("a donation over the 10% limit reports the carry-forward and only the allowed saving", () => {
    const d = pick(explain({ mode: "GROSS", amount: 20_000, ageBand: "UNDER_65", advanced: { donations18AAnnual: 100_000 } }), "DONATIONS");
    expect(d.carryForwardAnnual).toBeGreaterThan(0);
    expect(d.deductionAnnual).toBeLessThan(100_000);
  });

  it("a bonus: the tax on it and the rate it was taxed at", () => {
    const v = pick(explain({ ...t1, variablePay: { bonusAnnual: 30_000 } }), "VARIABLE_PAY");
    expect(v.totalAnnual).toBe(30_000);
    expect(v.taxAnnual).toBeGreaterThan(0);
    expect(v.effectiveRate).toBeGreaterThan(0);
  });

  it("travel, interest and a calculated section 6B each get a card", () => {
    const e = explain({
      mode: "GROSS",
      amount: 40_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 1, monthlyContribution: 3_000, paidBy: "SELF", outOfPocketAnnual: 60_000 },
      advanced: { travelAllowanceMonthly: 3_000, localInterestAnnual: 30_000, travelBusinessKmAnnual: 10_000 },
    });
    expect(ids(e)).toEqual(expect.arrayContaining(["TRAVEL", "INTEREST", "MEDICAL_6B"]));
    expect(pick(e, "INTEREST")).toMatchObject({ interestAnnual: 30_000, exemptionAnnual: 23_800, taxableAnnual: 6_200 });
  });

  it("debit-order medical aid says it is claimed on filing", () => {
    const e = explain({ ...t1, medical: { member: true, members: 1, monthlyContribution: 3_000, paidBy: "SELF", ownSharePaidVia: "DEBIT_ORDER" } });
    expect(pick(e, "MEDICAL_CREDIT").claimedOnFiling).toBe(true);
  });

  it("works from a bank amount too: the gross is held fixed for the what-ifs", () => {
    const e = explain({ mode: "TAKE_HOME", amount: 23_673.88, ageBand: "UNDER_65", retirement: { ownMonthly: 3_000, employerMonthly: 0 } });
    expect(pick(e, "RETIREMENT").savingAnnual).toBeGreaterThan(0);
  });
});

describe("recommendations: triggers", () => {
  it("T1 (pension, medical aid, 26%): R1, R3, R5, R8, R7. Not R2, R4, R6, R9", () => {
    expect(ids(recommend(t1))).toEqual(["R1", "R3", "R5", "R8", "R7"]);
  });

  it("R1: R1 000 more a month inside the 26% bracket saves 12 000 × 26% = R3 120 a year", () => {
    const r1 = rec(recommend(t1), "R1");
    expect(r1.extraMonthly).toBe(1_000);
    expect(r1.annualSaving).toBe(3_120);
    expect(r1.monthlySaving).toBe(260);
    expect(r1.annualSaving).toBe(r1.extraMonthly * 12 * 0.26);
    // Room: 27.5% of R360 000 = R99 000, less R36 000 already put in.
    expect(r1.roomAnnual).toBe(63_000);
  });

  it("R2: no retirement saving → an example of R2 000 a month, saving 24 000 × the marginal rate", () => {
    const i: CalculationInputs = { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" };
    const r2 = rec(recommend(i), "R2");
    expect(r2.extraMonthly).toBe(2_000);
    expect(r2.annualSaving).toBe(24_000 * 0.26);
    expect(r2.monthlySaving).toBe(520);
    expect(ids(recommend(i))).not.toContain("R1");
  });

  it("R2 also applies when only the employer contributes", () => {
    expect(ids(recommend({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", retirement: { ownMonthly: 0, employerMonthly: 1_000 } }))).toContain("R2");
  });

  it("no R1/R2 when the retirement limit is already used up", () => {
    const i: CalculationInputs = { mode: "GROSS", amount: 100_000, ageBand: "UNDER_65", retirement: { ownMonthly: 40_000, employerMonthly: 0 } };
    expect(ids(recommend(i))).not.toContain("R1");
    expect(ids(recommend(i))).not.toContain("R9");
  });

  it("no R1/R2 when the person owes no tax: there is nothing to save", () => {
    const i: CalculationInputs = { mode: "GROSS", amount: 6_000, ageBand: "UNDER_65" };
    const got = ids(recommend(i));
    for (const id of ["R1", "R2", "R4", "R5", "R9"]) expect(got).not.toContain(id);
  });

  it("R9: in a 39% bracket, with the cents per rand", () => {
    const i: CalculationInputs = { mode: "GROSS", amount: 65_000, ageBand: "UNDER_65" };
    const r9 = rec(recommend(i), "R9");
    expect(r9).toMatchObject({ marginalRate: 0.39, centsPerRand: 39 });
    const r2 = rec(recommend(i), "R2");
    expect(r2.annualSaving).toBe(24_000 * 0.39);
  });

  it("no R9 below 39%", () => {
    expect(ids(recommend(t1))).not.toContain("R9");
    expect(ids(recommend({ mode: "GROSS", amount: 45_000, ageBand: "UNDER_65" }))).not.toContain("R9"); // 31%
  });

  it("R3 when a medical credit applies; R4 when there is no medical aid", () => {
    expect(rec(recommend(t1), "R3")).toMatchObject({ monthlyCredit: 752, claimedOnFiling: false });
    expect(ids(recommend(t1))).not.toContain("R4");
    const none = recommend({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" });
    expect(rec(none, "R4")).toMatchObject({ monthlyCredit: 376, usableMonthly: 376 });
    expect(ids(none)).not.toContain("R3");
  });

  it("R4 shows only what could actually be used when the tax is small", () => {
    const i: CalculationInputs = { mode: "GROSS", amount: 9_000, ageBand: "UNDER_65" };
    const r = calculate(rules, i);
    const r4 = rec(buildRecommendations(rules, i, r), "R4");
    expect(r4.usableMonthly).toBeLessThan(376);
    expect(r4.usableMonthly).toBeCloseTo(r.annualLiability / 12, 2);
  });

  it("R3 says claim on filing when the scheme is paid by debit order", () => {
    const i: CalculationInputs = { ...t1, medical: { member: true, members: 1, monthlyContribution: 3_000, paidBy: "SELF", ownSharePaidVia: "DEBIT_ORDER" } };
    expect(rec(recommend(i), "R3").claimedOnFiling).toBe(true);
  });

  it("R5: no donations → an example R1 000, saving 1 000 × marginal rate; not once they already donate", () => {
    const r5 = rec(recommend(t1), "R5");
    expect(r5).toMatchObject({ exampleAnnual: 1_000, annualSaving: 260, limitRate: 0.1 });
    expect(ids(recommend({ ...t1, advanced: { donations18AAnnual: 2_000 } }))).not.toContain("R5");
  });

  it("R6 near or over the interest exemption; R7 otherwise; never both", () => {
    const near = recommend({ ...t1, advanced: { localInterestAnnual: 20_000 } });
    expect(rec(near, "R6")).toMatchObject({ exemptionAnnual: 23_800, exemptionAge65: 34_500, tfsaAnnual: 46_000, tfsaLifetime: 500_000 });
    expect(ids(near)).not.toContain("R7");
    const far = recommend({ ...t1, advanced: { localInterestAnnual: 5_000 } });
    expect(ids(far)).toContain("R7");
    expect(ids(far)).not.toContain("R6");
    expect(ids(recommend(t1))).toContain("R7");
  });

  it("R8 when there is a medical aid (or a disability) and no out-of-pocket figure; not once it is given, nor for a non-member", () => {
    expect(ids(recommend(t1))).toContain("R8");
    expect(ids(recommend({ ...t1, medical: { ...t1.medical!, outOfPocketAnnual: 0 } }))).not.toContain("R8");
    expect(ids(recommend({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" }))).not.toContain("R8");
    expect(ids(recommend({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", medical: { member: false, members: 1, monthlyContribution: 0, paidBy: "SELF", disabilityInFamily: true } }))).toContain("R8");
  });

  it("recommendations come in a steady order: biggest levers first", () => {
    const i: CalculationInputs = { mode: "GROSS", amount: 65_000, ageBand: "UNDER_65", medical: { member: true, members: 1, monthlyContribution: 3_000, paidBy: "SELF" } };
    expect(ids(recommend(i))).toEqual(["R2", "R9", "R3", "R5", "R8", "R7"]);
  });
});

// ---------------------------------------------------------------------------
// Properties (PRD §14.6: never promise what the inputs can't support)
// ---------------------------------------------------------------------------

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const inputs = fc
  .record({
    mode: fc.constantFrom<CalculationMode>("GROSS", "TAKE_HOME"),
    amount: money(250_000),
    payFrequency: fc.constantFrom<PayFrequency>("MONTHLY", "WEEKLY", "FORTNIGHTLY"),
    ageBand: fc.constantFrom<AgeBand>("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
    retirement: fc.record({ ownMonthly: money(15_000), employerMonthly: money(15_000), privateRaMonthly: money(15_000) }),
    medical: fc.record({
      member: fc.boolean(),
      members: fc.integer({ min: 1, max: 15 }),
      monthlyContribution: money(15_000),
      paidBy: fc.constantFrom<MedicalPaidBy>("SELF", "EMPLOYER", "SHARED"),
      employerMonthly: money(15_000),
      monthsCovered: fc.integer({ min: 0, max: 12 }),
      ownSharePaidVia: fc.constantFrom<MedicalPaidVia>("PAYROLL", "DEBIT_ORDER"),
      outOfPocketAnnual: fc.option(money(150_000), { nil: undefined }),
      disabilityInFamily: fc.boolean(),
    }),
    variablePay: fc.record({ bonusAnnual: money(200_000), overtimeAnnual: money(50_000), commissionAnnual: money(200_000) }),
    advanced: fc.record({
      donations18AAnnual: money(200_000),
      localInterestAnnual: money(100_000),
      travelAllowanceMonthly: money(15_000),
      travelBusinessUse: fc.double({ min: 0, max: 1, noNaN: true }),
      hasSecondEmployer: fc.boolean(),
      secondEmployerAnnualGross: money(500_000),
    }),
  })
  .map((i) => i as unknown as CalculationInputs);

/**
 * The most a rand taken off taxable income can save: the top rate, plus the extra medical credit it can unlock.
 * For someone under 65 that credit is 25% of costs above 7.5% of taxable income, so a lower income raises it by
 * up to 25% × 7.5% of each rand. (The first version of this bound left that out and failed on about one run in
 * five: a person whose credit was just starting to appear saved the top rate plus 6 cents.)
 */
const MOST_PER_RAND = 0.45 + rules.medical6B.under65.multiplier * rules.medical6B.under65.incomeThresholdRate;

describe("guidance properties", () => {
  it("every number is finite, ids are unique, and nothing is recommended without its trigger", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calculate(rules, i);
        const exps = buildExplanations(rules, i, r);
        const recs = buildRecommendations(rules, i, r);
        const nums = (o: unknown): number[] =>
          typeof o === "number" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(nums) : [];
        for (const n of [...exps, ...recs].flatMap(nums)) expect(Number.isFinite(n)).toBe(true);
        expect(new Set(ids(recs)).size).toBe(recs.length);
        expect(new Set(ids(exps)).size).toBe(exps.length);

        const got = ids(recs);
        const own = r.ownRetirementAnnual + r.privateRaAnnual;
        if (own > 0) expect(got).not.toContain("R2");
        if (own === 0) expect(got).not.toContain("R1");
        if (r.medical6A.annualCredit > 0) expect(got).not.toContain("R4");
        if (r.medical6A.annualCredit === 0) expect(got).not.toContain("R3");
        if (r.donations.givenAnnual > 0) expect(got).not.toContain("R5");
        if (r.marginalRate < 0.39) expect(got).not.toContain("R9");
        if (r.annualLiability === 0) for (const id of ["R1", "R2", "R4", "R5"]) expect(got).not.toContain(id);
        expect(got.includes("R6") && got.includes("R7")).toBe(false);
        expect(got.includes("R3") && got.includes("R4")).toBe(false);
      }),
      { numRuns: 400 },
    );
  });

  it("rand savings only come with CALCULATED confidence, and never exceed what is possible", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calculate(rules, i);
        for (const rc of buildRecommendations(rules, i, r)) {
          const hasMoney = "monthlySaving" in rc || "annualSaving" in rc || "usableMonthly" in rc || "centsPerRand" in rc;
          if (hasMoney) expect(rc.confidence).toBe("CALCULATED");
          if (rc.confidence !== "CALCULATED") expect("monthlySaving" in rc || "annualSaving" in rc).toBe(false);
          if (rc.id === "R1" || rc.id === "R2") {
            // A rand off income can save at most the top rate; and never more than the whole tax bill.
            expect(rc.annualSaving).toBeGreaterThan(0);
            expect(rc.annualSaving).toBeLessThanOrEqual(rc.extraMonthly * 12 * MOST_PER_RAND + 0.05);
            expect(rc.annualSaving).toBeLessThanOrEqual(r.annualLiability + 0.05);
            expect(rc.extraMonthly * 12).toBeLessThanOrEqual(rc.roomAnnual + 0.05);
          }
          if (rc.id === "R5") {
            expect(rc.annualSaving).toBeGreaterThan(0);
            expect(rc.annualSaving).toBeLessThanOrEqual(rc.exampleAnnual * MOST_PER_RAND + 0.05);
          }
        }
        for (const ex of buildExplanations(rules, i, r)) {
          if (ex.id === "RETIREMENT") {
            expect(ex.savingAnnual).toBeGreaterThanOrEqual(0);
            expect(ex.savingAnnual).toBeLessThanOrEqual(ex.deductionAnnual * MOST_PER_RAND + 0.05);
          }
          if (ex.id === "DONATIONS") expect(ex.savingAnnual).toBeLessThanOrEqual(ex.deductionAnnual * MOST_PER_RAND + 0.05);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("a donation example can save a few cents more than the top rate when the extra medical credit is starting to appear", () => {
    // Found by the property above (seed 1634080583): under 65, 45% bracket, R56 864 out of pocket. R1 000 more in
    // donations saves R450,06: the top rate, plus 6 cents of extra medical credit that a lower income unlocks.
    const i = {
      mode: "GROSS",
      amount: 109_301.94,
      ageBand: "UNDER_65",
      medical: { member: true, members: 1, monthlyContribution: 12_012.88, paidBy: "EMPLOYER", employerMonthly: 0, monthsCovered: 8, ownSharePaidVia: "PAYROLL", outOfPocketAnnual: 56_863.89, disabilityInFamily: false },
      variablePay: { bonusAnnual: 38_677.92, overtimeAnnual: 49_999.83, commissionAnnual: 145_304.25 },
      advanced: { travelAllowanceMonthly: 14_999.91, hasSecondEmployer: true, secondEmployerAnnualGross: 93_425.09 },
    } as unknown as CalculationInputs;
    const r5 = buildRecommendations(rules, i, calculate(rules, i)).find((x) => x.id === "R5");
    expect(r5).toMatchObject({ exampleAnnual: 1_000, annualSaving: 450.06 });
    expect(450.06).toBeLessThanOrEqual(1_000 * MOST_PER_RAND + 0.05);
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calculate(rules, i);
        expect(buildRecommendations(rules, i, r)).toEqual(buildRecommendations(rules, i, r));
        expect(buildExplanations(rules, i, r)).toEqual(buildExplanations(rules, i, r));
      }),
      { numRuns: 100 },
    );
  });
});
