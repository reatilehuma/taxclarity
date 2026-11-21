import { calculate } from "./calculate.ts";
import { DEFAULT_TAX_YEAR, getVerifiedRuleSet, type YearOptions } from "./rulesets/registry.ts";
import type { CalculationInputs, CalculationResult, TaxRuleSet } from "./types.ts";

/**
 * A calculator that remembers recent results, keyed on a hash of the inputs
 * (PRD §10.3 B5, §18). The take-home solver runs the pipeline many times, so
 * the live preview should not repeat that work for inputs it has already seen.
 *
 * The key includes the tax year and the rule set's version, so a result worked out under one set of rules
 * can never be handed back for another (PRD §10.5).
 *
 * Results are shared objects — treat them as read-only.
 */
export function createCalculator(
  rules: TaxRuleSet,
  { cacheSize = 100 }: { cacheSize?: number } = {},
): (inputs: CalculationInputs) => CalculationResult {
  const cache = new Map<string, CalculationResult>();
  return (inputs) => {
    const key = cacheKey(rules, inputs);
    const hit = cache.get(key);
    if (hit) {
      // Refresh recency: Map keeps insertion order, so re-insert at the end.
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const result = calculate(rules, inputs);
    cache.set(key, result);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
    return result;
  };
}

/**
 * A calculator that picks the rules from `inputs.taxYear` (the default year when it is left out) and calculates
 * with that year's rule set only. One cache serves every year because each entry is keyed on year and rules
 * version. A year that is unknown, or a draft when no drafts are passed, throws a `TaxYearError`; it never
 * falls back to another year.
 */
export function createYearCalculator(
  options: YearOptions & { cacheSize?: number } = {},
): (inputs: CalculationInputs) => CalculationResult {
  const { cacheSize = 200, ...yearOptions } = options;
  const cache = new Map<string, CalculationResult>();
  return (inputs) => {
    const rules = getVerifiedRuleSet(inputs.taxYear ?? DEFAULT_TAX_YEAR, yearOptions);
    const key = cacheKey(rules, inputs);
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const result = calculate(rules, inputs);
    cache.set(key, result);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
    return result;
  };
}

/** One calculation for the year named in the inputs (see {@link createYearCalculator}). No cache. */
export function calculateForYear(inputs: CalculationInputs, options: YearOptions = {}): CalculationResult {
  return calculate(getVerifiedRuleSet(inputs.taxYear ?? DEFAULT_TAX_YEAR, options), inputs);
}

/**
 * Year and rules version first, then the inputs: the same inputs under different rules are different entries.
 * The year is written into the inputs part too, so leaving it out and naming the default year are one entry.
 */
export function cacheKey(rules: TaxRuleSet, inputs: CalculationInputs): string {
  return `${rules.taxYear}|${rules.rulesVersion}|${stableKey({ ...inputs, taxYear: rules.taxYear })}`;
}

/** JSON with sorted keys, so property order doesn't change the key. */
export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
