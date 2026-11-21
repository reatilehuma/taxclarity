import { Decimal, dec, toCents } from "./money.ts";
import type { CalculationResult } from "./types.ts";

/**
 * The results-page tables as data (PRD §14.2). Every figure here comes from the finished
 * calculation, so the page only has to show it. Amounts are always positive: `kind` says
 * whether a row is money in ("add"), money out ("less"), a running subtotal or the final line.
 */

export type BreakdownKind = "add" | "less" | "subtotal" | "total" | "memo";

export type BreakdownRowId =
  // From pay to the bank account
  | "GROSS"
  | "EXTRAS"
  | "TRAVEL"
  | "RETIREMENT_OWN"
  | "MEDICAL_OWN"
  | "PAYE"
  | "UIF"
  | "TAKE_HOME"
  // Paid by debit order (not on the payslip)
  | "MEDICAL_DEBIT_ORDER"
  | "RA_DEBIT_ORDER"
  // From income to final tax
  | "INCOME_GROSS"
  | "INCOME_EXTRAS"
  | "INCOME_TRAVEL"
  | "INCOME_EMPLOYER"
  | "INCOME_OTHER_JOB"
  | "INCOME_INTEREST"
  | "RETIREMENT_DEDUCTION"
  | "DONATIONS_DEDUCTION"
  | "TAXABLE_INCOME"
  | "TAX_BEFORE_REBATES"
  | "REBATE_PRIMARY"
  | "REBATE_SECONDARY"
  | "REBATE_TERTIARY"
  | "REBATE_UNUSED"
  | "TAX_AFTER_REBATES"
  | "CREDIT_6A"
  | "CREDIT_6B"
  | "TAX_FOR_YEAR"
  // Payroll versus final tax
  | "FILING_TAX"
  | "FILING_WITHHELD"
  | "FILING_OTHER_EMPLOYER"
  | "FILING_BALANCE";

export interface BreakdownRow {
  id: BreakdownRowId;
  kind: BreakdownKind;
  /** A normal month. Null where a monthly figure makes no sense (extras, annual tax working). */
  monthly: number | null;
  annual: number;
}

export interface Breakdown {
  /** From pay to the bank account. Adds up to take-home, in the monthly and in the annual column. */
  payslip: BreakdownRow[];
  /** Items paid by debit order: not on the payslip, shown so nothing looks missing. */
  offPayslip: BreakdownRow[];
  /** From income to the year's final tax. Annual only. */
  tax: BreakdownRow[];
  /** The year's final tax against what the employer withholds. A positive balance is owed, a negative one is a refund. */
  filing: BreakdownRow[];
}

const row = (id: BreakdownRowId, kind: BreakdownKind, annual: number, monthly: number | null = null): BreakdownRow => ({
  id,
  kind,
  monthly,
  annual,
});

/**
 * Each figure is rounded to the cent on its own, and a few (a share of taxable income, a credit that
 * can only be used up to the tax) fall between cents. So that every block adds up exactly as a person
 * would add it, the last line before a subtotal absorbs any difference. It is never more than a cent:
 * the subtotals themselves are always the engine's figures.
 */
function foot(rows: BreakdownRow[], startValue: number, fromIndex: number, toIndex: number): void {
  const target = rows[toIndex];
  if (!target || toIndex <= fromIndex) return;
  let running = dec(startValue);
  for (let i = fromIndex; i < toIndex; i++) {
    const x = rows[i]!;
    running = x.kind === "add" ? running.plus(x.annual) : running.minus(x.annual);
  }
  const drift = dec(target.annual).minus(running); // positive: the rows add up to too little
  if (drift.isZero() || drift.abs().greaterThan(0.02)) return;
  const last = rows[toIndex - 1]!;
  last.annual = toCents(last.kind === "add" ? dec(last.annual).plus(drift) : dec(last.annual).minus(drift));
}

export function buildBreakdown(r: CalculationResult): Breakdown {
  const payslip: BreakdownRow[] = [row("GROSS", "add", r.grossAnnual, r.grossMonthly)];
  if (r.variablePay.totalAnnual > 0) payslip.push(row("EXTRAS", "add", r.variablePay.totalAnnual));
  if (r.travel.allowanceAnnual > 0) payslip.push(row("TRAVEL", "add", r.travel.allowanceAnnual, r.travel.allowanceMonthly));
  if (r.ownRetirementAnnual > 0) payslip.push(row("RETIREMENT_OWN", "less", r.ownRetirementAnnual, r.ownRetirementMonthly));
  if (r.ownMedicalPaidVia === "PAYROLL" && r.ownMedicalAnnual > 0) {
    payslip.push(row("MEDICAL_OWN", "less", r.ownMedicalAnnual, r.ownMedicalMonthly));
  }
  payslip.push(row("PAYE", "less", r.annualPaye, r.monthlyPaye));
  payslip.push(row("UIF", "less", r.uifAnnual, r.uifMonthly));
  payslip.push(row("TAKE_HOME", "total", r.takeHomeAnnual, r.takeHomeMonthly));

  const offPayslip: BreakdownRow[] = [];
  if (r.ownMedicalPaidVia === "DEBIT_ORDER" && r.ownMedicalAnnual > 0) {
    offPayslip.push(row("MEDICAL_DEBIT_ORDER", "memo", r.ownMedicalAnnual, r.ownMedicalMonthly));
  }
  if (r.privateRaAnnual > 0) offPayslip.push(row("RA_DEBIT_ORDER", "memo", r.privateRaAnnual, r.privateRaMonthly));

  const tax: BreakdownRow[] = [row("INCOME_GROSS", "add", r.grossAnnual)];
  if (r.variablePay.totalAnnual > 0) tax.push(row("INCOME_EXTRAS", "add", r.variablePay.totalAnnual));
  if (r.travel.taxableAnnual > 0) tax.push(row("INCOME_TRAVEL", "add", r.travel.taxableAnnual));
  const employer = toCents(dec(r.employerRetirementAnnual).plus(r.employerMedicalAnnual));
  if (employer > 0) tax.push(row("INCOME_EMPLOYER", "add", employer));
  if (r.secondEmployer.grossAnnual > 0) tax.push(row("INCOME_OTHER_JOB", "add", r.secondEmployer.grossAnnual));
  if (r.interest.taxableAnnual > 0) tax.push(row("INCOME_INTEREST", "add", r.interest.taxableAnnual));
  if (r.retirement.deductionAnnual > 0) tax.push(row("RETIREMENT_DEDUCTION", "less", r.retirement.deductionAnnual));
  if (r.donations.deductionAnnual > 0) tax.push(row("DONATIONS_DEDUCTION", "less", r.donations.deductionAnnual));
  tax.push(row("TAXABLE_INCOME", "subtotal", r.taxableIncome));
  tax.push(row("TAX_BEFORE_REBATES", "subtotal", r.annualTaxBeforeRebates));
  tax.push(row("REBATE_PRIMARY", "less", r.rebates.primary));
  if (r.rebates.secondary > 0) tax.push(row("REBATE_SECONDARY", "less", r.rebates.secondary));
  if (r.rebates.tertiary > 0) tax.push(row("REBATE_TERTIARY", "less", r.rebates.tertiary));
  // Tax can't go below R0, so rebates bigger than the tax are only partly used.
  const unusedRebates = toCents(
    new Decimal(r.taxAfterRebates).minus(dec(r.annualTaxBeforeRebates).minus(r.rebates.total)),
  );
  if (unusedRebates > 0) tax.push(row("REBATE_UNUSED", "add", unusedRebates));
  tax.push(row("TAX_AFTER_REBATES", "subtotal", r.taxAfterRebates));
  if (r.medical6A.annualCredit > 0) tax.push(row("CREDIT_6A", "less", r.medical6A.appliedAnnual));
  if (r.medical6B.appliedAnnual > 0) tax.push(row("CREDIT_6B", "less", r.medical6B.appliedAnnual));
  tax.push(row("TAX_FOR_YEAR", "total", r.annualLiability));

  const at = (id: BreakdownRowId) => tax.findIndex((x) => x.id === id);
  foot(tax, 0, 0, at("TAXABLE_INCOME"));
  foot(tax, r.annualTaxBeforeRebates, at("TAX_BEFORE_REBATES") + 1, at("TAX_AFTER_REBATES"));
  foot(tax, r.taxAfterRebates, at("TAX_AFTER_REBATES") + 1, at("TAX_FOR_YEAR"));

  const filing: BreakdownRow[] = [
    row("FILING_TAX", "add", r.annualLiability),
    row("FILING_WITHHELD", "less", r.annualPaye),
  ];
  if (r.secondEmployer.estimatedPayeAnnual > 0) {
    filing.push(row("FILING_OTHER_EMPLOYER", "less", r.secondEmployer.estimatedPayeAnnual));
  }
  filing.push(row("FILING_BALANCE", "total", r.filing.balanceAnnual));

  return { payslip, offPayslip, tax, filing };
}
