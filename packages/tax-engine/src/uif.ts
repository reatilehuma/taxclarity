import { Decimal, dec, minD, round2 } from "./money.ts";
import type { TaxRuleSet } from "./types.ts";

/**
 * Employee UIF for one month (PRD §6.5, §10.3 Step I):
 * 1% of remuneration up to the monthly ceiling, rounded to cents.
 */
export function uifMonthly(rules: TaxRuleSet, grossMonthly: Decimal): Decimal {
  const { employeeRate, monthlyCeiling } = rules.uif;
  return round2(minD(grossMonthly, dec(monthlyCeiling)).times(employeeRate));
}
