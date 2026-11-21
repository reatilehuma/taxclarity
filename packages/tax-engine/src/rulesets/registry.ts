import type { TaxRuleSet, TaxYear } from "../types.ts";
import { TaxRules2026_27 } from "./2026-27.ts";
import { TaxYearError } from "./errors.ts";

/**
 * The years a production build may use: only rule sets that have been signed off (PRD §6.16, §10.5).
 * A year being defined in a file does not put it here. A draft year lives in `drafts.ts`, which only
 * development tools import, so a draft's figures are not in a production bundle at all.
 */
export const VERIFIED_RULE_SETS: readonly TaxRuleSet[] = /* @__PURE__ */ Object.freeze([TaxRules2026_27]);

/** Every year the engine has heard of, signed off or not. Used only to tell "not signed off" from "unknown". */
export const KNOWN_TAX_YEARS: readonly TaxYear[] = Object.freeze(["2025-26", "2026-27"] as const);

/** The year used when the person has not chosen one (PRD §8). It is a default, never a fallback. */
export const DEFAULT_TAX_YEAR: TaxYear = "2026-27";

export interface YearOptions {
  /**
   * Draft (not signed-off) rule sets this caller may use. Only development tools pass any, by importing the list
   * from `drafts.ts`. Left out, only signed-off years can be used, and the drafts are not even in the bundle.
   */
  drafts?: readonly TaxRuleSet[];
}

/**
 * The rule set for a year, only if it may be used. Throws {@link TaxYearError}: UNKNOWN_YEAR for a year nobody
 * defined, UNVERIFIED_YEAR for a defined year that is not signed off (or whose draft was not passed in).
 * It never returns another year.
 */
export function getVerifiedRuleSet(year: string, options: YearOptions = {}): TaxRuleSet {
  const found = [...VERIFIED_RULE_SETS, ...(options.drafts ?? [])].find((r) => r.taxYear === year);
  if (found) return found;
  if ((KNOWN_TAX_YEARS as readonly string[]).includes(year)) {
    throw new TaxYearError("UNVERIFIED_YEAR", year, `The ${year.replace("-", "/")} rules have not been signed off yet, so they cannot be used.`);
  }
  throw new TaxYearError("UNKNOWN_YEAR", String(year), `No rule set for tax year "${year}".`);
}

/** The years that may be offered, oldest first: the signed-off ones plus any drafts the caller passes in. */
export function selectableRuleSets(options: YearOptions = {}): readonly TaxRuleSet[] {
  return [...VERIFIED_RULE_SETS, ...(options.drafts ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
}
