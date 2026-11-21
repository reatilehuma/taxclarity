import { type Decimal, ZERO, dec, maxD } from "./money.ts";
import type { AgeBand, TaxRuleSet } from "./types.ts";

/**
 * Monthly Section 6A medical scheme fees tax credit (PRD §6.7):
 * main member, first dependant, then a lower amount per additional dependant.
 * `members` includes the main member.
 */
export function medical6AMonthly(rules: TaxRuleSet, members: number): Decimal {
  if (members < 1) return ZERO;
  const { monthlyMain, monthlyFirstDep, monthlyAdditionalDep } = rules.medical6A;
  let credit = dec(monthlyMain);
  if (members >= 2) credit = credit.plus(monthlyFirstDep);
  if (members >= 3) credit = credit.plus(dec(monthlyAdditionalDep).times(members - 2));
  return credit;
}

/** Annual credit, pro-rated by months of membership (PRD E13). */
export function medical6AAnnual(rules: TaxRuleSet, members: number, monthsCovered: number): Decimal {
  return medical6AMonthly(rules, members).times(monthsCovered);
}

export interface Medical6BArgs {
  ageBand: AgeBand;
  disabilityInFamily: boolean;
  /** Total scheme contributions for the year (employee + employer). */
  contributionsAnnual: Decimal;
  /** The annual Section 6A credit. */
  s6aAnnual: Decimal;
  outOfPocketAnnual: Decimal;
  taxableIncome: Decimal;
}

/** Which Section 6B branch applies. */
export function medical6BBranch(ageBand: AgeBand, disability: boolean): "UNDER_65" | "AGE_65_OR_DISABILITY" {
  return ageBand !== "UNDER_65" || disability ? "AGE_65_OR_DISABILITY" : "UNDER_65";
}

/**
 * Additional medical expenses tax credit, Section 6B (PRD §6.8, §10.3 Step H).
 *
 * 65+ or disability: 33.3% × [ (contributions − 3 × 6A credit) + out-of-pocket ]
 * Under 65:          25%   × [ (contributions − 4 × 6A credit) + out-of-pocket − 7.5% × taxable income ]
 * Each excess-contribution term and the result are floored at R0.
 */
export function medical6B(rules: TaxRuleSet, a: Medical6BArgs): Decimal {
  if (medical6BBranch(a.ageBand, a.disabilityInFamily) === "AGE_65_OR_DISABILITY") {
    const { multiplier, contributionMultiple } = rules.medical6B.olderOrDisabled;
    const excess = maxD(a.contributionsAnnual.minus(a.s6aAnnual.times(contributionMultiple)), ZERO);
    return excess.plus(a.outOfPocketAnnual).times(multiplier);
  }
  const { multiplier, contributionMultiple, incomeThresholdRate } = rules.medical6B.under65;
  const excess = maxD(a.contributionsAnnual.minus(a.s6aAnnual.times(contributionMultiple)), ZERO);
  const base = excess.plus(a.outOfPocketAnnual).minus(a.taxableIncome.times(incomeThresholdRate));
  return maxD(base, ZERO).times(multiplier);
}
