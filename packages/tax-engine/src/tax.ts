import { Decimal, ZERO, dec, maxD, minD, toCents } from "./money.ts";
import type { AgeBand, BracketWalkRow, RebateBreakdown, TaxRuleSet } from "./types.ts";

/** Index of the bracket containing the last rand of taxable income. */
export function findBracketIndex(rules: TaxRuleSet, taxableIncome: Decimal): number {
  const i = rules.brackets.findIndex((b) => b.to === null || taxableIncome.lessThanOrEqualTo(b.to));
  return i === -1 ? rules.brackets.length - 1 : i;
}

/** Annual tax on taxable income before rebates (PRD §10.3 Step G), full precision. */
export function taxBeforeRebates(rules: TaxRuleSet, taxableIncome: Decimal): Decimal {
  const income = maxD(taxableIncome, ZERO);
  const bracket = rules.brackets[findBracketIndex(rules, income)]!;
  return dec(bracket.base).plus(dec(bracket.rate).times(income.minus(bracket.from)));
}

/**
 * Bracket-by-bracket working (PRD §14.3). One row per bracket in the rule set,
 * so the UI can show the full table with the taxpayer's slices filled in.
 */
export function bracketWalk(rules: TaxRuleSet, taxableIncome: Decimal): BracketWalkRow[] {
  const income = maxD(taxableIncome, ZERO);
  const top = findBracketIndex(rules, income);
  let running = ZERO;

  return rules.brackets.map((b, index) => {
    const upper = b.to === null ? income : minD(income, dec(b.to));
    const amount = maxD(upper.minus(b.from), ZERO);
    const tax = amount.times(b.rate);
    running = running.plus(tax);
    return {
      index,
      from: b.from,
      to: b.to,
      rate: b.rate,
      amountInBracket: toCents(amount),
      taxInBracket: toCents(tax),
      runningTotal: toCents(running),
      isTopBracket: index === top,
    };
  });
}

/** Rebates by age band (PRD §6.2). Age is taken at the end of the tax year. */
export function rebatesFor(rules: TaxRuleSet, ageBand: AgeBand): RebateBreakdown {
  const primary = rules.rebates.primary;
  const secondary = ageBand === "UNDER_65" ? 0 : rules.rebates.secondary65;
  const tertiary = ageBand === "AGE_75_PLUS" ? rules.rebates.tertiary75 : 0;
  return { primary, secondary, tertiary, total: primary + secondary + tertiary };
}

/** Age-based tax-free threshold (PRD §6.3). */
export function thresholdFor(rules: TaxRuleSet, ageBand: AgeBand): number {
  switch (ageBand) {
    case "UNDER_65":
      return rules.thresholds.under65;
    case "AGE_65_74":
      return rules.thresholds.age65to74;
    case "AGE_75_PLUS":
      return rules.thresholds.age75plus;
  }
}

/** Annual tax after rebates, floored at R0 (PRD §6.2). Full precision. */
export function taxAfterRebates(rules: TaxRuleSet, taxableIncome: Decimal, ageBand: AgeBand): Decimal {
  return maxD(taxBeforeRebates(rules, taxableIncome).minus(rebatesFor(rules, ageBand).total), ZERO);
}
