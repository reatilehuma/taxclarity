import { Decimal, dec, maxD, minD } from "./money.ts";
import type { TaxRuleSet } from "./types.ts";

export interface RetirementCalc {
  poolAnnual: Decimal;
  percentageLimitAnnual: Decimal;
  limitAnnual: Decimal;
  capApplied: boolean;
  deductionAnnual: Decimal;
  carryForwardAnnual: Decimal;
}

/**
 * Section 11F retirement deduction (PRD §6.6, §10.3 Step D).
 *
 * The limit is 27.5% of the greater of remuneration or taxable income, capped
 * at the annual rand cap. Taxable income depends on this deduction, so — as
 * SARS does — the test uses taxable income *before* the retirement deduction.
 * Contributions above the limit are carried forward, not lost.
 */
export function retirementDeduction(
  rules: TaxRuleSet,
  args: {
    ownAnnual: Decimal;
    employerAnnual: Decimal;
    remunerationAnnual: Decimal;
    taxableBeforeDeductionAnnual: Decimal;
  },
): RetirementCalc {
  const { rate, annualCap } = rules.retirement11F;
  const poolAnnual = args.ownAnnual.plus(args.employerAnnual);
  const base = maxD(args.remunerationAnnual, args.taxableBeforeDeductionAnnual);
  const percentageLimitAnnual = base.times(rate);
  const cap = dec(annualCap);
  const capApplied = percentageLimitAnnual.greaterThan(cap);
  const limitAnnual = capApplied ? cap : percentageLimitAnnual;
  const deductionAnnual = minD(poolAnnual, limitAnnual);

  return {
    poolAnnual,
    percentageLimitAnnual,
    limitAnnual,
    capApplied,
    deductionAnnual,
    carryForwardAnnual: poolAnnual.minus(deductionAnnual),
  };
}
