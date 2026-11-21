import { buildBreakdown, calculate, getRuleSet, type CalculationInputs, type CalculationResult } from "@taxclarity/tax-engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildSummaryDocument } from "../build.ts";
import type { SummaryRow, SummaryTable } from "../types.ts";
import { FLAGS, FORMAT, SOURCE, TEXT } from "./fixtures.ts";

type Year = "2025-26" | "2026-27";
const YEARS: Year[] = ["2025-26", "2026-27"];
const build = (r: CalculationResult) => buildSummaryDocument({ result: r, text: TEXT, format: FORMAT, source: SOURCE, generatedOn: "2026-11-20" });
const run = (year: Year, inputs: Partial<CalculationInputs> = {}) =>
  calculate(getRuleSet(year), { taxYear: year, mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", ...inputs });
const table = (r: CalculationResult, id: SummaryTable["id"]) => build(r).tables.find((t) => t.id === id);
const row = (t: SummaryTable | undefined, id: string): SummaryRow => t!.rows.find((x) => x.id === id)!;
const cents = (n: number) => Math.round(n * 100);

const busy = (year: Year) =>
  run(year, {
    mode: "PAYSLIP",
    amount: 45_000,
    payslip: { payeMonthly: 9_000 },
    ageBand: "AGE_65_74",
    retirement: { ownMonthly: 3_000, employerMonthly: 1_000, privateRaMonthly: 1_500 },
    medical: { member: true, members: 3, monthlyContribution: 4_000, paidBy: "SELF", outOfPocketAnnual: 12_000, ownSharePaidVia: "DEBIT_ORDER" },
    variablePay: { bonusAnnual: 30_000, overtimeAnnual: 6_000 },
    advanced: { localInterestAnnual: 30_000, travelAllowanceMonthly: 3_000, donations18AAnnual: 5_000, has18AReceipt: true, hasSecondEmployer: true, secondEmployerAnnualGross: 120_000 },
  });

describe("which tables there are, and in what order", () => {
  it("a plain salary: income, deductions, tax, then the pay-to-bank table", () => {
    expect(build(run("2026-27")).tables.map((t) => t.id)).toEqual(["income", "deductions", "tax", "reconciliation"]);
  });
  it("everything filled in adds the payslip comparison and the debit-order table", () => {
    for (const year of YEARS) expect(build(busy(year)).tables.map((t) => t.id)).toEqual(["income", "deductions", "tax", "comparison", "reconciliation", "debitOrder"]);
  });
});

describe("Table 2: deductions", () => {
  it("lists only the deductions that apply, a total, and the engine's taxable income", () => {
    const plain = table(run("2026-27"), "deductions")!;
    expect(plain.rows.map((x) => x.id)).toEqual(["DEDUCTIONS_TOTAL", "TAXABLE_INCOME"]);
    const r = busy("2026-27");
    const t = table(r, "deductions")!;
    expect(t.rows.map((x) => x.id)).toEqual(["RETIREMENT_DEDUCTION", "DONATIONS_DEDUCTION", "DEDUCTIONS_TOTAL", "TAXABLE_INCOME"]);
    expect(row(t, "RETIREMENT_DEDUCTION").value).toBe(r.retirement.deductionAnnual);
    expect(row(t, "DONATIONS_DEDUCTION").value).toBe(r.donations.deductionAnnual);
    expect(row(t, "TAXABLE_INCOME")).toMatchObject({ value: r.taxableIncome, emphasis: "highlight" });
  });
  it("says that payroll deductions such as medical aid are not deductions", () => {
    expect(table(run("2026-27"), "deductions")!.notes.join(" ")).toMatch(/medical aid/);
  });
});

describe("Table 3: tax calculation", () => {
  it("ends the working on the calculated annual liability, highlighted, and never calls it a refund or a payment", () => {
    for (const year of YEARS) {
      const r = busy(year);
      const t = table(r, "tax")!;
      expect(row(t, "TAX_FOR_YEAR")).toMatchObject({ label: "Calculated annual income-tax liability", value: r.annualLiability, emphasis: "highlight" });
      // The disclaimer itself says the tool does not establish an amount payable or refundable: that is the rule, not a breach of it.
      const d = build(r);
      const everything = JSON.stringify([d.tables, d.comparisonVerdict, d.notices]).toLowerCase();
      expect(everything).not.toMatch(/refund|payable|you owe|you will get back|you will receive/);
    }
  });
  it("shows an age rebate only for the age groups that have one", () => {
    expect(table(run("2026-27"), "tax")!.rows.map((x) => x.id)).not.toContain("REBATE_SECONDARY");
    expect(table(run("2026-27", { ageBand: "AGE_65_74" }), "tax")!.rows.map((x) => x.id)).toContain("REBATE_SECONDARY");
    expect(table(run("2026-27", { ageBand: "AGE_75_PLUS" }), "tax")!.rows.map((x) => x.id)).toEqual(expect.arrayContaining(["REBATE_SECONDARY", "REBATE_TERTIARY"]));
  });
  it("every monthly row says so, and the payslip's PAYE appears only when it was given", () => {
    const r = busy("2026-27");
    const t = table(r, "tax")!;
    expect(row(t, "PAYE_MONTH")).toMatchObject({ value: r.monthlyPaye });
    expect(row(t, "PAYSLIP_PAYE_MONTH")).toMatchObject({ value: r.comparison!.payslipPaye });
    expect(row(t, "UIF_MONTH").value).toBe(r.uifMonthly);
    expect(row(t, "TAKE_HOME_MONTH").value).toBe(r.takeHomeMonthly);
    expect(row(t, "TAKE_HOME_YEAR").value).toBe(r.takeHomeAnnual);
    for (const x of t.rows.filter((x) => /_MONTH$/.test(x.id))) expect(x.label, x.id).toMatch(/per month/);
    expect(table(run("2026-27"), "tax")!.rows.map((x) => x.id)).not.toContain("PAYSLIP_PAYE_MONTH");
  });
  it("explains a medical credit that could not be used", () => {
    const r = run("2026-27", { amount: 9_000, medical: { member: true, members: 4, monthlyContribution: 3_000, paidBy: "SELF" } });
    expect(r.medical6A.unusedAnnual).toBeGreaterThan(0);
    expect(table(r, "tax")!.notes[0]).toContain(FORMAT.rand(r.medical6A.unusedAnnual));
  });
});

describe("the payslip comparison (PRD §14.4)", () => {
  it("is there only when a payslip's PAYE was given", () => {
    expect(table(run("2026-27"), "comparison")).toBeUndefined();
    expect(build(run("2026-27")).comparisonVerdict).toBeNull();
    expect(table(busy("2026-27"), "comparison")).toBeDefined();
  });
  it("holds the engine's four figures and a neutral verdict", () => {
    for (const year of YEARS) {
      const r = busy(year);
      const c = r.comparison!;
      const t = table(r, "comparison")!;
      expect(t.rows.map((x) => x.value)).toEqual([c.payslipPaye, c.calcPaye, c.payslipUif, c.calcUif]);
      const v = build(r).comparisonVerdict!;
      expect(v.verdict).toMatch(c.closeMatch ? /match/ : c.diff > 0 ? /higher/ : /lower/);
      expect(v.explain).not.toMatch(/refund|owe/i);
    }
  });
  it("says 'match' within R1, 'higher' and 'lower' otherwise", () => {
    const base = run("2026-27", { mode: "PAYSLIP", payslip: { payeMonthly: 1 } });
    const exact = run("2026-27", { mode: "PAYSLIP", payslip: { payeMonthly: base.comparison!.calcPaye } });
    expect(build(exact).comparisonVerdict!.verdict).toBe("These match, to within R1.");
    const high = run("2026-27", { mode: "PAYSLIP", payslip: { payeMonthly: exact.comparison!.calcPaye + 500 } });
    expect(build(high).comparisonVerdict!.verdict).toMatch(/^Your payslip PAYE is R.500,00 \(.*\) higher/);
    expect(build(base).comparisonVerdict!.verdict).toMatch(/lower than our calculation/);
  });
});

describe("the reconciliation: salary to bank account, a normal month beside the whole year", () => {
  it("has the engine's rows with both columns, and a dash where one month makes no sense", () => {
    const r = busy("2026-27");
    const t = table(r, "reconciliation")!;
    const engine = buildBreakdown(r).payslip;
    expect(t.rows.map((x) => x.id)).toEqual(engine.map((x) => x.id));
    expect(t.rows.map((x) => x.value)).toEqual(engine.map((x) => x.annual));
    expect(t.rows.map((x) => x.month?.value ?? null)).toEqual(engine.map((x) => x.monthly));
    expect(row(t, "EXTRAS").month).toBeNull();
    expect(row(t, "TAKE_HOME")).toMatchObject({ value: r.takeHomeAnnual, emphasis: "highlight" });
    expect(row(t, "TAKE_HOME").month!.value).toBe(r.takeHomeMonthly);
    expect(t.columns).toMatchObject({ month: "A normal month", amount: "Whole year" });
  });
  it("explains what a normal month leaves out, only when there is bonus, overtime or commission", () => {
    expect(table(busy("2026-27"), "reconciliation")!.notes.join(" ")).toMatch(/normal month leaves out/);
    expect(table(run("2026-27"), "reconciliation")!.notes).toEqual([]);
  });
  it("shows what is paid by debit order apart from the payslip", () => {
    const t = table(busy("2026-27"), "debitOrder")!;
    expect(t.rows.map((x) => x.id)).toEqual(["MEDICAL_DEBIT_ORDER", "RA_DEBIT_ORDER"]);
    expect(table(run("2026-27"), "debitOrder")).toBeUndefined();
  });
});

describe("flags, assumptions and warnings", () => {
  it("lists the engine's flags with the source written out as text", () => {
    const r = busy("2026-27");
    const list = build(r).notices.find((n) => n.id === "flags")!;
    expect(list.items).toHaveLength(r.flags.length);
    r.flags.forEach((f, i) => {
      expect(list.items[i]!.title).toBe(`Title for ${f.code}`);
      expect(list.items[i]!.source).toBe(`Read more: Source ${f.source} · https://example.org/${f.source}`);
    });
    expect(FLAGS.length).toBe(15);
  });
  it("lists assumptions and warnings only when there are some", () => {
    expect(build(run("2026-27")).notices.map((n) => n.id)).toEqual(["flags"]);
    expect(build(run("2026-27", { mode: "TAKE_HOME" })).notices.map((n) => n.id)).toEqual(["assumptions", "flags"]);
    expect(build(busy("2026-27")).notices.map((n) => n.id)).toContain("assumptions");
  });
});

/** Inputs across every mode, a spread of pay and every extra, in both years. */
const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
const anyCalculation = fc.record({
  year: fc.constantFrom(...YEARS),
  mode: fc.constantFrom("GROSS", "TAKE_HOME", "PAYSLIP"),
  amount: money(250_000),
  ageBand: fc.constantFrom("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
  payslip: fc.record({ payeMonthly: money(60_000) }),
  retirement: fc.record({ ownMonthly: money(15_000), employerMonthly: money(15_000), privateRaMonthly: money(10_000) }),
  medical: fc.record({ member: fc.boolean(), members: fc.integer({ min: 1, max: 8 }), monthlyContribution: money(10_000), paidBy: fc.constantFrom("SELF", "EMPLOYER", "SHARED"), employerMonthly: money(5_000), outOfPocketAnnual: money(60_000), ownSharePaidVia: fc.constantFrom("PAYROLL", "DEBIT_ORDER") }),
  variablePay: fc.record({ bonusAnnual: money(200_000), overtimeAnnual: money(50_000), commissionAnnual: money(100_000) }),
  advanced: fc.record({ localInterestAnnual: money(100_000), travelAllowanceMonthly: money(10_000), hasSecondEmployer: fc.boolean(), secondEmployerAnnualGross: money(300_000), donations18AAnnual: money(80_000), has18AReceipt: fc.boolean() }),
});
const calc = ({ year, ...rest }: fc.Arbitrary<unknown> extends never ? never : { year: Year } & Record<string, unknown>) =>
  calculate(getRuleSet(year), { ...(rest as unknown as CalculationInputs), taxYear: year });

describe("every table agrees with the engine and adds up, for any calculation (PRD §14.8: within R0,01)", () => {
  it("both years, all three modes", () => {
    fc.assert(
      fc.property(anyCalculation, (input) => {
        const r = calc(input as never);
        const d = build(r);
        const by = (id: SummaryTable["id"]) => d.tables.find((t) => t.id === id);
        const near = (a: number, b: number, what: string) => expect(Math.abs(cents(a) - cents(b)), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(1);

        // Every row's text is its number, formatted as on screen.
        for (const t of d.tables) for (const x of t.rows) expect(x.amount.replace(/^[−+] /, ""), `${t.id}.${x.id}`).toBe(FORMAT.rand(x.value));

        // Table 1 → Table 2 → taxable income.
        const income = by("income")!;
        const ded = by("deductions")!;
        const deductions = ded.rows.filter((x) => x.id.endsWith("_DEDUCTION")).reduce((s, x) => s + cents(x.value), 0);
        expect(row(ded, "DEDUCTIONS_TOTAL").value).toBe(deductions / 100);
        near(row(income, "INCOME_TOTAL").value - row(ded, "DEDUCTIONS_TOTAL").value, row(ded, "TAXABLE_INCOME").value, "income − deductions = taxable income");
        expect(row(ded, "TAXABLE_INCOME").value).toBe(r.taxableIncome);

        // Table 3: tax before rebates − rebates (+ unused) = tax after; − credits = liability.
        const tax = by("tax")!;
        const v = (id: string) => tax.rows.find((x) => x.id === id)?.value ?? 0;
        near(v("TAX_BEFORE_REBATES") - v("REBATE_PRIMARY") - v("REBATE_SECONDARY") - v("REBATE_TERTIARY") + v("REBATE_UNUSED"), v("TAX_AFTER_REBATES"), "rebates");
        near(v("TAX_AFTER_REBATES") - v("CREDIT_6A") - v("CREDIT_6B"), v("TAX_FOR_YEAR"), "credits");
        expect(v("TAX_FOR_YEAR")).toBe(r.annualLiability);

        // Reconciliation: gross + extras + travel − own retirement − own medical − PAYE − UIF = take-home, in both columns.
        const rec = by("reconciliation")!;
        const sum = (pick: (x: SummaryRow) => number) =>
          rec.rows.filter((x) => x.id !== "TAKE_HOME").reduce((s, x) => s + (["GROSS", "EXTRAS", "TRAVEL"].includes(x.id) ? 1 : -1) * pick(x), 0);
        near(sum((x) => x.value), row(rec, "TAKE_HOME").value, "whole year");
        near(sum((x) => x.month?.value ?? 0), row(rec, "TAKE_HOME").month!.value, "a normal month");
      }),
      { numRuns: 400 },
    );
  });
});
