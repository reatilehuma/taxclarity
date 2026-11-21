import { buildBreakdown, calculate, getRuleSet, RULE_SETS, type CalculationInputs, type CalculationResult } from "@taxclarity/tax-engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildSummaryDocument, summaryFileName } from "../build.ts";
import { FORMAT, SOURCE, TEXT } from "./fixtures.ts";

const build = (r: CalculationResult, generatedOn = "2026-11-20") => buildSummaryDocument({ result: r, text: TEXT, format: FORMAT, source: SOURCE, generatedOn });
const run = (year: "2025-26" | "2026-27", inputs: Partial<CalculationInputs> = {}) =>
  calculate(getRuleSet(year), { taxYear: year, mode: "GROSS", amount: 30_000, ageBand: "UNDER_65", ...inputs });
const rowsOf = (r: CalculationResult) => build(r).tables[0]!.rows;
const ids = (r: CalculationResult) => rowsOf(r).map((x) => x.id);

describe("the header and details (PRD §14.8)", () => {
  it("has the required title and subtitle, and says whose it is only by the app's name", () => {
    const d = build(run("2026-27"));
    expect(d.title).toBe("South African Income Tax — Calculation Summary");
    expect(d.subtitle).toBe("Independent estimate — not a SARS assessment");
    expect(d.productName).toBe("ClearTax SA");
  });

  it.each(RULE_SETS.map((r) => [r.label, r] as const))("%s: year, period, date made, how it was started and how sure it is", (label, rules) => {
    const rows = Object.fromEntries(build(run(rules.taxYear)).details.rows.map((r) => [r.label, r.value]));
    expect(rows["Tax year"]).toBe(label);
    expect(rows["Period"]).toBe(`${FORMAT.date(rules.startDate)} – ${FORMAT.date(rules.endDate)}`);
    expect(rows["Date generated"]).toBe("20 November 2026");
    expect(rows["Calculation based on"]).toBe("Gross salary");
    expect(rows["Confidence"]).toBe("Payslip-based calculation");
  });

  it("describes each way of starting and each level of confidence", () => {
    const detail = (r: CalculationResult, label: string) => build(r).details.rows.find((x) => x.label === label)!.value;
    expect(detail(run("2026-27", { mode: "TAKE_HOME" }), "Calculation based on")).toBe("Bank deposit (gross salary estimated)");
    expect(detail(run("2026-27", { mode: "TAKE_HOME" }), "Confidence")).toBe("Estimate");
    expect(detail(run("2026-27", { mode: "PAYSLIP", payslip: { payeMonthly: 4_000 } }), "Calculation based on")).toBe("Payslip");
  });

  it("holds no reference number, ID, name or other way to identify the person", () => {
    const d = build(run("2026-27", { variablePay: { bonusAnnual: 20_000 } }));
    const everything = JSON.stringify([d.details, d.tables.map((t) => t.rows.map((r) => r.label)), d.meta]).toLowerCase();
    for (const word of ["reference", "id number", "tax number", "surname", "email", "sars ref", "passport"]) expect(everything, word).not.toContain(word);
    expect(d.details.rows).toHaveLength(5);
  });

  it("the date generated is the day given, not a clock reading", () => {
    expect(build(run("2026-27"), "2027-02-28").details.rows.find((r) => r.label === "Date generated")!.value).toBe("28 February 2027");
  });

  it("the footer carries the rules version and when the figures were last checked, from the result", () => {
    for (const rules of RULE_SETS) {
      const r = run(rules.taxYear);
      expect(build(r).footer.rules).toBe(`Rules ${rules.rulesVersion} · figures last checked ${FORMAT.date(rules.lastVerified)}`);
      expect(r.provenance.rulesVersion).toBe(rules.rulesVersion);
    }
    expect(build(run("2026-27")).footer.page(2, 3)).toBe("Page 2 of 3");
  });

  it("the file's own title and creator are the document title and the app name", () => {
    expect(build(run("2026-27")).meta).toEqual({ title: TEXT.title, creator: "ClearTax SA" });
  });
});

describe("Table 1: income and taxable amounts", () => {
  it("a plain salary has one income row and the total", () => {
    const r = run("2026-27");
    expect(ids(r)).toEqual(["INCOME_GROSS", "INCOME_TOTAL"]);
    expect(rowsOf(r)[0]).toMatchObject({ label: "Gross remuneration", value: 360_000, amount: FORMAT.rand(360_000) });
    expect(rowsOf(r)[1]).toMatchObject({ label: "Total income", value: 360_000, emphasis: "total" });
  });

  it("each kind of income appears only when the calculation has some", () => {
    expect(ids(run("2026-27", { variablePay: { bonusAnnual: 30_000 } }))).toEqual(["INCOME_GROSS", "INCOME_EXTRAS", "INCOME_TOTAL"]);
    expect(ids(run("2026-27", { advanced: { travelAllowanceMonthly: 3_000 } }))).toEqual(["INCOME_GROSS", "INCOME_TRAVEL", "INCOME_TOTAL"]);
    expect(ids(run("2026-27", { retirement: { ownMonthly: 0, employerMonthly: 1_000 } }))).toEqual(["INCOME_GROSS", "INCOME_EMPLOYER", "INCOME_TOTAL"]);
    expect(ids(run("2026-27", { advanced: { hasSecondEmployer: true, secondEmployerAnnualGross: 120_000 } }))).toEqual(["INCOME_GROSS", "INCOME_OTHER_JOB", "INCOME_TOTAL"]);
    // Interest only counts above the tax-free amount: R20 000 is under it, R30 000 is not.
    expect(ids(run("2026-27", { advanced: { localInterestAnnual: 20_000 } }))).toEqual(["INCOME_GROSS", "INCOME_TOTAL"]);
    expect(ids(run("2026-27", { advanced: { localInterestAnnual: 30_000 } }))).toEqual(["INCOME_GROSS", "INCOME_INTEREST", "INCOME_TOTAL"]);
  });

  it("holds no deduction, tax, credit or take-home row: those are other tables", () => {
    const r = run("2026-27", { retirement: { ownMonthly: 3_000, employerMonthly: 1_000 }, medical: { member: true, members: 2, monthlyContribution: 0, paidBy: "SELF" }, advanced: { donations18AAnnual: 5_000, has18AReceipt: true } });
    for (const id of ids(r)) expect(id).toMatch(/^INCOME_/);
  });

  it("every row is the engine's own row, in the order the results page shows them", () => {
    const r = run("2026-27", { variablePay: { bonusAnnual: 30_000 }, advanced: { travelAllowanceMonthly: 3_000, localInterestAnnual: 30_000 }, retirement: { ownMonthly: 3_000, employerMonthly: 1_000 } });
    const engine = buildBreakdown(r).tax.filter((x) => x.id.startsWith("INCOME_"));
    const mine = rowsOf(r).slice(0, -1);
    expect(mine.map((x) => x.id)).toEqual(engine.map((x) => x.id));
    expect(mine.map((x) => x.value)).toEqual(engine.map((x) => x.annual));
    expect(mine.map((x) => x.amount)).toEqual(engine.map((x) => FORMAT.rand(x.annual)));
    expect(rowsOf(r).at(-1)!.value).toBe(r.incomeBeforeDeductions);
  });

  it("both years give each person their own year's figures (the second job, taxed differently)", () => {
    const a = rowsOf(run("2025-26", { variablePay: { bonusAnnual: 30_000 } }));
    const b = rowsOf(run("2026-27", { variablePay: { bonusAnnual: 30_000 } }));
    expect(a.map((x) => x.value)).toEqual(b.map((x) => x.value)); // income is what was earned: the same in both years
    expect(build(run("2025-26")).details.rows[0]!.value).toBe("2025/26");
    expect(build(run("2026-27")).details.rows[0]!.value).toBe("2026/27");
  });

  it("the rows add up to the total exactly, for any calculation, in both years", () => {
    const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((c) => c / 100);
    const inputs = fc.record({
      year: fc.constantFrom("2025-26", "2026-27"),
      mode: fc.constantFrom("GROSS", "TAKE_HOME"),
      amount: money(250_000),
      ageBand: fc.constantFrom("UNDER_65", "AGE_65_74", "AGE_75_PLUS"),
      retirement: fc.record({ ownMonthly: money(15_000), employerMonthly: money(15_000) }),
      medical: fc.record({ member: fc.boolean(), members: fc.integer({ min: 1, max: 8 }), monthlyContribution: money(10_000), paidBy: fc.constantFrom("SELF", "EMPLOYER", "SHARED"), employerMonthly: money(5_000) }),
      variablePay: fc.record({ bonusAnnual: money(200_000), overtimeAnnual: money(50_000), commissionAnnual: money(100_000) }),
      advanced: fc.record({ localInterestAnnual: money(100_000), travelAllowanceMonthly: money(10_000), hasSecondEmployer: fc.boolean(), secondEmployerAnnualGross: money(300_000) }),
    });
    fc.assert(
      fc.property(inputs, ({ year, ...rest }) => {
        const r = calculate(getRuleSet(year), { ...(rest as unknown as CalculationInputs), taxYear: year });
        const rows = rowsOf(r);
        const total = rows.at(-1)!;
        const sum = rows.slice(0, -1).reduce((s, x) => s + Math.round(x.value * 100), 0);
        // The PRD allows R0,01 of difference; in practice there is none, and a table that is a cent out looks wrong on paper.
        expect(sum, `rows ${sum} vs total ${Math.round(total.value * 100)}`).toBe(Math.round(total.value * 100));
        expect(total.value).toBe(r.incomeBeforeDeductions);
        for (const x of rows) expect(x.amount).toBe(FORMAT.rand(x.value));
      }),
      { numRuns: 500 },
    );
  });
});

describe("the file name", () => {
  it("is the product, the tax year and the day it was made", () => {
    expect(summaryFileName(TEXT.filenamePrefix, "2026-27", "2026-11-20")).toBe("cleartax-sa-summary-2026-27-2026-11-20.pdf");
    expect(summaryFileName(TEXT.filenamePrefix, "2025-26", "2027-02-28")).toBe("cleartax-sa-summary-2025-26-2027-02-28.pdf");
  });
});
