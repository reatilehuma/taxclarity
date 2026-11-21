import { Decimal, dec } from "./money.ts";
import type { TaxRuleSet } from "./types.ts";

/**
 * Checks a rule set for internal consistency (PRD §19). Throws with a list of
 * every problem found. Run in tests so a malformed rule set never ships.
 */
export function assertValidRuleSet(rules: TaxRuleSet): void {
  const problems: string[] = [];
  const { brackets } = rules;

  if (brackets.length === 0) problems.push("brackets: none defined");

  brackets.forEach((b, i) => {
    const label = `bracket ${i + 1}`;
    if (!(b.rate > 0 && b.rate < 1)) problems.push(`${label}: rate ${b.rate} must be between 0 and 1`);
    if (b.base < 0) problems.push(`${label}: base must not be negative`);
    if (b.to !== null && b.to <= b.from) problems.push(`${label}: upper limit must be above lower limit`);

    if (i === 0) {
      if (b.from !== 0) problems.push(`${label}: must start at 0`);
      if (b.base !== 0) problems.push(`${label}: base must be 0`);
      return;
    }

    const prev = brackets[i - 1]!;
    if (prev.to === null) {
      problems.push(`bracket ${i}: only the last bracket may have no upper limit`);
      return;
    }
    if (b.from !== prev.to) problems.push(`${label}: must start where bracket ${i} ends (${prev.to})`);
    if (b.rate <= prev.rate) problems.push(`${label}: rate must be higher than bracket ${i}`);

    // Base amounts are cumulative: base = previous base + previous rate × previous width.
    const expectedBase = dec(prev.base).plus(dec(prev.rate).times(prev.to - prev.from));
    if (!expectedBase.equals(b.base)) {
      problems.push(`${label}: base ${b.base} should be ${expectedBase.toString()}`);
    }
  });

  const last = brackets[brackets.length - 1];
  if (last && last.to !== null) problems.push("last bracket must have no upper limit");

  const { primary, secondary65, tertiary75 } = rules.rebates;
  if (primary <= 0 || secondary65 < 0 || tertiary75 < 0) problems.push("rebates: must be positive");

  // Thresholds equal the rebate stack divided by the first bracket rate, to the nearest rand (PRD §6.3).
  // SARS publishes whole rands, so a stack like R26 679 ÷ 18% = R148 216,67 is printed as R148 217.
  const firstRate = brackets[0]?.rate;
  if (firstRate !== undefined) {
    const check = (name: string, threshold: number, rebateTotal: number) => {
      const expected = dec(rebateTotal).div(firstRate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      if (!expected.equals(threshold)) {
        problems.push(`thresholds.${name}: ${threshold} should be ${expected.toString()} (rebates of ${rebateTotal} ÷ ${firstRate})`);
      }
    };
    check("under65", rules.thresholds.under65, primary);
    check("age65to74", rules.thresholds.age65to74, primary + secondary65);
    check("age75plus", rules.thresholds.age75plus, primary + secondary65 + tertiary75);
  }

  const { employeeRate, monthlyCeiling, maxMonthlyEmployee } = rules.uif;
  if (!dec(monthlyCeiling).times(employeeRate).equals(maxMonthlyEmployee)) {
    problems.push(`uif: ceiling ${monthlyCeiling} × ${employeeRate} should equal max ${maxMonthlyEmployee}`);
  }

  if (!brackets.some((b) => b.rate === rules.guidance.topBracketRate)) {
    problems.push(`guidance.topBracketRate: ${rules.guidance.topBracketRate} must be the rate of one of the brackets`);
  }

  if (rules.monthsPerYear !== 12) problems.push("monthsPerYear must be 12");

  if (problems.length > 0) {
    throw new Error(`Invalid tax rule set ${rules.taxYear}:\n- ${problems.join("\n- ")}`);
  }
}
