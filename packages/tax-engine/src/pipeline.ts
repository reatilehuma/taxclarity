import { medical6AAnnual } from "./medical.ts";
import { type Decimal, ZERO, maxD, minD, round2 } from "./money.ts";
import type { NormalisedInputs } from "./normalise.ts";
import { type RetirementCalc, retirementDeduction } from "./retirement.ts";
import { taxAfterRebates, taxBeforeRebates } from "./tax.ts";
import type { TaxRuleSet } from "./types.ts";
import { uifMonthly } from "./uif.ts";

/**
 * Shared building blocks of the PRD §10.3 pipeline, used by the main
 * calculation and by the take-home solver. All values are full precision.
 *
 * Two views of the same year:
 * - PAYROLL: what this employer sees — salary, extras, fringe benefits, the taxable part of the
 *   travel allowance, payslip retirement contributions. This sets the PAYE withheld.
 * - FULL: adds private RA, donations, interest and income from another employer. This sets the
 *   final tax for the year.
 */
export type View = "PAYROLL" | "FULL";

export interface DonationsCalc {
  capAnnual: Decimal;
  deductionAnnual: Decimal;
  carryForwardAnnual: Decimal;
}

export interface AnnualPosition {
  view: View;
  /** Every income item included in this view, before deductions. */
  income: Decimal;
  /** Income that counts as remuneration for the Section 11F test (everything except interest). */
  remuneration: Decimal;
  ownRetirementAnnual: Decimal;
  privateRaAnnual: Decimal;
  employerRetirementAnnual: Decimal;
  employerMedicalAnnual: Decimal;
  travelTaxableAnnual: Decimal;
  interestTaxableAnnual: Decimal;
  secondEmployerAnnual: Decimal;
  retirement: RetirementCalc;
  donations: DonationsCalc;
  taxable: Decimal;
  taxBefore: Decimal;
  afterRebates: Decimal;
}

/** Share of a fixed travel allowance that is taxable (PRD §6.12). */
export function travelTaxableRate(rules: TaxRuleSet, n: NormalisedInputs): number {
  const t = rules.travel;
  return n.advanced.travelBusinessUse >= t.businessUseThreshold ? t.taxableBusinessRate : t.taxableDefaultRate;
}

export function interestExemptionFor(rules: TaxRuleSet, n: NormalisedInputs): number {
  return n.ageBand === "UNDER_65" ? rules.interestExemption.under65 : rules.interestExemption.age65plus;
}

/** Steps C–G for a given annual cash salary and variable pay, in one view. */
export function annualPosition(
  rules: TaxRuleSet,
  n: NormalisedInputs,
  grossAnnual: Decimal,
  variableAnnual: Decimal,
  view: View,
): AnnualPosition {
  const months = rules.monthsPerYear;
  const full = view === "FULL";

  const ownRetirementAnnual = n.retirement.ownMonthly.times(months);
  const privateRaAnnual = full ? n.retirement.privateRaMonthly.times(months) : ZERO;
  const employerRetirementAnnual = n.retirement.employerMonthly.times(months);
  const employerMedicalAnnual = n.medical.employerMonthly.times(n.medical.monthsCovered);
  const travelTaxableAnnual = n.advanced.travelAllowanceMonthly.times(months).times(travelTaxableRate(rules, n));
  const interestTaxableAnnual = full
    ? maxD(n.advanced.localInterestAnnual.minus(interestExemptionFor(rules, n)), ZERO)
    : ZERO;
  const secondEmployerAnnual = full ? n.advanced.secondEmployerAnnual : ZERO;

  // Step C — income.
  const remuneration = grossAnnual
    .plus(variableAnnual)
    .plus(employerRetirementAnnual)
    .plus(employerMedicalAnnual)
    .plus(travelTaxableAnnual)
    .plus(secondEmployerAnnual);
  const income = remuneration.plus(interestTaxableAnnual);

  // Step D — Section 11F, tested on income before the deduction (no capital gains in scope).
  const retirement = retirementDeduction(rules, {
    ownAnnual: ownRetirementAnnual.plus(privateRaAnnual),
    employerAnnual: employerRetirementAnnual,
    remunerationAnnual: remuneration,
    taxableBeforeDeductionAnnual: income,
  });
  const afterRetirement = maxD(income.minus(retirement.deductionAnnual), ZERO);

  // Step E — Section 18A donations: up to 10% of taxable income before the donation.
  const given = full ? n.advanced.donationsAnnual : ZERO;
  const capAnnual = afterRetirement.times(rules.donations18A.limitRate);
  const donationDeduction = minD(given, capAnnual);
  const donations = {
    capAnnual,
    deductionAnnual: donationDeduction,
    carryForwardAnnual: given.minus(donationDeduction),
  };

  // Steps F–G — taxable income (never below R0), bracket tax and rebates.
  const taxable = maxD(afterRetirement.minus(donationDeduction), ZERO);

  return {
    view,
    income,
    remuneration,
    ownRetirementAnnual,
    privateRaAnnual,
    employerRetirementAnnual,
    employerMedicalAnnual,
    travelTaxableAnnual,
    interestTaxableAnnual,
    secondEmployerAnnual,
    retirement,
    donations,
    taxable,
    taxBefore: taxBeforeRebates(rules, taxable),
    afterRebates: taxAfterRebates(rules, taxable, n.ageBand),
  };
}

/** The medical credit payroll applies during the year (none for debit-order-only cases). */
export function payrollCreditAnnual(rules: TaxRuleSet, n: NormalisedInputs): Decimal {
  return n.medical.payrollAppliesCredit ? medical6AAnnual(rules, n.medical.members, n.medical.monthsCovered) : ZERO;
}

/** Own medical aid that comes off the payslip, per month (0 when paid by debit order). */
export function ownMedicalPayrollMonthly(rules: TaxRuleSet, n: NormalisedInputs): Decimal {
  if (n.medical.ownPaidVia === "DEBIT_ORDER") return ZERO;
  return round2(n.medical.ownMonthly.times(n.medical.monthsCovered).dividedBy(rules.monthsPerYear));
}

export interface RegularMonth {
  position: AnnualPosition;
  /** PAYE payroll withholds over a year of regular months, full precision. */
  withheldAnnual: Decimal;
  paye: Decimal;
  uif: Decimal;
  takeHome: Decimal;
}

/**
 * A normal month with no bonus (D4), as payroll sees it:
 * take-home = cash salary + travel allowance − own retirement − own medical (payroll) − PAYE − UIF.
 */
export function regularMonth(rules: TaxRuleSet, n: NormalisedInputs, grossAnnual: Decimal): RegularMonth {
  const months = rules.monthsPerYear;
  const grossMonthly = grossAnnual.dividedBy(months);
  const position = annualPosition(rules, n, grossAnnual, ZERO, "PAYROLL");
  const withheldAnnual = maxD(position.afterRebates.minus(payrollCreditAnnual(rules, n)), ZERO);
  const paye = round2(withheldAnnual.dividedBy(months));
  const uif = uifMonthly(rules, grossMonthly);
  const takeHome = round2(grossMonthly)
    .plus(round2(n.advanced.travelAllowanceMonthly))
    .minus(round2(n.retirement.ownMonthly))
    .minus(ownMedicalPayrollMonthly(rules, n))
    .minus(paye)
    .minus(uif);
  return { position, withheldAnnual, paye, uif, takeHome };
}

/**
 * PAYE another employer would withhold on its own (E10): tax on that income alone,
 * after rebates. An estimate — the real figure depends on that payroll.
 */
export function secondEmployerPaye(rules: TaxRuleSet, n: NormalisedInputs): Decimal {
  const annual = n.advanced.secondEmployerAnnual;
  if (annual.isZero()) return ZERO;
  return taxAfterRebates(rules, annual, n.ageBand);
}

