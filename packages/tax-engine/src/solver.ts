import { type Decimal, ZERO, dec, maxD, round2 } from "./money.ts";
import type { NormalisedInputs } from "./normalise.ts";
import { regularMonth } from "./pipeline.ts";
import type { EstimateDetails, TaxRuleSet } from "./types.ts";

const TOLERANCE = dec("0.01");
const MAX_FIXED_POINT_ITERATIONS = 50;
const MAX_BISECTION_ITERATIONS = 200;
/** PRD §10.3 Step B seed: assume roughly 25% goes to deductions. */
const SEED_NET_RATIO = dec("0.75");

export interface SolveResult {
  grossMonthly: Decimal;
  details: Omit<EstimateDetails, "targetPerPeriod">;
}

/**
 * Take-home → gross (PRD §10.3 Step B). Finds the monthly cash salary whose
 * normal-month take-home equals the target, using whatever retirement and
 * medical answers are known. Bonuses don't affect a normal month (D4), so
 * they don't change the solved gross.
 *
 * Fixed-point iteration first (net pay rises by 54–99 cents per rand of gross,
 * so it converges quickly); bisection if it stalls. Never throws.
 */
export function solveGrossFromTakeHome(
  rules: TaxRuleSet,
  n: NormalisedInputs,
  targetMonthly: Decimal,
  /** Testing hook: set to 0 to exercise the bisection fallback directly. */
  { maxFixedPointIterations = MAX_FIXED_POINT_ITERATIONS }: { maxFixedPointIterations?: number } = {},
): SolveResult {
  const months = rules.monthsPerYear;
  const takeHomeAt = (grossMonthly: Decimal) => regularMonth(rules, n, grossMonthly.times(months)).takeHome;

  if (targetMonthly.lessThanOrEqualTo(0)) {
    return { grossMonthly: ZERO, details: { targetMonthly: 0, method: "NONE", iterations: 0, residual: 0 } };
  }

  const finish = (g: Decimal, method: "FIXED_POINT" | "BISECTION", iterations: number): SolveResult => {
    const gross = round2(maxD(g, ZERO));
    return {
      grossMonthly: gross,
      details: {
        targetMonthly: round2(targetMonthly).toNumber(),
        method,
        iterations,
        residual: round2(targetMonthly.minus(takeHomeAt(gross))).toNumber(),
      },
    };
  };

  // Fixed point: g ← g + (target − takeHome(g)).
  let g = targetMonthly.dividedBy(SEED_NET_RATIO);
  for (let i = 1; i <= maxFixedPointIterations; i++) {
    const gap = targetMonthly.minus(takeHomeAt(g));
    if (gap.abs().lessThan(TOLERANCE)) return finish(g, "FIXED_POINT", i);
    g = maxD(g.plus(gap), ZERO);
  }

  // Bisection fallback: take-home rises with gross, so bracket the target and halve.
  let lo: Decimal = ZERO;
  let hi: Decimal = maxD(g, targetMonthly).times(2);
  let iterations = 0;
  while (takeHomeAt(hi).lessThan(targetMonthly) && iterations < 60) {
    lo = hi;
    hi = hi.times(2);
    iterations++;
  }
  while (hi.minus(lo).greaterThan("0.001") && iterations < MAX_BISECTION_ITERATIONS) {
    const mid = lo.plus(hi).dividedBy(2);
    if (takeHomeAt(mid).lessThan(targetMonthly)) lo = mid;
    else hi = mid;
    iterations++;
  }
  return finish(hi, "BISECTION", maxFixedPointIterations + iterations);
}

