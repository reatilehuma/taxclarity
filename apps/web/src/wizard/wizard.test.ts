import { calculate, CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { describe, expect, it } from "vitest";
import {
  applyPatch,
  hasMinimumAnswers,
  INITIAL_ANSWERS,
  extrasFilledCount,
  isAmountValid,
  isExtrasComplete,
  isMedicalComplete,
  isPayslipComplete,
  isRetirementComplete,
  isVariableComplete,
  MAX_REASONABLE_AMOUNT,
  payslipApplies,
  toEngineInputs,
  toggleVariableType,
  type ExtrasAnswers,
  type MedicalAnswers,
  type RetirementAnswers,
  type VariableAnswers,
  type WizardAnswers,
} from "./answers.ts";
import { flowFor, furthestReachable, parseStep, STEPS, stepUrl } from "./flow.ts";
import { buildReview } from "./review.ts";

const answers = (patch: Partial<WizardAnswers>): WizardAnswers => ({ ...INITIAL_ANSWERS, ...patch });
const withRetirement = (patch: Partial<RetirementAnswers>) =>
  answers({ retirement: { ...INITIAL_ANSWERS.retirement, ...patch } });
const withMedical = (patch: Partial<MedicalAnswers>) => answers({ medical: { ...INITIAL_ANSWERS.medical, ...patch } });
const withVariable = (patch: Partial<VariableAnswers>) => answers({ variable: { ...INITIAL_ANSWERS.variable, ...patch } });

describe("answers", () => {
  it("starts empty, with the PRD defaults", () => {
    expect(INITIAL_ANSWERS).toMatchObject({
      mode: null,
      amount: null,
      confirmedHighAmount: null,
      payFrequency: "MONTHLY",
      ageBand: "UNDER_65",
    });
    expect(INITIAL_ANSWERS.retirement.has).toBeNull();
    expect(INITIAL_ANSWERS.medical).toMatchObject({ member: null, members: 1, paidBy: "SELF", ownSharePaidVia: "PAYROLL" });
    expect(INITIAL_ANSWERS.variable.types).toBeNull();
  });

  it("an amount is valid when it is a number from R0 up", () => {
    expect(isAmountValid(answers({ amount: null }))).toBe(false);
    expect(isAmountValid(answers({ amount: -1 }))).toBe(false);
    expect(isAmountValid(answers({ amount: Number.NaN }))).toBe(false);
    expect(isAmountValid(answers({ amount: 0 }))).toBe(true);
    expect(isAmountValid(answers({ amount: 30_000 }))).toBe(true);
    expect(isAmountValid(answers({ amount: MAX_REASONABLE_AMOUNT }))).toBe(true);
  });

  it("a very high amount needs confirming, and only that exact amount", () => {
    const high = MAX_REASONABLE_AMOUNT + 1;
    expect(isAmountValid(answers({ amount: high }))).toBe(false);
    expect(isAmountValid(answers({ amount: high, confirmedHighAmount: high }))).toBe(true);
    expect(isAmountValid(answers({ amount: high + 1, confirmedHighAmount: high }))).toBe(false);
  });

  it("minimum answers = a mode and a valid amount", () => {
    expect(hasMinimumAnswers(answers({ amount: 30_000 }))).toBe(false);
    expect(hasMinimumAnswers(answers({ mode: "GROSS" }))).toBe(false);
    expect(hasMinimumAnswers(answers({ mode: "GROSS", amount: 30_000 }))).toBe(true);
  });

  it("changing how you start clears the amount, because it would mean something else", () => {
    const before = answers({ mode: "TAKE_HOME", amount: 20_000, confirmedHighAmount: 20_000 });
    const after = applyPatch(before, { mode: "GROSS" });
    expect(after.amount).toBeNull();
    expect(after.confirmedHighAmount).toBeNull();
    expect(after.mode).toBe("GROSS");
  });

  it("changing how you start keeps the retirement, medical and extra-pay answers", () => {
    const before = { ...withRetirement({ has: true, payslipMonthly: 3_000 }), mode: "GROSS" as const, amount: 30_000 };
    expect(applyPatch(before, { mode: "TAKE_HOME" }).retirement.payslipMonthly).toBe(3_000);
  });

  it("picking the same way to start again keeps the amount", () => {
    const before = answers({ mode: "GROSS", amount: 30_000 });
    expect(applyPatch(before, { mode: "GROSS" }).amount).toBe(30_000);
  });

  it("a change that changes nothing returns the very same object (no needless re-render)", () => {
    const before = answers({ mode: "GROSS", amount: 30_000 });
    expect(applyPatch(before, { mode: "GROSS" })).toBe(before);
    expect(applyPatch(before, { amount: 30_000, ageBand: "UNDER_65" })).toBe(before);
    expect(applyPatch(before, {})).toBe(before);
    expect(applyPatch(before, { amount: 1 })).not.toBe(before);
  });

  it("other changes keep everything else", () => {
    const before = answers({ mode: "GROSS", amount: 30_000 });
    expect(applyPatch(before, { ageBand: "AGE_65_74" })).toEqual({ ...before, ageBand: "AGE_65_74" });
  });
});

describe("step 3: retirement is finished when…", () => {
  it("they haven't answered → not finished", () => {
    expect(isRetirementComplete(INITIAL_ANSWERS)).toBe(false);
  });

  it("they say No → finished", () => {
    expect(isRetirementComplete(withRetirement({ has: false }))).toBe(true);
  });

  it("they say Yes with no amounts → not finished (nothing to count)", () => {
    expect(isRetirementComplete(withRetirement({ has: true }))).toBe(false);
    expect(isRetirementComplete(withRetirement({ has: true, payslipMonthly: 0, raMonthly: 0 }))).toBe(false);
  });

  it("any one contribution is enough: payslip, RA or employer", () => {
    expect(isRetirementComplete(withRetirement({ has: true, payslipMonthly: 3_000 }))).toBe(true);
    expect(isRetirementComplete(withRetirement({ has: true, raMonthly: 2_000 }))).toBe(true);
    expect(isRetirementComplete(withRetirement({ has: true, employerContributes: true, employerMonthly: 1_500 }))).toBe(true);
  });

  it("an employer amount is ignored while the box is unticked", () => {
    expect(isRetirementComplete(withRetirement({ has: true, employerContributes: false, employerMonthly: 1_500 }))).toBe(false);
  });

  it("negative amounts block", () => {
    expect(isRetirementComplete(withRetirement({ has: true, payslipMonthly: -1, raMonthly: 5_000 }))).toBe(false);
  });
});

describe("step 4: medical aid is finished when…", () => {
  it("not answered → not finished; No → finished", () => {
    expect(isMedicalComplete(INITIAL_ANSWERS)).toBe(false);
    expect(isMedicalComplete(withMedical({ member: false }))).toBe(true);
  });

  it("Yes needs a monthly total (R0 is fine)", () => {
    expect(isMedicalComplete(withMedical({ member: true }))).toBe(false);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 0 }))).toBe(true);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: -5 }))).toBe(false);
  });

  it("people on the plan must be a whole number from 1 to 15", () => {
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, members: 0 }))).toBe(false);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, members: 16 }))).toBe(false);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, members: 1.5 }))).toBe(false);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, members: 15 }))).toBe(true);
  });

  it("sharing needs the employer's share, and it can't be more than the total", () => {
    const shared = { member: true, monthlyTotal: 4_000, paidBy: "SHARED" as const };
    expect(isMedicalComplete(withMedical(shared))).toBe(false);
    expect(isMedicalComplete(withMedical({ ...shared, employerShare: 5_000 }))).toBe(false);
    expect(isMedicalComplete(withMedical({ ...shared, employerShare: 4_000 }))).toBe(true);
    expect(isMedicalComplete(withMedical({ ...shared, employerShare: 1_500 }))).toBe(true);
  });

  it("out-of-pocket costs are optional but can't be negative", () => {
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, outOfPocketAnnual: null }))).toBe(true);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, outOfPocketAnnual: 0 }))).toBe(true);
    expect(isMedicalComplete(withMedical({ member: true, monthlyTotal: 100, outOfPocketAnnual: -1 }))).toBe(false);
  });
});

describe("step 5: extra pay is finished when…", () => {
  it("not answered → not finished; 'none of these' → finished", () => {
    expect(isVariableComplete(INITIAL_ANSWERS)).toBe(false);
    expect(isVariableComplete(withVariable({ types: [] }))).toBe(true);
  });

  it("each type picked needs an amount", () => {
    expect(isVariableComplete(withVariable({ types: ["BONUS"] }))).toBe(false);
    expect(isVariableComplete(withVariable({ types: ["BONUS"], bonusAnnual: 30_000 }))).toBe(true);
    expect(isVariableComplete(withVariable({ types: ["BONUS", "OVERTIME"], bonusAnnual: 30_000 }))).toBe(false);
    expect(isVariableComplete(withVariable({ types: ["BONUS", "OVERTIME"], bonusAnnual: 30_000, overtimeAnnual: 0 }))).toBe(true);
  });

  it("amounts for types that aren't picked don't matter", () => {
    expect(isVariableComplete(withVariable({ types: ["OVERTIME"], overtimeAnnual: 1, commissionAnnual: -5 }))).toBe(true);
  });

  it("toggling adds, removes, and un-answers when the last one goes", () => {
    expect(toggleVariableType(null, "BONUS")).toEqual(["BONUS"]);
    expect(toggleVariableType(["BONUS"], "OVERTIME")).toEqual(["BONUS", "OVERTIME"]);
    expect(toggleVariableType(["BONUS", "OVERTIME"], "BONUS")).toEqual(["OVERTIME"]);
    expect(toggleVariableType(["BONUS"], "BONUS")).toBeNull();
    // Picking a type while "none" is selected replaces "none".
    expect(toggleVariableType([], "COMMISSION")).toEqual(["COMMISSION"]);
  });
});

describe("toEngineInputs", () => {
  it("maps the basics one to one", () => {
    expect(toEngineInputs(answers({ mode: "TAKE_HOME", amount: 20_000, payFrequency: "WEEKLY", ageBand: "AGE_75_PLUS" }))).toMatchObject({
      mode: "TAKE_HOME",
      amount: 20_000,
      payFrequency: "WEEKLY",
      ageBand: "AGE_75_PLUS",
    });
  });

  it("fills missing answers with safe defaults (no retirement, no medical aid, no extras)", () => {
    const inputs = toEngineInputs(INITIAL_ANSWERS);
    expect(inputs).toMatchObject({ mode: "GROSS", amount: 0 });
    expect(inputs.retirement).toEqual({ ownMonthly: 0, employerMonthly: 0 });
    expect(inputs.medical).toMatchObject({ member: false });
    expect(inputs.variablePay).toEqual({ bonusAnnual: 0, overtimeAnnual: 0, commissionAnnual: 0 });
  });

  it("retirement: payslip → own, debit order → private RA, employer only when ticked", () => {
    const inputs = toEngineInputs(
      withRetirement({ has: true, payslipMonthly: 2_000, raMonthly: 1_000, employerContributes: false, employerMonthly: 9_999 }),
    );
    expect(inputs.retirement).toMatchObject({ ownMonthly: 2_000, privateRaMonthly: 1_000, employerMonthly: 0 });
    const withEmployer = toEngineInputs(withRetirement({ has: true, payslipMonthly: 2_000, employerContributes: true, employerMonthly: 1_500 }));
    expect(withEmployer.retirement?.employerMonthly).toBe(1_500);
  });

  it("retirement answered No sends nothing, whatever was typed before", () => {
    expect(toEngineInputs(withRetirement({ has: false, payslipMonthly: 5_000 })).retirement).toEqual({
      ownMonthly: 0,
      employerMonthly: 0,
    });
  });

  it("medical: leaves out-of-pocket and employer share unless they apply", () => {
    const base = { member: true, members: 2, monthlyTotal: 4_000 };
    const self = toEngineInputs(withMedical({ ...base, employerShare: 1_000 })).medical!;
    expect(self).not.toHaveProperty("outOfPocketAnnual");
    expect(self).not.toHaveProperty("employerMonthly");
    const shared = toEngineInputs(withMedical({ ...base, paidBy: "SHARED", employerShare: 1_000, outOfPocketAnnual: 0 })).medical!;
    expect(shared).toMatchObject({ employerMonthly: 1_000, outOfPocketAnnual: 0, paidBy: "SHARED" });
  });

  it("medical answered No sends no membership", () => {
    expect(toEngineInputs(withMedical({ member: false, members: 5, monthlyTotal: 9_000 })).medical).toMatchObject({ member: false });
  });

  it("variable pay: only the types picked count", () => {
    const inputs = toEngineInputs(
      withVariable({ types: ["BONUS", "COMMISSION"], bonusAnnual: 30_000, overtimeAnnual: 99_999, commissionAnnual: 12_000 }),
    );
    expect(inputs.variablePay).toEqual({ bonusAnnual: 30_000, overtimeAnnual: 0, commissionAnnual: 12_000 });
  });

  it("T1 through the wizard model gives the PRD numbers (PAYE R3 149,00, take-home R23 673,88)", () => {
    const t1 = answers({
      mode: "GROSS",
      amount: 30_000,
      retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000 },
      medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 0 },
      variable: { ...INITIAL_ANSWERS.variable, types: [] },
    });
    const r = calculate(rules, toEngineInputs(t1));
    expect(r.monthlyPaye).toBe(3_149);
    expect(r.takeHomeMonthly).toBe(23_673.88);
  });

  it("the other PRD vectors that can be entered: T10 and T11", () => {
    const t10 = calculate(
      rules,
      toEngineInputs(answers({ mode: "GROSS", amount: 60_000, retirement: { ...INITIAL_ANSWERS.retirement, has: true, raMonthly: 200_000 / 12 } })),
    );
    expect(t10.retirement.deductionAnnual).toBe(198_000);
    expect(t10.retirement.carryForwardAnnual).toBe(2_000);
    const t11 = calculate(
      rules,
      toEngineInputs(
        answers({
          mode: "GROSS",
          amount: 150_000,
          retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 30_000, employerContributes: true, employerMonthly: 20_000 },
        }),
      ),
    );
    expect(t11.retirement.limitAnnual).toBe(430_000);
    expect(t11.retirement.carryForwardAnnual).toBe(170_000);
  });

  it("the Workbench's debit-order scenarios come out the same", () => {
    const ra = calculate(rules, toEngineInputs(answers({ mode: "GROSS", amount: 30_000, retirement: { ...INITIAL_ANSWERS.retirement, has: true, raMonthly: 2_000 } })));
    expect(ra.monthlyPaye).toBe(4_681);
    expect(ra.filing.refundAnnual).toBe(6_240);
    const med = calculate(
      rules,
      toEngineInputs(
        answers({
          mode: "GROSS",
          amount: 30_000,
          retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000 },
          medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 4_000, ownSharePaidVia: "DEBIT_ORDER" },
        }),
      ),
    );
    expect(med.monthlyPaye).toBe(3_901);
    expect(med.filing.refundAnnual).toBe(9_024);
  });

  it("take-home mode uses the retirement and medical answers when estimating gross", () => {
    const plain = calculate(rules, toEngineInputs(answers({ mode: "TAKE_HOME", amount: 20_000 })));
    const withPension = calculate(
      rules,
      toEngineInputs(answers({ mode: "TAKE_HOME", amount: 20_000, retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 2_000 } })),
    );
    expect(withPension.grossMonthly).toBeGreaterThan(plain.grossMonthly);
  });
});

describe("flow", () => {
  it("has the steps in PRD order (D6), with the payslip check only for gross and payslip modes (D7)", () => {
    const all = ["start", "amount", "age", "retirement", "medical", "variable", "extras", "payslip", "review"];
    expect(STEPS.map((s) => s.id)).toEqual(all);
    expect(flowFor(answers({ mode: "GROSS" })).map((s) => s.id)).toEqual(all);
    expect(flowFor(answers({ mode: "PAYSLIP" })).map((s) => s.id)).toEqual(all);
    expect(flowFor(answers({ mode: "TAKE_HOME" })).map((s) => s.id)).toEqual(all.filter((id) => id !== "payslip"));
  });

  it("can't jump ahead of an unanswered question", () => {
    const flow = flowFor(INITIAL_ANSWERS);
    const base = answers({ mode: "GROSS", amount: 30_000 });
    expect(furthestReachable(flow, INITIAL_ANSWERS)).toBe(0);
    expect(furthestReachable(flow, answers({ mode: "GROSS" }))).toBe(1);
    expect(furthestReachable(flow, base)).toBe(3); // retirement is next
    const afterRetirement = { ...base, retirement: { ...base.retirement, has: false } };
    expect(furthestReachable(flow, afterRetirement)).toBe(4);
    const afterMedical = { ...afterRetirement, medical: { ...base.medical, member: false } };
    expect(furthestReachable(flow, afterMedical)).toBe(5);
    const afterVariable = { ...afterMedical, variable: { ...base.variable, types: [] } };
    expect(furthestReachable(flow, afterVariable)).toBe(9); // extras, payslip (optional for gross) and review are all open
    // In payslip mode the payslip PAYE is required.
    const payslipMode = { ...afterVariable, mode: "PAYSLIP" as const };
    expect(furthestReachable(flowFor(payslipMode), payslipMode)).toBe(7);
    expect(furthestReachable(flowFor(payslipMode), { ...payslipMode, payslip: { paye: 0, uif: null } })).toBe(9);
  });

  it("every step has plain-language FAQs", () => {
    for (const mode of ["TAKE_HOME", "GROSS", "PAYSLIP"] as const) {
      for (const step of STEPS) {
        const items = step.faq(answers({ mode }));
        expect(items.length).toBeGreaterThanOrEqual(2);
        for (const item of items) {
          expect(item.question.length).toBeGreaterThan(5);
          expect(item.answer.length).toBeGreaterThan(20);
        }
      }
    }
  });

  it("the medical FAQ quotes the credit amounts from the rule set", () => {
    const medical = STEPS.find((s) => s.id === "medical")!;
    const credit = medical.faq(INITIAL_ANSWERS).find((f) => f.question === "How does the tax credit work?")!;
    const norm = credit.answer.replace(/ /g, " ");
    expect(norm).toContain(`R ${rules.medical6A.monthlyMain}`);
    expect(norm).toContain(`R ${rules.medical6A.monthlyAdditionalDep}`);
  });

  it("reads ?step= safely", () => {
    expect(parseStep("2")).toBe(2);
    expect(parseStep(null)).toBe(0);
    expect(parseStep("abc")).toBe(0);
    expect(parseStep("-1")).toBe(0);
    expect(parseStep("1.5")).toBe(0);
    expect(parseStep("99999")).toBe(0);
    expect(stepUrl(3)).toBe("/wizard?step=3");
  });
});

describe("step 6: optional extras", () => {
  const withExtras = (patch: Partial<ExtrasAnswers>) => answers({ extras: { ...INITIAL_ANSWERS.extras, ...patch } });

  it("never blocks when empty, and counts what's filled in", () => {
    expect(isExtrasComplete(INITIAL_ANSWERS)).toBe(true);
    expect(extrasFilledCount(INITIAL_ANSWERS)).toBe(0);
    expect(extrasFilledCount(withExtras({ donationsAnnual: 1_000, interestAnnual: 500, travelAllowanceMonthly: 2_000 }))).toBe(3);
    expect(extrasFilledCount(withExtras({ hasSecondEmployer: true }))).toBe(1);
  });

  it("R0 doesn't count as filled", () => {
    expect(extrasFilledCount(withExtras({ donationsAnnual: 0, interestAnnual: 0 }))).toBe(0);
  });

  it("months on a scheme and disability only count when they have a medical aid", () => {
    const member = answers({ medical: { ...INITIAL_ANSWERS.medical, member: true }, extras: { ...INITIAL_ANSWERS.extras, medicalMonths: 6, disability: true } });
    expect(extrasFilledCount(member)).toBe(2);
    const notMember = answers({ medical: { ...INITIAL_ANSWERS.medical, member: false }, extras: { ...INITIAL_ANSWERS.extras, medicalMonths: 6, disability: true } });
    expect(extrasFilledCount(notMember)).toBe(0);
  });

  it("negative amounts and impossible months block", () => {
    expect(isExtrasComplete(withExtras({ donationsAnnual: -1 }))).toBe(false);
    expect(isExtrasComplete(withExtras({ travelKmAnnual: -5 }))).toBe(false);
    expect(isExtrasComplete(withExtras({ medicalMonths: 13 }))).toBe(false);
    expect(isExtrasComplete(withExtras({ medicalMonths: 0 }))).toBe(true);
  });

  it("a second employer's amount only matters while that box is ticked", () => {
    expect(isExtrasComplete(withExtras({ hasSecondEmployer: false, secondEmployerAnnual: -1 }))).toBe(true);
    expect(isExtrasComplete(withExtras({ hasSecondEmployer: true, secondEmployerAnnual: -1 }))).toBe(false);
  });

  it("the main button says Skip until something is filled in", () => {
    const extras = STEPS.find((s) => s.id === "extras")!;
    expect(extras.primaryLabel?.(INITIAL_ANSWERS)).toBe("Skip");
    expect(extras.primaryLabel?.(withExtras({ donationsAnnual: 500 }))).toBeUndefined();
  });

  it("maps to the engine: the PRD vectors T15, T18, T19 and T20", () => {
    const base = answers({ mode: "GROSS", amount: 25_000 });
    const run = (extras: Partial<ExtrasAnswers>, a = base) =>
      calculate(rules, toEngineInputs({ ...a, extras: { ...INITIAL_ANSWERS.extras, ...extras } }));
    // T15: donations R50 000 on R300 000 → R30 000 deduction, R20 000 carried forward.
    const t15 = run({ donationsAnnual: 50_000, has18AReceipt: true });
    expect(t15.donations.deductionAnnual).toBe(30_000);
    expect(t15.donations.carryForwardAnnual).toBe(20_000);
    // T18: interest R30 000 under 65 → R6 200 taxable.
    expect(run({ interestAnnual: 30_000 }, answers({ mode: "GROSS", amount: 30_000 })).interest.taxableAnnual).toBe(6_200);
    // T19 / T20: travel allowance R5 000.
    const g = answers({ mode: "GROSS", amount: 30_000 });
    expect(run({ travelAllowanceMonthly: 5_000 }, g).travel.taxableMonthly).toBe(4_000);
    expect(run({ travelAllowanceMonthly: 5_000, travelBusinessHigh: true }, g).travel.taxableMonthly).toBe(1_000);
  });

  it("maps a second job: flagged and the other income added, with an amount or without", () => {
    const g = answers({ mode: "GROSS", amount: 30_000 });
    const withAmount = calculate(rules, toEngineInputs({ ...g, extras: { ...INITIAL_ANSWERS.extras, hasSecondEmployer: true, secondEmployerAnnual: 100_000 } }));
    expect(withAmount.annualLiability).toBe(86_017);
    expect(withAmount.filing.owedAnnual).toBe(29_665);
    const noAmount = calculate(rules, toEngineInputs({ ...g, extras: { ...INITIAL_ANSWERS.extras, hasSecondEmployer: true } }));
    expect(noAmount.flags.map((f) => f.code)).toContain("MULTIPLE_EMPLOYERS");
  });

  it("maps part-year medical aid and disability, and Section 6B (T14 corrected)", () => {
    const a = answers({
      mode: "GROSS",
      amount: 30_000,
      ageBand: "AGE_65_74",
      medical: { ...INITIAL_ANSWERS.medical, member: true, members: 1, monthlyTotal: 40_000 / 12, outOfPocketAnnual: 10_000 },
    });
    expect(calculate(rules, toEngineInputs(a)).medical6B.annualCredit).toBe(12_142.51);
    const partYear = calculate(rules, toEngineInputs({ ...a, extras: { ...INITIAL_ANSWERS.extras, medicalMonths: 6 } }));
    expect(partYear.medical6A.annualCredit).toBe(376 * 6);
    const disabled = calculate(
      rules,
      toEngineInputs({ ...a, ageBand: "UNDER_65", extras: { ...INITIAL_ANSWERS.extras, disability: true } }),
    );
    expect(disabled.medical6B.branch).toBe("AGE_65_OR_DISABILITY");
  });
});

describe("step 7: the payslip check", () => {
  const withPayslip = (mode: WizardAnswers["mode"], paye: number | null, uif: number | null = null) =>
    answers({ mode, amount: 30_000, payslip: { paye, uif } });

  it("only applies to gross and payslip modes (D7)", () => {
    expect(payslipApplies(answers({ mode: "TAKE_HOME" }))).toBe(false);
    expect(payslipApplies(answers({ mode: "GROSS" }))).toBe(true);
    expect(payslipApplies(answers({ mode: "PAYSLIP" }))).toBe(true);
  });

  it("PAYE is required in payslip mode (R0 is fine) and optional in gross mode", () => {
    expect(isPayslipComplete(withPayslip("PAYSLIP", null))).toBe(false);
    expect(isPayslipComplete(withPayslip("PAYSLIP", 0))).toBe(true);
    expect(isPayslipComplete(withPayslip("GROSS", null))).toBe(true);
  });

  it("UIF is always optional; negative amounts always block", () => {
    expect(isPayslipComplete(withPayslip("PAYSLIP", 4_000, null))).toBe(true);
    expect(isPayslipComplete(withPayslip("PAYSLIP", -1))).toBe(false);
    expect(isPayslipComplete(withPayslip("GROSS", null, -5))).toBe(false);
  });

  it("T17: gross R45 000 and payslip PAYE R6 800 → neutral comparison against R9 275,58", () => {
    const r = calculate(rules, toEngineInputs({ ...withPayslip("PAYSLIP", 6_800), amount: 45_000 }));
    expect(r.comparison).toMatchObject({ payslipPaye: 6_800, calcPaye: 9_275.58, diff: -2_475.58, diffPct: -26.7, uifAssumed: true });
  });

  it("is ignored in bank-account mode, even if answers linger from earlier", () => {
    expect(toEngineInputs(withPayslip("TAKE_HOME", 6_800)).payslip).toEqual({});
  });

  it("weekly payslips are converted by the engine", () => {
    const a = { ...withPayslip("PAYSLIP", 580.23), amount: 5_000, payFrequency: "WEEKLY" as const };
    const r = calculate(rules, toEngineInputs(a));
    expect(r.comparison?.payslipPaye).toBe(2_514.33);
    expect(r.comparison?.closeMatch).toBe(true);
  });
});

describe("the review screen's content", () => {
  const full = (): WizardAnswers =>
    answers({
      mode: "GROSS",
      amount: 30_000,
      retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000, raMonthly: 2_000, employerContributes: true, employerMonthly: 1_500 },
      medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 4_000, paidBy: "SHARED", employerShare: 1_000, ownSharePaidVia: "DEBIT_ORDER", outOfPocketAnnual: 5_000 },
      variable: { ...INITIAL_ANSWERS.variable, types: ["BONUS"], bonusAnnual: 30_000 },
      extras: { ...INITIAL_ANSWERS.extras, donationsAnnual: 2_000, has18AReceipt: true, travelAllowanceMonthly: 3_000, travelKmAnnual: 8_000, hasSecondEmployer: true, medicalMonths: 9, disability: true },
      payslip: { paye: 4_500, uif: null },
    });
  const rows = (g: ReturnType<typeof buildReview>[number]) => Object.fromEntries(g.rows.map((r) => [r.label, r.value]));
  const norm = (s: string) => s.replace(/\u00A0/g, " ");
  const build = (a: WizardAnswers) => buildReview(a, calculate(rules, toEngineInputs(a)));

  it("groups answers by topic, in order, each pointing at the step that changes it", () => {
    expect(build(full()).map((g) => [g.id, g.editStep])).toEqual([
      ["income", "amount"],
      ["retirement", "retirement"],
      ["medical", "medical"],
      ["variable", "variable"],
      ["extras", "extras"],
      ["payslip", "payslip"],
    ]);
  });

  it("income: how you started, the amount, how often you're paid, and your age", () => {
    const income = build(full())[0]!;
    const r = rows(income);
    expect(norm(r["Gross pay per month"]!)).toBe("R 30 000,00");
    expect(r["Paid"]).toBe("Monthly");
    expect(r["Age group"]).toBe("Younger than 65");
    expect(income.rows.find((x) => x.label === "Starting point")?.editStep).toBe("start");
    expect(income.rows.find((x) => x.label === "Age group")?.editStep).toBe("age");
  });

  it("weekly pay also shows the monthly equivalent from the engine", () => {
    const a = answers({ mode: "GROSS", amount: 5_000, payFrequency: "WEEKLY" });
    const income = build(a)[0]!;
    expect(norm(rows(income)["About a month"]!)).toBe("R 21 666,67");
  });

  it("retirement lists each contribution and the engine's percentage", () => {
    const r = rows(build(full())[1]!);
    expect(norm(r["Off your payslip, per month"]!)).toBe("R 3 000,00");
    expect(norm(r["Retirement annuity by debit order, per month"]!)).toBe("R 2 000,00");
    expect(norm(r["Your employer pays in, per month"]!)).toBe("R 1 500,00");
    expect(r["Your own share of your salary"]).toBe("16,7%");
  });

  it("says 'None' and 'No' for the skipped questions", () => {
    const a = answers({ mode: "GROSS", amount: 30_000, retirement: { ...INITIAL_ANSWERS.retirement, has: false }, medical: { ...INITIAL_ANSWERS.medical, member: false }, variable: { ...INITIAL_ANSWERS.variable, types: [] } });
    const g = build(a);
    expect(rows(g.find((x) => x.id === "retirement")!)).toEqual({ Contributions: "None" });
    expect(rows(g.find((x) => x.id === "medical")!)).toEqual({ "Medical aid": "No" });
    expect(rows(g.find((x) => x.id === "variable")!)).toEqual({ "Other pay": "None" });
  });

  it("medical aid: plan size, who pays, how your share is paid, and the extras edited elsewhere", () => {
    const medical = build(full())[2]!;
    const r = rows(medical);
    expect(r["People on the plan"]).toBe("2");
    expect(r["Who pays it?"]).toBe("You share it");
    expect(norm(r["Your employer's share, per month"]!)).toBe("R 1 000,00");
    expect(r["How is your share paid?"]).toBe("By debit order");
    expect(medical.rows.find((x) => x.label === "Months on the scheme")?.editStep).toBe("extras");
    expect(medical.rows.find((x) => x.label === "Disability in the family")?.editStep).toBe("extras");
  });

  it("optional extras appear only when filled in", () => {
    const plain = build(answers({ mode: "GROSS", amount: 30_000 }));
    expect(plain.map((g) => g.id)).not.toContain("extras");
    const extras = rows(build(full()).find((g) => g.id === "extras")!);
    expect(norm(extras["Donations, per year"]!)).toBe("R 2 000,00");
    expect(extras["18A receipt"]).toBe("I have one");
    expect(extras["Business kilometres"]).toBe("8 000 km");
    expect(extras["Other employer, per year"]).toBe("I'll check the amount later");
  });

  it("payslip: amounts entered, and the assumed UIF when left blank", () => {
    const r = rows(build(full()).find((g) => g.id === "payslip")!);
    expect(norm(r["PAYE on your payslip"]!)).toBe("R 4 500,00");
    expect(norm(r["UIF on your payslip"]!)).toBe("Not entered, so we assume R 177,12");
  });

  it("no payslip group in bank-account mode", () => {
    expect(build(answers({ mode: "TAKE_HOME", amount: 20_000 })).map((g) => g.id)).not.toContain("payslip");
  });

  it("a gross-mode user who skipped the payslip sees no payslip group; payslip mode always does", () => {
    expect(build(answers({ mode: "GROSS", amount: 30_000 })).map((g) => g.id)).not.toContain("payslip");
    expect(build(answers({ mode: "PAYSLIP", amount: 30_000 })).map((g) => g.id)).toContain("payslip");
  });
});
