import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildBreakdown, type BreakdownRow } from "../breakdown.ts";
import { calculate } from "../calculate.ts";
import { Decimal, dec } from "../money.ts";
import { TaxRules2026_27 as rules } from "../rulesets/2026-27.ts";
import type { AgeBand, CalculationInputs, CalculationMode, MedicalPaidBy, MedicalPaidVia, PayFrequency } from "../types.ts";

const calc = (i: CalculationInputs) => calculate(rules, i);
const t1: CalculationInputs = {
  mode: "GROSS",
  amount: 30_000,
  ageBand: "UNDER_65",
  retirement: { ownMonthly: 3_000, employerMonthly: 0 },
  medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" },
};

/** Adds a block the way a person would: money in, minus money out. Returns the total in cents as a Decimal. */
function sum(rows: BreakdownRow[], column: "monthly" | "annual"): Decimal {
  let total = dec(0);
  for (const r of rows) {
    const v = r[column];
    if (v === null) continue;
    if (r.kind === "add") total = total.plus(v);
    else if (r.kind === "less") total = total.minus(v);
  }
  return total;
}
const find = (rows: BreakdownRow[], id: string) => rows.find((r) => r.id === id);

describe("breakdown: T1", () => {
  const r = calc(t1);
  const b = buildBreakdown(r);

  it("pay to bank account, in the PRD order, adds up to take-home", () => {
    expect(b.payslip.map((x) => x.id)).toEqual(["GROSS", "RETIREMENT_OWN", "PAYE", "UIF", "TAKE_HOME"]);
    expect(find(b.payslip, "GROSS")).toMatchObject({ monthly: 30_000, annual: 360_000 });
    expect(find(b.payslip, "PAYE")!.monthly).toBe(3_149);
    expect(find(b.payslip, "TAKE_HOME")!.monthly).toBe(23_673.88);
    expect(sum(b.payslip, "monthly").toNumber()).toBe(23_673.88);
    expect(sum(b.payslip, "annual").toNumber()).toBe(find(b.payslip, "TAKE_HOME")!.annual);
  });

  it("income to tax, in order, ends at the year's final tax", () => {
    expect(b.tax.map((x) => x.id)).toEqual([
      "INCOME_GROSS",
      "RETIREMENT_DEDUCTION",
      "TAXABLE_INCOME",
      "TAX_BEFORE_REBATES",
      "REBATE_PRIMARY",
      "TAX_AFTER_REBATES",
      "CREDIT_6A",
      "TAX_FOR_YEAR",
    ]);
    expect(find(b.tax, "TAXABLE_INCOME")!.annual).toBe(324_000);
    expect(find(b.tax, "TAX_FOR_YEAR")!.annual).toBe(37_788);
  });

  it("filing: nothing owed or refunded when payroll got everything right", () => {
    expect(find(b.filing, "FILING_BALANCE")!.annual).toBe(0);
  });

  it("has no off-payslip items", () => {
    expect(b.offPayslip).toEqual([]);
  });
});

describe("breakdown: which rows appear", () => {
  const ids = (rows: BreakdownRow[]) => rows.map((x) => x.id);

  it("extras, travel, employer contributions, a second job, interest and donations each add a row", () => {
    const r = calc({
      mode: "GROSS",
      amount: 40_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 2_000, employerMonthly: 1_500 },
      medical: { member: true, members: 1, monthlyContribution: 4_000, paidBy: "SHARED", employerMonthly: 2_000 },
      variablePay: { bonusAnnual: 40_000 },
      advanced: {
        travelAllowanceMonthly: 5_000,
        localInterestAnnual: 50_000,
        donations18AAnnual: 6_000,
        hasSecondEmployer: true,
        secondEmployerAnnualGross: 300_000,
      },
    });
    const b = buildBreakdown(r);
    expect(ids(b.payslip)).toEqual(["GROSS", "EXTRAS", "TRAVEL", "RETIREMENT_OWN", "MEDICAL_OWN", "PAYE", "UIF", "TAKE_HOME"]);
    expect(ids(b.tax)).toEqual(expect.arrayContaining([
      "INCOME_EXTRAS", "INCOME_TRAVEL", "INCOME_EMPLOYER", "INCOME_OTHER_JOB", "INCOME_INTEREST", "DONATIONS_DEDUCTION", "RETIREMENT_DEDUCTION",
    ]));
    expect(ids(b.filing)).toContain("FILING_OTHER_EMPLOYER");
  });

  it("debit-order medical aid and RA are listed apart from the payslip, and not subtracted from take-home", () => {
    const r = calc({
      mode: "GROSS",
      amount: 30_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 0, employerMonthly: 0, privateRaMonthly: 2_000 },
      medical: { member: true, members: 1, monthlyContribution: 3_000, paidBy: "SELF", ownSharePaidVia: "DEBIT_ORDER" },
    });
    const b = buildBreakdown(r);
    expect(ids(b.payslip)).not.toContain("MEDICAL_OWN");
    expect(ids(b.payslip)).not.toContain("RETIREMENT_OWN");
    expect(b.offPayslip.map((x) => x.id)).toEqual(["MEDICAL_DEBIT_ORDER", "RA_DEBIT_ORDER"]);
    expect(find(b.offPayslip, "RA_DEBIT_ORDER")!.monthly).toBe(2_000);
    expect(sum(b.payslip, "monthly").toNumber()).toBe(r.takeHomeMonthly);
  });

  it("age rebates appear only for 65+ and 75+", () => {
    const base = { mode: "GROSS", amount: 40_000 } as const;
    expect(ids(buildBreakdown(calc({ ...base, ageBand: "UNDER_65" })).tax)).not.toContain("REBATE_SECONDARY");
    const older = ids(buildBreakdown(calc({ ...base, ageBand: "AGE_65_74" })).tax);
    expect(older).toContain("REBATE_SECONDARY");
    expect(older).not.toContain("REBATE_TERTIARY");
    expect(ids(buildBreakdown(calc({ ...base, ageBand: "AGE_75_PLUS" })).tax)).toEqual(expect.arrayContaining(["REBATE_SECONDARY", "REBATE_TERTIARY"]));
  });

  it("a low earner whose rebates exceed their tax gets an 'unused rebates' row, and the table still adds up", () => {
    const b = buildBreakdown(calc({ mode: "GROSS", amount: 6_000, ageBand: "UNDER_65" }));
    const unused = find(b.tax, "REBATE_UNUSED");
    expect(unused).toBeDefined();
    expect(find(b.tax, "TAX_AFTER_REBATES")!.annual).toBe(0);
    expect(sum(b.tax.filter((x) => ["TAX_BEFORE_REBATES", "REBATE_PRIMARY", "REBATE_UNUSED"].includes(x.id)).map((x) => (x.id === "TAX_BEFORE_REBATES" ? { ...x, kind: "add" as const } : x)), "annual").toNumber()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reconciliation across many generated inputs (PRD §14.2)
// ---------------------------------------------------------------------------

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const inputs = fc
  .record({
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
      // Whole rands: a taxable share of an odd-cents allowance can fall between cents.
      travelAllowanceMonthly: fc.integer({ min: 0, max: 15_000 }),
      travelBusinessUse: fc.double({ min: 0, max: 1, noNaN: true }),
      hasSecondEmployer: fc.boolean(),
      secondEmployerAnnualGross: money(500_000),
    }),
  })
  .map((i) => i as unknown as CalculationInputs);

describe("breakdown reconciles to the cent", () => {
  const run = (check: (b: ReturnType<typeof buildBreakdown>, r: ReturnType<typeof calc>) => void) =>
    fc.assert(
      fc.property(inputs, (i) => {
        const r = calc(i);
        check(buildBreakdown(r), r);
      }),
      { numRuns: 1500 },
    );

  it("gross − own deductions − PAYE − UIF = take-home, in the monthly column", () => {
    run((b, r) => {
      expect(sum(b.payslip, "monthly").toNumber()).toBe(r.takeHomeMonthly);
      expect(find(b.payslip, "TAKE_HOME")!.monthly).toBe(r.takeHomeMonthly);
    });
  });

  it("and in the annual column", () => {
    run((b, r) => {
      expect(sum(b.payslip, "annual").toNumber()).toBe(r.takeHomeAnnual);
    });
  });

  it("income − deductions = taxable income", () => {
    run((b, r) => {
      const income = b.tax.filter((x) => x.id.startsWith("INCOME_") || x.id.endsWith("_DEDUCTION"));
      expect(sum(income, "annual").toNumber()).toBe(r.taxableIncome);
    });
  });

  it("tax before rebates − rebates = tax after rebates; − credits = the year's tax", () => {
    run((b, r) => {
      const get = (id: string) => find(b.tax, id)?.annual ?? 0;
      const rebates = ["REBATE_PRIMARY", "REBATE_SECONDARY", "REBATE_TERTIARY"].reduce((s, id) => s.plus(get(id)), dec(0));
      expect(dec(get("TAX_BEFORE_REBATES")).minus(rebates).plus(get("REBATE_UNUSED")).toNumber()).toBe(get("TAX_AFTER_REBATES"));
      expect(dec(get("TAX_AFTER_REBATES")).minus(get("CREDIT_6A")).minus(get("CREDIT_6B")).toNumber()).toBe(get("TAX_FOR_YEAR"));
      expect(get("TAX_FOR_YEAR")).toBe(r.annualLiability);
    });
  });

  it("tax for the year − PAYE withheld − other employer's PAYE = the balance when filing", () => {
    run((b, r) => {
      expect(sum(b.filing, "annual").toNumber()).toBe(find(b.filing, "FILING_BALANCE")!.annual);
      expect(find(b.filing, "FILING_BALANCE")!.annual).toBe(r.filing.balanceAnnual);
    });
  });

  it("is built from the result alone: the same result gives the same tables", () => {
    run((b, r) => expect(buildBreakdown(r)).toEqual(b));
  });
});
