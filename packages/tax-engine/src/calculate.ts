import { buildFlags } from "./flags.ts";
import { TaxYearError } from "./rulesets/errors.ts";
import { medical6AAnnual, medical6AMonthly, medical6B, medical6BBranch } from "./medical.ts";
import { type Decimal, ZERO, dec, maxD, minD, round2, toCents } from "./money.ts";
import { normalise } from "./normalise.ts";
import {
  annualPosition,
  interestExemptionFor,
  ownMedicalPayrollMonthly,
  payrollCreditAnnual,
  regularMonth,
  secondEmployerPaye,
  travelTaxableRate,
} from "./pipeline.ts";
import { solveGrossFromTakeHome } from "./solver.ts";
import { bracketWalk, findBracketIndex, rebatesFor, thresholdFor } from "./tax.ts";
import type {
  CalculationInputs,
  CalculationResult,
  EstimateDetails,
  NoteCode,
  PayslipComparison,
  TaxRuleSet,
  WarningCode,
} from "./types.ts";
import { uifMonthly } from "./uif.ts";

/**
 * Engine pipeline (PRD §10.3):
 * normalise → (take-home → gross estimate) → income in the PAYROLL and FULL views →
 * Section 11F → Section 18A → taxable income → bracket tax → rebates → Sections 6A/6B →
 * PAYE (normal month and with extras) → UIF → take-home → filing balance →
 * payslip comparison → flags.
 *
 * Pure and deterministic: never reads the clock, never throws on bad input.
 */
export function calculate(rules: TaxRuleSet, inputs: CalculationInputs): CalculationResult {
  assertSameYear(rules, inputs);
  const months = rules.monthsPerYear;
  const n = normalise(inputs);
  const applied: string[] = ["brackets", "rebates.primary", "thresholds", "uif"];
  const notes: NoteCode[] = [];
  const warnings: WarningCode[] = [];

  // Steps A/B — the monthly cash salary, stated or estimated from take-home.
  let grossAnnual: Decimal;
  let estimate: EstimateDetails | undefined;
  if (n.mode === "TAKE_HOME") {
    const targetMonthly = n.amountPerPeriod.times(n.periodsPerYear).dividedBy(months);
    const solved = solveGrossFromTakeHome(rules, n, targetMonthly);
    grossAnnual = solved.grossMonthly.times(months);
    estimate = { targetPerPeriod: toCents(n.amountPerPeriod), ...solved.details };
    notes.push("ESTIMATED_FROM_TAKE_HOME");
    applied.push("solver.takeHomeToGross");
  } else {
    grossAnnual = n.amountPerPeriod.times(n.periodsPerYear);
  }
  const grossMonthly = grossAnnual.dividedBy(months);
  if (n.payFrequency !== "MONTHLY") applied.push(`payFrequency.${n.payFrequency.toLowerCase()}`);

  // Payroll's view: a normal month (D4) and the year with extras.
  const variableAnnual = n.variable.totalAnnual;
  const regular = regularMonth(rules, n, grossAnnual);
  const payrollYear = annualPosition(rules, n, grossAnnual, variableAnnual, "PAYROLL");
  const withheldAnnual = maxD(payrollYear.afterRebates.minus(payrollCreditAnnual(rules, n)), ZERO);
  const variableTax = maxD(withheldAnnual.minus(regular.withheldAnnual), ZERO);

  // The full year: final tax.
  const year = annualPosition(rules, n, grossAnnual, variableAnnual, "FULL");
  const rebates = rebatesFor(rules, n.ageBand);

  // Step H — Section 6A, then Section 6B. Both non-refundable.
  const s6aAnnual = medical6AAnnual(rules, n.medical.members, n.medical.monthsCovered);
  const after6A = maxD(year.afterRebates.minus(s6aAnnual), ZERO);
  const s6aApplied = year.afterRebates.minus(after6A);

  const contributionsAnnual = n.medical.ownMonthly.plus(n.medical.employerMonthly).times(n.medical.monthsCovered);
  const oop = n.medical.outOfPocketAnnual;
  // A credit is a whole number of cents, so the tax after it foots on the page.
  const s6bAnnual =
    oop === null
      ? ZERO
      : round2(medical6B(rules, {
          ageBand: n.ageBand,
          disabilityInFamily: n.medical.disabilityInFamily,
          contributionsAnnual,
          s6aAnnual,
          outOfPocketAnnual: oop,
          taxableIncome: year.taxable,
        }));
  const liability = maxD(after6A.minus(s6bAnnual), ZERO);
  const s6bApplied = after6A.minus(liability);

  // Filing: final tax − PAYE from this employer − estimated PAYE from another employer.
  const otherPaye = secondEmployerPaye(rules, n);
  // Worked from the cent-rounded figures the results show, so the table foots exactly (PRD §14.2).
  const filingBalance = round2(liability).minus(round2(withheldAnnual)).minus(round2(otherPaye));

  // Steps I/J — UIF, averaged month and year (including extras and the travel allowance).
  const travelMonthly = round2(n.advanced.travelAllowanceMonthly);
  const travelAnnual = n.advanced.travelAllowanceMonthly.times(months);
  const ownRetirementMonthly = round2(n.retirement.ownMonthly);
  const ownMedicalPayroll = ownMedicalPayrollMonthly(rules, n);
  const ownMedicalAnnual = n.medical.ownMonthly.times(n.medical.monthsCovered);
  const ownMedicalPayrollAnnual = n.medical.ownPaidVia === "PAYROLL" ? ownMedicalAnnual : ZERO;
  const variableMonthly = round2(variableAnnual.dividedBy(months));
  const payeAverage = round2(withheldAnnual.dividedBy(months));
  const uifAverage = uifMonthly(rules, grossMonthly.plus(variableAnnual.dividedBy(months)));
  const uifAnnual = uifAverage.times(months);
  const takeHomeAverage = round2(grossMonthly)
    .plus(travelMonthly)
    .plus(variableMonthly)
    .minus(ownRetirementMonthly)
    .minus(ownMedicalPayroll)
    .minus(payeAverage)
    .minus(uifAverage);
  const takeHomeAnnual = round2(grossAnnual)
    .plus(round2(travelAnnual))
    .plus(round2(variableAnnual))
    .minus(round2(year.ownRetirementAnnual))
    .minus(round2(ownMedicalPayrollAnnual))
    .minus(round2(withheldAnnual))
    .minus(uifAnnual);

  // Step K — payslip comparison (gross and payslip modes only).
  let comparison: PayslipComparison | undefined;
  const slipPaye = n.payslip.payeMonthly;
  if (n.mode !== "TAKE_HOME" && slipPaye !== null) {
    const calcPaye = regular.paye;
    const diff = slipPaye.minus(calcPaye);
    const uifAssumed = n.payslip.uifMonthly === null;
    const slipUif = n.payslip.uifMonthly ?? regular.uif;
    comparison = {
      payslipPaye: toCents(slipPaye),
      calcPaye: calcPaye.toNumber(),
      diff: toCents(diff),
      diffPct: calcPaye.isZero() ? null : diff.dividedBy(calcPaye).times(100).toDecimalPlaces(1).toNumber(),
      closeMatch: diff.abs().lessThanOrEqualTo(1),
      payslipUif: toCents(slipUif),
      calcUif: regular.uif.toNumber(),
      uifAssumed,
    };
    if (uifAssumed) notes.push("PAYSLIP_UIF_ASSUMED");
    if (slipPaye.greaterThan(round2(grossMonthly))) warnings.push("PAYSLIP_PAYE_ABOVE_GROSS");
    applied.push("paye.payslipComparison");
  }
  // UIF is checked on its own: gross-mode users may give UIF without PAYE, and UIF above the legal
  // maximum is impossible whatever else is on the payslip.
  if (n.mode !== "TAKE_HOME" && n.payslip.uifMonthly?.greaterThan(rules.uif.maxMonthlyEmployee)) {
    warnings.push("PAYSLIP_UIF_ABOVE_MAX");
  }

  // Provenance, notes and warnings.
  if (year.employerRetirementAnnual.greaterThan(0)) applied.push("fringeBenefit.employerRetirement");
  if (year.employerMedicalAnnual.greaterThan(0)) applied.push("fringeBenefit.employerMedical");
  if (year.retirement.poolAnnual.greaterThan(0)) {
    applied.push("retirement11F.rate");
    if (year.retirement.capApplied) applied.push("retirement11F.annualCap");
  }
  if (rebates.secondary) applied.push("rebates.secondary65");
  if (rebates.tertiary) applied.push("rebates.tertiary75");
  if (s6aAnnual.greaterThan(0)) applied.push("medical6A");
  if (oop !== null) applied.push(`medical6B.${medical6BBranch(n.ageBand, n.medical.disabilityInFamily) === "UNDER_65" ? "under65" : "olderOrDisabled"}`);
  if (n.advanced.donationsAnnual.greaterThan(0)) applied.push("donations18A.limitRate");
  if (n.advanced.localInterestAnnual.greaterThan(0)) applied.push("interestExemption");
  if (n.advanced.travelAllowanceMonthly.greaterThan(0)) applied.push("travel.taxablePortion");
  if (n.advanced.travelBusinessKmAnnual.greaterThan(0)) applied.push("travel.prescribedRatePerKm");
  if (n.advanced.secondEmployerAnnual.greaterThan(0)) applied.push("income.secondEmployer");

  if (!n.medical.payrollAppliesCredit && s6aAnnual.greaterThan(0)) notes.push("MEDICAL_CREDIT_CLAIMED_ON_FILING");
  if (n.retirement.privateRaMonthly.greaterThan(0)) notes.push("PRIVATE_RA_CLAIMED_ON_FILING");
  if (variableAnnual.greaterThan(0)) {
    applied.push("paye.balanceOfRemuneration");
    notes.push("VARIABLE_PAY_BALANCE_METHOD", "UIF_ON_AVERAGED_VARIABLE_PAY");
    if (variableAnnual.greaterThan(grossAnnual.times(3))) warnings.push("VARIABLE_PAY_HIGH");
  }
  if (oop !== null && n.medical.employerMonthly.greaterThan(0)) notes.push("MEDICAL_6B_INCLUDES_EMPLOYER_CONTRIBUTIONS");
  if (n.advanced.secondEmployerAnnual.greaterThan(0)) notes.push("SECOND_EMPLOYER_PAYE_ESTIMATED");
  if (regular.takeHome.isNegative()) warnings.push("DEDUCTIONS_EXCEED_GROSS");

  const ret = year.retirement;
  const don = year.donations;
  const bracketIndex = findBracketIndex(rules, year.taxable);
  const bracketRate = rules.brackets[bracketIndex]!.rate;
  const threshold = thresholdFor(rules, n.ageBand);
  const belowThreshold = year.taxable.lessThanOrEqualTo(threshold);
  const taxableRate = travelTaxableRate(rules, n);

  const result: CalculationResult = {
    taxYear: rules.taxYear,
    mode: n.mode,
    confidence: n.mode === "TAKE_HOME" ? "ESTIMATE" : "PAYSLIP_ACCURATE",
    ageBand: n.ageBand,
    payFrequency: n.payFrequency,
    periodsPerYear: n.periodsPerYear,
    grossPerPeriod: toCents(grossAnnual.dividedBy(n.periodsPerYear)),
    grossMonthly: toCents(grossMonthly),
    grossAnnual: toCents(grossAnnual),
    employerRetirementMonthly: toCents(n.retirement.employerMonthly),
    employerRetirementAnnual: toCents(year.employerRetirementAnnual),
    employerMedicalMonthly: toCents(year.employerMedicalAnnual.dividedBy(months)),
    employerMedicalAnnual: toCents(year.employerMedicalAnnual),
    ownRetirementMonthly: ownRetirementMonthly.toNumber(),
    ownRetirementAnnual: toCents(year.ownRetirementAnnual),
    privateRaMonthly: toCents(n.retirement.privateRaMonthly),
    privateRaAnnual: toCents(year.privateRaAnnual),
    ownMedicalMonthly: toCents(ownMedicalAnnual.dividedBy(months)),
    ownMedicalAnnual: toCents(ownMedicalAnnual),
    ownMedicalPaidVia: n.medical.ownPaidVia,
    variablePay: {
      bonusAnnual: toCents(n.variable.bonusAnnual),
      overtimeAnnual: toCents(n.variable.overtimeAnnual),
      commissionAnnual: toCents(n.variable.commissionAnnual),
      totalAnnual: toCents(variableAnnual),
      monthlyAverage: variableMonthly.toNumber(),
      taxAnnual: toCents(variableTax),
      effectiveRate: variableAnnual.isZero() ? 0 : variableTax.dividedBy(variableAnnual).toDecimalPlaces(6).toNumber(),
    },
    travel: {
      allowanceMonthly: travelMonthly.toNumber(),
      allowanceAnnual: toCents(travelAnnual),
      taxableRate,
      taxableMonthly: toCents(n.advanced.travelAllowanceMonthly.times(taxableRate)),
      taxableAnnual: toCents(year.travelTaxableAnnual),
      businessKmAnnual: toCents(n.advanced.travelBusinessKmAnnual),
      possibleDeductionAnnual: toCents(
        minD(n.advanced.travelBusinessKmAnnual.times(rules.travel.prescribedRatePerKm), travelAnnual),
      ),
    },
    interest: {
      localAnnual: toCents(n.advanced.localInterestAnnual),
      exemptionAnnual: interestExemptionFor(rules, n),
      exemptAnnual: toCents(minD(n.advanced.localInterestAnnual, dec(interestExemptionFor(rules, n)))),
      taxableAnnual: toCents(year.interestTaxableAnnual),
    },
    secondEmployer: {
      grossAnnual: toCents(n.advanced.secondEmployerAnnual),
      estimatedPayeAnnual: toCents(otherPaye),
    },
    incomeBeforeDeductions: toCents(year.income),
    retirement: {
      fundTypes: n.retirement.fundTypes,
      remunerationAnnual: toCents(year.remuneration),
      poolAnnual: toCents(ret.poolAnnual),
      percentageLimitAnnual: toCents(ret.percentageLimitAnnual),
      limitAnnual: toCents(ret.limitAnnual),
      capApplied: ret.capApplied,
      deductionAnnual: toCents(ret.deductionAnnual),
      deductionMonthly: toCents(ret.deductionAnnual.dividedBy(months)),
      // From the rounded figures, so deduction + carry-forward = pool to the cent.
      carryForwardAnnual: round2(ret.poolAnnual).minus(round2(ret.deductionAnnual)).toNumber(),
      // A salary under R1 a year counts as none, and the figure is capped, so the result is always a sane finite number.
      ownPercentOfGross: grossAnnual.lessThan(1)
        ? 0
        : minD(
            year.ownRetirementAnnual.plus(year.privateRaAnnual).dividedBy(grossAnnual).times(100),
            dec(10_000),
          )
            .toDecimalPlaces(1)
            .toNumber(),
    },
    donations: {
      givenAnnual: toCents(n.advanced.donationsAnnual),
      hasReceipt: n.advanced.has18AReceipt,
      capAnnual: toCents(don.capAnnual),
      deductionAnnual: toCents(don.deductionAnnual),
      carryForwardAnnual: round2(n.advanced.donationsAnnual).minus(round2(don.deductionAnnual)).toNumber(),
    },
    taxableIncome: toCents(year.taxable),
    annualTaxBeforeRebates: toCents(year.taxBefore),
    rebates,
    taxAfterRebates: toCents(year.afterRebates),
    medical6A: {
      members: n.medical.members,
      monthsCovered: n.medical.monthsCovered,
      additionalDependantsMonthly: toCents(
        dec(rules.medical6A.monthlyAdditionalDep).times(Math.max(0, n.medical.members - 2)),
      ),
      monthlyCredit: toCents(medical6AMonthly(rules, n.medical.members)),
      annualCredit: toCents(s6aAnnual),
      appliedAnnual: toCents(s6aApplied),
      unusedAnnual: toCents(s6aAnnual.minus(s6aApplied)),
    },
    medical6B: {
      status: oop === null ? "NOT_PROVIDED" : "CALCULATED",
      branch: medical6BBranch(n.ageBand, n.medical.disabilityInFamily),
      outOfPocketAnnual: toCents(oop ?? ZERO),
      contributionsAnnual: toCents(contributionsAnnual),
      annualCredit: toCents(s6bAnnual),
      appliedAnnual: toCents(s6bApplied),
    },
    annualLiability: toCents(liability),
    annualPaye: toCents(withheldAnnual),
    annualPayeRegular: toCents(regular.withheldAnnual),
    monthlyPaye: regular.paye.toNumber(),
    monthlyPayeAverage: payeAverage.toNumber(),
    filing: {
      balanceAnnual: toCents(filingBalance),
      refundAnnual: toCents(maxD(filingBalance.negated(), ZERO)),
      owedAnnual: toCents(maxD(filingBalance, ZERO)),
    },
    uifMonthly: regular.uif.toNumber(),
    uifMonthlyAverage: uifAverage.toNumber(),
    uifAnnual: toCents(uifAnnual),
    takeHomeMonthly: toCents(regular.takeHome),
    takeHomeMonthlyAverage: toCents(takeHomeAverage),
    takeHomeAnnual: toCents(takeHomeAnnual),
    takeHomePerPeriod: toCents(regular.takeHome.times(months).dividedBy(n.periodsPerYear)),
    uifPerPeriod: toCents(regular.uif.times(months).dividedBy(n.periodsPerYear)),
    bracketIndex,
    bracketRate,
    marginalRate: liability.greaterThan(0) ? bracketRate : 0,
    effectiveRate: year.income.isZero() ? 0 : liability.dividedBy(year.income).toDecimalPlaces(6).toNumber(),
    taxThreshold: threshold,
    belowThreshold,
    bracketWalk: bracketWalk(rules, year.taxable),
    warnings,
    notes,
    flags: buildFlags(rules, n, {
      retirementPoolAnnual: ret.poolAnnual.toNumber(),
      remunerationAnnual: year.remuneration.toNumber(),
      belowThreshold,
      incomeAnnual: year.income.toNumber(),
      medical6BNotProvided: oop === null,
    }),
    provenance: {
      ruleSetVersion: rules.taxYear,
      taxYear: rules.taxYear,
      rulesVersion: rules.rulesVersion,
      status: rules.status,
      period: { start: rules.startDate, end: rules.endDate },
      lastVerifiedAt: rules.lastVerified,
      sourceIds: [...new Set(Object.values(rules.sources).flat())].sort(),
      appliedRules: applied,
    },
  };
  if (estimate) result.estimate = estimate;
  if (comparison) result.comparison = comparison;
  return result;
}


/**
 * Inputs that name one year must never be calculated with another year's rules. A caller that gets this wrong
 * has a bug, so it throws instead of quietly producing a number for the wrong year.
 */
export function assertSameYear(rules: TaxRuleSet, inputs: { taxYear?: string }): void {
  if (inputs.taxYear !== undefined && inputs.taxYear !== rules.taxYear) {
    throw new TaxYearError(
      "YEAR_MISMATCH",
      String(inputs.taxYear),
      `These inputs are for ${inputs.taxYear} but the ${rules.taxYear} rules were given.`,
    );
  }
}
