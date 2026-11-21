import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculate } from "../calculate.ts";
import { medical6B } from "../medical.ts";
import { normalise } from "../normalise.ts";
import { solveGrossFromTakeHome } from "../solver.ts";
import { dec } from "../money.ts";
import { TaxRules2026_27 as rules } from "../rulesets/2026-27.ts";
import type {
  AgeBand,
  CalculationInputs,
  CalculationMode,
  CalculationResult,
  FlagCode,
  MedicalPaidBy,
  MedicalPaidVia,
  PayFrequency,
} from "../types.ts";

const calc = (inputs: CalculationInputs) => calculate(rules, inputs);
const flagCodes = (r: CalculationResult): FlagCode[] => r.flags.map((f) => f.code);

describe("PRD test vectors T12–T15, T17–T20", () => {
  // T12/T13 use Section 6A amounts no member count produces (D3), so the 6B function is tested directly.
  it("T12: under 65, taxable R400 000, contributions R36 000, OOP R18 000, 6A R11 688 → 6B R0", () => {
    const v = medical6B(rules, {
      ageBand: "UNDER_65",
      disabilityInFamily: false,
      contributionsAnnual: dec(36_000),
      s6aAnnual: dec(11_688),
      outOfPocketAnnual: dec(18_000),
      taxableIncome: dec(400_000),
    });
    expect(v.toNumber()).toBe(0);
  });

  it("T13: under 65, taxable R400 000, contributions R66 000, OOP R60 000, 6A R17 592 → 6B R7 500", () => {
    const v = medical6B(rules, {
      ageBand: "UNDER_65",
      disabilityInFamily: false,
      contributionsAnnual: dec(66_000),
      s6aAnnual: dec(17_592),
      outOfPocketAnnual: dec(60_000),
      taxableIncome: dec(400_000),
    });
    expect(v.toNumber()).toBe(7_500);
  });

  it("T14 (corrected, D2): 65+, contributions R40 000, 6A R4 512, OOP R10 000 → 6B R12 142.51", () => {
    const v = medical6B(rules, {
      ageBand: "AGE_65_74",
      disabilityInFamily: false,
      contributionsAnnual: dec(40_000),
      s6aAnnual: dec(4_512),
      outOfPocketAnnual: dec(10_000),
      taxableIncome: dec(360_000),
    });
    expect(v.toDecimalPlaces(2).toNumber()).toBe(12_142.51);

    // The same scenario through the full engine (1 member → 6A R4 512).
    const r = calc({
      amount: 30_000,
      ageBand: "AGE_65_74",
      medical: { member: true, members: 1, monthlyContribution: 40_000 / 12, paidBy: "SELF", outOfPocketAnnual: 10_000 },
    });
    expect(r.medical6A.annualCredit).toBe(4_512);
    expect(r.medical6B.status).toBe("CALCULATED");
    expect(r.medical6B.branch).toBe("AGE_65_OR_DISABILITY");
    expect(r.medical6B.annualCredit).toBe(12_142.51);
    // 73 992 − 27 585 rebates − 4 512 (6A) − 12 142.51 (6B)
    expect(r.annualLiability).toBe(29_752.49);
  });

  it("T15: donations R50 000, taxable before donation R300 000 → deduction R30 000, R20 000 carried forward", () => {
    const r = calc({ amount: 25_000, ageBand: "UNDER_65", advanced: { donations18AAnnual: 50_000, has18AReceipt: true } });
    expect(r.donations.capAnnual).toBe(30_000);
    expect(r.donations.deductionAnnual).toBe(30_000);
    expect(r.donations.carryForwardAnnual).toBe(20_000);
    expect(r.taxableIncome).toBe(270_000);
  });

  it("T17: payslip mode, gross R45 000, payslip PAYE R6 800 → neutral comparison", () => {
    const r = calc({ mode: "PAYSLIP", amount: 45_000, ageBand: "UNDER_65", payslip: { payeMonthly: 6_800 } });
    // 540 000 → 125 599 + 36% × 9 800 = 129 127 − 17 820 = 111 307 ÷ 12 = 9 275.58
    expect(r.comparison).toEqual({
      payslipPaye: 6_800,
      calcPaye: 9_275.58,
      diff: -2_475.58,
      diffPct: -26.7,
      closeMatch: false,
      payslipUif: 177.12,
      calcUif: 177.12,
      uifAssumed: true,
    });
    expect(r.notes).toContain("PAYSLIP_UIF_ASSUMED");
  });

  it("T18: interest R30 000, under 65 → R6 200 taxable", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { localInterestAnnual: 30_000 } });
    expect(r.interest.exemptionAnnual).toBe(23_800);
    expect(r.interest.taxableAnnual).toBe(6_200);
    expect(r.taxableIncome).toBe(366_200);
    // 65+ exemption is R34 500 → nothing taxable.
    expect(calc({ amount: 30_000, ageBand: "AGE_65_74", advanced: { localInterestAnnual: 30_000 } }).interest.taxableAnnual).toBe(0);
  });

  it("T19: travel allowance R5 000, 60% business → R4 000 a month taxable", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { travelAllowanceMonthly: 5_000, travelBusinessUse: 0.6 } });
    expect(r.travel.taxableRate).toBe(0.8);
    expect(r.travel.taxableMonthly).toBe(4_000);
  });

  it("T20: travel allowance R5 000, 85% business → R1 000 a month taxable", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { travelAllowanceMonthly: 5_000, travelBusinessUse: 0.85 } });
    expect(r.travel.taxableRate).toBe(0.2);
    expect(r.travel.taxableMonthly).toBe(1_000);
  });
});

describe("retirement annuity paid by debit order", () => {
  const base = { amount: 30_000, ageBand: "UNDER_65" as const };

  it("payroll doesn't see it: PAYE and the bank deposit are unchanged", () => {
    const plain = calc(base);
    const r = calc({ ...base, retirement: { ownMonthly: 0, employerMonthly: 0, privateRaMonthly: 2_000 } });
    expect(r.monthlyPaye).toBe(plain.monthlyPaye);
    expect(r.takeHomeMonthly).toBe(plain.takeHomeMonthly);
    expect(r.privateRaAnnual).toBe(24_000);
  });

  it("the saving comes back on filing: R24 000 × 26% = R6 240", () => {
    const r = calc({ ...base, retirement: { ownMonthly: 0, employerMonthly: 0, privateRaMonthly: 2_000 } });
    expect(r.retirement.deductionAnnual).toBe(24_000);
    expect(r.taxableIncome).toBe(336_000);
    expect(r.annualPaye).toBe(56_172);
    expect(r.annualLiability).toBe(49_932);
    expect(r.filing.refundAnnual).toBe(6_240);
    expect(r.notes).toContain("PRIVATE_RA_CLAIMED_ON_FILING");
  });

  it("shares the Section 11F limit with payroll contributions", () => {
    const r = calc({ amount: 20_000, ageBand: "UNDER_65", retirement: { ownMonthly: 4_000, employerMonthly: 0, privateRaMonthly: 4_000 } });
    expect(r.retirement.poolAnnual).toBe(96_000);
    expect(r.retirement.deductionAnnual).toBe(66_000); // 27.5% × 240 000
    expect(r.retirement.carryForwardAnnual).toBe(30_000);
  });

  it("take-home mode isn't thrown off by a private RA", () => {
    const r = calc({
      mode: "TAKE_HOME",
      amount: 25_141.88,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 0, employerMonthly: 0, privateRaMonthly: 2_000 },
    });
    expect(r.grossMonthly).toBe(30_000);
  });
});

describe("Section 18A donations", () => {
  it("cap is 10% of income after the retirement deduction", () => {
    const r = calc({
      amount: 25_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 2_500, employerMonthly: 0 },
      advanced: { donations18AAnnual: 40_000, has18AReceipt: true },
    });
    expect(r.donations.capAnnual).toBe(27_000);
    expect(r.donations.deductionAnnual).toBe(27_000);
  });

  it("small donations are fully deductible and save tax at the marginal rate", () => {
    const plain = calc({ amount: 30_000, ageBand: "UNDER_65" });
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { donations18AAnnual: 1_000, has18AReceipt: true } });
    expect(r.donations.deductionAnnual).toBe(1_000);
    expect(plain.annualLiability - r.annualLiability).toBe(260);
    // Payroll doesn't see donations: refund on filing.
    expect(r.filing.refundAnnual).toBe(260);
  });

  it("flags a missing receipt and large gifts", () => {
    expect(flagCodes(calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { donations18AAnnual: 1_000 } }))).toContain(
      "DONATION_RECEIPT_NEEDED",
    );
    const big = calc({ amount: 200_000, ageBand: "UNDER_65", advanced: { donations18AAnnual: 150_001, has18AReceipt: true } });
    expect(flagCodes(big)).toContain("DONATIONS_TAX_LARGE_GIFTS");
    expect(flagCodes(big)).not.toContain("DONATION_RECEIPT_NEEDED");
  });
});

describe("Section 6B additional medical credit", () => {
  it("isn't worked out unless out-of-pocket costs are given", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", medical: { member: true, members: 2, monthlyContribution: 4_000, paidBy: "SELF" } });
    expect(r.medical6B.status).toBe("NOT_PROVIDED");
    expect(r.medical6B.annualCredit).toBe(0);
    expect(flagCodes(r)).toContain("MEDICAL_6B_POSSIBLE");
  });

  it("disability uses the 33.3% branch for under-65s", () => {
    const r = calc({
      amount: 30_000,
      ageBand: "UNDER_65",
      medical: {
        member: true,
        members: 1,
        monthlyContribution: 40_000 / 12,
        paidBy: "SELF",
        outOfPocketAnnual: 10_000,
        disabilityInFamily: true,
      },
    });
    expect(r.medical6B.branch).toBe("AGE_65_OR_DISABILITY");
    expect(r.medical6B.annualCredit).toBe(12_142.51);
  });

  it("applies to out-of-pocket costs without scheme membership", () => {
    // 25% × (40 000 − 7.5% × 360 000) = 25% × 13 000 = 3 250
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", medical: { member: false, members: 1, monthlyContribution: 0, paidBy: "SELF", outOfPocketAnnual: 40_000 } });
    expect(r.medical6B.annualCredit).toBe(3_250);
    expect(r.filing.refundAnnual).toBe(3_250);
  });

  it("counts employer contributions and says so", () => {
    const r = calc({
      amount: 30_000,
      ageBand: "AGE_65_74",
      medical: { member: true, members: 1, monthlyContribution: 3_000, paidBy: "EMPLOYER", outOfPocketAnnual: 0 },
    });
    expect(r.medical6B.contributionsAnnual).toBe(36_000);
    expect(r.notes).toContain("MEDICAL_6B_INCLUDES_EMPLOYER_CONTRIBUTIONS");
  });
});

describe("travel allowance", () => {
  const r = calc({
    amount: 30_000,
    ageBand: "UNDER_65",
    advanced: { travelAllowanceMonthly: 5_000, travelBusinessUse: 0.6, travelBusinessKmAnnual: 5_000 },
  });

  it("payroll withholds PAYE on the taxable part and pays the allowance in cash", () => {
    // 360 000 + 48 000 = 408 000 → 79 998 + 31% × 24 900 = 87 717 − 17 820 = 69 897 ÷ 12 = 5 824.75
    expect(r.monthlyPaye).toBe(5_824.75);
    expect(r.takeHomeMonthly).toBe(30_000 + 5_000 - 5_824.75 - 177.12);
    expect(r.uifMonthly).toBe(177.12);
  });

  it("estimates the possible logbook deduction without applying it", () => {
    expect(r.travel.possibleDeductionAnnual).toBe(24_750); // 5 000 km × R4.95
    expect(r.annualLiability).toBe(69_897);
    expect(flagCodes(r)).toContain("TRAVEL_LOGBOOK_REQUIRED");
  });

  it("caps the possible deduction at the allowance", () => {
    const far = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { travelAllowanceMonthly: 5_000, travelBusinessKmAnnual: 20_000 } });
    expect(far.travel.possibleDeductionAnnual).toBe(60_000);
  });
});

describe("second employer (E10)", () => {
  it("adds the income to the final tax and estimates what is owed on filing", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { hasSecondEmployer: true, secondEmployerAnnualGross: 100_000 } });
    // 460 000 → 79 998 + 31% × 76 900 = 103 837 − 17 820 = 86 017
    expect(r.annualLiability).toBe(86_017);
    expect(r.annualPaye).toBe(56_172);
    expect(r.secondEmployer.estimatedPayeAnnual).toBe(180); // 18 000 − 17 820
    expect(r.filing.owedAnnual).toBe(29_665);
    expect(r.filing.refundAnnual).toBe(0);
    expect(flagCodes(r)).toContain("MULTIPLE_EMPLOYERS");
    expect(r.notes).toContain("SECOND_EMPLOYER_PAYE_ESTIMATED");
  });

  it("flags a second job even without an amount", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { hasSecondEmployer: true } });
    expect(flagCodes(r)).toContain("MULTIPLE_EMPLOYERS");
    expect(r.filing.balanceAnnual).toBe(0);
  });
});

describe("payslip comparison", () => {
  it("is close when payroll matches", () => {
    const r = calc({ mode: "PAYSLIP", amount: 30_000, ageBand: "UNDER_65", payslip: { payeMonthly: 4_681.5, uifMonthly: 177.12 } });
    expect(r.comparison?.closeMatch).toBe(true);
    expect(r.comparison?.uifAssumed).toBe(false);
  });

  it("is hidden when payslip PAYE is missing (E7) and in take-home mode", () => {
    expect(calc({ mode: "PAYSLIP", amount: 30_000, ageBand: "UNDER_65", payslip: { uifMonthly: 177.12 } }).comparison).toBeUndefined();
    expect(calc({ mode: "TAKE_HOME", amount: 30_000, ageBand: "UNDER_65", payslip: { payeMonthly: 1 } }).comparison).toBeUndefined();
  });

  it("works in gross mode too", () => {
    expect(calc({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", payslip: { payeMonthly: 4_681 } }).comparison?.diff).toBe(0);
  });

  it("has no percentage when the calculated PAYE is R0", () => {
    const r = calc({ mode: "PAYSLIP", amount: 5_000, ageBand: "UNDER_65", payslip: { payeMonthly: 100 } });
    expect(r.comparison?.diffPct).toBeNull();
    expect(r.comparison?.diff).toBe(100);
  });

  it("warns about impossible payslip figures but still compares", () => {
    const r = calc({ mode: "PAYSLIP", amount: 10_000, ageBand: "UNDER_65", payslip: { payeMonthly: 12_000, uifMonthly: 250 } });
    expect(r.warnings).toEqual(expect.arrayContaining(["PAYSLIP_UIF_ABOVE_MAX", "PAYSLIP_PAYE_ABOVE_GROSS"]));
    expect(r.comparison).toBeDefined();
  });

  it("compares with what payroll should withhold, not the final tax", () => {
    // Debit-order medical aid: payroll doesn't apply the credit, so R3 901 is right for this payslip.
    const r = calc({
      mode: "PAYSLIP",
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 4_000, paidBy: "SELF", ownSharePaidVia: "DEBIT_ORDER" },
      payslip: { payeMonthly: 3_901 },
    });
    expect(r.comparison?.closeMatch).toBe(true);
  });
});

describe("flags", () => {
  const ALWAYS: FlagCode[] = [
    "OTHER_INCOME_NOT_INCLUDED",
    "CAPITAL_GAINS_NOT_INCLUDED",
    "FOREIGN_INCOME_OR_RESIDENCY",
    "FRINGE_BENEFITS_NOT_MODELLED",
    "HOME_OFFICE_NOT_MODELLED",
    "SDL_COIDA_EMPLOYER_ONLY",
  ];

  it("always lists what the calculator leaves out, each with a source", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65" });
    expect(flagCodes(r)).toEqual(ALWAYS);
    expect(r.flags.every((f) => /^S\d+$/.test(f.source))).toBe(true);
  });

  it("puts situation-specific flags first", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", retirement: { ownMonthly: 1_000, employerMonthly: 0 } });
    expect(flagCodes(r)[0]).toBe("RETIREMENT_LUMP_SUMS_NOT_CALCULATED");
  });

  it("flags commission earners (more than half of pay)", () => {
    expect(flagCodes(calc({ amount: 10_000, ageBand: "UNDER_65", variablePay: { commissionAnnual: 130_000 } }))).toContain(
      "COMMISSION_EARNER_DEDUCTIONS",
    );
    expect(flagCodes(calc({ amount: 10_000, ageBand: "UNDER_65", variablePay: { commissionAnnual: 100_000 } }))).not.toContain(
      "COMMISSION_EARNER_DEDUCTIONS",
    );
  });

  it("flags dividends when interest is entered", () => {
    expect(flagCodes(calc({ amount: 30_000, ageBand: "UNDER_65", advanced: { localInterestAnnual: 1 } }))).toContain(
      "DIVIDENDS_NOT_INCLUDED",
    );
  });
});

describe("edge cases E1–E18 not covered elsewhere", () => {
  it("E2: below the threshold → may not need to file; zero income doesn't get the flag (E1)", () => {
    expect(flagCodes(calc({ amount: 5_000, ageBand: "UNDER_65" }))).toContain("BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE");
    expect(flagCodes(calc({ amount: 0, ageBand: "UNDER_65" }))).not.toContain("BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE");
  });

  it("E14: SDL/COIDA note is always present", () => {
    expect(flagCodes(calc({ amount: 30_000, ageBand: "UNDER_65" }))).toContain("SDL_COIDA_EMPLOYER_ONLY");
  });

  it("E15: huge donations never make taxable income negative", () => {
    const r = calc({ amount: 10_000, ageBand: "UNDER_65", advanced: { donations18AAnnual: 10_000_000, has18AReceipt: true } });
    expect(r.taxableIncome).toBe(108_000);
    expect(r.donations.carryForwardAnnual).toBe(10_000_000 - 12_000);
  });

  it("E18: credits never turn into a refund on their own", () => {
    const r = calc({
      amount: 8_000,
      ageBand: "UNDER_65",
      medical: { member: true, members: 4, monthlyContribution: 3_000, paidBy: "SELF", outOfPocketAnnual: 50_000 },
    });
    expect(r.annualLiability).toBe(0);
    expect(r.filing.refundAnnual).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Properties and fuzzing
// ---------------------------------------------------------------------------

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const fullInputs = fc.record({
  mode: fc.constantFrom<CalculationMode>("GROSS", "TAKE_HOME", "PAYSLIP"),
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
    has18AReceipt: fc.boolean(),
    localInterestAnnual: money(100_000),
    travelAllowanceMonthly: money(15_000),
    travelBusinessUse: fc.double({ min: 0, max: 1, noNaN: true }),
    travelBusinessKmAnnual: money(60_000),
    hasSecondEmployer: fc.boolean(),
    secondEmployerAnnualGross: money(500_000),
  }),
  payslip: fc.record({ payeMonthly: fc.option(money(100_000), { nil: undefined }), uifMonthly: fc.option(money(300), { nil: undefined }) }),
}).map((i) => i as unknown as CalculationInputs); // optional fields may be undefined

function everyNumber(value: unknown, visit: (n: number, path: string) => void, path = "result"): void {
  if (typeof value === "number") visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => everyNumber(v, visit, `${path}[${i}]`));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) everyNumber(v, visit, `${path}.${k}`);
  }
}

describe("properties", () => {
  it("every number in every result is finite", () => {
    fc.assert(
      fc.property(fullInputs, (i) => {
        everyNumber(calc(i), (v, path) => {
          if (!Number.isFinite(v)) throw new Error(`${path} is ${v}`);
        });
      }),
      { numRuns: 400 },
    );
  });

  it("final tax = PAYE withheld + other employer's PAYE + filing balance", () => {
    fc.assert(
      fc.property(fullInputs, (i) => {
        const r = calc(i);
        const sum = dec(r.annualPaye).plus(r.secondEmployer.estimatedPayeAnnual).plus(r.filing.balanceAnnual);
        expect(sum.toNumber()).toBeCloseTo(r.annualLiability, 1);
        expect(r.filing.refundAnnual === 0 || r.filing.owedAnnual === 0).toBe(true);
      }),
      { numRuns: 400 },
    );
  });

  it("donations deduction never exceeds the gift or the 10% cap", () => {
    fc.assert(
      fc.property(fullInputs, (i) => {
        const { donations: d } = calc(i);
        expect(d.deductionAnnual).toBeLessThanOrEqual(d.givenAnnual);
        expect(d.deductionAnnual).toBeLessThanOrEqual(d.capAnnual + 0.01);
      }),
      { numRuns: 400 },
    );
  });

  it("credits and final tax are never negative, and tax never exceeds tax after rebates", () => {
    fc.assert(
      fc.property(fullInputs, (i) => {
        const r = calc(i);
        expect(r.medical6B.annualCredit).toBeGreaterThanOrEqual(0);
        expect(r.annualLiability).toBeGreaterThanOrEqual(0);
        expect(r.annualLiability).toBeLessThanOrEqual(r.taxAfterRebates);
      }),
      { numRuns: 400 },
    );
  });

  it("normal-month take-home reconciles to the cent", () => {
    fc.assert(
      fc.property(fullInputs, (i) => {
        const r = calc(i);
        const medical = r.ownMedicalPaidVia === "PAYROLL" ? r.ownMedicalMonthly : 0;
        const sum = dec(r.grossMonthly)
          .plus(r.travel.allowanceMonthly)
          .minus(r.ownRetirementMonthly)
          .minus(medical)
          .minus(r.monthlyPaye)
          .minus(r.uifMonthly);
        expect(sum.toNumber()).toBe(r.takeHomeMonthly);
      }),
      { numRuns: 400 },
    );
  });

  it("fuzz: junk in every field never throws", () => {
    const junk = fc.oneof(
      fc.double(),
      fc.constant(Number.NaN),
      fc.constant(Number.POSITIVE_INFINITY),
      fc.constant(-1e12),
      fc.constant(1e15),
      fc.constant(undefined),
    );
    fc.assert(
      fc.property(fc.array(junk, { minLength: 20, maxLength: 20 }), fc.boolean(), (j, b) => {
        const [a, own, emp, ra, mem, contrib, empMed, months, oop, bonus, ot, com, don, int, travel, use, km, second, paye, uif] = j;
        const inputs = {
          mode: "PAYSLIP",
          amount: a,
          ageBand: "AGE_75_PLUS",
          retirement: { ownMonthly: own, employerMonthly: emp, privateRaMonthly: ra },
          medical: {
            member: b,
            members: mem,
            monthlyContribution: contrib,
            paidBy: "SHARED",
            employerMonthly: empMed,
            monthsCovered: months,
            outOfPocketAnnual: oop,
            disabilityInFamily: !b,
            ownSharePaidVia: "DEBIT_ORDER",
          },
          variablePay: { bonusAnnual: bonus, overtimeAnnual: ot, commissionAnnual: com },
          advanced: {
            donations18AAnnual: don,
            localInterestAnnual: int,
            travelAllowanceMonthly: travel,
            travelBusinessUse: use,
            travelBusinessKmAnnual: km,
            hasSecondEmployer: b,
            secondEmployerAnnualGross: second,
          },
          payslip: { payeMonthly: paye, uifMonthly: uif },
        } as unknown as CalculationInputs;
        const r = calc(inputs);
        everyNumber(r, (v, path) => {
          if (!Number.isFinite(v)) throw new Error(`${path} is ${v}`);
        });
      }),
      { numRuns: 300 },
    );
  });

  it("fuzz: unknown enum values fall back to defaults", () => {
    const r = calc({
      mode: "BOGUS",
      amount: 30_000,
      ageBand: "TEEN",
      payFrequency: "DAILY",
      medical: { member: true, members: 2, monthlyContribution: 1_000, paidBy: "NOBODY", ownSharePaidVia: "CASH" },
      retirement: { ownMonthly: 0, employerMonthly: 0, fundTypes: ["RA", "CRYPTO", "RA"] },
    } as unknown as CalculationInputs);
    expect(r.mode).toBe("GROSS");
    expect(r.ageBand).toBe("UNDER_65");
    expect(r.payFrequency).toBe("MONTHLY");
    expect(r.ownMedicalPaidVia).toBe("PAYROLL");
    expect(r.retirement.fundTypes).toEqual(["RA"]);
  });
});

describe("solver bisection fallback", () => {
  // The fixed-point method always converges in practice, so force the fallback to prove it works.
  const solve = (inputs: CalculationInputs, target: number) =>
    solveGrossFromTakeHome(rules, normalise(inputs), dec(target), { maxFixedPointIterations: 0 });

  it("finds the same gross as the fixed-point method", () => {
    const inputs: CalculationInputs = { mode: "TAKE_HOME", amount: 20_000, ageBand: "UNDER_65" };
    const viaFixedPoint = calc(inputs).grossMonthly;
    const viaBisection = solve(inputs, 20_000);
    expect(viaBisection.details.method).toBe("BISECTION");
    expect(Math.abs(viaBisection.grossMonthly.toNumber() - viaFixedPoint)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(viaBisection.details.residual)).toBeLessThanOrEqual(0.02);
  });

  it("widens its search when large deductions push the answer far above the seed", () => {
    // R40 000 of payroll deductions a month: gross must be far above take-home ÷ 0.75.
    const inputs: CalculationInputs = {
      mode: "TAKE_HOME",
      amount: 5_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 40_000, employerMonthly: 0 },
    };
    const r = solve(inputs, 5_000);
    const check = calc({ ...inputs, mode: "GROSS", amount: r.grossMonthly.toNumber() });
    expect(Math.abs(check.takeHomeMonthly - 5_000)).toBeLessThanOrEqual(0.02);
  });
});

describe("amount ceiling", () => {
  it("caps absurd amounts at R1 trillion so results stay finite", () => {
    const r = calc({ amount: 1e300, ageBand: "UNDER_65" });
    expect(r.grossMonthly).toBe(1e12);
    expect(Number.isFinite(r.annualLiability)).toBe(true);
  });
});

describe("own retirement contribution as a percentage of salary", () => {
  it("T1: R3 000 of R30 000 is 10%", () => {
    const r = calc({ amount: 30_000, ageBand: "UNDER_65", retirement: { ownMonthly: 3_000, employerMonthly: 0 } });
    expect(r.retirement.ownPercentOfGross).toBe(10);
  });

  it("counts payslip and private RA together, not the employer's share", () => {
    const r = calc({
      amount: 40_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 2_000, employerMonthly: 5_000, privateRaMonthly: 1_000 },
    });
    expect(r.retirement.ownPercentOfGross).toBe(7.5);
  });

  it("rounds to one decimal and is 0 without salary or contributions", () => {
    expect(calc({ amount: 30_000, ageBand: "UNDER_65", retirement: { ownMonthly: 1_000, employerMonthly: 0 } }).retirement.ownPercentOfGross).toBe(3.3);
    expect(calc({ amount: 0, ageBand: "UNDER_65", retirement: { ownMonthly: 1_000, employerMonthly: 0 } }).retirement.ownPercentOfGross).toBe(0);
    expect(calc({ amount: 30_000, ageBand: "UNDER_65" }).retirement.ownPercentOfGross).toBe(0);
  });
});

describe("percentage stays sane at the extremes", () => {
  it("a tiny salary counts as none, and huge ratios are capped", () => {
    expect(calc({ amount: 5e-324, ageBand: "UNDER_65", retirement: { ownMonthly: 1e12, employerMonthly: 0 } }).retirement.ownPercentOfGross).toBe(0);
    expect(calc({ amount: 1, ageBand: "UNDER_65", retirement: { ownMonthly: 1e12, employerMonthly: 0 } }).retirement.ownPercentOfGross).toBe(10_000);
  });
});

describe("payslip amounts per pay period", () => {
  it("monthly pay: per period is the same as monthly", () => {
    const a = calc({ mode: "PAYSLIP", amount: 30_000, ageBand: "UNDER_65", payslip: { payePerPeriod: 4_681, uifPerPeriod: 177.12 } });
    const b = calc({ mode: "PAYSLIP", amount: 30_000, ageBand: "UNDER_65", payslip: { payeMonthly: 4_681, uifMonthly: 177.12 } });
    expect(a.comparison).toEqual(b.comparison);
    expect(a.comparison?.closeMatch).toBe(true);
  });

  it("weekly pay: a weekly payslip is turned into a monthly figure (× 52 ÷ 12)", () => {
    // R5 000 a week: normal-month PAYE R2 514,33. A weekly payslip with R580,23 PAYE is 580,23 × 52 ÷ 12 = R2 514,33 a month.
    const r = calc({ mode: "PAYSLIP", amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65", payslip: { payePerPeriod: 580.23 } });
    expect(r.monthlyPaye).toBe(2_514.33);
    expect(r.comparison?.payslipPaye).toBe(2_514.33);
    expect(r.comparison?.closeMatch).toBe(true);
  });

  it("fortnightly pay: × 26 ÷ 12", () => {
    const r = calc({ mode: "PAYSLIP", amount: 10_000, payFrequency: "FORTNIGHTLY", ageBand: "UNDER_65", payslip: { payePerPeriod: 1_160.46 } });
    expect(r.comparison?.payslipPaye).toBe(2_514.33);
  });

  it("an explicit monthly figure wins over a per-period one", () => {
    const r = calc({ mode: "PAYSLIP", amount: 30_000, ageBand: "UNDER_65", payslip: { payeMonthly: 100, payePerPeriod: 4_681 } });
    expect(r.comparison?.payslipPaye).toBe(100);
  });

  it("UIF per payslip is converted too, and the UIF ceiling check uses the monthly equivalent", () => {
    const ok = calc({ mode: "PAYSLIP", amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65", payslip: { payePerPeriod: 580.23, uifPerPeriod: 40.87 } });
    expect(ok.comparison?.payslipUif).toBeCloseTo(177.12, 1);
    expect(ok.warnings).not.toContain("PAYSLIP_UIF_ABOVE_MAX");
    const tooHigh = calc({ mode: "PAYSLIP", amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65", payslip: { payePerPeriod: 580.23, uifPerPeriod: 60 } });
    expect(tooHigh.warnings).toContain("PAYSLIP_UIF_ABOVE_MAX");
  });

  it("UIF in a normal pay period: R177,12 a month is about R40,87 a week", () => {
    expect(calc({ amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65" }).uifPerPeriod).toBe(40.87);
    expect(calc({ amount: 30_000, ageBand: "UNDER_65" }).uifPerPeriod).toBe(177.12);
    expect(calc({ amount: 0, ageBand: "UNDER_65" }).uifPerPeriod).toBe(0);
  });
});

describe("UIF warning without PAYE", () => {
  it("warns about UIF above the legal maximum even when payslip PAYE wasn't entered", () => {
    const r = calc({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", payslip: { uifMonthly: 250 } });
    expect(r.warnings).toContain("PAYSLIP_UIF_ABOVE_MAX");
    expect(r.comparison).toBeUndefined();
  });

  it("doesn't warn at or below the maximum, in bank-account mode, or twice", () => {
    expect(calc({ mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", payslip: { uifMonthly: 177.12 } }).warnings).not.toContain("PAYSLIP_UIF_ABOVE_MAX");
    expect(calc({ mode: "TAKE_HOME", amount: 30_000, ageBand: "UNDER_65", payslip: { uifMonthly: 250 } }).warnings).not.toContain("PAYSLIP_UIF_ABOVE_MAX");
    const both = calc({ mode: "PAYSLIP", amount: 30_000, ageBand: "UNDER_65", payslip: { payeMonthly: 4_000, uifMonthly: 250 } });
    expect(both.warnings.filter((w) => w === "PAYSLIP_UIF_ABOVE_MAX")).toHaveLength(1);
  });
});
